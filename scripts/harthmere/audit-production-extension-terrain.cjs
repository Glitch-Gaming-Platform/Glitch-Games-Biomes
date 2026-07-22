#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { terrainCollides } = require("../../src/shared/asset_defs/quirk_helpers");
const { loadTerrain } = require("../../src/shared/game/terrain");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  harthmereExtensionFoundationShardSpecs,
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");

const REDIS_HOST =
  process.env.REDIS_HOST ||
  process.env.GLITCH_REDIS_HOST ||
  process.env.LOCAL_REDIS_HOST ||
  "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.HARTHMERE_TERRAIN_AUDIT_BATCH_SIZE || "250", 10)
);
const SHARD_DIM = 32;

function isIntentionalSurfaceOpening(worldX, worldZ) {
  const [authoredX, , centerZ] =
    HARTHMERE_BELLBINDER_DESCENT.surfaceOpeningCenter;
  const centerX = authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  return (
    worldX >= centerX - 1 &&
    worldX <= centerX + 1 &&
    worldZ >= centerZ - 2 &&
    worldZ <= centerZ
  );
}

function expectedBox(spec) {
  return {
    v0: [spec.shardX * SHARD_DIM, spec.shardY * SHARD_DIM, spec.shardZ * SHARD_DIM],
    v1: [
      (spec.shardX + 1) * SHARD_DIM,
      (spec.shardY + 1) * SHARD_DIM,
      (spec.shardZ + 1) * SHARD_DIM,
    ],
  };
}

function sameVec3(a, b) {
  return Boolean(a && b && a.length === 3 && a.every((value, index) => value === b[index]));
}

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

async function main() {
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true });
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  const specs = harthmereExtensionFoundationShardSpecs();
  const missing = [];
  const invalid = [];
  const emptyFoundation = [];
  const surfaceHoles = [];
  const retiredTerrainIds = [];

  try {
    for (let start = 0; start < specs.length; start += BATCH_SIZE) {
      const batch = specs.slice(start, start + BATCH_SIZE);
      const ids = batch.map((spec) => {
        const id = harthmereExtensionTerrainEntityIdForShard(
          spec.shardX,
          spec.shardY,
          spec.shardZ
        );
        if (id === undefined) {
          throw new Error(
            `foundation shard has no stable id: ${spec.shardX}:${spec.shardY}:${spec.shardZ}`
          );
        }
        return id;
      });
      const values = await redis.mgetBuffer(ids.map((id) => `b:${id}`));

      for (let index = 0; index < batch.length; index += 1) {
        const spec = batch[index];
        const id = ids[index];
        const entity = decodeEntity(id, values[index]);
        if (!entity) {
          missing.push({ id, spec });
          continue;
        }
        const box = entity.hasBox?.() ? entity.box() : undefined;
        const expected = expectedBox(spec);
        if (
          !entity.hasShardSeed?.() ||
          !sameVec3(box?.v0, expected.v0) ||
          !sameVec3(box?.v1, expected.v1)
        ) {
          invalid.push({ id, spec, box });
          continue;
        }

        const terrain = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
        try {
          if (spec.shardY <= 0) {
            const probes = [
              [0, 0, 0],
              [31, 0, 31],
              [0, 31, 31],
              [31, 31, 0],
              [16, 16, 16],
            ];
            if (
              !probes.some(([x, y, z]) =>
                terrainCollides(Number(terrain.get(x, y, z)))
              )
            ) {
              emptyFoundation.push({ id, spec });
            }
            continue;
          }
          if (spec.shardY !== 1) continue;
          const localGroundY = HARTHMERE_EXTENSION_GROUND_Y - expected.v0[1];
          for (let localZ = 0; localZ < SHARD_DIM; localZ += 1) {
            for (let localX = 0; localX < SHARD_DIM; localX += 1) {
              const terrainId = Number(terrain.get(localX, localGroundY, localZ));
              const belowTerrainId = Number(
                terrain.get(localX, localGroundY - 1, localZ)
              );
              const worldX = expected.v0[0] + localX;
              const worldZ = expected.v0[2] + localZ;
              // Water and other non-colliding surface materials are valid only
              // when a solid foundation remains directly underneath them.
              const supportedSurface =
                Boolean(terrainId) &&
                (terrainCollides(terrainId) || terrainCollides(belowTerrainId));
              const intentionalOpening =
                !terrainId && isIntentionalSurfaceOpening(worldX, worldZ);
              if (!supportedSurface && !intentionalOpening) {
                surfaceHoles.push({
                  id,
                  position: [
                    worldX,
                    HARTHMERE_EXTENSION_GROUND_Y,
                    worldZ,
                  ],
                  terrainId,
                  belowTerrainId,
                });
                // One representative hole per shard keeps failure output bounded.
                localZ = SHARD_DIM;
                break;
              }
            }
          }
        } finally {
          terrain.delete?.();
        }
      }
    }

    // The retired sequential band shared numbers with escort companions. Only
    // terrain-shaped records are stale; legitimate NPC records must survive.
    const retiredIds = Array.from(
      {
        length:
          HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT -
          HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
      },
      (_, offset) => HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE + offset
    );
    for (let start = 0; start < retiredIds.length; start += BATCH_SIZE) {
      const ids = retiredIds.slice(start, start + BATCH_SIZE);
      const values = await redis.mgetBuffer(ids.map((id) => `b:${id}`));
      for (let index = 0; index < ids.length; index += 1) {
        const entity = decodeEntity(ids[index], values[index]);
        if (entity?.hasBox?.() && entity.hasShardSeed?.()) {
          retiredTerrainIds.push(ids[index]);
        }
      }
    }
  } finally {
    redis.disconnect();
  }

  const summary = {
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    expectedFoundationShards: specs.length,
    expectedSurfaceShards: specs.filter((spec) => spec.shardY === 1).length,
    missingCount: missing.length,
    invalidCount: invalid.length,
    emptyFoundationCount: emptyFoundation.length,
    surfaceHoleShardCount: surfaceHoles.length,
    retiredTerrainCount: retiredTerrainIds.length,
    samples: {
      missing: missing.slice(0, 8),
      invalid: invalid.slice(0, 8),
      emptyFoundation: emptyFoundation.slice(0, 8),
      surfaceHoles: surfaceHoles.slice(0, 8),
      retiredTerrainIds: retiredTerrainIds.slice(0, 8),
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  if (
    missing.length ||
    invalid.length ||
    emptyFoundation.length ||
    surfaceHoles.length ||
    retiredTerrainIds.length
  ) {
    throw new Error("Harthmere extension terrain audit failed");
  }
  console.log("OK Harthmere extension is complete, flat at Y=52, and free of retired terrain shards.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
