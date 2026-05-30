# Biomes / Harthmere Production Deployment README

This document describes the production deployment path for the Biomes TypeScript game running on Glitch infrastructure using Azure Container Apps. It captures the deployment flow that was validated locally and in Azure for title:

```text
42de534c-600f-4228-af9e-b69faef94cce
```

The validated production application URL is:

```text
https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io
```

The validated production sync WebSocket route is same-origin through the web ingress:

```text
wss://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io/ro-sync
```

The sync service still listens on internal container port `4900`, but browsers should not be pointed at an external `:4900` URL. The web process proxies `/sync`, `/beta-sync`, and `/ro-sync` to the local sync process.

## Preferred deploy command

Use the guarded deploy script instead of hand-running build/upload commands:

```bash
scripts/glitch/deploy-production-local-redis-smoke-v1.sh
```

That command builds the production Next and webpack artifacts, builds the Docker image locally, starts the production image against a local Redis container, bootstraps only that local Redis with the packaged snapshot, and runs the Glitch smoke tests. It does not upload anything by default.

Only after the local production-image smoke passes, deploy the exact tested image:

```bash
scripts/glitch/deploy-production-local-redis-smoke-v1.sh --push
```

The script avoids `az acr build`; production upload is `docker push` of the locally-smoked image, followed by `az containerapp update`. That keeps remote upload/build cost low and prevents pushing an image that has not run locally first.

The validated production image was:

```text
glitchgames.azurecr.io/biomes-node:prod-20260522202153
```

Do not paste the title token into source control or this README. It must be injected as a Container App secret.

---

## 1. What this deployment is

This is **not** a Glitch platform backend deployment. Glitch is already running. This deployment is for the Biomes/Harthmere TypeScript game server that Glitch launches.

The game server runs as a single Azure Container App process group. The production container starts the full local Glitch game stack inside one container:

```text
shim -> bikkie -> logic -> oob -> sidefx -> sync -> web
```

The stack is started with:

```bash
./scripts/glitch/run-glitch-local-game-stack-v92.sh
```

The current production stack also starts `bikkie` and `sidefx` so the packaged
runtime matches the local data-snapshot service graph. This matters because
starting only `dist/web.js` is wrong. The web server depends on the internal
shim, bikkie, logic, oob, sidefx, and sync services. If only web starts, the
server may build successfully but the runtime hangs while binding `worldApi`,
`/api/glitch/harthmere` may fail, and the sync WebSocket on port `4900` will
not be available.

---

## 2. Production architecture

### Azure subscription and resource group

```bash
AZURE_SUBSCRIPTION_ID="bac41b30-9f28-4d35-b98d-cd3aa33335a6"
RG="openai-resource-group"
LOC="eastus"
```

### Azure Container Registry

```bash
ACR_NAME="GlitchGames"
ACR_SERVER="glitchgames.azurecr.io"
```

Images are pushed to:

```text
glitchgames.azurecr.io/biomes-node:<tag>
```

### VNet

```bash
VNET="glitch-turn-vmVNET"
```

The VNet address space is:

```text
10.0.0.0/16
```

Existing Redis VM subnet:

```text
glitch-turn-vmSubnet = 10.0.0.0/24
```

Dedicated Container Apps subnet:

```text
glitch-containerapps-subnet = 10.0.1.0/27
```

### Container Apps environment

The working VNet-integrated Container Apps environment is:

```bash
ACA_ENV="glitch-prod-vnet-env"
```

The old non-VNet environment should not be used for this game because it cannot reach the private Redis VM.

### Container App

```bash
APP_VNET="biomes-node-vnet"
```

External ingress:

```text
HTTP web: 3000
Browser Sync WebSocket: same-origin `/ro-sync` through web ingress
Internal sync process: 4900
```

### Redis

The Redis VM is private-only and reachable from the VNet environment at:

```text
10.0.0.12:6379
```

If private DNS is provisioned later, the intended name is:

```text
biomes-redis-prod.glitch.internal
```

Do not bake Redis connection details into the Docker image. Set `REDIS_HOST` and `GLITCH_REDIS_HOST` at runtime. The current production Container App uses `10.0.0.12`.

---

## 3. Why the VNet environment is required

