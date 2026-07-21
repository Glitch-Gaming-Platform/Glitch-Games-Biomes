import { BikkieIds } from "@/shared/bikkie/ids";
import { Challenges, Health, Inventory } from "@/shared/ecs/gen/components";
import type {
  Challenges as BiomesEcsChallenges,
  Health as BiomesEcsHealth,
  Inventory as BiomesEcsInventory,
} from "@/shared/ecs/gen/components";
import type { ItemAndCount, ItemContainer } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";

export const HARTHMERE_BIOMES_ECS_BRIDGE_VERSION =
  "harthmere-biomes-ecs-bridge-v1" as const;

export const HARTHMERE_BIOMES_ECS_HEALTH_UPDATED_EVENT =
  "biomes:harthmere-biomes-ecs-health-updated" as const;
export const HARTHMERE_BIOMES_ECS_INVENTORY_UPDATED_EVENT =
  "biomes:harthmere-biomes-ecs-inventory-updated" as const;
export const HARTHMERE_BIOMES_ECS_CHALLENGES_UPDATED_EVENT =
  "biomes:harthmere-biomes-ecs-challenges-updated" as const;

export const HARTHMERE_GOLD_ECS_CURRENCY_ID = BikkieIds.bling;

export interface HarthmereBiomesEcsProjectionWarning {
  field: "health" | "inventory" | "challenges";
  id?: string;
  reason: string;
}

export interface HarthmereBiomesEcsProjection<T> {
  component: T;
  warnings: HarthmereBiomesEcsProjectionWarning[];
}

export interface HarthmereBiomesEcsComponentsProjection {
  health: BiomesEcsHealth;
  inventory: BiomesEcsInventory;
  challenges: BiomesEcsChallenges;
  warnings: HarthmereBiomesEcsProjectionWarning[];
}

export interface HarthmereHealthEcsInput {
  hp?: number;
  maxHp?: number;
  lastDamageAmount?: number;
}

