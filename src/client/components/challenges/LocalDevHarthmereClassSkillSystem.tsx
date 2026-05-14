import {
  healHarthmerePlayer,
  performHarthmereCombatAttack,
  readHarthmereCombatState,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  calculateHarthmereDerivedStats,
  readHarthmereLevelingState,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  applyHarthmereReputationChange,
  readHarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useEffect, useMemo, useState } from "react";

const HARTHMERE_CLASS_STATE_KEY =
  "biomes.localDev.harthmere.classSkillState.v1";
const HARTHMERE_CLASS_EVENT = "biomes:harthmere-class-skill-changed";

const SKILL_TITLES = [
  { min: 125, title: "Legendary" },
  { min: 100, title: "Grandmaster" },
  { min: 75, title: "Expert" },
  { min: 50, title: "Adept" },
  { min: 25, title: "Apprentice" },
  { min: 1, title: "Novice" },
  { min: 0, title: "Untrained" },
] as const;

type HarthmereClassId =
  | "warrior"
  | "rogue"
  | "ranger"
  | "mage"
  | "priest"
  | "paladin"
  | "necromancer"
  | "druid"
  | "bard";

type HarthmereRole =
  | "tank"
  | "healer"
  | "damage"
  | "support"
  | "controller"
  | "scout"
  | "summoner";

type HarthmereResourceType =
  | "stamina"
  | "rage"
  | "energy"
  | "focus"
  | "mana"
  | "faith"
  | "conviction"
  | "souls"
  | "inspiration";

type HarthmereAbilityType =
  | "basic_attack"
  | "active"
  | "spell"
  | "heal"
  | "passive"
  | "utility"
  | "social"
  | "world"
  | "ultimate";

type HarthmereSkillCategory =
  | "combat"
  | "weapon"
  | "armor"
  | "magic"
  | "profession"
  | "gathering"
  | "social"
  | "exploration"
  | "survival";

interface HarthmereClassDefinition {
  id: HarthmereClassId;
  name: string;
  summary: string;
  roles: HarthmereRole[];
  primaryAttributes: string[];
  secondaryAttributes: string[];
  armor: string[];
  weapons: string[];
  resource: HarthmereResourceType;
  specializations: string[];
  startingAbilities: string[];
  worldInteractions: string[];
  npcReaction: string;
}

interface HarthmereSkillDefinition {
  id: string;
  name: string;
  category: HarthmereSkillCategory;
  maxLevel: number;
  improvesBy: string[];
  worldUses: string[];
  milestones: { level: number; label: string; unlockAbility?: string }[];
  antiAbuse: string;
}

interface HarthmereAbilityDefinition {
  id: string;
  name: string;
  type: HarthmereAbilityType;
  classRequirements?: HarthmereClassId[];
  levelRequirement: number;
  skillRequirements?: Record<string, number>;
  resourceType?: HarthmereResourceType;
  resourceCost?: number;
  cooldownSeconds: number;
  range: number;
  targetType: "self" | "ally" | "enemy" | "object" | "area" | "dialogue";
  requiresWeapon?: string[];
  effect: string;
  scaling: string;
  pvpNote?: string;
  illegalInTown?: boolean;
  unlockHint: string;
}

interface HarthmereSkillState {
  level: number;
  xpCurrent: number;
  xpRequiredNext: number;
}

interface HarthmereClassLogEntry {
  id: string;
  at: number;
  label: string;
  detail: string;
}

interface HarthmereClassSkillState {
  version: 1;
  classId: HarthmereClassId;
  specialization?: string;
  resource: {
    type: HarthmereResourceType;
    current: number;
    max: number;
  };
  knownAbilities: string[];
  equippedAbilities: Record<string, string | undefined>;
  talents: string[];
  loadoutName: string;
  skills: Record<string, HarthmereSkillState>;
  cooldowns: Record<string, number>;
  recent: HarthmereClassLogEntry[];
}

const CLASS_DEFINITIONS: Record<HarthmereClassId, HarthmereClassDefinition> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    summary:
      "Direct physical fighter. Uses blades, shields, battle cries, stamina, and rage to protect allies or break enemies.",
    roles: ["tank", "damage", "support"],
    primaryAttributes: ["Strength", "Constitution"],
    secondaryAttributes: ["Willpower"],
    armor: ["medium", "heavy", "shield"],
    weapons: ["sword", "axe", "mace", "shield", "spear", "great weapon"],
    resource: "stamina",
    specializations: ["Guardian", "Berserker", "Warlord"],
    startingAbilities: ["basic_strike", "power_strike", "guarded_block"],
    worldInteractions: [
      "Move heavy objects",
      "Break weak doors",
      "Train militia",
      "Intimidate bandits",
    ],
    npcReaction:
      "Guards treat warriors as useful muscle. Civilians expect protection, not bullying.",
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    summary:
      "Mobile infiltrator. Uses daggers, stealth, lockpicks, poisons, energy, and critical strikes.",
    roles: ["damage", "controller", "scout"],
    primaryAttributes: ["Dexterity", "Perception"],
    secondaryAttributes: ["Luck"],
    armor: ["light"],
    weapons: ["dagger", "short sword", "bow", "throwing knife"],
    resource: "energy",
    specializations: ["Assassin", "Trickster", "Shadowblade"],
    startingAbilities: ["basic_strike", "backstab", "pick_lock"],
    worldInteractions: [
      "Pick locks",
      "Disarm traps",
      "Sneak through restricted areas",
      "Read criminal signs",
    ],
    npcReaction:
      "Merchants watch rogues more closely, while Mudden Ward contacts speak more freely.",
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    summary:
      "Wilderness fighter. Uses bows, traps, animal knowledge, tracking, and focus.",
    roles: ["damage", "scout", "support"],
    primaryAttributes: ["Dexterity", "Perception"],
    secondaryAttributes: ["Wisdom"],
    armor: ["light", "medium"],
    weapons: ["bow", "crossbow", "spear", "knife", "trap"],
    resource: "focus",
    specializations: ["Marksman", "Beast Warden", "Pathfinder"],
    startingAbilities: ["basic_strike", "hunters_mark", "track_beast"],
    worldInteractions: [
      "Track footprints",
      "Forage food",
      "Detect ambushes",
      "Calm or tame animals",
    ],
    npcReaction:
      "Farmers and guards value rangers when roads, animals, and tracks become a problem.",
  },
  mage: {
    id: "mage",
    name: "Mage",
    summary:
      "Arcane spellcaster. Uses mana, elemental magic, shields, utility, and magical knowledge.",
    roles: ["damage", "controller", "support"],
    primaryAttributes: ["Intelligence", "Willpower"],
    secondaryAttributes: ["Perception"],
    armor: ["cloth"],
    weapons: ["staff", "wand", "orb", "spell focus"],
    resource: "mana",
    specializations: ["Pyromancer", "Cryomancer", "Arcanist"],
    startingAbilities: ["spark", "mana_shield", "read_runes"],
    worldInteractions: [
      "Identify magic",
      "Open arcane seals",
      "Stabilize ley residue",
      "Light braziers with cantrips",
    ],
    npcReaction:
      "Scholars are curious about mages. Commoners respect them, but destructive magic in town worries guards.",
  },
  priest: {
    id: "priest",
    name: "Priest",
    summary:
      "Healer and spiritual support. Uses faith or mana for healing, cleansing, blessings, and anti-undead magic.",
    roles: ["healer", "support", "damage"],
    primaryAttributes: ["Wisdom", "Charisma"],
    secondaryAttributes: ["Willpower"],
    armor: ["cloth", "light"],
    weapons: ["staff", "mace", "holy symbol", "tome"],
    resource: "faith",
    specializations: ["Life Priest", "Lightbearer", "Oracle"],
    startingAbilities: ["minor_heal", "blessing", "cleanse"],
    worldInteractions: [
      "Heal sickness",
      "Bless homes",
      "Calm spirits",
      "Detect corruption",
    ],
    npcReaction:
      "Temple folk welcome priests quickly. Criminals assume they are informants unless proven otherwise.",
  },
  paladin: {
    id: "paladin",
    name: "Paladin",
    summary:
      "Lawful hybrid defender. Uses heavy armor, holy magic, conviction, shields, and judgment.",
    roles: ["tank", "healer", "support", "damage"],
    primaryAttributes: ["Strength", "Wisdom", "Charisma"],
    secondaryAttributes: ["Constitution"],
    armor: ["heavy", "shield"],
    weapons: ["sword", "mace", "shield", "holy weapon"],
    resource: "conviction",
    specializations: ["Protection", "Devotion", "Wrath"],
    startingAbilities: ["smite", "shield_of_faith", "judgment"],
    worldInteractions: [
      "Invoke legal authority",
      "Protect civilians",
      "Judge criminals",
      "Bless safe routes",
    ],
    npcReaction:
      "Guards defer to paladins with clean legal standing. Outlaws test whether the oath is real.",
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    summary:
      "Dark summoner. Uses souls, curses, life drain, corpse magic, and forbidden knowledge.",
    roles: ["summoner", "damage", "controller"],
    primaryAttributes: ["Intelligence", "Willpower"],
    secondaryAttributes: ["Constitution"],
    armor: ["cloth", "light"],
    weapons: ["staff", "dagger", "skull focus", "tome"],
    resource: "souls",
    specializations: ["Bonecaller", "Soulweaver", "Lichbinder"],
    startingAbilities: ["life_drain", "curse_of_weakness", "speak_with_dead"],
    worldInteractions: [
      "Speak with dead",
      "Detect death magic",
      "Bind restless spirits",
      "Read grave sigils",
    ],
    npcReaction:
      "Holy NPCs distrust necromancers. Mudden Ward and graveyard contacts may know why that power is useful.",
  },
  druid: {
    id: "druid",
    name: "Druid",
    summary:
      "Nature hybrid. Uses mana and nature energy to heal, root, shapeshift, and restore damaged land.",
    roles: ["healer", "tank", "damage", "support"],
    primaryAttributes: ["Wisdom", "Constitution"],
    secondaryAttributes: ["Dexterity"],
    armor: ["leather", "natural armor"],
    weapons: ["staff", "sickle", "spear", "claw form"],
    resource: "mana",
    specializations: ["Guardian", "Restoration", "Wildshape", "Naturecaller"],
    startingAbilities: [
      "rejuvenation",
      "entangling_roots",
      "speak_with_animals",
    ],
    worldInteractions: [
      "Speak with animals",
      "Grow plants",
      "Cleanse polluted soil",
      "Calm beasts",
    ],
    npcReaction:
      "Farmers appreciate druids. Woodcutters and hunters get nervous if the druid looks angry.",
  },
  bard: {
    id: "bard",
    name: "Bard",
    summary:
      "Social support. Uses inspiration, songs, rumors, morale, crowd control, and clever words.",
    roles: ["support", "healer", "controller", "damage"],
    primaryAttributes: ["Charisma", "Dexterity"],
    secondaryAttributes: ["Wisdom"],
    armor: ["light"],
    weapons: ["rapier", "dagger", "bow", "instrument"],
    resource: "inspiration",
    specializations: ["Maestro", "Skald", "Trick Singer"],
    startingAbilities: ["song_of_courage", "mocking_verse", "rumor_song"],
    worldInteractions: [
      "Perform for crowds",
      "Gather rumors",
      "Calm mobs",
      "Inspire workers",
    ],
    npcReaction:
      "Taverns welcome bards. Nobles listen for flattery, and guards listen for sedition.",
  },
};

