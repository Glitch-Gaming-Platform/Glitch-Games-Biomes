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
  createHarthmereServerMuckCombatEntitySnapshots,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} = require("../../src/shared/harthmere/live_mode_backend");
const {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  liveEntityRobotDefaultRobotIdForArea,
} = require("../../src/shared/harthmere/live_entity_robot_energy_protection");
const {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  validateHarthmereLiveEntityProductionSeeds,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  buildHarthmereLiveEntityProductionSeedProposedChanges,
} = require("../../src/server/harthmere/live_entity_ecs_seed");
const {
  buildHarthmereSnapshotGroveNpcSeedProposedChanges,
  harthmereSnapshotGroveNpcSeedIds,
} = require("../../src/server/harthmere/snapshot_grove_npc_ecs_seed");
const {
  buildHarthmereGroveRaceMinigameSeedProposedChanges,
} = require("../../src/server/harthmere/grove_race_minigame_ecs_seed");
const {
  runHarthmereLiveModeRobotEnergySchedulerTick,
} = require("../../src/server/harthmere/live_mode_robot_energy_scheduler");
const {
  HARTHMERE_GROVE_RACE_MINIGAME_ID,
  HARTHMERE_GROVE_RACE_MINIGAME_LABEL,
  HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS,
  HARTHMERE_GROVE_RACE_START_POSITION,
  validateHarthmereGroveRaceMinigameSeeds,
} = require("../../src/shared/harthmere/grove_race_minigame_seed");
const {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} = require("../../src/shared/harthmere/snapshot_grove_content");
const {
  muckMonsterAreaForPosition,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai");

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
  async watch(...keys) {
    this.watched = keys;
  }
  async unwatch() {
    this.watched = [];
  }
  multi() {
    const ops = [];
    return {
      set: (key, value) => {
        ops.push(() => this.set(key, value));
      },
      exec: async () => {
        for (const op of ops) op();
        return [];
      },
    };
  }
}

