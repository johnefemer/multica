package handler

import (
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
)

// Local aliases for the Block Kit renderer, which lives in the slack package
// so the outbound notification listener in cmd/server can share it. Aliasing
// rather than re-implementing keeps the handler call sites terse while leaving
// exactly one renderer.

type slackIssueView = slackprovider.IssueView

var (
	slackIssueCardBlocks   = slackprovider.IssueCardBlocks
	slackIssueFallbackText = slackprovider.IssueFallbackText
	slackIssueStatusLabel  = slackprovider.IssueStatusLabel
	slackEscape            = slackprovider.Escape
	slackTruncate          = slackprovider.Truncate
)

const (
	slackActionAssignToMe = slackprovider.ActionAssignToMe
	slackActionMarkDone   = slackprovider.ActionMarkDone
	slackActionDispatch   = slackprovider.ActionDispatch
)
