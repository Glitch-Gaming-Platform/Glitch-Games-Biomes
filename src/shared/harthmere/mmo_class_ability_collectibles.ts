import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES,
  type HarthmereEconomyBusinessTypeId,
  type HarthmereProductionEconomyState,
} from "@/shared/harthmere/mmo_economy_authority";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_QUESTS,
} from "@/shared/harthmere/snapshot_grove_content";

export const HARTHMERE_CLASS_ABILITY_COLLECTIBLES_VERSION =
  "harthmere-class-ability-collectibles" as const;

export type HarthmereClassId =
  | "warrior"
  | "rogue"
  | "ranger"
  | "mage"
  | "priest"
  | "paladin"
  | "necromancer"
  | "druid"
  | "bard";

export type HarthmereAbilityKind = "combat" | "utility" | "social" | "business";

export interface HarthmereClassDefinition {
  id: HarthmereClassId;
  name: string;
  tagline: string;
  resource: string;
  roles: string[];
  specializations: string[];
  startingAbilities: string[];
  startingSkills: Record<string, number>;
}

export interface HarthmereSkillDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  maxLevel: number;
}

export interface HarthmereAbilityDefinition {
  id: string;
  name: string;
  icon: string;
  kind: HarthmereAbilityKind;
  cooldown: number;
  cost: number;
  resource: string;
  description: string;
  classRequirements?: HarthmereClassId[];
  skillRequirements?: Record<string, number>;
  businessTypeId?: HarthmereEconomyBusinessTypeId;
}

export interface HarthmereCollectibleDefinition {
  id: string;
  name: string;
  icon: string;
  categoryId: string;
  categoryName: string;
  source: "npc" | "quest" | "landmark" | "economy";
}

export interface HarthmereProgressionCollectionsState {
  discovered: Record<string, number>;
}

export interface HarthmereClassMagicStateLike {
  classId?: string;
  specializationId?: string;
  knownAbilities?: string[];
  skills?: Record<string, { xp?: number; level?: number }>;
  loadout?: Record<string, string | undefined>;
}

const CLASS_DEFS: Record<HarthmereClassId, HarthmereClassDefinition> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    tagline: "Front-line fighter who protects allies and controls the battle.",
    resource: "Stamina",
    roles: ["tank", "damage", "support"],
    specializations: ["arms", "fury", "protection"],
    startingAbilities: ["basic_strike", "power_strike", "guarded_block"],
    startingSkills: { character_level: 1, melee_combat: 1, shield_mastery: 1 },
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    tagline: "Quick infiltrator skilled at locks, traps, and fast escapes.",
    resource: "Energy",
    roles: ["damage", "scout", "controller"],
    specializations: ["assassin", "trickster", "shadowblade"],
    startingAbilities: ["basic_strike", "backstab", "pick_lock"],
    startingSkills: { character_level: 1, dagger_mastery: 1, lockpicking: 1 },
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    tagline: "Wilderness scout skilled at tracking and ranged combat.",
    resource: "Focus",
    roles: ["damage", "scout", "support"],
    specializations: ["marksman", "beast_warden", "pathfinder"],
    startingAbilities: ["basic_strike", "hunters_mark", "track_beast"],
    startingSkills: { character_level: 1, archery: 1, tracking: 1 },
  },
  mage: {
    id: "mage",
    name: "Mage",
    tagline: "Spellcaster who uses fire, wards, and arcane knowledge.",
    resource: "Mana",
    roles: ["damage", "controller", "support"],
    specializations: ["pyromancer", "cryomancer", "arcanist"],
    startingAbilities: ["spark", "mana_shield", "read_runes"],
    startingSkills: { character_level: 1, fire_magic: 1, arcane_literacy: 1 },
  },
  priest: {
    id: "priest",
    name: "Priest",
    tagline: "Healer who protects and supports allies.",
    resource: "Faith",
    roles: ["healer", "support"],
    specializations: ["life_priest", "lightbearer", "oracle"],
    startingAbilities: ["minor_heal", "blessing", "cleanse"],
    startingSkills: { character_level: 1, holy_magic: 1, medicine: 1 },
  },
  paladin: {
    id: "paladin",
    name: "Paladin",
    tagline: "Holy defender who protects people and property.",
    resource: "Conviction",
    roles: ["tank", "healer", "damage"],
    specializations: ["protection", "devotion", "wrath"],
    startingAbilities: ["smite", "shield_of_faith", "judgment"],
    // judgment requires persuasion 1; grant it so the Paladin's own starting ability is
    // re-learnable (e.g. after a respec/class re-pick), not just bestowed once.
    startingSkills: {
      character_level: 1,
      melee_combat: 1,
      holy_magic: 1,
      persuasion: 1,
    },
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    tagline: "Forbidden spellcaster who studies death, spirits, and memory.",
    resource: "Souls",
    roles: ["summoner", "damage", "controller"],
    specializations: ["bonecaller", "soulweaver", "lichbinder"],
    startingAbilities: ["life_drain", "curse_of_weakness", "speak_with_dead"],
    startingSkills: { character_level: 1, death_lore: 1, shadow_magic: 1 },
  },
  druid: {
    id: "druid",
    name: "Druid",
    tagline: "Nature healer who restores land and protects living things.",
    resource: "Mana",
    roles: ["healer", "tank", "support"],
    specializations: ["guardian", "restoration", "wildshape", "naturecaller"],
    startingAbilities: [
      "rejuvenation",
      "entangling_roots",
      "speak_with_animals",
    ],
    startingSkills: { character_level: 1, nature_magic: 1, farming: 1 },
  },
  bard: {
    id: "bard",
    name: "Bard",
    tagline: "Performer who inspires allies and learns from rumors.",
    resource: "Inspiration",
    roles: ["support", "healer", "controller"],
    specializations: ["maestro", "skald", "trick_singer"],
    startingAbilities: ["song_of_courage", "mocking_verse", "rumor_song"],
    startingSkills: { character_level: 1, persuasion: 1, performance: 1 },
  },
};

