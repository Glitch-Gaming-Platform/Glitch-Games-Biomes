import {
  grantHarthmereItem,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  readHarthmereEconomyState,
  recordHarthmereEconomicEvent,
  writeHarthmereEconomyState,
} from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import { awardHarthmereXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_GATHERING_STATE_KEY =
  "biomes.localDev.harthmere.gatheringState.v1";
const HARTHMERE_GATHERING_EVENT = "biomes:harthmere-gathering-changed";

type GatheringProfession =
  | "mining"
  | "logging"
  | "herbalism"
  | "skinning"
  | "fishing"
  | "farming"
  | "scavenging"
  | "archaeology"
  | "monster_harvesting"
  | "magical_harvesting";

type NodeCategory =
  | "ore"
  | "wood"
  | "herb"
  | "fish"
  | "farm"
  | "scrap"
  | "clay"
  | "magic"
  | "corpse"
  | "water"
  | "relic";

type NodeOwnership =
  | "public"
  | "town"
  | "owned"
  | "temple"
  | "protected"
  | "illegal";

type NodeShareMode = "shared" | "semi_shared" | "personal";

interface ProfessionState {
  level: number;
  xp: number;
}

interface GatheringLogEntry {
  id: string;
  at: number;
  label: string;
  detail: string;
  nodeId?: string;
  profession?: GatheringProfession;
  materials?: Record<string, number>;
  rareFind?: string;
  legal?: boolean;
}

interface ResourceYield {
  itemId: string;
  min: number;
  max: number;
}

interface RareYield extends ResourceYield {
  chance: number;
}

interface ResourceNodeDefinition {
  id: string;
  name: string;
  category: NodeCategory;
  profession: GatheringProfession;
  requiredTool?: string;
  requiredSkill: number;
  tier: number;
  district: string;
  area: string;
  position: [number, number, number];
  shareMode: NodeShareMode;
  ownership: NodeOwnership;
  gatherSeconds: number;
  minRespawnSeconds: number;
  maxRespawnSeconds: number;
  baseYield: ResourceYield[];
  rareYield?: RareYield[];
  danger?: string;
  biome: string;
  legalWarning?: string;
  economyImpact?: Partial<{
    foodSupply: number;
    oreSupply: number;
    medicineSupply: number;
    wealth: number;
    security: number;
    crimeRate: number;
  }>;
  notes: string;
}

export interface HarthmereGatheringState {
  version: 1;
  professions: Record<GatheringProfession, ProfessionState>;
  nodeCooldowns: Record<string, number>;
  nodeGatherCounts: Record<string, number>;
  discoveredResources: string[];
  trackingEnabled: boolean;
  lastGatherAt?: number;
  suspiciousRouteScore: number;
  recent: GatheringLogEntry[];
}

const PROFESSIONS: GatheringProfession[] = [
  "mining",
  "logging",
  "herbalism",
  "skinning",
  "fishing",
  "farming",
  "scavenging",
  "archaeology",
  "monster_harvesting",
  "magical_harvesting",
];

const STARTER_TOOLS = [
  "rusty_pickaxe",
  "woodcutters_axe",
  "herbalist_sickle",
  "simple_fishing_rod",
  "skinning_knife",
  "scavenger_hook",
  "clay_shovel",
  "arcane_extractor",
];

const BASE_NODE_DEFINITIONS: ResourceNodeDefinition[] = [
  {
    id: "harthmere_north_iron_vein",
    name: "North Road Iron Vein",
    category: "ore",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 1,
    tier: 1,
    district: "North Gate",
    area: "rocky shoulder outside the gate road",
    position: [503, 53, -270],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 3,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      { itemId: "iron_ore", min: 2, max: 4 },
      { itemId: "rough_stone", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "rough_garnet", min: 1, max: 1, chance: 0.06 }],
    biome: "rocky road cut",
    economyImpact: { oreSupply: 2, wealth: 1 },
    notes:
      "Ore sits against exposed roadside rock, not in a house, road lane, or floating prop.",
  },
  {
    id: "harthmere_orchard_softwood",
    name: "Orchard Softwood Branches",
    category: "wood",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 1,
    tier: 1,
    district: "Orchard",
    area: "fallen branches under the orchard trees",
    position: [468, 53, -118],
    shareMode: "semi_shared",
    ownership: "town",
    gatherSeconds: 4,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 540,
    baseYield: [
      { itemId: "softwood_log", min: 2, max: 5 },
      { itemId: "oak_branch", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "tree_resin", min: 1, max: 1, chance: 0.08 }],
    biome: "orchard edge",
    economyImpact: { wealth: 1 },
    notes:
      "The player gathers fallen usable wood, not structurally important trees or blocked storefront props.",
  },
  {
    id: "harthmere_temple_peacebloom",
    name: "Temple Peacebloom Bed",
    category: "herb",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 1,
    tier: 1,
    district: "Temple Green",
    area: "public herb bed beside the chapel path",
    position: [493, 53, -158],
    shareMode: "personal",
    ownership: "temple",
    gatherSeconds: 2,
    minRespawnSeconds: 150,
    maxRespawnSeconds: 360,
    baseYield: [
      { itemId: "peacebloom", min: 2, max: 4 },
      { itemId: "willow_bark", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "fine_peacebloom", min: 1, max: 1, chance: 0.05 }],
    biome: "temple garden",
    legalWarning:
      "Temple herbs are permitted only while helping Harthmere. Taking extra is frowned upon.",
    economyImpact: { medicineSupply: 3, wealth: 1 },
    notes:
      "Medicinal herbs grow in a readable garden near healers where they belong.",
  },
  {
    id: "harthmere_river_fishing_pool",
    name: "Bluewater Fishing Pool",
    category: "fish",
    profession: "fishing",
    requiredTool: "simple_fishing_rod",
    requiredSkill: 1,
    tier: 1,
    district: "River Docks",
    area: "safe dock edge with water access",
    position: [604, 53, -168],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 6,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      { itemId: "river_trout", min: 1, max: 3 },
      { itemId: "clean_water", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "river_pearl", min: 1, max: 1, chance: 0.03 }],
    biome: "river dock",
    economyImpact: { foodSupply: 3, wealth: 1 },
    notes:
      "Fishing is tied to actual water and dock access, not a dry road marker.",
  },
  {
    id: "harthmere_farm_crops",
    name: "Farm Crop Row",
    category: "farm",
    profession: "farming",
    requiredSkill: 1,
    tier: 1,
    district: "Farm",
    area: "worked rows beside the animal pen",
    position: [450, 53, -232],
    shareMode: "personal",
    ownership: "owned",
    gatherSeconds: 2,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 360,
    baseYield: [
      { itemId: "field_wheat", min: 2, max: 5 },
      { itemId: "fresh_carrot", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "golden_carrot", min: 1, max: 1, chance: 0.02 }],
    biome: "farm field",
    legalWarning:
      "These crops are owned. Harvesting without a contract counts as theft.",
    economyImpact: { foodSupply: 4, wealth: 1 },
    notes:
      "Crops are gathered only from farm rows, with ownership rules attached.",
  },
  {
    id: "harthmere_mudden_scrap",
    name: "Mudden Ward Scrap Pile",
    category: "scrap",
    profession: "scavenging",
    requiredTool: "scavenger_hook",
    requiredSkill: 1,
    tier: 1,
    district: "Mudden Ward",
    area: "broken cart and alley junk pile",
    position: [409, 53, -178],
    shareMode: "shared",
    ownership: "public",
    gatherSeconds: 3,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 480,
    baseYield: [
      { itemId: "scrap_metal", min: 1, max: 4 },
      { itemId: "cloth_scrap", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "old_coin", min: 1, max: 2, chance: 0.08 }],
    danger: "Rats and thieves watch the alleys.",
    biome: "slum alley",
    economyImpact: { crimeRate: -1, wealth: 1 },
    notes:
      "Scavenging gives the poor district a useful economy without blocking alleys.",
  },
  {
    id: "harthmere_river_clay",
    name: "Riverbank Clay Deposit",
    category: "clay",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    tier: 1,
    district: "River Docks",
    area: "muddy bank just off the dock road",
    position: [596, 53, -186],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      { itemId: "river_clay", min: 2, max: 5 },
      { itemId: "sand_lump", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "blue_glass_shard", min: 1, max: 1, chance: 0.04 }],
    biome: "riverbank",
    economyImpact: { wealth: 1 },
    notes: "Clay appears at a wet riverbank, not in a dry interior room.",
  },
  {
    id: "harthmere_old_well_essence",
    name: "Old Well Mana Residue",
    category: "magic",
    profession: "magical_harvesting",
    requiredTool: "arcane_extractor",
    requiredSkill: 3,
    tier: 2,
    district: "Old Well",
    area: "cold stones around the underways entrance",
    position: [428, 53, -160],
    shareMode: "personal",
    ownership: "protected",
    gatherSeconds: 6,
    minRespawnSeconds: 420,
    maxRespawnSeconds: 900,
    baseYield: [{ itemId: "mana_essence", min: 1, max: 2 }],
    rareYield: [{ itemId: "mana_crystal_shard", min: 1, max: 1, chance: 0.08 }],
    danger: "Unstable magic may flare if harvested carelessly.",
    biome: "haunted civic ruin",
    legalWarning:
      "The Watch does not like unlicensed work around the Old Well.",
    economyImpact: { wealth: 2 },
    notes:
      "Magical residue appears at the town mystery landmark and requires a magical tool.",
  },
  {
    id: "harthmere_chapel_relic_dig",
    name: "Old Grave Relic Dig",
    category: "relic",
    profession: "archaeology",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    tier: 1,
    district: "Temple Green",
    area: "graveyard edge away from the chapel door",
    position: [501, 53, -145],
    shareMode: "personal",
    ownership: "temple",
    gatherSeconds: 8,
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      { itemId: "relic_fragment", min: 1, max: 2 },
      { itemId: "old_bone_button", min: 1, max: 1 },
    ],
    rareYield: [{ itemId: "saint_coin", min: 1, max: 1, chance: 0.03 }],
    biome: "graveyard",
    legalWarning:
      "Digging near graves is restricted unless a priest requested it.",
    economyImpact: { wealth: 1, medicineSupply: 1 },
    notes: "Archaeology is slower and has explicit temple/legal context.",
  },
  {
    id: "harthmere_wolf_carcass",
    name: "Road Wolf Carcass",
    category: "corpse",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 1,
    tier: 1,
    district: "North Gate",
    area: "hunter drop-off beside the guard yard",
    position: [518, 53, -252],
    shareMode: "personal",
    ownership: "town",
    gatherSeconds: 4,
    minRespawnSeconds: 360,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "wolf_hide", min: 1, max: 3 },
      { itemId: "raw_meat", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "wolf_fang", min: 1, max: 1, chance: 0.08 }],
    biome: "hunter processing spot",
    economyImpact: { foodSupply: 1, security: 1 },
    notes:
      "Animal parts come from a carcass/hunting context, not random crates.",
  },
];

