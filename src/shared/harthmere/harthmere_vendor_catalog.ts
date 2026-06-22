import { ensureHarthmereProductionCraftingCatalogue } from "./mmo_crafting_catalogue";
import {
  getHarthmereItemDefinition,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  type HarthmereItemBinding,
  type HarthmereItemDefinition,
  type HarthmereVendorEntry,
} from "./mmo_inventory_authority";

export type HarthmereVendorCategory =
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

export interface HarthmereVendorStockLine {
  itemId: string;
  quantity: number;
  price: number;
}

export interface HarthmereVendorProfile {
  offset: number;
  vendorId: string;
  vendorName: string;
  name: string;
  vendorType: string;
  region: "harthmere";
  stocks: HarthmereVendorStockLine[];
  sells: Array<{ itemId: string; quantity: number }>;
  buys: HarthmereVendorCategory[];
  buysCategories: HarthmereVendorCategory[];
  baseSellModifier: number;
  baseBuyModifier: number;
  goldSupply: number;
  restockHours: number;
  buysStolenGoods: boolean;
  refusesStolenGoods: boolean;
  lawfulService: boolean;
  intentionalNonShop?: boolean;
}

interface HarthmereVendorItemDefinitionSeed {
  displayName: string;
  description?: string;
  category: HarthmereVendorCategory;
  maxStackSize: number;
  baseValue: number;
  binding?: HarthmereItemBinding;
  isConsumable?: boolean;
  isCraftingMaterial?: boolean;
  isSpellTome?: boolean;
  grantsAbilityId?: string;
  levelRequirement?: number;
  classRestriction?: string[];
  stats?: Record<string, number>;
  tradeable?: boolean;
  durabilityMax?: number;
}

const vendor = (
  profile: Omit<
    HarthmereVendorProfile,
    "sells" | "buysCategories" | "refusesStolenGoods" | "lawfulService"
  > & {
    refusesStolenGoods?: boolean;
    lawfulService?: boolean;
  }
): HarthmereVendorProfile => {
  const refusesStolenGoods =
    profile.refusesStolenGoods ?? !profile.buysStolenGoods;
  return {
    ...profile,
    sells: profile.stocks.map((stock) => ({
      itemId: stock.itemId,
      quantity: stock.quantity,
    })),
    buysCategories: profile.buys,
    refusesStolenGoods,
    lawfulService: profile.lawfulService ?? refusesStolenGoods,
  };
};

export const HARTHMERE_VENDOR_CATALOG: Record<
  number,
  HarthmereVendorProfile
> = {
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
      { itemId: "seed_wheat", quantity: 8, price: 2 },
      { itemId: "seed_carrot", quantity: 8, price: 2 },
      { itemId: "herbalist_sickle", quantity: 1, price: 22 },
    ],
    buys: ["food", "crafting_material", "tool", "trade_good", "junk"],
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
      { itemId: "scavenger_hook", quantity: 1, price: 24 },
    ],
    buys: [
      "trade_good",
      "junk",
      "currency",
      "event_item",
      "crafting_material",
      "tool",
      "luxury",
    ],
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
      { itemId: "rusty_pickaxe", quantity: 1, price: 30 },
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
      { itemId: "herbalist_sickle", quantity: 1, price: 24 },
    ],
    buys: [
      "consumable",
      "food",
      "crafting_material",
      "spell_scroll",
      "tool",
      "junk",
      "trade_good",
    ],
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
      { itemId: "stabilized_exotic_matter", quantity: 1, price: 240 },
    ],
    buys: [
      "spell_scroll",
      "book",
      "crafting_material",
      "quest_item",
      "tool",
      "junk",
      "trade_good",
      "luxury",
    ],
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
      { itemId: "simple_fishing_rod", quantity: 1, price: 24 },
    ],
    buys: ["food", "drink", "crafting_material", "event_item", "tool", "junk", "trade_good"],
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
      // HARTHMERE_TOOL_OBTAINABLE: the job tools are buyable here so the
      // "go get a repair/cleanup tool" objective is never a dead end.
      { itemId: "repair_mallet", quantity: 2, price: 30 },
      { itemId: "muck_rake", quantity: 2, price: 30 },
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
      { itemId: "skinning_knife", quantity: 1, price: 24 },
    ],
    buys: ["food", "drink", "cosmetic", "event_item", "tool", "trade_good", "junk"],
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
      { itemId: "herbalist_sickle", quantity: 1, price: 22 },
    ],
    buys: ["consumable", "tool", "trade_good", "quest_item", "luxury", "junk"],
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
      { itemId: "scavenger_hook", quantity: 1, price: 22 },
    ],
    buys: ["trade_good", "tool", "junk", "event_item", "key"],
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
    buys: ["consumable", "spell_scroll", "crafting_material", "tool", "trade_good", "junk"],
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
      { itemId: "seed_wheat", quantity: 10, price: 2 },
      { itemId: "seed_carrot", quantity: 10, price: 2 },
      { itemId: "golden_carrot", quantity: 1, price: 45 },
      { itemId: "woodcutters_axe", quantity: 1, price: 24 },
      // HARTHMERE_FARM_TOOLS_OBTAINABLE: the core farming tools are buyable here
      // (also craftable at a Workbench) so watering/tilling is never a dead end.
      { itemId: "7539420629350046", quantity: 2, price: 22 }, // Hoe
      { itemId: "7539420629350045", quantity: 2, price: 20 }, // Watering Can
      { itemId: "4537020877769799", quantity: 2, price: 18 }, // Bucket
    ],
    buys: ["food", "crafting_material", "tool", "trade_good", "junk"],
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
      { itemId: "scavenger_hook", quantity: 1, price: 24 },
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

