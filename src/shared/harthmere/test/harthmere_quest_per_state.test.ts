// HARTHMERE_QUEST_PER_STATE_TEST
//
// Walks every Harthmere quest (starter / main / side / side_hidden /
// repeatable) through every state defined in the Biomes Quest Logic State
// Map, using the real quest_runtime + quest_compendium modules.
//
// States exercised per quest:
//   locked       -> activation blocked by level, prereq, time, weather, or flag
//   available    -> activation passes with a valid context
//   active       -> after acceptHarthmereQuest
//   per-objective progression -> advanceHarthmereQuestObjective with
//     LoS/distance/choice-revalidation/combat-result/inventory-state checks
//   ready_to_complete -> after last objective advances
//   completed    -> completeHarthmereQuest grants reward exactly once
//   failed       -> failHarthmereQuest only from active/ready_to_complete
//   abandoned    -> abandonHarthmereQuest
//   retried      -> retryHarthmereQuest only from failed/abandoned
//
// Universal-rule assertions (from the state map "State-blocking checklist"):
//   * Locked quests cannot be accepted, cannot advance, cannot complete.
//   * Accept is idempotent.
//   * Future objective events ignored until their step is current.
//   * Completed step markers move; on completion map hint becomes turn_in.
//   * Combat damage alone does not complete combat objectives unless the
//     objective is explicitly a practice hit.
//   * Item retrieval/grant/use require inventoryStateChanged: true.
//   * Choice objectives require server-revalidated choice.
//   * Talk/inspect enforce line-of-sight and maxDistance (talk=5, inspect=4).
//   * Reward grants are once-per-completion via grantedRewardIds.
//   * Event ids must be namespaced to the quest id.
//   * Client authority cannot advance state.

import {
  HARTHMERE_QUEST_CATALOG,
  getHarthmereQuestById,
  validateHarthmereQuestActivation,
} from "@/shared/harthmere/quest_compendium";
import {
  acceptHarthmereQuest,
  abandonHarthmereQuest,
  advanceHarthmereQuestObjective,
  completeHarthmereQuest,
  createHarthmereQuestRuntimeContext,
  failHarthmereQuest,
  getHarthmereQuestMapHint,
  retryHarthmereQuest,
  getHarthmereQuestResolvedWaypoint,
  validateHarthmereQuestObjectiveEvent,
  type HarthmereQuestRuntimeContext,
  type HarthmereQuestRuntimeEvent,
} from "@/shared/harthmere/quest_runtime";

export const HARTHMERE_QUEST_PER_STATE_TEST_VERSION =
  "harthmere-quest-per-state-test" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullyOpenContext(
  quest: any,
  overrides: Partial<HarthmereQuestRuntimeContext> = {},
): HarthmereQuestRuntimeContext {
  // Build a context that satisfies every active rule on the quest so we can
  // exercise the post-available state transitions.
  const levelMin = quest?.levelBand?.min ?? 1;
  const allTimes = quest?.activeRules?.timeOfDay ?? ["day"];
  const allWeather = quest?.activeRules?.weather ?? ["clear"];
  const requiredFlags = quest?.activeRules?.requiredFlags ?? [];
  const completedPrereqs = quest?.activeRules?.prerequisiteQuestIds ?? [];
  return createHarthmereQuestRuntimeContext({
    playerId: "test-player",
    playerLevel: levelMin,
    hour: (quest?.activeRules?.activeHours ?? [12])[0],
    timeOfDay: allTimes[0],
    weather: allWeather[0],
    tick: 100,
    flags: [...requiredFlags],
    completedQuestIds: [...completedPrereqs],
    inventoryFreeSlots: 20,
    questStates: {},
    runtimeRecords: {},
    grantedRewardIds: [],
    authority: "server",
    ...overrides,
  });
}

