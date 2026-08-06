#!/usr/bin/env node
/*
 * Remove terrain entities that occupy the exact same 32^3 box as a canonical
 * additive Harthmere terrain entity. These stale original-map identities can
 * win terrain selection by tick and make canonical buildings appear suspended
 * over the terrain carried by the shadow entity.
 *
 * Safety contract:
 *   - never retire the canonical stable Harthmere id;
 *   - never retire a noncanonical-only shard (the extension audit owns holes);
 *   - require an exact box match with a present canonical terrain entity;
 *   - fail on a misaligned box or one physically crossing X=1792;
 *   - strip only terrain identity so unrelated ECS components survive;
 *   - read the complete world back after applying and require zero conflicts.
 */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION,
  harthmereTerrainBoxesEqual,
  isHarthmereExactTerrainOverlapAuditRow,
  planHarthmereExactTerrainOverlapRepair,
} = require("../../src/shared/harthmere/exact_terrain_overlap_repair");

const APPLY = process.env.APPLY === "1";
const REQUIRE_CLEAN = process.env.HARTHMERE_EXACT_OVERLAP_REQUIRE_CLEAN === "1";
const REDIS_HOST =
  process.env.REDIS_HOST ||
  process.env.GLITCH_REDIS_HOST ||
  process.env.LOCAL_REDIS_HOST ||
  "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const SCAN_COUNT = Math.max(
  100,
  Number.parseInt(process.env.HARTHMERE_EXACT_OVERLAP_SCAN_COUNT || "3000", 10)
);
const APPLY_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(
    process.env.HARTHMERE_EXACT_OVERLAP_APPLY_BATCH_SIZE || "40",
    10
  )
);
const APPLY_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.HARTHMERE_EXACT_OVERLAP_APPLY_RETRIES || "4", 10)
);

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

function terrainRow(id, entity) {
  if (!entity?.hasBox?.() || !entity?.hasShardSeed?.()) return undefined;
  const box = entity.box();
  if (!box?.v0 || !box?.v1) return undefined;
  return {
    id,
    box: { v0: [...box.v0], v1: [...box.v1] },
    diffBytes: entity.hasShardDiff?.()
      ? entity.shardDiff()?.buffer?.length || 0
      : 0,
  };
}

async function scanTerrainRows(redis) {
  const rows = [];
  let cursor = "0";
  let scannedEntities = 0;
  let batches = 0;
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      "b:*",
      "COUNT",
      SCAN_COUNT
    );
    cursor = next;
    scannedEntities += keys.length;
    batches += 1;
    if (keys.length) {
      const values = await redis.mgetBuffer(keys);
      for (let index = 0; index < keys.length; index += 1) {
        const id = Number(keys[index].slice(2));
        if (!Number.isSafeInteger(id)) continue;
        const row = terrainRow(id, decodeEntity(id, values[index]));
        if (row && isHarthmereExactTerrainOverlapAuditRow(row)) {
          rows.push(row);
        }
      }
    }
    if (batches % 10 === 0 || cursor === "0") {
      console.error(
        JSON.stringify({
          phase: "scan",
          scannedEntities,
          scopedTerrainRows: rows.length,
        })
      );
    }
  } while (cursor !== "0");
  return { rows, scannedEntities };
}

function assertSafePlan(plan) {
  if (plan.unsafe.length === 0) return;
  throw new Error(
    `Unsafe Harthmere terrain overlap geometry: ${JSON.stringify(
      plan.unsafe.slice(0, 12)
    )}`
  );
}

