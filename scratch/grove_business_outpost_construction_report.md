# Grove Business Outpost — Construction, Design & Aesthetics Report

## 1. The two coordinate sets

### Original 8 — the canonical reference array

All eight original coordinates are the frozen array `HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES_V1` at `src/shared/harthmere/business_customer_simulator_v1.ts:399-408`. Immediately below it (lines 410-577) is `HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN_V1`, which annotates each index with what was found at that exact spot during the design pass. The annotations are explicit:

| Idx | Coord | Source | What's there |
|---|---|---|---|
| 0 | `[496.7, 68, -157.3]` | authored_placement_cluster (`harthmere_assets.ts`) | supported wall cabinet, supported bottle shelf, bench seating with clear aisle, grounded sign with supported notice, floor crate and chest dressing |
| 1 | `[479.2, 70, -89.6]` | authored_landscape_cluster | soft Grove landscape edge, naturalized gathering props, clear path kept open around vegetation (assets: `tree_crooked`, `tree_high`, `logs`, `rock_small`) |
| 2 | `[503.8, 62, -156.3]` | authored_placement_cluster | low stone boundary wall, bookcase and cabinet against walls, reading table with supported books and scrolls, small light props supported on furniture |
| 3 | `[503.7, 68, -160.4]` | authored_placement_cluster | business-specific shelves against walls, long service table clear of doorway, supported recipe object on table, supported candle/lantern accent |
| 4 | `[477.3, 70, -73.8]` | live_world_snapshot_reference | observed from screenshot in `buiness-biomes.azurecontainerapp` — door/window/furniture style from visual reference |
| 5 | `[787.3, 68, -132.0]` | live_world_snapshot_reference | same — player-reported position in production Grove |
| 6 | `[788.7, 73, -151.7]` | live_world_snapshot_reference | same |
| 7 | `[784.4, 72, -143.1]` | live_world_snapshot_reference | same |

The scan also publishes a `reusableAssetVocabulary` of the actual prefab assets the procedural shells are meant to draw from:

- **Shell:** `arch_wall_stone`, `arch_wall_window_stone`, `arch_wall_window_glass`, `arch_wall_wood_door`, `arch_roof_gable`, `arch_roof_flat`, `arch_stairs_wide_stone`, `obj_wall_stairs`, `obj_church_grave_wall`
- **Interior:** `table_small`, `table_medium`, `table_long`, `bench_fp`, `cabinet`, `bookcase_2`, `shelf_large`, `shelf_small_bottles`, `candle_triple`, `crate_wooden_fp`, `chest`
- **Exterior:** `obj_sign_post`, `scroll_1_fp`, `logs`, `rock_small`, `tree_crooked`, `tree_high`

So *windows*, *wide stone stairs*, and *plant assets* are first-class shell vocabulary even though the voxel pusher only emits the structural cobblestone slabs — they're the prefabs the visual layer dresses the shell with.

### New 6 — Y-band tells you which grounding pass produced them

These coordinates aren't in the source as named constants. Their Y values place them in two known grounding bands:

| Coord | Y band | What that means |
|---|---|---|
| `[483.4, 53, -186.4]` | **53** = `SNAPSHOT_GROVE_NPC_FEET_Y_V75` and `GROVE_ECONOMY_STARTER_NPC_FEET_Y_V137` | Authored-bible NPC feet height. Snapshot-grove or grove-economy NPC position. Sits south of the chapel (`father_aldren_mell` doorstep `[480, 53.05, -137]`) and near the `mara_thistle` Mudden Ward terrace (`[456, 53.05, -256]`). |
| `[452.9, 73, -165.0]` | 73 | Live world Y — `SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83` is 70, so 73 is a meter-and-a-half of standing height above live ground. Walkable terrain west of the fountain. |
| `[440.1, 71, -125.3]` | 71 | One block above live ground — observer or NPC head height directly west of the fountain (`[496, 70, -126]`). |
| `[444.6, 70, -112.2]` | **70** = `SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83` | Live NPC feet height in the Westtrail / Lovely Locks corridor. |
| `[511.9, 70, -60.9]` | 70 | Live NPC feet in the northeast clearing past the fountain. |
| `[531.9, 70, -65.7]` | 70 | Same band, 20 voxels east of the previous. Pair lines up with NPC spawns in `npc_compendium_v45.ts` around `x≈531-532, z≈-120` — likely the same NPC family extended north. |

The pair north (`X≈512, 532, Z≈-60 to -66`) doesn't match any business outpost from `HARTHMERE_BUSINESS_OUTPOSTS_V1` directly — those run X=335-690, Z=-92 to -334. So these new points are **observer/NPC positions in the Grove townfolk patch**, not new outposts. The procedural building system is what *makes* outposts; these coords describe the **people who work and customer them**.

