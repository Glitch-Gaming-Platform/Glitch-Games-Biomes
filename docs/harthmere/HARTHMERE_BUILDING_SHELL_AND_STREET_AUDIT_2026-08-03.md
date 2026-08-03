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

Every one of those is now fixed, and pinned by 21 new assertions in
`src/shared/harthmere/test/harthmere_building_shells.test.ts`. All 36 tests
across the two building suites pass.

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
authored overlaps now asserts zero. All 15 of its existing tests still pass
unchanged — the shell moves did not disturb a single furniture invariant.

**36 passing, 0 failing.** `tsc --strict --noUnusedLocals` clean on the changed
shared modules.

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

## Part IV — Still open

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

5. **Interiors remain generic**, as the existing lore audit says: nine voxel
   patterns matched by name, so the tannery is furnished as a chapel (its name
   contains "court"), the Guard Yard *Office* gets bunks, and the dock
   *warehouse* gets a bed and hearth because its name contains "house". That is
   the subject of `HARTHMERE_ALL_BUILDINGS_INTERIOR_LORE_AUDIT.md` and was
   deliberately not touched here.
