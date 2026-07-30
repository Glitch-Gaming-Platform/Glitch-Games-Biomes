import assert from "assert";

import {
  NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
  NATIVE_BREADY_SET_GROW_QUEST_ID,
  NATIVE_BREADY_SET_GROW_STEP_IDS,
  NATIVE_FISH_FOOD_QUEST_ID,
  NATIVE_HOEDOWN_QUEST_ID,
  NATIVE_IN_STORAGE_QUEST_ID,
  NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION,
  NATIVE_IN_STORAGE_STEP_IDS,
  NATIVE_PARCEL_PURSUIT_QUEST_ID,
  NATIVE_POST_GIMME_HANDOFF_QUEST_IDS,
  NATIVE_POST_GIMME_ORDERED_STEP_IDS,
  NATIVE_POST_GIMME_QUEST_IDS,
  NATIVE_POST_GIMME_QUEST_PREREQUISITES,
  isNativePostGimmeQuestId,
  nativePostGimmeFirstIncompletePriorStep,
  nativePostGimmeProjectedNavigationAid,
  nativePostGimmeProjectedTriggerName,
} from "@/shared/harthmere/native_post_gimme_contract";
import {
  NATIVE_GIMME_SHELTER_QUEST_ID,
  isNativeRobotStoryAutoContinuationQuestId,
  nativeQuestProjectedNavigationAid,
  nativeQuestProjectedTriggerName,
} from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";

/**
 * Contract coverage for the six post-Gimme quests.
 *
 * The ids themselves are pinned by `native_post_gimme_progression.test.ts`,
 * which replays the authored trigger trees. This file covers the surrounding
 * decisions: which quests are offered rather than auto-started, and the three
 * narrowly scoped wording/navigation projections that make the restored world
 * legible without editing the immutable snapshot.
 */
