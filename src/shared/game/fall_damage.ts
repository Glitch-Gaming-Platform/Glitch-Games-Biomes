// FALL_DAMAGE
//
// Canonical fall-damage rule, shared by the client (which detects the fall and
// applies the damage eagerly) and the server (which can validate / apply it).
//
// Spec: no damage for a fall of less than 5 feet. At 5 feet the fall deals 10
// damage, and every additional 5 feet adds another 10 — i.e. it steps up per
// 5-foot increment:
//   5ft -> 10, 10ft -> 20, 15ft -> 30, 20ft -> 40, ...
//   damage = floor(feet / 5) * 10   (0 below 5 feet)
//
// The world's vertical unit is the voxel/block (see harthmere height notes); a
// player is 1.8 blocks tall. We treat 1 block of fall as 1 "foot" of the spec by
// default. If a different block->foot scale is wanted, change FEET_PER_BLOCK
// — every caller goes through fallDamageForBlocks, so the rule stays in one
// place.

export const FALL_DAMAGE_MIN_FEET = 5;
export const FALL_DAMAGE_INCREMENT_FEET = 5;
export const FALL_DAMAGE_PER_INCREMENT = 10;
export const FEET_PER_BLOCK = 1;

// Damage for a fall of `feet` feet. floor(feet/5)*10, zero below 5 feet.
export function fallDamageForFeet(feet: number): number {
  if (!Number.isFinite(feet) || feet < FALL_DAMAGE_MIN_FEET) {
    return 0;
  }
  const increments = Math.floor(feet / FALL_DAMAGE_INCREMENT_FEET);
  return increments * FALL_DAMAGE_PER_INCREMENT;
}

// Convert a fall measured in world blocks to damage via the block->foot scale.
export function fallDamageForBlocks(blocks: number): number {
  if (!Number.isFinite(blocks) || blocks <= 0) {
    return 0;
  }
  return fallDamageForFeet(blocks * FEET_PER_BLOCK);
}

// Apply a block-distance fall to a current HP value, clamped at 0. Pure so the
// server-side application is testable and matches the client's eager apply.
export function applyFallDamageToHp(hp: number, fallBlocks: number): number {
  const damage = fallDamageForBlocks(fallBlocks);
  return Math.max(0, hp - damage);
}

// ---- Fall-distance tracking ------------------------------------------------
//
// Fall damage is distance-based (apex of the airborne arc -> landing height),
// NOT impact velocity. This reducer is fed the player's ground state + Y each
// tick and reports how far the player fell at the moment they land. Because the
// distance is measured from the highest point reached while airborne, an
// ordinary jump (apex ~1-1.5 blocks above takeoff, landing back near takeoff)
// produces a tiny fall that is below the 5-foot threshold — so jumps never hurt.

export interface FallTrackerState {
  airborne: boolean;
  // Highest Y reached since the player was last safely supported. While on the
  // ground this tracks the current standing height (the takeoff anchor).
  apexY: number;
}

export function initFallTracker(y = 0): FallTrackerState {
  return { airborne: false, apexY: Number.isFinite(y) ? y : 0 };
}

export interface FallTrackerInput {
  onGround: boolean;
  y: number;
  // False while the player is in a state that cannot take fall damage (in water,
  // climbing, flying, on a minigame grace period, ...). Resets accumulation.
  canTakeFallDamage: boolean;
}

export interface FallTrackerResult {
  state: FallTrackerState;
  // Blocks fallen this tick (0 unless the player just landed from a fall).
  fellBlocks: number;
}

export function updateFallTracker(
  state: FallTrackerState,
  input: FallTrackerInput
): FallTrackerResult {
  const y = Number.isFinite(input.y) ? input.y : state.apexY;

  // Any state that cannot take fall damage cancels the in-progress fall.
  if (!input.canTakeFallDamage) {
    return { state: { airborne: false, apexY: y }, fellBlocks: 0 };
  }

  if (input.onGround) {
    if (state.airborne) {
      // Landed: the fall is from the highest point reached down to here.
      const fell = Math.max(0, state.apexY - y);
      return { state: { airborne: false, apexY: y }, fellBlocks: fell };
    }
    // Standing/walking on ground: keep the takeoff anchor at the current height.
    return { state: { airborne: false, apexY: y }, fellBlocks: 0 };
  }

  // Airborne: raise the apex to the highest point reached (takeoff height when
  // first leaving the ground, then the arc's peak).
  const apexY = Math.max(state.apexY, y);
  return { state: { airborne: true, apexY }, fellBlocks: 0 };
}
