/*
 * building_system.ts
 *
 * Production-oriented Building System contract for Grove/Harthmere property.
 * This module is intentionally shared: UI, live-mode reducer, API route tests,
 * and future world seeding all read the same plot/blueprint/NPC catalogue.
 *
 * Design rule: player buildings are solid voxel structures. GLTFs may decorate,
 * but floors/walls/roofs/foundations/stairs must be ECS/world terrain truth.
 */

import {
  registerHarthmereStructureDefinition,
  type HarthmereBuildingPlacementContext,
  type HarthmerePlotDefinition,
  type HarthmerePlotType,
  type HarthmereStructureType,
  type HarthmereTerrainType,
} from "@/shared/harthmere/mmo_building_authority";
import { safeGetTerrainId } from "@/shared/asset_defs/terrain";
import {
  findHarthmereGroundFeetY,
  type HarthmereSolidSampler,
} from "@/shared/harthmere/harthmere_entity_grounding";
import type { BiomesId } from "@/shared/ids";
import { BikkieIds } from "@/shared/bikkie/ids";

export const BUILDING_SYSTEM_VERSION = "building-system-production";
export const BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION =
  "building-system-guide-construction-rules" as const;

export const BUILDING_SYSTEM_GUIDE_ASSET_VOCABULARY = {
  shell: [
    "arch_wall_stone",
    "arch_wall_window_stone",
    "arch_wall_window_glass",
    "arch_wall_wood_door",
    "arch_roof_gable",
    "arch_roof_flat",
    "arch_stairs_wide_stone",
    "obj_wall_stairs",
    "obj_church_grave_wall",
  ],
  interior: [
    "table_small",
    "table_medium",
    "table_long",
    "bench_fp",
    "cabinet",
    "bookcase_2",
    "shelf_large",
    "shelf_small_bottles",
    "candle_triple",
    "crate_wooden_fp",
    "chest",
  ],
  exterior: [
    "obj_sign_post",
    "scroll_1_fp",
    "logs",
    "rock_small",
    "tree_crooked",
    "tree_high",
  ],
} as const;

export type BuildingSystemPlotUse =
  | "home"
  | "business"
  | "workshop"
  | "farm"
  | "storage"
  | "guild"
  | "public_service";

export type BuildingSystemStage =
  | "site_preparation"
  | "foundation"
  | "frame"
  | "walls"
  | "roof"
  | "interior"
  | "utility_setup"
  | "completed";

export const BUILDING_SYSTEM_STAGE_ORDER = [
  "site_preparation",
  "foundation",
  "frame",
  "walls",
  "roof",
  "interior",
  "utility_setup",
  "completed",
] as const satisfies readonly BuildingSystemStage[];

export const BUILDING_SYSTEM_CONSTRUCTION_STAGES = [
  "site_preparation",
  "foundation",
  "frame",
  "walls",
  "roof",
  "interior",
  "utility_setup",
] as const satisfies readonly BuildingSystemStage[];

export type BuildingSystemProjectStatus = "active" | "completed" | "cancelled";

export type BuildingSystemBlueprintSource =
  | "harthmere_catalog"
  | "bikkie_blueprint";

export type BuildingSystemBlueprintMaterializationKind =
  | "solid_structure"
  | "shelter_frame"
  | "market_stall"
  | "canopy"
  | "fixture"
  | "utility_station"
  | "farm_utility"
  | "fence_line"
  | "signal_tower";

export interface BuildingSystemStageProgress {
  materials: Record<string, number>;
  labor: number;
  completedAtMs?: number;
}

export interface BuildingSystemProjectRecord {
  projectId: string;
  actorId: string;
  plotId: string;
  blueprintId: string;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  currentStage: BuildingSystemStage;
  completedStages: BuildingSystemStage[];
  stageProgress: Partial<
    Record<BuildingSystemStage, BuildingSystemStageProgress>
  >;
  startedAtMs: number;
  updatedAtMs: number;
  status: BuildingSystemProjectStatus;
  materializedStageRequestIds: string[];
  storageUnlocked: boolean;
}

export interface BuildingSystemInWorldMarker {
  markerId: string;
  plotId: string;
  kind:
    | "muck_boundary"
    | "safe_zone"
    | "deed_sign"
    | "map_marker"
    | "npc_board"
    | "npc_map_marker"
    | "storage_container"
    | "door_lock"
    | "business_marker"
    | "home_console";
  position: [number, number, number];
  label: string;
  createdAtMs: number;
}

export interface BuildingSystemMaterialDefinition {
  material: string;
  displayName: string;
  itemId: string;
  bikkieId: BiomesId;
  bikkieName: string;
}

export interface BuildingSystemMaterialSourceDefinition {
  material: BuildingSystemMaterialSymbol;
  sourceId: string;
  sourceName: string;
  sourceKind: "gather" | "buy";
  position: [number, number, number];
  actionLabel: string;
  description: string;
}

export interface BuildingSystemMaterialRequirementLine
  extends BuildingSystemMaterialDefinition {
  required: number;
  contributed: number;
  remaining: number;
}

export const BUILDING_SYSTEM_MATERIAL_CATALOG = {
  rough_stone: {
    material: "rough_stone",
    displayName: "Rough Stone",
    itemId: String(BikkieIds.cobblestone),
    bikkieId: BikkieIds.cobblestone,
    bikkieName: "cobblestone",
  },
  river_clay: {
    material: "river_clay",
    displayName: "River Clay",
    itemId: String(BikkieIds.clay),
    bikkieId: BikkieIds.clay,
    bikkieName: "clay",
  },
  softwood_log: {
    material: "softwood_log",
    displayName: "Softwood Log",
    itemId: String(BikkieIds.log),
    bikkieId: BikkieIds.log,
    bikkieName: "log",
  },
  oak_branch: {
    material: "oak_branch",
    displayName: "Oak Branch",
    itemId: String(BikkieIds.oakLog),
    bikkieId: BikkieIds.oakLog,
    bikkieName: "oakLog",
  },
  iron_ore: {
    material: "iron_ore",
    displayName: "Metal Ore",
    itemId: String(BikkieIds.goldOre),
    bikkieId: BikkieIds.goldOre,
    bikkieName: "goldOre",
  },
  scrap_metal: {
    material: "scrap_metal",
    displayName: "Scrap Metal",
    itemId: String(BikkieIds.silverNugget),
    bikkieId: BikkieIds.silverNugget,
    bikkieName: "silverNugget",
  },
  tree_resin: {
    material: "tree_resin",
    displayName: "Tree Resin",
    itemId: String(BikkieIds.oakLeaf),
    bikkieId: BikkieIds.oakLeaf,
    bikkieName: "oakLeaf",
  },
  cloth_scrap: {
    material: "cloth_scrap",
    displayName: "Cloth Scrap",
    itemId: String(BikkieIds.tatteredTop),
    bikkieId: BikkieIds.tatteredTop,
    bikkieName: "tatteredTop",
  },
  clean_water: {
    material: "clean_water",
    displayName: "Clean Water Bucket",
    itemId: String(BikkieIds.bucket),
    bikkieId: BikkieIds.bucket,
    bikkieName: "bucket",
  },
  old_coin: {
    material: "old_coin",
    displayName: "Old Coin",
    itemId: String(BikkieIds.goldNugget),
    bikkieId: BikkieIds.goldNugget,
    bikkieName: "goldNugget",
  },
  mana_essence: {
    material: "mana_essence",
    displayName: "Mana Essence",
    itemId: String(BikkieIds.powerCell),
    bikkieId: BikkieIds.powerCell,
    bikkieName: "powerCell",
  },
} as const satisfies Record<string, BuildingSystemMaterialDefinition>;

export type BuildingSystemMaterialSymbol =
  keyof typeof BUILDING_SYSTEM_MATERIAL_CATALOG;

const CINDERLANE_BUILDING_MATERIAL_SOURCE_ID =
  "outpost_tools_cinderlane:business-counter" as const;
const CINDERLANE_BUILDING_MATERIAL_SOURCE_NAME =
  "Cinderlane Tool Forge counter" as const;
const CINDERLANE_BUILDING_MATERIAL_SOURCE_POSITION = [1630, 43, -775] as [
  number,
  number,
  number
];

function cinderlaneBuildingMaterialSource(
  material: BuildingSystemMaterialSymbol,
  actionLabel: string,
  description: string
): BuildingSystemMaterialSourceDefinition {
  return {
    material,
    sourceId: CINDERLANE_BUILDING_MATERIAL_SOURCE_ID,
    sourceName: CINDERLANE_BUILDING_MATERIAL_SOURCE_NAME,
    sourceKind: "buy",
    position: CINDERLANE_BUILDING_MATERIAL_SOURCE_POSITION,
    actionLabel,
    description,
  };
}

export const BUILDING_SYSTEM_MATERIAL_SOURCE_CATALOG = {
  rough_stone: cinderlaneBuildingMaterialSource(
    "rough_stone",
    "Buy rough stone",
    "The Cinderlane Tool Forge counter sells rough stone; it can also be mined at the North Road Iron Vein."
  ),
  river_clay: cinderlaneBuildingMaterialSource(
    "river_clay",
    "Buy river clay",
    "The Cinderlane Tool Forge counter sells clay bags; river clay can also be dug at the riverbank clay deposit."
  ),
  softwood_log: cinderlaneBuildingMaterialSource(
    "softwood_log",
    "Buy softwood logs",
    "The Cinderlane Tool Forge counter sells starter framing logs; they can also be gathered from orchard fallen wood."
  ),
  oak_branch: cinderlaneBuildingMaterialSource(
    "oak_branch",
    "Buy oak branches",
    "The Cinderlane Tool Forge counter stocks brace wood; branches can also be gathered from orchard fallen wood."
  ),
  iron_ore: cinderlaneBuildingMaterialSource(
    "iron_ore",
    "Buy metal ore",
    "The Cinderlane Tool Forge counter sells ore; it can also be mined at the North Road Iron Vein."
  ),
  scrap_metal: cinderlaneBuildingMaterialSource(
    "scrap_metal",
    "Buy scrap metal",
    "The Cinderlane Tool Forge counter sells sorted scrap; it can also be scavenged at the Mudden Ward scrap pile."
  ),
  tree_resin: cinderlaneBuildingMaterialSource(
    "tree_resin",
    "Buy tree resin",
    "The Cinderlane Tool Forge counter sells sealed resin pots; resin can also be gathered along the orchard softwood route."
  ),
  cloth_scrap: cinderlaneBuildingMaterialSource(
    "cloth_scrap",
    "Buy cloth scraps",
    "The Cinderlane Tool Forge counter sells bundled cloth scraps; they can also be scavenged at the Mudden Ward scrap pile."
  ),
  clean_water: cinderlaneBuildingMaterialSource(
    "clean_water",
    "Buy clean water",
    "The Cinderlane Tool Forge counter sells clean work buckets; water can also be collected at the Bluewater docks."
  ),
  old_coin: cinderlaneBuildingMaterialSource(
    "old_coin",
    "Buy old coins",
    "The Cinderlane Tool Forge counter keeps a small parts drawer of old coins; they can also turn up in Mudden Ward scrap."
  ),
  mana_essence: cinderlaneBuildingMaterialSource(
    "mana_essence",
    "Buy mana essence",
    "The Cinderlane Tool Forge counter stocks sealed essence for utility setup; essence can also be extracted around the Old Well."
  ),
} as const satisfies Record<
  BuildingSystemMaterialSymbol,
  BuildingSystemMaterialSourceDefinition
>;

export function buildingSystemMaterialSourceForSymbol(
  material: string
): BuildingSystemMaterialSourceDefinition | undefined {
  return BUILDING_SYSTEM_MATERIAL_SOURCE_CATALOG[
    material as BuildingSystemMaterialSymbol
  ];
}

export interface BuildingSystemPlotDefinition {
  plotId: string;
  displayName: string;
  area: "the_grove" | "harthmere";
  district: string;
  plotType: HarthmerePlotType;
  allowedUses: BuildingSystemPlotUse[];
  allowedBlueprintIds: string[];
  claimPriceGold: number;
  taxRate: number;
  /** X/Z rectangle; converted into polygon for authority validation. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  groundY: number;
  /** Grove purchase rule: this starts as muck-designated land and must be terraformed later. */
  startsMucked: boolean;
  safeAfterPurchase: boolean;
  maxStructureHeight: number;
  maxCoveredAreaFraction: number;
  requiresRoadAccess: boolean;
  roadAccessDistanceVoxels?: number;
  terrainType: HarthmereTerrainType;
  description: string;
}

export type BuildingSystemPlotSizeId = "small" | "medium" | "large" | "estate";

export interface BuildingSystemPlotSizeOption {
  sizeId: BuildingSystemPlotSizeId;
  displayName: string;
  width: number;
  depth: number;
  description: string;
}

/**
 * Player-facing land sizes used by the Land Office request form. Keeping the
 * dimensions in shared code lets the frontend quote the same footprint that
 * the authoritative reducer validates and prices.
 */
export const BUILDING_SYSTEM_PLOT_SIZE_OPTIONS: readonly BuildingSystemPlotSizeOption[] =
  [
    {
      sizeId: "small",
      displayName: "Small",
      width: 12,
      depth: 12,
      description: "A compact home, stall, or starter workshop lot.",
    },
    {
      sizeId: "medium",
      displayName: "Medium",
      width: 18,
      depth: 18,
      description: "Room for a larger home or a full neighborhood shop.",
    },
    {
      sizeId: "large",
      displayName: "Large",
      width: 26,
      depth: 26,
      description: "A premium holding with generous building and yard space.",
    },
    {
      sizeId: "estate",
      displayName: "Estate",
      width: 34,
      depth: 34,
      description:
        "A rare frontier estate with a substantially higher deed price.",
    },
  ];

export function buildingSystemPlotDimensions(
  plot: Pick<BuildingSystemPlotDefinition, "bounds">
) {
  return {
    width: Math.max(0, plot.bounds.xMax - plot.bounds.xMin),
    depth: Math.max(0, plot.bounds.zMax - plot.bounds.zMin),
  };
}

/**
 * Deed prices grow non-linearly with area. This deliberately makes a 34x34
 * estate many times more expensive than a 12x12 starter plot instead of
 * treating extra land as a cheap linear upgrade.
 */
export function buildingSystemRequestedPlotPriceGold(input: {
  width: number;
  depth: number;
  startsMucked?: boolean;
}) {
  const width = Math.max(10, Math.min(40, Math.floor(input.width)));
  const depth = Math.max(10, Math.min(40, Math.floor(input.depth)));
  const area = width * depth;
  const rawPrice = 12 + area * 0.18 + (area * area) / 5_000;
  const muckDiscount = input.startsMucked === false ? 1.2 : 1;
  return Math.max(25, Math.ceil((rawPrice * muckDiscount) / 5) * 5);
}

export interface BuildingSystemBlueprintDefinition {
  blueprintId: string;
  displayName: string;
  source: BuildingSystemBlueprintSource;
  blueprintItemId?: string;
  bikkieId?: BiomesId;
  bikkieName?: string;
  materializationKind: BuildingSystemBlueprintMaterializationKind;
  plotType: HarthmerePlotType;
  use: BuildingSystemPlotUse;
  structureTypeId: HarthmereStructureType;
  goldCost: number;
  storageSlots: number;
  service: string;
  footprint: { width: number; depth: number; height: number };
  colors?: string[];
  tags?: string[];
  materialStages: Partial<Record<BuildingSystemStage, Record<string, number>>>;
  laborStages: Partial<Record<BuildingSystemStage, number>>;
  description: string;
}

export interface BuildingSystemGuideInteriorAnchors {
  door: [number, number, number];
  entrance: [number, number, number];
  queueNode: [number, number, number];
  serviceCounter: [number, number, number];
  exitNode: [number, number, number];
  dashboard: [number, number, number];
  customerSpace: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    areaMeters: number;
  };
  fixtureSlots: Record<
    "left" | "right" | "backLeft" | "backRight" | "frontLeft" | "frontRight",
    [number, number, number]
  >;
}

export interface BuildingSystemGuideConstructionMath {
  version: typeof BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION;
  source: "grove_business_outpost_construction_report";
  plotId: string;
  blueprintId: string;
  materializationKind: BuildingSystemBlueprintMaterializationKind;
  use: BuildingSystemPlotUse;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  footprint: { width: number; depth: number; height: number };
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  z1: number;
  foundationY: number;
  floorY: number;
  wallBottomY: number;
  wallTopY: number;
  roofY: number;
  doorX: number;
  doorYMin: number;
  doorYMax: number;
  stairPosition: [number, number, number];
  plotAreaVoxels: number;
  coveredAreaVoxels: number;
  coveredAreaFraction: number;
  maxCoveredAreaFraction: number;
  footprintInsidePlot: boolean;
  groundedToPlot: boolean;
  stairInsidePlot: boolean;
  usesSolidVoxelShell: boolean;
  clearances: {
    frontDoorBlocks: number;
    publicEntranceBlocks: number;
    interiorAisleBlocks: number;
    counterClearanceBlocks: number;
    queueSpacingBlocks: number;
    customerSpaceMeters: number;
  };
  interiorAnchors: BuildingSystemGuideInteriorAnchors;
  materialPalette: {
    foundation: BiomesId;
    floor: BiomesId;
    frame: BiomesId;
    wall: BiomesId;
    roof: BiomesId;
    stair: BiomesId;
    interior: BiomesId;
    safeGround: BiomesId;
    storageContainer: BiomesId;
    doorLock: BiomesId;
    businessMarker: BiomesId;
    homeConsole: BiomesId;
  };
  assetVocabulary: typeof BUILDING_SYSTEM_GUIDE_ASSET_VOCABULARY;
  warnings: string[];
}

export type BuildingSystemAccessMode =
  | "private"
  | "friends"
  | "guild"
  | "public";
export type BuildingSystemPermissionSubject =
  | "owner"
  | "friends_guests"
  | "guild_members"
  | "public";
export type BuildingSystemPermissionKey =
  | "storage_access"
  | "build_edit"
  | "demolition"
  | "transfer_sale";

export type BuildingSystemPermissionSet = Record<
  BuildingSystemPermissionKey,
  boolean
>;

export interface BuildingSystemPropertyPermissions {
  owner: BuildingSystemPermissionSet;
  friends_guests: BuildingSystemPermissionSet;
  guild_members: BuildingSystemPermissionSet;
  public: BuildingSystemPermissionSet;
}

