#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const Redis = require("ioredis");

const {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} = require("../../src/shared/harthmere/live_mode_backend");

const {
  createHarthmereBusinessOutpostRebuildMaterializationPlans,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
} = require("../../src/shared/harthmere/business_customer_simulator");

function option(name, fallback) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

async function scanKeys(redis, pattern) {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 250);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys.sort();
}

function actorIdFromPlayerStateKey(key) {
  return key.replace(/^harthmere:live_mode:current:player_state:/, "");
}

function rebuildEnvelope(actorId, nowMs) {
  return {
    requestId: `${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION}:${actorId}:${nowMs}`,
    idempotencyKey: `${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION}:${actorId}`,
    actorId,
    actionKind: "request_property_building_mutation",
    subsystem: "building",
    source: "admin_tool",
    serverReceivedAtMs: nowMs,
    serverTick: nowMs,
    actorEntityVersion: 1,
    zoneId: "harthmere_business_outposts",
    payload: { buildingAction: "rebuild_business_outposts" },
    clientClaims: {},
  };
}

async function main() {
  const host = option("--host", process.env.REDIS_HOST || "20.127.78.175");
  const port = Number(option("--port", process.env.REDIS_PORT || "6379"));
  const db = Number(option("--db", process.env.REDIS_DB || "0"));
  const apply = process.argv.includes("--apply");
  const nowMs = Date.now();
  const expectedPlanCount =
    Object.keys(HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS).length * 2;
  const rebuildPlans = createHarthmereBusinessOutpostRebuildMaterializationPlans();
  if (rebuildPlans.length !== expectedPlanCount) {
    throw new Error(`Unexpected rebuild plan count ${rebuildPlans.length}; expected ${expectedPlanCount}`);
  }

  const redis = new Redis({ host, port, db, lazyConnect: true, connectTimeout: 15_000 });
  await redis.connect();
  const playerKeys = await scanKeys(redis, "harthmere:live_mode:current:player_state:*");
  const targetKeys = playerKeys.length
    ? playerKeys
    : ["harthmere:live_mode:current:player_state:business_outpost_migration_admin"];
  const report = {
    revision: HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
    host,
    port,
    db,
    apply,
    playerStateKeysSeen: playerKeys.length,
    playerStateKeysMigrated: targetKeys.length,
    rebuildPlanCount: rebuildPlans.length,
    cleanupEditCount: rebuildPlans
      .filter((plan) => plan.requestId.includes("_backend_cleanup_before_rebuild"))
      .reduce((sum, plan) => sum + plan.edits.length, 0),
    rebuildEditCount: rebuildPlans
      .filter((plan) => !plan.requestId.includes("_backend_cleanup_before_rebuild"))
      .reduce((sum, plan) => sum + plan.edits.length, 0),
    updatedKeys: [],
    sharedWorldKey: harthmereLiveModeSharedWorldStateKey(),
  };

  let sharedSourceState;
  for (const key of targetKeys) {
    const actorId = actorIdFromPlayerStateKey(key);
    const raw = await redis.get(key);
    const startingState = raw
      ? parseHarthmereLiveModeBackendState(raw, actorId, nowMs)
      : defaultHarthmereLiveModeBackendState(actorId, nowMs);
    const reduced = reduceHarthmereLiveModeBackendState(
      startingState,
      rebuildEnvelope(actorId, nowMs),
      nowMs,
    );
    if (reduced.summary.buildingMaterializationPlans?.length !== rebuildPlans.length) {
      throw new Error(`Reducer did not queue all rebuild plans for ${actorId}`);
    }
    sharedSourceState = reduced.state;
    report.updatedKeys.push({
      key,
      actorId,
      outpostStructureCount: Object.keys(reduced.state.building.placedStructures).length,
      outpostPlanCount: Object.keys(reduced.state.building.materializationPlans).length,
      warnings: reduced.summary.warnings,
    });
    if (apply) {
      await redis.set(key, JSON.stringify(reduced.state));
    }
  }

  if (apply && sharedSourceState) {
    await redis.set(
      report.sharedWorldKey,
      JSON.stringify(createHarthmereLiveModeSharedWorldState(sharedSourceState, nowMs)),
    );
    await redis.set(
      "harthmere:live_mode:current:business_outpost_rebuild:last_migration",
      JSON.stringify({ ...report, migratedAtMs: nowMs }),
    );
  }

  console.log(JSON.stringify(report, null, 2));
  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