function whole(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function nonNegativeWhole(value: unknown, fallback = 0) {
  return Math.max(0, whole(value, fallback));
}

export function createHarthmereBiomesEcsHealth(
  input: HarthmereHealthEcsInput
): HarthmereBiomesEcsProjection<BiomesEcsHealth> {
  const maxHp = Math.max(1, whole(input.maxHp, 1));
  const hp = Math.max(0, Math.min(maxHp, whole(input.hp, maxHp)));
  const lastDamageAmount =
    input.lastDamageAmount === undefined
      ? undefined
      : whole(input.lastDamageAmount, 0);
  return {
    component: Health.create({
      hp,
      maxHp,
      lastDamageAmount,
    }),
    warnings: [],
  };
}

export interface HarthmereInventoryEcsInput {
  gold?: number;
  items?: Record<string, number>;
  overflow?: Array<{ itemId: string; count: number; reason?: string }>;
  maxItemSlots?: number;
}

export function harthmereItemIdToBiomesId(
  itemId: string | number | undefined
): BiomesId | undefined {
  return harthmereNativeBiomesIdForItemId(itemId);
}

// ---------------------------------------------------------------------------
// HARTHMERE_BIOMES_ECS_BRIDGE_REVERSE
//
// Native ECS is the physical source of truth. Unknown reverse ids remain in
// the lossless `b:<id>` namespace instead of guessing a semantic Harthmere
// item from a shared visual. Generated Harthmere ids are normally never
// reverse-mirrored: recipes, loot, and quests carry the exact BiomesId end to
// end. This fallback exists only for legacy projection readers.
// ---------------------------------------------------------------------------

// Translate a BiomesId to its Harthmere catalogue id. Falls back to the
// `b:<id>` namespace so the result is ALWAYS usable with
// `harthmereItemIdToBiomesId` (round-trip guaranteed).
export function biomesIdToHarthmereItemId(
  biomesId: BiomesId | number | undefined
): string | undefined {
  if (biomesId === undefined || biomesId === null) {
    return undefined;
  }
  const id = safeParseBiomesId(String(biomesId));
  if (!id) {
    return undefined;
  }
  return harthmereNativeItemIdForBiomesId(id) ?? `b:${id}`;
}

// Only checked-in semantic ids and explicit numeric/b:<id> identities have a
// deterministic native identity. Unknown strings must remain unmapped instead
// of silently creating a browser biscuit with no valid ECS id.
export function harthmereItemIdHasCuratedBiomesMapping(
  itemId: string | number | undefined
): boolean {
  return harthmereItemIdToBiomesId(itemId) !== undefined;
}

// ---------------------------------------------------------------------------
// HARTHMERE_INVENTORY_DRIFT_REPORT (audit fix, 2026-07-13)
//
// Legacy diagnostics compare exact ids one-by-one. Distinct Harthmere items no
// longer collapse onto one visual biscuit, so the report cannot double-count
// "iron ore" as "gold ore" or several weapons as one Muck Buster stack.
// ---------------------------------------------------------------------------

export interface HarthmereInventoryDriftEntry {
  harthmereItemId: string;
  biomesId: BiomesId;
  liveCount: number;
  ecsCount: number;
  delta: number; // live - ecs
}

export function compareHarthmereLiveAndEcsInventories(
  liveItems: Record<string, number>,
  ecsCounts: ReadonlyMap<BiomesId, number> | Record<string, number>
): HarthmereInventoryDriftEntry[] {
  const ecsCountOf = (id: BiomesId): number => {
    const raw =
      ecsCounts instanceof Map
        ? ecsCounts.get(id)
        : (ecsCounts as Record<string, number>)[String(id)];
    return Math.max(0, Math.trunc(Number(raw) || 0));
  };
  const drift: HarthmereInventoryDriftEntry[] = [];
  for (const harthmereItemId of Object.keys(liveItems)) {
    const biomesId = harthmereItemIdToBiomesId(harthmereItemId);
    if (!biomesId) continue;
    const liveCount = Math.max(
      0,
      Math.trunc(Number(liveItems[harthmereItemId]) || 0)
    );
    const ecsCount = ecsCountOf(biomesId);
    if (liveCount !== ecsCount) {
      drift.push({
        harthmereItemId,
        biomesId,
        liveCount,
        ecsCount,
        delta: liveCount - ecsCount,
      });
    }
  }
  return drift;
}

export function harthmereItemIdToBiomesEcsItem(
  itemId: string | number | undefined
) {
  const biomesId = harthmereItemIdToBiomesId(itemId);
  if (!biomesId) {
    return undefined;
  }
  try {
    return anItem(biomesId);
  } catch {
    return undefined;
  }
}

export function harthmereItemIdToBiomesEcsItemAndCount(
  itemId: string | number | undefined,
  count = 1
): ItemAndCount | undefined {
  const biomesId = harthmereItemIdToBiomesId(itemId);
  if (!biomesId) {
    return undefined;
  }
  try {
    return countOf(biomesId, BigInt(Math.max(1, nonNegativeWhole(count, 1))));
  } catch {
    return undefined;
  }
}

function pushItemIntoContainer(
  container: ItemContainer,
  itemId: string,
  count: number,
  warnings: HarthmereBiomesEcsProjectionWarning[],
  field: "inventory"
) {
  const biomesId = harthmereItemIdToBiomesId(itemId);
  if (!biomesId) {
    warnings.push({
      field,
      id: itemId,
      reason:
        "Harthmere item is not in the explicit native identity manifest; keep it out of ECS until an authored Bikkie item id is checked in.",
    });
    return;
  }
  const safeCount = nonNegativeWhole(count, 0);
  if (safeCount <= 0) {
    return;
  }
  container.push(countOf(biomesId, BigInt(safeCount)));
}

export function createHarthmereBiomesEcsInventory(
  input: HarthmereInventoryEcsInput
): HarthmereBiomesEcsProjection<BiomesEcsInventory> {
  const warnings: HarthmereBiomesEcsProjectionWarning[] = [];
  const items: ItemContainer = [];
  for (const [itemId, count] of Object.entries(input.items ?? {})) {
    if (items.length >= Math.max(0, whole(input.maxItemSlots, 32))) {
      warnings.push({
        field: "inventory",
        id: itemId,
        reason:
          "Biomes ECS inventory slot projection is full; leave remaining items in authoritative overflow.",
      });
      continue;
    }
    pushItemIntoContainer(items, itemId, count, warnings, "inventory");
  }
  const currencies = new Map();
  const gold = nonNegativeWhole(input.gold, 0);
  if (gold > 0) {
    currencies.set(
      String(HARTHMERE_GOLD_ECS_CURRENCY_ID),
      countOf(HARTHMERE_GOLD_ECS_CURRENCY_ID, BigInt(gold))
    );
  }
  const overflow = new Map();
  for (const entry of input.overflow ?? []) {
    const biomesId = harthmereItemIdToBiomesId(entry.itemId);
    if (!biomesId) {
      warnings.push({
        field: "inventory",
        id: entry.itemId,
        reason:
          "Overflow entry has no BiomesId; keep it in the Harthmere overflow adapter.",
      });
      continue;
    }
    const count = nonNegativeWhole(entry.count, 0);
    if (count > 0) {
      overflow.set(String(biomesId), countOf(biomesId, BigInt(count)));
    }
  }
  return {
    component: Inventory.create({ items, currencies, overflow }),
    warnings,
  };
}

export interface HarthmereChallengesEcsInput {
  active?: Record<string, { startedAtMs?: number } | unknown>;
  completed?: Record<string, number>;
  available?: string[];
  questIdMap?: Record<string, BiomesId>;
}

function questIdToBiomesId(
  questId: string,
  questIdMap: Record<string, BiomesId> | undefined
) {
  return questIdMap?.[questId] ?? safeParseBiomesId(questId);
}

export function createHarthmereBiomesEcsChallenges(
  input: HarthmereChallengesEcsInput
): HarthmereBiomesEcsProjection<BiomesEcsChallenges> {
  const warnings: HarthmereBiomesEcsProjectionWarning[] = [];
  const inProgress = new Set<BiomesId>();
  const complete = new Set<BiomesId>();
  const available = new Set<BiomesId>();
  const startedAt = new Map<BiomesId, number>();
  const finishedAt = new Map<BiomesId, number>();
  for (const [questId, state] of Object.entries(input.active ?? {})) {
    const id = questIdToBiomesId(questId, input.questIdMap);
    if (!id) {
      warnings.push({
        field: "challenges",
        id: questId,
        reason:
          "Quest id has no Biomes challenge id; keep it in the Harthmere quest adapter until content is biscuit-backed.",
      });
      continue;
    }
    inProgress.add(id);
    const startedAtMs =
      state && typeof state === "object"
        ? whole((state as { startedAtMs?: number }).startedAtMs, 0)
        : 0;
    if (startedAtMs > 0) {
      startedAt.set(id, startedAtMs / 1000);
    }
  }
  for (const [questId, finishedAtMs] of Object.entries(input.completed ?? {})) {
    const id = questIdToBiomesId(questId, input.questIdMap);
    if (!id) {
      warnings.push({
        field: "challenges",
        id: questId,
        reason:
          "Completed quest id has no Biomes challenge id; keep completion in the Harthmere quest adapter until content is biscuit-backed.",
      });
      continue;
    }
    complete.add(id);
    if (finishedAtMs > 0) {
      finishedAt.set(id, finishedAtMs / 1000);
    }
  }
  for (const questId of input.available ?? []) {
    const id = questIdToBiomesId(questId, input.questIdMap);
    if (id) {
      available.add(id);
    }
  }
  return {
    component: Challenges.create({
      in_progress: inProgress,
      complete,
      available,
      started_at: startedAt,
      finished_at: finishedAt,
    }),
    warnings,
  };
}

export interface HarthmereBiomesEcsStateInput {
  health: HarthmereHealthEcsInput;
  inventory: HarthmereInventoryEcsInput;
  challenges: HarthmereChallengesEcsInput;
}

export function createHarthmereBiomesEcsComponentsProjection(
  input: HarthmereBiomesEcsStateInput
): HarthmereBiomesEcsComponentsProjection {
  const health = createHarthmereBiomesEcsHealth(input.health);
  const inventory = createHarthmereBiomesEcsInventory(input.inventory);
  const challenges = createHarthmereBiomesEcsChallenges(input.challenges);
  return {
    health: health.component,
    inventory: inventory.component,
    challenges: challenges.component,
    warnings: [
      ...health.warnings,
      ...inventory.warnings,
      ...challenges.warnings,
    ],
  };
}
