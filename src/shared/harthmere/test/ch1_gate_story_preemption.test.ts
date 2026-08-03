/// <reference types="mocha" />
//
// CHAPTER_1_GATE_STORY_PREEMPTION
//
// Two invariants that stop the same live failure recurring one act at a time.
//
// WHAT HAPPENED
// Live testing at `say_the_sentence` found the Fracture Gate's
// "F — Enter The Sand That Remembers" prompt owning the interaction while the
// active story objective was "Answer Halden Rook" — because Rook is correctly
// staged AT that aperture and the gate offers entry from the same spot.
//
// A sweep of all 80 objectives showed that was not one bug. FIVE objectives put
// a character on an enterable Mouth, so four more instances were queued up in
// Acts 3, 4 and 5:
//
//   ch1_a2_q05_footprints/the_footprints        Rook, Old Wood aperture
//   ch1_a2_q05_footprints/say_the_sentence      Rook, Old Wood aperture   <- hit
//   ch1_a3_q03_three_days/the_flinch            Jackie, return aperture
//   ch1_a4_q03_what_the_devils_know/call_the_collapse   Rook, Old Wood aperture
//   ch1_a5_q03_pack_for_the_cold/rooks_rope     Rook, Cold Gate
//
// The same sweep found the amplifier: Rook's two act-level stage directions had
// no end condition, so he stood on a Mouth for 55 of the 80 objectives.

import assert from "assert";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { ch1StageDirections } from "@/shared/harthmere/ch1_staging";
import { ch1NpcLiveAuditStaging } from "@/shared/harthmere/ch1_npc_live_audit";
import { CH1_FRACTURE_GATES } from "@/shared/harthmere/ch1_fracture_gates";
import { CH1_GATE_INTERACTION_RADIUS } from "@/shared/harthmere/ch1_live_gate";
import {
  Ch1ObjectiveIncomplete,
  ch1ApplyLiveObjectiveEffects,
  ch1ObjectiveChoiceSpec,
} from "@/shared/harthmere/ch1_live_story";
import {
  defaultCh1LiveGateRuntimeState,
  type Ch1LiveGateRuntimeState,
} from "@/shared/harthmere/ch1_live_gate";

const PREEMPT_RADIUS = CH1_GATE_INTERACTION_RADIUS + 4;

/** The five beats whose scene only works standing at a Mouth. */
const AUTHORED_GATE_BEATS = new Set([
  "the_footprints",
  "say_the_sentence",
  "the_flinch",
  "call_the_collapse",
  "rooks_rope",
]);

