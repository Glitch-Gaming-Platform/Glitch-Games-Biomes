# Mobile optimization audit — 2026-08-04

**Scope:** what is left to do for phone/tablet playability, after reading
`docs/harthmere/MOBILE_GAMEPLAY_ISSUES.md`,
`HARTHMERE_RENDER_PERF_AUDIT_2026-08-03.md`,
`docs/harthmere/PERFORMANCE_AND_PLACEMENT.md`,
`docs/harthmere/BUILD_PERFORMANCE_FINDINGS_2026-07-24.md`, and
`docs/harthmere/HARTHMERE_LIVING_QUARTERS_PERFORMANCE.md`, then reading the
current source.

> **Status: implemented same day.** Items 1–5, 6 (partially), 9, 10 and 11 were
> fixed in the batch recorded in
> [§ Remediation log](#remediation-log-2026-08-04). Items 7, 8, and the binary
> half of 6 remain **OPEN** — they are asset-pipeline or measurement work, not
> client changes. Every fix is gated on `clientConfig.mobileDevice` or on a
> clamp set that is `undefined` on desktop.

Every item below is a claim with a file:line so it can be checked. The
file:line references describe the code **as audited**, before the remediation.

---

## What is already in place (verified in source, not just in the docs)

The 2026-08-02/03 mobile passes are real and present:

| Guardrail | Where | Status |
|---|---|---|
| UA-based `mobileDevice`, forced low-memory | `client_config.ts:281-311` | ✅ |
| 128 MB Voxeloo reservation (0.125 scale) | `client_config.ts:127-134` | ✅ |
| Resource capacity scaled to ⅛ | `client_config.ts:113-121` | ✅ |
| One shared Voxeloo module across mobile remounts | `webasm.ts:97-115` | ✅ |
| Phone quality pinned to `low` (or `safeMode`) | `graphics_settings.ts:258-277` | ✅ |
| Phone low → `veryLow` 64 m instead of 96 m | `graphics_settings.ts:247-256` | ✅ |
| `dynamicMinDrawDistance` 192 m floor lifted on phones | `client_config.ts:302-311` | ✅ |
| Audio: no 110-file prefetch, single music track | `audio_manager.ts:143-152, 302-310` | ✅ |
| Bounded nearby-prototype streaming (82 m / 180 / 24 / +4) | `harthmere_assets.ts:411-415, 35012-35095` | ✅ |
| Joystick + Crouch + Jump + F, release on blur/hide/cancel | `JoystickInput.tsx:190-212, 355-525` | ✅ |
| iOS back-swipe guard (non-passive capture + history sentinel) | `JoystickInput.tsx:214-294` | ✅ |
| Look-drag owns one touch identifier, excludes UI targets | `BiomesView.tsx:66-171` | ✅ |
| `touch-action: none` / `overscroll-behavior: none` on the game root | `biomes.css:15-16` | ✅ |
| Atlas mip chains disabled (audit finding 14) | `util/textures.ts:57-70` | ✅ |
| No workbox precache manifest in the built SW | `public/sw.js` — 0 precache entries | ✅ |
| Initial pixel ratio set before the first render (no DPR³ spike) | `renderer_controller.ts:218-223` | ✅ |

So the memory work is done well. The gaps below are mostly **gameplay
reachability** and **adaptivity**, not more memory trimming.

---

## Tier 1 — blocking or self-inflicted

### 1. There is no touch control for mine, place, or attack

This is the largest gap. The mobile HUD ships exactly five action affordances:

```
data-biomes-mobile-crouch    data-biomes-mobile-jump
data-biomes-mobile-interact  data-biomes-mobile-action (menu/recipes/invite)
data-biomes-mobile-menu
```
(exhaustive grep of `src/client/**/*.tsx`)

Meanwhile the game's primary verbs are bound to mouse buttons only:

- `input.ts:586-589` — `primary` / `primary_hold` / `secondary` /
  `secondary_hold` are bound through `bindMouseClick` and driven by
  `mousedown` / `mouseup` listeners at `input.ts:495-510`. There is no touch
  path into them.
- The only mobile route into `primary_hold` is tapping a hotbar slot:
  `nativeHotbarActions.ts:26-31` pulses it for `holdDurationMs`, which is
  **350 ms** for every action except eat/drink/warp (`hotbarAction.ts:17-41`).
- `secondary` (place / alternate use) has **no** mobile invocation at all.
- Heavy and spark attacks are keyboard-only:
  `LocalDevHarthmereMultiplayerCombatSystem.tsx:1673-1683` fires
  `pulseMotion("primary_hold", 350, …)` from a `KeyboardEvent` handler keyed on
  `HARTHMERE_COMBAT_KEY_BINDINGS`.

Consequences on a phone: you cannot hold to mine a block that takes longer than
350 ms, you cannot place a block by aiming at a face, and you cannot use the
heavy or spark combat actions.

**Recommendation.** Add a right-thumb action cluster mirroring the existing
Crouch/Jump pattern — a hold-capable Primary (mine/attack), a Secondary
(place/use), and the two combat variants when a weapon is equipped. Drive them
through `input.setSyntheticMotion` / `input.pulseMotion` exactly as the joystick
and hotbar already do, so `InteractScript` and native ECS authority stay the
only implementation. Hold semantics should be press→`setSyntheticMotion(1)`,
release→`0`, not a fixed pulse.

### 2. `viewport-fit=cover` is missing, so every safe-area inset resolves to 0

`src/pages/index.tsx:47` (`BiomesHeadTag`, which the game page renders via
`src/pages/at/[[...slug]].tsx:110`):

```tsx
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

`grep -rn "viewport-fit" src/ public/` returns nothing.

Without `viewport-fit=cover`, iOS Safari reports `env(safe-area-inset-*)` as
`0px`. The mobile HUD work explicitly depends on those values:

- `hud.css:3051` — `bottom: max(88px, calc(env(safe-area-inset-bottom) + 76px))`
- `hud.css:3075-3077` — `padding-left: max(24px, env(safe-area-inset-left))`
- `hud.css:3133` — `right: max(18px, env(safe-area-inset-right))`

Every one collapses to its literal fallback. In landscape on a notched iPhone
the left padding is 24 px where the notch needs ~44 px, so the joystick cluster
sits partly under the sensor housing / home indicator. Nothing looks broken in
the simulator at 390×844 portrait, which is why it survived the smoke.

**Recommendation.** `content="width=device-width, initial-scale=1.0,
viewport-fit=cover"`, then re-check the landscape screenshots. One line.

### 3. Phones have no dynamic quality adaptation whatsoever

`client_config.ts:300` sets `ret.forceRenderScale = 0.5` for every mobile
device. `computeRenderScale` (`graphics_settings.ts:299-301`) returns
`{kind: "scale", scale}` immediately when `forceRenderScale` is defined — before
the `dynamic` branch. And `graphicsQualityForDevice` pins quality to `low`,
which hard-codes `drawDistance: "veryLow"` (64 m) and `entityDrawLimit: "low"`
(15) rather than `"dynamic"` / `"auto"`.

Net effect: on phones the entire `DynamicSettingsUpdater` ladder is bypassed.
This is precisely the failure mode that finding 13 of the 2026-08-03 audit
identified and fixed for desktop ("a struggling client had no lever at all") —
reintroduced for the device class that needs it most:

- A phone that is still over budget at 0.5 cannot fall to the 0.3 target that
  `PERFORMANCE_TARGETS[0]` (`dynamic_settings_updater.ts:21-27`) exists to reach.
- An iPhone 15 Pro and a 2019 mid-range Android get byte-identical settings.
- Nothing can recover quality once thermal throttling passes.

**Recommendation.** Replace the two hard pins with a mobile-clamped dynamic
ladder: keep `{kind: "dynamic"}` and 64 m as the *starting* values (they already
are, via `defaultDynamicDrawDistance` at `graphics_settings.ts:375-380`), and
add mobile min/max clamps to the updater (e.g. renderScale ∈ [0.3, 0.8],
drawDistance ∈ [48, 96]) instead of `forceRenderScale`. Leave the URL override
authoritative for diagnostics.

### 4. The frame loop is uncapped

`context_managers/loop.ts:92-96` runs `tick()` — which includes
`rendererController.renderFrame()` at `:232` — on every `requestAnimationFrame`,
with no target-FPS gate. Simulation is already decoupled and fixed-rate
(`advanceSimulation`, `:113-135`), so render rate is free to differ.

On a phone, a 30 FPS render cap is the single largest lever available: it halves
CPU frame work (which every prior investigation names as *the* bottleneck),
halves GPU submission, and materially reduces the sustained thermal load that
drove the 124–191% CPU readings in the physical-device sessions. Perceptually,
30 FPS locked reads better than 22–45 FPS unlocked.

**Recommendation.** Gate `renderFrame()` behind an accumulator with a mobile
target of 30 (desktop stays uncapped). Small, reversible, measurable.

### 5. WebGL context loss is fatal, with no restore path

`pass_renderer.ts:306-314` and `renderer_controller.ts:116-118`:

```ts
private onContextLost = (event: Event) => {
  event.preventDefault();
  log.fatal(`Unexpectedly lost main WebGL context. …`);
};
```

`grep -rn "webglcontextrestored" src/` returns nothing. `preventDefault()` is
the signal to the browser that the app *will* restore the context — but nothing
listens for `webglcontextrestored`, so the game is dead until a page reload.

iOS discards GL contexts under exactly the memory pressure this game operates
near, and Safari also drops them when the tab is backgrounded for a while.
Every "the game crashed" report on a phone plausibly includes some of these.

**Recommendation.** Add a `webglcontextrestored` handler that rebuilds the
`PassRenderer` and re-uploads atlases (the pass/composer objects already have
`generateBuffers` / `destroyBuffers` lifecycles), and show a brief reconnect
overlay instead of `log.fatal`.

---

## Tier 2 — startup memory and transfer (the jetsam class)

### 6. 2.65 MB of base64-in-JSON atlases are decoded synchronously on the main thread

Still open from the render audit (finding 5), and worse on mobile than desktop.
`resources/blocks.ts:91-101`:

```ts
const config = await jsonFetch<BlockAtlasData>(resolveAssetUrl("atlases/blocks"));
… new Uint8Array(Buffer.from(config.colors.data, "base64").buffer) …
```

Shipped: `blocks.…json` **1.43 MB**, `florae.…json` **1.22 MB**, plus glass —
verified under `public/buckets/biomes-static/asset_data/atlases/`. The path is
`JSON.parse` of the whole file → browserify `Buffer` polyfill base64 decode →
per-pixel RGB→RGBA JS expansion (`util/textures.ts:44-56`), all synchronous, all
during boot. Peak footprint is roughly 4× the final texture (base64 string +
parsed JSON + decoded bytes + expanded RGBA), in exactly the window where iOS
jetsam has been firing.

**Recommendation.** Ship raw `.bin` + a small JSON sidecar, `fetch` →
`arrayBuffer()`, do the RGB→RGBA expansion in a worker or pre-expand it in
Galois. This is the highest-value *mobile* item among the open render-audit
findings.

### 7. Zero KTX2 assets shipped; 22 MB of uncompressed `.gltf` JSON remains

`find public -name "*.ktx2"` → **0 files**. Largest offenders:

```
15,470,252  npcs/big_mucker.….gltf
 4,594,395  npcs/dragon_mucker.….gltf
 2,383,852  npcs/stone_mucker.….gltf
```

708 `.glb` files exist, so the pipeline is partly converted, but the transcoder
infrastructure (`KTX2Loader` + `MeshoptDecoder`, `gltf_helpers.ts`) and the
`assets:install-gltfpack` script are wired and idle. On cellular this is minutes
of download; in phone VRAM it is the dominant texture cost.

**Recommendation.** Run the existing gltfpack 1.2 `-kn -c` path over the NPC
assets first — that is where the size is concentrated — and measure download,
decode, and `renderer.game.threejs.info.memory.textures` separately from FPS.

### 8. `useWorker: false` — voxel meshing runs on the main thread on the most constrained devices

`client_config.ts:65`; `worker/host.ts:14` early-returns. The performance guide
already names the measured worker prototype as the credible next Voxeloo
experiment. Mobile is where it pays: the phone frame budget is 33 ms, terrain
re-meshing is the single most expensive client operation, and phones have idle
cores while the main thread is saturated. Note the current worker uses the
**non-SIMD** build with a 16 MB heap, so it needs the SIMD artifact and buffer
*transfer* (not clone) before it is worth enabling.

---

## Tier 3 — smaller, still mobile-specific

9. **Device tiering is UA-only.** `grep -rn "deviceMemory\|hardwareConcurrency"
   src/` → nothing. `navigator.deviceMemory` (Android/Chrome) and
   `hardwareConcurrency` (everywhere) would separate a 2 GB Android from an
   8 GB iPhone, which today share one profile. Cheap input to item 3.

10. **0.5 render scale is 0.5× *CSS* pixels**, i.e. ~1/6 of native on a DPR-3
    phone (`pass_renderer.ts:369-371` feeds `renderScale` straight into
    `setPixelRatio`). That is very soft. Once 6 and 7 land, 0.7–0.8 is likely
    affordable at the same memory ceiling — worth a measured A/B, because image
    quality is the most visible remaining mobile complaint after controls.

11. **PWA manifest declares no `orientation`** (`public/pwa/manifest.json`) even
    though portrait is a supported requirement and the Glitch host page shows a
    "Rotate for better gameplay" overlay. Declaring `"orientation": "any"` is at
    least a signal; the host overlay itself is a Glitch-side fix.

12. **Open render-audit items that hit mobile hardest**, in order: the per-frame
    WASM `VisibilitySharder` allocation (finding 9,
    `renderers/terrain.ts:154-200`); point-light pooling (finding 11b — combat
    hitching, worst on mobile GL drivers); the overlay content/projection split
    (§ A.0 "still worth doing"); scene classification memoization
    (`scenes.ts:70` TODO, finding 8).

---

## Suggested order

1. Touch action buttons for mine/place/attack (item 1) — without this the game
   is not really playable on a phone regardless of frame rate.
2. `viewport-fit=cover` (item 2) — one line, unblocks work already shipped.
3. Mobile frame cap (item 4) and mobile-clamped dynamic ladder (item 3) — both
   small, both directly attack the CPU-bound conclusion every prior
   investigation reached.
4. Context-loss recovery (item 5).
5. Binary atlases + worker decode (item 6), then KTX2 on the NPC assets (item 7).
6. Re-measure on the physical iPhone before touching the worker (item 8).

## Remediation log — 2026-08-04

Source-only. No build, deployment, traffic change, restart, or image push was
initiated, and no physical-device acceptance pass has been run.

**The mobile-only constraint.** Every change is gated one of three ways:
`clientConfig.mobileDevice` directly; a clamp/cap value that is `undefined` on
desktop and whose consumers treat `undefined` as "no change"; or a CSS selector
scoped under `.joysticks--mobile`, which is applied only when `mobileDevice` is
true. A touch-capable *desktop* browser still mounts `JoystickInput` and is
deliberately excluded from all of it.

**One deliberate exception:** the base64 decode correctness fix under item 6
applies to every platform. It is a bug fix, not an optimization, and gating a
bug fix to phones would have left the same latent hazard on desktop. It is a
no-op for the shipped browser client — see the item 6 note below for why.

| # | Fix | Files |
|---|---|---|
| 1 | Touch action cluster (mine/place + draw/target/heavy/spark) | `game/util/mobile_action_controls.ts` (new), `components/JoystickInput.tsx`, `components/BiomesView.tsx`, `styles/hud.css` |
| 2 | `viewport-fit=cover` | `pages/index.tsx` |
| 3 | Device profile + clamped dynamic ladder | `game/util/mobile_device_profile.ts` (new), `game/client_config.ts`, `game/resources/graphics_settings.ts`, `game/resources/dynamic_settings_updater.ts`, `game/renderers/renderer_controller.ts` |
| 4 | 30 FPS render cap | `game/util/mobile_frame_pacing.ts` (new), `game/context_managers/loop.ts` |
| 5 | WebGL context-loss recovery | `game/renderers/renderer_controller.ts`, `renderer/pass_renderer.ts` |
| 6 | Correct shared base64 decode (all platforms) + mobile-only per-field release | `game/util/mobile_atlas_decode.ts` (new), `game/resources/{blocks,glass,florae,materials,item_mesh}.ts` |
| 11 | PWA `orientation: any` | `public/pwa/manifest.json` |

### Notes worth keeping

**Item 1 is a reachability fix, not a new gameplay system.** The buttons drive
*input* — the same synthetic motions the mouse drives — so `InteractScript`
remains the sole authority for what the selected item does, and the combat
buttons call the existing `toggleHarthmereWeaponDrawn` /
`cycleHarthmereCombatTarget` / `performHarthmereKeyedAttack` entry points. A
phone press and a keyboard press produce the same animation, the same
`UpdateNpcHealthEvent`, the same server validation, and the same Anima
retaliation. Hold is a real hold (`setSyntheticMotion(1)` → `0`), not a pulse;
that is the whole point, because the 350 ms hotbar pulse could not mine a slow
block. Blocked reasons are read verbatim from
`getHarthmereMultiplayerAttackDisabledReason` so the phone HUD cannot invent
rules. The cluster is a separate component precisely so its combat and hotbar
subscriptions cannot mount on a desktop client — React hooks cannot be
conditional, so a branch inside `JoystickInput` would have run them everywhere.

**Item 3 keeps the validated starting point.** The `standard` class starts at
exactly 0.5 render scale / 64 m, which is the retired hard pin and the profile
validated on the physical iPhone 12 mini. `constrained` starts lower;
`capable` may climb. No class may exceed 96 m — the radius the jetsam sessions
were running — because draw distance drives retained terrain meshes and hence
WebContent footprint, not just frame time. Clamping is applied both at
generation and at proposal time, so a proposal that clamps back onto the
current value is dropped rather than burning a pacing interval.

**Item 5 had to stop the frame loop, not just log differently.** Rendering into
a lost context throws out of `renderFrame`, which `Loop.tick` escalates to
`log.fatal` and a cancelled animation frame — which would have turned the
recoverable event into the unrecoverable one. Desktop keeps the fatal report,
because a desktop context loss usually is a driver or tab crash worth
surfacing loudly.

**Item 6 is partial, and a test found a real latent bug that is now fixed.**
Five call sites had independently written this expression:

```ts
new Uint8Array(Buffer.from(data, "base64").buffer)
```

`.buffer` returns the *backing* ArrayBuffer and discards `byteOffset` and
`byteLength`. Under Node, `Buffer` allocates anything below 4 KiB out of a
shared 8 KiB pool, so this returns a view over the whole pool starting at byte
0 — neighbouring, unrelated bytes rather than the payload. The unit test caught
it decoding fragments of a previously allocated JSON string instead of an
atlas.

It was correct in the shipped browser client only by coincidence: `Buffer` is
the browserify polyfill there, and its `fromString` allocates an exact-size
array with no pooling. That is a bad thing to keep relying on — it breaks
silently on a polyfill change, on any bundler that maps `Buffer` elsewhere, and
it already breaks in Node/SSR/tests.

Fixed at all five sites via one shared `decodeBase64Bytes`, which prefers
native `atob` (exact allocation, and already the precedent in
`makeBufferTextureFromBase64`) and honours `byteOffset`/`byteLength` in the
`Buffer` fallback. Both branches now produce identical correct bytes, so this
is a **no-op for the shipped browser client** and a correctness fix everywhere
else. Two of the five were outside the atlases:

- `resources/materials.ts` — the breaking/shaping animation atlas.
- `resources/item_mesh.ts` — the **GLB** path, which handed the parser the
  whole backing buffer with the offset discarded. A GLB parser reads a magic
  header at byte 0, so outside the browser it was parsing from the wrong byte
  entirely.

This one correctness fix is therefore **not** mobile-gated, unlike the rest of
the batch. The mobile-only part of item 6 is now purely the payload release:
each ~1 MB base64 string is dropped as it is consumed so peak boot footprint is
one payload rather than all three. The real remedy — not shipping
base64-in-JSON at all — is an asset-pipeline change and stays open.

### Verification

- 52 focused tests pass: the four new suites (`mobile_device_profile`,
  `mobile_frame_pacing`, `mobile_action_controls`, `mobile_atlas_decode`) plus
  the existing `graphics_settings`, `dynamic_settings_updater` and
  `client_config` suites.
- `tsconfig.mobileaudit.json` (new, scoped to the four standalone modules and
  their tests) typechecks clean in seconds.
- **The wide typecheck has NOT been run.** `tsconfig.ch1renderer.json` pulls the
  whole client graph and did not complete in the environment this batch was
  written in. Before shipping, run:

  ```bash
  NODE_OPTIONS=--max-old-space-size=8192 \
    yarn -s tsc -p tsconfig.ch1renderer.json --noEmit
  ```

  The wiring it would cover is `JoystickInput.tsx`, `renderer_controller.ts`,
  `pass_renderer.ts`, `loop.ts`, `graphics_settings.ts`,
  `dynamic_settings_updater.ts`, `client_config.ts`, and the three atlas
  resource files.
- **Not measured on hardware.** Everything here is a code-path argument plus
  unit coverage. The next physical iPhone pass should confirm: no new
  `JETSAM_REASON_MEMORY_HIGHWATER` over ten minutes in both orientations;
  `renderer:graphics:settings` actually moving within the clamps instead of
  sitting still; a sustained ~30 FPS render interval; landscape controls
  clearing the notch; and that mine, place, and each combat control resolve the
  same server events as their desktop equivalents.

## How to verify each claim

```bash
grep -rn "viewport-fit" src/ public/                       # expect: nothing (item 2)
grep -rno 'data-biomes-mobile-[a-z]*="' src/client --include=*.tsx | sort -u
sed -n '580,592p' src/client/game/context_managers/input.ts  # mouse-only primary
sed -n '294,302p' src/client/game/resources/graphics_settings.ts  # forceRenderScale short-circuit
sed -n '88,98p'  src/client/game/context_managers/loop.ts    # uncapped rAF
sed -n '304,316p' src/client/renderer/pass_renderer.ts       # fatal context loss
find public -name "*.ktx2" | wc -l                          # expect: 0
ls -la public/buckets/biomes-static/asset_data/atlases/
```
