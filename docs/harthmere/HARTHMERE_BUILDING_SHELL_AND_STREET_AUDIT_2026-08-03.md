# Harthmere building shell and street audit — 2026-08-03

Scope: the **buildings themselves** and the **streets between them**, in the additive
flat-terrain Harthmere region (Sergeant Bram, the Bell Tower, the Bible-quest start).
Interiors and furniture are explicitly out of scope; the existing
`HARTHMERE_ALL_BUILDINGS_INTERIOR_LORE_AUDIT.md` covers those and remains the
brief for a later pass.

Sources read: the Harthmere Medieval MMO Town Design Bible (§5.2 architectural
grammar, §5.4 signage, §7 district bible), the Bellbound story bible, the
all-buildings interior lore audit, `HARTHMERE_BUILDING_AND_DECORATION_DESIGN_GUIDE.md`,
`harthmere_town_buildings.ts`, the shell generator in `src/server/shim/main.ts`,
and the renderer's block-built service buildings in
`src/client/game/renderers/local_dev/harthmere_assets.ts`.

---

## Executive summary

The town's 57 shells were structurally sound in the ways that are easy to test —
four walls, a roof, a door in a wall — and broken in the ways that are not.
Seven pairs of buildings interpenetrated. Thirteen front doors opened into a
neighbour's wall. Two balconies hung through the building next door. Four
buildings whose lore requires an upper floor declared one storey, so the room
had nowhere to be. Nine staircases stood in their own doorway. And the town had
no streets at all — the three constants named as if they were roads are all
air-clearing and prop-filtering masks, none of which paves anything.

Every one of those is now fixed, and pinned by 25 new assertions in
`src/shared/harthmere/test/harthmere_building_shells.test.ts`.

The seam where Harthmere meets the imported map is covered too: the town paving
now reaches all four wilds roads, and the flat plain either side of the join is
a hillside with a pass cut through it for the road.

---

## Part I — What was wrong

### 1. Seven pairs of buildings occupied the same volume

Not "adjacent" — interpenetrating. One shell's wall ran through another shell's
floor, and the roof of one closed over the interior of the other.

| Pair | Shared volume |
| --- | --- |
| `north_gate_east_gatehouse` / `guard_yard_office` | 13 x 9 = 117 voxels |
| `harthmere_stables` / `traveler_hearth_player_house` | 11 x 13 = 143 |
| `market_auction_office` / `crafters_workshop` | 15 x 7 = 105 |
| `harthmere_watermill` / `dripline_stack` | 17 x 5 = 85 |
| `black_anvil_smithy` / `mail_post_house` | 15 x 5 = 75 |
| `lavender_lane_house` / `last_watch_post_bunkhouse` | 3 x 7 = 21 |
| `brother_vance_chapel_cottage` / `dripline_stack` | 1 x 5 = 5 |

These were known. `harthmere_building_interiors.test.ts` pinned the count at
seven with the comment "the brief was to enhance, not redesign", and the
furniture generator carries an `insideAnotherBuilding()` guard so that a crate
never materialises in the neighbour's shop. That guard was treating the symptom.

### 2. Thirteen front doors opened into a wall

Worse than the overlaps, because it is the difference between a shop you can
enter and one you cannot. Measured as: how many of the three ground voxels
directly outside the door are inside another building.

| Building | Door | Blocked by |
| --- | --- | --- |
| `north_gate_east_gatehouse` | south @505 | `guard_yard_office` — **all three** |
| `harthmere_stables` | east @-265 | `traveler_hearth_player_house` — **all three** |
| `black_anvil_smithy` | south @532 | `mail_post_house` — **all three** |
| `crafters_workshop` | south @504 | `market_auction_office` — **all three** |
| `brass_scale_bank` | west @-225 | `black_anvil_smithy` — two of three |
| `green_mortar_apothecary` | east @-176 | `tailor_loft_house` — two of three |
| `dock_warehouse` | west @-160 | `dockside_family_house` — two of three |
| `dockside_family_house` | east @-164 | `dock_warehouse` — two of three |
| `old_well_underways_entry_house` | east @-235 | `rat_crown_drain_house` — two of three |
| `rat_crown_drain_house` | west @-237 | `old_well_underways_entry_house` — two of three |
| `edrik_vane_noble_rise_estate` | west @-262 | `reeve_hall` — one of three |
| `saint_verena_chapel` | south @480 | `tannery_court_house` — one of three |
| `tannery_court_house` | north @481 | `saint_verena_chapel` — one of three |

