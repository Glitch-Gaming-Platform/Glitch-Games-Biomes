import type { Trigger, TriggerContext } from "@/server/shared/triggers/core";
import { giveRewardsFromTriggerContext } from "@/server/shared/triggers/rewards";
import { RootExecutor } from "@/server/shared/triggers/roots/root";
import { deserializeTrigger } from "@/server/shared/triggers/serde";
import { getBiscuit } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  secondsSinceEpoch,
  secondsSinceEpochToDate,
} from "@/shared/ecs/config";
import type { ReadonlyChallenges } from "@/shared/ecs/gen/components";
import type { Delta } from "@/shared/ecs/gen/delta";
import type { ChallengeState } from "@/shared/ecs/gen/types";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { reportFunnelStage } from "@/shared/funnel";
import { bagSpecToBag } from "@/shared/game/items";
import type { ItemBag } from "@/shared/game/types";
import type { BiomesId } from "@/shared/ids";
import {
  isNativeCh1PrologueHandoffQuestId,
  NATIVE_CH1_FIRST_QUEST_ID,
} from "@/shared/harthmere/ch1_native_quests";
import {
  isNativeRobotStoryAutoContinuationQuestId,
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  nativeRobotStoryPredecessorQuestId,
} from "@/shared/harthmere/native_road_ahead_contract";
import { awardHarthmereNativeQuestCompletionXp } from "@/shared/harthmere/harthmere_native_quest_xp_award";
import { log } from "@/shared/logging";
import { forcePlayerWarp } from "@/server/logic/utils/players";
import { ch1ChapterOpeningPosition } from "@/shared/harthmere/ch1_prop_seed";

const POST_MUCK_VS_MACHINE_PARALLEL_QUEST_IDS = [
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_CH1_FIRST_QUEST_ID,
] as const;

function stageChapter1Opening(entity: Delta) {
  forcePlayerWarp(
    entity,
    ch1ChapterOpeningPosition(),
    entity.orientation()?.v ?? [0, 0]
  );
}

/**
 * Muck vs. Machine fans out into two independent playable paths:
 * Gimme Shelter finishes the player's robot setup, while The Morning After
 * begins Chapter 1. Start both in the same ECS transaction so executor order,
 * a missed challengeCompleted event, or a stale "available" save cannot leave
 * Chapter 1 invisible until some unrelated later action.
 */
function startPostMuckVsMachineParallelQuests(context: {
  entity: Delta;
  publish: (event: FirehoseEvent) => void;
}) {
  const challenges = context.entity.mutableChallenges();
  if (!challenges.complete.has(NATIVE_MUCK_VS_MACHINE_QUEST_ID)) return;
  let startedChapter1 = false;
  for (const questId of POST_MUCK_VS_MACHINE_PARALLEL_QUEST_IDS) {
    if (
      challenges.complete.has(questId) ||
      challenges.in_progress.has(questId)
    ) {
      continue;
    }
    challenges.available.delete(questId);
    challenges.in_progress.add(questId);
    challenges.started_at.set(questId, secondsSinceEpoch());
    challenges.finished_at.delete(questId);
    if (questId === NATIVE_CH1_FIRST_QUEST_ID) startedChapter1 = true;
    context.publish({
      kind: "challengeUnlocked",
      entityId: context.entity.id,
      challenge: questId,
    });
  }
  if (startedChapter1) stageChapter1Opening(context.entity);
}

export class QuestExecutor extends RootExecutor {
  constructor(
    id: BiomesId,
    public readonly unlock: Trigger | undefined,
    public readonly trigger: Trigger | undefined,
    public readonly rewards: ItemBag | undefined
  ) {
    super(id);
  }

  static fromBiscuit(b: Biscuit): QuestExecutor | undefined {
    if (!b.isQuest) {
      return;
    }
    return new QuestExecutor(
      b.id,
      b.unlock ? deserializeTrigger(b.unlock) : undefined,
      b.trigger ? deserializeTrigger(b.trigger) : undefined,
      b.rewards ? bagSpecToBag(b.rewards) : undefined
    );
  }

  get biscuit(): Biscuit {
    return getBiscuit(this.id);
  }

  private userChallengeState(c: ReadonlyChallenges | undefined) {
    if (c?.complete.has(this.id)) {
      return "completed";
    }
    if (c?.in_progress.has(this.id)) {
      return "in_progress";
    }
    if (c?.available.has(this.id)) {
      return "available";
    }
    return "start";
  }

  private canRepeat(c: ReadonlyChallenges | undefined) {
    // Easy cases without checking date.
    if (
      !this.biscuit.repeatableCadence ||
      this.biscuit.repeatableCadence === "never"
    ) {
      return false;
    }
    if (this.biscuit.repeatableCadence === "always") {
      return true;
    }

    const startedDate = secondsSinceEpochToDate(
      c?.started_at.get(this.id) ?? 0
    );
    const resetDate = new Date(startedDate);
    // Daily reset at midnight UTC
    resetDate.setUTCHours(0, 0, 0, 0);
    switch (this.biscuit.repeatableCadence) {
      case "daily": {
        resetDate.setUTCDate(startedDate.getUTCDate() + 1);
        break;
      }
      case "weekly": {
        // Weekly reset on Sunday
        resetDate.setUTCDate(
          startedDate.getUTCDate() - startedDate.getUTCDay() + 7
        );
        break;
      }
      case "monthly": {
        // Monthly reset on the 1st
        resetDate.setUTCDate(1);
        resetDate.setUTCMonth(startedDate.getUTCMonth() + 1);
        break;
      }
    }
    const curDate = secondsSinceEpochToDate(secondsSinceEpoch());
    return curDate.getTime() > resetDate.getTime();
  }

