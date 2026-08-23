package slack

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ErrTriggerExpired means Slack rejected the trigger_id. Trigger ids are valid
// for ~3 seconds after the interaction that produced them, so this is what a
// slow command handler looks like from the outside.
var ErrTriggerExpired = errors.New("slack: trigger_id expired or invalid")

// OpenModal opens a modal via views.open.
//
// view is the raw Block Kit view payload (type "modal", with title/blocks/
// submit and optional private_metadata + callback_id). trigger_id comes from
// the slash command or interaction that started the flow and must be used
// within about three seconds.
func OpenModal(ctx context.Context, token, triggerID string, view map[string]any) error {
	body := map[string]any{
		"trigger_id": triggerID,
		"view":       view,
	}
	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := postJSON(ctx, token, "views.open", body, &result); err != nil {
		return err
	}
	if !result.OK {
		switch result.Error {
		case "expired_trigger_id", "invalid_trigger_id", "trigger_exchanged":
			return ErrTriggerExpired
		default:
			return fmt.Errorf("slack: views.open: %s", result.Error)
		}
	}
	return nil
}

// OpenDM resolves (or creates) the 1:1 DM channel with a user via
// conversations.open and returns its channel id. Needed because chat.postMessage
// to a user id works, but only after the IM channel exists.
func OpenDM(ctx context.Context, token, slackUserID string) (string, error) {
	body := map[string]any{"users": slackUserID}
	var result struct {
		OK      bool   `json:"ok"`
		Error   string `json:"error"`
		Channel struct {
			ID string `json:"id"`
		} `json:"channel"`
	}
	if err := postJSON(ctx, token, "conversations.open", body, &result); err != nil {
		return "", err
	}
	if !result.OK {
		return "", fmt.Errorf("slack: conversations.open: %s", result.Error)
	}
	return result.Channel.ID, nil
}

// PostDM opens the DM channel with a user and posts a message into it.
// Best-effort helpers like admin approval pings use this.
func PostDM(ctx context.Context, token, slackUserID, text string, blocks []map[string]any) error {
	channelID, err := OpenDM(ctx, token, slackUserID)
	if err != nil {
		return err
	}
	_, err = PostMessage(ctx, token, channelID, text, &PostMessageOptions{Blocks: blocks})
	return err
}

// postJSON performs a JSON POST against a Slack Web API method and decodes the
// response into out. Slack always answers 200 with an `ok` field, so transport
// errors and API errors are reported separately: this returns an error only for
// transport/decoding failures, leaving `ok` handling to the caller.
func postJSON(ctx context.Context, token, method string, body any, out any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("slack: marshal %s body: %w", method, err)
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		apiBase+"/"+method, strings.NewReader(string(raw)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack: %s failed: %w", method, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("slack: decode %s response: %w", method, err)
	}
	return nil
}
