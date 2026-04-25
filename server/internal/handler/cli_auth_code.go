package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Lifetime of an issued auth code. Five minutes is short enough that a
// leaked code (screenshot, shoulder-surfing) becomes useless quickly,
// long enough that a user has time to switch terminals, paste, and hit Enter.
const cliAuthCodeTTL = 5 * time.Minute

// 24 random bytes → 32-char base64-url code. Plenty of entropy without
// being so long users won't paste it.
const cliAuthCodeBytes = 24

// IssueCliAuthCode is the rendezvous endpoint called by the frontend after
// a successful login when the CLI is using the device-code flow (cli_state
// in the URL but no cli_callback). It mints a fresh CLI-scoped JWT for the
// authenticated user, stores it under a one-shot opaque code paired to the
// caller-provided state, and returns the code for display.
//
// Auth: caller must be authenticated (cookie or bearer).
// Body: {"state": "<cli verifier>"}
// Resp: {"code": "<opaque>"}
func (h *Handler) IssueCliAuthCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req struct {
		State string `json:"state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	state := strings.TrimSpace(req.State)
	if state == "" {
		writeError(w, http.StatusBadRequest, "state is required")
		return
	}
	// Bound the verifier so an unbounded state doesn't blow up the row.
	if len(state) > 256 {
		writeError(w, http.StatusBadRequest, "state too long")
		return
	}

	user, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	jwtString, err := h.issueJWT(user)
	if err != nil {
		slog.Warn("cli auth code: failed to issue JWT", append(logger.RequestAttrs(r), "error", err, "user_id", userID)...)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	codeBytes := make([]byte, cliAuthCodeBytes)
	if _, err := rand.Read(codeBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate code")
		return
	}
	code := base64.RawURLEncoding.EncodeToString(codeBytes)

	expires := pgtype.Timestamptz{Time: time.Now().Add(cliAuthCodeTTL), Valid: true}
	if err := h.Queries.CreateCliAuthCode(r.Context(), db.CreateCliAuthCodeParams{
		Code:      code,
		State:     state,
		Jwt:       jwtString,
		ExpiresAt: expires,
	}); err != nil {
		// UNIQUE(state) collision means a code was already issued for this
		// CLI session — the legitimate frontend should never hit this since
		// state is freshly minted per `agenthost login --manual` invocation,
		// so treat as a client error.
		writeError(w, http.StatusConflict, "a code has already been issued for this CLI session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

// ExchangeCliAuthCode is called by the CLI after the user pastes the code.
// It atomically deletes the row keyed by (code, state) and returns the JWT,
// which the CLI exchanges for a long-lived PAT via /api/tokens.
//
// Auth: NONE — the (code, state) pair IS the proof of possession.
// Body: {"code": "<from user>", "state": "<cli verifier>"}
// Resp: {"token": "<jwt>"}
func (h *Handler) ExchangeCliAuthCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	code := strings.TrimSpace(req.Code)
	state := strings.TrimSpace(req.State)
	if code == "" || state == "" {
		writeError(w, http.StatusBadRequest, "code and state are required")
		return
	}

	jwtString, err := h.Queries.ConsumeCliAuthCode(r.Context(), db.ConsumeCliAuthCodeParams{
		Code:  code,
		State: state,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Either the code/state pair doesn't match, the code has expired,
			// or it was already consumed. All collapse to one error message —
			// don't leak which case it is.
			writeError(w, http.StatusBadRequest, "code is invalid, expired, or already used")
			return
		}
		slog.Warn("cli auth code: failed to consume", append(logger.RequestAttrs(r), "error", err)...)
		writeError(w, http.StatusInternalServerError, "exchange failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"token": jwtString})
}
