# Harthmere / Biomes render + runtime performance audit — 2026-08-03

**Scope:** three.js renderer & pass graph, WebGL resource usage, native ECS + client sim loop,
Gaia, Anima, Galois.

> **Status: partially remediated (same day).** Findings 1, 2, 3, 6, 11a, 12, 13, 14, 18 and the
> `TerrainRenderer` / `npcs` allocation items were fixed in the pass described in
> [§ Remediation log](#remediation-log) at the bottom of this document. Findings 4, 5, 7, 9 (WASM
> sharder), 10 and 11b, 15 remain open. Every remaining item is annotated **OPEN** or **FIXED**
> in the table below. The deployed Glitch GPU-classification defect identified after the original
> audit is recorded as finding 17 and is now **FIXED**.
>
> **Update — 2026-08-03 (evening), captured-session pass.** A second HAR + console capture from
> production (`www.glitch.fun`, Apple M1 Max, GPU benchmark **556 FPS**, tier 3) showed a sustained
> **2–14 FPS** with an unbroken run of `[Violation] 'requestAnimationFrame' handler took <N>ms`.
> That capture surfaced **finding 18**, which the original audit missed entirely because it only
> examined `renderers/`, not the per-frame *scripts*. Finding 18 is the dominant cost in that
> capture. Findings 12 and 13 were also closed in the same pass. See
> [§ 2026-08-03 (evening) — captured-session frame-loop pass](#2026-08-03-evening--captured-session-frame-loop-pass).
>
> **Finding 19 — the "true on localhost, false in production" class.** Fixing the combat-VFX gate
> prompted a full sweep of every environment gate in `src/client` and `src/shared`. Three more
> subsystems were shipping dead: the player's third-person weapon rig (animated every frame into a
> group that never reached a scene), the terrain shard pre-warm ring, and the VFX layer itself. One
> more — the seven `NODE_ENV === "production"` early exits in the avatar pipeline — is **recorded
> but not changed** and needs a product decision. See [§ A.1](#a1--true-on-localhost-false-in-production-finding-19).

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
| 12 | Always-on `timeCode()` instrumentation allocates a timer per renderer per script per frame | CPU | Low–Med | Low | ✅ **FIXED** — gauge writes sampled 1-in-16 |
| 13 | Dynamic render scale silently disabled when `EXT_disjoint_timer_query_webgl2` is missing | Adaptivity | Med | Low | ✅ **FIXED** — CPU-share bottleneck inference |
| 14 | Shared depth texture allocated at pixelRatio² on first frame | VRAM spike | Low | Trivial | ✅ **FIXED** |
| 15 | 15 MB uncompressed `.gltf` assets; KTX2/meshopt wired but zero `.ktx2` files shipped | Load/VRAM | Med | Med | 🔲 OPEN |
| 16 | `npcs.ts` hidden-puppet removal was O(n²) | CPU | Low | Trivial | ✅ **FIXED** |
| 17 | Glitch/local-assets builds bypass GPU detection and pin every client to tier 1 | Adaptivity/quality | **High** | Low | ✅ **FIXED** — complete same-origin `detect-gpu` dataset |
| 18 | `OverlayScript.tick` runs an unbounded number of voxel raycasts and invalidates React every frame | CPU | **Very high** | Low | ✅ **FIXED** — see § A.0 |
| 19 | Production-only dead code behind the localhost `harthmereAssets` gate | Correctness/CPU | **High** | Low | ✅ **FIXED** — see § A.1 |

---

## A.1 — "True on localhost, false in production" (finding 19)

*Added 2026-08-03 evening, after the combat-VFX fix, from an explicit sweep of every
environment gate in `src/client` and `src/shared`.*

`shouldRenderHarthmereRuntimeAssets()` returns true on `localhost`/`127.0.0.1` or when the
`biomes.harthmereAssets` localStorage key is `"1"`, and false otherwise. That is correct for the
local-dev town it was written for. The bug class is everything that *borrowed* that flag, or that
lives under `HarthmereRuntimeAssets.root` without being part of the town — all of which worked
perfectly on every developer machine and never once ran for a real player.

**The sweep.** `grep` for `hostname === "localhost"`, `localStorage.getItem(...) === "1"`,
`NODE_ENV`, and `NEXT_PUBLIC_*` across `src/client` and `src/shared`. Results:

| Gate | Verdict |
|---|---|
| `biomes.harthmereAssets` (`harthmere_runtime_mode.ts`) | the master switch — 4 things wrongly behind it, below |
| `biomes.localDev.harthmere.{combatDebug,combatDiagnostics,npcCollisionVerbose,rendererVerbose,suppressStaticLifeForEcs}` | ✅ correct — diagnostics, default off everywhere |
| `roles.ts` localhost super-roles | ✅ intentional dev affordance |
| `harthmere_library.ts` local cutscene-video save | ✅ intentional, writes to a dev-only endpoint |
| `harthmereBuilderAuditEnabled` / WakeUpScreen audit effect | ✅ already correctly gated off in prod *for perf reasons* |
| `player_mesh.ts` `addLocalDev*` / `addHarthmerePlayer*Polish` (7 sites) | ⚠️ **left alone — needs a product decision, see below** |
| `mobileDevice` renderer gates | ✅ intentional asset-streaming difference |

**Fixed — things that were never local-dev features:**

1. **Combat VFX** (projectiles, impacts, magic charges). Covered in the main remediation log.
   Parented to `root`, ticked from `draw()`, both behind the gate; listeners registered
   unconditionally. Casts spawned into a group that was never advanced or drawn.

2. **The local player's third-person weapon rig.** `installHarthmerePlayerSwordVisuals()` starts its
   **own `requestAnimationFrame` loop in the constructor**, which is *not* gated on `ready`. In
   production it faithfully computed the weapon anchor transform, the draw/sheathe blend and the
   swing animation on every single frame — into `harthmerePlayerSwordAnchorRoot`, which is parented
   to `root` and never reached a scene. So the player held nothing visible while the client paid for
   the animation anyway. This is simultaneously a missing feature and a wasted per-frame cost.
   `draw()` now attaches `root` when `hasHarthmereSceneAttachableContent()` is true, which covers
   both the VFX layer and the weapon rig.

3. **Terrain shard pre-warm.** `TerrainRenderer.updateHarthmereTerrainPrewarm` early-returned on
   `!shouldRenderHarthmereRuntimeAssets()`. Nothing in it touches Harthmere runtime assets — it
   reads `/ecs/terrain` and warms `/terrain/occluder` + `/terrain/combined_mesh`, all native terrain
   resources present in every build. It borrowed the flag only because its tuning constants happen
   to live in `town_production_polish.ts`. The result: the ring whose entire job is to hide the
   whitespace-pop and hitch after spawn and after a long fast-travel move ran for developers and
   never for players — and was therefore invisible in every local test of the thing it exists to
   fix. `docs/harthmere/PERFORMANCE_AND_PLACEMENT.md` already documented it as a shipped guardrail;
   the code disagreed. It is safe everywhere: ≤144 probes per plan, replanned at most once per
   second and only after 64 m of movement, ≤2 fetches in flight, and it skips already-cached shards.

**Deliberately not changed — flagged for a product decision:**

`src/client/game/resources/player_mesh.ts` has seven `if (process.env.NODE_ENV === "production")
return;` early exits covering `addHarthmerePlayerUniqueEnhancementDetails`,
`addHarthmerePlayerBoneAttachedEquipmentPolish`, `addHarthmerePlayerAvatarFullPolishDetails`,
`installHarthmerePlayerSwordSheathVisibilityBridge`, the voxel body shell, and the bolt-head face
shells. Line 537 also loads `loadHarthmerePlayerAppearanceConfig(id)` only outside production.

These are named `local-dev-*` throughout, so they may well be an intentional alternative to the
native Biomes wearables pipeline. But `WakeUpScreen` writes real player face/body/clothing choices
to `harthmerePlayerFaceStorageKey` / `...BodyStorageKey` / `...ClothingStorageKey`, and this is the
code that reads them. **Worth confirming that a character created in the builder actually looks
different in production**; if it does not, this is the same bug class at avatar scale. Turning seven
visual passes on in production is not a safe unilateral change, so it is recorded rather than done.

---

## A.0 — The overlay script is the frame loop's largest per-frame cost (finding 18)

*Added 2026-08-03 evening, from the captured production session. This finding was outside the
original audit's scope: it lives in `scripts/`, not `renderers/`.*

`src/client/game/scripts/overlays.ts` — `OverlayScript.tick()` runs **every frame** and rebuilds the
entire overlay map from scratch. Two costs scale with world density:

**1. Unbounded voxel raycasts.** `isOccluded(pos, camera)` runs a full `terrainMarch` through the
WASM voxel grid, from the camera to the overlay point, up to **50 m**. It is called once per overlay
from six sites (`:864` navigation aids, `:942` player names, `:1201` NPC names, `:1268` minigame
elements, `:1401` world objects, `:2111` quest targets). The captured session's own cval dump reports
the table contents:

```
position_selector: 2932   label_selector: 834    placeable_selector: 548
npc_metadata_selector: 159   named_quest_giver_selector: 107   minigame_elements_selector: 82
collideable_selector: 1217
```

Every one of those within its overlay radius paid for its own 50 m WASM march, **every frame**. This
is hundreds of raycasts per frame, and it is why an M1 Max whose own benchmark reports 556 FPS was
delivering 2–14.

**2. Unconditional React invalidation.** The tail of `tick()` called
`resources.update("/overlays/projection", ...)` with no change check. That is a React resource, so
every frame invalidated every subscribed component — the projected overlay components and,
transitively, the HUD — forcing a full React reconciliation at frame rate even when the player and
the world were completely still. (The sibling `/overlays` map was already change-gated by `isEqual`;
the projection map was not.)

**Fix applied:**

- Occlusion results are memoised in an `occlusionCache` keyed on the metre-quantised **(target,
  camera)** pair with a 100 ms TTL. Sub-metre motion of either endpoint cannot change a nameplate's
  occlusion boolean perceptibly, and the camera is part of the key so a moving camera still
  refreshes.
- A hard per-frame ceiling of `MAX_OCCLUSION_MARCHES_PER_FRAME = 24`. Over budget, the previous
  answer is reused and refreshes on a later frame — so the worst case is constant regardless of how
  dense the district gets, instead of linear in entity count.
- `occlusionMarchesThisFrame` resets at the top of every `tick()`; a 5 s sweep expires entries for
  points no longer drawn so the cache cannot grow with the world.
- The projection map is published only when `projectionsEqual` reports a real change. That
  comparison is a hand-written allocation-free walk with a 0.5 px / 0.01 proximity epsilon rather
  than `lodash.isEqual`, which was itself a measurable per-frame cost at these entity counts.

Contract tests: `src/client/game/scripts/overlaysFrameBudget.test.ts`.

**Still worth doing (not done):** split the overlay *content* rebuild (which only needs to run at ~10
Hz) from the *projection* update (which wants to run per frame so nameplates don't jitter). Today
both run per frame; only their publication is gated. That split is a larger refactor of
`applyAllOverlays` and was deliberately left out of a same-day fix.

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

**Done (findings 1, 2, 3-partial, 6, 11a, 12, 13, 14, 16, 17, 18).** The remaining ranked work:

**Do next — days:**

1. Hoist the remaining per-frame allocations out of `TerrainRenderer.draw` — the WASM
   `VisibilitySharder` is still constructed every frame (finding 9).
2. Integer-key the remaining string-keyed grounded-column cache (finding 10). Note this lives in
   `harthmere_assets.ts`, which does **not** render in production, so it is a localhost-only win.
3. Memoize scene classification / material dependencies (close the `scenes.ts:70` TODO, finding 8).
4. Pool point lights so the count never changes at runtime (finding 11b) — this is the combat
   hitching path.
5. Split overlay content rebuild (10 Hz) from projection update (per frame). See § A.0.
6. Ship atlases as binary + worker decode (finding 5).
7. Run the assets through `gltfpack` with KTX2 output (finding 15).

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

### 2026-08-03 (evening) — captured-session frame-loop pass

Input: a HAR + console capture of a real production session
(`www.glitch.fun-1785805197173.har` / `.log`, 374 s of play, Apple M1 Max, Chrome 151).

What the capture established, as fact rather than inference:

| Signal | Value |
|---|---|
| `GPU Tier Info` | `{"fps":556,"gpu":"apple m1 max","tier":3,"type":"BENCHMARK"}` |
| `Aegis Engine Report [warning]: Low FPS Detected` | 48 reports, range **0–14**, median 10 |
| `[Violation] 'requestAnimationFrame' handler took <N>ms` | continuous, hundreds of lines |
| Client table size (from `/api/cval_logging`) | 2932 positioned entities, 1217 collideable, 834 labelled, 548 placeables, 159 NPCs |
| `game.events` for the whole session | `moveEvent: 6369`, `emoteEvent: 21`, `updatePlayerHealthEvent: 2`, **`updateNpcHealthEvent` absent** |

Tier 3 was correctly detected, so finding 17 was genuinely fixed and the frame rate problem is CPU
work on the main thread, not GPU classification.

**Changes:**

1. **Finding 18 — overlay occlusion budget + projection change-gate.**
   `src/client/game/scripts/overlays.ts`. Described in full in § A.0. This is the headline change.

2. **Finding 13 — dynamic render scale no longer requires a GPU timer.**
   `src/client/game/resources/graphics_settings.ts`,
   `src/client/game/resources/dynamic_settings_updater.ts`.

   `computeRenderScale` used to demand `EXT_disjoint_timer_query_webgl2` and otherwise pin a **fixed**
   render scale for the entire session — `[3840, 2160]` on `high`, i.e. a 4K internal resolution that
   could never back off. That extension is routinely unavailable in exactly the environments this
   game ships into: embedded iframes (which is how `glitch.fun` hosts it), hardened Chrome policies,
   VMs and several Linux/ANGLE configurations.

   `{ kind: "dynamic" }` is now always selected. `bottleneck()` previously returned `"cpu"`
   unconditionally when `gpuTimeMs === undefined`, which made the render-scale *reduction* branch
   unreachable — a struggling client had no lever at all. It now infers from the two signals that are
   always present: if the frame is over budget **and** our own CPU work accounts for less than half
   of it (`UNMEASURED_GPU_BOUND_CPU_SHARE = 0.5`), the missing time went to the GPU, compositing or
   presentation, none of which get cheaper by drawing fewer entities — so it is treated as GPU-bound
   and render scale is allowed to drop. A vsync-limited 60 FPS frame with 2 ms of CPU work is
   explicitly *not* treated as pressure, so a healthy client never degrades itself.

   Tests: `src/client/game/resources/dynamic_settings_updater.test.ts`.

3. **Finding 12 — sampled timer gauge writes.**
   `src/shared/metrics/performance_timing.ts`. `timeCode` wraps every renderer, every script, `draw`,
   `render + postprocessing`, the React invalidate and `resources:collect`, and nests inside terrain
   resource generation — 40–200 stops per frame, each doing a string-keyed `Map.get`, an
   `Averager.push` and a metrics gauge write. The exponential average is still fed by every sample
   (accuracy unchanged); only the gauge *publish* is sampled 1-in-16. Nothing reads these gauges per
   frame — they back a debug HUD and cval logging.

**Also fixed in the same pass (gameplay, not rendering, but found in the same capture):**

- **Attacks never registered.** The cval `events` map proves it: 21 `emoteEvent`s (swings played) and
  zero `updateNpcHealthEvent`s across the whole session. Under `nativeBiomesEcsAuthorityEnabled()`
  the crosshair ray against the authoritative ECS AABB is the *only* melee acquisition path, and the
  drawn body is latency-smoothed away from that AABB — so on a slow frame, or against a moving
  creature, every swing passed through the visible target. Added a deliberately narrow aim-assist
  fallback in `scripts/cursor.ts` (ray-miss only, inside melee reach, 14° cone, single best target,
  never through terrain, same `canAttackFilter`). Two adjacent gates were also failing closed:
  `selectedCanAttack` treated a native item with an unresolvable combat profile as unarmed, and
  `resolveAttackInteraction` dropped health-backed live creatures that lack `npc_metadata` even
  though `canAttackFilter` accepts them. Tests:
  `src/client/game/scripts/cursorNativeMeleeAimAssist.test.ts`.

- **Projectile and magic-charge VFX never drew in production.** `HarthmereProjectileVisualRuntime` is
  parented to `HarthmereRuntimeAssets.root` and ticked from its `draw()`, but both `preloadAll()` and
  the `ready` flag sat behind `shouldRenderHarthmereRuntimeAssets()` — true only on localhost or with
  the `biomes.harthmereAssets` localStorage key. The event listeners were registered
  *unconditionally*, so a cast really did spawn its charge object, into a group that was never
  advanced and never added to a scene. The VFX layer is now preloaded and ticked regardless of the
  town-asset gate, and the root is attached whenever `hasActiveVisuals()` is true. Tests:
  `src/client/game/renderers/local_dev/harthmere_combat_vfx_always_on.test.ts`.

**Verification:**

- `chase_attack_logic` (39), `npc_locomotion_selection`, `src/shared/npc/**` (243), client
  `resources`/`metrics` (43+4), and the three new contract suites (15) all pass.
- Full `src/client/game/**` run: 402 passing, 4 failing — all four pre-existing and unrelated
  (three easing-math assertions in `util/test/animation_system.test.ts`, one browser-flow test that
  needs a platform-native `esbuild` binary).

**Not yet measured.** Every claim above is a code-path argument plus the captured evidence; none of
it has been re-measured against a fresh capture. The next capture should show
`performanceTiming:scripts:overlay` falling sharply and `renderer.<name>.threejs.info` unchanged — if
`scripts:overlay` is still dominant, the content/projection split in § A.0 is the next move.

### 2026-08-03 (evening, follow-up) — environment-gate sweep

Prompted by the question "is anything else true on localhost and false in production?" after the
combat-VFX fix. The full sweep, verdicts and reasoning are in
[§ A.1](#a1--true-on-localhost-false-in-production-finding-19). Summary of code changes:

- `src/client/game/renderers/local_dev/harthmere_assets.ts` — `draw()`'s not-ready path now attaches
  `root` via `hasHarthmereSceneAttachableContent()`, which covers the VFX layer **and** the local
  player's weapon rig. The rig's own constructor-installed `requestAnimationFrame` loop was already
  running in production; only its output was unreachable.
- `src/client/game/renderers/terrain.ts` — `updateHarthmereTerrainPrewarm` no longer early-returns
  on `!shouldRenderHarthmereRuntimeAssets()`. The `harthmere_runtime_mode` import is gone from this
  file entirely, which is the honest signal that terrain streaming does not depend on the local-dev
  town.

**How to spot the next one.** The pattern has a shape worth naming: *a listener, timer or rAF loop
registered unconditionally, whose output is only consumed behind a gate.* Registration and
consumption were split across the constructor and `draw()` in every instance here, which is why each
one looked correct when read in isolation. When adding anything to
`HarthmereRuntimeAssetsRenderer`, the question to ask is not "is this gated?" but "is this the local
dev town?" — and if the answer is no, it does not belong under `root` without an attach path that
survives `ready === false`.

**Verification:** `t.sh combat` 92 passing, `t.sh perf` 39 passing, `src/client/game/**` 422 passing
with the same 4 pre-existing unrelated failures. `terrain.ts` and `harthmere_assets.ts` both
typecheck clean.
