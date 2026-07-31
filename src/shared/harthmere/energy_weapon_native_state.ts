import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import {
  HARTHMERE_ENERGY_WEAPONS,
  type HarthmereEnergyWeaponId,
} from "@/shared/harthmere/energy_weapon_catalog";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const HARTHMERE_ENERGY_WEAPON_TRIGGER_ROOT =
  8_740_000_000_000_201 as BiomesId;
const MODE_KEY = 8_740_000_000_000_202 as BiomesId;
const STARTED_AT_MS_KEY = 8_740_000_000_000_203 as BiomesId;
const ORIGIN_X_KEY = 8_740_000_000_000_204 as BiomesId;
const ORIGIN_Y_KEY = 8_740_000_000_000_205 as BiomesId;
const ORIGIN_Z_KEY = 8_740_000_000_000_206 as BiomesId;
const PRIMARY_TARGET_KEY = 8_740_000_000_000_207 as BiomesId;
const REMAINING_TARGETS_KEY = 8_740_000_000_000_208 as BiomesId;
const WEAPON_TIER_KEY = 8_740_000_000_000_209 as BiomesId;
const PRIMARY_KILLED_KEY = 8_740_000_000_000_210 as BiomesId;
const PULSE_SHOT_COUNT_KEY = 8_740_000_000_000_211 as BiomesId;
const HIT_TARGETS_ROOT = 8_740_000_000_000_212 as BiomesId;

export type HarthmereEnergySecondaryMode =
  | "penetration"
  | "nova"
  | "singularity";

const modeCode: Record<HarthmereEnergySecondaryMode, number> = {
  penetration: 1,
  nova: 2,
  singularity: 3,
};

function modeForCode(value: number): HarthmereEnergySecondaryMode | undefined {
  return (Object.keys(modeCode) as HarthmereEnergySecondaryMode[]).find(
    (mode) => modeCode[mode] === value
  );
}

function valuesFor(
  state: ReadonlyTriggerState | TriggerState | undefined,
  root = HARTHMERE_ENERGY_WEAPON_TRIGGER_ROOT
) {
  return state?.by_root.get(root);
}

function mutableValuesFor(state: TriggerState, root: BiomesId) {
  let values = state.by_root.get(root);
  if (!values) {
    values = new Map();
    state.by_root.set(root, values);
  }
  return values;
}

export function readHarthmerePulseCarbineShotCount(
  state: ReadonlyTriggerState | TriggerState | undefined
) {
  return Math.max(
    0,
    Math.trunc(Number(valuesFor(state)?.get(PULSE_SHOT_COUNT_KEY) ?? 0) || 0)
  );
}

export function advanceHarthmerePulseCarbineShotCount(state: TriggerState) {
  const count = readHarthmerePulseCarbineShotCount(state) + 1;
  mutableValuesFor(state, HARTHMERE_ENERGY_WEAPON_TRIGGER_ROOT).set(
    PULSE_SHOT_COUNT_KEY,
    count
  );
  return count;
}

export interface HarthmereEnergySecondaryAuthorization {
  mode: HarthmereEnergySecondaryMode;
  weaponId: HarthmereEnergyWeaponId;
  startedAtMs: number;
  origin: [number, number, number];
  primaryTargetId: BiomesId;
  remainingTargets: number;
  primaryKilled: boolean;
}

export function beginHarthmereEnergySecondaryAuthorization(
  state: TriggerState,
  input: {
    mode: HarthmereEnergySecondaryMode;
    weaponId: HarthmereEnergyWeaponId;
    startedAtMs: number;
    origin: ReadonlyVec3;
    primaryTargetId: BiomesId;
    remainingTargets: number;
    primaryKilled?: boolean;
  }
) {
  const weapon = HARTHMERE_ENERGY_WEAPONS.find(
    (entry) => entry.id === input.weaponId
  );
  if (!weapon) return;
  const values = mutableValuesFor(state, HARTHMERE_ENERGY_WEAPON_TRIGGER_ROOT);
  values.set(MODE_KEY, modeCode[input.mode]);
  values.set(STARTED_AT_MS_KEY, Math.max(0, Math.trunc(input.startedAtMs)));
  values.set(ORIGIN_X_KEY, input.origin[0]);
  values.set(ORIGIN_Y_KEY, input.origin[1]);
  values.set(ORIGIN_Z_KEY, input.origin[2]);
  values.set(PRIMARY_TARGET_KEY, input.primaryTargetId);
  values.set(
    REMAINING_TARGETS_KEY,
    Math.max(0, Math.trunc(input.remainingTargets))
  );
  values.set(WEAPON_TIER_KEY, weapon.tier);
  values.set(PRIMARY_KILLED_KEY, input.primaryKilled ? 1 : 0);
  const hitTargets = mutableValuesFor(state, HIT_TARGETS_ROOT);
  hitTargets.clear();
  hitTargets.set(input.primaryTargetId, input.startedAtMs);
}

export function readHarthmereEnergySecondaryAuthorization(
  state: ReadonlyTriggerState | TriggerState | undefined
): HarthmereEnergySecondaryAuthorization | undefined {
  const values = valuesFor(state);
  if (!values) return undefined;
  const mode = modeForCode(Number(values.get(MODE_KEY) ?? 0));
  const tier = Math.trunc(Number(values.get(WEAPON_TIER_KEY) ?? 0));
  const weapon = HARTHMERE_ENERGY_WEAPONS.find((entry) => entry.tier === tier);
  const primaryTargetId = Number(
    values.get(PRIMARY_TARGET_KEY) ?? 0
  ) as BiomesId;
  if (!mode || !weapon || !primaryTargetId) return undefined;
  return {
    mode,
    weaponId: weapon.id,
    startedAtMs: Math.max(0, Number(values.get(STARTED_AT_MS_KEY) ?? 0) || 0),
    origin: [
      Number(values.get(ORIGIN_X_KEY) ?? 0) || 0,
      Number(values.get(ORIGIN_Y_KEY) ?? 0) || 0,
      Number(values.get(ORIGIN_Z_KEY) ?? 0) || 0,
    ],
    primaryTargetId,
    remainingTargets: Math.max(
      0,
      Math.trunc(Number(values.get(REMAINING_TARGETS_KEY) ?? 0) || 0)
    ),
    primaryKilled: Number(values.get(PRIMARY_KILLED_KEY) ?? 0) === 1,
  };
}

export function harthmereEnergySecondaryAlreadyHit(
  state: ReadonlyTriggerState | TriggerState | undefined,
  targetId: BiomesId,
  startedAtMs: number
) {
  return (
    Number(valuesFor(state, HIT_TARGETS_ROOT)?.get(targetId) ?? 0) ===
    startedAtMs
  );
}

export function consumeHarthmereEnergySecondaryTarget(
  state: TriggerState,
  targetId: BiomesId,
  startedAtMs: number
) {
  const authorization = readHarthmereEnergySecondaryAuthorization(state);
  if (
    !authorization ||
    authorization.startedAtMs !== startedAtMs ||
    authorization.remainingTargets <= 0 ||
    harthmereEnergySecondaryAlreadyHit(state, targetId, startedAtMs)
  ) {
    return false;
  }
  mutableValuesFor(state, HIT_TARGETS_ROOT).set(targetId, startedAtMs);
  mutableValuesFor(state, HARTHMERE_ENERGY_WEAPON_TRIGGER_ROOT).set(
    REMAINING_TARGETS_KEY,
    authorization.remainingTargets - 1
  );
  return true;
}
