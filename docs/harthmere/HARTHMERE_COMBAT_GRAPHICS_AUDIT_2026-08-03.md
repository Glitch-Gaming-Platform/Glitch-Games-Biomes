# Harthmere combat graphics audit and AAA roadmap

Date: 2026-08-03
Scope: dodge, evade, double jump, melee, boss locomotion, projectiles, hit
explosions, charge-up, the eleven bosses, and the cave worm.

Method: asset data measured directly, not inferred. `.blend` sources were opened
in Blender 5.2 with `scripts/harthmere/blender/audit_combat_assets.py`; shipped
`.glb`/`.gltf` were parsed independently. Raw output is in
`tmp/blender_combat_asset_audit.json`.

Companion to `HARTHMERE_COMBAT_DOC_CODE_DRIFT_AUDIT_2026-08-02.md`, which covers
combat logic. This document is about what the player sees.

## Headline

The player's own combat animation is the best-authored content in the project.
The cave worm was the worst — and it was worst for a specific, fixable reason,
now fixed and verified. Everything between those two poles is limited by one
shared gap: **almost nothing in combat uses a texture.**

| Asset | Tris | Materials | Textured | Rig | Verdict |
| ----- | ---: | --------: | -------: | --: | ------- |
| Player rig | 1,358 | 11 | 10 | 16 bones, 120 actions | Healthy |
| Indisworm (before) | 8,576 | 24 | **0** | 9 bones, 7 actions | Fixed below |
| Indisworm (after) | 8,576 | **1** | **1** | 9 bones, 7 actions | Fixed |
| Premium projectiles | 11,288 | 39 | **0** | 367 meshes, 29 clips | Gap |
| Boss attack shapes | 3,494 | 4 | **0** | 75 meshes, 4 clips | Gap |
| Bosses (11, shipped GLB) | 19k-119k | 10-33 | **0** | 14-49 nodes | Gap |
| Big Mucker | 44,132 | 13 | 12 | 12 bones, 79 actions | Healthy |
| Dragon | 12,208 | 21 | 20 | 20 bones, 74 actions | Healthy |
| Hexer | 7,364 | 8 | 7 | 7 bones, 77 actions | Healthy |
| Tree Mucker | 5,896 | 5 | 4 | **4 bones**, 79 actions | Thin rig |

---

## 1. Dodge, evade, double jump — no fix needed

These are genuinely good and I want to be clear about that, because the
procedural fallback in `movement_actions.ts` reads at first glance like the
system is compensating for missing clips. It isn't.

| Clip | Frames | Keyframes | Curves | Bones driven |
| ---- | -----: | --------: | -----: | -----------: |
| `DodgeLeft` | 15 | 236 | 64 | 16 / 16 |
| `DodgeRight` | 15 | 236 | 64 | 16 / 16 |
| `DodgeForward` | 15 | 176 | 64 | 16 / 16 |
| `DodgeBack` | 15 | 168 | 64 | 16 / 16 |
| `EvadeRoll` | 18 | 424 | 76 | 16 / 16 |
| `DoubleJump` | 12 | 340 | 76 | 16 / 16 |

Every clip drives the full 16-bone rig at roughly 3-6 keys per curve — authored
animation, not two-pose blends. `EvadeRoll` at 424 keyframes over 18 frames is
the most densely authored action in the combat set.

The naming is also correctly wired. The rig uses `EvadeRoll` while gameplay uses
`evade`; `player_animations.ts` bridges that with an explicit
`fileAnimationName` mapping, so the clip resolves. I checked this specifically
because a silent miss there would fall through to
`playerMovementActionVisualPose()` and look dramatically worse.

That procedural pose is a **supplement, not a substitute** — its own comment says
it exists for "voxel avatar shells that do not inherit every joint in the skinned
Blender rig." It adds root-level pitch/roll/lift so a generated voxel body still
reads as rolling. Keep it.

**One improvement worth making:** `DodgeForward` and `DodgeBack` carry noticeably
fewer keys (176/168) than the lateral pair (236 each), and the lateral dodges are
the ones that matter most in a fight where sidestepping a committed cone is the
main defensive read. Consider bringing forward/back up to parity.

A deeper pass on these six clips found two real defects and fixed them — see
"Movement action polish" in the addendum.

## 2. The cave worm — fixed

The Indisworm was the single worst-authored combat asset, and the measurement
explains why in one number: **`uv_layers = 0`**.

