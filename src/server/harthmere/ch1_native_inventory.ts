import type { ReadonlyInventory } from "@/shared/ecs/gen/components";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";

/** Read spendable Chapter 1 inventory directly from native ECS. */
export function readCh1NativeInventoryCounts(
  entity: { inventory(): ReadonlyInventory | undefined } | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  const inventory = entity?.inventory?.();
  for (const stack of [
    ...(inventory?.items ?? []),
    ...(inventory?.hotbar ?? []),
  ]) {
    if (!stack) continue;
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + Number(stack.count);
  }
  return counts;
}
