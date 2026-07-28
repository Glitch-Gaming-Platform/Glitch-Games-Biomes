#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
}
function failIf(cond, msg) {
  ok(!cond, msg);
}
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

const runtime = read(
  "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx"
);
const shared = read("src/shared/harthmere/snapshot_grove_content.ts");
const events = read("src/client/events/api.ts");
const crafting = read(
  "src/client/components/inventory/crafting/GeneralCraftingStationScreen.tsx"
);

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
  ok(
    runtime.includes("SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS") &&
      shared.includes(`"${id}"`),
    `${id} is registered through the canonical Fountain/Grove tutorial registry`
  );
  const block = questBlockById(shared, id);
  ok(Boolean(block), `${id} exists in shared Grove quest content`);
  if (!block) continue;
  const objectives = extractArray(block, "objectives");
  const triggers = extractArray(block, "triggers");
  const markers = extractArray(block, "markerIds");
  ok(objectives.length >= 5, `${id} has a multi-step practice sequence`);
  ok(
    triggers.length === objectives.length,
    `${id} has one validation trigger per objective`
  );
  ok(
    markers.length === objectives.length,
    `${id} has one map marker per objective`
  );
  for (const marker of markers) {
    const staticLandmark = shared.includes(`id: "${marker}"`);
    const npcMarker =
      marker.startsWith("npc_") && shared.includes(`id: "${marker.slice(4)}"`);
    ok(
      staticLandmark || npcMarker,
      `${id} marker ${marker} exists in Grove landmark registry or generated NPC landmark list`
    );
  }
}

ok(
  runtime.includes("snapshot-grove-bible-action-validated") ||
    runtime.includes("snapshot-grove-bible-onboarding-polish") ||
    runtime.includes("snapshot-grove-bible-graduation-chain") ||
    runtime.includes("snapshot-grove-bible-tutor-highlights") ||
    runtime.includes("snapshot-grove-mission-critical") ||
    runtime.includes("snapshot-grove-mission-critical"),
  "Grove runtime marker records action-gated validation update"
);
ok(
  runtime.includes("SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS"),
  "contextual HUD/world practice trigger set exists"
);
ok(
  runtime.includes("snapshot_grove_practice_action"),
  "Grove runtime listens for contextual practice action events"
);
ok(
  events.includes('kind: "snapshot_grove_practice_action"'),
  "GardenHose event supports contextual Grove practice action"
);
ok(
  events.includes('| "craft"'),
  "GardenHose event supports craft completion events"
);
ok(
  crafting.includes('gardenHose.publish({ kind: "craft" })'),
  "crafting screen emits a real craft event when the player crafts"
);

const npcDialogueAdvanceActions =
  runtime.match(/onPerformed:\s*\(\)\s*=>\s*advanceSnapshotGroveQuest/g) ?? [];
ok(
  npcDialogueAdvanceActions.length === 1 &&
    runtime.includes("snapshotGroveObjectiveIsCompletionTurnInForTest") &&
    runtime.includes('"completion_turn_in"'),
  "only the explicit final Grove/Fountain turn-in can advance from NPC dialogue"
);
ok(
  runtime.includes(
    "World, inventory, movement, and HUD objectives still have to be"
  ) && runtime.includes("completed in their authored systems"),
  "runtime documents that non-turn-in objectives remain action-gated"
);
ok(
  /currentTriggerForQuest\(\s*quest\s*,\s*state\.activeObjectiveIndex\s*\)/.test(
    runtime
  ) &&
    /advanceSnapshotGroveQuest\([\s\S]{0,240}"arrived_at_marker"/.test(runtime),
  "near_location steps advance from player distance to the marker"
);
ok(
  runtime.includes("expectedOpenTabForObjective") &&
    runtime.includes("(event as any).tab === expectedTab"),
  "open_tab steps validate the intended HUD tab when known"
);
ok(
  runtime.includes("animate-pulse") &&
    (runtime.includes("Watch the blinking HUD item") ||
      /panel is\` : \`panels are/.test(runtime) ||
      /panel is|panels are/.test(runtime)),
  "HUD highlights/blinks the next required player control"
);
ok(
  runtime.includes("disabled={!practiceIsInRange}") &&
    (runtime.includes("Move closer to practice") ||
      /Walk to .* first/.test(runtime)),
  "contextual practice controls require the player to be near the marked location"
);

failIf(
  runtime.includes("HUD lesson:"),
  "Grove NPC dialogue does not include HUD/debug lesson copy"
);
failIf(
  runtime.includes("Current task:"),
  "Grove NPC dialogue does not include Current task debug text"
);
failIf(
  runtime.includes("Source:"),
  "Grove NPC dialogue does not expose source metadata"
);

if (failures) {
  console.error(
    `current Grove/Fountain action validation check failed: ${failures} failure(s)`
  );
  process.exit(1);
}
console.log("current Grove/Fountain action validation check passed");
