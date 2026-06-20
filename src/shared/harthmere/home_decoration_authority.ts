import type {
  BuildingSystemDecorationMaterializationPlan,
  BuildingSystemPlotUse,
  BuildingSystemPropertyRecord,
  BuildingSystemVoxelEditSpec,
} from "./building_system";
import {
  BUILDING_SYSTEM_TERRAIN_BLOCKS,
  BUILDING_SYSTEM_VERSION,
  BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION,
  buildingSystemDefaultOrigin,
  buildingSystemBlueprintById,
  buildingSystemPlotById,
  createBuildingSystemGuideConstructionMath,
} from "./building_system";
import {
  HARTHMERE_CRAFTING_STATIONS,
  HARTHMERE_CRAFTING_TOOLS,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS,
  HARTHMERE_HOME_DECORATION_ITEM_IDS,
  ensureHarthmereProductionCraftingCatalogue,
} from "./mmo_crafting_catalogue";
import { getHarthmereCraftingStation } from "./mmo_inventory_authority";
import {
  HARTHMERE_NEW_PLACEABLE_DECOR_SPECS,
  type HarthmereDecorKind,
} from "./mmo_placeable_decor_catalogue";

export const HARTHMERE_HOME_DECORATION_AUTHORITY_VERSION =
  "harthmere-home-decoration-authority" as const;
export const HARTHMERE_HOME_DECORATION_GUIDE_PLACEMENT_VERSION =
  "harthmere-home-decoration-guide-placement" as const;

export type HarthmereHomeDecorationKind =
  | "crafting_station"
  | "storage"
  | "utility"
  | "lighting"
  | "comfort"
  | "garden"
  | "business_counter";

export interface HarthmereHomeDecorationFootprint {
  width: number;
  depth: number;
  height: number;
}

export interface HarthmereHomeDecorationFunctionalEffects {
  craftingStationId?: string;
  storageSlots?: number;
  comfort?: number;
  customerAppeal?: number;
  safety?: number;
  sanitation?: number;
  powerMegawatts?: number;
  gardenSlots?: number;
  lighting?: number;
}

export interface HarthmereHomeDecorationGuidePlacement {
  version: typeof HARTHMERE_HOME_DECORATION_GUIDE_PLACEMENT_VERSION;
  constructionRulesVersion: typeof BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION;
  support: "floor" | "wall" | "counter" | "garden_soil";
  snap: "voxel_floor_grid";
  keepDoorAisleClearBlocks: number;
  keepExitClearBlocks: number;
  allowOverlap: boolean;
}

export interface HarthmereHomeDecorationDefinition {
  itemId: string;
  displayName: string;
  kind: HarthmereHomeDecorationKind;
  allowedPropertyUses: readonly BuildingSystemPlotUse[];
  footprint: HarthmereHomeDecorationFootprint;
  functionalEffects: HarthmereHomeDecorationFunctionalEffects;
  placementTags: readonly string[];
  guidePlacement: HarthmereHomeDecorationGuidePlacement;
}

export interface HarthmereHomeDecorationPosition {
  x: number;
  y: number;
  z: number;
}

export interface HarthmereHomeDecorationGardenState {
  seedItemId: string;
  cropItemId: string;
  cropCount: number;
  plantedAtMs: number;
  growDurationMs: number;
  wateredAtMs?: number;
  readyAtMs?: number;
}

export interface HarthmereHomeDecorationRecord {
  decorationId: string;
  propertyId: string;
  ownerId: string;
  itemId: string;
  displayName: string;
  kind: HarthmereHomeDecorationKind;
  position: HarthmereHomeDecorationPosition;
  rotationDegrees: 0 | 90 | 180 | 270;
  condition: number;
  installedAtMs: number;
  updatedAtMs: number;
  powered: boolean;
  garden?: HarthmereHomeDecorationGardenState;
}

export interface HarthmereHomeDecorationPropertySummary {
  propertyId: string;
  storageSlotsBonus: number;
  comfort: number;
  customerAppeal: number;
  safety: number;
  sanitation: number;
  powerMegawatts: number;
  gardenSlots: number;
  lighting: number;
  craftingStationIds: string[];
  activeDecorations: number;
}

export interface HarthmereHomeDecorationState {
  placed: Record<string, HarthmereHomeDecorationRecord>;
  nextDecorationNumber: number;
  propertySummaries: Record<string, HarthmereHomeDecorationPropertySummary>;
  appliedRequestIds: Record<string, number>;
}

export type HarthmereHomeDecorationOperation =
  | "place_decoration"
  | "move_decoration"
  | "remove_decoration"
  | "use_decoration"
  | "plant_garden"
  | "water_garden"
  | "harvest_garden";

export interface HarthmereHomeDecorationMutationRequest {
  requestId: string;
  actorId: string;
  operation: HarthmereHomeDecorationOperation;
  propertyId?: string;
  decorationId?: string;
  itemId?: string;
  seedItemId?: string;
  position?: Partial<HarthmereHomeDecorationPosition>;
  rotationDegrees?: number;
  nowMs: number;
}

