#!/usr/bin/env node
"use strict";

// Static release guard for the production-shaped browser suite. The live E2E
// still supplies the behavioral proof; this fast check prevents a future edit
// from silently reducing it back to one arbitrary jobs-board posting.
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const bridge = read("src/client/game/e2e/harthmere_native_ecs_e2e.ts");
const runner = read(
  "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
);
const releaseGate = read("scripts/harthmere/run-harthmere-native-ecs-e2e.sh");

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

check(
  bridge.includes("jobsBoardFrontendRoundTrip") &&
    bridge.includes("createHarthmereJobsBoardAdapter") &&
    bridge.includes("jobsBoardTrackableQuestsForBiomesUI") &&
    bridge.includes("jobsBoardAcceptedJobLandmarksForBiomesUI"),
  "browser bridge uses the real frontend adapter and frontend quest/marker projections"
);
check(
  runner.includes("HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES") &&
    runner.includes("installAllJobsBoardE2EFixtures") &&
    runner.includes("for (const expected of fixture.fixtures)"),
  "browser runner enumerates every executable production job template"
);
check(
  runner.includes('operation: "accept"') &&
    runner.includes('operation: "abandon"') &&
    runner.includes("authoritativeEntity(") &&
    runner.includes("native ECS board position"),
  "every job crosses frontend accept/abandon and authoritative native ECS position readback"
);
check(
  runner.includes("frontend quest projection missing") &&
    runner.includes("frontend map marker missing") &&
    runner.includes("accepted frontend job identity changed"),
  "every job returns to the frontend with exact identity, quest, and marker assertions"
);
check(
  releaseGate.includes("jobsBoardQuestMapAdapter.test.ts") &&
    releaseGate.includes("jobsBoardLiveAdapter.test.ts") &&
    releaseGate.includes("test-harthmere-native-ecs-all-jobs-e2e-contract.cjs"),
  "native ECS release gate includes all-jobs frontend contracts"
);

if (failures) {
  console.error(
    `\n${failures} all-jobs native ECS E2E contract check(s) failed.`
  );
  process.exit(1);
}
console.log("\nAll-jobs native ECS E2E contract checks passed.");
