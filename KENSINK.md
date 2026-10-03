# KENSINK.md

Fork-specific guidance for the Kensink / Agenthost fork (johnefemer/multica).
Upstream's shared guidance lives in AGENTS.md; this file only covers what the
fork does differently. See FORK.md for the upstream sync workflow.

## Deployment

**Deploy with the local script over SSH. Never with GitHub Actions.**

Every workflow in `.github/workflows/` is disabled (`disabled_manually`), so a
push to `main` no longer builds, releases, or deploys anything. Do not
re-enable one to ship a change, and do not wait on a workflow run.

Production is `162.4.35.231` (`root`, key `~/.ssh/id_betopia`; add a `Host
agenthost` entry to `~/.ssh/config`). The checkout lives in
`/opt/apps/agenthost`; its untracked `.deploy.env` sets
`COMPOSE_FILES="docker-compose.selfhost.yml docker-compose.proxy.yml"`, and a
separate `proxy` compose project (nginx-proxy + acme-companion) terminates TLS.

```bash
ssh -i ~/.ssh/id_betopia root@162.4.35.231 'bash /opt/apps/agenthost/scripts/agenthost-deploy.sh'
```

**Back up the database before any deploy that adds migrations** — they run on
backend start and are one-way:

```bash
ssh -i ~/.ssh/id_betopia root@162.4.35.231 'cd /opt/apps/agenthost && \
  docker compose -f docker-compose.selfhost.yml -f docker-compose.proxy.yml exec -T postgres \
  sh -c "pg_dump -U \$POSTGRES_USER \$POSTGRES_DB" | gzip > backups/prod-$(date +%Y%m%d-%H%M%S).sql.gz'
```

**Push first.** The script does `git reset --hard origin/main`, so it
deploys what is on the remote, not your working tree.

**A push plus the script does not ship code on its own.** The compose stack runs
prebuilt images from GHCR, so the script only pulls the repo and restarts
containers on whatever image tag is already there. Config, compose, and env
changes take effect; Go and TypeScript changes do not. Anything touching
`server/` or the frontend needs the image rebuilt and pushed to GHCR *before*
the script runs:

```bash
# From the repo root. --platform is required: prod is x86_64, dev Macs are arm64.
docker buildx build --platform linux/amd64 -f Dockerfile \
  -t ghcr.io/johnefemer/multica-backend:kensink --push .
# The web image reads REMOTE_API_URL at runtime (compose sets it); the
# browser derives the WebSocket URL from its own origin.
docker buildx build --platform linux/amd64 -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_APP_VERSION=kensink \
  -t ghcr.io/johnefemer/multica-web:kensink --push .
```

Build on a dev machine and push to GHCR, so `:kensink` on GHCR always matches
what runs — the deploy script pulls it. The docs container
(`multica-docs:kensink`) has no Dockerfile in this repo; it is left as is.

**Verify, don't assume.** `agenthost-deploy.sh` prints "Deploy complete" as long
as `/health` answers, including when it restarted nothing. Confirm the container
was actually replaced:

```bash
ssh -i ~/.ssh/id_betopia root@162.4.35.231 \
  'cd /opt/apps/agenthost && docker compose -f docker-compose.selfhost.yml -f docker-compose.proxy.yml ps'
```

A `STATUS` of "Up 3 months" on the service you just changed means the new image
never landed. Backend migrations run from `docker/entrypoint.sh` on container
start, so a backend that was not recreated also did not migrate.

## CLI Release

**Prerequisite:** A CLI release must accompany every Production deployment.

Both release workflows (`release.yml`, `release-cli.yml`) are disabled along with
everything else in `.github/workflows/`, so **pushing a tag no longer publishes
anything** and the binaries behind the install URL go stale until someone builds
them. Build and upload locally instead.

Every release is a versioned, non-prerelease GitHub release `vX.Y.Z`, which
is what `agenthost update` and the daemon's auto-update read
(`/releases/latest`), plus a refresh of the rolling `kensink-latest`
pre-release that `scripts/kensink-install.sh` downloads. Bump the patch
version by default (`v0.6.2` → `v0.6.3`) unless the user specifies one. Keep
the fork at or above the upstream version it is synced to: the server compares
daemon CLI versions, and the updater only accepts a plain `X.Y.Z`.

```bash
VERSION=v0.6.3   # next version
cd server
for target in darwin/amd64 darwin/arm64 linux/amd64 linux/arm64; do
  GOOS=${target%/*} GOARCH=${target#*/} CGO_ENABLED=0 go build \
    -ldflags="-s -w -X main.version=${VERSION} -X main.commit=$(git rev-parse --short HEAD) -X main.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o ../bin/agenthost ./cmd/multica
  # CLIs built before v0.6.2 self-update by extracting a file named `multica`,
  # so ship the binary under both names (a real copy, not a link).
  cp ../bin/agenthost ../bin/multica
  mkdir -p ../dist
  # COPYFILE_DISABLE keeps macOS tar from adding ._ AppleDouble entries.
  COPYFILE_DISABLE=1 tar -czf "../dist/agenthost-cli-${target%/*}-${target#*/}.tar.gz" -C ../bin agenthost multica
done
cd ..
# `agenthost update` verifies the download against this manifest.
(cd dist && shasum -a 256 agenthost-cli-*.tar.gz > checksums.txt)

git tag "$VERSION" && git push origin "$VERSION"
gh release create "$VERSION" dist/agenthost-cli-*.tar.gz dist/checksums.txt \
  --repo johnefemer/multica --verify-tag --latest --title "Agenthost CLI $VERSION"

gh release delete kensink-latest --yes --repo johnefemer/multica || true
git push origin :refs/tags/kensink-latest || true
gh release create kensink-latest dist/agenthost-cli-*.tar.gz dist/checksums.txt \
  --repo johnefemer/multica --target main --prerelease \
  --title "Agenthost CLI — kensink-latest ($VERSION)"
```

## Desktop Release

Desktop installers ship in the same `vX.Y.Z` GitHub release as the CLI, so
`/releases/latest` carries both and `agenthost update` keeps working. The fork
builds macOS (Apple Silicon + Intel) and Windows x64; the download page treats
that set as complete. Builds are unsigned until there is an Apple Developer ID
and a Windows code-signing certificate: macOS users must right-click → Open the
first time, Windows shows SmartScreen, and macOS auto-update cannot apply
ad-hoc-signed updates.

```bash
# One-time on Apple Silicon: Windows packaging runs x86 Wine.
softwareupdate --install-rosetta --agree-to-license

git checkout vX.Y.Z    # the version comes from `git describe`; build at the tag
export CSC_IDENTITY_AUTO_DISCOVERY=false
# Each run wipes apps/desktop/dist, so copy artifacts out between runs.
env -u ELECTRON_RUN_AS_NODE pnpm --filter @multica/desktop package -- \
  --mac --arm64 --x64 --publish never --config electron-builder.unsigned.yml
mkdir -p /tmp/desktop-release && cp apps/desktop/dist/mac-*/{*.dmg,*.zip,*.blockmap,latest*.yml} /tmp/desktop-release/
env -u ELECTRON_RUN_AS_NODE pnpm --filter @multica/desktop package -- \
  --win --x64 --publish never --config electron-builder.unsigned.yml
cp apps/desktop/dist/{*.exe,*.blockmap,latest.yml} /tmp/desktop-release/
git checkout main

gh release upload vX.Y.Z /tmp/desktop-release/* --clobber --repo johnefemer/multica
```

Pass architecture flags per run: they apply to every platform in that run, so
`--win --arm64 --x64` would also build Windows ARM.

