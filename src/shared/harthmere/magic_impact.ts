import { isHarthmereMagicAttack } from "@/shared/harthmere/magic_charge";
import type { HarthmereProjectileFamily } from "@/shared/harthmere/projectile_visual_manifest";

export const HARTHMERE_MAGIC_IMPACT_VERSION =
  "harthmere-aaa-magic-impact-v2" as const;

// These exported limits are the single balancing/performance contract shared
// by the renderer, unit tests, and browser audit. The renderer uses instancing,
// so each particle category remains one draw call even at the upper bounds.
export const HARTHMERE_MAGIC_IMPACT_MIN_DURATION_SECS = 0.95;
export const HARTHMERE_MAGIC_IMPACT_MAX_DURATION_SECS = 1.8;
export const HARTHMERE_MAGIC_IMPACT_FLASH_DURATION_SECS = 0.08;
export const HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS = 28;
export const HARTHMERE_MAGIC_IMPACT_MAX_SPARKS = 30;
export const HARTHMERE_MAGIC_IMPACT_MAX_MIST = 12;
export const HARTHMERE_MAGIC_IMPACT_MAX_DUST = 12;

const MISS_RESULTS = /miss|dodge|evade|out_of_range/i;

export type HarthmereMagicImpactSilhouette =
  | "prism"
  | "eruption"
  | "crackle"
  | "pillar"
  | "implosion"
  | "root_burst"
  | "wave"
  | "reticle"
  | "smoke_bloom"
  | "singularity"
  | "cataclysm";

export interface HarthmereMagicImpactProfile {
  readonly version: typeof HARTHMERE_MAGIC_IMPACT_VERSION;
  readonly family: HarthmereProjectileFamily;
  readonly durationSecs: number;
  readonly flashDurationSecs: number;
  readonly radius: number;
  readonly power: number;
  readonly silhouette: HarthmereMagicImpactSilhouette;
  readonly coreStretch: readonly [number, number, number];
  readonly ringSpread: number;
  readonly implosion: boolean;
  readonly ringCount: number;
  readonly debrisCount: number;
  readonly sparkCount: number;
  readonly mistCount: number;
  readonly dustCount: number;
  readonly debrisSpeed: number;
  readonly sparkSpeed: number;
  readonly upwardBias: number;
  readonly directionalBias: number;
  readonly gravity: number;
  readonly lightIntensity: number;
  readonly cameraStrength: number;
}

export function harthmereEffectiveMagicImpactFamily(
  family: HarthmereProjectileFamily,
  damageType: unknown
): HarthmereProjectileFamily {
  if (family !== "physical" && family !== "energy") return family;
  switch (String(damageType ?? "").toLowerCase()) {
    case "fire":
    case "lightning":
    case "holy":
    case "dark":
    case "nature":
    case "sonic":
    case "gravity":
      return String(damageType).toLowerCase() as HarthmereProjectileFamily;
    case "arcane":
    case "ice":
      return "arcane";
    default:
      return family;
  }
}

type FamilyTuning = Pick<
  HarthmereMagicImpactProfile,
  | "ringCount"
  | "silhouette"
  | "coreStretch"
  | "ringSpread"
  | "implosion"
  | "debrisCount"
  | "sparkCount"
  | "mistCount"
  | "dustCount"
  | "debrisSpeed"
  | "sparkSpeed"
  | "upwardBias"
  | "directionalBias"
  | "gravity"
  | "cameraStrength"
>;

const DEFAULT_TUNING: FamilyTuning = {
  silhouette: "prism",
  coreStretch: [1, 1, 1],
  ringSpread: 1,
  implosion: false,
  ringCount: 3,
  debrisCount: 20,
  sparkCount: 22,
  mistCount: 8,
  dustCount: 8,
  debrisSpeed: 3.2,
  sparkSpeed: 6.2,
  upwardBias: 0.35,
  directionalBias: 0.42,
  gravity: 4.4,
  cameraStrength: 0.72,
};

const FAMILY_TUNING: Partial<
  Record<HarthmereProjectileFamily, Partial<FamilyTuning>>