Two of these are mutual: the Old Well entry house and the Rat Crown drain house
faced each other across a single voxel of alley, and so did the dock warehouse
and the dockside family house.

### 3. Two balconies hung through the neighbour

`dripline_stack`'s third-floor balcony (419..421, -131..-122) passed through the
wall of `harthmere_watermill`. `dockside_family_house`'s balcony (573..575,
-170..-160) passed through `dock_warehouse`. Both are load-bearing geometry —
`harthmereBalconyBlockAt` writes a real deck and railing at those columns.

### 4. Four buildings had nowhere to put their own residents

Named in the interior lore audit as "structural and lore conflicts to resolve
before placement work", and still unresolved:

| Building | Declared | Lore requires |
| --- | --- | --- |
| `black_anvil_smithy` | 1 floor | Osric and Luth's apartment above the forge |
| `dawn_loaf_bakery` | 1 floor | Dawn's room above the bakery |
| `saint_verena_chapel` | 1 floor | archive, infirmary, clergy rooms, bell-tower access |
| `harthmere_stables` | 1 floor | Old Jory's stable-yard loft |

The chapel case was a live contradiction rather than an omission: the renderer
already builds the Chapel of Saint Verena as a two-storey shell while the
authored table said one, so the two systems disagreed about the same building.

### 5. Nine staircases stood in the doorway

The shim carves a door lane of ±2 laterally and ±3 through the wall. The
furniture generator respects it. Stairs did not, so in nine buildings the
staircase landed in the entrance: both North Gate gatehouses,
`brass_knocker_house`, `appleblossom_house`, `wheatgold_house`,
`canalview_house`, `millers_rest_house`, `dripline_stack`, `washline_stack`.

### 6. The renderer keeps a second copy of the building table, and it had drifted

`HARTHMERE_ROOF_CLEAR_BOXES` in `harthmere_assets.ts` was nineteen hand-written
rectangles duplicating footprints from `HARTHMERE_BUILDINGS`. One had already
gone stale:

```
harthmere_stables   renderer: x[464,478] z[-274,-256]
                    authored: x[440,458] z[-276,-254]
```

Twenty-four voxels east. The roof-declutter pass had been protecting and
clearing a patch of empty ground beside the stables instead of the stables.

### 7. The town had no streets

Three constants are named as though they were roads. None of them is one:

- `HARTHMERE_CLEAR_STREET_RECTS` (shim and renderer) is an **air-clearing mask**.
  It deletes loose floating blocks and explicitly skips anything inside a
  building footprint. Some of its rectangles are 141 x 61 — a whole district.
- `HARTHMERE_STREET_SEGMENTS` (renderer) is five line segments used to classify
  a decorative prop as street clutter.
- `HARTHMERE_NO_BUILD_BOXES` (renderer) keeps props out of five areas.

All three answer "where may a block *not* be". None paves anything, and none is
derived from where the doors are. Walking out of the Dawn Loaf put you on the
same undifferentiated grass as standing in an empty field — against town bible
§5.2, which asks for "clean center routes in main market arteries, side gutters,
muddier shoulders, and occasional plank bridges over wet spots".

---

## Part II — What changed

### Shell moves

Thirteen buildings changed, twelve of them by a nudge. The move set was solved
for minimum total displacement subject to: zero footprint and balcony overlap, a
three-voxel clear approach in front of every door, stairs inside the shell and
out of the door lane, and chimneys inside the shell and clear of both. North
Gate structures, the chapel, the inn, Reeve Hall, the smithy, the bakery, the
provision house, the barracks, the Mudden shelter, the watermill and the stables
were held fixed as quest and district anchors.

