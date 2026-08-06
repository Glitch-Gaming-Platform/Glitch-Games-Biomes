export const HARTHMERE_PROJECTILE_VISUAL_VERSION =
  "harthmere-premium-projectiles-v3" as const;

export const HARTHMERE_PROJECTILE_VISUAL_EVENT =
  "biomes:harthmere-projectile-visual" as const;

// Projectiles need enough screen time to communicate direction and give a
// moving target a readable reaction cue. Native hostile attacks can provide an
// authoritative impact time; player/test shots fall back to distance / speed.
export const HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS = 0.4;
export const HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS = 1.8;
export const HARTHMERE_AUTHORITATIVE_IMPACT_EPSILON_SECS = 1 / 240;

export function harthmereAuthoritativeImpactRemainingSecs(input: {
  releaseTime: number;
  impactDelaySecs: number;
  now: number;
}) {
  const releaseTime = Number(input.releaseTime);
  const impactDelaySecs = Number(input.impactDelaySecs);
  const now = Number(input.now);
  if (
    !Number.isFinite(releaseTime) ||
    !Number.isFinite(impactDelaySecs) ||
    !Number.isFinite(now)
  ) {
    return undefined;
  }
  return Math.max(0, releaseTime + Math.max(0, impactDelaySecs) - now);
}

export function harthmereProjectileFlightDurationSecs(input: {
  distanceMeters: number;
  speedMetersPerSecond: number;
  authoritativeImpactSecs?: number;
}) {
  const distance = Number.isFinite(input.distanceMeters)
    ? Math.max(0, input.distanceMeters)
    : 0;
  const speed = Number.isFinite(input.speedMetersPerSecond)
    ? Math.max(0.01, input.speedMetersPerSecond)
    : 0.01;
  const authoritativeImpactSecs = Number(input.authoritativeImpactSecs);
  if (
    Number.isFinite(authoritativeImpactSecs) &&
    authoritativeImpactSecs >= 0
  ) {
    // The authoritative value is the impact time *remaining* measured against
    // the client's clock at the moment it observes the release. Anima tick
    // latency, npc_state serialization, and Sync replication have already
    // consumed part of the authored flight before this runs, so under load the
    // remainder trends toward zero.
    //
    // Clamping only to the frame epsilon meant a laggy session rendered the
    // projectile for a single frame and then dealt damage, which is precisely
    // the case where the player needs the most warning. The readability floor
    // therefore applies to BOTH branches: a projectile that lands slightly
    // after its authoritative impact is a cosmetic desync, while a 4 ms
    // projectile is an unreadable mechanic. Damage stays server-resolved from
    // the receipt either way, so the visual is free to under-run it.
    return Math.min(
      HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
      Math.max(HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS, authoritativeImpactSecs)
    );
  }
  const rawDuration = distance / speed;
  return Math.min(
    HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
    Math.max(HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS, rawDuration)
  );
}

export type HarthmereProjectileFamily =
  | "physical"
  | "arcane"
  | "fire"
  | "lightning"
  | "holy"
  | "dark"
  | "nature"
  | "sonic"
  | "mark"
  | "hex"
  | "boss"
  | "energy"
  | "gravity";

export interface HarthmereProjectileVisualDefinition {
  id: string;
  label: string;
  family: HarthmereProjectileFamily;
  assetUrl: string;
  previewUrl: string;
  speed: number;
  scale: number;
  arcHeight: number;
  spinRadiansPerSecond: number;
  impactRadius: number;
  primaryColor: number;
  secondaryColor: number;
  lightIntensity: number;
  aliases: readonly string[];
}

const projectile = (
  definition: Omit<
    HarthmereProjectileVisualDefinition,
    "assetUrl" | "previewUrl"
  >
): HarthmereProjectileVisualDefinition => ({
  ...definition,
  assetUrl: `/assets/harthmere/glb/projectiles/${definition.id}.glb`,
  previewUrl: `/assets/harthmere/projectile_previews/${definition.id}.png`,
});

