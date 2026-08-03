// ---------------------------------------------------------------------------
// HARTHMERE_PLACEABLE_DECOR
//
// Craft + purchase + placement for FURNITURE, STORAGE, LIGHTING, WALL DECOR,
// ENTERTAINMENT, and the existing crafting stations / functional decor.
//
// Flow the player experiences:
//   1. Craft an item at a station, OR buy it from a vendor -> it lands in the
//      inventory as a normal stackable placeable item.
//   2. Later, PLACE it in the world. Two placement modes are supported:
//        a. Owned-property placement (existing home decoration system) — these
//           items are registered as home-decoration definitions so they snap
//           into homes / businesses / owned plots with footprint + overlap
//           rules. (Wired in home_decoration_authority via the decor specs.)
//        b. Free-world placement (this module) — place the item ANYWHERE on the
//           terrain, including land owned by someone else. No property-ownership
//           gate; only world-bounds and object overlap are enforced.
//
// Design rule (matches the block economy bible): anything decorative, processed,
// functional, or furniture-like can be crafted or bought. Raw terrain / natural
// clutter stays non-craftable (that rule is enforced by
// mmo_specialized_blocks_catalogue's natural-block guard).
//
// Dependency direction is deliberately one-way and light: this module imports
// only the inventory-authority registries and the production crafting catalogue
// (for base materials + station ids). home_decoration_authority imports the
// decor SPECS from here (data only), so the heavy building-system graph never
// leaks back into the crafting catalogue.
// ---------------------------------------------------------------------------

// Only the ensure FUNCTION is imported (called at runtime — safe against the
// eval-time circular import created when the crafting catalogue registers this
// module at boot). All station / item ids are hardcoded below as stable
// constants rather than read from the crafting catalogue at module-eval time.
import { ensureHarthmereProductionCraftingCatalogue } from "./mmo_crafting_catalogue";
import {
  getHarthmereCraftingRecipe,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  registerHarthmereCraftingRecipe,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  type HarthmereCraftingRecipe,
  type HarthmereItemDefinition,
  type HarthmereVendorEntry,
} from "./mmo_inventory_authority";

// ---------------------------------------------------------------------------
// Categories, decoration kinds, surfaces.
// ---------------------------------------------------------------------------

// Stable bikkie station ids + existing decor item ids (hardcoded to avoid an
// eval-time circular import with the crafting catalogue).
const STATION_ID_HANDCRAFT = "1534621126189502";
const STATION_ID_WORKBENCH = "1534621126189448";
const STATION_ID_KITCHEN = "1485695172010242";
const STATION_ID_TAILORING_BOOTH = "7539420629350105";
const STATION_ID_ANGLERS_TABLE = "65464304897922";
const STATION_ID_DYE_O_MATIC = "8287780998923911";
const STATION_ID_THERMOLITE = "2443541317223860";
const STATION_ID_THERMOBLASTER = "4537020877769775";
const STATION_ID_ARCADE_MACHINE = "4537020877769721";
const STATION_ID_ALCHEMY_BENCH = "harthmere_station_alchemy_bench";
const ITEM_ID_STORAGE_CABINET = "home_storage_cabinet";
const ITEM_ID_HEARTH_LAMP = "hearth_lamp";
const ITEM_ID_GARDEN_PLANTER_BOX = "garden_planter_box";
const ITEM_ID_SERVICE_COUNTER = "business_service_counter";

export type HarthmereDecorCategory =
  | "station"
  | "furniture"
  | "storage"
  | "lighting"
  | "wall_decor"
  | "entertainment"
  | "garden"
  | "business";

// Mirrors HarthmereHomeDecorationKind (kept as a local string union so this
// module stays decoupled from the heavy home-decoration graph).
export type HarthmereDecorKind =
  | "crafting_station"
  | "storage"
  | "utility"
  | "lighting"
  | "comfort"
  | "garden"
  | "business_counter";

export type HarthmereDecorSurface = "floor" | "wall" | "ceiling" | "surface";

