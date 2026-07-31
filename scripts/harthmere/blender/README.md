# Harthmere inventory icon studio

This pipeline renders the non-protected Harthmere inventory catalogue in
Blender. It uses a shared orthographic hero camera, three-point lighting,
material-specific shaders, exaggerated silhouettes, contact shadows, 512px
source renders, and 256px RGBA downsampling.

The final PNGs have transparent backgrounds. The soft grounding shadow is
intentional; the square studio backdrop is not rendered.

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