const SKILL_DEFINITIONS: Record<string, HarthmereSkillDefinition> = {
  melee_combat: {
    id: "melee_combat",
    name: "Melee Combat",
    category: "combat",
    maxLevel: 100,
    improvesBy: ["Landing weapon attacks", "Blocking", "Using class strikes"],
    worldUses: ["Military training", "Dueling", "Intimidation context"],
    milestones: [
      { level: 10, label: "+2% melee reliability" },
      { level: 25, label: "Unlock Riposte", unlockAbility: "riposte" },
      { level: 50, label: "+5% melee damage" },
      {
        level: 75,
        label: "Unlock Whirlwind Slash",
        unlockAbility: "whirlwind_slash",
      },
      { level: 100, label: "Mastery: disciplined strikes" },
    ],
    antiAbuse:
      "Training dummies stop being meaningful after early practice. Real enemies or quests give better progress.",
  },
  sword_mastery: {
    id: "sword_mastery",
    name: "Sword Mastery",
    category: "weapon",
    maxLevel: 100,
    improvesBy: [
      "Using sword attacks",
      "Training with the Watch",
      "Winning fair fights",
    ],
    worldUses: ["Weapon drills", "Militia training", "Formal duel etiquette"],
    milestones: [
      { level: 10, label: "+2% sword accuracy" },
      { level: 25, label: "Unlock Riposte", unlockAbility: "riposte" },
      { level: 50, label: "+5% sword damage" },
      {
        level: 75,
        label: "Unlock Whirlwind Slash",
        unlockAbility: "whirlwind_slash",
      },
      { level: 100, label: "Sword Mastery passive" },
    ],
    antiAbuse:
      "Wall swinging and trivial targets do not grant useful progress.",
  },
  dagger_mastery: {
    id: "dagger_mastery",
    name: "Dagger Mastery",
    category: "weapon",
    maxLevel: 100,
    improvesBy: ["Dagger strikes", "Backstab practice", "Rogue training"],
    worldUses: ["Silent takedowns", "Cut purses", "Close knife work"],
    milestones: [
      { level: 10, label: "+2% dagger crit chance" },
      { level: 25, label: "Unlock Backstab", unlockAbility: "backstab" },
      { level: 50, label: "Reduced energy cost" },
      { level: 75, label: "Unlock Smoke Bomb", unlockAbility: "smoke_bomb" },
      { level: 100, label: "Mastery: precise wounds" },
    ],
    antiAbuse: "Harmless civilians and repeated fake attacks give no mastery.",
  },
  shield_mastery: {
    id: "shield_mastery",
    name: "Shield Mastery",
    category: "armor",
    maxLevel: 100,
    improvesBy: ["Blocking", "Guarding allies", "Using shield abilities"],
    worldUses: ["Hold gates", "Protect workers", "Lead defensive lines"],
    milestones: [
      { level: 10, label: "+2% block value" },
      { level: 25, label: "Unlock Shield Bash", unlockAbility: "shield_bash" },
      { level: 50, label: "+5% physical mitigation" },
      { level: 75, label: "Unlock Guard Ally", unlockAbility: "guard_ally" },
      { level: 100, label: "Mastery: cannot be easily staggered" },
    ],
    antiAbuse:
      "Only real blocked pressure or guard-yard drills grant progress.",
  },
  fire_magic: {
    id: "fire_magic",
    name: "Fire Magic",
    category: "magic",
    maxLevel: 100,
    improvesBy: ["Casting Spark", "Lighting ritual braziers", "Mage training"],
    worldUses: [
      "Light torches",
      "Burn webs",
      "Melt ice",
      "Intimidate creatures",
    ],
    milestones: [
      { level: 1, label: "Spark", unlockAbility: "spark" },
      { level: 10, label: "Ignite", unlockAbility: "ignite" },
      { level: 25, label: "Fireball", unlockAbility: "fireball" },
      { level: 75, label: "Meteor", unlockAbility: "meteor" },
      { level: 100, label: "Inferno Mastery" },
    ],
    antiAbuse:
      "Casting destructive fire magic in town may be illegal. Empty spam gives reduced progress.",
  },
  holy_magic: {
    id: "holy_magic",
    name: "Holy Magic",
    category: "magic",
    maxLevel: 100,
    improvesBy: ["Healing", "Cleansing", "Blessing town projects"],
    worldUses: ["Heal sickness", "Bless homes", "Turn undead", "Calm spirits"],
    milestones: [
      { level: 10, label: "Blessing lasts longer" },
      {
        level: 25,
        label: "Unlock Prayer of Protection",
        unlockAbility: "prayer_of_protection",
      },
      { level: 50, label: "+5% healing power" },
      { level: 75, label: "Unlock Sanctuary", unlockAbility: "sanctuary" },
      { level: 100, label: "Mastery: radiant resolve" },
    ],
    antiAbuse:
      "Healing full-health targets repeatedly does not train the skill.",
  },
  lockpicking: {
    id: "lockpicking",
    name: "Lockpicking",
    category: "exploration",
    maxLevel: 100,
    improvesBy: [
      "Opening valid locks",
      "Disarming lock traps",
      "Rogue instruction",
    ],
    worldUses: [
      "Open locked doors",
      "Access alternate quest paths",
      "Open treasure chests",
    ],
    milestones: [
      { level: 10, label: "Detect simple lock traps" },
      { level: 25, label: "Open iron locks" },
      { level: 60, label: "Disarm lock alarms" },
      { level: 100, label: "Master Locksmith" },
    ],
    antiAbuse:
      "Re-locking the same training box repeatedly gives sharply reduced progress.",
  },
  persuasion: {
    id: "persuasion",
    name: "Persuasion",
    category: "social",
    maxLevel: 100,
    improvesBy: [
      "Successful social choices",
      "Bard training",
      "Diplomatic quests",
    ],
    worldUses: ["Negotiate rewards", "Calm disputes", "Recruit followers"],
    milestones: [
      { level: 10, label: "Minor friendly options" },
      { level: 30, label: "Convince minor guards" },
      { level: 60, label: "Negotiate better quest rewards" },
      { level: 90, label: "Prevent some fights through dialogue" },
    ],
    antiAbuse:
      "Repeating the same harmless line does not create real social mastery.",
  },
  construction: {
    id: "construction",
    name: "Construction",
    category: "profession",
    maxLevel: 100,
    improvesBy: ["Building stages", "Repair work", "Town projects"],
    worldUses: ["Repair bridges", "Build workshops", "Improve guild halls"],
    milestones: [
      { level: 10, label: "Basic repair efficiency" },
      { level: 25, label: "Workshop projects" },
      { level: 50, label: "Guild hall improvements" },
      { level: 75, label: "Advanced structural repair" },
      { level: 100, label: "Master Builder" },
    ],
    antiAbuse:
      "Only real material-consuming construction grants full progress.",
  },
  leadership: {
    id: "leadership",
    name: "Leadership",
    category: "social",
    maxLevel: 100,
    improvesBy: ["Guild projects", "Group combat", "Training allies"],
    worldUses: [
      "Command militia",
      "Improve guild events",
      "Organize town defense",
    ],
    milestones: [
      { level: 10, label: "Better party coordination" },
      { level: 25, label: "Improved guild contribution rewards" },
      { level: 50, label: "Town command options" },
      { level: 100, label: "Master Commander" },
    ],
    antiAbuse: "AFK group membership does not grant leadership progress.",
  },
};

