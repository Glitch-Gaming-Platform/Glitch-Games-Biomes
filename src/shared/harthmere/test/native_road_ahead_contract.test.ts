import assert from "assert";
import {
  NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
  NATIVE_ROAD_AHEAD_ORDERED_STEP_IDS,
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_ROAD_AHEAD_STEP_IDS,
  isNativeRoadAheadQuestObjectLabel,
  nativeRoadAheadEcsAuthorityEnabled,
} from "@/shared/harthmere/native_road_ahead_contract";

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

  it("recognizes the snapshot quest-giver containers that must not be locally looted", () => {
    assert.equal(isNativeRoadAheadQuestObjectLabel("Clothing Crate"), true);
    assert.equal(isNativeRoadAheadQuestObjectLabel("Billy's Toolbag"), true);
    assert.equal(isNativeRoadAheadQuestObjectLabel("First-Aid Bin"), false);
  });
});
