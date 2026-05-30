export const HARTHMERE_COMBAT_DEBUG_PROBE_V8 =
  "harthmere-combat-debug-probe-v8";
export const HARTHMERE_FULL_FIGHT_SYSTEM_REVISION_V1 =
  "harthmere-full-fight-system-v1";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { getHarthmereCombatantActionBlockReasonV1 } from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import { isLiveEntityHelperMuckBossSpawnedV1 } from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import { isLocalDevLiveEntityRobotProtectionAreaSafeForPositionV1 } from "@/client/components/challenges/LocalDevLiveEntityRobotEnergyState";
import {
  applyHarthmereLevelingToPlayerCombatStats,
  awardHarthmereCombatXp,
  levelDamageModifier,
  levelHitModifier,
  scaleHarthmereNpcCombatStats,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1 } from "@/shared/harthmere/live_entity_helper_quests_v1";
import { evaluateMuckMonsterAggressionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";
import { HARTHMERE_HALF_DAY_MS_V1 } from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { useEffect, useMemo, useRef, useState } from "react";

const HARTHMERE_NO_SPARK_BASIC_ACTOR_MATCH_VERSION =
  "harthmere-no-spark-basic-actor-match-v11";
const HARTHMERE_FIX_BAD_INLINE_CONST_VERSION =
  "harthmere-fix-bad-inline-const-v1";
const HARTHMERE_TOWN_PLAYER_COLLISION_SAFETY_VERSION =
  "harthmere-town-player-collision-safety-v2";
export const HARTHMERE_NPC_RETALIATION_RUNTIME_V154 =
  "harthmere-npc-retaliation-runtime-v154";
export const HARTHMERE_RETALIATION_DIAGNOSTICS_V183 =
  "harthmere-retaliation-diagnostics-v183";
export const HARTHMERE_RETALIATION_NEAREST_DIAGNOSTICS_V184 =
  "harthmere-retaliation-nearest-diagnostics-v184";
export const HARTHMERE_RETALIATION_CURRENT_TRACE_V186 =
  "harthmere-retaliation-current-trace-v186";
export const HARTHMERE_ECS_NPC_RETALIATION_BRIDGE_V187 =
  "harthmere-ecs-npc-retaliation-bridge-v187";
export const HARTHMERE_ECS_NPC_COMBAT_REGISTRY_V188 =
  "harthmere-ecs-npc-combat-registry-v188";
export const HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189 =
  "harthmere-native-npc-attack-damage-bridge-v189";
export const HARTHMERE_RETALIATION_VISIBLE_FEEDBACK_V190 =
  "harthmere-retaliation-visible-feedback-v190";
export const HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191 =
  "harthmere-voxel-npc-retaliation-animation-v191";
export const HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_EVENT_V191 =
  "harthmere:voxel-npc-retaliation-animation-v191";
export const HARTHMERE_NPC_CHASE_REGEN_WANDER_V193 =
  "harthmere-npc-chase-regen-wander-v193";
export const HARTHMERE_NPC_MOTION_EVENT_V193 = "harthmere:npc-motion-v193";
const HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189 =
  "biomes:harthmere-native-npc-attack-contact-v189";

const HARTHMERE_COMBAT_STATE_KEY = "biomes.localDev.harthmere.combatState.v1";
const HARTHMERE_COMBAT_EVENT = "biomes:harthmere-combat-changed";
export const HARTHMERE_COMBAT_EFFECT_EVENT = "biomes:harthmere-combat-effect";
const HARTHMERE_DEATH_STATE_KEY = "biomes.localDev.harthmere.deathState.v1";
const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";
const HARTHMERE_INVENTORY_STATE_KEY =
  "biomes.localDev.harthmere.inventoryState.v1";

const HARTHMERE_BASIC_LONGSWORD_ATTACK_LABEL = "Iron Longsword Slash";
const HARTHMERE_HEAVY_LONGSWORD_ATTACK_LABEL = "Heavy Iron Longsword Slash";

// Future developers: this is display-label normalization only.
// The player now visually uses the Harthmere longsword GLTF, so the combat log
// should not keep showing legacy Iron Longsword names for B/H attacks.
const normalizeHarthmereVisibleAttackLabel = (
  label: string,
  attackType?: string
): string => {
  const normalized = label.replace(/training\s+dagger/gi, "Iron Longsword");
  if (/heavy/i.test(String(attackType)) || /heavy/i.test(label)) {
    return /longsword/i.test(normalized)
      ? normalized.replace(/strike/gi, "Slash")
      : HARTHMERE_HEAVY_LONGSWORD_ATTACK_LABEL;
  }
  if (
    /basic/i.test(String(attackType)) ||
    /strike/i.test(label) ||
    /dagger/i.test(label)
  ) {
    return /longsword/i.test(normalized)
      ? normalized.replace(/strike/gi, "Slash")
      : HARTHMERE_BASIC_LONGSWORD_ATTACK_LABEL;
  }
  return normalized;
};

const HARTHMERE_COMBAT_RULESET_REVISION = "harthmere-death-ai-dialog-render-v1";

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
export const HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1 =
  LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1;

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
  lastRegenAt?: number;
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

const HARTHMERE_JOBS_BOARD_TARGET_OFFSET_V140 = 140_041;

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
  [HARTHMERE_JOBS_BOARD_TARGET_OFFSET_V140]: "Jobs Board",
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
  [HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1]: "Muck-Scarred Helix",
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
const BOARD_OFFSETS = new Set([41, HARTHMERE_JOBS_BOARD_TARGET_OFFSET_V140]);
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
  | "combat.retaliation.probe"
  | "combat.retaliation.force"
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
  | "combat.ai.chase_motion"
  | "combat.regen.tick"
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
  payload: Record<string, unknown>
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
    new CustomEvent("biomes:harthmere-combat-debug", { detail: entry })
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
      harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY)
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
    JSON.stringify(state)
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
      12
    ),
  });
}

function markDeathStateProtected(
  label: string,
  detail: string,
  protectionSeconds: number,
  sicknessSeconds: number
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
      12
    ),
  });
}

function markPlayerDownedFromCombat(
  killer: HarthmereCombatStats,
  ability: CombatAbility,
  finalDamage: number,
  detail: string
) {
  const current = readRawDeathState();
  const deathId = `hm-death-${Date.now()}-${Math.floor(
    Math.random() * 1_000_000
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
    availableRespawns: [
      "the_grove",
      "temple_green",
      "north_gate",
      "player_house",
    ],
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
      12
    ),
  });
}

export function downHarthmerePlayerFromSystem(input: {
  cause: string;
  killerName: string;
  detail: string;
}) {
  const state = readHarthmereCombatState();
  const current = readRawDeathState();
  const now = Date.now();
  const record = {
    deathId: `hm-system-death-${now}-${Math.floor(Math.random() * 1_000_000)}`,
    state: "downed",
    zone: "Harthmere",
    position: [486, 53, -209],
    cause: input.cause,
    killerType: "environment",
    killerName: input.killerName,
    damageSummary: [
      {
        source: input.killerName,
        ability: "Stamina Depletion",
        damage: state.player.hp,
        type: "survival",
      },
    ],
    durabilityLossPercent: 0,
    xpDebt: 0,
    corpsePosition: [486, 53, -209],
    availableRespawns: [
      "the_grove",
      "temple_green",
      "north_gate",
      "player_house",
    ],
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
    recent: [
      deathLogEntry("Downed", input.detail),
      ...(current?.recent ?? []),
    ].slice(0, 12),
  });
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: input.killerName,
      target: state.player.name,
      ability: "Stamina Depletion",
      result: "dead",
      rawDamage: state.player.hp,
      mitigatedDamage: 0,
      finalDamage: state.player.hp,
      targetHpBefore: state.player.hp,
      targetHpAfter: 0,
      detail: input.detail,
    }),
    player: { ...state.player, hp: 0, combatState: "downed" },
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
    name: "Iron Longsword",
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
  weapon: EquippedWeaponContext
): HarthmereCombatStats {
  return {
    ...player,
    attackPoints: Math.max(
      1,
      Math.round(
        player.attackPoints + weapon.attackBonus * weapon.durabilityFactor
      )
    ),
    accuracy: player.accuracy + weapon.accuracyBonus,
    criticalChance: clamp(player.criticalChance + weapon.critBonus, 0, 0.75),
    attackRange: Math.max(1.1, player.attackRange + weapon.rangeBonus),
  };
}

function abilityWithWeapon(
  ability: CombatAbility,
  weapon: EquippedWeaponContext
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
  return `${weapon.name}${
    weapon.durabilityFactor < 0.5 ? " · badly damaged" : ""
  }`;
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
  socialRole: HarthmereCombatStats["socialRole"]
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
  const runtimeActorStats = statsForRuntimeCombatActor(offset);
  if (runtimeActorStats) {
    return runtimeActorStats;
  }

  if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET) {
    return finalizeNpcStats(
      offset,
      {
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
      },
      "construct",
      "training"
    );
  }

  if (offset === HARTHMERE_DRAIN_RAT_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 3, "wildlife", 140, 14, 15, 7, 1.6),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_ROAD_BANDIT_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 7, "bandit", 520, 62, 80, 14, 2.2),
      "human",
      "hostile"
    );
  }
  if (offset === HARTHMERE_ROAD_WOLF_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 5, "wildlife", 340, 35, 45, 10, 1.9),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_AMBIENT_BANDIT_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 8, "bandit", 560, 58, 75, 13, 2.2),
      "human",
      "hostile"
    );
  }
  if (offset === HARTHMERE_GRAVEWOOD_ZOMBIE_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 6, "undead", 460, 44, 60, 4, 1.65),
      "undead",
      "hostile"
    );
  }
  if (offset === HARTHMERE_FOREST_DEER_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(offset, 3, "wildlife", 240, 18, 20, 18, 1.7, "defensive"),
      "animal",
      "wildlife"
    );
  }
  if (offset === HARTHMERE_DISEASED_BOAR_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(offset, 5, "wildlife", 420, 42, 55, 8, 1.8, "hostile"),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_BLACK_BEAR_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(offset, 9, "wildlife", 820, 88, 120, 5, 2.1, "hostile"),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_FOREST_WOLF_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(offset, 6, "wildlife", 390, 52, 42, 15, 1.9, "hostile"),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_BRIARFEN_SNAKE_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(offset, 4, "wildlife", 190, 31, 18, 22, 1.4, "hostile"),
      "animal",
      "hostile"
    );
  }
  if (offset === HARTHMERE_GRAVEWOOD_PALE_WOLF_OFFSET) {
    return finalizeNpcStats(
      offset,
      wildlifeStats(
        offset,
        7,
        "undead_wildlife",
        470,
        58,
        60,
        14,
        1.9,
        "hostile"
      ),
      "undead",
      "hostile"
    );
  }
  if (offset === HARTHMERE_BANDIT_TRAPPER_OFFSET) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 8, "bandit", 580, 64, 72, 16, 2.4),
      "human",
      "hostile"
    );
  }
  if (offset === HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1) {
    return finalizeNpcStats(
      offset,
      hostileStats(offset, 12, "muck_breach", 1400, 118, 155, 10, 2.45),
      "construct",
      "hostile"
    );
  }

  if (BOARD_OFFSETS.has(offset)) {
    return finalizeNpcStats(
      offset,
      {
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
      },
      "construct",
      "quest_anchor"
    );
  }

  if (GUARD_OFFSETS.has(offset)) {
    return finalizeNpcStats(
      offset,
      {
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
      },
      "human",
      "guard"
    );
  }

  if (MERCHANT_OFFSETS.has(offset)) {
    return finalizeNpcStats(
      offset,
      {
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
      },
      "human",
      "merchant"
    );
  }

  if (CIVILIAN_OFFSETS.has(offset)) {
    const isChild = CHILD_OFFSETS.has(offset);
    return finalizeNpcStats(
      offset,
      {
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
      },
      "human",
      isChild ? "child" : "civilian"
    );
  }

  return finalizeNpcStats(
    offset,
    {
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
    },
    "human",
    "civilian"
  );
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
  behavior: "hostile" | "defensive"
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
  attackRange: number
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
  fallback: HarthmereCombatStats
): HarthmereCombatStats {
  const merged = { ...fallback, ...(stats ?? {}) };
  // Keep bad persisted runtime actor values from creating giant invisible
  // health bars that make it look like damage is not changing.
  merged.maxHp = Math.max(
    1,
    Math.round(Number(merged.maxHp || fallback.maxHp || 1))
  );
  const rawHp = Number.isFinite(Number(merged.hp))
    ? Number(merged.hp)
    : merged.maxHp;
  merged.hp = clamp(Math.round(rawHp), 0, merged.maxHp);
  merged.attackPoints = Math.max(
    0,
    Math.round(Number(merged.attackPoints ?? fallback.attackPoints ?? 0))
  );
  merged.defense = Math.max(
    0,
    Math.round(Number(merged.defense ?? fallback.defense ?? 0))
  );
  merged.armor = Math.max(
    0,
    Math.round(Number(merged.armor ?? fallback.armor ?? 0))
  );
  merged.magicResistance = Math.max(
    0,
    Math.round(Number(merged.magicResistance ?? fallback.magicResistance ?? 0))
  );
  if (merged.hp <= 0) {
    merged.combatState = "dead";
  } else if (
    merged.combatState === "dead" ||
    merged.combatState === "respawning"
  ) {
    merged.combatState = "idle";
  }
  return merged;
}

function normalizeNpcStatsForOffset(
  stats: Partial<HarthmereCombatStats> | undefined,
  fallback: HarthmereCombatStats,
  offset: number
): HarthmereCombatStats {
  const actor = isBrowser()
    ? readHarthmereRuntimeCombatActors()[offset]
    : undefined;
  if (!actor) {
    return normalizeStats(stats, fallback);
  }

  const persistedName =
    typeof stats?.name === "string" ? stats.name : undefined;
  const fallbackName = fallback.name;
  const staleIdentity = Boolean(
    persistedName &&
      fallbackName &&
      persistedName.trim().toLowerCase() !== fallbackName.trim().toLowerCase()
  );

  if (staleIdentity) {
    debugHarthmereCombat("combat.retaliation.trace.identity_reset", {
      version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
      offset,
      persistedName,
      liveActorLabel: actor.label,
      fallbackName,
      reason:
        "rendered actor identity changed for this combat offset; resetting stale persisted combat stats so visible NPC and combat NPC match",
    });
    return normalizeStats(undefined, fallback);
  }

  const normalized = normalizeStats(stats, fallback);
  return {
    ...normalized,
    name: fallback.name,
    faction: fallback.faction,
    behavior: fallback.behavior,
    species: fallback.species,
    socialRole: fallback.socialRole,
    attackable: fallback.attackable,
  };
}

function normalizeState(
  parsed: Partial<HarthmereCombatState> | undefined
): HarthmereCombatState {
  // Brain memory is a runtime aid, not permanent progression. Drop entries for
  // actors that no longer exist or have gone stale so old aggro cannot haunt a
  // fresh test session.
  const normalizeBrains = (
    raw: Record<string, HarthmereNpcBrainMemory> | undefined,
    liveNpcs: Record<string, HarthmereCombatStats>
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
          lastDamageToPlayerAt:
            Number(brain.lastDamageToPlayerAt ?? 0) || undefined,
          nextAttackAt: Number(brain.nextAttackAt ?? 0),
          recoverUntil: Number(brain.recoverUntil ?? 0),
          threat: Math.max(0, Number(brain.threat ?? 0)),
          reason: String(brain.reason ?? "normalized"),
          lastKnownPlayerPos: Array.isArray(brain.lastKnownPlayerPos)
            ? [
                Number(brain.lastKnownPlayerPos[0]),
                Number(brain.lastKnownPlayerPos[1]),
              ]
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
      const fallback = scaleHarthmereNpcCombatStats(
        statsForOffset(offset),
        offset
      );
      const normalized = normalizeNpcStatsForOffset(stats, fallback, offset);
      const respawnAt = Number(
        (stats as HarthmereCombatStats | undefined)?.respawnAt ?? 0
      );
      if (
        normalized.combatState === "dead" &&
        respawnAt > 0 &&
        Date.now() >= respawnAt
      ) {
        npcs[key] = { ...fallback, hp: fallback.maxHp, combatState: "idle" };
      } else {
        npcs[key] = normalized;
      }
    }
  }

  const recent = (parsed?.recent ?? []).slice(0, 12);
  const latestCombatAt = recent[0]?.at ?? 0;
  const staleCombatState =
    !latestCombatAt || Date.now() - latestCombatAt > 12_000;
  let player = applyHarthmereLevelingToPlayerCombatStats(
    normalizeStats(parsed?.player, defaultPlayerStats())
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
      harthmereUserScopedStorageKey(HARTHMERE_COMBAT_STATE_KEY)
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
  const selectedNpc =
    state.selectedNpcOffset !== undefined
      ? state.npcs[String(state.selectedNpcOffset)]
      : undefined;
  debugHarthmereCombat("combat.write_state", {
    // Keep this summary flat so browser logs show HP changes without needing to
    // expand nested objects in DevTools.
    summary:
      `player=${state.player.hp}/${state.player.maxHp} ${state.player.combatState}` +
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
    JSON.stringify(normalizeState(state))
  );
  combatEvent();
}

function emitHarthmereRetaliationVisibleFeedbackV190(
  entry: HarthmereCombatLogEntry
) {
  if (!isBrowser()) {
    return;
  }
  const finalDamage = Number(entry.finalDamage ?? 0);
  const targetName = String(entry.target ?? "");
  const attackerName = String(entry.attacker ?? "");
  const playerWasHit =
    finalDamage > 0 &&
    attackerName.length > 0 &&
    attackerName !== "You" &&
    /^(you|player|local player)$/i.test(targetName);

  if (!playerWasHit) {
    return;
  }

  const win = window as typeof window & {
    __harthmereRetaliationVisibleFeedbackV190?: unknown[];
  };
  const logged = {
    version: HARTHMERE_RETALIATION_VISIBLE_FEEDBACK_V190,
    at: Date.now(),
    attacker: attackerName,
    ability: entry.ability,
    finalDamage,
    playerHpBefore: entry.targetHpBefore,
    playerHpAfter: entry.targetHpAfter,
    attackerOffset: entry.attackerOffset,
  };
  win.__harthmereRetaliationVisibleFeedbackV190 = [
    logged,
    ...(win.__harthmereRetaliationVisibleFeedbackV190 ?? []),
  ].slice(0, 80);

  try {
    const doc = window.document;
    const styleId = "harthmere-retaliation-visible-feedback-v190-style";
    if (!doc.getElementById(styleId)) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes harthmereRetaliationFlashV190 {
          0% { opacity: 0; transform: translate(-50%, -6px) scale(0.96); }
          18% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -32px) scale(1.03); }
        }
        @keyframes harthmereRetaliationVignetteV190 {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
        .harthmere-retaliation-v190-toast {
          position: fixed;
          left: 50%;
          top: 17%;
          transform: translateX(-50%);
          z-index: 2147483647;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 90, 90, 0.9);
          background: rgba(24, 6, 6, 0.88);
          color: #fff;
          font: 700 14px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
          pointer-events: none;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          animation: harthmereRetaliationFlashV190 1400ms ease-out forwards;
        }
        .harthmere-retaliation-v190-vignette {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
          box-shadow: inset 0 0 80px rgba(255, 0, 0, 0.45), inset 0 0 22px rgba(255, 80, 80, 0.35);
          animation: harthmereRetaliationVignetteV190 520ms ease-out forwards;
        }
      `;
      doc.head.appendChild(style);
    }

    const toast = doc.createElement("div");
    toast.className = "harthmere-retaliation-v190-toast";
    toast.textContent = `${attackerName} hit you with ${entry.ability} for ${finalDamage} damage`;
    doc.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 1600);

    const vignette = doc.createElement("div");
    vignette.className = "harthmere-retaliation-v190-vignette";
    doc.body.appendChild(vignette);
    window.setTimeout(() => vignette.remove(), 650);
  } catch (error) {
    win.__harthmereRetaliationVisibleFeedbackV190 = [
      { ...logged, domFeedbackError: String(error) },
      ...(win.__harthmereRetaliationVisibleFeedbackV190 ?? []),
    ].slice(0, 80);
  }
}

