import type { ReadonlyInventory } from "@/shared/ecs/gen/components";
import type { ReadonlyItemBag } from "@/shared/ecs/gen/types";
import { inventoryCount } from "@/shared/game/inventory";

export type InventoryBagSnapshot = ReadonlyMap<string, bigint>;

/** Capture exact native item counts before an asynchronous ECS mutation. */
export function snapshotInventoryCountsForBag(
  inventory: ReadonlyInventory | undefined,
  bag: ReadonlyItemBag | undefined
): InventoryBagSnapshot {
  const snapshot = new Map<string, bigint>();
  if (!inventory || !bag) return snapshot;
  for (const [key, itemAndCount] of bag) {
    snapshot.set(key, inventoryCount(inventory, itemAndCount.item));
  }
  return snapshot;
}

/**
 * Return the observed positive inventory delta for the expected native bag.
 * This is deliberately based on ECS inventory state, not an HTTP response or
 * resolved event promise.
 */
export function acquiredInventoryCountForBag(
  before: InventoryBagSnapshot,
  inventory: ReadonlyInventory | undefined,
  bag: ReadonlyItemBag | undefined
) {
  if (!inventory || !bag) return 0n;
  let acquired = 0n;
  for (const [key, itemAndCount] of bag) {
    const previous = before.get(key) ?? 0n;
    const current = inventoryCount(inventory, itemAndCount.item);
    if (current > previous) acquired += current - previous;
  }
  return acquired;
}

export function totalItemCountInBag(bag: ReadonlyItemBag | undefined) {
  let total = 0n;
  for (const itemAndCount of bag?.values() ?? []) total += itemAndCount.count;
  return total;
}
