# Harthmere / Biomes render + runtime performance audit — 2026-08-03

**Scope:** three.js renderer & pass graph, WebGL resource usage, native ECS + client sim loop,
Gaia, Anima, Galois.

> **Status: partially remediated (same day).** Findings 1, 2, 3, 6, 11a, 12, 14 and the
> `TerrainRenderer` / `npcs` allocation items were fixed in the pass described in
> [§ Remediation log](#remediation-log) at the bottom of this document. Findings 4, 5, 7, 9 (WASM
> sharder), 10, 11b, 13 and 15 remain open. Every remaining item is annotated **OPEN** or **FIXED**
> in the table below. The deployed Glitch GPU-classification defect identified after the original
> audit is recorded as finding 17 and is now **FIXED**.

**Stack observed:** three `0.185.1`, WebGL2 required, custom multi-pass deferred-ish composer
(`RenderPassComposer`), voxel terrain meshed in WASM (`voxeloo`), Harthmere content rendered by a
separate 36k-line `HarthmereRuntimeAssetsRenderer`, ECS entities culled through a spatial index.

The engine architecture is sound. Most of the wins below are *regressions or oversights inside a
good design* rather than redesigns — several are one-line fixes with double-digit percentage upside.

---

## Ranked findings

| # | Finding | Type | Impact | Effort | Status |
|---|---------|------|--------|--------|--------|
| 1 | Far-NPC animation throttle is dead code — `camera` is always `undefined` | CPU | **Very high** | Trivial | ✅ **FIXED** |
| 2 | Bloom threshold pass regenerates a full-res RGBA16F mip chain every frame, never sampled | GPU | **High** | Trivial | ✅ **FIXED** |
| 3 | `sortObjects = false` → no front-to-back opaque sort, and water `renderOrder` is a no-op | GPU | **High** | Low–Med | ⚠️ **PARTIAL** — water ordering fixed; opaque sort / depth prepass still open |
| 4 | One unique material + 4 unique data textures per terrain shard → no batching | GPU | **High** | High | 🔲 OPEN |
| 5 | 2.8 MB of base64-in-JSON texture atlases decoded + RGB→RGBA remapped on the main thread at boot | Load | **High** | Med | 🔲 OPEN |
| 6 | Block/flora atlases build mip chains that are never used (`minFilter = LinearFilter`) | GPU/VRAM | Med–High | Trivial | ✅ **FIXED** |
| 7 | ~10 full-resolution RGBA16F render targets live simultaneously | VRAM/bandwidth | Med–High | Med | 🔲 OPEN |
| 8 | `scenes.*.clear()` + full re-add + double `traverse()` per object per frame | CPU | Med | Med | 🔲 OPEN |
| 9 | Per-frame WASM + JS allocation in `TerrainRenderer.draw` | CPU/GC | Med | Low | ⚠️ **PARTIAL** — limiter + destruction uniforms hoisted; WASM `VisibilitySharder` still per-frame |
| 10 | String-keyed spatial hash + column cache → ~15k string allocs/frame in NPC collision | CPU/GC | Med | Low | ⚠️ **PARTIAL** — obstacle grid now integer-keyed; grounded-column cache still string-keyed |
| 11 | `debug.checkShaderErrors = true` unconditionally; dynamic `PointLight` count forces shader recompiles | Hitching | Med | Low | ⚠️ **PARTIAL** — shader-error check gated; light pooling still open |
| 12 | Always-on `timeCode()` instrumentation allocates a timer per renderer per script per frame | CPU | Low–Med | Low | 🔲 OPEN |
| 13 | Dynamic render scale silently disabled when `EXT_disjoint_timer_query_webgl2` is missing | Adaptivity | Med | Low | 🔲 OPEN |
| 14 | Shared depth texture allocated at pixelRatio² on first frame | VRAM spike | Low | Trivial | ✅ **FIXED** |
| 15 | 15 MB uncompressed `.gltf` assets; KTX2/meshopt wired but zero `.ktx2` files shipped | Load/VRAM | Med | Med | 🔲 OPEN |
| 16 | `npcs.ts` hidden-puppet removal was O(n²) | CPU | Low | Trivial | ✅ **FIXED** |
| 17 | Glitch/local-assets builds bypass GPU detection and pin every client to tier 1 | Adaptivity/quality | **High** | Low | ✅ **FIXED** — complete same-origin `detect-gpu` dataset |

