package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// PostMessageOptions controls a chat.postMessage call.
type PostMessageOptions struct {
	// ThreadTS, when set, makes this a threaded reply.
	ThreadTS string
	// Blocks, when non-empty, supersedes plain Text in Slack clients that
	// support Block Kit. Pass nil for plain-text posts.
	Blocks []map[string]any
}

// PostMessageResult is the slim shape we care about from chat.postMessage.
// `ts` is the message timestamp — usable as a thread_ts on follow-up replies
// or stored on chat_message.external_message_id once Phase 4 lands.
type PostMessageResult struct {
	Channel string `json:"channel"`
	TS      string `json:"ts"`
}

// PostMessageInThread is a thin wrapper around PostMessage that always sets
// thread_ts so the post lands as a threaded reply.
func PostMessageInThread(ctx context.Context, token, channelID, threadTS, text string) error {
	_, err := PostMessage(ctx, token, channelID, text, &PostMessageOptions{ThreadTS: threadTS})
	return err
}

// PostEphemeral sends a message visible only to one user via chat.postEphemeral.
// Used for the agent picker and friendly error feedback in bound channels.
func PostEphemeral(ctx context.Context, token, channelID, slackUserID, text string, blocks []map[string]any) error {
	body := map[string]any{
		"channel": channelID,
		"user":    slackUserID,
		"text":    text,
	}
	if len(blocks) > 0 {
		body["blocks"] = blocks
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("slack: marshal postEphemeral body: %w", err)
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		apiBase+"/chat.postEphemeral", strings.NewReader(string(raw)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack: chat.postEphemeral failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("slack: decode postEphemeral response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("slack: chat.postEphemeral: %s", result.Error)
	}
	return nil
}

// PostMessage sends a message to a channel via chat.postMessage.
//
// Requires the bot token to have `chat:write` (granted by default install).
// For private channels the bot must be a member.
func PostMessage(ctx context.Context, token, channelID, text string, opts *PostMessageOptions) (*PostMessageResult, error) {
	body := map[string]any{
		"channel": channelID,
		"text":    text,
	}
	if opts != nil {
		if opts.ThreadTS != "" {
			body["thread_ts"] = opts.ThreadTS
		}
		if len(opts.Blocks) > 0 {
			body["blocks"] = opts.Blocks
		}
	}

	raw, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("slack: marshal postMessage body: %w", err)
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		apiBase+"/chat.postMessage", strings.NewReader(string(raw)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack: chat.postMessage failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result struct {
		OK      bool   `json:"ok"`
		Error   string `json:"error"`
		Channel string `json:"channel"`
		TS      string `json:"ts"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("slack: decode postMessage response: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack: chat.postMessage: %s", result.Error)
	}
	return &PostMessageResult{Channel: result.Channel, TS: result.TS}, nil
}
