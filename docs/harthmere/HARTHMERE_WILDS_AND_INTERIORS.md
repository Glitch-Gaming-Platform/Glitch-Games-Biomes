# Harthmere: the forest outside, the furniture inside

Two additions to the additive town, both built from the recipes in the
world-anatomy doc.

1. **A real forest** in the fields outside town — trees and ground cover on
   perfectly flat terrain.
2. **Furnished interiors** for all 57 buildings, without touching a single wall.

---

## 1. The forest

### Why there wasn't one

Two decisions cancelled each other out. The shim carried this note:

> Forest density is handled by the runtime renderer using non-blocking props.
> Do not generate voxel tree trunks/leaves here; doing so makes shim startup
> scale badly and can create collision snags in the expanded Wilds.

…while the runtime renderer carried this one:

> All GLB map props are disabled in snapshot-built mode. The server-side voxel
> terrain now owns roads, trees, buildings…

Each deferred to the other, so nothing grew. There was even a
`isWideWildsTreeCenter()` left behind with no callers.

`src/shared/harthmere/harthmere_wilds_forest.ts` takes ownership, and answers
both original objections rather than ignoring them.

### Placement — doc §2.2, faithfully

```
spacing 8, jitter ±3          → effective spacing 5..11, Poisson-disk for free
groves(512) ∪ forests(1024)   → dense woodland AND scattered copses
rejection sampling            → big trees suppress their neighbours
```

The pipeline does rejection with a shared occupancy buffer and a shuffled scan.
A per-voxel seeder has no global state, so the equivalent local rule is: **a
candidate yields to any overlapping neighbour that outranks it**, where rank is
canopy reach, then height, then hash. Ranking is a total order and overlap is
symmetric, so there is exactly one winner per cluster and the result is
order-independent — a property the shuffled version has to be careful about and
this gets for free.

Current density: **54% of lattice cells grow a tree, ~30% canopy coverage**,
oak/birch/rubber in roughly 10900/2400/1600 proportion.

> One tuning note worth keeping. Ranking on nominal `radius` rather than true
> reach made every cross-species contest a birch (3) losing to an oak (4–5),
> which deleted birch from the map — 5770 trees down to 973. Birch lobes sit on
> stems that lean out, so its real footprint is 5, not 3.

### Form — doc §2.1

Oak grows a trunk with phyllotaxis branches; birch splits into two opposed
stems; rubber is a candelabra. The pipeline grows each tree once into a voxel
volume and stamps copies from a library — a seeder cannot hold a library, so
each form is expressed analytically. Same silhouettes, no storage.

### Ground cover — doc §2.3

Fine noise decides stipple, coarse noise decides where meadows *are*, flowers
are a strict subset of the grass mask with a per-species region field, rare
species get the stricter four-way gate, and a thinner punches bare clearings.
Result: **~49% cover**, mixed rather than monoculture.

Thresholds are calibrated against the measured distribution of the noise
(p10 0.38, p50 0.50, p90 0.63), not picked by eye — picking by eye here gives
you either bare ground or a solid carpet.

---

## Gaia correctness — the part that nearly broke

The forest is **real terrain**, so Gaia simulates it. Two rules decide whether a
tree is still there when you walk back:

| Simulation | Rule | Timer |
|---|---|---|
| `tree_growth` | a log is supported if the **six-connected** chain of same-species logs reaches a log with dirt/grass/moss directly beneath, within Manhattan 24 | decays in 2 min |
| `leaf_growth` | a leaf is supported if the six-connected chain of the **same leaf id** reaches its matching log within Manhattan 8 | decays in 1 min |

The first draft looked correct and failed all of it. Four real defects:

1. **Oak branches were diagonal.** `round(cos(angle)*step)` puts voxels
   diagonally from the trunk, and `dfsVoxels` is face-connected only — Gaia
   considered every branch detached. Fixed with L-shaped paths, which is what
   the doc's own `march_voxels` DDA guarantees by construction.
2. **The birch stems jumped diagonally** where they leaned outward. Fixed by
   emitting both offsets on the transition row.
3. **Eroded canopy voxels were stranded** with no neighbours. Fixed by requiring
   that a leaf exists only if every voxel on a straight walk back to the lobe
   centre also exists — the centre is always a log, so every leaf now has a
   path to wood.
4. **A neighbour's leaf could overwrite another tree's trunk**, severing it. The
   doc has the rule already: `tree[mask & (tree == 0)] = leaf` — leaves never
   overwrite wood. Wood now wins every contested voxel.