## 2. People and merchants in the area

### Owner merchants (per outpost)

Every outpost in `HARTHMERE_BUSINESS_OUTPOSTS_V1` (`business_customer_simulator_v1.ts:2200-2220`) names exactly one owner NPC via `ownerNpcId`. They're paired one-to-one with the building:

| District | Owner | Business |
|---|---|---|
| Ashline Works | `npc_outpost_ashline_foreman` | Containment Works (refinery) |
| Cinderlane | `npc_outpost_cinderlane_smith` | Cinderlane Tool Forge |
| Greenlamp | `npc_outpost_greenlamp_doctor` | Greenlamp Walk-In Clinic |
| Lanternrest | `npc_outpost_lanternrest_host` | Lanternrest Road Inn |
| Moonstall | `npc_outpost_moonstall_warder` | Moonstall Ward Shop |
| Redpot | `npc_outpost_redpot_cook` | Redpot Service Kitchen |
| (19 total) | … | … |

Each owner ships with a `job` block — `title`, `starterTask`, `rewardGold`, `teaches` — so the merchant doesn't just stand at a counter, they *give the player work*. Example: the smithy owner offers "Forge Helper" (sort repair tools and quench buckets, 75 gold, teaches "Repairs, upgrades, and gear quality").

### The Grove economy starter merchants (fountain townsfolk)

A second roster — `GROVE_ECONOMY_STARTER_NPCS_V1` in `grove_economy_starter_v1.ts:88` — anchors six early-economy archetypes around the fountain at `[496, 53, -126]` using `groveEconomyStarterFountainPositionV137(dx, dz)`:

- **Gus the Baker** — `(-10, 0)` from fountain center, "fountain baker, ration packer, and dawn supplier"
- **Fern the Grower** — `(0, 8)`, garden-bed keeper
- **Kit the Courier** — `(8, 8)`, dispatcher
- **Mel the Handyman** — `[488, 53, -218]`, Crossroads fixer
- **Rin the Forager** — `[510, 53, -155]`, muck-edge forager
- **Carlo the Cook** — `(2, -7)`, festival caterer

Each has a `proceduralAppearanceSpec` (`voxelSeed`, `palette`: warm/cool/earth/ash/violet/rust, `silhouette`: baker/courier/gardener/handyman/forager/cook). No bespoke `.glb` — the appearance manifest in `grove_townsfolk_appearance_v1.ts` hashes the seed for repeatable color/shape.

### Customer NPCs (session-only)

The `HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1` array (line 1491) holds **40+ session-only customers** — Aki Bell, Bren Marlow, Cira Plink, Doss Quart, Era Vey, … through Ximo Lark. Each has `customerOnly: true`, `mapPlacement: "none"`, and `spawnPolicy: "business_owner_session_only"`. Each declares:

- `businessPreferences`: which 2 business types they walk to (e.g. Luca Merrit → inn + restaurant; Mirae Dusk → maintenance + refinery)
- `patience`: ms before they walk out (range 44–92)
- `budgetTier`: 1–5
- `temperament`: polite / demanding / hungry / luxury / haunted / festival / shifty …
- 16-field `appearance` block (hairStyle, hairColor, bodyBuild, heightBand, shoulderShape, posture, gait, eyeColor, eyeShape, browShape, noseShape, noseBridge, skinTone, outfit, accessory, voice)

So when an owner activates the customer-service mini-game, the system pulls a pool of these and spawns them at the entrance node. They never persist to the world map.

### Employees and the hiring loop

`business_employee_ai_v1.ts` models hired NPC staff with:

- **Roles** (`HarthmereBusinessEmployeeAutomationRoleV1`): front_counter, branch_manager, courier_dispatch, purchasing_manager, quality_inspector — each with a `stationNode`, `actionLabel`, and `serviceCapacityWeight` (3, 4, 2, etc.)
- **Personalities**: warm, precise, practical, curious, steady, ambitious, shy, bold
- **Schedules**: morning, midday, evening, flex
- **Candidate negotiation**: skill, wage ask, interview score, negotiation rounds, expiry timestamp
- **Layout-aware navigation**: each employee has an `employeePath` through the layout nodes (customerEntry, employeeEntry, employeeCounter, stockRoom, prepStation, cleanupStation, dispatchDesk, branchDesk, employeeExit) with `pathAudit` and `collisionAudit` results

### Residence binding (where merchants sleep)

`harthmere_npc_residence_contract_v80.ts` enforces five hard rules:

1. Every named NPC has a non-empty `home`.
2. `route.goesHomeDaily === true`.
3. At least one schedule entry has `location === "home"` with a valid Vec3 waypoint.
4. The home waypoint matches the canonical residence doorstep declared in `harthmere_district_bible_layout_v80.ts` within a **12-block tolerance** (`HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE_V80 = 12`).
5. Every bible residence has a matching NPC in the compendium.

So merchants aren't decorative — they have a contractual home address, a daily schedule that walks them home, and a CI test that fails the build if the chain breaks. The bible residences (`HARTHMERE_BIBLE_NPC_RESIDENCES_V80`) list e.g. Sergeant Bram Holt at `[512, 53.05, -264]` (guard barracks upper room), Reeve Caldus Merrow at `[562, 53.05, -262]` (Reeve's Hall), Father Aldren Mell at `[480, 53.05, -137]` (chapel clergy wing) — note that the new coord `[483.4, 53, -186.4]` sits in this same Y=53 authored band, halfway between the chapel and Mudden Ward residences.

## 3. Block palette — what every voxel is made of

`BUILDING_BLOCKS_V1` (`building_system_v1.ts:529-548`):

| Slot | Bikkie block | Function |
|---|---|---|
| foundation | `cobblestone` | one-block subsurface slab |
| floor | `stone` | walkable ground inside |
| frame | `oakLog` | corner posts and door headers (stage builds only) |
| wall | `cobblestone` | exterior shell |
| roof | `stone` | flat standable ceiling/roof |
| stair | `woodenStepper` | single-step doorsill |
| interior | `woodContainer` | shop fittings / placeholders |
| safeGround | `dirt` | non-shell terrain pad (farms/utilities) |
| boundaryMarker | `woodenFencer` | plot perimeter pickets |
| deedMarker | `smallOakSign` | claim sign at corner |
| mapMarker | `bboxMarker` | invisible navigation marker |
| storageContainer | `woodContainer` | shop stock chest |
| doorLock | `smallOakSign` | door state indicator |
| businessMarker | `bboxMarker` | counter beacon |
| upgradeWall | `stone` | second-floor partition for tier upgrades |

## 4. Shell construction — step by step

`createBuildingSystemMaterializationPlanV1` builds a `solid_structure` blueprint in this order (`building_system_v1.ts:2116-2134`):

1. **Foundation slab** — `pushVoxelBox([x0, y0−1, z0], [x1, y0, z1], cobblestone, "foundation")`. One layer at y0−1, filling the full footprint.
2. **Floor slab** — `pushVoxelBox([x0, y0, z0], [x1, y0+1, z1], stone, "floor")`. One layer at y0.
3. **Walls** — `pushBuildingWallsV1` from `y0+1` to `wallTop = y0 + max(3, height−1)`. Solid cobblestone rectangle on all four sides. The only gap is a 1-voxel-wide × 2-voxel-tall **doorway** at `(doorX, y0+1)` and `(doorX, y0+2)` on the south face (z = z0).
4. **Roof slab** — `pushVoxelBox([x0, roofY, z0], [x1, roofY+1, z1], stone, "roof")`. roofY = wallTop. Doubles as the ceiling.
5. **Front stair** — single `woodenStepper` at `(doorX, y0, z0−1)`, only if that voxel lies inside `plot.bounds.zMin`.

For Harthmere business outposts, **two extra passes** wrap that recipe:

- `addHarthmereOutpostRetainingFoundationSupportsV1` (line 2677): cobblestone support columns from `y0−8` to `y0−1` every 4 voxels around the plot perimeter, so the floor stays grounded on sloped terrain.
- `createHarthmereBusinessInteriorFixturesV1` (line 2578): publishes the interior fixture list (queue, counter, dashboard, primary station, four decor pieces) — **as metadata, not voxel writes**.

The complete materialization emits, for an audit:

```
foundationEdits, floorEdits, wallEdits, roofEdits, stairEdits
```

The passability validator (`validateHarthmereBusinessOutpostPassabilityV1`, line 2913) refuses to accept a building if any of those counts are 0.

## 5. Doorways, doors, windows, ceilings

### Doorway

The doorway is a deliberate **void** in the wall pusher. From `pushBuildingWallsV1` (line 1788):

```ts
const doorX = Math.floor((x0 + x1) / 2);
for (let y = y0+1; y < wallTop; y++) {
  for (let x = x0; x < x1; x++) {
    const isDoor = x === doorX && (y === y0+1 || y === y0+2);
    if (!isDoor) {
      edits.push({ position: [x, y, z0], value: wall, label: "wall" });
    }
    edits.push({ position: [x, y, z1-1], value: wall, label: "wall" });
  }
  // ...east and west walls always solid
}
```

