package execenv

import "strings"

// Kensink fork additions to the agent brief. Kept in their own file so the
// upstream section builders in runtime_config_sections.go stay close to
// upstream and future syncs conflict less.

// writeGitHubCLI emits the GitHub CLI command list when the daemon detected an
// authenticated gh CLI (or holds a resolved GitHub token) for this runtime.
func writeGitHubCLI(b *strings.Builder, ctx TaskContextForEnv) {
	if !ctx.GHAvailable {
		return
	}
	b.WriteString("### GitHub CLI (gh)\n")
	b.WriteString("The `gh` CLI is authenticated on this runtime. Use it for GitHub operations:\n")
	b.WriteString("- `multica github status` — Show GitHub authentication status for this runtime\n")
	b.WriteString("- `multica github pr create --title \"...\" --body \"...\" [--base <branch>]` — Create a pull request\n")
	b.WriteString("- `multica github run list [--limit N] [--workflow <name>]` — List recent GitHub Actions runs\n")
	b.WriteString("- `multica github run watch <run-id>` — Watch a workflow run until it completes\n")
	b.WriteString("- `multica github token status` — Show the active GitHub token source and scopes\n")
	b.WriteString("You may also call `gh` directly for operations not covered by `multica github`.\n\n")
}
