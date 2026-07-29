#!/usr/bin/env node
// CONVERT_GROVE_CATALOG_TO_TYPED
//
// One-shot migration tool. Reads `SNAPSHOT_GROVE_QUESTS` and emits typed
// `GroveQuestDef[]` modules split per arc, collapsing the three parallel
// arrays (`objectives` / `triggers` / `markerIds`) into one object per step.
//
// NOT a build step. Runs once; output is committed and hand-editable from then
// on, same contract as ch1_quests.ts and the bible modules.
//
// Unlike the bible converter, this one STILL RUNS: `snapshot_grove_content.ts`
// survives phase 4 because it also owns the Grove NPC roster and the 108-entry
// landmark table, which the new modules read rather than duplicate. Only
// `SNAPSHOT_GROVE_QUESTS` is superseded.
//
//   node scripts/harthmere/convert-grove-catalog-to-typed.cjs
//
// See docs/harthmere/GROVE_TO_CH1_MIGRATION.md.

require("ts-node/register");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "src/shared/harthmere/grove");

const content = require("@/shared/harthmere/snapshot_grove_content");
// The four index-keyed requirement tables. Reading them HERE and folding the
// values onto the step is the whole point of step 3: it retires the fourth
// positional index (`${questId}:${objectiveIndex}`) that survived the first
// conversion.
const triggerContract = require("@/shared/harthmere/snapshot_grove_trigger_contract");
const QUESTS = content.SNAPSHOT_GROVE_QUESTS;
const FOUNTAIN_IDS = new Set(
  content.SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS
);

// ---------------------------------------------------------------------------
// GIVER REASSIGNMENT — Jackie's four fountain lessons move to Rosalyn.
//
// Requested change. Applied HERE, in the conversion, rather than hand-edited
// into the generated data afterwards, so the reassignment is a reviewable rule
// with a stated reason instead of four silent literal edits.
//
// Rosalyn was chosen on TWO checks, not one. Same area is not sufficient:
// Old Coop is also in `the_grove` but stands 139 blocks from the fountain,
// which would have turned the game's first tutorial into a long round trip.
// Rosalyn is 4 blocks away and her authored role is "Fountain steward,
// welcome-table", so the lessons stay exactly where they happen.
//
// That matters beyond convenience: Grove quest state is per-player while the
// NPC set is SHARED, so the alternative — relocating an NPC to suit a quest —
// would move them for everyone and take position authority away from Anima's
// brain and return-home anchor (ANIMA RULE 2/3). Picking someone already in
// place is the only reassignment that needs no ECS move at all.
//
// `grove_engine_contracts.ts` now enforces the distance check that this
// reasoning depends on, so a future reassignment cannot repeat the mistake.
//
// EXPLICITLY OUT OF SCOPE: Jackie's native snapshot chain — Road Ahead,
// Busted, Get the Muck Out, Muck vs. Machine. Those are Bikkie biscuits baked
// into snapshot_backup.json, they are not Grove quests, they are not in this
// catalog, and this script cannot reach them. `grove_giver_reassignment.test.ts`
// asserts they remain Jackie's.
// ---------------------------------------------------------------------------
const GIVER_REASSIGNMENTS = Object.freeze({
  fountain_buttons_first: "rosalyn",
  tools_before_treasure: "rosalyn",
  fountain_hotbar_and_dropping: "rosalyn",
  fountain_first_recipe_torch: "rosalyn",
});

// Reassigning a giver is not just an id swap. The authored prose names the
// giver, and the "talk to the giver" objectives point at the giver's own map
// marker. Leaving either behind produces a quest that Rosalyn offers but whose
// map arrow sends the player to Jackie — which reads as a broken quest, not a
// reassigned one. Both are rewritten here, in the same rule, so they cannot
// drift apart.
const REASSIGNED_GIVER_DISPLAY_NAMES = Object.freeze({
  jackie: "Jackie",
  rosalyn: "Rosalyn",
});
const REASSIGNED_GIVER_MARKERS = Object.freeze({
  jackie: "npc_jackie",
  rosalyn: "npc_rosalyn",
});

function retargetGiverProse(text, fromGiverId, toGiverId) {
  const from = REASSIGNED_GIVER_DISPLAY_NAMES[fromGiverId];
  const to = REASSIGNED_GIVER_DISPLAY_NAMES[toGiverId];
  if (!from || !to) return text;
  // Whole-word, case-sensitive on the display name; the authored prose uses
  // "Jackie" consistently and never as part of a longer word.
  return text.split(new RegExp(`\\b${from}\\b`, "g")).join(to);
}

