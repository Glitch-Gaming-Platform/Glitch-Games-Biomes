export type HarthmereUnifiedVendorCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "food"
  | "drink"
  | "crafting_material"
  | "quest_item"
  | "currency"
  | "key"
  | "book"
  | "spell_scroll"
  | "tool"
  | "trade_good"
  | "junk"
  | "trophy"
  | "cosmetic"
  | "housing"
  | "container"
  | "event_item"
  | "service"
  | "quest"
  | "luxury"
  | "black_market";

export interface HarthmereUnifiedVendorStockLine {
  itemId: string;
  quantity: number;
  price: number;
}

export interface HarthmereUnifiedVendorProfile {
  offset: number;
  vendorId: string;
  vendorName: string;
  name: string;
  vendorType: string;
  region: "harthmere";
  stocks: HarthmereUnifiedVendorStockLine[];
  sells: Array<{ itemId: string; quantity: number }>;
  buys: HarthmereUnifiedVendorCategory[];
  buysCategories: HarthmereUnifiedVendorCategory[];
  baseSellModifier: number;
  baseBuyModifier: number;
  goldSupply: number;
  restockHours: number;
  buysStolenGoods: boolean;
  refusesStolenGoods: boolean;
  lawfulService: boolean;
  intentionalNonShop?: boolean;
}

const vendor = (profile: Omit<HarthmereUnifiedVendorProfile, "sells" | "buysCategories" | "refusesStolenGoods" | "lawfulService"> & { refusesStolenGoods?: boolean; lawfulService?: boolean; }): HarthmereUnifiedVendorProfile => {
  const refusesStolenGoods = profile.refusesStolenGoods ?? !profile.buysStolenGoods;
  return {
    ...profile,
    sells: profile.stocks.map((stock) => ({ itemId: stock.itemId, quantity: stock.quantity })),
    buysCategories: profile.buys,
    refusesStolenGoods,
    lawfulService: profile.lawfulService ?? refusesStolenGoods,
  };
};

