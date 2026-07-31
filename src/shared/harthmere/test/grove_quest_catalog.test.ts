/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_QUEST_CATALOG_CONTRACTS
//
// Shape, ids, gate and the giver reassignment, over the real authored data.

import assert from "assert";
import {
  GROVE_FOUNTAIN_LESSON_IDS,
  GROVE_QUEST_CATALOG,
  GROVE_QUESTS_BY_ARC,
  groveCompletedFountainLessonCount,
  groveQuest,
  groveQuestIdsForGiver,
  groveQuestIndex,
} from "../grove/grove_quest_catalog";
import {
  GROVE_DERIVED_QUEST_ID_BASE,
  groveNativeQuestId,
  groveNativeQuestRootId,
  groveNativeStepId,
  groveQuestIdForNativeId,
} from "../grove/grove_quest_ids";
import {
  GROVE_QUEST_ID_PINS,
  GROVE_STEP_ID_PINS,
} from "../grove/grove_quest_id_pins";
import {
  groveQuestGate,
  groveQuestGateReasons,
  groveQuestOfferability,
  type GroveGateContext,
} from "../grove/grove_quest_gate";
import {
  allGroveNativeQuestBiscuits,
  groveQuestBiscuit,
  groveQuestIsGateEnforced,
} from "../grove/grove_native_quests";
import { groveQuestGiverId } from "../grove/grove_quest_schema";
import { bibleNativeQuestId } from "../bible/bible_quest_ids";
import { BIBLE_QUEST_CATALOG } from "../bible/bible_quest_catalog";
import { ch1NativeQuestId } from "../ch1_native_quests";
import { CH1_QUESTS } from "../ch1_quests";

const ARCS = ["fountain", "graduation", "neighbor", "story", "economy"];
const CATEGORIES = [
  "fountain_lesson",
  "road_graduation",
  "road_neighbor",
  "road_story",
];

function context(overrides: Partial<GroveGateContext> = {}): GroveGateContext {
  return {
    completedQuestIds: new Set<string>(),
    acceptedQuestIds: new Set<string>(),
    ...overrides,
  };
}

describe("Grove catalog — shape", () => {
  it("holds the authored 51 quests and 255 objectives", () => {
    assert.equal(GROVE_QUEST_CATALOG.length, 51);
    const steps = GROVE_QUEST_CATALOG.reduce(
      (sum, quest) => sum + quest.steps.length,
      0
    );
    assert.equal(steps, 255);
  });

  it("assembles from the five arc modules with no loss", () => {
    const fromArcs = Object.values(GROVE_QUESTS_BY_ARC).reduce(
      (sum, quests) => sum + quests.length,
      0
    );
    assert.equal(fromArcs, GROVE_QUEST_CATALOG.length);
    assert.equal(GROVE_QUESTS_BY_ARC.fountain.length, 13);
    assert.equal(GROVE_QUESTS_BY_ARC.graduation.length, 1);
    assert.equal(GROVE_QUESTS_BY_ARC.neighbor.length, 3);
    assert.equal(GROVE_QUESTS_BY_ARC.story.length, 19);
    assert.equal(GROVE_QUESTS_BY_ARC.economy.length, 15);
  });

  it("keeps every enum closed and every id unique", () => {
    const ids = new Set(GROVE_QUEST_CATALOG.map((quest) => quest.id));
    assert.equal(ids.size, GROVE_QUEST_CATALOG.length);
    for (const quest of GROVE_QUEST_CATALOG) {
      assert(ARCS.includes(quest.arc), `${quest.id}: ${quest.arc}`);
      assert(
        CATEGORIES.includes(quest.category),
        `${quest.id}: ${quest.category}`
      );
      assert(quest.steps.length > 0, `${quest.id} has no objectives`);
      assert(quest.title.length > 0, quest.id);
      assert(quest.sampleDialogue.length > 0, quest.id);
    }
  });

  // The retired shape stored these as three positionally-indexed parallel
  // arrays whose lengths were kept in sync only by a hand-written test.
  // Collapsing them into one object per step makes the invariant structural.
  it("gives every objective a label, trigger and marker in one object", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      for (const [position, step] of quest.steps.entries()) {
        assert.equal(step.index, position, `${quest.id}/${step.id}`);
        assert(step.label.length > 0, `${quest.id}/${step.id}: no label`);
        assert(step.trigger.length > 0, `${quest.id}/${step.id}: no trigger`);
        assert(step.markerId.length > 0, `${quest.id}/${step.id}: no marker`);
      }
    }
  });
});

