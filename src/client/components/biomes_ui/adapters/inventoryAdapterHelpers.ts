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

export function harthmereHotbarCarriedCounts(
  inventoryLootState: any,
  itemId: string
) {
  const liveItems = inventoryLootState?.actor?.items;
  const liveMaterialItems =
    inventoryLootState?.materialStorage?.items ??
    inventoryLootState?.materialStorage ??
    {};
  const backpack = Math.max(0, Math.trunc(Number(liveItems?.[itemId] ?? 0)));
  const materialStorage = Math.max(
    0,
    Math.trunc(Number(liveMaterialItems?.[itemId] ?? 0))
  );
  return { backpack, materialStorage, total: backpack + materialStorage };
}

function canonicalBiomesMirrorItemId(itemId: unknown) {
  const match = /^(?:b:)?([0-9]+)$/.exec(String(itemId ?? ""));
  return match ? match[1] : String(itemId ?? "");
}

// ---------------------------------------------------------------------------
// HARTHMERE_HOTBAR_OVERLAY_NO_CLOBBER (audit fix, 2026-07-13)
//
// Pure merge of the Harthmere quick-slot VISUAL overlay onto the native ECS
// hotbar. Previously the overlay stamped over whatever native ECS item
// occupied the same index — the ECS item still existed server-side but became
// invisible in the HUD ("missing item" reports), and the next ECS sync delta
// fought the overlay (flicker). Rules:
//   * slots the overlay itself owned last frame (`previousOverlaySlots`) are
//     cleared first — they are ours to reuse;
//   * a slot still occupied after that holds a REAL ECS item → never
//     overwritten; the overlay entry for that index is dropped;
//   * empty slots receive the overlay entries.
// ---------------------------------------------------------------------------

export function mergeHarthmereHotbarOverlaySlots<Slot>(
  ecsHotbarSlots: ReadonlyArray<Slot | undefined>,
  previousOverlaySlots: ReadonlySet<number>,
  overlayEntries: ReadonlyArray<{ index: number; itemAndCount?: Slot }>
): { slots: Array<Slot | undefined>; nextOverlaySlots: Set<number> } {
  const slots: Array<Slot | undefined> = [...ecsHotbarSlots];
  while (slots.length < 9) {
    slots.push(undefined);
  }
  // Release the slots the overlay owned last frame.
  for (const index of previousOverlaySlots) {
    if (index >= 0 && index < slots.length) {
      slots[index] = undefined;
    }
  }
  const nextOverlaySlots = new Set<number>();
  for (const { index, itemAndCount } of overlayEntries) {
    if (!itemAndCount || index < 0 || index >= slots.length) continue;
    // Occupied after the release above = a real ECS item. Leave it visible.
    if (slots[index]) continue;
    slots[index] = itemAndCount;
    nextOverlaySlots.add(index);
  }
  return { slots, nextOverlaySlots };
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
