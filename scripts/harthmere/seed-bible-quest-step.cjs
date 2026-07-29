#!/usr/bin/env node
// SEED_BIBLE_QUEST_STEP
//
// Prints the checkpoint payload that moves a browser actor to one Bible
// objective without replaying the quests before it.
//
// WHY THIS IS NOW CHEAP
// ---------------------
// Before the migration a resume had to reconstruct BOTH halves of production
// state: the `quest_runtime` records in Redis AND the native trigger map.
// TESTING_FASTER section 4.6 records that seeding only the trigger map let
// resumed tests reach objectives with an impossible empty ledger.
//
// After the migration progress lives in native `Challenges`/`TriggerState`
// only, so a checkpoint is two numbers per completed leaf. The residual slice
// (reputation, cadence, choices, flags) is separate and small.
//
// PRINT-ONLY BY DESIGN, same contract as e2e-jump.cjs and
// seed-get-muck-out-browser-step.cjs: review it, then POST it through the
// live-mode writer yourself. A GET must never mutate state — that rule is in
// the ECS source-of-truth doc and exists because a read endpoint once ticked
// stamina.
//
//   node scripts/harthmere/seed-bible-quest-step.cjs <questId> [stepId]
//   node scripts/harthmere/seed-bible-quest-step.cjs --list
//   node scripts/harthmere/seed-bible-quest-step.cjs --arc main

require("ts-node/register");
require("tsconfig-paths/register");

const {
  BIBLE_QUEST_CATALOG,
  bibleQuest,
} = require("../../src/shared/harthmere/bible/bible_quest_catalog");
const {
  bibleNativeQuestId,
  bibleNativeStepId,
} = require("../../src/shared/harthmere/bible/bible_quest_ids");
const {
  bibleStepWorldWaypoint,
} = require("../../src/shared/harthmere/bible/bible_waypoints");
const {
  bibleRunFullPlaythrough,
} = require("../../src/shared/harthmere/bible/bible_e2e_playthrough");

function list(arc) {
  for (const quest of BIBLE_QUEST_CATALOG) {
    if (arc && quest.arc !== arc) continue;
    console.log(`${quest.id}  [${quest.code || quest.category}]`);
    for (const step of quest.steps) {
      const position = bibleStepWorldWaypoint(quest, step);
      console.log(
        `    ${step.id}  ${step.type.padEnd(7)} ` +
          `${position.map((n) => n.toFixed(1)).join("/")}  ${step.label}`
      );
    }
  }
}

function seed(questId, stepId) {
  const quest = bibleQuest(questId);
  if (!quest) {
    console.error(`unknown quest: ${questId}`);
    process.exit(1);
  }
  const targetIndex = stepId
    ? quest.steps.findIndex((step) => step.id === stepId)
    : 0;
  if (targetIndex < 0) {
    console.error(`unknown step: ${questId}/${stepId}`);
    process.exit(1);
  }

  // Everything the deterministic playthrough completes BEFORE this quest is a
  // legitimate predecessor. The fixture marks only predecessor leaves fired and
  // leaves the target leaf open, matching the Get the Muck Out seeder.
  const report = bibleRunFullPlaythrough(Date.now());
  const questOrder = report.completedQuestIds.indexOf(questId);
  const priorQuestIds = report.completedQuestIds.slice(0, Math.max(0, questOrder));

  const firedLeaves = [];
  for (const priorId of priorQuestIds) {
    const prior = bibleQuest(priorId);
    for (const [index] of prior.steps.entries()) {
      firedLeaves.push([
        Number(bibleNativeQuestId(priorId)),
        Number(bibleNativeStepId(priorId, index)),
      ]);
    }
  }
  for (let index = 0; index < targetIndex; index += 1) {
    firedLeaves.push([
      Number(bibleNativeQuestId(questId)),
      Number(bibleNativeStepId(questId, index)),
    ]);
  }

  const target = quest.steps[targetIndex];
  const position = bibleStepWorldWaypoint(quest, target);

  // Resume seeding marks no-giver quests in_progress and giver-backed quests
  // available, matching their production start contracts (TESTING_FASTER 4.6).
  const startsWithGiver =
    quest.start.kind === "giver" ||
    (quest.start.kind === "after" && quest.start.giverId !== undefined);

  console.log(
    JSON.stringify(
      {
        questId,
        stepId: target.id,
        nativeChallengeId: Number(bibleNativeQuestId(questId)),
        nativeStepId: Number(bibleNativeStepId(questId, targetIndex)),
        challengeState: startsWithGiver ? "available" : "in_progress",
        completedChallengeIds: priorQuestIds.map((id) =>
          Number(bibleNativeQuestId(id))
        ),
        firedLeaves,
        // GROUNDED. Never emit the authored Y: TESTING_FASTER section 4.12
        // records that writing the authored zero after the teleport hook
        // already returned a safe pose strands the player below terrain and
        // turns the row into a three-minute movement timeout.
        targetWorldPosition: position,
        liveSlice: {
          lastCompletedAtMs: Object.fromEntries(
            priorQuestIds.map((id) => [id, Date.now()])
          ),
        },
      },
      null,
      2
    )
  );
  console.error(
    `\n# ${firedLeaves.length} predecessor leaves across ` +
      `${priorQuestIds.length} quests; target leaf left open.`
  );
  console.error("# POST this through the live-mode writer; do not GET it.");
}

const [, , first, second] = process.argv;
if (!first || first === "--list") {
  list(undefined);
} else if (first === "--arc") {
  list(second);
} else {
  seed(first, second);
}