interface DecorFootprint {
  width: number;
  depth: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Station resolution (where each item is crafted).
// ---------------------------------------------------------------------------

export type HarthmereDecorStationKey =
  | "handcraft"
  | "workbench"
  | "tailoringBooth"
  | "thermolite"
  | "thermoblaster"
  | "anglersTable"
  | "alchemyBench";

interface DecorStationInfo {
  stationId: string;
  skillId: string;
}

const DECOR_STATION_RESOLUTION: Record<
  HarthmereDecorStationKey,
  DecorStationInfo
> = {
  handcraft: { stationId: STATION_ID_HANDCRAFT, skillId: "carpentry" },
  workbench: { stationId: STATION_ID_WORKBENCH, skillId: "carpentry" },
  tailoringBooth: {
    stationId: STATION_ID_TAILORING_BOOTH,
    skillId: "tailoring",
  },
  thermolite: { stationId: STATION_ID_THERMOLITE, skillId: "blacksmithing" },
  thermoblaster: {
    stationId: STATION_ID_THERMOBLASTER,
    skillId: "exotic_refining",
  },
  anglersTable: { stationId: STATION_ID_ANGLERS_TABLE, skillId: "fishing" },
  alchemyBench: { stationId: STATION_ID_ALCHEMY_BENCH, skillId: "alchemy" },
};

// ---------------------------------------------------------------------------
// Vendor sell modifier (vendors pay half base value when buying decor back).
// ---------------------------------------------------------------------------

const DECOR_VENDOR_SELL_MODIFIER = 0.5;

// Existing vendors used for decor (extend, don't add new vendor profiles).
const VENDOR_GENERAL_SUPPLY = "river_dock_supply";
const VENDOR_SMITHY = "black_anvil_smithy";
const VENDOR_MAGIC = "wyrm_candle_magic_shop";

// ---------------------------------------------------------------------------
// Spec — single source of truth for craft + purchase + placement.
// ---------------------------------------------------------------------------

export interface HarthmerePlaceableDecorSpec {
  itemId: string;
  displayName: string;
  category: HarthmereDecorCategory;
  /** Decoration kind used by the owned-property placement system. */
  decorationKind: HarthmereDecorKind;
  /** Surface the item attaches to (free-world placement hint). */
  surface: HarthmereDecorSurface;
  footprint: DecorFootprint;
  price: number;
  vendorId: string;
  /** Property uses that accept this item in the owned-property system. */
  allowedPropertyUses: string[];
  functionalEffects?: Record<string, number>;
  // Craft data (omitted for `existing` items whose recipe already ships).
  station?: HarthmereDecorStationKey;
  inputs?: Array<{ itemId: string; count: number }>;
  output?: number;
  /**
   * When true, the item def + craft recipe already exist in another catalogue;
   * we only add a purchase entry and expose it for free-world placement.
   * (Owned-property placement for these already ships in home_decoration.)
   */
  existing?: boolean;
}

function fp(width: number, depth: number, height: number): DecorFootprint {
  return { width, depth, height };
}

const HOME_USES = ["home", "business", "workshop"];
const WORKSHOP_USES = ["home", "business", "workshop", "guild"];

// --- Group A: existing stations + functional decor (purchase + placement). ---
const EXISTING_DECOR_SPECS: HarthmerePlaceableDecorSpec[] = [
  {
    itemId: STATION_ID_WORKBENCH,
    displayName: "Workbench",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 1, 3),
    price: 80,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_KITCHEN,
    displayName: "Kitchen",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 1, 4),
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_TAILORING_BOOTH,
    displayName: "Tailoring Booth",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(4, 1, 3),
    price: 85,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_ANGLERS_TABLE,
    displayName: "Angler's Table",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(2, 2, 3),
    price: 55,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_DYE_O_MATIC,
    displayName: "Dye-O-Matic",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(3, 3, 3),
    price: 140,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_THERMOLITE,
    displayName: "Thermolite",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 2, 3),
    price: 150,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_THERMOBLASTER,
    displayName: "Thermoblaster",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(3, 3, 3),
    price: 280,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: ITEM_ID_STORAGE_CABINET,
    displayName: "Storage Cabinet",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 2),
    price: 70,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    existing: true,
  },
  {
    itemId: ITEM_ID_HEARTH_LAMP,
    displayName: "Hearth Lamp",
    category: "lighting",
    decorationKind: "lighting",
    surface: "floor",
    footprint: fp(1, 1, 1),
    price: 95,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    existing: true,
  },
  {
    itemId: ITEM_ID_GARDEN_PLANTER_BOX,
    displayName: "Garden Planter Box",
    category: "garden",
    decorationKind: "garden",
    surface: "surface",
    footprint: fp(2, 1, 1),
    price: 45,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "farm"],
    existing: true,
  },
  {
    itemId: ITEM_ID_SERVICE_COUNTER,
    displayName: "Service Counter",
    category: "business",
    decorationKind: "business_counter",
    surface: "floor",
    footprint: fp(2, 1, 1),
    price: 95,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["business", "workshop"],
    existing: true,
  },
];

