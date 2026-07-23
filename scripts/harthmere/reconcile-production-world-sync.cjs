#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { chunk } = require("lodash");
const {
  connectToRedis,
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  buildHarthmereGroveRaceMinigameSeedProposedChanges,
  harthmereGroveRaceMinigameSeedIds,
} = require("../../src/server/harthmere/grove_race_minigame_ecs_seed");
const {
  buildHarthmereLiveEntityProductionSeedProposedChanges,
  harthmereLiveEntityProductionSeedIds,
} = require("../../src/server/harthmere/live_entity_ecs_seed");
const {
  buildHarthmereSnapshotGroveNpcSeedProposedChanges,
  harthmereSnapshotGroveNpcSeedIds,
} = require("../../src/server/harthmere/snapshot_grove_npc_ecs_seed");
const {
  buildHarthmereSnapshotCombatNpcSeedProposedChanges,
  harthmereSnapshotCombatNpcSeedIds,
} = require("../../src/server/harthmere/snapshot_combat_npc_ecs_seed");
const {
  buildHarthmereBusinessOwnerNpcSeedProposedChanges,
  harthmereBusinessOwnerNpcSeedEntityIds,
} = require("../../src/server/harthmere/business_owner_npc_ecs_seed");
const {
  buildHarthmereBusinessCustomerNpcSeedProposedChanges,
  harthmereBusinessCustomerNpcSeedEntityIds,
} = require("../../src/server/harthmere/business_customer_npc_ecs_seed");
const {
  buildHarthmereBusinessCraftingStationSeedProposedChanges,
  harthmereBusinessCraftingStationSeedEntityIds,
} = require("../../src/server/harthmere/business_crafting_station_ecs_seed");
const {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} = require("../../src/shared/harthmere/live_mode_backend");
const {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereMuckMonsterPositionIsInSafeZone,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  snapshotCombatGroundedPosition,
  snapshotHostileEntityId,
} = require("../../src/shared/harthmere/snapshot_runtime_rules");
const {
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
} = require("../../src/shared/harthmere/snapshot_grove_content");
const {
  Position,
  NpcMetadata,
} = require("../../src/shared/ecs/gen/components");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { Redis } = require("ioredis");

const APPLY = process.env.APPLY === "1";
const SEED_UPSERT_MODE = (
  process.env.HARTHMERE_WORLD_SYNC_SEED_UPSERT_MODE || "all"
).toLowerCase();
const BATCH_SIZE = Number.parseInt(
  process.env.HARTHMERE_WORLD_SYNC_ECS_BATCH_SIZE || "500",
  10
);

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
    return;
  }
  console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
  process.exitCode = 1;
}

function biomesIdSet(ids) {
  return new Set(ids.map((id) => Number(id)));
}