export interface HarthmereHomeDecorationMutationContext {
  properties: Record<
    string,
    Pick<
      BuildingSystemPropertyRecord,
      | "propertyId"
      | "plotId"
      | "blueprintId"
      | "ownerId"
      | "use"
      | "tier"
      | "status"
      | "abandoned"
      | "origin"
      | "rotationDegrees"
    >
  >;
  actorInventoryItems: Record<string, number>;
}

export interface HarthmereHomeDecorationMutationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  state: HarthmereHomeDecorationState;
  itemDeltas: Record<string, number>;
  touchedModels: string[];
  openedStationId?: string;
  functionalSummary?: HarthmereHomeDecorationFunctionalEffects;
  harvestedItemId?: string;
  harvestedCount?: number;
  materializationPlans?: BuildingSystemDecorationMaterializationPlan[];
}

export type HarthmereHomeConsoleAccessReason =
  | "available"
  | "missing_property"
  | "not_home_property"
  | "not_owner"
  | "property_unavailable"
  | "not_inside_home"
  | "console_not_nearby";

export interface HarthmereHomeConsoleAccessContext {
  actorId: string;
  insideHome?: boolean;
  nearbyConsoleId?: string | null;
  requireNearbyConsole?: boolean;
}

export interface HarthmereHomeConsoleAccessResult {
  ok: boolean;
  reason: HarthmereHomeConsoleAccessReason;
}

const DECORATION_BASE_LIMIT = 24;
const DECORATION_LIMIT_PER_PROPERTY_TIER = 4;
const GARDEN_GROW_DURATION_MS = 60_000;
const DECORATION_MAX_ABS_POSITION = 100_000;
const DECORATION_IDEMPOTENCY_LIMIT = 256;

function guidePlacementForDecorationKind(
  kind: HarthmereHomeDecorationKind,
  placementTags: readonly string[]
): HarthmereHomeDecorationGuidePlacement {
  return {
    version: HARTHMERE_HOME_DECORATION_GUIDE_PLACEMENT_VERSION,
    constructionRulesVersion: BUILDING_SYSTEM_GUIDE_CONSTRUCTION_RULES_VERSION,
    support: kind === "garden"
      ? "garden_soil"
      : placementTags.includes("business")
        ? "counter"
        : "floor",
    snap: "voxel_floor_grid",
    keepDoorAisleClearBlocks: 2,
    keepExitClearBlocks: 2,
    allowOverlap: false,
  };
}

const STATION_DECORATION_IDS = [
  HARTHMERE_CRAFTING_STATIONS.workbench,
  HARTHMERE_CRAFTING_STATIONS.thermolite,
  HARTHMERE_CRAFTING_STATIONS.thermoblaster,
  HARTHMERE_CRAFTING_STATIONS.kitchen,
  HARTHMERE_CRAFTING_STATIONS.tailoringBooth,
  HARTHMERE_CRAFTING_STATIONS.seedMill,
  HARTHMERE_CRAFTING_STATIONS.anglersTable,
  HARTHMERE_CRAFTING_STATIONS.composter,
  HARTHMERE_CRAFTING_STATIONS.dyeOMatic,
] as const;

const GARDEN_SEED_DEFS: Record<
  string,
  { cropItemId: string; cropCount: number; growDurationMs: number }
> = {
  grain_seed: {
    cropItemId: "rough_herb",
    cropCount: 2,
    growDurationMs: GARDEN_GROW_DURATION_MS,
  },
};

function parseSize(size?: string): HarthmereHomeDecorationFootprint {
  const [width, depth, height] = String(size ?? "1x1x1")
    .split("x")
    .map((part) => Math.max(1, Math.floor(Number(part) || 1)));
  return { width, depth, height };
}

type HarthmereHomeDecorationDefinitionSeed = Omit<
  HarthmereHomeDecorationDefinition,
  "guidePlacement"
>;

