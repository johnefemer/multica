package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/integration"
	githubprovider "github.com/multica-ai/multica/server/internal/integration/github"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// IntegrationRegistry holds registered providers. Set by main at startup.
var IntegrationRegistry *integration.Registry

// IntegrationConnectionResponse is the public representation of a connection.
// Access tokens are never returned; only metadata.
type IntegrationConnectionResponse struct {
	Provider             string  `json:"provider"`
	ProviderAccountID    string  `json:"provider_account_id"`
	ProviderAccountName  *string `json:"provider_account_name"`
	ProviderAccountAvatar *string `json:"provider_account_avatar"`
	Scope                *string `json:"scope"`
	Status               string  `json:"status"`
	ErrorMessage         *string `json:"error_message,omitempty"`
	ConnectedAt          string  `json:"connected_at"`
	ConnectedBy          string  `json:"connected_by"`
}

func connectionToResponse(c db.IntegrationConnection) IntegrationConnectionResponse {
	return IntegrationConnectionResponse{
		Provider:              c.Provider,
		ProviderAccountID:     c.ProviderAccountID,
		ProviderAccountName:   textToPtr(c.ProviderAccountName),
		ProviderAccountAvatar: textToPtr(c.ProviderAccountAvatar),
		Scope:                 textToPtr(c.Scope),
		Status:                c.Status,
		ErrorMessage:          textToPtr(c.ErrorMessage),
		ConnectedAt:           timestampToString(c.CreatedAt),
		ConnectedBy:           uuidToString(c.ConnectedBy),
	}
}

// oauthStateKey is the cookie name used for CSRF state verification.
const oauthStateKey = "oauth_state"
const oauthStateTTL = 10 * time.Minute

// IntegrationOAuthStart redirects the user to the provider's OAuth authorization page.
// GET /auth/{provider}/start?workspace={wsSlug}
func (h *Handler) IntegrationOAuthStart(w http.ResponseWriter, r *http.Request) {
	providerName := chi.URLParam(r, "provider")
	wsSlug := r.URL.Query().Get("workspace")
	if wsSlug == "" {
		writeError(w, http.StatusBadRequest, "workspace query parameter is required")
		return
	}

	provider := IntegrationRegistry.Get(providerName)
	if provider == nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("unknown provider: %s", providerName))
		return
	}

	// Generate opaque CSRF state token.
	b := make([]byte, 24)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b) + ":" + wsSlug

	// Store state in a short-lived signed cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateKey,
		Value:    state,
		Path:     "/",
		MaxAge:   int(oauthStateTTL.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
	})

	redirectURI := oauthCallbackURL(r, providerName)
	http.Redirect(w, r, provider.OAuthStartURL(state, redirectURI), http.StatusFound)
}

