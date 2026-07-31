export const HARTHMERE_ENERGY_WEAPON_VERSION =
  "harthmere-energy-weapons-v1" as const;

export const HARTHMERE_ENERGY_WEAPON_VENDOR_ID =
  "security_defense_contractor" as const;

export type HarthmereEnergyWeaponId =
  | "photon_sidearm"
  | "pulse_carbine"
  | "helix_projector"
  | "nova_cannon"
  | "singularity_lance";

export type HarthmereEnergyProjectileId =
  | "photon_sidearm_pulse"
  | "pulse_carbine_burst"
  | "helix_projector_beam"
  | "nova_cannon_bolt"
  | "singularity_lance_beam";

export type HarthmereEnergyWeaponSpecial =
  | {
      kind: "shield_overheat";
      durationMs: number;
      followupDamageMultiplier: number;
    }
  | {
      kind: "tenth_shot_overcharge";
      shotInterval: number;
      damageMultiplier: number;
    }
  | {
      kind: "energy_burn";
      tickDamage: number;
      tickIntervalMs: number;
      ticks: number;
      penetrationTargets: number;
      penetrationDamageMultiplier: number;
    }
  | {
      kind: "nova";
      impactRadius: number;
      impactDamageMultiplier: number;
      killRadius: number;
      killDamageMultiplier: number;
    }
  | {
      kind: "singularity";
      radius: number;
      explosionDamageMultiplier: number;
      pullStrength: number;
    };

export interface HarthmereEnergyWeaponDefinition {
  id: HarthmereEnergyWeaponId;
  projectileId: HarthmereEnergyProjectileId;
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  role: string;
  description: string;
  baseDamage: number;
  effectiveRange: number;
  hardMaxRange: number;
  minimumDamageMultiplier: number;
  beyondRangeDamageMultiplier: number;
  cooldownMs: number;
  armorPenetration: number;
  priceGold: number;
  requiredLevel: number;
  quality: "uncommon" | "rare" | "epic" | "legendary";
  targetLength: number;
  twoHanded: boolean;
  primaryColor: number;
  secondaryColor: number;
  fireSoundId: string;
  impactSoundId: string;
  specialSoundId: string;
  special: HarthmereEnergyWeaponSpecial;
}

const energyWeapon = (
  definition: HarthmereEnergyWeaponDefinition
): HarthmereEnergyWeaponDefinition => definition;

/**
 * Security & Defense Contractor exclusives. Energy is infinite: these entries
 * never consume ammunition, mana, or durability. The increasing trigger
 * cooldown is the balancing resource and is enforced from the selected native
 * ECS hotbar item on the server.
 */
