# RFC: AI Coach skill import

Status: Proposed. No code written yet.

Scope: adds `aicoach.pw` as a third source in the workspace **Import from URL**
flow, with an OAuth connection so private and purchased skills resolve against
the importing user's AI Coach account.

Related: [skill.go](server/internal/handler/skill.go),
[integration.go](server/internal/handler/integration.go),
[create-skill-dialog.tsx](packages/views/skills/components/create-skill-dialog.tsx),
[slack-integration.md](docs/slack-integration.md) (the closest precedent for a
provider rollout).

## Summary

**New skill → Import from URL** currently accepts ClawHub and Skills.sh URLs.
Both are fetched anonymously by the backend. AI Coach serves three classes of
skill: free public ones from the curated catalog, community skills that can be
`private` or `unlisted`, and community skills sold one-time through Stripe.
Anonymous fetching can only ever reach the first class.

This RFC adds an `aicoach` integration provider. A workspace member connects
their AI Coach account once, and the backend then calls AI Coach's authenticated
download endpoint on their behalf, so AI Coach itself decides whether the
importer owns the skill. Multica never evaluates entitlement, it only carries a
credential and surfaces the answer.

## Goals

- Paste `https://aicoach.pw/skills/<slug>` or `https://aicoach.pw/skills/<publisher>/<slug>` into the existing import field and get a workspace skill.
- Private and paid skills import only when the importing user is the owner or has an active purchase, verified by AI Coach, not by us.
- Reuse the existing integration OAuth machinery (`integration_connection`, `/auth/{provider}/start|callback`, provider registry). No parallel token store.
- Record provenance on the created skill so the UI can show where it came from, which version, and whether it was paid.
- Actionable failures: "connect AI Coach", "purchase required", "not found" must be distinguishable by the client, not just a red toast with a server string.

## Non-goals (v1)