The Redis VM has no public IP. That is intentional for production security.

The original Container Apps environment was not VNet-integrated. That meant the game container could not reach or resolve Redis. The logs showed failures such as:

```text
Redis preflight host=10.0.0.12 port=6379
ERROR: Redis host '10.0.0.12' is not resolvable inside this container.
```

and:

```text
Redis preflight host=biomes-redis-prod port=6379
ERROR: Redis host 'biomes-redis-prod' is not resolvable inside this container.
```

The fix was not another Docker rebuild. The product-level fix was:

1. Create a dedicated Azure Container Apps subnet inside `glitch-turn-vmVNET`.
2. Create a new VNet-integrated Container Apps environment.
3. Add private DNS for Redis.
4. Deploy the game container into that VNet environment.

This lets the game container connect to:

```text
10.0.0.12
```

---

## 4. Why the sync URL must be decided before `next build`

The browser client uses `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL`.

Because this variable starts with `NEXT_PUBLIC_`, it is baked into the Next.js client bundle during:

```bash
next build
```

Changing it later as a runtime Container App environment variable is not enough for already-built browser JavaScript. Set it before running `next build`.

For this production deployment, use the web origin, not an external `:4900` URL:

```bash
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io"
```

The browser will connect to `wss://<web-origin>/ro-sync`; the web process proxies that WebSocket to internal `127.0.0.1:4900`. The runtime container also logs the sync URL, so set it in the Container App as well to keep runtime configuration and logs aligned.

---

## 5. Required Dockerfile behavior

The production Dockerfile must do these things:

1. Use the existing locally-built artifacts:
   - `node_modules/`
   - `.next/`
   - `dist/`
2. Rebuild native Node modules inside the Linux container so macOS/ARM native module issues do not break Linux/AMD64 runtime.
3. Restore execute bits because ZIP/ACR upload paths can strip executable permissions.
4. Expose the web ingress on `3000`; keep sync on internal `4900` and proxy it through same-origin `/ro-sync`.
5. Start the full stack script under `tini`:
6. Run `scripts/glitch/assert-glitch-build-artifacts-current.cjs` after copying `.next/` and `dist/`, so Docker packaging fails if stale build artifacts still contain old auth, world, or player-mesh code.

```dockerfile
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./scripts/glitch/run-glitch-local-game-stack-v92.sh"]
```

### Why not `CMD ["dist/web.js"]`?

Because `dist/web.js` only starts the web service. Production needs shim,
bikkie, logic, oob, sidefx, sync, and web. Starting only web caused the server
to wait on dependencies and never become a healthy game runtime.

### Why rebuild native modules in Docker?

The repo may have `node_modules` created on macOS/ARM, but the production image runs Linux/AMD64. Native modules like `sharp`, `bufferutil`, `utf-8-validate`, and `segfault-handler` need Linux/AMD64 bindings.

The Dockerfile runs:

```bash
npm rebuild sharp bufferutil utf-8-validate segfault-handler --platform=linux --arch=x64 --foreground-scripts
```

This prevents native-module mismatch errors after deployment.

### Why use `tini`?

The stack script launches multiple child services. `tini` handles signals correctly so Azure restarts, stops, and scale-downs do not leave orphaned processes.

---

## 6. `.dockerignore` for this deployment path

This Dockerfile expects `node_modules`, `.next`, and `dist` to be copied into the image. Do **not** exclude them.

Use this `.dockerignore`:

```dockerignore
.git
.gitignore
.harthmere-backups
harthmere-debug-dumps
tmp
.cache
.venv
biomes_venv
.DS_Store
*.log
*.tar
*.tar.gz
*.zip
```

Do not use a `.dockerignore` that excludes:

```text
node_modules
.next
dist
```

or the Docker build will be missing the prebuilt runtime artifacts.

---

## 7. One-time Azure infrastructure setup

These steps are only needed once unless the Azure environment is recreated.

### 7.1 Select the subscription

```bash
az account set --subscription bac41b30-9f28-4d35-b98d-cd3aa33335a6
```

### 7.2 Inspect the VNet