// IntegrationOAuthCallback handles the provider redirect after authorization.
// GET /auth/{provider}/callback?code=...&state=...
func (h *Handler) IntegrationOAuthCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	providerName := chi.URLParam(r, "provider")

	// Verify CSRF state.
	stateCookie, err := r.Cookie(oauthStateKey)
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		writeError(w, http.StatusBadRequest, "invalid or expired OAuth state")
		return
	}
	// Clear state cookie.
	http.SetCookie(w, &http.Cookie{Name: oauthStateKey, Value: "", MaxAge: -1, Path: "/"})

	// Extract workspace slug from state.
	state := r.URL.Query().Get("state")
	wsSlug := ""
	if idx := len(state) - 1; idx >= 0 {
		for i, c := range state {
			if c == ':' {
				wsSlug = state[i+1:]
				break
			}
		}
	}

	// Resolve workspace.
	ws, err := h.Queries.GetWorkspaceBySlug(ctx, wsSlug)
	if err != nil {
		writeError(w, http.StatusBadRequest, "workspace not found")
		return
	}

	// Authenticate user.
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	userUUID := parseUUID(userID)

	// Check admin/owner role.
	member, err := h.Queries.GetMemberByUserAndWorkspace(ctx, db.GetMemberByUserAndWorkspaceParams{
		UserID:      userUUID,
		WorkspaceID: ws.ID,
	})
	if err != nil || (member.Role != "owner" && member.Role != "admin") {
		writeError(w, http.StatusForbidden, "only workspace admins can connect integrations")
		return
	}

	provider := IntegrationRegistry.Get(providerName)
	if provider == nil {
		writeError(w, http.StatusNotFound, "unknown provider")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		redirectWithError(w, r, wsSlug, providerName, "authorization denied")
		return
	}

	// Exchange code for tokens.
	redirectURI := oauthCallbackURL(r, providerName)
	tokens, err := provider.ExchangeCode(ctx, code, redirectURI)
	if err != nil {
		slog.Error("oauth code exchange failed", "provider", providerName, "error", err)
		redirectWithError(w, r, wsSlug, providerName, "token exchange failed")
		return
	}

	// Fetch account info.
	account, err := provider.FetchAccount(ctx, tokens.AccessToken)
	if err != nil {
		slog.Error("oauth fetch account failed", "provider", providerName, "error", err)
		redirectWithError(w, r, wsSlug, providerName, "failed to fetch account info")
		return
	}

	// Persist connection.
	meta, _ := json.Marshal(map[string]any{})
	var tokenExpiresAt pgtype.Timestamptz
	if tokens.TokenExpiresInSec > 0 {
		t := time.Now().Add(time.Duration(tokens.TokenExpiresInSec) * time.Second)
		tokenExpiresAt = pgtype.Timestamptz{Time: t, Valid: true}
	}
	conn, err := h.Queries.UpsertIntegrationConnection(ctx, db.UpsertIntegrationConnectionParams{
		WorkspaceID:           ws.ID,
		ConnectedBy:           userUUID,
		Provider:              providerName,
		ProviderAccountID:     account.ID,
		ProviderAccountName:   pgtype.Text{String: account.Login, Valid: account.Login != ""},
		ProviderAccountAvatar: pgtype.Text{String: account.AvatarURL, Valid: account.AvatarURL != ""},
		AccessToken:           tokens.AccessToken,
		RefreshToken:          pgtype.Text{String: tokens.RefreshToken, Valid: tokens.RefreshToken != ""},
		TokenExpiresAt:        tokenExpiresAt,
		Scope:                 pgtype.Text{String: tokens.Scope, Valid: tokens.Scope != ""},
		Meta:                  meta,
	})
	if err != nil {
		slog.Error("failed to persist integration connection", "provider", providerName, "error", err)
		redirectWithError(w, r, wsSlug, providerName, "failed to save connection")
		return
	}

	h.Bus.Publish(events.Event{
		Type:        protocol.EventIntegrationConnected,
		WorkspaceID: uuidToString(ws.ID),
		Payload:     connectionToResponse(conn),
	})

	// Redirect back to the dedicated integrations page with success indicator.
	http.Redirect(w, r,
		fmt.Sprintf("/%s/integrations?connected=%s", wsSlug, providerName),
		http.StatusFound,
	)
}

// ListIntegrations returns all active connections for a workspace.
// GET /api/workspaces/{id}/integrations
func (h *Handler) ListIntegrations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	conns, err := h.Queries.ListIntegrationConnections(ctx, wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list integrations")
		return
	}

	resp := make([]IntegrationConnectionResponse, len(conns))
	for i, c := range conns {
		resp[i] = connectionToResponse(c)
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetIntegration returns a single connection for a provider.
// GET /api/workspaces/{id}/integrations/{provider}
func (h *Handler) GetIntegration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}
	providerName := chi.URLParam(r, "provider")

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, providerName)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, nil) // not connected — return null, not 404
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get integration")
		return
	}
	writeJSON(w, http.StatusOK, connectionToResponse(conn))
}

// DisconnectIntegration removes a provider connection from a workspace.
// DELETE /api/workspaces/{id}/integrations/{provider}
func (h *Handler) DisconnectIntegration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}
	providerName := chi.URLParam(r, "provider")

	conn, err := h.Queries.DisconnectIntegration(ctx, wsID, providerName)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "integration not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to disconnect integration")
		return
	}

	h.Bus.Publish(events.Event{
		Type:        protocol.EventIntegrationDisconnected,
		WorkspaceID: uuidToString(wsID),
		Payload:     map[string]string{"provider": providerName},
	})

	writeJSON(w, http.StatusOK, connectionToResponse(conn))
}

// ListGitHubRepos returns repos accessible to the connected GitHub account.
// GET /api/workspaces/{id}/integrations/github/repos
func (h *Handler) ListGitHubRepos(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "github")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "GitHub not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	repos, err := githubprovider.ListRepos(ctx, conn.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to list GitHub repos: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, repos)
}

// ImportGitHubIssuesRequest is the request body for the import endpoint.
type ImportGitHubIssuesRequest struct {
	Repo string `json:"repo"` // "owner/repo"
}

