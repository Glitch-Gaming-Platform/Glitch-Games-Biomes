# Harthmere boss marketing screenshots

This runbook records the deterministic cutscene-based workflow for the eleven
Harthmere boss hero images. The scene source of truth is
`src/shared/cutscene/promo_scenes.ts`, in `HARTHMERE_BOSS_PROMO_SPECS`.

## Fast path

1. Use Node `24.18.1` from `.nvmrc`.
2. Run the narrow cutscene and promo-scene tests before rebuilding.
3. Generate no-browser angle candidates and reject body-envelope/FOV/dolly
   mistakes before Chromium:

   ```sh
   node scripts/cutscenes/preflight-boss-promo-angles.cjs \
     --recommended \
     --output artifacts/cutscenes/boss-camera-first-attempts.json \
     --strict
   ```

   This checks the first logged candidate for all eleven bosses. Elsewhen
   candidates also test the full dolly and three sightlines against canonical
   dungeon voxels. Geometry passing is not scenery acceptance. The live capture
   must still verify actor support, runtime decor, encounter context,
   silhouette, and visible contact with the floor or terrain. Generate all five
   presets without `--recommended` only when the first candidate is rejected.

   The live cutscene generator repeats the path check against streamed terrain:
   17 eased dolly samples with a camera clearance envelope plus three
   camera-to-boss sightlines. It waits for missing terrain tensors and rejects a
   solid intersection before saving. This is the fail-fast guard for
   ordinary-map and Underways scenes where there is no canonical offline voxel
   function.
4. Before Chromium, prove host/container build identity and run the Chapter 1
   seed readback against the retained stack's Redis. Do not treat HTTP, Sync,
   lifecycle, or renderer readiness as proof that distant scenery exists.
5. Capture one representative scene from each coordinate family first:
   ordinary map, Elsewhen dungeon, runtime Underways, and open Wilds. Build a
   four-frame contact sheet and reject the setup before spending a full batch.
6. Keep one authenticated observer page warm and capture the whole group with
   its per-boss logged first choices:

   ```sh
   node scripts/harthmere/e2e-jump.cjs promo-batch-url boss-marketing \
     --bossCameraPlan=recommended \
     --captureRun=final-boss-marketing-1
   ```

   `bossCameraPlan=recommended` applies each scene's own priority, not one
   global preset. The page output records scene id, preset, and sampled camera.
7. The capture service writes both the branded final and a `-raw.png` frame to
   `artifacts/cutscenes/` after every scene, so a late failure does not discard
   completed shots.
8. Visually inspect the saved 1920×1080 PNGs. Adjust the data table in
   `HARTHMERE_BOSS_PROMO_SPECS`, not browser camera state, then rerun only the
   affected scene with `cutscenePromo=<scene-id>&capturePersist=1`.

For angle review, use the generator's named presets and a unique evidence
directory; do not edit the browser camera by hand:

```sh
HARTHMERE_E2E_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
node scripts/cutscenes/capture-promo-still.cjs boss-gilded-bull \
  --camera-preset three-quarter-left \
  --output-dir artifacts/cutscenes/bull-left-1 \
  --run bull-left-1 \
  --print-url
```

The output directory contains branded/raw frames, network HAR, and exact
camera metadata. The available presets are baseline, three-quarter-left,
three-quarter-right, environment-wide, and reverse-inward.
Drop `--print-url` only after the browser lane is explicitly released.

The current canonical dungeon preflight rejects Ninth Winter's
`environment-wide` and `reverse-inward` brackets because they enter the Ash
Hall oak wall/lintel. Its baseline and lateral three-quarter brackets remain
clear. All widened Bull candidates remain clear of canonical Sun Court terrain;
the first live attempt is `three-quarter-left` because it places the north
shrine behind the Bull while preserving visible gold cap around the body.

The authenticated batch URL can be generated in code with:

```ts
promoBatchCaptureAuthUrl("boss-marketing", "http://localhost:3000");
```

## Authored staging log