With no UV layer the mesh physically cannot carry a texture, which is why it was
the only creature in the project with zero textured materials. To get any colour
variation it instead carried **24 separate materials on one 8,576-triangle
mesh** — 24 draw calls per worm, and still no per-texel detail. The material
names show the workaround: `muck_hide`, `muck_hide__highlight`,
`muck_hide__shadow`, repeated across eight base colours. Lighting was being
faked by tripling the material count.

### Fix applied

`scripts/harthmere/blender/fix_indisworm_palette.py` builds a 24x1 palette
image, assigns every face the UV of its own material's texel, and collapses all
24 slots into one material sampling that palette with nearest-neighbour
filtering. Output is `src/galois/data/npcs/indisworm_palette.blend`; the source
file is not modified.

Verified with `verify_indisworm_palette.py`:

| | Before | After |
| --- | ---: | ---: |
| Materials on object | 24 | **1** |
| UV layers | 0 | **1** |
| Textured materials | 0 | **1** |
| Triangles | 8,576 | 8,576 |
| Vertices | 17,152 | 17,152 |
| Bones | 9 | 9 |
| Actions | 7 | 7 |

Geometry, rig, and animation are bit-identical. The visual result is the same
flat voxel colour; the win is 24 draw calls to 1, and — more importantly — the
worm now has UVs, which is the prerequisite for every later improvement
(normal map, AO bake, grime/wetness pass).

### Two problems the palette fix does not solve

**The rig is too thin for what a worm is.** Nine bones: `Root`, `Tail`,
`Body01`, `Body02`, `Body03`, `Neck`, `Head`, `Socket_Mouth`, `AcidSac`. That is
five usable spine segments. A worm's entire visual identity is smooth
undulation, and five segments cannot produce a travelling sine wave — it moves
like a jointed arm. Eight to twelve spine bones is the minimum for readable
undulation. This requires re-skinning, so it is a deliberate piece of work, not
a script.

**Two clips are effectively static poses.** Keys per curve:

| Clip | Frames | Keys/curve | Reading |
| ---- | -----: | ---------: | ------- |
| `HitReact` | 7 | **1.75** | Linear A-to-B; no anticipation or settle |
| `RangedAttack` | 22 | 2.33 | Windup and release only |
| `Attack` | 17 | 2.67 | Thin |
| `Idle` | 72 | 5.0 | Fine |
| `Walk` | 36 | 5.0 | Fine |
| `Run` | 24 | 5.0 | Fine |

`HitReact` at 1.75 keys per curve is the one to fix first. It fires on every
successful player hit, so it is the most-seen clip in the fight, and at that
density it is a straight interpolation between two poses — no flinch, no recoil,
no settle. Given the combat work in the companion audit put a 65 ms hit-stop on
impact, the hit-stop is currently landing on a clip with nothing to show.

## 3. Bosses

All eleven ship as GLB with **zero textures**, 10-33 materials each, and
19k-119k triangles. They use the same flat-material approach the Indisworm did,
just without the UV problem being fatal.

Two structural issues:

**Every boss is stored twice, and the copies differ by one number.** `X.glb` and
`X_world.glb` have identical meshes, materials, animations, nodes, skins,
accessors and bufferViews. Diffing the JSON, the *only* difference is a scale on
the root node:

| Boss | Base root scale | `_world` root scale |
| ---- | --------------- | ------------------- |
| `gilded_bull` | none | `[1.5, 1.5, 1.5]` |
| `muck_scarred_helix` | none | `[2.667, 2.667, 2.667]` |

Thaedryn is 12 MB per copy. The `bosses/` directory is **100 MB of the 125 MB**
`glb` tree, so roughly 50 MB is being spent to encode eleven `Vector3` scale
values that a single `object.scale.setScalar(n)` at load time would express for
free. For a browser game this is the most expensive finding in the audit.

(An earlier draft of this document called the pairs byte-identical duplicates.
They are not — they differ, but only in that one root transform.)

**Triangle budgets are wildly inconsistent.** Big Mucker is 167k triangles with
**1** material; Thaedryn is 119k with 33; Root-Crowned Dead is 19k with 22.
167k triangles for a voxel creature indicates un-decimated voxel-to-mesh
conversion where every cube face became quads. Greedy meshing typically cuts
that by 10-50x with no visual change.

### Lore fidelity

