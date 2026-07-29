/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_GATE_ENFORCEMENT
//
// THE HOLE THIS FILE COVERS
// -------------------------
// Two of Grove's three unlock kinds are deliberately NOT projected as native
// unlock triggers:
//
//   after_fountain_lessons  "any N of a set" — a native boolean tree over 13
//                           lessons would need every 4-subset (715 branches)
//   after_accepted          gates on ACCEPTANCE; unlock triggers fire on
//                           completion events, so it is inexpressible
//
// The consequence is easy to miss and severe: their native challenges are
// AVAILABLE from the first second of the game. Nothing in the engine objects.
// The only thing standing between a brand-new player and the road graduation
// is that `groveQuestGate` refuses to offer it.
//
// So a bypass here is not a cosmetic bug — it opens the graduation, and with
// it the road-neighbour chain, before a single lesson is taught. These tests
// assert the gate is consulted, that it refuses, and that no surface offers
// such a quest without asking.

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  GROVE_QUEST_CATALOG,
  GROVE_FOUNTAIN_LESSON_IDS,
  groveQuest,
} from "../grove/grove_quest_catalog";
import {
  groveQuestGate,
  groveQuestGateReasons,
  groveQuestOfferability,
  type GroveGateContext,
} from "../grove/grove_quest_gate";
import {
  groveQuestBiscuit,
  groveQuestIsGateEnforced,
} from "../grove/grove_native_quests";

const ROOT = path.resolve(__dirname, "../../../..");

function emptyContext(): GroveGateContext {
  return {
    completedQuestIds: new Set<string>(),
    acceptedQuestIds: new Set<string>(),
  };
}

const GATE_ENFORCED = GROVE_QUEST_CATALOG.filter(groveQuestIsGateEnforced);

describe("Grove gate enforcement — the unprojected unlock kinds", () => {
  it("has gate-enforced quests to protect", () => {
    // If this ever hits zero the rest of the file stops proving anything.
    assert(
      GATE_ENFORCED.length > 0,
      "no gate-enforced quests — did an unlock kind become native?"
    );
    for (const quest of GATE_ENFORCED) {
      assert(
        quest.start.kind === "after_fountain_lessons" ||
          quest.start.kind === "after_accepted",
        `${quest.id}: unexpected gate-enforced kind ${quest.start.kind}`
      );
    }
  });

  // This is the dangerous property, asserted head-on: the ENGINE does not
  // object to these quests. That is expected and correct, and it is exactly
  // why the gate must be consulted.
  it("leaves the native challenge unguarded, by design", () => {
    for (const quest of GATE_ENFORCED) {
      assert.equal(
        groveQuestBiscuit(quest).unlock,
        undefined,
        `${quest.id} projects a native unlock — if that is intentional, this ` +
          `test and grove_native_quests.ts must be updated together`
      );
    }
  });

  it("refuses every gate-enforced quest to a brand-new player", () => {
    for (const quest of GATE_ENFORCED) {
      const result = groveQuestGate(quest, emptyContext());
      assert.equal(
        result.ok,
        false,
        `${quest.id} is offerable at zero progress — the native challenge is ` +
          `already available, so the gate is the ONLY thing stopping it`
      );
    }
  });

  it("refuses the graduation until the lesson count is genuinely met", () => {
    const graduation = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "after_fountain_lessons"
    );
    assert(graduation);
    if (graduation.start.kind !== "after_fountain_lessons") return;
    const required = graduation.start.minCompleted;

    // One short must still refuse. Off-by-one here opens the graduation early.
    const oneShort = new Set(GROVE_FOUNTAIN_LESSON_IDS.slice(0, required - 1));
    assert(
      groveQuestGateReasons(
        groveQuestGate(graduation, {
          completedQuestIds: oneShort,
          acceptedQuestIds: new Set(),
        })
      ).includes("not_enough_fountain_lessons"),
      `${required - 1} lessons must not satisfy a ${required}-lesson gate`
    );

    // Exactly enough must pass.
    assert.equal(
      groveQuestGate(graduation, {
        completedQuestIds: new Set(
          GROVE_FOUNTAIN_LESSON_IDS.slice(0, required)
        ),
        acceptedQuestIds: new Set(),
      }).ok,
      true
    );
  });

  it("does not let non-lesson completions satisfy the lesson count", () => {
    // Completing 20 unrelated Grove quests must not graduate anyone.
    const graduation = GROVE_QUEST_CATALOG.find(
      (quest) => quest.start.kind === "after_fountain_lessons"
    )!;
    const nonLessons = GROVE_QUEST_CATALOG.filter(
      (quest) => !quest.countsAsFountainLesson
    ).map((quest) => quest.id);
    assert(nonLessons.length > 0);
    const result = groveQuestGate(graduation, {
      completedQuestIds: new Set(nonLessons),
      acceptedQuestIds: new Set(),
    });
    assert(
      groveQuestGateReasons(result).includes("not_enough_fountain_lessons"),
      "non-lesson quests satisfied the graduation gate"
    );
  });

  it("does not let mere acceptance satisfy a completion gate", () => {
    for (const quest of GROVE_QUEST_CATALOG) {
      if (quest.start.kind !== "after") continue;
      const result = groveQuestGate(quest, {
        completedQuestIds: new Set(),
        acceptedQuestIds: new Set([quest.start.questId]),
      });
      assert(
        groveQuestGateReasons(result).includes("missing_prerequisite"),
        `${quest.id}: accepting the prerequisite must not unlock it`
      );
    }
  });

  it("never surfaces a gate-enforced quest as offerable at zero progress", () => {
    for (const quest of GATE_ENFORCED) {
      const { offer } = groveQuestOfferability(quest, emptyContext());
      assert.equal(offer, false, `${quest.id} was offerable`);
    }
  });
});

