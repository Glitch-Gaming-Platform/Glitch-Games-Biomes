
# Harthmere / Snapshot Overlay + NPC Visuals v68

This patch fixes two snapshot-merge problems exposed after moving Harthmere into the snapshot world.

## 1. Overlay crash on missing entity size

Crash:

```text
AssertionError: undefined == true
src/client/game/scripts/overlays.ts
const npcSize = getSizeForEntity(entity);
ok(npcSize);
```

Some legacy snapshot quest-giver or NPC-like entities can have a position and label but no size data that the newer Glitch overlay path can resolve. A name overlay should never take down the render loop.

The compatibility rule is:

- if `getSizeForEntity(entity)` returns a size, use it;
- else if the entity has `entity.size.v`, use it;
- else use a conservative `[1, 2, 1]` human overlay height and log once.

Marker:

```ts
SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT_VERSION_V68
```

## 2. Blank snapshot NPCs

The upstream 2026-05-16 snapshot renders player-like NPCs through `makePlayerLikeAppearanceMesh()`. In the Glitch/Harthmere branch, many of those snapshot NPCs do not have the newer appearance/wearing schema expected by the current renderer, so they show up as blank gray/beige mannequins.

v68 changes player-like NPC rendering in snapshot merge mode:

- Harthmere/local-dev NPCs still use their Harthmere voxel NPC renderer.
- Snapshot player-like NPCs now default to a deterministic visible voxel NPC fallback with generated face, body, clothing, colors, and role details.
- The old player-like renderer can still be tested with:

```bash
BIOMES_SNAPSHOT_NPC_RENDERER=legacy
# or
NEXT_PUBLIC_BIOMES_SNAPSHOT_NPC_RENDERER=legacy
```

Marker:

```ts
SNAPSHOT_PLAYERLIKE_NPC_VISIBLE_FALLBACK_VERSION_V68
```

## Verify

```bash
node scripts/harthmere/check-harthmere-snapshot-overlay-npc-visuals-v68.cjs
node scripts/harthmere/dump-snapshot-playerlike-npc-render-v68.cjs
```

## Expected result

- The overlay/name crash stops.
- Quest-giver name overlays skip or fallback instead of asserting.
- Snapshot player-like NPCs no longer render as blank mannequins.
- NPCs may not yet match their exact historical upstream clothing one-for-one; that is a later schema reconciliation task. This patch prioritizes visible, readable NPCs over blank bodies.
