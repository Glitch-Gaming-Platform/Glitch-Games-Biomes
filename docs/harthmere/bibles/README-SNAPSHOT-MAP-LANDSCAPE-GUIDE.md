# Snapshot Map, Landscape, Water, and World-Building Guide

This guide exists because the May 2026 Biomes snapshot draws the world better than the current Harthmere/Hawthorne local-dev town path. The snapshot has stronger geography, water, fountains, trees, grass, mountains, maps, safe zones, music, and overall world feel because it treats the world as canonical data first, then derives rendering, map tiles, collision, audio, and labels from that data.

The rule for future developers and AI agents is simple:

> Build the world as real Biomes world data. Do not fake the world with client-only meshes unless the mesh is decorative and backed by canonical terrain/entity data.

---

## 1. Snapshot architecture at a glance

The snapshot experience is not one renderer trick. It is a full pipeline:

```text
snapshot_backup.json
public/buckets/biomes-static/
public/buckets/biomes-bikkie/
        |
        v
ECS terrain shard entities + Bikkie item/asset definitions
        |
        +--> shared terrain/water/resources
        |        |
        |        +--> client terrain renderer
        |        +--> client water renderer/shader/pass
        |        +--> client collision/pathing helpers
        |
        +--> server map tile generator
        |        |
        |        +--> height tiles
        |        +--> material tiles
        |        +--> lighting tiles
        |        +--> surface/fog map tiles
        |
        +--> labels, landmarks, mailboxes, safe/protected regions
        |
        +--> audio manager/environment music
```

This is why the snapshot feels coherent. Runtime visuals, minimap, water, collision, NPC placement, map labels, and music all read from the same underlying world state.

---

## 2. Non-negotiable implementation rules

### Rule 1 — Snapshot is the base world

The full snapshot should be installed as the canonical base data:

```text
snapshot_backup.json
public/buckets/biomes-static/
public/buckets/biomes-bikkie/
```

Do not treat `biomes-static` alone as the world. The static bucket supplies assets, hashes, map textures, models, audio, and generated data, but the world itself comes from snapshot ECS data and Bikkie.

### Rule 2 — Harthmere/Hawthorne is an additive extra town

The current local-dev town must not be the default start world. It should be opt-in and offset away from the snapshot start.

Recommended modes:

```bash
# Snapshot-only boot.
SKIP_PROD_LOAD=true \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 \
BIOMES_START_IN_HARTHMERE=0 \
./b data-snapshot run --no-pip-install

# Snapshot plus shifted Harthmere extra town.
SKIP_PROD_LOAD=true \
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
BIOMES_START_IN_HARTHMERE=0 \
./b data-snapshot run --no-pip-install
```

Avoid this after the real snapshot boots:

```bash
BIOMES_FORCE_LOCAL_DEV_TOWN=1
```

That flag was useful before the real snapshot existed locally. After the snapshot is installed, forcing local-dev terrain can overlay or duplicate terrain in the snapshot start area.

### Rule 3 — If players can stand on it, collide with it, climb it, harvest it, or see it on the map, it must be canonical data

Use real terrain/entity data for:

- ground
- mountains
- roads
- walls
- bridges
- stairs
- roofs players can stand on
- balconies
- fountains with water
- trees and dense grass that affect map readability
- safe/protected zones
- landmarks and labels
- quest/NPC anchors

Client-only GLTF/FBX/OBJ assets are acceptable only for decoration after the canonical world layer already exists.

---

## 3. Important snapshot assets and buckets

The inspected snapshot static bucket contains generated asset categories used by the world and map pipeline:

```text
public/buckets/biomes-static/asset_data/
  atlases/
  audio/
  gaia/
  icons/
  indices/
  item_meshes/
  mapping/
  npcs/
  placeables/
  shapers/
  textures/
  wearables/
```

Important categories:

| Category | Purpose |
|---|---|
| `indices/blocks` | Block/material IDs used by terrain tensors. |
| `indices/florae` | Grass, flowers, leaves, trees, and flora material IDs. |
| `indices/glass` | Transparent/glass material IDs. |
| `indices/groups` | Grouped voxel assets. |
| `indices/shapes` | Shape IDs for stairs, slabs, ramps, and non-cube terrain shapes. |
| `mapping/index` | Texture mapping used by generated world-map tiles. |
| `textures/water_normals` | Animated water normal map used by the water shader. |
| `textures/water_distortion` | Water distortion texture used by the water shader. |
| `gaia/water_*` | Generated water simulation/terrain data. |
| `audio/*` | Background music, muck music, splash, footsteps, impacts, and placeable sounds. |
| `placeables/*` | GLTF/GLB assets for placeable entities. |
| `npcs/*` | NPC meshes/animations. |