export const HARTHMERE_CLASS_DEFINITIONS = CLASS_DEFS;

export const HARTHMERE_SKILL_DEFINITIONS: Record<
  string,
  HarthmereSkillDefinition
> = {
  character_level: {
    id: "character_level",
    name: "Character Level",
    category: "Core",
    description: "Your overall experience as an adventurer.",
    maxLevel: 100,
  },
  combat: {
    id: "combat",
    name: "Combat",
    category: "Combat",
    description: "Your experience fighting enemies with weapons and magic.",
    maxLevel: 100,
  },
  melee_combat: {
    id: "melee_combat",
    name: "Melee Combat",
    category: "Combat",
    description:
      "Your skill with close-range attacks, blocking, and melee weapons.",
    maxLevel: 100,
  },
  ranged_combat: {
    id: "ranged_combat",
    name: "Ranged Combat",
    category: "Combat",
    description:
      "Your skill with bows, crossbows, thrown weapons, and other ranged attacks.",
    maxLevel: 100,
  },
  shield_mastery: {
    id: "shield_mastery",
    name: "Shield Mastery",
    category: "Combat",
    description:
      "Your skill at blocking attacks and protecting yourself or allies with a shield.",
    maxLevel: 100,
  },
  dagger_mastery: {
    id: "dagger_mastery",
    name: "Dagger Mastery",
    category: "Weapon",
    description:
      "Your skill with daggers, knives, and quick precision strikes.",
    maxLevel: 100,
  },
  lockpicking: {
    id: "lockpicking",
    name: "Lockpicking",
    category: "Exploration",
    description: "Your ability to open locks and disarm traps.",
    maxLevel: 100,
  },
  archery: {
    id: "archery",
    name: "Archery",
    category: "Weapon",
    description: "Your skill with bows and crossbows.",
    maxLevel: 100,
  },
  tracking: {
    id: "tracking",
    name: "Tracking",
    category: "Exploration",
    description: "Your ability to follow footprints, trails, and animal signs.",
    maxLevel: 100,
  },
  fire_magic: {
    id: "fire_magic",
    name: "Fire Magic",
    category: "Magic",
    description: "Your command of fire spells for combat and utility.",
    maxLevel: 100,
  },
  arcane_literacy: {
    id: "arcane_literacy",
    name: "Arcane Literacy",
    category: "Magic",
    description:
      "Your understanding of runes, wards, magical writing, and enchanted devices.",
    maxLevel: 100,
  },
  holy_magic: {
    id: "holy_magic",
    name: "Holy Magic",
    category: "Magic",
    description:
      "Your skill with healing, blessings, cleansing, and protective light.",
    maxLevel: 100,
  },
  medicine: {
    id: "medicine",
    name: "Medicine",
    category: "Profession",
    description:
      "Your ability to treat injuries, use remedies, and care for patients.",
    maxLevel: 100,
  },
  death_lore: {
    id: "death_lore",
    name: "Death Lore",
    category: "Magic",
    description: "Your knowledge of spirits, graves, curses, and the dead.",
    maxLevel: 100,
  },
  shadow_magic: {
    id: "shadow_magic",
    name: "Shadow Magic",
    category: "Magic",
    description:
      "Your command of curses, draining spells, concealment, and shadow magic.",
    maxLevel: 100,
  },
  nature_magic: {
    id: "nature_magic",
    name: "Nature Magic",
    category: "Magic",
    description:
      "Your connection to plants, animals, soil, and protective nature magic.",
    maxLevel: 100,
  },
  farming: {
    id: "farming",
    name: "Farming",
    category: "Profession",
    description:
      "Your skill at planting, watering, tending, and harvesting crops.",
    maxLevel: 100,
  },
  mining: {
    id: "mining",
    name: "Mining",
    category: "Gathering",
    description:
      "Your skill at extracting ore, stone, gems, and other underground materials.",
    maxLevel: 100,
  },
  gathering: {
    id: "gathering",
    name: "Gathering",
    category: "Gathering",
    description:
      "Your skill at collecting plants, wood, stone, fish, and other natural resources.",
    maxLevel: 100,
  },
  cooking: {
    id: "cooking",
    name: "Cooking",
    category: "Profession",
    description:
      "Your skill at preparing meals from farmed, hunted, and gathered ingredients.",
    maxLevel: 100,
  },
  crafting: {
    id: "crafting",
    name: "Crafting",
    category: "Crafting",
    description:
      "Your ability to turn materials into useful items, tools, and repairs.",
    maxLevel: 100,
  },
  blacksmithing: {
    id: "blacksmithing",
    name: "Blacksmithing",
    category: "Crafting",
    description:
      "Your skill at smelting metal, forging equipment, and repairing metal gear.",
    maxLevel: 100,
  },
  leatherworking: {
    id: "leatherworking",
    name: "Leatherworking",
    category: "Crafting",
    description:
      "Your skill at curing hides and making or repairing leather gear.",
    maxLevel: 100,
  },
  carpentry: {
    id: "carpentry",
    name: "Carpentry",
    category: "Crafting",
    description:
      "Your skill at working wood, making bows and repair kits, and helping with construction.",
    maxLevel: 100,
  },
  tailoring: {
    id: "tailoring",
    name: "Tailoring",
    category: "Crafting",
    description:
      "Your skill at weaving cloth and sewing clothing, armor, and travel gear.",
    maxLevel: 100,
  },
  alchemy: {
    id: "alchemy",
    name: "Alchemy",
    category: "Crafting",
    description:
      "Your skill at making extracts, potions, antidotes, and magical mixtures.",
    maxLevel: 100,
  },
  enchanting: {
    id: "enchanting",
    name: "Enchanting",
    category: "Crafting",
    description: "Your skill at adding magical effects to items.",
    maxLevel: 100,
  },
  exotic_refining: {
    id: "exotic_refining",
    name: "Exotic Refining",
    category: "Crafting",
    description:
      "Your skill at refining rare materials into power cells, portal fuel, and advanced components.",
    maxLevel: 100,
  },
  bell_forging: {
    id: "bell_forging",
    name: "Bell Forging",
    category: "Crafting",
    description: "Your skill at refining bell metals and forging ritual bells.",
    maxLevel: 100,
  },
  fishing: {
    id: "fishing",
    name: "Fishing",
    category: "Gathering",
    description:
      "Your skill at catching fish and preparing bait, lines, and fishing supplies.",
    maxLevel: 100,
  },
  care: {
    id: "care",
    name: "Care",
    category: "Profession",
    description:
      "Your skill at caring for animals, plants, patients, and shared spaces.",
    maxLevel: 100,
  },
  persuasion: {
    id: "persuasion",
    name: "Persuasion",
    category: "Social",
    description:
      "Your ability to negotiate, calm disputes, and convince others.",
    maxLevel: 100,
  },
  performance: {
    id: "performance",
    name: "Performance",
    category: "Social",
    description:
      "Your ability to entertain crowds, raise morale, and share stories and songs.",
    maxLevel: 100,
  },
  business_operations: {
    id: "business_operations",
    name: "Business Operations",
    category: "Business",
    description:
      "Your ability to set prices, manage staff and stock, fulfill contracts, and serve customers.",
    maxLevel: 100,
  },
};

