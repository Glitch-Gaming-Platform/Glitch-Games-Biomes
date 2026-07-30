// HARTHMERE_BIBLE_QUEST_LIVE_AUTHORITY
//
// The server-authoritative seam for the 85-quest Bellbound Dragon catalog.
//
// WHAT THIS FILE IS NOW (post Chapter 1-shape migration, phases 3-4)
// ------------------------------------------------------------------
// Native ECS `Challenges` + `TriggerState` are the ONLY progress authority.
// This module no longer holds a quest state machine; `quest_runtime.ts` and
// its seven states are deleted. What remains is the three jobs that are
// genuinely live-mode's:
//
//   1. VALIDATE   — may this actor start/advance this objective?
//                   (gate + step validation, both pure, both under bible/)
//   2. INSTRUCT   — what should the backend do about it? Reward grants,
//                   native progress publishes, active-journal mirrors.
//   3. OWN THE RESIDUE — reputation, cadence stamps, choices, story flags,
//                   titles and Thaedryn phase, which have no ECS component.
//
// It never mutates inventory directly, so the backend keeps one choke point
// for economy writes.
//
// THE IMPORTANT STRUCTURAL CHANGE
// -------------------------------
// Progress is no longer read from or written to Redis. The caller passes a
// snapshot of native progress (`native`), and the reducer returns instructions
// the backend carries out through the SIGNED `harthmereQuestProgress` path —
// the same path Chapter 1 uses, which `harthmere_quest_progress.ts`
// re-validates three ways (JWT signature, challenge in `in_progress`, step
// present in the biscuit's trigger tree).
//
// The old direct `Challenges`/`TriggerState` write in
// `native_ecs_drop_materialization.ts` goes with it. One writer, not two.
//
// See docs/harthmere/BIBLE_TO_CH1_MIGRATION.md.

import {
  BIBLE_QUEST_CATALOG,
  BIBLE_STARTER_TWIN_CLIENT_IDS,
  bibleCompletedQuestIds,
  bibleQuest,
  bibleQuestIdsForGiver,
} from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleQuestGate,
  type BibleGateContext,
} from "@/shared/harthmere/bible/bible_quest_gate";
import {
  bibleAllStepsFired,
  bibleCurrentStep,
  validateBibleStepSubmission,
} from "@/shared/harthmere/bible/bible_step_validation";
import {
  bibleNativeQuestId,
  bibleNativeStepId,
} from "@/shared/harthmere/bible/bible_quest_ids";
import {
  bibleQuestWorldWaypoint,
  bibleStepWorldWaypoint,
} from "@/shared/harthmere/bible/bible_waypoints";
import {
  bibleStepObjectiveItemGrant,
  type BibleObjectiveItemGrant,
} from "@/shared/harthmere/bible/bible_objective_items";
import {
  BIBLE_DRAGON_QUEST_ID,
  BIBLE_Q12_OBJECTIVE_IDS,
  BIBLE_THAEDRYN_ARENA_AUTHORED_ANCHOR,
  BIBLE_THAEDRYN_COMBAT_ENTITY_KEY,
  BIBLE_THAEDRYN_ENTITY_ID,
  bibleThaedrynArenaWorldAnchor,
  bibleThaedrynWaypointOverride,
} from "@/shared/harthmere/bible/bible_thaedryn";
import {
  defaultBibleLiveSlice,
  normalizeBibleLiveSlice,
  type BibleLiveSlice,
} from "@/shared/harthmere/bible/bible_live_slice";
import {
  bibleQuestGiverId,
  type BibleQuestDef,
  type BibleTimeOfDay,
  type BibleWeather,
} from "@/shared/harthmere/bible/bible_quest_schema";
import {
  applyThaedrynBossEvent,
  completeThaedrynBoss,
  createThaedrynBossState,
  getThaedrynPhaseForState,
  type HarthmereThaedrynBossState,
  type HarthmereThaedrynPath,
} from "@/shared/harthmere/thaedryn_boss";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BIBLE_QUEST_LIVE_AUTHORITY_VERSION =
  "harthmere-bible-quest-live-authority-native" as const;

// ---------------------------------------------------------------------------
// Re-exports.
//
// Identity and anchor constants moved to `bible/bible_thaedryn.ts` so a module
// needing the dragon's entity id no longer drags this file's whole graph in.
// These are the single definition re-exported, not a copy.
// ---------------------------------------------------------------------------

export const HARTHMERE_BIBLE_DRAGON_QUEST_ID = BIBLE_DRAGON_QUEST_ID;
export const HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID = BIBLE_THAEDRYN_ENTITY_ID;
export const HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID =
  BIBLE_THAEDRYN_COMBAT_ENTITY_KEY;
export const HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR =
  BIBLE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
export const HARTHMERE_Q12_OBJECTIVE_IDS = BIBLE_Q12_OBJECTIVE_IDS;
export const harthmereThaedrynArenaWorldAnchor = bibleThaedrynArenaWorldAnchor;
export const HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS =
  BIBLE_STARTER_TWIN_CLIENT_IDS;

export type HarthmereBibleQuestLiveSlice = BibleLiveSlice;
export const defaultHarthmereBibleQuestLiveSlice = defaultBibleLiveSlice;
export const normalizeHarthmereBibleQuestLiveSlice = normalizeBibleLiveSlice;