const ABILITY_DEFINITIONS: Record<string, HarthmereAbilityDefinition> = {
  basic_strike: {
    id: "basic_strike",
    name: "Basic Strike",
    type: "basic_attack",
    levelRequirement: 1,
    resourceType: "stamina",
    resourceCost: 0,
    cooldownSeconds: 1,
    range: 2,
    targetType: "enemy",
    effect:
      "A simple weapon attack using the currently equipped main-hand weapon.",
    scaling: "Weapon damage, level, Strength or Dexterity, and weapon mastery.",
    unlockHint: "Known by all classes.",
  },
  power_strike: {
    id: "power_strike",
    name: "Power Strike",
    type: "active",
    classRequirements: ["warrior", "paladin"],
    levelRequirement: 1,
    skillRequirements: { melee_combat: 1 },
    resourceType: "stamina",
    resourceCost: 18,
    cooldownSeconds: 4,
    range: 2,
    targetType: "enemy",
    requiresWeapon: ["sword", "axe", "mace", "spear", "dagger", "unarmed"],
    effect:
      "A heavy physical strike. In this local-dev build it routes to the heavy combat attack.",
    scaling: "Weapon attack, Strength, melee combat, and level difference.",
    unlockHint: "Starting Warrior/Paladin ability.",
  },
  guarded_block: {
    id: "guarded_block",
    name: "Guarded Block",
    type: "active",
    classRequirements: ["warrior", "paladin"],
    levelRequirement: 1,
    skillRequirements: { shield_mastery: 1 },
    resourceType: "stamina",
    resourceCost: 10,
    cooldownSeconds: 8,
    range: 0,
    targetType: "self",
    requiresWeapon: ["shield"],
    effect:
      "Brace behind a shield. Local-dev effect restores a small amount of survivability through discipline training.",
    scaling: "Constitution, Shield Mastery, and Defense.",
    unlockHint: "Starting Warrior defense option.",
  },
  shield_bash: {
    id: "shield_bash",
    name: "Shield Bash",
    type: "active",
    classRequirements: ["warrior", "paladin"],
    levelRequirement: 5,
    skillRequirements: { shield_mastery: 10 },
    resourceType: "stamina",
    resourceCost: 20,
    cooldownSeconds: 12,
    range: 2,
    targetType: "enemy",
    requiresWeapon: ["shield"],
    effect: "Damage, interrupt, and short stun. PvP stun is reduced.",
    scaling: "Defense, shield mastery, and Strength.",
    pvpNote:
      "PvP stun duration is reduced and affected by diminishing returns.",
    unlockHint: "Train Shield Mastery to 10 and reach level 5.",
  },
  backstab: {
    id: "backstab",
    name: "Backstab",
    type: "active",
    classRequirements: ["rogue"],
    levelRequirement: 1,
    skillRequirements: { dagger_mastery: 1 },
    resourceType: "energy",
    resourceCost: 25,
    cooldownSeconds: 6,
    range: 2,
    targetType: "enemy",
    requiresWeapon: ["dagger"],
    effect:
      "A precise dagger attack. Stronger when used from stealth or behind the target in production.",
    scaling: "Dexterity, dagger mastery, crit chance, and target awareness.",
    unlockHint: "Starting Rogue ability.",
  },
  pick_lock: {
    id: "pick_lock",
    name: "Pick Lock",
    type: "world",
    classRequirements: ["rogue"],
    levelRequirement: 1,
    skillRequirements: { lockpicking: 1 },
    resourceType: "energy",
    resourceCost: 10,
    cooldownSeconds: 3,
    range: 2,
    targetType: "object",
    effect: "Open a valid lock if skill and legal rules allow it.",
    scaling: "Dexterity, Perception, lockpicking skill, and tool quality.",
    illegalInTown: true,
    unlockHint: "Starting Rogue world interaction.",
  },
  hunters_mark: {
    id: "hunters_mark",
    name: "Hunter's Mark",
    type: "active",
    classRequirements: ["ranger"],
    levelRequirement: 1,
    skillRequirements: { melee_combat: 1 },
    resourceType: "focus",
    resourceCost: 12,
    cooldownSeconds: 8,
    range: 20,
    targetType: "enemy",
    effect: "Mark a target for better tracking and follow-up attacks.",
    scaling: "Perception and Ranger focus.",
    unlockHint: "Starting Ranger ability.",
  },
  track_beast: {
    id: "track_beast",
    name: "Track Beast",
    type: "world",
    classRequirements: ["ranger", "druid"],
    levelRequirement: 1,
    skillRequirements: { leadership: 1 },
    resourceType: "focus",
    resourceCost: 8,
    cooldownSeconds: 5,
    range: 30,
    targetType: "object",
    effect: "Read tracks and find nearby animal/resource clues.",
    scaling: "Perception, Wisdom, and tracking knowledge.",
    unlockHint: "Starting Ranger/Druid exploration option.",
  },
  spark: {
    id: "spark",
    name: "Spark",
    type: "spell",
    classRequirements: ["mage"],
    levelRequirement: 1,
    skillRequirements: { fire_magic: 1 },
    resourceType: "mana",
    resourceCost: 12,
    cooldownSeconds: 3,
    range: 18,
    targetType: "enemy",
    effect:
      "A small arcane-fire attack. This uses the current local-dev Spark combat attack.",
    scaling: "Intelligence, spell power, Fire Magic, and target resistance.",
    pvpNote: "PvP damage should be tuned separately in production.",
    unlockHint: "Starting Mage spell and starter combat cantrip.",
  },
  mana_shield: {
    id: "mana_shield",
    name: "Mana Shield",
    type: "active",
    classRequirements: ["mage"],
    levelRequirement: 1,
    skillRequirements: { fire_magic: 1 },
    resourceType: "mana",
    resourceCost: 20,
    cooldownSeconds: 15,
    range: 0,
    targetType: "self",
    effect: "Convert arcane focus into brief protection.",
    scaling: "Intelligence, Willpower, and magic skill.",
    unlockHint: "Starting Mage defense spell.",
  },
  read_runes: {
    id: "read_runes",
    name: "Read Runes",
    type: "world",
    classRequirements: ["mage"],
    levelRequirement: 1,
    skillRequirements: { fire_magic: 1 },
    resourceType: "mana",
    resourceCost: 4,
    cooldownSeconds: 2,
    range: 4,
    targetType: "object",
    effect: "Interpret simple magical writing, wards, and ley residue.",
    scaling: "Intelligence, Perception, and arcane training.",
    unlockHint: "Starting Mage world interaction.",
  },
  minor_heal: {
    id: "minor_heal",
    name: "Minor Heal",
    type: "heal",
    classRequirements: ["priest", "paladin", "druid", "bard"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "faith",
    resourceCost: 16,
    cooldownSeconds: 6,
    range: 20,
    targetType: "ally",
    effect:
      "Restore a small amount of HP to self or an ally. Local-dev version heals the player.",
    scaling: "Wisdom, Charisma, healing power, and Holy/Nature skill.",
    unlockHint: "Starting Priest support spell.",
  },
  blessing: {
    id: "blessing",
    name: "Blessing",
    type: "utility",
    classRequirements: ["priest", "paladin"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "faith",
    resourceCost: 10,
    cooldownSeconds: 8,
    range: 10,
    targetType: "ally",
    effect:
      "Bless a person, home, or task. Useful in social, temple, and repair contexts.",
    scaling: "Wisdom, Charisma, and legal/temple context.",
    unlockHint: "Starting Priest/Paladin utility.",
  },
  cleanse: {
    id: "cleanse",
    name: "Cleanse",
    type: "utility",
    classRequirements: ["priest", "paladin", "druid"],
    levelRequirement: 3,
    skillRequirements: { holy_magic: 5 },
    resourceType: "faith",
    resourceCost: 18,
    cooldownSeconds: 10,
    range: 10,
    targetType: "ally",
    effect: "Remove poison, disease, or weak corruption when rules allow it.",
    scaling: "Wisdom, holy/nature skill, and affliction difficulty.",
    unlockHint: "Reach level 3 and practice holy/nature magic.",
  },
  smite: {
    id: "smite",
    name: "Smite",
    type: "spell",
    classRequirements: ["paladin", "priest"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "conviction",
    resourceCost: 12,
    cooldownSeconds: 4,
    range: 12,
    targetType: "enemy",
    effect: "Holy attack against hostile targets.",
    scaling: "Wisdom, Strength or spell power, and Holy Magic.",
    unlockHint: "Starting Paladin holy attack.",
  },
  shield_of_faith: {
    id: "shield_of_faith",
    name: "Shield of Faith",
    type: "active",
    classRequirements: ["paladin", "priest"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "conviction",
    resourceCost: 18,
    cooldownSeconds: 14,
    range: 15,
    targetType: "ally",
    effect: "Protect an ally or yourself with holy defense.",
    scaling: "Wisdom, Charisma, Shield Mastery, and faith resource.",
    unlockHint: "Starting Paladin support spell.",
  },
  judgment: {
    id: "judgment",
    name: "Judgment",
    type: "social",
    classRequirements: ["paladin"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "conviction",
    resourceCost: 8,
    cooldownSeconds: 6,
    range: 8,
    targetType: "dialogue",
    effect: "Invoke law, mercy, or oath-bound authority in dialogue.",
    scaling: "Charisma, Wisdom, Legal Standing, and Paladin class identity.",
    unlockHint: "Starting Paladin dialogue option.",
  },
  life_drain: {
    id: "life_drain",
    name: "Life Drain",
    type: "spell",
    classRequirements: ["necromancer"],
    levelRequirement: 1,
    skillRequirements: { fire_magic: 1 },
    resourceType: "souls",
    resourceCost: 1,
    cooldownSeconds: 8,
    range: 14,
    targetType: "enemy",
    effect: "Drain life from a hostile target and recover a little vitality.",
    scaling: "Intelligence, Willpower, souls, and dark skill.",
    illegalInTown: true,
    unlockHint: "Starting Necromancer ability.",
  },
  curse_of_weakness: {
    id: "curse_of_weakness",
    name: "Curse of Weakness",
    type: "spell",
    classRequirements: ["necromancer"],
    levelRequirement: 1,
    skillRequirements: { fire_magic: 1 },
    resourceType: "souls",
    resourceCost: 1,
    cooldownSeconds: 10,
    range: 16,
    targetType: "enemy",
    effect:
      "Weaken a hostile target. Production should treat this as dark magic with legal rules.",
    scaling: "Intelligence, Willpower, target resistance, and curse skill.",
    illegalInTown: true,
    unlockHint: "Starting Necromancer curse.",
  },
  speak_with_dead: {
    id: "speak_with_dead",
    name: "Speak With Dead",
    type: "world",
    classRequirements: ["necromancer"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "souls",
    resourceCost: 1,
    cooldownSeconds: 20,
    range: 4,
    targetType: "object",
    effect:
      "Ask a corpse or spirit for information when the world state supports it.",
    scaling: "Willpower, Intelligence, and death-related reputation.",
    illegalInTown: true,
    unlockHint: "Starting Necromancer world interaction.",
  },
  rejuvenation: {
    id: "rejuvenation",
    name: "Rejuvenation",
    type: "heal",
    classRequirements: ["druid"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "mana",
    resourceCost: 14,
    cooldownSeconds: 7,
    range: 20,
    targetType: "ally",
    effect: "A gentle nature heal. Local-dev version restores player HP.",
    scaling: "Wisdom, healing power, nature skill.",
    unlockHint: "Starting Druid heal.",
  },
  entangling_roots: {
    id: "entangling_roots",
    name: "Entangling Roots",
    type: "spell",
    classRequirements: ["druid"],
    levelRequirement: 1,
    skillRequirements: { holy_magic: 1 },
    resourceType: "mana",
    resourceCost: 18,
    cooldownSeconds: 12,
    range: 16,
    targetType: "enemy",
    effect:
      "Root an enemy in place. PvP version should use diminishing returns.",
    scaling: "Wisdom, nature skill, target resistance.",
    pvpNote: "Root is affected by diminishing returns.",
    unlockHint: "Starting Druid control spell.",
  },
  speak_with_animals: {
    id: "speak_with_animals",
    name: "Speak With Animals",
    type: "world",
    classRequirements: ["druid", "ranger"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "mana",
    resourceCost: 6,
    cooldownSeconds: 4,
    range: 4,
    targetType: "dialogue",
    effect: "Understand simple animal needs, warnings, and tracks.",
    scaling: "Wisdom, Charisma, and animal relationship.",
    unlockHint: "Starting Druid world interaction.",
  },
  song_of_courage: {
    id: "song_of_courage",
    name: "Song of Courage",
    type: "utility",
    classRequirements: ["bard"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "inspiration",
    resourceCost: 12,
    cooldownSeconds: 12,
    range: 20,
    targetType: "ally",
    effect:
      "Improve morale. Production should buff allies; local-dev grants Leadership/Persuasion progress.",
    scaling: "Charisma, Performance/Persuasion, and nearby allies.",
    unlockHint: "Starting Bard support song.",
  },
  mocking_verse: {
    id: "mocking_verse",
    name: "Mocking Verse",
    type: "spell",
    classRequirements: ["bard"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "inspiration",
    resourceCost: 10,
    cooldownSeconds: 7,
    range: 14,
    targetType: "enemy",
    effect: "Distract or debuff a hostile target.",
    scaling: "Charisma, target Willpower, and social skill.",
    pvpNote: "Control component should be reduced in PvP.",
    unlockHint: "Starting Bard debuff.",
  },
  rumor_song: {
    id: "rumor_song",
    name: "Rumor Song",
    type: "social",
    classRequirements: ["bard"],
    levelRequirement: 1,
    skillRequirements: { persuasion: 1 },
    resourceType: "inspiration",
    resourceCost: 4,
    cooldownSeconds: 5,
    range: 10,
    targetType: "dialogue",
    effect: "Gather tavern rumors and social hints.",
    scaling: "Charisma, Likeability, and tavern context.",
    unlockHint: "Starting Bard social tool.",
  },
  riposte: {
    id: "riposte",
    name: "Riposte",
    type: "active",
    classRequirements: ["warrior", "rogue", "paladin"],
    levelRequirement: 5,
    skillRequirements: { sword_mastery: 25 },
    resourceType: "stamina",
    resourceCost: 15,
    cooldownSeconds: 8,
    range: 2,
    targetType: "enemy",
    requiresWeapon: ["sword"],
    effect:
      "Counter after a parry or opening. Local-dev routes to basic attack and skill progress.",
    scaling: "Sword Mastery, Dexterity, Strength, and timing.",
    unlockHint: "Sword Mastery 25 milestone.",
  },
  whirlwind_slash: {
    id: "whirlwind_slash",
    name: "Whirlwind Slash",
    type: "active",
    classRequirements: ["warrior"],
    levelRequirement: 12,
    skillRequirements: { sword_mastery: 75 },
    resourceType: "stamina",
    resourceCost: 35,
    cooldownSeconds: 20,
    range: 3,
    targetType: "area",
    requiresWeapon: ["sword", "great weapon"],
    effect:
      "Area melee strike. Local-dev routes to heavy attack against the selected target.",
    scaling: "Weapon damage, Strength, Sword Mastery, and positioning.",
    unlockHint: "Sword Mastery 75 milestone.",
  },
  fireball: {
    id: "fireball",
    name: "Fireball",
    type: "spell",
    classRequirements: ["mage"],
    levelRequirement: 8,
    skillRequirements: { fire_magic: 25 },
    resourceType: "mana",
    resourceCost: 35,
    cooldownSeconds: 6,
    range: 30,
    targetType: "enemy",
    effect:
      "Larger fire attack. Production should use cast time, radius, and burn effect.",
    scaling: "Intelligence, Spell Power, Fire Magic, and target resistance.",
    pvpNote: "PvP damage should be reduced compared with PvE.",
    illegalInTown: true,
    unlockHint: "Fire Magic 25 and level 8.",
  },
  meteor: {
    id: "meteor",
    name: "Meteor",
    type: "ultimate",
    classRequirements: ["mage"],
    levelRequirement: 40,
    skillRequirements: { fire_magic: 75 },
    resourceType: "mana",
    resourceCost: 90,
    cooldownSeconds: 180,
    range: 35,
    targetType: "area",
    effect: "Class-defining destructive fire ultimate.",
    scaling:
      "Intelligence, Spell Power, Fire Magic, level, and target mitigation.",
    pvpNote: "PvP version should be heavily normalized and telegraphed.",
    illegalInTown: true,
    unlockHint: "Fire Magic 75, level 40, and advanced mage training.",
  },
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function classEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_CLASS_EVENT));
}

function pushLog(
  state: HarthmereClassSkillState,
  label: string,
  detail: string
): HarthmereClassSkillState {
  return {
    ...state,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        label,
        detail,
      },
      ...state.recent,
    ].slice(0, 16),
  };
}

function xpRequiredForSkill(level: number) {
  return Math.max(
    50,
    Math.round((80 + level * 18 + level * level * 1.2) / 10) * 10
  );
}

function defaultSkillState(level = 1): HarthmereSkillState {
  return { level, xpCurrent: 0, xpRequiredNext: xpRequiredForSkill(level) };
}

function resourceMaxForClass(classId: HarthmereClassId) {
  const leveling = readHarthmereLevelingState();
  const derived = calculateHarthmereDerivedStats(leveling);
  const classDef = CLASS_DEFINITIONS[classId];
  if (
    ["mana", "faith", "conviction", "souls", "inspiration"].includes(
      classDef.resource
    )
  ) {
    return Math.max(50, derived.maxMana);
  }
  if (["stamina", "rage", "energy", "focus"].includes(classDef.resource)) {
    return Math.max(60, derived.maxStamina);
  }
  return 100;
}

function skillSeedsForClass(classId: HarthmereClassId): Record<string, HarthmereSkillState> {
  const common = {
    melee_combat: defaultSkillState(1),
    persuasion: defaultSkillState(1),
    construction: defaultSkillState(1),
    leadership: defaultSkillState(1),
  } satisfies Record<string, HarthmereSkillState>;
  switch (classId) {
    case "warrior":
      return {
        ...common,
        sword_mastery: defaultSkillState(5),
        shield_mastery: defaultSkillState(4),
      };
    case "rogue":
      return {
        ...common,
        dagger_mastery: defaultSkillState(5),
        lockpicking: defaultSkillState(5),
      };
    case "ranger":
      return {
        ...common,
        sword_mastery: defaultSkillState(1),
        persuasion: defaultSkillState(2),
      };
    case "mage":
      return {
        ...common,
        fire_magic: defaultSkillState(6),
      };
    case "priest":
    case "paladin":
      return {
        ...common,
        holy_magic: defaultSkillState(6),
        shield_mastery:
          classId === "paladin" ? defaultSkillState(3) : defaultSkillState(1),
      };
    case "necromancer":
      return {
        ...common,
        fire_magic: defaultSkillState(2),
        persuasion: defaultSkillState(2),
      };
    case "druid":
      return {
        ...common,
        holy_magic: defaultSkillState(4),
        persuasion: defaultSkillState(2),
      };
    case "bard":
      return {
        ...common,
        persuasion: defaultSkillState(7),
        leadership: defaultSkillState(3),
      };
  }
}

function abilitiesForClass(
  classId: HarthmereClassId,
  skills = skillSeedsForClass(classId)
) {
  const def = CLASS_DEFINITIONS[classId];
  const known = new Set<string>(["basic_strike", ...def.startingAbilities]);
  for (const skill of Object.values(skills)) {
    void skill;
  }
  for (const [abilityId, ability] of Object.entries(ABILITY_DEFINITIONS)) {
    const classOk =
      !ability.classRequirements || ability.classRequirements.includes(classId);
    if (
      !classOk ||
      ability.levelRequirement > readHarthmereLevelingState().level
    ) {
      continue;
    }
    const reqs = Object.entries(ability.skillRequirements ?? {});
    if (
      reqs.every(([skillId, level]) => (skills[skillId]?.level ?? 0) >= level)
    ) {
      known.add(abilityId);
    }
  }
  return Array.from(known);
}

function defaultClassState(
  classId: HarthmereClassId = "warrior"
): HarthmereClassSkillState {
  const def = CLASS_DEFINITIONS[classId];
  const max = resourceMaxForClass(classId);
  const skills = skillSeedsForClass(classId);
  const known = abilitiesForClass(classId, skills);
  return {
    version: 1,
    classId,
    specialization: undefined,
    resource: { type: def.resource, current: max, max },
    knownAbilities: known,
    equippedAbilities: {
      slot_1: known[0],
      slot_2: known[1],
      slot_3: known[2],
      slot_4: known[3],
      utility_1: known.find((id) => ABILITY_DEFINITIONS[id]?.type === "world"),
      ultimate: known.find(
        (id) => ABILITY_DEFINITIONS[id]?.type === "ultimate"
      ),
    },
    talents: [],
    loadoutName: "Solo Explorer",
    skills,
    cooldowns: {},
    recent: [],
  };
}

function normalizeState(raw: Partial<HarthmereClassSkillState> | undefined) {
  const fallback = defaultClassState();
  const classId =
    raw?.classId && CLASS_DEFINITIONS[raw.classId]
      ? raw.classId
      : fallback.classId;
  const def = CLASS_DEFINITIONS[classId];
  const seededSkills = skillSeedsForClass(classId);
  const skills = { ...seededSkills };
  for (const [skillId, skill] of Object.entries(raw?.skills ?? {})) {
    if (!SKILL_DEFINITIONS[skillId]) {
      continue;
    }
    const level = Math.max(
      0,
      Math.min(
        SKILL_DEFINITIONS[skillId].maxLevel,
        Math.round(skill.level ?? 1)
      )
    );
    skills[skillId] = {
      level,
      xpCurrent: Math.max(0, Math.round(skill.xpCurrent ?? 0)),
      xpRequiredNext: xpRequiredForSkill(level),
    };
  }
  const max = resourceMaxForClass(classId);
  const known = Array.from(
    new Set([
      ...abilitiesForClass(classId, skills),
      ...(raw?.knownAbilities ?? []).filter((id) => !!ABILITY_DEFINITIONS[id]),
    ])
  );
  return {
    version: 1,
    classId,
    specialization:
      raw?.specialization && def.specializations.includes(raw.specialization)
        ? raw.specialization
        : raw?.specialization,
    resource: {
      type: def.resource,
      current: Math.max(
        0,
        Math.min(max, Math.round(raw?.resource?.current ?? max))
      ),
      max,
    },
    knownAbilities: known,
    equippedAbilities: {
      slot_1: raw?.equippedAbilities?.slot_1 ?? known[0],
      slot_2: raw?.equippedAbilities?.slot_2 ?? known[1],
      slot_3: raw?.equippedAbilities?.slot_3 ?? known[2],
      slot_4: raw?.equippedAbilities?.slot_4 ?? known[3],
      utility_1:
        raw?.equippedAbilities?.utility_1 ??
        known.find((id) => ABILITY_DEFINITIONS[id]?.type === "world"),
      ultimate:
        raw?.equippedAbilities?.ultimate ??
        known.find((id) => ABILITY_DEFINITIONS[id]?.type === "ultimate"),
    },
    talents: (raw?.talents ?? []).filter(
      (talent) => typeof talent === "string"
    ),
    loadoutName: raw?.loadoutName ?? "Solo Explorer",
    skills,
    cooldowns: raw?.cooldowns ?? {},
    recent: (raw?.recent ?? []).slice(0, 16),
  } satisfies HarthmereClassSkillState;
}

export function readHarthmereClassSkillState(): HarthmereClassSkillState {
  if (!isBrowser()) {
    return defaultClassState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_CLASS_STATE_KEY);
    if (!raw) {
      return defaultClassState();
    }
    return normalizeState(JSON.parse(raw) as Partial<HarthmereClassSkillState>);
  } catch {
    return defaultClassState();
  }
}

export function writeHarthmereClassSkillState(state: HarthmereClassSkillState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_CLASS_STATE_KEY,
    JSON.stringify(normalizeState(state))
  );
  classEvent();
}

export function chooseHarthmereClass(classId: HarthmereClassId) {
  const next = pushLog(
    defaultClassState(classId),
    "Class chosen",
    `${CLASS_DEFINITIONS[classId].name} selected. Starting abilities, resource, skills, and world interactions were prepared.`
  );
  writeHarthmereClassSkillState(next);
}

export function resetHarthmereClassSkillState() {
  writeHarthmereClassSkillState(
    pushLog(
      defaultClassState(),
      "Class system reset",
      "Reset to the Warrior starter build for local-dev testing."
    )
  );
}

function skillTitle(level: number) {
  return SKILL_TITLES.find((entry) => level >= entry.min)?.title ?? "Untrained";
}

function currentTargetOffset() {
  try {
    return readHarthmereCombatState().selectedNpcOffset ?? 9001;
  } catch {
    return 9001;
  }
}

function abilityRequirementFailure(
  state: HarthmereClassSkillState,
  ability: HarthmereAbilityDefinition
) {
  const leveling = readHarthmereLevelingState();
  if (leveling.level < ability.levelRequirement) {
    return `Requires player level ${ability.levelRequirement}.`;
  }
  if (
    ability.classRequirements &&
    !ability.classRequirements.includes(state.classId)
  ) {
    return `Requires class: ${ability.classRequirements.map((id) => CLASS_DEFINITIONS[id].name).join(", ")}.`;
  }
  for (const [skillId, level] of Object.entries(
    ability.skillRequirements ?? {}
  )) {
    if ((state.skills[skillId]?.level ?? 0) < level) {
      return `Requires ${SKILL_DEFINITIONS[skillId]?.name ?? skillId} ${level}.`;
    }
  }
  const now = Date.now();
  const cooldownEnds = state.cooldowns[ability.id] ?? 0;
  if (cooldownEnds > now) {
    return `${ability.name} is on cooldown for ${Math.ceil((cooldownEnds - now) / 1000)}s.`;
  }
  if (
    ability.resourceType &&
    (state.resource.current ?? 0) < (ability.resourceCost ?? 0)
  ) {
    return `Not enough ${state.resource.type}.`;
  }
  return undefined;
}

function unlockAbilityMilestones(
  state: HarthmereClassSkillState,
  skillId: string,
  previousLevel: number,
  nextLevel: number
) {
  let next = state;
  const skillDef = SKILL_DEFINITIONS[skillId];
  for (const milestone of skillDef?.milestones ?? []) {
    if (previousLevel < milestone.level && nextLevel >= milestone.level) {
      next = pushLog(
        next,
        "Skill milestone",
        `${skillDef.name} reached ${milestone.level}: ${milestone.label}.`
      );
      if (
        milestone.unlockAbility &&
        ABILITY_DEFINITIONS[milestone.unlockAbility]
      ) {
        next = {
          ...next,
          knownAbilities: Array.from(
            new Set([...next.knownAbilities, milestone.unlockAbility])
          ),
        };
        next = pushLog(
          next,
          "Ability unlocked",
          `${ABILITY_DEFINITIONS[milestone.unlockAbility].name} unlocked from ${skillDef.name}.`
        );
      }
    }
  }
  return next;
}

export function grantHarthmereSkillXp(
  skillId: string,
  baseXp: number,
  label: string,
  detail: string
) {
  const skillDef = SKILL_DEFINITIONS[skillId];
  if (!skillDef) {
    return;
  }
  let state = readHarthmereClassSkillState();
  const current = state.skills[skillId] ?? defaultSkillState(0);
  let level = current.level;
  let xp = current.xpCurrent + Math.max(0, Math.round(baseXp));
  const oldLevel = level;
  while (level < skillDef.maxLevel && xp >= xpRequiredForSkill(level)) {
    xp -= xpRequiredForSkill(level);
    level += 1;
  }
  state = {
    ...state,
    skills: {
      ...state.skills,
      [skillId]: {
        level,
        xpCurrent: level >= skillDef.maxLevel ? 0 : xp,
        xpRequiredNext: xpRequiredForSkill(level),
      },
    },
  };
  state = unlockAbilityMilestones(state, skillId, oldLevel, level);
  state = pushLog(
    state,
    label,
    `${detail} ${skillDef.name} ${skillTitle(level)} ${level} (${Math.round(state.skills[skillId]?.xpCurrent ?? 0)}/${xpRequiredForSkill(level)}).`
  );
  state = {
    ...state,
    knownAbilities: Array.from(
      new Set([
        ...state.knownAbilities,
        ...abilitiesForClass(state.classId, state.skills),
      ])
    ),
  };
  writeHarthmereClassSkillState(state);
}

function spendResourceAndStartCooldown(
  state: HarthmereClassSkillState,
  ability: HarthmereAbilityDefinition
) {
  return {
    ...state,
    resource: {
      ...state.resource,
      current: Math.max(
        0,
        state.resource.current - (ability.resourceCost ?? 0)
      ),
    },
    cooldowns: {
      ...state.cooldowns,
      [ability.id]: Date.now() + ability.cooldownSeconds * 1000,
    },
  };
}

function skillForAbility(ability: HarthmereAbilityDefinition) {
  const firstReq = Object.keys(ability.skillRequirements ?? {})[0];
  if (firstReq) {
    return firstReq;
  }
  if (["spell", "heal", "utility"].includes(ability.type)) {
    return "holy_magic";
  }
  if (["social", "world"].includes(ability.type)) {
    return "persuasion";
  }
  return "melee_combat";
}

export function useHarthmereClassAbility(abilityId: string) {
  const ability = ABILITY_DEFINITIONS[abilityId];
  if (!ability) {
    return;
  }
  let state = readHarthmereClassSkillState();
  if (!state.knownAbilities.includes(abilityId)) {
    writeHarthmereClassSkillState(
      pushLog(
        state,
        "Ability unavailable",
        `${ability.name} is not known yet. ${ability.unlockHint}`
      )
    );
    return;
  }
  const failure = abilityRequirementFailure(state, ability);
  if (failure) {
    writeHarthmereClassSkillState(
      pushLog(state, "Ability blocked", `${ability.name}: ${failure}`)
    );
    return;
  }

  if (ability.illegalInTown) {
    applyHarthmereReputationChange({
      label: "Restricted ability used",
      detail: `Used restricted ability: ${ability.name}`,
      scope: "harthmere",
      harthmere: { legal: -8, likeability: -3, notoriety: 2 },
    });
  }

  state = spendResourceAndStartCooldown(state, ability);
  state = pushLog(state, "Ability used", `${ability.name}: ${ability.effect}`);
  writeHarthmereClassSkillState(state);

  switch (ability.id) {
    case "basic_strike":
    case "riposte":
      performHarthmereCombatAttack(currentTargetOffset(), "basic");
      break;
    case "power_strike":
    case "shield_bash":
    case "backstab":
    case "whirlwind_slash":
      performHarthmereCombatAttack(currentTargetOffset(), "heavy");
      break;
    case "spark":
    case "fireball":
    case "meteor":
    case "smite":
    case "life_drain":
    case "curse_of_weakness":
    case "mocking_verse":
    case "entangling_roots":
      performHarthmereCombatAttack(currentTargetOffset(), "spark");
      if (ability.id === "life_drain") {
        healHarthmerePlayer(12, "Life Drain");
      }
      break;
    case "minor_heal":
    case "rejuvenation":
      healHarthmerePlayer(35, ability.name);
      break;
    case "mana_shield":
    case "guarded_block":
    case "shield_of_faith":
      healHarthmerePlayer(18, ability.name);
      break;
    default:
      break;
  }

  grantHarthmereSkillXp(
    skillForAbility(ability),
    ability.type === "ultimate" ? 45 : ability.type === "world" ? 12 : 20,
    "Skill practice",
    `${ability.name} was used successfully.`
  );
}

export function equipHarthmereAbility(slot: string, abilityId: string) {
  let state = readHarthmereClassSkillState();
  if (!state.knownAbilities.includes(abilityId)) {
    writeHarthmereClassSkillState(
      pushLog(
        state,
        "Loadout blocked",
        `${ABILITY_DEFINITIONS[abilityId]?.name ?? abilityId} is not known.`
      )
    );
    return;
  }
  state = {
    ...state,
    equippedAbilities: {
      ...state.equippedAbilities,
      [slot]: abilityId,
    },
  };
  writeHarthmereClassSkillState(
    pushLog(
      state,
      "Loadout updated",
      `${ABILITY_DEFINITIONS[abilityId].name} equipped in ${slot}.`
    )
  );
}

export function recoverHarthmereClassResource(amount = 30, source = "Rest") {
  const state = readHarthmereClassSkillState();
  writeHarthmereClassSkillState(
    pushLog(
      {
        ...state,
        resource: {
          ...state.resource,
          current: Math.min(
            state.resource.max,
            state.resource.current + amount
          ),
        },
      },
      "Resource recovered",
      `${source} restored ${amount} ${state.resource.type}.`
    )
  );
}

export function chooseHarthmereSpecialization(spec: string) {
  const state = readHarthmereClassSkillState();
  const classDef = CLASS_DEFINITIONS[state.classId];
  if (!classDef.specializations.includes(spec)) {
    return;
  }
  writeHarthmereClassSkillState(
    pushLog(
      { ...state, specialization: spec },
      "Specialization selected",
      `${spec} chosen for ${classDef.name}. Specialization switching should be blocked during combat in production.`
    )
  );
}

function useHarthmereClassSkillState() {
  const [state, setState] = useState(readHarthmereClassSkillState);
  useEffect(() => {
    const refresh = () => setState(readHarthmereClassSkillState());
    window.addEventListener(HARTHMERE_CLASS_EVENT, refresh);
    window.addEventListener("biomes:harthmere-leveling-changed", refresh);
    return () => {
      window.removeEventListener(HARTHMERE_CLASS_EVENT, refresh);
      window.removeEventListener("biomes:harthmere-leveling-changed", refresh);
    };
  }, []);
  return state;
}

function ClassHotkeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName.toUpperCase())
      ) {
        return;
      }
      const state = readHarthmereClassSkillState();
      const slotByKey: Record<string, string> = {
        "1": "slot_1",
        "2": "slot_2",
        "3": "slot_3",
        "4": "slot_4",
        "5": "utility_1",
        "6": "ultimate",
      };
      const slot = slotByKey[event.key];
      const abilityId = slot ? state.equippedAbilities[slot] : undefined;
      if (abilityId) {
        event.preventDefault();
        useHarthmereClassAbility(abilityId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}

function classPriceLine(classId: HarthmereClassId) {
  const regionalReputation = readHarthmereReputationState().regions.harthmere;
  const legalStanding = regionalReputation.legal;

  if (classId === "necromancer") {
    return legalStanding < -500
      ? "Forbidden teachers are easier to find because your legal reputation is already poor."
      : "Necromancy is restricted in lawful Harthmere. Expect suspicion and legal warnings.";
  }
  if (["priest", "paladin"].includes(classId)) {
    return legalStanding >= 0
      ? "Temple and Watch NPCs are more willing to train lawful holy paths."
      : "Holy trainers will question your legal standing before deeper instruction.";
  }
  return "Class training is available as a local-dev roleplay/progression path.";
}

export function classSkillActionsForHarthmereNpc(
  offset: number
): TalkDialogStepAction[] {
  const trainerOffsets = new Set([27, 41, 44, 56, 59]);
  const magicOffsets = new Set([9, 31, 46, 47]);
  const rogueOffsets = new Set([33, 40, 52, 53, 61]);
  const bardOffsets = new Set([11, 13, 16, 42]);
  const buildingOffsets = new Set([3, 29, 44, 59]);
  const actions: TalkDialogStepAction[] = [];

  if (trainerOffsets.has(offset)) {
    actions.push({
      name: "Train: use equipped class ability 1",
      tooltip: "Uses hotbar slot 1. Keyboard: 1.",
      followUpText:
        "You run the first ability in your current loadout. Repeated trivial practice gives only modest skill growth.",
      onPerformed: () => {
        const abilityId =
          readHarthmereClassSkillState().equippedAbilities.slot_1;
        if (abilityId) {
          useHarthmereClassAbility(abilityId);
        }
      },
    });
    actions.push({
      name: "Recover class resource",
      tooltip:
        "Restores stamina, mana, energy, focus, faith, souls, or inspiration for local-dev testing.",
      followUpText:
        "You take a moment to breathe and reset your rhythm before trying another ability.",
      onPerformed: () => recoverHarthmereClassResource(45, "Trainer rest"),
    });
    actions.push({
      name: "Choose Warrior class",
      tooltip: classPriceLine("warrior"),
      followUpText:
        "You take up the Warrior path: stamina, weapons, shields, direct combat, and militia-style world interactions.",
      onPerformed: () => chooseHarthmereClass("warrior"),
    });
    actions.push({
      name: "Choose Ranger class",
      tooltip: classPriceLine("ranger"),
      followUpText:
        "You take up the Ranger path: focus, tracking, wilderness problem-solving, and ranged/survival identity.",
      onPerformed: () => chooseHarthmereClass("ranger"),
    });
    actions.push({
      name: "Choose Paladin class",
      tooltip: classPriceLine("paladin"),
      followUpText:
        "You take up the Paladin path: conviction, defense, holy power, and lawful authority.",
      onPerformed: () => chooseHarthmereClass("paladin"),
    });
  }

  if (magicOffsets.has(offset)) {
    actions.push({
      name: "Choose Mage class",
      tooltip: classPriceLine("mage"),
      followUpText:
        "You take up the Mage path: mana, spellcasting, magical literacy, and arcane world interactions.",
      onPerformed: () => chooseHarthmereClass("mage"),
    });
    actions.push({
      name: "Choose Priest class",
      tooltip: classPriceLine("priest"),
      followUpText:
        "You take up the Priest path: faith, healing, blessings, cleansing, and temple interactions.",
      onPerformed: () => chooseHarthmereClass("priest"),
    });
    actions.push({
      name: "Practice Spark / healing magic",
      tooltip:
        "Uses Spark if known; otherwise uses the first known healing or utility spell.",
      followUpText:
        "The trainer watches for control, not spectacle. Useful magic is accurate, legal, and purposeful.",
      onPerformed: () => {
        const state = readHarthmereClassSkillState();
        const abilityId =
          state.knownAbilities.find((id) =>
            ["spark", "minor_heal", "rejuvenation"].includes(id)
          ) ?? state.equippedAbilities.slot_1;
        if (abilityId) useHarthmereClassAbility(abilityId);
      },
    });
  }

  if (rogueOffsets.has(offset)) {
    actions.push({
      name: "Choose Rogue class",
      tooltip: classPriceLine("rogue"),
      followUpText:
        "You take up the Rogue path: energy, dagger work, lockpicking, stealth logic, and criminal/social alternatives.",
      onPerformed: () => chooseHarthmereClass("rogue"),
    });
    actions.push({
      name: "Choose Necromancer class",
      tooltip: classPriceLine("necromancer"),
      followUpText:
        "You take up the Necromancer path. Harthmere will remember if you use forbidden powers openly.",
      onPerformed: () => chooseHarthmereClass("necromancer"),
    });
    actions.push({
      name: "Practice Lockpicking",
      tooltip:
        "Trains Lockpicking lightly. Real locks and quests should be required for serious progress.",
      followUpText:
        "You practice on a harmless training latch. It teaches touch, not crime. Private locks still require permission or carry legal risk.",
      onPerformed: () =>
        grantHarthmereSkillXp(
          "lockpicking",
          12,
          "Lockpicking practice",
          "A supervised training latch improved your feel for tumblers."
        ),
    });
  }

  if (bardOffsets.has(offset)) {
    actions.push({
      name: "Choose Bard class",
      tooltip: classPriceLine("bard"),
      followUpText:
        "You take up the Bard path: inspiration, social options, support songs, rumors, and crowd influence.",
      onPerformed: () => chooseHarthmereClass("bard"),
    });
    actions.push({
      name: "Practice Persuasion",
      tooltip: "Trains Persuasion through a non-hostile social performance.",
      followUpText:
        "The room listens. A good line does not force people; it helps them understand what they already care about.",
      onPerformed: () =>
        grantHarthmereSkillXp(
          "persuasion",
          16,
          "Persuasion practice",
          "A useful social exchange improved your timing and tone."
        ),
    });
  }

  if (buildingOffsets.has(offset)) {
    actions.push({
      name: "Practice Construction planning",
      tooltip:
        "Connects class/skill progression to the building system without consuming project materials.",
      followUpText:
        "You review foundations, road clearances, door access, and repair materials. Bad buildings are rejected before they trap people.",
      onPerformed: () =>
        grantHarthmereSkillXp(
          "construction",
          14,
          "Construction study",
          "Blueprint review improved your construction planning."
        ),
    });
  }

  if (offset === 10 || offset === 46 || offset === 47) {
    actions.push({
      name: "Choose Druid class",
      tooltip: classPriceLine("druid"),
      followUpText:
        "You take up the Druid path: nature magic, animal speech, healing, roots, and land-restoration choices.",
      onPerformed: () => chooseHarthmereClass("druid"),
    });
  }

  if (offset === 41) {
    actions.push({
      name: "Reset local-dev class/skill system",
      tooltip:
        "Resets class, skills, known abilities, loadout, cooldowns, and recent class logs.",
      followUpText:
        "The class/skill test state was reset to a clean Warrior starter loadout.",
      onPerformed: () => resetHarthmereClassSkillState(),
    });
  }

  return actions;
}

export const HarthmereClassSkillHUD: React.FunctionComponent<{}> = () => {
  const state = useHarthmereClassSkillState();
  const classDef = CLASS_DEFINITIONS[state.classId];
  const mainSkill = useMemo(() => {
    const entries = Object.entries(state.skills).sort(
      (a, b) => b[1].level - a[1].level
    );
    return entries[0];
  }, [state.skills]);
  const latest = state.recent[0];
  return (
    <>
      <ClassHotkeys />
      <div className="w-[22rem] rounded-lg bg-black/70 p-2 text-xs text-white shadow-lg">
        <div className="font-semibold text-amber-200">Class & Abilities</div>
        <div className="mt-1 flex justify-between gap-2">
          <span>
            {classDef.name}
            {state.specialization ? ` / ${state.specialization}` : ""}
          </span>
          <span>
            {state.resource.current}/{state.resource.max} {state.resource.type}
          </span>
        </div>
        {mainSkill && (
          <div className="mt-1 text-white/80">
            Best skill: {SKILL_DEFINITIONS[mainSkill[0]]?.name ?? mainSkill[0]}{" "}
            {mainSkill[1].level} ({skillTitle(mainSkill[1].level)})
          </div>
        )}
        <div className="mt-1 text-white/70">
          Keys: 1-4 abilities, 5 utility, 6 ultimate. Use X/F/R/Q for weapon
          stance/basic/heavy/Spark from the fighting layer.
        </div>
        {latest && (
          <div className="mt-1 text-amber-100">
            {latest.label}: {latest.detail}
          </div>
        )}
      </div>
    </>
  );
};

function AbilityButton({
  abilityId,
  label,
}: {
  abilityId?: string;
  label: string;
}) {
  if (!abilityId) {
    return null;
  }
  const ability = ABILITY_DEFINITIONS[abilityId];
  if (!ability) {
    return null;
  }
  return (
    <button
      className="rounded border border-white/20 bg-white/10 px-2 py-1 text-left text-xs hover:bg-white/20"
      onClick={() => useHarthmereClassAbility(abilityId)}
      title={`${ability.effect} Cost: ${ability.resourceCost ?? 0} ${ability.resourceType ?? "none"}. Cooldown: ${ability.cooldownSeconds}s.`}
    >
      <span className="font-semibold">{label}</span>: {ability.name}
    </button>
  );
}

export const HarthmereClassSkillMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereClassSkillState();
  const [tab, setTab] = useState<"class" | "abilities" | "skills" | "guide">(
    "class"
  );
  const classDef = CLASS_DEFINITIONS[state.classId];
  const leveling = readHarthmereLevelingState();
  const derived = calculateHarthmereDerivedStats(leveling);
  const knownAbilities = state.knownAbilities
    .map((id) => ABILITY_DEFINITIONS[id])
    .filter((ability): ability is HarthmereAbilityDefinition => !!ability);
  const lockedAbilities = Object.values(ABILITY_DEFINITIONS).filter(
    (ability) => !state.knownAbilities.includes(ability.id)
  );
  return (
    <div className="mb-2 max-h-[32rem] w-[34rem] overflow-y-auto rounded-lg bg-black/80 p-3 text-xs text-white shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-amber-200">
            Harthmere Class / Skill / Ability
          </div>
          <div className="text-white/70">
            {classDef.name} • {state.loadoutName} • {state.resource.current}/
            {state.resource.max} {state.resource.type}
          </div>
        </div>
        <button
          className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
          onClick={() => recoverHarthmereClassResource(50, "Menu rest")}
        >
          Rest
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(["class", "abilities", "skills", "guide"] as const).map((nextTab) => (
          <button
            key={nextTab}
            className={`rounded px-2 py-1 ${tab === nextTab ? "bg-amber-300 text-black" : "bg-white/10 hover:bg-white/20"}`}
            onClick={() => setTab(nextTab)}
          >
            {nextTab}
          </button>
        ))}
      </div>

      {tab === "class" && (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <div className="font-semibold text-amber-100">{classDef.name}</div>
            <div className="mt-1 text-white/80">{classDef.summary}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-white/75">
              <div>
                <span className="font-semibold">Roles:</span>{" "}
                {classDef.roles.join(", ")}
              </div>
              <div>
                <span className="font-semibold">Resource:</span>{" "}
                {classDef.resource}
              </div>
              <div>
                <span className="font-semibold">Primary:</span>{" "}
                {classDef.primaryAttributes.join(", ")}
              </div>
              <div>
                <span className="font-semibold">Secondary:</span>{" "}
                {classDef.secondaryAttributes.join(", ")}
              </div>
              <div>
                <span className="font-semibold">Armor:</span>{" "}
                {classDef.armor.join(", ")}
              </div>
              <div>
                <span className="font-semibold">Weapons:</span>{" "}
                {classDef.weapons.join(", ")}
              </div>
            </div>
            <div className="mt-2 text-white/75">
              <span className="font-semibold">NPC reaction:</span>{" "}
              {classDef.npcReaction}
            </div>
            <div className="mt-2 text-white/75">
              <span className="font-semibold">World interactions:</span>{" "}
              {classDef.worldInteractions.join("; ")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(CLASS_DEFINITIONS) as HarthmereClassId[]).map(
              (classId) => (
                <button
                  key={classId}
                  className={`rounded border border-white/10 px-2 py-1 text-left ${state.classId === classId ? "bg-amber-300 text-black" : "bg-white/10 hover:bg-white/20"}`}
                  onClick={() => chooseHarthmereClass(classId)}
                  title={CLASS_DEFINITIONS[classId].summary}
                >
                  {CLASS_DEFINITIONS[classId].name}
                </button>
              )
            )}
          </div>
          <div>
            <div className="font-semibold text-amber-100">Specializations</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {classDef.specializations.map((spec) => (
                <button
                  key={spec}
                  className={`rounded px-2 py-1 ${state.specialization === spec ? "bg-amber-300 text-black" : "bg-white/10 hover:bg-white/20"}`}
                  onClick={() => chooseHarthmereSpecialization(spec)}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-2 text-white/75">
            <div className="font-semibold text-amber-100">
              Derived stat context
            </div>
            HP {derived.maxHp}, Mana {derived.maxMana}, Stamina{" "}
            {derived.maxStamina}, Attack {derived.attackPoints}, Spell{" "}
            {derived.spellPower}, Healing {derived.healingPower}, Defense{" "}
            {derived.defense}, Accuracy {derived.accuracy}, Crit{" "}
            {derived.criticalChance}%.
          </div>
        </div>
      )}

      {tab === "abilities" && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-1">
            <AbilityButton
              abilityId={state.equippedAbilities.slot_1}
              label="1"
            />
            <AbilityButton
              abilityId={state.equippedAbilities.slot_2}
              label="2"
            />
            <AbilityButton
              abilityId={state.equippedAbilities.slot_3}
              label="3"
            />
            <AbilityButton
              abilityId={state.equippedAbilities.slot_4}
              label="4"
            />
            <AbilityButton
              abilityId={state.equippedAbilities.utility_1}
              label="5"
            />
            <AbilityButton
              abilityId={state.equippedAbilities.ultimate}
              label="6"
            />
          </div>
          <div>
            <div className="font-semibold text-amber-100">Known abilities</div>
            <div className="mt-1 space-y-1">
              {knownAbilities.map((ability) => (
                <div
                  key={ability.id}
                  className="rounded border border-white/10 bg-white/5 p-2"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{ability.name}</span>
                    <span className="text-white/60">
                      {ability.type} • {ability.cooldownSeconds}s
                    </span>
                  </div>
                  <div className="text-white/75">{ability.effect}</div>
                  <div className="text-white/50">
                    Scaling: {ability.scaling}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[
                      "slot_1",
                      "slot_2",
                      "slot_3",
                      "slot_4",
                      "utility_1",
                      "ultimate",
                    ].map((slot) => (
                      <button
                        key={slot}
                        className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20"
                        onClick={() => equipHarthmereAbility(slot, ability.id)}
                      >
                        equip {slot.replace("slot_", "")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-amber-100">
              Locked / future abilities
            </div>
            <div className="mt-1 max-h-[10rem] overflow-y-auto space-y-1">
              {lockedAbilities.slice(0, 16).map((ability) => (
                <div
                  key={ability.id}
                  className="rounded bg-white/5 p-2 text-white/60"
                >
                  <span className="font-semibold">{ability.name}</span>:{" "}
                  {ability.unlockHint}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "skills" && (
        <div className="mt-3 space-y-2">
          {Object.entries(SKILL_DEFINITIONS).map(([skillId, skillDef]) => {
            const skill = state.skills[skillId] ?? defaultSkillState(0);
            return (
              <div
                key={skillId}
                className="rounded border border-white/10 bg-white/5 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-amber-100">
                      {skillDef.name}
                    </span>
                    <span className="ml-2 text-white/60">
                      {skillDef.category}
                    </span>
                  </div>
                  <div>
                    {skillTitle(skill.level)} {skill.level}
                  </div>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
                  <div
                    className="h-full bg-amber-300"
                    style={{
                      width: `${Math.min(100, (skill.xpCurrent / Math.max(1, skill.xpRequiredNext)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-white/65">
                  Improve by: {skillDef.improvesBy.join("; ")}
                </div>
                <div className="text-white/50">
                  World uses: {skillDef.worldUses.join("; ")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {skillDef.milestones.map((milestone) => (
                    <span
                      key={`${skillId}-${milestone.level}`}
                      className={`rounded px-1.5 py-0.5 ${skill.level >= milestone.level ? "bg-green-500/20 text-green-100" : "bg-white/10 text-white/50"}`}
                    >
                      {milestone.level}: {milestone.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "guide" && (
        <div className="mt-3 space-y-2 text-white/75">
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <div className="font-semibold text-amber-100">
              Rules implemented
            </div>
            <p>
              Classes give identity, resources, starting abilities, role
              options, NPC reactions, and world interactions. Skills improve
              through meaningful action and unlock milestones. Abilities require
              class, level, skill, resources, cooldowns, and sometimes weapons.
            </p>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <div className="font-semibold text-amber-100">Hotkeys</div>
            <p>
              1-4 use equipped class abilities. 5 uses utility. 6 uses ultimate
              if known. X/F/R/Q remain the fighting-layer keys for draw/sheathe,
              basic weapon attack, heavy attack, and Spark.
            </p>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <div className="font-semibold text-amber-100">Production rule</div>
            <p>
              The browser simulates this for Harthmere local-dev. Production
              must validate class, known ability, equipped ability, resource
              cost, cooldown, target, range, line of sight, PvP/legal rules,
              skill XP, damage, healing, and unlocks server-side.
            </p>
          </div>
          <button
            className="rounded bg-red-900/60 px-2 py-1 hover:bg-red-800"
            onClick={() => resetHarthmereClassSkillState()}
          >
            Reset local-dev class/skill state
          </button>
        </div>
      )}

      {!!state.recent.length && (
        <div className="mt-3 rounded border border-white/10 bg-white/5 p-2">
          <div className="font-semibold text-amber-100">
            Recent class/skill log
          </div>
          <div className="mt-1 space-y-1">
            {state.recent.slice(0, 5).map((entry) => (
              <div key={entry.id} className="text-white/70">
                <span className="font-semibold">{entry.label}:</span>{" "}
                {entry.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
