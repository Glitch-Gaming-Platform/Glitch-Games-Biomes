#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

const {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} = require("../../src/shared/harthmere/live_mode_backend_v1");
const {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  liveEntityRobotDefaultRobotIdForAreaV1,
} = require("../../src/shared/harthmere/live_entity_robot_energy_protection_v1");
const {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  validateHarthmereLiveEntityProductionSeedsV1,
} = require("../../src/shared/harthmere/live_entity_production_seed_v1");
const {
  buildHarthmereLiveEntityProductionSeedProposedChangesV1,
} = require("../../src/server/harthmere/live_entity_ecs_seed_v1");
const {
  buildHarthmereGroveRaceMinigameSeedProposedChangesV1,
} = require("../../src/server/harthmere/grove_race_minigame_ecs_seed_v1");
const {
  runHarthmereLiveModeRobotEnergySchedulerTickV1,
} = require("../../src/server/harthmere/live_mode_robot_energy_scheduler_v1");
const {
  HARTHMERE_GROVE_RACE_MINIGAME_ID_V1,
  HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1,
  HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1,
  HARTHMERE_GROVE_RACE_START_POSITION_V1,
  validateHarthmereGroveRaceMinigameSeedsV1,
} = require("../../src/shared/harthmere/grove_race_minigame_seed_v1");

class FakeRedisPrimary {
  constructor() {
    this.store = new Map();
    this.writes = [];
  }
  async get(key) {
    return this.store.get(key) ?? null;
  }
  async set(key, value) {
    this.writes.push({ key, value });
    this.store.set(key, value);
    return "OK";
  }
}

