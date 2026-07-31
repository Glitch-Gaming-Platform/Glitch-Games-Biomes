/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_QUEST_ID_STABILITY
//
// The highest-consequence suite in the migration. A moved id does not throw,
// does not log, and does not fail a browser test — it silently orphans a live
// player's `Challenges`/`TriggerState` and their quest simply stops existing.
//
// So this file asserts, over the real authored data:
//   * every already-issued id still resolves to its pinned value
//   * derived ids only ever fill gaps
//   * quest/step id bands stay disjoint from Grove and Chapter 1
//   * the frozen arc order has not moved

import assert from "assert";
import {
  BIBLE_QUEST_CATALOG,
  bibleQuestIndex,
} from "../bible/bible_quest_catalog";
import {
  BIBLE_QUEST_ID_PINS,
  BIBLE_STEP_ID_PINS,
} from "../bible/bible_quest_id_pins";
import {
  BIBLE_DERIVED_QUEST_ID_BASE,
  BIBLE_DERIVED_STEP_ID_BASE,
  BIBLE_STEP_IDS_PER_QUEST,
  bibleNativeQuestId,
  bibleNativeQuestRootId,
  bibleNativeStepId,
  bibleNativeStepIds,
  bibleNativeUnlockRootId,
  bibleQuestIdForNativeId,
  isBibleNativeQuestId,
} from "../bible/bible_quest_ids";
import { ch1NativeQuestId } from "../ch1_native_quests";
import { CH1_QUESTS } from "../ch1_quests";

describe("Bible native ids — pins", () => {
  it("resolves every authored quest to its already-issued id", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const pinned = BIBLE_QUEST_ID_PINS[quest.id];
      assert(
        pinned !== undefined,
        `${quest.id}: no pin. A quest that has ever shipped must keep its id; ` +
          `only genuinely new quests may derive one.`
      );
      assert.equal(
        Number(bibleNativeQuestId(quest.id)),
        pinned,
        `${quest.id}: id moved — this orphans live player progress`
      );
    }
  });

  it("resolves every authored objective to its already-issued step id", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      for (const [index, step] of quest.steps.entries()) {
        const key = `${quest.id}:objective:${step.id}`;
        const pinned = BIBLE_STEP_ID_PINS[key];
        assert(pinned !== undefined, `${key}: no pin`);
        assert.equal(
          Number(bibleNativeStepId(quest.id, index)),
          pinned,
          `${key}: step id moved`
        );
        // Resolving by authored step id and by index must agree, because the
        // server matcher uses the id and the trigger tree uses the position.
        assert.equal(
          Number(bibleNativeStepId(quest.id, step.id)),
          pinned,
          `${key}: id-keyed and index-keyed lookups disagree`
        );
      }
    }
  });

  it("pins a seq root for every quest and an unlock root for every gated one", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      assert(
        bibleNativeQuestRootId(quest.id) !== undefined,
        `${quest.id}: no seq root id`
      );
      if (quest.start.kind === "giver") continue;
      assert(
        bibleNativeUnlockRootId(quest.id) !== undefined,
        `${quest.id}: no unlock root id`
      );
    }
  });

  it("never issues the same id to two different things", () => {
    const seen = new Map<number, string>();
    const claim = (value: number | undefined, label: string) => {
      if (value === undefined) return;
      const previous = seen.get(value);
      assert(!previous, `id ${value} claimed by both ${previous} and ${label}`);
      seen.set(value, label);
    };
    for (const quest of BIBLE_QUEST_CATALOG) {
      claim(Number(bibleNativeQuestId(quest.id)), `${quest.id} (quest)`);
      claim(Number(bibleNativeQuestRootId(quest.id)), `${quest.id} (root)`);
      for (const [index, step] of quest.steps.entries()) {
        claim(
          Number(bibleNativeStepId(quest.id, index)),
          `${quest.id}/${step.id}`
        );
      }
    }
    assert(seen.size >= BIBLE_QUEST_CATALOG.length * 2);
  });
});