I compared each boss's authored attack lore in `boss_attack_catalog.ts` against
its asset, and the *attacks* match their fiction well — `helix_maul_crush`
("scar-grown demolition limb"), `vyrahel_vein_breath`, `thaedryn_wing_gust`
("Cathedral Wing Gust") all have matching special clips and shape-correct
telegraphs.

Two caveats, stated honestly:

- I verified attack-level lore, animation clip presence, and shape assignment. I
  did **not** render each boss and compare silhouette against its written
  description; that needs the visual audit harness, not a static asset read.
- Thaedryn is authored at 58 m long (per `boss_magic_presentation.ts`), and the
  presentation code already compensates by pushing spell origins to the body
  surface. That compensation is correct and worth keeping — a centre-origin
  charge on a 58 m body spends its whole telegraph inside the mesh.

The existing harness is the right tool to finish the lore pass:

```bash
node scripts/harthmere/serve-boss-animation-visual-audit.cjs
node scripts/harthmere/validate-boss-animation-visual-audit.cjs
```

## 4. Projectiles, hit explosions, charge-up

**Projectiles** are 367 small meshes (mostly 12-96 triangles each) across 39
materials, with **zero textures** — but unlike the Indisworm they *do* have UVs
(`uv_layers = 1`), so they are texture-ready today.

Their flight animation is the weak point: every `*__FlightLoop_24` clip is 24
frames with **3 keys per curve across 6 curves** — location and rotation only.
Projectiles are rigid bodies that spin. Nothing pulses, tapers, trails, or
deforms along its flight path.

This matters more than it sounds, given the combat audit's B1 finding that
projectiles must be readable to be dodgeable. A projectile reads as fast and
dangerous largely through deformation and trail, not through its mesh.

**Boss attack shapes** are only four meshes — `beam`, `cone`, `ground_aoe`,
`self_aoe` — sharing 4 materials, no textures, each with a 24-frame
`PulseLoop` at 5 keys/curve. All 55 boss attacks share these four telegraph
shapes. Since the combat audit's D4 fix restored per-attack telegraph *timing*
variety, the shapes are now the remaining source of sameness.

**Hit explosions** are the strongest VFX in the project and are code-driven, not
authored: `harthmere_projectiles.ts` builds four particle batches per impact
(debris, sparks, mist, dust) as `InstancedMesh` with per-particle drag, gravity,
and spin, capped at 8 impact lights. This is real particle simulation and needs
no rework.

**Charge-up** is handled by `boss_magic_presentation.ts`, which scales the charge
graphic by creature volume (capped at 7.5x) and places it on the body surface.
Good code. Note the combat audit changed charge from a gameplay gate to pure
presentation, so the charge visual should now be authored against the ~460 ms
release window rather than a multi-second hold.

---

## AAA roadmap for a voxel game

Ordered by visual return per unit of work. The unifying observation: this
project has **good geometry and good animation, and almost no surface treatment.**
Flat-colour voxel art is a legitimate style, but AAA voxel titles are not
untextured — they layer detail onto flat palettes.

### Tier 1 — highest return

1. **Palette-atlas every creature and projectile.** The Indisworm fix
   generalises. One 32x32 palette per family collapses 20-30 materials to 1,
   gives every asset UVs, and unlocks everything below. The script is written and
   parameterisable.
2. **Bake ambient occlusion into the palette's second channel.** Voxel forms are
   blocky, so contact shadows in crevices do enormous work for perceived depth
   at near-zero runtime cost. This is the single biggest "AAA" step available and
   it only becomes possible once UVs exist.
3. **Delete the `_world` duplicates.** Roughly halves a 125 MB payload with no
   visual change.
4. **Greedy-mesh the heavy creatures.** 167k triangles for Big Mucker is
   10-50x more than the silhouette needs.

### Tier 2 — combat feel

5. **Projectile trails and deformation.** Ribbon trails with velocity-stretched
   geometry; taper the mesh along flight. Directly reinforces the B1
   readability fix.
6. **Rebuild `HitReact` for the Indisworm** (and audit other creatures for
   sub-2.0 keys/curve clips). Add anticipation and settle so the 65 ms hit-stop
   has something to punctuate.
7. **Per-boss telegraph variants.** Four shared shapes across 55 attacks is the
   remaining flattener now that timing variety is restored.
