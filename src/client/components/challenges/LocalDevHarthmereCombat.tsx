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

const HARTHMERE_NO_SPARK_BASIC_ACTOR_MATCH_VERSION = "harthmere-no-spark-basic-actor-match-v11";
const HARTHMERE_FIX_BAD_INLINE_CONST_VERSION = "harthmere-fix-bad-inline-const-v1";

const HARTHMERE_COMBAT_STATE_KEY = "biomes.localDev.harthmere.combatState.v1";
const HARTHMERE_COMBAT_EVENT = "biomes:harthmere-combat-changed";
export const HARTHMERE_COMBAT_EFFECT_EVENT = "biomes:harthmere-combat-effect";
const HARTHMERE_DEATH_STATE_KEY = "biomes.localDev.harthmere.deathState.v1";
const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";
const HARTHMERE_INVENTORY_STATE_KEY =
  "biomes.localDev.harthmere.inventoryState.v1";
const HARTHMERE_COMBAT_RULESET_REVISION =
  "harthmere-death-ai-dialog-render-v1";

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
  species?: "human" | "animal" | "undead" | "construct";
  socialRole?:
    | "guard"
    | "merchant"
    | "civilian"
    | "child"
    | "hostile"
    | "wildlife"
    | "training"
    | "quest_anchor";
  deathAnimationUntil?: number;
  corpseUntil?: number;
  respawnAt?: number;
  lastDamageAt?: number;
  lastCombatEvent?: "attack" | "hit" | "death" | "flee";
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
  targetOffset?: number;
  attackerOffset?: number;
  attackerClipPriority?: string[];
  targetClipPriority?: string[];
  animationKind?: "attack" | "hit" | "block" | "evade" | "death" | "magic";
  effectKind?: "physical" | "magic";
  vfxKind?: "physical" | "magic";
  visualKind?: "physical" | "magic";
  harthmereNoSparkBasic?: boolean;
}

// harthmere-game-ai-state-machine-v1
// Lightweight in-game AI brain memory. This intentionally avoids a new npm
// dependency while giving us the same structure a behavior-tree/state-machine
// library would provide: aggro memory, chase intent, windup, attack, recovery,
// disengage, and death handling. Future maintainers can swap this for XState or
// Yuka later because all transitions are isolated behind helper functions below.
type HarthmereNpcBrainPhase =
  | "idle"
  | "alert"
  | "pursuing"
  | "windup"
  | "attacking"
  | "recovering"
  | "retreating"
  | "disengaged"
  | "dead";

interface HarthmereNpcBrainMemory {
  phase: HarthmereNpcBrainPhase;
  target: "player";
  aggroUntil: number;
  firstAggroAt: number;
  lastThinkAt: number;
  lastDamagedByPlayerAt: number;
  lastDamageToPlayerAt?: number;
  nextAttackAt: number;
  recoverUntil: number;
  threat: number;
  reason: string;
  lastKnownPlayerPos?: [number, number];
}

interface HarthmereCombatState {
  rulesetRevision?: string;
  player: HarthmereCombatStats;
  npcs: Record<string, HarthmereCombatStats>;
  selectedNpcOffset?: number;
  recent: HarthmereCombatLogEntry[];
  killCredit: Record<string, number>;
  lastNpcAttackAt?: Record<string, number>;
  reputationLocks?: Record<string, number>;
  // harthmere-game-ai-state-machine-v1
  // Per-NPC combat brain memory. It is persisted with the local-dev combat
  // state so reloads and rapid React remounts do not erase who is angry,
  // chasing, winding up, or recovering.
  npcBrains?: Record<string, HarthmereNpcBrainMemory>;
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
const CHILD_OFFSETS = new Set([52, 66]);

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


type HarthmereCombatDebugStage =
  | "combat.effect.emit"
  | "combat.attack.start"
  | "combat.attack.after_player"
  | "combat.countercheck"
  | "combat.counterattack"
  | "combat.write_state"
  | "combat.bridge.install"
  | "forward_arc.start"
  | "forward_arc.hit"
  | "forward_arc.miss"
  | "forward_arc.selected_rejected"
  | "forward_arc.actor_registry"
  | "forward_arc.nearest"
  | "combat.attack.resolved"
  | "combat.counter_skip"
  | "combat.ai.tick"
  | "combat.ai.range_skip"
  | "fight.geometry_contact"
  | "fight.direct_damage"
  | "fight.engagement"
  | "fight.ai.retaliate"
  | "fight.ai.skip"
  | "fight.summary";

function harthmereCombatDebugEnabled() {
  return (
    isBrowser() &&
    window.localStorage.getItem("biomes.localDev.harthmere.combatDebug") === "1"
  );
}

function debugHarthmereCombat(
  stage: HarthmereCombatDebugStage | string,
  payload: Record<string, unknown>,
) {
  if (!harthmereCombatDebugEnabled()) {
    return;
  }
  const entry = { at: Date.now(), stage, ...payload };
  const win = window as typeof window & {
    __harthmereCombatDebugLog?: unknown[];
  };
  win.__harthmereCombatDebugLog = [
    entry,
    ...(win.__harthmereCombatDebugLog ?? []),
  ].slice(0, 200);
  console.info("[HarthmereCombat]", stage, payload);
  window.dispatchEvent(
    new CustomEvent("biomes:harthmere-combat-debug", { detail: entry }),
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

function finalizeNpcStats(
  offset: number,
  stats: HarthmereCombatStats,
  species: HarthmereCombatStats["species"],
  socialRole: HarthmereCombatStats["socialRole"],
): HarthmereCombatStats {
  const maxHp = Math.max(1, Math.round(Number(stats.maxHp || stats.hp || 1)));
  const hp = clamp(Math.round(Number(stats.hp || maxHp)), 0, maxHp);
  return {
    ...stats,
    name: stats.name || NPC_NAMES[offset] || `Harthmere NPC ${offset}`,
    maxHp,
    hp,
    species,
    socialRole,
    attackable: BOARD_OFFSETS.has(offset) ? false : stats.attackable,
    combatState: hp <= 0 ? "dead" : stats.combatState,
  };
}

function statsForOffset(offset: number): HarthmereCombatStats {
  if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET) {
    return finalizeNpcStats(offset, {
      name: NPC_NAMES[offset],
      level: 1,
      faction: "training",
      behavior: "training_dummy",
      hp: 650,
      maxHp: 650,
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
    }, "construct", "training");
  }

  if (offset === HARTHMERE_DRAIN_RAT_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 3, "wildlife", 140, 14, 15, 7, 1.6), "animal", "hostile");
  }
  if (offset === HARTHMERE_ROAD_BANDIT_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 7, "bandit", 520, 62, 80, 14, 2.2), "human", "hostile");
  }
  if (offset === HARTHMERE_ROAD_WOLF_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 5, "wildlife", 340, 35, 45, 10, 1.9), "animal", "hostile");
  }
  if (offset === HARTHMERE_AMBIENT_BANDIT_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 8, "bandit", 560, 58, 75, 13, 2.2), "human", "hostile");
  }
  if (offset === HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 6, "undead", 460, 44, 60, 4, 1.65), "undead", "hostile");
  }
  if (offset === HARTHMERE_FOREST_DEER_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 3, "wildlife", 240, 18, 20, 18, 1.7, "defensive"), "animal", "wildlife");
  }
  if (offset === HARTHMERE_DISEASED_BOAR_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 5, "wildlife", 420, 42, 55, 8, 1.8, "hostile"), "animal", "hostile");
  }
  if (offset === HARTHMERE_BLACK_BEAR_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 9, "wildlife", 820, 88, 120, 5, 2.1, "hostile"), "animal", "hostile");
  }
  if (offset === HARTHMERE_FOREST_WOLF_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 6, "wildlife", 390, 52, 42, 15, 1.9, "hostile"), "animal", "hostile");
  }
  if (offset === HARTHMERE_BRIARFEN_SNAKE_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 4, "wildlife", 190, 31, 18, 22, 1.4, "hostile"), "animal", "hostile");
  }
  if (offset === HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET) {
    return finalizeNpcStats(offset, wildlifeStats(offset, 7, "undead_wildlife", 470, 58, 60, 14, 1.9, "hostile"), "undead", "hostile");
  }
  if (offset === HARTHMERE_BANDIT_TRAPPER_OFFSET) {
    return finalizeNpcStats(offset, hostileStats(offset, 8, "bandit", 580, 64, 72, 16, 2.4), "human", "hostile");
  }

  const runtimeActorStats = statsForRuntimeCombatActor(offset);
  if (runtimeActorStats) {
    return runtimeActorStats;
  }

  if (BOARD_OFFSETS.has(offset)) {
    return finalizeNpcStats(offset, {
      name: NPC_NAMES[offset] ?? `Notice Board ${offset}`,
      level: 1,
      faction: "harthmere_public_object",
      behavior: "quest_anchor",
      hp: 9999,
      maxHp: 9999,
      attackPoints: 0,
      defense: 999,
      armor: 999,
      magicResistance: 999,
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
      combatState: "invulnerable",
      attackable: false,
    }, "construct", "quest_anchor");
  }

  if (GUARD_OFFSETS.has(offset)) {
    return finalizeNpcStats(offset, {
      name: NPC_NAMES[offset] ?? `Guard ${offset}`,
      level: 15,
      faction: "town_watch",
      behavior: "guard",
      hp: 1100,
      maxHp: 1100,
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
      aggroRange: 18,
      leashRange: 55,
      threatValue: 400,
      combatState: "idle",
      attackable: true,
    }, "human", "guard");
  }

  if (MERCHANT_OFFSETS.has(offset)) {
    return finalizeNpcStats(offset, {
      name: NPC_NAMES[offset] ?? `Merchant ${offset}`,
      level: 8,
      faction: "harthmere_citizen",
      behavior: "merchant",
      hp: 320,
      maxHp: 320,
      attackPoints: 24,
      defense: 65,
      armor: 50,
      magicResistance: 50,
      accuracy: 2,
      evasion: 4,
      criticalChance: 0.02,
      criticalDamage: 1.25,
      attackSpeed: 0.55,
      attackRange: 1.5,
      movementSpeed: 3.4,
      aggroRange: 0,
      leashRange: 18,
      threatValue: 40,
      combatState: "idle",
      attackable: true,
    }, "human", "merchant");
  }

  if (CIVILIAN_OFFSETS.has(offset)) {
    const isChild = CHILD_OFFSETS.has(offset);
    return finalizeNpcStats(offset, {
      name: NPC_NAMES[offset] ?? `Citizen ${offset}`,
      level: isChild ? 3 : 5,
      faction: "harthmere_citizen",
      behavior: isChild ? "passive" : "defensive",
      hp: isChild ? 150 : 260,
      maxHp: isChild ? 150 : 260,
      attackPoints: isChild ? 0 : 16,
      defense: isChild ? 20 : 38,
      armor: isChild ? 10 : 26,
      magicResistance: isChild ? 20 : 25,
      accuracy: isChild ? 0 : 1,
      evasion: isChild ? 14 : 5,
      criticalChance: 0.01,
      criticalDamage: 1.15,
      attackSpeed: 0.45,
      attackRange: 1.3,
      movementSpeed: 3.6,
      aggroRange: 0,
      leashRange: 12,
      threatValue: 10,
      combatState: "idle",
      attackable: true,
    }, "human", isChild ? "child" : "civilian");
  }

  return finalizeNpcStats(offset, {
    name: NPC_NAMES[offset] ?? `Harthmere NPC ${offset}`,
    level: 6,
    faction: "harthmere_citizen",
    behavior: "defensive",
    hp: 240,
    maxHp: 240,
    attackPoints: 14,
    defense: 32,
    armor: 24,
    magicResistance: 24,
    accuracy: 0,
    evasion: 4,
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
  }, "human", "civilian");
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
  // Keep bad persisted runtime actor values from creating giant invisible
  // health bars that make it look like damage is not changing.
  merged.maxHp = Math.max(1, Math.round(Number(merged.maxHp || fallback.maxHp || 1)));
  const rawHp = Number.isFinite(Number(merged.hp)) ? Number(merged.hp) : merged.maxHp;
  merged.hp = clamp(Math.round(rawHp), 0, merged.maxHp);
  merged.attackPoints = Math.max(0, Math.round(Number(merged.attackPoints ?? fallback.attackPoints ?? 0)));
  merged.defense = Math.max(0, Math.round(Number(merged.defense ?? fallback.defense ?? 0)));
  merged.armor = Math.max(0, Math.round(Number(merged.armor ?? fallback.armor ?? 0)));
  merged.magicResistance = Math.max(0, Math.round(Number(merged.magicResistance ?? fallback.magicResistance ?? 0)));
  if (merged.hp <= 0) {
    merged.combatState = "dead";
  } else if (merged.combatState === "dead" || merged.combatState === "respawning") {
    merged.combatState = "idle";
  }
  return merged;
}

