#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const { deserializeRedisEntityState } = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const {
  loadIrradiance,
  loadSkyOcclusion,
  loadTerrain,
} = require("../../src/shared/game/terrain");
const { terrainCollides } = require("../../src/shared/asset_defs/quirk_helpers");
const {
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  lazyConnect: true,
});
const confirmed = [
  [58, -11], [59, -11], [59, 0], [62, -10], [62, -1],
  [63, -9], [63, -2], [64, -6], [64, -5],
];

function decode(id, raw) {
  if (!raw) return undefined;
  try { return deserializeRedisEntityState(id, raw)[1]; } catch { return undefined; }
}

async function inspect(voxeloo, shardX, shardZ) {
  const id = harthmereExtensionTerrainEntityIdForShard(shardX, 1, shardZ);
  const raw = await redis.getBuffer(`b:${id}`);
  const entity = decode(id, raw);
  if (!entity) return { shardX, shardZ, id, missing: true };
  const terrain = loadTerrain(voxeloo, {
    shard_seed: entity.shardSeed?.(),
    shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
  });
  const sky = loadSkyOcclusion(voxeloo, {
    shard_sky_occlusion: entity.hasShardSkyOcclusion?.()
      ? entity.shardSkyOcclusion()
      : undefined,
  });
  const irradiance = loadIrradiance(voxeloo, {
    shard_irradiance: entity.hasShardIrradiance?.()
      ? entity.shardIrradiance()
      : undefined,
  });
  const y52 = 52 - 32;
  let solid52 = 0, solid51 = 0, darkAbove = 0, skyAboveSum = 0;
  let irradianceAboveNonzero = 0;
  try {
    for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
      if (terrainCollides(Number(terrain.get(x, y52, z)))) solid52++;
      if (terrainCollides(Number(terrain.get(x, y52 - 1, z)))) solid51++;
      const skyValue = sky ? Number(sky.get(x, y52 + 1, z)) : -1;
      if (skyValue > 0) darkAbove++;
      if (skyValue >= 0) skyAboveSum += skyValue;
      if (irradiance && Number(irradiance.get(x, y52 + 1, z)) !== 0) {
        irradianceAboveNonzero++;
      }
    }
    return {
      shardX, shardZ, id,
      components: {
        seed: entity.hasShardSeed?.() || false,
        diff: entity.hasShardDiff?.() || false,
        shapes: entity.hasShardShapes?.() || false,
        skyOcclusion: entity.hasShardSkyOcclusion?.() || false,
        irradiance: entity.hasShardIrradiance?.() || false,
        water: entity.hasShardWater?.() || false,
      },
      solid52, solid51,
      darkAbove,
      averageSkyAbove: sky ? skyAboveSum / 1024 : null,
      irradianceAboveNonzero,
      diffBufferBytes: entity.hasShardDiff?.() ? entity.shardDiff()?.buffer?.length ?? 0 : 0,
      shapesBufferBytes: entity.hasShardShapes?.() ? entity.shardShapes()?.buffer?.length ?? 0 : 0,
      skyBufferBytes: entity.hasShardSkyOcclusion?.() ? entity.shardSkyOcclusion()?.buffer?.length ?? 0 : 0,
      irradianceBufferBytes: entity.hasShardIrradiance?.() ? entity.shardIrradiance()?.buffer?.length ?? 0 : 0,
    };
  } finally {
    terrain.delete?.(); sky?.delete?.(); irradiance?.delete?.();
  }
}

async function main() {
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  const positions = [];
  for (const [x, z] of confirmed) {
    positions.push([x, z], [x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]);
  }
  const unique = [...new Map(positions.map((p) => [p.join(":"), p])).values()];
  const rows = [];
  for (const [x, z] of unique) rows.push(await inspect(voxeloo, x, z));
  console.log(JSON.stringify({ confirmed, rows }, null, 2));
  redis.disconnect();
}
main().catch((error) => { console.error(error); process.exit(1); });
