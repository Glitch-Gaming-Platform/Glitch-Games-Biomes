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

const HARTHMERE_VISUAL_ECS_ITEM_IDS: Record<string, BiomesId> = {
  baker_apron: BikkieIds.grassyTop,
  field_trousers: BikkieIds.bellBottoms,
  patched_cloak: BikkieIds.poncho,
  woodsman_axe: BikkieIds.axe,
  rusty_pickaxe: BikkieIds.pickaxe,
  muck_rake: BikkieIds.muckBuster,
  repair_mallet: BikkieIds.axe,
  training_dagger: BikkieIds.muckBuster,
  iron_longsword: BikkieIds.muckBuster,
  two_handed_sword: BikkieIds.muckBuster,
  wooden_shield: BikkieIds.woodenFencer,
  rough_stone: BikkieIds.cobblestone,
  river_clay: BikkieIds.clay,
  softwood_log: BikkieIds.log,
  oak_branch: BikkieIds.oakLog,
  tree_resin: BikkieIds.oakLeaf,
  cloth_scrap: BikkieIds.tatteredTop,
  clean_water: BikkieIds.bucket,
  old_coin: BikkieIds.goldNugget,
  iron_ore: BikkieIds.goldOre,
  scrap_metal: BikkieIds.silverNugget,
  mana_essence: BikkieIds.powerCell,
  wild_berries: BikkieIds.fruit,
  raw_meat: BikkieIds.muckerMeat,
};

export function harthmereItemIdToBiomesId(
  itemId: string | number | undefined
): BiomesId | undefined {
  if (itemId === undefined || itemId === null) {
    return undefined;
  }
  const key = String(itemId);
  return HARTHMERE_VISUAL_ECS_ITEM_IDS[key] ?? safeParseBiomesId(key.replace(/^b:/, ""));
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
        "Harthmere item has no BiomesId yet; keep it in the Harthmere inventory-loot adapter until a Bikkie item id exists.",
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
  const in_progress = new Set<BiomesId>();
  const complete = new Set<BiomesId>();
  const available = new Set<BiomesId>();
  const started_at = new Map<BiomesId, number>();
  const finished_at = new Map<BiomesId, number>();
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
    in_progress.add(id);
    const startedAtMs =
      state && typeof state === "object"
        ? whole((state as { startedAtMs?: number }).startedAtMs, 0)
        : 0;
    if (startedAtMs > 0) {
      started_at.set(id, startedAtMs / 1000);
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
      finished_at.set(id, finishedAtMs / 1000);
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
      in_progress,
      complete,
      available,
      started_at,
      finished_at,
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
