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
scripts/glitch/deploy-production-local-redis-smoke.sh
```

That command runs the production source guardrails, builds the production Next
and webpack artifacts, and builds the Docker image locally. It does not upload
anything by default.

To run the deploy path up to the Docker build boundary and stop there:

```bash
scripts/glitch/deploy-production-local-redis-smoke.sh --stop-before-docker-build
```

The local production-image HTTP smoke is memory-heavy and is now opt-in. Run it
when you need the full local container proof:

```bash
scripts/glitch/deploy-production-local-redis-smoke.sh --local-smoke
```

For an app-only production deploy from a local workstation, keep production
Redis private and skip the post-deploy Redis world-sync phase:

```bash
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

For a full production deploy with post-deploy world reconciliation, run from an
Azure/VNet runner that can reach private Redis and pass the private Redis host:

```bash
PROD_REDIS_RECONCILE_HOST=10.0.0.12 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

The script avoids `az acr build`. When `--push` is used without `--local-smoke`,
Docker Buildx pushes the image directly to ACR so CI does not spend time loading
the full image into the local Docker daemon and then pushing it again. When
`--local-smoke` is enabled, the script still loads the local image first, runs
the smoke checks, then uses `docker push`. Before any production update it
validates the private Redis NSG, Redis write/persistence health, snapshot hash,
and required world seed keys.

## GitHub Actions production deploy

`.github/workflows/azure-production-deploy.yml` runs the same guarded deploy
script on every push to `main` and from manual `workflow_dispatch` runs. It
builds the production artifacts, builds the Docker image, pushes it to ACR, and
updates the Azure Container App.

Because this repository is public, the workflow uses GitHub OIDC with a
user-assigned managed identity instead of a long-lived Azure client secret. The
GitHub `production` environment stores these values as environment secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `BIOMES_DEPENDENCY_GITHUB_TOKEN` for private Git dependencies in `yarn.lock`

The Azure identity is `biomes-github-actions-prod-deploy`, federated to:

```text
repo:Glitch-Gaming-Platform/Glitch-Games-Biomes:environment:production
```

The managed identity needs enough access to:

- Push to ACR `GlitchGames` / `glitchgames.azurecr.io`.
- Update Container App `biomes-node-vnet` in resource group `openai-resource-group`.
- Read Redis NSG rules for `biomes-redis-prod-nsg`.
- Run commands on VM `biomes-redis-prod` for private Redis health checks.

The workflow sets `HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1` because GitHub
hosted runners cannot directly reach the private production Redis host. Use an
Azure/VNet runner and the local deploy command when a full post-deploy world
reconciliation is required.

Every deployment also pins the Glitch title identity used by the runtime:

```text
GLITCH_TITLE_ID=42de534c-600f-4228-af9e-b69faef94cce
GLITCH_API_BASE_URL=https://api.glitch.fun/api
GLITCH_TITLE_TOKEN=secretref:glitch-title-token
```

The title token lives only as the Azure Container App secret
`glitch-title-token`; it is not stored in GitHub or source control.

The workflow restores Git LFS assets through the shared LFS cache action, then
restores `node_modules`, production data snapshot assets, Next.js compiler
cache, server Webpack compiler cache, and Buildx layers. On exact `node_modules`
cache hits, the workflow verifies the restored Linux dependency tree and skips
`yarn install` entirely. This avoids spending paid runner time on Yarn's
fetch/link/build phases when the lockfile and Node version have not changed. The
Yarn tarball cache is intentionally not used here because it is very large in
this repository and competes with the more valuable LFS, Docker, compiler,
asset, and `node_modules` caches. Dependency caches are saved immediately after a
needed `yarn install`, so a later build or Azure deployment failure does not
throw away a successful install. The compiler, asset, and image caches use
explicit restore/save steps instead of the deprecated `save-always` cache mode,
and save only when their cache directories were populated. The first run can
still be slow because it has to populate those caches; later runs should reuse
dependency, compiler, asset, and image layers when the lockfile, build
configuration, Dockerfile layers, and copied assets have not changed.

The GitHub-hosted runner disk is finite, so the production workflow frees large
preinstalled SDK folders before checkout, exports only a minimal Buildx cache,
uses a `buildx-min` cache namespace so old max-size caches are not restored,
prunes Docker after the image push, and refuses to save a Docker layer cache
larger than `MAX_DOCKER_LAYER_CACHE_MB`. This prevents failures such as
`No space left on device` while the runner is writing its diagnostic logs or
archiving caches.

The shared CI cache actions follow the same pattern: LFS saves after a clean
`git lfs pull`, pip saves after the virtualenv install, Bazel saves after the
dependency fetch, and eslint restores before lint but saves in the calling
workflow after lint has populated `.next/cache/eslint`.

The validated production image was:

```text
glitchgames.azurecr.io/biomes-node:prod-20260611185041
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
./scripts/glitch/run-glitch-local-game-stack.sh
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

