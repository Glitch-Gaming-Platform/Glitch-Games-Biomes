# Harthmere Native Cursor Attack Targeting (V1)

This document records the working fix for left-click attacks against Harthmere
muckers, hexes, animals, sentinels, robots, bots, NPCs, and players.

The important conclusion: the reliable path is the native Biomes cursor attack
pipeline. Renderer bridges and screen-projection targeting are fallback/debug
systems. A target is hittable when the cursor can put a real ECS entity into
`cursor.attackableEntities`, then `AttackDestroyDelegateItemSpec.tryAttack()`
publishes the normal health event.

## Working Control Case

Sentinels, robots, and bots could be hit because they matched the native Biomes
requirements:

- They are real ECS NPC entities created by `npcEntity(...)`.
- They have `position`, `size`, `health`, `npc_metadata`, `npc_state`, and
  `collideable`.
- Their visible actor is co-located with the ECS entity.
- The cursor includes them in `attackableEntities`.
- `handleAttackInteraction(...)` publishes `UpdateNpcHealthEvent`.

The code path is:

1. `src/client/game/scripts/cursor.ts`
   - `traceEntities(table, source, direction, ...)` checks the ECS table.
   - `attackableEntitiesInAttackRegion(...)` and the crosshair entity inclusion
     build `cursor.attackableEntities`.
2. `src/client/game/interact/item_types/attack_destroy_delegate_item_spec.ts`
   - `tryAttack(...)` returns true only when `cursor.attackableEntities` is not
     empty.
3. `src/client/game/interact/helpers.ts`
   - `handleAttackInteraction(...)` publishes `UpdatePlayerHealthEvent` or
     `UpdateNpcHealthEvent`.

If `attackableEntities` is empty, the same left-click can still break the voxel
behind the creature. That is the visible symptom: blocks break, but the target
does not take damage.

## Root Cause That Actually Blocked Muckers/Animals

The production live muckers, hexes, cows, sheep, and rabbits are real ECS
entities. They are seeded with the same critical components as the robots:
`position`, `size`, `health`, `npc_metadata`, `npc_state`, and `collideable`.

The blocker was the attackability filter:

```ts
getNpcBehavior(npcType).damageable?.attackable
```

Harthmere live creatures reuse legacy NPC types such as `dMucker`. That type has
`damageable.attackable: false`. So even though the target was a real,
collideable, health-backed ECS entity, `canAttackFilter(...)` returned false and
the cursor omitted it before the click could become an attack.

That is why changing renderer bridges, screen projection, or reach alone did not
fix the issue. The target was being filtered out as non-attackable.

## Current Fix

`src/client/game/resources/melee_attack_region.ts`

- `canAttackFilter(...)` now lets explicit Harthmere live-target semantics win
  for health-backed living labels/components such as muckers, mucklings, muxes,
  hexers, livestock, cows, sheep, rabbits, animals, monsters, creatures, and
  robot components.
- Generic non-combat NPCs and non-living world objects are still filtered out.
- This means `dMucker` can remain a legacy Bikkie type with
  `damageable.attackable: false`, while real Harthmere live entities using that
  type are still attackable by left click.

`src/client/game/scripts/cursor.ts`

- The cursor still uses the normal `CollideableSelector` trace first.
- It also runs an attack-only `NpcMetadataSelector` ray fallback. This covers
  renderable NPCs that have `position + size` but are missing from
  `CollideableSelector` for any reason.
- The fallback is deduped against normal collideable hits and still respects the
  same cursor entity filter.

## What Not To Use As The Primary Fix

Do not make the renderer-global actor registry the primary attack solution.
These paths are useful for diagnostics or install-only fallback behavior, but
they are not the durable fix for ordinary ECS targets:

- `window.__harthmereCombatActorPositions`
- crosshair screen-projection targeting
- `request_attack` live-mode fallback
- static `PLACEMENTS` combat offsets

They can fail when the Harthmere runtime renderer is gated off, stale, empty, or
not co-located with the server ECS entity. The native cursor path is the source
of truth for entities that exist in the ECS table.

## Remaining Known Limitation

Some animals/undead in `harthmere_assets.ts` are purely static renderer
placements and are not ECS entities at all. The native cursor attack path cannot
damage those exact decorative placements until they are seeded as real ECS
entities or mapped to an existing co-located ECS entity.

The working fix covers the real seeded ECS muckers, hexes, livestock, animals,
robots, sentinels, bots, NPCs, and players.

## Tests

Focused test file:

```bash
./node_modules/.bin/mocha --require ts-node/register --require tsconfig-paths/register --extension ts src/client/game/resources/melee_attack_region.test.ts
```

Expected coverage:

- health-backed Harthmere targets without NPC metadata are attackable
- non-living health-backed objects stay non-attackable
- real `dMucker` muckers are attackable despite `damageable.attackable: false`
- real `dMucker` animals are attackable despite reusing the mucker NPC type
- crosshair inclusion uses voxel-break reach
- metadata ray fallback hits positioned NPCs missing from `CollideableSelector`

