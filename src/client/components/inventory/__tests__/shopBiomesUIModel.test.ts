/// <reference types="mocha" />

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import { attribs } from "@/shared/bikkie/schema/attributes";
import { countOf } from "@/shared/game/items";
import type { Item } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import {
  buildNpcSellToEntityEventV1,
  buildShopListingEventV1,
  buildShopPurchaseEventV1,
  canSellItemToNpcBuyerV1,
  cannotBuyFromBiomesUIShopReasonV1,
  chunkShopSlotIndexesForRovingGridV1,
  MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT,
  normalizeShopListingPriceGoldV1,
  normalizeShopPurchaseCountV1,
  selectedShopSlotOrFirstAvailableV1,
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
    assert.deepEqual(chunkShopSlotIndexesForRovingGridV1(7, 3), [
      [0, 1, 2],
      [3, 4, 5],
      [6],
    ]);
    assert.deepEqual(chunkShopSlotIndexesForRovingGridV1(2, 0), [[0], [1]]);
  });

  it("normalizes purchase quantities and listing prices before backend events", () => {
    assert.equal(normalizeShopPurchaseCountV1(9, false), 1);
    assert.equal(
      normalizeShopPurchaseCountV1(99, true),
      MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT
    );
    assert.equal(normalizeShopPurchaseCountV1(Number.NaN, true), 1);
    assert.equal(normalizeShopListingPriceGoldV1(-50), 1);
    assert.equal(normalizeShopListingPriceGoldV1(12.9), 12);
  });

  it("keeps selected slots stable and falls back to the first available listing", () => {
    const slots = [undefined, "apple", undefined, "pear"];
    assert.equal(selectedShopSlotOrFirstAvailableV1(slots, 3), 3);
    assert.equal(selectedShopSlotOrFirstAvailableV1(slots, 2), 1);
    assert.equal(selectedShopSlotOrFirstAvailableV1([undefined], 0), undefined);
  });

  it("reports player-facing buy blockers", () => {
    assert.equal(
      cannotBuyFromBiomesUIShopReasonV1({
        hasSelection: false,
        itemAvailable: false,
        hasInventory: true,
        canAfford: true,
        isOwner: false,
      }),
      "Choose an item first."
    );
    assert.equal(
      cannotBuyFromBiomesUIShopReasonV1({
        hasSelection: true,
        itemAvailable: true,
        hasInventory: true,
        canAfford: false,
        isOwner: false,
      }),
      "You don't have enough Bling."
    );
    assert.equal(
      cannotBuyFromBiomesUIShopReasonV1({
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
      canSellItemToNpcBuyerV1(countOf(acceptedPickaxe, 1n), [
        attribs.isPickaxe.id,
      ]),
      true
    );
    assert.equal(
      canSellItemToNpcBuyerV1(countOf(acceptedPickaxe, 1n), [
        attribs.isFish.id,
      ]),
      false
    );
    assert.equal(
      canSellItemToNpcBuyerV1(countOf(unsellablePickaxe, 1n), [
        attribs.isPickaxe.id,
      ]),
      false
    );
  });

  it("builds backend purchase, listing, and NPC sell events with clamped values", () => {
    const purchase = buildShopPurchaseEventV1({
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

    const listing = buildShopListingEventV1({
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

    const sell = buildNpcSellToEntityEventV1({
      buyerEntityId: testId(8),
      sellerId: testId(9),
      src: [[{ kind: "item", idx: 0 }, countOf(acceptedPickaxe, 2n)]],
    });
    assert.equal(sell.kind, "sellToEntityEvent");
    assert.equal(sell.purchaser_id, 8);
    assert.throws(
      () =>
        buildNpcSellToEntityEventV1({
          buyerEntityId: testId(8),
          sellerId: testId(9),
          src: [],
        }),
      /no_items_selected/
    );
  });
});