function normalizeState(
  parsed: Partial<HarthmereCombatState> | undefined,
): HarthmereCombatState {

  // Brain memory is a runtime aid, not permanent progression. Drop entries for
  // actors that no longer exist or have gone stale so old aggro cannot haunt a
  // fresh test session.
  const normalizeBrains = (
    raw: Record<string, HarthmereNpcBrainMemory> | undefined,
    liveNpcs: Record<string, HarthmereCombatStats>,
  ): Record<string, HarthmereNpcBrainMemory> => {
    const now = Date.now();
    const out: Record<string, HarthmereNpcBrainMemory> = {};
    for (const [key, brain] of Object.entries(raw ?? {})) {
      const npc = liveNpcs[key];
      if (!npc || !brain || typeof brain !== "object") {
        continue;
      }
      if (npc.hp <= 0 || npc.combatState === "dead") {
        out[key] = { ...brain, phase: "dead", aggroUntil: 0 };
        continue;
      }
      if (Number(brain.aggroUntil ?? 0) > now - 10_000) {
        out[key] = {
          phase: brain.phase ?? "idle",
          target: "player",
          aggroUntil: Number(brain.aggroUntil ?? 0),
          firstAggroAt: Number(brain.firstAggroAt ?? now),
          lastThinkAt: Number(brain.lastThinkAt ?? 0),
          lastDamagedByPlayerAt: Number(brain.lastDamagedByPlayerAt ?? 0),
          lastDamageToPlayerAt: Number(brain.lastDamageToPlayerAt ?? 0) || undefined,
          nextAttackAt: Number(brain.nextAttackAt ?? 0),
          recoverUntil: Number(brain.recoverUntil ?? 0),
          threat: Math.max(0, Number(brain.threat ?? 0)),
          reason: String(brain.reason ?? "normalized"),
          lastKnownPlayerPos: Array.isArray(brain.lastKnownPlayerPos)
            ? [Number(brain.lastKnownPlayerPos[0]), Number(brain.lastKnownPlayerPos[1])]
            : undefined,
        };
      }
    }
    return out;
  };
  if (parsed && parsed.rulesetRevision !== HARTHMERE_COMBAT_RULESET_REVISION) {
    return normalizeState(undefined);
  }

  const npcs: Record<string, HarthmereCombatStats> = {};
  for (const [key, stats] of Object.entries(parsed?.npcs ?? {})) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      const fallback = scaleHarthmereNpcCombatStats(statsForOffset(offset), offset);
      const normalized = normalizeStats(stats, fallback);
      const respawnAt = Number((stats as HarthmereCombatStats | undefined)?.respawnAt ?? 0);
      if (normalized.combatState === "dead" && respawnAt > 0 && Date.now() >= respawnAt) {
        npcs[key] = { ...fallback, hp: fallback.maxHp, combatState: "idle" };
      } else {
        npcs[key] = normalized;
      }
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
    lastNpcAttackAt: parsed?.lastNpcAttackAt ?? {},
    reputationLocks: parsed?.reputationLocks ?? {},
    npcBrains: normalizeBrains(parsed?.npcBrains, npcs),
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
  const selectedNpc = state.selectedNpcOffset !== undefined
    ? state.npcs[String(state.selectedNpcOffset)]
    : undefined;
  debugHarthmereCombat("combat.write_state", {
    // Keep this summary flat so browser logs show HP changes without needing to
    // expand nested objects in DevTools.
    summary: `player=${state.player.hp}/${state.player.maxHp} ${state.player.combatState}` +
      (selectedNpc
        ? ` selected=${selectedNpc.name} ${selectedNpc.hp}/${selectedNpc.maxHp} ${selectedNpc.combatState}`
        : " selected=none"),
    playerHp: state.player.hp,
    playerMaxHp: state.player.maxHp,
    playerState: state.player.combatState,
    selectedNpcOffset: state.selectedNpcOffset,
    selectedNpcHp: selectedNpc?.hp,
    selectedNpcMaxHp: selectedNpc?.maxHp,
    selectedNpcState: selectedNpc?.combatState,
    latest: state.recent[0]
      ? {
          ability: state.recent[0].ability,
          result: state.recent[0].result,
          finalDamage: state.recent[0].finalDamage,
          targetHpBefore: state.recent[0].targetHpBefore,
          targetHpAfter: state.recent[0].targetHpAfter,
          target: state.recent[0].target,
        }
      : undefined,
  });
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_COMBAT_STATE_KEY),
    JSON.stringify(normalizeState(state)),
  );
  combatEvent();
}

function emitHarthmereCombatEffect(entry: HarthmereCombatLogEntry) {
  if (!isBrowser()) {
    return;
  }
  debugHarthmereCombat("combat.effect.emit", { entry });
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
      detail: entry,
    }),
  );
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