export interface BuildingSystemPropertyRecord {
  propertyId: string;
  plotId: string;
  blueprintId: string;
  ownerId: string;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  status:
    | BuildingSystemPlotUse
    | "owned"
    | "abandoned"
    | "demolished"
    | "for_sale";
  use: BuildingSystemPlotUse;
  value: number;
  tier: number;
  accessMode: BuildingSystemAccessMode;
  permissions: BuildingSystemPropertyPermissions;
  guestActorIds: string[];
  guildId?: string;
  storageSlots: number;
  storageItemCount: number;
  storageContainerId?: string;
  doorLockId?: string;
  businessId?: string;
  visualDamageApplied: boolean;
  upgradedVoxelTier: number;
  condition: number;
  repairDebtGold: number;
  lastRepairDecayAtMs: number;
  taxRate: number;
  businessTaxRate: number;
  guildTaxRate: number;
  taxBalanceGold: number;
  lastTaxAssessedAtMs: number;
  unpaidTaxSinceMs?: number;
  abandoned: boolean;
  abandonedAtMs?: number;
  listedForSale: boolean;
  salePriceGold?: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildingSystemStorageContainerRecord {
  containerId: string;
  propertyId: string;
  plotId: string;
  ownerId: string;
  position: [number, number, number];
  slots: number;
  itemCount: number;
  accessMode: BuildingSystemAccessMode;
  allowedActorIds: string[];
  guildId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildingSystemDoorLockRecord {
  lockId: string;
  propertyId: string;
  plotId: string;
  ownerId: string;
  position: [number, number, number];
  accessMode: BuildingSystemAccessMode;
  locked: boolean;
  guildId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export type BuildingSystemBusinessType =
  | "exotic_matter_refinery"
  | "biome_maintenance_repair"
  | "biome_design_studio"
  | "security_defense_contractor"
  | "portal_transit_company"
  | "biome_farming_rare_foods"
  | "weapons_tools"
  | "magic_goods"
  | "exploration_guide"
  | "custom_home_property_development"
  | "general_trader"
  | "hunter_wild_meat"
  | "medical_doctor"
  | "teleport_owner"
  | "waste_sanitation_cleanup"
  | "repair_maintenance_person"
  | "food_service_restaurant"
  | "courier"
  | "hospitality_inn_hotel_shelter";

export interface BuildingSystemBusinessTypeDefinition {
  businessType: BuildingSystemBusinessType;
  displayName: string;
  category: string;
  startingCostGold: number;
  materialNeed: "light" | "medium" | "heavy" | "rare";
  mainProductOrService: string;
  recurringDemand: readonly string[];
  connectedBusinesses: readonly BuildingSystemBusinessType[];
  baseRevenuePerCycleGold: number;
  upkeepPerCycleGold: number;
  licenseLevelRequired: number;
  serviceRadius: number;
}

export interface BuildingSystemBusinessRecord {
  businessId: string;
  ownerId: string;
  type: BuildingSystemBusinessType;
  licenseLevel: number;
  propertyId: string;
  inventory: Record<string, number>;
  employees: string[];
  activeContracts: string[];
  reputation: number;
  upkeepCost: number;
  serviceRadius: number;
  customerSatisfaction: number;
  revenueBalanceGold: number;
  lifetimeRevenueGold: number;
  taxBalanceGold: number;
  lastRevenueCycleAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildingSystemPlacementPreview {
  plotId: string;
  blueprintId: string;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  boundaryOverlay: BuildingSystemPlotDefinition["bounds"];
  ghostFootprint: Array<[number, number, number]>;
  guideConstruction: BuildingSystemGuideConstructionMath;
  requiredMaterials: BuildingSystemMaterialRequirementLine[];
  valid: boolean;
  warnings: string[];
}

export interface BuildingSystemPropertyLifecycleResult {
  property: BuildingSystemPropertyRecord;
  taxDeltaGold: number;
  repairDecayDelta: number;
  warnings: string[];
}

export interface BuildingSystemSafeZoneRecord {
  plotId: string;
  actorId: string;
  area: "the_grove" | "harthmere";
  bounds: BuildingSystemPlotDefinition["bounds"];
  safeFromMuck: boolean;
  activatedAtMs: number;
}

export interface BuildingSystemVoxelEditSpec {
  kind: "editEvent";
  position: [number, number, number];
  value: BiomesId;
  /**
   * Required current terrain value for destructive edits. The direct ECS
   * materializer refuses to clear a voxel that another system/player changed
   * after this plan was authored.
   */
  expectedValue?: BiomesId;
  label:
    | "foundation"
    | "floor"
    | "frame"
    | "wall"
    | "roof"
    | "stair"
    | "interior"
    | "safe_ground"
    | "boundary_marker"
    | "deed_marker"
    | "map_marker"
    | "npc_marker"
    | "demolition_cleanup"
    | "repair_damage"
    | "repair_restore"
    | "upgrade_addition"
    | "storage_container"
    | "door_lock"
    | "business_marker"
    | "home_console";
}

export interface BuildingSystemPlaceGroupSpec {
  kind: "placeGroupEvent";
  groupId?: BiomesId;
  name: string;
  box: { v0: [number, number, number]; v1: [number, number, number] };
  reason: "building_blueprint_materialized";
}

export interface BuildingSystemMaterializationPlan {
  version: typeof BUILDING_SYSTEM_VERSION;
  requestId: string;
  actorId: string;
  plotId: string;
  blueprintId: string;
  structureTypeId: HarthmereStructureType;
  use: BuildingSystemPlotUse;
  projectId?: string;
  stage?: BuildingSystemStage;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  edits: BuildingSystemVoxelEditSpec[];
  placeGroup: BuildingSystemPlaceGroupSpec;
  safeZone?: BuildingSystemSafeZoneRecord;
  inWorldMarkers?: BuildingSystemInWorldMarker[];
  partialMaterialization?: boolean;
  unlocksStorage?: boolean;
  guideConstruction: BuildingSystemGuideConstructionMath;
  materializesSolidVoxelBuilding: true;
}

export interface BuildingSystemTerrainMaterializationPlan {
  version: typeof BUILDING_SYSTEM_VERSION;
  requestId: string;
  actorId: string;
  plotId: string;
  reason:
    | "plot_claim_muck_deed"
    | "plot_claim_safe_ground"
    | "plot_terraform_safe_ground";
  edits: BuildingSystemVoxelEditSpec[];
  safeZone: BuildingSystemSafeZoneRecord;
  inWorldMarkers?: BuildingSystemInWorldMarker[];
  materializesSolidVoxelBuilding: false;
}

export interface BuildingSystemDecorationMaterializationPlan {
  version: typeof BUILDING_SYSTEM_VERSION;
  requestId: string;
  actorId: string;
  plotId: string;
  propertyId: string;
  decorationId: string;
  itemId: string;
  reason: "home_decoration_voxel_materialization";
  operation: "place_decoration" | "move_decoration" | "remove_decoration";
  edits: BuildingSystemVoxelEditSpec[];
  materializesSolidVoxelBuilding: false;
}

export type BuildingSystemAnyMaterializationPlan =
  | BuildingSystemMaterializationPlan
  | BuildingSystemTerrainMaterializationPlan
  | BuildingSystemDecorationMaterializationPlan;

export const BUILDING_SYSTEM_GROVE_STEWARD_NPC = {
  id: "mira_grove_land_steward",
  displayName: "Mira Thatch, Grove Land Steward",
  idOffset: 9315,
  homeArea: "the_grove",
  role: "Land steward, plot registrar, and safe-construction permit clerk",
  position: [501, 53, -132] as [number, number, number],
  line: "Land is not safe because paper says so. It is safe when the muck is cleared, the boundary is marked, and the door opens onto a real path.",
} as const;

export const BUILDING_SYSTEM_MIRA_INTRO_QUEST = {
  questId: "building_system_intro_talk_to_mira",
  displayName: "Meet Mira, Grove Land Steward",
  initialForNewPlayers: true,
  completionNpcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC.id,
  completionNpcOffset: BUILDING_SYSTEM_GROVE_STEWARD_NPC.idOffset,
  stepId: "talk_to_mira",
  objective:
    "Talk to Mira Thatch in the Grove to learn how to buy safe land and build with voxels.",
  mapMarkerLabel: "Talk to Mira",
} as const;

export const BUILDING_SYSTEM_TAX_PERIOD_MS = 24 * 60 * 60 * 1000;
export const BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS =
  14 * BUILDING_SYSTEM_TAX_PERIOD_MS;
export const BUILDING_SYSTEM_REPAIR_DECAY_PER_DAY = 2;
export const BUILDING_SYSTEM_MIN_DEMOLITION_REFUND_RATE = 0.1;
export const BUILDING_SYSTEM_STANDARD_DEMOLITION_REFUND_RATE = 0.35;

function requiredBuildingSystemTerrainId(
  name: string,
  fallbackName?: string
): BiomesId {
  const terrainId =
    safeGetTerrainId(name) ??
    (fallbackName ? safeGetTerrainId(fallbackName) : undefined);
  if (terrainId === undefined) {
    throw new Error(`Missing terrain id for building block "${name}"`);
  }
  return terrainId as unknown as BiomesId;
}

export const BUILDING_SYSTEM_TERRAIN_BLOCKS = Object.freeze({
  grass: requiredBuildingSystemTerrainId("grass"),
  dirt: requiredBuildingSystemTerrainId("dirt"),
  stone: requiredBuildingSystemTerrainId("stone"),
  stonePolished: requiredBuildingSystemTerrainId("stone_polished", "stone"),
  stoneBrick: requiredBuildingSystemTerrainId("stone_brick", "stone"),
  stoneShingles: requiredBuildingSystemTerrainId("stone_shingles", "stone"),
  cobblestone: requiredBuildingSystemTerrainId("cobblestone"),
  cobblestonePolished: requiredBuildingSystemTerrainId(
    "cobblestone_polished",
    "cobblestone"
  ),
  oakLog: requiredBuildingSystemTerrainId("oak_log"),
  oakLumber: requiredBuildingSystemTerrainId("oak_lumber", "oak_log"),
  simpleGlass: requiredBuildingSystemTerrainId("simple_glass", "stone"),
  woodCrate: requiredBuildingSystemTerrainId("wood_crate", "oak_lumber"),
  hay: requiredBuildingSystemTerrainId("hay", "dirt"),
  moss: requiredBuildingSystemTerrainId("moss", "grass"),
  clay: requiredBuildingSystemTerrainId("clay", "dirt"),
  gravel: requiredBuildingSystemTerrainId("gravel", "stone"),
});

const BUILDING_BLOCKS = {
  foundation: BUILDING_SYSTEM_TERRAIN_BLOCKS.cobblestone,
  floor: BUILDING_SYSTEM_TERRAIN_BLOCKS.stone,
  frame: BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLog,
  wall: BUILDING_SYSTEM_TERRAIN_BLOCKS.cobblestone,
  roof: BUILDING_SYSTEM_TERRAIN_BLOCKS.stone,
  stair: BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished,
  interior: BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber,
  safeGround: BUILDING_SYSTEM_TERRAIN_BLOCKS.grass,
  air: 0 as BiomesId,
  boundaryMarker: BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLog,
  deedMarker: BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber,
  mapMarker: BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass,
  npcMarker: BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass,
  storageContainer: BUILDING_SYSTEM_TERRAIN_BLOCKS.woodCrate,
  doorLock: BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber,
  businessMarker: BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass,
  homeConsole: BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass,
  upgradeWall: BUILDING_SYSTEM_TERRAIN_BLOCKS.stone,
};

export const BUILDING_SYSTEM_PLOTS: BuildingSystemPlotDefinition[] = [
  {
    plotId: "grove_muckstead_cottage_lot",
    displayName: "West Road Homestead Lot",
    area: "harthmere",
    district: "West Road Homestead",
    plotType: "residential",
    allowedUses: ["home"],
    allowedBlueprintIds: [
      "grove_voxel_cottage_tier_1",
      "bikkie_traditional_shelter_frame",
      "bikkie_modern_shelter_frame",
      "bikkie_space_age_shelter_frame",
    ],
    claimPriceGold: 25,
    taxRate: 0.02,
    // Off the safe West Road to Harthmere (region center ~[256, -209]).
    bounds: { xMin: 246, xMax: 258, zMin: -200, zMax: -188 },
    groundY: 54,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 8,
    maxCoveredAreaFraction: 0.7,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "Starter residential claim on the safe West Road to Harthmere. Buy the deed to mark the boundary and build your first home here.",
  },
  {
    plotId: "harthmere_riverside_cottage_lot",
    displayName: "Bluewater Riverside Cottage Lot",
    area: "harthmere",
    district: "Bluewater Riverside",
    plotType: "residential",
    allowedUses: ["home"],
    allowedBlueprintIds: [
      "grove_voxel_cottage_tier_1",
      "bikkie_traditional_shelter_frame",
      "bikkie_modern_shelter_frame",
      "bikkie_space_age_shelter_frame",
    ],
    claimPriceGold: 75,
    taxRate: 0.025,
    bounds: { xMin: 280, xMax: 298, zMin: -232, zMax: -214 },
    groundY: 54,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 10,
    maxCoveredAreaFraction: 0.68,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "grass",
    description:
      "A medium riverside home lot with more room for storage, gardens, and a larger shelter footprint.",
  },
  {
    plotId: "harthmere_gravewood_estate_lot",
    displayName: "Harthmere East Garden Estate",
    area: "harthmere",
    district: "Harthmere East Garden",
    plotType: "residential",
    allowedUses: ["home"],
    allowedBlueprintIds: [
      "grove_voxel_cottage_tier_1",
      "bikkie_traditional_shelter_frame",
      "bikkie_modern_shelter_frame",
      "bikkie_space_age_shelter_frame",
    ],
    claimPriceGold: 425,
    taxRate: 0.04,
    bounds: { xMin: 2383, xMax: 2417, zMin: 83, zMax: 117 },
    groundY: 52,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 14,
    maxCoveredAreaFraction: 0.55,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "grass",
    description:
      "A large residential estate on the flat additive Harthmere extension. Its broad serviced boundary makes the deed substantially more expensive.",
  },
  {
    plotId: "grove_crossroads_shop_lot",
    displayName: "Watchtower Frontier Shop Lot",
    area: "harthmere",
    district: "Watchtower Frontier",
    plotType: "commercial",
    allowedUses: ["business"],
    allowedBlueprintIds: [
      "grove_voxel_shop_tier_1",
      "bikkie_marina_shopping_stall",
      "bikkie_canopy_frame",
      "bikkie_kitchen",
      "bikkie_anglers_table",
      "bikkie_bench",
      "bikkie_table",
      "bikkie_t_table",
    ],
    claimPriceGold: 45,
    taxRate: 0.06,
    // Just outside the Watchtower muck clearing (center ~[332, -390], r34).
    bounds: { xMin: 372, xMax: 386, zMin: -396, zMax: -382 },
    groundY: 54,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 9,
    maxCoveredAreaFraction: 0.65,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "A frontier business lot on the edge of the Watchtower muck. It begins as mucked land; claiming the deed lets you build a shop once you terraform it.",
  },
  {
    plotId: "harthmere_watchtower_market_lot",
    displayName: "Harthmere South Market Row Lot",
    area: "harthmere",
    district: "Harthmere South Market Row",
    plotType: "commercial",
    allowedUses: ["business"],
    allowedBlueprintIds: [
      "grove_voxel_shop_tier_1",
      "bikkie_marina_shopping_stall",
      "bikkie_canopy_frame",
      "bikkie_kitchen",
      "bikkie_anglers_table",
      "bikkie_bench",
      "bikkie_table",
      "bikkie_t_table",
    ],
    claimPriceGold: 135,
    taxRate: 0.065,
    bounds: { xMin: 2451, xMax: 2469, zMin: 91, zMax: 109 },
    groundY: 52,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 11,
    maxCoveredAreaFraction: 0.65,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "A medium additive-town market lot suitable for a full shop with customer and stock space.",
  },
  {
    plotId: "harthmere_west_breach_trade_yard",
    displayName: "Harthmere Far East Trade Yard",
    area: "harthmere",
    district: "Harthmere Far East Trade Yard",
    plotType: "commercial",
    allowedUses: ["business"],
    allowedBlueprintIds: [
      "grove_voxel_shop_tier_1",
      "bikkie_marina_shopping_stall",
      "bikkie_canopy_frame",
      "bikkie_kitchen",
      "bikkie_anglers_table",
      "bikkie_bench",
      "bikkie_table",
      "bikkie_t_table",
    ],
    claimPriceGold: 360,
    taxRate: 0.075,
    bounds: { xMin: 2487, xMax: 2513, zMin: -513, zMax: -487 },
    groundY: 52,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 14,
    maxCoveredAreaFraction: 0.58,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "A large additive-town trade yard for an ambitious shop, service counter, storage, and outdoor fixtures.",
  },
  {
    plotId: "grove_guild_green_lot",
    displayName: "Gravewood Edge Guild Lot",
    area: "harthmere",
    district: "Gravewood Edge",
    plotType: "guild",
    allowedUses: ["guild"],
    allowedBlueprintIds: ["grove_voxel_guild_hall_tier_1"],
    claimPriceGold: 110,
    taxRate: 0.04,
    // Edge of the Gravewood pale muck (center ~[640, 120], r42).
    bounds: { xMin: 686, xMax: 710, zMin: 116, zMax: 140 },
    groundY: 54,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 16,
    maxCoveredAreaFraction: 0.55,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "grass",
    description:
      "A large frontier lot on the Gravewood edge for a guild hall. After terraforming it supports shared storage, permissions, guild services, and public projects.",
  },
  {
    plotId: "grove_craftworks_yard_lot",
    displayName: "Old Wood Craftworks Claim",
    area: "harthmere",
    district: "Old Wood Claim",
    plotType: "crafting",
    allowedUses: ["workshop"],
    allowedBlueprintIds: [
      "bikkie_workbench",
      "bikkie_tailoring_booth",
      "bikkie_dye_o_matic",
      "bikkie_thermoblaster",
      "bikkie_thermolite",
    ],
    claimPriceGold: 70,
    taxRate: 0.05,
    // Edge of the Old Wood mucker copse (center ~[640, -455], r48).
    bounds: { xMin: 690, xMax: 706, zMin: -460, zMax: -444 },
    groundY: 54,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 8,
    maxCoveredAreaFraction: 0.6,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "A frontier utility yard at the Old Wood claim for player crafting blueprints. Keeps workstations buildable without treating every table as a full house.",
  },
  {
    plotId: "grove_seedworks_plot",
    displayName: "West Road Greenrows Plot",
    area: "harthmere",
    district: "West Road Greenrows",
    plotType: "farm",
    allowedUses: ["farm"],
    allowedBlueprintIds: [
      "bikkie_composter",
      "bikkie_seed_mill",
      "bikkie_fence",
    ],
    claimPriceGold: 55,
    taxRate: 0.025,
    // Safe West Road region (center ~[256, -209]), set back from the homestead.
    bounds: { xMin: 262, xMax: 278, zMin: -214, zMax: -198 },
    groundY: 54,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: 5,
    maxCoveredAreaFraction: 0.55,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "grass",
    description:
      "A farming support plot on the safe West Road for composters, seed milling, and fence-line work.",
  },
  {
    plotId: "grove_signal_green_lot",
    displayName: "West Breach Signal Outpost",
    area: "harthmere",
    district: "West Breach Outpost",
    plotType: "public",
    allowedUses: ["public_service"],
    allowedBlueprintIds: [
      "bikkie_comms_tower",
      "bikkie_network_tower",
      "bikkie_fence",
    ],
    claimPriceGold: 90,
    taxRate: 0.035,
    // Edge of the West Muck Breach (center ~[236, -506], r46).
    bounds: { xMin: 286, xMax: 304, zMin: -512, zMax: -494 },
    groundY: 54,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 12,
    maxCoveredAreaFraction: 0.45,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "grass",
    description:
      "A frontier public-service pad at the West Breach for tower blueprints and route beacons that keep the far road shielded.",
  },
];

const BUILDING_SYSTEM_PLOTS_BY_ID = new Map(
  BUILDING_SYSTEM_PLOTS.map((plot) => [plot.plotId, plot] as const)
);

const BUILDING_SYSTEM_DYNAMIC_MUCK_PLOT_MARGIN_VOXELS = 3;

export interface BuildingSystemMuckBuildArea {
  id: string;
  label: string;
  authoredCenter: readonly [number, number, number];
  radius: number;
  mapLabel: string;
  description: string;
}

export interface BuildingSystemLandRequestArea {
  areaId: string;
  displayName: string;
  description: string;
  kind: "frontier_muck" | "additive_town";
  center: readonly [number, number, number];
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  groundY: number;
  startsMucked: boolean;
  priceMultiplier: number;
}

export const BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS: readonly BuildingSystemMuckBuildArea[] =
  [
    {
      id: "road_muckwad_patch",
      label: "Road Muckwad Patch",
      authoredCenter: [512, 54, -152],
      radius: 10,
      mapLabel: "Muckwad Patch",
      description:
        "Starter muck patch used by Road Ahead and Muck Buster training.",
    },
    {
      id: "watchtower_muck_patch",
      label: "Watchtower Muck Patch",
      authoredCenter: [332, 54, -390],
      radius: 16,
      mapLabel: "Muck Clearing",
      description: "First Wilds muck zone attached to real hostile NPCs.",
    },
    {
      id: "watchtower_muck_clearing",
      label: "Watchtower Muck Clearing",
      authoredCenter: [332, 54, -390],
      radius: 34,
      mapLabel: "Muck Clearing",
      description:
        "Low-risk first combat pocket for Road Ahead follow-up lessons.",
    },
    {
      id: "old_wood_muck_patch",
      label: "Old Wood Muck Patch",
      authoredCenter: [640, 54, -455],
      radius: 22,
      mapLabel: "Old Wood Muck",
      description:
        "Reusable mid-tier muck field for combat and gathering loops.",
    },
    {
      id: "old_wood_mucker_copse",
      label: "Old Wood Mucker Copse",
      authoredCenter: [640, 54, -455],
      radius: 48,
      mapLabel: "Old Wood Muckers",
      description: "Hostile muckers, larger aggro range, stronger loot table.",
    },
    {
      id: "gravewood_pale_muck",
      label: "Gravewood Pale Muck",
      authoredCenter: [640, 54, 120],
      radius: 42,
      mapLabel: "Gravewood Muck",
      description: "Southern danger zone for later combat and gathering loops.",
    },
    {
      id: "west_muck_breach",
      label: "West Muck Breach",
      authoredCenter: [236, 54, -506],
      radius: 46,
      mapLabel: "West Muck Breach",
      description:
        "Wide frontier muck breach used by late-road jobs and combat.",
    },
  ];

/**
 * Areas exposed by the Land Office for player-sized requests. The additive
 * town zones are deliberately on the generated flat extension and charge a
 * serviced-land premium; the authoritative ECS scan still decides whether a
 * particular rectangle is clear of buildings, groups, and placeables.
 */
export const BUILDING_SYSTEM_LAND_REQUEST_AREAS: readonly BuildingSystemLandRequestArea[] =
  [
    ...BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS.filter(
      (area) => area.radius >= 22
    ).map((area) => ({
      areaId: area.id,
      displayName: area.label,
      description: area.description,
      kind: "frontier_muck" as const,
      center: area.authoredCenter,
      bounds: {
        xMin: area.authoredCenter[0] - area.radius,
        xMax: area.authoredCenter[0] + area.radius,
        zMin: area.authoredCenter[2] - area.radius,
        zMax: area.authoredCenter[2] + area.radius,
      },
      groundY: area.authoredCenter[1],
      startsMucked: true,
      priceMultiplier: 1,
    })),
    {
      areaId: "additive_west_gate_homesteads",
      displayName: "Harthmere West Gate Homesteads",
      description:
        "Serviced, flat land inside the additive Harthmere extension near the town approach.",
      kind: "additive_town",
      center: [1928, 52, -318],
      bounds: { xMin: 1840, xMax: 1984, zMin: -374, zMax: -262 },
      groundY: 52,
      startsMucked: false,
      priceMultiplier: 1.65,
    },
    {
      areaId: "additive_south_fields",
      displayName: "Harthmere South Fields",
      description:
        "Broad town-edge plots on the additive extension with room for larger homes and businesses.",
      kind: "additive_town",
      center: [2180, 52, 92],
      bounds: { xMin: 2070, xMax: 2290, zMin: 36, zMax: 154 },
      groundY: 52,
      startsMucked: false,
      priceMultiplier: 1.85,
    },
    {
      areaId: "additive_east_estates",
      displayName: "Harthmere East Estates",
      description:
        "Premium additive-town land intended for large holdings away from the busiest civic blocks.",
      kind: "additive_town",
      center: [2420, 52, -250],
      bounds: { xMin: 2320, xMax: 2520, zMin: -350, zMax: -150 },
      groundY: 52,
      startsMucked: false,
      priceMultiplier: 2.25,
    },
  ];

function buildingSystemBoundsContainBounds(
  outer: BuildingSystemPlotDefinition["bounds"],
  inner: BuildingSystemPlotDefinition["bounds"]
) {
  return (
    inner.xMin >= outer.xMin &&
    inner.xMax <= outer.xMax &&
    inner.zMin >= outer.zMin &&
    inner.zMax <= outer.zMax
  );
}

/**
 * Builds the exact server-authoritative deed requested by the player. This
 * only validates area/size geometry; ownership and ECS/Gaia structure
 * collisions are checked by the live-mode authority immediately afterward.
 */
export function createBuildingSystemRequestedPlotDefinition(input: {
  plotId?: string;
  requestAreaId: string;
  blueprint: BuildingSystemBlueprintDefinition | undefined;
  center: { x: number; z: number };
  width: number;
  depth: number;
}):
  | {
      ok: true;
      plot: BuildingSystemPlotDefinition;
      area: BuildingSystemLandRequestArea;
    }
  | { ok: false; errors: string[] } {
  if (!input.blueprint) return { ok: false, errors: ["missing_blueprint"] };
  const area = BUILDING_SYSTEM_LAND_REQUEST_AREAS.find(
    (candidate) => candidate.areaId === input.requestAreaId
  );
  if (!area) return { ok: false, errors: ["request_area_not_found"] };
  const width = Math.floor(input.width);
  const depth = Math.floor(input.depth);
  if (width < 10 || width > 40 || depth < 10 || depth > 40) {
    return { ok: false, errors: ["invalid_plot_size"] };
  }
  if (
    width < input.blueprint.footprint.width ||
    depth < input.blueprint.footprint.depth
  ) {
    return { ok: false, errors: ["plot_too_small_for_blueprint"] };
  }
  const xMin = Math.floor(input.center.x - width / 2);
  const zMin = Math.floor(input.center.z - depth / 2);
  const bounds = { xMin, xMax: xMin + width, zMin, zMax: zMin + depth };
  if (!buildingSystemBoundsContainBounds(area.bounds, bounds)) {
    return { ok: false, errors: ["outside_request_area"] };
  }
  const basePrice = buildingSystemRequestedPlotPriceGold({
    width,
    depth,
    startsMucked: area.startsMucked,
  });
  const plotId =
    input.plotId?.trim() ||
    buildingSystemDynamicPlotSlug(
      `land_request_${area.areaId}_${input.blueprint.blueprintId}_${xMin}_${zMin}_${width}x${depth}`
    );
  return {
    ok: true,
    area,
    plot: {
      plotId,
      displayName: `${area.displayName} ${width}x${depth} Claim`,
      area: "harthmere",
      district: area.displayName,
      plotType: input.blueprint.plotType,
      allowedUses: [input.blueprint.use],
      allowedBlueprintIds: [input.blueprint.blueprintId],
      claimPriceGold: Math.ceil((basePrice * area.priceMultiplier) / 5) * 5,
      taxRate: input.blueprint.use === "business" ? 0.065 : 0.025,
      bounds,
      groundY: area.groundY,
      startsMucked: area.startsMucked,
      safeAfterPurchase: !area.startsMucked,
      maxStructureHeight: Math.max(10, input.blueprint.footprint.height + 5),
      maxCoveredAreaFraction: 0.75,
      requiresRoadAccess: false,
      roadAccessDistanceVoxels: 0,
      terrainType: area.startsMucked ? "dirt" : "grass",
      description:
        area.kind === "additive_town"
          ? "A player-requested plot on the additive Harthmere town extension. The deed is issued only after native ECS/Gaia confirms that the full boundary is unowned and clear of existing structures."
          : "A player-requested frontier claim. The deed is issued only after ownership and native ECS/Gaia structure-clearance checks pass.",
    },
  };
}

function isBuildingSystemPointInMuckArea(
  point: { x: number; y: number; z: number },
  area: BuildingSystemMuckBuildArea
) {
  const dx = point.x - area.authoredCenter[0];
  const dz = point.z - area.authoredCenter[2];
  return Math.hypot(dx, dz) <= area.radius;
}

function buildingSystemBoundsCorners(
  bounds: BuildingSystemPlotDefinition["bounds"]
) {
  return [
    { x: bounds.xMin, z: bounds.zMin },
    { x: bounds.xMax, z: bounds.zMin },
    { x: bounds.xMax, z: bounds.zMax },
    { x: bounds.xMin, z: bounds.zMax },
  ];
}

export function buildingSystemPlotBoundsOverlap(
  left: BuildingSystemPlotDefinition["bounds"],
  right: BuildingSystemPlotDefinition["bounds"],
  margin = 0
) {
  return (
    left.xMin < right.xMax + margin &&
    left.xMax > right.xMin - margin &&
    left.zMin < right.zMax + margin &&
    left.zMax > right.zMin - margin
  );
}

export function buildingSystemMuckBuildAreaForBounds(
  bounds: BuildingSystemPlotDefinition["bounds"],
  groundY: number,
  areaId?: string
) {
  const candidates = areaId
    ? BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS.filter(
        (area) => area.id === areaId
      )
    : BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS;
  return candidates.find((area) =>
    buildingSystemBoundsCorners(bounds).every((corner) =>
      isBuildingSystemPointInMuckArea(
        { x: corner.x, y: groundY, z: corner.z },
        area
      )
    )
  );
}

function buildingSystemDynamicPlotSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

export function buildingSystemDynamicMuckPlotId(input: {
  areaId: string;
  blueprintId: string;
  origin: { x: number; z: number };
}) {
  return buildingSystemDynamicPlotSlug(
    `muck_claim_${input.areaId}_${input.blueprintId}_${Math.floor(
      input.origin.x
    )}_${Math.floor(input.origin.z)}`
  );
}

export function createBuildingSystemMuckAreaPlotDefinition(input: {
  plotId?: string;
  blueprint: BuildingSystemBlueprintDefinition | undefined;
  origin?: { x: number; y?: number; z: number };
  areaId?: string;
  requestedWidth?: number;
  requestedDepth?: number;
  /** New Land Office requests use a map center; legacy callers use a structure origin. */
  centerAtOrigin?: boolean;
}):
  | {
      ok: true;
      plot: BuildingSystemPlotDefinition;
      area: BuildingSystemMuckBuildArea;
    }
  | {
      ok: false;
      errors: string[];
    } {
  if (!input.blueprint) {
    return { ok: false, errors: ["missing_blueprint"] };
  }
  const explicitArea = input.areaId
    ? BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS.find(
        (area) => area.id === input.areaId
      )
    : undefined;
  if (input.areaId && !explicitArea) {
    return { ok: false, errors: ["muck_area_not_found"] };
  }
  const requestedWidth =
    input.requestedWidth === undefined
      ? input.blueprint.footprint.width +
        BUILDING_SYSTEM_DYNAMIC_MUCK_PLOT_MARGIN_VOXELS * 2
      : Math.floor(input.requestedWidth);
  const requestedDepth =
    input.requestedDepth === undefined
      ? input.blueprint.footprint.depth +
        BUILDING_SYSTEM_DYNAMIC_MUCK_PLOT_MARGIN_VOXELS * 2
      : Math.floor(input.requestedDepth);
  if (
    requestedWidth < 10 ||
    requestedWidth > 40 ||
    requestedDepth < 10 ||
    requestedDepth > 40
  ) {
    return { ok: false, errors: ["invalid_plot_size"] };
  }
  if (
    requestedWidth < input.blueprint.footprint.width ||
    requestedDepth < input.blueprint.footprint.depth
  ) {
    return { ok: false, errors: ["plot_too_small_for_blueprint"] };
  }
  const origin = input.origin
    ? {
        x: Math.floor(input.origin.x),
        y: Math.floor(
          Number(input.origin.y ?? explicitArea?.authoredCenter[1] ?? 54) + 1
        ),
        z: Math.floor(input.origin.z),
      }
    : explicitArea
    ? {
        x: Math.floor(
          explicitArea.authoredCenter[0] - input.blueprint.footprint.width / 2
        ),
        y: Math.floor(explicitArea.authoredCenter[1] + 1),
        z: Math.floor(
          explicitArea.authoredCenter[2] - input.blueprint.footprint.depth / 2
        ),
      }
    : undefined;
  if (!origin) {
    return { ok: false, errors: ["missing_origin_or_muck_area"] };
  }
  // Explicit player requests describe the deed boundary itself. Legacy
  // blueprint-origin calls retain their old lower-left coordinate behavior.
  const xMin = input.centerAtOrigin
    ? Math.floor(origin.x - requestedWidth / 2)
    : origin.x - BUILDING_SYSTEM_DYNAMIC_MUCK_PLOT_MARGIN_VOXELS;
  const zMin = input.centerAtOrigin
    ? Math.floor(origin.z - requestedDepth / 2)
    : origin.z - BUILDING_SYSTEM_DYNAMIC_MUCK_PLOT_MARGIN_VOXELS;
  const bounds = {
    xMin,
    xMax: xMin + requestedWidth,
    zMin,
    zMax: zMin + requestedDepth,
  };
  const groundY = origin.y - 1;
  const area = buildingSystemMuckBuildAreaForBounds(
    bounds,
    groundY,
    input.areaId
  );
  if (!area) {
    return { ok: false, errors: ["outside_muck_build_area"] };
  }
  const plotId =
    input.plotId && input.plotId.trim()
      ? input.plotId.trim()
      : buildingSystemDynamicMuckPlotId({
          areaId: area.id,
          blueprintId: input.blueprint.blueprintId,
          origin,
        });
  return {
    ok: true,
    area,
    plot: {
      plotId,
      displayName: `${area.label} ${input.blueprint.displayName} Claim`,
      area: "harthmere",
      district: area.label,
      plotType: input.blueprint.plotType,
      allowedUses: [input.blueprint.use],
      allowedBlueprintIds: [input.blueprint.blueprintId],
      claimPriceGold: buildingSystemRequestedPlotPriceGold({
        width: requestedWidth,
        depth: requestedDepth,
        startsMucked: true,
      }),
      taxRate: input.blueprint.use === "business" ? 0.06 : 0.02,
      bounds,
      groundY,
      startsMucked: true,
      safeAfterPurchase: false,
      maxStructureHeight: Math.max(8, input.blueprint.footprint.height + 4),
      maxCoveredAreaFraction: 0.8,
      requiresRoadAccess: false,
      roadAccessDistanceVoxels: 0,
      terrainType: "dirt",
      description:
        "A server-generated muck-area claim. It is created only when the requested footprint sits fully inside authored muck land and does not overlap an existing claim or building.",
    },
  };
}

// Look up an authored plot's world-space bounds by plot id. Used to turn the
// per-plot safe-zone records (which only store a string area label, not
// geometry) into an actual containment test for muck safety.
export function buildingSystemPlotBoundsById(
  plotId: string
): BuildingSystemPlotDefinition["bounds"] | undefined {
  return BUILDING_SYSTEM_PLOTS_BY_ID.get(plotId)?.bounds;
}

export function isPositionInsideBuildingSystemPlotBounds(
  bounds: BuildingSystemPlotDefinition["bounds"] | undefined,
  position: { x: number; z: number } | undefined
): boolean {
  if (!bounds || !position) {
    return false;
  }
  const x = Number(position.x);
  const z = Number(position.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return false;
  }
  return (
    x >= bounds.xMin && x <= bounds.xMax && z >= bounds.zMin && z <= bounds.zMax
  );
}

export const BUILDING_SYSTEM_BIKKIE_BLUEPRINTS: BuildingSystemBlueprintDefinition[] =
  [
    {
      blueprintId: "bikkie_traditional_shelter_frame",
      displayName: "Traditional Shelter Frame",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintTraditionalShelterFrame),
      bikkieId: BikkieIds.blueprintTraditionalShelterFrame,
      bikkieName: "blueprintTraditionalShelterFrame",
      materializationKind: "shelter_frame",
      plotType: "residential",
      use: "home",
      structureTypeId: "small_house",
      goldCost: 18,
      storageSlots: 20,
      service:
        "Home: compact traditional shelter, starter storage, private access, and safe rest.",
      footprint: { width: 5, depth: 5, height: 4 },
      colors: ["weathered wood", "warm thatch", "soft stone"],
      tags: ["bikkie", "shelter", "home", "starter"],
      materialStages: {
        site_preparation: { rough_stone: 3 },
        foundation: { rough_stone: 8, river_clay: 3 },
        frame: { softwood_log: 10 },
        walls: { softwood_log: 8, rough_stone: 4 },
        roof: { oak_branch: 8, tree_resin: 1 },
        interior: { cloth_scrap: 3 },
        utility_setup: { clean_water: 1 },
      },
      laborStages: {
        site_preparation: 8,
        foundation: 16,
        frame: 20,
        walls: 18,
        roof: 16,
        interior: 10,
        utility_setup: 8,
      },
      description:
        "Bikkie shelter blueprint for a small lawful home shell. It materializes as a solid voxel shelter rather than a loose inventory trinket.",
    },
    {
      blueprintId: "bikkie_modern_shelter_frame",
      displayName: "Modern Shelter Frame",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintModernShelterFrame),
      bikkieId: BikkieIds.blueprintModernShelterFrame,
      bikkieName: "blueprintModernShelterFrame",
      materializationKind: "shelter_frame",
      plotType: "residential",
      use: "home",
      structureTypeId: "medium_house",
      goldCost: 34,
      storageSlots: 32,
      service:
        "Home: modern shelter shell, cleaner storage layout, guest access, and higher property value.",
      footprint: { width: 8, depth: 8, height: 6 },
      colors: ["pale paneling", "smoked glass", "cool gray"],
      tags: ["bikkie", "shelter", "home", "modern"],
      materialStages: {
        site_preparation: { rough_stone: 5 },
        foundation: { rough_stone: 16, river_clay: 6 },
        frame: { softwood_log: 14, scrap_metal: 3 },
        walls: { rough_stone: 12, softwood_log: 8 },
        roof: { rough_stone: 8, tree_resin: 2 },
        interior: { cloth_scrap: 4, old_coin: 1 },
        utility_setup: { clean_water: 2, scrap_metal: 2 },
      },
      laborStages: {
        site_preparation: 12,
        foundation: 24,
        frame: 32,
        walls: 28,
        roof: 22,
        interior: 16,
        utility_setup: 10,
      },
      description:
        "Bikkie modern shelter blueprint for a larger starter residence with a real footprint, door, floor, walls, and roof.",
    },
    {
      blueprintId: "bikkie_space_age_shelter_frame",
      displayName: "Space Age Shelter Frame",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintSpaceAgeShelterFrame),
      bikkieId: BikkieIds.blueprintSpaceAgeShelterFrame,
      bikkieName: "blueprintSpaceAgeShelterFrame",
      materializationKind: "shelter_frame",
      plotType: "residential",
      use: "home",
      structureTypeId: "medium_house",
      goldCost: 42,
      storageSlots: 36,
      service:
        "Home: space-age shelter, reinforced utility node, private storage, and higher maintenance value.",
      footprint: { width: 8, depth: 8, height: 6 },
      colors: ["white alloy", "cyan light", "dark glass"],
      tags: ["bikkie", "shelter", "home", "tech"],
      materialStages: {
        site_preparation: { rough_stone: 5 },
        foundation: { rough_stone: 14, scrap_metal: 4 },
        frame: { scrap_metal: 10, softwood_log: 6 },
        walls: { rough_stone: 10, scrap_metal: 6 },
        roof: { scrap_metal: 6, mana_essence: 1 },
        interior: { cloth_scrap: 4, old_coin: 1 },
        utility_setup: { clean_water: 2, mana_essence: 1 },
      },
      laborStages: {
        site_preparation: 12,
        foundation: 26,
        frame: 34,
        walls: 30,
        roof: 24,
        interior: 18,
        utility_setup: 14,
      },
      description:
        "Bikkie tech shelter blueprint for a compact futuristic home. It uses metal and power materials instead of pretending to be a generic cottage.",
    },
    {
      blueprintId: "bikkie_marina_shopping_stall",
      displayName: "Stall Frame",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintMarinaShoppingStall),
      bikkieId: BikkieIds.blueprintMarinaShoppingStall,
      bikkieName: "blueprintMarinaShoppingStall",
      materializationKind: "market_stall",
      plotType: "commercial",
      use: "business",
      structureTypeId: "market_stall",
      goldCost: 28,
      storageSlots: 16,
      service:
        "Business: open-air stall, taxable listings, customer counter, and public access.",
      footprint: { width: 5, depth: 4, height: 3 },
      colors: ["canvas cream", "dock wood", "brass trim"],
      tags: ["bikkie", "market", "stall", "business"],
      materialStages: {
        site_preparation: { softwood_log: 3 },
        foundation: { rough_stone: 5 },
        frame: { softwood_log: 10 },
        walls: { cloth_scrap: 5 },
        roof: { cloth_scrap: 6, tree_resin: 1 },
        interior: { old_coin: 1, scrap_metal: 2 },
        utility_setup: { clean_water: 1 },
      },
      laborStages: {
        site_preparation: 8,
        foundation: 12,
        frame: 20,
        walls: 12,
        roof: 14,
        interior: 10,
        utility_setup: 6,
      },
      description:
        "Bikkie shopping-stall blueprint for a commercial plot. It materializes as an open stall, not a closed cottage.",
    },
    {
      blueprintId: "bikkie_canopy_frame",
      displayName: "Canopy Frame",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintCanopyFrame),
      bikkieId: BikkieIds.blueprintCanopyFrame,
      bikkieName: "blueprintCanopyFrame",
      materializationKind: "canopy",
      plotType: "commercial",
      use: "public_service",
      structureTypeId: "canopy",
      goldCost: 18,
      storageSlots: 6,
      service:
        "Public service: shaded queue area, event stall cover, and safe gathering marker.",
      footprint: { width: 5, depth: 4, height: 3 },
      colors: ["canvas tan", "oak frame"],
      tags: ["bikkie", "canopy", "public", "market"],
      materialStages: {
        site_preparation: { softwood_log: 2 },
        foundation: { rough_stone: 4 },
        frame: { softwood_log: 8 },
        roof: { cloth_scrap: 6, tree_resin: 1 },
        utility_setup: { clean_water: 1 },
      },
      laborStages: {
        site_preparation: 6,
        foundation: 10,
        frame: 16,
        roof: 12,
        utility_setup: 5,
      },
      description:
        "Bikkie canopy blueprint for shade and public service space. The generated plan uses posts and roof cover without blocking the whole footprint.",
    },
    {
      blueprintId: "bikkie_kitchen",
      displayName: "Kitchen",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintKitchen),
      bikkieId: BikkieIds.blueprintKitchen,
      bikkieName: "blueprintKitchen",
      materializationKind: "utility_station",
      plotType: "commercial",
      use: "business",
      structureTypeId: "utility_station",
      goldCost: 22,
      storageSlots: 12,
      service:
        "Business: cooking station, food-service prep counter, ingredient storage, and customer orders.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["warm wood", "iron range", "cream tile"],
      tags: ["bikkie", "kitchen", "food", "business"],
      materialStages: {
        site_preparation: { rough_stone: 2 },
        foundation: { rough_stone: 4, river_clay: 3 },
        frame: { softwood_log: 4, scrap_metal: 2 },
        interior: { clean_water: 2, cloth_scrap: 2 },
        utility_setup: { scrap_metal: 2 },
      },
      laborStages: {
        site_preparation: 5,
        foundation: 10,
        frame: 12,
        interior: 12,
        utility_setup: 10,
      },
      description:
        "Bikkie kitchen blueprint for food businesses and cooking workflows. It becomes a compact utility station with storage instead of a whole house shell.",
    },
    {
      blueprintId: "bikkie_anglers_table",
      displayName: "Angler's Table",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintAnglersTable),
      bikkieId: BikkieIds.blueprintAnglersTable,
      bikkieName: "blueprintAnglersTable",
      materializationKind: "fixture",
      plotType: "commercial",
      use: "business",
      structureTypeId: "fixture",
      goldCost: 12,
      storageSlots: 8,
      service:
        "Business: fish prep table, tackle work surface, and river-contract marker.",
      footprint: { width: 3, depth: 2, height: 2 },
      colors: ["dock wood", "wet slate", "rope tan"],
      tags: ["bikkie", "table", "fish", "business"],
      materialStages: {
        foundation: { softwood_log: 3 },
        frame: { softwood_log: 3 },
        interior: { clean_water: 1, cloth_scrap: 1 },
        utility_setup: { old_coin: 1 },
      },
      laborStages: { foundation: 6, frame: 8, interior: 6, utility_setup: 4 },
      description:
        "Bikkie angler table blueprint for dock or market services. It uses fixture-scale voxel edits and keeps surrounding walkways open.",
    },
    {
      blueprintId: "bikkie_bench",
      displayName: "Bench",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintBench),
      bikkieId: BikkieIds.blueprintBench,
      bikkieName: "blueprintBench",
      materializationKind: "fixture",
      plotType: "commercial",
      use: "public_service",
      structureTypeId: "fixture",
      goldCost: 8,
      storageSlots: 0,
      service: "Public service: seating fixture and visitor comfort marker.",
      footprint: { width: 3, depth: 1, height: 1 },
      colors: ["oak wood", "iron brackets"],
      tags: ["bikkie", "fixture", "seating"],
      materialStages: {
        frame: { softwood_log: 4 },
        interior: { scrap_metal: 1 },
      },
      laborStages: { frame: 8, interior: 4 },
      description:
        "Bikkie bench blueprint for small service fixtures. It does not generate walls, roof, or a full property shell.",
    },
    {
      blueprintId: "bikkie_table",
      displayName: "Table",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintTable),
      bikkieId: BikkieIds.blueprintTable,
      bikkieName: "blueprintTable",
      materializationKind: "fixture",
      plotType: "commercial",
      use: "public_service",
      structureTypeId: "fixture",
      goldCost: 10,
      storageSlots: 2,
      service:
        "Public service: table fixture for dining, crafting orders, and market paperwork.",
      footprint: { width: 2, depth: 2, height: 1 },
      colors: ["oak plank", "soft shadow"],
      tags: ["bikkie", "fixture", "table"],
      materialStages: {
        frame: { softwood_log: 4 },
        interior: { cloth_scrap: 1 },
      },
      laborStages: { frame: 8, interior: 4 },
      description:
        "Bikkie table blueprint for fixture-scale construction with small storage and no building envelope.",
    },
    {
      blueprintId: "bikkie_t_table",
      displayName: "T-Table",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintTTable),
      bikkieId: BikkieIds.blueprintTTable,
      bikkieName: "blueprintTTable",
      materializationKind: "fixture",
      plotType: "commercial",
      use: "public_service",
      structureTypeId: "fixture",
      goldCost: 12,
      storageSlots: 3,
      service:
        "Public service: T-shaped work table for order sorting and customer seating.",
      footprint: { width: 3, depth: 2, height: 1 },
      colors: ["oak plank", "dark brace"],
      tags: ["bikkie", "fixture", "table"],
      materialStages: {
        frame: { softwood_log: 5 },
        interior: { scrap_metal: 1 },
      },
      laborStages: { frame: 9, interior: 4 },
      description:
        "Bikkie T-table blueprint for compact fixture placement on commercial plots.",
    },
    {
      blueprintId: "bikkie_workbench",
      displayName: "Workbench",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintWorkbench),
      bikkieId: BikkieIds.blueprintWorkbench,
      bikkieName: "blueprintWorkbench",
      materializationKind: "utility_station",
      plotType: "crafting",
      use: "workshop",
      structureTypeId: "utility_station",
      goldCost: 20,
      storageSlots: 14,
      service:
        "Workshop: crafting workbench, repair order surface, and material staging.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["workshop wood", "iron clamps"],
      tags: ["bikkie", "workshop", "crafting"],
      materialStages: {
        site_preparation: { rough_stone: 2 },
        foundation: { rough_stone: 4 },
        frame: { softwood_log: 6, scrap_metal: 2 },
        interior: { cloth_scrap: 2 },
        utility_setup: { old_coin: 1 },
      },
      laborStages: {
        site_preparation: 5,
        foundation: 8,
        frame: 14,
        interior: 8,
        utility_setup: 6,
      },
      description:
        "Bikkie workbench blueprint for crafting plots. It unlocks workshop storage and service state without being treated as a house.",
    },
    {
      blueprintId: "bikkie_tailoring_booth",
      displayName: "Tailoring Booth",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintTailoringBooth),
      bikkieId: BikkieIds.blueprintTailoringBooth,
      bikkieName: "blueprintTailoringBooth",
      materializationKind: "utility_station",
      plotType: "crafting",
      use: "workshop",
      structureTypeId: "utility_station",
      goldCost: 24,
      storageSlots: 16,
      service:
        "Workshop: tailoring station, cloth orders, dye prep, and outfit service marker.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["dyed cloth", "oak frame", "brass needle"],
      tags: ["bikkie", "tailoring", "workshop"],
      materialStages: {
        site_preparation: { softwood_log: 2 },
        foundation: { rough_stone: 3 },
        frame: { softwood_log: 5 },
        walls: { cloth_scrap: 6 },
        interior: { cloth_scrap: 4, old_coin: 1 },
        utility_setup: { clean_water: 1 },
      },
      laborStages: {
        site_preparation: 5,
        foundation: 8,
        frame: 12,
        walls: 10,
        interior: 12,
        utility_setup: 6,
      },
      description:
        "Bikkie tailoring booth blueprint for a legal crafting yard and clothing service loop.",
    },
    {
      blueprintId: "bikkie_dye_o_matic",
      displayName: "Dye-O-Matic",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintDyeOMatic),
      bikkieId: BikkieIds.blueprintDyeOMatic,
      bikkieName: "blueprintDyeOMatic",
      materializationKind: "utility_station",
      plotType: "crafting",
      use: "workshop",
      structureTypeId: "utility_station",
      goldCost: 26,
      storageSlots: 12,
      service:
        "Workshop: dye station, color work orders, and water-fed cloth processing.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["bright dye", "steel drum", "water blue"],
      tags: ["bikkie", "dye", "workshop"],
      materialStages: {
        foundation: { rough_stone: 4, river_clay: 2 },
        frame: { scrap_metal: 4, softwood_log: 3 },
        interior: { clean_water: 3, cloth_scrap: 3 },
        utility_setup: { mana_essence: 1 },
      },
      laborStages: {
        foundation: 10,
        frame: 14,
        interior: 14,
        utility_setup: 8,
      },
      description:
        "Bikkie dye station blueprint for compact production machinery on a crafting plot.",
    },
    {
      blueprintId: "bikkie_thermoblaster",
      displayName: "Thermoblaster",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintThermoblaster),
      bikkieId: BikkieIds.blueprintThermoblaster,
      bikkieName: "blueprintThermoblaster",
      materializationKind: "utility_station",
      plotType: "crafting",
      use: "workshop",
      structureTypeId: "utility_station",
      goldCost: 34,
      storageSlots: 10,
      service:
        "Workshop: heat tool station, metal service, and high-energy repair orders.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["dark metal", "orange heat", "warning stripe"],
      tags: ["bikkie", "machine", "workshop"],
      materialStages: {
        foundation: { rough_stone: 6 },
        frame: { scrap_metal: 8 },
        interior: { mana_essence: 1, clean_water: 1 },
        utility_setup: { scrap_metal: 3, old_coin: 1 },
      },
      laborStages: {
        foundation: 12,
        frame: 18,
        interior: 12,
        utility_setup: 10,
      },
      description:
        "Bikkie thermoblaster blueprint for heat machinery. It is restricted to a crafting yard so it does not appear as home decor.",
    },
    {
      blueprintId: "bikkie_thermolite",
      displayName: "Thermolite",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintThermolite),
      bikkieId: BikkieIds.blueprintThermolite,
      bikkieName: "blueprintThermolite",
      materializationKind: "utility_station",
      plotType: "crafting",
      use: "workshop",
      structureTypeId: "utility_station",
      goldCost: 30,
      storageSlots: 10,
      service:
        "Workshop: compact energy heater, light industrial service, and maintenance contracts.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["warm white", "amber core", "steel base"],
      tags: ["bikkie", "machine", "workshop"],
      materialStages: {
        foundation: { rough_stone: 4 },
        frame: { scrap_metal: 6, softwood_log: 2 },
        interior: { mana_essence: 1 },
        utility_setup: { clean_water: 1, old_coin: 1 },
      },
      laborStages: {
        foundation: 10,
        frame: 16,
        interior: 10,
        utility_setup: 8,
      },
      description:
        "Bikkie thermolite blueprint for a smaller workshop energy fixture.",
    },
    {
      blueprintId: "bikkie_composter",
      displayName: "Composter",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintComposter),
      bikkieId: BikkieIds.blueprintComposter,
      bikkieName: "blueprintComposter",
      materializationKind: "farm_utility",
      plotType: "farm",
      use: "farm",
      structureTypeId: "farm_utility",
      goldCost: 14,
      storageSlots: 8,
      service:
        "Farm: compost station, fertilizer storage, and crop-support marker.",
      footprint: { width: 3, depth: 3, height: 2 },
      colors: ["garden wood", "muck green", "soil brown"],
      tags: ["bikkie", "farm", "compost"],
      materialStages: {
        site_preparation: { river_clay: 3 },
        foundation: { rough_stone: 3 },
        frame: { softwood_log: 5 },
        interior: { clean_water: 1 },
        utility_setup: { tree_resin: 1 },
      },
      laborStages: {
        site_preparation: 5,
        foundation: 7,
        frame: 10,
        interior: 5,
        utility_setup: 4,
      },
      description:
        "Bikkie composter blueprint for farm plots. It supports food production and uses farm-scale materialization.",
    },
    {
      blueprintId: "bikkie_seed_mill",
      displayName: "Seed Mill",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintSeedMill),
      bikkieId: BikkieIds.blueprintSeedMill,
      bikkieName: "blueprintSeedMill",
      materializationKind: "farm_utility",
      plotType: "farm",
      use: "farm",
      structureTypeId: "farm_utility",
      goldCost: 18,
      storageSlots: 12,
      service:
        "Farm: seed processing, crop-order staging, and farming contract support.",
      footprint: { width: 3, depth: 3, height: 3 },
      colors: ["seed tan", "oak wheel", "green trim"],
      tags: ["bikkie", "farm", "seed"],
      materialStages: {
        site_preparation: { river_clay: 2 },
        foundation: { rough_stone: 4 },
        frame: { softwood_log: 6, scrap_metal: 1 },
        interior: { cloth_scrap: 2 },
        utility_setup: { clean_water: 1, old_coin: 1 },
      },
      laborStages: {
        site_preparation: 5,
        foundation: 8,
        frame: 12,
        interior: 8,
        utility_setup: 5,
      },
      description:
        "Bikkie seed mill blueprint for farm and food loops. It is buildable only on farm-support land.",
    },
    {
      blueprintId: "bikkie_fence",
      displayName: "Fence",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintFence),
      bikkieId: BikkieIds.blueprintFence,
      bikkieName: "blueprintFence",
      materializationKind: "fence_line",
      plotType: "farm",
      use: "public_service",
      structureTypeId: "fence",
      goldCost: 6,
      storageSlots: 0,
      service:
        "Public service: boundary fence segment, animal lane hint, and plot safety marker.",
      footprint: { width: 1, depth: 5, height: 2 },
      colors: ["plain wood", "rope lash"],
      tags: ["bikkie", "fence", "boundary"],
      materialStages: {
        frame: { softwood_log: 4 },
        utility_setup: { tree_resin: 1 },
      },
      laborStages: { frame: 8, utility_setup: 3 },
      description:
        "Bikkie fence blueprint for boundary-scale construction. It creates a fence line rather than a building shell.",
    },
    {
      blueprintId: "bikkie_comms_tower",
      displayName: "Comms Tower",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintCommsTower),
      bikkieId: BikkieIds.blueprintCommsTower,
      bikkieName: "blueprintCommsTower",
      materializationKind: "signal_tower",
      plotType: "public",
      use: "public_service",
      structureTypeId: "signal_tower",
      goldCost: 55,
      storageSlots: 8,
      service:
        "Public service: communications relay, map marker, and route signal support.",
      footprint: { width: 5, depth: 5, height: 10 },
      colors: ["dark metal", "blue signal", "copper wire"],
      tags: ["bikkie", "tower", "public"],
      materialStages: {
        site_preparation: { rough_stone: 4 },
        foundation: { rough_stone: 10, scrap_metal: 4 },
        frame: { scrap_metal: 12, softwood_log: 4 },
        walls: { scrap_metal: 4 },
        roof: { scrap_metal: 4, mana_essence: 1 },
        interior: { old_coin: 1 },
        utility_setup: { mana_essence: 1 },
      },
      laborStages: {
        site_preparation: 10,
        foundation: 20,
        frame: 34,
        walls: 14,
        roof: 14,
        interior: 8,
        utility_setup: 14,
      },
      description:
        "Bikkie comms tower blueprint for public-service plots. It validates road access and height before materializing a tower.",
    },
    {
      blueprintId: "bikkie_network_tower",
      displayName: "Network Tower",
      source: "bikkie_blueprint",
      blueprintItemId: String(BikkieIds.blueprintNetworkTower),
      bikkieId: BikkieIds.blueprintNetworkTower,
      bikkieName: "blueprintNetworkTower",
      materializationKind: "signal_tower",
      plotType: "public",
      use: "public_service",
      structureTypeId: "signal_tower",
      goldCost: 65,
      storageSlots: 10,
      service:
        "Public service: network relay, navigation upgrade anchor, and town signal infrastructure.",
      footprint: { width: 5, depth: 5, height: 10 },
      colors: ["silver frame", "cyan signal", "black cable"],
      tags: ["bikkie", "tower", "network", "public"],
      materialStages: {
        site_preparation: { rough_stone: 5 },
        foundation: { rough_stone: 12, scrap_metal: 5 },
        frame: { scrap_metal: 14, softwood_log: 4 },
        walls: { scrap_metal: 5 },
        roof: { scrap_metal: 5, mana_essence: 1 },
        interior: { old_coin: 2 },
        utility_setup: { mana_essence: 2 },
      },
      laborStages: {
        site_preparation: 12,
        foundation: 24,
        frame: 38,
        walls: 16,
        roof: 16,
        interior: 10,
        utility_setup: 16,
      },
      description:
        "Bikkie network tower blueprint for public infrastructure and navigation upgrades.",
    },
  ];

