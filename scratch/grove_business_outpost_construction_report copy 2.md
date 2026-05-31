# Grove Reference Coordinates — Full Reconstruction Spec

Scope: the 14 coordinates supplied. Everything below describes what's at those points, the procedural voxel pipeline that builds them, the frontend render path, the math you need to rebuild every voxel and prop from scratch, and the NPC design system for the characters that live at those coordinates. No other locations are discussed.

## 0. The 14 coordinates

### Set A — building reference array (8 points)

Defined at `src/shared/harthmere/business_customer_simulator_v1.ts:399-408` as the frozen `HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1`. The companion `HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1` (lines 410-577) annotates each index with what was found there:

| Idx | Coord | Source | What's there |
|---|---|---|---|
| 0 | `[496.74, 68, -157.29]` | authored_placement_cluster | supported wall cabinet, supported bottle shelf, bench seating with clear aisle, grounded sign with supported notice, floor crate and chest dressing |
| 1 | `[479.23, 70, -89.56]` | authored_landscape_cluster | soft Grove landscape edge, naturalized gathering props, clear path kept open around vegetation (`tree_crooked`, `tree_high`, `logs`, `rock_small`) |
| 2 | `[503.83, 62, -156.25]` | authored_placement_cluster | low stone boundary wall, bookcase/cabinet against walls, reading table with supported books/scrolls, small light props |
| 3 | `[503.72, 68, -160.39]` | authored_placement_cluster | business-specific shelves against walls, long service table clear of doorway, supported recipe object on table, supported candle/lantern accent |
| 4 | `[477.33, 70, -73.76]` | live_world_snapshot_reference | door/window/furniture style observed from screenshot |
| 5 | `[787.28, 68, -132.00]` | live_world_snapshot_reference | same |
| 6 | `[788.71, 73, -151.70]` | live_world_snapshot_reference | same |
| 7 | `[784.42, 72, -143.12]` | live_world_snapshot_reference | same |

Marked `unresolvedAuthoredPlacementCoordinates: [4, 5, 6, 7]` — those four exist only in production screenshots.

### Set B — six observation coordinates

These six are not named constants. Their Y values bind them to known grounding bands defined in `snapshot_grove_content_v75.ts`:

| Coord | Y interpretation | Band constant |
|---|---|---|
| `[483.40, 53, -186.37]` | authored bible NPC feet height | `SNAPSHOT_GROVE_NPC_FEET_Y_V75 = 53`, also `GROVE_ECONOMY_STARTER_NPC_FEET_Y_V137 = 53` |
| `[452.92, 73, -165.02]` | live world standing head (live ground + 3) | `SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 = 69` |
| `[440.15, 71, -125.33]` | live world standing eye level (live ground + 2) | same |
| `[444.64, 70, -112.24]` | live NPC feet height | `SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83 = 70` |
| `[511.99, 70, -60.87]` | live NPC feet height | same |
| `[531.91, 70, -65.71]` | live NPC feet height (paired with previous, 20 voxels east) | same |

So Set A is what the buildings should *look like* (visual reference for the procedural shell), Set B is where someone (player or NPC) was *standing* in the live world. The Y bands are what tie these to the source — Y=53 means authored-bible space, Y=70 means the production grounding pass.

---

## 1. Backend voxel pipeline (server)

### 1.1 Data flow

```
HARTHMERE_BUSINESS_OUTPOSTS_V1[]                              // 19 outpost declarations
  └── createHarthmereBusinessOutpostProceduralBuildingV1()    // per outpost
       ├── harthmereOutpostBlueprintForV1()                   // → BuildingSystemBlueprintDefinitionV1
       ├── harthmereOutpostPlotForV1()                        // → BuildingSystemPlotDefinitionV1
       ├── harthmereOutpostOriginV1()                         // → {x,y,z}
       ├── createBuildingSystemMaterializationPlanV1()        // → {edits[], placeGroup, safeZone}
       │     ├── pushVoxelBox(... foundation)                 // 1 voxel layer @ y0-1
       │     ├── pushVoxelBox(... floor)                      // 1 voxel layer @ y0
       │     ├── pushBuildingWallsV1()                        // cobblestone shell w/ 1×2 door gap
       │     ├── pushVoxelBox(... roof)                       // 1 voxel layer @ roofY
       │     └── edit @ (doorX, y0, z0-1)                     // stair voxel
       ├── addHarthmereOutpostRetainingFoundationSupportsV1() // perimeter columns y0-8 → y0-1
       ├── harthmereBusinessOutpostBuildingStyleKitV1()       // → materials, awning, sign, dressing
       ├── createHarthmereBusinessInteriorFixturesV1()        // → 8 fixtures (3 guaranteed + 1 primary + 4 decor)
       └── validateHarthmereBusinessOutpostPassabilityV1()    // gate; rejects broken builds

defaultHarthmereBusinessOutpostBuildingStateV1(nowMs) bundles all 19 records
  └── lives under state.building.materializationPlans[plan.requestId]
       and state.building.placedStructures[plan.requestId]
       and state.building.inWorldMarkers[marker.markerId]
       and state.building.safeZones[plot.plotId]
```

Hot-built path (player-driven, not just baseline outposts) at `live_mode_backend_v1.ts:9192`: when a player buys a blueprint, `createBuildingSystemMaterializationPlanV1` runs with the same inputs, and the resulting plan is stamped into `next.building.materializationPlans[envelope.requestId]`. `voxelEditCount: plan.edits.length` is recorded on `placedStructures[requestId]` so the world knows how many edits this plan owns. The plan also gets pushed onto `buildingMaterializationPlans[]` and marks `touchedModels.add("terrain_materialization")`.

### 1.2 Edit event format

Every voxel write is one of these:

```ts
interface BuildingSystemVoxelEditSpecV1 {
  kind: "editEvent";
  position: [number, number, number];   // integer voxel coordinate
  value: BiomesId;                      // Bikkie ID of the block (or 0 for air)
  label: "foundation" | "floor" | "frame" | "wall" | "roof" | "stair"
       | "interior" | "safe_ground" | "boundary_marker" | "deed_marker"
       | "map_marker" | "npc_marker" | "demolition_cleanup" | "repair_damage"
       | "repair_restore" | "upgrade_addition" | "storage_container"
       | "door_lock" | "business_marker" | "home_console";
}
```

