# Harthmere Performance And Placement Guide

Last updated: 2026-08-01

This guide is the current operating contract for Harthmere placement,
streaming, NPC grounding, quest markers, and performance diagnostics.

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

Fast-travel destinations should queue the pre-warm ring before the player
camera engages. The pre-warm descriptor lives in
`HARTHMERE_PERF_AND_PLACEMENT_PREWARM`.

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

| Metric | Previous production sample | 2026-08-01 build |
|---|---:|---:|
| Render interval | 82–85 ms | 63.8–70.8 ms |
| Approximate aggregate FPS | 11.8–12.2 | 14.1–15.7 |
| CPU render time | 57–60 ms | 47.0–47.7 ms |
| GPU render time | about 8 ms | 5.3–8.0 ms |
| Event-loop latency | 140–147 ms | 83.8–87.1 ms |
| Render + postprocessing | not isolated | 19.8–20.2 ms |
| Script controller | not isolated | 0.53–0.58 ms |

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

## Render Distance Contract

Harthmere is an open, landmark-driven world. Auto graphics must not collapse
terrain and synchronization into the old 64 m "short headlight" view merely
because the client is CPU-bound.

For Glitch/embed sessions, `src/client/game/client_config.ts` sets:

```ts
ret.dynamicMinDrawDistance = 192;
```

This has the following behavior:

- Auto/dynamic graphics retain at least 192 m of terrain and synchronization
  distance.
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
- the world itself retains the 192 m dynamic minimum described above;
- static business/jobs-board debug bridges are installed once per renderer;
- quest-marker debug snapshots publish at 2 Hz rather than every frame.

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
- Voxeloo WebAssembly is built with pthreads disabled (`USE_PTHREADS=0`).

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

The dependency snapshot reviewed for this audit was:

| Area | Current checkout | 2026-08-01 candidate | Expected sustained-FPS value |
|---|---:|---:|---|
| Three.js | 0.185.1 / r185 | Current | Potentially material only when paired with batching or renderer restructuring |
| gltfpack | 0.17.0 | 1.2.0 | Small or workload-dependent; primarily asset size, decode, and geometry quality |
| React / React DOM | 18.2.0 | 19.2.8 | Low for the canvas; possible HUD/UI benefit |
| Next.js | 13.3.2 | 16.2.12 | No expected steady-state game FPS benefit |
| Emscripten | 3.1.41 | 6.0.5 | Low whole-frame value unless a measured Voxeloo operation is hot |
| Node.js | 20.20.2 locally | 24.x LTS | Server throughput/build maintenance, not browser rendering |
| Bazel | 6.3.1 | 9.2.0 | Build/test maintenance, not browser rendering |
| TypeScript | 5.9.3 | 7.0.2 | Build/typecheck only |
| Webpack | 5.81.0 | 5.109.2 | Mostly build and bundle generation, not frame execution |

Registry versions are a dated planning snapshot, not permission to update a
lockfile. Three.js was upgraded and validated separately on 2026-08-01; re-check
the remaining candidates at the start of any future upgrade branch.

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
roots. WebGPU must be a separate project.

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

The r185 API migration is complete, but the generator correction still needs a
fresh exact-source build and browser acceptance before runtime sign-off.
Preserve that corrected renderer as the A/B control for performance work. The
next order is:

1. Capture calls, triangles, object counts, CPU render time, GPU render time,
   and frame interval at fixed production-town camera positions.
2. Batch or instance one static district/material family.
3. Compare measurements before expanding the conversion.
4. Keep the change only if CPU frame time and draw calls improve without
   increasing GPU time, memory, shader errors, or visual defects.

`InstancedMesh` remains appropriate for repeated identical props, while r185
`BatchedMesh` is the next candidate for compatible static geometry. Measure
both against the same fixed-camera production-town baseline.

### Galois asset-pipeline upgrades are secondary

Galois already runs `gltfpack -kn`, so GLTF/GLB geometry is not completely
unoptimized. Upgrading gltfpack and comparing generated bytes, vertex/index
counts, bounds, animation channels, and runtime draw calls is reasonable, but
it is not a substitute for scene batching.

The runtime currently has no KTX2/Basis texture loading path. Adding one can
reduce download size, decode work, and GPU memory, which is useful for startup,
stutter, and memory pressure. Because production is CPU-render-bound rather
than GPU-bound, compressed textures are not expected to recover the missing
steady-state frame time on their own.

Do not enable mesh-compression extensions or new texture formats until the
matching Three.js decoders, generated assets, publication index, cache version,
and fallback behavior are tested as one compatibility unit.

### React and Next.js upgrades are not renderer fixes

