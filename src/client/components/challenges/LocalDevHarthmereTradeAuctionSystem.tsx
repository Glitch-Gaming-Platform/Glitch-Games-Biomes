import React, { useEffect, useMemo, useState } from "react";

export const HARTHMERE_TRADE_AUCTION_SYSTEM_VERSION = 1;
export const HARTHMERE_TRADE_AUCTION_LOCAL_STORAGE_KEY =
  "biomes.localDev.harthmere.tradeAuctionState.v1";
export const HARTHMERE_TRADE_AUCTION_CHANGED_EVENT =
  "biomes:harthmere-trade-auction-changed";

export const HARTHMERE_AUCTION_LISTING_FEE_RATE = 0.05;
export const HARTHMERE_AUCTION_SALE_TAX_RATE = 0.1;
export const HARTHMERE_AUCTION_DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000;
export const HARTHMERE_HIGH_VALUE_TRADE_LOG_THRESHOLD = 500;

export type HarthmereTradeAuctionCurrency = "gold" | "silver" | "copper";
export type HarthmereAuctionStatus =
  | "active"
  | "sold"
  | "expired"
  | "cancelled";
export type HarthmereTradeStatus =
  | "open"
  | "locked"
  | "committed"
  | "cancelled";

export type HarthmereTradeableItem = {
  instanceId: string;
  itemId: string;
  ownerId: string;
  quantity: number;
  category?: string;
  baseValue?: number;
  bound?: boolean;
  accountBound?: boolean;
  questItem?: boolean;
  locked?: boolean;
  stolen?: boolean;
  lockedInTrade?: boolean;
  escrowId?: string;
  acquiredAt?: number;
};

export type HarthmereTradingPlayerState = {
  playerId: string;
  accountId?: string;
  backpack: HarthmereTradeableItem[];
  wallet: Record<string, number>;
  mailbox?: HarthmereAuctionMailMessage[];
};

export type HarthmereTradeParticipant = {
  playerId: string;
  displayName?: string;
  confirmed: boolean;
  lockedAt?: number;
  disconnected?: boolean;
  offeredItems: HarthmereTradeableItem[];
  offeredCurrency: Record<string, number>;
};

export type HarthmerePlayerTradeSession = {
  id: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  status: HarthmereTradeStatus;
  initiatorId: string;
  targetId: string;
  participants: Record<string, HarthmereTradeParticipant>;
  cancelReason?: string;
  committedAt?: number;
};

export type HarthmereEscrowRecord = {
  id: string;
  source: "trade" | "auction" | "mail" | "recovery";
  ownerId: string;
  item: HarthmereTradeableItem;
  createdAt: number;
  listingId?: string;
  sessionId?: string;
  transactionId?: string;
};

export type HarthmereAuctionListing = {
  id: string;
  transactionId: string;
  sellerId: string;
  itemId: string;
  itemInstanceId: string;
  quantity: number;
  priceGold: number;
  listingFeeGold: number;
  saleTaxRate: number;
  status: HarthmereAuctionStatus;
  escrowId: string;
  createdAt: number;
  expiresAt: number;
  soldAt?: number;
  buyerId?: string;
  cancelledAt?: number;
};

export type HarthmereAuctionMailMessage = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  subject: string;
  body: string;
  createdAt: number;
  attachments: HarthmereTradeableItem[];
  currency: Record<string, number>;
  codGold?: number;
  source:
    | "auction_purchase"
    | "auction_return"
    | "trade_cancel"
    | "manual_mail"
    | "recovery";
  claimedAt?: number;
};

export type HarthmereMarketHistoryEntry = {
  id: string;
  at: number;
  event:
    | "listed"
    | "sold"
    | "expired"
    | "cancelled"
    | "listing_fee_sink"
    | "auction_tax_sink";
  itemId: string;
  listingId?: string;
  sellerId?: string;
  buyerId?: string;
  priceGold?: number;
  feeGold?: number;
  taxGold?: number;
  quantity?: number;
};

export type HarthmereTradeAuctionLogEntry = {
  id: string;
  at: number;
  system: "trade_auction";
  action: string;
  actorId?: string;
  itemId?: string;
  listingId?: string;
  sessionId?: string;
  amountGold?: number;
  reason: string;
  success: boolean;
};

