export type HarthmerePlayerAttackTimingClass =
  "basic" | "heavy" | "ranged" | "magic";

export interface HarthmerePlayerAttackTiming {
  windupMs: number;
  impactMs: number;
  recoveryMs: number;
  staminaCost: number;
  movementScale: number;
}

export type HarthmereCombatComboHit = 1 | 2 | 3 | 4;
export type HarthmereCombatComboVariation = 1 | 2 | 3 | 4;

export interface HarthmereCombatComboState {
  hit: HarthmereCombatComboHit;
  variation: HarthmereCombatComboVariation;
  chainOffset: number;
  chainStartedAt: number;
  nextAttackAt: number;
  contextExpiresAt: number;
  cooldownUntil: number;
}

export const HARTHMERE_COMBAT_COMBO_MAX_HITS = 4;
export const HARTHMERE_COMBAT_COMBO_COOLDOWN_SECS = 3;
export const HARTHMERE_COMBAT_COMBO_CONTEXT_SECS = 4;
export const HARTHMERE_COMBAT_ANIMATION_FPS = 24;
export const HARTHMERE_COMBAT_BASIC_CONTACT_FRAME = 6;
export const HARTHMERE_COMBAT_BASIC_END_FRAME = 17;
export const HARTHMERE_COMBAT_HEAVY_CONTACT_FRAME = 10;
export const HARTHMERE_COMBAT_HEAVY_END_FRAME = 26;

export type HarthmereCombatComboDecision =
  | { allowed: true; state: HarthmereCombatComboState }
  | { allowed: false; readyAt: number };

/**
 * One combat clock for body animation, weapon animation, damage, movement
 * commitment and cooldown validation. Normal attacks do not spend stamina;
 * dodge, evade, and double jump add an immediate cost to the same survival bar
 * that is already declining during active play. The combat clips are authored
 * on exact 24 fps samples: light contact at frame 6, heavy contact at frame 10,
 * and enough recovery to read when the player stops without inserting dead air
 * between buffered combo attacks.
 */
