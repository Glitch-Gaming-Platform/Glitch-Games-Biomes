import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  applyHarthmereLevelingToPlayerCombatStats,
  awardHarthmereCombatXp,
  levelDamageModifier,
  levelHitModifier,
  scaleHarthmereNpcCombatStats,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useEffect, useMemo, useState } from "react";

const HARTHMERE_COMBAT_STATE_KEY = "biomes.localDev.harthmere.combatState.v1";
const HARTHMERE_COMBAT_EVENT = "biomes:harthmere-combat-changed";
const HARTHMERE_DEATH_STATE_KEY = "biomes.localDev.harthmere.deathState.v1";
const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";
const HARTHMERE_INVENTORY_STATE_KEY =
  "biomes.localDev.harthmere.inventoryState.v1";
const HARTHMERE_COMBAT_RULESET_REVISION =
  "harthmere-user-scoped-combat-v2";

const HARTHMERE_TRAINING_DUMMY_OFFSET = 9001;
const HARTHMERE_DRAIN_RAT_OFFSET = 9002;
const HARTHMERE_ROAD_BANDIT_OFFSET = 9003;
const HARTHMERE_ROAD_WOLF_OFFSET = 9004;
const HARTHMERE_AMBIENT_BANDIT_OFFSET = 9005;
const HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET = 9006;
const HARTHMERE_FOREST_DEER_OFFSET = 9007;
const HARTHMERE_DISEASED_BOAR_OFFSET = 9008;
const HARTHMERE_BLACK_BEAR_OFFSET = 9009;
const HARTHMERE_FOREST_WOLF_OFFSET = 9010;
const HARTHMERE_BRIARFEN_SNAKE_OFFSET = 9011;
const HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET = 9012;
const HARTHMERE_BANDIT_TRAPPER_OFFSET = 9013;

type CombatStateName =
  | "idle"
  | "alert"
  | "in_combat"
  | "downed"
  | "protected_after_respawn"
  | "fleeing"
  | "evading"
  | "dead"
  | "respawning"
  | "invulnerable";

type CombatBehavior =
  | "passive"
  | "defensive"
  | "merchant"
  | "guard"
  | "hostile"
  | "training_dummy"
  | "quest_anchor";

type DamageType =
  | "physical"
  | "slashing"
  | "piercing"
  | "blunt"
  | "fire"
  | "ice"
  | "poison"
  | "arcane"
  | "holy"
  | "true";

type HitResult =
  | "miss"
  | "dodge"
  | "block"
  | "parry"
  | "resist"
  | "absorb"
  | "normal_hit"
  | "critical_hit"
  | "glancing_hit"
  | "crushing_hit"
  | "immune"
  | "evade"
  | "invalid_target"
  | "out_of_range"
  | "dead";

interface CombatAbility {
  id: string;
  name: string;
  damageType: DamageType;
  abilityMultiplier: number;
  range: number;
  cooldownSeconds: number;
  canCrit: boolean;
  canBeBlocked: boolean;
  canBeParried: boolean;
  canBeDodged: boolean;
  threatMultiplier: number;
  varianceMin: number;
  varianceMax: number;
}

export interface HarthmereCombatStats {
  name: string;
  level: number;
  faction: string;
  behavior: CombatBehavior;
  hp: number;
  maxHp: number;
  attackPoints: number;
  defense: number;
  armor: number;
  magicResistance: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalDamage: number;
  attackSpeed: number;
  attackRange: number;
  movementSpeed: number;
  aggroRange: number;
  leashRange: number;
  threatValue: number;
  combatState: CombatStateName;
  attackable: boolean;
}

export interface HarthmereCombatLogEntry {
  id: string;
  at: number;
  attacker: string;
  target: string;
  ability: string;
  result: HitResult;
  rawDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  detail: string;
}

interface HarthmereCombatState {
  rulesetRevision?: string;
  player: HarthmereCombatStats;
  npcs: Record<string, HarthmereCombatStats>;
  selectedNpcOffset?: number;
  recent: HarthmereCombatLogEntry[];
  killCredit: Record<string, number>;
}

const NPC_NAMES: Record<number, string> = {
  1: "Mira, Town Guide",
  2: "Bolt, Archive Robot",
  3: "Toma, Builder",
  4: "Pip, Harbor Mascot",
  5: "Maren Dawnloaf, Baker",
  6: "Banker Merl Voss",
  7: "Brann, Weapons Teller",
  8: "Luma, Healer",
  9: "Edrin Starling, Magic Supplier",
  10: "Tilda Fen, Farmer",
  11: "Garrick, Bartender",
  12: "Jori, Dockhand",
  13: "Bela, Storyteller",
  14: "Kip, Card Player",
  15: "Sola, Traveler",
  16: "Mern, Tavern Bard",
  17: "Rowan, Walker",
  18: "Iva, Walker",
  19: "Cade, Walker",
  20: "Sera, Walker",
  21: "Tess, Walker",
  22: "Niko, Walker",
  23: "Pera, Walker",
  24: "Olan, Walker",
  25: "Rin, Walker",
  26: "Dax, Walker",
  27: "Sergeant Bram Holt",
  28: "Mara Thistle",
  29: "Master Osric Vale",
  30: "Elowen Pike",
  31: "Father Aldren",
  32: "Reeve Caldus Merrow",
  33: "Nessa Crowe",
  34: "Tovin Reed",
  35: "Lysa, Cloth Merchant",
  36: "Perrin, Moneylender",
  37: "Old Jory",
  38: "Mirel, Gravekeeper",
  39: "Rusk, Toll Clerk",
  40: "Sable, Smuggler",
  41: "Harthmere Market Board",
  42: "Town Crier Pell",
  43: "Courier Anwen",
  44: "Drill Instructor Hal",
  45: "Bounty Clerk Rowan",
  46: "Sister Maelle",
  47: "Ysabet Fenlow",
  48: "Garrik Fen",
  49: "Helna Voss",
  50: "Selka Weaver",
  51: "Ferry Master Wren",
  52: "Mudden Child Lio",
  53: "Washerwoman Cale",
  54: "Tax Clerk Iven",
  55: "Noble Servant Rose",
  56: "Guard Quartermaster Tarrow",
  57: "Traveling Merchant Ossa",
  58: "Food Vendor Marae",
  59: "Guild Registrar Wyne",
  60: "Auction Clerk Pellam",
  61: "Rat Catcher Dima",
  62: "Bell-Witness Ora",
  63: "Apple Picker Ren",
  64: "Stablehand Corin",
  65: "River Knots Lookout",
  66: "Chapel Choir Child",
  67: "Forge Apprentice Luth",
  68: "Bakery Apprentice Noll",
  69: "Market Guard Sen",
  70: "Underways Echo",
  [HARTHMERE_TRAINING_DUMMY_OFFSET]: "Guard Yard Training Dummy",
  [HARTHMERE_DRAIN_RAT_OFFSET]: "Mudden Drain Rat",
  [HARTHMERE_ROAD_BANDIT_OFFSET]: "Road Bandit Scout",
  [HARTHMERE_ROAD_WOLF_OFFSET]: "Road Wolf",
  [HARTHMERE_AMBIENT_BANDIT_OFFSET]: "Wilds Bandit Ambusher",
  [HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET]: "Bell-Woken Zombie",
  [HARTHMERE_FOREST_DEER_OFFSET]: "Greenmere Deer",
  [HARTHMERE_DISEASED_BOAR_OFFSET]: "Diseased Boar",
  [HARTHMERE_BLACK_BEAR_OFFSET]: "Black Bear",
  [HARTHMERE_FOREST_WOLF_OFFSET]: "Forest Wolf",
  [HARTHMERE_BRIARFEN_SNAKE_OFFSET]: "Briarfen Water Snake",
  [HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET]: "Gravewood Pale Wolf",
  [HARTHMERE_BANDIT_TRAPPER_OFFSET]: "Bandit Trapper",
};

