#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const { safeGetTerrainId } = require("../../src/shared/asset_defs/terrain");
const { loadMuck, loadSeed } = require("../../src/shared/game/terrain");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  harthmereExtensionFoundationShardSpecs,
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");
const {
  isHarthmereAuthoredWaterColumn,
} = require("../../src/shared/harthmere/harthmere_authored_water");

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
const AUDIT_MODE = process.env.HARTHMERE_TERRAIN_AUDIT_MODE || "full";
/** Report the damage and exit 0. See the HARTHMERE_DEPLOY_TERRAIN_GATE note. */
const NON_FATAL = process.env.HARTHMERE_TERRAIN_AUDIT_NON_FATAL === "1";
const SHARD_DIM = 32;
const FORBIDDEN_HARTHMERE_MUCK_TERRAIN_IDS = new Set(
  ["muckwad", "DEPRECATED_muckwad", "splintered_muck", "mucky_brambles"]
    .map((name) => safeGetTerrainId(name))
    .filter((id) => id !== undefined)
    .map(Number)
);

// HARTHMERE_AUTHORED_WATER: one source of truth for "this column is open by
// design". The audit used to carry its own copy of the river test, which is
// exactly how the surface repair and the unsolid-surface scan drifted apart
// and started paving the Brell over. Ask the shared predicate instead.
function isIntentionalSurfaceOpening(worldX, worldZ) {
  if (isHarthmereAuthoredWaterColumn(worldX, worldZ)) {
    return true;
  }
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
    v0: [
      spec.shardX * SHARD_DIM,
      spec.shardY * SHARD_DIM,
      spec.shardZ * SHARD_DIM,
    ],
    v1: [
      (spec.shardX + 1) * SHARD_DIM,
      (spec.shardY + 1) * SHARD_DIM,
      (spec.shardZ + 1) * SHARD_DIM,
    ],
  };
}

function sameVec3(a, b) {
  return Boolean(
    a && b && a.length === 3 && a.every((value, index) => value === b[index])
  );
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
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  const specs = harthmereExtensionFoundationShardSpecs();
  const missing = [];
  const invalid = [];
  const emptyFoundation = [];
  const surfaceHoles = [];
  const forbiddenMuckBlocks = [];
  const atmosphericMuckBlocks = [];
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

        // Deployment audits validate the authored baseline, not the combined
        // player-visible terrain. shard_diff is durable player/world state:
        // mining, placed blocks, tilled soil, crops, and materialized homes all
        // intentionally override shard_seed and must not make a deploy fail.
        const terrain = loadSeed(voxeloo, {
          shard_seed: entity.shardSeed(),
        });
        if (!terrain) {
          invalid.push({ id, spec, box, reason: "unreadable shard_seed" });
          continue;
        }
        const muck = loadMuck(voxeloo, {
          shard_muck: entity.hasShardMuck?.() ? entity.shardMuck() : undefined,
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
          for (const [localPosition, muckiness] of muck) {
            if (!muckiness) continue;
            atmosphericMuckBlocks.push({
              id,
              position: [
                expected.v0[0] + localPosition[0],
                expected.v0[1] + localPosition[1],
                expected.v0[2] + localPosition[2],
              ],
              muckiness,
            });
          }
          for (let localY = 0; localY < SHARD_DIM; localY += 1) {
            for (let localZ = 0; localZ < SHARD_DIM; localZ += 1) {
              for (let localX = 0; localX < SHARD_DIM; localX += 1) {
                const terrainId = Number(terrain.get(localX, localY, localZ));
                if (FORBIDDEN_HARTHMERE_MUCK_TERRAIN_IDS.has(terrainId)) {
                  forbiddenMuckBlocks.push({
                    id,
                    position: [
                      expected.v0[0] + localX,
                      expected.v0[1] + localY,
                      expected.v0[2] + localZ,
                    ],
                    terrainId,
                  });
                }
              }
            }
          }
          const localGroundY = HARTHMERE_EXTENSION_GROUND_Y - expected.v0[1];
          for (let localZ = 0; localZ < SHARD_DIM; localZ += 1) {
            for (let localX = 0; localX < SHARD_DIM; localX += 1) {
              const terrainId = Number(
                terrain.get(localX, localGroundY, localZ)
              );
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
                  position: [worldX, HARTHMERE_EXTENSION_GROUND_Y, worldZ],
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
          muck.delete?.();
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
      (_, offset) =>
        HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE + offset
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
    auditMode: AUDIT_MODE,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    expectedFoundationShards: specs.length,
    expectedSurfaceShards: specs.filter((spec) => spec.shardY === 1).length,
    missingCount: missing.length,
    invalidCount: invalid.length,
    emptyFoundationCount: emptyFoundation.length,
    surfaceHoleShardCount: surfaceHoles.length,
    forbiddenMuckBlockCount: forbiddenMuckBlocks.length,
    atmosphericMuckBlockCount: atmosphericMuckBlocks.length,
    retiredTerrainCount: retiredTerrainIds.length,
    samples: {
      missing: missing.slice(0, 8),
      invalid: invalid.slice(0, 8),
      emptyFoundation: emptyFoundation.slice(0, 8),
      surfaceHoles: surfaceHoles.slice(0, 8),
      forbiddenMuckBlocks: forbiddenMuckBlocks.slice(0, 8),
      atmosphericMuckBlocks: atmosphericMuckBlocks.slice(0, 8),
      retiredTerrainIds: retiredTerrainIds.slice(0, 8),
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  const failed =
    AUDIT_MODE === "muck-only"
      ? forbiddenMuckBlocks.length || atmosphericMuckBlocks.length
      : missing.length ||
        invalid.length ||
        emptyFoundation.length ||
        surfaceHoles.length ||
        forbiddenMuckBlocks.length ||
        retiredTerrainIds.length;
  if (failed) {
    // HARTHMERE_DEPLOY_TERRAIN_GATE:
    // The deploy runs this twice. The first pass is a REPORT taken before the
    // repair has had a chance to run, so failing there just meant no deploy
    // ever reached the repair — which is exactly how the sunken pits survived
    // release after release. NON_FATAL lets that first pass describe the damage
    // and return 0; the verification pass after the repair leaves it unset and
    // is the one that can still stop a bad deploy.
    if (NON_FATAL) {
      console.log(
        "REPORT-ONLY Harthmere extension terrain audit found damage; the " +
          "repair phase runs next and the post-repair audit is authoritative."
      );
      return;
    }
    throw new Error("Harthmere extension terrain audit failed");
  }
  if (AUDIT_MODE === "muck-only") {
    console.log(
      "OK active Gaia leaves Harthmere free of Muck terrain and atmosphere."
    );
    return;
  }
  console.log(
    "OK Harthmere authored terrain is complete and valid while player and simulation overlays remain preserved."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