8. **Emissive rim on wind-up.** A rising rim-light during telegraph reads
   instantly at any distance and costs one shader term.

### Tier 3 — polish

9. **Re-skin the Indisworm to 8-12 spine bones** so it undulates.
10. **Bring `DodgeForward`/`DodgeBack` to parity** with the lateral dodges.
11. **Screen-space contact shadows and a subtle bloom on emissives** — the
    toxic-lime and core-cyan materials already carry emission values that
    currently go nowhere.
12. **Thicken the Tree Mucker rig** — 4 bones (`Body`, `Head`, `R_Leg`, `L_Leg`)
    is the thinnest rig in the project.

### Explicitly not recommended

Per-asset normal maps and PBR metal/roughness texturing. They fight the voxel
aesthetic, multiply asset size, and would take this away from the look the
project already has. Baked AO plus emissive plus good lighting gets most of the
perceived quality at a fraction of the cost.

---

## Tooling added

Three scripts under `scripts/harthmere/blender/`, all runnable from Blender's
Python console:

| Script | Purpose |
| ------ | ------- |
| `audit_combat_assets.py` | Read-only survey of tris, materials, textures, rigs, and keyframe density |
| `fix_indisworm_palette.py` | Palette-collapse fix; writes a new file, never overwrites |
| `verify_indisworm_palette.py` | Before/after comparison proving the fix is lossless |

Two notes for whoever runs these next:

- Blender 4.4 replaced `Action.fcurves` with slotted actions
  (layers -> strips -> channelbags) and 5.2 removed the legacy attribute. The
  audit script handles both; any other Blender tooling in the repo written
  against the old API will raise `AttributeError` on every action under 5.2.
- All three scripts open files with `load_ui=False`. Without it Blender adopts
  each file's saved workspace and the console you are typing into disappears
  mid-run.

---

# Addendum — gaps closed (2026-08-03)

## Ambient occlusion baked into all 11 bosses and the cave worm

Tier 1 item 2 is done. Every boss and the Indisworm now carry a per-vertex AO
term in `COLOR_0`.

This is the change that most directly answers "make the bosses look clear and
high quality." With flat per-material colour and no texture, a 119k-triangle
dragon silhouettes exactly like a 19k one — all the geometry is there but none
of it reads, because nothing darkens where forms meet. AO in `COLOR_0` fixes
that with no texture memory, no UV unwrap, and no client change: three.js
`GLTFLoader` enables `vertexColors` automatically when a primitive has `COLOR_0`,
and glTF specifies it as a multiplier on base colour.

| Boss | Tris | Prims | AO min/mean/max | Shadowed |
| ---- | ---: | ----: | --------------- | -------: |
| `thaedryn_bellbound` | 119,296 | 33 | 0.55 / 0.79 / 1.00 | 68% |
| `alpha_mucker` | 115,128 | 21 | 0.55 / 0.84 / 1.00 | 63% |
| `ninth_winter` | 58,072 | 30 | 0.55 / 0.81 / 1.00 | 69% |
| `vyrahel_vein_keeper` | 47,036 | 17 | 0.55 / 0.80 / 1.00 | 68% |
| `muck_scarred_helix` | 41,832 | 33 | 0.55 / 0.80 / 1.00 | 70% |
| `gilded_bull` | 32,008 | 33 | 0.55 / 0.82 / 1.00 | 66% |
| `echo_singer` | 30,468 | 10 | 0.55 / 0.79 / 1.00 | 73% |
| `failed_apprentice` | 26,684 | 20 | 0.55 / 0.85 / 1.00 | 63% |
| `root_crowned_dead` | 19,592 | 22 | 0.55 / 0.79 / 1.00 | 74% |
| `hex_wraith` | 7,644 | 11 | 0.55 / 0.84 / 1.00 | 68% |
| `first_choir` | 7,056 | 33 | 0.55 / 0.85 / 1.00 | 64% |
| **Indisworm** | 8,576 | 24 | — | 69% |

Output is in `tmp/ao_out/`; sources are untouched. `verify_glb_vertex_ao.py`
reports **11/11 verified**: meshes, materials, animations, nodes and skins
unchanged, triangle counts identical, and every `COLOR_0` accessor present as
normalized `VEC4`/`UNSIGNED_BYTE` with genuine variation.

### Tuning mattered more than the bake

