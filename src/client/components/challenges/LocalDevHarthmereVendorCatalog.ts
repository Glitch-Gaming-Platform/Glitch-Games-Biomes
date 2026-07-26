import { harthmereLocalStorage } from "@/client/util/storage";
// ---------------------------------------------------------------------------
// Vendor catalog: SINGLE SOURCE OF TRUTH re-export.
//
// The 17 Harthmere vendors were previously defined here AND, byte-for-byte
// identically, in `shared/harthmere/harthmere_vendor_catalog.ts` (the copy the
// server economy uses). That was a classic dual-source-of-truth: editing one
// list silently diverged from the other. We now keep the shared file as the
// only definition and re-export it here, aliasing the legacy client-side type
// names to the shared types so every existing importer of this module keeps
// compiling unchanged.
// ---------------------------------------------------------------------------
import {
  // The one true vendor table, imported under a local alias so we can re-export
  // it below under the historical `HARTHMERE_VENDOR_CATALOG` name.
  HARTHMERE_VENDOR_CATALOG as SHARED_HARTHMERE_VENDOR_CATALOG,
  // Shared vendor types — the client used to declare parallel `*Unified*`
  // versions of these; they are now thin aliases (see below).
  type HarthmereVendorCategory,
  type HarthmereVendorProfile,
  type HarthmereVendorStockLine,
} from "@/shared/harthmere/harthmere_vendor_catalog";

// Backwards-compatible type aliases. Historically this module exported its own
// `HarthmereUnifiedVendor*` types; downstream files still import those names, so
// we keep them as aliases pointing at the shared types (identical field shape;
// the shared profile additionally carries an optional `businessOutpostId`).
export type HarthmereUnifiedVendorCategory = HarthmereVendorCategory;
export type HarthmereUnifiedVendorStockLine = HarthmereVendorStockLine;
export type HarthmereUnifiedVendorProfile = HarthmereVendorProfile;

// Re-export the shared catalog under the name this module has always exposed.
// Consumers (economy sim, NPC behaviour, inventory) are unaffected.
export const HARTHMERE_VENDOR_CATALOG: Record<number, HarthmereVendorProfile> =
  SHARED_HARTHMERE_VENDOR_CATALOG;

export const HARTHMERE_VENDOR_STOCK = HARTHMERE_VENDOR_CATALOG;
export const HARTHMERE_VENDOR_ECONOMY_PROFILES = HARTHMERE_VENDOR_CATALOG;
export const HARTHMERE_BLACK_MARKET_OFFSETS = new Set(
  Object.values(HARTHMERE_VENDOR_CATALOG)
    .filter((profile) => profile.buysStolenGoods || profile.vendorType === "fence")
    .map((profile) => profile.offset),
);

export function getHarthmereVendorProfile(offset: number) {
  return HARTHMERE_VENDOR_CATALOG[offset];
}

export function isHarthmereVendorOffset(offset: number) {
  return Boolean(HARTHMERE_VENDOR_CATALOG[offset]);
}


export const HARTHMERE_VENDOR_STOCK_STATE_KEY =
  "biomes.localDev.harthmere.vendorStockState";

interface HarthmereVendorRuntimeState {
  version: 1;
  vendorStock: Record<string, Record<string, number>>;
  vendorGoldSupply: Record<string, number>;
  lastRestockedAt: Record<string, number>;
  recentTransactions: Array<{
    id: string;
    at: number;
    system: "vendor";
    actorId: "local-player";
    vendorId: string;
    action: string;
    itemId?: string;
    quantity?: number;
    currency?: "gold";
    amount?: number;
    success: boolean;
    reason: string;
  }>;
}

function vendorBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function vendorRuntimeLog(
  state: HarthmereVendorRuntimeState,
  vendorId: string,
  action: string,
  reason: string,
  success: boolean,
  itemId?: string,
  quantity?: number,
  amount?: number,
): HarthmereVendorRuntimeState {
  return {
    ...state,
    recentTransactions: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        system: "vendor",
        actorId: "local-player",
        vendorId,
        action,
        itemId,
        quantity,
        currency: typeof amount === "number" ? "gold" : undefined,
        amount,
        success,
        reason,
      } as HarthmereVendorRuntimeState["recentTransactions"][number],
      ...state.recentTransactions,
    ].slice(0, 40),
  };
}

function freshVendorRuntimeState(nowAt = Date.now()): HarthmereVendorRuntimeState {
  const vendorStock: Record<string, Record<string, number>> = {};
  const vendorGoldSupply: Record<string, number> = {};
  const lastRestockedAt: Record<string, number> = {};
  for (const vendor of Object.values(HARTHMERE_VENDOR_CATALOG)) {
    vendorStock[vendor.vendorId] = Object.fromEntries(
      vendor.stocks.map((stock) => [stock.itemId, Math.max(0, Math.round(stock.quantity))]),
    );
    vendorGoldSupply[vendor.vendorId] = Math.max(0, Math.round(vendor.goldSupply));
    lastRestockedAt[vendor.vendorId] = nowAt;
  }
  return {
    version: 1,
    vendorStock,
    vendorGoldSupply,
    lastRestockedAt,
    recentTransactions: [],
  };
}

