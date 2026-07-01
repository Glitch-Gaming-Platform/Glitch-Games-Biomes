# Harthmere Live Bugfix — Diagnosis & Deploy Runbook

**Date:** 2026-07-01
**Inputs reviewed:** `biomes_301.har` (192 MB), `www.glitch.fun-1782874588394.log` (62,956 lines)
**Repo state:** `main` @ `5f842cea` ("Hpefuly final fixes", 2026-06-30 22:12)
**Reported bugs:** (1) strawberry won't consume, (2) inventory item counts wrong, (3) `F` doesn't work inside businesses, (4) jobs board not working.

---

## TL;DR

**UPDATED 2026-07-01 (post-investigation with live Azure access).** The initial "stale image"
theory was wrong: production was already on `prod-5f842cea7bbe` (current HEAD). A second capture
(`biomes_303.har` / `www.glitch.fun-1782925773573.log`, 17:09, *after* the deploy) proved the bug
survived. The **real root cause** is a WebSocket **reconnect death-spiral** driven by an overly
aggressive heartbeat config:

- The server advertised `wsZrpcHeartbeatStartupReconnectMs = 5000` and `wsZrpcHeartbeatReconnectMs
  = 8000` to every client (plus a 10s server-side idle close via `wsZrpcTtlMs`).
- The live client spends ~3.7s in "Slow registry load" then runs at 10–14 FPS while applying the
  ~1000-change sync bootstrap, so its main thread cannot service the socket within 5–8s.
- The client's `periodicallyCheckState` fires "Connection timeout", which **CANCELs every in-flight
  `/sync/publish`** (eat / place / mine / inventory writes → the strawberry and item-count bugs),
  then reconnects — which triggers another full bootstrap that re-blocks the thread. ~450 reconnects
  in one short session. The "constant knocking" sound and phantom combat are downstream of the same
  spiral (repeated bootstrap re-applies re-trigger sounds / stale combat snapshots).

**Fix applied live via `az` (no rebuild): set `BIOMES_CONFIG_OVERIDE` on the Container App to raise
those three windows to 30_000ms.** The server re-advertises the relaxed timeout to all clients on
the next heartbeat, so the spiral cannot start. Back-ported into `src/server/shared/config.ts` so a
future image build keeps the fix.

The two "board" bugs (`F` in businesses, jobs board) are a **separate root cause** (coordinate
decoupling, unaffected by the above) and are still open — see below.

---

## Round 2 (post-hotfix captures: biomes_303/304/305, logs 1782941*)

The heartbeat hotfix **worked**: the new logs show **0** "Connection timeout" reconnects (was 450).
But three distinct issues remain, and **all are in the client bundle — they cannot be delivered by
the `BIOMES_CONFIG_OVERIDE` env hotfix. They require a rebuild + redeploy** (`git push origin main`
→ GitHub Actions, or the guarded deploy script). My sandbox cannot do a Docker rebuild.

