package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// ErrSlackEmailUnavailable is returned when the Slack profile lookup
// succeeded but the user's email isn't visible to the bot. The most common
// cause is that the workspace owner declined the `users:read.email` scope
// at install time, or that the user has hidden their email in their Slack
// profile. Caller should reply ephemerally with a /agenthost link prompt.
var ErrSlackEmailUnavailable = errors.New("slack profile email unavailable")

// ErrAutoOnboardingDisabled is returned when no Agenthost user matches the
// Slack email and the workspace has auto-onboarding turned off. Caller
// should reply ephemerally telling the user to ask an admin.
var ErrAutoOnboardingDisabled = errors.New("workspace auto-onboarding is disabled")

// ResolveSlackUser maps a Slack user (team_id, user_id) to an Agenthost user
// in the given workspace, creating the link (and optionally the user +
// membership) on first contact. This is the centerpiece of Phase 3 — it's
// what lets later phases reply to "alice@example.com" in Slack as the
// matching Agenthost member without any explicit /link command.
//
// Algorithm (matches docs/slack-integration.md § Seamless user mapping):
//  1. Existing chat_user_link → return it.
//  2. Fetch profile via Slack users.info using the workspace's bot token.
//  3. Existing Agenthost user with this email → ensure membership, link.
//  4. Else, if workspace.chat_auto_onboard → create user + membership + link.
//  5. Else → ErrAutoOnboardingDisabled.
//
// botToken must be the bot token from the integration_connection row for
// this workspace; the caller is responsible for looking it up so a missing
// connection short-circuits before we touch the network.
func (h *Handler) ResolveSlackUser(
	ctx context.Context,
	ws db.Workspace,
	teamID, slackUserID, botToken string,
) (db.User, error) {
	// (1) Existing link?
	link, err := h.Queries.GetChatUserLink(ctx, db.GetChatUserLinkParams{
		WorkspaceID:    ws.ID,
		Platform:       "slack",
		ExternalUserID: slackUserID,
	})
	if err == nil {
		return h.Queries.GetUser(ctx, link.UserID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.User{}, fmt.Errorf("lookup chat_user_link: %w", err)
	}

	// (2) Fetch Slack profile.
	profile, err := slackprovider.GetUserInfo(ctx, botToken, slackUserID)
	if err != nil {
		return db.User{}, fmt.Errorf("fetch slack profile: %w", err)
	}
	if profile.Email == "" {
		return db.User{}, ErrSlackEmailUnavailable
	}

	// (3) Existing Agenthost user with this email?
	user, err := h.Queries.GetUserByEmail(ctx, profile.Email)
	switch {
	case err == nil:
		if memberErr := h.ensureWorkspaceMembership(ctx, ws.ID, user.ID); memberErr != nil {
			return db.User{}, fmt.Errorf("ensure membership: %w", memberErr)
		}
		if linkErr := h.createSlackUserLink(ctx, ws.ID, user.ID, teamID, profile); linkErr != nil {
			return db.User{}, fmt.Errorf("create user link: %w", linkErr)
		}
		return user, nil

	case errors.Is(err, pgx.ErrNoRows):
		// Fall through to (4).

	default:
		return db.User{}, fmt.Errorf("lookup user by email: %w", err)
	}

	// (4) Auto-onboard if the workspace allows it.
	if !ws.ChatAutoOnboard {
		return db.User{}, ErrAutoOnboardingDisabled
	}

	displayName := profile.RealName
	if displayName == "" {
		displayName = profile.Name
	}
	if displayName == "" {
		displayName = profile.Email
	}

	user, err = h.Queries.CreateUser(ctx, db.CreateUserParams{
		Name:      displayName,
		Email:     profile.Email,
		AvatarUrl: pgtype.Text{String: profile.ImageURL, Valid: profile.ImageURL != ""},
	})
	if err != nil {
		return db.User{}, fmt.Errorf("auto-onboard create user: %w", err)
	}

	if memberErr := h.ensureWorkspaceMembership(ctx, ws.ID, user.ID); memberErr != nil {
		return db.User{}, fmt.Errorf("auto-onboard add member: %w", memberErr)
	}
	if linkErr := h.createSlackUserLink(ctx, ws.ID, user.ID, teamID, profile); linkErr != nil {
		return db.User{}, fmt.Errorf("auto-onboard create link: %w", linkErr)
	}

	slog.Info("slack: auto-onboarded user",
		"workspace_id", uuidToString(ws.ID),
		"slack_user_id", slackUserID,
		"agenthost_user_id", uuidToString(user.ID),
		"email", profile.Email,
	)
	return user, nil
}

// ensureWorkspaceMembership inserts a member row if one doesn't exist.
// Idempotent; pre-existing members keep their current role.
func (h *Handler) ensureWorkspaceMembership(ctx context.Context, wsID, userID pgtype.UUID) error {
	_, err := h.Queries.GetMemberByUserAndWorkspace(ctx, db.GetMemberByUserAndWorkspaceParams{
		UserID:      userID,
		WorkspaceID: wsID,
	})
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	_, err = h.Queries.CreateMember(ctx, db.CreateMemberParams{
		WorkspaceID: wsID,
		UserID:      userID,
		Role:        "member",
	})
	return err
}

// createSlackUserLink writes the chat_user_link row that short-circuits
// future identity resolutions for this Slack user in this workspace.
func (h *Handler) createSlackUserLink(
	ctx context.Context,
	wsID, userID pgtype.UUID,
	teamID string,
	profile *slackprovider.UserProfile,
) error {
	_, err := h.Queries.CreateChatUserLink(ctx, db.CreateChatUserLinkParams{
		WorkspaceID:    wsID,
		UserID:         userID,
		Platform:       "slack",
		ExternalTeamID: teamID,
		ExternalUserID: profile.ID,
		ExternalEmail:  pgtype.Text{String: profile.Email, Valid: profile.Email != ""},
		ExternalName:   pgtype.Text{String: profile.RealName, Valid: profile.RealName != ""},
	})
	return err
}
