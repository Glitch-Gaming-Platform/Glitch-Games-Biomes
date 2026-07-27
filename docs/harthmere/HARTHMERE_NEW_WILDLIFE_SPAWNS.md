# New wildlife spawns

Two creature families added on 2026-07-26.

1. **The Harthmere forest herd** — 20 rabbits, 10 sheep, 5 cows scattered through
   the wilds forest outside town.
2. **Six mixed encounters** on the original map — each one Hex, five Muckers,
   one cow, two sheep and three rabbits.

---

## Grounding: the thing that decides whether any of this works

Harthmere's additive extension is dead flat at `HARTHMERE_EXTENSION_FEET_Y`. The
original map is hills. That difference drives the entire design, because these
seeds **ship their authored Y verbatim**:

```ts
// harthmereGroundedLivestockSeedsInTerritory
const grounded = runtimeWorldSpace
  ? productionPlacedLiveEntityPosition(seed, "live_livestock", options) ??
    (isGuardedWildlife || isOpenWildsGroup ? [...seed.position] : authoredFallback)
  : authoredFallback;
```

There is **no runtime terrain probe**. If the generated placement map has no
entry for a seed, its authored Y is what the player sees. A guessed Y buries or
floats the whole group.

### How each family solves it

| Family | Ground | Guarantee |
|---|---|---|
| Forest herd | flat extension | **Exact.** `position[1] === HARTHMERE_EXTENSION_FEET_Y`, asserted for all 35. No tolerance, no probe. |
| Six mixed groups | hilly original map | **Measured.** Every anchor *is* a column the June production terrain scan measured; each creature sits within 8 blocks of a measured column, and its Y matches that column exactly. |

The mixed-group anchors were selected from the scan's own output — the 256
outdoor spawn candidates plus every placement record resolved to an outdoor
surface, 569 unique measured columns in total. An anchor qualified only if every
other measured column within 40 blocks agreed on its height to within two
voxels, which is the scan's evidence that the ground there is level rather than
sloping.

Measured result across all 72 creatures: **max distance to a measured column
5.7 blocks, max height disagreement 0**.

> **The honest limit.** The scan sampled sparsely — one to three measured
> neighbours per anchor. So the claim is "every measurement available says this
> ground is flat", not "the ground is provably level at voxel resolution".
> Nothing offline can do better.
>
> **Exact per-creature grounding is one command away.** These seeds are
> enumerated by `scripts/harthmere/build-production-terrain-placement-map.cjs`
> (it walks `harthmereGroundedMuckMonsterSeedsInTerritory` and
> `harthmereGroundedLivestockSeedsInTerritory`). Re-run it against production and
> every creature here gets a terrain-probed `recommendedPosition`, which the
> runtime prefers over the authored one. Recommended before the next deploy.

Respawn is already safe: `exactSpawnMetadata` pins `spawn_position` to the seed
position, defeating `npcEntity`'s ±4 m jitter — the comment there notes this
exists precisely so a respawning cow doesn't land on a cliff edge.

---

## 1. The Harthmere forest herd

`src/shared/harthmere/harthmere_forest_wildlife.ts`

Positions are **derived, not authored**. Every other creature family here is a
hand-written coordinate list, which is right when a designer picked the spots.
This one had to be "randomly spaced through the entire forest" — and the forest
is generated, so hand-written coordinates would fall out of the trees the moment
anyone retuned the canopy.

The scatter uses the codebase's own deterministic-PRNG convention (mulberry32,
as in `harthmereSpawnRng`): random-looking, identical in every process,
reproducible by the deploy reconciler.

Every position is rejected unless it:

- has a **clear column** — no trunk, no bush, air through head height, and clear
  immediate neighbours so a cow isn't wedged against a trunk;
- has **at least three trunks within 10 blocks**, so "in the forest" is true
  rather than nominal;
- is **outside the town** (26-block clearance), **off the approach roads**
  (12 blocks), **out of the muck**, and short of the back-country boundary;