```bash
RG="openai-resource-group"
VNET="glitch-turn-vmVNET"

az network vnet show \
  --resource-group "$RG" \
  --name "$VNET" \
  --query "{addressSpace:addressSpace.addressPrefixes,subnets:subnets[].{name:name,prefix:addressPrefix,prefixes:addressPrefixes,id:id}}" \
  -o jsonc
```

Expected known state:

```text
addressSpace: 10.0.0.0/16
existing subnet: glitch-turn-vmSubnet 10.0.0.0/24
```

### 7.3 Create the dedicated Container Apps subnet

Use a dedicated subnet. The deployment used:

```text
10.0.1.0/27
```

```bash
RG="openai-resource-group"
VNET="glitch-turn-vmVNET"
ACA_SUBNET="glitch-containerapps-subnet"
ACA_SUBNET_PREFIX="10.0.1.0/27"

az network vnet subnet create \
  --resource-group "$RG" \
  --vnet-name "$VNET" \
  --name "$ACA_SUBNET" \
  --address-prefixes "$ACA_SUBNET_PREFIX" \
  --delegations Microsoft.App/environments

ACA_SUBNET_ID=$(az network vnet subnet show \
  --resource-group "$RG" \
  --vnet-name "$VNET" \
  --name "$ACA_SUBNET" \
  --query id \
  -o tsv)

printf "ACA_SUBNET_ID=%s\n" "$ACA_SUBNET_ID"
```

### 7.4 Create the VNet-integrated Container Apps environment

```bash
RG="openai-resource-group"
LOC="eastus"
ACA_ENV="glitch-prod-vnet-env"

az containerapp env create \
  --resource-group "$RG" \
  --name "$ACA_ENV" \
  --location "$LOC" \
  --infrastructure-subnet-resource-id "$ACA_SUBNET_ID"
```

Verify:

```bash
az containerapp env show \
  --resource-group "$RG" \
  --name "$ACA_ENV" \
  --query "{name:name,location:location,state:properties.provisioningState,subnet:properties.vnetConfiguration.infrastructureSubnetId,internal:properties.vnetConfiguration.internal}" \
  -o jsonc
```

### 7.5 Create private DNS for Redis

```bash
RG="openai-resource-group"
VNET="glitch-turn-vmVNET"
PRIVATE_ZONE="glitch.internal"
REDIS_RECORD="biomes-redis-prod"
REDIS_IP="10.0.0.12"

az network private-dns zone create \
  --resource-group "$RG" \
  --name "$PRIVATE_ZONE"

az network private-dns link vnet create \
  --resource-group "$RG" \
  --zone-name "$PRIVATE_ZONE" \
  --name "glitch-turn-vmVNET-link" \
  --virtual-network "$VNET" \
  --registration-enabled false

az network private-dns record-set a create \
  --resource-group "$RG" \
  --zone-name "$PRIVATE_ZONE" \
  --name "$REDIS_RECORD"

az network private-dns record-set a add-record \
  --resource-group "$RG" \
  --zone-name "$PRIVATE_ZONE" \
  --record-set-name "$REDIS_RECORD" \
  --ipv4-address "$REDIS_IP"
```

Redis runtime host:

```text
10.0.0.12
```

---

## 8. Production build from the repo

Run these steps from:

```bash
cd /Users/devindixon/Development/biomes-game
```

### 8.1 Set build variables

```bash
cd /Users/devindixon/Development/biomes-game

export RG="openai-resource-group"
export APP_VNET="biomes-node-vnet"
export ACR_NAME="GlitchGames"
export ACR_SERVER="glitchgames.azurecr.io"
export GLITCH_TITLE_ID="42de534c-600f-4228-af9e-b69faef94cce"
export GLITCH_API_BASE_URL="https://api.glitch.fun/api"
export WEB_FQDN="biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io"
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="https://$WEB_FQDN"

export GLITCH_RUNTIME="1"
export GLITCH_LOCAL_ASSETS="1"
export NEXT_PUBLIC_GLITCH_RUNTIME="1"
export NEXT_PUBLIC_GLITCH_LOCAL_ASSETS="1"
export BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="0"
export BIOMES_FORCE_LOCAL_DEV_TOWN="0"
export BIOMES_CREATE_LOCAL_DEV_TERRAIN="1"
export BIOMES_START_IN_HARTHMERE="0"
export NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="0"
export NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN="0"
export NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE="0"
export GLITCH_REDIS_MODE="external"
export GLITCH_POPULATE_SNAPSHOT_REDIS="0"
export GLITCH_REQUIRE_SNAPSHOT_REDIS="1"
export NODE_ENV="production"
export NEXT_TELEMETRY_DISABLED="1"

printf "NEXT_PUBLIC_GLITCH_SYNC_BASE_URL=%s\n" "$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL"
```