describe("Grove native ids", () => {
  it("resolves every quest and step to its already-issued pin", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      const pinned = GROVE_QUEST_ID_PINS[quest.id];
      assert(pinned !== undefined, `${quest.id}: no pin`);
      assert.equal(
        Number(groveNativeQuestId(quest.id)),
        pinned,
        `${quest.id}: id moved — this orphans live player progress`
      );
      assert(
        groveNativeQuestRootId(quest.id) !== undefined,
        `${quest.id}: no seq root`
      );
      for (const step of quest.steps) {
        // Grove pins are keyed BY INDEX, not by authored objective id.
        const key = `${quest.id}:objective:${step.index}`;
        const stepPin = GROVE_STEP_ID_PINS[key];
        assert(stepPin !== undefined, `${key}: no pin`);
        assert.equal(Number(groveNativeStepId(quest.id, step.index)), stepPin);
      }
    }
  });

  it("keeps id bands disjoint from Bible and Chapter 1", () => {
    const grove = new Set(
      GROVE_QUEST_CATALOG.map((quest) => Number(groveNativeQuestId(quest.id)))
    );
    for (const quest of BIBLE_QUEST_CATALOG) {
      assert(
        !grove.has(Number(bibleNativeQuestId(quest.id))),
        `${quest.id} collides with a Grove quest id`
      );
    }
    for (const quest of CH1_QUESTS) {
      assert(
        !grove.has(Number(ch1NativeQuestId(quest.id))),
        `${quest.id} collides with a Grove quest id`
      );
    }
    assert(GROVE_DERIVED_QUEST_ID_BASE > 8_763_999_999_999_999);
  });

  it("round-trips a native id back to its quest id", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      assert.equal(
        groveQuestIdForNativeId(groveNativeQuestId(quest.id)),
        quest.id
      );
    }
    assert.equal(groveQuestIdForNativeId(1), undefined);
  });

  it("returns undefined rather than throwing for unknown input", () => {
    assert.equal(groveNativeQuestId("no_such_quest"), undefined);
    assert.equal(groveNativeStepId("no_such_quest", 0), undefined);
    assert.equal(groveQuestIndex("no_such_quest"), -1);
  });

  it("keeps the arc concatenation order frozen", () => {
    assert.equal(GROVE_QUEST_CATALOG[0].arc, "fountain");
    assert.equal(GROVE_QUEST_CATALOG[13].arc, "graduation");
    assert.equal(GROVE_QUEST_CATALOG[14].arc, "neighbor");
    assert.equal(GROVE_QUEST_CATALOG[17].arc, "story");
    assert.equal(GROVE_QUEST_CATALOG[36].arc, "economy");
  });
});

describe("Grove native projection", () => {
  const biscuits = allGroveNativeQuestBiscuits();

  it("projects every quest exactly once with one leaf per objective", () => {
    assert.equal(biscuits.length, GROVE_QUEST_CATALOG.length);
    for (const [index, quest] of GROVE_QUEST_CATALOG.entries()) {
      const biscuit = biscuits[index];
      assert.equal(biscuit.id, groveNativeQuestId(quest.id));
      assert.equal(biscuit.trigger?.kind, "seq");
      if (biscuit.trigger?.kind !== "seq") continue;
      assert.equal(biscuit.trigger.triggers.length, quest.steps.length);
      for (const [i, leaf] of biscuit.trigger.triggers.entries()) {
        assert.equal(leaf.id, groveNativeStepId(quest.id, i));
        if (leaf.kind !== "event") continue;
        assert.equal(leaf.eventKind, "harthmereQuestProgress");
      }
    }
  });

  it("predicates every leaf on its own (challengeId, stepId) pair", () => {
    for (const biscuit of biscuits) {
      if (biscuit.trigger?.kind !== "seq") continue;
      for (const leaf of biscuit.trigger.triggers) {
        if (leaf.kind !== "event") continue;
        const fields = (leaf.predicate as any).fields as Array<[string, any]>;
        assert.deepEqual(
          fields.map(([key]) => key),
          ["challengeId", "stepId"]
        );
        assert.equal(fields[0][1].value, biscuit.id);
        assert.equal(fields[1][1].value, leaf.id);
      }
    }
  });

  it("projects only the completed-prerequisite unlock natively", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      const unlock = groveQuestBiscuit(quest).unlock;
      if (quest.start.kind === "after") {
        assert.equal(unlock?.kind, "all", quest.id);
        if (unlock?.kind !== "all") continue;
        const leaf = unlock.triggers[0];
        assert.equal(leaf.kind, "challengeComplete");
        if (leaf.kind !== "challengeComplete") continue;
        assert.equal(leaf.challenge, groveNativeQuestId(quest.start.questId));
      } else {
        assert.equal(
          unlock,
          undefined,
          `${quest.id}: ${quest.start.kind} must be gate-enforced, not projected`
        );
      }
    }
  });

  it("marks every Grove quest once-only", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      assert.equal(groveQuestBiscuit(quest).repeatableCadence, "never");
    }
  });
});

