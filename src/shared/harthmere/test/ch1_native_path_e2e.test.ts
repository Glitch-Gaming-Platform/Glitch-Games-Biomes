/// <reference types="mocha" />
//
// CHAPTER_1_NATIVE_PATH_END_TO_END
//
// Drives Chapter 1 through the progression the PLAYER actually uses.
//
// WHY THIS EXISTS
// `ch1_e2e_playthrough.test.ts` walks the narrative state machine in
// ch1_chapter.ts — `ch1AvailableQuestIds`, `requiresFlags`, act flags. That
// module has no production callers. The shipped path is completely different:
// a linear `challengeComplete` chain over the frozen CH1_QUESTS array
// (ch1_native_quests.ts) whose leaves are advanced one at a time by
// chapter1_progress.ts calling `ch1ApplyLiveObjectiveEffects`.
//
// So the chapter had a green end-to-end test for a model nobody plays, and none
// for the one they do. Both of the soft-locks found in the 2026-07-30 audit —
// entering a gate before its dungeon quest activated, and legally exiting the
// winter dungeon three steps early — were invisible to the narrative test by
// construction, because the narrative model does not have gates keyed off
// `highestReachedAct` or exits keyed off applied objective effects.
//
// This test uses no `?e2e=1` bypass and sets no flags directly. It replays every
// objective in native order through the real reducer.

import assert from "assert";
import {
  CH1_QUESTS,
  ch1DungeonFinalStepId,
} from "@/shared/harthmere/ch1_quests";
import {
  Ch1ObjectiveIncomplete,
  ch1ApplyLiveObjectiveEffects,
  ch1ObjectiveChoiceSpec,
  ch1TestimoniesRemaining,
} from "@/shared/harthmere/ch1_live_story";
import {
  defaultCh1LiveGateRuntimeState,
  type Ch1LiveGateRuntimeState,
} from "@/shared/harthmere/ch1_live_gate";
import { CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  ch1NativeQuestId,
  ch1NativeQuestStepId,
} from "@/shared/harthmere/ch1_native_quests";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";

/** The choice a player who wants to see the whole chapter would make. */
function choiceFor(stepId: string): string | undefined {
  const step = CH1_QUESTS.flatMap((q) => q.steps).find((s) => s.id === stepId);
  const spec = step && ch1ObjectiveChoiceSpec(step);
  if (!spec) return undefined;
  if (stepId === "choose_a_name") return "name:Wren";
  // Never "not yet" — that is the authored refusal and must not advance.
  const first = spec.options.find((option) => option.id !== "not_yet");
  return first?.id;
}

interface Run {
  runtime: Ch1LiveGateRuntimeState;
  /** Items the chapter has actually put in the player's hands. */
  inventory: Map<string, number>;
  presses: number;
}

function press(
  run: Run,
  questIndex: number,
  stepIndex: number,
  nowMs: number
): { fired: boolean; reason?: string } {
  const quest = CH1_QUESTS[questIndex];
  const step = quest.steps[stepIndex];
  // Gathering, jobs, and trading happen outside the chapter reducer. Supply
  // exactly the authored inventory evidence here so this E2E still exercises
  // the real consume/grant path without pretending Luis created raw materials.
  for (const requirement of step.inventoryRequirements ?? []) {
    run.inventory.set(
      requirement.itemId,
      Math.max(run.inventory.get(requirement.itemId) ?? 0, requirement.count)
    );
  }
  try {
    const effects = ch1ApplyLiveObjectiveEffects({
      runtime: run.runtime,
      quest,
      step,
      stepIndex,
      choice: choiceFor(step.id),
      nowMs,
    });
    // Mirror the endpoint: aggregate consumes are checked against the real
    // inventory BEFORE anything commits.
    const requiredCounts = new Map<string, number>();
    for (const itemId of effects.itemConsumes) {
      requiredCounts.set(itemId, (requiredCounts.get(itemId) ?? 0) + 1);
    }
    for (const [itemId, required] of requiredCounts) {
      const held = run.inventory.get(itemId) ?? 0;
      assert.ok(
        held >= required,
        `${quest.id}/${step.id} consumes ${required} ${itemId}, held ${held}`
      );
    }
    for (const itemId of effects.itemConsumes) {
      run.inventory.set(itemId, (run.inventory.get(itemId) ?? 0) - 1);
    }
    for (const itemId of effects.itemGrants) {
      run.inventory.set(itemId, (run.inventory.get(itemId) ?? 0) + 1);
    }
    run.runtime = effects.runtime;
    run.presses += 1;
    return { fired: true };
  } catch (error) {
    if (error instanceof Ch1ObjectiveIncomplete) {
      run.runtime = error.runtime;
      run.presses += 1;
      return { fired: false, reason: error.message };
    }
    throw error;
  }
}

