import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES_V1,
  type HarthmereEconomyBusinessTypeIdV1,
  type HarthmereProductionEconomyStateV1,
} from "@/shared/harthmere/mmo_economy_authority_v1";
import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

export const HARTHMERE_CLASS_ABILITY_COLLECTIBLES_VERSION_V1 =
  "harthmere-class-ability-collectibles-v1" as const;

export type HarthmereClassIdV1 =
  | "warrior"
  | "rogue"
  | "ranger"
  | "mage"
  | "priest"
  | "paladin"
  | "necromancer"
  | "druid"
  | "bard";

export type HarthmereAbilityKindV1 =
  | "combat"
  | "utility"
  | "social"
  | "business";

export interface HarthmereClassDefinitionV1 {
  id: HarthmereClassIdV1;
  name: string;
  tagline: string;
  resource: string;
  roles: string[];
  startingAbilities: string[];
  startingSkills: Record<string, number>;
}

export interface HarthmereSkillDefinitionV1 {
  id: string;
  name: string;
  category: string;
  description: string;
  maxLevel: number;
}

export interface HarthmereAbilityDefinitionV1 {
  id: string;
  name: string;
  icon: string;
  kind: HarthmereAbilityKindV1;
  cooldown: number;
  cost: number;
  resource: string;
  description: string;
  classRequirements?: HarthmereClassIdV1[];
  skillRequirements?: Record<string, number>;
  businessTypeId?: HarthmereEconomyBusinessTypeIdV1;
}

export interface HarthmereCollectibleDefinitionV1 {
  id: string;
  name: string;
  icon: string;
  categoryId: string;
  categoryName: string;
  source: "npc" | "quest" | "landmark" | "economy";
}

export interface HarthmereProgressionCollectionsStateV1 {
  discovered: Record<string, number>;
}

export interface HarthmereClassMagicStateLikeV1 {
  classId?: string;
  specializationId?: string;
  knownAbilities?: string[];
  skills?: Record<string, { xp?: number; level?: number }>;
  loadout?: Record<string, string | undefined>;
}

const CLASS_DEFS: Record<HarthmereClassIdV1, HarthmereClassDefinitionV1> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    tagline: "Front-line protector who turns discipline into momentum.",
    resource: "Stamina",
    roles: ["tank", "damage", "support"],
    startingAbilities: ["basic_strike", "power_strike", "guarded_block"],
    startingSkills: { character_level: 1, melee_combat: 1, shield_mastery: 1 },
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    tagline: "Mobile infiltrator for locks, traps, and fast exits.",
    resource: "Energy",
    roles: ["damage", "scout", "controller"],
    startingAbilities: ["basic_strike", "backstab", "pick_lock"],
    startingSkills: { character_level: 1, dagger_mastery: 1, lockpicking: 1 },
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    tagline: "Road-wise scout who reads tracks before maps do.",
    resource: "Focus",
    roles: ["damage", "scout", "support"],
    startingAbilities: ["basic_strike", "hunters_mark", "track_beast"],
    startingSkills: { character_level: 1, archery: 1, tracking: 1 },
  },
  mage: {
    id: "mage",
    name: "Mage",
    tagline: "Arcane problem solver for seals, wards, and controlled force.",
    resource: "Mana",
    roles: ["damage", "controller", "support"],
    startingAbilities: ["spark", "mana_shield", "read_runes"],
    startingSkills: { character_level: 1, fire_magic: 1, arcane_literacy: 1 },
  },
  priest: {
    id: "priest",
    name: "Priest",
    tagline: "Healer and witness who keeps people useful through trouble.",
    resource: "Faith",
    roles: ["healer", "support"],
    startingAbilities: ["minor_heal", "blessing", "cleanse"],
    startingSkills: { character_level: 1, holy_magic: 1, medicine: 1 },
  },
  paladin: {
    id: "paladin",
    name: "Paladin",
    tagline: "Legal defender whose oath protects people and property.",
    resource: "Conviction",
    roles: ["tank", "healer", "damage"],
    startingAbilities: ["smite", "shield_of_faith", "judgment"],
    startingSkills: { character_level: 1, melee_combat: 1, holy_magic: 1 },
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    tagline: "Forbidden specialist for death, memory, and difficult truths.",
    resource: "Souls",
    roles: ["summoner", "damage", "controller"],
    startingAbilities: ["life_drain", "curse_of_weakness", "speak_with_dead"],
    startingSkills: { character_level: 1, death_lore: 1, shadow_magic: 1 },
  },
  druid: {
    id: "druid",
    name: "Druid",
    tagline: "Restores damaged land and turns ecology into leverage.",
    resource: "Mana",
    roles: ["healer", "tank", "support"],
    startingAbilities: ["rejuvenation", "entangling_roots", "speak_with_animals"],
    startingSkills: { character_level: 1, nature_magic: 1, farming: 1 },
  },
  bard: {
    id: "bard",
    name: "Bard",
    tagline: "Social specialist for morale, rumors, and public trust.",
    resource: "Inspiration",
    roles: ["support", "healer", "controller"],
    startingAbilities: ["song_of_courage", "mocking_verse", "rumor_song"],
    startingSkills: { character_level: 1, persuasion: 1, performance: 1 },
  },
};