> = {
  fire: {
    silhouette: "eruption",
    coreStretch: [1, 1.55, 1],
    ringSpread: 1.08,
    debrisCount: 22,
    sparkCount: 28,
    mistCount: 10,
    debrisSpeed: 3.5,
    sparkSpeed: 7,
    upwardBias: 0.68,
    gravity: 4,
  },
  lightning: {
    silhouette: "crackle",
    coreStretch: [1.55, 0.62, 1.55],
    ringSpread: 1.22,
    ringCount: 3,
    debrisCount: 16,
    sparkCount: 30,
    mistCount: 6,
    dustCount: 6,
    sparkSpeed: 8.4,
    upwardBias: 0.12,
    gravity: 2.2,
  },
  holy: {
    silhouette: "pillar",
    coreStretch: [0.72, 1.8, 0.72],
    ringSpread: 0.92,
    ringCount: 3,
    debrisCount: 18,
    sparkCount: 24,
    mistCount: 8,
    dustCount: 6,
    upwardBias: 0.82,
    directionalBias: 0.3,
    gravity: 3.2,
  },
  dark: {
    silhouette: "implosion",
    coreStretch: [1.18, 1.05, 1.18],
    ringSpread: 0.86,
    implosion: true,
    debrisCount: 22,
    sparkCount: 20,
    mistCount: 12,
    upwardBias: 0.2,
    directionalBias: 0.5,
    gravity: 3.5,
  },
  hex: {
    silhouette: "implosion",
    coreStretch: [1.12, 1.12, 1.12],
    ringSpread: 0.92,
    implosion: true,
    ringCount: 3,
    debrisCount: 22,
    sparkCount: 22,
    mistCount: 12,
    upwardBias: 0.24,
    directionalBias: 0.5,
    gravity: 3.4,
  },
  gravity: {
    silhouette: "singularity",
    coreStretch: [1.55, 0.58, 1.55],
    ringSpread: 1.3,
    implosion: true,
    ringCount: 4,
    debrisCount: 24,
    sparkCount: 18,
    mistCount: 12,
    debrisSpeed: 2.8,
    upwardBias: 0.05,
    directionalBias: 0.58,
    gravity: 5.4,
    cameraStrength: 0.9,
  },
  nature: {
    silhouette: "root_burst",
    coreStretch: [1.45, 0.52, 1.45],
    ringSpread: 1.16,
    ringCount: 2,
    debrisCount: 26,
    sparkCount: 18,
    mistCount: 10,
    dustCount: 12,
    debrisSpeed: 2.9,
    upwardBias: 0.44,
    gravity: 5.8,
  },
  sonic: {
    silhouette: "wave",
    coreStretch: [1.7, 0.24, 1.7],
    ringSpread: 1.4,
    ringCount: 4,
    debrisCount: 16,
    sparkCount: 22,
    mistCount: 6,
    debrisSpeed: 3.8,
    sparkSpeed: 7.4,
    upwardBias: 0.1,
    directionalBias: 0.66,
    gravity: 2.8,
  },
  mark: {
    silhouette: "reticle",
    coreStretch: [1.4, 0.28, 1.4],
    ringSpread: 1.18,
    ringCount: 3,
    debrisCount: 20,
    sparkCount: 24,
    mistCount: 8,
    directionalBias: 0.5,
  },
  arcane: {
    silhouette: "prism",
    coreStretch: [1.12, 1.12, 1.12],
    ringSpread: 1.05,
    ringCount: 3,
    debrisCount: 22,
    sparkCount: 24,
    mistCount: 8,
    debrisSpeed: 3.4,
    sparkSpeed: 6.8,
  },
  boss: {
    silhouette: "cataclysm",
    coreStretch: [1.4, 1.42, 1.4],
    ringSpread: 1.35,
    ringCount: 4,
    debrisCount: 28,
    sparkCount: 30,
    mistCount: 12,
    dustCount: 12,
    debrisSpeed: 4.2,
    sparkSpeed: 8.5,
    upwardBias: 0.45,
    directionalBias: 0.58,
    gravity: 5.2,
    cameraStrength: 1,
  },
};

