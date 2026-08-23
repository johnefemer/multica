package util

// Human-readable labels for issue status and priority.
//
// These live here rather than next to either consumer because two packages
// render them: the inbox notification listeners in cmd/server and the Slack
// Block Kit cards in internal/handler. Keeping one copy is what stops a new
// status showing up as "in_review" in one surface and "In Review" in the other.

// StatusLabels maps DB status values to display labels.
var StatusLabels = map[string]string{
	"backlog":     "Backlog",
	"todo":        "Todo",
	"in_progress": "In Progress",
	"in_review":   "In Review",
	"done":        "Done",
	"blocked":     "Blocked",
	"cancelled":   "Cancelled",
}

// PriorityLabels maps DB priority values to display labels.
var PriorityLabels = map[string]string{
	"urgent": "Urgent",
	"high":   "High",
	"medium": "Medium",
	"low":    "Low",
	"none":   "No priority",
}

// StatusLabel returns the display label for a status, falling back to the raw
// value so an unrecognized status renders as something rather than blank.
func StatusLabel(s string) string {
	if l, ok := StatusLabels[s]; ok {
		return l
	}
	return s
}

// PriorityLabel returns the display label for a priority, falling back to the
// raw value.
func PriorityLabel(p string) string {
	if l, ok := PriorityLabels[p]; ok {
		return l
	}
	return p
}
