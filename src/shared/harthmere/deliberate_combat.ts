export type HarthmerePlayerAttackTimingClass =
  "basic" | "heavy" | "ranged" | "magic";

export interface HarthmerePlayerAttackTiming {
  windupMs: number;
  impactMs: number;
  recoveryMs: number;
  staminaCost: number;
  movementScale: number;
}

/**
 * One combat clock for body animation, weapon animation, damage, movement
 * commitment and cooldown validation. Normal attacks do not spend stamina;
 * dodge, evade, and double jump add an immediate cost to the same survival bar
 * that is already declining during active play. The old 220 ms basic contact
 * was visually readable in isolation but too quick in a live fight, especially
 * when an NPC could answer immediately. These timings deliberately leave a
 * decision-sized windup and a punishable recovery without making ordinary
 * tools feel like boss weapons.
 */
export const HARTHMERE_PLAYER_ATTACK_TIMINGS = Object.freeze({
  basic: {
    windupMs: 260,
    impactMs: 400,
    recoveryMs: 620,
    staminaCost: 0,
    movementScale: 0.38,
  },
  heavy: {
    windupMs: 480,
    impactMs: 720,
    recoveryMs: 920,
    staminaCost: 0,
    movementScale: 0.18,
  },
  ranged: {
    windupMs: 340,
    impactMs: 520,
    recoveryMs: 680,
    staminaCost: 0,
    movementScale: 0.3,
  },
  magic: {
    windupMs: 460,
    impactMs: 700,
    recoveryMs: 860,
    staminaCost: 0,
    movementScale: 0.24,
  },
} as const satisfies Record<
  HarthmerePlayerAttackTimingClass,
  HarthmerePlayerAttackTiming
>);

export function harthmerePlayerAttackCommitmentMs(
  timingClass: HarthmerePlayerAttackTimingClass
) {
  const timing = HARTHMERE_PLAYER_ATTACK_TIMINGS[timingClass];
  return timing.impactMs + timing.recoveryMs;
}

export function harthmerePlayerAttackCommitmentSeconds(
  timingClass: HarthmerePlayerAttackTimingClass
) {
  return harthmerePlayerAttackCommitmentMs(timingClass) / 1000;
}

/**
 * How early an attack press is accepted before the current attack's commitment
 * ends.
 *
 * Commitment is the point of this system: an attack cannot be cancelled, and
 * the recovery window is meant to be punishable. But committing the *character*
 * is different from discarding the *player's input*. Previously a press landing
 * anywhere inside a basic attack's 1.02 s commitment (1.64 s for heavy) was
 * dropped, so continuing an exchange required waiting out the full window and
 * timing a fresh press with no feedback — and pressing a few frames early did
 * nothing at all.
 *
 * Buffering the intent and spending it the moment recovery ends preserves every
 * defensive property of commitment while letting a player who read the fight
 * correctly act on it. This value is deliberately shorter than the shortest
 * recovery (620 ms) so it can never span an entire attack.
 */
export const HARTHMERE_ATTACK_INPUT_BUFFER_SECS = 0.18;

// Authored survival-stamina costs. Keep these as named configuration constants
// so balance can change in one place without duplicating values across client,
// server, HUD, or tests.
export const HARTHMERE_DODGE_STAMINA_COST = 3;
export const HARTHMERE_EVADE_STAMINA_COST = 2;
export const HARTHMERE_DOUBLE_JUMP_STAMINA_COST = 4;

export const HARTHMERE_SPECIAL_MOVEMENT_STAMINA = Object.freeze({
  dodgeCost: HARTHMERE_DODGE_STAMINA_COST,
  evadeCost: HARTHMERE_EVADE_STAMINA_COST,
  doubleJumpCost: HARTHMERE_DOUBLE_JUMP_STAMINA_COST,
});

export function harthmereCombatStaminaCostForKind(
  _kind: "unarmed" | "melee" | "heavy" | "ranged" | "spell"
) {
  // This pool belongs only to special movement. Ordinary attacks are limited
  // by commitment, recovery, cooldown, mana, durability, and positioning.
  return 0;
}

export const HARTHMERE_ENEMY_MELEE_PACING = Object.freeze({
  ordinary: { strikeSecs: 0.72, intervalSecs: 2.4 },
  agile: { strikeSecs: 0.56, intervalSecs: 2.05 },
  heavy: { strikeSecs: 0.9, intervalSecs: 2.85 },
  boss: { strikeSecs: 1.08, intervalSecs: 3.15 },
  remoteApex: { strikeSecs: 1.25, intervalSecs: 3.5 },
  indisworm: { strikeSecs: 0.95, intervalSecs: 2.9 },
});
