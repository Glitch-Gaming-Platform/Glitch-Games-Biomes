# Harthmere Snapshot-Built Grounded Pass v67

This pass responds to the floating-house/tree/NPC screenshots after the connected-town v66 pass.

## Straight answer

v66 added the connected-road contract and a server road segment, but the screenshots prove the runtime scene still had too many GLB/OBJ map assets layered over server terrain. That is why buildings and trees could appear detached from the ground even when the server voxel terrain was correct.

v67 makes the rule stricter:

- server-side voxel terrain owns Harthmere's roads, buildings, dungeon entrances, fountains/wells, trees, stairs, bridges, walls, roofs, and major map silhouettes
- Harthmere runtime GLB map placements are filtered out in snapshot-built mode
- GLB files are not deleted and can be re-enabled for asset debugging with `BIOMES_HARTHMERE_RENDER_GLBS=1`
- NPC server positions are grounded to `STARTER_TOWN_GROUND_Y + 1` after the extra-town coordinate shift
- connector-road signs/lamps/banners are now block-built terrain cues instead of GLB props
- multi-floor buildings get a safety exterior stair/landing if a future building definition forgets explicit stairs

## Env controls

Default snapshot-built mode:

```bash
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
BIOMES_CREATE_LOCAL_DEV_TERRAIN=1
```

Temporarily show old GLB placements for debugging only:

```bash
BIOMES_HARTHMERE_RENDER_GLBS=1
# or in browser/client builds:
NEXT_PUBLIC_BIOMES_HARTHMERE_RENDER_GLBS=1
```

Disable v67 snapshot-built filtering entirely:

```bash
BIOMES_HARTHMERE_SNAPSHOT_BUILT_MODE=0
```

## Verification

```bash
node scripts/harthmere/check-harthmere-snapshot-built-grounded-v67.cjs
node scripts/harthmere/dump-harthmere-floating-runtime-assets-v67.cjs
```

## What this does not do

It does not delete files from `public/assets/harthmere`. It only stops placing GLB/OBJ map assets in the Harthmere runtime scene when snapshot-built mode is active.
