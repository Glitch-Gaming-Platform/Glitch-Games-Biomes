// ---------------------------------------------------------------------------
// HARTHMERE_PLACEABLE_DECOR_V1
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
//           rules. (Wired in home_decoration_authority_v1 via the decor specs.)
//        b. Free-world placement (this module) — place the item ANYWHERE on the
//           terrain, including land owned by someone else. No property-ownership
//           gate; only world-bounds and object overlap are enforced.
//
// Design rule (matches the block economy bible): anything decorative, processed,
// functional, or furniture-like can be crafted or bought. Raw terrain / natural
// clutter stays non-craftable (that rule is enforced by
// mmo_specialized_blocks_catalogue_v1's natural-block guard).
//
// Dependency direction is deliberately one-way and light: this module imports
// only the inventory-authority registries and the production crafting catalogue
// (for base materials + station ids). home_decoration_authority_v1 imports the
// decor SPECS from here (data only), so the heavy building-system graph never
// leaks back into the crafting catalogue.
// ---------------------------------------------------------------------------

// Only the ensure FUNCTION is imported (called at runtime — safe against the
// eval-time circular import created when the crafting catalogue registers this
// module at boot). All station / item ids are hardcoded below as stable
// constants rather than read from the crafting catalogue at module-eval time.
import { ensureHarthmereProductionCraftingCatalogueV1 } from "./mmo_crafting_catalogue_v1";
import {
  getHarthmereCraftingRecipeV1,
  getHarthmereItemDefinitionV1,
  getHarthmereVendorEntryV1,
  registerHarthmereCraftingRecipeV1,
  registerHarthmereItemDefinitionV1,
  registerHarthmereVendorEntryV1,
  type HarthmereCraftingRecipeV1,
  type HarthmereItemDefinitionV1,
  type HarthmereVendorEntryV1,
} from "./mmo_inventory_authority_v1";

// ---------------------------------------------------------------------------
// Categories, decoration kinds, surfaces.
// ---------------------------------------------------------------------------

// Stable bikkie station ids + existing decor item ids (hardcoded to avoid an
// eval-time circular import with the crafting catalogue).
const STATION_ID_HANDCRAFT_V1 = "1534621126189502";
const STATION_ID_WORKBENCH_V1 = "1534621126189448";
const STATION_ID_KITCHEN_V1 = "1485695172010242";
const STATION_ID_TAILORING_BOOTH_V1 = "7539420629350105";
const STATION_ID_ANGLERS_TABLE_V1 = "65464304897922";
const STATION_ID_DYE_O_MATIC_V1 = "8287780998923911";
const STATION_ID_THERMOLITE_V1 = "2443541317223860";
const STATION_ID_THERMOBLASTER_V1 = "4537020877769775";
const STATION_ID_ARCADE_MACHINE_V1 = "4537020877769721";
const STATION_ID_ALCHEMY_BENCH_V1 = "harthmere_station_alchemy_bench";
const ITEM_ID_STORAGE_CABINET_V1 = "home_storage_cabinet";
const ITEM_ID_HEARTH_LAMP_V1 = "hearth_lamp";
const ITEM_ID_GARDEN_PLANTER_BOX_V1 = "garden_planter_box";
const ITEM_ID_SERVICE_COUNTER_V1 = "business_service_counter";

export type HarthmereDecorCategoryV1 =
  | "station"
  | "furniture"
  | "storage"
  | "lighting"
  | "wall_decor"
  | "entertainment"
  | "garden"
  | "business";

// Mirrors HarthmereHomeDecorationKindV1 (kept as a local string union so this
// module stays decoupled from the heavy home-decoration graph).
export type HarthmereDecorKindV1 =
  | "crafting_station"
  | "storage"
  | "utility"
  | "lighting"
  | "comfort"
  | "garden"
  | "business_counter";

export type HarthmereDecorSurfaceV1 = "floor" | "wall" | "ceiling" | "surface";

