// Package integration defines the provider interface and registry for
// all OAuth-based integrations (GitHub, Slack, Notion, …).
package integration

import (
	"context"
	"net/http"
)

// TokenResult holds the tokens returned after an OAuth code exchange.
type TokenResult struct {
	AccessToken  string
	RefreshToken string // empty if provider does not issue refresh tokens
	Scope        string
	// TokenExpiresAt is zero if the token does not expire.
	TokenExpiresInSec int64
}

// AccountInfo holds the authenticated user/org profile from the provider.
type AccountInfo struct {
	ID        string
	Login     string // username, email, team name, etc.
	Name      string
	AvatarURL string
}

// WebhookEvent is the parsed, provider-verified event passed to HandleEvent.
type WebhookEvent struct {
	DeliveryID  string
	EventType   string
	WorkspaceID string // resolved by the webhook router
	Payload     []byte // raw JSON body
}

// Provider is implemented by every integration (GitHub, Slack, …).
type Provider interface {
	// Name returns the lowercase slug used in routes and the DB (e.g. "github").
	Name() string

	// OAuthStartURL builds the provider authorization URL.
	// state is a CSRF-proof opaque value; redirectURI is the callback URL.
	OAuthStartURL(state, redirectURI string) string

	// ExchangeCode exchanges an authorization code for tokens.
	ExchangeCode(ctx context.Context, code, redirectURI string) (*TokenResult, error)

	// FetchAccount fetches the authenticated account info using the given token.
	FetchAccount(ctx context.Context, token string) (*AccountInfo, error)

	// VerifyWebhook validates the incoming webhook request signature.
	// Returns nil if valid, a descriptive error otherwise.
	VerifyWebhook(r *http.Request, secret string) error

	// HandleEvent processes a single verified webhook event.
	HandleEvent(ctx context.Context, ev *WebhookEvent) error
}
