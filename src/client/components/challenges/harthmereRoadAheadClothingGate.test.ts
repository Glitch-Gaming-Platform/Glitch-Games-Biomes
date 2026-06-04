// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_V1:
// The Clothing Crate must stay empty until The Road Ahead reaches the "Gear Up"
// step (`road_ahead_wear`, index 4). These tests pin the predicate that decides
// "is it the right time?" across the ways the mission state can express progress.
import assert from "assert";

import {
  ROAD_AHEAD_CLOTHING_STEP_ID_V1,
  ROAD_AHEAD_MISSION_ID_V1,
  ROAD_AHEAD_PRECEDING_STEP_ID_V1,
  ROAD_AHEAD_STEP_ORDER_V1,
  roadAheadClothingCrateReadyV1,
} from "@/client/components/challenges/harthmereRoadAheadClothingGate";

const WEAR_INDEX = ROAD_AHEAD_STEP_ORDER_V1.indexOf(
  ROAD_AHEAD_CLOTHING_STEP_ID_V1
);

describe("road ahead clothing gate", () => {
  it("step order matches the authored Road Ahead chain (drift guard)", () => {
    // If the bridge reorders steps this must be updated in lockstep.
    assert.equal(ROAD_AHEAD_STEP_ORDER_V1[0], "meet_jackie_in_grove");
    assert.equal(WEAR_INDEX, 4);
    assert.equal(
      ROAD_AHEAD_STEP_ORDER_V1[WEAR_INDEX - 1],
      ROAD_AHEAD_PRECEDING_STEP_ID_V1
    );
  });

  it("is NOT ready before the mission is accepted", () => {
    assert.equal(roadAheadClothingCrateReadyV1(undefined), false);
    assert.equal(roadAheadClothingCrateReadyV1(null), false);
    assert.equal(
      roadAheadClothingCrateReadyV1({ accepted: false, currentStepIndex: 0 }),
      false
    );
  });

  it("is NOT ready in the early steps (before gear-up)", () => {
    for (let idx = 0; idx < WEAR_INDEX; idx += 1) {
      assert.equal(
        roadAheadClothingCrateReadyV1({
          accepted: true,
          currentStepIndex: idx,
          completedStepIds: ROAD_AHEAD_STEP_ORDER_V1.slice(0, idx),
        }),
        false,
        `should be locked at step index ${idx}`
      );
    }
  });

  it("becomes ready exactly at the gear-up step (by index)", () => {
    assert.equal(
      roadAheadClothingCrateReadyV1({
        accepted: true,
        currentStepIndex: WEAR_INDEX,
      }),
      true
    );
  });

  it("becomes ready when the preceding step is completed (by step id)", () => {
    assert.equal(
      roadAheadClothingCrateReadyV1({
        accepted: true,
        currentStepIndex: 0, // index lagging, but completedStepIds knows better
        completedStepIds: [ROAD_AHEAD_PRECEDING_STEP_ID_V1],
      }),
      true
    );
  });

  it("treats an active-map entry as accepted", () => {
    assert.equal(
      roadAheadClothingCrateReadyV1({
        active: { [ROAD_AHEAD_MISSION_ID_V1]: WEAR_INDEX },
        currentStepIndex: WEAR_INDEX,
      }),
      true
    );
  });

  it("is ready once the whole mission is completed", () => {
    assert.equal(
      roadAheadClothingCrateReadyV1({
        accepted: false,
        currentStepIndex: 0,
        completed: [ROAD_AHEAD_MISSION_ID_V1],
      }),
      true
    );
  });
});