export const HARTHMERE_CLASS_DEFINITIONS_V1 = CLASS_DEFS;

export const HARTHMERE_SKILL_DEFINITIONS_V1: Record<string, HarthmereSkillDefinitionV1> = {
  character_level: { id: "character_level", name: "Character Level", category: "Core", description: "Overall adventuring progression.", maxLevel: 100 },
  combat: { id: "combat", name: "Combat", category: "Combat", description: "General battle participation across weapon and spell roles.", maxLevel: 100 },
  melee_combat: { id: "melee_combat", name: "Melee Combat", category: "Combat", description: "Close combat reliability, blocking, and weapon pressure.", maxLevel: 100 },
  ranged_combat: { id: "ranged_combat", name: "Ranged Combat", category: "Combat", description: "Bow, crossbow, thrown, and careful distance pressure.", maxLevel: 100 },
  shield_mastery: { id: "shield_mastery", name: "Shield Mastery", category: "Combat", description: "Guarding allies, bracing, and shield control.", maxLevel: 100 },
  dagger_mastery: { id: "dagger_mastery", name: "Dagger Mastery", category: "Weapon", description: "Fast blade work, opening strikes, and precision cuts.", maxLevel: 100 },
  lockpicking: { id: "lockpicking", name: "Lockpicking", category: "Exploration", description: "Opening legal quest locks and disarming lock traps.", maxLevel: 100 },
  archery: { id: "archery", name: "Archery", category: "Weapon", description: "Bow, crossbow, and careful ranged pressure.", maxLevel: 100 },
  tracking: { id: "tracking", name: "Tracking", category: "Exploration", description: "Reading footprints, safe paths, and animal signs.", maxLevel: 100 },
  fire_magic: { id: "fire_magic", name: "Fire Magic", category: "Magic", description: "Controlled heat, sparks, and destructive spellcraft.", maxLevel: 100 },
  arcane_literacy: { id: "arcane_literacy", name: "Arcane Literacy", category: "Magic", description: "Reading seals, runes, wards, and magical machinery.", maxLevel: 100 },
  holy_magic: { id: "holy_magic", name: "Holy Magic", category: "Magic", description: "Healing, cleansing, blessing, and radiant protection.", maxLevel: 100 },
  medicine: { id: "medicine", name: "Medicine", category: "Profession", description: "Treatment, triage, antidotes, and field care.", maxLevel: 100 },
  death_lore: { id: "death_lore", name: "Death Lore", category: "Magic", description: "Spirits, graves, curses, and memory left behind.", maxLevel: 100 },
  shadow_magic: { id: "shadow_magic", name: "Shadow Magic", category: "Magic", description: "Curses, drains, concealment, and risky bargains.", maxLevel: 100 },
  nature_magic: { id: "nature_magic", name: "Nature Magic", category: "Magic", description: "Plants, animals, soil restoration, and living wards.", maxLevel: 100 },
  farming: { id: "farming", name: "Farming", category: "Profession", description: "Growing, harvesting, watering, and yield care.", maxLevel: 100 },
  mining: { id: "mining", name: "Mining", category: "Gathering", description: "Extracting ore, stone, gems, and underground resources safely.", maxLevel: 100 },
  gathering: { id: "gathering", name: "Gathering", category: "Gathering", description: "Harvesting legal world resources without damaging ownership or ecology.", maxLevel: 100 },
  crafting: { id: "crafting", name: "Crafting", category: "Crafting", description: "Turning materials into useful gear, tools, repairs, and services.", maxLevel: 100 },
  care: { id: "care", name: "Care", category: "Profession", description: "Animal, plant, patient, and upkeep routines that reward meaningful maintenance.", maxLevel: 100 },
  persuasion: { id: "persuasion", name: "Persuasion", category: "Social", description: "Negotiation, de-escalation, and better public outcomes.", maxLevel: 100 },
  performance: { id: "performance", name: "Performance", category: "Social", description: "Crowd work, morale, story, and rumor handling.", maxLevel: 100 },
  business_operations: { id: "business_operations", name: "Business Operations", category: "Business", description: "Pricing, staff, contracts, storage, safety, and service quality.", maxLevel: 100 },
};

