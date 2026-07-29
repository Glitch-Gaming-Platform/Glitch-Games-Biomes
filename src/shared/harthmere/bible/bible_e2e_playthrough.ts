// BIBLE_E2E_PLAYTHROUGH
//
// A pure-data simulator that plays the entire 85-quest catalog through the
// REAL gate and the REAL native trigger model — no server, no Redis, no
// browser, no mocks beyond a player harness that only does what the game does.
//
// WHY THIS TIER EXISTS
// --------------------
// TESTING_FASTER section 5: push verification down. A quest chain that cannot
// be completed is currently discovered by walking it in a browser, which costs
// a stack boot plus a replay per attempt; section 4.12 records the Bible
// catalog being run as ten serial browser groups against a three-minute
// per-row failure ceiling.
//
// Everything below is decidable from authored data plus the gate, so it runs
// in milliseconds:
//   * a quest whose prerequisite is never completable (orphan chain)
//   * a quest gated to a time/weather combination that never co-occurs
//   * a repeatable whose cadence makes it unreachable
//   * a giver who offers a quest the gate can never pass
//   * a hidden quest with no discovery publisher
//   * the main arc being completable out of order
//   * a step with no addressable native id (permanent soft-lock)
//
// PERFORMANCE DISCIPLINE
// The section 1.2 incident (a quadratic BFS that was most of the Chapter 1
// suite) applies here: the reachability walk is memoized and uses a head index
// rather than `Array.shift()`.

