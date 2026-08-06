# Harthmere multiplayer combat and performance audit — 2026-08-06

## Outcome

The reported combat behavior was real. Once a player attacked a Hex, Mucker,
boss, worm, animal, or other retaliation-capable native NPC, clean terrain and
safe-zone checks intentionally reduced the active encounter to the direct
attacker. Pack members could join the fight, but they all selected that same
opener. This exactly reproduced the report that the creatures attacked one
player while ignoring another player standing in the fight.

The native ECS/Anima policy now separates **proactive aggro** from an **active
retaliation encounter**:

- safe zones and clean terrain still prevent an unprovoked creature from
  starting combat;
- a real negative `Health` attack event opens an 18-metre bounded encounter;
- every alive, non-peace player in that vicinity is then an eligible target,
  including players on protected or clean terrain;
- the direct attacker remains first, while authored responder rank and the
  six-second rotation clock distribute later responders/exchanges;
- sight-bound creatures still require line of sight for a non-opener;
- unrelated creature groups, civilians, quest givers, passive animals, and
  unrelated escorts remain excluded;
- a combat NPC/player escort is eligible when it opened the encounter or its
  public combat state shows that it is actively attacking the creature.

Jobs-board player escorts now default to `defend_leader`. They can interrupt
escort movement, fight an attacker, receive receipt-authorized NPC melee or Hex
ranged damage, and resume escort movement afterward. Authored escort policies
remain authoritative. Invulnerable escorts can assist but still reject harmful
health mutations.

## Evidence reviewed

Client captures:

- `www.glitch.fun-1785980429833.har` and `.log`, covering approximately
  2026-08-06 01:40:19–01:40:40 UTC;
- `www.glitch.fun-1785980972721.har` and `.log`, covering approximately
  2026-08-06 01:46:47–01:49:40 UTC.

Azure CLI evidence:

- subscription `Azure subscription 1`;
- `biomes-node-vnet`, revision `biomes-node-vnet--0000232`, three replicas,
  each 4 CPU / 16 GiB, image `biomes-node:prod-20260805-app-only-r2`;
- `biomes-simulation-vnet`, revision `biomes-simulation-vnet--0000037`, one
  replica, 4 CPU / 16 GiB;
- Log Analytics `ContainerAppConsoleLogs_CL` for 2026-08-06
  01:40:00–01:50:00 UTC;
- all three current `biomes-node-vnet` replicas were ready with restart count
  zero at audit time.

The HAR files do not expose individual WebSocket frames. The console logs do
prove that the Sync WebSocket connected, and the HAR records the separate
`/sync/oob` bootstrap traffic.

## Measured client/network performance

| Measurement | First capture | Second capture |
| --- | ---: | ---: |
| Duration | 21.0 s | 172.9 s |
| Requests | 89 | 1,103 |
| Mean request time | 731.9 ms | 586.1 ms |
| p50 | 150.8 ms | 110.1 ms |
| p95 | 2,881.3 ms | 2,680.1 ms |
| p99 | 3,351.4 ms | 4,361.4 ms |
| Maximum | 4,718.6 ms | 5,747.9 ms |
| Maximum concurrent HAR requests | 7 | 92 |
| Recorded transfer | 55.7 KB | 43.6 MB |
| HTTP failures in HAR | 0 | 0 |

The response codes alone look healthy, but the tail latency is not. A two- to
five-second request tail is long enough to make movement, combat feedback,
voice, saves, and HUD reconciliation feel delayed even when every request
eventually returns 200/201.

### Largest latency sources in the longer capture

