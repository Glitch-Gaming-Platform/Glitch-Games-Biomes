/*
 * Harthmere complete combat/progression rules v1.
 *
 * This is intentionally pure and data-driven so the server/runtime can validate
 * gameplay before UI, animations, localStorage, or client prediction claim a result.
 */
export const HARTHMERE_COMPLETE_COMBAT_PROGRESSION_VERSION_V1 = "harthmere-complete-combat-progression-v1";

export type HarthmereAttributeV1 = "strength" | "dexterity" | "intelligence" | "wisdom" | "constitution" | "charisma" | "perception" | "willpower" | "luck";
export type HarthmereClassIdV1 = keyof typeof HARTHMERE_CLASS_CATALOG_V1;
export type HarthmereRoleV1 = "tank" | "healer" | "damage_dealer" | "support" | "controller" | "summoner" | "scout" | "crafter_utility" | "hybrid";
export type HarthmereSkillCategoryV1 = "combat" | "weapon" | "armor" | "magic" | "profession" | "gathering" | "crafting" | "social" | "exploration" | "survival" | "movement" | "stealth" | "leadership";
export type HarthmereResourceTypeV1 = "none" | "mana" | "faith" | "rage" | "stamina" | "momentum" | "energy" | "combo_points" | "focus" | "conviction" | "holy_power" | "souls" | "corruption" | "nature_energy" | "spirit" | "inspiration" | "rhythm" | "chi" | "gadget_charge" | "bond";
export type HarthmereAbilityTypeV1 = "basic_attack" | "active_ability" | "active_spell" | "basic_spell" | "passive_ability" | "toggle_ability" | "channeled_spell" | "cast_time_spell" | "instant_ability" | "ultimate_ability" | "reaction_ability" | "combo_ability" | "movement_ability" | "movement_spell" | "defensive_ability" | "defensive_spell" | "profession_ability" | "world_interaction_ability";
export type HarthmereTargetTypeV1 = "self" | "enemy" | "ally" | "ally_or_enemy" | "party" | "area" | "cone" | "ground" | "object" | "corpse" | "dead_or_downed_ally" | "beast" | "pet" | "ally_or_object";
export type HarthmereWeaponTypeV1 = "sword" | "axe" | "mace" | "spear" | "great_weapon" | "shield" | "dagger" | "short_sword" | "bow" | "crossbow" | "throwing" | "trap" | "staff" | "wand" | "orb" | "spell_focus" | "holy_symbol" | "tome" | "holy_weapon" | "skull_focus" | "sickle" | "claw_form" | "rapier" | "instrument" | "unarmed" | "fist_weapon" | "pistol" | "tool" | "gadget" | "engineering_gadget" | "summoning_focus";
export type HarthmereCombatStateV1 = "idle" | "alert" | "in_combat" | "casting" | "stunned" | "rooted" | "fleeing" | "evading" | "dead" | "downed" | "respawning" | "invulnerable" | "leashed" | "returning_home" | "teleporting" | "loading" | "spawn_protected";

export interface HarthmereClassDefinitionV1 {
  id: string;
  name: string;
  roles: HarthmereRoleV1[];
  primaryAttributes: HarthmereAttributeV1[];
  secondaryAttributes: HarthmereAttributeV1[];
  armorAccess: string[];
  weaponAccess: string[];
  resourceTypes: HarthmereResourceTypeV1[];
  startingAbilities: string[];
  specializations: string[];
  strengths: string[];
  weaknesses: string[];
  classQuests: string[];
  worldInteractions: string[];
  npcReactionRules: string[];
  progressionMilestones: number[];
}

export interface HarthmereSkillDefinitionV1 {
  id: string;
  name: string;
  category: HarthmereSkillCategoryV1;
  maxLevel: number;
  progressionMethod: string;
  improvesFrom: string[];
  doesNotImproveFrom: string[];
  unlockMilestones: number[];
  passiveBonuses: string[];
  relatedAbilities: string[];
  worldInteractions: string[];
  antiAbuseRules: string[];
}

export interface HarthmereAbilityDefinitionV1 {
  id: string;
  name: string;
  type: HarthmereAbilityTypeV1;
  classRequirements: string[];
  specializationRequirements: string[];
  skillRequirements: Record<string, number>;
  levelRequirement: number;
  resourceType: HarthmereResourceTypeV1;
  resourceCost: number;
  cooldownSeconds: number;
  castTimeSeconds: number;
  range: number;
  targetType: HarthmereTargetTypeV1;
  requiresLineOfSight: boolean;
  requiresFacing: boolean;
  requiredWeaponTypes: string[];
  effects: Array<Record<string, unknown>>;
  pvpModifiers: {
    damageMultiplier: number;
    healingMultiplier: number;
    durationMultiplier: number;
    cooldownMultiplier: number;
  };
  interruptRules: {
    canBeInterrupted: boolean;
    interruptLocksSchoolSeconds: number;
    movementCancels: boolean;
  };
  safeZonePolicy: "allowed" | "blocked_if_hostile_or_disruptive";
  tooltip: string;
  upgradePath: string[];
  serverValidation: string[];
  animationFamily: string;
}

export interface HarthmerePlayerProgressionStateV1 {
  playerId: string;
  classId: string;
  specializationId?: string;
  level: number;
  xp: number;
  attributes: Record<string, number>;
  skills: Record<string, { level: number; xpCurrent: number; xpRequiredNext: number; dailyProgressCount?: number; lastProgressTargetId?: string }>;
  knownAbilities: string[];
  loadoutAbilityIds: string[];
  resources: Partial<Record<HarthmereResourceTypeV1, number>>;
  cooldowns: Record<string, number>;
  equipment: Record<string, string | undefined>;
  activeCasts?: Array<{ abilityId: string; startedAtMs: number; entityVersion: number }>;
  combatState?: HarthmereCombatStateV1;
  pvpFlag?: string;
  restedXpPool?: number;
  serverEntityVersion?: number;
}

export interface HarthmereRewardContextV1 {
  playerLevel: number;
  targetLevel: number;
  targetRank: "civilian" | "critter" | "normal" | "strong" | "elite" | "mini_boss" | "dungeon_boss" | "world_boss" | "training_dummy";
  repeatedFarmCount?: number;
  samePlayerKillCountWithinWindow?: number;
  isAfk?: boolean;
  isPublicEvent?: boolean;
  isBossWipe?: boolean;
  isHardcorePvpZone?: boolean;
  inventoryHasSpace?: boolean;
  contributionScore?: number;
  targetMaxContribution?: number;
}