describe("post-Gimme native quest contract", () => {
  it("names all six quests exactly once", () => {
    assert.deepEqual(
      [...NATIVE_POST_GIMME_QUEST_IDS].map(Number).sort(),
      [
        NATIVE_HOEDOWN_QUEST_ID,
        NATIVE_PARCEL_PURSUIT_QUEST_ID,
        NATIVE_FISH_FOOD_QUEST_ID,
        NATIVE_IN_STORAGE_QUEST_ID,
        NATIVE_BREADY_SET_GROW_QUEST_ID,
        NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID,
      ]
        .map(Number)
        .sort()
    );
    assert.equal(
      new Set(NATIVE_POST_GIMME_QUEST_IDS.map(Number)).size,
      NATIVE_POST_GIMME_QUEST_IDS.length
    );
    for (const questId of NATIVE_POST_GIMME_QUEST_IDS) {
      assert.equal(isNativePostGimmeQuestId(questId), true);
    }
    assert.equal(isNativePostGimmeQuestId(NATIVE_GIMME_SHELTER_QUEST_ID), false);
  });

  it("keeps every post-Gimme quest OUT of automatic continuation", () => {
    // The robot story auto-starts its chapters so onboarding cannot appear to
    // stop. These six are player-chosen offers instead; promoting them would
    // dump six simultaneous objectives on a player who just built a house.
    for (const questId of NATIVE_POST_GIMME_QUEST_IDS) {
      assert.equal(
        isNativeRobotStoryAutoContinuationQuestId(questId),
        false,
        `quest ${questId} would auto-start`
      );
    }
  });

  it("hands off to exactly two quests when Gimme Shelter completes", () => {
    assert.deepEqual([...NATIVE_POST_GIMME_HANDOFF_QUEST_IDS].map(Number), [
      Number(NATIVE_HOEDOWN_QUEST_ID),
      Number(NATIVE_PARCEL_PURSUIT_QUEST_ID),
    ]);
    for (const questId of NATIVE_POST_GIMME_HANDOFF_QUEST_IDS) {
      assert.deepEqual(
        (NATIVE_POST_GIMME_QUEST_PREREQUISITES.get(questId) ?? []).map(Number),
        [Number(NATIVE_GIMME_SHELTER_QUEST_ID)]
      );
    }
  });

  it("records a prerequisite list for every quest", () => {
    for (const questId of NATIVE_POST_GIMME_QUEST_IDS) {
      assert.ok(
        NATIVE_POST_GIMME_QUEST_PREREQUISITES.has(questId),
        `quest ${questId} has no prerequisite entry`
      );
      assert.ok(
        NATIVE_POST_GIMME_ORDERED_STEP_IDS.has(questId),
        `quest ${questId} has no ordered step table`
      );
    }
  });

  it("requires the same three quests for both second-tier unlocks", () => {
    const bready = (
      NATIVE_POST_GIMME_QUEST_PREREQUISITES.get(
        NATIVE_BREADY_SET_GROW_QUEST_ID
      ) ?? []
    )
      .map(Number)
      .sort();
    const battery = (
      NATIVE_POST_GIMME_QUEST_PREREQUISITES.get(
        NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID
      ) ?? []
    )
      .map(Number)
      .sort();
    assert.deepEqual(bready, battery);
    assert.deepEqual(
      bready,
      [
        NATIVE_HOEDOWN_QUEST_ID,
        NATIVE_FISH_FOOD_QUEST_ID,
        NATIVE_IN_STORAGE_QUEST_ID,
      ]
        .map(Number)
        .sort()
    );
  });

  it("supplies objective text for the two nameless snapshot leaves", () => {
    // These two `completeQuestStepAtMyRobot` leaves have NO authored `name`, so
    // without a projection the journal row, map row and HUD are all blank.
    for (const stepId of [
      NATIVE_IN_STORAGE_STEP_IDS.VIEW_TRANSMISSION_FROM_OL_COOP,
      NATIVE_BREADY_SET_GROW_STEP_IDS.VIEW_TRANSMISSION_FROM_NICO,
    ]) {
      const projected = nativePostGimmeProjectedTriggerName(stepId);
      assert.ok(projected && projected.length > 0);
      // The shared client entry point must prefer the projection over the
      // authored `undefined`.
      assert.equal(nativeQuestProjectedTriggerName(stepId, undefined), projected);
    }
  });

  it("stops sending players to look for Long Grass", () => {
    const projected = nativePostGimmeProjectedTriggerName(
      NATIVE_BREADY_SET_GROW_STEP_IDS.HARVEST_SIXTEEN_WHEAT_SEEDS
    );
    assert.ok(projected);
    assert.ok(
      !/long grass/i.test(projected!),
      "no biscuit in the snapshot tray is called Long Grass"
    );
    assert.ok(/switch grass/i.test(projected!));
    // The count placeholders the progress formatter substitutes must survive.
    assert.ok(projected!.includes("{count}"));
    assert.ok(projected!.includes("{countTarget}"));
  });

  it("names the creature family the tooth objective can actually find", () => {
    const projected = nativePostGimmeProjectedTriggerName(
      NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH
    );
    assert.ok(projected);
    assert.ok(/cobbled muckling/i.test(projected!));
  });

  it("leaves every other leaf's authored wording untouched", () => {
    assert.equal(nativePostGimmeProjectedTriggerName(12345), undefined);
    assert.equal(
      nativeQuestProjectedTriggerName(12345, "Keep authored objective"),
      "Keep authored objective"
    );
  });

  it("navigates the inventory-only tooth objective to the pack", () => {
    // `inventoryHas` leaves cannot author a navigation aid at all, which is why
    // this objective previously pointed nowhere.
    assert.deepEqual(
      nativePostGimmeProjectedNavigationAid(
        NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH
      ),
      {
        kind: "position",
        pos: [...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION],
      }
    );
    assert.deepEqual(
      nativeQuestProjectedNavigationAid(
        NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH,
        undefined
      ),
      {
        kind: "position",
        pos: [...NATIVE_IN_STORAGE_MUCKER_TOOTH_HUNT_POSITION],
      }
    );
  });

  it("never overrides an authored navigation aid", () => {
    const authored = { kind: "entity", id: 1 as BiomesId } as const;
    assert.deepEqual(
      nativeQuestProjectedNavigationAid(
        NATIVE_IN_STORAGE_STEP_IDS.COLLECT_SIX_MUCKER_TEETH,
        authored
      ),
      authored
    );
    assert.equal(nativePostGimmeProjectedNavigationAid(12345), undefined);
  });

  it("reports the real gate when a claim step is reached early", () => {
    const ordered = NATIVE_POST_GIMME_ORDERED_STEP_IDS.get(
      NATIVE_IN_STORAGE_QUEST_ID
    )!;
    const state = new Map<BiomesId, unknown>([[ordered[0], 1]]);
    assert.deepEqual(
      nativePostGimmeFirstIncompletePriorStep(
        state,
        NATIVE_IN_STORAGE_QUEST_ID,
        NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP
      ),
      { stepId: ordered[1] }
    );
  });

  it("reports no gate once every prior step is done", () => {
    const ordered = NATIVE_POST_GIMME_ORDERED_STEP_IDS.get(
      NATIVE_IN_STORAGE_QUEST_ID
    )!;
    const claimIndex = ordered.indexOf(
      NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP
    );
    const state = new Map<BiomesId, unknown>(
      ordered.slice(0, claimIndex).map((stepId) => [stepId, 1])
    );
    assert.equal(
      nativePostGimmeFirstIncompletePriorStep(
        state,
        NATIVE_IN_STORAGE_QUEST_ID,
        NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP
      ),
      undefined
    );
  });

  it("ignores quests it does not own", () => {
    assert.equal(
      nativePostGimmeFirstIncompletePriorStep(
        new Map(),
        NATIVE_GIMME_SHELTER_QUEST_ID,
        NATIVE_IN_STORAGE_STEP_IDS.RETURN_TEETH_TO_OL_COOP
      ),
      undefined
    );
  });

  it("keeps every step id in the contract unique", () => {
    const all = [...NATIVE_POST_GIMME_ORDERED_STEP_IDS.values()]
      .flat()
      .map(Number);
    assert.equal(new Set(all).size, all.length);
  });
});
