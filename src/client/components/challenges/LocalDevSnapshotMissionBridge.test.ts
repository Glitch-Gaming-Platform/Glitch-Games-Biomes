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
  handleSnapshotRoadAheadEventForTestV73,
  recordSnapshotRoadAheadChallengeStepForBiomesUIV73,
  readSnapshotMissionStateV71,
  snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUIV73,
  snapshotRoadAheadMissionStepsForBiomesUIV73,
  snapshotRoadAheadTrackableQuestsForBiomesUIV73,
  writeSnapshotMissionStateV71,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  JACKIE_ID,
  NUXES,
  NUX_PAIRED_STEPS,
} from "@/client/util/nux/state_machines";

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

  it("keeps the current Road Ahead bridge completable from legacy native step events", () => {
    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.ROAD_AHEAD_MEET_UP_WITH_BILLY,
        "begin"
      ),
      true
    );
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 1);

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.ROAD_AHEAD_MEET_UP_WITH_BILLY,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 2);

    handleSnapshotRoadAheadEventForTestV73({
      kind: "destroy",
      terrainId: 1 as any,
    });
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 3);

    const placeResult = handleSnapshotRoadAheadEventForTestV73({
      kind: "place_voxel",
    });
    assert.equal(placeResult.state.currentStepIndex, 4);
    assert.ok(
      placeResult.state.completedStepIds.includes("road_ahead_place_blocks")
    );
    assert.ok(
      placeResult.published.some(
        (event) =>
          event.kind === "challenge_step_complete" &&
          event.stepId === NUX_PAIRED_STEPS.ROAD_AHEAD_PLACE_BLOCKS
      )
    );
    assert.ok(
      placeResult.published.some(
        (event) =>
          event.kind === "challenge_step_begin" &&
          event.stepId === NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR
      )
    );

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 5);

    handleSnapshotRoadAheadEventForTestV73({
      kind: "jump",
      running: true,
    });
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 6);

    handleSnapshotRoadAheadEventForTestV73({
      kind: "photo_post_attempt",
    });
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 7);

    handleSnapshotRoadAheadEventForTestV73({
      kind: "destroy",
      terrainId: 1 as any,
    });
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 8);

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUIV73(
        NUX_PAIRED_STEPS.BUSTED_MUCK_BUSTERS,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 9);

    const finalResult = handleSnapshotRoadAheadEventForTestV73({
      kind: "talk_npc",
      npcId: JACKIE_ID,
    });
    assert.deepEqual(finalResult.state.completed, [
      "snapshot_road_ahead_full_chain",
    ]);
    assert.equal(
      finalResult.state.active.snapshot_road_ahead_full_chain,
      undefined
    );
  });

  it("accepts dropped block proof for the Road Ahead block placement step only when active", () => {
    writeSnapshotMissionStateV71({
      accepted: true,
      active: { snapshot_road_ahead_full_chain: 3 },
      currentStepIndex: 3,
      completedStepIds: [
        "meet_jackie_in_grove",
        "road_ahead_meet_up_with_billy",
        "road_ahead_collect_muckwad",
      ],
      completed: [],
      pinned: ["snapshot_road_ahead_full_chain"],
      rewards: [],
    });

    handleSnapshotRoadAheadEventForTestV73({ kind: "inventory_change" });
    assert.equal(readSnapshotMissionStateV71().currentStepIndex, 3);

    const result = handleSnapshotRoadAheadEventForTestV73({
      kind: "block_inventory_throw",
    });
    assert.equal(result.state.currentStepIndex, 4);
    assert.ok(
      result.state.completedStepIds.includes("road_ahead_place_blocks")
    );
  });
});