// ImportGitHubIssues imports open GitHub issues from a repo into the workspace.
// POST /api/workspaces/{id}/integrations/github/import-issues
func (h *Handler) ImportGitHubIssues(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	var req ImportGitHubIssuesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Repo == "" {
		writeError(w, http.StatusBadRequest, "repo is required (owner/repo)")
		return
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "github")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "GitHub not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	// Fetch workspace for issue prefix.
	ws, err := h.Queries.GetWorkspace(ctx, wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	// Get authenticated user for creator_id.
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	creatorUUID := parseUUID(userID)

	ghIssues, err := githubprovider.ListIssues(ctx, conn.AccessToken, req.Repo)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to fetch GitHub issues: "+err.Error())
		return
	}

	imported := 0
	skipped := 0
	for _, ghi := range ghIssues {
		extID := fmt.Sprintf("%d", ghi.Number)
		// Check if already imported.
		_, lookupErr := h.Queries.GetIssueByIntegration(ctx, wsID, "github", req.Repo, extID)
		if lookupErr == nil {
			skipped++
			continue // already exists
		}
		if !errors.Is(lookupErr, pgx.ErrNoRows) {
			slog.Warn("import: db lookup error", "error", lookupErr)
			continue
		}

		// Map GitHub state → Agenthost status.
		status := "todo"
		if ghi.State == "closed" {
			status = "done"
		}

		issue, createErr := h.Queries.CreateIntegrationIssue(ctx, db.CreateIntegrationIssueParams{
			WorkspaceID:            wsID,
			Title:                  ghi.Title,
			Description:            pgtype.Text{String: ghi.Body, Valid: ghi.Body != ""},
			Status:                 status,
			Priority:               "medium",
			CreatorType:            "member",
			CreatorID:              creatorUUID,
			IntegrationProvider:    "github",
			IntegrationExternalID:  extID,
			IntegrationExternalURL: ghi.HTMLURL,
			IntegrationRepo:        req.Repo,
		})
		if createErr != nil {
			slog.Warn("import: failed to create issue", "repo", req.Repo, "number", ghi.Number, "error", createErr)
			continue
		}

		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueCreated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(issue, ws.IssuePrefix),
		})
		imported++
	}

	writeJSON(w, http.StatusOK, map[string]int{"imported": imported, "skipped": skipped})
}

// RegisterGitHubWebhookRequest is the request body for webhook registration.
type RegisterGitHubWebhookRequest struct {
	Repo string `json:"repo"` // "owner/repo"
}

// RegisterGitHubWebhook creates a webhook on a GitHub repo pointing at this server.
// POST /api/workspaces/{id}/integrations/github/register-webhook
func (h *Handler) RegisterGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	var req RegisterGitHubWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Repo == "" {
		writeError(w, http.StatusBadRequest, "repo is required (owner/repo)")
		return
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "github")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "GitHub not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	webhookSecret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	if webhookSecret == "" {
		writeError(w, http.StatusServiceUnavailable, "GITHUB_WEBHOOK_SECRET not configured")
		return
	}

	appURL := os.Getenv("MULTICA_APP_URL")
	webhookURL := fmt.Sprintf("%s/webhooks/github?workspace_id=%s", appURL, uuidToString(wsID))

	hookID, err := githubprovider.RegisterWebhook(ctx, conn.AccessToken, req.Repo, webhookURL, webhookSecret)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to register webhook: "+err.Error())
		return
	}

	// Persist the hook ID in meta for future reference.
	meta, _ := json.Marshal(map[string]any{req.Repo: map[string]any{"hook_id": hookID}})
	h.Queries.UpdateIntegrationMeta(ctx, wsID, "github", meta) //nolint:errcheck

	writeJSON(w, http.StatusOK, map[string]any{"hook_id": hookID, "repo": req.Repo})
}

// oauthCallbackURL constructs the absolute callback URL for a provider.
func oauthCallbackURL(r *http.Request, provider string) string {
	appURL := os.Getenv("MULTICA_APP_URL")
	if appURL == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		appURL = scheme + "://" + r.Host
	}
	return fmt.Sprintf("%s/auth/%s/callback", appURL, provider)
}

func redirectWithError(w http.ResponseWriter, r *http.Request, wsSlug, provider, msg string) {
	http.Redirect(w, r,
		fmt.Sprintf("/%s/integrations?error=%s&provider=%s",
			wsSlug, msg, provider),
		http.StatusFound,
	)
}