So the **south wall** is the only face with a hole. It's exactly 1 voxel wide and 2 tall, in the middle. No door entity is placed — the gap *is* the door at the voxel layer. The renderer is expected to consume the style kit's `doorStyle: "wood_glass_panel"` (the only legal value; passability validator rejects anything else) and dress the gap with the `arch_wall_wood_door` prefab from the reusable asset vocabulary.

### Windows

There's **no window cutout in the voxel pusher** — walls are unbroken cobblestone. Windows live in three places:

1. **Style kit declaration**: every outpost has `windowStyle: "large_framed_shop_glass"`. Passability validator fails the build on any other value.
2. **Interior audit flag**: `hasReadableWindows: true`.
3. **Asset vocabulary**: `arch_wall_window_stone` (the framing) and `arch_wall_window_glass` (the pane) sit in the shell asset list, so the renderer can swap window prefabs into wall positions without changing the voxel data.

This split lets the procedural shell stay voxel-correct (solid walls = collision safe) while the visual layer paints in transparent storefront glass.

### Ceilings

The roof slab *is* the ceiling — there's no second slab. Interior headroom = `wallTop − (y0 + 1)`. With the default `height = max(6, floors*4+2)` and `wallTop = y0 + max(3, height−1)`:

- 1-floor building (`floors: 1`, `height: 6`): wallTop = y0+5, headroom = **4 voxels** above the floor
- 2-floor building (`floors: 2`, `height: 10`): wallTop = y0+9, headroom = **8 voxels** above the floor

No intermediate floor slab is generated even when `floors: 2` — see §8.

## 6. Footprint, spacing, and floor area

### Footprint enforcement

`harthmereBusinessOutpostMinigameFootprintV1` (line 2222) forces a minimum playable size before anything else runs:

```
const largeProfiles = {barracks, dock_warehouse, inn, player_services, smithy};
const largeBusiness = /refinery|portal|security|weapons|hospitality/.test(typeId);
const minW = (largeProfiles || largeBusiness) ? 28 : 24;
const minD = (largeProfiles || largeBusiness) ? 22 : 20;
const even = v => v + Math.abs(v % 2);
return { width: even(max(declared, minW)), depth: even(max(declared, minD)) };
```

Width and depth are forced **even** so the centered door, counter, and queue land on integer voxel coordinates. Height = `max(6, floors*4 + 2)`. Outposts that declared `width: 16` get bumped to 24; barracks bumps to 28.

### Origin and rotation

```
origin.x = round(outpost.position.x − width/2)
origin.y = floor(outpost.position.y)
origin.z = round(outpost.position.z − depth/2)
rotation = quantized to {0°, 90°, 180°, 270°}
```

### Interior coordinates derived from the door

`createHarthmereBusinessOutpostProceduralBuildingV1` (line 2714) computes every interior anchor relative to the doorway:

```
doorX         = origin.x + floor(width/2)               // centered on south face
entrance      = (doorX,    y0+1, z0 − 1)                // 1 block south of door
queueNode     = (doorX,    y0+1, z0 + 3)                // 3 blocks inside
serviceCounter= (doorX,    y0+1, z0 + max(8, depth−6))  // back of shop, at least 8 deep
exitNode      = (min(x0+width−3, doorX+2), y0+1, z0+1)  // offset right of door
dashboard     = (max(x0+3, doorX−4), y0+1, max(z0+4, serviceCounter.z−1))  // visible from entrance
jobsBoard     = (entrance.x+3, y0, z0−3)                // outside, 3 north of entrance
```

That gives a guaranteed **walking path** from entrance → queue (3 blocks) → counter (≥5 more blocks) → service spot → exit, with the dashboard accessible to the left of the counter.

### Customer floor space

`customerSpace` is the rectangle a customer can legally occupy without bumping a wall or fixture (line 2806):

```
minX = origin.x + 2
maxX = origin.x + width − 2
minZ = origin.z + 2
maxZ = origin.z + depth − 3
areaMeters = max(0, maxX−minX) * max(0, maxZ−minZ)
```

A 24×20 shop yields a customer space of 20 × 15 = **300 m²**. A 28×22 large shop yields 24 × 17 = **408 m²**.

### Hard clearance numbers

Three measured corridors are stamped on every record under `clearances` (line 2832):

| Clearance | Meters | Validator threshold |
|---|---|---|
| `frontDoorMeters` | 2 | rejects below 2 |
| `shopCustomerSpaceMeters` | 4 | rejects below 4 |
| `publicEntranceMeters` | 3 | rejects below 3 |

