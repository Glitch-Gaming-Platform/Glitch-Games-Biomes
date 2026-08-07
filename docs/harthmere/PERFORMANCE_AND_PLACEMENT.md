# Harthmere Performance And Placement Guide

Last updated: 2026-08-05

This guide is the current operating contract for Harthmere placement,
streaming, NPC grounding, quest markers, and performance diagnostics.

## August 5 Production Battle FPS Incident

The production `last_battle.har`/`last_battle.log` capture covered about 163
seconds and reproduced the combat slowdown at 3-14 FPS. The game-owned evidence
was:

- six independent `ThreeObjectPreview` WebGL renderers initialized immediately
  before the first 3 FPS sample;
- 855 Chrome long `requestAnimationFrame` handler warnings;
- 173 Chapter 1 gate state POSTs, 144 objective state POSTs, and 78 story state
  POSTs in the same short session;
- 28 `storeSave` calls, more than one bridge controller's minimum cadence allows,
  indicating an async stopped-controller timer leak;
- 67 player-voice polls and 20 signaling packets while player voice was enabled;
- additional ad/YouTube/AMP work in the outer `www.glitch.fun` host. That outer
  work is real contention but cannot be fixed in the game repository.

The grouped game hotfix is deliberately frame-budget first:

1. `ThreeObjectPreview` waits for a real IntersectionObserver sample before
   allocating WebGL, renders only while visible/intersecting/laid out, drops its
   renderer while hidden, and checks inactive previews at 4 Hz instead of
   running a full RAF loop. It also uses one bounded manual delta rather than a
   deprecated `THREE.Clock` per preview.
2. A stopped Glitch bridge cannot resume after install/cloud-restore awaits and
   install a second autosave/progression/heartbeat stack. Timer installation is
   both lifecycle-gated and idempotent.
3. Chapter 1 proximity reconciliation remains responsive at 2 seconds, while
   story projection reconciliation moves to 6 seconds. Mutations and story
   events still refresh immediately, so this removes redundant POST/render churn
   rather than delaying authored actions.
4. Lock-on target projection is sampled at 80 ms and publishes only one compact
   target state. It reuses the existing combat actor registry and native attack
   authority; it does not add a second AI, damage, or renderer loop.

Regression commands:

```bash
scripts/harthmere/t.sh perf
scripts/harthmere/t.sh combat
node_modules/.bin/mocha --config .mocharc.json \
  src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts
node_modules/.bin/tsc -p tsconfig.ch1renderer.json --noEmit
```

Live acceptance must exercise preview panels before fighting, then compare an
idle and multi-enemy sample on the exact final artifact. A root health response,
source inspection, or a screenshot without FPS/renderer/console evidence is not
an FPS pass.

## August 7 Physical iPhone Fight Hotfix

The connected iPhone 12 mini (`iPhone13,1`, iOS 26.5.2) exercised build
`warm-grove-quest-audit-20260807-r3` through the normal cached LAN web origin
and direct Sync. The valid unhotfixed 20-second row measured about 6 FPS while
already at 0.3 render scale, 48 m draw distance, no bloom/AA/SSAO, and a
15-entity draw limit. Performance API scopes proved this was not a terrain or
postprocessing problem:

- median/average CPU render work was about 18/21.9 ms;
- `rendererScripts:overlay` alone averaged 10.0 ms with a 19 ms p95;
- terrain rendering averaged 0.5 ms, resource collection 0.34 ms, and render +
  postprocessing 2.3 ms; and
- iOS delivered rendered frames roughly 130-167 ms apart while device thermal
  budgets were constrained. The game therefore had a controllable overlay CPU
  cost plus a separate device scheduler/thermal limit.

The mobile-only hotfix bounds complete overlay-map reconstruction to 80 ms
under normal frames and 200 ms after a severe `>=100 ms` frame gap. Desktop
still rebuilds overlays every frame. Simulation, input, cursor/combat authority,
networking, and rendering cadence are unchanged; only derived nameplate,
prompt, and projection presentation is sampled.

No-rebuild physical A/B results on the same phone/build:

| Row                             |  FPS | Overlay average | CPU render average | Authoritative damage |
| ------------------------------- | ---: | --------------: | -----------------: | -------------------: |
| Unhotfixed idle                 | 5.99 |        10.02 ms |           21.91 ms |                  n/a |
| Hotfixed idle                   | 7.63 |         0.79 ms |            6.95 ms |                  n/a |
| Hotfixed five-enemy combat      | 8.49 |         0.86 ms |            9.45 ms |                   88 |
| Final cleaned hotfix idle       | 8.03 |         0.79 ms |            6.49 ms |                  n/a |
| Final cleaned five-enemy combat | 8.67 |         0.78 ms |            6.72 ms |                   59 |

Both fight rows contained trusted touch `pointerdown`/`touchstart` input and a
server-authoritative HP reduction. The final cleaned row reused the stable
`PhysicalIPhoneFight-99001E` device actor, deleted the remaining stale
timestamped test actor before navigation, created five enemies, delivered one
trusted primary-action touch, and reduced the target from 1,000,000 HP to
999,941 HP. The report completed with `status: pass` and no page errors.

This is a functional physical-fight pass, not the final 20 FPS or ten-minute
performance acceptance. The runner used observation mode so the sub-20 FPS
result would be preserved instead of discarded as a threshold failure. Even
after the controllable overlay cost fell from 10.02 ms to 0.78-0.79 ms and total
CPU render work fell to 6.49-6.72 ms, iOS delivered frames 118.9-124.5 ms apart
on average and the phone remained thermally constrained. Do not claim the
remaining acceptance gates are closed until the same immutable build completes
the required ten-minute real-fight soak at the documented frame target.

A second instrumentation A/B restarted the Mac-side SafariDriver server without
its global `--diagnose` flag and requested `safari:diagnose: false`. The page
reported `visibilityState: visible`, `document.hidden: false`, and
`document.hasFocus(): true`, but rAF still measured 8.37 FPS idle / 8.47 FPS in
combat while CPU render work remained only 6.27-7.70 ms. Diagnostic collection
therefore was not the 8-9 FPS cause. That comparison's trusted touch caused no
authoritative HP change, so it is performance-only evidence, not another fight
pass. The runner now enforces positive authoritative damage even in observation
mode; observation relaxes FPS thresholds only.

The exact-window filtered device log for that comparison advanced throughout
the run, contained constrained thermal/granted-budget records, and contained no
matching memory-highwater jetsam or WebGL context-loss event. This closes the
telemetry gap in the earlier clean row without converting the sub-20 FPS result
into an acceptance pass.

Evidence:

```text
artifacts/harthmere-physical-iphone-fight/physical-iphone-fight-r3-timings-20260807/report.json
artifacts/harthmere-physical-iphone-fight/physical-iphone-fight-r3-overlay-hotfix-20260807/report.json
artifacts/harthmere-physical-iphone-fight/physical-iphone-fight-r3-final-clean-hotfix-20260807/report.json
artifacts/harthmere-physical-iphone-fight/physical-iphone-fight-r3-no-diagnose-hotfix-20260807/report.json
artifacts/harthmere-physical-iphone-fight/physical-iphone-fight-r3-no-diagnose-hotfix-20260807/device-syslog-acceptance.log
scripts/harthmere/mobile-overlay-performance-hotfix-2026-08-07.js
scripts/harthmere/test-harthmere-physical-iphone-fight.cjs
```

Focused source validation: the mobile overlay cadence tests pass (4 assertions)
and `scripts/harthmere/t.sh perf` passes its 51-test performance batch and
current source guardrails.

The core rule has two coordinate spaces. The original snapshot/Grove terrain is
hilly and must be sampled. The additive Harthmere extension is deliberately
flat at ground Y=52 / feet Y=53. Streets, roofs, indoor floors, water, caves,
and hollows still determine whether a placement is outdoor, indoor, or an
intentional negative-Y dungeon coordinate.

See also:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md
docs/harthmere/HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md
docs/harthmere/BUILD_PERFORMANCE_FINDINGS_2026-07-24.md
docs/harthmere/HARTHMERE_LIVING_QUARTERS_PERFORMANCE.md
docs/THREEJS_UPGRADE_MAP.md
docs/docs/basics/voxeloo.md
```

## Placement Source Of Truth

The generated production placement map lives at:

```text
src/shared/harthmere/generated/production_terrain_placement_map.ts
```

Runtime code should consume it through:

```text
src/shared/harthmere/production_terrain_placement_map.ts
```

Regenerate and check it with:

```bash
NODE_OPTIONS=--max-old-space-size=8192 \
node scripts/harthmere/build-production-terrain-placement-map.cjs \
  --write \
  --stride=8 \
  --margin=64

