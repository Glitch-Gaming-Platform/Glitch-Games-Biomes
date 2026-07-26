import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { ch1ExitGate } from "@/shared/harthmere/ch1_chapter";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import {
  ch1LiveRetrievalIds,
  defaultCh1LiveGateRuntimeState,
  normalizeCh1LiveGateRuntimeState,
} from "@/shared/harthmere/ch1_live_gate";
import { registerCh1LiveItemDefinitions } from "@/shared/harthmere/ch1_live_items";
import {
  ch1ApplyLiveObjectiveEffects,
  ch1RuntimePlayerState,
} from "@/shared/harthmere/ch1_live_story";
import { ch1Quest } from "@/shared/harthmere/ch1_quests";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";

function apply(
  runtime: ReturnType<typeof defaultCh1LiveGateRuntimeState>,
  questId: string,
  stepId: string,
  choice?: string
) {
  const quest = ch1Quest(questId)!;
  const stepIndex = quest.steps.findIndex((step) => step.id === stepId);
  assert.notEqual(stepIndex, -1, `${questId}/${stepId} must exist`);
  return ch1ApplyLiveObjectiveEffects({
    runtime,
    quest,
    step: quest.steps[stepIndex],
    stepIndex,
    choice,
    nowMs: 1_000 + runtime.appliedObjectiveEffects.length,
  });
}

