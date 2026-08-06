// Central authority for Harthmere sublevel benefits.
//
// Character Level owns base attributes. Specialized skills modify only the
// actions they represent, so (for example) Melee Combat cannot accidentally
// increase carry capacity and Nature Magic cannot increase medical salves.

export const HARTHMERE_SUBLEVEL_MAX_LEVEL = 100;
export const HARTHMERE_SUBLEVEL_POTENCY_CAP = 0.25;
export const HARTHMERE_SUBLEVEL_EFFICIENCY_CAP = 0.2;
export const HARTHMERE_SUBLEVEL_YIELD_CAP = 0.2;
export const HARTHMERE_SUBLEVEL_RARE_CHANCE_RELATIVE_CAP = 0.5;
export const HARTHMERE_SUBLEVEL_TRADE_CAP = 0.05;
export const HARTHMERE_SUBLEVEL_LOAN_INTEREST_RELATIVE_CAP = 0.2;
export const HARTHMERE_SUBLEVEL_SUCCESS_CHANCE_CAP = 0.2;

export const HARTHMERE_SUBLEVEL_MILESTONE_LEVELS = Object.freeze([
  5, 10, 20, 35, 50, 75, 100,
]);

export interface HarthmereSublevelMilestone {
  level: number;
  label: string;
}

export interface HarthmereSublevelBenefitDefinition {
  skillId: string;
  improves: readonly string[];
  milestones: readonly HarthmereSublevelMilestone[];
}

const milestones = (...labels: readonly string[]): HarthmereSublevelMilestone[] =>
  HARTHMERE_SUBLEVEL_MILESTONE_LEVELS.map((level, index) => ({
    level,
    label: labels[index] ?? labels[labels.length - 1] ?? "Mastery",
  }));

export const HARTHMERE_SUBLEVEL_BENEFITS: Readonly<
  Record<string, HarthmereSublevelBenefitDefinition>