// --- Group B: new furniture / storage / lighting / wall decor / entertainment.
const NEW_DECOR_SPECS: HarthmerePlaceableDecorSpec[] = [
  // Furniture
  {
    itemId: "bench",
    displayName: "Bench",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 50,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2 },
  },
  {
    itemId: "table",
    displayName: "Table",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(2, 2, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "cloth_scrap", count: 1 },
    ],
    price: 55,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "t_table",
    displayName: "T-Table",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(2, 2, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 70,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2 },
  },
  {
    itemId: "wooden_chair",
    displayName: "Wooden Chair",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [{ itemId: "wood_plank", count: 3 }],
    price: 35,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "padded_chair",
    displayName: "Padded Chair",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 3 },
      { itemId: "linen_cloth", count: 1 },
    ],
    price: 50,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 3 },
  },
  {
    itemId: "small_bed",
    displayName: "Small Bed",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(2, 3, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "linen_cloth", count: 3 },
    ],
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 4 },
  },
  {
    itemId: "fancy_bed",
    displayName: "Fancy Bed",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(2, 3, 1),
    station: "tailoringBooth",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "linen_cloth", count: 5 },
      { itemId: "gold_ingot", count: 1 },
    ],
    price: 180,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 6 },
  },
  {
    itemId: "shelf",
    displayName: "Shelf",
    category: "furniture",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 2),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 60,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 6 },
  },
  {
    itemId: "display_shelf",
    displayName: "Display Shelf",
    category: "furniture",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 2),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "simple_glass", count: 1 },
    ],
    price: 85,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 6, customerAppeal: 2 },
  },
  // Harthmere-authored town accents. These are the optimized Blender
  // replacements for the mixed legacy OBJ/third-party interior props. They use
  // the same native inventory/crafting/vendor/placeable path as the common
  // furniture above, so any resident or player property can reuse them.
  {
    itemId: "town_forge_anvil",
    displayName: "Harthmere Forge Anvil",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "thermolite",
    inputs: [
      { itemId: "iron_ingot", count: 5 },
      { itemId: "coal", count: 2 },
    ],
    price: 180,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { safety: 1 },
  },
  {
    itemId: "town_workbench",
    displayName: "Harthmere Workbench",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 7 },
      { itemId: "iron_ingot", count: 2 },
    ],
    price: 120,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { customerAppeal: 1 },
  },
  {
    itemId: "town_tool_rack",
    displayName: "Harthmere Tool Rack",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 2),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 2 },
    ],
    price: 105,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { storageSlots: 6 },
  },
  {
    itemId: "town_rope_rack",
    displayName: "Harthmere Rope Rack",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 2),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "rope", count: 4 },
    ],
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { storageSlots: 5 },
  },
  {
    itemId: "town_produce_crate",
    displayName: "Harthmere Produce Crate",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "rope", count: 1 },
    ],
    price: 65,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 8 },
  },
  {
    itemId: "town_wash_tub",
    displayName: "Harthmere Wash Tub",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 75,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "town_textile_drape",
    displayName: "Harthmere Textile Drape",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(2, 1, 2),
    station: "tailoringBooth",
    inputs: [
      { itemId: "linen_cloth", count: 3 },
      { itemId: "beeswax", count: 1 },
    ],
    price: 75,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2, customerAppeal: 1 },
  },
  {
    itemId: "town_record_stack",
    displayName: "Harthmere Record Stack",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 3 },
      { itemId: "cloth_scrap", count: 2 },
    ],
    price: 55,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 3 },
  },
  {
    itemId: "town_reagent_shelf",
    displayName: "Harthmere Reagent Shelf",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 2),
    station: "alchemyBench",
    inputs: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "simple_glass", count: 2 },
    ],
    price: 115,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { storageSlots: 8, customerAppeal: 1 },
  },
  {
    itemId: "town_ward_focus",
    displayName: "Harthmere Ward Focus",
    category: "wall_decor",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 2, 2),
    station: "alchemyBench",
    inputs: [
      { itemId: "stone_polished", count: 3 },
      { itemId: "crystal_shard", count: 1 },
      { itemId: "beeswax", count: 1 },
    ],
    price: 140,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { lighting: 1, safety: 2 },
  },
  {
    itemId: "town_chapel_pew",
    displayName: "Harthmere Chapel Pew",
    category: "furniture",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(3, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "linen_cloth", count: 1 },
    ],
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 3 },
  },
  {
    itemId: "town_chapel_altar",
    displayName: "Harthmere Chapel Altar",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 2, 2),
    station: "workbench",
    inputs: [
      { itemId: "stone_polished", count: 4 },
      { itemId: "linen_cloth", count: 2 },
      { itemId: "beeswax", count: 1 },
    ],
    price: 150,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2, safety: 1 },
  },
  {
    itemId: "town_grave_tool_rack",
    displayName: "Harthmere Grave Tool Rack",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 2),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 4 },
      { itemId: "iron_ingot", count: 2 },
    ],
    price: 100,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { storageSlots: 5 },
  },
  {
    itemId: "town_firewood_stack",
    displayName: "Harthmere Firewood Stack",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 1),
    station: "handcraft",
    inputs: [
      { itemId: "softwood_log", count: 5 },
      { itemId: "rope", count: 1 },
    ],
    price: 45,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 4, comfort: 1 },
  },
  {
    itemId: "town_cookpot",
    displayName: "Harthmere Cookpot",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 2, 2),
    station: "workbench",
    inputs: [
      { itemId: "iron_ingot", count: 4 },
      { itemId: "wood_plank", count: 2 },
      { itemId: "coal", count: 1 },
    ],
    price: 130,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2 },
  },
  {
    itemId: "town_oven_range",
    displayName: "Harthmere Oven Range",
    category: "furniture",
    decorationKind: "utility",
    surface: "floor",
    footprint: fp(2, 2, 3),
    station: "thermolite",
    inputs: [
      { itemId: "stone_brick", count: 6 },
      { itemId: "iron_ingot", count: 3 },
      { itemId: "coal", count: 2 },
    ],
    price: 210,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 3 },
  },
  // Storage
  {
    itemId: "wood_container",
    displayName: "Wood Container",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 75,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    functionalEffects: { storageSlots: 12 },
  },
  {
    itemId: "treasure_chest",
    displayName: "Treasure Chest",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "iron_ingot", count: 2 },
      { itemId: "old_coin", count: 1 },
    ],
    price: 130,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    functionalEffects: { storageSlots: 18 },
  },
  {
    itemId: "cargo_crate",
    displayName: "Cargo Crate",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "rope", count: 2 },
    ],
    price: 80,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    functionalEffects: { storageSlots: 16 },
  },
  {
    itemId: "lockbox",
    displayName: "Lockbox",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "thermolite",
    inputs: [
      { itemId: "iron_ingot", count: 3 },
      { itemId: "old_coin", count: 1 },
    ],
    price: 150,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    functionalEffects: { storageSlots: 6, safety: 3 },
  },
  {
    itemId: "wardrobe_storage",
    displayName: "Wardrobe",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(2, 1, 3),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "linen_cloth", count: 2 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 130,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    functionalEffects: { storageSlots: 14 },
  },
  // Lighting
  {
    itemId: "wall_lantern",
    displayName: "Wall Lantern",
    category: "lighting",
    decorationKind: "lighting",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "iron_ingot", count: 1 },
      { itemId: "coal", count: 1 },
      { itemId: "simple_glass", count: 1 },
    ],
    price: 65,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { lighting: 1, comfort: 1 },
  },
  {
    itemId: "led_panel",
    displayName: "LED Panel",
    category: "lighting",
    decorationKind: "lighting",
    surface: "ceiling",
    footprint: fp(1, 1, 1),
    station: "thermolite",
    inputs: [
      { itemId: "copper", count: 1 },
      { itemId: "simple_glass", count: 1 },
      { itemId: "crystal_shard", count: 1 },
    ],
    price: 120,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { lighting: 3 },
  },
  {
    itemId: "runic_stone_light",
    displayName: "Runic Stone Light",
    category: "lighting",
    decorationKind: "lighting",
    surface: "floor",
    footprint: fp(1, 1, 2),
    station: "alchemyBench",
    inputs: [
      { itemId: "stone_carved", count: 2 },
      { itemId: "arcane_dust", count: 1 },
    ],
    price: 140,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { lighting: 2, comfort: 2 },
  },
  // Wall decor
  {
    itemId: "small_oak_frame",
    displayName: "Small Oak Frame",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [{ itemId: "wood_plank", count: 2 }],
    price: 25,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "medium_oak_frame",
    displayName: "Medium Oak Frame",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [{ itemId: "wood_plank", count: 3 }],
    price: 35,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "large_oak_frame",
    displayName: "Large Oak Frame",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [{ itemId: "wood_plank", count: 4 }],
    price: 50,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2 },
  },
  {
    itemId: "silver_frame",
    displayName: "Silver Frame",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 2 },
      { itemId: "silver_ingot", count: 1 },
    ],
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 3, customerAppeal: 2 },
  },
  {
    itemId: "gold_frame",
    displayName: "Gold Frame",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 2 },
      { itemId: "gold_ingot", count: 1 },
    ],
    price: 120,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 3, customerAppeal: 3 },
  },
  {
    itemId: "fish_wall_mount",
    displayName: "Fish Wall Mount",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "anglersTable",
    inputs: [
      { itemId: "wood_plank", count: 1 },
      { itemId: "fish", count: 1 },
      { itemId: "tree_resin", count: 1 },
    ],
    price: 75,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 2 },
  },
  {
    itemId: "small_oak_sign",
    displayName: "Small Oak Sign",
    category: "wall_decor",
    decorationKind: "comfort",
    surface: "wall",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 2 },
      { itemId: "coal", count: 1 },
    ],
    price: 30,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  // Entertainment / special decor
  {
    itemId: "record_player",
    displayName: "Record Player",
    category: "entertainment",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 3 },
      { itemId: "copper", count: 1 },
      { itemId: "crystal_shard", count: 1 },
    ],
    price: 160,
    vendorId: VENDOR_MAGIC,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { comfort: 4 },
  },
  {
    itemId: "boombox",
    displayName: "Boombox",
    category: "entertainment",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "thermolite",
    inputs: [
      { itemId: "iron_ingot", count: 2 },
      { itemId: "copper", count: 2 },
      { itemId: "crystal_shard", count: 1 },
    ],
    price: 220,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { comfort: 4 },
  },
  {
    itemId: STATION_ID_ARCADE_MACHINE,
    displayName: "Arcade Machine",
    category: "entertainment",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 2, 1),
    station: "thermolite",
    inputs: [
      { itemId: "wood_plank", count: 6 },
      { itemId: "copper", count: 2 },
      { itemId: "simple_glass", count: 2 },
      { itemId: "crystal_shard", count: 1 },
    ],
    price: 300,
    vendorId: VENDOR_SMITHY,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { comfort: 6, customerAppeal: 5 },
  },
  {
    itemId: "mailbox",
    displayName: "Mailbox",
    category: "entertainment",
    decorationKind: "comfort",
    surface: "floor",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 3 },
      { itemId: "iron_ingot", count: 1 },
    ],
    price: 65,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
  {
    itemId: "oak_tray",
    displayName: "Oak Tray",
    category: "entertainment",
    decorationKind: "comfort",
    surface: "surface",
    footprint: fp(1, 1, 1),
    station: "workbench",
    inputs: [
      { itemId: "wood_plank", count: 2 },
      { itemId: "tree_resin", count: 1 },
    ],
    price: 25,
    vendorId: VENDOR_GENERAL_SUPPLY,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
];

