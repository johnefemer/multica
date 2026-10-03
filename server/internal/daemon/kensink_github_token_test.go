package daemon

import "testing"

// TestApplyRegisteredGitHubToken pins token delivery on registration: the
// settings PAT in a register response must become the workspace's P1 token, and
// a later response without one must clear it rather than keep serving it.
func TestApplyRegisteredGitHubToken(t *testing.T) {
	t.Parallel()

	d := newTestDaemon(t)
	d.applyRegisteredGitHubToken("ws-a", &RegisterResponse{GitHubTokens: map[string]string{"rt-1": "pat-a"}})
	if got := d.resolveGitHubToken("ws-a"); got != "pat-a" {
		t.Fatalf("after register: got %q, want pat-a", got)
	}
	if got := d.resolveGitHubToken("ws-b"); got != "" {
		t.Fatalf("other workspace must not inherit the token, got %q", got)
	}

	d.applyRegisteredGitHubToken("ws-a", &RegisterResponse{})
	if got := d.resolveGitHubToken("ws-a"); got != "" {
		t.Fatalf("after cleared register: got %q, want empty", got)
	}
}
