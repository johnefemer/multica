package handler

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestParseSlackIssueRef(t *testing.T) {
	tests := []struct {
		input string
		want  int32
		ok    bool
	}{
		{"ISS-12", 12, true},
		{"iss-12", 12, true},
		{"MUL-1138", 1138, true},
		{"#42", 42, true},
		{"42", 42, true},
		{"  ISS-7  ", 7, true},
		// A mistyped prefix still resolves: inside a bound channel there is
		// exactly one workspace, so the number alone is unambiguous.
		{"WRONG-3", 3, true},
		{"", 0, false},
		{"ISS-", 0, false},
		{"ISS-0", 0, false},
		{"abc", 0, false},
		{"12abc", 0, false},
		{"ISS-12-3", 0, false},
		{"-5", 0, false},
	}
	for _, tt := range tests {
		got, ok := parseSlackIssueRef(tt.input)
		if ok != tt.ok || got != tt.want {
			t.Errorf("parseSlackIssueRef(%q) = (%d, %v), want (%d, %v)",
				tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestNormalizeIssueStatus(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{"done", "done", true},
		{"Done", "done", true},
		{"DONE", "done", true},
		{"closed", "done", true},
		{"in progress", "in_progress", true},
		{"in-progress", "in_progress", true},
		{"in_progress", "in_progress", true},
		{"InProgress", "in_progress", true},
		{"doing", "in_progress", true},
		{"in review", "in_review", true},
		{"review", "in_review", true},
		{"todo", "todo", true},
		{"to-do", "todo", true},
		{"backlog", "backlog", true},
		{"blocked", "blocked", true},
		{"cancelled", "cancelled", true},
		{"canceled", "cancelled", true},
		{"  done  ", "done", true},
		{"finished", "", false},
		{"", "", false},
	}
	for _, tt := range tests {
		got, ok := normalizeIssueStatus(tt.input)
		if ok != tt.ok || got != tt.want {
			t.Errorf("normalizeIssueStatus(%q) = (%q, %v), want (%q, %v)",
				tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestParseSlackUserMention(t *testing.T) {
	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{"<@U08ABC123>", "U08ABC123", true},
		{"<@U08ABC123|jane>", "U08ABC123", true},
		{"<@W01234567|jane.doe>", "W01234567", true},
		{"@jane", "", false},
		{"jane", "", false},
		{"<#C08ABC|general>", "", false},
		{"", "", false},
	}
	for _, tt := range tests {
		got, ok := parseSlackUserMention(tt.input)
		if ok != tt.ok || got != tt.want {
			t.Errorf("parseSlackUserMention(%q) = (%q, %v), want (%q, %v)",
				tt.input, got, ok, tt.want, tt.ok)
		}
	}
}

func TestSlackMatchAgentByName(t *testing.T) {
	agents := []db.Agent{
		{Name: "Python Agent"},
		{Name: "Python Agent v2"},
		{Name: "Docs Bot"},
	}

	t.Run("exact match wins over prefix ambiguity", func(t *testing.T) {
		// "Python Agent" is a substring of "Python Agent v2"; the exact match
		// must resolve rather than reporting the pair as ambiguous.
		got, errResp := slackMatchAgentByName(agents, "Python Agent")
		if errResp != nil {
			t.Fatalf("unexpected error response: %v", errResp)
		}
		if got.Name != "Python Agent" {
			t.Errorf("got %q, want %q", got.Name, "Python Agent")
		}
	})

	t.Run("exact match is case-insensitive", func(t *testing.T) {
		got, errResp := slackMatchAgentByName(agents, "docs bot")
		if errResp != nil {
			t.Fatalf("unexpected error response: %v", errResp)
		}
		if got.Name != "Docs Bot" {
			t.Errorf("got %q, want %q", got.Name, "Docs Bot")
		}
	})

	t.Run("unique partial match resolves", func(t *testing.T) {
		got, errResp := slackMatchAgentByName(agents, "docs")
		if errResp != nil {
			t.Fatalf("unexpected error response: %v", errResp)
		}
		if got.Name != "Docs Bot" {
			t.Errorf("got %q, want %q", got.Name, "Docs Bot")
		}
	})

	t.Run("ambiguous partial match is reported", func(t *testing.T) {
		_, errResp := slackMatchAgentByName(agents, "python")
		if errResp == nil {
			t.Fatal("expected an ambiguity error response")
		}
		if text, _ := errResp["text"].(string); text == "" {
			t.Error("ambiguity response carried no text")
		}
	})

	t.Run("no match is reported", func(t *testing.T) {
		_, errResp := slackMatchAgentByName(agents, "nope")
		if errResp == nil {
			t.Fatal("expected a not-found error response")
		}
	})
}

func TestSlackAgentLine(t *testing.T) {
	owner := pgtype.UUID{Bytes: [16]byte{1}, Valid: true}
	ownerID := uuidToString(owner)
	runtime := pgtype.UUID{Bytes: [16]byte{9}, Valid: true}

	t.Run("private agent owned by caller", func(t *testing.T) {
		line := slackAgentLine(db.Agent{
			Name: "Mine", Visibility: "private", OwnerID: owner, RuntimeID: runtime,
		}, ownerID, false)
		if want := "• *Mine* — _private, yours_"; line != want {
			t.Errorf("got %q, want %q", line, want)
		}
	})

	t.Run("private agent owned by someone else", func(t *testing.T) {
		line := slackAgentLine(db.Agent{
			Name: "Theirs", Visibility: "private", OwnerID: owner, RuntimeID: runtime,
		}, "00000000-0000-0000-0000-0000000000ff", false)
		if want := "• *Theirs* — _private, not yours_"; line != want {
			t.Errorf("got %q, want %q", line, want)
		}
	})

	t.Run("workspace agent with no runtime", func(t *testing.T) {
		line := slackAgentLine(db.Agent{Name: "Idle", Visibility: "workspace"}, ownerID, false)
		if want := "• *Idle* — _no runtime_"; line != want {
			t.Errorf("got %q, want %q", line, want)
		}
	})

	t.Run("plain workspace agent has no annotation", func(t *testing.T) {
		line := slackAgentLine(db.Agent{
			Name: "Shared", Visibility: "workspace", RuntimeID: runtime,
		}, ownerID, false)
		if want := "• *Shared*"; line != want {
			t.Errorf("got %q, want %q", line, want)
		}
	})
}

func TestSlackViewStateField(t *testing.T) {
	state := slackViewState{
		"title": {"value": {Type: "plain_text_input", Value: "  Fix login  "}},
		"priority": {"value": {
			Type: "static_select",
			SelectedOption: &struct {
				Value string `json:"value"`
			}{Value: "high"},
		}},
		"empty": {"value": {Type: "plain_text_input", Value: ""}},
	}

	if got := state.field("title"); got != "Fix login" {
		t.Errorf("field(title) = %q, want %q (trimmed)", got, "Fix login")
	}
	if got := state.field("priority"); got != "high" {
		t.Errorf("field(priority) = %q, want %q", got, "high")
	}
	if got := state.field("empty"); got != "" {
		t.Errorf("field(empty) = %q, want empty", got)
	}
	if got := state.field("missing"); got != "" {
		t.Errorf("field(missing) = %q, want empty", got)
	}
}
