#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const {
  createHarthmereBusinessOutpostRebuildMaterializationPlansV1,
} = require("../../src/shared/harthmere/business_customer_simulator_v1");
const { blockPos, voxelShard } = require("../../src/shared/game/shard");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");

const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const APPLY = process.env.APPLY === "1";
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "2500", 10);
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "8", 10)
);
const OUTPOST_ID_FILTER = (
  process.env.OUTPOST_ID ||
  process.env.OUTPOST_IDS ||
  ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function scanTerrainEntitiesByShard(targetShards) {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const found = new Map();
  let scanned = 0;
  let candidateTerrain = 0;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      "b:*",
      "COUNT",
      SCAN_COUNT
    );
    cursor = next;
    scanned += keys.length;
    if (scanned > 0 && scanned % (SCAN_COUNT * 20) < keys.length) {
      console.error(
        JSON.stringify({
          phase: "scanTerrainEntitiesByShard",
          scanned,
          candidateTerrain,
          resolvedShardCount: found.size,
          targetShardCount: targetShards.size,
        })
      );
    }
    if (!keys.length) continue;
    const values = await redis.mgetBuffer(keys);
    for (let i = 0; i < values.length; i += 1) {
      const raw = values[i];
      if (!raw) continue;
      const id = Number(keys[i].slice(2));
      if (!Number.isFinite(id)) continue;
      let unpacked;
      try {
        unpacked = unpackFromRedis(raw);
      } catch {
        continue;
      }
      const encodedEntity = unpacked?.[2];
      if (!encodedEntity?.["33"] || !encodedEntity?.["34"]) continue;
      candidateTerrain += 1;
      const [tick, entity] = deserializeRedisEntityState(id, raw);
      if (!entity?.hasBox?.() || !entity?.hasShardSeed?.()) continue;
      const shardId = voxelShard(...entity.box().v0);
      if (!targetShards.has(shardId)) continue;
      const current = found.get(shardId);
      if (
        !current ||
        tick > current.tick ||
        (tick === current.tick && id > current.id)
      ) {
        found.set(shardId, { id, tick });
      }
    }
  } while (cursor !== "0");
  redis.disconnect();
  return { found, scanned, candidateTerrain };
}

async function main() {
  const voxeloo = await loadVoxeloo();
  const plans =
    createHarthmereBusinessOutpostRebuildMaterializationPlansV1().filter(
      (plan) =>
        plan.requestId.endsWith("_materialization") &&
        (OUTPOST_ID_FILTER.length === 0 ||
          OUTPOST_ID_FILTER.some((outpostId) =>
            plan.requestId.startsWith(`${outpostId}_`)
          ))
    );
  const editsByShard = new Map();
  for (const plan of plans) {
    for (const edit of plan.edits) {
      const shardId = voxelShard(...edit.position);
      const edits = editsByShard.get(shardId) ?? [];
      edits.push({ position: edit.position, value: Number(edit.value) });
      editsByShard.set(shardId, edits);
    }
  }

  const { found, scanned, candidateTerrain } = await scanTerrainEntitiesByShard(
    new Set(editsByShard.keys())
  );
  const missingShards = [...editsByShard.keys()].filter(
    (shardId) => !found.has(shardId)
  );
  const summary = {
    apply: APPLY,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    outpostFilter: OUTPOST_ID_FILTER,
    plannedEditCount: [...editsByShard.values()].reduce(
      (count, edits) => count + edits.length,
      0
    ),
    targetShardCount: editsByShard.size,
    resolvedShardCount: found.size,
    missingShardCount: missingShards.length,
    redisScan: { scanned, candidateTerrain },
  };
  console.log(JSON.stringify(summary, null, 2));
  if (missingShards.length > 0) {
    throw new Error(
      `Missing ${missingShards.length} business outpost terrain shards`
    );
  }
  if (!APPLY) {
    console.log("Dry run only. Re-run with APPLY=1 to write shard diffs.");
    return;
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  let changedShardCount = 0;
  let appliedEditCount = 0;
  const shardEntries = [...editsByShard.entries()].sort(([a], [b]) =>
    String(a).localeCompare(String(b))
  );
  try {
    await world.waitForHealthy();
    for (
      let batchStart = 0;
      batchStart < shardEntries.length;
      batchStart += APPLY_SHARD_BATCH_SIZE
    ) {
      const batchEntries = shardEntries.slice(
        batchStart,
        batchStart + APPLY_SHARD_BATCH_SIZE
      );
      const editor = world.edit();
      const terrainIds = batchEntries.map(
        ([shardId]) => found.get(shardId).id
      );
      const terrainEntities = await editor.get(terrainIds);
      const idToEntity = new Map();
      for (let i = 0; i < terrainIds.length; i += 1) {
        const entity = terrainEntities[i];
        if (!entity) {
          throw new Error(`Resolved terrain entity missing: ${terrainIds[i]}`);
        }
        idToEntity.set(terrainIds[i], entity);
      }

      let batchChangedShardCount = 0;
      let batchAppliedEditCount = 0;
      for (const [shardId, edits] of batchEntries) {
        const entity = idToEntity.get(found.get(shardId).id);
        const seed = new voxeloo.VolumeBlock_U32();
        const diff = new voxeloo.SparseBlock_U32();
        try {
          loadBlockWrapper(voxeloo, seed, entity.shardSeed());
          loadBlockWrapper(voxeloo, diff, entity.shardDiff());
          for (const edit of edits) {
            const local = blockPos(...edit.position);
            if (edit.value === 0) {
              if (seed.get(...local) === 0) {
                diff.del(...local);
              } else {
                diff.set(...local, 0);
              }
            } else {
              diff.set(...local, edit.value);
            }
            batchAppliedEditCount += 1;
          }
          entity.mutableShardDiff().buffer = saveBlockWrapper(
            voxeloo,
            diff
          ).buffer;
          batchChangedShardCount += 1;
        } finally {
          seed.delete();
          diff.delete();
        }
      }

      await editor.commit();
      changedShardCount += batchChangedShardCount;
      appliedEditCount += batchAppliedEditCount;
      console.error(
        JSON.stringify({
          phase: "applyShardBatch",
          batchIndex: Math.floor(batchStart / APPLY_SHARD_BATCH_SIZE) + 1,
          batchCount: Math.ceil(
            shardEntries.length / APPLY_SHARD_BATCH_SIZE
          ),
          changedShardCount,
          appliedEditCount,
        })
      );
    }
  } finally {
    await world.stop?.();
  }
  console.log(
    JSON.stringify(
      {
        applied: true,
        changedShardCount,
        appliedEditCount,
        applyShardBatchSize: APPLY_SHARD_BATCH_SIZE,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
