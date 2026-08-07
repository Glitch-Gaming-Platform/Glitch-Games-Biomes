# Production Sync watcher and Glitch install recovery incident — August 6, 2026

## Status

- Incident window: August 6, 2026, approximately 7:20–7:29 PM CDT
  (August 7, 2026, 00:20–00:29 UTC).
- User-visible impact: terrain stopped loading while the player traveled. The
  one-shot missing-terrain recovery reloaded the page, and the player landed in
  observer mode with `Login to Play` instead of resuming the Glitch install.
- Production deployment performed during investigation: **none**.
- Azure traffic or revision change performed during investigation: **none**.
- Code and tests were updated for the next authorized release only.

## Evidence

The HAR, browser log, screenshots, and Azure Container Apps logs agree on this
sequence:

1. The install entered through `/at?install_id=…&glitch_auto_play=1` and opened
   an authenticated `/sync` subscription.
2. At 00:23:02 UTC and again at 00:24:27 UTC, Sync logged
   `Sync server ignoring delete for self` for the active local-user target.
3. At 00:26:50 UTC the player reached approximately
   `[319.56, 56.40, -99.62]`, but terrain shard `[9,1,-4](25090104)` beneath the
   player was absent.
4. This was not a dead WebSocket. At the recovery report the client had 1,139
   terrain shards indexed, `/sync/subscribe` had returned 2,649 responses, the
   last Sync update was 39.6 ms old, and the last WebSocket message was 56.6 ms
   old. The values are milliseconds, not seconds.
5. At 00:26:57 UTC the existing one-shot protection emitted
   `Player remained in missing terrain; reloading once to rebuild the world subscription`.
6. The gameplay URL had been rewritten to
   `/at/Guest%20User?install_id=…&glitch_auto_play=1`. `Guest User` is a
   temporary label, not a durable Firestore username or public player slug.
7. The server rejected that slug and redirected to `/at`. Before this fix, the
   fallback redirect discarded the install query. In a third-party iframe, SSR
   could not rely on cookies, so it rendered an anonymous observer even though
   the browser still had the install-backed Biomes session and `/api/auth/check`
   succeeded with that remembered session.

Azure logs showed no matching revision activation, replica restart, platform
capacity event, server crash, or authentication 4xx/5xx burst. The WebSocket
closed only after the deliberate browser reload.

## Root cause

### 1. Sync lost the moving spatial watcher after a transient player delete

`SyncIndex` stores active `Scanner` watch buffers on the watched entity's
knowledge entry. On a delete, `SyncIndex.delete()` removed the entire knowledge
entry. The observer correctly ignored a delete for its required local player,
but the spatial watch attachment had already been lost.

When the player entity was recreated, its position continued updating and the
client continued receiving Sync traffic, but the scanner was no longer attached
to those position updates. The subscription bubble remained centered near the
old location. Once the player traveled far enough, the shard beneath the player
was outside the stale bubble and never entered the client's terrain table.

### 2. Recovery treated a temporary install label as a public player slug

The client permalink rewrite changed the install-backed route to
`/at/Guest User`. The missing-terrain recovery used `window.location.reload()`,
so it re-requested that observer-style slug instead of the canonical install
entrypoint.

### 3. Redirect and client runtime decisions depended too heavily on the URL

The invalid-slug redirect returned `/at` without the install query. Several
client decisions checked only `window.location.search`, even though the Glitch
install ID and Biomes auth session were also stored for cookie-restricted iframe
operation. That combination converted a recoverable terrain reload into the
observer/login screen.

## Fixes for the next authorized release

- `SyncIndex.delete()` retains active spatial watch buffers and reattaches them
  to the replacement knowledge entry. A recreated player therefore moves the
  existing subscription bubble again.
- Install-backed players no longer rewrite their gameplay URL to
  `/at/<temporary label>`.
