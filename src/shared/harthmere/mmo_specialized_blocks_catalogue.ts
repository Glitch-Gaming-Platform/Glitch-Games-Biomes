// ---------------------------------------------------------------------------
// HARTHMERE_SPECIALIZED_BLOCKS
//
// Crafting + purchase economy for SPECIALIZED building blocks.
//
// Design rule (from the Harthmere block economy bible):
//   * BASIC / NATURAL terrain blocks (dirt, grass, stone, sand, gravel, snow,
//     muck, raw logs, raw ores, moss, lava, bedrock, ...) are GATHER-ONLY:
//     they can be neither crafted nor purchased. Players must gather them in
//     the world.
//   * SPECIALIZED blocks — refined, decorative, industrial, or magical blocks
//     that never appear straight from the ground — can be CRAFTED (cheaper, but
//     needs materials + a station) or PURCHASED (faster, but costs more).
//
// Every block id here is a REAL bikkie terrain material (see
// src/shared/asset_defs/gen/terrain.json). We never invent block graphics; we
// stick to the bikkie materials and render via procedural voxel hints.
//
// New crafting stations (Stonecutter, Kiln, Forge, Loom, Alchemy Bench) reuse
// the GRAPHICS of existing stations (Workbench / Thermolite / Thermoblaster /
// Tailoring Booth / Dye-O-Matic) because unused station graphics don't exist;
// the reuse is expressed through objectMetadata + bikkieGraphicHints, which the
// bikkie visual resolver already understands.
//
// This module is intentionally additive and self-contained: it only depends on
// the inventory-authority registries and the production crafting catalogue, so
// it can be registered alongside them without touching existing definitions.
// ---------------------------------------------------------------------------

import { ensureHarthmereProductionCraftingCatalogue } from "./mmo_crafting_catalogue";
import {
  getHarthmereCraftingRecipe,
  getHarthmereCraftingStation,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  registerHarthmereCraftingRecipe,
  registerHarthmereCraftingStation,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  type HarthmereCraftingRecipe,
  type HarthmereCraftingStationDefinition,
  type HarthmereItemDefinition,
  type HarthmereVendorEntry,
} from "./mmo_inventory_authority";

// ---------------------------------------------------------------------------
// Natural / gather-only blocks — the exclusion guard.
//
// Nothing in this catalogue may produce one of these as a craft output or sell
// one of them at a vendor. They are allowed as recipe INPUTS (you gather them,
// then refine them into specialized blocks).
// ---------------------------------------------------------------------------

export const HARTHMERE_NATURAL_BLOCK_ITEM_IDS = [
  // soils / loose ground
  "dirt",
  "grass",
  "soil",
  "sand",
  "gravel",
  "snow",
  "moss",
  "moss_grass",
  // raw stone (the refined *_brick/_polished/_carved/_shingles are craftable)
  "stone",
  "cobblestone",
  "granite",
  "limestone",
  "quartzite",
  "basalt",
  "clay",
  // muck family
  "muckwad",
  "DEPRECATED_muckwad",
  "splintered_muck",
  "mucky_brambles",
  // hazards / world-structure
  "lava",
  "bedrock",
  // raw fuel + ores (gathered/mined; the refined ingots + metal blocks are craftable)
  "coal",
  "coal_ore",
  "copper_ore",
  "gold_ore",
  "silver_ore",
  "diamond_ore",
  "neptunium_ore",
  // raw logs (the refined lumber / stripped / reinforced are craftable)
  "oak_log",
  "birch_log",
  "rubber_log",
  "sakura_log",
  "palm_log",
] as const;

const NATURAL_BLOCK_SET: ReadonlySet<string> = new Set(
  HARTHMERE_NATURAL_BLOCK_ITEM_IDS
);

/** True when `itemId` is a basic/natural block that must be gathered, not
 * crafted or purchased. */
export function isHarthmereNaturalBlock(itemId: string): boolean {
  return NATURAL_BLOCK_SET.has(itemId);
}

// ---------------------------------------------------------------------------
// New crafting stations. Each reuses an existing station's graphics.
// ---------------------------------------------------------------------------

export const HARTHMERE_SPECIALIZED_BLOCK_STATIONS = {
  stonecutter: "harthmere_station_stonecutter",
  kiln: "harthmere_station_kiln",
  forge: "harthmere_station_forge",
  loom: "harthmere_station_loom",
  alchemyBench: "harthmere_station_alchemy_bench",
} as const;

export type HarthmereSpecializedBlockStationKey =
  keyof typeof HARTHMERE_SPECIALIZED_BLOCK_STATIONS;

/** Block stations include the new ones plus the existing Workbench (wood). */
export type HarthmereBlockStationKey =
  | HarthmereSpecializedBlockStationKey
  | "workbench";

/** Existing production Workbench station id (wood is worked here per the bible). */
const EXISTING_WORKBENCH_STATION_ID = "1534621126189448";

interface ResolvedBlockStation {
  stationId: string;
  stationType: string;
  skillId: string;
  displayName: string;
}

function resolveBlockStation(
  key: HarthmereBlockStationKey
): ResolvedBlockStation {
  if (key === "workbench") {
    return {
      stationId: EXISTING_WORKBENCH_STATION_ID,
      stationType: "general",
      skillId: "carpentry",
      displayName: "Workbench",
    };
  }
  const seed = SPECIALIZED_STATION_SEEDS.find((s) => s.key === key)!;
  return {
    stationId: seed.stationId,
    stationType: seed.stationType,
    skillId: seed.skillId,
    displayName: seed.displayName,
  };
}

interface SpecializedStationSeed {
  key: HarthmereSpecializedBlockStationKey;
  stationId: string;
  displayName: string;
  stationType: string;
  size: string;
  /** Existing station whose graphics we reuse (bikkie graphic hint). */
  graphicsFromStationHint: string;
  /** Procedural emission hint for the visual resolver. */
  emission: string;
  /** Profession/skill family this station serves. */
  skillId: string;
  /** Workbench recipe inputs to build the station. */
  buildInputs: Array<{ itemId: string; count: number }>;
}

const SPECIALIZED_STATION_SEEDS: SpecializedStationSeed[] = [
  {
    key: "stonecutter",
    stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.stonecutter,
    displayName: "Stonecutter",
    stationType: "stonecutting",
    size: "2x1x2",
    graphicsFromStationHint: "workbench",
    emission: "none",
    skillId: "masonry",
    buildInputs: [
      { itemId: "stone", count: 4 },
      { itemId: "iron_ingot", count: 1 },
    ],
  },
  {
    key: "kiln",
    stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.kiln,
    displayName: "Kiln",
    stationType: "kiln",
    size: "2x2x3",
    graphicsFromStationHint: "thermolite",
    emission: "contained furnace glow",
    skillId: "ceramics",
    buildInputs: [
      { itemId: "clay", count: 4 },
      { itemId: "iron_ingot", count: 2 },
      { itemId: "coal", count: 2 },
    ],
  },
  {
    key: "forge",
    stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.forge,
    displayName: "Forge",
    stationType: "forge",
    size: "3x3x3",
    graphicsFromStationHint: "thermoblaster",
    emission: "contained furnace glow",
    skillId: "blacksmithing",
    buildInputs: [
      { itemId: "iron_ingot", count: 4 },
      { itemId: "stone", count: 4 },
      { itemId: "coal", count: 2 },
    ],
  },
  {
    key: "loom",
    stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.loom,
    displayName: "Loom",
    stationType: "weaving",
    size: "4x1x3",
    graphicsFromStationHint: "tailoringBooth",
    emission: "none",
    skillId: "weaving",
    buildInputs: [
      { itemId: "wood_plank", count: 3 },
      { itemId: "linen_cloth", count: 2 },
    ],
  },
  {
    key: "alchemyBench",
    stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.alchemyBench,
    displayName: "Alchemy Bench",
    stationType: "alchemy",
    size: "3x3x3",
    graphicsFromStationHint: "dyeOMatic",
    emission: "soft contained pulse",
    skillId: "alchemy",
    buildInputs: [
      { itemId: "iron_ingot", count: 2 },
      { itemId: "crystal_shard", count: 1 },
      { itemId: "arcane_dust", count: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Vendor types -> existing vendor ids (we extend existing vendors instead of
// adding new vendor profiles). Each spec vendor role maps to the best-fit
// existing shop, plus the buy-modifier that shop pays when buying blocks back.
// ---------------------------------------------------------------------------

export type HarthmereBlockVendorType =
  | "mason"
  | "carpenter"
  | "kiln_worker"
  | "forge_trader"
  | "rare_materials_dealer"
  | "farm_supplier";

interface VendorBinding {
  vendorId: string;
  /** Fraction of base value the vendor pays when buying a block back. */
  buyModifier: number;
}

const VENDOR_TYPE_BINDING: Record<
  HarthmereBlockVendorType,
  VendorBinding
> = {
  // Stone & clay & glass building supply -> River Dock Supply (trade_goods).
  mason: { vendorId: "river_dock_supply", buyModifier: 0.5 },
  carpenter: { vendorId: "river_dock_supply", buyModifier: 0.5 },
  kiln_worker: { vendorId: "river_dock_supply", buyModifier: 0.5 },
  // Metal / industrial / reinforced -> Black Anvil Smithy (blacksmith).
  forge_trader: { vendorId: "black_anvil_smithy", buyModifier: 0.5 },
  // Glowing / magical -> Wyrm & Candle Magic Shop (magic_vendor).
  rare_materials_dealer: { vendorId: "wyrm_candle_magic_shop", buyModifier: 0.5 },
  // Thatch / fabric / leather -> Orchard Produce Stand (farmer).
  farm_supplier: { vendorId: "orchard_produce_stand", buyModifier: 0.42 },
};

// ---------------------------------------------------------------------------
// Block classes (drive material tier + pricing sanity per the bible).
// ---------------------------------------------------------------------------

export type HarthmereBlockClass =
  | "common_refined" // 3-6 gold
  | "decorative" // 6-12 gold
  | "industrial" // 12-25 gold
  | "rare"; // 30-80 gold

const BLOCK_CLASS_TIER: Record<HarthmereBlockClass, number> = {
  common_refined: 1,
  decorative: 2,
  industrial: 4,
  rare: 5,
};

// ---------------------------------------------------------------------------
// Block specs — the single source of truth for craft + purchase.
// ---------------------------------------------------------------------------

export interface HarthmereSpecializedBlockSpec {
  itemId: string; // real bikkie terrain id
  displayName: string;
  station: HarthmereBlockStationKey;
  vendorType: HarthmereBlockVendorType;
  blockClass: HarthmereBlockClass;
  /** Material family hint for procedural voxel rendering. */
  materialFamily: string;
  inputs: Array<{ itemId: string; count: number }>;
  /** Output count per craft. */
  output: number;
  /** Purchase price per block (gold). */
  price: number;
  /** Optional fuel inputs (consumed but not part of the output material). */
  fuelInputs?: Array<{ itemId: string; count: number }>;
}

function title(itemId: string): string {
  return itemId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stoneFamily(base: string): {
  brickPrice: number;
  polishedPrice: number;
  carvedPrice: number;
  shinglesPrice: number;
} {
  // Per the bible's per-stone pricing tables.
  const table: Record<
    string,
    [number, number, number, number] // brick, polished, carved, shingles
  > = {
    cobblestone: [4, 6, 8, 7],
    stone: [5, 7, 10, 8],
    granite: [6, 8, 11, 10],
    limestone: [6, 8, 11, 10],
    quartzite: [7, 9, 12, 11],
    basalt: [7, 9, 12, 11],
  };
  const [brickPrice, polishedPrice, carvedPrice, shinglesPrice] = table[base];
  return { brickPrice, polishedPrice, carvedPrice, shinglesPrice };
}

function buildStoneSpecs(): HarthmereSpecializedBlockSpec[] {
  const bases = [
    "cobblestone",
    "stone",
    "granite",
    "limestone",
    "quartzite",
    "basalt",
  ];
  const specs: HarthmereSpecializedBlockSpec[] = [];
  for (const base of bases) {
    const price = stoneFamily(base);
    // Brick: 4 base -> 4
    specs.push({
      itemId: `${base}_brick`,
      displayName: title(`${base}_brick`),
      station: "stonecutter",
      vendorType: "mason",
      blockClass: "common_refined",
      materialFamily: base,
      inputs: [{ itemId: base, count: 4 }],
      output: 4,
      price: price.brickPrice,
    });
    // Polished: 2 base + 1 sand -> 2
    specs.push({
      itemId: `${base}_polished`,
      displayName: title(`${base}_polished`),
      station: "stonecutter",
      vendorType: "mason",
      blockClass: "decorative",
      materialFamily: base,
      inputs: [
        { itemId: base, count: 2 },
        { itemId: "sand", count: 1 },
      ],
      output: 2,
      price: price.polishedPrice,
    });
    // Carved: 2 *_brick -> 2
    specs.push({
      itemId: `${base}_carved`,
      displayName: title(`${base}_carved`),
      station: "stonecutter",
      vendorType: "mason",
      blockClass: "decorative",
      materialFamily: base,
      inputs: [{ itemId: `${base}_brick`, count: 2 }],
      output: 2,
      price: price.carvedPrice,
    });
    // Shingles: 3 base + 1 clay -> 4
    specs.push({
      itemId: `${base}_shingles`,
      displayName: title(`${base}_shingles`),
      station: "stonecutter",
      vendorType: "mason",
      blockClass: "decorative",
      materialFamily: base,
      inputs: [
        { itemId: base, count: 3 },
        { itemId: "clay", count: 1 },
      ],
      output: 4,
      price: price.shinglesPrice,
    });
  }
  return specs;
}

// Wood lumber/stripped are worked at the Workbench (carpentry).
// Lumber: 1 log -> 4. Stripped: 1 log -> 2.
const WOOD_SPECS: HarthmereSpecializedBlockSpec[] = [
  ...([
    ["oak", 4],
    ["birch", 5],
    ["rubber", 6],
    ["sakura", 8],
  ] as Array<[string, number]>).map(
    ([wood, price]): HarthmereSpecializedBlockSpec => ({
      itemId: `${wood}_lumber`,
      displayName: title(`${wood}_lumber`),
      station: "workbench",
      vendorType: "carpenter",
      blockClass: "common_refined",
      materialFamily: wood,
      inputs: [{ itemId: `${wood}_log`, count: 1 }],
      output: 4,
      price,
    })
  ),
  ...([
    ["oak", 5],
    ["birch", 6],
    ["rubber", 7],
  ] as Array<[string, number]>).map(
    ([wood, price]): HarthmereSpecializedBlockSpec => ({
      itemId: `${wood}_stripped`,
      displayName: title(`${wood}_stripped`),
      station: "workbench",
      vendorType: "carpenter",
      blockClass: "common_refined",
      materialFamily: wood,
      inputs: [{ itemId: `${wood}_log`, count: 1 }],
      output: 2,
      price,
    })
  ),
];

const REINFORCED_WOOD_SPECS: HarthmereSpecializedBlockSpec[] = [
  ["oak", 14],
  ["birch", 15],
  ["rubber", 16],
].map(
  ([wood, price]): HarthmereSpecializedBlockSpec => ({
    itemId: `${wood}_reinforced`,
    displayName: title(`${wood}_reinforced`),
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "industrial",
    materialFamily: String(wood),
    inputs: [
      { itemId: `${wood}_lumber`, count: 4 },
      { itemId: "iron_ingot", count: 1 },
    ],
    output: 4,
    price: Number(price),
  })
);

const CLAY_AND_GLASS_SPECS: HarthmereSpecializedBlockSpec[] = [
  {
    itemId: "clay_brick",
    displayName: "Clay Brick",
    station: "kiln",
    vendorType: "kiln_worker",
    blockClass: "decorative",
    materialFamily: "clay",
    inputs: [{ itemId: "clay", count: 4 }],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 4,
    price: 6,
  },
  {
    itemId: "clay_polished",
    displayName: "Clay Polished",
    station: "kiln",
    vendorType: "kiln_worker",
    blockClass: "decorative",
    materialFamily: "clay",
    inputs: [
      { itemId: "clay_brick", count: 2 },
      { itemId: "sand", count: 1 },
    ],
    output: 2,
    price: 8,
  },
  {
    itemId: "clay_carved",
    displayName: "Clay Carved",
    station: "kiln",
    vendorType: "kiln_worker",
    blockClass: "decorative",
    materialFamily: "clay",
    inputs: [{ itemId: "clay_brick", count: 2 }],
    output: 2,
    price: 9,
  },
  {
    itemId: "clay_shingles",
    displayName: "Clay Shingles",
    station: "kiln",
    vendorType: "kiln_worker",
    blockClass: "decorative",
    materialFamily: "clay",
    inputs: [{ itemId: "clay", count: 3 }],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 4,
    price: 7,
  },
  {
    itemId: "simple_glass",
    displayName: "Simple Glass",
    station: "kiln",
    vendorType: "kiln_worker",
    blockClass: "decorative",
    materialFamily: "glass",
    inputs: [{ itemId: "sand", count: 4 }],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 4,
    price: 8,
  },
];

const FABRIC_SPECS: HarthmereSpecializedBlockSpec[] = [
  {
    itemId: "thatch",
    displayName: "Thatch",
    station: "loom",
    vendorType: "farm_supplier",
    blockClass: "common_refined",
    materialFamily: "thatch",
    // HARTHMERE_FARM_CRAFT_BRIDGE: inputs reference the actual FARMED crop ids
    // (numeric bikkie ids) so harvested crops feed the Loom — closing the
    // farming↔crafting gap. Wheat = 4647276549161506.
    inputs: [
      { itemId: "4647276549161506", count: 4 }, // Wheat (farmed)
      { itemId: "tree_resin", count: 1 },
    ],
    output: 4,
    price: 5,
  },
  {
    itemId: "cotton_fabric",
    displayName: "Cotton Fabric",
    station: "loom",
    vendorType: "farm_supplier",
    blockClass: "decorative",
    materialFamily: "cotton",
    inputs: [{ itemId: "7539420629350315", count: 4 }], // Cotton (farmed)
    output: 2,
    price: 8,
  },
  {
    itemId: "mushroom_leather",
    displayName: "Mushroom Leather",
    station: "loom",
    vendorType: "farm_supplier",
    blockClass: "decorative",
    materialFamily: "mushroom",
    inputs: [
      { itemId: "1534621126189838", count: 4 }, // Red Mushroom (farmed/foraged)
      { itemId: "tree_resin", count: 1 },
    ],
    output: 2,
    price: 12,
  },
];

const METAL_SPECS: HarthmereSpecializedBlockSpec[] = [
  {
    itemId: "copper",
    displayName: "Copper Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "industrial",
    materialFamily: "copper",
    inputs: [{ itemId: "copper_ingot", count: 4 }],
    output: 4,
    price: 18,
  },
  {
    itemId: "silver",
    displayName: "Silver Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "rare",
    materialFamily: "silver",
    inputs: [{ itemId: "silver_ingot", count: 4 }],
    output: 4,
    price: 28,
  },
  {
    itemId: "gold",
    displayName: "Gold Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "rare",
    materialFamily: "gold",
    inputs: [{ itemId: "gold_ingot", count: 4 }],
    output: 4,
    price: 35,
  },
  {
    itemId: "diamond",
    displayName: "Diamond Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "rare",
    materialFamily: "diamond",
    inputs: [{ itemId: "diamond_shard", count: 4 }],
    output: 1,
    price: 60,
  },
  {
    itemId: "neptunium",
    displayName: "Neptunium Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "rare",
    materialFamily: "neptunium",
    inputs: [{ itemId: "neptunium_shard", count: 4 }],
    output: 1,
    price: 75,
  },
  {
    itemId: "asphalt",
    displayName: "Asphalt",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "industrial",
    materialFamily: "asphalt",
    inputs: [
      { itemId: "gravel", count: 2 },
      { itemId: "tree_resin", count: 1 },
    ],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 4,
    price: 10,
  },
  {
    itemId: "led",
    displayName: "LED Block",
    station: "forge",
    vendorType: "forge_trader",
    blockClass: "industrial",
    materialFamily: "led",
    inputs: [
      { itemId: "simple_glass", count: 1 },
      { itemId: "copper", count: 1 },
    ],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 2,
    price: 20,
  },
];

const MAGIC_SPECS: HarthmereSpecializedBlockSpec[] = [
  {
    itemId: "ice",
    displayName: "Ice Block",
    station: "alchemyBench",
    vendorType: "rare_materials_dealer",
    blockClass: "decorative",
    materialFamily: "ice",
    // Compressed/frozen from gathered snow — fully gatherable, no special input.
    inputs: [{ itemId: "snow", count: 5 }],
    output: 4,
    price: 7,
  },
  {
    itemId: "emberstone",
    displayName: "Emberstone",
    station: "alchemyBench",
    vendorType: "rare_materials_dealer",
    blockClass: "rare",
    materialFamily: "emberstone",
    inputs: [
      { itemId: "stone", count: 2 },
      { itemId: "6706990310348612", count: 1 }, // Fire Flower (farmed)
    ],
    fuelInputs: [{ itemId: "coal", count: 1 }],
    output: 2,
    price: 32,
  },
  {
    itemId: "sunstone",
    displayName: "Sunstone",
    station: "alchemyBench",
    vendorType: "rare_materials_dealer",
    blockClass: "rare",
    materialFamily: "sunstone",
    inputs: [
      { itemId: "quartzite", count: 2 },
      { itemId: "gold_ingot", count: 1 },
      { itemId: "6706990310348612", count: 1 }, // Fire Flower (farmed)
    ],
    output: 2,
    price: 45,
  },
  {
    itemId: "moonstone",
    displayName: "Moonstone",
    station: "alchemyBench",
    vendorType: "rare_materials_dealer",
    blockClass: "rare",
    materialFamily: "moonstone",
    inputs: [
      { itemId: "limestone", count: 2 },
      { itemId: "silver_ingot", count: 1 },
      { itemId: "7251377687845092", count: 1 }, // Blue/Cave Mushroom (farmed)
    ],
    output: 2,
    price: 45,
  },
];

export const HARTHMERE_SPECIALIZED_BLOCK_SPECS: HarthmereSpecializedBlockSpec[] =
  [
    ...buildStoneSpecs(),
    ...WOOD_SPECS,
    ...REINFORCED_WOOD_SPECS,
    ...CLAY_AND_GLASS_SPECS,
    ...FABRIC_SPECS,
    ...METAL_SPECS,
    ...MAGIC_SPECS,
  ];

// ---------------------------------------------------------------------------
// Intermediate / input material definitions (registered only if absent).
// Natural inputs get a plain crafting-material def so the catalogue is
// self-consistent; refined intermediates (ingots/shards/resin) likewise.
// iron_ingot, coal, wood_plank, linen_cloth, crystal_shard, arcane_dust already
// exist in the production catalogue and are guarded against re-registration.
// ---------------------------------------------------------------------------

interface InputMaterialSeed {
  itemId: string;
  displayName: string;
  baseValue: number;
  natural?: boolean;
}

const INPUT_MATERIAL_SEEDS: InputMaterialSeed[] = [
  // Natural gather-only inputs.
  { itemId: "stone", displayName: "Stone", baseValue: 1, natural: true },
  { itemId: "cobblestone", displayName: "Cobblestone", baseValue: 1, natural: true },
  { itemId: "granite", displayName: "Granite", baseValue: 2, natural: true },
  { itemId: "limestone", displayName: "Limestone", baseValue: 2, natural: true },
  { itemId: "quartzite", displayName: "Quartzite", baseValue: 3, natural: true },
  { itemId: "basalt", displayName: "Basalt", baseValue: 3, natural: true },
  { itemId: "clay", displayName: "Clay", baseValue: 1, natural: true },
  { itemId: "sand", displayName: "Sand", baseValue: 1, natural: true },
  { itemId: "gravel", displayName: "Gravel", baseValue: 1, natural: true },
  { itemId: "snow", displayName: "Snow", baseValue: 1, natural: true },
  { itemId: "oak_log", displayName: "Oak Log", baseValue: 2, natural: true },
  { itemId: "birch_log", displayName: "Birch Log", baseValue: 2, natural: true },
  { itemId: "rubber_log", displayName: "Rubber Log", baseValue: 3, natural: true },
  { itemId: "sakura_log", displayName: "Sakura Log", baseValue: 4, natural: true },
  // Raw fuel + ores — gathered/mined in the world (gather-only by the natural
  // rule). They feed the smelting recipes below that produce the refined ingots.
  { itemId: "coal", displayName: "Coal", baseValue: 2, natural: true },
  { itemId: "copper_ore", displayName: "Copper Ore", baseValue: 2, natural: true },
  { itemId: "silver_ore", displayName: "Silver Ore", baseValue: 3, natural: true },
  { itemId: "gold_ore", displayName: "Gold Ore", baseValue: 4, natural: true },
  { itemId: "diamond_ore", displayName: "Diamond Ore", baseValue: 6, natural: true },
  { itemId: "neptunium_ore", displayName: "Neptunium Ore", baseValue: 8, natural: true },
  // Farmed-crop materials — keyed by the REAL farmed bikkie ids so harvested
  // crops feed these recipes (item defs here just give the crafting UI a name;
  // the farming catalog guards against double-registration).
  { itemId: "4647276549161506", displayName: "Wheat", baseValue: 1 },
  { itemId: "7539420629350315", displayName: "Cotton", baseValue: 3 },
  { itemId: "1534621126189838", displayName: "Red Mushroom", baseValue: 3 },
  { itemId: "6706990310348612", displayName: "Fire Flower", baseValue: 8 },
  { itemId: "7251377687845092", displayName: "Blue Mushroom", baseValue: 6 },
  // Refined intermediates — each is CRAFTABLE (smelt/refine, see
  // REFINED_MATERIAL_RECIPES) from gathered raw materials, AND buyable
  // (PURCHASABLE_INPUT_MATERIALS). Craft is cheaper; buying is faster.
  { itemId: "tree_resin", displayName: "Tree Resin", baseValue: 4 },
  { itemId: "copper_ingot", displayName: "Copper Ingot", baseValue: 5 },
  { itemId: "silver_ingot", displayName: "Silver Ingot", baseValue: 8 },
  { itemId: "gold_ingot", displayName: "Gold Ingot", baseValue: 10 },
  { itemId: "diamond_shard", displayName: "Diamond Shard", baseValue: 12 },
  { itemId: "neptunium_shard", displayName: "Neptunium Shard", baseValue: 16 },
];

// HARTHMERE_REFINED_MATERIAL_RECIPES: smelt/refine recipes so every refined
// intermediate can be CREATED from gathered raw materials (no dead inputs). Ingots
// smelt from ore + coal at the Forge; tree_resin is tapped from a rubber log at
// the Kiln. Output counts are tuned so the full craft chain stays cheaper than
// buying the finished block.
interface RefinedMaterialRecipe {
  itemId: string;
  station: HarthmereSpecializedBlockStationKey;
  inputs: Array<{ itemId: string; count: number }>;
  fuelInputs?: Array<{ itemId: string; count: number }>;
  output: number;
}
const REFINED_MATERIAL_RECIPES: RefinedMaterialRecipe[] = [
  { itemId: "copper_ingot", station: "forge", inputs: [{ itemId: "copper_ore", count: 2 }], fuelInputs: [{ itemId: "coal", count: 1 }], output: 2 },
  { itemId: "silver_ingot", station: "forge", inputs: [{ itemId: "silver_ore", count: 2 }], fuelInputs: [{ itemId: "coal", count: 1 }], output: 2 },
  { itemId: "gold_ingot", station: "forge", inputs: [{ itemId: "gold_ore", count: 2 }], fuelInputs: [{ itemId: "coal", count: 1 }], output: 2 },
  { itemId: "diamond_shard", station: "forge", inputs: [{ itemId: "diamond_ore", count: 1 }], fuelInputs: [{ itemId: "coal", count: 1 }], output: 1 },
  { itemId: "neptunium_shard", station: "forge", inputs: [{ itemId: "neptunium_ore", count: 1 }], fuelInputs: [{ itemId: "coal", count: 1 }], output: 1 },
  { itemId: "tree_resin", station: "kiln", inputs: [{ itemId: "rubber_log", count: 1 }], output: 2 },
];

export function refinedMaterialRecipeId(itemId: string): string {
  return `harthmere_refine_${itemId}`;
}

// HARTHMERE_BLOCK_INPUT_OBTAINABLE: processed inputs that aren't gathered or
// farmed are sold so the metal/resin/ice recipes are never a dead end. Buy prices
// are tuned so crafting-from-materials stays cheaper than buying the finished
// block (e.g. 4 gold_ingot @18 = 72 vs a gold block costs 35×4=140 to buy).
const PURCHASABLE_INPUT_MATERIALS: Array<{
  itemId: string;
  vendorId: string;
  buyPrice: number;
}> = [
  { itemId: "copper_ingot", vendorId: "black_anvil_smithy", buyPrice: 8 },
  { itemId: "silver_ingot", vendorId: "black_anvil_smithy", buyPrice: 14 },
  { itemId: "gold_ingot", vendorId: "black_anvil_smithy", buyPrice: 18 },
  { itemId: "diamond_shard", vendorId: "black_anvil_smithy", buyPrice: 13 },
  { itemId: "neptunium_shard", vendorId: "black_anvil_smithy", buyPrice: 17 },
  { itemId: "tree_resin", vendorId: "orchard_produce_stand", buyPrice: 6 },
];

// ---------------------------------------------------------------------------
// Derivation helpers.
// ---------------------------------------------------------------------------

export function specializedBlockRecipeId(itemId: string): string {
  return `harthmere_block_${itemId}`;
}

function blockItemDefinition(
  spec: HarthmereSpecializedBlockSpec
): HarthmereItemDefinition {
  return {
    itemId: spec.itemId,
    displayName: spec.displayName,
    description: `Specialized ${spec.materialFamily} building block. Craft at the ${
      resolveBlockStation(spec.station).displayName
    } or buy from a ${spec.vendorType.replace(/_/g, " ")}.`,
    maxStackSize: 999,
    baseValue: spec.price,
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
    category: "block",
    materialTier: BLOCK_CLASS_TIER[spec.blockClass],
    objectMetadata: {
      objectKind: "material",
      physicalForm: "block",
      sizeVoxels: { width: 1, depth: 1, height: 1 },
      sizeLabel: "1x1x1 voxel building block",
      visualDescription: `${spec.displayName} building block`,
      craftingRoles: ["custom building", "home", "business", "farm structures"],
      businessUse: ["custom_home_property_development"],
      handling: ["place on owned home or business property"],
      procedural: {
        canGenerateWithVoxels: true,
        suggestedShape: `single ${spec.materialFamily} voxel block`,
        palette: [spec.materialFamily],
        emission: spec.blockClass === "rare" ? "soft contained glow" : "none",
      },
      bikkieGraphicHints: ["procedural_voxel_block", spec.materialFamily],
    },
  };
}

function blockCraftingRecipe(
  spec: HarthmereSpecializedBlockSpec
): HarthmereCraftingRecipe {
  const station = resolveBlockStation(spec.station);
  const tier = BLOCK_CLASS_TIER[spec.blockClass];
  return {
    recipeId: specializedBlockRecipeId(spec.itemId),
    outputItemId: spec.itemId,
    outputCount: spec.output,
    inputs: spec.inputs,
    fuelInputs: spec.fuelInputs,
    requiredLevel: 1,
    requiredSkillId: station.skillId,
    requiredSkillLevel: 1,
    professionId: station.skillId,
    requiredProfessionLevel: 1,
    requiredStationId: station.stationId,
    requiredStationType: station.stationType,
    craftingTimeMs: 1500 + tier * 500,
    xpReward: 8 + tier * 4,
    recipeTier: tier,
    materialTier: tier,
    qualityFloor: 35,
    businessTypeId: "custom_home_property_development",
    workOrderTag: "specialized_block",
  };
}

function refinedMaterialCraftingRecipe(
  mat: RefinedMaterialRecipe
): HarthmereCraftingRecipe {
  const station = resolveBlockStation(mat.station);
  return {
    recipeId: refinedMaterialRecipeId(mat.itemId),
    outputItemId: mat.itemId,
    outputCount: mat.output,
    inputs: mat.inputs,
    fuelInputs: mat.fuelInputs,
    requiredLevel: 1,
    requiredSkillId: station.skillId,
    requiredSkillLevel: 1,
    professionId: station.skillId,
    requiredProfessionLevel: 1,
    requiredStationId: station.stationId,
    requiredStationType: station.stationType,
    craftingTimeMs: 2000,
    xpReward: 12,
    recipeTier: 2,
    materialTier: 2,
    qualityFloor: 35,
    businessTypeId: "custom_home_property_development",
    workOrderTag: "refined_material",
  };
}

function vendorEntryForBlock(
  spec: HarthmereSpecializedBlockSpec
): { vendorId: string; entry: HarthmereVendorEntry } {
  const binding = VENDOR_TYPE_BINDING[spec.vendorType];
  return {
    vendorId: binding.vendorId,
    entry: {
      vendorId: binding.vendorId,
      itemId: spec.itemId,
      buyPrice: spec.price,
      sellPrice: Math.max(1, Math.floor(spec.price * binding.buyModifier)),
      stock: -1, // unlimited specialized-block supply
    },
  };
}

function stationDefinition(
  seed: SpecializedStationSeed
): HarthmereCraftingStationDefinition {
  return {
    stationId: seed.stationId,
    displayName: seed.displayName,
    stationType: seed.stationType,
    size: seed.size,
    supportsHandcraft: false,
  };
}

function stationItemDefinition(
  seed: SpecializedStationSeed
): HarthmereItemDefinition {
  const [width, depth, height] = seed.size
    .split("x")
    .map((p) => Math.max(1, Math.floor(Number(p) || 1)));
  return {
    itemId: seed.stationId,
    displayName: seed.displayName,
    description: `${seed.displayName} crafting station for specialized blocks.`,
    maxStackSize: 20,
    baseValue: 65,
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
    category: "crafting station",
    objectMetadata: {
      objectKind: "station",
      physicalForm: "crafting_station",
      sizeVoxels: { width, depth, height },
      sizeLabel: seed.size,
      craftingRoles: [`${seed.displayName} recipes`, "specialized block crafting"],
      businessUse: ["home workshop", "licensed business workshop"],
      handling: ["place on owned home or business property"],
      visualDescription: `${seed.displayName} crafting station`,
      procedural: {
        canGenerateWithVoxels: true,
        suggestedShape: "functional crafting station",
        palette: ["warm wood", "dark metal", "tool accents"],
        emission: seed.emission,
      },
      // Reuse the graphics of an existing station (unused graphics don't exist).
      bikkieGraphicHints: [seed.graphicsFromStationHint, "crafting_station"],
    },
  };
}

function stationBuildRecipe(
  seed: SpecializedStationSeed
): HarthmereCraftingRecipe {
  return {
    recipeId: `harthmere_station_${seed.key}`,
    outputItemId: seed.stationId,
    outputCount: 1,
    inputs: seed.buildInputs,
    requiredLevel: 1,
    requiredSkillId: "carpentry",
    requiredSkillLevel: 1,
    professionId: "carpentry",
    requiredProfessionLevel: 1,
    requiredStationId: "1534621126189448", // Workbench (build new stations here)
    requiredToolActions: ["shape"],
    craftingTimeMs: 3000,
    xpReward: 24,
    recipeTier: 1,
    materialTier: 1,
    qualityFloor: 45,
    businessTypeId: "custom_home_property_development",
    workOrderTag: "crafting station setup",
  };
}

// ---------------------------------------------------------------------------
// Audit guard.
// ---------------------------------------------------------------------------

/**
 * Throws if any specialized-block spec violates the gather-only rule (a natural
 * block appearing as a craft output or as a purchasable item). Allowed: natural
 * blocks used as recipe INPUTS.
 */
export function assertHarthmereSpecializedBlockRules(): void {
  for (const spec of HARTHMERE_SPECIALIZED_BLOCK_SPECS) {
    if (isHarthmereNaturalBlock(spec.itemId)) {
      throw new Error(
        `specialized block "${spec.itemId}" is a natural/gather-only block and must not be craftable or purchasable`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Registration.
// ---------------------------------------------------------------------------

let registered = false;

export function ensureHarthmereSpecializedBlocksCatalogue(): void {
  if (registered) return;
  // Depend on the production catalogue (iron_ingot, coal, workbench, ...).
  ensureHarthmereProductionCraftingCatalogue();
  assertHarthmereSpecializedBlockRules();
  registered = true;

  // 1. New stations (definition + placeable item + workbench build recipe).
  for (const seed of SPECIALIZED_STATION_SEEDS) {
    if (!getHarthmereCraftingStation(seed.stationId)) {
      registerHarthmereCraftingStation(stationDefinition(seed));
    }
    if (!getHarthmereItemDefinition(seed.stationId)) {
      registerHarthmereItemDefinition(stationItemDefinition(seed));
    }
    const buildRecipe = stationBuildRecipe(seed);
    if (!getHarthmereCraftingRecipe(buildRecipe.recipeId)) {
      registerHarthmereCraftingRecipe(buildRecipe);
    }
  }

  // 2. Input / intermediate materials (only if absent).
  for (const seed of INPUT_MATERIAL_SEEDS) {
    if (getHarthmereItemDefinition(seed.itemId)) continue;
    registerHarthmereItemDefinition({
      itemId: seed.itemId,
      displayName: seed.displayName,
      description: seed.natural
        ? `${seed.displayName} — a natural block gathered in the world.`
        : `${seed.displayName} — a crafting material.`,
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
      category: seed.natural ? "natural_block" : "crafting_material",
    });
  }

  // 3a. Refined-material recipes (smelt ores → ingots, tap resin) so every
  //     refined block input can be CREATED from gathered raw materials.
  for (const mat of REFINED_MATERIAL_RECIPES) {
    const recipe = refinedMaterialCraftingRecipe(mat);
    if (!getHarthmereCraftingRecipe(recipe.recipeId)) {
      registerHarthmereCraftingRecipe(recipe);
    }
  }

  // 3. Block items + craft recipes.
  for (const spec of HARTHMERE_SPECIALIZED_BLOCK_SPECS) {
    if (!getHarthmereItemDefinition(spec.itemId)) {
      registerHarthmereItemDefinition(blockItemDefinition(spec));
    }
    const recipe = blockCraftingRecipe(spec);
    if (!getHarthmereCraftingRecipe(recipe.recipeId)) {
      registerHarthmereCraftingRecipe(recipe);
    }
  }

  // 4. Purchase entries on existing vendors.
  for (const spec of HARTHMERE_SPECIALIZED_BLOCK_SPECS) {
    const { vendorId, entry } = vendorEntryForBlock(spec);
    if (!getHarthmereVendorEntry(vendorId, spec.itemId)) {
      registerHarthmereVendorEntry(entry);
    }
  }

  // 5. Purchase entries for the processed input materials (ingots/shards/resin/
  //    water) so the metal/fabric/ice block recipes have a working craft path.
  for (const mat of PURCHASABLE_INPUT_MATERIALS) {
    if (!getHarthmereVendorEntry(mat.vendorId, mat.itemId)) {
      registerHarthmereVendorEntry({
        vendorId: mat.vendorId,
        itemId: mat.itemId,
        buyPrice: mat.buyPrice,
        sellPrice: Math.max(1, Math.floor(mat.buyPrice * 0.5)),
        stock: -1,
      });
    }
  }
}

/** Recipe ids for every specialized block (and their stations). */
export function harthmereSpecializedBlockRecipeIds(): string[] {
  ensureHarthmereSpecializedBlocksCatalogue();
  return [
    ...SPECIALIZED_STATION_SEEDS.map((s) => `harthmere_station_${s.key}`),
    ...HARTHMERE_SPECIALIZED_BLOCK_SPECS.map((spec) =>
      specializedBlockRecipeId(spec.itemId)
    ),
  ];
}

/** Every block id this catalogue makes craftable + purchasable. */
export function harthmereSpecializedBlockItemIds(): string[] {
  return HARTHMERE_SPECIALIZED_BLOCK_SPECS.map((spec) => spec.itemId);
}
