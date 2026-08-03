/// <reference types="mocha" />

import assert from "assert";
import { CH1_ANCHORS, CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { defaultCh1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import {
  Ch1ObjectiveIncomplete,
  ch1ApplyLiveObjectiveEffects,
} from "@/shared/harthmere/ch1_live_story";
import {
  CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
  ch1ObjectiveRequirementState,
} from "@/shared/harthmere/ch1_objective_requirements";
import {
  CH1_GROVE_SUPPLIER_ROUTE,
  CH1_THREE_ANSWER_ROUTE,
} from "@/shared/harthmere/ch1_objective_routes";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { allCh1NativeQuestBiscuits } from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS, type Ch1QuestStep } from "@/shared/harthmere/ch1_quests";
import {
  ch1StageDirectionFor,
  ch1StageDirections,
} from "@/shared/harthmere/ch1_staging";
import { CH1_WORLD_BUILDING_PLANS } from "@/shared/harthmere/ch1_world_buildings";

function step(stepId: string): Ch1QuestStep {
  const found = CH1_QUESTS.flatMap((quest) => quest.steps).find(
    (candidate) => candidate.id === stepId
  );
  assert(found, `missing step ${stepId}`);
  return found;
}

function requirement(
  stepId: string,
  input: {
    inventory?: Record<string, number>;
    completedGroveJobs?: number;
    vendorTransactions?: Record<string, number>;
  } = {}
) {
  return ch1ObjectiveRequirementState({
    step: step(stepId),
    runtime: defaultCh1LiveGateRuntimeState(),
    inventory: input.inventory ?? {},
    completedGroveJobs: input.completedGroveJobs ?? 0,
    vendorTransactions: input.vendorTransactions ?? {},
  });
}

function finalVoxels(plan: (typeof CH1_WORLD_BUILDING_PLANS)[number]) {
  const voxels = new Map<string, number>();
  for (const edit of plan.edits) {
    voxels.set(edit.position.join(","), Number(edit.value));
  }
  return voxels;
}

describe("Chapter 1 objective evidence and canonical world", () => {
  it("requires and consumes the real breakfast and repair inventory", () => {
    assert.equal(requirement("the_tea")?.ready, false);
    assert.equal(
      requirement("the_tea", {
        inventory: { item_ch1_breakfast_tea: 1 },
      })?.ready,
      true
    );

    const gather = requirement("gather_parts", {
      inventory: { scrap_metal: 4, iron_ingot: 2, tree_resin: 1 },
    });
    assert.equal(gather?.ready, true);

    const quest = CH1_QUESTS.find(
      (candidate) => candidate.id === "ch1_a1_q03_stand_him_up"
    )!;
    const effects = ch1ApplyLiveObjectiveEffects({
      runtime: defaultCh1LiveGateRuntimeState(),
      quest,
      step: quest.steps[0],
      stepIndex: 0,
      nowMs: 1,
    });
    assert.equal(
      effects.itemConsumes.filter((itemId) => itemId === "scrap_metal").length,
      4
    );
    assert.equal(
      effects.itemConsumes.filter((itemId) => itemId === "iron_ingot").length,
      2
    );
    assert.equal(
      effects.itemConsumes.filter((itemId) => itemId === "tree_resin").length,
      1
    );
  });

  it("requires completed Grove jobs and one transaction with every supplier", () => {
    const jobs = requirement("take_jobs", {
      completedGroveJobs: CH1_REQUIRED_GROVE_JOB_COMPLETIONS - 1,
    });
    assert.equal(jobs?.ready, false);
    assert.equal(jobs?.blocksChapterInteraction, true);
    assert.equal(
      requirement("take_jobs", {
        completedGroveJobs: CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
      })?.ready,
      true
    );

    const partialTransactions = Object.fromEntries(
      CH1_GROVE_SUPPLIER_ROUTE.slice(0, 2).map((supplier) => [
        supplier.vendorId,
        1,
      ])
    );
    const suppliers = requirement("meet_the_suppliers", {
      vendorTransactions: partialTransactions,
    });
    assert.equal(suppliers?.current, 2);
    assert.equal(suppliers?.total, CH1_GROVE_SUPPLIER_ROUTE.length);
    assert.equal(suppliers?.ready, false);
    assert.equal(suppliers?.blocksChapterInteraction, true);
    assert.equal(
      requirement("meet_the_suppliers", {
        vendorTransactions: Object.fromEntries(
          CH1_GROVE_SUPPLIER_ROUTE.map((supplier) => [supplier.vendorId, 1])
        ),
      })?.ready,
      true
    );
  });

  it("reports provisioning progress per required category", () => {
    const partial = requirement("provision", {
      inventory: { clean_water: 12 },
    });
    assert.equal(partial?.ready, false);
    assert.equal(partial?.current, 1);
    assert.equal(partial?.total, 7);

    const complete = requirement("provision", {
      inventory: {
        clean_water: 12,
        keeping_bread: 10,
        hearty_stew: 6,
        herb_bundle: 8,
        grove_road_torch: 10,
        road_repair_kit: 2,
        bandage: 6,
      },
    });
    assert.equal(complete?.ready, true);
    assert.equal(complete?.current, complete?.total);
  });

  it("walks the three-answer objective through three distinct people", () => {
    const quest = CH1_QUESTS.find(
      (candidate) => candidate.id === "ch1_a3_q01_a_button_in_the_sand"
    )!;
    const answerStep = quest.steps.find(
      (candidate) => candidate.id === "the_three_answers"
    )!;
    let runtime = defaultCh1LiveGateRuntimeState();

    for (let index = 0; index < CH1_THREE_ANSWER_ROUTE.length; index += 1) {
      const expected = CH1_THREE_ANSWER_ROUTE[index];
      const target = ch1ObjectiveTarget(quest.id, answerStep.id, { runtime });
      assert.equal(target?.label, expected.label);
      assert.deepEqual(target?.position, CH1_ANCHORS[expected.anchor]);
      try {
        const completed = ch1ApplyLiveObjectiveEffects({
          runtime,
          quest,
          step: answerStep,
          stepIndex: 1,
          nowMs: index + 1,
        });
        assert.equal(index, CH1_THREE_ANSWER_ROUTE.length - 1);
        runtime = completed.runtime;
      } catch (error) {
        assert(error instanceof Ch1ObjectiveIncomplete);
        assert.ok(index < CH1_THREE_ANSWER_ROUTE.length - 1);
        runtime = error.runtime;
      }
    }
    assert.deepEqual(
      runtime.objectiveRouteProgress[`${quest.id}/${answerStep.id}`],
      CH1_THREE_ANSWER_ROUTE.map((answer) => answer.id)
    );
  });

  it("stages moving characters at the same locations as active objectives", () => {
    assert.deepEqual(
      ch1StageDirectionFor("lou_ardan", {
        flags: [],
        activeStepId: "the_examination",
      })?.place,
      { kind: "anchor", anchor: "greenlamp_lou_post" }
    );
    assert.deepEqual(
      ch1StageDirectionFor("lou_ardan", {
        flags: ["ch1_ledger_surrendered"],
        activeStepId: "watch_him_go",
      })?.place,
      { kind: "anchor", anchor: "returnstone_lou_post" }
    );
    assert.deepEqual(
      ch1StageDirectionFor("halden_rook", {
        flags: [],
        activeStepId: "say_the_sentence",
      })?.place,
      { kind: "anchor", anchor: "gate_desert_rook_post" }
    );
    assert.deepEqual(
      ch1StageDirectionFor("jackie", {
        flags: [],
        activeStepId: "the_final_choice",
      })?.place,
      { kind: "anchor", anchor: "grove_watch_house_jackie_post" }
    );
    assert.deepEqual(
      ch1ObjectiveTarget("ch1_a1_q05_the_fence_line", "not_this_small")
        ?.position,
      CH1_ANCHORS.gate_fence_sighting
    );
    assert.deepEqual(
      ch1ObjectiveTarget("ch1_a3_q03_three_days", "the_flinch")?.position,
      CH1_ANCHORS.gate_desert_jackie_post
    );
  });

  it("keeps every cast-targeted objective on the one active per-player body", () => {
    const flags = new Set<string>([CH1_FLAGS.started]);
    const castById = new Map(
      CH1_NEW_CAST.map((member) => [Number(member.entityId), member])
    );
    for (const quest of CH1_QUESTS) {
      for (const step of quest.steps) {
        const runtime = {
          ...defaultCh1LiveGateRuntimeState(),
          flags: [...flags],
        };
        const target = ch1ObjectiveTarget(quest.id, step.id, { runtime });
        const member = target?.entityId
          ? castById.get(Number(target.entityId))
          : undefined;
        if (!target || !member) continue;
        const staged = ch1StageDirections({
          flags: runtime.flags,
          activeQuestId: quest.id,
          activeStepId: step.id,
        }).find((candidate) => candidate.key === member.key);
        assert.ok(staged, `${quest.id}/${step.id}: missing ${member.key}`);
        assert.equal(
          staged.present,
          true,
          `${quest.id}/${step.id}: targets absent ${member.displayName}`
        );
        if (staged.position) {
          assert.deepEqual(
            target.position,
            staged.position,
            `${quest.id}/${step.id}: target and visible ${member.displayName} disagree`
          );
        }
        for (const flag of step.setsFlags ?? []) {
          flags.add(flag);
        }
      }
      for (const flag of quest.setsFlags ?? []) {
        flags.add(flag);
      }
    }
  });

  it("auto-starts every native quest and leaves navigation to the dynamic target bridge", () => {
    for (const biscuit of allCh1NativeQuestBiscuits()) {
      assert.equal(biscuit.questGiver, undefined, biscuit.displayName);
      if (biscuit.trigger?.kind !== "seq") continue;
      for (const trigger of biscuit.trigger.triggers) {
        assert.equal(trigger.navigationAid, undefined);
      }
    }
  });

  it("materializes enclosed, separate road-house and watch-house buildings", () => {
    assert.equal(CH1_WORLD_BUILDING_PLANS.length, 2);
    const [roadHouse, watchHouse] = CH1_WORLD_BUILDING_PLANS;
    assert.notDeepEqual(roadHouse.placeGroup.box, watchHouse.placeGroup.box);
    assert.equal(roadHouse.materializesSolidVoxelBuilding, true);
    assert.equal(watchHouse.materializesSolidVoxelBuilding, true);

    const road = finalVoxels(roadHouse);
    assert.equal(road.get("474,70,-137"), 0, "front door must be open");
    assert.notEqual(road.get("476,73,-126"), 0, "upper floor must exist");
    assert.equal(road.get("476,74,-126"), 0, "bed feet space must be clear");
    assert.equal(road.get("476,75,-126"), 0, "bed head space must be clear");
    assert.notEqual(road.get("470,70,-134"), 0, "stairs must begin downstairs");
    assert.notEqual(road.get("471,73,-131"), 0, "stairs must reach upstairs");

    const watch = finalVoxels(watchHouse);
    assert.equal(watch.get("473,70,-152"), 0, "watch-house door must be open");
    assert.equal(watch.get("473,70,-148"), 0, "holding room must be walkable");
    assert.notEqual(watch.get("469,71,-147"), 0, "watch-house wall must exist");
  });
});