export const BUILDING_SYSTEM_BLUEPRINTS: BuildingSystemBlueprintDefinition[] = [
  {
    blueprintId: "grove_voxel_cottage_tier_1",
    displayName: "Voxel Cottage",
    source: "harthmere_catalog",
    materializationKind: "solid_structure",
    plotType: "residential",
    use: "home",
    structureTypeId: "small_house",
    goldCost: 20,
    storageSlots: 24,
    service:
      "Home: safe rest, private storage, guest access, and respawn-friendly shelter.",
    footprint: { width: 5, depth: 5, height: 4 },
    materialStages: {
      site_preparation: { rough_stone: 4 },
      foundation: { rough_stone: 12, river_clay: 4 },
      frame: { softwood_log: 12 },
      walls: { rough_stone: 10, softwood_log: 6 },
      roof: { rough_stone: 6, oak_branch: 6 },
      interior: { cloth_scrap: 4 },
      utility_setup: { clean_water: 2 },
    },
    laborStages: {
      site_preparation: 10,
      foundation: 20,
      frame: 25,
      walls: 25,
      roof: 20,
      interior: 15,
      utility_setup: 10,
    },
    description:
      "A starter home built as solid voxel foundation, floor, walls, roof, and stair/door clearance.",
  },
  {
    blueprintId: "grove_voxel_shop_tier_1",
    displayName: "Voxel Shopfront",
    source: "harthmere_catalog",
    materializationKind: "solid_structure",
    plotType: "commercial",
    use: "business",
    structureTypeId: "shop",
    goldCost: 35,
    storageSlots: 18,
    service:
      "Business: shop counter, listings, customer access, and taxable sales ledger.",
    footprint: { width: 6, depth: 6, height: 4 },
    materialStages: {
      site_preparation: { rough_stone: 4 },
      foundation: { rough_stone: 10 },
      frame: { softwood_log: 12, iron_ore: 3 },
      walls: { rough_stone: 8, softwood_log: 8 },
      roof: { rough_stone: 6, tree_resin: 1 },
      interior: { old_coin: 1, cloth_scrap: 4 },
      utility_setup: { clean_water: 2, scrap_metal: 2 },
    },
    laborStages: {
      site_preparation: 12,
      foundation: 22,
      frame: 25,
      walls: 25,
      roof: 20,
      interior: 18,
      utility_setup: 12,
    },
    description:
      "A public shop/business shell with a real voxel counter-facing building footprint and path-safe entrance.",
  },
  {
    blueprintId: "grove_voxel_guild_hall_tier_1",
    displayName: "Voxel Guild Hall",
    source: "harthmere_catalog",
    materializationKind: "solid_structure",
    plotType: "guild",
    use: "guild",
    structureTypeId: "guild_hall",
    goldCost: 80,
    storageSlots: 96,
    service:
      "Guild: shared permissions, guild bank, charter board, project staging, and public meeting hall.",
    footprint: { width: 14, depth: 14, height: 8 },
    materialStages: {
      site_preparation: { rough_stone: 12 },
      foundation: { rough_stone: 48, river_clay: 18 },
      frame: { softwood_log: 42, iron_ore: 12 },
      walls: { rough_stone: 36, softwood_log: 18 },
      roof: { rough_stone: 24, oak_branch: 18, tree_resin: 4 },
      interior: { cloth_scrap: 12, old_coin: 4 },
      utility_setup: { clean_water: 8, mana_essence: 2 },
    },
    laborStages: {
      site_preparation: 30,
      foundation: 80,
      frame: 90,
      walls: 90,
      roof: 70,
      interior: 50,
      utility_setup: 40,
    },
    description:
      "A guild building, not a home: solid voxel hall, shared services, permissions, and civic project space.",
  },
  ...BUILDING_SYSTEM_BIKKIE_BLUEPRINTS,
];