async function reconcileEcsSeeds(world, nowSeconds) {
  const seedFamilies = [
    {
      label: "live entities",
      ids: harthmereLiveEntityProductionSeedIds(),
      build: buildHarthmereLiveEntityProductionSeedProposedChanges,
    },
    {
      label: "Grove race minigame",
      ids: harthmereGroveRaceMinigameSeedIds(),
      build: buildHarthmereGroveRaceMinigameSeedProposedChanges,
    },
    {
      label: "Snapshot Grove NPCs",
      ids: harthmereSnapshotGroveNpcSeedIds(),
      build: buildHarthmereSnapshotGroveNpcSeedProposedChanges,
    },
    {
      // Keep this family in the deploy-time upsert list so moving a hostile out
      // of a safe zone repairs production immediately instead of only new worlds.
      label: "Snapshot combat NPCs",
      ids: harthmereSnapshotCombatNpcSeedIds(),
      build: buildHarthmereSnapshotCombatNpcSeedProposedChanges,
    },
    {
      // HARTHMERE_BUSINESS_OWNER_RECONCILE: without this family the 19 shop
      // owner NPCs are never materialized into production, leaving the businesses
      // empty. Adding it here is what makes new authored content reach prod on
      // deploy.
      label: "Business owner NPCs",
      ids: harthmereBusinessOwnerNpcSeedEntityIds(),
      build: buildHarthmereBusinessOwnerNpcSeedProposedChanges,
    },
    {
      // HARTHMERE_BUSINESS_CUSTOMER_RECONCILE: the 2-5 standing customer NPCs
      // inside each business (talkable patrons, not quest givers). Same as the
      // owners — without this family they never reach production.
      label: "Business customer NPCs",
      ids: harthmereBusinessCustomerNpcSeedEntityIds(),
      build: buildHarthmereBusinessCustomerNpcSeedProposedChanges,
    },
    {
      // HARTHMERE_BUSINESS_CRAFTING_STATION_RECONCILE: one in-shop crafting
      // station placeable per business. Without this family the 19 stations are
      // never materialized into production, so the shops have nothing to craft
      // at. Same pattern as the owners/customers — adding it here is what makes
      // the stations reach prod on deploy.
      label: "Business crafting stations",
      ids: harthmereBusinessCraftingStationSeedEntityIds(),
      build: buildHarthmereBusinessCraftingStationSeedProposedChanges,
    },
  ];
  const requiredIds = seedFamilies.flatMap((family) => family.ids);
  const presentIds = new Set(await world.has(requiredIds));
  let allChanges = [];

  for (const family of seedFamilies) {
    const expected = biomesIdSet(family.ids);
    const present = family.ids.filter((id) => presentIds.has(id));
    const missing = family.ids.filter((id) => !presentIds.has(id));
    check(
      missing.length === 0 || APPLY,
      `${family.label} ECS seeds are present or repair is enabled`,
      `expected=${expected.size} present=${present.length} missing=${missing.length}`
    );
    console.log(
      JSON.stringify({
        phase: "ecs_seed_family",
        label: family.label,
        expected: expected.size,
        present: present.length,
        missing: missing.length,
        upsertMode: SEED_UPSERT_MODE,
      })
    );

    if (!APPLY) {
      continue;
    }

    const proposed = family.build({
      nowSeconds,
      existingIds: presentIds,
    });
    if (SEED_UPSERT_MODE === "missing") {
      const missingSet = biomesIdSet(missing);
      allChanges.push(
        ...proposed.filter((change) => {
          const id = change.kind === "delete" ? change.id : change.entity?.id;
          return missingSet.has(Number(id));
        })
      );
    } else {
      allChanges.push(...proposed);
    }
  }

  if (!APPLY || allChanges.length === 0) {
    return;
  }

  let applied = 0;
  for (const batch of chunk(allChanges, Math.max(1, BATCH_SIZE))) {
    await world.apply({ changes: batch });
    applied += batch.length;
  }
  console.log(
    JSON.stringify({
      phase: "ecs_seed_reconcile",
      applied,
      upsertMode: SEED_UPSERT_MODE,
    })
  );

  const repairedPresentIds = new Set(await world.has(requiredIds));
  const stillMissing = requiredIds.filter((id) => !repairedPresentIds.has(id));
  check(
    stillMissing.length === 0,
    "required Harthmere ECS world seeds exist after reconciliation",
    stillMissing.length ? `missing=${stillMissing.join(",")}` : undefined
  );
}

async function reconcileSharedLiveModeState(nowMs) {
  const redis = await connectToRedis("firehose");
  const key = harthmereLiveModeSharedWorldStateKey();
  const raw = await redis.primary.get(key);
  const parsed = parseHarthmereLiveModeSharedWorldState(raw, nowMs);
  const hasRobotProtection = Boolean(parsed?.robotProtection);
  const hasJobsBoard = Boolean(parsed?.jobsBoard);
  const hasBuilding = Boolean(parsed?.building);

  check(
    Boolean(parsed) || APPLY,
    "shared live-mode world state exists or repair is enabled",
    `key=${key}`
  );

  if (
    (!parsed || !hasRobotProtection || !hasJobsBoard || !hasBuilding) &&
    APPLY
  ) {
    const defaults = defaultHarthmereLiveModeBackendState(
      "production-world-sync",
      nowMs
    );
    await redis.primary.set(
      key,
      JSON.stringify(createHarthmereLiveModeSharedWorldState(defaults, nowMs))
    );
    console.log(
      JSON.stringify({ phase: "shared_live_mode_state_repaired", key })
    );
  }

  const repaired = parseHarthmereLiveModeSharedWorldState(
    await redis.primary.get(key),
    nowMs
  );
  check(
    Boolean(repaired),
    "shared live-mode world state parses after reconciliation"
  );
  check(
    Boolean(repaired?.robotProtection),
    "shared live-mode robot protection state is present"
  );
  check(
    Boolean(repaired?.jobsBoard),
    "shared live-mode jobs board state is present"
  );
  check(
    Boolean(repaired?.building),
    "shared live-mode building state is present"
  );
  await redis.quit("production world sync complete");
}

