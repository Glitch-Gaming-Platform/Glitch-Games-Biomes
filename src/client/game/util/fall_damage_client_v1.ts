// Client-side per-tick fall-damage decision. The player script keeps a
// FallTrackerStateV1 and calls this every simulation tick with the current
// ground state and height; on the tick the player lands from a fall of 5+ feet
// it returns the negative hpDelta to apply (via UpdatePlayerHealthEvent). Pure
// wrapper over the shared rule so it can be unit-tested without the player loop.

import {
  fallDamageForBlocksV1,
  updateFallTrackerV1,
  type FallTrackerInputV1,
  type FallTrackerStateV1,
} from "@/shared/game/fall_damage_v1";

export interface ClientFallDamageTickResultV1 {
  state: FallTrackerStateV1;
  // Blocks fallen on the landing tick (0 otherwise).
  fellBlocks: number;
  // <= 0. The HP delta to apply this tick (0 when there is no qualifying fall).
  hpDelta: number;
  // The computed damage before temporary client-side application grace is
  // applied. Useful for one safe landing after warps/minigames.
  rawHpDelta: number;
}

export function clientFallDamageTickV1(
  state: FallTrackerStateV1,
  input: FallTrackerInputV1
): ClientFallDamageTickResultV1 {
  const { state: next, fellBlocks } = updateFallTrackerV1(state, input);
  const damage = fallDamageForBlocksV1(fellBlocks);
  const hpDelta = damage > 0 ? -damage : 0;
  return { state: next, fellBlocks, hpDelta, rawHpDelta: hpDelta };
}

export interface ClientFallDamageTickWithGraceInputV1
  extends FallTrackerInputV1 {
  // False for a temporary grace landing after warps/minigames. This suppresses
  // the health change without resetting airborne tracking like `canTakeFallDamage`
  // does for water/climbing/flying.
  canApplyFallDamage: boolean;
  // Movement normally reports the exact fall distance through the tracker. If
  // cached ground state misses the airborne transition, a hard landing impact
  // can still supply a conservative distance fallback for that landing tick.
  landingImpactFallbackBlocks?: number;
}

export function clientFallDamageTickWithGraceV1(
  state: FallTrackerStateV1,
  input: ClientFallDamageTickWithGraceInputV1
): ClientFallDamageTickResultV1 {
  const tick = clientFallDamageTickV1(state, input);
  const fallbackBlocks =
    input.canTakeFallDamage && tick.fellBlocks <= 0
      ? Math.max(0, Number(input.landingImpactFallbackBlocks ?? 0))
      : 0;
  const fallbackDamage = fallDamageForBlocksV1(fallbackBlocks);
  const rawHpDelta =
    tick.rawHpDelta < 0
      ? tick.rawHpDelta
      : fallbackDamage > 0
      ? -fallbackDamage
      : 0;
  const fellBlocks =
    tick.fellBlocks > 0 || fallbackDamage <= 0
      ? tick.fellBlocks
      : fallbackBlocks;
  return {
    ...tick,
    fellBlocks,
    hpDelta: input.canApplyFallDamage ? rawHpDelta : 0,
    rawHpDelta,
  };
}