function normalizeVendorRuntimeState(raw?: Partial<HarthmereVendorRuntimeState>) {
  const fallback = freshVendorRuntimeState();
  const out: HarthmereVendorRuntimeState = {
    version: 1,
    vendorStock: {},
    vendorGoldSupply: {},
    lastRestockedAt: {},
    recentTransactions: (raw?.recentTransactions ?? []).slice(0, 40),
  };
  for (const vendor of Object.values(HARTHMERE_VENDOR_CATALOG)) {
    const rawStock = raw?.vendorStock?.[vendor.vendorId] ?? {};
    out.vendorStock[vendor.vendorId] = Object.fromEntries(
      vendor.stocks.map((stock) => [
        stock.itemId,
        Math.max(0, Math.round(Number(rawStock[stock.itemId] ?? stock.quantity))),
      ]),
    );
    out.vendorGoldSupply[vendor.vendorId] = Math.max(
      0,
      Math.round(Number(raw?.vendorGoldSupply?.[vendor.vendorId] ?? vendor.goldSupply)),
    );
    out.lastRestockedAt[vendor.vendorId] = Math.max(
      0,
      Math.round(Number(raw?.lastRestockedAt?.[vendor.vendorId] ?? fallback.lastRestockedAt[vendor.vendorId])),
    );
  }
  return restockHarthmereVendorRuntimeState(out);
}

function restockHarthmereVendorRuntimeState(
  state: HarthmereVendorRuntimeState,
  nowAt = Date.now(),
) {
  let next = state;
  for (const vendor of Object.values(HARTHMERE_VENDOR_CATALOG)) {
    const last = Number(next.lastRestockedAt[vendor.vendorId] ?? 0);
    const restockMs = Math.max(1, vendor.restockHours) * 60 * 60 * 1000;
    if (nowAt - last < restockMs) {
      continue;
    }
    next = {
      ...next,
      vendorStock: {
        ...next.vendorStock,
        [vendor.vendorId]: Object.fromEntries(
          vendor.stocks.map((stock) => [stock.itemId, Math.max(0, Math.round(stock.quantity))]),
        ),
      },
      vendorGoldSupply: {
        ...next.vendorGoldSupply,
        [vendor.vendorId]: Math.max(0, Math.round(vendor.goldSupply)),
      },
      lastRestockedAt: {
        ...next.lastRestockedAt,
        [vendor.vendorId]: nowAt,
      },
    };
  }
  return next;
}

export function readHarthmereVendorRuntimeState() {
  if (!vendorBrowser()) {
    return freshVendorRuntimeState();
  }
  try {
    const raw = harthmereLocalStorage.getItem(HARTHMERE_VENDOR_STOCK_STATE_KEY);
    if (!raw) {
      return freshVendorRuntimeState();
    }
    return normalizeVendorRuntimeState(JSON.parse(raw) as Partial<HarthmereVendorRuntimeState>);
  } catch {
    return freshVendorRuntimeState();
  }
}

export function writeHarthmereVendorRuntimeState(state: HarthmereVendorRuntimeState) {
  if (!vendorBrowser()) {
    return;
  }
  harthmereLocalStorage.setItem(
    HARTHMERE_VENDOR_STOCK_STATE_KEY,
    JSON.stringify(normalizeVendorRuntimeState(state)),
  );
}

export function resetHarthmereVendorRuntimeState() {
  writeHarthmereVendorRuntimeState(freshVendorRuntimeState());
}

export function getHarthmereCurrentVendorStockLine(offset: number, itemId: string) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  const line = vendor?.stocks.find((stock) => stock.itemId === itemId);
  if (!vendor || !line) {
    return undefined;
  }
  // Catalogue quantities are bundle sizes, not a one-shot client-owned stock
  // counter. The server owns real availability and rejects unavailable buys
  // atomically. Returning the catalogue line also repairs old browser saves
  // where a failed/local-only purchase had incorrectly reduced the runtime
  // quantity to zero and made the listing disappear forever.
  return { ...line };
}