export const HARTHMERE_PLAYER_ATTACK_TIMINGS = Object.freeze({
  basic: {
    windupMs: 135,
    impactMs: 250,
    recoveryMs: 458,
    staminaCost: 0,
    movementScale: 0.38,
  },
  heavy: {
    windupMs: 229,
    impactMs: 417,
    recoveryMs: 666,
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

// These values are presentation-facing exact frame times. Gameplay uses the
// millisecond values above, rounded to the nearest millisecond. Keeping both
// forms derived from the same frame contract prevents a combo link from
// replacing the current pose before its visible blade contact.
export const HARTHMERE_COMBAT_BASIC_AUTHORED_CONTACT_SECS =
  HARTHMERE_COMBAT_BASIC_CONTACT_FRAME / HARTHMERE_COMBAT_ANIMATION_FPS;
export const HARTHMERE_COMBAT_HEAVY_AUTHORED_CONTACT_SECS =
  HARTHMERE_COMBAT_HEAVY_CONTACT_FRAME / HARTHMERE_COMBAT_ANIMATION_FPS;
export const HARTHMERE_COMBAT_BASIC_AUTHORED_DURATION_SECS =
  HARTHMERE_COMBAT_BASIC_END_FRAME / HARTHMERE_COMBAT_ANIMATION_FPS;
export const HARTHMERE_COMBAT_HEAVY_AUTHORED_DURATION_SECS =
  HARTHMERE_COMBAT_HEAVY_END_FRAME / HARTHMERE_COMBAT_ANIMATION_FPS;

export const HARTHMERE_HEAVY_ATTACK_HOLD_SECS = 0.22;
export const HARTHMERE_HEAVY_ATTACK_DAMAGE_MULTIPLIER = 1.5;
export const HARTHMERE_HEAVY_ATTACK_TIME_MULTIPLIER = 1;

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

export function harthmereCombatComboLinkSeconds(
  timingClass: HarthmerePlayerAttackTimingClass
) {
  // Link on the gameplay contact clock, never the old pre-contact constants.
  // The rounded millisecond value is intentionally a fraction later than the
  // exact Blender sample for heavy attacks, so the next action cannot replace
  // the current action before damage/contact has actually been evaluated.
  return HARTHMERE_PLAYER_ATTACK_TIMINGS[timingClass].impactMs / 1000;
}

/**
 * One coherent light/heavy fight combo budget. The next strike may link after
 * the current authored contact, never before it. Hit four closes the chain and
 * starts a three-second cooldown after its full authored commitment. Mining and
 * empty exploration swings do not call this function.
 */
export function nextHarthmereCombatCombo(
  previous: HarthmereCombatComboState | undefined,
  nowSeconds: number,
  timingClass: HarthmerePlayerAttackTimingClass
): HarthmereCombatComboDecision {
  if (
    previous &&
    previous.hit < HARTHMERE_COMBAT_COMBO_MAX_HITS &&
    nowSeconds < previous.nextAttackAt
  ) {
    return { allowed: false, readyAt: previous.nextAttackAt };
  }
  if (
    previous?.hit === HARTHMERE_COMBAT_COMBO_MAX_HITS &&
    nowSeconds < previous.cooldownUntil
  ) {
    return { allowed: false, readyAt: previous.cooldownUntil };
  }

  const continuesChain =
    previous !== undefined &&
    previous.hit < HARTHMERE_COMBAT_COMBO_MAX_HITS &&
    nowSeconds <= previous.contextExpiresAt;
  const hit = (
    continuesChain ? previous.hit + 1 : 1
  ) as HarthmereCombatComboHit;
  const chainOffset = continuesChain
    ? previous.chainOffset
    : ((previous?.chainOffset ?? -1) + 1) % HARTHMERE_COMBAT_COMBO_MAX_HITS;
  const variation = (((chainOffset + hit - 1) %
    HARTHMERE_COMBAT_COMBO_MAX_HITS) +
    1) as HarthmereCombatComboVariation;
  const timing = HARTHMERE_PLAYER_ATTACK_TIMINGS[timingClass];
  const commitmentEnd =
    nowSeconds + harthmerePlayerAttackCommitmentSeconds(timingClass);
  const cooldownUntil =
    hit === HARTHMERE_COMBAT_COMBO_MAX_HITS
      ? commitmentEnd + HARTHMERE_COMBAT_COMBO_COOLDOWN_SECS
      : 0;
  const nextAttackAt =
    hit === HARTHMERE_COMBAT_COMBO_MAX_HITS
      ? cooldownUntil
      : nowSeconds + harthmereCombatComboLinkSeconds(timingClass);

  return {
    allowed: true,
    state: {
      hit,
      variation,
      chainOffset,
      chainStartedAt: continuesChain ? previous.chainStartedAt : nowSeconds,
      nextAttackAt,
      contextExpiresAt:
        Math.max(commitmentEnd, cooldownUntil) +
        HARTHMERE_COMBAT_COMBO_CONTEXT_SECS,
      cooldownUntil,
    },
  };
}

/**
 * How long a retained follow-up input remains valid after commitment ends.
 *
 * Commitment is the point of this system: an attack cannot be cancelled, and
 * the recovery window is meant to be punishable. But committing the *character*
 * is different from discarding the *player's input*. Previously a press landing
 * anywhere inside an attack's commitment was
 * dropped, so continuing an exchange required waiting out the full window and
 * timing a fresh press with no feedback — and pressing a few frames early did
 * nothing at all.
 *
 * The press itself may happen anywhere during commitment. This post-recovery
 * grace only protects the handoff from a slow render/input tick; half a second
 * is long enough for the captured 16 FPS session and still permits only the one
 * explicitly retained press.
 */
export const HARTHMERE_ATTACK_INPUT_BUFFER_SECS = 0.5;

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
