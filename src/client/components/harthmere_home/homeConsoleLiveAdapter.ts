import {
  buildingSystemBlueprintByIdV1,
  buildingSystemHomeConsoleMarkerIdV1,
  buildingSystemPlotByIdV1,
  createBuildingSystemHomeConsoleMarkerV1,
  type BuildingSystemInWorldMarkerV1,
  type BuildingSystemPropertyRecordV1,
} from "@/shared/harthmere/building_system_v1";
import {
  canAccessHarthmereHomeConsoleV1,
  defaultHarthmereHomeDecorationStateV1,
  getHarthmereHomeDecorationDefinitionV1,
  listHarthmereHomeDecorationDefinitionsV1,
  listHarthmereHomeDecorationGardenSeedsV1,
  normalizeHarthmereHomeDecorationStateV1,
  type HarthmereHomeConsoleAccessReasonV1,
  type HarthmereHomeDecorationDefinitionV1,
  type HarthmereHomeDecorationFunctionalEffectsV1,
  type HarthmereHomeDecorationOperationV1,
  type HarthmereHomeDecorationPositionV1,
  type HarthmereHomeDecorationPropertySummaryV1,
  type HarthmereHomeDecorationRecordV1,
  type HarthmereHomeDecorationStateV1,
} from "@/shared/harthmere/home_decoration_authority_v1";
import {
  harthmereResolveBikkieVisualV1,
  type HarthmereResolvedBikkieVisualV1,
} from "@/shared/harthmere/bikkie_visual_resolver_v1";
import {
  getHarthmereItemDefinitionV1,
  type HarthmereItemDefinitionV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";
import { ensureHarthmereProductionCraftingCatalogueV1 } from "@/shared/harthmere/mmo_crafting_catalogue_v1";

export interface HarthmereHomeConsoleClientSnapshotV1 {
  actorId: string;
  gold: number;
  inventoryItems: Record<string, number>;
  completedProperties: Record<string, BuildingSystemPropertyRecordV1>;
  homeDecoration: HarthmereHomeDecorationStateV1;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
  nowMs: number;
}

export interface HarthmereHomeConsoleWorldContextV1 {
  insideHome?: boolean;
  nearbyPropertyId?: string | null;
  nearbyConsoleId?: string | null;
  interactionKeyLabel?: string;
}

export interface HarthmereHomeConsoleWorldPointV1 {
  x: number;
  y?: number;
  z: number;
}

export interface HarthmereHomeConsoleVisibleDefinitionV1 {
  definition: HarthmereHomeDecorationDefinitionV1;
  item?: HarthmereItemDefinitionV1;
  visual: HarthmereResolvedBikkieVisualV1;
  ownedCount: number;
  canPlace: boolean;
  missingReason?: string;
  footprintLabel: string;
  effectLabel: string;
}

export interface HarthmereHomeConsoleVisibleDecorationV1 {
  record: HarthmereHomeDecorationRecordV1;
  definition?: HarthmereHomeDecorationDefinitionV1;
  item?: HarthmereItemDefinitionV1;
  visual: HarthmereResolvedBikkieVisualV1;
  canUse: boolean;
  canMove: boolean;
  canRemove: boolean;
  gardenStatus: "none" | "empty" | "growing" | "ready";
  gardenLabel?: string;
}

export interface HarthmereHomeConsoleVisibleSeedV1 {
  seedItemId: string;
  cropItemId: string;
  cropCount: number;
  growDurationMs: number;
  displayName: string;
  ownedCount: number;
  canPlant: boolean;
}

export interface HarthmereHomeConsolePanelV1 {
  canAccess: boolean;
  accessReason: HarthmereHomeConsoleAccessReasonV1;
  property?: BuildingSystemPropertyRecordV1;
  propertyDisplayName: string;
  consoleMarker?: BuildingSystemInWorldMarkerV1;
  summary: HarthmereHomeDecorationPropertySummaryV1;
  placeable: HarthmereHomeConsoleVisibleDefinitionV1[];
  placed: HarthmereHomeConsoleVisibleDecorationV1[];
  seeds: HarthmereHomeConsoleVisibleSeedV1[];
}

export interface HarthmereHomeConsoleInteractionPromptV1 {
  visible: boolean;
  propertyId?: string;
  consoleId?: string;
  label: string;
  helper: string;
  keyLabel: string;
}

export interface HarthmereHomeConsoleSubmitPayloadV1 {
  operation: HarthmereHomeDecorationOperationV1;
  propertyId?: string;
  decorationId?: string;
  itemId?: string;
  seedItemId?: string;
  position?: Partial<HarthmereHomeDecorationPositionV1>;
  rotationDegrees?: number;
}

export interface HarthmereHomeConsoleAdapterV1 {
  isHydrated: () => boolean;
  getSnapshot: () => HarthmereHomeConsoleClientSnapshotV1 | undefined;
  isAvailable: (context?: HarthmereHomeConsoleWorldContextV1) => boolean;
  getPanel: (
    context?: HarthmereHomeConsoleWorldContextV1
  ) => HarthmereHomeConsolePanelV1;
  getInteractionPrompt: (
    context: HarthmereHomeConsoleWorldContextV1
  ) => HarthmereHomeConsoleInteractionPromptV1;
  placeDecoration: (
    itemId: string,
    payload?: Omit<
      HarthmereHomeConsoleSubmitPayloadV1,
      "operation" | "itemId"
    >
  ) => Promise<void>;
  moveDecoration: (
    decorationId: string,
    position: Partial<HarthmereHomeDecorationPositionV1>,
    rotationDegrees?: number
  ) => Promise<void>;
  removeDecoration: (decorationId: string) => Promise<void>;
  useDecoration: (decorationId: string) => Promise<void>;
  plantGarden: (decorationId: string, seedItemId: string) => Promise<void>;
  waterGarden: (decorationId: string) => Promise<void>;
  harvestGarden: (decorationId: string) => Promise<void>;
}

export interface CreateHarthmereHomeConsoleAdapterOptionsV1 {
  state: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined;
  context?: HarthmereHomeConsoleWorldContextV1;
  hydrated?: boolean;
  setState?: (state: HarthmereHomeConsoleClientSnapshotV1 | undefined) => void;
  submit?: (payload: HarthmereHomeConsoleSubmitPayloadV1) => Promise<{
    ok: boolean;
    buildingState?: Partial<HarthmereHomeConsoleClientSnapshotV1>;
    warnings?: string[];
  }>;
}

export interface SubmitHarthmereHomeDecorationMutationOptionsV1 {
  fetchImpl?: (
    url: string,
    init: {
      method: string;
      credentials: "same-origin";
      headers: Record<string, string>;
      body: string;
    }
  ) => Promise<{ ok: boolean; status?: number; json: () => Promise<any> }>;
  requestId?: string;
  zoneId?: string;
  actorEntityVersion?: number;
}

const EMPTY_SUMMARY: HarthmereHomeDecorationPropertySummaryV1 = {
  propertyId: "",
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
};

function cloneSummary(
  summary: HarthmereHomeDecorationPropertySummaryV1 | undefined,
  propertyId = ""
): HarthmereHomeDecorationPropertySummaryV1 {
  return {
    ...EMPTY_SUMMARY,
    ...(summary ?? {}),
    propertyId: summary?.propertyId ?? propertyId,
    craftingStationIds: [...(summary?.craftingStationIds ?? [])],
  };
}

export function formatHarthmereHomeConsolePlayerLabelV1(
  value: string | undefined
) {
  if (!value) return "";
  return String(value)
    .replace(/^harthmere[_\s-]+/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[:./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function effectLabel(
  effects: HarthmereHomeDecorationFunctionalEffectsV1
): string {
  const parts: string[] = [];
  if (effects.storageSlots) parts.push(`Storage +${effects.storageSlots}`);
  if (effects.comfort) parts.push(`Comfort +${effects.comfort}`);
  if (effects.lighting) parts.push(`Light +${effects.lighting}`);
  if (effects.safety) parts.push(`Safety +${effects.safety}`);
  if (effects.sanitation) parts.push(`Clean +${effects.sanitation}`);
  if (effects.customerAppeal) parts.push(`Appeal +${effects.customerAppeal}`);
  if (effects.gardenSlots) parts.push(`Garden +${effects.gardenSlots}`);
  if (effects.powerMegawatts) parts.push(`${effects.powerMegawatts} MW`);
  if (effects.craftingStationId) parts.push("Crafting station");
  return parts.join(", ") || "Decor";
}

function footprintLabel(definition: HarthmereHomeDecorationDefinitionV1) {
  const fp = definition.footprint;
  return `${fp.width}x${fp.depth}x${fp.height}`;
}

function definitionVisual(
  definition: HarthmereHomeDecorationDefinitionV1,
  item?: HarthmereItemDefinitionV1
) {
  return harthmereResolveBikkieVisualV1({
    id: definition.itemId,
    label: definition.displayName,
    kind: item?.category ?? definition.kind,
    objectMetadata: item?.objectMetadata,
    bikkieGraphicHints: item?.objectMetadata?.bikkieGraphicHints,
    description: item?.description,
  });
}

function defaultPanel(
  reason: HarthmereHomeConsoleAccessReasonV1
): HarthmereHomeConsolePanelV1 {
  return {
    canAccess: false,
    accessReason: reason,
    propertyDisplayName: "Home Console",
    summary: cloneSummary(undefined),
    placeable: [],
    placed: [],
    seeds: [],
  };
}

function homePropertiesForActor(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  actorId = snapshot.actorId
) {
  return Object.values(snapshot.completedProperties).filter(
    (property) =>
      property.use === "home" &&
      property.ownerId === actorId &&
      property.status !== "abandoned" &&
      property.status !== "demolished" &&
      !property.abandoned
  );
}

function markerForProperty(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  property: BuildingSystemPropertyRecordV1
): BuildingSystemInWorldMarkerV1 | undefined {
  const expectedId = buildingSystemHomeConsoleMarkerIdV1(property.propertyId);
  const existing =
    snapshot.inWorldMarkers[expectedId] ??
    Object.values(snapshot.inWorldMarkers).find(
      (marker) =>
        marker.kind === "home_console" && marker.plotId === property.plotId
    );
  if (existing) return existing;
  const plot = buildingSystemPlotByIdV1(property.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
  if (!plot || !blueprint) return undefined;
  return createBuildingSystemHomeConsoleMarkerV1({
    property,
    plot,
    blueprint,
    nowMs: snapshot.nowMs,
  });
}

function markerDistanceSq(
  marker: BuildingSystemInWorldMarkerV1,
  point: HarthmereHomeConsoleWorldPointV1
) {
  const dx = Number(marker.position[0]) - point.x;
  const dy = Number(marker.position[1]) - Number(point.y ?? marker.position[1]);
  const dz = Number(marker.position[2]) - point.z;
  return dx * dx + dy * dy + dz * dz;
}

function propertyForMarker(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  markerId: string
) {
  const marker = snapshot.inWorldMarkers[markerId];
  if (!marker || marker.kind !== "home_console") return undefined;
  return Object.values(snapshot.completedProperties).find(
    (property) => property.plotId === marker.plotId
  );
}

function resolveProperty(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  context: HarthmereHomeConsoleWorldContextV1
) {
  if (context.nearbyPropertyId) {
    return snapshot.completedProperties[context.nearbyPropertyId];
  }
  if (context.nearbyConsoleId) {
    const property = propertyForMarker(snapshot, context.nearbyConsoleId);
    if (property) return property;
  }
  const homes = homePropertiesForActor(snapshot);
  return homes.length === 1 ? homes[0] : undefined;
}

function visibleDefinitions(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  canAccess: boolean
): HarthmereHomeConsoleVisibleDefinitionV1[] {
  ensureHarthmereProductionCraftingCatalogueV1();
  return listHarthmereHomeDecorationDefinitionsV1()
    .filter((definition) => definition.allowedPropertyUses.includes("home"))
    .map((definition) => {
      const item = getHarthmereItemDefinitionV1(definition.itemId);
      const ownedCount = Math.max(0, snapshot.inventoryItems[definition.itemId] ?? 0);
      return {
        definition,
        item,
        visual: definitionVisual(definition, item),
        ownedCount,
        canPlace: canAccess && ownedCount > 0,
        missingReason: ownedCount > 0 ? undefined : "Not in inventory",
        footprintLabel: footprintLabel(definition),
        effectLabel: effectLabel(definition.functionalEffects),
      };
    });
}

function visibleSeeds(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  canAccess: boolean
): HarthmereHomeConsoleVisibleSeedV1[] {
  return listHarthmereHomeDecorationGardenSeedsV1().map((seed) => {
    const item = getHarthmereItemDefinitionV1(seed.seedItemId);
    const ownedCount = Math.max(0, snapshot.inventoryItems[seed.seedItemId] ?? 0);
    return {
      ...seed,
      displayName:
        item?.displayName ?? formatHarthmereHomeConsolePlayerLabelV1(seed.seedItemId),
      ownedCount,
      canPlant: canAccess && ownedCount > 0,
    };
  });
}

function gardenStatus(
  record: HarthmereHomeDecorationRecordV1,
  nowMs: number
): HarthmereHomeConsoleVisibleDecorationV1["gardenStatus"] {
  if (record.kind !== "garden") return "none";
  if (!record.garden) return "empty";
  return record.garden.readyAtMs && nowMs >= record.garden.readyAtMs
    ? "ready"
    : "growing";
}

function visiblePlaced(
  snapshot: HarthmereHomeConsoleClientSnapshotV1,
  property: BuildingSystemPropertyRecordV1,
  canAccess: boolean
): HarthmereHomeConsoleVisibleDecorationV1[] {
  return Object.values(snapshot.homeDecoration.placed)
    .filter((record) => record.propertyId === property.propertyId)
    .sort((left, right) => left.installedAtMs - right.installedAtMs)
    .map((record) => {
      const definition = getHarthmereHomeDecorationDefinitionV1(record.itemId);
      const item = getHarthmereItemDefinitionV1(record.itemId);
      const status = gardenStatus(record, snapshot.nowMs);
      const garden = record.garden;
      return {
        record,
        definition,
        item,
        visual: definition
          ? definitionVisual(definition, item)
          : harthmereResolveBikkieVisualV1({
              id: record.itemId,
              label: record.displayName,
              kind: record.kind,
            }),
        canUse: canAccess && !!definition?.functionalEffects.craftingStationId,
        canMove: canAccess,
        canRemove: canAccess,
        gardenStatus: status,
        gardenLabel: garden
          ? `${formatHarthmereHomeConsolePlayerLabelV1(garden.cropItemId)} x${garden.cropCount}`
          : undefined,
      };
    });
}

export function normalizeHarthmereHomeConsoleClientSnapshotV1(
  input: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined
): HarthmereHomeConsoleClientSnapshotV1 {
  ensureHarthmereProductionCraftingCatalogueV1();
  return {
    actorId: input?.actorId ?? "",
    gold: Math.max(0, Math.trunc(Number(input?.gold ?? 0))),
    inventoryItems: { ...(input?.inventoryItems ?? {}) },
    completedProperties: { ...(input?.completedProperties ?? {}) },
    homeDecoration: normalizeHarthmereHomeDecorationStateV1(
      input?.homeDecoration ?? defaultHarthmereHomeDecorationStateV1()
    ),
    inWorldMarkers: { ...(input?.inWorldMarkers ?? {}) },
    nowMs: Math.max(0, Math.trunc(Number(input?.nowMs ?? Date.now()))),
  };
}

export function listHarthmereHomeConsoleMarkersV1(
  snapshot: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined
) {
  const normalized = normalizeHarthmereHomeConsoleClientSnapshotV1(snapshot);
  return homePropertiesForActor(normalized)
    .map((property) => markerForProperty(normalized, property))
    .filter((marker): marker is BuildingSystemInWorldMarkerV1 => !!marker);
}

export function getHarthmereHomeConsolePanelV1(
  snapshotInput: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined,
  context: HarthmereHomeConsoleWorldContextV1 = {}
): HarthmereHomeConsolePanelV1 {
  if (!snapshotInput) return defaultPanel("missing_property");
  const snapshot = normalizeHarthmereHomeConsoleClientSnapshotV1(snapshotInput);
  const property = resolveProperty(snapshot, context);
  if (!property) {
    return defaultPanel(context.insideHome ? "missing_property" : "not_inside_home");
  }
  const marker = markerForProperty(snapshot, property);
  const access = canAccessHarthmereHomeConsoleV1(property, {
    actorId: snapshot.actorId,
    insideHome: context.insideHome,
    nearbyConsoleId: context.nearbyConsoleId ?? null,
    requireNearbyConsole: true,
  });
  const propertyDisplayName =
    buildingSystemBlueprintByIdV1(property.blueprintId)?.displayName ??
    formatHarthmereHomeConsolePlayerLabelV1(property.blueprintId) ??
    "Home";
  if (!access.ok) {
    return {
      ...defaultPanel(access.reason),
      property,
      propertyDisplayName,
      consoleMarker: marker,
    };
  }
  return {
    canAccess: true,
    accessReason: "available",
    property,
    propertyDisplayName,
    consoleMarker: marker,
    summary: cloneSummary(
      snapshot.homeDecoration.propertySummaries[property.propertyId],
      property.propertyId
    ),
    placeable: visibleDefinitions(snapshot, true),
    placed: visiblePlaced(snapshot, property, true),
    seeds: visibleSeeds(snapshot, true),
  };
}

export function getHarthmereHomeConsoleInteractionPromptV1(
  snapshot: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined,
  context: HarthmereHomeConsoleWorldContextV1
): HarthmereHomeConsoleInteractionPromptV1 {
  const panel = getHarthmereHomeConsolePanelV1(snapshot, context);
  if (!panel.canAccess || !panel.property || !panel.consoleMarker) {
    return {
      visible: false,
      label: "Home Console",
      helper: "",
      keyLabel: context.interactionKeyLabel ?? "Open",
    };
  }
  const keyLabel = context.interactionKeyLabel ?? "Open";
  const action = context.interactionKeyLabel
    ? `Press ${keyLabel} to manage`
    : "Tap to manage";
  return {
    visible: true,
    propertyId: panel.property.propertyId,
    consoleId: panel.consoleMarker.markerId,
    label: "Home Console",
    helper: `${action} furniture, decorating, storage, gardens, and utilities.`,
    keyLabel,
  };
}

export function nearestHarthmereHomeConsoleWorldContextV1(
  snapshotInput: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined,
  playerPosition: HarthmereHomeConsoleWorldPointV1 | undefined,
  radius = 5
): HarthmereHomeConsoleWorldContextV1 {
  if (!snapshotInput || !playerPosition) {
    return { insideHome: false };
  }
  const snapshot = normalizeHarthmereHomeConsoleClientSnapshotV1(snapshotInput);
  const markers = listHarthmereHomeConsoleMarkersV1(snapshot);
  let best:
    | { marker: BuildingSystemInWorldMarkerV1; distanceSq: number }
    | undefined;
  for (const marker of markers) {
    const distanceSq = markerDistanceSq(marker, playerPosition);
    if (!best || distanceSq < best.distanceSq) {
      best = { marker, distanceSq };
    }
  }
  if (!best || best.distanceSq > radius * radius) {
    return { insideHome: false };
  }
  const property = Object.values(snapshot.completedProperties).find(
    (entry) => entry.plotId === best!.marker.plotId
  );
  return {
    insideHome: true,
    nearbyConsoleId: best.marker.markerId,
    nearbyPropertyId: property?.propertyId,
  };
}

export async function fetchHarthmereHomeConsoleBuildingStateV1(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchImpl("/api/harthmere/live_mode_building_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.buildingState
    ? normalizeHarthmereHomeConsoleClientSnapshotV1(body.buildingState)
    : undefined;
}

function playerMessageFromHomeConsoleWarning(warning: string) {
  const code = warning
    .replace(/^home_decoration_rejected:/, "")
    .replace(/^home_console_rejected:/, "")
    .split(":")[0];
  switch (code) {
    case "missing_operation":
      return "Choose a home action first.";
    case "missing_property_id":
    case "missing_property":
      return "Stand inside your home at the console.";
    case "property_not_owned":
    case "not_owner":
      return "Only the home owner can use this console.";
    case "not_home_property":
      return "This console only manages homes.";
    case "console_proximity_unverified":
      return "Stand at the home console first.";
    case "console_marker_missing":
      return "This home needs a console marker.";
    case "console_proximity_required":
      return "Move closer to the home console.";
    case "decoration_not_supported":
      return "That item cannot be placed at home.";
    case "decoration_not_allowed_for_property":
      return "That item cannot be placed in this home.";
    case "missing_decoration_item":
      return "You do not have that home item.";
    case "decoration_limit_reached":
      return "This home is at its decoration limit.";
    case "decoration_not_found":
      return "That home item is no longer placed.";
    case "invalid_decoration_position":
      return "Choose a valid spot in the home.";
    case "missing_seed_item":
      return "You need that seed first.";
    case "missing_watering_can":
      return "You need a watering can.";
    case "garden_not_ready":
      return "That planter is still growing.";
    case "garden_already_planted":
      return "That planter already has a crop.";
    default:
      return "The home console is unavailable right now.";
  }
}

export function formatHarthmereHomeConsolePlayerErrorV1(warnings?: string[]) {
  const messages = [
    ...new Set(
      (warnings ?? [])
        .filter((warning) => typeof warning === "string" && warning.length > 0)
        .map(playerMessageFromHomeConsoleWarning)
    ),
  ];
  return messages.length
    ? messages.join(" ")
    : "The home console is unavailable right now.";
}

export async function submitHarthmereHomeDecorationMutationV1(
  payload: HarthmereHomeConsoleSubmitPayloadV1,
  options: SubmitHarthmereHomeDecorationMutationOptionsV1 = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId =
    options.requestId ??
    `home_console_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchImpl("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_home_decoration",
      subsystem: "home_decoration",
      actorEntityVersion: options.actorEntityVersion ?? 1,
      zoneId: options.zoneId ?? "the_grove",
      payload,
      clientClaims: {},
    }),
  });
  if (!response.ok) {
    throw new Error("The home console is unavailable right now.");
  }
  const body = await response.json();
  const warnings: string[] =
    body?.backendMutation?.warnings ?? body?.summary?.warnings ?? body?.warnings ?? [];
  const rejected = warnings.filter((warning) =>
    String(warning).startsWith("home_decoration_rejected:")
  );
  if (rejected.length > 0) {
    throw new Error(formatHarthmereHomeConsolePlayerErrorV1(rejected));
  }
  return {
    ok: body?.ok !== false,
    buildingState: body?.buildingState,
    warnings,
  };
}

export function createHarthmereHomeConsoleAdapterV1({
  state,
  context = {},
  hydrated = true,
  setState,
  submit,
}: CreateHarthmereHomeConsoleAdapterOptionsV1): HarthmereHomeConsoleAdapterV1 {
  let current = state
    ? normalizeHarthmereHomeConsoleClientSnapshotV1(state)
    : undefined;
  const updateState = (
    buildingState: Partial<HarthmereHomeConsoleClientSnapshotV1> | undefined
  ) => {
    if (!buildingState) return;
    current = normalizeHarthmereHomeConsoleClientSnapshotV1({
      ...current,
      ...buildingState,
    });
    setState?.(current);
  };
  const mutate = async (payload: HarthmereHomeConsoleSubmitPayloadV1) => {
    if (!submit) return;
    const body = await submit(payload);
    if (!body.ok) {
      throw new Error(formatHarthmereHomeConsolePlayerErrorV1(body.warnings));
    }
    updateState(body.buildingState);
  };
  const propertyId = () => getHarthmereHomeConsolePanelV1(current, context).property?.propertyId;
  const withProperty = (
    payload: HarthmereHomeConsoleSubmitPayloadV1
  ): HarthmereHomeConsoleSubmitPayloadV1 => ({
    ...payload,
    propertyId: payload.propertyId ?? propertyId(),
  });
  return {
    isHydrated: () => hydrated,
    getSnapshot: () => current,
    isAvailable: (nextContext = context) =>
      hydrated && getHarthmereHomeConsolePanelV1(current, nextContext).canAccess,
    getPanel: (nextContext = context) =>
      getHarthmereHomeConsolePanelV1(current, nextContext),
    getInteractionPrompt: (nextContext) =>
      getHarthmereHomeConsoleInteractionPromptV1(current, nextContext),
    placeDecoration: (itemId, payload = {}) =>
      mutate(withProperty({ ...payload, operation: "place_decoration", itemId })),
    moveDecoration: (decorationId, position, rotationDegrees) =>
      mutate({
        operation: "move_decoration",
        decorationId,
        position,
        rotationDegrees,
      }),
    removeDecoration: (decorationId) =>
      mutate({ operation: "remove_decoration", decorationId }),
    useDecoration: (decorationId) =>
      mutate({ operation: "use_decoration", decorationId }),
    plantGarden: (decorationId, seedItemId) =>
      mutate({ operation: "plant_garden", decorationId, seedItemId }),
    waterGarden: (decorationId) =>
      mutate({ operation: "water_garden", decorationId }),
    harvestGarden: (decorationId) =>
      mutate({ operation: "harvest_garden", decorationId }),
  };
}