export const HARTHMERE_VENDOR_CATALOG: Record<number, HarthmereUnifiedVendorProfile> = {
  5: vendor({
    offset: 5,
    vendorId: "dawn_loaf_bakery",
    vendorName: "Dawn Loaf Bakery",
    name: "Dawn Loaf Bakery",
    vendorType: "food_vendor",
    region: "harthmere",
    stocks: [
      { itemId: "apple_tart", quantity: 2, price: 8 },
      { itemId: "road_ration", quantity: 4, price: 10 },
      { itemId: "fresh_egg", quantity: 6, price: 4 },
      { itemId: "field_wheat", quantity: 8, price: 3 },
    ],
    buys: ["food", "crafting_material", "trade_good", "junk"],
    baseSellModifier: 1.16,
    baseBuyModifier: 0.58,
    goldSupply: 350,
    restockHours: 8,
    buysStolenGoods: false,
  }),
  6: vendor({
    offset: 6,
    vendorId: "harthmere_bank_exchange",
    vendorName: "Harthmere Bank Exchange",
    name: "Harthmere Bank Exchange",
    vendorType: "banker",
    region: "harthmere",
    stocks: [
      { itemId: "iron_key_blank", quantity: 1, price: 15 },
      { itemId: "repair_voucher", quantity: 1, price: 22 },
    ],
    buys: ["trade_good", "junk", "currency", "event_item", "crafting_material", "luxury"],
    baseSellModifier: 1.2,
    baseBuyModifier: 0.5,
    goldSupply: 2_000,
    restockHours: 24,
    buysStolenGoods: false,
  }),
  7: vendor({
    offset: 7,
    vendorId: "weapons_counter",
    vendorName: "Weapons Counter",
    name: "Weapons Counter",
    vendorType: "weapon_vendor",
    region: "harthmere",
    stocks: [
      { itemId: "training_dagger", quantity: 1, price: 24 },
      { itemId: "woodsman_axe", quantity: 1, price: 70 },
      { itemId: "iron_longsword", quantity: 1, price: 125 },
      { itemId: "two_handed_sword", quantity: 1, price: 175 },
      { itemId: "wooden_shield", quantity: 1, price: 45 },
      { itemId: "repair_voucher", quantity: 1, price: 20 },
    ],
    buys: ["weapon", "armor", "tool", "crafting_material", "trade_good", "junk"],
    baseSellModifier: 1.22,
    baseBuyModifier: 0.5,
    goldSupply: 1_500,
    restockHours: 24,
    buysStolenGoods: false,
  }),
  8: vendor({
    offset: 8,
    vendorId: "green_mortar_healer",
    vendorName: "Green Mortar Healer",
    name: "Green Mortar Healer",
    vendorType: "healer",
    region: "harthmere",
    stocks: [
      { itemId: "minor_healing_salve", quantity: 3, price: 18 },
      { itemId: "chapel_candle", quantity: 2, price: 12 },
      { itemId: "field_revival_scroll", quantity: 1, price: 90 },
      { itemId: "peacebloom", quantity: 5, price: 6 },
    ],
    buys: ["consumable", "food", "crafting_material", "spell_scroll", "junk", "trade_good"],
    baseSellModifier: 1.18,
    baseBuyModifier: 0.52,
    goldSupply: 650,
    restockHours: 12,
    buysStolenGoods: false,
  }),
  9: vendor({
    offset: 9,
    vendorId: "wyrm_candle_magic_shop",
    vendorName: "Wyrm & Candle Magic Shop",
    name: "Wyrm & Candle Magic Shop",
    vendorType: "magic_vendor",
    region: "harthmere",
    stocks: [
      { itemId: "scroll_of_spark", quantity: 1, price: 45 },
      { itemId: "field_revival_scroll", quantity: 1, price: 110 },
      { itemId: "arcane_extractor", quantity: 1, price: 42 },
      { itemId: "mana_essence", quantity: 3, price: 28 },
    ],
    buys: ["spell_scroll", "book", "crafting_material", "quest_item", "junk", "trade_good", "luxury"],
    baseSellModifier: 1.25,
    baseBuyModifier: 0.5,
    goldSupply: 950,
    restockHours: 18,
    buysStolenGoods: false,
  }),
  11: vendor({
    offset: 11,
    vendorId: "copper_kettle_bar",
    vendorName: "Copper Kettle Bar",
    name: "Copper Kettle Bar",
    vendorType: "innkeeper",
    region: "harthmere",
    stocks: [
      { itemId: "road_ration", quantity: 3, price: 9 },
      { itemId: "apple_tart", quantity: 1, price: 5 },
      { itemId: "copper_kettle_token", quantity: 1, price: 10 },
      { itemId: "river_trout", quantity: 2, price: 9 },
    ],
    buys: ["food", "drink", "crafting_material", "event_item", "junk", "trade_good"],
    baseSellModifier: 1.12,
    baseBuyModifier: 0.45,
    goldSupply: 500,
    restockHours: 8,
    buysStolenGoods: false,
  }),
  29: vendor({
    offset: 29,
    vendorId: "black_anvil_smithy",
    vendorName: "Black Anvil Smithy",
    name: "Black Anvil Smithy",
    vendorType: "blacksmith",
    region: "harthmere",
    stocks: [
      { itemId: "training_dagger", quantity: 1, price: 24 },
      { itemId: "woodsman_axe", quantity: 1, price: 70 },
      { itemId: "iron_longsword", quantity: 1, price: 125 },
      { itemId: "two_handed_sword", quantity: 1, price: 175 },
      { itemId: "wooden_shield", quantity: 1, price: 45 },
      { itemId: "rusty_pickaxe", quantity: 1, price: 28 },
      { itemId: "woodcutters_axe", quantity: 1, price: 28 },
      { itemId: "repair_voucher", quantity: 2, price: 20 },
    ],
    buys: ["weapon", "armor", "tool", "crafting_material", "trade_good", "junk"],
    baseSellModifier: 1.2,
    baseBuyModifier: 0.55,
    goldSupply: 2_000,
    restockHours: 24,
    buysStolenGoods: false,
  }),
  30: vendor({
    offset: 30,
    vendorId: "copper_kettle_inn",
    vendorName: "Copper Kettle Inn",
    name: "Copper Kettle Inn",
    vendorType: "innkeeper",
    region: "harthmere",
    stocks: [
      { itemId: "road_ration", quantity: 3, price: 9 },
      { itemId: "apple_tart", quantity: 2, price: 7 },
      { itemId: "copper_kettle_token", quantity: 1, price: 10 },
      { itemId: "patched_cloak", quantity: 1, price: 38 },
    ],
    buys: ["food", "drink", "cosmetic", "event_item", "trade_good", "junk"],
    baseSellModifier: 1.1,
    baseBuyModifier: 0.5,
    goldSupply: 850,
    restockHours: 8,
    buysStolenGoods: false,
  }),
  31: vendor({
    offset: 31,
    vendorId: "temple_green",
    vendorName: "Temple Green",
    name: "Temple Green",
    vendorType: "temple",
    region: "harthmere",
    stocks: [
      { itemId: "minor_healing_salve", quantity: 1, price: 16 },
      { itemId: "field_revival_scroll", quantity: 1, price: 90 },
      { itemId: "chapel_candle", quantity: 2, price: 10 },
    ],
    buys: ["consumable", "trade_good", "quest_item", "luxury", "junk"],
    baseSellModifier: 1.08,
    baseBuyModifier: 0.5,
    goldSupply: 750,
    restockHours: 12,
    buysStolenGoods: false,
  }),
  33: vendor({
    offset: 33,
    vendorId: "nessa_back_alley_trade",
    vendorName: "Nessa's Back-Alley Trade",
    name: "Nessa's Back-Alley Trade",
    vendorType: "fence",
    region: "harthmere",
    stocks: [
      { itemId: "patched_cloak", quantity: 1, price: 36 },
      { itemId: "scavenger_hook", quantity: 1, price: 22 },
      { itemId: "old_coin", quantity: 1, price: 18 },
    ],
    buys: ["trade_good", "junk", "crafting_material", "trophy", "tool", "black_market"],
    baseSellModifier: 1.35,
    baseBuyModifier: 0.42,
    goldSupply: 420,
    restockHours: 24,
    buysStolenGoods: true,
    refusesStolenGoods: false,
    lawfulService: false,
  }),
  34: vendor({
    offset: 34,
    vendorId: "river_dock_supply",
    vendorName: "River Dock Supply",
    name: "River Dock Supply",
    vendorType: "trade_goods",
    region: "harthmere",
    stocks: [
      { itemId: "road_ration", quantity: 2, price: 7 },
      { itemId: "river_knot_marker", quantity: 1, price: 25 },
      { itemId: "simple_fishing_rod", quantity: 1, price: 24 },
      { itemId: "clay_shovel", quantity: 1, price: 22 },
    ],
    buys: ["trade_good", "crafting_material", "tool", "food", "junk"],
    baseSellModifier: 1.15,
    baseBuyModifier: 0.57,
    goldSupply: 1_200,
    restockHours: 12,
    buysStolenGoods: false,
    refusesStolenGoods: false,
  }),
  43: vendor({
    offset: 43,
    vendorId: "courier_anwen_parcel_counter",
    vendorName: "Courier Anwen's Parcel Counter",
    name: "Courier Anwen's Parcel Counter",
    vendorType: "courier",
    region: "harthmere",
    stocks: [
      { itemId: "road_ration", quantity: 2, price: 8 },
      { itemId: "iron_key_blank", quantity: 1, price: 15 },
      { itemId: "repair_voucher", quantity: 1, price: 21 },
    ],
    buys: ["trade_good", "junk", "event_item", "key"],
    baseSellModifier: 1.18,
    baseBuyModifier: 0.48,
    goldSupply: 550,
    restockHours: 12,
    buysStolenGoods: false,
  }),
  47: vendor({
    offset: 47,
    vendorId: "ysabet_apothecary",
    vendorName: "Ysabet's Apothecary Shelf",
    name: "Ysabet's Apothecary Shelf",
    vendorType: "alchemist",
    region: "harthmere",
    stocks: [
      { itemId: "minor_healing_salve", quantity: 3, price: 18 },
      { itemId: "chapel_candle", quantity: 2, price: 12 },
      { itemId: "field_revival_scroll", quantity: 1, price: 95 },
      { itemId: "herbalist_sickle", quantity: 1, price: 24 },
      { itemId: "fine_peacebloom", quantity: 2, price: 16 },
      { itemId: "willow_bark", quantity: 4, price: 5 },
    ],
    buys: ["consumable", "spell_scroll", "crafting_material", "trade_good", "junk"],
    baseSellModifier: 1.2,
    baseBuyModifier: 0.55,
    goldSupply: 900,
    restockHours: 12,
    buysStolenGoods: false,
  }),
  57: vendor({
    offset: 57,
    vendorId: "traveling_merchant_ossa",
    vendorName: "Traveling Merchant Ossa",
    name: "Traveling Merchant Ossa",
    vendorType: "traveling_merchant",
    region: "harthmere",
    stocks: [
      { itemId: "road_ration", quantity: 4, price: 12 },
      { itemId: "minor_healing_salve", quantity: 1, price: 22 },
      { itemId: "iron_key_blank", quantity: 1, price: 15 },
      { itemId: "skinning_knife", quantity: 1, price: 23 },
      { itemId: "scavenger_hook", quantity: 1, price: 20 },
    ],
    buys: ["trade_good", "junk", "food", "tool", "crafting_material"],
    baseSellModifier: 1.28,
    baseBuyModifier: 0.46,
    goldSupply: 650,
    restockHours: 24,
    buysStolenGoods: false,
  }),
  63: vendor({
    offset: 63,
    vendorId: "orchard_produce_stand",
    vendorName: "Orchard Produce Stand",
    name: "Orchard Produce Stand",
    vendorType: "farmer",
    region: "harthmere",
    stocks: [
      { itemId: "apple_tart", quantity: 2, price: 7 },
      { itemId: "field_wheat", quantity: 6, price: 3 },
      { itemId: "fresh_carrot", quantity: 6, price: 4 },
      { itemId: "golden_carrot", quantity: 1, price: 45 },
    ],
    buys: ["food", "crafting_material", "trade_good", "junk"],
    baseSellModifier: 0.95,
    baseBuyModifier: 0.42,
    goldSupply: 180,
    restockHours: 8,
    buysStolenGoods: false,
  }),
  65: vendor({
    offset: 65,
    vendorId: "river_knots_fence",
    vendorName: "River Knots Fence",
    name: "River Knots Fence",
    vendorType: "fence",
    region: "harthmere",
    stocks: [
      { itemId: "river_knot_marker", quantity: 1, price: 25 },
      { itemId: "old_coin", quantity: 1, price: 16 },
      { itemId: "blue_glass_shard", quantity: 1, price: 22 },
    ],
    buys: ["trade_good", "junk", "crafting_material", "trophy", "tool", "black_market"],
    baseSellModifier: 1.25,
    baseBuyModifier: 0.46,
    goldSupply: 500,
    restockHours: 24,
    buysStolenGoods: true,
    refusesStolenGoods: false,
    lawfulService: false,
  }),
  67: vendor({
    offset: 67,
    vendorId: "forge_apprentice_luth",
    vendorName: "Forge Apprentice Luth",
    name: "Forge Apprentice Luth",
    vendorType: "blacksmith",
    region: "harthmere",
    stocks: [
      { itemId: "training_dagger", quantity: 1, price: 22 },
      { itemId: "rusty_pickaxe", quantity: 1, price: 26 },
      { itemId: "woodcutters_axe", quantity: 1, price: 26 },
      { itemId: "repair_voucher", quantity: 1, price: 18 },
    ],
    buys: ["weapon", "armor", "tool", "crafting_material", "junk"],
    baseSellModifier: 1.05,
    baseBuyModifier: 0.5,
    goldSupply: 300,
    restockHours: 12,
    buysStolenGoods: false,
  }),
};

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
  "biomes.localDev.harthmere.vendorStockState.v1";

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
    const raw = window.localStorage.getItem(HARTHMERE_VENDOR_STOCK_STATE_KEY);
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
  window.localStorage.setItem(
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
  const state = readHarthmereVendorRuntimeState();
  const quantity = Math.max(0, Math.round(state.vendorStock[vendor.vendorId]?.[itemId] ?? line.quantity));
  if (quantity <= 0) {
    return undefined;
  }
  const unitPrice = line.price / Math.max(1, line.quantity);
  return {
    ...line,
    quantity,
    price: Math.max(1, Math.ceil(unitPrice * quantity)),
  };
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