export type HarthmereTradeAuctionState = {
  version: 1;
  trades: Record<string, HarthmerePlayerTradeSession>;
  auctions: Record<string, HarthmereAuctionListing>;
  escrow: Record<string, HarthmereEscrowRecord>;
  transactionIds: Record<string, number>;
  marketHistory: HarthmereMarketHistoryEntry[];
  logs: HarthmereTradeAuctionLogEntry[];
};

export type HarthmereTradeAuctionResult<T> =
  | { ok: true; state: HarthmereTradeAuctionState; value: T; logs?: string[] }
  | { ok: false; state: HarthmereTradeAuctionState; error: string; logs?: string[] };

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function now() {
  return Date.now();
}

function id(prefix: string) {
  return `${prefix}_${now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function clampCurrency(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.floor(n));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createHarthmereTradeAuctionState(): HarthmereTradeAuctionState {
  return {
    version: 1,
    trades: {},
    auctions: {},
    escrow: {},
    transactionIds: {},
    marketHistory: [],
    logs: [],
  };
}

export function readHarthmereTradeAuctionState(): HarthmereTradeAuctionState {
  if (!isBrowser()) {
    return createHarthmereTradeAuctionState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_TRADE_AUCTION_LOCAL_STORAGE_KEY);
    if (!raw) {
      return createHarthmereTradeAuctionState();
    }
    const parsed = JSON.parse(raw) as Partial<HarthmereTradeAuctionState>;
    return {
      version: 1,
      trades: parsed.trades ?? {},
      auctions: parsed.auctions ?? {},
      escrow: parsed.escrow ?? {},
      transactionIds: parsed.transactionIds ?? {},
      marketHistory: Array.isArray(parsed.marketHistory) ? parsed.marketHistory : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return createHarthmereTradeAuctionState();
  }
}

export function writeHarthmereTradeAuctionState(state: HarthmereTradeAuctionState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_TRADE_AUCTION_LOCAL_STORAGE_KEY,
    JSON.stringify(state),
  );
  window.dispatchEvent(new CustomEvent(HARTHMERE_TRADE_AUCTION_CHANGED_EVENT));
}

function appendLog(
  state: HarthmereTradeAuctionState,
  entry: Omit<HarthmereTradeAuctionLogEntry, "id" | "at" | "system">,
) {
  state.logs = [
    {
      id: id("talog"),
      at: now(),
      system: "trade_auction",
      ...entry,
    },
    ...state.logs,
  ].slice(0, 250);
}

function appendMarketHistory(
  state: HarthmereTradeAuctionState,
  entry: Omit<HarthmereMarketHistoryEntry, "id" | "at">,
) {
  state.marketHistory = [
    {
      id: id("market"),
      at: now(),
      ...entry,
    },
    ...state.marketHistory,
  ].slice(0, 500);
}

export function isHarthmereTradeableItem(item: HarthmereTradeableItem | undefined) {
  if (!item) {
    return { ok: false, reason: "Item does not exist." };
  }
  if (item.quantity <= 0) {
    return { ok: false, reason: "Item quantity must be positive." };
  }
  if (item.bound || item.accountBound) {
    return { ok: false, reason: "Bound or account-bound items cannot be traded." };
  }
  if (item.questItem || item.category === "quest_item") {
    return { ok: false, reason: "Quest items cannot be traded." };
  }
  if (item.locked || item.lockedInTrade) {
    return { ok: false, reason: "Locked items cannot be traded." };
  }
  if (item.escrowId) {
    return { ok: false, reason: "Escrowed items cannot be traded twice." };
  }
  return { ok: true, reason: "tradable" };
}

export function beginHarthmerePlayerTrade(
  state: HarthmereTradeAuctionState,
  initiatorId: string,
  targetId: string,
): HarthmereTradeAuctionResult<HarthmerePlayerTradeSession> {
  if (!initiatorId || !targetId || initiatorId === targetId) {
    const next = clone(state);
    appendLog(next, {
      action: "trade_begin",
      actorId: initiatorId,
      reason: "invalid_participants",
      success: false,
    });
    return { ok: false, state: next, error: "Trade needs two different players." };
  }
  const next = clone(state);
  const session: HarthmerePlayerTradeSession = {
    id: id("trade"),
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    status: "open",
    initiatorId,
    targetId,
    participants: {
      [initiatorId]: {
        playerId: initiatorId,
        confirmed: false,
        offeredItems: [],
        offeredCurrency: {},
      },
      [targetId]: {
        playerId: targetId,
        confirmed: false,
        offeredItems: [],
        offeredCurrency: {},
      },
    },
  };
  next.trades[session.id] = session;
  appendLog(next, {
    action: "trade_begin",
    actorId: initiatorId,
    sessionId: session.id,
    reason: "trade_session_created",
    success: true,
  });
  return { ok: true, state: next, value: session };
}

function unconfirmBoth(session: HarthmerePlayerTradeSession) {
  for (const participant of Object.values(session.participants)) {
    participant.confirmed = false;
    participant.lockedAt = undefined;
    participant.offeredItems = participant.offeredItems.map((item) => ({
      ...item,
      lockedInTrade: false,
    }));
  }
  session.status = "open";
}

export function updateHarthmereTradeOffer(
  state: HarthmereTradeAuctionState,
  sessionId: string,
  playerId: string,
  patch: {
    addItem?: HarthmereTradeableItem;
    removeItemInstanceId?: string;
    offeredCurrency?: Record<string, number>;
  },
): HarthmereTradeAuctionResult<HarthmerePlayerTradeSession> {
  const next = clone(state);
  const session = next.trades[sessionId];
  const participant = session?.participants[playerId];
  if (!session || !participant || session.status === "committed") {
    appendLog(next, {
      action: "trade_offer_change",
      actorId: playerId,
      sessionId,
      reason: "invalid_or_committed_session",
      success: false,
    });
    return { ok: false, state: next, error: "Trade session is not editable." };
  }
  if (patch.addItem) {
    const validation = isHarthmereTradeableItem(patch.addItem);
    if (!validation.ok) {
      appendLog(next, {
        action: "trade_offer_add_item",
        actorId: playerId,
        sessionId,
        itemId: patch.addItem.itemId,
        reason: validation.reason,
        success: false,
      });
      return { ok: false, state: next, error: validation.reason };
    }
    if (patch.addItem.ownerId !== playerId) {
      return { ok: false, state: next, error: "Only the item owner can offer it." };
    }
    participant.offeredItems.push({ ...patch.addItem, lockedInTrade: false });
  }
  if (patch.removeItemInstanceId) {
    participant.offeredItems = participant.offeredItems.filter(
      (item) => item.instanceId !== patch.removeItemInstanceId,
    );
  }
  if (patch.offeredCurrency) {
    participant.offeredCurrency = Object.fromEntries(
      Object.entries(patch.offeredCurrency).map(([currency, amount]) => [
        currency,
        clampCurrency(amount),
      ]),
    );
  }
  unconfirmBoth(session); // changing trade contents unconfirms both sides.
  session.updatedAt = now();
  appendLog(next, {
    action: "trade_offer_change",
    actorId: playerId,
    sessionId,
    reason: "trade_contents_changed_unconfirmed_both_players",
    success: true,
  });
  return { ok: true, state: next, value: session };
}

export function confirmHarthmerePlayerTrade(
  state: HarthmereTradeAuctionState,
  sessionId: string,
  playerId: string,
): HarthmereTradeAuctionResult<HarthmerePlayerTradeSession> {
  const next = clone(state);
  const session = next.trades[sessionId];
  const participant = session?.participants[playerId];
  if (!session || !participant || session.status === "committed") {
    return { ok: false, state: next, error: "Trade session cannot be confirmed." };
  }
  participant.confirmed = true;
  participant.lockedAt = now();
  participant.offeredItems = participant.offeredItems.map((item) => ({
    ...item,
    lockedInTrade: true,
  }));
  if (Object.values(session.participants).every((p) => p.confirmed)) {
    session.status = "locked";
  }
  appendLog(next, {
    action: "trade_confirm",
    actorId: playerId,
    sessionId,
    reason: "player_confirmed_trade_and_locked_items",
    success: true,
  });
  return { ok: true, state: next, value: session };
}

function validateCurrency(player: HarthmereTradingPlayerState, currency: Record<string, number>) {
  for (const [name, amount] of Object.entries(currency)) {
    if (clampCurrency(player.wallet[name]) < clampCurrency(amount)) {
      return `${player.playerId} lacks ${amount} ${name}.`;
    }
  }
  return undefined;
}

function removeOwnedItem(
  player: HarthmereTradingPlayerState,
  instanceId: string,
  expectedOwner: string,
) {
  const idx = player.backpack.findIndex(
    (item) => item.instanceId === instanceId && item.ownerId === expectedOwner,
  );
  if (idx < 0) {
    return undefined;
  }
  const [item] = player.backpack.splice(idx, 1);
  return item;
}

export function commitHarthmerePlayerTrade(
  state: HarthmereTradeAuctionState,
  sessionId: string,
  players: Record<string, HarthmereTradingPlayerState>,
): HarthmereTradeAuctionResult<Record<string, HarthmereTradingPlayerState>> {
  const next = clone(state);
  const nextPlayers = clone(players);
  const session = next.trades[sessionId];
  if (!session || session.status !== "locked") {
    return { ok: false, state: next, error: "Trade requires both players to confirm first." };
  }
  const participants = Object.values(session.participants);
  if (participants.some((p) => p.disconnected)) {
    return { ok: false, state: next, error: "Disconnected trades must be cancelled safely." };
  }
  for (const participant of participants) {
    const player = nextPlayers[participant.playerId];
    if (!player) {
      return { ok: false, state: next, error: "Missing player inventory." };
    }
    const currencyError = validateCurrency(player, participant.offeredCurrency);
    if (currencyError) {
      return { ok: false, state: next, error: currencyError };
    }
    for (const item of participant.offeredItems) {
      const owned = player.backpack.find((candidate) => candidate.instanceId === item.instanceId);
      const validation = isHarthmereTradeableItem({ ...owned, lockedInTrade: false } as HarthmereTradeableItem);
      if (!owned || !validation.ok || owned.ownerId !== participant.playerId) {
        return {
          ok: false,
          state: next,
          error: `Invalid trade item ${item.instanceId}: ${validation.reason}`,
        };
      }
    }
  }

  const [a, b] = participants;
  const pa = nextPlayers[a.playerId];
  const pb = nextPlayers[b.playerId];
  for (const [currency, amount] of Object.entries(a.offeredCurrency)) {
    pa.wallet[currency] = clampCurrency(pa.wallet[currency]) - clampCurrency(amount);
    pb.wallet[currency] = clampCurrency(pb.wallet[currency]) + clampCurrency(amount);
  }
  for (const [currency, amount] of Object.entries(b.offeredCurrency)) {
    pb.wallet[currency] = clampCurrency(pb.wallet[currency]) - clampCurrency(amount);
    pa.wallet[currency] = clampCurrency(pa.wallet[currency]) + clampCurrency(amount);
  }
  for (const item of a.offeredItems) {
    const moved = removeOwnedItem(pa, item.instanceId, a.playerId);
    if (moved) {
      pb.backpack.push({ ...moved, ownerId: b.playerId, lockedInTrade: false });
    }
  }
  for (const item of b.offeredItems) {
    const moved = removeOwnedItem(pb, item.instanceId, b.playerId);
    if (moved) {
      pa.backpack.push({ ...moved, ownerId: a.playerId, lockedInTrade: false });
    }
  }
  session.status = "committed";
  session.committedAt = now();
  appendLog(next, {
    action: "trade_commit",
    sessionId,
    reason: "atomic_currency_and_item_transfer_complete",
    success: true,
  });
  return { ok: true, state: next, value: nextPlayers };
}

export function cancelHarthmereTradeForDisconnect(
  state: HarthmereTradeAuctionState,
  sessionId: string,
  playerId: string,
): HarthmereTradeAuctionResult<HarthmerePlayerTradeSession> {
  const next = clone(state);
  const session = next.trades[sessionId];
  if (!session) {
    return { ok: false, state: next, error: "Trade session not found." };
  }
  if (session.participants[playerId]) {
    session.participants[playerId].disconnected = true;
  }
  session.status = "cancelled";
  session.cancelReason = "disconnect";
  for (const participant of Object.values(session.participants)) {
    participant.confirmed = false;
    participant.lockedAt = undefined;
    participant.offeredItems = participant.offeredItems.map((item) => ({
      ...item,
      lockedInTrade: false,
    }));
  }
  appendLog(next, {
    action: "trade_cancel_disconnect",
    actorId: playerId,
    sessionId,
    reason: "disconnect_safely_cancelled_and_unlocked_items",
    success: true,
  });
  return { ok: true, state: next, value: session };
}

function markTransaction(
  state: HarthmereTradeAuctionState,
  transactionId: string,
): string | undefined {
  if (state.transactionIds[transactionId]) {
    return "Duplicate transaction request rejected.";
  }
  state.transactionIds[transactionId] = now();
  return undefined;
}

export function createHarthmereAuctionListing(
  state: HarthmereTradeAuctionState,
  seller: HarthmereTradingPlayerState,
  input: {
    transactionId: string;
    itemInstanceId: string;
    priceGold: number;
    durationMs?: number;
  },
): HarthmereTradeAuctionResult<{
  listing: HarthmereAuctionListing;
  seller: HarthmereTradingPlayerState;
}> {
  const next = clone(state);
  const nextSeller = clone(seller);
  const duplicate = markTransaction(next, input.transactionId);
  if (duplicate) {
    return { ok: false, state: next, error: duplicate };
  }
  const item = nextSeller.backpack.find((candidate) => candidate.instanceId === input.itemInstanceId);
  const validation = isHarthmereTradeableItem(item);
  if (!validation.ok) {
    appendLog(next, {
      action: "auction_list",
      actorId: seller.playerId,
      itemId: item?.itemId,
      reason: validation.reason,
      success: false,
    });
    return { ok: false, state: next, error: validation.reason };
  }
  const priceGold = clampCurrency(input.priceGold);
  if (priceGold <= 0) {
    return { ok: false, state: next, error: "Auction price must be positive." };
  }
  const listingFeeGold = Math.max(1, Math.ceil(priceGold * HARTHMERE_AUCTION_LISTING_FEE_RATE));
  if (clampCurrency(nextSeller.wallet.gold) < listingFeeGold) {
    return { ok: false, state: next, error: "Seller cannot pay listing fee." };
  }
  const removed = removeOwnedItem(nextSeller, item!.instanceId, seller.playerId);
  if (!removed) {
    return { ok: false, state: next, error: "Unable to escrow auction item." };
  }
  nextSeller.wallet.gold = clampCurrency(nextSeller.wallet.gold) - listingFeeGold;
  const listingId = id("auction");
  const escrowId = id("escrow");
  next.escrow[escrowId] = {
    id: escrowId,
    source: "auction",
    ownerId: seller.playerId,
    item: { ...removed, escrowId },
    createdAt: now(),
    listingId,
    transactionId: input.transactionId,
  };
  const listing: HarthmereAuctionListing = {
    id: listingId,
    transactionId: input.transactionId,
    sellerId: seller.playerId,
    itemId: removed.itemId,
    itemInstanceId: removed.instanceId,
    quantity: removed.quantity,
    priceGold,
    listingFeeGold,
    saleTaxRate: HARTHMERE_AUCTION_SALE_TAX_RATE,
    status: "active",
    escrowId,
    createdAt: now(),
    expiresAt: now() + (input.durationMs ?? HARTHMERE_AUCTION_DEFAULT_DURATION_MS),
  };
  next.auctions[listingId] = listing;
  appendMarketHistory(next, {
    event: "listed",
    itemId: listing.itemId,
    listingId,
    sellerId: seller.playerId,
    priceGold,
    feeGold: listingFeeGold,
    quantity: listing.quantity,
  });
  appendMarketHistory(next, {
    event: "listing_fee_sink",
    itemId: listing.itemId,
    listingId,
    sellerId: seller.playerId,
    feeGold: listingFeeGold,
  });
  appendLog(next, {
    action: "auction_list",
    actorId: seller.playerId,
    itemId: listing.itemId,
    listingId,
    amountGold: listingFeeGold,
    reason: "listing_removed_item_to_escrow_and_recorded_fee_sink",
    success: true,
  });
  return { ok: true, state: next, value: { listing, seller: nextSeller } };
}

function ensureMailbox(player: HarthmereTradingPlayerState) {
  player.mailbox = Array.isArray(player.mailbox) ? player.mailbox : [];
  return player.mailbox;
}

export function settleHarthmereAuctionPurchase(
  state: HarthmereTradeAuctionState,
  players: Record<string, HarthmereTradingPlayerState>,
  listingId: string,
  buyerId: string,
): HarthmereTradeAuctionResult<Record<string, HarthmereTradingPlayerState>> {
  const next = clone(state);
  const nextPlayers = clone(players);
  const listing = next.auctions[listingId];
  const buyer = nextPlayers[buyerId];
  const seller = listing ? nextPlayers[listing.sellerId] : undefined;
  if (!listing || listing.status !== "active") {
    return { ok: false, state: next, error: "Auction listing is not active." };
  }
  if (listing.expiresAt <= now()) {
    return { ok: false, state: next, error: "Auction listing has expired." };
  }
  if (!buyer || !seller || buyerId === listing.sellerId) {
    return { ok: false, state: next, error: "Invalid buyer or seller." };
  }
  if (clampCurrency(buyer.wallet.gold) < listing.priceGold) {
    return { ok: false, state: next, error: "Buyer lacks enough gold." };
  }
  const escrow = next.escrow[listing.escrowId];
  if (!escrow || escrow.item.instanceId !== listing.itemInstanceId) {
    return { ok: false, state: next, error: "Auction escrow item is missing." };
  }
  const taxGold = Math.max(1, Math.ceil(listing.priceGold * listing.saleTaxRate));
  const sellerPayout = Math.max(0, listing.priceGold - taxGold);
  buyer.wallet.gold = clampCurrency(buyer.wallet.gold) - listing.priceGold;
  seller.wallet.gold = clampCurrency(seller.wallet.gold) + sellerPayout;
  ensureMailbox(buyer).push({
    id: id("mail"),
    fromPlayerId: "harthmere_auction_house",
    toPlayerId: buyerId,
    subject: `Auction won: ${listing.itemId}`,
    body: "Your auction purchase is attached. The item was held in escrow until payment settled.",
    createdAt: now(),
    attachments: [{ ...escrow.item, ownerId: buyerId, escrowId: undefined }],
    currency: {},
    source: "auction_purchase",
  });
  delete next.escrow[listing.escrowId];
  listing.status = "sold";
  listing.buyerId = buyerId;
  listing.soldAt = now();
  appendMarketHistory(next, {
    event: "sold",
    itemId: listing.itemId,
    listingId,
    sellerId: listing.sellerId,
    buyerId,
    priceGold: listing.priceGold,
    taxGold,
    quantity: listing.quantity,
  });
  appendMarketHistory(next, {
    event: "auction_tax_sink",
    itemId: listing.itemId,
    listingId,
    sellerId: listing.sellerId,
    buyerId,
    taxGold,
  });
  appendLog(next, {
    action: "auction_buy",
    actorId: buyerId,
    itemId: listing.itemId,
    listingId,
    amountGold: listing.priceGold,
    reason: "sale_paid_seller_minus_tax_and_mailed_item_to_buyer",
    success: true,
  });
  return { ok: true, state: next, value: nextPlayers };
}

export function cancelHarthmereAuctionListing(
  state: HarthmereTradeAuctionState,
  players: Record<string, HarthmereTradingPlayerState>,
  listingId: string,
  sellerId: string,
): HarthmereTradeAuctionResult<Record<string, HarthmereTradingPlayerState>> {
  const next = clone(state);
  const nextPlayers = clone(players);
  const listing = next.auctions[listingId];
  const seller = nextPlayers[sellerId];
  if (!listing || listing.status !== "active" || listing.sellerId !== sellerId || !seller) {
    return { ok: false, state: next, error: "Only the seller can cancel an active listing." };
  }
  const escrow = next.escrow[listing.escrowId];
  if (!escrow) {
    return { ok: false, state: next, error: "Auction escrow item is missing." };
  }
  ensureMailbox(seller).push({
    id: id("mail"),
    fromPlayerId: "harthmere_auction_house",
    toPlayerId: sellerId,
    subject: `Auction cancelled: ${listing.itemId}`,
    body: "Your cancelled auction item is attached. Listing fees are not refunded.",
    createdAt: now(),
    attachments: [{ ...escrow.item, ownerId: sellerId, escrowId: undefined }],
    currency: {},
    source: "auction_return",
  });
  delete next.escrow[listing.escrowId];
  listing.status = "cancelled";
  listing.cancelledAt = now();
  appendMarketHistory(next, {
    event: "cancelled",
    itemId: listing.itemId,
    listingId,
    sellerId,
    priceGold: listing.priceGold,
  });
  appendLog(next, {
    action: "auction_cancel",
    actorId: sellerId,
    itemId: listing.itemId,
    listingId,
    reason: "cancelled_listing_returned_item_by_mail",
    success: true,
  });
  return { ok: true, state: next, value: nextPlayers };
}

export function expireHarthmereAuctionListings(
  state: HarthmereTradeAuctionState,
  players: Record<string, HarthmereTradingPlayerState>,
  at = now(),
): HarthmereTradeAuctionResult<Record<string, HarthmereTradingPlayerState>> {
  const next = clone(state);
  const nextPlayers = clone(players);
  for (const listing of Object.values(next.auctions)) {
    if (listing.status !== "active" || listing.expiresAt > at) {
      continue;
    }
    const seller = nextPlayers[listing.sellerId];
    const escrow = next.escrow[listing.escrowId];
    if (!seller || !escrow) {
      appendLog(next, {
        action: "auction_expire_recovery_needed",
        actorId: listing.sellerId,
        itemId: listing.itemId,
        listingId: listing.id,
        reason: "seller_or_escrow_missing_recovery_required",
        success: false,
      });
      continue;
    }
    ensureMailbox(seller).push({
      id: id("mail"),
      fromPlayerId: "harthmere_auction_house",
      toPlayerId: listing.sellerId,
      subject: `Auction expired: ${listing.itemId}`,
      body: "Your expired auction item is attached.",
      createdAt: at,
      attachments: [{ ...escrow.item, ownerId: listing.sellerId, escrowId: undefined }],
      currency: {},
      source: "auction_return",
    });
    delete next.escrow[listing.escrowId];
    listing.status = "expired";
    appendMarketHistory(next, {
      event: "expired",
      itemId: listing.itemId,
      listingId: listing.id,
      sellerId: listing.sellerId,
      priceGold: listing.priceGold,
    });
  }
  return { ok: true, state: next, value: nextPlayers };
}

export function installHarthmereTradeAuctionDebugBridge() {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereTradeAuction?: unknown;
  };
  win.__harthmereTradeAuction = {
    version: HARTHMERE_TRADE_AUCTION_SYSTEM_VERSION,
    readState: readHarthmereTradeAuctionState,
    writeState: writeHarthmereTradeAuctionState,
    reset: () => writeHarthmereTradeAuctionState(createHarthmereTradeAuctionState()),
    beginTrade: beginHarthmerePlayerTrade,
    updateTradeOffer: updateHarthmereTradeOffer,
    confirmTrade: confirmHarthmerePlayerTrade,
    commitTrade: commitHarthmerePlayerTrade,
    cancelTradeForDisconnect: cancelHarthmereTradeForDisconnect,
    createAuctionListing: createHarthmereAuctionListing,
    settleAuctionPurchase: settleHarthmereAuctionPurchase,
    cancelAuctionListing: cancelHarthmereAuctionListing,
    expireAuctionListings: expireHarthmereAuctionListings,
  };
}

export const HarthmereTradeAuctionMenuPanel: React.FunctionComponent<{}> = () => {
  const [state, setState] = useState<HarthmereTradeAuctionState>(() =>
    readHarthmereTradeAuctionState(),
  );
  useEffect(() => {
    installHarthmereTradeAuctionDebugBridge();
    const onChange = () => setState(readHarthmereTradeAuctionState());
    window.addEventListener(HARTHMERE_TRADE_AUCTION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(HARTHMERE_TRADE_AUCTION_CHANGED_EVENT, onChange);
  }, []);
  const summary = useMemo(() => {
    const activeAuctions = Object.values(state.auctions).filter((listing) => listing.status === "active").length;
    const activeTrades = Object.values(state.trades).filter((trade) => trade.status === "open" || trade.status === "locked").length;
    const escrowedItems = Object.keys(state.escrow).length;
    return { activeAuctions, activeTrades, escrowedItems };
  }, [state]);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
      <div className="mb-2 text-sm font-bold text-white">Trade & Auction House</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-black/30 p-2">Trades: {summary.activeTrades}</div>
        <div className="rounded-lg bg-black/30 p-2">Auctions: {summary.activeAuctions}</div>
        <div className="rounded-lg bg-black/30 p-2">Escrow: {summary.escrowedItems}</div>
      </div>
      <div className="mt-2 text-[11px] text-white/60">
        Local-dev trade requires both players to confirm; auction items sit in escrow until sold, cancelled, or expired.
      </div>
    </div>
  );
};

installHarthmereTradeAuctionDebugBridge();
