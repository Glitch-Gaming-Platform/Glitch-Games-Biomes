import React, { useMemo } from "react";

/**
 * HARTHMERE_ECONOMY_SHEET_OPTIMIZATION_V1
 *
 * Local-dev MMO economy optimization layer.
 *
 * This module fills gaps from the full economic rule sheet that are broader than
 * simple vendor buy/sell:
 * - secondary currency policies
 * - inflation and health monitoring
 * - regional markets and trade routes
 * - transparent taxes/fees and rounding
 * - item value/repair/salvage/upgrade economics
 * - loot/drop rarity controls
 * - player shops, work orders, services
 * - market UI and anti-scam warnings
 * - price quote locking
 * - bot/RMT/new-player/endgame economy protection
 *
 * Production note:
 * These contracts are intentionally local-dev/read-model safe. Final multiplayer
 * enforcement must live behind the server-authoritative economy transaction
 * pipeline already covered by the Harthmere server authority contracts.
 */

export const HARTHMERE_ECONOMY_OPTIMIZATION_VERSION =
  "harthmere-economy-sheet-optimization-v1" as const;

export const HARTHMERE_ECONOMY_OPTIMIZATION_LOCAL_STORAGE_KEYS = {
  priceQuotes: "harthmere.economy.optimization.priceQuotes.v1",
  healthSnapshots: "harthmere.economy.optimization.healthSnapshots.v1",
  suspiciousActivity: "harthmere.economy.optimization.suspiciousActivity.v1",
  marketHistory: "harthmere.economy.optimization.marketHistory.v1",
  workOrders: "harthmere.economy.optimization.workOrders.v1",
  playerShops: "harthmere.economy.optimization.playerShops.v1",
} as const;

export type HarthmereCurrencyScope =
  | "character"
  | "account"
  | "season"
  | "event"
  | "criminal"
  | "guild";

export interface HarthmereSecondaryCurrencyPolicy {
  id: string;
  name: string;
  scope: HarthmereCurrencyScope;
  sourceActivities: readonly string[];
  useCases: readonly string[];
  cap: number | null;
  expires: "never" | "season_end" | "event_end" | "weekly_reset";
  conversionOnExpire?: {
    currency: "gold" | "silver" | "copper" | "harthmere_favor";
    rate: number;
  };
  replacesGold: boolean;
  auditTags: readonly string[];
}

export const HARTHMERE_SECONDARY_CURRENCY_POLICIES: readonly HarthmereSecondaryCurrencyPolicy[] = [
  {
    id: "harthmere_favor",
    name: "Harthmere Favor",
    scope: "character",
    sourceActivities: ["local quests", "town projects", "public events"],
    useCases: ["discounts", "local services", "vendor unlocks", "quest choices"],
    cap: 5000,
    expires: "never",
    replacesGold: false,
    auditTags: ["reputation", "local-economy"],
  },
  {
    id: "guild_marks",
    name: "Guild Marks",
    scope: "guild",
    sourceActivities: ["guild contracts", "guild projects", "guild labor"],
    useCases: ["guild repairs", "guild vendors", "guild hall upgrades"],
    cap: 100000,
    expires: "never",
    replacesGold: false,
    auditTags: ["guild", "endgame-sink"],
  },
  {
    id: "bounty_tokens",
    name: "Bounty Tokens",
    scope: "character",
    sourceActivities: ["bounty hunting", "criminal capture", "guard contracts"],
    useCases: ["guard vendors", "legal services", "bounty cosmetics"],
    cap: 2000,
    expires: "weekly_reset",
    replacesGold: false,
    auditTags: ["pvp", "law"],
  },
  {
    id: "crafting_writs",
    name: "Crafting Writs",
    scope: "account",
    sourceActivities: ["work orders", "profession quests", "crafting dailies"],
    useCases: ["recipes", "crafting tools", "station upgrades"],
    cap: 10000,
    expires: "never",
    replacesGold: false,
    auditTags: ["profession", "crafting"],
  },
  {
    id: "festival_tokens",
    name: "Festival Tokens",
    scope: "event",
    sourceActivities: ["festival games", "seasonal quests", "event vendors"],
    useCases: ["seasonal cosmetics", "festival food", "temporary decorations"],
    cap: 5000,
    expires: "event_end",
    conversionOnExpire: { currency: "silver", rate: 0.1 },
    replacesGold: false,
    auditTags: ["seasonal", "event"],
  },
  {
    id: "dungeon_seals",
    name: "Dungeon Seals",
    scope: "character",
    sourceActivities: ["dungeon bosses", "weekly dungeon quests"],
    useCases: ["dungeon gear", "upgrade materials", "repair kits"],
    cap: 3000,
    expires: "weekly_reset",
    replacesGold: false,
    auditTags: ["dungeon", "lockout"],
  },
  {
    id: "pvp_marks",
    name: "PvP Marks",
    scope: "character",
    sourceActivities: ["objectives", "duels", "bounties", "battleground wins"],
    useCases: ["pvp gear", "pvp cosmetics", "siege consumables"],
    cap: 3000,
    expires: "weekly_reset",
    replacesGold: false,
    auditTags: ["pvp", "anti-farm"],
  },
  {
    id: "black_market_coins",
    name: "Black Market Coins",
    scope: "criminal",
    sourceActivities: ["fence sales", "smuggling", "criminal contracts"],
    useCases: ["laundering", "bribes", "illegal tools", "forged papers"],
    cap: 10000,
    expires: "never",
    replacesGold: false,
    auditTags: ["criminal", "risk"],
  },
] as const;