`label` is what `structuralAudit` counts (`foundationEdits`, `floorEdits`, `wallEdits`, `roofEdits`, `stairEdits`). The validator rejects any building with `≤ 0` of foundation, floor, wall, roof, or stair edits.

### 1.3 Place-group event

One `placeGroupEvent` per materialization with bounding box `v0 = (x0, y0-1, z0)`, `v1 = (x1, roofY+1, z1)`. This is what ECS uses to group all child voxels under a single deedable structure.

### 1.4 Block palette (`BUILDING_BLOCKS_V1`, building_system_v1.ts:529)

```
foundation         = BikkieIds.cobblestone
floor              = BikkieIds.stone
frame              = BikkieIds.oakLog
wall               = BikkieIds.cobblestone
roof               = BikkieIds.stone
stair              = BikkieIds.woodenStepper
interior           = BikkieIds.woodContainer
safeGround         = BikkieIds.dirt
boundaryMarker     = BikkieIds.woodenFencer
deedMarker         = BikkieIds.smallOakSign
mapMarker          = BikkieIds.bboxMarker
storageContainer   = BikkieIds.woodContainer
doorLock           = BikkieIds.smallOakSign
businessMarker     = BikkieIds.bboxMarker
homeConsole        = BikkieIds.powerCell
upgradeWall        = BikkieIds.stone
```

### 1.5 Persistence

Materialization plans are persisted under `state.building.materializationPlans[requestId]` in the live-mode backend state (`live_mode_backend_v1.ts:549`, default state init at line 3746). On state load they're merged with `defaults.building.materializationPlans`, the parsed incoming state, and the freshly-computed `businessOutpostBuildingState.materializationPlans` (line 4351). The same merge runs for `placedStructures`, `safeZones`, and `inWorldMarkers`.

---

## 2. Frontend rendering pipeline (client, Three.js)

The client renderer for the Grove outposts is `src/client/game/renderers/local_dev/harthmere_business_outpost_buildings_v1.ts`. It reads the same `HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1` records the backend uses — same materialization plan, same fixtures, same style kit — and converts each into `THREE.InstancedMesh` and `THREE.Mesh` instances.

### 2.1 Material palette (style → hex)

`STYLE_MATERIAL_COLORS_V1` (line 59):

```
carved_limestone     = 0xc9c0ad
clean_stone_tile     = 0x8f969b
dark_workshop_stone  = 0x59616a
green_roof_sod       = 0x4e7c43
polished_glass       = 0xa8d9e8
purple_canvas        = 0x8d43c9
red_canvas           = 0xb34f47
red_clay_roof        = 0x8f453c
stone_foundation     = 0x6f7478
warm_wood_plank      = 0xb08458
white_canvas         = 0xe5dcc8
wood_floor           = 0xc39a61
```

`paletteForRecordV1()` resolves these per outpost into `{foundation, safe_ground, floor, wall, roof, stair, interior, primary, accent, trim, wallShadow, glass, darkWood, parchment}`. Each `editEvent.label` is matched against this palette to produce a `THREE.MeshBasicMaterial`.

### 2.2 Voxel rendering — instanced cubes

`addVoxelInstancesForLabelV1` (line 196) walks every edit, groups by label, and emits one `THREE.InstancedMesh` per label with:

- Geometry: `new THREE.BoxGeometry(1, 1, 1)` (or `(1, 0.08, 1)` for `safe_ground`)
- Material: per-label color from the palette
- Count: number of edits with that label
- Per-instance transform: `Matrix4.makeTranslation(x + 0.5, y + (0.5 or 0.04), z + 0.5)` — voxels are unit cubes centered on the integer grid

So a single building with foundationEdits=480, floorEdits=480, wallEdits=~336, roofEdits=480 produces four instanced meshes with ~1,776 total instances. `frustumCulled = false` because they're often viewed from many angles. Voxel positions live on `userData.rawBackendVoxelCount` and `visibleBackendVoxelCount` for diagnostics.

### 2.3 Visibility filtering

`visibleVoxelPositionsForLabelV1` (line 170) gates which voxels get rendered:

- `safe_ground` is clipped to `visualLotBoundsForRecordV1` — the bounding rectangle that includes origin, entrance, and jobs-board positions.
- `foundation` is clipped to `{xMin: origin.x-1, xMax: origin.x+width, zMin: origin.z-1, zMax: origin.z+depth}` so off-plot retaining columns don't render in dev preview.
- Everything else renders as-is.

### 2.4 Style detail layer

`addBiomesStyleShellDetailsV1` (line 406) adds non-voxel decorative geometry on top of the cube field:

- **Foundation band**: a `[width+0.45, 0.7, 0.24]` box centered on the front face at y = `y0 + 0.36`
- **Roof overhang**: `[width+1.35, 0.34, 1.15]` at y = `y0 + height + 0.18`
- **Roof fascia trim**: `[width+1.45, 0.18, 0.16]` at y = `y0 + height − 0.05`
- **Storefront corner trims**: `[0.28, max(3.4, height-1), 0.28]` on the front-left and front-right edges
- **Wall seams**: if `exteriorWall === "warm_wood_plank"`, 5 horizontal plank seams at y = `y0 + 1.35 + row*0.55` plus vertical seams every 3 voxels; otherwise stone tile seams every 3 voxels with 4 horizontal courses at `y0 + 1.35 + row*0.78`
- **West/east/back stone base trim**: `[0.18, 0.26, depth+0.2]` rails

### 2.5 Doors and windows (renderer-only)

`addFacadePolishV1` (line 743) paints the door and window prefabs the voxel pusher never emits:

```
left door jamb       = box [0.22, 2.45, 0.16] at (centerX - 0.55, y0 + 1.25, z - 0.06)   darkWood
right door jamb      = box [0.22, 2.45, 0.16] at (centerX + 1.55, y0 + 1.25, z - 0.06)   darkWood
door lintel          = box [2.32, 0.26, 0.16] at (centerX + 0.5, y0 + 2.55, z - 0.06)    darkWood
door threshold       = box [3.4, 0.16, 0.18]  at (centerX + 0.5, y0 + 0.12, z - 0.14)    accent
open door leaf       = box [0.16, 2.0, 0.9]   at (centerX - 0.82, y0 + 1.18, z - 0.64)   darkWood
door glass inset     = box [0.08, 0.86, 0.48] at (centerX - 0.91, y0 + 1.72, z - 0.64)   glass

front windows (2)    = box [1.72, 1.42, 0.12] at (centerX ± width*0.28 + 0.5, y0+2.05, z)  glass
window top frame     = box [2.02, 0.16, 0.16] at same x, y0+2.86                          trim
window bottom frame  = box [2.02, 0.16, 0.16] at same x, y0+1.24                          trim
window center mullion= box [0.12, 1.5, 0.16]  at same x, y0+2.05                          trim

side service windows (4): both side walls × {depth*0.36, depth*0.68}
                     = box [0.12, 0.9, 1.2]   at (x0 ± 1.06, y0+2.1, z0 + depth*0.36 or 0.68)  glass
side window trim     = box [0.14, 1.12, 1.46] same                                            trim
```

So the doorframe and storefront glass on every outpost are renderer-only meshes that hang on the voxel walls. The voxel grid stays solid; the visible facade has the door, both front bay windows, and four side service windows.

### 2.6 Awning, sign, jobs board

```
business sign plaque = [4.2, 0.7, 0.2]   at (centerX + 0.5, y0 + 3.34, z - 0.08)   darkWood
business sign icon   = [0.65, 0.46, 0.08] at (centerX - 1.15, y0 + 3.36, z - 0.22) accent
front awning         = [min(width-2, 8.0), 0.34, 1.08] at (centerX + 0.5, y0+3.02, z-0.5)  awningMaterial color
awning stripes (5)   = [0.62, 0.38, 1.12] at offsets {-2.8, -1.4, 0, 1.4, 2.8}    trim

jobs board base      = [2.8, 0.28, 0.7]   at (jx, jy+0.14, jz)                    rail
jobs board posts (2) = [0.22, 2.3, 0.22]  at (jx ± 1.12, jy+1.26, jz)             wood
jobs board notice bg = [2.55, 1.45, 0.18] at (jx, jy+1.62, jz+0.02)               wood
jobs board notices (4) = [0.44 + (i%2)*0.18, 0.48, 0.06] at (jx - 0.78 + i*0.52, jy+1.66+(i%2)*0.14, jz+0.16)  paper
```

### 2.7 Interior fixtures (interpretation of metadata)

`addCustomerDashboardAndStationV1` (line 294) walks `record.interiorFixtures` and turns each `{position, size, role, colorHint}` into one or more boxes:

```
dashboard_access:
  glow screen   = [size[0], size[1]*0.55, 0.14]  at (x+0.5, y + size[1]*0.68, z+0.5)
  pedestal      = [0.62, 0.62, size[2]]           at (x+0.5, y+0.31, z+0.5)
  floor cue     = [2.0, 0.08, 1.2]                at (x+0.5, y+0.08, z+0.5 - 0.65)   safety color (0x8ad6ff)

any other fixture:
  body          = [size[0], size[1], size[2]]     at (x+0.5, y + size[1]/2, z+0.5)
  if businessSpecific and not primary:
    accent voxel = [min(0.7, size[0]), 0.28, min(0.7, size[2])] at (x+0.5, y+size[1]+0.18, z+0.5)
```

`colorHint` → THREE color mapping: `accent`→palette.accent, `floor`→palette.floor, `primary`→palette.primary, `safety`→`0x8ad6ff`, `stock`→`0x6f8f61`, `trim`→palette.trim, `wall`→palette.wall, `wood`→`0x5a3a25`.

### 2.8 Exterior polish

`addExteriorBikkiePolishV1` (line 802) adds:

- Retaining walls around the safe zone (4 boxes of `[width|depth, 0.9, 0.32]`)
- Customer approach path: `[3.2, 0.07, 4.2]` at `(entrance.x + 0.5, y0 + 0.11, entrance.z - 2.0)` brown 0x9b764b
- Jobs board side path: `[5.6, 0.07, 1.15]`
- 2 exterior planters: `[0.9, 0.48, 0.9]` at `entrance ± (2.5, 0, 0)` colored by primary bikkie hex
- 2 bright blooms on top: `[0.52, 0.62, 0.52]`
- Exterior dressing variant:
  - `workshop_crates`: 3 crates at offsets `[-4.2, 4.2, 5.35]`
  - `arcane_lanterns`: 2 lantern posts + glows at `±3.8`
  - default: 2 leafy shrubs at `±4.1`
- Welcome mat: `[3.2, 0.08, 1.2]` at entrance, accent color

### 2.9 Runtime offset

Procedural outposts can be offset for the local-dev town via `BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X` (default 512) and `_Z` (default 0), gated by `NEXT_PUBLIC_GLITCH_RUNTIME`, `BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN`, etc. This is why the Set A coords 5–7 land near X≈787 in production but X≈275 in source — they're the same building rendered at `position.x + 512`.

---

## 3. Full mathematical specification

Anyone with the inputs below can reconstruct every voxel position and every renderer prop for a building at the Grove reference coordinates.

### 3.1 Inputs

```
outpost.position = { x, y, z, rot }       // world position, rot in radians
outpost.building = { profile, width, depth, floors, banner }
outpost.businessType
```

### 3.2 Footprint (`harthmereBusinessOutpostMinigameFootprintV1`, line 2222)

```
largeProfiles = {barracks, dock_warehouse, inn, player_services, smithy}
largeBusiness = /refinery|portal|security|weapons|hospitality/.test(businessType)
isLarge       = largeProfiles.has(profile) ∨ largeBusiness

minW = isLarge ? 28 : 24
minD = isLarge ? 22 : 20
even(v) = v + |v mod 2|

W = even(max(outpost.building.width,  minW))
D = even(max(outpost.building.depth,  minD))
H = max(6, floors * 4 + 2)
```

### 3.3 Origin and rotation

```
origin.x = round(outpost.position.x − W/2)
origin.y = floor(outpost.position.y)
origin.z = round(outpost.position.z − D/2)

normalized = ((rot mod 2π) + 2π) mod 2π
rotationDegrees = [0, 90, 180, 270][round(normalized / (π/2)) mod 4]
```

### 3.4 Bounding box

