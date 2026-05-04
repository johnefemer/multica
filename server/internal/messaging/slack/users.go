package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// UserProfile is the slim shape of a Slack user we care about for identity
// resolution. Email is the load-bearing field — the bot must have been
// installed with `users:read.email` for this to be populated.
type UserProfile struct {
	ID       string // Slack user id (U0123...)
	TeamID   string // Slack team id (T0123...)
	Email    string // primary email; may be empty if scope absent
	Name     string // username (no spaces)
	RealName string // display name
	ImageURL string // 192px avatar
}

// GetUserInfo fetches a Slack user's profile via users.info using the bot
// token. Returns an error if Slack reports `ok:false` or the network call
// fails. The caller must defend against an empty Email separately —
// Slack omits it silently when the bot lacks `users:read.email`.
func GetUserInfo(ctx context.Context, token, slackUserID string) (*UserProfile, error) {
	v := url.Values{}
	v.Set("user", slackUserID)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		apiBase+"/users.info?"+v.Encode(), nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("slack: users.info failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		User  struct {
			ID       string `json:"id"`
			TeamID   string `json:"team_id"`
			Name     string `json:"name"`
			RealName string `json:"real_name"`
			Profile  struct {
				Email    string `json:"email"`
				RealName string `json:"real_name"`
				Image192 string `json:"image_192"`
				Image72  string `json:"image_72"`
			} `json:"profile"`
		} `json:"user"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("slack: decode users.info: %w", err)
	}
	if !result.OK {
		return nil, fmt.Errorf("slack: users.info: %s", result.Error)
	}

	avatar := result.User.Profile.Image192
	if avatar == "" {
		avatar = result.User.Profile.Image72
	}
	realName := result.User.RealName
	if realName == "" {
		realName = result.User.Profile.RealName
	}

	return &UserProfile{
		ID:       result.User.ID,
		TeamID:   result.User.TeamID,
		Email:    result.User.Profile.Email,
		Name:     result.User.Name,
		RealName: realName,
		ImageURL: avatar,
	}, nil
}
