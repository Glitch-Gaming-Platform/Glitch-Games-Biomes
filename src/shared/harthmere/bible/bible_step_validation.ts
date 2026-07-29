// BIBLE_STEP_VALIDATION
//
// Server-authoritative validation for one objective submission.
//
// Ported from `quest_runtime.ts::validateHarthmereQuestObjectiveEvent` with
// one structural change: prior-step ordering is checked against NATIVE trigger
// state (the set of already-fired step ids) rather than against a Redis
// `objectiveProgress` record. That removes the last read of the retired state
// machine from the write path.
//
// The authored `activeDuringStates` check is gone, deliberately. Every
// authored objective listed exactly `["active"]`, and "the challenge is in
// progress" is now expressible directly as native `Challenges.in_progress`
// membership, which the caller already has to check.
//
// Pure. No clock, no Redis, no ECS handles — the caller passes a snapshot.

import {
  bibleStepWorldWaypoint,
} from "@/shared/harthmere/bible/bible_waypoints";
import type {
  BibleQuestDef,
  BibleQuestStep,
} from "@/shared/harthmere/bible/bible_quest_schema";
import type { Vec3 } from "@/shared/math/types";

export const BIBLE_STEP_VALIDATION_VERSION = 1 as const;

export type BibleStepRejection =
  | "missing_quest"
  | "missing_step"
  | "quest_not_in_progress"
  | "player_too_far"
  | "line_of_sight_blocked"
  | "choice_not_revalidated"
  | "combat_result_required"
  | "damage_only_does_not_complete_combat_objective"
  | "prior_objective_not_complete"
  | "duplicate_submission";

export interface BibleStepSubmission {
  readonly actorPosition?: Vec3;
  readonly lineOfSight?: boolean;
  readonly revalidatedChoice?: string;
  readonly combatResult?: "damage" | "kill" | "encounter_cleared";
}

export interface BibleNativeProgressSnapshot {
  /** Is the challenge in `Challenges.in_progress`? */
  readonly inProgress: boolean;
  /** Step ids already present in `TriggerState.by_root` for this challenge. */
  readonly firedStepIds: ReadonlySet<string>;
}

export interface BibleStepValidationResult {
  readonly ok: boolean;
  readonly rejections: readonly BibleStepRejection[];
}

function distanceBetween(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function validateBibleStepSubmission(input: {
  quest: BibleQuestDef | undefined;
  step: BibleQuestStep | undefined;
  native: BibleNativeProgressSnapshot;
  submission: BibleStepSubmission;
}): BibleStepValidationResult {
  const { quest, step, native, submission } = input;
  const rejections: BibleStepRejection[] = [];
  if (!quest) return { ok: false, rejections: ["missing_quest"] };
  if (!step) return { ok: false, rejections: ["missing_step"] };

  if (!native.inProgress) rejections.push("quest_not_in_progress");

  // Idempotent by construction — a re-submit is not an error, but it must not
  // re-grant. Reported so the caller can return early instead of publishing a
  // duplicate progress event. /sync reconnects cancel in-flight publishes, so
  // clients legitimately retry.
  if (native.firedStepIds.has(step.id)) {
    return { ok: false, rejections: ["duplicate_submission"] };
  }

  // Distance is measured against the GROUNDED waypoint. Measuring against the
  // authored Y=0 point is what produced `player_too_far` for a player standing
  // exactly on target (312 of 340 authored waypoints carry Y=0).
  if (submission.actorPosition) {
    const target = bibleStepWorldWaypoint(quest, step);
    if (distanceBetween(submission.actorPosition, target) > step.validation.maxDistance) {
      rejections.push("player_too_far");
    }
  }

  if (step.validation.requiresLineOfSight && submission.lineOfSight === false) {
    rejections.push("line_of_sight_blocked");
  }

  if (
    step.type === "choice" &&
    step.validation.requiresChoiceRevalidation &&
    !submission.revalidatedChoice
  ) {
    rejections.push("choice_not_revalidated");
  }

  // Damage alone never completes a combat objective. No authored Bible step
  // allows a practice hit, so unlike the Grove path there is no exemption.
  if (step.type === "combat" && step.validation.requiresCombatValidation) {
    if (!submission.combatResult) {
      rejections.push("combat_result_required");
    } else if (submission.combatResult === "damage") {
      rejections.push("damage_only_does_not_complete_combat_objective");
    }
  }

  // Strict ordering: only the first unfired step may advance. Future markers
  // may be visible, but their events must not complete out of turn.
  for (const candidate of quest.steps) {
    if (candidate.id === step.id) break;
    if (!native.firedStepIds.has(candidate.id)) {
      rejections.push("prior_objective_not_complete");
      break;
    }
  }

  return { ok: rejections.length === 0, rejections };
}

/** First step not yet present in native trigger state, in authored order. */
export function bibleCurrentStep(
  quest: BibleQuestDef,
  firedStepIds: ReadonlySet<string>
): BibleQuestStep | undefined {
  return quest.steps.find((step) => !firedStepIds.has(step.id));
}

/** True when every authored step has fired — the quest is ready to complete. */
export function bibleAllStepsFired(
  quest: BibleQuestDef,
  firedStepIds: ReadonlySet<string>
): boolean {
  return quest.steps.every((step) => firedStepIds.has(step.id));
}
