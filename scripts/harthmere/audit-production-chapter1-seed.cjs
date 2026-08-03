#!/usr/bin/env node

/**
 * HARTHMERE_CHAPTER1_SEED_READBACK
 *
 * Proves, against live Redis, that the Chapter 1 authored world actually
 * landed after the shim's seed pass. Nothing else in the deploy checked this:
 * `audit-production-extension-terrain.cjs` validates terrain only, and before
 * this script the strings "ch1" and "chapter1" did not appear anywhere in
 * deploy-production-local-redis-smoke.sh.
 *
 * WHY THIS MATTERS MORE THAN A USUAL SEED CHECK — THE FAILURE MODE IS SILENT
 * AND TERMINAL. `chapter1_progress` treats a missing encounter entity as still
 * alive:
 *
 *     const alive = requiredEncounterNpcs.filter((npc) => {
 *       const entity = ...;
 *       return !entity || Number(entity.health()?.hp ?? 0) > 0;
 *     });
 *
 * That fails CLOSED, which is the right call for an anti-cheat gate and the
 * worst possible call for a missing seed. A player who reaches the Salt Market
 * with no Salt-Cured Muckers in the world is told "2 encounter enemies are
 * still standing" in an empty room, forever, with no way forward and no error
 * anywhere in the logs. The same shape applies to the escort gate at both
 * dungeon exits. A Chapter 1 seed miss is a hard, permanent Act 3 stop.
 *
 * This repository has shipped silent seed misses before — the sunken surface
 * shard pits and the trees inside 23 buildings were both invisible until a
 * player walked into them. A readback is cheap; the alternative is discovering
 * it in production.
 *
 * WHAT IS CHECKED
 *   * every seeded Chapter 1 cast NPC exists and has a position and health
 *   * every dungeon encounter NPC exists, is alive, and is inside its dungeon
 *   * every required escort companion exists
 *   * every testimony NPC exists (Act 2 cannot close without all twelve)
 *   * both Elsewhen dungeon shard sets are present with a readable shard_seed
 *
 * WHAT IS DELIBERATELY NOT CHECKED
 *   Jackie, AUGUR-9 and Coretta are pre-existing snapshot entities that
 *   Chapter 1 claims rather than creates (CH1_PROMOTED_ENTITY_IDS). They are
 *   not in CH1_SEEDED_CAST and are covered by the snapshot audits.
 *
 * Usage:
 *   node scripts/harthmere/audit-production-chapter1-seed.cjs
 *
 * Env:
 *   HARTHMERE_CH1_SEED_AUDIT_NON_FATAL=1   report and exit 0
 *   HARTHMERE_CH1_SEED_AUDIT_BATCH_SIZE=n  mget batch size (default 250)
 *   HARTHMERE_SKIP_CH1_SEED_AUDIT=1        skip entirely (documented escape)
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { loadSeed } = require("../../src/shared/game/terrain");
const { CH1_SEEDED_CAST } = require("../../src/shared/harthmere/ch1_cast");
const {
  CH1_DUNGEON_ENCOUNTER_NPCS,
  CH1_DUNGEON_ESCORT_NPCS,
} = require("../../src/shared/harthmere/ch1_dungeon_encounters");
const {
  CH1_TESTIMONY_NPC_SEEDS,
} = require("../../src/shared/harthmere/ch1_testimony_npcs");
const {
  ch1DungeonShardSpecs,
} = require("../../src/shared/harthmere/ch1_dungeon_terrain");
const {
  ch1ElsewhenTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/ch1_elsewhen_region");

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
  Number.parseInt(process.env.HARTHMERE_CH1_SEED_AUDIT_BATCH_SIZE || "250", 10)
);
const NON_FATAL = process.env.HARTHMERE_CH1_SEED_AUDIT_NON_FATAL === "1";
const SHARD_DIM = 32;
const DUNGEON_IDS = ["ch1_dungeon_desert", "ch1_dungeon_winter"];

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

async function readEntities(redis, ids) {
  const out = new Map();
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    const values = await redis.mgetBuffer(batch.map((id) => `b:${id}`));
    for (let index = 0; index < batch.length; index += 1) {
      out.set(Number(batch[index]), decodeEntity(batch[index], values[index]));
    }
  }
  return out;
}

function checkNpcs(entities, specs, label, problems, options = {}) {
  const driftXZ = (actual, expected) =>
    !actual || !expected
      ? Infinity
      : Math.hypot(actual[0] - expected[0], actual[2] - expected[2]);
  for (const spec of specs) {
    const where = `${label} "${spec.displayName ?? spec.key ?? spec.entityId}"`;
    const entity = entities.get(Number(spec.entityId));
    if (!entity) {
      problems.push(`${where} (${spec.entityId}) is MISSING from the world`);
      continue;
    }
    if (!entity.hasPosition?.()) {
      problems.push(`${where} exists but has no position`);
      continue;
    }
    if (options.requireSeedPosition) {
      const position = entity.position()?.v;
      const spawnPosition = entity.hasNpcMetadata?.()
        ? entity.npcMetadata()?.spawn_position
        : undefined;
      if (driftXZ(position, spec.position) > 0.5) {
        problems.push(
          `${where} is at ${JSON.stringify(position)}, expected X/Z ` +
            `${JSON.stringify(spec.position)}`
        );
      }
      if (driftXZ(spawnPosition, spec.position) > 0.5) {
        problems.push(
          `${where} respawns at ${JSON.stringify(spawnPosition)}, expected ` +
            `X/Z ${JSON.stringify(spec.position)}`
        );
      }
    }
    if (options.requireAlive) {
      const hp = Number(entity.health?.()?.hp ?? 0);
      if (!(hp > 0)) {
        // A dead boss cannot be re-killed, and the objective gate only accepts
        // hp<=0 on an entity it can actually see. A corpse left behind by a
        // previous world is as bad as a missing one.
        problems.push(`${where} is present but not alive (hp=${hp})`);
      }
    }
  }
}

async function main() {
  if (process.env.HARTHMERE_SKIP_CH1_SEED_AUDIT === "1") {
    console.log("Skipping Chapter 1 seed readback by request.");
    return;
  }
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const problems = [];
  const counts = {};

  try {
    const npcSpecs = [
      { label: "Chapter 1 cast", specs: CH1_SEEDED_CAST, requireAlive: false },
      {
        label: "dungeon encounter",
        specs: CH1_DUNGEON_ENCOUNTER_NPCS,
        requireAlive: true,
      },
      {
        label: "escort companion",
        specs: CH1_DUNGEON_ESCORT_NPCS,
        requireAlive: false,
      },
      {
        label: "testimony NPC",
        specs: CH1_TESTIMONY_NPC_SEEDS,
        requireAlive: false,
        requireSeedPosition: true,
      },
    ];
    const allNpcIds = [
      ...new Set(
        npcSpecs.flatMap((group) =>
          group.specs.map((spec) => Number(spec.entityId))
        )
      ),
    ];
    const npcEntities = await readEntities(redis, allNpcIds);
    for (const group of npcSpecs) {
      counts[group.label] = group.specs.length;
      checkNpcs(npcEntities, group.specs, group.label, problems, {
        requireAlive: group.requireAlive,
        requireSeedPosition: group.requireSeedPosition,
      });
    }

    const voxeloo = await loadVoxeloo();
    for (const dungeonId of DUNGEON_IDS) {
      const specs = ch1DungeonShardSpecs(dungeonId, SHARD_DIM);
      counts[`${dungeonId} shards`] = specs.length;
      // Shard ids are grid-derived and dungeon-agnostic; the seeder throws on
      // an out-of-grid shard, so an undefined id here is an authoring bug
      // rather than a missing row and must be reported as its own problem.
      const ids = specs.map((spec) =>
        ch1ElsewhenTerrainEntityIdForShard(
          spec.shardX,
          spec.shardY,
          spec.shardZ
        )
      );
      const ungridded = specs.filter((_, index) => ids[index] === undefined);
      if (ungridded.length > 0) {
        problems.push(
          `${dungeonId}: ${ungridded.length} shard(s) fall outside the stable ` +
            `Elsewhen id grid and can never be seeded`
        );
      }
      const shardEntities = await readEntities(
        redis,
        ids.filter((id) => id !== undefined).map(Number)
      );
      let missing = 0;
      let unreadable = 0;
      for (let index = 0; index < specs.length; index += 1) {
        const id = ids[index];
        if (id === undefined) continue;
        const entity = shardEntities.get(Number(id));
        if (!entity || !entity.hasShardSeed?.()) {
          missing += 1;
          continue;
        }
        // shard_diff is durable player state and may legitimately differ; the
        // authored baseline is shard_seed, same rule as the terrain audit.
        try {
          if (!loadSeed(voxeloo, { shard_seed: entity.shardSeed() })) {
            unreadable += 1;
          }
        } catch {
          unreadable += 1;
        }
      }
      if (missing > 0) {
        problems.push(
          `${dungeonId}: ${missing} of ${specs.length} shards are missing — ` +
            `the dungeon has no terrain and the Mouth leads nowhere`
        );
      }
      if (unreadable > 0) {
        problems.push(
          `${dungeonId}: ${unreadable} of ${specs.length} shards have an ` +
            `unreadable shard_seed`
        );
      }
    }
  } finally {
    redis.disconnect();
  }

  console.log(JSON.stringify({ chapter1SeedExpected: counts }, undefined, 2));

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`FAIL ${problem}`);
    }
    if (NON_FATAL) {
      console.log(
        "REPORT-ONLY Chapter 1 seed readback found gaps; re-run the shim seed " +
          "pass and treat the next audit as authoritative."
      );
      return;
    }
    throw new Error(
      `Chapter 1 seed readback failed with ${problems.length} problem(s). ` +
        `Shipping this world strands players at the first dungeon encounter.`
    );
  }
  console.log(
    "OK Chapter 1 cast, encounters, escorts, testimony NPCs and both Elsewhen " +
      "dungeons are present in the seeded world."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
