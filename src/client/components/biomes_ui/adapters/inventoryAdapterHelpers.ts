import { itemPk } from "@/shared/game/items";

export function mergeInventoryAndHotbarForBiomesBackpackForTest(
  inventoryItems: any[],
  hotbarItems: any[],
): any[] {
  const merged = inventoryItems.slice();
  const countsByPk = new Map<string, bigint>();

  for (const slot of merged) {
    if (!slot?.item) continue;
    countsByPk.set(itemPk(slot.item), BigInt(slot.count ?? 1n));
  }

  for (const slot of hotbarItems) {
    if (!slot?.item) continue;
    const pk = itemPk(slot.item);
    const hotbarCount = BigInt(slot.count ?? 1n);
    const seen = countsByPk.get(pk);
    if (seen === undefined) {
      merged.push(slot);
      countsByPk.set(pk, hotbarCount);
      continue;
    }
    if (hotbarCount > seen) {
      const existingIndex = merged.findIndex((candidate) => candidate?.item && itemPk(candidate.item) === pk);
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], count: hotbarCount };
      }
      countsByPk.set(pk, hotbarCount);
    }
  }

  return merged;
}
