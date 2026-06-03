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
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");

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