node scripts/harthmere/check-harthmere-production-placement-map.cjs
```

Current placement rules:

- Fixed quest objectives use `resolveHarthmereQuestObjectivePlacement` or
  `getHarthmereQuestResolvedWaypoint`.
- Jobs-board, business, and live-helper markers use
  `resolveHarthmereProductionMarkerPosition` through their local adapter.
- Random above-ground placement uses `chooseHarthmereQuestOutdoorSpawnPoint`.
- Random cave placement uses `chooseHarthmereQuestCaveSpawnPoint`.
- BiomesUI map markers, HUD/minimap targets, quest pointers, server authority,
  and 3D markers must all consume the same resolved `recommendedPosition`.

## NPC and object grounding

For additive Harthmere town NPCs, use a stable authored X/Z anchor and let the
runtime normalizer set feet Y=53. The old per-cluster Y values were measured on
the retired overlapping snapshot layout and apply only to standalone legacy
mode. When adding a town NPC:

1. Identify a clear intended X/Z near the correct building or road.
2. Add the NPC to `HARTHMERE_NPC_STABLE_ANCHOR`; use the base Y in authored
   data because the additive runtime owns the final Y=53.
3. Add matching quest-target labels to
   the shared transformed marker source when needed.
4. Re-run the coordinate contracts and production grounding gate.

For original-map Grove NPCs/hostiles, use open-sky terrain grounding. For
roofed business NPCs and seeded crafting stations, use nearest-floor grounding
without open sky. Never flatten original-map content to Y=53.

Anchored NPCs bypass the safe-relocation pass. That relocation pass is useful
for ambient placement, but it can collapse nearby named NPCs onto the same
"first clear" column. The shared `HarthmereNpcClaimSet` keeps anchored NPCs
separated by applying deterministic small nudges only when a claimed XZ would
otherwise collide.

## Diagnostic Buckets

Town residents and wandering wilds creatures are separate diagnostic channels.
Wandering creatures can legitimately move off their initial sample point, so
do not hide town grounding bugs by loosening a global tolerance.

The auto-survey reports:

- `offGroundCount` for town residents.
- `offGroundWanderingCount` for wilds creatures.

Town resident warnings should stay strict. Wandering warnings are useful only
when the count is high enough to suggest a placement or motion bug rather than
normal movement.

## Performance Guardrails

The survey and runtime diagnostics must not create the performance cliff they
are trying to measure.

Current guardrails:

- Keep retained survey samples capped.
- Keep default NPC and streaming scan radii modest.
- Keep worst-frame history capped.
- Auto-throttle survey sampling when frame rate stays low.
- Pre-warm shard rings on spawn and after long fast-travel moves.
- **Never issue an unbounded number of `terrainMarch` calls in a per-frame
  script.** Any occlusion or line-of-sight test that runs once per entity must
  be memoised and capped per frame. See the 2026-08-03 captured session below.
- **Never call `resources.update` on a React-observed resource unconditionally
  in a per-frame path.** Compare first. An unconditional update reconciles the
  whole HUD at frame rate.
- **Do not gate non-town systems on
  `shouldRenderHarthmereRuntimeAssets()`.** That flag is true on localhost and
  false in production. Anything gated on it is, by definition, never tested by
  the thing it exists to improve. The shard pre-warm below was gated this way
  from the day it was written.
- **A listener, timer or rAF loop registered unconditionally must not have its
  only consumer behind a gate.** That split — register in the constructor,
  consume in `draw()` — is how the combat VFX and the player weapon rig both
  ended up computing every frame in production and drawing nothing.
- **Never disable an adaptive system in order to make a device start
  conservatively.** Set its _starting value_ and _clamp its range_ instead.
  `forceRenderScale = 0.5` on mobile looked like a conservative default but it
  short-circuits `computeRenderScale` before the `dynamic` branch, which
  disabled the entire quality ladder on phones — the same defect finding 13
  fixed for desktop. Starting point and permitted range are different knobs;
  conflating them costs the adaptation. See the 2026-08-04 batch below.
- **A phone-only fix that depends on CSS `env(safe-area-inset-*)` must confirm
  `viewport-fit=cover` is on the viewport meta.** Without it iOS reports every
  inset as `0px` and each `max(fallback, env(...))` silently returns its
  fallback, so the fix appears to work in portrait and quietly fails against
  the landscape notch.

Fast-travel destinations should queue the pre-warm ring before the player
camera engages. The pre-warm descriptor lives in
`HARTHMERE_PERF_AND_PLACEMENT_PREWARM`.

**2026-08-03:** the pre-warm was documented here as shipped but had in fact
never run for a player. `TerrainRenderer.updateHarthmereTerrainPrewarm`
early-returned on `!shouldRenderHarthmereRuntimeAssets()` — true on localhost,
false in production — even though it reads only native terrain resources
(`/ecs/terrain`, `/terrain/occluder`, `/terrain/combined_mesh`) and has nothing
to do with Harthmere runtime assets. It borrowed that flag because its tuning
constants live in `town_production_polish.ts`. The gate is removed and the
`harthmere_runtime_mode` import is gone from `terrain.ts` entirely.

## Production FPS Baseline — 2026-08-01

The production investigation sampled Azure Container App
`biomes-node-vnet` in resource group `openai-resource-group` after the latest
user-provided build went live.

Observed revision and image:

```text
revision: biomes-node-vnet--0000210
image: glitchgames.azurecr.io/biomes-node:prod-20260731-ch1-repair-r4
traffic: 100 percent
replicas: 3 healthy, 0 observed restarts
```

Two replicas exposed enough client telemetry for a stable comparison. A third
interactive metrics request was rate-limited, so it was not included in the
averages.

| Metric                    | Previous production sample | 2026-08-01 build |
| ------------------------- | -------------------------: | ---------------: |
| Render interval           |                   82–85 ms |     63.8–70.8 ms |
| Approximate aggregate FPS |                  11.8–12.2 |        14.1–15.7 |
| CPU render time           |                   57–60 ms |     47.0–47.7 ms |
| GPU render time           |                 about 8 ms |       5.3–8.0 ms |
| Event-loop latency        |                 140–147 ms |     83.8–87.1 ms |
| Render + postprocessing   |               not isolated |     19.8–20.2 ms |
| Script controller         |               not isolated |     0.53–0.58 ms |

The live browser's Aegis monitor still reported sustained values around
9–13 FPS while standing in the production town. The difference from the
aggregate sample is expected: the browser measurement includes the Glitch
wrapper, HUD, current view, and that specific client session.

### Bottleneck conclusion

The remaining problem is CPU/main-thread pressure, not lack of GPU capacity.
GPU work is well below the CPU frame time. Lowering render resolution alone
cannot recover the missing frame time because scene construction, hierarchy
walking, animation/material updates, JavaScript event work, and WebGL draw-call
submission happen on the CPU.

The reported JavaScript heap was roughly 1.2–1.8 GB in the sampled clients.
Do not classify that as a JavaScript leak from this signal alone. WebAssembly
memory, ArrayBuffers, geometry, and other browser-managed allocations can be
represented in or adjacent to this number. Compare these cvals before changing
the Voxeloo memory budget:

```text
memory:usedJSHeapSize
memory:voxeloo:totalMemory
memory:voxeloo:usedMemory
memory:voxeloo:freeMemory
```

### Production follow-up — 2026-08-02

The final upgraded production image was inspected read-only after the user
confirmed the complete stack was current:

```text
revision: biomes-node-vnet--0000215
image: glitchgames.azurecr.io/biomes-node:harthmere-consolidated-final-20260802-r2
traffic: 100 percent
replicas: 3 healthy, 0 observed restarts
```

Two active client samples again proved a CPU/main-thread limit:

| Metric                  |    Replica sample A |    Replica sample B |
| ----------------------- | ------------------: | ------------------: |
| Render interval         | 87.65 ms (11.4 FPS) | 65.46 ms (15.3 FPS) |
| CPU render time         |            66.10 ms |            49.37 ms |
| GPU render time         |            11.03 ms |            12.53 ms |
| Event-loop latency      |            134.0 ms |            108.9 ms |
| Render + postprocessing |            28.10 ms |            26.14 ms |
| Reported JS heap        |       about 1.09 GB |       about 1.25 GB |

The browser Aegis overlay ranged from roughly 5-14 FPS in the same Grove view.
There were only 11-19 rendered NPCs and one player in the aggregate samples,
so the result is not explained by a runaway actor count. GPU time remained far
below CPU time; reducing resolution or increasing GPU utilization is not the
primary remedy.

The accompanying production HAR covered about 13.7 seconds and exposed two
additional avoidable sources of main-thread/server pressure:

- Chapter 1 gate, story, and objective state were requested independently at
  750-1000 ms intervals. Identical responses still republished React/renderer
  state, and the story controller rebuilt puppet overrides every second.
- One `storeSave` uploaded about 140 KB, took about 3.1 seconds, and returned
  about 595 KB because the server echoed the complete Base64 payload the client
  had just uploaded. The client only needs the returned save id/version.
- Production console logs showed external behavior-event calls commonly taking
  about 1.8-2.4 seconds each. A serial 25-item Redis outbox drain could therefore
  remain active for nearly a minute.

The source response installed for this evidence:

- freezes local/world matrix recomputation for static Harthmere placement
  hierarchies after their authored transforms are complete;
- keeps the static Harthmere root matrix out of Three.js's automatic per-frame
  composition while animated actors and VFX retain automatic matrices;
- clears the six known render scenes without allocating `Object.values(...).map`
  output every frame;
- updates the postprocess chain only when its resource version changes;
- runs dynamic-quality percentile/candidate analysis at 4 Hz instead of once
  per rendered frame (quality changes already have 2-3 second gates);
- deduplicates identical Chapter 1 objective, gate, and projection responses;
- refreshes world projection immediately from `chapter1-story-updated`, with a
  two-second reconciliation poll for cross-tab/server changes;
- returns compact cloud-save identity/version metadata without echoing payload;
- drains consecutive best-effort behavior telemetry with bounded concurrency,
  while preserving serial ordering barriers around saves/progression;
- exports `draw`, React invalidation, terrain, player, NPC, and Harthmere runtime
  renderer timing cvals so the next production sample identifies the remaining
  renderer share directly.

That earlier batch did not reduce the then-current 192 m dynamic view-distance
floor and did not change explicit Low/Safe graphics modes. The August 4 headed
combat follow-up below supersedes that floor with a measured 128 m desktop
minimum after proving the remaining slowdown was CPU-bound.

### Production follow-up — 2026-08-03 (captured session)

A 374-second HAR + console capture from a real production session
(`www.glitch.fun`, Apple M1 Max, Chrome 151) finally localised the remaining
CPU/main-thread pressure the 2026-08-01 and 2026-08-02 samples kept pointing at
without naming.

What the capture established:

```text
GPU Tier Info: {"fps":556,"gpu":"apple m1 max","isMobile":false,"tier":3,"type":"BENCHMARK"}
Aegis low-FPS reports: 48 samples, range 0-14, median 10
[Violation] 'requestAnimationFrame' handler took <N>ms: continuous
```

So tier detection was correct, the hardware was fast, and the frame loop was
the problem — consistent with every earlier "CPU is the bottleneck" conclusion.

The client's own `/api/cval_logging` payload named the scale factor:

```text
position_selector: 2932     collideable_selector: 1217   label_selector: 834
placeable_selector: 548     npc_metadata_selector: 159   named_quest_giver_selector: 107
minigame_elements_selector: 82
```

The dominant cost was `OverlayScript.tick` in
`src/client/game/scripts/overlays.ts`, which runs every frame and calls
`isOccluded()` once per overlay. `isOccluded` is a full voxel `terrainMarch`
through WASM, camera to target, up to 50 m. With the entity counts above that
is **hundreds of raycasts per frame**. The same tick then republished
`/overlays/projection` unconditionally, invalidating every subscribed React
component — including the HUD — at frame rate even when nothing had moved.

Guardrails added (these belong with the ones in
[Performance Guardrails](#performance-guardrails)):

- **Occlusion is memoised and budgeted.** Results are cached on the
  metre-quantised (target, camera) pair with a 100 ms TTL, and no more than
  `MAX_OCCLUSION_MARCHES_PER_FRAME = 24` marches may be issued in a single
  frame. Over budget, the previous answer is reused. The per-frame cost is now
  constant instead of linear in entity count.
- **The projection map publishes only on real change**, compared with an
  allocation-free walk and a 0.5 px epsilon rather than `lodash.isEqual`.

Two adaptivity defects were closed in the same pass:

- **Dynamic render scale required a GPU timer.** Without
  `EXT_disjoint_timer_query_webgl2` the client pinned a _fixed_ render scale for
  the whole session — `[3840, 2160]` on `high`, a 4K internal resolution with no
  way to back off. That extension is routinely missing in embedded iframes,
  which is exactly how Glitch hosts this game. Dynamic scale is now always
  selected, and `bottleneck()` infers GPU pressure from unaccounted frame time
  when the timer is absent.
- **Timer gauge writes are sampled 1-in-16.** `timeCode` stops 40–200 times per
  frame; the smoothed average still receives every sample, only the metric
  publish is throttled.

Full analysis and the remaining ranked work:
`HARTHMERE_RENDER_PERF_AUDIT_2026-08-03.md` (§ A.0 and the evening remediation
log entry).

**Not yet re-measured.** The next production sample should show
`performanceTiming:scripts:overlay` dropping sharply with
`renderer.<name>.threejs.info` unchanged. If `scripts:overlay` is still
dominant, the next move is splitting the overlay content rebuild (10 Hz) from
the projection update (per frame).

### Mobile optimization batch — 2026-08-04

Source-only. Full findings and evidence:
`HARTHMERE_MOBILE_OPTIMIZATION_AUDIT_2026-08-04.md`; product-facing log:
`docs/harthmere/MOBILE_GAMEPLAY_ISSUES.md`.

Everything below is gated on `clientConfig.mobileDevice`, or on a clamp set
that is `undefined` on desktop. Desktop render scale, draw distance, frame
pacing, context-loss handling, atlas decode, and controls are unchanged.

| Change                          | Mobile behaviour                                                                                                  | Desktop behaviour               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Touch action cluster            | One context-sensitive Primary (tap mine/use/light, hold mine/heavy), clear Place/alternate-use, Target, and Spark | Not mounted                     |
| Device profile + clamped ladder | `constrained`/`standard`/`capable`, dynamic within range                                                          | Unclamped, unchanged            |
| Render frame cap                | 30 FPS render target; simulation unpaced                                                                          | Uncapped                        |
| WebGL context restore           | Rebuild via `reattach()`, loss logged as a warning                                                                | `log.fatal`, unchanged          |
| Atlas decode                    | Payload released per field                                                                                        | Same shared decoder (see below) |
| `viewport-fit=cover`            | Safe-area insets resolve                                                                                          | Insets are 0 either way         |

**One change in this batch is not mobile-gated.** Five call sites decoded
base64 with `new Uint8Array(Buffer.from(data, "base64").buffer)`, which
discards `byteOffset`/`byteLength`; Node pools sub-4 KiB allocations, so it
returned a view over the shared pool rather than the payload. It worked in the
browser only because the browserify polyfill allocates exactly. All five now
use one `decodeBase64Bytes` (native `atob` first, offset-respecting `Buffer`
fallback). No-op for the shipped browser client, correctness fix everywhere
else — including the GLB path in `item_mesh.ts`, which was handing the parser a
buffer whose byte 0 was not the GLB header. **Guardrail:** never take `.buffer`
off a `Buffer`/typed array without also taking `byteOffset` and `byteLength`.

The mobile ladder replaces the previous `forceRenderScale = 0.5` pin. The
`standard` class starts at exactly 0.5 render scale / 64 m — the profile
validated on the physical iPhone 12 mini — so no phone starts anywhere new. No
class may exceed 96 m, which is the radius the `JETSAM_REASON_MEMORY_HIGHWATER`
sessions were running: draw distance drives retained terrain meshes and
therefore WebContent footprint, not just frame time. Explicit `forceDrawDistance`
/ `forceRenderScale` / `forceGraphicsQuality` URL diagnostics still win.

### Consolidated iOS performance path

The later physical-phone work extends the original batch. Keep these changes
together when reviewing or bisecting mobile residency; applying only one or two
of them recreates failure shapes that the complete path avoids:

- iPhone low-memory Voxeloo reservation is one eighth of the desktop default.
  The independently scaled mobile resource graph is capped at 8,000 nodes; the
  block-mesh label cap and desktop capacities are unchanged. The 8,000 value is
  deliberate: a 6,000 cap repeatedly rebuilt a measured roughly 6,400-node
  movement working set and increased allocation/compression churn.
- Render scale and draw distance use the mobile device ladder, and only rendered
  frames are paced at about 30 FPS. Simulation, input, and networking continue
  at their normal cadence.
- Camera far-plane sanitization prevents an invalid first-frame projection from
  entering native `VisibilitySharder.scan()`, where the phone and desktop native
  GPU paths could synchronously wedge before terrain draw returned.
- Projectile, business-interior, and additive-town GLB catalogues no longer
  launch their entire catalogues during module construction. They use bounded
  nearby/on-demand streaming instead.
- Character animation actions are lazy and reclaimable on mobile. A physical
  iPhone trace found 119 actions / 5,712 cloned tracks per NPC and 314 actions /
  7,536 cloned tracks per player, even when only idle was visible. Phones now
  create non-idle movement, combat, and the 71 cinematic-expression actions on
  first use, then uncache each clone after its blend reaches zero. Desktop keeps
  the established eager action graph.
- Mobile clamped one-shots use the shared animation timestamp as their terminal
  condition. This prevents iOS WebKit from resetting a completed expression
  when `AnimationAction.isRunning()` is false but WebKit has not set the Three.js
  `paused` flag; desktop playback remains on its existing path.
- Fixed-build physical evidence for this path used
  `warm-ios-dialog-memory-20260805-r1`: sampled NPCs started with one idle
  action and sampled players with two idle-layer actions. Jackie's one-second
  `relief` action materialized only for the dialogue beat, stopped at its final
  frame, and remained stopped in a later sample. The fixed WebContent process
  still received memory-pressure notifications at a measured post-load
  footprint of `1,040,994,880` bytes, but the bounded retest produced no
  memory-highwater kill. Treat this as proof of the action-graph reduction, not
  as a claim that all iOS memory pressure or the full ten-minute stability gate
  is closed.
- Background music loads the selected track rather than every track. Mobile
  uses AAC-LC `.m4a` variants after the first real touch while preserving the
  original audio files; desktop keeps its streaming media-element path.
- Atlas decode uses exact-size buffers and releases mobile base64 payload fields
  after decode. Particle fallback textures declare their actual RGBA shape, and
  packed texture construction rejects malformed byte lengths early.
- WebGL context loss stops the phone render loop and rebuilds through
  `reattach()` instead of promising recovery with no recovery path.
- The service-worker catalogue excludes Harthmere GLB/FBX, generated inventory
  icons, and voice-catalogue paths; custom-origin gzip covers game chunks,
  `/at`, `sw.js`, and Bikkie responses.

Physical iPhone acceptance must still be reported against the exact immutable
build under test. A source pass or desktop emulation is not evidence for jetsam,
native WebGL, safe-area, real-touch, or orientation behavior.

Still open after this batch: KTX2/gltfpack over the NPC assets (0 `.ktx2` files
shipped, `big_mucker` still 15.5 MB), the binary atlas format, and `useWorker`.

## Render Distance Contract

Harthmere is an open, landmark-driven world. Auto graphics must not collapse
terrain and synchronization into the old 64 m "short headlight" view merely
because the client is CPU-bound.

For Glitch/embed sessions, `src/client/game/client_config.ts` sets:

```ts
ret.dynamicMinDrawDistance = 96;
```

This has the following behavior:

- Auto/dynamic graphics retain at least 96 m of terrain and synchronization
  distance.
- The former 192 m minimum is intentionally retired: a headed Apple M1 Max
  combat sample measured 26.5 ms CPU render time versus 4.535 ms GPU time and
  27.78 median FPS. The old floor prevented the adaptive controller from
  shedding the CPU-heavy terrain/ECS radius.
- The interim 128 m minimum is also retired after the August 6 production
  capture held 1,098-1,178 live block meshes, about 204 MB of flora vertex
  buffers, and 1.5-1.6 GB JS heap while median reported FPS remained 12. The
  96 m emergency floor reduces retained horizontal area by roughly 44% while
  preserving the nearby fight and landmark context.
- Dynamic quality can still lower render scale when the GPU is the bottleneck.
- Explicit Low or Safe Mode remains allowed to select a shorter fixed distance.
- `minDrawDistance` remains available as the hard URL/config override.
- Harthmere placement LOD remains independent and is governed by
  `HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS`.

Gathering-node optimization does not shorten the game world. It hides only
interaction-marker geometry and its local point light when that marker is
outside the active draw distance. Terrain, buildings, landmarks, NPC ECS
synchronization, and the camera far plane continue to follow the graphics
settings above.

## Runtime Optimizations Installed

### React resource invalidation

Previously, `RendererController` emitted every mounted React resource event
after every rendered frame. That woke HUD and UI consumers even when their
observed resource version had not changed.

Current behavior:

- `RendererController` calls `ReactResources.flush()`.
- Observed resource bundles remember their last emitted version.
- A listener wakes only when `resources.version(...)` changes.
- Direct emitter consumers that do not use a resource key retain compatibility.
- Unobserved bundle metadata is periodically pruned.

Source:

```text
src/client/game/renderers/renderer_controller.ts
src/client/resources/react.ts
src/client/resources/react.test.ts
```

### Native NPC rendering

The native NPC renderer and render state now avoid repeated work that scales
with every visible NPC:

- Puppet overrides are projected into maps/sets once per frame rather than
  searched separately for each NPC.
- Sun direction is converted to an array once per frame and shared.
- Base-pass materials and skinned meshes are cached when the NPC mesh is built.
- Ambient material updates are spread across four frames; hit flashes still
  update immediately.
- Skinned-mesh invalidation uses the cached list rather than traversing the
  hierarchy.
- Animation diagnostics update in place instead of cloning the complete audit
  map for every actor.
- Animation/navigation diagnostics publish at 2 Hz and immediately on a
  meaningful state transition.
- Runtime collision diagnostic sorting is limited to once per second.
- Combat actor snapshots publish at 10 Hz.
- Runtime placement LOD refreshes at 2 Hz.
- Nearby runtime actors animate every frame; mid/far actors are deliberately
  throttled.

Source:

```text
src/client/game/renderers/npcs.ts
src/client/game/resources/npcs.ts
src/client/game/renderers/local_dev/harthmere_assets.ts
```

### Harthmere scene routing

`addToScenes()` determines a root's render pass by traversing its hierarchy and
then traverses it again to discover `RawShaderMaterial` dependencies. That is
correct for unknown or mixed engine objects, but it was unnecessarily applied
to the full Harthmere runtime root every frame.

The Harthmere runtime hierarchy contains stock Three.js materials and already
falls back to the stock `three` pass when mixed opaque/translucent children are
present. It now routes directly with:

```ts
scenes.three.add(this.root);
```

This removes two complete hierarchy walks per frame across the town, runtime
assets, ECS creature projections, cutscene actors, and active VFX. The same
direct routing is used for the stock-material procedural roots:

- business outpost guide buildings;
- business boards;
- jobs boards;
- quest-object markers;
- gathering-node markers;
- loot-drop markers.

Do not apply direct routing to a root containing `BasePassMaterial`,
`PunchthroughMaterial`, CSS3D objects, or custom raw-shader dependency
uniforms unless that root has an equally explicit render-pass contract.

### Gathering nodes and marker diagnostics

Gathering nodes were globally expensive despite being static interaction
objects:

- every node was terrain-grounded every rendered frame;
- every node mesh had `frustumCulled = false`;
- every node kept a point light active even when it was far outside the useful
  view.

Current behavior:

- terrain/WASM grounding runs at 4 Hz;
- meshes use normal Three.js frustum culling;
- node groups beyond the active draw distance are hidden, which also removes
  their point lights from Three.js's global light collection;
- the world itself retains the 96 m dynamic minimum described above;
- static business/jobs-board debug bridges are installed once per renderer;
- quest-marker debug snapshots publish at 2 Hz rather than every frame.
- quest-object terrain grounding runs at 4 Hz and its procedural/authored
  meshes use normal frustum culling instead of forcing every marker into every
  draw submission;
- the sticky Native ECS stamina-authority compatibility clock advances only in
  memory, so it no longer dispatches React storage events or uploads the full
  Cloud Save blob every five seconds during combat.

Source:

```text
src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts
src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts
src/client/game/renderers/local_dev/harthmere_business_board_marker.ts
src/client/game/renderers/local_dev/harthmere_jobs_board_marker.ts
src/client/game/renderers/local_dev/harthmere_business_outpost_buildings.ts
src/client/game/renderers/local_dev/harthmere_loot_drop_markers.ts
```

### Existing runtime budgets that remain required

The optimized Harthmere runtime profile remains the default gameplay profile:

```text
prototype load concurrency: 2
maximum runtime placements: 220
maximum animated life: 24
maximum tiny props: 16
maximum Wilds actors: 8
maximum Wilds runtime placements: 24
optimized terrain shard budget: 288
district LOD: 72 m
near LOD: 36 m
interior LOD: 16 m
tiny LOD: 8 m
event LOD: 48 m
```

The optional full profile is for screenshots and controlled walkthroughs, not
normal production gameplay.

## Voxeloo, WebAssembly, and GPU Utilization

Voxeloo is already built in normal and WebAssembly SIMD variants. The client
selects the SIMD artifact when the browser reports SIMD support. The WebGL
renderer requests WebGL2 with `powerPreference: "high-performance"`.

WebAssembly does not make Voxeloo execute on the GPU. Voxeloo performs CPU-side
voxel, tensor, occlusion, surface, lighting-buffer, and geometry work. Three.js
then submits the generated buffers and draw calls to WebGL. The production
measurements show that the GPU has headroom while the CPU/main thread does not,
so GPU utilization should not be increased by adding more shader work.

Current worker limitations:

- `clientConfig.useWorker` defaults to `false`.
- The worker uses the normal, non-SIMD Voxeloo build with a 16 MB WASM heap.
- Only block geometry generation (`toBlockGeometry`) is offloaded.
- Occlusion, surface generation, material/light buffers, glass, flora, and
  water work still use the main path.
- Voxeloo WebAssembly is built with the Emscripten Bazel rule's
  `threads = "off"` transition. Do not reintroduce the removed
  `USE_PTHREADS=0` setting.

The next credible Voxeloo experiment is therefore not "use more GPU." It is a
measured worker prototype that:

1. uses the SIMD worker artifact when supported;
2. transfers encoded buffers instead of repeatedly cloning large typed arrays;
3. moves a complete geometry preparation stage off the main thread rather than
   only `toBlockGeometry`;
4. records main-thread frame time, worker latency, transfer bytes, and WASM
   memory before enabling it by default.

Pthreads/`SharedArrayBuffer` would additionally require the correct
cross-origin isolation headers. That must be validated against the Glitch
iframe/authentication model before changing the WebAssembly build.

## Engine and Toolchain Upgrade Audit — 2026-08-01

An engine or compiler version bump is not, by itself, the fix for the current
production frame rate. The measured GPU time is only 5.3–8.0 ms while the CPU
render path is roughly 47 ms. The browser main loop also flushes ECS changes,
updates clocks and simulation, clears and rebuilds the render scenes, runs all
renderer scripts, renders the multipass pipeline, emits React updates, and
collects resources on every animation frame.

The fork-only modernization completed for this audit is:

| Area                     |                 Fork baseline |                                   Upgraded fork | Expected sustained-FPS value                                                                                                  |
| ------------------------ | ----------------------------: | ----------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Three.js                 |                0.185.1 / r185 |                                         Current | Potentially material only when paired with batching or renderer restructuring                                                 |
| gltfpack / meshoptimizer |                        0.17.0 |                                           1.2.0 | Smaller geometry/texture payloads and less startup/memory pressure                                                            |
| KTX2 / Basis             |                          none | Native BasisU compression plus Three KTX2Loader | Startup, upload, and GPU-memory improvement; not a direct CPU-frame fix                                                       |
| React / React DOM        |                        18.2.0 |                                          19.2.8 | Low for the canvas; possible HUD/UI benefit                                                                                   |
| Next.js                  |                        13.3.2 |                                         16.2.12 | Build/startup/supportability; no expected steady-state canvas benefit                                                         |
| Emscripten               |                        3.1.41 |                                           6.0.5 | Native compiler/compatibility improvement; measured WASM behavior preserved                                                   |
| Node.js                  |                          20.x |                                     24.18.1 LTS | Server throughput and build maintenance, not browser rendering                                                                |
| Production Linux runtime |     Ubuntu 22.04 / glibc 2.35 |                   Ubuntu 24.04 LTS / glibc 2.39 | Meets the uWebSockets Node 24 native-binary floor and keeps the production container on a supported LTS base                  |
| uWebSockets.js           |                       20.31.0 |                                         20.69.0 | Node 24 ABI support for the high-throughput zRPC WebSocket server                                                             |
| Fatal-signal diagnostics |        segfault-handler 1.3.0 |                             segfault-raub 3.2.0 | Replaces the abandoned NAN/V8 addon with an N-API binary compatible with Node 24, removing a Linux image source-build failure |
| Bazel                    |                         6.3.1 |                               9.2.0 with Bzlmod | Faster supported builds and dependency maintenance                                                                            |
| TypeScript               |                         5.9.3 |                                           6.0.3 | Build/typecheck only; TypeScript 7 remains blocked by current lint peers                                                      |
| Webpack                  |                        5.81.0 |                                         5.109.2 | Build and bundle generation, not frame execution                                                                              |
| Redis / ioredis          | 6/7-era harnesses / ioredis 5 |                     Redis 8.8.1 / ioredis 6.0.0 | Server latency, stream recovery, and operations; not direct client FPS                                                        |
| Redis Rust module        |                   2.0.3/2.0.4 |                                           2.0.8 | Redis 8 module API compatibility                                                                                              |

These versions apply only to this production fork. No upstream Biomes import or
upgrade was performed.

### Three.js is upgraded; batching is the remaining FPS opportunity

The renderer now runs Three.js r185 and has access to newer batching and
renderer primitives, including `BatchedMesh`; current releases also include
`SceneOptimizer` as an examples utility. That matters because the remaining
bottleneck includes JavaScript hierarchy work and WebGL draw-call submission.
Replacing many static town meshes with a small number of material-compatible
batches could reduce that CPU cost.

The version bump alone should not be expected to improve FPS. Existing objects
remain existing objects until the game explicitly batches, instances, merges,
or removes them from the per-frame submission path. The first experiment
should keep `WebGLRenderer` and convert only stock-material, static Harthmere
roots.

WebGPU is now available as an explicit diagnostic boundary, not as a renderer
replacement. Every client records adapter availability at
`game:capabilities:webgpu`; `?webgpuProbe=1` additionally initializes Three's
WebGPU renderer and renders a tiny stock-material scene. The probe fails if
Three silently uses its WebGL fallback. The production game renderer remains
WebGL2 because its raw GLSL, three-attachment MRT, shared depth, custom passes,
SMAA, bloom, SSAO, water, and shader instrumentation need a deliberate TSL/WGSL
port rather than a backend flag.

A direct r152-to-r185 package-only update would not have been safe. The
completed migration addressed the known compatibility boundaries:

- the removed `WebGLMultipleRenderTargets` API now uses
  `WebGLRenderTarget({ count: 3 })` while preserving all attachments;
- The renderer has custom shared render targets, six scene buckets, raw
  shaders, depth, water, translucency, punchthrough, bloom, SMAA, and SSAO, all
  covered by scoped type and behavior gates;
- old color/encoding APIs were migrated to color spaces and all
  `three/examples/jsm` imports now use explicit `.js` paths;
- generated GLSL keeps `#version 300 es` in authored files for validation, but
  the TypeScript generator removes that directive from embedded shader strings
  and sets `glslVersion: THREE.GLSL3`, allowing Three r185 to place the version
  before its RawShaderMaterial prefix;
