/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_END_TO_END_PLAYTHROUGH
//
// Drives the complete 85-quest catalog through the real gate and the real
// native trigger model. No mocks, no directly-set flags except the ones a
// quest legitimately grants. If a player can reach a state, this reaches it
// the same way.
//
// This is the tier that replaces browser replay. TESTING_FASTER section 4.12
// runs the Bible rows as ten serial browser groups with a three-minute
// per-row failure ceiling; everything asserted here is decidable from authored
// data and runs in milliseconds.

import assert from "assert";
import { BIBLE_QUEST_CATALOG, bibleQuest } from "../bible/bible_quest_catalog";
import {
  BIBLE_MAIN_SPINE_CODES,
  BIBLE_OPTIONAL_MAIN_CODES,
  bibleImpossibleGateQuestIds,
  bibleMainArcOrderErrors,
  bibleRunFullPlaythrough,
  bibleUnstartableQuestIds,
} from "../bible/bible_e2e_playthrough";
import { bibleNativeStepId } from "../bible/bible_quest_ids";

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

// The walk is deterministic, so run it once and assert over the report.
// Re-running per test was the shape that made ch1_e2e_dungeon_traversal 3s.
const REPORT = bibleRunFullPlaythrough(NOW);

describe("Bible end-to-end playthrough", () => {
  it("completes every authored quest with no errors", () => {
    assert.deepEqual(REPORT.errors, []);
    assert.deepEqual(
      REPORT.unreachableQuestIds,
      [],
      "these quests can never be offered under any legal conditions"
    );
    assert.equal(REPORT.completedQuestIds.length, BIBLE_QUEST_CATALOG.length);
  });

  it("fires all 340 objective leaves exactly once", () => {
    assert.equal(REPORT.steps.length, 340);
    const keys = REPORT.steps.map((step) => `${step.questId}:${step.stepId}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("addresses every fired leaf by its real native step id", () => {
    // A leaf the server cannot address is a permanent soft-lock:
    // harthmere_quest_progress.ts rejects any step id absent from the tree.
    for (const step of REPORT.steps) {
      assert.equal(
        step.nativeStepId,
        Number(bibleNativeStepId(step.questId, step.stepId)),
        `${step.questId}/${step.stepId}`
      );
      assert(Number.isSafeInteger(step.nativeStepId));
    }
  });

  it("never completes a quest before its prerequisite", () => {
    const order = new Map(
      REPORT.completedQuestIds.map((questId, index) => [questId, index])
    );
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (quest.start.kind !== "after") continue;
      const self = order.get(quest.id);
      const prerequisite = order.get(quest.start.questId);
      assert(self !== undefined && prerequisite !== undefined, quest.id);
      assert(
        prerequisite < self,
        `${quest.id} completed before its prerequisite ${quest.start.questId}`
      );
    }
  });
});

describe("Bible reachability", () => {
  it("leaves no quest unstartable by every means", () => {
    assert.deepEqual(bibleUnstartableQuestIds(), []);
  });

  it("authors no gate that can never be satisfied", () => {
    assert.deepEqual(bibleImpossibleGateQuestIds(), []);
  });

  it("keeps the main spine strictly ordered Q1 through Q12", () => {
    assert.deepEqual(bibleMainArcOrderErrors(), []);
  });

  it("keeps Q2.5 optional — a branch off Q2, not a step in the spine", () => {
    const optional = BIBLE_QUEST_CATALOG.filter((quest) =>
      BIBLE_OPTIONAL_MAIN_CODES.includes(quest.code)
    );
    assert.equal(optional.length, 1);
    const q25 = optional[0];
    assert.equal(q25.start.kind, "after");
    if (q25.start.kind !== "after") return;
    assert.equal(q25.start.questId, "bellbound_q02_whispers_at_well");
    // Nothing on the spine may depend on it, or it stops being optional.
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (!BIBLE_MAIN_SPINE_CODES.includes(quest.code)) continue;
      if (quest.start.kind !== "after") continue;
      assert.notEqual(
        quest.start.questId,
        q25.id,
        `${quest.id} requires optional ${q25.id}`
      );
    }
  });

  it("reaches the dragon only through the full arc", () => {
    const q12 = bibleQuest("bellbound_q12_thaedryn_bellbound");
    assert(q12);
    assert.equal(q12.start.kind, "after");
    if (q12.start.kind !== "after") return;
    assert.equal(q12.start.questId, "bellbound_q11_last_ringing");
    // Walking the chain back must reach Q1 without a gap.
    const chain: string[] = [];
    let cursor = q12;
    while (cursor.start.kind === "after") {
      chain.push(cursor.id);
      const next = bibleQuest(cursor.start.questId);
      assert(next, `${cursor.id}: broken chain at ${cursor.start.questId}`);
      cursor = next;
    }
    chain.push(cursor.id);
    assert.equal(cursor.id, "bellbound_q01_cracks_in_bridge");
    // Q1..Q12 plus Q2.5 is 13; the chain excludes Q2.5, which branches off Q2.
    assert.equal(chain.length, 12);
  });

  it("grants every flag any gate requires", () => {
    const granted = new Set(
      BIBLE_QUEST_CATALOG.flatMap((quest) => quest.rewards.unlocks)
    );
    for (const quest of BIBLE_QUEST_CATALOG) {
      for (const flag of quest.gate.requiredFlags) {
        assert(
          granted.has(flag),
          `${quest.id} requires flag "${flag}" that nothing grants`
        );
      }
    }
  });
});

describe("Bible playthrough — checkpoint seeding", () => {
  // The structural payoff of the migration: a browser resume checkpoint is now
  // just the (challengeId, stepId) pairs preceding the target leaf, because
  // progress lives in native TriggerState. The retired runtime needed the
  // quest_runtime records rebuilt as well.
  it("produces a seedable predecessor set for any objective", () => {
    const target = REPORT.steps[200];
    const predecessors = REPORT.steps.slice(
      0,
      REPORT.steps.findIndex(
        (step) =>
          step.questId === target.questId && step.stepId === target.stepId
      )
    );
    assert(predecessors.length > 0);
    for (const step of predecessors) {
      assert(Number.isSafeInteger(step.nativeChallengeId));
      assert(Number.isSafeInteger(step.nativeStepId));
    }
    // A checkpoint is two numbers per leaf and nothing else.
    const payload = predecessors.map((step) => [
      step.nativeChallengeId,
      step.nativeStepId,
    ]);
    assert.equal(payload.length, predecessors.length);
  });
});