---

## A. Main-thread / CPU per frame

### 1. The far-NPC animation throttle never engages (highest-value fix in the audit)

`src/client/game/renderers/local_dev/harthmere_assets.ts:28353`

```ts
const camera: THREE.Camera | undefined = (
  scenes as { three?: { camera?: THREE.Camera } }
).three?.camera;
```

`scenes.three` is a `THREE.Scene`. **`THREE.Scene` has no `camera` property** — nothing in the
codebase assigns one (grep for `.camera =` finds only `SkyFadePass` / `SkyColorPass` internals). So
`camera` is permanently `undefined`, which means:

```ts
const hasCamera = Boolean(camera);            // always false
const shouldUpdateMotion = !hasCamera || ...; // always true
```

Every animated instance therefore takes the full path every frame: `mixer.update(dt)` (full skeletal
evaluation), wander integration, ground re-probe, a swept obstacle test, and the 8-neighbour
repulsion loop. The NEAR/MID/FAR distance gates (`polishFrame & 7`, `& 15`) never fire. With the 573
actors the code comments reference, this is likely the single largest CPU cost in the frame.

`updateHarthmerePlacementLod(dt, camera)` receives the same `undefined`, but survives because
`harthmereLodOrigin()` (`:28778`) falls back to `window.__harthmereForwardArcRuntime.position`. LOD
works; the animation throttle does not.

**Fix:** pass `this.resources.get("/scene/camera").three` (the renderer already holds `resources`),
or reuse `harthmereLodOrigin()` for the throttle so both systems share one origin. Add a unit test
asserting `shouldUpdateMotion` is false for a far actor — the current tests can't catch this because
the fallback masks it.

### 2. Scene graph is torn down and rebuilt every frame with two traversals per object

`renderer_controller.ts:250-256` clears all six scenes each frame; every renderer then re-adds its
roots. `scenes.ts:71` (`scenesForObject`) and `scenes.ts:101` (`addMaterialDependencies`) each call
`object.traverse(...)` over the whole subtree — so **every object is walked twice per frame** for
classification and uniform-dependency collection, allocating a `Set<SceneType>` per call. The
`// TODO cache/memoize` on line 70 is still open.

`HarthmereRuntimeAssetsRenderer` already bypasses this (`:28597` adds `this.root` straight to
`scenes.three` with a comment explaining exactly this cost) — good. The terrain renderer, players,
NPCs, drops, placeables and the six other Harthmere marker renderers still go through
`addToScenes`/`addToScene`.

**Fix:** memoize scene classification and material dependencies on the object (`userData`, keyed by
a material-revision counter), invalidated when materials change. Cheap and mechanical.

### 3. Per-frame allocation in `TerrainRenderer.draw`

`src/client/game/renderers/terrain.ts:154-200`

Every frame allocates: a `TerrainResourceLimiter` (which allocates two `ResourceLimiter`s), an
`OcclusionMeshWriter`, **a new `voxeloo.VisibilitySharder` WASM object** (`:177`), a `shards[]` array,
and four mesh arrays. `shards.map(...)` at `:266` is used purely for side effects, allocating a
discarded result array sized to the visible shard count.

Inside the per-shard loop, `this.destructionUniforms(id)` (`:490`) runs **per shard per frame** and
each call does `resources.get("/scene/local_player")` plus two `resources.cached(...)` lookups — all
of which are shard-independent. `updateBlocksMaterial(mesh.material, {...defaultBlockMaterial, ...destructionUniforms})`
spreads two objects per shard per frame.