| Path/operation | Count | p50 | p95 | Maximum / volume |
| --- | ---: | ---: | ---: | ---: |
| `/api/glitch/harthmere` (all operations) | 215 | 1,813.7 ms | 3,826.0 ms | 5,630.7 ms |
| `voicePoll` | 73 | 1,672.2 ms | 2,239.1 ms | 3,216.7 ms |
| `voicePacket` | 35 | 2,102.3 ms | 5,343.8 ms | 5,630.7 ms |
| `voiceHeartbeat` | 12 | 1,648.6 ms | 2,436.2 ms | 2,594.7 ms |
| `storeSave` | 50 | 2,611.8 ms | 4,018.5 ms | 4,361.4 ms |
| Chapter 1 gate/progress/story | 362 | 105–126 ms p50 | 841–1,029 ms | repeated POST polling |
| `/sync/oob` | 48 | 525.8 ms | 2,695.6 ms | 12.4 MB |
| generated player meshes | 74 | 9.7 ms | 4,000.4 ms | 22.1 MB |
| other GLTF/GLB models | 72 | 5.4 ms | 867.6 ms | 6.2 MB |
| WASM bootstrap | 1 | 4,916.5 ms | — | 1.11 MB |

The capture reached 6.38 requests/second and 92 simultaneous requests. That is
not one slow combat packet; it is overlapping voice signaling, cloud save,
telemetry, Chapter 1 reconciliation, Sync bootstrap, player-mesh generation,
models, audio, and third-party media.

## Azure server evidence

Across the ten-minute Azure window, the web revision recorded:

- 604 `200`, 121 `201`, and 14 `409` responses from
  `/api/glitch/harthmere`;
- 992 `GLITCH_API_CALL_SLOW_OR_ERROR` warnings;
- 398 `GLITCH_HARTHMERE_ROUTE_SLOW_OR_ERROR` warnings;
- 557 slow `recordEvent` upstream calls (p50 2.10 s, p95 2.78 s);
- 126 slow voice polls (p50 1.67 s, p95 2.21 s);
- 104 slow voice packet sends (p50 1.90 s, p95 4.08 s, max 4.92 s);
- 121 slow cloud saves (p50 2.27 s, p95 3.05 s), plus 14 save conflicts;
- 16 slow progression submissions, with a measured maximum of 7.04 s;
- 749 Chapter 1 gate, 570 progress, and 349 story requests — 1,668 state
  reconciliation requests in ten minutes.

The native Harthmere state endpoints themselves were normally fast on the
server: the Chapter 1 gate/progress/story p95 values were 48.5/66/62 ms in the
aggregate Azure logs. Their much longer browser timings therefore include
queueing, connection contention, main-thread scheduling, and overlapping work,
not only endpoint execution.

The simulation app also recorded three shard-holder rebalances in the same
window, including 39 `no longer held`, 39 `now held`, and 26 `popped` messages.
That is not enough to prove it caused the fight, but it is a credible source of
short-lived simulation jitter and should be correlated with player-visible
spikes.

## Browser/main-thread evidence

The first console capture contained four low-FPS warnings, eleven 429/Too Many
Attempts messages, three player-voice failures, and registry loads of 464 ms and
3,099 ms. The second contained eleven low-FPS warnings, 409
`requestAnimationFrame` long-task warnings, five broken
`Titles.createEvent` calls, and registry loads of 622 ms and 2,223 ms.

The GPU benchmark reported an Apple M1 Max at tier 3 and about 556 benchmark
FPS, so the observed 10–14 FPS is not explained by weak graphics hardware. The
dominant problem is application work and request/asset pressure on the main
thread and web process.

## Combat implementation changes

The source changes are centered on:

- `src/shared/npc/threat.ts` — deterministic encounter participant ordering;
- `src/shared/npc/behavior/chase_attack.ts` — bounded multiplayer
  participation, responder distribution, safe-zone/proactive-aggro separation,
  NPC escort participation, LOS, peace mode, and rotation;
- `src/shared/npc/simulated.ts` — player damage uses
  `UpdatePlayerHealthEvent`; NPC/escort damage uses `UpdateNpcHealthEvent`;
