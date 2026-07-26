/// <reference types="mocha" />

import assert from "assert";
import { activeChapter1ObjectiveForTest } from "@/pages/api/harthmere/chapter1_progress";
import {
  ch1NativeQuestId,
  ch1NativeQuestStepId,
} from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

describe("Chapter 1 native progress API", () => {
  it("exposes only the first unfinished leaf of the active quest", () => {
    const quest = CH1_QUESTS[0];
    const challengeId = ch1NativeQuestId(quest.id)!;
    const fired = new Set<number>();
    let active = activeChapter1ObjectiveForTest({
      inProgress: new Set([challengeId]),
      fired: (_questId, stepId) => fired.has(stepId),
    });
    assert.equal(active?.step.id, quest.steps[0].id);
    fired.add(ch1NativeQuestStepId(quest.id, 0)!);
    active = activeChapter1ObjectiveForTest({
      inProgress: new Set([challengeId]),
      fired: (_questId, stepId) => fired.has(stepId),
    });
    assert.equal(active?.step.id, quest.steps[1].id);
  });

  it("never exposes a later quest while an earlier authored quest is active", () => {
    const first = CH1_QUESTS[0];
    const later = CH1_QUESTS[5];
    const active = activeChapter1ObjectiveForTest({
      inProgress: new Set([
        ch1NativeQuestId(later.id)!,
        ch1NativeQuestId(first.id)!,
      ]),
      fired: () => false,
    });
    assert.equal(active?.quest.id, first.id);
  });

  it("returns no action after every leaf is fired", () => {
    const quest = CH1_QUESTS[0];
    const active = activeChapter1ObjectiveForTest({
      inProgress: new Set([ch1NativeQuestId(quest.id)!]),
      fired: () => true,
    });
    assert.equal(active, undefined);
  });
});