export const HARTHMERE_CLASS_CATALOG_V1 = {
  "warrior": {
    "id": "warrior",
    "name": "Warrior",
    "roles": [
      "tank",
      "damage_dealer",
      "support"
    ],
    "primaryAttributes": [
      "strength",
      "constitution",
      "willpower"
    ],
    "secondaryAttributes": [
      "charisma",
      "perception"
    ],
    "armorAccess": [
      "medium",
      "heavy",
      "shield"
    ],
    "weaponAccess": [
      "sword",
      "axe",
      "mace",
      "spear",
      "great_weapon",
      "shield"
    ],
    "resourceTypes": [
      "rage",
      "stamina",
      "momentum"
    ],
    "startingAbilities": [
      "basic_strike",
      "power_strike",
      "taunt"
    ],
    "specializations": [
      "guardian",
      "berserker",
      "warlord"
    ],
    "strengths": [
      "direct melee",
      "blocking",
      "taunting",
      "cleaving"
    ],
    "weaknesses": [
      "limited ranged pressure",
      "weaker magic utility"
    ],
    "classQuests": [
      "train_the_militia",
      "hold_the_market_gate"
    ],
    "worldInteractions": [
      "break_weak_doors",
      "lift_heavy_objects",
      "intimidate_bandits"
    ],
    "npcReactionRules": [
      "guards_respect_high_honor_warriors",
      "bandits_fear_known_warlords"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "rogue": {
    "id": "rogue",
    "name": "Rogue",
    "roles": [
      "damage_dealer",
      "controller",
      "scout"
    ],
    "primaryAttributes": [
      "dexterity",
      "perception",
      "luck"
    ],
    "secondaryAttributes": [
      "charisma",
      "willpower"
    ],
    "armorAccess": [
      "light"
    ],
    "weaponAccess": [
      "dagger",
      "short_sword",
      "bow",
      "throwing"
    ],
    "resourceTypes": [
      "energy",
      "combo_points",
      "focus"
    ],
    "startingAbilities": [
      "basic_strike",
      "backstab",
      "pick_lock"
    ],
    "specializations": [
      "assassin",
      "trickster",
      "shadowblade"
    ],
    "strengths": [
      "stealth",
      "critical strikes",
      "locks",
      "traps"
    ],
    "weaknesses": [
      "low armor",
      "weaker sustained defense"
    ],
    "classQuests": [
      "unlock_smuggler_den",
      "silent_market_rooftops"
    ],
    "worldInteractions": [
      "lockpick_doors",
      "disarm_traps",
      "sneak_restricted_areas"
    ],
    "npcReactionRules": [
      "guards_inspect_suspicious_rogues",
      "thieves_offer_fence_work"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "ranger": {
    "id": "ranger",
    "name": "Ranger",
    "roles": [
      "damage_dealer",
      "scout",
      "support"
    ],
    "primaryAttributes": [
      "dexterity",
      "perception",
      "wisdom"
    ],
    "secondaryAttributes": [
      "constitution",
      "luck"
    ],
    "armorAccess": [
      "light",
      "medium"
    ],
    "weaponAccess": [
      "bow",
      "crossbow",
      "spear",
      "dagger",
      "trap"
    ],
    "resourceTypes": [
      "focus",
      "stamina"
    ],
    "startingAbilities": [
      "quick_shot",
      "hunter_mark",
      "track_beast"
    ],
    "specializations": [
      "marksman",
      "beastwarden",
      "pathfinder"
    ],
    "strengths": [
      "ranged damage",
      "tracking",
      "traps",
      "animal support"
    ],
    "weaknesses": [
      "weaker indoor control",
      "needs distance"
    ],
    "classQuests": [
      "track_the_north_wolf",
      "tame_first_companion"
    ],
    "worldInteractions": [
      "track_footprints",
      "tame_animals",
      "forage_food"
    ],
    "npcReactionRules": [
      "hunters_share_rumors",
      "beasts_react_to_tamer_reputation"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "mage": {
    "id": "mage",
    "name": "Mage",
    "roles": [
      "damage_dealer",
      "controller",
      "support"
    ],
    "primaryAttributes": [
      "intelligence",
      "willpower",
      "perception"
    ],
    "secondaryAttributes": [
      "wisdom",
      "luck"
    ],
    "armorAccess": [
      "cloth"
    ],
    "weaponAccess": [
      "staff",
      "wand",
      "orb",
      "spell_focus"
    ],
    "resourceTypes": [
      "mana"
    ],
    "startingAbilities": [
      "spark",
      "frost_barrier",
      "arcane_reading"
    ],
    "specializations": [
      "pyromancer",
      "cryomancer",
      "arcanist"
    ],
    "strengths": [
      "spell burst",
      "control",
      "utility"
    ],
    "weaknesses": [
      "fragile",
      "resource dependent"
    ],
    "classQuests": [
      "open_arcane_seal",
      "stabilize_market_rift"
    ],
    "worldInteractions": [
      "read_magical_runes",
      "identify_artifacts",
      "open_arcane_seals"
    ],
    "npcReactionRules": [
      "scholars_offer_lore",
      "superstitious_npcs_may_fear_dark_magic"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "priest": {
    "id": "priest",
    "name": "Priest",
    "roles": [
      "healer",
      "support",
      "damage_dealer"
    ],
    "primaryAttributes": [
      "wisdom",
      "charisma",
      "willpower"
    ],
    "secondaryAttributes": [
      "intelligence",
      "constitution"
    ],
    "armorAccess": [
      "cloth",
      "light"
    ],
    "weaponAccess": [
      "staff",
      "mace",
      "holy_symbol",
      "tome"
    ],
    "resourceTypes": [
      "mana",
      "faith"
    ],
    "startingAbilities": [
      "heal",
      "blessing",
      "holy_light"
    ],
    "specializations": [
      "life_priest",
      "light_priest",
      "oracle"
    ],
    "strengths": [
      "healing",
      "cleansing",
      "anti-undead"
    ],
    "weaknesses": [
      "lower burst mobility",
      "requires positioning"
    ],
    "classQuests": [
      "bless_the_sick_house",
      "calm_the_restless_dead"
    ],
    "worldInteractions": [
      "heal_sickness",
      "calm_spirits",
      "perform_rituals"
    ],
    "npcReactionRules": [
      "villagers_seek_blessings",
      "undead_prioritize_holy_casters"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "paladin": {
    "id": "paladin",
    "name": "Paladin",
    "roles": [
      "tank",
      "healer",
      "support",
      "damage_dealer"
    ],
    "primaryAttributes": [
      "strength",
      "wisdom",
      "charisma",
      "constitution"
    ],
    "secondaryAttributes": [
      "willpower"
    ],
    "armorAccess": [
      "heavy",
      "shield"
    ],
    "weaponAccess": [
      "sword",
      "mace",
      "shield",
      "holy_weapon"
    ],
    "resourceTypes": [
      "faith",
      "conviction",
      "mana",
      "holy_power"
    ],
    "startingAbilities": [
      "smite",
      "shield_of_faith",
      "judgment"
    ],
    "specializations": [
      "protection",
      "devotion",
      "wrath"
    ],
    "strengths": [
      "defensive melee",
      "holy support",
      "lawful authority"
    ],
    "weaknesses": [
      "weaker stealth",
      "bound by oath restrictions"
    ],
    "classQuests": [
      "judge_the_market_thief",
      "defend_the_temple_gate"
    ],
    "worldInteractions": [
      "invoke_legal_authority",
      "protect_civilians",
      "resist_corruption"
    ],
    "npcReactionRules": [
      "lawful_npcs_trust_paladins",
      "criminals_avoid_known_paladins"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "necromancer": {
    "id": "necromancer",
    "name": "Necromancer",
    "roles": [
      "summoner",
      "damage_dealer",
      "controller"
    ],
    "primaryAttributes": [
      "intelligence",
      "willpower",
      "constitution"
    ],
    "secondaryAttributes": [
      "perception"
    ],
    "armorAccess": [
      "cloth",
      "light"
    ],
    "weaponAccess": [
      "staff",
      "dagger",
      "skull_focus",
      "tome"
    ],
    "resourceTypes": [
      "mana",
      "souls",
      "corruption"
    ],
    "startingAbilities": [
      "life_drain",
      "curse_of_weakness",
      "speak_with_dead"
    ],
    "specializations": [
      "bonecaller",
      "plaguebinder",
      "soul_reaper"
    ],
    "strengths": [
      "summons",
      "curses",
      "life drain"
    ],
    "weaknesses": [
      "social suspicion",
      "holy vulnerability"
    ],
    "classQuests": [
      "question_the_fallen_guard",
      "bind_the_restless_bone"
    ],
    "worldInteractions": [
      "speak_with_dead",
      "detect_death_magic",
      "raise_temporary_servants"
    ],
    "npcReactionRules": [
      "temple_npcs_distrust_necromancers",
      "spirits_answer_known_soulbinders"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "druid": {
    "id": "druid",
    "name": "Druid",
    "roles": [
      "healer",
      "tank",
      "damage_dealer",
      "support",
      "controller"
    ],
    "primaryAttributes": [
      "wisdom",
      "constitution",
      "dexterity"
    ],
    "secondaryAttributes": [
      "willpower"
    ],
    "armorAccess": [
      "leather",
      "natural"
    ],
    "weaponAccess": [
      "staff",
      "sickle",
      "spear",
      "claw_form"
    ],
    "resourceTypes": [
      "mana",
      "nature_energy",
      "spirit"
    ],
    "startingAbilities": [
      "rejuvenation",
      "entangling_roots",
      "speak_with_animals"
    ],
    "specializations": [
      "guardian",
      "restoration",
      "wildshape",
      "naturecaller"
    ],
    "strengths": [
      "healing",
      "roots",
      "forms",
      "nature interactions"
    ],
    "weaknesses": [
      "less effective in corrupted zones until cleansed"
    ],
    "classQuests": [
      "cleanse_wilds_shrine",
      "calm_the_boar"
    ],
    "worldInteractions": [
      "speak_with_animals",
      "grow_plants",
      "cleanse_corruption"
    ],
    "npcReactionRules": [
      "farmers_request_land_blessings",
      "beasts_may_ignore_calm_druids"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "bard": {
    "id": "bard",
    "name": "Bard",
    "roles": [
      "support",
      "controller",
      "damage_dealer"
    ],
    "primaryAttributes": [
      "charisma",
      "dexterity",
      "wisdom"
    ],
    "secondaryAttributes": [
      "luck"
    ],
    "armorAccess": [
      "light"
    ],
    "weaponAccess": [
      "rapier",
      "dagger",
      "bow",
      "instrument"
    ],
    "resourceTypes": [
      "inspiration",
      "rhythm",
      "mana"
    ],
    "startingAbilities": [
      "song_of_courage",
      "mocking_verse",
      "rumor_song"
    ],
    "specializations": [
      "minstrel",
      "duelist",
      "siren"
    ],
    "strengths": [
      "buffs",
      "debuffs",
      "social utility"
    ],
    "weaknesses": [
      "lower raw defense",
      "requires tempo management"
    ],
    "classQuests": [
      "perform_for_market_square",
      "settle_a_tavern_mob"
    ],
    "worldInteractions": [
      "perform_for_crowds",
      "gather_rumors",
      "persuade_nobles"
    ],
    "npcReactionRules": [
      "crowds_gather_for_famous_bards",
      "nobles_offer_social_routes"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "monk": {
    "id": "monk",
    "name": "Monk",
    "roles": [
      "damage_dealer",
      "tank",
      "support"
    ],
    "primaryAttributes": [
      "dexterity",
      "willpower",
      "constitution"
    ],
    "secondaryAttributes": [
      "wisdom"
    ],
    "armorAccess": [
      "cloth",
      "light"
    ],
    "weaponAccess": [
      "unarmed",
      "staff",
      "fist_weapon"
    ],
    "resourceTypes": [
      "stamina",
      "focus",
      "chi"
    ],
    "startingAbilities": [
      "flowing_kick",
      "center_self",
      "guard_ally"
    ],
    "specializations": [
      "iron_body",
      "wind_step",
      "spirit_fist"
    ],
    "strengths": [
      "mobility",
      "control resistance",
      "unarmed mastery"
    ],
    "weaknesses": [
      "gear scaling depends on mastery",
      "limited heavy armor"
    ],
    "classQuests": [
      "meditate_at_old_well",
      "defeat_training_master"
    ],
    "worldInteractions": [
      "balance_trials",
      "calm_conflict",
      "break_grapples"
    ],
    "npcReactionRules": [
      "trainers_offer_duels",
      "bullies_underestimate_monks"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "engineer": {
    "id": "engineer",
    "name": "Engineer",
    "roles": [
      "damage_dealer",
      "support",
      "crafter_utility"
    ],
    "primaryAttributes": [
      "intelligence",
      "dexterity",
      "perception"
    ],
    "secondaryAttributes": [
      "constitution"
    ],
    "armorAccess": [
      "light",
      "medium"
    ],
    "weaponAccess": [
      "crossbow",
      "pistol",
      "tool",
      "gadget",
      "engineering_gadget"
    ],
    "resourceTypes": [
      "stamina",
      "gadget_charge",
      "focus"
    ],
    "startingAbilities": [
      "deploy_turret",
      "repair_kit",
      "trap_wire"
    ],
    "specializations": [
      "artificer",
      "siegewright",
      "mechanist"
    ],
    "strengths": [
      "devices",
      "repairs",
      "siege tools"
    ],
    "weaknesses": [
      "setup time",
      "device vulnerability"
    ],
    "classQuests": [
      "repair_market_pump",
      "build_guard_signal"
    ],
    "worldInteractions": [
      "repair_machines",
      "disable_traps",
      "operate_siege_devices"
    ],
    "npcReactionRules": [
      "crafters_offer_contracts",
      "guards_request_barricade_repairs"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  },
  "summoner": {
    "id": "summoner",
    "name": "Summoner",
    "roles": [
      "summoner",
      "support",
      "controller"
    ],
    "primaryAttributes": [
      "intelligence",
      "charisma",
      "willpower"
    ],
    "secondaryAttributes": [
      "wisdom"
    ],
    "armorAccess": [
      "cloth"
    ],
    "weaponAccess": [
      "staff",
      "orb",
      "tome",
      "summoning_focus"
    ],
    "resourceTypes": [
      "mana",
      "bond",
      "focus"
    ],
    "startingAbilities": [
      "summon_wisp",
      "command_pet",
      "bond_mend"
    ],
    "specializations": [
      "beastcaller",
      "spirit_binder",
      "elementalist"
    ],
    "strengths": [
      "companions",
      "pet utility",
      "distributed pressure"
    ],
    "weaknesses": [
      "pet positioning liability",
      "weaker direct defense"
    ],
    "classQuests": [
      "bind_first_companion",
      "learn_stable_oath"
    ],
    "worldInteractions": [
      "command_companions",
      "bind_spirits",
      "assist_stable_services"
    ],
    "npcReactionRules": [
      "stable_masters_offer_training",
      "guards_warn_about_pet_griefing"
    ],
    "progressionMilestones": [
      1,
      5,
      10,
      25,
      50
    ]
  }
} as Record<string, HarthmereClassDefinitionV1>;

export const HARTHMERE_SKILL_CATALOG_V1 = {
  "melee_combat": {
    "id": "melee_combat",
    "name": "Melee Combat",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "ranged_combat": {
    "id": "ranged_combat",
    "name": "Ranged Combat",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "shield_use": {
    "id": "shield_use",
    "name": "Shield Use",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "dual_wielding": {
    "id": "dual_wielding",
    "name": "Dual Wielding",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "heavy_weapons": {
    "id": "heavy_weapons",
    "name": "Heavy Weapons",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "light_weapons": {
    "id": "light_weapons",
    "name": "Light Weapons",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "critical_strikes": {
    "id": "critical_strikes",
    "name": "Critical Strikes",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "blocking": {
    "id": "blocking",
    "name": "Blocking",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "dodging": {
    "id": "dodging",
    "name": "Dodging",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "parrying": {
    "id": "parrying",
    "name": "Parrying",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "tactical_awareness": {
    "id": "tactical_awareness",
    "name": "Tactical Awareness",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "battle_focus": {
    "id": "battle_focus",
    "name": "Battle Focus",
    "category": "combat",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "meaningful_combat_action"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "resource_efficiency"
    ],
    "relatedAbilities": [
      "basic_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "sword_mastery": {
    "id": "sword_mastery",
    "name": "Sword Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "riposte"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "axe_mastery": {
    "id": "axe_mastery",
    "name": "Axe Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "cleave"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "mace_mastery": {
    "id": "mace_mastery",
    "name": "Mace Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "shield_bash"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "spear_mastery": {
    "id": "spear_mastery",
    "name": "Spear Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "charge"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "dagger_mastery": {
    "id": "dagger_mastery",
    "name": "Dagger Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "backstab"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "bow_mastery": {
    "id": "bow_mastery",
    "name": "Bow Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "aimed_shot"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "crossbow_mastery": {
    "id": "crossbow_mastery",
    "name": "Crossbow Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "quick_shot"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "staff_mastery": {
    "id": "staff_mastery",
    "name": "Staff Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "frost_barrier"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "wand_mastery": {
    "id": "wand_mastery",
    "name": "Wand Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "spark"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "shield_mastery": {
    "id": "shield_mastery",
    "name": "Shield Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "shield_bash"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "unarmed_mastery": {
    "id": "unarmed_mastery",
    "name": "Unarmed Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "flowing_kick"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "great_weapon_mastery": {
    "id": "great_weapon_mastery",
    "name": "Great Weapon Mastery",
    "category": "weapon",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "successful_hits_with_matching_weapon",
      "trainer_drills"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "accuracy",
      "damage",
      "attack_speed",
      "crit",
      "durability_efficiency"
    ],
    "relatedAbilities": [
      "power_strike"
    ],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "cloth_armor": {
    "id": "cloth_armor",
    "name": "Cloth Armor",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "light_armor": {
    "id": "light_armor",
    "name": "Light Armor",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "medium_armor": {
    "id": "medium_armor",
    "name": "Medium Armor",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "heavy_armor": {
    "id": "heavy_armor",
    "name": "Heavy Armor",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "evasion": {
    "id": "evasion",
    "name": "Evasion",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "endurance": {
    "id": "endurance",
    "name": "Endurance",
    "category": "armor",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "surviving_hits_with_matching_armor",
      "trainer_lessons"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      30,
      60,
      100
    ],
    "passiveBonuses": [
      "movement_penalty_reduction",
      "defense",
      "resistance"
    ],
    "relatedAbilities": [],
    "worldInteractions": [],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "fire_magic": {
    "id": "fire_magic",
    "name": "Fire Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "fireball"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "ice_magic": {
    "id": "ice_magic",
    "name": "Ice Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "frost_barrier"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "lightning_magic": {
    "id": "lightning_magic",
    "name": "Lightning Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "lightning_bolt"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "earth_magic": {
    "id": "earth_magic",
    "name": "Earth Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "stone_skin"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "water_magic": {
    "id": "water_magic",
    "name": "Water Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "cleanse"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "wind_magic": {
    "id": "wind_magic",
    "name": "Wind Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "wind_step"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "arcane_magic": {
    "id": "arcane_magic",
    "name": "Arcane Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "teleport"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "holy_magic": {
    "id": "holy_magic",
    "name": "Holy Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "holy_light"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "dark_magic": {
    "id": "dark_magic",
    "name": "Dark Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "curse_of_weakness"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "nature_magic": {
    "id": "nature_magic",
    "name": "Nature Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "entangling_roots"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "poison_magic": {
    "id": "poison_magic",
    "name": "Poison Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "poison_blade"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "blood_magic": {
    "id": "blood_magic",
    "name": "Blood Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "life_drain"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "illusion_magic": {
    "id": "illusion_magic",
    "name": "Illusion Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "charm"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "necromancy": {
    "id": "necromancy",
    "name": "Necromancy",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "raise_skeleton"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "summoning": {
    "id": "summoning",
    "name": "Summoning",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "summon_wisp"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "time_magic": {
    "id": "time_magic",
    "name": "Time Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "haste"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "space_magic": {
    "id": "space_magic",
    "name": "Space Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "teleport"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "spirit_magic": {
    "id": "spirit_magic",
    "name": "Spirit Magic",
    "category": "magic",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_spell_cast",
      "trainer_ritual"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "spell_power",
      "mana_efficiency",
      "spell_accuracy",
      "resistance_penetration"
    ],
    "relatedAbilities": [
      "resurrection"
    ],
    "worldInteractions": [
      "read_runes"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "blacksmithing": {
    "id": "blacksmithing",
    "name": "Blacksmithing",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "weaponsmithing": {
    "id": "weaponsmithing",
    "name": "Weaponsmithing",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "armorsmithing": {
    "id": "armorsmithing",
    "name": "Armorsmithing",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "alchemy": {
    "id": "alchemy",
    "name": "Alchemy",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "cooking": {
    "id": "cooking",
    "name": "Cooking",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "tailoring": {
    "id": "tailoring",
    "name": "Tailoring",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "leatherworking": {
    "id": "leatherworking",
    "name": "Leatherworking",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "carpentry": {
    "id": "carpentry",
    "name": "Carpentry",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "engineering": {
    "id": "engineering",
    "name": "Engineering",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "enchanting": {
    "id": "enchanting",
    "name": "Enchanting",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "medicine": {
    "id": "medicine",
    "name": "Medicine",
    "category": "profession",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "mining": {
    "id": "mining",
    "name": "Mining",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "logging": {
    "id": "logging",
    "name": "Logging",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "herbalism": {
    "id": "herbalism",
    "name": "Herbalism",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "fishing": {
    "id": "fishing",
    "name": "Fishing",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "skinning": {
    "id": "skinning",
    "name": "Skinning",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "farming": {
    "id": "farming",
    "name": "Farming",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "scavenging": {
    "id": "scavenging",
    "name": "Scavenging",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "archaeology": {
    "id": "archaeology",
    "name": "Archaeology",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "monster_harvesting": {
    "id": "monster_harvesting",
    "name": "Monster Harvesting",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "magical_harvesting": {
    "id": "magical_harvesting",
    "name": "Magical Harvesting",
    "category": "gathering",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "smelting": {
    "id": "smelting",
    "name": "Smelting",
    "category": "crafting",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "inscription": {
    "id": "inscription",
    "name": "Inscription",
    "category": "crafting",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "runecrafting": {
    "id": "runecrafting",
    "name": "Runecrafting",
    "category": "crafting",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "construction": {
    "id": "construction",
    "name": "Construction",
    "category": "crafting",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "persuasion": {
    "id": "persuasion",
    "name": "Persuasion",
    "category": "social",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "intimidation": {
    "id": "intimidation",
    "name": "Intimidation",
    "category": "social",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "deception": {
    "id": "deception",
    "name": "Deception",
    "category": "social",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "diplomacy": {
    "id": "diplomacy",
    "name": "Diplomacy",
    "category": "social",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "performance": {
    "id": "performance",
    "name": "Performance",
    "category": "social",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "leadership": {
    "id": "leadership",
    "name": "Leadership",
    "category": "leadership",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "tracking": {
    "id": "tracking",
    "name": "Tracking",
    "category": "exploration",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "cartography": {
    "id": "cartography",
    "name": "Cartography",
    "category": "exploration",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "climbing": {
    "id": "climbing",
    "name": "Climbing",
    "category": "exploration",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "trap_detection": {
    "id": "trap_detection",
    "name": "Trap Detection",
    "category": "exploration",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "secret_finding": {
    "id": "secret_finding",
    "name": "Secret Finding",
    "category": "exploration",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "wilderness_survival": {
    "id": "wilderness_survival",
    "name": "Wilderness Survival",
    "category": "survival",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "disease_resistance": {
    "id": "disease_resistance",
    "name": "Disease Resistance",
    "category": "survival",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "cold_survival": {
    "id": "cold_survival",
    "name": "Cold Survival",
    "category": "survival",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "heat_survival": {
    "id": "heat_survival",
    "name": "Heat Survival",
    "category": "survival",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "sprinting": {
    "id": "sprinting",
    "name": "Sprinting",
    "category": "movement",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "swimming": {
    "id": "swimming",
    "name": "Swimming",
    "category": "movement",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "acrobatics": {
    "id": "acrobatics",
    "name": "Acrobatics",
    "category": "movement",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "sneaking": {
    "id": "sneaking",
    "name": "Sneaking",
    "category": "stealth",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "lockpicking": {
    "id": "lockpicking",
    "name": "Lockpicking",
    "category": "stealth",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "pickpocketing": {
    "id": "pickpocketing",
    "name": "Pickpocketing",
    "category": "stealth",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  },
  "trap_disarming": {
    "id": "trap_disarming",
    "name": "Trap Disarming",
    "category": "stealth",
    "maxLevel": 100,
    "progressionMethod": "hybrid_use_training_books_quests",
    "improvesFrom": [
      "valid_world_action",
      "trainer_lesson",
      "quest_milestone"
    ],
    "doesNotImproveFrom": [
      "afk_loop",
      "trivial_repetition",
      "client_only_action_without_server_validation",
      "training_dummy_after_daily_cap"
    ],
    "unlockMilestones": [
      1,
      25,
      50,
      75,
      100
    ],
    "passiveBonuses": [
      "success_chance",
      "speed",
      "quality",
      "new_interactions"
    ],
    "relatedAbilities": [],
    "worldInteractions": [
      "world_skill_check"
    ],
    "antiAbuseRules": [
      "diminishing_returns_for_repeated_targets",
      "no_progress_from_grey_content",
      "server_validated_action_log_required"
    ]
  }
} as Record<string, HarthmereSkillDefinitionV1>;

export const HARTHMERE_ABILITY_CATALOG_V1 = {
  "basic_strike": {
    "id": "basic_strike",
    "name": "Basic Strike",
    "type": "basic_attack",
    "classRequirements": [],
    "specializationRequirements": [],
    "skillRequirements": {},
    "levelRequirement": 1,
    "resourceType": "stamina",
    "resourceCost": 5,
    "cooldownSeconds": 1.5,
    "castTimeSeconds": 0,
    "range": 2.2,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "sword",
      "axe",
      "mace",
      "dagger",
      "unarmed"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "physical",
        "base": 20,
        "scalingAttribute": "strength",
        "scalingRatio": 0.45
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Basic Strike: server validated basic_attack ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "basic_strike_rank_2",
      "basic_strike_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "melee_basic"
  },
  "power_strike": {
    "id": "power_strike",
    "name": "Power Strike",
    "type": "active_ability",
    "classRequirements": [
      "warrior"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "melee_combat": 5
    },
    "levelRequirement": 2,
    "resourceType": "rage",
    "resourceCost": 15,
    "cooldownSeconds": 6,
    "castTimeSeconds": 0,
    "range": 2.4,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "sword",
      "axe",
      "mace",
      "great_weapon"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "physical",
        "base": 65,
        "scalingAttribute": "strength",
        "scalingRatio": 0.85
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Power Strike: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "power_strike_rank_2",
      "power_strike_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "heavy_melee"
  },
  "shield_bash": {
    "id": "shield_bash",
    "name": "Shield Bash",
    "type": "reaction_ability",
    "classRequirements": [
      "warrior",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "shield_use": 5
    },
    "levelRequirement": 3,
    "resourceType": "stamina",
    "resourceCost": 20,
    "cooldownSeconds": 10,
    "castTimeSeconds": 0,
    "range": 1.8,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "shield"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "blunt",
        "base": 25,
        "scalingAttribute": "strength",
        "scalingRatio": 0.35
      },
      {
        "type": "interrupt",
        "durationSeconds": 2
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.8,
      "healingMultiplier": 1,
      "durationMultiplier": 0.5,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Shield Bash: server validated reaction_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "shield_bash_rank_2",
      "shield_bash_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "shield_bash"
  },
  "taunt": {
    "id": "taunt",
    "name": "Taunt",
    "type": "active_ability",
    "classRequirements": [
      "warrior",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "tactical_awareness": 3
    },
    "levelRequirement": 4,
    "resourceType": "rage",
    "resourceCost": 10,
    "cooldownSeconds": 8,
    "castTimeSeconds": 0,
    "range": 15,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "threat",
        "base": 500
      },
      {
        "type": "forced_attack",
        "durationSeconds": 3
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0,
      "healingMultiplier": 1,
      "durationMultiplier": 0.35,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Taunt: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "taunt_rank_2",
      "taunt_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "taunt"
  },
  "cleave": {
    "id": "cleave",
    "name": "Cleave",
    "type": "active_ability",
    "classRequirements": [
      "warrior"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "axe_mastery": 10
    },
    "levelRequirement": 8,
    "resourceType": "rage",
    "resourceCost": 25,
    "cooldownSeconds": 8,
    "castTimeSeconds": 0,
    "range": 3,
    "targetType": "cone",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "axe",
      "great_weapon"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "slashing",
        "base": 55,
        "scalingAttribute": "strength",
        "scalingRatio": 0.65
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Cleave: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "cleave_rank_2",
      "cleave_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "cleave"
  },
  "charge": {
    "id": "charge",
    "name": "Charge",
    "type": "movement_ability",
    "classRequirements": [
      "warrior",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "spear_mastery": 8
    },
    "levelRequirement": 8,
    "resourceType": "stamina",
    "resourceCost": 25,
    "cooldownSeconds": 18,
    "castTimeSeconds": 0,
    "range": 18,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "spear",
      "sword",
      "mace"
    ],
    "effects": [
      {
        "type": "movement"
      },
      {
        "type": "damage",
        "damageType": "physical",
        "base": 35,
        "scalingAttribute": "strength",
        "scalingRatio": 0.45
      },
      {
        "type": "root",
        "durationSeconds": 1.5
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.75,
      "healingMultiplier": 1,
      "durationMultiplier": 0.5,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Charge: server validated movement_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "charge_rank_2",
      "charge_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "charge"
  },
  "last_stand": {
    "id": "last_stand",
    "name": "Last Stand",
    "type": "defensive_ability",
    "classRequirements": [
      "warrior"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "endurance": 20
    },
    "levelRequirement": 15,
    "resourceType": "rage",
    "resourceCost": 30,
    "cooldownSeconds": 120,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "buff",
        "stat": "maxHp",
        "value": 0.3,
        "durationSeconds": 12
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Last Stand: server validated defensive_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "last_stand_rank_2",
      "last_stand_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "defensive"
  },
  "guard_ally": {
    "id": "guard_ally",
    "name": "Guard Ally",
    "type": "defensive_ability",
    "classRequirements": [
      "warrior",
      "monk"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "shield_use": 15
    },
    "levelRequirement": 12,
    "resourceType": "stamina",
    "resourceCost": 30,
    "cooldownSeconds": 25,
    "castTimeSeconds": 0,
    "range": 8,
    "targetType": "ally",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "shield"
    ],
    "effects": [
      {
        "type": "redirect_damage",
        "percent": 0.3,
        "durationSeconds": 8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Guard Ally: server validated defensive_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "guard_ally_rank_2",
      "guard_ally_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "guard"
  },
  "backstab": {
    "id": "backstab",
    "name": "Backstab",
    "type": "active_ability",
    "classRequirements": [
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "dagger_mastery": 5
    },
    "levelRequirement": 3,
    "resourceType": "energy",
    "resourceCost": 35,
    "cooldownSeconds": 4,
    "castTimeSeconds": 0,
    "range": 1.8,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "dagger"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "piercing",
        "base": 80,
        "scalingAttribute": "dexterity",
        "scalingRatio": 0.9
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.85,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Backstab: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "backstab_rank_2",
      "backstab_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "backstab"
  },
  "vanish": {
    "id": "vanish",
    "name": "Vanish",
    "type": "defensive_ability",
    "classRequirements": [
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "sneaking": 15
    },
    "levelRequirement": 10,
    "resourceType": "energy",
    "resourceCost": 40,
    "cooldownSeconds": 90,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "stealth",
        "durationSeconds": 6
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 0.75,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Vanish: server validated defensive_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "vanish_rank_2",
      "vanish_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "stealth"
  },
  "poison_blade": {
    "id": "poison_blade",
    "name": "Poison Blade",
    "type": "active_ability",
    "classRequirements": [
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "poison_magic": 5
    },
    "levelRequirement": 6,
    "resourceType": "energy",
    "resourceCost": 25,
    "cooldownSeconds": 10,
    "castTimeSeconds": 0,
    "range": 2,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "dagger",
      "short_sword"
    ],
    "effects": [
      {
        "type": "damage_over_time",
        "damageType": "poison",
        "base": 12,
        "ticks": 6
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.7,
      "healingMultiplier": 1,
      "durationMultiplier": 0.75,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Poison Blade: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "poison_blade_rank_2",
      "poison_blade_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "poison"
  },
  "pick_lock": {
    "id": "pick_lock",
    "name": "Pick Lock",
    "type": "world_interaction_ability",
    "classRequirements": [
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "lockpicking": 1
    },
    "levelRequirement": 1,
    "resourceType": "none",
    "resourceCost": 0,
    "cooldownSeconds": 2,
    "castTimeSeconds": 2,
    "range": 1.5,
    "targetType": "object",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "unlock"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Pick Lock: server validated world_interaction_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "pick_lock_rank_2",
      "pick_lock_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "world_interaction"
  },
  "disarm_trap": {
    "id": "disarm_trap",
    "name": "Disarm Trap",
    "type": "world_interaction_ability",
    "classRequirements": [
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "trap_disarming": 1
    },
    "levelRequirement": 1,
    "resourceType": "none",
    "resourceCost": 0,
    "cooldownSeconds": 3,
    "castTimeSeconds": 2,
    "range": 2,
    "targetType": "object",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "disable_trap"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Disarm Trap: server validated world_interaction_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "disarm_trap_rank_2",
      "disarm_trap_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "world_interaction"
  },
  "quick_shot": {
    "id": "quick_shot",
    "name": "Quick Shot",
    "type": "basic_attack",
    "classRequirements": [
      "ranger"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "bow_mastery": 1
    },
    "levelRequirement": 1,
    "resourceType": "focus",
    "resourceCost": 8,
    "cooldownSeconds": 2,
    "castTimeSeconds": 0,
    "range": 25,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "bow",
      "crossbow"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "piercing",
        "base": 28,
        "scalingAttribute": "dexterity",
        "scalingRatio": 0.55
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Quick Shot: server validated basic_attack ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "quick_shot_rank_2",
      "quick_shot_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "ranged"
  },
  "aimed_shot": {
    "id": "aimed_shot",
    "name": "Aimed Shot",
    "type": "active_ability",
    "classRequirements": [
      "ranger"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "bow_mastery": 10
    },
    "levelRequirement": 5,
    "resourceType": "focus",
    "resourceCost": 30,
    "cooldownSeconds": 8,
    "castTimeSeconds": 1.5,
    "range": 30,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "bow",
      "crossbow"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "piercing",
        "base": 110,
        "scalingAttribute": "perception",
        "scalingRatio": 0.9
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.8,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Aimed Shot: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "aimed_shot_rank_2",
      "aimed_shot_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "aimed_ranged"
  },
  "multi_shot": {
    "id": "multi_shot",
    "name": "Multi-Shot",
    "type": "active_ability",
    "classRequirements": [
      "ranger"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "ranged_combat": 12
    },
    "levelRequirement": 10,
    "resourceType": "focus",
    "resourceCost": 35,
    "cooldownSeconds": 12,
    "castTimeSeconds": 0,
    "range": 25,
    "targetType": "cone",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "bow"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "piercing",
        "base": 50,
        "scalingAttribute": "dexterity",
        "scalingRatio": 0.5
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Multi-Shot: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "multi_shot_rank_2",
      "multi_shot_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "multi_ranged"
  },
  "hunter_mark": {
    "id": "hunter_mark",
    "name": "Hunter's Mark",
    "type": "active_ability",
    "classRequirements": [
      "ranger"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "tracking": 3
    },
    "levelRequirement": 4,
    "resourceType": "focus",
    "resourceCost": 15,
    "cooldownSeconds": 10,
    "castTimeSeconds": 0,
    "range": 35,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "debuff",
        "stat": "evasion",
        "value": -0.1,
        "durationSeconds": 20
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 0.6,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Hunter's Mark: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "hunter_mark_rank_2",
      "hunter_mark_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "mark"
  },
  "bear_trap": {
    "id": "bear_trap",
    "name": "Bear Trap",
    "type": "active_ability",
    "classRequirements": [
      "ranger",
      "engineer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "trap_detection": 5
    },
    "levelRequirement": 6,
    "resourceType": "focus",
    "resourceCost": 20,
    "cooldownSeconds": 20,
    "castTimeSeconds": 1,
    "range": 4,
    "targetType": "ground",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "root",
        "durationSeconds": 6
      },
      {
        "type": "damage",
        "damageType": "physical",
        "base": 35,
        "scalingAttribute": "perception",
        "scalingRatio": 0.3
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.7,
      "healingMultiplier": 1,
      "durationMultiplier": 0.4,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Bear Trap: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "bear_trap_rank_2",
      "bear_trap_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "trap"
  },
  "tame_animal": {
    "id": "tame_animal",
    "name": "Tame Animal",
    "type": "world_interaction_ability",
    "classRequirements": [
      "ranger",
      "druid"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "tracking": 15
    },
    "levelRequirement": 10,
    "resourceType": "focus",
    "resourceCost": 30,
    "cooldownSeconds": 30,
    "castTimeSeconds": 4,
    "range": 12,
    "targetType": "beast",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "tame"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Tame Animal: server validated world_interaction_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "tame_animal_rank_2",
      "tame_animal_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "tame"
  },
  "spark": {
    "id": "spark",
    "name": "Spark",
    "type": "basic_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "arcane_magic": 1
    },
    "levelRequirement": 1,
    "resourceType": "mana",
    "resourceCost": 8,
    "cooldownSeconds": 1.5,
    "castTimeSeconds": 0.7,
    "range": 25,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "wand",
      "staff",
      "spell_focus"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "arcane",
        "base": 30,
        "scalingAttribute": "intelligence",
        "scalingRatio": 0.55
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Spark: server validated basic_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "spark_rank_2",
      "spark_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "spell_cast"
  },
  "fireball": {
    "id": "fireball",
    "name": "Fireball",
    "type": "active_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "fire_magic": 25
    },
    "levelRequirement": 8,
    "resourceType": "mana",
    "resourceCost": 35,
    "cooldownSeconds": 6,
    "castTimeSeconds": 2,
    "range": 30,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "staff",
      "wand",
      "spell_focus"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "fire",
        "base": 120,
        "scalingAttribute": "intelligence",
        "scalingRatio": 0.8
      },
      {
        "type": "burn",
        "durationSeconds": 6,
        "tickDamage": 12
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.85,
      "healingMultiplier": 1,
      "durationMultiplier": 0.75,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Fireball: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "fireball_rank_2",
      "fireball_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "fire_spell"
  },
  "frost_barrier": {
    "id": "frost_barrier",
    "name": "Frost Barrier",
    "type": "defensive_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "ice_magic": 10
    },
    "levelRequirement": 5,
    "resourceType": "mana",
    "resourceCost": 30,
    "cooldownSeconds": 18,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "absorb",
        "amount": 120,
        "scalingAttribute": "intelligence",
        "scalingRatio": 1.2
      },
      {
        "type": "slow_attackers",
        "durationSeconds": 4
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Frost Barrier: server validated defensive_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "frost_barrier_rank_2",
      "frost_barrier_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "barrier"
  },
  "lightning_bolt": {
    "id": "lightning_bolt",
    "name": "Lightning Bolt",
    "type": "active_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "lightning_magic": 10
    },
    "levelRequirement": 6,
    "resourceType": "mana",
    "resourceCost": 28,
    "cooldownSeconds": 5,
    "castTimeSeconds": 1,
    "range": 28,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "staff",
      "wand",
      "spell_focus"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "lightning",
        "base": 90,
        "scalingAttribute": "intelligence",
        "scalingRatio": 0.75
      },
      {
        "type": "interrupt",
        "durationSeconds": 1
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.8,
      "healingMultiplier": 1,
      "durationMultiplier": 0.5,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Lightning Bolt: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "lightning_bolt_rank_2",
      "lightning_bolt_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "lightning_spell"
  },
  "teleport": {
    "id": "teleport",
    "name": "Teleport",
    "type": "movement_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "space_magic": 25
    },
    "levelRequirement": 15,
    "resourceType": "mana",
    "resourceCost": 45,
    "cooldownSeconds": 60,
    "castTimeSeconds": 1.5,
    "range": 20,
    "targetType": "ground",
    "requiresLineOfSight": false,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "blink"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Teleport: server validated movement_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "teleport_rank_2",
      "teleport_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "teleport"
  },
  "polymorph": {
    "id": "polymorph",
    "name": "Polymorph",
    "type": "active_spell",
    "classRequirements": [
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "illusion_magic": 25
    },
    "levelRequirement": 18,
    "resourceType": "mana",
    "resourceCost": 50,
    "cooldownSeconds": 45,
    "castTimeSeconds": 1.8,
    "range": 25,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "crowd_control",
        "category": "charm",
        "durationSeconds": 8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0,
      "healingMultiplier": 1,
      "durationMultiplier": 0.35,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Polymorph: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "polymorph_rank_2",
      "polymorph_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "control_spell"
  },
  "heal": {
    "id": "heal",
    "name": "Heal",
    "type": "active_spell",
    "classRequirements": [
      "priest",
      "druid"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 1
    },
    "levelRequirement": 1,
    "resourceType": "mana",
    "resourceCost": 25,
    "cooldownSeconds": 3,
    "castTimeSeconds": 1.5,
    "range": 25,
    "targetType": "ally",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "healing",
        "base": 90,
        "scalingAttribute": "wisdom",
        "scalingRatio": 0.9
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 0.8,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Heal: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "heal_rank_2",
      "heal_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "heal"
  },
  "blessing": {
    "id": "blessing",
    "name": "Blessing",
    "type": "active_spell",
    "classRequirements": [
      "priest",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 5
    },
    "levelRequirement": 3,
    "resourceType": "faith",
    "resourceCost": 20,
    "cooldownSeconds": 20,
    "castTimeSeconds": 0,
    "range": 25,
    "targetType": "ally",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "buff",
        "stat": "defense",
        "value": 0.08,
        "durationSeconds": 60
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Blessing: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "blessing_rank_2",
      "blessing_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "blessing"
  },
  "holy_light": {
    "id": "holy_light",
    "name": "Holy Light",
    "type": "active_spell",
    "classRequirements": [
      "priest",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 10
    },
    "levelRequirement": 5,
    "resourceType": "mana",
    "resourceCost": 30,
    "cooldownSeconds": 6,
    "castTimeSeconds": 1,
    "range": 25,
    "targetType": "ally_or_enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "healing_or_holy_damage",
        "base": 110,
        "scalingAttribute": "wisdom",
        "scalingRatio": 0.8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.85,
      "healingMultiplier": 0.85,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Holy Light: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "holy_light_rank_2",
      "holy_light_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "holy"
  },
  "resurrection": {
    "id": "resurrection",
    "name": "Resurrection",
    "type": "active_spell",
    "classRequirements": [
      "priest",
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "spirit_magic": 25
    },
    "levelRequirement": 18,
    "resourceType": "mana",
    "resourceCost": 60,
    "cooldownSeconds": 120,
    "castTimeSeconds": 4,
    "range": 8,
    "targetType": "dead_or_downed_ally",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "revive",
        "hpPercent": 0.4,
        "resourcePercent": 0.3
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Resurrection: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "resurrection_rank_2",
      "resurrection_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "resurrection"
  },
  "smite": {
    "id": "smite",
    "name": "Smite",
    "type": "active_spell",
    "classRequirements": [
      "paladin",
      "priest"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 1
    },
    "levelRequirement": 1,
    "resourceType": "faith",
    "resourceCost": 12,
    "cooldownSeconds": 3,
    "castTimeSeconds": 0,
    "range": 20,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "holy_weapon",
      "mace",
      "staff"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "holy",
        "base": 45,
        "scalingAttribute": "wisdom",
        "scalingRatio": 0.45
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Smite: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "smite_rank_2",
      "smite_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "holy_attack"
  },
  "shield_of_faith": {
    "id": "shield_of_faith",
    "name": "Shield of Faith",
    "type": "defensive_spell",
    "classRequirements": [
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "shield_mastery": 5
    },
    "levelRequirement": 4,
    "resourceType": "faith",
    "resourceCost": 25,
    "cooldownSeconds": 20,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "shield"
    ],
    "effects": [
      {
        "type": "absorb",
        "amount": 100,
        "scalingAttribute": "charisma",
        "scalingRatio": 0.8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Shield of Faith: server validated defensive_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "shield_of_faith_rank_2",
      "shield_of_faith_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "holy_shield"
  },
  "judgment": {
    "id": "judgment",
    "name": "Judgment",
    "type": "active_ability",
    "classRequirements": [
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 10
    },
    "levelRequirement": 8,
    "resourceType": "conviction",
    "resourceCost": 20,
    "cooldownSeconds": 10,
    "castTimeSeconds": 0,
    "range": 15,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "sword",
      "mace",
      "holy_weapon"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "holy",
        "base": 70,
        "scalingAttribute": "strength",
        "scalingRatio": 0.55
      },
      {
        "type": "debuff",
        "stat": "damage",
        "value": -0.05,
        "durationSeconds": 8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.85,
      "healingMultiplier": 1,
      "durationMultiplier": 0.7,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Judgment: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "judgment_rank_2",
      "judgment_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "judgment"
  },
  "consecrate": {
    "id": "consecrate",
    "name": "Consecrate",
    "type": "active_spell",
    "classRequirements": [
      "paladin"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "holy_magic": 20
    },
    "levelRequirement": 14,
    "resourceType": "faith",
    "resourceCost": 45,
    "cooldownSeconds": 30,
    "castTimeSeconds": 0,
    "range": 8,
    "targetType": "area",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "area_damage",
        "damageType": "holy",
        "base": 35,
        "ticks": 8
      },
      {
        "type": "threat",
        "base": 300
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.65,
      "healingMultiplier": 1,
      "durationMultiplier": 0.8,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Consecrate: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "consecrate_rank_2",
      "consecrate_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "ground_aoe"
  },
  "life_drain": {
    "id": "life_drain",
    "name": "Life Drain",
    "type": "channeled_spell",
    "classRequirements": [
      "necromancer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "blood_magic": 5
    },
    "levelRequirement": 3,
    "resourceType": "mana",
    "resourceCost": 20,
    "cooldownSeconds": 8,
    "castTimeSeconds": 3,
    "range": 20,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "staff",
      "skull_focus"
    ],
    "effects": [
      {
        "type": "damage_and_heal",
        "damageType": "dark",
        "base": 25,
        "ticks": 4,
        "healPercent": 0.5
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.75,
      "healingMultiplier": 0.7,
      "durationMultiplier": 0.75,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Life Drain: server validated channeled_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "life_drain_rank_2",
      "life_drain_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "drain"
  },
  "curse_of_weakness": {
    "id": "curse_of_weakness",
    "name": "Curse of Weakness",
    "type": "active_spell",
    "classRequirements": [
      "necromancer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "dark_magic": 5
    },
    "levelRequirement": 4,
    "resourceType": "mana",
    "resourceCost": 22,
    "cooldownSeconds": 12,
    "castTimeSeconds": 1,
    "range": 25,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "debuff",
        "stat": "attackPoints",
        "value": -0.12,
        "durationSeconds": 15
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 0.6,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Curse of Weakness: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "curse_of_weakness_rank_2",
      "curse_of_weakness_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "curse"
  },
  "raise_skeleton": {
    "id": "raise_skeleton",
    "name": "Raise Skeleton",
    "type": "active_spell",
    "classRequirements": [
      "necromancer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "necromancy": 20
    },
    "levelRequirement": 12,
    "resourceType": "souls",
    "resourceCost": 1,
    "cooldownSeconds": 30,
    "castTimeSeconds": 2,
    "range": 8,
    "targetType": "corpse",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "summon",
        "summonId": "skeleton_minion",
        "durationSeconds": 60
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Raise Skeleton: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "raise_skeleton_rank_2",
      "raise_skeleton_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "summon"
  },
  "fear": {
    "id": "fear",
    "name": "Fear",
    "type": "active_spell",
    "classRequirements": [
      "necromancer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "dark_magic": 15
    },
    "levelRequirement": 10,
    "resourceType": "mana",
    "resourceCost": 35,
    "cooldownSeconds": 30,
    "castTimeSeconds": 1.5,
    "range": 20,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "crowd_control",
        "category": "fear",
        "durationSeconds": 6
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0,
      "healingMultiplier": 1,
      "durationMultiplier": 0.35,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Fear: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "fear_rank_2",
      "fear_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "fear"
  },
  "rejuvenation": {
    "id": "rejuvenation",
    "name": "Rejuvenation",
    "type": "active_spell",
    "classRequirements": [
      "druid"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "nature_magic": 1
    },
    "levelRequirement": 1,
    "resourceType": "mana",
    "resourceCost": 18,
    "cooldownSeconds": 4,
    "castTimeSeconds": 0,
    "range": 25,
    "targetType": "ally",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "heal_over_time",
        "base": 20,
        "ticks": 5,
        "scalingAttribute": "wisdom",
        "scalingRatio": 0.25
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 0.85,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Rejuvenation: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "rejuvenation_rank_2",
      "rejuvenation_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "hot"
  },
  "entangling_roots": {
    "id": "entangling_roots",
    "name": "Entangling Roots",
    "type": "active_spell",
    "classRequirements": [
      "druid"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "nature_magic": 8
    },
    "levelRequirement": 5,
    "resourceType": "mana",
    "resourceCost": 26,
    "cooldownSeconds": 16,
    "castTimeSeconds": 1.2,
    "range": 25,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "root",
        "durationSeconds": 8
      },
      {
        "type": "damage_over_time",
        "damageType": "nature",
        "base": 8,
        "ticks": 4
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.7,
      "healingMultiplier": 1,
      "durationMultiplier": 0.35,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Entangling Roots: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "entangling_roots_rank_2",
      "entangling_roots_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "root"
  },
  "bear_form": {
    "id": "bear_form",
    "name": "Bear Form",
    "type": "toggle_ability",
    "classRequirements": [
      "druid"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "wildshape": 1
    },
    "levelRequirement": 10,
    "resourceType": "nature_energy",
    "resourceCost": 20,
    "cooldownSeconds": 8,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "form",
        "form": "bear",
        "statModifiers": {
          "maxHp": 0.25,
          "armor": 0.25,
          "damage": -0.05
        }
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Bear Form: server validated toggle_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "bear_form_rank_2",
      "bear_form_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "form"
  },
  "song_of_courage": {
    "id": "song_of_courage",
    "name": "Song of Courage",
    "type": "active_ability",
    "classRequirements": [
      "bard"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "performance": 1
    },
    "levelRequirement": 1,
    "resourceType": "inspiration",
    "resourceCost": 20,
    "cooldownSeconds": 20,
    "castTimeSeconds": 1,
    "range": 20,
    "targetType": "party",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "instrument"
    ],
    "effects": [
      {
        "type": "buff",
        "stat": "damage",
        "value": 0.05,
        "durationSeconds": 30
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Song of Courage: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "song_of_courage_rank_2",
      "song_of_courage_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "song"
  },
  "mocking_verse": {
    "id": "mocking_verse",
    "name": "Mocking Verse",
    "type": "active_ability",
    "classRequirements": [
      "bard"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "performance": 5
    },
    "levelRequirement": 4,
    "resourceType": "inspiration",
    "resourceCost": 18,
    "cooldownSeconds": 8,
    "castTimeSeconds": 0,
    "range": 20,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "instrument",
      "rapier"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "sonic",
        "base": 35,
        "scalingAttribute": "charisma",
        "scalingRatio": 0.5
      },
      {
        "type": "debuff",
        "stat": "accuracy",
        "value": -0.08,
        "durationSeconds": 6
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0.85,
      "healingMultiplier": 1,
      "durationMultiplier": 0.65,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Mocking Verse: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "mocking_verse_rank_2",
      "mocking_verse_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "song_attack"
  },
  "charm": {
    "id": "charm",
    "name": "Charm",
    "type": "active_spell",
    "classRequirements": [
      "bard",
      "mage"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "illusion_magic": 15
    },
    "levelRequirement": 10,
    "resourceType": "mana",
    "resourceCost": 35,
    "cooldownSeconds": 45,
    "castTimeSeconds": 1.5,
    "range": 20,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "crowd_control",
        "category": "charm",
        "durationSeconds": 8
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0,
      "healingMultiplier": 1,
      "durationMultiplier": 0.35,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Charm: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "charm_rank_2",
      "charm_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "charm"
  },
  "flowing_kick": {
    "id": "flowing_kick",
    "name": "Flowing Kick",
    "type": "active_ability",
    "classRequirements": [
      "monk"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "unarmed_mastery": 1
    },
    "levelRequirement": 1,
    "resourceType": "chi",
    "resourceCost": 15,
    "cooldownSeconds": 4,
    "castTimeSeconds": 0,
    "range": 2,
    "targetType": "enemy",
    "requiresLineOfSight": true,
    "requiresFacing": true,
    "requiredWeaponTypes": [
      "unarmed",
      "fist_weapon"
    ],
    "effects": [
      {
        "type": "damage",
        "damageType": "blunt",
        "base": 40,
        "scalingAttribute": "dexterity",
        "scalingRatio": 0.55
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Flowing Kick: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "flowing_kick_rank_2",
      "flowing_kick_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "martial"
  },
  "center_self": {
    "id": "center_self",
    "name": "Center Self",
    "type": "defensive_ability",
    "classRequirements": [
      "monk"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "willpower": 1
    },
    "levelRequirement": 3,
    "resourceType": "focus",
    "resourceCost": 20,
    "cooldownSeconds": 20,
    "castTimeSeconds": 0,
    "range": 0,
    "targetType": "self",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "cleanse_control"
      },
      {
        "type": "buff",
        "stat": "controlResistance",
        "value": 0.25,
        "durationSeconds": 6
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Center Self: server validated defensive_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "center_self_rank_2",
      "center_self_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "focus"
  },
  "deploy_turret": {
    "id": "deploy_turret",
    "name": "Deploy Turret",
    "type": "active_ability",
    "classRequirements": [
      "engineer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "engineering": 10
    },
    "levelRequirement": 8,
    "resourceType": "gadget_charge",
    "resourceCost": 1,
    "cooldownSeconds": 30,
    "castTimeSeconds": 2,
    "range": 5,
    "targetType": "ground",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "engineering_gadget"
    ],
    "effects": [
      {
        "type": "summon",
        "summonId": "field_turret",
        "durationSeconds": 45
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Deploy Turret: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "deploy_turret_rank_2",
      "deploy_turret_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "device"
  },
  "repair_kit": {
    "id": "repair_kit",
    "name": "Repair Kit",
    "type": "profession_ability",
    "classRequirements": [
      "engineer"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "engineering": 5
    },
    "levelRequirement": 4,
    "resourceType": "stamina",
    "resourceCost": 15,
    "cooldownSeconds": 12,
    "castTimeSeconds": 2,
    "range": 3,
    "targetType": "ally_or_object",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "tool"
    ],
    "effects": [
      {
        "type": "repair",
        "amount": 80
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Repair Kit: server validated profession_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "repair_kit_rank_2",
      "repair_kit_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "repair"
  },
  "trap_wire": {
    "id": "trap_wire",
    "name": "Trap Wire",
    "type": "active_ability",
    "classRequirements": [
      "engineer",
      "rogue"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "trap_disarming": 5
    },
    "levelRequirement": 6,
    "resourceType": "stamina",
    "resourceCost": 20,
    "cooldownSeconds": 18,
    "castTimeSeconds": 1,
    "range": 5,
    "targetType": "ground",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "slow",
        "durationSeconds": 5
      },
      {
        "type": "reveal"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 0,
      "healingMultiplier": 1,
      "durationMultiplier": 0.5,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "blocked_if_hostile_or_disruptive",
    "tooltip": "Trap Wire: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "trap_wire_rank_2",
      "trap_wire_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "trap"
  },
  "summon_wisp": {
    "id": "summon_wisp",
    "name": "Summon Wisp",
    "type": "active_spell",
    "classRequirements": [
      "summoner"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "summoning": 1
    },
    "levelRequirement": 1,
    "resourceType": "mana",
    "resourceCost": 25,
    "cooldownSeconds": 20,
    "castTimeSeconds": 1.5,
    "range": 5,
    "targetType": "ground",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [
      "summoning_focus",
      "staff",
      "orb"
    ],
    "effects": [
      {
        "type": "summon",
        "summonId": "wisp",
        "durationSeconds": 60
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Summon Wisp: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "summon_wisp_rank_2",
      "summon_wisp_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "summon"
  },
  "command_pet": {
    "id": "command_pet",
    "name": "Command Pet",
    "type": "active_ability",
    "classRequirements": [
      "summoner",
      "ranger"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "summoning": 3
    },
    "levelRequirement": 2,
    "resourceType": "bond",
    "resourceCost": 10,
    "cooldownSeconds": 3,
    "castTimeSeconds": 0,
    "range": 30,
    "targetType": "pet",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "pet_command"
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": false,
      "interruptLocksSchoolSeconds": 0,
      "movementCancels": false
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Command Pet: server validated active_ability ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "command_pet_rank_2",
      "command_pet_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "pet_command"
  },
  "bond_mend": {
    "id": "bond_mend",
    "name": "Bond Mend",
    "type": "active_spell",
    "classRequirements": [
      "summoner"
    ],
    "specializationRequirements": [],
    "skillRequirements": {
      "summoning": 8
    },
    "levelRequirement": 5,
    "resourceType": "mana",
    "resourceCost": 22,
    "cooldownSeconds": 8,
    "castTimeSeconds": 1,
    "range": 25,
    "targetType": "pet",
    "requiresLineOfSight": true,
    "requiresFacing": false,
    "requiredWeaponTypes": [],
    "effects": [
      {
        "type": "healing",
        "base": 70,
        "scalingAttribute": "charisma",
        "scalingRatio": 0.7
      }
    ],
    "pvpModifiers": {
      "damageMultiplier": 1,
      "healingMultiplier": 1,
      "durationMultiplier": 1,
      "cooldownMultiplier": 1
    },
    "interruptRules": {
      "canBeInterrupted": true,
      "interruptLocksSchoolSeconds": 4,
      "movementCancels": true
    },
    "safeZonePolicy": "allowed",
    "tooltip": "Bond Mend: server validated active_spell ability with requirements, costs, range, PvP modifiers, and upgrade hooks.",
    "upgradePath": [
      "bond_mend_rank_2",
      "bond_mend_rank_3"
    ],
    "serverValidation": [
      "known_ability",
      "requirements",
      "resource",
      "cooldown",
      "range",
      "line_of_sight",
      "target_legality",
      "not_duplicate_cast",
      "authoritative_timestamp"
    ],
    "animationFamily": "pet_heal"
  }
} as Record<string, HarthmereAbilityDefinitionV1>;

export const HARTHMERE_EQUIPMENT_CATALOG_V1 = {
  "training_dagger": {
    "id": "training_dagger",
    "name": "Training Dagger",
    "category": "weapon",
    "subtype": "dagger",
    "quality": "common",
    "baseValueCopper": 80,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 1,
    "classRequirements": [],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 30,
    "durability": {
      "current": 30,
      "max": 30
    },
    "stats": {
      "attackPoints": 8,
      "accuracy": 3,
      "criticalChance": 0.02
    },
    "useEffects": [],
    "equipEffects": [
      "dagger_animation_family"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "dagger_stab",
    "twoHanded": false
  },
  "harthmere_iron_longsword": {
    "id": "harthmere_iron_longsword",
    "name": "Harthmere Iron Longsword",
    "category": "weapon",
    "subtype": "sword",
    "quality": "uncommon",
    "baseValueCopper": 850,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 4,
    "classRequirements": [
      "warrior",
      "paladin"
    ],
    "factionRequirements": [],
    "bindingRule": "bind_on_equip",
    "tradeRule": "tradeable_until_bound",
    "sellValueCopper": 360,
    "durability": {
      "current": 70,
      "max": 70
    },
    "stats": {
      "attackPoints": 22,
      "accuracy": 5,
      "criticalChance": 0.03
    },
    "useEffects": [],
    "equipEffects": [
      "sword_animation_family"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "one_hand_slash",
    "twoHanded": false
  },
  "oaken_guard_shield": {
    "id": "oaken_guard_shield",
    "name": "Oaken Guard Shield",
    "category": "armor",
    "subtype": "shield",
    "quality": "common",
    "baseValueCopper": 500,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "off_hand",
    "levelRequirement": 3,
    "classRequirements": [
      "warrior",
      "paladin"
    ],
    "factionRequirements": [],
    "bindingRule": "bind_on_equip",
    "tradeRule": "tradeable_until_bound",
    "sellValueCopper": 200,
    "durability": {
      "current": 80,
      "max": 80
    },
    "stats": {
      "defense": 18,
      "blockChance": 0.12,
      "blockValue": 24
    },
    "useEffects": [],
    "equipEffects": [
      "shield_block_animation"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "shield_block",
    "twoHanded": false
  },
  "ashwood_hunting_bow": {
    "id": "ashwood_hunting_bow",
    "name": "Ashwood Hunting Bow",
    "category": "weapon",
    "subtype": "bow",
    "quality": "common",
    "baseValueCopper": 620,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 3,
    "classRequirements": [
      "ranger"
    ],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 250,
    "durability": {
      "current": 60,
      "max": 60
    },
    "stats": {
      "attackPoints": 18,
      "attackRange": 25,
      "accuracy": 7
    },
    "useEffects": [],
    "equipEffects": [
      "bow_animation_family"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "bow_shot",
    "twoHanded": true
  },
  "apprentices_wand": {
    "id": "apprentices_wand",
    "name": "Apprentice's Wand",
    "category": "weapon",
    "subtype": "wand",
    "quality": "common",
    "baseValueCopper": 550,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 1,
    "classRequirements": [
      "mage"
    ],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 220,
    "durability": {
      "current": 45,
      "max": 45
    },
    "stats": {
      "spellPower": 16,
      "mana": 20,
      "accuracy": 4
    },
    "useEffects": [],
    "equipEffects": [
      "wand_cast_animation"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "wand_cast",
    "twoHanded": false
  },
  "pilgrim_staff": {
    "id": "pilgrim_staff",
    "name": "Pilgrim Staff",
    "category": "weapon",
    "subtype": "staff",
    "quality": "common",
    "baseValueCopper": 480,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 1,
    "classRequirements": [
      "priest",
      "druid",
      "mage"
    ],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 190,
    "durability": {
      "current": 55,
      "max": 55
    },
    "stats": {
      "spellPower": 10,
      "healingPower": 12,
      "mana": 15
    },
    "useEffects": [],
    "equipEffects": [
      "staff_cast_animation"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "staff_cast",
    "twoHanded": true
  },
  "militia_chain_hauberk": {
    "id": "militia_chain_hauberk",
    "name": "Militia Chain Hauberk",
    "category": "armor",
    "subtype": "medium",
    "quality": "uncommon",
    "baseValueCopper": 1100,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "chest",
    "levelRequirement": 5,
    "classRequirements": [
      "warrior",
      "ranger",
      "paladin"
    ],
    "factionRequirements": [],
    "bindingRule": "bind_on_equip",
    "tradeRule": "tradeable_until_bound",
    "sellValueCopper": 450,
    "durability": {
      "current": 90,
      "max": 90
    },
    "stats": {
      "armor": 40,
      "defense": 12,
      "movementSpeed": -0.02
    },
    "useEffects": [],
    "equipEffects": [
      "medium_armor_profile"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "armor_medium",
    "twoHanded": false
  },
  "acolyte_robes": {
    "id": "acolyte_robes",
    "name": "Acolyte Robes",
    "category": "armor",
    "subtype": "cloth",
    "quality": "common",
    "baseValueCopper": 420,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "chest",
    "levelRequirement": 1,
    "classRequirements": [
      "mage",
      "priest",
      "necromancer",
      "summoner"
    ],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 160,
    "durability": {
      "current": 40,
      "max": 40
    },
    "stats": {
      "magicResistance": 8,
      "mana": 25
    },
    "useEffects": [],
    "equipEffects": [
      "cloth_robe_profile"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "robe",
    "twoHanded": false
  },
  "temple_mace": {
    "id": "temple_mace",
    "name": "Temple Mace",
    "category": "weapon",
    "subtype": "mace",
    "quality": "uncommon",
    "baseValueCopper": 760,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 5,
    "classRequirements": [
      "priest",
      "paladin"
    ],
    "factionRequirements": [],
    "bindingRule": "bind_on_equip",
    "tradeRule": "tradeable_until_bound",
    "sellValueCopper": 310,
    "durability": {
      "current": 70,
      "max": 70
    },
    "stats": {
      "attackPoints": 18,
      "healingPower": 8,
      "accuracy": 4
    },
    "useEffects": [],
    "equipEffects": [
      "mace_animation_family"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "mace_swing",
    "twoHanded": false
  },
  "engineers_spanner": {
    "id": "engineers_spanner",
    "name": "Engineer's Spanner",
    "category": "weapon",
    "subtype": "tool",
    "quality": "common",
    "baseValueCopper": 650,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "main_hand",
    "levelRequirement": 4,
    "classRequirements": [
      "engineer"
    ],
    "factionRequirements": [],
    "bindingRule": "none",
    "tradeRule": "tradeable",
    "sellValueCopper": 260,
    "durability": {
      "current": 55,
      "max": 55
    },
    "stats": {
      "attackPoints": 10,
      "engineering": 10,
      "repairPower": 20
    },
    "useEffects": [
      "field_repair"
    ],
    "equipEffects": [
      "tool_animation_family"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "tool_swing",
    "twoHanded": false
  },
  "soulbinder_orb": {
    "id": "soulbinder_orb",
    "name": "Soulbinder Orb",
    "category": "weapon",
    "subtype": "orb",
    "quality": "rare",
    "baseValueCopper": 1700,
    "stackable": false,
    "maxStack": 1,
    "equipSlot": "off_hand",
    "levelRequirement": 12,
    "classRequirements": [
      "necromancer",
      "summoner",
      "mage"
    ],
    "factionRequirements": [],
    "bindingRule": "bind_on_equip",
    "tradeRule": "tradeable_until_bound",
    "sellValueCopper": 700,
    "durability": {
      "current": 50,
      "max": 50
    },
    "stats": {
      "spellPower": 24,
      "mana": 35,
      "summonPower": 12
    },
    "useEffects": [],
    "equipEffects": [
      "orb_cast_animation"
    ],
    "questUsage": [],
    "stolenStateSupported": true,
    "animationFamily": "orb_cast",
    "twoHanded": false
  }
} as Record<string, {
  id: string;
  name: string;
  category: string;
  subtype: string;
  quality: string;
  baseValueCopper: number;
  stackable: boolean;
  maxStack: number;
  equipSlot: string;
  levelRequirement: number;
  classRequirements: string[];
  factionRequirements: string[];
  bindingRule: string;
  tradeRule: string;
  sellValueCopper: number;
  durability: { current: number; max: number };
  stats: Record<string, number>;
  useEffects: string[];
  equipEffects: string[];
  questUsage: string[];
  stolenStateSupported: boolean;
  animationFamily: string;
  twoHanded: boolean;
}>;

export const HARTHMERE_LOOT_TABLES_V1 = {
  "training_dummy": {
    "id": "training_dummy",
    "levelRange": [
      1,
      50
    ],
    "personalLoot": true,
    "uniquePerKill": false,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "none",
        "chance": 1,
        "minLevel": 1,
        "maxLevel": 50
      }
    ],
    "antiFarmRules": [
      "training_dummy_after_daily_cap",
      "no_currency",
      "no_power_loot"
    ]
  },
  "wolf_common": {
    "id": "wolf_common",
    "levelRange": [
      1,
      12
    ],
    "personalLoot": true,
    "uniquePerKill": false,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "wolf_pelt",
        "chance": 0.55
      },
      {
        "itemId": "small_meat",
        "chance": 0.45
      },
      {
        "itemId": "training_dagger",
        "chance": 0.02,
        "maxLevel": 8
      }
    ],
    "antiFarmRules": [
      "enemy_10_plus_levels_lower_no_xp",
      "low_level_enemy_no_currency_or_power_loot"
    ]
  },
  "bandit_common": {
    "id": "bandit_common",
    "levelRange": [
      4,
      20
    ],
    "personalLoot": true,
    "uniquePerKill": false,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "copper_coin_pouch",
        "chance": 0.6
      },
      {
        "itemId": "harthmere_iron_longsword",
        "chance": 0.08
      },
      {
        "itemId": "stolen_trinket",
        "chance": 0.12
      }
    ],
    "antiFarmRules": [
      "repeated_farming_no_xp",
      "legal_state_updates"
    ]
  },
  "undead_common": {
    "id": "undead_common",
    "levelRange": [
      6,
      25
    ],
    "personalLoot": true,
    "uniquePerKill": false,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "bone_fragment",
        "chance": 0.5
      },
      {
        "itemId": "soulbinder_orb",
        "chance": 0.03
      },
      {
        "itemId": "grave_dust",
        "chance": 0.2
      }
    ],
    "antiFarmRules": [
      "no_civilian_rewards",
      "quest_credit_requires_contribution"
    ]
  },
  "dungeon_boss": {
    "id": "dungeon_boss",
    "levelRange": [
      12,
      60
    ],
    "personalLoot": true,
    "uniquePerKill": true,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "boss_cache",
        "chance": 1
      },
      {
        "itemId": "rare_weapon_token",
        "chance": 0.25
      },
      {
        "itemId": "soulbinder_orb",
        "chance": 0.09
      }
    ],
    "antiFarmRules": [
      "weekly_or_daily_lockout",
      "boss_loot_not_awarded_on_wipe",
      "raid_kick_after_contribution_keeps_eligibility"
    ]
  },
  "hardcore_pvp_resources": {
    "id": "hardcore_pvp_resources",
    "levelRange": [
      1,
      60
    ],
    "personalLoot": false,
    "uniquePerKill": false,
    "overflowPolicy": "corpse_or_overflow_recovery",
    "entries": [
      {
        "itemId": "unbound_trade_goods",
        "chance": 0.35
      },
      {
        "itemId": "gathered_resources_bundle",
        "chance": 0.3
      }
    ],
    "antiFarmRules": [
      "bound_quest_spellbook_mount_pet_cosmetic_keyring_protected",
      "drop_only_unbound_trade_goods_and_gathered_resources",
      "repeated_kill_farming_suppressed"
    ]
  },
  "public_world_event": {
    "id": "public_world_event",
    "levelRange": [
      5,
      60
    ],
    "personalLoot": true,
    "uniquePerKill": true,
    "overflowPolicy": "overflow_recovery_mail",
    "entries": [
      {
        "itemId": "harthmere_favor_token",
        "chance": 1
      },
      {
        "itemId": "event_cache",
        "chance": 0.4
      }
    ],
    "antiFarmRules": [
      "afk_public_event_leeching",
      "no_nearby_spectator_scaling",
      "contribution_threshold_required"
    ]
  }
} as Record<string, {
  id: string;
  levelRange: number[];
  personalLoot: boolean;
  uniquePerKill: boolean;
  overflowPolicy: string;
  entries: Array<Record<string, unknown>>;
  antiFarmRules: string[];
}>;

export const HARTHMERE_NPC_COMBAT_PROFILES_V1 = {
  "wolf": {
    "id": "wolf",
    "name": "Wolf",
    "classId": "ranger",
    "level": 4,
    "rank": "normal",
    "roles": [
      "damage_dealer"
    ],
    "abilities": [
      "basic_strike"
    ],
    "lootTableId": "wolf_common",
    "deathBehavior": "respawn_timer",
    "aiRules": [
      "leash_to_spawn",
      "flee_at_low_hp_if_outnumbered"
    ],
    "serverRules": [
      "cannot_attack_while_dead",
      "evade_if_unreachable"
    ]
  },
  "bandit_skirmisher": {
    "id": "bandit_skirmisher",
    "name": "Bandit Skirmisher",
    "classId": "rogue",
    "level": 8,
    "rank": "normal",
    "roles": [
      "damage_dealer",
      "controller"
    ],
    "abilities": [
      "backstab",
      "poison_blade"
    ],
    "lootTableId": "bandit_common",
    "deathBehavior": "respawn_timer_and_reputation_update",
    "aiRules": [
      "ambush",
      "avoid_guards",
      "retreat_to_camp"
    ],
    "serverRules": [
      "legal_penalty_if_player_unlawfully_attacks_protected_bandit_false"
    ]
  },
  "town_guard": {
    "id": "town_guard",
    "name": "Town Guard",
    "classId": "warrior",
    "level": 18,
    "rank": "elite",
    "roles": [
      "tank",
      "controller"
    ],
    "abilities": [
      "taunt",
      "shield_bash",
      "guard_ally"
    ],
    "lootTableId": "none",
    "deathBehavior": "legal_event_reinforcements",
    "aiRules": [
      "protect_market",
      "inspect_criminals",
      "escalate_against_outlaws"
    ],
    "serverRules": [
      "lawful_attack_validation",
      "guard_reinforcement_log"
    ]
  },
  "necromancer_caster": {
    "id": "necromancer_caster",
    "name": "Necromancer Caster",
    "classId": "necromancer",
    "level": 15,
    "rank": "elite",
    "roles": [
      "summoner",
      "controller"
    ],
    "abilities": [
      "raise_skeleton",
      "life_drain",
      "fear"
    ],
    "lootTableId": "undead_common",
    "deathBehavior": "quest_credit_and_loot",
    "aiRules": [
      "keep_distance",
      "summon_if_alone",
      "fear_melee"
    ],
    "serverRules": [
      "summon_cap",
      "line_of_sight_required"
    ]
  },
  "dungeon_boss_warlord": {
    "id": "dungeon_boss_warlord",
    "name": "Dungeon Boss Warlord",
    "classId": "warrior",
    "level": 25,
    "rank": "boss",
    "roles": [
      "tank",
      "damage_dealer"
    ],
    "abilities": [
      "cleave",
      "charge",
      "last_stand"
    ],
    "lootTableId": "dungeon_boss",
    "deathBehavior": "personal_loot_if_not_wipe",
    "aiRules": [
      "arena_leash",
      "telegraph_cleave",
      "reset_on_wipe"
    ],
    "serverRules": [
      "boss_dragged_out_of_arena_evades",
      "boss_wipe_loot_not_awarded"
    ]
  },
  "civilian": {
    "id": "civilian",
    "name": "Civilian",
    "classId": "bard",
    "level": 1,
    "rank": "civilian",
    "roles": [
      "support"
    ],
    "abilities": [],
    "lootTableId": "none",
    "deathBehavior": "legal_reputation_penalty",
    "aiRules": [
      "flee_from_combat",
      "call_guards"
    ],
    "serverRules": [
      "harmless_target_no_xp_or_gold",
      "criminal_attack_updates_legal_state"
    ]
  }
} as Record<string, {
  id: string;
  name: string;
  classId: string;
  level: number;
  rank: "civilian" | "normal" | "elite" | "boss";
  roles: string[];
  abilities: string[];
  lootTableId: string;
  deathBehavior: string;
  aiRules: string[];
  serverRules: string[];
}>;

export const HARTHMERE_COMPLETE_EDGE_CASE_REGISTRY_V1 = [
  "player_uses_ability_without_required_weapon",
  "player_changes_gear_mid_cast",
  "player_learns_same_ability_twice",
  "player_respecs_while_ability_on_cooldown",
  "player_switches_loadout_in_combat",
  "player_uses_illegal_ability_in_town",
  "pet_blocks_door",
  "ability_hits_through_wall",
  "ability_double_casts_from_lag",
  "player_disconnects_during_cast",
  "ability_kills_target_after_player_dies",
  "skill_xp_exploit_through_trivial_actions",
  "training_dummy_abuse",
  "pvp_crowd_control_chains",
  "summon_pet_ai_griefing",
  "class_change_abuse",
  "low_level_grief_kill",
  "repeated_pvp_kill_farming",
  "win_trading",
  "afk_public_event_leeching",
  "raid_leader_kicks_before_loot",
  "boss_dragged_out_of_arena",
  "boss_wipe_loot_not_awarded",
  "safe_zone_abuse_after_attack",
  "spawn_camping",
  "full_inventory_after_boss_reward",
  "hardcore_pvp_bound_item_drop_attempt",
  "quest_item_drop_attempt",
  "spellbook_mount_pet_cosmetic_keyring_drop_attempt",
  "server_issue_death_no_harsh_penalty",
  "npc_dead_but_attacking",
  "stunned_but_casting",
  "evading_but_taking_damage",
  "respawning_but_targetable",
  "teleporting_takes_pvp_damage",
  "enemy_10_plus_levels_lower_no_xp",
  "repeated_farming_no_xp",
  "high_level_carry_reduced_xp",
  "training_dummy_after_daily_cap",
  "afk_loop",
  "client_only_action_without_server_validation",
  "trivial_action_zero_progress",
  "inventory_full_reward_routed_to_overflow_recovery",
  "low_level_enemy_no_currency_or_power_loot",
  "weekly_or_daily_lockout",
  "low_level_grief_reward_suppressed",
  "repeated_kill_farming_suppressed",
  "no_meaningful_pvp_contribution",
  "bound_quest_spellbook_mount_pet_cosmetic_keyring_protected",
  "drop_only_unbound_trade_goods_and_gathered_resources",
  "unfair_death_no_harsh_penalty",
  "client_authoritative_claim_rejected",
  "stale_entity_version_rejected"
] as const;

export const HARTHMERE_COMPLETE_TDD_TESTS_V1 = [
  "test-harthmere-complete-progression-catalogs-v1.cjs",
  "test-harthmere-complete-abilities-equipment-v1.cjs",
  "test-harthmere-complete-level-skill-loot-v1.cjs",
  "test-harthmere-complete-server-pvp-death-v1.cjs",
  "test-harthmere-complete-runtime-integration-v1.cjs",
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function xpRequiredForHarthmereLevelV1(level: number): number {
  if (level >= 50) return Number.POSITIVE_INFINITY;
  return Math.round(100 * Math.pow(Math.max(1, level), 1.6) / 100) * 100;
}

export function levelDifferenceXpModifierV1(playerLevel: number, enemyLevel: number): number {
  const diff = enemyLevel - playerLevel;
  if (diff <= -10) return 0;
  if (diff <= -6) return 0.1;
  if (diff <= -3) return 0.4;
  if (diff <= -1) return 0.75;
  if (diff === 0) return 1;
  if (diff <= 2) return 1.15;
  if (diff <= 5) return 1.4;
  return 1.75;
}

export function questXpRewardV1(questLevel: number, difficulty: "trivial" | "easy" | "normal" | "hard" | "elite" | "group" | "dungeon" | "raid"): number {
  const difficultyModifier: Record<string, number> = {
    trivial: 0.25,
    easy: 0.75,
    normal: 1,
    hard: 1.25,
    elite: 1.75,
    group: 2,
    dungeon: 2.5,
    raid: 5,
  };
  return Math.round(100 * Math.pow(Math.max(1, questLevel), 1.25) * difficultyModifier[difficulty]);
}

export function enemyKillXpRewardV1(context: HarthmereRewardContextV1): { xp: number; reasons: string[] } {
  const reasons: string[] = [];
  if (context.targetRank === "civilian" || context.targetRank === "training_dummy") {
    return { xp: 0, reasons: ["harmless_or_training_target_no_xp", "training_dummy_after_daily_cap"] };
  }
  if (context.isAfk) return { xp: 0, reasons: ["afk_loop", "afk_public_event_leeching"] };
  if ((context.repeatedFarmCount ?? 0) >= 4) return { xp: 0, reasons: ["repeated_farming_no_xp"] };

  const rankModifiers: Record<string, number> = {
    critter: 0.05,
    normal: 1,
    strong: 1.3,
    elite: 2.5,
    mini_boss: 8,
    dungeon_boss: 25,
    world_boss: 100,
    civilian: 0,
    training_dummy: 0,
  };

  let xp = Math.round(35 * Math.max(1, context.targetLevel) * levelDifferenceXpModifierV1(context.playerLevel, context.targetLevel) * rankModifiers[context.targetRank]);
  if (context.playerLevel - context.targetLevel >= 10) {
    xp = 0;
    reasons.push("enemy_10_plus_levels_lower_no_xp");
  }
  if ((context.repeatedFarmCount ?? 0) > 0) {
    xp = Math.round(xp * Math.max(0, 1 - context.repeatedFarmCount! * 0.25));
    reasons.push("repeated_farming_diminishing_returns");
  }
  return { xp, reasons };
}

export function resolveHarthmereLevelGainV1(state: HarthmerePlayerProgressionStateV1, xpDelta: number): {
  level: number;
  xp: number;
  attributePointsGained: number;
  talentPointsGained: number;
  unlockedAbilities: string[];
  levelUpMessages: string[];
} {
  let level = state.level;
  let xp = state.xp + Math.max(0, xpDelta);
  let attributePointsGained = 0;
  let talentPointsGained = 0;
  const unlockedAbilities: string[] = [];
  const levelUpMessages: string[] = [];

  while (level < 50 && xp >= xpRequiredForHarthmereLevelV1(level)) {
    xp -= xpRequiredForHarthmereLevelV1(level);
    level += 1;
    attributePointsGained += 2;
    talentPointsGained += level >= 10 ? 1 : 0;
    levelUpMessages.push(`Level Up! You are now Level ${level}.`);
    for (const ability of Object.values(HARTHMERE_ABILITY_CATALOG_V1)) {
      if (ability.levelRequirement === level && (ability.classRequirements.length === 0 || ability.classRequirements.includes(state.classId))) {
        unlockedAbilities.push(ability.id);
      }
    }
  }

  return { level, xp, attributePointsGained, talentPointsGained, unlockedAbilities, levelUpMessages };
}

export function validateHarthmereSkillProgressActionV1(args: {
  skillId: string;
  actionType: string;
  targetLevel?: number;
  playerLevel?: number;
  targetId?: string;
  isAfk?: boolean;
  isServerValidated?: boolean;
  dailyProgressCount?: number;
}): { ok: boolean; reason?: string; multiplier: number } {
  const skill = HARTHMERE_SKILL_CATALOG_V1[args.skillId];
  if (!skill) return { ok: false, reason: "unknown_skill", multiplier: 0 };
  if (!args.isServerValidated) return { ok: false, reason: "client_only_action_without_server_validation", multiplier: 0 };
  if (args.isAfk) return { ok: false, reason: "afk_loop", multiplier: 0 };
  if (skill.doesNotImproveFrom.includes(args.actionType)) return { ok: false, reason: "trivial_action_zero_progress", multiplier: 0 };
  if ((args.dailyProgressCount ?? 0) > 100) return { ok: false, reason: "training_dummy_after_daily_cap", multiplier: 0 };
  if (args.playerLevel !== undefined && args.targetLevel !== undefined && args.playerLevel - args.targetLevel >= 10) {
    return { ok: false, reason: "grey_content_no_skill_progress", multiplier: 0 };
  }
  const multiplier = (args.playerLevel ?? 1) - (args.targetLevel ?? args.playerLevel ?? 1) >= 5 ? 0.25 : 1;
  return { ok: true, multiplier };
}

export function applyHarthmereSkillProgressV1(state: HarthmerePlayerProgressionStateV1, skillId: string, xpDelta: number): {
  nextState: HarthmerePlayerProgressionStateV1;
  leveledUp: boolean;
  unlocks: string[];
} {
  const skill = HARTHMERE_SKILL_CATALOG_V1[skillId];
  if (!skill) return { nextState: state, leveledUp: false, unlocks: [] };
  const current = state.skills[skillId] ?? { level: 1, xpCurrent: 0, xpRequiredNext: 100 };
  let xpCurrent = current.xpCurrent + Math.max(0, xpDelta);
  let level = current.level;
  let leveledUp = false;
  const unlocks: string[] = [];
  while (level < skill.maxLevel && xpCurrent >= current.xpRequiredNext) {
    xpCurrent -= current.xpRequiredNext;
    level += 1;
    leveledUp = true;
    if (skill.unlockMilestones.includes(level)) unlocks.push(`${skillId}:${level}`);
  }
  return {
    nextState: {
      ...state,
      skills: {
        ...state.skills,
        [skillId]: {
          ...current,
          level,
          xpCurrent,
          xpRequiredNext: Math.round(100 + level * 12),
        },
      },
    },
    leveledUp,
    unlocks,
  };
}

export function validateHarthmereEquipmentChangeV1(args: {
  state: HarthmerePlayerProgressionStateV1;
  itemId: string;
  slot: string;
  inCombat?: boolean;
  isCasting?: boolean;
  itemBoundToAnotherPlayer?: boolean;
}): { ok: boolean; reason?: string; warnings: string[] } {
  const warnings: string[] = [];
  const item = HARTHMERE_EQUIPMENT_CATALOG_V1[args.itemId];
  if (!item) return { ok: false, reason: "unknown_item", warnings };
  if (args.inCombat || args.isCasting) return { ok: false, reason: args.isCasting ? "player_changes_gear_mid_cast" : "equipment_changes_blocked_in_combat", warnings };
  if (args.itemBoundToAnotherPlayer) return { ok: false, reason: "item_bound_to_another_player", warnings };
  if (args.state.level < item.levelRequirement) return { ok: false, reason: "level_requirement_not_met", warnings };
  if (item.classRequirements.length > 0 && !item.classRequirements.includes(args.state.classId)) return { ok: false, reason: "class_requirement_not_met", warnings };
  if (item.durability.current <= 0) return { ok: false, reason: "broken_weapon_cannot_attack_normally", warnings };
  if (item.twoHanded && args.slot === "main_hand" && args.state.equipment.off_hand) warnings.push("two_handed_weapon_disables_offhand");
  return { ok: true, warnings };
}

export function applyHarthmereDurabilityLossV1(item: { durability: { current: number; max: number } }, percent: number): { current: number; max: number; broken: boolean } {
  const loss = Math.ceil(item.durability.max * clamp(percent, 0, 1));
  const current = Math.max(0, item.durability.current - loss);
  return { current, max: item.durability.max, broken: current <= 0 };
}

export function repairCostCopperV1(item: { baseValueCopper: number; durability: { current: number; max: number } }, reputationModifier = 1): number {
  const missingRatio = clamp((item.durability.max - item.durability.current) / Math.max(1, item.durability.max), 0, 1);
  return Math.ceil(item.baseValueCopper * 0.18 * missingRatio * reputationModifier);
}

export function validateHarthmereAbilityUseV1(args: {
  state: HarthmerePlayerProgressionStateV1;
  abilityId: string;
  targetType: HarthmereTargetTypeV1;
  distance: number;
  hasLineOfSight: boolean;
  hasFacing?: boolean;
  equippedWeaponTypes?: string[];
  isSafeZone?: boolean;
  isHostile?: boolean;
  isDuplicateCast?: boolean;
  nowMs: number;
  serverEntityVersion?: number;
  clientClaims?: string[];
}): { ok: boolean; reason?: string; serverChecks: string[] } {
  const serverChecks = ["known_ability","requirements","resource","cooldown","range","line_of_sight","target_legality","server_authoritative_validation"];
  const ability = HARTHMERE_ABILITY_CATALOG_V1[args.abilityId];
  if (!ability) return { ok: false, reason: "unknown_ability", serverChecks };
  if (args.clientClaims?.some((claim) => ["hit","damage","kill","loot","xp"].includes(claim))) return { ok: false, reason: "client_authoritative_claim_rejected", serverChecks };
  if (args.serverEntityVersion !== undefined && args.state.serverEntityVersion !== undefined && args.serverEntityVersion !== args.state.serverEntityVersion) return { ok: false, reason: "stale_entity_version_rejected", serverChecks };
  if (args.isDuplicateCast) return { ok: false, reason: "ability_double_casts_from_lag", serverChecks };
  if (!args.state.knownAbilities.includes(args.abilityId) && !ability.classRequirements.includes(args.state.classId) && ability.classRequirements.length > 0) return { ok: false, reason: "ability_not_known", serverChecks };
  if (ability.classRequirements.length > 0 && !ability.classRequirements.includes(args.state.classId)) return { ok: false, reason: "class_requirement_not_met", serverChecks };
  for (const [skillId, required] of Object.entries(ability.skillRequirements)) {
    if ((args.state.skills[skillId]?.level ?? 0) < required) return { ok: false, reason: "skill_requirement_not_met", serverChecks };
  }
  if (args.state.level < ability.levelRequirement) return { ok: false, reason: "level_requirement_not_met", serverChecks };
  if ((args.state.resources[ability.resourceType] ?? 0) < ability.resourceCost) return { ok: false, reason: "insufficient_resource", serverChecks };
  if ((args.state.cooldowns[args.abilityId] ?? 0) > args.nowMs) return { ok: false, reason: "ability_on_cooldown", serverChecks };
  if (ability.requiredWeaponTypes.length > 0 && !ability.requiredWeaponTypes.some((weapon) => (args.equippedWeaponTypes ?? []).includes(weapon))) return { ok: false, reason: "player_uses_ability_without_required_weapon", serverChecks };
  if (args.distance > ability.range + 0.3) return { ok: false, reason: "target_out_of_range", serverChecks };
  if (ability.requiresLineOfSight && !args.hasLineOfSight) return { ok: false, reason: "ability_hits_through_wall", serverChecks };
  if (ability.requiresFacing && !args.hasFacing) return { ok: false, reason: "target_not_faced", serverChecks };
  if (args.isSafeZone && args.isHostile && ability.safeZonePolicy !== "allowed") return { ok: false, reason: "player_uses_illegal_ability_in_town", serverChecks };
  return { ok: true, serverChecks };
}

export function resolveHarthmereAbilityCastV1(args: {
  state: HarthmerePlayerProgressionStateV1;
  abilityId: string;
  nowMs: number;
  isPvp?: boolean;
}): { resourceRemaining: number; cooldownUntilMs: number; effectPreview: Array<Record<string, unknown>>; auditLogType: string } {
  const ability = HARTHMERE_ABILITY_CATALOG_V1[args.abilityId];
  const current = args.state.resources[ability.resourceType] ?? 0;
  const cooldownMs = ability.cooldownSeconds * ability.pvpModifiers.cooldownMultiplier * 1000;
  return {
    resourceRemaining: Math.max(0, current - ability.resourceCost),
    cooldownUntilMs: args.nowMs + cooldownMs,
    effectPreview: ability.effects,
    auditLogType: "combat_audit_logs",
  };
}

export function validateHarthmereLoadoutChangeV1(args: {
  state: HarthmerePlayerProgressionStateV1;
  newLoadoutAbilityIds: string[];
  isInCombat?: boolean;
  isSafeArea?: boolean;
}): { ok: boolean; reason?: string } {
  if (args.isInCombat && !args.isSafeArea) return { ok: false, reason: "player_switches_loadout_in_combat" };
  if (args.newLoadoutAbilityIds.length > 8) return { ok: false, reason: "loadout_slot_limit_exceeded" };
  const duplicates = new Set<string>();
  for (const id of args.newLoadoutAbilityIds) {
    if (duplicates.has(id)) return { ok: false, reason: "duplicate_ability_in_loadout" };
    duplicates.add(id);
    if (!args.state.knownAbilities.includes(id)) return { ok: false, reason: "unknown_ability_in_loadout" };
  }
  return { ok: true };
}

export function validateHarthmereRespecV1(args: {
  state: HarthmerePlayerProgressionStateV1;
  inCombat?: boolean;
  activeCooldownAbilityIds?: string[];
  isAtTrainer?: boolean;
  paidCost?: boolean;
}): { ok: boolean; reason?: string } {
  if (args.inCombat) return { ok: false, reason: "respec_blocked_in_combat" };
  if ((args.activeCooldownAbilityIds ?? []).length > 0) return { ok: false, reason: "player_respecs_while_ability_on_cooldown" };
  if (!args.isAtTrainer) return { ok: false, reason: "respec_requires_trainer_or_shrine" };
  if (!args.paidCost) return { ok: false, reason: "respec_cost_unpaid" };
  return { ok: true };
}

export function buildHarthmereCombatStatsFromProgressionV1(state: HarthmerePlayerProgressionStateV1): Record<string, number> {
  const stats: Record<string, number> = {
    maxHp: 100 + state.level * 20 + (state.attributes.constitution ?? 0) * 10,
    attackPoints: 10 + state.level * 3 + (state.attributes.strength ?? 0) * 2,
    spellPower: 5 + state.level * 2 + (state.attributes.intelligence ?? 0) * 2,
    healingPower: 5 + state.level * 2 + (state.attributes.wisdom ?? 0) * 1.5,
    defense: 5 + state.level * 2,
    armor: 0,
    magicResistance: (state.attributes.wisdom ?? 0) * 0.2,
    accuracy: 75 + (state.attributes.perception ?? 0) * 0.3,
    evasion: 5 + (state.attributes.dexterity ?? 0) * 0.2,
    criticalChance: 0.05 + (state.attributes.luck ?? 0) * 0.001,
    criticalDamage: 1.5,
    attackSpeed: 1,
    attackRange: 2.2,
    blockChance: 0,
    blockValue: 0,
  };
  for (const itemId of Object.values(state.equipment)) {
    const item = itemId ? HARTHMERE_EQUIPMENT_CATALOG_V1[itemId] : undefined;
    if (!item) continue;
    for (const [key, value] of Object.entries(item.stats)) {
      stats[key] = (stats[key] ?? 0) + value;
    }
  }
  return stats;
}

export function resolveHarthmereContributionScoreV1(input: {
  damage?: number;
  healing?: number;
  shielding?: number;
  threat?: number;
  objectives?: number;
  crowdControlSeconds?: number;
  interrupts?: number;
  revives?: number;
  scouting?: number;
  overheal?: number;
  fullHealthHealing?: number;
  afkSeconds?: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score =
    (input.damage ?? 0) +
    (input.healing ?? 0) * 0.75 +
    (input.shielding ?? 0) * 0.8 +
    (input.threat ?? 0) * 0.35 +
    (input.objectives ?? 0) * 250 +
    (input.crowdControlSeconds ?? 0) * 15 +
    (input.interrupts ?? 0) * 120 +
    (input.revives ?? 0) * 300 +
    (input.scouting ?? 0) * 40;
  score -= (input.overheal ?? 0) * 0.8;
  score -= (input.fullHealthHealing ?? 0) * 1.0;
  if ((input.afkSeconds ?? 0) > 60) {
    score = 0;
    reasons.push("afk_public_event_leeching");
  }
  if (score <= 0) reasons.push("no_meaningful_pvp_contribution");
  return { score: Math.max(0, Math.round(score)), reasons };
}

export function resolveHarthmereGroupRewardEligibilityV1(args: {
  contributionScore: number;
  totalContribution: number;
  wasKickedAfterContribution?: boolean;
  isNearby?: boolean;
  deadTooLong?: boolean;
  isAfk?: boolean;
}): { eligible: boolean; share: number; reasons: string[] } {
  const reasons: string[] = [];
  if (args.wasKickedAfterContribution && args.contributionScore > 0) reasons.push("raid_kick_after_contribution_keeps_eligibility");
  if (args.isAfk) return { eligible: false, share: 0, reasons: ["afk_public_event_leeching"] };
  if (!args.isNearby) return { eligible: false, share: 0, reasons: ["not_nearby_for_credit"] };
  const share = args.totalContribution > 0 ? args.contributionScore / args.totalContribution : 0;
  if (share < 0.03 && !args.wasKickedAfterContribution) return { eligible: false, share, reasons: ["below_meaningful_contribution_threshold"] };
  if (args.deadTooLong) reasons.push("dead_too_long_reduced_credit");
  return { eligible: true, share, reasons };
}

export function resolveHarthmerePvpRewardEligibilityV1(args: {
  attackerLevel: number;
  victimLevel: number;
  contributionScore: number;
  sameVictimKillsWithin15m: number;
  victimFlag: string;
  attackerFlag: string;
  isSafeZone?: boolean;
  isSpawnCamping?: boolean;
  suspectedWinTrading?: boolean;
}): { eligible: boolean; rewardMultiplier: number; legalConsequences: string[]; reasons: string[] } {
  const reasons: string[] = [];
  const legalConsequences: string[] = [];
  let rewardMultiplier = 1;
  if (args.isSafeZone) return { eligible: false, rewardMultiplier: 0, legalConsequences: ["criminal_attack_updates_legal_state"], reasons: ["safe_zone_attack_illegal"] };
  if (args.attackerLevel - args.victimLevel >= 10) {
    reasons.push("low_level_grief_reward_suppressed");
    legalConsequences.push("possible_bounty_or_criminal_penalty");
    rewardMultiplier = 0;
  }
  if (args.sameVictimKillsWithin15m >= 3) {
    reasons.push("repeated_kill_farming_suppressed");
    rewardMultiplier = 0;
  } else if (args.sameVictimKillsWithin15m === 2) {
    rewardMultiplier *= 0.1;
  } else if (args.sameVictimKillsWithin15m === 1) {
    rewardMultiplier *= 0.5;
  }
  if (args.contributionScore <= 0) {
    reasons.push("no_meaningful_pvp_contribution");
    rewardMultiplier = 0;
  }
  if (args.isSpawnCamping) {
    reasons.push("spawn_camping");
    rewardMultiplier = 0;
  }
  if (args.suspectedWinTrading) {
    reasons.push("win_trading_suspected");
    rewardMultiplier = 0;
  }
  return { eligible: rewardMultiplier > 0, rewardMultiplier, legalConsequences, reasons };
}

export function selectHarthmereLootDropsV1(args: {
  lootTableId: string;
  playerLevel: number;
  targetLevel: number;
  contributionEligible: boolean;
  isBossWipe?: boolean;
  isHardcorePvpZone?: boolean;
  inventoryHasSpace?: boolean;
  seed?: number;
}): { itemIds: string[]; overflowPolicy: string; reasons: string[] } {
  const table = HARTHMERE_LOOT_TABLES_V1[args.lootTableId];
  if (!table) return { itemIds: [], overflowPolicy: "none", reasons: ["unknown_loot_table"] };
  if (!args.contributionEligible) return { itemIds: [], overflowPolicy: table.overflowPolicy, reasons: ["no_meaningful_contribution"] };
  if (args.isBossWipe) return { itemIds: [], overflowPolicy: table.overflowPolicy, reasons: ["boss_loot_not_awarded_on_wipe"] };
  if (args.playerLevel - args.targetLevel >= 10 && !args.isHardcorePvpZone) return { itemIds: [], overflowPolicy: table.overflowPolicy, reasons: ["low_level_enemy_no_currency_or_power_loot"] };
  const reasons = [...table.antiFarmRules.filter((rule) => rule.includes("protected") || rule.includes("overflow"))];
  const seed = args.seed ?? 0.42;
  const itemIds = table.entries
    .filter((entry) => (entry.chance as number) >= seed)
    .map((entry) => entry.itemId as string)
    .filter((id) => id !== "none");
  if (!args.inventoryHasSpace) reasons.push("inventory_full_reward_routed_to_overflow_recovery");
  return { itemIds, overflowPolicy: args.inventoryHasSpace ? table.overflowPolicy : "overflow_recovery_mail", reasons };
}

export function resolveHarthmereKillRewardsV1(args: HarthmereRewardContextV1 & {
  lootTableId: string;
  contributionEligible: boolean;
}): { xp: number; loot: ReturnType<typeof selectHarthmereLootDropsV1>; reasons: string[] } {
  const xp = enemyKillXpRewardV1(args);
  const loot = selectHarthmereLootDropsV1({
    lootTableId: args.lootTableId,
    playerLevel: args.playerLevel,
    targetLevel: args.targetLevel,
    contributionEligible: args.contributionEligible,
    isBossWipe: args.isBossWipe,
    isHardcorePvpZone: args.isHardcorePvpZone,
    inventoryHasSpace: args.inventoryHasSpace,
  });
  return { xp: xp.xp, loot, reasons: [...xp.reasons, ...loot.reasons] };
}

export function normalizeHarthmerePvpStatsV1(stats: Record<string, number>, mode: "open_world" | "arena" | "battleground", playerLevel: number): Record<string, number> {
  if (mode === "open_world") return { ...stats, normalizedMode: 0 };
  const bracketFloor = Math.floor((playerLevel - 1) / 10) * 10 + 1;
  const bracketCeiling = Math.min(50, bracketFloor + 9);
  const targetLevel = mode === "arena" ? bracketCeiling : Math.round((bracketFloor + bracketCeiling) / 2);
  const factor = targetLevel / Math.max(1, playerLevel);
  return {
    ...stats,
    maxHp: Math.round((stats.maxHp ?? 100) * factor),
    attackPoints: Math.round((stats.attackPoints ?? 10) * factor),
    spellPower: Math.round((stats.spellPower ?? 10) * factor),
    defense: Math.round((stats.defense ?? 10) * factor),
    normalizedMode: mode === "arena" ? 2 : 1,
  };
}

export function resolveHarthmereNpcCombatProfileV1(npcId: string, playerCount = 1): Record<string, unknown> {
  const npc = HARTHMERE_NPC_COMBAT_PROFILES_V1[npcId];
  if (!npc) return { ok: false, reason: "unknown_npc_profile" };
  const rankMultiplier = npc.rank === "boss" ? 12 : npc.rank === "elite" ? 3 : npc.rank === "civilian" ? 0.25 : 1;
  const groupMultiplier = npc.rank === "boss" ? clamp(playerCount / 5, 1, 6) : 1;
  return {
    ok: true,
    id: npc.id,
    classId: npc.classId,
    level: npc.level,
    maxHp: Math.round((100 + npc.level * 22) * rankMultiplier * groupMultiplier),
    attackPoints: Math.round((10 + npc.level * 4) * rankMultiplier),
    defense: Math.round((8 + npc.level * 3) * rankMultiplier),
    abilities: npc.abilities,
    lootTableId: npc.lootTableId,
    aiRules: npc.aiRules,
    serverRules: npc.serverRules,
  };
}

export function resolveHarthmereDeathPenaltyV1(args: {
  mode: "pve" | "pvp" | "duel" | "arena" | "battleground" | "hardcore_pvp" | "boss" | "server_issue";
  revivedByAlly?: boolean;
  unfairDeath?: boolean;
  distanceRespawn?: boolean;
}): {
  durabilityLossPercent: number;
  resurrectionSicknessSeconds: number;
  xpDebt: number;
  inventoryDropPolicy: string;
  respawnProtectionSeconds: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (args.mode === "server_issue" || args.unfairDeath) {
    return { durabilityLossPercent: 0, resurrectionSicknessSeconds: 0, xpDebt: 0, inventoryDropPolicy: "none", respawnProtectionSeconds: 30, reasons: ["unfair_death_no_harsh_penalty"] };
  }
  if (args.mode === "duel") return { durabilityLossPercent: 0, resurrectionSicknessSeconds: 0, xpDebt: 0, inventoryDropPolicy: "none", respawnProtectionSeconds: 10, reasons: ["duel_ends_at_low_hp_or_safe_death"] };
  if (args.revivedByAlly) return { durabilityLossPercent: 0.02, resurrectionSicknessSeconds: 0, xpDebt: 0, inventoryDropPolicy: "none", respawnProtectionSeconds: 10, reasons: ["ally_revive_no_harsh_sickness"] };
  if (args.mode === "hardcore_pvp") return { durabilityLossPercent: 0.1, resurrectionSicknessSeconds: 120, xpDebt: 0, inventoryDropPolicy: "drop_only_unbound_trade_goods_and_gathered_resources", respawnProtectionSeconds: 30, reasons: ["bound_quest_spellbook_mount_pet_cosmetic_keyring_protected"] };
  if (args.mode === "pvp" || args.mode === "arena" || args.mode === "battleground") return { durabilityLossPercent: 0.02, resurrectionSicknessSeconds: 0, xpDebt: 0, inventoryDropPolicy: "none", respawnProtectionSeconds: 25, reasons: ["normal_pvp_death_no_inventory_destroy"] };
  return { durabilityLossPercent: args.mode === "boss" ? 0.05 : 0.05, resurrectionSicknessSeconds: args.distanceRespawn ? 180 : 60, xpDebt: 0, inventoryDropPolicy: "none", respawnProtectionSeconds: 15, reasons };
}

export function validateHarthmereServerAuthorityEnvelopeV1(args: {
  requestId: string;
  clientClaims: Record<string, unknown>;
  allowedClientFields: string[];
  serverEntityVersion?: number;
  expectedEntityVersion?: number;
  idempotencyKeySeen?: boolean;
}): { ok: boolean; rejectedClaims: string[]; reason?: string } {
  if (args.idempotencyKeySeen) return { ok: false, rejectedClaims: [], reason: "duplicate_request_id_rejected" };
  if (args.serverEntityVersion !== undefined && args.expectedEntityVersion !== undefined && args.serverEntityVersion !== args.expectedEntityVersion) {
    return { ok: false, rejectedClaims: [], reason: "stale_entity_version_rejected" };
  }
  const rejectedClaims = Object.keys(args.clientClaims).filter((key) => !args.allowedClientFields.includes(key));
  if (rejectedClaims.length > 0) return { ok: false, rejectedClaims, reason: "client_authoritative_claim_rejected" };
  return { ok: true, rejectedClaims: [] };
}

export function auditHarthmereCompleteCombatCoverageV1(): {
  ok: boolean;
  classCount: number;
  skillCount: number;
  abilityCount: number;
  equipmentCount: number;
  lootTableCount: number;
  npcProfileCount: number;
  missing: string[];
} {
  const missing: string[] = [];
  const requiredSkillCategories: HarthmereSkillCategoryV1[] = ["combat","weapon","armor","magic","profession","gathering","crafting","social","exploration","survival","movement","stealth","leadership"];
  for (const category of requiredSkillCategories) {
    if (!Object.values(HARTHMERE_SKILL_CATALOG_V1).some((skill) => skill.category === category)) missing.push(`skill_category:${category}`);
  }
  for (const classId of Object.keys(HARTHMERE_CLASS_CATALOG_V1)) {
    const cls = HARTHMERE_CLASS_CATALOG_V1[classId];
    if (!cls.roles.length || !cls.primaryAttributes.length || !cls.startingAbilities.length || !cls.specializations.length || !cls.worldInteractions.length) missing.push(`class_incomplete:${classId}`);
  }
  for (const ability of Object.values(HARTHMERE_ABILITY_CATALOG_V1)) {
    if (!ability.tooltip || !ability.serverValidation.includes("range") || !ability.upgradePath.length) missing.push(`ability_incomplete:${ability.id}`);
  }
  return {
    ok: missing.length === 0,
    classCount: Object.keys(HARTHMERE_CLASS_CATALOG_V1).length,
    skillCount: Object.keys(HARTHMERE_SKILL_CATALOG_V1).length,
    abilityCount: Object.keys(HARTHMERE_ABILITY_CATALOG_V1).length,
    equipmentCount: Object.keys(HARTHMERE_EQUIPMENT_CATALOG_V1).length,
    lootTableCount: Object.keys(HARTHMERE_LOOT_TABLES_V1).length,
    npcProfileCount: Object.keys(HARTHMERE_NPC_COMBAT_PROFILES_V1).length,
    missing,
  };
}
