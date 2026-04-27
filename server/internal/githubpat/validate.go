// Package githubpat validates GitHub tokens against the REST API (used for
// runtime PAT checks before persisting to the database).
package githubpat

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const apiUserURL = "https://api.github.com/user"

// Result is returned when a token successfully authenticates to api.github.com/user.
type Result struct {
	Login  string
	Scopes string // from X-OAuth-Scopes; may be empty for some token types
}

// ValidateToken calls GET /user with the given bearer token.
// On 401/403 it returns a concise error; on other non-200 it includes the body prefix.
func ValidateToken(ctx context.Context, token string) (*Result, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("token is empty")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiUserURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GitHub API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	switch resp.StatusCode {
	case http.StatusOK:
		var u struct {
			Login string `json:"login"`
		}
		if err := json.Unmarshal(body, &u); err != nil {
			return nil, fmt.Errorf("parse GitHub user: %w", err)
		}
		if u.Login == "" {
			return nil, fmt.Errorf("GitHub returned empty login")
		}
		scopes := strings.TrimSpace(resp.Header.Get("X-OAuth-Scopes"))
		return &Result{Login: u.Login, Scopes: scopes}, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, fmt.Errorf("GitHub rejected this token (%d)", resp.StatusCode)
	default:
		msg := strings.TrimSpace(string(body))
		if len(msg) > 200 {
			msg = msg[:200] + "…"
		}
		if msg == "" {
			msg = "(empty body)"
		}
		return nil, fmt.Errorf("GitHub API error %d: %s", resp.StatusCode, msg)
	}
}