describe("chapter 1 native path end to end", () => {
  it("completes every objective through the shipped reducer", () => {
    const run: Run = {
      runtime: defaultCh1LiveGateRuntimeState(),
      inventory: new Map(),
      presses: 0,
    };
    let nowMs = 1_000;
    for (const [questIndex, quest] of CH1_QUESTS.entries()) {
      for (const [stepIndex, step] of quest.steps.entries()) {
        // A step may legitimately need several presses (the twelve accounts).
        let guard = 0;
        let fired = false;
        let lastReason: string | undefined;
        while (!fired && guard < 40) {
          guard += 1;
          nowMs += 1_000;
          const result = press(run, questIndex, stepIndex, nowMs);
          fired = result.fired;
          lastReason = result.reason;
        }
        assert.ok(
          fired,
          `${quest.id}/${step.id} never completed (last refusal: ${lastReason})`
        );
      }
    }

    // Every act flag, set only by quests firing in native order.
    for (const flag of [
      CH1_FLAGS.started,
      CH1_FLAGS.act1Complete,
      CH1_FLAGS.act2Complete,
      CH1_FLAGS.act3Complete,
      CH1_FLAGS.act4Complete,
      CH1_FLAGS.act5Complete,
      CH1_FLAGS.act6TruthKnown,
      CH1_FLAGS.complete,
    ]) {
      assert.ok(run.runtime.flags.includes(flag), `missing flag ${flag}`);
    }
    assert.ok(run.runtime.ending, "the chapter must end on a chosen ending");
  });

  it("requires all twelve accounts, one conversation at a time", () => {
    const questIndex = CH1_QUESTS.findIndex(
      (q) => q.id === "ch1_a2_q03_the_night_you_came"
    );
    const run: Run = {
      runtime: defaultCh1LiveGateRuntimeState(),
      inventory: new Map(),
      presses: 0,
    };
    let nowMs = 1_000;
    let fired = false;
    let presses = 0;
    while (!fired && presses < 40) {
      presses += 1;
      nowMs += 1_000;
      fired = press(run, questIndex, 0, nowMs).fired;
    }
    assert.equal(
      presses,
      CH1_TESTIMONIES.length,
      "one press per account, and the twelfth is the one that fires"
    );
    assert.equal(ch1TestimoniesRemaining(run.runtime.testimonies), 0);
    assert.equal(run.runtime.testimonies.length, CH1_TESTIMONIES.length);
  });

  it("gates each dungeon exit on its own final authored step", () => {
    // The winter retrievals all land at d2_the_oath, step 6 of 9. The exit must
    // additionally require the run's last step, or the player can leave with
    // three objectives outstanding inside a warp-only band.
    assert.equal(
      ch1DungeonFinalStepId("ch1_dungeon_winter"),
      "d2_the_breaking_year"
    );
    assert.equal(
      ch1DungeonFinalStepId("ch1_dungeon_desert"),
      "d1_the_long_walk"
    );
    assert.equal(ch1DungeonFinalStepId("nope"), undefined);
  });

  it("gives every native leaf a stable id and a resolvable target", () => {
    for (const quest of CH1_QUESTS) {
      assert.ok(ch1NativeQuestId(quest.id), `${quest.id} has no challenge id`);
      for (const [stepIndex, step] of quest.steps.entries()) {
        assert.ok(
          ch1NativeQuestStepId(quest.id, stepIndex),
          `${quest.id}/${step.id} has no step id`
        );
        const target = ch1ObjectiveTarget(quest.id, stepIndex);
        assert.ok(target, `${quest.id}/${step.id} has no target`);
        // The district fallback is the resolver giving up. It is allowed only
        // where the chapter genuinely has no named object, and nothing does now.
        assert.notEqual(
          target!.source,
          "district",
          `${quest.id}/${step.id} ("${
            step.targetLabel ?? "-"
          }") fell through ` +
            `to the district fallback — give it an alias, a landmark or a cast ` +
            `member`
        );
      }
    }
  });

  it("keeps every consumed and granted item on the native id bridge", () => {
    // chapter1NativeInventoryPlanForTest throws at runtime for an item with no
    // native identity, which would refuse the objective in production.
    const run: Run = {
      runtime: defaultCh1LiveGateRuntimeState(),
      inventory: new Map(),
      presses: 0,
    };
    let nowMs = 1_000;
    const touched = new Set<string>();
    for (const [questIndex, quest] of CH1_QUESTS.entries()) {
      for (const [stepIndex, step] of quest.steps.entries()) {
        let guard = 0;
        let fired = false;
        while (!fired && guard < 40) {
          guard += 1;
          nowMs += 1_000;
          const before = new Map(run.inventory);
          fired = press(run, questIndex, stepIndex, nowMs).fired;
          for (const key of run.inventory.keys()) touched.add(key);
          for (const key of before.keys()) touched.add(key);
        }
        assert.ok(fired, `${quest.id}/${step.id} stalled`);
      }
    }
    const missing = [...touched].filter(
      (itemId) => harthmereNativeBiomesIdForItemId(itemId) === undefined
    );
    assert.deepEqual(
      missing,
      [],
      "every Chapter 1 item moved by an objective needs a native inventory identity"
    );
  });
});
