package messaging

import (
	"reflect"
	"testing"
)

func TestParseCommand(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantRoot string
		wantSub  string
		wantArgs []string
		wantRest string
	}{
		{
			name:     "empty input",
			input:    "",
			wantRoot: "",
			wantArgs: []string{},
			wantRest: "",
		},
		{
			name:     "bare root",
			input:    "help",
			wantRoot: "help",
			wantArgs: []string{},
			wantRest: "",
		},
		{
			name:     "root is lowercased",
			input:    "HELP",
			wantRoot: "help",
			wantArgs: []string{},
			wantRest: "",
		},
		{
			name:     "issue takes a subcommand",
			input:    "issue assign ISS-12 @me",
			wantRoot: "issue",
			wantSub:  "assign",
			wantArgs: []string{"ISS-12", "@me"},
			wantRest: "ISS-12 @me",
		},
		{
			name:     "subcommand is lowercased",
			input:    "issue STATUS ISS-12 done",
			wantRoot: "issue",
			wantSub:  "status",
			wantArgs: []string{"ISS-12", "done"},
			wantRest: "ISS-12 done",
		},
		{
			// The bug this guards: `chat` must not treat "fix" as a subcommand.
			name:     "non-subcommand root keeps every token as an argument",
			input:    "chat fix the login bug",
			wantRoot: "chat",
			wantSub:  "",
			wantArgs: []string{"fix", "the", "login", "bug"},
			wantRest: "fix the login bug",
		},
		{
			name:     "dispatch keeps id and agent name as arguments",
			input:    "dispatch ISS-12 Python Agent",
			wantRoot: "dispatch",
			wantSub:  "",
			wantArgs: []string{"ISS-12", "Python", "Agent"},
			wantRest: "ISS-12 Python Agent",
		},
		{
			name:     "agents request takes a subcommand",
			input:    "agents request Python-Agent",
			wantRoot: "agents",
			wantSub:  "request",
			wantArgs: []string{"Python-Agent"},
			wantRest: "Python-Agent",
		},
		{
			name:     "surrounding whitespace is trimmed",
			input:    "   issue   show   ISS-7   ",
			wantRoot: "issue",
			wantSub:  "show",
			wantArgs: []string{"ISS-7"},
			wantRest: "ISS-7",
		},
		{
			// Remainder must survive newlines so multi-line chat messages and
			// issue descriptions aren't flattened.
			name:     "remainder preserves newlines",
			input:    "chat line one\nline two",
			wantRoot: "chat",
			wantArgs: []string{"line", "one", "line", "two"},
			wantRest: "line one\nline two",
		},
		{
			name:     "subcommand root with no subcommand",
			input:    "issue",
			wantRoot: "issue",
			wantSub:  "",
			wantArgs: []string{},
			wantRest: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseCommand(tt.input)
			if got.Root != tt.wantRoot {
				t.Errorf("Root = %q, want %q", got.Root, tt.wantRoot)
			}
			if got.Sub != tt.wantSub {
				t.Errorf("Sub = %q, want %q", got.Sub, tt.wantSub)
			}
			if len(got.Args) != len(tt.wantArgs) || (len(tt.wantArgs) > 0 && !reflect.DeepEqual(got.Args, tt.wantArgs)) {
				t.Errorf("Args = %#v, want %#v", got.Args, tt.wantArgs)
			}
			if got.Remainder != tt.wantRest {
				t.Errorf("Remainder = %q, want %q", got.Remainder, tt.wantRest)
			}
		})
	}
}

func TestCommandArg(t *testing.T) {
	c := ParseCommand("issue assign ISS-12 @me")
	if got := c.Arg(0); got != "ISS-12" {
		t.Errorf("Arg(0) = %q, want ISS-12", got)
	}
	if got := c.Arg(1); got != "@me" {
		t.Errorf("Arg(1) = %q, want @me", got)
	}
	if got := c.Arg(9); got != "" {
		t.Errorf("Arg(9) = %q, want empty", got)
	}
	if got := c.Arg(-1); got != "" {
		t.Errorf("Arg(-1) = %q, want empty", got)
	}
}

func TestCommandArgsFrom(t *testing.T) {
	c := ParseCommand("dispatch ISS-12 Python Agent v2")
	if got := c.ArgsFrom(1); got != "Python Agent v2" {
		t.Errorf("ArgsFrom(1) = %q, want %q", got, "Python Agent v2")
	}
	if got := c.ArgsFrom(0); got != "ISS-12 Python Agent v2" {
		t.Errorf("ArgsFrom(0) = %q", got)
	}
	if got := c.ArgsFrom(99); got != "" {
		t.Errorf("ArgsFrom(99) = %q, want empty", got)
	}
}
