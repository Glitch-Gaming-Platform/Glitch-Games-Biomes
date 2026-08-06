#!/usr/bin/env node
/*
 * MATERIALIZE_HARTHMERE_AUTHORED_WATER
 *
 * Cuts the Brell into an existing production world and fills it, without a
 * terrain reseed.
 *
 * WHY THIS EXISTS
 * -----------------------------------------------------------------------
 * Production deploys are run with `HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1`,
 * which returns early from `seed_production_harthmere_extension_terrain`. The
 * terrain seed is the ONLY writer that rewrites a whole `shard_seed`, and
 * therefore the only one that can remove ground. The sunken-surface repair that
 * does run during reconciliation is add-only by design: it fills holes, it can
 * never cut a channel.
 *
 * So with that flag set the river could never appear, no matter how many times
 * reconciliation ran — and teaching the repair to skip authored-water columns
 * (so it would stop filling the channel with soil) made it worse on its own,
 * because those columns then became permanently exempt from the one pass that
 * would otherwise have levelled them. Protection without materialization
 * leaves a hole.
 *
 * This is the other half. It runs in the reconciliation phase, which the
 * production deploy DOES execute, and it is the writer that actually puts the
 * river there.
 *
 * SAFETY
 * -----------------------------------------------------------------------
 * This pass can delete voxels, which nothing else in reconciliation does, so it
 * is boxed in hard. The plan itself
 * (`src/shared/harthmere/harthmere_authored_water_plan.ts`, covered by
 * `harthmere_authored_water_plan.test.ts`) guarantees:
 *
 *   * it only ever considers columns inside the authored water footprint;
 *   * it never touches a voxel above the ground plane, so player builds and
 *     the authored bridge decks are out of reach;
 *   * it never digs below the authored bed;
 *   * it is idempotent — a second run over a correct river plans nothing.
 *
 * And as in the surface repair, a voxel a player has edited (present in
 * `shard_diff`) is never overwritten.
 *
 * Usage:
 *   APPLY=1 node scripts/harthmere/materialize-harthmere-authored-water.cjs
 * Without APPLY=1 it reports the plan and writes nothing.
 */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { loadTerrain } = require("../../src/shared/game/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const {
  safeGetTerrainId,
  getTerrainID,
} = require("../../src/shared/asset_defs/terrain");
const { blockPos } = require("../../src/shared/game/shard");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");
const { Tensor } = require("../../src/shared/wasm/tensors");
const { ShardWater } = require("../../src/shared/ecs/gen/components");
const {
  harthmereSurfaceRepairShardSpecs,
} = require("../../src/shared/harthmere/extension_surface_repair");
const {
  harthmereShardHasAuthoredWater,
} = require("../../src/shared/harthmere/harthmere_authored_water");
const {
  harthmereAuthoredWaterColumnPlan,
  HARTHMERE_AUTHORED_WATER_PLAN_VERSION,
} = require("../../src/shared/harthmere/harthmere_authored_water_plan");

const SHARD_DIM = 32;
const READ_BATCH_SIZE = 128;
const APPLY_SHARD_BATCH_SIZE = 16;
const APPLY = process.env.APPLY === "1";

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

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

function materialPalette() {
  const dirt = getTerrainID("dirt");
  const stone = getTerrainID("stone");
  const pick = (name, fallback) => safeGetTerrainId(name) ?? fallback;
  return {
    dirt,
    sand: pick("sand", dirt),
    gravel: pick("gravel", stone),
    moss: pick("moss", dirt),
    oakLumber: pick("oak_lumber", dirt),
    stoneBrick: pick("stone_brick", stone),
    stonePolished: pick("stone_polished", stone),
  };
}

