# Harthmere Live-Creature ECS Render, Targeting, Spawns & Respawn (current)

> **Status update:** this document originally treated ECS-driven rendering and
> crosshair live-mode targeting as the primary fix for creature hits. That was
> incomplete. The working hit fix is the native cursor/ECS attack path described
> in `docs/harthmere/HARTHMERE_NATIVE_CURSOR_ATTACK_TARGETING.md`.
>
> In short: seeded muckers, hexes, cows, sheep, and rabbits are real ECS entities
> with `collideable`; the blocker was that their reused `dMucker` NPC type has
> `damageable.attackable: false`, so `canAttackFilter(...)` omitted them before
> left-click could publish `UpdateNpcHealthEvent`. The current fix lets explicit
> Harthmere live-target semantics override that legacy Bikkie flag and adds a
> metadata ray fallback for renderable NPCs missing from `CollideableSelector`.

This document describes the render/respawn system that can make living things in Harthmere:
muckers, hexes, animals, quest/escort/hired creatures, **and** town humans (the
Doc, the Chef, guards, merchants) render on their real ECS entities so they are
**non-flickering**, randomly spread across the world, and able to line up with
the native cursor hit path. It is not the primary damage fix by itself.

## The rendering bug this addresses

Historically the creatures you saw were **client-side renderer meshes** drawn
from a static `PLACEMENTS` list in
`src/client/game/renderers/local_dev/harthmere_assets.ts`. Their server-side ECS
entities (seeded in `src/shared/harthmere/live_entity_production_seed.ts`)
lived at *different* positions — muck monsters were deliberately relocated into
muck patches and out of the Grove. So:

- The native attack ray (`scripts/cursor.ts` → `traceEntities(table, …)`) only
  hits **ECS entities**. The visible mesh was not one, so left-click broke the
  voxel behind it but never damaged the creature.
- Robots were the exception: their ECS seed uses `position: [...area.anchor]` —
  the same anchor their mesh draws at — so they were co-located and hittable.
- Town NPCs that existed as **both** a static placement and a seeded ECS entity
  flickered as the two representations competed.

The render-side fix is to make the **visible mesh be the ECS entity**: one
source of truth. The attack-side fix is separate and lives in the native cursor
filter; see `HARTHMERE_NATIVE_CURSOR_ATTACK_TARGETING.md`.

## Attack Path Correction

The confirmed working attack path is:

1. `src/client/game/scripts/cursor.ts` ray-tests ECS entities and fills
   `cursor.attackableEntities`.
2. `src/client/game/interact/item_types/attack_destroy_delegate_item_spec.ts`
   uses `tryAttack(...)` only when that list is non-empty.
3. `src/client/game/interact/helpers.ts` publishes `UpdateNpcHealthEvent` or
   `UpdatePlayerHealthEvent`.

Muckers/hexes/animals were not only a render-position problem. The seeded
production live entities are real ECS entities with `position`, `size`,
`health`, `npc_metadata`, `npc_state`, and `collideable`. They were omitted by
`canAttackFilter(...)` because they reuse `dMucker`, whose Bikkie behavior has
`damageable.attackable: false`.

Current attack-specific changes:

- `melee_attack_region.ts`: Harthmere live-target labels/components override the
  legacy Bikkie `attackable:false` flag for real health-backed targets.
- `cursor.ts`: an attack-only `NpcMetadataSelector` ray fallback catches
  renderable NPCs that have `position + size` but are absent from
  `CollideableSelector`.

The renderer bridge and `window.__harthmereCombatActorPositions` are not the
primary fix for normal ECS targets. They are fallback/debug support only.

## How it works

### 1. ECS → renderer bridge (`src/shared/harthmere/live_creature_ecs_bridge.ts`)

Pure logic that identifies living NPC entities (`npc_metadata` + position +
alive, excluding robots/players/placeables), serializes each into a compact
record `{ id, at, yaw, family, asset, label, hp, maxHp }`, and reconciles a
rendered-id set against the latest records (`toAdd` / `toUpdate` / `toRemove`).

- Family is derived from `kind` / `combatKind` (`mux`/`hex`) / `species` / label
  (`live_creature_render.ts`).
- Asset: animals → `animal_<species>` (normalized to the procedural set);
  muck/hex/quest hostiles → `townsperson_undead`; town humans → a believable
  `townsperson_*` body variant chosen from the name, so the appearance system
  (which keys off asset + name) renders e.g. a guard, clergy or market-goer
  rather than a zombie.

### 2. Publisher script (`src/client/game/scripts/harthmere_live_creature_bridge_script.ts`)

The Harthmere renderer's `draw(scenes, dt)` has **no table access**, so this
client `Script` (registered in `scripts/init_renderer.ts`, which has the
`ClientTable`) scans `NpcMetadataSelector` a few times a second and publishes the
records to `window.__harthmereLiveCreatureEcsBridge`.

### 3. Renderer reconciliation (`harthmere_assets.ts`)

Each frame `reconcileHarthmereEcsLiveCreatures()` reads the bridge and:

- **adds** a mesh per new entity via the existing procedural-life machinery,
  keyed by `combatOffset = entity id` (so the combat-actor registry and native
  hit line up),
- **chases** each entity's authoritative position (lerp) on update,
- **disposes** meshes whose entity left the bridge (death / despawn / out of
  range).

