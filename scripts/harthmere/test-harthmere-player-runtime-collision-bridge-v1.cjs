#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
    if (detail) {
      if (Array.isArray(detail)) {
        for (const item of detail.slice(0, 20)) console.log(`  - ${item}`);
        if (detail.length > 20) console.log(`  - ... ${detail.length - 20} more`);
      } else {
        console.log(`  - ${detail}`);
      }
    }
  }
}

console.log("== Harthmere player runtime collision bridge tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

const player = fs.readFileSync(playerPath, "utf8");
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";

function fnBody(src, name) {
  const start = src.indexOf(`function ${name}`);
  if (start < 0) return "";
  const brace = src.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  for (let i = brace; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(brace + 1, i);
    }
  }
  return "";
}

const verticalBounds = fnBody(player, "shouldUseHarthmereLocalDevTownCollision");
const horizontalBounds = fnBody(player, "isInsideHarthmereLocalDevHorizontalBounds");
const horizontalResolver = fnBody(player, "maybeResolveLocalDevHarthmereHorizontalTownPosition");
const obstacleGetter = fnBody(player, "getHarthmereLocalDevHorizontalTownObstacles");

check(
  "runtime bridge marker exists in player.ts",
  player.includes("HARTHMERE_PLAYER_TOWN_COLLISION_RUNTIME_BRIDGE_ENABLED_V1"),
  "Expected explicit runtime bridge marker"
);

check(
  "horizontal collision bounds are not disabled by NODE_ENV production",
  horizontalBounds.length > 0 && !/process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]{0,80}return\s+false/.test(horizontalBounds),
  "The played browser build may be production-like; NODE_ENV must not disable Harthmere horizontal collision"
);

check(
  "vertical bridge bounds are not disabled by NODE_ENV production",
  verticalBounds.length > 0 && !/process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]{0,80}return\s+false/.test(verticalBounds),
  "Even if vertical bridge is opt-in, the bounds helper should not make Harthmere collision impossible in production-like runs"
);

check(
  "horizontal resolver still runs from player movement path",
  player.includes("maybeResolveLocalDevHarthmereHorizontalTownPosition(") &&
    player.includes("player.position = townSafePosition") &&
    horizontalResolver.includes("getHarthmereLocalDevHorizontalTownObstacles"),
  "Expected player movement to clamp desired position through the horizontal town collision resolver"
);

check(
  "collision enablement is based on exported obstacles, not build mode",
  obstacleGetter.includes("__harthmereNpcCollisionObstacles") &&
    !/process\.env\.NODE_ENV/.test(obstacleGetter),
  "Expected obstacle presence/window flags to control Harthmere collision, not NODE_ENV"
);

check(
  "browser stats expose runtime bridge marker and no-obstacle state",
  player.includes("runtimeBridgeVersion: HARTHMERE_PLAYER_TOWN_COLLISION_RUNTIME_BRIDGE_ENABLED_V1") &&
    player.includes("no_obstacles_exported_yet"),
  "Expected window.__harthmereHorizontalPlayerTownCollisionStats to reveal whether the bridge is active or missing exported obstacles"
);

check(
  "full suite includes player runtime collision bridge test",
  suite.includes("test-harthmere-player-runtime-collision-bridge-v1.cjs"),
  "Expected full Harthmere town suite to fail if the runtime player collision bridge is disabled again"
);

console.log("");
if (!ok) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