| Building | Change | Why |
| --- | --- | --- |
| `guard_yard_office` | +12 z | cleared the east gatehouse's shell and its doorstep |
| `traveler_hearth_player_house` | +14 z | cleared the stables; also moves it into the Residential District it is filed under, and away from the gate approach |
| `market_auction_office` | −3 x, +10 z | cleared Crafters Workshop and its south door |
| `mail_post_house` | −4 x, +5 z | cleared the smithy and its south door; lands on the plaza frontage |
| `brass_scale_bank` | +3 x | gave the teller door a doorstep instead of a slot against the forge wall |
| `tailor_loft_house` | +2 x | gave Green Mortar Apothecary a doorstep |
| `dock_warehouse` | +2 x, +1 z | opened the cargo lane and freed the neighbour's balcony |
| `lavender_lane_house` | −3 x | cleared Last Watch Post |
| `brother_vance_chapel_cottage` | +1 x | cleared Dripline Stack by the one voxel they shared |
| `dripline_stack` | −5 z, door west → north | cleared the watermill and the cottage; the west face is where the balcony hangs, the north face is the Mudden lane |
| `old_well_underways_entry_house` | door east → north | the two Underways doors no longer face each other across one voxel |
| `rat_crown_drain_house` | door west → east | as above |

Balconies, stairs, chimneys and door centres moved with their shells.

### Upper floors added

| Building | Added |
| --- | --- |
| `black_anvil_smithy` | 2nd floor + stair run at (536, −238), east of the forge triangle |
| `dawn_loaf_bakery` | 2nd floor + stair run at (432, −200), behind the oven line |
| `saint_verena_chapel` | 2nd floor + stair run at (470, −146), north-west corner behind the altar |
| `harthmere_stables` | 2nd floor + stair run at (443, −272), clear of the animal aisle |

Each stair run was placed inside the shell, out of the door lane, and clear of
the chimney. The chapel change also settles the renderer/table disagreement in
the renderer's favour.

### Streets: `src/shared/harthmere/harthmere_town_streets.ts` (new)

A real paved network, **derived** from `HARTHMERE_BUILDINGS` rather than authored
beside it — deliberately, given that the one existing hand-maintained copy of the
same rectangles had already drifted 24 voxels.

How it is built:

1. Every building footprint is blocked. Balconies are **not**: a deck sits at
   relY 5 and the ground beneath it is walkable. Mara Thistle's front door is
   directly under hers, which is a porch, not an obstruction.
2. For each front door, walk straight out until a 3 x 3 block of open ground
   fits. That cell is the building's **landing**.
3. Grow one connected network: repeatedly breadth-first search from what is
   already paved, through cells wide enough to carry a street, to the nearest
   unconnected landing, and pave the route. A cheap Steiner tree — it produces
   what a town produces, a few arterials with short spurs, rather than a grid
   stamped over the buildings.
4. Widen by one voxel wherever there is still room, so trunks read as roads.
5. Cobble the interior, gravel the edge (bible §5.2).

Result: **5,497 paved voxels in 147 rectangles, 2,938 cobble and 2,559 gravel,
zero paving inside any building, and all 46 town-core front doors opening
directly onto the network** — every door's own doorstep is paved, so the walk
from door to street is zero voxels for all 46.

The shim paves it at ground level (relY 0) as the **last** entry in the terrain
chain, so a wall, fence, landmark or building always wins the column. The network
is computed to miss every footprint; checking it last means it could not break a
building even if a future one were authored across a lane.

Cost: 503 ms, computed once and memoised. It started at 24.7 s — the route
search asks "does a street fit here" once per neighbour per visited cell, and
answering that live is nine bounds-checked array reads while flooding an
84,000-cell lattice forty-six times. Precomputing it per column, and moving the
search off string keys onto flat `Int32Array`s, is the whole 50x.

### Renderer roof-clear boxes now derived