export const HARTHMERE_BIBLE_QUEST_OPERATION_PREFIX = "bible_quest_" as const;
export type HarthmereBibleQuestOperation =
  | "bible_quest_read"
  | "bible_quest_accept"
  | "bible_quest_advance"
  | "bible_quest_complete"
  | "bible_quest_abandon"
  | "bible_quest_boss_event";

/** Journal `source` tag mirrored into the shared `quests.active` record. */
export const HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE = "bible_catalog" as const;

/**
 * `bible_quest_retry` is RETIRED.
 *
 * It restarted a `failed` quest, and no authored quest can fail: nothing sets
 * an expiry, and the authored `failureCases` are rejected submissions rather
 * than quest failures (migration doc section 9.3). Abandon already covers "let
 * me start over". A client still sending the old operation gets
 * `unknown_operation` instead of a silent no-op.
 */
export const HARTHMERE_RETIRED_BIBLE_OPERATIONS = Object.freeze([
  "bible_quest_retry",
] as const);

// ---------------------------------------------------------------------------
// Giver index + completed-id folding. Both derived from quest data.
// ---------------------------------------------------------------------------

export function harthmereBibleQuestsByGiver(): Record<string, string[]> {
  const byGiver: Record<string, string[]> = {};
  for (const quest of BIBLE_QUEST_CATALOG) {
    const giverId = bibleQuestGiverId(quest);
    if (!giverId || quest.hidden || quest.category === "starter") continue;
    (byGiver[giverId] ??= []).push(quest.id);
  }
  return byGiver;
}

export function harthmereBibleCompletedQuestIds(
  completed: Record<string, number> | undefined
): string[] {
  return [...bibleCompletedQuestIds(Object.keys(completed ?? {}))];
}

// ---------------------------------------------------------------------------
// Clock + weather normalization.
//
// The game hour derives from wall time; the client's weather claim is
// validated against the closed union rather than trusted.
// ---------------------------------------------------------------------------

const MS_PER_GAME_DAY = 20 * 60 * 1000;

export function harthmereBibleGameHourFromMs(nowMs: number): number {
  return ((nowMs % MS_PER_GAME_DAY) / MS_PER_GAME_DAY) * 24;
}

export function harthmereBibleTimeOfDayForHour(hour: number): BibleTimeOfDay {
  if (hour < 6) return "night";
  if (hour < 8) return "dawn";
  if (hour < 18) return "day";
  if (hour < 20) return "dusk";
  return "night";
}

export function harthmereBibleQuestEvaluationNowMs(nowMs: number): number {
  return Number.isFinite(nowMs) ? nowMs : Date.now();
}

const VALID_WEATHER: readonly BibleWeather[] = [
  "clear",
  "rain",
  "storm",
  "fog",
  "snow",
];

export function harthmereBibleQuestEvaluationWeather(
  claim: string | undefined
): BibleWeather {
  return VALID_WEATHER.includes(claim as BibleWeather)
    ? (claim as BibleWeather)
    : "clear";
}

export interface HarthmereBibleQuestContextInput {
  actorId: string;
  playerLevel: number;
  completedQuests: Record<string, number> | undefined;
  slice: BibleLiveSlice;
  nowMs: number;
  weatherClaim?: string;
}

export function buildHarthmereBibleQuestContext(
  input: HarthmereBibleQuestContextInput
): BibleGateContext {
  const nowMs = harthmereBibleQuestEvaluationNowMs(input.nowMs);
  const hour = harthmereBibleGameHourFromMs(nowMs);
  return {
    playerLevel: Math.max(1, Math.trunc(input.playerLevel) || 1),
    hour,
    timeOfDay: harthmereBibleTimeOfDayForHour(hour),
    weather: harthmereBibleQuestEvaluationWeather(input.weatherClaim),
    completedQuestIds: bibleCompletedQuestIds(
      Object.keys(input.completedQuests ?? {})
    ),
    flags: new Set(input.slice.flags),
    lastCompletedAtMs: input.slice.lastCompletedAtMs,
    nowMs,
  };
}

// ---------------------------------------------------------------------------
// Dialogue offers.
// ---------------------------------------------------------------------------

export interface HarthmereBibleQuestOffer {
  questId: string;
  title: string;
  premise: string;
  offerText: string;
  rewardPreview: string;
  levelBand: { min: number; max: number };
  estimatedMinutes: number;
  /** Present when the gate currently blocks the offer. */
  blockedReasons?: string[];
}

function offerFor(quest: BibleQuestDef): HarthmereBibleQuestOffer {
  return {
    questId: quest.id,
    title: quest.title,
    premise: quest.premise,
    offerText: quest.dialogue.offer,
    rewardPreview: quest.rewards.previewText,
    levelBand: { ...quest.gate.levelBand },
    estimatedMinutes: quest.estimatedMinutes,
  };
}

export function harthmereBibleQuestOffersForGiver(input: {
  giverId: string;
  context: BibleGateContext;
  inProgressQuestIds: ReadonlySet<string>;
}): HarthmereBibleQuestOffer[] {
  const offers: HarthmereBibleQuestOffer[] = [];
  for (const questId of bibleQuestIdsForGiver(input.giverId)) {
    const quest = bibleQuest(questId);
    if (!quest) continue;
    if (input.inProgressQuestIds.has(questId)) continue;
    const gate = bibleQuestGate(quest, input.context);
    if (gate.ok) {
      offers.push(offerFor(quest));
      continue;
    }
    // A quest blocked only by level, time or weather is still worth surfacing
    // so the NPC can say "come back at dusk" instead of pretending it does not
    // exist. A missing prerequisite, a spent cadence, or a finished once-only
    // quest is hidden — the player has no way to know it exists yet, or has
    // already seen it.
    const hidesEntirely = gate.failures.some(
      (failure) =>
        failure.reason === "missing_prerequisite" ||
        failure.reason === "already_completed_once" ||
        failure.reason === "cadence_cooldown"
    );
    if (hidesEntirely) continue;
    offers.push({
      ...offerFor(quest),
      blockedReasons: gate.failures.map((failure) => failure.reason),
    });
  }
  return offers;
}