const GUARD_OFFSETS = new Set([27, 39, 44, 45, 56, 69]);
const MERCHANT_OFFSETS = new Set([
  5, 6, 7, 8, 9, 11, 28, 29, 30, 34, 35, 36, 37, 43, 47, 48, 49, 50, 51, 54, 57,
  58, 59, 60, 63, 64, 67, 68,
]);
const CIVILIAN_OFFSETS = new Set([
  1, 3, 4, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 31,
  33, 38, 42, 46, 52, 53, 55, 61, 62, 65, 66, 70,
]);
const GUARD_YARD_OFFSETS = new Set([27, 44, 45, 56, 69]);
const MUDDEN_THREAT_OFFSETS = new Set([33, 52, 53, 61]);
const ROAD_THREAT_OFFSETS = new Set([27, 39, 45, 57, 63, 64, 69]);
const WILDLIFE_THREAT_OFFSETS = new Set([10, 37, 63, 64]);
const ATTACKABLE_WILDS_ANIMAL_OFFSETS = new Set([
  HARTHMERE_FOREST_DEER_OFFSET,
  HARTHMERE_DISEASED_BOAR_OFFSET,
  HARTHMERE_BLACK_BEAR_OFFSET,
  HARTHMERE_FOREST_WOLF_OFFSET,
  HARTHMERE_BRIARFEN_SNAKE_OFFSET,
  HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET,
]);
const BOARD_OFFSETS = new Set([41]);

const PLAYER_BASIC_ATTACK: CombatAbility = {
  id: "basic_strike",
  name: "Basic Strike",
  damageType: "slashing",
  abilityMultiplier: 1.0,
  range: 2.2,
  cooldownSeconds: 1.4,
  canCrit: true,
  canBeBlocked: true,
  canBeParried: true,
  canBeDodged: true,
  threatMultiplier: 1.0,
  varianceMin: 0.9,
  varianceMax: 1.1,
};

const PLAYER_HEAVY_ATTACK: CombatAbility = {
  id: "heavy_strike",
  name: "Heavy Strike",
  damageType: "blunt",
  abilityMultiplier: 1.45,
  range: 2.4,
  cooldownSeconds: 2.8,
  canCrit: true,
  canBeBlocked: true,
  canBeParried: true,
  canBeDodged: true,
  threatMultiplier: 1.4,
  varianceMin: 0.85,
  varianceMax: 1.2,
};

const PLAYER_SPARK_ATTACK: CombatAbility = {
  id: "spark_rank_1",
  name: "Spark",
  damageType: "arcane",
  abilityMultiplier: 0.82,
  range: 24,
  cooldownSeconds: 4,
  canCrit: true,
  canBeBlocked: false,
  canBeParried: false,
  canBeDodged: true,
  threatMultiplier: 0.9,
  varianceMin: 0.95,
  varianceMax: 1.05,
};

const NPC_BASIC_ATTACK: CombatAbility = {
  id: "npc_basic_attack",
  name: "Basic Attack",
  damageType: "physical",
  abilityMultiplier: 1.0,
  range: 2.0,
  cooldownSeconds: 1.8,
  canCrit: true,
  canBeBlocked: true,
  canBeParried: false,
  canBeDodged: true,
  threatMultiplier: 1.0,
  varianceMin: 0.9,
  varianceMax: 1.1,
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function combatEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_COMBAT_EVENT));
}

function deathEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_DEATH_EVENT));
}

function readRawDeathState(): any {
  if (!isBrowser()) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY),
    );
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeRawDeathState(state: any) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY),
    JSON.stringify(state),
  );
  deathEvent();
}

function deathLogEntry(label: string, detail: string) {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    at: Date.now(),
    label,
    detail,
  };
}

function markDeathStateAlive(detail: string) {
  const current = readRawDeathState();
  writeRawDeathState({
    version: 1,
    ...(current ?? {}),
    state: "alive",
    currentDeath: undefined,
    downedUntil: undefined,
    forcedRespawnAt: undefined,
    protectionUntil: undefined,
    recent: [deathLogEntry("Alive", detail), ...(current?.recent ?? [])].slice(
      0,
      12,
    ),
  });
}

function markDeathStateProtected(
  label: string,
  detail: string,
  protectionSeconds: number,
  sicknessSeconds: number,
) {
  const current = readRawDeathState();
  writeRawDeathState({
    version: 1,
    ...(current ?? {}),
    state: "protected_after_respawn",
    currentDeath: undefined,
    downedUntil: undefined,
    forcedRespawnAt: undefined,
    protectionUntil: Date.now() + protectionSeconds * 1000,
    resurrectionSicknessUntil:
      sicknessSeconds > 0 ? Date.now() + sicknessSeconds * 1000 : undefined,
    recent: [deathLogEntry(label, detail), ...(current?.recent ?? [])].slice(
      0,
      12,
    ),
  });
}