**Fix:** hoist the limiter/sharder/writer to instance fields with a `reset()`; compute
`destructionUniforms` once per frame outside the loop (it can only apply to one shard); replace
`shards.map` with `for...of`; use pre-allocated arrays with a length reset.

### 4. String-keyed hot maps in NPC collision and grounding

`harthmere_assets.ts:4362` — `harthmereObstacleGridKey(cx, cz) { return cx + "|" + cz; }`

The grid hash itself was a correct fix (the comment documents the prior ~25M AABB checks/frame), but
each lookup still allocates a string. `findHarthmereNpcBodyCollisionObstacle` probes **9 offsets**,
and `sweepHarthmereNpcCollisionObstacle` runs that at ~1 sample per 0.42 m along the step, and
`resolveHarthmereNpcWanderPosition` calls the sweep up to 3×. That's roughly 27–80 string
allocations per moving NPC per frame, plus `harthmereWanderGroundedFeetYByColumn`
(`Map<string, number>`, `:4310`) keyed the same way.

**Fix:** pack to an integer key (`(cx << 16) ^ (cz & 0xffff)`) into a `Map<number, ...>`, or a flat
typed-array grid over the known town bounds. Zero allocation, faster hashing.

### 5. Always-on `timeCode()` instrumentation

`src/shared/metrics/performance_timing.ts:44` — `timeSyncCode` constructs a `PerformanceTimer` and,
on `stop()`, does a string-keyed `Map.get`, an `Averager.push`, and a `gauge.set`. This wraps every
renderer (`renderer_controller.ts:472`), every script (`script_controller.ts:27`), plus `draw`,
`render + postprocessing`, `react emitter invalidate`, and `resources:collect` — and nests inside
terrain resource generation. Call it ~40–200 object allocations + map lookups per frame.

`globalThis.enablePerformanceApi` correctly gates the expensive `performance.mark/measure`, but the
timer object and gauge update are unconditional.

**Fix:** gate aggregate stat collection behind a sampling counter (e.g. every 16th frame) or a
`__DEV__`-style flag for the innermost loops. Keep the outer few.

---

## B. GPU / WebGL

### 6. Bloom threshold pass regenerates a full-res mip chain every frame

`src/client/game/renderers/passes/bloom.ts:31-51`

```ts
const target = new THREE.WebGLRenderTarget(bufferSize.width, bufferSize.height);
target.texture.type = THREE.HalfFloatType;
target.texture.minFilter = THREE.LinearFilter;   // NOT a mipmap filter
target.texture.generateMipmaps = true;           // ← mips built anyway
```

three r185's `textureNeedsGenerateMipmaps` returns `texture.generateMipmaps` **without checking the
filter** (`three.cjs:71091`), and `updateRenderTargetMipmap` (`three.cjs:73235`) runs on every
`setRenderTarget` away from the target. So the driver builds a complete mip pyramid of a full-
resolution RGBA16F texture every single frame, and nothing ever samples a mip level — the five
`BloomDownsamplePass` targets do the downsampling explicitly, and they all correctly set
`generateMipmaps = false` (`bloom.ts:99`).

This is the only pass in the whole pipeline with `generateMipmaps = true`. At 1080p it's roughly 8 MB
of extra write bandwidth plus a pipeline flush per frame, for nothing.

**Fix:** `target.texture.generateMipmaps = false;` — one line, on the bloom path only, zero visual
change.

### 7. `sortObjects = false` disables front-to-back opaque sorting *and* silently breaks water ordering

`src/client/renderer/pass_renderer.ts:74`

```ts
// Tell threejs not to sort objects by depth, so that we can sort manually,
// e.g. by material to improve performance.
this.threeRenderer.sortObjects = false;
```

Two consequences:

1. **Opaque geometry renders in insertion order**, not front-to-back. For a voxel world with heavy
   overdraw this forfeits most of the early-Z benefit. There *is* a `DepthPrePass` (`earlyz`), but
   it's gated behind a `localStorage` flag (`renderer_controller.ts:335`,
   `settings.graphics.depthPrePass`) and off by default — so the default configuration has neither
   front-to-back sorting nor a depth prepass.
2. **`renderOrder` is dead.** `terrain.ts:341` sets `waterMesh.renderOrder = shardDistance` intending
   back-to-front water. In three, `renderOrder` is only read inside the sort comparators
   (`three.cjs:68096`, `:68126`), which run only when `sortObjects === true` (`three.cjs:77657`).
   Water and translucent glass shards therefore blend in arbitrary shard-insertion order.

Note the manual grouping the comment promises *does* happen for terrain — `terrain.ts:404-417`
buckets block/flora/glass/water meshes and adds them in material order. That part is working.

**Fix (cheapest correct option):** enable `sortObjects` on the `water` and `translucency` scene
passes only, or sort the `waterMeshes[]` array by distance before adding it (`terrain.ts:414`) since
insertion order *is* draw order. Separately, enable the depth prepass by default on tier ≥ 2 GPUs and
measure — the machinery already exists.

### 8. Per-shard materials and textures prevent any batching

`src/client/game/resources/blocks.ts:311-345` — each terrain shard builds **its own**
`BasePassMaterial` plus four `DataTexture`s (`materialRank`, `materialData`, `lightingRank`,
`lightingData`) via `makeBufferTexture`. Same pattern in `glass.ts`, `water.ts`, `florae.ts`.

So each visible shard is: 1 draw call, 1 full uniform-block upload, and ~9 texture binds (4 unique +
5 shared: `colorMap`, `mreaMap`, `index`, `destroyTexture`, `shapeTexture`). The shader *program* is
shared (identical source ⇒ same three cache key), so this is uniform/bind cost rather than compile
cost — but at typical shard counts it's the dominant GL state churn.

**Fix (structural, highest ceiling):** move per-shard lighting/material buffers into a shared
texture-array or SSBO-style atlas indexed by a per-draw `origin`/slice uniform, leaving one material
for all block shards. That unlocks true material batching and, eventually, multi-draw. This is a real
project — but it's the ceiling-raiser for dense scenes.

**Fix (incremental):** merge adjacent shards' geometry into larger batches at mesh time, reducing
draw count by 4–8× with no shader changes.

### 9. Render-target footprint

Live full-resolution `RGBA16F` targets in the default high pipeline:

- `SceneBasePass` MRT × 3 (`color`, `normal`, `baseDepth`) — `scene_base_pass.ts:29-59`
- shared `secondaryColor` — `composer.ts:176`
- `water`, `punchthrough`, `translucency` scene passes — `standard_passes.ts:104-135`
- `bloomThreshold`, `color_correction`, SMAA (3 internal), skyfade — postprocess chain
- shared 32-bit `DepthTexture` — `composer.ts:167`

At 1920×1080, `RGBA16F` is 8 bytes/px ⇒ ~16.6 MB each; ten of them is ~170 MB of VRAM and a
comparable per-frame bandwidth bill. Two easy reductions are visible in the source:

- `normal` is `RGBA16F`; an octahedral-encoded `RG16F` or `RGB8` halves-to-quarters it.
- `baseDepth` is a separate `R16F` MRT attachment duplicating the depth texture — the code already
  carries the TODO: *"determine if this is faster as a copy rather than a MRT"* (`scene_base_pass.ts:52`).
  Dropping it from the MRT removes a full-res attachment write from every base-pass fragment.

### 10. Shader-recompile hitches

- `pass_renderer.ts:89` — `this.threeRenderer.debug.checkShaderErrors = true;` unconditionally. Each
  program link becomes a synchronous `getProgramParameter(LINK_STATUS)` stall. Should be
  `!isProd`.