/** First unfired objective, in authored order. */
export function harthmereBibleQuestCurrentObjective(
  questId: string,
  firedStepIds: ReadonlySet<string>
) {
  const quest = bibleQuest(questId);
  return quest ? bibleCurrentStep(quest, firedStepIds) : undefined;
}

export function harthmereBibleQuestObjectiveWaypointOverride(
  questId: string,
  stepId?: string
): Vec3 | undefined {
  return stepId ? bibleThaedrynWaypointOverride(questId, stepId) : undefined;
}

// ---------------------------------------------------------------------------
// Reward instructions. The reducer returns these; the backend applies them.
// ---------------------------------------------------------------------------

export interface HarthmereBibleQuestRewardInstructions {
  questId: string;
  rewardGrantId: string;
  xpDelta: number;
  goldDelta: number;
  items: Array<{ itemId: string; count: number; displayName: string }>;
  titles: string[];
  unlockFlags: string[];
  reputation: Record<string, number>;
  previewText: string;
}

export function harthmereBibleRewardItemDisplayName(itemId: string): string {
  return itemId
    .split(/[_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The catalog's reward item ids exist in NO item catalogue, so a naive
 * `items[itemId] += 1` would create inventory rows the UI cannot name. The
 * backend registers a definition per granted item from this payload.
 */
export function harthmereBibleRewardItemDefinition(itemId: string) {
  return {
    itemId,
    displayName: harthmereBibleRewardItemDisplayName(itemId),
    description: "A keepsake earned in service of Harthmere.",
    maxStackSize: 99,
    baseValue: 0,
    // Reward keepsakes are bound — not tradeable, not vendorable — matching
    // every other quest item.
    binding: "quest" as const,
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [] as string[],
    stats: {},
    tradeable: false,
  };
}

export function harthmereBibleObjectiveItemDefinition(input: {
  itemId: string;
  displayName: string;
}) {
  return {
    ...harthmereBibleRewardItemDefinition(input.itemId),
    displayName: input.displayName,
    description: "Evidence gathered for a Harthmere quest.",
    maxStackSize: 1,
  };
}

function rewardInstructionsForQuest(
  quest: BibleQuestDef,
  rewardGrantId: string
): HarthmereBibleQuestRewardInstructions {
  return {
    questId: quest.id,
    rewardGrantId,
    // "silver" is the player-facing name of the live-mode gold wallet.
    xpDelta: Math.max(0, Math.trunc(quest.rewards.xp) || 0),
    goldDelta: Math.max(0, Math.trunc(quest.rewards.silver) || 0),
    items: quest.rewards.items.map((itemId) => ({
      itemId,
      count: 1,
      displayName: harthmereBibleRewardItemDisplayName(itemId),
    })),
    titles: [...quest.rewards.titles],
    // Permanent buffs have no dedicated ECS component in the current game
    // model. Persist them in the same residual flag ledger as story unlocks so
    // they are durable, queryable, and never silently dropped at turn-in.
    unlockFlags: [
      ...new Set([...quest.rewards.unlocks, ...quest.rewards.permanentBuffs]),
    ],
    reputation: { ...quest.rewards.reputation },
    previewText: quest.rewards.previewText,
  };
}

function thaedrynRewardSymbol(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rewardInstructionsForThaedrynPath(input: {
  pathId: HarthmereThaedrynPath;
  rewards: any;
  previewText: string;
}): HarthmereBibleQuestRewardInstructions {
  const rewards = input.rewards ?? {};
  return {
    questId: BIBLE_DRAGON_QUEST_ID,
    rewardGrantId: `reward:${BIBLE_DRAGON_QUEST_ID}:path:${input.pathId}`,
    xpDelta: Math.max(0, Math.trunc(Number(rewards.xp ?? 0) || 0)),
    goldDelta: Math.max(0, Math.trunc(Number(rewards.silver ?? 0) || 0)),
    items: (Array.isArray(rewards.items) ? rewards.items : [])
      .filter((item: unknown): item is string => typeof item === "string")
      .map((displayName: string) => ({
        itemId: thaedrynRewardSymbol(displayName),
        count: 1,
        displayName,
      })),
    titles: (Array.isArray(rewards.titles) ? rewards.titles : []).filter(
      (title: unknown): title is string => typeof title === "string"
    ),
    unlockFlags: (Array.isArray(rewards.unlocks) ? rewards.unlocks : [])
      .filter((unlock: unknown): unlock is string => typeof unlock === "string")
      .map(thaedrynRewardSymbol),
    reputation: {},
    previewText: input.previewText,
  };
}

// ---------------------------------------------------------------------------
// The reducer.
// ---------------------------------------------------------------------------

/** The backend's view of native progress for the quest being operated on. */
export interface HarthmereBibleNativeSnapshot {
  inProgress: boolean;
  completed: boolean;
  /** Authored step ids already present in TriggerState for this challenge. */
  firedStepIds: string[];
}

/**
 * Derive a native snapshot from the journal mirror the backend already keeps.
 *
 * WHY THIS IS NOT A SECOND PROGRESS RECORD
 * ----------------------------------------
 * The live-mode reducer is a pure function over the Redis state blob; it has
 * no worldApi and therefore cannot read `Challenges`/`TriggerState` directly.
 * It does not need to. Bible steps are strictly ordered, so the ONE cursor the
 * mirror already carries for the journal and map UI — the current step id —
 * determines the whole fired set: everything before it has fired, everything
 * from it on has not.
 *
 * So this reconstructs, it does not duplicate. Nothing new is stored.
 *
 * AND IT IS NOT THE AUTHORITY. This snapshot exists so the reducer can order
 * objectives and produce useful rejections. The real gate is downstream and
 * unchanged: `harthmere_quest_progress.ts` re-validates the signature, that
 * the challenge is genuinely in `in_progress`, and that the step genuinely
 * exists in the biscuit's trigger tree, against authoritative ECS. A client
 * that lies to this function still cannot advance anything.
 */
export function harthmereBibleNativeSnapshotFromMirror(input: {
  questId: string;
  /** `quests.active[questId].stepId` — the current objective cursor. */
  activeStepId?: string;
  /** `quests.active[questId].progress` — 1 means every authored step fired. */
  activeProgress?: number;
  /** Present in `quests.completed`. */
  completed: boolean;
  /** Present in `quests.active`. */
  active: boolean;
}): HarthmereBibleNativeSnapshot {
  const quest = bibleQuest(input.questId);
  if (!quest) {
    return { inProgress: false, completed: input.completed, firedStepIds: [] };
  }
  if (input.completed) {
    return {
      inProgress: false,
      completed: true,
      firedStepIds: quest.steps.map((step) => step.id),
    };
  }
  if (!input.active) {
    return { inProgress: false, completed: false, firedStepIds: [] };
  }
  // The final progress instruction has no next step cursor, but the journal
  // mirror records progress=1. Without this branch, the subsequent turn-in
  // reconstructed an empty fired set and rejected every completed quest as
  // objectives_incomplete.
  if (Number(input.activeProgress) >= 1) {
    return {
      inProgress: true,
      completed: false,
      firedStepIds: quest.steps.map((step) => step.id),
    };
  }
  const cursor = input.activeStepId
    ? quest.steps.findIndex((step) => step.id === input.activeStepId)
    : 0;
  // An unknown cursor means the mirror is older than the current catalog.
  // Treat it as "nothing fired" rather than guessing: the worst case is a
  // rejected duplicate, which the advance branch already handles as success.
  const fired = cursor < 0 ? [] : quest.steps.slice(0, cursor);
  return {
    inProgress: true,
    completed: false,
    firedStepIds: fired.map((step) => step.id),
  };
}

export interface HarthmereBibleQuestReduceInput {
  slice: BibleLiveSlice;
  actorId: string;
  playerLevel: number;
  completedQuests: Record<string, number> | undefined;
  nowMs: number;
  operation: string;
  questId?: string;
  objectiveId?: string;
  actorPosition?: Vec3;
  lineOfSight?: boolean;
  choice?: string;
  combatResult?: "damage" | "kill" | "encounter_cleared";
  requestId: string;
  weatherClaim?: string;
  /** Native progress for `questId`. Required for advance/complete/abandon. */
  native?: HarthmereBibleNativeSnapshot;
  bossEventType?: string;
  bossEventAmount?: number;
  bossEventPath?: string;
  bossMode?: "solo_story" | "group";
}

export interface HarthmereBibleQuestReduceResult {
  ok: boolean;
  warnings: string[];
  slice: BibleLiveSlice;
  rewards?: HarthmereBibleQuestRewardInstructions;
  /**
   * Server-created proof for authored collect/gather/recover steps.
   *
   * The Chapter 1 migration removed the parallel Redis progress machine, but
   * these physical quest items still belong in inventory. Keeping the grant
   * on the reducer instruction lets the backend write both its live mirror and
   * native ECS inventory from the same server-validated step submission.
   */
  /**
   * Native instructions the backend carries out. `nativeProgress` goes through
   * the SIGNED `harthmereQuestProgress` path; this module never writes
   * Challenges or TriggerState itself.
   */
  nativeProgress?: { challengeId: number; stepId: number };
  /**
   * Server-created proof item for an objective whose authored label describes
   * collecting something.
   *
   * The Chapter 1 migration removed the parallel Redis progress machine, but
   * these physical quest items still belong in inventory. Keeping the grant on
   * the reducer instruction lets the backend write both its live mirror and
   * native ECS inventory from the same server-validated step submission — the
   * module itself never touches inventory. Without it, "Collect six Bellbinder
   * regalia" completes with an empty bag and the fiction and the simulation
   * disagree.
   */
  objectiveItemGrant?: BibleObjectiveItemGrant;
  nativeStart?: { challengeId: number };
  nativeAbandon?: { challengeId: number };
  activeMirror?: {
    questId: string;
    remove?: boolean;
    entry?: {
      stepId?: string;
      progress: number;
      source: string;
      title?: string;
      questKind?: string;
      giverName?: string;
      giverPosition?: Vec3;
    };
  };
  completedMirrorQuestId?: string;
  thaedrynSnapshot?: "seed" | "sync" | "remove";
}

function cloneSlice(slice: BibleLiveSlice): BibleLiveSlice {
  return JSON.parse(JSON.stringify(slice)) as BibleLiveSlice;
}

function bibleStepCollectsItem(step: BibleQuestDef["steps"][number]) {
  return /^(collect|gather|recover|retrieve|obtain|take|pick up)\b/i.test(
    step.label
  );
}

function bibleStepObjectiveItemCount(step: BibleQuestDef["steps"][number]) {
  const label = step.label.toLowerCase();
  const numeric = label.match(/\b(\d+)\b/)?.[1];
  if (numeric) return Math.max(1, Math.trunc(Number(numeric)));
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  for (const [word, count] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(label)) return count;
  }
  return Math.max(1, Math.trunc(Number(step.count) || 1));
}

function bibleStepObjectiveItem(
  quest: BibleQuestDef,
  step: BibleQuestDef["steps"][number]
) {
  return {
    itemId: `quest_objective_item:${quest.id}:${step.id}`,
    count: bibleStepObjectiveItemCount(step),
    displayName: (step.targetName || step.label || "Quest Item")
      .replace(/^(collect|gather|recover|retrieve|obtain|take|pick up)\s+/i, "")
      .trim(),
  };
}

function activeMirrorEntry(
  quest: BibleQuestDef,
  stepId: string | undefined,
  progress: number
) {
  return {
    questId: quest.id,
    entry: {
      stepId,
      progress,
      source: HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE,
      title: quest.title,
      questKind: quest.category,
      giverName: quest.giverName,
      // Grounded. Never the authored Y.
      giverPosition: stepId
        ? bibleStepWorldWaypoint(
            quest,
            quest.steps.find((step) => step.id === stepId) ?? quest.steps[0]
          )
        : bibleQuestWorldWaypoint(quest),
    },
  };
}

export function reduceHarthmereBibleQuestOperation(
  input: HarthmereBibleQuestReduceInput
): HarthmereBibleQuestReduceResult {
  const warnings: string[] = [];
  const slice = cloneSlice(input.slice);
  const context = buildHarthmereBibleQuestContext({
    actorId: input.actorId,
    playerLevel: input.playerLevel,
    completedQuests: input.completedQuests,
    slice,
    nowMs: input.nowMs,
    weatherClaim: input.weatherClaim,
  });
  const fail = (...reasons: string[]): HarthmereBibleQuestReduceResult => ({
    ok: false,
    warnings: [...warnings, ...reasons.map((r) => `bible_quest_rejected:${r}`)],
    slice: input.slice, // rejected ops leave the slice untouched
  });
  const native = input.native ?? {
    inProgress: false,
    completed: false,
    firedStepIds: [],
  };
  const firedStepIds = new Set(native.firedStepIds);

  switch (input.operation) {
    case "bible_quest_read":
      return { ok: true, warnings, slice };

    case "bible_quest_accept": {
      if (!input.questId) return fail("quest_required");
      const quest = bibleQuest(input.questId);
      if (!quest) return fail("missing_quest");
      // Starter twins are owned by the always-on client quest list. Offering
      // the bible copy too would double-list them, and completing one copy
      // would not complete the other.
      if (quest.category === "starter") {
        return fail("starter_quests_use_client_twins");
      }
      if (native.inProgress) return fail("already_in_progress");
      const gate = bibleQuestGate(quest, context);
      if (!gate.ok) {
        return fail(...gate.failures.map((failure) => failure.reason));
      }
      const challengeId = bibleNativeQuestId(quest.id);
      if (challengeId === undefined) return fail("missing_native_challenge");

      let thaedrynSnapshot: HarthmereBibleQuestReduceResult["thaedrynSnapshot"];
      if (quest.id === BIBLE_DRAGON_QUEST_ID) {
        slice.thaedryn = createThaedrynBossState(input.bossMode ?? "group");
        thaedrynSnapshot = "seed";
      }
      return {
        ok: true,
        warnings,
        slice,
        nativeStart: { challengeId: Number(challengeId) },
        thaedrynSnapshot,
        activeMirror: activeMirrorEntry(quest, quest.steps[0]?.id, 0),
      };
    }

    case "bible_quest_advance": {
      if (!input.questId || !input.objectiveId) return fail("quest_required");
      const quest = bibleQuest(input.questId);
      const step = quest?.steps.find((row) => row.id === input.objectiveId);
      const validation = validateBibleStepSubmission({
        quest,
        step,
        native: { inProgress: native.inProgress, firedStepIds },
        submission: {
          actorPosition: input.actorPosition,
          lineOfSight: input.lineOfSight,
          revalidatedChoice: input.choice,
          combatResult: input.combatResult,
        },
      });
      if (!validation.ok) {
        // A duplicate submission is expected, not exceptional: /sync
        // reconnects cancel in-flight publishes and clients legitimately
        // retry. Report success with no instruction rather than a rejection
        // the HUD would surface as an error.
        if (validation.rejections.includes("duplicate_submission")) {
          return { ok: true, warnings, slice };
        }
        return fail(...validation.rejections);
      }
      if (!quest || !step) return fail("missing_step");

      const challengeId = bibleNativeQuestId(quest.id);
      const stepId = bibleNativeStepId(quest.id, step.id);
      if (challengeId === undefined || stepId === undefined) {
        return fail("missing_native_step");
      }
      if (input.choice) slice.choices[quest.id] = input.choice;

      const nextFired = new Set(firedStepIds).add(step.id);
      const nextStep = bibleCurrentStep(quest, nextFired);
      return {
        ok: true,
        warnings,
        slice,
        nativeProgress: {
          challengeId: Number(challengeId),
          stepId: Number(stepId),
        },
        objectiveItemGrant: bibleStepObjectiveItemGrant(quest, step),
        activeMirror: activeMirrorEntry(
          quest,
          nextStep?.id,
          nextFired.size / Math.max(1, quest.steps.length)
        ),
      };
    }

    case "bible_quest_complete": {
      if (!input.questId) return fail("quest_required");
      const quest = bibleQuest(input.questId);
      if (!quest) return fail("missing_quest");
      if (!bibleAllStepsFired(quest, firedStepIds)) {
        return fail("objectives_incomplete");
      }
      // Reward idempotency is structural now. Native `TriggerState.by_root`
      // records each step once and the challenge moves to `complete` exactly
      // once, so a completed challenge already means "granted". The retired
      // `grantedRewardIds` ledger is gone with the state machine.
      if (native.completed) return { ok: true, warnings, slice };

      slice.lastCompletedAtMs[quest.id] = context.nowMs;
      for (const flag of [
        ...quest.rewards.unlocks,
        ...quest.rewards.permanentBuffs,
      ]) {
        if (!slice.flags.includes(flag)) slice.flags.push(flag);
      }
      for (const title of quest.rewards.titles) {
        if (!slice.titles.includes(title)) slice.titles.push(title);
      }
      for (const [faction, delta] of Object.entries(quest.rewards.reputation)) {
        slice.reputation[faction] = (slice.reputation[faction] ?? 0) + delta;
      }
      return {
        ok: true,
        warnings,
        slice,
        rewards: rewardInstructionsForQuest(
          quest,
          `${quest.id}:complete:${input.requestId}`
        ),
        activeMirror: { questId: quest.id, remove: true },
        completedMirrorQuestId: quest.id,
        thaedrynSnapshot:
          quest.id === BIBLE_DRAGON_QUEST_ID ? "remove" : undefined,
      };
    }

    case "bible_quest_abandon": {
      if (!input.questId) return fail("quest_required");
      const quest = bibleQuest(input.questId);
      if (!quest) return fail("missing_quest");
      if (!native.inProgress) return fail("quest_not_in_progress");
      const challengeId = bibleNativeQuestId(quest.id);
      if (challengeId === undefined) return fail("missing_native_challenge");
      delete slice.choices[quest.id];
      if (quest.id === BIBLE_DRAGON_QUEST_ID) delete slice.thaedryn;
      return {
        ok: true,
        warnings,
        slice,
        nativeAbandon: { challengeId: Number(challengeId) },
        activeMirror: { questId: quest.id, remove: true },
        thaedrynSnapshot:
          quest.id === BIBLE_DRAGON_QUEST_ID ? "remove" : undefined,
      };
    }

    case "bible_quest_boss_event":
      return reduceThaedrynBossEvent(input, slice, native, warnings);

    default:
      return fail("unknown_operation");
  }
}

// ---------------------------------------------------------------------------
// Party progress.
//
// `quest_runtime.ts` carried `advanceHarthmereQuestObjectiveParty`,
// `completeHarthmereQuestParty` and `failHarthmereQuestParty`. Those had NO
// production caller — only their own test — so deleting the module would have
// dropped the capability silently. It is ported rather than lost, because in
// the native model it is nearly free: a party advance is the same objective
// published once per eligible member.
//
// Eligibility is per member and is NOT assumed: a member who is out of range,
// or whose own native state says the step already fired, is skipped rather
// than credited. That is what stops one player in the arena from completing an
// objective for a party sitting in town.
// ---------------------------------------------------------------------------

export interface HarthmereBibleQuestPartyMember {
  actorId: string;
  native: HarthmereBibleNativeSnapshot;
  actorPosition?: Vec3;
  lineOfSight?: boolean;
}

export interface HarthmereBibleQuestPartyProgressResult {
  /** One signed publish per credited member. */
  publishes: Array<{
    actorId: string;
    challengeId: number;
    stepId: number;
  }>;
  /** Members who were not credited, with the reason. */
  skipped: Array<{ actorId: string; reasons: string[] }>;
}

export function harthmereBibleQuestPartyProgress(input: {
  questId: string;
  objectiveId: string;
  members: readonly HarthmereBibleQuestPartyMember[];
  choice?: string;
  combatResult?: "damage" | "kill" | "encounter_cleared";
}): HarthmereBibleQuestPartyProgressResult {
  const quest = bibleQuest(input.questId);
  const step = quest?.steps.find((row) => row.id === input.objectiveId);
  const challengeId = quest ? bibleNativeQuestId(quest.id) : undefined;
  const stepId =
    quest && step ? bibleNativeStepId(quest.id, step.id) : undefined;
  const publishes: HarthmereBibleQuestPartyProgressResult["publishes"] = [];
  const skipped: HarthmereBibleQuestPartyProgressResult["skipped"] = [];

  if (!quest || !step || challengeId === undefined || stepId === undefined) {
    return {
      publishes,
      skipped: input.members.map((member) => ({
        actorId: member.actorId,
        reasons: ["missing_step"],
      })),
    };
  }

  for (const member of input.members) {
    const validation = validateBibleStepSubmission({
      quest,
      step,
      native: {
        inProgress: member.native.inProgress,
        firedStepIds: new Set(member.native.firedStepIds),
      },
      submission: {
        actorPosition: member.actorPosition,
        lineOfSight: member.lineOfSight,
        revalidatedChoice: input.choice,
        combatResult: input.combatResult,
      },
    });
    if (validation.ok) {
      publishes.push({
        actorId: member.actorId,
        challengeId: Number(challengeId),
        stepId: Number(stepId),
      });
    } else {
      skipped.push({
        actorId: member.actorId,
        reasons: [...validation.rejections],
      });
    }
  }
  return { publishes, skipped };
}

// ---------------------------------------------------------------------------
// Thaedryn encounter.
//
// The boss is BOTH a combat entity snapshot (so the proven native attack path
// hits it and the HUD shows a health bar) and a phase machine. Phase state is
// per-player against a SHARED entity, so it stays in the residual slice:
// writing it to the entity would leak one player's encounter into everyone's.
// ---------------------------------------------------------------------------

export const HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES = [
  "damage",
  "break_chain",
  "attack_after_third_chain",
  "rebind_ring_cycle",
  "party_wipe",
  "choose_path",
  "resolve",
] as const;

function reduceThaedrynBossEvent(
  input: HarthmereBibleQuestReduceInput,
  slice: BibleLiveSlice,
  native: HarthmereBibleNativeSnapshot,
  warnings: string[]
): HarthmereBibleQuestReduceResult {
  const fail = (...reasons: string[]): HarthmereBibleQuestReduceResult => ({
    ok: false,
    warnings: [...warnings, ...reasons.map((r) => `thaedryn_rejected:${r}`)],
    slice: input.slice,
  });
  // Q12 in-progress now comes from native Challenges, not a runtime record.
  if (!native.inProgress) return fail("q12_not_active");
  if (!slice.thaedryn) {
    // Defensive re-arm: a state blob written before a deploy could hold an
    // active Q12 with no machine. Never soft-lock; re-create it.
    slice.thaedryn = createThaedrynBossState(input.bossMode ?? "group");
  }
  const eventType = input.bossEventType ?? "";
  if (
    !HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES.includes(
      eventType as (typeof HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES)[number]
    )
  ) {
    return fail("unknown_boss_event");
  }

  const state = slice.thaedryn;
  if (eventType !== "resolve") {
    slice.thaedryn = applyThaedrynBossEvent(state, {
      type: eventType,
      amount: input.bossEventAmount,
      path: input.bossEventPath as HarthmereThaedrynPath | undefined,
    });
    return { ok: true, warnings, slice, thaedrynSnapshot: "sync" };
  }

  // The persisted completed machine is the idempotency record for path
  // rewards. A retried resolve may still arrive while the native challenge is
  // in progress, but it must not grant the path payout twice.
  if (state.completed) {
    const quest = bibleQuest(BIBLE_DRAGON_QUEST_ID);
    return {
      ok: true,
      warnings,
      slice,
      thaedrynSnapshot: "sync",
      activeMirror: quest ? activeMirrorEntry(quest, undefined, 1) : undefined,
    };
  }

  // The path is chosen by an earlier `choose_path` event and lives on the
  // state. Apply a late path claim first so a client that sends choose_path
  // and resolve in one breath still resolves.
  const resolving =
    input.bossEventPath && state.chosenPath !== input.bossEventPath
      ? applyThaedrynBossEvent(state, {
          type: "choose_path",
          path: input.bossEventPath as HarthmereThaedrynPath,
        })
      : state;
  // `completeThaedrynBoss` resolves the path internally and returns the NEW
  // state alongside the outcome — it is not the state itself. Taking its
  // return value wholesale would write `{ok, state, telemetry, ...}` into the
  // slice and silently destroy the machine on the next save/load.
  const completion = completeThaedrynBoss(resolving);
  if (!completion.ok) {
    return fail(...(completion.reasons ?? ["cannot_resolve"]));
  }
  slice.thaedryn = completion.state;
  slice.townPhase = completion.townPhase;
  const pathId = (completion.path?.id ?? resolving.chosenPath) as
    | HarthmereThaedrynPath
    | undefined;
  if (!pathId) {
    return fail("missing_path_choice");
  }
  slice.choices[BIBLE_DRAGON_QUEST_ID] = pathId;
  const pathRewards = rewardInstructionsForThaedrynPath({
    pathId,
    rewards: completion.rewards,
    previewText: completion.path?.cinematic ?? "",
  });
  for (const title of pathRewards.titles) {
    if (!slice.titles.includes(title)) slice.titles.push(title);
  }
  for (const flag of pathRewards.unlockFlags) {
    if (!slice.flags.includes(flag)) slice.flags.push(flag);
  }

  // Resolving the encounter advances Q12's remaining objectives. Each still
  // goes through the signed native path; the backend publishes them in order.
  const quest = bibleQuest(BIBLE_DRAGON_QUEST_ID);
  const challengeId = quest ? bibleNativeQuestId(quest.id) : undefined;
  const fired = new Set(native.firedStepIds);
  const nextStep = quest ? bibleCurrentStep(quest, fired) : undefined;
  const stepId =
    quest && nextStep ? bibleNativeStepId(quest.id, nextStep.id) : undefined;

  return {
    ok: true,
    warnings,
    slice,
    rewards: pathRewards,
    thaedrynSnapshot: "sync",
    nativeProgress:
      challengeId !== undefined && stepId !== undefined
        ? { challengeId: Number(challengeId), stepId: Number(stepId) }
        : undefined,
    // The backend publishes every remaining Q12 leaf through the signed
    // progress path as one ordered resolution batch. Move the journal cursor
    // to its final state in the same mutation so the subsequent reward turn-in
    // reconstructs all steps as fired instead of rejecting with
    // `objectives_incomplete`.
    activeMirror: quest ? activeMirrorEntry(quest, undefined, 1) : undefined,
  };
}

export const HARTHMERE_THAEDRYN_MAX_HP = 4000;
export const HARTHMERE_THAEDRYN_LEVEL = 30;

export function harthmereThaedrynCombatSnapshot(
  state: HarthmereThaedrynBossState | undefined,
  nowMs: number
) {
  const anchor = bibleThaedrynArenaWorldAnchor();
  const healthPct = Math.max(0, Math.min(100, state?.healthPct ?? 100));
  const hp = Math.round((healthPct / 100) * HARTHMERE_THAEDRYN_MAX_HP);
  const phase = state ? getThaedrynPhaseForState(state) : undefined;
  const resolved = state?.completed === true;
  return {
    hp,
    maxHp: HARTHMERE_THAEDRYN_MAX_HP,
    position: { x: anchor[0], y: anchor[1], z: anchor[2] },
    homePosition: { x: anchor[0], y: anchor[1], z: anchor[2] },
    // The Sleeper does not hunt the town: hostile only once engaged, and
    // leashed hard to the arena so the fight cannot be dragged into streets.
    isHostile: false,
    isAlive: !resolved && hp > 0,
    isAttackable: !resolved,
    isLivestock: false,
    species: "dragon",
    level: HARTHMERE_THAEDRYN_LEVEL,
    // "monster" is the closest member of HarthmereLiveEntityKind (there is no
    // dedicated boss kind); the render family and label carry the dragon
    // flavour, and `bossQuestId` marks it as the Q12 encounter entity.
    entityKind: "monster",
    movementSpeed: 0, // bound by the bell chains — the dragon does not chase
    bodyRadius: 4.5,
    patrolRadius: 0,
    aggroRange: 10,
    leashRange: 24,
    requiresLineOfSight: true,
    aiEnabled: true,
    retaliatesWhenAttacked: true,
    animationState: "idle",
    animationStartedAtMs: nowMs,
    animationMoving: false,
    facingYaw: Math.PI, // faces the threshold wall / approaching players
    attackRange: 8,
    attackDamage: 14,
    killXp: 0, // XP comes from the path resolution, not a generic kill grant
    displayName: "Thaedryn the Bellbound",
    bossPhaseId: phase?.id,
    bossQuestId: BIBLE_DRAGON_QUEST_ID,
  };
}

export function harthmereThaedrynDamageEventsForAttack(
  state: HarthmereThaedrynBossState,
  damage: number
): Array<{ type: string; amount?: number }> {
  const pct = Math.max(0, (damage / HARTHMERE_THAEDRYN_MAX_HP) * 100);
  const events: Array<{ type: string; amount?: number }> = [
    { type: "damage", amount: pct },
  ];
  if (state.chainsRemaining <= 1) {
    events.push({ type: "attack_after_third_chain" });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Reachability contract.
//
// The authored catalog gave THREE different Wyrm's Bed locations and no test
// caught it, because each was only ever checked against its own file. Kept
// pure so both mocha tests and the plain-node audit scripts can call it.
// ---------------------------------------------------------------------------

export interface HarthmereDragonQuestReachabilityReport {
  ok: boolean;
  failures: string[];
  arenaWorldAnchor: Vec3;
  mainChainQuestIds: string[];
}

export function validateHarthmereDragonQuestReachability(): HarthmereDragonQuestReachabilityReport {
  const failures: string[] = [];
  const anchor = bibleThaedrynArenaWorldAnchor();
  if (anchor[1] === 0) {
    failures.push("arena anchor has no feet height — the encounter soft-locks");
  }

  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor = bibleQuest(BIBLE_DRAGON_QUEST_ID);
  if (!cursor) {
    failures.push(`${BIBLE_DRAGON_QUEST_ID} is not in the catalog`);
  }
  while (cursor && cursor.start.kind === "after") {
    if (seen.has(cursor.id)) {
      failures.push(`prerequisite cycle at ${cursor.id}`);
      break;
    }
    seen.add(cursor.id);
    chain.unshift(cursor.id);
    const next = bibleQuest(cursor.start.questId);
    if (!next) {
      failures.push(`${cursor.id}: broken chain at ${cursor.start.questId}`);
      break;
    }
    cursor = next;
  }
  if (cursor && !seen.has(cursor.id)) chain.unshift(cursor.id);

  // Every Q12 objective must validate against the ONE canonical anchor.
  for (const stepId of Object.values(BIBLE_Q12_OBJECTIVE_IDS)) {
    if (!bibleThaedrynWaypointOverride(BIBLE_DRAGON_QUEST_ID, stepId)) {
      failures.push(`${stepId}: no arena waypoint override`);
    }
  }
  const q12 = bibleQuest(BIBLE_DRAGON_QUEST_ID);
  for (const step of q12?.steps ?? []) {
    if (bibleStepWorldWaypoint(q12!, step)[1] === 0) {
      failures.push(`${step.id}: ungrounded waypoint`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    arenaWorldAnchor: anchor,
    mainChainQuestIds: chain,
  };
}
