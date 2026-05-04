package handler

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
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

	// Capture user ID now: the auth cookie is SameSite=Strict and won't be
	// sent on the cross-site redirect from the provider, so the callback
	// can't re-authenticate from cookies. We stash the ID in the state
	// cookie (HttpOnly, SameSite=Lax) so it survives the round-trip.
	userID, ok := requireUserID(w, r)
	if !ok {
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

	// Store state + bound userID in a short-lived cookie. The "|userID"
	// suffix is private to the server; only the prefix is sent to the
	// provider as the state query param.
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateKey,
		Value:    state + "|" + userID,
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
//
// This route intentionally has NO auth middleware: the auth cookie is
// SameSite=Strict and the browser drops it on the cross-site redirect
// from the OAuth provider. Identity is recovered from the state cookie
// (SameSite=Lax) set during /auth/{provider}/start.
func (h *Handler) IntegrationOAuthCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	providerName := chi.URLParam(r, "provider")

	// Verify CSRF state and recover user identity from the cookie.
	stateCookie, err := r.Cookie(oauthStateKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired OAuth state")
		return
	}
	cookieParts := strings.SplitN(stateCookie.Value, "|", 2)
	if len(cookieParts) != 2 || cookieParts[0] != r.URL.Query().Get("state") || cookieParts[1] == "" {
		writeError(w, http.StatusBadRequest, "invalid or expired OAuth state")
		return
	}
	userID := cookieParts[1]
	// Clear state cookie.
	http.SetCookie(w, &http.Cookie{Name: oauthStateKey, Value: "", MaxAge: -1, Path: "/"})

	// Extract workspace slug from state.
	state := r.URL.Query().Get("state")
	wsSlug := ""
	for i, c := range state {
		if c == ':' {
			wsSlug = state[i+1:]
			break
		}
	}

	// Resolve workspace.
	ws, err := h.Queries.GetWorkspaceBySlug(ctx, wsSlug)
	if err != nil {
		writeError(w, http.StatusBadRequest, "workspace not found")
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
	Repo      string  `json:"repo"`                 // "owner/repo"
	ProjectID *string `json:"project_id,omitempty"` // optional — issues created with this project_id
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
	failed := 0
	var firstErr error
	for _, ghi := range ghIssues {
		extID := fmt.Sprintf("%d", ghi.Number)
		// Check if already imported.
		_, lookupErr := h.Queries.GetIssueByIntegration(ctx, wsID, "github", req.Repo, extID)
		if lookupErr == nil {
			skipped++
			continue // already exists
		}
		if !errors.Is(lookupErr, pgx.ErrNoRows) {
			slog.Error("import: db lookup error", "repo", req.Repo, "number", ghi.Number, "error", lookupErr)
			failed++
			if firstErr == nil {
				firstErr = lookupErr
			}
			continue
		}

		// Map GitHub state → Agenthost status.
		status := "todo"
		if ghi.State == "closed" {
			status = "done"
		}

		var projectID pgtype.UUID
		if req.ProjectID != nil && *req.ProjectID != "" {
			projectID = parseUUID(*req.ProjectID)
		}
		issue, createErr := h.createIntegrationIssueTx(ctx, wsID, creatorUUID, status, req.Repo, extID, projectID, ghi)
		if createErr != nil {
			slog.Error("import: failed to create issue", "repo", req.Repo, "number", ghi.Number, "error", createErr)
			failed++
			if firstErr == nil {
				firstErr = createErr
			}
			continue
		}

		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueCreated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(issue, ws.IssuePrefix),
		})
		imported++
	}

	resp := map[string]any{
		"imported": imported,
		"skipped":  skipped,
		"failed":   failed,
	}
	// If every issue failed to create, surface the underlying cause so the UI
	// stops claiming success when nothing was imported.
	if failed > 0 && imported == 0 && firstErr != nil {
		resp["error"] = firstErr.Error()
		writeJSON(w, http.StatusInternalServerError, resp)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// createIntegrationIssueTx atomically reserves the next per-workspace issue
// number and inserts the imported issue using it. The tx is required because
// number is bounded by a UNIQUE (workspace_id, number) constraint — without
// it two concurrent imports could pick the same counter value.
func (h *Handler) createIntegrationIssueTx(
	ctx context.Context,
	wsID pgtype.UUID,
	creatorUUID pgtype.UUID,
	status, repo, extID string,
	projectID pgtype.UUID,
	ghi githubprovider.GitHubIssue,
) (db.Issue, error) {
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return db.Issue{}, err
	}
	defer tx.Rollback(ctx)
	qtx := h.Queries.WithTx(tx)

	number, err := qtx.IncrementIssueCounter(ctx, wsID)
	if err != nil {
		return db.Issue{}, fmt.Errorf("increment issue counter: %w", err)
	}

	issue, err := qtx.CreateIntegrationIssue(ctx, db.CreateIntegrationIssueParams{
		WorkspaceID:            wsID,
		Title:                  ghi.Title,
		Description:            pgtype.Text{String: ghi.Body, Valid: ghi.Body != ""},
		Status:                 status,
		Priority:               "medium",
		CreatorType:            "member",
		CreatorID:              creatorUUID,
		Number:                 number,
		ProjectID:              projectID,
		IntegrationProvider:    "github",
		IntegrationExternalID:  extID,
		IntegrationExternalURL: ghi.HTMLURL,
		IntegrationRepo:        repo,
	})
	if err != nil {
		return db.Issue{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Issue{}, err
	}
	return issue, nil
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

	// Block re-registration: if meta already has a hook_id for this repo, refuse.
	// User must remove the existing webhook first via DELETE webhooks endpoint.
	if existing := webhookHookIDFromMeta(conn.Meta, req.Repo); existing != 0 {
		writeError(w, http.StatusConflict, "this repository already has a webhook registered. Remove it first to re-register.")
		return
	}

	webhookURL := fmt.Sprintf("%s/webhooks/github?workspace_id=%s", appURL(), uuidToString(wsID))

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

// webhookHookIDFromMeta extracts the hook_id for a given repo from
// integration_connection.meta. Returns 0 if not present or malformed.
func webhookHookIDFromMeta(metaJSON []byte, repo string) int64 {
	if len(metaJSON) == 0 {
		return 0
	}
	var meta map[string]json.RawMessage
	if err := json.Unmarshal(metaJSON, &meta); err != nil {
		return 0
	}
	raw, ok := meta[repo]
	if !ok {
		return 0
	}
	var entry struct {
		HookID int64 `json:"hook_id"`
	}
	if err := json.Unmarshal(raw, &entry); err != nil {
		return 0
	}
	return entry.HookID
}

// GitHubWebhookListItem is one entry in the registered-webhooks list.
type GitHubWebhookListItem struct {
	Repo           string `json:"repo"`
	HookID         int64  `json:"hook_id"`
	ExistsOnGitHub *bool  `json:"exists_on_github,omitempty"`
}

// ListGitHubWebhooks returns the webhooks registered for this workspace, read
// from integration_connection.meta. ?verify=1 cross-checks each entry against
// GitHub's API (one HTTP call per webhook — costly, opt-in).
// GET /api/workspaces/{id}/integrations/github/webhooks
func (h *Handler) ListGitHubWebhooks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "github")
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusOK, map[string]any{"webhooks": []GitHubWebhookListItem{}})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	items := []GitHubWebhookListItem{}
	if len(conn.Meta) > 0 {
		var meta map[string]struct {
			HookID int64 `json:"hook_id"`
		}
		if err := json.Unmarshal(conn.Meta, &meta); err == nil {
			for repo, entry := range meta {
				if entry.HookID == 0 {
					continue
				}
				items = append(items, GitHubWebhookListItem{Repo: repo, HookID: entry.HookID})
			}
		}
	}

	if r.URL.Query().Get("verify") == "1" {
		for i := range items {
			info, vErr := githubprovider.GetWebhook(ctx, conn.AccessToken, items[i].Repo, items[i].HookID)
			exists := vErr == nil && info != nil
			items[i].ExistsOnGitHub = &exists
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"webhooks": items})
}

