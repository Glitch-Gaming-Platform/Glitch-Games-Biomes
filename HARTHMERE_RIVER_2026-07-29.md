# The Brell — giving Harthmere its river (2026-07-29)

## Answer to the question

**Harthmere had no river.** It had been *written* as a river town from the start,
but no water was ever authored anywhere in the additive extension. So this adds
one, behind the woods east of the town, running under the bridge that was
already standing there.

## What the survey found

The additive Harthmere extension is a deliberately flat plane at ground `Y=52`,
spanning world X 1792–2560, Z −576–192. Before this change it had:

- **no `shard_water` component on any of its terrain shards at all** — the
  Harthmere shard seeder wrote `shard_seed`, `shard_diff`, `shard_shapes` and
  `shard_muck`, and nothing else. Not a drop of water in the whole town;
- no river, stream, pond or lake in any generator.

Meanwhile the world was full of evidence that a river was *supposed* to be
there:

| Evidence | Where |
|---|---|
| A stone bridge with parapets, "the center remains open" | authored X 586–612, Z −212–200 |
| A road segment commented "East river road across the bridge into Briarfen" | `isHarthmereWideWildsRoad` |
| `river_dock_supply` and `dock_warehouse` on a dry bank | 574–602 / 574–600, Z −196–150 |
| A `bridgeGateGap` cut through the east town wall to reach the bridge | town wall generator |
| "Thornbridge Crossing" | 324–352, Z −504–492 |
| A watermill wheel and race | around 374, −404 |
| Bridge tax, the Bridge Tax Riot, "the old bridge carvings", "Wren of the Brell ferry line — we have run this stretch of river since before the bridge was hers" | NPC dialogue |

### The bug behind the missing water

Two places in the shim tried to draw water and both produced **blue wool**:

```ts
// localDevMaterials()
water: terrainId("water", terrainId("blue_wool", stone)),
```

There is no water *block* in Biomes. Water is the parallel `ShardWater` field
(world-anatomy doc §5.1) and there is no `water.json` under
`src/galois/data/blocks/`, so `getTerrainID("water")` missed and every use fell
through to the `blue_wool` fallback:

1. `harthmereSurfaceMaterial` returned `materials.water` for the whole rectangle
   X 604–630, Z −206–146 — a 27×61 **slab of blue wool** where the river below
   the docks was meant to be;
2. `harthmereWideWildsSurfaceMaterial` scattered `materials.water` at 1-in-17
   across the entire Briarfen (X > 630, Z −360–180) — the comment above it reads
   *"Briarfen and river extension to the east/south-east"* — producing speckled
   wool in the grass.

Neither was swimmable, fishable, flowable, or even visually continuous.

## What was built

### The Brell

`src/shared/harthmere/harthmere_river.ts` — a pure, allocation-free function of
position, in the same style as `harthmere_wilds_forest.ts`, so it unit-tests in
milliseconds and the seeder can call it per voxel.

- **Course.** A 17-node meandering polyline from the north-east wilds
  (664, −470) down through the Briarfen to (732, 204), 13 voxels wide.
  It passes **under the existing east bridge** (the channel occupies X 600–612,
  fully inside the 586–612 deck, with dry abutment on the west end), runs past
  the east face of both dock buildings with the bank ~7 voxels clear, swings
  east around the Noble Rise estate, and never touches the walled town.
- **Cross-section.** Parabolic, not a trench — doc §5.4: the water mesher
  averages surface height per vertex and tapers where a neighbour is air, so a
  shelving bed is what makes a shoreline read as a shoreline. Bed is a
  stratigraphic column (moss at the margin → sand in the shallows → gravel in
  the scoured centre), per doc §1.6.
- **Water.** Real `ShardWater` at level 15. Doc §5.3: 15 is a source and never
  depletes, which is exactly the semantics an authored river wants. Gaia's
  `WaterSimulation` then owns spread, falling water and the player's bucket from
  there. The surface sits one voxel below the bank top, so the bank reads as a
  bank.
- **The Briarfen mill pool.** A 38-voxel-wide still pool at (710, 74) at the
  south end — the dedicated fishing hole, out where nothing else is authored.
- **Crossings.** The river crosses exactly three roads. One is the east bridge,
  already decked by the shim. The other two — the north-east wetland trail and
  the south-east gravewood lane — get plank decks with stone abutments from this
  module, and the water still runs underneath. No route across the map is
  severed; that is the same rule the wilds forest already follows.

### Making it fishable

Fishing keys off `isWaterAtPosition` (the water tensor) and
`marchWaterDepth`, so real `ShardWater` is the whole requirement — no per-water-body
configuration exists or is needed. Two details had to be right:

- **Depth.** `SHALLOW_WATER = 3`, `DEEP_WATER = 16` in
  `src/shared/loot_tables/predicates.ts`. The channel centre holds 5 water
  voxels, so the main channel rolls `isNormalDepthWater` while the shelving
  banks still pass through the shallow band — both tables are reachable without
  leaving one bank. `DEEP_WATER` is deliberately never reached; deep-water
  species belong to the original map's ocean.
- **Open sky.** Every fish the Fish Food quest asks for — Koi, Clownfish,
  Mackerel — is gated on `inOpen`, i.e. `skyOcclusion <= CAVE_OCCLUSION_THRESHOLD`
  (8). A canopy leaning over the water would have made those species silently
  unrollable. The wilds forest is now excluded from the channel plus a 5-voxel
  margin, which is `HARTHMERE_FOREST_MAX_CANOPY_RADIUS`, so no leaf can overhang.
  That margin also keeps trunks out of the water, which Gaia's `tree_growth`
  would have decayed anyway for want of soil beneath them.

So the same fish that Fish Food sends the player to The Grove pond for are
catchable in the Brell, plus everything else in the fishing table that isn't
muck- or cave-gated. The Grove pond is untouched and Fish Food is unaffected.

### Files changed

```
src/shared/harthmere/harthmere_river.ts            (new — course, carve, bed, water, crossings)
src/shared/harthmere/test/harthmere_river.test.ts  (new — 25 tests)
src/server/shim/main.ts                            (carve + bed + shard_water; removed both wool "rivers")
```

In the seeder: the channel is carved out of the flat plane and given a bed; a
`shard_water` tensor is written for shards the course touches (with a cheap
per-shard early-out so the rest skip the pass entirely); the forest, ground
cover and wilderness harvest markers are gated off the water; and the two
blue-wool water patches are gone.

## Engine compatibility

- **Native ECS.** No new component or authority. `shard_water` is written
  through the existing `terrainSeedEntityForWrite` contract, which applies
  mutable defaults **only on shard create or an explicitly acknowledged
  destructive reseed** — an ordinary additive migration omits them, so live
  player water edits are preserved. (Consequence worth planning for: an
  already-seeded world will not show the river until those shards are recreated
  or `BIOMES_TERRAIN_SEED_MODE` is used deliberately.)
- **Gaia.** `WaterSimulation` picks the river up for free — it reads
  `shard_water` and invalidates on change, and level 15 is the source level it
  already understands. Nothing about the simulation changed. Vegetation
  simulations are unaffected because the river carries no flora and the
  exclusion margin keeps trees off it.
- **Anima.** No creature is seeded into the channel; the test asserts it against
  every muck-monster and livestock seed. That matters because outdoor actors in
  the extension are placed by `normalizeHarthmereExtensionOutdoorFeetPosition`,
  which hard-codes the flat ground Y — one seeded over the river would stand on
  the water surface.
- **Physics.** Swimming needs nothing added: `findWaterDepth` blends
  `DEFAULT` → `WATER` → `PLAYER_SWIMMING` params by submerged fraction, all
  driven off the same tensor.

## Tests — 25, all in-memory, ~190 ms

| Group | What it pins |
|---|---|
| Course clearance (5) | clears all 57 authored buildings; never enters the walled town; runs past both docks without swallowing them; no seeded creature stands in it; clear of every business safe site |
| Crossings (5) | passes entirely beneath the east bridge deck; does not carve the deck; water runs under it; **every** wilds road that meets the river is decked; the plank crossings do not dam it |
| Channel shape (6) | shelves monotonically rather than cutting a trench; exact centre water column; surface one voxel below the bank; bed always sealed beneath the water; never cuts past the dirt layer or the seeder's declared max depth |
| Fishing (5) | deep enough for normal-depth fish and shallow enough at the bank for the shallow table; canopy margin ≥ max canopy radius so `inOpen` fish can roll; the Briarfen pool is genuinely wide and deep; a dry bank exists at every point along the course; the bridge stands over open water with dry abutment |
| Seeder contract (4) | shard early-out works; writes nothing outside the channel; writes nothing above the ground plane; the course never doubles back |

Regression: `muck_pack_relocation`, `native_road_ahead_contract`,
`native_combat_quest_routing`, the post-Gimme suites and the client quest
adapters all pass unchanged (146 tests total across the two runs).

## Left deliberately undone

Three more decorative water features have the **same** blue-wool bug and were
not converted, because each needs a watertight basin verified in-game first —
level 15 spreads 14 voxels horizontally through any gap, so a leaky basin would
flood the market square:

- the **market fountain** at (482–490, −213–205);
- the **stable trough** at (455–459, −246–242);
- the **watermill race** at (370–378, −407–401), whose wheel turns over dry
  ground. Thornbridge Crossing in the north-west likewise still spans nothing —
  that corner wants its own stream, which is a second course rather than an
  extension of this one.