export interface HarthmereInflationMetric {
  id: string;
  label: string;
  category: "currency" | "item" | "market" | "player" | "sink" | "source" | "abuse";
  cadence: "hourly" | "daily" | "weekly";
  warningRule: string;
}

export const HARTHMERE_INFLATION_MONITORING_METRICS: readonly HarthmereInflationMetric[] = [
  { id: "total_gold_circulation", label: "Total gold in circulation", category: "currency", cadence: "daily", warningRule: "rises faster than active player count" },
  { id: "gold_created_per_day", label: "Gold created per day", category: "source", cadence: "daily", warningRule: "source growth exceeds sink growth by 20%" },
  { id: "gold_destroyed_per_day", label: "Gold destroyed per day", category: "sink", cadence: "daily", warningRule: "sinks below 60% of sources for three days" },
  { id: "average_gold_by_level", label: "Average gold by player level", category: "player", cadence: "daily", warningRule: "new players cannot afford repairs/travel" },
  { id: "auction_price_index", label: "Auction price index", category: "market", cadence: "daily", warningRule: "core materials spike above 2x weekly average" },
  { id: "vendor_sale_volume", label: "Vendor sale volume", category: "market", cadence: "daily", warningRule: "vendor trash payout dominates gold source chart" },
  { id: "repair_fee_burden", label: "Repair fee burden", category: "sink", cadence: "daily", warningRule: "average repair cost exceeds normal quest income" },
  { id: "bot_like_farming", label: "Bot-like farming behavior", category: "abuse", cadence: "hourly", warningRule: "same path/resource loop repeats too often" },
  { id: "rare_item_circulation", label: "Rare item circulation", category: "item", cadence: "daily", warningRule: "rare supply grows without matching sink/lockout" },
  { id: "quest_reward_inflation", label: "Quest reward inflation", category: "source", cadence: "weekly", warningRule: "repeatable quest payouts exceed caps" },
] as const;

export type HarthmereRegionId =
  | "harthmere"
  | "greenmere_forest"
  | "ironhold_mines"
  | "riverport"
  | "warfront"
  | "freeport"
  | "wyrmglass_reach";

export interface HarthmereRegionalMarket {
  id: HarthmereRegionId;
  name: string;
  produces: readonly string[];
  imports: readonly string[];
  expensive: readonly string[];
  taxRate: number;
  risk: "safe" | "guarded" | "contested" | "dangerous" | "criminal";
  regionalPriceModifiers: Readonly<Record<string, number>>;
}