Static `PLACEMENTS` creatures and town humans (`townsperson_*` and `animal_*`)
stay enabled by default as a stable fallback for Glitch/embed sessions where the
ECS bridge can be empty or stale. Those static actors now publish live-mode
target ids and visible world positions, so they are attackable through the
crosshair live-mode route even when their server seed is not co-located.

**Flag:** set `localStorage["biomes.localDev.harthmere.ecsCreatureRender"] = "0"`
to disable the ECS overlay entirely. Set
`localStorage["biomes.localDev.harthmere.suppressStaticLifeForEcs"] = "1"` only
when you explicitly want ECS-only rendering and can verify the bridge is stable.

### 4. Crosshair targeting (`src/client/components/challenges/harthmereCrosshairCombatTarget.ts`)

Crosshair screen targeting is a live-mode fallback/debug path for renderer-only
actors. It should not be treated as the primary fix for seeded ECS creatures.
For real ECS entities, the native cursor path in
`scripts/cursor.ts` + `melee_attack_region.ts` is the source of truth.

Use this path only when diagnosing install/embed mode or a renderer-only actor
that has no co-located ECS entity. Normal Harthmere muckers, hexes, animals,
robots, sentinels, bots, NPCs, and players should enter combat through
`cursor.attackableEntities` and the normal health events.

### 5. Random world spawns (`live_entity_production_seed.ts`)

`harthmereGroundedMuckMonsterSeedsInTerritory()` now spreads creatures
**deterministically at random** (mulberry32 seeded by `idOffset`) across **all**
non-safe muck regions of the world, instead of four hand-picked patches.
Invariants preserved (asserted by `live_entity_muck_monster_gating.test.ts`):
all creatures kept, none in a safe zone (the Grove/town), every one inside a real
muck area, spread across several non-Grove areas, and every default runtime spawn
uses the generated production terrain placement map's `outdoor_surface`
`recommendedPosition` instead of the flat local-dev fallback Y. The placement-map
builder calls the same seed function with `useProductionPlacementMap: false` so
new scans regenerate from deterministic authored X/Z positions rather than
reading their own generated output.

### 6. Respawn on death (30–60 min)

- `live_creature_render.ts` owns the timing (`harthmereLiveCreatureRespawnAt`
  → killedAt + random 30–60 min).
- `live_creature_respawn_registry.ts` records kills and reports which ids are
  still cooling down (`isSuppressed`). A process-wide shared registry is exposed
  via `harthmereSharedLiveCreatureRespawnRegistry()`.
- The seed reconciler `buildHarthmereLiveEntityProductionSeedChanges` takes an
  `isRespawnSuppressed(id)` hook and skips re-creating a recently-killed
  mucker/animal until its window elapses. Wired in `server/shim/main.ts`.

> **Remaining integration:** the combat death path must call
> `harthmereSharedLiveCreatureRespawnRegistry().recordKill(entityId, Date.now())`
> when a creature dies, so the suppression has kill times to act on. The
> suppression + timing + reconciler plumbing is in place and tested; this single
> call is the hook to add in the live-mode combat death reducer.

## Files

| File | Role |
| --- | --- |
| `shared/harthmere/live_creature_render.ts` | family mapping + respawn timing (pure) |
| `shared/harthmere/live_creature_ecs_bridge.ts` | entity → record, asset mapping, reconcile diff (pure) |
| `shared/harthmere/live_creature_respawn_registry.ts` | kill → respawn suppression registry |
| `client/game/scripts/harthmere_live_creature_bridge_script.ts` | publishes ECS creatures to the renderer bridge |
| `client/game/renderers/local_dev/harthmere_assets.ts` | reconciles ECS creature meshes; suppresses static life placements |
| `client/game/resources/melee_attack_region.ts` | native attackability filter, Harthmere live-target override, metadata ray fallback |
| `client/game/scripts/cursor.ts` | native cursor entity trace plus NPC metadata attack fallback |
| `client/components/challenges/harthmereCrosshairCombatTarget.ts` | live-mode crosshair fallback/debug targeting |
| `shared/harthmere/live_entity_production_seed.ts` | randomized world spawn distribution |
| `server/harthmere/live_entity_ecs_seed.ts` | respawn-suppression hook in the seed builder |
| `server/shim/main.ts` | wires the shared respawn registry into the reconciler |

## Tests

Pure unit tests (frontend/backend, no browser):

- `live_creature_render.test.ts` — 6
- `live_creature_ecs_bridge.test.ts` — 12
- `live_creature_respawn_registry.test.ts` — 5
- `live_entity_muck_monster_gating.test.ts` — 5 (spawn invariants preserved)
- `harthmereCrosshairCombatTarget.test.ts` — 8
- `melee_attack_region.test.ts` — native cursor attackability and metadata ray
  fallback coverage

Run a file: `node_modules/.bin/mocha --require ts-node/register --require
tsconfig-paths/register --extension ts <path>` (use **Node 20** per `.nvmrc`).

## Verification status

The native cursor attack fix was confirmed in-game after the filter correction.
Focused tests cover the `dMucker` `attackable:false` blocker and metadata ray
fallback. No live browser visual test was run, per instruction.

If a visible decorative static-only animal/undead still cannot be hit, first
check whether it has a real ECS entity at the same position. Native attacks
cannot damage a mesh that is only a renderer placement.