describe("Chapter 1 live story authority", () => {
  it("normalizes old gate-only saves into a complete durable story slice", () => {
    const normalized = normalizeCh1LiveGateRuntimeState({
      completionFlags: ["old_flag"],
    });
    assert.deepEqual(normalized.completionFlags, ["old_flag"]);
    assert.deepEqual(normalized.flags, []);
    assert.equal(normalized.tracks.ch1_jackie_trust, 55);
    assert.equal(normalized.ledger.entries.length, 0);
    assert.equal(normalized.augur9.charge, 62);
  });

  it("starts the story once and grants the undroppable Grey Card", () => {
    const first = apply(
      defaultCh1LiveGateRuntimeState(),
      "ch1_a1_q01_morning_after",
      "wake_up"
    );
    assert.ok(first.runtime.flags.includes(CH1_FLAGS.started));
    assert.deepEqual(first.itemGrants, ["item_grey_card"]);

    const repeated = apply(
      first.runtime,
      "ch1_a1_q01_morning_after",
      "wake_up"
    );
    assert.deepEqual(repeated.itemGrants, []);
    assert.equal(repeated.runtime.appliedObjectiveEffects.length, 1);
  });

  it("offers the ledger-opening playback needed by the Act 5 link", () => {
    const opened = apply(
      defaultCh1LiveGateRuntimeState(),
      "ch1_a2_q01_the_ledger_opens",
      "open_the_tab"
    );
    assert.ok(
      opened.runtime.availablePlaybackIds.includes(
        "frag_a2_play_the_ninth_signature"
      )
    );
  });

  it("unlocks linking without pre-awarding the link-derived fragment", () => {
    const unlocked = apply(
      defaultCh1LiveGateRuntimeState(),
      "ch1_a5_q01_the_ledger_goes_quiet",
      "unlock_linking"
    );
    assert.equal(unlocked.runtime.ledger.linkingUnlocked, true);
    assert.equal(
      unlocked.runtime.ledger.entries.some(
        (entry) => entry.fragmentId === "frag_a5_link_the_recommendation"
      ),
      false
    );
  });

  it("requires and durably records consequential choices", () => {
    const runtime = defaultCh1LiveGateRuntimeState();
    assert.throws(
      () =>
        apply(
          runtime,
          "ch1_a5_d2_the_long_winter_mouth",
          "d2_hallrs_choice"
        ),
      /valid response/
    );
    const hallr = apply(
      runtime,
      "ch1_a5_d2_the_long_winter_mouth",
      "d2_hallrs_choice",
      "hold_stall"
    );
    assert.equal(hallr.runtime.hallrChoice, "hold_stall");
    assert.ok(hallr.runtime.flags.includes("ch1_hallr_hold_stall"));

    assert.throws(
      () =>
        apply(
          hallr.runtime,
          "ch1_a6_q02_the_handover",
          "give_the_ledger",
          "not_yet"
        ),
      /remains in your hands/
    );
    const handover = apply(
      hallr.runtime,
      "ch1_a6_q02_the_handover",
      "give_the_ledger",
      "give"
    );
    assert.deepEqual(handover.itemConsumes, ["item_sorrel_field_ledger"]);

    const ending = apply(
      handover.runtime,
      "ch1_a6_q05_the_watch_house",
      "the_final_choice",
      "confess"
    );
    assert.equal(ending.runtime.ending, "confess");
    assert.ok(ending.runtime.flags.includes(CH1_FLAGS.complete));
  });

  it("only awards the Bull's Core when the player actually fights for it", () => {
    const bypass = apply(
      defaultCh1LiveGateRuntimeState(),
      "ch1_a3_d1_the_sand_that_remembers",
      "d1_sun_court",
      "stealth_bypass"
    );
    assert.equal(bypass.itemGrants.includes("item_bulls_core"), false);

    const fight = apply(
      defaultCh1LiveGateRuntimeState(),
      "ch1_a3_d1_the_sand_that_remembers",
      "d1_sun_court",
      "break_horns"
    );
    assert.equal(fight.itemGrants.includes("item_bulls_core"), true);
  });

  it("makes the desert retrieval exit completable without the E2E bypass", () => {
    let runtime = defaultCh1LiveGateRuntimeState();
    const inventory: Record<string, number> = {};
    for (const stepId of ["d1_seed_vault", "d1_find_iris", "d1_the_long_walk"]) {
      const result = apply(
        runtime,
        "ch1_a3_d1_the_sand_that_remembers",
        stepId
      );
      runtime = result.runtime;
      for (const itemId of result.itemGrants) {
        inventory[itemId] = (inventory[itemId] ?? 0) + 1;
      }
    }
    runtime = {
      ...runtime,
      activeDungeonRunId: "ch1_dungeon_desert",
      activeRunStartedMs: 1_000,
    };
    const carriedOut = ch1LiveRetrievalIds(runtime, inventory);
    assert.ok(carriedOut.includes("item_first_grain"));
    assert.ok(carriedOut.includes("npc_iris_fen"));
    const exit = ch1ExitGate({
      state: ch1RuntimePlayerState(runtime),
      carriedOut,
      nowMs: 10_000,
    });
    assert.equal(exit.ok, true);
  });

  it("makes the winter person, ledger, and key retrievals completable", () => {
    let runtime = defaultCh1LiveGateRuntimeState();
    const inventory: Record<string, number> = {};
    for (const [stepId, choice] of [
      ["d2_sorrels_camp", undefined],
      ["d2_the_oath", "swear_oath"],
      ["d2_hallrs_choice", "let_run"],
      ["d2_the_breaking_year", undefined],
    ] as const) {
      const result = apply(
        runtime,
        "ch1_a5_d2_the_long_winter_mouth",
        stepId,
        choice
      );
      runtime = result.runtime;
      for (const itemId of result.itemGrants) {
        inventory[itemId] = (inventory[itemId] ?? 0) + 1;
      }
    }
    runtime = {
      ...runtime,
      activeDungeonRunId: "ch1_dungeon_winter",
      activeRunStartedMs: 1_000,
    };
    const carriedOut = ch1LiveRetrievalIds(runtime, inventory);
    assert.ok(carriedOut.includes("npc_nadia_sorrel"));
    assert.ok(carriedOut.includes("item_sorrel_field_ledger"));
    assert.ok(carriedOut.includes("item_custodian_key_3"));
    const exit = ch1ExitGate({
      state: ch1RuntimePlayerState(runtime),
      carriedOut,
      nowMs: 10_000,
    });
    assert.equal(exit.ok, true);
  });

  it("registers plot-critical items with their authored drop and trade rules", () => {
    registerCh1LiveItemDefinitions();
    const card = getHarthmereItemDefinition("item_grey_card");
    const ledger = getHarthmereItemDefinition("item_sorrel_field_ledger");
    assert.equal(card?.binding, "quest");
    assert.equal(card?.tradeable, false);
    assert.equal(ledger?.binding, "quest");
    assert.equal(ledger?.tradeable, false);
  });
});