If `asset_versions.json` does not match these generated files, asset resolution fails. When using the May 2026 snapshot bucket, the matching snapshot `asset_versions.json` must be used.

---

## 4. Core terrain data model

The snapshot world is built from terrain shard entities. The key components are:

| Component | Purpose |
|---|---|
| `box` | World-space shard bounds. |
| `shard_seed` | Base terrain seed tensor for the shard. |
| `shard_diff` | Terrain edits/deltas applied on top of the seed. |
| `shard_shapes` | Shape tensor for stairs, ramps, slabs, and non-full-cube geometry. |
| `shard_water` | Water tensor. Required for real water rendering and map water. |
| `shard_muck` | Muck/fog/environment tensor. Affects map and music. |
| `shard_dye` | Dye/color override tensor. Affects map coloration. |
| `shard_growth` | Growth state for flora/farming. |
| `shard_moisture` | Moisture state for farming/ground behavior. |
| `shard_irradiance` | Lighting data. |
| `shard_sky_occlusion` | Sky/light occlusion. |
| `shard_occupancy` | Entity/block occupancy. |
| `shard_placer` | Placement/entity relationship data. |

The snapshot wins because terrain, water, map, collision, and audio are derived from these components instead of being manually duplicated across unrelated systems.

---

## 5. Function-level reference: terrain and geography

### Shared low-level terrain loaders

File:

```text
src/shared/game/terrain.ts
```

Important functions:

| Function | What it does |
|---|---|
| `loadSeed` | Loads the base terrain seed tensor. |
| `loadDiff` | Loads terrain edit/diff tensor. |
| `loadShapes` | Loads terrain shape tensor. |
| `loadTerrain` | Loads seed, applies diff, and returns the effective terrain tensor. |
| `loadWater` | Loads water tensor. |
| `loadMuck` | Loads muck tensor. |
| `loadDye` | Loads dye tensor. |
| `loadGrowth` | Loads flora/growth tensor. |
| `loadMoisture` | Loads moisture tensor. |
| `loadSkyOcclusion` | Loads sky occlusion. |
| `loadIrradiance` | Loads lighting/irradiance. |

Implementation pattern:

```text
seed + diff + shapes + water + muck + dye + growth + light = real world shard
```

Do not add a new region by only adding meshes to the client renderer. Add or generate the terrain shard data first.

### Shared terrain resource graph

File:

```text
src/shared/game/resources/terrain.ts
```

Important resources and functions:

| Resource/function | Purpose |
|---|---|
| `/terrain/volume` | Effective terrain volume after applying seed and edits. |
| `/terrain/tensor` | Tensor form used by render/path/collision systems. |
| `/terrain/boxes` | Collidable box output from terrain. |
| `/terrain/occupancy` | Entity occupancy information. |
| `/terrain/placer` | Placement relationship data. |
| `/terrain/farming` | Farming-related terrain data. |
| `/terrain/growth` | Growth state. |
| `/terrain/dye` | Dye state. |
| `/terrain/moisture` | Moisture state. |
| `/terrain/muck` | Muck/environment state. |
| `/terrain/pathfinding/human_can_occupy` | Occupancy rules for human pathing. |
| `genTerrainVolume` | Loads seed and applies edits/eager edits. |
| `genTerrainTensor` | Converts volume to tensor. |
| `genTerrainBoxes` | Generates terrain collision boxes. |

Pattern to copy:

1. Make terrain data canonical.
2. Let the resource graph derive collision, occupancy, rendering, and pathing.
3. Do not manually duplicate collision boxes for every visible block unless the object is a non-terrain entity.

### Terrain helper

File:

```text
src/shared/game/terrain_helper.ts
```

Important methods:

| Method | Purpose |
|---|---|
| `getBlockID` | Reads block material at a world position. |
| `getFloraID` | Reads flora material at a world position. |
| `getGlassID` | Reads glass material at a world position. |
| `getWater` | Reads water at a world position. |
| `getMuck` | Reads muck at a world position. |
| `getDye` | Reads dye/color override at a world position. |
| `getPeakLight` | Reads lighting information. |
| `iterTerrain` | Iterates terrain content. |
| `isMucky` | Converts muck value into rendered/map muck behavior with dithering. |

Pattern to copy:

Use `TerrainHelper`-style composition whenever new features need to read multiple terrain layers together. Fountains, swamp zones, safe zones, bridges, quest regions, map tiles, and sound triggers should read from the world state, not from hardcoded local render state.

---

## 6. Function-level reference: client terrain rendering

### Terrain renderer

File:

```text
src/client/game/renderers/terrain.ts
```

Important class/functionality:

| Class/functionality | Purpose |
|---|---|
| `TerrainRenderer` | Main runtime terrain renderer. |
| `voxeloo.FrustumSharder` | Chooses shards visible to the camera. |
| `voxeloo.VisibilitySharder` | Adds occlusion/visibility logic. |
| `TerrainResourceLimiter` | Prevents resource overload while loading terrain. |
| `/terrain/combined_mesh` | Combined block/glass/flora/water meshes for a shard. |

The renderer adds different terrain layers to different render scenes:

| Layer | Scene behavior |
|---|---|
| blocks | Base opaque scene. |
| flora | Base scene, but generated separately. |
| glass | Translucent scene. |
| water | Water scene/pass. |

Pattern to copy:

Do not mix every landscape feature into one giant GLTF. The snapshot separates world layers so each can render correctly, stream correctly, and appear on the map correctly.

### Combined terrain mesh resources

Files:

```text
src/client/game/resources/terrain.ts
src/client/game/resources/terrain_meshes.ts
```

Important output:

```text
[blockMesh, glassMesh, floraMesh, waterMesh]
```

Pattern to copy:

A feature belongs in the layer that matches its behavior:

| Feature | Correct layer |
|---|---|
| stone path | block terrain |
| grass | flora terrain |
| tree canopy | flora/leaf terrain or canonical tree entity |
| window/glass | glass terrain or placeable glass entity |
| lake/fountain water | water tensor and water mesh |
| stairs | terrain block + shape tensor |
| bridge deck | block terrain/shape terrain, not only GLTF |

---

## 7. Function-level reference: water

Water is one of the snapshot's strongest systems. It is not just a blue mesh.

### Shared water resources

File:

```text
src/shared/game/resources/water.ts
```

Important resources:

| Resource | Purpose |
|---|---|
| `/water/tensor` | Water tensor for a shard. |
| `/water/boxes` | Box representation of water volumes. |

Important functions:

| Function | Purpose |
|---|---|
| `genWaterTensor` | Loads `shard_water`. |
| `genWaterBoxes` | Converts water tensor into water boxes. |

### Client water resources

File:

```text
src/client/game/resources/water.ts
```

Important functions:

| Function | Purpose |
|---|---|
| `genWaterTexture` | Loads `textures/water_normals` and `textures/water_distortion`. |
| `genWaterMesh` | Generates renderable water surface geometry. |
| `genWaterDebugMesh` | Debug rendering for water sources. |

`genWaterMesh` composes:

```text
/water/tensor
/water/texture
/terrain/muck
neighbor terrain
neighbor water
lighting buffer
material buffer
water material
```

Then it calls Voxeloo helpers similar to:

```text
voxeloo.toWaterSurface
voxeloo.toWaterGeometry
voxeloo.toWaterLightingBuffer
voxeloo.toWaterMaterialBuffer
```

### Water render pass and shaders

Files:

```text
src/client/game/renderers/passes/scene_water_pass.ts
src/client/game/shaders/water.fs
src/client/game/shaders/water.vs
```

The shader/pass handles:

- animated normal map octaves
- distortion
- depth-based foam
- fresnel/reflection feel
- underwater behavior
- fog blending
- muckiness
- transparent depth-aware rendering

Pattern to copy for fountains, lakes, rivers, canals, and ponds:

1. Put actual water into `shard_water`.
2. Build basin/edge/stonework from terrain blocks and shapes.
3. Let `/water/tensor` and `/water/mesh` generate the surface.
4. Let map tiles read water from the same `shard_water` data.
5. Add optional placeable decoration or looping fountain audio only after the canonical water exists.

Do not make a fountain by placing only a blue GLTF plane. That will not render, collide, sound, or map like snapshot water.

---

## 8. Function-level reference: world map and minimap

The snapshot map is generated from real terrain, water, muck, dye, flora, height, and lighting. This is the pattern Harthmere should copy.

### Server world bounds and shard access

File:

```text
src/server/map/world.ts
```

Important functions/classes:

| Function/class | Purpose |
|---|---|
| `WorldHelperImpl.getWorldBounds()` | Scans terrain shards and computes world bounds. |
| `getTerrainShard(pos)` | Fetches the terrain shard for a world position. |
| `MAP_WORLD_KEY = "alpha"` | Key used for the world map. |

