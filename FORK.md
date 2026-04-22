# Fork Workflow — kensink

This repo is a fork of [multica-ai/multica](https://github.com/multica-ai/multica).
This document explains how to stay in sync with upstream and how to add custom
features without creating rebase conflicts.

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Tracks upstream. **Never commit custom code here.** Pull-only from upstream. |
| `kensink` | **Your working branch.** All custom work lives here. Rebased on top of `main`. |
| `kensink/feature-*` | Short-lived feature branches. Merge into `kensink`. |

```
upstream/main  ──A──B──C──D──E──
                              \
kensink        ──A──B──C──D──E──[your commits]
```

---

## Syncing with Upstream

Pull the latest upstream changes and rebase your work on top:

```bash
# One command — fetches upstream and rebases kensink
make upstream-sync

# After resolving any conflicts:
git push origin kensink --force-with-lease
```

Under the hood this runs:
```bash
git fetch upstream
git rebase upstream/main
```

> `--force-with-lease` is safe — it refuses to push if someone else pushed to
> `kensink` on origin since your last fetch, protecting against accidental overwrites.

---

## How to Add New Features Without Rebase Conflicts

The golden rule: **write new files, don't edit upstream files.**

Upstream files get updated in every sync. The more you edit them, the more
conflicts you get. The strategy below avoids that entirely.

### 1. Adding new pages / components

Put them in a new subdirectory rather than inside an existing upstream directory:

```
packages/views/kensink/        ← your new shared views
apps/web/app/(kensink)/        ← your Next.js routes
server/internal/kensink/       ← your Go handlers
```

### 2. Extending existing behavior (Go)

Create a new file in the same package that adds to, rather than modifies,
the existing file:

```go
// server/internal/handler/kensink_extras.go
// New routes added here — no edits to handler.go
package handler

func (h *Handler) RegisterKensinkRoutes(r chi.Router) {
    r.Get("/my-new-endpoint", h.myNewHandler)
}
```

Wire it in `main.go` (which you will edit minimally). Conflicts on `main.go`
are easy to resolve since the diff is small.

### 3. Extending existing behavior (Next.js / TypeScript)

Prefer adding a new file that re-exports and wraps rather than editing the
original:

```ts
// apps/web/app/(kensink)/my-feature/page.tsx  ← new file
// Imports from upstream packages are fine — they won't conflict
import { SomeUpstreamComponent } from "@multica/views/some-feature";
```

### 4. Environment / config overrides

Never edit `.env.example` (it's upstream). Keep custom config in:

```
.env.agenthost     ← committed, no secrets — documents agenthost-specific vars
.env               ← not committed (in .gitignore) — real values on the server
```

### 5. Makefile additions

The `Makefile` is edited minimally — only for new top-level targets appended
after the upstream block. New targets are isolated and very unlikely to conflict.

---

## Conflict Resolution Cheat-Sheet

When `make upstream-sync` hits a conflict:

```bash
# See what conflicts exist
git status

# Open each conflicted file, resolve, then:
git add <file>
git rebase --continue

# If you want to abort and go back to where you were:
git rebase --abort
```

Keep your diffs small. If a conflict appears on an upstream file you edited,
consider whether that edit can be extracted to a new file instead — then you
never see that conflict again.

---

## Deploying to agenthost

See `scripts/agenthost-setup.sh` for first-time server provisioning and
`scripts/agenthost-deploy.sh` for rolling deploys.

Quick deploy via GitHub Actions:
1. Go to **Actions → Deploy to agenthost → Run workflow**
2. Branch: `kensink`
3. Type `deploy` in the confirm box → click **Run workflow**

Manual deploy from your machine:
```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "bash /opt/multica/scripts/agenthost-deploy.sh"
```

---

## Required GitHub Secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `AGENTHOST_SSH_KEY` | Full contents of `~/.ssh/agenthost.pem` |
| `AGENTHOST_IP` | `54.82.211.103` |
