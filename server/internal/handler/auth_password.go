package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Password login constraints. The endpoint is unauthenticated and takes a
// guessable identifier, so the caps are tighter than the contact form's.
const (
	passwordBodyLimit      = 4 * 1024 // 4 KiB request envelope cap
	passwordAttemptsPerKey = 10       // failed attempts per key per window
	passwordAttemptWindow  = 15 * time.Minute
)

// bcryptDecoyHash is a valid bcrypt hash of a value nobody knows. Comparing
// against it when the account is missing or has no password keeps the failure
// path's timing close to the real one, so response latency can't be used to
// enumerate accounts.
const bcryptDecoyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// passwordLimiter throttles failed credential checks. Keys are
// "<email>|<ip>" for login and "user:<id>" for the change-password flow, so
// one attacker cannot lock out a victim's account from a different address.
// Same single-instance caveat as contactRateLimiter (see its comment).
var passwordLimiter = newAttemptLimiter()

type attemptLimiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func newAttemptLimiter() *attemptLimiter {
	return &attemptLimiter{hits: make(map[string][]time.Time)}
}

// allow reports whether the key is still under the cap, without recording
// anything. Only failures are recorded (via fail), so a user who types their
// password correctly is never throttled.
func (l *attemptLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.prune(key)) < passwordAttemptsPerKey
}

func (l *attemptLimiter) fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.hits[key] = append(l.prune(key), time.Now())
}

func (l *attemptLimiter) reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.hits, key)
}

// prune drops timestamps outside the window and stores the result. Caller
// must hold the mutex.
func (l *attemptLimiter) prune(key string) []time.Time {
	cutoff := time.Now().Add(-passwordAttemptWindow)
	stamps := l.hits[key]
	kept := stamps[:0]
	for _, t := range stamps {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.hits, key)
	} else {
		l.hits[key] = kept
	}
	return kept
}

type PasswordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SetPasswordRequest struct {
	// CurrentPassword is required only when the account already has a
	// password. Accounts that signed in with an email code or Google set
	// their first password without it, because the session is already proof of
	// identity.
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// PasswordLogin authenticates an existing user with email + password. It
// never creates an account: signup stays on the email-code and Google paths,
// which verify the address first.
func (h *Handler) PasswordLogin(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, passwordBodyLimit)

	var req PasswordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	key := email + "|" + clientIP(r)
	if !passwordLimiter.allow(key) {
		writeError(w, http.StatusTooManyRequests, "too many failed attempts. Try again later or sign in with an email code.")
		return
	}

	// Single generic failure for "no such user", "no password set" and
	// "wrong password". Distinguishing them would turn this endpoint into an
	// account-existence oracle; the UI offers the email-code fallback for
	// users who never set a password.
	reject := func(reason string) {
		passwordLimiter.fail(key)
		slog.Info("password login rejected", append(logger.RequestAttrs(r), "email", email, "reason", reason)...)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
	}

	user, err := h.Queries.GetUserByEmail(r.Context(), email)
	if err != nil {
		if !isNotFound(err) {
			writeError(w, http.StatusInternalServerError, "failed to lookup user")
			return
		}
		auth.VerifyPassword(bcryptDecoyHash, req.Password)
		reject("no_such_user")
		return
	}

	if !user.PasswordHash.Valid || user.PasswordHash.String == "" {
		auth.VerifyPassword(bcryptDecoyHash, req.Password)
		reject("no_password_set")
		return
	}

	if !auth.VerifyPassword(user.PasswordHash.String, req.Password) {
		reject("bad_password")
		return
	}

	passwordLimiter.reset(key)
	h.finishLogin(w, r, user, "password", 30*24*time.Hour)
}

// SetPassword sets or replaces the password of the authenticated user.
func (h *Handler) SetPassword(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, passwordBodyLimit)

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req SetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	hasPassword := user.PasswordHash.Valid && user.PasswordHash.String != ""
	if hasPassword {
		key := "user:" + userID
		if !passwordLimiter.allow(key) {
			writeError(w, http.StatusTooManyRequests, "too many failed attempts. Try again later.")
			return
		}
		if !auth.VerifyPassword(user.PasswordHash.String, req.CurrentPassword) {
			passwordLimiter.fail(key)
			writeError(w, http.StatusBadRequest, "current password is incorrect")
			return
		}
		passwordLimiter.reset(key)
	}

	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		slog.Error("failed to hash password", append(logger.RequestAttrs(r), "error", err, "user_id", userID)...)
		writeError(w, http.StatusInternalServerError, "failed to set password")
		return
	}

	updated, err := h.Queries.SetUserPassword(r.Context(), db.SetUserPasswordParams{
		ID:           user.ID,
		PasswordHash: pgtype.Text{String: hash, Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set password")
		return
	}

	slog.Info("user password set", append(logger.RequestAttrs(r), "user_id", userID, "replaced", hasPassword)...)
	writeJSON(w, http.StatusOK, userToResponse(updated))
}
