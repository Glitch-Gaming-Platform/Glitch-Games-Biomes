import { authorizeHarthmereQuestProgress } from "@/server/harthmere/native_quest_progress_token";
import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import { readCh1NativeInventoryCounts } from "@/server/harthmere/ch1_native_inventory";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  ch1CloneDialogue,
  ch1ObjectiveCompletionDialogue,
  ch1ObjectiveDialogue,
} from "@/server/harthmere/ch1_dialogue";
import { GameEvent } from "@/server/shared/api/game_event";
import { connectToRedis } from "@/server/shared/redis/connection";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import { isTriggerFired } from "@/server/logic/events/handlers/quest_step_validation";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { NpcState, type ReadonlyInventory } from "@/shared/ecs/gen/components";
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
import { CH1_IGNITION, CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
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
import {
  CH1_DUNGEON_ENCOUNTER_NPCS,
  ch1GildedBullPhase,
  ch1NinthWinterLoopRemainingMs,
  ch1NinthWinterPhase,
  ch1RequiredEncounterNpcsForObjective,
  ch1RequiredEscortNpcsForObjective,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import { zBiomesId, type BiomesId } from "@/shared/ids";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import type { WorldApi } from "@/server/shared/world/api";
import { z } from "zod";

const zBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({
    action: z.literal("complete"),
    challengeId: zBiomesId,
    stepId: zBiomesId,
    choice: z.string().min(1).max(80).optional(),
  }),
  z.object({
    action: z.literal("prepare"),
    challengeId: zBiomesId,
    stepId: zBiomesId,
    choice: z.string().min(1).max(80),
  }),
]);

const zDialogue = z.object({
  title: z.string(),
  completionLabel: z.string().optional(),
  pages: z.array(
    z.object({
      speaker: z.string(),
      text: z.string(),
    })
  ),
});

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
  introCutsceneId: z.string().optional(),
  cutsceneId: z.string().optional(),
  dialogue: zDialogue.optional(),
  completionDialogue: zDialogue.optional(),
  choice: z
    .object({
      title: z.string(),
      prompt: z.string(),
      cancellable: z.boolean(),
      textInput: z
        .object({
          label: z.string(),
          placeholder: z.string(),
          submitLabel: z.string(),
          maxLength: z.number(),
        })
        .optional(),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
        })
      ),
    })
    .optional(),
  preparedChoice: z.string().optional(),
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
  experience: z
    .object({
      kind: z.enum(["combat", "sound_hunt", "boss", "sandstorm", "thin_ice"]),
      title: z.string(),
      phase: z.string(),
      detail: z.string(),
      hp: z.number().optional(),
      maxHp: z.number().optional(),
      timerMs: z.number().optional(),
      loopCount: z.number().optional(),
      carryWeight: z.number().optional(),
      carryLimit: z.number().optional(),
      aliveEnemies: z.number().optional(),
    })
    .optional(),
});

export function chapter1NativeInventoryPlanForTest(args: {
  itemConsumes: readonly string[];
  itemGrants: readonly string[];
  resourceConsumes?: Readonly<Record<string, number>>;
}) {
  const takeCounts = new Map<string, number>();
  const giveCounts = new Map<string, number>();
  const add = (target: Map<string, number>, itemId: string, count: number) => {
    const normalized = Math.max(0, Math.trunc(count));
    if (normalized === 0) return;
    target.set(itemId, (target.get(itemId) ?? 0) + normalized);
  };
  for (const itemId of args.itemConsumes) add(takeCounts, itemId, 1);
  for (const [itemId, count] of Object.entries(args.resourceConsumes ?? {})) {
    add(takeCounts, itemId, count);
  }
  for (const itemId of args.itemGrants) add(giveCounts, itemId, 1);

  const rows = (counts: ReadonlyMap<string, number>) =>
    [...counts.entries()].map(([itemId, count]) => {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      if (nativeId === undefined) {
        throw new Error(
          `Chapter 1 item ${itemId} has no native inventory identity.`
        );
      }
      return { itemId, nativeId, count };
    });
  return { take: rows(takeCounts), give: rows(giveCounts) };
}

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
        by_root: ReadonlyMap<BiomesId, ReadonlyMap<BiomesId, string | number>>;
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
    introCutsceneId:
      active.step.id === "wake_up" ? CH1_IGNITION.cutsceneId : undefined,
    dialogue: ch1CloneDialogue(ch1ObjectiveDialogue(active.step.id)),
    choice: (() => {
      const choice = ch1ObjectiveChoiceSpec(active.step);
      return choice ? { ...choice, options: [...choice.options] } : undefined;
    })(),
  };
}

