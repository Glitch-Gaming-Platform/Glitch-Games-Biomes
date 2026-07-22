import assert from "assert";
import {
  NATIVE_ROAD_AHEAD_CONTAINER_SPECS,
  NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
  NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS,
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_ROAD_AHEAD_STEP_IDS,
  isNativeRoadAheadQuestObjectLabel,
  nativeRoadAheadContainerClaimForItem,
  nativeRoadAheadContainerItemIds,
  nativeRoadAheadContainerSpecForLabel,
  nativeQuestGiverUsesEcsDialogue,
  nativeRoadAheadEcsAuthorityEnabled,
} from "@/shared/harthmere/native_road_ahead_contract";
import { BikkieIds } from "@/shared/bikkie/ids";

describe("native Road Ahead snapshot contract", () => {
  const originalSyntheticFlag =
    process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;

  afterEach(() => {
    if (originalSyntheticFlag === undefined) {
      delete process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;
    } else {
      process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD =
        originalSyntheticFlag;
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

  it("uses native ECS by default and reserves the synthetic reducer for an explicit diagnostic", () => {
    delete process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD;
    assert.equal(nativeRoadAheadEcsAuthorityEnabled(), true);
    process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";
    assert.equal(nativeRoadAheadEcsAuthorityEnabled(), false);
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
    for (const spec of Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS)) {
      assert.notEqual(spec.sourceEntityId, spec.placeableItemId);
      for (const label of spec.labels) {
        assert.equal(nativeRoadAheadContainerSpecForLabel(label), spec);
      }
    }
  });

  it("seeds exact native Mucky clothing and maps transfers to original claim leaves", () => {
    assert.deepEqual(nativeRoadAheadContainerItemIds("Clothing Crate"), [
      BikkieIds.muckyTop,
      BikkieIds.muckySkirt,
    ]);
    assert.deepEqual(nativeRoadAheadContainerItemIds("Billy's Toolbag"), [
      NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.choices[0].seedItemId,
    ]);
    assert.deepEqual(
      nativeRoadAheadContainerClaimForItem(
        "Clothing Crate",
        BikkieIds.muckyTop
      ),
      {
        sourceEntityId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.sourceEntityId,
        placeableItemId:
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.placeableItemId,
        stepId: NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP,
        chosenRewardIndex: 0,
        siblingItemIds: [
          BikkieIds.muckyTop,
          ...NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.choices[0].itemIds,
        ],
      }
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
        siblingItemIds: [
          NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.choices[0].seedItemId,
          ...NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag.choices[0].itemIds,
        ],
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
});