export const HARTHMERE_PLACEABLE_DECOR_SPECS: HarthmerePlaceableDecorSpec[] = [
  ...EXISTING_DECOR_SPECS,
  ...NEW_DECOR_SPECS,
];

/** Decor specs that should be exposed by the owned-property decoration system
 * (i.e. the NEW items; existing stations/decor are already registered there). */
export const HARTHMERE_NEW_PLACEABLE_DECOR_SPECS: HarthmerePlaceableDecorSpec[] =
  NEW_DECOR_SPECS;

// ---------------------------------------------------------------------------
// Extra materials needed by decor recipes (registered only if absent).
// ---------------------------------------------------------------------------

const DECOR_MATERIAL_SEEDS: Array<{
  itemId: string;
  displayName: string;
  baseValue: number;
}> = [
  { itemId: "cloth_scrap", displayName: "Cloth Scrap", baseValue: 2 },
  { itemId: "rope", displayName: "Rope", baseValue: 3 },
  { itemId: "fish", displayName: "Fish", baseValue: 5 },
];

// ---------------------------------------------------------------------------
// Derivation.
// ---------------------------------------------------------------------------

export function placeableDecorRecipeId(itemId: string): string {
  return `harthmere_decor_place_${itemId}`;
}

type DecorObjectKind = "station" | "furniture" | "garden" | "fixture";
type DecorPhysicalForm =
  | "crafting_station"
  | "furniture"
  | "storage"
  | "light"
  | "garden_bed"
  | "counter"
  | "device";