function emitHarthmereVoxelNpcRetaliationAnimationV191(
  entry: HarthmereCombatLogEntry
) {
  if (!isBrowser()) {
    return;
  }

  const finalDamage = Number(entry.finalDamage ?? 0);
  const targetName = String(entry.target ?? "");
  const attackerName = String(entry.attacker ?? "");
  const attackerOffset = Number(entry.attackerOffset);
  const npcDamagedPlayer =
    finalDamage > 0 &&
    Number.isFinite(attackerOffset) &&
    attackerName.length > 0 &&
    attackerName !== "You" &&
    /^(you|player|local player)$/i.test(targetName);

  if (!npcDamagedPlayer) {
    return;
  }

  const now = Date.now();
  const detail = {
    version: HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_V191,
    at: now,
    source: "harthmere_combat_effect_npc_damaged_player",
    entityId: attackerOffset,
    attackerOffset,
    attacker: attackerName,
    ability: entry.ability,
    finalDamage,
    playerHpBefore: entry.targetHpBefore,
    playerHpAfter: entry.targetHpAfter,
    animation: "attack1",
    renderer: "native_voxel_npc_resource",
    note: "V191 intentionally uses the native voxel NPC renderer in src/client/game/resources/npcs.ts, not harthmere_assets.ts fallback actors.",
  };

  const win = window as typeof window & {
    __harthmereVoxelNpcRetaliationAnimationV191?: Record<string, typeof detail>;
    __harthmereVoxelNpcRetaliationAnimationLogV191?: (typeof detail)[];
  };
  win.__harthmereVoxelNpcRetaliationAnimationV191 = {
    ...(win.__harthmereVoxelNpcRetaliationAnimationV191 ?? {}),
    [String(attackerOffset)]: detail,
  };
  win.__harthmereVoxelNpcRetaliationAnimationLogV191 = [
    detail,
    ...(win.__harthmereVoxelNpcRetaliationAnimationLogV191 ?? []),
  ].slice(0, 100);

  window.dispatchEvent(
    new CustomEvent(HARTHMERE_VOXEL_NPC_RETALIATION_ANIMATION_EVENT_V191, {
      detail,
    })
  );
  debugHarthmereCombat("combat.voxel_npc.retaliation_animation_v191", detail);
}

function emitHarthmereCombatEffect(entry: HarthmereCombatLogEntry) {
  if (!isBrowser()) {
    return;
  }
  debugHarthmereCombat("combat.effect.emit", { entry });
  emitHarthmereVoxelNpcRetaliationAnimationV191(entry);
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
      detail: entry,
    })
  );
  emitHarthmereRetaliationVisibleFeedbackV190(entry);
}

function npcStatsFromState(
  state: HarthmereCombatState,
  offset: number
): HarthmereCombatStats {
  const fallback = scaleHarthmereNpcCombatStats(statsForOffset(offset), offset);
  return normalizeNpcStatsForOffset(
    state.npcs[String(offset)],
    fallback,
    offset
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

function npcAttackClipPriority(
  ability: string,
  attackerName = "",
  detail = ""
) {
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
  return [
    "Attack",
    "Bite",
    "Claw",
    "Pounce",
    "Charge",
    "Scratch",
    "Peck",
    "Kick",
    "TailWhip",
    "HeavyAttack",
  ];
}

function isHarthmerePhysicalCombatEventText(value: string) {
  const text = value.toLowerCase();
  if (/(spark|basicmagic|heavymagic|magic|spell|arcane)/i.test(text)) {
    return false;
  }
  return /basic|heavy|dagger|strike|slash|swing|thrust|punch|kick|stab|bow|arrow|melee|weapon|hit|bite|claw|pounce|charge|peck|scratch|tail/.test(
    text
  );
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
  finalDamage: number
) {
  return (
    result === "dead" ||
    (finalDamage > 0 && Number.isFinite(targetHpAfter) && targetHpAfter <= 0)
  );
}

function targetReactionClipPriority(
  result: HitResult,
  targetHpAfter: number,
  ability = "",
  detail = "",
  finalDamage = 0
) {
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
    return [
      "Dodging",
      "Sidestep",
      "SidestepLeft",
      "SidestepRight",
      "Flee",
      "Run",
    ];
  }
  if (result === "miss" || result === "invalid_target" || result === "immune") {
    return ["Idle", "LookAround"];
  }
  return ["HitReact", "Stunned", "Block", "ShieldBlock"];
}

function enrichCombatAnimationMetadata(
  state: HarthmereCombatState,
  entry: Omit<HarthmereCombatLogEntry, "id" | "at">
): Omit<HarthmereCombatLogEntry, "id" | "at"> {
  const selectedOffset = state.selectedNpcOffset;
  const selectedNpc =
    selectedOffset !== undefined
      ? state.npcs[String(selectedOffset)] ??
        npcStatsFromState(state, selectedOffset)
      : undefined;
  const playerNames = new Set([state.player.name, "You", "Player"]);
  const attackerIsPlayer = playerNames.has(entry.attacker);
  const targetIsPlayer = playerNames.has(entry.target);
  const attackerIsSelectedNpc = Boolean(
    selectedNpc && entry.attacker === selectedNpc.name
  );
  const targetIsSelectedNpc = Boolean(
    selectedNpc && entry.target === selectedNpc.name
  );

  const attackerOffset =
    entry.attackerOffset ??
    (attackerIsSelectedNpc ? selectedOffset : undefined);
  const targetOffset =
    entry.targetOffset ?? (targetIsSelectedNpc ? selectedOffset : undefined);
  const attackerClipPriority =
    entry.attackerClipPriority ??
    uniqueClipPriority(
      attackerIsPlayer
        ? playerAttackClipPriority(entry.ability, entry.detail)
        : npcAttackClipPriority(entry.ability, entry.attacker, entry.detail)
    );
  const targetClipPriority =
    entry.targetClipPriority ??
    uniqueClipPriority(
      targetReactionClipPriority(
        entry.result,
        entry.targetHpAfter,
        entry.ability,
        entry.detail,
        entry.finalDamage
      )
    );

  const animationKind =
    entry.animationKind ??
    (shouldHarthmereTargetPlayDeathPulse(
      entry.result,
      entry.targetHpAfter,
      entry.finalDamage
    )
      ? "death"
      : entry.result === "dodge" ||
        entry.result === "evade" ||
        entry.result === "out_of_range"
      ? "evade"
      : entry.result === "block" ||
        entry.result === "parry" ||
        entry.result === "absorb"
      ? "block"
      : /spark|magic|spell|arcane/i.test(entry.ability)
      ? "magic"
      : "attack");

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
    effectKind: isHarthmerePhysicalCombatEventText(
      `${entry.ability} ${entry.detail}`
    )
      ? "physical"
      : undefined,
    vfxKind: isHarthmerePhysicalCombatEventText(
      `${entry.ability} ${entry.detail}`
    )
      ? "physical"
      : undefined,
    targetClipPriority,
    animationKind,
    detail: `${entry.detail} [GLTF: ${attackerClipPriority[0] ?? "Attack"} → ${
      targetClipPriority[0] ?? "HitReact"
    }]`,
  };
}

function appendCombatLog(
  state: HarthmereCombatState,
  entry: Omit<HarthmereCombatLogEntry, "id" | "at">
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
  result: HitResult = "invalid_target"
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
  damageType: DamageType
) {
  if (damageType === "true") {
    return 0;
  }
  const defensiveValue = ["fire", "ice", "poison", "arcane", "holy"].includes(
    damageType
  )
    ? defender.magicResistance
    : Math.max(defender.defense, defender.armor);
  return clamp(
    defensiveValue / (defensiveValue + attacker.level * 100),
    0,
    0.75
  );
}

function rollHitResult(
  attacker: HarthmereCombatStats,
  defender: HarthmereCombatStats,
  ability: CombatAbility
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
    0.95
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
  ability: CombatAbility
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
  result: HitResult
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
    baseDamage * variance * critModifier * hitModifier * levelModifier
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
  forcedHitResult?: HitResult
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
    result
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
      ? `${attacker.name} ${resultLabel(result)} ${target.name} with ${
          ability.name
        } for ${finalDamage} damage.`
      : `${attacker.name}'s ${ability.name} ${resultLabel(result)} ${
          target.name
        }.`;

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
    `biomes.localDev.harthmere.reputationLock.${lockKey}`
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
  offset: number
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

function reputationForKilledNpc(target: HarthmereCombatStats, offset: number) {
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
  const notorietyGain = isGuard
    ? 900
    : isChild
    ? 1200
    : isMerchant
    ? 420
    : isAnimal
    ? 80
    : 260;

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
    global:
      notorietyGain >= 400
        ? { notoriety: Math.floor(notorietyGain / 4) }
        : undefined,
    personal: { likeability: likePenalty, legal: legalPenalty },
  });
}