- `THREE.PointLight`s are created dynamically at runtime: loot-drop markers
  (`harthmere_loot_drop_markers.ts:84`), business board markers
  (`harthmere_business_board_marker.ts:183`), projectiles (`harthmere_projectiles.ts:694, 1219, 1496,
  1631, 1787`), and authored placements (`harthmere_assets.ts:34876`). In three, the light *count* is
  a `#define` baked into the program cache key — so every change in the number of active point lights
  recompiles **every stock-material program in `scenes.three`**. Combat with projectiles is exactly
  when this fires. Pooling a fixed number of point lights (toggling `intensity` to 0 instead of
  adding/removing) eliminates the hitch entirely.

### 11. Dynamic render scale may never engage

`graphics_settings.ts:154` — `hasDynamicRenderScale = profiler()?.supportsGpuTime() ?? false`, which
is `makeGpuTimer(...)` returning non-undefined, which requires `EXT_disjoint_timer_query_webgl2`
(`gpu_timer.ts:20`). When the extension is absent the code logs a warning and silently falls back to
a *fixed* resolution target — `[3840, 2160]` on `high`, `[1280, 720]` on `low` — and the whole
`DynamicSettingsUpdater` render-scale ladder is bypassed. The extension is frequently unavailable
(headless, some Linux/ANGLE configs, hardened Chrome policies, most VMs).

**Fix:** fall back to CPU-time-driven render-scale adaptation. `PerformanceProfiler.cpuRenderTime()`
and `renderInterval()` are always populated, and `DynamicSettingsUpdater.extractStats` already
tolerates `gpuTimeMs === undefined` — the gate is upstream in `graphicsQualityForDevice`'s consumer.
Check the console for `"EXT_disjoint_timer_query_webgl2 not supported"` to confirm on target hardware.

### 12. Depth texture over-allocated on the first frame

`composer.ts:160-170`:

```ts
const size = this.renderer.getSize(new THREE.Vector2());
size.width *= pixelRatio;                 // already scaled here
...
const depthTexture = new THREE.DepthTexture(
  size.width * pixelRatio,                // ← scaled a second time
  size.height * pixelRatio
);
```

At DPR 2 the initial depth texture is 4× the intended pixel count. `resizeBuffers()` corrects it on
the first frame, so it's a transient VRAM spike rather than a steady-state leak — but on a 4K display
that's a >250 MB allocation at startup, which is a plausible contributor to boot-time context loss on
constrained GPUs.

---

## C. Load time / memory

### 13. Texture atlases ship as base64 inside JSON and are decoded synchronously

`blocks.ts:90-107`, `florae.ts:56`, `glass.ts:76`, `materials.ts:20`, `item_mesh.ts:342`

```ts
const config = await jsonFetch<BlockAtlasData>(resolveAssetUrl("atlases/blocks"));
colorMap: makeColorMapArray(new Uint8Array(Buffer.from(config.colors.data, "base64").buffer), ...)
```

Shipped sizes: `blocks.json` 1.43 MB, `florae.json` 1.22 MB, `glass.json` 142 KB — ~2.8 MB. Base64
carries a 33% size penalty over raw binary, and the decode path is: `JSON.parse` the whole file →
`Buffer.from(..., 'base64')` (the **browserify Buffer polyfill**, pure JS in the browser) → then
`makeColorMapArray` (`textures.ts:44-56`) runs a per-pixel JS loop remapping RGB→RGBA. All of this is
synchronous on the main thread during boot.

**Fix:** ship the atlases as raw `.bin` + a small JSON sidecar for `shape`, `fetch` →
`arrayBuffer()`, and do the RGB→RGBA expansion in a worker (or upload as `RGBFormat` / pre-expand at
build time in Galois). Removes ~1 MB of transfer and a multi-hundred-millisecond main-thread stall.