const DECOR_VISUAL: Record<
  HarthmereDecorCategory,
  { objectKind: DecorObjectKind; physicalForm: DecorPhysicalForm }
> = {
  station: { objectKind: "station", physicalForm: "crafting_station" },
  furniture: { objectKind: "furniture", physicalForm: "furniture" },
  storage: { objectKind: "furniture", physicalForm: "storage" },
  lighting: { objectKind: "fixture", physicalForm: "light" },
  wall_decor: { objectKind: "fixture", physicalForm: "furniture" },
  entertainment: { objectKind: "fixture", physicalForm: "device" },
  garden: { objectKind: "garden", physicalForm: "garden_bed" },
  business: { objectKind: "furniture", physicalForm: "counter" },
};

function decorItemDefinition(
  spec: HarthmerePlaceableDecorSpec
): HarthmereItemDefinition {
  return {
    itemId: spec.itemId,
    displayName: spec.displayName,
    description: `${spec.displayName} — craft or buy it, then place it on owned property or anywhere on the terrain.`,
    maxStackSize: 20,
    baseValue: spec.price,
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
    category: spec.category === "station" ? "crafting station" : spec.category,
    objectMetadata: {
      objectKind: DECOR_VISUAL[spec.category].objectKind,
      physicalForm: DECOR_VISUAL[spec.category].physicalForm,
      sizeVoxels: spec.footprint,
      sizeLabel: `${spec.footprint.width}x${spec.footprint.depth}x${spec.footprint.height}`,
      visualDescription: `${spec.displayName} placeable ${spec.category.replace(/_/g, " ")}`,
      craftingRoles: ["custom building", "home", "business decor"],
      businessUse: ["custom_home_property_development"],
      handling: [
        "place on owned home or business property",
        "or place freely anywhere on the terrain",
        `attaches to: ${spec.surface}`,
      ],
      procedural: {
        canGenerateWithVoxels: true,
        suggestedShape: `${spec.displayName} ${spec.category.replace(/_/g, " ")}`,
        palette: ["warm wood", "dark metal", "soft accents"],
        emission: spec.category === "lighting" ? "soft warm light" : "none",
      },
    },
  };
}

