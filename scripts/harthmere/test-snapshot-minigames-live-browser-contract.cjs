#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  SNAPSHOT_MINIGAME_E2E_PLAN,
} = require("../../src/shared/harthmere/snapshot_minigame_e2e_plan");

const root = path.resolve(__dirname, "../..");
const runnerPath = path.join(
  root,
  "scripts/harthmere/test-snapshot-minigames-live-browser.cjs"
);
const runner = fs.readFileSync(runnerPath, "utf8");
const minigameHandlers = fs.readFileSync(
  path.join(root, "src/server/logic/events/handlers/minigames.ts"),
  "utf8"
);
const playerStatusHandler = fs.readFileSync(
  path.join(root, "src/server/logic/events/handlers/player_status.ts"),
  "utf8"
);
const gameModalController = fs.readFileSync(
  path.join(root, "src/client/components/GameModalController.tsx"),
  "utf8"
);

assert.equal(SNAPSHOT_MINIGAME_E2E_PLAN.length, 74);
assert.equal(new Set(SNAPSHOT_MINIGAME_E2E_PLAN.map((row) => row.id)).size, 74);
assert.equal(
  SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => row.kind === "simple_race").length,
  47
);
assert.equal(
  SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => row.kind === "spleef").length,
  19
);
assert.equal(
  SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => row.kind === "deathmatch").length,
  8
);
assert.equal(
  SNAPSHOT_MINIGAME_E2E_PLAN.filter((row) => row.questBound).length,
  7
);
assert.deepEqual(
  SNAPSHOT_MINIGAME_E2E_PLAN.filter(
    (row) => row.requiredParticipants === 3
  ).map((row) => row.id),
  [5091744724459687]
);
assert(
  runner.includes(
    '.map((value) => value.trim())\n    .filter(Boolean)\n    .map((value) => Number(value))'
  ),
  "empty minigame id selection must not become numeric id 0"
);

for (const required of [
  "HARTHMERE_E2E_IMAGE_ID",
  "HARTHMERE_E2E_BUILD_ID",
  "HARTHMERE_E2E_STACK_CONTAINER",
  "HARTHMERE_E2E_REDIS_PORT",
  "HARTHMERE_E2E_CONTROL_TOKEN",
  "/app/.next/BUILD_ID",
  "isIgnoredBrowserNoise",
  'customElements.whenDefined("twitch-video")',
  "__biomesSafeSpatialMediaPlay",
  "blockedbyclient",
  "message.location().url",
  "e2e-jump.cjs",
  "RestartCount",
  "OOMKilled",
  "SNAPSHOT_MINIGAME_CATALOG_MARKER_ID",
  "StartSimpleRaceMinigameEvent",
  "ReachCheckpointSimpleRaceMinigameEvent",
  "FinishSimpleRaceMinigameEvent",
  "MinigameInstanceTickEvent",
  "UpdatePlayerHealthEvent",
  "physical leaderboard",
  "space_clipboard",
  "active_instances",
  "cleanupRetainedMinigame",
  "confirms committed create_or_join",
  "Connection dropped",
  "CreateOrJoinSpleefEvent",
  "JoinDeathmatchEvent",
  "web_logic_connection_dropped",
  "HARTHMERE_MINIGAME_E2E_FRESH_LOGIC_PORT",
  "HARTHMERE_MINIGAME_E2E_FORCE_NATIVE_JOIN",
  "registerLogicApi",
  "LogicContentionError",
  "freshLogicPublications",
  "cleanupAbandonedCatalogIcing",
  "mutableComponent.active_instance_ids.size > 0",
  "fixtureCleanups",
  "scenarioFailures",
  "const actorOffset = (rowIndex + 1) * 100",
  "finishedOnKill",
  "if (playing) {",
  "instance.minigame_instance.active_players.size > 0",
  'state.instance_state?.kind ===\n        "waiting_for_players"',
  "retiredEmptyInstances",
  "mutableComponent.active_instance_ids.delete(instanceId)",
  "HARTHMERE_MINIGAME_E2E_LEGACY_DEATHMATCH_IMAGE_WORKAROUND",
  "Health.create({ hp: 1, maxHp: 100 })",
]) {
  assert(runner.includes(required), `runner is missing ${required}`);
}

assert(
  /prepareInvolves:[\s\S]*?player:\s*q\.id\(event\.id\)\.includeIced\(\)/.test(
    minigameHandlers
  ),
  "minigame quit preparation must include disconnected/iced players"
);
assert(
  playerStatusHandler.includes(
    "legacy Bikkie weapons (for example Mega Axe)"
  ) &&
    playerStatusHandler.includes(
      'kind: itemProfile?.kind ?? "melee"'
    ),
  "migrated native combat must retain authoritative legacy minigame loadout damage"
);
assert(
  gameModalController.includes(
    '<DeathModal onClose={() => {}} key={gameModalVersion} />'
  ),
  "repeated minigame deaths must remount the stock death modal"
);

assert(
  runner.indexOf("cleanupRetainedMinigame(user)") <
    runner.indexOf("const catalog = await auditCatalog(first)"),
  "retained actor cleanup must happen before the catalog audit"
);

for (const forbidden of ["docker build", "next build", "./b build"]) {
  assert(
    !runner.includes(forbidden),
    `runner must not build independently (${forbidden})`
  );
}

console.log(
  "PASS snapshot minigame browser runner contract (74 games, 7 quest races, serialized exact-image lifecycle)"
);
