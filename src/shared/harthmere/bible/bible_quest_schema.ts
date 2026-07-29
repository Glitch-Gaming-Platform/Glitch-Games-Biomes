// BIBLE_QUEST_SCHEMA
//
// Types for the Bellbound Dragon quest catalog, restructured to match the
// Chapter 1 shape (see docs/harthmere/BIBLE_TO_CH1_MIGRATION.md).
//
// This module is DATA-FREE and DEPENDENCY-FREE by design: it imports only
// `type`-position symbols, so it erases completely at compile time and can be
// loaded by `.mocharc.fast.json` with no server or Bikkie bootstrap. Nothing
// under `src/shared/harthmere/bible/` may import Bikkie item data, the ECS gen
// layer, a server handler, the trigger engine, or a renderer asset;
// `bible_engine_contracts.ts` asserts that over the real import graph.
//
// Deliberate differences from the retired `HARTHMERE_QUEST_CATALOG_JSON`:
//
//   * `objectives` -> `steps`, so Bible and Chapter 1 share one vocabulary.
//   * `activeRules` is split into `start` (what native ECS expresses as an
//     unlock trigger) and `gate` (the soft conditions it cannot).
//   * `activationTestCases`, `testContract.useCases`, `testContract.edgeCases`
//     and `activeDuringStates` are NOT retained. They were prose restatements
//     of assertions; the migration turns each into a real test. Dropping them
//     removes roughly a third of the catalog's shipped bytes.
//   * `location.waypoint` -> `authoredWaypoint`, which runtime code must never
//     read directly. 312 of 340 authored waypoints carry Y=0; only
//     `bible_waypoints.ts` may resolve them (see GAIA RULE 2).

import type { Vec3 } from "@/shared/math/types";

export const BIBLE_QUEST_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Closed unions.
//
// Every union below is closed on purpose. A new category, step type, failure
// case or gate reason must be added here first, which turns "unhandled new
// value" from a silent runtime fallthrough into a compile error at every
// switch site.
// ---------------------------------------------------------------------------

export type BibleQuestCategory =
  | "main"
  | "side"
  | "side_hidden"
  | "starter"
  | "repeatable";

/** Module owner. Used to slice tests so a main-arc run parses 13 of 85 rows. */
export type BibleQuestArc = "main" | "side" | "starter" | "repeatable";

export type BibleQuestRepeatability = "once" | "daily" | "weekly";

export type BibleStepType = "talk" | "inspect" | "choice" | "combat";

export type BibleTimeOfDay = "dawn" | "day" | "dusk" | "night";

export type BibleWeather = "clear" | "rain" | "storm" | "fog" | "snow";

/**
 * Authored rejection reasons for a single objective submission.
 *
 * These are REJECTED SUBMISSIONS, not quest failures. No authored quest can
 * enter a `failed` state (see migration doc section 9.3), which is why the
 * seven-state `quest_runtime` machine collapses to native `Challenges` plus a
 * gate.
 */
export type BibleStepFailure =
  | "player_too_far"
  | "wrong_phase"
  | "duplicate_submission";

// ---------------------------------------------------------------------------
// Start / unlock.
//
// Projects onto exactly one native `unlock` trigger per kind. See
// `bible_native_quests.ts`.
// ---------------------------------------------------------------------------

export type BibleQuestStart =
  /** An NPC offers it immediately. No prerequisite; unlock is `undefined`. */
  | { readonly kind: "giver"; readonly giverId: string }
  /**
   * Gated on exactly one completed quest.
   *
   * `giverId` and the prerequisite are ORTHOGONAL, which the retired
   * `activeRules` shape obscured. 9 of the 13 gated quests still have an NPC
   * who offers them once unlocked (Q2–Q7, Q11, Q2.5, SQ-006); the other 4
   * (Q8, Q9, Q10, Q12) auto-start with no giver. Omitting `giverId` is what
   * makes a quest auto-start, and it is the only difference between the two.
   */
  | {
      readonly kind: "after";
      readonly questId: string;
      readonly giverId?: string;
    }
  /**
   * Giver-less, hidden. Projects to a CIRCULAR `challengeUnlocked` self-gate.
   *
   * That is not a hack. Without it the global native challenge runner starts
   * any quest whose unlock is satisfied the moment the player logs in, so a
   * hidden quest with no prerequisite would begin unprompted. A trigger that
   * only a server-owned `challengeUnlocked` publish naming this quest can
   * satisfy means: nothing but an explicit discovery starts this.
   */
  | { readonly kind: "world_trigger"; readonly discoveryId: string };

// ---------------------------------------------------------------------------
// Gate: the conditions native `Challenges` cannot express.
// ---------------------------------------------------------------------------

export interface BibleQuestGateRules {
  readonly levelBand: { readonly min: number; readonly max: number };
  /** Empty means "any". Stored narrow so the gate never allocates. */
  readonly timeOfDay: readonly BibleTimeOfDay[];
  /** Integer hours 0..23. The gate floors a fractional game clock. */
  readonly activeHours: readonly number[];
  readonly weather: readonly BibleWeather[];
  /**
   * Story flags earned from other quests' `rewards.unlocks`.
   * Zero quests use this today; the field is retained because the gate
   * implements it and a future quest may need it without a schema change.
   */
  readonly requiredFlags: readonly string[];
}