> = Object.freeze({
  combat: {
    skillId: "combat",
    improves: ["all hostile attack potency", "combat stamina efficiency", "weapon durability efficiency"],
    milestones: milestones("Interrupt", "Dodge Counter", "Combat Recovery", "Threat Control", "Execute", "Veteran Tempo", "Battle Mastery"),
  },
  melee_combat: {
    skillId: "melee_combat",
    improves: ["melee attack potency", "melee stagger", "heavy-attack stamina efficiency"],
    milestones: milestones("Guard Break", "Sweeping Strike", "Melee Recovery", "Counterattack", "Crushing Blow", "Relentless Assault", "Melee Mastery"),
  },
  ranged_combat: {
    skillId: "ranged_combat",
    improves: ["ranged attack potency", "damage falloff", "ranged stamina efficiency"],
    milestones: milestones("Steady Aim", "Quick Ready", "Long Shot", "Mobile Shot", "Piercing Shot", "Deadeye", "Ranged Mastery"),
  },
  shield_mastery: {
    skillId: "shield_mastery",
    improves: ["blocked damage", "guard efficiency", "shield durability"],
    milestones: milestones("Shield Bash", "Firm Guard", "Ally Intercept", "Guard Recovery", "Perfect Block", "Unbroken Line", "Shield Mastery"),
  },
  dagger_mastery: {
    skillId: "dagger_mastery",
    improves: ["dagger attack potency", "backstab potency", "poison application"],
    milestones: milestones("Quick Cut", "Backstab", "Poison Edge", "Shadow Step", "Eviscerate", "Silent Finish", "Dagger Mastery"),
  },
  archery: {
    skillId: "archery",
    improves: ["bow and crossbow potency", "draw and reload efficiency", "ammunition recovery"],
    milestones: milestones("Aimed Shot", "Fletching", "Rapid Draw", "Specialty Arrows", "Pinning Shot", "Eagle Eye", "Archery Mastery"),
  },
  lockpicking: {
    skillId: "lockpicking",
    improves: ["lock attempt speed", "lockpick durability", "trap detection and disarming"],
    milestones: milestones("Simple Locks", "Quiet Entry", "Trap Sense", "Secure Locks", "Preserve Contents", "Master Locks", "Lockpicking Mastery"),
  },
  tracking: {
    skillId: "tracking",
    improves: ["track detection", "track persistence", "hunting information and ambushes"],
    milestones: milestones("Fresh Tracks", "Trail Direction", "Quarry Condition", "Rare Signs", "Predict Route", "Perfect Ambush", "Tracking Mastery"),
  },
  fire_magic: {
    skillId: "fire_magic",
    improves: ["fire spell potency", "burn potency and duration", "fire mana efficiency"],
    milestones: milestones("Kindle", "Controlled Flame", "Lingering Burn", "Fire Ward", "Conflagration", "Living Flame", "Fire Mastery"),
  },
  arcane_literacy: {
    skillId: "arcane_literacy",
    improves: ["rune and ward interactions", "magical identification", "general spell mana efficiency"],
    milestones: milestones("Read Runes", "Identify Magic", "Ward Sense", "Arcane Devices", "Portal Theory", "Master Wards", "Arcane Mastery"),
  },
  holy_magic: {
    skillId: "holy_magic",
    improves: ["holy healing potency", "blessing and ward potency", "cleansing and revival"],
    milestones: milestones("Minor Blessing", "Cleanse", "Protective Light", "Greater Heal", "Revival", "Sanctuary", "Holy Mastery"),
  },
  medicine: {
    skillId: "medicine",
    improves: ["medical-item healing potency", "treatment speed", "revive recovery"],
    milestones: milestones("Bandaging", "Triage", "Efficient Remedies", "Treat Injury", "Field Revival", "Clinical Expert", "Medicine Mastery"),
  },
  death_lore: {
    skillId: "death_lore",
    improves: ["undead weakness knowledge", "spirit communication", "curse diagnosis"],
    milestones: milestones("Identify Undead", "Read Graves", "Spirit Clue", "Curse Diagnosis", "Undead Bane", "Death Secrets", "Death Lore Mastery"),
  },
  shadow_magic: {
    skillId: "shadow_magic",
    improves: ["shadow spell potency", "curse and drain potency", "concealment"],
    milestones: milestones("Minor Curse", "Life Drain", "Shadow Veil", "Deep Weakness", "Terror", "Perfect Concealment", "Shadow Mastery"),
  },
  nature_magic: {
    skillId: "nature_magic",
    improves: ["nature healing potency", "root and regeneration potency", "nature mana efficiency"],
    milestones: milestones("Rejuvenation", "Entangling Roots", "Animal Speech", "Restore Plant", "Greater Regrowth", "Living Sanctuary", "Nature Mastery"),
  },
  farming: {
    skillId: "farming",
    improves: ["crop growth efficiency", "harvest yield", "seed and water efficiency"],
    milestones: milestones("Seed Recovery", "Efficient Watering", "Improved Yield", "Hardy Crops", "Advanced Seeds", "Bountiful Harvest", "Farming Mastery"),
  },
  mining: {
    skillId: "mining",
    improves: ["ore and stone yield", "gem chance", "pickaxe durability"],
    milestones: milestones("Ore Sense", "Efficient Strikes", "Gem Eye", "Hard Deposits", "Rich Veins", "Deep Mining", "Mining Mastery"),
  },
  gathering: {
    skillId: "gathering",
    improves: ["natural-resource yield", "rare-resource chance", "gathering-tool durability"],
    milestones: milestones("Resource Sense", "Careful Harvest", "Efficient Tools", "Rare Signs", "Abundant Nodes", "Pristine Harvest", "Gathering Mastery"),
  },
  cooking: {
    skillId: "cooking",
    improves: ["cooking time", "batch capacity", "food potency and spoil resistance"],
    milestones: milestones("Camp Cook", "Cookpot Recipes", "Efficient Prep", "Oven Recipes", "Feast Cooking", "Master Recipes", "Cooking Mastery"),
  },
  crafting: {
    skillId: "crafting",
    improves: ["general craft time", "craft reliability", "material and tool efficiency"],
    milestones: milestones("Careful Work", "Efficient Tools", "Material Recovery", "Reliable Work", "Fine Craft", "Expert Work", "Crafting Mastery"),
  },
  blacksmithing: {
    skillId: "blacksmithing",
    improves: ["metal-item quality", "forged durability", "metal repair and salvage"],
    milestones: milestones("Smelting", "Ironwork", "Metal Repair", "Advanced Alloys", "Masterwork Steel", "Legendary Forging", "Blacksmithing Mastery"),
  },
  leatherworking: {
    skillId: "leatherworking",
    improves: ["leather-item quality", "leather durability", "hide efficiency"],
    milestones: milestones("Cure Hides", "Leather Gear", "Flexible Armor", "Harnesses", "Fine Leather", "Exotic Hides", "Leatherworking Mastery"),
  },
  carpentry: {
    skillId: "carpentry",
    improves: ["wood-item quality", "structure and repair strength", "wood efficiency"],
    milestones: milestones("Planks", "Furniture", "Structure Repair", "Bowmaking", "Advanced Stations", "Grand Construction", "Carpentry Mastery"),
  },
  tailoring: {
    skillId: "tailoring",
    improves: ["cloth-item quality", "garment durability", "cloth efficiency"],
    milestones: milestones("Weaving", "Travel Clothes", "Light Armor", "Weather Gear", "Fine Garments", "Master Patterns", "Tailoring Mastery"),
  },
  alchemy: {
    skillId: "alchemy",
    improves: ["potion potency and duration", "batch yield", "reagent efficiency"],
    milestones: milestones("Extracts", "Minor Potions", "Antidotes", "Potent Mixtures", "Batch Brewing", "Rare Reagents", "Alchemy Mastery"),
  },
  enchanting: {
    skillId: "enchanting",
    improves: ["enchantment potency", "enchantment stability", "disenchant recovery"],
    milestones: milestones("Identify Enchantment", "Minor Ward", "Stable Imbuing", "Greater Effects", "Additional Charges", "Master Enchantments", "Enchanting Mastery"),
  },
  exotic_refining: {
    skillId: "exotic_refining",
    improves: ["exotic-material yield", "containment safety", "fuel and component stability"],
    milestones: milestones("Containment", "Power Cells", "Portal Fuel", "Stable Matter", "Advanced Cores", "Certified Fuel", "Exotic Refining Mastery"),
  },
  bell_forging: {
    skillId: "bell_forging",
    improves: ["bell quality", "resonance potency and duration", "ritual stability"],
    milestones: milestones("Bell Bronze", "True Tone", "Ritual Bell", "Protective Resonance", "Greater Bell", "Perfect Resonance", "Bell Forging Mastery"),
  },
  fishing: {
    skillId: "fishing",
    improves: ["catch reliability", "fish rarity", "rod and bait efficiency"],
    milestones: milestones("Better Knots", "Bait Sense", "Strong Line", "Deep Water", "Rare Fish", "Perfect Catch", "Fishing Mastery"),
  },
  care: {
    skillId: "care",
    improves: ["animal and garden care", "community contributions", "appropriate gift relationships"],
    milestones: milestones("Daily Routine", "Animal Trust", "Garden Resilience", "Community Steward", "Restorative Care", "Town Guardian", "Care Mastery"),
  },
  persuasion: {
    skillId: "persuasion",
    improves: ["negotiation outcomes", "vendor and contract terms", "loan terms"],
    milestones: milestones("Calm Dispute", "Better Offer", "Contract Flexibility", "Employee Negotiation", "Bank Leverage", "Master Negotiator", "Persuasion Mastery"),
  },
  performance: {
    skillId: "performance",
    improves: ["performance morale potency", "tips and audience", "rumor quality and business foot traffic"],
    milestones: milestones("Practice Piece", "Small Crowd", "Morale Song", "Local Fame", "Grand Performance", "Town Celebrity", "Performance Mastery"),
  },
  business_operations: {
    skillId: "business_operations",
    improves: ["customer patience", "staff and stock efficiency", "contracts, insurance, and business loans"],
    milestones: milestones("Intake Forecast", "Supplier Contract", "Quality Inspection", "Staff Rotation", "Price Tuning", "Emergency Playbook", "Business Mastery"),
  },
});