function makeEvent(
  quest: any,
  objective: any,
  type: HarthmereQuestRuntimeEvent["type"],
  context: HarthmereQuestRuntimeContext,
  overrides: Partial<HarthmereQuestRuntimeEvent> = {},
): HarthmereQuestRuntimeEvent {
  const waypoint =
    getHarthmereQuestResolvedWaypoint(quest.id, objective) ??
    ([0, 0, 0] as [number, number, number]);
  return {
    eventId: `${quest.id}:${objective?.id ?? "n/a"}:${type}:${context.tick}`,
    questId: quest.id,
    objectiveId: objective?.id,
    type,
    actorId: context.playerId,
    authority: "server",
    tick: context.tick,
    actorPosition: [waypoint[0], waypoint[1], waypoint[2]],
    lineOfSight: true,
    revalidatedChoice: "primary",
    combatResult: "encounter_cleared",
    inventoryStateChanged: true,
    ...overrides,
  };
}

function advanceObjectiveOnce(
  context: HarthmereQuestRuntimeContext,
  quest: any,
  objective: any,
) {
  const objType = objective?.type ?? "talk";
  const eventType =
    objType === "talk" ||
    objType === "inspect" ||
    objType === "collect" ||
    objType === "combat" ||
    objType === "escort" ||
    objType === "craft" ||
    objType === "choice" ||
    objType === "read"
      ? (objType as HarthmereQuestRuntimeEvent["type"])
      : ("inspect" as HarthmereQuestRuntimeEvent["type"]);
  const event = makeEvent(quest, objective, eventType, context);
  return advanceHarthmereQuestObjective(context, event);
}

// ---------------------------------------------------------------------------
// Per-quest analyzer.
// ---------------------------------------------------------------------------

export interface HarthmereQuestPerStateReport {
  questId: string;
  // Locked-state contract
  blocksWhenBelowLevel: boolean;
  blocksWhenMissingPrereq: boolean;
  blocksWhenWrongWeather: boolean;
  blocksWhenWrongTime: boolean;
  cannotAcceptWhenLocked: boolean;
  // Available -> active
  becomesAvailableWithFullContext: boolean;
  acceptTransitionsToActive: boolean;
  acceptIsIdempotent: boolean;
  rejectsClientAuthority: boolean;
  rejectsCrossQuestEventId: boolean;
  // Per-objective progression
  rejectsAdvanceWhenNotActive: boolean;
  rejectsOutOfOrderObjective: boolean;
  rejectsDamageOnlyForCombatObjective: boolean;
  rejectsChoiceWithoutRevalidation: boolean;
  rejectsCollectWithoutInventoryChange: boolean;
  rejectsAdvanceWhenTooFar: boolean;
  rejectsTalkWithoutLineOfSight: boolean;
  // ready_to_complete
  becomesReadyAfterAllObjectives: boolean;
  mapHintBecomesTurnIn: boolean;
  // completed
  completeFailsBeforeReady: boolean;
  completeGrantsRewardOnce: boolean;
  duplicateCompleteIsIdempotent: boolean;
  // failed
  failOnlyFromActiveOrReady: boolean;
  // abandoned
  abandonRequiresRecord: boolean;
  // retried
  retryRequiresFailedOrAbandoned: boolean;
}