function markPlayerDownedFromCombat(
  killer: HarthmereCombatStats,
  ability: CombatAbility,
  finalDamage: number,
  detail: string,
) {
  const current = readRawDeathState();
  const deathId = `hm-death-${Date.now()}-${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  const now = Date.now();
  const killerType =
    killer.behavior === "guard"
      ? "guard"
      : killer.behavior === "hostile"
        ? "npc"
        : "unknown";
  const record = {
    deathId,
    state: "downed",
    zone: "Harthmere",
    position: [486, 53, -209],
    cause: `${ability.name} reduced you to 0 HP`,
    killerType,
    killerName: killer.name,
    damageSummary: [
      {
        source: killer.name,
        ability: ability.name,
        damage: finalDamage,
        type: ability.damageType,
      },
    ],
    durabilityLossPercent: 5,
    xpDebt: 0,
    corpsePosition: [486, 53, -209],
    availableRespawns: ["temple_green", "north_gate", "player_house"],
    createdAt: now,
  };
  writeRawDeathState({
    version: 1,
    ...(current ?? {}),
    state: "downed",
    currentDeath: record,
    downedUntil: now + 45_000,
    forcedRespawnAt: now + 5 * 60_000,
    protectionUntil: undefined,
    deathCount: (current?.deathCount ?? 0) + 1,
    recent: [deathLogEntry("Downed", detail), ...(current?.recent ?? [])].slice(
      0,
      12,
    ),
  });
}

interface EquippedWeaponContext {
  itemId?: string;
  name: string;
  attackBonus: number;
  accuracyBonus: number;
  critBonus: number;
  rangeBonus: number;
  damageType: DamageType;
  durabilityFactor: number;
}

const WEAPON_CONTEXTS: Record<
  string,
  Omit<EquippedWeaponContext, "durabilityFactor">
> = {
  training_dagger: {
    itemId: "training_dagger",
    name: "Training Dagger",
    attackBonus: 9,
    accuracyBonus: 2,
    critBonus: 0.02,
    rangeBonus: -0.15,
    damageType: "piercing",
  },
  iron_longsword: {
    itemId: "iron_longsword",
    name: "Iron Longsword",
    attackBonus: 18,
    accuracyBonus: 3,
    critBonus: 0.015,
    rangeBonus: 0.1,
    damageType: "slashing",
  },
  woodsman_axe: {
    itemId: "woodsman_axe",
    name: "Woodsman's Axe",
    attackBonus: 14,
    accuracyBonus: 1,
    critBonus: 0.025,
    rangeBonus: 0,
    damageType: "slashing",
  },
  two_handed_sword: {
    itemId: "two_handed_sword",
    name: "Two-Handed Sword",
    attackBonus: 26,
    accuracyBonus: 1,
    critBonus: 0.035,
    rangeBonus: 0.25,
    damageType: "slashing",
  },
};

function equippedWeaponContext(): EquippedWeaponContext {
  const fallback: EquippedWeaponContext = {
    name: "Fists",
    attackBonus: -30,
    accuracyBonus: -2,
    critBonus: -0.02,
    rangeBonus: -0.35,
    damageType: "blunt",
    durabilityFactor: 1,
  };
  if (!isBrowser()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_INVENTORY_STATE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    const weapon = parsed?.equipment?.main_hand;
    const context = weapon?.itemId ? WEAPON_CONTEXTS[weapon.itemId] : undefined;
    if (!context) {
      return fallback;
    }
    const maxDurability =
      weapon.itemId === "two_handed_sword"
        ? 60
        : weapon.itemId === "iron_longsword"
          ? 50
          : weapon.itemId === "woodsman_axe"
            ? 45
            : 35;
    const durability = Math.max(0, Number(weapon.durability ?? maxDurability));
    const durabilityFactor = clamp(durability / maxDurability, 0.35, 1);
    return { ...context, durabilityFactor };
  } catch {
    return fallback;
  }
}

function applyWeaponToPlayer(
  player: HarthmereCombatStats,
  weapon: EquippedWeaponContext,
): HarthmereCombatStats {
  return {
    ...player,
    attackPoints: Math.max(
      1,
      Math.round(
        player.attackPoints + weapon.attackBonus * weapon.durabilityFactor,
      ),
    ),
    accuracy: player.accuracy + weapon.accuracyBonus,
    criticalChance: clamp(player.criticalChance + weapon.critBonus, 0, 0.75),
    attackRange: Math.max(1.1, player.attackRange + weapon.rangeBonus),
  };
}

function abilityWithWeapon(
  ability: CombatAbility,
  weapon: EquippedWeaponContext,
): CombatAbility {
  return {
    ...ability,
    name:
      ability.id === "heavy_strike"
        ? `Heavy ${weapon.name} Strike`
        : `${weapon.name} Strike`,
    damageType: weapon.damageType,
    range: Math.max(1.1, ability.range + weapon.rangeBonus),
  };
}

function weaponStatusLabel() {
  const weapon = equippedWeaponContext();
  if (!weapon.itemId) {
    return "Unarmed — equip a weapon from inventory";
  }
  return `${weapon.name}${weapon.durabilityFactor < 0.5 ? " · badly damaged" : ""}`;
}

function defaultPlayerStats(): HarthmereCombatStats {
  return applyHarthmereLevelingToPlayerCombatStats({
    name: "You",
    level: 10,
    faction: "player",
    behavior: "defensive",
    hp: 520,
    maxHp: 520,
    attackPoints: 120,
    defense: 130,
    armor: 160,
    magicResistance: 80,
    accuracy: 8,
    evasion: 7,
    criticalChance: 0.1,
    criticalDamage: 1.5,
    attackSpeed: 1,
    attackRange: 2.2,
    movementSpeed: 4.5,
    aggroRange: 0,
    leashRange: 0,
    threatValue: 0,
    combatState: "idle",
    attackable: true,
  });
}

function statsForOffset(offset: number): HarthmereCombatStats {
  if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET) {
    return {
      name: NPC_NAMES[offset],
      level: 1,
      faction: "training",
      behavior: "training_dummy",
      hp: 500,
      maxHp: 500,
      attackPoints: 0,
      defense: 20,
      armor: 80,
      magicResistance: 30,
      accuracy: 0,
      evasion: 0,
      criticalChance: 0,
      criticalDamage: 1,
      attackSpeed: 0,
      attackRange: 0,
      movementSpeed: 0,
      aggroRange: 0,
      leashRange: 0,
      threatValue: 0,
      combatState: "idle",
      attackable: true,
    };
  }

  if (offset === HARTHMERE_DRAIN_RAT_OFFSET) {
    return hostileStats(offset, 3, "wildlife", 90, 12, 15, 7, 1.6);
  }

  if (offset === HARTHMERE_ROAD_BANDIT_OFFSET) {
    return hostileStats(offset, 7, "bandit", 360, 62, 80, 14, 2.2);
  }

  if (offset === HARTHMERE_ROAD_WOLF_OFFSET) {
    return hostileStats(offset, 5, "wildlife", 240, 35, 45, 10, 1.9);
  }

  if (offset === HARTHMERE_AMBIENT_BANDIT_OFFSET) {
    return hostileStats(offset, 8, "bandit", 390, 58, 75, 13, 2.2);
  }

  if (offset === HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET) {
    return hostileStats(offset, 6, "undead", 320, 44, 60, 4, 1.65);
  }

  if (offset === HARTHMERE_FOREST_DEER_OFFSET) {
    return wildlifeStats(offset, 3, "wildlife", 165, 18, 20, 18, 1.7, "defensive");
  }

  if (offset === HARTHMERE_DISEASED_BOAR_OFFSET) {
    return wildlifeStats(offset, 5, "wildlife", 300, 42, 55, 8, 1.8, "hostile");
  }

  if (offset === HARTHMERE_BLACK_BEAR_OFFSET) {
    return wildlifeStats(offset, 9, "wildlife", 620, 88, 120, 5, 2.1, "hostile");
  }

  if (offset === HARTHMERE_FOREST_WOLF_OFFSET) {
    return wildlifeStats(offset, 6, "wildlife", 280, 52, 42, 15, 1.9, "hostile");
  }

  if (offset === HARTHMERE_BRIARFEN_SNAKE_OFFSET) {
    return wildlifeStats(offset, 4, "wildlife", 135, 31, 18, 22, 1.4, "hostile");
  }

  if (offset === HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET) {
    return wildlifeStats(offset, 7, "undead_wildlife", 340, 58, 60, 14, 1.9, "hostile");
  }

  if (offset === HARTHMERE_BANDIT_TRAPPER_OFFSET) {
    return hostileStats(offset, 8, "bandit", 410, 64, 72, 16, 2.4);
  }

  if (GUARD_OFFSETS.has(offset)) {
    return {
      name: NPC_NAMES[offset] ?? `Guard ${offset}`,
      level: 15,
      faction: "town_watch",
      behavior: "guard",
      hp: 900,
      maxHp: 900,
      attackPoints: 165,
      defense: 260,
      armor: 320,
      magicResistance: 130,
      accuracy: 14,
      evasion: 6,
      criticalChance: 0.08,
      criticalDamage: 1.5,
      attackSpeed: 0.85,
      attackRange: 2.4,
      movementSpeed: 4.2,
      aggroRange: 14,
      leashRange: 45,
      threatValue: 400,
      combatState: "idle",
      attackable: true,
    };
  }

  if (MERCHANT_OFFSETS.has(offset)) {
    return {
      name: NPC_NAMES[offset] ?? `Merchant ${offset}`,
      level: 8,
      faction: "harthmere_citizen",
      behavior: "merchant",
      hp: 190,
      maxHp: 190,
      attackPoints: 18,
      defense: 60,
      armor: 45,
      magicResistance: 45,
      accuracy: 2,
      evasion: 3,
      criticalChance: 0.02,
      criticalDamage: 1.25,
      attackSpeed: 0.55,
      attackRange: 1.5,
      movementSpeed: 3.4,
      aggroRange: 0,
      leashRange: 16,
      threatValue: 40,
      combatState: "idle",
      attackable: true,
    };
  }

  if (CIVILIAN_OFFSETS.has(offset)) {
    return {
      name: NPC_NAMES[offset] ?? `Citizen ${offset}`,
      level: 5,
      faction: "harthmere_citizen",
      behavior: offset === 52 || offset === 66 ? "passive" : "defensive",
      hp: offset === 52 || offset === 66 ? 55 : 135,
      maxHp: offset === 52 || offset === 66 ? 55 : 135,
      attackPoints: offset === 52 || offset === 66 ? 0 : 10,
      defense: 30,
      armor: 20,
      magicResistance: 20,
      accuracy: 0,
      evasion: offset === 52 || offset === 66 ? 12 : 4,
      criticalChance: 0.01,
      criticalDamage: 1.15,
      attackSpeed: 0.45,
      attackRange: 1.3,
      movementSpeed: 3.6,
      aggroRange: 0,
      leashRange: 10,
      threatValue: 10,
      combatState: "idle",
      attackable: true,
    };
  }

  return {
    name: NPC_NAMES[offset] ?? `Harthmere NPC ${offset}`,
    level: 5,
    faction: "harthmere_citizen",
    behavior: "quest_anchor",
    hp: 120,
    maxHp: 120,
    attackPoints: 8,
    defense: 25,
    armor: 20,
    magicResistance: 20,
    accuracy: 0,
    evasion: 3,
    criticalChance: 0.01,
    criticalDamage: 1.1,
    attackSpeed: 0.4,
    attackRange: 1.25,
    movementSpeed: 3.2,
    aggroRange: 0,
    leashRange: 10,
    threatValue: 10,
    combatState: "idle",
    attackable: true,
  };
}

function wildlifeStats(
  offset: number,
  level: number,
  faction: string,
  hp: number,
  attackPoints: number,
  armor: number,
  evasion: number,
  attackRange: number,
  behavior: "hostile" | "defensive",
): HarthmereCombatStats {
  return {
    name: NPC_NAMES[offset] ?? `Wild animal ${offset}`,
    level,
    faction,
    behavior,
    hp,
    maxHp: hp,
    attackPoints,
    defense: armor,
    armor,
    magicResistance: Math.floor(armor / 3),
    accuracy: level + 2,
    evasion,
    criticalChance: behavior === "hostile" ? 0.07 : 0.03,
    criticalDamage: 1.4,
    attackSpeed: behavior === "hostile" ? 1.05 : 0.85,
    attackRange,
    movementSpeed: behavior === "hostile" ? 5.0 : 5.6,
    aggroRange: behavior === "hostile" ? 16 : 0,
    leashRange: 48,
    threatValue: attackPoints,
    combatState: "idle",
    attackable: true,
  };
}

function hostileStats(
  offset: number,
  level: number,
  faction: string,
  hp: number,
  attackPoints: number,
  armor: number,
  evasion: number,
  attackRange: number,
): HarthmereCombatStats {
  return {
    name: NPC_NAMES[offset] ?? `Hostile ${offset}`,
    level,
    faction,
    behavior: "hostile",
    hp,
    maxHp: hp,
    attackPoints,
    defense: armor,
    armor,
    magicResistance: Math.floor(armor / 2),
    accuracy: level,
    evasion,
    criticalChance: 0.05,
    criticalDamage: 1.5,
    attackSpeed: 0.9,
    attackRange,
    movementSpeed: 4.2,
    aggroRange: 12,
    leashRange: 40,
    threatValue: attackPoints,
    combatState: "idle",
    attackable: true,
  };
}

function normalizeStats(
  stats: Partial<HarthmereCombatStats> | undefined,
  fallback: HarthmereCombatStats,
): HarthmereCombatStats {
  const merged = { ...fallback, ...(stats ?? {}) };
  merged.maxHp = Math.max(1, merged.maxHp);
  merged.hp = clamp(Math.round(merged.hp), 0, merged.maxHp);
  if (
    merged.hp <= 0 &&
    !["respawning", "downed", "dead"].includes(merged.combatState)
  ) {
    merged.combatState = "dead";
  }
  return merged;
}

function normalizeState(
  parsed: Partial<HarthmereCombatState> | undefined,
): HarthmereCombatState {
  if (parsed && parsed.rulesetRevision !== HARTHMERE_COMBAT_RULESET_REVISION) {
    return normalizeState(undefined);
  }

  const npcs: Record<string, HarthmereCombatStats> = {};
  for (const [key, stats] of Object.entries(parsed?.npcs ?? {})) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      npcs[key] = normalizeStats(
        stats,
        scaleHarthmereNpcCombatStats(statsForOffset(offset), offset),
      );
    }
  }

  const recent = (parsed?.recent ?? []).slice(0, 12);
  const latestCombatAt = recent[0]?.at ?? 0;
  const staleCombatState = !latestCombatAt || Date.now() - latestCombatAt > 12_000;
  let player = applyHarthmereLevelingToPlayerCombatStats(
    normalizeStats(parsed?.player, defaultPlayerStats()),
  );

  // Earlier HUD/combat iterations could leave local-dev players stuck at 1 HP
  // after a test fight or death. That made a fresh start show values such as
  // 1/250. If the stored combat log is stale, repair any critically low,
  // downed, dead, or respawning player state back to a clean ready state.
  // Fresh combat still preserves real incoming damage.
  const shouldRepairLoadedPlayerStats =
    staleCombatState &&
    player.maxHp >= 100 &&
    (player.hp <= Math.max(1, Math.floor(player.maxHp * 0.15)) ||
      ["dead", "downed", "respawning"].includes(player.combatState));
  if (shouldRepairLoadedPlayerStats) {
    player = { ...player, hp: player.maxHp, combatState: "idle" };
  }

  return {
    rulesetRevision: HARTHMERE_COMBAT_RULESET_REVISION,
    player,
    npcs,
    selectedNpcOffset: parsed?.selectedNpcOffset,
    recent,
    killCredit: parsed?.killCredit ?? {},
  };
}

export function readHarthmereCombatState(): HarthmereCombatState {
  if (!isBrowser()) {
    return normalizeState(undefined);
  }
  try {
    const raw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_COMBAT_STATE_KEY),
    );
    if (!raw) {
      return normalizeState(undefined);
    }
    return normalizeState(JSON.parse(raw) as Partial<HarthmereCombatState>);
  } catch {
    return normalizeState(undefined);
  }
}

function writeHarthmereCombatState(state: HarthmereCombatState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_COMBAT_STATE_KEY),
    JSON.stringify(normalizeState(state)),
  );
  combatEvent();
}

function npcStatsFromState(
  state: HarthmereCombatState,
  offset: number,
): HarthmereCombatStats {
  return normalizeStats(
    state.npcs[String(offset)],
    scaleHarthmereNpcCombatStats(statsForOffset(offset), offset),
  );
}

function appendCombatLog(
  state: HarthmereCombatState,
  entry: Omit<HarthmereCombatLogEntry, "id" | "at">,
): HarthmereCombatState {
  return {
    ...state,
    recent: [
      {
        ...entry,
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
      },
      ...state.recent,
    ].slice(0, 12),
  };
}

function invalidLog(
  state: HarthmereCombatState,
  target: HarthmereCombatStats,
  detail: string,
  result: HitResult = "invalid_target",
) {
  return appendCombatLog(state, {
    attacker: state.player.name,
    target: target.name,
    ability: "Attack",
    result,
    rawDamage: 0,
    mitigatedDamage: 0,
    finalDamage: 0,
    targetHpBefore: target.hp,
    targetHpAfter: target.hp,
    detail,
  });
}

function damageReduction(
  attacker: HarthmereCombatStats,
  defender: HarthmereCombatStats,
  damageType: DamageType,
) {
  if (damageType === "true") {
    return 0;
  }
  const defensiveValue = ["fire", "ice", "poison", "arcane", "holy"].includes(
    damageType,
  )
    ? defender.magicResistance
    : Math.max(defender.defense, defender.armor);
  return clamp(
    defensiveValue / (defensiveValue + attacker.level * 100),
    0,
    0.75,
  );
}

function rollHitResult(
  attacker: HarthmereCombatStats,
  defender: HarthmereCombatStats,
  ability: CombatAbility,
): HitResult {
  if (!defender.attackable) {
    return "immune";
  }
  if (defender.combatState === "dead") {
    return "dead";
  }
  if (defender.combatState === "evading") {
    return "evade";
  }

  const hitChance = clamp(
    0.8 +
      attacker.accuracy / 100 -
      defender.evasion / 100 +
      levelHitModifier(attacker.level, defender.level),
    0.05,
    0.95,
  );
  if (Math.random() > hitChance) {
    return Math.random() < 0.5 ? "miss" : "dodge";
  }

  if (
    ability.canBeParried &&
    defender.behavior === "guard" &&
    Math.random() < 0.08
  ) {
    return "parry";
  }
  if (
    ability.canBeBlocked &&
    ["guard", "training_dummy"].includes(defender.behavior)
  ) {
    if (Math.random() < 0.12) {
      return "block";
    }
  }
  if (
    ability.canCrit &&
    Math.random() < clamp(attacker.criticalChance, 0, 0.75)
  ) {
    return "critical_hit";
  }

  if (attacker.level >= defender.level + 8 && Math.random() < 0.08) {
    return "crushing_hit";
  }
  if (defender.level >= attacker.level + 8 && Math.random() < 0.12) {
    return "glancing_hit";
  }

  return "normal_hit";
}

function calculateDamage(
  attacker: HarthmereCombatStats,
  defender: HarthmereCombatStats,
  ability: CombatAbility,
  result: HitResult,
) {
  if (
    [
      "miss",
      "dodge",
      "parry",
      "immune",
      "evade",
      "invalid_target",
      "out_of_range",
      "dead",
    ].includes(result)
  ) {
    return { rawDamage: 0, mitigatedDamage: 0, finalDamage: 0 };
  }

  const baseDamage = attacker.attackPoints * ability.abilityMultiplier;
  const variance = randomBetween(ability.varianceMin, ability.varianceMax);
  const critModifier = result === "critical_hit" ? attacker.criticalDamage : 1;
  const hitModifier =
    result === "glancing_hit" ? 0.65 : result === "crushing_hit" ? 1.45 : 1;
  const blockModifier = result === "block" ? 0.55 : 1;
  const levelModifier = levelDamageModifier(attacker.level, defender.level);
  const rawDamage = Math.max(
    0,
    baseDamage * variance * critModifier * hitModifier * levelModifier,
  );
  const reduction = damageReduction(attacker, defender, ability.damageType);
  const mitigatedDamage = rawDamage * (1 - reduction) * blockModifier;
  const finalDamage = Math.max(1, Math.round(mitigatedDamage));
  return {
    rawDamage: Math.round(rawDamage),
    mitigatedDamage: Math.round(rawDamage - finalDamage),
    finalDamage,
  };
}

function resultLabel(result: HitResult) {
  switch (result) {
    case "normal_hit":
      return "hit";
    case "critical_hit":
      return "critically hit";
    case "glancing_hit":
      return "landed a glancing hit on";
    case "crushing_hit":
      return "crushed";
    case "block":
      return "partially hit after a block from";
    case "miss":
      return "missed";
    case "dodge":
      return "was dodged by";
    case "parry":
      return "was parried by";
    case "resist":
      return "was resisted by";
    case "absorb":
      return "was absorbed by";
    case "immune":
      return "could not affect";
    case "evade":
      return "could not reach";
    default:
      return "failed against";
  }
}

function applyAttack(
  state: HarthmereCombatState,
  attacker: HarthmereCombatStats,
  target: HarthmereCombatStats,
  ability: CombatAbility,
  targetIsPlayer: boolean,
): {
  state: HarthmereCombatState;
  updatedAttacker: HarthmereCombatStats;
  updatedTarget: HarthmereCombatStats;
  result: HitResult;
  finalDamage: number;
} {
  const result = rollHitResult(attacker, target, ability);
  const { rawDamage, mitigatedDamage, finalDamage } = calculateDamage(
    attacker,
    target,
    ability,
    result,
  );
  const targetHpBefore = target.hp;
  const updatedTarget: HarthmereCombatStats = {
    ...target,
    hp: clamp(target.hp - finalDamage, 0, target.maxHp),
    combatState: finalDamage > 0 ? "in_combat" : target.combatState,
  };
  if (updatedTarget.hp <= 0) {
    updatedTarget.combatState = "dead";
  }

  const updatedAttacker: HarthmereCombatStats = {
    ...attacker,
    combatState: attacker.combatState === "dead" ? "dead" : "in_combat",
  };

  const detail =
    finalDamage > 0
      ? `${attacker.name} ${resultLabel(result)} ${target.name} with ${ability.name} for ${finalDamage} damage.`
      : `${attacker.name}'s ${ability.name} ${resultLabel(result)} ${target.name}.`;

  const nextState = appendCombatLog(state, {
    attacker: attacker.name,
    target: target.name,
    ability: ability.name,
    result,
    rawDamage,
    mitigatedDamage,
    finalDamage,
    targetHpBefore,
    targetHpAfter: updatedTarget.hp,
    detail,
  });

  return {
    state: targetIsPlayer ? { ...nextState, player: updatedTarget } : nextState,
    updatedAttacker,
    updatedTarget,
    result,
    finalDamage,
  };
}