### 14. Atlas mip chains are built and never used

`src/client/game/util/textures.ts:59-62`

```ts
ret.generateMipmaps = true;
ret.magFilter = THREE.NearestFilter;
ret.minFilter = THREE.LinearFilter;   // ← no mipmap filter, so mips are never sampled
```

Same class of bug as finding #6, applied to the block/glass/flora `DataArrayTexture`s. Costs ~33%
extra VRAM per atlas and a mip-generation pass at upload.

Worth deciding which way to fix it: `generateMipmaps = false` reclaims the VRAM, or
`minFilter = LinearMipmapLinearFilter` actually *uses* the mips — the latter reduces distant-terrain
aliasing **and** improves texture-cache hit rate, which usually nets a GPU win in a voxel world. My
read is that the mips were intended and the filter is the oversight. Try the filter change first and
compare.

### 15. Uncompressed model assets

`public/buckets/biomes-static/asset_data/npcs/big_mucker.*.gltf` is **15.5 MB** — a JSON `.gltf`, not
a binary `.glb`, with no Draco or meshopt compression. `item_meshes/npcs/big_mucker.*.json` is a
further 6.1 MB.

Meanwhile `gltf_helpers.ts:20-52` correctly wires `MeshoptDecoder` and a `KTX2Loader` with a worker
pool — but `find public -name "*.ktx2"` returns **zero files**, and there are 78 raw PNG/JPEG textures
under `public/models`. The decode infrastructure is built and unused.

**Fix:** run `gltfpack` (the `assets:install-gltfpack` script already exists in `package.json`) over
the asset pipeline with `-cc` and KTX2 texture output. Typical result is 5–10× smaller downloads and
materially lower texture VRAM, with no client code changes.

Also worth checking: `public/` totals ~3.3 GB (`buckets` 1.4 GB, `assets` 902 MB, `splash` 419 MB,
`harthmere/voices` 310 MB, `models` 300 MB) and `next-pwa` is enabled in production
(`next.config.js:23`). Confirm the service-worker precache manifest is scoped to the app shell and is
not attempting to precache asset buckets.

---

## D. Native ECS / client sim loop

Broadly healthy — this section is mostly a clean bill of health.

- **`Loop.tick`** (`context_managers/loop.ts:196`) correctly decouples simulation from render via
  `FixedRateTicker` with a catch-up cap (`:110-125`), so slow frames don't spiral.
- **`reactResources.flush()`** (`renderer_controller.ts:270`) already only wakes listeners whose
  observed resource version changed — the comment documents a prior fix. Good.
- **Frustum culling** is real: `entitiesInFrustum` (`cull_entities.ts:18`) queries a spatial index
  with a convex-polytope refinement rather than scanning all entities. Draw limits are applied per
  entity class via `drawLimitValueWithTweak`.
- **Static matrices are frozen** — `freezeStaticObjectMatrices` (`static_object_matrices.ts`) sets
  `matrixAutoUpdate = false` on placed town geometry, avoiding a full-graph matrix recompute.

Two smaller items:

- `nearestEntities` (`cull_entities.ts:65`) allocates a `[entity, distSq]` tuple per candidate, then
  `.sort().map().splice()` — three array passes per frame per entity class. A partial selection
  (quickselect to `maxCount`) avoids the full sort and the intermediates.
- `npcs.ts:84` removes hidden NPCs with `entities.splice(i, 1)` inside a reverse loop — O(n²) worst
  case. Only matters if puppet overrides get large; a filter pass is simpler and linear.

---

## E. Gaia, Anima, Galois

These are server/build-time systems; none of them execute on the client render thread. Their effect
on browser FPS is **indirect**, via how much work they hand the client.

