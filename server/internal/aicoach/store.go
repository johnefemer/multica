package aicoach

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// This package reads and writes the sync columns migration 069 adds directly,
// rather than through the generated store.
//
// The generated code in this repo does not currently round-trip through
// `sqlc generate` (regenerating it changes unrelated packages and breaks
// callers mid-refactor), so depending on it would make this feature impossible
// to land without dragging that refactor along. The queries live in
// pkg/db/queries/skill.sql too, so a future regeneration picks them up and this
// file can be swapped for the generated store with no change to Syncer.

// TrackedSkill is a mirrored skill the syncer is responsible for.
type TrackedSkill struct {
	ID          string
	WorkspaceID string
	Name        string
	SourceRef   string
	SourceRev   string
	SyncState   string
}

// Store is the persistence the syncer needs.
type Store interface {
	ListSyncable(ctx context.Context, limit int32) ([]TrackedSkill, error)
	SaveSynced(ctx context.Context, skillID, description, content, revision string) error
	SetState(ctx context.Context, skillID, state, message string) error
	ReplaceFiles(ctx context.Context, skillID string, files []File) error
}

// Querier is the read/write surface PgStore needs. A *pgxpool.Pool satisfies
// it, and so does the API handler's existing DB field, so the same store backs
// both the background worker and request-time imports.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// TxBeginner starts a transaction. Kept separate from Querier because the
// handler supplies the two through different fields.
type TxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// PgStore implements Store on Postgres.
type PgStore struct {
	DB Querier
	Tx TxBeginner
}

// NewPgStore builds a store from anything satisfying both interfaces, such as
// a *pgxpool.Pool.
func NewPgStore(db interface {
	Querier
	TxBeginner
}) *PgStore {
	return &PgStore{DB: db, Tx: db}
}

func (s *PgStore) ListSyncable(ctx context.Context, limit int32) ([]TrackedSkill, error) {
	if limit <= 0 {
		limit = DefaultBatch
	}
	rows, err := s.DB.Query(ctx, `
		SELECT id::text, workspace_id::text, name,
		       COALESCE(source_ref, ''), COALESCE(source_rev, ''), sync_state
		FROM skill
		WHERE auto_sync = TRUE AND source = $1 AND source_ref IS NOT NULL
		ORDER BY synced_at ASC NULLS FIRST
		LIMIT $2`, SourceName, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TrackedSkill
	for rows.Next() {
		var t TrackedSkill
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.SourceRef, &t.SourceRev, &t.SyncState); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *PgStore) SaveSynced(ctx context.Context, skillID, description, content, revision string) error {
	_, err := s.DB.Exec(ctx, `
		UPDATE skill
		SET description = $2, content = $3, source_rev = NULLIF($4, ''),
		    synced_at = now(), sync_state = 'ok', sync_error = NULL, updated_at = now()
		WHERE id = $1::uuid`, skillID, description, content, revision)
	return err
}

func (s *PgStore) SetState(ctx context.Context, skillID, state, message string) error {
	_, err := s.DB.Exec(ctx, `
		UPDATE skill
		SET sync_state = $2, sync_error = NULLIF($3, ''), synced_at = now()
		WHERE id = $1::uuid`, skillID, state, message)
	return err
}

// ReplaceFiles swaps the supporting files atomically, so a file deleted
// upstream disappears here and a mid-write failure cannot leave a half set.
func (s *PgStore) ReplaceFiles(ctx context.Context, skillID string, files []File) error {
	tx, err := s.Tx.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM skill_file WHERE skill_id = $1::uuid`, skillID); err != nil {
		return fmt.Errorf("clear files: %w", err)
	}
	for _, f := range files {
		if _, err := tx.Exec(ctx, `
			INSERT INTO skill_file (skill_id, path, content)
			VALUES ($1::uuid, $2, $3)
			ON CONFLICT (skill_id, path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
			skillID, f.Path, f.Content); err != nil {
			return fmt.Errorf("write %s: %w", f.Path, err)
		}
	}
	return tx.Commit(ctx)
}

// ImportInput describes a skill being mirrored into a workspace for the first time.
type ImportInput struct {
	WorkspaceID string
	CreatorID   string
	Name        string
	Description string
	Content     string
	SourceRef   string
	SourceURL   string
	SourceRev   string
	AutoSync    bool
	Files       []File
}

// Import creates the mirrored skill and its files in one transaction. Re-importing
// an already-tracked skill updates it in place instead of failing on the unique
// (workspace, source, source_ref) index.
func (s *PgStore) Import(ctx context.Context, in ImportInput) (string, error) {
	tx, err := s.Tx.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO skill (workspace_id, name, description, content, config, created_by,
		                   source, source_ref, source_url, source_rev, auto_sync, synced_at, sync_state)
		VALUES ($1::uuid, $2, $3, $4, '{}'::jsonb, NULLIF($5,'')::uuid,
		        $6, $7, NULLIF($8,''), NULLIF($9,''), $10, now(), 'ok')
		ON CONFLICT (workspace_id, source, source_ref) WHERE source_ref IS NOT NULL
		DO UPDATE SET description = EXCLUDED.description,
		              content     = EXCLUDED.content,
		              source_rev  = EXCLUDED.source_rev,
		              auto_sync   = EXCLUDED.auto_sync,
		              synced_at   = now(),
		              sync_state  = 'ok',
		              sync_error  = NULL,
		              updated_at  = now()
		RETURNING id::text`,
		in.WorkspaceID, in.Name, in.Description, in.Content, in.CreatorID,
		SourceName, in.SourceRef, in.SourceURL, in.SourceRev, in.AutoSync,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("import skill: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM skill_file WHERE skill_id = $1::uuid`, id); err != nil {
		return "", fmt.Errorf("clear files: %w", err)
	}
	for _, f := range in.Files {
		if _, err := tx.Exec(ctx, `
			INSERT INTO skill_file (skill_id, path, content) VALUES ($1::uuid, $2, $3)`,
			id, f.Path, f.Content); err != nil {
			return "", fmt.Errorf("write %s: %w", f.Path, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

// SetAutoSync turns tracking on or off for one skill.
func (s *PgStore) SetAutoSync(ctx context.Context, skillID string, on bool) error {
	tag, err := s.DB.Exec(ctx, `UPDATE skill SET auto_sync = $2, updated_at = now() WHERE id = $1::uuid`, skillID, on)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