- Generated player, NPC, terrain, water, and placeable materials must continue
  to route to the correct framebuffer and sampler types.

A clean production bundle exposed why exact runtime validation is mandatory:
ANGLE rejected generated shaders when Three's `SHADER_TYPE` / `SHADER_NAME`
defines appeared before their embedded `#version` directive. WebGL2 and the
three-attachment MRT were healthy; the black world, invalid programs, missing
fragment outputs, `uint`, and `sampler2DArray` errors were shader-compilation
cascades. The isolated browser smoke now compiles the actual generated base
material so an equivalent hand-written shader cannot hide this integration
failure again. Full details and gates live in `docs/THREEJS_UPGRADE_MAP.md`.

A second production-only failure was silent: the r185 renderer stopped
publishing the legacy `boneTextureSize` uniform used by the custom player
vertex shader. Players and NPCs were counted as rendered and emitted no GL
error, but zero-sized bone-texture math produced invalid vertex positions. The
shader now queries `textureSize` and uses `texelFetch`, matching Three r185.
The reusable browser gate renders the actual player-skinned material and
requires visible pixels; entity counts and successful draw calls alone are not
accepted as proof that avatars render.

Preserve the corrected r185 renderer as the A/B control for performance work.
The next order is:

1. Capture calls, triangles, object counts, CPU render time, GPU render time,
   and frame interval at fixed production-town camera positions.
