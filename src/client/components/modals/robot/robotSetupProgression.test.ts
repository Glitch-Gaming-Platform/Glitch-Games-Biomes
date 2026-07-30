import { activeRobotSetupStepForNaming } from "@/client/components/modals/robot/robotSetupProgression";
import {
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS,
} from "@/shared/harthmere/native_road_ahead_contract";
import assert from "assert";

describe("robot setup naming progression", () => {
  const setupStep = {
    questBundle: {
      state: "in_progress",
      biscuit: { id: NATIVE_GIMME_SHELTER_QUEST_ID },
    },
    step: {
      id: NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT,
      payload: { kind: "completeQuestStepAtMyRobot" },
    },
    stepCompleted: false,
  } as any;

  it("selects only the active Gimme Shelter setup claim", () => {
    assert.equal(activeRobotSetupStepForNaming([setupStep]), setupStep);
    assert.equal(
      activeRobotSetupStepForNaming([
        {
          ...setupStep,
          questBundle: {
            ...setupStep.questBundle,
            biscuit: { id: 123 },
          },
        },
      ]),
      undefined
    );
    assert.equal(
      activeRobotSetupStepForNaming([{ ...setupStep, stepCompleted: true }]),
      undefined
    );
  });
});
