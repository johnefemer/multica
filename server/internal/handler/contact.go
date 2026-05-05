package handler

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/multica-ai/multica/server/internal/logger"
	"github.com/multica-ai/multica/server/internal/service"
)

// Contact form constraints. The numbers here lean conservative because this
// endpoint is unauthenticated and reachable from the public internet — the
// goal is "humans can submit thoughtful inquiries, bots cannot".
const (
	contactBodyLimit       = 16 * 1024 // 16 KiB request envelope cap
	contactNameMin         = 2
	contactNameMax         = 80
	contactCompanyMax      = 120
	contactTopicMax        = 60
	contactMessageMin      = 10
	contactMessageMax      = 5000
	contactEmailMax        = 254 // RFC 5321 max email address length
	contactPerIPHourly     = 5   // submissions per IP per rolling hour
	contactRateLimitWindow = time.Hour
)

// contactWhitelistedTopics caps the topic field to a known set so bots can't
// stuff arbitrary text into the email Subject. Mirrors the dropdown options
// rendered on /contact in the frontend.
var contactWhitelistedTopics = map[string]struct{}{
	"Product question": {},
	"Bug report":       {},
	"Sales / Demo":     {},
	"Partnership":      {},
	"Press / Media":    {},
	"Other":            {},
}

// CreateContactRequest is the public form payload from /contact. `Hp` is a
// honeypot — a hidden input that real users never see; bots that auto-fill
// every field will populate it and get silently rejected.
type CreateContactRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Company string `json:"company"`
	Topic   string `json:"topic"`
	Message string `json:"message"`
	Hp      string `json:"hp"`
}

// contactRateLimiter is a small, in-process IP→submission-counts map used to
// enforce a rolling-hour cap on the public /api/contact endpoint. We don't
// need a Redis-backed limiter here because:
//   - The public form's traffic is low even on the worst spam day.
//   - A single-instance deploy is the current topology.
//   - Stale entries are cleaned up lazily on each call.
//
// If/when we scale to multiple backend instances, this should move to a
// shared store. The accuracy loss in the meantime (a determined bot
// distributed across instances) is acceptable for a marketing form.
type contactRateLimiter struct {
	mu      sync.Mutex
	hits    map[string][]time.Time
}

func newContactRateLimiter() *contactRateLimiter {
	return &contactRateLimiter{hits: make(map[string][]time.Time)}
}

// allow returns true if the IP is below the per-hour cap. A side effect on
// success is recording the hit timestamp; a side effect always is dropping
// timestamps outside the window for that IP.
func (l *contactRateLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-contactRateLimitWindow)
	stamps := l.hits[ip]
	kept := stamps[:0]
	for _, t := range stamps {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= contactPerIPHourly {
		l.hits[ip] = kept
		return false
	}
	kept = append(kept, now)
	l.hits[ip] = kept
	return true
}

var contactLimiter = newContactRateLimiter()

func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, contactBodyLimit)
	var req CreateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Honeypot: silently 200 to confuse bots that probe for error fingerprints.
	// We don't enqueue or send anything.
	if strings.TrimSpace(req.Hp) != "" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}

	name := strings.TrimSpace(req.Name)
	email := strings.TrimSpace(req.Email)
	company := strings.TrimSpace(req.Company)
	topic := strings.TrimSpace(req.Topic)
	message := strings.TrimSpace(req.Message)

	if l := utf8Len(name); l < contactNameMin || l > contactNameMax {
		writeError(w, http.StatusBadRequest, "name length out of range")
		return
	}
	if utf8Len(email) > contactEmailMax {
		writeError(w, http.StatusBadRequest, "email too long")
		return
	}
	if _, err := mail.ParseAddress(email); err != nil {
		writeError(w, http.StatusBadRequest, "email is invalid")
		return
	}
	if utf8Len(company) > contactCompanyMax {
		writeError(w, http.StatusBadRequest, "company too long")
		return
	}
	if _, ok := contactWhitelistedTopics[topic]; !ok {
		writeError(w, http.StatusBadRequest, "topic is invalid")
		return
	}
	if l := utf8Len(message); l < contactMessageMin || l > contactMessageMax {
		writeError(w, http.StatusBadRequest, "message length out of range")
		return
	}

	ip := clientIP(r)
	if !contactLimiter.allow(ip) {
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded — please try again later")
		return
	}

	if h.EmailService == nil {
		// Should not happen — handler.New always wires one in. Surface as 500
		// rather than silently dropping the inquiry.
		slog.Error("contact: email service is nil", logger.RequestAttrs(r)...)
		writeError(w, http.StatusInternalServerError, "service unavailable")
		return
	}

	inquiry := service.ContactInquiry{
		Name:      name,
		Email:     email,
		Company:   company,
		Topic:     topic,
		Message:   message,
		IPAddress: ip,
		UserAgent: r.UserAgent(),
	}
	if err := h.EmailService.SendContactForm(inquiry); err != nil {
		slog.Warn("contact: send email failed", append(logger.RequestAttrs(r), "error", err)...)
		writeError(w, http.StatusBadGateway, "could not deliver — try again or write to agenthost@kensink.com")
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "queued"})
}

// clientIP pulls the requester's IP address. Trust the first hop in the
// X-Forwarded-For chain when present (we sit behind nginx which sets it),
// otherwise fall back to RemoteAddr. Strip the port for a clean key.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take only the leftmost (original client) address — every hop
		// appends, the rightmost is the closest proxy.
		if comma := strings.IndexByte(xff, ','); comma > 0 {
			return strings.TrimSpace(xff[:comma])
		}
		return strings.TrimSpace(xff)
	}
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return strings.TrimSpace(real)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// utf8Len counts user-visible characters; len() would count bytes and
// over-restrict multi-byte messages.
func utf8Len(s string) int {
	n := 0
	for range s {
		n++
	}
	return n
}