export const HARTHMERE_ENERGY_WEAPONS = [
  energyWeapon({
    id: "photon_sidearm",
    projectileId: "photon_sidearm_pulse",
    tier: 1,
    label: "Photon Sidearm",
    role: "Starter precision sidearm",
    description:
      "A compact security sidearm firing coherent blue photon pulses. Critical hits briefly overheat shield systems.",
    baseDamage: 12,
    effectiveRange: 15,
    hardMaxRange: 19,
    minimumDamageMultiplier: 0.35,
    beyondRangeDamageMultiplier: 0.3,
    cooldownMs: 5_320,
    armorPenetration: 0.05,
    priceGold: 5_000,
    requiredLevel: 1,
    quality: "uncommon",
    targetLength: 0.82,
    twoHanded: false,
    primaryColor: 0x3b8cff,
    secondaryColor: 0xd8f4ff,
    fireSoundId: "photon_sidearm_pulse_launch",
    impactSoundId: "photon_sidearm_pulse_impact",
    specialSoundId: "photon_shield_overheat",
    special: {
      kind: "shield_overheat",
      durationMs: 2_500,
      followupDamageMultiplier: 1.15,
    },
  }),
  energyWeapon({
    id: "pulse_carbine",
    projectileId: "pulse_carbine_burst",
    tier: 2,
    label: "Pulse Carbine",
    role: "Burst-fire service rifle",
    description:
      "A cyan compressed-energy carbine. Each trigger launches a rapid three-pulse visual burst; every tenth accepted shot is overcharged.",
    baseDamage: 24,
    effectiveRange: 22,
    hardMaxRange: 28,
    minimumDamageMultiplier: 0.4,
    beyondRangeDamageMultiplier: 0.3,
    cooldownMs: 5_500,
    armorPenetration: 0.2,
    priceGold: 12_500,
    requiredLevel: 8,
    quality: "rare",
    targetLength: 1.18,
    twoHanded: true,
    primaryColor: 0x42e8ff,
    secondaryColor: 0xe3ffff,
    fireSoundId: "pulse_carbine_burst_launch",
    impactSoundId: "pulse_carbine_burst_impact",
    specialSoundId: "pulse_carbine_overcharge",
    special: {
      kind: "tenth_shot_overcharge",
      shotInterval: 10,
      damageMultiplier: 1.5,
    },
  }),
  energyWeapon({
    id: "helix_projector",
    projectileId: "helix_projector_beam",
    tier: 3,
    label: "Helix Projector",
    role: "Armor-piercing heavy rifle",
    description:
      "Twin rotating emitters braid a green helix beam that can pass through one target and leaves a sustained Energy Burn.",
    baseDamage: 45,
    effectiveRange: 30,
    hardMaxRange: 38,
    minimumDamageMultiplier: 0.45,
    beyondRangeDamageMultiplier: 0.3,
    cooldownMs: 5_950,
    armorPenetration: 0.45,
    priceGold: 30_000,
    requiredLevel: 18,
    quality: "epic",
    targetLength: 1.45,
    twoHanded: true,
    primaryColor: 0x5cff78,
    secondaryColor: 0xe4ffb0,
    fireSoundId: "helix_projector_beam_launch",
    impactSoundId: "helix_projector_beam_impact",
    specialSoundId: "helix_energy_burn",
    special: {
      kind: "energy_burn",
      tickDamage: 6,
      tickIntervalMs: 900,
      ticks: 4,
      penetrationTargets: 1,
      penetrationDamageMultiplier: 0.65,
    },
  }),
  energyWeapon({
    id: "nova_cannon",
    projectileId: "nova_cannon_bolt",
    tier: 4,
    label: "Nova Cannon",
    role: "Plasma-laser siege weapon",
    description:
      "A slow orange plasma-laser cannon with impact splash. Defeated targets collapse into a damaging miniature nova.",
    baseDamage: 80,
    effectiveRange: 40,
    hardMaxRange: 50,
    minimumDamageMultiplier: 0.5,
    beyondRangeDamageMultiplier: 0.3,
    cooldownMs: 6_800,
    armorPenetration: 0.7,
    priceGold: 75_000,
    requiredLevel: 30,
    quality: "legendary",
    targetLength: 1.68,
    twoHanded: true,
    primaryColor: 0xff7a21,
    secondaryColor: 0xffef9c,
    fireSoundId: "nova_cannon_bolt_launch",
    impactSoundId: "nova_cannon_bolt_impact",
    specialSoundId: "nova_cannon_mini_nova",
    special: {
      kind: "nova",
      impactRadius: 3.5,
      impactDamageMultiplier: 0.3,
      killRadius: 5,
      killDamageMultiplier: 0.5,
    },
  }),
  energyWeapon({
    id: "singularity_lance",
    projectileId: "singularity_lance_beam",
    tier: 5,
    label: "Singularity Lance",
    role: "Experimental endgame super weapon",
    description:
      "A white-violet lance powered by a contained artificial singularity. Every server-accepted shot represents a fully charged release that pulls nearby enemies inward before detonation.",
    baseDamage: 140,
    effectiveRange: 55,
    hardMaxRange: 68,
    minimumDamageMultiplier: 0.6,
    beyondRangeDamageMultiplier: 0.3,
    cooldownMs: 8_400,
    armorPenetration: 0.95,
    priceGold: 180_000,
    requiredLevel: 45,
    quality: "legendary",
    targetLength: 1.92,
    twoHanded: true,
    primaryColor: 0xffffff,
    secondaryColor: 0x8d4dff,
    fireSoundId: "singularity_lance_beam_launch",
    impactSoundId: "singularity_lance_beam_impact",
    specialSoundId: "singularity_gravity_collapse",
    special: {
      kind: "singularity",
      radius: 6,
      explosionDamageMultiplier: 0.55,
      pullStrength: 16,
    },
  }),
] as const satisfies readonly HarthmereEnergyWeaponDefinition[];