export const HARTHMERE_REGIONAL_MARKETS: readonly HarthmereRegionalMarket[] = [
  {
    id: "harthmere",
    name: "Harthmere",
    produces: ["grain", "food", "cloth", "basic tools", "local services"],
    imports: ["rare ore", "luxury cloth", "magic crystals"],
    expensive: ["rare ore", "enchanted goods", "luxury goods"],
    taxRate: 0.08,
    risk: "guarded",
    regionalPriceModifiers: { food: 0.9, medicine: 1.1, ore: 1.15, luxury: 1.25 },
  },
  {
    id: "greenmere_forest",
    name: "Greenmere Forest",
    produces: ["wood", "herbs", "leather", "game meat"],
    imports: ["ore", "plate armor", "glass"],
    expensive: ["metal goods", "desert goods"],
    taxRate: 0.05,
    risk: "safe",
    regionalPriceModifiers: { wood: 0.65, herbs: 0.8, leather: 0.85, ore: 1.35 },
  },
  {
    id: "ironhold_mines",
    name: "Ironhold Mines",
    produces: ["ore", "gems", "stone", "coal"],
    imports: ["food", "medicine", "cloth"],
    expensive: ["food", "medicine"],
    taxRate: 0.06,
    risk: "guarded",
    regionalPriceModifiers: { ore: 0.55, gems: 0.85, food: 1.25, medicine: 1.3 },
  },
  {
    id: "riverport",
    name: "Riverport",
    produces: ["fish", "salt", "pearls", "ship parts"],
    imports: ["ore", "luxury cloth", "war supplies"],
    expensive: ["weapons", "armor"],
    taxRate: 0.05,
    risk: "contested",
    regionalPriceModifiers: { fish: 0.6, salt: 0.7, pearls: 0.9, weapons: 1.2 },
  },
  {
    id: "warfront",
    name: "Warfront City",
    produces: ["contracts", "bounty tokens", "salvage"],
    imports: ["weapons", "armor", "potions", "food", "medicine"],
    expensive: ["weapons", "armor", "potions", "medicine"],
    taxRate: 0.12,
    risk: "dangerous",
    regionalPriceModifiers: { weapons: 1.55, armor: 1.45, potions: 1.6, medicine: 1.8, food: 1.35 },
  },
  {
    id: "freeport",
    name: "Freeport",
    produces: ["trade goods", "smuggled goods", "transport services"],
    imports: ["everything"],
    expensive: ["legal services"],
    taxRate: 0.04,
    risk: "criminal",
    regionalPriceModifiers: { legal: 1.5, illegal: 0.85, trade_goods: 0.95, luxury: 1.05 },
  },
  {
    id: "wyrmglass_reach",
    name: "Wyrmglass Reach",
    produces: ["crystals", "scrolls", "enchanted goods", "reagents"],
    imports: ["food", "wood", "mundane tools"],
    expensive: ["food", "wood", "mundane_tools"],
    taxRate: 0.1,
    risk: "contested",
    regionalPriceModifiers: { crystals: 0.75, scrolls: 0.9, reagents: 0.85, food: 1.3 },
  },
] as const;

export interface HarthmereTradeRoute {
  id: string;
  name: string;
  origin: HarthmereRegionId;
  destination: HarthmereRegionId;
  carriedGoods: readonly string[];
  status: "safe" | "bandit_threat" | "blockaded" | "storm_delayed" | "taxed" | "smuggler_controlled";
  riskMultiplier: number;
  priceEffects: readonly string[];
  playerActions: readonly string[];
  eventHooks: readonly string[];
}

export const HARTHMERE_TRADE_ROUTES: readonly HarthmereTradeRoute[] = [
  {
    id: "north_road_ironhold",
    name: "North Road to Ironhold",
    origin: "ironhold_mines",
    destination: "harthmere",
    carriedGoods: ["ore", "coal", "tools", "ingots"],
    status: "bandit_threat",
    riskMultiplier: 1.3,
    priceEffects: ["ore shortage if blocked", "weapon prices rise", "repair costs rise"],
    playerActions: ["escort caravan", "clear bandits", "repair bridge", "sabotage rival convoy"],
    eventHooks: ["bandit ambush", "bridge destroyed", "merchant strike"],
  },
  {
    id: "river_route_freeport",
    name: "River Route to Freeport",
    origin: "freeport",
    destination: "harthmere",
    carriedGoods: ["fish", "salt", "trade goods", "contraband"],
    status: "smuggler_controlled",
    riskMultiplier: 1.5,
    priceEffects: ["black market activity rises", "legal taxes fall if smuggled", "guard inspections rise"],
    playerActions: ["smuggle cargo", "inform guards", "escort legal shipment", "raid smugglers"],
    eventHooks: ["smuggler route discovered", "customs crackdown", "storm delay"],
  },
  {
    id: "greenmere_harvest_road",
    name: "Greenmere Harvest Road",
    origin: "greenmere_forest",
    destination: "harthmere",
    carriedGoods: ["wood", "herbs", "leather", "game meat"],
    status: "safe",
    riskMultiplier: 0.9,
    priceEffects: ["food prices fall", "herb supply rises", "wood cheaper"],
    playerActions: ["protect merchants", "negotiate trade agreement", "deliver medicine"],
    eventHooks: ["seasonal harvest", "plague affects workers", "wolf packs disrupt road"],
  },
  {
    id: "warfront_supply_line",
    name: "Warfront Supply Line",
    origin: "harthmere",
    destination: "warfront",
    carriedGoods: ["weapons", "armor", "potions", "food", "medicine"],
    status: "taxed",
    riskMultiplier: 1.4,
    priceEffects: ["war supply demand rises", "medicine shortage possible", "weapon prices rise"],
    playerActions: ["escort supplies", "sell trade goods", "bounty hunt raiders", "negotiate tolls"],
    eventHooks: ["war begins", "faction war blocks road", "tax increase"],
  },
] as const;