interface DecorFootprintV1 {
  width: number;
  depth: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Station resolution (where each item is crafted).
// ---------------------------------------------------------------------------

export type HarthmereDecorStationKeyV1 =
  | "handcraft"
  | "workbench"
  | "tailoringBooth"
  | "thermolite"
  | "thermoblaster"
  | "anglersTable"
  | "alchemyBench";

interface DecorStationInfoV1 {
  stationId: string;
  skillId: string;
}

const DECOR_STATION_RESOLUTION_V1: Record<
  HarthmereDecorStationKeyV1,
  DecorStationInfoV1
> = {
  handcraft: { stationId: STATION_ID_HANDCRAFT_V1, skillId: "carpentry" },
  workbench: { stationId: STATION_ID_WORKBENCH_V1, skillId: "carpentry" },
  tailoringBooth: { stationId: STATION_ID_TAILORING_BOOTH_V1, skillId: "tailoring" },
  thermolite: { stationId: STATION_ID_THERMOLITE_V1, skillId: "blacksmithing" },
  thermoblaster: { stationId: STATION_ID_THERMOBLASTER_V1, skillId: "exotic_refining" },
  anglersTable: { stationId: STATION_ID_ANGLERS_TABLE_V1, skillId: "fishing" },
  alchemyBench: { stationId: STATION_ID_ALCHEMY_BENCH_V1, skillId: "alchemy" },
};

// ---------------------------------------------------------------------------
// Vendor sell modifier (vendors pay half base value when buying decor back).
// ---------------------------------------------------------------------------

const DECOR_VENDOR_SELL_MODIFIER_V1 = 0.5;

// Existing vendors used for decor (extend, don't add new vendor profiles).
const VENDOR_GENERAL_SUPPLY_V1 = "river_dock_supply";
const VENDOR_SMITHY_V1 = "black_anvil_smithy";
const VENDOR_MAGIC_V1 = "wyrm_candle_magic_shop";

// ---------------------------------------------------------------------------
// Spec — single source of truth for craft + purchase + placement.
// ---------------------------------------------------------------------------

export interface HarthmerePlaceableDecorSpecV1 {
  itemId: string;
  displayName: string;
  category: HarthmereDecorCategoryV1;
  /** Decoration kind used by the owned-property placement system. */
  decorationKind: HarthmereDecorKindV1;
  /** Surface the item attaches to (free-world placement hint). */
  surface: HarthmereDecorSurfaceV1;
  footprint: DecorFootprintV1;
  price: number;
  vendorId: string;
  /** Property uses that accept this item in the owned-property system. */
  allowedPropertyUses: string[];
  functionalEffects?: Record<string, number>;
  // Craft data (omitted for `existing` items whose recipe already ships).
  station?: HarthmereDecorStationKeyV1;
  inputs?: Array<{ itemId: string; count: number }>;
  output?: number;
  /**
   * When true, the item def + craft recipe already exist in another catalogue;
   * we only add a purchase entry and expose it for free-world placement.
   * (Owned-property placement for these already ships in home_decoration.)
   */
  existing?: boolean;
}

function fp(width: number, depth: number, height: number): DecorFootprintV1 {
  return { width, depth, height };
}

const HOME_USES = ["home", "business", "workshop"];
const WORKSHOP_USES = ["home", "business", "workshop", "guild"];

// --- Group A: existing stations + functional decor (purchase + placement). ---
const EXISTING_DECOR_SPECS_V1: HarthmerePlaceableDecorSpecV1[] = [
  {
    itemId: STATION_ID_WORKBENCH_V1,
    displayName: "Workbench",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 1, 3),
    price: 80,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_KITCHEN_V1,
    displayName: "Kitchen",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 1, 4),
    price: 90,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_TAILORING_BOOTH_V1,
    displayName: "Tailoring Booth",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(4, 1, 3),
    price: 85,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_ANGLERS_TABLE_V1,
    displayName: "Angler's Table",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(2, 2, 3),
    price: 55,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_DYE_O_MATIC_V1,
    displayName: "Dye-O-Matic",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(3, 3, 3),
    price: 140,
    vendorId: VENDOR_MAGIC_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_THERMOLITE_V1,
    displayName: "Thermolite",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(1, 2, 3),
    price: 150,
    vendorId: VENDOR_SMITHY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: STATION_ID_THERMOBLASTER_V1,
    displayName: "Thermoblaster",
    category: "station",
    decorationKind: "crafting_station",
    surface: "floor",
    footprint: fp(3, 3, 3),
    price: 280,
    vendorId: VENDOR_SMITHY_V1,
    allowedPropertyUses: HOME_USES,
    existing: true,
  },
  {
    itemId: ITEM_ID_STORAGE_CABINET_V1,
    displayName: "Storage Cabinet",
    category: "storage",
    decorationKind: "storage",
    surface: "floor",
    footprint: fp(1, 1, 2),
    price: 70,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    existing: true,
  },
  {
    itemId: ITEM_ID_HEARTH_LAMP_V1,
    displayName: "Hearth Lamp",
    category: "lighting",
    decorationKind: "lighting",
    surface: "floor",
    footprint: fp(1, 1, 1),
    price: 95,
    vendorId: VENDOR_MAGIC_V1,
    allowedPropertyUses: WORKSHOP_USES,
    existing: true,
  },
  {
    itemId: ITEM_ID_GARDEN_PLANTER_BOX_V1,
    displayName: "Garden Planter Box",
    category: "garden",
    decorationKind: "garden",
    surface: "surface",
    footprint: fp(2, 1, 1),
    price: 45,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: ["home", "business", "farm"],
    existing: true,
  },
  {
    itemId: ITEM_ID_SERVICE_COUNTER_V1,
    displayName: "Service Counter",
    category: "business",
    decorationKind: "business_counter",
    surface: "floor",
    footprint: fp(2, 1, 1),
    price: 95,
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: ["business", "workshop"],
    existing: true,
  },
];

