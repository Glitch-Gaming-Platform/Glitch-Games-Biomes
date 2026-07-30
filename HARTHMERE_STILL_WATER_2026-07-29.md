# The fountain, the trough and the mill race (2026-07-29)

Follow-up to `HARTHMERE_RIVER_2026-07-29.md`. All three remaining water features
now hold real water, and the `materials.water` fallback that caused the whole
class of bug is gone from the codebase.

## Were they supposed to have water?

Yes, all three — and each was visibly broken without it:

| Feature | Authored as | What it looked like |
|---|---|---|
| **Market Plaza fountain** (482–490, −213–205) | a disc of `materials.water` at relY 1 inside a polished ring, plus a column of it at relY 2 | a blue wool disc with a **floating wool pillar** standing on it |
| **Farmyard trough** (455–459, −246–242) | a flat 5×5 patch of `materials.water` at relY 1 | a wool rectangle **lying on the grass**, no trough at all, beside the hayrack post at (444, −242) |
| **Watermill race** (370–378, −407–401) | a flat 9×7 patch of `materials.water` at relY 0 | a wool patch the mill wheel turned **over without touching** |

Same root cause as the river: `water: terrainId("water", terrainId("blue_wool", stone))`,
and Biomes has no water block, so every one of them rendered in wool.

## Why they needed rebuilding, not just recolouring

Wool is solid, so none of these shapes ever had to *hold* anything. Real water
does. From `update_water` (`voxeloo/gaia/water.cpp`, doc §5.3): level 15 is a
source that never depletes, it spreads into any flowable neighbour losing one
level per step, and it falls wherever the voxel below is flowable. An open-sided
source reaches **fourteen voxels**.

Each feature had at least one fatal leak as authored:

- the fountain's upper tier had **no rim** — a source at head height with open
  air on all four sides would have poured over the market square;
- the trough had **no walls whatsoever**;
- the race was a surface patch, not a channel.

A second rule wool didn't have to respect: a block needs something holding it
up. That is why the fountain's floating water column became a **plinth**.

## What they are now

**Market fountain** — the authored 9×9 footprint and its `d ≤ 4.5` outer wall
are unchanged. Inside: a wide annular basin of water at relY 1 around a solid
two-voxel plinth, topped at relY 3 by a small stone-brick bowl with a single
spout voxel of water in it. Every side of both the basin and the bowl is walled
at the water's own height.

**Farmyard trough** — a one-voxel oak wall around a 3×3 well of water, in the
same yard beside the hayrack. Shifted **one row south**: its northern row
z = −246 was inside `traveler_hearth_player_house` (448–466, −266–246). Harmless
while it was decorative wool the house generator overrode; not somewhere to put
a water source.

**Watermill race** — a real channel cut into the surface, flush with grade, so
the wheel turns *in* it. It also had to **move**: the authored patch straddled
x = 374, which is the west wall of `miller_rest_watermill` (374–394, −414–394),
so half of it was inside the building. The wheel hangs off that west wall, which
is what a watermill wheel does, so the race now runs north–south alongside the
wall (368–373, −412–396), stopping one voxel short of it. Every part of the
wheel's arc outside the mill housing is over open water.

Both of those relocations are things the wool versions were hiding — a solid
block inside a building or under a wall is invisible; a water source there is
not.

## Proving containment

This is the part I said I would not ship without, and it is the centrepiece of
the test file. `floodFrom` implements the engine's own spread rule — flowable
neighbours only, one level lost per horizontal step, falling water arriving at
`kMaxWater - 1` and not spreading sideways while it falls — and runs it outward
from **every** source voxel in a feature. The test then asserts that nothing the
flood reaches lies outside that feature's own footprint, in any direction
including vertically.

The prover is itself checked against the bug it exists to find: an unwalled
source over open ground must escape, fall, and spread the full fourteen voxels.
It does.

## Tests — 21, ~40 ms

| Group | Coverage |
|---|---|
| Containment (7) | each of the three cannot leak, in any direction; each keeps every source at full strength (i.e. is not draining into itself); and the prover demonstrably catches a rimless basin |
| Structure (5) | never floats a block; never puts water and a block in the same voxel; always seals the floor under every water voxel; the three footprints are disjoint; all three clear the river and all 57 buildings |
| Fountain (3) | authored footprint and outer wall preserved; a real annular basin around a solid plinth; the spout is rimmed on all four sides |
| Trough (1) | walls on the border, water inside — a container, not a puddle |
| Mill race (3) | cuts a channel rather than painting the grass, with solid bank all round; the wheel's working arc is over water; the race stops short of the mill wall |
| Seeder contract (2) | shard early-out; writes nothing outside its own footprints |

Full run across the water and quest work: **122 tests passing**, including the
river suite and the untouched Road Ahead / muck-pack / combat-routing
regressions.

## The `materials.water` fallback is gone

`localDevMaterials()` no longer has a `water` key, and there are no remaining
call sites — only comments explaining why. The entry is replaced by a note
saying a block cannot be water and pointing at the two modules that now own it,
so this cannot quietly come back.

## Files

```
src/shared/harthmere/harthmere_still_water.ts            (new)
src/shared/harthmere/test/harthmere_still_water.test.ts  (new — 21 tests)
src/server/shim/main.ts                                  (wiring; removed the last three wool patches and the `water` material)
```

Vegetation and the wilderness harvest markers are now excluded from all three
footprints for the same reasons they are excluded from the river — no trunk in a
basin, no wood crate floating in a trough.

## Two things to note

**The Grove fountain comparison is incomplete.** You pointed at it as the
reference, and I could not finish reading it. The live snapshot's water lives in
`shard_water` components inside the 1.3 GB `snapshot_backup.json`; the extraction
pass was still running after ~25 minutes and I stopped it rather than keep you
waiting. The four `src/galois/data/gaia/water_*.tensor` files *do* decode (they
are real, not LFS pointers, 2048×512×2048 each) but their contents did not line
up with Grove-area columns on the coordinate mapping I tried, so I could not use
them as a substitute. What I built instead is derived from the engine's flood
rule directly and proven against it — which is the property that matters — but
if the Grove fountain has a specific silhouette you want matched, that is worth
a second look with the game running.

**Two scratch test files need deleting.** `src/shared/harthmere/test/tmp_grove_water.test.ts`
and `tmp_trough_probe.test.ts` are stubbed out to `export {}` — the sandbox
would not let me remove them.
