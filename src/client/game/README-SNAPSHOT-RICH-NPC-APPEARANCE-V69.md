# Snapshot Rich NPC Appearance Bridge v69

This patch restores the original snapshot NPC appearance strategy while keeping Glitch/Harthmere's newer local player/NPC versatility.

## What changed

The 2026-05-16 snapshot dresses town, merchant, and quest NPCs through the player-like wearable pipeline. The visual mesh is generated from ECS `wearing` plus `appearance_component` data and then loaded from `/api/assets/player_mesh.glb?...`.

The Glitch branch had a development override that sent every `makePlayerLikeAppearanceMesh(id)` call to a static Harthmere body variant. That was useful for Harthmere custom player bodies, but it erased snapshot NPC clothing, head, skin, hair, and eye choices.

v69 keeps the Harthmere body variant for actual players and local-dev Harthmere NPCs, but sends snapshot player-like NPCs through the upstream wearable mesh URL again.

## Runtime behavior

- Harthmere local-dev NPC ids still use `makeLocalDevVoxelNpcGltf()`.
- Snapshot player-like NPCs use `makeSnapshotPlayerLikeAppearanceMesh()`.
- Existing snapshot `wearing` / `appearance_component` values are preferred.
- If old Redis records are missing cosmetics, deterministic snapshot-style fallback wearables and palette colors are supplied.
- If local asset mesh generation fails, rendering falls back to a visible voxel NPC instead of a blank mannequin.

## Required runtime env

`./b data-snapshot run` sets these by default:

```bash
GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1
BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1
NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1
```

This allows `/api/assets/player_mesh.glb` to use lazy local asset generation even when running in the Glitch/local snapshot environment.

## Escape hatch

To temporarily disable local asset generation during debugging:

```bash
GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=0 ./b data-snapshot run --no-pip-install
```

The NPCs will remain visible through the fallback renderer, but they will not have the full snapshot clothing/face richness.