- is **at least 14 blocks from every other animal**.

Cows are placed first and rabbits last: the largest animal has the strictest
clearance test, so it gets first pick of the open ground.

Result: 35 animals spanning authored X 234–768 and Z −564–140, closest pair
17.1 blocks apart.

> The tree-search radius (10) is deliberately **smaller** than the road
> clearance (12). The forest generator doesn't know where the roads are — the
> shim suppresses the forest over them — so a wider search could count trees
> that don't exist at a spot sitting in a roadway.

---

## 2. The six mixed encounters

Added to `live_entity_production_seed.ts` alongside the existing four
open-wilds groups, reusing their machinery: the same monster layout table
(`hexEvery: 6` gives exactly five Muckers and one Hex), the same radial animal
layout, the same validity gate.

Each group clears, and each is asserted:

- every muck territory, safe zone, robot-protected area and helper-quest
  exclusion, via `harthmereOpenWildsMixedGroupPositionIsValid`;
- the additive town and its forest — all six sit west of
  `HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X`;
- **every pre-existing Hex, Mucker, cow, sheep and rabbit**, by at least 60
  blocks;
- each other, by at least 200 blocks.

| Group | Anchor | Measured Y |
|---|---|---|
| Far North Wilds Shelf | 1123, −945 | 32 |
| North Reach Pinefall | 1731, −937 | 32 |
| High Downs Terrace | 1347, −777 | 53 |
| East Marches Flat | 1723, −545 | 48 |
| Old Wood West Clearing | 899, −425 | 48 |
| South Reach Meadow | 1411, 63 | 47 |

### One trap worth knowing about

All six groups share **one** monster name pair — "Wilds Pack Mucker" and "Wilds
Pack Hex". That isn't laziness. The native NPC type key is
`monster_${slug(displayName)}`, so per-area names would demand per-area entries
in `HARTHMERE_NATIVE_NPC_ID_MANIFEST`, and a missing entry emits an NPC biscuit
with an **undefined id**, which fails the Bikkie overlay and blocks a clean
server boot. Naming them per-area is exactly how this first broke — 20 failing
assertions with `cannot be decoded by the frontend`. The original open-wilds
groups share "Open Wilds Mucker"/"Open Wilds Hex" for the same reason.

Two manifest entries were added: `monster_wilds_pack_mucker` and
`monster_wilds_pack_hex`.

---

## Anima and Gaia

**Anima** drives these through the ordinary NPC path — nothing bespoke. Both
families reuse the existing `HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES` configs, so
sizes, HP, meat, damage and kill XP match the established cow/sheep/rabbit. Tests
assert every new creature has a finite, positive three-axis size, positive HP and
a finite position — a zero size is the difference between a wandering animal and
an invisible statue. Livestock stay `combatKind: "mux"` (passive, retaliating);
only the six Hexes are `"hex"`.

**Gaia** is untouched. Neither family writes a voxel. The forest animals stand in
columns the forest generator already left empty, and nothing here participates in
`tree_growth`, `leaf_growth` or `flora_growth`.

---

## Bookkeeping

- `HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT`: **140 → 176**. Several
  tests assert against it, so it moves whenever a monster layout is added.
- Id offsets: forest wildlife `10601–10635`, scattered monsters `10701–10736`,
  scattered animals `10741–10776`. All clear of Chapter 1's `10500–10599` band
  and of the previous maximum, 10505.
- Total production seeds: 246 → 353.

## Files

| File | Role |
|---|---|
| `src/shared/harthmere/harthmere_forest_wildlife.ts` | the forest scatter |
| `src/shared/harthmere/live_entity_production_seed.ts` | both seed families |
| `src/shared/harthmere/harthmere_native_id_manifest.ts` | two new NPC type ids |
| `src/shared/harthmere/test/harthmere_new_wildlife_spawns.test.ts` | 21 tests |

Fast check: `node_modules/.bin/tsc -p tsconfig.harthmerewilds.json`
