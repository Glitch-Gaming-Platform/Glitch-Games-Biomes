# Biomes Production Redis Crash Loop — 2026-06-15

## Summary

Production revision `biomes-node-vnet--0000108` crash-looped because the
external production Redis did not contain the installed snapshot world data.
The runtime correctly refused to start normal app replicas with an empty or
wrongly-marked Redis snapshot.

Key crash signature:

```text
Snapshot Redis populate skipped for external production Redis hash=3013026c00d11eb16ab4cacfb524b317 previous=missing
dbsize=4 required_seed_keys_present=0/3
ERROR production Redis is not loaded with this image's snapshot.
```

Additional infrastructure findings:

- Redis `6379` had been publicly reachable.
- Redis persistence pointed at an unsafe/broken location instead of
  `/var/lib/redis/dump.rdb`.
- Redis persistence status had been failing, so restarts could lose world data.

## Recovery Performed

1. Scaled the Container App down to stop the crash loop.
2. Resized the Redis VM OS disk from `30GB` to `128GB`.
3. Repaired Redis persistence:
   - `dir=/var/lib/redis`
   - `dbfilename=dump.rdb`
   - `save="900 1 300 10 60 10000"`
   - `appendonly=no`
4. Bootstrapped Redis from `snapshot_backup.json` using the production image.
5. Set both snapshot hash keys to `3013026c00d11eb16ab4cacfb524b317`.
6. Forced `BGSAVE` and verified `rdb_last_bgsave_status=ok`.
7. Removed public Redis access.
8. Added the NSG allow rule from the Container Apps subnet `10.0.1.0/27`.
9. Added an explicit deny rule for all other `6379/tcp` sources.
10. Shifted traffic to healthy revision `biomes-node-vnet--0000110`.
11. Deactivated failed revisions `0000108` and `0000109`.

Known-good post-recovery state:

```text
Container App revision: biomes-node-vnet--0000110
Traffic: 100
Health: Healthy
Runtime state: Running
Redis dbsize: 335512
Required seed keys: 3/3
Snapshot hash: 3013026c00d11eb16ab4cacfb524b317
World metadata entity: 1/1
Business owners: 19/19
Business crafting stations: 19/19
Business customers: 57/57
Redis RDB save: rdb_last_bgsave_status=ok
```

## Guardrails

The production deploy script now fails closed when any of these are wrong:

- Redis NSG does not allow `6379/tcp` from `10.0.1.0/27`.
- Redis NSG does not explicitly deny other `6379/tcp` sources.
- Deploy configuration tries to rely on the old public Redis host path.
- Redis write probe fails.
- Redis persistence is not `/var/lib/redis/dump.rdb`.
- Redis RDB save schedule is not `900 1 300 10 60 10000`.
- Redis snapshot hash does not match the packaged `snapshot_backup.json`.
- Required world seed keys are missing.
- Authored Harthmere content is missing after reconciliation: business owners
  `19/19`, business crafting stations `19/19`, business customers `57/57`,
  muckers `100/100`, and wildlife `24/24`.
- Business outpost terrain materialization does not process `19/19` outposts.
  This is the failure mode where NPCs, customers, and business boards exist, but
  the shop building voxels are missing.
- A post-reconciliation Redis `BGSAVE` does not finish with
  `rdb_last_bgsave_status=ok`.

Run the live private Redis guardrail check with:

```bash
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --redis-health-check-only
```

## Rules Going Forward

- Do not reopen public Redis `6379`.
- Do not deploy normal app replicas with `GLITCH_POPULATE_SNAPSHOT_REDIS=1`.
- Do not run a local `FLUSHALL` bootstrap against production Redis.
- Run full post-deploy world reconciliation only from an Azure/VNet runner that
  can reach private Redis:

```bash
PROD_REDIS_RECONCILE_HOST=10.0.0.12 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```

- If an emergency app-only deploy or Redis restore skipped world reconciliation,
  first run the business terrain materializer from inside the active Container
  App, one outpost at a time, then run the ECS/world reconciler and persist Redis
  from the VM:

```bash
# Repeat for every id from HARTHMERE_BUSINESS_OUTPOSTS. Production deploys
# do this automatically; this manual shape is for emergency repair only.
az containerapp exec \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --command "env APPLY=1 IS_SERVER=1 REDIS_HOST=10.0.0.12 GLITCH_REDIS_HOST=10.0.0.12 LOCAL_REDIS_HOST=10.0.0.12 REDIS_PORT=6379 GLITCH_REDIS_PORT=6379 SCAN_COUNT=5000 APPLY_SHARD_BATCH_SIZE=2 OUTPOST_ID=outpost_clinic_greenlamp node scripts/harthmere/materialize-business-outposts-redis.cjs"

az containerapp exec \
  --resource-group openai-resource-group \
  --name biomes-node-vnet \
  --command "env APPLY=1 IS_SERVER=1 REDIS_HOST=10.0.0.12 GLITCH_REDIS_HOST=10.0.0.12 LOCAL_REDIS_HOST=10.0.0.12 REDIS_PORT=6379 GLITCH_REDIS_PORT=6379 node scripts/harthmere/reconcile-production-world-sync.cjs"

az vm run-command invoke \
  --resource-group openai-resource-group \
  --name biomes-redis-prod \
  --command-id RunShellScript \
  --scripts 'redis-cli BGSAVE; redis-cli INFO persistence | grep rdb_last_bgsave_status'
```

- For app-only deploys from a local workstation:

```bash
HARTHMERE_SKIP_WORLD_SYNC_RECONCILIATION=1 \
scripts/glitch/deploy-production-local-redis-smoke.sh --push
```
