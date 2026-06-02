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
  createHarthmereServerMuckCombatEntitySnapshotsV1,
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
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  validateHarthmereLiveEntityProductionSeedsV1,
} = require("../../src/shared/harthmere/live_entity_production_seed_v1");
const {
  buildHarthmereLiveEntityProductionSeedProposedChangesV1,
} = require("../../src/server/harthmere/live_entity_ecs_seed_v1");
const {
  buildHarthmereSnapshotGroveNpcSeedProposedChangesV1,
  harthmereSnapshotGroveNpcSeedIdsV1,
} = require("../../src/server/harthmere/snapshot_grove_npc_ecs_seed_v1");
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
const {
  SNAPSHOT_GROVE_NPCS_V75,
  snapshotGroveNpcEntityIdV75,
} = require("../../src/shared/harthmere/snapshot_grove_content_v75");
const {
  muckMonsterAreaForPositionV1,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai_v1");

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
  const nowMs = 1_700_700_000_000;

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
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
    "production has exactly 100 ambient Muck/Hex hostile seeds"
  );
  check(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.some(
      (seed) => seed.combatKind === "hex"
    ),
    "production hostile seed manifest includes Hexes"
  );
  const areaIdsWithHostiles = new Set(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.map((seed) => seed.areaId)
  );
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
    check(
      areaIdsWithHostiles.has(area.areaId),
      `robot protection area ${area.areaId} has a server hostile seed`
    );
  }
  const serverCombat = createHarthmereServerMuckCombatEntitySnapshotsV1(nowMs);
  const serverCombatEntries = Object.entries(serverCombat);
  check(
    serverCombatEntries.length ===
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length,
    "live-mode server combat snapshot seeds every production Muck/Hex hostile"
  );
  check(
    serverCombatEntries.some(([, snapshot]) => snapshot.entityKind === "mux") &&
      serverCombatEntries.some(([, snapshot]) => snapshot.entityKind === "hex"),
    "live-mode server combat snapshot includes both Muckers and Hexes"
  );
  check(
    serverCombatEntries.every(([, snapshot]) =>
      muckMonsterAreaForPositionV1(
        [snapshot.position.x, snapshot.position.y, snapshot.position.z],
        1.5
      )
    ),
    "live-mode server combat Muckers/Hexes are only in authored Muck areas"
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
    proposed.some(
      (change) => change.kind !== "delete" && change.entity.robot_component
    ),
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

  const groveNpcProposed = buildHarthmereSnapshotGroveNpcSeedProposedChangesV1({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  const seededGroveNpcs = SNAPSHOT_GROVE_NPCS_V75.filter(
    (npc) => npc.seedServerNpc
  );
  check(
    groveNpcProposed.length === seededGroveNpcs.length,
    "production bootstrap builds every seeded Grove NPC"
  );
  const billy = SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === "billy");
  const billyId = billy && snapshotGroveNpcEntityIdV75(billy);
  check(
    Boolean(
      billyId &&
        harthmereSnapshotGroveNpcSeedIdsV1().includes(billyId) &&
        groveNpcProposed.some(
          (change) =>
            change.kind !== "delete" &&
            change.entity.id === billyId &&
            change.entity.label?.text === "Billy"
        )
    ),
    "production bootstrap includes Billy Rhodes Grove NPC seed"
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
      raceMinigame?.entity.label?.text ===
        HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1 &&
      raceMinigame?.entity.minigame_component?.ready === true,
    "Grove race minigame is ready and labeled"
  );
  const raceStart = raceProposed.find(
    (change) =>
      change.kind !== "delete" &&
      change.entity.position?.v?.[0] ===
        HARTHMERE_GROVE_RACE_START_POSITION_V1[0]
  );
  check(
    raceStart?.kind !== "delete" &&
      JSON.stringify(raceStart?.entity.position?.v) ===
        JSON.stringify(HARTHMERE_GROVE_RACE_START_POSITION_V1),
    "Grove race start uses the requested coordinate"
  );

  const redis = { primary: new FakeRedisPrimary() };
  const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
  const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
  const sharedSource = defaultHarthmereLiveModeBackendStateV1(
    "production-smoke-shared",
    nowMs - 3_600_000
  );
  sharedSource.robotProtection.robots[robotId].lastTickAtMs = nowMs - 3_600_000;
  redis.primary.store.set(
    harthmereLiveModeSharedWorldStateKeyV1(),
    JSON.stringify(
      createHarthmereLiveModeSharedWorldStateV1(sharedSource, nowMs - 3_600_000)
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
  const warping = read("src/client/game/util/warping.ts");
  const simpleRaceStartOverlay = read(
    "src/client/components/minigames/simple_race/SimpleRaceStartOverlayComponent.tsx"
  );
  const deploy = read(
    "scripts/glitch/deploy-production-local-redis-smoke-v1.sh"
  );
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
    ) &&
      !webMain.includes(
        '.bind("serverMods", async () => isGlitchRuntimeForWeb() ? undefined as any : registerServerMods())'
      ),
    "web production runtime registers minigame server mods for join requests"
  );
  check(
    warping.includes("StartSimpleRaceMinigameEvent") &&
      warping.includes('minigameType === "simple_race"') &&
      warping.includes("knownMinigameType") &&
      warping.includes('"/api/minigames/create_or_join"'),
    "simple race play starts through the client event channel before falling back to the web join API"
  );
  check(
    !simpleRaceStartOverlay.includes("View Leaderboard") &&
      !simpleRaceStartOverlay.includes("minigame_leaderboard"),
    "Grove race start prompt does not bind a second G-key leaderboard shortcut"
  );
  check(
    ecsSeeder.includes("RobotComponent.create") &&
      bootstrap.includes(
        "buildHarthmereLiveEntityProductionSeedProposedChangesV1"
      ) &&
      bootstrap.includes(
        "buildHarthmereSnapshotGroveNpcSeedProposedChangesV1"
      ) &&
      bootstrap.includes(
        "buildHarthmereGroveRaceMinigameSeedProposedChangesV1"
      ) &&
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