export function ensureBuildingSystemStructureDefinitions() {
  // The base authority already registers small_house, shop, farm_plot, guild_hall,
  // and fence. Register the rest of the production building types so property
  // uses beyond homes never fail as unknown structures in isolation tests.
  registerHarthmereStructureDefinition({
    structureTypeId: "workshop",
    displayName: "Workshop",
    footprint: { width: 8, depth: 7, height: 5 },
    maxSlopeDegrees: 8,
    requiredFoundationVoxels: 56,
    minSpacingToStructureVoxels: 3,
    minEntranceClearanceVoxels: 4,
    hasEntrance: true,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone"],
    maxHeightAboveGround: 10,
    requiredPlotType: "crafting",
    minPlotAreaVoxels: 96,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "warehouse",
    displayName: "Warehouse",
    footprint: { width: 10, depth: 8, height: 6 },
    maxSlopeDegrees: 6,
    requiredFoundationVoxels: 80,
    minSpacingToStructureVoxels: 3,
    minEntranceClearanceVoxels: 5,
    hasEntrance: true,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone", "sand"],
    maxHeightAboveGround: 12,
    requiredPlotType: "commercial",
    minPlotAreaVoxels: 120,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "large_house",
    displayName: "Large House",
    footprint: { width: 11, depth: 10, height: 7 },
    maxSlopeDegrees: 8,
    requiredFoundationVoxels: 110,
    minSpacingToStructureVoxels: 4,
    minEntranceClearanceVoxels: 5,
    hasEntrance: true,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone"],
    maxHeightAboveGround: 14,
    requiredPlotType: "residential",
    minPlotAreaVoxels: 180,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "market_stall",
    displayName: "Market Stall",
    footprint: { width: 5, depth: 4, height: 3 },
    maxSlopeDegrees: 8,
    requiredFoundationVoxels: 20,
    minSpacingToStructureVoxels: 2,
    minEntranceClearanceVoxels: 3,
    hasEntrance: true,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone", "sand"],
    maxHeightAboveGround: 6,
    requiredPlotType: "commercial",
    minPlotAreaVoxels: 48,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "canopy",
    displayName: "Canopy",
    footprint: { width: 5, depth: 4, height: 3 },
    maxSlopeDegrees: 10,
    requiredFoundationVoxels: 12,
    minSpacingToStructureVoxels: 1,
    minEntranceClearanceVoxels: 3,
    hasEntrance: false,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone", "sand"],
    maxHeightAboveGround: 6,
    requiredPlotType: "commercial",
    minPlotAreaVoxels: 36,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "fixture",
    displayName: "Fixture",
    footprint: { width: 3, depth: 2, height: 2 },
    maxSlopeDegrees: 12,
    requiredFoundationVoxels: 2,
    minSpacingToStructureVoxels: 1,
    minEntranceClearanceVoxels: 1,
    hasEntrance: false,
    requiresRoadAccess: false,
    allowedTerrainTypes: ["grass", "dirt", "stone", "sand"],
    maxHeightAboveGround: 4,
    minPlotAreaVoxels: 4,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "utility_station",
    displayName: "Utility Station",
    footprint: { width: 3, depth: 3, height: 3 },
    maxSlopeDegrees: 10,
    requiredFoundationVoxels: 9,
    minSpacingToStructureVoxels: 1,
    minEntranceClearanceVoxels: 2,
    hasEntrance: false,
    requiresRoadAccess: false,
    allowedTerrainTypes: ["grass", "dirt", "stone"],
    maxHeightAboveGround: 6,
    minPlotAreaVoxels: 16,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "farm_utility",
    displayName: "Farm Utility",
    footprint: { width: 3, depth: 3, height: 3 },
    maxSlopeDegrees: 8,
    requiredFoundationVoxels: 9,
    minSpacingToStructureVoxels: 1,
    minEntranceClearanceVoxels: 2,
    hasEntrance: false,
    requiresRoadAccess: false,
    allowedTerrainTypes: ["grass", "dirt"],
    maxHeightAboveGround: 5,
    requiredPlotType: "farm",
    minPlotAreaVoxels: 16,
  });
  registerHarthmereStructureDefinition({
    structureTypeId: "signal_tower",
    displayName: "Signal Tower",
    footprint: { width: 5, depth: 5, height: 10 },
    maxSlopeDegrees: 6,
    requiredFoundationVoxels: 25,
    minSpacingToStructureVoxels: 4,
    minEntranceClearanceVoxels: 5,
    hasEntrance: true,
    requiresRoadAccess: true,
    allowedTerrainTypes: ["grass", "dirt", "stone"],
    maxHeightAboveGround: 12,
    requiredPlotType: "public",
    minPlotAreaVoxels: 100,
  });
}

export function buildingSystemPlotById(plotId: string | undefined) {
  return BUILDING_SYSTEM_PLOTS.find((plot) => plot.plotId === plotId);
}

export function buildingSystemBlueprintById(blueprintId: string | undefined) {
  return BUILDING_SYSTEM_BLUEPRINTS.find(
    (blueprint) => blueprint.blueprintId === blueprintId
  );
}

export function buildingSystemBlueprintByItemId(
  blueprintItemId: string | number | undefined
) {
  if (blueprintItemId === undefined) {
    return undefined;
  }
  const itemId = String(blueprintItemId);
  return BUILDING_SYSTEM_BLUEPRINTS.find(
    (blueprint) => blueprint.blueprintItemId === itemId
  );
}

export function isBuildingSystemBlueprintItemId(
  blueprintItemId: string | number | undefined
) {
  return Boolean(buildingSystemBlueprintByItemId(blueprintItemId));
}

export function buildingSystemBlueprintByStructureType(
  structureTypeId: string | undefined,
  plotType?: HarthmerePlotType
) {
  return BUILDING_SYSTEM_BLUEPRINTS.find(
    (blueprint) =>
      blueprint.structureTypeId === structureTypeId &&
      (!plotType || blueprint.plotType === plotType)
  );
}

function plotBoundaryPolygon(plot: BuildingSystemPlotDefinition) {
  const { xMin, xMax, zMin, zMax } = plot.bounds;
  return [
    { x: xMin, z: zMin },
    { x: xMax, z: zMin },
    { x: xMax, z: zMax },
    { x: xMin, z: zMax },
  ];
}

export function toHarthmerePlotDefinition(
  plot: BuildingSystemPlotDefinition,
  ownerId: string,
  active = true,
  currentCoveredAreaVoxels = 0
): HarthmerePlotDefinition {
  const area =
    Math.max(1, plot.bounds.xMax - plot.bounds.xMin) *
    Math.max(1, plot.bounds.zMax - plot.bounds.zMin);
  return {
    plotId: plot.plotId,
    ownerId,
    plotType: plot.plotType,
    boundaryPolygon: plotBoundaryPolygon(plot),
    maxStructureHeight: plot.maxStructureHeight,
    maxCoveredAreaFraction: plot.maxCoveredAreaFraction,
    currentCoveredAreaVoxels,
    totalAreaVoxels: area,
    active,
  };
}

export function buildingSystemDefaultOrigin(
  plot: BuildingSystemPlotDefinition,
  blueprint: BuildingSystemBlueprintDefinition
) {
  return {
    x: Math.floor(
      (plot.bounds.xMin + plot.bounds.xMax - blueprint.footprint.width) / 2
    ),
    y: plot.groundY + 1,
    z: Math.floor(
      (plot.bounds.zMin + plot.bounds.zMax - blueprint.footprint.depth) / 2
    ),
  };
}