async function addChapter1Experience(
  state: Chapter1ProgressState,
  player: { inventory(): ReadonlyInventory | undefined },
  worldApi: WorldApi,
  nowMs: number
): Promise<Chapter1ProgressState> {
  const stepId = state.authoredStepId;
  if (!stepId || state.status !== "active") return state;
  const encounterSpecs = CH1_DUNGEON_ENCOUNTER_NPCS.filter(
    (npc) => npc.objectiveId === stepId
  );
  const encounterEntities = encounterSpecs.length
    ? await worldApi.get(encounterSpecs.map((npc) => npc.entityId))
    : [];
  const aliveEnemies = encounterEntities.filter(
    (entity) => Number(entity?.health()?.hp ?? 0) > 0
  ).length;
  const preparedChoice = encounterEntities
    .map(
      (entity) =>
        deserializeNpcCustomState(entity?.npcState()?.data).chapter1Encounter
          ?.routeChoice
    )
    .find((choice): choice is string => Boolean(choice));

  if (stepId === "d1_salt_market") {
    return {
      ...state,
      ...(preparedChoice ? { preparedChoice } : {}),
      experience: {
        kind: "combat",
        title: "Salt Market",
        phase: aliveEnemies > 0 ? "muckers_active" : "market_clear",
        detail:
          aliveEnemies > 0
            ? "Use the bazaar cover or defeat the Salt-Cured Muckers in native combat."
            : "The market has gone still.",
        aliveEnemies,
      },
    };
  }
  if (["d1_cistern_stair", "d2_longhouse", "d2_hanged_wood"].includes(stepId)) {
    return {
      ...state,
      ...(preparedChoice ? { preparedChoice } : {}),
      experience: {
        kind: "sound_hunt",
        title:
          stepId === "d2_hanged_wood"
            ? "The Hanged Wood"
            : stepId === "d2_longhouse"
            ? "The Drowned Longhouse"
            : "The Cistern Stair",
        phase: aliveEnemies > 0 ? "listening" : "quiet",
        detail:
          aliveEnemies > 0
            ? "Sound-hunters acquire moving players. Slow movement and broken sight are the stealth route."
            : "Nothing nearby is listening now.",
        aliveEnemies,
      },
    };
  }
  if (stepId === "d1_sun_court") {
    const bull = encounterEntities[0];
    const health = bull?.health();
    const npcState = deserializeNpcCustomState(bull?.npcState()?.data);
    const phase = ch1GildedBullPhase({
      hp: Number(health?.hp ?? 0),
      maxHp: Number(health?.maxHp ?? 0),
      attackTarget: bull?.npcCombatState()?.attack_target,
      brokenPartIds: npcState.chapter1Encounter?.brokenPartIds,
    });
    return {
      ...state,
      ...(preparedChoice ? { preparedChoice } : {}),
      experience: {
        kind: "boss",
        title: "The Gilded Bull",
        phase,
        detail:
          phase === "patrol"
            ? "It has not noticed you. The lore cache route remains open."
            : phase === "charge"
            ? "Its horned charge is fast and narrow. Use the court's pillars and keep moving."
            : phase === "unbalanced"
            ? "The horns are gone. It turns slowly and fights badly now."
            : "The guardian is still.",
        hp: Number(health?.hp ?? 0),
        maxHp: Number(health?.maxHp ?? 0),
      },
    };
  }
  if (stepId === "d1_the_long_walk") {
    return {
      ...state,
      ...(preparedChoice ? { preparedChoice } : {}),
      experience: {
        kind: "sandstorm",
        title: "The Long Walk",
        phase: "pursuit",
        detail:
          "Keep Iris and Marrow close and keep moving. The shape in the storm follows the Grain, not you.",
      },
    };
  }
  if (["d2_whale_road", "d2_the_breaking_year"].includes(stepId)) {
    const carryLimit = stepId === "d2_whale_road" ? 55 : 45;
    const carryWeight = harthmereInventoryCarryWeight(
      readCh1NativeInventoryCounts(player)
    );
    return {
      ...state,
      experience: {
        kind: "thin_ice",
        title:
          stepId === "d2_whale_road" ? "The Whale Road" : "The Breaking Year",
        phase: carryWeight > carryLimit ? "cracking" : "holding",
        detail:
          carryWeight > carryLimit
            ? "The ice is failing under the load. Abandon gear before advancing."
            : "The carried load is within the ice's limit.",
        carryWeight,
        carryLimit,
      },
    };
  }
  if (stepId === "d2_ash_hall") {
    const winter = encounterEntities[0];
    const health = winter?.health();
    const npcState = deserializeNpcCustomState(winter?.npcState()?.data);
    const phase = ch1NinthWinterPhase({
      hp: Number(health?.hp ?? 0),
      maxHp: Number(health?.maxHp ?? 0),
      cycleStartedAtMs: npcState.chapter1Encounter?.cycleStartedAtMs,
      nowMs,
    });
    return {
      ...state,
      ...(preparedChoice ? { preparedChoice } : {}),
      experience: {
        kind: "boss",
        title: "The Ninth Winter",
        phase,
        detail:
          phase === "hearth_fails"
            ? "The hearth is dying. Darkness makes every hit worse."
            : phase === "same_day_again"
            ? "The hall resets every ninety seconds, but damage to the Winter persists."
            : phase === "year_breaks"
            ? "The loop has broken. Snow is becoming rain inside the hall."
            : "The stopped year has ended.",
        hp: Number(health?.hp ?? 0),
        maxHp: Number(health?.maxHp ?? 0),
        timerMs:
          phase === "same_day_again" || phase === "hearth_fails"
            ? ch1NinthWinterLoopRemainingMs({
                cycleStartedAtMs: npcState.chapter1Encounter?.cycleStartedAtMs,
                nowMs,
              })
            : undefined,
        loopCount: npcState.chapter1Encounter?.loopCount ?? 0,
      },
    };
  }
  return state;
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
    let state = stateForPlayer(player);
    state = await addChapter1Experience(state, player, worldApi, Date.now());
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
    const choiceSpec = ch1ObjectiveChoiceSpec(active.step);
    const requestedChoice =
      body.choice ??
      (body.action === "complete" ? state.preparedChoice : undefined);
    if (body.action === "prepare") {
      if (
        !choiceSpec?.options.some((option) => option.id === requestedChoice)
      ) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: "That route is not available for the active objective.",
        };
      }
      const encounterSpecs = ch1RequiredEncounterNpcsForObjective(
        active.step.id,
        requestedChoice
      );
      if (encounterSpecs.length === 0) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: "That route does not require an encounter commitment.",
        };
      }
      const encounterEntities = await worldApi.get(
        encounterSpecs.map((npc) => npc.entityId)
      );
      const changes = encounterSpecs.flatMap((spec) => {
        const entity = encounterEntities.find(
          (candidate) => candidate?.id === spec.entityId
        );
        if (!entity) return [];
        const decoded = deserializeNpcCustomState(entity.npcState()?.data);
        const encounter = (decoded.chapter1Encounter ??= {});
        if (
          encounter.routeChoice &&
          encounter.routeChoice !== requestedChoice
        ) {
          return [];
        }
        encounter.routeChoice = requestedChoice;
        if (active.step.id === "d2_ash_hall") {
          encounter.hearthFed = requestedChoice === "feed_hearth";
        }
        return [
          {
            kind: "update" as const,
            entity: {
              id: spec.entityId,
              npc_state: NpcState.create({
                data: serializeNpcCustomState(decoded),
              }),
            },
          },
        ];
      });
      if (changes.length !== encounterSpecs.length) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: "The encounter route is already committed or unavailable.",
        };
      }
      await worldApi.apply({ changes });
      return {
        ...state,
        ok: true,
        status: "active" as const,
        preparedChoice: requestedChoice,
        choice: undefined,
      };
    }
    const requiredEncounterNpcs = ch1RequiredEncounterNpcsForObjective(
      active.step.id,
      requestedChoice
    );
    if (requiredEncounterNpcs.length > 0) {
      const encounterEntities = await worldApi.get(
        requiredEncounterNpcs.map((npc) => npc.entityId)
      );
      const alive = requiredEncounterNpcs.filter((npc) => {
        const entity = encounterEntities.find(
          (candidate) => candidate?.id === npc.entityId
        );
        return !entity || Number(entity.health()?.hp ?? 0) > 0;
      });
      if (alive.length > 0) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason:
            alive.length === 1
              ? `${alive[0].displayName} is still standing.`
              : `${alive.length} encounter enemies are still standing.`,
        };
      }
    }
    const requiredEscortNpcs = ch1RequiredEscortNpcsForObjective(
      active.step.id
    );
    if (requiredEscortNpcs.length > 0 && state.targetPosition) {
      const escortEntities = await worldApi.get(
        requiredEscortNpcs.map((npc) => npc.entityId)
      );
      const missing = requiredEscortNpcs.filter((npc) => {
        const position = escortEntities
          .find((candidate) => candidate?.id === npc.entityId)
          ?.position()?.v;
        return !position || distance3(position, state.targetPosition!) > 22;
      });
      if (missing.length > 0) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: `Wait for ${missing
            .map((npc) => npc.displayName)
            .join(" and ")} at the aperture.`,
        };
      }
    }
    const nativeInventoryCounts = readCh1NativeInventoryCounts(player);
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
      const liveState = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
      let dungeonMechanicEffect: Ch1DungeonMechanicEffect | undefined;
      let effects: ReturnType<typeof ch1ApplyLiveObjectiveEffects>;
      try {
        effects = ch1ApplyLiveObjectiveEffects({
          runtime: liveState.chapter1,
          quest: active.quest,
          step: active.step,
          stepIndex: active.stepIndex,
          choice: requestedChoice,
          nowMs,
        });
        const mechanic = ch1DungeonMechanicForObjective(active.step.id);
        const survival = liveState.chapter1.dungeonSurvival;
        if (mechanic && survival) {
          // Reconcile the reserved counters with the actual pack before every
          // consequence. Dropping fuel on the Whale Road is meaningful; it
          // cannot remain available merely because it existed at gate entry.
          const carried = ch1ProvisioningCarriedFromInventory(
            nativeInventoryCounts
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
            choice: requestedChoice,
            carryWeight: harthmereInventoryCarryWeight(nativeInventoryCounts),
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
        if ((nativeInventoryCounts[itemId] ?? 0) < 1) {
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
      const nativeResourceCounts = { ...nativeInventoryCounts };
      for (const [resourceKey, count] of Object.entries(
        dungeonMechanicEffect?.resourceConsumes ?? {}
      )) {
        const nativeConsumed = ch1ConsumeProvisioningResourceFromInventory(
          nativeResourceCounts,
          resourceKey as "water" | "fuel" | "light",
          count
        );
        if (nativeConsumed.missingCount > 0) {
          return {
            ...state,
            ok: false,
            status: "rejected" as const,
            reason: `Your native inventory is missing ${nativeConsumed.missingCount} ${resourceKey}.`,
          };
        }
        ch1ConsumeProvisioningResourceFromInventory(
          liveState.inventory.items,
          resourceKey as "water" | "fuel" | "light",
          count
        );
        for (const [itemId, consumedCount] of Object.entries(
          nativeConsumed.consumed
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
        const nativeInventoryPlan = chapter1NativeInventoryPlanForTest({
          itemConsumes: effects.itemConsumes,
          itemGrants: effects.itemGrants,
          resourceConsumes: consumedDungeonResources,
        });
        if (
          nativeInventoryPlan.take.length > 0 ||
          nativeInventoryPlan.give.length > 0
        ) {
          const storage = player.harthmereMaterialStorage();
          const take = createBag(
            ...nativeInventoryPlan.take.map(({ nativeId, count }) =>
              countOf(nativeId, BigInt(count))
            )
          );
          const give = createBag(
            ...nativeInventoryPlan.give.map(({ nativeId, count }) =>
              countOf(nativeId, BigInt(count))
            )
          );
          const inventoryTransactionInput = {
            id: auth.userId,
            // Stable per objective: plot-item grants/turn-ins and dungeon
            // supplies are one exactly-once ECS transaction with progress.
            transaction_id: `chapter1:objective:${body.challengeId}:${body.stepId}:inventory:v1`,
            take,
            give,
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
        // without its real item grant/turn-in and survival-resource debit.
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
        cutsceneId: active.step.cutsceneId,
        completionDialogue: ch1CloneDialogue(
          ch1ObjectiveCompletionDialogue(active.step.id, requestedChoice)
        ),
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