// RemoveGitHubWebhook deletes the hook on GitHub and removes it from meta.
// DELETE /api/workspaces/{id}/integrations/github/webhooks/{repo}
// {repo} is URL-encoded "owner/repo".
func (h *Handler) RemoveGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}
	repoParam := chi.URLParam(r, "repo")
	repo, decodeErr := url.PathUnescape(repoParam)
	if decodeErr != nil || repo == "" {
		writeError(w, http.StatusBadRequest, "invalid repo")
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

	hookID := webhookHookIDFromMeta(conn.Meta, repo)
	if hookID == 0 {
		writeError(w, http.StatusNotFound, "no webhook registered for this repository")
		return
	}

	if err := githubprovider.RemoveWebhook(ctx, conn.AccessToken, repo, hookID); err != nil {
		writeError(w, http.StatusBadGateway, "failed to remove webhook on GitHub: "+err.Error())
		return
	}

	if _, err := h.Queries.DeleteIntegrationMetaKey(ctx, wsID, "github", repo); err != nil {
		slog.Error("remove webhook: failed to clean meta", "repo", repo, "error", err)
	}

	w.WriteHeader(http.StatusNoContent)
}

// appURL returns the configured public base URL for this Agenthost instance.
// AGENTHOST_APP_URL is preferred; MULTICA_APP_URL is the legacy name kept for
// backward compatibility on existing deployments.
func appURL() string {
	if u := os.Getenv("AGENTHOST_APP_URL"); u != "" {
		return u
	}
	return os.Getenv("MULTICA_APP_URL")
}

