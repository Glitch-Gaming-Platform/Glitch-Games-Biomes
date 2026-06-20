#!/usr/bin/env node
// Probe the REAL production terrain ground height at every position where we
// place entities (relocated muckers/hexers + business owner NPCs), then report
// the elevation spread and whether the grounder's scan budget reaches the
// surface from the authored hint Y.
//
//   REDIS_HOST=20.127.78.175 GLITCH_REDIS_HOST=20.127.78.175 IS_SERVER=1 \
//   node scripts/harthmere/probe-production-terrain-grounding.cjs
//
// Terrain shards are ECS entities indexed by voxelShard(box) -> entityId, so
// (like materialize-business-outposts) we SCAN keys to resolve them.
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { voxelShard, blockPos } = require("../../src/shared/game/shard");
const { loadTerrain } = require("../../src/shared/game/terrain");
const { terrainCollides } = require("../../src/shared/asset_defs/quirk_helpers");
const {
  findHarthmereGroundFeetYByCanStand,
  HARTHMERE_GROUND_SCAN_DOWN_DEFAULT,
  HARTHMERE_GROUND_SCAN_UP_DEFAULT,
} = require("../../src/shared/harthmere/harthmere_entity_grounding");
const {
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_owner_npc_seed");
const {
  muckMonsterAreaForPosition,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai");

const REDIS_HOST = process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "3000", 10);
const PROBE_TOP_Y = 180;
const PROBE_BOTTOM_Y = -16;

function targetShardsForColumns(positions) {
  const shards = new Set();
  for (const [x, , z] of positions) {
    for (let y = PROBE_BOTTOM_Y; y <= PROBE_TOP_Y; y += 1) {
      shards.add(voxelShard(Math.floor(x), y, Math.floor(z)));
    }
  }
  return shards;
}

async function buildTerrainTensorMap(voxeloo, targetShards) {
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });
  await redis.connect();
  const found = new Map(); // shardId -> { tick, tensor }
  let cursor = "0";
  let scanned = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "b:*", "COUNT", SCAN_COUNT);
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
      const enc = unpacked?.[2];
      if (!enc?.["33"] || !enc?.["34"]) continue; // fast pre-filter: has box + shard_seed
      const [tick, entity] = deserializeRedisEntityState(id, raw);
      if (!entity?.hasBox?.() || !entity?.hasShardSeed?.()) continue;
      const shardId = voxelShard(...entity.box().v0);
      if (!targetShards.has(shardId)) continue;
      const current = found.get(shardId);
      if (current && current.tick >= tick) continue;
      let tensor;
      try {
        tensor = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
      } catch {
        tensor = undefined;
      }
      if (!tensor) continue;
      if (current?.tensor) {
        try { current.tensor.delete(); } catch {}
      }
      found.set(shardId, { tick, tensor });
    }
  } while (cursor !== "0");
  redis.disconnect();
  console.error(JSON.stringify({ phase: "scan_complete", scanned, resolvedShards: found.size, targetShards: targetShards.size }));
  return found;
}

function makeSolidity(tensorByShard) {
  // true=solid, false=air, null=no terrain data for that voxel.
  return (x, y, z) => {
    const shard = tensorByShard.get(voxelShard(x, y, z));
    if (!shard?.tensor) return null;
    const id = shard.tensor.get(...blockPos(x, y, z));
    return id !== 0 && terrainCollides(id);
  };
}

function trueGroundFeetY(solidity, x, z) {
  let sawData = false;
  for (let feetY = PROBE_TOP_Y; feetY >= PROBE_BOTTOM_Y; feetY -= 1) {
    const below = solidity(x, feetY - 1, z);
    const at = solidity(x, feetY, z);
    const above = solidity(x, feetY + 1, z);
    if (below !== null || at !== null || above !== null) sawData = true;
    if (below === true && at === false && above === false) return { feetY, sawData };
  }
  return { feetY: undefined, sawData };
}

function grounderFeetY(solidity, x, z, hintY) {
  const canStand = (feetY) =>
    solidity(x, feetY - 1, z) === true &&
    solidity(x, feetY, z) === false &&
    solidity(x, feetY + 1, z) === false;
  return findHarthmereGroundFeetYByCanStand((feetY) => canStand(feetY), { hintY });
}

const PROBE_TOTALS = { budgetMiss: 0, noData: 0, positions: 0 };

