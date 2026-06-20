/// <reference types="mocha" />

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import { attribs } from "@/shared/bikkie/schema/attributes";
import { countOf } from "@/shared/game/items";
import type { Item } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import {
  buildNpcSellToEntityEvent,
  buildShopListingEvent,
  buildShopPurchaseEvent,
  canSellItemToNpcBuyer,
  cannotBuyFromBiomesUIShopReason,
  chunkShopSlotIndexesForRovingGrid,
  MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT,
  normalizeShopListingPriceGold,
  normalizeShopPurchaseCount,
  selectedShopSlotOrFirstAvailable,
} from "../shopBiomesUIModel";

const acceptedPickaxe = {
  id: 101,
  isDroppable: true,
  itemSellPrice: 12,
  isPickaxe: true,
  displayName: "Accepted Pickaxe",
} as unknown as Item;

const unsellablePickaxe = {
  id: 102,
  isDroppable: false,
  itemSellPrice: 12,
  isPickaxe: true,
  displayName: "Quest Pickaxe",
} as unknown as Item;

const testId = (value: number) => value as BiomesId;

describe("BiomesUI shop model", () => {
  it("chunks shop slots for roving keyboard grids", () => {
    assert.deepEqual(chunkShopSlotIndexesForRovingGrid(7, 3), [
      [0, 1, 2],
      [3, 4, 5],
      [6],
    ]);
    assert.deepEqual(chunkShopSlotIndexesForRovingGrid(2, 0), [[0], [1]]);
  });

  it("normalizes purchase quantities and listing prices before backend events", () => {
    assert.equal(normalizeShopPurchaseCount(9, false), 1);
    assert.equal(
      normalizeShopPurchaseCount(99, true),
      MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT
    );
    assert.equal(normalizeShopPurchaseCount(Number.NaN, true), 1);
    assert.equal(normalizeShopListingPriceGold(-50), 1);
    assert.equal(normalizeShopListingPriceGold(12.9), 12);
  });

  it("keeps selected slots stable and falls back to the first available listing", () => {
    const slots = [undefined, "apple", undefined, "pear"];
    assert.equal(selectedShopSlotOrFirstAvailable(slots, 3), 3);
    assert.equal(selectedShopSlotOrFirstAvailable(slots, 2), 1);
    assert.equal(selectedShopSlotOrFirstAvailable([undefined], 0), undefined);
  });

  it("reports player-facing buy blockers", () => {
    assert.equal(
      cannotBuyFromBiomesUIShopReason({
        hasSelection: false,
        itemAvailable: false,
        hasInventory: true,
        canAfford: true,
        isOwner: false,
      }),
      "Choose an item first."
    );
    assert.equal(
      cannotBuyFromBiomesUIShopReason({
        hasSelection: true,
        itemAvailable: true,
        hasInventory: true,
        canAfford: false,
        isOwner: false,
      }),
      "You don't have enough Bling."
    );
    assert.equal(
      cannotBuyFromBiomesUIShopReason({
        hasSelection: true,
        itemAvailable: true,
        hasInventory: false,
        canAfford: false,
        isOwner: true,
      }),
      undefined
    );
  });

  it("matches NPC buyer restrictions before staging a sale", () => {
    assert.equal(
      canSellItemToNpcBuyer(countOf(acceptedPickaxe, 1n), [
        attribs.isPickaxe.id,
      ]),
      true
    );
    assert.equal(
      canSellItemToNpcBuyer(countOf(acceptedPickaxe, 1n), [
        attribs.isFish.id,
      ]),
      false
    );
    assert.equal(
      canSellItemToNpcBuyer(countOf(unsellablePickaxe, 1n), [
        attribs.isPickaxe.id,
      ]),
      false
    );
  });

  it("builds backend purchase, listing, and NPC sell events with clamped values", () => {
    const purchase = buildShopPurchaseEvent({
      containerId: testId(1),
      purchaserId: testId(2),
      sellerId: testId(3),
      slotIdx: 4,
      quantity: 200,
      isAdminShop: true,
    });
    assert.equal(purchase.kind, "purchaseFromContainerEvent");
    assert.deepEqual(purchase.src, { kind: "item", idx: 4 });
    assert.equal(purchase.quantity, MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT);

    const listing = buildShopListingEvent({
      containerId: testId(1),
      sellerId: testId(2),
      src: { kind: "item", idx: 0 },
      sellItem: countOf(acceptedPickaxe, 1n),
      dstSlotIdx: 3,
      priceGold: -10,
    });
    assert.equal(listing.kind, "sellInContainerEvent");
    assert.deepEqual(listing.dst_slot, { kind: "item", idx: 3 });
    assert.equal(listing.dst_price.item.id, BikkieIds.bling);
    assert.equal(listing.dst_price.count, 1n);

    const sell = buildNpcSellToEntityEvent({
      buyerEntityId: testId(8),
      sellerId: testId(9),
      src: [[{ kind: "item", idx: 0 }, countOf(acceptedPickaxe, 2n)]],
    });
    assert.equal(sell.kind, "sellToEntityEvent");
    assert.equal(sell.purchaser_id, 8);
    assert.throws(
      () =>
        buildNpcSellToEntityEvent({
          buyerEntityId: testId(8),
          sellerId: testId(9),
          src: [],
        }),
      /no_items_selected/
    );
  });
});