**Gaia** (`src/server/gaia/`) runs 14 terrain simulations (water, muck, flora growth/decay,
irradiance, sky occlusion, tree/leaf/ore growth, restoration, farming) over sharded terrain. Every
voxel it mutates dirties a shard, and each dirty shard forces a client re-mesh — the single most
expensive client-side terrain operation (`blocks.ts` rebuilds geometry *and* four textures *and* a
material). `TerrainResourceLimiter` (`terrain.ts:87`) throttles this to 6 normal + 40 critical shard
builds per frame, so it degrades gracefully, but sustained Gaia churn near the player translates
directly into a lower steady-state frame rate.

**Worth measuring:** the rate of terrain shard invalidations per second while standing still in
Harthmere town. If `irradiance` / `sky_occlusion` / `flora_*` are re-dirtying town shards on a timer,
capping their per-tick voxel budget inside the town AABB is a much cheaper win than any client-side
optimization. The client-side counters already exist (`renderer.terrain.numRenderedBlockShards`,
`memory.liveBlockMeshCount`) — pair them with a shard-invalidation counter.

**Anima** (`src/server/anima/`) already does the right thing: `npc_ticker.ts` filters to NPCs with
nearby players (`potentialTicks` vs `npcTicks` counters at `:41-57`) and uses a fixed-rate ticker with
per-NPC histograms. Note that Harthmere's *visible* town NPCs are renderer-side
(`HarthmereRuntimeAssetsRenderer.animated`), **not** Anima entities — which is exactly why finding #1
matters and why Anima tuning won't help client FPS.

**Galois** (`src/galois/`, `src/gen/client/game/shaders/`) generates 56 shader modules and the asset
atlases. Two observations:

1. The generated `makeXMaterial(...)` factories (e.g. `gen/client/game/shaders/blocks.ts:31`) create a
   fresh `BasePassMaterial` with a full uniform object per call — which is what drives the per-shard
   material problem in finding #8. Fixing that properly means changing what Galois *emits*, not just
   the consumer.
2. `module.hot.accept` and a `shaderVersion` counter are compiled into every generated shader module
   (`blocks.ts:25-29`). Confirm these are tree-shaken in the production bundle; 56 modules × HMR
   scaffolding is small but pointless in prod.

---

## Suggested sequencing

**Completed after the original audit:** finding 17 no longer needs a workaround in the embedding
React application. The Biomes client now performs real hardware classification in Glitch builds.
Do not force tier 3 globally: the captured 14 FPS session was already running at tier 1, so its
primary bottleneck was not the amount of GPU quality enabled by the tier selection.

**Do first — hours, not days, and independently verifiable:**

1. Fix the NPC throttle camera (`harthmere_assets.ts:28353`) — expect the largest single CPU delta.
2. `generateMipmaps = false` on the bloom threshold target (`bloom.ts:47`).
3. Sort `waterMeshes[]` by distance before adding (`terrain.ts:414`), since `renderOrder` is inert.
4. Gate `checkShaderErrors` behind `!isProd` (`pass_renderer.ts:89`).
5. Fix the double-`pixelRatio` depth texture (`composer.ts:167`).
6. Try `LinearMipmapLinearFilter` on the block atlas (`textures.ts:62`) and compare.

**Then — days:**

7. Hoist per-frame allocations out of `TerrainRenderer.draw`; compute `destructionUniforms` once.
8. Integer-key the NPC obstacle grid and grounded-column cache.
9. Memoize scene classification / material dependencies (close the `scenes.ts:70` TODO).
10. Pool point lights so the count never changes at runtime.
11. Ship atlases as binary + worker decode.
12. Run the assets through `gltfpack` with KTX2 output.

**Then — a project:**

13. Shared per-shard lighting/material buffers → one material for all block shards → batching.
14. Decide on the `normal` and `baseDepth` MRT attachments; drop or shrink both.
15. Enable the depth prepass by default on capable GPUs and measure against front-to-back sorting.

## How to verify

Every claim above is checkable in-session — this codebase has unusually good instrumentation already:

