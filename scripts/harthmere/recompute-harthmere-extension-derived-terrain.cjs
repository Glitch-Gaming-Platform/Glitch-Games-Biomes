#!/usr/bin/env node
/*
 * Re-enqueue Gaia's derived terrain simulations for every Harthmere extension
 * surface shard. This is needed after an out-of-band shard_seed repair: merely
 * restoring authored terrain does not guarantee that sky occlusion, irradiance,
 * and water were ever derived for shards that were absent when Gaia first saw
 * the extension.
 *
 * Dry run by default. Set APPLY=1 to write an identical shard_seed component,
 * which emits the normal terrain-change event consumed by Gaia without changing
 * any voxel or player edit.
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
  ShardIrradiance,
  ShardSeed,
  ShardSkyOcclusion,
  ShardWater,
} = require("../../src/shared/ecs/gen/components");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");
const { Tensor } = require("../../src/shared/wasm/tensors");
const {
  harthmereSurfaceRepairShardSpecs,
} = require("../../src/shared/harthmere/extension_surface_repair");

const APPLY = process.env.APPLY === "1";
const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || 6379);
const BATCH_SIZE = Math.max(1, Number(process.env.BATCH_SIZE || 8));
const PULSE = process.env.PULSE === "1";
const DIRECT_OPEN_SKY = process.env.DIRECT_OPEN_SKY === "1";

function decode(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

async function main() {
  const specs = harthmereSurfaceRepairShardSpecs();
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });
  await redis.connect();
  const values = await redis.mgetBuffer(specs.map(({ id }) => `b:${id}`));
  const present = [];
  const missing = [];
  for (let i = 0; i < specs.length; i++) {
    const entity = decode(specs[i].id, values[i]);
    if (!entity?.hasShardSeed?.()) {
      missing.push(specs[i].id);
    } else {
      present.push({ id: specs[i].id, seed: entity.shardSeed() });
    }
  }
  console.log(JSON.stringify({ apply: APPLY, pulse: PULSE, directOpenSky: DIRECT_OPEN_SKY, expected: specs.length, present: present.length, missing }));
  if (!APPLY) {
    redis.disconnect();
    return;
  }
  if (missing.length) {
    throw new Error(`refusing derived-state recompute with ${missing.length} missing surface shards`);
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  const voxeloo = PULSE || DIRECT_OPEN_SKY ? await loadVoxeloo() : undefined;
  let zeroSky;
  let zeroIrradiance;
  let zeroWater;
  if (DIRECT_OPEN_SKY) {
    const sky = Tensor.make(voxeloo, [32, 32, 32], "U8");
    const irradiance = Tensor.make(voxeloo, [32, 32, 32], "U32");
    const water = Tensor.make(voxeloo, [32, 32, 32], "U8");
    try {
      zeroSky = ShardSkyOcclusion.create(sky.saveWrapped());
      zeroIrradiance = ShardIrradiance.create(irradiance.saveWrapped());
      zeroWater = ShardWater.create(water.saveWrapped());
    } finally {
      sky.delete();
      irradiance.delete();
      water.delete();
    }
  }
  try {
    await world.waitForHealthy();
    for (let start = 0; start < present.length; start += BATCH_SIZE) {
      const batch = present.slice(start, start + BATCH_SIZE);
      if (DIRECT_OPEN_SKY) {
        await world.apply({
          changes: batch.map(({ id }) => ({
            kind: "update",
            entity: {
              id,
              shard_sky_occlusion: zeroSky,
              shard_irradiance: zeroIrradiance,
              shard_water: zeroWater,
            },
          })),
        });
      }
      if (PULSE) {
        const pulsed = batch.map(({ id, seed }) => {
          const block = new voxeloo.VolumeBlock_U32();
          try {
            loadBlockWrapper(voxeloo, block, seed);
            const original = Number(block.get(0, 0, 0));
            block.set(0, 0, 0, original === 0 ? 1 : 0);
            return { id, seed: ShardSeed.create(saveBlockWrapper(voxeloo, block)) };
          } finally {
            block.delete();
          }
        });
        await world.apply({
          changes: pulsed.map(({ id, seed }) => ({
            kind: "update",
            entity: { id, shard_seed: seed },
          })),
        });
      }
      await world.apply({
        changes: batch.map(({ id, seed }) => ({
          kind: "update",
          entity: { id, shard_seed: ShardSeed.create({ buffer: seed.buffer }) },
        })),
      });
      console.log(JSON.stringify({ phase: "enqueueGaia", pulse: PULSE, directOpenSky: DIRECT_OPEN_SKY, touched: Math.min(start + batch.length, present.length), total: present.length }));
    }
  } finally {
    await world.stop?.();
    redis.disconnect();
  }
  console.log(JSON.stringify({ done: true, touched: present.length }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