Plus one at the seeder level: **the wilds palette scatters hay, soil, sand,
stone and coal**, none of which are growth soils. A trunk landing on one takes
its whole tree down. The shim now paints one voxel of grass under each trunk —
`HARTHMERE_WILDS_FOREST_TRUNK_SOIL`. It changes no heights; the terrain stays
flat.

Ground cover deliberately uses **block** materials, never a leaf id. An
`oak_leaf` used as a ground bush would survive only where it happened to sit
near a trunk, so half the undergrowth would vanish a minute after load.

All of this is proven, not asserted, by
`test/harthmere_wilds_forest_gaia.test.ts`, which re-implements both DFS rules
against the generator's output.

## Performance — the other original objection

| | ms per shard | full seed (~2000 wilds shards) |
|---|---|---|
| first working version | 139 | ~4.6 min |
| with lattice memoisation | **6.5** | **~13 s** |

A 32-cube shard was re-deriving the same ~36 lattice cells about eighty thousand
times. Two bounded caches — candidates and resolved cells — plus a one-entry
column cache for the seeder's inner Y loop. Hit counts are identical before and
after, so the caches are transparent.

## Playability

`HARTHMERE_FOREST_CANOPY_CLEARANCE = 5`. Every leaf sits at or above five voxels
off the ground, so you walk **under** the canopy. Trunks are one voxel square —
a pole, not a wall. Undergrowth is one voxel, which players step over. Roads
keep a nine-voxel margin, the town is excluded outright, and so is the
back-country backdrop and the Elsewhen band.

Worst measured occupancy at head height: **12 solid voxels in a 169-voxel
window** — 93% open floor.

---

## 2. Building interiors

### What was already right

All 57 buildings already had four walls, a roof, and a door. That was checked
before changing anything and is now pinned by tests: adequate footprints, door
centres strictly inside their wall span (never at a corner), stairs and chimneys
on the building they belong to.

### What was missing

Every interior was empty.

### Furniture is blocks, not placeables

Doc §4.3.6 is blunt: Biomes ships **no beds, no chairs, no shelves, no rugs, no
dressers**. The whole placeable catalogue has four true pieces of furniture.
Everything else is *blocks shaped with the 23-shape system* — "a bench, a shelf,
a bed frame and a countertop are all just blocks shaped with slab, step, table,
stub, beam or inset and dyed."

So furniture here is voxels. The shim writes plain TerrainIDs with no shape
channel, so a table is a lumber slab on a log leg rather than a `table`-shaped
block — the same idea at voxel granularity.

Nine patterns: `bed`, `table` (with bench), `shelf`, `crates`, `counter`,
`hearth`, `anvil`, `straw_bunk`, `barrels`. Which ones a room gets depends on
what the room is for — a smithy gets an anvil, a slum loft gets straw, a shop
gets a counter.

**Lighting has no lamp**, per doc §4.3.3: "there is no lamp, torch, lantern or
candle placeable… to light a room in Biomes you build the light into the wall
out of sunstone or LED blocks." Rooms get `led` set into the ceiling.

### The rule that matters

Furniture may only **add**. It never seals a doorway, blocks a stair, fills a
room-partition gap, or wanders into a neighbouring building. Every exclusion is
deliberately **wider** than the shim's own rule, so if the two ever drift,
furniture stops early rather than growing into a doorway.

Pieces line the walls and are at most two voxels deep, which is what keeps the
middle of every room open — verified, not assumed.

### One thing left alone

**Seven pairs of buildings have overlapping footprints** (up to 17×5), authored
long before this work. They are not fixed — the brief was to enhance, not
redesign — but the furniture generator knows about them and refuses to place
anything inside a neighbour. The count is pinned by a test so an eighth would be
noticed.

Result: **2,669 furniture voxels across 57 buildings**, ~47 each, every building
furnished.

---

## Files

| File | Role |
|---|---|
| `src/shared/harthmere/harthmere_wilds_forest.ts` | trees, ground cover, lattice, caches |
| `src/shared/harthmere/harthmere_town_buildings.ts` | the 57-building table (data only, moved out of the shim) |
| `src/shared/harthmere/harthmere_building_interiors.ts` | furniture patterns and layout |
| `src/shared/harthmere/test/harthmere_wilds_forest_gaia.test.ts` | Gaia support, clearance, determinism (9) |
| `src/shared/harthmere/test/harthmere_building_interiors.test.ts` | enclosure, doors, furniture safety (15) |
| `tsconfig.harthmerewilds.json` | scoped typecheck, ~2 s |

> **Why the building table moved.** Only the data moved; every generator stayed
> in the shim. The table was buried in a ten-thousand-line server module that
> cannot be imported without booting a server, so nothing about the town could
> be tested. Same names, same footprints, same order.