The React resource flush fix removed the most obvious per-frame UI wakeup. A
small React Compiler trial on the Harthmere HUD may reduce avoidable component
work, and it can be evaluated independently before a full framework migration.
It will not reduce Three.js scene construction or WebGL submission cost.

Next.js should eventually be brought to a supported, patched release for
security and maintenance. That migration is unusually high-risk here because
the application uses Pages Router, `next-pwa`, asynchronous WebAssembly, custom
Webpack rules, a WebAssembly chunk workaround, and a pages-manifest repair
plugin. Treat it as a platform upgrade with load/startup/bundle goals, not as
an FPS task.

### Voxeloo and Emscripten upgrades require a measured native hot path

The normal gameplay build already selects SIMD when supported and the default
`./b` dependency build uses the release configuration with `-O3`. A newer
Emscripten/LLVM toolchain may improve individual native kernels, but Voxeloo is
not the dominant measured frame cost. Upgrade it only with before/after native
microbenchmarks and browser measurements for the exact operations in the frame
profile.

The higher-value native experiment remains worker offload: use the SIMD module
in the worker, transfer rather than clone buffers, and move a complete terrain
geometry preparation stage off the main thread. Enabling pthreads is not a
version bump; it changes hosting headers, WebAssembly memory, worker behavior,
and iframe compatibility.

### Server-system upgrades do not increase client FPS directly

ECS, Redis, Anima, and Gaia upgrades can improve server tick throughput,
replication latency, simulation capacity, or operational reliability. They do
not reduce the browser's scene traversal and draw submission unless they also
change how much data or how many visible entities the client receives. Any such
change must preserve the 192 m render-distance contract and should use client
LOD, aggregation, or lower update frequency rather than hiding the world.

Current recommendation:

1. Do not perform a broad dependency upgrade for FPS.
2. Use the validated r185 renderer as the control and prototype static batching
   on one material-compatible district.
3. Adopt `BatchedMesh` more broadly only if the call-count and CPU-frame-time
   benchmark is positive.
4. Evaluate React Compiler and Galois/KTX2 separately for UI and memory/load
   improvements.
5. Schedule Next.js, Node, Bazel, TypeScript, and Emscripten upgrades for
   supportability, security, or build health—not as claimed FPS fixes.

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

## Change and Deployment Safety

Performance investigation, production log collection, browser inspection, and
source optimization do **not** authorize a build, deployment, traffic change,
restart, or image push. Those are separate actions and require an explicit user
instruction.

Status at this document update:

- The 192 m dynamic view-distance floor and the earlier React/NPC performance
  batch were present in the latest production build inspected on 2026-08-01.
- The final direct-scene-routing, gathering-node, and marker-diagnostic changes
  were source-only and validated locally.
- No production build or deployment was initiated for that final source batch.

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

| File | Responsibility |
|---|---|
| `src/server/shim/main.ts` | NPC seed/spawn, stable anchors, claim set, dialogue |
| `src/client/components/challenges/LocalDevHarthmereQuests.tsx` | Quest definitions, quest targets, target terrain labels |
| `src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx` | Tracked mission state, auto-untrack, marker-clear events |
| `src/client/components/challenges/SnapshotLiveDiagnostics.tsx` | Auto-survey, wandering filter, auto-throttle, mission audit |
| `src/client/game/client_config.ts` | Glitch/embed dynamic draw-distance floor and client feature flags |
| `src/client/game/resources/graphics_settings.ts` | Draw-distance floors and dynamic graphics settings |
| `src/client/game/resources/dynamic_settings_updater.ts` | CPU/GPU quality adaptation policy |
| `src/client/game/renderers/renderer_controller.ts` | Frame orchestration and version-aware React flush |
| `src/client/resources/react.ts` | Observed resource version tracking and listener pruning |
| `src/client/game/renderers/npcs.ts` | Frame-level NPC selection, puppet projection, shared lighting input |
| `src/client/game/resources/npcs.ts` | Cached NPC render nodes/materials and throttled diagnostics |
| `src/client/game/renderers/local_dev/harthmere_assets.ts` | Runtime asset budgets, LOD, animation throttling, direct scene routing |
| `src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts` | Marker distance/frustum culling and 4 Hz terrain grounding |
| `src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts` | Quest-marker visibility, grounding, and throttled diagnostics |
| `src/client/game/webasm.ts` | Normal/SIMD Voxeloo selection and WASM memory cvals |
| `src/client/game/worker/client.worker.ts` | Optional block-geometry worker boundary |
| `src/shared/harthmere/town_production_polish.ts` | Render budgets, LOD distances, streaming pre-warm |
| `scripts/harthmere/check-biomes-harthmere.cjs` | Static invariants for the current runtime contract |
| `scripts/harthmere/check-harthmere-performance-response.cjs` | Regression guard for the installed performance fixes |