function reputationForIllegalAttack(
  target: HarthmereCombatStats,
  offset: number,
) {
  if (target.behavior === "training_dummy" || target.behavior === "hostile") {
    return;
  }

  const isGuard = target.behavior === "guard";
  const isChild = offset === 52 || offset === 66;
  const legalPenalty = isGuard ? -650 : isChild ? -900 : -180;
  const likePenalty = isGuard ? -120 : isChild ? -800 : -160;
  const notorietyGain = isGuard ? 120 : isChild ? 240 : 35;

  applyHarthmereReputationChange({
    label: isGuard ? "Assaulted a town guard" : "Attacked a Harthmere local",
    detail: isGuard
      ? "The Watch treats assaulting guards as a serious crime. Witnesses will spread it."
      : "Violence against townspeople damages trust and legal standing.",
    npcOffset: offset,
    harthmere: {
      likeability: likePenalty,
      legal: legalPenalty,
      notoriety: notorietyGain,
    },
    personal: { likeability: Math.floor(likePenalty / 2), legal: legalPenalty },
  });
}

function reputationForDefeatedThreat(
  target: HarthmereCombatStats,
  offset: number,
) {
  if (target.behavior !== "hostile" && !ATTACKABLE_WILDS_ANIMAL_OFFSETS.has(offset)) {
    return;
  }
  const isBandit =
    offset === HARTHMERE_ROAD_BANDIT_OFFSET ||
    offset === HARTHMERE_AMBIENT_BANDIT_OFFSET ||
    offset === HARTHMERE_BANDIT_TRAPPER_OFFSET;
  const isAnimal = ATTACKABLE_WILDS_ANIMAL_OFFSETS.has(offset);
  applyHarthmereReputationChange({
    label: `Defeated ${target.name}`,
    detail: isBandit
      ? "Removing a road threat helps the Watch and makes your name more visible."
      : isAnimal
        ? "Hunting dangerous wildlife helps keep the roads and resource paths safer."
        : "Stopping a local threat slightly improves safety around Harthmere.",
    harthmere: {
      likeability: isBandit ? 45 : isAnimal ? 10 : 18,
      legal: isBandit ? 55 : isAnimal ? 2 : 8,
      notoriety: isBandit ? 80 : isAnimal ? 8 : 12,
    },
    global: isBandit ? { notoriety: 10 } : undefined,
  });
}

