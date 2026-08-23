package slack

import (
	"fmt"
	"strings"

	"github.com/multica-ai/multica/server/internal/util"
)

// Block Kit rendering for the Slack surface.
//
// This lives in the slack package rather than next to the handlers because two
// packages render issue cards: internal/handler for command replies, and the
// outbound notification listener in cmd/server. One renderer means a card looks
// identical however it was triggered.

// IssueView is the flattened, display-ready shape of an issue. Handlers
// resolve the joins (assignee name, project name, workspace slug) once and
// hand the result here.
type IssueView struct {
	Identifier  string // "ISS-42"
	Title       string
	Description string
	Status      string // raw DB value
	Priority    string // raw DB value
	Assignee    string // display name, "" when unassigned
	IsAgent     bool   // assignee is an agent rather than a member
	Project     string // display name, "" when none
	URL         string // absolute link into Agenthost, "" when app URL unset
}

// statusEmoji maps a status onto a glyph so a card is scannable without
// reading the label. Keep the keys in step with util.StatusLabels.
var statusEmoji = map[string]string{
	"backlog":     "📋",
	"todo":        "⚪",
	"in_progress": "🔵",
	"in_review":   "🟡",
	"done":        "🟢",
	"blocked":     "🔴",
	"cancelled":   "⚫",
}

var priorityEmoji = map[string]string{
	"urgent": "🔥",
	"high":   "🔺",
	"medium": "🔸",
	"low":    "🔽",
	"none":   "",
}

// IssueStatusLabel and IssuePriorityLabel reuse the shared label
// maps so Slack cards and inbox notifications always say the same thing.
func IssueStatusLabel(status string) string { return util.StatusLabel(status) }

func IssuePriorityLabel(priority string) string { return util.PriorityLabel(priority) }

// IssueCardBlocks renders an issue as Block Kit. headline is the context
// line above the card ("New issue created", "Status changed", …); pass "" to
// omit it. When actions is true the card carries the standard button row.
func IssueCardBlocks(v IssueView, headline string, actions bool) []map[string]any {
	blocks := make([]map[string]any, 0, 5)

	if headline != "" {
		blocks = append(blocks, map[string]any{
			"type": "context",
			"elements": []map[string]any{
				{"type": "mrkdwn", "text": headline},
			},
		})
	}

	title := v.Title
	if v.URL != "" {
		title = fmt.Sprintf("<%s|%s>", v.URL, Escape(v.Title))
	} else {
		title = Escape(title)
	}
	blocks = append(blocks, map[string]any{
		"type": "section",
		"text": map[string]any{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s* %s", Escape(v.Identifier), title),
		},
	})

	if desc := strings.TrimSpace(v.Description); desc != "" {
		blocks = append(blocks, map[string]any{
			"type": "section",
			"text": map[string]any{
				"type": "mrkdwn",
				"text": Truncate(Escape(desc), 500),
			},
		})
	}

	blocks = append(blocks, map[string]any{
		"type":     "context",
		"elements": issueMetaElements(v),
	})

	if actions {
		blocks = append(blocks, issueActionBlock(v))
	}
	return blocks
}

// issueMetaElements builds the status/priority/assignee/project context row.
func issueMetaElements(v IssueView) []map[string]any {
	elements := []map[string]any{
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("%s *%s*", statusEmoji[v.Status], IssueStatusLabel(v.Status)),
		},
	}
	if v.Priority != "" && v.Priority != "none" {
		elements = append(elements, map[string]any{
			"type": "mrkdwn",
			"text": fmt.Sprintf("%s %s", priorityEmoji[v.Priority], IssuePriorityLabel(v.Priority)),
		})
	}
	if v.Assignee != "" {
		icon := "👤"
		if v.IsAgent {
			icon = "🤖"
		}
		elements = append(elements, map[string]any{
			"type": "mrkdwn",
			"text": fmt.Sprintf("%s %s", icon, Escape(v.Assignee)),
		})
	} else {
		elements = append(elements, map[string]any{"type": "mrkdwn", "text": "👤 Unassigned"})
	}
	if v.Project != "" {
		elements = append(elements, map[string]any{
			"type": "mrkdwn",
			"text": "📁 " + Escape(v.Project),
		})
	}
	return elements
}

// Action ids for the issue card buttons. The card encodes the issue id in the
// button value so the interactivity handler doesn't need any side state.
const (
	ActionAssignToMe = "agenthost_issue_assign_me"
	ActionMarkDone   = "agenthost_issue_mark_done"
	ActionDispatch   = "agenthost_issue_dispatch"
)

func issueActionBlock(v IssueView) map[string]any {
	elements := []map[string]any{
		{
			"type":      "button",
			"action_id": ActionAssignToMe,
			"text":      map[string]any{"type": "plain_text", "text": "Assign to me"},
			"value":     v.Identifier,
		},
		{
			"type":      "button",
			"action_id": ActionDispatch,
			"text":      map[string]any{"type": "plain_text", "text": "Dispatch to agent"},
			"value":     v.Identifier,
		},
	}
	if v.Status != "done" {
		elements = append(elements, map[string]any{
			"type":      "button",
			"action_id": ActionMarkDone,
			"style":     "primary",
			"text":      map[string]any{"type": "plain_text", "text": "Mark done"},
			"value":     v.Identifier,
		})
	}
	return map[string]any{
		"type":     "actions",
		"block_id": "agenthost_issue_actions",
		"elements": elements,
	}
}

// IssueFallbackText is the notification/preview string Slack shows where
// blocks can't render (push notifications, the channel list). Slack warns when
// a blocks-only message omits it.
func IssueFallbackText(v IssueView, headline string) string {
	if headline != "" {
		return fmt.Sprintf("%s: %s %s", stripMarkup(headline), v.Identifier, v.Title)
	}
	return fmt.Sprintf("%s %s", v.Identifier, v.Title)
}

// Escape escapes the three characters Slack treats as markup control
// characters inside text. Slack expects these escaped and nothing else — over
// escaping (quotes, apostrophes) shows up literally in the client.
func Escape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return r.Replace(s)
}

// stripMarkup removes mrkdwn emphasis for use in plain-text fallbacks.
func stripMarkup(s string) string {
	return strings.NewReplacer("*", "", "_", "", "`", "").Replace(s)
}

// Truncate cuts a string to max runes, appending an ellipsis. Counting
// runes rather than bytes keeps multi-byte text from being cut mid-character.
func Truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "…"
}