describe("Grove gate enforcement — single enforcement point", () => {
  // A second implementation of the unlock rule is how the dialogue and the
  // graduation quietly disagree. The legacy `isSnapshotGroveQuestUnlocked`
  // used to carry its own three-branch switch; it now delegates.
  const RUNTIME = path.join(
    ROOT,
    "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx"
  );

  it("delegates the live unlock check to groveQuestGate", () => {
    const text = fs.readFileSync(RUNTIME, "utf8");
    assert(
      text.includes("groveQuestGate("),
      "the live runtime does not call groveQuestGate — the gate is not the " +
        "enforcement point"
    );
  });

  it("keeps no second copy of the unlock rule in the live runtime", () => {
    const text = fs.readFileSync(RUNTIME, "utf8");
    // The retired switch matched on these authored prerequisite kinds. Their
    // reappearance means someone re-implemented the rule locally.
    for (const legacyBranch of [
      'case "fountain_completion_count"',
      'case "quest_accepted"',
      'case "quest_completed"',
    ]) {
      assert(
        !text.includes(legacyBranch),
        `the live runtime still branches on ${legacyBranch} — that is a ` +
          `second implementation of the gate`
      );
    }
  });

  it("resolves the live giver list through the new catalog", () => {
    // The retired array still records Jackie as giver of the four reassigned
    // lessons. Filtering on `quest.giverNpcId` would leave the reassignment
    // invisible to dialogue while every catalog test passed.
    const text = fs.readFileSync(RUNTIME, "utf8");
    assert(
      text.includes("groveQuestIdsForGiver("),
      "the live runtime does not resolve givers through the catalog"
    );
  });
});

describe("Grove gate enforcement — reassigned lessons still gate correctly", () => {
  it("keeps the four reassigned lessons open to a new player", () => {
    // They are plain `giver` quests: moving them must not have introduced a
    // prerequisite, or the tutorial would not start.
    for (const questId of [
      "fountain_buttons_first",
      "tools_before_treasure",
      "fountain_hotbar_and_dropping",
      "fountain_first_recipe_torch",
    ]) {
      const quest = groveQuest(questId)!;
      assert.equal(quest.start.kind, "giver", questId);
      assert.equal(groveQuestGate(quest, emptyContext()).ok, true, questId);
    }
  });
});