| Boss                     | Encounter scenery              | Stage position         | Camera far → near                   | FOV |    Yaw | Time |
| ------------------------ | ------------------------------ | ---------------------- | ----------------------------------- | --: | -----: | ---: |
| Muck-Scarred Helix       | West Muck Breach               | `238, 32.05, -500`     | `222, 36, -496` → `225, 35, -499`   |  44 |     0° | 0.78 |
| The Gilded Bull          | Sun Court                      | `2968, 46.08, -312`    | `2950, 51, -305` → `2957, 49, -309` |  32 | −22.5° | 0.38 |
| The Ninth Winter         | Ash Hall                       | `3524, 65, -344`       | `3498, 70, -344` → `3505, 69, -344` |  42 |   −45° | 0.86 |
| The Failed Apprentice    | Bellward Halls — Bell Ring     | `354, 53.05, -313.4`   | `366, 58, -301` → `363, 56.5, -304` |  35 |    45° | 0.73 |
| The First Choir          | Bellward Halls — Central Choir | `356, 53.05, -309`     | `370, 58, -295` → `367, 56.5, -298` |  35 |    45° | 0.78 |
| The Echo-Singer          | Veins of the Wyrm — Echo Hall  | `632, 53.05, -318`     | `616, 59, -302` → `620, 56.5, -306` |  36 |   −45° | 0.71 |
| Vyrahel, the Vein-Keeper | Veins of the Wyrm — Spine Hall | `642, 53.05, -334`     | `656, 59, -350` → `653, 56.5, -346` |  35 |   180° | 0.66 |
| Thaedryn the Bellbound   | Wyrm's Bed                     | `640, 53.05, -268`     | `596, 70, -212` → `602, 66, -220`   |  44 |     0° | 0.75 |
| Hex Wraith               | Gravewood Pale Muck            | `632.924, 47, 146.321` | `620, 53, 159` → `624, 51, 155`     |  30 |   −45° | 0.74 |
| Alpha Mucker             | Old Wood Muck Patch            | `648.693, 57, -455`    | `696, 68, -410` → `690, 66, -416`   |  40 |     0° | 0.72 |
| The Root-Crowned Dead    | Deep Old Wood                  | `620, 53, -505`        | `603, 60, -518` → `608, 57, -514`   |  32 |   −90° | 0.80 |

All eleven stills capture at `2.05s`. Their generic combat emote is delayed to
`2.65s`, after the saved frame. A combat pose may only move before capture when
that exact boss/clip/camera combination has passed visual QA.

### Rejected passes and mistakes

The first 2026-08-03 batch proved the pipeline but was rejected at visual QA:
four Bellward/Veins scenes used quest-marker coordinates rather than the
renderer placements in the shifted Old Well / Underways district; the two
Chapter 1 dungeon cameras crossed their arena shell axes; and several Wilds
cameras were too distant or occluded by authored trees. The corrected table
above records the renderer-space anchors and accepted sector-proof lanes so the
same coordinate mistake is not repeated.

The 2026-08-04 retained-stack batch was also rejected. The mistakes were:

- Readiness was accepted without running the authoritative Chapter 1 seed
  readback against the same retained Redis world. The audit later proved all
  49 desert and all 60 winter dungeon terrain shards were absent, so correct
  cameras could only photograph sky.
- The Underways coordinates were shifted by `+1600` from source comments even
  though the running stack explicitly had
  `BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1`. Runtime environment wins over
  a historical coordinate assumption; record and test it before capture.
- A full eleven-scene batch was allowed to finish before representative visual
  QA. Future runs must inspect one ordinary-map, one Elsewhen, one Underways,
  and one Wilds frame first, then capture only after all four scenery families
  pass.
- A completed PNG is not an accepted PNG. File count, dimensions, successful
  persistence, and a healthy renderer prove the capture mechanism only. Final
  delivery requires contact-sheet inspection and explicit visual acceptance.

The later 2026-08-04 loading investigation added these required diagnostics:

- A DevTools row stuck at `(pending)` does not prove the asset server is slow.
  Compare the HAR with app, Sync, and Redis logs, then request representative
  asset URLs directly. In this incident the GLBs returned `200` in 4–13 ms and
  every server stayed healthy; the browser main thread was wedged before it
  could finish processing the responses.
- Do not preload whole visual catalogues before the first playable frame. The
  projectile/attack-shape, business-interior, and additive-town catalogues
  added 35 + 38 + 62 eager GLB requests. Their existing fallback and nearby
  selectors now stream the required assets on every platform.
- The first `THREE.Clock.getDelta()` is zero. The camera draw-distance fade
  therefore also starts at zero, and assigning that value directly to a
  perspective camera with `near = 0.1` creates a singular projection matrix.
  Voxeloo's synchronous `VisibilitySharder.scan()` then attempts to invert an
  invalid frustum and can pin the main thread before frame one. Keep the far
  plane strictly greater than the near plane; a fixed startup delay cannot fix
  a first delta that is still zero when rendering finally begins.
- When narrowing a renderer hang, log start/end around each renderer, then
  bisect inside the first renderer without an end marker. The decisive trace
  was `TerrainRenderer.draw START` with no `END`; retaining its constructor but
  temporarily bypassing only `VisibilitySharder.scan()` restored the frame.
