import { HARTHMERE_PLAYER_ATTACK_TIMINGS } from "@/shared/harthmere/deliberate_combat";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";

export const HARTHMERE_MAGIC_CHARGE_VERSION =
  "harthmere-universal-magic-charge-v2" as const;

export const HARTHMERE_MAGIC_CHARGE_EVENT =
  "biomes:harthmere-magic-charge" as const;

/**
 * Charge is presentation, not a gameplay gate.
 *
 * These bounds describe how large and how long the charge-up *effect* reads on
 * screen, scaled by the spell's power. They previously also gated release: a
 * caster waited the full 2-10 s before the attack existed at all. That put
 * magic on a clock two to five times longer than an enemy's entire attack cycle
 * (`HARTHMERE_ENEMY_MELEE_PACING` runs 2.05-3.50 s), with no block or parry
 * posture to cover the commitment, so the resource that scales with power was
 * unusable exactly when power mattered.
 *
 * Release is now owned by the one combat clock in `deliberate_combat.ts`, the
 * same source that drives body animation, weapon animation, damage, movement
 * commitment, and cooldown validation. `chargeTimeSecs` survives as the
 * intensity descriptor consumers already normalise against
 * `HARTHMERE_MAGIC_CHARGE_MIN_SECS`/`MAX_SECS` to size the effect.
 */
export const HARTHMERE_MAGIC_CHARGE_MIN_SECS = 2;
export const HARTHMERE_MAGIC_CHARGE_MAX_SECS = 10;
export const HARTHMERE_MAGIC_CHARGE_QUANTUM_SECS = 0.25;

/**
 * Gameplay delay from cast start to release, shared by players and NPCs.
 *
 * This is the authored magic windup, so a spell commits on the documented
 * timeline and its charge graphic is compressed into that window rather than
 * defining it.
 */
export const HARTHMERE_MAGIC_RELEASE_WINDUP_SECS =
  HARTHMERE_PLAYER_ATTACK_TIMINGS.magic.windupMs / 1000;

/**
 * Normalised 0..1 charge intensity for VFX, derived from the presentational
 * charge duration. Renderers should drive scale/brightness from this and take
 * their *timing* from the release window supplied alongside it.
 */
export function harthmereMagicChargeIntensity(chargeTimeSecs: number): number {
  const span =
    HARTHMERE_MAGIC_CHARGE_MAX_SECS - HARTHMERE_MAGIC_CHARGE_MIN_SECS;
  if (!(span > 0) || !Number.isFinite(chargeTimeSecs)) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, (chargeTimeSecs - HARTHMERE_MAGIC_CHARGE_MIN_SECS) / span)
  );
}

export const HARTHMERE_MAGIC_CHARGE_POWER_TUNING = Object.freeze({
  damageCeiling: 150,
  resourceCeiling: 90,
  cooldownCeilingSecs: 180,
  beamBonus: 0.04,
  coneBonus: 0.05,
  areaBonus: 0.08,
});

export type HarthmereMagicChargePhase = "start" | "release" | "cancel";

export interface HarthmereMagicChargeEventDetail {
  version?: typeof HARTHMERE_MAGIC_CHARGE_VERSION;
  phase: HarthmereMagicChargePhase;
  chargeId: string;
  abilityId?: string;
  projectileVisualId?: string;
  casterKind?: "player" | "npc";
  casterEntityId?: number;
  chargeStartedAt?: number;
  chargeTimeSecs?: number;
  releaseTime?: number;
  origin?: readonly [number, number, number];
  targetPoint?: readonly [number, number, number];
  power?: number;
  visualScale?: number;
  source?: string;
}

const MAGIC_DAMAGE_TYPES = new Set([
  "fire",
  "ice",
  "lightning",
  "holy",
  "dark",
  "arcane",
  "nature",
  "sonic",
  "gravity",
]);

const NON_MAGIC_DAMAGE_TYPES = new Set([
  "physical",
  "slashing",
  "piercing",
  "blunt",
]);

const MAGIC_PROJECTILE_FAMILIES = new Set([
  "arcane",
  "fire",
  "lightning",
  "holy",
  "dark",
  "nature",
  "sonic",
  "mark",
  "hex",
  "boss",
  "gravity",
]);

export function isHarthmereMagicDamageType(value: unknown) {
  return MAGIC_DAMAGE_TYPES.has(String(value ?? "").toLowerCase());
}

export function isHarthmereMagicAttack(input: {
  damageType?: unknown;
  projectileVisualId?: unknown;
  explicitMagic?: boolean;
}) {
  if (input.explicitMagic !== undefined) {
    return input.explicitMagic;
  }
  const damageType = String(input.damageType ?? "").toLowerCase();
  if (MAGIC_DAMAGE_TYPES.has(damageType)) {
    return true;
  }
  if (NON_MAGIC_DAMAGE_TYPES.has(damageType)) {
    return false;
  }
  const projectile = getHarthmereProjectileVisual(input.projectileVisualId);
  return Boolean(
    projectile && MAGIC_PROJECTILE_FAMILIES.has(projectile.family)
  );
}

function finitePositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function shapePowerBonus(shape: unknown) {
  switch (shape) {
    case "ground_aoe":
    case "self_aoe":
      return HARTHMERE_MAGIC_CHARGE_POWER_TUNING.areaBonus;
    case "cone":
      return HARTHMERE_MAGIC_CHARGE_POWER_TUNING.coneBonus;
    case "beam":
      return HARTHMERE_MAGIC_CHARGE_POWER_TUNING.beamBonus;
    default:
      return 0;
  }
}

export function harthmereMagicChargePower(input: {
  attackDamage?: number;
  resourceCost?: number;
  cooldownSecs?: number;
  attackShape?: unknown;
  ultimate?: boolean;
}) {
  if (input.ultimate) {
    return 1;
  }
  const score = Math.max(
    finitePositive(input.attackDamage) /
      HARTHMERE_MAGIC_CHARGE_POWER_TUNING.damageCeiling,
    finitePositive(input.resourceCost) /
      HARTHMERE_MAGIC_CHARGE_POWER_TUNING.resourceCeiling,
    finitePositive(input.cooldownSecs) /
      HARTHMERE_MAGIC_CHARGE_POWER_TUNING.cooldownCeilingSecs
  );
  return Math.min(1, Math.max(0, score + shapePowerBonus(input.attackShape)));
}

export function harthmereMagicChargeDurationSecs(input: {
  damageType?: unknown;
  projectileVisualId?: unknown;
  explicitMagic?: boolean;
  attackDamage?: number;
  resourceCost?: number;
  cooldownSecs?: number;
  attackShape?: unknown;
  ultimate?: boolean;
}) {
  if (!isHarthmereMagicAttack(input)) {
    return 0;
  }
  const power = harthmereMagicChargePower(input);
  const raw =
    HARTHMERE_MAGIC_CHARGE_MIN_SECS +
    (HARTHMERE_MAGIC_CHARGE_MAX_SECS - HARTHMERE_MAGIC_CHARGE_MIN_SECS) * power;
  const quantized =
    Math.round(raw / HARTHMERE_MAGIC_CHARGE_QUANTUM_SECS) *
    HARTHMERE_MAGIC_CHARGE_QUANTUM_SECS;
  return Math.min(
    HARTHMERE_MAGIC_CHARGE_MAX_SECS,
    Math.max(HARTHMERE_MAGIC_CHARGE_MIN_SECS, quantized)
  );
}