And on the **navigation graph** for customer pathing (`nav(typeId)` at line 1505):

```
passableClearance: {
  aisleWidthBlocks:        2,   // every interior aisle 2 voxels wide
  counterClearanceBlocks:  2,   // 2 voxels between customer and counter face
  queueSpacingBlocks:      1,   // customers 1 voxel apart in queue
},
stuckRecovery: {
  repathAfterMs:           2500,
  sidestepRadiusBlocks:    1.5,
  blockedNodeRetryLimit:   3,
  fallbackExitAfterMs:     15000,
  fallbackPolicy:          "repath_then_sidestep_then_exit",
},
```

So the customer queue is 4 customers in 4 voxels (1-voxel spacing), the aisle between fixtures and the counter is 2 voxels wide, and a customer who gets stuck for 15 seconds is force-routed to the exit.

### Fixture spacing rules

`harthmereBusinessInteriorFixturePositionV1` (line 2554) assigns each decor fixture to one of six **named slots** relative to the building:

```
leftX  = origin.x + 3                       // 3 voxels in from west wall
rightX = origin.x + width − 4               // 3 voxels in from east wall
frontZ = origin.z + 5                       // 5 voxels in from south door
sideZ  = max(origin.z + 6, serviceCounter.z − 3)
backZ  = min(origin.z + depth − 4, serviceCounter.z + 3)
```

Slot map:

| Slot | (x, z) |
|---|---|
| `left`       | `(leftX,      sideZ)` |
| `right`      | `(rightX,     sideZ)` |
| `backLeft`   | `(leftX + 1,  backZ)` |
| `backRight`  | `(rightX − 1, backZ)` |
| `frontLeft`  | `(leftX + 1,  frontZ)` |
| `frontRight` | `(rightX − 1, frontZ)` |

Every fixture is placed in one of those six positions — guaranteeing **at least 2 voxels between any decor and the nearest wall**, **at least 3 voxels between front and back decor rows**, and **a clear central aisle** matching the 2-block aisle clearance the navigation graph requires.

Fixture size is recorded in meters as `[width, height, depth]`, with a `blocksNavigation` flag. The guaranteed four (queue space 4.4×0.08×2.0, service counter 6.4×0.95×1.0, dashboard 1.4×1.75×0.6, primary station 1.6×1.25×1.6) set `blocksNavigation: false` for the queue/counter/dashboard and `true` for the primary station. Decor fixtures all set `blocksNavigation: true` and `businessSpecific: true`, and there are exactly 4 of them per outpost so the validator's "≥4 business-specific decor" gate passes.

`fixtureOccupiesNodeV1` (line 2895) computes occupancy by the fixture's footprint (`halfX = size[0]/2`, `halfZ = size[2]/2`) centered on `position + 0.5`, so the customer/employee path solver knows exactly which voxels are blocked.

## 7. Stairs

There are **two distinct stair systems**:

### Voxel doorsill stair (always)

The single `woodenStepper` block at `(doorX, y0, z0−1)` is the only stair the materializer produces. It bridges from `groundY` to the floor at `y0`. The structural audit counts it (`stairEdits`) and the validator rejects any outpost with `stairEdits: 0`.

### Asset-level wide stairs (renderer)

The reusable asset vocabulary includes:

- `arch_stairs_wide_stone` — a wide stone stair prefab
- `obj_wall_stairs` — a wall-mounted stair object

These are the prefabs the renderer is expected to drop on the doorsill voxel to make the entrance feel like the Grove storefront examples — a flush single block at the voxel level, dressed as a wide carved stone step in the visual layer. The styleNotes for shop kits explicitly call out "stone steps":

> "Hospitality and studio shops lean on the Grove wood shop example with warm walls and stone steps."

### Multi-floor stairs

No internal stair is generated by the materializer, even for `floors: 2` blueprints. The upgrade pass (see §8) adds vertical voxels but not a connecting stair — the visual layer is expected to use `obj_wall_stairs` between the floor slab and the upgrade ceiling. This is consistent with how the rest of the second floor is treated: structural in audit, decorative in voxels.

## 8. Multi-level buildings

Three blueprints in `HARTHMERE_BUSINESS_OUTPOSTS_V1` declare `floors: 2`:

- `outpost_security_redoubt` — Redoubt Contract Yard barracks
- `outpost_portal_eastgate` — Eastgate Portal Office
- `outpost_tools_cinderlane` — Cinderlane Tool Forge
- `outpost_hospitality_lanternrest` — Lanternrest Road Inn

