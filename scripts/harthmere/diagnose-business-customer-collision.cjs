#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { loadTerrain } = require("../../src/shared/game/terrain");
const { terrainCollides } = require("../../src/shared/asset_defs/quirk_helpers");

const host = process.env.REDIS_HOST || "127.0.0.1";
const port = Number(process.env.REDIS_PORT || 6493);
const position = String(process.env.POSITION || "673.36,67.02,-61.34")
  .split(",")
  .map(Number);

function close(a, b, meters) {
  return Math.abs(a - b) <= meters;
}

async function main() {
  const redis = new Redis({ host, port, lazyConnect: true });
  await redis.connect();
  if (process.env.ONLY_ID) {
    const id = Number(process.env.ONLY_ID);
    const raw = await redis.getBuffer(`b:${id}`);
    const [, entity] = deserializeRedisEntityState(id, raw);
    console.log(JSON.stringify(entity?.materialize?.(), null, 2));
    redis.disconnect();
    return;
  }
  const nearby = [];
  const terrainEntities = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "b:*", "COUNT", 5000);
    cursor = next;
    const values = await redis.mgetBuffer(keys);
    for (let index = 0; index < keys.length; index += 1) {
      const raw = values[index];
      if (!raw) continue;
      const id = Number(keys[index].slice(2));
      if (!Number.isFinite(id)) continue;
      let encoded;
      try {
        encoded = unpackFromRedis(raw)?.[2];
      } catch {
        continue;
      }
      if (!encoded) continue;
      let entity;
      try {
        [, entity] = deserializeRedisEntityState(id, raw);
      } catch {
        continue;
      }
      if (!entity) continue;
      if (entity.hasBox?.() && entity.hasShardSeed?.()) {
        const box = entity.box();
        if (
          box.v0[0] < 679 && box.v1[0] > 669 &&
          box.v0[1] < 71 && box.v1[1] > 64 &&
          box.v0[2] < -53 && box.v1[2] > -67
        ) {
          terrainEntities.push({ id, entity, box });
        }
      }
      if (!entity.hasPosition?.()) continue;
      const p = entity.position().v;
      if (!close(p[0], position[0], 6) || !close(p[1], position[1], 4) || !close(p[2], position[2], 8)) continue;
      nearby.push({
        id,
        position: p,
        size: entity.hasSize?.() ? entity.size().v : undefined,
        collideable: entity.hasCollideable?.() || false,
        label: entity.hasLabel?.() ? entity.label().text : undefined,
        npc: entity.hasNpcMetadata?.() || false,
        player: entity.hasPlayerStatus?.() || false,
        placeable: entity.hasPlaceableComponent?.() || false,
        placeableComponent: entity.hasPlaceableComponent?.()
          ? entity.placeableComponent()
          : undefined,
        orientation: entity.hasOrientation?.() ? entity.orientation().v : undefined,
      });
    }
  } while (cursor !== "0");

  const voxeloo = await loadVoxeloo();
  const terrain = [];
  for (const match of terrainEntities) {
    const tensor = loadTerrain(voxeloo, {
      shard_seed: match.entity.shardSeed(),
      shard_diff: match.entity.hasShardDiff?.() ? match.entity.shardDiff() : undefined,
    });
    try {
      for (let y = Math.max(65, match.box.v0[1]); y <= Math.min(70, match.box.v1[1] - 1); y += 1) {
        for (let z = Math.max(-66, match.box.v0[2]); z <= Math.min(-54, match.box.v1[2] - 1); z += 1) {
          for (let x = Math.max(670, match.box.v0[0]); x <= Math.min(678, match.box.v1[0] - 1); x += 1) {
            const value = Number(tensor.get(x - match.box.v0[0], y - match.box.v0[1], z - match.box.v0[2]));
            if (value !== 0) terrain.push({ x, y, z, value, collides: terrainCollides(value) });
          }
        }
      }
    } finally {
      tensor.delete?.();
    }
  }
  console.log(JSON.stringify({ position, nearby, terrainEntities: terrainEntities.map(({ id, box }) => ({ id, box })), terrain }, null, 2));
  redis.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
