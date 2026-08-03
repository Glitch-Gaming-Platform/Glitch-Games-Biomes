// HARTHMERE_NATIVE_LEVEL_STATS
//
// Level -> character attributes, combat modifiers, resource ceilings, movement
// speed, and backpack capacity. Persistent values are written into the SAME ECS
// documents the client already treats as authoritative; pure derived values are
// calculated from the authoritative level wherever they are consumed.
//
// WHY THIS EXISTS
// ---------------
// Before this module, `awardHarthmereNativeCombatXp` was the only writer of the
// native progression root, and NOTHING read `level` back out except a damage
// multiplier and a weapon gate. `readHarthmereNativeVitals` hard-defaults
// maxMana/maxStamina to 100 and the player's `Health.maxHp` was never touched
// after spawn, so a player who leveled from XP saw the number on the HUD chip
// change and every bar stay exactly where it was. That reads as "XP does
// nothing", which is the bug this fixes.
//
// AUTHORITY
// ---------
// Every persistent destination is ECS:
//
//   - `Health` component      -> maxHp        (synced, used by combat/death)
//   - `TriggerState` vitals   -> maxMana, maxStamina  (harthmere_native_vitals)
//   - `Inventory` component   -> backpack item slots
//
// The remaining attributes are pure functions of the ECS progression level.
// There is no Redis/live-mode copy of these numbers.
//
// LEVEL-UP TOP-UP
// ---------------
// On a level-up we add the *gain* to the current value rather than refilling to
// full. Refilling would make leveling a free full heal usable mid-fight; adding
// the delta guarantees the player's percentage never drops when the ceiling
// rises, which is the actual thing that feels broken otherwise.

import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import { PLAYER_INVENTORY_SLOTS } from "@/shared/game/inventory";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { readHarthmereNativeCombatProgression } from "@/shared/harthmere/harthmere_native_combat";

export const HARTHMERE_NATIVE_LEVEL_STATS_VERSION =
  "harthmere-native-level-stats-v2" as const;

export const HARTHMERE_NATIVE_BASE_MAX_HP = 100;
export const HARTHMERE_NATIVE_BASE_MAX_MANA = 100;
export const HARTHMERE_NATIVE_BASE_MAX_STAMINA = 100;

export const HARTHMERE_NATIVE_MAX_HP_PER_LEVEL = 20;
export const HARTHMERE_NATIVE_MAX_MANA_PER_LEVEL = 15;
export const HARTHMERE_NATIVE_MAX_STAMINA_PER_LEVEL = 10;

export const HARTHMERE_NATIVE_BASE_ATTRIBUTE = 10;
export const HARTHMERE_NATIVE_BASE_ACCURACY = 75;
export const HARTHMERE_NATIVE_BASE_CARRY_CAPACITY = 25;

const HARTHMERE_NATIVE_STRENGTH_PER_LEVEL = 1;
const HARTHMERE_NATIVE_DEXTERITY_PER_LEVEL = 1;
const HARTHMERE_NATIVE_INTELLIGENCE_PER_LEVEL = 1;
const HARTHMERE_NATIVE_DEFENSE_PER_LEVEL = 2;
const HARTHMERE_NATIVE_ARMOR_PER_LEVEL = 1.5;
const HARTHMERE_NATIVE_EVASION_PER_LEVEL = 0.25;
const HARTHMERE_NATIVE_ACCURACY_PER_LEVEL = 0.2;
const HARTHMERE_NATIVE_CRITICAL_CHANCE_PER_LEVEL = 0.0015;
const HARTHMERE_NATIVE_SPELL_POWER_PER_LEVEL = 2;
const HARTHMERE_NATIVE_HEALING_POWER_PER_LEVEL = 1.5;
const HARTHMERE_NATIVE_MOVEMENT_SPEED_PER_LEVEL = 0.0025;
const HARTHMERE_NATIVE_MAX_MOVEMENT_SPEED_BONUS = 0.25;
const HARTHMERE_NATIVE_CARRY_CAPACITY_PER_LEVEL = 2;
const HARTHMERE_NATIVE_LEVELS_PER_INVENTORY_SLOT = 5;

export const HARTHMERE_NATIVE_MAX_LEVEL = 100;

