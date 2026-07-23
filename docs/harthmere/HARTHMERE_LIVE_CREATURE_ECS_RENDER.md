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
lived at _different_ positions — muck monsters were deliberately relocated into
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

### 5. Original-map danger spawns and Harthmere town animals (`live_entity_production_seed.ts`)

`harthmereGroundedMuckMonsterSeedsInTerritory()` now spreads creatures
**deterministically at random** (mulberry32 seeded by `idOffset`) across **all**
non-safe muck regions of the world, instead of four hand-picked patches.
The 16 guards belonging to the four guarded wildlife pockets are the deliberate
exception: they retain their authored local X/Z so each five-animal herd and its
three Muckers plus one Hex remain within one encounter-alert envelope instead
of being redistributed elsewhere on the map.
Invariants preserved (asserted by `live_entity_muck_monster_gating.test.ts`):
all creatures kept, none in a safe zone (the Grove/town), every one inside a real
muck area, and spread across several non-Grove areas. Existing creatures use
their exact generated production terrain placement-map `outdoor_surface`
coordinates. The new guarded pockets begin at production-scanned surface Y
anchors, then the mandatory deploy reconciler top-down probes and persists the
final full-footprint position before traffic promotion.
These 116 Muckers/Hexes and 44 Muck-area animals remain on the original map;
they are never shifted into the additive Harthmere town. A separate 12-animal
town herd (cows, sheep, rabbits) uses stable ids and the flat Harthmere feet
plane `Y=53`. The original-map total includes four new guarded wildlife
pockets containing 4 cows, 6 sheep, and 10 rabbits; each pocket has exactly 3
Muckers and 1 Hex. The placement-map builder calls the same seed function with
`useProductionPlacementMap: false` so new scans regenerate from deterministic
authored X/Z positions rather than reading their own generated output.

The deploy-time creature reconciler samples the final Redis terrain under the
entire body footprint. Original-map creatures are resolved by a top-down surface
probe so caves do not capture them; town animals use the known flat extension
surface. Both current position and `npc_metadata.spawn_position` are repaired
and read back before promotion. The same pass classifies native bandits by
coordinate space: road/camp bandits use original-map surface probing, while the
guarded Harthmere prisoner remains on the flat town extension.

### 5a. Mixed animal/Mucker/Hex group retaliation

Native Anima combat now treats a nearby cow, sheep, rabbit, Mucker, and Hex as a
local encounter group when one of them is actually damaged by a player. The
other eligible creatures acquire that same player through their ordinary
server-owned chase/attack state. The alert is deliberately bounded:

- direct hits still take priority over a shared alert;
- the source must carry a recent, negative `Health.lastDamageAmount` from a
  player `attack`, so healing, environment damage, zero-damage contact, and an
  already-alerted creature cannot recursively spread hostility;
- a one-hit kill still alerts survivors because the corpse retains its native
  damage metadata during the retaliation window;
- sources must be within 18 horizontal blocks, within 10 vertical blocks, and
  visible through terrain, preventing alerts across unrelated pockets, caves,
  cliffs, and sealed buildings;
- safe zones, peaceful/dead/out-of-leash players, pets/player-owned entities,
  robots, wards, quest givers, and unrelated NPC families are excluded;
- when several creatures are attacked, the newest valid hit wins, with stable
  distance/id tie-breaking so every server process chooses the same target.

This logic lives in `shared/npc/behavior/chase_attack.ts`, so the resulting
hostility, pathfinding, attacks, death, and respawn remain native ECS behavior
rather than a browser-only or private live-mode simulation.

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

| File                                                             | Role                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `shared/harthmere/live_creature_render.ts`                       | family mapping + respawn timing (pure)                                             |
| `shared/harthmere/live_creature_ecs_bridge.ts`                   | entity → record, asset mapping, reconcile diff (pure)                              |
| `shared/harthmere/live_creature_respawn_registry.ts`             | kill → respawn suppression registry                                                |
| `client/game/scripts/harthmere_live_creature_bridge_script.ts`   | publishes ECS creatures to the renderer bridge                                     |
| `client/game/renderers/local_dev/harthmere_assets.ts`            | reconciles ECS creature meshes; suppresses static life placements                  |
| `client/game/resources/melee_attack_region.ts`                   | native attackability filter, Harthmere live-target override, metadata ray fallback |
| `client/game/scripts/cursor.ts`                                  | native cursor entity trace plus NPC metadata attack fallback                       |
| `client/components/challenges/harthmereCrosshairCombatTarget.ts` | live-mode crosshair fallback/debug targeting                                       |
| `shared/harthmere/live_entity_production_seed.ts`                | randomized world spawn distribution                                                |
| `server/harthmere/live_entity_ecs_seed.ts`                       | respawn-suppression hook in the seed builder                                       |
| `server/shim/main.ts`                                            | wires the shared respawn registry into the reconciler                              |

## Tests

Pure unit tests (frontend/backend, no browser):

- `live_creature_render.test.ts` — 6
- `live_creature_ecs_bridge.test.ts` — 12
- `live_creature_respawn_registry.test.ts` — 5
- `live_entity_muck_monster_gating.test.ts` — original-map spawn, safe-zone,
  Muck-territory, distribution, and varied-elevation invariants
- `npc/behavior/test/chase_attack_logic.test.ts` — mixed creature group-alert
  acquisition, one-hit-kill response, deterministic multi-attacker selection,
  and every safe/distance/ownership/damage exclusion
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