export type HarthmerePlayerAttackType = "basic" | "heavy" | "spark";


function ambientThreatForPosition(position: readonly number[]) {
  const [x, , z] = position;
  const inTown = x >= 340 && x <= 650 && z >= -335 && z <= -70;
  if (inTown) {
    return undefined;
  }
  const rollSelector = Math.floor(
    Math.abs(Math.sin(x * 0.021 + z * 0.037) * 1000),
  );
  const inGateFields = x >= 350 && x <= 560 && z >= -430 && z <= -330;
  const inBanditRidge = x >= -120 && x <= 360 && z >= -900 && z <= -430;
  const inWestOldWood = x >= -230 && x <= 330 && z >= -620 && z <= 160;
  const inNorthGreenmere = x >= 300 && x <= 820 && z >= -900 && z <= -430;
  const inEastBriarfen = x >= 720 && x <= 1230 && z >= -560 && z <= 80;
  const inGravewood = x >= 620 && x <= 1200 && z >= 80 && z <= 470;
  const inWetUndead = x >= 850 && x <= 1230 && z >= -470 && z <= -260;

  if (inGravewood || inWetUndead) {
    return {
      offset:
        rollSelector % 3 === 0
          ? HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET
          : HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET,
      label: inGravewood ? "Gravewood undead attack" : "Briarfen drowned dead",
      chance: 0.26,
    };
  }
  if (inBanditRidge) {
    return {
      offset:
        rollSelector % 2 === 0
          ? HARTHMERE_BANDIT_TRAPPER_OFFSET
          : HARTHMERE_AMBIENT_BANDIT_OFFSET,
      label: "watchtower bandit ambush",
      chance: 0.24,
    };
  }
  if (inEastBriarfen) {
    return {
      offset:
        rollSelector % 3 === 0
          ? HARTHMERE_BRIARFEN_SNAKE_OFFSET
          : HARTHMERE_FOREST_WOLF_OFFSET,
      label: "Briarfen wildlife attack",
      chance: 0.18,
    };
  }
  if (inWestOldWood || inNorthGreenmere) {
    const offset =
      rollSelector % 5 === 0
        ? HARTHMERE_BLACK_BEAR_OFFSET
        : rollSelector % 3 === 0
          ? HARTHMERE_DISEASED_BOAR_OFFSET
          : HARTHMERE_FOREST_WOLF_OFFSET;
    return {
      offset,
      label: "forest wildlife attack",
      chance: offset === HARTHMERE_BLACK_BEAR_OFFSET ? 0.12 : 0.2,
    };
  }
  if (inGateFields) {
    return {
      offset:
        rollSelector % 2 === 0
          ? HARTHMERE_DISEASED_BOAR_OFFSET
          : HARTHMERE_FOREST_WOLF_OFFSET,
      label: "field-edge wildlife attack",
      chance: 0.12,
    };
  }
  return undefined;
}