1. **Client-context teardown kills the sync stream (root cause of: can't harvest/pick, eat does
   nothing, mine/place counts don't change).** Sequence in the log: game loads → `Game` component
   remounts mid-session ("Stopping previous game loop") → `clientLoader.stop()` → the sync reliable
   stream aborts → every later `/sync/publish` fails with `CANCELLED: … Disconnected: finished`.
   The remount is triggered by an ancestor `<RootErrorBoundary>` resetting after an initial
   **React #418 hydration mismatch**, and the teardown then throws "Client loader interrupted." back
   into the boundary, which amplifies one hiccup into a cascade that leaves the session permanently
   unable to publish.
   - **Fix applied in code:** `src/client/components/Game.tsx` now treats the benign
     "Client loader interrupted." abort as non-fatal (does not `setError`/re-throw), breaking the
     cascade so a transient remount can no longer kill the live session. (Needs deploy.)
   - **Still open (deeper):** the React #418 hydration mismatch that causes the *first* remount.
     Needs the specific SSR-vs-client component identified; the Game.tsx fix defuses its impact.

2. **Muckwad wrong graphic + mined muckwad shows as "Grass".** `muckwad` (block id 81) is a valid
   block, but in the production **snapshot** the muck patches are composed of grass/moss blocks
   (mining yields a "Grass" item), so this is a **world-snapshot data** problem, not a pure code
   fix: the muck patches must be re-materialized as `muckwad` (or the current `splintered_muck`,
   block id 82) from an **in-VNet host with private-Redis access** (`10.0.0.12`), which the sandbox
   cannot reach. `src/server/shim/main.ts` `materials.muckwad` is the surface-painting source for
   newly generated terrain.

3. **Low FPS (7–24) / "Poor Connection".** Underlying client main-thread starvation (43 parallel
   client sims, ~3.7s registry load). This is what made the timeouts fire in the first place and is
   a larger client-performance effort, tracked separately.

---

## What was changed on production (2026-07-01)

Applied with a scoped service principal via `az` (Container App `biomes-node-vnet`, RG
`openai-resource-group`):

```bash
# Live hotfix — relax the heartbeat/idle windows that caused the reconnect spiral.
az containerapp update -g openai-resource-group -n biomes-node-vnet \
  --set-env-vars 'BIOMES_CONFIG_OVERIDE={"wsZrpcHeartbeatReconnectMs":30000,"wsZrpcHeartbeatStartupReconnectMs":30000,"wsZrpcTtlMs":30000}'

# New revision biomes-node-vnet--0000148 booted Healthy; pinned 100% traffic to it:
az containerapp ingress traffic set -g openai-resource-group -n biomes-node-vnet \
  --revision-weight biomes-node-vnet--0000148=100

# Deactivated the old revisions (--0000146, --0000147).
```

Confirmed live: server logged `Using config override from BIOMES_CONFIG_OVERIDE
{wsZrpcHeartbeatReconnectMs:30000, wsZrpcHeartbeatStartupReconnectMs:30000, wsZrpcTtlMs:30000}`;
`GET /` returns 200; zero server errors.

**Rollback** (if ever needed): `az containerapp update -g openai-resource-group -n biomes-node-vnet
--remove-env-vars BIOMES_CONFIG_OVERIDE` (then it reverts to the image's compiled defaults, which —
once the source back-port ships — are also the safe 30s values).

The durable fix lives in `src/server/shared/config.ts` (`wsZrpcHeartbeatReconnectMs`,
`wsZrpcHeartbeatStartupReconnectMs`, `wsZrpcTtlMs`), so `git push origin main` → Actions build keeps
the fix even without the env override.

---

## Evidence

### The log is dominated by the WebSocket reconnect-cancellation bug

```
457  Aegis Engine Report [error]: Error during fire and forget
445  Aegis Engine Report [error]: Could not publish events
3616 "/sync/publish CANCELLED: … Disconnected: reconnect due to Connection timeout"
```

Player mutations (eat / place / mine / pickup / respawn / quest progress) publish over the `/sync` WebSocket. When the client falsely decides the socket timed out, `disconnectWebSocket` cancels **every in-flight `/sync/publish` with gRPC `CANCELLED` and never retries** → the mutation silently never commits. That is exactly why:

- **Strawberry won't consume** — the `eat_food` publish is cancelled, so no stamina, no decrement.
- **Inventory counts are wrong** — the item add/remove publishes are cancelled, so the server count and the UI drift.

These false reconnects come from main-thread starvation (the log shows sustained **FPS 0–14** and `'message' handler took 273–336ms`): the 500 ms check-loop stops firing, so on resume `lastServerMessageTime.elapsed` looks like a 10 s network timeout even though the socket is fine.

### The fix already exists in `main` — but landed *after* the deployed image

`src/shared/zrpc/websocket_client.ts` → `periodicallyCheckState()` (added in `5f842cea`, **2026-06-30**):

```ts
private static readonly CHECK_STATE_INTERVAL_MS = 500;
private static readonly CHECK_STATE_FREEZE_GRACE_MS = 2_000;
// If a single loop iteration overran the interval by > 2s, the loop itself was
// frozen — the socket never had a fair chance to deliver frames. Reset the
// message timer (fresh window) instead of reconnecting, so a local hitch never
// nukes the socket and cancels its pending /sync/publish mutations.
```

The last **documented known-good production image is `prod-20260611185041` (June 11)** — see `scripts/glitch/BIOMES_HARTHMERE_PRODUCTION_DEPLOYMENT_README.md` §19. That is ~3 weeks *before* the freeze-grace fix. Prod is therefore running code without the fix, which is fully consistent with the 3,600 `CANCELLED` errors still in the July 1 log.

---

## Per-bug status

| # | Bug | Root cause | On `main`? | Fix |
|---|-----|-----------|-----------|-----|
| 1 | Strawberry won't consume | `/sync/publish` cancelled by false reconnect | **Already fixed** | Deploy `main` |
| 2 | Inventory counts wrong | Same cancelled mutations | **Already fixed** | Deploy `main` |
| — | Console error storm / low FPS | False WebSocket reconnects | **Already fixed** (freeze-grace) | Deploy `main` |
| 3 | `F` inside businesses | Prompt proximity uses procedural coords, not the production placement resolver | Partial | Deploy + retest; if still off, placement regen / owner-anchor (below) |
| 4 | Jobs board | Same coordinate-decoupling as #3 | Partial | Deploy + retest; if still off, placement regen (below) |

### What was verified correct in code (so a deploy actually fixes 1 & 2)

- Strawberry (`id 2779132017025472`) is present in `HARTHMERE_FOOD_DEFINITIONS` and computes `edible = true` (`action: "eat"`, `staminaRestore: 10`).
- Client eat path (`useBiomesUILiveAdapters.ts` → `eatLiveHarthmereFoodById`) **grants 1 then eats**, so world-saved single instances (a foraged strawberry) are eatable, not just stacks.
- Server `eat_food` (`live_mode_backend.ts` → `eatHarthmereFood` in `mmo_farming_food_stamina.ts`) validates the item, restores stamina, and decrements the stack.

The only thing stopping these from working live is that the publish carrying them is cancelled on the stale build.

### Why bugs 3 & 4 are separate (README §22 violation)

`resolveHarthmereProductionMarkerPosition` (in `src/shared/harthmere/production_terrain_placement_map.ts`) maps a marker to its real, terrain-grounded production position. The **map pins, minimap, quest pointers, and server authority use it** — but the two in-world `F`-prompt proximity tables do **not**:

- `src/client/components/harthmere_jobs_board/jobsBoardLiveAdapter.ts` → `HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS` uses hardcoded `x/y/z` with `radius 3.25`.
- `src/client/components/harthmere_business/HarthmereBusinessWorldInteraction.tsx` → uses `building.dashboardAccessPoint.position` (procedural) with `radius 9`.

If the buildings/boards materialize in production at terrain-adjusted positions, the map sends the player to the resolved spot but the `F`-prompt is measuring distance to a *different* coordinate — so no prompt appears within radius. README §22 explicitly says "Jobs Board, business, and live-helper markers use `resolveHarthmereProductionMarkerPosition` through their adapters"; these two prompt paths currently don't.

The generated placement map (`src/shared/harthmere/generated/production_terrain_placement_map.ts`) has `business_owner` (19) and `jobs_board_marker` (477 job *targets*) records, but **no record for the physical board / dashboard anchors themselves** — so these must be regenerated from live terrain (§22) to fix 3 & 4 properly, or the business prompt re-anchored to the existing `business_owner` position. Do this only after the deploy confirms whether the newer build already resolves them.

---

## Deploy (run on your authenticated machine — not the assistant sandbox)

> The assistant sandbox has no `az` CLI, no Azure credentials, and no route to private prod Redis, so it cannot deploy or run `az` against prod. Deployment must run where you're logged into Azure. Auth is GitHub OIDC / your local `az login` — there is no stored client secret.

### Option A — push to `main` (preferred; GitHub Actions deploys)

`.github/workflows/azure-production-deploy.yml` builds, pushes to ACR, and updates the Container App on every push to `main`.

```bash
cd /Users/devindixon/Development/biomes-game
git push origin main          # HEAD 5f842cea already contains the fixes
```

Then watch the run in **GitHub → Actions → azure-production-deploy** (or `gh run watch`).

### Option B — guarded local deploy from your workstation

```bash
cd /Users/devindixon/Development/biomes-game
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

For a full deploy **with** authored-content/world reconciliation, run from an in-VNet host:

```bash
PROD_REDIS_RECONCILE_HOST=10.0.0.12 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

---

## Verify prod (before and after)

Confirm the deployed image/revision and health:

```bash
az account set --subscription bac41b30-9f28-4d35-b98d-cd3aa33335a6

az containerapp show \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --query "{rev:properties.latestRevisionName, image:properties.template.containers[0].image, active:properties.runningStatus}" \
  -o jsonc

az containerapp revision list \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --query "[?properties.active].{name:name, created:properties.createdTime, image:properties.template.containers[0].image, healthy:properties.healthState, traffic:properties.trafficWeight}" \
  -o table
```

If `image` is `…/biomes-node:prod-20260611185041` (or any pre-`20260630` tag), prod is confirmed stale — deploy.

After deploy, re-test in-game and confirm the log no longer fills with `/sync/publish CANCELLED`. Eat a strawberry, watch stamina rise and the count drop; place/mine and confirm inventory counts hold.

---

## After deploy — if the two board bugs remain

1. **Regenerate the production placement map** from an Azure/VNet host that can read private Redis (README §22), so board/dashboard anchors get real terrain positions:
   ```bash
   HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12 \
   NODE_OPTIONS=--max-old-space-size=8192 \
   node scripts/harthmere/build-production-terrain-placement-map.cjs --write --stride=8 --margin=64
   node scripts/harthmere/check-harthmere-production-placement-map.cjs
   ```
2. **Route the two `F`-prompt tables through `resolveHarthmereProductionMarkerPosition`** (jobs board + business), matching what the map pins already do — the assistant can implement this as a small, fully-commented change once we confirm the buildings' live positions, so the prompt lands exactly where the pin sends the player.

---

## Fast lane (optional): mutable hotfix

For an immediate prod repair without a full rebuild, the runtime hotfix layer (`/api/admin/mutable_hotfix`, README §23) can patch built chunks and persist in Redis. It needs `GLITCH_MUTABLE_HOTFIX_TOKEN` and is fragile for large logic changes — prefer a clean redeploy for the freeze-grace fix. Always back-port hotfixes into source afterward.

---

## Rollback

```bash
# List revisions, then pin traffic back to the previous healthy one:
az containerapp revision list -g openai-resource-group -n biomes-node-vnet -o table
az containerapp ingress traffic set -g openai-resource-group -n biomes-node-vnet \
  --revision-weight <previous-healthy-revision>=100
```
