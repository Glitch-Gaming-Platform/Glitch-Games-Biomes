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
}

export function clientFallDamageTickWithGraceV1(
  state: FallTrackerStateV1,
  input: ClientFallDamageTickWithGraceInputV1
): ClientFallDamageTickResultV1 {
  const tick = clientFallDamageTickV1(state, input);
  return {
    ...tick,
    hpDelta: input.canApplyFallDamage ? tick.hpDelta : 0,
  };
}
