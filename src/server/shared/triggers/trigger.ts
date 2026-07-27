import type { Trigger, TriggerContext } from "@/server/shared/triggers/core";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { awardHarthmereNativeQuestStepXp } from "@/shared/harthmere/harthmere_native_quest_xp_award";
import { log } from "@/shared/logging";
import type {
  BaseStoredTriggerDefinition,
  MetaState,
} from "@/shared/triggers/base_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import type { ZodTypeAny, ZodVoid } from "zod";
import { z } from "zod";

export abstract class BaseTrigger<T extends ZodTypeAny> implements Trigger {
  abstract kind: string;
  abstract schema: T;
  public readonly leaf: boolean = true;

  constructor(public readonly spec: BaseStoredTriggerDefinition) {}

  isEmpty(): boolean {
    return false;
  }

  update(context: TriggerContext): boolean {
    // Distinguishes "this leaf is done" from "this leaf just became done".
    // `updateState` invokes the reducer exactly once and only persists a
    // `firedAt` on the first pass, so this flag is the authoritative one-shot
    // edge for the step — see maybeAwardNativeQuestStepXp below.
    let newlyFired = false;
    const result = context.updateState(this.spec.id, this.schema, (state) => {
      if (state.firedAt !== undefined) {
        return state;
      }
      // Admin manual step progression
      // Magical event will progress any leaf trigger
      if (
        this.leaf &&
        context.events.find(
          (e) =>
            e.kind === "adminProgressQuestStep" && e.questId === context.rootId
        )
      ) {
        newlyFired = true;
        return { firedAt: secondsSinceEpoch() };
      }
      if (this.tick(context, state)) {
        const successfullyTakenItems = this.maybeTakeItems(context);
        if (successfullyTakenItems) {
          this.maybeGiveRewards(context);
          newlyFired = true;
          return { firedAt: secondsSinceEpoch() };
        }
      }
      return { payload: state.payload };
    });
    if (newlyFired) {
      this.maybeAwardNativeQuestStepXp(context);
    }
    return result.firedAt !== undefined;
  }

  /**
   * HARTHMERE_NATIVE_QUEST_STEP_XP: pay progression for the journal row the
   * player just cleared.
   *
   * The original snapshot's quests only paid items at the final
   * `challengeClaimRewards`, so a twenty-one step chapter moved the level bar by
   * zero. This writes into the same ECS progression root the HUD reads.
   *
   * The award is idempotent by construction rather than by a ledger: it runs
   * only on the `undefined -> firedAt` edge above, inside the same forked ECS
   * delta that persists the trigger state, so a replayed tick or a retried
   * transaction cannot double-pay. The reward table itself refuses aggregate
   * nodes and every quest outside the four one-shot onboarding chapters, which
   * keeps repeatable quests (whose trigger root is cleared on reset) unfarmable.
   */
  private maybeAwardNativeQuestStepXp(context: TriggerContext) {
    try {
      awardHarthmereNativeQuestStepXp(context.entity, {
        questId: context.rootId,
        triggerKind: this.kind,
        eventKind: (this.spec as { eventKind?: string }).eventKind,
        isLeaf: this.leaf,
      });
    } catch (error: any) {
      // Progression must never be able to abort a quest transaction: the step
      // itself is already committed above, and losing XP is strictly better
      // than stranding the player on a step that will not advance again.
      log.warn("Failed to award native quest step XP", {
        error,
        questId: context.rootId,
        stepId: this.spec.id,
      });
    }
  }

  protected maybeGiveRewards(_: TriggerContext) {
    // None.
  }

  protected maybeTakeItems(_: TriggerContext): boolean {
    return true;
  }

  protected abstract tick(
    context: TriggerContext,
    state: MetaState<z.infer<T>>
  ): boolean;

  abstract serialize(): StoredTriggerDefinition;

  visit(visitor: (trigger: Trigger) => void): void {
    visitor(this);
  }
}

export abstract class BaseStatelessTrigger extends BaseTrigger<ZodVoid> {
  abstract kind: string;
  public readonly schema = z.void();
}
