# Harthmere Live-Creature ECS Render, Targeting, Spawns & Respawn (V1)

This document describes the system that makes every living thing in Harthmere —
muckers, hexes, animals, quest/escort/hired creatures, **and** town humans (the
Doc, the Chef, guards, merchants) — render on its real ECS entity so it is
**hittable**, **non-flickering**, randomly spread across the world, and
**respawns** after it is killed.

## The bug this fixes

Historically the creatures you saw were **client-side renderer meshes** drawn
from a static `PLACEMENTS` list in
`src/client/game/renderers/local_dev/harthmere_assets.ts`. Their server-side ECS
entities (seeded in `src/shared/harthmere/live_entity_production_seed_v1.ts`)
lived at *different* positions — muck monsters were deliberately relocated into
muck patches and out of the Grove. So:

- The native attack ray (`scripts/cursor.ts` → `traceEntities(table, …)`) only
  hits **ECS entities**. The visible mesh was not one, so left-click broke the
  voxel behind it but never damaged the creature.
- Robots were the exception: their ECS seed uses `position: [...area.anchor]` —
  the same anchor their mesh draws at — so they were co-located and hittable.
- Town NPCs that existed as **both** a static placement and a seeded ECS entity
  flickered as the two representations competed.

The fix is to make the **visible mesh be the ECS entity**: one source of truth.

## How it works

### 1. ECS → renderer bridge (`src/shared/harthmere/live_creature_ecs_bridge_v1.ts`)

Pure logic that identifies living NPC entities (`npc_metadata` + position +
alive, excluding robots/players/placeables), serializes each into a compact
record `{ id, at, yaw, family, asset, label, hp, maxHp }`, and reconciles a
rendered-id set against the latest records (`toAdd` / `toUpdate` / `toRemove`).

- Family is derived from `kind` / `combatKind` (`mux`/`hex`) / `species` / label
  (`live_creature_render_v1.ts`).
- Asset: animals → `animal_<species>` (normalized to the procedural set);
  muck/hex/quest hostiles → `townsperson_undead`; town humans → a believable
  `townsperson_*` body variant chosen from the name, so the appearance system
  (which keys off asset + name) renders e.g. a guard, clergy or market-goer
  rather than a zombie.

### 2. Publisher script (`src/client/game/scripts/harthmere_live_creature_bridge_script.ts`)

The Harthmere renderer's `draw(scenes, dt)` has **no table access**, so this
client `Script` (registered in `scripts/init_renderer.ts`, which has the
`ClientTable`) scans `NpcMetadataSelector` a few times a second and publishes the
records to `window.__harthmereLiveCreatureEcsBridgeV1`.

### 3. Renderer reconciliation (`harthmere_assets.ts`)

Each frame `reconcileHarthmereEcsLiveCreaturesV1()` reads the bridge and:

- **adds** a mesh per new entity via the existing procedural-life machinery,
  keyed by `combatOffset = entity id` (so the combat-actor registry and native
  hit line up),
- **chases** each entity's authoritative position (lerp) on update,
- **disposes** meshes whose entity left the bridge (death / despawn / out of
  range).

Static `PLACEMENTS` creatures and town humans (`townsperson_*` and `animal_*`)
are **suppressed** while ECS render is on, so the ECS mesh is the only copy — no
duplicates, no flicker.

**Flag:** set `localStorage["biomes.localDev.harthmere.ecsCreatureRender"] = "0"`
to fall back to the old static-only rendering (escape hatch).

### 4. Crosshair targeting (`src/client/components/challenges/harthmereCrosshairCombatTargetV1.ts`)

Left-click resolves the creature under the crosshair using the renderer's
camera-projected screen positions, independent of the fragile forward-arc
facing/origin runtime. (Primary path is now the native ray on the co-located
entity; this remains as a registry-based fallback.)

### 5. Random world spawns (`live_entity_production_seed_v1.ts`)

`harthmereGroundedMuckMonsterSeedsInTerritoryV1()` now spreads creatures
**deterministically at random** (mulberry32 seeded by `idOffset`) across **all**
non-safe muck regions of the world, instead of four hand-picked patches.
Invariants preserved (asserted by `live_entity_muck_monster_gating_v1.test.ts`):
all creatures kept, none in a safe zone (the Grove/town), every one inside a real
muck area, spread across several areas, finite Y (existing grounding kept — the Y
system is unchanged on purpose).

### 6. Respawn on death (30–60 min)

- `live_creature_render_v1.ts` owns the timing (`harthmereLiveCreatureRespawnAtV1`
  → killedAt + random 30–60 min).
- `live_creature_respawn_registry_v1.ts` records kills and reports which ids are
  still cooling down (`isSuppressed`). A process-wide shared registry is exposed
  via `harthmereSharedLiveCreatureRespawnRegistryV1()`.
- The seed reconciler `buildHarthmereLiveEntityProductionSeedChangesV1` takes an
  `isRespawnSuppressed(id)` hook and skips re-creating a recently-killed
  mucker/animal until its window elapses. Wired in `server/shim/main.ts`.

> **Remaining integration:** the combat death path must call
> `harthmereSharedLiveCreatureRespawnRegistryV1().recordKill(entityId, Date.now())`
> when a creature dies, so the suppression has kill times to act on. The
> suppression + timing + reconciler plumbing is in place and tested; this single
> call is the hook to add in the live-mode combat death reducer.

## Files

| File | Role |
| --- | --- |
| `shared/harthmere/live_creature_render_v1.ts` | family mapping + respawn timing (pure) |
| `shared/harthmere/live_creature_ecs_bridge_v1.ts` | entity → record, asset mapping, reconcile diff (pure) |
| `shared/harthmere/live_creature_respawn_registry_v1.ts` | kill → respawn suppression registry |
| `client/game/scripts/harthmere_live_creature_bridge_script.ts` | publishes ECS creatures to the renderer bridge |
| `client/game/renderers/local_dev/harthmere_assets.ts` | reconciles ECS creature meshes; suppresses static life placements |
| `client/components/challenges/harthmereCrosshairCombatTargetV1.ts` | crosshair targeting (fallback) |
| `shared/harthmere/live_entity_production_seed_v1.ts` | randomized world spawn distribution |
| `server/harthmere/live_entity_ecs_seed_v1.ts` | respawn-suppression hook in the seed builder |
| `server/shim/main.ts` | wires the shared respawn registry into the reconciler |

## Tests

Pure unit tests (frontend/backend, no browser):

- `live_creature_render_v1.test.ts` — 6
- `live_creature_ecs_bridge_v1.test.ts` — 12
- `live_creature_respawn_registry_v1.test.ts` — 5
- `live_entity_muck_monster_gating_v1.test.ts` — 5 (spawn invariants preserved)
- `harthmereCrosshairCombatTargetV1.test.ts` — 8

Run a file: `node_modules/.bin/mocha --require ts-node/register --require
tsconfig-paths/register --extension ts <path>` (use **Node 20** per `.nvmrc`).

## Verification status

Pure logic is unit-tested and green. The renderer reconciliation, publisher
script and seed/respawn wiring are type-simple and integrated against the real
APIs, but the end-to-end render/hit behaviour must be confirmed in a running
build (no live game in the authoring sandbox). No live browser test was run, per
instruction. If any decorative static-only NPC turns out to lack an ECS entity
and disappears, flip `ecsCreatureRender` to `0` and report which NPC so its seed
can be added.
