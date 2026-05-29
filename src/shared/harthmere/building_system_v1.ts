/*
 * building_system_v1.ts
 *
 * Production-oriented Building System contract for Grove/Harthmere property.
 * This module is intentionally shared: UI, live-mode reducer, API route tests,
 * and future world seeding all read the same plot/blueprint/NPC catalogue.
 *
 * Design rule: player buildings are solid voxel structures. GLTFs may decorate,
 * but floors/walls/roofs/foundations/stairs must be ECS/world terrain truth.
 */

import {
  registerHarthmereStructureDefinitionV1,
  type HarthmereBuildingPlacementContextV1,
  type HarthmerePlotDefinitionV1,
  type HarthmerePlotTypeV1,
  type HarthmereStructureTypeV1,
  type HarthmereTerrainTypeV1,
} from "@/shared/harthmere/mmo_building_authority_v1";
import type { BiomesId } from "@/shared/ids";
import { BikkieIds } from "@/shared/bikkie/ids";

export const BUILDING_SYSTEM_VERSION_V1 = "building-system-production-v5";

export type BuildingSystemPlotUseV1 =
  | "home"
  | "business"
  | "workshop"
  | "farm"
  | "storage"
  | "guild"
  | "public_service";

export type BuildingSystemStageV1 =
  | "site_preparation"
  | "foundation"
  | "frame"
  | "walls"
  | "roof"
  | "interior"
  | "utility_setup"
  | "completed";

export const BUILDING_SYSTEM_STAGE_ORDER_V1 = [
  "site_preparation",
  "foundation",
  "frame",
  "walls",
  "roof",
  "interior",
  "utility_setup",
  "completed",
] as const satisfies readonly BuildingSystemStageV1[];

export const BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1 = [
  "site_preparation",
  "foundation",
  "frame",
  "walls",
  "roof",
  "interior",
  "utility_setup",
] as const satisfies readonly BuildingSystemStageV1[];

export type BuildingSystemProjectStatusV1 = "active" | "completed" | "cancelled";

export interface BuildingSystemStageProgressV1 {
  materials: Record<string, number>;
  labor: number;
  completedAtMs?: number;
}

export interface BuildingSystemProjectRecordV1 {
  projectId: string;
  actorId: string;
  plotId: string;
  blueprintId: string;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  currentStage: BuildingSystemStageV1;
  completedStages: BuildingSystemStageV1[];
  stageProgress: Partial<Record<BuildingSystemStageV1, BuildingSystemStageProgressV1>>;
  startedAtMs: number;
  updatedAtMs: number;
  status: BuildingSystemProjectStatusV1;
  materializedStageRequestIds: string[];
  storageUnlocked: boolean;
}

export interface BuildingSystemInWorldMarkerV1 {
  markerId: string;
  plotId: string;
  kind: "muck_boundary" | "safe_zone" | "deed_sign" | "map_marker" | "npc_board" | "npc_map_marker" | "storage_container" | "door_lock" | "business_marker";
  position: [number, number, number];
  label: string;
  createdAtMs: number;
}

export interface BuildingSystemMaterialDefinitionV1 {
  material: string;
  displayName: string;
  itemId: string;
  bikkieId: BiomesId;
  bikkieName: string;
}

export interface BuildingSystemMaterialRequirementLineV1 extends BuildingSystemMaterialDefinitionV1 {
  required: number;
  contributed: number;
  remaining: number;
}

export const BUILDING_SYSTEM_MATERIAL_CATALOG_V1 = {
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
} as const satisfies Record<string, BuildingSystemMaterialDefinitionV1>;

export type BuildingSystemMaterialSymbolV1 = keyof typeof BUILDING_SYSTEM_MATERIAL_CATALOG_V1;

export interface BuildingSystemPlotDefinitionV1 {
  plotId: string;
  displayName: string;
  area: "the_grove" | "harthmere";
  district: string;
  plotType: HarthmerePlotTypeV1;
  allowedUses: BuildingSystemPlotUseV1[];
  allowedBlueprintIds: string[];
  claimPriceGold: number;
  taxRate: number;
  /** X/Z rectangle; converted into polygon for authority validation. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  groundY: number;
  /** Grove purchase rule: this starts mucky/dangerous and becomes safe after purchase. */
  startsMucked: boolean;
  safeAfterPurchase: boolean;
  maxStructureHeight: number;
  maxCoveredAreaFraction: number;
  requiresRoadAccess: boolean;
  roadAccessDistanceVoxels?: number;
  terrainType: HarthmereTerrainTypeV1;
  description: string;
}

export interface BuildingSystemBlueprintDefinitionV1 {
  blueprintId: string;
  displayName: string;
  plotType: HarthmerePlotTypeV1;
  use: BuildingSystemPlotUseV1;
  structureTypeId: HarthmereStructureTypeV1;
  goldCost: number;
  storageSlots: number;
  service: string;
  footprint: { width: number; depth: number; height: number };
  materialStages: Partial<Record<BuildingSystemStageV1, Record<string, number>>>;
  laborStages: Partial<Record<BuildingSystemStageV1, number>>;
  description: string;
}

export type BuildingSystemAccessModeV1 = "private" | "friends" | "guild" | "public";
export type BuildingSystemPermissionSubjectV1 =
  | "owner"
  | "friends_guests"
  | "guild_members"
  | "public";
export type BuildingSystemPermissionKeyV1 =
  | "storage_access"
  | "build_edit"
  | "demolition"
  | "transfer_sale";

export type BuildingSystemPermissionSetV1 = Record<BuildingSystemPermissionKeyV1, boolean>;

export interface BuildingSystemPropertyPermissionsV1 {
  owner: BuildingSystemPermissionSetV1;
  friends_guests: BuildingSystemPermissionSetV1;
  guild_members: BuildingSystemPermissionSetV1;
  public: BuildingSystemPermissionSetV1;
}

