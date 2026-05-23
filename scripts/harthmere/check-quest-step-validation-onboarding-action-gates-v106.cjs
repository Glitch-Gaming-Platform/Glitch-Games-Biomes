#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) { if (cond) console.log(`OK ${msg}`); else { failures += 1; console.error(`FAIL ${msg}`); } }
function failIf(cond, msg) { ok(!cond, msg); }

const validator = read("src/server/logic/events/handlers/quest_step_validation.ts");
const validatorTest = read("src/server/logic/events/handlers/test/quest_step_validation.test.ts");
const grove = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const road = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");

ok(validator.includes("validateClaimStep"), "server quest_step_validation exposes validateClaimStep");
ok(validator.includes("collectSeqPrerequisiteLeafIds"), "server quest_step_validation checks prior seq prerequisites");
ok(validator.includes('"prior_step_incomplete"'), "server quest_step_validation rejects final talk before real prerequisite steps");
ok(validator.includes('"wrong_entity_for_step"'), "server quest_step_validation rejects wrong entity claims");
ok(validatorTest.includes("REJECTS the final talk step before the approach is fired"), "quest_step_validation unit test covers dialogue-skip regression");
ok(validatorTest.includes("accepts the final talk step ONLY after the approach is fired"), "quest_step_validation unit test covers valid final dialogue after action");

failIf(/onPerformed:\s*\(\)\s*=>\s*advanceSnapshotGroveQuestV75/.test(grove), "Snapshot Grove/Fountain cannot complete active steps by NPC dialogue button");
ok(grove.includes("snapshot_grove_practice_action") && grove.includes("gardenHose.publish"), "Snapshot Grove/Fountain uses GardenHose action events for contextual practice");
ok(grove.includes("pinSnapshotGroveLandmarkV75") && (grove.includes("autoremoveWhenNear: true") || grove.includes("autoremoveWhenNear: false")), "Snapshot Grove/Fountain markers show and stay visible until the quest step controls them");
ok(grove.includes("arrived_at_marker"), "Snapshot Grove/Fountain near-location marker validation advances only on arrival");

failIf(road.includes("Ask for a practice Muck Buster"), "Snapshot Road Ahead cannot complete Muck Buster through dialogue fallback");
ok(road.includes("mapManager.removeNavigationAid?.(SNAPSHOT_MISSION_NAV_AID_ID_V71)"), "Snapshot Road Ahead clears map markers on completion");
ok(road.includes("distance <= (step.arrivalRadius ?? 8)"), "Snapshot Road Ahead marker arrival is validated by distance");

if (failures) {
  console.error(`v106 onboarding quest_step_validation gate check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v106 onboarding quest_step_validation gate check passed");
