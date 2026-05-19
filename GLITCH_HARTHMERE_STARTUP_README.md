# Glitch / Harthmere Startup README

This README documents how to start the Harthmere/Biomes game through Glitch in **production**, **development**, and **local Docker** environments.

The current goal is simple: get the game running with **Glitch install validation + Redis + local/runtime assets**. Do **not** reintroduce GCP, BigQuery, Linkerd, or Google Secret Manager as required runtime dependencies for this path.

## Current Known-Good Rules

Do not undo these. They are the pieces that made the stack boot correctly.

1. `src/server/shared/secrets.ts` must keep the original `bootstrapGlobalSecrets()`, `getGlobalSecrets()`, and `getSecret()` exports.
2. `loadSecretsFromGoogle()` must skip Google Secret Manager when running Glitch/local/non-GCP mode.
3. Sync must use the Glitch/local no-op Discord bot when Discord is disabled. The no-op proxy must guard `then` so the registry does not treat it like a Promise.
4. Web must use the Glitch/local no-op Discord bot when Discord is disabled.
5. The Docker runner must fail fast if `GLITCH_TITLE_ID`, `GLITCH_TITLE_TOKEN`, or `GLITCH_API_BASE_URL` are missing.
6. `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` is a **build-time browser value**. Runtime Docker env does not change the already-built client bundle.
7. The browser sync URL and Docker port mapping must match. If the client bundle was built with `http://127.0.0.1:3018`, Docker must expose sync as `-p 3018:4900`.

## Service Map

| Service | Purpose | Container Port | Typical Host Port | Required For |
|---|---:|---:|---:|---|
| web | Next/web app + API routes | `3000` | `3017` local, public HTTPS in prod | Browser/API |
| web metrics | Metrics | `3001` | internal | Diagnostics |
| shim | Local world/chat shim RPC | base `3100`, RPC `3104`, metrics `3101` | internal | Local/dev world/chat |
| logic | Game logic RPC | base `3500`, RPC `3504`, metrics `3501` | internal | Game logic |
| oob | Out-of-band API/RPC | base `4700`, RPC `4704`, metrics `4701` | internal | OOB services |
| sync | Browser WebSocket sync | base `4900` | `3018` local, public WS/WSS in prod | Required for game boot |
| sync RPC | Internal sync RPC | `4904` | internal | Internal services |
| Redis | Cache/session/backplane dependency | `6379` | internal | Runtime support |

## Required Environment Variables

Never commit real secret values. Use a secret manager or deployment secret injection in production.

### Glitch Identity / Licensing

```bash
GLITCH_TITLE_ID='<title UUID>'
GLITCH_TITLE_TOKEN='<title token secret>'
GLITCH_API_BASE_URL='https://api.glitch.fun/api'
```

These are mandatory. If they are missing, `/api/glitch/harthmere` returns `disabled:true` or the runner should refuse to start.

### Runtime Mode

```bash
NODE_ENV=production
GLITCH_RUNTIME=1
GLITCH_LOCAL_ASSETS=1
NEXT_PUBLIC_GLITCH_RUNTIME=1
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1
```

### Sync Browser URL

Local default:

```bash
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='http://127.0.0.1:3018'
```

Production example:

```bash
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='https://sync.example.com'
# or wss-capable route depending on the final public deployment/proxy
```

Important: this value is baked into the Next client bundle during `next build`. If you change this value, rebuild Next.

### Disable Non-Required External Dependencies

```bash
GLITCH_DISABLE_GCP=1
GLITCH_SKIP_GCE_METADATA=1
GLITCH_SKIP_GOOGLE_SECRETS=1
GLITCH_DISABLE_DISCORD=1
GLITCH_DISABLE_ASSET_MIRROR=1
GLITCH_SKIP_PROD_TRAY=1
```

The known-good log should include:

```text
Skipping GCE metadata wait for Glitch/local non-GCP runtime.
Skipping Google Secret Manager for Glitch/local non-GCP runtime.
```

### Storage / Service Modes

For local and early development:

```bash
GLITCH_STORAGE_MODE=memory
GLITCH_FIREHOSE_MODE=memory
GLITCH_BISCUIT_MODE=memory
GLITCH_CHAT_API_MODE=shim
GLITCH_WORLD_API_MODE=shim
GLITCH_BIKKIE_CACHE_MODE=local
GLITCH_SERVER_CACHE_MODE=local
DISCOVERY_KIND=shim
RO_SYNC=1
```

Production should replace memory/local modes with durable implementations as they become available. Keep the implementation database-agnostic.

### Redis

```bash
REDIS_HOST=glitch-redis
REDIS_PORT=6379
GLITCH_REDIS_HOST=glitch-redis
GLITCH_REDIS_PORT=6379
ALLOW_NON_K8_REDIS=1
USE_K8_REDIS=0
```

