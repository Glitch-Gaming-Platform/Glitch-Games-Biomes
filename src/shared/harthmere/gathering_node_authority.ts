/*
 * Server-owned gathering-node catalogue.
 *
 * The definitions are extracted from the authored Harthmere node list, but all
 * validation and random rolls happen on the server. The browser may request a
 * node id; it may not choose its position, yield, rarity, tool result, or
 * respawn time.
 */

import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import {
  harthmereAdditiveTownGatheringNodePositionOverride,
  harthmereGatheringTerrainFrame,
  harthmereOriginalHillyGatheringNodePosition,
  type HarthmereGatheringTerrainFrame,
} from "@/shared/harthmere/gathering_node_terrain_positions";
import { normalizeHarthmereExtensionOutdoorFeetPosition } from "@/shared/harthmere/world_extension";
import type { BiomesId } from "@/shared/ids";
import { hasFishingRodIdentity } from "@/shared/harthmere/fishing_rods";

export const HARTHMERE_GATHERING_NODE_AUTHORITY_VERSION =
  "harthmere-gathering-node-authority-2026-08-04" as const;
export const HARTHMERE_GATHERING_NODE_INTERACTION_RADIUS = 5;

export interface HarthmereEquippedGatheringToolIdentity {
  id?: BiomesId;
  semanticItemId?: string;
  isAxe?: boolean;
  isPickaxe?: boolean;
  action?: string;
}

const HARTHMERE_GATHERING_TOOL_LABELS: Readonly<Record<string, string>> = {
  rusty_pickaxe: "pickaxe",
  woodcutters_axe: "axe",
  herbalist_sickle: "herbalist sickle",
  simple_fishing_rod: "fishing rod",
  scavenger_hook: "scavenger hook",
  clay_shovel: "clay shovel",
  arcane_extractor: "arcane extractor",
  skinning_knife: "skinning knife",
};

export function harthmereGatheringToolLabel(requiredTool: string) {
  return (
    HARTHMERE_GATHERING_TOOL_LABELS[requiredTool] ??
    requiredTool.replaceAll("_", " ")
  );
}

/**
 * Project one authoritative equipped ECS item into every gathering requirement
 * it satisfies. Exact specialist tools keep their semantic identity, while
 * standard native axes, pickaxes, and fishing rods satisfy the corresponding
 * profession requirement regardless of which authored tier/variant is held.
 */
export function harthmereGatheringRequirementKeysForEquippedTool(
  input: HarthmereEquippedGatheringToolIdentity
) {
  const keys = new Set<string>();
  const semanticItemId = input.semanticItemId?.trim().toLowerCase();
  if (semanticItemId) {
    keys.add(semanticItemId);
  }

  const semanticAxe =
    Boolean(semanticItemId?.match(/(?:^|_)axe$/)) &&
    !semanticItemId?.endsWith("pickaxe");
  if (input.isAxe || semanticAxe) {
    keys.add("woodcutters_axe");
  }
  if (input.isPickaxe || semanticItemId?.endsWith("pickaxe")) {
    keys.add("rusty_pickaxe");
  }
  if (
    input.action === "fish" ||
    hasFishingRodIdentity({
      itemIds: semanticItemId ? [semanticItemId] : undefined,
      biomesItemIds: input.id === undefined ? undefined : [input.id],
    })
  ) {
    keys.add("simple_fishing_rod");
  }
  return [...keys];
}

export interface HarthmereGatheringAuthorityNode {
  id: string;
  name: string;
  profession: string;
  requiredTool?: string;
  requiredSkill: number;
  position: readonly [number, number, number];
  terrainFrame: HarthmereGatheringTerrainFrame;
  shareMode: "shared" | "semi_shared" | "personal";
  ownership: "public" | "town" | "owned" | "temple" | "protected" | "illegal";
  minRespawnSeconds: number;
  maxRespawnSeconds: number;
  baseYield: readonly { itemId: string; min: number; max: number }[];
  rareYield: readonly {
    itemId: string;
    min: number;
    max: number;
    chance: number;
  }[];
}

