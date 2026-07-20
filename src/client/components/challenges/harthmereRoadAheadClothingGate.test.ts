// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE:
// The Clothing Crate must stay empty until The Road Ahead has completed the
// Billy/Muckwad handoff and advanced into the place-block step. These tests pin
// the predicate that decides "is it the right time?" across the ways the mission
// state can express progress.
import assert from "assert";

process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";

import {
  ROAD_AHEAD_CLOTHING_STEP_ID,
  ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID,
  ROAD_AHEAD_CLOTHING_STOCK_STEP_ID,
  ROAD_AHEAD_MISSION_ID,
  ROAD_AHEAD_STEP_ORDER,
  roadAheadClothingCrateReady,
} from "@/client/components/challenges/harthmereRoadAheadClothingGate";

const STOCK_INDEX = ROAD_AHEAD_STEP_ORDER.indexOf(
  ROAD_AHEAD_CLOTHING_STOCK_STEP_ID
);
const WEAR_INDEX = ROAD_AHEAD_STEP_ORDER.indexOf(ROAD_AHEAD_CLOTHING_STEP_ID);

describe("road ahead clothing gate", () => {
  it("step order matches the authored Road Ahead chain (drift guard)", () => {
    // If the canonical Road Ahead source reorders steps this gate follows it.
    assert.equal(ROAD_AHEAD_STEP_ORDER[0], "meet_jackie_in_grove");
    assert.equal(STOCK_INDEX, 3);
    assert.equal(WEAR_INDEX, 4);
    assert.equal(
      ROAD_AHEAD_STEP_ORDER[STOCK_INDEX - 1],
      ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID
    );
  });

  it("is NOT ready before the mission is accepted", () => {
    assert.equal(roadAheadClothingCrateReady(undefined), false);
    assert.equal(roadAheadClothingCrateReady(null), false);
    assert.equal(
      roadAheadClothingCrateReady({ accepted: false, currentStepIndex: 0 }),
      false
    );
  });

  it("is NOT ready in the early steps (before the Muckwad handoff is done)", () => {
    for (let idx = 0; idx < STOCK_INDEX; idx += 1) {
      assert.equal(
        roadAheadClothingCrateReady({
          accepted: true,
          currentStepIndex: idx,
          completedStepIds: ROAD_AHEAD_STEP_ORDER.slice(0, idx),
        }),
        false,
        `should be locked at step index ${idx}`
      );
    }
  });

  it("becomes ready at the post-Muckwad place-block step (by index)", () => {
    assert.equal(
      roadAheadClothingCrateReady({
        accepted: true,
        currentStepIndex: STOCK_INDEX,
      }),
      true
    );
  });

  it("becomes ready when the Muckwad handoff step is completed (by step id)", () => {
    assert.equal(
      roadAheadClothingCrateReady({
        accepted: true,
        currentStepIndex: 0, // index lagging, but completedStepIds knows better
        completedStepIds: [ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID],
      }),
      true
    );
  });

  it("remains ready at the later gear-up step", () => {
    assert.equal(
      roadAheadClothingCrateReady({
        accepted: true,
        currentStepIndex: WEAR_INDEX,
      }),
      true
    );
  });

  it("treats an active-map entry as accepted", () => {
    assert.equal(
      roadAheadClothingCrateReady({
        active: { [ROAD_AHEAD_MISSION_ID]: WEAR_INDEX },
        currentStepIndex: WEAR_INDEX,
      }),
      true
    );
  });

  it("is ready once the whole mission is completed", () => {
    assert.equal(
      roadAheadClothingCrateReady({
        accepted: false,
        currentStepIndex: 0,
        completed: [ROAD_AHEAD_MISSION_ID],
      }),
      true
    );
  });
});