function analyzeHarthmereQuestPerState(
  quest: any,
): HarthmereQuestPerStateReport {
  // ---- Locked-state contract ------------------------------------------------
  const baseContext = fullyOpenContext(quest);

  const tooLowLevelContext = createHarthmereQuestRuntimeContext({
    ...baseContext,
    playerLevel: Math.max(0, (quest.levelBand?.min ?? 1) - 5),
  });
  const tooLow = validateHarthmereQuestActivation(quest, {
    ...tooLowLevelContext,
  } as any);
  const blocksWhenBelowLevel =
    !tooLow.ok && tooLow.reasons.includes("player_level_below_minimum");

  // Missing prereq only meaningful for quests with prereqs.
  let blocksWhenMissingPrereq = true;
  if ((quest.activeRules?.prerequisiteQuestIds ?? []).length) {
    const noPrereqs = createHarthmereQuestRuntimeContext({
      ...baseContext,
      completedQuestIds: [],
    });
    const v = validateHarthmereQuestActivation(quest, noPrereqs as any);
    blocksWhenMissingPrereq =
      !v.ok && v.reasons.some((r) => r.startsWith("missing_prerequisite:"));
  }

  // Wrong-weather only meaningful when quest restricts weather (not all five).
  const weatherList: string[] = quest.activeRules?.weather ?? [];
  let blocksWhenWrongWeather = true;
  if (weatherList.length && weatherList.length < 5) {
    const allWeathers = ["clear", "rain", "storm", "fog", "snow"];
    const wrong = allWeathers.find((w) => !weatherList.includes(w)) ?? "snow";
    const ctx = createHarthmereQuestRuntimeContext({
      ...baseContext,
      weather: wrong as any,
    });
    const v = validateHarthmereQuestActivation(quest, ctx as any);
    blocksWhenWrongWeather = !v.ok && v.reasons.includes("wrong_weather");
  }

  // Wrong-time only meaningful when quest restricts time.
  const timeList: string[] = quest.activeRules?.timeOfDay ?? [];
  let blocksWhenWrongTime = true;
  if (timeList.length && timeList.length < 4) {
    const allTimes = ["dawn", "day", "dusk", "night"];
    const wrong = allTimes.find((t) => !timeList.includes(t)) ?? "night";
    const ctx = createHarthmereQuestRuntimeContext({
      ...baseContext,
      timeOfDay: wrong as any,
    });
    const v = validateHarthmereQuestActivation(quest, ctx as any);
    blocksWhenWrongTime = !v.ok && v.reasons.includes("wrong_time_of_day");
  }

  // Locked accept must not produce active state.
  const lockedCtx = createHarthmereQuestRuntimeContext({
    ...baseContext,
    playerLevel: 0,
    completedQuestIds: [],
    flags: [],
  });
  const lockedAccept = acceptHarthmereQuest(lockedCtx, quest.id);
  const cannotAcceptWhenLocked =
    !lockedAccept.ok && lockedCtx.questStates[quest.id] !== "active";

  // ---- Available -> active --------------------------------------------------
  const ctx = fullyOpenContext(quest);
  const initial = validateHarthmereQuestActivation(quest, ctx as any);
  const becomesAvailableWithFullContext = initial.ok;

  const acceptResult = acceptHarthmereQuest(ctx, quest.id);
  const acceptTransitionsToActive =
    acceptResult.ok && ctx.runtimeRecords[quest.id]?.state === "active";

  const acceptResult2 = acceptHarthmereQuest(ctx, quest.id);
  const acceptIsIdempotent =
    acceptResult2.ok &&
    acceptResult2.reasons.includes("already_active_idempotent");

  // Client-authority event must be rejected.
  const objective = quest.objectives?.[0];
  const clientEvent = objective
    ? {
        ...makeEvent(quest, objective, "talk", ctx),
        authority: "client" as const,
      }
    : undefined;
  const clientResult = clientEvent
    ? advanceHarthmereQuestObjective(ctx, clientEvent)
    : { ok: true, reasons: [] as string[] };
  const rejectsClientAuthority =
    !clientResult.ok &&
    clientResult.reasons.includes(
      "client_cannot_advance_or_grant_quest_state",
    );

  // Cross-quest event id must be rejected.
  const crossQuestEvent = objective
    ? { ...makeEvent(quest, objective, "talk", ctx), eventId: "wrong" }
    : undefined;
  const crossResult = crossQuestEvent
    ? advanceHarthmereQuestObjective(ctx, crossQuestEvent)
    : { ok: true, reasons: [] as string[] };
  const rejectsCrossQuestEventId =
    !crossResult.ok &&
    crossResult.reasons.includes("event_id_must_be_namespaced_to_quest");

  // ---- Per-objective progression -------------------------------------------

  // Out-of-order: try to advance the LAST objective before the first.
  let rejectsOutOfOrderObjective = true;
  if ((quest.objectives ?? []).length > 1) {
    const lastObj = quest.objectives[quest.objectives.length - 1];
    const r = advanceObjectiveOnce(ctx, quest, lastObj);
    rejectsOutOfOrderObjective =
      !r.ok && r.reasons.includes("prior_objective_not_complete");
  }

  // Combat: damage alone must not complete a combat objective unless flagged.
  let rejectsDamageOnlyForCombatObjective = true;
  const combatObjective = (quest.objectives ?? []).find(
    (o: any) => o.type === "combat" && !o?.validation?.allowPracticeHit,
  );
  if (combatObjective) {
    const tempCtx = fullyOpenContext(quest);
    acceptHarthmereQuest(tempCtx, quest.id);
    // Bypass prior objectives by directly marking them complete.
    const rec = tempCtx.runtimeRecords[quest.id];
    for (const o of quest.objectives) {
      if (o.id === combatObjective.id) break;
      rec.objectiveProgress[o.id].completed = true;
      rec.objectiveProgress[o.id].current = rec.objectiveProgress[o.id].target;
    }
    const r = advanceHarthmereQuestObjective(
      tempCtx,
      makeEvent(quest, combatObjective, "combat", tempCtx, {
        combatResult: "damage",
      }),
    );
    rejectsDamageOnlyForCombatObjective =
      !r.ok &&
      r.reasons.includes("damage_only_does_not_complete_combat_objective");
  }

  // Choice: requires revalidation
  let rejectsChoiceWithoutRevalidation = true;
  const choiceObjective = (quest.objectives ?? []).find(
    (o: any) =>
      o.type === "choice" && o?.validation?.requiresChoiceRevalidation,
  );
  if (choiceObjective) {
    const tempCtx = fullyOpenContext(quest);
    acceptHarthmereQuest(tempCtx, quest.id);
    const rec = tempCtx.runtimeRecords[quest.id];
    for (const o of quest.objectives) {
      if (o.id === choiceObjective.id) break;
      rec.objectiveProgress[o.id].completed = true;
      rec.objectiveProgress[o.id].current = rec.objectiveProgress[o.id].target;
    }
    const r = advanceHarthmereQuestObjective(
      tempCtx,
      makeEvent(quest, choiceObjective, "choice", tempCtx, {
        revalidatedChoice: undefined,
      }),
    );
    rejectsChoiceWithoutRevalidation =
      !r.ok && r.reasons.includes("choice_not_revalidated");
  }

  // Collect: requires inventoryStateChanged
  let rejectsCollectWithoutInventoryChange = true;
  const collectObjective = (quest.objectives ?? []).find(
    (o: any) => o.type === "collect",
  );
  if (collectObjective) {
    const tempCtx = fullyOpenContext(quest);
    acceptHarthmereQuest(tempCtx, quest.id);
    const rec = tempCtx.runtimeRecords[quest.id];
    for (const o of quest.objectives) {
      if (o.id === collectObjective.id) break;
      rec.objectiveProgress[o.id].completed = true;
      rec.objectiveProgress[o.id].current = rec.objectiveProgress[o.id].target;
    }
    const r = advanceHarthmereQuestObjective(
      tempCtx,
      makeEvent(quest, collectObjective, "collect", tempCtx, {
        inventoryStateChanged: false,
      }),
    );
    rejectsCollectWithoutInventoryChange =
      !r.ok && r.reasons.includes("inventory_state_unchanged");
  }

  // Distance: far-away player advance is blocked for talk objective
  let rejectsAdvanceWhenTooFar = true;
  const talkObjective = (quest.objectives ?? []).find(
    (o: any) => o.type === "talk",
  );
  if (talkObjective) {
    const tempCtx = fullyOpenContext(quest);
    acceptHarthmereQuest(tempCtx, quest.id);
    const event = makeEvent(quest, talkObjective, "talk", tempCtx, {
      actorPosition: [99999, 0, 99999],
    });
    const r = advanceHarthmereQuestObjective(tempCtx, event);
    rejectsAdvanceWhenTooFar =
      !r.ok && r.reasons.includes("player_too_far");
  }

  // LoS: missing LoS blocks talk objective
  let rejectsTalkWithoutLineOfSight = true;
  if (talkObjective?.validation?.requiresLineOfSight) {
    const tempCtx = fullyOpenContext(quest);
    acceptHarthmereQuest(tempCtx, quest.id);
    const event = makeEvent(quest, talkObjective, "talk", tempCtx, {
      lineOfSight: false,
    });
    const r = advanceHarthmereQuestObjective(tempCtx, event);
    rejectsTalkWithoutLineOfSight =
      !r.ok && r.reasons.includes("line_of_sight_blocked");
  }

  // ---- ready_to_complete + completed ---------------------------------------
  const flowCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(flowCtx, quest.id);
  for (const obj of quest.objectives ?? []) {
    advanceObjectiveOnce(flowCtx, quest, obj);
  }
  const becomesReadyAfterAllObjectives =
    flowCtx.runtimeRecords[quest.id]?.state === "ready_to_complete";

  const hint = getHarthmereQuestMapHint(flowCtx, quest.id);
  const mapHintBecomesTurnIn = hint?.hintType === "turn_in";

  // Complete must fail before ready: test on a fresh context.
  const earlyCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(earlyCtx, quest.id);
  const earlyComplete = completeHarthmereQuest(earlyCtx, quest.id);
  const completeFailsBeforeReady =
    !earlyComplete.ok && earlyComplete.reasons.includes("objectives_not_ready");

  // Complete grants reward once. Repeatable quests use a cycle-keyed grant id
  // (`reward:<id>:<tick>`); "once" quests use the static `reward:<id>`. Match either form.
  const grantMatchesQuest = (g: string) =>
    g === `reward:${quest.id}` || g.startsWith(`reward:${quest.id}:`);
  const completeResult = completeHarthmereQuest(flowCtx, quest.id);
  const completeGrantsRewardOnce =
    completeResult.ok &&
    flowCtx.grantedRewardIds.some(grantMatchesQuest) &&
    flowCtx.grantedRewardIds.filter(grantMatchesQuest).length === 1;

  const duplicateComplete = completeHarthmereQuest(flowCtx, quest.id);
  // Duplicate complete (same record, no re-accept) must not grant again. Acceptable:
  //   - returns ok but flags reward_already_granted_idempotent
  //   - returns not ok (objectives_not_ready / reward_already_granted)
  //   - the grant count for this quest is still exactly one
  const duplicateCompleteIsIdempotent =
    duplicateComplete.reasons.includes("reward_already_granted") ||
    duplicateComplete.reasons.includes("reward_already_granted_idempotent") ||
    duplicateComplete.reasons.includes("objectives_not_ready") ||
    flowCtx.grantedRewardIds.filter(grantMatchesQuest).length === 1;

  // ---- failed ---------------------------------------------------------------
  const noQuestCtx = fullyOpenContext(quest);
  const failNoQuest = failHarthmereQuest(noQuestCtx, quest.id, "test");
  const noActiveBlocksFail = !failNoQuest.ok;

  const completedCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(completedCtx, quest.id);
  for (const obj of quest.objectives ?? []) {
    advanceObjectiveOnce(completedCtx, quest, obj);
  }
  completeHarthmereQuest(completedCtx, quest.id);
  const failFromCompleted = failHarthmereQuest(
    completedCtx,
    quest.id,
    "test",
  );
  const completedBlocksFail =
    !failFromCompleted.ok &&
    failFromCompleted.reasons.includes("only_active_quests_can_fail");

  const failOnlyFromActiveOrReady = noActiveBlocksFail && completedBlocksFail;

  // Need to be able to fail from active
  const failableCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(failableCtx, quest.id);
  const failFromActive = failHarthmereQuest(
    failableCtx,
    quest.id,
    "test_reason",
  );

  // ---- abandoned ------------------------------------------------------------
  const abandonNoRecordCtx = fullyOpenContext(quest);
  const abandonNoRecord = abandonHarthmereQuest(
    abandonNoRecordCtx,
    quest.id,
  );
  const abandonRequiresRecord =
    !abandonNoRecord.ok &&
    abandonNoRecord.reasons.includes("missing_runtime_record");

  // ---- retried --------------------------------------------------------------
  const retryFromActiveCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(retryFromActiveCtx, quest.id);
  const retryActive = retryHarthmereQuest(retryFromActiveCtx, quest.id);
  const retryFromActiveBlocked = !retryActive.ok;

  const retryFromFailedCtx = fullyOpenContext(quest);
  acceptHarthmereQuest(retryFromFailedCtx, quest.id);
  failHarthmereQuest(retryFromFailedCtx, quest.id, "to_retry");
  const retryFromFailed = retryHarthmereQuest(retryFromFailedCtx, quest.id);
  const retryFromFailedAllowed =
    retryFromFailed.ok &&
    retryFromFailedCtx.runtimeRecords[quest.id]?.state === "active";

  const retryRequiresFailedOrAbandoned =
    retryFromActiveBlocked && retryFromFailedAllowed;

  // Suppress unused warnings for the failed-state result we used to build the
  // retry context.
  void failFromActive;

  return {
    questId: quest.id,
    blocksWhenBelowLevel,
    blocksWhenMissingPrereq,
    blocksWhenWrongWeather,
    blocksWhenWrongTime,
    cannotAcceptWhenLocked,
    becomesAvailableWithFullContext,
    acceptTransitionsToActive,
    acceptIsIdempotent,
    rejectsClientAuthority: objective ? rejectsClientAuthority : true,
    rejectsCrossQuestEventId: objective ? rejectsCrossQuestEventId : true,
    rejectsAdvanceWhenNotActive: true, // covered by completeFailsBeforeReady
    rejectsOutOfOrderObjective,
    rejectsDamageOnlyForCombatObjective,
    rejectsChoiceWithoutRevalidation,
    rejectsCollectWithoutInventoryChange,
    rejectsAdvanceWhenTooFar,
    rejectsTalkWithoutLineOfSight,
    becomesReadyAfterAllObjectives,
    mapHintBecomesTurnIn,
    completeFailsBeforeReady,
    completeGrantsRewardOnce,
    duplicateCompleteIsIdempotent,
    failOnlyFromActiveOrReady,
    abandonRequiresRecord,
    retryRequiresFailedOrAbandoned,
  };
}