const HARTHMERE_GATHERING_AUTHORED_AUTHORITY_NODES = [
  {
    id: "harthmere_north_iron_vein",
    name: "North Road Iron Vein",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 1,
    position: [503, 53, -270],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      {
        itemId: "iron_ore",
        min: 2,
        max: 4,
      },
      {
        itemId: "rough_stone",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "rough_garnet",
        min: 1,
        max: 1,
        chance: 0.06,
      },
    ],
  },
  {
    id: "harthmere_orchard_softwood",
    name: "Orchard Softwood Branches",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 1,
    position: [468, 53, -118],
    shareMode: "semi_shared",
    ownership: "town",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 540,
    baseYield: [
      {
        itemId: "softwood_log",
        min: 2,
        max: 5,
      },
      {
        itemId: "oak_branch",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "tree_resin",
        min: 1,
        max: 1,
        chance: 0.08,
      },
    ],
  },
  {
    id: "harthmere_temple_peacebloom",
    name: "Temple Peacebloom Bed",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 1,
    position: [493, 53, -158],
    shareMode: "personal",
    ownership: "temple",
    minRespawnSeconds: 150,
    maxRespawnSeconds: 360,
    baseYield: [
      {
        itemId: "peacebloom",
        min: 2,
        max: 4,
      },
      {
        itemId: "willow_bark",
        min: 1,
        max: 2,
      },
      // HARTHMERE_JOB_MATERIAL_SOURCE: clinic herb-run jobs require bundles.
      {
        itemId: "herb_bundle",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "fine_peacebloom",
        min: 1,
        max: 1,
        chance: 0.05,
      },
    ],
  },
  {
    id: "harthmere_river_fishing_pool",
    name: "Bluewater Fishing Pool",
    profession: "fishing",
    requiredTool: "simple_fishing_rod",
    requiredSkill: 1,
    position: [604, 53, -168],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      {
        itemId: "river_trout",
        min: 1,
        max: 3,
      },
      {
        itemId: "clean_water",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "river_pearl",
        min: 1,
        max: 1,
        chance: 0.03,
      },
    ],
  },
  {
    id: "harthmere_farm_crops",
    name: "Farm Crop Row",
    profession: "farming",
    requiredSkill: 1,
    position: [450, 53, -232],
    shareMode: "personal",
    ownership: "owned",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 360,
    baseYield: [
      {
        itemId: "field_wheat",
        min: 2,
        max: 5,
      },
      {
        itemId: "fresh_carrot",
        min: 1,
        max: 3,
      },
      // HARTHMERE_JOB_MATERIAL_SOURCE: the farm job asks for crop bundles, so
      // the farm row must actually produce them.
      {
        itemId: "crop_bundle",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "golden_carrot",
        min: 1,
        max: 1,
        chance: 0.02,
      },
    ],
  },
  {
    id: "harthmere_mudden_scrap",
    name: "Mudden Ward Scrap Pile",
    profession: "scavenging",
    requiredTool: "scavenger_hook",
    requiredSkill: 1,
    position: [409, 39, -178],
    shareMode: "shared",
    ownership: "public",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 480,
    baseYield: [
      {
        itemId: "scrap_metal",
        min: 1,
        max: 4,
      },
      {
        itemId: "cloth_scrap",
        min: 1,
        max: 3,
      },
      // HARTHMERE_JOB_MATERIAL_SOURCE: sanitation cleanup jobs require mixed
      // waste; scavenging the ward scrap pile is the player-facing source.
      {
        itemId: "mixed_waste",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "old_coin",
        min: 1,
        max: 2,
        chance: 0.08,
      },
    ],
  },
  {
    id: "harthmere_river_clay",
    name: "Riverbank Clay Deposit",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    position: [596, 53, -186],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      {
        itemId: "river_clay",
        min: 2,
        max: 5,
      },
      {
        itemId: "sand_lump",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "blue_glass_shard",
        min: 1,
        max: 1,
        chance: 0.04,
      },
    ],
  },
  {
    id: "harthmere_old_well_essence",
    name: "Old Well Mana Residue",
    profession: "magical_harvesting",
    requiredTool: "arcane_extractor",
    requiredSkill: 3,
    position: [428, 53, -160],
    shareMode: "personal",
    ownership: "protected",
    minRespawnSeconds: 420,
    maxRespawnSeconds: 900,
    baseYield: [
      {
        itemId: "mana_essence",
        min: 1,
        max: 2,
      },
      {
        itemId: "raw_exotic_matter",
        min: 1,
        max: 1,
      },
    ],
    rareYield: [
      {
        itemId: "mana_crystal_shard",
        min: 1,
        max: 1,
        chance: 0.08,
      },
    ],
  },
  {
    id: "harthmere_chapel_relic_dig",
    name: "Old Grave Relic Dig",
    profession: "archaeology",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    position: [501, 53, -145],
    shareMode: "personal",
    ownership: "temple",
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      {
        itemId: "relic_fragment",
        min: 1,
        max: 2,
      },
      {
        itemId: "old_bone_button",
        min: 1,
        max: 1,
      },
    ],
    rareYield: [
      {
        itemId: "saint_coin",
        min: 1,
        max: 1,
        chance: 0.03,
      },
    ],
  },
  {
    id: "harthmere_wolf_carcass",
    name: "Road Wolf Carcass",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 1,
    position: [518, 53, -252],
    shareMode: "personal",
    ownership: "town",
    minRespawnSeconds: 360,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "wolf_hide",
        min: 1,
        max: 3,
      },
      {
        itemId: "raw_meat",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "wolf_fang",
        min: 1,
        max: 1,
        chance: 0.08,
      },
    ],
  },
  {
    id: "greenmere_oak_grove",
    name: "Greenmere Oak Grove",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 1,
    position: [506, 53, -382],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 540,
    baseYield: [
      {
        itemId: "oak_log",
        min: 3,
        max: 6,
      },
      {
        itemId: "oak_branch",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "tree_resin",
        min: 1,
        max: 2,
        chance: 0.1,
      },
    ],
  },
  {
    id: "north_pine_stand",
    name: "North Greenmere Pine Stand",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    position: [625, 53, -662],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "pine_log",
        min: 3,
        max: 5,
      },
      {
        itemId: "pine_pitch",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "straight_pine_heartwood",
        min: 1,
        max: 1,
        chance: 0.06,
      },
    ],
  },
  {
    id: "old_wood_birch_grove",
    name: "Old Wood Birch Grove",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    position: [250, 53, -350],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 660,
    baseYield: [
      {
        itemId: "birch_bark",
        min: 2,
        max: 4,
      },
      {
        itemId: "lightwood_log",
        min: 2,
        max: 4,
      },
    ],
    rareYield: [
      {
        itemId: "clean_birch_strip",
        min: 1,
        max: 1,
        chance: 0.08,
      },
    ],
  },
  {
    id: "briarfen_willow_cuttings",
    name: "Briarfen Willow Cuttings",
    profession: "logging",
    requiredTool: "woodcutters_axe",
    requiredSkill: 2,
    position: [772, 53, -412],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "willow_bark",
        min: 2,
        max: 5,
      },
      {
        itemId: "flexible_willow",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "flood_willow_sap",
        min: 1,
        max: 1,
        chance: 0.07,
      },
    ],
  },
  {
    id: "watchtower_iron_cut",
    name: "Watchtower Iron Cut",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 2,
    position: [178, 53, -604],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "iron_ore",
        min: 3,
        max: 6,
      },
      {
        itemId: "rough_stone",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "black_iron_shard",
        min: 1,
        max: 1,
        chance: 0.05,
      },
    ],
  },
  {
    id: "bandit_ridge_coal_seam",
    name: "Bandit Ridge Coal Seam",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 1,
    position: [244, 53, -532],
    shareMode: "shared",
    ownership: "public",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      {
        itemId: "coal",
        min: 3,
        max: 7,
      },
      {
        itemId: "rough_stone",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "dense_coal_lump",
        min: 1,
        max: 1,
        chance: 0.07,
      },
    ],
  },
  {
    id: "old_wood_silver_thread",
    name: "Old Wood Silver Thread",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 3,
    position: [-190, 53, 92],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      {
        itemId: "silver_ore",
        min: 1,
        max: 3,
      },
      {
        itemId: "rough_stone",
        min: 2,
        max: 4,
      },
    ],
    rareYield: [
      {
        itemId: "bright_silver_nugget",
        min: 1,
        max: 1,
        chance: 0.04,
      },
    ],
  },
  {
    id: "gravewood_gold_fragment",
    name: "Gravewood Gold Fragment",
    profession: "mining",
    requiredTool: "rusty_pickaxe",
    requiredSkill: 4,
    position: [822, 53, 344],
    shareMode: "personal",
    ownership: "protected",
    minRespawnSeconds: 900,
    maxRespawnSeconds: 1800,
    baseYield: [
      {
        itemId: "gold_ore",
        min: 1,
        max: 2,
      },
      {
        itemId: "grave_stone_chip",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "bell_gold_flake",
        min: 1,
        max: 1,
        chance: 0.03,
      },
    ],
  },
  {
    id: "greenmere_berry_thicket",
    name: "Greenmere Berry Thicket",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 1,
    position: [546, 53, -430],
    shareMode: "personal",
    ownership: "public",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      {
        itemId: "wild_berries",
        min: 2,
        max: 5,
      },
      {
        itemId: "berry_leaf",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "sweet_greenmere_berry",
        min: 1,
        max: 1,
        chance: 0.06,
      },
    ],
  },
  {
    id: "old_wood_mushroom_ring",
    name: "Old Wood Mushroom Ring",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 2,
    position: [42, 53, -138],
    shareMode: "personal",
    ownership: "public",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 600,
    baseYield: [
      {
        itemId: "forest_mushroom",
        min: 2,
        max: 4,
      },
      {
        itemId: "damp_moss",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "mooncap_mushroom",
        min: 1,
        max: 1,
        chance: 0.05,
      },
    ],
  },
  {
    id: "briarfen_reed_bed",
    name: "Briarfen Reed Bed",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    position: [780, 53, -378],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 240,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "reed_bundle",
        min: 2,
        max: 5,
      },
      {
        itemId: "mudroot",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "flood_lotus",
        min: 1,
        max: 1,
        chance: 0.03,
      },
    ],
  },
  {
    id: "briarfen_clay_bank",
    name: "Briarfen Blackwater Clay Bank",
    profession: "scavenging",
    requiredTool: "clay_shovel",
    requiredSkill: 2,
    position: [864, 53, -286],
    shareMode: "semi_shared",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "blackwater_clay",
        min: 2,
        max: 5,
      },
      {
        itemId: "sand_lump",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "ghost_pearl",
        min: 1,
        max: 1,
        chance: 0.02,
      },
    ],
  },
  {
    id: "gravewood_moss_and_nightshade",
    name: "Gravewood Moss and Nightshade",
    profession: "herbalism",
    requiredTool: "herbalist_sickle",
    requiredSkill: 3,
    position: [736, 53, 314],
    shareMode: "personal",
    ownership: "temple",
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      {
        itemId: "grave_moss",
        min: 1,
        max: 3,
      },
      {
        itemId: "nightshade",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "ghost_ash",
        min: 1,
        max: 1,
        chance: 0.04,
      },
    ],
  },
  {
    id: "gate_field_flax_row",
    name: "Gate Field Flax Row",
    profession: "farming",
    requiredSkill: 1,
    position: [430, 53, -350],
    shareMode: "personal",
    ownership: "owned",
    minRespawnSeconds: 180,
    maxRespawnSeconds: 420,
    baseYield: [
      {
        itemId: "flax_stalk",
        min: 2,
        max: 5,
      },
      {
        itemId: "plant_fiber",
        min: 1,
        max: 3,
      },
    ],
    rareYield: [
      {
        itemId: "clean_flax_bundle",
        min: 1,
        max: 1,
        chance: 0.06,
      },
    ],
  },
  {
    id: "orchard_honey_hive",
    name: "Orchard Honey Hive",
    profession: "farming",
    requiredSkill: 2,
    position: [394, 53, -378],
    shareMode: "personal",
    ownership: "owned",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "honeycomb",
        min: 1,
        max: 3,
      },
      {
        itemId: "beeswax",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "queen_honey",
        min: 1,
        max: 1,
        chance: 0.03,
      },
    ],
  },
  {
    id: "deer_hunting_trail",
    name: "Deer Hunting Trail",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 1,
    position: [532, 53, -388],
    shareMode: "personal",
    ownership: "public",
    minRespawnSeconds: 300,
    maxRespawnSeconds: 720,
    baseYield: [
      {
        itemId: "deer_hide",
        min: 1,
        max: 2,
      },
      {
        itemId: "venison",
        min: 1,
        max: 3,
      },
      // HARTHMERE_JOB_MATERIAL_SOURCE: hunter jobs require wild meat.
      {
        itemId: "wild_meat",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "clean_antler",
        min: 1,
        max: 1,
        chance: 0.07,
      },
    ],
  },
  {
    id: "boar_sounder_harvest",
    name: "Boar Sounder Harvest",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 2,
    position: [404, 53, -414],
    shareMode: "personal",
    ownership: "public",
    minRespawnSeconds: 360,
    maxRespawnSeconds: 900,
    baseYield: [
      {
        itemId: "boar_hide",
        min: 1,
        max: 2,
      },
      {
        itemId: "boar_tusk",
        min: 1,
        max: 2,
      },
      {
        itemId: "raw_meat",
        min: 1,
        max: 3,
      },
      // HARTHMERE_JOB_MATERIAL_SOURCE: hunter jobs require wild meat.
      {
        itemId: "wild_meat",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "heavy_boar_bristle",
        min: 1,
        max: 1,
        chance: 0.08,
      },
    ],
  },
  {
    id: "bear_den_harvest",
    name: "Black Bear Den Harvest",
    profession: "skinning",
    requiredTool: "skinning_knife",
    requiredSkill: 3,
    position: [606, 53, -482],
    shareMode: "personal",
    ownership: "public",
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      {
        itemId: "bear_hide",
        min: 1,
        max: 2,
      },
      {
        itemId: "bear_fat",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "black_bear_claw",
        min: 1,
        max: 1,
        chance: 0.06,
      },
    ],
  },
  {
    id: "gravewood_zombie_remains",
    name: "Bell-Woken Zombie Remains",
    profession: "monster_harvesting",
    requiredTool: "scavenger_hook",
    requiredSkill: 2,
    position: [536, 53, -119],
    shareMode: "personal",
    ownership: "protected",
    minRespawnSeconds: 600,
    maxRespawnSeconds: 1200,
    baseYield: [
      {
        itemId: "grave_dust",
        min: 1,
        max: 3,
      },
      {
        itemId: "bone_fragment",
        min: 1,
        max: 2,
      },
    ],
    rareYield: [
      {
        itemId: "bell_woken_ash",
        min: 1,
        max: 1,
        chance: 0.05,
      },
    ],
  },
] as const satisfies readonly Omit<
  HarthmereGatheringAuthorityNode,
  "terrainFrame"