2. Batch or instance one static district/material family.
3. Compare measurements before expanding the conversion.
4. Keep the change only if CPU frame time and draw calls improve without
   increasing GPU time, memory, shader errors, or visual defects.

`InstancedMesh` remains appropriate for repeated identical props, while r185
`BatchedMesh` is the next candidate for compatible static geometry. Measure
both against the same fixed-camera production-town baseline.

### Galois, gltfpack, Meshopt, and KTX2 are upgraded

Galois now invokes official native `gltfpack 1.2` with `-kn -c`. Color textures
use Basis ETC1S and normal/attribute textures use UASTC in KTX2 containers. The
native release archives are checksum-pinned because the npm/WebAssembly
`gltfpack` build is compiled without BasisU and cannot produce KTX2.

The client centralizes GLTF loading with Meshopt 1.2 and configures one shared
Three `KTX2Loader` after WebGL2 capability detection. The matching r185 Basis
transcoder is copied to `public/three/basis`; existing PNG/JPEG GLTF assets
remain the runtime fallback if transcoder initialization is unavailable.

The executable compression test requires both `EXT_meshopt_compression` and
`KHR_texture_basisu` and verifies an embedded `image/ktx2`. This reduces
download, decode, upload, and GPU-memory pressure. It is useful for startup and
stutter but is not presented as the fix for a CPU-bound 47 ms frame.

