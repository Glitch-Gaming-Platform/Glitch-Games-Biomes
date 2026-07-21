import {
  buildingSystemBlueprintById,
  buildingSystemHomeConsoleMarkerId,
  buildingSystemPlotById,
  createBuildingSystemHomeConsoleMarker,
  type BuildingSystemInWorldMarker,
  type BuildingSystemPropertyRecord,
} from "@/shared/harthmere/building_system";
import {
  canAccessHarthmereHomeConsole,
  defaultHarthmereHomeDecorationState,
  getHarthmereHomeDecorationDefinition,
  listHarthmereHomeDecorationDefinitions,
  listHarthmereHomeDecorationGardenSeeds,
  normalizeHarthmereHomeDecorationState,
  type HarthmereHomeConsoleAccessReason,
  type HarthmereHomeDecorationDefinition,
  type HarthmereHomeDecorationFunctionalEffects,
  type HarthmereHomeDecorationOperation,
  type HarthmereHomeDecorationPosition,
  type HarthmereHomeDecorationPropertySummary,
  type HarthmereHomeDecorationRecord,
  type HarthmereHomeDecorationState,
} from "@/shared/harthmere/home_decoration_authority";
import {
  harthmereResolveBikkieVisual,
  type HarthmereResolvedBikkieVisual,
} from "@/shared/harthmere/bikkie_visual_resolver";
import {
  getHarthmereItemDefinition,
  type HarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";

export interface HarthmereHomeConsoleClientSnapshot {
  actorId: string;
  gold: number;
  inventoryItems: Record<string, number>;
  completedProperties: Record<string, BuildingSystemPropertyRecord>;
  homeDecoration: HarthmereHomeDecorationState;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarker>;
  nowMs: number;
}

export interface HarthmereHomeConsoleWorldContext {
  insideHome?: boolean;
  nearbyPropertyId?: string | null;
  nearbyConsoleId?: string | null;
  interactionKeyLabel?: string;
  /** Exact physical console used to require a faced, not merely nearby, F target. */
  interactionPosition?: HarthmereHomeConsoleWorldPoint;
}

export interface HarthmereHomeConsoleWorldPoint {
  x: number;
  y?: number;
  z: number;
}

export interface HarthmereHomeConsoleVisibleDefinition {
  definition: HarthmereHomeDecorationDefinition;
  item?: HarthmereItemDefinition;
  visual: HarthmereResolvedBikkieVisual;
  ownedCount: number;
  canPlace: boolean;
  missingReason?: string;
  footprintLabel: string;
  effectLabel: string;
}

export interface HarthmereHomeConsoleVisibleDecoration {
  record: HarthmereHomeDecorationRecord;
  definition?: HarthmereHomeDecorationDefinition;
  item?: HarthmereItemDefinition;
  visual: HarthmereResolvedBikkieVisual;
  canUse: boolean;
  canMove: boolean;
  canRemove: boolean;
  gardenStatus: "none" | "empty" | "growing" | "ready";
  gardenLabel?: string;
}

export interface HarthmereHomeConsoleVisibleSeed {
  seedItemId: string;
  cropItemId: string;
  cropCount: number;
  growDurationMs: number;
  displayName: string;
  ownedCount: number;
  canPlant: boolean;
}

export interface HarthmereHomeConsolePanelModel {
  canAccess: boolean;
  accessReason: HarthmereHomeConsoleAccessReason;
  property?: BuildingSystemPropertyRecord;
  propertyDisplayName: string;
  consoleMarker?: BuildingSystemInWorldMarker;
  summary: HarthmereHomeDecorationPropertySummary;
  placeable: HarthmereHomeConsoleVisibleDefinition[];
  placed: HarthmereHomeConsoleVisibleDecoration[];
  seeds: HarthmereHomeConsoleVisibleSeed[];
}

export interface HarthmereHomeConsoleInteractionPrompt {
  visible: boolean;
  propertyId?: string;
  consoleId?: string;
  label: string;
  helper: string;
  keyLabel: string;
}

export interface HarthmereHomeConsoleSubmitPayload {
  operation: HarthmereHomeDecorationOperation;
  propertyId?: string;
  decorationId?: string;
  itemId?: string;
  seedItemId?: string;
  position?: Partial<HarthmereHomeDecorationPosition>;
  rotationDegrees?: number;
}

export interface HarthmereHomeConsoleAdapter {
  isHydrated: () => boolean;
  getSnapshot: () => HarthmereHomeConsoleClientSnapshot | undefined;
  isAvailable: (context?: HarthmereHomeConsoleWorldContext) => boolean;
  getPanel: (
    context?: HarthmereHomeConsoleWorldContext
  ) => HarthmereHomeConsolePanelModel;
  getInteractionPrompt: (
    context: HarthmereHomeConsoleWorldContext
  ) => HarthmereHomeConsoleInteractionPrompt;
  placeDecoration: (
    itemId: string,
    payload?: Omit<HarthmereHomeConsoleSubmitPayload, "operation" | "itemId">
  ) => Promise<void>;
  moveDecoration: (
    decorationId: string,
    position: Partial<HarthmereHomeDecorationPosition>,
    rotationDegrees?: number
  ) => Promise<void>;
  removeDecoration: (decorationId: string) => Promise<void>;
  useDecoration: (decorationId: string) => Promise<void>;
  plantGarden: (decorationId: string, seedItemId: string) => Promise<void>;
  waterGarden: (decorationId: string) => Promise<void>;
  harvestGarden: (decorationId: string) => Promise<void>;
}

export interface CreateHarthmereHomeConsoleAdapterOptions {
  state: Partial<HarthmereHomeConsoleClientSnapshot> | undefined;
  context?: HarthmereHomeConsoleWorldContext;
  hydrated?: boolean;
  setState?: (state: HarthmereHomeConsoleClientSnapshot | undefined) => void;
  submit?: (payload: HarthmereHomeConsoleSubmitPayload) => Promise<{
    ok: boolean;
    buildingState?: Partial<HarthmereHomeConsoleClientSnapshot>;
    warnings?: string[];
  }>;
}

export interface SubmitHarthmereHomeDecorationMutationOptions {
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

const EMPTY_SUMMARY: HarthmereHomeDecorationPropertySummary = {
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
  summary: HarthmereHomeDecorationPropertySummary | undefined,
  propertyId = ""
): HarthmereHomeDecorationPropertySummary {
  return {
    ...EMPTY_SUMMARY,
    ...(summary ?? {}),
    propertyId: summary?.propertyId ?? propertyId,
    craftingStationIds: [...(summary?.craftingStationIds ?? [])],
  };
}

export function formatHarthmereHomeConsolePlayerLabel(
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
  effects: HarthmereHomeDecorationFunctionalEffects
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

function footprintLabel(definition: HarthmereHomeDecorationDefinition) {
  const fp = definition.footprint;
  return `${fp.width}x${fp.depth}x${fp.height}`;
}

function definitionVisual(
  definition: HarthmereHomeDecorationDefinition,
  item?: HarthmereItemDefinition
) {
  return harthmereResolveBikkieVisual({
    id: definition.itemId,
    label: definition.displayName,
    kind: item?.category ?? definition.kind,
    objectMetadata: item?.objectMetadata,
    bikkieGraphicHints: item?.objectMetadata?.bikkieGraphicHints,
    description: item?.description,
  });
}

function defaultPanel(
  reason: HarthmereHomeConsoleAccessReason
): HarthmereHomeConsolePanelModel {
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
  snapshot: HarthmereHomeConsoleClientSnapshot,
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
  snapshot: HarthmereHomeConsoleClientSnapshot,
  property: BuildingSystemPropertyRecord
): BuildingSystemInWorldMarker | undefined {
  const expectedId = buildingSystemHomeConsoleMarkerId(property.propertyId);
  const existing =
    snapshot.inWorldMarkers[expectedId] ??
    Object.values(snapshot.inWorldMarkers).find(
      (marker) =>
        marker.kind === "home_console" && marker.plotId === property.plotId
    );
  if (existing) return existing;
  const plot = buildingSystemPlotById(property.plotId);
  const blueprint = buildingSystemBlueprintById(property.blueprintId);
  if (!plot || !blueprint) return undefined;
  return createBuildingSystemHomeConsoleMarker({
    property,
    plot,
    blueprint,
    nowMs: snapshot.nowMs,
  });
}

function markerDistanceSq(
  marker: BuildingSystemInWorldMarker,
  point: HarthmereHomeConsoleWorldPoint
) {
  const dx = Number(marker.position[0]) - point.x;
  const dy = Number(marker.position[1]) - Number(point.y ?? marker.position[1]);
  const dz = Number(marker.position[2]) - point.z;
  return dx * dx + dy * dy + dz * dz;
}

function propertyForMarker(
  snapshot: HarthmereHomeConsoleClientSnapshot,
  markerId: string
) {
  const marker = snapshot.inWorldMarkers[markerId];
  if (!marker || marker.kind !== "home_console") return undefined;
  return Object.values(snapshot.completedProperties).find(
    (property) => property.plotId === marker.plotId
  );
}

function resolveProperty(
  snapshot: HarthmereHomeConsoleClientSnapshot,
  context: HarthmereHomeConsoleWorldContext
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
  snapshot: HarthmereHomeConsoleClientSnapshot,
  canAccess: boolean
): HarthmereHomeConsoleVisibleDefinition[] {
  ensureHarthmereProductionCraftingCatalogue();
  return listHarthmereHomeDecorationDefinitions()
    .filter((definition) => definition.allowedPropertyUses.includes("home"))
    .map((definition) => {
      const item = getHarthmereItemDefinition(definition.itemId);
      const ownedCount = Math.max(
        0,
        snapshot.inventoryItems[definition.itemId] ?? 0
      );
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
  snapshot: HarthmereHomeConsoleClientSnapshot,
  canAccess: boolean
): HarthmereHomeConsoleVisibleSeed[] {
  return listHarthmereHomeDecorationGardenSeeds().map((seed) => {
    const item = getHarthmereItemDefinition(seed.seedItemId);
    const ownedCount = Math.max(
      0,
      snapshot.inventoryItems[seed.seedItemId] ?? 0
    );
    return {
      ...seed,
      displayName:
        item?.displayName ??
        formatHarthmereHomeConsolePlayerLabel(seed.seedItemId),
      ownedCount,
      canPlant: canAccess && ownedCount > 0,
    };
  });
}

function gardenStatus(
  record: HarthmereHomeDecorationRecord,
  nowMs: number
): HarthmereHomeConsoleVisibleDecoration["gardenStatus"] {
  if (record.kind !== "garden") return "none";
  if (!record.garden) return "empty";
  return record.garden.readyAtMs && nowMs >= record.garden.readyAtMs
    ? "ready"
    : "growing";
}

function visiblePlaced(
  snapshot: HarthmereHomeConsoleClientSnapshot,
  property: BuildingSystemPropertyRecord,
  canAccess: boolean
): HarthmereHomeConsoleVisibleDecoration[] {
  return Object.values(snapshot.homeDecoration.placed)
    .filter((record) => record.propertyId === property.propertyId)
    .sort((left, right) => left.installedAtMs - right.installedAtMs)
    .map((record) => {
      const definition = getHarthmereHomeDecorationDefinition(record.itemId);
      const item = getHarthmereItemDefinition(record.itemId);
      const status = gardenStatus(record, snapshot.nowMs);
      const garden = record.garden;
      return {
        record,
        definition,
        item,
        visual: definition
          ? definitionVisual(definition, item)
          : harthmereResolveBikkieVisual({
              id: record.itemId,
              label: record.displayName,
              kind: record.kind,
            }),
        canUse: canAccess && !!definition?.functionalEffects.craftingStationId,
        canMove: canAccess,
        canRemove: canAccess,
        gardenStatus: status,
        gardenLabel: garden
          ? `${formatHarthmereHomeConsolePlayerLabel(garden.cropItemId)} x${
              garden.cropCount
            }`
          : undefined,
      };
    });
}

export function normalizeHarthmereHomeConsoleClientSnapshot(
  input: Partial<HarthmereHomeConsoleClientSnapshot> | undefined
): HarthmereHomeConsoleClientSnapshot {
  ensureHarthmereProductionCraftingCatalogue();
  return {
    actorId: input?.actorId ?? "",
    gold: Math.max(0, Math.trunc(Number(input?.gold ?? 0))),
    inventoryItems: { ...(input?.inventoryItems ?? {}) },
    completedProperties: { ...(input?.completedProperties ?? {}) },
    homeDecoration: normalizeHarthmereHomeDecorationState(
      input?.homeDecoration ?? defaultHarthmereHomeDecorationState()
    ),
    inWorldMarkers: { ...(input?.inWorldMarkers ?? {}) },
    nowMs: Math.max(0, Math.trunc(Number(input?.nowMs ?? Date.now()))),
  };
}

export function listHarthmereHomeConsoleMarkers(
  snapshot: Partial<HarthmereHomeConsoleClientSnapshot> | undefined
) {
  const normalized = normalizeHarthmereHomeConsoleClientSnapshot(snapshot);
  return homePropertiesForActor(normalized)
    .map((property) => markerForProperty(normalized, property))
    .filter((marker): marker is BuildingSystemInWorldMarker => !!marker);
}

export function getHarthmereHomeConsolePanel(
  snapshotInput: Partial<HarthmereHomeConsoleClientSnapshot> | undefined,
  context: HarthmereHomeConsoleWorldContext = {}
): HarthmereHomeConsolePanelModel {
  if (!snapshotInput) return defaultPanel("missing_property");
  const snapshot = normalizeHarthmereHomeConsoleClientSnapshot(snapshotInput);
  const property = resolveProperty(snapshot, context);
  if (!property) {
    return defaultPanel(
      context.insideHome ? "missing_property" : "not_inside_home"
    );
  }
  const marker = markerForProperty(snapshot, property);
  const access = canAccessHarthmereHomeConsole(property, {
    actorId: snapshot.actorId,
    insideHome: context.insideHome,
    nearbyConsoleId: context.nearbyConsoleId ?? null,
    requireNearbyConsole: true,
  });
  const propertyDisplayName =
    buildingSystemBlueprintById(property.blueprintId)?.displayName ??
    formatHarthmereHomeConsolePlayerLabel(property.blueprintId) ??
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

export function getHarthmereHomeConsoleInteractionPrompt(
  snapshot: Partial<HarthmereHomeConsoleClientSnapshot> | undefined,
  context: HarthmereHomeConsoleWorldContext
): HarthmereHomeConsoleInteractionPrompt {
  const panel = getHarthmereHomeConsolePanel(snapshot, context);
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

export function nearestHarthmereHomeConsoleWorldContext(
  snapshotInput: Partial<HarthmereHomeConsoleClientSnapshot> | undefined,
  playerPosition: HarthmereHomeConsoleWorldPoint | undefined,
  radius = 5
): HarthmereHomeConsoleWorldContext {
  if (!snapshotInput || !playerPosition) {
    return { insideHome: false };
  }
  const snapshot = normalizeHarthmereHomeConsoleClientSnapshot(snapshotInput);
  const markers = listHarthmereHomeConsoleMarkers(snapshot);
  let best:
    | { marker: BuildingSystemInWorldMarker; distanceSq: number }
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
    interactionPosition: {
      x: best.marker.position[0],
      y: best.marker.position[1],
      z: best.marker.position[2],
    },
  };
}

export async function fetchHarthmereHomeConsoleBuildingState(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    "/api/harthmere/live_mode_building_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.buildingState
    ? normalizeHarthmereHomeConsoleClientSnapshot(body.buildingState)
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
    case "decoration_off_voxel_grid":
    case "decoration_not_on_floor":
    case "decoration_outside_guide_interior":
    case "decoration_blocks_guide_clearance":
    case "decoration_overlaps_existing":
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

export function formatHarthmereHomeConsolePlayerError(warnings?: string[]) {
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

export async function submitHarthmereHomeDecorationMutation(
  payload: HarthmereHomeConsoleSubmitPayload,
  options: SubmitHarthmereHomeDecorationMutationOptions = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId =
    options.requestId ??
    `home_console_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl as typeof fetch,
    "/api/harthmere/live_mode",
    {
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
    }
  );
  if (!response.ok) {
    throw new Error("The home console is unavailable right now.");
  }
  const body = await response.json();
  const warnings: string[] =
    body?.backendMutation?.warnings ??
    body?.summary?.warnings ??
    body?.warnings ??
    [];
  const rejected = warnings.filter((warning) =>
    String(warning).startsWith("home_decoration_rejected:")
  );
  if (rejected.length > 0) {
    throw new Error(formatHarthmereHomeConsolePlayerError(rejected));
  }
  return {
    ok: body?.ok !== false,
    buildingState: body?.buildingState,
    warnings,
  };
}

export function createHarthmereHomeConsoleAdapter({
  state,
  context = {},
  hydrated = true,
  setState,
  submit,
}: CreateHarthmereHomeConsoleAdapterOptions): HarthmereHomeConsoleAdapter {
  let current = state
    ? normalizeHarthmereHomeConsoleClientSnapshot(state)
    : undefined;
  const updateState = (
    buildingState: Partial<HarthmereHomeConsoleClientSnapshot> | undefined
  ) => {
    if (!buildingState) return;
    current = normalizeHarthmereHomeConsoleClientSnapshot({
      ...current,
      ...buildingState,
    });
    setState?.(current);
  };
  const mutate = async (payload: HarthmereHomeConsoleSubmitPayload) => {
    if (!submit) return;
    const body = await submit(payload);
    if (!body.ok) {
      throw new Error(formatHarthmereHomeConsolePlayerError(body.warnings));
    }
    updateState(body.buildingState);
  };
  const propertyId = () =>
    getHarthmereHomeConsolePanel(current, context).property?.propertyId;
  const withProperty = (
    payload: HarthmereHomeConsoleSubmitPayload
  ): HarthmereHomeConsoleSubmitPayload => ({
    ...payload,
    propertyId: payload.propertyId ?? propertyId(),
  });
  return {
    isHydrated: () => hydrated,
    getSnapshot: () => current,
    isAvailable: (nextContext = context) =>
      hydrated && getHarthmereHomeConsolePanel(current, nextContext).canAccess,
    getPanel: (nextContext = context) =>
      getHarthmereHomeConsolePanel(current, nextContext),
    getInteractionPrompt: (nextContext) =>
      getHarthmereHomeConsoleInteractionPrompt(current, nextContext),
    placeDecoration: (itemId, payload = {}) =>
      mutate(
        withProperty({ ...payload, operation: "place_decoration", itemId })
      ),
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