// HARTHMERE_BUILDING_TERRAIN_GROUNDING
//
// Plots author a single flat `groundY` (the wilds floor hint). A baked building
// or boundary/deed marker stamped at that flat Y floats above or buries below
// real terrain wherever the surface differs — the same flat-Y bug the muckers,
// animals, drops, and quest markers were fixed for with the shared grounder.
// Baked voxels cannot be re-grounded every frame like a rendered mesh, so we
// instead resolve the REAL surface ONCE, at materialization, and shift the whole
// plan onto it. The probe reuses the one shared terrain scan
// (`findHarthmereGroundFeetY`); the caller supplies an `isSolid` sampler over
// the real voxel terrain. If the surface cannot be resolved the plan is returned
// UNCHANGED (authored Y), so a missing/unreadable column can only ever leave a
// structure where it is today — never teleport or bury it.
const BUILDING_GROUND_SHIFT_SCAN = 24;

export function shiftBuildingSystemMaterializationPlanY<
  T extends BuildingSystemAnyMaterializationPlan
>(plan: T, shiftY: number): T {
  if (!Number.isFinite(shiftY) || shiftY === 0) {
    return plan;
  }
  const shiftPosition = (
    position: [number, number, number]
  ): [number, number, number] => [
    position[0],
    position[1] + shiftY,
    position[2],
  ];
  const next: any = {
    ...plan,
    edits: plan.edits.map((edit) => ({
      ...edit,
      position: shiftPosition(edit.position),
    })),
  };
  if ("inWorldMarkers" in plan && plan.inWorldMarkers) {
    next.inWorldMarkers = plan.inWorldMarkers.map((marker) => ({
      ...marker,
      position: shiftPosition(marker.position),
    }));
  }
  if ("origin" in plan && plan.origin) {
    next.origin = { ...plan.origin, y: plan.origin.y + shiftY };
  }
  return next as T;
}

// Resolve the real surface under a materialization plan and return a copy shifted
// so it rests on that surface. A building (has `origin`) is aligned so its FLOOR
// (origin.y) sits flush with the ground the player walks on; a markers-only plan
// (plot claim / terraform) is aligned so its lowest marker block rests on the
// surface. The vertical shift is clamped to the scan window so even a surprising
// probe can never fling a structure far, and an unresolved surface yields the
// unchanged plan.
export function groundedBuildingSystemMaterializationPlan<
  T extends BuildingSystemAnyMaterializationPlan
>(plan: T, isSolid: HarthmereSolidSampler, options?: { maxScan?: number }): T {
  if (!plan.edits.length) {
    return plan;
  }
  let sumX = 0;
  let sumZ = 0;
  let minEditY = Infinity;
  for (const edit of plan.edits) {
    sumX += edit.position[0];
    sumZ += edit.position[2];
    minEditY = Math.min(minEditY, edit.position[1]);
  }
  const columnX = Math.floor(sumX / plan.edits.length);
  const columnZ = Math.floor(sumZ / plan.edits.length);
  const hasOrigin = "origin" in plan && Boolean((plan as any).origin);
  // For a building, the floor we walk on is origin.y; aligning the floor flush
  // with the surface means standing-on-floor == standing-on-outside-ground.
  // For a markers-only plan, the lowest marker block should rest on the surface.
  const referenceY = hasOrigin
    ? (plan as BuildingSystemMaterializationPlan).origin.y
    : minEditY;
  const scan = Math.max(
    1,
    Math.floor(options?.maxScan ?? BUILDING_GROUND_SHIFT_SCAN)
  );
  const groundedFeetY = findHarthmereGroundFeetY(isSolid, columnX, columnZ, {
    hintY: Math.round(referenceY),
    maxScanDown: scan,
    maxScanUp: scan,
    requireOpenSky: false,
  });
  if (groundedFeetY === undefined) {
    return plan;
  }
  // A building's floor block sits one below the standable feet level (you stand
  // ON the floor); a marker block rests AT the surface feet level.
  const targetReferenceY = hasOrigin ? groundedFeetY - 1 : groundedFeetY;
  const shiftY = Math.max(-scan, Math.min(scan, targetReferenceY - referenceY));
  return shiftBuildingSystemMaterializationPlanY(plan, shiftY);
}

function clampBuildingSystemGuideCoordinate(
  value: number,
  min: number,
  max: number
) {
  return Math.max(min, Math.min(max, value));
}

export function createBuildingSystemGuideConstructionMath(input: {
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
}): BuildingSystemGuideConstructionMath {
  const origin =
    input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint);
  const fp = input.blueprint.footprint;
  const x0 = origin.x;
  const y0 = origin.y;
  const z0 = origin.z;
  const x1 = x0 + fp.width;
  const z1 = z0 + fp.depth;
  const wallTopY = y0 + Math.max(3, fp.height - 1);
  const roofY = wallTopY;
  const doorX = Math.floor((x0 + x1) / 2);
  const stairPosition: [number, number, number] = [doorX, y0, z0 - 1];
  const plotWidth = Math.max(
    1,
    input.plot.bounds.xMax - input.plot.bounds.xMin
  );
  const plotDepth = Math.max(
    1,
    input.plot.bounds.zMax - input.plot.bounds.zMin
  );
  const plotAreaVoxels = plotWidth * plotDepth;
  const coveredAreaVoxels = Math.max(1, fp.width) * Math.max(1, fp.depth);
  const footprintInsidePlot =
    x0 >= input.plot.bounds.xMin &&
    x1 <= input.plot.bounds.xMax &&
    z0 >= input.plot.bounds.zMin &&
    z1 <= input.plot.bounds.zMax;
  const groundedToPlot = y0 === input.plot.groundY + 1;
  const stairInsidePlot =
    stairPosition[0] >= input.plot.bounds.xMin &&
    stairPosition[0] < input.plot.bounds.xMax &&
    stairPosition[2] >= input.plot.bounds.zMin &&
    stairPosition[2] < input.plot.bounds.zMax;
  const coveredAreaFraction = coveredAreaVoxels / plotAreaVoxels;
  const customerMinX = x0 + 2;
  const customerMaxX = x1 - 2;
  const customerMinZ = z0 + 2;
  const customerMaxZ = z1 - 3;
  const customerSpaceMeters =
    Math.max(0, customerMaxX - customerMinX) *
    Math.max(0, customerMaxZ - customerMinZ);
  const serviceCounterZ = clampBuildingSystemGuideCoordinate(
    z0 + Math.max(3, Math.min(8, fp.depth - 2)),
    z0 + 1,
    z1 - 2
  );
  const dashboardX = clampBuildingSystemGuideCoordinate(
    Math.max(x0 + 3, doorX - 4),
    x0 + 1,
    x1 - 2
  );
  const dashboardZ = clampBuildingSystemGuideCoordinate(
    Math.max(z0 + 4, serviceCounterZ - 1),
    z0 + 1,
    z1 - 2
  );
  const leftX = clampBuildingSystemGuideCoordinate(x0 + 3, x0 + 1, x1 - 2);
  const rightX = clampBuildingSystemGuideCoordinate(x1 - 4, x0 + 1, x1 - 2);
  const frontZ = clampBuildingSystemGuideCoordinate(z0 + 5, z0 + 1, z1 - 2);
  const sideZ = clampBuildingSystemGuideCoordinate(
    Math.max(z0 + 6, serviceCounterZ - 3),
    z0 + 1,
    z1 - 2
  );
  const backZ = clampBuildingSystemGuideCoordinate(
    Math.min(z1 - 4, serviceCounterZ + 3),
    z0 + 1,
    z1 - 2
  );
  const warnings: string[] = [];
  if (!footprintInsidePlot)
    warnings.push("guide_warning:footprint_outside_plot");
  if (coveredAreaFraction > input.plot.maxCoveredAreaFraction) {
    warnings.push("guide_warning:coverage_exceeds_plot_limit");
  }
  if (!groundedToPlot) {
    warnings.push("guide_warning:floor_not_one_voxel_above_ground");
  }
  if (buildingSystemUsesSolidShell(input.blueprint) && !stairInsidePlot) {
    warnings.push("guide_warning:doorsill_stair_outside_plot");
  }
  if (
    input.blueprint.use === "business" &&
    buildingSystemUsesSolidShell(input.blueprint) &&
    customerSpaceMeters < 4
  ) {
    warnings.push("guide_warning:customer_space_below_guide");
  }

  return {
    version: BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION,
    source: "grove_business_outpost_construction_report",
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    materializationKind: input.blueprint.materializationKind,
    use: input.blueprint.use,
    origin,
    rotationDegrees: input.rotationDegrees ?? 0,
    footprint: { ...fp },
    x0,
    y0,
    z0,
    x1,
    z1,
    foundationY: y0 - 1,
    floorY: y0,
    wallBottomY: y0 + 1,
    wallTopY,
    roofY,
    doorX,
    doorYMin: y0 + 1,
    doorYMax: y0 + 2,
    stairPosition,
    plotAreaVoxels,
    coveredAreaVoxels,
    coveredAreaFraction,
    maxCoveredAreaFraction: input.plot.maxCoveredAreaFraction,
    footprintInsidePlot,
    groundedToPlot,
    stairInsidePlot,
    usesSolidVoxelShell: buildingSystemUsesSolidShell(input.blueprint),
    clearances: {
      frontDoorBlocks: Math.max(0, z0 - input.plot.bounds.zMin),
      publicEntranceBlocks: Math.max(0, z0 - input.plot.bounds.zMin),
      interiorAisleBlocks: Math.max(0, fp.width - 4),
      counterClearanceBlocks: 2,
      queueSpacingBlocks: 1,
      customerSpaceMeters,
    },
    interiorAnchors: {
      door: [doorX, y0 + 1, z0],
      entrance: [doorX, y0 + 1, z0 - 1],
      queueNode: [doorX, y0 + 1, z0 + Math.min(3, Math.max(1, fp.depth - 2))],
      serviceCounter: [doorX, y0 + 1, serviceCounterZ],
      exitNode: [
        clampBuildingSystemGuideCoordinate(
          Math.min(x1 - 3, doorX + 2),
          x0 + 1,
          x1 - 2
        ),
        y0 + 1,
        clampBuildingSystemGuideCoordinate(z0 + 1, z0 + 1, z1 - 2),
      ],
      dashboard: [dashboardX, y0 + 1, dashboardZ],
      customerSpace: {
        minX: customerMinX,
        maxX: customerMaxX,
        minZ: customerMinZ,
        maxZ: customerMaxZ,
        areaMeters: customerSpaceMeters,
      },
      fixtureSlots: {
        left: [leftX, y0 + 1, sideZ],
        right: [rightX, y0 + 1, sideZ],
        backLeft: [
          clampBuildingSystemGuideCoordinate(leftX + 1, x0 + 1, x1 - 2),
          y0 + 1,
          backZ,
        ],
        backRight: [
          clampBuildingSystemGuideCoordinate(rightX - 1, x0 + 1, x1 - 2),
          y0 + 1,
          backZ,
        ],
        frontLeft: [
          clampBuildingSystemGuideCoordinate(leftX + 1, x0 + 1, x1 - 2),
          y0 + 1,
          frontZ,
        ],
        frontRight: [
          clampBuildingSystemGuideCoordinate(rightX - 1, x0 + 1, x1 - 2),
          y0 + 1,
          frontZ,
        ],
      },
    },
    materialPalette: {
      foundation: BUILDING_BLOCKS.foundation,
      floor: BUILDING_BLOCKS.floor,
      frame: BUILDING_BLOCKS.frame,
      wall: BUILDING_BLOCKS.wall,
      roof: BUILDING_BLOCKS.roof,
      stair: BUILDING_BLOCKS.stair,
      interior: BUILDING_BLOCKS.interior,
      safeGround: BUILDING_BLOCKS.safeGround,
      storageContainer: BUILDING_BLOCKS.storageContainer,
      doorLock: BUILDING_BLOCKS.doorLock,
      businessMarker: BUILDING_BLOCKS.businessMarker,
      homeConsole: BUILDING_BLOCKS.homeConsole,
    },
    assetVocabulary: BUILDING_SYSTEM_GUIDE_ASSET_VOCABULARY,
    warnings,
  };
}

export function createBuildingSystemPlacementContext(input: {
  actorId: string;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  owned: boolean;
  nearbyStructures?: HarthmereBuildingPlacementContext["nearbyStructures"];
  npcRouteWaypoints?: HarthmereBuildingPlacementContext["npcRouteWaypoints"];
  questTriggerAreas?: HarthmereBuildingPlacementContext["questTriggerAreas"];
  currentCoveredAreaVoxels?: number;
}): HarthmereBuildingPlacementContext {
  const origin =
    input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint);
  const cols: HarthmereBuildingPlacementContext["terrainColumns"] = [];
  for (let x = origin.x; x < origin.x + input.blueprint.footprint.width; x++) {
    for (
      let z = origin.z;
      z < origin.z + input.blueprint.footprint.depth;
      z++
    ) {
      cols.push({
        x,
        z,
        terrainType: input.plot.terrainType,
        groundHeight: input.plot.groundY,
        slopeDegrees: 0,
        hasFoundationSupport: true,
      });
    }
  }
  const roadDistance = input.plot.requiresRoadAccess
    ? input.plot.roadAccessDistanceVoxels
    : 0;
  return {
    terrainColumns: cols,
    nearbyStructures: input.nearbyStructures ?? [],
    npcRouteWaypoints: input.npcRouteWaypoints ?? [],
    questTriggerAreas: input.questTriggerAreas ?? [],
    hasRoadAccess:
      !input.plot.requiresRoadAccess || typeof roadDistance === "number",
    minRoadDistanceVoxels: roadDistance ?? 0,
    plot: toHarthmerePlotDefinition(
      input.plot,
      input.owned ? input.actorId : "",
      input.owned,
      input.currentCoveredAreaVoxels ?? 0
    ),
  };
}

function pushVoxelBox(
  edits: BuildingSystemVoxelEditSpec[],
  min: [number, number, number],
  maxExclusive: [number, number, number],
  value: BiomesId,
  label: BuildingSystemVoxelEditSpec["label"]
) {
  for (let x = min[0]; x < maxExclusive[0]; x++) {
    for (let y = min[1]; y < maxExclusive[1]; y++) {
      for (let z = min[2]; z < maxExclusive[2]; z++) {
        edits.push({ kind: "editEvent", position: [x, y, z], value, label });
      }
    }
  }
}

export function buildingSystemMaterialDefinition(material: string) {
  return BUILDING_SYSTEM_MATERIAL_CATALOG[
    material as BuildingSystemMaterialSymbol
  ];
}

export function buildingSystemMaterialItemId(material: string) {
  return buildingSystemMaterialDefinition(material)?.itemId;
}

export function buildingSystemMaterialRequirementLines(input: {
  blueprint: BuildingSystemBlueprintDefinition;
  stage: BuildingSystemStage;
  contributed?: Record<string, number>;
}): BuildingSystemMaterialRequirementLine[] {
  const required = input.blueprint.materialStages[input.stage] ?? {};
  return Object.entries(required).map(([material, count]) => {
    const def = buildingSystemMaterialDefinition(material);
    if (!def) {
      throw new Error(`Unknown Building System material: ${material}`);
    }
    const contributed = Math.max(0, input.contributed?.[material] ?? 0);
    return {
      ...def,
      required: count,
      contributed,
      remaining: Math.max(0, count - contributed),
    };
  });
}

export function buildingSystemRemainingMaterialItemDeltas(input: {
  blueprint: BuildingSystemBlueprintDefinition;
  stage: BuildingSystemStage;
  contributed?: Record<string, number>;
  requestedMaterials?: Record<string, number>;
  contributeAll?: boolean;
}) {
  const lines = buildingSystemMaterialRequirementLines({
    blueprint: input.blueprint,
    stage: input.stage,
    contributed: input.contributed,
  });
  const materialDeltas: Record<string, number> = {};
  const symbolicContributions: Record<string, number> = {};
  for (const line of lines) {
    let requested =
      input.contributeAll || !input.requestedMaterials
        ? line.remaining
        : Math.max(
            0,
            Math.trunc(
              Number(
                input.requestedMaterials[line.material] ??
                  input.requestedMaterials[line.itemId] ??
                  0
              )
            )
          );
    requested = Math.min(line.remaining, requested);
    if (requested > 0) {
      materialDeltas[line.itemId] =
        (materialDeltas[line.itemId] ?? 0) - requested;
      symbolicContributions[line.material] =
        (symbolicContributions[line.material] ?? 0) + requested;
    }
  }
  return { itemDeltas: materialDeltas, symbolicContributions, lines };
}

function createBuildingSystemPlotMarkers(input: {
  actorId: string;
  plot: BuildingSystemPlotDefinition;
  activatedAtMs: number;
  terrainState?: "muck" | "terraformed";
  includeSafeZoneMarker?: boolean;
}) {
  const edits: BuildingSystemVoxelEditSpec[] = [];
  const markers: BuildingSystemInWorldMarker[] = [];
  const y = input.plot.groundY + 1;
  const { xMin, xMax, zMin, zMax } = input.plot.bounds;
  const markerEvery = 3;
  for (let x = xMin; x < xMax; x += markerEvery) {
    edits.push({
      kind: "editEvent",
      position: [x, y, zMin],
      value: BUILDING_BLOCKS.boundaryMarker,
      label: "boundary_marker",
    });
    edits.push({
      kind: "editEvent",
      position: [x, y, zMax - 1],
      value: BUILDING_BLOCKS.boundaryMarker,
      label: "boundary_marker",
    });
  }
  for (let z = zMin; z < zMax; z += markerEvery) {
    edits.push({
      kind: "editEvent",
      position: [xMin, y, z],
      value: BUILDING_BLOCKS.boundaryMarker,
      label: "boundary_marker",
    });
    edits.push({
      kind: "editEvent",
      position: [xMax - 1, y, z],
      value: BUILDING_BLOCKS.boundaryMarker,
      label: "boundary_marker",
    });
  }
  const center: [number, number, number] = [
    Math.floor((xMin + xMax) / 2),
    y,
    Math.floor((zMin + zMax) / 2),
  ];
  const deed: [number, number, number] = [xMin + 1, y, zMin + 1];
  const map: [number, number, number] = [center[0], y + 1, center[2]];
  const terraformed = input.terrainState === "terraformed";
  edits.push({
    kind: "editEvent",
    position: deed,
    value: BUILDING_BLOCKS.deedMarker,
    label: "deed_marker",
  });
  edits.push({
    kind: "editEvent",
    position: map,
    value: BUILDING_BLOCKS.mapMarker,
    label: "map_marker",
  });
  markers.push(
    {
      markerId: `${input.plot.plotId}:boundary`,
      plotId: input.plot.plotId,
      kind: "muck_boundary",
      position: center,
      label: `${input.plot.displayName} boundary`,
      createdAtMs: input.activatedAtMs,
    },
    {
      markerId: `${input.plot.plotId}:deed`,
      plotId: input.plot.plotId,
      kind: "deed_sign",
      position: deed,
      label: terraformed
        ? `Terraformed by ${input.actorId}`
        : `Muck deed purchased by ${input.actorId}`,
      createdAtMs: input.activatedAtMs,
    },
    {
      markerId: `${input.plot.plotId}:map`,
      plotId: input.plot.plotId,
      kind: "map_marker",
      position: map,
      label: terraformed
        ? `${input.plot.displayName} terraformed property`
        : `${input.plot.displayName} muck deed`,
      createdAtMs: input.activatedAtMs,
    }
  );
  if (input.includeSafeZoneMarker) {
    markers.push({
      markerId: `${input.plot.plotId}:safe-zone`,
      plotId: input.plot.plotId,
      kind: "safe_zone",
      position: center,
      label: "Safe from muck after terraforming",
      createdAtMs: input.activatedAtMs,
    });
  }
  return { edits, markers };
}

function pushBuildingWalls(input: {
  edits: BuildingSystemVoxelEditSpec[];
  x0: number;
  x1: number;
  y0: number;
  z0: number;
  z1: number;
  wallTop: number;
}) {
  const doorColumns = buildingSystemDoorOpeningColumns(input.x0, input.x1);
  for (let y = input.y0 + 1; y < input.wallTop; y++) {
    for (let x = input.x0; x < input.x1; x++) {
      const isDoor =
        doorColumns.includes(x) && (y === input.y0 + 1 || y === input.y0 + 2);
      if (!isDoor) {
        input.edits.push({
          kind: "editEvent",
          position: [x, y, input.z0],
          value: BUILDING_BLOCKS.wall,
          label: "wall",
        });
      }
      input.edits.push({
        kind: "editEvent",
        position: [x, y, input.z1 - 1],
        value: BUILDING_BLOCKS.wall,
        label: "wall",
      });
    }
    for (let z = input.z0 + 1; z < input.z1 - 1; z++) {
      input.edits.push({
        kind: "editEvent",
        position: [input.x0, y, z],
        value: BUILDING_BLOCKS.wall,
        label: "wall",
      });
      input.edits.push({
        kind: "editEvent",
        position: [input.x1 - 1, y, z],
        value: BUILDING_BLOCKS.wall,
        label: "wall",
      });
    }
  }
}

function buildingSystemDoorOpeningColumns(x0: number, x1: number) {
  const width = Math.max(1, x1 - x0);
  const center = Math.floor((x0 + x1) / 2);
  if (width < 4) {
    return [center];
  }
  const left = width >= 6 ? center - 1 : center;
  const right = Math.min(x1 - 2, left + 1);
  return [...new Set([left, right])];
}

function buildingSystemGeometryBounds(
  plot: BuildingSystemPlotDefinition,
  blueprint: BuildingSystemBlueprintDefinition,
  origin?: { x: number; y: number; z: number }
) {
  const guideConstruction = createBuildingSystemGuideConstructionMath({
    plot,
    blueprint,
    origin,
  });
  return {
    origin: guideConstruction.origin,
    fp: guideConstruction.footprint,
    x0: guideConstruction.x0,
    y0: guideConstruction.y0,
    z0: guideConstruction.z0,
    x1: guideConstruction.x1,
    z1: guideConstruction.z1,
    wallTop: guideConstruction.wallTopY,
    roofY: guideConstruction.roofY,
    guideConstruction,
  };
}

