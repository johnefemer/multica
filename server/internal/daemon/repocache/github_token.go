package repocache

// Kensink fork: GitHub token injection for remote git operations.
//
// The daemon resolves one GitHub token (runtime settings → daemon env →
// `gh auth token`) and hands it to the cache via SetToken. A repo checkout
// request may also carry a per-task token, which wins for that checkout.
// The token travels on the context, so every remote git call made through the
// runGit*Context helpers picks it up without changing their signatures.

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// GitHubAuthError is returned when a clone or fetch fails because GitHub
// rejected (or never received) credentials. Callers surface it as an
// actionable "configure a token" error instead of a raw git message.
type GitHubAuthError struct {
	Op  string // "clone" or "fetch"
	URL string
	Msg string // underlying git error message
}

func (e *GitHubAuthError) Error() string {
	return fmt.Sprintf("github auth failed during %s of %s: %s", e.Op, e.URL, e.Msg)
}

// classifyGitError turns a failed remote git command into a *GitHubAuthError
// when the output looks like an authentication failure, and otherwise into
// the same "<prefix>: <output>: <err>" error the caller produced before.
func classifyGitError(op, target, prefix string, out []byte, err error) error {
	msg := strings.ToLower(string(out))
	if strings.Contains(msg, "authentication failed") ||
		strings.Contains(msg, "repository not found") ||
		strings.Contains(msg, "invalid username or password") ||
		strings.Contains(msg, "could not read username") ||
		strings.Contains(msg, "the requested url returned error: 403") ||
		strings.Contains(msg, "the requested url returned error: 401") {
		return &GitHubAuthError{Op: op, URL: target, Msg: strings.TrimSpace(string(out))}
	}
	return fmt.Errorf("%s: %s: %w", prefix, strings.TrimSpace(string(out)), err)
}

// IsGitHubAuthError reports whether err (or anything it wraps) is a
// *GitHubAuthError, storing it in *out when it is.
func IsGitHubAuthError(err error, out **GitHubAuthError) bool {
	return errors.As(err, out)
}

type gitHubTokenKey struct{}

// ContextWithGitHubToken returns a context whose remote git operations
// authenticate to github.com with token. An empty token leaves ctx unchanged.
func ContextWithGitHubToken(ctx context.Context, token string) context.Context {
	if token == "" {
		return ctx
	}
	return context.WithValue(ctx, gitHubTokenKey{}, token)
}

func gitHubTokenFrom(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	tok, _ := ctx.Value(gitHubTokenKey{}).(string)
	return tok
}

// applyGitHubToken appends token auth to a git subprocess environment: GH_TOKEN
// for gh-based credential helpers, plus an env-scoped insteadOf rewrite so
// plain https://github.com/ URLs carry the token. The rewrite is added at the
// next GIT_CONFIG_* index so env-scoped config set by gitEnv is preserved.
// A later duplicate key wins in os/exec, so the bumped GIT_CONFIG_COUNT applies.
func applyGitHubToken(env []string, token string) []string {
	if token == "" {
		return env
	}
	count := 0
	for _, e := range env {
		if strings.HasPrefix(e, "GIT_CONFIG_COUNT=") {
			if n, err := strconv.Atoi(strings.TrimPrefix(e, "GIT_CONFIG_COUNT=")); err == nil {
				count = n
			}
		}
	}
	idx := strconv.Itoa(count)
	return append(env,
		"GH_TOKEN="+token,
		"GITHUB_TOKEN="+token,
		"GH_PROMPT_DISABLED=1",
		"GH_NO_UPDATE_NOTIFIER=1",
		"GIT_CONFIG_COUNT="+strconv.Itoa(count+1),
		"GIT_CONFIG_KEY_"+idx+"=url.https://"+token+"@github.com/.insteadOf",
		"GIT_CONFIG_VALUE_"+idx+"=https://github.com/",
	)
}

// SetToken sets the daemon-level GitHub token used by remote git operations
// that don't carry their own per-task token.
func (c *Cache) SetToken(token string) {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()
	c.token = token
}

func (c *Cache) getToken() string {
	c.tokenMu.RLock()
	defer c.tokenMu.RUnlock()
	return c.token
}

// withCacheToken attaches the daemon-level token unless ctx already carries a
// per-task token, which takes priority.
func (c *Cache) withCacheToken(ctx context.Context) context.Context {
	if gitHubTokenFrom(ctx) != "" {
		return ctx
	}
	return ContextWithGitHubToken(ctx, c.getToken())
}

// CreateWorktreeWithToken is CreateWorktree using token for this checkout's
// remote operations instead of the daemon-level token.
func (c *Cache) CreateWorktreeWithToken(params WorktreeParams, token string) (*WorktreeResult, error) {
	return c.CreateWorktreeContext(ContextWithGitHubToken(context.Background(), token), params)
}
