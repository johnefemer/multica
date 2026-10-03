# KENSINK.md

Fork-specific guidance for the Kensink / Agenthost fork (johnefemer/multica).
Upstream's shared guidance lives in AGENTS.md; this file only covers what the
fork does differently. See FORK.md for the upstream sync workflow.

## Deployment

**Deploy with the local script over SSH. Never with GitHub Actions.**

Every workflow in `.github/workflows/` is disabled (`disabled_manually`), so a
push to `kensink-v2` no longer builds, releases, or deploys anything. Do not
re-enable one to ship a change, and do not wait on a workflow run.

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 'bash /opt/multica/scripts/agenthost-deploy.sh'
```

**Push first.** The script does `git reset --hard origin/kensink-v2`, so it
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
docker buildx build --platform linux/amd64 -f Dockerfile.web \
  --build-arg REMOTE_API_URL=http://backend:8080 \
  --build-arg NEXT_PUBLIC_WS_URL=wss://agenthost.pro/ws \
  --build-arg NEXT_PUBLIC_APP_VERSION=kensink \
  -t ghcr.io/johnefemer/multica-web:kensink --push .
```

Build on a dev machine, not on the box: prod is 1 vCPU / 1.9 GB RAM with ~3 GB
free disk, which is not enough for a Next.js build.

**Verify, don't assume.** `agenthost-deploy.sh` prints "Deploy complete" as long
as `/health` answers, including when it restarted nothing. Confirm the container
was actually replaced:

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'cd /opt/multica && docker compose -f docker-compose.selfhost.yml ps'
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

The `kensink-latest` rolling pre-release is what
`scripts/kensink-install.sh` downloads:

```bash
cd server
for target in darwin/amd64 darwin/arm64 linux/amd64 linux/arm64; do
  GOOS=${target%/*} GOARCH=${target#*/} CGO_ENABLED=0 \
    go build -ldflags="-s -w" -o ../bin/agenthost ./cmd/multica
  mkdir -p ../dist
  tar -czf "../dist/agenthost-cli-${target%/*}-${target#*/}.tar.gz" -C ../bin agenthost
done
cd ..
# `agenthost update` verifies the download against this manifest.
(cd dist && shasum -a 256 agenthost-cli-*.tar.gz > checksums.txt)
gh release delete kensink-latest --yes --repo johnefemer/multica || true
git push origin :refs/tags/kensink-latest || true
gh release create kensink-latest dist/agenthost-cli-*.tar.gz dist/checksums.txt \
  --repo johnefemer/multica --target kensink-v2 --prerelease \
  --title "Agenthost CLI — kensink-latest"
```

For a versioned `v0.x.x` release, bump the patch version by default (e.g.
`v0.1.12` → `v0.1.13`) unless the user specifies one, and run GoReleaser locally
(`goreleaser release --clean`) rather than pushing the tag and waiting.