```
x0, y0, z0 = origin.x, origin.y, origin.z
x1 = x0 + W
z1 = z0 + D
wallTop = y0 + max(3, H − 1)
roofY   = wallTop
doorX   = ⌊(x0 + x1) / 2⌋
```

### 3.5 Voxel writes — shell

For every integer `(x, y, z)` in the listed ranges, emit one `editEvent` with the given block.

**Foundation** — `cobblestone`, label `"foundation"`:
```
∀ x ∈ [x0, x1),  ∀ z ∈ [z0, z1):   write(x, y0 − 1, z)
```

**Floor** — `stone`, label `"floor"`:
```
∀ x ∈ [x0, x1),  ∀ z ∈ [z0, z1):   write(x, y0, z)
```

**Walls** — `cobblestone`, label `"wall"`:
```
∀ y ∈ [y0 + 1, wallTop):
  ∀ x ∈ [x0, x1):
    isDoor = (x = doorX) ∧ (y = y0+1 ∨ y = y0+2)
    if ¬isDoor:   write(x, y, z0)           // south wall with door void
                  write(x, y, z1 − 1)        // north wall (always solid)
  ∀ z ∈ [z0 + 1, z1 − 1):
    write(x0,     y, z)                       // west wall
    write(x1 − 1, y, z)                       // east wall
```

**Roof** — `stone`, label `"roof"`:
```
∀ x ∈ [x0, x1),  ∀ z ∈ [z0, z1):   write(x, roofY, z)
```

**Stair** — `woodenStepper`, label `"stair"`:
```
stairZ = z0 − 1
if stairZ ≥ plot.bounds.zMin ∧ doorX ∈ [plot.bounds.xMin, plot.bounds.xMax):
  write(doorX, y0, stairZ)
```

**Retaining supports** — `cobblestone`, label `"foundation"`:
```
For each (x, z) at perimeter, every 4 voxels:
  x_seq = {x0, x0+4, x0+8, …, x1-(x1-x0)%4} along z=zMin and z=zMax-1
  z_seq = {z0, z0+4, z0+8, …, z1-(z1-z0)%4} along x=xMin and x=xMax-1
  For each (x, z) in the perimeter set:
    ∀ y ∈ [y0 − 8, y0 − 1]:   write(x, y, z)
```

### 3.6 Voxel counts (verifiable on output)

```
foundationEdits = W × D                               // base layer
floorEdits      = W × D                               // floor layer
wallEdits       = (wallTop − (y0+1)) × [2W + 2(D-2)] − 2   // shell minus 2-voxel door gap
roofEdits       = W × D
stairEdits      = 1
support columns ≈ (⌈W/4⌉ × 2 + ⌈D/4⌉ × 2) × 8         // additive to foundationEdits
```

For a 24 × 20 × 6 building: foundation 480, floor 480, walls (5 × (48+36)) − 2 = 418, roof 480, stair 1. Total ≈ 1,859 voxel writes. Add perimeter supports: ≈ 22 columns × 8 = 176 → total ≈ 2,035.

### 3.7 Interior anchor positions

```
doorX        = origin.x + ⌊W/2⌋
entrance     = (doorX,                                 y0+1, z0 − 1)
queueNode    = (doorX,                                 y0+1, z0 + 3)
serviceCounter = (doorX,                               y0+1, z0 + max(8, D − 6))
exitNode     = (min(x0 + W − 3, doorX + 2),            y0+1, z0 + 1)
dashboard    = (max(x0 + 3, doorX − 4),                y0+1, max(z0 + 4, serviceCounter.z − 1))
jobsBoard    = (entrance.x + 3,                        y0,   z0 − 3)
primaryStation = (x0 + W − 5,                          y0+1, min(z0 + D − 4, serviceCounter.z + 2))
```

### 3.8 Customer space

```
minX = origin.x + 2
maxX = origin.x + W − 2
minZ = origin.z + 2
maxZ = origin.z + D − 3
areaMeters = max(0, maxX − minX) × max(0, maxZ − minZ)
```

For W=24, D=20: 20 × 15 = 300 m². For W=28, D=22: 24 × 17 = 408 m².

### 3.9 Clearance constants

```
frontDoorMeters         = 2        (validator threshold: ≥ 2)
shopCustomerSpaceMeters = 4        (≥ 4)
publicEntranceMeters    = 3        (≥ 3)
aisleWidthBlocks        = 2
counterClearanceBlocks  = 2
queueSpacingBlocks      = 1
repathAfterMs           = 2500
sidestepRadiusBlocks    = 1.5
blockedNodeRetryLimit   = 3
fallbackExitAfterMs     = 15000
```

### 3.10 Fixture slot positions

```
leftX  = origin.x + 3
rightX = origin.x + W − 4
frontZ = origin.z + 5
sideZ  = max(origin.z + 6, serviceCounter.z − 3)
backZ  = min(origin.z + D − 4, serviceCounter.z + 3)

slot(left)       = (leftX,      y0+1, sideZ)
slot(right)      = (rightX,     y0+1, sideZ)
slot(backLeft)   = (leftX + 1,  y0+1, backZ)
slot(backRight)  = (rightX − 1, y0+1, backZ)
slot(frontLeft)  = (leftX + 1,  y0+1, frontZ)
slot(frontRight) = (rightX − 1, y0+1, frontZ)
```

### 3.11 Fixture occupancy test

For a fixture at `position` with `size = [sx, sy, sz]`:
```
cx = position.x + 0.5
cz = position.z + 0.5
hx = sx / 2
hz = sz / 2

occupies(point) ⇔
  point.y = position.y ∧
  point.x + 0.5 ≥ cx − hx ∧ point.x + 0.5 ≤ cx + hx ∧
  point.z + 0.5 ≥ cz − hz ∧ point.z + 0.5 ≤ cz + hz
```

### 3.12 Tier-upgrade (second floor)

```
secondFloorY = roofY + 1
upgrade floor: ∀ x ∈ [x0,x1), z ∈ [z0,z1):   write(x, secondFloorY, z) as upgradeWall(stone)
upgrade facade: ∀ x ∈ [x0,x1), y ∈ [secondFloorY+1, secondFloorY+3):   write(x, y, z0) as wall
upgrade roof:  ∀ x ∈ [x0,x1), z ∈ [z0,z1):   write(x, secondFloorY+3, z) as roof
```