export interface HarthmereNativeLevelStats {
  level: number;
  maxHp: number;
  maxMana: number;
  maxStamina: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  defense: number;
  armor: number;
  evasion: number;
  accuracy: number;
  criticalChance: number;
  spellPower: number;
  healingPower: number;
  /** Multiplier applied to the native player controller; 1 is historical speed. */
  movementSpeed: number;
  /** Abstract carried-weight budget shown to the player. */
  carryCapacity: number;
  /** Concrete ECS backpack slots unlocked by carry-capacity milestones. */
  inventorySlots: number;
}

function boundedLevel(level: unknown): number {
  const numeric = Math.trunc(Number(level));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(HARTHMERE_NATIVE_MAX_LEVEL, numeric));
}

/** Pure table. Level 1 reproduces the historical native behavior exactly. */
export function harthmereNativeLevelStats(
  level: unknown
): HarthmereNativeLevelStats {
  const bounded = boundedLevel(level);
  const steps = bounded - 1;
  return {
    level: bounded,
    maxHp:
      HARTHMERE_NATIVE_BASE_MAX_HP + steps * HARTHMERE_NATIVE_MAX_HP_PER_LEVEL,
    maxMana:
      HARTHMERE_NATIVE_BASE_MAX_MANA +
      steps * HARTHMERE_NATIVE_MAX_MANA_PER_LEVEL,
    maxStamina:
      HARTHMERE_NATIVE_BASE_MAX_STAMINA +
      steps * HARTHMERE_NATIVE_MAX_STAMINA_PER_LEVEL,
    strength:
      HARTHMERE_NATIVE_BASE_ATTRIBUTE +
      steps * HARTHMERE_NATIVE_STRENGTH_PER_LEVEL,
    dexterity:
      HARTHMERE_NATIVE_BASE_ATTRIBUTE +
      steps * HARTHMERE_NATIVE_DEXTERITY_PER_LEVEL,
    intelligence:
      HARTHMERE_NATIVE_BASE_ATTRIBUTE +
      steps * HARTHMERE_NATIVE_INTELLIGENCE_PER_LEVEL,
    defense: Math.round(steps * HARTHMERE_NATIVE_DEFENSE_PER_LEVEL),
    armor: Math.round(steps * HARTHMERE_NATIVE_ARMOR_PER_LEVEL),
    evasion: Number((steps * HARTHMERE_NATIVE_EVASION_PER_LEVEL).toFixed(2)),
    accuracy: Number(
      (
        HARTHMERE_NATIVE_BASE_ACCURACY +
        steps * HARTHMERE_NATIVE_ACCURACY_PER_LEVEL
      ).toFixed(2)
    ),
    criticalChance: Number(
      Math.min(0.2, steps * HARTHMERE_NATIVE_CRITICAL_CHANCE_PER_LEVEL).toFixed(
        4
      )
    ),
    spellPower: Math.round(steps * HARTHMERE_NATIVE_SPELL_POWER_PER_LEVEL),
    healingPower: Math.round(steps * HARTHMERE_NATIVE_HEALING_POWER_PER_LEVEL),
    movementSpeed: Number(
      (
        1 +
        Math.min(
          HARTHMERE_NATIVE_MAX_MOVEMENT_SPEED_BONUS,
          steps * HARTHMERE_NATIVE_MOVEMENT_SPEED_PER_LEVEL
        )
      ).toFixed(4)
    ),
    carryCapacity:
      HARTHMERE_NATIVE_BASE_CARRY_CAPACITY +
      steps * HARTHMERE_NATIVE_CARRY_CAPACITY_PER_LEVEL,
    inventorySlots:
      PLAYER_INVENTORY_SLOTS +
      Math.floor(bounded / HARTHMERE_NATIVE_LEVELS_PER_INVENTORY_SLOT),
  };
}

export function harthmereNativeHealingAmount(
  level: unknown,
  baseHealing: unknown
): number {
  const healing = Math.max(0, Number(baseHealing) || 0);
  const { healingPower } = harthmereNativeLevelStats(level);
  return Math.max(0, Math.round(healing * (1 + healingPower / 500)));
}

/**
 * Minimal structural view of the player `Delta`. Declared here rather than
 * importing `Delta` so the reducer is unit-testable with a plain object and
 * cannot accidentally reach for unrelated components.
 */
