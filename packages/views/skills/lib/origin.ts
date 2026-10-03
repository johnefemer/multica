import type { Skill, SkillSummary, SkillSource, SkillSyncState } from "@multica/core/types";

/**
 * Discriminated view over where a skill came from.
 *
 * Registry imports mirrored by the Kensink sync worker (AI Coach, ClawHub,
 * Skills.sh) record themselves in the `source*` columns migration 069 added,
 * because the sync worker has to query them. Everything else keeps its details
 * in `config.origin` (local runtime, ClawHub, Skills.sh, GitHub). Manual
 * creates have no origin, so we synthesize `{ type: "manual" }` for them to
 * keep the consumer code uniform.
 */
export type OriginInfo = {
  type: Exclude<SkillSource, "local"> | "runtime_local" | "github" | "manual";
  provider?: string;
  runtime_id?: string;
  source_path?: string;
  /** registry imports */
  source_url?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  skill?: string;
  slug?: string;
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

export function readOrigin(skill: SkillSummary): OriginInfo {
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
  if (raw?.type === "clawhub") return raw;
  if (raw?.type === "skills_sh") return raw;
  if (raw?.type === "github") return raw;
  return { type: "manual" };
}

/**
 * Whether the skill can be re-downloaded from where it was imported. Only
 * hosted sources qualify: runtime-local copies re-import through the daemon,
 * and manual / archive-uploaded skills have no upstream at all. The server
 * enforces the same rule on `POST /api/skills/:id/refresh`.
 */
export function isRefreshableOrigin(origin: OriginInfo): boolean {
  return (
    (origin.type === "github" || origin.type === "skills_sh" || origin.type === "clawhub") &&
    typeof origin.source_url === "string" &&
    origin.source_url.length > 0
  );
}

// Hosts each hosted origin type may legitimately point at — the client-side
// mirror of the server's `detectImportSource` allowlist (skill.go). Keyed by
// origin type so a hand-edited config can't dress an arbitrary host up as a
// GitHub / Skills.sh / ClawHub link.
const ORIGIN_SOURCE_HOSTS: Partial<Record<OriginInfo["type"], readonly string[]>> = {
  github: ["github.com", "www.github.com"],
  skills_sh: ["skills.sh", "www.skills.sh"],
  clawhub: ["clawhub.ai", "www.clawhub.ai"],
  aicoach: ["aicoach.pw", "www.aicoach.pw", "skill.fish", "www.skill.fish"],
};

/**
 * The origin's `source_url` validated for use as a link destination, or null.
 *
 * `origin` is persisted JSONB that anyone able to update the skill can write
 * verbatim (`PATCH /api/skills/:id` does not validate `config`), so before a
 * value becomes an `href` it must survive being treated as a destination:
 * http(s) only, and the host must match the declared origin type. Everything
 * else — manual/runtime_local origins, missing or malformed URLs, `data:` and
 * other schemes, host/type mismatches — returns null so callers fall back to
 * plain text.
 *
 * Deliberately stricter than `isRefreshableOrigin`: the server's refresh path
 * re-validates provenance itself and also accepts scheme-less values (e.g. a
 * bare ClawHub slug), which are refreshable but meaningless as an `href`.
 */
export function originSourceUrl(origin: OriginInfo | null): string | null {
  if (!origin) return null;
  const hosts = ORIGIN_SOURCE_HOSTS[origin.type];
  if (!hosts) return null;
  if (typeof origin.source_url !== "string" || origin.source_url.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin.source_url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!hosts.includes(parsed.hostname.toLowerCase())) return null;
  return origin.source_url;
}

/**
 * SKILL.md is always present plus any additional attached files. Accepts a
 * `SkillSummary` because list endpoints don't return the `files` array — in
 * that case we only know the body exists, so the count falls back to 1.
 */
export function totalFileCount(skill: Skill | SkillSummary): number {
  const files = (skill as Skill).files;
  return (files?.length ?? 0) + 1;
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