// oauthCallbackURL constructs the absolute callback URL for a provider.
func oauthCallbackURL(r *http.Request, provider string) string {
	u := appURL()
	if u == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		u = scheme + "://" + r.Host
	}
	return fmt.Sprintf("%s/auth/%s/callback", u, provider)
}

func redirectWithError(w http.ResponseWriter, r *http.Request, wsSlug, provider, msg string) {
	http.Redirect(w, r,
		fmt.Sprintf("/%s/integrations?error=%s&provider=%s",
			wsSlug, msg, provider),
		http.StatusFound,
	)
}

// SyncIssueFromIntegration refreshes an imported issue's title, description,
// and status from the upstream provider. Currently GitHub-only.
// POST /api/issues/{id}/sync-integration
func (h *Handler) SyncIssueFromIntegration(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	issue, ok := h.loadIssueForUser(w, r, id)
	if !ok {
		return
	}

	if !issue.IntegrationProvider.Valid || issue.IntegrationProvider.String != "github" {
		writeError(w, http.StatusBadRequest, "issue is not linked to a supported integration")
		return
	}
	if !issue.IntegrationRepo.Valid || !issue.IntegrationExternalID.Valid {
		writeError(w, http.StatusBadRequest, "issue is missing integration repo/external id")
		return
	}

	number, err := strconv.Atoi(issue.IntegrationExternalID.String)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid integration external id")
		return
	}

	ctx := r.Context()
	conn, err := h.Queries.GetIntegrationConnection(ctx, issue.WorkspaceID, "github")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusFailedDependency, "GitHub is not connected for this workspace")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	ghi, err := githubprovider.GetIssue(ctx, conn.AccessToken, issue.IntegrationRepo.String, number)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to fetch GitHub issue: "+err.Error())
		return
	}
	if ghi == nil {
		writeError(w, http.StatusNotFound, "GitHub issue not found (may have been deleted)")
		return
	}

	// Mirror webhook + import behavior: open → todo, closed → done. Only
	// flip status when the upstream state actually disagrees with ours,
	// otherwise a closed-then-reopened-then-pulled flow would clobber
	// in-flight statuses like in_progress.
	status := issue.Status
	switch ghi.State {
	case "open":
		if status == "done" || status == "cancelled" {
			status = "todo"
		}
	case "closed":
		status = "done"
	}

	updated, err := h.Queries.SyncIssueFromIntegration(ctx, issue.ID, ghi.Title,
		pgtype.Text{String: ghi.Body, Valid: ghi.Body != ""}, status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update issue")
		return
	}

	prefix := h.getIssuePrefix(ctx, updated.WorkspaceID)
	resp := issueToResponse(updated, prefix)
	h.Bus.Publish(events.Event{
		Type:        protocol.EventIssueUpdated,
		WorkspaceID: uuidToString(updated.WorkspaceID),
		Payload:     resp,
	})
	writeJSON(w, http.StatusOK, resp)
}