### Internal Service Discovery

```bash
SHIM_PORT=3104
SHIM_SERVICE_HOST=127.0.0.1
SHIM_SERVICE_PORT=3104
LOGIC_SERVICE_HOST=127.0.0.1
LOGIC_SERVICE_PORT=3504
OOB_SERVICE_HOST=127.0.0.1
OOB_SERVICE_PORT=4704
GLITCH_SYNC_BIND_HOST=0.0.0.0
GLITCH_WEB_BIND_HOST=0.0.0.0
```

Do **not** globally export `SYNC_SERVICE_HOST` / `SYNC_SERVICE_PORT` into the sync process itself. Web can use sync discovery, but sync must still bind its browser WebSocket on `4900` and internal RPC on `4904`.

## Production Startup

Production should run the same logical services, but with real public hostnames, TLS, and durable infrastructure.

### Production Build

Set production build-time URLs first:

```bash
export GLITCH_RUNTIME=1
export GLITCH_LOCAL_ASSETS=1
export NEXT_PUBLIC_GLITCH_RUNTIME=1
export NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='https://<public-sync-host-or-route>'
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
```

Build the Next frontend and server bundle:

```bash
set -e

GLITCH_RUNTIME=1 \
GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_RUNTIME=1 \
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
./node_modules/.bin/next build

NODE_ENV=production \
NODE_OPTIONS='--openssl-legacy-provider' \
./node_modules/.bin/webpack \
  --config server.webpack.config.ts \
  --mode production
```

Build the Docker image:

```bash
docker buildx build \
  --platform linux/amd64 \
  --progress=plain \
  -f Dockerfile.biomes \
  -t glitch-harthmere-biomes:production \
  .
```

### Production Runtime Requirements

Required deployed dependencies:

- Redis-compatible service.
- Public web route to container port `3000`.
- Public WebSocket route to sync port `4900`.
- Internal service networking for `3104`, `3504`, `4704`, and `4904`.
- Glitch title credentials injected as secrets.

Production environment skeleton:

```bash
NODE_ENV=production
NODE_OPTIONS='--trace-uncaught --trace-warnings --enable-source-maps'

GLITCH_RUNTIME=1
GLITCH_LOCAL_ASSETS=1
NEXT_PUBLIC_GLITCH_RUNTIME=1
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='https://<public-sync-host-or-route>'

GLITCH_TITLE_ID='<title UUID>'
GLITCH_TITLE_TOKEN='<title token secret>'
GLITCH_API_BASE_URL='https://api.glitch.fun/api'

GLITCH_DISABLE_GCP=1
GLITCH_SKIP_GCE_METADATA=1
GLITCH_SKIP_GOOGLE_SECRETS=1
GLITCH_DISABLE_DISCORD=1
GLITCH_DISABLE_ASSET_MIRROR=1
GLITCH_SKIP_PROD_TRAY=1

REDIS_HOST='<redis host>'
REDIS_PORT=6379
GLITCH_REDIS_HOST='<redis host>'
GLITCH_REDIS_PORT=6379

GLITCH_STORAGE_MODE=memory
GLITCH_FIREHOSE_MODE=memory
GLITCH_BISCUIT_MODE=memory
GLITCH_CHAT_API_MODE=shim
GLITCH_WORLD_API_MODE=shim
GLITCH_BIKKIE_CACHE_MODE=local
GLITCH_SERVER_CACHE_MODE=local
DISCOVERY_KIND=shim
RO_SYNC=1

GLITCH_SYNC_BIND_HOST=0.0.0.0
GLITCH_WEB_BIND_HOST=0.0.0.0
SHIM_SERVICE_HOST=127.0.0.1
SHIM_SERVICE_PORT=3104
LOGIC_SERVICE_HOST=127.0.0.1
LOGIC_SERVICE_PORT=3504
OOB_SERVICE_HOST=127.0.0.1
OOB_SERVICE_PORT=4704
```

Production start command inside the image:

```bash
./scripts/glitch/run-glitch-local-game-stack-v92.sh
```

The script name says local, but currently it is the known-good single-container Glitch game stack runner. Rename later if desired.

## Development Startup

Use this when you are iterating on the Docker image and want production-like behavior locally.

### Build for Default Local Ports

Default local ports:

- Web: `http://127.0.0.1:3017`
- Sync WebSocket: `http://127.0.0.1:3018`

```bash
cd /Users/devindixon/Development/biomes-game

set -e

GLITCH_RUNTIME=1 \
GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_RUNTIME=1 \
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL=http://127.0.0.1:3018 \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
./node_modules/.bin/next build

NODE_ENV=production \
NODE_OPTIONS='--openssl-legacy-provider' \
./node_modules/.bin/webpack \
  --config server.webpack.config.ts \
  --mode production

docker buildx build \
  --builder glitch-amd64-builder \
  --platform linux/amd64 \
  --load \
  --progress=plain \
  -f Dockerfile.biomes \
  -t glitch-harthmere-biomes:local \
  .
```

