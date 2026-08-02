import { authorizeHarthmereQuestProgress } from "@/server/harthmere/native_quest_progress_token";
import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import {
  chapter1NativeInventoryTakeSourcesForTest,
  chapter1NativeInventoryRepairPlanForTest,
  chapter1ProgressExpectedPlotInventoryForTest,
  combineCh1NativeItemCounts,
  readCh1NativeInventoryCounts,
  readCh1NativeMaterialStorageCounts,
  readCh1NativeOverflowCounts,
} from "@/server/harthmere/ch1_native_inventory";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  ch1DialogueWithExitGuidanceForTest,
  ch1ObjectiveExitGuidanceForTest,
  ch1ObjectiveCompletionDialogue,
  ch1ObjectiveDialogue,
} from "@/server/harthmere/ch1_dialogue";
import { GameEvent } from "@/server/shared/api/game_event";
import { connectToRedis } from "@/server/shared/redis/connection";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import { isTriggerFired } from "@/server/logic/events/handlers/quest_step_validation";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { NpcState, type ReadonlyInventory } from "@/shared/ecs/gen/components";
import {
  HarthmereInventoryTransactionEvent,
  HarthmereQuestProgressEvent,
  OverflowMoveToInventoryEvent,
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
import { ch1ObjectiveRequirementState } from "@/shared/harthmere/ch1_objective_requirements";
import { ch1ItemDisplayName } from "@/shared/harthmere/ch1_items";
import { CH1_IGNITION, CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  Ch1ObjectiveIncomplete,
  ch1ApplyLiveObjectiveEffects,
  ch1ObjectiveChoiceSpec,
} from "@/shared/harthmere/ch1_live_story";
import {
  ch1ConsumeProvisioningResourceFromInventory,
  ch1ProvisioningCarriedFromInventory,
} from "@/shared/harthmere/ch1_live_gate";
import {
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
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
  targetEntityId: zBiomesId.optional(),
  trigger: z.string().optional(),
  actionLabel: z.string().optional(),
  interactionRadius: z.number().optional(),
  distance: z.number().optional(),
  withinRange: z.boolean().optional(),
  introCutsceneId: z.string().optional(),
  cutsceneId: z.string().optional(),
  dialogue: zDialogue.optional(),
  completionDialogue: zDialogue.optional(),
  exitGuidance: z.string().optional(),
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
  requirement: z
    .object({
      ready: z.boolean(),
      current: z.number(),
      total: z.number(),
      reason: z.string().optional(),
      blocksChapterInteraction: z.boolean(),
      autoCompleteWhenReady: z.boolean(),
    })
    .optional(),
  showNavigationAid: z.boolean().optional(),
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

function consumeChapter1DurableItem(
  state: ReturnType<typeof parseHarthmereLiveModeBackendState>,
  itemId: string,
  count: number
) {
  let remaining = Math.max(0, Math.trunc(count));
  const carried = Math.max(0, Math.trunc(state.inventory.items[itemId] ?? 0));
  const fromInventory = Math.min(remaining, carried);
  if (fromInventory > 0) {
    const next = carried - fromInventory;
    if (next > 0) state.inventory.items[itemId] = next;
    else delete state.inventory.items[itemId];
    remaining -= fromInventory;
  }
  const stored = Math.max(
    0,
    Math.trunc(state.banking.materialStorage[itemId] ?? 0)
  );
  const fromStorage = Math.min(remaining, stored);
  if (fromStorage > 0) {
    const next = stored - fromStorage;
    if (next > 0) state.banking.materialStorage[itemId] = next;
    else delete state.banking.materialStorage[itemId];
    remaining -= fromStorage;
  }
  return remaining;
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

function completedGroveJobCount(
  jobsBoard: ReturnType<typeof parseHarthmereLiveModeBackendState>["jobsBoard"],
  actorId: string,
  startedAtMs: number
) {
  return Object.values(jobsBoard.postings).filter(
    (job) =>
      job.acceptedByActorId === actorId &&
      job.townId === "harthmere_grove" &&
      job.status === "completed" &&
      Number(job.completedAtMs ?? 0) >= startedAtMs
  ).length;
}

function groveJobObjectiveStartedAtMs(player: {
  challenges():
    | {
        started_at: ReadonlyMap<BiomesId, number>;
      }
    | undefined;
}) {
  const challengeId = ch1NativeQuestId("ch1_a2_q02_work_the_board");
  return challengeId
    ? Number(player.challenges()?.started_at.get(challengeId) ?? 0) * 1_000
    : 0;
}

function stateForPlayer(
  player: {
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
  },
  context: {
    runtime: ReturnType<typeof parseHarthmereLiveModeBackendState>["chapter1"];
    inventory: Readonly<Record<string, number>>;
    overflowInventory?: Readonly<Record<string, number>>;
    inventoryRepairReason?: string;
    completedGroveJobs: number;
    vendorTransactions: Readonly<Record<string, number>>;
  }
): Chapter1ProgressState {
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
  const target = ch1ObjectiveTarget(active.quest.id, active.stepIndex, {
    runtime: context.runtime,
    vendorTransactions: context.vendorTransactions,
  })!;
  const requirement = ch1ObjectiveRequirementState({
    step: active.step,
    runtime: context.runtime,
    inventory: context.inventory,
    completedGroveJobs: context.completedGroveJobs,
    vendorTransactions: context.vendorTransactions,
  });
  if (requirement && !requirement.ready) {
    const overflowRequirement = active.step.inventoryRequirements?.find(
      (candidate) => (context.overflowInventory?.[candidate.itemId] ?? 0) > 0
    );
    if (overflowRequirement) {
      requirement.reason = `${overflowRequirement.label} is waiting in inventory overflow. Clear a bag slot so it can be moved into your usable inventory.`;
    } else if (context.inventoryRepairReason) {
      requirement.reason = context.inventoryRepairReason;
    }
  }
  const distance = distance3(position, target.position);
  const choice = (() => {
    const spec = ch1ObjectiveChoiceSpec(active.step);
    return spec ? { ...spec, options: [...spec.options] } : undefined;
  })();
  const exitGuidance = ch1ObjectiveExitGuidanceForTest({
    questId: active.quest.id,
    stepId: active.step.id,
    context: {
      runtime: context.runtime,
      vendorTransactions: context.vendorTransactions,
    },
  });
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
    targetEntityId: target.entityId,
    trigger: target.trigger,
    actionLabel: target.actionLabel,
    interactionRadius: target.interactionRadius,
    distance,
    withinRange: distance <= target.interactionRadius,
    requirement,
    showNavigationAid: target.source !== "dungeon",
    introCutsceneId:
      active.step.id === "wake_up" ? CH1_IGNITION.cutsceneId : undefined,
    dialogue: ch1DialogueWithExitGuidanceForTest(
      ch1ObjectiveDialogue(active.step.id, {
        questId: active.quest.id,
        runtime: context.runtime,
      }),
      exitGuidance,
      Boolean(choice)
    ),
    choice,
    exitGuidance,
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

async function resolveChapter1EntityTarget(
  state: Chapter1ProgressState,
  player: { position(): { v: readonly [number, number, number] } | undefined },
  worldApi: WorldApi
): Promise<Chapter1ProgressState> {
  if (state.status !== "active" || state.targetEntityId === undefined) {
    return state;
  }
  const target = await worldApi.get(state.targetEntityId);
  const targetPosition = target?.position()?.v;
  const playerPosition = player.position()?.v;
  if (!targetPosition || !playerPosition) return state;
  const distance = distance3(playerPosition, targetPosition);
  return {
    ...state,
    targetPosition: [...targetPosition],
    distance,
    withinRange: distance <= (state.interactionRadius ?? 0),
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
    const initialPlayer = await worldApi.get(auth.userId);
    if (!initialPlayer) {
      return {
        ok: false,
        status: "idle" as const,
        reason: "Native player entity is unavailable.",
      };
    }
    let player = initialPlayer;
    const redis = await chapter1ProgressRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `authenticated:chapter1-progress:${auth.userId}`
    );
    const stateKey = harthmereLiveModePlayerStateKey(actorId);
    const sharedStateKey = harthmereLiveModeSharedWorldStateKey();
    const nowMs = Date.now();
    const { rawState, rawSharedState } =
      await readHarthmerePlayerAndSharedStateStrings(
        redis.primary,
        stateKey,
        sharedStateKey
      );
    const projectedLiveState = parseHarthmereLiveModeBackendState(
      rawState,
      actorId,
      nowMs
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      projectedLiveState,
      parseHarthmereLiveModeSharedWorldState(rawSharedState, nowMs),
      nowMs
    );
    let nativeInventoryCounts = readCh1NativeInventoryCounts(player);
    let nativeMaterialStorageCounts =
      readCh1NativeMaterialStorageCounts(player);
    let nativeUsableItemCounts = combineCh1NativeItemCounts(
      nativeInventoryCounts,
      nativeMaterialStorageCounts
    );
    let nativeOverflowCounts = readCh1NativeOverflowCounts(player);
    const activeForInventoryRepair =
      player.challenges() && player.triggerState()
        ? activeChapter1ObjectiveForTest({
            inProgress: player.challenges()!.in_progress,
            fired: (challengeId, stepId) =>
              isTriggerFired(
                player.triggerState()!.by_root.get(challengeId),
                stepId
              ),
          })
        : undefined;
    const expectedInventory = chapter1ProgressExpectedPlotInventoryForTest({
      durable: projectedLiveState.inventory.items,
      activeQuestId: activeForInventoryRepair?.quest.id,
      activeStepId: activeForInventoryRepair?.step.id,
      fired: (questId, stepIndex) => {
        const challengeId = ch1NativeQuestId(questId);
        const stepId = ch1NativeQuestStepId(questId, stepIndex);
        return Boolean(
          challengeId !== undefined &&
            stepId !== undefined &&
            isTriggerFired(
              player.triggerState()?.by_root.get(challengeId),
              stepId
            )
        );
      },
    });
    const repairPlan = chapter1NativeInventoryRepairPlanForTest({
      expected: expectedInventory,
      available: nativeUsableItemCounts,
      overflow: nativeOverflowCounts,
    });
    let inventoryRepairReason: string | undefined;
    if (repairPlan.moveFromOverflow.length > 0 || repairPlan.grant.length > 0) {
      const repairEvents: GameEvent[] = [];
      for (const repair of repairPlan.moveFromOverflow) {
        const nativeId = harthmereNativeBiomesIdForItemId(repair.itemId);
        if (nativeId === undefined) continue;
        repairEvents.push(
          new GameEvent(
            auth.userId,
            new OverflowMoveToInventoryEvent({
              id: auth.userId,
              payload: createBag(countOf(nativeId, BigInt(repair.count))),
            })
          )
        );
      }
      for (const repair of repairPlan.grant) {
        const nativeId = harthmereNativeBiomesIdForItemId(repair.itemId);
        if (nativeId === undefined) continue;
        const storage = player.harthmereMaterialStorage();
        const transactionInput = {
          id: auth.userId,
          transaction_id: `chapter1:inventory-reconcile:v3:${
            activeForInventoryRepair?.quest.id ?? "durable"
          }:${activeForInventoryRepair?.step.id ?? "state"}:${repair.itemId}:${
            repair.count
          }`,
          take: createBag(),
          give: createBag(countOf(nativeId, BigInt(repair.count))),
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
          account_bank_max_slots: Math.max(1, storage?.account_max_slots ?? 40),
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
        repairEvents.push(
          new GameEvent(
            auth.userId,
            new HarthmereInventoryTransactionEvent({
              ...transactionInput,
              authorization:
                authorizeHarthmereInventoryTransaction(transactionInput),
            })
          )
        );
      }
      if (repairEvents.length > 0) {
        try {
          await logicApi.publish(...repairEvents);
          player = (await worldApi.get(auth.userId)) ?? player;
          nativeInventoryCounts = readCh1NativeInventoryCounts(player);
          nativeMaterialStorageCounts =
            readCh1NativeMaterialStorageCounts(player);
          nativeUsableItemCounts = combineCh1NativeItemCounts(
            nativeInventoryCounts,
            nativeMaterialStorageCounts
          );
          nativeOverflowCounts = readCh1NativeOverflowCounts(player);
        } catch {
          inventoryRepairReason =
            "A Chapter 1 quest item could not fit in usable inventory. Clear at least one bag slot, then return to this objective.";
        }
      }
    }
    const jobsStartedAtMs = groveJobObjectiveStartedAtMs(player);
    let state = stateForPlayer(player, {
      runtime: projectedLiveState.chapter1,
      inventory: nativeUsableItemCounts,
      overflowInventory: nativeOverflowCounts,
      inventoryRepairReason,
      completedGroveJobs: completedGroveJobCount(
        projectedLiveState.jobsBoard,
        actorId,
        jobsStartedAtMs
      ),
      vendorTransactions: projectedLiveState.economy.vendorTransactions,
    });
    state = await resolveChapter1EntityTarget(state, player, worldApi);
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
    if (state.requirement && !state.requirement.ready) {
      return {
        ...state,
        ok: false,
        status: "rejected" as const,
        reason:
          state.requirement.reason ??
          "Complete the objective requirements before continuing.",
      };
    }
    if (
      !state.withinRange &&
      !(state.requirement?.ready && state.requirement.autoCompleteWhenReady)
    ) {
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
      const lockedNowMs = Date.now();
      const lockedRead = await readHarthmerePlayerAndSharedStateStrings(
        redis.primary,
        stateKey,
        sharedStateKey
      );
      const raw = lockedRead.rawState;
      const liveState = parseHarthmereLiveModeBackendState(
        raw,
        actorId,
        lockedNowMs
      );
      mergeHarthmereLiveModeSharedWorldStateIntoBackend(
        liveState,
        parseHarthmereLiveModeSharedWorldState(
          lockedRead.rawSharedState,
          lockedNowMs
        ),
        lockedNowMs
      );
      const lockedRequirement = ch1ObjectiveRequirementState({
        step: active.step,
        runtime: liveState.chapter1,
        inventory: nativeUsableItemCounts,
        completedGroveJobs: completedGroveJobCount(
          liveState.jobsBoard,
          actorId,
          jobsStartedAtMs
        ),
        vendorTransactions: liveState.economy.vendorTransactions,
      });
      if (lockedRequirement && !lockedRequirement.ready) {
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          requirement: lockedRequirement,
          reason:
            lockedRequirement.reason ??
            "Complete the objective requirements before continuing.",
        };
      }
      let dungeonMechanicEffect: Ch1DungeonMechanicEffect | undefined;
      let effects: ReturnType<typeof ch1ApplyLiveObjectiveEffects>;
      try {
        effects = ch1ApplyLiveObjectiveEffects({
          runtime: liveState.chapter1,
          quest: active.quest,
          step: active.step,
          stepIndex: active.stepIndex,
          choice: requestedChoice,
          nowMs: lockedNowMs,
        });
        const mechanic = ch1DungeonMechanicForObjective(active.step.id);
        const survival = liveState.chapter1.dungeonSurvival;
        if (mechanic && survival) {
          // Reconcile the reserved counters with the actual pack before every
          // consequence. Dropping fuel on the Whale Road is meaningful; it
          // cannot remain available merely because it existed at gate entry.
          // Material storage can satisfy a town hand-in, but it is not on the
          // player's back. Dungeon fuel/light use and thin-ice weight must use
          // only bag + hotbar counts; otherwise banked vendor purchases make
          // the ice crack and can be consumed from hundreds of metres away.
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
        // A step can make durable progress without finishing — collecting the
        // ninth of twelve accounts, for instance. Persist what was earned, then
        // refuse the trigger so the objective stays open.
        if (error instanceof Ch1ObjectiveIncomplete) {
          liveState.chapter1 = error.runtime;
          liveState.updatedAtMs = lockedNowMs;
          await redis.primary.set(
            stateKey,
            stringifyHarthmereLiveModePlayerPersistenceState(liveState)
          );
          return {
            ...state,
            ok: false,
            status: "rejected" as const,
            reason: error.message,
          };
        }
        return {
          ...state,
          ok: false,
          status: "rejected" as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }

      const requiredItemCounts = new Map<string, number>();
      for (const itemId of effects.itemConsumes) {
        requiredItemCounts.set(
          itemId,
          (requiredItemCounts.get(itemId) ?? 0) + 1
        );
      }
      for (const [itemId, requiredCount] of requiredItemCounts) {
        if ((nativeUsableItemCounts[itemId] ?? 0) < requiredCount) {
          return {
            ...state,
            ok: false,
            status: "rejected" as const,
            // Display name, not the internal id. This used to read
            // "You need item_sorrel_field_ledger before completing this
            // objective." to the player. The flag set is passed so the two
            // compounds keep their pre-Act-6 cover names (journal §0: no
            // client-visible string may leak the twist early).
            reason: `You need ${requiredCount} × ${
              ch1ItemDisplayName(itemId, liveState.chapter1.flags) ?? "an item"
            } before completing this objective.`,
          };
        }
      }
      for (const itemId of effects.itemConsumes) {
        consumeChapter1DurableItem(liveState, itemId, 1);
      }
      for (const itemId of effects.itemGrants) {
        liveState.inventory.items[itemId] =
          (liveState.inventory.items[itemId] ?? 0) + 1;
      }
      const consumedDungeonResources: Record<string, number> = {};
      // Survival resources must be physically carried through the dungeon.
      // Plot-item hand-ins below may still use material storage, but storage
      // is deliberately excluded from this resource-consumption plan.
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
        for (const [itemId, consumedCount] of Object.entries(
          nativeConsumed.consumed
        )) {
          consumeChapter1DurableItem(liveState, itemId, consumedCount);
          consumedDungeonResources[itemId] =
            (consumedDungeonResources[itemId] ?? 0) + consumedCount;
        }
      }
      liveState.chapter1 = effects.runtime;
      liveState.updatedAtMs = lockedNowMs;
      const previousSerialized =
        raw ??
        stringifyHarthmereLiveModePlayerPersistenceState(
          parseHarthmereLiveModeBackendState(undefined, actorId, lockedNowMs)
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
                effect: dungeonMechanicEffect,
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
        const nativeTakeSources = chapter1NativeInventoryTakeSourcesForTest({
          required: nativeInventoryPlan.take,
          inventory: nativeInventoryCounts,
          materialStorage: nativeMaterialStorageCounts,
        });
        if (nativeTakeSources.missing.length > 0) {
          throw new Error(
            `Chapter 1 inventory changed before commit: ${nativeTakeSources.missing
              .map(({ itemId, count }) => `${count} × ${itemId}`)
              .join(", ")}`
          );
        }
        if (
          nativeInventoryPlan.take.length > 0 ||
          nativeInventoryPlan.give.length > 0
        ) {
          const storage = player.harthmereMaterialStorage();
          const take = createBag(
            ...nativeTakeSources.inventory.map(({ nativeId, count }) =>
              countOf(nativeId as BiomesId, BigInt(count))
            )
          );
          const storageTake = createBag(
            ...nativeTakeSources.materialStorage.map(({ nativeId, count }) =>
              countOf(nativeId as BiomesId, BigInt(count))
            )
          );
          const give = createBag(
            ...nativeInventoryPlan.give.map(({ nativeId, count }) =>
              countOf(nativeId as BiomesId, BigInt(count))
            )
          );
          const inventoryTransactionInput = {
            id: auth.userId,
            // Stable per objective: plot-item grants/turn-ins and dungeon
            // supplies are one exactly-once ECS transaction with progress.
            transaction_id: `chapter1:objective:${body.challengeId}:${body.stepId}:inventory:v1`,
            take,
            give,
            storage_take: storageTake,
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
        completionDialogue: ch1DialogueWithExitGuidanceForTest(
          ch1ObjectiveCompletionDialogue(active.step.id, requestedChoice),
          ch1ObjectiveExitGuidanceForTest({
            questId: active.quest.id,
            stepId: active.step.id,
            context: {
              runtime: effects.runtime,
              vendorTransactions: liveState.economy.vendorTransactions,
            },
          })
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
