// HARTHMERE_NATIVE_QUEST_XP_AWARD
//
// The single write path that turns "a native quest leaf just fired" into ECS
// progression. Shared (not server-only) so the trigger engine, the local-dev
// ECS bridge, and unit tests all pay out through identical arithmetic.
//
// Composition:
//   native_quest_step_xp.ts        -> how much is this step worth (pure table)
//   harthmere_native_combat.ts     -> where XP/level live (ECS TriggerState)
//   harthmere_native_level_stats.ts-> what a level is worth (stats/resources)
//
// This file only glues those three together and reports what changed, so the
// caller can publish a firehose event without re-deriving anything.

import type { TriggerState } from "@/shared/ecs/gen/components";
import {
  awardHarthmereNativeCombatXp,
  readHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import type { HarthmereNativeStatCarrier } from "@/shared/harthmere/harthmere_native_level_stats";
import { syncHarthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import {
  nativeQuestCompletionXp,
  nativeQuestStepXp,
  type NativeQuestStepXpInput,
} from "@/shared/harthmere/native_quest_step_xp";

export interface HarthmereNativeQuestXpAwardResult {
  xpAwarded: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  maxHp: number;
  maxMana: number;
  maxStamina: number;
}

export interface HarthmereNativeQuestXpCarrier
  extends HarthmereNativeStatCarrier {
  mutableTriggerState(): TriggerState;
}

/**
 * Not every caller hands us a full player `Delta`. Trigger tests and some
 * internal tooling pass a minimal stub, and an entity with no TriggerState
 * accessor simply has no progression to write. Detect that up front instead of
 * throwing into the caller's error handler and filling logs with noise.
 */
function canCarryProgression(
  entity: HarthmereNativeQuestXpCarrier | undefined
): entity is HarthmereNativeQuestXpCarrier {
  return (
    typeof entity?.triggerState === "function" &&
    typeof entity?.mutableTriggerState === "function"
  );
}

function award(
  entity: HarthmereNativeQuestXpCarrier,
  xp: number
): HarthmereNativeQuestXpAwardResult | undefined {
  const xpDelta = Math.max(0, Math.trunc(xp));
  if (xpDelta <= 0 || !canCarryProgression(entity)) {
    return undefined;
  }
  const before = readHarthmereNativeCombatProgression(entity.triggerState());
  const after = awardHarthmereNativeCombatXp(
    entity.mutableTriggerState(),
    xpDelta
  );
  // Persistent level-owned values are re-derived unconditionally: a save that
  // leveled before this system existed gets corrected on the next award.
  const { stats } = syncHarthmereNativeLevelStats(entity);
  return {
    xpAwarded: xpDelta,
    levelBefore: before.level,
    levelAfter: after.level,
    leveledUp: after.level > before.level,
    maxHp: stats.maxHp,
    maxMana: stats.maxMana,
    maxStamina: stats.maxStamina,
  };
}

/**
 * Pay for one newly-completed native quest step.
 *
 * Returns undefined when the step is not eligible (wrong quest, aggregate node,
 * bookkeeping leaf) so callers can skip the ECS write entirely rather than
 * dirtying the progression root with a zero.
 */
export function awardHarthmereNativeQuestStepXp(
  entity: HarthmereNativeQuestXpCarrier,
  input: NativeQuestStepXpInput
): HarthmereNativeQuestXpAwardResult | undefined {
  return award(entity, nativeQuestStepXp(input));
}

/** Pay the one-time completion bonus on a quest's `completed` transition. */
export function awardHarthmereNativeQuestCompletionXp(
  entity: HarthmereNativeQuestXpCarrier,
  questId: unknown
): HarthmereNativeQuestXpAwardResult | undefined {
  return award(entity, nativeQuestCompletionXp(questId));
}
