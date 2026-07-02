import assert from "assert";
import {
  advanceSnapshotMissionProgress,
  chooseSnapshotMissionStep,
  type SnapshotMissionProgress,
  type SnapshotMissionStep,
} from "../snapshot_mission_advance";

// A trimmed Road Ahead chain mirroring the real triggers/order.
const ROAD_AHEAD: SnapshotMissionStep[] = [
  { id: "ra_0_meet_jackie", questId: "road_ahead", stepIndex: 0, trigger: "talk_npc", markerId: "npc_jackie" },
  { id: "ra_1_road_post", questId: "road_ahead", stepIndex: 1, trigger: "near_location", markerId: "old_grove_road_post" },
  { id: "ra_2_muckwad", questId: "road_ahead", stepIndex: 2, trigger: "destroy", markerId: "muckwad_patch", expectedInventoryItems: ["muckwad_sample"] },
  { id: "ra_3_place", questId: "road_ahead", stepIndex: 3, trigger: "place_voxel", markerId: "building_practice_spot" },
  { id: "ra_4_wear", questId: "road_ahead", stepIndex: 4, trigger: "inventory_change", markerId: "lovely_locks_mirror" },
  { id: "ra_7_axe", questId: "road_ahead", stepIndex: 7, trigger: "destroy", markerId: "muckwad_patch" },
  { id: "ra_9_return", questId: "road_ahead", stepIndex: 9, trigger: "talk_npc", markerId: "npc_jackie" },
];

function freshProgress(): SnapshotMissionProgress {
  return {
    acceptedMissionIds: [],
    activeMissionId: undefined,
    activeStepIndex: 0,
    completedStepIds: [],
    completedMissionIds: [],
    grantedItemIds: [],
    grantedRewardIds: [],
  };
}

const matchTrigger = (kind: string) => (t: SnapshotMissionStep) => t.trigger === kind;

describe("snapshot mission advance (order-independent)", () => {
  it("advances an OUT-OF-ORDER action even when the mission was never accepted", () => {
    // The exact live bug: player breaks muckwad before ever talking to Jackie.
    const state = freshProgress();
    const chosen = chooseSnapshotMissionStep(
      state,
      ROAD_AHEAD,
      matchTrigger("destroy"),
      "muckwad_patch"
    );
    assert.ok(chosen, "a destroy step is chosen");
    assert.equal(chosen!.id, "ra_2_muckwad");
    const out = advanceSnapshotMissionProgress(state, ROAD_AHEAD, chosen!);
    assert.deepEqual(out.state.acceptedMissionIds, ["road_ahead"]); // auto-accepted
    assert.equal(out.state.activeMissionId, "road_ahead");
    assert.ok(out.state.completedStepIds.includes("ra_2_muckwad"));
    assert.deepEqual(out.state.grantedItemIds, ["muckwad_sample"]);
    // activeStepIndex points at the first still-incomplete step (Meet Jackie).
    assert.equal(out.state.activeStepIndex, 0);
    assert.equal(out.completedMission, false);
  });

  it("does not re-complete an already-completed step; picks the next matching one", () => {
    let state = freshProgress();
    // First destroy completes muckwad step.
    let chosen = chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger("destroy"), "muckwad_patch")!;
    state = advanceSnapshotMissionProgress(state, ROAD_AHEAD, chosen).state;
    assert.equal(chosen.id, "ra_2_muckwad");
    // Second destroy advances the LATER destroy step (busted axe), not the same one.
    chosen = chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger("destroy"), "muckwad_patch")!;
    assert.equal(chosen.id, "ra_7_axe");
  });

  it("prefers a marker-id match when multiple steps share a trigger", () => {
    const state = freshProgress();
    // talk_npc matches step 0 (jackie) and step 9 (return, also jackie) — earliest wins.
    const chosen = chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger("talk_npc"), "npc_jackie")!;
    assert.equal(chosen.id, "ra_0_meet_jackie");
  });

  it("completes the mission when the final step is done", () => {
    // Pre-complete everything except the final return step.
    let state: SnapshotMissionProgress = {
      ...freshProgress(),
      completedStepIds: ROAD_AHEAD.filter((s) => s.id !== "ra_9_return").map((s) => s.id),
      acceptedMissionIds: ["road_ahead"],
      activeMissionId: "road_ahead",
    };
    const chosen = chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger("talk_npc"), "npc_jackie")!;
    assert.equal(chosen.id, "ra_9_return"); // step 0 already complete, so the return step
    const out = advanceSnapshotMissionProgress(state, ROAD_AHEAD, chosen);
    assert.equal(out.completedMission, true);
    assert.ok(out.state.completedMissionIds.includes("road_ahead"));
    assert.equal(out.state.activeMissionId, undefined);
  });

  it("returns undefined when nothing matches (no phantom advance)", () => {
    const state = freshProgress();
    assert.equal(
      chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger("fishing_catch")),
      undefined
    );
  });

  it("advancing through the whole chain in random order completes it", () => {
    let state = freshProgress();
    const order = ["place_voxel", "destroy", "talk_npc", "inventory_change", "near_location", "destroy", "talk_npc"];
    for (const kind of order) {
      const chosen = chooseSnapshotMissionStep(state, ROAD_AHEAD, matchTrigger(kind), "npc_jackie");
      if (chosen) {
        state = advanceSnapshotMissionProgress(state, ROAD_AHEAD, chosen).state;
      }
    }
    // All 7 steps completed regardless of the scrambled order.
    assert.equal(state.completedStepIds.length, ROAD_AHEAD.length);
    assert.ok(state.completedMissionIds.includes("road_ahead"));
  });
});
