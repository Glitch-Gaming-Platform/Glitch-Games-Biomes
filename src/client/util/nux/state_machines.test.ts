/// <reference types="mocha" />
import assert from "assert";
import {
  ALL_NUXES,
  NUXES,
  NUX_PAIRED_STEPS,
} from "@/client/util/nux/state_machines";

describe("Road Ahead NUX state machines", () => {
  it("completes the place-block prompt when the player places a voxel", () => {
    const placeBlocksNux = ALL_NUXES.find(
      (definition) => definition.id === NUXES.PLACE_BLOCKS
    );
    assert.ok(placeBlocksNux);

    const result = (placeBlocksNux.states as any).place_blocks_place.advance(
      {
        userId: 1 as any,
        resources: {
          get: () => undefined,
        } as any,
      },
      { id: "place_blocks_place", localStartTime: 0 },
      { kind: "place_voxel" } as any
    );

    assert.equal(result, "complete");
  });

  it("completes the run-and-jump prompt from the native step completion mirror", () => {
    const runAndJumpNux = ALL_NUXES.find(
      (definition) => definition.id === NUXES.RUN_AND_JUMP
    );
    assert.ok(runAndJumpNux);

    const result = (runAndJumpNux.states as any).run_and_jump_run.advance(
      {
        userId: 1 as any,
        resources: {
          get: () => undefined,
        } as any,
      },
      { id: "run_and_jump_run", localStartTime: 0 },
      {
        kind: "challenge_step_complete",
        stepId: NUX_PAIRED_STEPS.ROAD_AHEAD_FIND_BAG,
        triggerProgress: {} as any,
      }
    );

    assert.equal(result, "complete");
  });

  it("advances the selfie prompt when camera selection comes from local inventory", () => {
    const selfieNux = ALL_NUXES.find(
      (definition) => definition.id === NUXES.SELFIE_PHOTO
    );
    assert.ok(selfieNux);

    const result = (selfieNux.states as any).selfie_camera_equip.advance(
      {
        userId: 1 as any,
        resources: {
          get: () => ({ kind: "camera" }),
        } as any,
      },
      { id: "selfie_camera_equip", localStartTime: 0 },
      { kind: "local_inventory_selection_change" } as any
    );

    assert.deepEqual(result, { id: "selfie_camera_prompt" });
  });
});