export const HARTHMERE_PROJECTILE_VISUALS = [
  projectile({
    id: "hunter_bow_shot",
    label: "Hunter Bow Shot",
    family: "physical",
    speed: 26,
    scale: 0.95,
    arcHeight: 0.12,
    spinRadiansPerSecond: 1,
    impactRadius: 0.5,
    primaryColor: 0xe7f4e4,
    secondaryColor: 0x62d6a4,
    lightIntensity: 1.4,
    aliases: [
      "hunter_bow",
      "wooden_bow",
      "golden_bow",
      "strung_bow",
      "bow",
      "basic_ranged",
    ],
  }),
  projectile({
    id: "quick_shot",
    label: "Quick Shot",
    family: "physical",
    speed: 32,
    scale: 0.82,
    arcHeight: 0.05,
    spinRadiansPerSecond: 1.5,
    impactRadius: 0.45,
    primaryColor: 0xbfe8ff,
    secondaryColor: 0x45a7ff,
    lightIntensity: 1.7,
    aliases: [],
  }),
  projectile({
    id: "aimed_shot",
    label: "Aimed Shot",
    family: "physical",
    speed: 36,
    scale: 1.12,
    arcHeight: 0.02,
    spinRadiansPerSecond: 0.4,
    impactRadius: 0.72,
    primaryColor: 0xfff0a5,
    secondaryColor: 0xffb62e,
    lightIntensity: 2.1,
    aliases: [],
  }),
  projectile({
    id: "multi_shot",
    label: "Multi-Shot",
    family: "physical",
    speed: 27,
    scale: 0.9,
    arcHeight: 0.16,
    spinRadiansPerSecond: 1.2,
    impactRadius: 0.75,
    primaryColor: 0xe0ffc2,
    secondaryColor: 0x72d84e,
    lightIntensity: 1.8,
    aliases: [],
  }),
  projectile({
    id: "bandit_archer_shot",
    label: "Bandit Hedge Archer Shot",
    family: "physical",
    speed: 22,
    scale: 0.9,
    arcHeight: 0.2,
    spinRadiansPerSecond: 2.2,
    impactRadius: 0.52,
    primaryColor: 0xd8c6a2,
    secondaryColor: 0xa94b32,
    lightIntensity: 1,
    aliases: ["bandit_hedge_archer", "npc_archer_shot"],
  }),
  projectile({
    id: "ranged_shot",
    label: "Ranged Shot",
    family: "physical",
    speed: 26,
    scale: 0.9,
    arcHeight: 0.12,
    spinRadiansPerSecond: 1.5,
    impactRadius: 0.5,
    primaryColor: 0xbfe8ff,
    secondaryColor: 0x45a7ff,
    lightIntensity: 1.5,
    aliases: [
      "one_handed_crossbow",
      "two_handed_crossbow",
      "steel_dart",
      "golden_dart",
      "crossbow_1handed",
      "crossbow_2handed",
    ],
  }),
  {
    id: "smoke_bomb_throw",
    label: "Smoke Bomb Throw",
    family: "dark",
    assetUrl: "/assets/harthmere/glb/weapons/smoke_bomb.glb",
    previewUrl: "/assets/harthmere/weapon_previews/smoke_bomb.png",
    speed: 16,
    scale: 0.62,
    arcHeight: 0.82,
    spinRadiansPerSecond: 5.5,
    impactRadius: 1.8,
    primaryColor: 0xffc76b,
    secondaryColor: 0x4b5362,
    lightIntensity: 1.15,
    aliases: ["smoke_bomb", "smokebomb"],
  },
  projectile({
    id: "spark",
    label: "Spark",
    family: "arcane",
    speed: 22,
    scale: 0.88,
    arcHeight: 0.15,
    spinRadiansPerSecond: 7.5,
    impactRadius: 0.8,
    primaryColor: 0xd9f7ff,
    secondaryColor: 0x7e68ff,
    lightIntensity: 3.2,
    aliases: [
      "spark_rank_1",
      "arcane_staff",
      "arcane_wand",
      "arcane_spellbook_closed",
      "arcane_spellbook_open",
      "sealed_scroll",
      "crystal_focus",
      "star_focus",
      "snowflake_focus",
    ],
  }),
  projectile({
    id: "photon_sidearm_pulse",
    label: "Photon Sidearm Pulse",
    family: "energy",
    speed: 50,
    scale: 0.72,
    arcHeight: 0,
    spinRadiansPerSecond: 0,
    impactRadius: 0.52,
    primaryColor: 0xd8f4ff,
    secondaryColor: 0x3b8cff,
    lightIntensity: 3.2,
    aliases: ["photon_sidearm", "energy_weapon_tier_1"],
  }),
  projectile({
    id: "pulse_carbine_burst",
    label: "Pulse Carbine Burst",
    family: "energy",
    speed: 48,
    scale: 0.84,
    arcHeight: 0.02,
    spinRadiansPerSecond: 2.5,
    impactRadius: 0.68,
    primaryColor: 0xe3ffff,
    secondaryColor: 0x42e8ff,
    lightIntensity: 3.8,
    aliases: ["pulse_carbine", "energy_weapon_tier_2"],
  }),
  projectile({
    id: "helix_projector_beam",
    label: "Helix Projector Beam",
    family: "energy",
    speed: 44,
    scale: 1.05,
    arcHeight: 0,
    spinRadiansPerSecond: 10,
    impactRadius: 0.9,
    primaryColor: 0xe4ffb0,
    secondaryColor: 0x5cff78,
    lightIntensity: 4.4,
    aliases: ["helix_projector", "energy_weapon_tier_3"],
  }),
  projectile({
    id: "nova_cannon_bolt",
    label: "Nova Cannon Bolt",
    family: "energy",
    speed: 28,
    scale: 1.52,
    arcHeight: 0.12,
    spinRadiansPerSecond: 4,
    impactRadius: 3.5,
    primaryColor: 0xffef9c,
    secondaryColor: 0xff7a21,
    lightIntensity: 5.2,
    aliases: ["nova_cannon", "energy_weapon_tier_4"],
  }),
  projectile({
    id: "singularity_lance_beam",
    label: "Singularity Lance Beam",
    family: "gravity",
    speed: 58,
    scale: 1.72,
    arcHeight: 0,
    spinRadiansPerSecond: 7,
    impactRadius: 6,
    primaryColor: 0xffffff,
    secondaryColor: 0x8d4dff,
    lightIntensity: 6,
    aliases: ["singularity_lance", "energy_weapon_tier_5"],
  }),
  projectile({
    id: "fireball",
    label: "Fireball",
    family: "fire",
    speed: 17,
    scale: 1.18,
    arcHeight: 0.34,
    spinRadiansPerSecond: 4.4,
    impactRadius: 1.55,
    primaryColor: 0xfff3b0,
    secondaryColor: 0xff6a16,
    lightIntensity: 4.4,
    aliases: ["npc_fireball"],
  }),
  projectile({
    id: "meteor",
    label: "Meteor",
    family: "fire",
    speed: 20,
    scale: 1.65,
    arcHeight: 3.8,
    spinRadiansPerSecond: 2.2,
    impactRadius: 2.8,
    primaryColor: 0xffe9a3,
    secondaryColor: 0xff3d12,
    lightIntensity: 5.4,
    aliases: [],
  }),
  projectile({
    id: "lightning_bolt",
    label: "Lightning Bolt",
    family: "lightning",
    speed: 40,
    scale: 1,
    arcHeight: 0,
    spinRadiansPerSecond: 9,
    impactRadius: 1.1,
    primaryColor: 0xe8ffff,
    secondaryColor: 0x44bfff,
    lightIntensity: 5,
    aliases: ["lightning"],
  }),
  projectile({
    id: "holy_light",
    label: "Holy Light",
    family: "holy",
    speed: 28,
    scale: 1.06,
    arcHeight: 0.1,
    spinRadiansPerSecond: 3,
    impactRadius: 1.3,
    primaryColor: 0xfff9d6,
    secondaryColor: 0xffd447,
    lightIntensity: 4.2,
    aliases: ["holy_light_enemy"],
  }),
  projectile({
    id: "smite",
    label: "Smite",
    family: "holy",
    speed: 30,
    scale: 1,
    arcHeight: 0.2,
    spinRadiansPerSecond: 5,
    impactRadius: 1.15,
    primaryColor: 0xfff9d6,
    secondaryColor: 0xffd447,
    lightIntensity: 4.3,
    aliases: [],
  }),
  projectile({
    id: "judgment",
    label: "Judgment",
    family: "holy",
    speed: 25,
    scale: 1.15,
    arcHeight: 0.35,
    spinRadiansPerSecond: 4,
    impactRadius: 1.65,
    primaryColor: 0xfff2b2,
    secondaryColor: 0xf18b2b,
    lightIntensity: 4.2,
    aliases: [],
  }),
  projectile({
    id: "consecrate",
    label: "Consecrate",
    family: "holy",
    speed: 19,
    scale: 1.4,
    arcHeight: 0.5,
    spinRadiansPerSecond: 5,
    impactRadius: 2.2,
    primaryColor: 0xfff9d1,
    secondaryColor: 0xe7b73d,
    lightIntensity: 4.2,
    aliases: [],
  }),
  projectile({
    id: "life_drain",
    label: "Life Drain",
    family: "dark",
    speed: 16,
    scale: 1.08,
    arcHeight: 0.18,
    spinRadiansPerSecond: 6.5,
    impactRadius: 1.25,
    primaryColor: 0xff8b9f,
    secondaryColor: 0x8d2c71,
    lightIntensity: 3.8,
    aliases: ["drain"],
  }),
  projectile({
    id: "entangling_roots",
    label: "Entangling Roots",
    family: "nature",
    speed: 18,
    scale: 1.14,
    arcHeight: 0.12,
    spinRadiansPerSecond: 3.5,
    impactRadius: 1.7,
    primaryColor: 0xd7ffb0,
    secondaryColor: 0x52b84a,
    lightIntensity: 2.8,
    aliases: ["root", "npc_root"],
  }),
  projectile({
    id: "indisworm_poison_spit",
    label: "Indisworm Poison Spit",
    family: "nature",
    speed: 15,
    scale: 1,
    arcHeight: 0.55,
    spinRadiansPerSecond: 5.2,
    impactRadius: 0.95,
    primaryColor: 0xdfff72,
    secondaryColor: 0x42c982,
    lightIntensity: 3.2,
    aliases: ["indisworm", "poison_spit", "acid_spit", "venom_spit"],
  }),
  projectile({
    id: "mocking_verse",
    label: "Mocking Verse",
    family: "sonic",
    speed: 21,
    scale: 1,
    arcHeight: 0.28,
    spinRadiansPerSecond: 5,
    impactRadius: 1.3,
    primaryColor: 0xffd8ff,
    secondaryColor: 0xc54dff,
    lightIntensity: 3.6,
    aliases: ["sonic_verse"],
  }),
  projectile({
    id: "curse_of_weakness",
    label: "Curse of Weakness",
    family: "dark",
    speed: 18,
    scale: 1,
    arcHeight: 0.22,
    spinRadiansPerSecond: 5.5,
    impactRadius: 1.4,
    primaryColor: 0xd69bff,
    secondaryColor: 0x6d36c9,
    lightIntensity: 3.6,
    aliases: ["curse"],
  }),
  projectile({
    id: "hunters_mark",
    label: "Hunter's Mark",
    family: "mark",
    speed: 32,
    scale: 0.92,
    arcHeight: 0,
    spinRadiansPerSecond: 3,
    impactRadius: 0.9,
    primaryColor: 0xffe0d2,
    secondaryColor: 0xff4d3d,
    lightIntensity: 2.6,
    aliases: ["hunter_mark"],
  }),
  projectile({
    id: "polymorph",
    label: "Polymorph",
    family: "arcane",
    speed: 20,
    scale: 1.08,
    arcHeight: 0.32,
    spinRadiansPerSecond: 6,
    impactRadius: 1.45,
    primaryColor: 0xd9fff5,
    secondaryColor: 0x52d9c2,
    lightIntensity: 3.4,
    aliases: [],
  }),
  projectile({
    id: "fear",
    label: "Fear",
    family: "dark",
    speed: 18,
    scale: 1.12,
    arcHeight: 0.42,
    spinRadiansPerSecond: 4.4,
    impactRadius: 1.55,
    primaryColor: 0xcda8ff,
    secondaryColor: 0x6936a8,
    lightIntensity: 3.4,
    aliases: [],
  }),
  projectile({
    id: "charm",
    label: "Charm",
    family: "arcane",
    speed: 19,
    scale: 1.08,
    arcHeight: 0.45,
    spinRadiansPerSecond: 4.8,
    impactRadius: 1.4,
    primaryColor: 0xffd5e8,
    secondaryColor: 0xff4b9c,
    lightIntensity: 3.5,
    aliases: [],
  }),
  projectile({
    id: "hex_bolt",
    label: "Hex Caster Bolt",
    family: "hex",
    speed: 18,
    scale: 1.08,
    arcHeight: 0.28,
    spinRadiansPerSecond: 7,
    impactRadius: 1.35,
    primaryColor: 0xdfff8f,
    secondaryColor: 0x9b50ff,
    lightIntensity: 4.2,
    aliases: ["hex", "hexer", "hex_caster_attack", "hex_swipe"],
  }),
  projectile({
    id: "thaedryn_resonance",
    label: "Thaedryn Resonance Shard",
    family: "boss",
    speed: 16,
    scale: 1.55,
    arcHeight: 0.7,
    spinRadiansPerSecond: 5.5,
    impactRadius: 2.5,
    primaryColor: 0xffe6a1,
    secondaryColor: 0xff9e2f,
    lightIntensity: 5.2,
    aliases: ["thaedryn", "thaedryn_boss_attack"],
  }),
] as const satisfies readonly HarthmereProjectileVisualDefinition[];

export function normalizeHarthmereProjectileKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const projectileByKey = new Map<string, HarthmereProjectileVisualDefinition>();

for (const definition of HARTHMERE_PROJECTILE_VISUALS) {
  for (const key of [definition.id, definition.label, ...definition.aliases]) {
    projectileByKey.set(normalizeHarthmereProjectileKey(key), definition);
  }
}

export function getHarthmereProjectileVisual(value: unknown) {
  return projectileByKey.get(normalizeHarthmereProjectileKey(value));
}

export function resolveHarthmereProjectileVisual(input: {
  projectileVisualId?: unknown;
  abilityId?: unknown;
  ability?: unknown;
  attack?: unknown;
  attackType?: unknown;
  action?: unknown;
  itemId?: unknown;
  attacker?: unknown;
  detail?: unknown;
}) {
  for (const value of [
    input.projectileVisualId,
    input.abilityId,
    input.ability,
    input.attack,
    input.attackType,
    input.action,
    input.itemId,
  ]) {
    const exact = getHarthmereProjectileVisual(value);
    if (exact) return exact;
  }

  const text = [input.attacker, input.ability, input.attack, input.detail]
    .map(normalizeHarthmereProjectileKey)
    .filter(Boolean)
    .join("_");
  if (/thaedryn/.test(text)) return getHarthmereProjectileVisual("thaedryn");
  if (/bandit.*archer|hedge_archer/.test(text))
    return getHarthmereProjectileVisual("bandit_archer_shot");
  if (/indisworm|poison_spit|acid_spit|venom_spit/.test(text))
    return getHarthmereProjectileVisual("indisworm_poison_spit");
  if (/hex|hexer/.test(text)) return getHarthmereProjectileVisual("hex_bolt");
  if (/fireball/.test(text)) return getHarthmereProjectileVisual("fireball");
  if (/entangling.*root|\broot\b/.test(text))
    return getHarthmereProjectileVisual("entangling_roots");
  if (/bow|crossbow|arrow|ranged_shot/.test(text))
    return getHarthmereProjectileVisual("hunter_bow_shot");
  return undefined;
}

