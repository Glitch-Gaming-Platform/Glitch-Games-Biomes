import type { ReadonlyNpcCombatState } from "@/shared/ecs/gen/components";
import type { HarthmereNativeNpcCombatProfile } from "@/shared/harthmere/harthmere_native_combat";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const HARTHMERE_NPC_STAGGER_VERSION =
  "harthmere-npc-stagger-v2-bosses" as const;
// Compatibility alias for older diagnostics. The runtime now covers eligible
// ordinary creatures and every live Harthmere boss.
export const HARTHMERE_NON_BOSS_STAGGER_VERSION = HARTHMERE_NPC_STAGGER_VERSION;

export type HarthmereNpcStaggerKind = "light" | "medium" | "heavy";

export const HARTHMERE_NPC_STAGGER_TIMING = {
  light: { durationSeconds: 0.42, immunitySeconds: 0.72 },
  medium: { durationSeconds: 0.95, immunitySeconds: 0.9 },
  heavy: { durationSeconds: 2.15, immunitySeconds: 1.1 },
} as const satisfies Record<
  HarthmereNpcStaggerKind,
  { durationSeconds: number; immunitySeconds: number }
>;

// Each duration starts with its authored 24 fps BossStagger clip and adds the
// requested boss-only recovery hold. Bosses also retain a longer post-reaction
// immunity so a coordinated group cannot chain poise breaks indefinitely.
export const HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS = 2;
export const HARTHMERE_BOSS_STAGGER_TIMING = {
  light: {
    durationSeconds: 14 / 24 + HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS,
    immunitySeconds: 1.1,
  },
  medium: {
    durationSeconds: 30 / 24 + HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS,
    immunitySeconds: 1.4,
  },
  heavy: {
    durationSeconds: 58 / 24 + HARTHMERE_BOSS_STAGGER_DURATION_BONUS_SECONDS,
    immunitySeconds: 1.8,
  },
} as const satisfies Record<
  HarthmereNpcStaggerKind,
  { durationSeconds: number; immunitySeconds: number }
>;

export const HARTHMERE_BOSS_POISE_MULTIPLIER = 1.75;
export const HARTHMERE_BOSS_POISE_MAX = 520;

export const HARTHMERE_NPC_POISE_RECOVERY_DELAY_SECONDS = 1.1;
export const HARTHMERE_NPC_POISE_RECOVERY_PER_SECOND = 0.42;
export const HARTHMERE_NPC_POST_STAGGER_POISE_FRACTION = 0.65;

export interface HarthmereNpcStaggerWindow {
  kind: HarthmereNpcStaggerKind;
  startTime: number;
  expiryTime: number;
  direction: Vec3;
}

export interface HarthmereNpcStaggerState {
  lastReactionTime?: number;
  lastProcessedDamageTime?: number;
  lastPoiseDamageTime?: number;
  poise?: number;
  poiseMax?: number;
  poiseUpdatedAt?: number;
  immunityUntil?: number;
  sequence?: number;
  stagger?: HarthmereNpcStaggerWindow;
}

export interface HarthmereNpcStaggerAdvanceInput {
  state: HarthmereNpcStaggerState | undefined;
  nowSeconds: number;
  maxHp: number;
  level: number;
  isBoss?: boolean;
  damageTime?: number;
  damageAmount?: number;
  damageIsAttack: boolean;
  damageDirection?: ReadonlyVec3;
}