const BASE_DECORATION_DEFS: HarthmereHomeDecorationDefinitionSeed[] = [
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
    displayName: "Storage Cabinet",
    kind: "storage",
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    footprint: { width: 1, depth: 1, height: 2 },
    functionalEffects: { storageSlots: 8, comfort: 1 },
    placementTags: ["interior", "storage"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp,
    displayName: "Hearth Lamp",
    kind: "lighting",
    allowedPropertyUses: ["home", "business", "workshop", "guild"],
    footprint: { width: 1, depth: 1, height: 1 },
    functionalEffects: { comfort: 2, safety: 1, lighting: 1 },
    placementTags: ["interior", "light"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.gardenPlanterBox,
    displayName: "Garden Planter Box",
    kind: "garden",
    allowedPropertyUses: ["home", "business", "farm"],
    footprint: { width: 2, depth: 1, height: 1 },
    functionalEffects: { gardenSlots: 1, comfort: 1 },
    placementTags: ["exterior", "garden"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.businessServiceCounter,
    displayName: "Service Counter",
    kind: "business_counter",
    allowedPropertyUses: ["business", "workshop"],
    footprint: { width: 2, depth: 1, height: 1 },
    functionalEffects: { customerAppeal: 4, storageSlots: 2 },
    placementTags: ["interior", "business"],
  },
  {
    itemId: HARTHMERE_EXOTIC_MATTER_ITEM_IDS.utilityCore,
    displayName: "Utility Core",
    kind: "utility",
    allowedPropertyUses: [
      "home",
      "business",
      "workshop",
      "guild",
      "public_service",
    ],
    footprint: { width: 1, depth: 1, height: 2 },
    functionalEffects: { powerMegawatts: 100400, safety: 2 },
    placementTags: ["utility", "powered"],
  },
];

function withGuidePlacement(
  definition: HarthmereHomeDecorationDefinitionSeed
): HarthmereHomeDecorationDefinition {
  return {
    ...definition,
    guidePlacement: guidePlacementForDecorationKind(
      definition.kind,
      definition.placementTags
    ),
  };
}

function createStationDecorationDefinitions(): HarthmereHomeDecorationDefinition[] {
  ensureHarthmereProductionCraftingCatalogue();
  return STATION_DECORATION_IDS.map((stationId) => {
    const station = getHarthmereCraftingStation(stationId);
    return withGuidePlacement({
      itemId: stationId,
      displayName: station?.displayName ?? "Crafting Station",
      kind: "crafting_station",
      allowedPropertyUses: ["home", "business", "workshop"],
      footprint: parseSize(station?.size),
      functionalEffects: { craftingStationId: stationId },
      placementTags: ["interior", "workshop", "crafting"],
    });
  });
}

// HARTHMERE_PLACEABLE_DECOR: the craftable/buyable furniture & decor from the
// placeable-decor catalogue are also placeable on owned property. Their decor
// kind already mirrors HarthmereHomeDecorationKind, so the mapping is direct;
// placement tags are derived from the kind.
const PLACEABLE_DECOR_TAGS_BY_KIND: Record<HarthmereDecorKind, string[]> = {
  crafting_station: ["interior", "workshop", "crafting"],
  storage: ["interior", "storage"],
  utility: ["utility", "powered"],
  lighting: ["interior", "light"],
  comfort: ["interior", "comfort"],
  garden: ["exterior", "garden"],
  business_counter: ["interior", "business"],
};

function createPlaceableDecorDefinitions(): HarthmereHomeDecorationDefinition[] {
  return HARTHMERE_NEW_PLACEABLE_DECOR_SPECS.map((spec) =>
    withGuidePlacement({
      itemId: spec.itemId,
      displayName: spec.displayName,
      kind: spec.decorationKind,
      allowedPropertyUses:
        spec.allowedPropertyUses as readonly BuildingSystemPlotUse[],
      footprint: {
        width: spec.footprint.width,
        depth: spec.footprint.depth,
        height: spec.footprint.height,
      },
      functionalEffects:
        (spec.functionalEffects as HarthmereHomeDecorationFunctionalEffects) ??
        {},
      placementTags: PLACEABLE_DECOR_TAGS_BY_KIND[spec.decorationKind],
    })
  );
}

export function listHarthmereHomeDecorationDefinitions(): HarthmereHomeDecorationDefinition[] {
  return [
    ...createStationDecorationDefinitions(),
    ...BASE_DECORATION_DEFS.map(withGuidePlacement),
    ...createPlaceableDecorDefinitions(),
  ];
}

export function getHarthmereHomeDecorationDefinition(itemId: string) {
  return listHarthmereHomeDecorationDefinitions().find(
    (definition) => definition.itemId === itemId
  );
}

export function listHarthmereHomeDecorationGardenSeeds() {
  return Object.entries(GARDEN_SEED_DEFS).map(([seedItemId, seed]) => ({
    seedItemId,
    cropItemId: seed.cropItemId,
    cropCount: seed.cropCount,
    growDurationMs: seed.growDurationMs,
  }));
}

export function defaultHarthmereHomeDecorationState(): HarthmereHomeDecorationState {
  return {
    placed: {},
    nextDecorationNumber: 1,
    propertySummaries: {},
    appliedRequestIds: {},
  };
}

function cloneState(
  state: HarthmereHomeDecorationState
): HarthmereHomeDecorationState {
  const placed: Record<string, HarthmereHomeDecorationRecord> = {};
  for (const [decorationId, record] of Object.entries(state.placed ?? {})) {
    placed[decorationId] = {
      ...record,
      position: { ...record.position },
      garden: record.garden ? { ...record.garden } : undefined,
    };
  }
  return {
    placed,
    nextDecorationNumber: Math.max(
      1,
      Math.floor(Number(state.nextDecorationNumber) || 1)
    ),
    propertySummaries: { ...(state.propertySummaries ?? {}) },
    appliedRequestIds: { ...(state.appliedRequestIds ?? {}) },
  };
}

export function normalizeHarthmereHomeDecorationState(
  raw: unknown
): HarthmereHomeDecorationState {
  if (!raw || typeof raw !== "object") {
    return defaultHarthmereHomeDecorationState();
  }
  const input = raw as Partial<HarthmereHomeDecorationState>;
  const state = cloneState({
    placed: input.placed ?? {},
    nextDecorationNumber: input.nextDecorationNumber ?? 1,
    propertySummaries: {},
    appliedRequestIds: input.appliedRequestIds ?? {},
  });
  for (const [decorationId, record] of Object.entries(state.placed)) {
    if (
      !record.propertyId ||
      !record.ownerId ||
      !record.itemId ||
      !record.displayName ||
      !record.kind
    ) {
      delete state.placed[decorationId];
      continue;
    }
    record.condition = Math.max(0, Math.min(1, Number(record.condition) || 1));
    record.rotationDegrees = normalizeRotation(record.rotationDegrees);
    record.position = normalizePosition(record.position);
  }
  recomputeHarthmereHomeDecorationSummaries(state);
  return state;
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  const rotation = Math.round(Number(value) || 0);
  if (rotation === 90 || rotation === 180 || rotation === 270) return rotation;
  return 0;
}

function normalizePosition(
  position: Partial<HarthmereHomeDecorationPosition> | undefined
): HarthmereHomeDecorationPosition {
  return {
    x: Number.isFinite(Number(position?.x)) ? Number(position?.x) : 0,
    y: Number.isFinite(Number(position?.y)) ? Number(position?.y) : 0,
    z: Number.isFinite(Number(position?.z)) ? Number(position?.z) : 0,
  };
}

function requestedPositionIsValid(
  position: Partial<HarthmereHomeDecorationPosition> | undefined
) {
  if (!position) return true;
  for (const coordinate of [position.x, position.y, position.z]) {
    if (coordinate === undefined) continue;
    const numeric = Number(coordinate);
    if (
      !Number.isFinite(numeric) ||
      Math.abs(numeric) > DECORATION_MAX_ABS_POSITION
    ) {
      return false;
    }
  }
  return true;
}

function hasRequestedPosition(
  position: Partial<HarthmereHomeDecorationPosition> | undefined
) {
  return (
    position !== undefined &&
    (position.x !== undefined || position.y !== undefined || position.z !== undefined)
  );
}

function rotatedDecorationFootprint(
  footprint: HarthmereHomeDecorationFootprint,
  rotationDegrees: 0 | 90 | 180 | 270
) {
  return rotationDegrees === 90 || rotationDegrees === 270
    ? { width: footprint.depth, depth: footprint.width, height: footprint.height }
    : footprint;
}

function decorationRect(input: {
  position: HarthmereHomeDecorationPosition;
  footprint: HarthmereHomeDecorationFootprint;
  rotationDegrees: 0 | 90 | 180 | 270;
}) {
  const fp = rotatedDecorationFootprint(input.footprint, input.rotationDegrees);
  return {
    x0: input.position.x,
    z0: input.position.z,
    x1: input.position.x + fp.width,
    z1: input.position.z + fp.depth,
  };
}

function rectsOverlap(
  left: ReturnType<typeof decorationRect>,
  right: ReturnType<typeof decorationRect>
) {
  return (
    left.x0 < right.x1 &&
    left.x1 > right.x0 &&
    left.z0 < right.z1 &&
    left.z1 > right.z0
  );
}

function guideDecorationGridForProperty(
  property: Pick<
    BuildingSystemPropertyRecord,
    "plotId" | "blueprintId" | "origin" | "rotationDegrees"
  > | undefined
) {
  if (!property?.plotId || !property?.blueprintId) return undefined;
  const plot = buildingSystemPlotById(property.plotId);
  const blueprint = buildingSystemBlueprintById(property.blueprintId);
  if (!plot || !blueprint) return undefined;
  const guide = createBuildingSystemGuideConstructionMath({
    plot,
    blueprint,
    origin: property.origin ?? buildingSystemDefaultOrigin(plot, blueprint),
    rotationDegrees: property.rotationDegrees ?? 0,
  });
  return {
    guide,
    width: Math.max(1, guide.footprint.width - 2),
    depth: Math.max(1, guide.footprint.depth - 2),
    doorX: Math.max(
      0,
      Math.min(Math.max(0, guide.footprint.width - 3), guide.doorX - guide.x0 - 1)
    ),
    aisleDepth: Math.max(
      1,
      Math.min(3, Math.max(1, guide.footprint.depth - 2))
    ),
  };
}

function defaultGuideDecorationPosition(input: {
  definition: HarthmereHomeDecorationDefinition;
  property:
    | Pick<BuildingSystemPropertyRecord, "plotId" | "blueprintId" | "use">
    | undefined;
  rotationDegrees: 0 | 90 | 180 | 270;
}) {
  const grid = guideDecorationGridForProperty(input.property);
  if (!grid) return { x: 0, y: 0, z: 0 };
  const fp = rotatedDecorationFootprint(
    input.definition.footprint,
    input.rotationDegrees
  );
  const maxX = Math.max(0, grid.width - fp.width);
  const maxZ = Math.max(0, grid.depth - fp.depth);
  if (input.definition.kind === "business_counter") {
    return { x: Math.floor(maxX / 2), y: 0, z: maxZ };
  }
  if (input.definition.kind === "crafting_station" || input.definition.kind === "utility") {
    return { x: maxX, y: 0, z: maxZ };
  }
  if (input.definition.kind === "storage") {
    return { x: 0, y: 0, z: maxZ };
  }
  if (input.definition.kind === "lighting") {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: 0, y: 0, z: maxZ };
}

export function validateHarthmereHomeDecorationGuidePlacement(input: {
  definition: HarthmereHomeDecorationDefinition;
  state: HarthmereHomeDecorationState;
  property:
    | Pick<
        BuildingSystemPropertyRecord,
        "propertyId" | "plotId" | "blueprintId" | "use"
      >
    | undefined;
  position: HarthmereHomeDecorationPosition;
  rotationDegrees: 0 | 90 | 180 | 270;
  ignoreDecorationId?: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (
    !Number.isInteger(input.position.x) ||
    !Number.isInteger(input.position.y) ||
    !Number.isInteger(input.position.z)
  ) {
    errors.push("decoration_off_voxel_grid");
  }
  if (
    input.definition.guidePlacement.support !== "wall" &&
    input.position.y !== 0
  ) {
    errors.push("decoration_not_on_floor");
  }
  const rect = decorationRect({
    position: input.position,
    footprint: input.definition.footprint,
    rotationDegrees: input.rotationDegrees,
  });
  const grid = guideDecorationGridForProperty(input.property);
  if (grid && input.definition.guidePlacement.support !== "garden_soil") {
    if (
      rect.x0 < 0 ||
      rect.z0 < 0 ||
      rect.x1 > grid.width ||
      rect.z1 > grid.depth
    ) {
      errors.push("decoration_outside_guide_interior");
    }
    if (
      rect.z0 < grid.aisleDepth &&
      rect.x0 <= grid.doorX &&
      rect.x1 > grid.doorX
    ) {
      errors.push("decoration_blocks_guide_clearance");
    }
  }
  if (!input.definition.guidePlacement.allowOverlap) {
    for (const record of Object.values(input.state.placed)) {
      if (
        record.propertyId !== input.property?.propertyId ||
        record.decorationId === input.ignoreDecorationId
      ) {
        continue;
      }
      const existingDefinition = getHarthmereHomeDecorationDefinition(record.itemId);
      if (!existingDefinition) continue;
      const existingRect = decorationRect({
        position: record.position,
        footprint: existingDefinition.footprint,
        rotationDegrees: record.rotationDegrees,
      });
      if (rectsOverlap(rect, existingRect)) {
        errors.push("decoration_overlaps_existing");
        break;
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function homeDecorationTerrainValue(
  definition: HarthmereHomeDecorationDefinition
) {
  if (definition.kind === "storage") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.woodCrate;
  }
  if (definition.kind === "business_counter") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber;
  }
  if (definition.kind === "lighting") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass;
  }
  if (definition.kind === "garden") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.hay;
  }
  if (definition.kind === "utility") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass;
  }
  if (definition.kind === "comfort") {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.oakLumber;
  }
  const stationId = definition.functionalEffects.craftingStationId ?? definition.itemId;
  if (stationId === HARTHMERE_CRAFTING_STATIONS.kitchen) {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.stoneBrick;
  }
  if (
    stationId === HARTHMERE_CRAFTING_STATIONS.thermolite ||
    stationId === HARTHMERE_CRAFTING_STATIONS.thermoblaster
  ) {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.simpleGlass;
  }
  if (
    stationId === HARTHMERE_CRAFTING_STATIONS.seedMill ||
    stationId === HARTHMERE_CRAFTING_STATIONS.composter
  ) {
    return BUILDING_SYSTEM_TERRAIN_BLOCKS.woodCrate;
  }
  return BUILDING_SYSTEM_TERRAIN_BLOCKS.stonePolished;
}

function homeDecorationVoxelLabel(
  definition: HarthmereHomeDecorationDefinition
): BuildingSystemVoxelEditSpec["label"] {
  if (definition.kind === "storage") return "storage_container";
  if (definition.kind === "business_counter") return "business_marker";
  return "interior";
}

function homeDecorationWorldVoxels(input: {
  property: Pick<
    BuildingSystemPropertyRecord,
    "plotId" | "blueprintId" | "origin" | "rotationDegrees"
  >;
  definition: HarthmereHomeDecorationDefinition;
  record: Pick<
    HarthmereHomeDecorationRecord,
    "position" | "rotationDegrees"
  >;
}) {
  const plot = buildingSystemPlotById(input.property.plotId);
  const blueprint = buildingSystemBlueprintById(input.property.blueprintId);
  if (!plot || !blueprint) return [];
  const origin =
    input.property.origin ?? buildingSystemDefaultOrigin(plot, blueprint);
  const guide = createBuildingSystemGuideConstructionMath({
    plot,
    blueprint,
    origin,
    rotationDegrees: input.property.rotationDegrees ?? 0,
  });
  const footprint = rotatedDecorationFootprint(
    input.definition.footprint,
    input.record.rotationDegrees
  );
  const baseX = guide.x0 + 1 + input.record.position.x;
  const baseY = guide.y0 + 1 + input.record.position.y;
  const baseZ = guide.z0 + 1 + input.record.position.z;
  const positions: Array<[number, number, number]> = [];
  for (let x = 0; x < footprint.width; x += 1) {
    for (let y = 0; y < footprint.height; y += 1) {
      for (let z = 0; z < footprint.depth; z += 1) {
        positions.push([baseX + x, baseY + y, baseZ + z]);
      }
    }
  }
  return positions;
}

export function createHarthmereHomeDecorationMaterializationPlan(input: {
  requestId: string;
  actorId: string;
  property: Pick<
    BuildingSystemPropertyRecord,
    "propertyId" | "plotId" | "blueprintId" | "origin" | "rotationDegrees"
  >;
  definition: HarthmereHomeDecorationDefinition;
  record: HarthmereHomeDecorationRecord;
  operation: "place_decoration" | "move_decoration" | "remove_decoration";
  cleanup?: boolean;
}): BuildingSystemDecorationMaterializationPlan | undefined {
  const positions = homeDecorationWorldVoxels({
    property: input.property,
    definition: input.definition,
    record: input.record,
  });
  if (!positions.length) return undefined;
  const value: BuildingSystemVoxelEditSpec["value"] = input.cleanup
    ? (0 as BuildingSystemVoxelEditSpec["value"])
    : homeDecorationTerrainValue(input.definition);
  const label: BuildingSystemVoxelEditSpec["label"] = input.cleanup
    ? "demolition_cleanup"
    : homeDecorationVoxelLabel(input.definition);
  return {
    version: BUILDING_SYSTEM_VERSION,
    requestId: `${input.requestId}:${input.record.decorationId}:${input.cleanup ? "cleanup" : "materialize"}`,
    actorId: input.actorId,
    plotId: input.property.plotId,
    propertyId: input.property.propertyId,
    decorationId: input.record.decorationId,
    itemId: input.record.itemId,
    reason: "home_decoration_voxel_materialization",
    operation: input.operation,
    edits: positions.map((position) => ({
      kind: "editEvent" as const,
      position,
      value,
      label,
    })),
    materializesSolidVoxelBuilding: false,
  };
}

function propertyDecorationLimit(
  property: Pick<BuildingSystemPropertyRecord, "tier" | "use">
) {
  return (
    DECORATION_BASE_LIMIT +
    Math.max(0, Math.floor(Number(property.tier) || 0)) *
      DECORATION_LIMIT_PER_PROPERTY_TIER +
    (property.use === "business" ? 8 : 0)
  );
}

function actorCanDecorateProperty(
  property:
    | Pick<BuildingSystemPropertyRecord, "ownerId" | "status" | "abandoned">
    | undefined,
  actorId: string
) {
  return (
    !!property &&
    property.ownerId === actorId &&
    property.status !== "abandoned" &&
    property.status !== "demolished" &&
    !property.abandoned
  );
}

export function canAccessHarthmereHomeConsole(
  property:
    | Pick<
        BuildingSystemPropertyRecord,
        "ownerId" | "use" | "status" | "abandoned"
      >
    | undefined,
  context: HarthmereHomeConsoleAccessContext
): HarthmereHomeConsoleAccessResult {
  if (!property) return { ok: false, reason: "missing_property" };
  if (property.use !== "home") {
    return { ok: false, reason: "not_home_property" };
  }
  if (property.ownerId !== context.actorId) {
    return { ok: false, reason: "not_owner" };
  }
  if (
    property.status === "abandoned" ||
    property.status === "demolished" ||
    property.abandoned
  ) {
    return { ok: false, reason: "property_unavailable" };
  }
  if (!context.insideHome) return { ok: false, reason: "not_inside_home" };
  if (context.requireNearbyConsole && !context.nearbyConsoleId) {
    return { ok: false, reason: "console_not_nearby" };
  }
  return { ok: true, reason: "available" };
}

function addItemDelta(
  itemDeltas: Record<string, number>,
  itemId: string,
  count: number
) {
  itemDeltas[itemId] = (itemDeltas[itemId] ?? 0) + count;
  if (itemDeltas[itemId] === 0) {
    delete itemDeltas[itemId];
  }
}

function fail(
  state: HarthmereHomeDecorationState,
  error: string
): HarthmereHomeDecorationMutationResult {
  return {
    ok: false,
    errors: [error],
    warnings: [],
    state,
    itemDeltas: {},
    touchedModels: [],
  };
}

function markAppliedRequest(
  state: HarthmereHomeDecorationState,
  request: HarthmereHomeDecorationMutationRequest
) {
  state.appliedRequestIds[request.requestId] = request.nowMs;
  const entries = Object.entries(state.appliedRequestIds).sort(
    ([, left], [, right]) => left - right
  );
  while (entries.length > DECORATION_IDEMPOTENCY_LIMIT) {
    const [requestId] = entries.shift()!;
    delete state.appliedRequestIds[requestId];
  }
}

function ok(
  state: HarthmereHomeDecorationState,
  request: HarthmereHomeDecorationMutationRequest,
  itemDeltas: Record<string, number>,
  touchedModels: string[],
  extra: Partial<
    Omit<
      HarthmereHomeDecorationMutationResult,
      "ok" | "errors" | "warnings" | "state" | "itemDeltas" | "touchedModels"
    >
  > = {}
): HarthmereHomeDecorationMutationResult {
  markAppliedRequest(state, request);
  return {
    ok: true,
    errors: [],
    warnings: [],
    state,
    itemDeltas,
    touchedModels,
    ...extra,
  };
}

export function recomputeHarthmereHomeDecorationSummaries(
  state: HarthmereHomeDecorationState
) {
  const summaries: Record<string, HarthmereHomeDecorationPropertySummary> =
    {};
  for (const record of Object.values(state.placed)) {
    const definition = getHarthmereHomeDecorationDefinition(record.itemId);
    if (!definition) continue;
    const summary =
      summaries[record.propertyId] ??
      (summaries[record.propertyId] = {
        propertyId: record.propertyId,
        storageSlotsBonus: 0,
        comfort: 0,
        customerAppeal: 0,
        safety: 0,
        sanitation: 0,
        powerMegawatts: 0,
        gardenSlots: 0,
        lighting: 0,
        craftingStationIds: [],
        activeDecorations: 0,
      });
    const effects = definition.functionalEffects;
    summary.storageSlotsBonus += effects.storageSlots ?? 0;
    summary.comfort += effects.comfort ?? 0;
    summary.customerAppeal += effects.customerAppeal ?? 0;
    summary.safety += effects.safety ?? 0;
    summary.sanitation += effects.sanitation ?? 0;
    summary.powerMegawatts += effects.powerMegawatts ?? 0;
    summary.gardenSlots += effects.gardenSlots ?? 0;
    summary.lighting += effects.lighting ?? 0;
    if (
      effects.craftingStationId &&
      !summary.craftingStationIds.includes(effects.craftingStationId)
    ) {
      summary.craftingStationIds.push(effects.craftingStationId);
    }
    summary.activeDecorations += 1;
  }
  for (const summary of Object.values(summaries)) {
    summary.craftingStationIds.sort();
  }
  state.propertySummaries = summaries;
}

function nextDecorationId(
  state: HarthmereHomeDecorationState,
  propertyId: string
) {
  const number = state.nextDecorationNumber++;
  const safePropertyId = propertyId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `decor_${safePropertyId}_${number}`;
}

export function reduceHarthmereHomeDecorationMutation(
  current: HarthmereHomeDecorationState,
  request: HarthmereHomeDecorationMutationRequest,
  context: HarthmereHomeDecorationMutationContext
): HarthmereHomeDecorationMutationResult {
  const state = normalizeHarthmereHomeDecorationState(current);
  const itemDeltas: Record<string, number> = {};
  const touchedModels = ["home_decoration"];
  if (state.appliedRequestIds[request.requestId] !== undefined) {
    return {
      ok: true,
      errors: [],
      warnings: [],
      state,
      itemDeltas,
      touchedModels: [],
    };
  }

  switch (request.operation) {
    case "place_decoration": {
      const itemId = request.itemId;
      const propertyId = request.propertyId;
      if (!itemId) return fail(state, "missing_item_id");
      if (!propertyId) return fail(state, "missing_property_id");
      if (!requestedPositionIsValid(request.position)) {
        return fail(state, "invalid_decoration_position");
      }
      const definition = getHarthmereHomeDecorationDefinition(itemId);
      if (!definition) return fail(state, "decoration_not_supported");
      const property = context.properties[propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      if (!definition.allowedPropertyUses.includes(property.use)) {
        return fail(state, "decoration_not_allowed_for_property");
      }
      if ((context.actorInventoryItems[itemId] ?? 0) <= 0) {
        return fail(state, "missing_decoration_item");
      }
      const activeCount = Object.values(state.placed).filter(
        (record) => record.propertyId === propertyId
      ).length;
      if (activeCount >= propertyDecorationLimit(property)) {
        return fail(state, "decoration_limit_reached");
      }
      const rotationDegrees = normalizeRotation(request.rotationDegrees);
      const position = hasRequestedPosition(request.position)
        ? normalizePosition(request.position)
        : defaultGuideDecorationPosition({
            definition,
            property,
            rotationDegrees,
          });
      const guidePlacement = validateHarthmereHomeDecorationGuidePlacement({
        definition,
        state,
        property,
        position,
        rotationDegrees,
      });
      if (!guidePlacement.ok) {
        return fail(state, guidePlacement.errors[0] ?? "invalid_decoration_position");
      }
      const decorationId = nextDecorationId(state, propertyId);
      state.placed[decorationId] = {
        decorationId,
        propertyId,
        ownerId: request.actorId,
        itemId,
        displayName: definition.displayName,
        kind: definition.kind,
        position,
        rotationDegrees,
        condition: 1,
        installedAtMs: request.nowMs,
        updatedAtMs: request.nowMs,
        powered:
          definition.kind !== "utility" ||
          !!definition.functionalEffects.powerMegawatts,
      };
      const materializationPlan = createHarthmereHomeDecorationMaterializationPlan({
        requestId: request.requestId,
        actorId: request.actorId,
        property,
        definition,
        record: state.placed[decorationId],
        operation: "place_decoration",
      });
      addItemDelta(itemDeltas, itemId, -1);
      recomputeHarthmereHomeDecorationSummaries(state);
      return ok(state, request, itemDeltas, touchedModels, {
        functionalSummary: definition.functionalEffects,
        materializationPlans: materializationPlan ? [materializationPlan] : [],
      });
    }
    case "move_decoration": {
      const decorationId = request.decorationId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      if (!requestedPositionIsValid(request.position)) {
        return fail(state, "invalid_decoration_position");
      }
      const definition = getHarthmereHomeDecorationDefinition(record.itemId);
      if (!definition) return fail(state, "decoration_not_supported");
      const previousRecord: HarthmereHomeDecorationRecord = {
        ...record,
        position: { ...record.position },
        garden: record.garden ? { ...record.garden } : undefined,
      };
      const nextPosition = hasRequestedPosition(request.position)
        ? normalizePosition({ ...record.position, ...request.position })
        : record.position;
      const nextRotationDegrees = normalizeRotation(
        request.rotationDegrees ?? record.rotationDegrees
      );
      const guidePlacement = validateHarthmereHomeDecorationGuidePlacement({
        definition,
        state,
        property,
        position: nextPosition,
        rotationDegrees: nextRotationDegrees,
        ignoreDecorationId: decorationId,
      });
      if (!guidePlacement.ok) {
        return fail(state, guidePlacement.errors[0] ?? "invalid_decoration_position");
      }
      record.position = nextPosition;
      record.rotationDegrees = nextRotationDegrees;
      record.updatedAtMs = request.nowMs;
      recomputeHarthmereHomeDecorationSummaries(state);
      const cleanupPlan = createHarthmereHomeDecorationMaterializationPlan({
        requestId: request.requestId,
        actorId: request.actorId,
        property,
        definition,
        record: previousRecord,
        operation: "move_decoration",
        cleanup: true,
      });
      const materializationPlan = createHarthmereHomeDecorationMaterializationPlan({
        requestId: request.requestId,
        actorId: request.actorId,
        property,
        definition,
        record,
        operation: "move_decoration",
      });
      return ok(state, request, itemDeltas, touchedModels, {
        materializationPlans: [
          ...(cleanupPlan ? [cleanupPlan] : []),
          ...(materializationPlan ? [materializationPlan] : []),
        ],
      });
    }
    case "remove_decoration": {
      const decorationId = request.decorationId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      const definition = getHarthmereHomeDecorationDefinition(record.itemId);
      if (!definition) return fail(state, "decoration_not_supported");
      const cleanupPlan = createHarthmereHomeDecorationMaterializationPlan({
        requestId: request.requestId,
        actorId: request.actorId,
        property,
        definition,
        record,
        operation: "remove_decoration",
        cleanup: true,
      });
      delete state.placed[decorationId];
      addItemDelta(itemDeltas, record.itemId, 1);
      recomputeHarthmereHomeDecorationSummaries(state);
      return ok(state, request, itemDeltas, touchedModels, {
        materializationPlans: cleanupPlan ? [cleanupPlan] : [],
      });
    }
    case "use_decoration": {
      const decorationId = request.decorationId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      const definition = getHarthmereHomeDecorationDefinition(record.itemId);
      if (!definition) return fail(state, "decoration_not_supported");
      const stationId = definition.functionalEffects.craftingStationId;
      return ok(state, request, itemDeltas, touchedModels, {
        openedStationId: stationId,
        functionalSummary: definition.functionalEffects,
      });
    }
    case "plant_garden": {
      const decorationId = request.decorationId;
      const seedItemId = request.seedItemId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      if (!seedItemId) return fail(state, "missing_seed_item_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      if (record.kind !== "garden") return fail(state, "decoration_not_garden");
      if (record.garden) return fail(state, "garden_already_planted");
      const seed = GARDEN_SEED_DEFS[seedItemId];
      if (!seed) return fail(state, "seed_not_supported");
      if ((context.actorInventoryItems[seedItemId] ?? 0) <= 0) {
        return fail(state, "missing_seed_item");
      }
      record.garden = {
        seedItemId,
        cropItemId: seed.cropItemId,
        cropCount: seed.cropCount,
        plantedAtMs: request.nowMs,
        growDurationMs: seed.growDurationMs,
      };
      record.updatedAtMs = request.nowMs;
      addItemDelta(itemDeltas, seedItemId, -1);
      return ok(state, request, itemDeltas, touchedModels);
    }
    case "water_garden": {
      const decorationId = request.decorationId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      if (record.kind !== "garden") return fail(state, "decoration_not_garden");
      if (!record.garden) return fail(state, "garden_not_planted");
      if (
        (context.actorInventoryItems[HARTHMERE_CRAFTING_TOOLS.wateringCan] ??
          0) <= 0
      ) {
        return fail(state, "missing_watering_can");
      }
      record.garden.wateredAtMs = request.nowMs;
      record.garden.readyAtMs = request.nowMs + record.garden.growDurationMs;
      record.updatedAtMs = request.nowMs;
      return ok(state, request, itemDeltas, touchedModels);
    }
    case "harvest_garden": {
      const decorationId = request.decorationId;
      if (!decorationId) return fail(state, "missing_decoration_id");
      const record = state.placed[decorationId];
      if (!record) return fail(state, "decoration_not_found");
      const property = context.properties[record.propertyId];
      if (!actorCanDecorateProperty(property, request.actorId)) {
        return fail(state, "property_not_owned");
      }
      if (record.kind !== "garden") return fail(state, "decoration_not_garden");
      const garden = record.garden;
      if (!garden) return fail(state, "garden_not_planted");
      if (!garden.readyAtMs || request.nowMs < garden.readyAtMs) {
        return fail(state, "garden_not_ready");
      }
      addItemDelta(itemDeltas, garden.cropItemId, garden.cropCount);
      const harvestedItemId = garden.cropItemId;
      const harvestedCount = garden.cropCount;
      record.garden = undefined;
      record.updatedAtMs = request.nowMs;
      return ok(state, request, itemDeltas, touchedModels, {
        harvestedItemId,
        harvestedCount,
      });
    }
    default:
      return fail(state, "unsupported_decoration_operation");
  }
}
