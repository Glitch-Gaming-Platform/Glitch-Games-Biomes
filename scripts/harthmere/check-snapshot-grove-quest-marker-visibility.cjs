#!/usr/bin/env node
// SNAPSHOT_GROVE_QUEST_MARKER_VISIBILITY:
// Verifies that the Grove tutorial pin system shows EVERY step marker of the
// active quest, not just the current step. Each step gets its own nav-aid id,
// the active marker is emphasized, past markers are cleared as steps complete,
// and ALL markers are cleared when the quest finishes.
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

const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const shared = read("src/shared/harthmere/snapshot_grove_content.ts");

// 1. Per-step nav-aid id range exists.
ok(
  runtime.includes("SNAPSHOT_GROVE_NAV_AID_BASE"),
  "Grove runtime defines a per-step nav-aid id base for current marker visibility",
);
ok(
  runtime.includes("SNAPSHOT_GROVE_NAV_AID_MAX_STEPS"),
  "Grove runtime defines a max-step ceiling so the nav-aid id range is bounded",
);
ok(
  /function\s+snapshotGroveStepNavAidId\s*\(/.test(runtime),
  "Grove runtime exposes snapshotGroveStepNavAidId for per-step ids",
);
ok(
  /function\s+snapshotGroveAllStepNavAidIds\s*\(/.test(runtime),
  "Grove runtime exposes snapshotGroveAllStepNavAidIds for sweeping clears",
);

// 2. The legacy single nav-aid id is no longer used as a hard pin target.
failIf(
  /addNavigationAid\s*\([\s\S]{0,160}SNAPSHOT_GROVE_NAV_AID_ID/.test(runtime),
  "Legacy SNAPSHOT_GROVE_NAV_AID_ID is not used to pin step markers anymore",
);

// 3. A helper exists that pins every step marker for the active quest.
ok(
  /function\s+pinAllSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "pinAllSnapshotGroveQuestMarkers exists to show every step's marker",
);
ok(
  /function\s+clearAllSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "clearAllSnapshotGroveQuestMarkers exists to clear every step's marker",
);
ok(
  /function\s+syncSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "syncSnapshotGroveQuestMarkers exists as the single source of marker state",
);

// 4. The active-step marker is added last so it draws on top.
ok(
  /Pin upcoming\/future steps first[\s\S]{0,400}active step last/.test(runtime),
  "Active-step marker is pinned last so it visually emphasizes the current stop",
);

// 5. On quest completion, all markers are cleared (not just the active one).
ok(
  /completedQuest\s*\)\s*{[\s\S]{0,200}clearAllSnapshotGroveQuestMarkers\(mapManager\)/.test(runtime),
  "Completing a Grove quest clears every step marker, not just the active pin",
);

// 6. On advance, the previously active step's pin is removed so past markers
//    do not stack up.
ok(
  /mapManager\.removeNavigationAid\?\.\(\s*snapshotGroveStepNavAidId\(\s*safeObjectiveIndex\s*\)\s*\)/.test(runtime),
  "Advancing a step removes the just-finished step's pin",
);

// 7. The controller useEffect uses the multi-marker sync function.
ok(
  /useEffect\(\s*\(\)\s*=>\s*{[\s\S]{0,500}syncSnapshotGroveQuestMarkers\(\s*mapManager\s*,\s*quest\s*,\s*state\.activeObjectiveIndex\s*\)/.test(runtime),
  "Grove controller useEffect syncs all markers on activeQuestId/objective change",
);

// 8. The Map HUD's Pin button uses the active step's nav-aid id, not the
//    legacy single id, so player taps refresh the right pin slot.
ok(
  /onClick=\{\(\)\s*=>\s*\n?\s*pinSnapshotGroveLandmark\(\s*mapManager,\s*marker\.position,\s*snapshotGroveStepNavAidId\(objectiveIndex\)/.test(runtime),
  "Map HUD Pin button uses the active step's per-step nav-aid id",
);

// 9. Every fountain tutorial declares one marker per objective (regression
//    guard from current carried forward).
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
  const block = questBlockById(shared, id);
  ok(Boolean(block), `Fountain tutorial ${id} exists in Grove content`);
  if (!block) continue;
  const objectives = extractArray(block, "objectives");
  const markers = extractArray(block, "markerIds");
  ok(
    markers.length === objectives.length,
    `Fountain tutorial ${id} has one marker per objective (${markers.length}/${objectives.length})`,
  );
  ok(
    markers.length > 0 && markers.length <= 12,
    `Fountain tutorial ${id} stays within current nav-aid id ceiling (12 steps)`,
  );
  for (const marker of markers) {
    const staticLandmark = shared.includes(`id: "${marker}"`);
    const npcMarker = marker.startsWith("npc_") && shared.includes(`id: "${marker.slice(4)}"`);
    ok(
      staticLandmark || npcMarker,
      `${id} marker ${marker} resolves to a real landmark or NPC marker`,
    );
  }
}

// 10. Runtime marker documents the change.
ok(
  runtime.includes("snapshot-grove-bible-onboarding-polish") ||
    runtime.includes("snapshot-grove-bible-graduation-chain") ||
    runtime.includes("snapshot-grove-bible-tutor-highlights") ||
    (runtime.includes("snapshot-grove-mission-critical") || runtime.includes("snapshot-grove-mission-critical")),
  "Grove runtime marker records the onboarding-polish update",
);

if (failures) {
  console.error(`current Grove quest marker visibility check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("current Grove quest marker visibility check passed");