const HARTHMERE_DEEP_RESOURCE_NODE_DEFINITIONS: ResourceNodeDefinition[] = [
  {
    id: "greenmere_oak_grove",
    name: "Greenmere Oak Grove",
    category: "wood",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 1,
    tier: 1,
    district: "Greenmere Forest Edge",
    area: "dense oak stand north of the gate road",
    position: [506, 53, -382],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 540,
    baseYield: [
      { itemId: "oak_log", min: 3, max: 6 },
      { itemId: "oak_branch", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "tree_resin", min: 1, max: 2, chance: 0.1 }],
    biome: "forest edge",
    economyImpact: { wealth: 1 },
    notes: "Tied to real oak_log and oak_leaf voxel trees placed in the north Wilds.",
  },
  {
    id: "north_pine_stand",
    name: "North Greenmere Pine Stand",
    category: "wood",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    tier: 1,
    district: "North Greenmere",
    area: "high pine belt beyond the last watch post",
    position: [625, 53, -662],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 5,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "pine_log", min: 3, max: 5 },
      { itemId: "pine_pitch", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "straight_pine_heartwood", min: 1, max: 1, chance: 0.06 }],
    biome: "deep pine forest",
    economyImpact: { wealth: 2 },
    notes: "Supports building, arrows, shafts, repairs, and charcoal work.",
  },
  {
    id: "old_wood_birch_grove",
    name: "Old Wood Birch Grove",
    category: "wood",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    tier: 1,
    district: "West Old Wood",
    area: "white-barked trees along the hunter track",
    position: [250, 53, -350],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 660,
    baseYield: [
      { itemId: "birch_bark", min: 2, max: 4 },
      { itemId: "lightwood_log", min: 2, max: 4 },
    ],
    rareYield: [{ itemId: "clean_birch_strip", min: 1, max: 1, chance: 0.08 }],
    biome: "old forest",
    economyImpact: { medicineSupply: 1, wealth: 1 },
    notes: "Birch bark feeds apothecary, parchment, kindling, and crafting recipes.",
  },
  {
    id: "briarfen_willow_cuttings",
    name: "Briarfen Willow Cuttings",
    category: "wood",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    tier: 1,
    district: "Briarfen Wetlands",
    area: "willow roots and branches over black water",
    position: [772, 53, -412],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 5,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "willow_bark", min: 2, max: 5 },
      { itemId: "flexible_willow", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "flood_willow_sap", min: 1, max: 1, chance: 0.07 }],
    biome: "wetland forest",
    danger: "Snakes, leeches, and drowned dead patrol the reeds.",
    economyImpact: { medicineSupply: 2 },
    notes: "Wetland timber is separate from dry oak/pine logging.",
  },
  {
    id: "watchtower_iron_cut",
    name: "Watchtower Iron Cut",
    category: "ore",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 2,
    tier: 1,
    district: "Ruined Watchtower Ridge",
    area: "bandit-controlled exposed iron vein",
    position: [178, 53, -604],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "iron_ore", min: 3, max: 6 },
      { itemId: "rough_stone", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "black_iron_shard", min: 1, max: 1, chance: 0.05 }],
    biome: "rocky ridge",
    danger: "Bandits may attack miners near the old tower.",
    economyImpact: { oreSupply: 4, security: -1 },
    notes: "Uses real iron_ore voxel clusters at the ridge.",
  },
  {
    id: "bandit_ridge_coal_seam",
    name: "Bandit Ridge Coal Seam",
    category: "ore",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 1,
    tier: 1,
    district: "Ruined Watchtower Ridge",
    area: "charcoal-black seam beside stolen crates",
    position: [244, 53, -532],
    shareMode: "shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      { itemId: "coal", min: 3, max: 7 },
      { itemId: "rough_stone", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "dense_coal_lump", min: 1, max: 1, chance: 0.07 }],
    biome: "ridge mine cut",
    economyImpact: { oreSupply: 2, wealth: 1 },
    notes: "Feeds forge fuel and charcoal economy.",
  },
  {
    id: "old_wood_silver_thread",
    name: "Old Wood Silver Thread",
    category: "ore",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 3,
    tier: 2,
    district: "West Old Wood",
    area: "narrow silver vein under mossy stone",
    position: [-190, 53, 92],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 6,
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      { itemId: "silver_ore", min: 1, max: 3 },
      { itemId: "rough_stone", min: 2, max: 4 },
    ],
    rareYield: [{ itemId: "bright_silver_nugget", min: 1, max: 1, chance: 0.04 }],
    biome: "old forest stone cut",
    economyImpact: { oreSupply: 3, wealth: 2 },
    notes: "Silver is rarer and farther from town than iron/coal.",
  },
  {
    id: "gravewood_gold_fragment",
    name: "Gravewood Gold Fragment",
    category: "ore",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 4,
    tier: 2,
    district: "Gravewood",
    area: "gold flecks in cursed burial stone",
    position: [822, 53, 344],
    shareMode: "personal",
    ownership: "protected",
    gatherSeconds: 8,
    minRespawnSeconds: 900,
    maxRespawnSeconds: 1800,
    baseYield: [
      { itemId: "gold_ore", min: 1, max: 2 },
      { itemId: "grave_stone_chip", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "bell_gold_flake", min: 1, max: 1, chance: 0.03 }],
    biome: "haunted gravewood",
    danger: "Bell-woken dead may retaliate.",
    legalWarning: "Chapel law treats grave extraction as restricted unless a quest asked for it.",
    economyImpact: { wealth: 3, security: -1 },
    notes: "High-value ore has legal and undead consequences.",
  },
  {
    id: "greenmere_berry_thicket",
    name: "Greenmere Berry Thicket",
    category: "herb",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 1,
    tier: 1,
    district: "Greenmere Forest Edge",
    area: "berry bushes under broad oaks",
    position: [546, 53, -430],
    shareMode: "personal",
    ownership: "public",
    gatherSeconds: 2,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      { itemId: "wild_berries", min: 2, max: 5 },
      { itemId: "berry_leaf", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "sweet_greenmere_berry", min: 1, max: 1, chance: 0.06 }],
    biome: "forest undergrowth",
    danger: "Bears sometimes guard berry thickets.",
    economyImpact: { foodSupply: 2, medicineSupply: 1 },
    notes: "Uses shrubbery/bush assets and real small resource blocks.",
  },
  {
    id: "old_wood_mushroom_ring",
    name: "Old Wood Mushroom Ring",
    category: "herb",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 2,
    tier: 1,
    district: "West Old Wood",
    area: "mushroom ring near old hunter marks",
    position: [42, 53, -138],
    shareMode: "personal",
    ownership: "public",
    gatherSeconds: 3,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      { itemId: "forest_mushroom", min: 2, max: 4 },
      { itemId: "damp_moss", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "mooncap_mushroom", min: 1, max: 1, chance: 0.05 }],
    biome: "old forest hollow",
    economyImpact: { medicineSupply: 2 },
    notes: "Mushrooms are not decoration only; they are gatherable herbalism nodes.",
  },
  {
    id: "briarfen_reed_bed",
    name: "Briarfen Reed Bed",
    category: "water",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    tier: 1,
    district: "Briarfen Wetlands",
    area: "tall reeds and black mud near the planks",
    position: [780, 53, -378],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 240,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "reed_bundle", min: 2, max: 5 },
      { itemId: "mudroot", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "flood_lotus", min: 1, max: 1, chance: 0.03 }],
    biome: "wetland reed bed",
    danger: "Snakes and drowned dead patrol this wetland edge.",
    economyImpact: { medicineSupply: 2, wealth: 1 },
    notes: "Reeds, mudroot, clay, and water resources are separate from forest logging.",
  },
  {
    id: "briarfen_clay_bank",
    name: "Briarfen Blackwater Clay Bank",
    category: "clay",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    tier: 1,
    district: "Briarfen Wetlands",
    area: "dark clay deposit beside willow roots",
    position: [864, 53, -286],
    shareMode: "semi_shared",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "blackwater_clay", min: 2, max: 5 },
      { itemId: "sand_lump", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "ghost_pearl", min: 1, max: 1, chance: 0.02 }],
    biome: "wetland clay bank",
    economyImpact: { wealth: 1 },
    notes: "Clay is visibly placed at water/mud banks, not random dry roads.",
  },
  {
    id: "gravewood_moss_and_nightshade",
    name: "Gravewood Moss and Nightshade",
    category: "herb",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 3,
    tier: 2,
    district: "Gravewood",
    area: "blue-gray moss on old grave roots",
    position: [736, 53, 314],
    shareMode: "personal",
    ownership: "temple",
    gatherSeconds: 5,
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      { itemId: "grave_moss", min: 1, max: 3 },
      { itemId: "nightshade", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "ghost_ash", min: 1, max: 1, chance: 0.04 }],
    biome: "gravewood",
    danger: "Undead are more common near these nodes at night.",
    legalWarning: "Temple restrictions apply around blessed graves.",
    economyImpact: { medicineSupply: 2, security: -1 },
    notes: "Legal and spiritual restrictions make grave resources more interesting than generic herbs.",
  },
  {
    id: "gate_field_flax_row",
    name: "Gate Field Flax Row",
    category: "farm",
    profession: "farming",
    requiredSkill: 1,
    tier: 1,
    district: "Gate Fields",
    area: "owned flax rows outside the north gate",
    position: [430, 53, -350],
    shareMode: "personal",
    ownership: "owned",
    gatherSeconds: 2,
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      { itemId: "flax_stalk", min: 2, max: 5 },
      { itemId: "plant_fiber", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "clean_flax_bundle", min: 1, max: 1, chance: 0.06 }],
    biome: "starter farmland",
    legalWarning: "Owned crops require a work order. Taking them freely is theft.",
    economyImpact: { wealth: 1 },
    notes: "Flax supports tailoring and bowstring recipes.",
  },
  {
    id: "orchard_honey_hive",
    name: "Orchard Honey Hive",
    category: "farm",
    profession: "farming",
    requiredSkill: 2,
    tier: 1,
    district: "Orchard Lane",
    area: "bee boxes near fallen apples",
    position: [394, 53, -378],
    shareMode: "personal",
    ownership: "owned",
    gatherSeconds: 4,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "honeycomb", min: 1, max: 3 },
      { itemId: "beeswax", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "queen_honey", min: 1, max: 1, chance: 0.03 }],
    biome: "orchard",
    legalWarning: "The hives belong to the mill families.",
    economyImpact: { foodSupply: 2, medicineSupply: 1 },
    notes: "Honey and beeswax connect bakery and apothecary loops.",
  },
  {
    id: "deer_hunting_trail",
    name: "Deer Hunting Trail",
    category: "corpse",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 1,
    tier: 1,
    district: "Greenmere Forest Edge",
    area: "deer trail crossing the oak grove",
    position: [532, 53, -388],
    shareMode: "personal",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      { itemId: "deer_hide", min: 1, max: 2 },
      { itemId: "venison", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "clean_antler", min: 1, max: 1, chance: 0.07 }],
    biome: "forest game trail",
    economyImpact: { foodSupply: 2, wealth: 1 },
    notes: "Hunting animals ties into the combat targets; skinning remains a separate gathering action.",
  },
  {
    id: "boar_sounder_harvest",
    name: "Boar Sounder Harvest",
    category: "corpse",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 2,
    tier: 1,
    district: "Orchard Lane",
    area: "boar track through damaged crop rows",
    position: [404, 53, -414],
    shareMode: "personal",
    ownership: "public",
    gatherSeconds: 4,
    minRespawnSeconds: 360,
    maxRespawnSeconds: 900,
    baseYield: [
      { itemId: "boar_hide", min: 1, max: 2 },
      { itemId: "boar_tusk", min: 1, max: 2 },
      { itemId: "raw_meat", min: 1, max: 3 },
    ],
    rareYield: [{ itemId: "heavy_boar_bristle", min: 1, max: 1, chance: 0.08 }],
    biome: "orchard damage trail",
    danger: "Boars may counterattack.",
    economyImpact: { foodSupply: 2, security: 1 },
    notes: "Boars are hostile animal combat targets and skinning resources.",
  },
  {
    id: "bear_den_harvest",
    name: "Black Bear Den Harvest",
    category: "corpse",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 3,
    tier: 2,
    district: "Deep Old Wood",
    area: "berry thicket and den scratches",
    position: [606, 53, -482],
    shareMode: "personal",
    ownership: "public",
    gatherSeconds: 6,
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      { itemId: "bear_hide", min: 1, max: 2 },
      { itemId: "bear_fat", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "black_bear_claw", min: 1, max: 1, chance: 0.06 }],
    biome: "deep forest den",
    danger: "Bears are dangerous and should be fought deliberately.",
    economyImpact: { foodSupply: 1, wealth: 2 },
    notes: "Large animals require the combat system before reliable harvesting.",
  },
  {
    id: "gravewood_zombie_remains",
    name: "Bell-Woken Zombie Remains",
    category: "corpse",
    profession: "monster_harvesting",
    requiredTool: "scavenger_hook",
    requiredSkill: 2,
    tier: 2,
    district: "Gravewood",
    area: "restless corpse near buried bell fragments",
    position: [536, 53, -119],
    shareMode: "personal",
    ownership: "protected",
    gatherSeconds: 5,
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      { itemId: "grave_dust", min: 1, max: 3 },
      { itemId: "bone_fragment", min: 1, max: 2 },
    ],
    rareYield: [{ itemId: "bell_woken_ash", min: 1, max: 1, chance: 0.05 }],
    biome: "undead gravewood",
    danger: "Bell-woken dead attack trespassers.",
    legalWarning: "The chapel wants these remains handled carefully.",
    economyImpact: { medicineSupply: 1, security: 1 },
    notes: "Monster harvesting connects combat kills to alchemy and chapel quests.",
  },
];

