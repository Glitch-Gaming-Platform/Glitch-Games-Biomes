import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

// HARTHMERE_GATHERING_NODE_TERRAIN_POSITIONS
//
// Gathering uses the same two coordinate frames as the rest of Harthmere:
//
// - Town nodes are authored in local Harthmere coordinates, shifted into the
//   additive east extension, and placed on its deterministic feet plane Y=53.
// - Deep-wilds nodes remain on the original production map. That terrain is
//   hilly, so their Y values come from a real open-sky terrain probe instead of
//   the old flat y=53 hint.
//
// The original-map positions below were read-only probed against production
// revision biomes-node-vnet--0000190 on 2026-07-23. The deployment grounding
// gate re-probes them, so terrain changes fail loudly instead of silently
// burying or floating a node.

export const HARTHMERE_GATHERING_NODE_TERRAIN_POSITIONS_VERSION =
  "harthmere-gathering-node-terrain-2026-07-23" as const;
export const HARTHMERE_GATHERING_NODE_TERRAIN_PRODUCTION_REVISION =
  "biomes-node-vnet--0000190" as const;

export type HarthmereGatheringTerrainFrame = "additive_town" | "original_hilly";

export const HARTHMERE_ADDITIVE_TOWN_GATHERING_NODE_IDS: ReadonlySet<string> =
  new Set([
    "harthmere_north_iron_vein",
    "harthmere_orchard_softwood",
    "harthmere_temple_peacebloom",
    "harthmere_river_fishing_pool",
    "harthmere_farm_crops",
    "harthmere_mudden_scrap",
    "harthmere_river_clay",
    "harthmere_old_well_essence",
    "harthmere_chapel_relic_dig",
    "harthmere_wolf_carcass",
  ]);

export const HARTHMERE_ORIGINAL_HILLY_GATHERING_NODE_POSITIONS: Readonly<
  Record<string, ReadonlyVec3>
> = {
  greenmere_oak_grove: [506, 38, -382],
  north_pine_stand: [625, 40, -662],
  old_wood_birch_grove: [250, 46, -350],
  briarfen_willow_cuttings: [772, 58, -412],
  watchtower_iron_cut: [178, 27, -604],
  bandit_ridge_coal_seam: [244, 28, -532],
  old_wood_silver_thread: [-190, 23, 92],
  gravewood_gold_fragment: [822, 50, 344],
  greenmere_berry_thicket: [546, 41, -430],
  old_wood_mushroom_ring: [42, 32, -138],
  briarfen_reed_bed: [780, 66, -378],
  briarfen_clay_bank: [864, 72, -286],
  gravewood_moss_and_nightshade: [736, 52, 314],
  gate_field_flax_row: [430, 50, -350],
  orchard_honey_hive: [394, 41, -378],
  deer_hunting_trail: [532, 45, -388],
  boar_sounder_harvest: [404, 43, -414],
  bear_den_harvest: [606, 57, -482],
  gravewood_zombie_remains: [536, 77, -119],
};

export function harthmereGatheringTerrainFrame(
  nodeId: string
): HarthmereGatheringTerrainFrame | undefined {
  if (HARTHMERE_ADDITIVE_TOWN_GATHERING_NODE_IDS.has(nodeId)) {
    return "additive_town";
  }
  if (HARTHMERE_ORIGINAL_HILLY_GATHERING_NODE_POSITIONS[nodeId]) {
    return "original_hilly";
  }
  return undefined;
}

export function harthmereOriginalHillyGatheringNodePosition(
  nodeId: string
): Vec3 | undefined {
  const position = HARTHMERE_ORIGINAL_HILLY_GATHERING_NODE_POSITIONS[nodeId];
  return position ? ([...position] as Vec3) : undefined;
}
