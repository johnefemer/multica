// Package messaging holds the platform-neutral chat surface shared by Slack
// (today) and Discord/Teams (later). Parsing and serialization stay in the
// per-platform subpackages; everything here is transport-agnostic.
package messaging

import "strings"

// Command is a parsed slash-command invocation.
//
// The grammar is deliberately tiny: `<root> [sub] [args…]`. Only roots listed
// in subcommandRoots consume a second token as a subcommand, so
// `chat fix the login bug` keeps "fix" as the first argument rather than
// mistaking it for a subcommand.
type Command struct {
	// Root is the first token, lowercased (e.g. "issue", "dispatch", "help").
	Root string
	// Sub is the second token, lowercased, for roots that take subcommands
	// (e.g. "new" in `issue new`). Empty otherwise.
	Sub string
	// Args are the whitespace-separated tokens after Root and Sub.
	Args []string
	// Remainder is everything after Root and Sub with original spacing and
	// newlines preserved. Use this for free-text payloads (chat messages,
	// issue titles) where collapsing whitespace would be wrong.
	Remainder string
	// Raw is the whole trimmed input, useful for logging and error messages.
	Raw string
}

// subcommandRoots are the roots whose second token is a verb rather than an
// argument. Everything else treats all trailing tokens as arguments.
var subcommandRoots = map[string]bool{
	"issue":  true,
	"issues": true,
	"agent":  true,
	"agents": true,
}

// ParseCommand splits raw slash-command text into a Command. It never fails:
// unparseable input yields an empty Root, which callers surface as help.
func ParseCommand(text string) Command {
	raw := strings.TrimSpace(text)
	cmd := Command{Raw: raw}

	root, rest := nextToken(raw)
	cmd.Root = strings.ToLower(root)

	if subcommandRoots[cmd.Root] {
		sub, afterSub := nextToken(rest)
		cmd.Sub = strings.ToLower(sub)
		rest = afterSub
	}

	cmd.Remainder = rest
	cmd.Args = strings.Fields(rest)
	return cmd
}

// Arg returns the i-th argument or "" when out of range, so callers can read
// optional positions without bounds checks.
func (c Command) Arg(i int) string {
	if i < 0 || i >= len(c.Args) {
		return ""
	}
	return c.Args[i]
}

// ArgsFrom returns the arguments from index i onward joined by single spaces.
// Used for trailing free-text that follows a fixed argument, such as the agent
// name in `dispatch ISS-12 Python Agent`.
func (c Command) ArgsFrom(i int) string {
	if i < 0 || i >= len(c.Args) {
		return ""
	}
	return strings.Join(c.Args[i:], " ")
}

// nextToken splits off the first whitespace-delimited token and returns it
// along with the remainder, left-trimmed but otherwise byte-identical to the
// input. Splitting by hand rather than with strings.Fields is what lets
// Remainder keep newlines in multi-line chat messages.
func nextToken(s string) (token, rest string) {
	s = strings.TrimLeft(s, " \t\r\n")
	if s == "" {
		return "", ""
	}
	idx := strings.IndexAny(s, " \t\r\n")
	if idx < 0 {
		return s, ""
	}
	return s[:idx], strings.TrimLeft(s[idx:], " \t\r\n")
}
