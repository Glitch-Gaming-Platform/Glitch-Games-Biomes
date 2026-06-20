# Harthmere Production Terrain Placement Map V1

This is the current source of truth for placing Harthmere quest items, quest
markers, monsters, NPCs, interactables, and random spawn pools on real
production terrain.

Use it whenever code needs to answer this question:

```text
Given this authored X/Z, what Y should the thing actually use in production?
```

Do not trust authored `y=0`, local-dev `localDevTerrainHeight()`, screenshot
coordinates, one-off constants such as `y=54`, or older per-cluster anchor
tables for new quest/object/monster placement. Production terrain is uneven,
has roofs and indoor floors, contains cave floors under outdoor surfaces, and
can differ from local authored terrain.

## Files

| Purpose | File |
|---|---|
| Runtime resolver API | `src/shared/harthmere/production_terrain_placement_map_v1.ts` |
| Generated TypeScript map used by runtime code | `src/shared/harthmere/generated/production_terrain_placement_map_v1.ts` |
| Full local scan artifact with extra rows/stats | `artifacts/harthmere-production-placement-map-v1/placement-map.json` |
| Read-only production scanner | `scripts/harthmere/build-production-terrain-placement-map-v1.cjs` |
| Wiring/check script | `scripts/harthmere/check-harthmere-production-placement-map-v1.cjs` |

The generated TypeScript file is intentionally checked in with the runtime
code path. The JSON artifact is larger and includes extra diagnostic data such
as sampled surface rows.

## Current Scan

The current map was generated from production revision
`biomes-node-vnet--0000099`, image
`glitchgames.azurecr.io/biomes-node:prod-20260606063539`, at
`2026-06-07T01:45:42.110Z`.

It scanned the production terrain shards read-only and produced:

- `1,446` placement records
- `48` cave/hollow clusters
- `256` outdoor spawn points
- `31,736` cave floor samples
- `6` fallback placements

The fallback placements are high-vault exotic-matter deposits where the exact
authored column did not resolve to a better cave floor. Treat any new fallback
as something to inspect before shipping.

## Regenerating

Run from the repo root after logging into the production Azure subscription:

```bash
az account show

NODE_OPTIONS=--max-old-space-size=8192 \
node scripts/harthmere/build-production-terrain-placement-map-v1.cjs \
  --write \
  --stride=8 \
  --margin=64

node scripts/harthmere/check-harthmere-production-placement-map-v1.cjs
```

The scanner is read-only against production. It uses:

- `az account show` to record the subscription
- `az containerapp show` for the exact deployed Container App revision/image
- Redis `mget` reads for terrain shard entities

It writes only local files when `--write` is present. It must not seed,
overwrite, or rebuild production terrain.

Useful overrides:

```bash
AZURE_RESOURCE_GROUP=openai-resource-group
AZURE_CONTAINER_APP=biomes-node-vnet
HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12
PROD_REDIS_PORT=6379
HARTHMERE_PLACEMENT_MAP_STRIDE=8
HARTHMERE_PLACEMENT_MAP_MARGIN=64
```

Run this scanner only from an Azure/VNet host that can reach private Redis.
Production Redis `6379` must not be reopened to the public internet for terrain
map generation.

Use a smaller stride only when you need a denser diagnostic pass and can afford
the scan time. Keep the checked-in map at the agreed stride unless you are
intentionally changing the data contract.

## What The Map Contains

Each placement record has:

- `authoredPosition`: the source coordinate from quest/business/NPC/content data
- `worldPosition`: authored position after the Harthmere authored-to-world shift
- `recommendedPosition`: the final placement position code should use
- `placementMode`: why that Y was chosen
- `surfaceFeetY`, `nearestFeetY`, and `caveFeetYs` when available
- `caveId` for placements tied to a detected hollow/cave

Placement modes:

| Mode | Use |
|---|---|
| `outdoor_surface` | Outdoor quest markers, monsters, items, and map pins that must be visible from above ground |
| `indoor_or_cave_floor` | Roofed, indoor, or non-open-sky floor placement where open-sky grounding would snap to a roof |
| `cave_spawn` | Explicit underground/cave content |
| `fallback_authored_y` | No production record was generated; inspect before relying on it |

Cave records include bounds, floor/ceiling ranges, entrance candidates, and
spawn points. A cave is detected as an empty interior/hollow with a floor,
clearance, and surrounding voxel structure; the cave spawn points are scored
from those samples.

Outdoor spawn points are open-sky surface points intended for deterministic
random placement of monsters, quest items, and temporary interactions.

## Runtime API

Prefer these helpers instead of reading the generated object directly:

```ts
import {
  chooseHarthmereQuestCaveSpawnPointV1,
  chooseHarthmereQuestOutdoorSpawnPointV1,
  chooseHarthmereQuestPlacementPositionV1,
  resolveHarthmereProductionMarkerPositionV1,
  resolveHarthmereQuestObjectivePlacementV1,
} from "@/shared/harthmere/production_terrain_placement_map_v1";
```