`HARTHMERE_ROOF_CLEAR_BOXES` is computed from `HARTHMERE_BUILDINGS`, removing the
drift class of bug and extending the pass from 19 buildings to 51.

Buildings with three or more floors are deliberately excluded. The height
thresholds in that pass only describe one- and two-storey shells — a non-`upper`
box clears props from relY 5.12 up, an `upper` box clears the core from 9.12 up —
and a four-storey Mudden stack has real structure at those heights. That matches
what the hand-written list happened to do; it is now the stated rule rather than
an accident of which buildings someone typed in.

---

## Part III — Verification

`src/shared/harthmere/test/harthmere_building_shells.test.ts` (new, 21 assertions):

- no overlapping footprints; no balcony through a neighbour; every balcony on a
  wall it has, at a floor it has;
- no neighbour in front of any door; no door on a corner post;
- every multi-storey building has an authored stair run, inside its own shell,
  out of the doorway, long enough to climb its own storey; no stairs to nowhere;
- every chimney inside its shell and off both the stairs and the door lane;
- the four lore buildings have their upper floor and a way up;
- the street network paves nothing inside a building, is a network rather than a
  few patches, reaches every town-core door, has both cobble and gravel, and is
  deterministic.

`harthmere_building_interiors.test.ts` updated: the assertion that pinned seven
authored overlaps now asserts zero.

**Shell and street suite: 21 passing, 0 failing.** `tsc --strict
--noUnusedLocals` clean on the changed shared modules.

**Two pre-existing interiors assertions now fail, for a reason unrelated to this
pass.** `harthmereBuildingFurniture()` in `harthmere_building_interiors.ts` was
changed mid-session to filter its own output down to ceiling lights:

```ts
const structuralLighting = all.filter((box) => box.piece === "ceiling_led");
furnitureCache.set(building.name, structuralLighting);
return structuralLighting;
```

The generator still runs and still places furniture — tracing shows nine pieces
on the smithy's ground floor and sixteen in the Copper Kettle's common room —
and then every one of them is discarded before the caller sees it. Every
building in Harthmere is now an empty room with two LEDs in the ceiling.

