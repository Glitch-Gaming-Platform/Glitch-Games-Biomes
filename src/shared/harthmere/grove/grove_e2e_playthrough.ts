// GROVE_E2E_PLAYTHROUGH
//
// A pure-data simulator that plays the entire 51-quest Grove catalog through
// the REAL gate and the REAL native trigger model — no server, no Redis, no
// browser.
//
// WHY THIS TIER EXISTS
// --------------------
// Grove onboarding is the first thing every new player touches, and it is the
// most expensive thing to verify in a browser: `t.sh grove:e2e` previously
// meant running all 51 authority rows through a live stack. Everything below
// is decidable from authored data plus the gate, so it runs in milliseconds:
//
//   * a quest whose prerequisite is never completable (orphan chain)
//   * a graduation gated on more lessons than exist
//   * a quest gated on the acceptance of a quest nobody can accept
//   * an objective whose marker has no landmark
//   * a step with no addressable native id (permanent soft-lock)
//   * the fountain lesson set drifting out of sync with the graduation count
//
// PERFORMANCE DISCIPLINE
// The fixed-point walk memoizes and uses a head index rather than
// `Array.shift()` — the quadratic-BFS mistake TESTING_FASTER section 1.2
// measured as most of the Chapter 1 suite.

import {
  GROVE_FOUNTAIN_LESSON_IDS,
  GROVE_QUEST_CATALOG,
  groveCompletedFountainLessonCount,
  groveQuest,
} from "@/shared/harthmere/grove/grove_quest_catalog";
import {
  groveQuestGate,
  type GroveGateContext,
} from "@/shared/harthmere/grove/grove_quest_gate";
import {
  groveNativeQuestId,
  groveNativeStepId,
} from "@/shared/harthmere/grove/grove_quest_ids";
import { groveStepWorldWaypoint } from "@/shared/harthmere/grove/grove_waypoints";
import type { GroveQuestDef } from "@/shared/harthmere/grove/grove_quest_schema";

export const GROVE_E2E_PLAYTHROUGH_VERSION = 1 as const;

export interface GrovePlaythroughState {
  readonly completed: Set<string>;
  readonly accepted: Set<string>;
  readonly firedSteps: Set<string>;
}

export function groveInitialPlaythroughState(): GrovePlaythroughState {
  return { completed: new Set(), accepted: new Set(), firedSteps: new Set() };
}

export function groveGateContextFor(
  state: GrovePlaythroughState
): GroveGateContext {
  return {
    completedQuestIds: state.completed,
    acceptedQuestIds: state.accepted,
  };
}

export interface GrovePlaythroughStep {
  readonly questId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly nativeChallengeId: number;
  readonly nativeStepId: number;
  readonly markerId: string;
}