The Redis service is private-only and reachable from the VNet environment at:

```text
10.0.0.12:6379
```

If private DNS is provisioned later, the intended name is:

```text
biomes-redis-prod.glitch.internal
```

Do not bake Redis connection details into the Docker image. Set `REDIS_HOST` and `GLITCH_REDIS_HOST` at runtime. The current production Container App uses `10.0.0.12`.

Production Redis must remain private. Do not restore a public `6379` allow rule
or set `PROD_REDIS_PUBLIC_HOST` for normal deploys. The deployment script checks
Redis health through Azure VM run-command by default (`PROD_REDIS_HEALTH_MODE=azure-vm`)
so local deploys can verify Redis without opening the socket to the internet.

Required Redis network guardrails:

- NSG `biomes-redis-prod-nsg` allows `6379/tcp` only from the Container Apps
  subnet `10.0.1.0/27`.
- The same NSG has an explicit deny rule for all other `6379/tcp` sources.
- External probes to the Redis public IP must time out.

Required Redis persistence guardrails:

- `appendonly=no`
- `dir=/var/lib/redis`
- `dbfilename=dump.rdb`
- `save="900 1 300 10 60 10000"`
- `rdb_last_bgsave_status=ok`

Use the guarded health check after any Redis VM, disk, NSG, or snapshot repair:

```bash
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --redis-health-check-only
```

---

## 2A. Optional Azure NPC voice and speech

NPC voice is Azure-only and optional. If the Azure OpenAI or Azure Speech
settings are omitted, the game stays text-only and the microphone button remains
hidden.

The verified resources are:

```bash
OPENAI_RESOURCE="glitch-openai-instance"      # Azure OpenAI, eastus
SPEECH_RESOURCE="devin-md9b1bq5-eastus2"     # Azure AI Services/Speech, eastus2
OPENAI_DEPLOYMENT="gpt-5.5"
```

Recommended Container App secret setup:

```bash
az containerapp secret set \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --secrets \
    azure-openai-api-key="<do-not-commit>" \
    azure-speech-key="<do-not-commit>"

az containerapp update \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --set-env-vars \
    AZURE_OPENAI_ENDPOINT="https://glitch-openai-instance.openai.azure.com/" \
    AZURE_OPENAI_API_VERSION="2025-04-01-preview" \
    AZURE_OPENAI_DEPLOYMENT="gpt-5.5" \
    AZURE_OPENAI_API_KEY="secretref:azure-openai-api-key" \
    AZURE_SPEECH_REGION="eastus2" \
    AZURE_SPEECH_KEY="secretref:azure-speech-key"
```

Useful verification commands:

```bash
az cognitiveservices account deployment list \
  --resource-group openai-resource-group \
  --name glitch-openai-instance \
  --query "[].{name:name,model:properties.model.name,version:properties.model.version,sku:sku.name,capacity:sku.capacity,rateLimits:properties.rateLimits}" \
  -o table

az cognitiveservices usage list \
  --location eastus2 \
  --query "[?contains(name.value, 'OpenAI') && (contains(name.value, 'audio') || contains(name.value, 'whisper') || contains(name.value, 'tts') || contains(name.value, 'transcribe') || contains(name.value, 'realtime'))].{name:name.value,current:currentValue,limit:limit,unit:unit}" \
  -o table
```

Static NPC line recordings can be generated after secrets are present:

```bash
node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --dry-run
```

Full docs:

```text
docs/harthmere/HARTHMERE_AZURE_VOICE_AND_SPEECH.md
```

---

## 3. Why the VNet environment is required