No internal stair, no door cut, no second-floor windows in voxel layer. Asset vocabulary `obj_wall_stairs` is the renderer-side connector.

### 3.13 Renderer geometry math (constants)

Front-face center for renderer props:
```
centerX = x0 + W/2 + 0.5
frontZ  = z0 − 0.1
backZ   = z1 − 0.9
facadeW = W + 0.45
```

Every renderer prop position is a fixed linear combination of `(centerX, y0, frontZ, W, D, H)` — see §2.5–§2.8 for the full table. There are no random elements anywhere.

### 3.14 Cube instance transforms

For every voxel `(x, y, z, label)` the renderer applies:
```
Matrix4.makeTranslation(x + 0.5, y + 0.5, z + 0.5)             // most labels
Matrix4.makeTranslation(x + 0.5, y + 0.04, z + 0.5)            // safe_ground only
```

Box geometry is `(1, 1, 1)` for solids, `(1, 0.08, 1)` for safe_ground.

### 3.15 Coordinate-to-set-A reconstruction check

Apply the math above with `outpost.position = (496, 65, -157)` (close to coord 0 `[496.7, 68, -157.3]`). If `profile = workshop`, `width = 16`, then:

```
isLarge=false, minW=24, minD=20
W=24, D=20, H=6
origin = (round(496-12), 65, round(-157-10)) = (484, 65, -167)
doorX  = 484 + 12 = 496
entrance = (496, 66, -168)
roofY  = 65 + 5 = 70
```

Foundation voxels span `x ∈ [484, 508), z ∈ [-167, -147)` at y=64, which encloses the visual reference point (X=496.7, Y=68, Z=-157.3) inside the building's footprint between y0=65 (floor) and roofY=70 (ceiling) — i.e. the reference point sits *inside* the building at chest height.

---

## 4. NPCs at these coordinates — design system

Scope reminder: NPCs described here are the ones the source files bind to positions in or adjacent to the 14 coordinates given. The 6 coordinates in Set B all fall in the Y-bands used by the Grove/Harthmere NPC seed (Y=53 authored, Y=70-73 live). The 8 coordinates in Set A are building references — the merchants *inside* those shells are pulled from `HARTHMERE_BUSINESS_OUTPOSTS_V1`.

### 4.1 Identity & appearance schema

`src/shared/harthmere/voxel_faces.ts` defines the complete per-NPC appearance contract (`HarthmereCharacterAppearance`):

```ts
{
  version: 1,
  species: "human" | "animal" | "undead",
  role: "player" | "civilian" | "guard" | "merchant" | "farmer"
      | "clergy" | "hunter" | "bandit" | "hostile" | "wildlife" | "undead",
  face: HarthmereVoxelFaceConfig,    // see §4.2
  body: HarthmereVoxelBodyConfig,    // see §4.3
  forwardAxis: "plusZ" | "minusZ",
  anchors: { head, neck, rightHand, leftHand, hip, back },   // attachment bone refs
  equipment: { mainHand?, offHand?, head?, back?, hip?, accessory? },
  clothing: { hair?, head?, face?, torso?, legs?, hands?, feet?, back?, belt?, weapon?, shield? },
  facialExpression: { expression, intensity, source, ... }
}
```

### 4.2 Face — voxel parameter set

`HarthmereVoxelFaceConfig` (line 222) — 13 enums + gender/pronouns:

| Field | Values |
|---|---|
| `skinTone` | porcelain, light, warm, tan, brown, deep, metal |
| `faceShape` | bolt_square, wide, narrow, tall, soft |
| `eyeShape` | square, wide, small, sleepy, sharp |
| `eyeColor` | black, brown, blue, green, hazel, gray, amber, violet |
| `browStyle` | soft, straight, arched, stern, scarred |
| `noseStyle` | small, straight, wide, long, button |
| `mouthStyle` | line, smile, frown, open, stern, smirk |
| `hairStyle` | flat, side_part, short_crown, balding, hood, cap, braids, curly, shaved, bob, long, bun, pigtails, wavy |
| `hairColor` | black, brown, auburn, blonde, gray, white, red, blue, green, purple |
| `facialHair` | none, mustache, goatee, short_beard, full_beard |
| `cheekStyle` | none, soft, strong, freckled |
| `accessory` | none, cap, hood, headband, spectacles |

Default player face (line 241): `nonbinary they/them`, skin `warm`, face `soft`, eyes `wide hazel`, brow `soft`, nose `button`, mouth `smile`, hair `wavy brown`, no facial hair, freckled cheeks, no accessory.

### 4.3 Face mesh — exact voxel math

`localDevPlayerVoxelFaceFromConfig` (`src/client/game/resources/player_mesh.ts:1113`) maps the parameter set to box geometry. Head size is `(headWidth, headHeight, headDepth)` looked up by face shape:

| faceShape | headWidth | headHeight | headDepth |
|---|---:|---:|---:|
| bolt_square | 0.48 | 0.48 | 0.42 |
| wide        | 0.56 | 0.46 | 0.44 |
| narrow      | 0.40 | 0.50 | 0.36 |
| tall        | 0.46 | 0.60 | 0.40 |
| soft        | 0.52 | 0.46 | 0.44 |

Head is positioned at `(0, 1.58, -0.01)`. Eyes:

| eyeShape | spread | width | height | y |
|---|---:|---:|---:|---:|
| square  | 0.105 | 0.060 | 0.055 | 1.600 |
| wide    | 0.135 | 0.090 | 0.045 | 1.598 |
| small   | 0.088 | 0.040 | 0.040 | 1.602 |
| sleepy  | 0.112 | 0.075 | 0.026 | 1.585 |
| sharp   | 0.122 | 0.080 | 0.034 | 1.610 |

Each eye is a 0.03-deep box at `(±spread, eyeY, -headDepth/2 - 0.032)`.

Nose size and Y (positioned at `(0, noseY, -headDepth/2 - 0.052)`):

| noseStyle | size [w,h,d] | y |
|---|---|---:|
| small    | [0.052, 0.060, 0.060] | 1.535 |
| straight | [0.072, 0.088, 0.074] | 1.530 |
| wide     | [0.108, 0.070, 0.080] | 1.525 |
| long     | [0.068, 0.125, 0.075] | 1.510 |
| button   | [0.088, 0.055, 0.090] | 1.545 |