### React 19 and Next 16 are upgraded, but are not renderer fixes

The React resource flush fix removed the most obvious per-frame UI wakeup. A
small React Compiler trial on the Harthmere HUD may reduce avoidable component
work, and it can be evaluated independently before a full framework migration.
It will not reduce Three.js scene construction or WebGL submission cost.

Next.js 16 remains on Pages Router with explicit `--webpack`; the existing
`next-pwa`, asynchronous WASM, custom Webpack rules, WebAssembly chunk handling,
and production artifact guards remain compatibility gates. Treat this as a
platform/build upgrade, not as an FPS claim.

Node 24's native TypeScript stripping can intercept Mocha before `ts-node` and
`tsconfig-paths` apply this repository's CommonJS and `@/` alias contract. The
test launchers therefore disable native stripping explicitly. The zRPC server's
native `uWebSockets.js` dependency is pinned to 20.69.0, whose Node module ABI
includes Node 24; the old 20.31.0 binary cannot load under ABI 137. Focused
gRPC, MessagePort, and real WebSocket zRPC tests remain required after any Node
or native-addon update.

### Voxeloo is rebuilt with Emscripten 6; native behavior remains measured

The normal gameplay build still selects SIMD when supported and the release
build remains optimized. Emscripten 6.0.5 builds both normal and SIMD modules;
the TypeScript parity suite verifies matching Anima, Gaia, terrain, flora,
water, muck, tensor, shard, and serialization behavior. Emscripten's removed
thread/exception settings were replaced at the Bazel rule boundary rather than
turning the browser module into a shared-memory build accidentally.