export const HARTHMERE_SKILL_ID_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    smithing: "blacksmithing",
    logging: "gathering",
    herbalism: "gathering",
    scavenging: "gathering",
    magical_harvesting: "gathering",
    archaeology: "gathering",
    skinning: "gathering",
    monster_harvesting: "gathering",
    foraging: "gathering",
    trading: "business_operations",
    community: "persuasion",
  });

export function normalizeHarthmereSublevelId(skillId: string | undefined) {
  if (!skillId) return undefined;
  return HARTHMERE_SKILL_ID_ALIASES[skillId] ?? skillId;
}

export function boundedHarthmereSublevel(level: unknown) {
  const numeric = Math.trunc(Number(level));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(HARTHMERE_SUBLEVEL_MAX_LEVEL, numeric));
}

export function harthmereSublevelProgress(level: unknown) {
  return (boundedHarthmereSublevel(level) - 1) /
    (HARTHMERE_SUBLEVEL_MAX_LEVEL - 1);
}

export function harthmereSublevelTitle(level: unknown) {
  const bounded = boundedHarthmereSublevel(level);
  return bounded >= 100
    ? "Master"
    : bounded >= 75
      ? "Expert"
      : bounded >= 50
        ? "Adept"
        : bounded >= 25
          ? "Apprentice"
          : "Novice";
}