The Redis VM must not accept public Redis traffic. Port `6379` is intentionally
limited to the VNet Container Apps subnet by NSG rules.

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
CMD ["./scripts/glitch/run-glitch-local-game-stack.sh"]
```

The deploy script replaces Azure Container App `command` overrides with
`./scripts/glitch/run-glitch-local-game-stack.sh` on every update so Azure
cannot keep running an older manual startup command after the image has moved
to the unified stack script.

After the new revision reports ready, the script pins 100% traffic to that
concrete revision and deactivates older active revisions so idle no-traffic
revisions do not keep running after production is healthy.

### Replica policy

The current Azure Container App runs the full game stack in one container:
web, sync WebSocket, shim, bikkie, logic, oob, sidefx, chat, and Redis stream
workers. Because that single process tree owns live WebSocket sessions and
singleton stream workers, production defaults to `AZURE_MIN_REPLICAS=1` and
`AZURE_MAX_REPLICAS=1`.

Do not raise `AZURE_MAX_REPLICAS` for this deployment path until the singleton
workers are split out or guarded and session routing has been designed for
horizontal replicas. The deploy script rejects multi-replica updates unless
`AZURE_ALLOW_MULTI_REPLICA_STACK=1` is set explicitly.

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

# Clear generated build outputs, but keep .next/cache when the workflow restored
# it. The deploy script does this automatically.
rm -rf .next dist

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

- Removes stale generated Next/server outputs while preserving safe compiler caches.
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
Glitch local game stack
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
2. Do logs show `GLITCH_SAME_ORIGIN_SYNC_WS_PROXY installed`?
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

### Problem: GitHub Actions production deploy fails with `No space left on device`

Cause:

The hosted runner filled its local disk while building Docker layers or saving a
large Buildx cache. The final symptom can appear in the Actions runner itself,
for example while writing `_diag/Worker_*.log`.

Fix:

Keep `.github/workflows/azure-production-deploy.yml` on the bounded-cache path:

- `Free runner disk before checkout and build` removes unused hosted-runner SDKs.
- `DOCKER_BUILD_CACHE_TO` uses `mode=min`, not `mode=max`.
- Docker cache keys use the `buildx-min` namespace so old max-size caches are not restored.
- `Prune Docker after image push` clears duplicate builder/image storage before cache saves.
- `MAX_DOCKER_LAYER_CACHE_MB` caps the saved Buildx cache; oversized caches are deleted instead of archived.

---

## 18. Deployment checklist

Before build:

- [ ] `Dockerfile.biomes` starts `run-glitch-local-game-stack.sh`.
- [ ] `.dockerignore` does not exclude `node_modules`, `.next`, or `dist`.
- [ ] `NEXT_PUBLIC_GLITCH_SYNC_BASE_URL` is set to the production web origin; no external `:4900`.
- [ ] Build env includes `NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0`, `NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0`, `NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0`, `NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE=1`, and `NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1`.
- [ ] `next build` completed with the production web-origin sync URL.
- [ ] `webpack` completed with the current server sources.
- [ ] `node scripts/glitch/assert-glitch-build-artifacts-current.cjs .` passes.
- [ ] `.next/BUILD_ID` exists.
- [ ] `dist/shim.js`, `dist/bikkie.js`, `dist/oob.js`, `dist/sync.js`, `dist/logic.js`, `dist/sidefx.js`, and `dist/web.js` exist.

Before deploy:

- [ ] `scripts/glitch/deploy-production-local-redis-smoke.sh --redis-health-check-only` passes.
- [ ] Redis NSG allows `6379/tcp` from `10.0.1.0/27` and explicitly denies all other sources.
- [ ] Public Redis access is blocked; do not reopen `6379` to `*`, `Internet`, or `0.0.0.0/0`.
- [ ] Redis persistence is `dir=/var/lib/redis`, `dbfilename=dump.rdb`, `save="900 1 300 10 60 10000"`, and `rdb_last_bgsave_status=ok`.
- [ ] Production Redis snapshot hash matches `snapshot_backup.json`, and required seed keys are present (`required_seed_keys_present=3/3`).
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
- [ ] `audit_production_authored_content` passes: business owners `19/19`,
      business crafting stations `19/19`, business customers `57/57`, muckers
      `100/100`, and wildlife `24/24`.
- [ ] Business outpost terrain materialization logs
      `processed 19/19 outposts` and no `missingShardCount` failures. NPCs/boards
      without the voxel building means this step was skipped or killed.
- [ ] Post-reconciliation Redis `BGSAVE` completed with
      `rdb_last_bgsave_status=ok`.
- [ ] Logs show production sync URL and `GLITCH_SAME_ORIGIN_SYNC_WS_PROXY installed`.
- [ ] Logs show `Redis is already populated with the installed snapshot data.`; production app replicas must not run the snapshot populate path.
- [ ] Logs show `registerWorldApi:got-config mode=hfc-hybrid`.
- [ ] Logs show the snapshot world ready and no Harthmere extra-town seeding unless a dedicated bootstrap/migration explicitly enabled it.
- [ ] Logs show `/api/assets/player_mesh.glb` responses without automatic redirects to the Harthmere static body fallback.
- [ ] Logs show `WebSocket listening on port 4900`.
- [ ] Logs show `web now running`.
- [ ] Production `/api/world_map/metadata` returns finite map bounds and no
      response-schema validation error.
- [ ] Production `/api/glitch/harthmere` returns `valid:true`.
- [ ] Glitch backend points to the VNet app URL.

---

## 19. Known-good final state

```text
Container App: biomes-node-vnet
Resource Group: openai-resource-group
Environment: glitch-prod-vnet-env
Revision: biomes-node-vnet--0000110
Revision State: Running
Health State: Healthy
Traffic Weight: 100
Image: glitchgames.azurecr.io/biomes-node:prod-20260611185041
Web URL: https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io
Sync URL: https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io
Redis Host: 10.0.0.12
Redis Port: 6379
Redis snapshot hash: 3013026c00d11eb16ab4cacfb524b317
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

