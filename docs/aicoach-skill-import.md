# RFC: AI Coach skill import

Status: Proposed. AI Coach side validated 2026-08-20, and five of its work
items shipped on 2026-08-25 (commits `10f1ab7`, `186bcf4`, live in production).
No Agenthost code written yet. Two AI Coach items still block: the partner app
registration and production test fixtures. See [Validation](#validation) for
what is proven, [What AI Coach shipped](#what-ai-coach-shipped-2026-08-25) for
the contract changes, and [Development path](#development-path) for the
breakdown.

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

### Latent issues this RFC has to handle

A second read of the integration code turned up three things that are harmless
while every provider is workspace-wide, and stop being harmless the moment a
per-user provider exists. They are not hypothetical, they are work items.

1. **`ListIntegrations` returns every row in the workspace.** It calls `ListIntegrationConnections(ctx, wsID)` with no user filter. Once user-scoped rows exist, every member sees every other member's connected AI Coach account name and avatar.
2. **`DisconnectIntegration` keys on `(workspace_id, provider)` with no role check and no user filter.** Any member could disconnect another member's account. `SetIntegrationError` has the same shape and would clobber the wrong row.
3. **`UpsertIntegrationConnection` uses `ON CONFLICT (workspace_id, provider)`.** Postgres matches that inference against a *total* unique index. Once the constraint is replaced by two partial indexes, the existing statement stops resolving and needs an index predicate.

Separately, and outside the strict scope of this RFC: the Connect button sets
`window.location.href` to the relative path returned by
`api.getGitHubOAuthURL` / `getSlackOAuthURL`
([client.ts](packages/core/api/client.ts)). That works on web, where
[next.config.ts](apps/web/next.config.ts) rewrites `/auth/:path*` to the
backend. On desktop the renderer has no such origin, so integration connect is
effectively broken there today. GitHub and Slack are admin-only so it has gone
unnoticed. AI Coach is member-level, so desktop users will hit it immediately,
which is why the development path includes fixing it.

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

- `GET /api/skills/manifest?refs=<publisher>/<slug>,...` is the resolver, added in `e6c4e6e` explicitly for "external agent hosts (Multica, CI jobs, any mirror)". Up to 100 refs per call. Anonymous callers get a public answer cached for a minute; authenticated callers get their own private skills resolved plus an `owned` flag, uncached. A key without `skills:read` is treated as anonymous rather than refused. Per skill it returns `name`, `description`, `isPaid`, `priceCents`, `version`, `sha256`, `revision`, `contentUrl`, `contentType` (`markdown` or `bundle`), `requiresAuth` and `detailUrl`. A bare slug resolves against publisher `aicoach`, which is where curated skills live. Private, taken-down and unknown refs all come back as `found: false`, so it never leaks existence.
- `GET /api/v1/skills/<slug>` returns curated metadata plus a `skillMdUrl` pointing at `/skills-md/<slug>.md`. Public, CORS-open, and it exposes SKILL.md only, no supporting files. Superseded by the manifest for our purposes.
- `GET /api/skills/<publisher>/<slug>/download?version=<semver>` streams the community skill bundle. This is the endpoint that matters. Auth comes from the standard middleware, which populates `locals.user` from a session cookie or from `Authorization: Bearer <api_key>` on `/api/` paths. Since 2026-08-25 an API-key caller must also carry the `skills:read` scope or the route answers 403 `insufficient_scope`.

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

## Validation

Run before writing any Agenthost code, against production and against the AI
Coach source at `/Users/imran/htdocs/omazy/aicoach`.

| Check | Result |
|---|---|
| `GET /api/skills/manifest?publisher=aicoach` | 200, 231 skills |
| `GET /api/skills/manifest?refs=code-review-coach,johnefemer/does-not-exist` | 200, resolved one, `found:false` on the other |
| `GET /api/v1/skills/code-review-coach` | 200 with `skillMdUrl` |
| `GET /skills-md/code-review-coach.md` | 200 `text/markdown`, real frontmatter |
| `GET /api/skills/<pub>/<slug>/download` unauthenticated | 401 from `download.ts` itself, so the route is deployed and gating |
| `GET /api/v1/me` unauthenticated | 401 |
| `GET /connect?client_id=bogus&…` | consent page renders, answers "Unknown or inactive application", so `partner_apps` exists in production |
| `POST /api/v1/oauth/token` with a bad code | `{"error":"invalid_grant"}`, 400 |
| `OPTIONS /api/v1/oauth/register` | 204, dynamic registration is live |
| R2 binding `SKILL_BUNDLES` | present in `wrangler.toml` |
| `user_skills` in production D1 | exists, `browse?origin=user` returns 200 |
| Publish produces a real bundle | `build.ts` calls `publishAuthoredVersion`, which packs, uploads to R2 and finalizes |
| Purchase unlocks download | covered by their own `e2e/specs/webhook.fresh.spec.ts` |

**Tar round-trip, the one that mattered.** The bundle writer in
`src/lib/skills/bundle.ts` is hand-rolled ustar, written by hand because the
Workers runtime has no archiver, and nothing on their side had read it back with
a real tar implementation. Built a bundle with their own `buildSkillBundle`
through `tsx`, then read it with Go's `archive/tar`:

```
ok  typeflag='0'  size=72  format=USTAR  name=SKILL.md
ok  typeflag='0'  size=25  format=USTAR  name=references/api.md
entries read: 3
```

Valid gzip, valid ustar, correct checksums, **flat paths with no leading
directory**, readable by both `bsdtar` and Go. The Go extraction in PR4 will
work.

### What is not proven

Items 3 and 5 from the first pass were fixed on the AI Coach side on 2026-08-25.
These three remain.

1. **No community skill has ever been published in production.** `browse?origin=user` still returns `total: 0`. The download endpoint, the paywall and the bundle path have run in their local e2e suite and never against prod data. One free, one paid and one private fixture is a prerequisite for PR4, not a nice-to-have.
2. **No partner app exists for Agenthost yet.** `client_id=bogus` proves the lookup works, nothing more. Until the app is registered with both redirect URIs and `allowed_scopes`, PR3 cannot be finished.
3. **Bearer-key download against production is still unverified.** Their e2e now covers it locally, and the local seed bug that was masking it is fixed, but nothing has exercised the path against the deployment. An attempt from this side got a clean 401: the `AICOACH_API_KEY` in the shell environment hashes to a row that does not exist in production D1, so it is a local dev key, not a production one. Run this once a production key exists, before PR3:

   ```bash
   curl -sD- -o /dev/null -H "Authorization: Bearer $AICOACH_KEY" \
     https://aicoach.pw/api/skills/<publisher>/<slug>/download
   ```

   200 with `X-Skill-Sha256` means the premise holds. A 403 `insufficient_scope`
   means the key lacks `skills:read`, which is a key problem, not a design
   problem. Anything else means this design needs revisiting.

## What AI Coach shipped, 2026-08-25

Five items from the handoff landed and are live. Each one changes what Agenthost
has to build, so read this before the decisions below.

| Shipped | Effect here |
|---|---|
| `/api/v1/me` returns a stable `id` | `provider_account_id` stores the integer id, not a mutable and sometimes-null username. The `username` fallback plan is dead. |
| Partner Connect keys carry scopes | The connect start URL **must** request `scope=skills:read`, and the app's `allowed_scopes` caps what it can ever ask for. |
| `download` enforces `skills:read` | A key without it gets 403 `insufficient_scope`, not 401. New error path. |
| Manifest accepts a key | A private skill now resolves for its owner, and paid entries carry `owned: true|false`. This deletes the blind-download fallback D7 described. |
| `GET /api/v1/purchases` | Scope `purchases:read`. Makes a "your AI Coach library" picker possible instead of URL paste. |

**The landmine.** `resolveGrantedScopes` returns `null` when no `scope` is
requested, and a null scope means the issued key falls back to `web:account`.
So if Agenthost's `OAuthStartURL` omits `scope`, the connect flow succeeds, the
integrations page shows a healthy green connection, and then **every single
import fails at download with 403**. The failure is far from its cause. Assert
on the granted scope at connect time rather than discovering it at first import.
Both `/api/v1/oauth/authorize` and `/api/v1/oauth/token` echo back the `scope`
actually granted, which can be narrower than what was asked for, so
`ExchangeCode` can check it without a second request.

Two things worth noting from how they got there. Their B4 work found that the
seeded `user_skill_versions` rows carried a fake `sha256` pointing at R2 objects
that were never created, so every seeded download returned 404 `bundle_missing`.
That is exactly the failure the weak `not.toBe(402)` assertion was hiding, and
it is the same failure mode [Bundle extraction limits](#bundle-extraction-limits)
guards against on our side: verify the digest, never store unverified content.
Their scope enforcement also covers key creation, not just reads, which closes
the hole where a narrow key could `POST /api/publisher/keys` and mint itself a
wide one. Broader `/api/publisher/*` and `/api/account/*` enforcement is
deliberately not done on their side, so a `skills:read` key is narrow where it
matters and not yet narrow everywhere.

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

**D7. Resolve through the manifest, then follow `contentUrl`.** `/api/skills/manifest`
already exists and was built for exactly this. One unauthenticated call turns a
pasted URL into name, description, paid or free, price, version, digest and
where the content lives, before any credential is involved. Multica does not
hardcode which URL shape needs auth, the manifest's `requiresAuth` says so.
Frontmatter via [`parseSkillFrontmatter`](server/internal/handler/skill.go)
stays as the fallback when a bundle's metadata disagrees or the manifest is
unreachable.

The manifest now accepts a key, so send one whenever the importer has a
connection. An authenticated resolve returns the caller's own private skills and
adds `owned: true|false` on paid entries, which means the import dialog can say
"you already own this" or "this costs $5" before anything is downloaded. A key
lacking `skills:read` is treated as anonymous rather than refused, so sending it
is always safe.

With that, `found: false` on an authenticated resolve is a terminal answer and
the blind-download fallback this section used to describe is gone. It survives
in one narrow case only: the importer has no connection at all, where a
`found: false` two-segment ref may still be a private skill they own. That path
ends at the connect prompt anyway, so no special handling.

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

**D10. Version is pinned and recorded, updates are manual for now.** The import
records `X-Skill-Semver`, `X-Skill-Sha256` and the manifest's `revision` token.
Update detection then costs one batched manifest call for up to 100 skills and
zero downloads, which makes it cheap enough to schedule sooner than originally
planned.

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

Query changes in [integration.sql](server/pkg/db/queries/integration.sql):

| Query | Change |
|---|---|
| `UpsertIntegrationConnection` | `ON CONFLICT (workspace_id, provider) WHERE connection_scope = 'workspace'`. A bare `ON CONFLICT (workspace_id, provider)` no longer infers an index once the total unique constraint is gone. |
| `UpsertUserIntegrationConnection` | New. Inserts with `connection_scope = 'user'` and `ON CONFLICT (workspace_id, provider, connected_by) WHERE connection_scope = 'user'`. |
| `GetUserIntegrationConnection` | New. Workspace + provider + `connected_by`, `disconnected_at IS NULL`. |
| `ListIntegrationConnections` | Add a `@user_id` parameter and `AND (connection_scope = 'workspace' OR connected_by = @user_id)`, so user-scoped rows never leak across members. |
| `DisconnectUserIntegrationConnection` | New. Same as `DisconnectIntegration` plus `connected_by = @connected_by`. |
| `SetUserIntegrationError` | New. Same as `SetIntegrationError` plus `connected_by = @connected_by`, used when AI Coach answers 401. |

`IntegrationConnectionResponse` ([integration.go](server/internal/handler/integration.go))
gains `connection_scope`, and so does `IntegrationConnection` in
[integration.ts](packages/core/types/integration.ts), so the UI can tell a
personal connection from a workspace one without hardcoding the provider name.
`IntegrationProvider` in the same file gains `"aicoach"`.

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
| `OAuthStartURL(state, redirectURI)` | `{base}/connect?client_id=…&redirect_uri=…&state=…&scope=skills:read` . Omitting `scope` silently yields a `web:account` key that cannot download. |
| `ExchangeCode(ctx, code, redirectURI)` | `POST {base}/api/v1/oauth/token`, maps `api_key` to `TokenResult.AccessToken`, leaves `RefreshToken` empty and `TokenExpiresInSec` zero |
| `FetchAccount(ctx, token)` | `GET {base}/api/v1/me` with the bearer key. Use `id` for `provider_account_id`, `username` and `displayName` for display, both nullable. |
| `VerifyWebhook` / `HandleEvent` | return `errors.New("aicoach: webhooks not supported")` |

`ExchangeCode` should record the granted scope on the connection row's `scope`
column and fail the connect loudly if `skills:read` is missing from it. A
connection that cannot download is not a connection, and finding that out at
import time turns a one-line config mistake into a support ticket.

The callback URL is built by `oauthCallbackURL`
([integration.go](server/internal/handler/integration.go)) from `appURL()`,
which reads `AGENTHOST_APP_URL` and falls back to `MULTICA_APP_URL`, then to the
request scheme and host. So the registered redirect is
`https://agenthost.pro/auth/aicoach/callback` in production and
`http://localhost:3000/auth/aicoach/callback` in dev. AI Coach compares
`redirect_uri` by exact string match against the partner app's registered list,
so every origin that will ever run this flow has to be registered up front.

### Handler changes

[integration.go](server/internal/handler/integration.go) learns the notion of a
provider scope. A small `providerScope(name string) string` helper returns
`"user"` for `aicoach` and `"workspace"` for everything else, and four call
sites branch on it:

- **`IntegrationOAuthCallback`**: workspace-scoped providers keep the `owner`/`admin` check; user-scoped providers require workspace membership only, and write through `UpsertUserIntegrationConnection` with `connected_by` set to the user recovered from the state cookie.
- **`ListIntegrations`**: passes the requesting user id so user-scoped rows are filtered to that member.
- **`GetIntegration`** and **`DisconnectIntegration`**: route to the user-scoped query when the provider is user-scoped, so one member cannot read or revoke another's connection.

The state cookie already carries the user id across the redirect, so no new
mechanism is needed for identity. The 10 minute state TTL is unchanged.

### URL detection

`detectImportSource` gains `sourceAICoach` for hosts `aicoach.pw` and
`www.aicoach.pw`. `parseAICoachRef` reduces the path to the ref the manifest
speaks: `/skills/<slug>` becomes `<slug>`, `/skills/<publisher>/<slug>` becomes
`<publisher>/<slug>`, anything else is rejected. Deciding curated versus
community is not our job, the manifest's `contentType` and `requiresAuth`
answer it. The existing bare-slug fallback in `detectImportSource` keeps
defaulting to ClawHub, unchanged.

### Fetch pipeline

```
POST /api/skills/import { url }
  │
  ├─ parseAICoachRef(url) → "<publisher>/<slug>" or bare "<slug>"
  ├─ load connection (workspace, aicoach, importer)   [may be absent]
  ├─ GET {base}/api/skills/manifest?refs=<ref>
  │     with the key when connected  → private skills resolve, `owned` present
  │     without                      → public answer, cached 60s
  │
  ├─ found && contentType=markdown  (curated, requiresAuth=false)
  │     └─ GET contentUrl → SKILL.md, single file
  │
  ├─ found && contentType=bundle    (community)
  │     ├─ isPaid && !owned → 402 purchase_required, with price and detailUrl
  │     ├─ no connection    → 428 aicoach_not_connected
  │     └─ GET contentUrl  Authorization: Bearer <api_key>
  │        → tar.gz → sha256 vs X-Skill-Sha256 → untar
  │
  └─ !found → 404 skill_not_found

  → name/description from the manifest, frontmatter as fallback
  → createSkillWithFiles(config.origin = {…, revision})
```

Curated imports land as a single `SKILL.md` with no supporting files, because
that is all `/skills-md/` exposes. Worth stating in the UI so nobody reports it
as data loss.

### Bundle extraction limits

`archive/tar` + `compress/gzip` (already used in
[update.go](server/internal/cli/update.go)). Every one of these is a hard reject,
not a warning:

- 5 MB compressed (AI Coach's own publish cap), 10 MB total decompressed.
- 200 entries maximum, 1 MB per file, matching `fetchRawFile`'s existing limit.
- Regular files only. Symlinks, hardlinks, devices and directories with content are skipped.
- Every path passes `validateFilePath` after cleaning.
- If every entry shares one leading directory component, strip it. Bundles built by AI Coach's own writer are flat, verified by round-tripping one through Go's `archive/tar`, but the `PUT /versions/:semver/bundle` route accepts a client-produced tarball that could be rooted anywhere.
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
| AI Coach returns 403 `insufficient_scope` | 428 | `aicoach_scope_missing` | "Reconnect AI Coach to grant skill access". Distinct from a dead key: the credential is valid, the grant is too narrow. Read `required_scope` from the body, or the `WWW-Authenticate` header. |
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
the connected AI Coach account of the *current user*, disconnect detaches only
that member's account, and the card is not gated on `canManage`, which currently
disables Connect for non-admins. The Connect button gates instead on
`aicoach_client_id` being present in `/api/config`, mirroring how Slack gates on
`slack_client_id`. That means adding `AICoachClientID` to `AppConfig`
([config.go](server/internal/handler/config.go)) and to the inline config type
in [client.ts](packages/core/api/client.ts).

There is a second integrations surface,
[integrations-tab.tsx](packages/views/settings/components/integrations-tab.tsx),
with its own `PROVIDERS` map. It needs the same entry. The duplication predates
this work and folding the two catalogs into one shared definition would be the
right cleanup, but it is not a prerequisite and should not be smuggled into this
change.

**Connect handoff.** `handleConnect` hardcodes two providers and assigns a
relative URL to `window.location.href`. It becomes a shared helper that takes
the provider key, and branches by platform: web keeps the same-origin
navigation, desktop opens the absolute backend URL through `openExternal`
([open-external.ts](packages/views/platform/open-external.ts)) and waits for the
deep link back.

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

**Still blocking.** PR3 and PR4 cannot be finished without these two:

1. **Register a partner app for Agenthost** with `https://agenthost.pro/auth/aicoach/callback` and `http://localhost:3000/auth/aicoach/callback` in `redirect_uris`, `allowed_scopes` of `skills:read,purchases:read`, and hand over the `client_id` and `client_secret`. `redirect_uri` is exact-matched, so every origin that will ever run the flow has to be listed up front.
2. **Publish test fixtures in production.** One free, one paid, one private, under a known publisher handle. `browse?origin=user` is still `total: 0`, so there is nothing to import and no way to exercise the paywall against the real deployment.

**Shipped 2026-08-25**, see [What AI Coach shipped](#what-ai-coach-shipped-2026-08-25):

3. ~~Stable id on `/api/v1/me`~~. Done in `10f1ab7`.
4. ~~Scopes honored through the connect exchange~~. Done in `186bcf4`, with `skills:read` added to the vocabulary and an `allowed_scopes` ceiling per app.
5. ~~Scope enforcement on download~~. Done, plus on key creation, which is the one that mattered: without it a narrow key could mint itself a wide one.
6. ~~Tar path truncation~~. Fixed with a ustar `prefix` split.
7. ~~Two paywalls~~. `download.ts` now routes through `canAccess`.
8. ~~Weak unlock assertion~~. Now asserts 200, gzip bytes, and a digest matching the row. Fixing it turned out to require fixing the seed, which had been writing version rows with a fake `sha256` pointing at R2 objects that were never created.

## Development path

Eight changes, each one landable on its own. The ordering exists because of two
hard dependencies: nothing authenticated works before the schema and the
provider are in, and the UI cannot show a real error state before the server
emits structured codes.

```
PR1 curated import ──────────────────────────────┐
                                                 ├── PR7 provenance UI
PR2 schema ── PR3 provider ── PR4 auth import ───┤
                    │              └── PR5 import dialog gate
                    └── PR6 desktop connect (parallel)
                                                  PR8 update detection (later)
```

PR1 and PR6 are independent of everything else and can start immediately. PR2
through PR5 are a chain.

### PR1: AI Coach URL detection and curated import

No auth, no schema, ships value on its own.

| File | Work |
|---|---|
| [skill.go](server/internal/handler/skill.go) | `aicoachBaseURL()` reading `AICOACH_BASE_URL` with the `https://aicoach.pw` default. `sourceAICoach` in `detectImportSource`. `parseAICoachRef` turning a URL into a `<publisher>/<slug>` ref. `resolveAICoachManifest(ref)` hitting `/api/skills/manifest`. `fetchFromAICoachMarkdown` following `contentUrl` when `contentType` is `markdown`, validating it is same-origin with the base. |
| [skill.go](server/internal/handler/skill.go) | `ImportSkill` builds a `config.origin` for all three sources instead of passing `map[string]any{}`, which retires the "backend never writes this" note in origin.ts. |
| [skill_test.go](server/internal/handler/skill_test.go) | Add `aicoach.pw` to the rewriting transport host set. Cases: curated happy path, 404, malformed path, origin recorded. |
| [origin.ts](packages/views/skills/lib/origin.ts) | `"aicoach"` in `OriginInfo["type"]`, new fields, drop the stale NOTE comment. |
| [create-skill-dialog.tsx](packages/views/skills/components/create-skill-dialog.tsx) | Third `SourceCard`, `detectUrlSource` returns `"aicoach"`, chooser copy names all three sources, `submittingLabel` handles it. |

Done when: `https://aicoach.pw/skills/code-review-coach` imports and the skill
detail page shows where it came from. ClawHub and Skills.sh imports show their
origin too. The manifest resolver is exercised by both PR1 and PR4, so it lands
here where it is cheap to test.

Verify: `cd server && go test ./internal/handler/` and
`pnpm --filter @multica/views exec vitest run skills`.

### PR2: connection scope in the schema

Pure plumbing, no user-visible change, no new provider yet. Landing it alone
keeps the migration reviewable and keeps a regression in GitHub or Slack from
being attributed to AI Coach work.

| File | Work |
|---|---|
| `server/migrations/069_integration_connection_user_scope.{up,down}.sql` | Column plus the two partial unique indexes, and the reverse. |
| [integration.sql](server/pkg/db/queries/integration.sql) | The six query changes in [Schema](#schema). |
| [integration.sql.go](server/pkg/db/generated/integration.sql.go) | Hand-written, matching the surrounding style. **Do not run `make sqlc`.** |
| [integration.go](server/internal/handler/integration.go) | `providerScope()` helper, scope branching in callback, list, get and disconnect. `connection_scope` on the response. |
| [integration.ts](packages/core/types/integration.ts) | `connection_scope` on `IntegrationConnection`, `"aicoach"` in `IntegrationProvider`. |
| `server/internal/handler/integration_test.go` | Two members hold independent user-scoped rows. `ListIntegrations` hides the other member's. Disconnect cannot touch it. GitHub upsert still overwrites in place. |

Done when: `make migrate-up` is clean, existing GitHub and Slack connect and
disconnect flows behave exactly as before, and the new tests pass.

Verify: `make migrate-up && make migrate-down && make migrate-up`, then
`cd server && go test ./internal/handler/`.

### PR3: the AI Coach provider and connect flow

| File | Work |
|---|---|
| `server/internal/integration/aicoach/provider.go` | The five interface methods from [Provider](#provider). |
| `server/internal/integration/aicoach/provider_test.go` | `ExchangeCode` maps `api_key` onto `AccessToken` with no expiry, `FetchAccount` parses `/api/v1/me`, webhook methods error. |
| [router.go](server/cmd/server/router.go) | Register when `AICOACH_CLIENT_ID` is set, Slack's pattern. |
| provider + callback | Request `scope=skills:read` at authorize, then assert it came back in the granted scope before writing the connection row. A connection without it looks healthy and fails at every import. |
| [config.go](server/internal/handler/config.go) | `aicoach_client_id` in `AppConfig`. |
| [client.ts](packages/core/api/client.ts) | `aicoach_client_id` in the config type, `getAICoachOAuthURL(wsSlug)`. |
| [.env.example](.env.example) | The block from [Environment variables](#environment-variables). |

Done when: a member completes the consent flow at aicoach.pw and lands back on
the integrations page with an `active` row carrying their AI Coach username.

Blocked on: the partner app existing on the AI Coach side with our redirect URIs
registered. Do that before starting the PR, not during review.

### PR4: authenticated community import

The core of the feature.

| File | Work |
|---|---|
| `server/internal/handler/skill_bundle.go` | `extractSkillBundle(r io.Reader, sha string)` doing gzip plus tar with every limit in [Bundle extraction limits](#bundle-extraction-limits). Separate file because it is self-contained and skill.go is already 1291 lines. |
| [skill.go](server/internal/handler/skill.go) | `fetchFromAICoachCommunity` loading the connection, calling the download endpoint with the bearer key, mapping status codes. `writeImportError(w, status, code, msg, actionURL)`. |
| [skill.go](server/internal/handler/skill.go) | On 401 from AI Coach, call `SetUserIntegrationError` so the integrations page reflects the dead key. |
| `server/internal/handler/skill_bundle_test.go` | Golden tarball fixtures: happy path, sha mismatch, oversized, too many entries, `../` traversal, symlink entry, shared leading directory stripped. |
| [skill_test.go](server/internal/handler/skill_test.go) | 401, 402, 404, 451 each map to the right code and status. Missing connection returns 428 without any outbound call. |

Done when: a purchased skill imports for the buyer, returns
`purchase_required` for anyone else, a private skill imports for its owner
through the `found:false` fallback path, and returns `skill_not_found` to
everyone else.

Blocked on cross-repo items 1 and 2. There is nothing published on AI Coach to
test against today, so this PR cannot be verified against production until the
fixtures exist.

### PR5: import dialog connect gate

| File | Work |
|---|---|
| [create-skill-dialog.tsx](packages/views/skills/components/create-skill-dialog.tsx) | Read `code` off the error body. `aicoach_not_connected` and `aicoach_token_invalid` render an inline connect prompt, `purchase_required` renders a buy link to `action_url`. Preserve the typed URL across the round trip, sessionStorage keyed on the workspace is enough. |
| [client.ts](packages/core/api/client.ts) | `importSkill` surfaces the structured body instead of flattening it to a message string. |
| `packages/views/skills/components/create-skill-dialog.test.tsx` | Each code renders its own affordance. Mock `@multica/core/api`, never `next/*`. |

Done when: pasting a community URL with no connection shows "Connect AI Coach",
and after the round trip the import runs without retyping the URL.

### PR6: desktop connect path

Independent of the rest, and it fixes GitHub and Slack on desktop at the same
time.

| File | Work |
|---|---|
| [index.ts](apps/desktop/src/main/index.ts) | Handle `multica://integrations/connected?provider=<name>` in `handleDeepLink`, alongside the existing `auth/callback` and `invite` cases, and forward to the renderer over IPC. |
| `apps/desktop/src/preload` + renderer | Surface the event, invalidate the integrations query, toast the result. |
| [integrations-page.tsx](packages/views/integrations/integrations-page.tsx) | `handleConnect` branches: web navigates same-origin, desktop calls `openExternal` with the absolute backend URL. |
| [integration.go](server/internal/handler/integration.go) | Accept a `client=desktop` hint on `/auth/{provider}/start`, carry it in the state cookie, and redirect the callback to `multica://integrations/connected?provider=…` instead of the web path. |

Done when: a desktop member connects AI Coach through the system browser and the
app reflects it without a restart.

### PR7: provenance UI

| File | Work |
|---|---|
| [skill-detail-page.tsx](packages/views/skills/components/skill-detail-page.tsx) | Origin line: publisher, version, source link, "Paid" badge when `pricing` is `one_time`. |
| [skills-page.tsx](packages/views/skills/components/skills-page.tsx) | Source badge in the list. |

### PR8: update detection (later)

Compare each skill's recorded `revision` against the manifest and offer
re-import where they differ. One batched call covers up to 100 skills and
downloads nothing, so this is far cheaper than it looked when the RFC was
first drafted. Worth scheduling once PR4 is in rather than leaving open-ended.

### What has to be true before PR3 starts

- **The bearer-key download probe returns 200.** The one command in [What is not proven](#what-is-not-proven). Everything downstream assumes it. Run it first, it costs a minute.
- The partner app exists with both redirect URIs registered, and we hold the client id and secret.
- Test fixtures are published on AI Coach: one free, one paid, one private.
- The licence question in [Open questions](#open-questions) has an answer. If a purchase turns out to be per-seat, PR4's storage model changes, so ask before building it.
- A stable id on `/api/v1/me` is either done or explicitly accepted as "store the username for now".

## Testing

- **Go, `server/internal/handler/`**: extend the existing pattern in [skill_test.go](server/internal/handler/skill_test.go), which points a rewriting `http.Transport` at an `httptest` server. Add `aicoach.pw` to the rewritten host set and cover: curated fetch, community fetch with a valid bundle, sha256 mismatch, oversized and over-count bundles, path traversal entries, leading-directory stripping, and each of 401 / 402 / 404 / 451 mapping to the right code.
- **Go, provider**: `ExchangeCode` mapping `api_key` onto `TokenResult`, `FetchAccount` parsing, webhook methods erroring.
- **Views, `packages/views/skills/`**: `detectUrlSource` recognizing all three hosts, and the dialog rendering the connect prompt on `aicoach_not_connected` rather than a bare error. Mock `@multica/core/api`, never `next/*`.
- **Go, bundle extraction**: `skill_bundle_test.go` with golden tarballs, listed under [PR4](#pr4-authenticated-community-import). These are the security-relevant tests, treat them as required, not nice to have.
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

- **Licence semantics for a purchased skill inside a shared workspace.** Needs an answer from the AI Coach side before PR4 starts. If it turns out to be per-seat, the import has to become per-agent or carry a licence token, which changes the storage model.
- **Self-hosted installs.** They cannot use our registered `client_id` because `redirect_uri` is exact-matched. Dynamic client registration at startup is the obvious fix, and it means holding a `client_id` in local state and using PKCE instead of a client secret. Worth doing, but it is its own piece of work, not a step in this one.
- **What happens on disconnect.** Skills already imported stay, since they are copies. Should the UI mark them as "imported by an account no longer connected"? Leaning no for v1, on the grounds that it is noise.
- **Multiple AI Coach accounts per user.** One row per `(workspace, provider, user)` allows exactly one. Nobody has asked for more.