function horizontal(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function enterableGates() {
  return CH1_FRACTURE_GATES.filter((gate) => gate.enterable && gate.dungeonId);
}

/** Walk the chapter through the real reducer, yielding per-step state. */
function* chapterWalk(): Generator<{
  questIndex: number;
  stepIndex: number;
  questId: string;
  stepId: string;
  runtime: Ch1LiveGateRuntimeState;
}> {
  let runtime = defaultCh1LiveGateRuntimeState();
  let nowMs = 1_000;
  for (const [questIndex, quest] of CH1_QUESTS.entries()) {
    for (const [stepIndex, step] of quest.steps.entries()) {
      yield {
        questIndex,
        stepIndex,
        questId: quest.id,
        stepId: step.id,
        runtime,
      };
      for (const requirement of step.inventoryRequirements ?? []) {
        void requirement;
      }
      let guard = 0;
      for (;;) {
        guard += 1;
        if (guard > 30) break;
        nowMs += 1_000;
        const spec = ch1ObjectiveChoiceSpec(step);
        const choice = spec
          ? step.id === "choose_a_name"
            ? "name:Wren"
            : spec.options.find((option) => option.id !== "not_yet")?.id
          : undefined;
        try {
          runtime = ch1ApplyLiveObjectiveEffects({
            runtime,
            quest,
            step,
            stepIndex,
            choice,
            nowMs,
          }).runtime;
          break;
        } catch (error) {
          if (error instanceof Ch1ObjectiveIncomplete) {
            runtime = error.runtime;
            continue;
          }
          break;
        }
      }
    }
  }
}

describe("chapter 1 gate / story preemption", () => {
  it("knows exactly which objectives are staged on a Mouth", () => {
    const found = new Set<string>();
    for (const { questId, stepIndex, stepId } of chapterWalk()) {
      const target = ch1ObjectiveTarget(questId, stepIndex);
      if (!target || target.source === "dungeon") continue;
      for (const gate of enterableGates()) {
        if (horizontal(target.position, gate.position) <= PREEMPT_RADIUS) {
          found.add(stepId);
        }
      }
    }
    // If a NEW objective lands on a Mouth, this fails and whoever added it has
    // to decide deliberately whether the gate should stand down for it.
    assert.deepEqual(
      [...found].sort(),
      [...AUTHORED_GATE_BEATS].sort(),
      "an objective moved onto (or off) a Fracture Gate — the gate prompt " +
        "suppression list must be re-derived, or live play will hit a " +
        "competing F prompt"
    );
  });

  it("never leaves a character on a Mouth that the player is being sent to", () => {
    // THE BLOCKING INVARIANT. A character standing at an aperture is fine while
    // the objective is elsewhere — the player is not there, so nothing competes.
    // It is only a defect when the objective ALSO points at that aperture and is
    // not one of the five authored gate beats, because then the player arrives
    // to two prompts and no rule about which wins.
    const offenders: string[] = [];
    for (const { questId, stepIndex, stepId, runtime } of chapterWalk()) {
      if (AUTHORED_GATE_BEATS.has(stepId)) continue;
      const target = ch1ObjectiveTarget(questId, stepIndex);
      if (!target || target.source === "dungeon") continue;
      const onAGate = enterableGates().some(
        (gate) => horizontal(target.position, gate.position) <= PREEMPT_RADIUS
      );
      if (!onAGate) continue;
      const staged = ch1StageDirections({
        flags: runtime.flags,
        ending: runtime.ending,
        hallrChoice: runtime.hallrChoice,
        activeQuestId: questId,
        activeStepId: stepId,
      });
      for (const npc of staged) {
        if (!npc.present || !npc.position) continue;
        for (const gate of enterableGates()) {
          if (horizontal(npc.position, gate.position) <= PREEMPT_RADIUS) {
            offenders.push(
              `${questId}/${stepId}: ${npc.displayName} @ ${gate.id}`
            );
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("sends Halden Rook home between the two expeditions", () => {
    // He is a gate-warden, so watching a Mouth during the expedition acts is his
    // job. What was wrong is that his two act-level directions had NO end
    // condition, so he also stood at the Old Wood aperture through Act 4's Grove,
    // Greenlamp and Ashline beats, and at the Cold Gate through the entire Act 6
    // finale in the Grove — 55 of 80 objectives in total.
    const bridge = "harthmere_bridge_center";
    const mustBeHome = [
      // Act 4: the chapter moves to the Grove, Mosslawn, Ashline and Greenlamp.
      "hear_it",
      "tell_sil_why",
      "walk_in",
      "the_procedure",
      "how_did_you_do_that",
      "notice",
      "search_the_stores",
      "have_it_analysed",
      "show_him",
      "interrogate",
      "confront",
      "report_or_not",
      "sleep_alone",
      // Act 6: the finale is entirely in the Grove.
      "hear_him_out",
      "hear_vane",
      "give_the_ledger",
      "give_her_location",
      "the_word",
      "watch_him_go",
      "did_he_take_it",
      "the_whole_plan",
      "the_final_choice",
    ];
    const seen = new Set<string>();
    const offenders: string[] = [];
    for (const { questId, stepId, runtime } of chapterWalk()) {
      if (!mustBeHome.includes(stepId)) continue;
      seen.add(stepId);
      const rook = ch1StageDirections({
        flags: runtime.flags,
        ending: runtime.ending,
        hallrChoice: runtime.hallrChoice,
        activeQuestId: questId,
        activeStepId: stepId,
      }).find((npc) => npc.key === "halden_rook")!;
      if (!rook.position) continue;
      const atAGate = enterableGates().some(
        (gate) => horizontal(rook.position!, gate.position) <= PREEMPT_RADIUS
      );
      if (atAGate) {
        offenders.push(`${questId}/${stepId}: Rook still at a Mouth`);
      }
    }
    assert.deepEqual(offenders, []);
    assert.equal(
      seen.size,
      mustBeHome.length,
      "a step in the Grove-side list no longer exists; re-derive the list"
    );
    void bridge;
  });

  it("keeps every cast member in the world for objectives that target them", () => {
    // The other half of the same class: an objective pointing at an NPC who is
    // staged `absent` sends the player to an empty spot with no way to finish.
    const offenders: string[] = [];
    for (const { questId, stepIndex, stepId, runtime } of chapterWalk()) {
      const target = ch1ObjectiveTarget(questId, stepIndex);
      if (target?.entityId === undefined) continue;
      const cast = CH1_NEW_CAST.find(
        (member) => Number(member.entityId) === Number(target.entityId)
      );
      if (!cast) continue;
      const staged = ch1StageDirections({
        flags: runtime.flags,
        ending: runtime.ending,
        hallrChoice: runtime.hallrChoice,
        activeQuestId: questId,
        activeStepId: stepId,
      }).find((npc) => npc.key === cast.key)!;
      if (!staged.present) {
        offenders.push(`${questId}/${stepId}: ${cast.displayName} is absent`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("never projects two visible canonical actors onto one objective-stage coordinate", () => {
    const offenders: string[] = [];
    for (const { questId, stepId, runtime } of chapterWalk()) {
      const staged = ch1NpcLiveAuditStaging({
        flags: runtime.flags,
        ending: runtime.ending,
        hallrChoice: runtime.hallrChoice,
        activeQuestId: questId,
        activeStepId: stepId,
      });
      assert.equal(
        new Set(staged.map((npc) => Number(npc.entityId))).size,
        staged.length,
        `${questId}/${stepId}: one canonical actor was staged twice`
      );
      const visible = staged.filter((npc) => npc.present && npc.position);
      for (let left = 0; left < visible.length; left += 1) {
        for (let right = left + 1; right < visible.length; right += 1) {
          if (
            visible[left].position!.every(
              (value, axis) => value === visible[right].position![axis]
            )
          ) {
            offenders.push(
              `${questId}/${stepId}: ${visible[left].displayName} and ${visible[right].displayName} @ ${visible[left].position!.join(",")}`
            );
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
