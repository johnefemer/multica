package slack

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Channel is a summary of a Slack conversation suitable for the binding picker.
type Channel struct {
	ID        string `json:"id"`         // C0123ABCD…
	Name      string `json:"name"`       // "general"
	IsPrivate bool   `json:"is_private"` // groups vs channels
	IsMember  bool   `json:"is_member"`  // can the bot post here?
}

// ListChannels fetches conversations the workspace can see with the given bot
// token. We request both public and private channels, but Slack's visibility
// rules differ per type:
//
//   - Public channels: every one in the team comes back, whether the bot has
//     joined or not. `is_member` distinguishes the two. Non-member public
//     channels are still bindable because the bot can self-join them with
//     `channels:join` (see JoinChannel).
//   - Private channels: only ones the bot has already been invited to are
//     returned at all. A bot can never self-join a private channel, so
//     `is_member` is always true for the private entries in this list.
//
// Pagination follows Slack's cursor model. We cap at ~1000 channels — beyond
// that, picker UX needs server-side search anyway (deferred).
func ListChannels(ctx context.Context, token string) ([]Channel, error) {
	const pageLimit = 200
	const maxPages = 5 // 1000 channels is the practical UI cap

	var all []Channel
	cursor := ""

	for page := 0; page < maxPages; page++ {
		v := url.Values{}
		v.Set("types", "public_channel,private_channel")
		v.Set("exclude_archived", "true")
		v.Set("limit", fmt.Sprintf("%d", pageLimit))
		if cursor != "" {
			v.Set("cursor", cursor)
		}

		req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
			apiBase+"/conversations.list?"+v.Encode(), nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("slack: conversations.list failed: %w", err)
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var result struct {
			OK               bool      `json:"ok"`
			Error            string    `json:"error"`
			Channels         []Channel `json:"channels"`
			ResponseMetadata struct {
				NextCursor string `json:"next_cursor"`
			} `json:"response_metadata"`
		}
		if err := json.Unmarshal(raw, &result); err != nil {
			return nil, fmt.Errorf("slack: decode conversations.list: %w", err)
		}
		if !result.OK {
			return nil, fmt.Errorf("slack: conversations.list: %s", result.Error)
		}

		all = append(all, result.Channels...)
		if result.ResponseMetadata.NextCursor == "" {
			break
		}
		cursor = result.ResponseMetadata.NextCursor
	}

	return all, nil
}

// Sentinel errors returned by JoinChannel / EnsureBotInChannel so callers can
// map a Slack failure onto an actionable message without string-matching.
var (
	// ErrJoinScopeMissing means the installed bot token predates the
	// `channels:join` scope. Slack never widens an existing token's scopes,
	// so the workspace has to reconnect Slack to pick it up.
	ErrJoinScopeMissing = errors.New("slack: bot token is missing the channels:join scope")

	// ErrPrivateChannelNeedsInvite means the target is a private channel the
	// bot has not been invited to. Bots cannot self-join private channels;
	// a human has to run /invite @agenthost there.
	ErrPrivateChannelNeedsInvite = errors.New("slack: bot must be invited to this private channel")

	// ErrChannelNotFound means the channel id is unknown to this token —
	// either it never existed, it was archived, or it belongs to another team.
	ErrChannelNotFound = errors.New("slack: channel not found")
)

// GetChannelInfo fetches a single conversation via conversations.info. Used
// before binding to decide whether the bot needs to join, needs an invite, or
// is already good to go.
func GetChannelInfo(ctx context.Context, token, channelID string) (*Channel, error) {
	v := url.Values{}
	v.Set("channel", channelID)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		apiBase+"/conversations.info?"+v.Encode(), nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack: conversations.info failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		OK      bool    `json:"ok"`
		Error   string  `json:"error"`
		Channel Channel `json:"channel"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("slack: decode conversations.info: %w", err)
	}
	if !result.OK {
		if result.Error == "channel_not_found" {
			return nil, ErrChannelNotFound
		}
		return nil, fmt.Errorf("slack: conversations.info: %s", result.Error)
	}
	return &result.Channel, nil
}

// JoinChannel adds the bot to a public channel via conversations.join. It is
// idempotent: joining a channel the bot is already in returns ok.
//
// Requires the `channels:join` scope. Private channels are not joinable by
// bots at all and return ErrPrivateChannelNeedsInvite.
func JoinChannel(ctx context.Context, token, channelID string) error {
	body := url.Values{}
	body.Set("channel", channelID)

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		apiBase+"/conversations.join", strings.NewReader(body.Encode()))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack: conversations.join failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return fmt.Errorf("slack: decode conversations.join: %w", err)
	}
	if result.OK {
		return nil
	}
	switch result.Error {
	case "missing_scope", "not_allowed_token_type":
		return ErrJoinScopeMissing
	case "method_not_supported_for_channel_type":
		// conversations.join only works on public channels.
		return ErrPrivateChannelNeedsInvite
	case "channel_not_found":
		return ErrChannelNotFound
	default:
		return fmt.Errorf("slack: conversations.join: %s", result.Error)
	}
}

// EnsureBotInChannel makes the bot a member of channelID, joining the channel
// when it is public and the bot is not in it yet. Returns the channel info so
// callers can persist a fresh channel name.
//
// This is what makes a channel bindable straight from the picker: without it,
// binding a public channel the bot never joined writes a valid row that then
// silently receives no events (app_mention only fires for member channels,
// and chat.postMessage returns not_in_channel).
func EnsureBotInChannel(ctx context.Context, token, channelID string) (*Channel, error) {
	info, err := GetChannelInfo(ctx, token, channelID)
	if err != nil {
		return nil, err
	}
	if info.IsMember {
		return info, nil
	}
	if info.IsPrivate {
		return info, ErrPrivateChannelNeedsInvite
	}
	if err := JoinChannel(ctx, token, channelID); err != nil {
		return info, err
	}
	info.IsMember = true
	return info, nil
}
