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
  handleSnapshotRoadAheadEventForTest,
  recordSnapshotRoadAheadChallengeStepForBiomesUI,
  readSnapshotMissionState,
  snapshotRoadAheadHasLocalMuckClearingToolForTest,
  snapshotRoadAheadHasRequiredClothingForTest,
  snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUI,
  snapshotRoadAheadMissionStepsForBiomesUI,
  snapshotRoadAheadTrackableQuestsForBiomesUI,
  writeSnapshotMissionState,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  readHarthmereInventoryState,
  writeHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
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
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD,
        "begin"
      ),
      true
    );

    let state = readSnapshotMissionState();
    assert.equal(state.accepted, true);
    assert.equal(state.currentStepIndex, 2);
    assert.deepEqual(state.completedStepIds, [
      "meet_jackie_in_grove",
      "road_ahead_meet_up_with_billy",
    ]);
    assert.equal(
      snapshotRoadAheadTrackableQuestsForBiomesUI(state)[0]?.objective,
      "Break a muckwad or another soft non-flora block near the road."
    );

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD,
        "complete"
      ),
      true
    );
    state = readSnapshotMissionState();
    assert.equal(state.currentStepIndex, 3);
    assert.ok(state.completedStepIds.includes("road_ahead_collect_muckwad"));
    assert.equal(
      snapshotRoadAheadTrackableQuestsForBiomesUI(state)[0]?.objective,
      "Equip any block and place it on the ground."
    );
  });

  it("projects active NUX state into Road Ahead objectives without writing bridge state", () => {
    const hints =
      snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUI([
        { nuxId: NUXES.WEAR_STUFF, stateId: "wear_stuff_prompt_inventory" },
      ]);
    assert.deepEqual(hints, [NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR]);

    const quest = snapshotRoadAheadTrackableQuestsForBiomesUI(
      undefined,
      hints
    )[0];
    assert.equal(quest?.status, "active");
    assert.equal(quest?.firstMarkerId, "wardrobe");
    assert.equal(
      quest?.objective,
      "Wear a top and bottoms from your inventory."
    );
    assert.equal(readSnapshotMissionState().accepted, false);

    const steps = snapshotRoadAheadMissionStepsForBiomesUI(undefined, hints);
    assert.equal(steps[0]?.done, true);
    assert.equal(steps[1]?.done, true);
    assert.equal(steps[2]?.done, true);
    assert.equal(steps[3]?.title, "Current step 4");
    assert.equal(steps[3]?.done, false);
  });

  it("keeps the current Road Ahead bridge completable from legacy native step events", () => {
    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.ROAD_AHEAD_MEET_UP_WITH_BILLY,
        "begin"
      ),
      true
    );
    assert.equal(readSnapshotMissionState().currentStepIndex, 1);

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.ROAD_AHEAD_MEET_UP_WITH_BILLY,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionState().currentStepIndex, 2);

    handleSnapshotRoadAheadEventForTest({
      kind: "destroy",
      terrainId: 1 as any,
    });
    assert.equal(readSnapshotMissionState().currentStepIndex, 3);

    const placeResult = handleSnapshotRoadAheadEventForTest({
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
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionState().currentStepIndex, 5);

    handleSnapshotRoadAheadEventForTest({
      kind: "jump",
      running: true,
    });
    assert.equal(readSnapshotMissionState().currentStepIndex, 6);

    handleSnapshotRoadAheadEventForTest({
      kind: "photo_post_attempt",
    });
    assert.equal(readSnapshotMissionState().currentStepIndex, 7);

    handleSnapshotRoadAheadEventForTest({
      kind: "destroy",
      terrainId: 1 as any,
    });
    assert.equal(readSnapshotMissionState().currentStepIndex, 8);

    assert.equal(
      recordSnapshotRoadAheadChallengeStepForBiomesUI(
        NUX_PAIRED_STEPS.BUSTED_MUCK_BUSTERS,
        "complete"
      ),
      true
    );
    assert.equal(readSnapshotMissionState().currentStepIndex, 9);

    const finalResult = handleSnapshotRoadAheadEventForTest({
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
    writeSnapshotMissionState({
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

    handleSnapshotRoadAheadEventForTest({ kind: "inventory_change" });
    assert.equal(readSnapshotMissionState().currentStepIndex, 3);

    const result = handleSnapshotRoadAheadEventForTest({
      kind: "block_inventory_throw",
    });
    assert.equal(result.state.currentStepIndex, 4);
    assert.ok(
      result.state.completedStepIds.includes("road_ahead_place_blocks")
    );
  });

  it("counts local Harthmere equipped clothes for the Road Ahead clothing step", () => {
    const state = readHarthmereInventoryState();
    try {
      writeHarthmereInventoryState({
        ...state,
        equipment: {
          ...state.equipment,
          chest: {
            instanceId: "test_baker_apron",
            itemId: "baker_apron",
            location: "equipment",
            equipmentSlot: "chest",
            quantity: 1,
            bound: false,
            stolen: false,
            locked: false,
            enchantments: [],
            acquiredAt: 1,
          },
          legs: {
            instanceId: "test_field_trousers",
            itemId: "field_trousers",
            location: "equipment",
            equipmentSlot: "legs",
            quantity: 1,
            bound: false,
            stolen: false,
            locked: false,
            enchantments: [],
            acquiredAt: 1,
          },
        },
      });

      assert.equal(
        snapshotRoadAheadHasRequiredClothingForTest({
          items: { get: () => undefined },
        }),
        true
      );
    } finally {
      writeHarthmereInventoryState(state);
    }
  });

  it("counts the local Harthmere muck rake for the Road Ahead Muck Buster step", () => {
    const state = readHarthmereInventoryState();
    try {
      writeHarthmereInventoryState({
        ...state,
        backpack: {
          ...state.backpack,
          items: [
            {
              instanceId: "test_muck_rake",
              itemId: "muck_rake",
              location: "backpack",
              slotIndex: 0,
              quantity: 1,
              bound: false,
              stolen: false,
              locked: false,
              enchantments: [],
              acquiredAt: 1,
            },
          ],
        },
      });

      assert.equal(snapshotRoadAheadHasLocalMuckClearingToolForTest(), true);
    } finally {
      writeHarthmereInventoryState(state);
    }
  });
});