async function main() {
  const voxeloo = await loadVoxeloo();
  const redis = await connectToRedisWithLua("ecs");
  const world = new RedisWorld(redis);
  activeRedis = redis;
  activeWorld = world;
  const palette = materialPalette();

  // Only the surface shards that carry authored water. Everything else in the
  // extension is none of this pass's business.
  const specs = harthmereSurfaceRepairShardSpecs().filter((spec) => {
    const box = expectedBox(spec);
    return harthmereShardHasAuthoredWater(box.v0, box.v1);
  });

  console.error(
    JSON.stringify({
      phase: "start",
      version: HARTHMERE_AUTHORED_WATER_PLAN_VERSION,
      apply: APPLY,
      authoredWaterShards: specs.length,
    })
  );

  const stats = {
    columns: 0,
    matched: 0,
    materialized: 0,
    outside: 0,
    clearedVoxels: 0,
    placedVoxels: 0,
    waterVoxels: 0,
    missingShards: 0,
  };
  const terrainEditsByShard = new Map();
  const waterEditsByShard = new Map();

  for (let start = 0; start < specs.length; start += READ_BATCH_SIZE) {
    const batch = specs.slice(start, start + READ_BATCH_SIZE);
    const values = await redis.replica.mgetBuffer(
      batch.map((spec) => `b:${spec.id}`)
    );
    for (let index = 0; index < batch.length; index += 1) {
      const spec = batch[index];
      const entity = decodeEntity(spec.id, values[index]);
      if (!entity || !entity.hasShardSeed?.()) {
        // A missing surface shard is the terrain seed's problem, not this
        // pass's: creating one here would invent ground with no authored
        // context around it.
        stats.missingShards += 1;
        continue;
      }
      const box = expectedBox(spec);
      let terrain;
      try {
        terrain = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
      } catch {
        terrain = undefined;
      }
      if (!terrain) continue;

      let water;
      try {
        water = Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8");
        if (entity.hasShardWater?.()) {
          water.load(entity.shardWater().buffer);
        }
      } catch {
        water?.delete?.();
        water = undefined;
      }

      try {
        const probe = {
          terrainAt: (wx, wy, wz) => {
            if (
              wy < box.v0[1] ||
              wy >= box.v1[1] ||
              wx < box.v0[0] ||
              wx >= box.v1[0] ||
              wz < box.v0[2] ||
              wz >= box.v1[2]
            ) {
              return undefined;
            }
            return Number(
              terrain.get(wx - box.v0[0], wy - box.v0[1], wz - box.v0[2])
            );
          },
          isSolid: (id) => id !== 0 && terrainCollides(id),
          waterAt: (wx, wy, wz) => {
            if (!water) return 0;
            if (
              wy < box.v0[1] ||
              wy >= box.v1[1] ||
              wx < box.v0[0] ||
              wx >= box.v1[0] ||
              wz < box.v0[2] ||
              wz >= box.v1[2]
            ) {
              return 0;
            }
            return Number(
              water.get(wx - box.v0[0], wy - box.v0[1], wz - box.v0[2])
            );
          },
        };

        for (let localZ = 0; localZ < SHARD_DIM; localZ += 1) {
          for (let localX = 0; localX < SHARD_DIM; localX += 1) {
            const worldX = box.v0[0] + localX;
            const worldZ = box.v0[2] + localZ;
            const plan = harthmereAuthoredWaterColumnPlan(
              worldX,
              worldZ,
              probe
            );
            if (plan.status === "outside") {
              stats.outside += 1;
              continue;
            }
            stats.columns += 1;
            if (plan.status === "matches") {
              stats.matched += 1;
              continue;
            }
            stats.materialized += 1;
            for (const edit of plan.edits) {
              if (edit.position[1] < box.v0[1] || edit.position[1] >= box.v1[1]) {
                continue;
              }
              const value = edit.material ? palette[edit.material] : 0;
              if (edit.material && !value) {
                throw new Error(`unknown material ${edit.material}`);
              }
              const list = terrainEditsByShard.get(spec.id) ?? [];
              list.push({ position: edit.position, value: Number(value) });
              terrainEditsByShard.set(spec.id, list);
              if (edit.material) stats.placedVoxels += 1;
              else stats.clearedVoxels += 1;
            }
            for (const w of plan.water) {
              if (w.position[1] < box.v0[1] || w.position[1] >= box.v1[1]) {
                continue;
              }
              const list = waterEditsByShard.get(spec.id) ?? [];
              list.push(w);
              waterEditsByShard.set(spec.id, list);
              stats.waterVoxels += 1;
            }
          }
        }
      } finally {
        terrain?.delete?.();
        water?.delete?.();
      }
    }
  }

  console.error(JSON.stringify({ phase: "plan", ...stats }));

  if (!APPLY) {
    console.log(
      JSON.stringify({ ok: true, applied: false, ...stats }, null, 2)
    );
    return;
  }

  const ids = [
    ...new Set([...terrainEditsByShard.keys(), ...waterEditsByShard.keys()]),
  ].sort((a, b) => a - b);
  let appliedTerrain = 0;
  let appliedWater = 0;

  for (let start = 0; start < ids.length; start += APPLY_SHARD_BATCH_SIZE) {
    const batch = ids.slice(start, start + APPLY_SHARD_BATCH_SIZE);
    const editor = world.edit();
    const existing = await editor.get(batch);
    for (let index = 0; index < batch.length; index += 1) {
      const id = batch[index];
      const entity = existing[index];
      if (!entity) continue;
      const spec = specs.find((candidate) => candidate.id === id);
      const box = expectedBox(spec);

      const terrainEdits = terrainEditsByShard.get(id) ?? [];
      if (terrainEdits.length) {
        const seed = new voxeloo.VolumeBlock_U32();
        const diff = new voxeloo.SparseBlock_U32();
        try {
          loadBlockWrapper(voxeloo, seed, entity.shardSeed());
          loadBlockWrapper(voxeloo, diff, entity.shardDiff());
          for (const edit of terrainEdits) {
            const local = blockPos(...edit.position);
            // A real player edit outranks the authored river, exactly as it
            // outranks the surface repair.
            if (diff.has(...local)) continue;
            seed.set(...local, edit.value);
            appliedTerrain += 1;
          }
          entity.mutableShardSeed().buffer = saveBlockWrapper(
            voxeloo,
            seed
          ).buffer;
        } finally {
          seed.delete();
          diff.delete();
        }
      }

      const waterEdits = waterEditsByShard.get(id) ?? [];
      if (waterEdits.length) {
        const water = Tensor.make(
          voxeloo,
          [SHARD_DIM, SHARD_DIM, SHARD_DIM],
          "U8"
        );
        try {
          if (entity.hasShardWater?.()) {
            water.load(entity.shardWater().buffer);
          }
          for (const edit of waterEdits) {
            water.set(
              edit.position[0] - box.v0[0],
              edit.position[1] - box.v0[1],
              edit.position[2] - box.v0[2],
              edit.level
            );
            appliedWater += 1;
          }
          entity.setShardWater(ShardWater.create(water.saveWrapped()));
        } finally {
          water.delete?.();
        }
      }
    }
    await editor.commit();
    console.error(
      JSON.stringify({
        phase: "apply",
        batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
        batches: Math.ceil(ids.length / APPLY_SHARD_BATCH_SIZE),
        appliedTerrain,
        appliedWater,
      })
    );
  }

  console.log(
    JSON.stringify(
      { ok: true, applied: true, appliedTerrain, appliedWater, ...stats },
      null,
      2
    )
  );
}

main()
  .then(closeResources)
  .catch(async (error) => {
    console.error("MATERIALIZE_HARTHMERE_AUTHORED_WATER failed", error);
    try {
      await closeResources();
    } catch (closeError) {
      console.error("Failed to close authored-water resources", closeError);
    }
    process.exitCode = 1;
  });