Pattern:

The map should discover the world from terrain shard entities. If a new town does not have real terrain shards, it will not naturally become part of the real map.

### Map invalidation and tile generation pipeline

File:

```text
src/server/map/pipeline.ts
```

Important pieces:

| Name | Purpose |
|---|---|
| `TILE_FLAVORS = ["surface", "fog"]` | Two generated map tile layers. |
| `affectsMap(delta)` | Decides whether an ECS change invalidates map tiles. |
| `start()` | Schedules initial world tile work. |
| `tick()` | Handles invalidation, priorities, tile generation, and storage. |

`affectsMap(delta)` watches these components:

```text
shard_seed
shard_diff
shard_dye
shard_water
shard_muck
```

Pattern:

If a new landscape feature should appear on the map, it must affect one of the map-relevant world layers.

### Map tile terrain inputs

File:

```text
src/server/map/tiles/terrain.ts
```

Important functions:

| Function | Purpose |
|---|---|
| `genWorldTerrain` | Samples effective terrain by world position. |
| `genWorldWater` | Samples water by world position. |
| `genWorldMuck` | Samples muck by world position. |
| `genWorldDye` | Samples dye by world position. |
| `makeTerrainHelper` | Composes the terrain helper used by tile generation. |

### Height, material, color, lighting, and final tile render

Files:

```text
src/server/map/tiles/heights.ts
src/server/map/tiles/materials.ts
src/server/map/tiles/colors.ts
src/server/map/tiles/lighting.ts
src/server/map/tiles/surface.ts
src/server/map/tiles/fog.ts
src/server/map/tiles/textures.ts
src/server/map/tiles/config.ts
```

Important steps:

| Step | File | Purpose |
|---|---|---|
| Height sampling | `heights.ts` | Finds top block/flora/water/muck heights. |
| Material sampling | `materials.ts` | Finds visible top material IDs. |
| Texture lookup | `textures.ts` | Loads map texture index from `mapping/index`. |
| Color mapping | `colors.ts` | Converts material IDs into map colors. |
| Lighting | `lighting.ts` | Generates shadow/ambient occlusion. |
| Surface render | `surface.ts` | Blends block, flora, lighting, and water. |
| Fog/muck render | `fog.ts` | Blends muck/fog layer, with road behavior. |
| Flora filtering | `config.ts` | Controls which flora reads as canopy/leaf coverage. |

Pattern:

The map is not a separate drawing. It is a derived image of the real world.

### Client map UI

Files:

```text
src/client/components/map/helpers.tsx
src/client/components/map/pannable/PannableMapTiles.tsx
src/client/util/map_hooks.ts
src/pages/api/world_map/metadata.ts
src/pages/api/world_map/landmarks.ts
src/pages/api/world_map/mailboxes.ts
src/server/web/db/map.ts
src/shared/map/paths.ts
```

Important functions/patterns:

| Function/file | Purpose |
|---|---|
| `worldToPannableMapCoordinates` | Converts world coordinates to map coordinates. |
| `mapTileURL` | Builds map tile URL using version metadata. |
| `useLandmarks` | Loads map landmarks. |
| `useMailboxes` | Loads mailbox markers. |
| `/api/world_map/metadata` | Provides map tile metadata/version index. |
| `/api/world_map/landmarks` | Returns landmark labels from entities. |
| `tileURL` | Points map tiles to `biomes-static`. |

Pattern:

Landmarks and labels should come from entities/components. Do not hardcode a town label in the React map unless it is only temporary debug UI.

---

## 9. Function-level reference: music, environment, and sound

The snapshot's music/environment feel is tied to runtime environment state.

### Audio manager

File:

```text
src/client/game/context_managers/audio_manager.ts
```

Important behavior:

| Behavior | Purpose |
|---|---|
| Prefetch audio | Avoids delayed playback. |
| `start()` | Starts background music. |
| `setBackgroundMusicTrack()` | Crossfades between music tracks. |
| `setBackgroundMusicEffect("water")` | Applies underwater/lowpass style effect. |
| `setBackgroundMusicEffect("none")` | Restores normal sound. |
| Positional media attenuation | Ducks/attenuates music near positional media. |

### Audio script

File:

```text
src/client/game/scripts/audio.ts
```

The script reads camera/player environment:

```text
/camera/environment
  inWater
  muckyness
```

Then it switches/effects music:

| Environment | Audio behavior |
|---|---|
| normal | background `music` |
| muck | `muck_music` |
| underwater | water effect/lowpass |