// ---------------------------------------------------------------------------
// Steps.
// ---------------------------------------------------------------------------

export interface BibleStepValidation {
  /** Always true in authored data; retained so a client-trusted step is loud. */
  readonly serverAuthority: boolean;
  readonly requiresLineOfSight: boolean;
  readonly maxDistance: number;
  readonly idempotent: boolean;
  readonly requiresChoiceRevalidation?: boolean;
  readonly requiresCombatValidation?: boolean;
}

export interface BibleQuestStep {
  readonly id: string;
  readonly label: string;
  readonly type: BibleStepType;
  readonly targetId: string;
  readonly targetName: string;
  readonly district: string;
  /**
   * AUTHORED space, Y frequently 0. Never ship this. Resolve through
   * `bibleGroundedWorldWaypoint` / `bibleStepWorldWaypoint`.
   */
  readonly authoredWaypoint: Vec3;
  readonly count: number;
  readonly validation: BibleStepValidation;
  readonly failureCases: readonly BibleStepFailure[];
}

// ---------------------------------------------------------------------------
// Choices and rewards.
// ---------------------------------------------------------------------------

export interface BibleQuestChoice {
  readonly id: string;
  readonly label: string;
  readonly consequence: string;
}

export interface BibleQuestRewards {
  readonly xp: number;
  readonly silver: number;
  readonly items: readonly string[];
  readonly titles: readonly string[];
  /** Faction -> delta. Has no ECS component; lives in the residual slice. */
  readonly reputation: Readonly<Record<string, number>>;
  /** Story flags this quest grants on completion. Feeds `gate.requiredFlags`. */
  readonly unlocks: readonly string[];
  readonly permanentBuffs: readonly string[];
  /** True when the grant is computed at completion rather than fixed. */
  readonly variable: boolean;
  readonly previewText: string;
}

export interface BibleQuestDialogue {
  readonly offer: string;
  readonly active: string;
  readonly ready: string;
  readonly complete: string;
  /**
   * Retained written content. Currently UNREACHABLE: no authored quest can
   * fail (migration doc section 9.3). `bible_engine_contracts.ts` asserts that
   * stays true so this does not rot into a silently dead branch.
   */
  readonly fail: string;
}

// ---------------------------------------------------------------------------
// The quest.
// ---------------------------------------------------------------------------

export interface BibleQuestDef {
  readonly id: string;
  /** "Q1", "SQ-014", or "" for starters and repeatables. */
  readonly code: string;
  readonly title: string;
  readonly category: BibleQuestCategory;
  readonly arc: BibleQuestArc;
  readonly giverName?: string;
  readonly hidden: boolean;
  readonly district: string;
  /** AUTHORED space. Same rule as `BibleQuestStep.authoredWaypoint`. */
  readonly authoredWaypoint: Vec3;
  readonly estimatedMinutes: number;
  readonly contentType: string;
  readonly repeatability: BibleQuestRepeatability;
  readonly phase: string;
  readonly premise: string;
  /** Traceability link into the source bibles; the audit script consumes it. */
  readonly bibleRef: string;
  readonly bellTie: boolean;
  readonly start: BibleQuestStart;
  readonly gate: BibleQuestGateRules;
  readonly steps: readonly BibleQuestStep[];
  readonly choices?: readonly BibleQuestChoice[];
  readonly rewards: BibleQuestRewards;
  readonly dialogue: BibleQuestDialogue;
  /** Writer-facing. Never shipped to a player surface. */
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// Narrow accessors. These exist so call sites never touch `authoredWaypoint`
// or reach for `any`.
// ---------------------------------------------------------------------------

/**
 * The NPC who owns this quest's dialogue surface, if any.
 *
 * Present for `giver`, optional for `after`, never for `world_trigger`.
 * Callers must use this rather than testing `start.kind === "giver"`, which
 * would silently orphan the 9 gated-but-offered quests.
 */
export function bibleQuestGiverId(quest: BibleQuestDef): string | undefined {
  switch (quest.start.kind) {
    case "giver":
      return quest.start.giverId;
    case "after":
      return quest.start.giverId;
    case "world_trigger":
      return undefined;
  }
}

/** True when the quest begins on its own once unlocked, with no NPC offer. */
export function bibleQuestAutoStarts(quest: BibleQuestDef): boolean {
  return quest.start.kind === "after" && quest.start.giverId === undefined;
}

export function bibleQuestPrerequisiteId(
  quest: BibleQuestDef
): string | undefined {
  return quest.start.kind === "after" ? quest.start.questId : undefined;
}

export function bibleQuestIsDiscoverable(quest: BibleQuestDef): boolean {
  return quest.start.kind === "world_trigger";
}

export function bibleQuestStepById(
  quest: BibleQuestDef,
  stepId: string
): BibleQuestStep | undefined {
  return quest.steps.find((step) => step.id === stepId);
}
