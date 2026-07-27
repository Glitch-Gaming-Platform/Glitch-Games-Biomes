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
  isNativeRobotStoryAutoContinuationQuestId,
  nativeRobotStoryPredecessorQuestId,
} from "@/shared/harthmere/native_road_ahead_contract";
import { awardHarthmereNativeQuestCompletionXp } from "@/shared/harthmere/harthmere_native_quest_xp_award";
import { log } from "@/shared/logging";

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
        const predecessor = nativeRobotStoryPredecessorQuestId(this.id);
        if (
          isNativeRobotStoryAutoContinuationQuestId(this.id) &&
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
          !isNativeRobotStoryAutoContinuationQuestId(this.id)
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
