import type { InventoryUiItem } from "../tabs/InventoryTab";
import { itemPk } from "@/shared/game/items";

export function mergeInventoryAndHotbarForBiomesBackpackForTest(
  inventoryItems: any[],
  hotbarItems: any[]
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
      const existingIndex = merged.findIndex(
        (candidate) => candidate?.item && itemPk(candidate.item) === pk
      );
      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          count: hotbarCount,
        };
      }
      countsByPk.set(pk, hotbarCount);
    }
  }

  return merged;
}

function canonicalBiomesMirrorItemId(itemId: unknown) {
  const match = /^(?:b:)?([0-9]+)$/.exec(String(itemId ?? ""));
  return match ? match[1] : String(itemId ?? "");
}

export function mergeMirroredBiomesBackpackUiItemsForTest(
  primaryItems: InventoryUiItem[],
  mirroredItems: InventoryUiItem[]
): InventoryUiItem[] {
  // Live Harthmere inventory is Cloud Save's mirror, not a replacement for the
  // ECS backpack. Merge both views so native Biomes pickups stay visible even
  // when live-mode material storage already contains other items.
  const merged = primaryItems.slice();
  const indexByCanonicalId = new Map<string, number>();

  for (const [index, item] of merged.entries()) {
    indexByCanonicalId.set(canonicalBiomesMirrorItemId(item.id), index);
  }

  for (const item of mirroredItems) {
    const key = canonicalBiomesMirrorItemId(item.id);
    const existingIndex = indexByCanonicalId.get(key);
    if (existingIndex === undefined) {
      indexByCanonicalId.set(key, merged.length);
      merged.push(item);
      continue;
    }

    const existing = merged[existingIndex];
    const existingCount = Number(existing.count ?? 0);
    const incomingCount = Number(item.count ?? 0);
    if (
      Number.isFinite(existingCount) &&
      Number.isFinite(incomingCount) &&
      incomingCount > existingCount
    ) {
      merged[existingIndex] = { ...existing, count: incomingCount };
    }
  }

  return merged;
}