describe("Grove gate", () => {
  it("opens an ungated quest immediately", () => {
    const plain = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "giver"
    )!;
    assert.equal(groveQuestGate(plain, context()).ok, true);
  });

  it("blocks and then opens a completed-prerequisite quest", () => {
    const gated = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "after"
    );
    if (!gated || gated.start.kind !== "after") return;
    assert(
      groveQuestGateReasons(groveQuestGate(gated, context())).includes(
        "missing_prerequisite"
      )
    );
    assert.equal(
      groveQuestGate(
        gated,
        context({ completedQuestIds: new Set([gated.start.questId]) })
      ).ok,
      true
    );
  });

  it("accepts either acceptance or completion for an after_accepted quest", () => {
    const gated = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "after_accepted"
    );
    if (!gated || gated.start.kind !== "after_accepted") return;
    const required = gated.start.questId;
    assert(
      groveQuestGateReasons(groveQuestGate(gated, context())).includes(
        "prerequisite_not_accepted"
      )
    );
    assert.equal(
      groveQuestGate(gated, context({ acceptedQuestIds: new Set([required]) }))
        .ok,
      true
    );
    // Completing it must also satisfy the check — otherwise finishing the
    // prerequisite would lock the follow-up forever.
    assert.equal(
      groveQuestGate(gated, context({ completedQuestIds: new Set([required]) }))
        .ok,
      true
    );
  });

  it("counts fountain lessons for the graduation gate", () => {
    const graduation = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "after_fountain_lessons"
    );
    assert(graduation, "no graduation quest");
    if (graduation.start.kind !== "after_fountain_lessons") return;
    const required = graduation.start.minCompleted;
    const blocked = groveQuestGate(graduation, context());
    assert(
      groveQuestGateReasons(blocked).includes("not_enough_fountain_lessons")
    );
    const enough = new Set(GROVE_FOUNTAIN_LESSON_IDS.slice(0, required));
    assert.equal(
      groveQuestGate(graduation, context({ completedQuestIds: enough })).ok,
      true
    );
    assert.equal(groveCompletedFountainLessonCount(enough), required);
  });

  it("never re-offers a completed quest", () => {
    const quest = GROVE_QUEST_CATALOG[0];
    const result = groveQuestGate(
      quest,
      context({ completedQuestIds: new Set([quest.id]) })
    );
    assert(groveQuestGateReasons(result).includes("already_completed"));
  });

  it("surfaces a lesson-gated quest but hides a prerequisite-gated one", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      const { offer, surfaceLocked, result } = groveQuestOfferability(
        quest,
        context()
      );
      if (offer) continue;
      const reasons = groveQuestGateReasons(result);
      if (reasons.includes("missing_prerequisite")) {
        assert.equal(surfaceLocked, false, `${quest.id} leaked a locked quest`);
      }
      if (
        reasons.includes("not_enough_fountain_lessons") &&
        !reasons.includes("missing_prerequisite")
      ) {
        assert.equal(surfaceLocked, true, quest.id);
      }
    }
  });

  it("reports unknown_quest rather than throwing", () => {
    const result = groveQuestGate(undefined, context());
    assert.deepEqual(groveQuestGateReasons(result), ["unknown_quest"]);
  });

  it("marks exactly the non-native unlock kinds as gate-enforced", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      assert.equal(
        groveQuestIsGateEnforced(quest),
        quest.start.kind === "after_fountain_lessons" ||
          quest.start.kind === "after_accepted",
        quest.id
      );
    }
  });
});

describe("Grove givers", () => {
  it("derives the giver index from data", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      assert(
        groveQuestIdsForGiver(groveQuestGiverId(quest)).includes(quest.id),
        `${quest.id} is orphaned from its giver`
      );
    }
  });

  it("gives every quest a giver", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      assert(groveQuestGiverId(quest).length > 0, quest.id);
    }
  });
});

describe("Grove fountain lessons", () => {
  it("matches the authored lesson set", () => {
    assert.equal(GROVE_FOUNTAIN_LESSON_IDS.length, 13);
    for (const lessonId of GROVE_FOUNTAIN_LESSON_IDS) {
      const lesson = groveQuest(lessonId);
      assert(lesson, `${lessonId} missing`);
      assert.equal(lesson.countsAsFountainLesson, true);
    }
  });

  it("counts only lessons, not every completed quest", () => {
    const mixed = new Set([
      ...GROVE_FOUNTAIN_LESSON_IDS.slice(0, 3),
      "grove_road_graduation",
    ]);
    assert.equal(groveCompletedFountainLessonCount(mixed), 3);
  });
});