export const HARTHMERE_SKILL_XP_PER_LEVEL_V1 = 1000;

export function isHarthmereSkillIdV1(value: string | undefined): value is string {
  return !!value && value in HARTHMERE_SKILL_DEFINITIONS_V1;
}

export function harthmereSkillTotalXpCapV1(skillId: string) {
  const maxLevel = HARTHMERE_SKILL_DEFINITIONS_V1[skillId]?.maxLevel ?? 1;
  return Math.max(0, (maxLevel - 1) * HARTHMERE_SKILL_XP_PER_LEVEL_V1);
}

export function harthmereSkillLevelFromTotalXpV1(skillId: string, totalXp: number) {
  const def = HARTHMERE_SKILL_DEFINITIONS_V1[skillId];
  const maxLevel = def?.maxLevel ?? 1;
  const safeXp = Math.max(0, Math.trunc(Number.isFinite(totalXp) ? totalXp : 0));
  return Math.min(maxLevel, 1 + Math.floor(safeXp / HARTHMERE_SKILL_XP_PER_LEVEL_V1));
}

export function harthmereSkillProgressFromTotalXpV1(skillId: string, totalXp: number) {
  const cappedTotalXp = Math.min(
    harthmereSkillTotalXpCapV1(skillId),
    Math.max(0, Math.trunc(Number.isFinite(totalXp) ? totalXp : 0))
  );
  const level = harthmereSkillLevelFromTotalXpV1(skillId, cappedTotalXp);
  const atCap = level >= (HARTHMERE_SKILL_DEFINITIONS_V1[skillId]?.maxLevel ?? level);
  return {
    level,
    totalXp: cappedTotalXp,
    xp: atCap ? HARTHMERE_SKILL_XP_PER_LEVEL_V1 : cappedTotalXp % HARTHMERE_SKILL_XP_PER_LEVEL_V1,
    nextLevel: HARTHMERE_SKILL_XP_PER_LEVEL_V1,
    atCap,
  };
}