Pattern:

Do not hardcode town music only by player coordinate unless there is no better world signal. Prefer environment state, biome/region state, protection zone, landmark/town zone, or quest state that can be debugged and reproduced.

### Positional placeable audio

File:

```text
src/client/game/resources/placeables/placeables.ts
```

Some placeables can emit positional looping audio. Use this for fountains, machines, arcade/disco objects, torches, fires, magical objects, or town ambience. Keep it tied to canonical entities/placeables.

---

## 10. What the current Harthmere/Hawthorne path does differently

The inspected Glitch repo contains a local-dev terrain generator and a client-side Harthmere asset renderer.

Important files:

```text
src/server/shim/main.ts
src/client/game/renderers/local_dev/harthmere_assets.ts
src/shared/harthmere/town_registry.ts
src/shared/harthmere/town_routes.ts
src/shared/harthmere/town_schedules.ts
src/shared/harthmere/town_map.ts
```

Current pattern:

1. `src/server/shim/main.ts` can procedurally seed a flat/local terrain area.
2. It uses local-dev constants such as a starter ground Y and spawn around Harthmere coordinates.
3. It creates block terrain, some structures, roads, farms, trees, and NPC changes.
4. `harthmere_assets.ts` places many runtime GLTF/FBX/OBJ assets from `/assets/harthmere`.
5. Supporting Harthmere files add routes, schedules, housing, registry metadata, and map references.

This works for rapid local-dev iteration, but it does not automatically match snapshot quality because it can split truth across:

```text
server terrain generator
client runtime asset placement
NPC route files
quest files
town registry files
map files
collision metadata
```

That split is exactly where drift happens: wrong NPC positions, routes offset differently than buildings, map not matching world, invisible collision gaps, or beautiful meshes that are not real gameplay terrain.

### Correct direction for Harthmere

Keep Harthmere, but migrate it toward the snapshot pattern:

1. Generate or author canonical terrain shard data.
2. Use terrain shapes for stairs, ramps, bridges, roofs, and balconies.
3. Use `shard_water` for fountains, ponds, wells, canals, and rivers.
4. Use flora terrain/entity data for grass, trees, shrubs, and canopy.
5. Use landmarks/components for map labels.
6. Use protected/safe-zone components for safe zones.
7. Use placeables only for decorative detail, not structural truth.
8. Offset every Harthmere coordinate through one shared transform.

---

## 11. Correct recipe for adding a new landscape/town region

### Step 1 — Pick a shard-aligned world region

Pick an origin and keep it away from the snapshot start. Use a shared transform for all authored coordinates.

Recommended pattern:

```ts
const HARTHMERE_EXTRA_TOWN_OFFSET = { x: 2048, y: 0, z: 0 };

function authoredToWorld([x, y, z]: Vec3): Vec3 {
  return [x + HARTHMERE_EXTRA_TOWN_OFFSET.x, y, z + HARTHMERE_EXTRA_TOWN_OFFSET.z];
}
```

Rules:

- Do not manually add `+2048` throughout the codebase.
- Do not apply the offset twice.
- NPCs, routes, quests, buildings, map markers, safe zones, and client decorations must all use the same transform.

### Step 2 — Build terrain first

For each terrain shard:

1. Define the shard `box`.
2. Populate `shard_seed` or terrain volume.
3. Apply edits into `shard_diff`.
4. Populate `shard_shapes` for stairs, slopes, roofs, slabs, and bridges.
5. Populate water/muck/dye/growth/moisture/light when relevant.

Minimum acceptable structural data for a real area:

```text
box
shard_seed
shard_diff
shard_shapes
```

Better snapshot-quality data:

```text
box
shard_seed
shard_diff
shard_shapes
shard_water
shard_muck
shard_dye
shard_growth
shard_moisture
shard_irradiance
shard_sky_occlusion
shard_occupancy
shard_placer
```

### Step 3 — Add terrain layers by behavior

| Feature | Recommended data layer |
|---|---|
| ground | block terrain seed/diff |
| cliffs/mountains | block terrain seed/diff with height variation |
| caves/cutouts | terrain edits/diff |
| grass | flora IDs / growth |
| dense trees | flora/tree data and/or canonical tree entities |
| stone roads | block terrain with road material |
| stairs | block terrain + `shard_shapes` |
| bridge decks | block terrain + shapes/collision |
| parapets | block terrain or canonical placeables with collision |
| fountain basin | block terrain + shapes |
| fountain water | `shard_water` |
| swamp/fog/muck | `shard_muck` |
| painted zones | `shard_dye` |
| decorative signs | placeable entities with valid `galoisPath` |
| town labels | landmark components/API |
| protected/safe region | protection/safe-zone components |
| local ambience | audio environment or positional placeable audio |