export function harthmereSublevelPotencyMultiplier(level: unknown) {
  return 1 + HARTHMERE_SUBLEVEL_POTENCY_CAP * harthmereSublevelProgress(level);
}

export function harthmereSublevelEfficiencyMultiplier(level: unknown) {
  return 1 - HARTHMERE_SUBLEVEL_EFFICIENCY_CAP * harthmereSublevelProgress(level);
}

export function harthmereSublevelYieldMultiplier(level: unknown) {
  return 1 + HARTHMERE_SUBLEVEL_YIELD_CAP * harthmereSublevelProgress(level);
}

export function harthmereDeterministicUnitInterval(seed: string | number) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

// Converts a fractional skill yield into an integer without letting players
// reroll it. The same authoritative action seed always produces the same
// result, while many actions converge on the configured yield multiplier.
export function harthmereDeterministicYieldCount(input: {
  baseCount: number;
  multiplier: number;
  seed: string | number;
}) {
  const baseCount = Math.max(0, Math.trunc(input.baseCount));
  const extraExact =
    baseCount * Math.max(0, Math.min(HARTHMERE_SUBLEVEL_YIELD_CAP, input.multiplier - 1));
  const guaranteedExtra = Math.floor(extraExact);
  const fractionalExtra = extraExact - guaranteedExtra;
  return (
    baseCount +
    guaranteedExtra +
    (harthmereDeterministicUnitInterval(input.seed) < fractionalExtra ? 1 : 0)
  );
}

export function harthmereSublevelRareChance(baseChance: number, level: unknown) {
  const relativeBonus =
    HARTHMERE_SUBLEVEL_RARE_CHANCE_RELATIVE_CAP *
    harthmereSublevelProgress(level);
  return Math.max(0, Math.min(1, baseChance * (1 + relativeBonus)));
}

export function harthmereSublevelSuccessChanceBonus(level: unknown) {
  return HARTHMERE_SUBLEVEL_SUCCESS_CHANCE_CAP *
    harthmereSublevelProgress(level);
}

export function harthmereSublevelTradeBonus(level: unknown) {
  return HARTHMERE_SUBLEVEL_TRADE_CAP * harthmereSublevelProgress(level);
}

