# Harthmere extension surface repair — the sunken black pits

_2026-07-28. Fixes the 32×32 black pits in the wilds forest around Harthmere._

## What the pits are

They are **missing surface terrain shards**, not caves.

The additive extension is seeded as four stacked shard layers per column:

| Shard Y   | World Y     | Contents                                                                                 |
| --------- | ----------- | ---------------------------------------------------------------------------------------- |
| −2, −1, 0 | −64 … 31    | plain foundation stone                                                                   |
| **1**     | **32 … 63** | **the flat cap at Y=52, six voxels of soil under it, and the wilds forest on top of it** |
| 2         | 64 … 95     | roofs, gate towers, tall landmarks (sparse)                                              |

When the shardY=1 record is absent or holed, the column's topmost solid voxel
falls from Y=52 to the foundation top at **Y=31**. The player sees a 32×32,
21-block-deep hole whose walls read exactly as the generator writes them — one
grass voxel at 52, dirt to 46, stone below — and whose floor is black because
nothing ever computed sky occlusion down there.

Evidence: the 2026-07-28 HAR capture (`hathmere_sunken.har`). Decoding the
`/sync/oob` id lists through `harthmereExtensionTerrainEntityIdForShard` shows
columns where the client fetched shardY −2, −1, 0 **and 2** but never 1. A load
radius cannot skip the nearer shard and fetch the farther one, so those surface
shards are simply not in the ECS. Affected columns seen in that one session:

```
shard(58,-11) shard(59,-11) shard(59,0)  shard(62,-10) shard(62,-1)
shard(63,-9)  shard(63,-2)  shard(64,-6) shard(64,-5)
```

(world X = shardX × 32, world Z = shardZ × 32; authored X = world X − 1600.)
That list is only where this player walked — treat the full 744-shard sweep as
the source of truth.

## Are they caves?

No. Harthmere's underground is authored and entered through authored mouths:

- **Old Well / Underways** rooms and tunnels at Y 46–51 under the town core;
- the **Bellbinder switchback** below the chapel, with landings at Y −6, −14,
  −26, −60 — its stair mouth is the one intentional break in the plane;
- the **exotic-matter caves** (Mossglass, Windowlight, Deep Spindle, the three
  massive systems), each with a named entrance.

Lore-wise the town sits on the largest antimatter deposit on Earth and refuses
to mine it — the shafts in the back country are **sealed headframes**, scenery
behind the boundary wall, not open holes. An unmarked pit in the forest floor is
a missing shard, and the repair protects every real cave column and refuses to
fill any of them.

## Repair

Both halves are idempotent. Run from the in-VNet host.

```bash
# 0. Confirm the damage. Reports missing / invalid / emptyFoundation /
#    surfaceHoles across all 2,976 foundation and 744 surface shards.
REDIS_HOST=10.0.0.12 node scripts/harthmere/audit-production-extension-terrain.cjs

# 1. Dry run the repair. Prints the plan; writes nothing.
REDIS_HOST=10.0.0.12 node scripts/harthmere/repair-harthmere-extension-surface.cjs

# 2. Apply. Fills the sunken columns, re-dresses the wilds as forest, creates
#    any missing surface shard, and lifts every NPC/animal off the pit floor.
REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/repair-harthmere-extension-surface.cjs

# 3. Re-audit. Must report zero of everything.
REDIS_HOST=10.0.0.12 node scripts/harthmere/audit-production-extension-terrain.cjs

# 4. Re-anchor every remaining actor family and fail closed on floaters/burials.
REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/probe-production-terrain-grounding.cjs
REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/reconcile-production-live-creature-grounding.cjs
```

Useful switches: `SKIP_CREATURES=1` (terrain only), `NO_FOREST=1` (ground-only
repair, no trees), `APPLY_SHARD_BATCH_SIZE` (default 8 shards per transaction).

### What the repair writes

The edit math is pure and unit-tested in
`src/shared/harthmere/extension_surface_repair.ts`
(`src/shared/harthmere/test/extension_surface_repair.test.ts`):

- **fill** — stone/dirt from just above the existing terrain up to Y=51, using
  the seeder's own strata (`depth > 6 ? stone : dirt`);
- **cap** — grass at Y=52;
- **cover / forest** — one voxel of ground flora at Y=53 and trunk/canopy voxels
  above, from `harthmere_wilds_forest.ts` — the same generator the seeder uses,
  so a repaired patch grows the tree the original seed would have grown there.

Three properties are enforced by tests:

1. **Add-only.** No edit is air and no edit lands at or below the probed
   surface, so the repair cannot shave a build, punch through the Underways
   ceiling, or carve a dungeon.
2. **Idempotent.** A column already solid at Y=52 plans zero edits.
3. **Protected columns.** The Bellbinder stair mouth and every authored cave
   footprint are refused outright and reported, never sealed.

Writes go into **`shard_seed`**, not `shard_diff`: this is authored terrain
being restored, so Gaia restoration must not be able to revert it and re-open
the pit. An existing `shard_diff` entry (a real player edit) keeps priority and
is skipped.

Forest dressing is deliberately more conservative than the seeder — it skips the
padded town envelope, the back country, and the connector/North Gate corridors,
because the seeder's full road and Muck predicates live in the shim. A few
fringe columns therefore return as bare flat grass; step 5 restores them.

### Creatures

While a surface shard was missing, the grounding passes correctly resolved "the
terrain under this actor" as the foundation top at Y=31, so NPCs, the twelve
town animals and wandering wildlife were grounded 21 blocks down and are
standing in the dark. The repair scans every non-terrain ECS record with a
position inside the extension, lifts anything below the feet plane back to
**Y=53**, pins `npc_metadata.spawn_position` to the same anchor so the next
respawn does not drop it back in, and reads every record back — the run fails if
any did not persist. Actors below the pit floor (Underways, Bellbinder) and
actors in protected columns are never moved.

## Prevention

Two changes in `src/server/shim/main.ts`:

1. **`HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION` bumped to
   `…-v3-surface-solidity`.** The next guarded maintenance seed rewrites every
   extension shard from the generator, which is also what puts the forest back
   over ground the repair could only leave as grass.
2. **`harthmereUnsolidSurfaceTerrainIds()` replaces "the entity id exists" as
   the skip test.** Seeding used to treat a present record as proof of ground;
   it now reads each surface shard's tensor and rebuilds any whose plane at
   Y=52 is not solid (the Bellbinder opening excepted). A current fingerprint
   over holed terrain no longer skips — that is exactly how these pits survived
   every boot.

Remember that normal three-replica web revisions run with
`BIOMES_CREATE_LOCAL_DEV_TERRAIN=0`, so the self-heal only fires on the
maintenance revision. Promotion stays blocked on
`audit-production-extension-terrain.cjs`.

## Verify

```bash
./b test -b -p "src/shared/harthmere/test/extension_surface_repair.test.ts"
./b test -b -p "src/shared/harthmere/test/additive_world_extension.test.ts"
./b test -b -p "src/shared/harthmere/test/harthmere_wilds_forest_gaia.test.ts"
./b test -b -p "src/shared/harthmere/test/town_flatten_terraform.test.ts"
```

In-game, after the repair: walk the wilds south and west of the west gate at
Y≈53 and confirm there is no drop; the minimap shows continuous ground; no NPC
or animal is standing below the plane.