  transitionState(
    context: {
      entity: Delta;
      publish: (event: FirehoseEvent) => void;
    },
    state: ChallengeState
  ): void {
    const mutChallenges = context.entity.mutableChallenges();
    const startingChapter1 =
      state === "in_progress" &&
      isNativeCh1PrologueHandoffQuestId(this.id) &&
      !mutChallenges.complete.has(this.id) &&
      !mutChallenges.in_progress.has(this.id);
    if (state === "available") {
      context.entity.mutableTriggerState().by_root.delete(this.id);
      mutChallenges.available.add(this.id);
      mutChallenges.started_at.delete(this.id);
      mutChallenges.finished_at.delete(this.id);
    } else {
      mutChallenges.available.delete(this.id);
    }

    if (state === "in_progress") {
      mutChallenges.in_progress.add(this.id);
      mutChallenges.started_at.set(this.id, secondsSinceEpoch());
      mutChallenges.finished_at.delete(this.id);
      context.publish({
        kind: "challengeUnlocked",
        entityId: context.entity.id,
        challenge: this.id,
      });
      if (startingChapter1) stageChapter1Opening(context.entity);
    } else {
      mutChallenges.in_progress.delete(this.id);
    }

    if (state === "completed") {
      mutChallenges.complete.add(this.id);
      context.entity.mutableTriggerState().by_root.delete(this.id);
      if (!mutChallenges.started_at.has(this.id)) {
        mutChallenges.started_at.set(this.id, secondsSinceEpoch());
      }
      mutChallenges.finished_at.set(this.id, secondsSinceEpoch());

      context.publish({
        kind: "challengeCompleted",
        entityId: context.entity.id,
        challenge: this.id,
      });
      if (this.id === NATIVE_MUCK_VS_MACHINE_QUEST_ID) {
        startPostMuckVsMachineParallelQuests(context);
      }
      // Award points
      for (const { metaquest, points } of this.biscuit.metaquestPoints ?? []) {
        const metaquestBiscuit = getBiscuit(metaquest);
        if (!metaquestBiscuit.enabled) {
          continue;
        }
        const teamId = context.entity.playerCurrentTeam()?.team_id;
        context.publish({
          kind: "metaquestPoints",
          entityId: context.entity.id,
          metaquestId: metaquest,
          teamId,
          points,
        });
      }

      reportFunnelStage("completeQuest", {
        userId: context.entity.id,
        extra: {
          questId: this.id,
        },
      });

      // HARTHMERE_NATIVE_QUEST_STEP_XP: one-time chapter bonus on top of the
      // per-step awards paid by BaseTrigger. Placed on the `completed`
      // transition (not on the final leaf) so it survives quests whose last
      // node is an aggregate, and so the item rewards and the progression
      // reward land in the same ECS transaction.
      //
      // Repeatable quests re-enter `available` immediately below and clear
      // their trigger root, so the reward table restricts this to the four
      // one-shot onboarding chapters rather than trusting the caller.
      try {
        const progression = awardHarthmereNativeQuestCompletionXp(
          context.entity,
          this.id
        );
        if (progression?.leveledUp) {
          context.publish({
            kind: "skillLevelUp",
            entityId: context.entity.id,
            skill: "character_level",
            level: progression.levelAfter,
          });
        }
      } catch (error: any) {
        log.warn("Failed to award native quest completion XP", {
          error,
          questId: this.id,
        });
      }

      // Award rewards
      giveRewardsFromTriggerContext({ context, bag: this.rewards });

      if (this.canRepeat(context.entity.challenges())) {
        this.transitionState(context, "available");
      }
    } else {
      mutChallenges.complete.delete(this.id);
    }
  }

  run(context: TriggerContext): void {
    const cs = this.userChallengeState(context.entity.challenges());
    switch (cs) {
      case "completed":
        if (this.canRepeat(context.entity.challenges())) {
          this.transitionState(context, "available");
        }
        return;
      case "available":
        // The restored robot story is one continuous onboarding chain. Older
        // saves can already have Busted/Get the Muck Out stranded in available
        // from before automatic continuation existed, so promote those offers
        // idempotently on the next trigger pass as well as on first unlock.
        const ch1PrologueHandoff = isNativeCh1PrologueHandoffQuestId(this.id);
        const predecessor = ch1PrologueHandoff
          ? NATIVE_MUCK_VS_MACHINE_QUEST_ID
          : nativeRobotStoryPredecessorQuestId(this.id);
        if (
          (isNativeRobotStoryAutoContinuationQuestId(this.id) ||
            ch1PrologueHandoff) &&
          predecessor !== undefined &&
          context.entity.challenges()?.complete.has(predecessor)
        ) {
          this.transitionState(context, "in_progress");
        }
        return;
      case "start":
        if (this.unlock) {
          if (!this.unlock.update(context)) {
            return;
          }
        }
        // Clear any now-uneeded trigger states.
        this.unlock?.visit((t) => context.clearState(t.spec.id));

        if (
          this.biscuit.questGiver &&
          !isNativeRobotStoryAutoContinuationQuestId(this.id) &&
          !isNativeCh1PrologueHandoffQuestId(this.id)
        ) {
          this.transitionState(context, "available");
        } else {
          this.transitionState(context, "in_progress");
        }
        return;
      case "in_progress":
        if (this.trigger) {
          if (!this.trigger.update(context)) {
            return;
          }
        }
        this.transitionState(context, "completed");
        return;
    }
  }
}
