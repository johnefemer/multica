package aicoach

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// SourceName is the value stored in skill.source for skills mirrored from here.
const SourceName = "aicoach"

// Sync states persisted on skill.sync_state.
const (
	StateOK      = "ok"
	StateSyncing = "syncing"
	StateError   = "error"
	StateGone    = "gone"
)

// DefaultBatch bounds how many tracked skills one pass examines. The manifest
// call is one request per workspace regardless, so this caps work per tick
// rather than request volume.
const DefaultBatch = 200

// Syncer keeps mirrored skills current with the registry.
type Syncer struct {
	Store   Store
	BaseURL string
	// APIKeyFor resolves the key to use for a workspace. Curated skills need
	// none; skills published by a user do, and a paid one additionally needs a
	// purchase on that account. Nil means unauthenticated, which still syncs
	// every curated skill.
	APIKeyFor func(ctx context.Context, workspaceID string) string
	Logger    *slog.Logger
}

// Result summarizes one pass.
type Result struct {
	Checked   int
	Updated   int
	Unchanged int
	Gone      int
	Failed    int
}

func (s *Syncer) logger() *slog.Logger {
	if s.Logger != nil {
		return s.Logger
	}
	return slog.Default()
}

func (s *Syncer) clientFor(ctx context.Context, workspaceID string) *Client {
	key := ""
	if s.APIKeyFor != nil {
		key = s.APIKeyFor(ctx, workspaceID)
	}
	return New(s.BaseURL, key)
}

// SyncOnce examines tracked skills and re-pulls the ones whose revision moved.
//
// Content is fetched only when the manifest reports a different revision, so a
// steady state costs one manifest request per workspace and nothing else.
func (s *Syncer) SyncOnce(ctx context.Context, limit int32) (Result, error) {
	var result Result
	if limit <= 0 {
		limit = DefaultBatch
	}

	skills, err := s.Store.ListSyncable(ctx, limit)
	if err != nil {
		return result, fmt.Errorf("list syncable skills: %w", err)
	}
	if len(skills) == 0 {
		return result, nil
	}

	// The API key is per workspace, so refs resolve per workspace too.
	byWorkspace := map[string][]TrackedSkill{}
	for _, sk := range skills {
		if sk.SourceRef == "" {
			continue
		}
		byWorkspace[sk.WorkspaceID] = append(byWorkspace[sk.WorkspaceID], sk)
	}

	for workspaceID, group := range byWorkspace {
		res := s.syncWorkspace(ctx, workspaceID, group)
		result.Checked += res.Checked
		result.Updated += res.Updated
		result.Unchanged += res.Unchanged
		result.Gone += res.Gone
		result.Failed += res.Failed
	}
	return result, nil
}

func (s *Syncer) syncWorkspace(ctx context.Context, workspaceID string, skills []TrackedSkill) Result {
	var result Result
	if len(skills) == 0 {
		return result
	}

	client := s.clientFor(ctx, workspaceID)

	refs := make([]string, 0, len(skills))
	byRef := map[string]TrackedSkill{}
	for _, sk := range skills {
		refs = append(refs, sk.SourceRef)
		byRef[sk.SourceRef] = sk
	}

	entries, err := client.Manifest(ctx, refs)
	if err != nil {
		// A registry outage is not a per-skill fault, so leave the rows alone
		// and let the next tick retry instead of flagging everything as broken.
		s.logger().Warn("aicoach sync: manifest failed", "error", err, "skills", len(refs))
		result.Failed += len(refs)
		return result
	}

	for _, entry := range entries {
		sk, ok := byRef[entry.Ref]
		if !ok {
			continue
		}
		result.Checked++

		if !entry.Found {
			// Unpublished, made private, or taken down. The local copy stays so
			// a running agent does not lose a skill mid-task; it just stops
			// being tracked as current.
			s.mark(ctx, sk.ID, StateGone, "no longer published on AI Coach")
			result.Gone++
			continue
		}

		if sk.SourceRev != "" && sk.SourceRev == entry.Revision && sk.SyncState == StateOK {
			result.Unchanged++
			continue
		}

		if err := s.pull(ctx, client, sk, entry); err != nil {
			s.logger().Warn("aicoach sync: pull failed", "ref", entry.Ref, "error", err)
			s.mark(ctx, sk.ID, StateError, err.Error())
			result.Failed++
			continue
		}
		result.Updated++
		s.logger().Info("aicoach sync: updated skill", "ref", entry.Ref, "revision", entry.Revision)
	}
	return result
}

// pull downloads new content and replaces the stored copy.
func (s *Syncer) pull(ctx context.Context, client *Client, sk TrackedSkill, entry ManifestEntry) error {
	fetched, err := client.FetchEntry(ctx, &entry)
	if err != nil {
		return err
	}
	if err := s.Store.SaveSynced(ctx, sk.ID, fetched.Description, fetched.Content, fetched.Revision); err != nil {
		return fmt.Errorf("save skill: %w", err)
	}
	if err := s.Store.ReplaceFiles(ctx, sk.ID, fetched.Files); err != nil {
		return fmt.Errorf("save skill files: %w", err)
	}
	return nil
}

func (s *Syncer) mark(ctx context.Context, skillID, state, msg string) {
	if err := s.Store.SetState(ctx, skillID, state, msg); err != nil {
		s.logger().Warn("aicoach sync: could not record sync state", "state", state, "error", err)
	}
}

// Run syncs on an interval until the context is cancelled. One pass runs
// immediately so a fresh server does not wait a full interval.
func (s *Syncer) Run(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	s.runPass(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.runPass(ctx)
		}
	}
}

func (s *Syncer) runPass(ctx context.Context) {
	res, err := s.SyncOnce(ctx, DefaultBatch)
	if err != nil {
		s.logger().Warn("aicoach sync: pass failed", "error", err)
		return
	}
	if res.Checked == 0 {
		return
	}
	s.logger().Info("aicoach sync: pass complete",
		"checked", res.Checked, "updated", res.Updated,
		"unchanged", res.Unchanged, "gone", res.Gone, "failed", res.Failed)
}