function reputationForDefeatedThreat(
  target: HarthmereCombatStats,
  offset: number
) {
  if (
    target.behavior !== "hostile" &&
    !ATTACKABLE_WILDS_ANIMAL_OFFSETS.has(offset)
  ) {
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

type HarthmereRetaliationAttackOptions = {
  /**
   * True when the renderer/forward-arc system has already proven weapon contact.
   * This prevents a second stale range lookup from cancelling retaliation after
   * the player visibly hits an NPC.
   */
  contactProven?: boolean;
  contactSource?: string;
  contactDistance?: number;
  contactReason?: string;
  debugLabel?: string;
};

function ambientThreatForPosition(position: readonly number[]) {
  const [x, , z] = position;
  const inTown = x >= 340 && x <= 650 && z >= -335 && z <= -70;
  if (inTown) {
    return undefined;
  }
  const rollSelector = Math.floor(
    Math.abs(Math.sin(x * 0.021 + z * 0.037) * 1000)
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
  source: string
) {
  let state = readHarthmereCombatState();
  let player = state.player;
  if (["dead", "downed"].includes(player.combatState) || player.hp <= 0) {
    return;
  }
  if (
    ["invulnerable", "protected_after_respawn"].includes(player.combatState)
  ) {
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
    ambientAbility
  );
  const attack = applyAttack(
    state,
    { ...attacker, combatState: "in_combat" },
    player,
    ambientAbility,
    true,
    undefined,
    targetOffset,
    forcedAmbientHitResult
  );
  player = attack.updatedTarget;

  if (player.hp <= 0) {
    player = { ...player, hp: 0, combatState: "downed" };
    markPlayerDownedFromCombat(
      attacker,
      NPC_BASIC_ATTACK,
      attack.finalDamage,
      `${attacker.name} downed you in the Wilds. Respawn at Harthmere or wait for a revive.`
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

function canNpcRetaliate(npc: HarthmereCombatStats) {
  return (
    npc.attackable &&
    npc.hp > 0 &&
    npc.combatState !== "dead" &&
    npc.attackPoints > 0 &&
    !["training_dummy", "quest_anchor", "passive"].includes(npc.behavior)
  );
}

function canNpcRunRealtimeCombat(npc: HarthmereCombatStats) {
  return canNpcRetaliate(npc);
}

function npcRealtimeAttackCadenceMs(npc: HarthmereCombatStats) {
  const attacksPerSecond = Math.max(0.35, npc.attackSpeed);
  return clamp(Math.round(2400 / attacksPerSecond), 850, 4200);
}

function npcRealtimeAbility(npc: HarthmereCombatStats): CombatAbility {
  const text = `${npc.name} ${npc.faction} ${npc.behavior}`.toLowerCase();
  if (npc.behavior === "guard") {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Guard Riposte",
      damageType: "slashing",
    };
  }
  if (npc.behavior === "merchant" || npc.behavior === "defensive") {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Defensive Counter",
      damageType: "physical",
    };
  }
  if (/hex|hexer/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Hex Swipe",
      damageType: "arcane",
      abilityMultiplier: 1.1,
      range: Math.max(2.15, NPC_BASIC_ATTACK.range),
    };
  }
  if (/muck|muckling/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Muck Slam",
      damageType: "blunt",
      abilityMultiplier: 1.06,
    };
  }
  if (
    npc.behavior === "hostile" &&
    /bandit|outlaw|trapper|ambusher|scout/.test(text)
  ) {
    return { ...NPC_BASIC_ATTACK, name: "SideSwing", damageType: "slashing" };
  }
  if (/zombie|undead|corpse|dead/.test(text)) {
    return { ...NPC_BASIC_ATTACK, name: "Scratch", damageType: "physical" };
  }
  if (/bear/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Claw",
      damageType: "slashing",
      abilityMultiplier: 1.18,
    };
  }
  if (/wolf|hound|dog/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Bite",
      damageType: "piercing",
      abilityMultiplier: 1.08,
    };
  }
  if (/boar|stag|deer/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Charge",
      damageType: "blunt",
      abilityMultiplier: 1.12,
    };
  }
  if (/crow|pigeon|chicken|bird/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Peck",
      damageType: "piercing",
      abilityMultiplier: 0.86,
    };
  }
  if (/cat|fox|rat/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Scratch",
      damageType: "slashing",
      abilityMultiplier: 0.92,
    };
  }
  if (/snake/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Bite",
      damageType: "poison",
      abilityMultiplier: 0.94,
    };
  }
  if (/horse|cow|goat|sheep/.test(text)) {
    return {
      ...NPC_BASIC_ATTACK,
      name: "Kick",
      damageType: "blunt",
      abilityMultiplier: 0.9,
    };
  }
  if (npc.species === "animal") {
    return { ...NPC_BASIC_ATTACK, name: "Attack" };
  }
  return NPC_BASIC_ATTACK;
}

function emitHarthmereVoxelNpcMotionV193(
  offset: number,
  npc: HarthmereCombatStats,
  mode: "chase" | "wander",
  reason: string,
  options: {
    targetPos?: [number, number];
    durationMs?: number;
    stopDistance?: number;
  } = {}
) {
  if (!isBrowser()) {
    return;
  }
  const targetPositions = harthmereForwardArcTargetPositions();
  const actor = targetPositions[offset];
  const playerPos = options.targetPos ?? harthmerePlayerCombatPos2();
  const from = actor?.pos;
  const now = Date.now();
  const radius = actor?.radius ?? 1.15;
  const stopDistance =
    options.stopDistance ?? Math.max(1.35, npc.attackRange + radius + 0.35);
  const detail = {
    version: HARTHMERE_NPC_CHASE_REGEN_WANDER_V193,
    offset,
    npc: npc.name,
    mode,
    reason,
    at: now,
    from,
    playerPos,
    targetPos: playerPos,
    speed: clamp(npc.movementSpeed || 2.0, 0.6, 9.0),
    stopDistance,
    durationMs: options.durationMs ?? (mode === "chase" ? 2800 : 1800),
    attackRange: npc.attackRange,
    radius,
    behavior: npc.behavior,
    combatState: npc.combatState,
  };
  const win = window as typeof window & {
    __harthmereVoxelNpcMotionV193?: Record<string, typeof detail>;
    __harthmereVoxelNpcMotionLogV193?: Array<Record<string, unknown>>;
  };
  const key = String(offset);
  win.__harthmereVoxelNpcMotionV193 = {
    ...(win.__harthmereVoxelNpcMotionV193 ?? {}),
    [key]: detail,
  };
  win.__harthmereVoxelNpcMotionLogV193 = [
    detail,
    ...(win.__harthmereVoxelNpcMotionLogV193 ?? []),
  ].slice(0, 160);
  debugHarthmereCombat("combat.ai.chase_motion", detail);
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_NPC_MOTION_EVENT_V193, { detail })
  );
}

function tickHarthmereNpcHealthRegenV193(
  state: HarthmereCombatState,
  now: number,
  source: string
): { state: HarthmereCombatState; mutated: boolean } {
  const updates: Array<Record<string, unknown>> = [];
  let mutated = false;
  let npcs = state.npcs;

  for (const [key, npc] of Object.entries(state.npcs)) {
    const offset = Number(key);
    if (!Number.isFinite(offset)) {
      continue;
    }
    if (
      !npc.attackable ||
      npc.hp <= 0 ||
      npc.combatState === "dead" ||
      npc.hp >= npc.maxHp
    ) {
      continue;
    }
    const brain = harthmereNpcBrainFromState(state, offset);
    const aggroActive = Boolean(
      brain &&
        brain.aggroUntil > now &&
        !["idle", "disengaged", "dead"].includes(brain.phase)
    );
    const damageDelayMs = npc.behavior === "hostile" ? 4500 : 6500;
    const lastDamageAt = npc.lastDamageAt ?? 0;
    const recentlyDamaged =
      lastDamageAt > 0 && now - lastDamageAt < damageDelayMs;
    if (aggroActive || recentlyDamaged) {
      continue;
    }

    const everyMs = 1000;
    const lastRegenAt = npc.lastRegenAt ?? 0;
    if (lastRegenAt > 0 && now - lastRegenAt < everyMs) {
      continue;
    }
    const elapsedMs =
      lastRegenAt > 0 ? Math.max(everyMs, now - lastRegenAt) : everyMs;
    // Resource and monster recovery is intentionally slow: after roughly half a
    // Harthmere day out of combat, a damaged creature should be back at full HP.
    // This keeps hunting pressure meaningful without making the world feel dead.
    const amount = (npc.maxHp * elapsedMs) / HARTHMERE_HALF_DAY_MS_V1;
    const before = npc.hp;
    const after = clamp(before + amount, 0, npc.maxHp);
    if (after <= before) {
      continue;
    }
    const healedNpc: HarthmereCombatStats = {
      ...npc,
      hp: after,
      combatState:
        after >= npc.maxHp && !aggroActive ? "idle" : npc.combatState,
      lastRegenAt: now,
      lastCombatEvent: "hit",
    };
    npcs = {
      ...npcs,
      [key]: healedNpc,
    };
    updates.push({
      offset,
      npc: npc.name,
      hpBefore: before,
      hpAfter: after,
      amount: after - before,
      source,
      reason: "out_of_combat_health_recharge",
    });
    mutated = true;
  }

  if (updates.length > 0) {
    const detail = {
      version: HARTHMERE_NPC_CHASE_REGEN_WANDER_V193,
      source,
      updates,
      at: now,
    };
    if (isBrowser()) {
      const win = window as typeof window & {
        __harthmereNpcHealthRegenLogV193?: Array<Record<string, unknown>>;
      };
      win.__harthmereNpcHealthRegenLogV193 = [
        detail,
        ...(win.__harthmereNpcHealthRegenLogV193 ?? []),
      ].slice(0, 80);
    }
    debugHarthmereCombat("combat.regen.tick", detail);
  }

  return mutated
    ? { state: { ...state, npcs }, mutated: true }
    : { state, mutated: false };
}

function harthmereCombatPoint3From2V1(
  point: [number, number] | undefined
): [number, number, number] | undefined {
  return point ? [point[0], 54, point[1]] : undefined;
}

function maybeEngageUnprovokedMuckMonsterV1(
  state: HarthmereCombatState,
  offset: number,
  npc: HarthmereCombatStats,
  actor: HarthmereForwardArcTargetPosition | undefined,
  now: number
): { state: HarthmereCombatState; engaged: boolean } {
  if (!actor || npc.behavior !== "hostile") {
    return { state, engaged: false };
  }
  if (
    offset === HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1 &&
    !isLiveEntityHelperMuckBossSpawnedV1()
  ) {
    return { state, engaged: false };
  }

  const monsterPosition: [number, number, number] = [
    actor.pos[0],
    54,
    actor.pos[1],
  ];
  const playerPosition = harthmereCombatPoint3From2V1(
    harthmerePlayerCombatPos2()
  );
  if (!playerPosition) {
    return { state, engaged: false };
  }

  const safeZone =
    isLocalDevLiveEntityRobotProtectionAreaSafeForPositionV1(
      monsterPosition
    ) ||
    isLocalDevLiveEntityRobotProtectionAreaSafeForPositionV1(playerPosition);
  const result = evaluateMuckMonsterAggressionV1({
    monsterId: String(offset),
    monsterName: npc.name,
    monsterPosition,
    playerPosition,
    nowMs: now,
    monsterHpPercent: npc.hp / Math.max(1, npc.maxHp),
    safeZone,
    spawnProtected: state.player.combatState === "protected_after_respawn",
    alliesNearby: 0,
    enemiesNearby: 1,
  });

  if (!result.aggressive) {
    if (result.warning) {
      debugHarthmereCombat("combat.ai.muck.warning", {
        offset,
        npc: npc.name,
        reason: result.reason,
        distance: result.distanceToPlayer,
        territoryId: result.territoryId,
      });
    }
    return { state, engaged: false };
  }

  const engagedNpc: HarthmereCombatStats = {
    ...npc,
    combatState: "in_combat",
  };
  let next: HarthmereCombatState = {
    ...state,
    selectedNpcOffset: offset,
    npcs: {
      ...state.npcs,
      [String(offset)]: engagedNpc,
    },
  };
  next = harthmereEngageNpcBrain(
    next,
    offset,
    engagedNpc,
    `muck_unprovoked_${result.decision?.selectedActionId ?? "engage"}`,
    1
  );
  next = appendCombatLog(next, {
    attacker: engagedNpc.name,
    target: state.player.name,
    ability: "Territorial Alert",
    result: "evade",
    rawDamage: 0,
    mitigatedDamage: 0,
    finalDamage: 0,
    targetHpBefore: state.player.hp,
    targetHpAfter: state.player.hp,
    attackerOffset: offset,
    detail: `${engagedNpc.name} notices you crossing the Muck and moves to attack.`,
  });
  debugHarthmereCombat("combat.ai.muck.unprovoked_engage", {
    offset,
    npc: engagedNpc.name,
    territoryId: result.territoryId,
    distance: result.distanceToPlayer,
    archetypeId: result.archetypeId,
    selectedActionId: result.decision?.selectedActionId,
    serverActionRequest: result.decision?.serverActionRequest,
  });
  return { state: next, engaged: true };
}

