# Glitch + Biomes Snapshot Merge Runbook

Glitch-Games-Biomes is the code/gameplay authority. The 2026-05-16 Biomes data snapshot is the base-world/data/assets authority.

## Current merge layers

1. Snapshot installer and asset hash alignment.
2. Snapshot spawn/home fix so the game starts in the snapshot world by default.
3. Redis-backed snapshot runtime bridge.
4. Harthmere shifted extra-town support, disabled in snapshot-only mode.
5. Player animation compatibility: snapshot clips remain default, Harthmere combat clips remain opt-in/fallback aware.
6. Placeable, NPC type, collision, and buff compatibility firebreaks for older snapshot data.
7. Runtime gate so Harthmere client visuals do not appear in the snapshot-only world.
8. Snapshot NPC cosmetics fallback for player-like NPCs that have no wearing/appearance ECS data.
9. Pre-mission integration diagnostics. The next true gameplay patch is quest/mission reconciliation only if snapshot data actually contains mission fields to import.

## One-command regression

```bash
cd /Users/devindixon/Development/biomes-game
node scripts/harthmere/check-snapshot-glitch-merge-all-v2.cjs
```

## Snapshot-only boot

```bash
cd /Users/devindixon/Development/biomes-game
SKIP_PROD_LOAD=true \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 \
BIOMES_START_IN_HARTHMERE=0 \
./b data-snapshot run --no-pip-install
```

Expected: upstream snapshot world only. Harthmere runtime visuals are hidden.

## Snapshot + shifted Harthmere extra town

```bash
cd /Users/devindixon/Development/biomes-game
SKIP_PROD_LOAD=true \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 \
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
BIOMES_START_IN_HARTHMERE=0 \
./b data-snapshot run --no-pip-install
```

Expected: snapshot base world, Harthmere shifted by `x + 2048`.

## Start directly in shifted Harthmere

```bash
cd /Users/devindixon/Development/biomes-game
SKIP_PROD_LOAD=true \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=1 \
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
BIOMES_START_IN_HARTHMERE=1 \
./b data-snapshot run --no-pip-install
```

## Clean snapshot Redis reset

```bash
cd /Users/devindixon/Development/biomes-game
BIOMES_FORCE_SNAPSHOT_REDIS_RESET=1 \
BIOMES_SNAPSHOT_REDIS_RESET_YES=1 \
SKIP_PROD_LOAD=true \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 \
BIOMES_START_IN_HARTHMERE=0 \
./b data-snapshot run --no-pip-install
```

## Diagnostics

```bash
node scripts/harthmere/dump-harthmere-npc-placement-state-v2.cjs
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 node scripts/harthmere/dump-harthmere-npc-placement-state-v2.cjs
node scripts/harthmere/dump-snapshot-quest-mission-state-v1.cjs
node scripts/harthmere/dump-snapshot-pre-mission-integration-state-v1.cjs
```

## Known compatibility logs

Search for these markers in browser/server logs:

- `SNAPSHOT_NPC_COSMETICS_FALLBACK_V1`
- `snapshot-placeable-galois-fallback`
- `missing-AABB`
- `SNAPSHOT_BUFF_TYPE_COMPAT`
- `LEGACY_SNAPSHOT_NPC`

These are not permanent product behavior; they are explicit migration markers that tell us where snapshot data does not match newer Glitch schemas.
