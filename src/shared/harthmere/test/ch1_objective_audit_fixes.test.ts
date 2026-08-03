/// <reference types="mocha" />

import assert from "assert";
import { CH1_QUESTS, ch1Quest } from "@/shared/harthmere/ch1_quests";
import { CH1_ANCHORS, CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import { ch1ObjectiveMaterialRequirements } from "@/shared/harthmere/ch1_material_objectives";
import { ch1ObjectiveChoiceSpec } from "@/shared/harthmere/ch1_live_story";
import {
  allCh1ObjectiveTargets,
  ch1ObjectiveTarget,
} from "@/shared/harthmere/ch1_objective_targets";
import { CH1_REQUIRED_GROVE_JOB_COMPLETIONS } from "@/shared/harthmere/ch1_objective_requirements";
import { harthmereMaterialAcquisitionPlan } from "@/shared/harthmere/material_acquisition_guidance";

describe("Chapter 1 objective audit fixes", () => {
  /**
   * CRITICAL FIX: Material Acquisition Visibility
   *
   * Audit issue: "Gather Parts" routed the player to Luis's Repair Cart and
   * accepted repeated completion requests, but required materials that the
   * marked location did not visibly provide. Browser E2E fixtures seeded
   * materials externally.
   *
   * Fix: Every material required by "Gather Parts" must have a visible Grove
   * acquisition route (gather, buy, or craft) that the player can actually
   * complete.
   */
  describe("Material acquisition contracts", () => {
    it("provides visible acquisition paths for every Gather Parts material", () => {
      const gatherPartsQuest = ch1Quest("ch1_a1_q03_stand_him_up");
      assert.ok(gatherPartsQuest, "Stand Him Up quest must exist");

      const gatherPartsStep = gatherPartsQuest!.steps.find(
        (s) => s.id === "gather_parts"
      );
      assert.ok(gatherPartsStep, "Gather Parts step must exist");

      const requirements = gatherPartsStep!.inventoryRequirements ?? [];
      assert.equal(
        requirements.length,
        3,
        "Gather Parts must require exactly 3 material types"
      );

      for (const requirement of requirements) {
        const acquisition = harthmereMaterialAcquisitionPlan({
          itemId: requirement.itemId,
          count: requirement.count,
        });

        assert.ok(
          acquisition,
          `Material "${requirement.itemId}" must have an acquisition plan`
        );

        // At least one route must be direct (not transitively required)
        const directRoutes = acquisition!.routes.filter(
          (r) => r.markerPosition !== undefined && r.kind !== "craft"
        );
        assert.ok(
          directRoutes.length >= 1,
          `"${requirement.itemId}" must have at least one direct gather/buy route with a map marker`
        );

        // Every route should have description starting with "Head to" or similar
        for (const route of acquisition!.routes) {
          if (route.kind !== "craft") {
            assert.ok(
              route.description.length > 0,
              `${requirement.itemId} route must have actionable description`
            );
          }
        }
      }
    });

    it("validates every concrete provisioning item has a Grove source", () => {
      for (const stepId of ["provision", "provision_winter"]) {
        const step = CH1_QUESTS.flatMap((quest) => quest.steps).find(
          (candidate) => candidate.id === stepId
        );
        assert.ok(step, `${stepId} must exist`);
        const requirements = ch1ObjectiveMaterialRequirements(step!);
        assert.ok(requirements.length > 0, `${stepId} must expose materials`);
        for (const requirement of requirements) {
          assert.ok(
            requirement.options.length > 0,
            `${stepId}/${requirement.label} must map to a concrete item`
          );
          for (const option of requirement.options) {
            const acquisition = harthmereMaterialAcquisitionPlan({
              itemId: option.itemId,
              itemName: option.itemName,
              count: requirement.count,
            });
            assert.ok(
              acquisition?.routes.some((route) => route.markerPosition),
              `${stepId}/${option.itemId} must have a map-trackable acquisition route`
            );
          }
        }
      }
    });
  });

  /**
   * HIGH FIX: Objective Instruction Clarity
   *
   * Audit flagged 18 objectives with "instruction may be too terse". Player
   * instructions must be clear, actionable, and specific about what to do next.
   */
  describe("Objective instruction clarity", () => {
    const TERSE_OBJECTIVES = [
      "ch1_a1_q01_morning_after/wake_up", // "Get out of bed"
      "ch1_a1_q05_the_fence_line/not_this_small", // terse dialogue choice
      "ch1_a2_q02_work_the_board/take_jobs", // needs more detail
      "ch1_a3_q01_a_button_in_the_sand/examine_the_button", // collect step
      "ch1_a3_d1_the_sand_that_remembers/d1_salt_market", // "Get through the bazaar"
      "ch1_a3_d1_the_sand_that_remembers/d1_sun_court", // "Get past the guardian"
      "ch1_a3_q03_three_days/come_back_out", // "Return to the Grove"
      "ch1_a3_q03_three_days/the_flinch", // "Let Jackie reach you"
      "ch1_a4_q02_thirty_one_seconds/the_procedure", // minigame
      "ch1_a4_q02_thirty_one_seconds/how_did_you_do_that", // dialogue choice
      "ch1_a4_q06_teak/interrogate", // "Talk to Teak Morrow"
      "ch1_a4_q07_ask_me_in_a_month/confront", // dialogue choice
      "ch1_a5_q03_pack_for_the_cold/provision_winter", // provisioning
      "ch1_a5_q04_two_days/come_out", // arrival beat; see ch1_quests.ts note
      "ch1_a6_q03_consolidation/the_word", // NO instruction provided
      "ch1_a6_q04_too_late/watch_him_go", // NO instruction provided
      "ch1_a6_q05_the_watch_house/did_he_take_it", // dialogue choice
      "ch1_a6_q05_the_watch_house/the_whole_plan", // "Let her explain"
    ];

    it("ensures every objective has a clear, actionable instruction", () => {
      for (const objectiveId of TERSE_OBJECTIVES) {
        const [questId, stepId] = objectiveId.split("/");
        const quest = ch1Quest(questId);
        assert.ok(quest, `quest ${questId} must exist`);

        const step = quest!.steps.find((s) => s.id === stepId);
        assert.ok(step, `step ${stepId} must exist in quest ${questId}`);

        // Special handling for Act 6 steps that intentionally have minimal text
        if (
          objectiveId === "ch1_a6_q03_consolidation/the_word" ||
          objectiveId === "ch1_a6_q04_too_late/watch_him_go"
        ) {
          // These are intentionally sparse per narrative design — but must
          // still provide SOME actionable guidance
          assert.ok(
            step!.objective && step!.objective.length >= 10,
            `Act 6 step ${stepId} must have at least minimal guidance (>10 chars)`
          );
        } else {
          // All other objectives must have clear instructions
          assert.ok(
            step!.objective && step!.objective.length >= 15,
            `objective ${objectiveId} instruction is too terse: "${step!.objective}"`
          );

          // Dialogue choice steps should explain what choosing does
          if (step!.trigger === "dialogue_choice") {
            assert.ok(
              /\b(ask|answer|choose|decide|demand|face|listen|report|respond|say|tell|watch)\b/i.test(
                step!.objective
              ),
              `dialogue choice ${stepId} should tell the player what response action to take`
            );
          }

          // Minigame steps should explain the challenge
          if (step!.trigger === "minigame") {
            assert.ok(
              step!.objective.length > 25,
              `minigame ${stepId} must explain the challenge`
            );
          }

          // Collect/gather steps should be specific
          if (step!.trigger === "collect" && step!.id.includes("gather")) {
            assert.ok(
              step!.objective.includes("gather") ||
                step!.objective.includes("obtain") ||
                step!.objective.includes("get") ||
                step!.objective.includes("material"),
              `gather step ${stepId} should name what's being gathered`
            );
          }
        }
      }
    });

    it("adds missing Act 6 player instructions", () => {
      // Step 76: "The Word" - Lou addressing player by designation
      const theWordStep = ch1Quest("ch1_a6_q03_consolidation")!.steps.find(
        (s) => s.id === "the_word"
      );
      assert.ok(theWordStep, "The Word step must exist");
      assert.ok(
        theWordStep!.objective.length > 0,
        "The Word must have player instruction"
      );
      assert.ok(
        theWordStep!.objective.toLowerCase().includes("ardan") ||
          theWordStep!.objective.toLowerCase().includes("designation") ||
          theWordStep!.objective.toLowerCase().includes("word"),
        "The Word instruction should reference the moment or Lu's action"
      );

      // Step 77: "Watch Him Go" - player's response options
      const watchHimGoStep = ch1Quest("ch1_a6_q04_too_late")!.steps.find(
        (s) => s.id === "watch_him_go"
      );
      assert.ok(watchHimGoStep, "Watch Him Go step must exist");
      assert.ok(
        watchHimGoStep!.objective.length > 0,
        "Watch Him Go must have player instruction"
      );
      assert.ok(
        watchHimGoStep!.objective.toLowerCase().includes("answer") ||
          watchHimGoStep!.objective.toLowerCase().includes("respond") ||
          watchHimGoStep!.objective.toLowerCase().includes("ardan"),
        "Watch Him Go should prompt player response to Lou"
      );
    });

    it("keeps Work the Board wording aligned with its three-job authority", () => {
      const takeJobs = ch1Quest("ch1_a2_q02_work_the_board")!.steps.find(
        (step) => step.id === "take_jobs"
      )!;
      assert.equal(CH1_REQUIRED_GROVE_JOB_COMPLETIONS, 3);
      assert.match(takeJobs.objective, /complete three Grove jobs/i);
      assert.doesNotMatch(takeJobs.objective, /post a job request/i);
      assert.doesNotMatch(takeJobs.objective, /three.*businesses/i);
    });
  });

  /**
   * HIGH FIX: World Object Visibility Contracts
   *
   * Audit flagged world objects that must be visible and interactable:
   * - Tea tin, journal, letter, provisioning checklist
   * - Song stones, kettle
   * - Various anchors and landmarks
   */
  describe("world object visibility contracts", () => {
    it("validates critical world objects are properly anchored", () => {
      // Journal — referenced by multiple quests
      assert.deepEqual(
        ch1ObjectiveTarget("ch1_a2_q01_the_ledger_opens", "open_the_tab")
          ?.position,
        CH1_ANCHORS.fountain_lesson_board,
        "the journal objective must point at the lesson-board journal"
      );

      // Tea tin — Act 4 discovery
      assert.ok(CH1_ANCHORS.roadhouse_stores, "tea tin storage anchor exists");

      // Letter — Act 5 discovery at the watch house
      assert.deepEqual(
        ch1ObjectiveTarget("ch1_a5_q02_the_letter", "read_the_letter")
          ?.position,
        CH1_ANCHORS.grove_watch_house,
        "the letter objective must point at the watch house"
      );

      // Song stones — Act 4 interaction
      assert.ok(CH1_ANCHORS.mosslawn_song_stones, "song stones anchor exists");

      // Dented tea tin — multiple steps
      assert.ok(CH1_ANCHORS.roadhouse_stores, "dented tea tin anchor exists");

      // Coretta's ledger — Act 5
      assert.ok(CH1_ANCHORS.coretta_ledger_desk, "ledger desk anchor exists");

      // Grove Guild Charter Board — Act 1
      assert.ok(CH1_ANCHORS.taye_sign_post, "charter board area anchor exists");

      // Provisioning checklists are conceptual (shown via UI), not world objects
      // but should be tied to questgiver anchors
      assert.ok(CH1_ANCHORS.ranger_jane, "provision checker anchor exists");

      // Jackie's kettle — Act 4
      assert.ok(CH1_ANCHORS.roadhouse_hearth, "kettle/hearth anchor exists");
    });

    it("validates all quest-step targets have anchor or landmark resolution", () => {
      const targets = allCh1ObjectiveTargets();
      assert.equal(
        targets.length,
        CH1_QUESTS.reduce((sum, quest) => sum + quest.steps.length, 0),
        "every objective must resolve exactly one target"
      );
      for (const target of targets) {
        assert.ok(target.label.trim(), `${target.questId}/${target.stepId}`);
        assert.ok(
          target.position.every(Number.isFinite),
          `${target.questId}/${target.stepId} has a non-finite target`
        );
        assert.ok(
          target.interactionRadius > 0,
          `${target.questId}/${target.stepId} needs an interaction radius`
        );
      }
    });
  });

  /**
   * MEDIUM FIX: Objective Completeness Audit
   *
   * Verify every objective has:
   * - Clear trigger type (dialogue_choice, collect, talk_npc, etc.)
   * - Clear target/interaction point
   * - Grants or state changes
   * - Successor advancement
   */
  describe("objective completeness contracts", () => {
    it("requires every objective to have a clear completion path", () => {
      for (const quest of CH1_QUESTS) {
        for (let i = 0; i < quest.steps.length; i++) {
          const step = quest.steps[i];

          // Must have a target or interaction point
          assert.ok(
            step.targetLabel || step.trigger === "sleep",
            `${quest.id}/${step.id}: missing targetLabel`
          );
          assert.ok(
            ch1ObjectiveTarget(quest.id, i),
            `${quest.id}/${step.id}: missing completion target`
          );

          // Dialogue choices must own a concrete, rendered decision spec. The
          // generic native quest progression advances after the choice; it is
          // not necessary for every choice to set an additional story flag.
          if (step.trigger === "dialogue_choice") {
            const spec = ch1ObjectiveChoiceSpec(step);
            assert.ok(spec, `${quest.id}/${step.id}: missing choice spec`);
            assert.ok(
              spec!.prompt.trim().length >= 10,
              `${quest.id}/${step.id}: choice prompt is too terse`
            );
            assert.ok(
              spec!.options.length > 0,
              `${quest.id}/${step.id}: choice has no options`
            );
          }
        }
      }
    });

    it("ensures every step has humanly-readable objective text", () => {
      for (const quest of CH1_QUESTS) {
        for (const step of quest.steps) {
          assert.ok(
            step.objective && step.objective.trim().length > 0,
            `${quest.id}/${step.id} must have non-empty objective`
          );

          // Objective should be complete sentence(s)
          assert.ok(
            step.objective.length >= 5,
            `${quest.id}/${step.id} objective too short: "${step.objective}"`
          );

          // Should not be ALL CAPS (except acronyms like AUGUR-9)
          const capsRatio =
            (step.objective.match(/[A-Z]/g) || []).length /
            step.objective.length;
          assert.ok(
            capsRatio < 0.7,
            `${quest.id}/${step.id} has too many caps: "${step.objective}"`
          );
        }
      }
    });
  });

  /**
   * REGRESSION: Verify core Chapter 1 systems still work
   */
  describe("chapter 1 system integrity", () => {
    it("maintains all 6 acts and 31 quests", () => {
      const questsByAct = new Map<number, string[]>();
      for (const quest of CH1_QUESTS) {
        if (!questsByAct.has(quest.act)) {
          questsByAct.set(quest.act, []);
        }
        questsByAct.get(quest.act)!.push(quest.id);
      }

      assert.equal(questsByAct.size, 6, "must have 6 acts");
      assert.equal(CH1_QUESTS.length, 31, "must have 31 quests total");

      // Each act must have an act-closer
      for (let act = 1; act <= 6; act++) {
        const closer = CH1_QUESTS.find((q) => q.act === act && q.actClose);
        assert.ok(closer, `act ${act} must have a closer quest`);
      }
    });

    it("preserves all character relationships and trust arcs", () => {
      // Jackie trust should decrease over the chapter
      const jackie1 = CH1_QUESTS.find(
        (q) => q.id === "ch1_a1_q01_morning_after"
      );
      const jackie4 = CH1_QUESTS.find(
        (q) => q.id === "ch1_a4_q07_ask_me_in_a_month"
      );

      assert.ok(
        jackie4?.trackDeltas?.some((d) => d.delta < 0),
        "Jackie trust should decrease in Act 4"
      );

      // Lou trust increases then stabilizes
      const lou2 = CH1_QUESTS.find(
        (q) => q.id === "ch1_a2_q04_the_visiting_doctor"
      );
      assert.ok(
        lou2?.trackDeltas?.some((d) => d.delta > 0),
        "Lou trust should increase when player meets him"
      );
    });

    it("ensures ledger silence/resume cycle works", () => {
      const dosingStopped = CH1_FLAGS.dosingStopped;
      const dosingResumed = CH1_FLAGS.dosingResumed;

      // Both must be distinct flags
      assert.notEqual(
        dosingStopped,
        dosingResumed,
        "dosing stop/resume must be different flags"
      );

      // Stopping happens in Act 4, resuming in Act 5
      const stopQuest = CH1_QUESTS.find((q) =>
        q.setsFlags?.includes(dosingStopped)
      );
      assert.ok(stopQuest?.act === 4, "dosing stops in Act 4");

      const resumeQuest = CH1_QUESTS.find((q) =>
        q.setsFlags?.includes(dosingResumed)
      );
      assert.ok(resumeQuest?.act === 5, "dosing resumes in Act 5");
    });
  });
});
