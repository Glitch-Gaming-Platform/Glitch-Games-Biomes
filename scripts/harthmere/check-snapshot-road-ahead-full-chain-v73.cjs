#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function ok(cond, msg) { if (!cond) { console.error(`FAIL ${msg}`); process.exitCode = 1; } else { console.log(`OK ${msg}`); } }
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const world = fs.existsSync(path.join(root, "src/pages/api/world_map/landmarks.ts")) ? read("src/pages/api/world_map/landmarks.ts") : "";
ok(bridge.includes("snapshot-road-ahead-full-chain-v73"), "v73 full chain marker exists");
for (const token of [
  "ROAD_AHEAD_MEET_UP_WITH_BILLY",
  "ROAD_AHEAD_COLLECT_MUCKWAD",
  "ROAD_AHEAD_PLACE_BLOCKS",
  "ROAD_AHEAD_WEAR",
  "ROAD_AHEAD_FIND_BAG",
  "ROAD_AHEAD_SELFIE",
  "BUSTED_WOODEN_AXE",
  "BUSTED_MUCK_BUSTERS",
]) ok(bridge.includes(token), `${token} is represented`);
ok(!bridge.includes("Current task:"), "NPC dialogue no longer says Current task");
ok(!bridge.includes("Meet JackieCurrent"), "NPC dialogue no longer concatenates debug task text");
ok(bridge.includes("shouldEventCompleteStepV73"), "mission chain has trigger matcher");
ok(bridge.includes('event.kind === "destroy"'), "destroy trigger is wired");
ok(bridge.includes('event.kind === "place_voxel"'), "place block trigger is wired");
ok(bridge.includes("hasRequiredClothingV73"), "wearing trigger is wired");
ok(bridge.includes('event.kind === "jump" && event.running'), "running jump trigger is wired");
ok(bridge.includes("photo_post_attempt"), "photo trigger is wired");
ok(bridge.includes("matchingItemRefs"), "muck buster inventory trigger is wired");
ok(bridge.includes("advanceSnapshotRoadAheadV73"), "chain advancement is wired");
ok(bridge.includes("awardHarthmereQuestXp"), "XP rewards are wired");
ok(bridge.includes("recordSnapshotMissionRewardV73"), "visible reward log is wired");
ok(bridge.includes("arrivalRadius"), "location marker arrival completion is wired");
ok(hud.includes("SnapshotMissionRuntimeControllerV71"), "runtime controller is mounted in HUD");
ok(world.includes("Old Grove Road Post") || bridge.includes("Old Grove Road Post"), "road marker target exists");
if (process.exitCode) {
  console.error("v73 snapshot Road Ahead full-chain check failed");
  process.exit(process.exitCode);
}
console.log("v73 snapshot Road Ahead full-chain check passed");