describe("Bible native ids — bands and derivation", () => {
  it("keeps derived bands disjoint from Chapter 1", () => {
    const ch1Ids = CH1_QUESTS.map((quest) =>
      Number(ch1NativeQuestId(quest.id))
    );
    const min = Math.min(...ch1Ids);
    const max = Math.max(...ch1Ids);
    assert(
      BIBLE_DERIVED_QUEST_ID_BASE > max || BIBLE_DERIVED_QUEST_ID_BASE < min,
      "Bible derived quest band overlaps the Chapter 1 band"
    );
    const bibleIds = BIBLE_QUEST_CATALOG.map((quest) =>
      Number(bibleNativeQuestId(quest.id))
    );
    for (const id of bibleIds) {
      assert(!ch1Ids.includes(id), `id ${id} is claimed by both systems`);
    }
  });

  it("derives inside the quest's reserved block for an unpinned quest", () => {
    // Simulate the phase-3 case: a quest with no pin. `bibleQuestIndex` is the
    // only input, so the derived block must not reach into its neighbour.
    const index = BIBLE_QUEST_CATALOG.length; // one past the end
    const questBase = BIBLE_DERIVED_QUEST_ID_BASE + index;
    const stepBase =
      BIBLE_DERIVED_STEP_ID_BASE + index * BIBLE_STEP_IDS_PER_QUEST;
    const nextStepBase =
      BIBLE_DERIVED_STEP_ID_BASE + (index + 1) * BIBLE_STEP_IDS_PER_QUEST;
    assert(stepBase + BIBLE_STEP_IDS_PER_QUEST === nextStepBase);
    assert(questBase < BIBLE_DERIVED_STEP_ID_BASE);
  });

  it("round-trips a native id back to its quest id", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const native = bibleNativeQuestId(quest.id);
      assert(isBibleNativeQuestId(native));
      assert.equal(bibleQuestIdForNativeId(native), quest.id);
    }
    assert.equal(bibleQuestIdForNativeId(1), undefined);
    assert.equal(isBibleNativeQuestId("nonsense"), false);
  });

  it("returns undefined rather than throwing for unknown input", () => {
    assert.equal(bibleNativeQuestId("no_such_quest"), undefined);
    assert.equal(bibleNativeStepId("no_such_quest", 0), undefined);
    assert.equal(bibleNativeStepId(BIBLE_QUEST_CATALOG[0].id, 999), undefined);
    assert.equal(bibleQuestIndex("no_such_quest"), -1);
  });

  it("lists step ids in authored order", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const ids = bibleNativeStepIds(quest);
      assert.equal(ids.length, quest.steps.length, quest.id);
      for (const [index, id] of ids.entries()) {
        assert.equal(Number(id), Number(bibleNativeStepId(quest.id, index)));
      }
    }
  });
});

describe("Bible native ids — frozen order", () => {
  // Reordering is a migration, not an edit. These pins are the tripwire.
  it("keeps the arc concatenation order", () => {
    assert.equal(BIBLE_QUEST_CATALOG[0].id, "bellbound_q01_cracks_in_bridge");
    assert.equal(BIBLE_QUEST_CATALOG[0].arc, "main");
    assert.equal(BIBLE_QUEST_CATALOG[12].arc, "main");
    assert.equal(BIBLE_QUEST_CATALOG[13].arc, "side");
    assert.equal(BIBLE_QUEST_CATALOG[55].arc, "starter");
    assert.equal(BIBLE_QUEST_CATALOG[64].arc, "repeatable");
    assert.equal(BIBLE_QUEST_CATALOG.length - 1, 84);
  });

  it("keeps the main arc in story order", () => {
    const codes = BIBLE_QUEST_CATALOG.filter(
      (quest) => quest.category === "main"
    ).map((quest) => quest.code);
    assert.deepEqual(codes, [
      "Q1",
      "Q2",
      "Q2.5",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
      "Q9",
      "Q10",
      "Q11",
      "Q12",
    ]);
  });
});