For these, `height = max(6, 2*4 + 2) = 10`. Walls rise to `wallTop = y0 + 9`, headroom is 8 voxels. **But no intermediate floor slab is generated by `createBuildingSystemMaterializationPlanV1`** — the building reads as one tall room at the voxel level. The interior audit's `staffWorkstations` count and the fixture placement are all calculated against the single ground-level floor.

### Tier-upgrade pass

`createBuildingSystemUpgradeMaterializationPlanV1` (line 2818) is the only path that actually adds a second story to voxels. Triggered by a property tier upgrade — not by an outpost's declared `floors: 2` — it does three things:

```ts
secondFloorY = roofY + 1;
pushVoxelBox([x0, secondFloorY,   z0], [x1, secondFloorY+1, z1], upgradeWall, "upgrade_addition");  // new floor slab
pushVoxelBox([x0, secondFloorY+1, z0], [x1, secondFloorY+3, z0+1], wall,      "upgrade_addition");  // 2-tall facade
pushVoxelBox([x0, secondFloorY+3, z0], [x1, secondFloorY+4, z1], roof,        "upgrade_addition");  // new roof
```

So an upgraded building gets: original solid block + a stone floor on top of the old roof + a 2-tall wall facade on the south face + a fresh stone roof. No stairs are generated; no door is cut in the upper facade. The upgrade is structurally extant but visually thin until the renderer paints it.

## 9. Plants and landscaping

### Outside the building

The exterior dressing is part of the style kit (`exteriorDressing` field):

- `garden_planters` — default for hospitality, property, design, food, farming, trader
- `workshop_crates` — refinery, repair, sanitation, weapons, security, hunter, courier
- `clean_clinic_lanterns` — medical
- `arcane_lanterns` — portal, teleport, magic, exotic
- `market_baskets` — farming, trader (when not garden_planters)

The `authored_landscape_cluster` at coord index 1 — `[479.2, 70, -89.6]` — is the design team's reference for what `garden_planters` should look like, using the assets `tree_crooked`, `tree_high`, `logs`, `rock_small`. The features they captured:

- soft Grove landscape edge
- naturalized gathering props
- clear path kept open around vegetation

### Inside the building

Plants inside outposts come through **business-specific decor seeds** matched by regex on `businessType` (line 2470):

- **Farming / hunter** outposts get: Freshness scale, **Cold larder shelf** (1.3×1.9×2.5 m), **Harvest crate stack** (1.4×1.2×1.4 m), Wrapping table. The harvest crate effectively stages produce inside the shop.
- **Restaurant**: Cooking hearth, **Ingredient pantry** (1.3×1.9×2.4 m, stock_storage role), Dining bench pair, Steam pot prep table.
- **Design / property studios** get: Blueprint drafting table, Sample wall, Material swatch stand, Client bench — the sample wall and swatch stand carry plant samples per the offer "Build terrain palette: Assemble color, stone, and plant samples."
- **Hospitality**: Room key wall, Guest bench, **Linen chest**, Welcome sideboard.

The Grove-economy starter NPCs add live-world plant beds outside the procedural system: `GROVE_ECONOMY_STARTER_LANDMARKS_V1` declares `econ_fern_garden_plot` ("Fern's Sprout Beds") and `econ_fern_berry_patch` as interactable landmarks adjacent to Fern's spawn at fountain offset `(0, 8)`. Customer asks reference these — e.g. the herb bundle offer in the Southplot Rare Foods minigame requires `{ herb_bundle: 1 }`.

### Plantable items in player hands

Two BikkieIds in the bikkie graphics catalog have `action: "plant"`:

- **Seed graphic** — "Plantable seed graphic for crop businesses and rare-food counters."
- **Carrot seed graphic** — "Plantable carrot seed graphic for farm stock and customer seed packets."

So plants enter the world via merchants (sold at farming counters), customers (received as seed packets), and the renderer (decorative trees and shrubs around `garden_planters` exteriors).

## 10. Items being sold — offers, asks, prices

Every business publishes a `HarthmereBusinessMiniGameDefinitionV1` (lines 1554+) with offers, ask templates, progression, and challenge growth. Pattern:

```
offers: [
  { offerId, label, description, serviceNeed, requiredItems, producedItems?, rewardGold, satisfactionDelta, interactionVerb, animationCue }
]
askTemplates: [
  { askId, line, desiredOfferId, patience, difficulty, rewardGold, reputationDelta, needDelta, funAction, navGoal }
]
```

### Sample inventories

**Exotic Matter Refinery** (Ashline Containment Works):

