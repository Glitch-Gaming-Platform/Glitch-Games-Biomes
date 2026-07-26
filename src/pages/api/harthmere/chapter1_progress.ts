import { authorizeHarthmereQuestProgress } from "@/server/harthmere/native_quest_progress_token";
import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { GameEvent } from "@/server/shared/api/game_event";
import { connectToRedis } from "@/server/shared/redis/connection";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import { isTriggerFired } from "@/server/logic/events/handlers/quest_step_validation";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  HarthmereInventoryTransactionEvent,
  HarthmereQuestProgressEvent,
} from "@/shared/ecs/gen/events";
import { countOf, createBag } from "@/shared/game/items";
import {
  applyCh1DungeonNativeEffectForTest,
  ch1ApplyDungeonObjectiveMechanic,
  ch1DungeonMechanicForObjective,
  type Ch1DungeonMechanicEffect,
} from "@/shared/harthmere/ch1_dungeon_mechanics";
import {
  ch1NativeQuestId,
  ch1NativeQuestStepId,
  isCh1NativeQuestId,
} from "@/shared/harthmere/ch1_native_quests";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  ch1ApplyLiveObjectiveEffects,
  ch1ObjectiveChoiceSpec,
} from "@/shared/harthmere/ch1_live_story";
import {
  ch1ConsumeProvisioningResourceFromInventory,
  ch1ProvisioningCarriedFromInventory,
} from "@/shared/harthmere/ch1_live_gate";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} from "@/shared/harthmere/live_mode_backend";
import { harthmereInventoryCarryWeight } from "@/shared/harthmere/mmo_carry_weight";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { zBiomesId, type BiomesId } from "@/shared/ids";
import { z } from "zod";

const zBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({
    action: z.literal("complete"),
    challengeId: zBiomesId,
    stepId: zBiomesId,
    choice: z.string().min(1).max(80).optional(),
  }),
]);

const zResponse = z.object({
  ok: z.boolean(),
  status: z.enum(["disabled", "idle", "active", "completed", "rejected"]),
  reason: z.string().optional(),
  questId: z.string().optional(),
  questTitle: z.string().optional(),
  challengeId: zBiomesId.optional(),
  stepId: zBiomesId.optional(),
  authoredStepId: z.string().optional(),
  objective: z.string().optional(),
  targetLabel: z.string().optional(),
  targetPosition: z.tuple([z.number(), z.number(), z.number()]).optional(),
  trigger: z.string().optional(),
  actionLabel: z.string().optional(),
  interactionRadius: z.number().optional(),
  distance: z.number().optional(),
  withinRange: z.boolean().optional(),
  choice: z
    .object({
      title: z.string(),
      prompt: z.string(),
      cancellable: z.boolean(),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
        })
      ),
    })
    .optional(),
  survival: z
    .object({
      resourceKey: z.enum(["water", "fuel"]),
      resourceInitial: z.number(),
      resourceRemaining: z.number(),
      lightInitial: z.number(),
      lightRemaining: z.number(),
      lastOutcome: z.string().optional(),
    })
    .optional(),
});

type Chapter1ProgressState = z.infer<typeof zResponse>;

const globalForChapter1Progress = globalThis as typeof globalThis & {
  __chapter1ProgressRedis?: ReturnType<typeof connectToRedis>;
};

function chapter1ProgressRedis() {
  return (globalForChapter1Progress.__chapter1ProgressRedis ??=
    connectToRedis("firehose"));
}