- A React effect that performs authentication or network work must have an
  intentional dependency list. `LoginRelatedController` omitted `[]`, causing
  `/api/auth/check` to run after every render and adding avoidable traffic while
  the browser was already saturated.
- Immutable chunk URLs make stale browser caches dangerous during hotfix A/Bs.
  Use a fresh browser context or fresh origin, and verify both local and served
  bytes plus syntax before accepting a minified patch. One diagnostic patch was
  rejected because changing an immutable mounted chunk risked served-byte
  truncation; it was rolled back before capture.
- On mobile, a high scaled resource-node capacity can prevent the collector
  from ever running even when individual Voxeloo and Three allocations look
  modest. Physical-iPhone A/B reduced nodes from 7,031 to 2,569 and WebContent
  from about 1.2 GB to 986 MB after a controlled purge. A 2,500-node cap
  thrashed, while a mobile-only 4,000-node cap held stable; keep the separate
  block-mesh budget unchanged because the measured scene already used 36.

The 2026-08-05 visual preflight found four more concrete mistakes:

- A public Next.js environment flag is a compile-time input. Setting
  `NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1` only on the running
  container left the browser bundle with an empty `process.env`, so client-only
  Underways scenery still shifted by `+1600` while the promo cameras stayed in
  unshifted authored space. The build must mirror the resolved server flag into
  the public compile environment and reject mismatches.
- The native cutscene ghost loader called `replaceWithPlayerMaterial(gltf)` for
  every non-player GLTF. That replaced each boss's 10–33 authored material
  slots with one gray player shader. Preserve authored materials for
  `/assets/harthmere/glb/bosses/*.glb`; a successfully loaded gray boss is still
  a rendering failure.
- The shared `attack2` cue began at `1.35s`, before the `2.05s` still. Large or
  root-heavy clips expanded Ninth Winter, Alpha Mucker, Root-Crowned Dead, and
  Helix through the lens or surrounding terrain. Delay generic combat motion
  until after capture unless the exact pose has been approved.
- Auto-facing does not know each GLB's artistic front. It produced side/back
  silhouettes even with a valid camera. Use
  `scripts/cutscenes/render-boss-turntable.py` to inspect the existing authored
  GLB at eight angles, record an explicit yaw, and then verify that yaw in the
  live encounter scenery.

The resumed 2026-08-05 three-frame preflight added the grounding/scenery
lessons that must be preserved for future games:

- Every checked canonical `*_world.glb` had a rendered local lower bound of
  exactly `Y=-1`. The synthetic cutscene loader cloned the GLTF directly and
  later replaced its root position with the encounter coordinate, bypassing
  the ordinary runtime normalizer. The Bull therefore sat another block below
  an already raised dais. Ground the cloned hierarchy inside a parent wrapper;
  moving the parent must not erase the child's lower-bound correction.
- Encounter coordinates describe different surfaces. The Gilded Bull's native
  record is at the Sun Court floor (`Y=44`), but the gold bull dais occupies
  `Y=43..45`; a marketing puppet staged there must stand on the visible cap at
  about `Y=46`, not blindly reuse the combat record.
- Do not confuse physical grounding with visual grounding. The Bull's current
  lower bound at `Y=46.08` is already above the dais top. The rejected close
  `32°` lens hid the cap around its feet and made the body read as embedded.
  Raising the stage would make it float; keep the support height and test a
  `35–45°` wider/lateral three-quarter composition that exposes the platform.
- `NEXT_PUBLIC_BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1` selected unshifted
  topology, but snapshot-merge policy still suppressed the authored runtime
  town and then removed its GLB/OBJ scenery. That combination produced a fully
  rendered Failed Apprentice floating against sky. When an unshifted or
  standalone runtime town is explicitly enabled, render those placements and
  do not apply the shifted snapshot-built scenery filter.
- The live streaming observer should center the encounter stage, not a camera
  that may sit beside or inside a steep terrain column. The cinematic camera
  remains free to take an elevated three-quarter angle after the stage's
  terrain and ECS interest set is resident.
- Preserve rejected branded and raw PNGs outside the final filename set before
  recapturing. The Helix sky-only, Bull-in-dais, and Apprentice-in-void frames
  are useful regression evidence and must not be silently overwritten.
- Do not extend Helix's proven `222..225 / -496..-499` camera axis backward to
  `210..214 / -484..-488`. That lane enters an authored West Muck Breach
  structure and can pass terrain readiness while saving only a dark interior
  wall. Keep the known-safe camera lane, widen the lens, and move the staged
  actor within the same populated encounter shard instead.
