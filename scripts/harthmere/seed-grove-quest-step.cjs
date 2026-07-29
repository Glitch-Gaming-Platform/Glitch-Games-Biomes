#!/usr/bin/env node
// SEED_GROVE_QUEST_STEP
//
// Prints the checkpoint payload that moves a browser actor to one Grove
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
//   node scripts/harthmere/seed-grove-quest-step.cjs <questId> [stepId]
//   node scripts/harthmere/seed-grove-quest-step.cjs --list
//   node scripts/harthmere/seed-grove-quest-step.cjs --arc main

require("ts-node/register");
require("tsconfig-paths/register");

const {
  GROVE_QUEST_CATALOG,
  groveQuest,
} = require("../../src/shared/harthmere/grove/grove_quest_catalog");
const {
  groveNativeQuestId,
  groveNativeStepId,
} = require("../../src/shared/harthmere/grove/grove_quest_ids");
const {
  groveStepWorldWaypoint,
} = require("../../src/shared/harthmere/grove/grove_waypoints");
const {
  groveRunFullPlaythrough,
} = require("../../src/shared/harthmere/grove/grove_e2e_playthrough");

function list(arc) {
  for (const quest of GROVE_QUEST_CATALOG) {
    if (arc && quest.arc !== arc) continue;
    console.log(`${quest.id}  [${quest.code || quest.category}]`);
    for (const step of quest.steps) {
      const position = groveStepWorldWaypoint(step);
      console.log(
        `    ${step.id}  ${step.trigger.padEnd(16)} ` +
          `${position.map((n) => n.toFixed(1)).join("/")}  ${step.label}`
      );
    }
  }
}

function seed(questId, stepId) {
  const quest = groveQuest(questId);
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
  const report = groveRunFullPlaythrough(Date.now());
  const questOrder = report.completedQuestIds.indexOf(questId);
  const priorQuestIds = report.completedQuestIds.slice(0, Math.max(0, questOrder));

  const firedLeaves = [];
  for (const priorId of priorQuestIds) {
    const prior = groveQuest(priorId);
    for (const [index] of prior.steps.entries()) {
      firedLeaves.push([
        Number(groveNativeQuestId(priorId)),
        Number(groveNativeStepId(priorId, index)),
      ]);
    }
  }
  for (let index = 0; index < targetIndex; index += 1) {
    firedLeaves.push([
      Number(groveNativeQuestId(questId)),
      Number(groveNativeStepId(questId, index)),
    ]);
  }

  const target = quest.steps[targetIndex];
  const position = groveStepWorldWaypoint(target);

  // Resume seeding marks no-giver quests in_progress and giver-backed quests
  // available, matching their production start contracts (TESTING_FASTER 4.6).
  // Every Grove quest has a giver, so resume seeding always marks it
  // `available` and lets the browser accept it through the real dialogue.
  const startsWithGiver = true;

  console.log(
    JSON.stringify(
      {
        questId,
        stepId: target.id,
        nativeChallengeId: Number(groveNativeQuestId(questId)),
        nativeStepId: Number(groveNativeStepId(questId, targetIndex)),
        challengeState: startsWithGiver ? "available" : "in_progress",
        completedChallengeIds: priorQuestIds.map((id) =>
          Number(groveNativeQuestId(id))
        ),
        firedLeaves,
        // LIVE-SPACE. Never emit a raw landmark position: 15 Grove-area
        // landmarks are still authored at the retired Y=54 while the terrain
        // the browser loads is at Y=71, which buries the player under the
        // courtyard (see snapshot_grove_content.ts).
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