function uniqueClipPriority(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

function playerAttackClipPriority(ability: string, detail = "") {
  const text = `${ability} ${detail}`.toLowerCase();
  if (/spark|magic|spell|arcane/.test(text)) {
    return ["BasicMagic", "HeavyMagic", "Attack", "Attack2"];
  }
  if (/heavy|power|crushing|smash/.test(text)) {
    return ["HeavyAttack", "Attack2", "SideSwing", "Thrusting", "Attack"];
  }
  if (/bow|arrow|shoot|ranged/.test(text)) {
    return ["BowShoot", "BowShooting", "Attack"];
  }
  if (/thrust|spear/.test(text)) {
    return ["Thrusting", "Attack", "Attack2"];
  }
  return ["Attack", "Attack2", "SideSwing", "Thrusting", "HeavyAttack"];
}

function npcAttackClipPriority(ability: string, attackerName = "", detail = "") {
  const text = `${ability} ${attackerName} ${detail}`.toLowerCase();
  if (/bite/.test(text)) {
    return ["Bite", "Attack", "Pounce", "Claw"];
  }
  if (/claw/.test(text)) {
    return ["Claw", "Scratch", "Attack", "Bite"];
  }
  if (/pounce/.test(text)) {
    return ["Pounce", "Charge", "Attack", "Bite"];
  }
  if (/charge|boar|stag|deer|bear/.test(text)) {
    return ["Charge", "Pounce", "Attack", "HeavyAttack"];
  }
  if (/peck|crow|pigeon|chicken|bird/.test(text)) {
    return ["Peck", "Attack", "Scratch"];
  }
  if (/scratch|rat|cat|fox/.test(text)) {
    return ["Scratch", "Bite", "Attack", "Claw"];
  }
  if (/kick|horse|cow|goat|sheep/.test(text)) {
    return ["Kick", "Charge", "Attack"];
  }
  if (/tail/.test(text)) {
    return ["TailWhip", "Attack"];
  }
  if (/guard|riposte|counter|bandit|zombie|undead|human|watch/.test(text)) {
    return ["Attack", "SideSwing", "Attack2", "Thrusting", "HeavyAttack"];
  }
  return ["Attack", "Bite", "Claw", "Pounce", "Charge", "Scratch", "Peck", "Kick", "TailWhip", "HeavyAttack"];
}

function isHarthmerePhysicalCombatEventText(value: string) {
  const text = value.toLowerCase();
  if (/(spark|basicmagic|heavymagic|magic|spell|arcane)/i.test(text)) {
    return false;
  }
  return /basic|heavy|dagger|strike|slash|swing|thrust|punch|kick|stab|bow|arrow|melee|weapon|hit|bite|claw|pounce|charge|peck|scratch|tail/.test(text);
}

// harthmere-death-ai-dialog-render-v1
// Forward-arc miss / evade events use placeholder HP values because there is no
// concrete target. Earlier builds interpreted targetHpAfter=0 on those placeholder
// entries as a real death and marked unrelated actors dead in the renderer. Only a
// real dead result, or a damaging hit that actually lowered a concrete target to
// zero HP, is allowed to route to Death.
function shouldHarthmereTargetPlayDeathPulse(
  result: HitResult,
  targetHpAfter: number,
  finalDamage: number,
) {
  return (
    result === "dead" ||
    (finalDamage > 0 && Number.isFinite(targetHpAfter) && targetHpAfter <= 0)
  );
}

function targetReactionClipPriority(result: HitResult, targetHpAfter: number, ability = "", detail = "", finalDamage = 0) {
  const text = `${ability} ${detail}`.toLowerCase();
  const shouldPlayDeath =
    shouldHarthmereTargetPlayDeathPulse(result, targetHpAfter, finalDamage) ||
    /death check|defeated/.test(text);
  if (shouldPlayDeath) {
    return ["Death", "Fall", "Falling", "Stunned"];
  }
  if (result === "block" || result === "absorb") {
    return ["Block", "ShieldBlock", "HitReact", "Stunned"];
  }
  if (result === "parry") {
    return ["ShieldBlock", "Block", "HitReact"];
  }
  if (result === "dodge" || result === "evade" || result === "out_of_range") {
    return ["Dodging", "Sidestep", "SidestepLeft", "SidestepRight", "Flee", "Run"];
  }
  if (result === "miss" || result === "invalid_target" || result === "immune") {
    return ["Idle", "LookAround"];
  }
  return ["HitReact", "Stunned", "Block", "ShieldBlock"];
}

function enrichCombatAnimationMetadata(
  state: HarthmereCombatState,
  entry: Omit<HarthmereCombatLogEntry, "id" | "at">,
): Omit<HarthmereCombatLogEntry, "id" | "at"> {
  const selectedOffset = state.selectedNpcOffset;
  const selectedNpc = selectedOffset !== undefined
    ? state.npcs[String(selectedOffset)] ?? npcStatsFromState(state, selectedOffset)
    : undefined;
  const playerNames = new Set([state.player.name, "You", "Player"]);
  const attackerIsPlayer = playerNames.has(entry.attacker);
  const targetIsPlayer = playerNames.has(entry.target);
  const attackerIsSelectedNpc = Boolean(selectedNpc && entry.attacker === selectedNpc.name);
  const targetIsSelectedNpc = Boolean(selectedNpc && entry.target === selectedNpc.name);

  const attackerOffset = entry.attackerOffset ?? (attackerIsSelectedNpc ? selectedOffset : undefined);
  const targetOffset = entry.targetOffset ?? (targetIsSelectedNpc ? selectedOffset : undefined);
  const attackerClipPriority = entry.attackerClipPriority ?? uniqueClipPriority(
    attackerIsPlayer
      ? playerAttackClipPriority(entry.ability, entry.detail)
      : npcAttackClipPriority(entry.ability, entry.attacker, entry.detail),
  );
  const targetClipPriority = entry.targetClipPriority ?? uniqueClipPriority(
    targetReactionClipPriority(entry.result, entry.targetHpAfter, entry.ability, entry.detail, entry.finalDamage),
  );

  const animationKind = entry.animationKind ?? (
    shouldHarthmereTargetPlayDeathPulse(entry.result, entry.targetHpAfter, entry.finalDamage)
      ? "death"
      : entry.result === "dodge" || entry.result === "evade" || entry.result === "out_of_range"
        ? "evade"
        : entry.result === "block" || entry.result === "parry" || entry.result === "absorb"
          ? "block"
          : /spark|magic|spell|arcane/i.test(entry.ability)
            ? "magic"
            : "attack"
  );

  return {
    ...entry,
    attackerOffset,
    targetOffset,
attackerClipPriority:
      entry.ability === "basic" || entry.ability === "heavy"
        ? attackerClipPriority.filter(
            (clip) =>
              !/basicmagic|heavymagic|spark|spell|arcane/i.test(String(clip))
          )
        : attackerClipPriority,
    effectKind: isHarthmerePhysicalCombatEventText(`${entry.ability} ${entry.detail}`) ? "physical" : undefined,
    vfxKind: isHarthmerePhysicalCombatEventText(`${entry.ability} ${entry.detail}`) ? "physical" : undefined,
    targetClipPriority,
    animationKind,
    detail: `${entry.detail} [GLTF: ${attackerClipPriority[0] ?? "Attack"} → ${targetClipPriority[0] ?? "HitReact"}]`,
  };
}

function appendCombatLog(
  state: HarthmereCombatState,
  entry: Omit<HarthmereCombatLogEntry, "id" | "at">,
): HarthmereCombatState {
  const loggedAt = Date.now();
  const enrichedEntry = enrichCombatAnimationMetadata(state, entry);
  const loggedEntry: HarthmereCombatLogEntry = {
    ...enrichedEntry,
    id: `${loggedAt}-${Math.floor(Math.random() * 1_000_000)}`,
    at: loggedAt,
  };
  emitHarthmereCombatEffect(loggedEntry);
  return {
    ...state,
    recent: [loggedEntry, ...state.recent].slice(0, 12),
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


// harthmere-full-fight-system-v1
// Action combat must not feel like a tabletop roll after the weapon already
// intersected a target. Geometry decides whether the swing connected; this
// resolver only decides whether that contact was normal, blocked, glancing,
// crushing, or critical. It deliberately never returns miss/dodge/parry for
// melee contacts, because those zero-damage outcomes made NPC HP appear broken.
function rollHarthmereContactHitResult(
  attacker: HarthmereCombatStats,
  defender: HarthmereCombatStats,
  ability: CombatAbility,
): HitResult {
  if (!defender.attackable) {
    return "immune";
  }
  if (defender.combatState === "dead" || defender.hp <= 0) {
    return "dead";
  }
  if (defender.combatState === "evading") {
    return "evade";
  }

  if (
    ability.canBeBlocked &&
    ["guard", "training_dummy"].includes(defender.behavior) &&
    Math.random() < (defender.behavior === "guard" ? 0.18 : 0.08)
  ) {
    return "block";
  }

  if (
    ability.canCrit &&
    Math.random() < clamp(attacker.criticalChance, 0, 0.55)
  ) {
    return "critical_hit";
  }

  if (attacker.level >= defender.level + 8 && Math.random() < 0.1) {
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

function npcRespawnDelayMs(target: HarthmereCombatStats) {
  if (target.behavior === "training_dummy") {
    return 20_000;
  }
  if (target.behavior === "guard") {
    return 5 * 60_000;
  }
  if (target.behavior === "merchant") {
    return 3 * 60_000;
  }
  if (target.behavior === "hostile") {
    return target.species === "animal" ? 90_000 : 2 * 60_000;
  }
  return 90_000;
}

function applyAttack(
  state: HarthmereCombatState,
  attacker: HarthmereCombatStats,
  target: HarthmereCombatStats,
  ability: CombatAbility,
  targetIsPlayer: boolean,
  targetOffset?: number,
  attackerOffset?: number,
  forcedHitResult?: HitResult,
): {
  state: HarthmereCombatState;
  updatedAttacker: HarthmereCombatStats;
  updatedTarget: HarthmereCombatStats;
  result: HitResult;
  finalDamage: number;
} {
  const result = forcedHitResult ?? rollHitResult(attacker, target, ability);
  const { rawDamage, mitigatedDamage, finalDamage } = calculateDamage(
    attacker,
    target,
    ability,
    result,
  );
  const targetHpBefore = target.hp;
  let updatedTarget: HarthmereCombatStats = {
    ...target,
    hp: clamp(target.hp - finalDamage, 0, target.maxHp),
    combatState: finalDamage > 0 ? "in_combat" : target.combatState,
    lastDamageAt: finalDamage > 0 ? Date.now() : target.lastDamageAt,
    lastCombatEvent: finalDamage > 0 ? "hit" : target.lastCombatEvent,
  };
  if (updatedTarget.hp <= 0) {
    const respawnDelay = npcRespawnDelayMs(updatedTarget);
    updatedTarget = {
      ...updatedTarget,
      hp: 0,
      combatState: "dead",
      lastCombatEvent: "death",
      deathAnimationUntil: Date.now() + 2200,
      corpseUntil: Date.now() + respawnDelay,
      respawnAt: Date.now() + respawnDelay,
    };
  }

  const updatedAttacker: HarthmereCombatStats = {
    ...attacker,
    combatState: attacker.combatState === "dead" ? "dead" : "in_combat",
    lastCombatEvent: "attack",
  };

  const detail =
    finalDamage > 0
      ? `${attacker.name} ${resultLabel(result)} ${target.name} with ${ability.name} for ${finalDamage} damage.`
      : `${attacker.name}'s ${ability.name} ${resultLabel(result)} ${target.name}.`;

  const nextState = appendCombatLog(state, {
    attacker: attacker.name,
    target: target.name,
    ability: ability.name,
    result: updatedTarget.combatState === "dead" ? "dead" : result,
    rawDamage,
    mitigatedDamage,
    finalDamage,
    targetHpBefore,
    targetHpAfter: updatedTarget.hp,
    detail,
    targetOffset,
    attackerOffset,
  });

  debugHarthmereCombat("combat.attack.resolved", {
    summary: `${attacker.name} -> ${target.name} ${ability.name}: ${result} damage=${finalDamage} hp=${targetHpBefore}->${updatedTarget.hp}`,
    attacker: attacker.name,
    target: target.name,
    ability: ability.name,
    result,
    targetIsPlayer,
    rawDamage,
    mitigatedDamage,
    finalDamage,
    targetHpBefore,
    targetHpAfter: updatedTarget.hp,
    targetOffset,
    attackerOffset,
    forcedHitResult,
  });

  return {
    state: targetIsPlayer ? { ...nextState, player: updatedTarget } : nextState,
    updatedAttacker,
    updatedTarget,
    result,
    finalDamage,
  };
}

function rememberHarthmereReputationLock(lockKey: string, cooldownMs: number) {
  if (!isBrowser()) {
    return true;
  }
  const storageKey = harthmereUserScopedStorageKey(
    `biomes.localDev.harthmere.reputationLock.${lockKey}`,
  );
  const now = Date.now();
  const last = Number(window.localStorage.getItem(storageKey) ?? "0");
  if (last > 0 && now - last < cooldownMs) {
    return false;
  }
  window.localStorage.setItem(storageKey, String(now));
  return true;
}

function reputationForIllegalAttack(
  target: HarthmereCombatStats,
  offset: number,
) {
  if (target.behavior === "training_dummy" || target.behavior === "hostile") {
    return;
  }
  if (!rememberHarthmereReputationLock(`assault-${offset}`, 60_000)) {
    return;
  }

  const isGuard = target.behavior === "guard";
  const isChild = target.socialRole === "child" || CHILD_OFFSETS.has(offset);
  const isMerchant = target.behavior === "merchant";
  const isAnimal = target.species === "animal";
  const legalPenalty = isGuard
    ? -900
    : isChild
      ? -1200
      : isMerchant
        ? -350
        : isAnimal
          ? -80
          : -240;
  const likePenalty = isGuard
    ? -220
    : isChild
      ? -1100
      : isMerchant
        ? -320
        : isAnimal
          ? -75
          : -220;
  const notorietyGain = isGuard ? 180 : isChild ? 300 : isMerchant ? 80 : 45;

  applyHarthmereReputationChange({
    label: isGuard
      ? "Assaulted a town guard"
      : isChild
        ? "Attacked a vulnerable Harthmere local"
        : isMerchant
          ? "Attacked a Harthmere merchant"
          : isAnimal
            ? "Attacked protected local wildlife"
            : "Attacked a Harthmere local",
    detail: isGuard
      ? "The Watch treats assaulting guards as a serious crime. Witnesses spread it quickly."
      : isChild
        ? "Violence against vulnerable townsfolk severely damages trust and legal standing."
        : isMerchant
          ? "Assaulting merchants damages both town trust and Harthmere's local economy."
          : isAnimal
            ? "Poaching or abusing protected animals makes locals distrust you."
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

function reputationForKilledNpc(
  target: HarthmereCombatStats,
  offset: number,
) {
  if (target.behavior === "training_dummy" || target.behavior === "hostile") {
    return;
  }
  if (!rememberHarthmereReputationLock(`kill-${offset}`, 10 * 60_000)) {
    return;
  }

  const isGuard = target.behavior === "guard";
  const isChild = target.socialRole === "child" || CHILD_OFFSETS.has(offset);
  const isMerchant = target.behavior === "merchant";
  const isAnimal = target.species === "animal";
  const legalPenalty = isGuard
    ? -3200
    : isChild
      ? -4200
      : isMerchant
        ? -1900
        : isAnimal
          ? -300
          : -1400;
  const likePenalty = isGuard
    ? -900
    : isChild
      ? -3500
      : isMerchant
        ? -1250
        : isAnimal
          ? -220
          : -950;
  const notorietyGain = isGuard ? 900 : isChild ? 1200 : isMerchant ? 420 : isAnimal ? 80 : 260;

  applyHarthmereReputationChange({
    label: isGuard
      ? "Killed a town guard"
      : isChild
        ? "Killed a vulnerable Harthmere local"
        : isMerchant
          ? "Killed a Harthmere merchant"
          : isAnimal
            ? "Killed protected wildlife"
            : "Killed a Harthmere local",
    detail: isGuard
      ? "Killing a guard is treated as murder of a legal officer. You are moving toward outlaw status."
      : isChild
        ? "This is one of the worst crimes Harthmere can witness. Likeability and legal standing collapse."
        : isMerchant
          ? "Murdering a merchant damages public trust, legal standing, and the town economy."
          : isAnimal
            ? "Locals treat needless killing of protected wildlife as poaching and cruelty."
            : "Murdering locals makes the town fear and hate you, and the law responds accordingly.",
    npcOffset: offset,
    harthmere: {
      likeability: likePenalty,
      legal: legalPenalty,
      notoriety: notorietyGain,
    },
    global: notorietyGain >= 400 ? { notoriety: Math.floor(notorietyGain / 4) } : undefined,
    personal: { likeability: likePenalty, legal: legalPenalty },
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

  const ambientAbility = { ...NPC_BASIC_ATTACK, name: source };
  const forcedAmbientHitResult = rollHarthmereContactHitResult(
    { ...attacker, combatState: "in_combat" },
    player,
    ambientAbility,
  );
  const attack = applyAttack(
    state,
    { ...attacker, combatState: "in_combat" },
    player,
    ambientAbility,
    true,
    undefined,
    targetOffset,
    forcedAmbientHitResult,
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

function canNpcRunRealtimeCombat(npc: HarthmereCombatStats) {
  return (
    npc.attackable &&
    npc.hp > 0 &&
    npc.combatState !== "dead" &&
    npc.attackPoints > 0 &&
    ["guard", "hostile", "defensive", "merchant"].includes(npc.behavior)
  );
}

function npcRealtimeAttackCadenceMs(npc: HarthmereCombatStats) {
  const attacksPerSecond = Math.max(0.35, npc.attackSpeed);
  return clamp(Math.round(2400 / attacksPerSecond), 850, 4200);
}

function npcRealtimeAbility(npc: HarthmereCombatStats): CombatAbility {
  const text = `${npc.name} ${npc.faction} ${npc.behavior}`.toLowerCase();
  if (npc.behavior === "guard") {
    return { ...NPC_BASIC_ATTACK, name: "Guard Riposte", damageType: "slashing" };
  }
  if (npc.behavior === "merchant" || npc.behavior === "defensive") {
    return { ...NPC_BASIC_ATTACK, name: "Defensive Counter", damageType: "physical" };
  }
  if (npc.behavior === "hostile" && /bandit|outlaw|trapper|ambusher|scout/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "SideSwing", damageType: "slashing" };
  }
  if (/zombie|undead|corpse|dead/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Scratch", damageType: "physical" };
  }
  if (/bear/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Claw", damageType: "slashing", abilityMultiplier: 1.18 };
  }
  if (/wolf|hound|dog/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Bite", damageType: "piercing", abilityMultiplier: 1.08 };
  }
  if (/boar|stag|deer/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Charge", damageType: "blunt", abilityMultiplier: 1.12 };
  }
  if (/crow|pigeon|chicken|bird/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Peck", damageType: "piercing", abilityMultiplier: 0.86 };
  }
  if (/cat|fox|rat/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Scratch", damageType: "slashing", abilityMultiplier: 0.92 };
  }
  if (/snake/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Bite", damageType: "poison", abilityMultiplier: 0.94 };
  }
  if (/horse|cow|goat|sheep/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Kick", damageType: "blunt", abilityMultiplier: 0.9 };
  }
  if (npc.species === "animal") {
    return { ...NPC_BASIC_ATTACK, name: "Attack" };
  }
  return NPC_BASIC_ATTACK;
}

export function tickHarthmereRealtimeCombatAI(source = "combat_ai") {
  if (!isBrowser()) {
    return;
  }

  let state = readHarthmereCombatState();
  let player = state.player;
  if (
    player.hp <= 0 ||
    ["dead", "downed", "respawning", "invulnerable", "protected_after_respawn"].includes(
      player.combatState,
    )
  ) {
    return;
  }

  const now = Date.now();
  const candidateOffsets = new Set<number>();
  for (const key of Object.keys(state.npcs)) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      candidateOffsets.add(offset);
    }
  }
  for (const key of Object.keys(state.npcBrains ?? {})) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      candidateOffsets.add(offset);
    }
  }
  if (Number.isFinite(state.selectedNpcOffset)) {
    candidateOffsets.add(Number(state.selectedNpcOffset));
  }

  const skipped: Array<Record<string, unknown>> = [];
  const ready: Array<{
    offset: number;
    npc: HarthmereCombatStats;
    brain: HarthmereNpcBrainMemory;
    reachCheck: ReturnType<typeof harthmereNpcCanReachPlayerWithBrain>;
    ability: CombatAbility;
  }> = [];
  let mutated = false;

  for (const offset of candidateOffsets) {
    const npc = npcStatsFromState(state, offset);
    if (!canNpcRunRealtimeCombat(npc)) {
      continue;
    }

    let brain = harthmereNpcBrainFromState(state, offset);
    const selectedOrInCombat = npc.combatState === "in_combat" || state.selectedNpcOffset === offset;
    if (!brain && selectedOrInCombat && harthmereShouldNpcContinueRealtimeCombat(npc)) {
      state = harthmereEngageNpcBrain(state, offset, npc, "selected_or_existing_combat", 1);
      brain = harthmereNpcBrainFromState(state, offset);
      mutated = true;
    }
    if (!brain || brain.aggroUntil <= now) {
      if (brain && brain.phase !== "disengaged") {
        state = harthmereDisengageNpcBrain(state, offset, npc, "aggro_expired");
        mutated = true;
      }
      continue;
    }

    if (harthmereNpcShouldRetreatFromBrain(npc)) {
      state = harthmereSetNpcBrain(state, offset, {
        ...brain,
        phase: "retreating",
        reason: "low_hp_retreat",
        aggroUntil: now + 3500,
      });
      skipped.push({ offset, name: npc.name, phase: "retreating", reason: "low_hp" });
      mutated = true;
      continue;
    }

    const reachCheck = harthmereNpcCanReachPlayerWithBrain(state, offset, npc, "realtime_ai");
    const profile = harthmereNpcBrainProfile(npc);
    const cooldownReady = now >= Math.max(brain.nextAttackAt, state.lastNpcAttackAt?.[String(offset)] ?? 0);

    if (!reachCheck.canReach) {
      const stillChasing = reachCheck.reason === "pursuing_until_windup_ready";
      const nextPhase: HarthmereNpcBrainPhase = stillChasing ? "pursuing" : "alert";
      if (brain.phase !== nextPhase) {
        state = harthmereSetNpcBrain(state, offset, {
          ...brain,
          phase: nextPhase,
          lastThinkAt: now,
          reason: reachCheck.reason,
        });
        mutated = true;
      }
      skipped.push({
        offset,
        name: npc.name,
        phase: nextPhase,
        reason: reachCheck.reason,
        distance: reachCheck.distance,
        reach: reachCheck.reach,
        closeMs: reachCheck.closeMs,
        elapsedSinceDamageMs: reachCheck.elapsedSinceDamageMs,
      });
      continue;
    }

    if (!cooldownReady || now < brain.recoverUntil) {
      skipped.push({
        offset,
        name: npc.name,
        phase: "recovering",
        reason: "cooldown_or_recovery",
        nextAttackAt: brain.nextAttackAt,
        recoverUntil: brain.recoverUntil,
      });
      continue;
    }

    if (brain.phase !== "windup" || now < brain.nextAttackAt) {
      const ability = npcRealtimeAbility(npc);
      const nextAttackAt = now + profile.windupMs;
      state = harthmereSetNpcBrain(state, offset, {
        ...brain,
        phase: "windup",
        lastThinkAt: now,
        nextAttackAt,
        reason: "windup_before_attack",
        lastKnownPlayerPos: harthmerePlayerCombatPos2() ?? brain.lastKnownPlayerPos,
      });
      debugHarthmereCombat("combat.ai.brain.windup", {
        source,
        offset,
        npc: npc.name,
        ability: ability.name,
        distance: reachCheck.distance,
        reach: reachCheck.reach,
        windupMs: profile.windupMs,
        reason: reachCheck.reason,
      });
      mutated = true;
      continue;
    }

    ready.push({
      offset,
      npc,
      brain,
      reachCheck,
      ability: npcRealtimeAbility(npc),
    });
  }

  if (ready.length === 0) {
    if (skipped.length > 0) {
      debugHarthmereCombat("combat.ai.range_skip", {
        source,
        skipped: skipped.slice(0, 10),
      });
    }
    if (mutated) {
      writeHarthmereCombatState(state);
    }
    return;
  }

  ready.sort(
    (a, b) =>
      (b.brain.threat - a.brain.threat) ||
      ((a.reachCheck.distance ?? 9999) - (b.reachCheck.distance ?? 9999)),
  );
  const chosen = ready[0];
  const profile = harthmereNpcBrainProfile(chosen.npc);
  const npcInCombat: HarthmereCombatStats = {
    ...chosen.npc,
    combatState: "in_combat",
  };

  debugHarthmereCombat("combat.ai.tick", {
    source,
    chosenOffset: chosen.offset,
    chosen: chosen.npc.name,
    phase: chosen.brain.phase,
    behavior: chosen.npc.behavior,
    ability: chosen.ability.name,
    distance: chosen.reachCheck.distance,
    reach: chosen.reachCheck.reach,
    reason: chosen.reachCheck.reason,
    ready: ready.slice(0, 5).map((item) => ({
      offset: item.offset,
      name: item.npc.name,
      phase: item.brain.phase,
      threat: item.brain.threat,
      distance: item.reachCheck.distance,
      reach: item.reachCheck.reach,
    })),
  });

  const forcedAiHitResult = rollHarthmereContactHitResult(
    npcInCombat,
    player,
    chosen.ability,
  );
  debugHarthmereCombat("fight.ai.retaliate", {
    source,
    attacker: npcInCombat.name,
    target: player.name,
    targetOffset: chosen.offset,
    ability: chosen.ability.name,
    forcedAiHitResult,
    distance: chosen.reachCheck.distance,
    reach: chosen.reachCheck.reach,
    reason: chosen.reachCheck.reason,
    note:
      "State-machine AI reached attack phase after aggro/chase/windup; damage is still range-gated and logged.",
  });

  const attack = applyAttack(
    state,
    npcInCombat,
    player,
    chosen.ability,
    true,
    undefined,
    chosen.offset,
    forcedAiHitResult,
  );
  let updatedPlayer = attack.updatedTarget;
  state = attack.state;

  if (updatedPlayer.hp <= 0) {
    updatedPlayer = { ...updatedPlayer, hp: 0, combatState: "downed" };
    markPlayerDownedFromCombat(
      chosen.npc,
      chosen.ability,
      attack.finalDamage,
      `${chosen.npc.name} downed you during real-time combat. Respawn at Harthmere or wait for a revive.`,
    );
    state = appendCombatLog(state, {
      attacker: chosen.npc.name,
      target: player.name,
      ability: "Downed State",
      result: "dead",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: 0,
      targetHpAfter: 0,
      detail: `Real-time combat AI resolved a fatal ${source} hit.`,
    });
  }

  const updatedAttacker = {
    ...attack.updatedAttacker,
    hp: chosen.npc.hp,
    maxHp: chosen.npc.maxHp,
    combatState: "in_combat" as CombatStateName,
  };
  state = harthmereSetNpcBrain(state, chosen.offset, {
    ...chosen.brain,
    phase: "recovering",
    lastThinkAt: now,
    lastDamageToPlayerAt: attack.finalDamage > 0 ? now : chosen.brain.lastDamageToPlayerAt,
    nextAttackAt: now + npcRealtimeAttackCadenceMs(updatedAttacker),
    recoverUntil: now + profile.recoverMs,
    reason: attack.finalDamage > 0 ? "attack_hit_recovering" : "attack_resolved_recovering",
    aggroUntil: now + profile.aggroDurationMs,
  });

  writeHarthmereCombatState({
    ...state,
    player: updatedPlayer,
    selectedNpcOffset: chosen.offset,
    npcs: {
      ...state.npcs,
      [String(chosen.offset)]: updatedAttacker,
    },
    lastNpcAttackAt: {
      ...(state.lastNpcAttackAt ?? {}),
      [String(chosen.offset)]: now,
    },
  });
}

export function useHarthmereRealtimeCombatAI() {
  useEffect(() => {
    if (!isBrowser()) {
      return;
    }
    const interval = window.setInterval(() => {
      tickHarthmereRealtimeCombatAI();
    }, 850);
    return () => window.clearInterval(interval);
  }, []);
}


// harthmere-facing-runtime-v3
export function useHarthmereForwardArcRuntime() {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const writeSnapshot = () => {
      const latestLocalPlayer = reactResources.get("/scene/local_player");
      const snapshot = harthmereFacingSnapshotFromLocalPlayer(latestLocalPlayer);
      writeHarthmereForwardArcRuntime({
        ...snapshot,
        at: Date.now(),
        source: "local_player_body_facing",
      });
    };

    writeSnapshot();
    const interval = window.setInterval(writeSnapshot, 50);
    return () => window.clearInterval(interval);
  }, [reactResources, localPlayer]);
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


// harthmere-forward-arc-melee-v2
export interface HarthmereForwardArcRuntimeSnapshot {
  position?: [number, number, number];
  /** World-space body/animation facing on the X/Z plane. This is what melee uses. */
  forward?: [number, number];
  /** Camera/view direction. Kept for debug; Biomes viewDir is opposite the visible model forward. */
  viewForward?: [number, number];
  /** Explicit visible-body forward derived from yaw/renderer orientation. */
  bodyForward?: [number, number];
  /** Optional movement-derived fallback direction. */
  movementForward?: [number, number];
  yaw?: number;
  at?: number;
  source?: string;
}

interface HarthmereForwardArcTargetPosition {
  pos: [number, number];
  radius: number;
  label: string;
  asset?: string;
  district?: string;
  species?: HarthmereCombatStats["species"];
  behavior?: CombatBehavior;
  socialRole?: HarthmereCombatStats["socialRole"];
  attackable?: boolean;
  clips?: string[];
  forward?: [number, number];
  at?: number;
}

const HARTHMERE_FORWARD_ARC_TARGET_POSITIONS: Record<
  number,
  HarthmereForwardArcTargetPosition
> = {
  9001: { pos: [84, 118], radius: 1.35, label: "Guard Yard Training Dummy" },
  9002: { pos: [410, -154], radius: 0.75, label: "Mudden Drain Rat" },
  9003: { pos: [421, -392], radius: 1.15, label: "Road Bandit Scout" },
  9004: { pos: [552, -420], radius: 1.15, label: "Road Wolf" },
  9005: { pos: [112, -715], radius: 1.2, label: "Wilds Bandit Ambusher" },
  9006: { pos: [536, -119], radius: 1.2, label: "Bell-Woken Zombie" },
  9007: { pos: [450, -650], radius: 1.2, label: "Greenmere Deer" },
  9008: { pos: [468, -384], radius: 1.15, label: "Diseased Boar" },
  9009: { pos: [575, -448], radius: 1.55, label: "Black Bear" },
  9010: { pos: [548, -126], radius: 1.15, label: "Forest Wolf" },
  9011: { pos: [655, -274], radius: 0.75, label: "Briarfen Water Snake" },
  9012: { pos: [735, 275], radius: 1.15, label: "Gravewood Pale Wolf" },
  9013: { pos: [118, -736], radius: 1.2, label: "Bandit Trapper" },
};


// harthmere-full-combat-ai-animation-v1
// The forward-arc melee resolver uses live rendered actor positions instead of
// just the old static 900x anchors. The renderer publishes every visible
// human/animal/undead combat actor here each frame.
function readHarthmereRuntimeCombatActors(): Record<
  number,
  HarthmereForwardArcTargetPosition
> {
  if (!isBrowser()) {
    return {};
  }
  const win = window as typeof window & {
    __harthmereCombatActorPositions?: Record<string, unknown>;
  };
  const raw = win.__harthmereCombatActorPositions;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const actors: Record<number, HarthmereForwardArcTargetPosition> = {};
  for (const [key, value] of Object.entries(raw)) {
    const offset = Number(key);
    if (!Number.isFinite(offset) || !value || typeof value !== "object") {
      continue;
    }
    const actor = value as Record<string, unknown>;
    const posRaw = Array.isArray(actor.pos) ? actor.pos : undefined;
    const x = Number(posRaw?.[0]);
    const z = Number(posRaw?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      continue;
    }
    const radius = clamp(Number(actor.radius ?? 1.15), 0.35, 3.75);
    const label = String(actor.label ?? `Harthmere NPC ${offset}`);
    const clips = Array.isArray(actor.clips)
      ? actor.clips.filter((clip): clip is string => typeof clip === "string")
      : undefined;
    const forward = normalizeHarthmereForward2(actor.forward);
    actors[offset] = {
      pos: [x, z],
      radius,
      label,
      asset: typeof actor.asset === "string" ? actor.asset : undefined,
      district: typeof actor.district === "string" ? actor.district : undefined,
      species: actor.species as HarthmereCombatStats["species"],
      behavior: actor.behavior as CombatBehavior,
      socialRole: actor.socialRole as HarthmereCombatStats["socialRole"],
      attackable: actor.attackable === false ? false : true,
      clips,
      forward,
      at: Number.isFinite(Number(actor.at)) ? Number(actor.at) : undefined,
    };
  }
  return actors;
}

function harthmereForwardArcTargetPositions(): Record<
  number,
  HarthmereForwardArcTargetPosition
> {
  return {
    ...HARTHMERE_FORWARD_ARC_TARGET_POSITIONS,
    ...readHarthmereRuntimeCombatActors(),
  };
}


// harthmere-combat-ai-edgecases-v2
// All melee/AI range checks use the same runtime positions. This prevents one
// system from seeing a target while another system still thinks that target is
// at an old static 900x anchor.
function harthmerePlayerCombatOrigin(
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined = readHarthmereForwardArcRuntime(),
): [number, number] | undefined {
  const position = normalizeHarthmerePosition3(runtime?.position);
  return position ? [position[0], position[2]] : undefined;
}

function harthmereDistanceBetweenPlayerAndTarget(
  offset: number,
  targetPositions: Record<number, HarthmereForwardArcTargetPosition> = harthmereForwardArcTargetPositions(),
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined = readHarthmereForwardArcRuntime(),
) {
  const origin = harthmerePlayerCombatOrigin(runtime);
  const target = targetPositions[offset];
  if (!origin || !target) {
    return undefined;
  }
  const dx = target.pos[0] - origin[0];
  const dz = target.pos[1] - origin[1];
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance)) {
    return undefined;
  }
  return { origin, target, dx, dz, distance };
}

function harthmereNpcCanReachPlayerNow(
  offset: number,
  npc: HarthmereCombatStats,
  targetPositions: Record<number, HarthmereForwardArcTargetPosition> = harthmereForwardArcTargetPositions(),
) {
  const distance = harthmereDistanceBetweenPlayerAndTarget(offset, targetPositions);
  const radius = targetPositions[offset]?.radius ?? 1.15;
  // harthmere-full-fight-system-v1
  // This is still melee, but it includes a short lunge allowance so a hostile
  // creature that was just struck at the edge of the player's sweep can answer
  // instead of doing nothing. Defensive townsfolk get less grace than guards,
  // bandits, and monsters so they do not become long-range turrets.
  const lungeGrace =
    npc.behavior === "guard" || npc.behavior === "hostile"
      ? 3.1
      : npc.behavior === "defensive" || npc.behavior === "merchant"
        ? 1.55
        : 0.65;
  const reach = Math.max(1.1, npc.attackRange) + radius + lungeGrace;
  return {
    canReach: Boolean(distance && distance.distance <= reach),
    distance: distance?.distance,
    reach,
    radius,
    lungeGrace,
    reason: distance ? "range_checked" : "missing_player_or_target_position",
  };
}
function harthmereShouldNpcContinueRealtimeCombat(npc: HarthmereCombatStats) {
  // Guards and hostile creatures keep fighting once provoked. Merchants,
  // civilians, and defensive wildlife may counter once when struck, but they do
  // not become infinite auto-attack turrets in the local-dev prototype.
  return npc.behavior === "guard" || npc.behavior === "hostile";
}


// harthmere-game-ai-state-machine-v1
// Tunable combat-brain profile. This replaces scattered if-statements with a
// predictable state-machine policy per NPC class. These values intentionally
// favor reliability in local-dev: hit an NPC, and it will either retaliate,
// chase briefly, flee/call for help, or disengage with an explicit debug reason.
function harthmereNpcBrainProfile(npc: HarthmereCombatStats) {
  const isGuard = npc.behavior === "guard";
  const isHostile = npc.behavior === "hostile";
  const isDefensive = npc.behavior === "defensive" || npc.behavior === "merchant";
  const isSmallAnimal = npc.species === "animal" && npc.maxHp <= 160;
  return {
    keepFighting: isGuard || isHostile,
    aggroDurationMs: isGuard ? 35_000 : isHostile ? 42_000 : isDefensive ? 12_000 : 6_000,
    chaseRange: isGuard
      ? Math.max(13, npc.aggroRange + 4)
      : isHostile
        ? Math.max(15, npc.aggroRange + 5)
        : isDefensive
          ? 7.5
          : 4.0,
    immediateLungeGrace: isGuard ? 4.6 : isHostile ? 5.2 : isDefensive ? 2.6 : 1.0,
    windupMs: isGuard ? 420 : isHostile ? 520 : isSmallAnimal ? 360 : 650,
    recoverMs: isGuard ? 900 : isHostile ? 1050 : isSmallAnimal ? 950 : 1450,
    maxVirtualCloseMs: isGuard ? 1400 : isHostile ? 1700 : 950,
    fleeAtHpRatio: isGuard || isHostile ? 0 : isSmallAnimal ? 0.34 : 0.18,
  };
}

function harthmerePlayerCombatPos2(): [number, number] | undefined {
  return harthmerePlayerCombatOrigin(readHarthmereForwardArcRuntime());
}

function harthmereNpcBrainFromState(
  state: HarthmereCombatState,
  offset: number,
): HarthmereNpcBrainMemory | undefined {
  return state.npcBrains?.[String(offset)];
}

function harthmereSetNpcBrain(
  state: HarthmereCombatState,
  offset: number,
  brain: HarthmereNpcBrainMemory | undefined,
): HarthmereCombatState {
  const key = String(offset);
  const nextBrains = { ...(state.npcBrains ?? {}) };
  if (brain) {
    nextBrains[key] = brain;
  } else {
    delete nextBrains[key];
  }
  return { ...state, npcBrains: nextBrains };
}

function harthmereEngageNpcBrain(
  state: HarthmereCombatState,
  offset: number,
  npc: HarthmereCombatStats,
  reason: string,
  threatDelta = 1,
): HarthmereCombatState {
  const now = Date.now();
  const profile = harthmereNpcBrainProfile(npc);
  const existing = harthmereNpcBrainFromState(state, offset);
  const playerPos = harthmerePlayerCombatPos2();
  const next: HarthmereNpcBrainMemory = {
    phase:
      npc.hp <= 0 || npc.combatState === "dead"
        ? "dead"
        : existing?.phase && !["idle", "disengaged", "dead"].includes(existing.phase)
          ? existing.phase
          : "alert",
    target: "player",
    aggroUntil: Math.max(existing?.aggroUntil ?? 0, now + profile.aggroDurationMs),
    firstAggroAt: existing?.firstAggroAt ?? now,
    lastThinkAt: existing?.lastThinkAt ?? 0,
    lastDamagedByPlayerAt: now,
    lastDamageToPlayerAt: existing?.lastDamageToPlayerAt,
    nextAttackAt: existing?.nextAttackAt ?? 0,
    recoverUntil: existing?.recoverUntil ?? 0,
    threat: Math.max(0, (existing?.threat ?? 0) + Math.max(1, threatDelta)),
    reason,
    lastKnownPlayerPos: playerPos ?? existing?.lastKnownPlayerPos,
  };
  debugHarthmereCombat("combat.ai.brain.engage", {
    offset,
    npc: npc.name,
    behavior: npc.behavior,
    phase: next.phase,
    reason,
    threat: next.threat,
    aggroMsRemaining: Math.max(0, next.aggroUntil - now),
  });
  return harthmereSetNpcBrain(state, offset, next);
}

function harthmereDisengageNpcBrain(
  state: HarthmereCombatState,
  offset: number,
  npc: HarthmereCombatStats,
  reason: string,
): HarthmereCombatState {
  const existing = harthmereNpcBrainFromState(state, offset);
  if (!existing) {
    return state;
  }
  debugHarthmereCombat("combat.ai.brain.disengage", {
    offset,
    npc: npc.name,
    reason,
    previousPhase: existing.phase,
  });
  return harthmereSetNpcBrain(state, offset, {
    ...existing,
    phase: npc.hp <= 0 || npc.combatState === "dead" ? "dead" : "disengaged",
    aggroUntil: 0,
    reason,
  });
}

function harthmereNpcCanReachPlayerWithBrain(
  state: HarthmereCombatState,
  offset: number,
  npc: HarthmereCombatStats,
  source: "counter" | "realtime_ai" = "realtime_ai",
) {
  const targetPositions = harthmereForwardArcTargetPositions();
  const distance = harthmereDistanceBetweenPlayerAndTarget(offset, targetPositions);
  const radius = targetPositions[offset]?.radius ?? 1.15;
  const profile = harthmereNpcBrainProfile(npc);
  const brain = harthmereNpcBrainFromState(state, offset);
  const now = Date.now();
  const baseReach = Math.max(1.15, npc.attackRange) + radius;
  const immediateReach = baseReach + profile.immediateLungeGrace;
  const chaseReach = baseReach + profile.chaseRange;

  if (!distance) {
    return {
      canReach: false,
      canClose: false,
      distance: undefined,
      reach: immediateReach,
      immediateReach,
      chaseReach,
      reason: "missing_player_or_target_position",
      brainPhase: brain?.phase,
      source,
    };
  }

  const overReach = Math.max(0, distance.distance - immediateReach);
  const closeMs = clamp(
    Math.round((overReach / Math.max(0.6, npc.movementSpeed)) * 650),
    0,
    profile.maxVirtualCloseMs,
  );
  const aggroActive = Boolean(brain && brain.aggroUntil > now);
  const hasClosedDistance = aggroActive && now - (brain?.lastDamagedByPlayerAt ?? now) >= closeMs;
  const canImmediate = distance.distance <= immediateReach;
  const canClose = distance.distance <= chaseReach && hasClosedDistance;

  return {
    canReach: canImmediate || canClose,
    canClose,
    distance: distance.distance,
    reach: canImmediate ? immediateReach : chaseReach,
    immediateReach,
    chaseReach,
    closeMs,
    elapsedSinceDamageMs: brain ? now - brain.lastDamagedByPlayerAt : undefined,
    reason: canImmediate
      ? "immediate_melee_or_lunge"
      : canClose
        ? "closed_distance_after_aggro"
        : aggroActive && distance.distance <= chaseReach
          ? "pursuing_until_windup_ready"
          : "out_of_chase_range",
    brainPhase: brain?.phase,
    source,
  };
}

function harthmereNpcShouldRetreatFromBrain(npc: HarthmereCombatStats) {
  const profile = harthmereNpcBrainProfile(npc);
  return profile.fleeAtHpRatio > 0 && npc.hp / Math.max(1, npc.maxHp) <= profile.fleeAtHpRatio;
}

function runtimeActorText(actor: HarthmereForwardArcTargetPosition) {
  return `${actor.label} ${actor.asset ?? ""} ${actor.district ?? ""}`.toLowerCase();
}

function runtimeActorSpecies(
  actor: HarthmereForwardArcTargetPosition,
): HarthmereCombatStats["species"] {
  if (actor.species) {
    return actor.species;
  }
  const text = runtimeActorText(actor);
  if (/undead|zombie|corpse|gravewood|drowned|dead/.test(text)) {
    return "undead";
  }
  if (/animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|pigeon|chicken|bunny|rabbit|pig/.test(text)) {
    return "animal";
  }
  return "human";
}

function runtimeActorCombatBehavior(
  actor: HarthmereForwardArcTargetPosition,
): CombatBehavior {
  if (actor.behavior) {
    return actor.behavior;
  }
  const text = runtimeActorText(actor);
  if (/dummy|training/.test(text)) {
    return "training_dummy";
  }
  if (/guard|watch|sentry|patrol|peacekeeper|sergeant|quartermaster/.test(text)) {
    return "guard";
  }
  if (/bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|gravewood/.test(text)) {
    return "hostile";
  }
  if (/wolf|bear|boar|snake|rat/.test(text)) {
    return "hostile";
  }
  if (/deer|fox|cat|dog|horse|cow|goat|sheep|pig|chicken|crow|raven|pigeon|frog|bunny|rabbit/.test(text)) {
    return "defensive";
  }
  if (/merchant|vendor|banker|teller|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  return "defensive";
}

function runtimeActorSocialRole(
  actor: HarthmereForwardArcTargetPosition,
): HarthmereCombatStats["socialRole"] {
  if (actor.socialRole) {
    return actor.socialRole;
  }
  const text = runtimeActorText(actor);
  const species = runtimeActorSpecies(actor);
  if (species === "animal") {
    return "wildlife";
  }
  if (/guard|watch|sentry|patrol|sergeant/.test(text)) {
    return "guard";
  }
  if (/merchant|vendor|banker|teller|supplier|clerk|registrar|auction/.test(text)) {
    return "merchant";
  }
  if (/bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned/.test(text)) {
    return "hostile";
  }
  return "civilian";
}

function statsForRuntimeCombatActor(
  offset: number,
): HarthmereCombatStats | undefined {
  if (offset < 10_000) {
    return undefined;
  }
  const actor = readHarthmereRuntimeCombatActors()[offset];
  if (!actor) {
    return undefined;
  }

  const text = runtimeActorText(actor);
  const species = runtimeActorSpecies(actor);
  const behavior = runtimeActorCombatBehavior(actor);
  const socialRole = runtimeActorSocialRole(actor);
  const level = /captain|sergeant|bear|root-crowned|grave/.test(text)
    ? 10
    : /guard|watch|bandit|smuggler|undead|zombie|wolf|boar/.test(text)
      ? 7
      : species === "animal"
        ? 3
        : 5;

  let hp = species === "animal" ? 220 : 280;
  let attackPoints = species === "animal" ? 18 : 18;
  let armor = species === "animal" ? 26 : 32;
  let evasion = species === "animal" ? 10 : 5;
  let attackRange = species === "animal" ? 1.8 : 1.55;
  let attackSpeed = species === "animal" ? 0.9 : 0.55;

  if (/guard|watch|sergeant|sentry|patrol/.test(text)) {
    hp = 920;
    attackPoints = 120;
    armor = 230;
    evasion = 7;
    attackRange = 2.35;
    attackSpeed = 0.82;
  } else if (/bandit|outlaw|thief|smuggler|trapper|ambusher/.test(text)) {
    hp = 500;
    attackPoints = 58;
    armor = 72;
    evasion = 13;
    attackRange = 2.2;
    attackSpeed = 0.88;
  } else if (/undead|zombie|corpse|drowned/.test(text)) {
    hp = 460;
    attackPoints = 44;
    armor = 60;
    evasion = 4;
    attackRange = 1.8;
    attackSpeed = 0.68;
  } else if (/bear/.test(text)) {
    hp = 820;
    attackPoints = 88;
    armor = 120;
    evasion = 5;
    attackRange = 2.15;
    attackSpeed = 0.78;
  } else if (/wolf/.test(text)) {
    hp = 390;
    attackPoints = 52;
    armor = 42;
    evasion = 15;
    attackRange = 1.95;
    attackSpeed = 1.05;
  } else if (/boar/.test(text)) {
    hp = 420;
    attackPoints = 42;
    armor = 55;
    evasion = 8;
    attackRange = 1.9;
    attackSpeed = 0.95;
  } else if (/snake|rat|fox|cat|dog|crow|raven|pigeon|chicken|frog|bunny|rabbit/.test(text)) {
    hp = /rat|frog|pigeon|chicken|bunny|rabbit/.test(text) ? 90 : 150;
    attackPoints = /rat|frog|pigeon|chicken|bunny|rabbit/.test(text) ? 8 : 18;
    armor = 14;
    evasion = 18;
    attackRange = 1.2;
    attackSpeed = 1.1;
  } else if (/horse|cow|goat|sheep|pig|deer/.test(text)) {
    hp = /horse|cow/.test(text) ? 360 : 240;
    attackPoints = /horse|cow/.test(text) ? 22 : 16;
    armor = 30;
    evasion = 12;
    attackRange = 1.7;
    attackSpeed = 0.8;
  } else if (/merchant|vendor|banker|supplier|clerk|registrar/.test(text)) {
    hp = 320;
    attackPoints = 24;
    armor = 50;
    evasion = 4;
    attackRange = 1.5;
    attackSpeed = 0.55;
  }

  return finalizeNpcStats(
    offset,
    {
      name: actor.label || `Harthmere NPC ${offset}`,
      level,
      faction:
        behavior === "guard"
          ? "town_watch"
          : behavior === "hostile"
            ? species === "undead"
              ? "undead"
              : species === "animal"
                ? "wildlife"
                : "bandit"
            : species === "animal"
              ? "wildlife"
              : "harthmere_citizen",
      behavior,
      hp,
      maxHp: hp,
      attackPoints,
      defense: armor,
      armor,
      magicResistance: Math.max(12, Math.floor(armor / (species === "undead" ? 1.5 : 2.5))),
      accuracy: Math.max(1, level + (behavior === "guard" ? 5 : behavior === "hostile" ? 3 : 0)),
      evasion,
      criticalChance: behavior === "hostile" ? 0.06 : 0.02,
      criticalDamage: behavior === "hostile" ? 1.45 : 1.2,
      attackSpeed,
      attackRange,
      movementSpeed: species === "animal" ? 4.8 : 3.4,
      aggroRange: behavior === "hostile" ? 16 : 0,
      leashRange: behavior === "hostile" ? 44 : 18,
      threatValue: attackPoints,
      combatState: "idle",
      attackable: actor.attackable !== false,
    },
    species,
    socialRole,
  );
}

function normalizeHarthmereForward2(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  const x = Number(value[0]);
  const z = Number(value[1]);
  const length = Math.hypot(x, z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || length < 0.001) {
    return undefined;
  }
  return [x / length, z / length];
}

function normalizeHarthmerePosition3(
  value: unknown,
): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return undefined;
  }
  return [x, y, z];
}

function readHarthmereForwardArcRuntimeFromWindow():
  | HarthmereForwardArcRuntimeSnapshot
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  const win = window as typeof window & {
    __harthmereForwardArcRuntime?: HarthmereForwardArcRuntimeSnapshot;
  };
  return win.__harthmereForwardArcRuntime;
}

export function readHarthmereForwardArcRuntime():
  | HarthmereForwardArcRuntimeSnapshot
  | undefined {
  return readHarthmereForwardArcRuntimeFromWindow();
}

export function writeHarthmereForwardArcRuntime(
  snapshot: HarthmereForwardArcRuntimeSnapshot,
) {
  if (!isBrowser()) {
    return;
  }

  const position = normalizeHarthmerePosition3(snapshot.position);
  const bodyForward = normalizeHarthmereForward2(snapshot.bodyForward);
  const movementForward = normalizeHarthmereForward2(snapshot.movementForward);
  const viewForward = normalizeHarthmereForward2(snapshot.viewForward);
  const forward =
    normalizeHarthmereForward2(snapshot.forward) ??
    bodyForward ??
    movementForward ??
    viewForward ??
    [0, -1];
  const win = window as typeof window & {
    __harthmereForwardArcRuntime?: HarthmereForwardArcRuntimeSnapshot;
  };
  win.__harthmereForwardArcRuntime = {
    position,
    forward,
    bodyForward,
    movementForward,
    viewForward,
    yaw: Number.isFinite(snapshot.yaw) ? snapshot.yaw : undefined,
    at: snapshot.at ?? Date.now(),
    source: snapshot.source,
  };
}

function callReadonlyVec3Method(value: unknown): [number, number, number] | undefined {
  if (typeof value !== "function") {
    return undefined;
  }
  try {
    const raw = value();
    if (Array.isArray(raw)) {
      return normalizeHarthmerePosition3(raw);
    }
    const toArray = (raw as { toArray?: () => unknown })?.toArray;
    if (typeof toArray === "function") {
      return normalizeHarthmerePosition3(toArray.call(raw));
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function harthmereBodyForwardFromYaw(yaw: number): [number, number] | undefined {
  if (!Number.isFinite(yaw)) {
    return undefined;
  }
  // Harthmere local-dev character meshes face the inverse of the raw Biomes
  // yaw basis. This is the source of truth for player melee, sword visuals,
  // and any future hand-held weapon graphics. Do not "fix" this back to
  // [sin(yaw), cos(yaw)] unless the model/root transform is changed too.
  return normalizeHarthmereForward2([-Math.sin(yaw), -Math.cos(yaw)]);
}

function harthmereViewForwardFromYaw(yaw: number): [number, number] | undefined {
  if (!Number.isFinite(yaw)) {
    return undefined;
  }
  // Kept for diagnostics only. View/camera forward is intentionally opposite
  // visible-body forward for these local-dev Harthmere meshes.
  return normalizeHarthmereForward2([Math.sin(yaw), Math.cos(yaw)]);
}

function harthmereFacingSnapshotFromLocalPlayer(
  localPlayer: unknown,
): HarthmereForwardArcRuntimeSnapshot {
  const localRecord = (localPlayer ?? {}) as Record<string, unknown>;
  const player = (localRecord.player ?? localPlayer ?? {}) as Record<string, unknown>;
  const position =
    normalizeHarthmerePosition3(player.position) ??
    normalizeHarthmerePosition3(localRecord.position);

  const orientation = player.orientation;
  const yaw = Array.isArray(orientation) && orientation.length >= 2
    ? Number(orientation[1])
    : Number(player.yaw ?? player.theta ?? player.heading);

  const methodViewForward3 = callReadonlyVec3Method(player.viewDir);
  const methodViewForward = methodViewForward3
    ? normalizeHarthmereForward2([methodViewForward3[0], methodViewForward3[2]])
    : undefined;
  const bodyForward = harthmereBodyForwardFromYaw(yaw);
  const viewForward = methodViewForward ?? harthmereViewForwardFromYaw(yaw);

  let movementForward: [number, number] | undefined;
  const velocity = player.velocity ?? localRecord.velocity;
  if (Array.isArray(velocity) && velocity.length >= 3) {
    movementForward = normalizeHarthmereForward2([velocity[0], velocity[2]]);
  }

  return {
    position,
    forward: bodyForward ?? movementForward ?? viewForward ?? [0, -1],
    bodyForward,
    movementForward,
    viewForward,
    yaw: Number.isFinite(yaw) ? yaw : undefined,
  };
}

function harthmereForwardFromPlayerObject(player: unknown): [number, number] {
  return harthmereFacingSnapshotFromLocalPlayer({ player }).forward ?? [0, -1];
}

function emitHarthmereForwardArcSwingEffect(
  ability: Exclude<HarthmerePlayerAttackType, "spark">,
  origin: [number, number] | undefined,
  forward: [number, number],
  hitOffsets: number[],
  candidateOffsets: number[],
) {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
      detail: {
        id: `forward-arc-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        attacker: "You",
        target: "Forward Melee Arc",
        ability: ability === "heavy" ? "Forward Heavy Swing" : "Forward Basic Swing",
        attack: ability,
        attackType: ability,
        action: ability === "heavy" ? "heavy_melee_swing" : "basic_melee_swing",
        result: hitOffsets.length > 0 ? "normal_hit" : "evade",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: 0,
        targetHpAfter: 0,
        detail:
          hitOffsets.length > 0
            ? `Your ${ability} swing swept forward and connected with ${hitOffsets.length} target(s).`
            : `Your ${ability} swing swept forward but hit nothing.`,
        animationKind: "attack",
        effectKind: "physical",
        vfxKind: "physical",
        visualKind: "player_swing",
        harthmereNoSparkBasic: true,
        attackerClipPriority:
          ability === "heavy"
            ? ["HeavyAttack", "Attack2", "SideSwing", "Thrusting", "Attack"]
            : ["Attack", "Attack2", "SideSwing", "Thrusting", "HeavyAttack"],
        targetClipPriority: [],
        playerSwing: true,
        swingOrigin: origin,
        swingForward: forward,
        hitOffsets,
        candidateOffsets,
      },
    }),
  );
}

function rankedHarthmereForwardArcTargets(
  state: HarthmereCombatState,
  ability: Exclude<HarthmerePlayerAttackType, "spark">,
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined,
) {
  // harthmere-sword-facing-direction-fix
  // Player melee is now tied to the same visible-body forward basis used by the
  // sword renderer. The extra inverse-basis probe is intentional: if a future
  // local-player transform reports the opposite vector again, combat will pick
  // the side that actually contains valid targets and log the correction.
  const range = ability === "heavy" ? 9.5 : 7.25;
  const halfAngleRadians = ((ability === "heavy" ? 190 : 170) * Math.PI) / 360;
  const cosHalfAngle = Math.cos(halfAngleRadians);
  const maxTargets = ability === "heavy" ? 16 : 10;
  const laneHalfWidth = ability === "heavy" ? 3.25 : 2.55;
  const targetPositions = harthmereForwardArcTargetPositions();

  const runtimePosition = normalizeHarthmerePosition3(runtime?.position);
  const selectedPosition =
    state.selectedNpcOffset !== undefined
      ? targetPositions[state.selectedNpcOffset]?.pos
      : undefined;

  let origin: [number, number] | undefined = runtimePosition
    ? [runtimePosition[0], runtimePosition[2]]
    : undefined;
  const baseForward =
    normalizeHarthmereForward2(runtime?.bodyForward) ??
    normalizeHarthmereForward2(runtime?.forward) ??
    normalizeHarthmereForward2(runtime?.movementForward) ??
    (origin && selectedPosition
      ? normalizeHarthmereForward2([
          selectedPosition[0] - origin[0],
          selectedPosition[1] - origin[1],
        ])
      : undefined) ??
    [0, -1];

  if (!origin && selectedPosition) {
    origin = [
      selectedPosition[0] - baseForward[0] * Math.max(2.0, range * 0.72),
      selectedPosition[1] - baseForward[1] * Math.max(2.0, range * 0.72),
    ];
  }

  const candidateOffsets = new Set<number>();
  for (const key of Object.keys(targetPositions)) {
    candidateOffsets.add(Number(key));
  }
  for (const key of Object.keys(state.npcs)) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      candidateOffsets.add(offset);
    }
  }
  if (state.selectedNpcOffset !== undefined) {
    candidateOffsets.add(state.selectedNpcOffset);
  }

  const evaluateForward = (forward: [number, number]) => {
    const evaluated = [...candidateOffsets]
      .map((offset) => {
        const position = targetPositions[offset];
        const npc = npcStatsFromState(state, offset);
        if (!position || !origin) {
          return undefined;
        }
        const alive = npc.attackable && npc.hp > 0 && npc.combatState !== "dead";
        const dx = position.pos[0] - origin[0];
        const dz = position.pos[1] - origin[1];
        const distance = Math.hypot(dx, dz);
        if (!Number.isFinite(distance) || distance <= 0.001) {
          return undefined;
        }

        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        const dot = normalizedDx * forward[0] + normalizedDz * forward[1];
        const forwardDistance = dx * forward[0] + dz * forward[1];
        const lateralDistance = Math.abs(dx * -forward[1] + dz * forward[0]);
        const reach = range + position.radius;
        const withinRange = distance <= reach;
        const withinArc = dot >= cosHalfAngle && forwardDistance >= -position.radius;
        const withinForwardLane =
          forwardDistance >= -position.radius &&
          forwardDistance <= reach &&
          lateralDistance <= laneHalfWidth + position.radius;
        const closeBodyContact = distance <= position.radius + 1.85 && dot >= -0.2;
        const accepted =
          alive && (withinArc || withinForwardLane || closeBodyContact) && withinRange;

        return {
          offset,
          npc,
          position,
          distance,
          dot,
          forwardDistance,
          lateralDistance,
          reach,
          withinRange,
          withinArc,
          withinForwardLane,
          closeBodyContact,
          alive,
          accepted,
          score:
            Math.max(0, forwardDistance) +
            lateralDistance * 0.45 -
            (withinForwardLane ? 0.35 : 0) -
            dot * 0.35,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );

    const candidates = evaluated
      .filter((candidate) => candidate.accepted)
      .sort((a, b) => a.score - b.score)
      .slice(0, maxTargets);

    return { evaluated, candidates };
  };

  let forward = baseForward;
  let { evaluated, candidates } = evaluateForward(forward);
  let invertedForwardUsed = false;

  const inverseForward = normalizeHarthmereForward2([-baseForward[0], -baseForward[1]]) ?? [0, 1];
  const inverse = evaluateForward(inverseForward);
  const selectedBase = evaluated.find(
    (candidate) => candidate.offset === state.selectedNpcOffset,
  );
  const selectedInverse = inverse.evaluated.find(
    (candidate) => candidate.offset === state.selectedNpcOffset,
  );
  const inverseBetterForSelected = Boolean(
    selectedInverse?.accepted &&
      (!selectedBase?.accepted || selectedInverse.score + 0.1 < selectedBase.score),
  );

  if ((candidates.length === 0 && inverse.candidates.length > 0) || inverseBetterForSelected) {
    debugHarthmereCombat("forward_arc.direction_autofix", {
      ability,
      reason: inverseBetterForSelected
        ? "selected target is on inverse visible-body side"
        : "base forward missed but inverse forward found targets",
      baseForward,
      inverseForward,
      baseHits: candidates.map((candidate) => candidate.offset),
      inverseHits: inverse.candidates.map((candidate) => candidate.offset),
      selectedNpcOffset: state.selectedNpcOffset,
      selectedBase: selectedBase
        ? {
            distance: Number(selectedBase.distance.toFixed(2)),
            dot: Number(selectedBase.dot.toFixed(3)),
            accepted: selectedBase.accepted,
          }
        : undefined,
      selectedInverse: selectedInverse
        ? {
            distance: Number(selectedInverse.distance.toFixed(2)),
            dot: Number(selectedInverse.dot.toFixed(3)),
            accepted: selectedInverse.accepted,
          }
        : undefined,
    });
    forward = inverseForward;
    evaluated = inverse.evaluated;
    candidates = inverse.candidates;
    invertedForwardUsed = true;
  }

  if (candidates.length === 0 && state.selectedNpcOffset !== undefined && origin) {
    const selected = evaluated.find(
      (candidate) => candidate.offset === state.selectedNpcOffset,
    );
    if (
      selected &&
      selected.alive &&
      selected.forwardDistance >= -selected.position.radius &&
      selected.forwardDistance <= selected.reach + 1.5 &&
      selected.dot >= -0.1
    ) {
      candidates.push({ ...selected, score: selected.score + 0.25 });
    } else if (selected) {
      debugHarthmereCombat("forward_arc.selected_rejected", {
        ability,
        selectedNpcOffset: state.selectedNpcOffset,
        selectedTarget: selected.npc.name,
        distance: selected.distance,
        dot: selected.dot,
        forwardDistance: selected.forwardDistance,
        lateralDistance: selected.lateralDistance,
        reach: selected.reach,
        withinRange: selected.withinRange,
        withinArc: selected.withinArc,
        withinForwardLane: selected.withinForwardLane,
        alive: selected.alive,
        invertedForwardUsed,
        reason: !selected.alive
          ? "selected target is not attackable/alive"
          : selected.dot < -0.1
            ? "selected target is behind visible body facing"
            : "selected target out of sweep range or outside forward lane",
      });
    }
  }

  const nearest = evaluated
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .map((candidate) => ({
      offset: candidate.offset,
      label: candidate.npc.name,
      hp: candidate.npc.hp,
      maxHp: candidate.npc.maxHp,
      state: candidate.npc.combatState,
      behavior: candidate.npc.behavior,
      species: candidate.npc.species,
      distance: Number(candidate.distance.toFixed(2)),
      reach: Number(candidate.reach.toFixed(2)),
      dot: Number(candidate.dot.toFixed(3)),
      forwardDistance: Number(candidate.forwardDistance.toFixed(2)),
      lateralDistance: Number(candidate.lateralDistance.toFixed(2)),
      withinRange: candidate.withinRange,
      withinArc: candidate.withinArc,
      withinForwardLane: candidate.withinForwardLane,
      closeBodyContact: candidate.closeBodyContact,
      accepted: candidate.accepted,
    }));

  debugHarthmereCombat("forward_arc.actor_registry", {
    registeredActorOffsets: Object.keys(readHarthmereRuntimeCombatActors()).map(Number),
    mergedTargetOffsets: Object.keys(targetPositions).map(Number),
  });
  debugHarthmereCombat("forward_arc.nearest", {
    ability,
    origin,
    forward,
    rawForward: baseForward,
    invertedForwardUsed,
    range,
    laneHalfWidth,
    nearest,
  });

  return {
    origin,
    forward,
    range,
    halfAngleDegrees: (halfAngleRadians * 180) / Math.PI,
    laneHalfWidth,
    maxTargets,
    candidates,
    candidateOffsets: [...candidateOffsets],
    nearest,
    invertedForwardUsed,
  };
}

export function performHarthmereForwardArcAttack(
  ability: Exclude<HarthmerePlayerAttackType, "spark">,
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined =
    readHarthmereForwardArcRuntime(),
): { hitOffsets: number[]; candidateOffsets: number[] } {
  let state = readHarthmereCombatState();
  const player = state.player;

  if (["dead", "downed"].includes(player.combatState) || player.hp <= 0) {
    const dummyTarget =
      state.selectedNpcOffset !== undefined
        ? npcStatsFromState(state, state.selectedNpcOffset)
        : statsForOffset(HARTHMERE_TRAINING_DUMMY_OFFSET);
    writeHarthmereCombatState(
      invalidLog(
        state,
        dummyTarget,
        "You are downed and cannot swing. Revive or respawn first.",
        "dead",
      ),
    );
    return { hitOffsets: [], candidateOffsets: [] };
  }

  const arc = rankedHarthmereForwardArcTargets(state, ability, runtime);
  const hitOffsets = arc.candidates.map((candidate) => candidate.offset);

  debugHarthmereCombat("forward_arc.start" as any, {
    ability,
    origin: arc.origin,
    forward: arc.forward,
    range: arc.range,
    halfAngleDegrees: arc.halfAngleDegrees,
    maxTargets: arc.maxTargets,
    candidateOffsets: arc.candidateOffsets,
    hitOffsets,
    nearest: arc.nearest,
    runtime,
    bodyForward: runtime?.bodyForward,
    viewForward: runtime?.viewForward,
    movementForward: runtime?.movementForward,
    yaw: runtime?.yaw,
  });

  emitHarthmereForwardArcSwingEffect(
    ability,
    arc.origin,
    arc.forward,
    hitOffsets,
    arc.candidateOffsets,
  );

  if (hitOffsets.length === 0) {
    writeHarthmereCombatState(
      appendCombatLog(state, {
        attacker: player.name,
        target: "Forward Arc",
        ability: ability === "heavy" ? "Heavy Attack Sweep" : "Basic Attack Sweep",
        result: "evade",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: 0,
        targetHpAfter: 0,
        animationKind: "attack",
        effectKind: "physical",
        vfxKind: "physical",
        visualKind: "player_swing",
        harthmereNoSparkBasic: true,
        attackerClipPriority:
          ability === "heavy"
            ? ["HeavyAttack", "Attack2", "SideSwing", "Thrusting", "Attack"]
            : ["Attack", "Attack2", "SideSwing", "Thrusting", "HeavyAttack"],
        targetClipPriority: [],
        detail: `Your ${ability} swing cut through the space in front of you, but no target was inside the arc.`,
      } as unknown as Omit<HarthmereCombatLogEntry, "id" | "at">),
    );
    debugHarthmereCombat("forward_arc.miss" as any, {
      ability,
      origin: arc.origin,
      forward: arc.forward,
      candidateOffsets: arc.candidateOffsets,
    });
    return { hitOffsets, candidateOffsets: arc.candidateOffsets };
  }

  for (const hit of arc.candidates) {
    debugHarthmereCombat("forward_arc.hit" as any, {
      ability,
      offset: hit.offset,
      target: hit.npc.name,
      distance: hit.distance,
      dot: hit.dot,
    });
    performHarthmereCombatAttack(hit.offset, ability);
    state = readHarthmereCombatState();
  }

  return { hitOffsets, candidateOffsets: arc.candidateOffsets };
}


export function performHarthmereCombatAttack(
  targetOffset: number,
  ability: HarthmerePlayerAttackType = "basic",
) {
  let state = readHarthmereCombatState();
  let player = state.player;
  let target = npcStatsFromState(state, targetOffset);
  const contributionKey = String(targetOffset);

  state = {
    ...state,
    selectedNpcOffset: targetOffset,
    npcs: {
      ...state.npcs,
      [contributionKey]: target,
    },
  };

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

  if (["invulnerable", "protected_after_respawn"].includes(player.combatState)) {
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
            Math.round(
              player.attackPoints * 0.72 + player.magicResistance * 0.18,
            ),
          ),
          accuracy: player.accuracy + 4,
          attackRange: PLAYER_SPARK_ATTACK.range,
        }
      : applyWeaponToPlayer(player, weapon);

  const forcedPlayerHitResult =
    ability === "spark"
      ? undefined
      : rollHarthmereContactHitResult(effectivePlayer, target, playerAbility);
  debugHarthmereCombat("fight.geometry_contact", {
    attacker: effectivePlayer.name,
    target: target.name,
    targetOffset,
    ability: playerAbility.name,
    attackType: ability,
    forcedPlayerHitResult,
    note:
      ability === "spark"
        ? "Spark remains a spell/ranged resolver."
        : "Melee geometry already connected; force a damaging contact result instead of a second random whiff roll.",
  });

  const playerAttack = applyAttack(
    state,
    effectivePlayer,
    target,
    playerAbility,
    false,
    targetOffset,
    undefined,
    forcedPlayerHitResult,
  );

  state = playerAttack.state;
  player = {
    ...player,
    combatState: playerAttack.updatedAttacker.combatState,
  };
  target = {
    ...playerAttack.updatedTarget,
    combatState:
      playerAttack.updatedTarget.combatState === "dead" ? "dead" : "in_combat",
  };

  state = {
    ...state,
    player,
    selectedNpcOffset: targetOffset,
    npcs: {
      ...state.npcs,
      [contributionKey]: target,
    },
    killCredit: {
      ...state.killCredit,
      [contributionKey]:
        (state.killCredit[contributionKey] ?? 0) + playerAttack.finalDamage,
    },
  };

  // harthmere-game-ai-state-machine-v1
  // A damaging hit, or a blocked weapon contact, wakes the NPC brain. The
  // realtime AI loop will then choose chase / windup / attack / recovery rather
  // than relying on a single instant counterattack check.
  if (playerAttack.finalDamage > 0 || playerAttack.result === "block") {
    state = harthmereEngageNpcBrain(
      state,
      targetOffset,
      target,
      playerAttack.finalDamage > 0 ? "player_damaged_npc" : "player_weapon_blocked",
      Math.max(1, playerAttack.finalDamage),
    );
  }

  if (target.combatState === "dead") {
    reputationForKilledNpc(target, targetOffset);
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
      targetOffset,
      detail: `${target.name} was defeated. Kill credit is based on contribution, not last hit.`,
    });
    writeHarthmereCombatState(state);
    return;
  }

  const reachCheck = harthmereNpcCanReachPlayerWithBrain(state, targetOffset, target, "counter");
  const recentlyCounteredAt = state.lastNpcAttackAt?.[contributionKey] ?? 0;
  const counterCooldownReady = Date.now() - recentlyCounteredAt >= 1200;
  const canCounterattack =
    playerAttack.finalDamage > 0 &&
    target.attackable &&
    target.hp > 0 &&
    target.attackPoints > 0 &&
    // HP is the authoritative death gate for this counter path. Avoid a direct
    // combatState !== "dead" comparison here because TypeScript can narrow the
    // local target state differently across patched branches.
    counterCooldownReady &&
    reachCheck.canReach &&
    ["guard", "hostile", "defensive", "merchant"].includes(target.behavior);

  debugHarthmereCombat("combat.countercheck", {
    targetOffset,
    target: target.name,
    behavior: target.behavior,
    playerFinalDamage: playerAttack.finalDamage,
    canCounterattack,
    counterCooldownReady,
    reachCheck,
  });

  if (canCounterattack) {
    const counterAbility = npcRealtimeAbility(target);
    const forcedCounterHitResult = rollHarthmereContactHitResult(
      target,
      player,
      counterAbility,
    );
    debugHarthmereCombat("fight.ai.retaliate", {
      attacker: target.name,
      target: player.name,
      targetOffset,
      ability: counterAbility.name,
      forcedCounterHitResult,
      reachCheck,
      note: "Counterattack is range-gated first, then resolved as contact damage so retaliation is visible and testable.",
    });

    const counterAttack = applyAttack(
      state,
      target,
      player,
      counterAbility,
      true,
      undefined,
      targetOffset,
      forcedCounterHitResult,
    );

    let updatedPlayer = counterAttack.updatedTarget;
    const updatedNpc = {
      ...counterAttack.updatedAttacker,
      hp: target.hp,
      maxHp: target.maxHp,
      // If the NPC reached the counterattack branch, it passed hp > 0 and is
      // actively defending itself. Keep it in combat instead of checking for a
      // dead state that TypeScript may have already narrowed away.
      combatState: "in_combat" as CombatStateName,
    };

    state = counterAttack.state;

    if (updatedPlayer.hp <= 0) {
      updatedPlayer = { ...updatedPlayer, hp: 0, combatState: "downed" };
      markPlayerDownedFromCombat(
        target,
        counterAbility,
        counterAttack.finalDamage,
        `${target.name} downed you while defending themself. You can wait for a revive or respawn at a safe Harthmere point.`,
      );
      state = appendCombatLog(state, {
        attacker: target.name,
        target: player.name,
        ability: "Downed State",
        result: "dead",
        rawDamage: 0,
        mitigatedDamage: 0,
        finalDamage: 0,
        targetHpBefore: 0,
        targetHpAfter: 0,
        attackerOffset: targetOffset,
        detail:
          "You are downed, not permanently dead. Open the menu for revive and respawn options.",
      });
    }

    state = {
      ...state,
      player: updatedPlayer,
      npcs: {
        ...state.npcs,
        [contributionKey]: updatedNpc,
      },
      lastNpcAttackAt: {
        ...(state.lastNpcAttackAt ?? {}),
        [contributionKey]: Date.now(),
      },
    };
    state = harthmereSetNpcBrain(state, targetOffset, {
      ...(harthmereNpcBrainFromState(state, targetOffset) ?? {
        phase: "recovering",
        target: "player",
        aggroUntil: Date.now() + harthmereNpcBrainProfile(updatedNpc).aggroDurationMs,
        firstAggroAt: Date.now(),
        lastThinkAt: Date.now(),
        lastDamagedByPlayerAt: Date.now(),
        nextAttackAt: 0,
        recoverUntil: 0,
        threat: Math.max(1, counterAttack.finalDamage),
        reason: "counter_created_brain",
      }),
      phase: "recovering",
      lastDamageToPlayerAt: Date.now(),
      nextAttackAt: Date.now() + npcRealtimeAttackCadenceMs(updatedNpc),
      recoverUntil: Date.now() + harthmereNpcBrainProfile(updatedNpc).recoverMs,
      reason: "counterattack_recovery",
    });

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
        attackerOffset: targetOffset,
        detail: `${target.name} strikes back, breaks away, and calls for the Watch. People are attackable, but they are not harmless props.`,
      });
    }
  } else if (!canCounterattack && target.attackable && target.hp > 0 && target.attackPoints > 0) {
    debugHarthmereCombat("combat.counter_skip", {
      targetOffset,
      target: target.name,
      behavior: target.behavior,
      playerFinalDamage: playerAttack.finalDamage,
      counterCooldownReady,
      reachCheck,
      reason:
        playerAttack.finalDamage <= 0
          ? "player attack did no HP damage"
          : !reachCheck.canReach
            ? "target cannot physically reach player"
            : !counterCooldownReady
              ? "counter cooldown"
              : "behavior/state blocked counter",
    });
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
      attackerOffset: targetOffset,
      detail: `${target.name} flees. Passive targets should not behave like monsters.`,
    });
  }

  writeHarthmereCombatState(state);
}


// harthmere-death-ai-dialog-render-v1
// Dialogue, quest, and interaction UI should ask the combat model whether an
// NPC is dead instead of guessing from renderer state. This prevents corpses from
// continuing to offer normal conversation/economy/quest actions after HP reaches 0.
export function getHarthmereCombatNpcStatus(offset: number) {
  const state = readHarthmereCombatState();
  const stats = npcStatsFromState(state, offset);
  const now = Date.now();
  const dead =
    stats.hp <= 0 ||
    stats.combatState === "dead" ||
    Boolean(stats.corpseUntil && stats.corpseUntil > now);
  return {
    offset,
    name: stats.name,
    hp: stats.hp,
    maxHp: stats.maxHp,
    combatState: stats.combatState,
    dead,
    attackable: stats.attackable,
    behavior: stats.behavior,
  };
}

export function isHarthmereCombatNpcDead(offset: number) {
  return getHarthmereCombatNpcStatus(offset).dead;
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

      <div className="mb-2 rounded border border-emerald-300/20 bg-emerald-950/20 p-2 text-[11px] leading-snug text-emerald-50/80">
        <div className="mb-1 text-xs font-bold text-emerald-100">Action → GLTF clip map</div>
        <div>B / Basic Attack → Attack, Attack2, SideSwing, Thrusting</div>
        <div>N / Heavy Attack → HeavyAttack, Attack2, SideSwing</div>
        <div>L / Spark → BasicMagic, HeavyMagic</div>
        <div>Animal counters → Bite, Claw, Pounce, Charge, Peck, Scratch, Kick, TailWhip</div>
        <div>Reactions → HitReact, Block, ShieldBlock, Dodging, Death</div>
      </div>

      {target && (
        <div className="mb-2 flex flex-wrap gap-2 rounded border border-red-300/15 bg-black/25 p-2">
          <button
            className="rounded bg-red-400/20 px-2 py-1 text-xs font-semibold text-red-50 hover:bg-red-400/30"
            onClick={() => performHarthmereCombatAttack(state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET, "basic")}
          >
            Basic Attack → Attack
          </button>
          <button
            className="rounded bg-red-400/20 px-2 py-1 text-xs font-semibold text-red-50 hover:bg-red-400/30"
            onClick={() => performHarthmereCombatAttack(state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET, "heavy")}
          >
            Heavy Attack → HeavyAttack
          </button>
          <button
            className="rounded bg-violet-400/20 px-2 py-1 text-xs font-semibold text-violet-50 hover:bg-violet-400/30"
            onClick={() => performHarthmereCombatAttack(state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET, "spark")}
          >
            Spark → BasicMagic
          </button>
        </div>
      )}

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


function installHarthmereCombatDebugBridge() {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereCombatDebug?: Record<string, unknown>;
  };
  win.__harthmereCombatDebug = {
    state: () => readHarthmereCombatState(),
    reset: () => resetHarthmereCombat(),
    attack: (offset = 9003, ability: HarthmerePlayerAttackType = "basic") =>
      performHarthmereCombatAttack(Number(offset), ability),
    attackBandit: () => performHarthmereCombatAttack(9003, "basic"),
    heavyBandit: () => performHarthmereCombatAttack(9003, "heavy"),
    sparkBandit: () => performHarthmereCombatAttack(9003, "spark"),
    attackWolf: () => performHarthmereCombatAttack(9004, "basic"),
    attackGuard: () => performHarthmereCombatAttack(27, "basic"),
    tickAI: () => tickHarthmereRealtimeCombatAI("debug_bridge"),
    log: () => (window as typeof window & { __harthmereCombatDebugLog?: unknown[] }).__harthmereCombatDebugLog ?? [],
    enable: () => {
      window.localStorage.setItem("biomes.localDev.harthmere.combatDebug", "1");
      console.info("Harthmere combat debug enabled. Reload the page for full renderer install logs.");
    },
    disable: () => window.localStorage.removeItem("biomes.localDev.harthmere.combatDebug"),
  };
  debugHarthmereCombat("combat.bridge.install", {
    methods: Object.keys(win.__harthmereCombatDebug),
  });
}

if (isBrowser()) {
  installHarthmereCombatDebugBridge();
}
