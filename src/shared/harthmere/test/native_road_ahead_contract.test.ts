import assert from "assert";
import {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_CONTAINER_SPECS,
  NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
  NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS,
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_ROAD_AHEAD_STEP_IDS,
  NATIVE_ROBOT_STORY_FINAL_HANDOFFS,
  NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS,
  isNativeRoadAheadQuestObjectLabel,
  isNativeBustedUnderwaterContainerLabel,
  isNativeRobotStoryCrateDialogueLabel,
  nativeBustedUnderwaterContainerClaimForItem,
  nativeQuestContainerClaimForItem,
  nativeQuestContainerFirstIncompletePriorStep,
  nativeRoadAheadFirstIncompletePriorStep,
  nativeRoadAheadContainerClaimForItem,
  nativeRoadAheadContainerItemIds,
  nativeRoadAheadContainerSpecForLabel,
  nativeQuestGiverUsesEcsDialogue,
  nativeRobotStoryQuestOrder,
  nativeRoadAheadEcsAuthorityEnabled,
  playerHealthAutoRegenerationEnabled,
} from "@/shared/harthmere/native_road_ahead_contract";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";

describe("native Road Ahead snapshot contract", () => {
  const originalSyntheticFlag =
    process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;
  const originalNativeAuthority =
    process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY;

  afterEach(() => {
    if (originalSyntheticFlag === undefined) {
      delete process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;
    } else {
      process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD =
        originalSyntheticFlag;
    }
    if (originalNativeAuthority === undefined) {
      delete process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY;
    } else {
      process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY =
        originalNativeAuthority;
    }
  });

  it("matches the May 16 snapshot quest, exact Muckwad item, and ordered 16-step tree", () => {
    assert.equal(NATIVE_ROAD_AHEAD_QUEST_ID, 6193612340426932);
    assert.equal(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID, 4603863378554668);
    assert.equal(NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS.length, 16);
    assert.deepEqual(NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS, [
      NATIVE_ROAD_AHEAD_STEP_IDS.TALK_TO_JACKIE,
      NATIVE_ROAD_AHEAD_STEP_IDS.MEET_BILLY,
      NATIVE_ROAD_AHEAD_STEP_IDS.FIND_MUCKWAD,
      NATIVE_ROAD_AHEAD_STEP_IDS.COLLECT_SIX_MUCKWAD,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_MUCKWAD_TO_BILLY,
      NATIVE_ROAD_AHEAD_STEP_IDS.FIND_CLOTHING_CRATE,
      NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
      NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS,
      NATIVE_ROAD_AHEAD_STEP_IDS.WEAR_TOP_AND_BOTTOMS,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_TO_BILLY_DRESSED,
      NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_BILLYS_PICK,
      NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_ROBOT_SHELL,
      NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_CAMERA,
      NATIVE_ROAD_AHEAD_STEP_IDS.TAKE_SELFIE_WITH_BILLY,
      NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_ROBOT_SHELL_TO_JACKIE,
    ]);
  });

  it("preserves the full original robot-story chapter order", () => {
    assert.equal(NATIVE_BUSTED_QUEST_ID, 7405046529843322);
    assert.equal(NATIVE_GET_THE_MUCK_OUT_QUEST_ID, 817959262145055);
    assert.equal(NATIVE_MUCK_VS_MACHINE_QUEST_ID, 5739496793885069);
    assert.equal(nativeRobotStoryQuestOrder(NATIVE_ROAD_AHEAD_QUEST_ID), 0);
    assert.equal(nativeRobotStoryQuestOrder(NATIVE_BUSTED_QUEST_ID), 1);
    assert.equal(
      nativeRobotStoryQuestOrder(NATIVE_GET_THE_MUCK_OUT_QUEST_ID),
      2
    );
    assert.equal(
      nativeRobotStoryQuestOrder(NATIVE_MUCK_VS_MACHINE_QUEST_ID),
      3
    );
    assert.equal(nativeRobotStoryQuestOrder(123), -1);
  });

  it("records composite trigger nodes required by final-step validation", () => {
    assert(
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead.prerequisiteTriggerIds.includes(
        NATIVE_ROAD_AHEAD_STEP_IDS.WEAR_TOP_AND_BOTTOMS
      )
    );
    assert(
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.busted.prerequisiteTriggerIds.includes(
        3106453541468841 as BiomesId
      )
    );
    assert(
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.busted.prerequisiteTriggerIds.includes(
        2605479334585778 as BiomesId
      )
    );
    assert(
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.busted.prerequisiteTriggerIds.includes(
        3488902901607828 as BiomesId
      )
    );
    assert(
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut.prerequisiteTriggerIds.includes(
        7507033025879660 as BiomesId
      )
    );
  });

  it("uses native ECS by default and reserves the synthetic reducer for an explicit diagnostic", () => {
    delete process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;
    assert.equal(nativeRoadAheadEcsAuthorityEnabled(), true);
    process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";
    assert.equal(nativeRoadAheadEcsAuthorityEnabled(), false);
  });

  it("disables timer-based health regeneration while native ECS owns vitals", () => {
    delete process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY;
    assert.equal(playerHealthAutoRegenerationEnabled(), false);
    process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY = "0";
    assert.equal(playerHealthAutoRegenerationEnabled(), true);
  });

  it("names the exact unfinished objective before an early container claim", () => {
    const fired = new Map<BiomesId, unknown>([
      [NATIVE_ROAD_AHEAD_STEP_IDS.TALK_TO_JACKIE, 1],
      [NATIVE_ROAD_AHEAD_STEP_IDS.MEET_BILLY, 1],
      [NATIVE_ROAD_AHEAD_STEP_IDS.FIND_MUCKWAD, 1],
      [NATIVE_ROAD_AHEAD_STEP_IDS.COLLECT_SIX_MUCKWAD, 1],
    ]);
    assert.deepEqual(
      nativeRoadAheadFirstIncompletePriorStep(
        fired,
        NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP
      ),
      {
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_MUCKWAD_TO_BILLY,
        objective: "Return the Muckwad to Billy",
      }
    );
  });

  it("routes native quest-giver props through ECS dialogue", () => {
    delete process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY;
    assert.equal(
      nativeQuestGiverUsesEcsDialogue({ concurrent_quests: 1 }),
      true
    );
    assert.equal(nativeQuestGiverUsesEcsDialogue(undefined), false);
    assert.equal(
      nativeQuestGiverUsesEcsDialogue(
        { concurrent_quests: 1 },
        "Clothing Crate"
      ),
      false,
      "quest metadata must not turn a storage prop into an NPC"
    );
    assert.equal(
      nativeQuestGiverUsesEcsDialogue(
        { concurrent_quests: 1 },
        "Chest The Grove Underwater Main"
      ),
      false,
      "Busted's quest-giver chest must keep its container shortcut"
    );
    for (const spec of Object.values(NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS)) {
      assert.equal(isNativeRobotStoryCrateDialogueLabel(spec.label), true);
      assert.equal(
        nativeQuestGiverUsesEcsDialogue(
          { concurrent_quests: 1 },
          spec.label
        ),
        true,
        `${spec.label} must open its authored reward dialogue, not storage`
      );
    }
    process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY = "0";
    assert.equal(
      nativeQuestGiverUsesEcsDialogue({ concurrent_quests: 1 }),
      false
    );
    delete process.env.NEXT_PUBLIC_BIOMES_NATIVE_ECS_AUTHORITY;
  });

  it("recognizes the snapshot quest-giver containers that use private native inventory", () => {
    assert.equal(isNativeRoadAheadQuestObjectLabel("Clothing Crate"), true);
    assert.equal(isNativeRoadAheadQuestObjectLabel("Billy's Toolbag"), true);
    assert.equal(isNativeRoadAheadQuestObjectLabel("First-Aid Bin"), false);
  });

  it("keeps concrete ECS source ids separate from placeable biscuit ids", () => {
    assert.deepEqual(
      {
        sourceEntityId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.sourceEntityId,
        placeableItemId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.placeableItemId,
      },
      {
        sourceEntityId: 5165478204703095,
        placeableItemId: 6720083171323032,
      }
    );
    assert.deepEqual(
      NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.position,
      [231.5, 67, -82.5]
    );
    assert.deepEqual(
      {
        sourceEntityId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.sourceEntityId,
        placeableItemId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.placeableItemId,
      },
      {
        sourceEntityId: 5682301664350905,
        placeableItemId: 6811733198167399,
      }
    );
    assert.deepEqual(
      NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.position,
      [244.5, 58, -110.5]
    );
    for (const spec of Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS)) {
      assert.notEqual(spec.sourceEntityId, spec.placeableItemId);
      for (const label of spec.labels) {
        assert.equal(nativeRoadAheadContainerSpecForLabel(label), spec);
      }
    }
  });

  it("seeds every authored clothing choice and maps transfers to original claim leaves", () => {
    const topChoices = [
      4537020877770135, 6561590643697708, 1152171766050944,
    ] as const;
    const bottomsChoices = [
      1534621126189793, 6407921801695863, 2512451111844299,
    ] as const;
    assert.deepEqual(nativeRoadAheadContainerItemIds("Clothing Crate"), [
      ...topChoices,
      ...bottomsChoices,
    ]);
    assert.deepEqual(nativeRoadAheadContainerItemIds("Billy's Toolbag"), [
      NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.choices[0].seedItemId,
    ]);
    assert.deepEqual(
      nativeRoadAheadContainerClaimForItem(
        "Clothing Crate",
        4537020877770135 as BiomesId
      ),
      {
        sourceEntityId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.sourceEntityId,
        placeableItemId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.placeableItemId,
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
        chosenRewardIndex: 0,
      }
    );
    assert.equal(
      nativeRoadAheadContainerClaimForItem(
        "Clothing Crate",
        1152171766050944 as BiomesId
      )?.chosenRewardIndex,
      2
    );
    assert.deepEqual(
      nativeRoadAheadContainerClaimForItem(
        "Billys Bag",
        NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.choices[0].seedItemId
      ),
      {
        sourceEntityId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.sourceEntityId,
        placeableItemId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.placeableItemId,
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG,
        chosenRewardIndex: 0,
      }
    );
    const bottomsClaim = nativeRoadAheadContainerClaimForItem(
      "Clothing Crate",
      BikkieIds.muckySkirt
    );
    assert.equal(bottomsClaim?.sourceEntityId, 5165478204703095);
    assert.equal(bottomsClaim?.placeableItemId, 6720083171323032);
    assert.equal(
      bottomsClaim?.stepId,
      NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS
    );
    assert.equal(bottomsClaim?.chosenRewardIndex, 0);
    assert.equal(
      nativeRoadAheadContainerClaimForItem("First-Aid Bin", BikkieIds.muckyTop),
      undefined
    );
  });

  it("binds Busted's underwater reward to the exact snapshot chest and item", () => {
    assert.deepEqual(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC, {
      labels: ["chest the grove underwater main"],
      sourceEntityId: 4149747832010135,
      placeableItemId: 5979991977107628,
      position: [528.5, 59, -96.5],
      stepId: 6798640337192760,
      itemId: 7077725005403292,
      returnNpcTypeId: 2345000310921173,
    });
    assert.equal(
      isNativeBustedUnderwaterContainerLabel("Chest The Grove Underwater Main"),
      true
    );
    assert.deepEqual(
      nativeBustedUnderwaterContainerClaimForItem(
        "Chest The Grove Underwater Main",
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
      ),
      {
        challengeId: NATIVE_BUSTED_QUEST_ID,
        sourceEntityId: 4149747832010135,
        placeableItemId: 5979991977107628,
        stepId: 6798640337192760,
        chosenRewardIndex: 0,
      }
    );
    assert.equal(
      nativeBustedUnderwaterContainerClaimForItem(
        "Chest The Grove Underwater Main",
        BikkieIds.muckyTop
      ),
      undefined
    );
  });

  it("names Busted's exact missing prior objective before the underwater claim", () => {
    const claim = nativeQuestContainerClaimForItem(
      "Chest The Grove Underwater Main",
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
    );
    assert.ok(claim);
    const fired = new Map<BiomesId, unknown>([
      [310783173745175 as BiomesId, 1],
      [859994236864492 as BiomesId, 1],
    ]);
    assert.deepEqual(
      nativeQuestContainerFirstIncompletePriorStep(
        fired,
        claim!.challengeId,
        claim!.stepId
      ),
      {
        stepId: 3346948724689018 as BiomesId,
        objective: "Talk to Doc",
      }
    );
  });
});