export function harthmereSublevelWeightedProgress(
  levels: Record<string, number | undefined>,
  weights: Readonly<Record<string, number>>
) {
  let weighted = 0;
  let totalWeight = 0;
  for (const [rawSkillId, rawWeight] of Object.entries(weights)) {
    const skillId = normalizeHarthmereSublevelId(rawSkillId) ?? rawSkillId;
    const weight = Math.max(0, Number(rawWeight) || 0);
    if (weight <= 0) continue;
    weighted += harthmereSublevelProgress(levels[skillId] ?? 1) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.max(0, Math.min(1, weighted / totalWeight)) : 0;
}

export function harthmereWeightedPotencyMultiplier(
  levels: Record<string, number | undefined>,
  weights: Readonly<Record<string, number>>
) {
  return 1 +
    HARTHMERE_SUBLEVEL_POTENCY_CAP *
      harthmereSublevelWeightedProgress(levels, weights);
}

export const harthmereWeightedStatusPotencyMultiplier =
  harthmereWeightedPotencyMultiplier;

export function harthmereWeightedEfficiencyMultiplier(
  levels: Record<string, number | undefined>,
  weights: Readonly<Record<string, number>>
) {
  return 1 -
    HARTHMERE_SUBLEVEL_EFFICIENCY_CAP *
      harthmereSublevelWeightedProgress(levels, weights);
}

export function harthmereCombatSkillWeights(input: {
  itemId?: string;
  kind: "unarmed" | "melee" | "heavy" | "ranged" | "spell";
}): Readonly<Record<string, number>> {
  const text = (input.itemId ?? "").toLowerCase();
  if (input.kind === "spell") {
    const school = /holy|bless|smite|radiant|chapel|prayer/.test(text)
      ? "holy_magic"
      : /shadow|death|drain|curse|necrom|skull|soul/.test(text)
        ? "shadow_magic"
        : /nature|root|thorn|druid|wild|sickle|growth/.test(text)
          ? "nature_magic"
          : "fire_magic";
    return { combat: 0.2, [school]: 0.8 };
  }
  if (input.kind === "ranged") {
    return /bow|crossbow/.test(text)
      ? { combat: 0.2, ranged_combat: 0.35, archery: 0.45 }
      : { combat: 0.35, ranged_combat: 0.65 };
  }
  if (/dagger|knife|stiletto/.test(text)) {
    return { combat: 0.2, melee_combat: 0.35, dagger_mastery: 0.45 };
  }
  return { combat: 0.35, melee_combat: 0.65 };
}

export function harthmereCombatEfficiencySkillWeights(input: {
  itemId?: string;
  kind: "unarmed" | "melee" | "heavy" | "ranged" | "spell";
}) {
  const potencyWeights = harthmereCombatSkillWeights(input);
  if (input.kind !== "spell") return potencyWeights;
  return Object.fromEntries([
    ...Object.entries(potencyWeights).map(([skillId, weight]) => [
      skillId,
      weight * 0.8,
    ]),
    ["arcane_literacy", 0.2],
  ]);
}

export function harthmereTargetAwareCombatSkillWeights(
  baseWeights: Readonly<Record<string, number>>,
  targetDescriptor?: string
) {
  const text = (targetDescriptor ?? "").toLowerCase();
  const specialist = /undead|skeleton|zombie|wraith|ghost|spirit|necrom|crypt|grave/.test(
    text
  )
    ? "death_lore"
    : /animal|wildlife|beast|boar|bear|wolf|deer|stag|rabbit|bird|fish/.test(
          text
        )
      ? "tracking"
      : undefined;
  if (!specialist) return baseWeights;
  return {
    ...Object.fromEntries(
      Object.entries(baseWeights).map(([skillId, weight]) => [
        skillId,
        weight * 0.75,
      ])
    ),
    [specialist]: 0.25,
  };
}

export function harthmereTrackingDetectionRadius(
  baseRadius: number,
  trackingLevel: number
) {
  return Math.max(
    0,
    baseRadius * harthmereSublevelPotencyMultiplier(trackingLevel)
  );
}

export function harthmereBusinessCustomerCountBonus(
  performanceLevel: number
) {
  return Math.floor(2 * harthmereSublevelProgress(performanceLevel));
}

export function harthmereBusinessCustomerPatienceMultiplier(
  businessOperationsLevel: number
) {
  return harthmereSublevelYieldMultiplier(businessOperationsLevel);
}

export function resolveHarthmereLockpickAttempt(input: {
  lockpickingLevel: number;
  difficultyLevel: number;
  baseDurationMs: number;
  baseDurabilityCost: number;
  seed: string | number;
}) {
  const level = boundedHarthmereSublevel(input.lockpickingLevel);
  const difficulty = boundedHarthmereSublevel(input.difficultyLevel);
  const levelAdvantage = Math.max(-0.25, Math.min(0.25, (level - difficulty) / 100));
  const chance = Math.max(
    0.05,
    Math.min(
      0.95,
      0.55 + levelAdvantage + harthmereSublevelSuccessChanceBonus(level)
    )
  );
  return {
    success: harthmereDeterministicUnitInterval(input.seed) < chance,
    chance,
    durationMs: Math.max(
      250,
      Math.round(
        input.baseDurationMs * harthmereSublevelEfficiencyMultiplier(level)
      )
    ),
    durabilityCost: Math.max(
      0,
      Math.round(
        input.baseDurabilityCost * harthmereSublevelEfficiencyMultiplier(level)
      )
    ),
  };
}

export function harthmereLoanTermsForPersuasion(input: {
  persuasionLevel: number;
  basePrincipal: number;
  baseDailyInterestRate: number;
  baseDays: number;
}) {
  const progress = harthmereSublevelProgress(input.persuasionLevel);
  return {
    maxPrincipal: Math.max(
      1,
      Math.floor(input.basePrincipal * (1 + 0.25 * progress))
    ),
    dailyInterestRate:
      input.baseDailyInterestRate *
      (1 - HARTHMERE_SUBLEVEL_LOAN_INTEREST_RELATIVE_CAP * progress),
    maxDays: Math.max(1, Math.floor(input.baseDays + 7 * progress)),
  };
}

export function harthmereSublevelNextMilestone(
  skillId: string,
  level: unknown
): HarthmereSublevelMilestone | undefined {
  return HARTHMERE_SUBLEVEL_BENEFITS[skillId]?.milestones.find(
    (milestone) => milestone.level > boundedHarthmereSublevel(level)
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function harthmereSublevelCurrentEffects(skillId: string, level: unknown) {
  const definition = HARTHMERE_SUBLEVEL_BENEFITS[skillId];
  if (!definition) return [];
  const progress = harthmereSublevelProgress(level);
  const potency = percent(HARTHMERE_SUBLEVEL_POTENCY_CAP * progress);
  const efficiency = percent(HARTHMERE_SUBLEVEL_EFFICIENCY_CAP * progress);
  const yieldBonus = percent(HARTHMERE_SUBLEVEL_YIELD_CAP * progress);
  const rareBonus = percent(
    HARTHMERE_SUBLEVEL_RARE_CHANCE_RELATIVE_CAP * progress
  );
  const trade = percent(HARTHMERE_SUBLEVEL_TRADE_CAP * progress);
  if (["combat", "melee_combat", "ranged_combat", "dagger_mastery", "archery", "fire_magic", "holy_magic", "medicine", "death_lore", "shadow_magic", "nature_magic", "performance"].includes(skillId)) {
    return [`Action potency +${potency}`, `Action cost/time -${efficiency}`];
  }
  if (skillId === "shield_mastery") {
    return [`Blocked damage +${potency}`, `Guard and shield wear -${efficiency}`];
  }
  if (["mining", "gathering", "fishing", "farming", "exotic_refining"].includes(skillId)) {
    return [`Ordinary yield +${yieldBonus}`, `Rare chance +${rareBonus} relative`, `Action/tool cost -${efficiency}`];
  }
  if (["cooking", "crafting", "blacksmithing", "leatherworking", "carpentry", "tailoring", "alchemy", "enchanting", "bell_forging"].includes(skillId)) {
    return [`Work time -${efficiency}`, `Potency/quality +${potency}`, `Reliability improves with level`];
  }
  if (skillId === "persuasion") {
    return [`Negotiated prices up to ${trade} better`, `Loan principal +${potency}`, `Loan interest reduced by ${percent(HARTHMERE_SUBLEVEL_LOAN_INTEREST_RELATIVE_CAP * progress)}`];
  }
  if (skillId === "business_operations") {
    return [`Customer patience +${yieldBonus}`, `Business waste and penalties -${efficiency}`];
  }
  return definition.improves.slice(0, 3);
}
