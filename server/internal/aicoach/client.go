// Package aicoach is a client for the AI Coach skill registry (aicoach.pw).
//
// Two kinds of skill live there and they are fetched differently:
//
//   - curated skills are plain markdown at a public URL,
//   - skills published by a user are gzipped tarballs behind an authenticated
//     endpoint that also enforces payment for paid skills.
//
// The manifest endpoint reports which of the two a skill is, along with a
// revision token, so a caller can check for changes without downloading
// anything and only fetch content when the revision actually moved.
package aicoach

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// DefaultBaseURL is the public registry. Overridable for self-hosted installs.
const DefaultBaseURL = "https://aicoach.pw"

const (
	maxManifestRefs   = 100
	maxContentBytes   = 5 << 20  // matches the registry's own 5 MB bundle cap
	maxDecodedBytes   = 20 << 20 // decompression bound, so a zip bomb cannot exhaust memory
	defaultHTTPTimout = 30 * time.Second
)

// Client talks to one AI Coach registry.
type Client struct {
	BaseURL string
	// APIKey is optional. Curated skills need none; skills published by a user
	// require one, and paid skills additionally require a purchase on that key's
	// account.
	APIKey string
	HTTP   *http.Client
}

// New builds a client with sane defaults. Pass an empty baseURL for the public registry.
func New(baseURL, apiKey string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		HTTP:    &http.Client{Timeout: defaultHTTPTimout},
	}
}