- A five-shard terrain gate proves the capture floor is resident; it does not
  guarantee that the camera faces an authored horizon. Staging Helix east at
  `238 / -500` exposed the empty map edge and floating town props even though
  all proofs passed. Keep the camera on its safe lane, but survey an exact
  inward-facing actor slot before changing the stage; shard occupancy alone is
  not enough.
- The audited `[7,1,-17]` shard is non-empty, but `232 / -522` is occupied by
  the large authored tree/walkway structure. Helix was fully hidden while the
  terrain gate passed. Shard-level readiness must be paired with an exact
  actor-slot visibility check; retain `238 / -500` as the best-known visible
  staging point until a clear inward-facing slot is surveyed.
- A camera can be in loaded scenery and still be inside a terrain voxel, or its
  subject sightline can cross a wall. The live promo gate now checks 17 exact
  eased dolly samples and three sightlines against `/terrain/tensor`; do not
  accept a saved frame from a custom capture path that bypasses this gate.
- Do not disable the snapshot-built placement filter for the whole unshifted
  map just to recover Bellward scenery. That produced floating houses, stalls,
  fires, and trees over ordinary native terrain. Keep the filter globally and
  preserve only the exact `Old Well / Underways` district whose dungeon rooms
  are still authored runtime scenery.
- Do not move an ordinary-map observer from the proven camera lane to a much
  lower actor stage immediately before capture. The reconnect can discard the
  already coherent terrain interest set and the elevated cinematic camera then
  sees only a nearby slab. Boss promos now keep the bootstrapped camera interest
  set; the director still prewarms the actor and camera sample points.
- Ordinary cutscene prewarm deliberately skips absent sparse-world shards and
  only requires physics from one present shard. That contract is too weak for a
  marketing landscape. Ordinary-map boss promos now provide five explicit
  terrain proof points and wait for every terrain entity, occluder, and non-empty
  combined mesh; a slab-over-void scene fails closed instead of saving a PNG.
- A terrain ECS entity is not proof that its shard contains a visible surface.
  Read-only Redis tensor inspection found Helix shard `[8,1,-15]` at
  `256..288 / -480..-448` had `terrainZero=true`; the adjacent `[8,1,-16]` was
  empty too. Requiring either one correctly timed out with one missing occluder
  and one missing mesh. The Helix proof grid must use the five non-empty shards
  `[6,1,-17]`, `[6,1,-15]`, `[7,1,-16]`, `[7,1,-15]`, and `[8,1,-17]`.
  Hex, Alpha Mucker, and Root-Crowned Dead's fifteen audited proof shards were
  all non-empty.
- The later retained-Redis survey proved the fragmented Helix/Hex horizons were
  not missing terrain data: both had 797/797 solid sampled columns through 128
  metres, zero missing shards, and zero empty terrain tensors. The client also
  had the normal 128 m camera/Sync distance. The capture gate was too narrow:
  five floor proofs could pass before the camera-facing combined meshes built.
  Boss promos now warm and verify a three-lane view corridor at 32/64/96/112 m
  before capture. Do not raise the far plane to paper over missing meshes.
- `captureAt=0` and `0.8` both saved a perfect Bull dais with no Bull because
  the GLB puppet had not become visible yet. The earliest tested visible Bull
  was `1.6s`. A capture action can fire after the teleport action and still beat
  asynchronous actor asset visibility; bracket timing only after the scene's
  subject is proven visible.
- When hotpatching a minified generated page, do not inject a reference to a
  short local name merely because it currently holds the client context. The
  same minifier can declare that name later in the async function, putting the
  earlier reference in JavaScript's temporal dead zone. The first terrain-gate
  hotpatch failed with `Cannot access 'c' before initialization`; source code
  was correct. Prefer a scoped source compile, or rename/capture the generated
  local only after checking the complete function for later declarations.
- Every generated hotpatch must keep exact pre-edit chunks, require old/new
  byte-count assertions, pass `node --check`, and compare host and served SHA-256
  before opening a browser. The backups for this incident live under
  `artifacts/cutscenes/boss-hotfix-generated-backup-20260805-r1/` and `-r2/`.
- The documented turntable step was rerun against all eleven canonical
  `*_world.glb` files: 88 authored-material frames plus full/selected contact
  sheets are in `artifacts/cutscenes/boss-turntables-hotfix-20260805-r1/`.
  This proved the current yaws are readable and prevented another unnecessary
  asset rebuild.