### 8.2 Rebuild Next.js

```bash
cd /Users/devindixon/Development/biomes-game

rm -rf .next/cache

GLITCH_RUNTIME=1 \
GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_RUNTIME=1 \
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0 \
NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0 \
NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0 \
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
NODE_OPTIONS="--openssl-legacy-provider" \
./node_modules/.bin/next build
```

Why this is done:

- Removes stale Next cache.
- Bakes the correct public sync URL into the browser bundle.
- Bakes the snapshot-first Grove start into the browser bundle. Shifted Harthmere extra-town seeding remains available only as an explicit opt-in.
- Builds the production Next app before Docker packaging.

### 8.3 Rebuild server bundles with webpack

```bash
cd /Users/devindixon/Development/biomes-game

NODE_ENV=production \
NODE_OPTIONS="--openssl-legacy-provider" \
node -r ts-node/register ./node_modules/webpack-cli/bin/cli.js \
  --config server.webpack.config.ts \
  --mode production
```

Why this is done:

- Produces the runtime files in `dist/`.
- The stack runner requires these files:

```text
dist/shim.js
dist/bikkie.js
dist/oob.js
dist/sync.js
dist/logic.js
dist/sidefx.js
dist/web.js
```

### 8.4 Verify artifacts before Docker build

```bash
cd /Users/devindixon/Development/biomes-game

ls -lh \
  .next/BUILD_ID \
  dist/shim.js \
  dist/bikkie.js \
  dist/oob.js \
  dist/sync.js \
  dist/logic.js \
  dist/sidefx.js \
  dist/web.js

grep -R "$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" .next/static .next/server 2>/dev/null | head -20

node scripts/glitch/assert-glitch-build-artifacts-current.cjs .
```

If `.next/BUILD_ID` or any `dist/*.js` file is missing, do not deploy. If the artifact guard fails, rebuild Next and webpack before building the Docker image. This catches the failure mode where source is fixed but production still runs an old `.next` bundle.

---

## 9. Build and test the Docker image locally

### 9.1 Build local production image

```bash
cd /Users/devindixon/Development/biomes-game

docker buildx build \
  --platform linux/amd64 \
  --progress=plain \
  -f Dockerfile.biomes \
  -t glitch-harthmere-biomes:production \
  --load \
  .
```

Expected result:

```text
naming to docker.io/library/glitch-harthmere-biomes:production done
```

### 9.2 Run local Redis and local game container

Use local Redis for local testing. Do not point local Docker at the private Azure Redis host.

```bash
cd /Users/devindixon/Development/biomes-game

docker network create glitch-dev 2>/dev/null || true
docker rm -f glitch-redis-local biomes-local 2>/dev/null || true

docker run -d \
  --name glitch-redis-local \
  --network glitch-dev \
  redis:6.0.16-alpine

printf "GLITCH_TITLE_TOKEN: "
stty -echo
IFS= read -r GLITCH_TITLE_TOKEN
stty echo
printf "\n"

docker run -d \
  --name biomes-local \
  --network glitch-dev \
  -p 3000:3000 \
  -p 4900:4900 \
  -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
  -e GLITCH_TITLE_ID="42de534c-600f-4228-af9e-b69faef94cce" \
  -e GLITCH_API_BASE_URL="https://api.glitch.fun/api" \
  -e REDIS_HOST="glitch-redis-local" \
  -e GLITCH_REDIS_HOST="glitch-redis-local" \
  -e REDIS_PORT="6379" \
  -e GLITCH_REDIS_PORT="6379" \
  -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="http://127.0.0.1:4900" \
  glitch-harthmere-biomes:production
```

### 9.3 Watch local logs

```bash
docker logs -f biomes-local
```

Expected logs:

