package handler

import (
	"encoding/json"
	"strings"

	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Slack modal (views) construction and submission parsing.
//
// Block ids double as field names: the submission payload is
// view.state.values[block_id][action_id], so keeping the two in sync here and
// in the parser is what makes the round trip work.

const (
	slackBlockTitle       = "title"
	slackBlockDescription = "description"
	slackBlockPriority    = "priority"
	slackBlockProject     = "project"
	slackBlockAssignee    = "assignee"
	slackBlockAgent       = "agent"

	// slackActionValue is the action_id on every input element. Slack requires
	// one but we never branch on it inside a modal, so a single constant keeps
	// the parser simple.
	slackActionValue = "value"
)

// slackModalMetadata is JSON-encoded into view.private_metadata so the
// submission handler knows where the modal came from. Slack caps this at 3000
// characters, which these few ids never approach.
type slackModalMetadata struct {
	WorkspaceID string `json:"workspace_id"`
	ChannelID   string `json:"channel_id"`
	// IssueID is set only by modals that act on an existing issue (dispatch).
	IssueID string `json:"issue_id,omitempty"`
}

func (m slackModalMetadata) encode() string {
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func decodeSlackModalMetadata(raw string) slackModalMetadata {
	var m slackModalMetadata
	_ = json.Unmarshal([]byte(raw), &m)
	return m
}

type slackNewIssueModalArgs struct {
	WorkspaceID  string
	ChannelID    string
	InitialTitle string
	Projects     []db.Project
	Members      []db.ListMembersWithUserRow
}

// slackNewIssueModal builds the `/agenthost issue new` view.
//
// Only the title is required. Optional selects are omitted entirely when the
// workspace has nothing to put in them: Slack rejects a static_select with an
// empty options array, so a workspace with no projects would otherwise get a
// modal that fails to open.
func slackNewIssueModal(args slackNewIssueModalArgs) map[string]any {
	titleInput := map[string]any{
		"type":      "plain_text_input",
		"action_id": slackActionValue,
		"placeholder": map[string]any{
			"type": "plain_text",
			"text": "What needs doing?",
		},
	}
	if t := strings.TrimSpace(args.InitialTitle); t != "" {
		titleInput["initial_value"] = slackTruncate(t, 150)
	}

	blocks := []map[string]any{
		{
			"type":     "input",
			"block_id": slackBlockTitle,
			"label":    map[string]any{"type": "plain_text", "text": "Title"},
			"element":  titleInput,
		},
		{
			"type":     "input",
			"block_id": slackBlockDescription,
			"optional": true,
			"label":    map[string]any{"type": "plain_text", "text": "Description"},
			"element": map[string]any{
				"type":      "plain_text_input",
				"action_id": slackActionValue,
				"multiline": true,
			},
		},
		{
			"type":     "input",
			"block_id": slackBlockPriority,
			"optional": true,
			"label":    map[string]any{"type": "plain_text", "text": "Priority"},
			"element": map[string]any{
				"type":      "static_select",
				"action_id": slackActionValue,
				"placeholder": map[string]any{
					"type": "plain_text",
					"text": "No priority",
				},
				"options": slackPriorityOptions(),
			},
		},
	}

	if len(args.Projects) > 0 {
		blocks = append(blocks, map[string]any{
			"type":     "input",
			"block_id": slackBlockProject,
			"optional": true,
			"label":    map[string]any{"type": "plain_text", "text": "Project"},
			"element": map[string]any{
				"type":        "static_select",
				"action_id":   slackActionValue,
				"placeholder": map[string]any{"type": "plain_text", "text": "No project"},
				"options":     slackProjectOptions(args.Projects),
			},
		})
	}
	if len(args.Members) > 0 {
		blocks = append(blocks, map[string]any{
			"type":     "input",
			"block_id": slackBlockAssignee,
			"optional": true,
			"label":    map[string]any{"type": "plain_text", "text": "Assignee"},
			"element": map[string]any{
				"type":        "static_select",
				"action_id":   slackActionValue,
				"placeholder": map[string]any{"type": "plain_text", "text": "Unassigned"},
				"options":     slackMemberOptions(args.Members),
			},
		})
	}

	return map[string]any{
		"type":        "modal",
		"callback_id": slackModalNewIssue,
		"title":       map[string]any{"type": "plain_text", "text": "New issue"},
		"submit":      map[string]any{"type": "plain_text", "text": "Create"},
		"close":       map[string]any{"type": "plain_text", "text": "Cancel"},
		"private_metadata": slackModalMetadata{
			WorkspaceID: args.WorkspaceID,
			ChannelID:   args.ChannelID,
		}.encode(),
		"blocks": blocks,
	}
}

// slackDispatchModal asks which agent should pick up an issue. Only reached
// when the caller owns more than one usable agent.
func slackDispatchModal(workspaceID, channelID, issueID, identifier string, agents []db.Agent) map[string]any {
	return map[string]any{
		"type":        "modal",
		"callback_id": slackModalDispatch,
		"title":       map[string]any{"type": "plain_text", "text": "Dispatch issue"},
		"submit":      map[string]any{"type": "plain_text", "text": "Dispatch"},
		"close":       map[string]any{"type": "plain_text", "text": "Cancel"},
		"private_metadata": slackModalMetadata{
			WorkspaceID: workspaceID,
			ChannelID:   channelID,
			IssueID:     issueID,
		}.encode(),
		"blocks": []map[string]any{
			{
				"type": "section",
				"text": map[string]any{
					"type": "mrkdwn",
					"text": "Dispatching *" + slackEscape(identifier) + "*.",
				},
			},
			{
				"type":     "input",
				"block_id": slackBlockAgent,
				"label":    map[string]any{"type": "plain_text", "text": "Agent"},
				"element": map[string]any{
					"type":        "static_select",
					"action_id":   slackActionValue,
					"placeholder": map[string]any{"type": "plain_text", "text": "Pick an agent"},
					"options":     slackAgentOptions(agents),
				},
			},
		},
	}
}

// ── option builders ──────────────────────────────────────────────────────────
//
// Slack caps a static_select at 100 options and each label at 75 characters.
// Every builder truncates rather than letting Slack reject the whole view.

const (
	slackMaxOptions    = 100
	slackMaxOptionText = 75
)

func slackPriorityOptions() []map[string]any {
	// Ordered by urgency rather than map order so the menu reads top-down.
	order := []string{"urgent", "high", "medium", "low", "none"}
	options := make([]map[string]any, 0, len(order))
	for _, p := range order {
		options = append(options, slackOption(util.PriorityLabel(p), p))
	}
	return options
}

func slackProjectOptions(projects []db.Project) []map[string]any {
	options := make([]map[string]any, 0, len(projects))
	for _, p := range projects {
		if len(options) >= slackMaxOptions {
			break
		}
		options = append(options, slackOption(p.Title, uuidToString(p.ID)))
	}
	return options
}

func slackMemberOptions(members []db.ListMembersWithUserRow) []map[string]any {
	options := make([]map[string]any, 0, len(members))
	for _, m := range members {
		if len(options) >= slackMaxOptions {
			break
		}
		options = append(options, slackOption(m.UserName, uuidToString(m.UserID)))
	}
	return options
}

func slackAgentOptions(agents []db.Agent) []map[string]any {
	options := make([]map[string]any, 0, len(agents))
	for _, a := range agents {
		if len(options) >= slackMaxOptions {
			break
		}
		options = append(options, slackOption(a.Name, uuidToString(a.ID)))
	}
	return options
}

// slackOption builds one static_select option. A blank label would make Slack
// reject the view, so empty names fall back to the value.
func slackOption(label, value string) map[string]any {
	if strings.TrimSpace(label) == "" {
		label = value
	}
	return map[string]any{
		"text":  map[string]any{"type": "plain_text", "text": slackTruncate(label, slackMaxOptionText)},
		"value": value,
	}
}

// ── submission parsing ───────────────────────────────────────────────────────

// slackViewState is the decoded view.state.values map. The double nesting is
// Slack's: block_id → action_id → value.
type slackViewState map[string]map[string]slackViewValue

type slackViewValue struct {
	Type           string `json:"type"`
	Value          string `json:"value"`
	SelectedOption *struct {
		Value string `json:"value"`
	} `json:"selected_option"`
}

// field returns the text or selected-option value for a block, or "" when the
// user left it blank.
func (s slackViewState) field(blockID string) string {
	block, ok := s[blockID]
	if !ok {
		return ""
	}
	v, ok := block[slackActionValue]
	if !ok {
		return ""
	}
	if v.SelectedOption != nil {
		return v.SelectedOption.Value
	}
	return strings.TrimSpace(v.Value)
}

// slackErrorResponse builds a view_submission response that keeps the modal
// open and shows a validation message under the named block.
func slackErrorResponse(blockID, message string) map[string]any {
	return map[string]any{
		"response_action": "errors",
		"errors":          map[string]string{blockID: message},
	}
}

// slackClearResponse closes the modal on successful submission.
func slackClearResponse() map[string]any {
	return map[string]any{"response_action": "clear"}
}