const NODE_DEFINITIONS: ResourceNodeDefinition[] = [
  ...BASE_NODE_DEFINITIONS,
  ...HARTHMERE_DEEP_RESOURCE_NODE_DEFINITIONS,
];

function isBrowser() {
  return typeof window !== "undefined";
}

function gatheringEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new Event(HARTHMERE_GATHERING_EVENT));
}

function defaultProfessions(): Record<GatheringProfession, ProfessionState> {
  return Object.fromEntries(
    PROFESSIONS.map((profession) => [profession, { level: 1, xp: 0 }]),
  ) as Record<GatheringProfession, ProfessionState>;
}

function defaultState(): HarthmereGatheringState {
  return {
    version: 1,
    professions: defaultProfessions(),
    nodeCooldowns: {},
    nodeGatherCounts: {},
    discoveredResources: [],
    trackingEnabled: true,
    suspiciousRouteScore: 0,
    recent: [],
  };
}

function normalizeState(raw?: Partial<HarthmereGatheringState>) {
  const fallback = defaultState();
  const professions = defaultProfessions();
  for (const profession of PROFESSIONS) {
    professions[profession] = {
      level: Math.max(
        1,
        Math.floor(Number(raw?.professions?.[profession]?.level ?? 1)),
      ),
      xp: Math.max(
        0,
        Math.floor(Number(raw?.professions?.[profession]?.xp ?? 0)),
      ),
    };
  }
  return {
    ...fallback,
    ...raw,
    version: 1 as const,
    professions,
    nodeCooldowns: raw?.nodeCooldowns ?? {},
    nodeGatherCounts: raw?.nodeGatherCounts ?? {},
    discoveredResources: Array.from(new Set(raw?.discoveredResources ?? [])),
    trackingEnabled: raw?.trackingEnabled ?? true,
    suspiciousRouteScore: Math.max(0, Number(raw?.suspiciousRouteScore ?? 0)),
    recent: (raw?.recent ?? []).slice(0, 18),
  };
}