function buildingSystemUsesSolidShell(
  blueprint: BuildingSystemBlueprintDefinition
) {
  return (
    blueprint.materializationKind === "solid_structure" ||
    blueprint.materializationKind === "shelter_frame"
  );
}

function pushBuildingSystemUtilityBlueprintEdits(input: {
  edits: BuildingSystemVoxelEditSpec[];
  blueprint: BuildingSystemBlueprintDefinition;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  z1: number;
  wallTop: number;
  roofY: number;
  stage?: BuildingSystemStage;
}) {
  const include = (stage: BuildingSystemStage) =>
    !input.stage || input.stage === stage;
  const cx = Math.floor((input.x0 + input.x1) / 2);
  const cz = Math.floor((input.z0 + input.z1) / 2);
  const kind = input.blueprint.materializationKind;
  const postTop =
    kind === "fixture"
      ? input.y0 + Math.max(1, input.blueprint.footprint.height)
      : Math.max(input.y0 + 2, input.wallTop);
  if (
    input.stage &&
    !input.blueprint.materialStages[input.stage] &&
    !input.blueprint.laborStages[input.stage]
  ) {
    return;
  }

  if (kind === "fence_line") {
    if (include("frame")) {
      for (let z = input.z0; z < input.z1; z++) {
        input.edits.push({
          kind: "editEvent",
          position: [input.x0, input.y0, z],
          value: BUILDING_BLOCKS.frame,
          label: "frame",
        });
        if ((z - input.z0) % 2 === 0) {
          input.edits.push({
            kind: "editEvent",
            position: [input.x0, input.y0 + 1, z],
            value: BUILDING_BLOCKS.frame,
            label: "frame",
          });
        }
      }
    }
    if (include("utility_setup")) {
      input.edits.push({
        kind: "editEvent",
        position: [input.x0, input.y0, input.z0],
        value: BUILDING_BLOCKS.deedMarker,
        label: "deed_marker",
      });
    }
    return;
  }

  if (include("foundation")) {
    pushVoxelBox(
      input.edits,
      [input.x0, input.y0 - 1, input.z0],
      [input.x1, input.y0, input.z1],
      BUILDING_BLOCKS.foundation,
      "foundation"
    );
    pushVoxelBox(
      input.edits,
      [input.x0, input.y0, input.z0],
      [input.x1, input.y0 + 1, input.z1],
      kind === "farm_utility"
        ? BUILDING_BLOCKS.safeGround
        : BUILDING_BLOCKS.floor,
      "floor"
    );
  }

  if (include("frame")) {
    const posts: Array<[number, number]> = [
      [input.x0, input.z0],
      [input.x1 - 1, input.z0],
      [input.x0, input.z1 - 1],
      [input.x1 - 1, input.z1 - 1],
    ];
    for (const [px, pz] of posts) {
      const frameY0 = kind === "fixture" ? input.y0 : input.y0 + 1;
      const frameY1 =
        kind === "fixture"
          ? input.y0 + Math.max(1, input.blueprint.footprint.height)
          : postTop;
      pushVoxelBox(
        input.edits,
        [px, frameY0, pz],
        [px + 1, frameY1, pz + 1],
        BUILDING_BLOCKS.frame,
        "frame"
      );
    }
    if (kind === "signal_tower") {
      pushVoxelBox(
        input.edits,
        [cx, input.y0 + 1, cz],
        [cx + 1, input.y0 + input.blueprint.footprint.height, cz + 1],
        BUILDING_BLOCKS.frame,
        "frame"
      );
    }
  }

  if (include("walls")) {
    if (
      kind === "market_stall" ||
      kind === "utility_station" ||
      kind === "farm_utility"
    ) {
      pushVoxelBox(
        input.edits,
        [input.x0, input.y0 + 1, input.z1 - 1],
        [input.x1, input.y0 + 2, input.z1],
        kind === "market_stall"
          ? BUILDING_BLOCKS.interior
          : BUILDING_BLOCKS.wall,
        kind === "market_stall" ? "interior" : "wall"
      );
    }
  }

  if (include("roof")) {
    if (kind === "market_stall" || kind === "canopy") {
      pushVoxelBox(
        input.edits,
        [input.x0, input.roofY, input.z0],
        [input.x1, input.roofY + 1, input.z1],
        BUILDING_BLOCKS.roof,
        "roof"
      );
    } else if (kind === "signal_tower") {
      pushVoxelBox(
        input.edits,
        [
          Math.max(input.x0, cx - 1),
          input.y0 + input.blueprint.footprint.height - 1,
          Math.max(input.z0, cz - 1),
        ],
        [
          Math.min(input.x1, cx + 2),
          input.y0 + input.blueprint.footprint.height,
          Math.min(input.z1, cz + 2),
        ],
        BUILDING_BLOCKS.roof,
        "roof"
      );
    }
  }

  if (include("interior")) {
    const value =
      kind === "farm_utility"
        ? BUILDING_BLOCKS.storageContainer
        : kind === "signal_tower"
        ? BUILDING_BLOCKS.businessMarker
        : BUILDING_BLOCKS.interior;
    input.edits.push({
      kind: "editEvent",
      position: [cx, kind === "fixture" ? input.y0 : input.y0 + 1, cz],
      value,
      label: "interior",
    });
  }

  if (include("utility_setup")) {
    input.edits.push({
      kind: "editEvent",
      position: [cx, kind === "fixture" ? input.y0 : input.y0 + 1, input.z0],
      value: BUILDING_BLOCKS.deedMarker,
      label: "deed_marker",
    });
  }
}

export function createBuildingSystemSafeGroundMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  plot: BuildingSystemPlotDefinition;
  activatedAtMs: number;
  reason?: BuildingSystemTerrainMaterializationPlan["reason"];
}): BuildingSystemTerrainMaterializationPlan {
  const edits: BuildingSystemVoxelEditSpec[] = [];
  const markerPlan = createBuildingSystemPlotMarkers({
    actorId: input.actorId,
    plot: input.plot,
    activatedAtMs: input.activatedAtMs,
    terrainState: "terraformed",
    includeSafeZoneMarker: true,
  });
  pushVoxelBox(
    edits,
    [input.plot.bounds.xMin, input.plot.groundY, input.plot.bounds.zMin],
    [input.plot.bounds.xMax, input.plot.groundY + 1, input.plot.bounds.zMax],
    BUILDING_BLOCKS.safeGround,
    "safe_ground"
  );
  edits.push(...markerPlan.edits);
  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    reason: input.reason ?? "plot_terraform_safe_ground",
    edits,
    safeZone: {
      plotId: input.plot.plotId,
      actorId: input.actorId,
      area: input.plot.area,
      bounds: input.plot.bounds,
      safeFromMuck: true,
      activatedAtMs: input.activatedAtMs,
    },
    inWorldMarkers: markerPlan.markers,
    materializesSolidVoxelBuilding: false,
  };
}

export function createBuildingSystemMuckClaimMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  plot: BuildingSystemPlotDefinition;
  activatedAtMs: number;
}): BuildingSystemTerrainMaterializationPlan {
  const markerPlan = createBuildingSystemPlotMarkers({
    actorId: input.actorId,
    plot: input.plot,
    activatedAtMs: input.activatedAtMs,
    terrainState: "muck",
    includeSafeZoneMarker: false,
  });
  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    reason: "plot_claim_muck_deed",
    edits: markerPlan.edits,
    safeZone: {
      plotId: input.plot.plotId,
      actorId: input.actorId,
      area: input.plot.area,
      bounds: input.plot.bounds,
      safeFromMuck: false,
      activatedAtMs: input.activatedAtMs,
    },
    inWorldMarkers: markerPlan.markers,
    materializesSolidVoxelBuilding: false,
  };
}

function buildingSystemPropertyIdForPlan(input: {
  plot: BuildingSystemPlotDefinition;
  propertyId?: string;
}) {
  return input.propertyId ?? `property_${input.plot.plotId}`;
}

function buildingSystemHomeConsolePosition(input: {
  blueprint: BuildingSystemBlueprintDefinition;
  origin: { x: number; y: number; z: number };
}): [number, number, number] {
  return [
    input.origin.x +
      Math.max(
        0,
        Math.min(
          input.blueprint.footprint.width - 1,
          input.blueprint.footprint.width - 2
        )
      ),
    input.origin.y + 1,
    input.origin.z +
      Math.max(0, Math.min(input.blueprint.footprint.depth - 1, 1)),
  ];
}

function createBuildingSystemPhysicalAccessMarkers(input: {
  propertyId?: string;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin: { x: number; y: number; z: number };
  activatedAtMs: number;
}): BuildingSystemInWorldMarker[] {
  const propertyId = buildingSystemPropertyIdForPlan({
    plot: input.plot,
    propertyId: input.propertyId,
  });
  const markers: BuildingSystemInWorldMarker[] = [];
  if (input.blueprint.storageSlots > 0) {
    markers.push({
      markerId: `storage_${propertyId}`,
      plotId: input.plot.plotId,
      kind: "storage_container",
      position: [input.origin.x + 1, input.origin.y + 1, input.origin.z + 1],
      label: `${input.blueprint.displayName} Storage`,
      createdAtMs: input.activatedAtMs,
    });
  }
  if (buildingSystemUsesSolidShell(input.blueprint)) {
    markers.push({
      markerId: `door_${propertyId}`,
      plotId: input.plot.plotId,
      kind: "door_lock",
      position: [
        input.origin.x + Math.floor(input.blueprint.footprint.width / 2),
        input.origin.y + 1,
        input.origin.z,
      ],
      label: `${input.blueprint.displayName} Door`,
      createdAtMs: input.activatedAtMs,
    });
  }
  if (input.blueprint.use === "home") {
    markers.push({
      markerId: buildingSystemHomeConsoleMarkerId(propertyId),
      plotId: input.plot.plotId,
      kind: "home_console",
      position: buildingSystemHomeConsolePosition(input),
      label: "Home Console",
      createdAtMs: input.activatedAtMs,
    });
  }
  if (input.blueprint.use === "business") {
    markers.push({
      markerId: `business_${propertyId}:marker`,
      plotId: input.plot.plotId,
      kind: "business_marker",
      position: [
        input.origin.x + Math.floor(input.blueprint.footprint.width / 2),
        input.origin.y + 1,
        input.origin.z +
          Math.max(
            1,
            Math.min(
              input.blueprint.footprint.depth - 1,
              input.blueprint.footprint.depth - 2
            )
          ),
      ],
      label: `${input.blueprint.displayName} Counter`,
      createdAtMs: input.activatedAtMs,
    });
  }
  return markers;
}

function pushBuildingSystemPhysicalAccessEdits(input: {
  edits: BuildingSystemVoxelEditSpec[];
  blueprint: BuildingSystemBlueprintDefinition;
  origin: { x: number; y: number; z: number };
}) {
  const y = input.origin.y + 1;
  if (input.blueprint.storageSlots > 0) {
    input.edits.push({
      kind: "editEvent",
      position: [input.origin.x + 1, y, input.origin.z + 1],
      value: BUILDING_BLOCKS.storageContainer,
      label: "storage_container",
    });
  }
  if (buildingSystemUsesSolidShell(input.blueprint)) {
    input.edits.push({
      kind: "editEvent",
      position: [
        input.origin.x +
          Math.min(
            input.blueprint.footprint.width - 1,
            Math.floor(input.blueprint.footprint.width / 2) + 1
          ),
        y,
        input.origin.z,
      ],
      value: BUILDING_BLOCKS.doorLock,
      label: "door_lock",
    });
  }
  if (input.blueprint.use === "home") {
    input.edits.push({
      kind: "editEvent",
      position: buildingSystemHomeConsolePosition(input),
      value: BUILDING_BLOCKS.homeConsole,
      label: "home_console",
    });
  }
  if (input.blueprint.use === "business") {
    input.edits.push({
      kind: "editEvent",
      position: [
        input.origin.x + Math.floor(input.blueprint.footprint.width / 2),
        y,
        input.origin.z +
          Math.max(
            1,
            Math.min(
              input.blueprint.footprint.depth - 1,
              input.blueprint.footprint.depth - 2
            )
          ),
      ],
      value: BUILDING_BLOCKS.interior,
      label: "business_marker",
    });
  }
}

export function createBuildingSystemMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  propertyId?: string;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  includeSafeGround?: boolean;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const { origin, x0, z0, y0, x1, z1, wallTop, roofY, guideConstruction } =
    buildingSystemGeometryBounds(input.plot, input.blueprint, input.origin);
  const edits: BuildingSystemVoxelEditSpec[] = [];
  const inWorldMarkers = createBuildingSystemPhysicalAccessMarkers({
    propertyId: input.propertyId,
    plot: input.plot,
    blueprint: input.blueprint,
    origin,
    activatedAtMs: input.activatedAtMs,
  });

  if (input.includeSafeGround && input.plot.safeAfterPurchase) {
    pushVoxelBox(
      edits,
      [input.plot.bounds.xMin, input.plot.groundY, input.plot.bounds.zMin],
      [input.plot.bounds.xMax, input.plot.groundY + 1, input.plot.bounds.zMax],
      BUILDING_BLOCKS.safeGround,
      "safe_ground"
    );
  }

  if (!buildingSystemUsesSolidShell(input.blueprint)) {
    pushBuildingSystemUtilityBlueprintEdits({
      edits,
      blueprint: input.blueprint,
      x0,
      y0,
      z0,
      x1,
      z1,
      wallTop,
      roofY,
    });
    pushBuildingSystemPhysicalAccessEdits({
      edits,
      blueprint: input.blueprint,
      origin,
    });
    return {
      version: BUILDING_SYSTEM_VERSION,
      requestId: input.requestId,
      actorId: input.actorId,
      plotId: input.plot.plotId,
      blueprintId: input.blueprint.blueprintId,
      structureTypeId: input.blueprint.structureTypeId,
      use: input.blueprint.use,
      origin,
      rotationDegrees: input.rotationDegrees ?? 0,
      edits,
      placeGroup: {
        kind: "placeGroupEvent",
        name: `${input.plot.displayName} ${input.blueprint.displayName}`,
        box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] },
        reason: "building_blueprint_materialized",
      },
      safeZone:
        input.includeSafeGround && input.plot.safeAfterPurchase
          ? {
              plotId: input.plot.plotId,
              actorId: input.actorId,
              area: input.plot.area,
              bounds: input.plot.bounds,
              safeFromMuck: true,
              activatedAtMs: input.activatedAtMs,
            }
          : undefined,
      inWorldMarkers,
      guideConstruction,
      materializesSolidVoxelBuilding: true,
    };
  }

  // Foundation and walkable floor.
  pushVoxelBox(
    edits,
    [x0, y0 - 1, z0],
    [x1, y0, z1],
    BUILDING_BLOCKS.foundation,
    "foundation"
  );
  pushVoxelBox(
    edits,
    [x0, y0, z0],
    [x1, y0 + 1, z1],
    BUILDING_BLOCKS.floor,
    "floor"
  );

  // Solid walls. Leave a two-block door opening centered on the south face.
  pushBuildingWalls({ edits, x0, x1, y0, z0, z1, wallTop });

  // Solid roof players can stand on.
  pushVoxelBox(
    edits,
    [x0, roofY, z0],
    [x1, roofY + 1, z1],
    BUILDING_BLOCKS.roof,
    "roof"
  );

  // Front stair/step into the door if within claimed plot.
  const doorX = Math.floor((x0 + x1) / 2);
  const stairZ = z0 - 1;
  if (
    stairZ >= input.plot.bounds.zMin &&
    doorX >= input.plot.bounds.xMin &&
    doorX < input.plot.bounds.xMax
  ) {
    edits.push({
      kind: "editEvent",
      position: [doorX, y0, stairZ],
      value: BUILDING_BLOCKS.stair,
      label: "stair",
    });
  }
  pushBuildingSystemPhysicalAccessEdits({
    edits,
    blueprint: input.blueprint,
    origin,
  });

  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    origin,
    rotationDegrees: input.rotationDegrees ?? 0,
    edits,
    placeGroup: {
      kind: "placeGroupEvent",
      name: `${input.plot.displayName} ${input.blueprint.displayName}`,
      box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] },
      reason: "building_blueprint_materialized",
    },
    safeZone:
      input.includeSafeGround && input.plot.safeAfterPurchase
        ? {
            plotId: input.plot.plotId,
            actorId: input.actorId,
            area: input.plot.area,
            bounds: input.plot.bounds,
            safeFromMuck: true,
            activatedAtMs: input.activatedAtMs,
          }
        : undefined,
    inWorldMarkers,
    guideConstruction,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemStageMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  projectId: string;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  propertyId?: string;
  stage: BuildingSystemStage;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const { origin, x0, z0, y0, x1, z1, wallTop, roofY, guideConstruction } =
    buildingSystemGeometryBounds(input.plot, input.blueprint, input.origin);
  const edits: BuildingSystemVoxelEditSpec[] = [];
  const stage = input.stage;
  const doorX = Math.floor((x0 + x1) / 2);
  const inWorldMarkers =
    stage === "utility_setup"
      ? createBuildingSystemPhysicalAccessMarkers({
          propertyId: input.propertyId,
          plot: input.plot,
          blueprint: input.blueprint,
          origin,
          activatedAtMs: input.activatedAtMs,
        })
      : undefined;

  if (!buildingSystemUsesSolidShell(input.blueprint)) {
    if (stage === "site_preparation") {
      const markerPlan = createBuildingSystemPlotMarkers({
        actorId: input.actorId,
        plot: input.plot,
        activatedAtMs: input.activatedAtMs,
      });
      edits.push(
        ...markerPlan.edits.filter((edit) => edit.label === "boundary_marker")
      );
    } else {
      pushBuildingSystemUtilityBlueprintEdits({
        edits,
        blueprint: input.blueprint,
        x0,
        y0,
        z0,
        x1,
        z1,
        wallTop,
        roofY,
        stage,
      });
      if (stage === "utility_setup") {
        pushBuildingSystemPhysicalAccessEdits({
          edits,
          blueprint: input.blueprint,
          origin,
        });
      }
    }
    return {
      version: BUILDING_SYSTEM_VERSION,
      requestId: input.requestId,
      actorId: input.actorId,
      plotId: input.plot.plotId,
      blueprintId: input.blueprint.blueprintId,
      structureTypeId: input.blueprint.structureTypeId,
      use: input.blueprint.use,
      projectId: input.projectId,
      stage,
      origin,
      rotationDegrees: input.rotationDegrees ?? 0,
      edits,
      placeGroup: {
        kind: "placeGroupEvent",
        name: `${input.plot.displayName} ${input.blueprint.displayName} ${stage}`,
        box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] },
        reason: "building_blueprint_materialized",
      },
      safeZone: input.plot.safeAfterPurchase
        ? {
            plotId: input.plot.plotId,
            actorId: input.actorId,
            area: input.plot.area,
            bounds: input.plot.bounds,
            safeFromMuck: true,
            activatedAtMs: input.activatedAtMs,
          }
        : undefined,
      inWorldMarkers,
      partialMaterialization: stage !== "utility_setup",
      unlocksStorage: stage === "utility_setup",
      guideConstruction,
      materializesSolidVoxelBuilding: true,
    };
  }

  if (stage === "site_preparation") {
    const markerPlan = createBuildingSystemPlotMarkers({
      actorId: input.actorId,
      plot: input.plot,
      activatedAtMs: input.activatedAtMs,
    });
    edits.push(
      ...markerPlan.edits.filter((edit) => edit.label === "boundary_marker")
    );
  } else if (stage === "foundation") {
    // Foundation and walkable floor appear only after the foundation stage.
    pushVoxelBox(
      edits,
      [x0, y0 - 1, z0],
      [x1, y0, z1],
      BUILDING_BLOCKS.foundation,
      "foundation"
    );
    pushVoxelBox(
      edits,
      [x0, y0, z0],
      [x1, y0 + 1, z1],
      BUILDING_BLOCKS.floor,
      "floor"
    );
  } else if (stage === "frame") {
    // Corners and a simple header prove the frame exists before full walls.
    for (const [px, pz] of [
      [x0, z0],
      [x1 - 1, z0],
      [x0, z1 - 1],
      [x1 - 1, z1 - 1],
    ] as Array<[number, number]>) {
      pushVoxelBox(
        edits,
        [px, y0 + 1, pz],
        [px + 1, wallTop, pz + 1],
        BUILDING_BLOCKS.frame,
        "frame"
      );
    }
    edits.push({
      kind: "editEvent",
      position: [doorX, y0 + 3, z0],
      value: BUILDING_BLOCKS.frame,
      label: "frame",
    });
  } else if (stage === "walls") {
    // Walls appear only after the walls stage.
    pushBuildingWalls({ edits, x0, x1, y0, z0, z1, wallTop });
  } else if (stage === "roof") {
    // A solid standable roof appears only after the roof stage.
    pushVoxelBox(
      edits,
      [x0, roofY, z0],
      [x1, roofY + 1, z1],
      BUILDING_BLOCKS.roof,
      "roof"
    );
  } else if (stage === "interior") {
    // Interior/stairs are visible, but storage/services unlock only when completed.
    const stairZ = z0 - 1;
    if (stairZ >= input.plot.bounds.zMin) {
      edits.push({
        kind: "editEvent",
        position: [doorX, y0, stairZ],
        value: BUILDING_BLOCKS.stair,
        label: "stair",
      });
    }
    edits.push({
      kind: "editEvent",
      position: [x0 + 1, y0 + 1, z0 + 1],
      value: BUILDING_BLOCKS.interior,
      label: "interior",
    });
  } else if (stage === "utility_setup") {
    edits.push({
      kind: "editEvent",
      position: [x0 + 1, y0 + 1, z0],
      value: BUILDING_BLOCKS.deedMarker,
      label: "deed_marker",
    });
    pushBuildingSystemPhysicalAccessEdits({
      edits,
      blueprint: input.blueprint,
      origin,
    });
  }

  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    projectId: input.projectId,
    stage,
    origin,
    rotationDegrees: input.rotationDegrees ?? 0,
    edits,
    placeGroup: {
      kind: "placeGroupEvent",
      name: `${input.plot.displayName} ${input.blueprint.displayName} ${stage}`,
      box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] },
      reason: "building_blueprint_materialized",
    },
    safeZone: input.plot.safeAfterPurchase
      ? {
          plotId: input.plot.plotId,
          actorId: input.actorId,
          area: input.plot.area,
          bounds: input.plot.bounds,
          safeFromMuck: true,
          activatedAtMs: input.activatedAtMs,
        }
      : undefined,
    inWorldMarkers,
    partialMaterialization: stage !== "utility_setup",
    unlocksStorage: stage === "utility_setup",
    guideConstruction,
    materializesSolidVoxelBuilding: true,
  };
}