const HARTHMERE_VENDOR_ITEM_DEFINITIONS: Record<
  string,
  HarthmereVendorItemDefinitionSeed
> = {
  apple_tart: {
    displayName: "Warm Apple Tart",
    category: "food",
    maxStackSize: 50,
    baseValue: 4,
    isConsumable: true,
    description: "A sweet road snack from Dawn Loaf Bakery.",
  },
  road_ration: {
    displayName: "Road Ration",
    category: "food",
    maxStackSize: 50,
    baseValue: 3,
    isConsumable: true,
    description: "Hard bread, dried fruit, and enough salt to survive a wet road.",
  },
  fresh_egg: {
    displayName: "Fresh Chicken Egg",
    category: "crafting_material",
    maxStackSize: 50,
    baseValue: 2,
    description: "A cooking material from Tilda's chicken yard.",
  },
  field_wheat: {
    displayName: "Field Wheat",
    category: "crafting_material",
    maxStackSize: 200,
    baseValue: 2,
    description: "Food supply material for bread, rations, taverns, and town projects.",
  },
  seed_wheat: {
    displayName: "Wheat Seed",
    category: "crafting_material",
    maxStackSize: 100,
    baseValue: 1,
    description: "Farm seed bought from growers or found near worked fields.",
  },
  seed_carrot: {
    displayName: "Carrot Seed",
    category: "crafting_material",
    maxStackSize: 100,
    baseValue: 1,
    description: "Farm seed for quick food crops.",
  },
  herbalist_sickle: {
    displayName: "Herbalist Sickle",
    category: "tool",
    maxStackSize: 1,
    baseValue: 10,
    binding: "on_pickup",
    durabilityMax: 55,
    stats: { toolTier: 1 },
    description: "A small curved blade for harvesting herbs without ruining roots.",
  },
  iron_key_blank: {
    displayName: "Iron Key Blank",
    category: "key",
    maxStackSize: 1,
    baseValue: 0,
    binding: "on_pickup",
    description: "A blank key stored on the keyring, not in a normal bag.",
  },
  repair_voucher: {
    displayName: "Black Anvil Repair Voucher",
    category: "trade_good",
    maxStackSize: 20,
    baseValue: 18,
    binding: "on_pickup",
    description: "Redeemable at the Black Anvil for trusted field repairs.",
  },
  scavenger_hook: {
    displayName: "Scavenger Hook",
    category: "tool",
    maxStackSize: 1,
    baseValue: 9,
    binding: "on_pickup",
    durabilityMax: 50,
    stats: { toolTier: 1 },
    description: "A hooked rod for pulling safe scrap from piles.",
  },
  training_dagger: {
    displayName: "Training Dagger",
    category: "weapon",
    maxStackSize: 1,
    baseValue: 18,
    binding: "on_equip",
    levelRequirement: 1,
    durabilityMax: 35,
    stats: { attackPoints: 9, accuracy: 2 },
    description: "A blunt-edged practice dagger from the Guard Yard racks.",
  },
  woodsman_axe: {
    displayName: "Woodsman's Axe",
    category: "weapon",
    maxStackSize: 1,
    baseValue: 70,
    binding: "on_equip",
    levelRequirement: 1,
    durabilityMax: 45,
    stats: { attackPoints: 14, accuracy: 1, criticalChance: 0.01 },
    description: "A plain chopping axe balanced for rough roadside defense.",
  },
  iron_longsword: {
    displayName: "Iron Longsword",
    category: "weapon",
    maxStackSize: 1,
    baseValue: 120,
    binding: "on_equip",
    levelRequirement: 2,
    durabilityMax: 50,
    stats: { attackPoints: 18, accuracy: 3 },
    description: "A reliable town-watch blade with a plain iron guard.",
  },
  two_handed_sword: {
    displayName: "Two-Handed Sword",
    category: "weapon",
    maxStackSize: 1,
    baseValue: 180,
    binding: "on_equip",
    levelRequirement: 3,
    durabilityMax: 60,
    stats: { attackPoints: 26, accuracy: 1, criticalChance: 0.02 },
    description: "A heavy Black Anvil blade for slower, harder hits.",
  },
  wooden_shield: {
    displayName: "Town Watch Buckler",
    category: "armor",
    maxStackSize: 1,
    baseValue: 45,
    binding: "on_equip",
    levelRequirement: 1,
    durabilityMax: 45,
    stats: { defense: 8, armor: 14 },
    description: "A reinforced wooden shield used during guard-yard drills.",
  },
  baker_apron: {
    displayName: "Dawn Loaf Apron",
    category: "cosmetic",
    maxStackSize: 1,
    baseValue: 12,
    binding: "on_pickup",
    levelRequirement: 1,
    durabilityMax: 30,
    stats: { defense: 1 },
    description:
      "A flour-dusted apron given to helpers who can carry apples cleanly.",
  },
  field_trousers: {
    displayName: "Grove Field Trousers",
    category: "cosmetic",
    maxStackSize: 1,
    baseValue: 12,
    binding: "on_pickup",
    levelRequirement: 1,
    durabilityMax: 30,
    stats: { defense: 1 },
    description:
      "Sturdy work trousers for the road, saved as starter travel gear.",
  },
  rusty_pickaxe: {
    displayName: "Rusty Pickaxe",
    category: "tool",
    maxStackSize: 1,
    baseValue: 12,
    binding: "on_pickup",
    durabilityMax: 60,
    stats: { toolTier: 1 },
    description: "Starter mining tool for copper, iron, stone, and simple gems.",
  },
  minor_healing_salve: {
    displayName: "Minor Healing Salve",
    category: "consumable",
    maxStackSize: 20,
    baseValue: 8,
    isConsumable: true,
    description: "Clean cloth packed with willow and mint.",
  },
  chapel_candle: {
    displayName: "Chapel Road Candle",
    category: "consumable",
    maxStackSize: 20,
    baseValue: 6,
    binding: "on_pickup",
    isConsumable: true,
    description: "A quiet blessing candle.",
  },
  field_revival_scroll: {
    displayName: "Field Revival Scroll",
    category: "spell_scroll",
    maxStackSize: 5,
    baseValue: 65,
    isConsumable: true,
    description: "A single-use revival charm.",
  },
  peacebloom: {
    displayName: "Peacebloom",
    category: "crafting_material",
    maxStackSize: 200,
    baseValue: 4,
    description: "Gentle medicinal herb used in alchemy and temple offerings.",
  },
  scroll_of_spark: {
    displayName: "Scroll of Spark",
    category: "spell_scroll",
    maxStackSize: 5,
    baseValue: 35,
    isSpellTome: true,
    grantsAbilityId: "spark_rank_1",
    description: "Teaches Spark Rank 1 if you do not already know it.",
  },
  arcane_extractor: {
    displayName: "Arcane Extractor",
    category: "tool",
    maxStackSize: 1,
    baseValue: 30,
    binding: "on_pickup",
    durabilityMax: 40,
    stats: { toolTier: 2 },
    description: "A glass-and-copper tool for drawing magical residue into vials.",
  },
  mana_essence: {
    displayName: "Mana Essence",
    category: "crafting_material",
    maxStackSize: 100,
    baseValue: 20,
    description: "Magical residue for scrolls, potions, and enchantments.",
  },
  stabilized_exotic_matter: {
    displayName: "Stabilized Exotic Matter",
    category: "crafting_material",
    maxStackSize: 50,
    baseValue: 180,
    description: "Contained Exotic Matter suitable for high-risk repairs.",
  },
  copper_kettle_token: {
    displayName: "Copper Kettle Tavern Token",
    category: "event_item",
    maxStackSize: 99,
    baseValue: 5,
    binding: "on_pickup",
    description: "A tavern token for food, rumors, or a round by the hearth.",
  },
  river_trout: {
    displayName: "River Trout",
    category: "food",
    maxStackSize: 100,
    baseValue: 5,
    isConsumable: true,
    description: "Fresh fish used in cooking and stamina recovery.",
  },
  woodcutters_axe: {
    displayName: "Woodcutter's Axe",
    category: "tool",
    maxStackSize: 1,
    baseValue: 12,
    binding: "on_pickup",
    durabilityMax: 60,
    stats: { toolTier: 1 },
    description: "Starter logging tool for fallen branches and softwood.",
  },
  patched_cloak: {
    displayName: "Patched Mudden Cloak",
    category: "armor",
    maxStackSize: 1,
    baseValue: 30,
    binding: "on_pickup",
    durabilityMax: 40,
    stats: { evasion: 4 },
    description: "A rough but warm cloak stitched from old sailcloth.",
  },
  skinning_knife: {
    displayName: "Skinning Knife",
    category: "tool",
    maxStackSize: 1,
    baseValue: 10,
    binding: "on_pickup",
    durabilityMax: 55,
    stats: { toolTier: 1 },
    description: "A practical knife for hides, meat, bone, and monster parts.",
  },
  old_coin: {
    displayName: "Old Coin",
    category: "trade_good",
    maxStackSize: 50,
    baseValue: 12,
    description: "A scavenged curio with minor collector value.",
  },
  river_knot_marker: {
    displayName: "Blue River Knot Marker",
    category: "key",
    maxStackSize: 1,
    baseValue: 0,
    binding: "on_pickup",
    description: "A quiet sign that certain dock doors may open later.",
  },
  simple_fishing_rod: {
    displayName: "Simple Fishing Rod",
    category: "tool",
    maxStackSize: 1,
    baseValue: 10,
    binding: "on_pickup",
    durabilityMax: 55,
    stats: { toolTier: 1 },
    description: "A dockhand's rod for river fish and basic fishing pools.",
  },
  clay_shovel: {
    displayName: "Clay Shovel",
    category: "tool",
    maxStackSize: 1,
    baseValue: 10,
    binding: "on_pickup",
    durabilityMax: 55,
    stats: { toolTier: 1 },
    description: "A short shovel for river clay, relic digs, and soft earth.",
  },
  fine_peacebloom: {
    displayName: "Fine Peacebloom",
    category: "crafting_material",
    maxStackSize: 100,
    baseValue: 12,
    description: "Higher quality medicinal herb with stronger potion value.",
  },
  willow_bark: {
    displayName: "Willow Bark",
    category: "crafting_material",
    maxStackSize: 200,
    baseValue: 3,
    description: "Pain-relief ingredient for salves, teas, and healer contracts.",
  },
  fresh_carrot: {
    displayName: "Fresh Carrot",
    category: "food",
    maxStackSize: 100,
    baseValue: 2,
    isConsumable: true,
    description: "Cooking ingredient, farm contract material, and quick snack.",
  },
  golden_carrot: {
    displayName: "Golden Carrot",
    category: "crafting_material",
    maxStackSize: 20,
    baseValue: 35,
    description: "Rare crop used in high-value cooking and animal training.",
  },
  blue_glass_shard: {
    displayName: "Blue Glass Shard",
    category: "crafting_material",
    maxStackSize: 50,
    baseValue: 14,
    description: "A rare riverbank find used for lamps, charms, and repairs.",
  },
};