- `src/server/logic/events/handlers/npc.ts` — receipt-backed NPC-to-NPC melee
  and ranged damage with replay protection;
- `src/server/harthmere/escort_companion_npc_ecs.ts` — default
  `defend_leader` behavior for generic player escorts;
- `scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs` — two real
  clients, complete authored-pack observation, real player attack authority,
  negative group control, canonical cleanup, and non-fail-fast scenario
  reporting.

One additional product defect was fixed: `SimulatedNpc` could acquire a private
`chaseAttack.attackTarget` without publishing the new target when poise and the
rest of public combat state were unchanged. The public combat-state comparison
now includes the target, so multiplayer clients receive the authoritative
selection.

The live harness also now owns the attacker's combat preconditions. Logic does
not trust the requested HP delta; it validates the authoritative selected item,
level, cadence, reach, and player health. Depending on whichever item a reused
visual-auth player last selected made the same test pass or time out. The gate
stages a `training_dagger`, proves the real `UpdateNpcHealthEvent`, and restores
the player's inventory, selected item, trigger state, health, and position.

## Verification

Fast and server gates, run as non-fail-fast batches:

- `scripts/harthmere/t.sh combat`: **165 passing**;
- native NPC health + escort ECS suites: **41 passing**;
- runner contract + simulated combat state + threat targeting: **29 passing**;
- shared Anima combat typecheck: **pass**;
- server Anima combat typecheck: **pass**;
- runner syntax and scoped `git diff --check`: **pass**.

Authenticated two-player production-shaped browser report:

- artifact:
  `artifacts/harthmere-native-ecs-e2e/1786007751376-13148-report.json`;
- overall status: **PASS**, four reported scenarios, zero browser failures;
- real `UpdateNpcHealthEvent`: accepted in 1,725 ms;
- authoritative health mutation: 30 ms after acceptance;
- originating browser ECS sync: 1,091 ms;
- complete authored pack distributed across both player IDs in 5,670 ms;
- three active responders were observed;
- the different authored road group did not join;
- solitary six-second rotation remains an opt-in live diagnostic and is covered
  deterministically in unit tests by default.

The in-app browser also loaded `http://127.0.0.1:3017/at` through the loading
screen into the rendered Grove observer view with one active WebGL canvas. That
browser had no Glitch install identity, so it correctly fell back to
`Observing The Grove` / `Login to Play` and logged `INSTALL_NOT_FOUND`; it was
not used as authenticated gameplay evidence. The authenticated two-client gate
above is the live combat authority.

## Runtime hotfix and cleanup

The validated local runtime used a surgical standalone-Anima bundle hotfix,
not an image rebuild. A broad server compile was attempted once and immediately
rejected because unrelated dirty-worktree interior code made the replacement
app fail at `mail_post_house:mail_bench has no safe interior slot`. The previous
generated server artifacts and original app container were restored before
testing continued. This is the exact failure mode the Fast Testing Guide warns
about: do not turn a scoped combat fix into a dirty-tree rebuild.

Final local runtime:

- client/app BUILD_ID: `warm-20260806044501`;
- app container: `aaa18e2d3c3a`, healthy, restart 0, OOM false, `/` HTTP 200;
- Sync: TCP 4907 healthy;
- Redis: `6c0a2ab12fe0`, healthy, restart 0, OOM false, `PONG`, DB size 332,923;
- standalone Anima: `df9f722a2e0b`, restart 0, OOM false;
- Anima hotfix build: `warm-20260806090740`;
- final Anima bootstrap: 300,902 entities, followed by `anima now running`;
- all eight authored combat identities were restored from canonical production
  seeds with Anima stopped after the browser run;
- no task-owned Playwright/native-ECS runner remained alive.

The source changes must be compiled normally by the clean commit/deploy job.
The local `dist/anima.js` mutation is runtime evidence only, not the source of
truth for deployment.

## Recommended multiplayer performance work

### P0 — remove Glitch proxy latency from the gameplay critical path

