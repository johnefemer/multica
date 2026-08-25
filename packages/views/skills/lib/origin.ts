import type { Skill, SkillSource, SkillSyncState } from "@multica/core/types";

/**
 * Discriminated view over where a skill came from.
 *
 * There are two provenance mechanisms because they answer different questions.
 * Registry imports (AI Coach, ClawHub, Skills.sh) record themselves in the
 * `source*` columns migration 069 added, because the sync worker has to query
 * them. A skill promoted from a local runtime has nothing to sync, so it keeps
 * its details in `config.origin` where it always has.
 */
export type OriginInfo = {
  type: SkillSource | "runtime_local" | "manual";
  /** runtime_local only */
  provider?: string;
  runtime_id?: string;
  source_path?: string;
  /** registry imports */
  source_url?: string;
  source_ref?: string;
  source_rev?: string;
  auto_sync?: boolean;
  sync_state?: SkillSyncState;
  sync_error?: string;
  synced_at?: string | null;
};

const REGISTRY_LABELS: Record<string, string> = {
  aicoach: "AI Coach",
  clawhub: "ClawHub",
  skills_sh: "Skills.sh",
};

export function readOrigin(skill: Skill): OriginInfo {
  if (skill.source && skill.source !== "local") {
    return {
      type: skill.source,
      source_url: skill.source_url,
      source_ref: skill.source_ref,
      source_rev: skill.source_rev,
      auto_sync: skill.auto_sync,
      sync_state: skill.sync_state,
      sync_error: skill.sync_error,
      synced_at: skill.synced_at,
    };
  }

  const raw = (skill.config?.origin ?? null) as
    | (OriginInfo & Record<string, unknown>)
    | null;
  if (raw?.type === "runtime_local") return raw;

  return { type: "manual" };
}

/** Human label for the source, for badges and detail headers. */
export function originLabel(origin: OriginInfo): string {
  if (origin.type === "runtime_local") return "Local runtime";
  if (origin.type === "manual") return "Written here";
  return REGISTRY_LABELS[origin.type] ?? origin.type;
}

/** True when the skill is a mirror of something published elsewhere, which is
 *  what decides whether editing it locally will be overwritten by a sync. */
export function isMirrored(origin: OriginInfo): boolean {
  return origin.type === "aicoach" || origin.type === "clawhub" || origin.type === "skills_sh";
}

/** A one-line account of sync health, or null when there is nothing to say.
 *  Deliberately quiet for the healthy case: a green "synced" badge on every
 *  row is noise. */
export function syncNote(origin: OriginInfo): string | null {
  if (!isMirrored(origin)) return null;
  switch (origin.sync_state) {
    case "gone":
      return "No longer published upstream. Your copy is kept.";
    case "error":
      return origin.sync_error
        ? `Last sync failed: ${origin.sync_error}`
        : "Last sync failed.";
    case "syncing":
      return "Syncing…";
    default:
      return origin.auto_sync ? null : "Fixed copy, not kept up to date.";
  }
}

/** SKILL.md is always present plus any additional attached files. */
export function totalFileCount(skill: Skill): number {
  return (skill.files?.length ?? 0) + 1;
}
