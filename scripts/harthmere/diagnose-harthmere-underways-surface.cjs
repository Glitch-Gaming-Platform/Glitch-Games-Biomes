#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const { deserializeRedisEntityState } = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { loadMuck, loadSkyOcclusion, loadTerrain } = require("../../src/shared/game/terrain");
const { terrainCollides } = require("../../src/shared/asset_defs/quirk_helpers");
const { harthmereExtensionTerrainEntityIdForShard } = require("../../src/shared/harthmere/world_extension");

const redis = new Redis({ host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT || 6379), lazyConnect: true });

function decode(id, raw) {
  if (!raw) return undefined;
  try { return deserializeRedisEntityState(id, raw)[1]; } catch { return undefined; }
}

async function inspect(voxeloo, shardX, shardZ) {
  const id = harthmereExtensionTerrainEntityIdForShard(shardX, 1, shardZ);
  const entity = decode(id, await redis.getBuffer(`b:${id}`));
  if (!entity) return { shardX, shardZ, id, missing: true };
  const terrain = loadTerrain(voxeloo, { shard_seed: entity.shardSeed?.(), shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined });
  const sky = loadSkyOcclusion(voxeloo, { shard_sky_occlusion: entity.hasShardSkyOcclusion?.() ? entity.shardSkyOcclusion() : undefined });
  const muck = loadMuck(voxeloo, { shard_muck: entity.hasShardMuck?.() ? entity.shardMuck() : undefined });
  const tops = {};
  let holesAt52 = 0;
  let darkAt53 = 0;
  let muckNonzero = 0;
  let muckAt52 = 0;
  let muckAt53 = 0;
  try {
    for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
      let top = 31;
      for (let y = 31; y >= 0; y--) {
        if (terrainCollides(Number(terrain.get(x, y, z)))) { top = y + 32; break; }
      }
      tops[top] = (tops[top] || 0) + 1;
      if (top < 52) holesAt52++;
      if (sky && Number(sky.get(x, 21, z)) > 0) darkAt53++;
      if (muck) {
        for (let y = 0; y < 32; y++) if (Number(muck.get(x, y, z)) > 0) muckNonzero++;
        if (Number(muck.get(x, 20, z)) > 0) muckAt52++;
        if (Number(muck.get(x, 21, z)) > 0) muckAt53++;
      }
    }
    return {
      shardX, shardZ, id, tops, holesAt52, darkAt53, muckNonzero, muckAt52, muckAt53,
      components: {
        sky: Boolean(entity.hasShardSkyOcclusion?.()),
        muck: Boolean(entity.hasShardMuck?.()),
        irradiance: Boolean(entity.hasShardIrradiance?.()),
        water: Boolean(entity.hasShardWater?.()),
      },
      bytes: {
        seed: entity.shardSeed?.()?.buffer?.length || 0,
        diff: entity.hasShardDiff?.() ? entity.shardDiff()?.buffer?.length || 0 : 0,
        shapes: entity.hasShardShapes?.() ? entity.shardShapes()?.buffer?.length || 0 : 0,
        sky: entity.hasShardSkyOcclusion?.() ? entity.shardSkyOcclusion()?.buffer?.length || 0 : 0,
        muck: entity.hasShardMuck?.() ? entity.shardMuck()?.buffer?.length || 0 : 0,
      },
    };
  } finally { terrain.delete?.(); sky?.delete?.(); muck?.delete?.(); }
}

async function main() {
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  const playerId = 7804034240681026;
  const player = decode(playerId, await redis.getBuffer(`b:${playerId}`));
  const playerPosition = player?.hasPosition?.() ? player.position()?.v : undefined;
  const rows = [];
  for (let z = -10; z <= -6; z++) for (let x = 60; x <= 64; x++) rows.push(await inspect(voxeloo, x, z));
  console.log(JSON.stringify({ player: { id: playerId, position: playerPosition }, anchor: { sable: [1999, 53, -235], underwaysEcho: [2002, 53, -235], shard: [62, 1, -8] }, rows }, null, 2));
  redis.disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });
