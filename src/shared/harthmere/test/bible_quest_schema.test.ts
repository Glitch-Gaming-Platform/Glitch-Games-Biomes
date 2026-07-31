/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_QUEST_SCHEMA_CONTRACTS
//
// Replaces the retired catalog's prose `activationTestCases`,
// `testContract.useCases` and `testContract.edgeCases` — roughly a third of the
// shipped catalog bytes — with assertions that actually run.
//
// Every count below is measured against the authored data, not estimated, so a
// row silently disappearing during the phase-3 bulk conversion fails here
// rather than in a browser.

import assert from "assert";
import {
  BIBLE_QUEST_CATALOG,
  BIBLE_QUESTS_BY_ARC,
  bibleCompletedQuestIds,
  bibleQuest,
  bibleQuestIdsForGiver,
  bibleQuestsByCategory,
  bibleStarterTwinClientId,
} from "../bible/bible_quest_catalog";
import {
  bibleQuestAutoStarts,
  bibleQuestGiverId,
  type BibleQuestDef,
} from "../bible/bible_quest_schema";

const CATEGORIES = ["main", "side", "side_hidden", "starter", "repeatable"];
const STEP_TYPES = ["talk", "inspect", "choice", "combat"];
const FAILURES = ["player_too_far", "wrong_phase", "duplicate_submission"];
const TIMES = ["dawn", "day", "dusk", "night"];
const WEATHER = ["clear", "rain", "storm", "fog", "snow"];

describe("Bible quest catalog — shape", () => {
  it("holds the authored 85 quests and 340 objectives", () => {
    assert.equal(BIBLE_QUEST_CATALOG.length, 85);
    const steps = BIBLE_QUEST_CATALOG.reduce(
      (sum, quest) => sum + quest.steps.length,
      0
    );
    assert.equal(steps, 340);
  });

  it("assembles from the four arc modules with no loss or duplication", () => {
    const fromArcs = Object.values(BIBLE_QUESTS_BY_ARC).reduce(
      (sum, quests) => sum + quests.length,
      0
    );
    assert.equal(fromArcs, BIBLE_QUEST_CATALOG.length);
    assert.equal(BIBLE_QUESTS_BY_ARC.main.length, 13);
    assert.equal(BIBLE_QUESTS_BY_ARC.side.length, 42);
    assert.equal(BIBLE_QUESTS_BY_ARC.starter.length, 9);
    assert.equal(BIBLE_QUESTS_BY_ARC.repeatable.length, 21);
  });

  it("has unique quest ids and unique step ids within each quest", () => {
    const questIds = new Set(BIBLE_QUEST_CATALOG.map((quest) => quest.id));
    assert.equal(questIds.size, BIBLE_QUEST_CATALOG.length);
    for (const quest of BIBLE_QUEST_CATALOG) {
      const stepIds = new Set(quest.steps.map((step) => step.id));
      assert.equal(stepIds.size, quest.steps.length, quest.id);
    }
  });

  it("keeps every enum closed", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      assert(
        CATEGORIES.includes(quest.category),
        `${quest.id}: ${quest.category}`
      );
      assert(
        ["once", "daily", "weekly"].includes(quest.repeatability),
        quest.id
      );
      for (const value of quest.gate.timeOfDay) {
        assert(TIMES.includes(value), `${quest.id}: ${value}`);
      }
      for (const value of quest.gate.weather) {
        assert(WEATHER.includes(value), `${quest.id}: ${value}`);
      }
      for (const hour of quest.gate.activeHours) {
        assert(
          Number.isInteger(hour) && hour >= 0 && hour <= 23,
          `${quest.id}: hour ${hour}`
        );
      }
      for (const step of quest.steps) {
        assert(STEP_TYPES.includes(step.type), `${quest.id}/${step.id}`);
        for (const failure of step.failureCases) {
          assert(FAILURES.includes(failure), `${quest.id}/${step.id}`);
        }
      }
    }
  });

  it("never ships an empty quest, dialogue state, or reward preview", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      assert(quest.steps.length > 0, `${quest.id} has no objectives`);
      assert(quest.title.length > 0, `${quest.id} has no title`);
      assert(quest.premise.length > 0, `${quest.id} has no premise`);
      assert(
        quest.rewards.previewText.length > 0,
        `${quest.id} reward preview`
      );
      for (const state of ["offer", "active", "ready", "complete"] as const) {
        assert(
          quest.dialogue[state].length > 0,
          `${quest.id} missing "${state}" dialogue`
        );
      }
    }
  });

  it("gives every quest a giver or a discovery, never neither", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const hasGiver = bibleQuestGiverId(quest) !== undefined;
      const discoverable = quest.start.kind === "world_trigger";
      const autoStarts = bibleQuestAutoStarts(quest);
      assert(
        hasGiver || discoverable || autoStarts,
        `${quest.id}: no giver, no discovery, and does not auto-start — ` +
          `unreachable by any means`
      );
    }
  });
});