// --- Group B: new furniture / storage / lighting / wall decor / entertainment.
const NEW_DECOR_SPECS_V1: HarthmerePlaceableDecorSpecV1[] = [
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { storageSlots: 6, customerAppeal: 2 },
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_SMITHY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_MAGIC_V1,
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
    vendorId: VENDOR_MAGIC_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_MAGIC_V1,
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
    vendorId: VENDOR_SMITHY_V1,
    allowedPropertyUses: WORKSHOP_USES,
    functionalEffects: { comfort: 4 },
  },
  {
    itemId: STATION_ID_ARCADE_MACHINE_V1,
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
    vendorId: VENDOR_SMITHY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
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
    vendorId: VENDOR_GENERAL_SUPPLY_V1,
    allowedPropertyUses: HOME_USES,
    functionalEffects: { comfort: 1 },
  },
];

export const HARTHMERE_PLACEABLE_DECOR_SPECS_V1: HarthmerePlaceableDecorSpecV1[] =
  [...EXISTING_DECOR_SPECS_V1, ...NEW_DECOR_SPECS_V1];

/** Decor specs that should be exposed by the owned-property decoration system
 * (i.e. the NEW items; existing stations/decor are already registered there). */
export const HARTHMERE_NEW_PLACEABLE_DECOR_SPECS_V1: HarthmerePlaceableDecorSpecV1[] =
  NEW_DECOR_SPECS_V1;

// ---------------------------------------------------------------------------
// Extra materials needed by decor recipes (registered only if absent).
// ---------------------------------------------------------------------------