>[];

function runtimeGatheringNodePosition(
  node: (typeof HARTHMERE_GATHERING_AUTHORED_AUTHORITY_NODES)[number]
) {
  const terrainFrame = harthmereGatheringTerrainFrame(node.id);
  if (terrainFrame === "original_hilly") {
    return harthmereOriginalHillyGatheringNodePosition(node.id)!;
  }
  const additiveOverride = harthmereAdditiveTownGatheringNodePositionOverride(
    node.id
  );
  if (additiveOverride) {
    return additiveOverride;
  }
  return normalizeHarthmereExtensionOutdoorFeetPosition(
    shiftHarthmereAuthoredPositionToWorld(node.position)
  );
}

// Town nodes cross the +1600 additive-world boundary and normally use its flat
// Y=53 surface. Audited terrain exceptions use explicit world-space overrides.
// Deep-wilds nodes intentionally stay on their original-map X/Z and use
// production-probed hill heights. Native authority and the browser consume this
// same resolved catalogue, so map pins, prompts, range validation, and ECS loot
// drops cannot disagree about where a node exists.
export const HARTHMERE_GATHERING_AUTHORITY_NODES: readonly HarthmereGatheringAuthorityNode[] =
  HARTHMERE_GATHERING_AUTHORED_AUTHORITY_NODES.map((node) => {
    const terrainFrame = harthmereGatheringTerrainFrame(node.id);
    if (!terrainFrame) {
      throw new Error(`Missing gathering terrain frame for ${node.id}`);
    }
    return {
      ...node,
      position: runtimeGatheringNodePosition(node),
      terrainFrame,
    };
  });