export const HARTHMERE_TAX_AND_FEE_POLICY = {
  auctionListingFeePercent: 0.03,
  auctionSaleTaxPercent: 0.1,
  luxuryItemTaxPercent: 0.15,
  blackMarketCutPercent: 0.2,
  tradeTaxPercent: 0.02,
  mailAttachmentFeeCopper: 5,
  codFeePercent: 0.02,
  craftingStationFeePercent: 0.04,
  marketStallFeeCopperPerDay: 25,
  minimumAuctionTaxCopper: 1,
  minimumListingFeeCopper: 1,
  rounding: "ceil_to_copper",
  transparentBeforeConfirm: true,
  noSurpriseTaxes: true,
} as const;

export interface HarthmereMarketHistoryEntry {
  itemId: string;
  region: HarthmereRegionId;
  average24h: number;
  average7d: number;
  lowestListing: number;
  highestListing: number;
  recentSaleLow: number;
  recentSaleHigh: number;
  volumeSold: number;
  timestamp: number;
}

export const HARTHMERE_AUCTION_FILTERS = [
  "item type",
  "level requirement",
  "rarity",
  "price",
  "stat",
  "crafting profession",
  "material type",
  "usable by class",
  "region",
  "seller",
  "buyout price",
  "time remaining",
  "unit price",
  "stack size",
] as const;

export const HARTHMERE_MARKET_UI_FIELDS = [
  "current listings",
  "average price",
  "lowest price",
  "recent sale price",
  "price history",
  "stack size",
  "seller",
  "time remaining",
  "tax/fee",
  "total cost",
  "unit price",
  "usable by player",
  "far above average warning",
] as const;

export const HARTHMERE_ANTI_SCAM_WARNINGS = [
  "trade partner changed offer",
  "currency amount changed",
  "item is damaged",
  "item will bind when received",
  "item is stolen",
  "item expires soon",
  "item unusually valuable",
  "item cannot be used by your class",
  "auction unit price differs from stack total",
  "auction price far above recent average",
  "final confirmation required",
] as const;

export type HarthmereItemQuality =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "artifact";

export const HARTHMERE_QUALITY_VALUE_MODIFIERS: Record<HarthmereItemQuality, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.75,
  epic: 2.5,
  legendary: 4,
  artifact: 8,
};

export const HARTHMERE_REPAIR_QUALITY_MODIFIERS: Record<HarthmereItemQuality, number> = {
  common: 1,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2,
  legendary: 3,
  artifact: 5,
};

export const HARTHMERE_DURABILITY_CONDITION_MODIFIERS = [
  { minDurability: 100, valueModifier: 1 },
  { minDurability: 75, valueModifier: 0.85 },
  { minDurability: 50, valueModifier: 0.65 },
  { minDurability: 25, valueModifier: 0.4 },
  { minDurability: 1, valueModifier: 0.1 },
  { minDurability: 0, valueModifier: 0.1 },
] as const;

export function getHarthmereConditionValueModifier(durabilityPercent: number): number {
  const bounded = Math.max(0, Math.min(100, Math.floor(durabilityPercent)));
  const tier = HARTHMERE_DURABILITY_CONDITION_MODIFIERS.find(
    (entry) => bounded >= entry.minDurability
  );
  return tier?.valueModifier ?? 0.1;
}

export interface HarthmereItemValueInput {
  baseValueCopper: number;
  level: number;
  quality: HarthmereItemQuality;
  demandModifier: number;
  scarcityModifier: number;
  durabilityPercent: number;
  stolen?: boolean;
  bound?: boolean;
  eventExpired?: boolean;
}

export function calculateHarthmereItemValue(input: HarthmereItemValueInput): number {
  if (input.eventExpired) {
    return 0;
  }

  const levelModifier = Math.max(1, 1 + input.level * 0.025);
  const qualityModifier = HARTHMERE_QUALITY_VALUE_MODIFIERS[input.quality] ?? 1;
  const conditionModifier = getHarthmereConditionValueModifier(input.durabilityPercent);
  const stolenModifier = input.stolen ? 0.35 : 1;
  const boundModifier = input.bound ? 0.65 : 1;

  return Math.max(
    0,
    Math.round(
      input.baseValueCopper *
        levelModifier *
        qualityModifier *
        input.demandModifier *
        input.scarcityModifier *
        conditionModifier *
        stolenModifier *
        boundModifier
    )
  );
}

export interface HarthmereRepairCostInput {
  itemBaseValueCopper: number;
  damagePercent: number;
  quality: HarthmereItemQuality;
  repairServiceModifier: number;
}