export const HARTHMERE_SKILL_XP_PER_LEVEL = 1000;

export function isHarthmereSkillId(value: string | undefined): value is string {
  return !!value && value in HARTHMERE_SKILL_DEFINITIONS;
}

export function harthmereSkillTotalXpCap(skillId: string) {
  const maxLevel = HARTHMERE_SKILL_DEFINITIONS[skillId]?.maxLevel ?? 1;
  return Math.max(0, (maxLevel - 1) * HARTHMERE_SKILL_XP_PER_LEVEL);
}

export function harthmereSkillLevelFromTotalXp(
  skillId: string,
  totalXp: number
) {
  const def = HARTHMERE_SKILL_DEFINITIONS[skillId];
  const maxLevel = def?.maxLevel ?? 1;
  const safeXp = Math.max(
    0,
    Math.trunc(Number.isFinite(totalXp) ? totalXp : 0)
  );
  return Math.min(
    maxLevel,
    1 + Math.floor(safeXp / HARTHMERE_SKILL_XP_PER_LEVEL)
  );
}

export function harthmereSkillProgressFromTotalXp(
  skillId: string,
  totalXp: number
) {
  const cappedTotalXp = Math.min(
    harthmereSkillTotalXpCap(skillId),
    Math.max(0, Math.trunc(Number.isFinite(totalXp) ? totalXp : 0))
  );
  const level = harthmereSkillLevelFromTotalXp(skillId, cappedTotalXp);
  const atCap =
    level >= (HARTHMERE_SKILL_DEFINITIONS[skillId]?.maxLevel ?? level);
  return {
    level,
    totalXp: cappedTotalXp,
    xp: atCap
      ? HARTHMERE_SKILL_XP_PER_LEVEL
      : cappedTotalXp % HARTHMERE_SKILL_XP_PER_LEVEL,
    nextLevel: HARTHMERE_SKILL_XP_PER_LEVEL,
    atCap,
  };
}