function ambientThreatRoll(position: readonly number[]) {
  const bucket = Math.floor(Date.now() / 15000);
  const raw =
    Math.sin(position[0] * 12.9898 + position[2] * 78.233 + bucket * 37.719) *
    43758.5453;
  return raw - Math.floor(raw);
}

export function triggerHarthmereAmbientThreatAttack(
  targetOffset: number,
  source: string,
) {
  let state = readHarthmereCombatState();
  let player = state.player;
  if (["dead", "downed"].includes(player.combatState) || player.hp <= 0) {
    return;
  }
  if (["invulnerable", "protected_after_respawn"].includes(player.combatState)) {
    return;
  }

  const attacker = npcStatsFromState(state, targetOffset);
  if (attacker.combatState === "dead" || attacker.hp <= 0) {
    return;
  }

  const attack = applyAttack(
    state,
    { ...attacker, combatState: "in_combat" },
    player,
    { ...NPC_BASIC_ATTACK, name: source },
    true,
  );
  player = attack.updatedTarget;

  if (player.hp <= 0) {
    player = { ...player, hp: 0, combatState: "downed" };
    markPlayerDownedFromCombat(
      attacker,
      NPC_BASIC_ATTACK,
      attack.finalDamage,
      `${attacker.name} downed you in the Wilds. Respawn at Harthmere or wait for a revive.`,
    );
    state = appendCombatLog(attack.state, {
      attacker: attacker.name,
      target: player.name,
      ability: "Wilds Ambush",
      result: "dead",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: 0,
      targetHpAfter: 0,
      detail:
        "You were downed by a roaming Wilds threat. The town is safe; the forest is not.",
    });
  } else {
    state = attack.state;
  }

  writeHarthmereCombatState({
    ...state,
    player,
    selectedNpcOffset: targetOffset,
    npcs: {
      ...state.npcs,
      [String(targetOffset)]: attack.updatedAttacker,
    },
  });
}

export function useHarthmereAmbientThreats() {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      const position = localPlayer.player.position;
      const threat = ambientThreatForPosition(position);
      if (!threat) {
        return;
      }

      const cooldownKey = `biomes.localDev.harthmere.ambientThreat.${threat.offset}`;
      const last = Number(window.localStorage.getItem(cooldownKey) ?? "0");
      const now = Date.now();
      if (now - last < 45000) {
        return;
      }
      if (ambientThreatRoll(position) > threat.chance) {
        return;
      }

      window.localStorage.setItem(cooldownKey, String(now));
      triggerHarthmereAmbientThreatAttack(threat.offset, threat.label);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [localPlayer.player.position]);
}

export function performHarthmereCombatAttack(
  targetOffset: number,
  ability: HarthmerePlayerAttackType = "basic",
) {
  let state = readHarthmereCombatState();
  let player = state.player;
  let target = npcStatsFromState(state, targetOffset);
  state = { ...state, selectedNpcOffset: targetOffset };

  if (["dead", "downed"].includes(player.combatState) || player.hp <= 0) {
    writeHarthmereCombatState(
      invalidLog(
        state,
        target,
        "You are downed and cannot attack. Revive or respawn first.",
        "dead",
      ),
    );
    return;
  }
  if (
    ["invulnerable", "protected_after_respawn"].includes(player.combatState)
  ) {
    markDeathStateAlive("Respawn protection ended because you attacked.");
    player = { ...player, combatState: "idle" };
  }
  if (!target.attackable) {
    writeHarthmereCombatState(
      invalidLog(state, target, `${target.name} is not attackable.`, "immune"),
    );
    return;
  }
  if (target.combatState === "dead" || target.hp <= 0) {
    writeHarthmereCombatState(
      invalidLog(
        state,
        target,
        `${target.name} is already defeated. Respawn or reset combat to fight again.`,
        "dead",
      ),
    );
    return;
  }

  reputationForIllegalAttack(target, targetOffset);

  const weapon = equippedWeaponContext();
  const playerAbility =
    ability === "spark"
      ? PLAYER_SPARK_ATTACK
      : abilityWithWeapon(
          ability === "heavy" ? PLAYER_HEAVY_ATTACK : PLAYER_BASIC_ATTACK,
          weapon,
        );
  const effectivePlayer =
    ability === "spark"
      ? {
          ...player,
          attackPoints: Math.max(
            1,
            Math.round(player.attackPoints * 0.72 + player.magicResistance * 0.18),
          ),
          accuracy: player.accuracy + 4,
          attackRange: PLAYER_SPARK_ATTACK.range,
        }
      : applyWeaponToPlayer(player, weapon);
  let attackResult = applyAttack(
    state,
    effectivePlayer,
    target,
    playerAbility,
    false,
  );
  state = attackResult.state;
  player = { ...player, combatState: attackResult.updatedAttacker.combatState };
  target = attackResult.updatedTarget;

  const contributionKey = String(targetOffset);
  state = {
    ...state,
    player,
    npcs: {
      ...state.npcs,
      [contributionKey]: target,
    },
    killCredit: {
      ...state.killCredit,
      [contributionKey]:
        (state.killCredit[contributionKey] ?? 0) + attackResult.finalDamage,
    },
  };

  if (target.combatState === "dead") {
    reputationForDefeatedThreat(target, targetOffset);
    awardHarthmereCombatXp(target);
    state = appendCombatLog(state, {
      attacker: player.name,
      target: target.name,
      ability: "Death Check",
      result: "dead",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: 0,
      targetHpAfter: 0,
      detail: `${target.name} was defeated. Kill credit is based on contribution, not last hit.`,
    });
    writeHarthmereCombatState(state);
    return;
  }

  if (["guard", "hostile", "defensive", "merchant"].includes(target.behavior) && target.attackPoints > 0) {
    const counterAbility =
      target.behavior === "guard" || target.behavior === "hostile"
        ? NPC_BASIC_ATTACK
        : { ...NPC_BASIC_ATTACK, name: "Defensive Counter" };
    const npcCounter = applyAttack(
      state,
      target,
      player,
      counterAbility,
      true,
    );
    let updatedPlayer = npcCounter.updatedTarget;
    if (updatedPlayer.hp <= 0) {
      updatedPlayer = { ...updatedPlayer, hp: 0, combatState: "downed" };
      markPlayerDownedFromCombat(
        target,
        target.behavior === "guard" || target.behavior === "hostile"
          ? NPC_BASIC_ATTACK
          : { ...NPC_BASIC_ATTACK, name: "Defensive Counter" },
        npcCounter.finalDamage,
        `${target.name} downed you while defending themself. You can wait for a revive or respawn at a safe Harthmere point.`,
      );
      state = appendCombatLog(npcCounter.state, {
        attacker: target.name,
        target: player.name,
        ability: "Downed State",
        result: "dead",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: 0,
        targetHpAfter: 0,
        detail:
          "You are downed, not permanently dead. Open the menu for revive and respawn options.",
      });
    } else {
      state = npcCounter.state;
    }
    state = {
      ...state,
      player: updatedPlayer,
      npcs: {
        ...state.npcs,
        [contributionKey]: npcCounter.updatedAttacker,
      },
    };
    if (["merchant", "defensive"].includes(target.behavior)) {
      state = appendCombatLog(state, {
        attacker: target.name,
        target: player.name,
        ability: "Call for Help",
        result: "evade",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: state.player.hp,
        targetHpAfter: state.player.hp,
        detail: `${target.name} strikes back, breaks away, and calls for the Watch. People are attackable, but they are not harmless props.`,
      });
    }
  } else if (target.behavior === "passive") {
    state = appendCombatLog(state, {
      attacker: target.name,
      target: player.name,
      ability: "Flee",
      result: "evade",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: player.hp,
      targetHpAfter: player.hp,
      detail: `${target.name} flees. Passive targets should not behave like monsters.`,
    });
  }

  writeHarthmereCombatState(state);
}

