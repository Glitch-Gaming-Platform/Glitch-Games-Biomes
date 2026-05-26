/*
 * mmo_auction_authority_v1.ts
 *
 * Production auction house server authority for Harthmere MMO.
 *
 * The rules say auction listings MUST:
 *   - escrow items (remove from seller inventory atomically on listing)
 *   - support search / filter / purchase
 *   - charge listing fees and transaction taxes (server-computed)
 *   - return expired listing items to seller (or to overflow/mail)
 *   - block bound / quest items from being listed
 *   - validate ownership and exact stack count before listing
 *
 * All prices and fee rates are server-computed; the client can suggest a
 * price but the server re-clamps and re-validates it.
 */

export const MMO_AUCTION_AUTHORITY_VERSION_V1 = "mmo-auction-authority-v1";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Flat listing fee in gold, charged when the listing is created (non-refundable) */
export const HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD = 10;

/** Percentage of final sale price taken as a transaction tax (0–1) */
export const HARTHMERE_AUCTION_SALE_TAX_RATE = 0.05;

/** Default listing duration in ms */
export const HARTHMERE_AUCTION_DEFAULT_DURATION_MS = 48 * 60 * 60 * 1000;

/** Maximum price allowed to prevent overflow/exploit */
export const HARTHMERE_AUCTION_MAX_UNIT_PRICE = 10_000_000;

/** Minimum stack size that can be listed */
export const HARTHMERE_AUCTION_MIN_COUNT = 1;

// ---------------------------------------------------------------------------
// Auction listing record (persisted to Redis/DB, never trusted from client)
// ---------------------------------------------------------------------------

export type HarthmereAuctionListingStatusV1 =
  | "active"
  | "sold"
  | "expired"
  | "cancelled"
  | "escrow_pending";

export interface HarthmereAuctionListingV1 {
  listingId: string;
  sellerId: string;
  itemId: string;
  count: number;
  /** Unit price in gold — server-clamped */
  unitPrice: number;
  /** Total gold amount escrowed from seller's inventory */
  listingFeeCharged: number;
  status: HarthmereAuctionListingStatusV1;
  createdAtMs: number;
  expiresAtMs: number;
  soldAtMs?: number;
  cancelledAtMs?: number;
  /** Buyer's actor id, set on sale */
  buyerId?: string;
  /** Sale price actually paid (could be buyout price or auction result) */
  salePricePaid?: number;
  /** Tax taken from seller on sale */
  taxCharged?: number;
  /** Net gold delivered to seller after tax */
  sellerNetGold?: number;
}

// ---------------------------------------------------------------------------
// Search / filter types
// ---------------------------------------------------------------------------

export interface HarthmereAuctionSearchFilterV1 {
  itemId?: string;
  sellerId?: string;
  minUnitPrice?: number;
  maxUnitPrice?: number;
  minCount?: number;
  /** Only return active listings */
  activeOnly?: boolean;
  /** Sort field */
  sortBy?: "unit_price_asc" | "unit_price_desc" | "expires_soonest" | "newest";
  offset?: number;
  limit?: number;
}