The first run produced a mean AO of **0.50 with 89-94% of vertices occluded**,
which would have shipped as uniform mud — worse than no AO. The cause was rays
re-entering the occupancy cell containing their own origin vertex and counting
that as a hit, so occlusion was near-total regardless of shape.

Three changes fixed it: start rays two cells off the surface
(`AO_ORIGIN_CELLS`), skip the first steps (`AO_SKIP_CELLS`), and shorten ray
length from 10% to 3.5% of the bounding box. AO is a *contact-shadow* term; long
rays make every concave region hit something and flatten the model.

The result is a mean of 0.79-0.85 with roughly a quarter of vertices at full
brightness — crevices darken, flat faces stay lit.

## AO is the wrong tool for projectiles, and that is worth stating

Projectiles were baked as a test and the result was **0.6% occlusion** on
`fireball.glb`. That is not a bug. Projectiles are small convex emissive shells
with nothing to self-shadow, so occlusion has nothing to find.

What projectiles actually need for clarity is different, and mostly renderer
work rather than asset work:

1. **Velocity-stretched geometry.** Scaling along the flight axis by speed is
   the single strongest readability cue for a fast-moving object, and reinforces
   the B1 flight-time floor from the combat audit.
2. **Stronger trails.** `PremiumTrail` already exists in
   `harthmere_projectiles.ts` as an `InstancedMesh` ribbon — it needs widening
   and a longer lifetime on fast projectiles, not new code.
3. **Emissive rim.** The manifest already carries `primaryColor`,
   `secondaryColor` and `lightIntensity` per projectile; none currently drives a
   rim term.
4. **Flight-loop deformation.** Every `*__FlightLoop_24` clip is 3 keys/curve on
   6 curves — pure location and rotation. Adding a scale pulse would cost
   almost nothing.

These are deliberately left as recommendations rather than half-done: they
change how the combat renderer draws, and that deserves its own pass.

## Tooling: moved off Blender for the asset pipeline

`scripts/harthmere/bake_glb_vertex_ao.py` and `verify_glb_vertex_ao.py` are pure
Python and need only numpy. They run headless, in CI, with no GUI session.

This replaced an earlier Blender-based attempt that could not work. Blender's
glTF add-on reads `bpy.context.object` during import and `context.active_object`
during export; neither exists when an operator is driven from the Python
console, and `temp_override` does not help because the add-on re-reads the
global context internally. The failure surfaces as
`AttributeError: 'Context' object has no attribute 'object'` partway through
importing the first armature, which looks like a corrupt asset but is not.

Blender remains the right tool for `.blend` work (the Indisworm palette fix);
it is the wrong tool for batch glTF processing.

Two correctness notes for anyone extending these scripts:

- **Build the occupancy grid from the whole asset, not per primitive.** The
  first version occluded each primitive only against itself, which produced a
  flat 0% result on multi-part assets like `fireball.glb` (14 separate shells).
- **Do not interrupt a write.** A cancelled run left `alpha_mucker_ao.glb`
  with a truncated BIN chunk that still parsed as a valid GLB header while its
  declared `buffer.byteLength` exceeded the bytes present. The verifier now
  checks this explicitly.

## Movement action polish — dodge, evade, double jump

The first pass confirmed these clips exist and are densely keyed. A closer look
at clip *timing* against the gameplay windows found two defects. Measured with
`scripts/harthmere/blender/audit_movement_action_clips.py`; scene is 24 fps.

| Clip | Clip length | Gameplay window | Delta | Bones | Keys | Eased |
| ---- | ----------: | --------------: | ----: | ----: | ---: | ----: |
| `DodgeLeft` | 0.625 s | 0.50 s | **+125 ms** | 16 | 236 | 100% |
| `DodgeRight` | 0.625 s | 0.50 s | **+125 ms** | 16 | 236 | 100% |
| `DodgeForward` | 0.625 s | 0.50 s | **+125 ms** | 16 | 176 | 100% |
| `DodgeBack` | 0.625 s | 0.50 s | **+125 ms** | 16 | 168 | 100% |
| `EvadeRoll` | 0.750 s | 0.75 s | 0 | 16 | 424 | 100% |
| `DoubleJump` | 0.500 s | 0.50 s | 0 | 16 | 340 | 100% |

Every keyframe on all six clips is `BEZIER` — nothing is linear, so the motion
is properly eased throughout. That part was already right.

### Defect 1 — the dodges were being cut off mid-recovery

