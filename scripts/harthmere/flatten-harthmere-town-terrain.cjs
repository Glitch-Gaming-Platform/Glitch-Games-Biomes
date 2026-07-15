#!/usr/bin/env node
/*
 * flatten-harthmere-town-terrain.cjs (flat-town fix, 2026-07-14)
 *
 * Flattens the Harthmere town rectangle (the union of the 12 district-bible
 * rectangles, MINUS the protected Thaedryn arena hole) to one ground level
 * (HARTHMERE_TOWN_FLATTEN_TARGET_Y = 64), directly against the world redis.
 *
 * WHY A SCRIPT AND NOT A LIVE MUTATION: the flatten touches up to ~32k
 * columns; pushing that through the live_mode mutation path would rewrite
 * the shared world blob in one WATCH transaction — the exact contention
 * failure mode the 2026-07-13 audit diagnosed (finding 4). This script uses
 * the same direct shard-edit machinery as materialize-business-outposts-
 * redis.cjs: read terrain seeds+diffs, probe each column's current surface,
 * compute MINIMAL delta edits with the shared pure helper
 * (town_flatten_terraform.ts — unit-tested), and write shard diffs in
 * batches. Already-flat columns produce zero edits, so re-runs are
 * idempotent; water columns are skipped so the river keeps its bed.
 *
 * USAGE (from the in-VNet host; see docs/harthmere/TOWN_FLATTEN_RUNBOOK.md):
 *   # Dry run (default): prints the edit plan summary, writes nothing.
 *   REDIS_HOST=10.0.0.12 node scripts/harthmere/flatten-harthmere-town-terrain.cjs
 *   # Apply for real:
 *   REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/flatten-harthmere-town-terrain.cjs
 *   # AFTERWARDS (mandatory): regenerate the placement map so all grounded
 *   # records re-anchor to the new surface:
 *   node scripts/harthmere/build-production-terrain-placement-map.cjs --write --stride=8 --margin=64
 */

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
const { loadTerrain, loadWater } = require("../../src/shared/game/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const { blockPos, voxelShard } = require("../../src/shared/game/shard");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");
const {
  HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y,
  HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y,
  HARTHMERE_TOWN_FLATTEN_TARGET_Y,
  harthmereTownFlattenColumnEdits,
  harthmereTownFlattenWorldBounds,
  isHarthmereTownFlattenAuthoredColumn,
  validateHarthmereTownFlattenContract,
} = require("../../src/shared/harthmere/town_flatten_terraform");
const {
  unshiftHarthmereWorldPositionToAuthored,
} = require("../../src/shared/harthmere/coordinate_transform");

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
// Vertical probe range: everything the flatten math can touch, plus the
// probe headroom above the carve cap so we can find surfaces up there.
const PROBE_MIN_Y = HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y - 8;
const PROBE_MAX_Y = HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y + 32;

function targetShardIds(bounds) {
  const shards = new Set();
  for (let x = bounds.minX; x <= bounds.maxX; x += 16) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 16) {
      for (let y = PROBE_MIN_Y; y <= PROBE_MAX_Y; y += 16) {
        shards.add(voxelShard(x, y, z));
      }
    }
  }
  // Include the exact max edges (stride 16 can skip them).
  for (let y = PROBE_MIN_Y; y <= PROBE_MAX_Y; y += 16) {
    shards.add(voxelShard(bounds.maxX, y, bounds.maxZ));
  }
  return shards;
}

/** Scan the world redis once, keeping the freshest terrain entity per shard
 * (same selection rule as the placement-map builder). */
async function scanTerrain(voxeloo, targetShards) {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const found = new Map();
  let cursor = "0";
  let scanned = 0;
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
      const encoded = unpacked?.[2];
      if (!encoded?.["33"] || !encoded?.["34"]) continue;
      const [tick, entity] = deserializeRedisEntityState(id, raw);
      if (!entity?.hasBox?.() || !entity?.hasShardSeed?.()) continue;
      const shardId = voxelShard(...entity.box().v0);
      if (!targetShards.has(shardId)) continue;
      const current = found.get(shardId);
      if (current && current.tick >= tick) continue;
      let terrain;
      let water;
      try {
        terrain = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
        water = entity.hasShardWater?.() ? loadWater(voxeloo, entity) : undefined;
      } catch {
        terrain = undefined;
        water = undefined;
      }
      if (!terrain) continue;
      current?.terrain?.delete?.();
      current?.water?.delete?.();
      found.set(shardId, { id, tick, terrain, water });
    }
  } while (cursor !== "0");
  redis.disconnect();
  return { found, scanned };
}

function makeSamplers(tensorByShard) {
  const shardFor = (x, y, z) => tensorByShard.get(voxelShard(x, y, z));
  return {
    solid(x, y, z) {
      const shard = shardFor(x, y, z);
      if (!shard?.terrain) return null; // unknown (unloaded shard)
      const id = shard.terrain.get(...blockPos(x, y, z));
      return id !== 0 && terrainCollides(id);
    },
    water(x, y, z) {
      const shard = shardFor(x, y, z);
      if (!shard?.terrain) return null;
      if (!shard.water) return false;
      return Number(shard.water.get(...blockPos(x, y, z))) > 0;
    },
  };
}

/** Topmost solid Y in the probe range, or undefined when the column has no
 * loaded terrain (skipped by the pure helper for safety). */