### Step 4 — Add buildings correctly

Buildings should have a canonical solid core.

Use terrain blocks/shapes for:

- foundation
- floors
- walls
- ceilings
- roofs players can stand on
- stairs
- balconies
- parapets
- collision-critical railings

Use placeables/meshes for:

- signs
- banners
- doors if they are actual interactive entities
- small props
- lights
- decorative roof caps
- furniture
- non-structural trim

Do not build a walkable house as a floating GLTF shell with no terrain/collision truth.

### Step 5 — Add stairs, ramps, balconies, and multi-level spaces

Use `shard_shapes`/shape IDs instead of only stacking cubes where possible.

Correct approach:

```text
terrain block material + shape id + collision boxes generated from terrain
```

Checklist:

- Player can walk up/down without jumping awkwardly.
- NPC pathing sees a valid route.
- Collision boxes match the visible shape.
- Map top surface reads correctly.
- Multi-level floors are separate solid walkable surfaces.
- Balcony supports are not just decorative if the player can stand on them.

### Step 6 — Add real water

For fountains/lakes/rivers:

1. Build basin/riverbed/shore out of terrain blocks.
2. Add water to `shard_water`.
3. Confirm `/water/tensor` is non-empty for the shard.
4. Confirm water appears in runtime water pass.
5. Confirm water appears in generated map tiles.
6. Add optional looping fountain/waterfall positional audio.

Avoid fake water planes unless they are purely distant decoration.

### Step 7 — Add trees, grass, and natural clutter

Snapshot-style vegetation should be layered:

| Vegetation type | Implementation rule |
|---|---|
| grass/flowers | Use flora IDs and growth/moisture where relevant. |
| trees | Use terrain/flora/canonical tree entities, not only client-only models. |
| canopy map visibility | Ensure map flora filters include the correct leaf IDs. |
| decorative shrubs | Can be placeables if collision and map presence are not required. |
| dense forests | Use instancing/LOD, but keep canonical source data. |

Performance rule:

Do not spawn thousands of unique unbatched meshes. Use terrain/flora generation, instancing, LOD, or batched rendering.

### Step 8 — Add safe zones and protected areas

Safe/protected zones need to be gameplay data, not just a sign or invisible client sphere.

A correct safe zone should have:

- canonical position/extent
- protection or safe-zone component/state
- optional landmark label
- optional visual boundary
- server-side enforcement
- client-side feedback
- map marker/label if appropriate

Checklist:

```text
Can combat be blocked server-side?
Can the player see why combat is blocked?
Can the region survive Redis reset/snapshot reload?
Does it move if the town is offset?
Does it show on the map if intended?
```

### Step 9 — Add map labels and landmarks

Use canonical landmark/mailbox/entity data so the map APIs can discover labels.

Relevant files:

```text
src/pages/api/world_map/landmarks.ts
src/client/components/map/markers/PannableMapLandmarkLabels.tsx
src/client/util/map_hooks.ts
```

Rules:

- A town center should be a landmark entity.
- Important buildings should be landmarks only if they matter to navigation.
- Use importance levels intentionally.
- Do not clutter the map with every prop.

### Step 10 — Add music and ambient sound

Use environment/region/placeable-driven audio.

Good triggers:

- `inWater`
- muck/swamp value
- protected town region
- landmark/town zone
- positional fountain/fire/market objects
- quest/event state

Bad trigger:

- random hardcoded coordinate checks spread through client scripts.

---

## 12. Harthmere/Hawthorne extra-town offset checklist

When Harthmere is moved away from the snapshot start, every authored coordinate must be offset together.

Offset these systems together:

```text
terrain shards
building origins
client runtime asset transforms
NPC spawn positions
NPC patrol routes
NPC schedules
home/work anchors
quest giver positions
quest objective target positions
mission trigger regions
combat leash regions
safe zones
landmarks
mailboxes
map markers
fast travel markers
debug teleport destinations
collision extents
```

Snapshot-only expectation:

```text
BIOMES_CREATE_LOCAL_DEV_TERRAIN=0
BIOMES_START_IN_HARTHMERE=0
```

Expected result:

```text
No Harthmere/Hawthorne NPCs, buildings, routes, or quest markers appear in the snapshot start town.
```

Snapshot + extra-town expectation:

```text
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
BIOMES_START_IN_HARTHMERE=0
```