Use the guarded script. Do not hand-run `az containerapp update` for normal
production deploys, because that bypasses the Redis NSG, persistence, snapshot,
traffic-pinning, and stale-revision checks.

```bash
cd /Users/devindixon/Development/biomes-game

# App-only local deploy; Redis stays private and no world-sync writes run.
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

For a full deploy with authored-content/world reconciliation, run from a host
inside the Azure VNet and use:

```bash
cd /Users/devindixon/Development/biomes-game

PROD_REDIS_RECONCILE_HOST=10.0.0.12 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

## 21. Authored content reconciliation (NPCs, owners, customers, muckers)

New authored content does NOT reach production by simply existing in code — two
gates matter:

1. **Boot content-sync** (`src/server/shim/main.ts`,
   `seedMissingLocalDevContentIntoExistingWorld`): on boot, production creates
   only the _missing_ content entities (it never rebuilds/overwrites terrain).
2. **Deploy reconciler** (`scripts/harthmere/reconcile-production-world-sync.cjs`,
   run by this deploy script with `APPLY=1` from an in-VNet runner against
   private Redis): it materializes the seed _families_ listed in its
   `seedFamilies` array.
   **When you add a new authored-content family (e.g. business owners), you MUST
   add it to that array** or it never lands in prod.
3. **Business outpost terrain materializer**
   (`scripts/harthmere/materialize-business-outposts-redis.cjs`): production
   must also write the voxel shard diffs for the authored shop buildings. The
   deploy script defaults this to `HARTHMERE_BUSINESS_OUTPOST_MATERIALIZATION_MODE=per-outpost`
   with `OUTPOST_ID=<id>` and small shard batches, because the single bulk
   materializer can exceed the production app container memory. Do not switch to
   bulk mode for production unless the container memory profile has been
   re-tested.

After reconciliation the deploy runs `audit_production_authored_content`,
which fails the deploy if business owners < 19, business crafting stations <
19, business customers < 57, muckers < 100, or Grove NPCs are missing. Once
that audit and the per-outpost terrain materialization pass, the deploy forces a
Redis `BGSAVE` so newly reconciled authored content and building voxel diffs are
durable before the next Redis restart. See
`src/shared/harthmere/harthmere-content-reaches-production` notes.

Id bands (offset on `SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE`): Grove NPCs 9301+,
robots 9401+, muckers 9451–9550, **business owners 9601–9619**, **business
crafting stations 9651–9669**, and **business customers 9701–9757** (19
businesses × 3 patrons = 57). Owners are `quest_giver`s at the counter;
customers are talkable flavor NPCs only. Owners/customers are grounded indoors
(`requireOpenSky=false`) so they stay on the building floor.

## 22. Entity terrain grounding and production placement map

The current placement source of truth is the generated production terrain
placement map:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md
src/shared/harthmere/production_terrain_placement_map.ts
src/shared/harthmere/generated/production_terrain_placement_map.ts
```

Use it for quest items, quest markers, monsters, NPCs, interactables, BiomesUI
map pins, HUD/minimap targets, active quest pointers, and random spawn pools.
The map is generated from real production terrain and records outdoor surfaces,
indoor/cave floors, cave/hollow clusters, and deterministic spawn points.

Regenerate it from production with read-only Azure/Redis access from an
Azure/VNet host that can reach private Redis:

```bash
az account show

HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12 \
NODE_OPTIONS=--max-old-space-size=8192 \
node scripts/harthmere/build-production-terrain-placement-map.cjs \
  --write \
  --stride=8 \
  --margin=64