export function calculateHarthmereRepairCost(input: HarthmereRepairCostInput): number {
  const damage = Math.max(0, Math.min(100, input.damagePercent)) / 100;
  if (damage <= 0) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil(
      input.itemBaseValueCopper *
        damage *
        (HARTHMERE_REPAIR_QUALITY_MODIFIERS[input.quality] ?? 1) *
        Math.max(0.1, input.repairServiceModifier)
    )
  );
}

export const HARTHMERE_SALVAGE_RULES = {
  eligibleCategories: ["weapon", "armor", "tool", "crafted_item", "trade_good"],
  blockedStates: ["quest_bound", "locked", "escrowed", "mailed"],
  boundItemsMaySalvage: true,
  questItemsCannotSalvageUnlessExplicit: true,
  returnsMaterialsByQuality: {
    common: ["scrap_metal", "cloth_scrap", "rough_stone"],
    uncommon: ["iron_ore", "softwood_log", "peacebloom"],
    rare: ["rough_garnet", "mana_essence", "river_pearl"],
    epic: ["mana_crystal_shard", "bright_silver_nugget"],
    legendary: ["bell_gold_flake", "ghost_pearl"],
    artifact: ["relic_fragment"],
  },
  economyBenefits: ["removes excess items", "creates material supply", "supports crafting", "reduces vendor trash clutter"],
} as const;

export const HARTHMERE_ITEM_UPGRADE_RULES = {
  requiredInputs: ["gold", "materials", "runes", "gems", "essences", "crafting service"],
  optionalInputs: ["duplicate items", "faction tokens", "boss materials"],
  mayBindItem: true,
  clearFailureRulesRequired: true,
  noHiddenOdds: true,
  noPaidOnlySuccess: true,
  warningBeforeRareDestruction: true,
  highEndIsOptionalSink: true,
} as const;

export const HARTHMERE_DROP_RARITY_RULES = {
  rarities: ["common", "uncommon", "rare", "epic", "legendary", "artifact"],
  lootTableFields: [
    "enemy type",
    "enemy level",
    "enemy rank",
    "region",
    "faction",
    "rarity chances",
    "material drops",
    "currency drops",
    "quest drops",
    "unique drops",
    "player level restrictions",
    "daily/weekly lockouts",
  ],
  logicalLootExamples: {
    wolf: ["wolf_hide", "raw_meat", "wolf_fang"],
    bandit: ["coins", "dagger", "stolen_ring"],
    undead: ["grave_dust", "old_coin", "relic_fragment"],
    mage: ["scroll", "robe_cloth", "arcane_dust"],
  },
  invalidLootExamples: ["rat drops legendary sword", "wolf drops plate armor", "poor farmer drops rare magic gems"],
  controlledSupply: true,
  personalLootSupported: true,
  bindingControlsMarketFlooding: true,
} as const;

export const HARTHMERE_CONSUMABLE_ECONOMY_RULES = {
  consumableTypes: ["potions", "food", "drink", "scrolls", "ammunition", "poisons", "elixirs", "buff items", "repair kits", "teleport stones", "bombs", "traps", "reagents"],
  basicVendorVersions: true,
  betterCraftedVersions: true,
  usefulButNotMandatoryForEveryMinorFight: true,
  highEndPreparationEncouraged: true,
  repeatDemandSink: true,
} as const;

export const HARTHMERE_SERVICE_ECONOMY_RULES = {
  npcServices: ["repair", "training", "respec", "fast travel", "teleportation", "bank expansion", "mount training", "housing upkeep", "crafting station rental", "item identification", "enchanting", "transmog", "legal fine payment", "bribe", "mail delivery", "storage rental"],
  playerServices: ["crafting", "enchanting", "repair", "gathering", "transport", "protection", "caravan escort", "mercenary work", "bounty hunting", "information brokering", "housing decoration"],
  createsRolesBeyondCombat: true,
  basicServicesAffordableForNewPlayers: true,
  luxuryServicesScaleForEndgamePlayers: true,
} as const;

export const HARTHMERE_PLAYER_SHOP_RULES = {
  rentStallOrShopSpace: true,
  publicGuildFactionVisibility: ["public", "guild-only", "faction-only", "black-market"],
  shopCosts: ["tax", "upkeep", "market stall fee"],
  illegalItemsRequireBlackMarketShop: true,
  sellerSetsPrices: true,
  saleTaxApplies: true,
  highValueTransfersAreLogged: true,
} as const;

export const HARTHMERE_WORK_ORDER_RULES = {
  requesterPostsOrder: true,
  requesterCanSupplyMaterials: true,
  requesterCanSupplyGold: true,
  serverHoldsMaterialsInEscrow: true,
  crafterAcceptsOrder: true,
  crafterCompletesItem: true,
  requesterReceivesItem: true,
  crafterReceivesPaymentAndProfessionXp: true,
  preventsScams: true,
} as const;

