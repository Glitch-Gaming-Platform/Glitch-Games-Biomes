/// <reference types="mocha" />

import assert from "assert";
import {
  CH1_COMPLETION_DIALOGUE,
  CH1_OBJECTIVE_DIALOGUE,
  ch1DialogueSentenceCount,
  ch1DialogueWordCount,
} from "@/server/harthmere/ch1_dialogue";
import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";
import { CH1_FORBIDDEN_PRE_ACT6_SUBSTRINGS } from "@/shared/harthmere/ch1_ids";
import { ch1ObjectiveChoiceSpec } from "@/shared/harthmere/ch1_live_story";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

describe("Chapter 1 authored dialogue", () => {
  const steps = CH1_QUESTS.flatMap((quest) =>
    quest.steps.map((step) => ({ quest, step }))
  );
  const stepsById = new Map(steps.map((entry) => [entry.step.id, entry]));

  it("gives every authored dialogue choice a real option set", () => {
    const missing = steps
      .filter(({ step }) => step.trigger === "dialogue_choice")
      .filter(({ step }) => !ch1ObjectiveChoiceSpec(step))
      .map(({ quest, step }) => `${quest.id}/${step.id}`);
    assert.deepEqual(missing, []);
  });

  it("covers every explicit conversation or handover with dialogue or a cinematic", () => {
    const conversationalTriggers = new Set([
      "talk_npc",
      "dialogue_choice",
      "give_item",
    ]);
    const missing = steps
      .filter(({ step }) => conversationalTriggers.has(step.trigger))
      .filter(
        ({ step }) =>
          !CH1_OBJECTIVE_DIALOGUE[step.id] &&
          !step.cutsceneId &&
          !ch1ObjectiveChoiceSpec(step)
      )
      .map(({ quest, step }) => `${quest.id}/${step.id}`);
    assert.deepEqual(missing, []);
  });

  it("keeps every message screen to two short sentences", () => {
    const problems: string[] = [];
    const inspect = (scope: string, text: string) => {
      const sentences = ch1DialogueSentenceCount(text);
      const words = ch1DialogueWordCount(text);
      if (sentences > 2) problems.push(`${scope}: ${sentences} sentences`);
      if (words > 30) problems.push(`${scope}: ${words} words`);
    };
    for (const [stepId, dialogue] of Object.entries(CH1_OBJECTIVE_DIALOGUE)) {
      assert.ok(dialogue.pages.length > 0, `${stepId} has no dialogue pages`);
      dialogue.pages.forEach((page, index) =>
        inspect(`${stepId}/page-${index + 1}`, page.text)
      );
    }
    for (const [stepId, byChoice] of Object.entries(CH1_COMPLETION_DIALOGUE)) {
      for (const [choice, dialogue] of Object.entries(byChoice)) {
        assert.ok(
          dialogue.pages.length > 0,
          `${stepId}/${choice} has no completion pages`
        );
        dialogue.pages.forEach((page, index) =>
          inspect(`${stepId}/${choice}/page-${index + 1}`, page.text)
        );
      }
    }
    assert.deepEqual(problems, []);
  });

  it("keeps cinematic subtitle beats to two short sentences", () => {
    const problems: string[] = [];
    for (const [sceneId, factory] of CH1_SCENE_FACTORIES) {
      for (const shot of factory().shots) {
        for (const action of shot.actions ?? []) {
          if (action.kind !== "dialogue") continue;
          const sentences = ch1DialogueSentenceCount(action.text);
          const words = ch1DialogueWordCount(action.text);
          if (sentences > 2) {
            problems.push(`${sceneId}/${shot.id}: ${sentences} sentences`);
          }
          if (words > 30) {
            problems.push(`${sceneId}/${shot.id}: ${words} words`);
          }
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  it("keeps unrevealed Act 6 names out of pre-reveal dialogue", () => {
    const leaks: string[] = [];
    for (const [stepId, dialogue] of Object.entries(CH1_OBJECTIVE_DIALOGUE)) {
      const entry = stepsById.get(stepId);
      assert.ok(entry, `${stepId} is not an authored Chapter 1 step`);
      if (entry!.quest.act >= 6) continue;
      const wire = JSON.stringify(dialogue).toLowerCase();
      for (const forbidden of CH1_FORBIDDEN_PRE_ACT6_SUBSTRINGS) {
        if (wire.includes(forbidden.toLowerCase())) {
          leaks.push(`${stepId}: ${forbidden}`);
        }
      }
    }
    assert.deepEqual(leaks, []);
  });

  it("defines completion dialogue only for valid choices", () => {
    const invalid: string[] = [];
    for (const [stepId, byChoice] of Object.entries(CH1_COMPLETION_DIALOGUE)) {
      const entry = stepsById.get(stepId);
      if (!entry) {
        invalid.push(`${stepId}: unknown step`);
        continue;
      }
      const spec = ch1ObjectiveChoiceSpec(entry.step);
      if (!spec) {
        invalid.push(`${stepId}: no choice spec`);
        continue;
      }
      const optionIds = new Set(spec.options.map((option) => option.id));
      for (const choice of Object.keys(byChoice)) {
        if (!optionIds.has(choice)) invalid.push(`${stepId}: ${choice}`);
      }
    }
    assert.deepEqual(invalid, []);
  });
});
