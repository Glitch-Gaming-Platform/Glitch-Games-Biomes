// GROVE_QUEST_GATE
//
// The pure activation gate for Grove onboarding quests.
//
// Native `Challenges` carries quest state (available / in_progress / complete)
// exactly as it does for Bible and Chapter 1. What it cannot express is the
// two Grove-specific unlock kinds:
//
//   * `after_fountain_lessons` — "any N of this set", which is a COUNT over a
//     set, not a single challengeComplete edge. Native unlock triggers are a
//     boolean tree over specific challenges; expressing "any 4 of 13" would
//     need a 715-branch `any` tree, so it stays here.
//   * `after_accepted` — gated on another quest being STARTED but not
//     finished. Native `Challenges` has `in_progress`, but an unlock trigger
//     fires on completion events, not on acceptance, so this also stays here.
//
// `after` (completed) DOES map cleanly onto a native `challengeComplete`
// unlock and is projected as one — see `grove_native_quests.ts`. It is still
// re-checked here so dialogue can explain a locked quest instead of silently
// omitting it.
//
// Pure: no clock, no Redis, no ECS. Every branch is unit-testable.

import {
  groveCompletedFountainLessonCount,
} from "@/shared/harthmere/grove/grove_quest_catalog";
import type { GroveQuestDef } from "@/shared/harthmere/grove/grove_quest_schema";

export const GROVE_QUEST_GATE_VERSION = 1 as const;

/** Closed union: a new reason is a compile error at every call site. */
export type GroveGateReason =
  | "unknown_quest"
  | "missing_prerequisite"
  | "prerequisite_not_accepted"
  | "not_enough_fountain_lessons"
  | "already_completed";

export interface GroveGateFailure {
  readonly reason: GroveGateReason;
  /** The prerequisite quest id, or the lesson count still required. */
  readonly detail?: string;
}

export interface GroveGateResult {
  readonly ok: boolean;
  readonly failures: readonly GroveGateFailure[];
}

export interface GroveGateContext {
  readonly completedQuestIds: ReadonlySet<string>;
  readonly acceptedQuestIds: ReadonlySet<string>;
}

export function groveQuestGate(
  quest: GroveQuestDef | undefined,
  context: GroveGateContext
): GroveGateResult {
  if (!quest) {
    return { ok: false, failures: [{ reason: "unknown_quest" }] };
  }
  const failures: GroveGateFailure[] = [];
  const fail = (reason: GroveGateReason, detail?: string) =>
    failures.push(detail === undefined ? { reason } : { reason, detail });

  // Every Grove quest is once-only. There is no repeatable onboarding lesson,
  // and re-teaching the HUD would be worse than not offering it.
  if (context.completedQuestIds.has(quest.id)) {
    fail("already_completed");
  }

  switch (quest.start.kind) {
    case "giver":
      break;
    case "after":
      if (!context.completedQuestIds.has(quest.start.questId)) {
        fail("missing_prerequisite", quest.start.questId);
      }
      break;
    case "after_accepted":
      // Accepted OR completed satisfies this: a player who has already
      // finished the prerequisite obviously accepted it, and treating
      // completion as failing the check would lock the follow-up forever.
      if (
        !context.acceptedQuestIds.has(quest.start.questId) &&
        !context.completedQuestIds.has(quest.start.questId)
      ) {
        fail("prerequisite_not_accepted", quest.start.questId);
      }
      break;
    case "after_fountain_lessons": {
      const finished = groveCompletedFountainLessonCount(
        context.completedQuestIds
      );
      if (finished < quest.start.minCompleted) {
        fail(
          "not_enough_fountain_lessons",
          `${finished}/${quest.start.minCompleted}`
        );
      }
      break;
    }
  }

  return { ok: failures.length === 0, failures };
}

export function groveQuestGateReasons(
  result: GroveGateResult
): readonly GroveGateReason[] {
  return result.failures.map((failure) => failure.reason);
}

/**
 * Quests a giver can currently offer.
 *
 * A quest blocked on lesson count is still SURFACED with its reason, so the
 * NPC can say "finish a few more lessons first" rather than pretending the
 * quest does not exist — the player can see the fountain board and knows there
 * is more. A quest blocked on an unmet prerequisite is hidden, because the
 * player has no way to know it exists yet.
 */
export function groveQuestOfferability(
  quest: GroveQuestDef,
  context: GroveGateContext
): { offer: boolean; surfaceLocked: boolean; result: GroveGateResult } {
  const result = groveQuestGate(quest, context);
  if (result.ok) return { offer: true, surfaceLocked: false, result };
  const reasons = groveQuestGateReasons(result);
  const surfaceLocked =
    reasons.includes("not_enough_fountain_lessons") &&
    !reasons.includes("already_completed") &&
    !reasons.includes("missing_prerequisite");
  return { offer: false, surfaceLocked, result };
}
