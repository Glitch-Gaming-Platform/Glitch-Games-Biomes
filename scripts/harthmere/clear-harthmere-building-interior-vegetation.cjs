#!/usr/bin/env node
/*
 * clear-harthmere-building-interior-vegetation.cjs (indoor-forest fix, 2026-07-30)
 *
 * WHAT IT FIXES
 * -------------
 * Oak trunks, leaf blocks, wild grass and flower stipple standing INSIDE
 * Harthmere's buildings.
 *
 * A building only writes its solid voxels, so the room it encloses comes back
 * to the wilds generator as open air, and the generator does what it is built
 * to do: grows a tree in it. `harthmereWildsForestAllowed` masked the town
 * rectangle, which covers 34 of the 57 buildings — but not the Residential
 * District row houses, not the Mudden Ward tangle stairs, not Edrik Vane's
 * estate, and not one structure in the Wilds. The watermill, the Last Watch
 * Post bunkhouse, the charcoal burners' camp, the Briarfen stilt hut, the
 * Greenmere cabin, the Deep Old Wood lodge, the grave-tender's house and the
 * Thornbridge shelter were all full of forest.
 *
 * The seeder gate is fixed (src/shared/harthmere/harthmere_building_exclusion.ts
 * is now consulted by `harthmereWildsForestAllowed`), which covers any fresh
 * reseed. This script is the other half: production Redis already holds shards
 * seeded under the old rule, and nobody is going to reseed a live world.
 *
 * WHAT IT WILL AND WILL NOT TOUCH
 *   * ONLY voxels strictly inside a room — never the wall ring, never the floor
 *     slab, never a stair, never a roof.
 *   * ONLY known vegetation materials. A wall, a workbench, a bed frame, a door
 *     or a chest in the same voxel range is left exactly where it is.
 *   * ONLY shard_seed. A voxel a player has edited lives in shard_diff and
 *     outranks this pass, so somebody's potted plant survives.
 *
 * Every one of those rules lives in the shared module's
 * `harthmereInteriorClearDecision`, which is unit-tested; this script is only
 * the Redis plumbing around it.
 *
 * Idempotent: a room that is already clear plans zero edits. Safe to re-run.
 *
 * USAGE (from the in-VNet host)
 *   REDIS_HOST=10.0.0.12 node scripts/harthmere/clear-harthmere-building-interior-vegetation.cjs
 *   REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/clear-harthmere-building-interior-vegetation.cjs
 *
 * ENV
 *   APPLY=1                 arm the writes (default: dry run)
 *   APPLY_SHARD_BATCH_SIZE  shards per transaction (default 8)
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { getTerrainID } = require("../../src/shared/asset_defs/terrain");
const { blockPos } = require("../../src/shared/game/shard");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");
const {
  HARTHMERE_VEGETATION_MATERIALS,
  harthmereBuildingInteriorSpans,
  harthmereInteriorClearDecision,
  validateHarthmereBuildingExclusion,
} = require("../../src/shared/harthmere/harthmere_building_exclusion");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_SHARD_SIZE,
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");

const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const APPLY = process.env.APPLY === "1";
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "8", 10)
);
const SHARD_DIM = HARTHMERE_EXTENSION_SHARD_SIZE;

let activeRedis;
let activeWorld;

async function closeResources() {
  try {
    await activeWorld?.stop?.();
  } finally {
    activeWorld = undefined;
    activeRedis?.disconnect?.();
    activeRedis = undefined;
  }
}

/**
 * TerrainID -> material name, for the vegetation palette only.
 *
 * Built by asking the registry for each name the shared module knows about, so
 * the two lists cannot drift. A name the registry does not have is skipped
 * rather than fatal — the palette is shared with the seeder's fallbacks.
 */
function vegetationIdToName() {
  const map = new Map();
  for (const name of HARTHMERE_VEGETATION_MATERIALS) {
    let id;
    try {
      id = getTerrainID(name);
    } catch {
      continue;
    }
    if (id) {
      map.set(Number(id), name);
    }
  }
  return map;
}

/** Every shard layer a building interior can reach into. */
function interiorShardYs() {
  const spans = harthmereBuildingInteriorSpans();
  const maxRelY = spans.reduce((top, span) => Math.max(top, span.relY1), 0);
  const lo = Math.floor(
    (HARTHMERE_EXTENSION_GROUND_Y + 1) / HARTHMERE_EXTENSION_SHARD_SIZE
  );
  const hi = Math.floor(
    (HARTHMERE_EXTENSION_GROUND_Y + maxRelY) / HARTHMERE_EXTENSION_SHARD_SIZE
  );
  const ys = [];
  for (let y = lo; y <= hi; y += 1) {
    ys.push(y);
  }
  return ys;
}