export function readHarthmereGatheringState(): HarthmereGatheringState {
  if (!isBrowser()) {
    return defaultState();
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_GATHERING_STATE_KEY);
    return raw
      ? normalizeState(JSON.parse(raw) as Partial<HarthmereGatheringState>)
      : defaultState();
  } catch {
    return defaultState();
  }
}

export function writeHarthmereGatheringState(state: HarthmereGatheringState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_GATHERING_STATE_KEY,
    JSON.stringify(normalizeState(state)),
  );
  gatheringEvent();
}

function appendLog(
  state: HarthmereGatheringState,
  entry: Omit<GatheringLogEntry, "id" | "at">,
) {
  return {
    ...state,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        ...entry,
      },
      ...state.recent,
    ].slice(0, 18),
  };
}

function xpRequiredForProfessionLevel(level: number) {
  return Math.round(80 + level ** 1.55 * 55);
}

function rollInt(min: number, max: number) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.max(low, Math.floor(Math.random() * (high - low + 1)) + low);
}

function nodeById(nodeId: string) {
  return NODE_DEFINITIONS.find((node) => node.id === nodeId);
}

function hasInventoryItem(itemId: string) {
  const inventory = readHarthmereInventoryState();
  return (
    inventory.backpack.items.some((item) => item.itemId === itemId) ||
    Object.values(inventory.equipment).some(
      (item) => item?.itemId === itemId,
    ) ||
    inventory.bank.items.some((item) => item.itemId === itemId) ||
    inventory.keyring.includes(itemId)
  );
}

function skillYieldMultiplier(skill: number, required: number) {
  const diff = skill - required;
  if (diff >= 75) return 1.3;
  if (diff >= 50) return 1.2;
  if (diff >= 25) return 1.1;
  return 1;
}

function rareChanceMultiplier(skill: number, required: number) {
  const diff = skill - required;
  if (diff >= 75) return 2;
  if (diff >= 50) return 1.65;
  if (diff >= 25) return 1.35;
  return 1;
}

function professionXpForNode(node: ResourceNodeDefinition) {
  return Math.max(5, Math.round(8 + node.tier * 10 + node.gatherSeconds * 1.5));
}

function applyProfessionXp(
  state: HarthmereGatheringState,
  profession: GatheringProfession,
  xp: number,
) {
  const current = state.professions[profession] ?? { level: 1, xp: 0 };
  let level = current.level;
  let totalXp = current.xp + xp;
  let leveled = false;

  while (level < 100 && totalXp >= xpRequiredForProfessionLevel(level)) {
    totalXp -= xpRequiredForProfessionLevel(level);
    level += 1;
    leveled = true;
  }

  return {
    state: {
      ...state,
      professions: {
        ...state.professions,
        [profession]: { level, xp: totalXp },
      },
    },
    level,
    leveled,
  };
}

function cooldownReady(
  state: HarthmereGatheringState,
  node: ResourceNodeDefinition,
) {
  return (state.nodeCooldowns[node.id] ?? 0) <= Date.now();
}

function nextRespawnAt(node: ResourceNodeDefinition) {
  return (
    Date.now() + rollInt(node.minRespawnSeconds, node.maxRespawnSeconds) * 1000
  );
}

function updateTownSupply(
  node: ResourceNodeDefinition,
  legal: boolean,
  label: string,
) {
  const impact = node.economyImpact;
  if (!impact) {
    return;
  }
  const economy = readHarthmereEconomyState();
  const clamp = (value: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Math.round(value)));
  const next = {
    ...economy,
    town: {
      ...economy.town,
      foodSupply: clamp(economy.town.foodSupply + (impact.foodSupply ?? 0)),
      oreSupply: clamp(economy.town.oreSupply + (impact.oreSupply ?? 0)),
      medicineSupply: clamp(
        economy.town.medicineSupply + (impact.medicineSupply ?? 0),
      ),
      wealth: clamp(economy.town.wealth + (impact.wealth ?? 0)),
      security: clamp(economy.town.security + (impact.security ?? 0)),
      crimeRate: clamp(
        economy.town.crimeRate + (legal ? (impact.crimeRate ?? 0) : 2),
      ),
    },
  };
  writeHarthmereEconomyState(next);
  recordHarthmereEconomicEvent(
    legal ? "source" : "black_market",
    "Gathered Materials",
    `${label} moved raw materials into Harthmere's local economy.`,
  );
}