### Start Redis

```bash
docker network create glitch-dev 2>/dev/null || true

docker rm -f glitch-redis 2>/dev/null || true

docker run -d \
  --name glitch-redis \
  --network glitch-dev \
  redis:7-alpine

docker run --rm \
  --network glitch-dev \
  redis:7-alpine \
  redis-cli -h glitch-redis ping
```

Expected:

```text
PONG
```

### Start Harthmere Container

```bash
cd /Users/devindixon/Development/biomes-game

export GLITCH_TITLE_ID='<title UUID>'
export GLITCH_TITLE_TOKEN='<title token secret>'
export GLITCH_API_BASE_URL='https://api.glitch.fun/api'

test -n "$GLITCH_TITLE_ID" && echo "GLITCH_TITLE_ID=set" || echo "GLITCH_TITLE_ID=MISSING"
test -n "$GLITCH_TITLE_TOKEN" && echo "GLITCH_TITLE_TOKEN=set" || echo "GLITCH_TITLE_TOKEN=MISSING"
test -n "$GLITCH_API_BASE_URL" && echo "GLITCH_API_BASE_URL=set" || echo "GLITCH_API_BASE_URL=MISSING"

docker rm -f glitch-harthmere-web 2>/dev/null || true

docker run -d \
  --name glitch-harthmere-web \
  --platform linux/amd64 \
  --network glitch-dev \
  -p 3017:3000 \
  -p 3018:4900 \
  -e NODE_ENV=production \
  -e NODE_OPTIONS='--trace-uncaught --trace-warnings --enable-source-maps' \
  -e GLITCH_RUNTIME=1 \
  -e GLITCH_LOCAL_ASSETS=1 \
  -e NEXT_PUBLIC_GLITCH_RUNTIME=1 \
  -e NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
  -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL='http://127.0.0.1:3018' \
  -e GLITCH_SYNC_BIND_HOST=0.0.0.0 \
  -e GLITCH_WEB_BIND_HOST=0.0.0.0 \
  -e GLITCH_DISABLE_GCP=1 \
  -e GLITCH_DISABLE_DISCORD=1 \
  -e GLITCH_DISABLE_ASSET_MIRROR=1 \
  -e GLITCH_SKIP_GCE_METADATA=1 \
  -e GLITCH_SKIP_GOOGLE_SECRETS=1 \
  -e GLITCH_SKIP_PROD_TRAY=1 \
  -e GLITCH_STORAGE_MODE=memory \
  -e GLITCH_FIREHOSE_MODE=memory \
  -e GLITCH_BISCUIT_MODE=memory \
  -e GLITCH_CHAT_API_MODE=shim \
  -e GLITCH_WORLD_API_MODE=shim \
  -e GLITCH_BIKKIE_CACHE_MODE=local \
  -e GLITCH_SERVER_CACHE_MODE=local \
  -e DISCOVERY_KIND=shim \
  -e RO_SYNC=1 \
  -e SHIM_PORT=3104 \
  -e SHIM_SERVICE_HOST=127.0.0.1 \
  -e SHIM_SERVICE_PORT=3104 \
  -e LOGIC_SERVICE_HOST=127.0.0.1 \
  -e LOGIC_SERVICE_PORT=3504 \
  -e OOB_SERVICE_HOST=127.0.0.1 \
  -e OOB_SERVICE_PORT=4704 \
  -e REDIS_HOST=glitch-redis \
  -e REDIS_PORT=6379 \
  -e GLITCH_REDIS_HOST=glitch-redis \
  -e GLITCH_REDIS_PORT=6379 \
  -e ALLOW_NON_K8_REDIS=1 \
  -e USE_K8_REDIS=0 \
  -e GLITCH_TITLE_ID="$GLITCH_TITLE_ID" \
  -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
  -e GLITCH_API_BASE_URL="$GLITCH_API_BASE_URL" \
  --entrypoint /bin/bash \
  glitch-harthmere-biomes:local \
  -lc './scripts/glitch/run-glitch-local-game-stack-v92.sh'
```

### Verify Development Startup

```bash
docker logs --tail=260 glitch-harthmere-web | grep -Ei \
  'Skipping Google Secret Manager|shim now running|logic now running|sync now running|web now running|WebSocket listening|zRPC listening|ERROR .*not listening|Stopping services|Missing required env'
```

Expected:

```text
Skipping Google Secret Manager for Glitch/local non-GCP runtime.
shim now running
logic now running
WebSocket listening on port 4900
zRPC listening on port 4904
sync now running
web now running
```

Validate install id:

```bash
curl -i \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"op":"validate","install_id":"f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"}' \
  http://127.0.0.1:3017/api/glitch/harthmere
```

Expected JSON contains:

```json
{
  "valid": true,
  "username": "blackmage",
  "license_type": "purchased"
}
```

Open the game:

```bash
open -na "Google Chrome" --args \
  --user-data-dir=/tmp/glitch-harthmere-local \
  --disable-extensions \
  --disable-application-cache \
  --disk-cache-size=1 \
  "http://127.0.0.1:3017/?install_id=f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"
```

## Local Source Startup Without Docker

This is for the old local Biomes/Harthmere dev-town flow. It is useful for world generation/debugging, not the full Glitch Docker path.

Do **not** use `yarn dev` for this flow.

```bash
cd /Users/devindixon/Development/biomes-game

SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Expected local service ports from the Biomes wrapper:

| Service | Base | Metrics | RPC |
|---|---:|---:|---:|
| shim | `3100` | `3101` | `3102` |
| bikkie | `3400` | `3401` | `3402` |
| logic | `3500` | `3501` | `3502` |
| web | `3000` | `3001` | `3002` |
| sidefx | `4600` | `4601` | `4602` |
| oob | `4700` | `4701` | `4702` |
| sync | `4900` | `4901` | `4902` |

## Common Failure Modes

### 1. `/api/glitch/harthmere` returns `disabled:true`

Cause: missing title envs.

Check:

```bash
docker exec glitch-harthmere-web /bin/bash -lc '
test -n "$GLITCH_TITLE_ID" && echo "GLITCH_TITLE_ID=set" || echo "GLITCH_TITLE_ID=MISSING"
test -n "$GLITCH_TITLE_TOKEN" && echo "GLITCH_TITLE_TOKEN=set" || echo "GLITCH_TITLE_TOKEN=MISSING"
test -n "$GLITCH_API_BASE_URL" && echo "GLITCH_API_BASE_URL=set" || echo "GLITCH_API_BASE_URL=MISSING"
'
```

Fix: set `GLITCH_TITLE_ID`, `GLITCH_TITLE_TOKEN`, and `GLITCH_API_BASE_URL` before `docker run`.

### 2. Browser loops WebSocket `1006` to `/ro-sync`

Cause: port mismatch between baked `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` and Docker mapping.

Example bad state:

```text
Browser connects to ws://127.0.0.1:3018/ro-sync
Container exposes -p 3028:4900
```

Fix: either expose `-p 3018:4900`, or rebuild Next with `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL=http://127.0.0.1:3028`.

### 3. Google Secret Manager errors

Bad log:

```text
Cannot connect to Google Secrets. Could not load the default credentials.
```

Fix: make sure `loadSecretsFromGoogle()` has the Glitch/local skip guard and runtime includes:

```bash
GLITCH_DISABLE_GCP=1
GLITCH_SKIP_GOOGLE_SECRETS=1
GLITCH_RUNTIME=1
```

Expected log:

```text
Skipping Google Secret Manager for Glitch/local non-GCP runtime.
```

### 4. Sync starts but never opens `4900` / `4904`

Known fix: sync must use the Glitch/local no-op Discord bot with a `then` guard.

The registry timing should eventually show:

```text
WebSocket listening on port 4900
zRPC listening on port 4904
sync now running
```

### 5. `bootstrapGlobalSecrets is not a function`

Cause: `src/server/shared/secrets.ts` was overwritten or partially replaced.

Fix:

```bash
git checkout -- src/server/shared/secrets.ts
```

Then reapply only the `loadSecretsFromGoogle()` skip guard. Do not replace `bootstrapGlobalSecrets()`.

### 6. Login screen appears after game loads

This is not a Docker/startup issue if the following are true:

```text
/api/glitch/harthmere returns valid:true
sync connects
Bootstrap complete
Contexts built
Loaded rebuilt Harthmere assets
```

Then the remaining issue is the client-side install-id auth gate. Patch the Harthmere/Glitch auth bridge so a validated install id is treated as authenticated and does not fall through to Biomes login/register UI.

## Final Health Checklist

Before opening the browser:

```bash
docker logs --tail=260 glitch-harthmere-web | grep -Ei \
  'Skipping Google Secret Manager|shim now running|logic now running|sync now running|web now running|WebSocket listening|zRPC listening|ERROR .*not listening|Stopping services|Missing required env'
```

Must include:

```text
Skipping Google Secret Manager for Glitch/local non-GCP runtime.
shim now running
logic now running
WebSocket listening on port 4900
zRPC listening on port 4904
sync now running
web now running
```

Then:

```bash
curl -i \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"op":"validate","install_id":"f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"}' \
  http://127.0.0.1:3017/api/glitch/harthmere
```

Must include:

```json
"valid": true
```