function probeColumn(samplers, x, z) {
  for (let y = PROBE_MAX_Y; y >= PROBE_MIN_Y; y -= 1) {
    const solid = samplers.solid(x, y, z);
    if (solid === null) return { surfaceY: undefined };
    if (solid === true) {
      return { surfaceY: y, isWater: samplers.water(x, y + 1, z) === true };
    }
  }
  return { surfaceY: undefined };
}

async function main() {
  // Refuse to run at all if the safety contract is violated (arena hole,
  // connector road, target level inside caps, anchor/target agreement).
  const contract = validateHarthmereTownFlattenContract();
  if (!contract.ok) {
    throw new Error(`flatten contract failed: ${contract.failures.join("; ")}`);
  }
  const voxeloo = await loadVoxeloo();
  const bounds = harthmereTownFlattenWorldBounds();
  const shards = targetShardIds(bounds);
  console.error(
    JSON.stringify({ phase: "scan", bounds, targetShardCount: shards.size })
  );
  const { found, scanned } = await scanTerrain(voxeloo, shards);

  // Compute minimal edits per column with the unit-tested shared helper.
  const samplers = makeSamplers(found);
  const editsByShard = new Map();
  const columnStats = { total: 0, flat: 0, carved: 0, filled: 0, skipped: 0 };
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
      const [ax, , az] = unshiftHarthmereWorldPositionToAuthored([x, 0, z]);
      if (!isHarthmereTownFlattenAuthoredColumn(ax, az)) continue;
      columnStats.total += 1;
      const probe = probeColumn(samplers, x, z);
      const edits = harthmereTownFlattenColumnEdits(x, z, probe);
      if (!edits.length) {
        if (probe.surfaceY === HARTHMERE_TOWN_FLATTEN_TARGET_Y) {
          columnStats.flat += 1;
        } else {
          columnStats.skipped += 1; // water / unknown terrain
        }
        continue;
      }
      if (probe.surfaceY > HARTHMERE_TOWN_FLATTEN_TARGET_Y) {
        columnStats.carved += 1;
      } else {
        columnStats.filled += 1;
      }
      for (const edit of edits) {
        const shardId = voxelShard(...edit.position);
        const list = editsByShard.get(shardId) ?? [];
        list.push({ position: edit.position, value: Number(edit.value) });
        editsByShard.set(shardId, list);
      }
    }
  }
  const summary = {
    apply: APPLY,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    targetY: HARTHMERE_TOWN_FLATTEN_TARGET_Y,
    bounds,
    columnStats,
    plannedEditCount: [...editsByShard.values()].reduce(
      (count, edits) => count + edits.length,
      0
    ),
    editedShardCount: editsByShard.size,
    scannedKeys: scanned,
  };
  console.log(JSON.stringify(summary, null, 2));
  const missing = [...editsByShard.keys()].filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(`missing ${missing.length} terrain shards for edits`);
  }
  if (!APPLY) {
    console.log("Dry run only. Re-run with APPLY=1 to write shard diffs.");
    return;
  }

  // Write path — identical mechanics to materialize-business-outposts-redis.
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  const shardEntries = [...editsByShard.entries()].sort(([a], [b]) =>
    String(a).localeCompare(String(b))
  );
  let appliedEditCount = 0;
  try {
    await world.waitForHealthy();
    for (
      let start = 0;
      start < shardEntries.length;
      start += APPLY_SHARD_BATCH_SIZE
    ) {
      const batch = shardEntries.slice(start, start + APPLY_SHARD_BATCH_SIZE);
      const editor = world.edit();
      const terrainIds = batch.map(([shardId]) => found.get(shardId).id);
      const entities = await editor.get(terrainIds);
      for (let i = 0; i < batch.length; i += 1) {
        const [, edits] = batch[i];
        const entity = entities[i];
        if (!entity) throw new Error(`terrain entity missing: ${terrainIds[i]}`);
        const seed = new voxeloo.VolumeBlock_U32();
        const diff = new voxeloo.SparseBlock_U32();
        try {
          loadBlockWrapper(voxeloo, seed, entity.shardSeed());
          loadBlockWrapper(voxeloo, diff, entity.shardDiff());
          for (const edit of edits) {
            const local = blockPos(...edit.position);
            if (edit.value === 0) {
              // Carving: deleting a diff entry restores the seed, so only
              // write an explicit 0 when the seed itself is solid there.
              if (seed.get(...local) === 0) diff.del(...local);
              else diff.set(...local, 0);
            } else {
              diff.set(...local, edit.value);
            }
            appliedEditCount += 1;
          }
          entity.mutableShardDiff().buffer = saveBlockWrapper(
            voxeloo,
            diff
          ).buffer;
        } finally {
          seed.delete();
          diff.delete();
        }
      }
      await editor.commit();
      console.error(
        JSON.stringify({
          phase: "applyBatch",
          batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
          batches: Math.ceil(shardEntries.length / APPLY_SHARD_BATCH_SIZE),
          appliedEditCount,
        })
      );
    }
  } finally {
    await world.stop?.();
  }
  console.log(
    JSON.stringify({ done: true, appliedEditCount }, null, 2)
  );
  console.log(
    "REMINDER: regenerate the placement map now (build-production-terrain-placement-map.cjs --write) so grounded records re-anchor."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