export interface GrovePlaythroughReport {
  readonly completedQuestIds: readonly string[];
  readonly steps: readonly GrovePlaythroughStep[];
  readonly unreachableQuestIds: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Complete one quest the way the engine would: accept it, fire each objective
 * leaf in order, then move the challenge to complete when all have fired.
 */
function completeQuest(
  quest: GroveQuestDef,
  state: GrovePlaythroughState,
  steps: GrovePlaythroughStep[],
  errors: string[]
): void {
  const challengeId = groveNativeQuestId(quest.id);
  if (challengeId === undefined) {
    errors.push(`${quest.id}: no native challenge id`);
    return;
  }
  state.accepted.add(quest.id);
  for (const step of quest.steps) {
    const nativeStepId = groveNativeStepId(quest.id, step.index);
    if (nativeStepId === undefined) {
      errors.push(
        `${quest.id}/${step.id}: no native step id — permanently uncompletable`
      );
      return;
    }
    if (!groveStepWorldWaypoint(step)) {
      errors.push(
        `${quest.id}/${step.id}: marker "${step.markerId}" has no landmark`
      );
      return;
    }
    // Idempotent by construction: re-firing sets a value already set.
    state.firedSteps.add(`${quest.id}:${step.id}`);
    steps.push({
      questId: quest.id,
      stepId: step.id,
      stepIndex: step.index,
      nativeChallengeId: Number(challengeId),
      nativeStepId: Number(nativeStepId),
      markerId: step.markerId,
    });
  }
  state.completed.add(quest.id);
}

/**
 * Walk the catalog to a fixed point, taking any quest whose gate passes.
 *
 * Fixed-point rather than one pass because completing a quest unlocks others —
 * notably the graduation, which needs a lesson COUNT rather than a specific
 * predecessor.
 */
export function groveRunFullPlaythrough(): GrovePlaythroughReport {
  const state = groveInitialPlaythroughState();
  const steps: GrovePlaythroughStep[] = [];
  const errors: string[] = [];

  const pending = [...GROVE_QUEST_CATALOG];
  let progressed = true;
  while (progressed) {
    progressed = false;
    let head = 0;
    const carried: GroveQuestDef[] = [];
    while (head < pending.length) {
      const quest = pending[head];
      head += 1;
      if (state.completed.has(quest.id)) continue;
      if (!groveQuestGate(quest, groveGateContextFor(state)).ok) {
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
    completedQuestIds: [...state.completed],
    steps,
    unreachableQuestIds: pending.map((quest) => quest.id),
    errors,
  };
}

/**
 * The graduation must be reachable using ONLY fountain lessons.
 *
 * If it needs more lessons than exist, or a lesson that is itself gated behind
 * the graduation, onboarding dead-ends and every new player is stuck at the
 * fountain. Cheapest possible check for the worst possible bug.
 */
export function groveGraduationReachabilityErrors(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    if (quest.start.kind !== "after_fountain_lessons") continue;
    const required = quest.start.minCompleted;
    if (required > GROVE_FOUNTAIN_LESSON_IDS.length) {
      errors.push(
        `${quest.id} needs ${required} fountain lessons but only ` +
          `${GROVE_FOUNTAIN_LESSON_IDS.length} exist`
      );
    }
    // Every lesson must be completable without this quest.
    const withoutGraduation: GroveGateContext = {
      completedQuestIds: new Set(),
      acceptedQuestIds: new Set(),
    };
    const openLessons = GROVE_FOUNTAIN_LESSON_IDS.filter((lessonId) => {
      const lesson = groveQuest(lessonId);
      return lesson && groveQuestGate(lesson, withoutGraduation).ok;
    });
    if (openLessons.length < required) {
      errors.push(
        `${quest.id} needs ${required} lessons but only ${openLessons.length} ` +
          `are open to a brand-new player`
      );
    }
  }
  return errors;
}

/** Quests no giver offers — authored content no player can ever see. */
export function groveUnofferableQuestIds(
  knownGiverIds: ReadonlySet<string>
): string[] {
  return GROVE_QUEST_CATALOG.filter(
    (quest) => !knownGiverIds.has(quest.start.giverNpcId)
  ).map((quest) => quest.id);
}

/** Fountain lesson bookkeeping, asserted against the authored flag. */
export function groveFountainLessonCountErrors(): string[] {
  const errors: string[] = [];
  const counted = groveCompletedFountainLessonCount(GROVE_FOUNTAIN_LESSON_IDS);
  if (counted !== GROVE_FOUNTAIN_LESSON_IDS.length) {
    errors.push(
      `fountain lesson counting disagrees with the lesson set: counted ` +
        `${counted} of ${GROVE_FOUNTAIN_LESSON_IDS.length}`
    );
  }
  for (const lessonId of GROVE_FOUNTAIN_LESSON_IDS) {
    const lesson = groveQuest(lessonId);
    if (!lesson) {
      errors.push(`fountain lesson "${lessonId}" is not in the catalog`);
      continue;
    }
    if (!lesson.countsAsFountainLesson) {
      errors.push(`${lessonId} is in the lesson set but not flagged as one`);
    }
  }
  return errors;
}