const CORE_ABILITIES: Record<string, HarthmereAbilityDefinitionV1> = {
  basic_strike: { id: "basic_strike", name: "Basic Strike", icon: "BS", kind: "combat", cooldown: 1, cost: 0, resource: "Stamina", description: "A reliable weapon attack with the equipped main-hand item." },
  power_strike: { id: "power_strike", name: "Power Strike", icon: "PS", kind: "combat", cooldown: 4, cost: 18, resource: "Stamina", description: "A heavy melee attack for breaking guard.", classRequirements: ["warrior", "paladin"], skillRequirements: { melee_combat: 1 } },
  guarded_block: { id: "guarded_block", name: "Guarded Block", icon: "GB", kind: "combat", cooldown: 8, cost: 10, resource: "Stamina", description: "Brace and reduce incoming pressure.", classRequirements: ["warrior", "paladin"], skillRequirements: { shield_mastery: 1 } },
  backstab: { id: "backstab", name: "Backstab", icon: "BK", kind: "combat", cooldown: 6, cost: 25, resource: "Energy", description: "A precise strike that rewards position and timing.", classRequirements: ["rogue"], skillRequirements: { dagger_mastery: 1 } },
  pick_lock: { id: "pick_lock", name: "Pick Lock", icon: "LK", kind: "utility", cooldown: 3, cost: 8, resource: "Energy", description: "Open valid quest locks and legal utility locks.", classRequirements: ["rogue"], skillRequirements: { lockpicking: 1 } },
  hunters_mark: { id: "hunters_mark", name: "Hunter's Mark", icon: "HM", kind: "combat", cooldown: 10, cost: 15, resource: "Focus", description: "Mark a target so allies can track and pressure it.", classRequirements: ["ranger"], skillRequirements: { tracking: 1 } },
  track_beast: { id: "track_beast", name: "Track Beast", icon: "TB", kind: "utility", cooldown: 8, cost: 5, resource: "Focus", description: "Reveal nearby animal signs and safer approach lines.", classRequirements: ["ranger"], skillRequirements: { tracking: 1 } },
  spark: { id: "spark", name: "Spark", icon: "SP", kind: "combat", cooldown: 2, cost: 8, resource: "Mana", description: "A small controlled flame for combat and utility.", classRequirements: ["mage"], skillRequirements: { fire_magic: 1 } },
  mana_shield: { id: "mana_shield", name: "Mana Shield", icon: "MS", kind: "combat", cooldown: 18, cost: 25, resource: "Mana", description: "Convert mana into short-lived protection.", classRequirements: ["mage"], skillRequirements: { arcane_literacy: 1 } },
  read_runes: { id: "read_runes", name: "Read Runes", icon: "RR", kind: "utility", cooldown: 4, cost: 4, resource: "Mana", description: "Decode seals, wards, and magical signs.", classRequirements: ["mage"], skillRequirements: { arcane_literacy: 1 } },
  minor_heal: { id: "minor_heal", name: "Minor Heal", icon: "MH", kind: "combat", cooldown: 5, cost: 18, resource: "Faith", description: "Restore a small amount of health to an ally.", classRequirements: ["priest"], skillRequirements: { holy_magic: 1 } },
  blessing: { id: "blessing", name: "Blessing", icon: "BL", kind: "utility", cooldown: 20, cost: 20, resource: "Faith", description: "Improve ally resolve and reduce panic.", classRequirements: ["priest", "paladin"], skillRequirements: { holy_magic: 1 } },
  cleanse: { id: "cleanse", name: "Cleanse", icon: "CL", kind: "utility", cooldown: 12, cost: 16, resource: "Faith", description: "Remove minor corruption or contamination effects.", classRequirements: ["priest"], skillRequirements: { holy_magic: 1 } },
  smite: { id: "smite", name: "Smite", icon: "SM", kind: "combat", cooldown: 5, cost: 18, resource: "Conviction", description: "A lawful radiant strike.", classRequirements: ["paladin"], skillRequirements: { holy_magic: 1 } },
  shield_of_faith: { id: "shield_of_faith", name: "Shield of Faith", icon: "SF", kind: "combat", cooldown: 15, cost: 24, resource: "Conviction", description: "Protect an ally with oath-backed warding.", classRequirements: ["paladin"], skillRequirements: { holy_magic: 1 } },
  judgment: { id: "judgment", name: "Judgment", icon: "JG", kind: "social", cooldown: 30, cost: 20, resource: "Conviction", description: "Call out a hostile or unlawful act in a way guards understand.", classRequirements: ["paladin"], skillRequirements: { persuasion: 1 } },
  life_drain: { id: "life_drain", name: "Life Drain", icon: "LD", kind: "combat", cooldown: 8, cost: 12, resource: "Souls", description: "Pull vitality from a hostile target.", classRequirements: ["necromancer"], skillRequirements: { shadow_magic: 1 } },
  curse_of_weakness: { id: "curse_of_weakness", name: "Curse of Weakness", icon: "CW", kind: "combat", cooldown: 12, cost: 16, resource: "Souls", description: "Reduce a target's pressure for a short window.", classRequirements: ["necromancer"], skillRequirements: { shadow_magic: 1 } },
  speak_with_dead: { id: "speak_with_dead", name: "Speak with Dead", icon: "SD", kind: "utility", cooldown: 60, cost: 25, resource: "Souls", description: "Ask a memory-bound spirit for one useful clue.", classRequirements: ["necromancer"], skillRequirements: { death_lore: 1 } },
  rejuvenation: { id: "rejuvenation", name: "Rejuvenation", icon: "RJ", kind: "combat", cooldown: 6, cost: 15, resource: "Mana", description: "Encourage living tissue to recover over time.", classRequirements: ["druid"], skillRequirements: { nature_magic: 1 } },
  entangling_roots: { id: "entangling_roots", name: "Entangling Roots", icon: "ER", kind: "combat", cooldown: 14, cost: 20, resource: "Mana", description: "Snare a hostile target with nearby roots.", classRequirements: ["druid"], skillRequirements: { nature_magic: 1 } },
  speak_with_animals: { id: "speak_with_animals", name: "Speak with Animals", icon: "SA", kind: "utility", cooldown: 20, cost: 10, resource: "Mana", description: "Read animal behavior as usable information.", classRequirements: ["druid"], skillRequirements: { nature_magic: 1 } },
  song_of_courage: { id: "song_of_courage", name: "Song of Courage", icon: "SC", kind: "social", cooldown: 20, cost: 18, resource: "Inspiration", description: "Raise group morale and reduce fear.", classRequirements: ["bard"], skillRequirements: { performance: 1 } },
  mocking_verse: { id: "mocking_verse", name: "Mocking Verse", icon: "MV", kind: "combat", cooldown: 8, cost: 10, resource: "Inspiration", description: "Distract an enemy with a sharply timed insult.", classRequirements: ["bard"], skillRequirements: { performance: 1 } },
  rumor_song: { id: "rumor_song", name: "Rumor Song", icon: "RS", kind: "social", cooldown: 30, cost: 16, resource: "Inspiration", description: "Turn public chatter into actionable local knowledge.", classRequirements: ["bard"], skillRequirements: { persuasion: 1 } },
};