function summarize(label, rows) {
  const withGround = rows.filter((r) => r.trueFeetY !== undefined);
  const noData = rows.filter((r) => !r.sawData);
  const budgetMiss = rows.filter((r) => r.sawData && r.trueFeetY !== undefined && r.grounderFeetY === undefined);
  if (!label.startsWith("ALL")) {
    PROBE_TOTALS.budgetMiss += budgetMiss.length;
    PROBE_TOTALS.noData += noData.length;
    PROBE_TOTALS.positions += rows.length;
  }
  const deltas = withGround.map((r) => r.trueFeetY - r.hintY);
  const ys = withGround.map((r) => r.trueFeetY);
  const mn = (a) => (a.length ? Math.min(...a) : null);
  const mx = (a) => (a.length ? Math.max(...a) : null);
  console.log(`\n== ${label} (${rows.length} positions) ==`);
  console.log(JSON.stringify({
    positionsWithGround: withGround.length,
    columnsWithNoTerrainData: noData.length,
    budgetInsufficient: budgetMiss.length,
    groundFeetY: { min: mn(ys), max: mx(ys), spread: ys.length ? mx(ys) - mn(ys) : null },
    deltaTrueGroundMinusHint: { min: mn(deltas), max: mx(deltas), maxAbs: deltas.length ? mx(deltas.map((d) => Math.abs(d))) : null },
    scanBudget: { down: HARTHMERE_GROUND_SCAN_DOWN_DEFAULT, up: HARTHMERE_GROUND_SCAN_UP_DEFAULT },
  }, null, 2));
  for (const r of budgetMiss.slice(0, 6)) {
    console.log(`  BUDGET MISS ${r.tag} [${r.x},${r.z}] hint=${r.hintY} trueGround=${r.trueFeetY} delta=${r.trueFeetY - r.hintY}`);
  }
  for (const r of noData.slice(0, 4)) {
    console.log(`  NO TERRAIN DATA ${r.tag} [${r.x},${r.z}] hint=${r.hintY}`);
  }
}

async function main() {
  const voxeloo = await loadVoxeloo();
  const muckers = harthmereGroundedMuckMonsterSeedsInTerritory().map((s) => ({
    tag: s.seedId,
    position: s.position,
    areaId: muckMonsterAreaForPosition(s.position, 1.5)?.id ?? "none",
  }));
  const owners = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((s) => ({ tag: s.ownerNpcId, position: s.position }));
  const allPositions = [...muckers, ...owners].map((it) => it.position);

  const tensorByShard = await buildTerrainTensorMap(voxeloo, targetShardsForColumns(allPositions));
  const solidity = makeSolidity(tensorByShard);

  const probe = (label, items) => {
    const rows = items.map((it) => {
      const [x, hintY, z] = it.position;
      const t = trueGroundFeetY(solidity, x, z);
      return { tag: it.tag, x, z, hintY, trueFeetY: t.feetY, sawData: t.sawData, grounderFeetY: grounderFeetY(solidity, x, z, hintY) };
    });
    summarize(label, rows);
  };

  console.log("====== MUCK MONSTERS — terrain ground probe ======");
  const byArea = new Map();
  for (const m of muckers) {
    if (!byArea.has(m.areaId)) byArea.set(m.areaId, []);
    byArea.get(m.areaId).push(m);
  }
  for (const [areaId, items] of byArea) probe(`muck area: ${areaId}`, items);
  probe("ALL MUCKERS", muckers);
  console.log("\n====== BUSINESS OWNERS — terrain ground probe ======");
  probe("ALL OWNERS", owners);

  for (const { tensor } of tensorByShard.values()) {
    try { tensor.delete(); } catch {}
  }

  // Future check / CI gate: the grounder budget MUST reach the surface at every
  // position that has terrain. budget misses are fatal; missing terrain data
  // (shard not in this world) is a warning.
  console.log(`\n== RESULT == positions=${PROBE_TOTALS.positions} budgetMiss=${PROBE_TOTALS.budgetMiss} noTerrainData=${PROBE_TOTALS.noData}`);
  if (PROBE_TOTALS.budgetMiss > 0) {
    console.error(`FAIL: ${PROBE_TOTALS.budgetMiss} positions where the ground is beyond the grounder scan budget — raise HARTHMERE_GROUND_SCAN_* or move the seed.`);
    process.exit(1);
  }
  if (PROBE_TOTALS.noData > 0) {
    console.error(`WARN: ${PROBE_TOTALS.noData} positions had no terrain loaded in this world.`);
  }
  console.log("PASS: grounder budget reaches the surface at every position with terrain.");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