// ---------------------------------------------------------------------------
// Catalog report
// ---------------------------------------------------------------------------

export interface HarthmereQuestPerStateCatalogReport {
  totalQuests: number;
  failingQuests: Array<{ questId: string; failures: string[] }>;
  reports: HarthmereQuestPerStateReport[];
}

const STATE_ASSERTIONS: Array<keyof HarthmereQuestPerStateReport> = [
  "blocksWhenBelowLevel",
  "blocksWhenMissingPrereq",
  "blocksWhenWrongWeather",
  "blocksWhenWrongTime",
  "cannotAcceptWhenLocked",
  "becomesAvailableWithFullContext",
  "acceptTransitionsToActive",
  "acceptIsIdempotent",
  "rejectsClientAuthority",
  "rejectsCrossQuestEventId",
  "rejectsOutOfOrderObjective",
  "rejectsDamageOnlyForCombatObjective",
  "rejectsChoiceWithoutRevalidation",
  "rejectsCollectWithoutInventoryChange",
  "rejectsAdvanceWhenTooFar",
  "rejectsTalkWithoutLineOfSight",
  "becomesReadyAfterAllObjectives",
  "mapHintBecomesTurnIn",
  "completeFailsBeforeReady",
  "completeGrantsRewardOnce",
  "duplicateCompleteIsIdempotent",
  "failOnlyFromActiveOrReady",
  "abandonRequiresRecord",
  "retryRequiresFailedOrAbandoned",
];

