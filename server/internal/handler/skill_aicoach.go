package handler

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/multica-ai/multica/server/internal/aicoach"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// importFromAICoach mirrors a skill from the AI Coach registry into a workspace.
//
// Unlike the GitHub-backed sources, AI Coach publishes a revision per skill, so
// an import here can record where it came from and opt into automatic updates.
// Paid skills resolve through the same authenticated endpoint that enforces the
// purchase, so an unpurchased skill fails here rather than importing empty.
func (h *Handler) importFromAICoach(
	w http.ResponseWriter,
	r *http.Request,
	workspaceID, creatorID, rawURL string,
	autoSync bool,
) {
	ctx := r.Context()

	ref, err := aicoach.ParseRef(rawURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// The key belongs to the workspace, not the install: whoever connected AI
	// Coach in settings is the account whose purchases this import can reach.
	// Curated skills are public and import fine with no key at all.
	client := aicoach.New(os.Getenv("AICOACH_BASE_URL"), h.aicoachKeyForWorkspace(ctx, workspaceID))
	skill, err := client.Fetch(ctx, ref)
	if err != nil {
		// A missing key or an unpurchased paid skill is the caller's problem to
		// fix, not a registry fault, so it reads as 400 rather than 502.
		status := http.StatusBadGateway
		msg := err.Error()
		if strings.Contains(msg, "API key") || strings.Contains(msg, "purchased") {
			status = http.StatusBadRequest
		}
		writeError(w, status, msg)
		return
	}

	store := &aicoach.PgStore{DB: h.DB, Tx: h.TxStarter}
	skillID, err := store.Import(ctx, aicoach.ImportInput{
		WorkspaceID: workspaceID,
		CreatorID:   creatorID,
		Name:        skillName(skill),
		Description: skill.Description,
		Content:     skill.Content,
		SourceRef:   ref,
		SourceURL:   rawURL,
		SourceRev:   skill.Revision,
		AutoSync:    autoSync,
		Files:       skill.Files,
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a skill with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to import skill: "+err.Error())
		return
	}

	resp, err := h.loadImportedSkill(ctx, skillID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "imported but could not be read back: "+err.Error())
		return
	}

	actorType, actorID := h.resolveActor(r, creatorID, workspaceID)
	h.publish(protocol.EventSkillCreated, workspaceID, actorType, actorID, map[string]any{"skill": resp})
	writeJSON(w, http.StatusCreated, resp)
}

// skillName prefers the registry display name, falling back to the reference so
// a skill never lands unnamed.
func skillName(s *aicoach.Skill) string {
	if n := strings.TrimSpace(s.Name); n != "" {
		return n
	}
	if _, after, found := strings.Cut(s.Ref, "/"); found && after != "" {
		return after
	}
	return s.Ref
}

// ImportedSkillResponse is the mirrored skill with its provenance. The
// provenance fields live on SkillResponse itself so an imported skill looks
// identical whether it arrives from this endpoint or from a later list call.
type ImportedSkillResponse = SkillWithFilesResponse

// loadImportedSkill reads the row back with its provenance columns. It queries
// directly rather than through the generated store, which does not yet know
// about the columns migration 069 adds.
func (h *Handler) loadImportedSkill(ctx context.Context, skillID string) (ImportedSkillResponse, error) {
	var out ImportedSkillResponse
	var createdBy *string

	err := h.DB.QueryRow(ctx, `
		SELECT id::text, workspace_id::text, name, description, content,
		       created_by::text, created_at, updated_at,
		       source, COALESCE(source_ref,''), COALESCE(source_url,''),
		       COALESCE(source_rev,''), auto_sync, sync_state
		FROM skill WHERE id = $1::uuid`, skillID).
		Scan(&out.ID, &out.WorkspaceID, &out.Name, &out.Description, &out.Content,
			&createdBy, &out.CreatedAt, &out.UpdatedAt,
			&out.Source, &out.SourceRef, &out.SourceURL,
			&out.SourceRev, &out.AutoSync, &out.SyncState)
	if err != nil {
		return out, err
	}
	out.CreatedBy = createdBy
	out.Config = map[string]any{}

	rows, err := h.DB.Query(ctx, `
		SELECT id::text, skill_id::text, path, content, created_at, updated_at
		FROM skill_file WHERE skill_id = $1::uuid ORDER BY path`, skillID)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	out.Files = []SkillFileResponse{}
	for rows.Next() {
		var f SkillFileResponse
		if err := rows.Scan(&f.ID, &f.SkillID, &f.Path, &f.Content, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return out, err
		}
		out.Files = append(out.Files, f)
	}
	return out, rows.Err()
}
