
# Harthmere Snapshot-Connected Town Pass v66

This pass applies the snapshot map/landscape design rules and the Harthmere lore guides to the current Harthmere implementation.

## What changed

Harthmere is no longer treated as a hidden local-dev town far away from the snapshot world. The default extra-town offset is now:

```text
BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=512
BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z=0
```

That is shard-aligned: `512 / 32 = 16` shards.

The authored Harthmere connector road is:

```text
[128, -209] -> [392, -209]
```

With the default offset, it renders/places as:

```text
[640, -209] -> [904, -209]
```

So the road starts at the implemented snapshot edge and runs into Harthmere's west road/west gate approach.

## Design rules applied

The lore/design package says Harthmere should read as safety, while the Wilds are beauty, danger, resources, and old memory. This patch applies that directly:

- clear road lane instead of random scatter
- signposts at the snapshot edge and road bend
- red/black Harthmere watch banners
- road lanterns and a larger west-gate lamp
- traveler return-safely candle shrine
- grass/hedgerow shoulder showing the Wilds transition
- road patrol on the safe lane
- bandit scout off the safe lane, not blocking the road
- small Bellbound bronze road nail as a lore breadcrumb

## Files changed

```text
src/server/shim/main.ts
src/server/logic/utils/players.ts
src/client/game/renderers/local_dev/harthmere_assets.ts
scripts/b/data_snapshot.py
scripts/harthmere/dump-harthmere-npc-placement-state-v2.cjs
src/shared/harthmere/town_registry.ts
src/shared/harthmere/town_routes.ts
src/shared/harthmere/town_map.ts
src/shared/harthmere/design_rules_v66.ts
scripts/harthmere/check-harthmere-connected-town-design-v66.cjs
```

## Correct boot modes

Snapshot only:

```bash
SKIP_PROD_LOAD=true BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 BIOMES_START_IN_HARTHMERE=0 ./b data-snapshot run --no-pip-install
```

Snapshot plus connected Harthmere:

```bash
SKIP_PROD_LOAD=true BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 BIOMES_START_IN_HARTHMERE=0 ./b data-snapshot run --no-pip-install
```

Start directly in connected Harthmere:

```bash
SKIP_PROD_LOAD=true BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 BIOMES_START_IN_HARTHMERE=1 ./b data-snapshot run --no-pip-install
```

Legacy local-dev Harthmere only:

```bash
SKIP_PROD_LOAD=true BIOMES_FORCE_LOCAL_DEV_TOWN=1 BIOMES_START_IN_HARTHMERE=1 ./b data-snapshot run --no-pip-install
```

## Validation

Run:

```bash
node scripts/harthmere/check-harthmere-connected-town-design-v66.cjs
```

Expected result: all checks pass.

## Important rule

Do not move Harthmere by changing only the player spawn. Move the full system together:

- server terrain
- runtime visual placements
- NPC positions
- NPC route anchors
- quest markers
- map/UI anchors
- debug dump defaults
- data-snapshot client env defaults

This pass updates the offset defaults and adds code-visible route/map/design contracts so future patches can keep those systems aligned.