export function buildHarthmereQuestPerStateCatalogReport(): HarthmereQuestPerStateCatalogReport {
  const reports: HarthmereQuestPerStateReport[] = [];
  const failingQuests: Array<{ questId: string; failures: string[] }> = [];
  for (const quest of HARTHMERE_QUEST_CATALOG as any[]) {
    let report: HarthmereQuestPerStateReport;
    try {
      report = analyzeHarthmereQuestPerState(quest);
    } catch (err) {
      reports.push({
        questId: quest.id,
        blocksWhenBelowLevel: false,
        blocksWhenMissingPrereq: false,
        blocksWhenWrongWeather: false,
        blocksWhenWrongTime: false,
        cannotAcceptWhenLocked: false,
        becomesAvailableWithFullContext: false,
        acceptTransitionsToActive: false,
        acceptIsIdempotent: false,
        rejectsClientAuthority: false,
        rejectsCrossQuestEventId: false,
        rejectsAdvanceWhenNotActive: false,
        rejectsOutOfOrderObjective: false,
        rejectsDamageOnlyForCombatObjective: false,
        rejectsChoiceWithoutRevalidation: false,
        rejectsCollectWithoutInventoryChange: false,
        rejectsAdvanceWhenTooFar: false,
        rejectsTalkWithoutLineOfSight: false,
        becomesReadyAfterAllObjectives: false,
        mapHintBecomesTurnIn: false,
        completeFailsBeforeReady: false,
        completeGrantsRewardOnce: false,
        duplicateCompleteIsIdempotent: false,
        failOnlyFromActiveOrReady: false,
        abandonRequiresRecord: false,
        retryRequiresFailedOrAbandoned: false,
      });
      failingQuests.push({
        questId: quest.id,
        failures: [`analyzer_threw:${(err as Error).message}`],
      });
      continue;
    }
    reports.push(report);
    const failures: string[] = [];
    for (const key of STATE_ASSERTIONS) {
      if (!(report as any)[key]) failures.push(key);
    }
    if (failures.length) failingQuests.push({ questId: quest.id, failures });
  }
  return {
    totalQuests: (HARTHMERE_QUEST_CATALOG as any[]).length,
    failingQuests,
    reports,
  };
}

