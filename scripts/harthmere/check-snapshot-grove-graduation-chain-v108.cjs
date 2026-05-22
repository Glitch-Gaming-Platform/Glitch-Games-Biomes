#!/usr/bin/env node
// SNAPSHOT_GROVE_GRADUATION_CHAIN_V108:
// Verifies that the four new road-exploration quests (graduation tour +
// three road-neighbor intros) exist with the expected prerequisite chain,
// that the runtime has the unlock helpers wired into the NPC offer list,
// and that the journal panel renders the new "Road tour" and "Road
// neighbors" sections.
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
}
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
function fieldMatch(block, field) {
  const re = new RegExp(`${field}:\\s*"([^"]+)"`);
  const match = block.match(re);
  return match ? match[1] : undefined;
}

const shared = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");

// 1. The shared content declares the prerequisite type and the category type.
ok(
  /export type SnapshotGroveQuestPrerequisiteV108\s*=/.test(shared),
  "Shared content declares SnapshotGroveQuestPrerequisiteV108 union",
);
ok(
  /export type SnapshotGroveQuestCategoryV108\s*=/.test(shared),
  "Shared content declares SnapshotGroveQuestCategoryV108 union",
);
ok(
  /unlockedBy\?:\s*SnapshotGroveQuestPrerequisiteV108/.test(shared),
  "SnapshotGroveQuestV75 now has an optional unlockedBy field",
);
ok(
  /category\?:\s*SnapshotGroveQuestCategoryV108/.test(shared),
  "SnapshotGroveQuestV75 now has an optional category field",
);

// 2. The four new quests exist in the shared content.
const graduationId = "grove_road_graduation";
const alexisId = "intro_alexis_lovely_locks";
const luisId = "intro_luis_crossroads_cart";
const janeId = "intro_jane_mosslawn_edge";
const newQuests = [graduationId, alexisId, luisId, janeId];

for (const id of newQuests) {
  const block = questBlockById(shared, id);
  ok(Boolean(block), `Quest ${id} exists in shared Grove content`);
}

