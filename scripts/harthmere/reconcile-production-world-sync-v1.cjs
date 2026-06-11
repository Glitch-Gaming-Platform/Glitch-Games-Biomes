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
  buildHarthmereGroveRaceMinigameSeedProposedChangesV1,
  harthmereGroveRaceMinigameSeedIdsV1,
} = require("../../src/server/harthmere/grove_race_minigame_ecs_seed_v1");
const {
  buildHarthmereLiveEntityProductionSeedProposedChangesV1,
  harthmereLiveEntityProductionSeedIdsV1,
} = require("../../src/server/harthmere/live_entity_ecs_seed_v1");
const {
  buildHarthmereSnapshotGroveNpcSeedProposedChangesV1,
  harthmereSnapshotGroveNpcSeedIdsV1,
} = require("../../src/server/harthmere/snapshot_grove_npc_ecs_seed_v1");
const {
  buildHarthmereBusinessOwnerNpcSeedProposedChangesV1,
  harthmereBusinessOwnerNpcSeedEntityIdsV1,
} = require("../../src/server/harthmere/business_owner_npc_ecs_seed_v1");
const {
  buildHarthmereBusinessCustomerNpcSeedProposedChangesV1,
  harthmereBusinessCustomerNpcSeedEntityIdsV1,
} = require("../../src/server/harthmere/business_customer_npc_ecs_seed_v1");
const {
  buildHarthmereBusinessCraftingStationSeedProposedChangesV1,
  harthmereBusinessCraftingStationSeedEntityIdsV1,
} = require("../../src/server/harthmere/business_crafting_station_ecs_seed_v1");
const {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");
const {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  harthmereGroundedLivestockSeedsInTerritoryV1,
  harthmereMuckMonsterPositionIsInSafeZoneV1,
} = require("../../src/shared/harthmere/live_entity_production_seed_v1");
const {
  resolveHarthmereProductionMarkerPositionV1,
} = require("../../src/shared/harthmere/production_terrain_placement_map_v1");
const { Position, NpcMetadata } = require("../../src/shared/ecs/gen/components");
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
      ids: harthmereLiveEntityProductionSeedIdsV1(),
      build: buildHarthmereLiveEntityProductionSeedProposedChangesV1,
    },
    {
      label: "Grove race minigame",
      ids: harthmereGroveRaceMinigameSeedIdsV1(),
      build: buildHarthmereGroveRaceMinigameSeedProposedChangesV1,
    },
    {
      label: "Snapshot Grove NPCs",
      ids: harthmereSnapshotGroveNpcSeedIdsV1(),
      build: buildHarthmereSnapshotGroveNpcSeedProposedChangesV1,
    },
    {
      // HARTHMERE_BUSINESS_OWNER_RECONCILE_V1: without this family the 19 shop
      // owner NPCs are never materialized into production, leaving the businesses
      // empty. Adding it here is what makes new authored content reach prod on
      // deploy.
      label: "Business owner NPCs",
      ids: harthmereBusinessOwnerNpcSeedEntityIdsV1(),
      build: buildHarthmereBusinessOwnerNpcSeedProposedChangesV1,
    },
    {
      // HARTHMERE_BUSINESS_CUSTOMER_RECONCILE_V1: the 2-5 standing customer NPCs
      // inside each business (talkable patrons, not quest givers). Same as the
      // owners — without this family they never reach production.
      label: "Business customer NPCs",
      ids: harthmereBusinessCustomerNpcSeedEntityIdsV1(),
      build: buildHarthmereBusinessCustomerNpcSeedProposedChangesV1,
    },
    {
      // HARTHMERE_BUSINESS_CRAFTING_STATION_RECONCILE_V1: one in-shop crafting
      // station placeable per business. Without this family the 19 stations are
      // never materialized into production, so the shops have nothing to craft
      // at. Same pattern as the owners/customers — adding it here is what makes
      // the stations reach prod on deploy.
      label: "Business crafting stations",
      ids: harthmereBusinessCraftingStationSeedEntityIdsV1(),
      build: buildHarthmereBusinessCraftingStationSeedProposedChangesV1,
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
  const key = harthmereLiveModeSharedWorldStateKeyV1();
  const raw = await redis.primary.get(key);
  const parsed = parseHarthmereLiveModeSharedWorldStateV1(raw, nowMs);
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
    const defaults = defaultHarthmereLiveModeBackendStateV1(
      "production-world-sync",
      nowMs
    );
    await redis.primary.set(
      key,
      JSON.stringify(createHarthmereLiveModeSharedWorldStateV1(defaults, nowMs))
    );
    console.log(
      JSON.stringify({ phase: "shared_live_mode_state_repaired", key })
    );
  }

  const repaired = parseHarthmereLiveModeSharedWorldStateV1(
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

// HARTHMERE_LIVE_ENTITY_POSITION_REPAIR_V1
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
  const placedSeedPosition = (seed, source) =>
    resolveHarthmereProductionMarkerPositionV1({
      source,
      markerId: seed.seedId,
      fallback: seed.position,
    });
  const canonical = [
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1.map((seed) => ({
      id: Number(seed.entityId),
      position: seed.position,
      isMonster: false,
    })),
    ...harthmereGroundedMuckMonsterSeedsInTerritoryV1().map((seed) => ({
      id: Number(seed.entityId),
      position: placedSeedPosition(seed, "live_muck_monster"),
      isMonster: true,
    })),
    ...harthmereGroundedLivestockSeedsInTerritoryV1().map((seed) => ({
      id: Number(seed.entityId),
      position: placedSeedPosition(seed, "live_livestock"),
      isMonster: false,
    })),
  ];

  // A muck monster seed must never resolve into a safe zone. This is a build-time
  // guarantee (see the gating test), re-checked here so a bad layout fails the
  // deploy instead of silently dropping a hostile into the Grove.
  const seedsInSafeZone = canonical.filter(
    (entry) =>
      entry.isMonster && harthmereMuckMonsterPositionIsInSafeZoneV1(entry.position)
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
      !(entry.isMonster && harthmereMuckMonsterPositionIsInSafeZoneV1(entry.position))
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
      const positionDrifted = drift2d(current, entry.position) > 0.5;
      // spawn_position carries an intentional +-4m spawn-spread jitter (max ~5.7m
      // euclidean), so only treat it as drift when it is FAR from the seed (a real
      // layout move, e.g. an old Grove spawn anchor) — never the jitter.
      const spawnDrifted = drift2d(spawn, entry.position) > 8;
      if (!positionDrifted && !spawnDrifted) {
        alreadyCorrect += 1;
        continue;
      }
      if (APPLY) {
        const npc = NpcMetadata.create({
          type_id: meta?.type_id,
          spawn_position: [entry.position[0], entry.position[1], entry.position[2]],
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
    true,
    `live entity positions converged on seed (repaired=${repaired}, ok=${alreadyCorrect})`
  );
}

async function main() {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  console.log("== Harthmere production world sync reconciliation v1 ==");
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