export interface HarthmereNpcStaggerAdvanceResult {
  state: HarthmereNpcStaggerState;
  changed: boolean;
  active: boolean;
  triggered?: HarthmereNpcStaggerWindow;
  poiseDamage: number;
  ignoredReason?: "no_new_damage" | "not_attack" | "active" | "immune";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function finitePositive(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

function normalizedDirection(direction: ReadonlyVec3 | undefined): Vec3 {
  if (!direction?.every(Number.isFinite)) return [0, 0, 1];
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length <= 1e-6) return [0, 0, 1];
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

export function harthmereNpcStaggerEligible(
  profile: HarthmereNativeNpcCombatProfile | undefined
) {
  return Boolean(
    profile &&
    !profile.isPlayerLikeAppearance &&
    profile.attackDamage > 0 &&
    (profile.behaviorKind === "hostile" || profile.behaviorKind === "retaliate")
  );
}

export function harthmereNpcPoiseMax(input: {
  maxHp: number;
  level: number;
  isBoss?: boolean;
}) {
  const maxHp = finitePositive(input.maxHp, 100);
  const level = clamp(Math.trunc(input.level || 1), 1, 100);
  const ordinaryPoise = 42 + Math.sqrt(maxHp) * 2.8 + level * 4;
  return Math.round(
    input.isBoss
      ? clamp(
          ordinaryPoise * HARTHMERE_BOSS_POISE_MULTIPLIER,
          180,
          HARTHMERE_BOSS_POISE_MAX
        )
      : clamp(ordinaryPoise, 60, 180)
  );
}

export function harthmereNpcPoiseDamage(input: {
  damage: number;
  maxHp: number;
  poiseMax: number;
}) {
  const damage = Math.max(0, Number(input.damage) || 0);
  const maxHp = finitePositive(input.maxHp, 100);
  const poiseMax = finitePositive(input.poiseMax, 60);
  const healthRatio = clamp(damage / maxHp, 0, 1);
  return clamp(
    damage * 0.95 + poiseMax * healthRatio * 0.9,
    damage > 0 ? 6 : 0,
    poiseMax * 1.5
  );
}

export function harthmereNpcStaggerKindForHit(input: {
  damage: number;
  maxHp: number;
  poiseDamage: number;
  poiseMax: number;
}): HarthmereNpcStaggerKind {
  const healthRatio = input.damage / finitePositive(input.maxHp, 100);
  const poiseRatio = input.poiseDamage / finitePositive(input.poiseMax, 60);
  if (healthRatio >= 0.24 || poiseRatio >= 0.75) return "heavy";
  if (healthRatio >= 0.11 || poiseRatio >= 0.42) return "medium";
  return "light";
}

function recoverPoise(state: HarthmereNpcStaggerState, untilSeconds: number) {
  const poiseMax = finitePositive(state.poiseMax, 60);
  const poise = clamp(state.poise ?? poiseMax, 0, poiseMax);
  const updatedAt = state.poiseUpdatedAt ?? untilSeconds;
  if (poise >= poiseMax) {
    return { poise, poiseUpdatedAt: updatedAt };
  }
  const recoveryStart = Math.max(
    updatedAt,
    (state.lastPoiseDamageTime ?? Number.NEGATIVE_INFINITY) +
      HARTHMERE_NPC_POISE_RECOVERY_DELAY_SECONDS
  );
  const recoverSeconds = Math.max(0, untilSeconds - recoveryStart);
  if (recoverSeconds <= 0) {
    return { poise, poiseUpdatedAt: updatedAt };
  }
  return {
    poise: Math.min(
      poiseMax,
      poise +
        poiseMax * HARTHMERE_NPC_POISE_RECOVERY_PER_SECOND * recoverSeconds
    ),
    poiseUpdatedAt: untilSeconds,
  };
}

function sameStaggerState(
  left: HarthmereNpcStaggerState | undefined,
  right: HarthmereNpcStaggerState
) {
  const leftStagger = left?.stagger;
  const rightStagger = right.stagger;
  return (
    left?.lastReactionTime === right.lastReactionTime &&
    left?.lastProcessedDamageTime === right.lastProcessedDamageTime &&
    left?.lastPoiseDamageTime === right.lastPoiseDamageTime &&
    left?.poise === right.poise &&
    left?.poiseMax === right.poiseMax &&
    left?.poiseUpdatedAt === right.poiseUpdatedAt &&
    left?.immunityUntil === right.immunityUntil &&
    left?.sequence === right.sequence &&
    leftStagger?.kind === rightStagger?.kind &&
    leftStagger?.startTime === rightStagger?.startTime &&
    leftStagger?.expiryTime === rightStagger?.expiryTime &&
    leftStagger?.direction[0] === rightStagger?.direction[0] &&
    leftStagger?.direction[1] === rightStagger?.direction[1] &&
    leftStagger?.direction[2] === rightStagger?.direction[2]
  );
}

export function advanceHarthmereNpcStagger(
  input: HarthmereNpcStaggerAdvanceInput
): HarthmereNpcStaggerAdvanceResult {
  const now = Number.isFinite(input.nowSeconds) ? input.nowSeconds : 0;
  const poiseMax = harthmereNpcPoiseMax(input);
  let state: HarthmereNpcStaggerState = {
    ...(input.state ?? {}),
    poiseMax,
  };
  state.poise = clamp(state.poise ?? poiseMax, 0, poiseMax);
  state.poiseUpdatedAt ??= now;

  if (state.stagger && now >= state.stagger.expiryTime) {
    state = {
      ...state,
      stagger: undefined,
      poise: Math.max(
        state.poise ?? 0,
        poiseMax * HARTHMERE_NPC_POST_STAGGER_POISE_FRACTION
      ),
      poiseUpdatedAt: state.stagger.expiryTime,
    };
  }

  const active = Boolean(state.stagger && now < state.stagger.expiryTime);
  if (!active) {
    const recovered = recoverPoise(state, now);
    state = { ...state, ...recovered };
  }
  const finish = (
    result: Omit<HarthmereNpcStaggerAdvanceResult, "changed">
  ): HarthmereNpcStaggerAdvanceResult => ({
    ...result,
    changed: !sameStaggerState(input.state, result.state),
  });
  const damageTime = input.damageTime;
  if (
    damageTime === undefined ||
    !Number.isFinite(damageTime) ||
    damageTime <= (state.lastProcessedDamageTime ?? Number.NEGATIVE_INFINITY)
  ) {
    return finish({
      state,
      active,
      poiseDamage: 0,
      ignoredReason: "no_new_damage",
    });
  }

  state.lastProcessedDamageTime = damageTime;
  if (
    !input.damageIsAttack ||
    !(input.damageAmount && input.damageAmount > 0)
  ) {
    return finish({
      state,
      active,
      poiseDamage: 0,
      ignoredReason: "not_attack",
    });
  }
  if (active) {
    return finish({
      state,
      active: true,
      poiseDamage: 0,
      ignoredReason: "active",
    });
  }
  if (now < (state.immunityUntil ?? Number.NEGATIVE_INFINITY)) {
    return finish({
      state,
      active: false,
      poiseDamage: 0,
      ignoredReason: "immune",
    });
  }

  const poiseDamage = harthmereNpcPoiseDamage({
    damage: input.damageAmount,
    maxHp: input.maxHp,
    poiseMax,
  });
  const nextPoise = Math.max(0, (state.poise ?? poiseMax) - poiseDamage);
  state.poise = nextPoise;
  state.poiseUpdatedAt = now;
  state.lastPoiseDamageTime = damageTime;
  if (nextPoise > 0) {
    return finish({ state, active: false, poiseDamage });
  }

  const kind = harthmereNpcStaggerKindForHit({
    damage: input.damageAmount,
    maxHp: input.maxHp,
    poiseDamage,
    poiseMax,
  });
  const timing = (
    input.isBoss ? HARTHMERE_BOSS_STAGGER_TIMING : HARTHMERE_NPC_STAGGER_TIMING
  )[kind];
  const stagger: HarthmereNpcStaggerWindow = {
    kind,
    startTime: now,
    expiryTime: now + timing.durationSeconds,
    direction: normalizedDirection(input.damageDirection),
  };
  state.stagger = stagger;
  state.immunityUntil = stagger.expiryTime + timing.immunitySeconds;
  state.sequence = (state.sequence ?? 0) + 1;
  return finish({ state, active: true, triggered: stagger, poiseDamage });
}

export function activeHarthmereNpcStaggerPresentation(
  combatState: ReadonlyNpcCombatState | undefined,
  nowSeconds: number
): HarthmereNpcStaggerWindow | undefined {
  const kind = combatState?.stagger_kind;
  const startTime = combatState?.stagger_start_time;
  const expiryTime = combatState?.stagger_expiry_time;
  const direction = combatState?.stagger_direction;
  if (
    (kind !== "light" && kind !== "medium" && kind !== "heavy") ||
    startTime === undefined ||
    expiryTime === undefined ||
    !direction ||
    nowSeconds < startTime - 0.25 ||
    nowSeconds >= expiryTime
  ) {
    return undefined;
  }
  return {
    kind,
    startTime,
    expiryTime,
    direction: normalizedDirection(direction),
  };
}