function decorCraftingRecipe(
  spec: HarthmerePlaceableDecorSpec
): HarthmereCraftingRecipe | undefined {
  if (!spec.station || !spec.inputs) return undefined;
  const station = DECOR_STATION_RESOLUTION[spec.station];
  return {
    recipeId: placeableDecorRecipeId(spec.itemId),
    outputItemId: spec.itemId,
    outputCount: spec.output ?? 1,
    inputs: spec.inputs,
    requiredLevel: 1,
    requiredSkillId: station.skillId,
    requiredSkillLevel: 1,
    professionId: station.skillId,
    requiredProfessionLevel: 1,
    requiredStationId: station.stationId,
    craftingTimeMs: 2500,
    xpReward: 20,
    recipeTier: 1,
    materialTier: 1,
    qualityFloor: 40,
    businessTypeId: "custom_home_property_development",
    workOrderTag: "placeable_decor",
  };
}

function decorVendorEntry(
  spec: HarthmerePlaceableDecorSpec
): HarthmereVendorEntry {
  return {
    vendorId: spec.vendorId,
    itemId: spec.itemId,
    buyPrice: spec.price,
    sellPrice: Math.max(1, Math.floor(spec.price * DECOR_VENDOR_SELL_MODIFIER)),
    stock: -1,
  };
}

// ---------------------------------------------------------------------------
// Registration.
// ---------------------------------------------------------------------------

let registered = false;

export function ensureHarthmerePlaceableDecorCatalogue(): void {
  if (registered) return;
  ensureHarthmereProductionCraftingCatalogue();
  registered = true;

  for (const seed of DECOR_MATERIAL_SEEDS) {
    if (getHarthmereItemDefinition(seed.itemId)) continue;
    registerHarthmereItemDefinition({
      itemId: seed.itemId,
      displayName: seed.displayName,
      description: `${seed.displayName} — a crafting material.`,
      maxStackSize: 999,
      baseValue: seed.baseValue,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: true,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: true,
      category: "crafting_material",
    });
  }

  for (const spec of HARTHMERE_PLACEABLE_DECOR_SPECS) {
    if (!spec.existing && !getHarthmereItemDefinition(spec.itemId)) {
      registerHarthmereItemDefinition(decorItemDefinition(spec));
    }
    if (!spec.existing) {
      const recipe = decorCraftingRecipe(spec);
      if (recipe && !getHarthmereCraftingRecipe(recipe.recipeId)) {
        registerHarthmereCraftingRecipe(recipe);
      }
    }
    if (!getHarthmereVendorEntry(spec.vendorId, spec.itemId)) {
      registerHarthmereVendorEntry(decorVendorEntry(spec));
    }
  }
}

/** Item ids for every placeable decor item this catalogue makes available. */
export function harthmerePlaceableDecorItemIds(): string[] {
  return HARTHMERE_PLACEABLE_DECOR_SPECS.map((spec) => spec.itemId);
}

export function getHarthmerePlaceableDecorSpec(
  itemId: string
): HarthmerePlaceableDecorSpec | undefined {
  return HARTHMERE_PLACEABLE_DECOR_SPECS.find((spec) => spec.itemId === itemId);
}

// ===========================================================================
// FREE-WORLD PLACEMENT
//
// Place a crafted/bought placeable item ANYWHERE on the terrain. Unlike the
// owned-property decoration system, there is NO property-ownership gate — a
// player may place on open terrain or on land owned by someone else. Only world
// bounds and object-vs-object overlap are enforced. The reducer is pure: it
// returns a new state plus the inventory delta to apply (item consumed on
// place, returned on remove).
// ===========================================================================

export const HARTHMERE_PLACEABLE_WORLD_VERSION =
  "harthmere-placeable-world" as const;

/** Max absolute world coordinate accepted for a placed object. */
export const HARTHMERE_PLACEABLE_WORLD_MAX_ABS_COORD = 1_000_000;

export type HarthmerePlaceableWorldRotation = 0 | 90 | 180 | 270;

export interface HarthmerePlaceableWorldPosition {
  x: number;
  y: number;
  z: number;
}

export interface HarthmerePlacedWorldObject {
  objectId: string;
  itemId: string;
  /** Actor who placed it (used to authorize move/remove). */
  ownerId: string;
  position: HarthmerePlaceableWorldPosition;
  rotationDegrees: HarthmerePlaceableWorldRotation;
  footprint: DecorFootprint;
  surface: HarthmereDecorSurface;
  placedAtMs: number;
}

export interface HarthmerePlaceableWorldState {
  placed: Record<string, HarthmerePlacedWorldObject>;
  nextObjectNumber: number;
  appliedRequestIds: Record<string, number>;
}

export type HarthmerePlaceableWorldOperation =
  "place_object" | "move_object" | "remove_object";