// ManifestEntry is the registry's answer for one skill reference.
type ManifestEntry struct {
	Ref         string `json:"ref"`
	Publisher   string `json:"publisher"`
	Slug        string `json:"slug"`
	Found       bool   `json:"found"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Revision changes whenever the content changes. Compare against the stored
	// value to decide whether a re-pull is needed.
	Revision     string `json:"revision"`
	SHA256       string `json:"sha256"`
	Version      string `json:"version"`
	UpdatedAt    string `json:"updated_at"`
	Origin       string `json:"origin"`
	IsPaid       bool   `json:"isPaid"`
	PriceCents   int    `json:"priceCents"`
	ContentURL   string `json:"contentUrl"`
	ContentType  string `json:"contentType"` // "markdown" | "bundle"
	RequiresAuth bool   `json:"requiresAuth"`
	DetailURL    string `json:"detailUrl"`
}

type manifestResponse struct {
	Count  int             `json:"count"`
	Skills []ManifestEntry `json:"skills"`
}

// File is one file from a fetched skill.
type File struct {
	Path    string
	Content string
}

// Skill is fetched content: the SKILL.md body plus any supporting files.
type Skill struct {
	Ref         string
	Name        string
	Description string
	Content     string // SKILL.md, including frontmatter
	Files       []File // supporting files, SKILL.md excluded
	Revision    string
}

// ParseRef normalizes "publisher/slug", a bare "slug" (a curated skill), or an
// aicoach.pw skill URL into a canonical "publisher/slug".
func ParseRef(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", fmt.Errorf("empty skill reference")
	}

	if looksLikeURL(s) {
		if !strings.Contains(s, "://") {
			s = "https://" + s
		}
		u, err := url.Parse(s)
		if err != nil {
			return "", fmt.Errorf("invalid URL: %w", err)
		}
		// Only registry hosts resolve. Without this any host's /skills/ path
		// would parse, and a sync could be pointed at somebody else's server.
		if !isRegistryHost(u.Hostname()) {
			return "", fmt.Errorf("not an AI Coach skill URL: %s", raw)
		}
		parts := strings.Split(strings.Trim(u.Path, "/"), "/")
		// /skills/{slug} or /skills/{publisher}/{slug}
		if len(parts) >= 2 && parts[0] == "skills" {
			s = strings.Join(parts[1:], "/")
		} else {
			return "", fmt.Errorf("not an AI Coach skill URL: %s", raw)
		}
	}

	parts := strings.Split(strings.Trim(s, "/"), "/")
	switch len(parts) {
	case 1:
		if parts[0] == "" {
			return "", fmt.Errorf("empty skill reference")
		}
		// A bare slug is a curated skill, published under the system author.
		return "aicoach/" + strings.ToLower(parts[0]), nil
	case 2:
		if parts[0] == "" || parts[1] == "" {
			return "", fmt.Errorf("invalid skill reference: %s", raw)
		}
		return strings.ToLower(parts[0] + "/" + parts[1]), nil
	default:
		return "", fmt.Errorf("invalid skill reference: %s (want publisher/slug)", raw)
	}
}

// registryHosts are the hosts a skill URL may name. Bare "publisher/slug" refs
// bypass this and resolve against whichever BaseURL the client was built with,
// which is how self-hosted installs are addressed.
var registryHosts = map[string]bool{
	"aicoach.pw":     true,
	"www.aicoach.pw": true,
	"skill.fish":     true,
	"www.skill.fish": true,
}

func isRegistryHost(host string) bool {
	return registryHosts[strings.ToLower(host)]
}

func looksLikeURL(s string) bool {
	if strings.Contains(s, "://") {
		return true
	}
	// A bare host prefix such as "aicoach.pw/skills/x".
	head, _, found := strings.Cut(s, "/")
	return found && strings.Contains(head, ".")
}

func (c *Client) do(ctx context.Context, method, rawURL string, auth bool) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "multica-aicoach-sync/1")
	if auth && c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: defaultHTTPTimout}
	}
	return client.Do(req)
}

// Manifest reports registry state for the given refs without fetching content.
// Refs beyond the registry's batch limit are requested in successive calls.
// Account identifies the AI Coach user an API key belongs to.
//
// username and displayName are both nullable upstream (a Google-only or
// email-only account has no GitHub handle), so `id` is the only field safe to
// key on. It is the integer primary key and does not change.
type Account struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

// Label is the best human-readable name for the account, falling back through
// the nullable fields to the id so a connected account is never shown blank.
func (a *Account) Label() string {
	if n := strings.TrimSpace(a.DisplayName); n != "" {
		return n
	}
	if u := strings.TrimSpace(a.Username); u != "" {
		return u
	}
	return fmt.Sprintf("AI Coach user %d", a.ID)
}

// Account verifies the configured API key and reports who it belongs to. This
// is what turns "the admin pasted something" into "the workspace is connected
// to a known account", and it is the only way to fail a bad key at paste time
// rather than at the first import.
func (c *Client) Account(ctx context.Context) (*Account, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return nil, fmt.Errorf("no API key configured")
	}

	resp, err := c.do(ctx, http.MethodGet, c.BaseURL+"/api/v1/me", true)
	if err != nil {
		return nil, fmt.Errorf("could not reach AI Coach: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, fmt.Errorf("AI Coach rejected this API key")
	default:
		return nil, fmt.Errorf("AI Coach returned status %d", resp.StatusCode)
	}

	var acct Account
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&acct); err != nil {
		return nil, fmt.Errorf("could not read the AI Coach account response")
	}
	if acct.ID == 0 {
		return nil, fmt.Errorf("AI Coach returned an account with no id")
	}
	return &acct, nil
}

func (c *Client) Manifest(ctx context.Context, refs []string) ([]ManifestEntry, error) {
	if len(refs) == 0 {
		return nil, nil
	}

	var out []ManifestEntry
	for start := 0; start < len(refs); start += maxManifestRefs {
		end := start + maxManifestRefs
		if end > len(refs) {
			end = len(refs)
		}
		batch := refs[start:end]

		u := fmt.Sprintf("%s/api/skills/manifest?refs=%s", c.BaseURL, url.QueryEscape(strings.Join(batch, ",")))
		resp, err := c.do(ctx, http.MethodGet, u, false)
		if err != nil {
			return nil, fmt.Errorf("manifest request failed: %w", err)
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, maxContentBytes))
		resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("manifest read failed: %w", readErr)
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("manifest returned %d: %s", resp.StatusCode, truncate(string(body), 200))
		}

		var parsed manifestResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, fmt.Errorf("manifest decode failed: %w", err)
		}
		out = append(out, parsed.Skills...)
	}
	return out, nil
}

// ManifestOne is Manifest for a single reference.
func (c *Client) ManifestOne(ctx context.Context, ref string) (*ManifestEntry, error) {
	canonical, err := ParseRef(ref)
	if err != nil {
		return nil, err
	}
	entries, err := c.Manifest(ctx, []string{canonical})
	if err != nil {
		return nil, err
	}
	if len(entries) == 0 || !entries[0].Found {
		return nil, fmt.Errorf("skill not found: %s", canonical)
	}
	return &entries[0], nil
}

// Fetch resolves a reference and downloads its content.
func (c *Client) Fetch(ctx context.Context, ref string) (*Skill, error) {
	entry, err := c.ManifestOne(ctx, ref)
	if err != nil {
		return nil, err
	}
	return c.FetchEntry(ctx, entry)
}

// FetchEntry downloads content for an entry already resolved via Manifest,
// which saves a round trip when syncing many skills at once.
func (c *Client) FetchEntry(ctx context.Context, entry *ManifestEntry) (*Skill, error) {
	if entry == nil || !entry.Found {
		return nil, fmt.Errorf("skill not found")
	}
	if entry.RequiresAuth && c.APIKey == "" {
		return nil, fmt.Errorf("skill %s requires an AI Coach API key (set it on the workspace integration)", entry.Ref)
	}

	resp, err := c.do(ctx, http.MethodGet, entry.ContentURL, entry.RequiresAuth)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusPaymentRequired:
		return nil, fmt.Errorf("skill %s is paid and this account has not purchased it", entry.Ref)
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, fmt.Errorf("AI Coach rejected the API key for %s", entry.Ref)
	case http.StatusNotFound:
		return nil, fmt.Errorf("skill %s is no longer available", entry.Ref)
	default:
		return nil, fmt.Errorf("fetch returned %d for %s", resp.StatusCode, entry.Ref)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxContentBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read failed: %w", err)
	}
	if len(body) > maxContentBytes {
		return nil, fmt.Errorf("skill %s exceeds the %d byte limit", entry.Ref, maxContentBytes)
	}

	skill := &Skill{
		Ref:         entry.Ref,
		Name:        entry.Name,
		Description: entry.Description,
		Revision:    entry.Revision,
	}

	if entry.ContentType == "bundle" {
		// The manifest publishes the digest the publisher signed the bundle
		// with. Checking it here ties the bytes we are about to unpack to the
		// resolution step that told us to fetch them, so a swapped or
		// truncated object fails loudly instead of being mirrored into a
		// workspace and handed to an agent.
		if err := verifyDigest(body, entry.SHA256); err != nil {
			return nil, fmt.Errorf("bundle for %s: %w", entry.Ref, err)
		}
		content, files, err := extractBundle(body)
		if err != nil {
			return nil, fmt.Errorf("bundle for %s: %w", entry.Ref, err)
		}
		skill.Content = content
		skill.Files = files
	} else {
		skill.Content = string(body)
	}

	if strings.TrimSpace(skill.Content) == "" {
		return nil, fmt.Errorf("skill %s has no SKILL.md content", entry.Ref)
	}
	if name, desc := ParseFrontmatter(skill.Content); skill.Name == "" || skill.Description == "" {
		if skill.Name == "" {
			skill.Name = name
		}
		if skill.Description == "" {
			skill.Description = desc
		}
	}
	return skill, nil
}

// verifyDigest compares downloaded bytes against the digest the manifest
// advertised. An empty expected digest means the registry published none, which
// is not an error: system skills carry a digest of their markdown rather than a
// bundle. Comparison is case-insensitive because hex casing is not meaningful.
func verifyDigest(body []byte, expected string) error {
	if strings.TrimSpace(expected) == "" {
		return nil
	}
	sum := sha256.Sum256(body)
	got := hex.EncodeToString(sum[:])
	if !strings.EqualFold(got, expected) {
		return fmt.Errorf("digest mismatch: manifest says %s, downloaded %s", expected, got)
	}
	return nil
}

// extractBundle pulls SKILL.md and supporting files out of a .tar.gz.
func extractBundle(gz []byte) (string, []File, error) {
	zr, err := gzip.NewReader(bytes.NewReader(gz))
	if err != nil {
		return "", nil, fmt.Errorf("gzip: %w", err)
	}
	defer zr.Close()

	tr := tar.NewReader(io.LimitReader(zr, maxDecodedBytes))
	var content string
	var files []File
	var decoded int64

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", nil, fmt.Errorf("tar: %w", err)
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}

		clean := strings.TrimPrefix(path.Clean(hdr.Name), "./")
		// Reject traversal and absolute paths rather than trusting the archive.
		if clean == "" || strings.HasPrefix(clean, "/") || strings.HasPrefix(clean, "..") {
			continue
		}

		decoded += hdr.Size
		if decoded > maxDecodedBytes {
			return "", nil, fmt.Errorf("bundle expands beyond %d bytes", maxDecodedBytes)
		}

		data, err := io.ReadAll(io.LimitReader(tr, maxDecodedBytes))
		if err != nil {
			return "", nil, fmt.Errorf("read %s: %w", clean, err)
		}

		if clean == "SKILL.md" {
			content = string(data)
			continue
		}
		files = append(files, File{Path: clean, Content: string(data)})
	}

	if content == "" {
		return "", nil, fmt.Errorf("no SKILL.md in bundle")
	}
	return content, files, nil
}

// ParseFrontmatter reads `name` and `description` from a SKILL.md YAML header.
func ParseFrontmatter(md string) (name, description string) {
	if !strings.HasPrefix(md, "---") {
		return "", ""
	}
	rest := strings.TrimPrefix(md, "---")
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return "", ""
	}
	for _, line := range strings.Split(rest[:end], "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, "name:"):
			name = unquote(strings.TrimSpace(strings.TrimPrefix(trimmed, "name:")))
		case strings.HasPrefix(trimmed, "description:"):
			description = unquote(strings.TrimSpace(strings.TrimPrefix(trimmed, "description:")))
		}
	}
	return name, description
}

func unquote(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
