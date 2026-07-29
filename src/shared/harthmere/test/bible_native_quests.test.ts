/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_NATIVE_PROJECTION
//
// The projection is the integration. `harthmere_quest_progress.ts` rejects any
// step id absent from the biscuit's trigger tree, so a projection defect is a
// permanent soft-lock rather than a visible error — the objective simply never
// completes and no log says why.

import assert from "assert";
import { BIBLE_QUEST_CATALOG, bibleQuest } from "../bible/bible_quest_catalog";
import {
  bibleNativeQuestId,
  bibleNativeQuestRootId,
  bibleNativeStepId,
  bibleNativeUnlockRootId,
} from "../bible/bible_quest_ids";
import {
  allBibleNativeQuestBiscuits,
  bibleQuestBiscuit,
} from "../bible/bible_native_quests";
import { BIBLE_DRAGON_QUEST_ID, BIBLE_THAEDRYN_ENTITY_ID } from "../bible/bible_thaedryn";
import { bibleQuestAutoStarts } from "../bible/bible_quest_schema";

const BISCUITS = allBibleNativeQuestBiscuits();

describe("Bible native projection — trigger trees", () => {
  it("projects every quest exactly once", () => {
    assert.equal(BISCUITS.length, BIBLE_QUEST_CATALOG.length);
    assert.equal(
      new Set(BISCUITS.map((biscuit) => biscuit.id)).size,
      BISCUITS.length
    );
  });

  it("builds one ordered seq leaf per authored objective", () => {
    for (const [index, quest] of BIBLE_QUEST_CATALOG.entries()) {
      const biscuit = BISCUITS[index];
      assert.equal(biscuit.id, bibleNativeQuestId(quest.id), quest.id);
      assert.equal(biscuit.displayName, quest.title);
      assert.equal(biscuit.isQuest, true);
      assert.equal(biscuit.trigger?.kind, "seq", quest.id);
      if (biscuit.trigger?.kind !== "seq") continue;
      assert.equal(biscuit.trigger.id, bibleNativeQuestRootId(quest.id));
      assert.equal(biscuit.trigger.triggers.length, quest.steps.length, quest.id);
      for (const [stepIndex, leaf] of biscuit.trigger.triggers.entries()) {
        const step = quest.steps[stepIndex];
        assert.equal(
          leaf.id,
          bibleNativeStepId(quest.id, stepIndex),
          `${quest.id}/${step.id}`
        );
        assert.equal(leaf.kind, "event");
        if (leaf.kind !== "event") continue;
        assert.equal(leaf.eventKind, "harthmereQuestProgress");
        assert.equal(leaf.count, step.count);
      }
    }
  });

  it("predicates every leaf on its own (challengeId, stepId) pair", () => {
    // Original-snapshot biscuits reuse a trigger leaf id across unrelated
    // quests (TESTING_FASTER 4.15), so a predicate keyed on step id alone
    // would cross-credit. Every Bible leaf must name both.
    for (const biscuit of BISCUITS) {
      if (biscuit.trigger?.kind !== "seq") continue;
      for (const leaf of biscuit.trigger.triggers) {
        if (leaf.kind !== "event") continue;
        const fields = (leaf.predicate as any).fields as Array<[string, any]>;
        const keys = fields.map(([key]) => key);
        assert.deepEqual(keys, ["challengeId", "stepId"]);
        assert.equal(fields[0][1].value, biscuit.id);
        assert.equal(fields[1][1].value, leaf.id);
      }
    }
  });
});

describe("Bible native projection — unlock", () => {
  it("leaves a plain giver quest with no unlock", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (quest.start.kind !== "giver") continue;
      assert.equal(
        bibleQuestBiscuit(quest).unlock,
        undefined,
        `${quest.id}: a quest an NPC offers must not carry an unlock`
      );
    }
  });

  it("gates every prerequisite quest on its predecessor's completion", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (quest.start.kind !== "after") continue;
      const unlock = bibleQuestBiscuit(quest).unlock;
      assert.equal(unlock?.kind, "all", quest.id);
      if (unlock?.kind !== "all") continue;
      assert.equal(unlock.id, bibleNativeUnlockRootId(quest.id));
      assert.equal(unlock.triggers.length, 1);
      const leaf = unlock.triggers[0];
      assert.equal(leaf.kind, "challengeComplete");
      if (leaf.kind !== "challengeComplete") continue;
      assert.equal(leaf.challenge, bibleNativeQuestId(quest.start.questId));
    }
  });

  // The circular self-gate is load-bearing: the global native challenge runner
  // starts any quest whose unlock is satisfied, so a hidden giver-less quest
  // with NO unlock would begin the moment the player logs in.
  it("self-gates the three discovered quests so they cannot auto-start", () => {
    const discovered = BIBLE_QUEST_CATALOG.filter(
      (quest) => quest.start.kind === "world_trigger"
    );
    assert.equal(discovered.length, 3);
    for (const quest of discovered) {
      const unlock = bibleQuestBiscuit(quest).unlock;
      assert.equal(unlock?.kind, "event", quest.id);
      if (unlock?.kind !== "event") continue;
      assert.equal(unlock.eventKind, "challengeUnlocked");
      const fields = (unlock.predicate as any).fields as Array<[string, any]>;
      assert.equal(
        fields[0][1].value,
        bibleNativeQuestId(quest.id),
        `${quest.id}: self-gate must name its own challenge, or an unrelated ` +
          `unlock event would start it`
      );
    }
  });

  it("gives an auto-starting quest an unlock but no giver", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (!bibleQuestAutoStarts(quest)) continue;
      const biscuit = bibleQuestBiscuit(quest);
      assert(biscuit.unlock, `${quest.id}: auto-start needs an unlock`);
      if (quest.id === BIBLE_DRAGON_QUEST_ID) continue;
      assert.equal(
        biscuit.questGiver,
        undefined,
        `${quest.id}: auto-starting quests have no NPC to accept from`
      );
    }
  });
});

describe("Bible native projection — givers and cadence", () => {
  it("routes the dragon quest at the Thaedryn encounter entity", () => {
    const quest = bibleQuest(BIBLE_DRAGON_QUEST_ID);
    assert(quest);
    assert.equal(bibleQuestBiscuit(quest).questGiver, BIBLE_THAEDRYN_ENTITY_ID);
  });

  it("maps repeatability onto the native cadence", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const expected =
        quest.repeatability === "once"
          ? "never"
          : quest.repeatability === "daily"
          ? "daily"
          : "weekly";
      assert.equal(
        bibleQuestBiscuit(quest).repeatableCadence,
        expected,
        quest.id
      );
    }
  });

  it("marks non-main quests as side quests", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const biscuit = bibleQuestBiscuit(quest) as any;
      assert.equal(
        biscuit.isSideQuest ?? false,
        quest.category !== "main",
        quest.id
      );
    }
  });

  it("carries the authored offer text as the accept text", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      assert.equal(bibleQuestBiscuit(quest).questAcceptText, quest.dialogue.offer);
    }
  });
});