```text
Redis preflight host=glitch-redis-local port=6379
Redis is already populated with the installed snapshot data.
Glitch local game stack v92
START shim HOST=127.0.0.1 BASE_PORT=3100 RPC_PORT=3104 METRICS_PORT=3101 file=/app/dist/shim.js
START bikkie HOST=127.0.0.1 BASE_PORT=3400 RPC_PORT=3404 METRICS_PORT=3401 file=/app/dist/bikkie.js
START logic HOST=127.0.0.1 BASE_PORT=3500 RPC_PORT=3504 METRICS_PORT=3501 file=/app/dist/logic.js
START oob HOST=127.0.0.1 BASE_PORT=4700 RPC_PORT=4704 METRICS_PORT=4701 file=/app/dist/oob.js
START sidefx HOST=127.0.0.1 BASE_PORT=4600 RPC_PORT=4604 METRICS_PORT=4601 file=/app/dist/sidefx.js
START sync HOST=0.0.0.0 BASE_PORT=4900 RPC_PORT=4904 METRICS_PORT=4901 file=/app/dist/sync.js
shim now running
bikkie now running
oob now running
logic now running
sidefx now running
WebSocket listening on port 4900
sync now running
web now running
```

### 9.4 Validate local API

```bash
curl -i \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"op":"validate","install_id":"f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"}' \
  http://127.0.0.1:3000/api/glitch/harthmere
```

Expected result:

```text
HTTP/1.1 200 OK
"valid": true
"user_name": "blackmage"
"license_type": "purchased"
"title_id": "42de534c-600f-4228-af9e-b69faef94cce"
```

Do not push or deploy if local validation fails.

---

## 10. Push image to Azure Container Registry

```bash
cd /Users/devindixon/Development/biomes-game

export RG="openai-resource-group"
export APP_VNET="biomes-node-vnet"
export ACR_NAME="GlitchGames"
export ACR_SERVER="glitchgames.azurecr.io"
export IMAGE_TAG="biomes-node:prod-$(date +%Y%m%d%H%M%S)"
export IMAGE="$ACR_SERVER/$IMAGE_TAG"

az acr login --name "$ACR_NAME"

docker tag glitch-harthmere-biomes:production "$IMAGE"
docker push "$IMAGE"

printf "IMAGE=%s\n" "$IMAGE"
```

Example validated image:

```text
glitchgames.azurecr.io/biomes-node:prod-20260522202153
```

---

## 11. Configure Container App ingress

The game requires external web and sync ports.

Check ingress:

```bash
az containerapp show \
  --resource-group "$RG" \
  --name "$APP_VNET" \
  --query "properties.configuration.ingress.{fqdn:fqdn,targetPort:targetPort,additionalPortMappings:additionalPortMappings}" \
  -o jsonc
```

Expected:

```json
{
  "fqdn": "biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io",
  "targetPort": 3000
}
```

Do not depend on an external browser-facing `:4900` mapping. Sync runs inside the container on `4900`, and the web process proxies same-origin WebSocket paths to it.

Set runtime env:

```bash
az containerapp update \
  --resource-group "$RG" \
  --name "$APP_VNET" \
  --set-env-vars NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io"
```

Also make sure the local `next build` was run with the same value.

### Problem: Browser WebSocket fails

Checklist:

1. Was `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` set before `next build` to the web origin, not `:4900`?
2. Do logs show `GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_V129 installed`?
3. Do logs show `WebSocket listening on port 4900` internally?
4. Does the browser attempt `wss://<web-origin>/ro-sync` instead of `wss://<web-origin>:4900/ro-sync`?
5. Is Glitch pointing to the VNet app URL?

### Problem: Docker build fails because `.next`, `dist`, or `node_modules` are missing

Cause:

`.dockerignore` excluded required artifacts.

Fix:

Do not exclude:

```text
node_modules
.next
dist
```

for the packaged-build Dockerfile.

### Problem: Native module errors for `sharp`, `bufferutil`, `utf-8-validate`, or `segfault-handler`

Cause:

Mac `node_modules` copied into a Linux/AMD64 image.

Fix:

The Dockerfile must run:

```bash
npm rebuild sharp bufferutil utf-8-validate segfault-handler --platform=linux --arch=x64 --foreground-scripts
```

and include build tooling such as `build-essential`.