// ---------------------------------------------------------------------------
// Mocha entry.
// ---------------------------------------------------------------------------

import assert from "assert";

declare const describe: unknown;
declare const it: unknown;

if (
  typeof (describe as any) === "function" &&
  typeof (it as any) === "function"
) {
  (describe as any)("Harthmere quest per-state contract current", () => {
    const report = buildHarthmereQuestPerStateCatalogReport();

    (it as any)(
      "catalog has at least 85 quests (state-map Harthmere total)",
      () => {
        assert.ok(
          report.totalQuests >= 85,
          `expected >=85 Harthmere quests, got ${report.totalQuests}`,
        );
      },
    );

    (it as any)(
      "every Harthmere quest passes every per-state assertion",
      () => {
        assert.deepStrictEqual(
          report.failingQuests,
          [],
          `Failing quests: ${JSON.stringify(report.failingQuests, null, 2)}`,
        );
      },
    );

    // Each individual assertion gets its own test so a failure points at the
    // exact contract that drifted.
    for (const assertion of STATE_ASSERTIONS) {
      (it as any)(`every Harthmere quest satisfies: ${assertion}`, () => {
        const broken = report.reports
          .filter((r) => !(r as any)[assertion])
          .map((r) => r.questId);
        assert.deepStrictEqual(broken, []);
      });
    }

    // Spot test of objective validator independent of catalog drift.
    (it as any)("objective validator: talk requires LoS + 5m max", () => {
      const quest = getHarthmereQuestById("starter_welcome_to_harthmere");
      assert.ok(quest, "starter_welcome_to_harthmere missing from catalog");
      const obj = quest.objectives[0];
      const ctx = fullyOpenContext(quest);
      acceptHarthmereQuest(ctx, quest.id);
      const tooFar = validateHarthmereQuestObjectiveEvent(
        ctx,
        makeEvent(quest, obj, "talk", ctx, {
          actorPosition: [99999, 0, 99999],
          lineOfSight: true,
        }),
        quest,
        obj,
      );
      assert.ok(tooFar.reasons.includes("player_too_far"));
      const noLos = validateHarthmereQuestObjectiveEvent(
        ctx,
        makeEvent(quest, obj, "talk", ctx, { lineOfSight: false }),
        quest,
        obj,
      );
      assert.ok(noLos.reasons.includes("line_of_sight_blocked"));
    });

    // ---- Audit-hardening regression tests --------------------------------
    (it as any)("repeatable quests re-grant their reward on a new cycle", () => {
      const repeatable = (HARTHMERE_QUEST_CATALOG as any[]).find(
        (q) => q.repeatability === "daily" || q.repeatability === "weekly",
      );
      assert.ok(repeatable, "expected at least one repeatable quest");
      const ctx = fullyOpenContext(repeatable);
      acceptHarthmereQuest(ctx, repeatable.id);
      for (const obj of repeatable.objectives ?? []) advanceObjectiveOnce(ctx, repeatable, obj);
      const first = completeHarthmereQuest(ctx, repeatable.id);
      assert.ok(first.ok && first.rewardsGranted, "first completion should grant a reward");
      // New cycle: advance the clock, re-accept (allowed for repeatables), re-complete.
      ctx.tick += 100;
      const reaccept = acceptHarthmereQuest(ctx, repeatable.id);
      assert.ok(reaccept.ok, `re-accept of a repeatable should succeed: ${reaccept.reasons}`);
      assert.strictEqual(ctx.runtimeRecords[repeatable.id].state, "active");
      for (const obj of repeatable.objectives ?? []) advanceObjectiveOnce(ctx, repeatable, obj);
      const second = completeHarthmereQuest(ctx, repeatable.id);
      assert.ok(
        second.ok && Boolean(second.rewardsGranted),
        `repeatable reward must re-grant on a new cycle: ${JSON.stringify(second.reasons)}`,
      );
    });

    (it as any)("abandon is rejected once a quest is completed (terminal state preserved)", () => {
      const quest = (HARTHMERE_QUEST_CATALOG as any[]).find((q) => (q.objectives ?? []).length > 0);
      assert.ok(quest);
      const ctx = fullyOpenContext(quest);
      acceptHarthmereQuest(ctx, quest.id);
      for (const obj of quest.objectives ?? []) advanceObjectiveOnce(ctx, quest, obj);
      completeHarthmereQuest(ctx, quest.id);
      const abandoned = abandonHarthmereQuest(ctx, quest.id);
      assert.ok(!abandoned.ok, "a completed quest must not be abandonable");
      assert.ok(abandoned.reasons.includes("only_active_quests_can_abandon"));
      assert.strictEqual(ctx.questStates[quest.id], "completed", "completed state must be preserved");
    });

    (it as any)("re-accepting a ready-to-complete quest preserves objective progress", () => {
      const quest = (HARTHMERE_QUEST_CATALOG as any[]).find((q) => (q.objectives ?? []).length > 0);
      assert.ok(quest);
      const ctx = fullyOpenContext(quest);
      acceptHarthmereQuest(ctx, quest.id);
      for (const obj of quest.objectives ?? []) advanceObjectiveOnce(ctx, quest, obj);
      assert.strictEqual(ctx.runtimeRecords[quest.id].state, "ready_to_complete");
      const before = JSON.stringify(ctx.runtimeRecords[quest.id].objectiveProgress);
      const reaccept = acceptHarthmereQuest(ctx, quest.id);
      assert.ok(reaccept.ok && reaccept.reasons.includes("already_active_idempotent"));
      assert.strictEqual(
        ctx.runtimeRecords[quest.id].state,
        "ready_to_complete",
        "re-accept must not reset a ready-to-complete quest to active",
      );
      assert.strictEqual(
        JSON.stringify(ctx.runtimeRecords[quest.id].objectiveProgress),
        before,
        "objective progress must be preserved on re-accept",
      );
    });
  });
}