const CORE_ABILITIES: Record<string, HarthmereAbilityDefinition> = {
  basic_strike: {
    id: "basic_strike",
    name: "Basic Strike",
    icon: "BS",
    kind: "combat",
    cooldown: 1,
    cost: 0,
    resource: "Stamina",
    description: "Attack with the weapon in your main hand.",
  },
  power_strike: {
    id: "power_strike",
    name: "Power Strike",
    icon: "PS",
    kind: "combat",
    cooldown: 4,
    cost: 18,
    resource: "Stamina",
    description: "Make a heavy melee attack that can break an enemy's guard.",
    classRequirements: ["warrior", "paladin"],
    skillRequirements: { melee_combat: 1 },
  },
  guarded_block: {
    id: "guarded_block",
    name: "Guarded Block",
    icon: "GB",
    kind: "combat",
    cooldown: 8,
    cost: 10,
    resource: "Stamina",
    description: "Brace to reduce incoming damage.",
    classRequirements: ["warrior", "paladin"],
    skillRequirements: { shield_mastery: 1 },
  },
  backstab: {
    id: "backstab",
    name: "Backstab",
    icon: "BK",
    kind: "combat",
    cooldown: 6,
    cost: 25,
    resource: "Energy",
    description: "Make a precise attack from a favorable position.",
    classRequirements: ["rogue"],
    skillRequirements: { dagger_mastery: 1 },
  },
  pick_lock: {
    id: "pick_lock",
    name: "Pick Lock",
    icon: "LK",
    kind: "utility",
    cooldown: 3,
    cost: 8,
    resource: "Energy",
    description: "Open locked doors, chests, and other objects.",
    classRequirements: ["rogue"],
    skillRequirements: { lockpicking: 1 },
  },
  hunters_mark: {
    id: "hunters_mark",
    name: "Hunter's Mark",
    icon: "HM",
    kind: "combat",
    cooldown: 10,
    cost: 15,
    resource: "Focus",
    description:
      "Mark an enemy so allies can track it and focus their attacks.",
    classRequirements: ["ranger"],
    skillRequirements: { tracking: 1 },
  },
  track_beast: {
    id: "track_beast",
    name: "Track Beast",
    icon: "TB",
    kind: "utility",
    cooldown: 8,
    cost: 5,
    resource: "Focus",
    description: "Reveal nearby animal tracks and safer paths.",
    classRequirements: ["ranger"],
    skillRequirements: { tracking: 1 },
  },
  spark: {
    id: "spark",
    name: "Spark",
    icon: "SP",
    kind: "combat",
    cooldown: 2,
    cost: 8,
    resource: "Mana",
    description: "Cast a small, controlled flame.",
    classRequirements: ["mage"],
    skillRequirements: { fire_magic: 1 },
  },
  mana_shield: {
    id: "mana_shield",
    name: "Mana Shield",
    icon: "MS",
    kind: "combat",
    cooldown: 18,
    cost: 25,
    resource: "Mana",
    description: "Spend mana to protect yourself for a short time.",
    classRequirements: ["mage"],
    skillRequirements: { arcane_literacy: 1 },
  },
  read_runes: {
    id: "read_runes",
    name: "Read Runes",
    icon: "RR",
    kind: "utility",
    cooldown: 4,
    cost: 4,
    resource: "Mana",
    description: "Read magical seals, wards, and runes.",
    classRequirements: ["mage"],
    skillRequirements: { arcane_literacy: 1 },
  },
  minor_heal: {
    id: "minor_heal",
    name: "Minor Heal",
    icon: "MH",
    kind: "combat",
    cooldown: 5,
    cost: 18,
    resource: "Faith",
    description: "Restore some health to an ally.",
    classRequirements: ["priest"],
    skillRequirements: { holy_magic: 1 },
  },
  blessing: {
    id: "blessing",
    name: "Blessing",
    icon: "BL",
    kind: "utility",
    cooldown: 20,
    cost: 20,
    resource: "Faith",
    description: "Help an ally resist fear and stay focused.",
    classRequirements: ["priest", "paladin"],
    skillRequirements: { holy_magic: 1 },
  },
  cleanse: {
    id: "cleanse",
    name: "Cleanse",
    icon: "CL",
    kind: "utility",
    cooldown: 12,
    cost: 16,
    resource: "Faith",
    description: "Remove minor corruption or contamination from an ally.",
    classRequirements: ["priest"],
    skillRequirements: { holy_magic: 1 },
  },
  smite: {
    id: "smite",
    name: "Smite",
    icon: "SM",
    kind: "combat",
    cooldown: 5,
    cost: 18,
    resource: "Conviction",
    description: "Strike an enemy with holy light.",
    classRequirements: ["paladin"],
    skillRequirements: { holy_magic: 1 },
  },
  shield_of_faith: {
    id: "shield_of_faith",
    name: "Shield of Faith",
    icon: "SF",
    kind: "combat",
    cooldown: 15,
    cost: 24,
    resource: "Conviction",
    description: "Protect an ally with a holy ward.",
    classRequirements: ["paladin"],
    skillRequirements: { holy_magic: 1 },
  },
  judgment: {
    id: "judgment",
    name: "Judgment",
    icon: "JG",
    kind: "social",
    cooldown: 30,
    cost: 20,
    resource: "Conviction",
    description:
      "Call attention to an enemy or unlawful act so nearby guards understand the threat.",
    classRequirements: ["paladin"],
    skillRequirements: { persuasion: 1 },
  },
  life_drain: {
    id: "life_drain",
    name: "Life Drain",
    icon: "LD",
    kind: "combat",
    cooldown: 8,
    cost: 12,
    resource: "Souls",
    description: "Steal health from an enemy.",
    classRequirements: ["necromancer"],
    skillRequirements: { shadow_magic: 1 },
  },
  curse_of_weakness: {
    id: "curse_of_weakness",
    name: "Curse of Weakness",
    icon: "CW",
    kind: "combat",
    cooldown: 12,
    cost: 16,
    resource: "Souls",
    description: "Weaken an enemy's attacks for a short time.",
    classRequirements: ["necromancer"],
    skillRequirements: { shadow_magic: 1 },
  },
  speak_with_dead: {
    id: "speak_with_dead",
    name: "Speak with Dead",
    icon: "SD",
    kind: "utility",
    cooldown: 60,
    cost: 25,
    resource: "Souls",
    description: "Ask a spirit for a useful clue.",
    classRequirements: ["necromancer"],
    skillRequirements: { death_lore: 1 },
  },
  rejuvenation: {
    id: "rejuvenation",
    name: "Rejuvenation",
    icon: "RJ",
    kind: "combat",
    cooldown: 6,
    cost: 15,
    resource: "Mana",
    description: "Help an ally recover health over time.",
    classRequirements: ["druid"],
    skillRequirements: { nature_magic: 1 },
  },
  entangling_roots: {
    id: "entangling_roots",
    name: "Entangling Roots",
    icon: "ER",
    kind: "combat",
    cooldown: 14,
    cost: 20,
    resource: "Mana",
    description: "Trap an enemy with nearby roots.",
    classRequirements: ["druid"],
    skillRequirements: { nature_magic: 1 },
  },
  speak_with_animals: {
    id: "speak_with_animals",
    name: "Speak with Animals",
    icon: "SA",
    kind: "utility",
    cooldown: 20,
    cost: 10,
    resource: "Mana",
    description: "Learn useful information from an animal's behavior.",
    classRequirements: ["druid"],
    skillRequirements: { nature_magic: 1 },
  },
  song_of_courage: {
    id: "song_of_courage",
    name: "Song of Courage",
    icon: "SC",
    kind: "social",
    cooldown: 20,
    cost: 18,
    resource: "Inspiration",
    description: "Help nearby allies resist fear.",
    classRequirements: ["bard"],
    skillRequirements: { performance: 1 },
  },
  mocking_verse: {
    id: "mocking_verse",
    name: "Mocking Verse",
    icon: "MV",
    kind: "combat",
    cooldown: 8,
    cost: 10,
    resource: "Inspiration",
    description: "Distract an enemy with a well-timed insult.",
    classRequirements: ["bard"],
    skillRequirements: { performance: 1 },
  },
  rumor_song: {
    id: "rumor_song",
    name: "Rumor Song",
    icon: "RS",
    kind: "social",
    cooldown: 30,
    cost: 16,
    resource: "Inspiration",
    description: "Learn useful local information from nearby conversations.",
    classRequirements: ["bard"],
    skillRequirements: { persuasion: 1 },
  },
};

