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

const transform = read("src/shared/harthmere/coordinate_transform.ts");
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");
const defaultDialog = read("src/client/components/challenges/TalkToNPCDefaultDialog.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const questRuntime = read("src/shared/harthmere/bible_quest_live_authority.ts");
const localQuests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const missionSystem = read("src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx");
const landmarks = read("src/pages/api/world_map/landmarks.ts");
const overlayNpcVisualCheck = read("scripts/harthmere/check-harthmere-snapshot-overlay-npc-visuals.cjs");

ok(transform.includes("HARTHMERE_COORDINATE_TRANSFORM_VERSION"), "shared Harthmere coordinate transform exists");
ok(transform.includes("HARTHMERE_ADDITIVE_TOWN_OFFSET_X"), "default Harthmere snapshot offset comes from the additive extension contract");
ok(transform.includes("shiftHarthmereAuthoredPositionToWorld"), "authored-to-world position helper exists");

ok(bridge.includes("SNAPSHOT_MISSION_BRIDGE_VERSION"), "snapshot mission bridge marker exists");
ok(bridge.includes("JACKIE_ID"), "snapshot bridge targets Jackie");
ok(bridge.includes("The road is open, but it is not kind") && bridge.includes("Follow the marker. Clear what blocks the path"), "snapshot bridge uses natural Jackie Road Ahead setup copy");
ok(bridge.includes("mapManager.addNavigationAid"), "snapshot bridge can pin map navigation aid");
ok(bridge.includes('kind: "placed"'), "snapshot bridge uses placed marker independent of official challenge state");

ok(defaultDialog.includes("useSnapshotMissionDialog"), "default NPC dialog imports snapshot mission bridge");
ok(defaultDialog.indexOf("if (snapshotMissionDialog)") < defaultDialog.indexOf("if (localDevHarthmereDialog)"), "snapshot mission dialog runs before local Harthmere fallback dialog");

ok(hud.includes("SnapshotMissionMapHUD"), "Harthmere map includes snapshot mission map panel");
ok(hud.includes("SnapshotMissionJournalPanel"), "Harthmere journal includes snapshot mission panel");

ok(questRuntime.includes("shiftHarthmereAuthoredPositionToWorld"), "quest runtime shifts authored quest waypoints to snapshot world coordinates");
ok(localQuests.includes("getHarthmereQuestTargetWorldPos"), "local Harthmere quest targets expose shifted world positions");
ok(localQuests.includes("getHarthmereWorldMapBounds"), "local Harthmere map uses shifted world bounds");
ok(missionSystem.includes("getHarthmereQuestTargetWorldPos"), "mission distances use shifted quest target positions");

ok(landmarks.includes("SNAPSHOT_MISSION_WORLD_MAP_LANDMARKS_VERSION"), "world map exposes snapshot mission landmark fallback marker");
ok(landmarks.includes("The Grove - Jackie"), "world map exposes Jackie/Grove landmark");
ok(landmarks.includes("Sergeant Bram Holt"), "world map exposes shifted Harthmere starter NPC landmark");

ok(overlayNpcVisualCheck.includes("hasRichSnapshotFirstPath"), "snapshot overlay checker accepts current rich snapshot NPC renderer path");

if (process.exitCode) {
  console.error("current snapshot mission/map bridge check failed");
  process.exit(process.exitCode);
}
console.log("current snapshot mission/map bridge check passed");
