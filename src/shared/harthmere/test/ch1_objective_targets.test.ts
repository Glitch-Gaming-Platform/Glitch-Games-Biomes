/// <reference types="mocha" />

import assert from "assert";
import {
  allCh1ObjectiveTargets,
  ch1ObjectiveTarget,
} from "@/shared/harthmere/ch1_objective_targets";
import { CH1_SERGEANT_HOLT } from "@/shared/harthmere/ch1_returning_npcs";
import {
  ch1DungeonBlockAt,
  ch1DungeonWorldToAuthored,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { ch1ObjectiveOwnsNpcInteraction } from "@/shared/harthmere/ch1_interaction_surfaces";
import {
  CH1_TESTIMONY_ROUTE,
  CH1_THREE_ANSWER_ROUTE,
} from "@/shared/harthmere/ch1_objective_routes";
import { defaultCh1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";

describe("Chapter 1 objective targets", () => {
  it("gives all 80 objectives a player-facing instruction and named target", () => {
    const problems: string[] = [];
    for (const quest of CH1_QUESTS) {
      for (const step of quest.steps) {
        const scope = `${quest.id}/${step.id}`;
        const objective = step.objective.trim();
        const target = step.targetLabel?.trim() ?? "";
        if (objective.length < 18 || objective === "—") {
          problems.push(`${scope}: unclear instruction '${objective}'`);
        }
        if (!target || target === "—") {
          problems.push(`${scope}: unnamed target`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  it("resolves every authored objective to a finite production target", () => {
    const targets = allCh1ObjectiveTargets();
    assert.equal(
      targets.length,
      CH1_QUESTS.reduce((count, quest) => count + quest.steps.length, 0)
    );
    for (const target of targets) {
      assert.ok(target.label, `${target.questId}/${target.stepId}: no label`);
      assert.ok(
        target.position.every(Number.isFinite),
        `${target.questId}/${target.stepId}: invalid position`
      );
      assert.ok(target.interactionRadius >= 8);
      assert.ok(target.actionLabel);
    }
  });

  it("uses walkable native terrain samples for every dungeon objective", () => {
    for (const questId of [
      "ch1_a3_d1_the_sand_that_remembers",
      "ch1_a5_d2_the_long_winter_mouth",
    ]) {
      const quest = CH1_QUESTS.find((candidate) => candidate.id === questId)!;
      const dungeonId = questId.includes("d1_")
        ? "ch1_dungeon_desert"
        : "ch1_dungeon_winter";
      for (const step of quest.steps) {
        const target = ch1ObjectiveTarget(quest.id, step.id)!;
        assert.equal(target.source, "dungeon");
        const local = ch1DungeonWorldToAuthored(dungeonId, [
          ...target.position,
        ]);
        const x = Math.floor(local.x);
        const y = Math.floor(local.y);
        const z = Math.floor(local.z);
        assert.ok(
          ch1DungeonBlockAt(dungeonId, x, y - 1, z) !== undefined,
          `${quest.id}/${step.id}: no floor`
        );
        assert.equal(ch1DungeonBlockAt(dungeonId, x, y, z), undefined);
        assert.equal(ch1DungeonBlockAt(dungeonId, x, y + 1, z), undefined);
      }
    }
  });

  it("keeps named Chapter 1 NPC objectives on their real seeded identities", () => {
    const examination = ch1ObjectiveTarget(
      "ch1_a2_q04_the_visiting_doctor",
      "the_examination"
    )!;
    assert.equal(examination.source, "npc");
    assert.deepEqual(examination.position, CH1_ANCHORS.greenlamp_lou_post);
    assert.equal(examination.positionAuthority, "authored");

    const lou = ch1ObjectiveTarget("ch1_a6_q01_the_case", "hear_him_out")!;
    assert.equal(lou.source, "npc");
    assert.ok(lou.entityId);
    assert.deepEqual(lou.position, CH1_ANCHORS.returnstone_lou_post);
    assert.equal(lou.positionAuthority, "authored");
    const sorrel = ch1ObjectiveTarget(
      "ch1_a5_d2_the_long_winter_mouth",
      "d2_sorrels_camp"
    )!;
    assert.equal(sorrel.source, "dungeon");
  });

  it("gives every Chapter 1 NPC phase exclusive ownership over normal NPC dialogue", () => {
    const failures: string[] = [];
    for (const quest of CH1_QUESTS) {
      for (const step of quest.steps) {
        if (!["talk_npc", "dialogue_choice"].includes(step.trigger)) continue;
        const target = ch1ObjectiveTarget(quest.id, step.id)!;
        const scope = `${quest.id}/${step.id}`;
        if (target.entityId === undefined) {
          failures.push(`${scope}: no canonical NPC entity`);
          continue;
        }
        const projection = {
          authoredStepId: step.id,
          targetEntityId: Number(target.entityId),
          trigger: step.trigger,
        };
        if (
          !ch1ObjectiveOwnsNpcInteraction(
            projection,
            Number(target.entityId)
          )
        ) {
          failures.push(`${scope}: Chapter 1 does not own its NPC modal`);
        }
        if (
          ch1ObjectiveOwnsNpcInteraction(
            projection,
            Number(target.entityId) + 1
          )
        ) {
          failures.push(`${scope}: Chapter 1 captures an unrelated NPC`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  it("keeps every routed witness and answer NPC under Chapter 1 dialogue ownership", () => {
    const testimonyQuestId = "ch1_a2_q03_the_night_you_came";
    for (const [index, stop] of CH1_TESTIMONY_ROUTE.entries()) {
      const runtime = defaultCh1LiveGateRuntimeState();
      runtime.testimonies = CH1_TESTIMONY_ROUTE.slice(0, index).map(
        (row) => row.id
      );
      const target = ch1ObjectiveTarget(
        testimonyQuestId,
        "collect_testimonies",
        { runtime }
      )!;
      assert.equal(target.label, stop.label);
      assert.equal(target.entityId, stop.entityId, stop.label);
      assert.equal(
        ch1ObjectiveOwnsNpcInteraction(
          {
            authoredStepId: "collect_testimonies",
            targetEntityId: Number(target.entityId),
            trigger: "talk_npc",
          },
          Number(stop.entityId)
        ),
        true,
        stop.label
      );
    }

    const answerQuestId = "ch1_a3_q01_a_button_in_the_sand";
    const routeKey = `${answerQuestId}/the_three_answers`;
    for (const [index, stop] of CH1_THREE_ANSWER_ROUTE.entries()) {
      const runtime = defaultCh1LiveGateRuntimeState();
      runtime.objectiveRouteProgress[routeKey] =
        CH1_THREE_ANSWER_ROUTE.slice(0, index).map((row) => row.id);
      const target = ch1ObjectiveTarget(answerQuestId, "the_three_answers", {
        runtime,
      })!;
      assert.equal(target.label, stop.label);
      assert.ok(target.entityId, `${stop.label}: no canonical entity`);
      assert.equal(
        ch1ObjectiveOwnsNpcInteraction(
          {
            authoredStepId: "the_three_answers",
            targetEntityId: Number(target.entityId),
            trigger: "talk_npc",
          },
          Number(target.entityId)
        ),
        true,
        stop.label
      );
    }
  });

  it("distinguishes staged Chapter 1 puppets from genuinely live entity targets", () => {
    const jackieAtFence = ch1ObjectiveTarget(
      "ch1_a1_q05_the_fence_line",
      "not_this_small"
    )!;
    assert.deepEqual(jackieAtFence.position, CH1_ANCHORS.gate_fence_sighting);
    assert.ok(jackieAtFence.entityId);
    assert.equal(jackieAtFence.positionAuthority, "authored");

    const augur = ch1ObjectiveTarget(
      "ch1_a1_q03_stand_him_up",
      "seat_the_core"
    )!;
    assert.ok(augur.entityId);
    assert.equal(augur.positionAuthority, "live_entity");
  });

  it("takes the Act 4 statement at the live Grove watch house", () => {
    const statement = ch1ObjectiveTarget(
      "ch1_a4_q07_ask_me_in_a_month",
      "report_or_not"
    )!;
    assert.equal(statement.label, "Grove Watch House");
    assert.deepEqual(
      statement.position,
      CH1_ANCHORS.grove_watch_house_holt_post
    );
    assert.equal(statement.source, "npc");
    assert.equal(statement.entityId, CH1_SERGEANT_HOLT.entityId);
    assert.ok(statement.position[0] < 1792);
  });

  it("tells the player exactly how to complete the breakfast handoff", () => {
    assert.equal(
      ch1ObjectiveTarget("ch1_a1_q01_morning_after", "the_tea")?.actionLabel,
      "Drink Jackie's breakfast tea"
    );
    assert.equal(
      ch1ObjectiveTarget("ch1_a1_q01_morning_after", "kit_check")?.actionLabel,
      "Let Jackie check your kit"
    );
  });
});