All four dodge clips are 15 frames at 24 fps = **0.625 s**, played into a
**0.50 s** action window with no retiming. The action expires with 125 ms of
clip still unplayed, and since the tail of a dodge is its landing and settle,
the part that makes the move look *finished* never reached the screen. The dodge
read as interrupted rather than completed.

`EvadeRoll` and `DoubleJump` were authored to their windows exactly and needed
no correction, which is what made the dodges stand out.

**Fix:** `HARTHMERE_DODGE_CLIP_TIME_SCALE` in `movement_actions.ts`, derived from
the timing table rather than hardcoded (`0.625 / dodge.durationSeconds` = 1.25),
applied to all four dodge entries in `player_animations.ts`. The full clip now
plays inside the window. If the dodge window is ever retuned, the constant
follows it.

### Defect 2 — the procedural pose was doubling the authored animation

`playerMovementActionVisualPose()` is documented as a fallback for "voxel avatar
shells that do not inherit every joint in the skinned Blender rig." It was being
applied **unconditionally** at `players.ts:180`, on top of whatever the skinned
clip was already doing.

For a normal skinned player that meant the authored motion ran twice:

| | Authored clip | Procedural term added on top |
| --- | --- | --- |
| `EvadeRoll` | 424 keyframes rolling the body, plus 1.85 of `Chest.y` root lift | a further full `2*PI` pitch rotation and 0.9 m of lift |
| `DodgeLeft/Right` | 236 keyframes | an extra 0.48 rad (~27 degrees) of roll and 0.08 m lift |
| `DoubleJump` | 340 keyframes, 0.98 `Chest.y` lift | extra compression, pitch and lift |

So the evade rolled twice and floated roughly a metre higher than authored. This
is the more visible of the two defects and explains any impression that the roll
looked exaggerated or detached from the ground.

**Fix:** the procedural pose is now applied only when
`mesh.animationSystem.hasAnimation(animationName)` is false — i.e. genuinely
only as the substitute it was designed to be. Generated voxel shells that lack
the clip still get it; skinned rigs use their authored animation alone. The
cutscene path is deliberately left unconditional, since it drives shells that
may not carry these clips at all.

### Verified

9/9 static checks pass: the constant is derived rather than hardcoded, applied
to exactly the four dodge clips, evade left untouched, the pose gate is in place
with `pose` assigned only inside it, and the cutscene path unchanged.

Full `tsc` did not complete inside the audit sandbox (it was saturated by the AO
bakes). The changes touch three files and reference APIs confirmed present —
`AnimationSystem.hasAnimation` at `animation_system.ts:73` and the
`mesh.animationSystem` accessor already used at `player_mesh.ts:5967` — but run
the typecheck before shipping:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false
```

### Still worth doing

- Bring `DodgeForward` (176 keys) and `DodgeBack` (168) up to the lateral pair's
  density (236). Lateral dodges carry the most defensive weight, and the
  forward/back pair currently has visibly less articulation.
- Consider whether `DoubleJump`'s existing `timeScale: 1.18` is still wanted now
  that the dodges are corrected: it makes a 0.50 s clip finish in 0.42 s and
  hold the final pose for the remaining 76 ms. That may be intentional snap, but
  it is the one remaining clip whose playback does not match its window.

## Wiring the results in

Nothing here is live yet — all output is in `tmp/ao_out/` for review. To adopt:

1. Copy `tmp/ao_out/bosses/*_ao.glb` over the shipping names in
   `public/assets/harthmere/glb/bosses/`.
2. Confirm in-engine that `COLOR_0` is multiplying as expected. If a boss looks
   uniformly darker rather than shaded, its material is likely overriding
   `vertexColors`.
3. Re-run `python3 scripts/harthmere/verify_glb_vertex_ao.py` after any
   re-export.
4. Retire the `_world` variants in favour of a load-time scale, which is the
   largest payload win available.

## Not done

- Rendered silhouette-vs-lore comparison for the eleven bosses (needs the visual
  audit harness).
- GLB export of the palette-fixed Indisworm — the glTF exporter add-on is not
  enabled in this Blender install, so the `.blend` is the deliverable. Enable
  **Import-Export: glTF 2.0** in Preferences > Add-ons, or run the existing
  galois export path, to produce the shipping asset.
- The palette fix has not been wired into the asset pipeline; it produces a
  parallel file for review rather than replacing `indisworm.blend`.