export function inspectHarthmereCombatTarget(offset: number) {
  const state = readHarthmereCombatState();
  const target = npcStatsFromState(state, offset);
  writeHarthmereCombatState(
    appendCombatLog(
      {
        ...state,
        selectedNpcOffset: offset,
        npcs: { ...state.npcs, [offset]: target },
      },
      {
        attacker: "Combat Inspector",
        target: target.name,
        ability: "Inspect Stats",
        result: "normal_hit",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: target.hp,
        targetHpAfter: target.hp,
        detail: `${target.name} is noted as ${target.behavior.replaceAll("_", " ")} in the local-dev combat notes. Exact numbers stay in the combat menu, not conversation text.`,
      },
    ),
  );
}

export function resetHarthmereCombat() {
  writeHarthmereCombatState(normalizeState(undefined));
}

export function healHarthmerePlayer(amount: number, source = "Healing") {
  const state = readHarthmereCombatState();
  if (
    ["dead", "downed"].includes(state.player.combatState) ||
    state.player.hp <= 0
  ) {
    writeHarthmereCombatState(
      appendCombatLog(state, {
        attacker: source,
        target: state.player.name,
        ability: "Healing",
        result: "dead",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: state.player.hp,
        targetHpAfter: state.player.hp,
        detail: `${source} cannot restore you while you are downed. Use a revive effect instead.`,
      }),
    );
    return;
  }

  const hpBefore = state.player.hp;
  const healed = clamp(amount, 0, state.player.maxHp - hpBefore);
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: source,
      target: state.player.name,
      ability: "Healing",
      result: "normal_hit",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: hpBefore,
      targetHpAfter: hpBefore + healed,
      detail: `${source} restores ${healed} HP.`,
    }),
    player: {
      ...state.player,
      hp: hpBefore + healed,
      combatState:
        state.player.combatState === "dead" ? "dead" : state.player.combatState,
    },
  });
}

export function reviveHarthmerePlayer(source = "Temple Green") {
  const state = readHarthmereCombatState();
  const restoredHp = Math.max(1, Math.round(state.player.maxHp * 0.4));
  markDeathStateAlive(`${source} revived you with partial HP.`);
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: source,
      target: state.player.name,
      ability: "Revive",
      result: "normal_hit",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: state.player.hp,
      targetHpAfter: restoredHp,
      detail:
        "You are revived with partial HP. Revives avoid harsh death penalties but do not reset hostile consequences.",
    }),
    player: { ...state.player, hp: restoredHp, combatState: "idle" },
  });
}

export function releaseHarthmerePlayerSpirit() {
  const state = readHarthmereCombatState();
  const current = readRawDeathState();
  writeRawDeathState({
    version: 1,
    ...(current ?? {}),
    state: "dead",
    downedUntil: undefined,
    recent: [
      deathLogEntry(
        "Released Spirit",
        "You released from downed state. Choose a safe respawn point to return.",
      ),
      ...(current?.recent ?? []),
    ].slice(0, 12),
  });
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: "Death System",
      target: state.player.name,
      ability: "Release Spirit",
      result: "dead",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: state.player.hp,
      targetHpAfter: 0,
      detail: "You released your spirit and now need to respawn.",
    }),
    player: { ...state.player, hp: 0, combatState: "dead" },
  });
}

export function respawnHarthmerePlayer(respawnId = "temple_green") {
  const state = readHarthmereCombatState();
  const respawnRules: Record<
    string,
    { label: string; hpPercent: number; sicknessSeconds: number }
  > = {
    temple_green: {
      label: "Temple Green Shrine",
      hpPercent: 0.55,
      sicknessSeconds: 90,
    },
    north_gate: {
      label: "North Gate Checkpoint",
      hpPercent: 0.45,
      sicknessSeconds: 120,
    },
    player_house: {
      label: "Player House",
      hpPercent: 0.7,
      sicknessSeconds: 60,
    },
  };
  const rule = respawnRules[respawnId] ?? respawnRules.temple_green;
  const hpAfter = Math.max(1, Math.round(state.player.maxHp * rule.hpPercent));
  markDeathStateProtected(
    "Respawned",
    `You respawned at ${rule.label}. Protection ends early if you attack.`,
    20,
    rule.sicknessSeconds,
  );
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: rule.label,
      target: state.player.name,
      ability: "Respawn",
      result: "normal_hit",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: state.player.hp,
      targetHpAfter: hpAfter,
      detail: `You respawned at ${rule.label} with temporary protection and recovery sickness.`,
    }),
    player: {
      ...state.player,
      hp: hpAfter,
      combatState: "protected_after_respawn",
    },
  });
}

export function useHarthmereCombatState() {
  const [state, setState] = useState<HarthmereCombatState>(() =>
    readHarthmereCombatState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereCombatState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_COMBAT_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_COMBAT_EVENT, refresh);
    };
  }, []);

  return state;
}

function healthPercent(stats: HarthmereCombatStats) {
  return clamp(stats.hp / Math.max(1, stats.maxHp), 0, 1);
}

function CombatBar({ stats }: { stats: HarthmereCombatStats }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] text-white/80">
        <span className="truncate pr-2">{stats.name}</span>
        <span>
          {stats.hp}/{stats.maxHp}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/10">
        <div
          className="h-full rounded bg-red-400"
          style={{ width: percentage(healthPercent(stats)) }}
        />
      </div>
    </div>
  );
}

function latestTarget(state: HarthmereCombatState) {
  if (state.selectedNpcOffset === undefined) {
    return undefined;
  }
  return npcStatsFromState(state, state.selectedNpcOffset);
}