function itemDefinitionFromSeed(
  itemId: string,
  seed: HarthmereVendorItemDefinitionSeed
): HarthmereItemDefinition {
  return {
    itemId,
    displayName: seed.displayName,
    description: seed.description,
    maxStackSize: seed.maxStackSize,
    baseValue: seed.baseValue,
    binding: seed.binding ?? "none",
    isQuestItem: false,
    isCurrency: seed.category === "currency",
    isConsumable: seed.isConsumable ?? false,
    isCraftingMaterial:
      seed.isCraftingMaterial ?? seed.category === "crafting_material",
    isSpellTome: seed.isSpellTome ?? false,
    grantsAbilityId: seed.grantsAbilityId,
    levelRequirement: seed.levelRequirement ?? 1,
    classRestriction: seed.classRestriction ?? [],
    stats: seed.stats ?? {},
    tradeable: seed.tradeable ?? true,
    category: seed.category,
    durabilityMax: seed.durabilityMax,
    repairable: seed.durabilityMax !== undefined,
  };
}

function unitBuyPrice(stock: HarthmereVendorStockLine) {
  return Math.max(1, Math.ceil(stock.price / Math.max(1, stock.quantity)));
}

function vendorBuysStockCategory(
  profile: HarthmereVendorProfile,
  stock: HarthmereVendorStockLine
) {
  const seedCategory = HARTHMERE_VENDOR_ITEM_DEFINITIONS[stock.itemId]?.category;
  if (seedCategory) return profile.buys.includes(seedCategory);

  const def = getHarthmereItemDefinition(stock.itemId);
  if (def?.isCraftingMaterial && profile.buys.includes("crafting_material")) {
    return true;
  }
  if (def?.isConsumable && profile.buys.includes("consumable")) return true;
  if (def?.isCurrency && profile.buys.includes("currency")) return true;

  const category = def?.category;
  return category
    ? profile.buys.includes(category as HarthmereVendorCategory)
    : false;
}

