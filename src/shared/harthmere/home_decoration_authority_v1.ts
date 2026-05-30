import type {
  BuildingSystemPlotUseV1,
  BuildingSystemPropertyRecordV1,
} from "./building_system_v1";
import {
  HARTHMERE_CRAFTING_STATIONS_V1,
  HARTHMERE_CRAFTING_TOOLS_V1,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1,
  HARTHMERE_HOME_DECORATION_ITEM_IDS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "./mmo_crafting_catalogue_v1";
import { getHarthmereCraftingStationV1 } from "./mmo_inventory_authority_v1";

export const HARTHMERE_HOME_DECORATION_AUTHORITY_VERSION_V1 =
  "harthmere-home-decoration-authority-v1" as const;

export type HarthmereHomeDecorationKindV1 =
  | "crafting_station"
  | "storage"
  | "utility"
  | "lighting"
  | "comfort"
  | "garden"
  | "business_counter";

export interface HarthmereHomeDecorationFootprintV1 {
  width: number;
  depth: number;
  height: number;
}

export interface HarthmereHomeDecorationFunctionalEffectsV1 {
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

export interface HarthmereHomeDecorationDefinitionV1 {
  itemId: string;
  displayName: string;
  kind: HarthmereHomeDecorationKindV1;
  allowedPropertyUses: readonly BuildingSystemPlotUseV1[];
  footprint: HarthmereHomeDecorationFootprintV1;
  functionalEffects: HarthmereHomeDecorationFunctionalEffectsV1;
  placementTags: readonly string[];
}

export interface HarthmereHomeDecorationPositionV1 {
  x: number;
  y: number;
  z: number;
}

export interface HarthmereHomeDecorationGardenStateV1 {
  seedItemId: string;
  cropItemId: string;
  cropCount: number;
  plantedAtMs: number;
  growDurationMs: number;
  wateredAtMs?: number;
  readyAtMs?: number;
}

export interface HarthmereHomeDecorationRecordV1 {
  decorationId: string;
  propertyId: string;
  ownerId: string;
  itemId: string;
  displayName: string;
  kind: HarthmereHomeDecorationKindV1;
  position: HarthmereHomeDecorationPositionV1;
  rotationDegrees: 0 | 90 | 180 | 270;
  condition: number;
  installedAtMs: number;
  updatedAtMs: number;
  powered: boolean;
  garden?: HarthmereHomeDecorationGardenStateV1;
}

export interface HarthmereHomeDecorationPropertySummaryV1 {
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

export interface HarthmereHomeDecorationStateV1 {
  placed: Record<string, HarthmereHomeDecorationRecordV1>;
  nextDecorationNumber: number;
  propertySummaries: Record<string, HarthmereHomeDecorationPropertySummaryV1>;
  appliedRequestIds: Record<string, number>;
}

export type HarthmereHomeDecorationOperationV1 =
  | "place_decoration"
  | "move_decoration"
  | "remove_decoration"
  | "use_decoration"
  | "plant_garden"
  | "water_garden"
  | "harvest_garden";

export interface HarthmereHomeDecorationMutationRequestV1 {
  requestId: string;
  actorId: string;
  operation: HarthmereHomeDecorationOperationV1;
  propertyId?: string;
  decorationId?: string;
  itemId?: string;
  seedItemId?: string;
  position?: Partial<HarthmereHomeDecorationPositionV1>;
  rotationDegrees?: number;
  nowMs: number;
}

export interface HarthmereHomeDecorationMutationContextV1 {
  properties: Record<
    string,
    Pick<
      BuildingSystemPropertyRecordV1,
      "propertyId" | "ownerId" | "use" | "tier" | "status" | "abandoned"
    >
  >;
  actorInventoryItems: Record<string, number>;
}

export interface HarthmereHomeDecorationMutationResultV1 {
  ok: boolean;
  errors: string[];
  warnings: string[];
  state: HarthmereHomeDecorationStateV1;
  itemDeltas: Record<string, number>;
  touchedModels: string[];
  openedStationId?: string;
  functionalSummary?: HarthmereHomeDecorationFunctionalEffectsV1;
  harvestedItemId?: string;
  harvestedCount?: number;
}

export type HarthmereHomeConsoleAccessReasonV1 =
  | "available"
  | "missing_property"
  | "not_home_property"
  | "not_owner"
  | "property_unavailable"
  | "not_inside_home"
  | "console_not_nearby";

export interface HarthmereHomeConsoleAccessContextV1 {
  actorId: string;
  insideHome?: boolean;
  nearbyConsoleId?: string | null;
  requireNearbyConsole?: boolean;
}

export interface HarthmereHomeConsoleAccessResultV1 {
  ok: boolean;
  reason: HarthmereHomeConsoleAccessReasonV1;
}

const DECORATION_BASE_LIMIT_V1 = 24;
const DECORATION_LIMIT_PER_PROPERTY_TIER_V1 = 4;
const GARDEN_GROW_DURATION_MS_V1 = 60_000;
const DECORATION_MAX_ABS_POSITION_V1 = 100_000;
const DECORATION_IDEMPOTENCY_LIMIT_V1 = 256;

const STATION_DECORATION_IDS_V1 = [
  HARTHMERE_CRAFTING_STATIONS_V1.workbench,
  HARTHMERE_CRAFTING_STATIONS_V1.thermolite,
  HARTHMERE_CRAFTING_STATIONS_V1.thermoblaster,
  HARTHMERE_CRAFTING_STATIONS_V1.kitchen,
  HARTHMERE_CRAFTING_STATIONS_V1.tailoringBooth,
  HARTHMERE_CRAFTING_STATIONS_V1.seedMill,
  HARTHMERE_CRAFTING_STATIONS_V1.anglersTable,
  HARTHMERE_CRAFTING_STATIONS_V1.composter,
  HARTHMERE_CRAFTING_STATIONS_V1.dyeOMatic,
] as const;

const GARDEN_SEED_DEFS_V1: Record<
  string,
  { cropItemId: string; cropCount: number; growDurationMs: number }
> = {
  grain_seed: {
    cropItemId: "rough_herb",
    cropCount: 2,
    growDurationMs: GARDEN_GROW_DURATION_MS_V1,
  },
};

function parseSize(size?: string): HarthmereHomeDecorationFootprintV1 {
  const [width, depth, height] = String(size ?? "1x1x1")
    .split("x")
    .map((part) => Math.max(1, Math.floor(Number(part) || 1)));
  return { width, depth, height };
}

const BASE_DECORATION_DEFS_V1: HarthmereHomeDecorationDefinitionV1[] = [
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
    displayName: "Storage Cabinet",
    kind: "storage",
    allowedPropertyUses: ["home", "business", "workshop", "storage"],
    footprint: { width: 1, depth: 1, height: 2 },
    functionalEffects: { storageSlots: 8, comfort: 1 },
    placementTags: ["interior", "storage"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.hearthLamp,
    displayName: "Hearth Lamp",
    kind: "lighting",
    allowedPropertyUses: ["home", "business", "workshop", "guild"],
    footprint: { width: 1, depth: 1, height: 1 },
    functionalEffects: { comfort: 2, safety: 1, lighting: 1 },
    placementTags: ["interior", "light"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.gardenPlanterBox,
    displayName: "Garden Planter Box",
    kind: "garden",
    allowedPropertyUses: ["home", "business", "farm"],
    footprint: { width: 2, depth: 1, height: 1 },
    functionalEffects: { gardenSlots: 1, comfort: 1 },
    placementTags: ["exterior", "garden"],
  },
  {
    itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.businessServiceCounter,
    displayName: "Service Counter",
    kind: "business_counter",
    allowedPropertyUses: ["business", "workshop"],
    footprint: { width: 2, depth: 1, height: 1 },
    functionalEffects: { customerAppeal: 4, storageSlots: 2 },
    placementTags: ["interior", "business"],
  },
  {
    itemId: HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1.utilityCore,
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

function createStationDecorationDefinitionsV1(): HarthmereHomeDecorationDefinitionV1[] {
  ensureHarthmereProductionCraftingCatalogueV1();
  return STATION_DECORATION_IDS_V1.map((stationId) => {
    const station = getHarthmereCraftingStationV1(stationId);
    return {
      itemId: stationId,
      displayName: station?.displayName ?? "Crafting Station",
      kind: "crafting_station",
      allowedPropertyUses: ["home", "business", "workshop"],
      footprint: parseSize(station?.size),
      functionalEffects: { craftingStationId: stationId },
      placementTags: ["interior", "workshop", "crafting"],
    } satisfies HarthmereHomeDecorationDefinitionV1;
  });
}

export function listHarthmereHomeDecorationDefinitionsV1(): HarthmereHomeDecorationDefinitionV1[] {
  return [
    ...createStationDecorationDefinitionsV1(),
    ...BASE_DECORATION_DEFS_V1,
  ];
}

export function getHarthmereHomeDecorationDefinitionV1(itemId: string) {
  return listHarthmereHomeDecorationDefinitionsV1().find(
    (definition) => definition.itemId === itemId
  );
}

export function listHarthmereHomeDecorationGardenSeedsV1() {
  return Object.entries(GARDEN_SEED_DEFS_V1).map(([seedItemId, seed]) => ({
    seedItemId,
    cropItemId: seed.cropItemId,
    cropCount: seed.cropCount,
    growDurationMs: seed.growDurationMs,
  }));
}

export function defaultHarthmereHomeDecorationStateV1(): HarthmereHomeDecorationStateV1 {
  return {
    placed: {},
    nextDecorationNumber: 1,
    propertySummaries: {},
    appliedRequestIds: {},
  };
}

function cloneState(
  state: HarthmereHomeDecorationStateV1
): HarthmereHomeDecorationStateV1 {
  const placed: Record<string, HarthmereHomeDecorationRecordV1> = {};
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

export function normalizeHarthmereHomeDecorationStateV1(
  raw: unknown
): HarthmereHomeDecorationStateV1 {
  if (!raw || typeof raw !== "object") {
    return defaultHarthmereHomeDecorationStateV1();
  }
  const input = raw as Partial<HarthmereHomeDecorationStateV1>;
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
  recomputeHarthmereHomeDecorationSummariesV1(state);
  return state;
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  const rotation = Math.round(Number(value) || 0);
  if (rotation === 90 || rotation === 180 || rotation === 270) return rotation;
  return 0;
}

function normalizePosition(
  position: Partial<HarthmereHomeDecorationPositionV1> | undefined
): HarthmereHomeDecorationPositionV1 {
  return {
    x: Number.isFinite(Number(position?.x)) ? Number(position?.x) : 0,
    y: Number.isFinite(Number(position?.y)) ? Number(position?.y) : 0,
    z: Number.isFinite(Number(position?.z)) ? Number(position?.z) : 0,
  };
}

function requestedPositionIsValid(
  position: Partial<HarthmereHomeDecorationPositionV1> | undefined
) {
  if (!position) return true;
  for (const coordinate of [position.x, position.y, position.z]) {
    if (coordinate === undefined) continue;
    const numeric = Number(coordinate);
    if (
      !Number.isFinite(numeric) ||
      Math.abs(numeric) > DECORATION_MAX_ABS_POSITION_V1
    ) {
      return false;
    }
  }
  return true;
}

function propertyDecorationLimit(
  property: Pick<BuildingSystemPropertyRecordV1, "tier" | "use">
) {
  return (
    DECORATION_BASE_LIMIT_V1 +
    Math.max(0, Math.floor(Number(property.tier) || 0)) *
      DECORATION_LIMIT_PER_PROPERTY_TIER_V1 +
    (property.use === "business" ? 8 : 0)
  );
}

function actorCanDecorateProperty(
  property:
    | Pick<BuildingSystemPropertyRecordV1, "ownerId" | "status" | "abandoned">
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

export function canAccessHarthmereHomeConsoleV1(
  property:
    | Pick<
        BuildingSystemPropertyRecordV1,
        "ownerId" | "use" | "status" | "abandoned"
      >
    | undefined,
  context: HarthmereHomeConsoleAccessContextV1
): HarthmereHomeConsoleAccessResultV1 {
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
  state: HarthmereHomeDecorationStateV1,
  error: string
): HarthmereHomeDecorationMutationResultV1 {
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
  state: HarthmereHomeDecorationStateV1,
  request: HarthmereHomeDecorationMutationRequestV1
) {
  state.appliedRequestIds[request.requestId] = request.nowMs;
  const entries = Object.entries(state.appliedRequestIds).sort(
    ([, left], [, right]) => left - right
  );
  while (entries.length > DECORATION_IDEMPOTENCY_LIMIT_V1) {
    const [requestId] = entries.shift()!;
    delete state.appliedRequestIds[requestId];
  }
}

function ok(
  state: HarthmereHomeDecorationStateV1,
  request: HarthmereHomeDecorationMutationRequestV1,
  itemDeltas: Record<string, number>,
  touchedModels: string[],
  extra: Partial<
    Omit<
      HarthmereHomeDecorationMutationResultV1,
      "ok" | "errors" | "warnings" | "state" | "itemDeltas" | "touchedModels"
    >
  > = {}
): HarthmereHomeDecorationMutationResultV1 {
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

export function recomputeHarthmereHomeDecorationSummariesV1(
  state: HarthmereHomeDecorationStateV1
) {
  const summaries: Record<string, HarthmereHomeDecorationPropertySummaryV1> =
    {};
  for (const record of Object.values(state.placed)) {
    const definition = getHarthmereHomeDecorationDefinitionV1(record.itemId);
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
  state: HarthmereHomeDecorationStateV1,
  propertyId: string
) {
  const number = state.nextDecorationNumber++;
  const safePropertyId = propertyId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `decor_${safePropertyId}_${number}`;
}

export function reduceHarthmereHomeDecorationMutationV1(
  current: HarthmereHomeDecorationStateV1,
  request: HarthmereHomeDecorationMutationRequestV1,
  context: HarthmereHomeDecorationMutationContextV1
): HarthmereHomeDecorationMutationResultV1 {
  const state = normalizeHarthmereHomeDecorationStateV1(current);
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
      const definition = getHarthmereHomeDecorationDefinitionV1(itemId);
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
      const decorationId = nextDecorationId(state, propertyId);
      state.placed[decorationId] = {
        decorationId,
        propertyId,
        ownerId: request.actorId,
        itemId,
        displayName: definition.displayName,
        kind: definition.kind,
        position: normalizePosition(request.position),
        rotationDegrees: normalizeRotation(request.rotationDegrees),
        condition: 1,
        installedAtMs: request.nowMs,
        updatedAtMs: request.nowMs,
        powered:
          definition.kind !== "utility" ||
          !!definition.functionalEffects.powerMegawatts,
      };
      addItemDelta(itemDeltas, itemId, -1);
      recomputeHarthmereHomeDecorationSummariesV1(state);
      return ok(state, request, itemDeltas, touchedModels, {
        functionalSummary: definition.functionalEffects,
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
      record.position = normalizePosition(request.position ?? record.position);
      record.rotationDegrees = normalizeRotation(
        request.rotationDegrees ?? record.rotationDegrees
      );
      record.updatedAtMs = request.nowMs;
      recomputeHarthmereHomeDecorationSummariesV1(state);
      return ok(state, request, itemDeltas, touchedModels);
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
      delete state.placed[decorationId];
      addItemDelta(itemDeltas, record.itemId, 1);
      recomputeHarthmereHomeDecorationSummariesV1(state);
      return ok(state, request, itemDeltas, touchedModels);
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
      const definition = getHarthmereHomeDecorationDefinitionV1(record.itemId);
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
      const seed = GARDEN_SEED_DEFS_V1[seedItemId];
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
        (context.actorInventoryItems[HARTHMERE_CRAFTING_TOOLS_V1.wateringCan] ??
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