- `renderer.<name>.threejs.info` cval exposes `render.calls` / `render.triangles` and
  `memory.textures` / `memory.geometries` per frame. Watch `calls` before/after the batching work.
- `performanceTiming:renderers:<name>` gauges give per-renderer CPU cost — `renderers:terrain` vs
  `renderers:harthmereRuntimeAssets` will show finding #1's improvement immediately.
- `renderer.terrain.numRenderedBlockShards` and `memory.liveBlockMeshCount` bound the shard work.
- `GPU Tier Info is ...` reports the detector result; `Selected Graphics Tier is ...` reports the
  final tier after URL overrides; `WebGL Renderer Info is ...` separately reports the renderer and
  vendor from the active WebGL2 context. These values should no longer be conflated.
- A Glitch/local-assets boot should request one of the JSON files under
  `/assets/glitch/gpu-benchmarks/detect-gpu-5.0.28/`. It should not request the old GCS benchmark
  URL and should not report `gpu: "glitch-local-assets"` unless an old client bundle is deployed.
- Chrome DevTools → Performance, with `globalThis.enablePerformanceApi = true` set from the console,
  gives the full `timeCode` tree in the User Timing track.

---

## Remediation log

### 2026-08-03 — Glitch GPU classification and renderer diagnostics

The deployed Glitch client previously returned this result without inspecting the user's GPU:

```json
{
  "gpu": "glitch-local-assets",
  "isMobile": false,
  "tier": 1,
  "type": "FALLBACK"
}
```

The shortcut was active whenever the build used local assets, disabled GCP, or ran outside
production. Those are normal conditions for the Azure-hosted Glitch image, so every player was
assigned tier 1 even when hardware-accelerated WebGL2 was available. This was a configuration and
classification defect, not an iframe GPU-permission defect: the renderer already requires WebGL2,
requests `powerPreference: "high-performance"`, and rejects software rendering unless it is
explicitly allowed.

The root fix is in the Biomes client:

- `src/client/game/client_config.ts` no longer has environment-based tier-1 returns.
- `detect-gpu` now loads its complete, version-matched 5.0.28 benchmark set from the same origin at
  `public/assets/glitch/gpu-benchmarks/detect-gpu-5.0.28/`. The directory contains all 16 desktop
  and mobile JSON datasets rather than the old single placeholder `d-apple.json`.
- `scripts/sync-detect-gpu-benchmarks.cjs` reproduces the public dataset from the installed package
  and copies its license. Tests require the package version, public directory, and benchmark file
  set to remain synchronized.
- Detection uses `failIfMajorPerformanceCaveat: true`, matching the renderer's hardware requirement,
  while preserving the existing desktop thresholds and the diagnostic `?gpuTier=` override.
- Adaptive rendering starts conservatively at render scale 0.5 for tiers 0–1, 0.8 for tier 2, and
  1.0 for tier 3 before the existing runtime controller raises or lowers dynamic settings.
- The selected tier and the actual WebGL renderer are logged separately. The active context reports
  unmasked renderer/vendor information when the browser exposes `WEBGL_debug_renderer_info`, with
  privacy-safe masked values as fallback.

No change was made to Glitch's React `GamePlayPage` or `GameSwipePlayPage`, and no `webgpu` iframe
permission was added. The active renderer is WebGL2; WebGPU probing remains independent telemetry.
Forcing tier 3 from the parent pages would be harmful on genuinely constrained hardware and could
make the observed 14 FPS session slower.

Focused verification after the change:

- 19 GPU-classification, graphics-settings, and renderer-diagnostic tests pass.
- All 16 public benchmark JSON files are byte-for-byte identical to the installed `detect-gpu`
  package files.
- `git diff --check` passes.
- The repository-wide TypeScript check reports unrelated existing errors in business-customer,
  camera, interaction, overlay, and Harthmere test files; it reports no errors in the files changed
  for this remediation.
