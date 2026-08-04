#!/usr/bin/env node
/*
 * repair-harthmere-extension-surface.cjs (sunken-forest fix, 2026-07-28)
 *
 * WHAT IT FIXES
 * -------------
 * Columns in the additive Harthmere extension whose SURFACE terrain shard
 * (world Y 32..63 — the layer that owns the flat cap at Y=52, the soil under
 * it and the wilds forest on top of it) is missing or holed in the ECS. With
 * that layer gone the column's topmost solid voxel is the foundation top at
 * Y=31, so the player walks into a 32x32, 21-block-deep black pit in the middle
 * of otherwise flat forest, and the grounding passes park NPCs, town livestock
 * and wildlife on its floor.
 *
 * These pits are NOT caves. Harthmere's real underground is authored and
 * entered through authored mouths (Old Well / Underways at Y 46..51, the
 * Bellbinder switchback under the chapel, the exotic-matter caves), and the
 * lore's mine shafts are SEALED — they live behind the back wall as scenery.
 * This script protects every one of those and refuses to touch them.
 *
 * WHAT IT DOES, IN ORDER
 *   1. scan     read every canonical surface shard (currently 744); classify
 *               missing / invalid / ok
 *   2. plan     probe every extension column and compute MINIMAL, ADD-ONLY
 *               edits with the unit-tested shared helper
 *               (src/shared/harthmere/extension_surface_repair.ts)
 *   3. apply    write the repair into shard_seed (NOT shard_diff: this is
 *               authored terrain being restored, so Gaia restoration must not
 *               be able to revert it and re-open the pit, and a real player
 *               edit in shard_diff keeps priority over it). Missing shard
 *               entities are created with a correct box and a zeroed muck
 *               tensor, matching the seeder.
 *   4. reground lift every NPC / animal / bandit that is standing in a pit
 *               back onto the feet plane Y=53, pin npc_metadata.spawn_position
 *               to the same anchor, and read every repair back.
 *
 * Idempotent by construction: a column already solid at Y=52 plans zero edits,
 * an actor already at or above Y=53 is left alone. Safe to re-run and resume.
 *
 * USAGE (from the in-VNet host; see
 *        docs/harthmere/EXTENSION_SURFACE_REPAIR_RUNBOOK.md):
 *   # Dry run (default): prints the plan, writes nothing.
 *   REDIS_HOST=10.0.0.12 node scripts/harthmere/repair-harthmere-extension-surface.cjs
 *   # Apply for real:
 *   REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/repair-harthmere-extension-surface.cjs
 *   # Then re-run the audit, which must report zero of everything:
 *   node scripts/harthmere/audit-production-extension-terrain.cjs
 *
 * ENV
 *   APPLY=1                 arm the writes (default: dry run)
 *   SKIP_CREATURES=1        terrain only, leave actors where they are
 *   NO_FOREST=1             ground-only repair; do not re-dress as forest
 *   APPLY_SHARD_BATCH_SIZE  shards per transaction (default 8)
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
const {
  Box,
  NpcMetadata,
  Position,
  ShardDiff,
  ShardMuck,
  ShardSeed,
  ShardShapes,
} = require("../../src/shared/ecs/gen/components");
const {
  HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y,
  HARTHMERE_SURFACE_REPAIR_TARGET_Y,
  HARTHMERE_EXTENSION_SURFACE_REPAIR_VERSION,
  harthmereSunkenActorRegroundTarget,
  harthmereSurfaceRepairColumnEdits,
  harthmereSurfaceRepairShardSpecs,
  isHarthmereSurfaceRepairForestColumn,
  validateHarthmereSurfaceRepairContract,
} = require("../../src/shared/harthmere/extension_surface_repair");
const {
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} = require("../../src/shared/harthmere/world_extension");

const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const APPLY = process.env.APPLY === "1";
const SKIP_CREATURES = process.env.SKIP_CREATURES === "1";
const NO_FOREST = process.env.NO_FOREST === "1";
const SHARD_DIM = 32;
const READ_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.READ_BATCH_SIZE || "250", 10)
);
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "8", 10)
);
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "2500", 10);

/**
 * Material name -> TerrainID, using the SAME palette keys and the same
 * fallbacks as the shim's localDevMaterials(), so a repaired voxel is the exact
 * id the seeder would have written there.
 */
