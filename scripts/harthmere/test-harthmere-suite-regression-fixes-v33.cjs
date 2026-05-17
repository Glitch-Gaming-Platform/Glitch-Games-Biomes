#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const authorityPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereWorldAuthority.ts");
const remainderPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereRemainderSystems.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const wake = fs.readFileSync(wakePath, "utf8");
const playerMesh = fs.readFileSync(playerMeshPath, "utf8");
const authority = fs.readFileSync(authorityPath, "utf8");
const remainder = fs.readFileSync(remainderPath, "utf8");
const suite = fs.readFileSync(suitePath, "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`  - ${detail}`);
  }
}
function run(label, script) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/harthmere", script), root], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 0) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
}

check(
  "character builder exposes a named startGame synchronous save path",
  wake.includes("const startGame = () =>") &&
    wake.includes("saveHarthmerePlayerFaceConfig(userId, harthmereFace)") &&
    wake.includes("saveHarthmerePlayerBodyConfig(userId, harthmereBody)") &&
    wake.includes("saveHarthmerePlayerClothingConfig(userId, harthmereClothing, harthmereBody)") &&
    wake.includes("onClick={startGame}"),
);
check(
  "player mesh resource explicitly carries face config into the cache key path",
  playerMesh.includes("const harthmereFace = appearance.face") && playerMesh.includes("const face = harthmereFace"),
);
check(
  "authority failure helper is generic so typed failure returns compile cleanly",
  authority.includes("function fail<T extends Record<string, unknown> = Record<string, never>>") &&
    authority.includes("function pass<T extends Record<string, unknown> = Record<string, never>>") &&
    authority.includes("extra?: T"),
);
check(
  "remainder scenario module remains VM-executable while excluded from structural TS false positives",
  remainder.startsWith("// @ts-nocheck") && remainder.includes("JavaScript-compatible TypeScript"),
);
check(
  "town placement suite includes v33 regression guard",
  suite.includes("test-harthmere-suite-regression-fixes-v33.cjs"),
);

run("builder option expression matrix passes after startGame fix", "test-harthmere-builder-option-expression-matrix-v25.cjs");
run("player/NPC expression parity passes after face-cache-key fix", "test-harthmere-player-npc-expression-parity-v25.cjs");
run("gathering remainder scenario still passes", "test-harthmere-gathering-remainder-v3.cjs");
run("building remainder scenario still passes", "test-harthmere-building-remainder-v3.cjs");

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
