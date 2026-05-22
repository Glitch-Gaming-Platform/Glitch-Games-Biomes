#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const transform = read("src/shared/harthmere/coordinate_transform_v71.ts");
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");
const defaultDialog = read("src/client/components/challenges/TalkToNPCDefaultDialog.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const questRuntime = read("src/shared/harthmere/quest_runtime_v47.ts");
const localQuests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const missionSystem = read("src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx");
const landmarks = read("src/pages/api/world_map/landmarks.ts");
const v68 = read("scripts/harthmere/check-harthmere-snapshot-overlay-npc-visuals-v68.cjs");

ok(transform.includes("HARTHMERE_COORDINATE_TRANSFORM_VERSION_V71"), "shared Harthmere coordinate transform exists");
ok(transform.includes("HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_X_V71 = 512"), "default Harthmere snapshot offset is 512");
ok(transform.includes("shiftHarthmereAuthoredPositionToWorldV71"), "authored-to-world position helper exists");

ok(bridge.includes("SNAPSHOT_MISSION_BRIDGE_VERSION_V71"), "snapshot mission bridge marker exists");
ok(bridge.includes("JACKIE_ID"), "snapshot bridge targets Jackie");
ok(bridge.includes("Now, approach Jackie in the Grove"), "snapshot bridge preserves Jackie/Grove task text");
ok(bridge.includes("mapManager.addNavigationAid"), "snapshot bridge can pin map navigation aid");
ok(bridge.includes('kind: "placed"'), "snapshot bridge uses placed marker independent of official challenge state");

ok(defaultDialog.includes("useSnapshotMissionDialogV71"), "default NPC dialog imports snapshot mission bridge");
ok(defaultDialog.indexOf("if (snapshotMissionDialog)") < defaultDialog.indexOf("if (localDevHarthmereDialog)"), "snapshot mission dialog runs before local Harthmere fallback dialog");

ok(hud.includes("SnapshotMissionMapHUDV71"), "Harthmere map includes snapshot mission map panel");
ok(hud.includes("SnapshotMissionJournalPanelV71"), "Harthmere journal includes snapshot mission panel");

ok(questRuntime.includes("shiftHarthmereAuthoredPositionToWorldV71"), "quest runtime shifts authored quest waypoints to snapshot world coordinates");
ok(localQuests.includes("getHarthmereQuestTargetWorldPosV71"), "local Harthmere quest targets expose shifted world positions");
ok(localQuests.includes("getHarthmereWorldMapBoundsV71"), "local Harthmere map uses shifted world bounds");
ok(missionSystem.includes("getHarthmereQuestTargetWorldPosV71"), "mission distances use shifted quest target positions");

ok(landmarks.includes("SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_VERSION_V71"), "world map exposes snapshot mission landmark fallback marker");
ok(landmarks.includes("The Grove - Jackie"), "world map exposes Jackie/Grove landmark");
ok(landmarks.includes("Sergeant Bram Holt"), "world map exposes shifted Harthmere starter NPC landmark");

ok(v68.includes("hasV69RichSnapshotFirstPath"), "stale v68 checker accepts v69 rich snapshot NPC renderer path");

if (process.exitCode) {
  console.error("v71 snapshot mission/map bridge check failed");
  process.exit(process.exitCode);
}
console.log("v71 snapshot mission/map bridge check passed");