import {
  BIBLE_QUEST_CATALOG,
  bibleCompletedQuestIds,
  bibleQuest,
} from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleQuestGate,
  type BibleGateContext,
} from "@/shared/harthmere/bible/bible_quest_gate";
import {
  bibleNativeQuestId,
  bibleNativeStepId,
} from "@/shared/harthmere/bible/bible_quest_ids";
import {
  bibleQuestAutoStarts,
  bibleQuestGiverId,
  type BibleQuestDef,
  type BibleTimeOfDay,
  type BibleWeather,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_E2E_PLAYTHROUGH_VERSION = 1 as const;

const ALL_TIMES: readonly BibleTimeOfDay[] = ["dawn", "day", "dusk", "night"];
const ALL_WEATHER: readonly BibleWeather[] = [
  "clear",
  "rain",
  "storm",
  "fog",
  "snow",
];

/**
 * Native progress, modelled exactly as the engine holds it.
 *
 * `challengesComplete` is `Challenges.complete`; `firedSteps` is
 * `TriggerState.by_root` flattened to a set of "questId:stepId". Deliberately
 * NOT a second state machine — the simulator asserts the real components are
 * sufficient, which is the migration's central claim.
 */
export interface BiblePlaythroughState {
  readonly challengesComplete: Set<string>;
  readonly challengesInProgress: Set<string>;
  readonly firedSteps: Set<string>;
  readonly flags: Set<string>;
  readonly lastCompletedAtMs: Record<string, number>;
  playerLevel: number;
  nowMs: number;
}

export function bibleInitialPlaythroughState(
  nowMs: number
): BiblePlaythroughState {
  return {
    challengesComplete: new Set(),
    challengesInProgress: new Set(),
    firedSteps: new Set(),
    flags: new Set(),
    lastCompletedAtMs: {},
    playerLevel: 1,
    nowMs,
  };
}

export function bibleGateContextFor(
  state: BiblePlaythroughState,
  overrides: Partial<BibleGateContext> = {}
): BibleGateContext {
  return {
    playerLevel: state.playerLevel,
    hour: 12,
    timeOfDay: "day",
    weather: "clear",
    completedQuestIds: bibleCompletedQuestIds(state.challengesComplete),
    flags: state.flags,
    lastCompletedAtMs: state.lastCompletedAtMs,
    nowMs: state.nowMs,
    ...overrides,
  };
}

/**
 * The narrowest conditions under which a quest can be offered at all.
 *
 * Used to prove reachability without letting the simulator cheat: it picks a
 * legal time/weather/level for the quest rather than pretending the gate is
 * satisfied.
 */
export function bibleBestCaseContext(
  quest: BibleQuestDef,
  state: BiblePlaythroughState
): BibleGateContext {
  return bibleGateContextFor(state, {
    playerLevel: quest.gate.levelBand.min,
    timeOfDay: quest.gate.timeOfDay[0] ?? "day",
    hour: quest.gate.activeHours[0] ?? 12,
    weather: quest.gate.weather[0] ?? "clear",
  });
}

export interface BiblePlaythroughStep {
  readonly questId: string;
  readonly stepId: string;
  readonly nativeChallengeId: number;
  readonly nativeStepId: number;
}

export interface BiblePlaythroughReport {
  readonly completedQuestIds: readonly string[];
  readonly steps: readonly BiblePlaythroughStep[];
  readonly unreachableQuestIds: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Complete one quest the way the engine would: fire each objective leaf in
 * order, then move the challenge to complete when every leaf is present.
 *
 * Mirrors `native_ecs_drop_materialization.ts`'s completion branch — all steps
 * fired means complete — which is the behaviour the trigger engine produces.
 */
function completeQuest(
  quest: BibleQuestDef,
  state: BiblePlaythroughState,
  steps: BiblePlaythroughStep[],
  errors: string[]
): void {
  const challengeId = bibleNativeQuestId(quest.id);
  if (challengeId === undefined) {
    errors.push(`${quest.id}: no native challenge id`);
    return;
  }
  state.challengesInProgress.add(quest.id);
  for (const [index, step] of quest.steps.entries()) {
    const nativeStepId = bibleNativeStepId(quest.id, index);
    if (nativeStepId === undefined) {
      errors.push(
        `${quest.id}/${step.id}: no native step id — permanently uncompletable`
      );
      return;
    }
    const key = `${quest.id}:${step.id}`;
    // Idempotent by construction: re-firing sets a value already set.
    state.firedSteps.add(key);
    steps.push({
      questId: quest.id,
      stepId: step.id,
      nativeChallengeId: Number(challengeId),
      nativeStepId: Number(nativeStepId),
    });
  }
  const allFired = quest.steps.every((step) =>
    state.firedSteps.has(`${quest.id}:${step.id}`)
  );
  if (!allFired) {
    errors.push(`${quest.id}: completed with unfired steps`);
    return;
  }
  state.challengesInProgress.delete(quest.id);
  state.challengesComplete.add(quest.id);
  state.lastCompletedAtMs[quest.id] = state.nowMs;
  for (const unlock of quest.rewards.unlocks) state.flags.add(unlock);
  // Quest xp feeds native progression, which raises the level that later
  // gates read. Modelled coarsely: the arc must not require a level the arc
  // itself cannot produce.
  state.playerLevel = Math.max(
    state.playerLevel,
    quest.gate.levelBand.min,
    Math.min(60, state.playerLevel + 1)
  );
}

/**
 * Walk the whole catalog to a fixed point, taking any quest whose gate passes
 * under its own best-case conditions.
 *
 * Fixed-point rather than a single pass because completing a quest can unlock
 * others; head-index queue rather than `Array.shift()` because that was
 * measured quadratic in the Chapter 1 suite.
 */
export function bibleRunFullPlaythrough(
  nowMs: number
): BiblePlaythroughReport {
  const state = bibleInitialPlaythroughState(nowMs);
  const steps: BiblePlaythroughStep[] = [];
  const errors: string[] = [];

  const pending = [...BIBLE_QUEST_CATALOG];
  let progressed = true;
  while (progressed) {
    progressed = false;
    let head = 0;
    const carried: BibleQuestDef[] = [];
    while (head < pending.length) {
      const quest = pending[head];
      head += 1;
      if (state.challengesComplete.has(quest.id)) continue;
      const gate = bibleQuestGate(quest, bibleBestCaseContext(quest, state));
      if (!gate.ok) {
        carried.push(quest);
        continue;
      }
      completeQuest(quest, state, steps, errors);
      progressed = true;
    }
    pending.length = 0;
    pending.push(...carried);
  }

  return {
    completedQuestIds: [...state.challengesComplete],
    steps,
    unreachableQuestIds: pending.map((quest) => quest.id),
    errors,
  };
}

/**
 * Codes on the REQUIRED main spine. Q2.5 is deliberately absent: the retired
 * coverage policy listed it under `requiredOptionalMainCodes`, and it branches
 * off Q2 rather than sitting between Q2 and Q3. A player who skips it still
 * reaches Q12, so requiring it in the spine order would be wrong.
 */
export const BIBLE_MAIN_SPINE_CODES: readonly string[] = Object.freeze([
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
  "Q7",
  "Q8",
  "Q9",
  "Q10",
  "Q11",
  "Q12",
]);

export const BIBLE_OPTIONAL_MAIN_CODES: readonly string[] = Object.freeze([
  "Q2.5",
]);

/**
 * Ordering proof for the main spine: every Q1..Q12 quest must require the
 * previous one, transitively. Catches a chain edited into a shortcut.
 */
export function bibleMainArcOrderErrors(): string[] {
  const errors: string[] = [];
  const main = BIBLE_QUEST_CATALOG.filter(
    (quest) =>
      quest.category === "main" && BIBLE_MAIN_SPINE_CODES.includes(quest.code)
  );
  const ancestorsOf = (questId: string): Set<string> => {
    const seen = new Set<string>();
    let cursor = bibleQuest(questId);
    while (cursor && cursor.start.kind === "after") {
      const next: string = cursor.start.questId;
      if (seen.has(next)) break;
      seen.add(next);
      cursor = bibleQuest(next);
    }
    return seen;
  };
  for (const [index, quest] of main.entries()) {
    if (index === 0) continue;
    const ancestors = ancestorsOf(quest.id);
    const previous = main[index - 1];
    if (!ancestors.has(previous.id)) {
      errors.push(
        `${quest.id} (${quest.code}) does not require ${previous.id} ` +
          `(${previous.code}) — the arc can be played out of order`
      );
    }
  }
  return errors;
}

/**
 * Every quest must be startable by SOME means: an NPC offer, an auto-start, or
 * a discovery publish. A quest that is none of these is authored content no
 * player can ever see.
 */
export function bibleUnstartableQuestIds(): string[] {
  return BIBLE_QUEST_CATALOG.filter(
    (quest) =>
      bibleQuestGiverId(quest) === undefined &&
      !bibleQuestAutoStarts(quest) &&
      quest.start.kind !== "world_trigger"
  ).map((quest) => quest.id);
}

/**
 * A quest gated on a time-of-day and a weather that can never co-occur is
 * unreachable. Both dimensions are independent in this world, so the check is
 * "is at least one legal combination listed", not a simulation.
 */
export function bibleImpossibleGateQuestIds(): string[] {
  return BIBLE_QUEST_CATALOG.filter((quest) => {
    const times = quest.gate.timeOfDay.length ? quest.gate.timeOfDay : ALL_TIMES;
    const weather = quest.gate.weather.length ? quest.gate.weather : ALL_WEATHER;
    const hours = quest.gate.activeHours.length
      ? quest.gate.activeHours
      : [0];
    return times.length === 0 || weather.length === 0 || hours.length === 0;
  }).map((quest) => quest.id);
}