export const HARTHMERE_NPC_LABOR_ECONOMY = {
  farmers: { produce: ["food", "grain"], consume: ["tools", "taxes"] },
  miners: { produce: ["ore", "stone"], consume: ["food", "medicine", "tools"] },
  blacksmiths: { produce: ["tools", "weapons", "repair services"], consume: ["ore", "coal"] },
  merchants: { produce: ["market access", "transport"], consume: ["taxes", "security"] },
  guards: { produce: ["security", "trade protection"], consume: ["taxes", "food", "armor repairs"] },
  nobles: { produce: ["contracts", "permits"], consume: ["luxury goods", "tax revenue"] },
  peasants: { produce: ["labor", "basics"], consume: ["food", "medicine"] },
  thieves: { produce: ["black-market liquidity"], consume: ["stolen goods", "bribes"] },
  temples: { produce: ["healing", "blessings"], consume: ["donations", "medicine"] },
} as const;

export const HARTHMERE_TOWN_WEALTH_RULES = {
  affects: ["vendor stock", "building quality", "guard strength", "road quality", "npc clothing", "crime rate", "available quests", "tax rate", "prices", "public events"],
  increasesFrom: ["safe trade routes", "player investments", "completed town projects", "successful harvests", "protected caravans", "cleared monsters", "faction prosperity"],
  decreasesFrom: ["raids", "bandits", "war", "plague", "famine", "trade disruption", "high crime", "player sabotage", "boss attacks"],
} as const;

export const HARTHMERE_SCARCITY_RULES = {
  scarcityTypes: ["limited spawn materials", "boss-only materials", "seasonal items", "faction-limited goods", "crafting cooldown items", "rare recipes", "regional goods", "event rewards", "prestige cosmetics"],
  clearSourcesRequired: true,
  scarceCosmeticsSaferThanPower: true,
  avoidMandatoryProgressionScarcity: true,
  lockoutBackedPowerScarcity: true,
} as const;

export const HARTHMERE_TIME_SEASONAL_ECONOMY_RULES = {
  marketsBusierDuringDay: true,
  blackMarketsActiveAtNight: true,
  seasonChangesFishFoodFestivalItems: true,
  famineWarPlagueAffectPrices: true,
  seasonalCurrencyExpiresOrConverts: true,
  temporaryPowerItemsExpireOrAreLimited: true,
  spoilageTimersMustBeVisible: true,
  preservationMethodsSupported: true,
} as const;

export const HARTHMERE_ANTI_BOT_RMT_RULES = {
  detectionSignals: [
    "repeated farming path",
    "24/7 gathering",
    "impossible reaction times",
    "identical movement loops",
    "massive currency transfers",
    "low-level accounts mailing large gold",
    "repeated auction undercutting patterns",
    "high-value trades with no fair exchange",
    "new accounts funneling gold to one account",
  ],
  preventionTools: [
    "diminishing returns",
    "gathering route randomization",
    "server movement validation",
    "trade limits for new accounts",
    "mail limits for new accounts",
    "auction limits for new accounts",
    "suspicious transaction flags",
    "ban waves",
    "item/currency rollback tools",
  ],
  avoidPunishingNormalPlayers: true,
} as const;

export const HARTHMERE_NEW_PLAYER_PROTECTION_RULES = {
  starterRepairsCheap: true,
  starterGearAffordable: true,
  basicTravelAffordable: true,
  questRewardsCoverNormalCosts: true,
  earlyCraftingSimple: true,
  auctionHouseNotRequired: true,
  antiScamWarningsEnabled: true,
  repairFeeBurdenThreshold: 0.25,
} as const;

export const HARTHMERE_ENDGAME_ECONOMY_SINKS = {
  optionalSinks: ["legendary crafting", "housing mansions", "guild halls", "mount cosmetics", "rare transmog", "high-end enchants", "raid consumables", "town projects", "faction investments", "siege warfare", "player shops", "luxury vendors", "prestige titles", "special effects"],
  mostlyOptionalPowerRefinement: true,
  wealthNotOnlyPathToPower: true,
  largeCosmeticPrestigeSinks: true,
} as const;

export const HARTHMERE_ECONOMIC_HEALTH_CHECKLIST = [
  "Is too much gold entering the world?",
  "Are players hoarding gold with nothing to spend on?",
  "Are repair costs fair?",
  "Are basic goods affordable for new players?",
  "Are bots controlling material prices?",
  "Are crafted items useful?",
  "Are dropped items making crafting useless?",
  "Are auction taxes high enough?",
  "Are auction taxes too high?",
  "Are rare items too common?",
  "Are materials too scarce?",
  "Are players using vendors?",
  "Are players using the auction house?",
  "Are black markets useful but risky?",
  "Are town economies reacting to world events?",
] as const;

