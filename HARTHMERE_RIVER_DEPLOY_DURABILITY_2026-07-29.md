# Why the Brell kept vanishing, and why it will not again (2026-07-29)

## The cause

You were right that reconciliation was not fixing it — reconciliation was one of
the things **doing** it.

The additive Harthmere extension is a deliberately flat plane at Y=52, and
**four independent maintenance systems** each treat any column that breaks that
plane as damage to be repaired. Every one of them carried its own private list
of exceptions, and every list had exactly one entry: the Bellbinder chapel stair
mouth. The river was on none of them.

| # | System | What it did to the river |
|---|---|---|
| 1 | `harthmereUnsolidSurfaceTerrainIds` | Scans every surface shard; any column with no block at ground Y is "holed". Flagged **every river shard on every boot**, queueing an endless rebuild. |
| 2 | `harthmereSurfaceRepairColumnEdits` | Fills sub-grade columns back to Y=52 with soil and caps them with grass. **This is the dirt.** |
| 3 | `audit-production-extension-terrain.cjs` | Fails the deploy on a surface hole, so the repair never got to run cleanly. |
| 4 | `terrainSeedEntityForWrite` | `shard_water` lived in `mutableDefaults`, which is **only applied on shard CREATE**. An ordinary additive deploy rewrote the carve and left it **dry**. |

So each deploy: carved a channel (#4 wrote the seed), refused to fill it with
water (#4 skipped `shard_water`), flagged it as broken (#1, #3), and then paved
it over with soil (#2). That is precisely "the river is gone, it is full of
dirt, the land is uneven, and the repairs do not work".

A fifth contributor: the water reconcile pass that did exist was gated behind
`BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER=1`, an **opt-in env flag** that no
ordinary deploy sets.

## The fix

One named invariant that all five now consult, instead of five private lists:

**`src/shared/harthmere/harthmere_authored_water.ts`** — the single answer to
"is this column authored open water?". It takes **world** coordinates and does
the authored-space transform itself, because mixing those two spaces by hand is
how the additive town has been bitten before.

Wired into every one of them:

1. **Unsolid-surface scan** — skips authored-water columns, so river shards stop
   being reported holed forever.
2. **Surface repair** — authored water is now a *protected column*, returning
   `status: "protected"` with zero edits. It still repairs a genuine pit right
   beside the river; the fix is not "never touch anything near water".
3. **Terrain audit** — now asks the shared predicate instead of carrying its own
   copy of the river test. That drift is exactly what let the audit and the
   repair disagree.
4. **`shard_water` promoted to authored data** for shards that carry authored
   water, so it travels with `shard_seed` and lands on **update**, not just
   create.
5. **The env gate is gone.** Authored water is world content, not an opt-in
   migration.

### The part that matters for your already-broken world

Worlds deployed before this fix have the channel **paved over in their seed**.
Now that river columns no longer count as "unsolid", the hole detector will
never ask for those shards again — so nothing would ever put the carve back.

Those shards therefore get a **full authored rebuild (seed *and* water) on every
deploy**, not a water-only patch. That is what re-cuts the channel and fills it
in one pass. It rewrites identical bytes for a healthy world; the cost is a few
dozen shards along the Brell, and the alternative is a river that silently
disappears again.

**One deliberate trade-off, stated plainly:** on those river shards only, a
player's own water edits are re-flattened to the authored river. That is the
same contract the authored seed already has for terrain, and it applies to the
channel, not the town.

## Fishing

Once the water is real, fishing works through the existing game — `isWaterAtPosition`
and `marchWaterDepth` both read the water tensor. Two properties are asserted so
a future change cannot quietly break it:

- **Depth.** The channel centre holds 5 water voxels. `SHALLOW_WATER` is 3, so
  the main channel rolls the normal-depth fish table while the shelving banks
  still reach the shallow one — both tables from one bank. `DEEP_WATER` (16) is
  deliberately never reached; those species belong to the ocean.
- **Open sky.** Every fish the Fish Food quest asks for is gated on `inOpen`
  (`skyOcclusion <= 8`). The forest is excluded from the channel plus a full
  canopy radius, so no branch can shade the water and silently make them
  unrollable.

The contract asserts water at the surface voxel of **every** course node, not
just the middle.

## Tests

Following `docs/harthmere/TESTING_FASTER.md` and
`docs/harthmere/NATIVE_ECS_END_TO_END_TESTING.md`, this is registered in the
project's own runner rather than as loose files:

```sh
scripts/harthmere/t.sh water        # 84 tests — river, still water, repair exemptions
scripts/harthmere/t.sh boards       # 70 tests — the four request boards
scripts/harthmere/t.sh boards:e2e   # 10 tests — requests through the trigger engine
scripts/harthmere/t.sh postgimme    # 38 tests — Hoedown -> Battery Not Included
```

**New deploy gate** —
`scripts/harthmere/test-harthmere-river-deploy-durability-contract.cjs`, added
to the no-browser contract phase of `run-harthmere-native-ecs-e2e.sh`. It is a
source-*and*-data check on purpose: the geometry tests all pass in a world that
is about to be bulldozed, so the contract asserts on the **wiring** — that the
unsolid scan still exempts authored water, that no env flag gates it, that
`shard_water` is still authored data, and that the audit still asks the shared
predicate.

I verified it actually catches regressions rather than just passing: removing
the unsolid-scan guard and the authored-water write made it fail with both
specific diagnoses, and restoring them made it pass again.

`src/shared/harthmere/test/harthmere_authored_water.test.ts` (18) covers the
predicate, the world/authored transform, bridge decks and mill-race banks being
solid, every repair door being shut, shard claiming, and the fishability
contract.

**329 tests pass** across the water, boards, post-Gimme, jobs-board and
Road Ahead suites.

## What I have not proven

I cannot run the game, so I have not seen water in Harthmere. What is proven is
that all five systems now agree the channel is authored, that the water is
written on update and not only on create, and that a deployment candidate which
regresses any of that fails the gate before shipping.

The first deploy after this change will rewrite the river shards' seed. If the
world has player builds inside the channel footprint, they are in the path of
that rebuild — worth a look at the shard list in the deploy log the first time.
