package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// Channel is a summary of a Slack conversation suitable for the binding picker.
type Channel struct {
	ID        string `json:"id"`         // C0123ABCD…
	Name      string `json:"name"`       // "general"
	IsPrivate bool   `json:"is_private"` // groups vs channels
	IsMember  bool   `json:"is_member"`  // can the bot post here?
}

// ListChannels fetches conversations the workspace can see with the given bot
// token. We request both public and private channels — the bot will only
// receive `is_member=true` entries for private channels it has been invited
// to, and `is_member` is informational on public channels (the bot can join
// any public channel via `conversations.join` when binding).
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