export function decrementHarthmereVendorStock(
  offset: number,
  itemId: string,
  quantity: number,
) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  if (!vendor) {
    return false;
  }
  const state = readHarthmereVendorRuntimeState();
  const current = Math.max(0, Math.round(state.vendorStock[vendor.vendorId]?.[itemId] ?? 0));
  const move = Math.max(1, Math.round(quantity));
  if (current < move) {
    writeHarthmereVendorRuntimeState(
      vendorRuntimeLog(state, vendor.vendorId, "Stock Depleted", "Vendor stock was too low for the requested purchase.", false, itemId, move),
    );
    return false;
  }
  writeHarthmereVendorRuntimeState(
    vendorRuntimeLog(
      {
        ...state,
        vendorStock: {
          ...state.vendorStock,
          [vendor.vendorId]: {
            ...(state.vendorStock[vendor.vendorId] ?? {}),
            [itemId]: current - move,
          },
        },
      },
      vendor.vendorId,
      "Stock Decremented",
      "Player purchase removed item quantity from persistent vendor stock.",
      true,
      itemId,
      move,
    ),
  );
  return true;
}

export function restoreHarthmereVendorStock(
  offset: number,
  itemId: string,
  quantity: number,
) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  const catalogLine = vendor?.stocks.find((stock) => stock.itemId === itemId);
  if (!vendor || !catalogLine) {
    return;
  }
  const state = readHarthmereVendorRuntimeState();
  const current = Math.max(0, Math.round(state.vendorStock[vendor.vendorId]?.[itemId] ?? 0));
  const nextQuantity = Math.min(catalogLine.quantity, current + Math.max(1, Math.round(quantity)));
  writeHarthmereVendorRuntimeState(
    vendorRuntimeLog(
      {
        ...state,
        vendorStock: {
          ...state.vendorStock,
          [vendor.vendorId]: {
            ...(state.vendorStock[vendor.vendorId] ?? {}),
            [itemId]: nextQuantity,
          },
        },
      },
      vendor.vendorId,
      "Stock Restored",
      "Failed purchase restored vendor stock atomically.",
      true,
      itemId,
      quantity,
    ),
  );
}

export function receiveHarthmereVendorStock(
  offset: number,
  itemId: string,
  quantity: number,
) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  if (!vendor) {
    return;
  }
  const state = readHarthmereVendorRuntimeState();
  const current = Math.max(0, Math.round(state.vendorStock[vendor.vendorId]?.[itemId] ?? 0));
  writeHarthmereVendorRuntimeState(
    vendorRuntimeLog(
      {
        ...state,
        vendorStock: {
          ...state.vendorStock,
          [vendor.vendorId]: {
            ...(state.vendorStock[vendor.vendorId] ?? {}),
            [itemId]: current + Math.max(1, Math.round(quantity)),
          },
        },
      },
      vendor.vendorId,
      "Stock Received",
      "Player sale added quantity to the vendor runtime stock ledger.",
      true,
      itemId,
      quantity,
    ),
  );
}

export function getHarthmereVendorGoldSupply(offset: number) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  if (!vendor) {
    return 0;
  }
  const state = readHarthmereVendorRuntimeState();
  return Math.max(0, Math.round(state.vendorGoldSupply[vendor.vendorId] ?? vendor.goldSupply));
}

export function spendHarthmereVendorGold(
  offset: number,
  amount: number,
  reason = "Vendor paid player for sold goods.",
) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  if (!vendor) {
    return false;
  }
  const state = readHarthmereVendorRuntimeState();
  const spend = Math.max(0, Math.round(amount));
  const current = Math.max(0, Math.round(state.vendorGoldSupply[vendor.vendorId] ?? vendor.goldSupply));
  if (current < spend) {
    writeHarthmereVendorRuntimeState(
      vendorRuntimeLog(state, vendor.vendorId, "Vendor Gold Too Low", reason, false, undefined, undefined, -spend),
    );
    return false;
  }
  writeHarthmereVendorRuntimeState(
    vendorRuntimeLog(
      {
        ...state,
        vendorGoldSupply: {
          ...state.vendorGoldSupply,
          [vendor.vendorId]: current - spend,
        },
      },
      vendor.vendorId,
      "Vendor Gold Spent",
      reason,
      true,
      undefined,
      undefined,
      -spend,
    ),
  );
  return true;
}

export function receiveHarthmereVendorGold(offset: number, amount: number) {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  if (!vendor) {
    return;
  }
  const state = readHarthmereVendorRuntimeState();
  const current = Math.max(0, Math.round(state.vendorGoldSupply[vendor.vendorId] ?? vendor.goldSupply));
  const nextGold = current + Math.max(0, Math.round(amount));
  writeHarthmereVendorRuntimeState(
    vendorRuntimeLog(
      {
        ...state,
        vendorGoldSupply: {
          ...state.vendorGoldSupply,
          [vendor.vendorId]: nextGold,
        },
      },
      vendor.vendorId,
      "Vendor Gold Received",
      "Player purchase added gold to vendor runtime supply.",
      true,
      undefined,
      undefined,
      amount,
    ),
  );
}