### Problem: Docker Desktop local build errors with `input/output error`

Cause:

Local Docker Desktop storage corruption or exhausted build cache.

Fix:

Use Docker Desktop troubleshooting to clean/purge data, or run:

```bash
docker builder prune -af
docker system prune -af --volumes
```

If Docker cannot prune because BuildKit metadata is corrupted, use Docker Desktop UI:

```text
Troubleshoot -> Clean / Purge data
```

---

## 18. Deployment checklist

Before build:

- [ ] `Dockerfile.biomes` starts `run-glitch-local-game-stack-v92.sh`.
- [ ] `.dockerignore` does not exclude `node_modules`, `.next`, or `dist`.
- [ ] `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` is set to the production web origin; no external `:4900`.
- [ ] Build env includes `NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0`, `NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0`, `NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0`, `NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE=1`, and `NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1`.
- [ ] `next build` completed with the production web-origin sync URL.
- [ ] `webpack` completed with the current server sources.
- [ ] `node scripts/glitch/assert-glitch-build-artifacts-current.cjs .` passes.
- [ ] `.next/BUILD_ID` exists.
- [ ] `dist/shim.js`, `dist/bikkie.js`, `dist/oob.js`, `dist/sync.js`, `dist/logic.js`, `dist/sidefx.js`, and `dist/web.js` exist.

Before deploy:

- [ ] Docker image builds locally.
- [ ] Local Docker runtime starts or validates Redis, populates the installed snapshot only when explicitly requested, then starts shim, bikkie, logic, oob, sidefx, sync, and web.
- [ ] Local `/api/glitch/harthmere` returns `valid:true`.
- [ ] Image is pushed to ACR.
- [ ] Container App exposes web `3000`; sync `4900` is internal/proxied.
- [ ] `GLITCH_TITLE_TOKEN` secret exists.
- [ ] Runtime Redis host is the shared production Redis `10.0.0.12`.
- [ ] Runtime env includes `GLITCH_REDIS_MODE=external`, `GLITCH_POPULATE_SNAPSHOT_REDIS=0`, `GLITCH_REQUIRE_SNAPSHOT_REDIS=1`, `BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0`, `BIOMES_FORCE_LOCAL_DEV_TOWN=0`, `BIOMES_CREATE_LOCAL_DEV_TERRAIN=1`, `BIOMES_START_IN_HARTHMERE=0`, `GLITCH_WORLD_API_MODE=hfc-hybrid`, `GLITCH_BISCUIT_MODE=redis2`, and `GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1`.

After deploy:

- [ ] Revision is `Running`.
- [ ] Revision is `Healthy`.
- [ ] Logs show production sync URL and `GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_V129 installed`.
- [ ] Logs show `Redis is already populated with the installed snapshot data.`; production app replicas must not run the snapshot populate path.
- [ ] Logs show `registerWorldApi:got-config mode=hfc-hybrid`.
- [ ] Logs show the snapshot world ready and no Harthmere extra-town seeding unless a dedicated bootstrap/migration explicitly enabled it.
- [ ] Logs show `/api/assets/player_mesh.glb` responses without automatic redirects to the Harthmere static body fallback.
- [ ] Logs show `WebSocket listening on port 4900`.
- [ ] Logs show `web now running`.
- [ ] Production `/api/glitch/harthmere` returns `valid:true`.
- [ ] Glitch backend points to the VNet app URL.

---

## 19. Known-good final state

```text
Container App: biomes-node-vnet
Resource Group: openai-resource-group
Environment: glitch-prod-vnet-env
Revision: biomes-node-vnet--0000004
Revision State: Running
Health State: Healthy
Traffic Weight: 100
Image: glitchgames.azurecr.io/biomes-node:prod-20260522202153
Web URL: https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io
Sync URL: https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io
Redis Host: 10.0.0.12
Redis Port: 6379
Title ID: 42de534c-600f-4228-af9e-b69faef94cce
```

Validated API response:

```text
HTTP/2 200
valid: true
user_name: blackmage
license_type: purchased
title_id: 42de534c-600f-4228-af9e-b69faef94cce
```

---

## 20. Minimal redeploy command summary

Use this only after the one-time infrastructure is already in place.

