#!/usr/bin/env node
// SNAPSHOT_GROVE_QUEST_MARKER_VISIBILITY:
// Verifies that the Grove tutorial pin system shows one navigation aid for the
// selected quest's current objective. Other accepted quests remain represented
// by their current physical props/map rows, while past/future navigation pins
// are cleared to avoid map clutter.
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
let failures = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL ${msg}`);
  }
}
function failIf(cond, msg) {
  ok(!cond, msg);
}

const runtime = read(
  "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx"
);
const shared = read("src/shared/harthmere/snapshot_grove_content.ts");

// 1. Per-step nav-aid id range exists.
ok(
  runtime.includes("SNAPSHOT_GROVE_NAV_AID_BASE"),
  "Grove runtime defines a per-step nav-aid id base for current marker visibility"
);
ok(
  runtime.includes("SNAPSHOT_GROVE_NAV_AID_MAX_STEPS"),
  "Grove runtime defines a max-step ceiling so the nav-aid id range is bounded"
);
ok(
  /function\s+snapshotGroveStepNavAidId\s*\(/.test(runtime),
  "Grove runtime exposes snapshotGroveStepNavAidId for per-step ids"
);
ok(
  /function\s+snapshotGroveAllStepNavAidIds\s*\(/.test(runtime),
  "Grove runtime exposes snapshotGroveAllStepNavAidIds for sweeping clears"
);

// 2. The legacy single nav-aid id is no longer used as a hard pin target.
failIf(
  /addNavigationAid\s*\([\s\S]{0,160}SNAPSHOT_GROVE_NAV_AID_ID/.test(runtime),
  "Legacy SNAPSHOT_GROVE_NAV_AID_ID is not used to pin step markers anymore"
);

// 3. One shared helper owns selected-quest pin synchronization.
ok(
  /function\s+pinAllSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "pinAllSnapshotGroveQuestMarkers remains the selected-quest pin owner"
);
ok(
  /function\s+clearAllSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "clearAllSnapshotGroveQuestMarkers exists to clear every step's marker"
);
ok(
  /function\s+syncSnapshotGroveQuestMarkers\s*\(/.test(runtime),
  "syncSnapshotGroveQuestMarkers exists as the single source of marker state"
);

// 4. Only the selected quest's current counted/subtarget marker is pinned.
ok(
  /currentMarkerForQuest\([\s\S]{0,220}snapshotGroveObjectiveCompletedCountForQuest[\s\S]{0,260}snapshotGroveStepNavAidId\(0\)/.test(
    runtime
  ),
  "Selected quest pins only its current counted/subtarget marker"
);

// 5. Completion switches to the next selected quest, or clears the pin range.
ok(
  /const selectedQuest = questById\(next\.activeQuestId\);[\s\S]{0,260}syncSnapshotGroveQuestMarkers\(/.test(
    runtime
  ) &&
    /if \(!quest\) \{[\s\S]{0,120}clearAllSnapshotGroveQuestMarkers\(mapManager\)/.test(
      runtime
    ),
  "Completing a Grove quest switches the selected pin or clears it"
);

// 6. Every refresh clears the bounded stale pin range before adding current.
ok(
  /for \(const id of snapshotGroveAllStepNavAidIds\(\)\) \{[\s\S]{0,100}removeNavigationAid/.test(
    runtime
  ),
  "Refreshing a Grove marker clears every stale step pin first"
);

// 7. The controller useEffect uses the multi-marker sync function.
ok(
  /useEffect\(\s*\(\)\s*=>\s*{[\s\S]{0,500}syncSnapshotGroveQuestMarkers\(\s*mapManager\s*,\s*quest\s*,\s*state\.activeObjectiveIndex\s*\)/.test(
    runtime
  ),
  "Grove controller syncs the selected marker on activeQuestId/objective change"
);

// 8. The Map HUD's Pin button passes the landmark through the shared grounded
//    position resolver and uses the active step's nav-aid id, not the legacy
//    single id, so player taps refresh the right pin slot.
ok(
  /onClick=\{\(\)\s*=>\s*\n?\s*pinSnapshotGroveLandmark\(\s*mapManager,\s*marker,\s*snapshotGroveStepNavAidId\(objectiveIndex\)/.test(
    runtime
  ),
  "Map HUD Pin button grounds the landmark and uses the active step's per-step nav-aid id"
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
    `Fountain tutorial ${id} has one marker per objective (${markers.length}/${objectives.length})`
  );
  ok(
    markers.length > 0 && markers.length <= 12,
    `Fountain tutorial ${id} stays within current nav-aid id ceiling (12 steps)`
  );
  for (const marker of markers) {
    const staticLandmark = shared.includes(`id: "${marker}"`);
    const npcMarker =
      marker.startsWith("npc_") && shared.includes(`id: "${marker.slice(4)}"`);
    ok(
      staticLandmark || npcMarker,
      `${id} marker ${marker} resolves to a real landmark or NPC marker`
    );
  }
}

// 10. Runtime marker documents the change.
ok(
  runtime.includes("snapshot-grove-bible-onboarding-polish") ||
    runtime.includes("snapshot-grove-bible-graduation-chain") ||
    runtime.includes("snapshot-grove-bible-tutor-highlights") ||
    runtime.includes("snapshot-grove-mission-critical") ||
    runtime.includes("snapshot-grove-mission-critical"),
  "Grove runtime marker records the onboarding-polish update"
);

if (failures) {
  console.error(
    `current Grove quest marker visibility check failed: ${failures} failure(s)`
  );
  process.exit(1);
}
console.log("current Grove quest marker visibility check passed");