async function main() {
  console.log("== Harthmere live entity production smoke v1 ==");

  check(
    validateHarthmereLiveEntityProductionSeedsV1().length === 0,
    "robot and Muck monster production seed manifest validates"
  );
  check(
    HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1.length ===
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length,
    "every robot protection area has a sentinel seed"
  );
  check(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length ===
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length,
    "every robot protection area has an ambient Muck monster seed"
  );

  const proposed = buildHarthmereLiveEntityProductionSeedProposedChangesV1({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  check(
    proposed.length === HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1.length,
    "snapshot/ECS seeder builds all live entity proposals"
  );
  check(
    proposed.some((change) => change.kind !== "delete" && change.entity.robot_component),
    "snapshot/ECS seeder creates robot ECS components"
  );
  check(
    proposed.every(
      (change) =>
        change.kind === "delete" ||
        !/debug|developer|server|local-dev|snakecase|camelcase|_/.test(
          `${change.entity.label?.text ?? ""} ${
            change.entity.entity_description?.text ?? ""
          } ${change.entity.default_dialog?.text ?? ""}`.toLowerCase()
        )
    ),
    "seeded entity player-facing text has no internal casing or developer copy"
  );

  check(
    validateHarthmereGroveRaceMinigameSeedsV1().length === 0,
    "Grove race minigame seed validates"
  );
  const raceProposed = buildHarthmereGroveRaceMinigameSeedProposedChangesV1({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  check(
    raceProposed.length === HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1.length,
    "Grove race seeder builds minigame plus placeable elements"
  );
  const raceMinigame = raceProposed.find(
    (change) =>
      change.kind !== "delete" &&
      change.entity.id === HARTHMERE_GROVE_RACE_MINIGAME_ID_V1
  );
  check(
    raceMinigame?.kind !== "delete" &&
      raceMinigame?.entity.label?.text === HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1 &&
      raceMinigame?.entity.minigame_component?.ready === true,
    "Grove race minigame is ready and labeled"
  );
  const raceStart = raceProposed.find(
    (change) =>
      change.kind !== "delete" &&
      change.entity.position?.v?.[0] === HARTHMERE_GROVE_RACE_START_POSITION_V1[0]
  );
  check(
    raceStart?.kind !== "delete" &&
      JSON.stringify(raceStart?.entity.position?.v) ===
        JSON.stringify(HARTHMERE_GROVE_RACE_START_POSITION_V1),
    "Grove race start uses the requested coordinate"
  );

  const redis = { primary: new FakeRedisPrimary() };
  const nowMs = 1_700_700_000_000;
  const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
  const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
  const sharedSource = defaultHarthmereLiveModeBackendStateV1(
    "production-smoke-shared",
    nowMs - 3_600_000
  );
  sharedSource.robotProtection.robots[robotId].lastTickAtMs =
    nowMs - 3_600_000;
  redis.primary.store.set(
    harthmereLiveModeSharedWorldStateKeyV1(),
    JSON.stringify(
      createHarthmereLiveModeSharedWorldStateV1(
        sharedSource,
        nowMs - 3_600_000
      )
    )
  );
  const tick = await runHarthmereLiveModeRobotEnergySchedulerTickV1({
    redis,
    nowMs,
    drainPerHour: 100,
  });
  check(
    tick.robotProtection.robots[robotId].energy === 0,
    "server scheduler drains shared robot energy"
  );
  check(
    tick.robotProtection.areas[area.areaId].safeFromMuck === false,
    "server scheduler persists Muck state when robot energy depletes"
  );
  const persisted = parseHarthmereLiveModeSharedWorldStateV1(
    redis.primary.store.get(harthmereLiveModeSharedWorldStateKeyV1()),
    nowMs
  );
  check(
    persisted?.robotProtection.robots[robotId].energy === 0,
    "shared Redis snapshot stores scheduler result"
  );

  const backend = read("src/shared/harthmere/live_mode_backend_v1.ts");
  const scheduler = read(
    "src/server/harthmere/live_mode_robot_energy_scheduler_v1.ts"
  );
  const ecsSeeder = read("src/server/harthmere/live_entity_ecs_seed_v1.ts");
  const bootstrap = read("scripts/node/bootstrap_redis.ts");
  const shim = read("src/server/shim/main.ts");
  const observer = read("src/server/sync/subscription/game_observer.ts");
  const webMain = read("src/server/web/main.ts");
  const deploy = read("scripts/glitch/deploy-production-local-redis-smoke-v1.sh");
  const renderer = read(
    "src/client/game/renderers/local_dev/harthmere_assets.ts"
  );

  check(
    backend.includes("evaluateMuckMonsterAggressionV1") &&
      backend.includes('case "request_npc_ai_tick"') &&
      backend.includes("actorWorldPositionFromAuthorityV1"),
    "production reducer calls Muck aggression from authoritative NPC AI"
  );
  check(
    scheduler.includes("server_scheduled_tick") &&
      webMain.includes("startHarthmereLiveModeRobotEnergySchedulerV1"),
    "web production runtime starts robot energy scheduler"
  );
  check(
    webMain.includes(
      '.bind("serverMods", traceWebRegistryBind("serverMods", registerServerMods))'
    ) && !webMain.includes(
      '.bind("serverMods", async () => isGlitchRuntimeForWeb() ? undefined as any : registerServerMods())'
    ),
    "web production runtime registers minigame server mods for join requests"
  );
  check(
    ecsSeeder.includes("RobotComponent.create") &&
      bootstrap.includes("buildHarthmereLiveEntityProductionSeedProposedChangesV1") &&
      bootstrap.includes("buildHarthmereGroveRaceMinigameSeedProposedChangesV1") &&
      shim.includes("buildHarthmereLiveEntityProductionSeedChangesV1") &&
      shim.includes("buildHarthmereGroveRaceMinigameSeedChangesV1"),
    "production Redis bootstrap and local shim share the live entity and Grove race ECS seeders"
  );
  check(
    observer.includes("HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_IDS_V1") &&
      observer.includes("HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1"),
    "local sync bootstrap eagerly includes live entity and Grove race ECS seed ids"
  );
  check(
    /const\s+effectiveWander\s*=\s*options\?\.robotProtectionAreaId\s*\?\s*wander\s*:\s*speedUpHarthmereGroveNpcWanderV153/.test(
      renderer
    ),
    "robot protection sentinels keep marker-local wander instead of town routes"
  );
  check(
    deploy.includes("test-harthmere-live-entity-production-smoke-v1.cjs"),
    "Docker/Redis production smoke runs live entity production guard"
  );

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