function retargetGiverMarker(markerId, fromGiverId, toGiverId) {
  return markerId === REASSIGNED_GIVER_MARKERS[fromGiverId]
    ? REASSIGNED_GIVER_MARKERS[toGiverId]
    : markerId;
}

function giverFor(quest) {
  return GIVER_REASSIGNMENTS[quest.id] ?? quest.giverNpcId;
}

// ---------------------------------------------------------------------------
// Arc assignment. Drives module split, so a scoped test parses a fraction of
// the catalog rather than all 51 rows.
// ---------------------------------------------------------------------------
function arcFor(quest) {
  if (quest.id.startsWith("econ_")) return "economy";
  if (quest.category === "road_graduation") return "graduation";
  if (quest.category === "road_neighbor") return "neighbor";
  if (FOUNTAIN_IDS.has(quest.id)) return "fountain";
  return "story";
}

function categoryFor(quest) {
  if (quest.category) return quest.category;
  return FOUNTAIN_IDS.has(quest.id) ? "fountain_lesson" : "road_story";
}

// ---------------------------------------------------------------------------
// activeRules -> start.
//
// `unlockedBy` had three kinds; all three are preserved. Only
// `quest_completed` becomes a native challengeComplete unlock — the other two
// stay in the gate because native Challenges cannot express "any N of a set"
// or "accepted but not finished".
// ---------------------------------------------------------------------------
function startFor(quest) {
  const giverNpcId = giverFor(quest);
  const unlock = quest.unlockedBy;
  if (!unlock) return { kind: "giver", giverNpcId };
  switch (unlock.kind) {
    case "quest_completed":
      return { kind: "after", questId: unlock.questId, giverNpcId };
    case "quest_accepted":
      return { kind: "after_accepted", questId: unlock.questId, giverNpcId };
    case "fountain_completion_count":
      return {
        kind: "after_fountain_lessons",
        minCompleted: unlock.minCompletedFountainLessons,
        giverNpcId,
      };
    default:
      throw new Error(`${quest.id}: unknown unlockedBy kind ${unlock.kind}`);
  }
}

function stepsFor(quest, fromGiverId, toGiverId) {
  // The three parallel arrays collapse into one object per objective. Their
  // lengths were previously kept in sync only by a hand-written test.
  if (
    quest.objectives.length !== quest.triggers.length ||
    quest.objectives.length !== quest.markerIds.length
  ) {
    throw new Error(
      `${quest.id}: parallel arrays disagree — objectives ${quest.objectives.length}, ` +
        `triggers ${quest.triggers.length}, markerIds ${quest.markerIds.length}`
    );
  }
  const reassigned = toGiverId && toGiverId !== fromGiverId;
  return quest.objectives.map((label, index) => {
    // EXACT REQUIREMENTS, read from the retired tables and attached to the
    // step. Each accessor takes (quest, objectiveIndex) today; after this fold
    // the step carries the answer and the tables can be deleted.
    const requiredCount = triggerContract.snapshotGroveObjectiveRequiredCount(
      quest,
      index
    );
    // Retarget the folded list too. It is derived from the RETIRED array's
    // markerIds, so without this the reassignment lands on `markerId` and the
    // target list still names the old giver — the exact half-done state the
    // marker retarget exists to prevent.
    const targetMarkerIds = triggerContract
      .snapshotGroveObjectiveTargetMarkerIds(quest, index)
      .map((id) =>
        reassigned ? retargetGiverMarker(id, fromGiverId, toGiverId) : id
      );
    const inventory =
      triggerContract.snapshotGroveObjectiveInventoryRequirement(quest, index);
    // The craft expectation had no accessor — it was two hardcoded `quest.id
    // === ... && objectiveIndex === ...` branches inside a matcher. Probing
    // the matcher with the known recipe ids is how we recover it without
    // duplicating the branch here.
    const craft = probeCraftRequirement(quest, index);
    const markerId = reassigned
      ? retargetGiverMarker(quest.markerIds[index], fromGiverId, toGiverId)
      : quest.markerIds[index];
    // Only emit a target list when it genuinely differs from the single
    // marker, so 234 of 255 steps stay one clean line.
    const multiTarget =
      targetMarkerIds.length > 1 ||
      (targetMarkerIds.length === 1 && targetMarkerIds[0] !== markerId);
    return {
    // Native step ids are pinned by INDEX, so the index is identity. The
    // authored id is for readability and log lines only.
      id: `${quest.id}_obj_${String(index + 1).padStart(2, "0")}`,
      index,
      label: reassigned
        ? retargetGiverProse(label, fromGiverId, toGiverId)
        : label,
      trigger: quest.triggers[index],
      markerId,
      ...(requiredCount > 1 ? { requiredCount } : {}),
      ...(multiTarget ? { targetMarkerIds: [...targetMarkerIds] } : {}),
      ...(craft ? { craft } : {}),
      ...(inventory ? { inventory } : {}),
    };
  });
}