Emscripten 6 also changed the generated loader boundary: `wasmBinary` is no
longer accepted by the default incoming module API, while the default target
set eagerly emits `node:fs` and `node:crypto` imports. Voxeloo now targets
`web,webview,worker`, explicitly accepts preloaded `wasmBinary`/`wasmMemory`,
and contains no Node-only import in either normal or SIMD browser loader. Node
services continue to load the same artifacts by supplying the bytes directly;
the loader contract and 18 WASM tests prove both sides together.

The higher-value native experiment remains worker offload: use the SIMD module
in the worker, transfer rather than clone buffers, and move a complete terrain
geometry preparation stage off the main thread. Enabling pthreads is not a
version bump; it changes hosting headers, WebAssembly memory, worker behavior,
and iframe compatibility.

### Redis 8.8.1 and internal ECS/Anima/Gaia compatibility

Production Redis is the private VM `biomes-redis-prod` at `10.0.0.12:6379` in
`openai-resource-group`. It is Redis 8.8.1 from official Redis APT packages,
pinned to the 8.8 line. Production remains RDB-only (`appendonly no`), uses a
12 GB `maxmemory` with `noeviction`, and exposes port 6379 only to the
`10.0.1.0/27` application subnet. The unrelated managed cache
`glitch-redis-prod` is not this game-world Redis and must not be modified by
Biomes maintenance.

Local smoke, CI, development containers, and Kubernetes manifests use the exact
Redis 8.8.1 patch for command compatibility, but they do not inherit the
production VM's persistence, memory, network, or backup configuration. ioredis
6 uses RESP3 by default; `BIOMES_REDIS_PROTOCOL=2` is the tested incident
rollback. Leaderboard LT/GT updates now use native atomic Redis operations,
removing an extra Lua call and `ZSCORE` per leaderboard window.

ECS, Anima, and Gaia are internal fork systems rather than independent package
versions. Their upgrade boundary is the generated ECS schema/wire contract,
Voxeloo ABI, regular/HFC split, shard ownership/handoff, terrain buffers,
`npc_state`, and existing persisted Redis data. Those contracts remain intact
and are verified together; component IDs or persisted formats must not be
renumbered as a dependency cleanup.

The exact-image smoke found one legacy fly behavior with a zero-second
oscillation period. `sin((pi / 0) * time) * 0` generated a `NaN` vertical force,
which Anima wrote to HFC and current Zod correctly rejected. The fork now
treats non-positive or non-finite oscillator inputs as disabled. HFC also
validates component payloads at all three trust boundaries—write, bootstrap,
and live pub/sub—drops only the malformed component, records a metric/error,
and keeps valid sibling data flowing. This is primarily a service-availability
fix: one corrupt NPC can no longer collapse Sync, Web, Logic, Anima, and Gaia.
It does not claim a direct browser FPS gain.

### Production image packaging is now Linux-native and cacheable

`Dockerfile.biomes` no longer copies the developer machine's `node_modules`.
The final Linux/amd64 image runs `npm ci --omit=dev --ignore-scripts` from the
locked production closure, then intentionally rebuilds and loads every native
Node 24 dependency inside Ubuntu 24.04. This removes mixed macOS/Linux hoists,
makes the runtime dependency audit deterministic, and avoids sending the host
dependency tree through BuildKit. `Dockerfile.biomes.dockerignore` excludes
`node_modules` while retaining the exact `.next` and `dist` artifacts.

In the August 2 local production build, this reduced the BuildKit context from
approximately 9.11 GB to 5.94 GB (about 3.17 GB less) before layer caching. The
image separately packages Python 3.12/Voxeloo, gltfpack 1.2, Redis 8.8.1 tools,
and the reviewed runtime assets, then removes compilers and Bazel caches from
the final layer. This improves repeatability, upload/cache behavior, and build
failure isolation; it should be measured as build/scale-out work rather than a
steady-state client FPS improvement.

The local production smoke, Chapter One browser run, and any later authorized
push must use one immutable image ID. Rebuilding between smoke and push throws
away the evidence, even if the same textual tag is reused.

The smoke must also preserve production's service boundary. A 16.56 GiB local
Docker VM could run the web-only role at about 6.1 GiB, but the old unified
web+Anima+Gaia topology reached about 11.6 GiB before Gaia completed and was
OOM-killed immediately after loading 262,253 terrain shards. Running the same
image ID as a dedicated simulation phase completed with zero holes, zero
restarts, and no OOM; the simulation settled near 5.2 GiB after readiness. The
guarded helper therefore validates web and simulation sequentially against the
same Redis snapshot, then restores web for browser tests. This is a resource
isolation improvement and a more accurate production rehearsal, not a client
FPS optimization.