async function retireBatch(world, batch) {
  for (let attempt = 1; attempt <= APPLY_RETRIES; attempt += 1) {
    const canonicalIds = [...new Set(batch.map((row) => row.canonicalId))];
    const canonicalEntities = await world.get(canonicalIds);
    for (let index = 0; index < canonicalIds.length; index += 1) {
      const target = batch.find(
        (candidate) => candidate.canonicalId === canonicalIds[index]
      );
      const canonical = terrainRow(
        canonicalIds[index],
        canonicalEntities[index]
      );
      if (
        !target ||
        !canonical ||
        !harthmereTerrainBoxesEqual(canonical.box, target.box)
      ) {
        throw new Error(
          `Canonical Harthmere terrain ${canonicalIds[index]} disappeared or moved before overlap repair`
        );
      }
    }

    const current = await world.getWithVersion(batch.map((row) => row.id));
    const iffs = [];
    const changes = [];
    for (let index = 0; index < batch.length; index += 1) {
      const target = batch[index];
      const [version, entity] = current[index];
      if (!entity) continue;
      const row = terrainRow(target.id, entity);
      if (!row || !harthmereTerrainBoxesEqual(row.box, target.box)) {
        throw new Error(
          `Overlap candidate ${target.id} changed identity after planning`
        );
      }
      if (target.id === target.canonicalId) {
        throw new Error(`Refusing to retire canonical terrain ${target.id}`);
      }
      iffs.push([target.id, version]);
      changes.push({
        kind: "update",
        entity: {
          id: target.id,
          box: null,
          shard_seed: null,
          shard_diff: null,
          shard_shapes: null,
        },
      });
    }
    if (!changes.length) return 0;
    const result = await world.apply({ iffs, changes });
    if (result.outcome === "success") return changes.length;
    if (attempt === APPLY_RETRIES) {
      throw new Error(
        `Terrain overlap retirement failed after ${attempt} attempts: ${result.outcome}`
      );
    }
  }
  return 0;
}

function summary(scan, plan) {
  return {
    version: HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION,
    apply: APPLY,
    requireClean: REQUIRE_CLEAN,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    scannedEntities: scan.scannedEntities,
    scopedTerrainRows: scan.rows.length,
    canonicalConflictGroups: plan.canonicalConflictGroups,
    exactDuplicateRows: plan.candidates.length,
    rowsWithDiff: plan.candidates.filter((row) => (row.diffBytes ?? 0) > 0)
      .length,
    samples: plan.candidates.slice(0, 12).map((row) => ({
      id: row.id,
      canonicalId: row.canonicalId,
      shard: row.shard,
      diffBytes: row.diffBytes ?? 0,
    })),
  };
}

async function main() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  try {
    const before = await scanTerrainRows(redis);
    const plan = planHarthmereExactTerrainOverlapRepair(before.rows);
    assertSafePlan(plan);
    console.log(
      "HARTHMERE_EXACT_OVERLAP_PLAN " + JSON.stringify(summary(before, plan))
    );

    if (REQUIRE_CLEAN) {
      if (plan.candidates.length > 0) {
        throw new Error(
          `Harthmere exact terrain overlap gate found ${plan.candidates.length} duplicate rows`
        );
      }
      console.log(
        `HARTHMERE_EXACT_TERRAIN_OVERLAP_READY verify=1 candidates=0 version=${HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION}`
      );
      return;
    }

    if (!APPLY) {
      console.log(
        `HARTHMERE_EXACT_TERRAIN_OVERLAP_READY apply=0 candidates=${plan.candidates.length} version=${HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION}`
      );
      return;
    }

    const world = new RedisWorld(await connectToRedisWithLua("ecs"));
    let appliedRetirements = 0;
    try {
      await world.waitForHealthy();
      for (
        let start = 0;
        start < plan.candidates.length;
        start += APPLY_BATCH_SIZE
      ) {
        appliedRetirements += await retireBatch(
          world,
          plan.candidates.slice(start, start + APPLY_BATCH_SIZE)
        );
        console.error(
          JSON.stringify({
            phase: "retire_terrain_identity",
            appliedRetirements,
            planned: plan.candidates.length,
          })
        );
      }
    } finally {
      await world.stop?.();
    }

    const after = await scanTerrainRows(redis);
    const remaining = planHarthmereExactTerrainOverlapRepair(after.rows);
    assertSafePlan(remaining);
    if (remaining.candidates.length > 0) {
      throw new Error(
        `Harthmere exact terrain overlap repair left ${remaining.candidates.length} duplicate rows`
      );
    }
    console.log(
      "HARTHMERE_EXACT_OVERLAP_RESULT " +
        JSON.stringify({
          planned: plan.candidates.length,
          appliedRetirements,
          remaining: 0,
        })
    );
    console.log(
      `HARTHMERE_EXACT_TERRAIN_OVERLAP_READY apply=1 planned=${plan.candidates.length} retired=${appliedRetirements} remaining=0 version=${HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION}`
    );
  } finally {
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