function repairMaterials() {
  const grass = getTerrainID("grass");
  const dirt = getTerrainID("dirt");
  const stone = getTerrainID("stone");
  const id = (name, fallback) => safeGetTerrainId(name) ?? fallback;
  return {
    grass,
    dirt,
    stone,
    oakLog: id("oak_log", stone),
    oakLeaf: id("oak_leaf", grass),
    birchLog: id("birch_log", id("oak_log", stone)),
    birchLeaf: id("birch_leaf", id("oak_leaf", grass)),
    rubberLog: id("rubber_log", id("oak_log", stone)),
    rubberLeaf: id("rubber_leaf", id("oak_leaf", grass)),
    moss: id("moss", grass),
    switchGrass: id("moss", grass),
    rose: id("red_wool", grass),
    dandelion: id("yellow_wool", grass),
    sunflower: id("yellow_wool", grass),
    hay: id("hay", dirt),
  };
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

// ---------------------------------------------------------------------------
// 1. Scan the surface layer
// ---------------------------------------------------------------------------

async function scanSurfaceShards(voxeloo, redis, specs) {
  const shards = new Map(); // id -> { spec, state, terrain? }
  for (let start = 0; start < specs.length; start += READ_BATCH_SIZE) {
    const batch = specs.slice(start, start + READ_BATCH_SIZE);
    const values = await redis.mgetBuffer(batch.map((spec) => `b:${spec.id}`));
    for (let index = 0; index < batch.length; index += 1) {
      const spec = batch[index];
      const entity = decodeEntity(spec.id, values[index]);
      if (!entity) {
        shards.set(spec.id, { spec, state: "missing" });
        continue;
      }
      const box = entity.hasBox?.() ? entity.box() : undefined;
      const expected = expectedBox(spec);
      if (
        !entity.hasShardSeed?.() ||
        !sameVec3(box?.v0, expected.v0) ||
        !sameVec3(box?.v1, expected.v1)
      ) {
        shards.set(spec.id, { spec, state: "invalid" });
        continue;
      }
      let terrain;
      try {
        terrain = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
      } catch {
        terrain = undefined;
      }
      shards.set(spec.id, {
        spec,
        state: terrain ? "present" : "unreadable",
        terrain,
      });
    }
    console.error(
      JSON.stringify({
        phase: "scan",
        scanned: Math.min(start + batch.length, specs.length),
        total: specs.length,
      })
    );
  }
  return shards;
}

/**
 * Topmost solid world Y inside the surface shard's own range, or undefined when
 * the shard is absent. Probing only this layer is deliberate: the repair writes
 * only into this layer, and "the foundation under it is also gone" is a
 * different finding that the terrain audit already reports.
 */
function probeColumn(shard, worldX, worldZ) {
  if (!shard || shard.state !== "present" || !shard.terrain) {
    return { surfaceY: undefined, emptyColumn: shard?.state === "missing" };
  }
  const v0 = expectedBox(shard.spec).v0;
  for (
    let worldY = HARTHMERE_SURFACE_REPAIR_TARGET_Y;
    worldY >= HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y;
    worldY -= 1
  ) {
    const local = [worldX - v0[0], worldY - v0[1], worldZ - v0[2]];
    const id = Number(shard.terrain.get(local[0], local[1], local[2]));
    if (id !== 0 && terrainCollides(id)) {
      return { surfaceY: worldY };
    }
  }
  return { surfaceY: undefined, emptyColumn: true };
}

// ---------------------------------------------------------------------------
// 2. Plan
// ---------------------------------------------------------------------------

function planRepair(shards, materials) {
  const editsByShardId = new Map();
  const stats = {
    columns: 0,
    flat: 0,
    repaired: 0,
    protectedColumns: 0,
    unknown: 0,
    tooDeep: 0,
    forestColumns: 0,
    deepestDrop: 0,
  };
  const tooDeepSamples = [];
  for (const shard of shards.values()) {
    const v0 = expectedBox(shard.spec).v0;
    for (let localZ = 0; localZ < SHARD_DIM; localZ += 1) {
      for (let localX = 0; localX < SHARD_DIM; localX += 1) {
        const worldX = v0[0] + localX;
        const worldZ = v0[2] + localZ;
        stats.columns += 1;
        const probe = probeColumn(shard, worldX, worldZ);
        const dressAsForest = NO_FOREST
          ? false
          : isHarthmereSurfaceRepairForestColumn(worldX, worldZ);
        const result = harthmereSurfaceRepairColumnEdits(
          worldX,
          worldZ,
          probe,
          {
            dressAsForest,
          }
        );
        if (result.status === "flat") {
          stats.flat += 1;
          continue;
        }
        if (result.status === "protected") {
          stats.protectedColumns += 1;
          continue;
        }
        if (result.status === "unknown" || result.status === "outside") {
          stats.unknown += 1;
          continue;
        }
        if (result.status === "tooDeep") {
          stats.tooDeep += 1;
          if (tooDeepSamples.length < 8) {
            tooDeepSamples.push({ worldX, worldZ, drop: result.drop });
          }
          continue;
        }
        stats.repaired += 1;
        if (dressAsForest) stats.forestColumns += 1;
        stats.deepestDrop = Math.max(stats.deepestDrop, result.drop ?? 0);
        for (const edit of result.edits) {
          const terrainId = materials[edit.material];
          if (!terrainId) {
            throw new Error(
              `repair material ${edit.material} is not in the repair palette`
            );
          }
          const list = editsByShardId.get(shard.spec.id) ?? [];
          list.push({ position: edit.position, value: Number(terrainId) });
          editsByShardId.set(shard.spec.id, list);
        }
      }
    }
  }
  return { editsByShardId, stats, tooDeepSamples };
}

// ---------------------------------------------------------------------------
// 3. Apply terrain
// ---------------------------------------------------------------------------

async function applyTerrain(voxeloo, world, shards, editsByShardId) {
  const entries = [...editsByShardId.entries()].sort(([a], [b]) => a - b);
  let appliedEdits = 0;
  let createdShards = 0;
  for (let start = 0; start < entries.length; start += APPLY_SHARD_BATCH_SIZE) {
    const batch = entries.slice(start, start + APPLY_SHARD_BATCH_SIZE);
    const editor = world.edit();
    const ids = batch.map(([id]) => id);
    const existing = await editor.get(ids);
    for (let index = 0; index < batch.length; index += 1) {
      const [id, edits] = batch[index];
      const shard = shards.get(id);
      const box = expectedBox(shard.spec);
      let entity = existing[index];
      if (!entity) {
        // Missing surface shard: build it the way the seeder does — correct
        // box, empty seed/diff/shapes, and an explicitly ZEROED muck tensor so
        // stale Gaia state cannot leave purple muck air over the new grass.
        const muckBuffer = (() => {
          const muck = Tensor.make(
            voxeloo,
            [SHARD_DIM, SHARD_DIM, SHARD_DIM],
            "U8"
          );
          try {
            return muck.save();
          } finally {
            muck.delete?.();
          }
        })();
        const emptySeed = (() => {
          const block = new voxeloo.VolumeBlock_U32();
          try {
            return saveBlockWrapper(voxeloo, block);
          } finally {
            block.delete();
          }
        })();
        entity = editor.create({
          id,
          box: Box.create({ v0: box.v0, v1: box.v1 }),
          shard_seed: ShardSeed.create({ buffer: emptySeed.buffer }),
          shard_diff: ShardDiff.create(),
          shard_shapes: ShardShapes.create(),
          shard_muck: ShardMuck.create({ buffer: muckBuffer }),
        });
        createdShards += 1;
      }

      const seed = new voxeloo.VolumeBlock_U32();
      const diff = new voxeloo.SparseBlock_U32();
      try {
        loadBlockWrapper(voxeloo, seed, entity.shardSeed());
        loadBlockWrapper(voxeloo, diff, entity.shardDiff());
        for (const edit of edits) {
          const local = blockPos(...edit.position);
          // A real player edit in the diff outranks the repair: restoring the
          // authored plane must not undo somebody's build.
          if (diff.has(...local)) {
            continue;
          }
          seed.set(...local, edit.value);
          appliedEdits += 1;
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
    await editor.commit();
    console.error(
      JSON.stringify({
        phase: "applyTerrain",
        batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
        batches: Math.ceil(entries.length / APPLY_SHARD_BATCH_SIZE),
        appliedEdits,
        createdShards,
      })
    );
  }
  return { appliedEdits, createdShards };
}

// ---------------------------------------------------------------------------
// 4. Creatures that fell in
// ---------------------------------------------------------------------------

/**
 * Every non-terrain ECS record with a position inside the extension whose Y is
 * below the feet plane. The shared helper decides which of those are genuine
 * casualties versus authored underground actors.
 */
async function scanSunkenActors(redis) {
  const sunken = [];
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
    if (!keys.length) continue;
    scanned += keys.length;
    const values = await redis.mgetBuffer(keys);
    for (let index = 0; index < values.length; index += 1) {
      const raw = values[index];
      if (!raw) continue;
      const id = Number(keys[index].slice(2));
      if (!Number.isFinite(id)) continue;
      const entity = decodeEntity(id, raw);
      if (!entity) continue;
      // Terrain shards carry a box + seed and are not actors.
      if (entity.hasBox?.() && entity.hasShardSeed?.()) continue;
      if (!entity.hasPosition?.()) continue;
      const position = entity.position()?.v;
      if (!position || position.length !== 3) continue;
      const result = harthmereSunkenActorRegroundTarget({ position });
      if (!result.sunken) continue;
      sunken.push({
        id,
        label:
          entity.hasLabel?.() && entity.label()?.text
            ? entity.label().text
            : undefined,
        from: [...position],
        to: result.position,
        isNpc: Boolean(entity.hasNpcMetadata?.()),
      });
    }
  } while (cursor !== "0");
  return { sunken, scanned };
}

function creatureRegroundUpdate(entity, actor) {
  const update = {
    id: actor.id,
    position: Position.create({ v: actor.to }),
  };
  if (entity.hasNpcMetadata?.()) {
    const metadata = entity.npcMetadata();
    update.npc_metadata = NpcMetadata.create({
      type_id: metadata?.type_id,
      spawn_position: actor.to,
      spawn_orientation: metadata?.spawn_orientation,
      created_time: metadata?.created_time,
      spawn_event_id: metadata?.spawn_event_id,
      spawn_event_type_id: metadata?.spawn_event_type_id,
    });
  }
  return update;
}

async function applyCreatureReground(world, sunken) {
  let regrounded = 0;
  for (let start = 0; start < sunken.length; start += APPLY_SHARD_BATCH_SIZE) {
    const batch = sunken.slice(start, start + APPLY_SHARD_BATCH_SIZE);
    const editor = world.edit();
    const entities = await editor.get(batch.map((actor) => actor.id));
    const changes = [];
    for (let index = 0; index < batch.length; index += 1) {
      const entity = entities[index];
      if (!entity) continue;
      const actor = batch[index];
      changes.push({
        kind: "update",
        entity: creatureRegroundUpdate(entity, actor),
      });
      regrounded += 1;
    }
    if (changes.length) {
      await world.apply({ changes });
    }
    console.error(
      JSON.stringify({
        phase: "regroundCreatures",
        batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
        batches: Math.ceil(sunken.length / APPLY_SHARD_BATCH_SIZE),
        regrounded,
      })
    );
  }
  return regrounded;
}

async function readBackCreatures(redis, sunken) {
  const unresolved = [];
  for (let start = 0; start < sunken.length; start += READ_BATCH_SIZE) {
    const batch = sunken.slice(start, start + READ_BATCH_SIZE);
    const values = await redis.mgetBuffer(
      batch.map((actor) => `b:${actor.id}`)
    );
    for (let index = 0; index < batch.length; index += 1) {
      const entity = decodeEntity(batch[index].id, values[index]);
      const position = entity?.hasPosition?.()
        ? entity.position()?.v
        : undefined;
      if (!position || position[1] < HARTHMERE_EXTENSION_FEET_Y) {
        unresolved.push({ id: batch[index].id, position });
      }
    }
  }
  return unresolved;
}

// ---------------------------------------------------------------------------

async function main() {
  const contract = validateHarthmereSurfaceRepairContract();
  if (!contract.ok) {
    throw new Error(
      `surface repair contract failed: ${contract.failures.join("; ")}`
    );
  }

  const voxeloo = await loadVoxeloo();
  const materials = repairMaterials();
  const specs = harthmereSurfaceRepairShardSpecs();

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();

  let shards;
  let plan;
  let sunkenScan = { sunken: [], scanned: 0 };
  try {
    shards = await scanSurfaceShards(voxeloo, redis, specs);
    plan = planRepair(shards, materials);
    if (!SKIP_CREATURES) {
      sunkenScan = await scanSunkenActors(redis);
    }
  } finally {
    // Terrain tensors are released after planning; the apply path reloads from
    // the transaction's own read so it never writes stale state.
    for (const shard of shards?.values() ?? []) {
      shard.terrain?.delete?.();
    }
  }

  const stateCounts = { missing: 0, invalid: 0, present: 0, unreadable: 0 };
  for (const shard of shards.values()) stateCounts[shard.state] += 1;

  const summary = {
    version: HARTHMERE_EXTENSION_SURFACE_REPAIR_VERSION,
    apply: APPLY,
    noForest: NO_FOREST,
    skipCreatures: SKIP_CREATURES,
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    extensionBounds: HARTHMERE_EXTENSION_WORLD_BOUNDS,
    targetY: HARTHMERE_SURFACE_REPAIR_TARGET_Y,
    surfaceShards: { expected: specs.length, ...stateCounts },
    columns: plan.stats,
    plannedEditCount: [...plan.editsByShardId.values()].reduce(
      (count, edits) => count + edits.length,
      0
    ),
    editedShardCount: plan.editsByShardId.size,
    sunkenActors: sunkenScan.sunken.length,
    samples: {
      tooDeepColumns: plan.tooDeepSamples,
      sunkenActors: sunkenScan.sunken.slice(0, 12),
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    redis.disconnect();
    console.log("Dry run only. Re-run with APPLY=1 to write the repair.");
    return;
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  let terrainResult;
  let regrounded = 0;
  let unresolved = [];
  try {
    await world.waitForHealthy();
    terrainResult = await applyTerrain(
      voxeloo,
      world,
      shards,
      plan.editsByShardId
    );
    if (!SKIP_CREATURES && sunkenScan.sunken.length) {
      regrounded = await applyCreatureReground(world, sunkenScan.sunken);
      unresolved = await readBackCreatures(redis, sunkenScan.sunken);
    }
  } finally {
    await world.stop?.();
    redis.disconnect();
  }

  console.log(
    JSON.stringify(
      { done: true, ...terrainResult, regrounded, unresolved },
      null,
      2
    )
  );
  if (unresolved.length) {
    throw new Error(
      `${unresolved.length} creatures did not persist above the feet plane`
    );
  }
  console.log(
    "NEXT: node scripts/harthmere/audit-production-extension-terrain.cjs  (must report zero missing/invalid/surfaceHoles)"
  );
  console.log(
    "NEXT: APPLY=1 node scripts/harthmere/probe-production-terrain-grounding.cjs  (re-anchors every remaining actor family)"
  );
}

module.exports = { creatureRegroundUpdate };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