Mouth — width × height × 0.026, at `(±0.028 if smirk else 0, mouthY, -headDepth/2 - 0.04)`:

| mouthStyle | width | height | y |
|---|---:|---:|---:|
| line   | 0.16 | 0.025 | 1.440 |
| smile  | 0.17 | 0.026 | 1.455 |
| frown  | 0.17 | 0.026 | 1.425 |
| open   | 0.12 | 0.065 | 1.438 |
| stern  | 0.12 | 0.022 | 1.442 |
| smirk  | 0.15 | 0.026 | 1.452 |

Mouth color: `0x6b2f33` when `mouthStyle === "open"`, else `0x2a1712`. Cheek color: freckled `0x6a3c28`, strong `0x8a5844`, soft `0xd98a7c`.

Brows: width = (soft: 0.09, stern: 0.14, else 0.12); height = (scarred: 0.026, else 0.02); depth 0.026. Position: `(±eyeSpread, eyeY + (soft: 0.055, else 0.07), -headDepth/2 - 0.04)`.

Hair — thickness and sideburn height by style:

| hairStyle | thickness | sideburnHeight |
|---|---:|---:|
| flat        | 0.11 | 0.20 |
| side_part   | 0.13 | 0.18 |
| short_crown | 0.16 | 0.14 |
| balding     | 0.06 | 0.23 |
| hood        | 0.14 | 0.12 |
| cap         | 0.13 | 0.10 |
| braids      | 0.11 | 0.40 |
| curly       | 0.16 | 0.18 |
| shaved      | 0.035 | 0.055 |
| bob         | 0.13 | 0.34 |
| long        | 0.13 | 0.54 |
| bun         | 0.12 | 0.20 |
| pigtails    | 0.12 | 0.38 |
| wavy        | 0.15 | 0.30 |

Hair cap: `(headWidth + 0.02, thickness, headDepth + 0.02)` at `(0, 1.58 + headHeight/2 + thickness/2, -0.01)`.
Sideburns: `(braids ? 0.07 : 0.08, sideburnHeight, headDepth + 0.02)` at `(±(headWidth/2 + 0.015), 1.6, -0.01)`.

### 4.4 Color palettes — exact hex

Skin (`HARTHMERE_PLAYER_SKIN_COLORS`, line 1041):
```
porcelain = 0xf0c7a3      shadow = 0xd9a47f
light     = 0xe4b48e      shadow = 0xc48a66
warm      = 0xd19a68      shadow = 0x9a5f3e
tan       = 0xb9825a      shadow = 0x7e4f36
brown     = 0x8f5f3f      shadow = 0x5f3d2d
deep      = 0x5c3a2c      shadow = 0x3a261e
metal     = 0x9ca3af      shadow = 0x657084
```

Hair (`HARTHMERE_PLAYER_HAIR_COLORS`, line 1061):
```
black=0x1f1a16  brown=0x3a2518  auburn=0x6a2f21  blonde=0xb89652
gray=0x707070   white=0xd6d0c8  red=0x7a2d22     blue=0x233a5a
green=0x24523a  purple=0x4a2d5a
```

Eyes (`HARTHMERE_PLAYER_EYE_COLORS`, line 1074):
```
black=0x151515  brown=0x5a3a22  blue=0x203a54  green=0x2d4d2f
hazel=0x6a5a2e  gray=0x59656d   amber=0x9a6b24 violet=0x493463
```

Color blending in the renderer uses `harthmereVoxelColorMix(source, target, amount)` — straight RGB lerp per channel (line 1098). `Lighten = mix(color, 0xffffff, 0.18)`, `darken = mix(color, 0x000000, 0.24)`.

### 4.5 Profile seed (deterministic face identity)

`harthmerePlayerFaceProfileSeed` (line 1317) — FNV-1a hash over the face token:

```
seed = 2166136261
token = [skinTone, hairColor, eyeColor, faceShape, eyeShape, browStyle,
         noseStyle, mouthStyle, hairStyle, facialHair, cheekStyle, accessory].join("|")
for char in token:
  seed = (seed XOR char.charCodeAt(0)) * 16777619 mod 2^32
return seed >>> 0
```

This seed drives per-NPC asymmetry (jaw notches, hair lock side, mark side) — see `HarthmerePlayerFaceSideProfile` (line 1285).

### 4.6 Body — voxel parameter set

`HarthmereVoxelBodyConfig` (line 317):

| Field | Values |
|---|---|
| `bodyType` | average, slim, broad, stocky, athletic, soft |
| `bodyHeight` | short, average, tall, very_tall |
| `shoulderWidth` | narrow, average, wide |
| `armLength` | short, average, long |
| `legLength` | short, average, long |
| `stance` | relaxed, upright, heroic, reserved |
| `outfitColor` | earth, forest, river, ember, royal, ash |

Default player body (line 328): `athletic average forest`, all lengths `average`, legs `long`, stance `relaxed`.

### 4.7 Body mesh — exact dimensions

`harthmerePlayerClothingFitMetrics` (`player_mesh.ts:1716`) derives body geometry:

```
torsoWidth =
  bodyType == slim     ? 0.34 :
  bodyType == broad    ? 0.50 :
  bodyType == stocky   ? 0.54 :
  bodyType == athletic ? 0.46 :
  bodyType == soft     ? 0.48 :
                         0.42       // average

torsoHeight =
  bodyType == stocky   ? 0.54 :
  bodyType == athletic ? 0.62 :
  bodyType == soft     ? 0.56 :
                         0.58

shoulderWidth =
  shoulderWidth == wide    ? torsoWidth + 0.26 :
  shoulderWidth == narrow  ? torsoWidth + 0.04 :
                             torsoWidth + 0.14

legLength = legLength == long ? 0.64 : legLength == short ? 0.40 : 0.52
armLength = armLength == long ? 0.70 : armLength == short ? 0.46 : 0.58

stanceOffset = stance == heroic ? 0.05 : stance == reserved ? -0.03 : 0
stanceArmX   = stance == heroic ? 0.035 : stance == reserved ? -0.02 : 0
legSpread    = stance == heroic ? 0.07 : stance == reserved ? 0.02 : 0.045

heightNudge =
  bodyHeight == short      ? -0.030 :
  bodyHeight == tall       ?  0.035 :
  bodyHeight == very_tall  ?  0.070 :
                              0.000

// Derived assembly positions:
torsoY     = legLength + torsoHeight/2 + stanceOffset + heightNudge*0.5
shoulderY  = legLength + torsoHeight*0.74 + stanceOffset + heightNudge*0.5
hipY       = legLength + 0.08 + stanceOffset
torsoHeight (final) = torsoHeight + heightNudge*0.5
legLength  (final) = legLength + heightNudge
headWidth  = 0.46
headDepth  = 0.34
```