export function tickHarthmereRealtimeCombatAI(source = "combat_ai") {
  if (!isBrowser()) {
    return;
  }

  const diagWin = window as typeof window & {
    __harthmereRealtimeCombatAiLastTickAt?: number;
    __harthmereRealtimeCombatAiLastSource?: string;
  };
  diagWin.__harthmereRealtimeCombatAiLastTickAt = Date.now();
  diagWin.__harthmereRealtimeCombatAiLastSource = source;

  let state = readHarthmereCombatState();
  let player = state.player;
  if (
    player.hp <= 0 ||
    [
      "dead",
      "downed",
      "respawning",
      "invulnerable",
      "protected_after_respawn",
    ].includes(player.combatState)
  ) {
    return;
  }

  const now = Date.now();
  const targetPositions = harthmereForwardArcTargetPositions();
  const candidateOffsets = new Set<number>();
  for (const key of Object.keys(targetPositions)) {
    const offset = Number(key);
    if (Number.isFinite(offset)) {
      candidateOffsets.add(offset);
    }
  }
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

  const regenV193 = tickHarthmereNpcHealthRegenV193(state, now, source);
  state = regenV193.state;
  mutated = mutated || regenV193.mutated;

  for (const offset of candidateOffsets) {
    const npc = npcStatsFromState(state, offset);
    if (!canNpcRunRealtimeCombat(npc)) {
      continue;
    }

    let brain = harthmereNpcBrainFromState(state, offset);
    if (!brain) {
      const aggression = maybeEngageUnprovokedMuckMonsterV1(
        state,
        offset,
        npc,
        targetPositions[offset],
        now
      );
      if (aggression.engaged) {
        state = aggression.state;
        brain = harthmereNpcBrainFromState(state, offset);
        mutated = true;
      }
    }
    const selectedOrInCombat =
      npc.combatState === "in_combat" || state.selectedNpcOffset === offset;
    if (
      !brain &&
      selectedOrInCombat &&
      harthmereShouldNpcContinueRealtimeCombat(npc)
    ) {
      state = harthmereEngageNpcBrain(
        state,
        offset,
        npc,
        "selected_or_existing_combat",
        1
      );
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
      skipped.push({
        offset,
        name: npc.name,
        phase: "retreating",
        reason: "low_hp",
      });
      mutated = true;
      continue;
    }

    const reachCheck = harthmereNpcCanReachPlayerWithBrain(
      state,
      offset,
      npc,
      "realtime_ai"
    );
    const profile = harthmereNpcBrainProfile(npc);
    const cooldownReady =
      now >=
      Math.max(
        brain.nextAttackAt,
        state.lastNpcAttackAt?.[String(offset)] ?? 0
      );

    if (!reachCheck.canReach) {
      const stillChasing = reachCheck.reason === "pursuing_until_windup_ready";
      if (stillChasing) {
        emitHarthmereVoxelNpcMotionV193(
          offset,
          npc,
          "chase",
          reachCheck.reason,
          {
            targetPos: harthmerePlayerCombatPos2(),
            stopDistance: Math.max(
              1.35,
              npc.attackRange +
                (reachCheck.immediateReach - Math.max(1.15, npc.attackRange))
            ),
            durationMs: Math.max(
              1100,
              Math.min(3600, (reachCheck.closeMs ?? 1200) + 900)
            ),
          }
        );
      }
      const nextPhase: HarthmereNpcBrainPhase = stillChasing
        ? "pursuing"
        : "alert";
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
      emitHarthmereVoxelNpcMotionV193(
        offset,
        npc,
        "chase",
        "windup_face_player",
        {
          targetPos: harthmerePlayerCombatPos2(),
          stopDistance: Math.max(
            1.35,
            npc.attackRange +
              (harthmereForwardArcTargetPositions()[offset]?.radius ?? 1.15) +
              0.25
          ),
          durationMs: profile.windupMs + profile.recoverMs,
        }
      );
      const nextAttackAt = now + profile.windupMs;
      state = harthmereSetNpcBrain(state, offset, {
        ...brain,
        phase: "windup",
        lastThinkAt: now,
        nextAttackAt,
        reason: "windup_before_attack",
        lastKnownPlayerPos:
          harthmerePlayerCombatPos2() ?? brain.lastKnownPlayerPos,
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
      b.brain.threat - a.brain.threat ||
      (a.reachCheck.distance ?? 9999) - (b.reachCheck.distance ?? 9999)
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
    chosen.ability
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
    note: "State-machine AI reached attack phase after aggro/chase/windup; damage is still range-gated and logged.",
  });

  const attack = applyAttack(
    state,
    npcInCombat,
    player,
    chosen.ability,
    true,
    undefined,
    chosen.offset,
    forcedAiHitResult
  );
  let updatedPlayer = attack.updatedTarget;
  state = attack.state;

  if (updatedPlayer.hp <= 0) {
    updatedPlayer = { ...updatedPlayer, hp: 0, combatState: "downed" };
    markPlayerDownedFromCombat(
      chosen.npc,
      chosen.ability,
      attack.finalDamage,
      `${chosen.npc.name} downed you during real-time combat. Respawn at Harthmere or wait for a revive.`
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
    lastDamageToPlayerAt:
      attack.finalDamage > 0 ? now : chosen.brain.lastDamageToPlayerAt,
    nextAttackAt: now + npcRealtimeAttackCadenceMs(updatedAttacker),
    recoverUntil: now + profile.recoverMs,
    reason:
      attack.finalDamage > 0
        ? "attack_hit_recovering"
        : "attack_resolved_recovering",
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
    const diagWin = window as typeof window & {
      __harthmereRealtimeCombatAiMountedAt?: number;
    };
    diagWin.__harthmereRealtimeCombatAiMountedAt = Date.now();
    debugHarthmereCombat("combat.ai.hook.mounted", {
      version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
      intervalMs: 850,
    });
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
  const harthmereLastSafePlayerPositionRef = useRef<
    [number, number, number] | undefined
  >(undefined);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const diagWin = window as typeof window & {
      __harthmereForwardArcRuntimeMountedAt?: number;
    };
    diagWin.__harthmereForwardArcRuntimeMountedAt = Date.now();
    debugHarthmereCombat("combat.forward_runtime.hook.mounted", {
      version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
      sampleMs: 50,
    });

    const writeSnapshot = () => {
      const latestLocalPlayer = reactResources.get("/scene/local_player");
      const snapshot =
        harthmereFacingSnapshotFromLocalPlayer(latestLocalPlayer);
      const collisionAdjustedSnapshot =
        resolveHarthmerePlayerCollisionForSnapshot(
          snapshot,
          latestLocalPlayer,
          harthmereLastSafePlayerPositionRef
        );
      writeHarthmereForwardArcRuntime({
        ...collisionAdjustedSnapshot,
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
    __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
    __harthmereVoxelNpcMotionActorPositionsV193?: Record<string, unknown>;
  };
  const rawSources = [
    win.__harthmereCombatActorPositions,
    win.__harthmereEcsNpcCombatActorPositions,
    win.__harthmereVoxelNpcMotionActorPositionsV193,
  ].filter((raw): raw is Record<string, unknown> =>
    Boolean(raw && typeof raw === "object")
  );

  const actors: Record<number, HarthmereForwardArcTargetPosition> = {};
  for (const raw of rawSources) {
    for (const [key, value] of Object.entries(raw)) {
      const offset = Number(key);
      if (!Number.isFinite(offset) || !value || typeof value !== "object") {
        continue;
      }
      const actor = value as Record<string, unknown>;
      const at = Number(actor.at);
      if (Number.isFinite(at) && Date.now() - at > 3_500) {
        continue;
      }
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
        district:
          typeof actor.district === "string" ? actor.district : undefined,
        species: actor.species as HarthmereCombatStats["species"],
        behavior: actor.behavior as CombatBehavior,
        socialRole: actor.socialRole as HarthmereCombatStats["socialRole"],
        attackable: actor.attackable === false ? false : true,
        clips,
        forward,
        at: Number.isFinite(at) ? at : undefined,
      };
    }
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
  runtime:
    | HarthmereForwardArcRuntimeSnapshot
    | undefined = readHarthmereForwardArcRuntime()
): [number, number] | undefined {
  const position = normalizeHarthmerePosition3(runtime?.position);
  return position ? [position[0], position[2]] : undefined;
}

function harthmereDistanceBetweenPlayerAndTarget(
  offset: number,
  targetPositions: Record<
    number,
    HarthmereForwardArcTargetPosition
  > = harthmereForwardArcTargetPositions(),
  runtime:
    | HarthmereForwardArcRuntimeSnapshot
    | undefined = readHarthmereForwardArcRuntime()
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
  targetPositions: Record<
    number,
    HarthmereForwardArcTargetPosition
  > = harthmereForwardArcTargetPositions()
) {
  const distance = harthmereDistanceBetweenPlayerAndTarget(
    offset,
    targetPositions
  );
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
  const isDefensive =
    npc.behavior === "defensive" || npc.behavior === "merchant";
  const isSmallAnimal = npc.species === "animal" && npc.maxHp <= 160;
  return {
    keepFighting: isGuard || isHostile,
    aggroDurationMs: isGuard
      ? 35_000
      : isHostile
      ? 42_000
      : isDefensive
      ? 12_000
      : 6_000,
    chaseRange: isGuard
      ? Math.max(13, npc.aggroRange + 4)
      : isHostile
      ? Math.max(15, npc.aggroRange + 5)
      : isDefensive
      ? 7.5
      : 4.0,
    immediateLungeGrace: isGuard
      ? 4.6
      : isHostile
      ? 5.2
      : isDefensive
      ? 2.6
      : 1.0,
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
  offset: number
): HarthmereNpcBrainMemory | undefined {
  return state.npcBrains?.[String(offset)];
}

function harthmereSetNpcBrain(
  state: HarthmereCombatState,
  offset: number,
  brain: HarthmereNpcBrainMemory | undefined
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
  threatDelta = 1
): HarthmereCombatState {
  const now = Date.now();
  const profile = harthmereNpcBrainProfile(npc);
  const existing = harthmereNpcBrainFromState(state, offset);
  const playerPos = harthmerePlayerCombatPos2();
  const next: HarthmereNpcBrainMemory = {
    phase:
      npc.hp <= 0 || npc.combatState === "dead"
        ? "dead"
        : existing?.phase &&
          !["idle", "disengaged", "dead"].includes(existing.phase)
        ? existing.phase
        : "alert",
    target: "player",
    aggroUntil: Math.max(
      existing?.aggroUntil ?? 0,
      now + profile.aggroDurationMs
    ),
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
  reason: string
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
  source: "counter" | "realtime_ai" = "realtime_ai"
) {
  const targetPositions = harthmereForwardArcTargetPositions();
  const distance = harthmereDistanceBetweenPlayerAndTarget(
    offset,
    targetPositions
  );
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
    profile.maxVirtualCloseMs
  );
  const aggroActive = Boolean(brain && brain.aggroUntil > now);
  const hasClosedDistance =
    aggroActive && now - (brain?.lastDamagedByPlayerAt ?? now) >= closeMs;
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
  return (
    profile.fleeAtHpRatio > 0 &&
    npc.hp / Math.max(1, npc.maxHp) <= profile.fleeAtHpRatio
  );
}

function runtimeActorText(actor: HarthmereForwardArcTargetPosition) {
  return `${actor.label} ${actor.asset ?? ""} ${
    actor.district ?? ""
  }`.toLowerCase();
}

function runtimeActorSpecies(
  actor: HarthmereForwardArcTargetPosition
): HarthmereCombatStats["species"] {
  if (actor.species) {
    return actor.species;
  }
  const text = runtimeActorText(actor);
  if (/undead|zombie|corpse|gravewood|drowned|dead/.test(text)) {
    return "undead";
  }
  if (
    /animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|pigeon|chicken|bunny|rabbit|pig|muck|muckling|monster|creature|wyrm/.test(
      text
    )
  ) {
    return "animal";
  }
  return "human";
}

function runtimeActorCombatBehavior(
  actor: HarthmereForwardArcTargetPosition
): CombatBehavior {
  if (actor.behavior) {
    return actor.behavior;
  }
  const text = runtimeActorText(actor);
  if (/dummy|training/.test(text)) {
    return "training_dummy";
  }
  if (
    /guard|watch|sentry|patrol|peacekeeper|sergeant|quartermaster/.test(text)
  ) {
    return "guard";
  }
  if (
    /bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|gravewood|muck|muckling|hex|hexer|lesser\s+hexer|greater\s+hexer|monster|creature|enemy|wyrm/.test(
      text
    )
  ) {
    return "hostile";
  }
  if (/wolf|bear|boar|snake|rat/.test(text)) {
    return "hostile";
  }
  if (
    /deer|fox|cat|dog|horse|cow|goat|sheep|pig|chicken|crow|raven|pigeon|frog|bunny|rabbit/.test(
      text
    )
  ) {
    return "defensive";
  }
  if (
    /merchant|vendor|banker|teller|supplier|clerk|registrar|auction/.test(text)
  ) {
    return "merchant";
  }
  return "defensive";
}

function runtimeActorSocialRole(
  actor: HarthmereForwardArcTargetPosition
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
  if (
    /merchant|vendor|banker|teller|supplier|clerk|registrar|auction/.test(text)
  ) {
    return "merchant";
  }
  if (
    /bandit|outlaw|thief|ambusher|trapper|smuggler|undead|zombie|corpse|drowned|muck|muckling|hex|hexer|monster|creature|enemy|wyrm/.test(
      text
    )
  ) {
    return "hostile";
  }
  return "civilian";
}

function statsForRuntimeCombatActor(
  offset: number
): HarthmereCombatStats | undefined {
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
  } else if (/greater\s+hexer|greater.*hex/.test(text)) {
    hp = 620;
    attackPoints = 76;
    armor = 82;
    evasion = 9;
    attackRange = 2.25;
    attackSpeed = 0.76;
  } else if (/lesser\s+hexer|hex|hexer/.test(text)) {
    hp = 420;
    attackPoints = 54;
    armor = 56;
    evasion = 10;
    attackRange = 2.05;
    attackSpeed = 0.82;
  } else if (/mossy\s+muckling|muckling|muck/.test(text)) {
    hp = 300;
    attackPoints = 42;
    armor = 48;
    evasion = 8;
    attackRange = 1.8;
    attackSpeed = 0.92;
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
  } else if (
    /snake|rat|fox|cat|dog|crow|raven|pigeon|chicken|frog|bunny|rabbit/.test(
      text
    )
  ) {
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
      magicResistance: Math.max(
        12,
        Math.floor(armor / (species === "undead" ? 1.5 : 2.5))
      ),
      accuracy: Math.max(
        1,
        level + (behavior === "guard" ? 5 : behavior === "hostile" ? 3 : 0)
      ),
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
    socialRole
  );
}

function normalizeHarthmereForward2(
  value: unknown
): [number, number] | undefined {
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
  value: unknown
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
  snapshot: HarthmereForwardArcRuntimeSnapshot
) {
  if (!isBrowser()) {
    return;
  }

  const position = normalizeHarthmerePosition3(snapshot.position);
  const bodyForward = normalizeHarthmereForward2(snapshot.bodyForward);
  const movementForward = normalizeHarthmereForward2(snapshot.movementForward);
  const viewForward = normalizeHarthmereForward2(snapshot.viewForward);
  const forward = normalizeHarthmereForward2(snapshot.forward) ??
    bodyForward ??
    movementForward ??
    viewForward ?? [0, -1];
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

type HarthmereTownCollisionInspection = {
  name?: string;
  district?: string;
  cx?: number;
  cz?: number;
  halfX?: number;
  halfZ?: number;
  rot?: number;
  padding?: number;
  category?: string;
  blocksPlayer?: boolean;
  reason?: string;
};

type HarthmereTownCollisionQuery = {
  inspectPlayerAt?: (
    x: number,
    z: number
  ) => HarthmereTownCollisionInspection | undefined;
  playerObstacleAt?: (x: number, z: number) => string | undefined;
  containsPlayer?: (x: number, z: number) => boolean;
};

function readHarthmereTownCollisionQuery():
  | HarthmereTownCollisionQuery
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  const win = window as typeof window & {
    __harthmereTownCollisionQuery?: HarthmereTownCollisionQuery;
  };
  return win.__harthmereTownCollisionQuery;
}

function writeHarthmereMutablePosition(
  target: unknown,
  position: [number, number, number]
): boolean {
  if (!target) {
    return false;
  }

  const value = target as Record<string, unknown>;
  try {
    if (Array.isArray(target) && target.length >= 3) {
      target[0] = position[0];
      target[1] = position[1];
      target[2] = position[2];
      return true;
    }

    const set = value.set;
    if (typeof set === "function") {
      set.call(target, position[0], position[1], position[2]);
      return true;
    }

    let changed = false;
    if ("x" in value) {
      value.x = position[0];
      changed = true;
    }
    if ("y" in value) {
      value.y = position[1];
      changed = true;
    }
    if ("z" in value) {
      value.z = position[2];
      changed = true;
    }
    return changed;
  } catch {
    return false;
  }
}

function writeHarthmerePlayerCollisionPosition(
  localPlayer: unknown,
  position: [number, number, number]
): boolean {
  const localRecord = (localPlayer ?? {}) as Record<string, unknown>;
  const player = (localRecord.player ?? localPlayer ?? {}) as Record<
    string,
    unknown
  >;
  const wrotePlayer = writeHarthmereMutablePosition(player.position, position);
  const wroteLocal = writeHarthmereMutablePosition(
    localRecord.position,
    position
  );
  return wrotePlayer || wroteLocal;
}

function nudgeHarthmerePositionOutOfObstacle(
  position: [number, number, number],
  obstacle: HarthmereTownCollisionInspection,
  forward: [number, number] | undefined
): [number, number, number] | undefined {
  const cx = Number(obstacle.cx);
  const cz = Number(obstacle.cz);
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) {
    return undefined;
  }

  let dx = position[0] - cx;
  let dz = position[2] - cz;
  let len = Math.hypot(dx, dz);
  if (len < 0.001) {
    dx = -(forward?.[0] ?? 0);
    dz = -(forward?.[1] ?? -1);
    len = Math.hypot(dx, dz);
  }
  if (len < 0.001) {
    dx = 0;
    dz = 1;
    len = 1;
  }

  const push = Math.max(1.25, Number(obstacle.padding ?? 0.75) + 0.65);
  return [
    position[0] + (dx / len) * push,
    position[1],
    position[2] + (dz / len) * push,
  ];
}

function resolveHarthmerePlayerCollisionForSnapshot(
  snapshot: HarthmereForwardArcRuntimeSnapshot,
  localPlayer: unknown,
  lastSafePositionRef: { current: [number, number, number] | undefined }
): HarthmereForwardArcRuntimeSnapshot {
  const position = normalizeHarthmerePosition3(snapshot.position);
  if (!position) {
    return snapshot;
  }

  const query = readHarthmereTownCollisionQuery();
  const obstacle = query?.inspectPlayerAt?.(position[0], position[2]);
  if (!obstacle?.name) {
    lastSafePositionRef.current = position;
    return snapshot;
  }

  const fallback = nudgeHarthmerePositionOutOfObstacle(
    position,
    obstacle,
    snapshot.forward
  );
  const safePosition = lastSafePositionRef.current ?? fallback;
  if (!safePosition) {
    return snapshot;
  }

  const wrote = writeHarthmerePlayerCollisionPosition(
    localPlayer,
    safePosition
  );
  if (isBrowser()) {
    const win = window as typeof window & {
      __harthmerePlayerCollisionStats?: Record<string, unknown>;
    };
    win.__harthmerePlayerCollisionStats = {
      version: HARTHMERE_TOWN_PLAYER_COLLISION_SAFETY_VERSION,
      obstacle,
      from: position,
      to: safePosition,
      wrote,
      at: Date.now(),
    };
  }

  return {
    ...snapshot,
    position: safePosition,
  };
}

function callReadonlyVec3Method(
  value: unknown
): [number, number, number] | undefined {
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

function harthmereBodyForwardFromYaw(
  yaw: number
): [number, number] | undefined {
  if (!Number.isFinite(yaw)) {
    return undefined;
  }
  // Harthmere local-dev character meshes face the inverse of the raw Biomes
  // yaw basis. This is the source of truth for player melee, sword visuals,
  // and any future hand-held weapon graphics. Do not "fix" this back to
  // [sin(yaw), cos(yaw)] unless the model/root transform is changed too.
  return normalizeHarthmereForward2([-Math.sin(yaw), -Math.cos(yaw)]);
}

function harthmereViewForwardFromYaw(
  yaw: number
): [number, number] | undefined {
  if (!Number.isFinite(yaw)) {
    return undefined;
  }
  // Kept for diagnostics only. View/camera forward is intentionally opposite
  // visible-body forward for these local-dev Harthmere meshes.
  return normalizeHarthmereForward2([Math.sin(yaw), Math.cos(yaw)]);
}

function harthmereFacingSnapshotFromLocalPlayer(
  localPlayer: unknown
): HarthmereForwardArcRuntimeSnapshot {
  const localRecord = (localPlayer ?? {}) as Record<string, unknown>;
  const player = (localRecord.player ?? localPlayer ?? {}) as Record<
    string,
    unknown
  >;
  const position =
    normalizeHarthmerePosition3(player.position) ??
    normalizeHarthmerePosition3(localRecord.position);

  const orientation = player.orientation;
  const yaw =
    Array.isArray(orientation) && orientation.length >= 2
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
  candidateOffsets: number[]
) {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(HARTHMERE_COMBAT_EFFECT_EVENT, {
      detail: {
        id: `forward-arc-${Date.now()}-${Math.floor(
          Math.random() * 1_000_000
        )}`,
        attacker: "You",
        target: "Forward Melee Arc",
        ability:
          ability === "heavy" ? "Forward Heavy Swing" : "Forward Basic Swing",
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
    })
  );
}

function rankedHarthmereForwardArcTargets(
  state: HarthmereCombatState,
  ability: Exclude<HarthmerePlayerAttackType, "spark">,
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined
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
  const baseForward = normalizeHarthmereForward2(runtime?.bodyForward) ??
    normalizeHarthmereForward2(runtime?.forward) ??
    normalizeHarthmereForward2(runtime?.movementForward) ??
    (origin && selectedPosition
      ? normalizeHarthmereForward2([
          selectedPosition[0] - origin[0],
          selectedPosition[1] - origin[1],
        ])
      : undefined) ?? [0, -1];

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
        const alive =
          npc.attackable && npc.hp > 0 && npc.combatState !== "dead";
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
        const withinArc =
          dot >= cosHalfAngle && forwardDistance >= -position.radius;
        const withinForwardLane =
          forwardDistance >= -position.radius &&
          forwardDistance <= reach &&
          lateralDistance <= laneHalfWidth + position.radius;
        const closeBodyContact =
          distance <= position.radius + 1.85 && dot >= -0.2;
        const accepted =
          alive &&
          (withinArc || withinForwardLane || closeBodyContact) &&
          withinRange;

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
        Boolean(candidate)
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

  const inverseForward = normalizeHarthmereForward2([
    -baseForward[0],
    -baseForward[1],
  ]) ?? [0, 1];
  const inverse = evaluateForward(inverseForward);
  const selectedBase = evaluated.find(
    (candidate) => candidate.offset === state.selectedNpcOffset
  );
  const selectedInverse = inverse.evaluated.find(
    (candidate) => candidate.offset === state.selectedNpcOffset
  );
  const inverseBetterForSelected = Boolean(
    selectedInverse?.accepted &&
      (!selectedBase?.accepted ||
        selectedInverse.score + 0.1 < selectedBase.score)
  );

  if (
    (candidates.length === 0 && inverse.candidates.length > 0) ||
    inverseBetterForSelected
  ) {
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

  if (
    candidates.length === 0 &&
    state.selectedNpcOffset !== undefined &&
    origin
  ) {
    const selected = evaluated.find(
      (candidate) => candidate.offset === state.selectedNpcOffset
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

  const runtimeActorsForDebug = readHarthmereRuntimeCombatActors();
  const ecsNpcActorsForDebug = isBrowser()
    ? Object.keys(
        (
          window as typeof window & {
            __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
          }
        ).__harthmereEcsNpcCombatActorPositions ?? {}
      ).map(Number)
    : [];
  debugHarthmereCombat("forward_arc.actor_registry", {
    registeredActorOffsets: Object.keys(runtimeActorsForDebug).map(Number),
    ecsNpcActorOffsets: ecsNpcActorsForDebug,
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
  runtime:
    | HarthmereForwardArcRuntimeSnapshot
    | undefined = readHarthmereForwardArcRuntime()
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
        "dead"
      )
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
    arc.candidateOffsets
  );

  if (hitOffsets.length === 0) {
    writeHarthmereCombatState(
      appendCombatLog(state, {
        attacker: player.name,
        target: "Forward Arc",
        ability:
          ability === "heavy" ? "Heavy Attack Sweep" : "Basic Attack Sweep",
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
      } as unknown as Omit<HarthmereCombatLogEntry, "id" | "at">)
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
    performHarthmereCombatAttack(hit.offset, ability, {
      contactProven: true,
      contactSource: "forward_arc",
      contactDistance: hit.distance,
      contactReason: "visible_player_swing_hit_actor",
      debugLabel: `forward_arc:${ability}`,
    });
    state = readHarthmereCombatState();
  }

  return { hitOffsets, candidateOffsets: arc.candidateOffsets };
}

export function performHarthmereCombatAttack(
  targetOffset: number,
  ability: HarthmerePlayerAttackType = "basic",
  retaliationOptions: HarthmereRetaliationAttackOptions = {}
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

  if (
    targetOffset === HARTHMERE_LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET_V1 &&
    !isLiveEntityHelperMuckBossSpawnedV1()
  ) {
    writeHarthmereCombatState(
      invalidLog(
        state,
        target,
        "The Muck-Scarred Helix has not surfaced yet. Accept a Muck breach request before hunting it.",
        "evade"
      )
    );
    return;
  }

  if (["dead", "downed"].includes(player.combatState) || player.hp <= 0) {
    writeHarthmereCombatState(
      invalidLog(
        state,
        target,
        "You are downed and cannot attack. Revive or respawn first.",
        "dead"
      )
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
      invalidLog(state, target, `${target.name} is not attackable.`, "immune")
    );
    return;
  }

  if (target.combatState === "dead" || target.hp <= 0) {
    writeHarthmereCombatState(
      invalidLog(
        state,
        target,
        `${target.name} is already defeated. Respawn or reset combat to fight again.`,
        "dead"
      )
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
          weapon
        );
  const effectivePlayer =
    ability === "spark"
      ? {
          ...player,
          attackPoints: Math.max(
            1,
            Math.round(
              player.attackPoints * 0.72 + player.magicResistance * 0.18
            )
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
    forcedPlayerHitResult
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
      playerAttack.finalDamage > 0
        ? "player_damaged_npc"
        : "player_weapon_blocked",
      Math.max(1, playerAttack.finalDamage)
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

  const reachCheck = harthmereNpcCanReachPlayerWithBrain(
    state,
    targetOffset,
    target,
    "counter"
  );
  const recentlyCounteredAt = state.lastNpcAttackAt?.[contributionKey] ?? 0;
  const counterCooldownReady = Date.now() - recentlyCounteredAt >= 1200;
  const implicitMeleeContact =
    ability !== "spark" &&
    playerAttack.finalDamage > 0 &&
    retaliationOptions.contactProven !== false;
  const contactProven =
    playerAttack.finalDamage > 0 &&
    (retaliationOptions.contactProven === true || implicitMeleeContact);
  const effectiveRetaliationOptions: HarthmereRetaliationAttackOptions = {
    ...(implicitMeleeContact && !retaliationOptions.contactSource
      ? {
          contactSource: "direct_melee_damage",
          contactReason: "melee_damage_implies_contact",
          debugLabel: `direct:${ability}`,
        }
      : {}),
    ...retaliationOptions,
    contactProven,
  };
  const retaliationReachOk = reachCheck.canReach || contactProven;
  const canCounterattack =
    playerAttack.finalDamage > 0 &&
    canNpcRetaliate(target) &&
    // HP is the authoritative death gate for this counter path. Avoid a direct
    // combatState !== "dead" comparison here because TypeScript can narrow the
    // local target state differently across patched branches.
    counterCooldownReady &&
    retaliationReachOk;

  debugHarthmereCombat("combat.countercheck", {
    targetOffset,
    target: target.name,
    behavior: target.behavior,
    playerFinalDamage: playerAttack.finalDamage,
    canCounterattack,
    canNpcRetaliate: canNpcRetaliate(target),
    counterCooldownReady,
    reachCheck,
    contactProven,
    retaliationReachOk,
    retaliationOptions: effectiveRetaliationOptions,
  });

  if (canCounterattack) {
    const counterAbility = npcRealtimeAbility(target);
    const forcedCounterHitResult = rollHarthmereContactHitResult(
      target,
      player,
      counterAbility
    );
    debugHarthmereCombat("fight.ai.retaliate", {
      attacker: target.name,
      target: player.name,
      targetOffset,
      ability: counterAbility.name,
      forcedCounterHitResult,
      reachCheck,
      contactProven,
      retaliationOptions: effectiveRetaliationOptions,
      note: contactProven
        ? "Counterattack used renderer-proven contact from the player hit; no stale second range lookup can cancel retaliation."
        : "Counterattack is range-gated first, then resolved as contact damage so retaliation is visible and testable.",
    });

    const counterAttack = applyAttack(
      state,
      target,
      player,
      counterAbility,
      true,
      undefined,
      targetOffset,
      forcedCounterHitResult
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
        `${target.name} downed you while defending themself. You can wait for a revive or respawn at a safe Harthmere point.`
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
        aggroUntil:
          Date.now() + harthmereNpcBrainProfile(updatedNpc).aggroDurationMs,
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
  } else if (
    !canCounterattack &&
    target.attackable &&
    target.hp > 0 &&
    target.attackPoints > 0
  ) {
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
          : !retaliationReachOk
          ? "target cannot physically reach player and no renderer-proven contact was supplied"
          : !counterCooldownReady
          ? "counter cooldown"
          : !canNpcRetaliate(target)
          ? "npc is not eligible to retaliate"
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

interface HarthmereNativeNpcAttackContactHitV189 {
  id?: number | string;
  entityId?: number | string;
  offset?: number | string;
  label?: string;
}

interface HarthmereNativeNpcAttackContactDetailV189 {
  version?: string;
  source?: string;
  attack?: HarthmerePlayerAttackType;
  at?: number;
  hits?: HarthmereNativeNpcAttackContactHitV189[];
}

function installHarthmereNativeNpcAttackDamageBridgeV189() {
  if (!isBrowser()) {
    return;
  }

  const win = window as typeof window & {
    __harthmereNativeNpcAttackDamageBridgeVersionV189?: string;
    __harthmereNativeNpcAttackDamageBridgeCleanupV189?: () => void;
    __harthmereNativeNpcAttackDamageBridgeLogV189?: unknown[];
  };

  if (
    win.__harthmereNativeNpcAttackDamageBridgeVersionV189 ===
      HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189 &&
    typeof win.__harthmereNativeNpcAttackDamageBridgeCleanupV189 === "function"
  ) {
    return;
  }

  win.__harthmereNativeNpcAttackDamageBridgeCleanupV189?.();
  const recentlyResolved = new Map<number, number>();

  const pushLog = (entry: Record<string, unknown>) => {
    const logged = { at: Date.now(), ...entry };
    win.__harthmereNativeNpcAttackDamageBridgeLogV189 = [
      logged,
      ...(win.__harthmereNativeNpcAttackDamageBridgeLogV189 ?? []),
    ].slice(0, 120);
    if (
      window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") ===
      "1"
    ) {
      console.info("[HarthmereNativeNpcAttackBridgeV189]", logged);
    }
  };

  const handler = (event: Event) => {
    const detail = (
      event as CustomEvent<HarthmereNativeNpcAttackContactDetailV189>
    ).detail;
    const hits = Array.isArray(detail?.hits) ? detail.hits : [];
    if (hits.length === 0) {
      pushLog({ type: "ignored", reason: "no_hits", detail });
      return;
    }

    const ability: HarthmerePlayerAttackType =
      detail.attack === "heavy" || detail.attack === "spark"
        ? detail.attack
        : "basic";
    const resolvedOffsets: number[] = [];
    const skipped: unknown[] = [];

    for (const hit of hits.slice(0, 8)) {
      const offset = Number(hit.id ?? hit.entityId ?? hit.offset);
      if (!Number.isFinite(offset)) {
        skipped.push({ hit, reason: "invalid_offset" });
        continue;
      }

      const nowMs = Date.now();
      const lastResolvedAt = recentlyResolved.get(offset) ?? 0;
      if (nowMs - lastResolvedAt < 180) {
        skipped.push({ offset, label: hit.label, reason: "dedupe_window" });
        continue;
      }

      const target = npcStatsFromState(readHarthmereCombatState(), offset);
      if (
        !target.attackable ||
        target.hp <= 0 ||
        target.combatState === "dead"
      ) {
        skipped.push({
          offset,
          label: hit.label ?? target.name,
          reason: "not_live_attackable",
          attackable: target.attackable,
          hp: target.hp,
          combatState: target.combatState,
        });
        continue;
      }

      recentlyResolved.set(offset, nowMs);
      resolvedOffsets.push(offset);
      pushLog({
        type: "resolve",
        offset,
        label: hit.label ?? target.name,
        targetName: target.name,
        ability,
        source: detail.source,
      });
      performHarthmereCombatAttack(offset, ability, {
        contactProven: true,
        contactSource: "native_attack_interaction",
        contactReason:
          "Biomes native handleAttackInteraction already confirmed this ECS NPC was hit.",
        debugLabel: `native_hit_bridge_v189:${ability}`,
      });
    }

    pushLog({
      type: "summary",
      version: HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189,
      ability,
      hitCount: hits.length,
      resolvedOffsets,
      skipped,
    });
  };

  window.addEventListener(
    HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189,
    handler
  );
  win.__harthmereNativeNpcAttackDamageBridgeCleanupV189 = () => {
    window.removeEventListener(
      HARTHMERE_NATIVE_NPC_ATTACK_CONTACT_EVENT_V189,
      handler
    );
  };
  win.__harthmereNativeNpcAttackDamageBridgeVersionV189 =
    HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189;
  pushLog({
    type: "installed",
    version: HARTHMERE_NATIVE_NPC_ATTACK_DAMAGE_BRIDGE_V189,
  });
}

installHarthmereNativeNpcAttackDamageBridgeV189();

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
        detail: `${target.name} is noted as ${target.behavior.replaceAll(
          "_",
          " "
        )} in the local-dev combat notes. Exact numbers stay in the combat menu, not conversation text.`,
      }
    )
  );
}

export function resetHarthmereCombat() {
  writeHarthmereCombatState(normalizeState(undefined));
}

export function resetHarthmereCombatNpc(offset: number) {
  const state = readHarthmereCombatState();
  const key = String(offset);
  const npcs = { ...state.npcs };
  const killCredit = { ...state.killCredit };
  const lastNpcAttackAt = { ...state.lastNpcAttackAt };
  const npcBrains = { ...(state.npcBrains ?? {}) };
  delete npcs[key];
  delete killCredit[key];
  delete lastNpcAttackAt[key];
  delete npcBrains[key];
  writeHarthmereCombatState({
    ...state,
    selectedNpcOffset:
      state.selectedNpcOffset === offset ? undefined : state.selectedNpcOffset,
    npcs,
    killCredit,
    lastNpcAttackAt,
    npcBrains,
  });
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
      })
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
        "You released from downed state. Choose a safe respawn point to return."
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

export function endHarthmereRespawnProtection(
  detail = "Respawn protection expired."
) {
  const state = readHarthmereCombatState();
  const current = readRawDeathState();
  writeRawDeathState({
    version: 1,
    ...(current ?? {}),
    state: "alive",
    currentDeath: undefined,
    downedUntil: undefined,
    forcedRespawnAt: undefined,
    protectionUntil: undefined,
    recent: [
      deathLogEntry("Protection Ended", detail),
      ...(current?.recent ?? []),
    ].slice(0, 12),
  });
  if (state.player.combatState !== "protected_after_respawn") {
    return;
  }
  writeHarthmereCombatState({
    ...appendCombatLog(state, {
      attacker: "Death System",
      target: state.player.name,
      ability: "Protection Ended",
      result: "normal_hit",
      rawDamage: 0,
      mitigatedDamage: 0,
      finalDamage: 0,
      targetHpBefore: state.player.hp,
      targetHpAfter: state.player.hp,
      detail,
    }),
    player: { ...state.player, combatState: "idle" },
  });
}

export function respawnHarthmerePlayer(respawnId = "temple_green") {
  const state = readHarthmereCombatState();
  const respawnRules: Record<
    string,
    { label: string; hpPercent: number; sicknessSeconds: number }
  > = {
    the_grove: {
      label: "The Grove",
      hpPercent: 0.65,
      sicknessSeconds: 75,
    },
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
    rule.sicknessSeconds
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
    readHarthmereCombatState()
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
      <div className="rounded h-2 overflow-hidden bg-white/10">
        <div
          className="rounded bg-red-400 h-full"
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
  offset: number
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
      tooltip:
        "Tests attackable wildlife that flees or defends instead of behaving like a town NPC.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_FOREST_DEER_OFFSET),
    });
    actions.push({
      name: "Fight a diseased boar",
      tooltip:
        "Tests a hostile animal target tied to forest/orchard resource danger.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_DISEASED_BOAR_OFFSET),
    });
    actions.push({
      name: "Fight a black bear",
      tooltip: "Tests a dangerous deep-forest animal target.",
      onPerformed: () =>
        performHarthmereCombatAttack(HARTHMERE_BLACK_BEAR_OFFSET),
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
      className="rounded-lg border-red-300/30 pointer-events-none w-[21rem] border bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-red-200 text-sm font-semibold uppercase tracking-wide">
            Harthmere Combat
          </div>
          <div className="text-xs text-white/75">
            Weapon: {weaponStatusLabel()}
          </div>
        </div>
        <div className="rounded bg-red-300/20 px-1.5 py-0.5 text-red-100 text-xs font-semibold">
          HP
        </div>
      </div>
      <div className="space-y-2">
        <CombatBar stats={state.player} />
        {target ? <CombatBar stats={target} /> : null}
      </div>
      {latest && (
        <div className="rounded p-1.5 mt-2 border border-white/10 bg-white/5 text-[11px] leading-snug text-white/80">
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
  const playerAttackBlock = getHarthmereCombatantActionBlockReasonV1(
    state.player
  );
  const targetAttackBlock =
    target && (target.hp <= 0 || target.combatState === "dead")
      ? "Target is already defeated."
      : undefined;
  const attackBlock = playerAttackBlock ?? targetAttackBlock;
  const hitChance = target
    ? clamp(
        0.8 + state.player.accuracy / 100 - target.evasion / 100,
        0.05,
        0.95
      )
    : undefined;

  return (
    <div className="rounded-lg border-red-300/25 pointer-events-auto mt-2 max-h-[55vh] w-[26rem] overflow-y-auto border bg-black/75 p-3 text-white shadow-xl">
      <div className="mb-2">
        <div className="text-base text-red-200 font-bold">Harthmere Combat</div>
        <div className="text-xs text-white/75">
          Local-dev combat follows the MMO pipeline: target check, range check,
          hit check, defense, damage, effects, death, credit, and consequences.
        </div>
      </div>

      <div className="rounded mb-2 grid grid-cols-2 gap-2 border border-white/10 bg-white/5 p-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-white">Player</div>
          <StatLine
            label="HP"
            value={`${state.player.hp}/${state.player.maxHp}`}
          />
          <StatLine label="State" value={state.player.combatState} />
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
          <span className="font-semibold text-white">NPC behavior:</span>{" "}
          guards, hostiles, merchants, defensive civilians, and dangerous
          animals can retaliate; passive targets flee, and training dummies
          never retaliate.
        </div>
        <div>
          <span className="font-semibold text-white">Consequences:</span>{" "}
          attacking civilians or guards changes Harthmere
          legal/likeability/notoriety.
        </div>
      </div>

      <div className="rounded border-emerald-300/20 bg-emerald-950/20 text-emerald-50/80 mb-2 border p-2 text-[11px] leading-snug">
        <div className="text-emerald-100 mb-1 text-xs font-bold">
          Action → GLTF clip map
        </div>
        <div>B / Basic Attack → Attack, Attack2, SideSwing, Thrusting</div>
        <div>H / Heavy Attack → HeavyAttack, Attack2, SideSwing</div>
        <div>L / Spark → BasicMagic, HeavyMagic</div>
        <div>
          Animal counters → Bite, Claw, Pounce, Charge, Peck, Scratch, Kick,
          TailWhip
        </div>
        <div>Reactions → HitReact, Block, ShieldBlock, Dodging, Death</div>
      </div>

      {target && (
        <div className="rounded border-red-300/15 mb-2 flex flex-wrap gap-2 border bg-black/25 p-2">
          <button
            className="rounded bg-red-400/20 text-red-50 hover:bg-red-400/30 px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={Boolean(attackBlock)}
            onClick={() =>
              performHarthmereCombatAttack(
                state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET,
                "basic"
              )
            }
            title={attackBlock}
          >
            Basic Attack → Attack
          </button>
          <button
            className="rounded bg-red-400/20 text-red-50 hover:bg-red-400/30 px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={Boolean(attackBlock)}
            onClick={() =>
              performHarthmereCombatAttack(
                state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET,
                "heavy"
              )
            }
            title={attackBlock}
          >
            Heavy Attack → HeavyAttack
          </button>
          <button
            className="rounded bg-violet-400/20 text-violet-50 hover:bg-violet-400/30 px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={Boolean(attackBlock)}
            onClick={() =>
              performHarthmereCombatAttack(
                state.selectedNpcOffset ?? HARTHMERE_TRAINING_DUMMY_OFFSET,
                "spark"
              )
            }
            title={attackBlock}
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

function harthmereDebugTargetingAbility(
  ability: HarthmerePlayerAttackType = "basic"
): Exclude<HarthmerePlayerAttackType, "spark"> {
  return ability === "heavy" ? "heavy" : "basic";
}

function autoResolveHarthmereNearbyNpcForDiagnostics(
  ability: HarthmerePlayerAttackType = "basic"
) {
  const state = readHarthmereCombatState();
  const runtime = readHarthmereForwardArcRuntime();
  const targetingAbility = harthmereDebugTargetingAbility(ability);
  const arc = rankedHarthmereForwardArcTargets(
    state,
    targetingAbility,
    runtime
  );
  const firstAccepted = arc.candidates[0];
  const nearestAliveAttackable = arc.nearest.find((candidate) => {
    const npc = npcStatsFromState(state, Number(candidate.offset));
    return npc.attackable && npc.hp > 0 && npc.combatState !== "dead";
  });
  const offset =
    firstAccepted?.offset ??
    (nearestAliveAttackable
      ? Number(nearestAliveAttackable.offset)
      : undefined);

  const source = firstAccepted
    ? "accepted_forward_target"
    : nearestAliveAttackable
    ? "nearest_alive_attackable"
    : "none";

  return {
    version: HARTHMERE_RETALIATION_NEAREST_DIAGNOSTICS_V184,
    ability,
    targetingAbility,
    source,
    offset,
    target: offset !== undefined ? npcStatsFromState(state, offset) : undefined,
    runtime,
    candidateOffsets: arc.candidateOffsets,
    hitOffsets: arc.candidates.map((candidate) => candidate.offset),
    nearest: arc.nearest,
    reason:
      offset !== undefined
        ? `Using ${source} ${offset} near the current player/runtime position.`
        : "No nearby attackable NPC is available from the renderer actor registry or combat state.",
  };
}

function currentHarthmereDebugTargetOffset(
  offset?: number,
  ability: HarthmerePlayerAttackType = "basic"
): number {
  if (Number.isFinite(Number(offset))) {
    return Number(offset);
  }
  const auto = autoResolveHarthmereNearbyNpcForDiagnostics(ability);
  if (Number.isFinite(Number(auto.offset))) {
    return Number(auto.offset);
  }
  const state = readHarthmereCombatState();
  if (Number.isFinite(Number(state.selectedNpcOffset))) {
    return Number(state.selectedNpcOffset);
  }
  return HARTHMERE_ROAD_BANDIT_OFFSET;
}

function inspectHarthmereRetaliation(offset?: number) {
  const targetOffset = currentHarthmereDebugTargetOffset(offset);
  const state = readHarthmereCombatState();
  const target = npcStatsFromState(state, targetOffset);
  const brain = harthmereNpcBrainFromState(state, targetOffset);
  const actor = readHarthmereRuntimeCombatActors()[targetOffset];
  const runtime = readHarthmereForwardArcRuntime();
  const reachCheck = harthmereNpcCanReachPlayerWithBrain(
    state,
    targetOffset,
    target,
    "counter"
  );
  const lastNpcAttackAt = state.lastNpcAttackAt?.[String(targetOffset)] ?? 0;
  const now = Date.now();
  const counterCooldownReady = now - lastNpcAttackAt >= 1200;
  const blockers: string[] = [];
  if (!target.attackable) blockers.push("target.attackable is false");
  if (target.hp <= 0 || target.combatState === "dead")
    blockers.push("target is dead");
  if (target.attackPoints <= 0) blockers.push("target.attackPoints is 0");
  if (["training_dummy", "quest_anchor", "passive"].includes(target.behavior)) {
    blockers.push(`behavior ${target.behavior} is not allowed to retaliate`);
  }
  if (!counterCooldownReady) blockers.push("counter cooldown is still active");
  if (!reachCheck.canReach)
    blockers.push(`range check says ${reachCheck.reason}`);
  if (!actor && targetOffset >= 10_000)
    blockers.push("runtime actor is not registered this frame");
  if (!runtime?.position)
    blockers.push("player combat runtime position is missing");

  const recent = state.recent
    .filter(
      (entry) =>
        entry.targetOffset === targetOffset ||
        entry.attackerOffset === targetOffset
    )
    .slice(0, 6);
  const probe = {
    version: HARTHMERE_NPC_RETALIATION_RUNTIME_V154,
    offset: targetOffset,
    target,
    actor,
    player: state.player,
    runtime,
    brain,
    reachCheck,
    canNpcRetaliate: canNpcRetaliate(target),
    canNpcRunRealtimeCombat: canNpcRunRealtimeCombat(target),
    counterCooldownReady,
    lastNpcAttackAgoMs: lastNpcAttackAt ? now - lastNpcAttackAt : undefined,
    blockers,
    recent,
    advice:
      blockers.length === 0
        ? "This NPC should retaliate immediately when hit or during the next AI tick."
        : "Check blockers. If range is the only blocker after a visible sword hit, the contact-proven path should still counterattack.",
  };
  debugHarthmereCombat(
    "combat.retaliation.probe",
    probe as unknown as Record<string, unknown>
  );
  return probe;
}

function harthmereRetaliationHookStatus() {
  if (!isBrowser()) {
    return { browser: false };
  }
  const win = window as typeof window & {
    __harthmereRealtimeCombatAiMountedAt?: number;
    __harthmereRealtimeCombatAiLastTickAt?: number;
    __harthmereRealtimeCombatAiLastSource?: string;
    __harthmereForwardArcRuntimeMountedAt?: number;
  };
  const now = Date.now();
  const runtime = readHarthmereForwardArcRuntime();
  const actors = readHarthmereRuntimeCombatActors();
  return {
    browser: true,
    version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
    now,
    realtimeAiMountedAt: win.__harthmereRealtimeCombatAiMountedAt,
    realtimeAiMountedAgeMs: win.__harthmereRealtimeCombatAiMountedAt
      ? now - win.__harthmereRealtimeCombatAiMountedAt
      : undefined,
    realtimeAiLastTickAt: win.__harthmereRealtimeCombatAiLastTickAt,
    realtimeAiLastTickAgeMs: win.__harthmereRealtimeCombatAiLastTickAt
      ? now - win.__harthmereRealtimeCombatAiLastTickAt
      : undefined,
    realtimeAiLastSource: win.__harthmereRealtimeCombatAiLastSource,
    forwardRuntimeMountedAt: win.__harthmereForwardArcRuntimeMountedAt,
    forwardRuntimeMountedAgeMs: win.__harthmereForwardArcRuntimeMountedAt
      ? now - win.__harthmereForwardArcRuntimeMountedAt
      : undefined,
    forwardRuntimeAt: runtime?.at,
    forwardRuntimeAgeMs: runtime?.at ? now - runtime.at : undefined,
    forwardRuntimeHasPosition: Boolean(runtime?.position),
    actorCount: Object.keys(actors).length,
  };
}

function harthmereCombatDebugLogTail(limit = 30) {
  if (!isBrowser()) {
    return [];
  }
  const win = window as typeof window & {
    __harthmereCombatDebugLog?: unknown[];
  };
  return (win.__harthmereCombatDebugLog ?? []).slice(0, Math.max(1, limit));
}

function inferHarthmereRetaliationLikelyCause(
  probe: ReturnType<typeof inspectHarthmereRetaliation>,
  hooks: ReturnType<typeof harthmereRetaliationHookStatus>
) {
  const hookRecord = hooks as Record<string, unknown>;
  if (!hookRecord.realtimeAiMountedAt) {
    return "Realtime combat AI hook is not mounted. Check HarthmereUnifiedHUD/useHarthmereRealtimeCombatAI.";
  }
  if (!hookRecord.forwardRuntimeHasPosition) {
    return "Player forward/runtime position is missing. Retaliation range cannot be computed.";
  }
  if (Number(hookRecord.actorCount ?? 0) <= 0) {
    return "Renderer has not published combat actors. The fight system may not know where enemies are.";
  }
  if (probe.blockers.length > 0) {
    return `Probe blockers: ${probe.blockers.join("; ")}`;
  }
  const latestCombat = probe.recent[0];
  if (!latestCombat) {
    return "No recent combat log entry for this target. The click/key may only be playing an animation, not calling performHarthmereCombatAttack for this NPC offset.";
  }
  if (
    latestCombat.target === probe.target.name &&
    latestCombat.finalDamage <= 0
  ) {
    return "The player attack reached the target but dealt no HP damage, so retaliation may not engage.";
  }
  if (!probe.brain) {
    return "Target has no NPC brain after the hit. The attack path did not engage realtime retaliation memory.";
  }
  if (!probe.canNpcRetaliate) {
    return "Target stats say it cannot retaliate even though it is visible/attackable.";
  }
  return "No obvious blocker. Use diagnoseAsync(offset) to attack, tick AI, and capture countercheck/range-skip stages.";
}

function summarizeHarthmereRetaliation(offset?: number) {
  const probe = inspectHarthmereRetaliation(offset);
  const hooks = harthmereRetaliationHookStatus();
  const actors = readHarthmereRuntimeCombatActors();
  const nearest = nearestHarthmereCombatTargets(15);
  const targetSelection = autoResolveHarthmereNearbyNpcForDiagnostics("basic");
  const debugTail = harthmereCombatDebugLogTail(40);
  const latestCounterDebug = debugTail.find((entry) => {
    const stage = (entry as Record<string, unknown>)?.stage;
    return (
      stage === "combat.countercheck" ||
      stage === "combat.counter_skip" ||
      stage === "combat.ai.range_skip" ||
      stage === "fight.ai.retaliate"
    );
  });
  const report = {
    version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
    offset: probe.offset,
    targetName: probe.target.name,
    hooks,
    probe,
    actor: actors[probe.offset],
    nearest,
    targetSelection,
    latestCounterDebug,
    debugTail,
    likelyCause: inferHarthmereRetaliationLikelyCause(probe, hooks),
  };
  debugHarthmereCombat(
    "combat.retaliation.summary",
    report as unknown as Record<string, unknown>
  );
  return report;
}

function diagnoseHarthmereRetaliation(
  offset?: number,
  ability: HarthmerePlayerAttackType = "basic"
) {
  const targetOffset = currentHarthmereDebugTargetOffset(offset, ability);
  const before = summarizeHarthmereRetaliation(targetOffset);
  performHarthmereCombatAttack(targetOffset, ability, {
    contactProven: ability !== "spark",
    contactSource: "retaliation_diagnostics_v183",
    contactReason:
      "diagnostic attack should prove whether counterattack or AI tick can answer",
    debugLabel: `diagnose:${ability}`,
  });
  const afterAttack = summarizeHarthmereRetaliation(targetOffset);
  tickHarthmereRealtimeCombatAI("retaliation_diagnostics_v183_immediate");
  const afterImmediateTick = summarizeHarthmereRetaliation(targetOffset);
  const report = {
    version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
    mode: "sync",
    ability,
    targetOffset,
    before,
    afterAttack,
    afterImmediateTick,
    log: harthmereCombatDebugLogTail(80),
  };
  debugHarthmereCombat(
    "combat.retaliation.diagnose",
    report as unknown as Record<string, unknown>
  );
  return report;
}

function waitHarthmereRetaliationDiagnostics(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function diagnoseHarthmereRetaliationAsync(
  offset?: number,
  ability: HarthmerePlayerAttackType = "basic"
) {
  const targetOffset = currentHarthmereDebugTargetOffset(offset, ability);
  const before = summarizeHarthmereRetaliation(targetOffset);
  performHarthmereCombatAttack(targetOffset, ability, {
    contactProven: ability !== "spark",
    contactSource: "retaliation_diagnostics_v183_async",
    contactReason: "async diagnostic attack follows windup/recovery windows",
    debugLabel: `diagnoseAsync:${ability}`,
  });
  const afterAttack = summarizeHarthmereRetaliation(targetOffset);
  tickHarthmereRealtimeCombatAI("retaliation_diagnostics_v183_after_attack");
  await waitHarthmereRetaliationDiagnostics(750);
  tickHarthmereRealtimeCombatAI("retaliation_diagnostics_v183_after_windup");
  const afterWindup = summarizeHarthmereRetaliation(targetOffset);
  await waitHarthmereRetaliationDiagnostics(1100);
  tickHarthmereRealtimeCombatAI("retaliation_diagnostics_v183_after_recovery");
  const afterRecovery = summarizeHarthmereRetaliation(targetOffset);
  const report = {
    version: HARTHMERE_RETALIATION_DIAGNOSTICS_V183,
    mode: "async",
    ability,
    targetOffset,
    before,
    afterAttack,
    afterWindup,
    afterRecovery,
    log: harthmereCombatDebugLogTail(120),
  };
  debugHarthmereCombat(
    "combat.retaliation.diagnose_async",
    report as unknown as Record<string, unknown>
  );
  return report;
}

function nearestHarthmereCombatTargets(limit = 12) {
  const state = readHarthmereCombatState();
  const runtime = readHarthmereForwardArcRuntime();
  const arc = rankedHarthmereForwardArcTargets(state, "basic", runtime);
  return {
    version: HARTHMERE_NPC_RETALIATION_RUNTIME_V154,
    runtime,
    hitOffsets: arc.candidates.map((candidate) => candidate.offset),
    nearest: arc.nearest.slice(0, Math.max(1, Number(limit) || 12)),
    actors: readHarthmereRuntimeCombatActors(),
  };
}

function forceHarthmereNpcRetaliation(offset?: number) {
  const targetOffset = currentHarthmereDebugTargetOffset(offset, "basic");
  const before = inspectHarthmereRetaliation(targetOffset);
  let state = readHarthmereCombatState();
  const target = npcStatsFromState(state, targetOffset);
  if (!canNpcRetaliate(target)) {
    return { ok: false, reason: "npc cannot retaliate", before };
  }
  state = harthmereEngageNpcBrain(
    state,
    targetOffset,
    { ...target, combatState: "in_combat" },
    "debug_force_retaliation",
    Math.max(1, target.threatValue || target.attackPoints || 1)
  );
  writeHarthmereCombatState({
    ...state,
    selectedNpcOffset: targetOffset,
    npcs: {
      ...state.npcs,
      [String(targetOffset)]: { ...target, combatState: "in_combat" },
    },
  });
  tickHarthmereRealtimeCombatAI("debug_force_retaliation");
  const after = inspectHarthmereRetaliation(targetOffset);
  debugHarthmereCombat("combat.retaliation.force", {
    offset: targetOffset,
    before,
    after,
  } as unknown as Record<string, unknown>);
  return { ok: true, before, after };
}

function cloneHarthmereRetaliationTraceValue<T>(value: T): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function harthmereRetaliationTraceSnapshot(label: string) {
  const state = readHarthmereCombatState();
  const runtime = readHarthmereForwardArcRuntime();
  const nearest = nearestHarthmereCombatTargets(12);
  return {
    version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
    label,
    at: Date.now(),
    player: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      combatState: state.player.combatState,
      position: runtime?.position,
      forward: runtime?.forward,
      bodyForward: runtime?.bodyForward,
      movementForward: runtime?.movementForward,
      viewForward: runtime?.viewForward,
    },
    selectedNpcOffset: state.selectedNpcOffset,
    selectedNpc:
      state.selectedNpcOffset !== undefined
        ? state.npcs[String(state.selectedNpcOffset)] ??
          npcStatsFromState(state, state.selectedNpcOffset)
        : undefined,
    nearest,
    recent: state.recent.slice(0, 6),
  };
}

function harthmereRetaliationTraceHpLosses(
  before: HarthmereCombatState,
  after: HarthmereCombatState
) {
  const actors = readHarthmereRuntimeCombatActors();
  const offsets = new Set<number>();
  for (const key of Object.keys(before.npcs ?? {})) {
    const offset = Number(key);
    if (Number.isFinite(offset)) offsets.add(offset);
  }
  for (const key of Object.keys(after.npcs ?? {})) {
    const offset = Number(key);
    if (Number.isFinite(offset)) offsets.add(offset);
  }

  return [...offsets]
    .map((offset) => {
      const beforeNpc =
        before.npcs[String(offset)] ?? npcStatsFromState(before, offset);
      const afterNpc =
        after.npcs[String(offset)] ?? npcStatsFromState(after, offset);
      const hpBefore = Number(beforeNpc?.hp ?? 0);
      const hpAfter = Number(afterNpc?.hp ?? 0);
      if (
        !Number.isFinite(hpBefore) ||
        !Number.isFinite(hpAfter) ||
        hpAfter >= hpBefore
      ) {
        return undefined;
      }
      const actor = actors[offset];
      const actorLabel = actor?.label;
      const combatName = afterNpc?.name;
      const visualCombatMismatch = Boolean(
        actorLabel &&
          combatName &&
          actorLabel.trim().toLowerCase() !== combatName.trim().toLowerCase()
      );
      return {
        offset,
        hpBefore,
        hpAfter,
        hpLost: hpBefore - hpAfter,
        combatName,
        actorLabel,
        visualCombatMismatch,
        actor,
        afterNpc,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function harthmereRetaliationTraceRelevantDebug(offset: number) {
  return harthmereCombatDebugLogTail(120).filter(
    (entry): entry is Record<string, unknown> => {
      const record = entry as Record<string, unknown>;
      return (
        Number(record.offset) === offset ||
        Number(record.targetOffset) === offset ||
        Number(record.attackerOffset) === offset ||
        Number(record.npcOffset) === offset ||
        (Array.isArray(record.hitOffsets) &&
          record.hitOffsets.map(Number).includes(offset))
      );
    }
  );
}

function harthmereRetaliationTraceLikelyCause(record: Record<string, any>) {
  const firstLoss = Array.isArray(record.hpLosses)
    ? record.hpLosses[0]
    : undefined;
  const latestOutcome =
    record.outcomes?.after3400ms ?? record.outcomes?.after1600ms;
  if (!firstLoss) {
    return "No NPC HP loss was observed. The attack did not resolve to a damageable combat target.";
  }
  if (firstLoss.visualCombatMismatch) {
    return `Visual/combat mismatch: renderer shows ${firstLoss.actorLabel}, but combat resolved ${firstLoss.combatName}. This was the stale offset/static stats bug.`;
  }
  if (latestOutcome?.retaliated) {
    return "NPC retaliated. Verify this against the player HP delta and fight.ai.retaliate/debug events.";
  }
  const counterSkip = (latestOutcome?.debug ?? []).find(
    (entry: Record<string, unknown>) => entry.stage === "combat.counter_skip"
  );
  if (counterSkip?.reason) {
    return String(counterSkip.reason);
  }
  const countercheck = (latestOutcome?.debug ?? []).find(
    (entry: Record<string, unknown>) => entry.stage === "combat.countercheck"
  );
  if (countercheck && countercheck.canCounterattack === false) {
    return "countercheck reported canCounterattack=false; inspect reachCheck, canNpcRetaliate, cooldown, and damage in this record.";
  }
  if (
    firstLoss.afterNpc?.behavior === "passive" ||
    firstLoss.afterNpc?.behavior === "training_dummy"
  ) {
    return `NPC behavior ${firstLoss.afterNpc.behavior} is not supposed to attack back.`;
  }
  if (Number(firstLoss.afterNpc?.attackPoints ?? 0) <= 0) {
    return "NPC has no attackPoints, so it cannot retaliate.";
  }
  return "NPC lost HP, but no retaliation/damage event was observed during the trace window. Inspect debug events for reach/cooldown/brain blockers.";
}

function installHarthmereRetaliationTraceBridge() {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereRetaliationTrace?: Record<string, unknown>;
    __harthmereRetaliationTraceState?: {
      active: boolean;
      previousState?: HarthmereCombatState;
      records: Record<string, any>[];
      samples: unknown[];
      debugEvents: unknown[];
      effectEvents: unknown[];
      cleanup?: () => void;
      intervalId?: number;
    };
  };

  const traceState = win.__harthmereRetaliationTraceState ?? {
    active: false,
    records: [],
    samples: [],
    debugEvents: [],
    effectEvents: [],
  };
  win.__harthmereRetaliationTraceState = traceState;

  const stop = () => {
    traceState.active = false;
    if (traceState.cleanup) {
      traceState.cleanup();
      traceState.cleanup = undefined;
    }
    if (traceState.intervalId !== undefined) {
      window.clearInterval(traceState.intervalId);
      traceState.intervalId = undefined;
    }
    return status();
  };

  const addOutcome = (
    recordId: string,
    offset: number,
    label: "after1600ms" | "after3400ms"
  ) => {
    const record = traceState.records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }
    const state = readHarthmereCombatState();
    const afterNpc =
      state.npcs[String(offset)] ?? npcStatsFromState(state, offset);
    const debug = harthmereRetaliationTraceRelevantDebug(offset);
    const playerHpBefore = Number(record.playerHpBefore ?? state.player.hp);
    const playerHpAfter = Number(state.player.hp);
    const playerHpLost = Math.max(0, playerHpBefore - playerHpAfter);
    const retaliated =
      playerHpLost > 0 ||
      debug.some(
        (entry: Record<string, unknown>) =>
          entry.stage === "fight.ai.retaliate" ||
          entry.stage === "combat.counterattack"
      );
    record.outcomes = {
      ...(record.outcomes ?? {}),
      [label]: {
        at: Date.now(),
        offset,
        playerHpBefore,
        playerHpAfter,
        playerHpLost,
        retaliated,
        afterNpc,
        summary: summarizeHarthmereRetaliation(offset),
        debug,
      },
    };
    record.likelyCause = harthmereRetaliationTraceLikelyCause(record);
    console.info(`[${HARTHMERE_RETALIATION_CURRENT_TRACE_V186}] ${label}`, {
      offset,
      target: afterNpc?.name,
      playerHpLost,
      retaliated,
      likelyCause: record.likelyCause,
      record,
    });
  };

  const onStateChange = () => {
    if (!traceState.active) {
      return;
    }
    const before = traceState.previousState ?? readHarthmereCombatState();
    const after = readHarthmereCombatState();
    const hpLosses = harthmereRetaliationTraceHpLosses(before, after);
    const playerHpBefore = Number(before.player.hp);
    const playerHpAfter = Number(after.player.hp);
    const playerHpLost = Math.max(0, playerHpBefore - playerHpAfter);
    const latestChanged = before.recent[0]?.at !== after.recent[0]?.at;
    if (hpLosses.length > 0 || playerHpLost > 0 || latestChanged) {
      const record: Record<string, any> = {
        id: `${Date.now()}-${traceState.records.length}`,
        version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
        at: Date.now(),
        playerHpBefore,
        playerHpAfter,
        playerHpLost,
        player: after.player,
        playerPosition: readHarthmereForwardArcRuntime()?.position,
        selectedNpcOffset: after.selectedNpcOffset,
        selectedNpc:
          after.selectedNpcOffset !== undefined
            ? after.npcs[String(after.selectedNpcOffset)] ??
              npcStatsFromState(after, after.selectedNpcOffset)
            : undefined,
        hpLosses,
        recentBefore: before.recent.slice(0, 4),
        recentAfter: after.recent.slice(0, 6),
        nearest: nearestHarthmereCombatTargets(12),
        debug: harthmereCombatDebugLogTail(80),
      };
      record.likelyCause = harthmereRetaliationTraceLikelyCause(record);
      traceState.records = [record, ...traceState.records].slice(0, 80);
      console.info(
        `[${HARTHMERE_RETALIATION_CURRENT_TRACE_V186}] combat state changed`,
        record
      );
      for (const loss of hpLosses) {
        window.setTimeout(
          () => addOutcome(record.id, loss.offset, "after1600ms"),
          1600
        );
        window.setTimeout(
          () => addOutcome(record.id, loss.offset, "after3400ms"),
          3400
        );
      }
    }
    traceState.previousState =
      cloneHarthmereRetaliationTraceValue(after) ?? after;
  };

  const onDebug = (event: Event) => {
    const detail = cloneHarthmereRetaliationTraceValue(
      (event as CustomEvent).detail
    );
    traceState.debugEvents = [detail, ...traceState.debugEvents].slice(0, 200);
  };

  const onEffect = (event: Event) => {
    const detail = cloneHarthmereRetaliationTraceValue(
      (event as CustomEvent).detail
    );
    traceState.effectEvents = [detail, ...traceState.effectEvents].slice(
      0,
      120
    );
  };

  const sample = (label = "manual") => {
    const snapshot = harthmereRetaliationTraceSnapshot(String(label));
    traceState.samples = [snapshot, ...traceState.samples].slice(0, 80);
    console.info(
      `[${HARTHMERE_RETALIATION_CURRENT_TRACE_V186}] sample`,
      snapshot
    );
    return snapshot;
  };

  const start = () => {
    stop();
    window.localStorage.setItem("biomes.localDev.harthmere.combatDebug", "1");
    installHarthmereCombatDebugListeners();
    traceState.active = true;
    traceState.records = [];
    traceState.samples = [];
    traceState.debugEvents = [];
    traceState.effectEvents = [];
    traceState.previousState = cloneHarthmereRetaliationTraceValue(
      readHarthmereCombatState()
    );
    window.addEventListener(HARTHMERE_COMBAT_EVENT, onStateChange);
    window.addEventListener("biomes:harthmere-combat-debug", onDebug);
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, onEffect);
    traceState.cleanup = () => {
      window.removeEventListener(HARTHMERE_COMBAT_EVENT, onStateChange);
      window.removeEventListener("biomes:harthmere-combat-debug", onDebug);
      window.removeEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, onEffect);
    };
    traceState.intervalId = window.setInterval(() => {
      if (traceState.active) {
        traceState.samples = [
          harthmereRetaliationTraceSnapshot("poll"),
          ...traceState.samples,
        ].slice(0, 40);
      }
    }, 500);
    const first = sample("start");
    console.info(
      `[${HARTHMERE_RETALIATION_CURRENT_TRACE_V186}] started. Attack one NPC now. Then run __harthmereRetaliationTrace.download().`,
      first
    );
    return first;
  };

  const status = () => ({
    version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
    active: traceState.active,
    records: traceState.records.length,
    samples: traceState.samples.length,
    debugEvents: traceState.debugEvents.length,
    effectEvents: traceState.effectEvents.length,
    latestRecord: traceState.records[0],
  });

  const report = () => ({
    version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
    status: status(),
    records: traceState.records,
    samples: traceState.samples.slice(0, 40),
    debugEvents: traceState.debugEvents.slice(0, 120),
    effectEvents: traceState.effectEvents.slice(0, 80),
    current: harthmereRetaliationTraceSnapshot("report"),
  });

  const download = (
    filename = `harthmere-retaliation-trace-v186-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`
  ) => {
    const data = JSON.stringify(report(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { filename, bytes: data.length };
  };

  win.__harthmereRetaliationTrace = {
    version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
    start,
    stop,
    status,
    nearest: (limit = 12) => nearestHarthmereCombatTargets(Number(limit)),
    sample,
    report,
    download,
    diagnoseNearestAsync: (ability: HarthmerePlayerAttackType = "basic") =>
      diagnoseHarthmereRetaliationAsync(undefined, ability),
    forceRetaliate: (offset?: number) => forceHarthmereNpcRetaliation(offset),
    help: () => ({
      start:
        "__harthmereRetaliationTrace.start(); then attack the visible NPC normally.",
      nearest:
        "__harthmereRetaliationTrace.nearest(); verifies player coordinates, nearby NPC coordinates, and visual/combat name mismatches.",
      download:
        "__harthmereRetaliationTrace.download(); downloads the report JSON.",
      fixed:
        "v186 also fixes stale static 900x stats overriding live rendered actor identities, including muckers/hexers.",
    }),
  };

  debugHarthmereCombat("combat.retaliation.trace.install", {
    version: HARTHMERE_RETALIATION_CURRENT_TRACE_V186,
    methods: Object.keys(win.__harthmereRetaliationTrace),
  });
}

function installHarthmereCombatDebugListeners() {
  if (!isBrowser()) {
    return "not in browser";
  }
  const win = window as typeof window & {
    __harthmereCombatDebugListenersInstalled?: boolean;
  };
  if (win.__harthmereCombatDebugListenersInstalled) {
    return "already installed";
  }
  win.__harthmereCombatDebugListenersInstalled = true;
  window.addEventListener("biomes:harthmere-combat-debug", (event) => {
    console.info(
      "[HarthmereCombat:debug-event]",
      (event as CustomEvent).detail
    );
  });
  window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, (event) => {
    console.info(
      "[HarthmereCombat:effect-event]",
      (event as CustomEvent).detail
    );
  });
  window.addEventListener(HARTHMERE_COMBAT_EVENT, () => {
    const state = readHarthmereCombatState();
    console.info("[HarthmereCombat:state-event]", {
      player: state.player,
      selectedNpcOffset: state.selectedNpcOffset,
      selectedNpc:
        state.selectedNpcOffset !== undefined
          ? state.npcs[String(state.selectedNpcOffset)]
          : undefined,
      latest: state.recent[0],
    });
  });
  return "installed";
}

function installHarthmereCombatDebugBridge() {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereCombatDebug?: Record<string, unknown>;
  };
  win.__harthmereCombatDebug = {
    version: HARTHMERE_NPC_RETALIATION_RUNTIME_V154,
    state: () => readHarthmereCombatState(),
    reset: () => resetHarthmereCombat(),
    runtime: () => readHarthmereForwardArcRuntime(),
    actors: () => readHarthmereRuntimeCombatActors(),
    nearest: (limit = 12) => nearestHarthmereCombatTargets(Number(limit)),
    nearestTarget: (ability: HarthmerePlayerAttackType = "basic") =>
      autoResolveHarthmereNearbyNpcForDiagnostics(ability),
    hooks: () => harthmereRetaliationHookStatus(),
    summary: (offset?: number) => summarizeHarthmereRetaliation(offset),
    summaryNearest: (ability: HarthmerePlayerAttackType = "basic") =>
      summarizeHarthmereRetaliation(
        currentHarthmereDebugTargetOffset(undefined, ability)
      ),
    probe: (offset?: number) => inspectHarthmereRetaliation(offset),
    why: (offset?: number) => summarizeHarthmereRetaliation(offset),
    diagnose: (offset?: number, ability: HarthmerePlayerAttackType = "basic") =>
      diagnoseHarthmereRetaliation(offset, ability),
    diagnoseNearest: (ability: HarthmerePlayerAttackType = "basic") =>
      diagnoseHarthmereRetaliation(undefined, ability),
    diagnoseAsync: (
      offset?: number,
      ability: HarthmerePlayerAttackType = "basic"
    ) => diagnoseHarthmereRetaliationAsync(offset, ability),
    diagnoseNearestAsync: (ability: HarthmerePlayerAttackType = "basic") =>
      diagnoseHarthmereRetaliationAsync(undefined, ability),
    forceRetaliate: (offset?: number) => forceHarthmereNpcRetaliation(offset),
    attackAndProbe: (
      offset?: number,
      ability: HarthmerePlayerAttackType = "basic"
    ) => {
      const targetOffset = currentHarthmereDebugTargetOffset(offset, ability);
      performHarthmereCombatAttack(targetOffset, ability, {
        contactProven: ability !== "spark",
        contactSource: "debug_bridge_attack_and_probe",
        contactReason:
          "debug command explicitly requested contact-proven retaliation",
        debugLabel: `debug:${ability}`,
      });
      return inspectHarthmereRetaliation(targetOffset);
    },
    attack: (offset?: number, ability: HarthmerePlayerAttackType = "basic") => {
      const targetOffset = currentHarthmereDebugTargetOffset(offset, ability);
      return performHarthmereCombatAttack(targetOffset, ability, {
        contactProven: ability !== "spark",
        contactSource: "debug_bridge_attack",
        contactReason:
          "debug command should show retaliation immediately for melee attacks",
        debugLabel: `debug:${ability}`,
      });
    },
    attackBandit: () =>
      performHarthmereCombatAttack(9003, "basic", {
        contactProven: true,
        contactSource: "debug_bridge_attack_bandit",
      }),
    heavyBandit: () =>
      performHarthmereCombatAttack(9003, "heavy", {
        contactProven: true,
        contactSource: "debug_bridge_heavy_bandit",
      }),
    sparkBandit: () => performHarthmereCombatAttack(9003, "spark"),
    attackWolf: () =>
      performHarthmereCombatAttack(9004, "basic", {
        contactProven: true,
        contactSource: "debug_bridge_attack_wolf",
      }),
    attackGuard: () =>
      performHarthmereCombatAttack(27, "basic", {
        contactProven: true,
        contactSource: "debug_bridge_attack_guard",
      }),
    tickAI: () => tickHarthmereRealtimeCombatAI("debug_bridge"),
    listen: () => installHarthmereCombatDebugListeners(),
    log: () =>
      (window as typeof window & { __harthmereCombatDebugLog?: unknown[] })
        .__harthmereCombatDebugLog ?? [],
    enable: () => {
      window.localStorage.setItem("biomes.localDev.harthmere.combatDebug", "1");
      console.info(
        "Harthmere combat debug enabled. Use __harthmereCombatDebug.listen(), .nearestTarget(), .summaryNearest(), .diagnoseAsync(offset), .diagnoseNearestAsync() (no offset needed), .attackAndProbe(), and .log()."
      );
    },
    disable: () =>
      window.localStorage.removeItem("biomes.localDev.harthmere.combatDebug"),
  };
  debugHarthmereCombat("combat.bridge.install", {
    methods: Object.keys(win.__harthmereCombatDebug),
  });
  installHarthmereRetaliationTraceBridge();
}

if (isBrowser()) {
  installHarthmereCombatDebugBridge();
}