const PROJECTILE_TUNING: Partial<Record<string, Partial<FamilyTuning>>> = {
  smoke_bomb_throw: {
    silhouette: "smoke_bloom",
    coreStretch: [1.5, 0.72, 1.5],
    ringSpread: 1.2,
    implosion: false,
    ringCount: 2,
    debrisCount: 16,
    sparkCount: 18,
    mistCount: 12,
    dustCount: 10,
    debrisSpeed: 1.6,
    sparkSpeed: 3.4,
    upwardBias: 0.78,
    directionalBias: 0.18,
    gravity: 1.4,
    cameraStrength: 0.32,
  },
};

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function boundedCount(value: number, maximum: number) {
  return Math.min(maximum, Math.max(1, Math.round(value)));
}

export function isHarthmereSuccessfulImpactResult(result: unknown) {
  return !MISS_RESULTS.test(String(result ?? ""));
}

export function harthmereMagicImpactProfile(input: {
  projectileVisualId: string;
  family: HarthmereProjectileFamily;
  damageType?: unknown;
  result?: unknown;
  impactRadius?: number;
  lightIntensity?: number;
  finalDamage?: number;
}): HarthmereMagicImpactProfile | undefined {
  if (
    !isHarthmereSuccessfulImpactResult(input.result) ||
    !isHarthmereMagicAttack({
      damageType: input.damageType,
      projectileVisualId: input.projectileVisualId,
    })
  ) {
    return undefined;
  }

  const impactRadius = finiteNonNegative(input.impactRadius);
  const finalDamage = finiteNonNegative(input.finalDamage);
  const family = harthmereEffectiveMagicImpactFamily(
    input.family,
    input.damageType
  );
  const power = clamp(Math.max(impactRadius / 6, finalDamage / 150), 0, 1);
  const tuning = {
    ...DEFAULT_TUNING,
    ...FAMILY_TUNING[family],
    ...PROJECTILE_TUNING[input.projectileVisualId],
  };
  const bossDurationBonus = family === "boss" ? 0.18 : 0;

  return {
    version: HARTHMERE_MAGIC_IMPACT_VERSION,
    family,
    durationSecs: clamp(
      1.05 + power * 0.55 + bossDurationBonus,
      HARTHMERE_MAGIC_IMPACT_MIN_DURATION_SECS,
      HARTHMERE_MAGIC_IMPACT_MAX_DURATION_SECS
    ),
    flashDurationSecs: HARTHMERE_MAGIC_IMPACT_FLASH_DURATION_SECS,
    radius: clamp(impactRadius * (1.12 + power * 0.38), 0.72, 10),
    power,
    silhouette: tuning.silhouette,
    coreStretch: tuning.coreStretch,
    ringSpread: tuning.ringSpread,
    implosion: tuning.implosion,
    ringCount: tuning.ringCount,
    debrisCount: boundedCount(
      tuning.debrisCount + power * 4,
      HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS
    ),
    sparkCount: boundedCount(
      tuning.sparkCount + power * 4,
      HARTHMERE_MAGIC_IMPACT_MAX_SPARKS
    ),
    mistCount: boundedCount(
      tuning.mistCount + power * 2,
      HARTHMERE_MAGIC_IMPACT_MAX_MIST
    ),
    dustCount: boundedCount(
      tuning.dustCount + power * 2,
      HARTHMERE_MAGIC_IMPACT_MAX_DUST
    ),
    debrisSpeed: tuning.debrisSpeed * (0.88 + power * 0.34),
    sparkSpeed: tuning.sparkSpeed * (0.9 + power * 0.4),
    upwardBias: tuning.upwardBias,
    directionalBias: tuning.directionalBias,
    gravity: tuning.gravity,
    lightIntensity: clamp(
      finiteNonNegative(input.lightIntensity) * (1.45 + power * 0.75),
      2.4,
      12
    ),
    cameraStrength: clamp(
      tuning.cameraStrength * (0.55 + power * 0.45),
      0.25,
      1
    ),
  };
}