export interface HarthmerePriceQuote {
  quoteId: string;
  playerId: string;
  vendorId: string;
  itemId: string;
  quotedCopper: number;
  taxCopper: number;
  feeCopper: number;
  createdAt: number;
  expiresAt: number;
  region: HarthmereRegionId;
  reason: string;
}

export function createHarthmereVendorPriceQuote(input: {
  playerId: string;
  vendorId: string;
  itemId: string;
  region: HarthmereRegionId;
  baseCopper: number;
  now: number;
  ttlMs?: number;
  reason?: string;
}): HarthmerePriceQuote {
  const ttl = input.ttlMs ?? 30_000;
  const feeCopper = calculateHarthmereMinimumFee(input.baseCopper, HARTHMERE_TAX_AND_FEE_POLICY.tradeTaxPercent, 0);
  return {
    quoteId: `quote_${input.playerId}_${input.vendorId}_${input.itemId}_${input.now}`,
    playerId: input.playerId,
    vendorId: input.vendorId,
    itemId: input.itemId,
    quotedCopper: Math.max(0, Math.round(input.baseCopper)),
    taxCopper: 0,
    feeCopper,
    createdAt: input.now,
    expiresAt: input.now + ttl,
    region: input.region,
    reason: input.reason ?? "vendor_interaction_price_lock",
  };
}

export function isHarthmerePriceQuoteValid(quote: HarthmerePriceQuote, now: number): boolean {
  return now >= quote.createdAt && now <= quote.expiresAt && quote.quotedCopper >= 0;
}

export function calculateHarthmereMinimumFee(baseCopper: number, percent: number, minimumCopper: number): number {
  if (baseCopper <= 0 || percent <= 0) {
    return 0;
  }
  return Math.max(minimumCopper, Math.ceil(baseCopper * percent));
}

export function calculateHarthmereAuctionTax(totalCopper: number, luxury = false): number {
  const percent = luxury
    ? HARTHMERE_TAX_AND_FEE_POLICY.luxuryItemTaxPercent
    : HARTHMERE_TAX_AND_FEE_POLICY.auctionSaleTaxPercent;
  return calculateHarthmereMinimumFee(totalCopper, percent, HARTHMERE_TAX_AND_FEE_POLICY.minimumAuctionTaxCopper);
}

export function calculateHarthmereListingFee(vendorValueCopper: number): number {
  return calculateHarthmereMinimumFee(
    vendorValueCopper,
    HARTHMERE_TAX_AND_FEE_POLICY.auctionListingFeePercent,
    HARTHMERE_TAX_AND_FEE_POLICY.minimumListingFeeCopper
  );
}

export function getHarthmereRegionalPriceModifier(regionId: HarthmereRegionId, tag: string): number {
  const region = HARTHMERE_REGIONAL_MARKETS.find((market) => market.id === regionId);
  return region?.regionalPriceModifiers[tag] ?? 1;
}

export interface HarthmereSuspiciousTransactionInput {
  accountAgeDays: number;
  playerLevel: number;
  goldMovedCopper: number;
  fairExchangeValueCopper: number;
  repeatedPartnerTransfers: number;
  identicalRouteScore: number;
  auctionUndercutCount: number;
  hoursOnlineToday: number;
}

export function scoreHarthmereSuspiciousEconomicActivity(input: HarthmereSuspiciousTransactionInput): {
  score: number;
  flags: string[];
} {
  const flags: string[] = [];
  let score = 0;

  if (input.accountAgeDays < 7 && input.goldMovedCopper > 10_000) {
    score += 25;
    flags.push("new account large transfer");
  }
  if (input.fairExchangeValueCopper * 3 < input.goldMovedCopper) {
    score += 25;
    flags.push("high value with no fair exchange");
  }
  if (input.repeatedPartnerTransfers >= 5) {
    score += 15;
    flags.push("repeated transfer pair");
  }
  if (input.identicalRouteScore > 0.85) {
    score += 20;
    flags.push("identical farming route");
  }
  if (input.auctionUndercutCount > 25) {
    score += 10;
    flags.push("repeated auction undercutting");
  }
  if (input.hoursOnlineToday >= 18) {
    score += 20;
    flags.push("near 24/7 activity");
  }
  if (input.playerLevel < 10 && input.goldMovedCopper > 50_000) {
    score += 15;
    flags.push("low level gold funnel");
  }

  return { score: Math.min(100, score), flags };
}

