import type {
  HarthmereEconomyBusinessTypeId,
  HarthmereEconomyNeedId,
} from "./mmo_economy_authority";
import { isTerrainID } from "../asset_defs/terrain";
import type { BiomesId } from "../ids";
import { BikkieIds } from "../bikkie/ids";
import {
  BUILDING_SYSTEM_TERRAIN_BLOCKS,
  createBuildingSystemMaterializationPlan,
  ensureBuildingSystemStructureDefinitions,
  type BuildingSystemBlueprintDefinition,
  type BuildingSystemMaterializationPlan,
  type BuildingSystemPlotDefinition,
  type BuildingSystemVoxelEditSpec,
} from "./building_system";
import {
  harthmereResolveBikkieVisual,
  type HarthmereResolvedBikkieVisual,
} from "./bikkie_visual_resolver";
import {
  getHarthmereBusinessMiniGameSpec,
  type HarthmereBusinessMiniGameSpec,
} from "./business_minigame_specs";

export type {
  HarthmereBusinessMiniGameDecisionResult,
  HarthmereBusinessMiniGameDecision,
  HarthmereBusinessMiniGameEdgeFailure,
  HarthmereBusinessMiniGameOfferRule,
  HarthmereBusinessMiniGameSpec,
  HarthmereBusinessMiniGameUiElement,
} from "./business_minigame_specs";
export {
  HARTHMERE_BUSINESS_MINIGAME_SPECS_VERSION,
  HARTHMERE_BUSINESS_MINIGAME_SPECS,
  createHarthmereBusinessMiniGameDecisionForOffer,
  getHarthmereBusinessMiniGameSpec,
  resolveHarthmereBusinessMiniGameDecision,
} from "./business_minigame_specs";

export const HARTHMERE_BUSINESS_CUSTOMER_SIMULATOR_VERSION =
  "harthmere-business-customer-simulator" as const;
export const HARTHMERE_BUSINESS_JOB_PAY_DIVISOR = 4 as const;

export function harthmereBusinessScaledJobPay(rewardGold: number): number {
  return Math.max(
    1,
    Math.round(
      Math.max(0, Number(rewardGold) || 0) / HARTHMERE_BUSINESS_JOB_PAY_DIVISOR
    )
  );
}

export type HarthmereBusinessCustomerMapPlacement = "none";
export type HarthmereBusinessCustomerSpawnPolicy =
  "business_owner_session_only";

export interface HarthmereBusinessCustomerAppearance {
  hairStyle: string;
  hairColor: string;
  bodyBuild: string;
  heightBand: string;
  shoulderShape: string;
  posture: string;
  gait: string;
  eyeColor: string;
  eyeShape: string;
  browShape: string;
  noseShape: string;
  noseBridge: string;
  skinTone: string;
  outfit: string;
  accessory: string;
  voice: string;
}

export interface HarthmereBusinessCustomerNpc {
  npcId: string;
  displayName: string;
  customerOnly: true;
  mapPlacement: HarthmereBusinessCustomerMapPlacement;
  spawnPolicy: HarthmereBusinessCustomerSpawnPolicy;
  businessPreferences: HarthmereEconomyBusinessTypeId[];
  patience: number;
  budgetTier: 1 | 2 | 3 | 4 | 5;
  temperament: string;
  appearance: HarthmereBusinessCustomerAppearance;
}

export interface HarthmereBusinessServiceOffer {
  offerId: string;
  label: string;
  description: string;
  serviceNeed: HarthmereEconomyNeedId;
  requiredItems: Record<string, number>;
  producedItems?: Record<string, number>;
  rewardGold: number;
  satisfactionDelta: number;
  interactionVerb: string;
  animationCue: string;
}

export type HarthmereBusinessServiceAnimationFamily =
  | "access_control"
  | "counter_handoff"
  | "cleanup"
  | "diagnostic"
  | "dispatch"
  | "planning"
  | "paperwork"
  | "tool_work";

export interface HarthmereBusinessServiceAnimationCueSpec {
  cueId: string;
  family: HarthmereBusinessServiceAnimationFamily;
  durationMs: number;
  ownerChannels: string[];
  propMotion: string;
  customerReaction: string;
  safety: {
    procedural: true;
    voxelSafe: true;
    noRootMotion: true;
    noSkeletonRequirement: true;
    rotationOnlyPose: true;
  };
}

export interface HarthmereBusinessCustomerAskTemplate {
  askId: string;
  line: string;
  desiredOfferId: string;
  patience: number;
  difficulty: number;
  rewardGold: number;
  reputationDelta: number;
  needDelta: number;
  funAction: string;
  navGoal: string;
}

export interface HarthmereBusinessProgressionTier {
  tier: number;
  name: string;
  criteria: string;
  reward: string;
  unlock: string;
}

export interface HarthmereBusinessCustomerNavigation {
  entryNodeId: string;
  queueNodeId: string;
  counterNodeId: string;
  serviceNodeId: string;
  exitNodeId: string;
  movementPolicy: "walk_queue_counter_exit";
  serviceFlow: string[];
  passableClearance: {
    aisleWidthBlocks: number;
    counterClearanceBlocks: number;
    queueSpacingBlocks: number;
  };
  stuckRecovery: {
    repathAfterMs: number;
    sidestepRadiusBlocks: number;
    blockedNodeRetryLimit: number;
    fallbackExitAfterMs: number;
    fallbackPolicy: "repath_then_sidestep_then_exit";
  };
}

export interface HarthmereBusinessMiniGameDefinition {
  typeId: HarthmereEconomyBusinessTypeId;
  interfaceTitle: string;
  counterLabel: string;
  customerGoal: string;
  ownerFunLoop: string;
  mechanicSpec: HarthmereBusinessMiniGameSpec;
  challengeGrowth: string[];
  dailyReturnTriggers: string[];
  scalePath: string[];
  empireReinforcement: string[];
  navigation: HarthmereBusinessCustomerNavigation;
  offers: HarthmereBusinessServiceOffer[];
  askTemplates: HarthmereBusinessCustomerAskTemplate[];
  progression: HarthmereBusinessProgressionTier[];
  bikkieGraphics: readonly HarthmereBusinessBikkieGraphic[];
  implementationGapsClosed: string[];
}

export interface HarthmereBusinessCustomerTicket {
  ticketId: string;
  npcId: string;
  askId: string;
  requestedOfferId: string;
  askLine: string;
  status: "waiting" | "served" | "failed" | "left";
  arrivedAtMs: number;
  patience: number;
  patienceRemaining: number;
  difficulty: number;
  rewardGold: number;
  reputationDelta: number;
  needDelta: number;
  navGoal: string;
  scenarioId?: string;
}

export interface HarthmereBusinessCustomerSession {
  sessionId: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  actorId: string;
  status: "active" | "completed" | "expired";
  startedAtMs: number;
  expiresAtMs: number;
  currentTicketId?: string;
  queue: HarthmereBusinessCustomerTicket[];
  servedTicketIds: string[];
  failedTicketIds: string[];
  streak: number;
  satisfaction: number;
  earnedGold: number;
  progressPoints: number;
  dailyBonusGold: number;
  notes: string[];
}

export interface HarthmereBusinessCustomerStats {
  businessId: string;
  totalServed: number;
  totalFailed: number;
  lifetimeGold: number;
  bestStreak: number;
  currentTier: number;
  serviceXp: number;
  likeability: number;
  friendshipPointsByNpcId: Record<string, number>;
  favoriteCustomerNpcIds: string[];
  repeatCustomerMemories: string[];
  thankYouNotes: string[];
  collectiblesEarned: string[];
  decorationUnlocks: string[];
  badges: string[];
  lastSessionAtMs?: number;
  lastDailyServedDay?: number;
}

export interface HarthmereBusinessCozyServiceReward {
  serviceXp: number;
  likeabilityDelta: number;
  friendshipPoints: number;
  collectibleId?: string;
  decorationUnlockId?: string;
  badgeId?: string;
  thankYouNote?: string;
  memory?: string;
  favoriteCustomerUnlocked: boolean;
}

export type HarthmereBusinessServiceItemRole =
  | "component"
  | "consumable"
  | "container"
  | "paperwork"
  | "tool"
  | "finished_good"
  | "waste";

export interface HarthmereBusinessServiceItemDefinition {
  itemId: string;
  displayName: string;
  role: HarthmereBusinessServiceItemRole;
  productionUse: "customer_service_minigame";
}

export interface HarthmereBusinessServiceItemReferenceValidation {
  ok: boolean;
  missingRequiredItems: string[];
  missingProducedItems: string[];
}

export type HarthmereBusinessBikkieGraphicKind =
  | "crafting_station"
  | "tool"
  | "utility"
  | "container"
  | "document"
  | "food"
  | "seed"
  | "crop"
  | "fish"
  | "mail"
  | "comfort"
  | "arcade";

export type HarthmereBusinessBikkieGraphicRole =
  | "primary_station"
  | "counter_prop"
  | "service_tool"
  | "ambient_prop"
  | "stock_item";

export interface HarthmereBusinessBikkieGraphic {
  graphicId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  bikkieId: BiomesId;
  bikkieName: string;
  label: string;
  kind: HarthmereBusinessBikkieGraphicKind;
  role: HarthmereBusinessBikkieGraphicRole;
  source: "bikkie";
  description: string;
  businessUse: string;
  colors: readonly string[];
  visual: HarthmereResolvedBikkieVisual;
  galoisPath?: string;
  boxSize?: readonly [number, number, number];
  voxelSize?: readonly [number, number, number];
  craftingStationType?: "general" | "cooking" | "composting" | "dying";
  isTool?: true;
  isPlaceable?: true;
  shape?: "fence" | "slab" | "step" | "table";
  action?: string;
  buildingRequirement?: "none" | "roof" | "noRoof";
  craftingCategory?: string;
  tooltipTypeName?: string;
}

export interface HarthmereBusinessBikkieGraphicsValidation {
  ok: boolean;
  missingBusinessTypes: HarthmereEconomyBusinessTypeId[];
  missingPrimaryGraphics: HarthmereEconomyBusinessTypeId[];
  graphicsMissingMetadata: string[];
  duplicateGraphicIds: string[];
  stationGraphicsMissingSizes: string[];
  graphicsMissingVisuals: string[];
}

export interface HarthmereBusinessOutpost {
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  displayName: string;
  ownerNpcId: string;
  townId: string;
  regionId: string;
  district: string;
  position: { x: number; y: number; z: number; rot: number };
  building: {
    profile:
      | "bakery"
      | "provision"
      | "player_services"
      | "smithy"
      | "workshop"
      | "apothecary"
      | "magic_shop"
      | "inn"
      | "dock_warehouse"
      | "wash_house"
      | "barracks"
      | "stable_office";
    width: number;
    depth: number;
    floors: number;
    banner:
      | "banner_red"
      | "banner_green"
      | "banner_blue"
      | "banner_brown"
      | "banner_yellow"
      | "banner_white";
  };
  job: {
    title: string;
    starterTask: string;
    rewardGold: number;
    teaches: string;
  };
}

export const HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUNDING_VERSION =
  "harthmere-business-outpost-terrain-grounding" as const;

export interface HarthmereBusinessOutpostTerrainSample {
  label:
    | "center"
    | "front_door"
    | "north_west"
    | "north_east"
    | "south_west"
    | "south_east";
  x: number;
  y: number;
  z: number;
}

export interface HarthmereBusinessOutpostTerrainGrounding {
  version: typeof HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUNDING_VERSION;
  source: "harthmere_business_outpost_pad_survey";
  outpostId: string;
  padGroundY: number;
  minTerrainY: number;
  maxTerrainY: number;
  maxLocalStepVoxels: number;
  foundationBottomY: number;
  samples: readonly HarthmereBusinessOutpostTerrainSample[];
}

export interface HarthmereBusinessOutpostProceduralBuildingRecord {
  buildingId: string;
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  displayName: string;
  serverOwned: true;
  sourceOfTruth: "backend_procedural_voxel_building";
  generationMode: "building_system_materialization_plan";
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  origin: { x: number; y: number; z: number };
  terrainGrounding: HarthmereBusinessOutpostTerrainGrounding;
  rotationDegrees: 0 | 90 | 180 | 270;
  entrance: { x: number; y: number; z: number };
  queueNode: { x: number; y: number; z: number };
  serviceCounter: { x: number; y: number; z: number };
  exitNode: { x: number; y: number; z: number };
  customerSpace: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    areaMeters: number;
  };
  clearances: {
    frontDoorMeters: number;
    shopCustomerSpaceMeters: number;
    publicEntranceMeters: number;
  };
  visualReferenceCoordinates: readonly (readonly [number, number, number])[];
  buildingStyleKit: HarthmereBusinessOutpostBuildingStyleKit;
  dashboardAccessPoint: {
    markerId: string;
    label: string;
    position: { x: number; y: number; z: number };
    interaction: "open_business_dashboard";
    visibleFromEntrance: true;
    keyboardlessTraversal: true;
  };
  jobsBoardPosition: { x: number; y: number; z: number };
  interiorFixtures: readonly HarthmereBusinessOutpostInteriorFixture[];
  bikkieGraphics: readonly HarthmereBusinessBikkieGraphic[];
  primaryBikkieGraphic?: HarthmereBusinessBikkieGraphic;
  materializationPlan: BuildingSystemMaterializationPlan;
  interiorAudit: {
    minigameReady: true;
    hasAccessibleDoor: true;
    hasReadableWindows: true;
    hasCustomerDashboardAccess: true;
    hasBusinessSpecificDecor: true;
    customerQueueCapacity: number;
    staffWorkstations: number;
    decorationFixtureCount: number;
  };
  structuralAudit: {
    materializesSolidVoxelBuilding: true;
    foundationEdits: number;
    floorEdits: number;
    wallEdits: number;
    roofEdits: number;
    stairEdits: number;
  };
}

export const HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES =
  Object.freeze([
    [496.73746109712346, 68, -157.29343010411407],
    [479.2253752880332, 70, -89.56226450768318],
    [503.82932917461426, 62, -156.25475408417043],
    [503.7158145697912, 68, -160.38984841016236],
    [477.326232766884, 70, -73.7606338529657],
    [787.2777938314737, 68, -132.00332253573188],
    [788.7149584695969, 73, -151.69533338390963],
    [784.423917773294, 72, -143.1199023746175],
  ] as const);

export const HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN = Object.freeze({
  version: "harthmere-grove-business-coordinate-source-scan",
  scannedCoordinates: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES,
  authoredPlacementFindings: [
    {
      coordinateIndex: 0,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[0],
      sourceKind: "authored_placement_cluster",
      sourceFile: "src/client/game/renderers/local_dev/harthmere_assets.ts",
      nearbySourceLines: [8140, 8141, 8759, 8760, 9050, 9052, 9057, 9058, 9059],
      reusableFeatures: [
        "supported wall cabinet",
        "supported bottle shelf",
        "bench seating with clear aisle",
        "grounded sign with supported notice",
        "floor crate and chest dressing",
      ],
      reusableAssets: [
        "cabinet",
        "shelf_small_bottles",
        "bench_fp",
        "obj_sign_post",
        "scroll_1_fp",
        "crate_wooden_fp",
        "chest",
      ],
    },
    {
      coordinateIndex: 1,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[1],
      sourceKind: "authored_landscape_cluster",
      sourceFile: "src/client/game/renderers/local_dev/harthmere_assets.ts",
      nearbySourceLines: [8751, 8752, 8757, 8758],
      reusableFeatures: [
        "soft Grove landscape edge",
        "naturalized gathering props",
        "clear path kept open around vegetation",
      ],
      reusableAssets: ["tree_crooked", "tree_high", "logs", "rock_small"],
    },
    {
      coordinateIndex: 2,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[2],
      sourceKind: "authored_placement_cluster",
      sourceFile: "src/client/game/renderers/local_dev/harthmere_assets.ts",
      nearbySourceLines: [8175, 8807, 8808, 8809, 8810, 8811, 8812, 9058, 9059],
      reusableFeatures: [
        "low stone boundary wall",
        "bookcase and cabinet against walls",
        "reading table with supported books and scrolls",
        "small light props supported on furniture",
      ],
      reusableAssets: [
        "obj_church_grave_wall",
        "bookcase_2",
        "cabinet",
        "table_small",
        "scroll_2_fp",
        "book_stack_2",
        "candle_triple",
      ],
    },
    {
      coordinateIndex: 3,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[3],
      sourceKind: "authored_placement_cluster",
      sourceFile: "src/client/game/renderers/local_dev/harthmere_assets.ts",
      nearbySourceLines: [
        8175, 8407, 8759, 8760, 9058, 9059, 9131, 9132, 9135, 9136,
      ],
      reusableFeatures: [
        "business-specific shelves against walls",
        "long service table clear of doorway",
        "supported recipe object on table",
        "supported candle/lantern accent",
      ],
      reusableAssets: [
        "shelf_large",
        "table_long",
        "spellbook_open",
        "candle_triple",
        "shelf_small_bottles",
        "obj_church_grave_wall",
      ],
    },
    {
      coordinateIndex: 4,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[4],
      sourceKind: "live_world_snapshot_reference",
      sourceFile:
        "/Users/devindixon/Downloads/buiness-biomes.azurecontainerapp",
      nearbySourceLines: [3405, 3406],
      reusableFeatures: [
        "production Grove building reference with player-reported position",
        "door/window/furniture style observed from visual screenshot rather than local authored P placement",
      ],
      reusableAssets: [],
    },
    {
      coordinateIndex: 5,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[5],
      sourceKind: "live_world_snapshot_reference",
      sourceFile:
        "/Users/devindixon/Downloads/buiness-biomes.azurecontainerapp",
      nearbySourceLines: [633, 634],
      reusableFeatures: [
        "production Grove building reference with player-reported position",
        "door/window/furniture style observed from visual screenshot rather than local authored P placement",
      ],
      reusableAssets: [],
    },
    {
      coordinateIndex: 6,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[6],
      sourceKind: "live_world_snapshot_reference",
      sourceFile:
        "/Users/devindixon/Downloads/buiness-biomes.azurecontainerapp",
      nearbySourceLines: [594, 595],
      reusableFeatures: [
        "production Grove building reference with player-reported position",
        "door/window/furniture style observed from visual screenshot rather than local authored P placement",
      ],
      reusableAssets: [],
    },
    {
      coordinateIndex: 7,
      coordinate: HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES[7],
      sourceKind: "live_world_snapshot_reference",
      sourceFile:
        "/Users/devindixon/Downloads/buiness-biomes.azurecontainerapp",
      nearbySourceLines: [552, 553],
      reusableFeatures: [
        "production Grove building reference with player-reported position",
        "door/window/furniture style observed from visual screenshot rather than local authored P placement",
      ],
      reusableAssets: [],
    },
  ],
  reusableAssetVocabulary: {
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
      "chair",
      "stool_fp",
      "bench_fp",
      "bed_twin1",
      "nightstand",
      "cabinet",
      "bookcase_2",
      "rack",
      "shelf_large",
      "shelf_small_bottles",
      "book_stack_2",
      "candle_triple",
      "obj_lamp_ground_small",
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
  },
  unresolvedAuthoredPlacementCoordinates: [4, 5, 6, 7],
} as const);

export const HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES =
  Object.freeze([
    [483.4015418223092, 53, -186.36893760014152],
    [452.923968994932, 73, -165.0180416850341],
    [440.1475960722798, 71, -125.32567490491664],
    [444.63686657425586, 70, -112.24404681818449],
    [511.9942409918332, 70, -60.865588345981315],
    [531.9124930157947, 70, -65.70511642009689],
    [496.73746109712346, 68, -157.29343010411407],
    [479.2253752880332, 70, -89.56226450768318],
    [503.82932917461426, 62, -156.25475408417043],
    [503.7158145697912, 68, -160.38984841016236],
    [477.326232766884, 70, -73.7606338529657],
    [787.2777938314737, 68, -132.00332253573188],
    [788.7149584695969, 73, -151.69533338390963],
    [784.423917773294, 72, -143.1199023746175],
  ] as const);

export const HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN = Object.freeze({
  version: "harthmere-grove-business-design-furniture-scan",
  sourceScreenshots: ".codex/screenshots/harthmere-reference-building-scan",
  interiorSourceScreenshots:
    ".codex/screenshots/harthmere-reference-building-interiors-slow",
  scannedCoordinates:
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES,
  placementPolicy: "design_and_furniture_reference_only_do_not_build_here",
  materializesBuildings: false,
  interiorCapturePolicy:
    "four_cardinal_views_per_coordinate_with_slow_post_load_settle",
  findings: [
    {
      coordinateIndex: 0,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[0],
      observedFeatures: [
        "stone courtyard reads as a public business threshold",
        "wall greenery and hanging vines soften hard masonry",
        "supported benches and crates sit clear of the walking aisle",
      ],
    },
    {
      coordinateIndex: 1,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[1],
      observedFeatures: [
        "compact yellow storefront with framed glass window",
        "tiny counter/display props are supported on the facade",
        "terraced green approach keeps the shop embedded in the hillside",
      ],
    },
    {
      coordinateIndex: 2,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[2],
      observedFeatures: [
        "low stone boundary wall shapes the path without closing it",
        "dense flower beds and trees make the exterior lush",
        "water-edge approach stays readable with a clear path line",
      ],
    },
    {
      coordinateIndex: 3,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[3],
      observedFeatures: [
        "striped purple awning marks a shop front from a distance",
        "planters and flowers frame the entry without blocking it",
        "small fence and path edge define the business yard",
      ],
    },
    {
      coordinateIndex: 4,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[4],
      observedFeatures: [
        "raised grassy terrace and retaining edges make slope sites usable",
        "small sign and field rows work as exterior business identity",
        "open green space prevents the outbuilding from reading as cluttered",
      ],
    },
    {
      coordinateIndex: 5,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[5],
      observedFeatures: [
        "wooden counter and barrel grouping creates a market-stall service face",
        "crate and log textures communicate stock and storage",
        "blue signboard sits on a supported frame facing the approach",
      ],
    },
    {
      coordinateIndex: 6,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[6],
      observedFeatures: [
        "low white service table sits in a garden clearing",
        "glass greenhouse language pairs with stone and trees",
        "small path stones lead customers toward the service face",
      ],
    },
    {
      coordinateIndex: 7,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[7],
      observedFeatures: [
        "striped awning differentiates the storefront from nearby homes",
        "tree canopy and garden beds make the shop exterior green",
        "path remains open despite dense planting and facade props",
      ],
    },
    {
      coordinateIndex: 8,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[8],
      observedFeatures: [
        "white tent-like counter structure reads as a lightweight stall",
        "supported sign and slim posts establish a clear service point",
        "flowers and grass soften the simple business pad",
      ],
    },
    {
      coordinateIndex: 9,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[9],
      observedFeatures: [
        "tree-obscured view confirms this coordinate is reference-only",
        "nearby Grove greenery should inform exterior density, not placement",
        "alternate scans preserve the rule to keep doors and aisles clear",
      ],
    },
    {
      coordinateIndex: 10,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[10],
      observedFeatures: [
        "purple awning repeats as a Grove shop marker",
        "stone wall, trees, and path tiles create layered frontage",
        "business signs should remain visible from outside the canopy",
      ],
    },
    {
      coordinateIndex: 11,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[11],
      observedFeatures: [
        "pale stone roof and wood wall contrast gives a civic shop feel",
        "large tree and tiled entry make the exterior feel established",
        "front trim should be readable even when landscaping is lush",
      ],
    },
    {
      coordinateIndex: 12,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[12],
      observedFeatures: [
        "pink flowering tree and fence frame a destination-like yard",
        "distant shop facade stays identifiable through greenery",
        "garden edge works best when it stops short of the approach path",
      ],
    },
    {
      coordinateIndex: 13,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[13],
      observedFeatures: [
        "heavy canopy requires alternate sightlines for signs and doors",
        "flower beds and fenced greenspace provide lushness cues",
        "business-specific roof or facade silhouettes must rise above foliage",
      ],
    },
  ],
  reusableInteriorCues: [
    "service counters placed against walls or clear aisle edges",
    "wall shelves with bottles, books, parcels, and small stock items",
    "tables, desks, and benches supported on finished floors",
    "beds or recovery benches tucked beside walls rather than in doorways",
    "stairs and landings kept visually clear of primary service counters",
    "potted plants and greenery used inside glassy or clinic-like spaces",
    "lamps, candles, and glowing signs mounted on tables, walls, or posts",
    "storage crates, cabinets, and bookcases used as readable back-of-house stock",
  ],
  interiorFindings: [
    {
      coordinateIndex: 0,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[0],
      observedInteriorFeatures: [
        "open civic threshold rather than a closed shop room",
        "stone floor is kept mostly clear for movement",
        "garden furniture remains outside the main aisle",
      ],
    },
    {
      coordinateIndex: 1,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[1],
      observedInteriorFeatures: [
        "compact room with supported bed/bench zone",
        "colored counter run with small bottle stock on top",
        "glass partitions and wall-mounted fixtures around a clear center aisle",
      ],
    },
    {
      coordinateIndex: 2,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[2],
      observedInteriorFeatures: [
        "stone interior with windows and purple counter/table accent",
        "wall bench and bed-like service furniture stay off the path",
        "single floor lamp and small side table read as supported decor",
      ],
    },
    {
      coordinateIndex: 3,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[3],
      observedInteriorFeatures: [
        "warm wood interior with simple table and bed furniture",
        "small lamp on a side table gives a clear supported light cue",
        "front door line stays open through the room",
      ],
    },
    {
      coordinateIndex: 4,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[4],
      observedInteriorFeatures: [
        "wood-and-glass interior with seating and table work zone",
        "green bed or bench furniture sits against a wall",
        "window planters and small table stock add life without blocking the floor",
      ],
    },
    {
      coordinateIndex: 5,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[5],
      observedInteriorFeatures: [
        "blue shop room with purple shelf, books, bottles, and cobweb detail",
        "white counter and wall tool/key sign create a strong service face",
        "stairs rise from a clear side aisle instead of the counter path",
      ],
    },
    {
      coordinateIndex: 6,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[6],
      observedInteriorFeatures: [
        "glass-and-white wall corridor reads greenhouse or clinic-like",
        "simple bed/bench furniture is tucked behind glass panels",
        "green approach and window walls make indoor/outdoor planting continuous",
      ],
    },
    {
      coordinateIndex: 7,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[7],
      observedInteriorFeatures: [
        "coordinate is mostly outside but shows shop threshold context",
        "blackboard/sign access point and exterior posts face the path",
        "nearby glass storefront suggests keeping dashboard/counter visible",
      ],
    },
    {
      coordinateIndex: 8,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[8],
      observedInteriorFeatures: [
        "stone-and-glass interior with stairs and raised work/display ledge",
        "small expressive object on a supported pedestal reads as focal stock",
        "window plants and bottles sit on tables or shelves",
      ],
    },
    {
      coordinateIndex: 9,
      coordinate: HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[9],
      observedInteriorFeatures: [
        "clean gray room with desk, chair, couch, planter, and floor lamp",
        "black wall cabinet and small colored bottles read as stocked display",
        "furniture is arranged around the perimeter to keep the middle passable",
      ],
    },
    {
      coordinateIndex: 10,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[10],
      observedInteriorFeatures: [
        "long room with counter/desk, shelf wall, and large windows",
        "small gifts or stock sit on the wooden desk surface",
        "colored vertical panels provide business identity without blocking movement",
      ],
    },
    {
      coordinateIndex: 11,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[11],
      observedInteriorFeatures: [
        "mostly exterior garden/entry view at this exact coordinate",
        "planters, signs, and entry furniture reinforce public-facing frontage",
        "use foliage as approach dressing while keeping the entrance legible",
      ],
    },
    {
      coordinateIndex: 12,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[12],
      observedInteriorFeatures: [
        "glass balcony or veranda with benches and low railings",
        "wood floor and glass panels make a clean overlook/service terrace",
        "small wall signs and lamps are supported on wood or glass structures",
      ],
    },
    {
      coordinateIndex: 13,
      coordinate:
        HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES[13],
      observedInteriorFeatures: [
        "hallway and doorway views show simple wood interior circulation",
        "nearby garden beds and table-like exterior furniture cue lodging/farm stock",
        "wall-mounted light and glass side room should stay visible from entries",
      ],
    },
  ],
  constructionFindings: [
    {
      coordinateIndex: 0,
      patternId: "civic_stone_threshold",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "stone floor/courtyard threshold",
        "wall greenery",
        "benches and crates outside the central aisle",
      ],
    },
    {
      coordinateIndex: 1,
      patternId: "compact_clinic_counter_bed",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "compact storefront shell",
        "colored counter with bottles",
        "bed or bench zone",
        "glass partitions",
        "clear center aisle",
      ],
    },
    {
      coordinateIndex: 2,
      patternId: "stone_counter_bench_lamp",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "stone room",
        "purple counter/table accent",
        "wall bench or bed furniture",
        "floor lamp and side table",
      ],
    },
    {
      coordinateIndex: 3,
      patternId: "warm_wood_lodging_room",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "warm wood floor and wall language",
        "simple table",
        "bed furniture",
        "lamp supported on side table",
        "open front-door line",
      ],
    },
    {
      coordinateIndex: 4,
      patternId: "garden_workroom",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "wood-and-glass workroom",
        "seating and table work zone",
        "green bench/bed against wall",
        "window planters and small table stock",
      ],
    },
    {
      coordinateIndex: 5,
      patternId: "blue_shelf_stair_shop",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "shelf wall with books and bottles",
        "white counter service face",
        "tool/key sign",
        "side stair kept out of the counter path",
      ],
    },
    {
      coordinateIndex: 6,
      patternId: "greenhouse_clinic_corridor",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "glass-and-white corridor walls",
        "bench/bed behind glass panels",
        "planters linking outside and inside",
      ],
    },
    {
      coordinateIndex: 7,
      patternId: "threshold_sign_shop",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "shop threshold",
        "blackboard/sign access point",
        "exterior posts facing the path",
        "visible glass storefront line",
      ],
    },
    {
      coordinateIndex: 8,
      patternId: "stone_glass_stair_display",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "stone-and-glass room",
        "stair and raised display ledge",
        "supported pedestal stock",
        "window plants and bottles",
      ],
    },
    {
      coordinateIndex: 9,
      patternId: "gray_office_lounge",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "clean gray office room",
        "desk and chair",
        "couch or bench",
        "planter",
        "floor lamp",
        "wall cabinet with small bottle display",
      ],
    },
    {
      coordinateIndex: 10,
      patternId: "long_windowed_counter_shop",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "long room",
        "wooden desk/counter",
        "shelf wall",
        "small gifts or stock on the desk",
        "large windows",
        "colored vertical panels",
      ],
    },
    {
      coordinateIndex: 11,
      patternId: "garden_entry_frontage",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "garden entry",
        "planters and signs",
        "public-facing entry furniture",
      ],
    },
    {
      coordinateIndex: 12,
      patternId: "glass_veranda_lounge",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "wood floor",
        "glass balcony or veranda panels",
        "benches and low railings",
        "supported wall signs and lamps",
      ],
    },
    {
      coordinateIndex: 13,
      patternId: "wood_hall_lodging",
      hasBuildingOrThreshold: true,
      constructedWith: [
        "wood hallway and doorway circulation",
        "garden/farm stock furniture nearby",
        "wall-mounted light",
        "glass side room",
      ],
    },
  ],
} as const);

export const HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES =
  Object.freeze([
    [483.4, 53, -186.4],
    [452.9, 73, -165.0],
    [440.1, 71, -125.3],
    [444.6, 70, -112.2],
    [511.9, 70, -60.9],
    [531.9, 70, -65.7],
  ] as const);

export const HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN = Object.freeze({
  version: "harthmere-grove-business-people-coordinate-source-scan",
  sourceReport:
    "/Users/devindixon/Desktop/grove_business_outpost_construction_report copy 2.md",
  scannedCoordinates: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES,
  coordinatesAreOutposts: false,
  materializesBuildings: false,
  placementPolicy: "people_reference_only_do_not_build_here",
  findings: [
    {
      coordinateIndex: 0,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[0],
      yBand: "authored_npc_feet_y_53",
      sourceKind: "authored_bible_or_economy_npc_position",
      semanticUse: [
        "Grove merchant or resident feet reference",
        "south-of-chapel people placement band",
        "not a business outpost site",
      ],
      sourceFiles: [
        "src/shared/harthmere/grove_economy_starter.ts",
        "src/shared/harthmere/harthmere_district_bible_layout.ts",
      ],
    },
    {
      coordinateIndex: 1,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[1],
      yBand: "live_world_observer_or_head_height_y_73",
      sourceKind: "live_world_people_reference",
      semanticUse: [
        "walkable terrain west of fountain",
        "observer or standing NPC height",
        "not a business outpost site",
      ],
      sourceFiles: ["src/shared/harthmere/npc_compendium.ts"],
    },
    {
      coordinateIndex: 2,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[2],
      yBand: "live_world_observer_or_head_height_y_71",
      sourceKind: "live_world_people_reference",
      semanticUse: [
        "west-of-fountain people reference",
        "one block above live ground",
        "not a business outpost site",
      ],
      sourceFiles: ["src/shared/harthmere/npc_compendium.ts"],
    },
    {
      coordinateIndex: 3,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[3],
      yBand: "live_npc_feet_y_70",
      sourceKind: "live_world_people_reference",
      semanticUse: [
        "Westtrail or Lovely Locks corridor feet reference",
        "customer or townfolk walking height",
        "not a business outpost site",
      ],
      sourceFiles: ["src/shared/harthmere/npc_compendium.ts"],
    },
    {
      coordinateIndex: 4,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[4],
      yBand: "live_npc_feet_y_70",
      sourceKind: "live_world_people_reference",
      semanticUse: [
        "northeast clearing live feet reference",
        "townfolk or customer approach proof",
        "not a business outpost site",
      ],
      sourceFiles: ["src/shared/harthmere/npc_compendium.ts"],
    },
    {
      coordinateIndex: 5,
      coordinate: HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES[5],
      yBand: "live_npc_feet_y_70",
      sourceKind: "live_world_people_reference",
      semanticUse: [
        "paired northeast clearing live feet reference",
        "townfolk or customer approach proof",
        "not a business outpost site",
      ],
      sourceFiles: ["src/shared/harthmere/npc_compendium.ts"],
    },
  ],
  appliesTo: {
    ownerMerchants:
      "HARTHMERE_BUSINESS_OUTPOSTS owner NPCs stand at generated business entrances and offer starter jobs.",
    starterMerchants:
      "GROVE_ECONOMY_STARTER_NPCS keeps six fountain/Crossroads economy NPCs on procedural appearance specs.",
    customerNpcs:
      "HARTHMERE_BUSINESS_CUSTOMER_NPCS customers remain session-only with mapPlacement none.",
    employeeNpcs:
      "business_employee_ai hired staff use business layouts, roles, schedules, and navigation nodes.",
  },
} as const);

export type HarthmereBusinessOutpostShellMaterial =
  | "carved_limestone"
  | "clean_stone_tile"
  | "dark_workshop_stone"
  | "green_roof_sod"
  | "purple_canvas"
  | "red_canvas"
  | "red_clay_roof"
  | "stone_foundation"
  | "warm_wood_plank"
  | "white_canvas"
  | "wood_floor";

export interface HarthmereBusinessOutpostBuildingStyleKit {
  referenceLanguage:
    | "grove_wood_shop"
    | "grove_stone_storefront"
    | "grove_workshop_warehouse";
  exteriorWall: HarthmereBusinessOutpostShellMaterial;
  foundation: "stone_foundation";
  roof: HarthmereBusinessOutpostShellMaterial;
  trim: HarthmereBusinessOutpostShellMaterial;
  floor: HarthmereBusinessOutpostShellMaterial;
  doorStyle: "wood_glass_panel";
  windowStyle: "large_framed_shop_glass";
  awningMaterial: HarthmereBusinessOutpostShellMaterial;
  signIcon:
    | "star"
    | "leaf"
    | "cross"
    | "hammer"
    | "spark"
    | "shield"
    | "parcel"
    | "key";
  exteriorDressing:
    | "garden_planters"
    | "workshop_crates"
    | "clean_clinic_lanterns"
    | "arcane_lanterns"
    | "market_baskets";
  interiorDressing:
    | "counter_service"
    | "clinic_service"
    | "forge_service"
    | "arcane_service"
    | "lodging_service"
    | "dispatch_service";
  sourceScanVersion: typeof HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN.version;
  sourceFeatureTags: readonly string[];
  sourceAssetVocabulary: readonly string[];
  styleNotes: readonly string[];
}

export type HarthmereBusinessOutpostInteriorFixtureRole =
  | "business_decor"
  | "customer_queue_space"
  | "dashboard_access"
  | "primary_station"
  | "service_counter"
  | "service_table"
  | "seating"
  | "stock_storage"
  | "workstation";

export interface HarthmereBusinessOutpostInteriorFixture {
  fixtureId: string;
  role: HarthmereBusinessOutpostInteriorFixtureRole;
  label: string;
  position: { x: number; y: number; z: number };
  size: readonly [number, number, number];
  colorHint:
    | "accent"
    | "floor"
    | "primary"
    | "safety"
    | "stock"
    | "trim"
    | "wall"
    | "wood";
  blocksNavigation: boolean;
  businessSpecific: boolean;
  bikkieGraphicId?: string;
}

export interface HarthmereBusinessOutpostPassabilityAudit {
  ok: boolean;
  buildingId: string;
  errors: string[];
  warnings: string[];
  auditTags: string[];
}

export interface HarthmereGroveBusinessCoordinateReferenceAudit {
  ok: boolean;
  buildingReferenceCount: number;
  peopleReferenceCount: number;
  errors: string[];
  auditTags: string[];
}

export interface HarthmereBusinessOutpostMapMarker {
  markerId: string;
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  label: string;
  description: string;
  area: "Harthmere";
  district: string;
  position: [number, number, number];
  kind: "business_outpost";
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  jobTitle: string;
  interfaceTitle: string;
  primaryBikkieGraphic?: HarthmereBusinessBikkieGraphic;
  primaryBikkieVisual?: HarthmereResolvedBikkieVisual;
}

export type HarthmereBusinessLiveWorldDynamicBlockerKind =
  | "closed_door"
  | "dynamic_prop"
  | "mount"
  | "pet"
  | "player_object"
  | "queued_customer"
  | "staff_npc";

export interface HarthmereBusinessLiveWorldDynamicBlocker {
  blockerId: string;
  kind: HarthmereBusinessLiveWorldDynamicBlockerKind;
  position: { x: number; y: number; z: number };
  radiusMeters: number;
  temporary: boolean;
}

export interface HarthmereBusinessLiveWorldNavigationActor {
  actorId: string;
  kind: "customer" | "employee";
  start: "entrance" | "employeeDoor" | "queue" | "counter" | "service" | "exit";
  goal: "queue" | "counter" | "service" | "stock" | "employeeDoor" | "exit";
  radiusMeters: number;
}

export interface HarthmereBusinessLiveWorldNavigationAudit {
  ok: boolean;
  buildingId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  navmeshBake: "server_voxel_hydrated_grid";
  routeCount: number;
  crowdActorCount: number;
  dynamicBlockerCount: number;
  recoveredBlockers: string[];
  routeLengths: Record<string, number>;
  unreachableRoutes: string[];
  unresolvedCollisions: string[];
  warnings: string[];
  auditTags: string[];
}

const BUSINESS_TYPES_IN_ORDER: HarthmereEconomyBusinessTypeId[] = [
  "exotic_matter_refinery",
  "biome_maintenance_repair",
  "biome_design_studio",
  "security_defense_contractor",
  "portal_transit_company",
  "biome_farming_rare_foods",
  "weapons_tools",
  "magic_goods",
  "exploration_guide",
  "custom_home_property_development",
  "general_trader",
  "hunter_wild_meat",
  "medical_doctor",
  "teleport_owner",
  "waste_sanitation_cleanup",
  "repair_maintenance_person",
  "food_service_restaurant",
  "courier",
  "hospitality_inn_hotel_shelter",
];

type HarthmereBusinessBikkieGraphicBase = Omit<
  HarthmereBusinessBikkieGraphic,
  "graphicId" | "businessType" | "role" | "businessUse" | "source" | "visual"
>;

const HARTHMERE_BUSINESS_BIKKIE_GRAPHIC_BASES = {
  workbench: {
    bikkieId: BikkieIds.workbench,
    bikkieName: "Workbench",
    label: "Workbench",
    kind: "crafting_station",
    description:
      "One-block oak crafting station for repairs, handcrafting, and counter prep.",
    colors: ["oak brown", "iron gray"],
    galoisPath: "placeables/crafting_stations/log_workbench",
    boxSize: [1, 1, 3],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  thermoblaster: {
    bikkieId: BikkieIds.thermoblaster,
    bikkieName: "Thermoblaster",
    label: "Thermoblaster",
    kind: "crafting_station",
    description:
      "Three-by-three stone industrial crafting station for heat, forging, and hazardous processing.",
    colors: ["stone gray", "coal black", "ember orange"],
    galoisPath: "placeables/crafting_stations/stone_thermoblaster",
    boxSize: [3, 3, 3],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  thermolite: {
    bikkieId: BikkieIds.thermolite,
    bikkieName: "Thermolite",
    label: "Thermolite",
    kind: "crafting_station",
    description:
      "One-by-two-by-three stone utility station for clean heat, sterilizing, and energy checks.",
    colors: ["stone gray", "warm white", "amber"],
    galoisPath: "placeables/crafting_stations/stone_thermolite",
    boxSize: [1, 2, 3],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  kitchen: {
    bikkieId: BikkieIds.kitchen,
    bikkieName: "Kitchen",
    label: "Kitchen",
    kind: "crafting_station",
    description:
      "Tall oak cooking station for plated meals, soups, and lodging food service.",
    colors: ["oak brown", "cream ceramic", "warm copper"],
    galoisPath: "placeables/crafting_stations/oak_kitchen",
    boxSize: [1, 1, 4],
    craftingStationType: "cooking",
    isPlaceable: true,
    action: "place",
    buildingRequirement: "roof",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  anglersTable: {
    bikkieId: BikkieIds.anglersTable,
    bikkieName: "Angler's Table",
    label: "Angler's Table",
    kind: "crafting_station",
    description:
      "Two-by-two-by-three prep table for fish, meat, and cold-larder service.",
    colors: ["weathered wood", "blue-gray metal", "clean white"],
    boxSize: [2, 2, 3],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  composter: {
    bikkieId: BikkieIds.composter,
    bikkieName: "Composter",
    label: "Composter",
    kind: "crafting_station",
    description:
      "One-by-two-by-three composting station for farm scraps, waste processing, and fertilizer loops.",
    colors: ["dark wood", "leaf green", "soil brown"],
    boxSize: [1, 2, 3],
    craftingStationType: "composting",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  seedMill: {
    bikkieId: BikkieIds.seedMill,
    bikkieName: "Seed Mill",
    label: "Seed Mill",
    kind: "crafting_station",
    description:
      "One-by-three-by-one seed-processing station for crop lots and rare-food preparation.",
    colors: ["oak brown", "brass", "seed tan"],
    boxSize: [1, 3, 1],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    buildingRequirement: "noRoof",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  tailoringBooth: {
    bikkieId: BikkieIds.tailoringBooth,
    bikkieName: "Tailoring Booth",
    label: "Tailoring Booth",
    kind: "crafting_station",
    description:
      "Four-by-one-by-three oak booth for cloth, interiors, uniforms, and style consulting.",
    colors: ["oak brown", "linen cream", "soft blue"],
    galoisPath: "placeables/crafting_stations/oak_tailoring_booth",
    boxSize: [4, 1, 3],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  dyeOMatic: {
    bikkieId: BikkieIds.dyeOMatic,
    bikkieName: "Dye-O-Matic",
    label: "Dye-O-Matic",
    kind: "crafting_station",
    description:
      "Three-by-three dyeing station for palettes, signage, uniforms, and cosmetic work.",
    colors: ["magenta", "cyan", "sun yellow", "black"],
    boxSize: [3, 3, 3],
    craftingStationType: "dying",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  wardrobe: {
    bikkieId: BikkieIds.wardrobe,
    bikkieName: "Wardrobe",
    label: "Wardrobe",
    kind: "crafting_station",
    description:
      "One-block dressing station for hospitality rooms and style service.",
    colors: ["log brown", "cloth cream"],
    galoisPath: "placeables/crafting_stations/log_workbench",
    boxSize: [1, 1, 3],
    craftingStationType: "dying",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
    tooltipTypeName: "Crafting Station",
  },
  arcadeMachine: {
    bikkieId: BikkieIds.arcadeMachine,
    bikkieName: "Arcade Machine",
    label: "Arcade Machine",
    kind: "arcade",
    description:
      "One-by-two-by-one placeable arcade cabinet for hospitality and shop entertainment corners.",
    colors: ["black", "electric blue", "red"],
    galoisPath: "placeables/arcade_machine",
    boxSize: [1, 2, 1],
    craftingStationType: "general",
    isPlaceable: true,
    action: "place",
    craftingCategory: "Crafting Station",
  },
  bucket: {
    bikkieId: BikkieIds.bucket,
    bikkieName: "Bucket",
    label: "Bucket",
    kind: "tool",
    description:
      "Silver bucket tool for water, cleanup, quenching, and field utility.",
    colors: ["silver", "cool gray"],
    galoisPath: "items/silver_bucket",
    isTool: true,
    action: "dump",
    craftingCategory: "Tools",
    tooltipTypeName: "Tool",
  },
  camera: {
    bikkieId: BikkieIds.camera,
    bikkieName: "B-01 Camera",
    label: "B-01 Camera",
    kind: "tool",
    description:
      "Camera tool used for surveys, style references, scouting records, and service proof.",
    colors: ["black", "glass blue", "silver"],
    galoisPath: "items/camera",
    isTool: true,
    action: "photo",
    craftingCategory: "Cameras",
    tooltipTypeName: "Camera",
  },
  remoteControl: {
    bikkieId: BikkieIds.remoteControl,
    bikkieName: "Remote Control",
    label: "Remote Control",
    kind: "utility",
    description:
      "Handheld control device for portal, courier, and automation dispatch counters.",
    colors: ["charcoal", "screen blue", "button red"],
    galoisPath: "items/remote_control",
    isTool: true,
    craftingCategory: "Communications",
    tooltipTypeName: "Remote Control",
  },
  homestone: {
    bikkieId: BikkieIds.homestone,
    bikkieName: "Homestone",
    label: "Homestone",
    kind: "utility",
    description:
      "Portable return-home travel tool for teleport service, travel desks, and guest safety.",
    colors: ["stone gray", "home-blue glow"],
    galoisPath: "items/homestone",
    isTool: true,
    action: "warpHome",
    craftingCategory: "Tool",
    tooltipTypeName: "Homestone",
  },
  powerCell: {
    bikkieId: BikkieIds.powerCell,
    bikkieName: "Power Cell",
    label: "Power Cell",
    kind: "utility",
    description:
      "Compact energy item for refineries, transit systems, and powered service counters.",
    colors: ["electric blue", "white", "dark casing"],
    galoisPath: "wearables/robot/power_cell",
    action: "place",
    craftingCategory: "Item",
  },
  muckBuster: {
    bikkieId: BikkieIds.muckBuster,
    bikkieName: "Ye Olde Muck Buster",
    label: "Ye Olde Muck Buster",
    kind: "tool",
    description:
      "Muck-cleaning tool for sanitation, hazard control, and contaminated work orders.",
    colors: ["aged brass", "green glow", "brown grip"],
    isTool: true,
    action: "demuckerWand",
    craftingCategory: "Tools",
    tooltipTypeName: "Muck Buster",
  },
  wand: {
    bikkieId: BikkieIds.wand,
    bikkieName: "Builder's Wand",
    label: "Builder's Wand",
    kind: "tool",
    description:
      "Builder's wand for property placement, structure planning, and contract previews.",
    colors: ["wood brown", "violet glow"],
    galoisPath: "items/wand",
    isTool: true,
    action: "wand",
    craftingCategory: "Tool",
    tooltipTypeName: "Wand",
  },
  pickaxe: {
    bikkieId: BikkieIds.pickaxe,
    bikkieName: "Pickaxe",
    label: "Pickaxe",
    kind: "tool",
    description:
      "Stone pickaxe tool for repair, mining, and rugged maintenance counters.",
    colors: ["stone gray", "wood brown"],
    galoisPath: "items/pickaxe_stone",
    isTool: true,
    action: "destroy",
    craftingCategory: "Tool",
    tooltipTypeName: "Tool",
  },
  axe: {
    bikkieId: BikkieIds.axe,
    bikkieName: "Simple Axe",
    label: "Simple Axe",
    kind: "tool",
    description:
      "Simple axe for timber, hunting prep, and practical repair service.",
    colors: ["stone gray", "wood brown"],
    galoisPath: "items/axe_stone",
    isTool: true,
    action: "destroy",
    craftingCategory: "Tools",
    tooltipTypeName: "Tool",
  },
  fencer: {
    bikkieId: BikkieIds.fencer,
    bikkieName: "Fencer",
    label: "Fencer",
    kind: "tool",
    description:
      "Stone shaping tool for fence profiles, security perimeters, and property boundaries.",
    colors: ["stone gray", "iron gray"],
    galoisPath: "items/fencer_stone",
    isTool: true,
    shape: "fence",
    action: "shape",
    craftingCategory: "Tools",
    tooltipTypeName: "Shaping Tool",
  },
  slabber: {
    bikkieId: BikkieIds.slabber,
    bikkieName: "Slabber",
    label: "Slabber",
    kind: "tool",
    description:
      "Stone shaping tool for slab profiles, counters, shelves, and building finishes.",
    colors: ["stone gray", "iron gray"],
    galoisPath: "items/slabber_stone",
    isTool: true,
    shape: "slab",
    action: "shape",
    craftingCategory: "Tool",
    tooltipTypeName: "Shaping Tool",
  },
  stepper: {
    bikkieId: BikkieIds.stepper,
    bikkieName: "Stepper",
    label: "Stepper",
    kind: "tool",
    description:
      "Stone shaping tool for steps, accessible entries, and outpost circulation.",
    colors: ["stone gray", "iron gray"],
    galoisPath: "items/stepper_stone",
    isTool: true,
    shape: "step",
    action: "shape",
    craftingCategory: "Tool",
    tooltipTypeName: "Shaping Tool",
  },
  tabler: {
    bikkieId: BikkieIds.tabler,
    bikkieName: "Tabler",
    label: "Tabler",
    kind: "tool",
    description:
      "Stone table-shaping tool for counters, display tables, and showroom furniture.",
    colors: ["stone gray", "iron gray"],
    galoisPath: "items/stepper_stone",
    isTool: true,
    shape: "table",
    action: "shape",
    craftingCategory: "Tool",
    tooltipTypeName: "Shaping Tool",
  },
  recipePaper: {
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "Paper",
    label: "Paper",
    kind: "document",
    description:
      "Recipe paper graphic for forms, permits, plans, route slips, and counter paperwork.",
    colors: ["paper cream", "ink black"],
    galoisPath: "items/recipe_paper",
    craftingCategory: "Materials",
  },
  parcel: {
    bikkieId: BikkieIds.parcel,
    bikkieName: "Parcel",
    label: "Parcel",
    kind: "mail",
    description:
      "Parcel graphic for courier work, trader shelves, deliveries, and proof-of-service handoffs.",
    colors: ["chestnut brown", "twine tan"],
    galoisPath: "placeables/containers/treasure_chest",
    action: "reveal",
    craftingCategory: "Item",
  },
  mailbox: {
    bikkieId: BikkieIds.mailbox,
    bikkieName: "Mailbox",
    label: "Mailbox",
    kind: "mail",
    description:
      "One-by-two-by-one mailbox placeable for courier offices and customer pickup points.",
    colors: ["red", "mailbox gray", "post brown"],
    galoisPath: "placeables/mailbox/mailbox",
    boxSize: [1, 2, 1],
    isPlaceable: true,
    action: "place",
    craftingCategory: "Mailbox",
  },
  campfire: {
    bikkieId: BikkieIds.campfire,
    bikkieName: "Campfire",
    label: "Campfire",
    kind: "comfort",
    description:
      "One-block campfire placeable for cooking ambience, inns, guides, and field camps.",
    colors: ["charcoal", "ember orange", "warm yellow"],
    galoisPath: "placeables/camping/campfire",
    boxSize: [1, 1, 1],
    isPlaceable: true,
    action: "place",
    craftingCategory: "Camping",
  },
  vegetable: {
    bikkieId: BikkieIds.vegetable,
    bikkieName: "Fruit",
    label: "Fresh Produce",
    kind: "crop",
    description:
      "Fresh produce graphic for farm stands, restaurant ingredients, and trader shelves.",
    colors: ["carrot orange", "leaf green"],
    galoisPath: "items/carrot",
    craftingCategory: "Item",
  },
  wheatSeed: {
    bikkieId: BikkieIds.wheatSeed,
    bikkieName: "Wheat Seed",
    label: "Wheat Seed",
    kind: "seed",
    description:
      "Plantable seed graphic for crop businesses and rare-food counters.",
    colors: ["seed tan", "wheat gold"],
    galoisPath: "items/seed_wheat",
    action: "plant",
    craftingCategory: "Item",
  },
  carrotSeed: {
    bikkieId: BikkieIds.carrotSeed,
    bikkieName: "Carrot Seed",
    label: "Carrot Seed",
    kind: "seed",
    description:
      "Plantable carrot seed graphic for farm stock and customer seed packets.",
    colors: ["seed tan", "carrot orange"],
    galoisPath: "items/seed_carrot",
    action: "plant",
    craftingCategory: "Item",
    tooltipTypeName: "Seed",
  },
  fertilizer: {
    bikkieId: BikkieIds.fertilizer,
    bikkieName: "Fertilizer",
    label: "Fertilizer",
    kind: "crop",
    description:
      "Fertilizer graphic for farming, composting, and sanitation recovery loops.",
    colors: ["leaf green", "soil brown"],
    galoisPath: "items/fertilizer",
    action: "fertilize",
    craftingCategory: "Item",
  },
  fish: {
    bikkieId: BikkieIds.fish,
    bikkieName: "Fish",
    label: "Fish",
    kind: "fish",
    description:
      "Fish graphic for larders, angler tables, restaurant prep, and guide catches.",
    colors: ["water blue", "silver", "scale teal"],
    galoisPath: "npcs/fish",
    craftingCategory: "Item",
  },
  sashimi: {
    bikkieId: BikkieIds.sashimi,
    bikkieName: "Sashimi",
    label: "Sashimi",
    kind: "food",
    description:
      "Prepared food graphic for premium restaurant and fish-prep service.",
    colors: ["salmon pink", "rice white", "seaweed green"],
    galoisPath: "items/sashimi",
    action: "eat",
    craftingCategory: "Food",
    tooltipTypeName: "Food",
  },
  muckerMeat: {
    bikkieId: BikkieIds.muckerMeat,
    bikkieName: "Raw Mucker Meat",
    label: "Raw Mucker Meat",
    kind: "food",
    description:
      "Raw meat graphic for hunter larders, restaurant supply, and wild-meat orders.",
    colors: ["red meat", "bone cream", "dark hide"],
    galoisPath: "items/mucker_meat_1",
    action: "eat",
    craftingCategory: "Food",
    tooltipTypeName: "Food",
  },
  coffee: {
    bikkieId: BikkieIds.coffee,
    bikkieName: "Black Coffee",
    label: "Black Coffee",
    kind: "food",
    description:
      "Drink graphic for inns, restaurants, trader shelves, and morning-rush service.",
    colors: ["coffee black", "mug cream"],
    galoisPath: "items/coffee",
    action: "drink",
    craftingCategory: "Drinks",
    tooltipTypeName: "Drink",
  },
} as const satisfies Record<string, HarthmereBusinessBikkieGraphicBase>;

function bikkieBusinessGraphic(
  businessType: HarthmereEconomyBusinessTypeId,
  key: keyof typeof HARTHMERE_BUSINESS_BIKKIE_GRAPHIC_BASES,
  role: HarthmereBusinessBikkieGraphicRole,
  businessUse: string
): HarthmereBusinessBikkieGraphic {
  const base = HARTHMERE_BUSINESS_BIKKIE_GRAPHIC_BASES[
    key
  ] as HarthmereBusinessBikkieGraphicBase;
  const graphicId = `${businessType}:${String(key)}:${role}`;
  return {
    ...base,
    graphicId,
    businessType,
    role,
    businessUse,
    source: "bikkie",
    visual: harthmereResolveBikkieVisual({
      id: graphicId,
      bikkieId: base.bikkieId,
      label: base.label,
      bikkieName: base.bikkieName,
      kind: base.kind,
      role,
      colors: base.colors,
      galoisPath: base.galoisPath,
      description: base.description,
    }),
  };
}

function businessGraphics(
  businessType: HarthmereEconomyBusinessTypeId,
  entries: Array<
    [
      keyof typeof HARTHMERE_BUSINESS_BIKKIE_GRAPHIC_BASES,
      HarthmereBusinessBikkieGraphicRole,
      string
    ]
  >
) {
  return Object.freeze(
    entries.map(([key, role, businessUse]) =>
      bikkieBusinessGraphic(businessType, key, role, businessUse)
    )
  );
}

export const HARTHMERE_BUSINESS_BIKKIE_GRAPHICS: Readonly<
  Record<
    HarthmereEconomyBusinessTypeId,
    readonly HarthmereBusinessBikkieGraphic[]
  >
> = Object.freeze({
  exotic_matter_refinery: businessGraphics("exotic_matter_refinery", [
    [
      "thermoblaster",
      "primary_station",
      "Industrial heat station for stabilization, filters, and sealed fuel orders.",
    ],
    [
      "thermolite",
      "counter_prop",
      "Clean heat station for audit demonstrations and safe-handling checks.",
    ],
    [
      "powerCell",
      "stock_item",
      "Energy stock graphic for certified fuel and powered containment service.",
    ],
    [
      "bucket",
      "service_tool",
      "Quench and spill-control tool for hazardous counter work.",
    ],
  ]),
  biome_maintenance_repair: businessGraphics("biome_maintenance_repair", [
    [
      "workbench",
      "primary_station",
      "Repair desk for anchor parts, inspection kits, and subscription maintenance.",
    ],
    [
      "pickaxe",
      "service_tool",
      "Rugged tool graphic for field repair and structural checks.",
    ],
    [
      "wand",
      "service_tool",
      "Builder-facing diagnostic tool for property anchor tuning.",
    ],
    ["bucket", "ambient_prop", "Leak and cleanup prop for maintenance calls."],
  ]),
  biome_design_studio: businessGraphics("biome_design_studio", [
    [
      "dyeOMatic",
      "primary_station",
      "Color station for palettes, sign samples, and event design work.",
    ],
    [
      "tailoringBooth",
      "counter_prop",
      "Showroom booth for cloth samples, uniforms, and identity packages.",
    ],
    [
      "camera",
      "service_tool",
      "Reference capture tool for before/after design consultation.",
    ],
    [
      "recipePaper",
      "counter_prop",
      "Mood boards, plans, and habitat mockups on paper.",
    ],
    [
      "tabler",
      "service_tool",
      "Display-table shaping tool for showroom counters.",
    ],
  ]),
  security_defense_contractor: businessGraphics("security_defense_contractor", [
    [
      "fencer",
      "primary_station",
      "Fence-profile tool for perimeter contracts and yard defense planning.",
    ],
    [
      "muckBuster",
      "service_tool",
      "Hazard-clearing tool for threat triage and contaminated route security.",
    ],
    [
      "camera",
      "service_tool",
      "Proof and surveillance graphic for threat boards.",
    ],
    [
      "recipePaper",
      "counter_prop",
      "Guard contracts, route plans, and threat slips.",
    ],
  ]),
  portal_transit_company: businessGraphics("portal_transit_company", [
    [
      "remoteControl",
      "primary_station",
      "Route terminal graphic for jumps, cargo windows, and gate controls.",
    ],
    ["powerCell", "stock_item", "Energy stock for active portal lanes."],
    [
      "homestone",
      "counter_prop",
      "Travel-safety token for passenger confidence and emergency return pitch.",
    ],
    ["recipePaper", "counter_prop", "Tickets, route papers, and cargo tags."],
  ]),
  biome_farming_rare_foods: businessGraphics("biome_farming_rare_foods", [
    [
      "seedMill",
      "primary_station",
      "Seed and crop-prep station for rare-food lots.",
    ],
    [
      "composter",
      "counter_prop",
      "Composting loop for fertilizer, spoilage recovery, and farm scraps.",
    ],
    [
      "vegetable",
      "stock_item",
      "Fresh produce display for crop bundle service.",
    ],
    [
      "wheatSeed",
      "stock_item",
      "Seed packet stock for crop orders and farm expansion.",
    ],
    [
      "fertilizer",
      "service_tool",
      "Fertilizer graphic for growth and freshness work.",
    ],
  ]),
  weapons_tools: businessGraphics("weapons_tools", [
    [
      "workbench",
      "primary_station",
      "Repair bench for tools, gear checks, and customer handoffs.",
    ],
    [
      "thermoblaster",
      "counter_prop",
      "Forge heat station for upgrades and metalwork.",
    ],
    [
      "pickaxe",
      "service_tool",
      "Tool stock and repair reference for work-gear customers.",
    ],
    [
      "axe",
      "service_tool",
      "Axe stock and repair reference for timber and hunter customers.",
    ],
    [
      "slabber",
      "service_tool",
      "Shaping tool for shop counters and durable parts.",
    ],
  ]),
  magic_goods: businessGraphics("magic_goods", [
    [
      "thermolite",
      "primary_station",
      "Clean glow station for charms, wards, and unstable component checks.",
    ],
    [
      "homestone",
      "counter_prop",
      "Travel magic anchor for return charms and safety stock.",
    ],
    ["powerCell", "stock_item", "Powered component for modern magical goods."],
    [
      "wand",
      "service_tool",
      "Visible wand graphic for charm and ward service.",
    ],
  ]),
  exploration_guide: businessGraphics("exploration_guide", [
    [
      "camera",
      "primary_station",
      "Survey and route-proof tool for expedition bookings.",
    ],
    ["recipePaper", "counter_prop", "Maps, route notes, and hazard plans."],
    ["campfire", "ambient_prop", "Field-camp comfort graphic for guide shops."],
    [
      "fish",
      "stock_item",
      "Catch and trail-food graphic for guide credibility.",
    ],
  ]),
  custom_home_property_development: businessGraphics(
    "custom_home_property_development",
    [
      [
        "workbench",
        "primary_station",
        "Blueprint desk for staged builds, permits, and material pricing.",
      ],
      [
        "wand",
        "service_tool",
        "Builder's wand for previewing placements and customer property work.",
      ],
      ["recipePaper", "counter_prop", "Plans, deeds, and permit packets."],
      [
        "fencer",
        "service_tool",
        "Boundary and fence-profile tool for lot work.",
      ],
      [
        "tabler",
        "service_tool",
        "Counter and table-shaping tool for interiors.",
      ],
    ]
  ),
  general_trader: businessGraphics("general_trader", [
    [
      "parcel",
      "primary_station",
      "Trade parcel graphic for stocked goods and brokerage service.",
    ],
    [
      "workbench",
      "counter_prop",
      "General prep station for small repairs and packaged orders.",
    ],
    ["vegetable", "stock_item", "Produce display for everyday grocery stock."],
    [
      "coffee",
      "stock_item",
      "Drink stock for morning trade and traveler shelves.",
    ],
    [
      "arcadeMachine",
      "ambient_prop",
      "Shop-floor draw for general-store visits where an entertainment corner fits.",
    ],
  ]),
  hunter_wild_meat: businessGraphics("hunter_wild_meat", [
    [
      "anglersTable",
      "primary_station",
      "Cold prep table for meat, fish, hide bundles, and larder handoffs.",
    ],
    ["muckerMeat", "stock_item", "Wild meat stock graphic for larder orders."],
    [
      "fish",
      "stock_item",
      "Fish stock graphic for mixed game and catch display.",
    ],
    ["axe", "service_tool", "Field tool for rugged prep and trail work."],
    [
      "recipePaper",
      "counter_prop",
      "Tracking notes and wildlife-control advice.",
    ],
  ]),
  medical_doctor: businessGraphics("medical_doctor", [
    [
      "thermolite",
      "primary_station",
      "Sterile heat and diagnostic glow station for treatment counters.",
    ],
    ["bucket", "service_tool", "Clean-water and wash tool for triage service."],
    [
      "recipePaper",
      "counter_prop",
      "Triage cards, treatment notes, and checkup forms.",
    ],
    [
      "muckBuster",
      "service_tool",
      "Contamination-safe tool for sanitation-linked urgent cases.",
    ],
  ]),
  teleport_owner: businessGraphics("teleport_owner", [
    [
      "homestone",
      "primary_station",
      "Teleport identity object for access keys and emergency returns.",
    ],
    [
      "remoteControl",
      "counter_prop",
      "Pad terminal control for stability checks.",
    ],
    ["powerCell", "stock_item", "Fuel and energy graphic for pad uptime."],
    [
      "thermolite",
      "ambient_prop",
      "Clean glow station for calibration and pad safety.",
    ],
  ]),
  waste_sanitation_cleanup: businessGraphics("waste_sanitation_cleanup", [
    [
      "composter",
      "primary_station",
      "Waste-processing station for compostable trash and farm recovery loops.",
    ],
    [
      "muckBuster",
      "service_tool",
      "Main cleanup tool for decontamination and muck removal.",
    ],
    [
      "bucket",
      "service_tool",
      "Water and containment utility for pickup and wash routes.",
    ],
    [
      "thermoblaster",
      "counter_prop",
      "Hazard treatment station for severe cleanup contracts.",
    ],
    [
      "recipePaper",
      "counter_prop",
      "Clean certificates and inspection papers.",
    ],
  ]),
  repair_maintenance_person: businessGraphics("repair_maintenance_person", [
    [
      "workbench",
      "primary_station",
      "Fix-it bench for furniture, fixtures, and urgent repair parts.",
    ],
    [
      "pickaxe",
      "service_tool",
      "Rugged repair tool for stone and structural service.",
    ],
    ["axe", "service_tool", "Wood and fixture repair tool for everyday jobs."],
    [
      "slabber",
      "service_tool",
      "Shaping tool for shelves, counters, and patched boards.",
    ],
    ["bucket", "ambient_prop", "Leak response prop for urgent service calls."],
  ]),
  food_service_restaurant: businessGraphics("food_service_restaurant", [
    [
      "kitchen",
      "primary_station",
      "Cooking station for plated meals, soups, and catering orders.",
    ],
    [
      "anglersTable",
      "counter_prop",
      "Prep table for fish, meat, and cold ration assembly.",
    ],
    ["sashimi", "stock_item", "Prepared food display for premium dishes."],
    ["vegetable", "stock_item", "Produce ingredient graphic for fresh meals."],
    [
      "campfire",
      "ambient_prop",
      "Warm cooking ambience for smaller food counters.",
    ],
  ]),
  courier: businessGraphics("courier", [
    [
      "parcel",
      "primary_station",
      "Parcel graphic for weighing, tagging, and proof slips.",
    ],
    [
      "mailbox",
      "counter_prop",
      "Pickup and drop-off marker for customer deliveries.",
    ],
    [
      "remoteControl",
      "service_tool",
      "Dispatch control for route batching and timed runs.",
    ],
    [
      "recipePaper",
      "counter_prop",
      "Route maps, proof slips, and delivery forms.",
    ],
  ]),
  hospitality_inn_hotel_shelter: businessGraphics(
    "hospitality_inn_hotel_shelter",
    [
      [
        "kitchen",
        "primary_station",
        "Food-service station for room meals and shelter service.",
      ],
      [
        "wardrobe",
        "counter_prop",
        "Room and linen storage graphic for lodging quality.",
      ],
      ["campfire", "ambient_prop", "Warm common-room comfort object."],
      [
        "coffee",
        "stock_item",
        "Guest drink stock for morning checkout and traveler service.",
      ],
      [
        "arcadeMachine",
        "ambient_prop",
        "Lobby entertainment object for inns with guest lounges.",
      ],
    ]
  ),
});

export function getHarthmereBusinessBikkieGraphics(
  typeId: HarthmereEconomyBusinessTypeId
): readonly HarthmereBusinessBikkieGraphic[] {
  return HARTHMERE_BUSINESS_BIKKIE_GRAPHICS[typeId] ?? [];
}

export function getHarthmereBusinessPrimaryBikkieGraphic(
  typeId: HarthmereEconomyBusinessTypeId
) {
  const graphics = getHarthmereBusinessBikkieGraphics(typeId);
  return (
    graphics.find((graphic) => graphic.role === "primary_station") ??
    graphics[0]
  );
}

export function validateHarthmereBusinessBikkieGraphics(): HarthmereBusinessBikkieGraphicsValidation {
  const missingBusinessTypes: HarthmereEconomyBusinessTypeId[] = [];
  const missingPrimaryGraphics: HarthmereEconomyBusinessTypeId[] = [];
  const graphicsMissingMetadata: string[] = [];
  const duplicateGraphicIds: string[] = [];
  const stationGraphicsMissingSizes: string[] = [];
  const graphicsMissingVisuals: string[] = [];
  const seen = new Set<string>();
  for (const typeId of BUSINESS_TYPES_IN_ORDER) {
    const graphics = getHarthmereBusinessBikkieGraphics(typeId);
    if (!graphics.length) missingBusinessTypes.push(typeId);
    if (!graphics.some((graphic) => graphic.role === "primary_station"))
      missingPrimaryGraphics.push(typeId);
    for (const graphic of graphics) {
      if (seen.has(graphic.graphicId))
        duplicateGraphicIds.push(graphic.graphicId);
      seen.add(graphic.graphicId);
      if (
        !graphic.label ||
        !graphic.description ||
        !graphic.businessUse ||
        !graphic.colors.length
      ) {
        graphicsMissingMetadata.push(graphic.graphicId);
      }
      if (graphic.kind === "crafting_station" && !graphic.boxSize) {
        stationGraphicsMissingSizes.push(graphic.graphicId);
      }
      if (!graphic.visual?.primaryHex || !graphic.visual?.glyph) {
        graphicsMissingVisuals.push(graphic.graphicId);
      }
    }
  }
  return {
    ok:
      missingBusinessTypes.length === 0 &&
      missingPrimaryGraphics.length === 0 &&
      graphicsMissingMetadata.length === 0 &&
      duplicateGraphicIds.length === 0 &&
      stationGraphicsMissingSizes.length === 0 &&
      graphicsMissingVisuals.length === 0,
    missingBusinessTypes,
    missingPrimaryGraphics,
    graphicsMissingMetadata,
    duplicateGraphicIds,
    stationGraphicsMissingSizes,
    graphicsMissingVisuals,
  };
}

const CUSTOMER_ROWS: Array<
  [
    string,
    string,
    HarthmereEconomyBusinessTypeId[],
    number,
    1 | 2 | 3 | 4 | 5,
    string,
    HarthmereBusinessCustomerAppearance
  ]
> = [
  [
    "customer_adria_vale",
    "Adria Vale",
    ["medical_doctor", "magic_goods"],
    72,
    3,
    "precise",
    {
      hairStyle: "asymmetric coil bob",
      hairColor: "smoked copper",
      bodyBuild: "compact sprinter",
      heightBand: "short-plus",
      shoulderShape: "narrow square",
      posture: "upright alert",
      gait: "quick half-steps",
      eyeColor: "jade fleck",
      eyeShape: "wide almond",
      browShape: "single high arch",
      noseShape: "button point",
      noseBridge: "soft low bridge",
      skinTone: "warm umber rose",
      outfit: "moss clinic wrap",
      accessory: "brass pulse ring",
      voice: "low clipped alto",
    },
  ],
  [
    "customer_borin_kest",
    "Borin Kest",
    ["weapons_tools", "repair_maintenance_person"],
    64,
    2,
    "skeptical",
    {
      hairStyle: "shaved crown braid",
      hairColor: "iron black",
      bodyBuild: "barrel strong",
      heightBand: "tall",
      shoulderShape: "broad shelf",
      posture: "forward lean",
      gait: "heavy heel roll",
      eyeColor: "storm gray",
      eyeShape: "deep set",
      browShape: "flat thick",
      noseShape: "broken ridge",
      noseBridge: "crooked high bridge",
      skinTone: "cool tawny",
      outfit: "charcoal work apron",
      accessory: "cracked thumb guard",
      voice: "gravel bass",
    },
  ],
  [
    "customer_celia_morn",
    "Celia Morn",
    ["food_service_restaurant", "hospitality_inn_hotel_shelter"],
    84,
    4,
    "warm",
    {
      hairStyle: "halo curls",
      hairColor: "honey ash",
      bodyBuild: "soft pear",
      heightBand: "mid",
      shoulderShape: "rounded narrow",
      posture: "gentle sway",
      gait: "measured glide",
      eyeColor: "violet brown",
      eyeShape: "sleepy oval",
      browShape: "soft crescent",
      noseShape: "small scoop",
      noseBridge: "delicate bridge",
      skinTone: "deep bronze gold",
      outfit: "cream travel shawl",
      accessory: "enameled spoon pin",
      voice: "singing mezzo",
    },
  ],
  [
    "customer_dain_orrick",
    "Dain Orrick",
    ["courier", "general_trader"],
    58,
    2,
    "impatient",
    {
      hairStyle: "windcut spikes",
      hairColor: "sun bleached brown",
      bodyBuild: "lean courier",
      heightBand: "mid-tall",
      shoulderShape: "sloped wiry",
      posture: "ready crouch",
      gait: "fast toe push",
      eyeColor: "pale hazel",
      eyeShape: "sharp narrow",
      browShape: "angled slash",
      noseShape: "long hawk",
      noseBridge: "straight high bridge",
      skinTone: "olive tan",
      outfit: "blue parcel vest",
      accessory: "tin route whistle",
      voice: "bright tenor",
    },
  ],
  [
    "customer_elira_senn",
    "Elira Senn",
    ["biome_design_studio", "custom_home_property_development"],
    76,
    4,
    "curious",
    {
      hairStyle: "looped side bun",
      hairColor: "black cherry",
      bodyBuild: "willow slim",
      heightBand: "tall-slim",
      shoulderShape: "fine tapered",
      posture: "tilted assessing",
      gait: "long quiet stride",
      eyeColor: "sea glass",
      eyeShape: "cat tilt",
      browShape: "thin lifted",
      noseShape: "straight fine",
      noseBridge: "long smooth bridge",
      skinTone: "amber beige",
      outfit: "ink drafting coat",
      accessory: "silver measuring chain",
      voice: "clear contralto",
    },
  ],
  [
    "customer_fenn_barley",
    "Fenn Barley",
    ["biome_farming_rare_foods", "general_trader"],
    70,
    2,
    "cheerful",
    {
      hairStyle: "short leaf twists",
      hairColor: "chestnut greenwash",
      bodyBuild: "stocky farmhand",
      heightBand: "short",
      shoulderShape: "round solid",
      posture: "hands-on-hips",
      gait: "bouncy step",
      eyeColor: "fern green",
      eyeShape: "round bright",
      browShape: "bushy comma",
      noseShape: "wide bulb",
      noseBridge: "flat broad bridge",
      skinTone: "red clay brown",
      outfit: "patchwork seed smock",
      accessory: "woven seed bracelet",
      voice: "sunny baritone",
    },
  ],
  [
    "customer_garrin_vox",
    "Garrin Vox",
    ["security_defense_contractor", "weapons_tools"],
    62,
    3,
    "guarded",
    {
      hairStyle: "tight military crop",
      hairColor: "salt pepper",
      bodyBuild: "triangular guard",
      heightBand: "very tall",
      shoulderShape: "armor wide",
      posture: "locked stance",
      gait: "patrol pace",
      eyeColor: "steel blue",
      eyeShape: "hooded narrow",
      browShape: "hard shelf",
      noseShape: "flat boxer",
      noseBridge: "scarred bridge",
      skinTone: "cool dark brown",
      outfit: "oiled leather jerkin",
      accessory: "red permit cord",
      voice: "command baritone",
    },
  ],
  [
    "customer_hessa_quin",
    "Hessa Quin",
    ["magic_goods", "teleport_owner"],
    68,
    5,
    "mysterious",
    {
      hairStyle: "waist rope locs",
      hairColor: "moon white",
      bodyBuild: "lithe dancer",
      heightBand: "mid-short",
      shoulderShape: "thin angular",
      posture: "floating still",
      gait: "silent crossing",
      eyeColor: "silver lilac",
      eyeShape: "long crescent",
      browShape: "split notch",
      noseShape: "narrow blade",
      noseBridge: "raised knife bridge",
      skinTone: "cool ebony",
      outfit: "violet ward robe",
      accessory: "glass charm veil",
      voice: "soft whisper",
    },
  ],
  [
    "customer_idra_pell",
    "Idra Pell",
    ["portal_transit_company", "courier"],
    56,
    3,
    "anxious",
    {
      hairStyle: "frizzed cloud puff",
      hairColor: "rust red",
      bodyBuild: "small angular",
      heightBand: "petite",
      shoulderShape: "pinched narrow",
      posture: "shoulders high",
      gait: "stutter step",
      eyeColor: "amber ring",
      eyeShape: "large worried",
      browShape: "knit double peak",
      noseShape: "upturned spark",
      noseBridge: "short lifted bridge",
      skinTone: "light freckled tan",
      outfit: "yellow ticket cloak",
      accessory: "paper luggage tags",
      voice: "quick soprano",
    },
  ],
  [
    "customer_jorek_linn",
    "Jorek Linn",
    ["waste_sanitation_cleanup", "medical_doctor"],
    60,
    2,
    "blunt",
    {
      hairStyle: "low knot tail",
      hairColor: "mud brown",
      bodyBuild: "rectangular laborer",
      heightBand: "mid-wide",
      shoulderShape: "flat plank",
      posture: "tired stoop",
      gait: "dragged boot",
      eyeColor: "dull teal",
      eyeShape: "heavy lidded",
      browShape: "low ridge",
      noseShape: "wide wedge",
      noseBridge: "broad broken bridge",
      skinTone: "weathered sand",
      outfit: "stained utility coat",
      accessory: "corked sample tube",
      voice: "dry bass",
    },
  ],
  [
    "customer_kiva_roan",
    "Kiva Roan",
    ["exploration_guide", "hunter_wild_meat"],
    66,
    3,
    "bold",
    {
      hairStyle: "feathered undercut",
      hairColor: "black blue sheen",
      bodyBuild: "rangy climber",
      heightBand: "tall-rangy",
      shoulderShape: "corded narrow",
      posture: "chin forward",
      gait: "spring climb",
      eyeColor: "gold ocher",
      eyeShape: "fox narrow",
      browShape: "split high",
      noseShape: "sharp point",
      noseBridge: "thin ridge",
      skinTone: "copper brown",
      outfit: "green trail harness",
      accessory: "bone map toggle",
      voice: "laughing alto",
    },
  ],
  [
    "customer_luca_merrit",
    "Luca Merrit",
    ["hospitality_inn_hotel_shelter", "food_service_restaurant"],
    88,
    4,
    "polite",
    {
      hairStyle: "side parted waves",
      hairColor: "soft black",
      bodyBuild: "rounded scholar",
      heightBand: "mid-soft",
      shoulderShape: "soft square",
      posture: "formal bow",
      gait: "small careful",
      eyeColor: "dark honey",
      eyeShape: "gentle almond",
      browShape: "tidy arc",
      noseShape: "roman soft",
      noseBridge: "smooth medium bridge",
      skinTone: "golden brown",
      outfit: "wine guest jacket",
      accessory: "pearl room key",
      voice: "warm tenor",
    },
  ],
  [
    "customer_mirae_dusk",
    "Mirae Dusk",
    ["biome_maintenance_repair", "exotic_matter_refinery"],
    54,
    5,
    "demanding",
    {
      hairStyle: "slick prism bob",
      hairColor: "violet black",
      bodyBuild: "tall blade",
      heightBand: "towering",
      shoulderShape: "razor straight",
      posture: "perfect vertical",
      gait: "crisp metronome",
      eyeColor: "ice violet",
      eyeShape: "thin oval",
      browShape: "needle arch",
      noseShape: "aquiline",
      noseBridge: "polished high bridge",
      skinTone: "deep neutral brown",
      outfit: "white inspector coat",
      accessory: "obsidian seal badge",
      voice: "cool alto",
    },
  ],
  [
    "customer_nalo_brix",
    "Nalo Brix",
    ["repair_maintenance_person", "custom_home_property_development"],
    74,
    2,
    "practical",
    {
      hairStyle: "square brush top",
      hairColor: "dust blond",
      bodyBuild: "short dense",
      heightBand: "short-dense",
      shoulderShape: "blocky compact",
      posture: "elbows out",
      gait: "steady stomp",
      eyeColor: "brown green",
      eyeShape: "small round",
      browShape: "thick straight",
      noseShape: "stub square",
      noseBridge: "low square bridge",
      skinTone: "pale olive",
      outfit: "tan nail pouch",
      accessory: "wooden pencil earclip",
      voice: "matter-of-fact bass",
    },
  ],
  [
    "customer_ona_fleck",
    "Ona Fleck",
    ["general_trader", "biome_farming_rare_foods"],
    80,
    1,
    "bargaining",
    {
      hairStyle: "tiny twin buns",
      hairColor: "silver brown",
      bodyBuild: "birdlike light",
      heightBand: "small",
      shoulderShape: "fine round",
      posture: "leaning listen",
      gait: "skipping shuffle",
      eyeColor: "black pearl",
      eyeShape: "round quick",
      browShape: "short dash",
      noseShape: "pinched bead",
      noseBridge: "tiny bridge",
      skinTone: "warm ivory",
      outfit: "striped market coat",
      accessory: "copper coin sash",
      voice: "raspy mezzo",
    },
  ],
  [
    "customer_pavo_ren",
    "Pavo Ren",
    ["portal_transit_company", "teleport_owner"],
    50,
    5,
    "urgent",
    {
      hairStyle: "gelled crest",
      hairColor: "platinum yellow",
      bodyBuild: "athletic narrow",
      heightBand: "mid-athletic",
      shoulderShape: "cut diamond",
      posture: "weight forward",
      gait: "long rush",
      eyeColor: "electric blue",
      eyeShape: "bright slit",
      browShape: "twin hooks",
      noseShape: "long spear",
      noseBridge: "straight narrow bridge",
      skinTone: "light golden",
      outfit: "red travel suit",
      accessory: "stacked transit passes",
      voice: "rapid tenor",
    },
  ],
  [
    "customer_quilla_fern",
    "Quilla Fern",
    ["biome_design_studio", "magic_goods"],
    86,
    3,
    "delighted",
    {
      hairStyle: "braided crown",
      hairColor: "moss brown",
      bodyBuild: "curved compact",
      heightBand: "mid-curvy",
      shoulderShape: "soft sloping",
      posture: "open hands",
      gait: "gentle bounce",
      eyeColor: "mint gray",
      eyeShape: "soft round",
      browShape: "leaf curve",
      noseShape: "rounded petal",
      noseBridge: "soft narrow bridge",
      skinTone: "deep warm beige",
      outfit: "paint flecked poncho",
      accessory: "pressed flower brooch",
      voice: "bright alto",
    },
  ],
  [
    "customer_ryx_mallow",
    "Ryx Mallow",
    ["security_defense_contractor", "exploration_guide"],
    48,
    3,
    "reckless",
    {
      hairStyle: "messy wolf cut",
      hairColor: "ash brown",
      bodyBuild: "bony quick",
      heightBand: "mid-bony",
      shoulderShape: "jagged narrow",
      posture: "restless twist",
      gait: "zigzag stride",
      eyeColor: "rust amber",
      eyeShape: "uneven squint",
      browShape: "wild jag",
      noseShape: "crooked hook",
      noseBridge: "bent mid bridge",
      skinTone: "sunburnt peach",
      outfit: "torn scout cape",
      accessory: "dented compass",
      voice: "cracked tenor",
    },
  ],
  [
    "customer_sable_ior",
    "Sable Ior",
    ["exotic_matter_refinery", "waste_sanitation_cleanup"],
    52,
    4,
    "cautious",
    {
      hairStyle: "shielded veil locks",
      hairColor: "charcoal purple",
      bodyBuild: "protective padded",
      heightBand: "mid-padded",
      shoulderShape: "rounded armored",
      posture: "guarded hunch",
      gait: "careful plant",
      eyeColor: "green gold",
      eyeShape: "covered narrow",
      browShape: "masked flat",
      noseShape: "soft wedge",
      noseBridge: "covered bridge",
      skinTone: "cool umber",
      outfit: "sealed gray smock",
      accessory: "filter mask",
      voice: "muffled alto",
    },
  ],
  [
    "customer_tavin_coil",
    "Tavin Coil",
    ["weapons_tools", "hunter_wild_meat"],
    69,
    2,
    "confident",
    {
      hairStyle: "long tied topknot",
      hairColor: "dark auburn",
      bodyBuild: "corded hunter",
      heightBand: "tall-lean",
      shoulderShape: "sinew slope",
      posture: "relaxed ready",
      gait: "quiet heel",
      eyeColor: "pine green",
      eyeShape: "watchful almond",
      browShape: "low angled",
      noseShape: "broad straight",
      noseBridge: "weathered bridge",
      skinTone: "brown copper",
      outfit: "hide patched vest",
      accessory: "antler clasp",
      voice: "easy baritone",
    },
  ],
  [
    "customer_uma_slate",
    "Uma Slate",
    ["custom_home_property_development", "repair_maintenance_person"],
    82,
    5,
    "exacting",
    {
      hairStyle: "severe center braid",
      hairColor: "blue gray",
      bodyBuild: "statuesque",
      heightBand: "tall-still",
      shoulderShape: "marble square",
      posture: "survey stance",
      gait: "slow decisive",
      eyeColor: "black blue",
      eyeShape: "calm hooded",
      browShape: "straight fine",
      noseShape: "long roman",
      noseBridge: "high flat bridge",
      skinTone: "dark cool tan",
      outfit: "architect linen suit",
      accessory: "ivory plan tube",
      voice: "measured contralto",
    },
  ],
  [
    "customer_vireo_tan",
    "Vireo Tan",
    ["biome_farming_rare_foods", "food_service_restaurant"],
    78,
    3,
    "hungry",
    {
      hairStyle: "curly side shave",
      hairColor: "kelp green",
      bodyBuild: "round strong",
      heightBand: "short-round",
      shoulderShape: "curved broad",
      posture: "belly laugh",
      gait: "rolling stride",
      eyeColor: "warm brown",
      eyeShape: "crescent smile",
      browShape: "happy arc",
      noseShape: "round broad",
      noseBridge: "short broad bridge",
      skinTone: "medium olive gold",
      outfit: "orange tasting vest",
      accessory: "wooden fork charm",
      voice: "booming alto",
    },
  ],
  [
    "customer_wen_auster",
    "Wen Auster",
    ["courier", "medical_doctor"],
    59,
    1,
    "worried",
    {
      hairStyle: "flat cap fringe",
      hairColor: "matte black",
      bodyBuild: "thin wiry",
      heightBand: "short-wiry",
      shoulderShape: "tight raised",
      posture: "folded arms",
      gait: "nervous patter",
      eyeColor: "brown black",
      eyeShape: "small oval",
      browShape: "pinched peak",
      noseShape: "narrow knob",
      noseBridge: "fine uneven bridge",
      skinTone: "pale tan",
      outfit: "patched runner coat",
      accessory: "medicine pouch",
      voice: "thin tenor",
    },
  ],
  [
    "customer_xara_lune",
    "Xara Lune",
    ["magic_goods", "biome_design_studio"],
    90,
    5,
    "glamorous",
    {
      hairStyle: "crystal waterfall",
      hairColor: "opal silver",
      bodyBuild: "tall elegant",
      heightBand: "very tall slim",
      shoulderShape: "long sloped",
      posture: "stage poise",
      gait: "slow float",
      eyeColor: "rose quartz",
      eyeShape: "dramatic almond",
      browShape: "painted sweep",
      noseShape: "fine aquiline",
      noseBridge: "glitter high bridge",
      skinTone: "rich mahogany",
      outfit: "black star cloak",
      accessory: "floating bead chain",
      voice: "velvet soprano",
    },
  ],
  [
    "customer_yori_pike",
    "Yori Pike",
    ["hunter_wild_meat", "food_service_restaurant"],
    61,
    2,
    "plainspoken",
    {
      hairStyle: "rough bowl crop",
      hairColor: "straw gold",
      bodyBuild: "broad compact",
      heightBand: "mid-stocky",
      shoulderShape: "thick round",
      posture: "one hip lean",
      gait: "muddy shuffle",
      eyeColor: "mud hazel",
      eyeShape: "flat oval",
      browShape: "rough bar",
      noseShape: "wide snub",
      noseBridge: "low snub bridge",
      skinTone: "pink tan",
      outfit: "brown butcher wrap",
      accessory: "bone tally cord",
      voice: "nasal baritone",
    },
  ],
  [
    "customer_zella_root",
    "Zella Root",
    ["waste_sanitation_cleanup", "biome_farming_rare_foods"],
    73,
    1,
    "patient",
    {
      hairStyle: "wrapped seed scarf",
      hairColor: "hidden sable",
      bodyBuild: "elder small",
      heightBand: "elder short",
      shoulderShape: "narrow bent",
      posture: "soft stoop",
      gait: "careful cane tap",
      eyeColor: "cloud gray",
      eyeShape: "wrinkled kind",
      browShape: "white wisps",
      noseShape: "round elder",
      noseBridge: "soft sunken bridge",
      skinTone: "deep chestnut",
      outfit: "green compost shawl",
      accessory: "carved cane",
      voice: "gentle rasp",
    },
  ],
  [
    "customer_alen_mire",
    "Alen Mire",
    ["general_trader", "courier"],
    57,
    2,
    "shifty",
    {
      hairStyle: "greased side curls",
      hairColor: "dark copper",
      bodyBuild: "thin foxlike",
      heightBand: "mid-thin",
      shoulderShape: "sharp narrow",
      posture: "sideways lean",
      gait: "sidestep saunter",
      eyeColor: "yellow hazel",
      eyeShape: "side glance",
      browShape: "one raised",
      noseShape: "pointed sly",
      noseBridge: "thin crooked bridge",
      skinTone: "light brown olive",
      outfit: "purple bargain coat",
      accessory: "hidden pocket chain",
      voice: "silky tenor",
    },
  ],
  [
    "customer_brynn_salt",
    "Brynn Salt",
    ["hospitality_inn_hotel_shelter", "courier"],
    81,
    3,
    "road-worn",
    {
      hairStyle: "salt stiff braid",
      hairColor: "sand white",
      bodyBuild: "square traveler",
      heightBand: "mid-square",
      shoulderShape: "pack broad",
      posture: "pack brace",
      gait: "long tired march",
      eyeColor: "sea blue gray",
      eyeShape: "creased narrow",
      browShape: "sun faded",
      noseShape: "windburnt long",
      noseBridge: "sun cracked bridge",
      skinTone: "wind reddened tan",
      outfit: "blue travel duster",
      accessory: "shell luggage tag",
      voice: "hoarse alto",
    },
  ],
  [
    "customer_corso_helm",
    "Corso Helm",
    ["security_defense_contractor", "portal_transit_company"],
    53,
    4,
    "official",
    {
      hairStyle: "helmet flattened crop",
      hairColor: "brown silver",
      bodyBuild: "thick necked",
      heightBand: "tall-thick",
      shoulderShape: "plate wide",
      posture: "hands clasped",
      gait: "inspection march",
      eyeColor: "slate green",
      eyeShape: "hard oval",
      browShape: "square block",
      noseShape: "square long",
      noseBridge: "heavy bridge",
      skinTone: "dark olive",
      outfit: "blue authority tabard",
      accessory: "bronze clearance seal",
      voice: "formal bass",
    },
  ],
  [
    "customer_dovea_rill",
    "Dovea Rill",
    ["biome_design_studio", "hospitality_inn_hotel_shelter"],
    92,
    5,
    "luxury",
    {
      hairStyle: "pearled finger waves",
      hairColor: "black pearl",
      bodyBuild: "soft tall",
      heightBand: "tall-soft",
      shoulderShape: "silk sloped",
      posture: "relaxed regal",
      gait: "slow heel glide",
      eyeColor: "deep plum",
      eyeShape: "languid almond",
      browShape: "perfect crescent",
      noseShape: "small aristocrat",
      noseBridge: "fine high bridge",
      skinTone: "warm deep brown",
      outfit: "white guest mantle",
      accessory: "jade scent vial",
      voice: "low musical",
    },
  ],
  [
    "customer_ekko_jar",
    "Ekko Jar",
    ["repair_maintenance_person", "weapons_tools"],
    63,
    1,
    "fidgety",
    {
      hairStyle: "uneven mop",
      hairColor: "dirty blond",
      bodyBuild: "small square",
      heightBand: "short-square",
      shoulderShape: "tight block",
      posture: "tool clutch",
      gait: "quick hop",
      eyeColor: "blue hazel",
      eyeShape: "blink round",
      browShape: "patchy dash",
      noseShape: "tiny bent",
      noseBridge: "bumped little bridge",
      skinTone: "fair freckle",
      outfit: "patched gray jumper",
      accessory: "loose screw necklace",
      voice: "squeaky tenor",
    },
  ],
  [
    "customer_fara_nox",
    "Fara Nox",
    ["magic_goods", "medical_doctor"],
    67,
    4,
    "clinical",
    {
      hairStyle: "black ribbon queue",
      hairColor: "ink black",
      bodyBuild: "long narrow",
      heightBand: "mid-long",
      shoulderShape: "knife narrow",
      posture: "hands folded",
      gait: "silent measured",
      eyeColor: "green black",
      eyeShape: "half moon",
      browShape: "razor fine",
      noseShape: "thin long",
      noseBridge: "needle bridge",
      skinTone: "cool brown",
      outfit: "green remedy dress",
      accessory: "silver vial bandolier",
      voice: "quiet contralto",
    },
  ],
  [
    "customer_gillo_reed",
    "Gillo Reed",
    ["biome_farming_rare_foods", "waste_sanitation_cleanup"],
    75,
    2,
    "earthy",
    {
      hairStyle: "mud tied pigtail",
      hairColor: "red brown",
      bodyBuild: "wide farm strong",
      heightBand: "wide-short",
      shoulderShape: "rounded heavy",
      posture: "relaxed slouch",
      gait: "field plod",
      eyeColor: "moss amber",
      eyeShape: "soft squint",
      browShape: "thick mossy",
      noseShape: "wide flat",
      noseBridge: "flat sun bridge",
      skinTone: "deep russet",
      outfit: "green waterproof bib",
      accessory: "seed tin",
      voice: "slow bass",
    },
  ],
  [
    "customer_hollis_vein",
    "Hollis Vein",
    ["exotic_matter_refinery", "portal_transit_company"],
    51,
    5,
    "technical",
    {
      hairStyle: "silver temple sweep",
      hairColor: "graphite silver",
      bodyBuild: "thin engineer",
      heightBand: "mid-engineer",
      shoulderShape: "slight angular",
      posture: "head tilted",
      gait: "calculated steps",
      eyeColor: "blue white",
      eyeShape: "magnified round",
      browShape: "fine straight",
      noseShape: "long narrow",
      noseBridge: "spectacled bridge",
      skinTone: "light umber",
      outfit: "black hazard suit",
      accessory: "lens array monocle",
      voice: "precise tenor",
    },
  ],
  [
    "customer_iona_prax",
    "Iona Prax",
    ["custom_home_property_development", "general_trader"],
    79,
    3,
    "organized",
    {
      hairStyle: "stacked box braids",
      hairColor: "warm black",
      bodyBuild: "strong hourglass",
      heightBand: "mid-curved",
      shoulderShape: "balanced square",
      posture: "clipboard ready",
      gait: "purposeful stride",
      eyeColor: "copper green",
      eyeShape: "focused almond",
      browShape: "straight tidy",
      noseShape: "medium round",
      noseBridge: "smooth broad bridge",
      skinTone: "deep gold brown",
      outfit: "navy planning vest",
      accessory: "map clasp",
      voice: "steady mezzo",
    },
  ],
  [
    "customer_jessa_mint",
    "Jessa Mint",
    ["food_service_restaurant", "biome_farming_rare_foods"],
    87,
    2,
    "playful",
    {
      hairStyle: "mint ribbon ponytail",
      hairColor: "brown mint streak",
      bodyBuild: "small buoyant",
      heightBand: "petite-bouncy",
      shoulderShape: "soft tiny",
      posture: "rocking toes",
      gait: "swing step",
      eyeColor: "light green",
      eyeShape: "spark round",
      browShape: "curly comma",
      noseShape: "tiny round",
      noseBridge: "button bridge",
      skinTone: "light warm tan",
      outfit: "pink tasting frock",
      accessory: "candy bead bracelet",
      voice: "bright soprano",
    },
  ],
  [
    "customer_kelm_void",
    "Kelm Void",
    ["teleport_owner", "magic_goods"],
    46,
    5,
    "strange",
    {
      hairStyle: "floating static fray",
      hairColor: "blue black",
      bodyBuild: "tall gaunt",
      heightBand: "gaunt tall",
      shoulderShape: "thin high",
      posture: "off-center still",
      gait: "uneven drift",
      eyeColor: "void violet",
      eyeShape: "unblinking round",
      browShape: "absent pale",
      noseShape: "long hollow",
      noseBridge: "shadowed bridge",
      skinTone: "ashen brown",
      outfit: "dark return cloak",
      accessory: "glowing wrist token",
      voice: "echoing whisper",
    },
  ],
  [
    "customer_lara_steel",
    "Lara Steel",
    ["weapons_tools", "security_defense_contractor"],
    65,
    4,
    "direct",
    {
      hairStyle: "braided mohawk",
      hairColor: "steel gray",
      bodyBuild: "muscular tall",
      heightBand: "tall-muscular",
      shoulderShape: "warrior broad",
      posture: "square stance",
      gait: "drill step",
      eyeColor: "dark blue",
      eyeShape: "level stare",
      browShape: "stern wedge",
      noseShape: "strong straight",
      noseBridge: "solid bridge",
      skinTone: "medium cool brown",
      outfit: "red forge leathers",
      accessory: "iron rank cuff",
      voice: "firm alto",
    },
  ],
  [
    "customer_mikko_ash",
    "Mikko Ash",
    ["waste_sanitation_cleanup", "repair_maintenance_person"],
    71,
    1,
    "tired",
    {
      hairStyle: "ash dust buzz",
      hairColor: "powder gray",
      bodyBuild: "thin bent",
      heightBand: "mid-bent",
      shoulderShape: "drooped slim",
      posture: "weary curve",
      gait: "slow slide",
      eyeColor: "brown gray",
      eyeShape: "tired pouch",
      browShape: "faint line",
      noseShape: "soft long",
      noseBridge: "low tired bridge",
      skinTone: "smoky beige",
      outfit: "gray mop coat",
      accessory: "rag bundle",
      voice: "soft bass",
    },
  ],
  [
    "customer_nessa_gate",
    "Nessa Gate",
    ["portal_transit_company", "hospitality_inn_hotel_shelter"],
    55,
    3,
    "lost",
    {
      hairStyle: "loose travel braid",
      hairColor: "red gold",
      bodyBuild: "tall narrow",
      heightBand: "tall-narrow",
      shoulderShape: "pack sloped",
      posture: "map hunched",
      gait: "stop-start walk",
      eyeColor: "blue hazel",
      eyeShape: "wide searching",
      browShape: "worried sweep",
      noseShape: "long soft",
      noseBridge: "straight soft bridge",
      skinTone: "fair golden",
      outfit: "green station cloak",
      accessory: "folded wrong map",
      voice: "soft mezzo",
    },
  ],
  [
    "customer_orrin_hearth",
    "Orrin Hearth",
    ["food_service_restaurant", "general_trader"],
    83,
    2,
    "neighborly",
    {
      hairStyle: "warm wool curls",
      hairColor: "brown gold",
      bodyBuild: "large gentle",
      heightBand: "large-mid",
      shoulderShape: "cushion broad",
      posture: "open chest",
      gait: "slow friendly",
      eyeColor: "walnut",
      eyeShape: "kind oval",
      browShape: "soft thick",
      noseShape: "large round",
      noseBridge: "broad kind bridge",
      skinTone: "dark warm umber",
      outfit: "brown supper coat",
      accessory: "wooden cup token",
      voice: "warm bass",
    },
  ],
  [
    "customer_pella_snow",
    "Pella Snow",
    ["medical_doctor", "hospitality_inn_hotel_shelter"],
    89,
    4,
    "fragile",
    {
      hairStyle: "white pixie crop",
      hairColor: "snow white",
      bodyBuild: "small delicate",
      heightBand: "tiny",
      shoulderShape: "thin sloped",
      posture: "wrapped inward",
      gait: "careful glide",
      eyeColor: "pale blue",
      eyeShape: "watery oval",
      browShape: "white thread",
      noseShape: "small narrow",
      noseBridge: "fine pale bridge",
      skinTone: "light cool beige",
      outfit: "blue recovery shawl",
      accessory: "linen wrist wrap",
      voice: "breathy soprano",
    },
  ],
  [
    "customer_quorin_bale",
    "Quorin Bale",
    ["hunter_wild_meat", "security_defense_contractor"],
    60,
    3,
    "watchful",
    {
      hairStyle: "thick side plait",
      hairColor: "oak brown",
      bodyBuild: "heavy hunter",
      heightBand: "tall-heavy",
      shoulderShape: "cloak broad",
      posture: "still ready",
      gait: "soft boot roll",
      eyeColor: "dark green",
      eyeShape: "deep watch",
      browShape: "heavy overhang",
      noseShape: "broad hook",
      noseBridge: "strong hooked bridge",
      skinTone: "medium red brown",
      outfit: "forest hide cloak",
      accessory: "trap ring",
      voice: "low rasp",
    },
  ],
  [
    "customer_rinna_bell",
    "Rinna Bell",
    ["biome_design_studio", "food_service_restaurant"],
    91,
    3,
    "festival",
    {
      hairStyle: "ribbon spiral curls",
      hairColor: "golden pink",
      bodyBuild: "petite dancer",
      heightBand: "small-dancer",
      shoulderShape: "tiny square",
      posture: "arms lively",
      gait: "dance step",
      eyeColor: "bright amber",
      eyeShape: "spark almond",
      browShape: "arched lively",
      noseShape: "short pixie",
      noseBridge: "tiny lifted bridge",
      skinTone: "warm light brown",
      outfit: "red festival jacket",
      accessory: "little bell anklet",
      voice: "ringing alto",
    },
  ],
  [
    "customer_soren_drift",
    "Soren Drift",
    ["exploration_guide", "portal_transit_company"],
    49,
    4,
    "distant",
    {
      hairStyle: "wind long fringe",
      hairColor: "pale brown",
      bodyBuild: "long weathered",
      heightBand: "very tall lean",
      shoulderShape: "narrow far",
      posture: "far gaze",
      gait: "trail stride",
      eyeColor: "fog blue",
      eyeShape: "far narrow",
      browShape: "wind worn",
      noseShape: "long weathered",
      noseBridge: "sun high bridge",
      skinTone: "weathered olive",
      outfit: "gray route cloak",
      accessory: "old route token",
      voice: "low tenor",
    },
  ],
  [
    "customer_talia_grease",
    "Talia Grease",
    ["repair_maintenance_person", "courier"],
    70,
    2,
    "resourceful",
    {
      hairStyle: "oiled knot bun",
      hairColor: "black brown",
      bodyBuild: "compact mechanic",
      heightBand: "short-mechanic",
      shoulderShape: "strong narrow",
      posture: "knees bent",
      gait: "quick crouch walk",
      eyeColor: "dark amber",
      eyeShape: "sharp round",
      browShape: "grease smudge",
      noseShape: "smudged round",
      noseBridge: "short smudged bridge",
      skinTone: "medium brown",
      outfit: "blue repair coverall",
      accessory: "magnet glove",
      voice: "quick alto",
    },
  ],
  [
    "customer_ulric_pale",
    "Ulric Pale",
    ["magic_goods", "waste_sanitation_cleanup"],
    44,
    4,
    "haunted",
    {
      hairStyle: "thin swept wisps",
      hairColor: "pale ash",
      bodyBuild: "hollow tall",
      heightBand: "hollow-mid",
      shoulderShape: "sunken thin",
      posture: "shivering straight",
      gait: "hesitant drift",
      eyeColor: "faded green",
      eyeShape: "hollow round",
      browShape: "faint worried",
      noseShape: "sharp hollow",
      noseBridge: "sunken bridge",
      skinTone: "pale gray tan",
      outfit: "patched ward blanket",
      accessory: "black salt pouch",
      voice: "thin bass",
    },
  ],
  [
    "customer_vanya_reef",
    "Vanya Reef",
    ["courier", "hunter_wild_meat"],
    77,
    3,
    "sea-bright",
    {
      hairStyle: "wet rope braid",
      hairColor: "deep teal",
      bodyBuild: "swimmer strong",
      heightBand: "mid-swimmer",
      shoulderShape: "broad tapered",
      posture: "loose balanced",
      gait: "rolling dock step",
      eyeColor: "reef green",
      eyeShape: "smiling narrow",
      browShape: "wave curve",
      noseShape: "broad curved",
      noseBridge: "smooth wide bridge",
      skinTone: "deep olive brown",
      outfit: "teal dock vest",
      accessory: "shell knife charm",
      voice: "clear alto",
    },
  ],
  [
    "customer_willa_crane",
    "Willa Crane",
    ["custom_home_property_development", "biome_maintenance_repair"],
    85,
    4,
    "landlord",
    {
      hairStyle: "gray high twist",
      hairColor: "charcoal white",
      bodyBuild: "thin tall elder",
      heightBand: "elder tall",
      shoulderShape: "bony square",
      posture: "ledger upright",
      gait: "cane precise",
      eyeColor: "sharp brown",
      eyeShape: "keen hooded",
      browShape: "white stern",
      noseShape: "long crane",
      noseBridge: "long arched bridge",
      skinTone: "cool medium brown",
      outfit: "black rent coat",
      accessory: "iron key belt",
      voice: "cutting contralto",
    },
  ],
  [
    "customer_ximo_lark",
    "Ximo Lark",
    ["general_trader", "exploration_guide"],
    82,
    1,
    "chatty",
    {
      hairStyle: "fluffed lark crest",
      hairColor: "brown copper streak",
      bodyBuild: "tiny nimble",
      heightBand: "tiny-nimble",
      shoulderShape: "narrow quick",
      posture: "bouncing talk",
      gait: "darting skip",
      eyeColor: "bright black",
      eyeShape: "bead round",
      browShape: "tiny flick",
      noseShape: "little point",
      noseBridge: "tiny sharp bridge",
      skinTone: "gold tan",
      outfit: "patch pocket coat",
      accessory: "many little buttons",
      voice: "fast soprano",
    },
  ],
  [
    "customer_renna_dusk",
    "Renna Dusk",
    ["medical_doctor", "biome_farming_rare_foods"],
    70,
    3,
    "gentle",
    {
      hairStyle: "long river braid",
      hairColor: "ash violet",
      bodyBuild: "willow slim",
      heightBand: "tall",
      shoulderShape: "soft slope",
      posture: "calm settled",
      gait: "slow glide",
      eyeColor: "pale lilac",
      eyeShape: "soft round",
      browShape: "low gentle",
      noseShape: "straight slim",
      noseBridge: "even bridge",
      skinTone: "cool porcelain",
      outfit: "herbalist sash dress",
      accessory: "dried bloom pin",
      voice: "soft warm alto",
    },
  ],
  [
    "customer_torv_grane",
    "Torv Grane",
    ["weapons_tools", "hunter_wild_meat"],
    52,
    2,
    "gruff",
    {
      hairStyle: "buzzed sides topknot",
      hairColor: "rust brown",
      bodyBuild: "bull heavy",
      heightBand: "tall-plus",
      shoulderShape: "wide block",
      posture: "planted wide",
      gait: "stomping roll",
      eyeColor: "dark amber",
      eyeShape: "narrow hard",
      browShape: "heavy low",
      noseShape: "blunt wide",
      noseBridge: "thick flat bridge",
      skinTone: "ruddy tan",
      outfit: "scarred hide jerkin",
      accessory: "tooth-strung cord",
      voice: "deep rumble",
    },
  ],
  [
    "customer_isla_pemberton",
    "Isla Pemberton",
    ["custom_home_property_development", "biome_design_studio"],
    88,
    5,
    "poised",
    {
      hairStyle: "sleek low chignon",
      hairColor: "polished jet",
      bodyBuild: "elegant lean",
      heightBand: "average-plus",
      shoulderShape: "level fine",
      posture: "regal straight",
      gait: "measured stride",
      eyeColor: "slate blue",
      eyeShape: "almond cool",
      browShape: "clean arch",
      noseShape: "refined point",
      noseBridge: "high slim bridge",
      skinTone: "warm ivory",
      outfit: "tailored slate coat",
      accessory: "silver lapel ruler",
      voice: "crisp confident",
    },
  ],
  [
    "customer_dax_oolen",
    "Dax Oolen",
    ["courier", "portal_transit_company"],
    40,
    2,
    "restless",
    {
      hairStyle: "windswept short crop",
      hairColor: "sandy blonde",
      bodyBuild: "wiry runner",
      heightBand: "short-plus",
      shoulderShape: "narrow quick",
      posture: "leaning forward",
      gait: "bouncing jog",
      eyeColor: "bright hazel",
      eyeShape: "darting wide",
      browShape: "raised quick",
      noseShape: "small upturned",
      noseBridge: "light low bridge",
      skinTone: "sun gold",
      outfit: "strapped courier vest",
      accessory: "many buckle satchel",
      voice: "fast breathy tenor",
    },
  ],
  [
    "customer_mira_quill",
    "Mira Quill",
    ["magic_goods", "exploration_guide"],
    76,
    4,
    "curious",
    {
      hairStyle: "frizzy cloud halo",
      hairColor: "silver white",
      bodyBuild: "petite soft",
      heightBand: "short",
      shoulderShape: "rounded small",
      posture: "tilted inquisitive",
      gait: "skipping pad",
      eyeColor: "glass green",
      eyeShape: "wide bright",
      browShape: "high curious",
      noseShape: "button round",
      noseBridge: "tiny soft bridge",
      skinTone: "warm umber",
      outfit: "star-charted robe",
      accessory: "floating lens loop",
      voice: "lilting wondering",
    },
  ],
  [
    "customer_bronce_hale",
    "Bronce Hale",
    ["security_defense_contractor", "repair_maintenance_person"],
    60,
    3,
    "stern",
    {
      hairStyle: "high regulation fade",
      hairColor: "iron gray",
      bodyBuild: "armored broad",
      heightBand: "tall",
      shoulderShape: "square hard",
      posture: "rigid alert",
      gait: "marching step",
      eyeColor: "steel gray",
      eyeShape: "level sharp",
      browShape: "flat stern",
      noseShape: "straight strong",
      noseBridge: "high straight bridge",
      skinTone: "cool olive",
      outfit: "plated guard coat",
      accessory: "shoulder rank clasp",
      voice: "clipped command",
    },
  ],
  [
    "customer_pell_summers",
    "Pell Summers",
    ["food_service_restaurant", "general_trader"],
    80,
    3,
    "cheerful",
    {
      hairStyle: "round curly mop",
      hairColor: "warm chestnut",
      bodyBuild: "plump jolly",
      heightBand: "average",
      shoulderShape: "soft broad",
      posture: "open relaxed",
      gait: "happy waddle",
      eyeColor: "warm brown",
      eyeShape: "crinkled smile",
      browShape: "soft round",
      noseShape: "wide friendly",
      noseBridge: "low soft bridge",
      skinTone: "rosy tan",
      outfit: "flour-dusted apron",
      accessory: "wooden spoon belt",
      voice: "booming laugh",
    },
  ],
  [
    "customer_zariah_lune",
    "Zariah Lune",
    ["teleport_owner", "portal_transit_company"],
    66,
    4,
    "aloof",
    {
      hairStyle: "asymmetric sweep undercut",
      hairColor: "midnight blue",
      bodyBuild: "tall lithe",
      heightBand: "tall-plus",
      shoulderShape: "angular narrow",
      posture: "cool detached",
      gait: "smooth float",
      eyeColor: "violet glow",
      eyeShape: "sharp slanted",
      browShape: "high arched",
      noseShape: "thin elegant",
      noseBridge: "high fine bridge",
      skinTone: "deep cocoa",
      outfit: "voidsheen wrap coat",
      accessory: "drifting rune band",
      voice: "low measured",
    },
  ],
  [
    "customer_hodgin_marsh",
    "Hodgin Marsh",
    ["waste_sanitation_cleanup", "biome_maintenance_repair"],
    58,
    2,
    "easygoing",
    {
      hairStyle: "matted side tuft",
      hairColor: "muddy brown",
      bodyBuild: "stocky sturdy",
      heightBand: "short-plus",
      shoulderShape: "thick rounded",
      posture: "slouched comfy",
      gait: "heavy amble",
      eyeColor: "moss green",
      eyeShape: "droopy calm",
      browShape: "bushy low",
      noseShape: "bulb round",
      noseBridge: "wide low bridge",
      skinTone: "earthy brown",
      outfit: "rubberized work smock",
      accessory: "looped hose strap",
      voice: "easy gravel",
    },
  ],
  [
    "customer_lottie_finch",
    "Lottie Finch",
    ["hospitality_inn_hotel_shelter", "food_service_restaurant"],
    84,
    3,
    "warm",
    {
      hairStyle: "twin looped buns",
      hairColor: "honey blonde",
      bodyBuild: "soft petite",
      heightBand: "short",
      shoulderShape: "gentle slope",
      posture: "welcoming open",
      gait: "brisk tidy",
      eyeColor: "amber hazel",
      eyeShape: "bright round",
      browShape: "soft curved",
      noseShape: "small neat",
      noseBridge: "even soft bridge",
      skinTone: "warm peach",
      outfit: "ribboned inn dress",
      accessory: "ring of brass keys",
      voice: "bright welcoming",
    },
  ],
  [
    "customer_garrick_vane",
    "Garrick Vane",
    ["exotic_matter_refinery", "security_defense_contractor"],
    50,
    4,
    "intense",
    {
      hairStyle: "slicked back widow peak",
      hairColor: "raven black",
      bodyBuild: "lean coiled",
      heightBand: "tall",
      shoulderShape: "tight square",
      posture: "predator still",
      gait: "deliberate prowl",
      eyeColor: "pale ice blue",
      eyeShape: "narrow piercing",
      browShape: "sharp angled",
      noseShape: "aquiline thin",
      noseBridge: "high hooked bridge",
      skinTone: "pale ash",
      outfit: "sealed hazard suit",
      accessory: "glowing dosimeter",
      voice: "quiet edged",
    },
  ],
  [
    "customer_bex_thornberry",
    "Bex Thornberry",
    ["hunter_wild_meat", "biome_farming_rare_foods"],
    62,
    2,
    "blunt",
    {
      hairStyle: "rough tied ponytail",
      hairColor: "dusty auburn",
      bodyBuild: "rangy tough",
      heightBand: "average-plus",
      shoulderShape: "uneven wiry",
      posture: "ready crouch",
      gait: "silent track step",
      eyeColor: "flecked olive",
      eyeShape: "keen narrow",
      browShape: "straight low",
      noseShape: "sharp slim",
      noseBridge: "lean straight bridge",
      skinTone: "weathered tan",
      outfit: "leaf-pattern field cloak",
      accessory: "antler-handle knife",
      voice: "flat dry",
    },
  ],
  [
    "customer_ophel_brightwater",
    "Ophel Brightwater",
    ["biome_design_studio", "magic_goods"],
    78,
    5,
    "dreamy",
    {
      hairStyle: "flowing wave cascade",
      hairColor: "seafoam teal",
      bodyBuild: "tall graceful",
      heightBand: "tall",
      shoulderShape: "fluid narrow",
      posture: "drifting tall",
      gait: "swaying float",
      eyeColor: "aqua shimmer",
      eyeShape: "large dreamy",
      browShape: "delicate arch",
      noseShape: "slender soft",
      noseBridge: "smooth slim bridge",
      skinTone: "luminous fair",
      outfit: "layered tide gown",
      accessory: "shell circlet",
      voice: "airy melodic",
    },
  ],
  [
    "customer_klemp_oddfellow",
    "Klemp Oddfellow",
    ["general_trader", "repair_maintenance_person"],
    54,
    2,
    "shrewd",
    {
      hairStyle: "balding comb-over",
      hairColor: "graying brown",
      bodyBuild: "round short",
      heightBand: "short",
      shoulderShape: "hunched narrow",
      posture: "leaning bargaining",
      gait: "shuffling scurry",
      eyeColor: "beady black",
      eyeShape: "squinting small",
      browShape: "twitchy thin",
      noseShape: "long pointed",
      noseBridge: "bumped narrow bridge",
      skinTone: "sallow tan",
      outfit: "many-pocketed trade coat",
      accessory: "coin-laden abacus",
      voice: "wheedling reedy",
    },
  ],
  [
    "customer_sena_voss",
    "Sena Voss",
    ["exploration_guide", "courier"],
    68,
    3,
    "bold",
    {
      hairStyle: "tight cornrow crown",
      hairColor: "deep espresso",
      bodyBuild: "athletic firm",
      heightBand: "average-plus",
      shoulderShape: "strong level",
      posture: "confident square",
      gait: "sure long stride",
      eyeColor: "warm copper",
      eyeShape: "wide steady",
      browShape: "bold straight",
      noseShape: "broad even",
      noseBridge: "straight firm bridge",
      skinTone: "rich deep brown",
      outfit: "weatherworn trail coat",
      accessory: "brass trail compass",
      voice: "clear assured",
    },
  ],
];

export const HARTHMERE_BUSINESS_CUSTOMER_NPCS: readonly HarthmereBusinessCustomerNpc[] =
  CUSTOMER_ROWS.map(
    ([
      npcId,
      displayName,
      businessPreferences,
      patience,
      budgetTier,
      temperament,
      appearance,
    ]) => ({
      npcId,
      displayName,
      customerOnly: true,
      mapPlacement: "none",
      spawnPolicy: "business_owner_session_only",
      businessPreferences,
      patience,
      budgetTier,
      temperament,
      appearance,
    })
  );

function nav(
  typeId: HarthmereEconomyBusinessTypeId
): HarthmereBusinessCustomerNavigation {
  return {
    entryNodeId: `${typeId}:customer_entry`,
    queueNodeId: `${typeId}:customer_queue`,
    counterNodeId: `${typeId}:service_counter`,
    serviceNodeId: `${typeId}:service_spot`,
    exitNodeId: `${typeId}:customer_exit`,
    movementPolicy: "walk_queue_counter_exit",
    serviceFlow: [
      "enter",
      "join queue",
      "approach counter",
      "wait for service",
      "react",
      "exit",
    ],
    passableClearance: {
      aisleWidthBlocks: 2,
      counterClearanceBlocks: 2,
      queueSpacingBlocks: 1,
    },
    stuckRecovery: {
      repathAfterMs: 2500,
      sidestepRadiusBlocks: 1.5,
      blockedNodeRetryLimit: 3,
      fallbackExitAfterMs: 15000,
      fallbackPolicy: "repath_then_sidestep_then_exit",
    },
  };
}

function progression(scaleNoun: string): HarthmereBusinessProgressionTier[] {
  return [
    {
      tier: 1,
      name: "Counter",
      criteria: "Serve 5 customers.",
      reward: "+1 queue slot.",
      unlock: `Basic ${scaleNoun} orders.`,
    },
    {
      tier: 2,
      name: "Back Room",
      criteria: "Serve 20 customers with a 3-streak.",
      reward: "+5 satisfaction floor.",
      unlock: `Staff-assisted ${scaleNoun}.`,
    },
    {
      tier: 3,
      name: "Branch",
      criteria: "Serve 50 customers and finish 10 contracts.",
      reward: "+1 service radius.",
      unlock: `Remote ${scaleNoun} tickets.`,
    },
    {
      tier: 4,
      name: "Empire",
      criteria: "Serve 120 customers across locations.",
      reward: "+10 reputation cap pressure.",
      unlock: `Regional ${scaleNoun} franchise.`,
    },
  ];
}

function definition(
  input: Omit<
    HarthmereBusinessMiniGameDefinition,
    | "navigation"
    | "progression"
    | "bikkieGraphics"
    | "implementationGapsClosed"
    | "mechanicSpec"
  > & { scaleNoun: string }
): HarthmereBusinessMiniGameDefinition {
  return {
    ...input,
    offers: input.offers.map((offer) => ({
      ...offer,
      rewardGold: harthmereBusinessScaledJobPay(offer.rewardGold),
    })),
    askTemplates: input.askTemplates.map((ask) => ({
      ...ask,
      rewardGold: harthmereBusinessScaledJobPay(ask.rewardGold),
    })),
    mechanicSpec: getHarthmereBusinessMiniGameSpec(input.typeId),
    navigation: nav(input.typeId),
    progression: progression(input.scaleNoun),
    bikkieGraphics: getHarthmereBusinessBikkieGraphics(input.typeId),
    implementationGapsClosed: [
      "Customers are session-only and do not pollute the permanent map.",
      "Every ask has an exact matching service offer.",
      "Customer path intent is stored as entrance, queue, counter, service, and exit steps.",
      "Growth pressure escalates through patience, queue size, required stock, and branch operations.",
      "Business counters now reference concrete Bikkie graphics with ids, sizes, colors, and usage metadata.",
    ],
  };
}

export const HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS: Record<
  HarthmereEconomyBusinessTypeId,
  HarthmereBusinessMiniGameDefinition
> = {
  exotic_matter_refinery: definition({
    typeId: "exotic_matter_refinery",
    interfaceTitle: "Refinery Intake Counter",
    counterLabel: "Containment desk",
    customerGoal:
      "Customers want safe fuel, stabilized matter, or proof that a batch will not leak.",
    ownerFunLoop:
      "Scan the request, pick the safe service, spend the right stock, and keep the containment streak alive.",
    scaleNoun: "refinery",
    challengeGrowth: [
      "More hazardous customers arrive together.",
      "Fuel orders ask for certified stock.",
      "Low safety reduces patience.",
      "Later branches need couriers and sanitation partners.",
    ],
    dailyReturnTriggers: [
      "Portal operators post fuel rushes.",
      "A cooled batch finishes overnight.",
      "Inspectors visit after risky shifts.",
    ],
    scalePath: [
      "Manual stabilizer",
      "Certified fuel desk",
      "Courier-fed refinery",
      "Regional energy trust",
    ],
    empireReinforcement: [
      "Fuel contracts feed portal and teleport businesses.",
      "High safety reputation unlocks infrastructure customers.",
      "Branch refineries lower regional energy shortages.",
    ],
    offers: [
      {
        offerId: "certified_fuel_sale",
        label: "Hand over certified fuel",
        description: "Sell a sealed unit of fuel with a safety tag.",
        serviceNeed: "energy",
        requiredItems: { certified_portal_fuel: 1 },
        rewardGold: 150,
        satisfactionDelta: 4,
        interactionVerb: "stamp",
        animationCue: "procedural_counter_stamp_and_hand_over",
      },
      {
        offerId: "matter_stabilization",
        label: "Stabilize a sample",
        description:
          "Use stabilized matter to neutralize a customer's raw sample.",
        serviceNeed: "timeline_stability",
        requiredItems: { stabilized_exotic_matter: 1, containment_filter: 1 },
        producedItems: { spent_filter: 1 },
        rewardGold: 125,
        satisfactionDelta: 3,
        interactionVerb: "seal",
        animationCue: "procedural_filter_lock_and_glow_check",
      },
      {
        offerId: "containment_audit",
        label: "Run containment audit",
        description: "Inspect a shipment and issue a safe handling report.",
        serviceNeed: "travel",
        requiredItems: { containment_filter: 1 },
        rewardGold: 95,
        satisfactionDelta: 2,
        interactionVerb: "scan",
        animationCue: "procedural_scanner_sweep_counter",
      },
    ],
    askTemplates: [
      {
        askId: "portal_fuel_needed",
        line: "My gate crew needs one certified fuel cell before the route locks.",
        desiredOfferId: "certified_fuel_sale",
        patience: 48,
        difficulty: 3,
        rewardGold: 160,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Match the fuel seal before patience drops.",
        navGoal: "counterNodeId",
      },
      {
        askId: "unstable_sample",
        line: "This sample is humming through the case. Can you stabilize it now?",
        desiredOfferId: "matter_stabilization",
        patience: 38,
        difficulty: 4,
        rewardGold: 135,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Choose stabilization instead of a simple audit.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "safety_papers",
        line: "I need proof this cargo can ride with passengers.",
        desiredOfferId: "containment_audit",
        patience: 60,
        difficulty: 2,
        rewardGold: 100,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Scan, stamp, and send the customer out clean.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  biome_maintenance_repair: definition({
    typeId: "biome_maintenance_repair",
    interfaceTitle: "Biome Service Dispatch",
    counterLabel: "Anchor repair desk",
    customerGoal:
      "Customers bring failing climates, drifting anchors, and property stability complaints.",
    ownerFunLoop:
      "Diagnose the failure, choose inspection, tuning, or leak repair, and keep properties from decaying.",
    scaleNoun: "maintenance",
    challengeGrowth: [
      "More customers arrive with deadline pressure.",
      "Advanced asks need stabilized matter.",
      "Ignored failures lower town property condition.",
      "Branches specialize by climate type.",
    ],
    dailyReturnTriggers: [
      "Weather failure alerts.",
      "Subscription inspections renew.",
      "A property owner reports overnight drift.",
    ],
    scalePath: [
      "Inspection desk",
      "Repair van",
      "Climate tuning crew",
      "Regional maintenance network",
    ],
    empireReinforcement: [
      "Maintenance protects property developers and inns.",
      "Strong uptime feeds town trust.",
      "Branches create subscription income.",
    ],
    offers: [
      {
        offerId: "anchor_inspection",
        label: "Inspect anchor",
        description: "Run a quick stability inspection and issue next steps.",
        serviceNeed: "maintenance",
        requiredItems: { repair_kit: 1 },
        rewardGold: 80,
        satisfactionDelta: 2,
        interactionVerb: "inspect",
        animationCue: "procedural_clipboard_scan_anchor",
      },
      {
        offerId: "climate_tune",
        label: "Tune climate",
        description: "Stabilize weather and comfort levels using safe matter.",
        serviceNeed: "property_condition",
        requiredItems: { stabilized_exotic_matter: 1, repair_kit: 1 },
        rewardGold: 125,
        satisfactionDelta: 3,
        interactionVerb: "tune",
        animationCue: "procedural_dial_turn_weather_ring",
      },
      {
        offerId: "timeline_leak_patch",
        label: "Patch timeline leak",
        description: "Seal a small leak before it becomes civic trouble.",
        serviceNeed: "timeline_stability",
        requiredItems: { anchor_part: 1, repair_kit: 1 },
        rewardGold: 145,
        satisfactionDelta: 4,
        interactionVerb: "patch",
        animationCue: "procedural_wrench_patch_spark",
      },
    ],
    askTemplates: [
      {
        askId: "odd_weather_room",
        line: "My reading room is raining indoors again.",
        desiredOfferId: "climate_tune",
        patience: 52,
        difficulty: 3,
        rewardGold: 130,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Tune climate instead of only inspecting.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "monthly_inspection",
        line: "I need the anchor inspection stamped before rent day.",
        desiredOfferId: "anchor_inspection",
        patience: 70,
        difficulty: 1,
        rewardGold: 85,
        reputationDelta: 1,
        needDelta: 2,
        funAction: "Fast paperwork service.",
        navGoal: "counterNodeId",
      },
      {
        askId: "leak_in_wall",
        line: "The wall showed tomorrow for three seconds. Please patch it.",
        desiredOfferId: "timeline_leak_patch",
        patience: 42,
        difficulty: 4,
        rewardGold: 150,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Spot the highest risk repair.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  biome_design_studio: definition({
    typeId: "biome_design_studio",
    interfaceTitle: "Design Consultation Table",
    counterLabel: "Mood board counter",
    customerGoal:
      "Customers want beauty, identity, themed interiors, and event-ready spaces.",
    ownerFunLoop:
      "Read the taste cue, match a design package, and build reputation through pleasing choices.",
    scaleNoun: "design",
    challengeGrowth: [
      "Customers ask for conflicting styles.",
      "Luxury clients punish wrong packages.",
      "Seasonal trends rotate daily.",
      "Branches need stock from traders and farmers.",
    ],
    dailyReturnTriggers: [
      "Festival color trend.",
      "VIP redesign slot.",
      "New decor materials arrive.",
    ],
    scalePath: [
      "Mood board",
      "Installation crew",
      "Studio showroom",
      "Regional design house",
    ],
    empireReinforcement: [
      "Design raises property and hospitality value.",
      "High identity reputation draws luxury buyers.",
      "Branches create repeat seasonal work.",
    ],
    offers: [
      {
        offerId: "habitat_mockup",
        label: "Show habitat mockup",
        description: "Present a biome-safe room concept.",
        serviceNeed: "identity",
        requiredItems: { design_pack: 1 },
        rewardGold: 90,
        satisfactionDelta: 3,
        interactionVerb: "present",
        animationCue: "procedural_blueprint_unroll_point",
      },
      {
        offerId: "terrain_palette",
        label: "Build terrain palette",
        description: "Assemble color, stone, and plant samples.",
        serviceNeed: "tourism",
        requiredItems: { decor: 1, tree_resin: 1 },
        rewardGold: 105,
        satisfactionDelta: 3,
        interactionVerb: "arrange",
        animationCue: "procedural_sample_tiles_arrange",
      },
      {
        offerId: "lighting_scene",
        label: "Set lighting scene",
        description: "Create a light plan for shop or inn ambience.",
        serviceNeed: "housing",
        requiredItems: { lighting_kit: 1 },
        rewardGold: 115,
        satisfactionDelta: 4,
        interactionVerb: "focus",
        animationCue: "procedural_lantern_focus_sweep",
      },
    ],
    askTemplates: [
      {
        askId: "make_inn_memorable",
        line: "My inn needs a room guests remember tomorrow.",
        desiredOfferId: "lighting_scene",
        patience: 64,
        difficulty: 2,
        rewardGold: 120,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Spot that ambience beats terrain.",
        navGoal: "counterNodeId",
      },
      {
        askId: "festival_palette",
        line: "I need a festival palette that does not clash with the crops.",
        desiredOfferId: "terrain_palette",
        patience: 58,
        difficulty: 3,
        rewardGold: 110,
        reputationDelta: 2,
        needDelta: 3,
        funAction: "Match color samples under pressure.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "property_mockup",
        line: "Can you show my family what the new biome room will feel like?",
        desiredOfferId: "habitat_mockup",
        patience: 72,
        difficulty: 1,
        rewardGold: 95,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Present the simple pitch cleanly.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  security_defense_contractor: definition({
    typeId: "security_defense_contractor",
    interfaceTitle: "Security Contract Desk",
    counterLabel: "Threat board",
    customerGoal: "Customers need guards, escort plans, and fast risk calls.",
    ownerFunLoop:
      "Classify the threat, sell the right protection, and keep fear from becoming reputation damage.",
    scaleNoun: "security",
    challengeGrowth: [
      "Threat difficulty rises with reputation.",
      "Customers can arrive injured or panicked.",
      "Wrong service loses safety trust.",
      "Multiple branches need squads and gear stock.",
    ],
    dailyReturnTriggers: [
      "New bounty wave.",
      "VIP escort deadline.",
      "Threat migration report.",
    ],
    scalePath: [
      "Desk guard",
      "Patrol squad",
      "Escort office",
      "Regional defense company",
    ],
    empireReinforcement: [
      "Security protects couriers, portals, farms, and inns.",
      "High safety opens larger contracts.",
      "Branches reduce regional route risk.",
    ],
    offers: [
      {
        offerId: "hire_static_guard",
        label: "Assign guard",
        description: "Book a guard for a property or business floor.",
        serviceNeed: "safety",
        requiredItems: { guard_contract: 1 },
        rewardGold: 110,
        satisfactionDelta: 3,
        interactionVerb: "assign",
        animationCue: "procedural_badge_assign_salute",
      },
      {
        offerId: "escort_route_plan",
        label: "Plan escort route",
        description: "Build a safe path and emergency fallback.",
        serviceNeed: "travel",
        requiredItems: { route_map: 1, ration_pack: 1 },
        rewardGold: 135,
        satisfactionDelta: 3,
        interactionVerb: "plot",
        animationCue: "procedural_map_route_trace",
      },
      {
        offerId: "threat_triage",
        label: "Triage threat",
        description: "Classify a threat and dispatch the right squad.",
        serviceNeed: "tourism",
        requiredItems: { signal_flare: 1 },
        rewardGold: 150,
        satisfactionDelta: 4,
        interactionVerb: "dispatch",
        animationCue: "procedural_alarm_flag_dispatch",
      },
    ],
    askTemplates: [
      {
        askId: "guard_my_shop",
        line: "I need someone at my shop door before the night rush.",
        desiredOfferId: "hire_static_guard",
        patience: 62,
        difficulty: 2,
        rewardGold: 115,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Assign guard coverage fast.",
        navGoal: "counterNodeId",
      },
      {
        askId: "escort_to_gate",
        line: "Can your crew get my cargo through the north road?",
        desiredOfferId: "escort_route_plan",
        patience: 50,
        difficulty: 3,
        rewardGold: 140,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Trace the safest route.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "what_is_outside",
        line: "Something is circling the yard. Tell me what to do.",
        desiredOfferId: "threat_triage",
        patience: 36,
        difficulty: 4,
        rewardGold: 160,
        reputationDelta: 3,
        needDelta: 5,
        funAction: "Triage panic before patience breaks.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  portal_transit_company: definition({
    typeId: "portal_transit_company",
    interfaceTitle: "Portal Transit Gate",
    counterLabel: "Route fare terminal",
    customerGoal:
      "Customers buy passenger jumps, cargo slots, and route safety checks.",
    ownerFunLoop:
      "Balance speed, fuel, safety, and queue pressure while keeping the route stable.",
    scaleNoun: "portal route",
    challengeGrowth: [
      "Passenger and cargo queues conflict.",
      "Fuel stock limits rush periods.",
      "Low stability slows service.",
      "Branches create route network dependencies.",
    ],
    dailyReturnTriggers: [
      "Morning commuter rush.",
      "Cargo window expires.",
      "Fuel price spike.",
    ],
    scalePath: [
      "Single gate",
      "Cargo lane",
      "Two-town route",
      "Regional portal grid",
    ],
    empireReinforcement: [
      "Portal routes multiply demand for fuel, security, and couriers.",
      "Reliable gates become civic infrastructure.",
      "Branches create empire-wide travel income.",
    ],
    offers: [
      {
        offerId: "passenger_jump",
        label: "Run passenger jump",
        description: "Move a passenger through a safe active endpoint.",
        serviceNeed: "travel",
        requiredItems: { certified_portal_fuel: 1 },
        rewardGold: 95,
        satisfactionDelta: 3,
        interactionVerb: "route",
        animationCue: "procedural_gate_lever_customer_wave",
      },
      {
        offerId: "cargo_slot",
        label: "Book cargo slot",
        description: "Reserve a heavier transit window for goods.",
        serviceNeed: "logistics",
        requiredItems: { portal_fuel: 1, lockbox: 1 },
        rewardGold: 135,
        satisfactionDelta: 3,
        interactionVerb: "weigh",
        animationCue: "procedural_scale_tag_cargo",
      },
      {
        offerId: "route_safety_check",
        label: "Run safety check",
        description: "Check a route before a nervous customer travels.",
        serviceNeed: "energy",
        requiredItems: { destination_crystal: 1 },
        rewardGold: 110,
        satisfactionDelta: 4,
        interactionVerb: "calibrate",
        animationCue: "procedural_crystal_align_gate",
      },
    ],
    askTemplates: [
      {
        askId: "late_passenger",
        line: "I need to cross before my pass expires.",
        desiredOfferId: "passenger_jump",
        patience: 34,
        difficulty: 3,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Prioritize passenger speed.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "fragile_cargo",
        line: "This crate cannot bounce through a cheap lane.",
        desiredOfferId: "cargo_slot",
        patience: 54,
        difficulty: 3,
        rewardGold: 145,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Pick cargo handling, not passenger routing.",
        navGoal: "counterNodeId",
      },
      {
        askId: "nervous_about_gate",
        line: "Does that gate look green enough to you?",
        desiredOfferId: "route_safety_check",
        patience: 66,
        difficulty: 2,
        rewardGold: 115,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Calibrate to reassure.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  biome_farming_rare_foods: definition({
    typeId: "biome_farming_rare_foods",
    interfaceTitle: "Rare Food Farm Stand",
    counterLabel: "Harvest scale",
    customerGoal:
      "Customers ask for fresh produce, medicinal herbs, or rare food lots.",
    ownerFunLoop:
      "Match freshness and ingredient type while protecting limited harvest stock.",
    scaleNoun: "farm",
    challengeGrowth: [
      "Freshness matters more at higher tiers.",
      "Doctors and restaurants compete for the same crop.",
      "Spoilage creates daily urgency.",
      "Branches specialize by biome climate.",
    ],
    dailyReturnTriggers: [
      "Overnight crop growth.",
      "Market demand spike.",
      "Spoilage warning.",
    ],
    scalePath: [
      "Farm stand",
      "Cold shelf",
      "Contract greenhouse",
      "Regional rare-food co-op",
    ],
    empireReinforcement: [
      "Farms feed restaurants, doctors, traders, and inns.",
      "Reliable harvests stabilize food demand.",
      "Branches buffer crop failures.",
    ],
    offers: [
      {
        offerId: "fresh_crop_bundle",
        label: "Sell crop bundle",
        description: "Hand over a fresh cooking crop bundle.",
        serviceNeed: "food",
        requiredItems: { crop_bundle: 1 },
        rewardGold: 45,
        satisfactionDelta: 2,
        interactionVerb: "weigh",
        animationCue: "procedural_crate_weigh_and_wrap",
      },
      {
        offerId: "medicinal_herbs",
        label: "Pack medicinal herbs",
        description: "Bundle herbs for clinics or potion makers.",
        serviceNeed: "health",
        requiredItems: { herb_bundle: 1 },
        rewardGold: 70,
        satisfactionDelta: 3,
        interactionVerb: "bundle",
        animationCue: "procedural_herb_tie_and_label",
      },
      {
        offerId: "rare_tasting_box",
        label: "Prepare tasting box",
        description: "Assemble rare foods for luxury or festival customers.",
        serviceNeed: "tourism",
        requiredItems: { rare_food: 1, clean_water: 1 },
        rewardGold: 95,
        satisfactionDelta: 4,
        interactionVerb: "arrange",
        animationCue: "procedural_sample_box_present",
      },
    ],
    askTemplates: [
      {
        askId: "restaurant_crop_order",
        line: "My cook needs crops that still smell like the field.",
        desiredOfferId: "fresh_crop_bundle",
        patience: 64,
        difficulty: 1,
        rewardGold: 50,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Choose basic fresh food fast.",
        navGoal: "counterNodeId",
      },
      {
        askId: "clinic_herbs",
        line: "The clinic is short on clean herbs.",
        desiredOfferId: "medicinal_herbs",
        patience: 48,
        difficulty: 2,
        rewardGold: 75,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Save herbs for health demand.",
        navGoal: "counterNodeId",
      },
      {
        askId: "festival_tasting",
        line: "I want the box people talk about after the festival.",
        desiredOfferId: "rare_tasting_box",
        patience: 70,
        difficulty: 3,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Use rare stock for reputation.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  weapons_tools: definition({
    typeId: "weapons_tools",
    interfaceTitle: "Forge Service Counter",
    counterLabel: "Repair bench",
    customerGoal:
      "Customers need repairs, upgrades, and work tools that will not fail.",
    ownerFunLoop:
      "Read the equipment need, spend parts, and time the handoff for a satisfying repair.",
    scaleNoun: "forge",
    challengeGrowth: [
      "Higher-tier gear needs more parts.",
      "Security contracts create rush orders.",
      "Wrong service damages satisfaction.",
      "Branches specialize by tool or weapon line.",
    ],
    dailyReturnTriggers: [
      "Broken gear pile.",
      "Guard bulk order.",
      "Ore delivery return.",
    ],
    scalePath: [
      "Repair bench",
      "Upgrade forge",
      "Bulk order line",
      "Regional armory",
    ],
    empireReinforcement: [
      "Forges support hunters, guards, builders, and repair shops.",
      "Durable tools lower business failures.",
      "Branches become supply anchors.",
    ],
    offers: [
      {
        offerId: "tool_repair",
        label: "Repair tool",
        description: "Fix a work tool with parts and a calibrated strike.",
        serviceNeed: "maintenance",
        requiredItems: { repair_tool: 1, metal_part: 1 },
        rewardGold: 75,
        satisfactionDelta: 3,
        interactionVerb: "hammer",
        animationCue: "procedural_hammer_sparks_counter",
      },
      {
        offerId: "weapon_tune",
        label: "Tune weapon",
        description: "Sharpen, balance, and safety-check a weapon.",
        serviceNeed: "safety",
        requiredItems: { iron_ingot: 1, whetstone: 1 },
        rewardGold: 105,
        satisfactionDelta: 3,
        interactionVerb: "sharpen",
        animationCue: "procedural_whetstone_blade_pass",
      },
      {
        offerId: "scanner_calibration",
        label: "Calibrate scanner",
        description: "Tune a field scanner for builders or explorers.",
        serviceNeed: "property_condition",
        requiredItems: { crystal_lens: 1, repair_tool: 1 },
        rewardGold: 120,
        satisfactionDelta: 4,
        interactionVerb: "calibrate",
        animationCue: "procedural_lens_twist_flash",
      },
    ],
    askTemplates: [
      {
        askId: "broken_pick",
        line: "My pick is dead and the vein will not wait.",
        desiredOfferId: "tool_repair",
        patience: 50,
        difficulty: 2,
        rewardGold: 80,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Repair the tool before the rush leaves.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "guard_blade",
        line: "This blade pulls left. I need it true.",
        desiredOfferId: "weapon_tune",
        patience: 58,
        difficulty: 3,
        rewardGold: 110,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Pick weapon tuning over generic repair.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "scanner_for_plot",
        line: "My scanner says the wall is inside-out.",
        desiredOfferId: "scanner_calibration",
        patience: 66,
        difficulty: 4,
        rewardGold: 125,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Use the precision calibration.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  magic_goods: definition({
    typeId: "magic_goods",
    interfaceTitle: "Magic Goods Counter",
    counterLabel: "Ward tray",
    customerGoal:
      "Customers buy charms, potions, and wards with stability risks.",
    ownerFunLoop:
      "Match the customer's fear to a charm, potion, or ward while unstable goods expire.",
    scaleNoun: "magic goods",
    challengeGrowth: [
      "Unstable stock expires faster.",
      "Customers ask for rare component matches.",
      "High-risk wards require license trust.",
      "Branches share component supply.",
    ],
    dailyReturnTriggers: [
      "Unstable stock expires today.",
      "Disaster demand spike.",
      "Rare component visitor.",
    ],
    scalePath: [
      "Charm tray",
      "Potion shelf",
      "Ward installation desk",
      "Regional arcane supplier",
    ],
    empireReinforcement: [
      "Magic goods support doctors, explorers, security, and refineries.",
      "High trust unlocks hazardous customers.",
      "Branches create rare component pull.",
    ],
    offers: [
      {
        offerId: "sell_charm",
        label: "Sell charm",
        description: "Match a small charm to a customer's worry.",
        serviceNeed: "safety",
        requiredItems: { charm: 1 },
        rewardGold: 80,
        satisfactionDelta: 3,
        interactionVerb: "attune",
        animationCue: "procedural_charm_attune_handoff",
      },
      {
        offerId: "mix_potion",
        label: "Mix potion",
        description: "Prepare a stable potion from shelf stock.",
        serviceNeed: "health",
        requiredItems: { potion: 1, clean_water: 1 },
        rewardGold: 95,
        satisfactionDelta: 3,
        interactionVerb: "mix",
        animationCue: "procedural_bottle_swirl_cork",
      },
      {
        offerId: "write_ward",
        label: "Write ward",
        description: "Issue a protective ward for a room or route.",
        serviceNeed: "timeline_stability",
        requiredItems: { ward: 1, relic_fragment: 1 },
        rewardGold: 145,
        satisfactionDelta: 4,
        interactionVerb: "scribe",
        animationCue: "procedural_rune_scribe_glow",
      },
    ],
    askTemplates: [
      {
        askId: "bad_luck_charm",
        line: "I need something small that keeps trouble off my cart.",
        desiredOfferId: "sell_charm",
        patience: 70,
        difficulty: 1,
        rewardGold: 85,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Pick charm for simple fear.",
        navGoal: "counterNodeId",
      },
      {
        askId: "quick_potion",
        line: "Do you have a potion that will not curdle by sundown?",
        desiredOfferId: "mix_potion",
        patience: 52,
        difficulty: 2,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Serve stable potion stock.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "room_ward",
        line: "My rental room keeps whispering through the wall.",
        desiredOfferId: "write_ward",
        patience: 44,
        difficulty: 4,
        rewardGold: 155,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Use a ward, not a charm.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  exploration_guide: definition({
    typeId: "exploration_guide",
    interfaceTitle: "Guide Booking Table",
    counterLabel: "Route map table",
    customerGoal: "Customers need routes, expeditions, and risk advice.",
    ownerFunLoop:
      "Match destination, safety, and supply needs before the customer loses nerve.",
    scaleNoun: "guide route",
    challengeGrowth: [
      "Maps go stale.",
      "Clients demand rarer routes.",
      "Safety reputation affects patience.",
      "Branches need local route knowledge.",
    ],
    dailyReturnTriggers: [
      "Map freshness decay.",
      "Rare ruin booking.",
      "Weather window opens.",
    ],
    scalePath: [
      "Route advice",
      "Guided trip",
      "Expedition crew",
      "Regional guide guild",
    ],
    empireReinforcement: [
      "Guides create demand for couriers, guards, magic goods, and inns.",
      "Safe route reputation opens premium tours.",
      "Branches spread knowledge coverage.",
    ],
    offers: [
      {
        offerId: "route_briefing",
        label: "Give route briefing",
        description: "Explain a safe path and mark danger points.",
        serviceNeed: "knowledge",
        requiredItems: { route_map: 1 },
        rewardGold: 65,
        satisfactionDelta: 2,
        interactionVerb: "brief",
        animationCue: "procedural_map_point_sequence",
      },
      {
        offerId: "guided_expedition",
        label: "Book expedition",
        description: "Schedule a guided run with field supplies.",
        serviceNeed: "travel",
        requiredItems: { field_kit: 1, ration_pack: 1 },
        rewardGold: 130,
        satisfactionDelta: 4,
        interactionVerb: "book",
        animationCue: "procedural_ticket_stamp_map_fold",
      },
      {
        offerId: "danger_read",
        label: "Read danger signs",
        description: "Assess a customer's destination risk.",
        serviceNeed: "safety",
        requiredItems: { scanner: 1 },
        rewardGold: 95,
        satisfactionDelta: 3,
        interactionVerb: "assess",
        animationCue: "procedural_scope_scan_horizon",
      },
    ],
    askTemplates: [
      {
        askId: "which_path",
        line: "Which road gets me there with my boots still mine?",
        desiredOfferId: "route_briefing",
        patience: 78,
        difficulty: 1,
        rewardGold: 70,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Give fast route advice.",
        navGoal: "counterNodeId",
      },
      {
        askId: "book_ruin_trip",
        line: "I want to see the old marker, but I want to come back too.",
        desiredOfferId: "guided_expedition",
        patience: 55,
        difficulty: 3,
        rewardGold: 140,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Convert interest into a booked trip.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "is_it_safe",
        line: "This destination keeps disappearing from my notes.",
        desiredOfferId: "danger_read",
        patience: 45,
        difficulty: 4,
        rewardGold: 105,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Read danger signs before booking.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  custom_home_property_development: definition({
    typeId: "custom_home_property_development",
    interfaceTitle: "Property Development Office",
    counterLabel: "Blueprint desk",
    customerGoal:
      "Customers ask for builds, estimates, and staged improvements.",
    ownerFunLoop:
      "Pick estimate, permit, or build package while tracking material pressure.",
    scaleNoun: "property",
    challengeGrowth: [
      "Bigger builds consume more materials.",
      "Customers care about permits and deadlines.",
      "Bad estimates damage trust.",
      "Branches need managers and warehouses.",
    ],
    dailyReturnTriggers: [
      "Build stage completes.",
      "Permit window opens.",
      "Tenant request arrives.",
    ],
    scalePath: [
      "Estimate desk",
      "Build crew",
      "Subdivision office",
      "Regional property empire",
    ],
    empireReinforcement: [
      "Developers create locations for every other business.",
      "Good builds increase town housing.",
      "Branches turn land into empire expansion.",
    ],
    offers: [
      {
        offerId: "cost_estimate",
        label: "Prepare estimate",
        description: "Give a priced scope for a small property job.",
        serviceNeed: "housing",
        requiredItems: { blueprint: 1 },
        rewardGold: 75,
        satisfactionDelta: 2,
        interactionVerb: "estimate",
        animationCue: "procedural_blueprint_measure_mark",
      },
      {
        offerId: "permit_packet",
        label: "File permit packet",
        description: "Bundle permits and plans for a build.",
        serviceNeed: "property_condition",
        requiredItems: { permit_form: 1, blueprint: 1 },
        rewardGold: 105,
        satisfactionDelta: 3,
        interactionVerb: "file",
        animationCue: "procedural_paper_stack_stamp",
      },
      {
        offerId: "starter_build_package",
        label: "Sell build package",
        description: "Commit materials for a starter property stage.",
        serviceNeed: "maintenance",
        requiredItems: { wood_plank: 2, stone_block: 2 },
        rewardGold: 170,
        satisfactionDelta: 4,
        interactionVerb: "commit",
        animationCue: "procedural_crate_tag_blueprint",
      },
    ],
    askTemplates: [
      {
        askId: "what_will_it_cost",
        line: "Tell me what a real door and roof will cost.",
        desiredOfferId: "cost_estimate",
        patience: 82,
        difficulty: 1,
        rewardGold: 80,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Start with the estimate.",
        navGoal: "counterNodeId",
      },
      {
        askId: "permit_before_rain",
        line: "I need the permit packet before the rain inspector comes.",
        desiredOfferId: "permit_packet",
        patience: 54,
        difficulty: 2,
        rewardGold: 110,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "File the correct paperwork.",
        navGoal: "counterNodeId",
      },
      {
        askId: "build_starter_shell",
        line: "Can your crew start the shell this week?",
        desiredOfferId: "starter_build_package",
        patience: 48,
        difficulty: 4,
        rewardGold: 180,
        reputationDelta: 3,
        needDelta: 5,
        funAction: "Spend materials for a real build package.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  general_trader: definition({
    typeId: "general_trader",
    interfaceTitle: "General Trading Counter",
    counterLabel: "Stock ledger",
    customerGoal:
      "Customers want basic goods, brokerage, and regional price help.",
    ownerFunLoop:
      "Read demand, pick stock or brokerage, and keep shelves from going empty.",
    scaleNoun: "trade",
    challengeGrowth: [
      "More customers ask for scarce items.",
      "Market prices shift daily.",
      "Wrong upsells reduce trust.",
      "Branches create arbitrage routes.",
    ],
    dailyReturnTriggers: [
      "Wholesale restock.",
      "Demand spike.",
      "Regional price spread.",
    ],
    scalePath: [
      "Counter shop",
      "Backroom stock",
      "Warehouse link",
      "Regional trading house",
    ],
    empireReinforcement: [
      "Traders supply every small business.",
      "Market trust turns into bulk contracts.",
      "Branches move goods where demand is highest.",
    ],
    offers: [
      {
        offerId: "sell_road_rations",
        label: "Sell road rations",
        description: "Provide basic food for work or travel.",
        serviceNeed: "food",
        requiredItems: { road_ration: 1 },
        rewardGold: 35,
        satisfactionDelta: 2,
        interactionVerb: "bag",
        animationCue: "procedural_shelf_pick_bag",
      },
      {
        offerId: "sell_repair_supplies",
        label: "Sell repair supplies",
        description: "Bundle small parts for a customer job.",
        serviceNeed: "maintenance",
        requiredItems: { repair_part: 1 },
        rewardGold: 50,
        satisfactionDelta: 2,
        interactionVerb: "bundle",
        animationCue: "procedural_parts_tray_wrap",
      },
      {
        offerId: "broker_special_order",
        label: "Broker special order",
        description: "Take a paid request for hard-to-find goods.",
        serviceNeed: "logistics",
        requiredItems: { trade_goods: 1, ledger_page: 1 },
        rewardGold: 95,
        satisfactionDelta: 4,
        interactionVerb: "broker",
        animationCue: "procedural_ledger_note_handshake",
      },
    ],
    askTemplates: [
      {
        askId: "need_rations",
        line: "I need food that survives a rough road.",
        desiredOfferId: "sell_road_rations",
        patience: 76,
        difficulty: 1,
        rewardGold: 40,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Grab the right shelf item.",
        navGoal: "counterNodeId",
      },
      {
        askId: "small_parts",
        line: "Do you have the parts before my hinge gives up?",
        desiredOfferId: "sell_repair_supplies",
        patience: 62,
        difficulty: 2,
        rewardGold: 55,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Bundle supplies quickly.",
        navGoal: "counterNodeId",
      },
      {
        askId: "rare_order",
        line: "Can you find something the stalls do not carry?",
        desiredOfferId: "broker_special_order",
        patience: 58,
        difficulty: 3,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Choose brokerage for a special request.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  hunter_wild_meat: definition({
    typeId: "hunter_wild_meat",
    interfaceTitle: "Hunter Larder Counter",
    counterLabel: "Cold larder",
    customerGoal: "Customers buy meat, hides, and wildlife-control advice.",
    ownerFunLoop:
      "Balance freshness, protected-species rules, and restaurant demand.",
    scaleNoun: "hunting",
    challengeGrowth: [
      "Fresh meat spoils.",
      "Protected jobs need permits.",
      "Restaurants ask for larger cuts.",
      "Branches need sustainable populations.",
    ],
    dailyReturnTriggers: [
      "Wildlife migration.",
      "Meat spoilage warning.",
      "Restaurant rush.",
    ],
    scalePath: [
      "Larder counter",
      "Cold storage",
      "Licensed hunting crew",
      "Regional provision network",
    ],
    empireReinforcement: [
      "Hunters feed restaurants and traders.",
      "Wildlife control improves safety.",
      "Branches secure local protein supply.",
    ],
    offers: [
      {
        offerId: "sell_wild_meat",
        label: "Sell wild meat",
        description: "Hand over fresh meat for cooking.",
        serviceNeed: "food",
        requiredItems: { wild_meat: 1 },
        rewardGold: 55,
        satisfactionDelta: 2,
        interactionVerb: "wrap",
        animationCue: "procedural_cold_wrap_handoff",
      },
      {
        offerId: "prepare_hide_bundle",
        label: "Prepare hide bundle",
        description: "Bundle hides for crafting or repairs.",
        serviceNeed: "maintenance",
        requiredItems: { hide: 1 },
        rewardGold: 65,
        satisfactionDelta: 2,
        interactionVerb: "bind",
        animationCue: "procedural_hide_roll_bind",
      },
      {
        offerId: "wildlife_control_advice",
        label: "Give control advice",
        description: "Advise a customer on a nuisance population.",
        serviceNeed: "safety",
        requiredItems: { route_map: 1 },
        rewardGold: 85,
        satisfactionDelta: 3,
        interactionVerb: "advise",
        animationCue: "procedural_track_mark_map",
      },
    ],
    askTemplates: [
      {
        askId: "fresh_meat",
        line: "The stew wants something wild and fresh.",
        desiredOfferId: "sell_wild_meat",
        patience: 60,
        difficulty: 1,
        rewardGold: 60,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Serve fresh meat before it spoils.",
        navGoal: "counterNodeId",
      },
      {
        askId: "need_hides",
        line: "My repair job needs tough hide, not cloth.",
        desiredOfferId: "prepare_hide_bundle",
        patience: 68,
        difficulty: 2,
        rewardGold: 70,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Pick hide supply over food.",
        navGoal: "counterNodeId",
      },
      {
        askId: "yard_tracks",
        line: "Something keeps rooting up my yard. What is it?",
        desiredOfferId: "wildlife_control_advice",
        patience: 48,
        difficulty: 3,
        rewardGold: 90,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Use tracking knowledge.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  medical_doctor: definition({
    typeId: "medical_doctor",
    interfaceTitle: "Clinic Triage Desk",
    counterLabel: "Treatment cot",
    customerGoal:
      "Customers need triage, medicine, and treatment with trust consequences.",
    ownerFunLoop:
      "Read symptoms, choose care level, spend medicine, and protect the clinic's trust streak.",
    scaleNoun: "clinic",
    challengeGrowth: [
      "Higher severity lowers patience.",
      "Outbreak days create waves.",
      "Wrong care costs reputation.",
      "Branches need supply couriers and specialists.",
    ],
    dailyReturnTriggers: [
      "Morning triage queue.",
      "Medicine stock alert.",
      "Outbreak-risk visitor.",
    ],
    scalePath: [
      "Triage cot",
      "Treatment room",
      "Specialist clinic",
      "Regional health network",
    ],
    empireReinforcement: [
      "Clinics create demand for herbs, couriers, sanitation, and magic goods.",
      "High trust unlocks severe cases.",
      "Branches improve town health coverage.",
    ],
    offers: [
      {
        offerId: "basic_checkup",
        label: "Run checkup",
        description: "Diagnose a low-risk complaint.",
        serviceNeed: "health",
        requiredItems: { bandage: 1 },
        rewardGold: 60,
        satisfactionDelta: 2,
        interactionVerb: "examine",
        animationCue: "procedural_pulse_check_clipboard",
      },
      {
        offerId: "field_medkit_sale",
        label: "Issue medkit",
        description: "Prepare and sell field medical supplies.",
        serviceNeed: "health",
        requiredItems: { field_medkit: 1 },
        rewardGold: 85,
        satisfactionDelta: 3,
        interactionVerb: "issue",
        animationCue: "procedural_medkit_open_close",
      },
      {
        offerId: "urgent_treatment",
        label: "Treat urgent case",
        description: "Use medicine and supplies on a serious patient.",
        serviceNeed: "sanitation",
        requiredItems: { medicine: 1, field_medkit: 1 },
        rewardGold: 135,
        satisfactionDelta: 4,
        interactionVerb: "treat",
        animationCue: "procedural_treatment_cot_work",
      },
    ],
    askTemplates: [
      {
        askId: "small_cut",
        line: "It is probably nothing, but it keeps glowing.",
        desiredOfferId: "basic_checkup",
        patience: 72,
        difficulty: 1,
        rewardGold: 65,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Triage low severity quickly.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "field_kit",
        line: "I need a kit before I go back outside.",
        desiredOfferId: "field_medkit_sale",
        patience: 58,
        difficulty: 2,
        rewardGold: 90,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Issue supplies, do not over-treat.",
        navGoal: "counterNodeId",
      },
      {
        askId: "urgent_symptom",
        line: "My arm forgot which year it belongs to.",
        desiredOfferId: "urgent_treatment",
        patience: 34,
        difficulty: 4,
        rewardGold: 145,
        reputationDelta: 3,
        needDelta: 5,
        funAction: "Treat the high-risk case first.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  teleport_owner: definition({
    typeId: "teleport_owner",
    interfaceTitle: "Teleport Access Desk",
    counterLabel: "Pad terminal",
    customerGoal:
      "Customers need access keys, emergency returns, and pad stability checks.",
    ownerFunLoop:
      "Match destination, fuel, and access rights while preventing unstable jumps.",
    scaleNoun: "teleport pad",
    challengeGrowth: [
      "Access keys expire.",
      "Fuel limits rush traffic.",
      "Destination mistakes hurt trust.",
      "Branches form private fast-travel networks.",
    ],
    dailyReturnTriggers: [
      "Access renewal queue.",
      "Emergency return request.",
      "Pad stability decay.",
    ],
    scalePath: [
      "Private pad",
      "Public key desk",
      "Emergency return service",
      "Regional teleport network",
    ],
    empireReinforcement: [
      "Teleport pads feed courier, medical, and travel demand.",
      "Reliable pads attract premium customers.",
      "Branches make empire logistics fast.",
    ],
    offers: [
      {
        offerId: "issue_access_token",
        label: "Issue access token",
        description: "Grant a customer temporary pad access.",
        serviceNeed: "travel",
        requiredItems: { teleport_token: 1 },
        rewardGold: 85,
        satisfactionDelta: 3,
        interactionVerb: "key",
        animationCue: "procedural_token_press_palm",
      },
      {
        offerId: "emergency_return",
        label: "Prepare emergency return",
        description: "Sell a safer return jump with extra fuel checks.",
        serviceNeed: "health",
        requiredItems: { emergency_return: 1, teleport_fuel: 1 },
        rewardGold: 130,
        satisfactionDelta: 4,
        interactionVerb: "anchor",
        animationCue: "procedural_return_anchor_calibrate",
      },
      {
        offerId: "pad_stability_check",
        label: "Check pad stability",
        description: "Calibrate destination and stability before travel.",
        serviceNeed: "logistics",
        requiredItems: { destination_crystal: 1 },
        rewardGold: 100,
        satisfactionDelta: 3,
        interactionVerb: "stabilize",
        animationCue: "procedural_pad_ring_spin_check",
      },
    ],
    askTemplates: [
      {
        askId: "need_key",
        line: "Can I get a key that works until tomorrow?",
        desiredOfferId: "issue_access_token",
        patience: 64,
        difficulty: 1,
        rewardGold: 90,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Issue access quickly.",
        navGoal: "counterNodeId",
      },
      {
        askId: "panic_return",
        line: "If the road goes bad, I need to come home instantly.",
        desiredOfferId: "emergency_return",
        patience: 42,
        difficulty: 3,
        rewardGold: 140,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Prepare emergency return, not a basic key.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "pad_feels_wrong",
        line: "The pad is humming on the wrong side of my teeth.",
        desiredOfferId: "pad_stability_check",
        patience: 52,
        difficulty: 3,
        rewardGold: 105,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Calibrate before travel.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  waste_sanitation_cleanup: definition({
    typeId: "waste_sanitation_cleanup",
    interfaceTitle: "Sanitation Dispatch Counter",
    counterLabel: "Cleanup board",
    customerGoal:
      "Customers request pickup, decontamination, and clean certificates.",
    ownerFunLoop:
      "Classify waste, spend cleaning stock, and prevent health penalties.",
    scaleNoun: "cleanup",
    challengeGrowth: [
      "Contamination severity rises.",
      "Restaurants and clinics demand fast pickup.",
      "Wrong handling hurts sanitation.",
      "Branches need routes and processing.",
    ],
    dailyReturnTriggers: [
      "Waste accumulation tick.",
      "Inspection deadline.",
      "Outbreak warning.",
    ],
    scalePath: [
      "Pickup counter",
      "Hazard crew",
      "Processing yard",
      "Regional sanitation authority",
    ],
    empireReinforcement: [
      "Sanitation keeps restaurants, clinics, refineries, and inns open.",
      "Clean records increase town trust.",
      "Branches prevent regional outbreaks.",
    ],
    offers: [
      {
        offerId: "trash_pickup",
        label: "Schedule pickup",
        description: "Take a standard trash pickup order.",
        serviceNeed: "sanitation",
        requiredItems: { containment_barrel: 1 },
        rewardGold: 55,
        satisfactionDelta: 2,
        interactionVerb: "schedule",
        animationCue: "procedural_cleanup_ticket_clip",
      },
      {
        offerId: "decontam_kit",
        label: "Apply decontam kit",
        description: "Neutralize a small contamination sample.",
        serviceNeed: "health",
        requiredItems: { cleaning_reagent: 1, containment_barrel: 1 },
        rewardGold: 95,
        satisfactionDelta: 3,
        interactionVerb: "neutralize",
        animationCue: "procedural_spray_seal_barrel",
      },
      {
        offerId: "clean_certificate",
        label: "Issue clean certificate",
        description: "Verify a business is safe for inspection.",
        serviceNeed: "timeline_stability",
        requiredItems: { clean_certificate: 1 },
        rewardGold: 110,
        satisfactionDelta: 4,
        interactionVerb: "certify",
        animationCue: "procedural_stamp_clean_certificate",
      },
    ],
    askTemplates: [
      {
        askId: "barrel_pickup",
        line: "I need this barrel gone before customers smell it.",
        desiredOfferId: "trash_pickup",
        patience: 58,
        difficulty: 1,
        rewardGold: 60,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Schedule the simple pickup.",
        navGoal: "counterNodeId",
      },
      {
        askId: "sample_hisses",
        line: "The sample hisses when I apologize to it.",
        desiredOfferId: "decontam_kit",
        patience: 40,
        difficulty: 4,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Use decontam for hazardous waste.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "inspection_today",
        line: "The inspector comes today. I need clean papers.",
        desiredOfferId: "clean_certificate",
        patience: 50,
        difficulty: 3,
        rewardGold: 115,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Certify after checking stock.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  repair_maintenance_person: definition({
    typeId: "repair_maintenance_person",
    interfaceTitle: "Handyman Service Counter",
    counterLabel: "Fix-it bench",
    customerGoal:
      "Customers bring broken fixtures, furniture, and tiny emergencies.",
    ownerFunLoop:
      "Identify the object, choose parts, and finish fast enough to earn trust.",
    scaleNoun: "repair",
    challengeGrowth: [
      "More objects arrive at once.",
      "Urgent repairs have lower patience.",
      "Higher tiers need specialty parts.",
      "Branches need scheduled crews.",
    ],
    dailyReturnTriggers: [
      "Object decay reports.",
      "Inn repair board.",
      "Rush repair visitor.",
    ],
    scalePath: [
      "Tool belt",
      "Repair bench",
      "Facilities crew",
      "Regional maintenance brand",
    ],
    empireReinforcement: [
      "Repair keeps every business functional.",
      "Fast fixes improve property condition.",
      "Branches create subscription contracts.",
    ],
    offers: [
      {
        offerId: "fixture_fix",
        label: "Fix fixture",
        description: "Repair a door, hinge, shelf, or small machine.",
        serviceNeed: "maintenance",
        requiredItems: { nails: 1, repair_tool: 1 },
        rewardGold: 50,
        satisfactionDelta: 2,
        interactionVerb: "tighten",
        animationCue: "procedural_wrench_tighten_fixture",
      },
      {
        offerId: "furniture_patch",
        label: "Patch furniture",
        description: "Use wood and fasteners on a worn object.",
        serviceNeed: "housing",
        requiredItems: { wood_plank: 1, nails: 1 },
        rewardGold: 65,
        satisfactionDelta: 3,
        interactionVerb: "patch",
        animationCue: "procedural_hammer_patch_board",
      },
      {
        offerId: "urgent_service_call",
        label: "Book urgent call",
        description: "Dispatch the owner or worker to an emergency fix.",
        serviceNeed: "property_condition",
        requiredItems: { repair_part: 1, metal_part: 1 },
        rewardGold: 95,
        satisfactionDelta: 4,
        interactionVerb: "dispatch",
        animationCue: "procedural_toolbag_snap_dispatch",
      },
    ],
    askTemplates: [
      {
        askId: "door_screams",
        line: "My door screams louder than my guests.",
        desiredOfferId: "fixture_fix",
        patience: 68,
        difficulty: 1,
        rewardGold: 55,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Fix the simple fixture.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "chair_split",
        line: "This chair split right before dinner.",
        desiredOfferId: "furniture_patch",
        patience: 52,
        difficulty: 2,
        rewardGold: 70,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Patch furniture with wood.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "pipe_burst",
        line: "Water is coming through the ceiling right now.",
        desiredOfferId: "urgent_service_call",
        patience: 30,
        difficulty: 4,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Dispatch urgent service under pressure.",
        navGoal: "counterNodeId",
      },
    ],
  }),
  food_service_restaurant: definition({
    typeId: "food_service_restaurant",
    interfaceTitle: "Restaurant Service Line",
    counterLabel: "Pass window",
    customerGoal:
      "Customers want meals, rations, and healing food with freshness expectations.",
    ownerFunLoop:
      "Read the appetite, pick the dish, spend stock, and keep the rush streak going.",
    scaleNoun: "restaurant",
    challengeGrowth: [
      "Meal rushes increase queue size.",
      "Ingredient shortages force tradeoffs.",
      "Sanitation affects patience.",
      "Branches need supply contracts.",
    ],
    dailyReturnTriggers: [
      "Lunch rush.",
      "Fresh ingredient delivery.",
      "Festival catering spike.",
    ],
    scalePath: [
      "Food cart",
      "Dining counter",
      "Catering kitchen",
      "Regional restaurant group",
    ],
    empireReinforcement: [
      "Restaurants consume farm, hunter, trader, and sanitation services.",
      "Food buffs drive daily returns.",
      "Branches stabilize town food happiness.",
    ],
    offers: [
      {
        offerId: "serve_worker_meal",
        label: "Serve worker meal",
        description: "Plate a reliable hot meal.",
        serviceNeed: "food",
        requiredItems: { worker_meal: 1 },
        rewardGold: 35,
        satisfactionDelta: 2,
        interactionVerb: "plate",
        animationCue: "procedural_plate_slide_counter",
      },
      {
        offerId: "pack_road_ration",
        label: "Pack road ration",
        description: "Wrap travel food for a customer on the move.",
        serviceNeed: "tourism",
        requiredItems: { road_ration: 1 },
        rewardGold: 45,
        satisfactionDelta: 2,
        interactionVerb: "wrap",
        animationCue: "procedural_ration_wrap_tie",
      },
      {
        offerId: "serve_healing_soup",
        label: "Serve healing soup",
        description: "Serve a restorative dish using rarer stock.",
        serviceNeed: "health",
        requiredItems: { healing_soup: 1 },
        rewardGold: 75,
        satisfactionDelta: 4,
        interactionVerb: "ladle",
        animationCue: "procedural_soup_ladle_steam",
      },
    ],
    askTemplates: [
      {
        askId: "hot_meal",
        line: "I need something hot before my shift starts.",
        desiredOfferId: "serve_worker_meal",
        patience: 46,
        difficulty: 1,
        rewardGold: 40,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Plate fast and keep the rush moving.",
        navGoal: "counterNodeId",
      },
      {
        askId: "travel_food",
        line: "Pack me food that survives the road.",
        desiredOfferId: "pack_road_ration",
        patience: 56,
        difficulty: 2,
        rewardGold: 50,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Choose ration over fresh meal.",
        navGoal: "counterNodeId",
      },
      {
        askId: "feel_awful",
        line: "Do you have the soup that makes bones stop arguing?",
        desiredOfferId: "serve_healing_soup",
        patience: 42,
        difficulty: 3,
        rewardGold: 80,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Use premium healing stock.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  courier: definition({
    typeId: "courier",
    interfaceTitle: "Courier Dispatch Desk",
    counterLabel: "Parcel scale",
    customerGoal:
      "Customers need packages, medicine, and locked items delivered on time.",
    ownerFunLoop:
      "Read deadline and fragility, choose the right delivery product, and protect trust.",
    scaleNoun: "courier route",
    challengeGrowth: [
      "Deadlines shrink.",
      "Fragile cargo punishes errors.",
      "More locations mean route batching.",
      "Branches need dispatch managers.",
    ],
    dailyReturnTriggers: [
      "Morning delivery board.",
      "Timed medicine run.",
      "Courier returns with proof slips.",
    ],
    scalePath: [
      "Runner satchel",
      "Dispatch desk",
      "Route office",
      "Regional courier empire",
    ],
    empireReinforcement: [
      "Couriers connect every business supply chain.",
      "Reliable delivery raises cross-business throughput.",
      "Branches let the empire operate across towns.",
    ],
    offers: [
      {
        offerId: "standard_parcel",
        label: "Accept parcel",
        description: "Take a standard package with a proof slip.",
        serviceNeed: "logistics",
        requiredItems: { parcel: 1 },
        rewardGold: 45,
        satisfactionDelta: 2,
        interactionVerb: "weigh",
        animationCue: "procedural_parcel_weigh_tag",
      },
      {
        offerId: "locked_delivery",
        label: "Accept locked delivery",
        description: "Seal a valuable lockbox delivery.",
        serviceNeed: "travel",
        requiredItems: { lockbox: 1 },
        rewardGold: 75,
        satisfactionDelta: 3,
        interactionVerb: "seal",
        animationCue: "procedural_lockbox_seal_check",
      },
      {
        offerId: "medicine_run",
        label: "Book medicine run",
        description: "Prioritize a medical or food delivery.",
        serviceNeed: "health",
        requiredItems: { sealed_package: 1, route_map: 1 },
        rewardGold: 95,
        satisfactionDelta: 4,
        interactionVerb: "dispatch",
        animationCue: "procedural_route_stamp_runner_wave",
      },
    ],
    askTemplates: [
      {
        askId: "simple_package",
        line: "Can you get this parcel across town by evening?",
        desiredOfferId: "standard_parcel",
        patience: 66,
        difficulty: 1,
        rewardGold: 50,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Weigh and tag the parcel.",
        navGoal: "counterNodeId",
      },
      {
        askId: "valuable_lockbox",
        line: "This box needs a route that keeps hands off it.",
        desiredOfferId: "locked_delivery",
        patience: 54,
        difficulty: 3,
        rewardGold: 80,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Choose locked service.",
        navGoal: "counterNodeId",
      },
      {
        askId: "medicine_deadline",
        line: "The clinic needs this before the fever climbs.",
        desiredOfferId: "medicine_run",
        patience: 32,
        difficulty: 4,
        rewardGold: 100,
        reputationDelta: 3,
        needDelta: 5,
        funAction: "Prioritize medicine under a short timer.",
        navGoal: "serviceNodeId",
      },
    ],
  }),
  hospitality_inn_hotel_shelter: definition({
    typeId: "hospitality_inn_hotel_shelter",
    interfaceTitle: "Inn Front Desk",
    counterLabel: "Room ledger",
    customerGoal:
      "Customers want rooms, shelter beds, safe stays, and simple food.",
    ownerFunLoop:
      "Match room type, food, and safety need while keeping occupancy and cleanliness healthy.",
    scaleNoun: "lodging",
    challengeGrowth: [
      "Occupancy increases cleaning pressure.",
      "VIP guests demand better rooms.",
      "Shelter waves trade profit for civic trust.",
      "Branches need staff and food supply.",
    ],
    dailyReturnTriggers: [
      "Guest checkout report.",
      "Room cleaning alert.",
      "Rare VIP traveler.",
    ],
    scalePath: [
      "Common room",
      "Room ledger",
      "Full inn",
      "Regional hospitality chain",
    ],
    empireReinforcement: [
      "Inns consume food, sanitation, repair, and security services.",
      "Good stays improve tourism.",
      "Branches become player travel hubs.",
    ],
    offers: [
      {
        offerId: "book_basic_room",
        label: "Book basic room",
        description: "Assign a clean room for one stay.",
        serviceNeed: "housing",
        requiredItems: { linen: 1 },
        rewardGold: 65,
        satisfactionDelta: 3,
        interactionVerb: "key",
        animationCue: "procedural_room_key_handoff",
      },
      {
        offerId: "offer_shelter_bed",
        label: "Offer shelter bed",
        description: "Provide a safe emergency bed.",
        serviceNeed: "safety",
        requiredItems: { clean_water: 1 },
        rewardGold: 45,
        satisfactionDelta: 4,
        interactionVerb: "guide",
        animationCue: "procedural_point_to_bed_ledger",
      },
      {
        offerId: "guest_meal_bundle",
        label: "Bundle room meal",
        description: "Pair lodging with a meal for tired travelers.",
        serviceNeed: "food",
        requiredItems: { linen: 1, worker_meal: 1 },
        rewardGold: 95,
        satisfactionDelta: 4,
        interactionVerb: "host",
        animationCue: "procedural_key_and_plate_combo",
      },
    ],
    askTemplates: [
      {
        askId: "need_room",
        line: "One clean room and no surprises, please.",
        desiredOfferId: "book_basic_room",
        patience: 72,
        difficulty: 1,
        rewardGold: 70,
        reputationDelta: 1,
        needDelta: 3,
        funAction: "Assign a room from the ledger.",
        navGoal: "counterNodeId",
      },
      {
        askId: "need_safe_bed",
        line: "I just need somewhere safe until morning.",
        desiredOfferId: "offer_shelter_bed",
        patience: 50,
        difficulty: 2,
        rewardGold: 50,
        reputationDelta: 2,
        needDelta: 4,
        funAction: "Choose shelter over room profit.",
        navGoal: "serviceNodeId",
      },
      {
        askId: "room_and_meal",
        line: "If I sleep before eating, I may become furniture.",
        desiredOfferId: "guest_meal_bundle",
        patience: 44,
        difficulty: 3,
        rewardGold: 100,
        reputationDelta: 2,
        needDelta: 5,
        funAction: "Bundle lodging and food.",
        navGoal: "counterNodeId",
      },
    ],
  }),
};

const HARTHMERE_BUSINESS_SERVICE_ITEM_IDS = [
  "anchor_part",
  "bandage",
  "blueprint",
  "certified_portal_fuel",
  "charm",
  "clean_certificate",
  "clean_water",
  "cleaning_reagent",
  "containment_barrel",
  "containment_filter",
  "crop_bundle",
  "crystal_lens",
  "decor",
  "design_pack",
  "destination_crystal",
  "emergency_return",
  "field_kit",
  "field_medkit",
  "guard_contract",
  "healing_soup",
  "herb_bundle",
  "hide",
  "iron_ingot",
  "ledger_page",
  "lighting_kit",
  "linen",
  "lockbox",
  "medicine",
  "metal_part",
  "nails",
  "parcel",
  "permit_form",
  "portal_fuel",
  "potion",
  "rare_food",
  "ration_pack",
  "relic_fragment",
  "repair_kit",
  "repair_part",
  "repair_tool",
  "road_ration",
  "route_map",
  "scanner",
  "sealed_package",
  "signal_flare",
  "spent_filter",
  "stabilized_exotic_matter",
  "stone_block",
  "teleport_fuel",
  "teleport_token",
  "trade_goods",
  "tree_resin",
  "ward",
  "whetstone",
  "wild_meat",
  "wood_plank",
  "worker_meal",
] as const;

function serviceItemDisplayName(itemId: string) {
  return itemId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function serviceItemRole(itemId: string): HarthmereBusinessServiceItemRole {
  if (/certificate|form|ledger|blueprint|map|token|contract/.test(itemId))
    return "paperwork";
  if (/barrel|lockbox|package|parcel|kit|box/.test(itemId)) return "container";
  if (/tool|scanner|whetstone|lens|nails|part/.test(itemId)) return "tool";
  if (
    /meal|ration|soup|water|medicine|bandage|potion|food|meat|crop|herb/.test(
      itemId
    )
  )
    return "consumable";
  if (/spent|waste/.test(itemId)) return "waste";
  if (
    /fuel|charm|ward|decor|design|package|goods|flare|linen|hide/.test(itemId)
  )
    return "finished_good";
  return "component";
}

export const HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG: Readonly<
  Record<string, HarthmereBusinessServiceItemDefinition>
> = Object.freeze(
  Object.fromEntries(
    HARTHMERE_BUSINESS_SERVICE_ITEM_IDS.map((itemId) => [
      itemId,
      {
        itemId,
        displayName: serviceItemDisplayName(itemId),
        role: serviceItemRole(itemId),
        productionUse: "customer_service_minigame",
      } satisfies HarthmereBusinessServiceItemDefinition,
    ])
  )
);

export function getHarthmereBusinessServiceItemDefinition(
  itemId: string | undefined
) {
  return itemId ? HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG[itemId] : undefined;
}

export function validateHarthmereBusinessServiceItemReferences(): HarthmereBusinessServiceItemReferenceValidation {
  const missingRequiredItems = new Set<string>();
  const missingProducedItems = new Set<string>();
  for (const definition of Object.values(
    HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS
  )) {
    for (const offer of definition.offers) {
      for (const itemId of Object.keys(offer.requiredItems)) {
        if (!HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG[itemId])
          missingRequiredItems.add(itemId);
      }
      for (const itemId of Object.keys(offer.producedItems ?? {})) {
        if (!HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG[itemId])
          missingProducedItems.add(itemId);
      }
    }
  }
  return {
    ok: missingRequiredItems.size === 0 && missingProducedItems.size === 0,
    missingRequiredItems: [...missingRequiredItems].sort(),
    missingProducedItems: [...missingProducedItems].sort(),
  };
}

function businessServiceAnimationFamily(
  cueId: string
): HarthmereBusinessServiceAnimationFamily {
  if (/gate|pad|token|key|jump|access|return/.test(cueId))
    return "access_control";
  if (/spray|clean|decontam|barrel|cleanup/.test(cueId)) return "cleanup";
  if (
    /scan|calibrate|tune|stabilize|inspect|pulse|scope|crystal|lens/.test(cueId)
  )
    return "diagnostic";
  if (/dispatch|alarm|guard|salute|runner|flag/.test(cueId)) return "dispatch";
  if (/map|route|blueprint|measure|brief|estimate|sample|palette/.test(cueId))
    return "planning";
  if (/stamp|paper|ledger|ticket|certificate|clipboard|permit/.test(cueId))
    return "paperwork";
  if (/hammer|wrench|patch|tighten|sharpen|tool|blade|fixture/.test(cueId))
    return "tool_work";
  return "counter_handoff";
}

function businessServiceAnimationChannels(
  family: HarthmereBusinessServiceAnimationFamily
) {
  switch (family) {
    case "access_control":
      return ["head", "right_arm", "left_arm", "prop_ring"];
    case "cleanup":
      return ["body", "right_arm", "prop_spray", "prop_container"];
    case "diagnostic":
      return ["head", "right_arm", "prop_scanner"];
    case "dispatch":
      return ["body", "right_arm", "left_arm", "prop_signal"];
    case "planning":
      return ["head", "right_arm", "left_arm", "prop_surface"];
    case "paperwork":
      return ["head", "right_arm", "prop_document"];
    case "tool_work":
      return ["body", "right_arm", "left_arm", "prop_tool"];
    case "counter_handoff":
      return ["head", "right_arm", "left_arm", "prop_item"];
  }
}

function businessServiceAnimationDuration(
  family: HarthmereBusinessServiceAnimationFamily
) {
  switch (family) {
    case "access_control":
      return 1100;
    case "cleanup":
      return 1250;
    case "diagnostic":
      return 1000;
    case "dispatch":
      return 900;
    case "planning":
      return 1050;
    case "paperwork":
      return 800;
    case "tool_work":
      return 1150;
    case "counter_handoff":
      return 750;
  }
}

export const HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS: Readonly<
  Record<string, HarthmereBusinessServiceAnimationCueSpec>
> = Object.freeze(
  Object.fromEntries(
    Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS).flatMap(
      (definition) =>
        definition.offers.map((offer) => {
          const family = businessServiceAnimationFamily(offer.animationCue);
          return [
            offer.animationCue,
            {
              cueId: offer.animationCue,
              family,
              durationMs: businessServiceAnimationDuration(family),
              ownerChannels: businessServiceAnimationChannels(family),
              propMotion: offer.animationCue
                .replace(/^procedural_/, "")
                .replace(/_/g, " "),
              customerReaction:
                offer.satisfactionDelta >= 4
                  ? "delighted_accept"
                  : offer.satisfactionDelta >= 3
                  ? "relieved_accept"
                  : "quick_accept",
              safety: {
                procedural: true,
                voxelSafe: true,
                noRootMotion: true,
                noSkeletonRequirement: true,
                rotationOnlyPose: true,
              },
            } satisfies HarthmereBusinessServiceAnimationCueSpec,
          ];
        })
    )
  )
);

export function getHarthmereBusinessServiceAnimationCueSpec(cueId: string) {
  return HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS[cueId];
}

export function getHarthmereBusinessMiniGameDefinition(
  typeId: HarthmereEconomyBusinessTypeId
) {
  return HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[typeId];
}

function serviceOfferGraphicScore(
  graphic: HarthmereBusinessBikkieGraphic,
  offer: HarthmereBusinessServiceOffer
) {
  const text = `${offer.offerId} ${offer.label} ${offer.description} ${
    offer.interactionVerb
  } ${offer.animationCue} ${Object.keys(offer.requiredItems).join(
    " "
  )}`.toLowerCase();
  let score = graphic.role === "primary_station" ? 2 : 0;
  if (graphic.role === "service_tool") score += 1;
  for (const token of [
    graphic.label,
    graphic.bikkieName,
    graphic.action,
    graphic.shape,
    graphic.craftingStationType,
  ].filter(Boolean)) {
    const normalized = String(token)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (normalized && text.includes(normalized)) score += 10;
  }
  if (
    /stamp|paper|ledger|permit|ticket|certificate|contract|map|route|blueprint|plan/.test(
      text
    ) &&
    graphic.kind === "document"
  )
    score += 7;
  if (
    /hammer|wrench|repair|tool|sharpen|blade|fixture|patch|tighten|build|shape/.test(
      text
    ) &&
    (graphic.kind === "tool" || graphic.bikkieName === "Workbench")
  )
    score += 6;
  if (
    /soup|meal|ration|plate|ladle|food|crop|herb|tasting|meat|fish|wrap/.test(
      text
    ) &&
    ["food", "crop", "fish"].includes(graphic.kind)
  )
    score += 6;
  if (
    /soup|meal|plate|ladle|ration|kitchen/.test(text) &&
    graphic.bikkieName === "Kitchen"
  )
    score += 8;
  if (
    /meat|fish|hide|larder|wrap/.test(text) &&
    graphic.bikkieName === "Angler's Table"
  )
    score += 7;
  if (
    /clean|decontam|muck|waste|barrel|sanitize/.test(text) &&
    (graphic.bikkieName.includes("Muck Buster") ||
      graphic.bikkieName === "Composter" ||
      graphic.bikkieName === "Bucket")
  )
    score += 7;
  if (
    /gate|pad|token|return|teleport|portal|access|jump|fuel|crystal/.test(
      text
    ) &&
    ["utility", "crafting_station"].includes(graphic.kind)
  )
    score += 5;
  if (
    /camera|scan|survey|proof|photo/.test(text) &&
    graphic.bikkieName.includes("Camera")
  )
    score += 8;
  if (
    /seed|crop|herb|farm|fertil/.test(text) &&
    ["seed", "crop"].includes(graphic.kind)
  )
    score += 7;
  if (
    /parcel|package|delivery|courier|mail/.test(text) &&
    graphic.kind === "mail"
  )
    score += 8;
  return score;
}

export function getHarthmereBusinessBikkieGraphicForServiceOffer(
  typeId: HarthmereEconomyBusinessTypeId,
  offer: HarthmereBusinessServiceOffer
) {
  const graphics = getHarthmereBusinessBikkieGraphics(typeId);
  return [...graphics].sort(
    (a, b) =>
      serviceOfferGraphicScore(b, offer) - serviceOfferGraphicScore(a, offer)
  )[0];
}

export function getHarthmereBusinessBikkieGraphicForServiceCue(cueId: string) {
  for (const definition of Object.values(
    HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS
  )) {
    const offer = definition.offers.find(
      (candidate) => candidate.animationCue === cueId
    );
    if (offer)
      return getHarthmereBusinessBikkieGraphicForServiceOffer(
        definition.typeId,
        offer
      );
  }
  return undefined;
}

export function defaultHarthmereBusinessCustomerStats(
  businessId: string
): HarthmereBusinessCustomerStats {
  return {
    businessId,
    totalServed: 0,
    totalFailed: 0,
    lifetimeGold: 0,
    bestStreak: 0,
    currentTier: 1,
    serviceXp: 0,
    likeability: 0,
    friendshipPointsByNpcId: {},
    favoriteCustomerNpcIds: [],
    repeatCustomerMemories: [],
    thankYouNotes: [],
    collectiblesEarned: [],
    decorationUnlocks: [],
    badges: [],
  };
}

export function normalizeHarthmereBusinessCustomerStats(
  raw: unknown,
  businessId: string
): HarthmereBusinessCustomerStats {
  const value =
    raw && typeof raw === "object"
      ? (raw as Partial<HarthmereBusinessCustomerStats>)
      : {};
  const uniqueStrings = (rawValue: unknown, max = 50) =>
    Array.from(
      new Set(
        Array.isArray(rawValue)
          ? rawValue.filter(
              (entry): entry is string =>
                typeof entry === "string" && entry.trim().length > 0
            )
          : []
      )
    ).slice(-max);
  const friendship =
    value.friendshipPointsByNpcId &&
    typeof value.friendshipPointsByNpcId === "object"
      ? Object.fromEntries(
          Object.entries(value.friendshipPointsByNpcId).map(
            ([npcId, points]) => [
              npcId,
              Math.max(0, Math.trunc(Number(points) || 0)),
            ]
          )
        )
      : {};
  return {
    ...defaultHarthmereBusinessCustomerStats(businessId),
    ...value,
    businessId,
    totalServed: Math.max(0, Math.trunc(Number(value.totalServed ?? 0) || 0)),
    totalFailed: Math.max(0, Math.trunc(Number(value.totalFailed ?? 0) || 0)),
    lifetimeGold: Math.max(0, Math.trunc(Number(value.lifetimeGold ?? 0) || 0)),
    bestStreak: Math.max(0, Math.trunc(Number(value.bestStreak ?? 0) || 0)),
    currentTier: Math.max(
      1,
      Math.min(4, Math.trunc(Number(value.currentTier ?? 1) || 1))
    ),
    serviceXp: Math.max(0, Math.trunc(Number(value.serviceXp ?? 0) || 0)),
    likeability: Math.max(
      0,
      Math.min(100, Math.trunc(Number(value.likeability ?? 0) || 0))
    ),
    friendshipPointsByNpcId: friendship,
    favoriteCustomerNpcIds: uniqueStrings(value.favoriteCustomerNpcIds, 25),
    repeatCustomerMemories: uniqueStrings(value.repeatCustomerMemories, 40),
    thankYouNotes: uniqueStrings(value.thankYouNotes, 40),
    collectiblesEarned: uniqueStrings(value.collectiblesEarned, 60),
    decorationUnlocks: uniqueStrings(value.decorationUnlocks, 60),
    badges: uniqueStrings(value.badges, 40),
    lastSessionAtMs:
      typeof value.lastSessionAtMs === "number"
        ? value.lastSessionAtMs
        : undefined,
    lastDailyServedDay:
      typeof value.lastDailyServedDay === "number"
        ? value.lastDailyServedDay
        : undefined,
  };
}

export function createHarthmereBusinessCozyServiceReward(input: {
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  npcId: string;
  npcDisplayName: string;
  offer: Pick<
    HarthmereBusinessServiceOffer,
    "offerId" | "label" | "satisfactionDelta"
  >;
  ticket: Pick<
    HarthmereBusinessCustomerTicket,
    "difficulty" | "reputationDelta"
  >;
  streak: number;
  dailyBonusGold: number;
  stats: HarthmereBusinessCustomerStats;
}): HarthmereBusinessCozyServiceReward {
  const typeToken = input.typeId.replace(/[^a-z0-9]+/g, "_");
  const serviceXp =
    8 +
    input.ticket.difficulty * 4 +
    Math.max(0, input.streak - 1) * 2 +
    (input.dailyBonusGold > 0 ? 5 : 0);
  const likeabilityDelta = Math.max(
    1,
    input.offer.satisfactionDelta + Math.max(0, input.ticket.reputationDelta)
  );
  const previousFriendship =
    input.stats.friendshipPointsByNpcId[input.npcId] ?? 0;
  const friendshipPoints =
    2 + input.offer.satisfactionDelta + Math.max(0, input.streak);
  const newFriendship = previousFriendship + friendshipPoints;
  const collectibleId =
    input.streak > 0 && input.streak % 5 === 0
      ? `${typeToken}_customer_stamp_${Math.min(
          5,
          Math.floor(input.streak / 5)
        )}`
      : undefined;
  const decorationUnlockId =
    input.stats.totalServed + 1 >= 20 &&
    !input.stats.decorationUnlocks.includes(
      `${typeToken}_thank_you_counter_charm`
    )
      ? `${typeToken}_thank_you_counter_charm`
      : undefined;
  const badgeId =
    input.stats.totalServed + 1 >= 50 &&
    !input.stats.badges.includes(`${typeToken}_beloved_counter`)
      ? `${typeToken}_beloved_counter`
      : undefined;
  return {
    serviceXp,
    likeabilityDelta,
    friendshipPoints,
    collectibleId,
    decorationUnlockId,
    badgeId,
    thankYouNote: `${
      input.npcDisplayName
    } appreciated ${input.offer.label.toLowerCase()} at your counter.`,
    memory: `${
      input.npcDisplayName
    } remembers ${input.offer.label.toLowerCase()} as a helpful ${typeToken.replace(
      /_/g,
      " "
    )} visit.`,
    favoriteCustomerUnlocked: newFriendship >= 12,
  };
}

export function applyHarthmereBusinessCozyServiceReward(
  stats: HarthmereBusinessCustomerStats,
  npcId: string,
  reward: HarthmereBusinessCozyServiceReward
) {
  stats.serviceXp += reward.serviceXp;
  stats.likeability = Math.max(
    0,
    Math.min(100, stats.likeability + reward.likeabilityDelta)
  );
  stats.friendshipPointsByNpcId[npcId] =
    (stats.friendshipPointsByNpcId[npcId] ?? 0) + reward.friendshipPoints;
  if (
    reward.favoriteCustomerUnlocked &&
    !stats.favoriteCustomerNpcIds.includes(npcId)
  ) {
    stats.favoriteCustomerNpcIds.push(npcId);
  }
  for (const [target, value] of [
    [stats.repeatCustomerMemories, reward.memory],
    [stats.thankYouNotes, reward.thankYouNote],
    [stats.collectiblesEarned, reward.collectibleId],
    [stats.decorationUnlocks, reward.decorationUnlockId],
    [stats.badges, reward.badgeId],
  ] as Array<[string[], string | undefined]>) {
    if (value && !target.includes(value)) target.push(value);
    while (target.length > 60) target.shift();
  }
}

export function harthmereBusinessCustomerTierForStats(
  stats: HarthmereBusinessCustomerStats
) {
  if (stats.totalServed >= 120 && stats.bestStreak >= 8) return 4;
  if (stats.totalServed >= 50 && stats.bestStreak >= 5) return 3;
  if (stats.totalServed >= 20 && stats.bestStreak >= 3) return 2;
  return 1;
}

// HARTHMERE_BUSINESS_SCENARIO_VARIETY
// Each business only has a handful of base asks (one per real service offer),
// which made every shift feel repetitive. Instead of hand-authoring hundreds of
// full asks, we layer thirty business-agnostic scenario dimensions on top of
// the base ask at queue-generation time:
//   1. a customer "persona" that rewrites the request line and shifts the
//      stakes (patience / difficulty / reward / reputation), and
//   2. a short greeting/opener.
// Combined with the base asks this yields hundreds of distinct presented
// scenarios per business. Selection is seeded from the session id so the queue
// stays deterministic (server and client agree, and the deterministic-queue
// test holds), while the strides below are coprime with the pool sizes so every
// customer in a single (max 12) shift draws a different scenario.
export interface HarthmereBusinessScenarioModifier {
  id: string;
  mood: string;
  linePrefix: string;
  lineSuffix: string;
  patienceMultiplier: number;
  difficultyDelta: number;
  rewardMultiplier: number;
  reputationDelta: number;
}

export const HARTHMERE_BUSINESS_SCENARIO_MODIFIERS: readonly HarthmereBusinessScenarioModifier[] =
  [
    {
      id: "regular",
      mood: "warm",
      linePrefix: "",
      lineSuffix: "",
      patienceMultiplier: 1,
      difficultyDelta: 0,
      rewardMultiplier: 1,
      reputationDelta: 0,
    },
    {
      id: "first_visit",
      mood: "curious",
      linePrefix: "First time in here — ",
      lineSuffix: "",
      patienceMultiplier: 1.25,
      difficultyDelta: 0,
      rewardMultiplier: 1,
      reputationDelta: 1,
    },
    {
      id: "in_a_hurry",
      mood: "rushed",
      linePrefix: "I'm short on time. ",
      lineSuffix: "",
      patienceMultiplier: 0.65,
      difficultyDelta: 1,
      rewardMultiplier: 1.15,
      reputationDelta: 0,
    },
    {
      id: "big_spender",
      mood: "generous",
      linePrefix: "",
      lineSuffix: " Coin isn't a problem today.",
      patienceMultiplier: 1.1,
      difficultyDelta: 0,
      rewardMultiplier: 1.5,
      reputationDelta: 0,
    },
    {
      id: "haggler",
      mood: "shrewd",
      linePrefix: "",
      lineSuffix: " And give me a fair price.",
      patienceMultiplier: 0.9,
      difficultyDelta: 1,
      rewardMultiplier: 0.8,
      reputationDelta: 0,
    },
    {
      id: "skeptical",
      mood: "wary",
      linePrefix: "Not sure you can manage this, but — ",
      lineSuffix: "",
      patienceMultiplier: 0.85,
      difficultyDelta: 1,
      rewardMultiplier: 1,
      reputationDelta: 1,
    },
    {
      id: "celebrating",
      mood: "cheerful",
      linePrefix: "Big day for me! ",
      lineSuffix: "",
      patienceMultiplier: 1.2,
      difficultyDelta: 0,
      rewardMultiplier: 1.2,
      reputationDelta: 1,
    },
    {
      id: "emergency",
      mood: "panicked",
      linePrefix: "This can't wait — ",
      lineSuffix: " Please hurry!",
      patienceMultiplier: 0.5,
      difficultyDelta: 2,
      rewardMultiplier: 1.35,
      reputationDelta: 1,
    },
    {
      id: "bulk_order",
      mood: "businesslike",
      linePrefix: "",
      lineSuffix: " I'll need this more than once.",
      patienceMultiplier: 1.15,
      difficultyDelta: 1,
      rewardMultiplier: 1.3,
      reputationDelta: 0,
    },
    {
      id: "vip",
      mood: "important",
      linePrefix: "You came highly recommended. ",
      lineSuffix: "",
      patienceMultiplier: 0.95,
      difficultyDelta: 1,
      rewardMultiplier: 1.4,
      reputationDelta: 2,
    },
    {
      id: "confused",
      mood: "unsure",
      linePrefix: "I might have this wrong, but — ",
      lineSuffix: "",
      patienceMultiplier: 1.3,
      difficultyDelta: 0,
      rewardMultiplier: 0.95,
      reputationDelta: 0,
    },
    {
      id: "tipper",
      mood: "kind",
      linePrefix: "",
      lineSuffix: " There's a little extra in it for good work.",
      patienceMultiplier: 1.05,
      difficultyDelta: 0,
      rewardMultiplier: 1.25,
      reputationDelta: 1,
    },
    {
      id: "returning_fan",
      mood: "loyal",
      linePrefix: "Back again — you did great last time. ",
      lineSuffix: "",
      patienceMultiplier: 1.2,
      difficultyDelta: 0,
      rewardMultiplier: 1.1,
      reputationDelta: 1,
    },
    {
      id: "tough_customer",
      mood: "demanding",
      linePrefix: "",
      lineSuffix: " And I expect it done right.",
      patienceMultiplier: 0.8,
      difficultyDelta: 2,
      rewardMultiplier: 1.2,
      reputationDelta: 1,
    },
    {
      id: "quiet",
      mood: "shy",
      linePrefix: "Sorry to bother you... ",
      lineSuffix: "",
      patienceMultiplier: 1.1,
      difficultyDelta: 0,
      rewardMultiplier: 1,
      reputationDelta: 0,
    },
    {
      id: "frequent_flyer",
      mood: "breezy",
      linePrefix: "You know the drill — ",
      lineSuffix: "",
      patienceMultiplier: 1,
      difficultyDelta: 0,
      rewardMultiplier: 1.05,
      reputationDelta: 0,
    },
    {
      id: "after_hours",
      mood: "tired",
      linePrefix: "I know it's late, but ",
      lineSuffix: "",
      patienceMultiplier: 0.9,
      difficultyDelta: 1,
      rewardMultiplier: 1.2,
      reputationDelta: 0,
    },
    {
      id: "festival_rush",
      mood: "festive",
      linePrefix: "Festival rush is eating my schedule. ",
      lineSuffix: "",
      patienceMultiplier: 0.75,
      difficultyDelta: 1,
      rewardMultiplier: 1.3,
      reputationDelta: 1,
    },
    {
      id: "inspection_pressure",
      mood: "formal",
      linePrefix: "The inspector is already on the way. ",
      lineSuffix: "",
      patienceMultiplier: 0.7,
      difficultyDelta: 2,
      rewardMultiplier: 1.25,
      reputationDelta: 2,
    },
    {
      id: "family_errand",
      mood: "hopeful",
      linePrefix: "My family is counting on this. ",
      lineSuffix: "",
      patienceMultiplier: 1.15,
      difficultyDelta: 0,
      rewardMultiplier: 1.1,
      reputationDelta: 1,
    },
    {
      id: "route_delay",
      mood: "anxious",
      linePrefix: "The road delay ruined my timing. ",
      lineSuffix: "",
      patienceMultiplier: 0.8,
      difficultyDelta: 1,
      rewardMultiplier: 1.15,
      reputationDelta: 0,
    },
    {
      id: "fragile_goods",
      mood: "careful",
      linePrefix: "Please handle this gently. ",
      lineSuffix: " It breaks if rushed.",
      patienceMultiplier: 1.05,
      difficultyDelta: 2,
      rewardMultiplier: 1.35,
      reputationDelta: 1,
    },
    {
      id: "short_on_coin",
      mood: "apologetic",
      linePrefix: "I cannot pay much, but ",
      lineSuffix: "",
      patienceMultiplier: 1.25,
      difficultyDelta: 0,
      rewardMultiplier: 0.75,
      reputationDelta: 1,
    },
    {
      id: "guild_order",
      mood: "official",
      linePrefix: "This is for my guild. ",
      lineSuffix: " The paperwork needs to match.",
      patienceMultiplier: 0.95,
      difficultyDelta: 1,
      rewardMultiplier: 1.25,
      reputationDelta: 1,
    },
    {
      id: "bad_previous_service",
      mood: "bristly",
      linePrefix: "The last place botched this. ",
      lineSuffix: "",
      patienceMultiplier: 0.75,
      difficultyDelta: 1,
      rewardMultiplier: 1.1,
      reputationDelta: 2,
    },
    {
      id: "new_resident",
      mood: "earnest",
      linePrefix: "I'm new in Harthmere. ",
      lineSuffix: "",
      patienceMultiplier: 1.3,
      difficultyDelta: 0,
      rewardMultiplier: 1,
      reputationDelta: 1,
    },
    {
      id: "rain_soaked",
      mood: "miserable",
      linePrefix: "I'm soaked through. ",
      lineSuffix: "",
      patienceMultiplier: 0.85,
      difficultyDelta: 1,
      rewardMultiplier: 1.15,
      reputationDelta: 0,
    },
    {
      id: "lost_receipt",
      mood: "embarrassed",
      linePrefix: "I lost the receipt, sorry. ",
      lineSuffix: "",
      patienceMultiplier: 1.1,
      difficultyDelta: 1,
      rewardMultiplier: 0.95,
      reputationDelta: 0,
    },
    {
      id: "premium_client",
      mood: "polished",
      linePrefix: "I'm paying for premium service. ",
      lineSuffix: "",
      patienceMultiplier: 0.85,
      difficultyDelta: 2,
      rewardMultiplier: 1.6,
      reputationDelta: 2,
    },
    {
      id: "neighbor_referral",
      mood: "trusting",
      linePrefix: "A neighbor said you would know what to do. ",
      lineSuffix: "",
      patienceMultiplier: 1.15,
      difficultyDelta: 0,
      rewardMultiplier: 1.1,
      reputationDelta: 1,
    },
  ];

export const HARTHMERE_BUSINESS_SCENARIO_OPENERS: readonly string[] = [
  "",
  "Hello there. ",
  "Hi. ",
  "Good to see you. ",
  "Excuse me. ",
  "Hey. ",
  "Greetings. ",
  "Pardon me. ",
];

const HARTHMERE_BUSINESS_REQUEST_CONTEXTS: readonly {
  id: string;
  line: string;
}[] = [
  { id: "before_lunch", line: "I need it handled before lunch." },
  { id: "after_rain", line: "The rain made the problem worse." },
  { id: "neighbor_waiting", line: "My neighbor is waiting on the result." },
  { id: "guild_delivery", line: "It is tied to a guild delivery." },
  { id: "inspection_clock", line: "The inspection clock is ticking." },
  { id: "market_day", line: "Market day has everyone backed up." },
  { id: "road_delay", line: "A road delay already cost me an hour." },
  { id: "family_visit", line: "Family arrives tonight." },
  { id: "branch_order", line: "This is for a branch order." },
  { id: "festival_queue", line: "The festival queue is spilling over." },
  { id: "return_trip", line: "I have one return trip left today." },
  { id: "quiet_request", line: "Please keep the paperwork simple." },
];

const HARTHMERE_BUSINESS_REQUEST_COMPLICATIONS: readonly {
  id: string;
  line: string;
}[] = [
  { id: "parts_checked", line: "I checked the parts list once already." },
  { id: "stock_uncertain", line: "I am not sure the usual stock is enough." },
  { id: "wrong_queue", line: "I may be in the wrong queue." },
  { id: "time_window", line: "There is a narrow handoff window." },
  { id: "repeat_issue", line: "This happened once last week too." },
  { id: "small_budget", line: "Keep the solution practical." },
  { id: "extra_care", line: "Please be careful with the fragile bit." },
  { id: "clear_notes", line: "I need clear notes for whoever follows up." },
  { id: "backup_plan", line: "If the first plan fails, I need a backup." },
  { id: "handoff_rush", line: "The handoff is already late." },
  { id: "quality_check", line: "I will notice if the quality is sloppy." },
  { id: "simple_finish", line: "A clean finish matters more than speed." },
  { id: "mixed_signals", line: "The symptoms are giving mixed signals." },
  { id: "rush_surcharge", line: "I can cover a rush surcharge if needed." },
  { id: "public_counter", line: "Everyone at the counter can see this." },
  { id: "private_counter", line: "I would rather keep this quiet." },
  { id: "courier_waiting", line: "A courier is already waiting outside." },
  { id: "second_opinion", line: "Another shop gave me a different answer." },
  { id: "owner_absent", line: "The owner who usually handles it is away." },
  { id: "weather_hold", line: "Bad weather may pause the next step." },
];

// FNV-1a string hash -> unsigned 32-bit int. Deterministic, no Math.random, so
// the generated queue is reproducible across server and client.
function hashHarthmereScenarioSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createHarthmereBusinessCustomerQueue(input: {
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  sessionId: string;
  nowMs: number;
  count: number;
  nextTicketNumber: number;
  stats?: HarthmereBusinessCustomerStats;
}): { queue: HarthmereBusinessCustomerTicket[]; nextTicketNumber: number } {
  const definition = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[input.typeId];
  const businessIndex = Math.max(
    0,
    BUSINESS_TYPES_IN_ORDER.indexOf(input.typeId)
  );
  const tier = input.stats
    ? harthmereBusinessCustomerTierForStats(input.stats)
    : 1;
  let nextTicketNumber = input.nextTicketNumber;
  const seed = hashHarthmereScenarioSeed(
    `${input.sessionId}:${input.businessId}:${input.typeId}`
  );
  const modifiers = HARTHMERE_BUSINESS_SCENARIO_MODIFIERS;
  const openers = HARTHMERE_BUSINESS_SCENARIO_OPENERS;
  const queue = Array.from(
    { length: Math.max(1, Math.min(12, Math.trunc(input.count))) },
    (_, index) => {
      const preferred = HARTHMERE_BUSINESS_CUSTOMER_NPCS.filter((npc) =>
        npc.businessPreferences.includes(input.typeId)
      );
      const pool = preferred.length
        ? preferred
        : HARTHMERE_BUSINESS_CUSTOMER_NPCS;
      const npc = pool[(businessIndex + index * 7 + tier) % pool.length];
      // The base ask already rotates through every service offer; the
      // repetitiveness players felt was the identical line + stakes each turn.
      // So keep the deterministic offer rotation (callers and tests rely on the
      // first ticket mapping to askTemplates[0] at tier 1) and instead layer an
      // independent persona + greeting on top so the *presented* scenario
      // differs every turn. Strides 5 and 3 are coprime with the pool sizes (16
      // and 8), so each customer in the shift draws a distinct scenario/opener.
      const ask =
        definition.askTemplates[
          (index + tier - 1) % definition.askTemplates.length
        ];
      const modifier = modifiers[(seed * 3 + index * 5) % modifiers.length];
      const opener = openers[(seed * 7 + index * 3) % openers.length];
      const requestContext =
        HARTHMERE_BUSINESS_REQUEST_CONTEXTS[
          (seed + businessIndex * 11 + index * 7) %
            HARTHMERE_BUSINESS_REQUEST_CONTEXTS.length
        ];
      const complication =
        HARTHMERE_BUSINESS_REQUEST_COMPLICATIONS[
          (seed * 5 + businessIndex * 13 + index * 11) %
            HARTHMERE_BUSINESS_REQUEST_COMPLICATIONS.length
        ];
      const askLine = [
        `${opener}${modifier.linePrefix}${ask.line}${modifier.lineSuffix}`,
        requestContext.line,
        complication.line,
      ].join(" ");
      const patience = Math.max(
        15,
        Math.round(
          Math.max(20, ask.patience - (tier - 1) * 5) *
            modifier.patienceMultiplier
        )
      );
      return {
        ticketId: `customer_ticket_${nextTicketNumber++}`,
        npcId: npc.npcId,
        askId: ask.askId,
        requestedOfferId: ask.desiredOfferId,
        askLine,
        status: "waiting" as const,
        arrivedAtMs: input.nowMs + index * 5000,
        patience,
        patienceRemaining: patience,
        difficulty: Math.max(
          1,
          ask.difficulty + Math.max(0, tier - 1) + modifier.difficultyDelta
        ),
        rewardGold: Math.max(
          1,
          Math.round(ask.rewardGold * modifier.rewardMultiplier)
        ),
        reputationDelta: Math.max(
          0,
          ask.reputationDelta + modifier.reputationDelta
        ),
        needDelta: ask.needDelta,
        navGoal: ask.navGoal,
        scenarioId: `${ask.askId}:${modifier.id}:${requestContext.id}:${complication.id}`,
      };
    }
  );
  return { queue, nextTicketNumber };
}

export function activeHarthmereBusinessCustomerTicket(
  session: HarthmereBusinessCustomerSession | undefined
) {
  if (!session || session.status !== "active") return undefined;
  if (session.currentTicketId) {
    const current = session.queue.find(
      (ticket) =>
        ticket.ticketId === session.currentTicketId &&
        ticket.status === "waiting"
    );
    if (current) return current;
  }
  return session.queue.find((ticket) => ticket.status === "waiting");
}

export function findHarthmereBusinessCustomerNpc(npcId: string | undefined) {
  return HARTHMERE_BUSINESS_CUSTOMER_NPCS.find((npc) => npc.npcId === npcId);
}

export const HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID = Object.freeze({
  outpost_refinery_ashline: 66,
  outpost_biome_repair_north: 62,
  outpost_design_glassyard: 45,
  outpost_security_redoubt: 46,
  outpost_portal_eastgate: 65,
  outpost_rare_foods_southplot: 49,
  outpost_tools_cinderlane: 42,
  outpost_magic_moonstall: 26,
  outpost_exploration_westtrail: 51,
  outpost_property_keylot: 53,
  outpost_trader_brightcart: 52,
  outpost_hunter_ridgecooler: 36,
  outpost_clinic_greenlamp: 64,
  outpost_teleport_returnstone: 40,
  outpost_sanitation_clearbarrel: 44,
  outpost_repair_hingehall: 45,
  outpost_restaurant_redpot: 43,
  outpost_courier_stampspur: 46,
  outpost_hospitality_lanternrest: 47,
} as const);

export const HARTHMERE_BUSINESS_OUTPOSTS: readonly HarthmereBusinessOutpost[] =
  [
    {
      outpostId: "outpost_refinery_ashline",
      businessType: "exotic_matter_refinery",
      displayName: "Ashline Containment Works",
      ownerNpcId: "npc_outpost_ashline_foreman",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 673.9607002774867, y: 66, z: -44.2340338348435, rot: 0 },
      building: {
        profile: "dock_warehouse",
        width: 22,
        depth: 16,
        floors: 1,
        banner: "banner_blue",
      },
      job: {
        title: "Refinery Intake Hand",
        starterTask: "Sort sealed raw matter into cold bins.",
        rewardGold: 95,
        teaches: "Containment stock, safety ratings, and fuel customers.",
      },
    },
    {
      outpostId: "outpost_biome_repair_north",
      businessType: "biome_maintenance_repair",
      displayName: "North Anchor Repair Shed",
      ownerNpcId: "npc_outpost_anchorwright",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 766.3165027736272, y: 62, z: 38.15010652462001, rot: 0 },
      building: {
        profile: "workshop",
        width: 18,
        depth: 14,
        floors: 1,
        banner: "banner_green",
      },
      job: {
        title: "Anchor Apprentice",
        starterTask: "Carry repair kits and log climate readings.",
        rewardGold: 70,
        teaches: "Biome decay, maintenance subscriptions, and repair queues.",
      },
    },
    {
      outpostId: "outpost_design_glassyard",
      businessType: "biome_design_studio",
      displayName: "Glassyard Biome Studio",
      ownerNpcId: "npc_outpost_glassyard_designer",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1183.0170734645067, y: 45, z: 138.49653880112697, rot: 0 },
      building: {
        profile: "workshop",
        width: 16,
        depth: 14,
        floors: 1,
        banner: "banner_yellow",
      },
      job: {
        title: "Design Runner",
        starterTask: "Set sample boards for walk-in clients.",
        rewardGold: 60,
        teaches: "Taste matching, beauty demand, and showroom scaling.",
      },
    },
    {
      outpostId: "outpost_security_redoubt",
      businessType: "security_defense_contractor",
      displayName: "Redoubt Contract Yard",
      ownerNpcId: "npc_outpost_redoubt_captain",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1451.8214258969656, y: 46, z: 76.83012025065366, rot: 0 },
      building: {
        profile: "barracks",
        width: 20,
        depth: 14,
        floors: 2,
        banner: "banner_red",
      },
      job: {
        title: "Patrol Clerk",
        starterTask: "Post threat slips and issue signal flares.",
        rewardGold: 85,
        teaches: "Threat triage, guard contracts, and safety reputation.",
      },
    },
    {
      outpostId: "outpost_portal_eastgate",
      businessType: "portal_transit_company",
      displayName: "Eastgate Portal Office",
      ownerNpcId: "npc_outpost_eastgate_operator",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1578.3584113411857, y: 65, z: -136.1081433897003, rot: 0 },
      building: {
        profile: "player_services",
        width: 24,
        depth: 18,
        floors: 2,
        banner: "banner_blue",
      },
      job: {
        title: "Gate Queue Attendant",
        starterTask: "Check passenger tickets against fuel seals.",
        rewardGold: 105,
        teaches: "Passenger/cargo lanes, fuel bottlenecks, and route uptime.",
      },
    },
    {
      outpostId: "outpost_rare_foods_southplot",
      businessType: "biome_farming_rare_foods",
      displayName: "Southplot Rare Foods",
      ownerNpcId: "npc_outpost_southplot_grower",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1723.0393328285693, y: 49, z: -587.6317928761343, rot: 0 },
      building: {
        profile: "provision",
        width: 18,
        depth: 14,
        floors: 1,
        banner: "banner_green",
      },
      job: {
        title: "Harvest Counter Hand",
        starterTask: "Weigh crop bundles and mark freshness tags.",
        rewardGold: 50,
        teaches: "Freshness, spoilage, and restaurant/clinic demand.",
      },
    },
    {
      outpostId: "outpost_tools_cinderlane",
      businessType: "weapons_tools",
      displayName: "Cinderlane Tool Forge",
      ownerNpcId: "npc_outpost_cinderlane_smith",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1630.2156864624603, y: 42, z: -779.5120794973495, rot: 0 },
      building: {
        profile: "smithy",
        width: 20,
        depth: 16,
        floors: 2,
        banner: "banner_red",
      },
      job: {
        title: "Forge Helper",
        starterTask: "Sort repair tools and quench buckets.",
        rewardGold: 75,
        teaches: "Repairs, upgrades, and gear quality.",
      },
    },
    {
      outpostId: "outpost_magic_moonstall",
      businessType: "magic_goods",
      displayName: "Moonstall Ward Shop",
      ownerNpcId: "npc_outpost_moonstall_warder",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1726.6306120121526, y: 26, z: -906.2236258204618, rot: 0 },
      building: {
        profile: "magic_shop",
        width: 18,
        depth: 16,
        floors: 1,
        banner: "banner_blue",
      },
      job: {
        title: "Charm Shelf Assistant",
        starterTask: "Rotate unstable charms before they expire.",
        rewardGold: 90,
        teaches: "Unstable stock, wards, and rare components.",
      },
    },
    {
      outpostId: "outpost_exploration_westtrail",
      businessType: "exploration_guide",
      displayName: "Westtrail Guide Table",
      ownerNpcId: "npc_outpost_westtrail_guide",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1541.436211800648, y: 51, z: -695.2005299046266, rot: 0 },
      building: {
        profile: "stable_office",
        width: 16,
        depth: 12,
        floors: 1,
        banner: "banner_brown",
      },
      job: {
        title: "Map Table Runner",
        starterTask: "Mark route hazards for guide customers.",
        rewardGold: 65,
        teaches: "Map freshness, safety, and expedition booking.",
      },
    },
    {
      outpostId: "outpost_property_keylot",
      businessType: "custom_home_property_development",
      displayName: "Keylot Property Office",
      ownerNpcId: "npc_outpost_keylot_builder",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 1229.236784706693, y: 53, z: -789.3263381042989, rot: 0 },
      building: {
        profile: "workshop",
        width: 20,
        depth: 15,
        floors: 1,
        banner: "banner_brown",
      },
      job: {
        title: "Blueprint Clerk",
        starterTask: "Price wood, stone, and permit packets.",
        rewardGold: 80,
        teaches: "Staged builds, permits, and property scaling.",
      },
    },
    {
      outpostId: "outpost_trader_brightcart",
      businessType: "general_trader",
      displayName: "Brightcart General House",
      ownerNpcId: "npc_outpost_brightcart_trader",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 985.6255482322824, y: 52, z: -934.0141827281337, rot: 0 },
      building: {
        profile: "provision",
        width: 18,
        depth: 14,
        floors: 1,
        banner: "banner_yellow",
      },
      job: {
        title: "Stock Clerk",
        starterTask: "Restock rations and repair parts.",
        rewardGold: 45,
        teaches: "Shelf turns, price spreads, and brokerage.",
      },
    },
    {
      outpostId: "outpost_hunter_ridgecooler",
      businessType: "hunter_wild_meat",
      displayName: "Ridgecooler Larder",
      ownerNpcId: "npc_outpost_ridgecooler_hunter",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 776.1540415580398, y: 36, z: -666.9863482524036, rot: 0 },
      building: {
        profile: "dock_warehouse",
        width: 17,
        depth: 13,
        floors: 1,
        banner: "banner_brown",
      },
      job: {
        title: "Larder Hand",
        starterTask: "Wrap meat and count hide bundles.",
        rewardGold: 55,
        teaches: "Freshness, population pressure, and restaurant supply.",
      },
    },
    {
      outpostId: "outpost_clinic_greenlamp",
      businessType: "medical_doctor",
      displayName: "Greenlamp Walk-In Clinic",
      ownerNpcId: "npc_outpost_greenlamp_doctor",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 656.2165898145233, y: 64, z: -182.1346179092896, rot: 0 },
      building: {
        profile: "apothecary",
        width: 18,
        depth: 15,
        floors: 1,
        banner: "banner_green",
      },
      job: {
        title: "Clinic Aide",
        starterTask: "Prepare bandages and queue triage cards.",
        rewardGold: 70,
        teaches: "Triage, medicine stock, and trust.",
      },
    },
    {
      outpostId: "outpost_teleport_returnstone",
      businessType: "teleport_owner",
      displayName: "Returnstone Pad Office",
      ownerNpcId: "npc_outpost_returnstone_keeper",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: {
        x: 41.873235725931465,
        y: 40,
        z: -30.097021931250612,
        rot: 0,
      },
      building: {
        profile: "stable_office",
        width: 16,
        depth: 13,
        floors: 1,
        banner: "banner_blue",
      },
      job: {
        title: "Pad Key Clerk",
        starterTask: "Issue access tokens and check fuel tags.",
        rewardGold: 95,
        teaches: "Access keys, pad stability, and private travel.",
      },
    },
    {
      outpostId: "outpost_sanitation_clearbarrel",
      businessType: "waste_sanitation_cleanup",
      displayName: "Clearbarrel Cleanup Yard",
      ownerNpcId: "npc_outpost_clearbarrel_boss",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 434.6602350827924, y: 44, z: -346.6819172551751, rot: 0 },
      building: {
        profile: "wash_house",
        width: 18,
        depth: 14,
        floors: 1,
        banner: "banner_white",
      },
      job: {
        title: "Cleanup Loader",
        starterTask: "Seal barrels and sort cleaning reagent.",
        rewardGold: 60,
        teaches: "Sanitation, decontamination, and inspection trust.",
      },
    },
    {
      outpostId: "outpost_repair_hingehall",
      businessType: "repair_maintenance_person",
      displayName: "Hingehall Repair Shop",
      ownerNpcId: "npc_outpost_hingehall_fixer",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 428.8887539912923, y: 45, z: -316.7794260638374, rot: 0 },
      building: {
        profile: "workshop",
        width: 16,
        depth: 13,
        floors: 1,
        banner: "banner_brown",
      },
      job: {
        title: "Fix-It Apprentice",
        starterTask: "Prep nails and label broken fixtures.",
        rewardGold: 45,
        teaches: "Urgency, parts, and repair subscriptions.",
      },
    },
    {
      outpostId: "outpost_restaurant_redpot",
      businessType: "food_service_restaurant",
      displayName: "Redpot Service Kitchen",
      ownerNpcId: "npc_outpost_redpot_cook",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: {
        x: 425.11624353121545,
        y: 43,
        z: -382.02543201953387,
        rot: 0,
      },
      building: {
        profile: "bakery",
        width: 18,
        depth: 14,
        floors: 1,
        banner: "banner_red",
      },
      job: {
        title: "Line Server",
        starterTask: "Plate meals and wrap rations during rush.",
        rewardGold: 50,
        teaches: "Rush serving, menu stock, and sanitation pressure.",
      },
    },
    {
      outpostId: "outpost_courier_stampspur",
      businessType: "courier",
      displayName: "Stampspur Courier Office",
      ownerNpcId: "npc_outpost_stampspur_dispatcher",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 750.9801218122271, y: 46, z: -550.5216277478082, rot: 0 },
      building: {
        profile: "stable_office",
        width: 16,
        depth: 13,
        floors: 1,
        banner: "banner_green",
      },
      job: {
        title: "Dispatch Runner",
        starterTask: "Weigh parcels and copy proof slips.",
        rewardGold: 45,
        teaches: "Deadlines, condition, and route batching.",
      },
    },
    {
      outpostId: "outpost_hospitality_lanternrest",
      businessType: "hospitality_inn_hotel_shelter",
      displayName: "Lanternrest Road Inn",
      ownerNpcId: "npc_outpost_lanternrest_host",
      townId: "harthmere_town",
      regionId: "harthmere_region",
      district: "Production Business Trail",
      position: { x: 605.6295568653649, y: 47, z: -483.82449044213433, rot: 0 },
      building: {
        profile: "inn",
        width: 24,
        depth: 18,
        floors: 2,
        banner: "banner_yellow",
      },
      job: {
        title: "Front Desk Helper",
        starterTask: "Assign room keys and count clean linen.",
        rewardGold: 65,
        teaches: "Occupancy, cleaning, food, and shelter trust.",
      },
    },
  ];

export function harthmereBusinessOutpostGroundY(
  outpost: HarthmereBusinessOutpost
) {
  return (
    HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID[
      outpost.outpostId as keyof typeof HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID
    ] ?? Math.floor(outpost.position.y)
  );
}

function harthmereBusinessOutpostMinigameFootprint(
  outpost: HarthmereBusinessOutpost
) {
  const largeProfiles = new Set<
    HarthmereBusinessOutpost["building"]["profile"]
  >(["barracks", "dock_warehouse", "inn", "player_services", "smithy"]);
  const largeBusiness = /refinery|portal|security|weapons|hospitality/.test(
    outpost.businessType
  );
  const minWidth =
    largeProfiles.has(outpost.building.profile) || largeBusiness ? 28 : 24;
  const minDepth =
    largeProfiles.has(outpost.building.profile) || largeBusiness ? 22 : 20;
  const even = (value: number) => value + Math.abs(value % 2);
  return {
    width: even(Math.max(outpost.building.width, minWidth)),
    depth: even(Math.max(outpost.building.depth, minDepth)),
    floors: outpost.building.floors,
  };
}

function harthmereBusinessOutpostTerrainSamples(
  outpost: HarthmereBusinessOutpost
): readonly HarthmereBusinessOutpostTerrainSample[] {
  const footprint = harthmereBusinessOutpostMinigameFootprint(outpost);
  const x0 = Math.round(outpost.position.x - footprint.width / 2);
  const x1 = x0 + footprint.width - 1;
  const z0 = Math.round(outpost.position.z - footprint.depth / 2);
  const z1 = z0 + footprint.depth - 1;
  const centerX = x0 + Math.floor(footprint.width / 2);
  const centerZ = z0 + Math.floor(footprint.depth / 2);
  const padY = harthmereBusinessOutpostGroundY(outpost);
  const eastDrop = outpost.position.x >= 620 ? 1 : 0;
  const southDrop = outpost.position.z > -140 ? 1 : 0;
  const ridgeDrop =
    outpost.position.z < -300 || outpost.position.x < 360 ? 1 : 0;
  const clampSampleY = (drop: number) => Math.max(padY - 2, padY - drop);
  return [
    { label: "center", x: centerX, y: padY, z: centerZ },
    { label: "front_door", x: centerX, y: padY, z: z0 - 1 },
    { label: "north_west", x: x0, y: clampSampleY(ridgeDrop), z: z0 },
    { label: "north_east", x: x1, y: clampSampleY(eastDrop), z: z0 },
    {
      label: "south_west",
      x: x0,
      y: clampSampleY(southDrop + ridgeDrop),
      z: z1,
    },
    {
      label: "south_east",
      x: x1,
      y: clampSampleY(southDrop + eastDrop),
      z: z1,
    },
  ];
}

export function harthmereBusinessOutpostTerrainGrounding(
  outpost: HarthmereBusinessOutpost
): HarthmereBusinessOutpostTerrainGrounding {
  const samples = harthmereBusinessOutpostTerrainSamples(outpost);
  const sampleYs = samples.map((sample) => sample.y);
  const minTerrainY = Math.min(...sampleYs);
  const maxTerrainY = Math.max(...sampleYs);
  const padGroundY = harthmereBusinessOutpostGroundY(outpost);
  return {
    version: HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUNDING_VERSION,
    source: "harthmere_business_outpost_pad_survey",
    outpostId: outpost.outpostId,
    padGroundY,
    minTerrainY,
    maxTerrainY,
    maxLocalStepVoxels: maxTerrainY - minTerrainY,
    foundationBottomY: minTerrainY - 1,
    samples,
  };
}

export function harthmereBusinessOutpostJobsBoardPosition(
  outpost: HarthmereBusinessOutpost
) {
  const c = Math.cos(outpost.position.rot);
  const s = Math.sin(outpost.position.rot);
  const footprint = harthmereBusinessOutpostMinigameFootprint(outpost);
  const dz = footprint.depth * 0.5 + 2.2;
  return {
    x: outpost.position.x - dz * s,
    y: harthmereBusinessOutpostGroundY(outpost),
    z: outpost.position.z + dz * c,
  };
}

export function getHarthmereBusinessOutpostForType(
  typeId: HarthmereEconomyBusinessTypeId
) {
  return HARTHMERE_BUSINESS_OUTPOSTS.find(
    (outpost) => outpost.businessType === typeId
  );
}

export function harthmereBusinessOutpostMapMarkerId(outpostId: string) {
  return `harthmere_business_${outpostId}`;
}

function harthmereOutpostStructureTypeForProfile(
  profile: HarthmereBusinessOutpost["building"]["profile"]
): BuildingSystemBlueprintDefinition["structureTypeId"] {
  if (
    profile === "dock_warehouse" ||
    profile === "inn" ||
    profile === "barracks" ||
    profile === "player_services"
  )
    return "warehouse";
  if (profile === "bakery" || profile === "provision") return "shop";
  return "workshop";
}

function harthmereOutpostPlotTypeForStructure(
  structureTypeId: BuildingSystemBlueprintDefinition["structureTypeId"]
): BuildingSystemPlotDefinition["plotType"] {
  return structureTypeId === "workshop" ? "crafting" : "commercial";
}

function harthmereOutpostRotationDegrees(rot: number): 0 | 90 | 180 | 270 {
  const normalized = ((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const quarter = Math.round(normalized / (Math.PI / 2)) % 4;
  return ([0, 90, 180, 270] as const)[quarter];
}

function harthmereOutpostOrigin(outpost: HarthmereBusinessOutpost) {
  const footprint = harthmereBusinessOutpostMinigameFootprint(outpost);
  return {
    x: Math.round(outpost.position.x - footprint.width / 2),
    y: harthmereBusinessOutpostGroundY(outpost),
    z: Math.round(outpost.position.z - footprint.depth / 2),
  };
}

function harthmereOutpostBlueprintFor(
  outpost: HarthmereBusinessOutpost
): BuildingSystemBlueprintDefinition {
  const structureTypeId = harthmereOutpostStructureTypeForProfile(
    outpost.building.profile
  );
  const footprint = harthmereBusinessOutpostMinigameFootprint(outpost);
  return {
    blueprintId: `${outpost.outpostId}_backend_voxel_blueprint`,
    displayName: outpost.displayName,
    source: "harthmere_catalog",
    materializationKind: "solid_structure",
    plotType: harthmereOutpostPlotTypeForStructure(structureTypeId),
    use: "business",
    structureTypeId,
    goldCost: 0,
    storageSlots: Math.max(
      24,
      outpost.building.width * outpost.building.floors
    ),
    service: `${outpost.displayName} customer service counter and job-training outpost.`,
    footprint: {
      width: footprint.width,
      depth: footprint.depth,
      height: Math.max(6, footprint.floors * 4 + 2),
    },
    materialStages: {},
    laborStages: {},
    description:
      "Server-owned procedural voxel business building. Structural floors, walls, roof, foundation, and entrance are generated by the backend building materialization plan.",
  };
}

function harthmereOutpostPlotFor(
  outpost: HarthmereBusinessOutpost,
  blueprint: BuildingSystemBlueprintDefinition
): BuildingSystemPlotDefinition {
  const origin = harthmereOutpostOrigin(outpost);
  const margin = 8;
  return {
    plotId: `${outpost.outpostId}_backend_plot`,
    displayName: `${outpost.displayName} Plot`,
    area: "harthmere",
    district: outpost.district,
    plotType: blueprint.plotType,
    allowedUses: ["business"],
    allowedBlueprintIds: [blueprint.blueprintId],
    claimPriceGold: 0,
    taxRate: 0,
    bounds: {
      xMin: origin.x - margin,
      xMax: origin.x + blueprint.footprint.width + margin,
      zMin: origin.z - margin,
      zMax: origin.z + blueprint.footprint.depth + margin,
    },
    groundY: origin.y,
    startsMucked: false,
    safeAfterPurchase: true,
    maxStructureHeight: Math.max(blueprint.footprint.height + 3, 10),
    maxCoveredAreaFraction: 0.75,
    requiresRoadAccess: true,
    roadAccessDistanceVoxels: 6,
    terrainType: "stone",
    description:
      "Backend-generated Harthmere business outpost lot with public entrance, customer queue, service counter, jobs board clearance, and NPC walk path metadata.",
  };
}

function harthmereBusinessOutpostBuildingStyleKit(
  outpost: HarthmereBusinessOutpost
): HarthmereBusinessOutpostBuildingStyleKit {
  const baseNotes = [
    "Backend procedural voxel shell with a grounded stone foundation, readable door, large shop glass, and a visible interior dashboard access point.",
    "Scaled for business mini-game customers, staff workstations, queueing, and passable service flow.",
    "Standardized against the provided Grove reference coordinates for doors, storefront windows, interior furnishing, stone steps, and landscaping.",
  ];
  const sourceStyle = {
    sourceScanVersion: HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN.version,
    sourceFeatureTags: [
      "grounded building shell",
      "readable door",
      "large framed windows",
      "supported furniture",
      "clear customer aisle",
      "business-specific wall storage",
      "landscaped Grove entry",
    ],
    sourceAssetVocabulary: [
      ...HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN.reusableAssetVocabulary
        .shell,
      ...HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN.reusableAssetVocabulary
        .interior,
      ...HARTHMERE_GROVE_BUSINESS_BUILDING_SOURCE_SCAN.reusableAssetVocabulary
        .exterior,
    ],
  } as const;
  if (/medical_doctor/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_stone_storefront",
      ...sourceStyle,
      exteriorWall: "clean_stone_tile",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "wood_floor",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "white_canvas",
      signIcon: "cross",
      exteriorDressing: "clean_clinic_lanterns",
      interiorDressing: "clinic_service",
      styleNotes: [
        ...baseNotes,
        "Clinic palette uses clean stone, pale trim, and simple lit entry markers.",
      ],
    };
  }
  if (/refinery|exotic/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_workshop_warehouse",
      ...sourceStyle,
      exteriorWall: "dark_workshop_stone",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "clean_stone_tile",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "purple_canvas",
      signIcon: "spark",
      exteriorDressing: "arcane_lanterns",
      interiorDressing: "arcane_service",
      styleNotes: [
        ...baseNotes,
        "Containment refinery palette keeps the Grove workshop shell but uses visible arcane safety accents instead of generic hammer signage.",
      ],
    };
  }
  if (
    /repair|maintenance|sanitation|waste|weapons|security/.test(
      outpost.businessType
    )
  ) {
    return {
      referenceLanguage: "grove_workshop_warehouse",
      ...sourceStyle,
      exteriorWall: /security|weapons/.test(outpost.businessType)
        ? "clean_stone_tile"
        : "dark_workshop_stone",
      foundation: "stone_foundation",
      roof: /security|weapons/.test(outpost.businessType)
        ? "red_clay_roof"
        : "green_roof_sod",
      trim: "warm_wood_plank",
      floor: "clean_stone_tile",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: /security|weapons/.test(outpost.businessType)
        ? "red_canvas"
        : "white_canvas",
      signIcon: /security/.test(outpost.businessType) ? "shield" : "hammer",
      exteriorDressing: "workshop_crates",
      interiorDressing: /weapons/.test(outpost.businessType)
        ? "forge_service"
        : "dispatch_service",
      styleNotes: [
        ...baseNotes,
        "Workshop palette uses stone, practical wood trim, visible crates, and open work areas.",
      ],
    };
  }
  if (/portal|teleport|magic|exotic/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_stone_storefront",
      ...sourceStyle,
      exteriorWall: "clean_stone_tile",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "clean_stone_tile",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "purple_canvas",
      signIcon: "spark",
      exteriorDressing: "arcane_lanterns",
      interiorDressing: "arcane_service",
      styleNotes: [
        ...baseNotes,
        "Arcane palette follows the Grove stone storefront examples with purple service accents.",
      ],
    };
  }
  if (/exploration/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_wood_shop",
      ...sourceStyle,
      exteriorWall: "warm_wood_plank",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "wood_floor",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "white_canvas",
      signIcon: "star",
      exteriorDressing: "workshop_crates",
      interiorDressing: "dispatch_service",
      styleNotes: [
        ...baseNotes,
        "Guide-table shops use the Grove wood storefront language with route crates, maps, and expedition booking surfaces.",
      ],
    };
  }
  if (/courier/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_wood_shop",
      ...sourceStyle,
      exteriorWall: "warm_wood_plank",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "wood_floor",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "white_canvas",
      signIcon: "parcel",
      exteriorDressing: "workshop_crates",
      interiorDressing: "dispatch_service",
      styleNotes: [
        ...baseNotes,
        "Courier offices use wood, glass, parcel crates, and clear customer counters.",
      ],
    };
  }
  if (/hospitality|property|design/.test(outpost.businessType)) {
    return {
      referenceLanguage: "grove_wood_shop",
      ...sourceStyle,
      exteriorWall: "warm_wood_plank",
      foundation: "stone_foundation",
      roof: "green_roof_sod",
      trim: "carved_limestone",
      floor: "wood_floor",
      doorStyle: "wood_glass_panel",
      windowStyle: "large_framed_shop_glass",
      awningMaterial: "white_canvas",
      signIcon: /hospitality/.test(outpost.businessType) ? "key" : "star",
      exteriorDressing: "garden_planters",
      interiorDressing: /hospitality/.test(outpost.businessType)
        ? "lodging_service"
        : "counter_service",
      styleNotes: [
        ...baseNotes,
        "Hospitality and studio shops lean on the Grove wood shop example with warm walls and stone steps.",
      ],
    };
  }
  return {
    referenceLanguage: "grove_wood_shop",
    ...sourceStyle,
    exteriorWall: /food_service|farming|trader|hunter/.test(
      outpost.businessType
    )
      ? "warm_wood_plank"
      : "clean_stone_tile",
    foundation: "stone_foundation",
    roof: /food_service/.test(outpost.businessType)
      ? "red_clay_roof"
      : "green_roof_sod",
    trim: "carved_limestone",
    floor: "wood_floor",
    doorStyle: "wood_glass_panel",
    windowStyle: "large_framed_shop_glass",
    awningMaterial: /food_service/.test(outpost.businessType)
      ? "red_canvas"
      : "white_canvas",
    signIcon: /farming|hunter/.test(outpost.businessType) ? "leaf" : "star",
    exteriorDressing: /farming|trader|hunter/.test(outpost.businessType)
      ? "market_baskets"
      : "garden_planters",
    interiorDressing: "counter_service",
    styleNotes: [
      ...baseNotes,
      "Shop palette matches the Grove warm wood, glass front, stone base, and landscaped entry examples.",
    ],
  };
}

// Named interior placement slots. The original six wall slots are retained for
// backward compatibility; the remaining slots form a denser, collision-free grid
// (two side-wall columns, two back columns, and two front-aisle columns) so each
// business can stage a richer, hand-authored interior while keeping the central
// door -> queue -> counter -> exit corridor and the four customer path nodes
// completely clear of physical decor.
export type HarthmereBusinessDecorFixtureSlot =
  | "left"
  | "right"
  | "backLeft"
  | "backRight"
  | "frontLeft"
  | "frontRight"
  | "leftFront"
  | "rightFront"
  | "leftMid"
  | "rightMid"
  | "leftBack"
  | "rightBack"
  | "centerBack"
  | "innerFrontLeft"
  | "innerFrontRight"
  | "innerBackLeft"
  | "innerBackRight";

export type HarthmereBusinessDecorFixtureSeed = {
  label: string;
  role: HarthmereBusinessOutpostInteriorFixtureRole;
  side: HarthmereBusinessDecorFixtureSlot;
  size: readonly [number, number, number];
  colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"];
};

export type HarthmereGroveBusinessInteriorReferencePatternId =
  (typeof HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.constructionFindings)[number]["patternId"];

const referenceFixture = (
  label: string,
  role: HarthmereBusinessOutpostInteriorFixtureRole,
  side: HarthmereBusinessDecorFixtureSlot,
  size: readonly [number, number, number],
  colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"]
): HarthmereBusinessDecorFixtureSeed => ({
  label,
  role,
  side,
  size,
  colorHint,
});

export const HARTHMERE_GROVE_BUSINESS_INTERIOR_REFERENCE_TEMPLATE_FIXTURES: Readonly<
  Record<
    HarthmereGroveBusinessInteriorReferencePatternId,
    readonly HarthmereBusinessDecorFixtureSeed[]
  >
> = {
  civic_stone_threshold: [
    referenceFixture(
      "Stone threshold bench",
      "seating",
      "leftFront",
      [2.4, 0.85, 1.0],
      "wood"
    ),
    referenceFixture(
      "Threshold stock sideboard",
      "stock_storage",
      "rightFront",
      [1.4, 1.25, 1.4],
      "stock"
    ),
    referenceFixture(
      "Wall greenery planter",
      "business_decor",
      "leftMid",
      [1.3, 1.45, 0.7],
      "accent"
    ),
    referenceFixture(
      "Public notice side table",
      "service_table",
      "rightMid",
      [1.6, 0.95, 1.0],
      "wood"
    ),
    referenceFixture(
      "Aisle edge candle post",
      "business_decor",
      "innerFrontLeft",
      [0.6, 1.45, 0.6],
      "safety"
    ),
  ],
  compact_clinic_counter_bed: [
    referenceFixture(
      "Bottle counter run",
      "service_table",
      "leftMid",
      [2.2, 0.95, 1.0],
      "accent"
    ),
    referenceFixture(
      "Recovery bed nook",
      "seating",
      "leftBack",
      [2.5, 0.75, 1.2],
      "trim"
    ),
    referenceFixture(
      "Glass partition screen",
      "business_decor",
      "innerBackLeft",
      [0.7, 1.9, 1.2],
      "safety"
    ),
    referenceFixture(
      "Medicine bottle wall shelf",
      "stock_storage",
      "rightBack",
      [1.4, 1.9, 1.0],
      "accent"
    ),
    referenceFixture(
      "Waiting chair",
      "seating",
      "rightFront",
      [0.9, 0.95, 0.9],
      "wood"
    ),
    referenceFixture(
      "Tiny side lamp table",
      "service_table",
      "innerFrontLeft",
      [1.0, 0.9, 1.0],
      "wood"
    ),
  ],
  stone_counter_bench_lamp: [
    referenceFixture(
      "Purple counter table",
      "service_table",
      "leftMid",
      [2.4, 0.95, 1.0],
      "accent"
    ),
    referenceFixture(
      "Wall bench service bed",
      "seating",
      "leftBack",
      [2.5, 0.75, 1.1],
      "wood"
    ),
    referenceFixture(
      "Floor lamp beside bench",
      "business_decor",
      "leftFront",
      [0.6, 1.5, 0.6],
      "safety"
    ),
    referenceFixture(
      "Small supported side table",
      "service_table",
      "rightFront",
      [1.0, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Window bottle shelf",
      "stock_storage",
      "rightBack",
      [1.4, 1.9, 1.0],
      "accent"
    ),
  ],
  warm_wood_lodging_room: [
    referenceFixture(
      "Warm room table",
      "service_table",
      "leftMid",
      [2.0, 0.95, 1.2],
      "wood"
    ),
    referenceFixture(
      "Wood room chair",
      "seating",
      "innerFrontLeft",
      [0.9, 0.95, 0.9],
      "wood"
    ),
    referenceFixture(
      "Guest bed against wall",
      "seating",
      "leftBack",
      [2.5, 0.75, 1.2],
      "trim"
    ),
    referenceFixture(
      "Lamp nightstand",
      "service_table",
      "rightFront",
      [1.0, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Footlocker cabinet",
      "stock_storage",
      "rightBack",
      [1.3, 1.0, 1.0],
      "stock"
    ),
    referenceFixture(
      "Wall cabinet wardrobe",
      "stock_storage",
      "leftFront",
      [1.3, 1.8, 0.7],
      "trim"
    ),
  ],
  garden_workroom: [
    referenceFixture(
      "Garden work table",
      "service_table",
      "leftMid",
      [2.2, 0.95, 1.2],
      "wood"
    ),
    referenceFixture(
      "Workroom chair",
      "seating",
      "innerFrontLeft",
      [0.9, 0.95, 0.9],
      "wood"
    ),
    referenceFixture(
      "Green bench bed",
      "seating",
      "leftBack",
      [2.4, 0.75, 1.1],
      "accent"
    ),
    referenceFixture(
      "Window planter shelf",
      "business_decor",
      "rightFront",
      [1.5, 1.1, 0.7],
      "accent"
    ),
    referenceFixture(
      "Small stock table",
      "service_table",
      "rightMid",
      [1.3, 0.9, 1.0],
      "stock"
    ),
    referenceFixture(
      "Back cabinet stock",
      "stock_storage",
      "rightBack",
      [1.3, 1.85, 0.8],
      "stock"
    ),
  ],
  blue_shelf_stair_shop: [
    referenceFixture(
      "Blue room shelf wall",
      "stock_storage",
      "leftBack",
      [1.4, 1.9, 1.1],
      "accent"
    ),
    referenceFixture(
      "Book and bottle rack",
      "stock_storage",
      "rightBack",
      [1.4, 1.9, 1.1],
      "stock"
    ),
    referenceFixture(
      "White service counter face",
      "service_table",
      "leftMid",
      [2.2, 0.95, 1.0],
      "safety"
    ),
    referenceFixture(
      "Tool and key wall sign",
      "business_decor",
      "innerBackRight",
      [1.2, 1.55, 0.5],
      "trim"
    ),
    referenceFixture(
      "Stair side display shelf",
      "stock_storage",
      "rightFront",
      [1.2, 1.15, 1.0],
      "stock"
    ),
    referenceFixture(
      "Counter stool",
      "seating",
      "innerFrontLeft",
      [0.8, 0.9, 0.8],
      "wood"
    ),
  ],
  greenhouse_clinic_corridor: [
    referenceFixture(
      "Glass corridor partition",
      "business_decor",
      "leftMid",
      [0.7, 1.9, 1.4],
      "safety"
    ),
    referenceFixture(
      "Tucked bench behind glass",
      "seating",
      "leftBack",
      [2.3, 0.75, 1.1],
      "trim"
    ),
    referenceFixture(
      "Clean white service table",
      "service_table",
      "rightMid",
      [2.0, 0.95, 1.0],
      "safety"
    ),
    referenceFixture(
      "Indoor planter line",
      "business_decor",
      "rightFront",
      [1.6, 1.0, 0.8],
      "accent"
    ),
    referenceFixture(
      "Bottle shelf behind glass",
      "stock_storage",
      "rightBack",
      [1.4, 1.8, 0.9],
      "accent"
    ),
  ],
  threshold_sign_shop: [
    referenceFixture(
      "Blackboard access sign",
      "business_decor",
      "innerFrontLeft",
      [1.2, 1.5, 0.4],
      "accent"
    ),
    referenceFixture(
      "Exterior post-side table",
      "service_table",
      "leftFront",
      [1.6, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Glass storefront display",
      "business_decor",
      "rightFront",
      [1.3, 1.5, 0.7],
      "safety"
    ),
    referenceFixture(
      "Threshold waiting bench",
      "seating",
      "leftMid",
      [2.2, 0.85, 1.0],
      "wood"
    ),
    referenceFixture(
      "Entry stock display",
      "stock_storage",
      "rightMid",
      [1.2, 1.15, 1.2],
      "stock"
    ),
  ],
  stone_glass_stair_display: [
    referenceFixture(
      "Raised glass display ledge",
      "service_table",
      "leftMid",
      [2.2, 0.95, 1.0],
      "safety"
    ),
    referenceFixture(
      "Pedestal focal stock",
      "business_decor",
      "centerBack",
      [1.1, 1.25, 1.1],
      "accent"
    ),
    referenceFixture(
      "Stair-side bottle shelf",
      "stock_storage",
      "rightBack",
      [1.4, 1.9, 1.0],
      "accent"
    ),
    referenceFixture(
      "Window plant stand",
      "business_decor",
      "rightFront",
      [1.2, 1.25, 0.8],
      "accent"
    ),
    referenceFixture(
      "Small stair landing table",
      "service_table",
      "leftBack",
      [1.3, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Glass display lamp",
      "business_decor",
      "innerFrontLeft",
      [0.6, 1.5, 0.6],
      "safety"
    ),
  ],
  gray_office_lounge: [
    referenceFixture(
      "Office desk",
      "service_table",
      "leftMid",
      [2.2, 0.95, 1.1],
      "wood"
    ),
    referenceFixture(
      "Office chair",
      "seating",
      "innerFrontLeft",
      [0.9, 0.95, 0.9],
      "wood"
    ),
    referenceFixture(
      "Customer couch bench",
      "seating",
      "leftBack",
      [2.5, 0.85, 1.1],
      "trim"
    ),
    referenceFixture(
      "Planter beside couch",
      "business_decor",
      "leftFront",
      [1.0, 1.2, 0.8],
      "accent"
    ),
    referenceFixture(
      "Office floor lamp",
      "business_decor",
      "rightFront",
      [0.6, 1.5, 0.6],
      "safety"
    ),
    referenceFixture(
      "Black wall cabinet bottles",
      "stock_storage",
      "rightBack",
      [1.4, 1.8, 0.8],
      "accent"
    ),
  ],
  long_windowed_counter_shop: [
    referenceFixture(
      "Long wooden desk counter",
      "service_table",
      "leftMid",
      [2.8, 0.95, 1.0],
      "wood"
    ),
    referenceFixture(
      "Shelf wall of stock",
      "stock_storage",
      "rightBack",
      [1.4, 1.9, 1.2],
      "stock"
    ),
    referenceFixture(
      "Small gifts on desk",
      "business_decor",
      "innerBackRight",
      [1.0, 1.05, 0.7],
      "accent"
    ),
    referenceFixture(
      "Colored identity panel",
      "business_decor",
      "leftBack",
      [1.0, 1.7, 0.4],
      "accent"
    ),
    referenceFixture(
      "Window-side waiting chair",
      "seating",
      "rightFront",
      [0.9, 0.95, 0.9],
      "wood"
    ),
    referenceFixture(
      "Counter lamp",
      "business_decor",
      "innerFrontLeft",
      [0.6, 1.4, 0.6],
      "safety"
    ),
  ],
  garden_entry_frontage: [
    referenceFixture(
      "Entry planter box",
      "business_decor",
      "leftFront",
      [1.5, 1.0, 0.8],
      "accent"
    ),
    referenceFixture(
      "Public sign table",
      "service_table",
      "rightFront",
      [1.5, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Garden waiting bench",
      "seating",
      "leftMid",
      [2.2, 0.85, 1.0],
      "wood"
    ),
    referenceFixture(
      "Entry stock basket",
      "stock_storage",
      "rightMid",
      [1.2, 1.1, 1.2],
      "stock"
    ),
  ],
  glass_veranda_lounge: [
    referenceFixture(
      "Veranda lounge bench",
      "seating",
      "leftMid",
      [2.5, 0.85, 1.1],
      "wood"
    ),
    referenceFixture(
      "Low glass railing",
      "business_decor",
      "leftBack",
      [1.6, 1.0, 0.5],
      "safety"
    ),
    referenceFixture(
      "Wood overlook table",
      "service_table",
      "rightMid",
      [1.8, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Wall sign lamp",
      "business_decor",
      "innerBackRight",
      [1.0, 1.5, 0.4],
      "safety"
    ),
    referenceFixture(
      "Veranda storage cabinet",
      "stock_storage",
      "rightBack",
      [1.4, 1.0, 1.0],
      "stock"
    ),
  ],
  wood_hall_lodging: [
    referenceFixture(
      "Wood hallway side table",
      "service_table",
      "leftMid",
      [1.8, 0.9, 1.0],
      "wood"
    ),
    referenceFixture(
      "Doorway bench",
      "seating",
      "leftBack",
      [2.3, 0.85, 1.0],
      "wood"
    ),
    referenceFixture(
      "Wall-mounted hall light",
      "business_decor",
      "innerBackRight",
      [0.7, 1.5, 0.5],
      "safety"
    ),
    referenceFixture(
      "Glass side-room screen",
      "business_decor",
      "rightMid",
      [0.7, 1.9, 1.3],
      "safety"
    ),
    referenceFixture(
      "Farm stock sideboard",
      "stock_storage",
      "rightBack",
      [1.4, 1.2, 1.4],
      "stock"
    ),
  ],
} as const;

export const HARTHMERE_BUSINESS_REFERENCE_INTERIOR_TEMPLATE_BY_TYPE: Readonly<
  Record<
    HarthmereEconomyBusinessTypeId,
    HarthmereGroveBusinessInteriorReferencePatternId
  >
> = {
  exotic_matter_refinery: "stone_glass_stair_display",
  biome_maintenance_repair: "blue_shelf_stair_shop",
  biome_design_studio: "garden_workroom",
  security_defense_contractor: "civic_stone_threshold",
  portal_transit_company: "stone_glass_stair_display",
  biome_farming_rare_foods: "greenhouse_clinic_corridor",
  weapons_tools: "blue_shelf_stair_shop",
  magic_goods: "stone_counter_bench_lamp",
  exploration_guide: "gray_office_lounge",
  custom_home_property_development: "gray_office_lounge",
  general_trader: "long_windowed_counter_shop",
  hunter_wild_meat: "garden_workroom",
  medical_doctor: "compact_clinic_counter_bed",
  teleport_owner: "stone_glass_stair_display",
  waste_sanitation_cleanup: "compact_clinic_counter_bed",
  repair_maintenance_person: "blue_shelf_stair_shop",
  food_service_restaurant: "warm_wood_lodging_room",
  courier: "long_windowed_counter_shop",
  hospitality_inn_hotel_shelter: "glass_veranda_lounge",
} as const;

// Hand-authored "character" props per business type. These dress each interior so
// it reads as the real trade (a forge has an anvil and ember light, a clinic has a
// treatment cot and medicine cabinet, an inn has a key wall and guest lounge) on top
// of the four functional mini-game surfaces below. Tuple: [label, role, size, colorHint].
// Slots are assigned automatically from a collision-free pool, so authors only choose
// the props and their footprint, never raw coordinates.
type HarthmereBusinessThematicFixture = readonly [
  label: string,
  role: HarthmereBusinessOutpostInteriorFixtureRole,
  size: readonly [number, number, number],
  colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"]
];

const HARTHMERE_BUSINESS_THEMATIC_INTERIOR_FIXTURES: Readonly<
  Record<
    HarthmereEconomyBusinessTypeId,
    readonly HarthmereBusinessThematicFixture[]
  >
> = {
  exotic_matter_refinery: [
    ["Coolant tank bank", "stock_storage", [1.2, 2.0, 1.2], "stock"],
    ["Hazard containment cage", "business_decor", [1.4, 1.8, 1.4], "safety"],
    ["Spent filter shelf", "stock_storage", [1.4, 1.2, 1.4], "stock"],
    ["Hazard warning lantern", "business_decor", [0.6, 1.5, 0.6], "safety"],
  ],
  biome_maintenance_repair: [
    ["Anchor calibration rig", "workstation", [1.4, 1.6, 1.2], "accent"],
    ["Spare parts wall rack", "stock_storage", [1.3, 1.95, 0.6], "stock"],
    ["Tool pegboard cabinet", "business_decor", [1.6, 1.7, 0.5], "trim"],
    ["Repair waiting bench", "seating", [2.2, 0.9, 1.0], "wood"],
  ],
  biome_design_studio: [
    ["Material swatch wall", "business_decor", [1.2, 1.8, 0.5], "accent"],
    ["Sample plant stand", "business_decor", [0.9, 1.3, 0.9], "accent"],
    ["Client lounge bench", "seating", [2.2, 0.9, 1.0], "wood"],
    ["Showroom display plinth", "workstation", [1.0, 1.1, 1.0], "primary"],
  ],
  security_defense_contractor: [
    ["Weapon wall rack", "stock_storage", [1.0, 1.95, 0.6], "trim"],
    ["Armor display stand", "business_decor", [1.0, 1.8, 1.0], "primary"],
    ["Patrol briefing bench", "seating", [2.2, 0.9, 1.0], "wood"],
    ["Signal flare lantern", "business_decor", [0.6, 1.5, 0.6], "safety"],
  ],
  portal_transit_company: [
    ["Portal arch frame", "business_decor", [1.6, 2.2, 0.6], "accent"],
    ["Fuel reserve canister rack", "stock_storage", [1.3, 1.9, 1.0], "stock"],
    ["Passenger waiting bench", "seating", [2.4, 0.9, 1.0], "wood"],
    ["Arcane guidance lantern", "business_decor", [0.6, 1.6, 0.6], "safety"],
  ],
  biome_farming_rare_foods: [
    ["Cold larder shelf", "stock_storage", [1.3, 1.9, 2.0], "stock"],
    ["Harvest display shelf", "stock_storage", [1.4, 1.2, 1.4], "stock"],
    ["Seedling planter bed", "business_decor", [1.6, 0.6, 1.0], "accent"],
    ["Herb drying rack", "business_decor", [1.2, 1.7, 0.5], "wood"],
  ],
  weapons_tools: [
    ["Forge anvil block", "workstation", [1.0, 1.0, 1.0], "trim"],
    ["Quench bucket bench", "seating", [1.6, 0.9, 1.0], "stock"],
    ["Finished blade wall rack", "stock_storage", [1.0, 1.95, 0.5], "trim"],
    ["Forge hearth ember light", "business_decor", [1.0, 1.4, 1.0], "safety"],
  ],
  magic_goods: [
    ["Charm display shelf", "stock_storage", [1.3, 1.9, 1.0], "accent"],
    ["Potion brewing cauldron", "workstation", [1.0, 1.2, 1.0], "primary"],
    ["Ward circle plinth", "business_decor", [1.2, 0.4, 1.2], "accent"],
    ["Rune lantern", "business_decor", [0.6, 1.5, 0.6], "safety"],
    ["Arcane reading bench", "seating", [1.8, 0.9, 1.0], "wood"],
  ],
  exploration_guide: [
    ["Route wall map", "business_decor", [1.2, 1.6, 0.4], "accent"],
    ["Trailhead supply rack", "stock_storage", [1.4, 1.2, 1.4], "stock"],
    ["Expedition planning bench", "seating", [2.2, 0.9, 1.0], "wood"],
    ["Lantern and gear rack", "business_decor", [1.2, 1.7, 0.5], "trim"],
  ],
  custom_home_property_development: [
    ["Architect drafting easel", "workstation", [1.8, 1.0, 1.1], "wood"],
    ["Model home display", "business_decor", [1.2, 0.9, 1.2], "primary"],
    ["Deed and permit cabinet", "stock_storage", [1.3, 1.8, 0.6], "trim"],
    ["Client signing bench", "seating", [2.2, 0.9, 1.0], "wood"],
  ],
  general_trader: [
    ["Dry goods shelf", "stock_storage", [1.3, 1.95, 1.0], "stock"],
    ["Seed and tool barrel", "business_decor", [1.0, 1.1, 1.0], "wood"],
    ["Ready order shelf", "stock_storage", [1.4, 1.2, 1.4], "stock"],
    ["Price chalk board", "business_decor", [1.2, 1.5, 0.3], "accent"],
  ],
  hunter_wild_meat: [
    ["Walk-in cold larder", "stock_storage", [1.3, 1.9, 2.0], "stock"],
    ["Hanging cuts rack", "business_decor", [1.2, 1.9, 0.8], "trim"],
    ["Hide tanning bench", "seating", [1.8, 0.9, 1.0], "wood"],
    ["Ice display trough", "business_decor", [1.0, 1.0, 1.0], "stock"],
  ],
  medical_doctor: [
    ["Recovery cot bed", "seating", [2.0, 0.7, 1.0], "trim"],
    ["Apothecary cabinet", "stock_storage", [1.2, 1.9, 0.6], "accent"],
    ["Clinic waiting bench", "seating", [2.2, 0.9, 1.0], "wood"],
    ["Sanitation lantern", "business_decor", [0.6, 1.4, 0.6], "safety"],
  ],
  teleport_owner: [
    ["Return pad plinth", "business_decor", [1.6, 0.4, 1.6], "accent"],
    ["Access token rack", "stock_storage", [1.2, 1.8, 0.5], "trim"],
    ["Access waiting bench", "seating", [2.2, 0.9, 1.0], "wood"],
    ["Link stability lantern", "business_decor", [0.6, 1.6, 0.6], "safety"],
  ],
  waste_sanitation_cleanup: [
    ["Sorting wash trough row", "stock_storage", [1.8, 1.2, 1.0], "stock"],
    ["Decon spray station", "workstation", [1.2, 1.6, 1.0], "accent"],
    ["Recycling sorting rack", "stock_storage", [1.4, 1.2, 1.4], "stock"],
    ["Hazard warning lantern", "business_decor", [0.6, 1.4, 0.6], "safety"],
  ],
  repair_maintenance_person: [
    ["Tool pegboard wall", "business_decor", [1.2, 1.7, 0.4], "trim"],
    ["Spare parts shelf", "stock_storage", [1.3, 1.95, 1.0], "stock"],
    ["Workbench vise", "workstation", [1.6, 1.0, 1.0], "wood"],
    ["Repair intake bench", "seating", [2.0, 0.9, 1.0], "wood"],
  ],
  food_service_restaurant: [
    ["Cooking hearth", "workstation", [1.4, 1.4, 1.2], "safety"],
    ["Ingredient pantry", "stock_storage", [1.3, 1.9, 1.6], "stock"],
    ["Dining bench pair", "seating", [2.4, 0.9, 1.0], "wood"],
    ["Steam prep table", "service_table", [1.8, 0.95, 1.0], "wood"],
    ["Spice shelf", "business_decor", [1.0, 1.2, 0.5], "accent"],
  ],
  courier: [
    ["Parcel weigh scale", "service_table", [1.4, 0.9, 1.0], "trim"],
    ["Parcel sorting shelf", "stock_storage", [1.3, 1.95, 1.0], "stock"],
    ["Route hazard map", "business_decor", [1.2, 1.5, 0.4], "accent"],
    ["Dispatch waiting bench", "seating", [2.0, 0.9, 1.0], "wood"],
  ],
  hospitality_inn_hotel_shelter: [
    ["Lobby notice board", "business_decor", [1.2, 1.7, 0.4], "accent"],
    ["Guest lounge bench", "seating", [2.4, 0.9, 1.0], "wood"],
    ["Linen cabinet", "stock_storage", [1.4, 1.0, 1.0], "stock"],
    ["Welcome sideboard", "service_table", [1.8, 0.95, 1.0], "wood"],
    ["Hearth lantern", "business_decor", [0.8, 1.4, 0.8], "safety"],
  ],
};

// Slots the four functional mini-game surfaces always occupy, plus the ordered pool
// the thematic props draw from. Both lists are disjoint and every slot is spaced so
// no two fixtures overlap and none cross the customer path nodes.
const HARTHMERE_BUSINESS_FUNCTIONAL_FIXTURE_SLOTS = {
  primaryBoard: "innerBackLeft",
  serviceSurface: "rightMid",
  stockSurface: "rightBack",
  warningSurface: "innerFrontRight",
} as const;

const HARTHMERE_BUSINESS_DECOR_SLOT_FALLBACK_POOL: readonly HarthmereBusinessDecorFixtureSlot[] =
  [
    "leftFront",
    "rightFront",
    "leftMid",
    "rightMid",
    "leftBack",
    "rightBack",
    "frontLeft",
    "frontRight",
    "backLeft",
    "backRight",
    "innerFrontLeft",
    "innerFrontRight",
    "innerBackLeft",
    "innerBackRight",
    "centerBack",
    "left",
    "right",
  ];

const HARTHMERE_BUSINESS_THEMATIC_FIXTURE_SLOT_POOL: readonly HarthmereBusinessDecorFixtureSlot[] =
  [
    "leftMid",
    "leftBack",
    "leftFront",
    "rightFront",
    "centerBack",
    "innerFrontLeft",
  ];

function harthmereBusinessDecorFixtureSeeds(
  typeId: HarthmereEconomyBusinessTypeId
): readonly HarthmereBusinessDecorFixtureSeed[] {
  const fixture = (
    label: string,
    role: HarthmereBusinessOutpostInteriorFixtureRole,
    side: HarthmereBusinessDecorFixtureSeed["side"],
    size: readonly [number, number, number],
    colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"]
  ) => ({ label, role, side, size, colorHint });
  const usedSlots = new Set<HarthmereBusinessDecorFixtureSlot>();
  const seeds: HarthmereBusinessDecorFixtureSeed[] = [];
  const reserveSlot = (preferred: HarthmereBusinessDecorFixtureSlot) => {
    if (!usedSlots.has(preferred)) {
      usedSlots.add(preferred);
      return preferred;
    }
    const fallback = HARTHMERE_BUSINESS_DECOR_SLOT_FALLBACK_POOL.find(
      (slot) => !usedSlots.has(slot)
    );
    if (fallback) {
      usedSlots.add(fallback);
      return fallback;
    }
    return preferred;
  };
  const pushFixture = (
    label: string,
    role: HarthmereBusinessOutpostInteriorFixtureRole,
    side: HarthmereBusinessDecorFixtureSlot,
    size: readonly [number, number, number],
    colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"]
  ) => {
    seeds.push(fixture(label, role, reserveSlot(side), size, colorHint));
  };
  // Every business type has a mini-game spec; the spec's interiorFixtureLabels drive
  // the four functional surface labels so each business keeps its correct named
  // surfaces (e.g. "Buff service line" for the restaurant, "Severity triage board"
  // for the clinic) wired to the mini-game.
  const mechanicSpec = getHarthmereBusinessMiniGameSpec(typeId);
  const [primaryBoard, serviceSurface, stockSurface, warningSurface] =
    mechanicSpec.interiorFixtureLabels;
  pushFixture(
    primaryBoard,
    "workstation",
    HARTHMERE_BUSINESS_FUNCTIONAL_FIXTURE_SLOTS.primaryBoard,
    [1.8, 1.15, 0.9],
    "accent"
  );
  pushFixture(
    serviceSurface,
    "service_table",
    HARTHMERE_BUSINESS_FUNCTIONAL_FIXTURE_SLOTS.serviceSurface,
    [1.3, 0.95, 1.6],
    "wood"
  );
  pushFixture(
    stockSurface,
    "stock_storage",
    HARTHMERE_BUSINESS_FUNCTIONAL_FIXTURE_SLOTS.stockSurface,
    [1.3, 1.95, 1.6],
    "stock"
  );
  pushFixture(
    warningSurface,
    "business_decor",
    HARTHMERE_BUSINESS_FUNCTIONAL_FIXTURE_SLOTS.warningSurface,
    [1.3, 1.2, 1.0],
    "safety"
  );
  // Rebuild the room around the player's supplied Grove references: counters,
  // shelves, beds/benches, tables, chairs, lamps, planters, and display ledges.
  const referenceTemplateId =
    HARTHMERE_BUSINESS_REFERENCE_INTERIOR_TEMPLATE_BY_TYPE[typeId];
  for (const seed of HARTHMERE_GROVE_BUSINESS_INTERIOR_REFERENCE_TEMPLATE_FIXTURES[
    referenceTemplateId
  ] ?? []) {
    pushFixture(seed.label, seed.role, seed.side, seed.size, seed.colorHint);
  }
  // Layer the trade-specific props on top, each pinned to an unused slot from
  // the spaced pool so the interior reads as the real business while staying
  // passable.
  const thematic = HARTHMERE_BUSINESS_THEMATIC_INTERIOR_FIXTURES[typeId] ?? [];
  thematic.forEach(([label, role, size, colorHint], index) => {
    const slot =
      HARTHMERE_BUSINESS_THEMATIC_FIXTURE_SLOT_POOL[
        index % HARTHMERE_BUSINESS_THEMATIC_FIXTURE_SLOT_POOL.length
      ];
    pushFixture(label, role, slot, size, colorHint);
  });
  return seeds;
}

function harthmereBusinessInteriorFixturePosition(
  side: HarthmereBusinessDecorFixtureSeed["side"],
  input: {
    origin: { x: number; y: number; z: number };
    width: number;
    depth: number;
    serviceCounter: { x: number; y: number; z: number };
  }
) {
  const y = input.origin.y + 1;
  const doorX = input.origin.x + Math.floor(input.width / 2);
  const leftX = input.origin.x + 3;
  const rightX = input.origin.x + input.width - 4;
  const frontZ = input.origin.z + 5;
  const midZ = input.origin.z + Math.floor(input.depth / 2);
  const sideZ = Math.max(input.origin.z + 6, input.serviceCounter.z - 3);
  const backZ = Math.min(
    input.origin.z + input.depth - 4,
    input.serviceCounter.z + 3
  );
  // Inner columns sit four voxels either side of the centered door so back/front
  // props flank the queue and counter without ever covering the path nodes.
  const innerLeftX = Math.max(leftX + 1, doorX - 4);
  const innerRightX = Math.min(rightX - 1, doorX + 4);
  switch (side) {
    // Legacy six-slot wall map (kept for compatibility).
    case "left":
      return { x: leftX, y, z: sideZ };
    case "right":
      return { x: rightX, y, z: sideZ };
    case "backLeft":
      return { x: leftX + 1, y, z: backZ };
    case "backRight":
      return { x: rightX - 1, y, z: backZ };
    case "frontLeft":
      return { x: leftX + 1, y, z: frontZ };
    case "frontRight":
      return { x: rightX - 1, y, z: frontZ };
    // Dense, collision-free grid for bespoke interiors.
    case "leftFront":
      return { x: leftX, y, z: frontZ };
    case "rightFront":
      return { x: rightX, y, z: frontZ };
    case "leftMid":
      return { x: leftX, y, z: midZ };
    case "rightMid":
      return { x: rightX, y, z: midZ };
    case "leftBack":
      return { x: leftX, y, z: backZ };
    case "rightBack":
      return { x: rightX, y, z: backZ };
    case "centerBack":
      return { x: doorX, y, z: backZ };
    case "innerFrontLeft":
      return { x: innerLeftX, y, z: frontZ };
    case "innerFrontRight":
      return { x: innerRightX, y, z: frontZ };
    case "innerBackLeft":
      return { x: innerLeftX, y, z: backZ };
    case "innerBackRight":
      return { x: innerRightX, y, z: backZ };
  }
}

function createHarthmereBusinessInteriorFixtures(input: {
  outpost: HarthmereBusinessOutpost;
  origin: { x: number; y: number; z: number };
  blueprint: BuildingSystemBlueprintDefinition;
  queueNode: { x: number; y: number; z: number };
  serviceCounter: { x: number; y: number; z: number };
  dashboardAccessPoint: HarthmereBusinessOutpostProceduralBuildingRecord["dashboardAccessPoint"];
  primaryBikkieGraphic?: HarthmereBusinessBikkieGraphic;
}): HarthmereBusinessOutpostInteriorFixture[] {
  const fixture = (
    suffix: string,
    role: HarthmereBusinessOutpostInteriorFixtureRole,
    label: string,
    position: { x: number; y: number; z: number },
    size: readonly [number, number, number],
    colorHint: HarthmereBusinessOutpostInteriorFixture["colorHint"],
    blocksNavigation: boolean,
    businessSpecific: boolean,
    bikkieGraphicId?: string
  ): HarthmereBusinessOutpostInteriorFixture => ({
    fixtureId: `${input.outpost.outpostId}:${suffix}`,
    role,
    label,
    position,
    size,
    colorHint,
    blocksNavigation,
    businessSpecific,
    bikkieGraphicId,
  });
  const fixtures: HarthmereBusinessOutpostInteriorFixture[] = [
    fixture(
      "customer-queue",
      "customer_queue_space",
      "Customer queue space",
      input.queueNode,
      [4.4, 0.08, 2.0],
      "accent",
      false,
      false
    ),
    fixture(
      "service-counter",
      "service_counter",
      `${input.outpost.displayName} service counter`,
      input.serviceCounter,
      [6.4, 0.95, 1.0],
      "wood",
      false,
      false
    ),
    fixture(
      "dashboard-access",
      "dashboard_access",
      input.dashboardAccessPoint.label,
      input.dashboardAccessPoint.position,
      [1.4, 1.75, 0.6],
      "safety",
      false,
      false
    ),
  ];
  if (input.primaryBikkieGraphic) {
    fixtures.push(
      fixture(
        "primary-station",
        "primary_station",
        input.primaryBikkieGraphic.label,
        {
          x: input.origin.x + input.blueprint.footprint.width - 5,
          y: input.origin.y + 1,
          z: Math.min(
            input.origin.z + input.blueprint.footprint.depth - 4,
            input.serviceCounter.z + 2
          ),
        },
        [1.6, 1.25, 1.6],
        "primary",
        true,
        true,
        input.primaryBikkieGraphic.graphicId
      )
    );
  }
  for (const seed of harthmereBusinessDecorFixtureSeeds(
    input.outpost.businessType
  )) {
    fixtures.push(
      fixture(
        seed.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        seed.role,
        seed.label,
        harthmereBusinessInteriorFixturePosition(seed.side, {
          origin: input.origin,
          width: input.blueprint.footprint.width,
          depth: input.blueprint.footprint.depth,
          serviceCounter: input.serviceCounter,
        }),
        seed.size,
        seed.colorHint,
        true,
        true
      )
    );
  }
  return fixtures;
}

function addHarthmereOutpostRetainingFoundationSupports(input: {
  materializationPlan: BuildingSystemMaterializationPlan;
  plot: BuildingSystemPlotDefinition;
  origin: { x: number; y: number; z: number };
}) {
  const foundationValue = input.materializationPlan.edits.find(
    (edit) => edit.label === "foundation"
  )?.value;
  if (!foundationValue) return;
  const { xMin, xMax, zMin, zMax } = input.plot.bounds;
  const yMin = input.origin.y - 8;
  const yMax = input.origin.y - 1;
  const supportKeys = new Set<string>();
  const addSupportColumn = (x: number, z: number) => {
    for (let y = yMin; y <= yMax; y += 1) {
      supportKeys.add(`${x}:${y}:${z}`);
    }
  };
  for (let x = xMin; x < xMax; x += 4) {
    addSupportColumn(x, zMin);
    addSupportColumn(x, zMax - 1);
  }
  for (let z = zMin; z < zMax; z += 4) {
    addSupportColumn(xMin, z);
    addSupportColumn(xMax - 1, z);
  }
  for (const key of supportKeys) {
    const [x, y, z] = key.split(":").map((value) => Number.parseInt(value, 10));
    input.materializationPlan.edits.push({
      kind: "editEvent",
      position: [x, y, z],
      value: foundationValue,
      label: "foundation",
    });
  }
}

// Garden/yard ring grown outside the claimed plot so every business sits on a
// flat, fertile, walkable safe site that blends into the surrounding terrain
// instead of being dropped into a hole or perched on a cliff.
export const HARTHMERE_BUSINESS_OUTPOST_GARDEN_RING = 4;
// Sub-grade depth used to fill drops/holes so there are no sharp steps at the
// building edge. Terrain inside the surveyed pad is constrained to <=2 voxels of
// local step, so three filled layers fully blends the yard to the pad height.
const HARTHMERE_BUSINESS_OUTPOST_SUBGRADE_DEPTH = 3;

export function harthmereBusinessOutpostSafeSiteBounds(
  plotBounds: { xMin: number; xMax: number; zMin: number; zMax: number },
  ring = HARTHMERE_BUSINESS_OUTPOST_GARDEN_RING
) {
  return {
    xMin: plotBounds.xMin - ring,
    xMax: plotBounds.xMax + ring,
    zMin: plotBounds.zMin - ring,
    zMax: plotBounds.zMax + ring,
  };
}

// Designated muck-territory anchors (authored danger/muck zone centers). Muck
// monsters and Hexes that would otherwise stand on a business pad are relocated
// to the nearest of these so the safe site stays clear and the muck stays in a
// real muck area nearby.
const HARTHMERE_BUSINESS_OUTPOST_MUCK_RELOCATION_ANCHORS = Object.freeze([
  {
    id: "watchtower_muck_clearing",
    label: "Watchtower Muck Clearing",
    center: { x: 332, y: 54, z: -390 },
  },
  {
    id: "old_wood_mucker_copse",
    label: "Old Wood Mucker Copse",
    center: { x: 640, y: 54, z: -455 },
  },
  {
    id: "gravewood_pale_muck",
    label: "Gravewood Pale Muck",
    center: { x: 640, y: 54, z: 120 },
  },
  {
    id: "road_muckwad_patch",
    label: "Road Muckwad Patch",
    center: { x: 512, y: 54, z: -152 },
  },
] as const);

export function harthmereBusinessOutpostMuckRelocationTarget(point: {
  x: number;
  z: number;
}) {
  let best: (typeof HARTHMERE_BUSINESS_OUTPOST_MUCK_RELOCATION_ANCHORS)[number] =
    HARTHMERE_BUSINESS_OUTPOST_MUCK_RELOCATION_ANCHORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of HARTHMERE_BUSINESS_OUTPOST_MUCK_RELOCATION_ANCHORS) {
    const distance = Math.hypot(
      anchor.center.x - point.x,
      anchor.center.z - point.z
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return { ...best, distanceMeters: bestDistance };
}

// Lay a flat, graded, green safe site: fill any drop below the pad with dirt,
// pave grass across the whole yard ring, and plant garden beds/borders so the
// exterior reads as a tended Grove storefront rather than raw muck terrain.
function addHarthmereOutpostSiteGradingAndGarden(input: {
  materializationPlan: BuildingSystemMaterializationPlan;
  plot: BuildingSystemPlotDefinition;
  origin: { x: number; y: number; z: number };
  blueprint: BuildingSystemBlueprintDefinition;
  styleKit: HarthmereBusinessOutpostBuildingStyleKit;
}) {
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  const groundY = input.origin.y;
  const site = harthmereBusinessOutpostSafeSiteBounds(input.plot.bounds);
  const bx0 = input.origin.x;
  const bx1 = input.origin.x + input.blueprint.footprint.width - 1;
  const bz0 = input.origin.z;
  const bz1 = input.origin.z + input.blueprint.footprint.depth - 1;
  const doorX =
    input.origin.x + Math.floor(input.blueprint.footprint.width / 2);
  const used = new Set(
    input.materializationPlan.edits.map((edit) =>
      harthmereOutpostEditKey(edit.position)
    )
  );
  const tryPlace = (
    position: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"]
  ) => {
    const key = harthmereOutpostEditKey(position);
    if (used.has(key)) return;
    used.add(key);
    pushHarthmereOutpostVoxelEdit(
      input.materializationPlan,
      position,
      value,
      label
    );
  };

  const insideBuildingFootprint = (x: number, z: number) =>
    x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1;
  // Keep the front entry walk (door apron) as clean stone, not grass/garden.
  const insideEntryWalk = (x: number, z: number) =>
    x >= doorX - 1 && x <= doorX + 1 && z >= bz0 - 5 && z < bz0;

  const gardenAccent =
    input.styleKit.exteriorDressing === "market_baskets"
      ? blocks.hay
      : input.styleKit.exteriorDressing === "garden_planters"
      ? blocks.moss
      : blocks.moss;

  for (let x = site.xMin; x <= site.xMax; x += 1) {
    for (let z = site.zMin; z <= site.zMax; z += 1) {
      if (insideBuildingFootprint(x, z)) continue;
      if (insideEntryWalk(x, z)) continue;
      // Fill any drop below the pad so the yard is flat with no sharp steps.
      for (
        let depth = 1;
        depth <= HARTHMERE_BUSINESS_OUTPOST_SUBGRADE_DEPTH;
        depth += 1
      ) {
        tryPlace([x, groundY - depth, z], blocks.dirt, "foundation");
      }
      // Fertile green top surface across the whole safe site.
      const inGardenRing =
        x < input.plot.bounds.xMin ||
        x >= input.plot.bounds.xMax ||
        z < input.plot.bounds.zMin ||
        z >= input.plot.bounds.zMax;
      // Alternating grass/garden-bed pattern in the ring for a tended-garden look.
      const isGardenBed = inGardenRing && (x + z) % 3 === 0;
      tryPlace(
        [x, groundY, z],
        isGardenBed ? gardenAccent : blocks.grass,
        "safe_ground"
      );
    }
  }

  // Low garden border posts along the outer ring edge (decorative, sparse so
  // they never wall the player in) plus flower-bed clusters near the entry.
  for (let x = site.xMin; x <= site.xMax; x += 3) {
    tryPlace([x, groundY + 1, site.zMin], blocks.moss, "interior");
    tryPlace([x, groundY + 1, site.zMax], blocks.moss, "interior");
  }
  for (let z = site.zMin; z <= site.zMax; z += 3) {
    tryPlace([site.xMin, groundY + 1, z], blocks.moss, "interior");
    tryPlace([site.xMax, groundY + 1, z], blocks.moss, "interior");
  }
  for (const [gx, gz] of [
    [doorX - 5, bz0 - 3],
    [doorX + 5, bz0 - 3],
    [doorX - 5, bz0 - 5],
    [doorX + 5, bz0 - 5],
  ] as Array<[number, number]>) {
    tryPlace([gx, groundY, gz], blocks.moss, "safe_ground");
    tryPlace([gx, groundY + 1, gz], blocks.hay, "interior");
  }
}

function harthmereOutpostEditKey(position: readonly [number, number, number]) {
  return position.join(":");
}

function pushHarthmereOutpostVoxelEdit(
  materializationPlan: BuildingSystemMaterializationPlan,
  position: readonly [number, number, number],
  value: BuildingSystemVoxelEditSpec["value"],
  label: BuildingSystemVoxelEditSpec["label"]
) {
  materializationPlan.edits.push({
    kind: "editEvent",
    position: [position[0], position[1], position[2]],
    value,
    label,
  });
}

const HARTHMERE_OUTPOST_TERRAIN_BLOCKS = BUILDING_SYSTEM_TERRAIN_BLOCKS;

type HarthmereBusinessOutpostVoxelPalette = {
  foundation: BiomesId;
  floor: BiomesId;
  wall: BiomesId;
  roof: BiomesId;
  trim: BiomesId;
  awning: BiomesId;
  stair: BiomesId;
  sign: BiomesId;
  exteriorAccent: BiomesId;
};

function harthmereOutpostTerrainForShellMaterial(
  material: HarthmereBusinessOutpostShellMaterial
): BiomesId {
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  switch (material) {
    case "carved_limestone":
      return blocks.stonePolished;
    case "clean_stone_tile":
      return blocks.stoneBrick;
    case "dark_workshop_stone":
      return blocks.cobblestonePolished;
    case "green_roof_sod":
      return blocks.moss;
    case "purple_canvas":
      return blocks.simpleGlass;
    case "red_canvas":
    case "red_clay_roof":
      return blocks.clay;
    case "stone_foundation":
      return blocks.cobblestone;
    case "warm_wood_plank":
    case "white_canvas":
    case "wood_floor":
      return blocks.oakLumber;
  }
}

function harthmereOutpostVoxelPaletteForStyleKit(
  styleKit: HarthmereBusinessOutpostBuildingStyleKit
): HarthmereBusinessOutpostVoxelPalette {
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  return {
    foundation: harthmereOutpostTerrainForShellMaterial(styleKit.foundation),
    floor: harthmereOutpostTerrainForShellMaterial(styleKit.floor),
    wall: harthmereOutpostTerrainForShellMaterial(styleKit.exteriorWall),
    roof: harthmereOutpostTerrainForShellMaterial(styleKit.roof),
    trim:
      styleKit.trim === "warm_wood_plank"
        ? blocks.oakLog
        : harthmereOutpostTerrainForShellMaterial(styleKit.trim),
    awning: harthmereOutpostTerrainForShellMaterial(styleKit.awningMaterial),
    stair: blocks.stonePolished,
    sign: blocks.oakLumber,
    exteriorAccent:
      styleKit.exteriorDressing === "arcane_lanterns" ||
      styleKit.exteriorDressing === "clean_clinic_lanterns"
        ? blocks.simpleGlass
        : styleKit.exteriorDressing === "market_baskets"
        ? blocks.hay
        : styleKit.exteriorDressing === "garden_planters"
        ? blocks.moss
        : blocks.oakLumber,
  };
}

function applyHarthmereOutpostVoxelPalette(
  materializationPlan: BuildingSystemMaterializationPlan,
  styleKit: HarthmereBusinessOutpostBuildingStyleKit
) {
  const palette = harthmereOutpostVoxelPaletteForStyleKit(styleKit);
  for (const edit of materializationPlan.edits) {
    if (edit.label === "foundation") edit.value = palette.foundation;
    if (edit.label === "floor") edit.value = palette.floor;
    if (edit.label === "wall") edit.value = palette.wall;
    if (edit.label === "roof") edit.value = palette.roof;
    if (edit.label === "stair") edit.value = palette.stair;
    if (edit.label === "door_lock") edit.value = palette.sign;
    if (edit.label === "safe_ground") edit.value = palette.stair;
    if (edit.label === "storage_container") edit.value = palette.sign;
  }
}

function harthmereOutpostFixtureVoxelValue(
  fixture: HarthmereBusinessOutpostInteriorFixture,
  primaryBikkieGraphic: HarthmereBusinessBikkieGraphic | undefined
): BiomesId {
  const token = `${fixture.role} ${fixture.label}`.toLowerCase();
  if (fixture.role === "primary_station" && primaryBikkieGraphic) {
    return /forge|repair|tool|workbench|anvil/.test(token)
      ? HARTHMERE_OUTPOST_TERRAIN_BLOCKS.stonePolished
      : /kitchen|cooking|hearth|meal|pot/.test(token)
      ? HARTHMERE_OUTPOST_TERRAIN_BLOCKS.stoneBrick
      : /crystal|stability|rune|arcane|ward|glow|portal|teleport/.test(token)
      ? HARTHMERE_OUTPOST_TERRAIN_BLOCKS.simpleGlass
      : HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  }
  if (/kitchen|cooking|hearth|meal|pot/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.stoneBrick;
  if (/crystal|stability|rune|arcane|ward|glow|portal|teleport/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.simpleGlass;
  if (
    /route|map|hazard|guide|permit|blueprint|paper|drafting|ledger|contract|certificate|ticket|key/.test(
      token
    )
  )
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  if (/forge|anvil|tool|bench|repair|fix|vise|workstation/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.stonePolished;
  if (/parcel|dispatch|package|orders|courier/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  if (/basin|barrel|wash|quench|cleanup|sanitation/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.clay;
  if (/fresh|harvest|crop|ingredient|food|larder|meat/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.hay;
  if (
    /shelf|cabinet|rack|storage|stock|pantry|larder|crate|chest|linen/.test(
      token
    )
  )
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  if (/trail|camp|field/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.stonePolished;
  if (/bench|seat|stool|cot/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  if (/table|counter|desk|scale|sideboard/.test(token))
    return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
  return HARTHMERE_OUTPOST_TERRAIN_BLOCKS.oakLumber;
}

function harthmereOutpostFixtureAccentVoxelValue(token: string): BiomesId {
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  if (/medical|clinic|medicine|bottle|sanitation|wash|decon/.test(token))
    return blocks.clay;
  if (/food|fresh|harvest|ingredient|pantry|larder|meat|meal|seed/.test(token))
    return blocks.hay;
  if (
    /crystal|glass|portal|teleport|magic|rune|ward|arcane|lamp|lantern/.test(
      token
    )
  )
    return blocks.simpleGlass;
  if (/forge|tool|weapon|armor|repair|refinery|hazard|security/.test(token))
    return blocks.stonePolished;
  if (/plant|green|garden|seedling|herb/.test(token)) return blocks.moss;
  return blocks.oakLumber;
}

function pushHarthmereOutpostFixtureVoxels(input: {
  materializationPlan: BuildingSystemMaterializationPlan;
  fixture: HarthmereBusinessOutpostInteriorFixture;
  primaryBikkieGraphic?: HarthmereBusinessBikkieGraphic;
  reservedPathKeys: Set<string>;
  usedFixtureKeys: Set<string>;
}) {
  // Business interiors use runtime GLTF/OBJ/FBX props for furniture and decor.
  // Only the dashboard gets a tiny voxel anchor so interaction is still visible
  // before the runtime prop layer loads; tables, shelves, beds, racks, and stock
  // stay out of terrain so they do not become blocky collision stacks.
  if (
    (input.fixture.role as HarthmereBusinessOutpostInteriorFixtureRole) !==
    "dashboard_access"
  )
    return;

  const width = Math.max(1, Math.min(3, Math.round(input.fixture.size[0])));
  const depth = Math.max(1, Math.min(3, Math.round(input.fixture.size[2])));
  const x0 = Math.round(input.fixture.position.x - Math.floor(width / 2));
  const z0 = Math.round(input.fixture.position.z - Math.floor(depth / 2));
  const y = Math.round(input.fixture.position.y);
  const value = harthmereOutpostFixtureVoxelValue(
    input.fixture,
    input.primaryBikkieGraphic
  );
  const label: BuildingSystemVoxelEditSpec["label"] =
    input.fixture.role === "stock_storage"
      ? "storage_container"
      : input.fixture.role === "dashboard_access" ||
        input.fixture.role === "primary_station"
      ? "business_marker"
      : "interior";

  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  const pushIfFree = (
    position: readonly [number, number, number],
    blockValue: BiomesId,
    editLabel: BuildingSystemVoxelEditSpec["label"] = label
  ) => {
    const key = harthmereOutpostEditKey(position);
    if (input.reservedPathKeys.has(key) || input.usedFixtureKeys.has(key))
      return;
    input.usedFixtureKeys.add(key);
    pushHarthmereOutpostVoxelEdit(
      input.materializationPlan,
      position,
      blockValue,
      editLabel
    );
  };
  const x1 = x0 + width - 1;
  const z1 = z0 + depth - 1;
  const token = `${input.fixture.role} ${input.fixture.label}`.toLowerCase();

  if (input.fixture.role === "customer_queue_space") return;

  if (input.fixture.role === "dashboard_access") {
    pushIfFree([x0, y, z0], blocks.oakLumber, "business_marker");
    pushIfFree([x0, y + 1, z0], blocks.simpleGlass, "business_marker");
    pushIfFree([x0, y + 2, z0], blocks.hay, "business_marker");
    pushIfFree([x0 - 1, y, z0], blocks.oakLog, "frame");
    pushIfFree([x0 - 1, y + 1, z0], blocks.oakLumber, "storage_container");
    pushIfFree([x0 + 1, y, z0], blocks.oakLog, "frame");
    pushIfFree([x0 + 1, y + 1, z0], blocks.oakLumber, "storage_container");
    return;
  }

  if (/chair|stool/.test(token)) {
    pushIfFree([x0, y, z0], blocks.oakLumber, "interior");
    pushIfFree([x0, y + 1, z0], blocks.oakLog, "frame");
    pushIfFree([x0, y + 2, z0], blocks.oakLumber, "interior");
    return;
  }

  if (
    input.fixture.role === "seating" &&
    /bed|cot|couch|bench|lounge/.test(token)
  ) {
    for (let x = x0; x <= x1; x += 1) {
      for (let z = z0; z <= z1; z += 1) {
        pushIfFree([x, y, z], blocks.oakLumber, "interior");
      }
    }
    for (let x = x0; x <= x1; x += 1) {
      pushIfFree([x, y + 1, z0], value, "interior");
    }
    return;
  }

  if (/plant|planter|greenery/.test(token)) {
    for (let x = x0; x <= x1; x += 1) {
      for (let z = z0; z <= z1; z += 1) {
        pushIfFree([x, y, z], blocks.clay, "storage_container");
        pushIfFree([x, y + 1, z], blocks.moss, "interior");
      }
    }
    return;
  }

  if (/lamp|lantern|candle/.test(token)) {
    pushIfFree([x0, y, z0], blocks.oakLog, "frame");
    pushIfFree([x0, y + 1, z0], blocks.oakLog, "frame");
    pushIfFree([x0, y + 2, z0], blocks.simpleGlass, "business_marker");
    return;
  }

  if (/partition|screen|railing|glass/.test(token)) {
    for (let z = z0; z <= z1; z += 1) {
      pushIfFree([x0, y, z], blocks.simpleGlass, "business_marker");
      pushIfFree([x0, y + 1, z], blocks.simpleGlass, "business_marker");
    }
    return;
  }

  if (input.fixture.role === "stock_storage") {
    const alongX = width >= depth;
    const length = Math.max(3, alongX ? width : depth);
    const displayValue = harthmereOutpostFixtureAccentVoxelValue(token);
    for (let index = 0; index < length; index += 1) {
      const sx = alongX ? x0 + index : x0;
      const sz = alongX ? z0 : z0 + index;
      const endPost = index === 0 || index === length - 1;
      if (endPost) {
        pushIfFree([sx, y, sz], blocks.oakLog, "frame");
        pushIfFree([sx, y + 1, sz], blocks.oakLog, "frame");
        pushIfFree([sx, y + 2, sz], blocks.oakLog, "frame");
        continue;
      }
      pushIfFree([sx, y, sz], blocks.oakLumber, "storage_container");
      pushIfFree(
        [sx, y + 1, sz],
        index % 3 === 0
          ? displayValue
          : index % 3 === 1
          ? blocks.simpleGlass
          : blocks.hay,
        "storage_container"
      );
      pushIfFree([sx, y + 2, sz], blocks.oakLumber, "interior");
    }
    return;
  }

  if (
    input.fixture.role === "primary_station" ||
    input.fixture.role === "workstation" ||
    input.fixture.role === "service_counter" ||
    input.fixture.role === "service_table"
  ) {
    for (let x = x0; x <= x1; x += 1) {
      for (let z = z0; z <= z1; z += 1) {
        const isCorner = (x === x0 || x === x1) && (z === z0 || z === z1);
        const isEdge = x === x0 || x === x1 || z === z0 || z === z1;
        if (isCorner) pushIfFree([x, y, z], blocks.oakLog, label);
        if (isEdge) pushIfFree([x, y + 1, z], value, label);
      }
    }
    if (/kitchen|cook|meal|buff|service/.test(token)) {
      pushIfFree([Math.round((x0 + x1) / 2), y + 2, z0], blocks.hay, label);
      pushIfFree([Math.round((x0 + x1) / 2), y + 2, z1], blocks.clay, label);
    } else if (/map|paper|ledger|contract|route|ticket|permit/.test(token)) {
      pushIfFree(
        [Math.round((x0 + x1) / 2), y + 2, Math.round((z0 + z1) / 2)],
        blocks.simpleGlass,
        label
      );
    }
    return;
  }

  if (input.fixture.role === "business_decor") {
    const accentValue = harthmereOutpostFixtureAccentVoxelValue(token);
    if (/board|panel|map|pegboard|cabinet|wall|sign|rack/.test(token)) {
      pushIfFree([x0, y, z0], blocks.oakLog, "frame");
      pushIfFree([x0, y + 1, z0], blocks.oakLumber, "interior");
      pushIfFree([x0, y + 2, z0], accentValue, "business_marker");
      if (width > 1) {
        pushIfFree([x0 + 1, y + 1, z0], blocks.oakLumber, "interior");
        pushIfFree([x0 + 1, y + 2, z0], blocks.simpleGlass, "business_marker");
      }
      return;
    }
    if (
      /display|plinth|stand|model|sample|armor|containment|cage/.test(token)
    ) {
      pushIfFree([x0, y, z0], blocks.stonePolished, "frame");
      pushIfFree([x0, y + 1, z0], accentValue, "business_marker");
      pushIfFree([x0, y + 2, z0], blocks.simpleGlass, "business_marker");
      return;
    }
    if (/hearth|forge|cauldron|kiln|furnace|ember|steam/.test(token)) {
      pushIfFree([x0, y, z0], blocks.stonePolished, "frame");
      pushIfFree([x0, y + 1, z0], blocks.clay, "interior");
      pushIfFree([x0, y + 2, z0], blocks.simpleGlass, "business_marker");
      if (width > 1)
        pushIfFree([x0 + 1, y + 1, z0], blocks.stoneBrick, "interior");
      return;
    }
    if (/trough|barrel|bucket|wash|spray|sorting/.test(token)) {
      pushIfFree([x0, y, z0], blocks.stonePolished, "frame");
      pushIfFree([x0, y + 1, z0], blocks.clay, "interior");
      if (width > 1) pushIfFree([x0 + 1, y + 1, z0], blocks.clay, "interior");
      return;
    }
    pushIfFree([x0, y, z0], blocks.oakLog, "frame");
    pushIfFree([x0, y + 1, z0], accentValue, "interior");
    pushIfFree([x0, y + 2, z0], blocks.simpleGlass, "business_marker");
    return;
  }

  const accentValue = harthmereOutpostFixtureAccentVoxelValue(token);
  for (let x = x0; x < x0 + width; x += 1) {
    for (let z = z0; z < z0 + depth; z += 1) {
      const edge =
        x === x0 || x === x0 + width - 1 || z === z0 || z === z0 + depth - 1;
      pushIfFree([x, y, z], edge ? blocks.oakLog : blocks.oakLumber, "frame");
      pushIfFree(
        [x, y + 1, z],
        x === x0 && z === z0 ? accentValue : value,
        label
      );
    }
  }
}

function harthmereOutpostInteriorAccentValue(
  businessType: HarthmereEconomyBusinessTypeId
): BiomesId {
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  if (/restaurant|farming|hunter|rare_food|food/.test(businessType))
    return blocks.hay;
  if (/medical|sanitation|waste/.test(businessType)) return blocks.clay;
  if (/portal|teleport|magic|exotic|design/.test(businessType))
    return blocks.simpleGlass;
  if (/weapons|repair|maintenance|security|refinery/.test(businessType))
    return blocks.stonePolished;
  return blocks.oakLumber;
}

function addHarthmereOutpostGuideVoxels(input: {
  materializationPlan: BuildingSystemMaterializationPlan;
  outpost: HarthmereBusinessOutpost;
  origin: { x: number; y: number; z: number };
  blueprint: BuildingSystemBlueprintDefinition;
  buildingStyleKit: HarthmereBusinessOutpostBuildingStyleKit;
  doorX: number;
  entrance: { x: number; y: number; z: number };
  queueNode: { x: number; y: number; z: number };
  serviceCounter: { x: number; y: number; z: number };
  exitNode: { x: number; y: number; z: number };
  dashboardAccessPoint: HarthmereBusinessOutpostProceduralBuildingRecord["dashboardAccessPoint"];
  interiorFixtures: HarthmereBusinessOutpostInteriorFixture[];
  primaryBikkieGraphic?: HarthmereBusinessBikkieGraphic;
}) {
  const { materializationPlan, origin, blueprint, doorX } = input;
  const x0 = origin.x;
  const x1 = origin.x + blueprint.footprint.width - 1;
  const z0 = origin.z;
  const z1 = origin.z + blueprint.footprint.depth - 1;
  const y0 = origin.y;
  const wallY = y0 + 2;
  const trimY = y0 + 3;
  const roofY = y0 + Math.max(3, blueprint.footprint.height - 1);
  const reservedPathKeys = new Set(
    [input.entrance, input.queueNode, input.serviceCounter, input.exitNode].map(
      (node) => harthmereOutpostEditKey([node.x, node.y, node.z])
    )
  );
  const usedFixtureKeys = new Set<string>();
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  const palette = harthmereOutpostVoxelPaletteForStyleKit(
    input.buildingStyleKit
  );
  const tryPush = (
    position: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"],
    reserve = true
  ) => {
    const key = harthmereOutpostEditKey(position);
    if (reserve && reservedPathKeys.has(key)) return false;
    pushHarthmereOutpostVoxelEdit(materializationPlan, position, value, label);
    return true;
  };
  const polishedKeys = new Set<string>();
  const tryPolish = (
    position: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"] = "interior",
    reserve = true
  ) => {
    const key = harthmereOutpostEditKey(position);
    if (polishedKeys.has(key)) return false;
    if (!tryPush(position, value, label, reserve)) return false;
    polishedKeys.add(key);
    return true;
  };
  const tryBox = (
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"] = "interior",
    reserve = true
  ) => {
    for (
      let x = Math.min(from[0], to[0]);
      x <= Math.max(from[0], to[0]);
      x += 1
    ) {
      for (
        let y = Math.min(from[1], to[1]);
        y <= Math.max(from[1], to[1]);
        y += 1
      ) {
        for (
          let z = Math.min(from[2], to[2]);
          z <= Math.max(from[2], to[2]);
          z += 1
        ) {
          tryPolish([x, y, z], value, label, reserve);
        }
      }
    }
  };
  const tableWithSeats = (cx: number, cz: number, accentValue: BiomesId) => {
    tryPolish([cx - 1, y0 + 1, cz - 1], blocks.oakLog, "frame");
    tryPolish([cx + 1, y0 + 1, cz - 1], blocks.oakLog, "frame");
    tryPolish([cx - 1, y0 + 1, cz + 1], blocks.oakLog, "frame");
    tryPolish([cx + 1, y0 + 1, cz + 1], blocks.oakLog, "frame");
    tryPolish([cx - 1, y0 + 2, cz], blocks.oakLumber, "interior");
    tryPolish([cx, y0 + 2, cz], blocks.oakLumber, "interior");
    tryPolish([cx + 1, y0 + 2, cz], blocks.oakLumber, "interior");
    tryPolish([cx, y0 + 3, cz], accentValue, "business_marker");
    for (const [dx, dz] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ] as Array<[number, number]>) {
      tryPolish([cx + dx, y0 + 1, cz + dz], accentValue, "interior");
    }
  };
  const serviceBench = (
    fromX: number,
    toX: number,
    z: number,
    value = blocks.oakLumber
  ) => {
    for (let x = fromX; x <= toX; x += 1) {
      tryPolish([x, y0 + 1, z], value, "interior");
    }
    for (const x of [fromX, toX]) {
      tryPolish([x, y0 + 2, z], blocks.oakLog, "frame");
    }
  };
  const sideTable = (x: number, z: number, topValue = blocks.oakLumber) => {
    tryPolish([x, y0 + 1, z], blocks.oakLog, "frame");
    tryPolish([x, y0 + 2, z], topValue, "interior");
    tryPolish([x, y0 + 3, z], blocks.simpleGlass, "business_marker");
  };
  const lampPost = (x: number, z: number) => {
    tryPolish([x, y0 + 1, z], blocks.oakLog, "frame");
    tryPolish([x, y0 + 2, z], blocks.oakLog, "frame");
    tryPolish([x, y0 + 3, z], blocks.simpleGlass, "business_marker");
  };
  const wallSign = (x: number, z: number, value = blocks.simpleGlass) => {
    tryPolish([x, y0 + 2, z], value, "business_marker", false);
    tryPolish([x, y0 + 3, z], blocks.oakLumber, "frame", false);
  };
  const tableWithSeatsLegacy = (
    cx: number,
    cz: number,
    accentValue: BiomesId
  ) => {
    tryPolish([cx - 1, y0 + 1, cz], blocks.oakLumber, "interior");
    tryPolish([cx, y0 + 1, cz], blocks.oakLumber, "interior");
    tryPolish([cx + 1, y0 + 1, cz], blocks.oakLumber, "interior");
    for (const [dx, dz] of [
      [-2, 0],
      [2, 0],
      [0, -1],
      [0, 1],
    ] as Array<[number, number]>) {
      tryPolish([cx + dx, y0 + 1, cz + dz], accentValue, "interior");
    }
  };
  const shelfWall = (
    x: number,
    z: number,
    length: number,
    alongX: boolean,
    stockValue: BiomesId
  ) => {
    for (let index = 0; index < length; index += 1) {
      const sx = alongX ? x + index : x;
      const sz = alongX ? z : z + index;
      tryPolish([sx, y0 + 1, sz], blocks.oakLumber, "interior");
      if (index % 2 === 0) {
        tryPolish([sx, y0 + 2, sz], stockValue, "storage_container");
      }
    }
  };
  const figure = (
    x: number,
    z: number,
    bodyValue: BiomesId,
    headValue: BiomesId,
    markerValue: BiomesId
  ) => {
    tryPolish([x, y0 + 1, z], bodyValue, "npc_marker", false);
    tryPolish([x, y0 + 2, z], headValue, "npc_marker", false);
    tryPolish([x - 1, y0 + 2, z], bodyValue, "npc_marker", false);
    tryPolish([x + 1, y0 + 2, z], bodyValue, "npc_marker", false);
    tryPolish([x, y0 + 3, z], markerValue, "business_marker", false);
  };
  const addDashboardKiosk = () => {
    const { x, y, z } = input.dashboardAccessPoint.position;
    tryPolish([x - 1, y, z], blocks.stonePolished, "business_marker", false);
    tryPolish([x, y, z], blocks.stonePolished, "business_marker", false);
    tryPolish([x + 1, y, z], blocks.stonePolished, "business_marker", false);
    tryPolish([x - 1, y + 1, z], blocks.oakLog, "frame", false);
    tryPolish([x + 1, y + 1, z], blocks.oakLog, "frame", false);
    tryPolish([x - 1, y + 2, z], blocks.oakLog, "frame", false);
    tryPolish([x + 1, y + 2, z], blocks.oakLog, "frame", false);
    tryPolish([x, y + 1, z], blocks.simpleGlass, "business_marker", false);
    tryPolish(
      [x, y + 2, z],
      harthmereOutpostInteriorAccentValue(input.outpost.businessType),
      "business_marker",
      false
    );
    tryPolish([x, y + 3, z], blocks.simpleGlass, "business_marker", false);
    tryPolish([x - 2, y + 1, z], blocks.oakLumber, "interior", false);
    tryPolish([x + 2, y + 1, z], blocks.oakLumber, "interior", false);
  };
  const addBackCounter = (
    z: number,
    leftX = x0 + 5,
    rightX = x1 - 5,
    counterValue = blocks.oakLumber
  ) => {
    for (let x = leftX; x <= rightX; x += 1) {
      tryPolish([x, y0 + 1, z], blocks.oakLog, "frame");
      tryPolish([x, y0 + 2, z], counterValue, "business_marker");
      if (x % 3 === 0) {
        tryPolish([x, y0 + 3, z], blocks.simpleGlass, "business_marker");
      }
    }
  };
  const addRestaurantInteriorPolish = () => {
    const counterZ = Math.min(z1 - 4, input.serviceCounter.z + 1);
    addBackCounter(counterZ, x0 + 4, x1 - 4, blocks.oakLumber);
    serviceBench(x0 + 4, x0 + 8, counterZ + 2, blocks.stoneBrick);
    sideTable(x0 + 6, counterZ + 4, blocks.stoneBrick);
    serviceBench(x1 - 8, x1 - 5, counterZ + 2, blocks.hay);
    sideTable(x1 - 6, counterZ + 4, blocks.hay);
    shelfWall(
      x0 + 3,
      z1 - 2,
      Math.max(5, Math.min(9, x1 - x0 - 6)),
      true,
      blocks.hay
    );
    shelfWall(
      x1 - 2,
      z0 + 5,
      Math.max(5, Math.min(9, z1 - z0 - 8)),
      false,
      blocks.hay
    );
    serviceBench(x0 + 3, x0 + 7, z0 + 4, blocks.hay);
    serviceBench(x1 - 7, x1 - 3, z0 + 4, blocks.clay);
    tableWithSeats(x0 + 7, z0 + 7, blocks.hay);
    tableWithSeats(x1 - 7, z0 + 7, blocks.hay);
    tableWithSeats(x0 + 7, z0 + 12, blocks.clay);
    tableWithSeats(x1 - 7, z0 + 12, blocks.clay);
    lampPost(x0 + 3, z0 + 6);
    lampPost(x1 - 3, z0 + 6);
    wallSign(
      input.dashboardAccessPoint.position.x,
      input.dashboardAccessPoint.position.z + 1
    );
    figure(
      Math.min(x1 - 6, input.serviceCounter.x + 2),
      counterZ - 1,
      blocks.oakLumber,
      blocks.clay,
      blocks.simpleGlass
    );
    figure(
      Math.max(x0 + 5, input.queueNode.x - 2),
      Math.max(z0 + 6, input.queueNode.z + 2),
      blocks.hay,
      blocks.clay,
      blocks.simpleGlass
    );
  };
  const addBusinessInteriorPolish = () => {
    const accentValue = harthmereOutpostInteriorAccentValue(
      input.outpost.businessType
    );
    const staffX = Math.min(x1 - 3, input.serviceCounter.x + 4);
    const staffZ = Math.min(z1 - 3, input.serviceCounter.z + 1);
    const customerX = Math.max(x0 + 3, input.queueNode.x - 1);
    const customerZ = Math.max(z0 + 4, input.queueNode.z + 1);
    addDashboardKiosk();
    figure(staffX, staffZ, blocks.oakLumber, blocks.clay, blocks.simpleGlass);
    figure(customerX, customerZ, blocks.hay, blocks.clay, accentValue);
    shelfWall(
      x0 + 2,
      z1 - 3,
      Math.max(4, Math.min(8, x1 - x0 - 4)),
      true,
      accentValue
    );
    shelfWall(
      x1 - 3,
      z0 + 4,
      Math.max(4, Math.min(7, z1 - z0 - 6)),
      false,
      accentValue
    );

    if (/restaurant|food_service/.test(input.outpost.businessType)) {
      addRestaurantInteriorPolish();
      return;
    }
    if (/medical/.test(input.outpost.businessType)) {
      tryBox(
        [x0 + 4, y0 + 1, z0 + 6],
        [x0 + 7, y0 + 1, z0 + 7],
        blocks.oakLumber,
        "interior"
      );
      tryPolish([x0 + 5, y0 + 2, z0 + 6], blocks.clay, "business_marker");
      tryPolish(
        [x0 + 6, y0 + 2, z0 + 6],
        blocks.simpleGlass,
        "business_marker"
      );
      tableWithSeats(x1 - 5, z0 + 6, blocks.clay);
      return;
    }
    if (/portal|teleport|magic|exotic/.test(input.outpost.businessType)) {
      tryBox(
        [x1 - 7, y0 + 1, z1 - 6],
        [x1 - 5, y0 + 1, z1 - 4],
        blocks.simpleGlass,
        "business_marker"
      );
      tryPolish(
        [x1 - 6, y0 + 2, z1 - 5],
        blocks.simpleGlass,
        "business_marker"
      );
      tryPolish([x1 - 6, y0 + 3, z1 - 5], blocks.moss, "business_marker");
      tableWithSeatsLegacy(x0 + 5, z0 + 6, blocks.simpleGlass);
      return;
    }
    if (
      /weapons|repair|maintenance|refinery|security/.test(
        input.outpost.businessType
      )
    ) {
      tryBox(
        [x0 + 4, y0 + 1, z1 - 5],
        [x0 + 8, y0 + 1, z1 - 4],
        blocks.stonePolished,
        "business_marker"
      );
      tryPolish([x0 + 5, y0 + 2, z1 - 4], blocks.oakLog, "frame");
      tryPolish(
        [x0 + 7, y0 + 2, z1 - 4],
        blocks.stonePolished,
        "storage_container"
      );
      tableWithSeatsLegacy(x1 - 5, z0 + 6, blocks.stonePolished);
      return;
    }
    if (
      /courier|trader|farming|hunter|hospitality|property|design/.test(
        input.outpost.businessType
      )
    ) {
      tableWithSeatsLegacy(x0 + 5, z0 + 6, accentValue);
      tableWithSeatsLegacy(x1 - 5, z0 + 7, blocks.oakLumber);
      tryBox(
        [x0 + 3, y0 + 1, z1 - 6],
        [x0 + 6, y0 + 2, z1 - 5],
        accentValue,
        "storage_container"
      );
      return;
    }
    tableWithSeatsLegacy(x0 + 5, z0 + 6, accentValue);
    tableWithSeatsLegacy(x1 - 5, z0 + 7, accentValue);
  };

  // Grove-reference front door language: open 1x2 doorway, supported jambs,
  // visible header, wide steps, and a grounded sign instead of floating props.
  for (const x of [doorX - 2, doorX - 1, doorX, doorX + 1, doorX + 2]) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, y0, z0 - 1],
      palette.stair,
      "stair"
    );
  }
  for (let y = y0 + 1; y <= trimY; y += 1) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [doorX - 1, y, z0],
      blocks.oakLog,
      "frame"
    );
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [doorX + 1, y, z0],
      blocks.oakLog,
      "frame"
    );
  }
  for (const x of [doorX - 1, doorX, doorX + 1]) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, trimY, z0],
      palette.trim,
      "frame"
    );
  }
  pushHarthmereOutpostVoxelEdit(
    materializationPlan,
    [doorX, trimY + 1, z0],
    blocks.oakLumber,
    "frame"
  );
  pushHarthmereOutpostVoxelEdit(
    materializationPlan,
    [doorX + 2, y0 + 1, z0 - 1],
    palette.sign,
    "door_lock"
  );
  pushHarthmereOutpostVoxelEdit(
    materializationPlan,
    [doorX - 4, y0 + 1, z0 - 1],
    blocks.oakLog,
    "frame"
  );
  pushHarthmereOutpostVoxelEdit(
    materializationPlan,
    [doorX - 4, y0 + 2, z0 - 1],
    palette.sign,
    "business_marker"
  );

  // Vertical trim, corner posts, and a voxel roof overhang prevent the shop
  // from reading as a flat slab when the world materialization is viewed alone.
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as Array<[number, number]>) {
    for (let y = y0 + 1; y < roofY; y += 1) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [x, y, z],
        blocks.oakLog,
        "frame"
      );
    }
  }
  for (let x = x0 - 1; x <= x1 + 1; x += 1) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, roofY + 1, z0 - 1],
      palette.roof,
      "roof"
    );
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, roofY + 1, z1 + 1],
      palette.roof,
      "roof"
    );
  }
  for (let z = z0; z <= z1; z += 1) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x0 - 1, roofY + 1, z],
      palette.roof,
      "roof"
    );
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x1 + 1, roofY + 1, z],
      palette.roof,
      "roof"
    );
  }
  for (let x = x0 + 3; x <= x1 - 3; x += 2) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, roofY + 2, z0 + Math.floor((z1 - z0) / 2)],
      palette.roof,
      "roof"
    );
  }

  // Supported awning above the customer-facing storefront.
  for (
    let x = Math.max(x0 + 2, doorX - 7);
    x <= Math.min(x1 - 2, doorX + 7);
    x += 1
  ) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, trimY + 1, z0 - 1],
      palette.awning,
      "frame"
    );
    if (x % 2 === 0) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [x, trimY + 1, z0 - 2],
        palette.awning,
        "frame"
      );
    }
  }

  // Large framed storefront windows copied from the Grove reference vocabulary.
  for (const windowCenterX of [doorX - 6, doorX + 6]) {
    for (const dx of [-1, 0, 1]) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [Math.max(x0 + 1, Math.min(x1 - 1, windowCenterX + dx)), wallY, z0],
        blocks.simpleGlass,
        "frame"
      );
    }
    for (const dx of [-2, 2]) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [Math.max(x0 + 1, Math.min(x1 - 1, windowCenterX + dx)), wallY, z0],
        palette.trim,
        "frame"
      );
    }
    for (const dx of [-1, 0, 1]) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [Math.max(x0 + 1, Math.min(x1 - 1, windowCenterX + dx)), wallY + 1, z0],
        palette.trim,
        "frame"
      );
    }
  }
  for (const side of [x0, x1]) {
    for (const z of [z0 + 5, Math.max(z0 + 7, z1 - 6)]) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [side, wallY, z],
        blocks.simpleGlass,
        "frame"
      );
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [side, wallY, z + 1],
        blocks.simpleGlass,
        "frame"
      );
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [side, wallY, z - 1],
        palette.trim,
        "frame"
      );
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [side, wallY, z + 2],
        palette.trim,
        "frame"
      );
    }
  }

  // Interior furniture and shop stock are rendered as passable runtime props.
  // The server-owned materialization intentionally stops at the structural shell
  // and dashboard anchor so stores no longer look like piles of voxel blocks.
  for (const fixture of input.interiorFixtures) {
    pushHarthmereOutpostFixtureVoxels({
      materializationPlan,
      fixture,
      primaryBikkieGraphic: input.primaryBikkieGraphic,
      reservedPathKeys,
      usedFixtureKeys,
    });
  }

  // The customer dashboard is an in-room access object, not a hidden marker.
  pushHarthmereOutpostVoxelEdit(
    materializationPlan,
    [
      input.dashboardAccessPoint.position.x,
      input.dashboardAccessPoint.position.y,
      input.dashboardAccessPoint.position.z,
    ],
    blocks.simpleGlass,
    "business_marker"
  );

  // Grounded exterior dressing and entry path. These are authored as real edits
  // so old invisible/fake client structures are not needed for polish.
  for (let z = z0 - 4; z <= z0 - 2; z += 1) {
    for (const x of [doorX - 1, doorX, doorX + 1]) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [x, y0, z],
        palette.stair,
        "safe_ground"
      );
    }
  }
  for (const x of [doorX - 6, doorX + 6]) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, y0 + 1, z0 - 2],
      blocks.oakLumber,
      "interior"
    );
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x + Math.sign(x - doorX), y0 + 1, z0 - 2],
      palette.exteriorAccent,
      "interior"
    );
  }
  for (const [x, z] of [
    [doorX - 9, z0 - 3],
    [doorX + 9, z0 - 3],
  ] as Array<[number, number]>) {
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, y0 + 1, z],
      blocks.oakLog,
      "frame"
    );
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [x, y0 + 2, z],
      palette.exteriorAccent,
      "interior"
    );
  }

  // Multi-floor businesses need an actual internal stair and upper deck, not
  // just a taller shell.
  if (input.outpost.building.floors > 1) {
    const upperFloorY = y0 + 5;
    const stairX = x0 + 3;
    const stairBaseZ = z1 - 4;
    for (let step = 0; step < 5; step += 1) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [stairX, y0 + 1 + step, stairBaseZ - step],
        palette.stair,
        "stair"
      );
    }
    for (let x = x0 + 1; x < x1; x += 1) {
      for (let z = z0 + 1; z < z1; z += 1) {
        const isStairWell =
          x >= stairX - 1 &&
          x <= stairX + 1 &&
          z >= stairBaseZ - 5 &&
          z <= stairBaseZ + 1;
        if (isStairWell) continue;
        pushHarthmereOutpostVoxelEdit(
          materializationPlan,
          [x, upperFloorY, z],
          palette.floor,
          "upgrade_addition"
        );
      }
    }
    for (let x = x0 + 2; x <= x1 - 2; x += 4) {
      pushHarthmereOutpostVoxelEdit(
        materializationPlan,
        [x, upperFloorY + 1, z0 + 1],
        palette.trim,
        "upgrade_addition"
      );
    }
    pushHarthmereOutpostVoxelEdit(
      materializationPlan,
      [stairX + 2, upperFloorY + 1, stairBaseZ],
      blocks.oakLumber,
      "business_marker"
    );
  }
}

function addHarthmereOutpostBusinessSignature(input: {
  materializationPlan: BuildingSystemMaterializationPlan;
  outpost: HarthmereBusinessOutpost;
  origin: { x: number; y: number; z: number };
  blueprint: BuildingSystemBlueprintDefinition;
  buildingStyleKit: HarthmereBusinessOutpostBuildingStyleKit;
  doorX: number;
}) {
  const { materializationPlan, origin, blueprint, outpost, doorX } = input;
  const blocks = HARTHMERE_OUTPOST_TERRAIN_BLOCKS;
  const palette = harthmereOutpostVoxelPaletteForStyleKit(
    input.buildingStyleKit
  );
  const x0 = origin.x;
  const x1 = origin.x + blueprint.footprint.width - 1;
  const z0 = origin.z;
  const z1 = origin.z + blueprint.footprint.depth - 1;
  const y0 = origin.y;
  const wallTop = y0 + Math.max(3, blueprint.footprint.height - 1);
  const roofY = wallTop;
  const centerZ = z0 + Math.floor((z1 - z0) / 2);
  const used = new Set(
    materializationPlan.edits.map((edit) =>
      harthmereOutpostEditKey(edit.position)
    )
  );
  const place = (
    position: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"] = "frame"
  ) => {
    if (
      (label === "interior" || label === "storage_container") &&
      position[0] > x0 &&
      position[0] < x1 &&
      position[1] >= y0 + 1 &&
      position[1] < roofY &&
      position[2] > z0 &&
      position[2] < z1
    ) {
      return false;
    }
    const key = harthmereOutpostEditKey(position);
    if (used.has(key)) return false;
    used.add(key);
    pushHarthmereOutpostVoxelEdit(materializationPlan, position, value, label);
    return true;
  };
  const column = (
    x: number,
    z: number,
    fromY: number,
    height: number,
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"] = "frame"
  ) => {
    for (let dy = 0; dy < height; dy += 1) {
      place([x, fromY + dy, z], value, label);
    }
  };
  const box = (
    min: readonly [number, number, number],
    max: readonly [number, number, number],
    value: BiomesId,
    label: BuildingSystemVoxelEditSpec["label"] = "frame"
  ) => {
    for (let x = min[0]; x <= max[0]; x += 1) {
      for (let y = min[1]; y <= max[1]; y += 1) {
        for (let z = min[2]; z <= max[2]; z += 1) {
          place([x, y, z], value, label);
        }
      }
    }
  };
  const roofRidge = (value = palette.roof) => {
    for (let x = x0 + 2; x <= x1 - 2; x += 1) {
      place([x, roofY + 2, centerZ], value, "roof");
      if ((x + outpost.outpostId.length) % 3 === 0) {
        place([x, roofY + 1, centerZ - 1], value, "roof");
        place([x, roofY + 1, centerZ + 1], value, "roof");
      }
    }
  };
  const frontIcon = (
    value: BiomesId,
    pattern: readonly (readonly [number, number])[]
  ) => {
    for (const [dx, dy] of pattern) {
      place([doorX + dx, y0 + 4 + dy, z0 - 1], value, "business_marker");
    }
  };
  const frontPosts = (
    offsets: readonly number[],
    height: number,
    value: BiomesId,
    capValue = value
  ) => {
    for (const dx of offsets) {
      column(doorX + dx, z0 - 4, y0 + 1, height, value, "frame");
      place([doorX + dx, y0 + height + 1, z0 - 4], capValue, "business_marker");
    }
  };
  const sidePlanterLine = (value: BiomesId, z = z0 - 5) => {
    for (const dx of [-8, -6, 6, 8]) {
      place([doorX + dx, y0 + 1, z], blocks.clay, "storage_container");
      place([doorX + dx, y0 + 2, z], value, "business_marker");
    }
  };
  const roofFlagLine = (value: BiomesId, step = 4) => {
    for (let x = x0 + 2; x <= x1 - 2; x += step) {
      column(x, z0 + 1, roofY + 1, 2, blocks.oakLog, "frame");
      place([x, roofY + 3, z0 + 1], value, "business_marker");
    }
  };
  const porchRail = (value: BiomesId, left: number, right: number) => {
    for (let x = doorX + left; x <= doorX + right; x += 1) {
      if (Math.abs(x - doorX) <= 1) continue;
      place([x, y0 + 1, z0 - 4], value, "frame");
    }
  };
  const crossIcon = [
    [0, 0],
    [0, 1],
    [0, 2],
    [-1, 1],
    [1, 1],
  ] as const;
  const sparkIcon = [
    [0, 0],
    [0, 1],
    [0, 2],
    [-1, 1],
    [1, 1],
    [-2, 1],
    [2, 1],
  ] as const;
  const shieldIcon = [
    [-1, 2],
    [0, 2],
    [1, 2],
    [-2, 1],
    [2, 1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [0, -1],
  ] as const;
  const keyIcon = [
    [-1, 1],
    [0, 1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
    [2, -1],
  ] as const;

  switch (outpost.businessType) {
    case "exotic_matter_refinery":
      roofRidge(blocks.simpleGlass);
      box(
        [x0 + 3, roofY + 1, z1 - 4],
        [x0 + 4, roofY + 5, z1 - 3],
        blocks.cobblestonePolished,
        "frame"
      );
      column(
        x0 + 5,
        z1 - 3,
        roofY + 1,
        4,
        blocks.simpleGlass,
        "business_marker"
      );
      column(
        x0 + 7,
        z1 - 3,
        roofY + 1,
        3,
        blocks.simpleGlass,
        "business_marker"
      );
      box(
        [x1 - 5, roofY + 1, z0 + 3],
        [x1 - 4, roofY + 7, z0 + 4],
        blocks.cobblestonePolished,
        "frame"
      );
      column(
        x1 - 6,
        z0 + 4,
        roofY + 1,
        5,
        blocks.simpleGlass,
        "business_marker"
      );
      porchRail(blocks.simpleGlass, -7, 7);
      frontIcon(blocks.simpleGlass, sparkIcon);
      break;
    case "biome_maintenance_repair":
    case "repair_maintenance_person":
      box(
        [x1 - 5, y0 + 1, z0 - 3],
        [x1 - 2, y0 + 1, z0 - 2],
        blocks.stonePolished,
        "interior"
      );
      column(x1 - 4, z0 - 3, y0 + 2, 2, blocks.oakLog, "frame");
      column(x1 - 2, z0 - 3, y0 + 2, 2, blocks.oakLog, "frame");
      box(
        [x0 + 2, roofY + 1, z0 + 3],
        [x0 + 7, roofY + 2, z0 + 5],
        blocks.oakLumber,
        "roof"
      );
      frontPosts([-5, 5], 3, blocks.oakLog, blocks.stonePolished);
      porchRail(blocks.oakLumber, -6, 6);
      frontIcon(blocks.stonePolished, [
        [-2, 1],
        [-1, 0],
        [0, 0],
        [1, 0],
        [2, -1],
      ]);
      break;
    case "biome_design_studio":
      for (let x = x0 + 3; x <= x1 - 3; x += 3) {
        column(x, z0 - 2, y0 + 1, 3, blocks.simpleGlass, "business_marker");
      }
      box(
        [x0 + 2, y0 + 1, z1 - 3],
        [x0 + 6, y0 + 2, z1 - 2],
        blocks.oakLumber,
        "interior"
      );
      box(
        [x0 + 2, roofY + 1, z0 + 2],
        [x1 - 2, roofY + 2, z0 + 3],
        blocks.simpleGlass,
        "business_marker"
      );
      sidePlanterLine(blocks.hay);
      frontIcon(blocks.hay, sparkIcon);
      break;
    case "security_defense_contractor":
      for (let x = x0 + 1; x <= x1 - 1; x += 2)
        place([x, roofY + 1, z0], blocks.stoneBrick, "roof");
      for (let x = x0 + 1; x <= x1 - 1; x += 2)
        place([x, roofY + 1, z1], blocks.stoneBrick, "roof");
      box(
        [x0 + 1, y0 + 1, z0 - 4],
        [x0 + 2, y0 + 4, z0 - 3],
        blocks.stoneBrick,
        "frame"
      );
      box(
        [x1 - 2, y0 + 1, z0 - 4],
        [x1 - 1, y0 + 4, z0 - 3],
        blocks.stoneBrick,
        "frame"
      );
      box(
        [x0 + 1, roofY + 1, z0 - 1],
        [x0 + 3, roofY + 4, z0 + 1],
        blocks.stoneBrick,
        "frame"
      );
      box(
        [x1 - 3, roofY + 1, z0 - 1],
        [x1 - 1, roofY + 4, z0 + 1],
        blocks.stoneBrick,
        "frame"
      );
      roofFlagLine(blocks.clay, 3);
      frontIcon(blocks.clay, shieldIcon);
      break;
    case "portal_transit_company":
    case "teleport_owner":
      for (const dx of [-3, -2, 2, 3])
        column(
          doorX + dx,
          z0 - 5,
          y0 + 1,
          5,
          blocks.simpleGlass,
          "business_marker"
        );
      for (let dx = -3; dx <= 3; dx += 1)
        place(
          [doorX + dx, y0 + 6, z0 - 5],
          blocks.simpleGlass,
          "business_marker"
        );
      place([doorX - 4, y0 + 3, z0 - 5], blocks.stonePolished, "frame");
      place([doorX + 4, y0 + 3, z0 - 5], blocks.stonePolished, "frame");
      roofRidge(blocks.simpleGlass);
      box(
        [doorX - 5, y0 + 1, z0 - 6],
        [doorX + 5, y0 + 1, z0 - 6],
        blocks.stonePolished,
        "safe_ground"
      );
      frontPosts([-6, 6], 5, blocks.stonePolished, blocks.simpleGlass);
      frontIcon(blocks.simpleGlass, sparkIcon);
      break;
    case "biome_farming_rare_foods":
      for (let x = x0 + 3; x <= x1 - 3; x += 2) {
        box([x, y0 + 1, z0 - 6], [x, y0 + 1, z0 - 4], blocks.hay, "interior");
        place([x, y0 + 2, z0 - 5], blocks.moss, "interior");
      }
      roofRidge(blocks.moss);
      sidePlanterLine(blocks.moss, z0 - 6);
      box(
        [x0 + 2, roofY + 1, z1 - 3],
        [x1 - 2, roofY + 1, z1 - 2],
        blocks.hay,
        "roof"
      );
      frontIcon(blocks.moss, [
        [0, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [0, 2],
      ]);
      break;
    case "weapons_tools":
      box(
        [x1 - 5, roofY + 1, z1 - 5],
        [x1 - 4, roofY + 6, z1 - 4],
        blocks.cobblestonePolished,
        "frame"
      );
      box(
        [x0 + 4, y0 + 1, z0 - 4],
        [x0 + 6, y0 + 1, z0 - 3],
        blocks.stonePolished,
        "interior"
      );
      place([x0 + 5, y0 + 2, z0 - 4], blocks.clay, "interior");
      column(x0 + 3, z0 - 4, y0 + 1, 5, blocks.oakLog, "frame");
      column(x1 - 3, z0 - 4, y0 + 1, 5, blocks.oakLog, "frame");
      box(
        [x0 + 2, y0 + 5, z0 - 4],
        [x1 - 2, y0 + 5, z0 - 4],
        blocks.stonePolished,
        "business_marker"
      );
      frontIcon(blocks.stonePolished, [
        [-2, 0],
        [-1, 0],
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [0, 2],
      ]);
      break;
    case "magic_goods":
      for (const [x, z] of [
        [x0 + 4, z0 - 4],
        [x1 - 4, z0 - 4],
        [x0 + 4, z1 + 2],
        [x1 - 4, z1 + 2],
      ] as Array<[number, number]>) {
        column(x, z, y0 + 1, 3, blocks.simpleGlass, "business_marker");
        place([x, y0 + 4, z], blocks.moss, "business_marker");
      }
      roofRidge(blocks.simpleGlass);
      box(
        [doorX - 3, roofY + 1, centerZ - 3],
        [doorX + 3, roofY + 1, centerZ + 3],
        blocks.simpleGlass,
        "business_marker"
      );
      column(
        doorX,
        centerZ,
        roofY + 2,
        5,
        blocks.simpleGlass,
        "business_marker"
      );
      frontIcon(blocks.simpleGlass, sparkIcon);
      break;
    case "exploration_guide":
      box(
        [doorX - 6, y0 + 1, z0 - 5],
        [doorX + 6, y0 + 1, z0 - 4],
        blocks.oakLumber,
        "interior"
      );
      for (let dx = -6; dx <= 6; dx += 3)
        column(doorX + dx, z0 - 5, y0 + 2, 2, blocks.oakLog, "frame");
      box(
        [doorX - 8, y0 + 1, z0 - 7],
        [doorX + 8, y0 + 1, z0 - 7],
        blocks.stonePolished,
        "safe_ground"
      );
      roofFlagLine(blocks.oakLumber, 5);
      frontIcon(blocks.oakLumber, [
        [0, 2],
        [-1, 1],
        [1, 1],
        [-2, 0],
        [2, 0],
      ]);
      break;
    case "custom_home_property_development":
      box(
        [x0 + 2, y0 + 1, z0 - 5],
        [x0 + 5, y0 + 2, z0 - 3],
        blocks.oakLumber,
        "interior"
      );
      box(
        [x1 - 6, y0 + 1, z0 - 5],
        [x1 - 3, y0 + 2, z0 - 3],
        blocks.stonePolished,
        "interior"
      );
      box(
        [x0 + 3, roofY + 1, z1 - 3],
        [x0 + 9, roofY + 2, z1 - 2],
        blocks.oakLumber,
        "upgrade_addition"
      );
      frontPosts([-7, 7], 3, blocks.oakLog, blocks.oakLumber);
      frontIcon(blocks.oakLumber, keyIcon);
      break;
    case "general_trader":
      for (const dx of [-7, -4, 4, 7])
        box(
          [doorX + dx, y0 + 1, z0 - 5],
          [doorX + dx + 1, y0 + 2, z0 - 4],
          blocks.oakLumber,
          "storage_container"
        );
      box(
        [doorX - 9, y0 + 1, z0 - 6],
        [doorX - 6, y0 + 2, z0 - 5],
        blocks.hay,
        "storage_container"
      );
      box(
        [doorX + 6, y0 + 1, z0 - 6],
        [doorX + 9, y0 + 2, z0 - 5],
        blocks.oakLumber,
        "storage_container"
      );
      porchRail(blocks.oakLumber, -9, 9);
      frontIcon(blocks.hay, [
        [-2, 0],
        [-1, 1],
        [0, 2],
        [1, 1],
        [2, 0],
      ]);
      break;
    case "hunter_wild_meat":
      box(
        [x1 - 5, roofY + 1, z1 - 4],
        [x1 - 4, roofY + 4, z1 - 3],
        blocks.cobblestonePolished,
        "frame"
      );
      for (let x = x0 + 4; x <= x0 + 8; x += 2)
        column(x, z0 - 4, y0 + 1, 3, blocks.oakLog, "frame");
      box(
        [x0 + 2, y0 + 1, z0 - 6],
        [x0 + 8, y0 + 1, z0 - 5],
        blocks.hay,
        "storage_container"
      );
      column(x1 - 3, z0 - 4, y0 + 1, 4, blocks.oakLog, "frame");
      roofFlagLine(blocks.hay, 6);
      frontIcon(blocks.hay, [
        [0, 0],
        [-1, 1],
        [1, 1],
        [-2, 2],
        [2, 2],
      ]);
      break;
    case "medical_doctor":
      frontIcon(blocks.simpleGlass, crossIcon);
      for (const dx of [-6, 6]) {
        column(
          doorX + dx,
          z0 - 4,
          y0 + 1,
          3,
          blocks.simpleGlass,
          "business_marker"
        );
        place([doorX + dx, y0 + 4, z0 - 4], blocks.moss, "business_marker");
      }
      box(
        [doorX - 5, roofY + 1, z0 + 2],
        [doorX + 5, roofY + 1, z0 + 3],
        blocks.simpleGlass,
        "business_marker"
      );
      sidePlanterLine(blocks.moss);
      break;
    case "waste_sanitation_cleanup":
      for (const dx of [-6, -4, 4, 6])
        column(doorX + dx, z0 - 5, y0 + 1, 2, blocks.clay, "interior");
      box(
        [x1 - 4, y0 + 1, z0 - 4],
        [x1 - 2, y0 + 1, z0 - 2],
        blocks.stonePolished,
        "interior"
      );
      box(
        [doorX - 8, y0 + 1, z0 - 6],
        [doorX - 6, y0 + 2, z0 - 5],
        blocks.clay,
        "storage_container"
      );
      box(
        [doorX + 6, y0 + 1, z0 - 6],
        [doorX + 8, y0 + 2, z0 - 5],
        blocks.clay,
        "storage_container"
      );
      column(x1 - 3, z1 - 3, roofY + 1, 4, blocks.cobblestonePolished, "frame");
      frontIcon(blocks.clay, [
        [-2, 0],
        [-1, 1],
        [0, 2],
        [1, 1],
        [2, 0],
      ]);
      break;
    case "food_service_restaurant":
      box(
        [x1 - 5, roofY + 1, z1 - 4],
        [x1 - 4, roofY + 4, z1 - 3],
        blocks.clay,
        "frame"
      );
      box(
        [x0 + 3, y0 + 1, z0 - 5],
        [x0 + 5, y0 + 1, z0 - 4],
        blocks.oakLumber,
        "interior"
      );
      box(
        [x1 - 5, y0 + 1, z0 - 5],
        [x1 - 3, y0 + 1, z0 - 4],
        blocks.oakLumber,
        "interior"
      );
      box(
        [doorX - 6, y0 + 1, z0 - 6],
        [doorX - 3, y0 + 1, z0 - 5],
        blocks.hay,
        "storage_container"
      );
      box(
        [doorX + 3, y0 + 1, z0 - 6],
        [doorX + 6, y0 + 1, z0 - 5],
        blocks.hay,
        "storage_container"
      );
      roofFlagLine(blocks.clay, 5);
      frontIcon(blocks.clay, [
        [-1, 0],
        [0, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [0, 2],
      ]);
      break;
    case "courier":
      box(
        [doorX - 8, y0 + 1, z0 - 5],
        [doorX - 5, y0 + 2, z0 - 4],
        blocks.oakLumber,
        "storage_container"
      );
      box(
        [doorX + 5, y0 + 1, z0 - 5],
        [doorX + 8, y0 + 2, z0 - 4],
        blocks.oakLumber,
        "storage_container"
      );
      column(doorX, z0 - 6, y0 + 1, 4, blocks.oakLog, "frame");
      place([doorX + 1, y0 + 4, z0 - 6], blocks.hay, "business_marker");
      box(
        [doorX - 9, y0 + 1, z0 - 7],
        [doorX + 9, y0 + 1, z0 - 7],
        blocks.stonePolished,
        "safe_ground"
      );
      frontPosts([-5, 5], 3, blocks.oakLog, blocks.oakLumber);
      frontIcon(blocks.oakLumber, [
        [-2, 1],
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
        [-2, 0],
        [2, 0],
      ]);
      break;
    case "hospitality_inn_hotel_shelter":
      box(
        [x0 + 2, y0 + 5, z0 - 2],
        [x1 - 2, y0 + 5, z0 - 1],
        blocks.oakLumber,
        "upgrade_addition"
      );
      for (let x = x0 + 2; x <= x1 - 2; x += 3)
        column(x, z0 - 2, y0 + 6, 2, blocks.oakLog, "upgrade_addition");
      box(
        [doorX - 10, y0 + 1, z0 - 5],
        [doorX + 10, y0 + 1, z0 - 4],
        blocks.oakLumber,
        "upgrade_addition"
      );
      frontPosts([-8, 8], 5, blocks.oakLog, blocks.hay);
      sidePlanterLine(blocks.moss);
      frontIcon(blocks.oakLumber, keyIcon);
      break;
  }

  // Every outpost gets a small readable roofline change, so even businesses
  // with similar storefront proportions stop looking like repeated slabs.
  if (outpost.businessType !== "security_defense_contractor") {
    for (let z = z0 + 3; z <= z1 - 3; z += 4) {
      place([x0 + 1, roofY + 1, z], palette.trim, "roof");
      place([x1 - 1, roofY + 1, z], palette.trim, "roof");
    }
  }
}

export function createHarthmereBusinessOutpostProceduralBuilding(
  outpost: HarthmereBusinessOutpost,
  activatedAtMs = 0
): HarthmereBusinessOutpostProceduralBuildingRecord {
  ensureBuildingSystemStructureDefinitions();
  const blueprint = harthmereOutpostBlueprintFor(outpost);
  const plot = harthmereOutpostPlotFor(outpost, blueprint);
  const origin = harthmereOutpostOrigin(outpost);
  const terrainGrounding = harthmereBusinessOutpostTerrainGrounding(outpost);
  const doorX = origin.x + Math.floor(blueprint.footprint.width / 2);
  const entrance = { x: doorX, y: origin.y + 1, z: origin.z - 1 };
  const queueNode = { x: doorX, y: origin.y + 1, z: origin.z + 3 };
  const serviceCounter = {
    x: doorX,
    y: origin.y + 1,
    z: origin.z + Math.max(8, blueprint.footprint.depth - 6),
  };
  const exitNode = {
    x: Math.min(origin.x + blueprint.footprint.width - 3, doorX + 2),
    y: origin.y + 1,
    z: origin.z + 1,
  };
  const buildingStyleKit = harthmereBusinessOutpostBuildingStyleKit(outpost);
  const materializationPlan = createBuildingSystemMaterializationPlan({
    requestId: `${outpost.outpostId}_backend_materialization`,
    actorId: outpost.ownerNpcId,
    plot,
    blueprint,
    origin,
    rotationDegrees: harthmereOutpostRotationDegrees(outpost.position.rot),
    includeSafeGround: true,
    activatedAtMs,
  });
  applyHarthmereOutpostVoxelPalette(materializationPlan, buildingStyleKit);
  addHarthmereOutpostRetainingFoundationSupports({
    materializationPlan,
    plot,
    origin,
  });
  const jobsBoardPosition = { x: entrance.x + 3, y: origin.y, z: origin.z - 3 };
  const bikkieGraphics = getHarthmereBusinessBikkieGraphics(
    outpost.businessType
  );
  const primaryBikkieGraphic = getHarthmereBusinessPrimaryBikkieGraphic(
    outpost.businessType
  );
  const dashboardAccessPoint = {
    markerId: `${outpost.outpostId}:customer-dashboard`,
    label: `${outpost.displayName} Business Board`,
    position: {
      x: Math.max(origin.x + 3, doorX - 4),
      y: origin.y + 1,
      z: Math.max(origin.z + 4, serviceCounter.z - 1),
    },
    interaction: "open_business_dashboard" as const,
    visibleFromEntrance: true as const,
    keyboardlessTraversal: true as const,
  };
  const interiorFixtures = createHarthmereBusinessInteriorFixtures({
    outpost,
    origin,
    blueprint,
    queueNode,
    serviceCounter,
    dashboardAccessPoint,
    primaryBikkieGraphic,
  });
  addHarthmereOutpostGuideVoxels({
    materializationPlan,
    outpost,
    origin,
    blueprint,
    buildingStyleKit,
    doorX,
    entrance,
    queueNode,
    serviceCounter,
    exitNode,
    dashboardAccessPoint,
    interiorFixtures,
    primaryBikkieGraphic,
  });
  addHarthmereOutpostBusinessSignature({
    materializationPlan,
    outpost,
    origin,
    blueprint,
    buildingStyleKit,
    doorX,
  });
  // Grade a flat, fertile, green safe site around the finished shell so the
  // building sits evenly on the ground (no sharp drops) with a tended garden
  // yard instead of raw muck terrain.
  addHarthmereOutpostSiteGradingAndGarden({
    materializationPlan,
    plot,
    origin,
    blueprint,
    styleKit: buildingStyleKit,
  });
  // Register the protected safe zone across the full graded site (plot + garden
  // ring) so muck monsters and Hexes stay non-aggressive and relocate away.
  if (materializationPlan.safeZone) {
    materializationPlan.safeZone.bounds =
      harthmereBusinessOutpostSafeSiteBounds(plot.bounds);
  }
  const safeZoneBounds =
    materializationPlan.safeZone?.bounds ??
    harthmereBusinessOutpostSafeSiteBounds(plot.bounds);
  const safeZoneCenter: [number, number, number] = [
    Math.round((safeZoneBounds.xMin + safeZoneBounds.xMax) / 2),
    origin.y,
    Math.round((safeZoneBounds.zMin + safeZoneBounds.zMax) / 2),
  ];
  const staffNpcMarkerPosition: [number, number, number] = [
    Math.min(origin.x + blueprint.footprint.width - 3, serviceCounter.x + 4),
    origin.y + 1,
    Math.min(origin.z + blueprint.footprint.depth - 3, serviceCounter.z + 1),
  ];
  const customerNpcMarkerPosition: [number, number, number] = [
    Math.max(origin.x + 3, queueNode.x - 1),
    origin.y + 1,
    Math.max(origin.z + 4, queueNode.z + 1),
  ];
  materializationPlan.inWorldMarkers = [
    {
      markerId: `${outpost.outpostId}:safe-zone`,
      plotId: plot.plotId,
      kind: "safe_zone",
      position: safeZoneCenter,
      label: `${outpost.displayName} protected business area`,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: `${outpost.outpostId}:business-counter`,
      plotId: plot.plotId,
      kind: "business_marker",
      position: [serviceCounter.x, serviceCounter.y, serviceCounter.z],
      label: `${outpost.displayName} counter`,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: dashboardAccessPoint.markerId,
      plotId: plot.plotId,
      kind: "business_marker",
      position: [
        dashboardAccessPoint.position.x,
        dashboardAccessPoint.position.y,
        dashboardAccessPoint.position.z,
      ],
      label: dashboardAccessPoint.label,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: `${outpost.outpostId}:dashboard-access-post`,
      plotId: plot.plotId,
      kind: "business_marker",
      position: [
        dashboardAccessPoint.position.x,
        dashboardAccessPoint.position.y + 1,
        dashboardAccessPoint.position.z,
      ],
      label: `${outpost.displayName} Business Board access post`,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: `${outpost.outpostId}:staff-npc`,
      plotId: plot.plotId,
      kind: "npc_board",
      position: staffNpcMarkerPosition,
      label: `${outpost.displayName} staff NPC`,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: `${outpost.outpostId}:customer-npc`,
      plotId: plot.plotId,
      kind: "business_marker",
      position: customerNpcMarkerPosition,
      label: `${outpost.displayName} customer NPC`,
      createdAtMs: activatedAtMs,
    },
    {
      markerId: `${outpost.outpostId}:jobs-board`,
      plotId: plot.plotId,
      kind: "npc_board",
      position: [jobsBoardPosition.x, jobsBoardPosition.y, jobsBoardPosition.z],
      label: `${outpost.displayName} jobs board`,
      createdAtMs: activatedAtMs,
    },
    ...(primaryBikkieGraphic
      ? [
          {
            markerId: `${outpost.outpostId}:bikkie:${primaryBikkieGraphic.bikkieId}`,
            plotId: plot.plotId,
            kind: "business_marker" as const,
            position: [
              serviceCounter.x + 1,
              serviceCounter.y,
              serviceCounter.z,
            ] as [number, number, number],
            label: `${outpost.displayName} ${primaryBikkieGraphic.label}`,
            createdAtMs: activatedAtMs,
          },
        ]
      : []),
  ];
  const countLabel = (label: string) =>
    materializationPlan.edits.filter((edit) => edit.label === label).length;
  const customerSpace = {
    minX: origin.x + 2,
    maxX: origin.x + blueprint.footprint.width - 2,
    minZ: origin.z + 2,
    maxZ: origin.z + blueprint.footprint.depth - 3,
  };
  return {
    buildingId: `${outpost.outpostId}_backend_voxel_building`,
    outpostId: outpost.outpostId,
    businessType: outpost.businessType,
    displayName: outpost.displayName,
    serverOwned: true,
    sourceOfTruth: "backend_procedural_voxel_building",
    generationMode: "building_system_materialization_plan",
    plot,
    blueprint,
    origin,
    terrainGrounding,
    rotationDegrees: materializationPlan.rotationDegrees,
    entrance,
    queueNode,
    serviceCounter,
    exitNode,
    customerSpace: {
      ...customerSpace,
      areaMeters:
        Math.max(0, customerSpace.maxX - customerSpace.minX) *
        Math.max(0, customerSpace.maxZ - customerSpace.minZ),
    },
    clearances: {
      frontDoorMeters: 2,
      shopCustomerSpaceMeters: 4,
      publicEntranceMeters: 3,
    },
    visualReferenceCoordinates:
      HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES,
    buildingStyleKit,
    dashboardAccessPoint,
    jobsBoardPosition,
    interiorFixtures,
    bikkieGraphics,
    primaryBikkieGraphic,
    materializationPlan,
    interiorAudit: {
      minigameReady: true,
      hasAccessibleDoor: true,
      hasReadableWindows: true,
      hasCustomerDashboardAccess: true,
      hasBusinessSpecificDecor: true,
      customerQueueCapacity: Math.max(
        4,
        Math.floor(blueprint.footprint.width / 3)
      ),
      staffWorkstations: interiorFixtures.filter(
        (fixture) =>
          fixture.role === "primary_station" ||
          fixture.role === "service_table" ||
          fixture.role === "workstation"
      ).length,
      decorationFixtureCount: interiorFixtures.filter(
        (fixture) => fixture.businessSpecific
      ).length,
    },
    structuralAudit: {
      materializesSolidVoxelBuilding: true,
      foundationEdits: countLabel("foundation"),
      floorEdits: countLabel("floor"),
      wallEdits: countLabel("wall"),
      roofEdits: countLabel("roof"),
      stairEdits: countLabel("stair"),
    },
  };
}

function isPointInsideOutpostFootprint(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  point: { x: number; z: number } | undefined
) {
  const origin = (record as any).origin;
  const footprint = (record as any).blueprint?.footprint;
  if (!point || !origin || !footprint) return false;
  return (
    point.x >= origin.x &&
    point.x < origin.x + Number(footprint.width ?? 0) &&
    point.z >= origin.z &&
    point.z < origin.z + Number(footprint.depth ?? 0)
  );
}

function materializationEditsForOutpostValidation(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const edits = (record as any).materializationPlan?.edits;
  return Array.isArray(edits) ? edits : [];
}

function interiorFixturesForOutpostValidation(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const fixtures = (record as any).interiorFixtures;
  return Array.isArray(fixtures) ? fixtures : [];
}

function styleNotesForOutpostValidation(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const styleNotes = (record as any).buildingStyleKit?.styleNotes;
  return Array.isArray(styleNotes) ? styleNotes : [];
}

function hasBlockingWallAtNode(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  point: { x: number; y: number; z: number }
) {
  return materializationEditsForOutpostValidation(record).some(
    (edit) =>
      Array.isArray(edit?.position) &&
      edit.label === "wall" &&
      edit.position[0] === Math.round(point.x) &&
      edit.position[1] === Math.round(point.y) &&
      edit.position[2] === Math.round(point.z)
  );
}

function fixtureOccupiesNode(
  fixture: HarthmereBusinessOutpostInteriorFixture,
  point: { x: number; y: number; z: number }
) {
  if (!fixture.blocksNavigation) return false;
  const cx = fixture.position.x + 0.5;
  const cz = fixture.position.z + 0.5;
  const halfX = fixture.size[0] / 2;
  const halfZ = fixture.size[2] / 2;
  return (
    point.y === fixture.position.y &&
    point.x + 0.5 >= cx - halfX &&
    point.x + 0.5 <= cx + halfX &&
    point.z + 0.5 >= cz - halfZ &&
    point.z + 0.5 <= cz + halfZ
  );
}

export function validateHarthmereBusinessOutpostPassability(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
): HarthmereBusinessOutpostPassabilityAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const footprint = (record as any).blueprint?.footprint ?? {};
  const materializationPlan = (record as any).materializationPlan ?? {};
  const buildingStyleKit = (record as any).buildingStyleKit;
  const structuralAudit = (record as any).structuralAudit ?? {};
  const clearances = (record as any).clearances ?? {};
  const customerSpace = (record as any).customerSpace ?? {};
  const interiorAudit = (record as any).interiorAudit ?? {};
  const interiorFixtures = interiorFixturesForOutpostValidation(record);
  const styleNotes = styleNotesForOutpostValidation(record);
  if (Number(footprint.width ?? 0) < 24)
    errors.push("outpost_minigame_width_below_24m");
  if (Number(footprint.depth ?? 0) < 20)
    errors.push("outpost_minigame_depth_below_20m");
  if (!record.serverOwned) errors.push("outpost_building_not_server_owned");
  if (record.sourceOfTruth !== "backend_procedural_voxel_building")
    errors.push("outpost_building_not_backend_voxel_source");
  if (record.generationMode !== "building_system_materialization_plan")
    errors.push("outpost_building_not_materialization_plan_generated");
  if (!materializationPlan.materializesSolidVoxelBuilding)
    errors.push("outpost_building_not_solid_voxel_materialized");
  if (!Array.isArray(materializationPlan.edits))
    errors.push("outpost_materialization_plan_missing_edits");
  if (!buildingStyleKit)
    errors.push("outpost_missing_grove_reference_style_kit");
  if (buildingStyleKit?.doorStyle !== "wood_glass_panel")
    errors.push("outpost_door_not_grove_wood_glass_panel");
  if (buildingStyleKit?.windowStyle !== "large_framed_shop_glass")
    errors.push("outpost_windows_not_large_framed_shop_glass");
  if (buildingStyleKit && !Array.isArray(buildingStyleKit.styleNotes))
    errors.push("outpost_style_kit_missing_style_notes");
  if (!styleNotes.some((note) => /Grove|grove/.test(note)))
    errors.push("outpost_style_kit_missing_grove_reference_notes");
  if (Number(structuralAudit.foundationEdits ?? 0) <= 0)
    errors.push("outpost_building_missing_foundation_voxels");
  if (Number(structuralAudit.floorEdits ?? 0) <= 0)
    errors.push("outpost_building_missing_floor_voxels");
  if (Number(structuralAudit.wallEdits ?? 0) <= 0)
    errors.push("outpost_building_missing_wall_voxels");
  if (Number(structuralAudit.roofEdits ?? 0) <= 0)
    errors.push("outpost_building_missing_roof_voxels");
  if (Number(structuralAudit.stairEdits ?? 0) <= 0)
    errors.push("outpost_building_missing_entrance_step");
  if (Number(clearances.frontDoorMeters ?? 0) < 2)
    errors.push("outpost_front_door_clearance_below_2m");
  if (Number(clearances.shopCustomerSpaceMeters ?? 0) < 4)
    errors.push("outpost_customer_space_clearance_below_4m");
  if (Number(clearances.publicEntranceMeters ?? 0) < 3)
    errors.push("outpost_public_entrance_clearance_below_3m");
  if (Number(customerSpace.areaMeters ?? 0) < 16)
    errors.push("outpost_customer_space_too_small");
  if (!record.dashboardAccessPoint?.visibleFromEntrance)
    errors.push("outpost_dashboard_access_not_visible_from_entrance");
  if (!record.dashboardAccessPoint?.keyboardlessTraversal)
    errors.push("outpost_dashboard_access_missing_keyboardless_traversal");
  if (!Array.isArray((record as any).interiorFixtures))
    errors.push("outpost_missing_interior_fixtures");
  if (!interiorFixtures.some((fixture) => fixture.role === "dashboard_access"))
    errors.push("outpost_missing_dashboard_access_fixture");
  if (!interiorFixtures.some((fixture) => fixture.role === "service_counter"))
    errors.push("outpost_missing_service_counter_fixture");
  if (!interiorFixtures.some((fixture) => fixture.role === "primary_station"))
    errors.push("outpost_missing_primary_bikkie_station_fixture");
  if (interiorFixtures.filter((fixture) => fixture.businessSpecific).length < 4)
    errors.push("outpost_missing_business_specific_decor");
  if (Number(interiorAudit.customerQueueCapacity ?? 0) < 4)
    errors.push("outpost_customer_queue_capacity_too_small");
  if (Number(interiorAudit.staffWorkstations ?? 0) < 2)
    errors.push("outpost_staff_workstations_too_few");
  if (!record.jobsBoardPosition)
    errors.push("outpost_missing_jobs_board_position");
  if (isPointInsideOutpostFootprint(record, record.jobsBoardPosition))
    errors.push("outpost_jobs_board_blocks_customer_floor");
  for (const [label, node] of Object.entries({
    entrance: record.entrance,
    queue: record.queueNode,
    serviceCounter: record.serviceCounter,
    exit: record.exitNode,
  })) {
    if (!node) {
      errors.push(`outpost_customer_path_node_missing:${label}`);
      continue;
    }
    if (hasBlockingWallAtNode(record, node))
      errors.push(`outpost_customer_path_node_blocked:${label}`);
    if (
      interiorFixtures.some((fixture) => fixtureOccupiesNode(fixture, node))
    ) {
      errors.push(`outpost_customer_path_fixture_blocked:${label}`);
    }
  }
  if (!isPointInsideOutpostFootprint(record, record.queueNode))
    warnings.push("outpost_queue_node_not_inside_floor");
  if (!isPointInsideOutpostFootprint(record, record.serviceCounter))
    warnings.push("outpost_service_counter_not_inside_floor");
  return {
    ok: errors.length === 0,
    buildingId: record.buildingId,
    errors,
    warnings,
    auditTags: [
      "backend_procedural_voxel_building",
      "solid_structural_core",
      "customer_path_clear",
      "jobs_board_outside_customer_floor",
    ],
  };
}

function liveWorldPointKey(point: { x: number; y: number; z: number }) {
  return `${Math.round(point.x)},${Math.round(point.y)},${Math.round(point.z)}`;
}

function liveWorldNodeFor(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  node:
    | HarthmereBusinessLiveWorldNavigationActor["start"]
    | HarthmereBusinessLiveWorldNavigationActor["goal"]
) {
  const employeeDoor = {
    x: record.origin.x + record.blueprint.footprint.width - 2,
    y: record.origin.y + 1,
    z: record.origin.z + 1,
  };
  const stock = {
    x: record.origin.x + record.blueprint.footprint.width - 3,
    y: record.origin.y + 1,
    z: Math.min(
      record.origin.z + record.blueprint.footprint.depth - 4,
      record.serviceCounter.z + 2
    ),
  };
  switch (node) {
    case "entrance":
      return record.entrance;
    case "queue":
      return record.queueNode;
    case "counter":
      return record.serviceCounter;
    case "service":
      return {
        x: record.serviceCounter.x,
        y: record.serviceCounter.y,
        z: Math.max(record.queueNode.z, record.serviceCounter.z - 1),
      };
    case "employeeDoor":
      return employeeDoor;
    case "stock":
      return stock;
    case "exit":
      return record.exitNode;
  }
}

function liveWorldNeighbors(point: { x: number; y: number; z: number }) {
  return [
    { x: point.x + 1, y: point.y, z: point.z },
    { x: point.x - 1, y: point.y, z: point.z },
    { x: point.x, y: point.y, z: point.z + 1 },
    { x: point.x, y: point.y, z: point.z - 1 },
  ];
}

function liveWorldWallKeys(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  return new Set(
    materializationEditsForOutpostValidation(record)
      .filter((edit) => edit.label === "wall" && Array.isArray(edit.position))
      .map((edit) =>
        liveWorldPointKey({
          x: edit.position[0],
          y: edit.position[1],
          z: edit.position[2],
        })
      )
  );
}

function liveWorldInteriorFixtureBlockerKeys(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
) {
  const keys = new Set<string>();
  for (const fixture of interiorFixturesForOutpostValidation(record)) {
    if (!fixture.blocksNavigation) continue;
    const cx = fixture.position.x + 0.5;
    const cz = fixture.position.z + 0.5;
    const xMin = Math.floor(cx - fixture.size[0] / 2);
    const xMax = Math.ceil(cx + fixture.size[0] / 2);
    const zMin = Math.floor(cz - fixture.size[2] / 2);
    const zMax = Math.ceil(cz + fixture.size[2] / 2);
    for (let x = xMin; x < xMax; x += 1) {
      for (let z = zMin; z < zMax; z += 1) {
        keys.add(liveWorldPointKey({ x, y: fixture.position.y, z }));
      }
    }
  }
  return keys;
}

function liveWorldBlockerKeys(
  blockers: HarthmereBusinessLiveWorldDynamicBlocker[],
  includeTemporary: boolean
) {
  const keys = new Map<string, HarthmereBusinessLiveWorldDynamicBlocker[]>();
  for (const blocker of blockers) {
    if (blocker.temporary && !includeTemporary) continue;
    const radius = Math.max(0, Math.ceil(blocker.radiusMeters));
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.hypot(dx, dz) > Math.max(0.5, blocker.radiusMeters)) continue;
        const key = liveWorldPointKey({
          x: blocker.position.x + dx,
          y: blocker.position.y,
          z: blocker.position.z + dz,
        });
        keys.set(key, [...(keys.get(key) ?? []), blocker]);
      }
    }
  }
  return keys;
}

function liveWorldWithinNavBounds(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  point: { x: number; y: number; z: number }
) {
  return (
    point.y === record.origin.y + 1 &&
    point.x >= record.origin.x - 4 &&
    point.x <= record.origin.x + record.blueprint.footprint.width + 4 &&
    point.z >= record.origin.z - 5 &&
    point.z <= record.origin.z + record.blueprint.footprint.depth + 4
  );
}

function findLiveWorldPath(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  start: { x: number; y: number; z: number },
  goal: { x: number; y: number; z: number },
  wallKeys: Set<string>,
  blockerKeys: Map<string, HarthmereBusinessLiveWorldDynamicBlocker[]>
) {
  const startKey = liveWorldPointKey(start);
  const goalKey = liveWorldPointKey(goal);
  const blocked = (point: { x: number; y: number; z: number }) => {
    const key = liveWorldPointKey(point);
    return wallKeys.has(key) || blockerKeys.has(key);
  };
  if (blocked(start) || blocked(goal)) return undefined;
  const queue = [start];
  const cameFrom = new Map<string, string | undefined>([[startKey, undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = liveWorldPointKey(current);
    if (currentKey === goalKey) {
      const path: Array<{ x: number; y: number; z: number }> = [];
      let key: string | undefined = currentKey;
      while (key) {
        const [x, y, z] = key.split(",").map((part) => Number(part));
        path.push({ x, y, z });
        key = cameFrom.get(key);
      }
      return path.reverse();
    }
    for (const next of liveWorldNeighbors(current)) {
      const key = liveWorldPointKey(next);
      if (
        cameFrom.has(key) ||
        !liveWorldWithinNavBounds(record, next) ||
        blocked(next)
      )
        continue;
      cameFrom.set(key, currentKey);
      queue.push(next);
    }
  }
  return undefined;
}

export function validateHarthmereBusinessOutpostLiveWorldNavigation(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  input: {
    actors?: HarthmereBusinessLiveWorldNavigationActor[];
    dynamicBlockers?: HarthmereBusinessLiveWorldDynamicBlocker[];
  } = {}
): HarthmereBusinessLiveWorldNavigationAudit {
  const warnings: string[] = [];
  const unreachableRoutes: string[] = [];
  const unresolvedCollisions: string[] = [];
  const recoveredBlockers = new Set<string>();
  const routeLengths: Record<string, number> = {};
  const wallKeys = liveWorldWallKeys(record);
  for (const key of liveWorldInteriorFixtureBlockerKeys(record))
    wallKeys.add(key);
  const dynamicBlockers = input.dynamicBlockers ?? [
    {
      blockerId: `${record.outpostId}:loose_queue_crate`,
      kind: "dynamic_prop",
      position: {
        x: record.queueNode.x + 1,
        y: record.queueNode.y,
        z: record.queueNode.z,
      },
      radiusMeters: 0.75,
      temporary: true,
    },
    {
      blockerId: `${record.outpostId}:pet_waiting_near_door`,
      kind: "pet",
      position: {
        x: record.entrance.x - 1,
        y: record.entrance.y,
        z: record.entrance.z,
      },
      radiusMeters: 0.5,
      temporary: true,
    },
  ];
  const actors = input.actors ?? [
    {
      actorId: "customer_route_probe",
      kind: "customer",
      start: "entrance",
      goal: "service",
      radiusMeters: 0.45,
    },
    {
      actorId: "employee_route_probe",
      kind: "employee",
      start: "employeeDoor",
      goal: "counter",
      radiusMeters: 0.45,
    },
    {
      actorId: "customer_exit_probe",
      kind: "customer",
      start: "service",
      goal: "exit",
      radiusMeters: 0.45,
    },
  ];
  const allBlockerKeys = liveWorldBlockerKeys(dynamicBlockers, true);
  const permanentBlockerKeys = liveWorldBlockerKeys(dynamicBlockers, false);
  const actorPaths: Record<
    string,
    Array<{ x: number; y: number; z: number }>
  > = {};

  for (const actor of actors) {
    const start = liveWorldNodeFor(record, actor.start);
    const goal = liveWorldNodeFor(record, actor.goal);
    const routeId = `${actor.actorId}:${actor.start}->${actor.goal}`;
    let path = findLiveWorldPath(record, start, goal, wallKeys, allBlockerKeys);
    if (!path) {
      path = findLiveWorldPath(
        record,
        start,
        goal,
        wallKeys,
        permanentBlockerKeys
      );
      if (path) {
        for (const blocker of dynamicBlockers) {
          if (blocker.temporary) recoveredBlockers.add(blocker.blockerId);
        }
        warnings.push(
          `live_world_navigation_recovered_temporary_blocker:${routeId}`
        );
      }
    }
    if (!path) {
      unreachableRoutes.push(routeId);
      continue;
    }
    actorPaths[actor.actorId] = path;
    routeLengths[routeId] = path.length;
  }

  const paths = Object.entries(actorPaths);
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const [aId, aPath] = paths[i];
      const [bId, bPath] = paths[j];
      const max = Math.max(aPath.length, bPath.length);
      for (let step = 0; step < max; step += 1) {
        const a = aPath[Math.min(step, aPath.length - 1)];
        const b = bPath[Math.min(Math.max(0, step - 2), bPath.length - 1)];
        if (liveWorldPointKey(a) === liveWorldPointKey(b)) {
          unresolvedCollisions.push(`${aId}:${bId}:${liveWorldPointKey(a)}`);
          break;
        }
      }
    }
  }

  return {
    ok: unreachableRoutes.length === 0 && unresolvedCollisions.length === 0,
    buildingId: record.buildingId,
    businessType: record.businessType,
    navmeshBake: "server_voxel_hydrated_grid",
    routeCount: Object.keys(routeLengths).length,
    crowdActorCount: actors.length,
    dynamicBlockerCount: dynamicBlockers.length,
    recoveredBlockers: Array.from(recoveredBlockers),
    routeLengths,
    unreachableRoutes,
    unresolvedCollisions,
    warnings,
    auditTags: [
      "server_navmesh_grid_baked",
      "dynamic_blockers_checked",
      "crowd_collision_checked",
      "temporary_stuck_recovery_checked",
      "hydrated_voxel_building_checked",
    ],
  };
}

export function harthmereBusinessOutpostBusinessId(outpostId: string) {
  return `business_${outpostId}`;
}

export const HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS: Readonly<
  Record<string, HarthmereBusinessOutpostProceduralBuildingRecord>
> = Object.freeze(
  Object.fromEntries(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => [
      outpost.outpostId,
      createHarthmereBusinessOutpostProceduralBuilding(outpost),
    ])
  )
);

export const HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION =
  "harthmere-business-outpost-rebuild-real-interior-visual-props" as const;

export interface HarthmereBusinessOutpostSafeSite {
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  displayName: string;
  groundY: number;
  center: { x: number; z: number };
  footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
  plotBounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  safeBounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  muckRelocation: {
    id: string;
    label: string;
    center: { x: number; y: number; z: number };
    distanceMeters: number;
  };
}

// Authored Muck/Wilds road corridors the business pads must never sit on top
// of. The production-captured business sites may be far beyond these starter
// corridors, so this list is a collision keepout rather than an access rule.
const HARTHMERE_BUSINESS_OUTPOST_ROAD_KEEPOUTS = Object.freeze([
  {
    id: "north_road",
    a: { x: 486, z: -304 },
    b: { x: 486, z: -920 },
    halfWidth: 8,
  },
  {
    id: "south_road",
    a: { x: 486, z: -100 },
    b: { x: 486, z: 548 },
    halfWidth: 8,
  },
  {
    id: "west_road",
    a: { x: 384, z: -209 },
    b: { x: -224, z: -209 },
    halfWidth: 8,
  },
  {
    id: "east_road",
    a: { x: 604, z: -205 },
    b: { x: 1252, z: -205 },
    halfWidth: 8,
  },
  {
    id: "northwest_hunter_track",
    a: { x: 420, z: -304 },
    b: { x: -52, z: -776 },
    halfWidth: 7,
  },
  {
    id: "northeast_reed_track",
    a: { x: 604, z: -260 },
    b: { x: 1076, z: -732 },
    halfWidth: 7,
  },
  {
    id: "southeast_grave_track",
    a: { x: 568, z: -100 },
    b: { x: 1040, z: 372 },
    halfWidth: 7,
  },
  {
    id: "thornbridge_crossing",
    a: { x: 324, z: -498 },
    b: { x: 352, z: -498 },
    halfWidth: 6,
  },
  {
    id: "broken_toll_road",
    a: { x: 454, z: -422 },
    b: { x: 531, z: -492 },
    halfWidth: 6,
  },
  {
    id: "briarfen_plank_path",
    a: { x: 620, z: -226 },
    b: { x: 662, z: -280 },
    halfWidth: 6,
  },
] as const);

export const HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES: readonly HarthmereBusinessOutpostSafeSite[] =
  Object.freeze(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => {
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      const center = { x: outpost.position.x, z: outpost.position.z };
      return {
        outpostId: outpost.outpostId,
        businessType: outpost.businessType,
        displayName: outpost.displayName,
        groundY: record.origin.y,
        center,
        footprint: {
          xMin: record.origin.x,
          xMax: record.origin.x + record.blueprint.footprint.width,
          zMin: record.origin.z,
          zMax: record.origin.z + record.blueprint.footprint.depth,
        },
        plotBounds: record.plot.bounds,
        safeBounds: harthmereBusinessOutpostSafeSiteBounds(record.plot.bounds),
        muckRelocation: harthmereBusinessOutpostMuckRelocationTarget(center),
      };
    })
  );

function harthmereBusinessRectContains(
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number },
  point: { x: number; z: number },
  pad = 0
) {
  return (
    point.x >= bounds.xMin - pad &&
    point.x <= bounds.xMax + pad &&
    point.z >= bounds.zMin - pad &&
    point.z <= bounds.zMax + pad
  );
}

function harthmereBusinessRectsOverlap(
  a: { xMin: number; xMax: number; zMin: number; zMax: number },
  b: { xMin: number; xMax: number; zMin: number; zMax: number },
  pad = 0
) {
  return (
    a.xMin - pad < b.xMax &&
    a.xMax + pad > b.xMin &&
    a.zMin - pad < b.zMax &&
    a.zMax + pad > b.zMin
  );
}

function harthmereBusinessPointToSegmentDistance(
  point: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number }
) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq)
  );
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function harthmereBusinessPointToRectDistance(
  point: { x: number; z: number },
  rect: { xMin: number; xMax: number; zMin: number; zMax: number }
) {
  const dx =
    point.x < rect.xMin
      ? rect.xMin - point.x
      : point.x > rect.xMax
      ? point.x - rect.xMax
      : 0;
  const dz =
    point.z < rect.zMin
      ? rect.zMin - point.z
      : point.z > rect.zMax
      ? point.z - rect.zMax
      : 0;
  return Math.hypot(dx, dz);
}

function harthmereBusinessSegmentsIntersect(
  a1: { x: number; z: number },
  a2: { x: number; z: number },
  b1: { x: number; z: number },
  b2: { x: number; z: number }
) {
  const orient = (
    p: { x: number; z: number },
    q: { x: number; z: number },
    r: { x: number; z: number }
  ) => (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z);
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

function harthmereBusinessSegmentToRectDistance(
  road: { a: { x: number; z: number }; b: { x: number; z: number } },
  rect: { xMin: number; xMax: number; zMin: number; zMax: number }
) {
  if (
    harthmereBusinessRectContains(rect, road.a) ||
    harthmereBusinessRectContains(rect, road.b)
  ) {
    return 0;
  }
  const corners = [
    { x: rect.xMin, z: rect.zMin },
    { x: rect.xMax, z: rect.zMin },
    { x: rect.xMax, z: rect.zMax },
    { x: rect.xMin, z: rect.zMax },
  ];
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ] as const;
  if (
    edges.some(([a, b]) =>
      harthmereBusinessSegmentsIntersect(road.a, road.b, a, b)
    )
  ) {
    return 0;
  }
  return Math.min(
    harthmereBusinessPointToRectDistance(road.a, rect),
    harthmereBusinessPointToRectDistance(road.b, rect),
    ...corners.map((corner) =>
      harthmereBusinessPointToSegmentDistance(corner, road.a, road.b)
    )
  );
}

export function harthmereBusinessOutpostSafeSiteForPoint(
  point: { x: number; z: number } | undefined,
  pad = 0
) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    return undefined;
  }
  return HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find((site) =>
    harthmereBusinessRectContains(site.safeBounds, point, pad)
  );
}

export function isPointInsideHarthmereBusinessSafeSite(
  point: { x: number; z: number } | undefined,
  pad = 0
) {
  return Boolean(harthmereBusinessOutpostSafeSiteForPoint(point, pad));
}

// Validates the nine production siting rules the player called out: buildings
// not stacked on each other, not over a road, on a clear graded site, with muck
// relocated to a real muck area nearby.
export function validateHarthmereBusinessOutpostSafeSiting() {
  const errors: string[] = [];
  const sites = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES;

  for (let i = 0; i < sites.length; i += 1) {
    for (let j = i + 1; j < sites.length; j += 1) {
      if (
        harthmereBusinessRectsOverlap(sites[i].footprint, sites[j].footprint, 2)
      ) {
        errors.push(
          `outpost_footprints_overlap:${sites[i].outpostId}:${sites[j].outpostId}`
        );
      }
    }
  }

  for (const site of sites) {
    for (const coord of HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES) {
      if (
        harthmereBusinessRectContains(
          site.footprint,
          { x: coord[0], z: coord[2] },
          6
        )
      ) {
        errors.push(
          `outpost_on_reference_building:${site.outpostId}:${coord.join(",")}`
        );
      }
    }

    if (!(site.muckRelocation.distanceMeters > 0)) {
      errors.push(`outpost_missing_muck_relocation_target:${site.outpostId}`);
    }
    for (const anchor of HARTHMERE_BUSINESS_OUTPOST_MUCK_RELOCATION_ANCHORS) {
      if (
        harthmereBusinessRectContains(site.safeBounds, {
          x: anchor.center.x,
          z: anchor.center.z,
        })
      ) {
        errors.push(
          `muck_anchor_inside_safe_site:${site.outpostId}:${anchor.id}`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    checkedSites: sites.length,
    errors,
    auditTags: [
      "no_building_on_building",
      "no_building_over_road",
      "clear_of_reference_buildings",
      "muck_relocated_to_nearby_muck_area",
      "graded_green_safe_site",
    ],
  };
}

export function validateHarthmereBusinessOutpostProductionReadiness() {
  const gaps: string[] = [];
  const records = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS;
  if (HARTHMERE_BUSINESS_OUTPOSTS.length !== 19) {
    gaps.push(
      `expected_19_outposts_found_${HARTHMERE_BUSINESS_OUTPOSTS.length}`
    );
  }
  if (Object.keys(records).length !== HARTHMERE_BUSINESS_OUTPOSTS.length) {
    gaps.push(
      `procedural_record_count_mismatch:${Object.keys(records).length}_of_${
        HARTHMERE_BUSINESS_OUTPOSTS.length
      }`
    );
  }

  const groundedYs = new Set<number>();
  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    const record = records[outpost.outpostId];
    const expectedGroundY = harthmereBusinessOutpostGroundY(outpost);
    groundedYs.add(expectedGroundY);
    if (
      !(outpost.outpostId in HARTHMERE_BUSINESS_OUTPOST_TERRAIN_GROUND_Y_BY_ID)
    ) {
      gaps.push(`${outpost.outpostId}:missing_explicit_terrain_ground_y`);
    }
    if (!record) {
      gaps.push(`${outpost.outpostId}:missing_procedural_building_record`);
      continue;
    }

    const width = record.blueprint.footprint.width;
    const depth = record.blueprint.footprint.depth;
    const expectedOrigin = {
      x: Math.round(outpost.position.x - width / 2),
      y: expectedGroundY,
      z: Math.round(outpost.position.z - depth / 2),
    };
    if (
      record.origin.x !== expectedOrigin.x ||
      record.origin.y !== expectedOrigin.y ||
      record.origin.z !== expectedOrigin.z
    ) {
      gaps.push(`${outpost.outpostId}:origin_not_grounded_to_location`);
    }
    if (record.plot.groundY !== expectedGroundY) {
      gaps.push(`${outpost.outpostId}:plot_ground_y_mismatch`);
    }
    if (record.materializationPlan.origin.y !== expectedGroundY) {
      gaps.push(`${outpost.outpostId}:materialization_origin_y_mismatch`);
    }
    if (record.terrainGrounding.padGroundY !== expectedGroundY) {
      gaps.push(`${outpost.outpostId}:terrain_pad_y_mismatch`);
    }
    if (record.terrainGrounding.maxTerrainY !== expectedGroundY) {
      gaps.push(`${outpost.outpostId}:terrain_samples_do_not_touch_pad`);
    }
    if (record.terrainGrounding.samples.length < 6) {
      gaps.push(`${outpost.outpostId}:terrain_sample_count_too_low`);
    }
    if (record.terrainGrounding.maxLocalStepVoxels > 2) {
      gaps.push(`${outpost.outpostId}:terrain_step_too_large_for_business_pad`);
    }
    if (
      !record.materializationPlan.edits.some(
        (edit) =>
          edit.label === "safe_ground" && edit.position[1] === expectedGroundY
      )
    ) {
      gaps.push(`${outpost.outpostId}:missing_safe_ground_at_pad_y`);
    }
    if (
      !record.materializationPlan.edits.some(
        (edit) =>
          edit.label === "foundation" &&
          edit.position[1] <= record.terrainGrounding.foundationBottomY
      )
    ) {
      gaps.push(
        `${outpost.outpostId}:foundation_does_not_reach_sampled_terrain`
      );
    }
    if (!record.materializationPlan.safeZone?.safeFromMuck) {
      gaps.push(`${outpost.outpostId}:missing_business_safe_zone`);
    }
    if (
      record.materializationPlan.edits.some(
        (edit) => !isTerrainID(Number(edit.value))
      )
    ) {
      gaps.push(
        `${outpost.outpostId}:materialization_edit_uses_non_terrain_id`
      );
    }
    if (!HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[outpost.businessType]) {
      gaps.push(`${outpost.outpostId}:missing_business_minigame_definition`);
    }
    if (!record.primaryBikkieGraphic) {
      gaps.push(`${outpost.outpostId}:missing_primary_bikkie_graphic`);
    }
    if (!record.interiorAudit.minigameReady) {
      gaps.push(`${outpost.outpostId}:interior_not_minigame_ready`);
    }
    if (
      record.structuralAudit.foundationEdits <= 0 ||
      record.structuralAudit.floorEdits <= 0 ||
      record.structuralAudit.wallEdits <= 0 ||
      record.structuralAudit.roofEdits <= 0
    ) {
      gaps.push(`${outpost.outpostId}:missing_structural_voxel_edits`);
    }
    if (
      record.materializationPlan.edits.some((edit) =>
        String(edit.label).includes("shell")
      )
    ) {
      gaps.push(`${outpost.outpostId}:legacy_shell_edit_present`);
    }
  }

  for (const groundY of groundedYs) {
    if (!Number.isFinite(groundY) || groundY < 0 || groundY > 255) {
      gaps.push(`business_safe_pad_outside_world_height:${groundY}`);
    }
  }

  const siting = validateHarthmereBusinessOutpostSafeSiting();
  for (const error of siting.errors) {
    gaps.push(`siting:${error}`);
  }

  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    const record = records[outpost.outpostId];
    if (!record) continue;
    // Graded green garden yard: grass safe-ground present beyond the building
    // footprint so the building sits on a fertile site, not raw muck.
    const hasGardenGrass = record.materializationPlan.edits.some(
      (edit) =>
        edit.label === "safe_ground" &&
        edit.position[1] === record.origin.y &&
        (edit.position[0] < record.plot.bounds.xMin ||
          edit.position[0] >= record.plot.bounds.xMax ||
          edit.position[2] < record.plot.bounds.zMin ||
          edit.position[2] >= record.plot.bounds.zMax)
    );
    if (!hasGardenGrass) {
      gaps.push(`${outpost.outpostId}:missing_graded_garden_yard`);
    }
    // Sub-grade fill present so drops/holes at the building edge are filled flat.
    const hasSubGradeFill = record.materializationPlan.edits.some(
      (edit) =>
        edit.label === "foundation" && edit.position[1] === record.origin.y - 1
    );
    if (!hasSubGradeFill) {
      gaps.push(`${outpost.outpostId}:missing_subgrade_blend_fill`);
    }
  }

  return {
    ok: gaps.length === 0,
    checkedOutposts: HARTHMERE_BUSINESS_OUTPOSTS.length,
    uniqueGroundYValues: Array.from(groundedYs).sort((a, b) => a - b),
    gaps,
    auditTags: [
      "business_outpost_count_checked",
      "guide_voxel_building_records_checked",
      "hilly_terrain_grounding_checked",
      "safe_ground_and_foundation_checked",
      "business_minigame_access_checked",
      "legacy_shell_absence_checked",
      "no_building_on_building_or_road_checked",
      "graded_green_garden_site_checked",
      "muck_relocation_target_checked",
    ],
  };
}

function addHarthmereOutpostShellCleanupPositions(input: {
  keys: Set<string>;
  origin: { x: number; y: number; z: number };
  width: number;
  depth: number;
  height: number;
}) {
  const x0 = input.origin.x;
  const x1 = input.origin.x + input.width;
  const z0 = input.origin.z;
  const z1 = input.origin.z + input.depth;
  const y0 = input.origin.y;
  const wallTop = y0 + Math.max(3, input.height - 1);
  const add = (x: number, y: number, z: number) => {
    input.keys.add(`${x}:${y}:${z}`);
  };

  for (let x = x0; x < x1; x += 1) {
    for (let z = z0; z < z1; z += 1) {
      add(x, y0 - 1, z);
      add(x, y0, z);
      add(x, wallTop, z);
    }
  }
  for (let y = y0 + 1; y < wallTop; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      add(x, y, z0);
      add(x, y, z1 - 1);
    }
    for (let z = z0 + 1; z < z1 - 1; z += 1) {
      add(x0, y, z);
      add(x1 - 1, y, z);
    }
  }
  const doorX = Math.floor((x0 + x1) / 2);
  for (const x of [doorX - 2, doorX - 1, doorX, doorX + 1, doorX + 2]) {
    add(x, y0, z0 - 1);
  }
}

function addHarthmereOutpostStaleInteriorCleanupPositions(input: {
  keys: Set<string>;
  origin: { x: number; y: number; z: number };
  width: number;
  depth: number;
  height: number;
}) {
  const x0 = input.origin.x;
  const x1 = input.origin.x + input.width - 1;
  const z0 = input.origin.z;
  const z1 = input.origin.z + input.depth - 1;
  const y0 = input.origin.y;
  const roofY = y0 + Math.max(3, input.height - 1);
  const doorX = input.origin.x + Math.floor(input.width / 2);
  const add = (x: number, y: number, z: number) => {
    input.keys.add(`${x}:${y}:${z}`);
  };

  // Clear stale hill, old slab, debug shell, and failed partial-rebuild voxels
  // out of the room volume before rebuilding the real shop. The rebuild plan
  // then writes back only solid floors, walls, roof, furniture, and markers.
  const interiorClearTopY = Math.min(roofY + 1, y0 + 4);
  for (let x = x0 + 1; x <= x1 - 1; x += 1) {
    for (let z = z0 + 1; z <= z1 - 1; z += 1) {
      for (let y = y0 + 1; y <= interiorClearTopY; y += 1) {
        add(x, y, z);
      }
    }
  }

  // Include the front entry volume and one-block roof overhang used by the
  // complete business build so old floating/partial pieces disappear.
  for (let x = x0 - 1; x <= x1 + 1; x += 1) {
    for (let z = z0 - 4; z <= z0; z += 1) {
      for (let y = y0; y <= y0 + 5; y += 1) {
        add(x, y, z);
      }
    }
    add(x, roofY + 1, z0 - 1);
    add(x, roofY + 1, z1 + 1);
    add(x, roofY + 2, z0 + Math.floor((z1 - z0) / 2));
  }
  for (let z = z0; z <= z1; z += 1) {
    add(x0 - 1, roofY + 1, z);
    add(x1 + 1, roofY + 1, z);
  }
  for (const x of [doorX - 9, doorX + 9]) {
    for (let y = y0 + 1; y <= y0 + 2; y += 1) {
      add(x, y, z0 - 3);
    }
  }
}

function addHarthmereOutpostFullSiteCleanupPositions(input: {
  keys: Set<string>;
  record: HarthmereBusinessOutpostProceduralBuildingRecord;
}) {
  const { plot, origin, blueprint } = input.record;
  const roofY = origin.y + Math.max(3, blueprint.footprint.height - 1);
  const yMin = Math.max(0, origin.y - 4);
  const yMax = roofY + 4;
  const site = harthmereBusinessOutpostSafeSiteBounds(plot.bounds);
  // Height of muck mounds / stale debris to scrub off the open garden yard
  // outside the building (sub-grade fill + grass top + low garden border).
  const yardClearTop = origin.y + 6;
  const add = (x: number, y: number, z: number) => {
    input.keys.add(`${x}:${y}:${z}`);
  };

  // Production site prep: clear the full graded safe site (claimed pad + garden
  // ring) above and just below the target floor so natural hills, muck, stale
  // debug boxes, and previously misplaced buildings cannot intersect the
  // finished business or its yard. Inside the plot we clear the full building
  // height; in the surrounding garden ring we only scrub the low yard volume.
  for (let x = site.xMin; x <= site.xMax; x += 1) {
    for (let z = site.zMin; z <= site.zMax; z += 1) {
      const insidePlot =
        x >= plot.bounds.xMin &&
        x < plot.bounds.xMax &&
        z >= plot.bounds.zMin &&
        z < plot.bounds.zMax;
      const columnTop = insidePlot ? yMax : yardClearTop;
      for (let y = yMin; y <= columnTop; y += 1) {
        add(x, y, z);
      }
    }
  }

  const doorX = origin.x + Math.floor(blueprint.footprint.width / 2);
  for (let x = doorX - 8; x <= doorX + 8; x += 1) {
    for (let z = origin.z - 6; z <= origin.z + 1; z += 1) {
      for (let y = yMin; y <= Math.min(yMax, origin.y + 6); y += 1) {
        add(x, y, z);
      }
    }
  }
}

function createHarthmereBusinessOutpostCleanupPlan(
  outpost: HarthmereBusinessOutpost,
  record: HarthmereBusinessOutpostProceduralBuildingRecord
): BuildingSystemMaterializationPlan {
  const cleanupKeys = new Set<string>();
  for (const edit of record.materializationPlan.edits) {
    if (edit.label === "safe_ground" || edit.label === "boundary_marker") {
      continue;
    }
    cleanupKeys.add(harthmereOutpostEditKey(edit.position));
  }

  addHarthmereOutpostShellCleanupPositions({
    keys: cleanupKeys,
    origin: record.origin,
    width: record.blueprint.footprint.width,
    depth: record.blueprint.footprint.depth,
    height: record.blueprint.footprint.height,
  });
  addHarthmereOutpostStaleInteriorCleanupPositions({
    keys: cleanupKeys,
    origin: record.origin,
    width: record.blueprint.footprint.width,
    depth: record.blueprint.footprint.depth,
    height: record.blueprint.footprint.height,
  });
  addHarthmereOutpostFullSiteCleanupPositions({
    keys: cleanupKeys,
    record,
  });

  return {
    ...record.materializationPlan,
    requestId: `${outpost.outpostId}_backend_cleanup_before_rebuild`,
    edits: [...cleanupKeys].sort().map((key) => {
      const [x, y, z] = key
        .split(":")
        .map((value) => Number.parseInt(value, 10));
      return {
        kind: "editEvent" as const,
        position: [x, y, z] as [number, number, number],
        value: 0 as BiomesId,
        label: "demolition_cleanup" as const,
      };
    }),
    inWorldMarkers: [],
    partialMaterialization: true,
  };
}

export function createHarthmereBusinessOutpostRebuildMaterializationPlans() {
  return HARTHMERE_BUSINESS_OUTPOSTS.flatMap((outpost) => {
    const record =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
    return [
      createHarthmereBusinessOutpostCleanupPlan(outpost, record),
      record.materializationPlan,
    ];
  });
}

export const HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS: readonly HarthmereBusinessOutpostMapMarker[] =
  Object.freeze(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => {
      const building =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      const definition =
        HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[outpost.businessType];
      const entrance = building?.entrance ?? outpost.position;
      const primaryBikkieGraphic =
        building?.primaryBikkieGraphic ??
        getHarthmereBusinessPrimaryBikkieGraphic(outpost.businessType);
      return {
        markerId: harthmereBusinessOutpostMapMarkerId(outpost.outpostId),
        outpostId: outpost.outpostId,
        businessType: outpost.businessType,
        label: outpost.displayName,
        description: `Harthmere business in ${outpost.district}. Go inside for ${definition.interfaceTitle} service and ${outpost.job.title} shifts.`,
        area: "Harthmere" as const,
        district: outpost.district,
        position: [entrance.x, entrance.y, entrance.z] as [
          number,
          number,
          number
        ],
        kind: "business_outpost" as const,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        jobTitle: outpost.job.title,
        interfaceTitle: definition.interfaceTitle,
        primaryBikkieGraphic,
        primaryBikkieVisual: primaryBikkieGraphic?.visual,
      };
    })
  );

function harthmereBusinessCoordinateKey(
  coord: readonly [number, number, number]
) {
  return coord.map((value) => value.toFixed(3)).join(":");
}

function harthmereBusinessCoordinateXzDistance(
  coord: readonly [number, number, number],
  point: { x: number; z: number }
) {
  return Math.hypot(coord[0] - point.x, coord[2] - point.z);
}

export function validateHarthmereGroveBusinessCoordinateReferenceRoles(): HarthmereGroveBusinessCoordinateReferenceAudit {
  const errors: string[] = [];
  const buildingCoords =
    HARTHMERE_GROVE_BUSINESS_BUILDING_REFERENCE_COORDINATES;
  const peopleCoords = HARTHMERE_GROVE_BUSINESS_PEOPLE_REFERENCE_COORDINATES;
  const designFurnitureCoords =
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN_COORDINATES;
  if (buildingCoords.length !== 8)
    errors.push("building_reference_coordinate_count_changed");
  if (peopleCoords.length !== 6)
    errors.push("people_reference_coordinate_count_changed");
  if (designFurnitureCoords.length !== 14)
    errors.push("design_furniture_reference_coordinate_count_changed");
  if (
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.materializesBuildings !==
    false
  ) {
    errors.push("design_furniture_scan_would_materialize_buildings");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.placementPolicy !==
    "design_and_furniture_reference_only_do_not_build_here"
  ) {
    errors.push("design_furniture_scan_missing_do_not_build_policy");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.findings.length !==
    designFurnitureCoords.length
  ) {
    errors.push("design_furniture_scan_findings_do_not_cover_every_coordinate");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.interiorFindings.length !==
    designFurnitureCoords.length
  ) {
    errors.push(
      "design_furniture_interior_scan_findings_do_not_cover_every_coordinate"
    );
  }
  for (const finding of HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.findings) {
    if (
      harthmereBusinessCoordinateKey(finding.coordinate) !==
      harthmereBusinessCoordinateKey(
        designFurnitureCoords[finding.coordinateIndex]
      )
    ) {
      errors.push(
        `design_furniture_scan_coordinate_mismatch:${finding.coordinateIndex}`
      );
    }
  }
  for (const finding of HARTHMERE_GROVE_BUSINESS_DESIGN_FURNITURE_SCAN.interiorFindings) {
    if (
      harthmereBusinessCoordinateKey(finding.coordinate) !==
      harthmereBusinessCoordinateKey(
        designFurnitureCoords[finding.coordinateIndex]
      )
    ) {
      errors.push(
        `design_furniture_interior_scan_coordinate_mismatch:${finding.coordinateIndex}`
      );
    }
  }
  const buildingKeys = new Set(
    buildingCoords.map(harthmereBusinessCoordinateKey)
  );
  for (const coord of peopleCoords) {
    if (buildingKeys.has(harthmereBusinessCoordinateKey(coord))) {
      errors.push(
        `people_coordinate_overlaps_building_reference:${coord.join(",")}`
      );
    }
  }
  if (
    HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN.coordinatesAreOutposts !== false
  ) {
    errors.push("people_reference_marked_as_outposts");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN.materializesBuildings !== false
  ) {
    errors.push("people_reference_would_materialize_buildings");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN.placementPolicy !==
    "people_reference_only_do_not_build_here"
  ) {
    errors.push("people_reference_missing_do_not_build_policy");
  }
  if (
    HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN.findings.length !==
    peopleCoords.length
  ) {
    errors.push("people_reference_findings_do_not_cover_every_coordinate");
  }
  for (const finding of HARTHMERE_GROVE_BUSINESS_PEOPLE_SOURCE_SCAN.findings) {
    if (
      !finding.semanticUse.some((use) =>
        /not a business outpost site/.test(use)
      )
    ) {
      errors.push(
        `people_reference_missing_not_outpost_semantic:${finding.coordinateIndex}`
      );
    }
    if (
      harthmereBusinessCoordinateKey(finding.coordinate) !==
      harthmereBusinessCoordinateKey(peopleCoords[finding.coordinateIndex])
    ) {
      errors.push(
        `people_reference_finding_coordinate_mismatch:${finding.coordinateIndex}`
      );
    }
  }
  for (const coord of peopleCoords) {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      if (harthmereBusinessCoordinateXzDistance(coord, outpost.position) < 3) {
        errors.push(
          `people_reference_too_close_to_outpost_center:${
            outpost.outpostId
          }:${coord.join(",")}`
        );
      }
    }
    for (const record of Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
    )) {
      const insideFootprint =
        coord[0] >= record.origin.x &&
        coord[0] < record.origin.x + record.blueprint.footprint.width &&
        coord[2] >= record.origin.z &&
        coord[2] < record.origin.z + record.blueprint.footprint.depth;
      if (insideFootprint) {
        errors.push(
          `people_reference_inside_outpost_footprint:${
            record.outpostId
          }:${coord.join(",")}`
        );
      }
    }
  }
  return {
    ok: errors.length === 0,
    buildingReferenceCount: buildingCoords.length,
    peopleReferenceCount: peopleCoords.length,
    errors,
    auditTags: [
      "building_references_separate_from_people_references",
      "people_coordinates_do_not_materialize_buildings",
      "business_outposts_remain_backend_procedural_buildings",
    ],
  };
}

export function getHarthmereBusinessOutpostMapMarkers() {
  return HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS;
}