// HARTHMERE_LIVE_ENTITY_POSITION_REPAIR
// The family reconcile above reliably CREATES missing entities but does NOT
// reliably UPDATE existing ones (a batched multi-change apply no-ops in-place
// position edits). So whenever the seed layout changes — muckers relocated out
// of the Grove, wildlife re-banded, etc. — entities already in the live world
// keep their stale positions, which is why this used to need a manual per-entity
// pass after every deploy. This converges production onto the seed automatically:
// for every live entity (robot / muck monster / wildlife) that is present but
// whose position or spawn_position has drifted from the seed, it force-writes
// both via the proven per-entity apply path. Idempotent (no-op when already
// correct), and it will NEVER write a muck monster into a safe zone — a hard gate
// fails the deploy if the seed ever resolves one into the Grove.
async function repairLiveEntityPositions(world) {
  const canonical = [
    ...SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map((spawn) => ({
      id: Number(
        snapshotHostileEntityId(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE, spawn)
      ),
      position: snapshotCombatGroundedPosition(spawn.authoredPosition),
      isMonster: true,
    })),
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.map((seed) => ({
      id: Number(seed.entityId),
      position: seed.position,
      isMonster: false,
    })),
    ...harthmereGroundedMuckMonsterSeedsInTerritory().map((seed) => ({
      id: Number(seed.entityId),
      // The seed has already resolved to its canonical original-map terrain
      // sample, including the local hill elevation. Do not flatten its Y value.
      position: seed.position,
      isMonster: true,
    })),
    ...harthmereGroundedLivestockSeedsInTerritory().map((seed) => ({
      id: Number(seed.entityId),
      position: seed.position,
      isMonster: false,
    })),
  ];

  // A muck monster seed must never resolve into a safe zone. This is a build-time
  // guarantee (see the gating test), re-checked here so a bad layout fails the
  // deploy instead of silently dropping a hostile into the Grove.
  const seedsInSafeZone = canonical.filter(
    (entry) =>
      entry.isMonster &&
      harthmereMuckMonsterPositionIsInSafeZone(entry.position)
  );
  check(
    seedsInSafeZone.length === 0,
    "no muck monster seed resolves into a safe zone (the Grove)",
    seedsInSafeZone.length
      ? `${seedsInSafeZone.length} monster seed(s) in a safe zone`
      : undefined
  );
  const safeCanonical = canonical.filter(
    (entry) =>
      !(
        entry.isMonster &&
        harthmereMuckMonsterPositionIsInSafeZone(entry.position)
      )
  );

  const host =
    process.env.REDIS_HOST ||
    process.env.GLITCH_REDIS_HOST ||
    process.env.LOCAL_REDIS_HOST ||
    "127.0.0.1";
  const port = Number(
    process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379"
  );
  const redis = new Redis({ host, port, lazyConnect: true });
  await redis.connect();

  const drift2d = (a, b) =>
    !a || !b ? Infinity : Math.hypot(a[0] - b[0], a[2] - b[2]);
  const drift3d = (a, b) =>
    !a || !b ? Infinity : Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let repaired = 0;
  let alreadyCorrect = 0;
  let createdByReconcile = 0;
  try {
    for (const entry of safeCanonical) {
      const raw = await redis.getBuffer(`b:${entry.id}`);
      let entity;
      if (raw) {
        try {
          [, entity] = deserializeRedisEntityState(entry.id, raw);
        } catch {
          entity = undefined;
        }
      }
      if (!entity || !entity.hasPosition?.()) {
        // Absent/tombstoned — the family reconcile (create path) owns these.
        createdByReconcile += 1;
        continue;
      }
      const current = entity.position()?.v;
      const meta = entity.hasNpcMetadata?.() ? entity.npcMetadata() : undefined;
      const spawn = meta?.spawn_position;
      const positionDrifted = drift3d(current, entry.position) > 0.5;
      // Combat creatures and wildlife must respawn at the exact grounded
      // anchor. Generic NPC jitter can cross a muck boundary or terrain seam.
      const spawnDrifted =
        drift2d(spawn, entry.position) > 0.5 ||
        Math.abs((spawn?.[1] ?? Infinity) - entry.position[1]) > 0.5;
      if (!positionDrifted && !spawnDrifted) {
        alreadyCorrect += 1;
        continue;
      }
      if (APPLY) {
        const npc = NpcMetadata.create({
          type_id: meta?.type_id,
          spawn_position: [
            entry.position[0],
            entry.position[1],
            entry.position[2],
          ],
          spawn_orientation: meta?.spawn_orientation,
          created_time: meta?.created_time,
          spawn_event_id: meta?.spawn_event_id,
          spawn_event_type_id: meta?.spawn_event_type_id,
        });
        await world.apply({
          changes: [
            {
              kind: "update",
              entity: {
                id: entry.id,
                position: Position.create({
                  v: [entry.position[0], entry.position[1], entry.position[2]],
                }),
                npc_metadata: npc,
              },
            },
          ],
        });
      }
      repaired += 1;
    }

    // POST_DEPLOY_POSITION_AUDIT:
    // Read the persisted ECS records back after repair. The old implementation
    // called check(true), so a deploy could report success while all creatures
    // were still on the original map. This makes incorrect X/Y/Z fatal.
    const unresolved = [];
    for (const entry of safeCanonical) {
      const raw = await redis.getBuffer(`b:${entry.id}`);
      let entity;
      if (raw) {
        try {
          [, entity] = deserializeRedisEntityState(entry.id, raw);
        } catch {
          entity = undefined;
        }
      }
      const current = entity?.hasPosition?.()
        ? entity.position()?.v
        : undefined;
      const meta = entity?.hasNpcMetadata?.()
        ? entity.npcMetadata()
        : undefined;
      const spawn = meta?.spawn_position;
      if (
        drift3d(current, entry.position) > 0.5 ||
        drift2d(spawn, entry.position) > 0.5 ||
        Math.abs((spawn?.[1] ?? Infinity) - entry.position[1]) > 0.5
      ) {
        unresolved.push({
          id: entry.id,
          expected: entry.position,
          current,
          spawn,
        });
      }
    }
    check(
      unresolved.length === 0,
      "live entity positions persist in their canonical world coordinate spaces",
      unresolved.length
        ? JSON.stringify({
            count: unresolved.length,
            sample: unresolved.slice(0, 5),
          })
        : undefined
    );
  } finally {
    redis.disconnect();
  }

  console.log(
    JSON.stringify({
      phase: "live_entity_position_repair",
      total: canonical.length,
      repaired,
      alreadyCorrect,
      createdByReconcile,
      apply: APPLY,
    })
  );
  check(
    repaired + alreadyCorrect + createdByReconcile === canonical.length,
    `live entity positions converged on seed (repaired=${repaired}, ok=${alreadyCorrect})`
  );
}

async function main() {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  console.log("== Harthmere production world sync reconciliation current ==");
  console.log(
    JSON.stringify({
      apply: APPLY,
      seedUpsertMode: SEED_UPSERT_MODE,
      redisHost:
        process.env.REDIS_HOST ||
        process.env.GLITCH_REDIS_HOST ||
        process.env.LOCAL_REDIS_HOST ||
        "127.0.0.1",
      redisPort:
        process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
    })
  );

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  try {
    await world.waitForHealthy();
    await reconcileEcsSeeds(world, nowSeconds);
    await repairLiveEntityPositions(world);
    await reconcileSharedLiveModeState(nowMs);
  } finally {
    await world.stop?.();
  }

  if (process.exitCode) {
    console.error("\nRESULT: FAIL");
    process.exit(process.exitCode);
  }
  console.log("\nRESULT: PASS");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