The local image packaging failure is also part of screenshot readiness: root
`next.config.js` required `config/http_compression.cjs`, but the image omitted
that file and the web process exited before binding. Source tests and a complete
`.next` directory did not prove the container was runnable. Every image gate
must require `next.config.js` inside the image and reach the web health/bind
check before browser capture.

The debugging mistakes to avoid are equally important:

- Do not diagnose only from the screenshot or only from the browser console.
  Pull the HAR, browser log, app log, Sync log, Redis health/restart state, and
  representative direct asset timings before deciding which subsystem failed.
- Do not run a full eleven-shot batch after one successful mechanism test.
  Preflight one ordinary map, one Elsewhen dungeon, one Underways scene, and
  one open-Wilds scene, inspect that four-frame contact sheet, then continue.
- Do not treat a renderer-ready flag, full loading bar, or second-tab success as
  proof the first frame is safe. Confirm advancing rendered-frame count, finite
  camera projection values, responsive browser evaluation, and completed
  capture status in a fresh session.
- Do not accept a boss because its PNG exists or its GLB request returned 200.
  Verify readable silhouette, authored palette, full body inside frame, feet or
  intended spectral base at the terrain surface, no camera/terrain intersection,
  and recognizable encounter scenery. Archive every rejected bracket with its
  timestamp/capture label so the same failed angle is not retried.

## 2026-08-05 camera-angle ledger

The structured copy lives at
`artifacts/cutscenes/boss-camera-angle-ledger-20260805.json`. Keep both the
registry camera and the actual sampled capture camera: the dolly is in motion at
the still time, so the sampled position is the reproducible visual evidence.

| Scene / run | Stage | Registry far → near | FOV | Sampled camera | Verdict |
| --- | --- | --- | ---: | --- | --- |
| Helix `r4-proof-grid` | `232,32.05,-506` | `222,36,-496` → `225,35,-499` | 30 | `223.5055,35.4982,-497.5055` | Reject: boss rendered and grounded, but was too close and tangled with foreground props; right side exposed void/floating structures. |
| Helix `r5-wide-lane` | `232,32.05,-506` | `210,36,-484` → `214,34.5,-488` | 32 | `212.0793,36.2203,-486.0793` | Reject: camera entered an authored structure and saved a dark interior wall. Never reuse this lane. |
| Helix `r6-open-plaza-wide` | `238,32.05,-500` | `222,36,-496` → `225,35,-499` | 44 | `223.6560,35.4480,-497.6560` | Reject, but best-known visible actor slot: full boss and ground contact read; camera faces the empty map edge and floating town props. Current source retains this stage only as a safe visible baseline. |
| Helix `r7-inward-west-muck` | `232,32.05,-522` | `222,36,-496` → `225,35,-499` | 44 | `223.6086,35.4638,-497.6086` | Reject: actor was fully hidden by the large tree/walkway structure despite a non-empty shard and passing terrain proofs. |
| Bull `r3-grounded-dais` | `2968,46.08,-312` | `2950,51,-305` → `2957,49,-309` | 32 | `2954.1848,49.8043,-307.3913` | Reject by visual review: full authored bull is physically on the Y=46 dais top, but the close lens hides the surrounding cap and makes it read embedded. Keep the stage height; widen to 35–45° and test a lateral three-quarter angle that visibly separates the body from the platform. |
| Apprentice `r3-underways-room` | `354,53.05,-313.4` | `366,58,-301` → `363,56.5,-304` | 35 | `364.3438,57.1719,-302.6562` | Reject: ordinary-map sky/tree frame; no boss and no Bellward/Underways room. Treat as world-selection/scenery failure, not a camera polish issue. |
| Hex `r3-wilds-control` | `632.924,47,146.321` | `620,53,159` → `624,51,155` | 30 | `622.0768,51.9616,156.9232` | Renderer control passed: authored boss, palette, and grounding visible. Reject as final marketing art because the distant right horizon still exposes floating terrain columns. |

All rejected raw, branded, and HAR files were moved out of the final filename
set. A capture is not final until its row is changed to accepted after visual
review.

## Output contract

Final filenames use `biomes-harthmere-boss-<boss-id>.png`. Matching unbranded
frames use `biomes-harthmere-boss-<boss-id>-raw.png`. Do not hand-position a
browser camera for release screenshots: keeping the stage, camera, lighting,
animation beat, and filename in the registry makes the result reproducible.

The boss puppets use only the canonical `*_world.glb` assets and run in
`clientPuppet` mode with no end placements or commits. They cannot mutate
combat, quest, or world state.