const BUSINESS_ABILITY_PATTERNS = [
  [
    "Intake Forecast",
    "Forecast demand from town needs and recent orders before buying stock.",
  ],
  [
    "Supplier Contract",
    "Set up regular deliveries to avoid running out of stock.",
  ],
  [
    "Quality Inspection",
    "Catch bad batches, weak repairs, and service failures before customers do.",
  ],
  [
    "Staff Rotation",
    "Assign workers to the right shift while keeping morale steady.",
  ],
  [
    "Price Tuning",
    "Adjust prices as demand changes without harming your reputation.",
  ],
  [
    "Safety Protocol",
    "Reduce injuries, contamination, travel losses, and other business risks.",
  ],
  ["Waste Recovery", "Recover reusable materials and lower cleanup costs."],
  [
    "Customer Promise",
    "Offer a clear service guarantee to improve customer satisfaction.",
  ],
  [
    "Route Coordination",
    "Coordinate deliveries, travel, field calls, or pickups more reliably.",
  ],
  [
    "Emergency Playbook",
    "Respond to outages, attacks, spoilage, sickness, or contract failures.",
  ],
] as const;

function businessAbilityId(typeId: string, suffix: string) {
  return `business_${typeId}_${suffix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
}

function playerFacingBusinessTerm(value: string) {
  return value.replace(/[_-]+/g, " ").trim();
}

export const HARTHMERE_BUSINESS_ABILITY_DEFINITIONS: Record<
  string,
  HarthmereAbilityDefinition
> = Object.fromEntries(
  Object.values(HARTHMERE_ECONOMY_BUSINESS_TYPES).flatMap((business) =>
    BUSINESS_ABILITY_PATTERNS.map(([name, description], index) => {
      const input =
        business.inputItemFamilies[index % business.inputItemFamilies.length] ??
        "stock";
      const output =
        business.outputItemFamilies[
          index % business.outputItemFamilies.length
        ] ?? "service";
      const need =
        business.serviceNeeds[index % business.serviceNeeds.length] ??
        "customers";
      const ability: HarthmereAbilityDefinition = {
        id: businessAbilityId(business.typeId, name),
        name: `${business.displayName}: ${name}`,
        icon: `B${index + 1}`,
        kind: "business",
        cooldown: 60 + index * 15,
        cost: 5 + Math.max(1, business.riskLevel) * 2,
        resource: "Focus",
        businessTypeId: business.typeId,
        skillRequirements: {
          business_operations: Math.max(
            1,
            Math.min(10, business.minimumLicenseLevel)
          ),
        },
        description: `${description} Uses ${playerFacingBusinessTerm(
          input
        )} to improve ${playerFacingBusinessTerm(
          output
        )} and support ${playerFacingBusinessTerm(need)}.`,
      };
      return [ability.id, ability];
    })
  )
);

export const HARTHMERE_ABILITY_DEFINITIONS: Record<
  string,
  HarthmereAbilityDefinition
> = {
  ...CORE_ABILITIES,
  ...HARTHMERE_BUSINESS_ABILITY_DEFINITIONS,
};

export const HARTHMERE_COLLECTIBLE_DEFINITIONS: Record<
  string,
  HarthmereCollectibleDefinition
> = Object.fromEntries([
  ...SNAPSHOT_GROVE_NPCS.map((npc) => [
    `npc:${npc.id}`,
    {
      id: `npc:${npc.id}`,
      name: npc.displayName,
      icon: "NP",
      categoryId: "grove_people",
      categoryName: "Grove People",
      source: "npc" as const,
    },
  ]),
  ...SNAPSHOT_GROVE_QUESTS.map((quest) => [
    `quest:${quest.id}`,
    {
      id: `quest:${quest.id}`,
      name: quest.title,
      icon: "Q",
      categoryId: "grove_lessons",
      categoryName: "Grove Lessons",
      source: "quest" as const,
    },
  ]),
  ...SNAPSHOT_GROVE_LANDMARKS.filter(
    (landmark) => landmark.visibleOnWorldMap
  ).map((landmark) => [
    `landmark:${landmark.id}`,
    {
      id: `landmark:${landmark.id}`,
      name: landmark.label,
      icon: "LM",
      categoryId: "grove_places",
      categoryName: "Grove Places",
      source: "landmark" as const,
    },
  ]),
  ...Object.values(HARTHMERE_ECONOMY_BUSINESS_TYPES).map((business) => [
    `economy:${business.typeId}`,
    {
      id: `economy:${business.typeId}`,
      name: business.displayName,
      icon: "EC",
      categoryId: "economy_businesses",
      categoryName: "Economy Businesses",
      source: "economy" as const,
    },
  ]),
]);

export function isHarthmereClassId(
  value: string | undefined
): value is HarthmereClassId {
  return !!value && value in HARTHMERE_CLASS_DEFINITIONS;
}

export function defaultHarthmereProgressionCollectionsState(): HarthmereProgressionCollectionsState {
  return { discovered: {} };
}

export function normalizeHarthmereProgressionCollectionsState(
  raw: Partial<HarthmereProgressionCollectionsState> | undefined
): HarthmereProgressionCollectionsState {
  const discovered: Record<string, number> = {};
  for (const [id, at] of Object.entries(raw?.discovered ?? {})) {
    if (HARTHMERE_COLLECTIBLE_DEFINITIONS[id] && Number.isFinite(Number(at))) {
      discovered[id] = Number(at);
    }
  }
  return { discovered };
}

export function applyHarthmereClassChoice(
  classMagic: HarthmereClassMagicStateLike,
  classId: string | undefined,
  options: { allowClassChange?: boolean; resetLoadout?: boolean } = {}
): { ok: boolean; warning?: string } {
  if (!isHarthmereClassId(classId)) {
    return { ok: false, warning: "class_rejected:unknown_class" };
  }
  const currentClassId = isHarthmereClassId(classMagic.classId)
    ? classMagic.classId
    : undefined;
  const changingClass =
    currentClassId !== undefined && currentClassId !== classId;
  if (changingClass && !options.allowClassChange) {
    return {
      ok: false,
      warning: "class_rejected:class_change_requires_respec_service",
    };
  }
  const def = HARTHMERE_CLASS_DEFINITIONS[classId];
  classMagic.classId = classId;
  if (
    changingClass ||
    !classMagic.specializationId ||
    !def.specializations.includes(classMagic.specializationId)
  ) {
    classMagic.specializationId = undefined;
  }
  const retainedAbilities = changingClass
    ? (classMagic.knownAbilities ?? []).filter((abilityId) => {
        const ability = HARTHMERE_ABILITY_DEFINITIONS[abilityId];
        return (
          !ability?.classRequirements?.length ||
          ability.classRequirements.includes(classId)
        );
      })
    : classMagic.knownAbilities ?? [];
  classMagic.knownAbilities = Array.from(
    new Set([...retainedAbilities, ...def.startingAbilities])
  );
  classMagic.skills ??= {};
  for (const [skillId, level] of Object.entries(def.startingSkills)) {
    const current = classMagic.skills[skillId] ?? { xp: 0, level: 0 };
    classMagic.skills[skillId] = {
      xp: Number(current.xp ?? 0),
      level: Math.max(Number(current.level ?? 0), level),
    };
  }
  if (changingClass || options.resetLoadout) {
    const known = new Set(classMagic.knownAbilities);
    classMagic.loadout = Object.fromEntries(
      Object.entries(classMagic.loadout ?? {}).filter(([, abilityId]) => {
        if (!abilityId || !known.has(abilityId)) return false;
        const ability = HARTHMERE_ABILITY_DEFINITIONS[abilityId];
        return (
          !ability?.classRequirements?.length ||
          ability.classRequirements.includes(classId)
        );
      })
    );
  }
  return { ok: true };
}

export function applyHarthmereSpecializationChoice(
  classMagic: HarthmereClassMagicStateLike,
  specializationId: string | undefined
): { ok: boolean; warning?: string } {
  if (!specializationId) {
    return {
      ok: false,
      warning: "specialization_rejected:missing_specialization",
    };
  }
  if (!isHarthmereClassId(classMagic.classId)) {
    return { ok: false, warning: "specialization_rejected:class_required" };
  }
  const classDef = HARTHMERE_CLASS_DEFINITIONS[classMagic.classId];
  if (!classDef.specializations.includes(specializationId)) {
    return {
      ok: false,
      warning: "specialization_rejected:not_available_for_class",
    };
  }
  classMagic.specializationId = specializationId;
  return { ok: true };
}

export function ownedBusinessTypeIdsForActor(
  economy: HarthmereProductionEconomyState | undefined,
  actorId: string
): Set<HarthmereEconomyBusinessTypeId> {
  const result = new Set<HarthmereEconomyBusinessTypeId>();
  for (const business of Object.values(economy?.businesses ?? {})) {
    if (
      business.ownerId === actorId &&
      business.ownerKind === "player" &&
      business.status !== "bankrupt" &&
      business.status !== "closed"
    ) {
      result.add(business.typeId);
    }
  }
  return result;
}

export function knownHarthmereAbilityIds(
  classMagic: HarthmereClassMagicStateLike
): Set<string> {
  const classId = isHarthmereClassId(classMagic.classId)
    ? classMagic.classId
    : "warrior";
  return new Set([
    ...(classMagic.knownAbilities ?? []),
    ...HARTHMERE_CLASS_DEFINITIONS[classId].startingAbilities,
  ]);
}

export function canLearnHarthmereAbility(input: {
  classMagic: HarthmereClassMagicStateLike;
  economy?: HarthmereProductionEconomyState;
  actorId: string;
  abilityId: string | undefined;
}): { ok: boolean; warning?: string } {
  const ability = input.abilityId
    ? HARTHMERE_ABILITY_DEFINITIONS[input.abilityId]
    : undefined;
  if (!ability)
    return { ok: false, warning: "ability_rejected:unknown_ability" };
  if (
    ability.classRequirements?.length &&
    !ability.classRequirements.includes(
      input.classMagic.classId as HarthmereClassId
    )
  ) {
    return { ok: false, warning: "ability_rejected:class_requirement" };
  }
  if (
    ability.businessTypeId &&
    !ownedBusinessTypeIdsForActor(input.economy, input.actorId).has(
      ability.businessTypeId
    )
  ) {
    return {
      ok: false,
      warning: `ability_rejected:business_required:${ability.businessTypeId}`,
    };
  }
  for (const [skillId, required] of Object.entries(
    ability.skillRequirements ?? {}
  )) {
    if (Number(input.classMagic.skills?.[skillId]?.level ?? 0) < required) {
      return {
        ok: false,
        warning: `ability_rejected:skill_required:${skillId}:${required}`,
      };
    }
  }
  return { ok: true };
}

export function createHarthmereProgressionClientSnapshot(input: {
  actorId: string;
  classMagic: HarthmereClassMagicStateLike;
  economy?: HarthmereProductionEconomyState;
  collections?: HarthmereProgressionCollectionsState;
}) {
  const classId = isHarthmereClassId(input.classMagic.classId)
    ? input.classMagic.classId
    : "warrior";
  const classDef = HARTHMERE_CLASS_DEFINITIONS[classId];
  const classSelected = isHarthmereClassId(input.classMagic.classId);
  const currentSpecializationId =
    input.classMagic.specializationId &&
    classDef.specializations.includes(input.classMagic.specializationId)
      ? input.classMagic.specializationId
      : undefined;
  const knownAbilityIds = Array.from(
    knownHarthmereAbilityIds(input.classMagic)
  );
  const ownedBusinessTypes = ownedBusinessTypeIdsForActor(
    input.economy,
    input.actorId
  );
  const collectionState = normalizeHarthmereProgressionCollectionsState(
    input.collections
  );

  return {
    version: HARTHMERE_CLASS_ABILITY_COLLECTIBLES_VERSION,
    actorId: input.actorId,
    classes: Object.values(HARTHMERE_CLASS_DEFINITIONS),
    currentClassId: classId,
    currentSpecializationId,
    classSelected,
    classChoiceLocked: classSelected,
    skills: Object.values(HARTHMERE_SKILL_DEFINITIONS).map((skill) => {
      const state = input.classMagic.skills?.[skill.id] ?? { xp: 0, level: 0 };
      const totalXp = Math.max(0, Math.trunc(Number(state.xp ?? 0)));
      const progress = harthmereSkillProgressFromTotalXp(skill.id, totalXp);
      const level = Math.max(
        progress.level,
        Math.min(skill.maxLevel, Math.trunc(Number(state.level ?? 0)))
      );
      const xp = progress.xp;
      const nextLevel = progress.nextLevel;
      return {
        ...skill,
        level,
        xp,
        nextLevel,
        title:
          level >= 50
            ? "Adept"
            : level >= 25
            ? "Apprentice"
            : level > 0
            ? "Novice"
            : "Untrained",
      };
    }),
    abilities: Object.values(HARTHMERE_ABILITY_DEFINITIONS).map((ability) => {
      const known = knownAbilityIds.includes(ability.id);
      const businessUnlocked =
        !ability.businessTypeId ||
        ownedBusinessTypes.has(ability.businessTypeId);
      const learnable = canLearnHarthmereAbility({
        classMagic: input.classMagic,
        economy: input.economy,
        actorId: input.actorId,
        abilityId: ability.id,
      }).ok;
      return {
        ...ability,
        known,
        unlocked: known || learnable,
        businessUnlocked,
      };
    }),
    equipped: Array.from(
      { length: 8 },
      (_unused, index) =>
        input.classMagic.loadout?.[`slot_${index}`] ??
        input.classMagic.loadout?.[String(index)] ??
        null
    ),
    collections: Object.values(HARTHMERE_COLLECTIBLE_DEFINITIONS).map(
      (entry) => ({
        ...entry,
        discovered: collectionState.discovered[entry.id] !== undefined,
        discoveredAtMs: collectionState.discovered[entry.id],
      })
    ),
  };
}