That makes two assertions in the interiors suite false by construction
("furnishes all 57 buildings" and "gives each kind of building the furniture it
should have"), and it is presumably deliberate — a performance measure, or a
move to prop-based interiors. It was left exactly as found: interiors are out of
scope for this pass, and reverting someone else's in-progress change is not a
call this audit should make. But the two tests and the module now contradict each
other, and one of them should be updated to say which is intended.

### The town, after

`#` building, `=` street, `.` street shoulder. Roughly 3 x 4 voxels per character.

```
      =======================================
    ######===######===#######===######===######
   #######   #######  #######  #######== #######
   #######   #######  #######  #######== #######
   #######   #######  #######  #######== #######
   #######   #######  #######  #######== #######
                                      ==
                                      ==       #######
                                      ==       #######
                                      ==       #######
    ######   ######   #######   ######==##############
   #######   #######  #######  #######==##############
   #######   #######  #######  #######==#######
   #######   #######  #######  #######==#######
   #######===#######==#######==#######==#######
      ======================================
                                          ==
                                          ==
                                          ==
                                          ==
                                          ==#####       #####
                                          ==#####       #####
                                          ==#####       #####     #######
                                     ######=#####       #####    ########            #############
                                     ######=########## .#####    ################### #############
                                     ######====. ##### ==########################### #############
                                     ######=.==  ##### ==###########################=#############
                                     ######  ====#####===###########################=#############
                                     ######  ============########   ==   ###########=#############
                                       #######=        ==########   =====###########=#############
                       ===========     #######=######  ==########====================.
                      ##########==     #######=####### =========#######.==
                     ###########==     #######=####### ######  #########=.
                     ###########==     #######=####### ####### #########=########
                     ###########===============####### ####### #########=########
                                ......#######==#######.####### #########=########
                                      #######==========####### #########=########
                                      #######==      ======   #####======########
                                      #######==      .==###########....==########.
                                      #######==       ==###########    .==========
                                     ==========       ==####################### ==
                             #########=......==       ==###### .=. ############ ==
                             #########=      ==       ==######=====############ ==
                             #########=      ==       =============############ =##########
                             #########.      ==                   .############ =##########
                             #########       ==                    ############ =##########
                                       #######=######              ############ .##########
                                       #######=######       ######               ##########
                                       #######=######      #######        #######
                       #########       #######=######      #######        #######
                       #########           ================#######        #######=#########
                       #########           ==.............=#######        #######=#########
                       #########=============             =#######========#######=#########
                       #########===........==             ================#######=#########
                       #########===        == #########                 .=========#########
                                === #######==##########
                       #######===== #######==##########
                       #######=############==##########
            #####      #######=############==##########
            ######=====#######=############==##########
            ######=============#####      =========.
            ######.           #######     ==...#######
            ######           ########     ==   #######
                             ########=======   #######
                     ######  ########==.###### #######
                     ######  ########== ###### #######
                     ######============ ######
                     ######==.........  ######
                       ======
                       .....
```

---

## Part IIIa — Deploying this to a world that already exists

Editing the building table is not enough, and this was very nearly shipped
invisible. Two independent gates stood in the way.

**1. The seed fingerprint did not know the building table existed.**
`makeLocalDevSeedFingerprint()` hashes roughly twenty-five version constants —
`buildingStyleVersion`, `townSurfaceStyleVersion`,
`additiveTownInteriorsVersion` and so on — but it did **not** include
`HARTHMERE_TOWN_BUILDINGS_VERSION`, the version of the table that says where the
buildings are. So a deploy carrying moved shells would compute a fingerprint
identical to the recorded one, log *"Skipping local dev starter town seed;
fingerprint already current"*, and return. Nothing would run.

**2. Even with a changed fingerprint, no shard would have been rebuilt.**
In the default `additive` mode, `terrainIdsToBuild` collects only shards that are
missing, that fail the unsolid-surface probe, or that carry authored water.
Moving a building satisfies none of those — the shard is present, and the ground
is still solid.

**3. And moving a building makes that worse, not merely inert.** The old shells
live in `shard_seed` at their old coordinates. Additive seeding creates and never
erases, so anything short of a full authored rebuild of those shards would leave
the Guard Yard Office standing in two places at once.

The fix follows the `HARTHMERE_AUTHORED_WATER` precedent in the same function,
which exists because that block once sat behind an env flag and ordinary deploys
left the carved river dry:

- `HARTHMERE_TOWN_BUILDINGS_VERSION` (bumped to `-shell-polish-v2`),
  `HARTHMERE_TOWN_SHELL_REBUILD_VERSION` and `HARTHMERE_TOWN_STREETS_VERSION` now
  ride in the seed fingerprint, so the deploy that carries a shell change is the
  deploy whose fingerprint stops matching.
- `localDevTerrainShardHoldsRebuiltTownShell()` queues every existing shard whose
  authored span intersects the town-core rebuild span, between the ground plane
  and relY 40, for a **full authored rebuild**. The span is derived from the
  core footprints with a 16-voxel margin rather than listed, so a future move
  cannot fall outside it — verified: every changed footprint, old position and
  new, lies inside it.
- Unlike the water block this is **conditional on the fingerprint mismatch**, so
  it fires on exactly one deploy and is a no-op afterwards. Scope: 100 shard
  columns x 2 y-layers = **200 shards**.

Player work is preserved. The rebuild is a partial ECS update that rewrites only
the seed identity; `shard_diff`, shapes, placer, occupancy, farming, growth,
moisture, water, muck and restoration state are all omitted from the change and
therefore survive, including concurrent writes made while maintenance runs.

No env flag, no admin action: deploy is enough.

---

## Part IIIb — Reconciliation review, and the seam to the main map

### The expanded production repair: verified

`repair-harthmere-town-production.cjs` was widened to target every canonical
shard the shells and streets touch. Checked independently against the geometry
rather than taken on trust:

| Property | Result |
| --- | --- |
| Shards targeted | **142** (was 14) |
| Old, pre-move shell positions covered | **all of them** — no ghost walls |
| Chimney stacks above the roof line covered | yes |
| Balcony decks outside the footprint covered | yes |
| Every street voxel covered | yes |
| Paving inside a building | none |
| `storyHeight()` matches the shell generator | yes (`slum ? 4 : 5`) |
| Mutable overlays | untouched — only `shard_seed` and `box` are written |

The replacement is composed from the canonical seed first and the town-style
overrides applied on top, then compared and written once, so a retry is
idempotent and a half-restored shard is never visible.

One structural note: the script derives its target set from the **new**
footprints, and the old ones are covered only because the moves were small
relative to a 32-voxel shard and neighbours filled the gaps. That holds today —
verified voxel by voxel — but it is incidental, not designed. If a future move
is large, the old shell's shards must be added explicitly.

### Three gaps found in the reconciliation path

**1. Nothing checked that `dist/shim.js` was current — fixed.** The writer reads
its target set from the worktree and its replacement geometry from the packaged
bundle. A stale image would rebuild all 142 shards from old geometry, *reverting*
the shells and streets, while still printing the worktree's version numbers and
reporting success. The persisted-world audit would not catch it: it checks the
town surface and four roofs, and verifies no shell position or street voxel. The
repair script now asserts the bundle contains the worktree's building-table and
street-network versions and refuses to write otherwise. (Today's bundle, built
02:40, passes: it carries `harthmere-town-buildings-shell-polish-v2` and matches
the moved coordinates and all four added floors exactly.)

**2. The repair timeout was still sized for fourteen shards — fixed.** 300s for
142 shards, each a full 32³ generation plus load/save, is tight; a kill leaves
the town partially repaired — atomic per shard, so nothing corrupts, but some
shells stay at their old coordinates until the next deploy. Raised to 900s and
the stale "only the 14 affected canonical shard seeds" comment corrected.

**3. The verifier was not widened with the writer.** `audit-harthmere-town-repair.cjs`
still checks only the town surface and four roofs. It should gain a shell-position
and street-voxel probe so the gate can actually fail on the case the writer now
exists to prevent. Left as an open item — it is the audit's own contract, not
this pass's.

### The seam where Harthmere meets the main map

The extension sits at authored X + 1600. The imported map ends at X=1792, which
is exactly where the first extension shard begins, and the extension covers
X=1792..2560, Z=-576..192 at a flat ground plane of Y=52.

What is already handled, and correctly:

- **The north and south notches** east of X=1792, where world metadata claims
  land the extension does not seed, are closed by
  `harthmereExtensionVoidCollisionBoxes()` and hidden behind the rising ridge in
  `extension_edge_horizon.ts`. A player cannot walk into a missing shard.
- **Surface solidity** across every extension shard is gated on each deploy by
  `audit-production-extension-terrain.cjs` — the probe that caught the sunken
  forest pits.
- **The approach road** is engineered rather than assumed:
  `harthmere_connector_route.ts` routes from the Grove's east road, descends to
  a confirmed Y=56 landing, and cut/fills (up to 12 voxels) along
  Z=-209 to the boundary at X=1792, where the extension generator takes over
  with its own gravel road to the West Gate.

What was wrong, and is now fixed:

- **The town's paving was an island.** The street network connected all 46 front
  doors and then stopped 16 to 42 voxels short of every one of the four authored
  wilds roads. A player walking the gravel road in from the old-map seam stepped
  onto open grass at the West Gate, crossed it, and picked up paving somewhere
  in the middle of town. The four road heads are now landings in their own right,
  so the network is continuous from the seam to the last apartment door — all
  four now meet the paving at **0 voxels**, and a new assertion holds them there.
- Re-verified after the change: the network still paves nothing inside a
  building, and still never crosses the Brell or the fountain, trough and mill
  race — **0 street voxels over the river channel, 0 over still water.**

Network after: **6,139 paved voxels in 167 rectangles**, built in ~90 ms.

### The land either side of the road at the join — now a hillside

The seam had one more problem the road fix does not touch. West of X=1792 is real
imported landscape with real relief. East of it the additive terrain is a
dead-flat plane at Y=52 for the entire 768-block band. The join was therefore a
straight north-south line, 768 voxels long, with landscape on one side and a
table-top on the other. It did not read as terrain; it read as the edge of a
level.

`harthmere_west_seam_ridge.ts` (new) puts hills there, with a pass cut through
for the road — the same job `extension_edge_horizon.ts` already does for the
north and south notches, applied to the seam the player actually walks through.

| | |
| --- | --- |
| Band | world X 1792..1880, full extension Z range −576..192 |
| Crest | Y 74–75, i.e. 22–23 above the plane |
| Raised columns | 64,113 |
| Road pass | 21 voxels flat at the plane, ramping up over 26 either side |
| Steepest step | **1 voxel** — a walkable hillside everywhere, no cliffs |

Two rules keep it safe, and both are asserted:

- **Zero rise at the seam column itself**, ramping up over the next 24 voxels.
  The imported map's height at X=1791 is not knowable from this side of the
  join, so raising ground exactly on the line risks butting a 20-block face
  against whatever is actually there. Swelling eastward from the plane cannot.
- **Back to the plain well before the town.** The ridge ends at X=1880; the
  westernmost structure is at 1940 and paving starts at 1924. A test pins that
  no building and no street ever falls inside the band.

It is add-only — it never writes at or below the ground plane — so it cannot
carve the road surface, the town, or anything the earlier passes authored.

Reconciliation: the ridge is new ground on shards that **already exist**, which
is precisely the case additive seeding cannot detect. It is wired into all three
gates — the seed fingerprint, `localDevTerrainShardHoldsRebuiltTownShell()` (the
footprint-derived span stops 44 blocks east of it, so the ridge band is checked
separately), and the production repair's target set. Verified: every raised ridge
voxel falls inside that set.

### Five structures that did not exist in production

Writing the ridge test surfaced this, and it is the most serious thing in the
audit: **five authored structures had no terrain beneath them and were never
written at all.** The additive seeder only generates shards inside
`HARTHMERE_EXTENSION_WORLD_BOUNDS`, and that band was sized for the West Muck
Breach at Z=−560 plus one shard of support — the right rule for keeping
creatures off the void, and the wrong rule for deciding which authored content
exists. They render correctly in an unshifted authored world, which is how it
survived.

It was not only buildings. The Gravewood cemetery fence (authored 752..808,
206..262), a bandit seed, and two NPC bedrooms were outside the band as well —
the trim was cutting away whole authored districts, not five isolated shells.

| Structure | Was | Fix |
| --- | --- | --- |
| `charcoal_burners_camp` | z −650, outside Z | band widened |
| `deep_old_wood_glade_lodge` | z −692, outside Z | band widened |
| `grave_tender_caretaker_house` | z 222 / x 2368, outside both | band widened |
| `northwest_ruined_watchtower` | world x 1754 | **moved +146 X** |
| `southwest_orchard_windmill` | world x 1754 | **moved +146 X** |

Widening was the right answer for the first three: it costs no coordinate churn,
keeps Merrit, Veneth and the grave tender where their lore puts them, and keeps
the cemetery fence attached to the caretaker's house. The band went from
shardZ −18..5 to −22..8 and shardX 23 to 25 — foundation shards 2,304 → **2,976**
— and both ends stay well inside the reserved id grid (shardZ −31..15), so no
terrain entity is remapped and no existing shard changes identity.

The other two could not be fixed that way at any price. They map **west of
X=1792**, where the seeder is fail-closed by design because generating there
would overwrite imported production terrain. Those had to come east. They moved
+146 X onto the same ridge and orchard lines, clear of the new seam ridge, and
everything anchored to them moved with them: Rusk Hallowhand's bedroom, and the
windmill's cross arms, which are authored in the shim rather than on the building
record and would otherwise have kept turning over empty ground.

The assertion is now the direct one — *every authored structure has seeded
ground* — rather than a pinned list of known-bad names.

Reconciliation: the newly-covered shards are genuinely **missing**, so ordinary
additive seeding creates them with no special handling. The two moved structures
are the case that needs help — their new ground is on shards that already exist —
so `harthmereShellRebuildRects()` carries them alongside the town-core span,
through both the shim predicate and the repair script. Their old positions need
no repair at all: nothing was ever generated out there to erase. Repair target
set: **419 shards**, verified to cover both moved structures and the whole ridge.



Not fixed here, and worth a decision rather than a silent carry-forward.

1. **`last_watch_post_bunkhouse` is filed under "Harthmere Wilds — Last Watch
   Post" but stands at x[470,490] z[−340,−320], inside the Residential District
   between Lavender Lane House and the southern apartment row.** It is the reason
   Lavender Lane had to move. If Edda's post is meant to be the last authority
   before the Gravewood, it is in the wrong place by roughly a district; if the
   position is a quest anchor, the district label is wrong. One of the two should
   change.

2. **Thirty-two of 57 buildings have no chimney**, including all ten Residential
   apartment houses and all four Mudden stacks — and one of the ten is
   `chimneybend_house`, named for the chimney it does not have. Town bible §5.2:
   "Chimneys: short and frequent; smoke must be visible in cool weather." Adding
   them is a small data change; it is left out of this pass because a chimney
   implies a hearth, and hearths are interior work.

3. **Window rhythm is a diagonal stripe, not a facade.** The shell generator
   places glass where `(worldX + worldZ + floor) % 5 === 0` at relY 3. That is
   deterministic and never blank, but it takes no account of which wall it is on,
   so window spacing slides across the elevation and no two adjacent buildings
   share a rhythm. Bible §5.2 asks for shutters everywhere and leaded glass
   limited to wealthy or sacred buildings; neither is expressible today.

4. **District palettes are wool, not materials.** Roofs are `redWool`,
   `blueWool`, `greenWool`, `yellowWool`, `blackWool` against bible §5.2's
   "thatch for poor homes and barns, red-brown clay tile for prosperous shops,
   blue-gray slate for chapel and elite buildings". Four buildings already use
   `thatch` and `hay` correctly; the rest are placeholder colour. A material pass
   would do more for district readability than any other single change.

5. **The south wilds road is drawn straight through the tannery.**
   `isHarthmereWideWildsRoad()` runs a road south from authored (486, −112), and
   `tannery_court_house` occupies 472..490, −124..−106. The town block pass wins
   the column, so the road stops dead at the tannery's north wall and resumes on
   its south side. The street network connects at the tannery's south face
   instead, which is where that road actually becomes walkable, but the conflict
   itself belongs to whoever owns the wilds road table: either shift the segment
   to x≈466 or x≈496, or move the tannery.

6. **Three modules disagree about how tall a storey is.** The shell generator in
   the shim says `slum ? 4 : 5`. Both `harthmere_building_interiors.ts` and
   `harthmere_additive_town_interiors.ts` say `gatehouse || tower ? 6 : 5`. The
   shim is the one that stacks the floor slabs, so the interiors modules place
   upper-floor content one voxel per storey away from the floor the shell
   actually built — four voxels of drift by the top landing of a five-storey
   Mudden stack, and one per floor in every gatehouse and tower. The shell tests
   now use the shim's value and say so; reconciling the interiors modules is
   interior work and was left alone.

7. **Interiors remain generic**, as the existing lore audit says: nine voxel
   patterns matched by name, so the tannery is furnished as a chapel (its name
   contains "court"), the Guard Yard *Office* gets bunks, and the dock
   *warehouse* gets a bed and hearth because its name contains "house". That is
   the subject of `HARTHMERE_ALL_BUILDINGS_INTERIOR_LORE_AUDIT.md` and was
   deliberately not touched here.