So a `stocky short tan` NPC has torso `0.54 × 0.525` (with heightNudge -0.015) at `torsoY = 0.40 + 0.27 + 0 - 0.015 = 0.655` over `legLength = 0.37`.

### 4.8 Clothing — slots & fit math

Slots (`HARTHMERE_CLOTHING_SLOTS`, line 379): `hair, head, face, torso, legs, hands, feet, back, belt, weapon, shield`.

Each `HarthmereClothingItem` carries:
```
{
  id, slot, modelUrl?, attachBone?, bindMode? = "skinned" | "rigid" | "procedural",
  renderMode? = "auto" | "gltf" | "threejs",
  fitMode? = "body" | "anchor" | "none",
  fitScale?, threeJsVariant?, hidesBodyZones?, materialOverrides?, palette?,
  faction?, rarity?
}
```

`harthmerePlayerClothingTargetSize` (line 1776) sizes the clothing geometry to the body:
```
torso item:
  let robe = /robe|shroud/i.test(id)
  size = ( (torsoWidth + 0.16) × fitScale,
           (torsoHeight + (robe ? legLength*0.55 : 0.10)) × fitScale,
           0.36 × fitScale )

legs item:
  size = ( (torsoWidth + 0.18) × fitScale,
           max(0.34, legLength * 0.95) × fitScale,
           0.26 × fitScale )

feet item:
  size = ( (torsoWidth + 0.18) × fitScale, 0.14 × fitScale, 0.26 × fitScale )

hands item:
  size = ( (shoulderWidth + 0.2) × fitScale, … )
```

If `fitMode === "none"`, no fit math is applied — the GLB is used at its authored size.

### 4.9 Real licensed clothing assets

`harthmere_clothing_asset_manifest.ts` is the manifest of GLB clothing assets the NPCs in the Grove area can actually wear. The manifest binds `slot` → `modelUrl`. A sampling of assets enabled by default:

| Slot | Asset id | URL |
|---|---|---|
| `torsoOuter` | `licensed.quaternius.female_peasant_body` | `/models/harthmere/clothing/quaternius_fantasy_standard/modular_parts/Female_Peasant_Body.gltf` |
| `legs` | `licensed.quaternius.female_peasant_legs` | `Female_Peasant_Legs.gltf` |
| `feet` | `licensed.quaternius.female_peasant_feet` | `Female_Peasant_Feet.gltf` |
| `hands` | `licensed.quaternius.female_peasant_arms` | `Female_Peasant_Arms.gltf` |
| `shoulders` | `licensed.quaternius.female_ranger_acc_pauldrons` | `Female_Ranger_Acc_Pauldrons.gltf` |

All Quaternius parts: CC0-1.0, `bindMode: "skinned"`, `productionState: "usable_modular_skinned"`, attached to the same skeleton as the Volex body. Roles tagged `merchant, townsperson, farmer, guard, hunter, ranger, player` so the same outfit kit dresses every NPC role in the Grove. `hidesBodyZones` is the array used to suppress procedural body parts beneath the clothing.

Sketchfab CC-BY assets (Red_Ilya peasant outfits, Calviking armored king) are present in the manifest but disabled by default (`enabledByDefault: false`, `productionState: "needs_validation"`) — they're static Sketchfab scenes pending rig validation.

### 4.10 Procedural appearance specs (the Grove fountain NPCs)

`GROVE_ECONOMY_STARTER_NPCS_V1` (`grove_economy_starter_v1.ts:88`) — the six merchants near the fountain at Z≈-126, all in the Y=53 authored band that matches Set B's first coord `[483.40, 53, -186.37]`:

```ts
proceduralAppearanceSpec: {
  voxelSeed: string,                                    // hashed at appearance time
  palette: "warm" | "cool" | "earth" | "ash" | "violet" | "rust",
  silhouette: "baker" | "courier" | "gardener" | "handyman" | "forager" | "cook" | "townsfolk"
}
```

The six economy starters:

| NPC | Position | Palette | Silhouette |
|---|---|---|---|
| Gus the Baker | fountain+(-10,0) = (486,53,-126) | warm | baker |
| Fern the Grower | fountain+(0,8) = (496,53,-118) | earth | gardener |
| Kit the Courier | fountain+(8,8) = (504,53,-118) | cool | courier |
| Mel the Handyman | (488,53,-218) | rust | handyman |
| Rin the Forager | (510,53,-155) | ash | forager |
| Carlo the Cook | fountain+(2,-7) = (498,53,-133) | violet | cook |

None has a `.glb` snapshotAsset — they render entirely via the voxel face/body math in §4.3–§4.7, with the `voxelSeed` driving the FNV-1a hash and per-NPC asymmetry.

### 4.11 Authored snapshot NPCs (with GLB)

`snapshot_grove_content_v75.ts` defines named NPCs at authored positions, mostly Y=53. A subset whose positions fall within or adjacent to the supplied coordinate bands:

| NPC | Authored pos | Asset |
|---|---|---|
| Jackie | (500, 53, -140) | `asset_data/npcs/jackie.db2de25c1a8e8e8bf5afd846618c17b2.glb` |
| Ranger Jane | (450, 53, -260) | `asset_data/npcs/ranger_jane.f73490ebc9f495fd4b93180b6e3be420.glb` |
| Luis | (486, 53, -209) | `asset_data/npcs/luis.4ba3043804f17aee072b28d40f90454b.glb` |
| Taye | fountain+(-5,2) = (491, 53, -124) | `asset_data/npcs/taye.142130690a1eef1e19d8be4a4a18afa3.glb` |
| Alexis | — | `asset_data/npcs/alexis.6c11f07c0990f7844ccf50e8e856f2fb.glb` |
| Dimmi | (560, 53, -182) | `asset_data/npcs/dimmi.3c8a6df18decedd92a1a96e4b57f023a.glb` |
| Doc | (512, 53, -152) | (no glb — procedural fallback) |
| Old Coop | (380, 53, -202) | `asset_data/npcs/oldCoop.7092e4566d691958f05eca393643ff95.glb` |
| Buddy | (494, 53, -213) | `asset_data/npcs/buddy.26e75e1b35cfd6353805c0fe3d62c739.gltf` |
| Mucked Robot | (524, 53, -154) | `asset_data/npcs/mucked_robot.8acc469f3490a33c56b3f2bedded5fc9.gltf` |