export function createHarthmereProductionVendorEntry(
  profile: HarthmereVendorProfile,
  stock: HarthmereVendorStockLine
): HarthmereVendorEntry {
  const buyPrice = unitBuyPrice(stock);
  const seed = HARTHMERE_VENDOR_ITEM_DEFINITIONS[stock.itemId];
  const baseValue =
    seed?.baseValue ??
    getHarthmereItemDefinition(stock.itemId)?.baseValue ??
    buyPrice;
  const sellPrice = vendorBuysStockCategory(profile, stock)
    ? Math.max(0, Math.floor(baseValue * profile.baseBuyModifier))
    : 0;
  return {
    vendorId: profile.vendorId,
    itemId: stock.itemId,
    buyPrice,
    sellPrice,
    stock: stock.quantity,
  };
}

export function listHarthmereProductionVendorEntries() {
  ensureHarthmereProductionVendorCatalog();
  return Object.values(HARTHMERE_VENDOR_CATALOG).flatMap((profile) =>
    profile.stocks.map((stock) =>
      createHarthmereProductionVendorEntry(profile, stock)
    )
  );
}

let registered = false;

export function ensureHarthmereProductionVendorCatalog() {
  if (registered) return;
  ensureHarthmereProductionCraftingCatalogue();
  registered = true;

  for (const [itemId, seed] of Object.entries(
    HARTHMERE_VENDOR_ITEM_DEFINITIONS
  )) {
    if (!getHarthmereItemDefinition(itemId)) {
      registerHarthmereItemDefinition(itemDefinitionFromSeed(itemId, seed));
    }
  }

  for (const profile of Object.values(HARTHMERE_VENDOR_CATALOG)) {
    for (const stock of profile.stocks) {
      registerHarthmereVendorEntry(
        createHarthmereProductionVendorEntry(profile, stock)
      );
    }
  }
}
