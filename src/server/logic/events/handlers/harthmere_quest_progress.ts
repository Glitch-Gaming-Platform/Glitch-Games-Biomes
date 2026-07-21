import { validateHarthmereQuestProgressAuthorization } from "@/server/harthmere/native_quest_progress_token";
import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { getBiscuit } from "@/shared/bikkie/active";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";

function triggerContainsStep(
  trigger: StoredTriggerDefinition | undefined,
  stepId: number
): boolean {
  if (!trigger) return false;
  if (trigger.id === stepId && trigger.kind === "event") return true;
  if (
    (trigger.kind === "all" ||
      trigger.kind === "any" ||
      trigger.kind === "seq") &&
    trigger.triggers.some((child) => triggerContainsStep(child, stepId))
  ) {
    return true;
  }
  return false;
}

/** Publish only signed, currently active, manifest-backed objective evidence. */
export const harthmereQuestProgressEventHandler = makeEventHandler(
  "harthmereQuestProgressEvent",
  {
    involves: (event) => ({ player: q.player(event.id) }),
    apply: ({ player }, event, context) => {
      if (
        !validateHarthmereQuestProgressAuthorization(
          {
            id: event.id,
            challenge_id: event.challenge_id,
            step_id: event.step_id,
          },
          event.authorization
        )
      ) {
        throw new RollbackError(
          "Harthmere quest progress authorization failed"
        );
      }
      if (!player.delta().challenges()?.in_progress.has(event.challenge_id)) {
        throw new RollbackError("Harthmere quest is not in progress");
      }
      const quest = getBiscuit(event.challenge_id);
      if (
        !quest.isQuest ||
        !triggerContainsStep(quest.trigger, event.step_id)
      ) {
        throw new RollbackError("Unknown Harthmere quest objective");
      }
      context.publish({
        kind: "harthmereQuestProgress",
        entityId: player.id,
        challengeId: event.challenge_id,
        stepId: event.step_id,
      });
    },
  }
);