describe("Bible quest catalog — start kinds", () => {
  it("matches the measured authored distribution", () => {
    const counts = { giver: 0, after: 0, world_trigger: 0 };
    for (const quest of BIBLE_QUEST_CATALOG) counts[quest.start.kind] += 1;
    assert.equal(counts.after, 13, "13 quests carry a prerequisite");
    assert.equal(
      counts.world_trigger,
      3,
      "3 side_hidden quests are discovered"
    );
    assert.equal(counts.giver, 69);
  });

  it("separates gated-and-offered from gated-and-auto-starting", () => {
    const gated = BIBLE_QUEST_CATALOG.filter(
      (quest) => quest.start.kind === "after"
    );
    const offered = gated.filter((quest) => bibleQuestGiverId(quest));
    const auto = gated.filter(bibleQuestAutoStarts);
    // These are orthogonal, which the retired `activeRules` shape obscured.
    assert.equal(offered.length, 9);
    assert.equal(auto.length, 4);
    assert.deepEqual(auto.map((quest) => quest.id).sort(), [
      "bellbound_q08_voices_in_stone",
      "bellbound_q09_veins_of_wyrm",
      "bellbound_q10_bellbinders_tomb",
      "bellbound_q12_thaedryn_bellbound",
    ]);
  });

  it("points every prerequisite at a quest that exists", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (quest.start.kind !== "after") continue;
      assert(
        bibleQuest(quest.start.questId),
        `${quest.id}: prerequisite "${quest.start.questId}" is not in the catalog`
      );
    }
  });

  it("has no prerequisite cycles", () => {
    for (const quest of BIBLE_QUEST_CATALOG) {
      const seen = new Set<string>([quest.id]);
      let cursor: BibleQuestDef | undefined = quest;
      while (cursor && cursor.start.kind === "after") {
        const next: string = cursor.start.questId;
        assert(!seen.has(next), `${quest.id}: prerequisite cycle at ${next}`);
        seen.add(next);
        cursor = bibleQuest(next);
      }
    }
  });
});

describe("Bible quest catalog — givers", () => {
  it("derives the giver index from data rather than a hand-written table", () => {
    const givers = new Set<string>();
    for (const quest of BIBLE_QUEST_CATALOG) {
      if (quest.hidden || quest.category === "starter") continue;
      const giverId = bibleQuestGiverId(quest);
      if (giverId) givers.add(giverId);
    }
    for (const giverId of givers) {
      assert(
        bibleQuestIdsForGiver(giverId).length > 0,
        `giver "${giverId}" is orphaned — this is the exact gap the retired ` +
          `HARTHMERE_QUEST_DIALOGUE_LINKS had for 13 of 21 givers`
      );
    }
    // Regression pin: the hand-written table covered 8.
    assert(givers.size > 8, `only ${givers.size} givers indexed`);
  });

  it("never offers a starter twin from an NPC", () => {
    for (const quest of bibleQuestsByCategory("starter")) {
      const giverId = bibleQuestGiverId(quest);
      if (!giverId) continue;
      assert(
        !bibleQuestIdsForGiver(giverId).includes(quest.id),
        `${quest.id}: offered by an NPC as well as by its client twin — ` +
          `completing one copy would not complete the other`
      );
    }
  });

  it("folds a completed client twin into the bible id space", () => {
    const starter = bibleQuestsByCategory("starter")[0];
    const twin = bibleStarterTwinClientId(starter.id);
    assert(twin, "starter has no client twin id");
    const folded = bibleCompletedQuestIds([twin]);
    assert(
      folded.has(starter.id),
      `finishing the client copy "${twin}" must satisfy a prerequisite on ` +
        `"${starter.id}"`
    );
  });
});
