/// <reference types="mocha" />

import assert from "assert";
import {
  CH1_COMPLETION_DIALOGUE,
  CH1_OBJECTIVE_DIALOGUE,
  ch1DialogueWithExitGuidanceForTest,
  ch1DialogueSentenceCount,
  ch1DialogueWordCount,
  ch1ObjectiveDialogue,
  ch1ObjectiveExitGuidanceForTest,
} from "@/server/harthmere/ch1_dialogue";
import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";
import { isHarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";
import { CH1_FORBIDDEN_PRE_ACT6_SUBSTRINGS } from "@/shared/harthmere/ch1_ids";
import { ch1ObjectiveChoiceSpec } from "@/shared/harthmere/ch1_live_story";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import { defaultCh1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import { ch1VoiceActorForSpeaker } from "@/shared/harthmere/ch1_voice";

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
      if (entry.quest.act >= 6) continue;
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

  it("gives every human NPC page a valid expression and excludes robots and narration", () => {
    const sequences = [
      ...Object.values(CH1_OBJECTIVE_DIALOGUE),
      ...Object.values(CH1_COMPLETION_DIALOGUE).flatMap((byChoice) =>
        Object.values(byChoice)
      ),
    ];
    let humanPages = 0;
    let robotPages = 0;
    let narratedPages = 0;
    for (const sequence of sequences) {
      for (const page of sequence.pages) {
        const actor = ch1VoiceActorForSpeaker(page.speaker);
        if (actor?.kind === "human") {
          humanPages += 1;
          assert.ok(
            page.expression && isHarthmereCinematicExpression(page.expression),
            `${page.speaker}: ${page.text}`
          );
        } else {
          if (actor?.kind === "robot") robotPages += 1;
          else narratedPages += 1;
          assert.equal(
            page.expression,
            undefined,
            `${page.speaker} must not perform a human expression`
          );
        }
      }
    }
    assert.equal(humanPages, 102);
    assert.equal(robotPages, 5);
    assert.equal(narratedPages, 28);
  });

  it("preserves expressions on routed conversations and generated handoffs", () => {
    const runtime = defaultCh1LiveGateRuntimeState();
    const testimony = ch1ObjectiveDialogue("collect_testimonies", { runtime });
    assert.ok(testimony?.pages[0]?.expression);
    const answer = ch1ObjectiveDialogue("the_three_answers", {
      questId: "ch1_a3_q01_a_button_in_the_sand",
      runtime,
    });
    assert.equal(answer?.pages[0]?.expression, "stop");

    const dialogue = CH1_OBJECTIVE_DIALOGUE.wake_up;
    const presented = ch1DialogueWithExitGuidanceForTest(
      dialogue,
      "Next task: eat breakfast. Go to the table."
    );
    assert.equal(
      presented?.pages.at(-1)?.expression,
      dialogue.pages.at(-1)?.expression
    );
  });

  it("ends every Chapter 1 conversation with the next task and destination", () => {
    const runtime = defaultCh1LiveGateRuntimeState();
    const failures: string[] = [];
    for (const { quest, step } of steps) {
      const dialogue = CH1_OBJECTIVE_DIALOGUE[step.id];
      if (!dialogue) continue;
      const guidance = ch1ObjectiveExitGuidanceForTest({
        questId: quest.id,
        stepId: step.id,
        context: { runtime },
      });
      const presented = ch1DialogueWithExitGuidanceForTest(
        dialogue,
        guidance,
        step.trigger === "dialogue_choice"
      );
      const exit = presented?.pages.at(-1)?.text ?? "";
      if (
        !/^(Make your choice here\. )?(?:Next task:|Chapter 1 is complete\.)/.test(
          exit
        )
      ) {
        failures.push(`${quest.id}/${step.id}: missing next-task exit`);
      }
      if (!/Go to |Chapter 1 is complete/.test(exit)) {
        failures.push(`${quest.id}/${step.id}: missing destination`);
      }
    }
    assert.deepEqual(failures, []);
  });

  it("points multi-person conversations to the next live person", () => {
    const runtime = defaultCh1LiveGateRuntimeState();
    assert.match(
      ch1ObjectiveExitGuidanceForTest({
        questId: "ch1_a2_q01_the_night_you_came",
        stepId: "collect_testimonies",
        context: { runtime },
      }),
      /Helsa/
    );
    assert.match(
      ch1ObjectiveExitGuidanceForTest({
        questId: "ch1_a3_q01_a_button_in_the_sand",
        stepId: "the_three_answers",
        context: { runtime },
      }),
      /Arbiter Cressa Vane/
    );
  });
});
