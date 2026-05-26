/**
 * mmo_auction_authority_v1.test.ts
 *
 * Comprehensive tests for the production auction house authority.
 * Covers post_listing, buy_listing, cancel, expiry, escrow recovery,
 * search/filter/pagination, fee previews, and edge cases.
 */

import assert from "assert";
import {
  collectExpiredHarthmereAuctionListingsV1,
  HARTHMERE_AUCTION_DEFAULT_DURATION_MS,
  HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD,
  HARTHMERE_AUCTION_MAX_UNIT_PRICE,
  HARTHMERE_AUCTION_MIN_COUNT,
  HARTHMERE_AUCTION_SALE_TAX_RATE,
  previewHarthmereAuctionFeesV1,
  reduceHarthmereAuctionMutationV1,
  searchHarthmereAuctionListingsV1,
  type HarthmereAuctionListingV1,
  type HarthmereAuctionMutationContextV1,
  type HarthmereAuctionMutationRequestV1,
} from "../mmo_auction_authority_v1";
import {
  registerHarthmereItemDefinitionV1,
  type HarthmereInventorySnapshotV1,
} from "../mmo_inventory_authority_v1";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000;

function makeSnap(overrides: Partial<HarthmereInventorySnapshotV1> = {}): HarthmereInventorySnapshotV1 {
  return {
    actorId: "seller_1",
    gold: 1000,
    equipment: {},
    items: { iron_sword: 3 },
    bank: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function activeListing(overrides: Partial<HarthmereAuctionListingV1> = {}): HarthmereAuctionListingV1 {
  return {
    listingId: "listing_1",
    sellerId: "seller_1",
    itemId: "iron_sword",
    count: 1,
    unitPrice: 200,
    listingFeeCharged: HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD + Math.ceil(200 * 0.01),
    status: "active",
    createdAtMs: NOW - 1000,
    expiresAtMs: NOW + HARTHMERE_AUCTION_DEFAULT_DURATION_MS,
    ...overrides,
  };
}

function makePostReq(overrides: Partial<HarthmereAuctionMutationRequestV1> = {}): HarthmereAuctionMutationRequestV1 {
  return {
    requestId: "req_1",
    actorId: "seller_1",
    kind: "post_listing",
    itemId: "iron_sword",
    count: 1,
    suggestedUnitPrice: 200,
    nowMs: NOW,
    ...overrides,
  } as HarthmereAuctionMutationRequestV1;
}

before(() => {
  // Ensure iron_sword is in the item registry (may already be from inventory tests)
  try {
    registerHarthmereItemDefinitionV1({
      itemId: "iron_sword_ah",
      displayName: "Iron Sword",
      maxStackSize: 1,
      baseValue: 100,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: false,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: true,
    });
  } catch { /* may already be registered */ }
});

// ---------------------------------------------------------------------------
// post_listing
// ---------------------------------------------------------------------------

describe("Auction post_listing", () => {
  it("succeeds and charges listing fee from seller gold", () => {
    const snap = makeSnap({ gold: 500, items: { iron_sword: 1 } });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq();
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.sellerGoldDelta < 0, "listing fee must be deducted");
    assert.ok(result.sellerEscrowDelta > 0, "item must enter escrow");
  });

  it("fails when seller does not own item", () => {
    const snap = makeSnap({ items: {} });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq();
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("insufficient") || e.includes("ownership")));
  });

  it("fails when seller cannot afford listing fee", () => {
    const snap = makeSnap({ gold: 0, items: { iron_sword: 1 } });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq();
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("gold") || e.includes("fee")));
  });

  it("clamps price to HARTHMERE_AUCTION_MAX_UNIT_PRICE", () => {
    const snap = makeSnap({ gold: 999999, items: { iron_sword: 1 } });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq({ suggestedUnitPrice: HARTHMERE_AUCTION_MAX_UNIT_PRICE + 1_000_000 });
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    // Server should either reject or clamp — either is acceptable, but NOT trust the price
    if (result.ok) {
      assert.ok(result.listing !== undefined);
      assert.ok(result.listing!.unitPrice <= HARTHMERE_AUCTION_MAX_UNIT_PRICE);
    }
  });

  it("fails listing 0 or negative count", () => {
    const snap = makeSnap({ items: { iron_sword: 5 }, gold: 9999 });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq({ count: 0 });
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("blocks listing quest items", () => {
    const snap = makeSnap({ items: { quest_relic: 1 }, gold: 9999 });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq({ itemId: "quest_relic" });
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("cannot double-list escrowed items", () => {
    // seller owns 1 iron_sword but it is already in escrow
    const snap = makeSnap({ items: { iron_sword: 1 }, escrow: { iron_sword: 1 }, gold: 9999 });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq({ count: 1 });
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok, "escrowed items cannot be listed again");
  });

  it("listing fee is non-refundable (included in sellerGoldDelta)", () => {
    const snap = makeSnap({ gold: 500, items: { iron_sword: 1 } });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap };
    const req = makePostReq({ suggestedUnitPrice: 100 });
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    // Fee must be at least the base flat fee
    assert.ok(Math.abs(result.sellerGoldDelta) >= HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD);
  });
});