export interface HarthmerePlaceableWorldMutationRequest {
  requestId: string;
  actorId: string;
  operation: HarthmerePlaceableWorldOperation;
  nowMs: number;
  itemId?: string;
  objectId?: string;
  position?: Partial<HarthmerePlaceableWorldPosition>;
  rotationDegrees?: number;
}

export interface HarthmerePlaceableWorldMutationContext {
  /** itemId -> count the actor currently holds. */
  actorInventoryItems: Record<string, number>;
  /** When true, the actor may move/remove objects placed by others (e.g. an admin or the landowner). Defaults to false. */
  allowEditOthers?: boolean;
}

export interface HarthmerePlaceableWorldMutationResult {
  ok: boolean;
  errors: string[];
  state: HarthmerePlaceableWorldState;
  /** Inventory delta to apply (server-computed). */
  itemDeltas: Record<string, number>;
  placedObjectId?: string;
}

export function defaultHarthmerePlaceableWorldState(): HarthmerePlaceableWorldState {
  return { placed: {}, nextObjectNumber: 1, appliedRequestIds: {} };
}

/** Defensively normalize a parsed/persisted free-world placement state. */
export function normalizeHarthmerePlaceableWorldState(
  parsed: unknown
): HarthmerePlaceableWorldState {
  const base = defaultHarthmerePlaceableWorldState();
  if (!parsed || typeof parsed !== "object") {
    return base;
  }
  const p = parsed as Partial<HarthmerePlaceableWorldState>;
  const placed: Record<string, HarthmerePlacedWorldObject> = {};
  for (const [id, record] of Object.entries(p.placed ?? {})) {
    const r = record as Partial<HarthmerePlacedWorldObject> | undefined;
    if (!r || !r.objectId || !r.itemId || !r.position) {
      continue;
    }
    const footprint = r.footprint ?? fp(1, 1, 1);
    placed[id] = {
      objectId: String(r.objectId),
      itemId: String(r.itemId),
      ownerId: String(r.ownerId ?? ""),
      position: {
        x: Number(r.position.x) || 0,
        y: Number(r.position.y) || 0,
        z: Number(r.position.z) || 0,
      },
      rotationDegrees: clampRotation(r.rotationDegrees),
      footprint: fp(
        Math.max(1, Math.floor(Number(footprint.width) || 1)),
        Math.max(1, Math.floor(Number(footprint.depth) || 1)),
        Math.max(1, Math.floor(Number(footprint.height) || 1))
      ),
      surface: r.surface ?? "floor",
      placedAtMs: Number(r.placedAtMs) || 0,
    };
  }
  return {
    placed,
    nextObjectNumber: Math.max(1, Math.floor(Number(p.nextObjectNumber) || 1)),
    appliedRequestIds: { ...(p.appliedRequestIds ?? {}) },
  };
}

function clampRotation(value: unknown): HarthmerePlaceableWorldRotation {
  const r = Math.round(Number(value) || 0);
  return r === 90 || r === 180 || r === 270 ? r : 0;
}

function positionInBounds(
  position: Partial<HarthmerePlaceableWorldPosition> | undefined
): position is HarthmerePlaceableWorldPosition {
  if (!position) return false;
  for (const c of [position.x, position.y, position.z]) {
    const n = Number(c);
    if (
      !Number.isFinite(n) ||
      Math.abs(n) > HARTHMERE_PLACEABLE_WORLD_MAX_ABS_COORD
    ) {
      return false;
    }
  }
  return true;
}

function rotatedDecorFootprint(
  footprint: DecorFootprint,
  rotation: HarthmerePlaceableWorldRotation
): DecorFootprint {
  return rotation === 90 || rotation === 270
    ? {
        width: footprint.depth,
        depth: footprint.width,
        height: footprint.height,
      }
    : footprint;
}

function aabbOverlap(
  a: { position: HarthmerePlaceableWorldPosition; footprint: DecorFootprint },
  b: { position: HarthmerePlaceableWorldPosition; footprint: DecorFootprint }
): boolean {
  return (
    a.position.x < b.position.x + b.footprint.width &&
    a.position.x + a.footprint.width > b.position.x &&
    a.position.z < b.position.z + b.footprint.depth &&
    a.position.z + a.footprint.depth > b.position.z &&
    a.position.y < b.position.y + b.footprint.height &&
    a.position.y + a.footprint.height > b.position.y
  );
}

function cloneWorldState(
  state: HarthmerePlaceableWorldState
): HarthmerePlaceableWorldState {
  const placed: Record<string, HarthmerePlacedWorldObject> = {};
  for (const [id, record] of Object.entries(state.placed ?? {})) {
    placed[id] = {
      ...record,
      position: { ...record.position },
      footprint: { ...record.footprint },
    };
  }
  return {
    placed,
    nextObjectNumber: Math.max(
      1,
      Math.floor(Number(state.nextObjectNumber) || 1)
    ),
    appliedRequestIds: { ...(state.appliedRequestIds ?? {}) },
  };
}