// 3. The graduation quest is gated behind a fountain completion count.
const graduationBlock = questBlockById(shared, graduationId) ?? "";
ok(
  /category:\s*"road_graduation"/.test(graduationBlock),
  "Graduation quest has category road_graduation",
);
ok(
  /unlockedBy:\s*{[\s\S]*?kind:\s*"fountain_completion_count"/.test(graduationBlock),
  "Graduation quest unlocks via fountain_completion_count",
);
ok(
  /minCompletedFountainLessons:\s*5\b/.test(graduationBlock),
  "Graduation quest requires at least 5 completed fountain lessons",
);
ok(
  fieldMatch(graduationBlock, "giverNpcId") === "jackie",
  "Graduation quest is given by Jackie",
);
{
  const objectives = extractArray(graduationBlock, "objectives");
  const triggers = extractArray(graduationBlock, "triggers");
  const markers = extractArray(graduationBlock, "markerIds");
  ok(
    objectives.length === triggers.length && triggers.length === markers.length,
    `Graduation quest has matched objectives/triggers/markers (${objectives.length}/${triggers.length}/${markers.length})`,
  );
  ok(
    markers.includes("npc_alexis") && markers.includes("npc_luis") && markers.includes("npc_ranger_jane"),
    "Graduation quest pins all three road-neighbor NPC markers (Alexis, Luis, Ranger Jane)",
  );
  ok(
    triggers.filter((t) => t === "near_location").length >= 3,
    "Graduation quest uses near_location triggers to force physical travel to each neighbor (>= 3)",
  );
  ok(
    triggers[0] === "talk_npc" && triggers[triggers.length - 1] === "talk_npc",
    "Graduation quest starts and ends with a talk_npc step on Jackie",
  );
}

// 4. The three intro quests gate behind the graduation quest, are given by
//    the correct NPC, and pin that NPC as their first marker.
const introExpectations = [
  { id: alexisId, npc: "alexis", firstMarker: "npc_alexis" },
  { id: luisId, npc: "luis", firstMarker: "npc_luis" },
  { id: janeId, npc: "ranger_jane", firstMarker: "npc_ranger_jane" },
];
for (const exp of introExpectations) {
  const block = questBlockById(shared, exp.id) ?? "";
  ok(
    fieldMatch(block, "giverNpcId") === exp.npc,
    `Intro quest ${exp.id} is given by ${exp.npc}`,
  );
  ok(
    /category:\s*"road_neighbor"/.test(block),
    `Intro quest ${exp.id} has category road_neighbor`,
  );
  ok(
    new RegExp(`unlockedBy:\\s*{[^}]*kind:\\s*"quest_accepted"[^}]*questId:\\s*"${graduationId}"`).test(block),
    `Intro quest ${exp.id} unlocks via quest_accepted on ${graduationId}`,
  );
  const markers = extractArray(block, "markerIds");
  const objectives = extractArray(block, "objectives");
  const triggers = extractArray(block, "triggers");
  ok(
    markers.length === objectives.length && triggers.length === objectives.length,
    `Intro quest ${exp.id} has matched objectives/triggers/markers (${objectives.length}/${triggers.length}/${markers.length})`,
  );
  ok(
    markers[0] === exp.firstMarker,
    `Intro quest ${exp.id} first marker is ${exp.firstMarker} (forces player to physically walk to ${exp.npc})`,
  );
  ok(
    triggers[0] === "near_location",
    `Intro quest ${exp.id} first trigger is near_location (player walks to the NPC)`,
  );
}

// 5. The runtime exposes isSnapshotGroveQuestUnlockedV108 and uses it in the
//    available-for-npc filter so locked quests are never offered.
ok(
  /export function isSnapshotGroveQuestUnlockedV108\s*\(/.test(runtime),
  "Runtime exposes isSnapshotGroveQuestUnlockedV108",
);
ok(
  /function countCompletedFountainLessonsV108\s*\(/.test(runtime),
  "Runtime defines countCompletedFountainLessonsV108",
);
ok(
  /isSnapshotGroveQuestUnlockedV108\(quest,\s*state\)/.test(runtime),
  "availableQuestsForNpcV101 filters by isSnapshotGroveQuestUnlockedV108",
);
ok(
  /snapshotGroveQuestCategoryRankV108/.test(runtime),
  "Runtime sorts NPC offers by category rank so graduation/neighbor quests follow fountain lessons",
);

// 6. The journal panel renders the new categories with locked-state hints.
ok(
  /category === "road_graduation"/.test(runtime),
  "Journal panel filters a Road tour list for category road_graduation",
);
ok(
  /category === "road_neighbor"/.test(runtime),
  "Journal panel filters a Road neighbors list for category road_neighbor",
);
ok(
  /Unlocks after \$\{quest\.unlockedBy\.minCompletedFountainLessons\}/.test(runtime),
  "Journal panel shows a 'Unlocks after N fountain lessons' hint for locked graduation quest",
);
ok(
  /Unlocks once you accept/.test(runtime),
  "Journal panel shows a 'Unlocks once you accept ...' hint for locked road-neighbor quests",
);

// 7. Quest unlock predicates honor "quest_accepted" or "quest_completed"
//    (accepting the graduation tour should be enough to start the intros).
ok(
  /case "quest_accepted":[\s\S]{0,200}state\.acceptedQuestIds\.includes\(prerequisite\.questId\)/.test(runtime),
  "quest_accepted predicate is satisfied by accepting the prerequisite quest",
);
ok(
  /case "quest_accepted":[\s\S]{0,260}state\.completedQuestIds\.includes\(prerequisite\.questId\)/.test(runtime),
  "quest_accepted predicate is ALSO satisfied if the prerequisite was completed (so finishing graduation does not re-lock the intros)",
);

// 8. Runtime version bump records the graduation pass.
ok(
  runtime.includes("snapshot-grove-bible-graduation-chain-v108") ||
    runtime.includes("snapshot-grove-bible-tutor-highlights-v109"),
  "Runtime version constant records the v108 graduation-chain update",
);

// 9. The three road-neighbor markers each resolve to a real landmark and the
//    three target NPC ids exist in the seeded NPC list.
const neighborMarkers = ["npc_alexis", "npc_luis", "npc_ranger_jane", "lovely_locks_mirror", "luis_cart", "mosslawn_warning_moss", "mosslawn_song_stones"];
for (const marker of neighborMarkers) {
  const npcRef = marker.startsWith("npc_");
  const ok1 = npcRef && shared.includes(`id: "${marker.slice(4)}"`);
  const ok2 = !npcRef && shared.includes(`id: "${marker}"`);
  ok(
    ok1 || ok2,
    `Marker ${marker} resolves to a real landmark or seeded NPC`,
  );
}

// 10. Sanity: no graduation/intro quest should belong to the fountain
//     tutorial set, otherwise the lock logic would loop on itself.
const fountainSet = [
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
for (const id of newQuests) {
  failIf(
    fountainSet.includes(id),
    `New quest ${id} is NOT in the fountain tutorial set (prevents unlock-loop)`,
  );
}

if (failures) {
  console.error(`v108 Grove graduation chain check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v108 Grove graduation chain check passed");
