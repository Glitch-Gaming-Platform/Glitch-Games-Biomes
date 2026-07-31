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
  CH1_WORLD_BUILDING_PLANS,
} = require("../../src/shared/harthmere/ch1_world_buildings");
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
const REQUIRE_CURRENT = process.env.REQUIRE_CURRENT === "1";
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "2500", 10);
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "4", 10)
);
const SHARED_WORLD_STATE_KEY = "harthmere:live_mode:current:world:harthmere";

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

function finalEditsByShard() {
  const byPosition = new Map();
  for (const plan of CH1_WORLD_BUILDING_PLANS) {
    for (const edit of plan.edits) {
      byPosition.set(edit.position.join(","), {
        position: edit.position,
        value: Number(edit.value),
      });
    }
  }
  const byShard = new Map();
  for (const edit of byPosition.values()) {
    const shardId = voxelShard(...edit.position);
    const edits = byShard.get(shardId) ?? [];
    edits.push(edit);
    byShard.set(shardId, edits);
  }
  return { byPosition, byShard };
}

async function acknowledgeMaterializedBuildings() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await redis.watch(SHARED_WORLD_STATE_KEY);
      const raw = await redis.get(SHARED_WORLD_STATE_KEY);
      if (!raw) {
        await redis.unwatch();
        return 0;
      }
      const state = JSON.parse(raw);
      let changed = 0;
      for (const plan of CH1_WORLD_BUILDING_PLANS) {
        const structure = state?.building?.placedStructures?.[plan.requestId];
        if (structure && structure.materializedInEcs !== true) {
          structure.materializedInEcs = true;
          changed += 1;
        }
      }
      if (changed === 0) {
        await redis.unwatch();
        return 0;
      }
      state.updatedAtMs = Date.now();
      const result = await redis
        .multi()
        .set(SHARED_WORLD_STATE_KEY, JSON.stringify(state))
        .exec();
      if (result !== null) return changed;
    }
    throw new Error("Could not acknowledge Chapter 1 building materialization");
  } finally {
    redis.disconnect();
  }
}

async function main() {
  const voxeloo = await loadVoxeloo();
  const { byPosition, byShard } = finalEditsByShard();
  const { found, scanned, candidateTerrain } = await scanTerrainEntitiesByShard(
    new Set(byShard.keys())
  );
  const missingShards = [...byShard.keys()].filter(
    (shardId) => !found.has(shardId)
  );
  if (missingShards.length > 0) {
    throw new Error(
      `Missing ${
        missingShards.length
      } Chapter 1 world-building terrain shards: ${missingShards.join(", ")}`
    );
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  let pendingEditCount = 0;
  let changedShardCount = 0;
  let appliedEditCount = 0;
  const shardEntries = [...byShard.entries()].sort(([a], [b]) =>
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
      const terrainIds = batchEntries.map(([shardId]) => found.get(shardId).id);
      const terrainEntities = await editor.get(terrainIds);
      let batchChanged = false;
      for (let i = 0; i < batchEntries.length; i += 1) {
        const [shardId, edits] = batchEntries[i];
        const entity = terrainEntities[i];
        if (!entity) {
          throw new Error(`Resolved terrain entity missing: ${terrainIds[i]}`);
        }
        const seed = new voxeloo.VolumeBlock_U32();
        const diff = new voxeloo.SparseBlock_U32();
        try {
          loadBlockWrapper(voxeloo, seed, entity.shardSeed());
          loadBlockWrapper(voxeloo, diff, entity.shardDiff());
          let shardChanged = false;
          for (const edit of edits) {
            const local = blockPos(...edit.position);
            const current = diff.get(...local) ?? seed.get(...local) ?? 0;
            if (current === edit.value) continue;
            pendingEditCount += 1;
            if (!APPLY) continue;
            if (edit.value === 0) {
              if (seed.get(...local) === 0) {
                diff.del(...local);
              } else {
                diff.set(...local, 0);
              }
            } else {
              diff.set(...local, edit.value);
            }
            shardChanged = true;
            appliedEditCount += 1;
          }
          if (APPLY && shardChanged) {
            entity.mutableShardDiff().buffer = saveBlockWrapper(
              voxeloo,
              diff
            ).buffer;
            changedShardCount += 1;
            batchChanged = true;
          }
        } finally {
          seed.delete();
          diff.delete();
        }
      }
      if (APPLY && batchChanged) {
        await editor.commit();
      }
    }
  } finally {
    await world.stop?.();
  }

  const acknowledgedStructures = APPLY
    ? await acknowledgeMaterializedBuildings()
    : 0;
  // `pendingEditCount` describes the pre-commit world that this invocation
  // inspected. In APPLY mode every counted edit was written before the shared
  // state acknowledgement, so treating that historical count as still pending
  // makes the useful APPLY=1 REQUIRE_CURRENT=1 mode fail after a successful
  // commit. Keep both numbers: operators can see what changed, while the gate
  // reports only edits that remain unapplied by this invocation.
  const remainingPendingEditCount = APPLY
    ? pendingEditCount - appliedEditCount
    : pendingEditCount;
  const summary = {
    apply: APPLY,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    planIds: CH1_WORLD_BUILDING_PLANS.map((plan) => plan.requestId),
    plannedFinalEditCount: byPosition.size,
    targetShardCount: byShard.size,
    resolvedShardCount: found.size,
    missingShardCount: missingShards.length,
    pendingEditCount,
    remainingPendingEditCount,
    changedShardCount,
    appliedEditCount,
    acknowledgedStructures,
    redisScan: { scanned, candidateTerrain },
  };
  console.log(JSON.stringify(summary, null, 2));
  if (REQUIRE_CURRENT && remainingPendingEditCount > 0) {
    throw new Error(
      `Chapter 1 world buildings have ${remainingPendingEditCount} pending voxel edits`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