export interface HarthmereNativeStatCarrier {
  triggerState(): ReadonlyTriggerState | TriggerState | undefined;
  mutableTriggerState(): TriggerState;
  health?(): { readonly hp: number; readonly maxHp: number } | undefined;
  mutableHealth?(): { hp: number; maxHp: number };
  inventory?(): { readonly items: ReadonlyArray<unknown> } | undefined;
  mutableInventory?(): { items: unknown[] };
}

export interface HarthmereNativeLevelStatsSyncResult {
  stats: HarthmereNativeLevelStats;
  /** True when a persistent level-owned ECS value actually moved. */
  changed: boolean;
  hpGained: number;
  manaGained: number;
  staminaGained: number;
  inventorySlotsGained: number;
}

/**
 * Bring resource ceilings and backpack slots in line with the progression
 * root's current level. Safe to call on every XP award and on load: when the
 * level has not moved, every write is a no-op and `changed` is false.
 *
 * Deliberately idempotent rather than "call me only on level-up" — the
 * progression root is written from several transactions (kills, quest steps,
 * boss credit) and a missed level-up would otherwise strand a player at the
 * wrong ceiling until their next one.
 */
export function syncHarthmereNativeLevelStats(
  entity: HarthmereNativeStatCarrier
): HarthmereNativeLevelStatsSyncResult {
  // XP awards and their derived stats are written inside one forked ECS Delta.
  // Delta's immutable accessors can still expose the pre-transaction component
  // after `mutableTriggerState()` has changed it, which made a real quest
  // level-up persist Level 3 while Health stayed at the Level 1 ceiling. Read
  // and update the mutable components so consecutive step/completion awards in
  // the same trigger transaction build on each other's current values.
  const triggerState = entity.mutableTriggerState();
  const progression = readHarthmereNativeCombatProgression(triggerState);
  const stats = harthmereNativeLevelStats(progression.level);

  const beforeVitals = readHarthmereNativeVitals(triggerState);
  const manaGained = Math.max(0, stats.maxMana - beforeVitals.maxMana);
  const staminaGained = Math.max(0, stats.maxStamina - beforeVitals.maxStamina);
  const vitalsChanged =
    beforeVitals.maxMana !== stats.maxMana ||
    beforeVitals.maxStamina !== stats.maxStamina;

  if (vitalsChanged) {
    writeHarthmereNativeVitals(triggerState, {
      maxMana: stats.maxMana,
      maxStamina: stats.maxStamina,
      // Carry the ceiling gain into the current value so the fraction the
      // player sees never regresses when they level.
      mana: Math.min(stats.maxMana, beforeVitals.mana + manaGained),
      stamina: Math.min(stats.maxStamina, beforeVitals.stamina + staminaGained),
    });
  }

  let hpGained = 0;
  let healthChanged = false;
  const health = entity.health?.();
  if (health && entity.mutableHealth) {
    const mutable = entity.mutableHealth();
    const previousMaxHp = Math.max(1, Math.trunc(Number(mutable.maxHp) || 0));
    hpGained = Math.max(0, stats.maxHp - previousMaxHp);
    if (previousMaxHp !== stats.maxHp) {
      const previousHp = Math.max(0, Math.trunc(Number(mutable.hp) || 0));
      mutable.maxHp = stats.maxHp;
      // A dead player stays dead through a level-up; only the ceiling moves.
      mutable.hp =
        previousHp <= 0
          ? 0
          : Math.max(1, Math.min(stats.maxHp, previousHp + hpGained));
      healthChanged = true;
    }
  }

  let inventorySlotsGained = 0;
  let inventoryChanged = false;
  const inventory = entity.inventory?.();
  if (inventory && entity.mutableInventory) {
    const mutable = entity.mutableInventory();
    inventorySlotsGained = Math.max(
      0,
      stats.inventorySlots - mutable.items.length
    );
    if (inventorySlotsGained > 0) {
      mutable.items.length = stats.inventorySlots;
      inventoryChanged = true;
    }
  }

  return {
    stats,
    changed: vitalsChanged || healthChanged || inventoryChanged,
    hpGained,
    manaGained,
    staminaGained,
    inventorySlotsGained,
  };
}
