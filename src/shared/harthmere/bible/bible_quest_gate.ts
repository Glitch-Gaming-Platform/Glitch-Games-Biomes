// BIBLE_QUEST_GATE
//
// The pure replacement for `quest_runtime.ts`'s seven-state machine.
//
// Native `Challenges` already carries quest state:
//   locked            -> not in `available`, unlock trigger unsatisfied
//   available         -> in `challenges.available`
//   active            -> in `challenges.in_progress`
//   ready_to_complete -> every step id present in `trigger_state.by_root[id]`
//   completed         -> in `challenges.complete`
//   abandoned         -> removed from `in_progress` (native abandon)
//   failed            -> NOT MODELLED; no authored quest can enter it (see
//                        migration doc section 9.3, enforced by contracts)
//
// What native `Challenges` cannot express is the set of soft conditions that
// must be re-evaluated on every offer: level band, time of day, active hours,
// weather, story flags, and repeatable cadence. Those are this file, and this
// file is a pure function of an explicitly-passed context — no clock, no
// Redis, no ECS — so every branch is unit-testable without fakes.
//
// Three callers only: NPC dialogue offer building, the accept route, and the
// world-trigger discovery bridge.

import type {
  BibleQuestDef,
  BibleTimeOfDay,
  BibleWeather,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_QUEST_GATE_VERSION = 1 as const;

/**
 * Closed union. A new reason is a compile error at every call site rather than
 * an unhandled string, which is how `wrong_hour` previously reached the client
 * as an untranslated token.
 */
export type BibleGateReason =
  | "unknown_quest"
  | "player_level_below_minimum"
  | "player_far_above_soft_maximum"
  | "missing_prerequisite"
  | "missing_flag"
  | "wrong_time_of_day"
  | "wrong_hour"
  | "wrong_weather"
  | "already_completed_once"
  | "cadence_cooldown";

export interface BibleGateFailure {
  readonly reason: BibleGateReason;
  /** The prerequisite quest id or flag name, when the reason names one. */
  readonly detail?: string;
}

export interface BibleGateResult {
  readonly ok: boolean;
  readonly failures: readonly BibleGateFailure[];
}

export interface BibleGateContext {
  readonly playerLevel: number;
  /** Game clock hour. May be fractional; the gate floors it. */
  readonly hour: number;
  readonly timeOfDay: BibleTimeOfDay;
  readonly weather: BibleWeather;
  /** Already folded through `bibleCompletedQuestIds` (starter twins included). */
  readonly completedQuestIds: ReadonlySet<string>;
  readonly flags: ReadonlySet<string>;
  /** Completion timestamps for repeatables, ms since epoch. */
  readonly lastCompletedAtMs: Readonly<Record<string, number>>;
  readonly nowMs: number;
}

// ---------------------------------------------------------------------------
// Level band.
//
// The soft maximum is `levelBand.max + 10`, preserved verbatim from the
// retired `validateHarthmereQuestActivation`. It exists so a level-40 player
// is not offered the level-5 bridge inspection, while a level-15 player who
// over-levelled slightly still can be.
// ---------------------------------------------------------------------------
const SOFT_MAXIMUM_HEADROOM = 10;

// ---------------------------------------------------------------------------
// Repeatable cadence.
//
// THIS IS A BUG FIX, NOT A REFACTOR ARTIFACT.
//
// 21 quests are authored `daily` or `weekly` and the cadence was enforced
// NOWHERE: `acceptHarthmereQuest` only blocked re-accept when repeatability
// was `once`, and `completeHarthmereQuest` deliberately keys the reward grant
// id per cycle so repeatables re-grant. A player could therefore farm any
// daily an unbounded number of times per day and collect silver, xp and
// reputation each time.
//
// Reset is calendar-boundary, not a rolling window: dailies reset at 00:00
// UTC, weeklies at 00:00 UTC Monday. Boundary resets are what the authored
// "daily"/"weekly" language means, they are trivially explainable to a player,
// and unlike a rolling 24h window they do not punish someone for playing
// slightly earlier each day. Both boundaries are constants so design can move
// them without touching the gate.
// ---------------------------------------------------------------------------
const MS_PER_DAY = 86_400_000;
/**
 * 1970-01-01 (epoch day 0) was a Thursday, so the first Monday is epoch day 4.
 * Adding 3 makes `floor((day + 3) / 7)` change exactly on Mondays:
 *   day 4  (Mon 05 Jan) -> 1      day 10 (Sun 11 Jan) -> 1   same week
 *   day 11 (Mon 12 Jan) -> 2                                 next week
 */
const WEEK_EPOCH_OFFSET_DAYS = 3;

export function bibleDailyPeriod(atMs: number): number {
  return Math.floor(atMs / MS_PER_DAY);
}

export function bibleWeeklyPeriod(atMs: number): number {
  return Math.floor((bibleDailyPeriod(atMs) + WEEK_EPOCH_OFFSET_DAYS) / 7);
}

/** True when a repeatable's cooldown has NOT yet elapsed. */
export function bibleCadenceOnCooldown(
  quest: BibleQuestDef,
  lastCompletedAtMs: number | undefined,
  nowMs: number
): boolean {
  if (lastCompletedAtMs === undefined) return false;
  switch (quest.repeatability) {
    case "once":
      return false; // handled by `already_completed_once`
    case "daily":
      return bibleDailyPeriod(lastCompletedAtMs) === bibleDailyPeriod(nowMs);
    case "weekly":
      return bibleWeeklyPeriod(lastCompletedAtMs) === bibleWeeklyPeriod(nowMs);
  }
}

// ---------------------------------------------------------------------------
// The gate.
// ---------------------------------------------------------------------------

export function bibleQuestGate(
  quest: BibleQuestDef | undefined,
  context: BibleGateContext
): BibleGateResult {
  if (!quest) {
    return { ok: false, failures: [{ reason: "unknown_quest" }] };
  }

  const failures: BibleGateFailure[] = [];
  const fail = (reason: BibleGateReason, detail?: string) =>
    failures.push(detail === undefined ? { reason } : { reason, detail });

  if (context.playerLevel < quest.gate.levelBand.min) {
    fail("player_level_below_minimum");
  }
  if (
    quest.gate.levelBand.max &&
    context.playerLevel > quest.gate.levelBand.max + SOFT_MAXIMUM_HEADROOM
  ) {
    fail("player_far_above_soft_maximum");
  }

  if (
    quest.start.kind === "after" &&
    !context.completedQuestIds.has(quest.start.questId)
  ) {
    fail("missing_prerequisite", quest.start.questId);
  }

  for (const flag of quest.gate.requiredFlags) {
    if (!context.flags.has(flag)) fail("missing_flag", flag);
  }

  // Empty means "any" (the converter collapses complete authored sets), so
  // these short-circuit for the ~76 ungated quests instead of scanning.
  if (
    quest.gate.timeOfDay.length > 0 &&
    !quest.gate.timeOfDay.includes(context.timeOfDay)
  ) {
    fail("wrong_time_of_day");
  }
  if (quest.gate.activeHours.length > 0) {
    // Floor a possibly-fractional game clock. An unfloored 12.5 matched no
    // integer hour and previously locked out every hour-gated quest.
    const hour = Math.floor(context.hour);
    if (!quest.gate.activeHours.includes(hour)) fail("wrong_hour");
  }
  if (
    quest.gate.weather.length > 0 &&
    !quest.gate.weather.includes(context.weather)
  ) {
    fail("wrong_weather");
  }

  const completed = context.completedQuestIds.has(quest.id);
  if (completed && quest.repeatability === "once") {
    fail("already_completed_once");
  }
  if (
    quest.repeatability !== "once" &&
    bibleCadenceOnCooldown(
      quest,
      context.lastCompletedAtMs[quest.id],
      context.nowMs
    )
  ) {
    fail("cadence_cooldown");
  }

  return { ok: failures.length === 0, failures };
}

export function bibleQuestGateReasons(
  result: BibleGateResult
): readonly BibleGateReason[] {
  return result.failures.map((failure) => failure.reason);
}
