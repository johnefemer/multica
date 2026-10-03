package daemon

// Kensink fork: GitHub token delivery on runtime registration.

// applyRegisteredGitHubToken caches the settings PAT the server returned for
// workspaceID's runtimes and pushes it to the repo cache. Every registration
// path calls it (startup / refresh and CLI discovery), so a token saved in
// runtime settings reaches agents no matter which path registered the runtime.
func (d *Daemon) applyRegisteredGitHubToken(workspaceID string, resp *RegisterResponse) {
	// Extract the P1 token for *this* workspace. Runtimes within one
	// workspace share a token pool, so the first non-empty one stands for the
	// workspace; runtimes in other workspaces are registered by their own call
	// and must not be reached by this one's credential.
	var settingsTok string
	for _, tok := range resp.GitHubTokens {
		if tok != "" {
			settingsTok = tok
			break
		}
	}
	d.tokenMu.Lock()
	if d.ghTokenSettings == nil {
		d.ghTokenSettings = map[string]string{}
	}
	if settingsTok != "" {
		d.ghTokenSettings[workspaceID] = settingsTok
	} else {
		// Re-registration after the PAT was cleared upstream must drop the
		// stale entry, not keep serving the old credential.
		delete(d.ghTokenSettings, workspaceID)
	}
	d.tokenMu.Unlock()

	// Push this workspace's token to the repo cache, plus the machine-wide
	// fallback that covers workspaces with none of their own.
	if tc, ok := d.repoCache.(interface {
		SetWorkspaceToken(string, string)
		SetDefaultToken(string)
	}); ok {
		tc.SetWorkspaceToken(workspaceID, settingsTok)
		tc.SetDefaultToken(d.machineGitHubToken())
	}
}