Use `resolveHarthmereQuestObjectivePlacementV1` for fixed quest objectives.
It looks for an exact quest/objective placement first, then falls back to the
quest location record, then returns a `fallback_authored_y` record if the map
does not know the coordinate.

Use `resolveHarthmereProductionMarkerPositionV1` for jobs-board markers,
business markers, helper landmarks, and other shared marker ids.

Use `chooseHarthmereQuestOutdoorSpawnPointV1` or
`chooseHarthmereQuestPlacementPositionV1({ mode: "outdoor" })` for random
above-ground placement.

Use `chooseHarthmereQuestCaveSpawnPointV1` or
`chooseHarthmereQuestPlacementPositionV1({ mode: "cave" })` for random cave
placement.

## Correct Placement Rules

For outdoor items and monsters:

- Use an `outdoor_surface` record or an outdoor spawn point.
- Require open sky so the object does not land on a cave floor below the real
  surface.
- Do not use cave floors for an outdoor task just because the cave floor is
  closer to the authored `y`.
- Live muckers, hexes, and muck-area livestock should come from
  `harthmereGroundedMuckMonsterSeedsInTerritoryV1()` or
  `harthmereGroundedLivestockSeedsInTerritoryV1()`. Runtime/default callers use
  each seed's generated `live_muck_monster:*` or `live_livestock:*`
  `recommendedPosition`; the placement-map builder passes
  `useProductionPlacementMap: false` while regenerating the map.
- Keep the Grove/town-safe `road_muckwad_patch` out of runtime ambient
  distribution. It overlaps safe areas, so it is not a valid live mucker
  destination even though it is a named muck patch.

For cave items and monsters:

- Use a `cave_spawn` record or a cave spawn point.
- Keep the target underground when the quest says underground.
- Do not run open-sky outdoor grounding on cave content.

For indoor businesses, owners, customers, and roofed service points:

- Use `indoor_or_cave_floor` records or the existing business/runtime marker
  helpers.
- Do not require open sky; that can snap a counter, owner, or customer to the
  roof instead of the walkable floor.

For fixed quest objectives:

- Let quest runtime shift authored coordinates to world coordinates and resolve
  them through the placement map.
- Use `getHarthmereQuestResolvedWaypointV47` from
  `src/shared/harthmere/quest_runtime_v47.ts` when code already deals with
  runtime quest waypoints.
- Do not shift a coordinate twice.

For random quest placement:

- Use stable seeds such as quest id, objective id, area id, and player/group id.
- Choose from the generated spawn pool rather than rolling a random X/Z and
  hoping the local terrain helper can repair it.

## BiomesUI Map, HUD, and Quest Pointer

All player-facing surfaces must point at the same `recommendedPosition`.

BiomesUI Map:

- Jobs-board quest markers should come through
  `harthmereJobsBoardQuestMarkerRuntimePositionForTodoV1`.
- Business markers should come through `harthmereBusinessMapMarkersV1`, which
  resolves backend business positions through the production marker map.
- Live helper landmarks should resolve through
  `resolveHarthmereProductionMarkerPositionV1`.
- Do not hand-place a map percentage when a world position exists.

HUD and minimap:

- HUD/minimap pins should consume the same resolved world marker records as the
  BiomesUI map.
- The HUD may project or clamp screen/minimap coordinates, but it should not
  choose an independent terrain Y.

Quest pointer and active destination:

- Active pins should be created from resolved marker/world positions.
- `mapPinnedDestination.ts` should remain the bridge from a marker id to the
  resolved production position.
- Do not maintain a separate quest-pointer target if the map marker already has
  a resolved world coordinate.

3D in-world markers:

- 3D quest/item markers should use the same runtime-resolved positions as the
  map and HUD.
- A live client grounder may still be used as a final visual safety layer, but
  the authored hint should come from this map.

## Adding Or Moving A Quest Target

1. Add or update the quest/objective authored coordinate in the shared quest
   source.
2. Regenerate the production terrain placement map from production.
3. Confirm the new record has a non-fallback `placementMode`.
4. Wire gameplay, BiomesUI map, HUD/minimap, and active destination to the
   resolver instead of copying coordinates.
5. Run:

```bash
node scripts/harthmere/check-harthmere-production-placement-map-v1.cjs
git diff --check
```

If a quest item still appears invisible, buried, or floating, debug the
generated record first:

- Is the record missing?
- Did the code use `authoredPosition` instead of `recommendedPosition`?
- Did the caller shift authored coordinates twice?
- Did outdoor content use a cave spawn?
- Did indoor/cave content get forced to open sky?
- Does the active map pin point somewhere different from the 3D object?

## Do Not Do This

- Do not fix one bad item by adding a magic `+1`, `-17`, `y=54`, or `y=70`.
- Do not move only the BiomesUI marker while leaving the 3D marker or server
  authority at the old coordinate.
- Do not use Redis runtime entity positions as canonical authored placement.
- Do not make a new per-quest terrain workaround when a generated placement
  record can cover the whole class of bugs.
- Do not regenerate from local terrain and call it production-safe.
