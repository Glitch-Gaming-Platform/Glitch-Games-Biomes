# Harthmere inventory icon studio

This pipeline renders the non-protected Harthmere inventory catalogue in
Blender. It uses a shared orthographic hero camera, three-point lighting,
material-specific shaders, exaggerated silhouettes, contact shadows, 512px
source renders, and 256px RGBA downsampling.

The final PNGs have transparent backgrounds. The soft grounding shadow is
intentional; the square studio backdrop is not rendered.

## Luis's Chapter 1 repair cart

`generate_luis_repair_cart.py` builds the authored quest prop used by Stand Him
Up / Gather Parts. The GLB is grounded at its origin and contains an explicit
deck, rails, four wheels, separated handles, repair chest, material cargo,
tools, and a wrench flag. The game retains its procedural cart only as a
load-failure fallback; do not replace the authored asset with generic Three.js
boxes.

```bash
blender --background \
  --python scripts/harthmere/blender/generate_luis_repair_cart.py -- \
  --repo-root "$PWD" \
  --preview-dir artifacts/harthmere-luis-repair-cart

python3 -m py_compile scripts/harthmere/blender/generate_luis_repair_cart.py
```

Review `artifacts/harthmere-luis-repair-cart/luis-repair-cart-blender-preview.png`,
then run the focused quest-marker test and the single Gather Parts live-browser
visual gate from `docs/harthmere/TESTING_FASTER.md`. A Blender preview proves
the asset, not its final scale, grounding, interaction, or camera readability.

## Regenerate

```bash
blender --background \
  --python scripts/harthmere/blender/generate_inventory_icons.py \
  -- --force

node scripts/harthmere/blender/generate_inventory_icon_manifest.cjs
node scripts/harthmere/validate-inventory-icons.cjs
```

`inventory_icon_targets.json` is the exact scope and includes the protected
item IDs that the generator must not replace. Closely related resources use a
consistent family model with deterministic item-specific palettes and marks.

The output is wired through the generated manifest into both BiomesUI and the
native Bikkie presentation overlay. Item identity, stack behavior, equipment,
combat, crafting, quest, and ECS semantics remain owned by their existing
native definitions.

## Gameplay and cutscene expression clips

`add_cinematic_expression_actions.py` authors the first-class body-language
library used by player emotes, NPC ECS emotes, and cutscene actors. Its source
of truth is
`src/shared/cutscene/cinematic_expression_catalog.json`; do not hand-maintain a
second clip list in the Blender script.

The script maps abstract body, head, arm/wing/fin, and leg controls onto each
rig's available bones. It writes 70 unique clips for 71 public expression ids
(`comeHere` intentionally aliases the beckon clip) into the player animation
set and all 23 NPC animation sets. Clips never author horizontal root motion:
gameplay physics, Anima, and cutscene `moveTo` actions remain the sole owners of
world translation.

Run it against an open animation `.blend` file:

```bash
blender --background src/galois/data/animations/character-animations.blend \
  --python scripts/harthmere/blender/add_cinematic_expression_actions.py
```

Repeat for NPC `*_animations.blend` files when the catalog or rig mapping
changes, then run:

```bash
python3 -m py_compile scripts/harthmere/blender/add_cinematic_expression_actions.py
node scripts/harthmere/test-harthmere-cinematic-expression-assets.cjs
scripts/harthmere/t.sh cutscene
```

The asset audit verifies clip coverage, channel targets, and that the existing
production `Attack` and `Attack2` tracks retain their original channel counts.
Blender inspection is an authoring check, not the visual acceptance gate. The
final review must use the exact-current-source game renderer and the generated
`harthmere-expression-showcase` cutscene described in `docs/cutscenes.md`,
following `docs/harthmere/TESTING_FASTER.md` so a stale app image is never
mistaken for the current implementation.

## Gathering-node and jobs-board world graphics

`generate_world_interaction_graphics.py` builds the presentation assets for all
29 authoritative gathering nodes and the five color variants shared by the 21
physical jobs boards. It does not own interaction, tool/skill validation,
inventory rewards, depletion/respawn, or jobs-board proximity. Those remain in
the native/server systems.

The jobs board intentionally remains a large landmark at approximately 6.6 m
wide by 6.45 m tall. The optimization comes from replacing the old runtime box
hierarchy and lights with shared, meshopt-compressed Blender GLBs, two LODs,
frustum culling, and distance hiding—not from making the board small.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --background \
  --python scripts/harthmere/blender/generate_world_interaction_graphics.py -- \
  --repo-root "$PWD" --render-previews

python3 -m py_compile \
  scripts/harthmere/blender/generate_world_interaction_graphics.py
node scripts/harthmere/test-world-interaction-graphics.cjs
```

Outputs:

- `public/assets/harthmere/glb/gathering_nodes/`
- `public/assets/harthmere/glb/jobs_boards/`
- `public/assets/harthmere/manifest/world-interaction-graphics.json`
- `output/harthmere-world-interaction-graphics/previews/`

Use `--only <node-id>` or `--only jobs_board_<variant>` for a smoke rebuild.
Selected builds merge into the complete manifest and must still pass the full
asset validator. Blender previews are authoring evidence only; final acceptance
requires exact-current-source E2E and live-browser screenshots proving scale,
grounding, the F prompt, required-tool rejection, successful harvesting, and
jobs-board content loading.

### Gaia and planted-crop boundary

This world-interaction graphics task does not change the farming system, Gaia,
crop stages, crop timing, or native plant harvesting.

The 29 authored gathering landmarks are not planted crop entities. They use
the Harthmere server's shared respawn authority and must not receive Gaia plant
ticks merely because some look botanical. The permanent orchard branch pile,
wild herb bed, mushroom ring, and farm-row landmark therefore keep their static
optimized renderer while their server interaction becomes available again at
the authored respawn time.

All 29 landmarks share one lightweight renderer-only grow-in: the existing
Blender group rises 0.46 m and scales from a compressed underground pose to its
authored size over 0.9 seconds. A successful F harvest reads the exact
authoritative native-drop expiry and replays that same grow-in when the node's
existing respawn completes. This is presentation only; it does not create a
second respawn authority, alter the server cooldown, or enter the Gaia farming
simulation. The client only compares the server-authored expiry with the clock
to decide when to reveal the visual again.

Player-planted crops already use the native `farming_plant_component` plus the
Gaia farming simulation. Gaia owns `planted`/`growing`, stage and stage-progress
advancement, water/sun/shade halts, wilting/death, terrain growth writes, and
harvest drop materialization. Their existing Galois flora assets select
`seed`, `sprout`, `flowering`, `adult`, and `wilted` presentation stages.

Blender art can be shared at the design level: a mature flax, berry, mushroom,
or flower crop may reuse the same silhouette, palette, and supported-detail
language as its authored gathering landmark. Do not render the complete static
landmark (ground pad, baskets, tools, carcass kit, or multiple-row footprint)
on a planted crop. Any planted-crop art upgrade must export stage-specific
Galois/flora assets and let the synchronized Gaia growth value select the
stage; it must not add a second client timer or duplicate plant authority.
