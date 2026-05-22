import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { staleOkDistance } from "@/server/logic/events/handlers/distance";
import type { ClaimEntityIdentity } from "@/server/logic/events/handlers/quest_step_validation";
import { validateClaimStep } from "@/server/logic/events/handlers/quest_step_validation";
import { q } from "@/server/logic/events/query";
import { getBiscuit } from "@/shared/bikkie/active";
import { secondsSinceEpoch } from "@/shared/ecs/config";

export const acceptChallengeEventHandler = makeEventHandler(
  "acceptChallengeEvent",
  {
    mergeKey: (event) => event.id,
    involves: (event) => ({
      player: q.id(event.id),
      npc: q.id(event.npc_id),
    }),
    apply: ({ player, npc }, event, context) => {
      // TODO: currently we are not enforcing that the player is talking to the correct
      //       type of NPC id here
      if (!player.challenges()?.available.has(event.challenge_id)) {
        throw new RollbackError("Requested challenge was not available");
      }

      if (staleOkDistance(npc, player) > CONFIG.gameMaxTalkDistance) {
        throw new RollbackError("Talking distance is too large");
      }

      player.mutableChallenges()?.in_progress.add(event.challenge_id);
      player
        .mutableChallenges()
        ?.started_at.set(event.challenge_id, secondsSinceEpoch());
      player.mutableChallenges()?.available.delete(event.challenge_id);
      context.publish({
        kind: "challengeUnlocked",
        entityId: player.id,
        challenge: event.challenge_id,
      });
    },
  }
);

export const completeQuestStepAtEntityEventHandler = makeEventHandler(
  "completeQuestStepAtEntityEvent",
  {
    mergeKey: (event) => event.id,
    involves: (event) => ({
      player: q.id(event.id),
      claimFromEntity: q.id(event.entity_id).with("position"),
    }),
    apply: ({ player, claimFromEntity }, event, context) => {
      if (
        staleOkDistance(claimFromEntity, player) > CONFIG.gameMaxTalkDistance
      ) {
        throw new RollbackError("Talking distance is too large");
      }

      // ------------------------------------------------------------------
      // Server-authoritative validation. The bug this guards against:
      //
      //   The client used to be able to claim ANY step_id for ANY quest
      //   against ANY entity and the server would publish the firehose
      //   event without checking. That made it possible to bypass
      //   intermediate objectives (go inspect the painting, defeat the
      //   ratlord, collect the candle...) and just talk to the NPC to
      //   "complete" the quest, and also made every casual "Talk" press
      //   on an NPC risk advancing a quest that should still be in
      //   progress.
      //
      // We re-derive: is the step a real claim-step in this quest, is the
      // player on this quest, is every prior seq objective fired, is the
      // entity the right one? If any of those checks fail, we throw a
      // RollbackError instead of publishing — the trigger engine will then
      // never see a matching `completeQuestStepAtEntity` event for the
      // ChallengeClaimRewardsTrigger leaf to satisfy.
      // ------------------------------------------------------------------
      if (event.step_id === undefined) {
        // step_id is structurally optional in the firehose event schema,
        // but a quest claim without it is always invalid. Rolling back
        // (vs. silently dropping) keeps client UX explicit.
        throw new RollbackError("Quest step claim missing step_id");
      }

      const isRobot = !!claimFromEntity.robotComponent();
      const creatorId = claimFromEntity.createdBy()?.id;
      const isMyRobot = isRobot && creatorId === player.id;

      const claimEntity: ClaimEntityIdentity = {
        entityId: claimFromEntity.id,
        npcTypeId: claimFromEntity.npcMetadata()?.type_id,
        placeableItemId: claimFromEntity.placeableComponent()?.item_id,
        isMyRobot,
      };

      // The quest biscuit holds the authored trigger tree. We walk it raw
      // — no need to deserialize into Trigger classes — to find the leaf
      // and its `seq` prerequisites.
      const questBiscuit = getBiscuit(event.challenge_id);
      const validation = validateClaimStep({
        challengeId: event.challenge_id,
        stepId: event.step_id,
        questTrigger: questBiscuit.trigger,
        challenges: player.challenges(),
        triggerStateForChallenge: player
          .triggerState()
          ?.by_root.get(event.challenge_id),
        claimEntity,
      });

      if (!validation.ok) {
        // "step_already_completed" is idempotent: another concurrent
        // submission already advanced the quest. We don't roll back the
        // surrounding apply (there may be no surrounding state mutation
        // anyway), we just decline to republish a duplicate firehose
        // event.
        if (validation.reason === "step_already_completed") {
          return;
        }
        // Everything else is a genuine misuse — bad step_id, wrong NPC,
        // out-of-order objective. Rolling back is the right answer so the
        // client gets unambiguous feedback and the trigger engine never
        // sees the event.
        throw new RollbackError(
          `Quest step claim rejected: ${validation.reason}` +
            (validation.details ? ` (${validation.details})` : "")
        );
      }

      if (isMyRobot) {
        context.publish({
          kind: "completeQuestStepAtMyRobot",
          challenge: event.challenge_id,
          entityId: player.id,
          chosenRewardIndex: event.chosen_reward_index,
          stepId: event.step_id,
        });
      }

      context.publish({
        kind: "completeQuestStepAtEntity",
        challenge: event.challenge_id,
        claimFromEntityId: claimFromEntity.id,
        entityId: player.id,
        chosenRewardIndex: event.chosen_reward_index,
        stepId: event.step_id,
      });
    },
  }
);

export const resetChallengeEventHandler = makeEventHandler(
  "resetChallengeEvent",
  {
    mergeKey: (event) => event.id,
    involves: (event) => ({
      player: q.id(event.id),
    }),
    apply: ({ player }, event) => {
      if (!player.challenges()?.in_progress.has(event.challenge_id)) {
        return;
      }
      player.mutableChallenges()?.in_progress.delete(event.challenge_id);
      player.mutableChallenges()?.available.add(event.challenge_id);
      player.mutableTriggerState().by_root.delete(event.challenge_id);
    },
  }
);