const DECOR_MATERIAL_SEEDS_V1: Array<{
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

export function placeableDecorRecipeIdV1(itemId: string): string {
  return `harthmere_decor_place_${itemId}`;
}

type DecorObjectKindV1 =
  | "station"
  | "furniture"
  | "garden"
  | "fixture";
type DecorPhysicalFormV1 =
  | "crafting_station"
  | "furniture"
  | "storage"
  | "light"
  | "garden_bed"
  | "counter"
  | "device";

const DECOR_VISUAL_V1: Record<
  HarthmereDecorCategoryV1,
  { objectKind: DecorObjectKindV1; physicalForm: DecorPhysicalFormV1 }
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

function decorItemDefinitionV1(
  spec: HarthmerePlaceableDecorSpecV1
): HarthmereItemDefinitionV1 {
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
      objectKind: DECOR_VISUAL_V1[spec.category].objectKind,
      physicalForm: DECOR_VISUAL_V1[spec.category].physicalForm,
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

function decorCraftingRecipeV1(
  spec: HarthmerePlaceableDecorSpecV1
): HarthmereCraftingRecipeV1 | undefined {
  if (!spec.station || !spec.inputs) return undefined;
  const station = DECOR_STATION_RESOLUTION_V1[spec.station];
  return {
    recipeId: placeableDecorRecipeIdV1(spec.itemId),
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

function decorVendorEntryV1(
  spec: HarthmerePlaceableDecorSpecV1
): HarthmereVendorEntryV1 {
  return {
    vendorId: spec.vendorId,
    itemId: spec.itemId,
    buyPrice: spec.price,
    sellPrice: Math.max(1, Math.floor(spec.price * DECOR_VENDOR_SELL_MODIFIER_V1)),
    stock: -1,
  };
}

// ---------------------------------------------------------------------------
// Registration.
// ---------------------------------------------------------------------------

let registered = false;

export function ensureHarthmerePlaceableDecorCatalogueV1(): void {
  if (registered) return;
  ensureHarthmereProductionCraftingCatalogueV1();
  registered = true;

  for (const seed of DECOR_MATERIAL_SEEDS_V1) {
    if (getHarthmereItemDefinitionV1(seed.itemId)) continue;
    registerHarthmereItemDefinitionV1({
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

  for (const spec of HARTHMERE_PLACEABLE_DECOR_SPECS_V1) {
    if (!spec.existing && !getHarthmereItemDefinitionV1(spec.itemId)) {
      registerHarthmereItemDefinitionV1(decorItemDefinitionV1(spec));
    }
    if (!spec.existing) {
      const recipe = decorCraftingRecipeV1(spec);
      if (recipe && !getHarthmereCraftingRecipeV1(recipe.recipeId)) {
        registerHarthmereCraftingRecipeV1(recipe);
      }
    }
    if (!getHarthmereVendorEntryV1(spec.vendorId, spec.itemId)) {
      registerHarthmereVendorEntryV1(decorVendorEntryV1(spec));
    }
  }
}

/** Item ids for every placeable decor item this catalogue makes available. */
export function harthmerePlaceableDecorItemIdsV1(): string[] {
  return HARTHMERE_PLACEABLE_DECOR_SPECS_V1.map((spec) => spec.itemId);
}

export function getHarthmerePlaceableDecorSpecV1(
  itemId: string
): HarthmerePlaceableDecorSpecV1 | undefined {
  return HARTHMERE_PLACEABLE_DECOR_SPECS_V1.find((spec) => spec.itemId === itemId);
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

export const HARTHMERE_PLACEABLE_WORLD_VERSION_V1 =
  "harthmere-placeable-world-v1" as const;

/** Max absolute world coordinate accepted for a placed object. */
export const HARTHMERE_PLACEABLE_WORLD_MAX_ABS_COORD_V1 = 1_000_000;

export type HarthmerePlaceableWorldRotationV1 = 0 | 90 | 180 | 270;

export interface HarthmerePlaceableWorldPositionV1 {
  x: number;
  y: number;
  z: number;
}

export interface HarthmerePlacedWorldObjectV1 {
  objectId: string;
  itemId: string;
  /** Actor who placed it (used to authorize move/remove). */
  ownerId: string;
  position: HarthmerePlaceableWorldPositionV1;
  rotationDegrees: HarthmerePlaceableWorldRotationV1;
  footprint: DecorFootprintV1;
  surface: HarthmereDecorSurfaceV1;
  placedAtMs: number;
}

export interface HarthmerePlaceableWorldStateV1 {
  placed: Record<string, HarthmerePlacedWorldObjectV1>;
  nextObjectNumber: number;
  appliedRequestIds: Record<string, number>;
}

export type HarthmerePlaceableWorldOperationV1 =
  | "place_object"
  | "move_object"
  | "remove_object";

export interface HarthmerePlaceableWorldMutationRequestV1 {
  requestId: string;
  actorId: string;
  operation: HarthmerePlaceableWorldOperationV1;
  nowMs: number;
  itemId?: string;
  objectId?: string;
  position?: Partial<HarthmerePlaceableWorldPositionV1>;
  rotationDegrees?: number;
}

export interface HarthmerePlaceableWorldMutationContextV1 {
  /** itemId -> count the actor currently holds. */
  actorInventoryItems: Record<string, number>;
  /** When true, the actor may move/remove objects placed by others (e.g. an admin or the landowner). Defaults to false. */
  allowEditOthers?: boolean;
}

export interface HarthmerePlaceableWorldMutationResultV1 {
  ok: boolean;
  errors: string[];
  state: HarthmerePlaceableWorldStateV1;
  /** Inventory delta to apply (server-computed). */
  itemDeltas: Record<string, number>;
  placedObjectId?: string;
}

export function defaultHarthmerePlaceableWorldStateV1(): HarthmerePlaceableWorldStateV1 {
  return { placed: {}, nextObjectNumber: 1, appliedRequestIds: {} };
}

/** Defensively normalize a parsed/persisted free-world placement state. */
export function normalizeHarthmerePlaceableWorldStateV1(
  parsed: unknown
): HarthmerePlaceableWorldStateV1 {
  const base = defaultHarthmerePlaceableWorldStateV1();
  if (!parsed || typeof parsed !== "object") {
    return base;
  }
  const p = parsed as Partial<HarthmerePlaceableWorldStateV1>;
  const placed: Record<string, HarthmerePlacedWorldObjectV1> = {};
  for (const [id, record] of Object.entries(p.placed ?? {})) {
    const r = record as Partial<HarthmerePlacedWorldObjectV1> | undefined;
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
      rotationDegrees: clampRotationV1(r.rotationDegrees),
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

function clampRotationV1(value: unknown): HarthmerePlaceableWorldRotationV1 {
  const r = Math.round(Number(value) || 0);
  return r === 90 || r === 180 || r === 270 ? r : 0;
}

function positionInBoundsV1(
  position: Partial<HarthmerePlaceableWorldPositionV1> | undefined
): position is HarthmerePlaceableWorldPositionV1 {
  if (!position) return false;
  for (const c of [position.x, position.y, position.z]) {
    const n = Number(c);
    if (!Number.isFinite(n) || Math.abs(n) > HARTHMERE_PLACEABLE_WORLD_MAX_ABS_COORD_V1) {
      return false;
    }
  }
  return true;
}

function rotatedFootprintV1(
  footprint: DecorFootprintV1,
  rotation: HarthmerePlaceableWorldRotationV1
): DecorFootprintV1 {
  return rotation === 90 || rotation === 270
    ? { width: footprint.depth, depth: footprint.width, height: footprint.height }
    : footprint;
}

function aabbOverlapV1(
  a: { position: HarthmerePlaceableWorldPositionV1; footprint: DecorFootprintV1 },
  b: { position: HarthmerePlaceableWorldPositionV1; footprint: DecorFootprintV1 }
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

function cloneWorldStateV1(
  state: HarthmerePlaceableWorldStateV1
): HarthmerePlaceableWorldStateV1 {
  const placed: Record<string, HarthmerePlacedWorldObjectV1> = {};
  for (const [id, record] of Object.entries(state.placed ?? {})) {
    placed[id] = { ...record, position: { ...record.position }, footprint: { ...record.footprint } };
  }
  return {
    placed,
    nextObjectNumber: Math.max(1, Math.floor(Number(state.nextObjectNumber) || 1)),
    appliedRequestIds: { ...(state.appliedRequestIds ?? {}) },
  };
}

function worldFail(
  state: HarthmerePlaceableWorldStateV1,
  error: string
): HarthmerePlaceableWorldMutationResultV1 {
  return { ok: false, errors: [error], state, itemDeltas: {} };
}

/** AABB for a placed record, using its BASE footprint rotated to its rotation. */
function placedRecordAabbV1(record: HarthmerePlacedWorldObjectV1) {
  return {
    position: record.position,
    footprint: rotatedFootprintV1(record.footprint, record.rotationDegrees),
  };
}

function overlapsExistingV1(
  state: HarthmerePlaceableWorldStateV1,
  candidate: { position: HarthmerePlaceableWorldPositionV1; footprint: DecorFootprintV1 },
  ignoreObjectId?: string
): boolean {
  for (const [id, record] of Object.entries(state.placed)) {
    if (id === ignoreObjectId) continue;
    if (aabbOverlapV1(candidate, placedRecordAabbV1(record))) return true;
  }
  return false;
}

/**
 * Free-world placement reducer. Place/move/remove a placeable item on the
 * terrain with no property-ownership gate. Idempotent on requestId.
 */
export function reduceHarthmerePlaceableWorldMutationV1(
  current: HarthmerePlaceableWorldStateV1,
  request: HarthmerePlaceableWorldMutationRequestV1,
  context: HarthmerePlaceableWorldMutationContextV1
): HarthmerePlaceableWorldMutationResultV1 {
  ensureHarthmerePlaceableDecorCatalogueV1();
  const state = cloneWorldStateV1(current);

  if (state.appliedRequestIds[request.requestId] !== undefined) {
    return { ok: true, errors: [], state, itemDeltas: {} };
  }

  switch (request.operation) {
    case "place_object": {
      const itemId = request.itemId;
      if (!itemId) return worldFail(state, "missing_item_id");
      const spec = getHarthmerePlaceableDecorSpecV1(itemId);
      if (!spec) return worldFail(state, "item_not_placeable");
      if (!positionInBoundsV1(request.position)) {
        return worldFail(state, "invalid_position");
      }
      if ((context.actorInventoryItems[itemId] ?? 0) <= 0) {
        return worldFail(state, "missing_placeable_item");
      }
      const rotationDegrees = clampRotationV1(request.rotationDegrees);
      const rotatedFootprint = rotatedFootprintV1(spec.footprint, rotationDegrees);
      if (overlapsExistingV1(state, { position: request.position, footprint: rotatedFootprint })) {
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
      if (!positionInBoundsV1(request.position)) {
        return worldFail(state, "invalid_position");
      }
      const rotationDegrees =
        request.rotationDegrees !== undefined
          ? clampRotationV1(request.rotationDegrees)
          : record.rotationDegrees;
      // record.footprint is the BASE footprint; rotate it for the overlap test.
      const rotatedFootprint = rotatedFootprintV1(record.footprint, rotationDegrees);
      if (
        overlapsExistingV1(
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
      return { ok: true, errors: [], state, itemDeltas: { [record.itemId]: 1 } };
    }

    default:
      return worldFail(state, "unknown_operation");
  }
}
