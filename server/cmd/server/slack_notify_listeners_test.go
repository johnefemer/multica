package main

import (
	"testing"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/handler"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

func TestSlackIssueIDFromEvent(t *testing.T) {
	const issueID = "3f1a7c2e-0b1d-4c3a-9f2e-5a6b7c8d9e0f"

	t.Run("issue event carries a struct payload", func(t *testing.T) {
		// This is the shape handler.publish actually sends: a map whose
		// "issue" value is an IssueResponse struct, not a nested map. A plain
		// type assertion to map[string]any misses it, which is why the
		// extractor goes through JSON.
		e := events.Event{
			Type:        protocol.EventIssueCreated,
			WorkspaceID: "ws",
			Payload:     map[string]any{"issue": handler.IssueResponse{ID: issueID, Title: "Fix login"}},
		}
		got, ok := slackIssueIDFromEvent(e)
		if !ok || got != issueID {
			t.Fatalf("got (%q, %v), want (%q, true)", got, ok, issueID)
		}
	})

	t.Run("task event carries a flat map", func(t *testing.T) {
		e := events.Event{
			Type:        protocol.EventTaskCompleted,
			WorkspaceID: "ws",
			Payload: map[string]any{
				"task_id":  "t1",
				"agent_id": "a1",
				"issue_id": issueID,
				"status":   "completed",
			},
		}
		got, ok := slackIssueIDFromEvent(e)
		if !ok || got != issueID {
			t.Fatalf("got (%q, %v), want (%q, true)", got, ok, issueID)
		}
	})

	t.Run("chat task has no issue and is skipped", func(t *testing.T) {
		// ResolveTaskWorkspaceID marshals an invalid UUID to "", so a chat
		// task looks like an empty issue_id rather than a missing key.
		e := events.Event{
			Type:        protocol.EventTaskCompleted,
			WorkspaceID: "ws",
			Payload: map[string]any{
				"task_id":         "t1",
				"issue_id":        "",
				"chat_session_id": "c1",
			},
		}
		if got, ok := slackIssueIDFromEvent(e); ok {
			t.Fatalf("got (%q, true), want skip", got)
		}
	})

	t.Run("nested issue map also works", func(t *testing.T) {
		// Payloads that made a JSON round trip through the realtime layer
		// arrive with a genuine nested map.
		e := events.Event{
			Payload: map[string]any{"issue": map[string]any{"id": issueID}},
		}
		got, ok := slackIssueIDFromEvent(e)
		if !ok || got != issueID {
			t.Fatalf("got (%q, %v), want (%q, true)", got, ok, issueID)
		}
	})

	t.Run("unrelated payload is skipped", func(t *testing.T) {
		if _, ok := slackIssueIDFromEvent(events.Event{Payload: map[string]any{"foo": "bar"}}); ok {
			t.Fatal("expected skip for unrelated payload")
		}
		if _, ok := slackIssueIDFromEvent(events.Event{Payload: nil}); ok {
			t.Fatal("expected skip for nil payload")
		}
		// A payload that can't marshal must be skipped, not panic.
		if _, ok := slackIssueIDFromEvent(events.Event{Payload: make(chan int)}); ok {
			t.Fatal("expected skip for unmarshalable payload")
		}
	})
}

func TestSlackNotifyHeadline(t *testing.T) {
	tests := []struct {
		eventType string
		actorType string
		want      string
	}{
		{protocol.EventIssueCreated, "member", "🆕 New issue"},
		{protocol.EventIssueCreated, "agent", "🆕 New issue by an agent"},
		{protocol.EventIssueUpdated, "member", "✏️ Issue updated"},
		{protocol.EventTaskCompleted, "system", "✅ Agent finished a task"},
		{protocol.EventTaskFailed, "system", "⚠️ Agent task failed"},
		{"issue:deleted", "member", ""},
	}
	for _, tt := range tests {
		got := slackNotifyHeadline(tt.eventType, events.Event{ActorType: tt.actorType})
		if got != tt.want {
			t.Errorf("slackNotifyHeadline(%q, %q) = %q, want %q",
				tt.eventType, tt.actorType, got, tt.want)
		}
	}
}

func TestSlackNotifyEventsAreSubscribable(t *testing.T) {
	// Every advertised filter value must be a real protocol event, otherwise a
	// channel could subscribe to something the bus never publishes.
	known := map[string]bool{
		protocol.EventIssueCreated:  true,
		protocol.EventIssueUpdated:  true,
		protocol.EventTaskCompleted: true,
		protocol.EventTaskFailed:    true,
	}
	for _, e := range slackNotifyEvents {
		if !known[e] {
			t.Errorf("slackNotifyEvents contains unknown event %q", e)
		}
	}
	if len(slackNotifyEvents) != len(known) {
		t.Errorf("slackNotifyEvents has %d entries, want %d", len(slackNotifyEvents), len(known))
	}
}