```bash
cd /Users/devindixon/Development/biomes-game

export RG="openai-resource-group"
export APP_VNET="biomes-node-vnet"
export ACR_NAME="GlitchGames"
export ACR_SERVER="glitchgames.azurecr.io"
export WEB_FQDN="biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io"
export NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="https://$WEB_FQDN"

rm -rf .next/cache

GLITCH_RUNTIME=1 \
GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_GLITCH_RUNTIME=1 \
NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 \
NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0 \
NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0 \
NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0 \
NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="$NEXT_PUBLIC_GLITCH_SYNC_BASE_URL" \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
NODE_OPTIONS="--openssl-legacy-provider" \
./node_modules/.bin/next build

NODE_ENV=production \
NODE_OPTIONS="--openssl-legacy-provider" \
node -r ts-node/register ./node_modules/webpack-cli/bin/cli.js \
  --config server.webpack.config.ts \
  --mode production

node scripts/glitch/assert-glitch-build-artifacts-current.cjs .

docker buildx build \
  --platform linux/amd64 \
  --progress=plain \
  -f Dockerfile.biomes \
  -t glitch-harthmere-biomes:production \
  --load \
  .

docker network create glitch-dev 2>/dev/null || true
docker rm -f glitch-redis-local biomes-local 2>/dev/null || true
docker run -d --name glitch-redis-local --network glitch-dev redis:6.0.16-alpine

printf "GLITCH_TITLE_TOKEN: "
stty -echo
IFS= read -r GLITCH_TITLE_TOKEN
stty echo
printf "\n"

docker run -d \
  --name biomes-local \
  --network glitch-dev \
  -p 3000:3000 \
  -p 4900:4900 \
  -e GLITCH_TITLE_TOKEN="$GLITCH_TITLE_TOKEN" \
  -e GLITCH_TITLE_ID="42de534c-600f-4228-af9e-b69faef94cce" \
  -e GLITCH_API_BASE_URL="https://api.glitch.fun/api" \
  -e REDIS_HOST="glitch-redis-local" \
  -e GLITCH_REDIS_HOST="glitch-redis-local" \
  -e REDIS_PORT="6379" \
  -e GLITCH_REDIS_PORT="6379" \
  -e NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="http://127.0.0.1:4900" \
  glitch-harthmere-biomes:production

curl -i \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"op":"validate","install_id":"f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"}' \
  http://127.0.0.1:3000/api/glitch/harthmere

export IMAGE_TAG="biomes-node:prod-$(date +%Y%m%d%H%M%S)"
export IMAGE="$ACR_SERVER/$IMAGE_TAG"

az acr login --name "$ACR_NAME"
docker tag glitch-harthmere-biomes:production "$IMAGE"
docker push "$IMAGE"

az containerapp update \
  --resource-group "$RG" \
  --name "$APP_VNET" \
  --image "$IMAGE" \
  --set-env-vars \
    NEXT_PUBLIC_GLITCH_SYNC_BASE_URL="https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io" \
    NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="0" \
    NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN="0" \
    NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE="0" \
    BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN="0" \
    BIOMES_FORCE_LOCAL_DEV_TOWN="0" \
    BIOMES_CREATE_LOCAL_DEV_TERRAIN="1" \
    BIOMES_START_IN_HARTHMERE="0" \
    GLITCH_REDIS_MODE="external" \
    GLITCH_POPULATE_SNAPSHOT_REDIS="0" \
    GLITCH_REQUIRE_SNAPSHOT_REDIS="1" \
    GLITCH_TITLE_TOKEN=secretref:glitch-title-token \
    GLITCH_TITLE_ID="42de534c-600f-4228-af9e-b69faef94cce" \
    GLITCH_API_BASE_URL="https://api.glitch.fun/api" \
    REDIS_HOST="10.0.0.12" \
    REDIS_PORT="6379" \
    GLITCH_REDIS_HOST="10.0.0.12" \
    GLITCH_REDIS_PORT="6379"

REV=$(az containerapp show \
  --resource-group "$RG" \
  --name "$APP_VNET" \
  --query "properties.latestRevisionName" \
  -o tsv)

az containerapp logs show \
  --resource-group "$RG" \
  --name "$APP_VNET" \
  --revision "$REV" \
  --type console \
  --tail 300
```