Expected result:

```text
Snapshot start remains original.
Harthmere appears only at the shifted coordinates.
NPCs, buildings, routes, quests, and labels all align at the shifted town.
```

Direct Harthmere start expectation:

```text
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1
BIOMES_START_IN_HARTHMERE=1
```

Expected result:

```text
Player spawns in shifted Harthmere.
No route/quest/building/NPC remains at the old town coordinates.
```

---

## 13. Audits and tests future patches should add

### Snapshot map/landscape audit

Add a script similar to:

```text
scripts/harthmere/audit-snapshot-map-landscape-v1.cjs
```

It should report:

```text
terrain shard count
terrain shard bounds
which shards contain water
which shards contain muck
which shards contain dye
which shards contain flora/growth
which shards contain shapes/stairs
world bounds used by map
map tile metadata/version index
missing galoisPath placeables
missing water texture assets
missing mapping/index assets
landmark count and positions
mailbox count and positions
safe/protected zone count and positions
```

### Harthmere offset audit

Add a script similar to:

```text
scripts/harthmere/check-harthmere-map-landscape-offset-v1.cjs
```

It should fail if:

- any Harthmere NPC is still near the old start coordinates
- any route waypoint is unshifted
- any quest target is unshifted
- any landmark is unshifted
- any client runtime asset is unshifted
- any map marker is unshifted
- old and new Harthmere entities both exist at once

### Water audit

Add a script similar to:

```text
scripts/harthmere/check-harthmere-water-pipeline-v1.cjs
```

It should verify:

```text
fountain/lake/canal shards contain shard_water
/water/tensor returns non-empty water
water normals texture exists
water distortion texture exists
map invalidation includes shard_water
map tile sample sees water at expected coordinates
client water mesh can be generated for the shard
```

### Map tile audit

Add a script similar to:

```text
scripts/harthmere/check-map-tile-generation-v1.cjs
```

It should verify:

```text
WorldHelper bounds include new town
surface tiles generated
fog tiles generated if muck exists
map tile URL resolves
version index updated
landmark API returns new town labels
```

### Building/stairs/collision audit

Add a script similar to:

```text
scripts/harthmere/check-structural-terrain-buildings-v1.cjs
```

It should verify:

```text
walkable buildings have terrain floor blocks
stairs use terrain shapes or valid step blocks
bridges have terrain/collision core
balconies have solid support/collision
placeable decorations are not the only structural layer
terrain boxes exist for walkable structures
NPC pathing can occupy intended floors/stairs
```

---

## 14. Source reference table

| Feature | Snapshot files/functions to study | Correct implementation pattern |
|---|---|---|
| Terrain/geography | `src/shared/game/terrain.ts`, `src/shared/game/resources/terrain.ts`, `src/shared/game/terrain_helper.ts` | Author real terrain shard data, then derive renderer/map/collision. |
| Runtime terrain renderer | `src/client/game/renderers/terrain.ts`, `src/client/game/resources/terrain.ts`, `src/client/game/resources/terrain_meshes.ts` | Separate block, flora, glass, and water layers. |
| Water | `src/shared/game/resources/water.ts`, `src/client/game/resources/water.ts`, `src/client/game/renderers/passes/scene_water_pass.ts`, `src/client/game/shaders/water.fs`, `src/client/game/shaders/water.vs` | Use `shard_water`; let the water pipeline generate mesh/material/map behavior. |
| World map | `src/server/map/pipeline.ts`, `src/server/map/world.ts`, `src/server/map/tiles/*`, `src/shared/map/paths.ts` | Generate tiles from terrain/water/muck/dye/material/lighting data. |
| Map UI | `src/client/components/map/helpers.tsx`, `src/client/components/map/pannable/PannableMapTiles.tsx`, `src/client/util/map_hooks.ts` | Use tile metadata, versioned URLs, landmark APIs. |
| Landmarks | `src/pages/api/world_map/landmarks.ts`, `src/client/components/map/markers/PannableMapLandmarkLabels.tsx` | Use landmark entities/components, not hardcoded React labels. |
| Audio/music | `src/client/game/context_managers/audio_manager.ts`, `src/client/game/scripts/audio.ts`, `src/client/game/renderers/audio.ts` | Drive music/effects from environment/region/placeable state. |
| Placeables | `src/client/game/resources/placeables/helpers.ts`, `src/client/game/resources/placeables/placeables.ts` | Use valid Bikkie `galoisPath`; do not make structural gameplay depend on unresolved meshes. |
| Harthmere local-dev generation | `src/server/shim/main.ts`, `src/client/game/renderers/local_dev/harthmere_assets.ts` | Useful for prototyping, but migrate structural truth into canonical world data. |
| Harthmere metadata | `src/shared/harthmere/town_registry.ts`, `town_routes.ts`, `town_schedules.ts`, `town_map.ts` | Keep routes/schedules/map/collision tied to one shared coordinate transform. |