export interface HarthmereAuctionSearchResultV1 {
  listings: HarthmereAuctionListingV1[];
  totalCount: number;
  offset: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Mutation request / result types
// ---------------------------------------------------------------------------

export type HarthmereAuctionMutationKindV1 =
  | "post_listing"
  | "cancel_listing"
  | "buy_listing"
  | "expire_listing"
  | "recover_expired_escrow";

export interface HarthmereAuctionMutationRequestV1 {
  requestId: string;
  kind: HarthmereAuctionMutationKindV1;
  actorId: string;
  nowMs: number;
  /** For post_listing */
  itemId?: string;
  count?: number;
  /** Suggested unit price; server re-clamps */
  suggestedUnitPrice?: number;
  /** For cancel_listing / buy_listing / expire_listing */
  listingId?: string;
}

export interface HarthmereAuctionMutationResultV1 {
  ok: boolean;
  requestId: string;
  kind: HarthmereAuctionMutationKindV1;
  actorId: string;
  errors: string[];
  warnings: string[];
  /** Listing created or mutated */
  listing?: HarthmereAuctionListingV1;
  /** Item delta for seller's inventory (negative when escrowing on post) */
  sellerItemDelta: number;
  /** Escrow delta for seller (positive when escrowing on post) */
  sellerEscrowDelta: number;
  /** Gold delta for seller */
  sellerGoldDelta: number;
  /** Item delta for buyer's inventory (positive on purchase) */
  buyerItemDelta: number;
  /** Gold delta for buyer (negative on purchase) */
  buyerGoldDelta: number;
  /** Gold delta for house/tax sink (positive on sale) */
  houseTaxGoldDelta: number;
  auditTags: string[];
}

// ---------------------------------------------------------------------------
// Item binding/quest restriction helpers (re-uses inventory authority)
// ---------------------------------------------------------------------------

import {
  availableCount,
  getHarthmereItemDefinitionV1,
  type HarthmereInventorySnapshotV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";

function fail(errors: string[], ...codes: string[]) {
  errors.push(...codes);
}

function resultFail(
  req: HarthmereAuctionMutationRequestV1,
  errors: string[]
): HarthmereAuctionMutationResultV1 {
  return {
    ok: false,
    requestId: req.requestId,
    kind: req.kind,
    actorId: req.actorId,
    errors,
    warnings: [],
    sellerItemDelta: 0,
    sellerEscrowDelta: 0,
    sellerGoldDelta: 0,
    buyerItemDelta: 0,
    buyerGoldDelta: 0,
    houseTaxGoldDelta: 0,
    auditTags: [],
  };
}

function resultOk(
  req: HarthmereAuctionMutationRequestV1,
  overrides: Partial<HarthmereAuctionMutationResultV1>
): HarthmereAuctionMutationResultV1 {
  return {
    ok: true,
    requestId: req.requestId,
    kind: req.kind,
    actorId: req.actorId,
    errors: [],
    warnings: [],
    sellerItemDelta: 0,
    sellerEscrowDelta: 0,
    sellerGoldDelta: 0,
    buyerItemDelta: 0,
    buyerGoldDelta: 0,
    houseTaxGoldDelta: 0,
    auditTags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Listing ID generator (deterministic from requestId for idempotency)
// ---------------------------------------------------------------------------

export function generateHarthmereAuctionListingIdV1(
  sellerId: string,
  requestId: string
): string {
  return `auction:listing:${sellerId}:${requestId}`;
}

// ---------------------------------------------------------------------------
// Post listing
// ---------------------------------------------------------------------------

function validatePostListing(
  req: HarthmereAuctionMutationRequestV1,
  sellerSnapshot: HarthmereInventorySnapshotV1
): HarthmereAuctionMutationResultV1 {
  const errors: string[] = [];
  const { requestId, actorId, itemId, count = 1, suggestedUnitPrice, nowMs } = req;

  if (!itemId) return resultFail(req, ["missing_item_id"]);
  if (count < HARTHMERE_AUCTION_MIN_COUNT) return resultFail(req, ["invalid_count"]);

  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(req, ["unknown_item_id"]);

  // Bound / quest items cannot be listed
  if (def.isQuestItem) fail(errors, "cannot_list_quest_item");
  if (def.binding === "on_pickup") fail(errors, "cannot_list_soulbound_item");
  if (def.binding === "on_equip") fail(errors, "cannot_list_bind_on_equip_item");

  // Ownership and stack count — server verifies actual possession
  const available = availableCount(sellerSnapshot, itemId);
  if (available < count) fail(errors, "insufficient_item_count");

  // Price validation
  const unitPrice = Math.max(
    1,
    Math.min(
      HARTHMERE_AUCTION_MAX_UNIT_PRICE,
      suggestedUnitPrice ?? def.baseValue
    )
  );

  // Listing fee (non-refundable)
  const listingFee =
    HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD +
    Math.floor(unitPrice * count * 0.01); // 1% deposit
  if (sellerSnapshot.gold < listingFee) {
    fail(errors, "insufficient_gold_for_listing_fee");
  }

  if (errors.length > 0) return resultFail(req, errors);

  const listingId = generateHarthmereAuctionListingIdV1(actorId, requestId);
  const listing: HarthmereAuctionListingV1 = {
    listingId,
    sellerId: actorId,
    itemId,
    count,
    unitPrice,
    listingFeeCharged: listingFee,
    status: "active",
    createdAtMs: nowMs,
    expiresAtMs: nowMs + HARTHMERE_AUCTION_DEFAULT_DURATION_MS,
  };

  return resultOk(req, {
    listing,
    // Items move into escrow on the seller's account; they leave the tradeable
    // pool immediately.  The escrow record is separate so the item cannot be
    // double-spent or double-listed.
    sellerItemDelta: 0,          // items stay in inventory.items
    sellerEscrowDelta: count,    // but count increments in escrow map
    sellerGoldDelta: -listingFee,
    auditTags: ["auction_post", listingId, itemId, `price:${unitPrice}`, `fee:${listingFee}`],
  });
}

// ---------------------------------------------------------------------------
// Cancel listing (seller cancels before expiry)
// ---------------------------------------------------------------------------

function validateCancelListing(
  req: HarthmereAuctionMutationRequestV1,
  listing: HarthmereAuctionListingV1 | undefined
): HarthmereAuctionMutationResultV1 {
  if (!listing) return resultFail(req, ["listing_not_found"]);
  if (listing.sellerId !== req.actorId) return resultFail(req, ["not_listing_owner"]);
  if (listing.status !== "active") return resultFail(req, ["listing_not_active"]);

  const cancelled: HarthmereAuctionListingV1 = {
    ...listing,
    status: "cancelled",
    cancelledAtMs: req.nowMs,
  };

  return resultOk(req, {
    listing: cancelled,
    // Release escrow back to tradeable pool
    sellerEscrowDelta: -listing.count,
    // Listing fee is NOT refunded (non-refundable by design)
    auditTags: ["auction_cancel", listing.listingId, listing.itemId],
  });
}

// ---------------------------------------------------------------------------
// Buy listing (buyer purchases at listed price)
// ---------------------------------------------------------------------------

function validateBuyListing(
  req: HarthmereAuctionMutationRequestV1,
  listing: HarthmereAuctionListingV1 | undefined,
  buyerSnapshot: HarthmereInventorySnapshotV1,
  buyerInventorySlots: number
): HarthmereAuctionMutationResultV1 {
  if (!listing) return resultFail(req, ["listing_not_found"]);
  if (listing.status !== "active") return resultFail(req, ["listing_not_active"]);
  if (listing.sellerId === req.actorId) return resultFail(req, ["cannot_buy_own_listing"]);

  const totalPrice = listing.unitPrice * listing.count;
  if (buyerSnapshot.gold < totalPrice) {
    return resultFail(req, ["insufficient_gold"]);
  }

  // Inventory space for buyer
  const def = getHarthmereItemDefinitionV1(listing.itemId);
  if (!def) return resultFail(req, ["unknown_item_id"]);

  const buyerExisting = buyerSnapshot.items[listing.itemId] ?? 0;
  const buyerNewCount = buyerExisting + listing.count;
  if (buyerNewCount > def.maxStackSize) {
    return resultFail(req, ["buyer_stack_size_exceeded"]);
  }
  if (buyerExisting === 0 && buyerInventorySlots >= 40) {
    return resultFail(req, ["buyer_inventory_full"]);
  }

  // Expired check
  if (req.nowMs > listing.expiresAtMs) {
    return resultFail(req, ["listing_has_expired"]);
  }

  // Server-computed tax
  const tax = Math.floor(totalPrice * HARTHMERE_AUCTION_SALE_TAX_RATE);
  const sellerNet = totalPrice - tax;

  const sold: HarthmereAuctionListingV1 = {
    ...listing,
    status: "sold",
    soldAtMs: req.nowMs,
    buyerId: req.actorId,
    salePricePaid: totalPrice,
    taxCharged: tax,
    sellerNetGold: sellerNet,
  };

  return resultOk(req, {
    listing: sold,
    // Seller: escrow released (item removed from escrow), gold received
    sellerEscrowDelta: -listing.count,
    sellerItemDelta: -listing.count,  // item leaves seller's inventory
    sellerGoldDelta: sellerNet,
    // Buyer: gold spent, item received
    buyerItemDelta: listing.count,
    buyerGoldDelta: -totalPrice,
    // Tax to house/economy sink
    houseTaxGoldDelta: tax,
    auditTags: [
      "auction_buy",
      listing.listingId,
      listing.itemId,
      `price:${totalPrice}`,
      `tax:${tax}`,
      `seller_net:${sellerNet}`,
    ],
  });
}

// ---------------------------------------------------------------------------
// Expire listing (server tick expires a listing after its duration)
// ---------------------------------------------------------------------------

function validateExpireListing(
  req: HarthmereAuctionMutationRequestV1,
  listing: HarthmereAuctionListingV1 | undefined
): HarthmereAuctionMutationResultV1 {
  if (!listing) return resultFail(req, ["listing_not_found"]);
  if (listing.status !== "active") return resultFail(req, ["listing_not_active"]);
  if (req.nowMs <= listing.expiresAtMs) {
    return resultFail(req, ["listing_not_yet_expired"]);
  }

  const expired: HarthmereAuctionListingV1 = {
    ...listing,
    status: "expired",
  };

  return resultOk(req, {
    listing: expired,
    // Release escrow; items route to seller's overflow/mail on recovery
    sellerEscrowDelta: -listing.count,
    auditTags: ["auction_expire", listing.listingId, listing.itemId],
  });
}

// ---------------------------------------------------------------------------
// Recover expired escrow (returns items to seller via mail/overflow)
// ---------------------------------------------------------------------------

function validateRecoverExpiredEscrow(
  req: HarthmereAuctionMutationRequestV1,
  listing: HarthmereAuctionListingV1 | undefined,
  sellerSnapshot: HarthmereInventorySnapshotV1
): HarthmereAuctionMutationResultV1 {
  if (!listing) return resultFail(req, ["listing_not_found"]);
  if (listing.status !== "expired") return resultFail(req, ["listing_not_expired"]);
  if (listing.sellerId !== req.actorId) return resultFail(req, ["not_listing_owner"]);

  // Inventory space; if full, send to overflow/mail (handled by caller)
  const def = getHarthmereItemDefinitionV1(listing.itemId);
  const warnings: string[] = [];
  const canFitInInventory =
    def !== undefined &&
    Object.keys(sellerSnapshot.items).length < 40 ||
    (sellerSnapshot.items[listing.itemId] ?? 0) > 0;

  if (!canFitInInventory) {
    warnings.push("expired_escrow_routed_to_overflow_mail");
  }

  return resultOk(req, {
    // Items return to the seller's inventory (or mail if full; caller handles)
    sellerItemDelta: canFitInInventory ? listing.count : 0,
    warnings,
    auditTags: [
      "auction_recover",
      listing.listingId,
      listing.itemId,
      ...(warnings.length > 0 ? ["overflow_mail"] : []),
    ],
  });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export interface HarthmereAuctionMutationContextV1 {
  /** Snapshot of the seller's inventory; for buy actions, this is the buyer */
  actorSnapshot: HarthmereInventorySnapshotV1;
  /** Snapshot of the buyer's inventory (buy_listing only) */
  buyerSnapshot?: HarthmereInventorySnapshotV1;
  /** Current auction listing record loaded from server state */
  currentListing?: HarthmereAuctionListingV1;
  /** Buyer's occupied inventory slot count */
  buyerInventorySlots?: number;
}

export function reduceHarthmereAuctionMutationV1(
  req: HarthmereAuctionMutationRequestV1,
  ctx: HarthmereAuctionMutationContextV1
): HarthmereAuctionMutationResultV1 {
  switch (req.kind) {
    case "post_listing":
      return validatePostListing(req, ctx.actorSnapshot);

    case "cancel_listing":
      return validateCancelListing(req, ctx.currentListing);

    case "buy_listing":
      return validateBuyListing(
        req,
        ctx.currentListing,
        ctx.buyerSnapshot ?? ctx.actorSnapshot,
        ctx.buyerInventorySlots ?? Object.keys(ctx.buyerSnapshot?.items ?? ctx.actorSnapshot.items).length
      );

    case "expire_listing":
      return validateExpireListing(req, ctx.currentListing);

    case "recover_expired_escrow":
      return validateRecoverExpiredEscrow(req, ctx.currentListing, ctx.actorSnapshot);
  }
}

// ---------------------------------------------------------------------------
// Search / filter (pure function — caller loads listings from Redis/DB first)
// ---------------------------------------------------------------------------

export function searchHarthmereAuctionListingsV1(
  allListings: HarthmereAuctionListingV1[],
  filter: HarthmereAuctionSearchFilterV1,
  nowMs: number
): HarthmereAuctionSearchResultV1 {
  let results = allListings.filter((l) => {
    if (filter.activeOnly && l.status !== "active") return false;
    // Auto-exclude expired active listings
    if (l.status === "active" && nowMs > l.expiresAtMs) return false;
    if (filter.itemId && l.itemId !== filter.itemId) return false;
    if (filter.sellerId && l.sellerId !== filter.sellerId) return false;
    if (filter.minUnitPrice !== undefined && l.unitPrice < filter.minUnitPrice)
      return false;
    if (filter.maxUnitPrice !== undefined && l.unitPrice > filter.maxUnitPrice)
      return false;
    if (filter.minCount !== undefined && l.count < filter.minCount) return false;
    return true;
  });

  // Sort
  if (filter.sortBy === "unit_price_asc") {
    results.sort((a, b) => a.unitPrice - b.unitPrice);
  } else if (filter.sortBy === "unit_price_desc") {
    results.sort((a, b) => b.unitPrice - a.unitPrice);
  } else if (filter.sortBy === "expires_soonest") {
    results.sort((a, b) => a.expiresAtMs - b.expiresAtMs);
  } else {
    // newest first (default)
    results.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  const totalCount = results.length;
  const offset = filter.offset ?? 0;
  const limit = Math.min(filter.limit ?? 50, 200);
  results = results.slice(offset, offset + limit);

  return { listings: results, totalCount, offset, limit };
}

// ---------------------------------------------------------------------------
// Batch expiry helper — called from a server cron/tick
// ---------------------------------------------------------------------------

export function collectExpiredHarthmereAuctionListingsV1(
  listings: HarthmereAuctionListingV1[],
  nowMs: number
): HarthmereAuctionListingV1[] {
  return listings.filter(
    (l) => l.status === "active" && nowMs > l.expiresAtMs
  );
}

// ---------------------------------------------------------------------------
// Fee preview (UI helper — never used as authoritative input)
// ---------------------------------------------------------------------------

export function previewHarthmereAuctionFeesV1(
  unitPrice: number,
  count: number
): { listingFee: number; estimatedTax: number; estimatedSellerNet: number } {
  const clampedPrice = Math.max(1, Math.min(HARTHMERE_AUCTION_MAX_UNIT_PRICE, unitPrice));
  const total = clampedPrice * count;
  const listingFee =
    HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD + Math.floor(total * 0.01);
  const estimatedTax = Math.floor(total * HARTHMERE_AUCTION_SALE_TAX_RATE);
  return {
    listingFee,
    estimatedTax,
    estimatedSellerNet: total - estimatedTax,
  };
}