export function countBuildingSystemVoxelLabels(
  plan: BuildingSystemAnyMaterializationPlan
) {
  return plan.edits.reduce<Record<string, number>>((acc, edit) => {
    acc[edit.label] = (acc[edit.label] ?? 0) + 1;
    return acc;
  }, {});
}

export function createBuildingSystemDefaultPermissions(
  accessMode: BuildingSystemAccessMode = "private"
): BuildingSystemPropertyPermissions {
  const none: BuildingSystemPermissionSet = {
    storage_access: false,
    build_edit: false,
    demolition: false,
    transfer_sale: false,
  };
  return {
    owner: {
      storage_access: true,
      build_edit: true,
      demolition: true,
      transfer_sale: true,
    },
    friends_guests: {
      ...none,
      storage_access: accessMode === "friends",
    },
    guild_members: {
      ...none,
      storage_access: accessMode === "guild",
      build_edit: accessMode === "guild",
    },
    public: {
      ...none,
      storage_access: accessMode === "public",
    },
  };
}

function createBuildingSystemPermissionsForUse(
  use: BuildingSystemPlotUse,
  accessMode: BuildingSystemAccessMode,
  raw?: Partial<BuildingSystemPropertyPermissions>
): BuildingSystemPropertyPermissions {
  const base = createBuildingSystemDefaultPermissions(accessMode);
  const permissions: BuildingSystemPropertyPermissions = {
    owner: { ...base.owner, ...(raw?.owner ?? {}) },
    friends_guests: { ...base.friends_guests, ...(raw?.friends_guests ?? {}) },
    guild_members: { ...base.guild_members, ...(raw?.guild_members ?? {}) },
    public: { ...base.public, ...(raw?.public ?? {}) },
  };

  // A public shopfront should let customers enter, not loot the stockroom.
  if (use === "business") {
    permissions.public.storage_access = false;
    permissions.public.build_edit = false;
    permissions.public.demolition = false;
    permissions.public.transfer_sale = false;
  }
  return permissions;
}