Voice signaling, cloud save, progression, and telemetry share
`/api/glitch/harthmere`, where measured p95 values are two to five seconds.
Move voice signaling to a dedicated WebSocket/SSE service or direct low-latency
signaling channel. Queue cloud save, progression, and behavior telemetry behind
bounded background workers so gameplay and Sync are never waiting on the Glitch
upstream. Keep one request in flight per operation, use idempotency keys, add
429/5xx circuit breakers, and batch telemetry.

The current worktree already contains important guards — one cloud-timer owner,
single-flight progression, save coalescing, content-fingerprint no-op saves,
bulk behavior events, and accepted optional-telemetry failures. These should be
verified in the deployed revision because the captures still show the old
request storm shape.

### P0 — replace independent Chapter 1 pollers with one shared state stream

Gate, progress, and story state generated 1,668 server requests in ten minutes.
Publish authoritative Chapter 1 deltas through the existing Sync/event path and
retain one slow reconciliation fetch (5–10 seconds, visibility-aware) for
recovery. At minimum, share one single-flight poll result among all mounted
consumers and stop polling hidden/unmounted surfaces. The current 2 s gate and
objective plus 6 s projection intervals are better than sub-second polling but
still overlap.

### P1 — reduce Sync bootstrap/OOB cost and main-thread apply work

The longer capture moved 12.4 MB through 48 `/sync/oob` requests with a 2.70 s
p95. Tighten interest management, delta-compress and chunk large bootstrap
payloads, prioritize combat/near-player deltas, and move decode/apply work off
the render frame where possible. Measure server event acceptance, authoritative
ECS mutation, client receipt, and rendered response separately; the live combat
gate now records the first three.

### P1 — eliminate asset bursts during multiplayer entry

Player meshes alone transferred 22.1 MB and had a 4.0 s p95. Models added about
6.2 MB. Deploy the semantic player-mesh cache, in-flight compute joining,
bounded compute queue, immutable cache headers, LOD selection, and lazy
appearance loading already present in the worktree. Avoid generating every
remote player's full mesh during the same frame/bootstrap window, and keep
audio/YouTube/third-party media out of the initial gameplay critical path.

### P1 — enforce a render-frame budget

The 409 `requestAnimationFrame` violations and 10–14 FPS warnings on an M1 Max
show that the client is doing too much synchronous work. Cap per-frame entity
materialization, mesh attachment, marker/HUD reconciliation, and animation work;
spread queues across frames; use lower remote-player/NPC LODs; and record p50,
p95, and worst-frame CPU by subsystem instead of only a generic low-FPS alarm.

### P1 — investigate simulation shard rebalancing

Correlate holder rebalances with combat and Sync latency. If they line up, pin
the production simulation replica/lease long enough to avoid churn, add lease
hysteresis, and expose a player-facing metric for the interval between shard
loss and reacquisition.

### P2 — remove noisy integration failures

Fix the broken `Titles.createEvent` integration, back off voice on 429, and
separate expected observer `INSTALL_NOT_FOUND` from actionable gameplay errors.
Noise makes real combat/sync failures harder to identify and can itself trigger
retry work.

## Release acceptance targets

For a normal two-player fight, use these targets after deployment:

- attack event acceptance p95 below 250 ms;
- authoritative health/target mutation p95 below 150 ms after acceptance;
- remote client combat-state receipt p95 below 350 ms;
- rendered hit/target feedback p95 below 500 ms;
- no duplicate cloud/heartbeat/polling controller stacks;
- no request family with more than one in-flight poll per player;
- zero safe-zone collapse of an already-active retaliation encounter;
- zero unrelated-group or civilian collateral targets;
- zero replayed NPC-to-NPC damage receipts.

The local live gate is functionally green, but its measured 1,725 ms event
acceptance and 1,091 ms browser ECS sync show why the performance work above is
still necessary.