export interface BuildingSystemPropertyRecordV1 {
  propertyId: string;
  plotId: string;
  blueprintId: string;
  ownerId: string;
  status: BuildingSystemPlotUseV1 | "owned" | "abandoned" | "demolished" | "for_sale";
  use: BuildingSystemPlotUseV1;
  value: number;
  tier: number;
  accessMode: BuildingSystemAccessModeV1;
  permissions: BuildingSystemPropertyPermissionsV1;
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


export interface BuildingSystemStorageContainerRecordV1 {
  containerId: string;
  propertyId: string;
  plotId: string;
  ownerId: string;
  position: [number, number, number];
  slots: number;
  itemCount: number;
  accessMode: BuildingSystemAccessModeV1;
  allowedActorIds: string[];
  guildId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BuildingSystemDoorLockRecordV1 {
  lockId: string;
  propertyId: string;
  plotId: string;
  ownerId: string;
  position: [number, number, number];
  accessMode: BuildingSystemAccessModeV1;
  locked: boolean;
  guildId?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export type BuildingSystemBusinessTypeV1 =
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

export interface BuildingSystemBusinessTypeDefinitionV1 {
  businessType: BuildingSystemBusinessTypeV1;
  displayName: string;
  category: string;
  startingCostGold: number;
  materialNeed: "light" | "medium" | "heavy" | "rare";
  mainProductOrService: string;
  recurringDemand: readonly string[];
  connectedBusinesses: readonly BuildingSystemBusinessTypeV1[];
  baseRevenuePerCycleGold: number;
  upkeepPerCycleGold: number;
  licenseLevelRequired: number;
  serviceRadius: number;
}

export interface BuildingSystemBusinessRecordV1 {
  businessId: string;
  ownerId: string;
  type: BuildingSystemBusinessTypeV1;
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

export interface BuildingSystemPlacementPreviewV1 {
  plotId: string;
  blueprintId: string;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  boundaryOverlay: BuildingSystemPlotDefinitionV1["bounds"];
  ghostFootprint: Array<[number, number, number]>;
  requiredMaterials: BuildingSystemMaterialRequirementLineV1[];
  valid: boolean;
  warnings: string[];
}

export interface BuildingSystemPropertyLifecycleResultV1 {
  property: BuildingSystemPropertyRecordV1;
  taxDeltaGold: number;
  repairDecayDelta: number;
  warnings: string[];
}

export interface BuildingSystemSafeZoneRecordV1 {
  plotId: string;
  actorId: string;
  area: "the_grove" | "harthmere";
  bounds: BuildingSystemPlotDefinitionV1["bounds"];
  safeFromMuck: boolean;
  activatedAtMs: number;
}

export interface BuildingSystemVoxelEditSpecV1 {
  kind: "editEvent";
  position: [number, number, number];
  value: BiomesId;
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
    | "business_marker";
}

export interface BuildingSystemPlaceGroupSpecV1 {
  kind: "placeGroupEvent";
  groupId?: BiomesId;
  name: string;
  box: { v0: [number, number, number]; v1: [number, number, number] };
  reason: "building_blueprint_materialized";
}

export interface BuildingSystemMaterializationPlanV1 {
  version: typeof BUILDING_SYSTEM_VERSION_V1;
  requestId: string;
  actorId: string;
  plotId: string;
  blueprintId: string;
  structureTypeId: HarthmereStructureTypeV1;
  use: BuildingSystemPlotUseV1;
  projectId?: string;
  stage?: BuildingSystemStageV1;
  origin: { x: number; y: number; z: number };
  rotationDegrees: 0 | 90 | 180 | 270;
  edits: BuildingSystemVoxelEditSpecV1[];
  placeGroup: BuildingSystemPlaceGroupSpecV1;
  safeZone?: BuildingSystemSafeZoneRecordV1;
  inWorldMarkers?: BuildingSystemInWorldMarkerV1[];
  partialMaterialization?: boolean;
  unlocksStorage?: boolean;
  materializesSolidVoxelBuilding: true;
}

export interface BuildingSystemTerrainMaterializationPlanV1 {
  version: typeof BUILDING_SYSTEM_VERSION_V1;
  requestId: string;
  actorId: string;
  plotId: string;
  reason: "plot_claim_safe_ground";
  edits: BuildingSystemVoxelEditSpecV1[];
  safeZone: BuildingSystemSafeZoneRecordV1;
  inWorldMarkers?: BuildingSystemInWorldMarkerV1[];
  materializesSolidVoxelBuilding: false;
}

export type BuildingSystemAnyMaterializationPlanV1 =
  | BuildingSystemMaterializationPlanV1
  | BuildingSystemTerrainMaterializationPlanV1;

export const BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1 = {
  id: "mira_grove_land_steward",
  displayName: "Mira Thatch, Grove Land Steward",
  idOffset: 9315,
  homeArea: "the_grove",
  role: "Land steward, plot registrar, and safe-construction permit clerk",
  position: [501, 53, -132] as [number, number, number],
  line:
    "Land is not safe because paper says so. It is safe when the muck is cleared, the boundary is marked, and the door opens onto a real path.",
} as const;

export const BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1 = {
  questId: "building_system_intro_talk_to_mira",
  displayName: "Meet Mira, Grove Land Steward",
  initialForNewPlayers: true,
  completionNpcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.id,
  completionNpcOffset: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.idOffset,
  stepId: "talk_to_mira",
  objective: "Talk to Mira Thatch in the Grove to learn how to buy safe land and build with voxels.",
  mapMarkerLabel: "Talk to Mira",
} as const;

export const BUILDING_SYSTEM_TAX_PERIOD_MS_V1 = 24 * 60 * 60 * 1000;
export const BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1 =
  14 * BUILDING_SYSTEM_TAX_PERIOD_MS_V1;
export const BUILDING_SYSTEM_REPAIR_DECAY_PER_DAY_V1 = 2;
export const BUILDING_SYSTEM_MIN_DEMOLITION_REFUND_RATE_V1 = 0.1;
export const BUILDING_SYSTEM_STANDARD_DEMOLITION_REFUND_RATE_V1 = 0.35;

const BUILDING_BLOCKS_V1 = {
  foundation: BikkieIds.cobblestone,
  floor: BikkieIds.stone,
  frame: BikkieIds.oakLog,
  wall: BikkieIds.cobblestone,
  roof: BikkieIds.stone,
  stair: BikkieIds.woodenStepper,
  interior: BikkieIds.woodContainer,
  safeGround: BikkieIds.dirt,
  air: 0 as BiomesId,
  boundaryMarker: BikkieIds.woodenFencer,
  deedMarker: BikkieIds.smallOakSign,
  mapMarker: BikkieIds.bboxMarker,
  npcMarker: BikkieIds.bboxMarker,
  storageContainer: BikkieIds.woodContainer,
  doorLock: BikkieIds.smallOakSign,
  businessMarker: BikkieIds.bboxMarker,
  upgradeWall: BikkieIds.stone,
};

export const BUILDING_SYSTEM_PLOTS_V1: BuildingSystemPlotDefinitionV1[] = [
  {
    plotId: "grove_muckstead_cottage_lot",
    displayName: "Grove Muckstead Cottage Lot",
    area: "the_grove",
    district: "The Grove · Muck Edge",
    plotType: "residential",
    allowedUses: ["home"],
    allowedBlueprintIds: ["grove_voxel_cottage_tier_1"],
    claimPriceGold: 25,
    taxRate: 0.02,
    bounds: { xMin: 490, xMax: 502, zMin: -142, zMax: -130 },
    groundY: 52,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 8,
    maxCoveredAreaFraction: 0.7,
    requiresRoadAccess: false,
    roadAccessDistanceVoxels: 0,
    terrainType: "dirt",
    description:
      "Starter residential Grove lot. It begins as mucked land; purchase claims it, marks the boundary, and turns the plot safe before construction.",
  },
  {
    plotId: "grove_crossroads_shop_lot",
    displayName: "Grove Crossroads Shop Lot",
    area: "the_grove",
    district: "Genesis Crossroads",
    plotType: "commercial",
    allowedUses: ["business"],
    allowedBlueprintIds: ["grove_voxel_shop_tier_1"],
    claimPriceGold: 45,
    taxRate: 0.06,
    bounds: { xMin: 484, xMax: 498, zMin: -218, zMax: -204 },
    groundY: 52,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 9,
    maxCoveredAreaFraction: 0.65,
    requiresRoadAccess: true,
    roadAccessDistanceVoxels: 6,
    terrainType: "dirt",
    description:
      "A Grove business lot near the road kit route. It can become a player shop/business without blocking carts, NPCs, or quest markers.",
  },
  {
    plotId: "grove_guild_green_lot",
    displayName: "Grove Guild Green Lot",
    area: "the_grove",
    district: "The Grove · Guild Green",
    plotType: "guild",
    allowedUses: ["guild"],
    allowedBlueprintIds: ["grove_voxel_guild_hall_tier_1"],
    claimPriceGold: 110,
    taxRate: 0.04,
    bounds: { xMin: 504, xMax: 528, zMin: -146, zMax: -122 },
    groundY: 52,
    startsMucked: true,
    safeAfterPurchase: true,
    maxStructureHeight: 16,
    maxCoveredAreaFraction: 0.55,
    requiresRoadAccess: true,
    roadAccessDistanceVoxels: 10,
    terrainType: "grass",
    description:
      "A larger Grove lot for a guild hall. It supports shared storage, permissions, guild services, and public project coordination.",
  },
];

export const BUILDING_SYSTEM_BLUEPRINTS_V1: BuildingSystemBlueprintDefinitionV1[] = [
  {
    blueprintId: "grove_voxel_cottage_tier_1",
    displayName: "Voxel Cottage",
    plotType: "residential",
    use: "home",
    structureTypeId: "small_house",
    goldCost: 20,
    storageSlots: 24,
    service: "Home: safe rest, private storage, guest access, and respawn-friendly shelter.",
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
    plotType: "commercial",
    use: "business",
    structureTypeId: "shop",
    goldCost: 35,
    storageSlots: 18,
    service: "Business: shop counter, listings, customer access, and taxable sales ledger.",
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
    plotType: "guild",
    use: "guild",
    structureTypeId: "guild_hall",
    goldCost: 80,
    storageSlots: 96,
    service: "Guild: shared permissions, guild bank, charter board, project staging, and public meeting hall.",
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
];

export function ensureBuildingSystemStructureDefinitionsV1() {
  // The base authority already registers small_house, shop, farm_plot, guild_hall,
  // and fence. Register the rest of the production building types so property
  // uses beyond homes never fail as unknown structures in isolation tests.
  registerHarthmereStructureDefinitionV1({
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
  registerHarthmereStructureDefinitionV1({
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
  registerHarthmereStructureDefinitionV1({
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
}

export function buildingSystemPlotByIdV1(plotId: string | undefined) {
  return BUILDING_SYSTEM_PLOTS_V1.find((plot) => plot.plotId === plotId);
}

export function buildingSystemBlueprintByIdV1(blueprintId: string | undefined) {
  return BUILDING_SYSTEM_BLUEPRINTS_V1.find(
    (blueprint) => blueprint.blueprintId === blueprintId
  );
}

export function buildingSystemBlueprintByStructureTypeV1(
  structureTypeId: string | undefined,
  plotType?: HarthmerePlotTypeV1
) {
  return BUILDING_SYSTEM_BLUEPRINTS_V1.find(
    (blueprint) =>
      blueprint.structureTypeId === structureTypeId &&
      (!plotType || blueprint.plotType === plotType)
  );
}

function plotBoundaryPolygon(plot: BuildingSystemPlotDefinitionV1) {
  const { xMin, xMax, zMin, zMax } = plot.bounds;
  return [
    { x: xMin, z: zMin },
    { x: xMax, z: zMin },
    { x: xMax, z: zMax },
    { x: xMin, z: zMax },
  ];
}

export function toHarthmerePlotDefinitionV1(
  plot: BuildingSystemPlotDefinitionV1,
  ownerId: string,
  active = true,
  currentCoveredAreaVoxels = 0
): HarthmerePlotDefinitionV1 {
  const area = Math.max(1, plot.bounds.xMax - plot.bounds.xMin) *
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

export function buildingSystemDefaultOriginV1(
  plot: BuildingSystemPlotDefinitionV1,
  blueprint: BuildingSystemBlueprintDefinitionV1
) {
  return {
    x: Math.floor((plot.bounds.xMin + plot.bounds.xMax - blueprint.footprint.width) / 2),
    y: plot.groundY + 1,
    z: Math.floor((plot.bounds.zMin + plot.bounds.zMax - blueprint.footprint.depth) / 2),
  };
}

export function createBuildingSystemPlacementContextV1(input: {
  actorId: string;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  origin?: { x: number; y: number; z: number };
  owned: boolean;
  nearbyStructures?: HarthmereBuildingPlacementContextV1["nearbyStructures"];
  npcRouteWaypoints?: HarthmereBuildingPlacementContextV1["npcRouteWaypoints"];
  questTriggerAreas?: HarthmereBuildingPlacementContextV1["questTriggerAreas"];
  currentCoveredAreaVoxels?: number;
}): HarthmereBuildingPlacementContextV1 {
  const origin = input.origin ?? buildingSystemDefaultOriginV1(input.plot, input.blueprint);
  const cols: HarthmereBuildingPlacementContextV1["terrainColumns"] = [];
  for (let x = origin.x; x < origin.x + input.blueprint.footprint.width; x++) {
    for (let z = origin.z; z < origin.z + input.blueprint.footprint.depth; z++) {
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
    hasRoadAccess: !input.plot.requiresRoadAccess || typeof roadDistance === "number",
    minRoadDistanceVoxels: roadDistance ?? 0,
    plot: toHarthmerePlotDefinitionV1(
      input.plot,
      input.owned ? input.actorId : "",
      input.owned,
      input.currentCoveredAreaVoxels ?? 0
    ),
  };
}

function pushVoxelBox(
  edits: BuildingSystemVoxelEditSpecV1[],
  min: [number, number, number],
  maxExclusive: [number, number, number],
  value: BiomesId,
  label: BuildingSystemVoxelEditSpecV1["label"]
) {
  for (let x = min[0]; x < maxExclusive[0]; x++) {
    for (let y = min[1]; y < maxExclusive[1]; y++) {
      for (let z = min[2]; z < maxExclusive[2]; z++) {
        edits.push({ kind: "editEvent", position: [x, y, z], value, label });
      }
    }
  }
}

export function buildingSystemMaterialDefinitionV1(material: string) {
  return BUILDING_SYSTEM_MATERIAL_CATALOG_V1[
    material as BuildingSystemMaterialSymbolV1
  ];
}

export function buildingSystemMaterialItemIdV1(material: string) {
  return buildingSystemMaterialDefinitionV1(material)?.itemId;
}

export function buildingSystemMaterialRequirementLinesV1(input: {
  blueprint: BuildingSystemBlueprintDefinitionV1;
  stage: BuildingSystemStageV1;
  contributed?: Record<string, number>;
}): BuildingSystemMaterialRequirementLineV1[] {
  const required = input.blueprint.materialStages[input.stage] ?? {};
  return Object.entries(required).map(([material, count]) => {
    const def = buildingSystemMaterialDefinitionV1(material);
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

export function buildingSystemRemainingMaterialItemDeltasV1(input: {
  blueprint: BuildingSystemBlueprintDefinitionV1;
  stage: BuildingSystemStageV1;
  contributed?: Record<string, number>;
  requestedMaterials?: Record<string, number>;
  contributeAll?: boolean;
}) {
  const lines = buildingSystemMaterialRequirementLinesV1({
    blueprint: input.blueprint,
    stage: input.stage,
    contributed: input.contributed,
  });
  const materialDeltas: Record<string, number> = {};
  const symbolicContributions: Record<string, number> = {};
  for (const line of lines) {
    let requested = input.contributeAll || !input.requestedMaterials
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
      materialDeltas[line.itemId] = (materialDeltas[line.itemId] ?? 0) - requested;
      symbolicContributions[line.material] =
        (symbolicContributions[line.material] ?? 0) + requested;
    }
  }
  return { itemDeltas: materialDeltas, symbolicContributions, lines };
}

function createBuildingSystemPlotMarkersV1(input: {
  actorId: string;
  plot: BuildingSystemPlotDefinitionV1;
  activatedAtMs: number;
}) {
  const edits: BuildingSystemVoxelEditSpecV1[] = [];
  const markers: BuildingSystemInWorldMarkerV1[] = [];
  const y = input.plot.groundY + 1;
  const { xMin, xMax, zMin, zMax } = input.plot.bounds;
  const markerEvery = 3;
  for (let x = xMin; x < xMax; x += markerEvery) {
    edits.push({ kind: "editEvent", position: [x, y, zMin], value: BUILDING_BLOCKS_V1.boundaryMarker, label: "boundary_marker" });
    edits.push({ kind: "editEvent", position: [x, y, zMax - 1], value: BUILDING_BLOCKS_V1.boundaryMarker, label: "boundary_marker" });
  }
  for (let z = zMin; z < zMax; z += markerEvery) {
    edits.push({ kind: "editEvent", position: [xMin, y, z], value: BUILDING_BLOCKS_V1.boundaryMarker, label: "boundary_marker" });
    edits.push({ kind: "editEvent", position: [xMax - 1, y, z], value: BUILDING_BLOCKS_V1.boundaryMarker, label: "boundary_marker" });
  }
  const center: [number, number, number] = [
    Math.floor((xMin + xMax) / 2),
    y,
    Math.floor((zMin + zMax) / 2),
  ];
  const deed: [number, number, number] = [xMin + 1, y, zMin + 1];
  const map: [number, number, number] = [center[0], y + 1, center[2]];
  edits.push({ kind: "editEvent", position: deed, value: BUILDING_BLOCKS_V1.deedMarker, label: "deed_marker" });
  edits.push({ kind: "editEvent", position: map, value: BUILDING_BLOCKS_V1.mapMarker, label: "map_marker" });
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
      label: `Purchased by ${input.actorId}`,
      createdAtMs: input.activatedAtMs,
    },
    {
      markerId: `${input.plot.plotId}:map`,
      plotId: input.plot.plotId,
      kind: "map_marker",
      position: map,
      label: `${input.plot.displayName} safe deed`,
      createdAtMs: input.activatedAtMs,
    },
    {
      markerId: `${input.plot.plotId}:safe-zone`,
      plotId: input.plot.plotId,
      kind: "safe_zone",
      position: center,
      label: "Safe from muck after purchase",
      createdAtMs: input.activatedAtMs,
    }
  );
  return { edits, markers };
}

function pushBuildingWallsV1(input: {
  edits: BuildingSystemVoxelEditSpecV1[];
  x0: number;
  x1: number;
  y0: number;
  z0: number;
  z1: number;
  wallTop: number;
}) {
  const doorX = Math.floor((input.x0 + input.x1) / 2);
  for (let y = input.y0 + 1; y < input.wallTop; y++) {
    for (let x = input.x0; x < input.x1; x++) {
      const isDoor = x === doorX && (y === input.y0 + 1 || y === input.y0 + 2);
      if (!isDoor) {
        input.edits.push({ kind: "editEvent", position: [x, y, input.z0], value: BUILDING_BLOCKS_V1.wall, label: "wall" });
      }
      input.edits.push({ kind: "editEvent", position: [x, y, input.z1 - 1], value: BUILDING_BLOCKS_V1.wall, label: "wall" });
    }
    for (let z = input.z0 + 1; z < input.z1 - 1; z++) {
      input.edits.push({ kind: "editEvent", position: [input.x0, y, z], value: BUILDING_BLOCKS_V1.wall, label: "wall" });
      input.edits.push({ kind: "editEvent", position: [input.x1 - 1, y, z], value: BUILDING_BLOCKS_V1.wall, label: "wall" });
    }
  }
}

function buildingSystemGeometryBoundsV1(
  plot: BuildingSystemPlotDefinitionV1,
  blueprint: BuildingSystemBlueprintDefinitionV1,
  origin?: { x: number; y: number; z: number }
) {
  const resolvedOrigin = origin ?? buildingSystemDefaultOriginV1(plot, blueprint);
  const fp = blueprint.footprint;
  const x0 = resolvedOrigin.x;
  const z0 = resolvedOrigin.z;
  const y0 = resolvedOrigin.y;
  const x1 = x0 + fp.width;
  const z1 = z0 + fp.depth;
  const wallTop = y0 + Math.max(3, fp.height - 1);
  const roofY = wallTop;
  return { origin: resolvedOrigin, fp, x0, y0, z0, x1, z1, wallTop, roofY };
}

export function createBuildingSystemSafeGroundMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  plot: BuildingSystemPlotDefinitionV1;
  activatedAtMs: number;
}): BuildingSystemTerrainMaterializationPlanV1 {
  const edits: BuildingSystemVoxelEditSpecV1[] = [];
  const markerPlan = createBuildingSystemPlotMarkersV1({
    actorId: input.actorId,
    plot: input.plot,
    activatedAtMs: input.activatedAtMs,
  });
  if (input.plot.safeAfterPurchase) {
    pushVoxelBox(
      edits,
      [input.plot.bounds.xMin, input.plot.groundY, input.plot.bounds.zMin],
      [input.plot.bounds.xMax, input.plot.groundY + 1, input.plot.bounds.zMax],
      BUILDING_BLOCKS_V1.safeGround,
      "safe_ground"
    );
  }
  edits.push(...markerPlan.edits);
  return {
    version: BUILDING_SYSTEM_VERSION_V1,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    reason: "plot_claim_safe_ground",
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

export function createBuildingSystemMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  includeSafeGround?: boolean;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const { origin, x0, z0, y0, x1, z1, wallTop, roofY } = buildingSystemGeometryBoundsV1(
    input.plot,
    input.blueprint,
    input.origin
  );
  const edits: BuildingSystemVoxelEditSpecV1[] = [];

  if (input.includeSafeGround && input.plot.safeAfterPurchase) {
    pushVoxelBox(
      edits,
      [input.plot.bounds.xMin, input.plot.groundY, input.plot.bounds.zMin],
      [input.plot.bounds.xMax, input.plot.groundY + 1, input.plot.bounds.zMax],
      BUILDING_BLOCKS_V1.safeGround,
      "safe_ground"
    );
  }

  // Foundation and walkable floor.
  pushVoxelBox(edits, [x0, y0 - 1, z0], [x1, y0, z1], BUILDING_BLOCKS_V1.foundation, "foundation");
  pushVoxelBox(edits, [x0, y0, z0], [x1, y0 + 1, z1], BUILDING_BLOCKS_V1.floor, "floor");

  // Solid walls. Leave a two-block door opening centered on the south face.
  pushBuildingWallsV1({ edits, x0, x1, y0, z0, z1, wallTop });

  // Solid roof players can stand on.
  pushVoxelBox(edits, [x0, roofY, z0], [x1, roofY + 1, z1], BUILDING_BLOCKS_V1.roof, "roof");

  // Front stair/step into the door if within claimed plot.
  const doorX = Math.floor((x0 + x1) / 2);
  const stairZ = z0 - 1;
  if (
    stairZ >= input.plot.bounds.zMin &&
    doorX >= input.plot.bounds.xMin &&
    doorX < input.plot.bounds.xMax
  ) {
    edits.push({ kind: "editEvent", position: [doorX, y0, stairZ], value: BUILDING_BLOCKS_V1.stair, label: "stair" });
  }

  return {
    version: BUILDING_SYSTEM_VERSION_V1,
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
      input.plot.safeAfterPurchase
        ? {
            plotId: input.plot.plotId,
            actorId: input.actorId,
            area: input.plot.area,
            bounds: input.plot.bounds,
            safeFromMuck: true,
            activatedAtMs: input.activatedAtMs,
          }
        : undefined,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemStageMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  projectId: string;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  stage: BuildingSystemStageV1;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const { origin, x0, z0, y0, x1, z1, wallTop, roofY } = buildingSystemGeometryBoundsV1(
    input.plot,
    input.blueprint,
    input.origin
  );
  const edits: BuildingSystemVoxelEditSpecV1[] = [];
  const stage = input.stage;
  const doorX = Math.floor((x0 + x1) / 2);

  if (stage === "site_preparation") {
    const markerPlan = createBuildingSystemPlotMarkersV1({
      actorId: input.actorId,
      plot: input.plot,
      activatedAtMs: input.activatedAtMs,
    });
    edits.push(...markerPlan.edits.filter((edit) => edit.label === "boundary_marker"));
  } else if (stage === "foundation") {
    // Foundation and walkable floor appear only after the foundation stage.
    pushVoxelBox(edits, [x0, y0 - 1, z0], [x1, y0, z1], BUILDING_BLOCKS_V1.foundation, "foundation");
    pushVoxelBox(edits, [x0, y0, z0], [x1, y0 + 1, z1], BUILDING_BLOCKS_V1.floor, "floor");
  } else if (stage === "frame") {
    // Corners and a simple header prove the frame exists before full walls.
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]] as Array<[number, number]>) {
      pushVoxelBox(edits, [px, y0 + 1, pz], [px + 1, wallTop, pz + 1], BUILDING_BLOCKS_V1.frame, "frame");
    }
    edits.push({ kind: "editEvent", position: [doorX, y0 + 3, z0], value: BUILDING_BLOCKS_V1.frame, label: "frame" });
  } else if (stage === "walls") {
    // Walls appear only after the walls stage.
    pushBuildingWallsV1({ edits, x0, x1, y0, z0, z1, wallTop });
  } else if (stage === "roof") {
    // A solid standable roof appears only after the roof stage.
    pushVoxelBox(edits, [x0, roofY, z0], [x1, roofY + 1, z1], BUILDING_BLOCKS_V1.roof, "roof");
  } else if (stage === "interior") {
    // Interior/stairs are visible, but storage/services unlock only when completed.
    const stairZ = z0 - 1;
    if (stairZ >= input.plot.bounds.zMin) {
      edits.push({ kind: "editEvent", position: [doorX, y0, stairZ], value: BUILDING_BLOCKS_V1.stair, label: "stair" });
    }
    edits.push({ kind: "editEvent", position: [x0 + 1, y0 + 1, z0 + 1], value: BUILDING_BLOCKS_V1.interior, label: "interior" });
  } else if (stage === "utility_setup") {
    edits.push({ kind: "editEvent", position: [x0 + 1, y0 + 1, z0], value: BUILDING_BLOCKS_V1.deedMarker, label: "deed_marker" });
  }

  return {
    version: BUILDING_SYSTEM_VERSION_V1,
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
    safeZone:
      input.plot.safeAfterPurchase
        ? {
            plotId: input.plot.plotId,
            actorId: input.actorId,
            area: input.plot.area,
            bounds: input.plot.bounds,
            safeFromMuck: true,
            activatedAtMs: input.activatedAtMs,
          }
        : undefined,
    partialMaterialization: stage !== "completed",
    unlocksStorage: stage === "completed",
    materializesSolidVoxelBuilding: true,
  };
}

export function countBuildingSystemVoxelLabelsV1(plan: BuildingSystemAnyMaterializationPlanV1) {
  return plan.edits.reduce<Record<string, number>>((acc, edit) => {
    acc[edit.label] = (acc[edit.label] ?? 0) + 1;
    return acc;
  }, {});
}

export function createBuildingSystemDefaultPermissionsV1(
  accessMode: BuildingSystemAccessModeV1 = "private"
): BuildingSystemPropertyPermissionsV1 {
  const none: BuildingSystemPermissionSetV1 = {
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

function createBuildingSystemPermissionsForUseV1(
  use: BuildingSystemPlotUseV1,
  accessMode: BuildingSystemAccessModeV1,
  raw?: Partial<BuildingSystemPropertyPermissionsV1>
): BuildingSystemPropertyPermissionsV1 {
  const base = createBuildingSystemDefaultPermissionsV1(accessMode);
  const permissions: BuildingSystemPropertyPermissionsV1 = {
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

export function createBuildingSystemPropertyRecordV1(input: {
  propertyId: string;
  ownerId: string;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  nowMs: number;
  guildId?: string;
  value?: number;
}): BuildingSystemPropertyRecordV1 {
  const businessTaxRate =
    input.blueprint.use === "business" ? Math.max(input.plot.taxRate, 0.08) : 0;
  const guildTaxRate =
    input.blueprint.use === "guild" ? Math.max(input.plot.taxRate, 0.05) : 0;
  const accessMode =
    input.blueprint.use === "business" ? "public" : input.blueprint.use === "guild" ? "guild" : "private";
  return {
    propertyId: input.propertyId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    ownerId: input.ownerId,
    status: input.blueprint.use,
    use: input.blueprint.use,
    value: Math.max(input.blueprint.goldCost, input.value ?? input.blueprint.goldCost),
    tier: 1,
    accessMode,
    permissions: createBuildingSystemPermissionsForUseV1(input.blueprint.use, accessMode),
    guestActorIds: [],
    guildId: input.guildId,
    storageSlots: input.blueprint.storageSlots,
    storageItemCount: 0,
    storageContainerId: `storage_${input.propertyId}`,
    doorLockId: `door_${input.propertyId}`,
    businessId: input.blueprint.use === "business" ? `business_${input.propertyId}` : undefined,
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

export function normalizeBuildingSystemPropertyRecordV1(input: {
  propertyId: string;
  raw: unknown;
  ownerId: string;
  nowMs: number;
}): BuildingSystemPropertyRecordV1 {
  const raw = typeof input.raw === "object" && input.raw !== null ? (input.raw as any) : {};
  const plot = buildingSystemPlotByIdV1(raw.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(raw.blueprintId);
  if (plot && blueprint) {
    return {
      ...createBuildingSystemPropertyRecordV1({
        propertyId: input.propertyId,
        ownerId: String(raw.ownerId ?? input.ownerId),
        plot,
        blueprint,
        nowMs: input.nowMs,
        value: Number(raw.value ?? blueprint.goldCost),
        guildId: typeof raw.guildId === "string" ? raw.guildId : undefined,
      }),
      ...raw,
      permissions: createBuildingSystemPermissionsForUseV1(
        blueprint.use,
        raw.accessMode ?? (blueprint.use === "business" ? "public" : blueprint.use === "guild" ? "guild" : "private"),
        raw.permissions
      ),
      storageContainerId: typeof raw.storageContainerId === "string" ? raw.storageContainerId : `storage_${input.propertyId}`,
      doorLockId: typeof raw.doorLockId === "string" ? raw.doorLockId : `door_${input.propertyId}`,
      businessId: typeof raw.businessId === "string" ? raw.businessId : blueprint.use === "business" ? `business_${input.propertyId}` : undefined,
      visualDamageApplied: Boolean(raw.visualDamageApplied),
      upgradedVoxelTier: Math.max(1, Number(raw.upgradedVoxelTier ?? raw.tier ?? 1)),
    };
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
    permissions: createBuildingSystemPermissionsForUseV1(
      raw.use ?? raw.status ?? "home",
      raw.accessMode ?? "private",
      raw.permissions
    ),
    guestActorIds: Array.isArray(raw.guestActorIds) ? raw.guestActorIds : [],
    guildId: typeof raw.guildId === "string" ? raw.guildId : undefined,
    storageSlots: Math.max(0, Number(raw.storageSlots ?? 0)),
    storageItemCount: Math.max(0, Number(raw.storageItemCount ?? 0)),
    storageContainerId: typeof raw.storageContainerId === "string" ? raw.storageContainerId : undefined,
    doorLockId: typeof raw.doorLockId === "string" ? raw.doorLockId : undefined,
    businessId: typeof raw.businessId === "string" ? raw.businessId : undefined,
    visualDamageApplied: Boolean(raw.visualDamageApplied),
    upgradedVoxelTier: Math.max(1, Number(raw.upgradedVoxelTier ?? raw.tier ?? 1)),
    condition: Math.max(0, Math.min(100, Number(raw.condition ?? 100))),
    repairDebtGold: Math.max(0, Number(raw.repairDebtGold ?? 0)),
    lastRepairDecayAtMs: Number(raw.lastRepairDecayAtMs ?? input.nowMs),
    taxRate: Math.max(0, Number(raw.taxRate ?? 0)),
    businessTaxRate: Math.max(0, Number(raw.businessTaxRate ?? 0)),
    guildTaxRate: Math.max(0, Number(raw.guildTaxRate ?? 0)),
    taxBalanceGold: Math.max(0, Number(raw.taxBalanceGold ?? 0)),
    lastTaxAssessedAtMs: Number(raw.lastTaxAssessedAtMs ?? input.nowMs),
    unpaidTaxSinceMs: typeof raw.unpaidTaxSinceMs === "number" ? raw.unpaidTaxSinceMs : undefined,
    abandoned: Boolean(raw.abandoned),
    abandonedAtMs: typeof raw.abandonedAtMs === "number" ? raw.abandonedAtMs : undefined,
    listedForSale: Boolean(raw.listedForSale),
    salePriceGold: typeof raw.salePriceGold === "number" ? raw.salePriceGold : undefined,
    createdAtMs: Number(raw.createdAtMs ?? input.nowMs),
    updatedAtMs: Number(raw.updatedAtMs ?? input.nowMs),
  };
}

export function buildingSystemPropertyTaxRateV1(
  property: Pick<BuildingSystemPropertyRecordV1, "use" | "taxRate" | "businessTaxRate" | "guildTaxRate">
) {
  if (property.use === "business") {
    return Math.max(property.taxRate, property.businessTaxRate);
  }
  if (property.use === "guild") {
    return Math.max(property.taxRate, property.guildTaxRate);
  }
  return property.taxRate;
}

export function applyBuildingSystemPropertyLifecycleV1(input: {
  property: BuildingSystemPropertyRecordV1;
  nowMs: number;
}): BuildingSystemPropertyLifecycleResultV1 {
  const property: BuildingSystemPropertyRecordV1 = { ...input.property };
  const warnings: string[] = [];
  const elapsedTaxPeriods = Math.max(0, Math.floor((input.nowMs - property.lastTaxAssessedAtMs) / BUILDING_SYSTEM_TAX_PERIOD_MS_V1));
  const taxDeltaGold = elapsedTaxPeriods > 0
    ? Math.max(1, Math.floor(property.value * buildingSystemPropertyTaxRateV1(property) * elapsedTaxPeriods))
    : 0;
  if (taxDeltaGold > 0) {
    const firstUnpaidDueAtMs =
      property.lastTaxAssessedAtMs + BUILDING_SYSTEM_TAX_PERIOD_MS_V1;
    property.taxBalanceGold += taxDeltaGold;
    property.lastTaxAssessedAtMs += elapsedTaxPeriods * BUILDING_SYSTEM_TAX_PERIOD_MS_V1;
    if (!property.unpaidTaxSinceMs) {
      property.unpaidTaxSinceMs = firstUnpaidDueAtMs;
    }
  }

  const elapsedRepairDays = Math.max(0, Math.floor((input.nowMs - property.lastRepairDecayAtMs) / BUILDING_SYSTEM_TAX_PERIOD_MS_V1));
  const repairDecayDelta = elapsedRepairDays > 0
    ? Math.min(property.condition, elapsedRepairDays * BUILDING_SYSTEM_REPAIR_DECAY_PER_DAY_V1)
    : 0;
  if (repairDecayDelta > 0) {
    property.condition = Math.max(0, property.condition - repairDecayDelta);
    property.repairDebtGold += repairDecayDelta;
    property.lastRepairDecayAtMs += elapsedRepairDays * BUILDING_SYSTEM_TAX_PERIOD_MS_V1;
  }

  if (property.taxBalanceGold > 0 && property.unpaidTaxSinceMs &&
      input.nowMs - property.unpaidTaxSinceMs >= BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1) {
    property.abandoned = true;
    property.abandonedAtMs = property.abandonedAtMs ?? input.nowMs;
    property.status = "abandoned";
    warnings.push("property_marked_abandoned:unpaid_taxes");
  }
  property.updatedAtMs = input.nowMs;
  return { property, taxDeltaGold, repairDecayDelta, warnings };
}

export function buildingSystemCanActorAccessPropertyV1(input: {
  property: BuildingSystemPropertyRecordV1;
  actorId: string;
  permission: BuildingSystemPermissionKeyV1;
  guildId?: string;
}) {
  const { property, actorId, permission, guildId } = input;
  if (actorId === property.ownerId) return property.permissions.owner[permission];
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

export function buildingSystemUpgradeCostGoldV1(property: BuildingSystemPropertyRecordV1) {
  return Math.max(25, Math.floor(property.value * 0.75 * property.tier));
}

export function buildingSystemRepairCostGoldV1(property: BuildingSystemPropertyRecordV1) {
  return Math.max(0, Math.ceil((100 - property.condition) * Math.max(1, property.tier)));
}

export function buildingSystemDemolitionRefundGoldV1(property: BuildingSystemPropertyRecordV1) {
  if (property.abandoned || property.condition <= 25) {
    return Math.floor(property.value * BUILDING_SYSTEM_MIN_DEMOLITION_REFUND_RATE_V1);
  }
  return Math.floor(property.value * BUILDING_SYSTEM_STANDARD_DEMOLITION_REFUND_RATE_V1);
}


export const BUILDING_SYSTEM_BUSINESS_TYPES_V1: readonly BuildingSystemBusinessTypeDefinitionV1[] = [
  { businessType: "exotic_matter_refinery", displayName: "Exotic Matter Refinery", category: "Industrial / Infrastructure", startingCostGold: 1200, materialNeed: "heavy", mainProductOrService: "Stabilized Exotic Matter, portal fuel, Biome anchor cores", recurringDemand: ["raw material restock", "machine maintenance", "town fuel orders"], connectedBusinesses: ["portal_transit_company", "teleport_owner", "biome_maintenance_repair"], baseRevenuePerCycleGold: 180, upkeepPerCycleGold: 55, licenseLevelRequired: 4, serviceRadius: 32 },
  { businessType: "biome_maintenance_repair", displayName: "Biome Maintenance & Repair Company", category: "Technical Service", startingCostGold: 700, materialNeed: "medium", mainProductOrService: "Inspections, emergency repairs, climate tuning", recurringDemand: ["property decay", "weather failure", "maintenance subscriptions"], connectedBusinesses: ["exotic_matter_refinery", "custom_home_property_development", "repair_maintenance_person"], baseRevenuePerCycleGold: 105, upkeepPerCycleGold: 28, licenseLevelRequired: 2, serviceRadius: 18 },
  { businessType: "biome_design_studio", displayName: "Biome Design Studio", category: "Creative / Property Service", startingCostGold: 500, materialNeed: "medium", mainProductOrService: "Decoration packs, terrain templates, custom sky/weather themes", recurringDemand: ["seasonal trends", "festival commissions", "property value upgrades"], connectedBusinesses: ["custom_home_property_development", "hospitality_inn_hotel_shelter", "food_service_restaurant"], baseRevenuePerCycleGold: 75, upkeepPerCycleGold: 18, licenseLevelRequired: 1, serviceRadius: 14 },
  { businessType: "security_defense_contractor", displayName: "Security & Defense Contractor", category: "Protection / Combat Service", startingCostGold: 600, materialNeed: "medium", mainProductOrService: "Guard duty, monster removal, bounty hunting", recurringDemand: ["threat migration", "guard contracts", "gear replacement"], connectedBusinesses: ["weapons_tools", "portal_transit_company", "biome_farming_rare_foods"], baseRevenuePerCycleGold: 95, upkeepPerCycleGold: 30, licenseLevelRequired: 2, serviceRadius: 20 },
  { businessType: "portal_transit_company", displayName: "Portal Transit Company", category: "Infrastructure / Transportation", startingCostGold: 5000, materialNeed: "heavy", mainProductOrService: "Public travel, cargo routes, private gates", recurringDemand: ["portal fuel", "route stabilization", "cargo contracts"], connectedBusinesses: ["exotic_matter_refinery", "courier", "security_defense_contractor"], baseRevenuePerCycleGold: 540, upkeepPerCycleGold: 160, licenseLevelRequired: 5, serviceRadius: 64 },
  { businessType: "biome_farming_rare_foods", displayName: "Biome Farming & Rare Foods", category: "Agriculture / Food Supply", startingCostGold: 300, materialNeed: "heavy", mainProductOrService: "Crops, rare fruits, herbs", recurringDemand: ["crop cycles", "restaurant orders", "medicine ingredients"], connectedBusinesses: ["food_service_restaurant", "medical_doctor", "general_trader"], baseRevenuePerCycleGold: 48, upkeepPerCycleGold: 12, licenseLevelRequired: 1, serviceRadius: 12 },
  { businessType: "weapons_tools", displayName: "Weapons & Tools", category: "Crafting / Equipment", startingCostGold: 500, materialNeed: "heavy", mainProductOrService: "Swords, bows, spears, tools", recurringDemand: ["tool durability", "weapon upgrades", "bulk guard orders"], connectedBusinesses: ["security_defense_contractor", "hunter_wild_meat", "custom_home_property_development"], baseRevenuePerCycleGold: 80, upkeepPerCycleGold: 24, licenseLevelRequired: 2, serviceRadius: 14 },
  { businessType: "magic_goods", displayName: "Magic Goods", category: "Exotic / Consumable Crafting", startingCostGold: 800, materialNeed: "rare", mainProductOrService: "Charms, potions, protective wards", recurringDemand: ["expiring unstable goods", "disaster demand", "rare component requests"], connectedBusinesses: ["exotic_matter_refinery", "medical_doctor", "exploration_guide"], baseRevenuePerCycleGold: 120, upkeepPerCycleGold: 38, licenseLevelRequired: 3, serviceRadius: 16 },
  { businessType: "exploration_guide", displayName: "Exploration Guide", category: "Knowledge / Travel Service", startingCostGold: 400, materialNeed: "light", mainProductOrService: "Guided expeditions, ruin tours, rare resource routes", recurringDemand: ["shifting maps", "client expeditions", "dangerous routes"], connectedBusinesses: ["courier", "security_defense_contractor", "magic_goods"], baseRevenuePerCycleGold: 62, upkeepPerCycleGold: 16, licenseLevelRequired: 1, serviceRadius: 26 },
  { businessType: "custom_home_property_development", displayName: "Custom Home & Property Development", category: "Construction / Real Estate", startingCostGold: 1000, materialNeed: "heavy", mainProductOrService: "Houses, shops, apartments, guild halls", recurringDemand: ["staged construction", "tenants", "repairs and taxes"], connectedBusinesses: ["biome_design_studio", "biome_maintenance_repair", "waste_sanitation_cleanup"], baseRevenuePerCycleGold: 150, upkeepPerCycleGold: 45, licenseLevelRequired: 3, serviceRadius: 18 },
  { businessType: "general_trader", displayName: "General Trader", category: "Retail / Brokerage", startingCostGold: 300, materialNeed: "medium", mainProductOrService: "Basic tools, food, seeds", recurringDemand: ["regional price changes", "stock turnover", "customer requests"], connectedBusinesses: ["courier", "biome_farming_rare_foods", "weapons_tools"], baseRevenuePerCycleGold: 55, upkeepPerCycleGold: 14, licenseLevelRequired: 1, serviceRadius: 12 },
  { businessType: "hunter_wild_meat", displayName: "Hunter for Wild Meat", category: "Food / Wildlife Control", startingCostGold: 300, materialNeed: "medium", mainProductOrService: "Wild meat, rare cuts, hides", recurringDemand: ["animal migration", "meat spoilage", "restaurant supply"], connectedBusinesses: ["food_service_restaurant", "general_trader", "weapons_tools"], baseRevenuePerCycleGold: 58, upkeepPerCycleGold: 18, licenseLevelRequired: 1, serviceRadius: 18 },
  { businessType: "medical_doctor", displayName: "Medical / Doctor", category: "Healthcare / Public Service", startingCostGold: 500, materialNeed: "medium", mainProductOrService: "Injury treatment, disease treatment, surgery", recurringDemand: ["patients", "medicine stock", "outbreaks"], connectedBusinesses: ["biome_farming_rare_foods", "magic_goods", "courier"], baseRevenuePerCycleGold: 82, upkeepPerCycleGold: 26, licenseLevelRequired: 2, serviceRadius: 14 },
  { businessType: "teleport_owner", displayName: "Teleport Owner", category: "Local Transportation / Access Control", startingCostGold: 2500, materialNeed: "heavy", mainProductOrService: "Pay-per-use teleport, private access, emergency return", recurringDemand: ["fuel", "link maintenance", "access tokens"], connectedBusinesses: ["exotic_matter_refinery", "portal_transit_company", "courier"], baseRevenuePerCycleGold: 280, upkeepPerCycleGold: 88, licenseLevelRequired: 4, serviceRadius: 32 },
  { businessType: "waste_sanitation_cleanup", displayName: "Waste, Sanitation & Contamination Cleanup", category: "Public Health / Hazard Service", startingCostGold: 400, materialNeed: "medium", mainProductOrService: "Trash pickup, recycling, composting, contamination cleanup", recurringDemand: ["waste accumulation", "dirty business penalties", "hazard cleanup"], connectedBusinesses: ["food_service_restaurant", "medical_doctor", "custom_home_property_development"], baseRevenuePerCycleGold: 66, upkeepPerCycleGold: 20, licenseLevelRequired: 1, serviceRadius: 14 },
  { businessType: "repair_maintenance_person", displayName: "Repair People / Maintenance Person", category: "Everyday Repair / Facilities", startingCostGold: 250, materialNeed: "light", mainProductOrService: "Item repair, tool repair, furniture repair", recurringDemand: ["object decay", "urgent repairs", "service contracts"], connectedBusinesses: ["weapons_tools", "biome_maintenance_repair", "hospitality_inn_hotel_shelter"], baseRevenuePerCycleGold: 45, upkeepPerCycleGold: 10, licenseLevelRequired: 1, serviceRadius: 10 },
  { businessType: "food_service_restaurant", displayName: "Food Service / Restaurant / Cook", category: "Food / Hospitality / Buffs", startingCostGold: 250, materialNeed: "heavy", mainProductOrService: "Meals, worker buff food, healing soups", recurringDemand: ["ingredient spoilage", "daily customers", "festival rushes"], connectedBusinesses: ["biome_farming_rare_foods", "hunter_wild_meat", "waste_sanitation_cleanup"], baseRevenuePerCycleGold: 52, upkeepPerCycleGold: 18, licenseLevelRequired: 1, serviceRadius: 10 },
  { businessType: "courier", displayName: "Courier", category: "Logistics / Trust Service", startingCostGold: 150, materialNeed: "light", mainProductOrService: "Mail, package, medicine, and food delivery", recurringDemand: ["delivery board refresh", "timed jobs", "business supply runs"], connectedBusinesses: ["general_trader", "medical_doctor", "portal_transit_company"], baseRevenuePerCycleGold: 35, upkeepPerCycleGold: 8, licenseLevelRequired: 1, serviceRadius: 22 },
  { businessType: "hospitality_inn_hotel_shelter", displayName: "Hospitality / Inn / Hotel / Shelter", category: "Housing / Tourism / Emergency Relief", startingCostGold: 700, materialNeed: "heavy", mainProductOrService: "Room rentals, shelter beds, meals", recurringDemand: ["occupancy", "cleaning", "guest food and safety"], connectedBusinesses: ["food_service_restaurant", "waste_sanitation_cleanup", "security_defense_contractor"], baseRevenuePerCycleGold: 100, upkeepPerCycleGold: 34, licenseLevelRequired: 2, serviceRadius: 12 },
] as const;

export function buildingSystemBusinessTypeByIdV1(type: string | undefined) {
  return BUILDING_SYSTEM_BUSINESS_TYPES_V1.find((entry) => entry.businessType === type);
}

export function createBuildingSystemMiraMapMarkerV1(nowMs: number): BuildingSystemInWorldMarkerV1 {
  return {
    markerId: "mira_grove_land_steward_map_marker",
    plotId: "the_grove",
    kind: "npc_map_marker",
    position: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.position,
    label: "Mira Thatch - Building System",
    createdAtMs: nowMs,
  };
}

export function createBuildingSystemStorageContainerV1(input: {
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  nowMs: number;
}): BuildingSystemStorageContainerRecordV1 {
  const origin = buildingSystemDefaultOriginV1(input.plot, input.blueprint);
  return {
    containerId: input.property.storageContainerId ?? `storage_${input.property.propertyId}`,
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

export function createBuildingSystemDoorLockV1(input: {
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  nowMs: number;
}): BuildingSystemDoorLockRecordV1 {
  const origin = buildingSystemDefaultOriginV1(input.plot, input.blueprint);
  return {
    lockId: input.property.doorLockId ?? `door_${input.property.propertyId}`,
    propertyId: input.property.propertyId,
    plotId: input.plot.plotId,
    ownerId: input.property.ownerId,
    position: [origin.x + Math.floor(input.blueprint.footprint.width / 2), origin.y + 1, origin.z],
    accessMode: input.property.accessMode,
    locked: input.property.accessMode !== "public",
    guildId: input.property.guildId,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  };
}

export function buildingSystemCanUseStorageContainerV1(input: {
  property: BuildingSystemPropertyRecordV1;
  container: BuildingSystemStorageContainerRecordV1;
  actorId: string;
  guildId?: string;
}) {
  return buildingSystemCanActorAccessPropertyV1({
    property: input.property,
    actorId: input.actorId,
    guildId: input.guildId,
    permission: "storage_access",
  });
}

export function buildingSystemCanOpenDoorLockV1(input: {
  property: BuildingSystemPropertyRecordV1;
  lock: BuildingSystemDoorLockRecordV1;
  actorId: string;
  guildId?: string;
}) {
  if (!input.lock.locked || input.property.accessMode === "public") {
    return true;
  }
  return buildingSystemCanActorAccessPropertyV1({
    property: input.property,
    actorId: input.actorId,
    guildId: input.guildId,
    permission: "storage_access",
  }) || buildingSystemCanActorAccessPropertyV1({
    property: input.property,
    actorId: input.actorId,
    guildId: input.guildId,
    permission: "build_edit",
  });
}

function replaceVoxelEditsV1(
  edits: BuildingSystemVoxelEditSpecV1[],
  value: BiomesId,
  label: BuildingSystemVoxelEditSpecV1["label"]
): BuildingSystemVoxelEditSpecV1[] {
  return edits.map((edit) => ({ ...edit, value, label }));
}

export function createBuildingSystemDemolitionMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const full = createBuildingSystemMaterializationPlanV1({
    requestId: input.requestId,
    actorId: input.actorId,
    plot: input.plot,
    blueprint: input.blueprint,
    activatedAtMs: input.activatedAtMs,
  });
  const markerDeletes = createBuildingSystemPlotMarkersV1({
    actorId: input.actorId,
    plot: input.plot,
    activatedAtMs: input.activatedAtMs,
  }).edits.filter((edit) => edit.label === "deed_marker" || edit.label === "map_marker");
  return {
    ...full,
    requestId: input.requestId,
    edits: replaceVoxelEditsV1([...full.edits, ...markerDeletes], BUILDING_BLOCKS_V1.air, "demolition_cleanup"),
    partialMaterialization: false,
    unlocksStorage: false,
  };
}

export function createBuildingSystemRepairDamageMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const { origin, x0, z0, y0, x1, z1, roofY } = buildingSystemGeometryBoundsV1(input.plot, input.blueprint);
  const edits: BuildingSystemVoxelEditSpecV1[] = [];
  edits.push({ kind: "editEvent", position: [x0, y0 + 1, z0], value: BUILDING_BLOCKS_V1.air, label: "repair_damage" });
  edits.push({ kind: "editEvent", position: [x1 - 1, y0 + 1, z1 - 1], value: BUILDING_BLOCKS_V1.air, label: "repair_damage" });
  edits.push({ kind: "editEvent", position: [x0 + 1, roofY, z0 + 1], value: BUILDING_BLOCKS_V1.air, label: "repair_damage" });
  return {
    version: BUILDING_SYSTEM_VERSION_V1,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    origin,
    rotationDegrees: 0,
    edits,
    placeGroup: { kind: "placeGroupEvent", name: `${input.property.propertyId} visible damage`, box: { v0: [x0, y0 - 1, z0], v1: [x1, roofY + 1, z1] }, reason: "building_blueprint_materialized" },
    partialMaterialization: true,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemRepairRestoreMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const full = createBuildingSystemMaterializationPlanV1({ requestId: input.requestId, actorId: input.actorId, plot: input.plot, blueprint: input.blueprint, activatedAtMs: input.activatedAtMs });
  return { ...full, edits: full.edits.filter((edit) => edit.label === "wall" || edit.label === "roof").slice(0, 12).map((edit) => ({ ...edit, label: "repair_restore" as const })), partialMaterialization: true };
}

export function createBuildingSystemUpgradeMaterializationPlanV1(input: {
  requestId: string;
  actorId: string;
  property: BuildingSystemPropertyRecordV1;
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  activatedAtMs: number;
}): BuildingSystemMaterializationPlanV1 {
  const { origin, x0, z0, y0, x1, z1, roofY } = buildingSystemGeometryBoundsV1(input.plot, input.blueprint);
  const edits: BuildingSystemVoxelEditSpecV1[] = [];
  const secondFloorY = roofY + 1;
  pushVoxelBox(edits, [x0, secondFloorY, z0], [x1, secondFloorY + 1, z1], BUILDING_BLOCKS_V1.upgradeWall, "upgrade_addition");
  pushVoxelBox(edits, [x0, secondFloorY + 1, z0], [x1, secondFloorY + 3, z0 + 1], BUILDING_BLOCKS_V1.wall, "upgrade_addition");
  pushVoxelBox(edits, [x0, secondFloorY + 3, z0], [x1, secondFloorY + 4, z1], BUILDING_BLOCKS_V1.roof, "upgrade_addition");
  return {
    version: BUILDING_SYSTEM_VERSION_V1,
    requestId: input.requestId,
    actorId: input.actorId,
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    structureTypeId: input.blueprint.structureTypeId,
    use: input.blueprint.use,
    origin,
    rotationDegrees: 0,
    edits,
    placeGroup: { kind: "placeGroupEvent", name: `${input.property.propertyId} tier upgrade`, box: { v0: [x0, y0 - 1, z0], v1: [x1, secondFloorY + 4, z1] }, reason: "building_blueprint_materialized" },
    partialMaterialization: true,
    materializesSolidVoxelBuilding: true,
  };
}

export function createBuildingSystemPlacementPreviewV1(input: {
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  origin?: { x: number; y: number; z: number };
  rotationDegrees?: 0 | 90 | 180 | 270;
  owned: boolean;
}): BuildingSystemPlacementPreviewV1 {
  const { origin, x0, y0, z0, x1, z1 } = buildingSystemGeometryBoundsV1(input.plot, input.blueprint, input.origin);
  const ghostFootprint: Array<[number, number, number]> = [];
  for (let x = x0; x < x1; x++) {
    ghostFootprint.push([x, y0, z0], [x, y0, z1 - 1]);
  }
  for (let z = z0 + 1; z < z1 - 1; z++) {
    ghostFootprint.push([x0, y0, z], [x1 - 1, y0, z]);
  }
  const warnings: string[] = [];
  if (!input.owned) warnings.push("preview_warning:plot_not_owned");
  if (x0 < input.plot.bounds.xMin || x1 > input.plot.bounds.xMax || z0 < input.plot.bounds.zMin || z1 > input.plot.bounds.zMax) {
    warnings.push("preview_warning:footprint_outside_plot");
  }
  return {
    plotId: input.plot.plotId,
    blueprintId: input.blueprint.blueprintId,
    origin,
    rotationDegrees: input.rotationDegrees ?? 0,
    boundaryOverlay: input.plot.bounds,
    ghostFootprint,
    requiredMaterials: BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.flatMap((stage) =>
      buildingSystemMaterialRequirementLinesV1({ blueprint: input.blueprint, stage })
    ),
    valid: warnings.length === 0,
    warnings,
  };
}

export function createBuildingSystemBusinessRecordV1(input: {
  businessId: string;
  ownerId: string;
  propertyId: string;
  businessType: BuildingSystemBusinessTypeV1;
  nowMs: number;
}): BuildingSystemBusinessRecordV1 {
  const def = buildingSystemBusinessTypeByIdV1(input.businessType);
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

export function runBuildingSystemBusinessRevenueCycleV1(input: {
  business: BuildingSystemBusinessRecordV1;
  nowMs: number;
  cycles?: number;
}) {
  const def = buildingSystemBusinessTypeByIdV1(input.business.type);
  const business = { ...input.business };
  const cycles = Math.max(1, Math.trunc(input.cycles ?? 1));
  const satisfactionMultiplier = Math.max(0.35, Math.min(1.75, business.customerSatisfaction / 50));
  const reputationMultiplier = Math.max(0.5, Math.min(2, 1 + business.reputation / 100));
  const gross = Math.floor((def?.baseRevenuePerCycleGold ?? 25) * cycles * satisfactionMultiplier * reputationMultiplier);
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

ensureBuildingSystemStructureDefinitionsV1();