| Offer | Requires | Produces | Gold |
|---|---|---|---|
| Hand over certified fuel | `certified_portal_fuel × 1` | — | **150** |
| Stabilize a sample | `stabilized_exotic_matter × 1`, `containment_filter × 1` | `spent_filter × 1` | **125** |
| Run containment audit | `containment_filter × 1` | — | **95** |

**Biome Maintenance/Repair**:

| Offer | Requires | Gold |
|---|---|---|
| Inspect anchor | `repair_kit × 1` | 80 |
| Tune climate | `stabilized_exotic_matter × 1`, `repair_kit × 1` | 125 |
| Patch timeline leak | `anchor_part × 1`, `repair_kit × 1` | 145 |

**Biome Design Studio**:

| Offer | Requires | Gold |
|---|---|---|
| Show habitat mockup | `design_pack × 1` | 90 |
| Build terrain palette | `decor × 1`, `tree_resin × 1` | 105 |
| Set lighting scene | `lighting_kit × 1` | 115 |

**Rare Foods** (Southplot):

| Offer | Requires | Gold |
|---|---|---|
| Pack medicinal herbs | `herb_bundle × 1` | 70 |
| (plus crop bundles, freshness tags) | | |

Each ask binds to one offer by `desiredOfferId` and sets `navGoal` to one of `counterNodeId` / `serviceNodeId` — i.e., the ask tells the customer NPC which interior node to walk to. Patience values run 38–70 in-game ticks.

### Progression (line 1529)

Every business shares a 4-tier ladder:

| Tier | Trigger | Reward | Unlock |
|---|---|---|---|
| 1 Counter | Serve 5 customers | +1 queue slot | Basic orders |
| 2 Back Room | 20 customers + 3-streak | +5 satisfaction floor | Staff-assisted service |
| 3 Branch | 50 customers + 10 contracts | +1 service radius | Remote tickets |
| 4 Empire | 120 customers across locations | +10 reputation cap pressure | Regional franchise |

### Item categorization

`HarthmereBusinessServiceItemRoleV1`: `component`, `consumable`, `container`, `paperwork`, `tool`, `finished_good`, `waste`. Items get classified by string match on the itemId (e.g. `/meal|ration|soup|water|medicine|bandage|potion|food|meat|crop|herb/` → consumable).

### Bikkie graphic catalogue (the physical stock)

`HARTHMERE_BUSINESS_BIKKIE_GRAPHIC_BASES_V1` (line 571) defines 60+ in-world placeable graphics with metadata: bikkie ID, label, kind (crafting_station / tool / utility / container / document / food / seed / crop / fish / mail / comfort / arcade), description, color palette, optional `galoisPath`, `boxSize`, `voxelSize`, station type, `isTool`, `isPlaceable`, `buildingRequirement` (none / roof / noRoof). A sampling:

- **Workbench** — 1×1×3 oak, general crafting (any building)
- **Thermoblaster** — 3×3×3 stone, hazardous heat processing
- **Kitchen** — 1×1×4 oak, cooking, **requires roof**
- **Seed Mill** — 1×3×1 oak/brass, **requires no roof**
- **Tailoring Booth** — 4×1×3 oak
- **Dye-O-Matic** — 3×3 dyeing station
- **Arcade Machine** — 1×2×1 cabinet
- **Anglers' Table** — 2×2×3 prep table
- **Composter** — 1×2×3, requires composting kind
- **Bucket / Camera / Remote Control / Homestone / Power Cell** — tools

Each business gets the subset relevant to it (resolved by `getHarthmereBusinessBikkieGraphicsV1`), with one nominated as the **primary station** — that's the prop the procedural generator places at `(origin.x + width − 5, origin.y + 1, min(z0 + depth − 4, serviceCounter.z + 2))` with size `1.6 × 1.25 × 1.6 m`, marked `businessSpecific: true`.

## 11. Style kits — aesthetics per business family

`harthmereBusinessOutpostBuildingStyleKitV1` (line 2352) returns a kit per business. The base style notes always start with:

> "Backend procedural voxel shell with a grounded stone foundation, readable door, large shop glass, and a visible interior dashboard access point."
> "Scaled for business mini-game customers, staff workstations, queueing, and passable service flow."
> "Standardized against the provided Grove reference coordinates for doors, storefront windows, interior furnishing, stone steps, and landscaping."

Then per family:

