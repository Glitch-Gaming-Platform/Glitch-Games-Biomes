#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
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
const bridge = read(
  "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx"
);
const canonical = read("src/shared/harthmere/snapshot_complete_port.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const world = fs.existsSync(
  path.join(root, "src/pages/api/world_map/landmarks.ts")
)
  ? read("src/pages/api/world_map/landmarks.ts")
  : "";
ok(
  bridge.includes("snapshot-road-ahead-full-chain"),
  "current full chain marker exists"
);
for (const token of [
  "road_ahead_meet_up_with_billy",
  "road_ahead_collect_muckwad",
  "road_ahead_place_blocks",
  "road_ahead_wear",
  "road_ahead_find_bag",
  "road_ahead_selfie",
  "busted_wooden_axe",
  "busted_muck_busters",
])
  ok(canonical.includes(`id: "${token}"`), `${token} is represented`);
ok(
  !bridge.includes("Current task:"),
  "NPC dialogue no longer says Current task"
);
ok(
  !bridge.includes("Meet JackieCurrent"),
  "NPC dialogue no longer concatenates debug task text"
);
ok(
  bridge.includes("shouldEventCompleteStep"),
  "mission chain has trigger matcher"
);
ok(bridge.includes('event.kind === "destroy"'), "destroy trigger is wired");
ok(
  bridge.includes('event.kind === "place_voxel"'),
  "place block trigger is wired"
);
ok(bridge.includes("hasRequiredClothing"), "wearing trigger is wired");
ok(
  bridge.includes('event.kind === "jump" && event.running'),
  "running jump trigger is wired"
);
ok(bridge.includes("photo_post_attempt"), "photo trigger is wired");
ok(
  bridge.includes("matchingItemRefs"),
  "muck buster inventory trigger is wired"
);
ok(bridge.includes("advanceSnapshotRoadAhead"), "chain advancement is wired");
ok(bridge.includes("awardHarthmereQuestXp"), "XP rewards are wired");
ok(
  bridge.includes("recordSnapshotMissionReward"),
  "visible reward log is wired"
);
ok(
  bridge.includes("arrivalRadius"),
  "location marker arrival completion is wired"
);
ok(
  hud.includes("SnapshotMissionRuntimeController"),
  "runtime controller is mounted in HUD"
);
ok(
  world.includes("Old Grove Road Post") ||
    bridge.includes("Old Grove Road Post"),
  "road marker target exists"
);
if (process.exitCode) {
  console.error("current snapshot Road Ahead full-chain check failed");
  process.exit(process.exitCode);
}
console.log("current snapshot Road Ahead full-chain check passed");