export interface HarthmereEconomicHealthSnapshot {
  totalGoldCopper: number;
  goldCreatedCopper: number;
  goldDestroyedCopper: number;
  activePlayers: number;
  auctionVolumeCopper: number;
  repairFeeBurden: number;
  botLikeSignals: number;
  rareItemCount: number;
}

export function evaluateHarthmereEconomicHealth(snapshot: HarthmereEconomicHealthSnapshot): {
  status: "healthy" | "watch" | "danger";
  warnings: string[];
} {
  const warnings: string[] = [];
  const sinkRatio = snapshot.goldCreatedCopper <= 0 ? 1 : snapshot.goldDestroyedCopper / snapshot.goldCreatedCopper;

  if (sinkRatio < 0.6) {
    warnings.push("gold sinks are too weak compared to sources");
  }
  if (snapshot.repairFeeBurden > HARTHMERE_NEW_PLAYER_PROTECTION_RULES.repairFeeBurdenThreshold) {
    warnings.push("repair costs may feel punishing");
  }
  if (snapshot.botLikeSignals > Math.max(5, snapshot.activePlayers * 0.05)) {
    warnings.push("bot-like farming signals are elevated");
  }
  if (snapshot.rareItemCount > Math.max(10, snapshot.activePlayers * 0.2)) {
    warnings.push("rare item circulation may be too high");
  }

  return {
    status: warnings.length >= 3 ? "danger" : warnings.length > 0 ? "watch" : "healthy",
    warnings,
  };
}

export function LocalDevHarthmereEconomyOptimizationSystem() {
  const healthChecklist = useMemo(() => HARTHMERE_ECONOMIC_HEALTH_CHECKLIST, []);

  return (
    <section data-harthmere-economy-optimization={HARTHMERE_ECONOMY_OPTIMIZATION_VERSION}>
      <h2>Economy Optimization</h2>
      <p>
        Regional markets, inflation monitoring, price quote locks, taxes, anti-scam,
        anti-bot, and long-term economy health rules are active for local-dev review.
      </p>
      <ul>
        {healthChecklist.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}

export const HARTHMERE_ECONOMY_SHEET_COVERAGE = {
  controls: [
    "currency creation",
    "currency destruction",
    "item creation",
    "item destruction",
    "vendor prices",
    "player trading",
    "auction house",
    "crafting",
    "gathering",
    "regional supply and demand",
    "taxes and fees",
    "inflation",
    "item rarity",
    "repair costs",
    "loot value",
    "quest rewards",
    "npc merchant behavior",
    "illegal markets",
    "guild economies",
    "player housing",
    "banking",
    "economic abuse prevention",
  ],
  optimizedNow: [
    "secondary currencies",
    "inflation monitoring",
    "regional markets",
    "trade routes",
    "player shops",
    "work orders",
    "services economy",
    "loot/drop rarity controls",
    "item value formula",
    "repair formula",
    "salvage",
    "item upgrades",
    "consumables",
    "tax rounding/minimums",
    "auction filters",
    "market ui fields",
    "price history",
    "anti-scam warnings",
    "anti-bot/rmt signals",
    "new player protection",
    "endgame sinks",
    "economic health checklist",
    "price quote lock",
  ],
} as const;

declare global {
  interface Window {
    __harthmereEconomyOptimization?: {
      version: typeof HARTHMERE_ECONOMY_OPTIMIZATION_VERSION;
      regionalMarkets: typeof HARTHMERE_REGIONAL_MARKETS;
      tradeRoutes: typeof HARTHMERE_TRADE_ROUTES;
      secondaryCurrencies: typeof HARTHMERE_SECONDARY_CURRENCY_POLICIES;
      createPriceQuote: typeof createHarthmereVendorPriceQuote;
      scoreSuspiciousActivity: typeof scoreHarthmereSuspiciousEconomicActivity;
      evaluateHealth: typeof evaluateHarthmereEconomicHealth;
    };
  }
}

if (typeof window !== "undefined") {
  window.__harthmereEconomyOptimization = {
    version: HARTHMERE_ECONOMY_OPTIMIZATION_VERSION,
    regionalMarkets: HARTHMERE_REGIONAL_MARKETS,
    tradeRoutes: HARTHMERE_TRADE_ROUTES,
    secondaryCurrencies: HARTHMERE_SECONDARY_CURRENCY_POLICIES,
    createPriceQuote: createHarthmereVendorPriceQuote,
    scoreSuspiciousActivity: scoreHarthmereSuspiciousEconomicActivity,
    evaluateHealth: evaluateHarthmereEconomicHealth,
  };
}