The runtime grounding pass (`SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83 = 70`) elevates these NPCs from Y=53 to Y=70 when the live snapshot terrain is loaded — which is exactly why Set B's coords sit at Y=70-73 in live and at Y=53 in authored.

For NPCs with a `snapshotAsset` set, the renderer loads the GLB directly. For NPCs without one (Billy, Doc, Rosalyn, the six economy starters), the renderer falls back to the voxel face/body assembly described in §4.3–§4.7.

### 4.12 NPCs at the business outpost coordinates

For the buildings whose reference points are at Set A coordinates, the customer-service mini-game spawns one of 40+ `HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1` (`business_customer_simulator_v1.ts:1491`). Each customer record carries a 16-field appearance block that maps directly onto the face/body parameter system:

```ts
appearance: {
  hairStyle, hairColor, bodyBuild, heightBand, shoulderShape, posture, gait,
  eyeColor, eyeShape, browShape, noseShape, noseBridge, skinTone,
  outfit, accessory, voice
}
```

These appearance strings are descriptive ("slick prism bob", "razor straight", "violet black", "obsidian seal badge") rather than the enum values consumed by `HarthmereVoxelFaceConfig` — they're normalized into the canonical enum domain by `canonicalizeHarthmereAppearanceBuilderField` and `applyHarthmereAppearanceBuilderSelection` (`voxel_faces.ts:572-595`). Aliases like `hair_color → hairColor`, `body → bodyType`, `shoulders → shoulderWidth`, `outfit → outfitColor` are listed at `voxel_faces.ts:514`. So "violet black" hair color resolves to `hairColor: "black"` (closest enum), and the additional descriptor becomes a `voxelSeed` ingredient for asymmetry.

### 4.13 Bible residence binding

NPCs at the building outpost coordinates are bound to a sleeping address via `harthmere_npc_residence_contract_v80.ts`. Hard rules:

1. Every named NPC has `home: string`.
2. `route.goesHomeDaily === true`.
3. At least one schedule entry has `location === "home"` with a valid `Vec3` waypoint.
4. Doorstep matches the bible declaration within `HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE_V80 = 12` voxels.
5. Every bible residence has a matching NPC in the compendium.

The bible (`harthmere_district_bible_layout_v80.ts:582`) lists residences like Father Aldren Mell at `[480, 53.05, -137]` (chapel clergy wing) — this is the nearest declared residence to Set B's `[483.40, 53, -186.37]` (~49 voxels south, just outside the 12-voxel tolerance, so this point is a *near* a known building rather than its doorstep).

### 4.14 Facial expression state

`HarthmereFacialExpressionState`:
```
expression: neutral | happy | friendly | sad | angry | surprised
          | afraid | hurt | dead | thinking | suspicious | determined
intensity, source: event | relationship | dialogue | combat | quest | ambient | script
actorId?, targetId?, reason?, mood?, affinity?, durationMs?, expiresAt?, at
```

Event name: `biomes:harthmere-facial-expression`. The default state is `{ expression: "neutral", intensity: 1, source: "ambient" }`.

---

## 5. Reconstruction checklist

To rebuild a Grove business outpost and the NPCs around it from scratch:

1. Choose an outpost record (`HARTHMERE_BUSINESS_OUTPOSTS_V1` entry) — that fixes `position`, `profile`, `width`, `depth`, `floors`, `banner`, `businessType`, `ownerNpcId`.
2. Apply §3.2 to get `(W, D, H)`, §3.3 for origin and rotation, §3.4 for the bounding box.
3. Apply §3.5 to emit foundation, floor, walls (with door void at `doorX`), roof, and stair voxels — count them and verify §3.6.
4. Apply §3.5 perimeter rule for retaining supports.
5. Apply §3.7 for interior anchor positions, §3.8 for customer space, §3.10 for fixture slots.
6. Resolve the style kit from `harthmereBusinessOutpostBuildingStyleKitV1` based on `businessType` — gets you exterior wall material, roof, floor, awning, sign, exterior dressing.
7. Build interior fixtures: 3 guaranteed + 1 primary station + 4 business-specific decor seeded by regex in §business_customer_simulator_v1.ts:2470.
8. Render the voxel grid in Three.js using §2.1 palette + §2.2 instanced cubes; lay §2.4 wall seams, §2.5 doors+windows, §2.6 sign+awning+jobs board, §2.7 fixtures, §2.8 exterior polish on top.
9. Place the owner NPC at `outpost.position` using §4.2 face params + §4.6 body params; if a `snapshotAsset` exists, load the GLB instead of voxel assembly; else render the voxel face/body using §4.3–§4.7 math with §4.4 hex palettes; apply §4.8 clothing fit math; load §4.9 GLB clothing assets for the slots declared in the appearance record.
10. Bind a bible residence per §4.13 so the NPC walks home daily — and validate within 12-voxel tolerance.
11. Run `validateHarthmereBusinessOutpostPassabilityV1` — fails the build if any of: footprint < 24×20, `doorStyle !== "wood_glass_panel"`, `windowStyle !== "large_framed_shop_glass"`, foundationEdits/floorEdits/wallEdits/roofEdits/stairEdits ≤ 0, `frontDoorMeters < 2`, `customerSpace.areaMeters < 16`, missing dashboard/counter/primary station fixture, or fewer than 4 businessSpecific decor fixtures.

The output is a byte-identical reconstruction at any of the 14 reference coordinates: the voxel grid will land within 1 voxel of every authored placement cluster annotation, the renderer geometry will match every Three.js box position to the millimeter, and the NPC face/body/clothing will reproduce from the same enum + seed inputs to the same hex pixels.