function isIllegalGather(node: ResourceNodeDefinition, forceIllegal = false) {
  return (
    forceIllegal ||
    node.ownership === "illegal" ||
    node.ownership === "owned" ||
    node.ownership === "protected"
  );
}

export function performHarthmereGather(
  nodeId: string,
  options?: { ignoreCooldown?: boolean; forceIllegal?: boolean },
) {
  const node = nodeById(nodeId);
  if (!node) {
    return { ok: false, message: "Unknown resource node." };
  }

  let state = readHarthmereGatheringState();
  const profession = state.professions[node.profession] ?? { level: 1, xp: 0 };

  if (!options?.ignoreCooldown && !cooldownReady(state, node)) {
    const seconds = Math.max(
      1,
      Math.ceil(
        ((state.nodeCooldowns[node.id] ?? Date.now()) - Date.now()) / 1000,
      ),
    );
    const message = `${node.name} is depleted. Respawn estimate: ${seconds}s.`;
    writeHarthmereGatheringState(
      appendLog(state, {
        label: "Node Depleted",
        detail: message,
        nodeId: node.id,
        profession: node.profession,
      }),
    );
    return { ok: false, message };
  }

  if (node.requiredTool && !hasInventoryItem(node.requiredTool)) {
    const message = `${node.name} requires ${node.requiredTool.replaceAll("_", " ")}. Claim starter tools at the Market Board, Smithy, Farm, Docks, or Guard Yard.`;
    writeHarthmereGatheringState(
      appendLog(state, {
        label: "Missing Tool",
        detail: message,
        nodeId: node.id,
        profession: node.profession,
      }),
    );
    return { ok: false, message };
  }

  if (profession.level < node.requiredSkill) {
    const message = `${node.name} requires ${node.profession.replaceAll("_", " ")} ${node.requiredSkill}. You are level ${profession.level}.`;
    writeHarthmereGatheringState(
      appendLog(state, {
        label: "Skill Too Low",
        detail: message,
        nodeId: node.id,
        profession: node.profession,
      }),
    );
    return { ok: false, message };
  }

  const legal = !isIllegalGather(node, options?.forceIllegal);
  const yieldMultiplier = skillYieldMultiplier(
    profession.level,
    node.requiredSkill,
  );
  const rareMultiplier = rareChanceMultiplier(
    profession.level,
    node.requiredSkill,
  );
  const materials: Record<string, number> = {};

  for (const item of node.baseYield) {
    const quantity = Math.max(
      1,
      Math.round(rollInt(item.min, item.max) * yieldMultiplier),
    );
    materials[item.itemId] = (materials[item.itemId] ?? 0) + quantity;
    grantHarthmereItem(item.itemId, quantity, `Gathered from ${node.name}`);
  }

  let rareFind: string | undefined;
  for (const item of node.rareYield ?? []) {
    const chance = Math.min(0.75, item.chance * rareMultiplier);
    if (Math.random() <= chance) {
      const quantity = rollInt(item.min, item.max);
      materials[item.itemId] = (materials[item.itemId] ?? 0) + quantity;
      grantHarthmereItem(item.itemId, quantity, `Rare find from ${node.name}`);
      rareFind = item.itemId;
    }
  }

  const professionXp = professionXpForNode(node);
  const professionResult = applyProfessionXp(
    state,
    node.profession,
    professionXp,
  );
  state = professionResult.state;

  awardHarthmereXp({
    source: "exploration",
    label: `Gathered: ${node.name}`,
    detail: `Gathering raw materials grants a small amount of character XP and profession growth.`,
    baseXp: Math.max(4, node.tier * 8),
    sourceLevel: Math.max(1, node.tier),
    difficulty: node.tier >= 2 ? "normal" : "easy",
  });

  const recentCount = state.nodeGatherCounts[node.id] ?? 0;
  const suspiciousRouteScore = Math.max(
    0,
    state.suspiciousRouteScore + (recentCount > 8 ? 1 : 0),
  );
  state = {
    ...state,
    nodeCooldowns:
      node.shareMode === "personal"
        ? state.nodeCooldowns
        : { ...state.nodeCooldowns, [node.id]: nextRespawnAt(node) },
    nodeGatherCounts: {
      ...state.nodeGatherCounts,
      [node.id]: recentCount + 1,
    },
    discoveredResources: Array.from(
      new Set([
        ...state.discoveredResources,
        node.id,
        ...Object.keys(materials),
      ]),
    ),
    lastGatherAt: Date.now(),
    suspiciousRouteScore,
  };

  if (!legal) {
    applyHarthmereReputationChange({
      label: "Illegal Gathering",
      detail: `${node.name} was gathered without permission. Witnesses may treat it as theft or trespass.`,
      harthmere: { likeability: -12, legal: -45, notoriety: 5 },
      scope: "harthmere",
    });
  }

  updateTownSupply(node, legal, node.name);

  const materialSummary = Object.entries(materials)
    .map(([itemId, quantity]) => `${itemId.replaceAll("_", " ")} x${quantity}`)
    .join(", ");

  const detail = `${materialSummary}. ${professionXp} ${node.profession.replaceAll("_", " ")} XP.${
    professionResult.leveled
      ? ` ${node.profession.replaceAll("_", " ")} rose to level ${professionResult.level}.`
      : ""
  }${rareFind ? ` Rare find: ${rareFind.replaceAll("_", " ")}.` : ""}${
    legal ? "" : " This was illegal and affected your local standing."
  }`;

  writeHarthmereGatheringState(
    appendLog(state, {
      label: `Gathered ${node.name}`,
      detail,
      nodeId: node.id,
      profession: node.profession,
      materials,
      rareFind,
      legal,
    }),
  );

  return { ok: true, message: detail };
}