const BUSINESS_ABILITY_PATTERNS = [
  ["Intake Forecast", "Forecast demand from town needs and recent orders before buying stock."],
  ["Supplier Contract", "Create a cleaner recurring supply plan with fewer stock gaps."],
  ["Quality Inspection", "Catch bad batches, weak repairs, and service failures before customers do."],
  ["Staff Rotation", "Assign workers to the right shift while keeping morale steady."],
  ["Price Tuning", "Adjust prices to demand without damaging reputation."],
  ["Safety Protocol", "Reduce operational risk, injuries, contamination, or travel losses."],
  ["Waste Recovery", "Recover reusable inputs and lower cleanup costs."],
  ["Customer Promise", "Turn a clear service guarantee into better satisfaction."],
  ["Route Coordination", "Coordinate deliveries, travel, field calls, or pickups more reliably."],
  ["Emergency Playbook", "Respond to outages, attacks, spoilage, sickness, or contract failures."],
] as const;

function businessAbilityId(typeId: string, suffix: string) {
  return `business_${typeId}_${suffix.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

export const HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1: Record<string, HarthmereAbilityDefinitionV1> =
  Object.fromEntries(
    Object.values(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1).flatMap((business) =>
      BUSINESS_ABILITY_PATTERNS.map(([name, description], index) => {
        const input = business.inputItemFamilies[index % business.inputItemFamilies.length] ?? "stock";
        const output = business.outputItemFamilies[index % business.outputItemFamilies.length] ?? "service";
        const need = business.serviceNeeds[index % business.serviceNeeds.length] ?? "customers";
        const ability: HarthmereAbilityDefinitionV1 = {
          id: businessAbilityId(business.typeId, name),
          name: `${business.displayName}: ${name}`,
          icon: `B${index + 1}`,
          kind: "business",
          cooldown: 60 + index * 15,
          cost: 5 + Math.max(1, business.riskLevel) * 2,
          resource: "Focus",
          businessTypeId: business.typeId,
          skillRequirements: { business_operations: Math.max(1, Math.min(10, business.minimumLicenseLevel)) },
          description: `${description} Uses ${input} to improve ${output} for ${need} work.`,
        };
        return [ability.id, ability];
      })
    )
  );

export const HARTHMERE_ABILITY_DEFINITIONS_V1: Record<string, HarthmereAbilityDefinitionV1> = {
  ...CORE_ABILITIES,
  ...HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1,
};

export const HARTHMERE_COLLECTIBLE_DEFINITIONS_V1: Record<string, HarthmereCollectibleDefinitionV1> = Object.fromEntries([
  ...SNAPSHOT_GROVE_NPCS_V75.map((npc) => [`npc:${npc.id}`, {
    id: `npc:${npc.id}`,
    name: npc.displayName,
    icon: "NP",
    categoryId: "grove_people",
    categoryName: "Grove People",
    source: "npc" as const,
  }]),
  ...SNAPSHOT_GROVE_QUESTS_V75.map((quest) => [`quest:${quest.id}`, {
    id: `quest:${quest.id}`,
    name: quest.title,
    icon: "Q",
    categoryId: "grove_lessons",
    categoryName: "Grove Lessons",
    source: "quest" as const,
  }]),
  ...SNAPSHOT_GROVE_LANDMARKS_V75.filter((landmark) => landmark.visibleOnWorldMap).map((landmark) => [`landmark:${landmark.id}`, {
    id: `landmark:${landmark.id}`,
    name: landmark.label,
    icon: "LM",
    categoryId: "grove_places",
    categoryName: "Grove Places",
    source: "landmark" as const,
  }]),
  ...Object.values(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1).map((business) => [`economy:${business.typeId}`, {
    id: `economy:${business.typeId}`,
    name: business.displayName,
    icon: "EC",
    categoryId: "economy_businesses",
    categoryName: "Economy Businesses",
    source: "economy" as const,
  }]),
]);

export function isHarthmereClassIdV1(value: string | undefined): value is HarthmereClassIdV1 {
  return !!value && value in HARTHMERE_CLASS_DEFINITIONS_V1;
}

export function defaultHarthmereProgressionCollectionsStateV1(): HarthmereProgressionCollectionsStateV1 {
  return { discovered: {} };
}

export function normalizeHarthmereProgressionCollectionsStateV1(
  raw: Partial<HarthmereProgressionCollectionsStateV1> | undefined
): HarthmereProgressionCollectionsStateV1 {
  const discovered: Record<string, number> = {};
  for (const [id, at] of Object.entries(raw?.discovered ?? {})) {
    if (HARTHMERE_COLLECTIBLE_DEFINITIONS_V1[id] && Number.isFinite(Number(at))) {
      discovered[id] = Number(at);
    }
  }
  return { discovered };
}

export function applyHarthmereClassChoiceV1(
  classMagic: HarthmereClassMagicStateLikeV1,
  classId: string | undefined
): { ok: boolean; warning?: string } {
  if (!isHarthmereClassIdV1(classId)) {
    return { ok: false, warning: "class_rejected:unknown_class" };
  }
  const def = HARTHMERE_CLASS_DEFINITIONS_V1[classId];
  classMagic.classId = classId;
  classMagic.knownAbilities = Array.from(new Set([...(classMagic.knownAbilities ?? []), ...def.startingAbilities]));
  classMagic.skills ??= {};
  for (const [skillId, level] of Object.entries(def.startingSkills)) {
    const current = classMagic.skills[skillId] ?? { xp: 0, level: 0 };
    classMagic.skills[skillId] = { xp: Number(current.xp ?? 0), level: Math.max(Number(current.level ?? 0), level) };
  }
  return { ok: true };
}

export function ownedBusinessTypeIdsForActorV1(
  economy: HarthmereProductionEconomyStateV1 | undefined,
  actorId: string
): Set<HarthmereEconomyBusinessTypeIdV1> {
  const result = new Set<HarthmereEconomyBusinessTypeIdV1>();
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

export function knownHarthmereAbilityIdsV1(classMagic: HarthmereClassMagicStateLikeV1): Set<string> {
  const classId = isHarthmereClassIdV1(classMagic.classId) ? classMagic.classId : "warrior";
  return new Set([...(classMagic.knownAbilities ?? []), ...HARTHMERE_CLASS_DEFINITIONS_V1[classId].startingAbilities]);
}

export function canLearnHarthmereAbilityV1(input: {
  classMagic: HarthmereClassMagicStateLikeV1;
  economy?: HarthmereProductionEconomyStateV1;
  actorId: string;
  abilityId: string | undefined;
}): { ok: boolean; warning?: string } {
  const ability = input.abilityId ? HARTHMERE_ABILITY_DEFINITIONS_V1[input.abilityId] : undefined;
  if (!ability) return { ok: false, warning: "ability_rejected:unknown_ability" };
  if (ability.classRequirements?.length && !ability.classRequirements.includes(input.classMagic.classId as HarthmereClassIdV1)) {
    return { ok: false, warning: "ability_rejected:class_requirement" };
  }
  if (ability.businessTypeId && !ownedBusinessTypeIdsForActorV1(input.economy, input.actorId).has(ability.businessTypeId)) {
    return { ok: false, warning: `ability_rejected:business_required:${ability.businessTypeId}` };
  }
  for (const [skillId, required] of Object.entries(ability.skillRequirements ?? {})) {
    if (Number(input.classMagic.skills?.[skillId]?.level ?? 0) < required) {
      return { ok: false, warning: `ability_rejected:skill_required:${skillId}:${required}` };
    }
  }
  return { ok: true };
}

export function createHarthmereProgressionClientSnapshotV1(input: {
  actorId: string;
  classMagic: HarthmereClassMagicStateLikeV1;
  economy?: HarthmereProductionEconomyStateV1;
  collections?: HarthmereProgressionCollectionsStateV1;
}) {
  const classId = isHarthmereClassIdV1(input.classMagic.classId)
    ? input.classMagic.classId
    : "warrior";
  const classDef = HARTHMERE_CLASS_DEFINITIONS_V1[classId];
  const knownAbilityIds = Array.from(knownHarthmereAbilityIdsV1(input.classMagic));
  const ownedBusinessTypes = ownedBusinessTypeIdsForActorV1(input.economy, input.actorId);
  const collectionState = normalizeHarthmereProgressionCollectionsStateV1(input.collections);

  return {
    version: HARTHMERE_CLASS_ABILITY_COLLECTIBLES_VERSION_V1,
    actorId: input.actorId,
    classes: Object.values(HARTHMERE_CLASS_DEFINITIONS_V1),
    currentClassId: classId,
    skills: Object.values(HARTHMERE_SKILL_DEFINITIONS_V1).map((skill) => {
      const state = input.classMagic.skills?.[skill.id] ?? { xp: 0, level: 0 };
      const totalXp = Math.max(0, Math.trunc(Number(state.xp ?? 0)));
      const progress = harthmereSkillProgressFromTotalXpV1(skill.id, totalXp);
      const level = Math.max(
        progress.level,
        Math.min(skill.maxLevel, Math.trunc(Number(state.level ?? 0)))
      );
      const xp = progress.xp;
      const nextLevel = progress.nextLevel;
      return { ...skill, level, xp, nextLevel, title: level >= 50 ? "Adept" : level >= 25 ? "Apprentice" : level > 0 ? "Novice" : "Untrained" };
    }),
    abilities: Object.values(HARTHMERE_ABILITY_DEFINITIONS_V1).map((ability) => {
      const known = knownAbilityIds.includes(ability.id);
      const businessUnlocked = !ability.businessTypeId || ownedBusinessTypes.has(ability.businessTypeId);
      const learnable = canLearnHarthmereAbilityV1({ classMagic: input.classMagic, economy: input.economy, actorId: input.actorId, abilityId: ability.id }).ok;
      return { ...ability, known, unlocked: known || learnable, businessUnlocked };
    }),
    equipped: Array.from({ length: 8 }, (_unused, index) => input.classMagic.loadout?.[`slot_${index}`] ?? input.classMagic.loadout?.[String(index)] ?? null),
    collections: Object.values(HARTHMERE_COLLECTIBLE_DEFINITIONS_V1).map((entry) => ({
      ...entry,
      discovered: collectionState.discovered[entry.id] !== undefined,
      discoveredAtMs: collectionState.discovered[entry.id],
    })),
  };
}