node scripts/harthmere/check-harthmere-production-placement-map.cjs
```

The scanner uses `az account show`, `az containerapp show`, and Redis `mget`
terrain reads. It writes only local generated files/artifacts when `--write` is
present. It must not seed or mutate production, and Redis must not be reopened
publicly for this workflow.

Runtime rules:

- Fixed quest objectives use `resolveHarthmereQuestObjectivePlacement` or
  `getHarthmereQuestResolvedWaypoint`.
- Jobs Board, business, and live-helper markers use
  `resolveHarthmereProductionMarkerPosition` through their adapters.
- Random outdoor content uses `chooseHarthmereQuestOutdoorSpawnPoint`.
- Random cave content uses `chooseHarthmereQuestCaveSpawnPoint`.
- BiomesUI Map, HUD/minimap, quest pointer, server authority, and 3D markers
  should all use the same resolved `recommendedPosition`.

The client terrain grounder still exists as a final visual safety layer:

- Core (pure, tested): `src/shared/harthmere/harthmere_entity_grounding.ts`.
- Client adapter (terrain + water): `src/client/game/util/harthmere_entity_grounding.ts`.
- Spec + per-entity registry + live probe numbers:
  `src/shared/harthmere/harthmere_entity_grounding_manifest.ts`.

Do not patch invisible, underground, or floating content with magic Y constants.
Regenerate or inspect the production placement map instead, then wire every
player-facing surface to the same resolved position.

## 23. Mutable production hotfix layer

The mutable hotfix layer is the fast production repair lane for issues that
must be fixed and verified before the next image build. It is intentionally
runtime-first: a hotfix can be applied through
`/api/admin/mutable_hotfix`, persisted in Redis, and then automatically
re-applied on process restart without rebuilding the Docker image.

Enable it only on the revision that is being used for live repair:

```bash
GLITCH_MUTABLE_HOTFIX_ENABLED=1
GLITCH_MUTABLE_HOTFIX_TOKEN=<shared-secret>
```

For emergency throwaway sessions, `GLITCH_MUTABLE_HOTFIX_OPEN=1` bypasses the
token check. Prefer the token path even when moving quickly.

Hotfix manifests are JSON:

```json
{
  "version": "hotfix-v12",
  "description": "Patch live mode health handling",
  "operations": [
    {
      "type": "replace",
      "path": ".next/server/chunks/5005.js",
      "search": "old code",
      "replace": "new code",
      "expectCount": 1
    },
    {
      "type": "exec",
      "command": "node scripts/harthmere/live-smoke.cjs",
      "timeoutMs": 30000
    }
  ]
}
```

Supported operations:

- `writeFile`: write text or `contentBase64` to any file path.
- `replace`: literal or regex replacement with `expectCount`/`minCount`.
- `deleteFile`: remove a file or directory.
- `mkdir`: create directories.
- `exec`: run a shell command in the container.
- `eval`: run server-side JavaScript in the current process.
- `clearRequireCache`: evict CommonJS modules by `path` or substring `match`.

Apply and persist a hotfix:

```bash
curl -sS "$BASE_URL/api/admin/mutable_hotfix" \
  -H "Content-Type: application/json" \
  -H "X-Glitch-Mutable-Hotfix-Token: $GLITCH_MUTABLE_HOTFIX_TOKEN" \
  -d '{"action":"apply_and_persist","manifest":{...}}'
```

Check status:

```bash
curl -sS "$BASE_URL/api/admin/mutable_hotfix" \
  -H "X-Glitch-Mutable-Hotfix-Token: $GLITCH_MUTABLE_HOTFIX_TOKEN"
```

Reload the persisted Redis hotfix into the current process:

```bash
curl -sS "$BASE_URL/api/admin/mutable_hotfix" \
  -H "Content-Type: application/json" \
  -H "X-Glitch-Mutable-Hotfix-Token: $GLITCH_MUTABLE_HOTFIX_TOKEN" \
  -d '{"action":"reload","force":true}'
```

The startup scripts run `scripts/glitch/apply-mutable-hotfix.ts` before
launching web/stack processes, which is what makes the patch survive container
restarts. For an already-running process, call the API with `action:"reload"`
or `action:"apply_and_persist"`; for multiple replicas, invoke the endpoint on
each live replica or restart the revision so every process replays the same
Redis-persisted manifest.

After the live fix is verified, always back-port the same change into source,
add or update tests, and remove the Redis hotfix once a normal deployment
contains the fix.