const energyWeaponById = new Map(
  HARTHMERE_ENERGY_WEAPONS.map((definition) => [definition.id, definition])
);

export function getHarthmereEnergyWeapon(
  value: unknown
): HarthmereEnergyWeaponDefinition | undefined {
  return energyWeaponById.get(
    String(value ?? "")
      .trim()
      .toLowerCase() as HarthmereEnergyWeaponId
  );
}

export function isHarthmereEnergyWeaponId(
  value: unknown
): value is HarthmereEnergyWeaponId {
  return getHarthmereEnergyWeapon(value) !== undefined;
}

export function harthmereEnergyWeaponDamageMultiplier(
  weapon: HarthmereEnergyWeaponDefinition,
  distance: number
) {
  const safeDistance = Math.max(0, Number(distance) || 0);
  if (safeDistance <= weapon.effectiveRange) {
    const normalized = safeDistance / weapon.effectiveRange;
    return Math.max(
      weapon.minimumDamageMultiplier,
      1 - (1 - weapon.minimumDamageMultiplier) * Math.pow(normalized, 1.8)
    );
  }
  if (safeDistance >= weapon.hardMaxRange) {
    return weapon.beyondRangeDamageMultiplier;
  }
  const overreach =
    (safeDistance - weapon.effectiveRange) /
    (weapon.hardMaxRange - weapon.effectiveRange);
  return (
    weapon.minimumDamageMultiplier +
    (weapon.beyondRangeDamageMultiplier - weapon.minimumDamageMultiplier) *
      overreach
  );
}

export function harthmereEnergyWeaponDamageAtDistance(
  weapon: HarthmereEnergyWeaponDefinition,
  distance: number,
  multiplier = 1
) {
  return Math.max(
    1,
    Math.round(
      weapon.baseDamage *
        harthmereEnergyWeaponDamageMultiplier(weapon, distance) *
        Math.max(0, multiplier)
    )
  );
}

export function harthmereEnergyWeaponSecondaryRadius(
  weapon: HarthmereEnergyWeaponDefinition
) {
  switch (weapon.special.kind) {
    case "nova":
      return Math.max(weapon.special.impactRadius, weapon.special.killRadius);
    case "singularity":
      return weapon.special.radius;
    case "energy_burn":
      return 2.25;
    default:
      return 0;
  }
}

export function validateHarthmereEnergyWeaponCatalog() {
  const errors: string[] = [];
  for (let index = 0; index < HARTHMERE_ENERGY_WEAPONS.length; index += 1) {
    const weapon = HARTHMERE_ENERGY_WEAPONS[index];
    const previous = HARTHMERE_ENERGY_WEAPONS[index - 1];
    if (weapon.tier !== index + 1) errors.push(`${weapon.id}:tier_order`);
    if (weapon.priceGold < 5_000) errors.push(`${weapon.id}:price`);
    if (weapon.hardMaxRange <= weapon.effectiveRange) {
      errors.push(`${weapon.id}:hard_range`);
    }
    if (
      weapon.minimumDamageMultiplier <= 0 ||
      weapon.minimumDamageMultiplier > 1
    ) {
      errors.push(`${weapon.id}:minimum_damage`);
    }
    if (previous && weapon.cooldownMs <= previous.cooldownMs) {
      errors.push(`${weapon.id}:cooldown_not_increasing`);
    }
    if (previous && weapon.baseDamage <= previous.baseDamage) {
      errors.push(`${weapon.id}:damage_not_increasing`);
    }
    if (previous && weapon.armorPenetration <= previous.armorPenetration) {
      errors.push(`${weapon.id}:penetration_not_increasing`);
    }
  }
  return errors;
}