/** Group every interior voxel by the shard entity that owns it. */
function planTargets() {
  const shardYs = interiorShardYs();
  const byShard = new Map();
  let columns = 0;
  for (const span of harthmereBuildingInteriorSpans()) {
    for (let authoredX = span.x0; authoredX <= span.x1; authoredX += 1) {
      for (let authoredZ = span.z0; authoredZ <= span.z1; authoredZ += 1) {
        columns += 1;
        const worldX = authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const worldZ = authoredZ + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
        for (let relY = span.relY0; relY <= span.relY1; relY += 1) {
          const worldY = HARTHMERE_EXTENSION_GROUND_Y + relY;
          const shardY = Math.floor(worldY / SHARD_DIM);
          if (!shardYs.includes(shardY)) continue;
          const id = harthmereExtensionTerrainEntityIdForShard(
            Math.floor(worldX / SHARD_DIM),
            shardY,
            Math.floor(worldZ / SHARD_DIM)
          );
          if (id === undefined) continue;
          const list = byShard.get(id) ?? [];
          list.push({
            authoredX,
            authoredZ,
            relY,
            position: [worldX, worldY, worldZ],
            building: span.building.name,
          });
          byShard.set(id, list);
        }
      }
    }
  }
  return { byShard, columns };
}

async function run() {
  const contract = validateHarthmereBuildingExclusion();
  if (!contract.ok) {
    throw new Error(
      `building exclusion contract failed:\n  ${contract.failures.join("\n  ")}`
    );
  }

  const voxeloo = await loadVoxeloo();
  const redis = await connectToRedisWithLua("ecs", {
    host: REDIS_HOST,
    port: REDIS_PORT,
  });
  const world = new RedisWorld(redis);
  activeRedis = redis;
  activeWorld = world;
  const idToName = vegetationIdToName();
  const { byShard, columns } = planTargets();

  const stats = {
    version: "harthmere-interior-vegetation-clear-v1",
    apply: APPLY,
    interiorColumns: columns,
    shardsInspected: 0,
    shardsMissing: 0,
    voxelsInspected: 0,
    cleared: 0,
    keptPlayerEdit: 0,
    byMaterial: {},
    byBuilding: {},
  };
  const samples = [];

  const entries = [...byShard.entries()].sort(([a], [b]) => a - b);
  for (let start = 0; start < entries.length; start += APPLY_SHARD_BATCH_SIZE) {
    const batch = entries.slice(start, start + APPLY_SHARD_BATCH_SIZE);
    const editor = world.edit();
    const existing = await editor.get(batch.map(([id]) => id));
    let dirty = false;

    for (let index = 0; index < batch.length; index += 1) {
      const [, targets] = batch[index];
      const entity = existing[index];
      if (!entity) {
        stats.shardsMissing += 1;
        continue;
      }
      stats.shardsInspected += 1;

      const seed = new voxeloo.VolumeBlock_U32();
      const diff = new voxeloo.SparseBlock_U32();
      try {
        loadBlockWrapper(voxeloo, seed, entity.shardSeed());
        loadBlockWrapper(voxeloo, diff, entity.shardDiff());
        let changed = false;
        for (const target of targets) {
          stats.voxelsInspected += 1;
          const local = blockPos(...target.position);
          // A player edit outranks this pass, exactly as it outranks the
          // surface repair. Somebody's potted plant is theirs.
          if (diff.has(...local)) {
            stats.keptPlayerEdit += 1;
            continue;
          }
          const value = seed.get(...local);
          if (!value) continue;
          const material = idToName.get(Number(value));
          const decision = harthmereInteriorClearDecision({
            authoredX: target.authoredX,
            authoredZ: target.authoredZ,
            relY: target.relY,
            material,
          });
          if (!decision.clear) continue;
          seed.set(...local, 0);
          changed = true;
          stats.cleared += 1;
          stats.byMaterial[decision.material] =
            (stats.byMaterial[decision.material] ?? 0) + 1;
          stats.byBuilding[target.building] =
            (stats.byBuilding[target.building] ?? 0) + 1;
          if (samples.length < 12) {
            samples.push({
              building: target.building,
              material: decision.material,
              position: target.position,
            });
          }
        }
        if (changed && APPLY) {
          entity.mutableShardSeed().buffer = saveBlockWrapper(
            voxeloo,
            seed
          ).buffer;
          dirty = true;
        }
      } finally {
        seed.delete();
        diff.delete();
      }
    }

    if (dirty) {
      await editor.commit();
    }
    console.error(
      JSON.stringify({
        phase: "clearInteriors",
        batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
        batches: Math.ceil(entries.length / APPLY_SHARD_BATCH_SIZE),
        cleared: stats.cleared,
      })
    );
  }

  console.log(JSON.stringify({ ...stats, samples }, null, 2));
  if (!APPLY) {
    console.log(
      `Dry run only. ${stats.cleared} vegetation voxels are standing inside ` +
        `Harthmere buildings. Re-run with APPLY=1 to clear them.`
    );
    return;
  }
  console.log(
    `OK cleared ${stats.cleared} vegetation voxels from ` +
      `${Object.keys(stats.byBuilding).length} buildings.`
  );
}

run()
  .then(closeResources)
  .catch(async (error) => {
    console.error(error);
    try {
      await closeResources();
    } catch (closeError) {
      console.error("Failed to close interior-clear resources", closeError);
    }
    process.exitCode = 1;
  });