- Browsing or searching AI Coach from inside Multica. Import is URL-driven, same as ClawHub and Skills.sh.
- Buying a skill from inside Multica. A paid skill that is not owned links out to aicoach.pw checkout.
- Automatic updates when the publisher ships a new version. v1 records the imported semver; re-import is manual.
- Publishing a workspace skill back to AI Coach (`publish_skill` exists on the AI Coach MCP server, out of scope here).
- Token encryption at rest. `integration_connection.access_token` is plaintext today for GitHub and Slack. AI Coach keys inherit that, and fixing it is a separate piece of work (see [Security](#security-and-licensing)).

## How import works today

[`ImportSkill`](server/internal/handler/skill.go) is the whole flow:

1. `detectImportSource(url)` normalizes the URL and switches on host: `skills.sh` → `sourceSkillsSh`, `clawhub.ai` → `sourceClawHub`, a bare slug falls back to ClawHub, anything else is a 400.
2. A throwaway `&http.Client{Timeout: 30 * time.Second}` fetches metadata plus files. No credentials, ever.
3. Files are filtered through `validateFilePath` (no absolute paths, no `..`), and `fetchRawFile` caps each file at 1 MB.
4. `createSkillWithFiles` ([skill_create.go](server/internal/handler/skill_create.go)) writes one `skill` row plus N `skill_file` rows in a transaction, and `Config` is passed as `map[string]any{}`.

Point 4 is why [origin.ts](packages/views/skills/lib/origin.ts) says the
`clawhub` and `skills_sh` origin variants "should never be rendered in the UI
until the server fills them in". Only the runtime-local import path writes
`config.origin` today ([runtime_local_skills.go](server/internal/handler/runtime_local_skills.go)).

Integrations are separate machinery: one `integration_connection` row per
`(workspace_id, provider)`, tokens obtained through
`IntegrationOAuthStart` → provider consent → `IntegrationOAuthCallback`, with
identity carried across the cross-site redirect in an `HttpOnly`, `SameSite=Lax`
state cookie because the session cookie is `SameSite=Strict`. Providers
implement the `Provider` interface in
[provider.go](server/internal/integration/provider.go) and are registered in
[router.go](server/cmd/server/router.go), Slack conditionally on
`SLACK_CLIENT_ID` being set.

## What AI Coach exposes

Verified against the AI Coach source (Astro on Cloudflare Workers, D1 + R2).

**URL shapes**

| URL | Meaning | Auth |
|---|---|---|
| `aicoach.pw/skills/<slug>` | Curated first-party catalog skill, served from a static catalog | none |
| `aicoach.pw/skills/<publisher>/<slug>` | Community skill from `user_skills`, may be private, unlisted, free or paid | account-dependent |

One path segment after `/skills/` means curated, two means community. That is
the only disambiguation needed.

**Connect flow (Partner Connect)**

1. `GET https://aicoach.pw/connect?client_id=…&redirect_uri=…&state=…` renders a consent page. Unauthenticated visitors get a pre-auth landing page that routes through GitHub sign-in and returns.
2. Approval POSTs to `/api/connect/authorize`, which sets a 5 minute auth code and 302s back to `redirect_uri` with `code` and `state`.
3. `POST /api/v1/oauth/token` with `{ code, client_id, client_secret | code_verifier, redirect_uri }` returns `{ api_key, key_prefix, key_id, token_type: "bearer" }`.

Two things about step 3 matter for our design. The credential is a **long-lived
API key**, not an expiring access token, and there is no refresh token. And
`exchangeAuthCode` mints that key with the default scope `web:account`, ignoring
any scope the client asked for (`purchases:read` exists in the scope vocabulary
but is never granted through this path).

`redirect_uri` is validated by exact match against the registered list, so every
deployment origin has to be registered. `POST /api/v1/oauth/register` implements
RFC 7591 dynamic client registration for PKCE public clients, which is the
escape hatch for self-hosted installs.

**Reading skills**

- `GET /api/v1/skills/<slug>` returns curated metadata plus a `skillMdUrl` pointing at `/skills-md/<slug>.md`. Public, CORS-open, and it exposes SKILL.md only, no supporting files.
- `GET /api/skills/<publisher>/<slug>/download?version=<semver>` streams the community skill bundle. This is the endpoint that matters. Auth comes from the standard middleware, which populates `locals.user` from a session cookie or from `Authorization: Bearer <api_key>` on `/api/` paths.

Its gate, in order: 401 when unauthenticated, 451 when `status = 'taken_down'`,
404 when `visibility = 'private'` and the caller is not the owner (deliberately
not 403, so private skills do not leak their existence), 402 when
`pricingModel = 'one_time'` and the caller has no unrefunded purchase, 404 when
there is no finalized version. On success it streams `application/gzip` with
`X-Skill-Sha256`, `X-Skill-Semver` and `X-Skill-Publisher` headers, and soft-bumps
`install_count`. Bundles are tar.gz capped at 5 MB with the SHA-256 recorded at
publish time.

Note for whoever picks this up: `src/lib/skills/entitlement.ts` declares itself
"the SINGLE paywall gate" but currently has no callers. The download route
implements the same rules inline via `buyerOwns`. We depend on the route, not on
that helper.

## Decisions

**D1. Reuse the integration provider framework.** `aicoach` becomes a provider
in `server/internal/integration/aicoach/`, registered in
[router.go](server/cmd/server/router.go) only when `AICOACH_CLIENT_ID` is set,
mirroring Slack. The OAuth start and callback routes, the state cookie handling,
and the connection row all come for free. `VerifyWebhook` and `HandleEvent`
return "not supported" errors, since AI Coach sends us nothing.

**D2. The connection is per user, per workspace.** This is the central decision.
Entitlement on AI Coach belongs to a person: `marketplace_purchases.buyer_user_id`
is a user, and `visibility = 'private'` means the owner and nobody else. A single
workspace-shared connection would mean one member's purchases silently become
the whole workspace's import rights, which misrepresents the licence to AI Coach
and breaks the moment that member disconnects. Each member connects their own AI
Coach account, and an import runs as the importer.

Consequence: the `UNIQUE(workspace_id, provider)` constraint on
`integration_connection` cannot hold for this provider. See [Schema](#schema).

**D3. Connecting AI Coach is a member-level action.** `IntegrationOAuthCallback`
requires `owner` or `admin` today, which is right for GitHub and Slack because
those connections act on behalf of the whole workspace. A personal AI Coach
account is the opposite: any member must be able to attach their own. The role
check becomes provider-scoped.

**D4. Store the API key as a non-expiring access token.** `access_token` holds
the key, `refresh_token` and `token_expires_at` stay NULL, `scope` records what
AI Coach reports. On a 401 from any AI Coach call, flip `status` to `error` with
an `error_message`, so the integrations page and the import dialog can both
prompt a reconnect. There is nothing to refresh.

**D5. Confidential client via env for the hosted product.**
`AICOACH_CLIENT_ID` / `AICOACH_CLIENT_SECRET`, with `AICOACH_BASE_URL`
defaulting to `https://aicoach.pw`, registered once as a partner app with our
callback URLs. PKCE and dynamic client registration are the answer for
self-hosted installs whose callback origin we cannot pre-register, and that is
deferred (see [Open questions](#open-questions)).

**D6. Curated skills import without a connection.** A `aicoach.pw/skills/<slug>`
URL resolves through the public `/api/v1/skills/<slug>` endpoint with no
credential. Requiring a connection for a public skill would be friction for no
gain. Only the two-segment community form needs the connection, and only then do
we ask for one.

**D7. Metadata comes out of the bundle, not a new endpoint.** AI Coach has no
public JSON detail endpoint for community skills. Rather than block on adding
one, extract `SKILL.md` from the tarball and reuse
[`parseSkillFrontmatter`](server/internal/handler/skill.go) for name and
description, falling back to the slug. Zero cross-repo dependency for the happy
path.

**D8. Provenance is written to `skill.config.origin`.** New `aicoach` variant,
and while we are in there, fill in the `clawhub` and `skills_sh` origins that
[origin.ts](packages/views/skills/lib/origin.ts) already declares and the server
never writes. The UI can then say what a skill is and where it came from,
uniformly.

**D9. Imported content is a copy, checked once.** Entitlement is verified at
import time. After that the skill lives in `skill` / `skill_file` like any other
and gets shipped to agent runtimes by `LoadAgentSkills`
([task.go](server/internal/service/task.go)). We do not re-check on every task,
and we do not phone home. What we do owe AI Coach is honest provenance and no
re-export path. See [Security and licensing](#security-and-licensing).

**D10. Version is pinned and recorded, updates are manual.** The import records
`X-Skill-Semver` and `X-Skill-Sha256`. Detecting a newer published version is a
follow-up phase, not v1.

## Schema

One migration, `069_integration_connection_user_scope`. The existing table keeps
serving workspace-level providers unchanged.

```sql
-- 069_integration_connection_user_scope.up.sql
ALTER TABLE integration_connection
    ADD COLUMN connection_scope TEXT NOT NULL DEFAULT 'workspace';

-- Workspace-level uniqueness must not apply to per-user providers.
ALTER TABLE integration_connection
    DROP CONSTRAINT integration_connection_workspace_id_provider_key;

CREATE UNIQUE INDEX integration_connection_workspace_provider_uniq
    ON integration_connection (workspace_id, provider)
    WHERE connection_scope = 'workspace';

CREATE UNIQUE INDEX integration_connection_workspace_provider_user_uniq
    ON integration_connection (workspace_id, provider, connected_by)
    WHERE connection_scope = 'user';
```

The down migration drops both partial indexes, restores the plain unique
constraint, and drops the column. Existing GitHub and Slack rows default to
`workspace` and keep exactly the constraint they have now.

New queries in [integration.sql](server/pkg/db/queries/integration.sql):
`GetUserIntegrationConnection` (workspace + provider + user),
`UpsertUserIntegrationConnection`, `ListUserIntegrationConnections`,
`DeleteUserIntegrationConnection`.

> **Do not run `make sqlc` for this.** Parts of `server/pkg/db/generated/` are
> hand-edited and regenerating churns roughly 900 lines and breaks the build.
> Add the generated functions to
> [integration.sql.go](server/pkg/db/generated/integration.sql.go) by hand,
> matching the surrounding style.

`skill.config.origin` gains a variant. No migration, it is JSONB:

```json
{
  "origin": {
    "type": "aicoach",
    "source_url": "https://aicoach.pw/skills/acme/deploy-reviewer",
    "publisher": "acme",
    "slug": "deploy-reviewer",
    "semver": "1.4.0",
    "sha256": "9f2b…",
    "pricing": "one_time",
    "imported_by_account": "johnefemer"
  }
}
```

## Server design

### Provider

`server/internal/integration/aicoach/provider.go`:

| Method | Behavior |
|---|---|
| `Name()` | `"aicoach"` |
| `OAuthStartURL(state, redirectURI)` | `{base}/connect?client_id=…&redirect_uri=…&state=…` |
| `ExchangeCode(ctx, code, redirectURI)` | `POST {base}/api/v1/oauth/token`, maps `api_key` to `TokenResult.AccessToken`, leaves `RefreshToken` empty and `TokenExpiresInSec` zero |
| `FetchAccount(ctx, token)` | `GET {base}/api/v1/me` with the bearer key |
| `VerifyWebhook` / `HandleEvent` | return `errors.New("aicoach: webhooks not supported")` |

`FetchAccount` has a wrinkle: `/api/v1/me` returns `{ displayName, username }`
and no stable identifier, while `integration_connection.provider_account_id` is
`NOT NULL`. v1 stores `username` there and notes it in the code. Getting a
numeric `id` added to that response is on the cross-repo list below.

The callback URL is built by
[`oauthCallbackURL`](server/internal/handler/integration.go) as
`{APP_URL}/auth/aicoach/callback`, and every deployment origin using it has to be
in the partner app's registered `redirect_uris`, since AI Coach compares them
exactly.

### URL detection

`detectImportSource` gains `sourceAICoach` for hosts `aicoach.pw` and
`www.aicoach.pw`. A new `parseAICoachURL` returns
`{ kind: curated | community, publisher, slug }` from the path, rejecting
anything that is not `/skills/<slug>` or `/skills/<publisher>/<slug>`. The
existing bare-slug fallback keeps defaulting to ClawHub, unchanged.

### Fetch pipeline

```
POST /api/skills/import { url }
  ├── curated  → GET {base}/api/v1/skills/{slug}            (anonymous)
  │              GET {skillMdUrl}                           → SKILL.md only
  └── community→ load connection (workspace, aicoach, importer)
                 no connection?  → 428 aicoach_not_connected
                 GET {base}/api/skills/{publisher}/{slug}/download
                     Authorization: Bearer <api_key>
                 → tar.gz → verify sha256 against X-Skill-Sha256
                          → untar → SKILL.md + supporting files
  → parseSkillFrontmatter for name/description (fallback: slug)
  → createSkillWithFiles(config.origin = {…})
```

Curated imports land as a single `SKILL.md` with no supporting files, because
that is all the public API exposes. Worth stating in the UI so nobody reports it
as data loss.

### Bundle extraction limits

`archive/tar` + `compress/gzip` (already used in
[update.go](server/internal/cli/update.go)). Every one of these is a hard reject,
not a warning:

- 5 MB compressed (AI Coach's own publish cap), 10 MB total decompressed.
- 200 entries maximum, 1 MB per file, matching `fetchRawFile`'s existing limit.
- Regular files only. Symlinks, hardlinks, devices and directories with content are skipped.
- Every path passes `validateFilePath` after cleaning.
- If every entry shares one leading directory component, strip it, since publish bundles are commonly rooted at `<slug>/`.
- SHA-256 of the received bytes must equal `X-Skill-Sha256`. Mismatch aborts the import rather than storing unverified content.

### Error mapping

`writeError` only emits `{"error": "..."}`, which is not enough for the dialog to
render the right call to action. Add a local helper in `skill.go` that also
carries a code and an optional URL. This is additive and does not touch the
global helper.

| Condition | HTTP | `code` | Client behavior |
|---|---|---|---|
| No connection for this user | 428 | `aicoach_not_connected` | Inline "Connect AI Coach" button |
| AI Coach returns 401 | 428 | `aicoach_token_invalid` | Same, plus mark connection `status = 'error'` |
| AI Coach returns 402 | 402 | `purchase_required` | "Buy on AI Coach" linking to `action_url` |
| AI Coach returns 404 | 404 | `skill_not_found` | "Not found, or private to another account" |
| AI Coach returns 451 | 451 | `skill_taken_down` | Show the moderation reason |
| Bundle fails verification | 502 | `bundle_invalid` | Generic retry message |
| Name already taken | 409 | `name_conflict` | Existing copy, unchanged |

428 rather than 401 is deliberate: a 401 from our own API means the Multica
session is dead, and the web client already reacts to that by bouncing to login.

## Frontend design

All of it lives in [packages/views/](packages/views), no app-specific code.

**Import dialog** ([create-skill-dialog.tsx](packages/views/skills/components/create-skill-dialog.tsx)):
add a third `SourceCard` for AI Coach (`aicoach.pw/publisher/skill`), extend
`detectUrlSource` with `"aicoach"`, and update the chooser copy from "ClawHub or
Skills.sh" to include AI Coach. When the pasted URL is a community AI Coach URL
and `code === "aicoach_not_connected"` comes back, render an inline connect
prompt instead of the plain error block, sending the user to
`/auth/aicoach/start?workspace={slug}` and restoring the typed URL on return.

**Integrations page** ([integrations-page.tsx](packages/views/integrations/integrations-page.tsx)):
a new `CATALOG` entry keyed `aicoach`, category `Dev`. Its card has to read
differently from GitHub and Slack, because the connection is personal: it shows
the connected AI Coach account of the *current user*, and disconnect only
detaches that member's account. The Connect button gates on `aicoach_client_id`
being present in `/api/config`, mirroring how Slack gates on `slack_client_id`
([config.go](server/internal/handler/config.go)).

**Skill detail** ([origin.ts](packages/views/skills/lib/origin.ts)): add
`"aicoach"` to `OriginInfo["type"]` plus the new fields, and render a provenance
line with publisher, version, and a "Paid" badge when `pricing` is `one_time`.

## Security and licensing

- **Paid content is copied into our database.** Once imported, a paid skill's text sits in `skill_file` and is served to every agent runtime the workspace runs, including local daemons on member machines, via `LoadAgentSkills`. That is inherent to how skills work here, and it is the thing to be explicit about with AI Coach before shipping: does one purchase licence a workspace, or a person? v1 assumes workspace use is acceptable because the purchaser deliberately imported it, and records `imported_by_account` so the provenance is not lost. Confirm before launch.
- **No re-export.** Do not add "export skill" or "publish to ClawHub" affordances for skills whose origin is a paid AI Coach import.
- **Tokens are plaintext.** `integration_connection.access_token` is unencrypted today, and an AI Coach API key is broader than a scoped OAuth token: `web:account` reaches account endpoints, not just skill downloads. This raises the value of that column, and application-level encryption for it should be scheduled independently of this RFC.
- **Private skills return 404, not 403.** Pass that through as "not found" and do not say "you do not have access", which would confirm the skill exists.
- **SSRF.** Only the fixed `AICOACH_BASE_URL` host is ever contacted. The `skillMdUrl` from the curated response is validated to be same-origin with that base before it is fetched.

## Cross-repo work items (AI Coach side)

None of these block v1, but each removes a workaround:

1. **Add a stable id to `GET /api/v1/me`.** Today it returns display name and GitHub username only, so `provider_account_id` has to store a mutable username.
2. **Honor requested scopes in the connect exchange.** `exchangeAuthCode` issues every partner key with `web:account`. It should accept a `scope` parameter through authorize and token, and issue keys limited to something like `purchases:read`, which is already in the scope vocabulary. A skill importer should not hold an account-wide key.
3. **Enforce scopes on the download route.** It currently checks `locals.user` only, so any key works regardless of scope.
4. **A JSON detail endpoint for community skills**, e.g. `GET /api/skills/{publisher}/{slug}`, returning name, description, pricing, visibility and latest semver without downloading the bundle. It would let us show a confirmation step before import and give a cheap "is this paid" probe.
5. **Register Multica's redirect URIs** on the partner app for every deployment origin.

## Phasing

| Phase | Contents |
|---|---|
| 1 | URL detection, curated import, origin metadata for aicoach plus the ClawHub and Skills.sh backfill, UI source card. No auth, no schema change. |
| 2 | Provider, migration 069, member-level connect, community import through the download endpoint, structured error codes, connect prompt in the dialog. |
| 3 | Integrations page card, per-user connection display, paid and version badges on skill detail. |
| 4 | Update detection: compare recorded semver against the latest published, offer re-import. |

Phase 1 ships something useful on its own and carries no schema risk, which is
why it is split out.

## Testing

- **Go, `server/internal/handler/`**: extend the existing pattern in [skill_test.go](server/internal/handler/skill_test.go), which points a rewriting `http.Transport` at an `httptest` server. Add `aicoach.pw` to the rewritten host set and cover: curated fetch, community fetch with a valid bundle, sha256 mismatch, oversized and over-count bundles, path traversal entries, leading-directory stripping, and each of 401 / 402 / 404 / 451 mapping to the right code.
- **Go, provider**: `ExchangeCode` mapping `api_key` onto `TokenResult`, `FetchAccount` parsing, webhook methods erroring.
- **Views, `packages/views/skills/`**: `detectUrlSource` recognizing all three hosts, and the dialog rendering the connect prompt on `aicoach_not_connected` rather than a bare error. Mock `@multica/core/api`, never `next/*`.
- **E2E**: skipped. It needs a live AI Coach account with a purchase, which is not reproducible in CI.

## Environment variables

```bash
# AI Coach integration
# Required to enable the AI Coach tile and the authenticated import path. When
# AICOACH_CLIENT_ID is unset the provider is not registered, and AI Coach
# imports fall back to public curated skills only.
AICOACH_CLIENT_ID=
AICOACH_CLIENT_SECRET=
# Override only for staging against a non-production AI Coach.
AICOACH_BASE_URL=https://aicoach.pw
```

`AICOACH_CLIENT_ID` is echoed by `/api/config` as `aicoach_client_id` so the web
and desktop clients can gate the Connect button without a round trip.

## Open questions

- **Licence semantics for a purchased skill inside a shared workspace.** Needs an answer from the AI Coach side before phase 2 ships. If it turns out to be per-seat, the import has to become per-agent or carry a licence token, which changes the storage model.
- **Self-hosted installs.** They cannot use our registered `client_id` because `redirect_uri` is exact-matched. Dynamic client registration at startup is the obvious fix, and it means holding a `client_id` in local state and using PKCE instead of a client secret. Worth doing, but it is a phase of its own.
- **What happens on disconnect.** Skills already imported stay, since they are copies. Should the UI mark them as "imported by an account no longer connected"? Leaning no for v1, on the grounds that it is noise.
- **Multiple AI Coach accounts per user.** One row per `(workspace, provider, user)` allows exactly one. Nobody has asked for more.