- Game reload/reconnect paths recover through canonical `/at`, restore the
  stored `install_id`, force `glitch_auto_play=1`, and remove `anon`.
- Invalid `/at/<slug>` fallbacks preserve the trusted install identity instead
  of dropping it.
- The Glitch bootstrap detects an authenticated install that SSR rendered as an
  observer and performs a bounded canonical install recovery.
- Client Sync runtime selection recognizes a remembered install identity when
  the query was temporarily lost.
- Missing-terrain reports now include Sync radius, Sync target, pathname, and
  whether a Glitch install identity was available.

## Regression coverage

The focused tests cover:

- a local-user entity being deleted, recreated at a distant position, and the
  scanner following it to the new subscription bubble;
- preserving `install_id` through invalid-slug `/at` redirects;
- canonical recovery from `/at/Guest User` without `anon`;
- detecting an authenticated install that SSR rendered as an observer;
- both supported install ID query spellings and stored-ID fallback.

Run:

```bash
./node_modules/.bin/mocha --config .mocharc.json \
  src/server/sync/subscription/test/game_observer.test.ts

./node_modules/.bin/mocha --config .mocharc.fast.json \
  src/server/web/glitch_install_redirect.test.ts \
  src/shared/util/harthmere_auth_session.test.ts \
  src/client/game/glitch/test/harthmere_glitch_identity_normalization.test.ts

node scripts/harthmere/validate-harthmere-install-id-flow.cjs
node scripts/harthmere/test-harthmere-install-id-flow-unit.cjs
```

## Production diagnosis with Azure CLI

Use UTC timestamps that cover the browser report. The August 6 incident window
was `2026-08-07T00:20:00Z` through `2026-08-07T00:30:00Z`.

```bash
WORKSPACE_ID="35267849-a6b8-42be-9d23-26f96413c744"

az monitor log-analytics query \
  --workspace "$WORKSPACE_ID" \
  --analytics-query '
ContainerAppConsoleLogs_CL
| where TimeGenerated between (datetime(2026-08-07T00:20:00Z) .. datetime(2026-08-07T00:30:00Z))
| where ContainerAppName_s in ("biomes-node-vnet", "biomes-simulation-vnet")
| project TimeGenerated, ContainerAppName_s, RevisionName_s, ReplicaName_s, Log_s
| order by TimeGenerated asc
'
```

Search the output for these correlated signatures:

- `Sync server ignoring delete for self`
- `ClientInVoid`
- `Player remained in missing terrain`
- the affected player ID, client session ID, or server session ID
- unexpected `Disconnected`, restart, OOM, or Redis errors before the void
  report

Confirm that no rollout or control-plane mutation overlaps the window:

```bash
az monitor activity-log list \
  --resource-group openai-resource-group \
  --start-time 2026-08-07T00:20:00Z \
  --end-time 2026-08-07T00:30:00Z \
  --offset 1h -o table

az containerapp revision list \
  --resource-group openai-resource-group \
  --name biomes-node-vnet -o table

az containerapp revision list \
  --resource-group openai-resource-group \
  --name biomes-simulation-vnet -o table
```

## Triage rule

Do not classify this signature as a socket outage merely because the player is
in missing terrain. Read the units in the client cvals and compare all of the
following:

- `game.sync.lastUpdateAge`
- `network.<channel>.timeSinceLastMessage`
- `/sync/subscribe` response count
- `recentReconnectReasons`
- the required terrain shard ID and whether it is present
- server-side self-delete warnings and scanner/watcher state

If Sync updates remain fresh but the required shard is absent after a transient
self delete, investigate spatial watcher attachment first. Do not redeploy,
shift traffic, expand Azure capacity, or rotate authentication credentials as a
first response.

## Release boundary

This incident investigation intentionally stopped at source, tests, and
documentation. A later deployment must use the guarded deployment process and
must be explicitly authorized. Do not turn incident-note collection or task
handoff into an implicit production deployment.