const NODES_BY_ID: ReadonlyMap<string, HarthmereGatheringAuthorityNode> =
  new Map(HARTHMERE_GATHERING_AUTHORITY_NODES.map((node) => [node.id, node]));

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function rollWhole(random: () => number, min: number, max: number) {
  const low = Math.max(0, Math.ceil(min));
  const high = Math.max(low, Math.floor(max));
  return low + Math.floor(random() * (high - low + 1));
}

export function harthmereGatheringAuthorityNode(
  nodeId: string | undefined
): HarthmereGatheringAuthorityNode | undefined {
  return nodeId ? NODES_BY_ID.get(nodeId) : undefined;
}

export type HarthmereGatheringAuthorityResult =
  | {
      ok: true;
      node: HarthmereGatheringAuthorityNode;
      itemDeltas: Record<string, number>;
      respawnAtMs: number;
      illegal: boolean;
    }
  | { ok: false; reason: string };

export function resolveHarthmereGatheringAuthorityAttempt(input: {
  nodeId: string;
  actorPosition?: { x: number; y: number; z: number };
  equippedItemIds: readonly string[];
  equippedBiomesItemIds?: readonly BiomesId[];
  professionLevel: number;
  nowMs: number;
  randomSeed: string;
}): HarthmereGatheringAuthorityResult {
  const node = harthmereGatheringAuthorityNode(input.nodeId);
  if (!node) return { ok: false, reason: "unknown_node" };
  if (!input.actorPosition) {
    return { ok: false, reason: "actor_position_unverified" };
  }
  const dx = input.actorPosition.x - node.position[0];
  const dy = input.actorPosition.y - node.position[1];
  const dz = input.actorPosition.z - node.position[2];
  if (
    dx * dx + dy * dy + dz * dz >
    HARTHMERE_GATHERING_NODE_INTERACTION_RADIUS ** 2
  ) {
    return { ok: false, reason: "node_out_of_range" };
  }
  const hasRequiredTool =
    !node.requiredTool ||
    (node.profession === "fishing"
      ? hasFishingRodIdentity({
          itemIds: input.equippedItemIds,
          biomesItemIds: input.equippedBiomesItemIds,
        })
      : input.equippedItemIds.includes(node.requiredTool) ||
        (() => {
          const nativeRequiredToolId = harthmereNativeBiomesIdForItemId(
            node.requiredTool
          );
          return (
            nativeRequiredToolId !== undefined &&
            (input.equippedBiomesItemIds?.includes(nativeRequiredToolId) ??
              false)
          );
        })());
  if (!hasRequiredTool) {
    return { ok: false, reason: "required_tool_missing:" + node.requiredTool };
  }
  if (input.professionLevel < node.requiredSkill) {
    return {
      ok: false,
      reason:
        "profession_level_too_low:" +
        node.profession +
        ":" +
        node.requiredSkill,
    };
  }

  const random = seededRandom(
    input.randomSeed + ":" + node.id + ":" + Math.trunc(input.nowMs)
  );
  const itemDeltas: Record<string, number> = {};
  for (const item of node.baseYield) {
    itemDeltas[item.itemId] =
      (itemDeltas[item.itemId] ?? 0) + rollWhole(random, item.min, item.max);
  }
  for (const item of node.rareYield) {
    if (random() <= Math.max(0, Math.min(1, item.chance))) {
      itemDeltas[item.itemId] =
        (itemDeltas[item.itemId] ?? 0) + rollWhole(random, item.min, item.max);
    }
  }
  const respawnSeconds = rollWhole(
    random,
    node.minRespawnSeconds,
    node.maxRespawnSeconds
  );
  return {
    ok: true,
    node,
    itemDeltas,
    respawnAtMs: input.nowMs + respawnSeconds * 1000,
    illegal:
      node.ownership === "owned" ||
      node.ownership === "protected" ||
      node.ownership === "illegal",
  };
}