/**
 * Recover the exact craft expectation from the matcher.
 *
 * `snapshotGroveCraftEventMatchesObjective` hardcodes two (questId, index)
 * pairs rather than exposing a table, so the requirement is probed: feed it
 * each known tutorial recipe and see which one it accepts. That keeps this
 * converter from re-stating the branch and silently disagreeing with it.
 */
function probeCraftRequirement(quest, objectiveIndex) {
  const recipes = triggerContract.SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS;
  const items = triggerContract.SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS;
  for (const key of Object.keys(recipes)) {
    const recipeId = recipes[key];
    const outputItemId = items[key];
    if (!recipeId || !outputItemId) continue;
    if (
      triggerContract.snapshotGroveCraftEventMatchesObjective(
        { recipeId, outputItemId },
        quest,
        objectiveIndex
      )
    ) {
      return { recipeId, outputItemId };
    }
  }
  return undefined;
}

function convert(quest) {
  const fromGiverId = quest.giverNpcId;
  const toGiverId = giverFor(quest);
  const reassigned = toGiverId !== fromGiverId;
  const prose = (text) =>
    reassigned ? retargetGiverProse(text, fromGiverId, toGiverId) : text;
  return {
    id: quest.id,
    title: quest.title,
    arc: arcFor(quest),
    category: categoryFor(quest),
    area: quest.area,
    hook: prose(quest.hook),
    start: startFor(quest),
    steps: stepsFor(quest, fromGiverId, toGiverId),
    reward: prose(quest.reward),
    sampleDialogue: prose(quest.sampleDialogue),
    connectorToHarthmere: quest.connectorToHarthmere === true,
    countsAsFountainLesson: FOUNTAIN_IDS.has(quest.id),
  };
}

function emitModule(arc, quests) {
  const constName = `GROVE_QUESTS_${arc.toUpperCase()}`;
  const body = quests
    .map((quest) => JSON.stringify(quest, null, 2))
    .join(",\n")
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");
  return `// GROVE_QUESTS_${arc.toUpperCase()} — generated by
// scripts/harthmere/convert-grove-catalog-to-typed.cjs from the retired
// SNAPSHOT_GROVE_QUESTS, then owned as ordinary source.
//
// ORDER IS FROZEN. Native quest ids and step ids are pinned by position
// (grove_quest_id_pins.ts), so appending is free and reordering is a
// migration. grove_quest_ids.test.ts fails on any reorder.
//
// Each step is ONE object. The retired shape stored objectives, triggers and
// markerIds as three positionally-indexed parallel arrays whose lengths were
// kept in sync only by a hand-written test.

import type { GroveQuestDef } from "@/shared/harthmere/grove/grove_quest_schema";

// Annotating the DECLARATION gives every element the contextual type, so tsc
// checks each row against one known target. See the note in
// convert-bible-catalog-to-typed.cjs for why neither \`as const\` nor a bare
// Object.freeze is used here.
const QUESTS: GroveQuestDef[] = [
${body}
];

export const ${constName}: readonly GroveQuestDef[] = Object.freeze(QUESTS);
`;
}

function main() {
  const converted = QUESTS.map(convert);
  const byArc = {
    fountain: [],
    graduation: [],
    neighbor: [],
    story: [],
    economy: [],
  };
  for (const quest of converted) byArc[quest.arc].push(quest);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [arc, quests] of Object.entries(byArc)) {
    const file = path.join(OUT_DIR, `grove_quests_${arc}.ts`);
    fs.writeFileSync(file, emitModule(arc, quests));
    console.log(
      "  %s  (%d quests)",
      path.relative(ROOT, file).padEnd(52),
      quests.length
    );
  }

  const steps = converted.reduce((sum, q) => sum + q.steps.length, 0);
  console.log("\nconverted %d quests, %d objectives", converted.length, steps);

  const moved = converted.filter(
    (quest) => GIVER_REASSIGNMENTS[quest.id] !== undefined
  );
  console.log("\ngiver reassignments applied: %d", moved.length);
  for (const quest of moved) {
    console.log(
      "  %s  jackie -> %s",
      quest.id.padEnd(32),
      quest.start.giverNpcId
    );
  }
  console.log(
    "  (Jackie's native Road Ahead / Busted / Get the Muck Out / " +
      "Muck vs. Machine are snapshot biscuits, not Grove quests, and are " +
      "untouched.)"
  );
}

main();