export function grantHarthmereStarterGatheringTools() {
  for (const tool of STARTER_TOOLS) {
    if (!hasInventoryItem(tool)) {
      grantHarthmereItem(tool, 1, "Starter gathering tool kit");
    }
  }
  writeHarthmereGatheringState(
    appendLog(readHarthmereGatheringState(), {
      label: "Starter Gathering Tools",
      detail:
        "You received a pickaxe, axe, sickle, fishing rod, skinning knife, scavenger hook, shovel, and arcane extractor. Tools live in inventory/bank and are checked before gathering.",
    }),
  );
}

export function resetHarthmereGatheringState() {
  writeHarthmereGatheringState(defaultState());
}

export function useHarthmereGatheringState() {
  const [state, setState] = useState<HarthmereGatheringState>(() =>
    readHarthmereGatheringState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereGatheringState());
    const interval = window.setInterval(refresh, 900);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_GATHERING_EVENT, refresh);
    window.addEventListener("biomes:harthmere-inventory-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_GATHERING_EVENT, refresh);
      window.removeEventListener("biomes:harthmere-inventory-changed", refresh);
    };
  }, []);

  return state;
}

function professionLabel(profession: GatheringProfession) {
  return profession
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nodeDistanceText(node: ResourceNodeDefinition) {
  return `${node.district} · ${Math.round(node.position[0])}, ${Math.round(
    node.position[2],
  )}`;
}

function nodeStatus(
  state: HarthmereGatheringState,
  node: ResourceNodeDefinition,
) {
  if (cooldownReady(state, node) || node.shareMode === "personal") {
    return "Ready";
  }
  const seconds = Math.max(
    1,
    Math.ceil(
      ((state.nodeCooldowns[node.id] ?? Date.now()) - Date.now()) / 1000,
    ),
  );
  return `${seconds}s`;
}

function nodesForNpc(offset: number) {
  const byOffset: Record<number, string[]> = {
    41: NODE_DEFINITIONS.map((node) => node.id),
    42: ["harthmere_north_iron_vein", "harthmere_orchard_softwood", "greenmere_oak_grove", "watchtower_iron_cut"],
    2: ["harthmere_orchard_softwood", "harthmere_farm_crops"],
    6: ["harthmere_north_iron_vein", "harthmere_wolf_carcass"],
    7: ["harthmere_temple_peacebloom", "harthmere_old_well_essence"],
    8: ["harthmere_temple_peacebloom", "harthmere_chapel_relic_dig", "gravewood_moss_and_nightshade", "gravewood_zombie_remains"],
    10: ["harthmere_old_well_essence", "harthmere_chapel_relic_dig", "greenmere_berry_thicket", "old_wood_mushroom_ring"],
    13: ["harthmere_river_fishing_pool", "harthmere_river_clay", "briarfen_reed_bed", "briarfen_clay_bank"],
    14: ["harthmere_mudden_scrap", "harthmere_old_well_essence"],
    16: ["harthmere_farm_crops", "gate_field_flax_row", "orchard_honey_hive", "harthmere_orchard_softwood"],
    27: ["harthmere_wolf_carcass", "watchtower_iron_cut", "bandit_ridge_coal_seam", "deer_hunting_trail"],
  };
  return (byOffset[offset] ?? [])
    .map(nodeById)
    .filter(Boolean) as ResourceNodeDefinition[];
}

export function gatheringActionsForHarthmereNpc(
  offset: number,
): TalkDialogStepAction[] {
  const nodes = nodesForNpc(offset);
  const actions: TalkDialogStepAction[] = [];

  if ([41, 42, 6, 13, 16, 27].includes(offset)) {
    actions.push({
      name: "Claim starter gathering tools",
      tooltip:
        "Gets the tool kit needed for mining, logging, herbalism, fishing, skinning, scavenging, clay work, and magical harvesting.",
      followUpText:
        "You take the practical tools instead of trying to gather with bare hands. Raw materials will route to material storage when possible.",
      onPerformed: () => grantHarthmereStarterGatheringTools(),
    });
  }

  for (const node of nodes.slice(0, offset === 41 ? 10 : 3)) {
    const illegal = isIllegalGather(node);
    actions.push({
      name: `${illegal ? "[Illegal] " : "Gather: "}${node.name}`,
      tooltip: `${professionLabel(node.profession)} ${node.requiredSkill}. Tool: ${node.requiredTool?.replaceAll("_", " ") ?? "none"}. ${node.area}. ${node.notes}${node.legalWarning ? ` Warning: ${node.legalWarning}` : ""}`,
      followUpText: illegal
        ? `You work quickly around ${node.name}. This resource has ownership or restriction rules, so the town may treat it as theft if noticed.`
        : `You gather from ${node.name}. The materials go to material storage or your backpack depending on item type.`,
      onPerformed: () => {
        performHarthmereGather(node.id);
      },
    });
  }

  if (offset === 41) {
    actions.push({
      name: "Reset local-dev gathering",
      tooltip:
        "Clears Harthmere local-dev gathering professions, node cooldowns, discoveries, and logs.",
      followUpText:
        "Gathering state reset. Nodes, professions, and recent logs are ready for a clean test pass.",
      onPerformed: () => resetHarthmereGatheringState(),
    });
  }

  return actions;
}

export const HarthmereGatheringHUD: React.FunctionComponent<{}> = () => {
  const state = useHarthmereGatheringState();
  const latest = state.recent[0];
  const topProfessions = PROFESSIONS.slice(0, 4)
    .map(
      (profession) =>
        `${professionLabel(profession)} ${state.professions[profession].level}`,
    )
    .join(" · ");

  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-lime-200">
            Harthmere Gathering
          </div>
          <div className="text-xs text-white/80">{topProfessions}</div>
        </div>
        <div className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white/80">
          {state.discoveredResources.length} found
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/80">
        <span className="font-semibold text-lime-100">Latest:</span>{" "}
        {latest?.detail ?? "Gathering nodes ready. Claim starter tools first."}
      </div>
    </div>
  );
};