### Server-system upgrades do not increase client FPS directly

ECS, Redis, Anima, and Gaia upgrades can improve server tick throughput,
replication latency, simulation capacity, or operational reliability. They do
not reduce the browser's scene traversal and draw submission unless they also
change how much data or how many visible entities the client receives. Any such
change must preserve the 96 m render-distance contract and should use client
LOD, aggregation, or lower update frequency rather than hiding the world.

Current recommendation after the completed platform upgrade:

1. Use the validated r185 renderer as the control and prototype static batching
   on one material-compatible district.
2. Adopt `BatchedMesh` more broadly only if the call-count and CPU-frame-time
   benchmark is positive.
3. Measure KTX2 startup, transfer, upload, and GPU-memory changes separately
   from steady-state FPS.
4. Keep WebGPU as an opt-in probe until the complete raw-GLSL/MRT pipeline has
   an explicit port and visual parity suite.
5. Measure server resource and compile-time changes independently; do not
   attribute them to browser FPS.

### Final exact-image browser findings — 2026-08-02

The immutable local candidate
`sha256:e5232ba400b6dd23a976a278c3754644ff2f7dbbc56f66c462dfb441f7924755`
passed production-image startup, Redis 8.8.1 RESP/stream compatibility, generated
player-mesh serving, the Chapter One gate renderer, and the canonical cast
projection with Web/Logic/Sync/Trigger/Shim/Bikkie healthy and zero app/Redis
restarts. Gaia and Anima remained disabled for the normal browser lane, matching
the documented local resource policy.

The browser campaign found and locally fixed one cross-process event-contract
defect. Web signed the Chapter One transition with camera orientation
`[0.02, 3.15]`, while the Logic-side event carried `[0, 3]`; exact comparison of
that non-authoritative view value rejected an otherwise unchanged destination.
Warp token version 2 continues to sign the player, action, dungeon, run, party,
encounter-reset flag, and exact destination, but excludes camera orientation.
Focused regressions prove orientation transport changes are accepted while
destination and transition changes are rejected. This is an authorization and
reliability fix, not an FPS optimization, and requires a future explicitly
authorized image rebuild before the corrected dungeon warp can be re-proven
against artifacts.

Desktop screenshot review also found that the pointerless fallback had been
conflated with mobile device detection. A desktop browser without Pointer Lock
mounted touch joysticks, mobile crouch/actions, and the mobile hotbar, adding UI
and input work that did not belong to that device class. Virtual-joystick mode
now requires touch or a mobile/tablet UA; pointerless desktop retains its
mouse/keyboard fallback without mounting mobile mechanics. The desktop browser
gate explicitly asserts the mobile HUD markers are absent.

The representative browser screenshot is
`artifacts/harthmere-native-ecs-e2e/platform-upgrade-r3-chapter1-desktop-final-r3/1785649134403-20080-client-a.png`.

## Read-Only Production Diagnostics

The following commands inspect production without creating a revision,
changing traffic, restarting a replica, or deploying an image:

```bash
APP=biomes-node-vnet
RG=openai-resource-group

az containerapp revision list -n "$APP" -g "$RG" -o table
az containerapp replica list -n "$APP" -g "$RG" --revision <revision> -o table
az containerapp logs show -n "$APP" -g "$RG" --type console --tail 300
az containerapp logs show -n "$APP" -g "$RG" --type system --tail 300
az containerapp exec -n "$APP" -g "$RG" --revision <revision> \
  --replica <replica> --command 'curl -fsS http://127.0.0.1:3001/metrics'
```

Important client metrics/cvals:

```text
metrics:performanceTiming:renderIntervalHist
metrics:performanceTiming:cpuRenderTimeHist
metrics:performanceTiming:gpuRenderTimeHist
metrics:performanceTiming:draw
metrics:performanceTiming:render + postprocessing
metrics:performanceTiming:react emitter invalidate
metrics:performanceTiming:renderers:<renderer name>
metrics:game:loop:eventLoopLatencyMs
renderer:graphics:settings
renderer:game:threejs:info
memory:usedJSHeapSize
memory:voxeloo:usedMemory
```

If the GPU time is low but CPU frame time and event-loop latency are high,
profile JavaScript, hierarchy traversal, draw-call submission, resource
notifications, animation, marker projections, and terrain preparation before
lowering render scale.

### Battle-entry emergency degradation

The August 4 battle capture reported 2–14 FPS, 256 WebGL
`GL_INVALID_OPERATION` draw failures caused by missing fragment outputs, and
671 long `requestAnimationFrame` handlers. The complete portion of its truncated
HAR remained network-successful, so low FPS must be diagnosed from renderer and
main-thread evidence before changing combat range or server authority.

Keep these safeguards together:

- Mixed scene roots that are not explicitly coerced player base scenes render
  through the normal Three.js pass. Sending an ordinary mixed-material root to
  the MRT/base pass can invalidate every draw and flood the console.
- Premium projectile prototypes load on demand. Battle entry must not compile
  the entire projectile catalogue before the player fires anything.
- Dynamic settings retain the normal 110-sample stabilization window, but may
  begin reduction-only emergency decisions after 24 samples when median frame
  time is at least 50 ms. At 2 FPS this removes roughly 43 seconds of avoidable
  delay before the first quality reduction. The emergency window must never be
  used to raise quality.
- Desktop Harthmere auto graphics use a 96 m dynamic minimum. The previous
  192 m floor kept the CPU-bound battle scene at 27.78 median FPS even though
  GPU time was only 4.535 ms; lowering render scale would not address that
  bottleneck. A later production fight proved that 128 m still retained over
  1,100 block meshes at 10-14 FPS, so the adaptive ladder may now descend one
  additional 32 m step. Explicit Low/Safe modes and the mobile 64 m emergency
  ladder are unchanged.
- Browser acceptance records median FPS plus the selected render scale and draw
  distance before and during combat, including both the requested adaptive
  value and the effective post-floor value. It also rejects the
  missing-fragment-output WebGL signature even if the final health mutation
  succeeds.

### Late held-item attachment can reintroduce the MRT failure

The August 5 production continuation
`www.glitch.fun-1785941783106.{har,log}` isolated the remaining marked-player
edge case. Its HAR was truncated, but all 13 complete requests returned 2xx;
the only request above one second was a 1.59-second voice poll. The console then
logged this exact sequence:

1. native item `8761900000000001` (`item_augur9_core_cell`) had no authored
   mesh path and used the procedural item fallback;
2. the marked player root became `base,three` with
   `MeshStandardMaterial,RawShaderMaterial` and was routed to the base pass;
3. Chrome emitted 256 active-draw-buffer/missing-fragment-output errors;
4. 299 long animation-frame-handler warnings followed, with Aegis samples of
   2, 11, 14, 10, and 12 FPS.

The general mixed-root fallback was already correct for unmarked objects. The
remaining defect was timing: the player body is coerced before a selected item
is attached, so a procedural fallback created later could still introduce a
stock Three.js material beneath a marked root. Generic missing-item and
Spikefish procedural fallbacks now use the generated `BasePassMaterial` family.
The regression attaches each fallback beneath a marked player root, traverses
every descendant material, rejects stock `MeshStandardMaterial`, and requires
the root to classify as base-only. Loaded GLTF, premium skinned bow, socket,
and skeleton-aware clone paths are unchanged.

## Change and Deployment Safety

Performance investigation, production log collection, browser inspection, and
source optimization do **not** authorize a build, deployment, traffic change,
restart, or image push. Those are separate actions and require an explicit user
instruction.

Status at this document update:

- The former 192 m dynamic view-distance floor and the earlier React/NPC
  performance batch were present in production revision
  `biomes-node-vnet--0000215` inspected on 2026-08-02. Current source replaces
  first replaced that auto-graphics floor with a measured 128 m contract; the
  August 6 production fight then narrowed the emergency floor to 96 m.
- The final static-matrix, frame-setup, Chapter 1 polling, save-response, outbox,
  and renderer-cval changes described above are source-only until an explicitly
  authorized build/deployment includes them.
- No production build, restart, traffic change, image push, or deployment was
  initiated for this final source batch.

