#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) { if (cond) console.log(`OK ${msg}`); else { failures += 1; console.error(`FAIL ${msg}`); } }
function failIf(cond, msg) { ok(!cond, msg); }
function extractArray(block, field) {
  const re = new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\],`);
  const match = block.match(re);
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
}
function questBlockById(content, id) {
  const start = content.indexOf(`id: "${id}"`);
  if (start < 0) return undefined;
  const end = content.indexOf("\n  },", start);
  return content.slice(start, end >= 0 ? end + 5 : content.length);
}

const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const shared = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
const events = read("src/client/events/api.ts");
const crafting = read("src/client/components/inventory/crafting/GeneralCraftingStationScreen.tsx");

const tutorialIds = [
  "fountain_buttons_first",
  "painted_path_language",
  "road_ready_bag_check",
  "tools_before_treasure",
  "safe_sparring_not_pvp",
  "ready_check_at_fountain",
  "lost_found_and_mail",
  "fountain_chat_channels",
  "fountain_food_keeps_you_moving",
  "fountain_first_aid_before_road",
  "fountain_hotbar_and_dropping",
  "fountain_first_recipe_torch",
  "fountain_trade_table_promises",
];

for (const id of tutorialIds) {
  ok(runtime.includes(`"${id}"`), `${id} is registered as a Fountain/Grove tutorial lesson in runtime`);
  const block = questBlockById(shared, id);
  ok(Boolean(block), `${id} exists in shared Grove quest content`);
  if (!block) continue;
  const objectives = extractArray(block, "objectives");
  const triggers = extractArray(block, "triggers");
  const markers = extractArray(block, "markerIds");
  ok(objectives.length >= 5, `${id} has a multi-step practice sequence`);
  ok(triggers.length === objectives.length, `${id} has one validation trigger per objective`);
  ok(markers.length === objectives.length, `${id} has one map marker per objective`);
  for (const marker of markers) {
    const staticLandmark = shared.includes(`id: "${marker}"`);
    const npcMarker = marker.startsWith("npc_") && shared.includes(`id: "${marker.slice(4)}"`);
    ok(staticLandmark || npcMarker, `${id} marker ${marker} exists in Grove landmark registry or generated NPC landmark list`);
  }
}

ok(runtime.includes("snapshot-grove-bible-action-validated-v106"), "Grove runtime version records action-gated validation update");
ok(runtime.includes("SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS_V106"), "contextual HUD/world practice trigger set exists");
ok(runtime.includes("snapshot_grove_practice_action"), "Grove runtime listens for contextual practice action events");
ok(events.includes('kind: "snapshot_grove_practice_action"'), "GardenHose event supports contextual Grove practice action");
ok(events.includes('| "craft"'), "GardenHose event supports craft completion events");
ok(crafting.includes('gardenHose.publish({ kind: "craft" })'), "crafting screen emits a real craft event when the player crafts");

failIf(/onPerformed:\s*\(\)\s*=>\s*advanceSnapshotGroveQuestV75/.test(runtime), "active Grove/Fountain steps cannot advance from NPC dialogue actions");
ok(runtime.includes("Active lesson steps are intentionally not completed from NPC dialogue"), "runtime documents the no-dialogue-completion rule");
ok(runtime.includes("currentTriggerForQuestV92(quest, state.activeObjectiveIndex)") && runtime.includes("arrived_at_marker"), "near_location steps advance from player distance to the marker");
ok(runtime.includes("expectedOpenTabForObjectiveV106") && runtime.includes('(event as any).tab === expectedTab'), "open_tab steps validate the intended HUD tab when known");
ok(runtime.includes("animate-pulse") && runtime.includes("Watch the blinking HUD item"), "HUD highlights/blinks the next required player control");
ok(runtime.includes("disabled={!practiceIsInRange}") && runtime.includes("Move closer to practice"), "contextual practice controls require the player to be near the marked location");

failIf(runtime.includes("HUD lesson:"), "Grove NPC dialogue does not include HUD/debug lesson copy");
failIf(runtime.includes("Current task:"), "Grove NPC dialogue does not include Current task debug text");
failIf(runtime.includes("Source:"), "Grove NPC dialogue does not expose source metadata");

if (failures) {
  console.error(`v106 Grove/Fountain action validation check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v106 Grove/Fountain action validation check passed");