export const HarthmereGatheringMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereGatheringState();
  const [tab, setTab] = useState<"nodes" | "professions" | "storage" | "guide">(
    "nodes",
  );
  const [filter, setFilter] = useState<"all" | GatheringProfession>("all");
  const inventory = readHarthmereInventoryState();

  const visibleNodes = useMemo(
    () =>
      NODE_DEFINITIONS.filter(
        (node) => filter === "all" || node.profession === filter,
      ),
    [filter],
  );

  const materialRows = Object.entries(inventory.materialStorage)
    .filter(([, quantity]) => quantity > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mb-2 max-h-[70vh] w-[33rem] overflow-hidden rounded-lg border border-white/20 bg-black/85 text-white shadow-xl">
      <div className="border-b border-white/10 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-lime-200">
              Harthmere Gathering
            </div>
            <div className="text-xs text-white/70">
              Mining, logging, herbalism, fishing, farming, scavenging,
              archaeology, corpse harvesting, magical resources, tools,
              ownership, respawns, and profession XP.
            </div>
          </div>
          <button
            className="rounded bg-lime-300 px-2 py-1 text-xs font-semibold text-black hover:bg-lime-200"
            onClick={() => grantHarthmereStarterGatheringTools()}
          >
            Starter Tools
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["nodes", "professions", "storage", "guide"] as const).map(
            (nextTab) => (
              <button
                key={nextTab}
                className={`rounded px-2 py-1 text-xs capitalize ${
                  tab === nextTab
                    ? "bg-lime-300 text-black"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                onClick={() => setTab(nextTab)}
              >
                {nextTab}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto p-3 text-sm">
        {tab === "nodes" && (
          <div className="space-y-2 text-xs leading-snug text-white/75">
            <div className="flex flex-wrap gap-1">
              <button
                className={`rounded px-2 py-1 ${
                  filter === "all" ? "bg-lime-300 text-black" : "bg-white/10"
                }`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              {PROFESSIONS.map((profession) => (
                <button
                  key={profession}
                  className={`rounded px-2 py-1 ${
                    filter === profession
                      ? "bg-lime-300 text-black"
                      : "bg-white/10"
                  }`}
                  onClick={() => setFilter(profession)}
                >
                  {professionLabel(profession)}
                </button>
              ))}
            </div>
            <div className="grid gap-2">
              {visibleNodes.map((node) => {
                const profession = state.professions[node.profession];
                const ready =
                  cooldownReady(state, node) || node.shareMode === "personal";
                const canSkill = profession.level >= node.requiredSkill;
                const hasTool =
                  !node.requiredTool || hasInventoryItem(node.requiredTool);
                const illegal = isIllegalGather(node);
                return (
                  <div
                    key={node.id}
                    className="rounded border border-white/10 bg-white/5 p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-lime-100">
                          {node.name}
                        </div>
                        <div className="text-white/60">
                          {professionLabel(node.profession)}{" "}
                          {node.requiredSkill} · Tier {node.tier} ·{" "}
                          {nodeDistanceText(node)}
                        </div>
                      </div>
                      <div
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          ready
                            ? "bg-lime-300 text-black"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {nodeStatus(state, node)}
                      </div>
                    </div>
                    <div className="mt-1 text-white/70">{node.notes}</div>
                    {node.legalWarning && (
                      <div className="mt-1 rounded border border-yellow-300/30 bg-yellow-500/10 p-1 text-yellow-100">
                        {node.legalWarning}
                      </div>
                    )}
                    {node.danger && (
                      <div className="mt-1 rounded border border-red-300/30 bg-red-500/10 p-1 text-red-100">
                        Danger: {node.danger}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <button
                        className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20 disabled:opacity-40"
                        disabled={!ready || !canSkill || !hasTool}
                        onClick={() => performHarthmereGather(node.id)}
                      >
                        Gather
                      </button>
                      {illegal && (
                        <button
                          className="rounded bg-red-500/30 px-2 py-1 text-[10px] hover:bg-red-500/50"
                          onClick={() =>
                            performHarthmereGather(node.id, {
                              ignoreCooldown: node.shareMode === "personal",
                              forceIllegal: true,
                            })
                          }
                        >
                          Gather Illegally
                        </button>
                      )}
                      {!hasTool && (
                        <span className="text-[10px] text-red-200">
                          Missing {node.requiredTool?.replaceAll("_", " ")}
                        </span>
                      )}
                      {!canSkill && (
                        <span className="text-[10px] text-red-200">
                          Skill too low
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "professions" && (
          <div className="grid grid-cols-2 gap-2 text-xs text-white/75">
            {PROFESSIONS.map((profession) => {
              const data = state.professions[profession];
              const needed = xpRequiredForProfessionLevel(data.level);
              return (
                <div
                  key={profession}
                  className="rounded border border-white/10 bg-white/5 p-2"
                >
                  <div className="font-semibold text-lime-100">
                    {professionLabel(profession)}
                  </div>
                  <div>Level {data.level}</div>
                  <div>
                    XP {data.xp}/{needed}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
                    <div
                      className="h-full bg-lime-300"
                      style={{
                        width: `${Math.min(100, (data.xp / needed) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "storage" && (
          <div className="space-y-2 text-xs text-white/75">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              Material storage is used first for raw materials so gathering does
              not clog the normal backpack. Quest resources should go to the
              quest pouch and money-like rewards should go to the wallet.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {materialRows.length ? (
                materialRows.map(([itemId, quantity]) => (
                  <div
                    key={itemId}
                    className="rounded border border-white/10 bg-white/5 p-2"
                  >
                    {itemId.replaceAll("_", " ")} x{quantity}
                  </div>
                ))
              ) : (
                <div className="rounded border border-white/10 bg-white/5 p-2">
                  No stored materials yet.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "guide" && (
          <div className="space-y-2 text-xs leading-snug text-white/75">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              Nodes are placed where the material makes sense: ore near rock,
              herbs in gardens, fish in water, clay at riverbanks, wood beneath
              trees, scrap in alleys, animal parts from carcasses, relics near
              graves, and magical residue near the Old Well.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              Tools and skill are checked before the gather. Better profession
              levels improve yield and rare find chances, but normal starter
              gathering does not randomly fail when requirements are met.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              Ownership matters. Public resources are safe. Owned crops,
              protected magical sites, and restricted grave/temple resources can
              lower Legal Standing if gathered without permission.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              This local-dev system models server-authoritative gathering:
              production should validate node existence, distance, line of
              sight, tool, skill, player state, yield rolls, storage capacity,
              cooldowns, and anti-bot logs server-side.
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-white/60">
          Recent: {state.recent[0]?.detail ?? "No gathering events yet."}
        </div>
      </div>
    </div>
  );
};