async function main() {
  console.log("== Harthmere live entity production smoke current ==");
  const nowMs = 1_700_700_000_000;

  check(
    validateHarthmereLiveEntityProductionSeeds().length === 0,
    "robot and Muck monster production seed manifest validates"
  );
  check(
    HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.length ===
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length,
    "every robot protection area has a sentinel seed"
  );
  check(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length ===
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT,
    "production has exactly 116 ambient Muck/Hex hostile seeds"
  );
  check(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.some(
      (seed) => seed.combatKind === "hex"
    ),
    "production hostile seed manifest includes Hexes"
  );
  const areaIdsWithHostiles = new Set(
    HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.map((seed) => seed.areaId)
  );
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
    check(
      areaIdsWithHostiles.has(area.areaId),
      `robot protection area ${area.areaId} has a server hostile seed`
    );
  }
  const serverCombat = createHarthmereServerMuckCombatEntitySnapshots(nowMs);
  const serverCombatEntries = Object.entries(serverCombat);
  // The combat snapshot now also carries retaliating wildlife (cows/sheep/
  // rabbits, entityKind "animal") alongside the Muck/Hex hostiles, so assert the
  // 116 hostiles are all present rather than that the snapshot is hostiles-only.
  const serverCombatHostileEntries = serverCombatEntries.filter(
    ([, snapshot]) =>
      snapshot.entityKind === "mux" || snapshot.entityKind === "hex"
  );
  check(
    serverCombatHostileEntries.length ===
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length,
    "live-mode server combat snapshot seeds every production Muck/Hex hostile"
  );
  check(
    serverCombatEntries.some(([, snapshot]) => snapshot.entityKind === "mux") &&
      serverCombatEntries.some(([, snapshot]) => snapshot.entityKind === "hex"),
    "live-mode server combat snapshot includes both Muckers and Hexes"
  );
  check(
    serverCombatEntries.every(([, snapshot]) =>
      muckMonsterAreaForPosition(
        [snapshot.position.x, snapshot.position.y, snapshot.position.z],
        1.5
      )
    ),
    "live-mode server combat Muckers/Hexes are only in authored Muck areas"
  );

  const proposed = buildHarthmereLiveEntityProductionSeedProposedChanges({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  check(
    proposed.length === HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.length,
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

  const groveNpcProposed = buildHarthmereSnapshotGroveNpcSeedProposedChanges({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  const seededGroveNpcs = SNAPSHOT_GROVE_NPCS.filter(
    (npc) => npc.seedServerNpc
  );
  check(
    groveNpcProposed.length === seededGroveNpcs.length,
    "production bootstrap builds every seeded Grove NPC"
  );
  const billy = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "billy");
  const billyId = billy && snapshotGroveNpcEntityId(billy);
  check(
    Boolean(
      billyId &&
        harthmereSnapshotGroveNpcSeedIds().includes(billyId) &&
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
    validateHarthmereGroveRaceMinigameSeeds().length === 0,
    "Grove race minigame seed validates"
  );
  const raceProposed = buildHarthmereGroveRaceMinigameSeedProposedChanges({
    nowSeconds: 1234,
    existingIds: new Set(),
  });
  check(
    raceProposed.length === HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS.length,
    "Grove race seeder builds minigame plus placeable elements"
  );
  const raceMinigame = raceProposed.find(
    (change) =>
      change.kind !== "delete" &&
      change.entity.id === HARTHMERE_GROVE_RACE_MINIGAME_ID
  );
  check(
    raceMinigame?.kind !== "delete" &&
      raceMinigame?.entity.label?.text ===
        HARTHMERE_GROVE_RACE_MINIGAME_LABEL &&
      raceMinigame?.entity.minigame_component?.ready === true,
    "Grove race minigame is ready and labeled"
  );
  const raceStart = raceProposed.find(
    (change) =>
      change.kind !== "delete" &&
      change.entity.position?.v?.[0] === HARTHMERE_GROVE_RACE_START_POSITION[0]
  );
  check(
    raceStart?.kind !== "delete" &&
      JSON.stringify(raceStart?.entity.position?.v) ===
        JSON.stringify(HARTHMERE_GROVE_RACE_START_POSITION),
    "Grove race start uses the requested coordinate"
  );

  const redis = { primary: new FakeRedisPrimary() };
  const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
  const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
  const sharedSource = defaultHarthmereLiveModeBackendState(
    "production-smoke-shared",
    nowMs - 3_600_000
  );
  sharedSource.robotProtection.robots[robotId].lastTickAtMs = nowMs - 3_600_000;
  redis.primary.store.set(
    harthmereLiveModeSharedWorldStateKey(),
    JSON.stringify(
      createHarthmereLiveModeSharedWorldState(sharedSource, nowMs - 3_600_000)
    )
  );
  const tick = await runHarthmereLiveModeRobotEnergySchedulerTick({
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
  const persisted = parseHarthmereLiveModeSharedWorldState(
    redis.primary.store.get(harthmereLiveModeSharedWorldStateKey()),
    nowMs
  );
  check(
    persisted?.robotProtection.robots[robotId].energy === 0,
    "shared Redis snapshot stores scheduler result"
  );

  const backend = read("src/shared/harthmere/live_mode_backend.ts");
  const scheduler = read(
    "src/server/harthmere/live_mode_robot_energy_scheduler.ts"
  );
  const ecsSeeder = read("src/server/harthmere/live_entity_ecs_seed.ts");
  const bootstrap = read("scripts/node/bootstrap_redis.ts");
  const shim = read("src/server/shim/main.ts");
  const observer = read("src/server/sync/subscription/game_observer.ts");
  const webMain = read("src/server/web/main.ts");
  const warping = read("src/client/game/util/warping.ts");
  const simpleRaceStartOverlay = read(
    "src/client/components/minigames/simple_race/SimpleRaceStartOverlayComponent.tsx"
  );
  const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");
  const renderer = read(
    "src/client/game/renderers/local_dev/harthmere_assets.ts"
  );

  check(
    backend.includes("evaluateMuckMonsterAggression") &&
      backend.includes('case "request_npc_ai_tick"') &&
      backend.includes("actorWorldPositionFromAuthority"),
    "production reducer calls Muck aggression from authoritative NPC AI"
  );
  check(
    scheduler.includes("server_scheduled_tick") &&
      webMain.includes("startHarthmereLiveModeRobotEnergyScheduler"),
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
        "buildHarthmereLiveEntityProductionSeedProposedChanges"
      ) &&
      bootstrap.includes("buildHarthmereSnapshotGroveNpcSeedProposedChanges") &&
      bootstrap.includes(
        "buildHarthmereGroveRaceMinigameSeedProposedChanges"
      ) &&
      shim.includes("buildHarthmereLiveEntityProductionSeedChanges") &&
      shim.includes("buildHarthmereGroveRaceMinigameSeedChanges"),
    "production Redis bootstrap and local shim share the live entity and Grove race ECS seeders"
  );
  check(
    observer.includes("HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_IDS") &&
      observer.includes("HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS"),
    "local sync bootstrap eagerly includes live entity and Grove race ECS seed ids"
  );
  check(
    /const\s+effectiveWander\s*=\s*options\?\.robotProtectionAreaId\s*\?\s*wander\s*:\s*speedUpHarthmereGroveNpcWander/.test(
      renderer
    ),
    "robot protection sentinels keep marker-local wander instead of town routes"
  );
  check(
    deploy.includes("test-harthmere-live-entity-production-smoke.cjs"),
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
