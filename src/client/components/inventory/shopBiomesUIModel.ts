import { BikkieIds } from "@/shared/bikkie/ids";
import {
  PurchaseFromContainerEvent,
  SellInContainerEvent,
  SellToEntityEvent,
} from "@/shared/ecs/gen/events";
import type {
  InventoryAssignmentPattern,
  ItemAndCount,
  OwnedItemReference,
} from "@/shared/ecs/gen/types";
import { resolveItemAttributeId } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import { isSellable } from "@/shared/game/sales";
import type { BiomesId } from "@/shared/ids";

export const MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT = 20;

export function clampBiomesUIShopAmount(
  value: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function normalizeShopPurchaseCount(
  requested: number,
  isAdminShop: boolean
) {
  return clampBiomesUIShopAmount(
    requested,
    1,
    isAdminShop ? MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT : 1
  );
}

export function normalizeShopListingPriceGold(requested: number) {
  return clampBiomesUIShopAmount(requested, 1, 999_999);
}

export function nextBiomesUIShopAmount(
  current: number,
  delta: number,
  min: number,
  max: number
) {
  return clampBiomesUIShopAmount(current + delta, min, max);
}

export function chunkShopSlotIndexesForRovingGrid(
  totalSlots: number,
  columns: number
) {
  const safeTotal = Math.max(0, Math.floor(totalSlots));
  const safeColumns = Math.max(1, Math.floor(columns));
  const rows: number[][] = [];
  for (let i = 0; i < safeTotal; i += safeColumns) {
    rows.push(
      Array.from(
        { length: Math.min(safeColumns, safeTotal - i) },
        (_unused, offset) => i + offset
      )
    );
  }
  return rows;
}

export function firstFilledShopSlotIndex<T>(
  slots: ReadonlyArray<T | undefined | null>
) {
  return slots.findIndex((slot) => slot !== undefined && slot !== null);
}

export function selectedShopSlotOrFirstAvailable<T>(
  slots: ReadonlyArray<T | undefined | null>,
  currentSlotIdx?: number
) {
  if (
    currentSlotIdx !== undefined &&
    currentSlotIdx >= 0 &&
    currentSlotIdx < slots.length &&
    slots[currentSlotIdx] !== undefined &&
    slots[currentSlotIdx] !== null
  ) {
    return currentSlotIdx;
  }
  const first = firstFilledShopSlotIndex(slots);
  return first >= 0 ? first : undefined;
}

export function cannotBuyFromBiomesUIShopReason({
  hasSelection,
  itemAvailable,
  hasInventory,
  canAfford,
  isOwner,
}: {
  hasSelection: boolean;
  itemAvailable: boolean;
  hasInventory: boolean;
  canAfford: boolean;
  isOwner: boolean;
}) {
  if (!hasSelection) {
    return "Choose an item first.";
  }
  if (!itemAvailable) {
    return "That listing is no longer available.";
  }
  if (isOwner) {
    return undefined;
  }
  if (!hasInventory) {
    return "Your inventory is not ready.";
  }
  if (!canAfford) {
    return "You don't have enough Bling.";
  }
  return undefined;
}

export function canSellItemToNpcBuyer(
  item: ItemAndCount | undefined,
  buyerAttributeIds: readonly number[] | undefined
) {
  if (!item || !isSellable(item.item) || !buyerAttributeIds?.length) {
    return false;
  }
  return buyerAttributeIds.some((attributeId) =>
    Boolean(resolveItemAttributeId(item.item, attributeId))
  );
}

export function buildShopPurchaseEvent({
  containerId,
  purchaserId,
  sellerId,
  slotIdx,
  quantity,
  isAdminShop,
}: {
  containerId: BiomesId;
  purchaserId: BiomesId;
  sellerId: BiomesId;
  slotIdx: number;
  quantity: number;
  isAdminShop: boolean;
}) {
  if (!Number.isInteger(slotIdx) || slotIdx < 0) {
    throw new Error("invalid_shop_slot");
  }
  return new PurchaseFromContainerEvent({
    id: containerId,
    src: { kind: "item", idx: slotIdx },
    purchaser_id: purchaserId,
    seller_id: sellerId,
    quantity: normalizeShopPurchaseCount(quantity, isAdminShop),
  });
}

export function buildShopListingEvent({
  containerId,
  sellerId,
  src,
  sellItem,
  dstSlotIdx,
  priceGold,
}: {
  containerId: BiomesId;
  sellerId: BiomesId;
  src: OwnedItemReference;
  sellItem: ItemAndCount;
  dstSlotIdx: number;
  priceGold: number;
}) {
  if (!Number.isInteger(dstSlotIdx) || dstSlotIdx < 0) {
    throw new Error("invalid_shop_slot");
  }
  return new SellInContainerEvent({
    id: containerId,
    src,
    seller_id: sellerId,
    sell_item: sellItem,
    dst_price: countOf(
      BikkieIds.bling,
      BigInt(normalizeShopListingPriceGold(priceGold))
    ),
    dst_slot: {
      kind: "item",
      idx: dstSlotIdx,
    },
  });
}

export function buildNpcSellToEntityEvent({
  buyerEntityId,
  sellerId,
  src,
}: {
  buyerEntityId: BiomesId;
  sellerId: BiomesId;
  src: InventoryAssignmentPattern;
}) {
  if (src.length === 0) {
    throw new Error("no_items_selected");
  }
  return new SellToEntityEvent({
    id: buyerEntityId,
    seller_id: sellerId,
    purchaser_id: buyerEntityId,
    src,
  });
}
