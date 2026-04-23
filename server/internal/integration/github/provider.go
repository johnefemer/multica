// Package github implements the GitHub OAuth integration provider.
package github

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
	"strings"
	"time"

	"github.com/multica-ai/multica/server/internal/integration"
)

const (
	authURL     = "https://github.com/login/oauth/authorize"
	tokenURL    = "https://github.com/login/oauth/access_token"
	apiBase     = "https://api.github.com"
	// Scopes requested: repo (issues+PRs+code), read:org, read:user, admin:repo_hook
	defaultScope = "repo,read:org,read:user,admin:repo_hook"
)

// Provider implements integration.Provider for GitHub OAuth.
type Provider struct {
	clientID     string
	clientSecret string
	webhookSecret string
}

// New returns a new GitHub provider. Secrets are read from the caller (typically env).
func New(clientID, clientSecret, webhookSecret string) *Provider {
	return &Provider{
		clientID:      clientID,
		clientSecret:  clientSecret,
		webhookSecret: webhookSecret,
	}
}

func (p *Provider) Name() string { return "github" }

func (p *Provider) OAuthStartURL(state, redirectURI string) string {
	v := url.Values{}
	v.Set("client_id", p.clientID)
	v.Set("redirect_uri", redirectURI)
	v.Set("scope", defaultScope)
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
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github oauth: token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		AccessToken string `json:"access_token"`
		Scope       string `json:"scope"`
		TokenType   string `json:"token_type"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("github oauth: failed to parse token response: %w", err)
	}
	if result.Error != "" {
		return nil, fmt.Errorf("github oauth: %s — %s", result.Error, result.ErrorDesc)
	}
	return &integration.TokenResult{
		AccessToken: result.AccessToken,
		Scope:       result.Scope,
		// GitHub tokens do not expire (no refresh token, no expiry).
	}, nil
}

func (p *Provider) FetchAccount(ctx context.Context, token string) (*integration.AccountInfo, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+"/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github: fetch user failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github: fetch user returned %d", resp.StatusCode)
	}

	var user struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("github: decode user failed: %w", err)
	}
	return &integration.AccountInfo{
		ID:        fmt.Sprintf("%d", user.ID),
		Login:     user.Login,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
	}, nil
}

func (p *Provider) VerifyWebhook(r *http.Request, secret string) error {
	sig := r.Header.Get("X-Hub-Signature-256")
	if sig == "" {
		return fmt.Errorf("github webhook: missing X-Hub-Signature-256 header")
	}
	sig = strings.TrimPrefix(sig, "sha256=")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("github webhook: failed to read body: %w", err)
	}
	// Restore body for downstream reading.
	r.Body = io.NopCloser(strings.NewReader(string(body)))

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return fmt.Errorf("github webhook: signature mismatch")
	}
	return nil
}

// HandleEvent is a no-op at the provider level; event routing is done by the
// webhook handler in the server package which has DB access.
func (p *Provider) HandleEvent(_ context.Context, _ *integration.WebhookEvent) error {
	return nil
}

// ListRepos fetches repositories accessible to the authenticated user.
func ListRepos(ctx context.Context, token string) ([]RepoInfo, error) {
	var all []RepoInfo
	page := 1
	for {
		reqURL := fmt.Sprintf("%s/user/repos?per_page=100&page=%d&sort=updated&visibility=all", apiBase, page)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("github: list repos failed: %w", err)
		}
		defer resp.Body.Close()

		var repos []struct {
			FullName    string `json:"full_name"`
			Description string `json:"description"`
			Private     bool   `json:"private"`
			HTMLURL     string `json:"html_url"`
			UpdatedAt   string `json:"updated_at"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
			return nil, err
		}
		for _, r := range repos {
			all = append(all, RepoInfo{
				FullName:    r.FullName,
				Description: r.Description,
				Private:     r.Private,
				HTMLURL:     r.HTMLURL,
			})
		}
		if len(repos) < 100 {
			break
		}
		page++
	}
	return all, nil
}

// RepoInfo is a summary of a GitHub repository.
type RepoInfo struct {
	FullName    string `json:"full_name"`
	Description string `json:"description"`
	Private     bool   `json:"private"`
	HTMLURL     string `json:"html_url"`
}

// ListIssues fetches open issues from a GitHub repo (paginated).
func ListIssues(ctx context.Context, token, repo string) ([]GitHubIssue, error) {
	var all []GitHubIssue
	page := 1
	for {
		reqURL := fmt.Sprintf("%s/repos/%s/issues?state=open&per_page=100&page=%d", apiBase, repo, page)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("github: list issues failed: %w", err)
		}
		defer resp.Body.Close()

		var issues []GitHubIssue
		if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
			return nil, err
		}
		// Filter out pull requests (GitHub API returns PRs in /issues endpoint).
		for _, issue := range issues {
			if issue.PullRequest == nil {
				all = append(all, issue)
			}
		}
		if len(issues) < 100 {
			break
		}
		page++
	}
	return all, nil
}

// GitHubIssue is a GitHub issue from the REST API.
type GitHubIssue struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	HTMLURL string `json:"html_url"`
	State   string `json:"state"`
	// PullRequest is non-nil when the item is a PR (to be filtered out).
	PullRequest *struct{} `json:"pull_request,omitempty"`
}

// RegisterWebhook creates a webhook on the given repo.
func RegisterWebhook(ctx context.Context, token, repo, webhookURL, secret string) (int64, error) {
	type hookConfig struct {
		URL         string `json:"url"`
		ContentType string `json:"content_type"`
		Secret      string `json:"secret"`
		InsecureSSL string `json:"insecure_ssl"`
	}
	type hookBody struct {
		Name   string     `json:"name"`
		Active bool       `json:"active"`
		Events []string   `json:"events"`
		Config hookConfig `json:"config"`
	}
	body := hookBody{
		Name:   "web",
		Active: true,
		Events: []string{"issues", "pull_request", "workflow_run", "push"},
		Config: hookConfig{
			URL:         webhookURL,
			ContentType: "json",
			Secret:      secret,
			InsecureSSL: "0",
		},
	}
	raw, _ := json.Marshal(body)
	reqURL := fmt.Sprintf("%s/repos/%s/hooks", apiBase, repo)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(string(raw)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("github: register webhook failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("github: register webhook returned %d: %s", resp.StatusCode, string(b))
	}
	var hook struct {
		ID        int64     `json:"id"`
		CreatedAt time.Time `json:"created_at"`
	}
	json.NewDecoder(resp.Body).Decode(&hook)
	return hook.ID, nil
}