function worldFail(
  state: HarthmerePlaceableWorldState,
  error: string
): HarthmerePlaceableWorldMutationResult {
  return { ok: false, errors: [error], state, itemDeltas: {} };
}

/** AABB for a placed record, using its BASE footprint rotated to its rotation. */
function placedRecordAabb(record: HarthmerePlacedWorldObject) {
  return {
    position: record.position,
    footprint: rotatedDecorFootprint(record.footprint, record.rotationDegrees),
  };
}

function overlapsExisting(
  state: HarthmerePlaceableWorldState,
  candidate: {
    position: HarthmerePlaceableWorldPosition;
    footprint: DecorFootprint;
  },
  ignoreObjectId?: string
): boolean {
  for (const [id, record] of Object.entries(state.placed)) {
    if (id === ignoreObjectId) continue;
    if (aabbOverlap(candidate, placedRecordAabb(record))) return true;
  }
  return false;
}

/**
 * Free-world placement reducer. Place/move/remove a placeable item on the
 * terrain with no property-ownership gate. Idempotent on requestId.
 */
export function reduceHarthmerePlaceableWorldMutation(
  current: HarthmerePlaceableWorldState,
  request: HarthmerePlaceableWorldMutationRequest,
  context: HarthmerePlaceableWorldMutationContext
): HarthmerePlaceableWorldMutationResult {
  ensureHarthmerePlaceableDecorCatalogue();
  const state = cloneWorldState(current);

  if (state.appliedRequestIds[request.requestId] !== undefined) {
    return { ok: true, errors: [], state, itemDeltas: {} };
  }

  switch (request.operation) {
    case "place_object": {
      const itemId = request.itemId;
      if (!itemId) return worldFail(state, "missing_item_id");
      const spec = getHarthmerePlaceableDecorSpec(itemId);
      if (!spec) return worldFail(state, "item_not_placeable");
      if (!positionInBounds(request.position)) {
        return worldFail(state, "invalid_position");
      }
      if ((context.actorInventoryItems[itemId] ?? 0) <= 0) {
        return worldFail(state, "missing_placeable_item");
      }
      const rotationDegrees = clampRotation(request.rotationDegrees);
      const rotatedFootprint = rotatedDecorFootprint(
        spec.footprint,
        rotationDegrees
      );
      if (
        overlapsExisting(state, {
          position: request.position,
          footprint: rotatedFootprint,
        })
      ) {
        return worldFail(state, "placement_overlaps_existing_object");
      }
      const objectId = `world_obj_${state.nextObjectNumber}`;
      state.placed[objectId] = {
        objectId,
        itemId,
        ownerId: request.actorId,
        position: { ...request.position },
        rotationDegrees,
        footprint: spec.footprint, // BASE footprint; rotation applied on demand
        surface: spec.surface,
        placedAtMs: request.nowMs,
      };
      state.nextObjectNumber += 1;
      state.appliedRequestIds[request.requestId] = request.nowMs;
      return {
        ok: true,
        errors: [],
        state,
        itemDeltas: { [itemId]: -1 },
        placedObjectId: objectId,
      };
    }

    case "move_object": {
      const objectId = request.objectId;
      if (!objectId) return worldFail(state, "missing_object_id");
      const record = state.placed[objectId];
      if (!record) return worldFail(state, "unknown_object");
      if (record.ownerId !== request.actorId && !context.allowEditOthers) {
        return worldFail(state, "not_object_owner");
      }
      if (!positionInBounds(request.position)) {
        return worldFail(state, "invalid_position");
      }
      const rotationDegrees =
        request.rotationDegrees !== undefined
          ? clampRotation(request.rotationDegrees)
          : record.rotationDegrees;
      // record.footprint is the BASE footprint; rotate it for the overlap test.
      const rotatedFootprint = rotatedDecorFootprint(
        record.footprint,
        rotationDegrees
      );
      if (
        overlapsExisting(
          state,
          { position: request.position, footprint: rotatedFootprint },
          objectId
        )
      ) {
        return worldFail(state, "placement_overlaps_existing_object");
      }
      state.placed[objectId] = {
        ...record,
        position: { ...request.position },
        rotationDegrees,
      };
      state.appliedRequestIds[request.requestId] = request.nowMs;
      return { ok: true, errors: [], state, itemDeltas: {} };
    }

    case "remove_object": {
      const objectId = request.objectId;
      if (!objectId) return worldFail(state, "missing_object_id");
      const record = state.placed[objectId];
      if (!record) return worldFail(state, "unknown_object");
      if (record.ownerId !== request.actorId && !context.allowEditOthers) {
        return worldFail(state, "not_object_owner");
      }
      delete state.placed[objectId];
      state.appliedRequestIds[request.requestId] = request.nowMs;
      // Returning the item to the placer's inventory.
      return {
        ok: true,
        errors: [],
        state,
        itemDeltas: { [record.itemId]: 1 },
      };
    }

    default:
      return worldFail(state, "unknown_operation");
  }
}