// ---------------------------------------------------------------------------
// cancel_listing
// ---------------------------------------------------------------------------

describe("Auction cancel_listing", () => {
  it("succeeds and returns escrow to inventory", () => {
    const snap = makeSnap({ items: { iron_sword: 0 }, escrow: { iron_sword: 1 } });
    const listing = activeListing();
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "seller_1", kind: "cancel_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    // Escrow released on cancel
    assert.ok(result.sellerEscrowDelta < 0, "escrow should decrease");
  });

  it("fails if listing does not exist", () => {
    const snap = makeSnap();
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: undefined };
    const req = { requestId: "r", actorId: "seller_1", kind: "cancel_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails if canceller is not the seller", () => {
    const snap = makeSnap({ actorId: "other_player" });
    const listing = activeListing();
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "other_player", kind: "cancel_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("listing fee is NOT refunded on cancel", () => {
    const snap = makeSnap({ items: {}, escrow: { iron_sword: 1 } });
    const listing = activeListing();
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "seller_1", kind: "cancel_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.sellerGoldDelta, 0, "no gold returned on cancel — fee was non-refundable");
  });
});

// ---------------------------------------------------------------------------
// buy_listing
// ---------------------------------------------------------------------------

describe("Auction buy_listing", () => {
  it("atomic swap: buyer gains item, seller gains gold minus tax", () => {
    const buyerSnap = makeSnap({ actorId: "buyer_1", gold: 1000, items: {} });
    const listing = activeListing({ unitPrice: 200, count: 1 });
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: buyerSnap,
      buyerSnapshot: buyerSnap,
      currentListing: listing,
      buyerInventorySlots: 0,
    };
    const req = { requestId: "r", actorId: "buyer_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.buyerItemDelta > 0, "buyer should receive item");
    assert.ok(result.buyerGoldDelta < 0, "buyer pays gold");
    // Tax is server-computed
    const expected = Math.floor(200 * (1 - HARTHMERE_AUCTION_SALE_TAX_RATE));
    assert.ok(result.sellerGoldDelta >= expected - 1);
  });

  it("fails when buyer cannot afford the listing", () => {
    const buyerSnap = makeSnap({ actorId: "buyer_1", gold: 10, items: {} });
    const listing = activeListing({ unitPrice: 200 });
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: buyerSnap,
      buyerSnapshot: buyerSnap,
      currentListing: listing,
      buyerInventorySlots: 0,
    };
    const req = { requestId: "r", actorId: "buyer_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("gold")));
  });

  it("fails when listing has expired", () => {
    const buyerSnap = makeSnap({ actorId: "buyer_1", gold: 9999, items: {} });
    const expired = activeListing({ expiresAtMs: NOW - 1000 }); // expired 1s ago
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: buyerSnap,
      currentListing: expired,
      buyerInventorySlots: 0,
    };
    const req = { requestId: "r", actorId: "buyer_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("expired")));
  });

  it("fails when buyer tries to purchase their own listing", () => {
    const snap = makeSnap({ actorId: "seller_1", gold: 9999, items: {} });
    const listing = activeListing({ sellerId: "seller_1" });
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: snap,
      currentListing: listing,
      buyerInventorySlots: 0,
    };
    const req = { requestId: "r", actorId: "seller_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("own_listing") || e.includes("self") || e.includes("cannot_buy")));
  });

  it("fails when buyer inventory is full", () => {
    const buyerSnap = makeSnap({ actorId: "buyer_1", gold: 9999, items: {} });
    const listing = activeListing();
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: buyerSnap,
      currentListing: listing,
      buyerInventorySlots: 40, // at capacity
    };
    const req = { requestId: "r", actorId: "buyer_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some(e => e.includes("inventory_full") || e.includes("capacity")));
  });

  it("tax is computed server-side, not from client", () => {
    const buyerSnap = makeSnap({ actorId: "buyer_1", gold: 9999, items: {} });
    const listing = activeListing({ unitPrice: 1000 });
    const ctx: HarthmereAuctionMutationContextV1 = {
      actorSnapshot: buyerSnap,
      currentListing: listing,
      buyerInventorySlots: 0,
    };
    const req = { requestId: "r", actorId: "buyer_1", kind: "buy_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    const expectedTax = Math.floor(1000 * HARTHMERE_AUCTION_SALE_TAX_RATE);
    assert.strictEqual(result.houseTaxGoldDelta, expectedTax);
  });
});

// ---------------------------------------------------------------------------
// expire_listing / recover_expired_escrow
// ---------------------------------------------------------------------------

describe("Auction expiry and recovery", () => {
  it("expire_listing transitions active listing to expired", () => {
    const snap = makeSnap();
    const listing = activeListing({ expiresAtMs: NOW - 1000 }); // already expired
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "system", kind: "expire_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.listing?.status, "expired");
  });

  it("expire_listing fails if listing has not actually expired yet", () => {
    const snap = makeSnap();
    const listing = activeListing(); // not expired
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "system", kind: "expire_listing", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("recover_expired_escrow returns item to seller", () => {
    const snap = makeSnap({ items: {}, escrow: { iron_sword: 1 } });
    const listing = activeListing({ status: "expired" });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "seller_1", kind: "recover_expired_escrow", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.sellerItemDelta >= 0);
  });

  it("recover_expired_escrow fails for non-expired listing", () => {
    const snap = makeSnap({ escrow: { iron_sword: 1 } });
    const listing = activeListing({ status: "active" });
    const ctx: HarthmereAuctionMutationContextV1 = { actorSnapshot: snap, currentListing: listing };
    const req = { requestId: "r", actorId: "seller_1", kind: "recover_expired_escrow", listingId: "listing_1", nowMs: NOW } as HarthmereAuctionMutationRequestV1;
    const result = reduceHarthmereAuctionMutationV1(req, ctx);
    assert.ok(!result.ok);
  });

  it("collectExpiredHarthmereAuctionListingsV1 returns only active+expired listings", () => {
    const listings: HarthmereAuctionListingV1[] = [
      activeListing({ listingId: "l1", expiresAtMs: NOW - 5000 }),  // expired
      activeListing({ listingId: "l2", expiresAtMs: NOW + 5000 }),  // not yet
      activeListing({ listingId: "l3", status: "sold", expiresAtMs: NOW - 1000 }),   // sold
      activeListing({ listingId: "l4", status: "cancelled", expiresAtMs: NOW - 1 }), // cancelled
    ];
    const expired = collectExpiredHarthmereAuctionListingsV1(listings, NOW);
    assert.strictEqual(expired.length, 1);
    assert.strictEqual(expired[0].listingId, "l1");
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe("searchHarthmereAuctionListingsV1", () => {
  const listings: HarthmereAuctionListingV1[] = [
    activeListing({ listingId: "a1", itemId: "iron_sword", unitPrice: 100 }),
    activeListing({ listingId: "a2", itemId: "iron_sword", unitPrice: 300 }),
    activeListing({ listingId: "a3", itemId: "health_potion", unitPrice: 50, sellerId: "seller_2" }),
    activeListing({ listingId: "a4", itemId: "iron_sword", status: "sold", unitPrice: 200 }),
    activeListing({ listingId: "a5", itemId: "iron_sword", unitPrice: 150, expiresAtMs: NOW - 1 }), // expired
  ];

  it("filters by itemId", () => {
    const res = searchHarthmereAuctionListingsV1(listings, { itemId: "health_potion" }, NOW);
    assert.ok(res.listings.every(r => r.itemId === "health_potion"));
    assert.strictEqual(res.listings.length, 1);
  });

  it("activeOnly excludes sold and expired listings", () => {
    const res = searchHarthmereAuctionListingsV1(listings, { activeOnly: true }, NOW);
    assert.ok(res.listings.every(r => r.status === "active"));
    assert.ok(!res.listings.some(r => r.listingId === "a4" || r.listingId === "a5"));
  });

  it("filters by price range", () => {
    const res = searchHarthmereAuctionListingsV1(listings, { minUnitPrice: 100, maxUnitPrice: 200, activeOnly: true }, NOW);
    assert.ok(res.listings.every(r => r.unitPrice >= 100 && r.unitPrice <= 200));
  });

  it("filters by seller", () => {
    const res = searchHarthmereAuctionListingsV1(listings, { sellerId: "seller_2" }, NOW);
    assert.ok(res.listings.every(r => r.sellerId === "seller_2"));
  });

  it("paginates results with offset and limit", () => {
    const allActive = searchHarthmereAuctionListingsV1(listings, { activeOnly: true }, NOW);
    const page0 = searchHarthmereAuctionListingsV1(listings, { activeOnly: true, offset: 0, limit: 1 }, NOW);
    const page1 = searchHarthmereAuctionListingsV1(listings, { activeOnly: true, offset: 1, limit: 1 }, NOW);
    assert.strictEqual(page0.listings.length, 1);
    assert.strictEqual(page1.listings.length, 1);
    assert.notStrictEqual(page0.listings[0].listingId, page1.listings[0].listingId);
    assert.ok(allActive.totalCount > 1);
  });

  it("returns empty results for no match", () => {
    const res = searchHarthmereAuctionListingsV1(listings, { itemId: "legendary_armor" }, NOW);
    assert.strictEqual(res.listings.length, 0);
    assert.strictEqual(res.totalCount, 0);
  });
});

// ---------------------------------------------------------------------------
// Fee preview
// ---------------------------------------------------------------------------

describe("previewHarthmereAuctionFeesV1", () => {
  it("returns listing fee and estimated tax", () => {
    const preview = previewHarthmereAuctionFeesV1(1000, 1);
    assert.ok(preview.listingFee >= HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD);
    assert.ok(preview.estimatedTax >= 0);
  });

  it("estimated seller net equals price minus tax", () => {
    const preview = previewHarthmereAuctionFeesV1(1000, 1);
    const expectedNet = Math.floor(1000 * (1 - HARTHMERE_AUCTION_SALE_TAX_RATE));
    assert.strictEqual(preview.estimatedSellerNet, expectedNet);
  });

  it("estimated tax matches sale tax rate", () => {
    const preview = previewHarthmereAuctionFeesV1(1000, 1);
    const expectedTax = Math.floor(1000 * HARTHMERE_AUCTION_SALE_TAX_RATE);
    assert.strictEqual(preview.estimatedTax, expectedTax);
  });

  it("multi-count listing scales fees correctly", () => {
    const single = previewHarthmereAuctionFeesV1(100, 1);
    const multi = previewHarthmereAuctionFeesV1(100, 5);
    assert.ok(multi.listingFee >= single.listingFee);
    assert.ok(multi.estimatedSellerNet > single.estimatedSellerNet);
  });
});
