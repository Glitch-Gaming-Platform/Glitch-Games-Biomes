import assert from "assert";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
};
function installWindowShim() {
  (globalThis as any).window = {
    localStorage: localStorageMock,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

installWindowShim();

import {
  recordSnapshotRoadAheadChallengeStepForBiomesUIV73,
  readSnapshotMissionStateV71,
  snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUIV73,
  snapshotRoadAheadMissionStepsForBiomesUIV73,
  snapshotRoadAheadTrackableQuestsForBiomesUIV73,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import { NUXES, NUX_PAIRED_STEPS } from "@/client/util/nux/state_machines";

describe("LocalDevSnapshotMissionBridge Road Ahead UI projection", () => {
  beforeEach(() => {
    storage.clear();
    installWindowShim();
  });

  it("records native Road Ahead step events into the UI mirror without requiring legacy acceptance", () => {
    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD,
        "begin"
      ),
      true
    );

    let state = readSnapshotMissionStateV71();
    assert.equal(state.accepted, true);
    assert.equal(state.currentStepIndex, 2);
    assert.deepEqual(state.completedStepIds, [
      "meet_jackie_in_grove",
      "road_ahead_meet_up_with_billy",
    ]);
    assert.equal(
      snapshotRoadAheadTrackableQuestsForBiomesUIV73(state)[0]?.objective,
      "Break a muckwad or another soft non-flora block near the road."
    );

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD,
        "complete"
      ),
      true
    );
    state = readSnapshotMissionStateV71();
    assert.equal(state.currentStepIndex, 3);
    assert.ok(state.completedStepIds.includes("road_ahead_collect_muckwad"));
    assert.equal(
      snapshotRoadAheadTrackableQuestsForBiomesUIV73(state)[0]?.objective,
      "Equip any block and place it on the ground."
    );
  });

  it("projects active NUX state into Road Ahead objectives without writing bridge state", () => {
    const hints =
      snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUIV73([
        { nuxId: NUXES.WEAR_STUFF, stateId: "wear_stuff_prompt_inventory" },
      ]);
    assert.deepEqual(hints, [NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR]);

    const quest = snapshotRoadAheadTrackableQuestsForBiomesUIV73(
      undefined,
      hints
    )[0];
    assert.equal(quest?.status, "active");
    assert.equal(quest?.firstMarkerId, "wardrobe");
    assert.equal(
      quest?.objective,
      "Wear a top and bottoms from your inventory."
    );
    assert.equal(readSnapshotMissionStateV71().accepted, false);

    const steps = snapshotRoadAheadMissionStepsForBiomesUIV73(undefined, hints);
    assert.equal(steps[0]?.done, true);
    assert.equal(steps[1]?.done, true);
    assert.equal(steps[2]?.done, true);
    assert.equal(steps[3]?.title, "Current step 4");
    assert.equal(steps[3]?.done, false);
  });
});