| Family | Walls | Roof | Floor | Awning | Sign |
|---|---|---|---|---|---|
| **Medical** | clean_stone_tile | green_roof_sod | wood_floor | white_canvas | cross |
| **Workshop** (refinery, repair, sanitation, hunter) | dark_workshop_stone | green_roof_sod | clean_stone_tile | white | hammer |
| **Workshop — armed** (weapons, security) | clean_stone_tile | red_clay_roof | clean_stone_tile | red_canvas | shield/hammer |
| **Arcane** (portal, teleport, magic, exotic) | clean_stone_tile | green_roof_sod | clean_stone_tile | purple_canvas | spark |
| **Courier** | warm_wood_plank | green_roof_sod | wood_floor | white | parcel |
| **Hospitality / property / design** | warm_wood_plank | green_roof_sod | wood_floor | white | key / star |
| **Default** (food, farming, trader) | warm_wood_plank or clean_stone_tile | red_clay (food) / green sod | wood_floor | red (food) / white | leaf / star |

Universals: `foundation: "stone_foundation"`, `doorStyle: "wood_glass_panel"`, `windowStyle: "large_framed_shop_glass"`, `trim: "carved_limestone"` or `"warm_wood_plank"`.

`referenceLanguage` is one of `grove_wood_shop`, `grove_stone_storefront`, `grove_workshop_warehouse` — pointing the renderer at the original reference cluster.

## 12. Validators — the contract the build must satisfy

`validateHarthmereBusinessOutpostPassabilityV1` (line 2913) is the gate every outpost passes through:

- footprint width ≥ 24, depth ≥ 20
- `serverOwned`, `sourceOfTruth = "backend_procedural_voxel_building"`, `generationMode = "building_system_materialization_plan"`, `materializesSolidVoxelBuilding`
- style kit present with `doorStyle = "wood_glass_panel"`, `windowStyle = "large_framed_shop_glass"`, and at least one styleNote that mentions "Grove"
- foundationEdits, floorEdits, wallEdits, roofEdits, stairEdits all > 0
- frontDoorMeters ≥ 2, shopCustomerSpaceMeters ≥ 4, publicEntranceMeters ≥ 3
- customerSpace.areaMeters ≥ 16
- dashboard visible from entrance + keyboardless traversal
- interior fixtures include `dashboard_access`, `service_counter`, `primary_station`
- ≥ 4 `businessSpecific` decor fixtures
- customerQueueCapacity ≥ 4, staffWorkstations ≥ 2

`hasReadableWindows`, `hasAccessibleDoor`, `hasCustomerDashboardAccess`, `hasBusinessSpecificDecor`, and `minigameReady` are all `true` flags in the `interiorAudit` block. If any check fails the build is rejected upstream — these aren't soft warnings.

## 13. End-to-end: what happens when a building materializes

1. Resolve `outpost` from `HARTHMERE_BUSINESS_OUTPOSTS_V1`.
2. `harthmereOutpostBlueprintForV1(outpost)` → blueprint with structureTypeId (warehouse/shop/workshop), footprint, height, plotType, storageSlots.
3. `harthmereOutpostPlotForV1` → plot with bounds (footprint + 8-voxel margin), roadAccessDistanceVoxels=6, maxCoveredAreaFraction=0.75, terrainType="stone".
4. `harthmereOutpostOriginV1` → centered origin.
5. Compute doorX, entrance, queue, counter, exit.
6. `createBuildingSystemMaterializationPlanV1` → foundation slab + floor slab + walls (door gap) + roof slab + doorsill stair.
7. `addHarthmereOutpostRetainingFoundationSupportsV1` → perimeter support columns.
8. `harthmereBusinessOutpostBuildingStyleKitV1` → style kit (materials, awning, sign icon, dressings).
9. `dashboardAccessPoint` + `jobsBoardPosition` computed.
10. `createHarthmereBusinessInteriorFixturesV1` → 3 guaranteed + 1 primary + 4 business-specific fixtures, each at one of six named slots.
11. `materializationPlan.inWorldMarkers` populated: `business-counter`, `customer-dashboard`, `jobs-board`, optional bikkie marker.
12. Record assembled with `interiorAudit`, `structuralAudit`, `clearances`, `customerSpace`, `buildingStyleKit`, `interiorFixtures`, `bikkieGraphics`.
13. `validateHarthmereBusinessOutpostPassabilityV1` runs — any error rejects the building.
14. Owner NPC (per outpost) is bound, employee AI loop attaches via `business_employee_ai_v1`, customer NPCs draw from `HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1`, residence contract enforces that the owner sleeps in the bible-declared building each night.

Every voxel of the shell, every meter of clearance, every fixture slot, every customer NPC, every offer price, every progression tier, and every aesthetic token is generated from the same definition file — `business_customer_simulator_v1.ts` plus `building_system_v1.ts` — so the building, the merchant, the customer, the goods on the shelf, and the validator all share one source of truth.