export function createBuildingSystemPropertyRecord(input: {
  propertyId: string;
  ownerId: string;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  nowMs: number;
  guildId?: string;
  value?: number;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
}): BuildingSystemPropertyRecord {
  const businessTaxRate =
    input.blueprint.use === "business" ? Math.max(input.plot.taxRate, 0.08) : 0;
  const guildTaxRate =
    input.blueprint.use === "guild" ? Math.max(input.plot.taxRate, 0.05) : 0;
  const accessMode =
    input.blueprint.use === "business"
      ? "public"
      : input.blueprint.use === "guild"
      ? "guild"
      : "private";
  return {
    propertyId: input.propertyId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    ownerId: input.ownerId,
    origin:
      input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint),
    rotationDegrees: input.rotationDegrees ?? 0,
    status: input.blueprint.use,
    use: input.blueprint.use,
    value: Math.max(
      input.blueprint.goldCost,
      input.value ?? input.blueprint.goldCost
    ),
    tier: 1,
    accessMode,
    permissions: createBuildingSystemPermissionsForUse(
      input.blueprint.use,
      accessMode
    ),
    guestActorIds: [],
    guildId: input.guildId,
    storageSlots: input.blueprint.storageSlots,
    storageItemCount: 0,
    storageContainerId: `storage_${input.propertyId}`,
    doorLockId: `door_${input.propertyId}`,
    businessId:
      input.blueprint.use === "business"
        ? `business_${input.propertyId}`
        : undefined,
    visualDamageApplied: false,
    upgradedVoxelTier: 1,
    condition: 100,
    repairDebtGold: 0,
    lastRepairDecayAtMs: input.nowMs,
    taxRate: input.plot.taxRate,
    businessTaxRate,
    guildTaxRate,
    taxBalanceGold: 0,
    lastTaxAssessedAtMs: input.nowMs,
    abandoned: false,
    listedForSale: false,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

export function normalizeBuildingSystemPropertyRecord(input: {
  propertyId: string;
  raw: unknown;
  ownerId: string;
  nowMs: number;
}): BuildingSystemPropertyRecord {
  const raw =
    typeof input.raw === "object" && input.raw !== null
      ? (input.raw as any)
      : {};
  const plot = buildingSystemPlotById(raw.plotId);
  const blueprint = buildingSystemBlueprintById(raw.blueprintId);
  if (plot && blueprint) {
    const merged = {
      ...createBuildingSystemPropertyRecord({
        propertyId: input.propertyId,
        ownerId: String(raw.ownerId ?? input.ownerId),
        plot,
        blueprint,
        nowMs: input.nowMs,
        value: Number(raw.value ?? blueprint.goldCost),
        guildId: typeof raw.guildId === "string" ? raw.guildId : undefined,
      }),
      ...raw,
      permissions: createBuildingSystemPermissionsForUse(
        blueprint.use,
        raw.accessMode ??
          (blueprint.use === "business"
            ? "public"
            : blueprint.use === "guild"
            ? "guild"
            : "private"),
        raw.permissions
      ),
      storageContainerId:
        typeof raw.storageContainerId === "string"
          ? raw.storageContainerId
          : `storage_${input.propertyId}`,
      doorLockId:
        typeof raw.doorLockId === "string"
          ? raw.doorLockId
          : `door_${input.propertyId}`,
      businessId:
        typeof raw.businessId === "string"
          ? raw.businessId
          : blueprint.use === "business"
          ? `business_${input.propertyId}`
          : undefined,
      visualDamageApplied: Boolean(raw.visualDamageApplied),
      upgradedVoxelTier: Math.max(
        1,
        Number(raw.upgradedVoxelTier ?? raw.tier ?? 1)
      ),
    };
    // `...raw` can overwrite the clamped defaults with hostile/corrupt persisted values
    // (negative value, condition > 100, negative tax balance). Re-clamp the numeric
    // fields that feed repair/refund/tax math, mirroring the fallback branch below.
    merged.condition = Math.max(
      0,
      Math.min(100, Number(merged.condition ?? 100))
    );
    merged.value = Math.max(0, Number(merged.value ?? 0));
    merged.tier = Math.max(1, Number(merged.tier ?? 1));
    merged.repairDebtGold = Math.max(0, Number(merged.repairDebtGold ?? 0));
    merged.taxRate = Math.max(0, Number(merged.taxRate ?? 0));
    merged.businessTaxRate = Math.max(0, Number(merged.businessTaxRate ?? 0));
    merged.guildTaxRate = Math.max(0, Number(merged.guildTaxRate ?? 0));
    merged.taxBalanceGold = Math.max(0, Number(merged.taxBalanceGold ?? 0));
    merged.storageSlots = Math.max(0, Number(merged.storageSlots ?? 0));
    merged.storageItemCount = Math.max(0, Number(merged.storageItemCount ?? 0));
    if (typeof merged.salePriceGold === "number")
      merged.salePriceGold = Math.max(0, merged.salePriceGold);
    return merged;
  }
  // Backward compatibility for the older {status, value} record shape.
  return {
    propertyId: input.propertyId,
    plotId: String(raw.plotId ?? input.propertyId.replace(/^property_/, "")),
    blueprintId: String(raw.blueprintId ?? "unknown_blueprint"),
    ownerId: String(raw.ownerId ?? input.ownerId),
    status: raw.status ?? "owned",
    use: raw.use ?? raw.status ?? "home",
    value: Math.max(0, Number(raw.value ?? 0)),
    tier: Math.max(1, Number(raw.tier ?? 1)),
    accessMode: raw.accessMode ?? "private",
    permissions: createBuildingSystemPermissionsForUse(
      raw.use ?? raw.status ?? "home",
      raw.accessMode ?? "private",
      raw.permissions
    ),
    guestActorIds: Array.isArray(raw.guestActorIds) ? raw.guestActorIds : [],
    guildId: typeof raw.guildId === "string" ? raw.guildId : undefined,
    storageSlots: Math.max(0, Number(raw.storageSlots ?? 0)),
    storageItemCount: Math.max(0, Number(raw.storageItemCount ?? 0)),
    storageContainerId:
      typeof raw.storageContainerId === "string"
        ? raw.storageContainerId
        : undefined,
    doorLockId: typeof raw.doorLockId === "string" ? raw.doorLockId : undefined,
    businessId: typeof raw.businessId === "string" ? raw.businessId : undefined,
    visualDamageApplied: Boolean(raw.visualDamageApplied),
    upgradedVoxelTier: Math.max(
      1,
      Number(raw.upgradedVoxelTier ?? raw.tier ?? 1)
    ),
    condition: Math.max(0, Math.min(100, Number(raw.condition ?? 100))),
    repairDebtGold: Math.max(0, Number(raw.repairDebtGold ?? 0)),
    lastRepairDecayAtMs: Number(raw.lastRepairDecayAtMs ?? input.nowMs),
    taxRate: Math.max(0, Number(raw.taxRate ?? 0)),
    businessTaxRate: Math.max(0, Number(raw.businessTaxRate ?? 0)),
    guildTaxRate: Math.max(0, Number(raw.guildTaxRate ?? 0)),
    taxBalanceGold: Math.max(0, Number(raw.taxBalanceGold ?? 0)),
    lastTaxAssessedAtMs: Number(raw.lastTaxAssessedAtMs ?? input.nowMs),
    unpaidTaxSinceMs:
      typeof raw.unpaidTaxSinceMs === "number"
        ? raw.unpaidTaxSinceMs
        : undefined,
    abandoned: Boolean(raw.abandoned),
    abandonedAtMs:
      typeof raw.abandonedAtMs === "number" ? raw.abandonedAtMs : undefined,
    listedForSale: Boolean(raw.listedForSale),
    salePriceGold:
      typeof raw.salePriceGold === "number" ? raw.salePriceGold : undefined,
    createdAtMs: Number(raw.createdAtMs ?? input.nowMs),
    updatedAtMs: Number(raw.updatedAtMs ?? input.nowMs),
  };
}

export function buildingSystemPropertyTaxRate(
  property: Pick<
    BuildingSystemPropertyRecord,
    "use" | "taxRate" | "businessTaxRate" | "guildTaxRate"
  >
) {
  if (property.use === "business") {
    return Math.max(property.taxRate, property.businessTaxRate);
  }
  if (property.use === "guild") {
    return Math.max(property.taxRate, property.guildTaxRate);
  }
  return property.taxRate;
}

export function applyBuildingSystemPropertyLifecycle(input: {
  property: BuildingSystemPropertyRecord;
  nowMs: number;
}): BuildingSystemPropertyLifecycleResult {
  const property: BuildingSystemPropertyRecord = { ...input.property };
  const warnings: string[] = [];
  const elapsedTaxPeriods = Math.max(
    0,
    Math.floor(
      (input.nowMs - property.lastTaxAssessedAtMs) /
        BUILDING_SYSTEM_TAX_PERIOD_MS
    )
  );
  const taxDeltaGold =
    elapsedTaxPeriods > 0
      ? Math.max(
          1,
          Math.floor(
            property.value *
              buildingSystemPropertyTaxRate(property) *
              elapsedTaxPeriods
          )
        )
      : 0;
  if (taxDeltaGold > 0) {
    const firstUnpaidDueAtMs =
      property.lastTaxAssessedAtMs + BUILDING_SYSTEM_TAX_PERIOD_MS;
    property.taxBalanceGold += taxDeltaGold;
    property.lastTaxAssessedAtMs +=
      elapsedTaxPeriods * BUILDING_SYSTEM_TAX_PERIOD_MS;
    if (!property.unpaidTaxSinceMs) {
      property.unpaidTaxSinceMs = firstUnpaidDueAtMs;
    }
  }

  const elapsedRepairDays = Math.max(
    0,
    Math.floor(
      (input.nowMs - property.lastRepairDecayAtMs) /
        BUILDING_SYSTEM_TAX_PERIOD_MS
    )
  );
  const repairDecayDelta =
    elapsedRepairDays > 0
      ? Math.min(
          property.condition,
          elapsedRepairDays * BUILDING_SYSTEM_REPAIR_DECAY_PER_DAY
        )
      : 0;
  if (repairDecayDelta > 0) {
    property.condition = Math.max(0, property.condition - repairDecayDelta);
    property.repairDebtGold += repairDecayDelta;
    property.lastRepairDecayAtMs +=
      elapsedRepairDays * BUILDING_SYSTEM_TAX_PERIOD_MS;
  }

  if (
    property.taxBalanceGold > 0 &&
    property.unpaidTaxSinceMs &&
    input.nowMs - property.unpaidTaxSinceMs >=
      BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS
  ) {
    property.abandoned = true;
    property.abandonedAtMs = property.abandonedAtMs ?? input.nowMs;
    property.status = "abandoned";
    warnings.push("property_marked_abandoned:unpaid_taxes");
  }
  property.updatedAtMs = input.nowMs;
  return { property, taxDeltaGold, repairDecayDelta, warnings };
}

export function buildingSystemCanActorAccessProperty(input: {
  property: BuildingSystemPropertyRecord;
  actorId: string;
  permission: BuildingSystemPermissionKey;
  guildId?: string;
}) {
  const { property, actorId, permission, guildId } = input;
  if (actorId === property.ownerId)
    return property.permissions.owner[permission];
  if (property.guestActorIds.includes(actorId)) {
    return property.permissions.friends_guests[permission];
  }
  if (guildId && property.guildId && guildId === property.guildId) {
    return property.permissions.guild_members[permission];
  }
  if (property.accessMode === "public") {
    return property.permissions.public[permission];
  }
  return false;
}

export function buildingSystemUpgradeCostGold(
  property: BuildingSystemPropertyRecord
) {
  return Math.max(25, Math.floor(property.value * 0.75 * property.tier));
}

export function buildingSystemRepairCostGold(
  property: BuildingSystemPropertyRecord
) {
  return Math.max(
    0,
    Math.ceil((100 - property.condition) * Math.max(1, property.tier))
  );
}

export function buildingSystemDemolitionRefundGold(
  property: BuildingSystemPropertyRecord
) {
  if (property.abandoned || property.condition <= 25) {
    return Math.floor(
      property.value * BUILDING_SYSTEM_MIN_DEMOLITION_REFUND_RATE
    );
  }
  return Math.floor(
    property.value * BUILDING_SYSTEM_STANDARD_DEMOLITION_REFUND_RATE
  );
}

export const BUILDING_SYSTEM_BUSINESS_TYPES: readonly BuildingSystemBusinessTypeDefinition[] =
  [
    {
      businessType: "exotic_matter_refinery",
      displayName: "Exotic Matter Refinery",
      category: "Industrial / Infrastructure",
      startingCostGold: 1200,
      materialNeed: "heavy",
      mainProductOrService:
        "Stabilized Exotic Matter, portal fuel, Biome anchor cores",
      recurringDemand: [
        "raw material restock",
        "machine maintenance",
        "town fuel orders",
      ],
      connectedBusinesses: [
        "portal_transit_company",
        "teleport_owner",
        "biome_maintenance_repair",
      ],
      baseRevenuePerCycleGold: 180,
      upkeepPerCycleGold: 55,
      licenseLevelRequired: 4,
      serviceRadius: 32,
    },
    {
      businessType: "biome_maintenance_repair",
      displayName: "Biome Maintenance & Repair Company",
      category: "Technical Service",
      startingCostGold: 700,
      materialNeed: "medium",
      mainProductOrService: "Inspections, emergency repairs, climate tuning",
      recurringDemand: [
        "property decay",
        "weather failure",
        "maintenance subscriptions",
      ],
      connectedBusinesses: [
        "exotic_matter_refinery",
        "custom_home_property_development",
        "repair_maintenance_person",
      ],
      baseRevenuePerCycleGold: 105,
      upkeepPerCycleGold: 28,
      licenseLevelRequired: 2,
      serviceRadius: 18,
    },
    {
      businessType: "biome_design_studio",
      displayName: "Biome Design Studio",
      category: "Creative / Property Service",
      startingCostGold: 500,
      materialNeed: "medium",
      mainProductOrService:
        "Decoration packs, terrain templates, custom sky/weather themes",
      recurringDemand: [
        "seasonal trends",
        "festival commissions",
        "property value upgrades",
      ],
      connectedBusinesses: [
        "custom_home_property_development",
        "hospitality_inn_hotel_shelter",
        "food_service_restaurant",
      ],
      baseRevenuePerCycleGold: 75,
      upkeepPerCycleGold: 18,
      licenseLevelRequired: 1,
      serviceRadius: 14,
    },
    {
      businessType: "security_defense_contractor",
      displayName: "Security & Defense Contractor",
      category: "Protection / Combat Service",
      startingCostGold: 600,
      materialNeed: "medium",
      mainProductOrService: "Guard duty, monster removal, bounty hunting",
      recurringDemand: [
        "threat migration",
        "guard contracts",
        "gear replacement",
      ],
      connectedBusinesses: [
        "weapons_tools",
        "portal_transit_company",
        "biome_farming_rare_foods",
      ],
      baseRevenuePerCycleGold: 95,
      upkeepPerCycleGold: 30,
      licenseLevelRequired: 2,
      serviceRadius: 20,
    },
    {
      businessType: "portal_transit_company",
      displayName: "Portal Transit Company",
      category: "Infrastructure / Transportation",
      startingCostGold: 5000,
      materialNeed: "heavy",
      mainProductOrService: "Public travel, cargo routes, private gates",
      recurringDemand: [
        "portal fuel",
        "route stabilization",
        "cargo contracts",
      ],
      connectedBusinesses: [
        "exotic_matter_refinery",
        "courier",
        "security_defense_contractor",
      ],
      baseRevenuePerCycleGold: 540,
      upkeepPerCycleGold: 160,
      licenseLevelRequired: 5,
      serviceRadius: 64,
    },
    {
      businessType: "biome_farming_rare_foods",
      displayName: "Biome Farming & Rare Foods",
      category: "Agriculture / Food Supply",
      startingCostGold: 300,
      materialNeed: "heavy",
      mainProductOrService: "Crops, rare fruits, herbs",
      recurringDemand: [
        "crop cycles",
        "restaurant orders",
        "medicine ingredients",
      ],
      connectedBusinesses: [
        "food_service_restaurant",
        "medical_doctor",
        "general_trader",
      ],
      baseRevenuePerCycleGold: 48,
      upkeepPerCycleGold: 12,
      licenseLevelRequired: 1,
      serviceRadius: 12,
    },
    {
      businessType: "weapons_tools",
      displayName: "Weapons & Tools",
      category: "Crafting / Equipment",
      startingCostGold: 500,
      materialNeed: "heavy",
      mainProductOrService: "Swords, bows, spears, tools",
      recurringDemand: [
        "tool durability",
        "weapon upgrades",
        "bulk guard orders",
      ],
      connectedBusinesses: [
        "security_defense_contractor",
        "hunter_wild_meat",
        "custom_home_property_development",
      ],
      baseRevenuePerCycleGold: 80,
      upkeepPerCycleGold: 24,
      licenseLevelRequired: 2,
      serviceRadius: 14,
    },
    {
      businessType: "magic_goods",
      displayName: "Magic Goods",
      category: "Exotic / Consumable Crafting",
      startingCostGold: 800,
      materialNeed: "rare",
      mainProductOrService: "Charms, potions, protective wards",
      recurringDemand: [
        "expiring unstable goods",
        "disaster demand",
        "rare component requests",
      ],
      connectedBusinesses: [
        "exotic_matter_refinery",
        "medical_doctor",
        "exploration_guide",
      ],
      baseRevenuePerCycleGold: 120,
      upkeepPerCycleGold: 38,
      licenseLevelRequired: 3,
      serviceRadius: 16,
    },
    {
      businessType: "exploration_guide",
      displayName: "Exploration Guide",
      category: "Knowledge / Travel Service",
      startingCostGold: 400,
      materialNeed: "light",
      mainProductOrService:
        "Guided expeditions, ruin tours, rare resource routes",
      recurringDemand: [
        "shifting maps",
        "client expeditions",
        "dangerous routes",
      ],
      connectedBusinesses: [
        "courier",
        "security_defense_contractor",
        "magic_goods",
      ],
      baseRevenuePerCycleGold: 62,
      upkeepPerCycleGold: 16,
      licenseLevelRequired: 1,
      serviceRadius: 26,
    },
    {
      businessType: "custom_home_property_development",
      displayName: "Custom Home & Property Development",
      category: "Construction / Real Estate",
      startingCostGold: 1000,
      materialNeed: "heavy",
      mainProductOrService: "Houses, shops, apartments, guild halls",
      recurringDemand: ["staged construction", "tenants", "repairs and taxes"],
      connectedBusinesses: [
        "biome_design_studio",
        "biome_maintenance_repair",
        "waste_sanitation_cleanup",
      ],
      baseRevenuePerCycleGold: 150,
      upkeepPerCycleGold: 45,
      licenseLevelRequired: 3,
      serviceRadius: 18,
    },
    {
      businessType: "general_trader",
      displayName: "General Trader",
      category: "Retail / Brokerage",
      startingCostGold: 300,
      materialNeed: "medium",
      mainProductOrService: "Basic tools, food, seeds",
      recurringDemand: [
        "regional price changes",
        "stock turnover",
        "customer requests",
      ],
      connectedBusinesses: [
        "courier",
        "biome_farming_rare_foods",
        "weapons_tools",
      ],
      baseRevenuePerCycleGold: 55,
      upkeepPerCycleGold: 14,
      licenseLevelRequired: 1,
      serviceRadius: 12,
    },
    {
      businessType: "hunter_wild_meat",
      displayName: "Hunter for Wild Meat",
      category: "Food / Wildlife Control",
      startingCostGold: 300,
      materialNeed: "medium",
      mainProductOrService: "Wild meat, rare cuts, hides",
      recurringDemand: [
        "animal migration",
        "meat spoilage",
        "restaurant supply",
      ],
      connectedBusinesses: [
        "food_service_restaurant",
        "general_trader",
        "weapons_tools",
      ],
      baseRevenuePerCycleGold: 58,
      upkeepPerCycleGold: 18,
      licenseLevelRequired: 1,
      serviceRadius: 18,
    },
    {
      businessType: "medical_doctor",
      displayName: "Medical / Doctor",
      category: "Healthcare / Public Service",
      startingCostGold: 500,
      materialNeed: "medium",
      mainProductOrService: "Injury treatment, disease treatment, surgery",
      recurringDemand: ["patients", "medicine stock", "outbreaks"],
      connectedBusinesses: [
        "biome_farming_rare_foods",
        "magic_goods",
        "courier",
      ],
      baseRevenuePerCycleGold: 82,
      upkeepPerCycleGold: 26,
      licenseLevelRequired: 2,
      serviceRadius: 14,
    },
    {
      businessType: "teleport_owner",
      displayName: "Teleport Owner",
      category: "Local Transportation / Access Control",
      startingCostGold: 2500,
      materialNeed: "heavy",
      mainProductOrService:
        "Pay-per-use teleport, private access, emergency return",
      recurringDemand: ["fuel", "link maintenance", "access tokens"],
      connectedBusinesses: [
        "exotic_matter_refinery",
        "portal_transit_company",
        "courier",
      ],
      baseRevenuePerCycleGold: 280,
      upkeepPerCycleGold: 88,
      licenseLevelRequired: 4,
      serviceRadius: 32,
    },
    {
      businessType: "waste_sanitation_cleanup",
      displayName: "Waste, Sanitation & Contamination Cleanup",
      category: "Public Health / Hazard Service",
      startingCostGold: 400,
      materialNeed: "medium",
      mainProductOrService:
        "Trash pickup, recycling, composting, contamination cleanup",
      recurringDemand: [
        "waste accumulation",
        "dirty business penalties",
        "hazard cleanup",
      ],
      connectedBusinesses: [
        "food_service_restaurant",
        "medical_doctor",
        "custom_home_property_development",
      ],
      baseRevenuePerCycleGold: 66,
      upkeepPerCycleGold: 20,
      licenseLevelRequired: 1,
      serviceRadius: 14,
    },
    {
      businessType: "repair_maintenance_person",
      displayName: "Repair People / Maintenance Person",
      category: "Everyday Repair / Facilities",
      startingCostGold: 250,
      materialNeed: "light",
      mainProductOrService: "Item repair, tool repair, furniture repair",
      recurringDemand: ["object decay", "urgent repairs", "service contracts"],
      connectedBusinesses: [
        "weapons_tools",
        "biome_maintenance_repair",
        "hospitality_inn_hotel_shelter",
      ],
      baseRevenuePerCycleGold: 45,
      upkeepPerCycleGold: 10,
      licenseLevelRequired: 1,
      serviceRadius: 10,
    },
    {
      businessType: "food_service_restaurant",
      displayName: "Food Service / Restaurant / Cook",
      category: "Food / Hospitality / Buffs",
      startingCostGold: 250,
      materialNeed: "heavy",
      mainProductOrService: "Meals, worker buff food, healing soups",
      recurringDemand: [
        "ingredient spoilage",
        "daily customers",
        "festival rushes",
      ],
      connectedBusinesses: [
        "biome_farming_rare_foods",
        "hunter_wild_meat",
        "waste_sanitation_cleanup",
      ],
      baseRevenuePerCycleGold: 52,
      upkeepPerCycleGold: 18,
      licenseLevelRequired: 1,
      serviceRadius: 10,
    },
    {
      businessType: "courier",
      displayName: "Courier",
      category: "Logistics / Trust Service",
      startingCostGold: 150,
      materialNeed: "light",
      mainProductOrService: "Mail, package, medicine, and food delivery",
      recurringDemand: [
        "delivery board refresh",
        "timed jobs",
        "business supply runs",
      ],
      connectedBusinesses: [
        "general_trader",
        "medical_doctor",
        "portal_transit_company",
      ],
      baseRevenuePerCycleGold: 35,
      upkeepPerCycleGold: 8,
      licenseLevelRequired: 1,
      serviceRadius: 22,
    },
    {
      businessType: "hospitality_inn_hotel_shelter",
      displayName: "Hospitality / Inn / Hotel / Shelter",
      category: "Housing / Tourism / Emergency Relief",
      startingCostGold: 700,
      materialNeed: "heavy",
      mainProductOrService: "Room rentals, shelter beds, meals",
      recurringDemand: ["occupancy", "cleaning", "guest food and safety"],
      connectedBusinesses: [
        "food_service_restaurant",
        "waste_sanitation_cleanup",
        "security_defense_contractor",
      ],
      baseRevenuePerCycleGold: 100,
      upkeepPerCycleGold: 34,
      licenseLevelRequired: 2,
      serviceRadius: 12,
    },
  ] as const;

export function buildingSystemBusinessTypeById(type: string | undefined) {
  return BUILDING_SYSTEM_BUSINESS_TYPES.find(
    (entry) => entry.businessType === type
  );
}

export function createBuildingSystemMiraMapMarker(
  nowMs: number
): BuildingSystemInWorldMarker {
  return {
    markerId: "mira_grove_land_steward_map_marker",
    plotId: "the_grove",
    kind: "npc_map_marker",
    position: BUILDING_SYSTEM_GROVE_STEWARD_NPC.position,
    label: "Mira Thatch - Building System",
    createdAtMs: nowMs,
  };
}

export function createBuildingSystemStorageContainer(input: {
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  nowMs: number;
}): BuildingSystemStorageContainerRecord {
  const origin =
    input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint);
  return {
    containerId:
      input.property.storageContainerId ??
      `storage_${input.property.propertyId}`,
    propertyId: input.property.propertyId,
    plotId: input.plot.plotId,
    ownerId: input.property.ownerId,
    position: [origin.x + 1, origin.y + 1, origin.z + 1],
    slots: input.property.storageSlots,
    itemCount: input.property.storageItemCount,
    accessMode: input.property.accessMode,
    allowedActorIds: [input.property.ownerId, ...input.property.guestActorIds],
    guildId: input.property.guildId,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

export function createBuildingSystemDoorLock(input: {
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  nowMs: number;
}): BuildingSystemDoorLockRecord {
  const origin =
    input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint);
  return {
    lockId: input.property.doorLockId ?? `door_${input.property.propertyId}`,
    propertyId: input.property.propertyId,
    plotId: input.plot.plotId,
    ownerId: input.property.ownerId,
    position: [
      origin.x + Math.floor(input.blueprint.footprint.width / 2),
      origin.y + 1,
      origin.z,
    ],
    accessMode: input.property.accessMode,
    locked: input.property.accessMode !== "public",
    guildId: input.property.guildId,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

export function buildingSystemHomeConsoleMarkerId(propertyId: string) {
  return `home_console_${propertyId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function createBuildingSystemHomeConsoleMarker(input: {
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  nowMs: number;
}): BuildingSystemInWorldMarker {
  const origin =
    input.origin ?? buildingSystemDefaultOrigin(input.plot, input.blueprint);
  return {
    markerId: buildingSystemHomeConsoleMarkerId(input.property.propertyId),
    plotId: input.plot.plotId,
    kind: "home_console",
    position: buildingSystemHomeConsolePosition({
      blueprint: input.blueprint,
      origin,
    }),
    label: "Home Console",
    createdAtMs: input.nowMs,
  };
}

export function buildingSystemCanUseStorageContainer(input: {
  property: BuildingSystemPropertyRecord;
  container: BuildingSystemStorageContainerRecord;
  actorId: string;
  guildId?: string;
}) {
  return buildingSystemCanActorAccessProperty({
    property: input.property,
    actorId: input.actorId,
    guildId: input.guildId,
    permission: "storage_access",
  });
}

export function buildingSystemCanOpenDoorLock(input: {
  property: BuildingSystemPropertyRecord;
  lock: BuildingSystemDoorLockRecord;
  actorId: string;
  guildId?: string;
}) {
  if (!input.lock.locked || input.property.accessMode === "public") {
    return true;
  }
  return (
    buildingSystemCanActorAccessProperty({
      property: input.property,
      actorId: input.actorId,
      guildId: input.guildId,
      permission: "storage_access",
    }) ||
    buildingSystemCanActorAccessProperty({
      property: input.property,
      actorId: input.actorId,
      guildId: input.guildId,
      permission: "build_edit",
    })
  );
}

function replaceVoxelEdits(
  edits: BuildingSystemVoxelEditSpec[],
  value: BiomesId,
  label: BuildingSystemVoxelEditSpec["label"]
): BuildingSystemVoxelEditSpec[] {
  return edits.map((edit) => ({
    ...edit,
    expectedValue: edit.value,
    value,
    label,
  }));
}

export function createBuildingSystemDemolitionMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const full = createBuildingSystemMaterializationPlan({
    requestId: input.requestId,
    actorId: input.actorId,
    plot: input.plot,
    blueprint: input.blueprint,
    propertyId: input.property.propertyId,
    activatedAtMs: input.activatedAtMs,
  });
  const markerDeletes = createBuildingSystemPlotMarkers({
    actorId: input.actorId,
    plot: input.plot,
    activatedAtMs: input.activatedAtMs,
  }).edits.filter(
    (edit) => edit.label === "deed_marker" || edit.label === "map_marker"
  );
  return {
    ...full,
    requestId: input.requestId,
    edits: replaceVoxelEdits(
      [...full.edits, ...markerDeletes],
      BUILDING_BLOCKS.air,
      "demolition_cleanup"
    ),
    inWorldMarkers: [],
    partialMaterialization: false,
    unlocksStorage: false,
  };
}

export function createBuildingSystemRepairDamageMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const { origin, x0, z0, y0, x1, z1, roofY, guideConstruction } =
    buildingSystemGeometryBounds(input.plot, input.blueprint);
  const edits: BuildingSystemVoxelEditSpec[] = [];
  edits.push({
    kind: "editEvent",
    position: [x0, y0 + 1, z0],
    value: BUILDING_BLOCKS.air,
    expectedValue: BUILDING_BLOCKS.wall,
    label: "repair_damage",
  });
  edits.push({
    kind: "editEvent",
    position: [x1 - 1, y0 + 1, z1 - 1],
    value: BUILDING_BLOCKS.air,
    expectedValue: BUILDING_BLOCKS.wall,
    label: "repair_damage",
  });
  edits.push({
    kind: "editEvent",
    position: [x0 + 1, roofY, z0 + 1],
    value: BUILDING_BLOCKS.air,
    expectedValue: BUILDING_BLOCKS.roof,
    label: "repair_damage",
  });
  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    origin,
    rotationDegrees: 0,
    edits,
    placeGroup: {
      kind: "placeGroupEvent",
      name: `${input.property.propertyId} visible damage`,
      box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] },
      reason: "building_blueprint_materialized",
    },
    partialMaterialization: true,
    guideConstruction,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemRepairRestoreMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const full = createBuildingSystemMaterializationPlan({
    requestId: input.requestId,
    actorId: input.actorId,
    plot: input.plot,
    blueprint: input.blueprint,
    propertyId: input.property.propertyId,
    activatedAtMs: input.activatedAtMs,
  });
  return {
    ...full,
    edits: full.edits
      .filter((edit) => edit.label === "wall" || edit.label === "roof")
      .slice(0, 12)
      .map((edit) => ({ ...edit, label: "repair_restore" as const })),
    inWorldMarkers: [],
    partialMaterialization: true,
  };
}

export function createBuildingSystemUpgradeMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecord;
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlan {
  const { origin, x0, z0, y0, x1, z1, roofY, guideConstruction } =
    buildingSystemGeometryBounds(input.plot, input.blueprint);
  const edits: BuildingSystemVoxelEditSpec[] = [];
  const secondFloorY = roofY + 1;
  pushVoxelBox(
    edits,
    [x0, secondFloorY, z0],
    [x1, secondFloorY + 1, z1],
    BUILDING_BLOCKS.upgradeWall,
    "upgrade_addition"
  );
  pushVoxelBox(
    edits,
    [x0, secondFloorY + 1, z0],
    [x1, secondFloorY + 3, z0 + 1],
    BUILDING_BLOCKS.wall,
    "upgrade_addition"
  );
  pushVoxelBox(
    edits,
    [x0, secondFloorY + 3, z0],
    [x1, secondFloorY + 4, z1],
    BUILDING_BLOCKS.roof,
    "upgrade_addition"
  );
  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    origin,
    rotationDegrees: 0,
    edits,
    placeGroup: {
      kind: "placeGroupEvent",
      name: `${input.property.propertyId} tier upgrade`,
      box: { v0: [x0, y0 - 1, z0], v1: [x1, secondFloorY + 4, z1] },
      reason: "building_blueprint_materialized",
    },
    partialMaterialization: true,
    guideConstruction,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemPlacementPreview(input: {
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  owned: boolean;
}): BuildingSystemPlacementPreview {
  const { origin, x0, y0, z0, x1, z1, guideConstruction } =
    buildingSystemGeometryBounds(input.plot, input.blueprint, input.origin);
  const ghostFootprint: Array<[number, number, number]> = [];
  for (let x = x0; x < x1; x++) {
    ghostFootprint.push([x, y0, z0], [x, y0, z1 - 1]);
  }
  for (let z = z0 + 1; z < z1 - 1; z++) {
    ghostFootprint.push([x0, y0, z], [x1 - 1, y0, z]);
  }
  const warnings: string[] = [];
  if (!input.owned) warnings.push("preview_warning:plot_not_owned");
  if (
    x0 < input.plot.bounds.xMin ||
    x1 > input.plot.bounds.xMax ||
    z0 < input.plot.bounds.zMin ||
    z1 > input.plot.bounds.zMax
  ) {
    warnings.push("preview_warning:footprint_outside_plot");
  }
  if (
    guideConstruction.coveredAreaFraction > input.plot.maxCoveredAreaFraction
  ) {
    warnings.push("preview_warning:coverage_exceeds_plot_limit");
  }
  if (!guideConstruction.groundedToPlot) {
    warnings.push("preview_warning:floor_not_one_voxel_above_ground");
  }
  if (
    guideConstruction.usesSolidVoxelShell &&
    !guideConstruction.stairInsidePlot
  ) {
    warnings.push("preview_warning:doorsill_stair_outside_plot");
  }
  return {
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    origin,
    rotationDegrees: input.rotationDegrees ?? 0,
    boundaryOverlay: input.plot.bounds,
    ghostFootprint,
    guideConstruction,
    requiredMaterials: BUILDING_SYSTEM_CONSTRUCTION_STAGES.flatMap((stage) =>
      buildingSystemMaterialRequirementLines({
        blueprint: input.blueprint,
        stage,
      })
    ),
    valid: warnings.length === 0,
    warnings,
  };
}

export interface BuildingSystemGuideConstructionReadinessResult {
  ok: boolean;
  checkedBlueprints: number;
  errors: string[];
  warnings: string[];
}

function buildingSystemEditPositionKey(edit: BuildingSystemVoxelEditSpec) {
  return edit.position.join(",");
}

export function validateBuildingSystemGuideConstructionReadiness(
  input: {
    plots?: readonly BuildingSystemPlotDefinition[];
    blueprints?: readonly BuildingSystemBlueprintDefinition[];
    actorId?: string;
    nowMs?: number;
  } = {}
): BuildingSystemGuideConstructionReadinessResult {
  const plots = input.plots ?? BUILDING_SYSTEM_PLOTS;
  const blueprints = input.blueprints ?? BUILDING_SYSTEM_BLUEPRINTS;
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedBlueprints = 0;
  for (const plot of plots) {
    for (const blueprintId of plot.allowedBlueprintIds) {
      const blueprint = blueprints.find(
        (candidate) => candidate.blueprintId === blueprintId
      );
      if (!blueprint) {
        errors.push(`${plot.plotId}:${blueprintId}:missing_blueprint`);
        continue;
      }
      checkedBlueprints += 1;
      const guide = createBuildingSystemGuideConstructionMath({
        plot,
        blueprint,
      });
      warnings.push(
        ...guide.warnings.map(
          (warning) => `${plot.plotId}:${blueprint.blueprintId}:${warning}`
        )
      );
      const preview = createBuildingSystemPlacementPreview({
        plot,
        blueprint,
        owned: true,
      });
      if (JSON.stringify(preview.origin) !== JSON.stringify(guide.origin)) {
        errors.push(
          `${plot.plotId}:${blueprint.blueprintId}:preview_origin_drift`
        );
      }
      if (
        preview.guideConstruction.version !==
        BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION
      ) {
        errors.push(
          `${plot.plotId}:${blueprint.blueprintId}:preview_missing_guide_math`
        );
      }
      const plan = createBuildingSystemMaterializationPlan({
        requestId: `guide_readiness_${plot.plotId}_${blueprint.blueprintId}`,
        actorId: input.actorId ?? "guide_readiness",
        propertyId: `property_${plot.plotId}`,
        plot,
        blueprint,
        activatedAtMs: input.nowMs ?? 0,
      });
      if (
        plan.guideConstruction.version !==
        BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION
      ) {
        errors.push(
          `${plot.plotId}:${blueprint.blueprintId}:plan_missing_guide_math`
        );
      }
      if (JSON.stringify(plan.origin) !== JSON.stringify(guide.origin)) {
        errors.push(
          `${plot.plotId}:${blueprint.blueprintId}:plan_origin_drift`
        );
      }
      if (
        plan.placeGroup.box.v0[0] !== guide.x0 ||
        plan.placeGroup.box.v0[1] !== guide.foundationY ||
        plan.placeGroup.box.v0[2] !== guide.z0
      ) {
        errors.push(
          `${plot.plotId}:${blueprint.blueprintId}:place_group_min_drift`
        );
      }
      if (buildingSystemUsesSolidShell(blueprint)) {
        const labels = countBuildingSystemVoxelLabels(plan);
        for (const label of [
          "foundation",
          "floor",
          "wall",
          "roof",
          "stair",
        ] as const) {
          if ((labels[label] ?? 0) <= 0) {
            errors.push(
              `${plot.plotId}:${blueprint.blueprintId}:missing_${label}_edits`
            );
          }
        }
        const hasDoorWall = plan.edits.some(
          (edit) =>
            edit.label === "wall" &&
            edit.position[0] === guide.doorX &&
            edit.position[2] === guide.z0 &&
            (edit.position[1] === guide.doorYMin ||
              edit.position[1] === guide.doorYMax)
        );
        if (hasDoorWall) {
          errors.push(
            `${plot.plotId}:${blueprint.blueprintId}:doorway_void_blocked`
          );
        }
        const hasGuideStair = plan.edits.some(
          (edit) =>
            edit.label === "stair" &&
            edit.position[0] === guide.stairPosition[0] &&
            edit.position[1] === guide.stairPosition[1] &&
            edit.position[2] === guide.stairPosition[2]
        );
        if (!hasGuideStair) {
          errors.push(
            `${plot.plotId}:${blueprint.blueprintId}:doorsill_stair_missing`
          );
        }
      }
      const demolition = createBuildingSystemDemolitionMaterializationPlan({
        requestId: `guide_demolition_${plot.plotId}_${blueprint.blueprintId}`,
        actorId: input.actorId ?? "guide_readiness",
        property: createBuildingSystemPropertyRecord({
          propertyId: `property_${plot.plotId}`,
          ownerId: input.actorId ?? "guide_readiness",
          plot,
          blueprint,
          nowMs: input.nowMs ?? 0,
        }),
        plot,
        blueprint,
        activatedAtMs: input.nowMs ?? 0,
      });
      const demolitionPositions = new Set(
        demolition.edits.map(buildingSystemEditPositionKey)
      );
      for (const edit of plan.edits) {
        if (!demolitionPositions.has(buildingSystemEditPositionKey(edit))) {
          errors.push(
            `${plot.plotId}:${
              blueprint.blueprintId
            }:demolition_misses_${buildingSystemEditPositionKey(edit)}`
          );
          break;
        }
      }
    }
  }
  return {
    ok: errors.length === 0,
    checkedBlueprints,
    errors,
    warnings,
  };
}

export function createBuildingSystemBusinessRecord(input: {
  businessId: string;
  ownerId: string;
  propertyId: string;
  businessType: BuildingSystemBusinessType;
  nowMs: number;
}): BuildingSystemBusinessRecord {
  const def = buildingSystemBusinessTypeById(input.businessType);
  if (!def) {
    throw new Error(`Unknown business type: ${input.businessType}`);
  }
  return {
    businessId: input.businessId,
    ownerId: input.ownerId,
    type: input.businessType,
    licenseLevel: def.licenseLevelRequired,
    propertyId: input.propertyId,
    inventory: {},
    employees: [],
    activeContracts: [],
    reputation: 0,
    upkeepCost: def.upkeepPerCycleGold,
    serviceRadius: def.serviceRadius,
    customerSatisfaction: 50,
    revenueBalanceGold: 0,
    lifetimeRevenueGold: 0,
    taxBalanceGold: 0,
    lastRevenueCycleAtMs: input.nowMs,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

export function runBuildingSystemBusinessRevenueCycle(input: {
  business: BuildingSystemBusinessRecord;
  nowMs: number;
  cycles?: number;
}) {
  const def = buildingSystemBusinessTypeById(input.business.type);
  const business = { ...input.business };
  const cycles = Math.max(1, Math.trunc(input.cycles ?? 1));
  const satisfactionMultiplier = Math.max(
    0.35,
    Math.min(1.75, business.customerSatisfaction / 50)
  );
  const reputationMultiplier = Math.max(
    0.5,
    Math.min(2, 1 + business.reputation / 100)
  );
  const gross = Math.floor(
    (def?.baseRevenuePerCycleGold ?? 25) *
      cycles *
      satisfactionMultiplier *
      reputationMultiplier
  );
  const upkeep = Math.floor(business.upkeepCost * cycles);
  const net = Math.max(0, gross - upkeep);
  const tax = Math.floor(net * 0.08);
  business.revenueBalanceGold += Math.max(0, net - tax);
  business.lifetimeRevenueGold += net;
  business.taxBalanceGold += tax;
  business.lastRevenueCycleAtMs = input.nowMs;
  business.updatedAtMs = input.nowMs;
  return { business, gross, upkeep, net, tax };
}

ensureBuildingSystemStructureDefinitions();
