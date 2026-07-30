import type { QuestStepBundle } from "@/client/components/challenges/helpers";
import {
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS,
} from "@/shared/harthmere/native_road_ahead_contract";

/**
 * Return the exact authoritative robot-setup claim that naming should finish.
 * Keeping the identity check here prevents a rename from accidentally
 * completing an unrelated transmission that also targets the player's robot.
 */
export function activeRobotSetupStepForNaming(
  steps: readonly QuestStepBundle[]
): QuestStepBundle | undefined {
  return steps.find(
    (step) =>
      step.questBundle.state === "in_progress" &&
      Number(step.questBundle.biscuit.id) ===
        Number(NATIVE_GIMME_SHELTER_QUEST_ID) &&
      Number(step.step.id) ===
        Number(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT) &&
      step.step.payload.kind === "completeQuestStepAtMyRobot" &&
      !step.stepCompleted
  );
}