export function getHarthmereNpcCombatSummary(offset: number) {
  if (BOARD_OFFSETS.has(offset)) {
    return "The combat notices explain that violence is judged by target, witnesses, law, and consequence.";
  }
  const stats = npcStatsFromState(readHarthmereCombatState(), offset);
  if (stats.behavior === "guard") {
    return "They carry themselves like someone trained to answer violence immediately.";
  }
  if (stats.behavior === "merchant") {
    return "They are not looking for a fight, but they know how to reach the Watch quickly.";
  }
  if (stats.behavior === "passive") {
    return "They look ready to flee, not fight.";
  }
  if (stats.behavior === "hostile") {
    return "They look like a real threat, not a town bystander.";
  }
  return "They can be harmed like anyone else in the world, and the town will remember who started it.";
}

export function combatActionsForHarthmereNpc(
  offset: number,
): TalkDialogStepAction[] {
  const actions: TalkDialogStepAction[] = [];

  if (BOARD_OFFSETS.has(offset)) {
    actions.push({
      name: "Reset Harthmere combat",
      tooltip:
        "Clears the local-dev combat state so fights, injuries, and defeated targets can be tested again.",
      onPerformed: () => resetHarthmereCombat(),
    });
    return actions;
  }

  if (GUARD_YARD_OFFSETS.has(offset)) {
    actions.push({
      name: "Practice on the training dummy",
      type: "primary",
      tooltip:
        "Use a safe yard target to test attacks without hurting townspeople or drawing the Watch.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_TRAINING_DUMMY_OFFSET),
    });
    actions.push({
      name: "Make a heavy practice swing",
      tooltip: "Use a slower, harder strike on the training dummy.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_TRAINING_DUMMY_OFFSET, "heavy"),
    });
  }

  if (MUDDEN_THREAT_OFFSETS.has(offset)) {
    actions.push({
      name: "Clear a drain rat",
      type: actions.length ? undefined : "primary",
      tooltip:
        "Take care of a small Mudden Ward threat. Locals notice when someone helps the alleys stay safe.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_DRAIN_RAT_OFFSET),
    });
  }

  if (ROAD_THREAT_OFFSETS.has(offset)) {
    actions.push({
      name: "Go after a road bandit",
      type: actions.length ? undefined : "primary",
      tooltip:
        "Fight a hostile road threat instead of starting trouble with townspeople.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_ROAD_BANDIT_OFFSET),
    });
  }

  if (WILDLIFE_THREAT_OFFSETS.has(offset)) {
    actions.push({
      name: "Drive off a road wolf",
      type: actions.length ? undefined : "primary",
      tooltip: "Face hostile wildlife near the edge of town.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_ROAD_WOLF_OFFSET),
    });
  }

  if (offset === 37 || offset === 63 || offset === 64 || offset === 10) {
    actions.push({
      name: "Hunt a forest deer",
      type: actions.length ? undefined : "primary",
      tooltip: "Tests attackable wildlife that flees or defends instead of behaving like a town NPC.",
      onPerformed: () => performHarthmereCombatAttack(HARTHMERE_FOREST_DEER_OFFSET),
    });
    actions.push({
      name: "Fight a diseased boar",
      tooltip: "Tests a hostile animal target tied to forest/orchard resource danger.",
      onPerformed: () => performHarthmereCombatAttack(HARTHMERE_DISEASED_BOAR_OFFSET),
    });
    actions.push({
      name: "Fight a black bear",
      tooltip: "Tests a dangerous deep-forest animal target.",
      onPerformed: () => performHarthmereCombatAttack(HARTHMERE_BLACK_BEAR_OFFSET),
    });
  }

  actions.push({
    name: "Draw your weapon on them",
    tooltip:
      "Start a hostile action against this NPC. Guards, witnesses, friends, and faction memory may respond.",
    onPerformed: () => performHarthmereCombatAttack(offset),
  });

  return actions.slice(0, 4);
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2 text-[11px] text-white/75">
      <span>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export const HarthmereCombatHUD: React.FunctionComponent<{}> = () => {
  useHarthmereAmbientThreats();
  const state = useHarthmereCombatState();
  const target = useMemo(() => latestTarget(state), [state]);
  const latest = state.recent[0];

  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-red-300/30 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-red-200">
            Harthmere Combat
          </div>
          <div className="text-xs text-white/75">
            Weapon: {weaponStatusLabel()}
          </div>
        </div>
        <div className="rounded bg-red-300/20 px-1.5 py-0.5 text-xs font-semibold text-red-100">
          HP
        </div>
      </div>
      <div className="space-y-2">
        <CombatBar stats={state.player} />
        {target ? <CombatBar stats={target} /> : null}
      </div>
      {latest && (
        <div className="mt-2 rounded border border-white/10 bg-white/5 p-1.5 text-[11px] leading-snug text-white/80">
          <span className="font-semibold text-white">Latest:</span>{" "}
          {latest.detail}
        </div>
      )}
    </div>
  );
};

export const HarthmereCombatMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereCombatState();
  const target = latestTarget(state);
  const hitChance = target
    ? clamp(
        0.8 + state.player.accuracy / 100 - target.evasion / 100,
        0.05,
        0.95,
      )
    : undefined;

  return (
    <div className="pointer-events-auto mt-2 max-h-[55vh] w-[26rem] overflow-y-auto rounded-lg border border-red-300/25 bg-black/75 p-3 text-white shadow-xl">
      <div className="mb-2">
        <div className="text-base font-bold text-red-200">Harthmere Combat</div>
        <div className="text-xs text-white/75">
          Local-dev combat follows the MMO pipeline: target check, range check,
          hit check, defense, damage, effects, death, credit, and consequences.
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 rounded border border-white/10 bg-white/5 p-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-white">Player</div>
          <StatLine
            label="HP"
            value={`${state.player.hp}/${state.player.maxHp}`}
          />
          <StatLine label="Weapon" value={weaponStatusLabel()} />
          <StatLine label="Base Attack" value={state.player.attackPoints} />
          <StatLine label="Armor" value={state.player.armor} />
          <StatLine
            label="Crit"
            value={percentage(state.player.criticalChance)}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-white">Target</div>
          {target ? (
            <>
              <StatLine label="Name" value={target.name} />
              <StatLine label="HP" value={`${target.hp}/${target.maxHp}`} />
              <StatLine label="Attack" value={target.attackPoints} />
              <StatLine label="Behavior" value={target.behavior} />
              {hitChance !== undefined && (
                <StatLine label="Hit Chance" value={percentage(hitChance)} />
              )}
            </>
          ) : (
            <div className="text-[11px] text-white/70">
              Talk to an NPC and inspect or attack to select a target.
            </div>
          )}
        </div>
      </div>

      <div className="mb-2 space-y-1 text-xs leading-snug text-white/80">
        <div>
          <span className="font-semibold text-white">Validation:</span> dead,
          immune, invalid, and already defeated targets fail before damage.
        </div>
        <div>
          <span className="font-semibold text-white">Damage:</span> Attack
          Points + equipped weapon × ability multiplier × variance ×
          crit/glance/crush × defense reduction.
        </div>
        <div>
          <span className="font-semibold text-white">NPC behavior:</span> guards,
          hostiles, merchants, defensive civilians, and dangerous animals can
          retaliate; passive targets flee, and training dummies never retaliate.
        </div>
        <div>
          <span className="font-semibold text-white">Consequences:</span>{" "}
          attacking civilians or guards changes Harthmere
          legal/likeability/notoriety.
        </div>
      </div>

      <div className="mb-2 flex gap-2">
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
          onClick={() => reviveHarthmerePlayer()}
        >
          Revive Player
        </button>
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
          onClick={() => resetHarthmereCombat()}
        >
          Reset Combat
        </button>
      </div>

      <div className="space-y-1">
        {state.recent.slice(0, 6).map((event) => (
          <div
            key={event.id}
            className="rounded border border-white/10 bg-black/20 p-2 text-xs"
          >
            <div className="font-semibold text-white">
              {event.ability} — {event.result.replaceAll("_", " ")}
            </div>
            <div className="text-white/70">{event.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