export function harthmereNativeNpcProjectileVisualId(input: {
  key?: unknown;
  displayName?: unknown;
  combatKind?: unknown;
  banditRole?: unknown;
}) {
  const text = [
    input.key,
    input.displayName,
    input.combatKind,
    input.banditRole,
  ]
    .map(normalizeHarthmereProjectileKey)
    .filter(Boolean)
    .join("_");
  if (/thaedryn/.test(text)) return "thaedryn_resonance";
  if (/bandit.*archer|archer.*bandit/.test(text)) {
    return "bandit_archer_shot";
  }
  if (/indisworm/.test(text)) return "indisworm_poison_spit";
  if (/hex|hexer/.test(text)) return "hex_bolt";
  return undefined;
}

export const HARTHMERE_DIRECT_RANGED_ATTACK_VISUAL_IDS = [
  "hunter_bow_shot",
  "quick_shot",
  "aimed_shot",
  "multi_shot",
  "smoke_bomb_throw",
  "spark",
  "photon_sidearm_pulse",
  "pulse_carbine_burst",
  "helix_projector_beam",
  "nova_cannon_bolt",
  "singularity_lance_beam",
  "fireball",
  "meteor",
  "lightning_bolt",
  "holy_light",
  "smite",
  "judgment",
  "consecrate",
  "life_drain",
  "entangling_roots",
  "indisworm_poison_spit",
  "mocking_verse",
  "curse_of_weakness",
] as const;

/**
 * Gaia owns authoritative terrain simulation, not transient combat graphics.
 * None of the current Harthmere projectiles changes terrain, so impacts stay
 * client-side and this explicit policy remains empty. Add an id here only when
 * the matching attack gains a server-authoritative terrain mutation.
 */
export const HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS = [] as const;