function distance3(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Return only the first unfinished leaf of the currently active native
 * Chapter 1 challenge. The chapter is deliberately linear, so exposing any
 * later leaf would let a client skip authored sequence ordering.
 */
export function activeChapter1ObjectiveForTest(input: {
  inProgress: ReadonlySet<BiomesId>;
  fired: (challengeId: BiomesId, stepId: BiomesId) => boolean;
}) {
  for (const quest of CH1_QUESTS) {
    const challengeId = ch1NativeQuestId(quest.id)!;
    if (!input.inProgress.has(challengeId)) continue;
    for (const [stepIndex, step] of quest.steps.entries()) {
      const stepId = ch1NativeQuestStepId(quest.id, stepIndex)!;
      if (!input.fired(challengeId, stepId)) {
        return { quest, step, stepIndex, challengeId, stepId };
      }
    }
  }
}

function stateForPlayer(player: {
  challenges(): { in_progress: ReadonlySet<BiomesId> } | undefined;
  triggerState():
    | {
        by_root: ReadonlyMap<
          BiomesId,
          ReadonlyMap<BiomesId, string | number>
        >;
      }
    | undefined;
  position(): { v: readonly [number, number, number] } | undefined;
}): Chapter1ProgressState {
  const challenges = player.challenges();
  const triggerState = player.triggerState();
  const position = player.position()?.v;
  if (!challenges || !triggerState || !position) {
    return {
      ok: false,
      status: "idle",
      reason: "Chapter 1 requires a synchronized native player state.",
    };
  }
  const active = activeChapter1ObjectiveForTest({
    inProgress: challenges.in_progress,
    fired: (challengeId, stepId) =>
      isTriggerFired(triggerState.by_root.get(challengeId), stepId),
  });
  if (!active) {
    return { ok: true, status: "idle" };
  }
  const target = ch1ObjectiveTarget(active.quest.id, active.stepIndex)!;
  const distance = distance3(position, target.position);
  return {
    ok: true,
    status: "active",
    questId: active.quest.id,
    questTitle: active.quest.title,
    challengeId: active.challengeId,
    stepId: active.stepId,
    authoredStepId: active.step.id,
    objective: active.step.objective,
    targetLabel: target.label,
    targetPosition: [...target.position],
    trigger: target.trigger,
    actionLabel: target.actionLabel,
    interactionRadius: target.interactionRadius,
    distance,
    withinRange: distance <= target.interactionRadius,
    choice: (() => {
      const choice = ch1ObjectiveChoiceSpec(active.step);
      return choice ? { ...choice, options: [...choice.options] } : undefined;
    })(),
  };
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    body: zBody,
    response: zResponse,
  },
  async ({
    context: { worldApi, logicApi },
    auth,
    body,
    unsafeRequest,
    unsafeResponse,
  }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return { ok: false, status: "disabled" as const };
    }
    const player = await worldApi.get(auth.userId);
    if (!player) {
      return {
        ok: false,
        status: "idle" as const,
        reason: "Native player entity is unavailable.",
      };
    }
    const state = stateForPlayer(player);
    if (body.action === "state" || state.status !== "active") {
      return state;
    }
    if (
      !isCh1NativeQuestId(body.challengeId) ||
      state.challengeId !== body.challengeId ||
      state.stepId !== body.stepId
    ) {
      return {
        ...state,
        ok: false,
        status: "rejected" as const,
        reason:
          "The requested objective is no longer the active Chapter 1 step.",
      };
    }
    if (!state.withinRange) {
      return {
        ...state,
        ok: false,
        status: "rejected" as const,
        reason: `Move within ${Math.ceil(state.interactionRadius ?? 0)}m of ${
          state.targetLabel ?? "the objective"
        }.`,
      };
    }

    const active = activeChapter1ObjectiveForTest({
      inProgress: player.challenges()!.in_progress,
      fired: (challengeId, stepId) =>
        isTriggerFired(player.triggerState()!.by_root.get(challengeId), stepId),
    })!;
    const redis = await chapter1ProgressRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `authenticated:chapter1-progress:${auth.userId}`
    );
    const stateKey = harthmereLiveModePlayerStateKey(actorId);
    const lock = await acquireHarthmereActorStateLock(redis.primary, actorId, {
      waitMs: 10_000,
    });
    if (!lock.acquired) {
      return {
        ...state,
        ok: false,
        status: "rejected" as const,
        reason: "Chapter 1 state is busy; try the objective again.",
      };
    }
    try {
      const nowMs = Date.now();
      const raw = await redis.primary.get(stateKey);
      const liveState = parseHarthmereLiveModeBackendState(
        raw,
        actorId,
        nowMs
      );
      let dungeonMechanicEffect: Ch1DungeonMechanicEffect | undefined;
      let effects: ReturnType<typeof ch1ApplyLiveObjectiveEffects>;
      try {
        effects = ch1ApplyLiveObjectiveEffects({
          runtime: liveState.chapter1,
          quest: active.quest,
          step: active.step,
          stepIndex: active.stepIndex,
          choice: body.choice,
          nowMs,
        });
        const mechanic = ch1DungeonMechanicForObjective(active.step.id);
        const survival = liveState.chapter1.dungeonSurvival;
        if (mechanic && survival) {
          // Reconcile the reserved counters with the actual pack before every
          // consequence. Dropping fuel on the Whale Road is meaningful; it
          // cannot remain available merely because it existed at gate entry.
          const carried = ch1ProvisioningCarriedFromInventory(
            liveState.inventory.items
          );
          const reconciledSurvival = {
            ...survival,
            resourceRemaining: Math.min(
              survival.resourceRemaining,
              carried[survival.resourceKey] ?? 0
            ),
            lightRemaining: Math.min(
              survival.lightRemaining,
              carried.light ?? 0
            ),
          };
          const mechanicResult = ch1ApplyDungeonObjectiveMechanic({
            survival: reconciledSurvival,
            augur9: effects.runtime.augur9,
            stepId: active.step.id,
            choice: body.choice,
            carryWeight: harthmereInventoryCarryWeight(
              liveState.inventory.items
            ),
          });
          if (!mechanicResult.ok) {
            return {
              ...state,
              ok: false,
              status: "rejected" as const,
              reason: mechanicResult.reason,
            };
          }
          effects = {
            ...effects,
            runtime: {
              ...effects.runtime,
              augur9: mechanicResult.augur9,
              dungeonSurvival: mechanicResult.survival,
            },
          };
          dungeonMechanicEffect = mechanicResult.effect;
        }
      } catch (error) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }

      for (const itemId of effects.itemConsumes) {
        if ((liveState.inventory.items[itemId] ?? 0) < 1) {
          return {
            ...state,
            ok: false,
            status: "rejected" as const,
            reason: `You need ${itemId} before completing this objective.`,
          };
        }
      }
      for (const itemId of effects.itemConsumes) {
        const count = liveState.inventory.items[itemId] ?? 0;
        if (count <= 1) delete liveState.inventory.items[itemId];
        else liveState.inventory.items[itemId] = count - 1;
      }
      for (const itemId of effects.itemGrants) {
        liveState.inventory.items[itemId] =
          (liveState.inventory.items[itemId] ?? 0) + 1;
      }
      const consumedDungeonResources: Record<string, number> = {};
      for (const [resourceKey, count] of Object.entries(
        dungeonMechanicEffect?.resourceConsumes ?? {}
      )) {
        const consumed = ch1ConsumeProvisioningResourceFromInventory(
          liveState.inventory.items,
          resourceKey as "water" | "fuel" | "light",
          count
        );
        for (const [itemId, consumedCount] of Object.entries(
          consumed.consumed
        )) {
          consumedDungeonResources[itemId] =
            (consumedDungeonResources[itemId] ?? 0) + consumedCount;
        }
      }
      liveState.chapter1 = effects.runtime;
      liveState.updatedAtMs = nowMs;
      const previousSerialized =
        raw ??
        stringifyHarthmereLiveModePlayerPersistenceState(
          parseHarthmereLiveModeBackendState(undefined, actorId, nowMs)
        );
      await redis.primary.set(
        stateKey,
        stringifyHarthmereLiveModePlayerPersistenceState(liveState)
      );

      const authorization = authorizeHarthmereQuestProgress({
        id: auth.userId,
        challenge_id: body.challengeId,
        step_id: body.stepId,
      });
      try {
        if (
          dungeonMechanicEffect &&
          (dungeonMechanicEffect.staminaDelta !== 0 ||
            dungeonMechanicEffect.healthDamage !== 0)
        ) {
          await editWorldWithRetry(
            worldApi,
            async (editor) => {
              const nativePlayer = await editor.get(auth.userId);
              const health = nativePlayer?.health();
              if (!nativePlayer || !health) return false;
              const mutableHealth = nativePlayer.mutableHealth();
              const beforeHp = mutableHealth.hp;
              const applied = applyCh1DungeonNativeEffectForTest({
                triggerState: nativePlayer.mutableTriggerState(),
                health: mutableHealth,
                effect: dungeonMechanicEffect!,
              });
              if (applied.applied && mutableHealth.hp !== beforeHp) {
                mutableHealth.lastDamageSource = { kind: "suicide" };
                mutableHealth.lastDamageAmount = Math.max(
                  0,
                  beforeHp - mutableHealth.hp
                );
                mutableHealth.lastDamageTime = secondsSinceEpoch();
              }
              return applied.applied;
            },
            { maxAttempts: 6 }
          );
        }
        const nativeEvents: GameEvent[] = [];
        const consumedNativeStacks = Object.entries(
          consumedDungeonResources
        ).map(([itemId, count]) => {
          const nativeId = harthmereNativeBiomesIdForItemId(itemId);
          if (nativeId === undefined) {
            throw new Error(
              `Dungeon provisioning item ${itemId} has no native inventory identity.`
            );
          }
          return countOf(nativeId, BigInt(count));
        });
        if (consumedNativeStacks.length > 0) {
          const storage = player.harthmereMaterialStorage();
          const take = createBag(...consumedNativeStacks);
          const inventoryTransactionInput = {
            id: auth.userId,
            // Stable per objective: if native progress contends after this
            // debit, a retry is an exactly-once no-op in the ECS ledger.
            transaction_id: `chapter1:dungeon:${body.challengeId}:${body.stepId}:resources:v1`,
            take,
            give: createBag(),
            storage_take: createBag(),
            storage_give: createBag(),
            storage_max_slots: Math.max(1, storage?.max_slots ?? 32),
            personal_bank_take: createBag(),
            personal_bank_give: createBag(),
            personal_bank_max_slots: Math.max(
              1,
              storage?.personal_max_slots ?? 24
            ),
            account_bank_take: createBag(),
            account_bank_give: createBag(),
            account_bank_max_slots: Math.max(
              1,
              storage?.account_max_slots ?? 40
            ),
            gold_delta: 0n,
            publish_craft: false,
            station_entity_id: undefined,
            robot_entity_id: undefined,
            robot_energy_delta: 0,
            write_standing: false,
            standing_scope: "",
            standing_likeability: 0,
            standing_legal: 0,
            standing_notoriety: 0,
            standing_notoriety_floor: 0,
          } as const;
          nativeEvents.push(
            new GameEvent(
              auth.userId,
              new HarthmereInventoryTransactionEvent({
                ...inventoryTransactionInput,
                authorization: authorizeHarthmereInventoryTransaction(
                  inventoryTransactionInput
                ),
              })
            )
          );
        }
        nativeEvents.push(
          new GameEvent(
            auth.userId,
            new HarthmereQuestProgressEvent({
              id: auth.userId,
              challenge_id: body.challengeId,
              step_id: body.stepId,
              authorization,
            })
          )
        );
        // Both events involve the same player, so the logic batch merges them
        // into one native world transaction. Quest progress cannot commit
        // without the real water/fuel/light debit, and a failed debit cannot
        // advance the quest leaf.
        await logicApi.publish(...nativeEvents);
      } catch (error) {
        // Native survival effects carry their own last-effect marker. If the
        // progress publish loses a race after the native edit, retrying this
        // same objective cannot charge health/stamina twice.
        await redis.primary.set(stateKey, previousSerialized);
        throw error;
      }
      const survival = effects.runtime.dungeonSurvival;
      return {
        ...state,
        ok: true,
        status: "completed" as const,
        ...(survival
          ? {
              survival: {
                resourceKey: survival.resourceKey,
                resourceInitial: survival.resourceInitial,
                resourceRemaining: survival.resourceRemaining,
                lightInitial: survival.lightInitial,
                lightRemaining: survival.lightRemaining,
                lastOutcome: survival.lastOutcome,
              },
            }
          : {}),
      };
    } finally {
      await lock.release();
    }
  }
);
