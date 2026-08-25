# AI Coach skill sync

Mirrors skills from the AI Coach registry (aicoach.pw) into a Multica workspace
and keeps them current.

## How it works

AI Coach publishes a revision per skill. `/api/skills/manifest` returns that
revision plus a content digest and location, so a sync can ask "did anything
change?" in one request per workspace and download only what moved.

Two kinds of skill live there and they are fetched differently:

| Kind | Content | Auth |
|---|---|---|
| Curated (`aicoach/<slug>`) | Markdown at a public URL | none |
| Published by a user (`<publisher>/<slug>`) | `.tar.gz` bundle | API key, plus a purchase for paid skills |

## Importing

`POST /api/skills/import` accepts AI Coach URLs alongside the existing
clawhub.ai and skills.sh sources:

```json
{ "url": "https://aicoach.pw/skills/ab-test-setup", "auto_sync": true }
```

Bare references work too: `ab-test-setup` resolves to the curated
`aicoach/ab-test-setup`, and `publisher/slug` addresses a published skill.

With `auto_sync: true` the skill is tracked and the background worker keeps it
up to date. Without it the import is a one-time copy that never changes again.

## Running the sync worker

Off by default, so an install that mirrors nothing makes no outbound requests.

| Variable | Purpose |
|---|---|
| `AICOACH_SYNC=1` | Enables the worker |
| `AICOACH_SYNC_INTERVAL` | Poll interval, any Go duration (default `1h`) |
| _(no env key)_ | Skills published by users need an API key connected per workspace in integration settings |
| `AICOACH_BASE_URL` | Points at a self-hosted registry (default `https://aicoach.pw`) |

## Behaviour worth knowing

- **Unchanged skills cost nothing.** Content is fetched only when the revision
  differs from the stored one.
- **A registry outage is not a per-skill failure.** Rows are left untouched and
  the next pass retries, rather than every tracked skill being flagged broken.
- **A skill that disappears upstream keeps its local copy.** Unpublishing marks
  it `sync_state = 'gone'`; it is not deleted, so an agent mid-task does not
  lose a skill under it.
- **Supporting files are replaced wholesale** on each pull, in one transaction,
  so a file deleted upstream disappears locally and a partial write cannot leave
  a half-updated set.
- **Paid skills need a purchase on the connected workspace's account.** Without
  one the fetch fails loudly instead of importing an empty skill.

## Provenance

Migration `069` adds `source`, `source_ref`, `source_url`, `source_rev`,
`auto_sync`, `synced_at`, `sync_state` and `sync_error` to `skill`. A unique
index on `(workspace_id, source, source_ref)` means a registry skill is mirrored
at most once per workspace, so re-importing updates in place.

## A note on the data layer

This package reads and writes those columns with direct pgx queries rather than
through the generated sqlc store. Regenerating in this repo currently rewrites
unrelated packages and breaks callers mid-refactor, so depending on it would
have made this feature impossible to land on its own. `Syncer` talks to a
`Store` interface, so swapping in the generated queries later is a change to
`store.go` alone.