---

## 15. AI/developer operating procedure

When asked to add or fix a landscape/map feature, follow this order:

1. Identify the canonical world source for the feature.
2. Check whether the feature exists in terrain/entity data or only client runtime decoration.
3. If it affects gameplay/map/collision/audio, patch the canonical data path first.
4. Only then patch renderers or decorative assets.
5. Add an audit script that proves the feature exists in world data.
6. Add a map/client check only after the data check passes.
7. Do not add one-off coordinate hacks. Use shared transforms.
8. Do not fix visual drift by moving only the mesh. Move terrain, NPCs, routes, quests, labels, and collision together.
9. Do not silence missing assets permanently. Log them, dump them, reconcile them.
10. Do not run `BIOMES_FORCE_LOCAL_DEV_TOWN=1` against the snapshot base world unless intentionally testing old local-dev terrain behavior.

---

## 16. Common failure modes and what they mean

| Symptom | Likely cause | Correct fix |
|---|---|---|
| Player starts in empty space | Spawn points still point to old/local-dev area or snapshot player spawn was not restored. | Use snapshot `CONFIG.playerStartPositions` by default; only opt into Harthmere with env. |
| Harthmere NPCs appear in snapshot town | NPCs/routes/schedules were not gated or offset with the town. | Apply one shared Harthmere offset to all NPC and route data. |
| Beautiful building is walk-through | It is probably a client-only mesh or missing collision extents. | Build structural core from terrain blocks/shapes or add canonical collision data. |
| Fountain looks fake or does not appear on map | It is probably a mesh/texture, not `shard_water`. | Populate `shard_water` and basin terrain. |
| Map does not show new town | New town is not represented by real terrain shards or map pipeline was not invalidated. | Add terrain shard data and verify map invalidation/generation. |
| Water renders but map ignores it | Runtime water path and map water path are not reading the same data. | Ensure `shard_water` exists and `affectsMap` sees `shard_water`. |
| Asset URL assertion fails | Bikkie item has missing/old `galoisPath` or asset_versions mismatch. | Reconcile asset versions and remap missing placeable assets. |
| Collision AABB assertion fails | Entity is marked collidable but has no extents/AABB. | Dump entity, repair extents or mark decorative/non-collidable. |
| Music does not match environment | Audio is not reading world/environment state. | Drive track/effect through environment, muck, water, town, or placeable state. |

---

## 17. Implementation checklist for snapshot-quality Harthmere

Use this before considering Harthmere/Hawthorne landscape work complete:

```text
[ ] Snapshot boots without BIOMES_FORCE_LOCAL_DEV_TOWN.
[ ] Snapshot start remains the default start.
[ ] Harthmere extra town is gated behind BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN.
[ ] Harthmere start is gated behind BIOMES_START_IN_HARTHMERE.
[ ] All Harthmere authored coordinates go through one shared offset transform.
[ ] Buildings have terrain/collision cores.
[ ] Stairs and ramps are terrain shapes or solid step terrain.
[ ] Bridges have terrain/collision cores and parapets.
[ ] Fountains/lakes/rivers use shard_water.
[ ] Grass/trees use flora/canonical data where gameplay/map relevance matters.
[ ] Safe zones are server-visible gameplay data.
[ ] Landmarks and labels are entity/component/API-driven.
[ ] Music and ambience are environment/entity-driven.
[ ] Map world bounds include new region.
[ ] Surface/fog tiles generate for new region.
[ ] Collision AABB audit passes or intentionally excludes decorative entities.
[ ] Missing placeable asset dump is empty or explicitly reconciled.
[ ] NPC routes, schedules, quests, and map markers are shifted with the town.
[ ] One-command regression suite covers snapshot-only and snapshot-plus-Harthmere modes.
```

---

## 18. Bottom line

The snapshot feels better because it is a coherent world-data pipeline, not a pile of renderer exceptions.

For future work, the priority should be:

```text
canonical terrain/entity data
  before renderer visuals
  before decorative meshes
  before one-off client fixes
```

If Harthmere follows that pattern, the map, water, music, safe zones, NPCs, quests, and buildings will stop fighting each other and start behaving like one real world.
