/// <reference types="mocha" />

import assert from "assert";

import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import {
  HARTHMERE_MAGIC_VENDOR_ID,
  HARTHMERE_MAGIC_VENDOR_UNLOCK_CHAPTER,
  isHarthmereVendorPurchaseAvailable,
} from "@/shared/harthmere/harthmere_vendor_chapter_gates";
import {
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
  type HarthmereInventorySnapshot,
} from "@/shared/harthmere/mmo_inventory_authority";
import { ensureHarthmereSpecializedBlocksCatalogue } from "@/shared/harthmere/mmo_specialized_blocks_catalogue";

describe("Harthmere Chapter 1 magic vendor gate", () => {
  it("keeps the Wyrm & Candle purchase inventory empty", () => {
    const vendor = HARTHMERE_VENDOR_CATALOG[9];
    assert.ok(vendor);
    assert.equal(vendor.vendorId, HARTHMERE_MAGIC_VENDOR_ID);
    assert.deepEqual(vendor.stocks, []);
    assert.deepEqual(vendor.sells, []);
  });

  it("opens the purchase gate no earlier than Chapter 2", () => {
    assert.equal(
      isHarthmereVendorPurchaseAvailable(HARTHMERE_MAGIC_VENDOR_ID),
      false
    );
    assert.equal(
      isHarthmereVendorPurchaseAvailable(
        HARTHMERE_MAGIC_VENDOR_ID,
        HARTHMERE_MAGIC_VENDOR_UNLOCK_CHAPTER
      ),
      true
    );
  });

  it("rejects direct purchases from hidden crafting catalogue entries", () => {
    ensureHarthmereSpecializedBlocksCatalogue();
    assert.ok(getHarthmereVendorEntry(HARTHMERE_MAGIC_VENDOR_ID, "emberstone"));

    const snapshot: HarthmereInventorySnapshot = {
      actorId: "chapter_1_player",
      gold: 10_000,
      equipment: {},
      items: {},
      bank: {},
      escrow: {},
      consumableCooldowns: {},
      knownAbilities: [],
      knownRecipes: [],
    };
    const result = reduceHarthmereInventoryMutation(
      {
        requestId: "chapter-1-magic-vendor-buy",
        actorId: snapshot.actorId,
        kind: "buy_from_vendor",
        nowMs: 1_760_000_000_000,
        vendorId: HARTHMERE_MAGIC_VENDOR_ID,
        itemId: "emberstone",
        count: 1,
      },
      {
        snapshot,
        playerLevel: 10,
        playerSkills: {},
        reputation: {},
      }
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["vendor_closed_until_chapter_2"]);
    assert.deepEqual(result.itemDeltas, {});
    assert.equal(result.goldDelta, 0);
  });
});