## Mission Markers

Mission markers must clear when a mission becomes completed or inactive.

Current behavior:

- Completed missions are auto-untracked.
- `biomes:harthmere-mission-marker-clear` is dispatched for HUD layers.
- Nearby mission lists filter out active and completed ids.
- Marker placement resolves through the production terrain placement map.

## Dialogue Placement And NPC Identity

NPC dialog should match the bible-backed character identity. If a named NPC has
a backstory in `Harthmere_Bellbound_Dragon_Story_Bible (3).md`, their ambient
or quest-specific dialog should include at least one concrete detail from that
backstory.

Generic mood-only dialog is fine for unnamed walkers and crowd filler. It is
not enough for anchored named characters.

## Verification Checklist

Before shipping placement or performance changes:

1. Run the focused performance response guard:

   ```bash
   node scripts/harthmere/check-harthmere-performance-response.cjs
   ```

2. Typecheck the renderer-focused source graph:

   ```bash
   yarn -s tsc -p tsconfig.ch1renderer.json --noEmit
   ```

3. Run focused procedural renderer tests:

   ```bash
   ./b --no-check-ts-deps test --grep \
     'Harthmere (loot drop marker renderer|business board procedural markers current|quest object procedural markers current|jobs board kiosk placements|business outpost guide renderer current)'
   ```

4. Run `git diff --check`.
5. Run `node scripts/harthmere/check-biomes-harthmere.cjs .`.
6. Run `node scripts/harthmere/check-harthmere-auto-survey.cjs .`.
7. Run `node scripts/harthmere/check-harthmere-extra-town-offset.cjs`.
8. During an explicitly authorized deployment, do not skip
   `scripts/harthmere/probe-production-terrain-grounding.cjs`; it repairs and
   reads back every deterministic actor/object family.
9. Restart the server only when the deployment procedure explicitly calls for
   it.
10. In a controlled browser test, reset local survey and mission state when a
    clean survey is required:

```js
window.__harthmereAutoSurvey?.clear?.();
localStorage.removeItem("biomes.localDev.harthmere.questState");
localStorage.removeItem("biomes.localDev.harthmere.missionEvents");
localStorage.removeItem("biomes.localDev.harthmere.trackedMissions");
location.reload();
```

11. Run an auto-survey for several minutes, then download the JSON.
12. Verify the JSON:

- `npcs.offGroundCount` is at or near zero.
- `npcs.offGroundWanderingCount` is interpreted separately from town
  residents.
- No mission target has a large `targetFootDelta`.
- No two different NPCs share the same final `position`.
- Town and wilds frame rates stay within the expected local-dev ranges.

If a check fails, fix the shared placement source, cluster anchor, terrain
resolver, or marker transform. Do not add a one-coordinate patch for the
individual offender.

## Ownership Map

| File                                                                      | Responsibility                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/server/shim/main.ts`                                                 | NPC seed/spawn, stable anchors, claim set, dialogue                    |
| `src/client/components/challenges/LocalDevHarthmereQuests.tsx`            | Quest definitions, quest targets, target terrain labels                |
| `src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx`     | Tracked mission state, auto-untrack, marker-clear events               |
| `src/client/components/challenges/SnapshotLiveDiagnostics.tsx`            | Auto-survey, wandering filter, auto-throttle, mission audit            |
| `src/client/game/client_config.ts`                                        | Glitch/embed draw-distance floor, feature flags, mobile device profile |
| `src/client/game/util/mobile_device_profile.ts`                           | Phone capability class and its render-scale/draw-distance clamps       |
| `src/client/game/util/mobile_frame_pacing.ts`                             | Mobile-only 30 FPS render cap (simulation rate is untouched)           |
| `src/client/game/util/mobile_action_controls.ts`                          | Which phone action/combat buttons exist, their labels and block rules  |
| `src/client/game/util/mobile_atlas_decode.ts`                             | Shared correct base64 decode; mobile-only per-field payload release    |
| `src/client/game/resources/graphics_settings.ts`                          | Draw-distance floors and dynamic graphics settings                     |
| `src/client/game/resources/dynamic_settings_updater.ts`                   | CPU/GPU quality adaptation policy                                      |
| `src/client/game/renderers/renderer_controller.ts`                        | Frame orchestration and version-aware React flush                      |
| `src/client/resources/react.ts`                                           | Observed resource version tracking and listener pruning                |
| `src/client/game/renderers/npcs.ts`                                       | Frame-level NPC selection, puppet projection, shared lighting input    |
| `src/client/game/resources/npcs.ts`                                       | Cached NPC render nodes/materials and throttled diagnostics            |
| `src/client/game/renderers/local_dev/harthmere_assets.ts`                 | Runtime asset budgets, LOD, animation throttling, direct scene routing |
| `src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts` | Marker distance/frustum culling and 4 Hz terrain grounding             |
| `src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts`   | Quest-marker visibility, grounding, and throttled diagnostics          |
| `src/client/game/webasm.ts`                                               | Normal/SIMD Voxeloo selection and WASM memory cvals                    |
| `src/client/game/worker/client.worker.ts`                                 | Optional block-geometry worker boundary                                |
| `src/shared/harthmere/town_production_polish.ts`                          | Render budgets, LOD distances, streaming pre-warm                      |
| `scripts/harthmere/check-biomes-harthmere.cjs`                            | Static invariants for the current runtime contract                     |
| `scripts/harthmere/check-harthmere-performance-response.cjs`              | Regression guard for the installed performance fixes                   |

## Mobile AAC catalogue beyond music

The mobile audio optimization now includes short effects, environmental beds,
and committed NPC speech without removing any desktop/original asset. The
generated inventory is 3,117 AAC-LC/M4A files:

| Family                        |     Originals | Original bytes | Mobile AAC bytes | Reduction |
| ----------------------------- | ------------: | -------------: | ---------------: | --------: |
| NPC speech                    |     2,164 MP3 |     306.08 MiB |       159.87 MiB |     47.8% |
| Harthmere effects/ambience    | 840 Opus/WebM |      10.07 MiB |         7.06 MiB |     29.9% |
| Packaged non-music core audio |      113 WebM |       3.74 MiB |         2.72 MiB |     27.2% |
| **Total**                     |     **3,117** | **319.88 MiB** |   **169.65 MiB** | **47.0%** |

The six core WebM files belonging to the music, muck-music, and cave-music
families are not duplicated here; the earlier mobile music pass already owns
their selected AAC tracks. This removes about 26 MiB of redundant output from
the image and repository.

Selection is deliberately not “AAC everywhere.” Apple mobile WebKit prefers
AAC-LC for WebAudio buffers. Android retains WebM/Opus when supported and uses
AAC only as fallback. Mobile NPC speech prefers AAC because it streams through
an audio element and the reviewed catalogue is materially smaller; desktop
continues using the source MP3. This preserves Opus efficiency where it is
already reliable while avoiding Apple decode incompatibilities.

Compressed format does not eliminate WebAudio PCM allocation. Mobile one-shot
and stopped-loop cleanup therefore invalidates `/audio/buffer` after the Three
audio node disconnects. The next repeated sound may decode again, trading a
small first-play cost for bounded phone residency. Desktop does not take this
path and retains its low-latency decoded cache.

The reproducible generator/auditor is
`scripts/harthmere/generate-mobile-audio-variants.cjs`. Its report is written to
`artifacts/mobile-audio-variants-report.json`; originals are never overwritten.

## Final combat-FPS Chrome guard — August 5, 2026

The desktop acceptance separated one more setup flood from the game renderer.
Browser-control environments can expose Pointer Lock yet reject it with
`WrongDocumentError` because the canvas belongs to a document that is no
longer valid for locking. The pointer-lock manager treats that result as
terminal, falls back to focused keyboard/mouse input, and cancels the 125 ms
retry interval immediately. This removes up to forty rejected lock attempts
and warning objects from the first five seconds of gameplay.

Do not infer that every remaining low sample is a tier-3 graphics failure. A
same-scene `forceGraphicsQuality=low` comparison stayed at 14 FPS while exactly
one `game` WebGL renderer existed and the host was saturated by unrelated VM,
browser, compiler, and snapshot-scan work. Because reducing postprocessing,
flora, entity limits, and draw distance did not change the result, the correct
next gate is an identical sample on a released host—not a speculative global
quality downgrade.
