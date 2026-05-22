#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) { if (cond) console.log(`OK ${msg}`); else { failures += 1; console.error(`FAIL ${msg}`); } }
function failIf(cond, msg) { ok(!cond, msg); }
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const world = read("src/pages/api/world_map/landmarks.ts");

ok(bridge.includes("snapshot-road-ahead-full-chain-v73"), "Road Ahead full-chain runtime is present");
ok(bridge.includes("shouldEventCompleteStepV73"), "Road Ahead validates gameplay events before advancing");
ok(bridge.includes('event.kind === "talk_npc" && event.npcId === JACKIE_ID'), "Road Ahead dialogue steps require actually talking to Jackie");
ok(bridge.includes('event.kind === "destroy" && event.terrainId && !isFloraId(event.terrainId)'), "Road Ahead break step requires a real non-flora destroy event");
ok(bridge.includes('event.kind === "place_voxel"'), "Road Ahead place step requires a real place event");
ok(bridge.includes("hasRequiredClothingV73"), "Road Ahead gear step checks worn top and bottoms");
ok(bridge.includes('event.kind === "jump" && event.running'), "Road Ahead movement step requires a running jump event");
ok(bridge.includes("photo_post_attempt") && bridge.includes("show_post_capture"), "Road Ahead photo step validates camera/photo flow events");
ok(bridge.includes("matchingItemRefs") && bridge.includes("entry?.item.unmuck"), "Road Ahead Muck Buster step checks inventory for a real muck-clearing tool");
ok(bridge.includes("arrivalRadius") && bridge.includes("distance <= (step.arrivalRadius ?? 8)"), "Road Ahead location steps complete from actual player distance");
ok(bridge.includes("pinSnapshotMissionTargetV71") && bridge.includes("mapManager.addNavigationAid"), "Road Ahead pins the active step marker");
ok(bridge.includes("autoremoveWhenNear: true"), "Road Ahead active marker disappears when the player reaches it");
ok(bridge.includes("mapManager.removeNavigationAid?.(SNAPSHOT_MISSION_NAV_AID_ID_V71)"), "Road Ahead removes the marker after completion");
ok(hud.includes("SnapshotMissionRuntimeControllerV71"), "Road Ahead runtime controller is mounted in the HUD");
ok(world.includes("Old Grove Road Post") || bridge.includes("Old Grove Road Post"), "Road Ahead first travel marker is available");

failIf(bridge.includes("Ask for a practice Muck Buster"), "Road Ahead Muck Buster step is not bypassable with Jackie dialogue");
failIf(bridge.includes("Jackie issued a practice Muck Buster"), "Road Ahead no longer logs a fake Muck Buster completion");
failIf(/dialogText:[\s\S]{0,600}\$\{stepCopy\./.test(bridge), "Road Ahead NPC dialogue does not expose step/debug copy fields");
failIf(/Current task:|Meet JackieCurrent|Compatibility bridge|dead bark|snapshot task bridge|Source:|Start:/.test(bridge), "Road Ahead dialogue copy avoids debug/meta text");

if (failures) {
  console.error(`v106 Road Ahead marker/action validation check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v106 Road Ahead marker/action validation check passed");
