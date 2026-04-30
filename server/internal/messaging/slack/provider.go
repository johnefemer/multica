// Package slack implements the Slack integration provider.
//
// Phase 1 wires only the OAuth v2 install flow: install button → Slack consent
// screen → callback → integration_connection row written. Slash commands,
// events, interactivity, and chat mirroring land in later phases.
package slack

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/multica-ai/multica/server/internal/integration"
)

const (
	authURL  = "https://slack.com/oauth/v2/authorize"
	tokenURL = "https://slack.com/api/oauth.v2.access"
	apiBase  = "https://slack.com/api"

	// defaultBotScope is the full bot-scope set required across all v1 phases.
	// We ask for everything up front so users don't have to re-install when
	// later phases (chat mirroring, slash commands, DMs) ship. Each scope is
	// load-bearing somewhere in the v1 plan — see docs/slack-integration.md.
	//
	//   app_mentions:read   — Events API: receive @mentions in bound channels.
	//   channels:history    — read public-channel messages for chat mirroring.
	//   channels:read       — list channels for the binding picker.
	//   chat:write          — post agent replies and notifications.
	//   commands            — execute /agenthost slash commands.
	//   groups:history      — same as channels:history but for private channels.
	//   groups:read         — list private channels for the binding picker.
	//   im:history          — read DMs (e.g. /agenthost link callbacks).
	//   im:write            — DM users (admin approvals, link prompts).
	//   team:read           — fetch team metadata for FetchAccount.
	//   users:read          — resolve Slack user → profile.
	//   users:read.email    — required for seamless onboarding (email match).
	defaultBotScope = "app_mentions:read,channels:history,channels:read,chat:write,commands,groups:history,groups:read,im:history,im:write,team:read,users:read,users:read.email"
)

// Provider implements integration.Provider for Slack OAuth v2.
type Provider struct {
	clientID      string
	clientSecret  string
	signingSecret string
}

// New returns a Slack provider configured with the given credentials.
// signingSecret is used to verify inbound Slack requests (events, commands,
// interactivity) — even though Phase 1 wires no such endpoints, holding it
// on the provider keeps later phases additive.
func New(clientID, clientSecret, signingSecret string) *Provider {
	return &Provider{
		clientID:      clientID,
		clientSecret:  clientSecret,
		signingSecret: signingSecret,
	}
}

func (p *Provider) Name() string { return "slack" }

func (p *Provider) OAuthStartURL(state, redirectURI string) string {
	v := url.Values{}
	v.Set("client_id", p.clientID)
	v.Set("scope", defaultBotScope)
	v.Set("redirect_uri", redirectURI)
	v.Set("state", state)
	return authURL + "?" + v.Encode()
}

func (p *Provider) ExchangeCode(ctx context.Context, code, redirectURI string) (*integration.TokenResult, error) {
	body := url.Values{}
	body.Set("client_id", p.clientID)
	body.Set("client_secret", p.clientSecret)
	body.Set("code", code)
	body.Set("redirect_uri", redirectURI)

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(body.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack oauth: token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		OK          bool   `json:"ok"`
		Error       string `json:"error"`
		AccessToken string `json:"access_token"` // bot token: xoxb-...
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		BotUserID   string `json:"bot_user_id"`
		AppID       string `json:"app_id"`
		Team        struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"team"`
		Enterprise struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"enterprise"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("slack oauth: failed to parse token response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack oauth: %s", result.Error)
	}
	return &integration.TokenResult{
		AccessToken: result.AccessToken,
		Scope:       result.Scope,
		// Slack bot tokens do not expire and Slack does not issue a refresh
		// token by default, so RefreshToken / TokenExpiresInSec stay zero.
	}, nil
}

func (p *Provider) FetchAccount(ctx context.Context, token string) (*integration.AccountInfo, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+"/team.info", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack: team.info failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Team  struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Domain string `json:"domain"`
			Icon   struct {
				Image88  string `json:"image_88"`
				Image132 string `json:"image_132"`
			} `json:"icon"`
		} `json:"team"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("slack: decode team.info failed: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack: team.info: %s", result.Error)
	}
	avatar := result.Team.Icon.Image132
	if avatar == "" {
		avatar = result.Team.Icon.Image88
	}
	return &integration.AccountInfo{
		ID:        result.Team.ID,
		Login:     result.Team.Name,
		Name:      result.Team.Name,
		AvatarURL: avatar,
	}, nil
}

// VerifyWebhook validates Slack's signed request format.
// Reference: https://api.slack.com/authentication/verifying-requests-from-slack
//
// The generic /webhooks/{provider} handler hardcodes GITHUB_WEBHOOK_SECRET
// and is not on the v1 path for Slack — Slack uses dedicated endpoints for
// events / commands / interactivity in later phases. This method exists to
// satisfy the integration.Provider interface and to be reused by those
// dedicated handlers when they land.
func (p *Provider) VerifyWebhook(r *http.Request, secret string) error {
	if secret == "" {
		secret = p.signingSecret
	}
	if secret == "" {
		return fmt.Errorf("slack webhook: signing secret not configured")
	}
	ts := r.Header.Get("X-Slack-Request-Timestamp")
	sig := r.Header.Get("X-Slack-Signature")
	if ts == "" || sig == "" {
		return fmt.Errorf("slack webhook: missing signature headers")
	}
	tsInt, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return fmt.Errorf("slack webhook: malformed timestamp")
	}
	if d := time.Since(time.Unix(tsInt, 0)); d > 5*time.Minute || d < -5*time.Minute {
		return fmt.Errorf("slack webhook: stale request (replay protection)")
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("slack webhook: failed to read body: %w", err)
	}
	r.Body = io.NopCloser(strings.NewReader(string(body)))

	base := "v0:" + ts + ":" + string(body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(base))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return fmt.Errorf("slack webhook: signature mismatch")
	}
	return nil
}

// HandleEvent is a no-op in Phase 1. The generic /webhooks/{provider} dispatch
// is GitHub-shaped (single endpoint, single secret); Slack ships dedicated
// /webhooks/slack/{events,commands,interactivity} endpoints in later phases
// with their own dispatch logic.
func (p *Provider) HandleEvent(_ context.Context, _ *integration.WebhookEvent) error {
	return nil
}
