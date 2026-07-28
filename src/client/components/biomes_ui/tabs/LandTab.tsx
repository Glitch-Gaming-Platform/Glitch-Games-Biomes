// LandTab — production Building System UI for Grove land, voxel blueprints,
// staged construction, and completed property management.
//
// This tab intentionally reads the real shared Building System catalogue instead
// of UI placeholders. Mutations go through /api/harthmere/live_mode so server
// auth, validation, plot ownership, safe-ground edits, and voxel materialization
// remain authoritative.

import {
  BUILDING_SYSTEM_BLUEPRINTS,
  BUILDING_SYSTEM_BUSINESS_TYPES,
  BUILDING_SYSTEM_GROVE_STEWARD_NPC,
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST,
  BUILDING_SYSTEM_LAND_REQUEST_AREAS,
  BUILDING_SYSTEM_PLOTS,
  BUILDING_SYSTEM_PLOT_SIZE_OPTIONS,
  BUILDING_SYSTEM_STAGE_ORDER,
  buildingSystemBlueprintById,
  buildingSystemPlotDimensions,
  buildingSystemRequestedPlotPriceGold,
  buildingSystemMaterialSourceForSymbol,
  buildingSystemHomeConsoleMarkerId,
  buildingSystemMaterialRequirementLines,
  createBuildingSystemPlacementPreview,
  type BuildingSystemBlueprintDefinition,
  type BuildingSystemBusinessRecord,
  type BuildingSystemDoorLockRecord,
  type BuildingSystemInWorldMarker,
  type BuildingSystemMaterialRequirementLine,
  type BuildingSystemMaterialSourceDefinition,
  type BuildingSystemPlotDefinition,
  type BuildingSystemProjectRecord,
  type BuildingSystemPropertyRecord,
  type BuildingSystemStorageContainerRecord,
  type BuildingSystemStage,
} from "@/shared/harthmere/building_system";
import * as React from "react";
import { submitHarthmereBuildingLiveModeAction } from "@/client/components/harthmere_building_live_mode";
import { requestBiomesUILocateOnMap } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  landTabPlotCategory,
  landTabPlotCenter,
  type LandTabPlotCategory,
} from "@/client/components/biomes_ui/tabs/landTabPlotCategory";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import {
  biomesPlayerList,
  biomesPlayerSentence,
  biomesPlayerTitle,
} from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

type BuildingSystemAction =
  | "read_state"
  | "talk_to_steward"
  | "claim_plot"
  | "terraform_plot"
  | "place"
  | "start_construction"
  | "contribute_stage"
  | "manage_property"
  | "set_access_mode"
  | "set_permission"
  | "add_guest"
  | "remove_guest"
  | "pay_property_tax"
  | "repair_property"
  | "upgrade_property"
  | "demolish_property"
  | "abandon_property"
  | "list_property_for_sale"
  | "transfer_property"
  | "preview_blueprint"
  | "open_door"
  | "use_storage"
  | "start_business"
  | "run_business_cycle"
  | "collect_business_revenue";

type BuildingUiStep =
  | "steward"
  | "plots"
  | "blueprints"
  | "construction"
  | "property";

interface BuildingSystemLandAdapter {
  isHydrated?: () => boolean;
  getPlots?: () => BuildingSystemPlotDefinition[];
  getBlueprints?: () => BuildingSystemBlueprintDefinition[];
  getOwnedPlotIds?: () => string[];
  getPlacedStructureIds?: () => string[];
  getBuildingState?: () => unknown;
  submitBuildingAction?: (
    action: BuildingSystemAction,
    payload: Record<string, unknown>
  ) => Promise<BuildingActionResponse>;
}

interface BuildingActionResponse {
  ok?: boolean;
  persisted?: boolean;
  backendMutation?: {
    warnings?: string[];
    touchedModels?: string[];
  };
  buildingState?: unknown;
  validation?: {
    ok?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  warnings?: string[];
  errors?: string[];
}

interface CustomPlotRequestPayload {
  requestAreaId: string;
  blueprintId: string;
  plotWidth: number;
  plotDepth: number;
  centerX: number;
  centerZ: number;
}

const UI_STEPS: Array<{
  key: BuildingUiStep;
  code: string;
  label: string;
  hint: string;
}> = [
  {
    key: "steward",
    code: "NPC",
    label: "Talk",
    hint: "Talk to Mira or use the Grove board.",
  },
  {
    key: "plots",
    code: "LOT",
    label: "Buy Plot",
    hint: "Claim muck land and make it safe.",
  },
  {
    key: "blueprints",
    code: "BPR",
    label: "Blueprint",
    hint: "Pick a legal voxel structure.",
  },
  {
    key: "construction",
    code: "BLD",
    label: "Build",
    hint: "Start construction and contribute stages.",
  },
  {
    key: "property",
    code: "KEY",
    label: "Manage",
    hint: "Permissions, taxes, storage, business, guild.",
  },
];

const STAGE_ORDER: BuildingSystemStage[] = [...BUILDING_SYSTEM_STAGE_ORDER];

const BUILDING_ACTION_LABELS: Record<BuildingSystemAction, string> = {
  read_state: "checking your land",
  talk_to_steward: "talking with Mira",
  claim_plot: "claiming the plot",
  terraform_plot: "terraforming the plot",
  place: "placing the building",
  start_construction: "starting construction",
  contribute_stage: "adding materials",
  manage_property: "checking property details",
  set_access_mode: "changing access",
  set_permission: "updating permission",
  add_guest: "adding a guest",
  remove_guest: "removing a guest",
  pay_property_tax: "paying taxes",
  repair_property: "repairing the property",
  upgrade_property: "upgrading the property",
  demolish_property: "demolishing the property",
  abandon_property: "leaving the property",
  list_property_for_sale: "listing the property for sale",
  transfer_property: "transferring ownership",
  preview_blueprint: "previewing the blueprint",
  open_door: "opening the door",
  use_storage: "opening storage",
  start_business: "opening the shop",
  run_business_cycle: "serving customers",
  collect_business_revenue: "collecting earnings",
};

interface BuildingSystemClientState {
  actorId?: string;
  gold: number;
  inventoryItems: Record<string, number>;
  materialStorage: Record<string, number>;
  ownedPlotIds: string[];
  customPlots: Record<string, BuildingSystemPlotDefinition>;
  safeZones: Record<
    string,
    { safeFromMuck: boolean; activatedAtMs: number; area: string }
  >;
  activeProjects: Record<string, BuildingSystemProjectRecord>;
  placedStructureIds: string[];
  completedProperties: Record<string, BuildingSystemPropertyRecord>;
  buildingProgress: Record<string, number>;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarker>;
  storageContainers: Record<string, BuildingSystemStorageContainerRecord>;
  doorLocks: Record<string, BuildingSystemDoorLockRecord>;
  businesses: Record<string, BuildingSystemBusinessRecord>;
}

const EMPTY_BUILDING_CLIENT_STATE: BuildingSystemClientState = {
  actorId: undefined,
  gold: 0,
  inventoryItems: {},
  materialStorage: {},
  ownedPlotIds: [],
  customPlots: {},
  safeZones: {},
  activeProjects: {},
  placedStructureIds: [],
  completedProperties: {},
  buildingProgress: {},
  inWorldMarkers: {},
  storageContainers: {},
  doorLocks: {},
  businesses: {},
};

function normalizeBuildingClientState(
  input: unknown
): BuildingSystemClientState {
  const raw = typeof input === "object" && input !== null ? (input as any) : {};
  return {
    actorId: typeof raw.actorId === "string" ? raw.actorId : undefined,
    gold: Number.isFinite(Number(raw.gold)) ? Number(raw.gold) : 0,
    inventoryItems:
      typeof raw.inventoryItems === "object" && raw.inventoryItems !== null
        ? raw.inventoryItems
        : {},
    materialStorage:
      typeof raw.materialStorage === "object" && raw.materialStorage !== null
        ? raw.materialStorage
        : {},
    ownedPlotIds: Array.isArray(raw.ownedPlotIds) ? raw.ownedPlotIds : [],
    customPlots:
      typeof raw.customPlots === "object" && raw.customPlots !== null
        ? raw.customPlots
        : {},
    safeZones:
      typeof raw.safeZones === "object" && raw.safeZones !== null
        ? raw.safeZones
        : {},
    activeProjects:
      typeof raw.activeProjects === "object" && raw.activeProjects !== null
        ? raw.activeProjects
        : {},
    placedStructureIds: Array.isArray(raw.placedStructureIds)
      ? raw.placedStructureIds
      : [],
    completedProperties:
      typeof raw.completedProperties === "object" &&
      raw.completedProperties !== null
        ? raw.completedProperties
        : {},
    buildingProgress:
      typeof raw.buildingProgress === "object" && raw.buildingProgress !== null
        ? raw.buildingProgress
        : {},
    inWorldMarkers:
      typeof raw.inWorldMarkers === "object" && raw.inWorldMarkers !== null
        ? raw.inWorldMarkers
        : {},
    storageContainers:
      typeof raw.storageContainers === "object" &&
      raw.storageContainers !== null
        ? raw.storageContainers
        : {},
    doorLocks:
      typeof raw.doorLocks === "object" && raw.doorLocks !== null
        ? raw.doorLocks
        : {},
    businesses:
      typeof raw.businesses === "object" && raw.businesses !== null
        ? raw.businesses
        : {},
  };
}

function activeProjectForPlot(
  state: BuildingSystemClientState,
  plotId: string | undefined
) {
  if (!plotId) return undefined;
  return Object.values(state.activeProjects).find(
    (project) => project.plotId === plotId && project.status !== "cancelled"
  );
}

function propertyIdForPlot(plotId: string) {
  return `property_${plotId}`;
}

function stageLabel(stage: BuildingSystemStage): string {
  return biomesPlayerTitle(stage);
}

function actionLabel(action: BuildingSystemAction): string {
  return BUILDING_ACTION_LABELS[action] ?? biomesPlayerSentence(action);
}

function actionLabelStart(action: BuildingSystemAction): string {
  const label = actionLabel(action);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function placementNoteLabel(note: string): string {
  switch (note) {
    case "preview_warning:plot_not_owned":
      return "Buy this plot first";
    case "preview_warning:footprint_outside_plot":
    case "guide_warning:footprint_outside_plot":
      return "Footprint outside plot";
    case "preview_warning:coverage_exceeds_plot_limit":
    case "guide_warning:coverage_exceeds_plot_limit":
      return "Covers too much of the plot";
    case "preview_warning:floor_not_one_voxel_above_ground":
    case "guide_warning:floor_not_one_voxel_above_ground":
      return "Floor is not grounded";
    case "preview_warning:doorsill_stair_outside_plot":
    case "guide_warning:doorsill_stair_outside_plot":
      return "Door step outside plot";
    case "guide_warning:customer_space_below_guide":
      return "Tight customer floor space";
    default:
      return biomesPlayerSentence(note);
  }
}

function formatMaterials(
  blueprint: BuildingSystemBlueprintDefinition,
  stage: BuildingSystemStage,
  project?: BuildingSystemProjectRecord
): string {
  const lines = buildingSystemMaterialRequirementLines({
    blueprint,
    stage,
    contributed: project?.stageProgress[stage]?.materials,
  });
  if (!lines.length) return "No extra materials";
  return lines
    .map((line) => `${line.displayName} ×${line.remaining}`)
    .join(" · ");
}

interface BuildingStageMaterialAvailabilityLine
  extends BuildingSystemMaterialRequirementLine {
  inventoryCount: number;
  storageCount: number;
  available: number;
  missing: number;
}

function countRecordKeys(record: Record<string, number>, keys: string[]) {
  let count = 0;
  for (const key of new Set(keys.filter(Boolean))) {
    count += Math.max(0, Math.trunc(Number(record[key] ?? 0) || 0));
  }
  return count;
}

function materialLookupKeys(line: BuildingSystemMaterialRequirementLine) {
  return [line.itemId, line.material, line.bikkieName].filter(Boolean);
}

function buildingSystemMaterialAvailabilityForStage(input: {
  blueprint: BuildingSystemBlueprintDefinition;
  stage: BuildingSystemStage;
  project?: BuildingSystemProjectRecord;
  state: Pick<BuildingSystemClientState, "inventoryItems" | "materialStorage">;
}): BuildingStageMaterialAvailabilityLine[] {
  return buildingSystemMaterialRequirementLines({
    blueprint: input.blueprint,
    stage: input.stage,
    contributed: input.project?.stageProgress[input.stage]?.materials,
  }).map((line) => {
    const keys = materialLookupKeys(line);
    const inventoryCount = countRecordKeys(input.state.inventoryItems, keys);
    const storageCount = countRecordKeys(input.state.materialStorage, keys);
    const available = inventoryCount + storageCount;
    return {
      ...line,
      inventoryCount,
      storageCount,
      available,
      missing: Math.max(0, line.remaining - available),
    };
  });
}

function buildingSystemStageProgressPercent(input: {
  blueprint: BuildingSystemBlueprintDefinition;
  stage: BuildingSystemStage;
  project?: BuildingSystemProjectRecord;
}) {
  if (input.stage === "completed") return 100;
  const progress = input.project?.stageProgress[input.stage];
  const materialLines = buildingSystemMaterialRequirementLines({
    blueprint: input.blueprint,
    stage: input.stage,
    contributed: progress?.materials,
  });
  const totalMaterials = materialLines.reduce(
    (sum, line) => sum + line.required,
    0
  );
  const contributedMaterials = materialLines.reduce(
    (sum, line) => sum + Math.min(line.required, line.contributed),
    0
  );
  const materialRatio =
    totalMaterials > 0 ? contributedMaterials / totalMaterials : 1;
  const laborRequired = Math.max(
    0,
    input.blueprint.laborStages[input.stage] ?? 0
  );
  const laborRatio =
    laborRequired > 0
      ? Math.min(1, Math.max(0, (progress?.labor ?? 0) / laborRequired))
      : 1;
  return Math.round(((materialRatio + laborRatio) / 2) * 100);
}

function materialDefinitionForItemId(itemId: string) {
  return Object.values(BUILDING_SYSTEM_MATERIAL_CATALOG).find((entry) =>
    [entry.itemId, entry.material, entry.bikkieName].includes(itemId)
  );
}

function playerFacingBuildingWarning(warning: string): string | undefined {
  if (!warning || warning === "client_request_missing_client_sent_time") {
    return undefined;
  }
  if (warning.startsWith("building_stage_rejected:insufficient_material:")) {
    const itemId = warning.split(":").pop() ?? "";
    const material = materialDefinitionForItemId(itemId);
    return material
      ? `Missing ${material.displayName}. Bring it in your backpack or material storage.`
      : "Missing a required building material.";
  }
  if (warning === "building_stage_rejected:missing_material_submission") {
    return "This stage needs materials before labor can be applied.";
  }
  if (warning === "building_project_idempotent:project_already_exists") {
    return "Construction is already started. Continue the highlighted stage.";
  }
  if (warning === "building_project_idempotent:property_already_completed") {
    return "This property is already built.";
  }
  if (warning.includes(":insufficient_gold")) {
    return "Not enough gold for this step.";
  }
  if (warning.includes(":plot_not_owned")) {
    return "Buy this plot before building here.";
  }
  if (warning.includes(":plot_owned_by_another_actor")) {
    return "That land is already owned by another player.";
  }
  if (warning.includes(":area_already_claimed")) {
    return "The requested boundary overlaps land that is already owned.";
  }
  if (
    warning.includes(":existing_building") ||
    warning.includes(":existing_native_structure")
  ) {
    return "The requested land contains an existing building or structure.";
  }
  if (warning.includes(":outside_request_area")) {
    return "Move the requested center or choose a smaller plot inside this area.";
  }
  if (warning.includes(":plot_too_small_for_blueprint")) {
    return "Choose a larger plot for that building plan.";
  }
  if (warning.includes(":blueprint_not_allowed")) {
    return "That blueprint does not fit this plot.";
  }
  if (warning.includes(":active_project_not_found")) {
    return "Start construction before adding materials.";
  }
  if (warning.includes(":stage_out_of_order")) {
    return "Finish the highlighted stage first.";
  }
  return biomesPlayerSentence(warning);
}

function playerFacingBuildingWarnings(
  response: BuildingActionResponse | undefined
) {
  return [
    ...(response?.validation?.errors ?? []),
    ...(response?.backendMutation?.warnings ?? []),
    ...(response?.warnings ?? []),
    ...(response?.errors ?? []),
  ]
    .map((warning) => playerFacingBuildingWarning(String(warning)))
    .filter((warning): warning is string => Boolean(warning));
}

function responseRejected(
  response: BuildingActionResponse | undefined
): boolean {
  if (!response) return true;
  const warnings = [
    ...(response.warnings ?? []),
    ...(response.validation?.errors ?? []),
    ...(response.backendMutation?.warnings ?? []),
  ].map((warning) => String(warning).toLowerCase());
  return (
    response.ok === false ||
    warnings.some((warning) => warning.includes("rejected"))
  );
}

function buildingSystemMapMarkerIdForPlot(
  plot: BuildingSystemPlotDefinition,
  owned: boolean
) {
  return owned ? `property:${plot.plotId}` : `plot_for_sale:${plot.plotId}`;
}

function buildingSystemMaterialSourcePin(
  line: Pick<BuildingStageMaterialAvailabilityLine, "material" | "displayName">,
  source: BuildingSystemMaterialSourceDefinition,
  nowMs = Date.now()
) {
  return {
    markerId: `building_material_source:${line.material}:${source.sourceId}`,
    label: `${source.actionLabel}: ${source.sourceName}`,
    kind: source.sourceKind === "buy" ? "store" : "resource",
    worldPosition: source.position,
    description: `${line.displayName} source. ${source.description}`,
    setAtMs: nowMs,
  };
}

export const buildingSystemMaterialAvailabilityForStageForTest =
  buildingSystemMaterialAvailabilityForStage;
export const buildingSystemStageProgressPercentForTest =
  buildingSystemStageProgressPercent;
export const playerFacingBuildingWarningsForTest = playerFacingBuildingWarnings;
export const buildingSystemMapMarkerIdForPlotForTest =
  buildingSystemMapMarkerIdForPlot;
export const buildingSystemMaterialSourcePinForTest =
  buildingSystemMaterialSourcePin;

async function submitBuildingActionThroughLiveModeRoute(
  action: BuildingSystemAction,
  payload: Record<string, unknown>
): Promise<BuildingActionResponse> {
  return submitHarthmereBuildingLiveModeAction(action, payload);
}

function useBuildingSystemBackend(
  adapter: BuildingSystemLandAdapter | undefined,
  onBuildingState: (state: BuildingSystemClientState) => void
) {
  const [pendingAction, setPendingAction] =
    React.useState<BuildingSystemAction | null>(null);
  const [lastResponse, setLastResponse] =
    React.useState<string>("Ready to build.");

  const submit = React.useCallback(
    async (action: BuildingSystemAction, payload: Record<string, unknown>) => {
      setPendingAction(action);
      try {
        const response = await (
          adapter?.submitBuildingAction ??
          submitBuildingActionThroughLiveModeRoute
        )(action, payload);
        if (response.buildingState) {
          onBuildingState(normalizeBuildingClientState(response.buildingState));
        }
        const visibleWarnings = playerFacingBuildingWarnings(response);
        const status = responseRejected(response)
          ? `${actionLabelStart(action)} needs attention: ${biomesPlayerList(
              visibleWarnings,
              "bring the listed materials and try again"
            )}.`
          : visibleWarnings.length > 0
          ? biomesPlayerList(visibleWarnings)
          : action === "preview_blueprint"
          ? "Blueprint preview is ready."
          : action === "read_state"
          ? "Your land is synced."
          : `${actionLabelStart(action)} is done.`;
        setLastResponse(status);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = `${actionLabelStart(
          action
        )} could not finish. ${biomesPlayerSentence(
          message,
          "Please try again."
        )}`;
        setLastResponse(status);
        return { ok: false, errors: [message] };
      } finally {
        setPendingAction(null);
      }
    },
    [adapter, onBuildingState]
  );

  return { submit, pendingAction, lastResponse };
}

function blueprintForPlot(
  plot: BuildingSystemPlotDefinition | undefined,
  blueprints: BuildingSystemBlueprintDefinition[],
  selectedBlueprintId: string | undefined
) {
  if (!plot) return undefined;
  return (
    blueprints.find(
      (blueprint) =>
        blueprint.blueprintId === selectedBlueprintId &&
        plot.allowedBlueprintIds.includes(blueprint.blueprintId)
    ) ??
    blueprints.find((blueprint) =>
      plot.allowedBlueprintIds.includes(blueprint.blueprintId)
    )
  );
}

function gridRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

function markerPositionHint(marker: BuildingSystemInWorldMarker | undefined) {
  if (!marker) return "Finishes with the building utilities.";
  if (marker.kind === "door_lock") return "At the front entrance.";
  if (marker.kind === "storage_container") return "Inside near the entry wall.";
  if (marker.kind === "home_console") return "Inside your home.";
  if (marker.kind === "business_marker") return "At the customer counter.";
  return "Marked in the building.";
}

function markerForPropertyAccessPoint(
  markers: Record<string, BuildingSystemInWorldMarker>,
  property: BuildingSystemPropertyRecord | undefined,
  kind: BuildingSystemInWorldMarker["kind"]
) {
  if (!property) return undefined;
  const markerId =
    kind === "storage_container"
      ? property.storageContainerId
      : kind === "door_lock"
      ? property.doorLockId
      : kind === "home_console"
      ? buildingSystemHomeConsoleMarkerId(property.propertyId)
      : kind === "business_marker"
      ? `${property.businessId ?? `business_${property.propertyId}`}:marker`
      : undefined;
  return (
    (markerId ? markers[markerId] : undefined) ??
    Object.values(markers).find(
      (marker) => marker.kind === kind && marker.plotId === property.plotId
    )
  );
}

export const LandTab: React.FunctionComponent<{
  adapter?: BuildingSystemLandAdapter;
  initialStep?: BuildingUiStep;
}> = ({ adapter, initialStep = "steward" }) => {
  const catalogPlots = adapter?.getPlots?.() ?? BUILDING_SYSTEM_PLOTS;
  const blueprints = adapter?.getBlueprints?.() ?? BUILDING_SYSTEM_BLUEPRINTS;
  const [step, setStep] = React.useState<BuildingUiStep>(initialStep);
  // Homes vs Business sub-tabs: the whole flow operates on the plots in the
  // active category.
  const [category, setCategory] = React.useState<LandTabPlotCategory>("homes");
  const [selectedPlotId, setSelectedPlotId] = React.useState<string>(
    catalogPlots.find((plot) => landTabPlotCategory(plot.plotType) === "homes")
      ?.plotId ??
      catalogPlots[0]?.plotId ??
      ""
  );
  const [selectedBlueprintId, setSelectedBlueprintId] = React.useState<string>(
    catalogPlots[0]?.allowedBlueprintIds[0] ?? blueprints[0]?.blueprintId ?? ""
  );
  const [serverState, setServerState] =
    React.useState<BuildingSystemClientState>(() => {
      const hydrated = normalizeBuildingClientState(
        adapter?.getBuildingState?.()
      );
      return {
        ...EMPTY_BUILDING_CLIENT_STATE,
        ...hydrated,
        ownedPlotIds: adapter?.getOwnedPlotIds?.() ?? hydrated.ownedPlotIds,
        placedStructureIds:
          adapter?.getPlacedStructureIds?.() ?? hydrated.placedStructureIds,
      };
    });
  // Custom deeds are returned by the same authoritative building snapshot.
  // Only this actor's requested plots join their catalogue; another player's
  // custom land remains unavailable without leaking it as a for-sale listing.
  const plots = React.useMemo(() => {
    const customOwnedPlots = Object.values(serverState.customPlots).filter(
      (plot) => serverState.ownedPlotIds.includes(plot.plotId)
    );
    return [
      ...catalogPlots,
      ...customOwnedPlots.filter(
        (plot) => !catalogPlots.some((entry) => entry.plotId === plot.plotId)
      ),
    ];
  }, [catalogPlots, serverState.customPlots, serverState.ownedPlotIds]);
  const categoryPlots = React.useMemo(
    () =>
      plots.filter((plot) => landTabPlotCategory(plot.plotType) === category),
    [plots, category]
  );
  const { submit, pendingAction, lastResponse } = useBuildingSystemBackend(
    adapter,
    setServerState
  );
  const selectedPlot =
    plots.find((plot) => plot.plotId === selectedPlotId) ?? plots[0];
  const selectedBlueprint = blueprintForPlot(
    selectedPlot,
    blueprints,
    selectedBlueprintId
  );
  const activeProject = activeProjectForPlot(serverState, selectedPlot?.plotId);
  const propertyId = selectedPlot
    ? propertyIdForPlot(selectedPlot.plotId)
    : undefined;
  const owned = selectedPlot
    ? serverState.ownedPlotIds.includes(selectedPlot.plotId) ||
      Boolean(
        serverState.completedProperties[propertyIdForPlot(selectedPlot.plotId)]
      )
    : false;
  const placed = selectedPlot
    ? Boolean(
        serverState.completedProperties[
          propertyIdForPlot(selectedPlot.plotId)
        ] || serverState.placedStructureIds.includes(selectedPlot.plotId)
      )
    : false;
  const terraformed = selectedPlot
    ? serverState.safeZones[selectedPlot.plotId]?.safeFromMuck === true
    : false;
  const currentStage =
    activeProject?.currentStage ?? (placed ? "completed" : "site_preparation");
  const completedProperty = propertyId
    ? serverState.completedProperties[propertyId]
    : undefined;
  const currentMaterialAvailability =
    selectedBlueprint && currentStage !== "completed"
      ? buildingSystemMaterialAvailabilityForStage({
          blueprint: selectedBlueprint,
          stage: currentStage,
          project: activeProject,
          state: serverState,
        })
      : [];
  const requestedInitialBuildingState = React.useRef(false);

  React.useEffect(() => {
    if (requestedInitialBuildingState.current) return;
    requestedInitialBuildingState.current = true;
    void submit("read_state", {});
  }, [submit]);

  // Keep the selection inside the active Homes/Business category.
  React.useEffect(() => {
    if (
      categoryPlots.length > 0 &&
      !categoryPlots.some((plot) => plot.plotId === selectedPlotId)
    ) {
      setSelectedPlotId(categoryPlots[0].plotId);
      setStep((current) => (current === "steward" ? current : "plots"));
    }
  }, [categoryPlots, selectedPlotId]);

  React.useEffect(() => {
    if (!selectedPlot) return;
    const allowed = selectedPlot.allowedBlueprintIds;
    if (!allowed.includes(selectedBlueprintId)) {
      setSelectedBlueprintId(allowed[0] ?? blueprints[0]?.blueprintId ?? "");
    }
  }, [selectedPlot, selectedBlueprintId, blueprints]);

  const talkToMira = React.useCallback(async () => {
    const response = await submit("talk_to_steward", {
      npcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC.id,
      questId: BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId,
    });
    if (!responseRejected(response)) {
      setStep("plots");
    }
  }, [submit]);

  const claimSelectedPlot = React.useCallback(async () => {
    if (!selectedPlot) return;
    const response = await submit("claim_plot", {
      plotId: selectedPlot.plotId,
    });
    if (!responseRejected(response)) {
      setStep("blueprints");
    }
  }, [selectedPlot, submit]);

  const requestCustomPlot = React.useCallback(
    async (request: CustomPlotRequestPayload) => {
      const ownedBefore = new Set(serverState.ownedPlotIds);
      const blueprint = buildingSystemBlueprintById(request.blueprintId);
      const response = await submit("claim_plot", {
        ...request,
        blueprintItemId: blueprint?.blueprintItemId,
        structureTypeId: blueprint?.structureTypeId,
      });
      if (responseRejected(response)) return;
      const nextState = normalizeBuildingClientState(response.buildingState);
      const requestedPlotId = nextState.ownedPlotIds.find(
        (plotId) => !ownedBefore.has(plotId) && nextState.customPlots[plotId]
      );
      if (requestedPlotId) {
        setSelectedPlotId(requestedPlotId);
        setSelectedBlueprintId(request.blueprintId);
      }
      setStep("blueprints");
    },
    [serverState.ownedPlotIds, submit]
  );

  const startSelectedBuilding = React.useCallback(async () => {
    if (!selectedPlot || !selectedBlueprint) return;
    const response = await submit("start_construction", {
      plotId: selectedPlot.plotId,
      blueprintId: selectedBlueprint.blueprintId,
      blueprintItemId: selectedBlueprint.blueprintItemId,
      structureTypeId: selectedBlueprint.structureTypeId,
    });
    if (!responseRejected(response)) {
      setStep("construction");
    }
  }, [selectedBlueprint, selectedPlot, submit]);

  const previewSelectedBuilding = React.useCallback(async () => {
    if (!selectedPlot || !selectedBlueprint) return;
    await submit("preview_blueprint", {
      plotId: selectedPlot.plotId,
      blueprintId: selectedBlueprint.blueprintId,
      blueprintItemId: selectedBlueprint.blueprintItemId,
      structureTypeId: selectedBlueprint.structureTypeId,
    });
  }, [selectedBlueprint, selectedPlot, submit]);

  const contributeStage = React.useCallback(async () => {
    if (!selectedPlot || !selectedBlueprint || currentStage === "completed")
      return;
    const response = await submit("contribute_stage", {
      projectId: activeProject?.projectId,
      plotId: selectedPlot.plotId,
      blueprintId: selectedBlueprint.blueprintId,
      blueprintItemId: selectedBlueprint.blueprintItemId,
      propertyId: propertyIdForPlot(selectedPlot.plotId),
      stage: currentStage,
      contributeAll: true,
      laborDelta: selectedBlueprint.laborStages[currentStage] ?? 0,
    });
    if (!responseRejected(response)) {
      const nextStage = activeProjectForPlot(
        normalizeBuildingClientState(response.buildingState),
        selectedPlot.plotId
      )?.currentStage;
      if (nextStage === "completed") setStep("property");
    }
  }, [
    activeProject?.projectId,
    currentStage,
    selectedBlueprint,
    selectedPlot,
    submit,
  ]);

  const manageProperty = React.useCallback(async () => {
    if (!selectedPlot || !selectedBlueprint) return;
    await submit("manage_property", {
      plotId: selectedPlot.plotId,
      blueprintId: selectedBlueprint.blueprintId,
      blueprintItemId: selectedBlueprint.blueprintItemId,
      propertyId: `property_${selectedPlot.plotId}`,
    });
  }, [selectedBlueprint, selectedPlot, submit]);

  const setAccessMode = React.useCallback(
    async (accessMode: "private" | "friends" | "guild" | "public") => {
      if (!selectedPlot) return;
      await submit("set_access_mode", {
        plotId: selectedPlot.plotId,
        propertyId: propertyIdForPlot(selectedPlot.plotId),
        accessMode,
      });
    },
    [selectedPlot, submit]
  );

  const runPropertyAction = React.useCallback(
    async (
      action: BuildingSystemAction,
      extra: Record<string, unknown> = {}
    ) => {
      if (!selectedPlot) return;
      await submit(action, {
        plotId: selectedPlot.plotId,
        propertyId: propertyIdForPlot(selectedPlot.plotId),
        ...extra,
      });
    },
    [selectedPlot, submit]
  );

  const terraformFromOwnedProperty = React.useCallback(async () => {
    await runPropertyAction("terraform_plot");
  }, [runPropertyAction]);

  const startGeneralBusiness = React.useCallback(async () => {
    await runPropertyAction("start_business", {
      businessType: "general_trader",
    });
  }, [runPropertyAction]);

  const runBusinessCycle = React.useCallback(async () => {
    await runPropertyAction("run_business_cycle", { cycles: 1 });
  }, [runPropertyAction]);

  const collectBusinessRevenue = React.useCallback(async () => {
    await runPropertyAction("collect_business_revenue", {});
  }, [runPropertyAction]);

  const selectPlot = React.useCallback((plot: BuildingSystemPlotDefinition) => {
    setSelectedPlotId(plot.plotId);
    setSelectedBlueprintId(plot.allowedBlueprintIds[0] ?? "");
  }, []);

  // "Locate on map": open the Map tab and center it on the plot, and drop a map
  // pin (+ minimap navigation aid) so the player can walk to it; the world hint
  // beam appears as they get close.
  const locatePlotOnMap = React.useCallback(
    (plot: BuildingSystemPlotDefinition) => {
      const plotOwned =
        serverState.ownedPlotIds.includes(plot.plotId) ||
        Boolean(
          serverState.completedProperties[propertyIdForPlot(plot.plotId)]
        );
      requestBiomesUILocateOnMap({
        markerId: buildingSystemMapMarkerIdForPlot(plot, plotOwned),
        label: plotOwned
          ? `Your property: ${plot.displayName}`
          : `For sale: ${plot.displayName}`,
        kind: "property",
        worldPosition: landTabPlotCenter(plot),
        setAtMs: Date.now(),
      });
    },
    [serverState.completedProperties, serverState.ownedPlotIds]
  );
  const locateMaterialSourceOnMap = React.useCallback(
    (line: BuildingStageMaterialAvailabilityLine) => {
      const source = buildingSystemMaterialSourceForSymbol(line.material);
      if (!source) return;
      requestBiomesUILocateOnMap(buildingSystemMaterialSourcePin(line, source));
    },
    []
  );

  return (
    <div
      className="biomes-building-system"
      data-testid="building-system-land-tab"
    >
      <section
        className="biomes-building-hero"
        aria-label="Building System summary"
      >
        <div>
          <div className="biomes-building-eyebrow">Grove Building System</div>
          <h3 className="biomes-building-title">
            Claim frontier land. Build with real voxels.
          </h3>
          <p className="biomes-building-copy">
            Talk to {BUILDING_SYSTEM_GROVE_STEWARD_NPC.displayName} to complete
            the {BUILDING_SYSTEM_MIRA_INTRO_QUEST.displayName} intro quest, then
            pick the Homes or Businesses tab to claim a plot in its designated
            frontier area, choose a blueprint, bring the needed materials, and
            manage access, taxes, upgrades, repairs, storage, and sale.
          </p>
        </div>
        <div className="biomes-building-status" aria-live="polite">
          <span className="biomes-building-status__label">Land Office</span>
          <strong>
            {pendingAction
              ? `${actionLabelStart(pendingAction)}...`
              : "Ready when you are"}
          </strong>
          <span>{lastResponse}</span>
        </div>
      </section>

      <div
        className="biomes-building-category-tabs"
        role="tablist"
        aria-label="Property category"
        style={{ display: "flex", gap: 8, margin: "8px 0" }}
      >
        {(["homes", "business"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={category === value}
            className="biomes-ui-tab"
            data-selected={category === value ? "true" : undefined}
            onClick={() => setCategory(value)}
          >
            {value === "homes" ? "Homes" : "Businesses"}
          </button>
        ))}
      </div>

      <BuildingStepRail activeStep={step} onStepChange={setStep} />

      <div className="biomes-building-layout">
        <aside
          className="biomes-building-sidebar"
          aria-label="Selected Grove plot"
        >
          {selectedPlot && selectedBlueprint ? (
            <SelectedPlotSummary
              plot={selectedPlot}
              blueprint={selectedBlueprint}
              owned={owned}
              placed={placed}
              terraformed={terraformed}
              stage={currentStage}
              onLocate={() => locatePlotOnMap(selectedPlot)}
            />
          ) : (
            <div className="biomes-building-card">
              No Grove building plots available.
            </div>
          )}
        </aside>

        <main className="biomes-building-main">
          {step === "steward" && (
            <StewardPanel
              onTalk={talkToMira}
              onManage={() => setStep("property")}
              pending={pendingAction === "talk_to_steward"}
            />
          )}
          {step === "plots" && (
            <>
              <PlotsPanel
                category={category}
                plots={categoryPlots}
                ownedPlotIds={serverState.ownedPlotIds}
                safeZones={serverState.safeZones}
                selectedPlotId={selectedPlot?.plotId}
                onSelect={selectPlot}
                onClaim={claimSelectedPlot}
                onLocate={locatePlotOnMap}
                pending={pendingAction === "claim_plot"}
              />
              <CustomPlotRequestPanel
                category={category}
                blueprints={blueprints}
                gold={serverState.gold}
                pending={pendingAction === "claim_plot"}
                onRequest={requestCustomPlot}
              />
            </>
          )}
          {step === "blueprints" && selectedPlot && (
            <BlueprintPanel
              plot={selectedPlot}
              blueprints={blueprints.filter((blueprint) =>
                selectedPlot.allowedBlueprintIds.includes(blueprint.blueprintId)
              )}
              selectedBlueprintId={selectedBlueprintId}
              onSelect={(blueprint) =>
                setSelectedBlueprintId(blueprint.blueprintId)
              }
              onStart={startSelectedBuilding}
              onPreview={previewSelectedBuilding}
              owned={owned}
              pending={pendingAction === "start_construction"}
            />
          )}
          {step === "construction" && selectedPlot && selectedBlueprint && (
            <ConstructionPanel
              plot={selectedPlot}
              blueprint={selectedBlueprint}
              owned={owned}
              placed={placed}
              stage={currentStage}
              project={activeProject}
              materialAvailability={currentMaterialAvailability}
              onStart={startSelectedBuilding}
              onContribute={contributeStage}
              onFindMaterial={locateMaterialSourceOnMap}
              pending={
                pendingAction === "start_construction" ||
                pendingAction === "contribute_stage"
              }
            />
          )}
          {step === "property" && selectedPlot && selectedBlueprint && (
            <PropertyPanel
              plot={selectedPlot}
              blueprint={selectedBlueprint}
              property={completedProperty}
              owned={owned}
              placed={placed}
              stage={currentStage}
              terraformed={terraformed}
              onManage={manageProperty}
              onTerraform={terraformFromOwnedProperty}
              onSetAccessMode={setAccessMode}
              onPayTaxes={() => runPropertyAction("pay_property_tax")}
              onRepair={() => runPropertyAction("repair_property")}
              onUpgrade={() => runPropertyAction("upgrade_property")}
              onDemolish={() => runPropertyAction("demolish_property")}
              onListForSale={() =>
                runPropertyAction("list_property_for_sale", {
                  salePriceGold:
                    completedProperty?.value ?? selectedBlueprint.goldCost,
                })
              }
              onOpenDoor={() =>
                runPropertyAction("open_door", {
                  doorLockId: completedProperty?.doorLockId,
                })
              }
              onUseStorage={() =>
                runPropertyAction("use_storage", {
                  containerId: completedProperty?.storageContainerId,
                })
              }
              onStartBusiness={startGeneralBusiness}
              onRunBusinessCycle={runBusinessCycle}
              onCollectBusinessRevenue={collectBusinessRevenue}
              storageContainers={serverState.storageContainers}
              doorLocks={serverState.doorLocks}
              inWorldMarkers={serverState.inWorldMarkers}
              businesses={serverState.businesses}
              pending={pendingAction === "manage_property"}
              terraformPending={pendingAction === "terraform_plot"}
            />
          )}
        </main>
      </div>
    </div>
  );
};

const BuildingStepRail: React.FunctionComponent<{
  activeStep: BuildingUiStep;
  onStepChange: (step: BuildingUiStep) => void;
}> = ({ activeStep, onStepChange }) => {
  const [focusedIndex, setFocusedIndex] = React.useState(() =>
    Math.max(
      0,
      UI_STEPS.findIndex((entry) => entry.key === activeStep)
    )
  );
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    const idx = UI_STEPS.findIndex((entry) => entry.key === activeStep);
    if (idx >= 0) setFocusedIndex(idx);
  }, [activeStep]);

  const focusIndex = React.useCallback((index: number) => {
    const next =
      ((index % UI_STEPS.length) + UI_STEPS.length) % UI_STEPS.length;
    setFocusedIndex(next);
    refs.current[next]?.focus();
  }, []);

  return (
    <div
      role="tablist"
      aria-label="Building System flow"
      className="biomes-building-step-rail biomes-ui-panel"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusIndex(focusedIndex + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusIndex(focusedIndex - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusIndex(0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusIndex(UI_STEPS.length - 1);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onStepChange(UI_STEPS[focusedIndex].key);
        }
      }}
    >
      {UI_STEPS.map((entry, index) => {
        const selected = activeStep === entry.key;
        return (
          <button
            key={entry.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="biomes-ui-tab biomes-building-step"
            onFocus={() => setFocusedIndex(index)}
            onClick={() => onStepChange(entry.key)}
            title={entry.hint}
          >
            <span>{entry.code}</span>
            <strong>{entry.label}</strong>
          </button>
        );
      })}
    </div>
  );
};

const StewardPanel: React.FunctionComponent<{
  onTalk: () => void;
  onManage: () => void;
  pending: boolean;
}> = ({ onTalk, onManage, pending }) => (
  <section className="biomes-building-card" aria-label="Grove land steward">
    <div className="biomes-building-eyebrow">NPC / Board</div>
    <h3 className="biomes-building-card-title">
      {BUILDING_SYSTEM_GROVE_STEWARD_NPC.displayName}
    </h3>
    <p className="biomes-building-quote">
      “{BUILDING_SYSTEM_GROVE_STEWARD_NPC.line}”
    </p>
    <div
      className="biomes-building-callout"
      aria-label="Business economy types"
    >
      <CardTitle
        title="Business economy"
        meta={`${BUILDING_SYSTEM_BUSINESS_TYPES.length} types`}
      />
      <p>
        Businesses use license level, inventory, contracts, upkeep, service
        radius, reputation, customer satisfaction, revenue balance, and taxes.
      </p>
    </div>
    <div className="biomes-building-actions">
      <Highlightable uniqueId={UI_IDS.BUILDING_TALK_STEWARD} showCaption>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onTalk}
          disabled={pending}
          aria-disabled={pending}
        >
          {pending ? "Talking…" : "Talk to Mira / Complete Intro Quest"}
        </button>
      </Highlightable>
      <button type="button" className="biomes-ui-tab" onClick={onManage}>
        Manage Property
      </button>
    </div>
  </section>
);

const PlotsPanel: React.FunctionComponent<{
  category: LandTabPlotCategory;
  plots: BuildingSystemPlotDefinition[];
  ownedPlotIds: string[];
  safeZones: BuildingSystemClientState["safeZones"];
  selectedPlotId?: string;
  onSelect: (plot: BuildingSystemPlotDefinition) => void;
  onClaim: () => void;
  onLocate: (plot: BuildingSystemPlotDefinition) => void;
  pending: boolean;
}> = ({
  category,
  plots,
  ownedPlotIds,
  safeZones,
  selectedPlotId,
  onSelect,
  onClaim,
  onLocate,
  pending,
}) => {
  const selectedPlot =
    plots.find((plot) => plot.plotId === selectedPlotId) ?? plots[0];
  const homes = category === "homes";
  return (
    <section aria-label={homes ? "Homes for sale" : "Businesses for sale"}>
      <PanelHeader
        label={homes ? "Homes For Sale" : "Businesses For Sale"}
        title={
          homes
            ? "Claim a homestead in the frontier"
            : "Claim a business plot in the frontier"
        }
        copy="Each plot sits in its own designated area away from the Grove. Pick one to see exactly where it is, then locate it on the map and walk over — the land glows light blue when it's for sale. Claiming records the deed; terraforming and building happen after."
      />
      {plots.length === 0 ? (
        <div className="biomes-building-card">
          No {homes ? "homes" : "businesses"} are for sale right now.
        </div>
      ) : (
        <RovingGrid
          ariaLabel={homes ? "Homes for sale" : "Businesses for sale"}
          items={gridRows(plots, 2)}
          onActivate={(_row, _col, plot) => onSelect(plot)}
          className="biomes-building-grid"
          renderCell={(plot, { focused }, cell) => {
            const center = landTabPlotCenter(plot);
            const dimensions = buildingSystemPlotDimensions(plot);
            const ownedPlot = ownedPlotIds.includes(plot.plotId);
            return (
              <Highlightable
                uniqueId={UI_IDS.BUILDING_PLOT(plot.plotId)}
                showCaption
              >
                <button
                  ref={(el) => cell.ref(el)}
                  type="button"
                  tabIndex={cell.tabIndex}
                  onFocus={cell.onFocus}
                  onClick={(event) => {
                    cell.onClick();
                    event.currentTarget.focus();
                  }}
                  onKeyDown={cell.onKeyDown}
                  aria-label={`${plot.displayName}, ${plot.claimPriceGold} gold, ${plot.district}, at x ${center[0]}, z ${center[2]}`}
                  data-focused={focused ? "true" : undefined}
                  data-selected={
                    selectedPlotId === plot.plotId ? "true" : undefined
                  }
                  className="biomes-building-card biomes-building-select-card"
                >
                  <CardTitle
                    title={plot.displayName}
                    meta={`${plot.claimPriceGold} gold`}
                  />
                  <div className="biomes-building-muted">{plot.district}</div>
                  <div className="biomes-building-muted">
                    Location: x {center[0]}, z {center[2]}
                  </div>
                  <div className="biomes-building-muted">
                    Plot size: {dimensions.width}×{dimensions.depth} ·{" "}
                    {dimensions.width * dimensions.depth} blocks
                  </div>
                  <p>{plot.description}</p>
                  <div className="biomes-building-chip-row">
                    <span className="biomes-building-chip">
                      {biomesPlayerTitle(plot.plotType)}
                    </span>
                    <span className="biomes-building-chip">
                      {ownedPlot
                        ? safeZones[plot.plotId]?.safeFromMuck === true
                          ? "Owned · Terraformed"
                          : "Owned · Muck deed"
                        : "For sale"}
                    </span>
                  </div>
                </button>
              </Highlightable>
            );
          }}
        />
      )}
      <div className="biomes-building-actions">
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={() => selectedPlot && onLocate(selectedPlot)}
          disabled={!selectedPlot}
          aria-disabled={!selectedPlot}
        >
          Locate on map
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onClaim}
          disabled={pending}
          aria-disabled={pending}
        >
          {pending ? "Claiming…" : "Buy selected plot"}
        </button>
      </div>
    </section>
  );
};

const CustomPlotRequestPanel: React.FunctionComponent<{
  category: LandTabPlotCategory;
  blueprints: BuildingSystemBlueprintDefinition[];
  gold: number;
  pending: boolean;
  onRequest: (request: CustomPlotRequestPayload) => void;
}> = ({ category, blueprints, gold, pending, onRequest }) => {
  const requestBlueprints = blueprints.filter((blueprint) =>
    category === "homes"
      ? blueprint.use === "home"
      : blueprint.use === "business"
  );
  const [areaId, setAreaId] = React.useState(
    BUILDING_SYSTEM_LAND_REQUEST_AREAS[0]?.areaId ?? ""
  );
  const [sizeId, setSizeId] = React.useState(
    BUILDING_SYSTEM_PLOT_SIZE_OPTIONS[0]?.sizeId ?? "small"
  );
  const [blueprintId, setBlueprintId] = React.useState(
    requestBlueprints[0]?.blueprintId ?? ""
  );
  const area =
    BUILDING_SYSTEM_LAND_REQUEST_AREAS.find(
      (candidate) => candidate.areaId === areaId
    ) ?? BUILDING_SYSTEM_LAND_REQUEST_AREAS[0];
  const size =
    BUILDING_SYSTEM_PLOT_SIZE_OPTIONS.find(
      (candidate) => candidate.sizeId === sizeId
    ) ?? BUILDING_SYSTEM_PLOT_SIZE_OPTIONS[0];
  const blueprint =
    requestBlueprints.find(
      (candidate) => candidate.blueprintId === blueprintId
    ) ?? requestBlueprints[0];
  const [centerX, setCenterX] = React.useState(() => area?.center[0] ?? 0);
  const [centerZ, setCenterZ] = React.useState(() => area?.center[2] ?? 0);

  React.useEffect(() => {
    if (!requestBlueprints.some((entry) => entry.blueprintId === blueprintId)) {
      setBlueprintId(requestBlueprints[0]?.blueprintId ?? "");
    }
  }, [blueprintId, requestBlueprints]);

  const quotedPrice =
    area && size
      ? Math.ceil(
          (buildingSystemRequestedPlotPriceGold({
            width: size.width,
            depth: size.depth,
            startsMucked: area.startsMucked,
          }) *
            area.priceMultiplier) /
            5
        ) * 5
      : 0;
  const fitsBlueprint = Boolean(
    size &&
      blueprint &&
      size.width >= blueprint.footprint.width &&
      size.depth >= blueprint.footprint.depth
  );
  const canRequest = Boolean(
    area &&
      size &&
      blueprint &&
      fitsBlueprint &&
      gold >= quotedPrice &&
      !pending
  );

  return (
    <section
      className="biomes-building-card biomes-building-request"
      aria-label="Request a different property area and size"
      data-building-custom-plot-request="production"
    >
      <PanelHeader
        label="Request Land"
        title="Choose another area and plot size"
        copy="Pick frontier land or serviced land in the additive Harthmere town, choose a size, and enter the center coordinates you want. The server checks the complete boundary against every deed and native ECS/Gaia building or structure before taking payment."
      />
      <div className="biomes-building-request-grid">
        <label>
          <span>Area</span>
          <select
            value={areaId}
            onChange={(event) => {
              const nextArea = BUILDING_SYSTEM_LAND_REQUEST_AREAS.find(
                (candidate) => candidate.areaId === event.target.value
              );
              setAreaId(event.target.value);
              // Area changes reset to its recommended center; players can then
              // move the rectangle anywhere inside the displayed boundary.
              if (nextArea) {
                setCenterX(nextArea.center[0]);
                setCenterZ(nextArea.center[2]);
              }
            }}
          >
            {BUILDING_SYSTEM_LAND_REQUEST_AREAS.map((entry) => (
              <option key={entry.areaId} value={entry.areaId}>
                {entry.displayName}
                {entry.kind === "additive_town" ? " · Additive town" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Plot size</span>
          <select
            value={sizeId}
            onChange={(event) => setSizeId(event.target.value as any)}
          >
            {BUILDING_SYSTEM_PLOT_SIZE_OPTIONS.map((entry) => (
              <option key={entry.sizeId} value={entry.sizeId}>
                {entry.displayName} · {entry.width}×{entry.depth}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Building plan</span>
          <select
            value={blueprint?.blueprintId ?? ""}
            onChange={(event) => setBlueprintId(event.target.value)}
          >
            {requestBlueprints.map((entry) => (
              <option key={entry.blueprintId} value={entry.blueprintId}>
                {entry.displayName} · {entry.footprint.width}×
                {entry.footprint.depth}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Center X</span>
          <input
            type="number"
            value={centerX}
            onChange={(event) => setCenterX(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Center Z</span>
          <input
            type="number"
            value={centerZ}
            onChange={(event) => setCenterZ(Number(event.target.value))}
          />
        </label>
      </div>
      {area && size ? (
        <div className="biomes-building-chip-row">
          <span className="biomes-building-chip">
            {area.startsMucked
              ? "Frontier muck deed"
              : "Serviced additive-town land"}
          </span>
          <span className="biomes-building-chip">
            Allowed X {area.bounds.xMin}–{area.bounds.xMax}
          </span>
          <span className="biomes-building-chip">
            Allowed Z {area.bounds.zMin}–{area.bounds.zMax}
          </span>
          <span className="biomes-building-chip">Your gold: {gold}</span>
        </div>
      ) : null}
      <p>
        {area?.description} {size?.description}
      </p>
      {!fitsBlueprint ? (
        <p role="alert">
          This plot is too small for the selected building plan.
        </p>
      ) : gold < quotedPrice ? (
        <p role="alert">
          You need {quotedPrice - gold} more gold for this deed.
        </p>
      ) : null}
      <div className="biomes-building-actions">
        <button
          type="button"
          className="biomes-ui-tab"
          disabled={!canRequest}
          aria-disabled={!canRequest}
          onClick={() => {
            if (!area || !size || !blueprint) return;
            onRequest({
              requestAreaId: area.areaId,
              blueprintId: blueprint.blueprintId,
              plotWidth: size.width,
              plotDepth: size.depth,
              centerX,
              centerZ,
            });
          }}
        >
          {pending
            ? "Checking land…"
            : `Request this ${
                size?.displayName ?? ""
              } plot · ${quotedPrice} gold`}
        </button>
      </div>
    </section>
  );
};

const BlueprintPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinition;
  blueprints: BuildingSystemBlueprintDefinition[];
  selectedBlueprintId?: string;
  onSelect: (blueprint: BuildingSystemBlueprintDefinition) => void;
  onStart: () => void;
  onPreview: () => void;
  owned: boolean;
  pending: boolean;
}> = ({
  plot,
  blueprints,
  selectedBlueprintId,
  onSelect,
  onStart,
  onPreview,
  owned,
  pending,
}) => (
  <section aria-label="Pick building blueprint">
    <PanelHeader
      label="Blueprint"
      title="Choose what this building becomes"
      copy="Homes, businesses, and guild halls each offer different storage, services, and upgrades."
    />
    <RovingGrid
      ariaLabel="Allowed voxel blueprints"
      items={gridRows(blueprints, 2)}
      onActivate={(_row, _col, blueprint) => onSelect(blueprint)}
      className="biomes-building-grid"
      renderCell={(blueprint, { focused }, cell) => (
        <Highlightable
          uniqueId={UI_IDS.BUILDING_BLUEPRINT(blueprint.blueprintId)}
          showCaption
        >
          <button
            ref={(el) => cell.ref(el)}
            type="button"
            tabIndex={cell.tabIndex}
            onFocus={cell.onFocus}
            onClick={(event) => {
              cell.onClick();
              event.currentTarget.focus();
            }}
            onKeyDown={cell.onKeyDown}
            data-focused={focused ? "true" : undefined}
            data-selected={
              selectedBlueprintId === blueprint.blueprintId ? "true" : undefined
            }
            className="biomes-building-card biomes-building-select-card"
            aria-label={`${blueprint.displayName}, ${blueprint.use}, ${blueprint.goldCost} gold`}
          >
            <CardTitle
              title={blueprint.displayName}
              meta={`${blueprint.goldCost} gold`}
            />
            <div className="biomes-building-muted">
              {biomesPlayerTitle(blueprint.use)} · {blueprint.footprint.width}×
              {blueprint.footprint.depth}×{blueprint.footprint.height}
            </div>
            <BlueprintVisualPreview blueprint={blueprint} compact />
            <p>{blueprint.description}</p>
            <div className="biomes-building-chip-row">
              <span className="biomes-building-chip">
                {blueprint.storageSlots} storage
              </span>
              <span className="biomes-building-chip">
                {biomesPlayerTitle(blueprint.structureTypeId)}
              </span>
            </div>
          </button>
        </Highlightable>
      )}
    />
    <GhostPreviewPanel
      plot={plot}
      blueprint={
        blueprints.find(
          (blueprint) => blueprint.blueprintId === selectedBlueprintId
        ) ?? blueprints[0]
      }
      owned={owned}
    />
    <div className="biomes-building-actions">
      <button
        type="button"
        className="biomes-ui-tab"
        onClick={onPreview}
        disabled={!owned || pending}
        aria-disabled={!owned || pending}
      >
        Preview ghost / boundary
      </button>
      <button
        type="button"
        className="biomes-ui-tab"
        onClick={onStart}
        disabled={!owned || pending}
        aria-disabled={!owned || pending}
      >
        {!owned
          ? `Buy ${plot.displayName} first`
          : pending
          ? "Starting…"
          : "Start construction"}
      </button>
    </div>
  </section>
);

const GhostPreviewPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinition;
  blueprint?: BuildingSystemBlueprintDefinition;
  owned: boolean;
}> = ({ plot, blueprint, owned }) => {
  if (!blueprint) return null;
  const preview = createBuildingSystemPlacementPreview({
    plot,
    blueprint,
    owned,
  });
  const guide = preview.guideConstruction;
  return (
    <div
      className="biomes-building-card"
      aria-label="Blueprint placement ghost preview"
    >
      <CardTitle
        title="Ghost preview"
        meta={preview.valid ? "valid" : "blocked"}
      />
      <BlueprintVisualPreview blueprint={blueprint} />
      <p>
        This preview shows where the building will stand and whether the spot is
        clear. You can rotate the plan before you commit.
      </p>
      <div className="biomes-building-chip-row">
        <span className="biomes-building-chip">
          Materials needed: {preview.requiredMaterials.length}
        </span>
        <span className="biomes-building-chip">
          Footprint: {guide.footprint.width}x{guide.footprint.depth}
        </span>
        <span className="biomes-building-chip">Floor Y: {guide.floorY}</span>
        <span className="biomes-building-chip">
          Door: {guide.doorX}, {guide.z0}
        </span>
        <span className="biomes-building-chip">
          Coverage: {Math.round(guide.coveredAreaFraction * 100)}%
        </span>
        <span className="biomes-building-chip">
          {preview.valid ? "Ready to place" : "Needs a clearer spot"}
        </span>
        <span className="biomes-building-chip">
          Notes:{" "}
          {biomesPlayerList(preview.warnings.map(placementNoteLabel), "none")}
        </span>
        <span className="biomes-building-chip">
          Guide checks:{" "}
          {biomesPlayerList(guide.warnings.map(placementNoteLabel), "clear")}
        </span>
      </div>
    </div>
  );
};

const BLUEPRINT_VISUAL_STAGES = STAGE_ORDER.filter(
  (stage) => stage !== "completed"
);

const BlueprintVisualPreview: React.FunctionComponent<{
  blueprint: BuildingSystemBlueprintDefinition;
  stage?: BuildingSystemStage;
  progressPercent?: number;
  compact?: boolean;
}> = ({ blueprint, stage, progressPercent = 0, compact = false }) => {
  const width = Math.max(3, Math.min(10, blueprint.footprint.width));
  const depth = Math.max(3, Math.min(8, blueprint.footprint.depth));
  const activeStage = stage ?? "site_preparation";
  const activeIndex =
    activeStage === "completed"
      ? BLUEPRINT_VISUAL_STAGES.length
      : Math.max(0, BLUEPRINT_VISUAL_STAGES.indexOf(activeStage));
  const doorColumn = Math.floor(width / 2);
  return (
    <div
      className="biomes-building-blueprint-visual"
      data-blueprint-visual="production"
      data-compact={compact ? "true" : undefined}
      data-building-current-stage={activeStage}
    >
      <div
        className="biomes-building-blueprint-visual__plan"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
        aria-label={`${blueprint.displayName} blueprint plan`}
      >
        {Array.from({ length: width * depth }).map((_, index) => {
          const row = Math.floor(index / width);
          const col = index % width;
          const edge =
            row === 0 || row === depth - 1 || col === 0 || col === width - 1;
          const door = row === depth - 1 && col === doorColumn;
          const utility = row === 1 && col === width - 2;
          const kind = door
            ? "door"
            : utility
            ? "utility"
            : edge
            ? "wall"
            : "floor";
          return (
            <span
              key={`${row}:${col}`}
              className="biomes-building-blueprint-visual__cell"
              data-kind={kind}
            />
          );
        })}
      </div>
      <div
        className="biomes-building-blueprint-visual__layers"
        aria-hidden="true"
      >
        {BLUEPRINT_VISUAL_STAGES.map((entry, index) => (
          <span
            key={entry}
            className="biomes-building-blueprint-visual__layer"
            data-stage={entry}
            data-lit={
              activeStage === "completed" || index < activeIndex
                ? "true"
                : undefined
            }
            data-active={entry === activeStage ? "true" : undefined}
            style={{ height: `${8 + index * 3}px` }}
          />
        ))}
        {activeStage !== "completed" ? (
          <span
            className="biomes-building-blueprint-visual__spark"
            data-building-animate-stage="true"
          />
        ) : null}
      </div>
      {stage ? (
        <div className="biomes-building-blueprint-visual__progress">
          <span
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};

const ConstructionPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  owned: boolean;
  placed: boolean;
  stage: BuildingSystemStage;
  project?: BuildingSystemProjectRecord;
  materialAvailability: BuildingStageMaterialAvailabilityLine[];
  onStart: () => void;
  onContribute: () => void;
  onFindMaterial: (line: BuildingStageMaterialAvailabilityLine) => void;
  pending: boolean;
}> = ({
  plot,
  blueprint,
  owned,
  placed,
  stage,
  project,
  materialAvailability,
  onStart,
  onContribute,
  onFindMaterial,
  pending,
}) => {
  const activeIndex =
    stage === "completed" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
  const projectStarted = Boolean(project && project.status === "active");
  const missingMaterials = materialAvailability.filter(
    (line) => line.missing > 0
  );
  const progressPercent = buildingSystemStageProgressPercent({
    blueprint,
    stage,
    project,
  });
  return (
    <section aria-label="Construction stages">
      <PanelHeader
        label="Construction"
        title="Build in staged voxel-safe steps"
        copy="Build one step at a time: foundation, floor, walls, roof, and finishing touches."
      />
      <div className="biomes-building-construction-dashboard">
        <BlueprintVisualPreview
          blueprint={blueprint}
          stage={stage}
          progressPercent={progressPercent}
        />
        <div className="biomes-building-construction-readout">
          <CardTitle
            title={`Now building: ${stageLabel(stage)}`}
            meta={`${progressPercent}%`}
          />
          <div className="biomes-building-progressbar" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <MaterialAvailabilityList
            lines={materialAvailability}
            onFindMaterial={onFindMaterial}
          />
        </div>
      </div>
      <div className="biomes-building-stage-list">
        {STAGE_ORDER.map((entry, index) => {
          const complete =
            Boolean(project?.completedStages.includes(entry)) ||
            (stage === "completed" && index < activeIndex);
          const active = entry === stage;
          return (
            <div
              key={entry}
              className="biomes-building-stage"
              data-active={active ? "true" : undefined}
              data-complete={complete ? "true" : undefined}
            >
              <div className="biomes-building-stage__marker">
                {complete ? "✓" : index + 1}
              </div>
              <div>
                <strong>{stageLabel(entry)}</strong>
                <span>{formatMaterials(blueprint, entry, project)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="biomes-building-actions">
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={projectStarted ? onContribute : onStart}
          disabled={
            !owned ||
            pending ||
            stage === "completed" ||
            (projectStarted && missingMaterials.length > 0)
          }
          aria-disabled={
            !owned ||
            pending ||
            stage === "completed" ||
            (projectStarted && missingMaterials.length > 0)
          }
        >
          {!owned
            ? `Buy ${plot.displayName} first`
            : pending
            ? "Submitting…"
            : stage === "completed"
            ? "Construction complete"
            : projectStarted && missingMaterials.length > 0
            ? `Missing ${biomesPlayerList(
                missingMaterials.map(
                  (line) => `${line.displayName} ×${line.missing}`
                ),
                "materials"
              )}`
            : projectStarted
            ? `Contribute ${stageLabel(stage)}`
            : "Start voxel construction"}
        </button>
      </div>
    </section>
  );
};

const MaterialAvailabilityList: React.FunctionComponent<{
  lines: BuildingStageMaterialAvailabilityLine[];
  onFindMaterial?: (line: BuildingStageMaterialAvailabilityLine) => void;
}> = ({ lines, onFindMaterial }) => (
  <div
    className="biomes-building-material-list"
    data-building-material-list="production"
  >
    {lines.length === 0 ? (
      <div className="biomes-building-material-row" data-ready="true">
        <span>No materials needed</span>
        <strong>Ready</strong>
      </div>
    ) : (
      lines.map((line) => {
        const source = buildingSystemMaterialSourceForSymbol(line.material);
        return (
          <div
            key={line.material}
            className="biomes-building-material-row"
            data-missing={line.missing > 0 ? "true" : undefined}
            data-ready={line.missing === 0 ? "true" : undefined}
          >
            <span>{line.displayName}</span>
            <strong>
              {line.missing > 0
                ? `Missing ${line.missing}`
                : `${line.available}/${line.remaining} ready`}
            </strong>
            {line.missing > 0 && source && onFindMaterial ? (
              <button
                type="button"
                className="biomes-building-material-find"
                onClick={() => onFindMaterial(line)}
                aria-label={`Find ${line.displayName} at ${source.sourceName}`}
              >
                Find
              </button>
            ) : null}
          </div>
        );
      })
    )}
  </div>
);

const PropertyPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  property?: BuildingSystemPropertyRecord;
  owned: boolean;
  placed: boolean;
  stage: BuildingSystemStage;
  terraformed: boolean;
  onManage: () => void;
  onTerraform: () => void;
  onSetAccessMode: (mode: "private" | "friends" | "guild" | "public") => void;
  onPayTaxes: () => void;
  onRepair: () => void;
  onUpgrade: () => void;
  onDemolish: () => void;
  onListForSale: () => void;
  onOpenDoor: () => void;
  onUseStorage: () => void;
  onStartBusiness: () => void;
  onRunBusinessCycle: () => void;
  onCollectBusinessRevenue: () => void;
  storageContainers: Record<string, BuildingSystemStorageContainerRecord>;
  doorLocks: Record<string, BuildingSystemDoorLockRecord>;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarker>;
  businesses: Record<string, BuildingSystemBusinessRecord>;
  pending: boolean;
  terraformPending: boolean;
}> = ({
  plot,
  blueprint,
  property,
  owned,
  placed,
  stage,
  terraformed,
  onManage,
  onTerraform,
  onSetAccessMode,
  onPayTaxes,
  onRepair,
  onUpgrade,
  onDemolish,
  onListForSale,
  onOpenDoor,
  onUseStorage,
  onStartBusiness,
  onRunBusinessCycle,
  onCollectBusinessRevenue,
  storageContainers,
  doorLocks,
  inWorldMarkers,
  businesses,
  pending,
  terraformPending,
}) => {
  const storageReady = Boolean(
    property?.storageContainerId &&
      storageContainers[property.storageContainerId]
  );
  const doorReady = Boolean(
    property?.doorLockId && doorLocks[property.doorLockId]
  );
  const accessRows: Array<{
    kind:
      | "door_lock"
      | "storage_container"
      | "home_console"
      | "business_marker";
    label: string;
    ready: boolean;
    actionLabel?: string;
    onAction?: () => void;
  }> = [
    {
      kind: "door_lock",
      label: "Front Door",
      ready: doorReady,
      actionLabel: "Open Door",
      onAction: onOpenDoor,
    },
    {
      kind: "storage_container",
      label: "Storage Chest",
      ready: storageReady,
      actionLabel: "Open Storage",
      onAction: onUseStorage,
    },
  ];
  if ((property?.use ?? blueprint.use) === "home") {
    accessRows.push({
      kind: "home_console",
      label: "Home Console",
      ready: Boolean(
        property &&
          markerForPropertyAccessPoint(inWorldMarkers, property, "home_console")
      ),
    });
  }
  if ((property?.use ?? blueprint.use) === "business") {
    accessRows.push({
      kind: "business_marker",
      label: "Customer Counter",
      ready: Boolean(
        property &&
          markerForPropertyAccessPoint(
            inWorldMarkers,
            property,
            "business_marker"
          )
      ),
      actionLabel: "Open Shop",
      onAction: onStartBusiness,
    });
  }

  return (
    <section aria-label="Manage completed property">
      <PanelHeader
        label="Property"
        title="Manage permissions, taxes, repairs, upgrades, demolition, and sale"
        copy="Keep your place in good shape, decide who can visit, pay what is due, and open shops when the building is ready."
      />
      <div className="biomes-building-property-grid">
        <PropertyMetric
          label="Status"
          value={biomesPlayerTitle(
            property?.status ??
              (placed ? stageLabel(stage) : owned ? "Muck deed" : "Unowned")
          )}
        />
        <PropertyMetric
          label="Land"
          value={terraformed ? "Terraformed" : owned ? "Muck deed" : "Unowned"}
        />
        <PropertyMetric
          label="Use"
          value={biomesPlayerTitle(property?.use ?? blueprint.use)}
        />
        <PropertyMetric label="Tier" value={`T${property?.tier ?? 1}`} />
        <PropertyMetric
          label="Access"
          value={biomesPlayerTitle(property?.accessMode ?? "private")}
        />
        <PropertyMetric
          label="Tax Due"
          value={`${property?.taxBalanceGold ?? 0} gold`}
        />
        <PropertyMetric
          label="Condition"
          value={`${property?.condition ?? 100}%`}
        />
        <PropertyMetric
          label="Storage"
          value={`${property?.storageItemCount ?? 0}/${
            property?.storageSlots ?? blueprint.storageSlots
          }`}
        />
        <PropertyMetric
          label="Tax Rate"
          value={`${Math.round((property?.taxRate ?? plot.taxRate) * 100)}%`}
        />
        <PropertyMetric
          label="Storage Ready"
          value={storageReady ? "Ready" : "Not ready yet"}
        />
        <PropertyMetric
          label="Door Ready"
          value={doorReady ? "Ready" : "Not ready yet"}
        />
        <PropertyMetric
          label="Business"
          value={
            property?.businessId && businesses[property.businessId]
              ? biomesPlayerTitle(businesses[property.businessId].type)
              : "Not started"
          }
        />
      </div>
      <div className="biomes-building-card">
        <CardTitle title={blueprint.service} meta={plot.district} />
        <p>{plot.description}</p>
        <div className="biomes-building-chip-row">
          <span className="biomes-building-chip">
            Owner: {property?.ownerId ? "You" : "Not claimed"}
          </span>
          <span className="biomes-building-chip">
            Guest access:{" "}
            {property?.permissions.friends_guests.storage_access
              ? "Storage"
              : "None"}
          </span>
          <span className="biomes-building-chip">
            Guild edit:{" "}
            {property?.permissions.guild_members.build_edit ? "Yes" : "No"}
          </span>
          <span className="biomes-building-chip">
            Public storage:{" "}
            {property?.permissions.public.storage_access ? "Yes" : "No"}
          </span>
        </div>
      </div>
      <div
        className="biomes-building-card"
        data-building-access-point-summary="production"
        aria-label="In-world access points"
      >
        <CardTitle
          title="In-world access points"
          meta={property ? "inside the building" : "after construction"}
        />
        <div className="biomes-building-access-list">
          {accessRows.map((row) => {
            const marker = markerForPropertyAccessPoint(
              inWorldMarkers,
              property,
              row.kind
            );
            return (
              <div
                key={row.kind}
                className="biomes-building-access-row"
                data-building-access-point-kind={row.kind.replace(/_/g, "-")}
              >
                <span>
                  <strong>{row.label}</strong>
                  <small>{markerPositionHint(marker)}</small>
                </span>
                <span className="biomes-building-chip">
                  {row.ready ? "Ready" : "Not ready yet"}
                </span>
                {row.actionLabel ? (
                  <button
                    type="button"
                    className="biomes-ui-tab"
                    onClick={row.onAction}
                    disabled={!property || !row.ready}
                    aria-disabled={!property || !row.ready}
                  >
                    {row.actionLabel}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="biomes-building-actions">
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onManage}
          disabled={!owned || pending}
          aria-disabled={!owned || pending}
        >
          {pending ? "Checking…" : "Check Property"}
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={() => onSetAccessMode("private")}
          disabled={!property}
        >
          Private
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={() => onSetAccessMode("friends")}
          disabled={!property}
        >
          Friends
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={() => onSetAccessMode("guild")}
          disabled={!property}
        >
          Guild
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={() => onSetAccessMode("public")}
          disabled={!property}
        >
          Public
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onPayTaxes}
          disabled={!property}
        >
          Pay Taxes
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onRepair}
          disabled={!property}
        >
          Repair
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onUpgrade}
          disabled={!property || (property?.tier ?? 1) >= 2}
        >
          Upgrade
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onListForSale}
          disabled={!property}
        >
          List for Sale
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onStartBusiness}
          disabled={!property || property.use !== "business"}
        >
          Open Shop
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onRunBusinessCycle}
          disabled={!property?.businessId}
        >
          Serve Customers
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onCollectBusinessRevenue}
          disabled={!property?.businessId}
        >
          Collect Earnings
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onTerraform}
          disabled={
            !property ||
            !owned ||
            terraformed ||
            terraformPending ||
            !["home", "business"].includes(property.use)
          }
          aria-disabled={
            !property ||
            !owned ||
            terraformed ||
            terraformPending ||
            !["home", "business"].includes(property.use)
          }
        >
          {terraformed
            ? "Land terraformed"
            : terraformPending
            ? "Terraforming..."
            : "Terraform Land"}
        </button>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onDemolish}
          disabled={!property}
        >
          Demolish
        </button>
      </div>
    </section>
  );
};

const SelectedPlotSummary: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinition;
  blueprint: BuildingSystemBlueprintDefinition;
  owned: boolean;
  placed: boolean;
  terraformed: boolean;
  stage: BuildingSystemStage;
  onLocate: () => void;
}> = ({ plot, blueprint, owned, placed, terraformed, stage, onLocate }) => {
  const dimensions = buildingSystemPlotDimensions(plot);
  return (
    <div className="biomes-building-card biomes-building-summary">
      <div className="biomes-building-eyebrow">Selected</div>
      <h3 className="biomes-building-card-title">{plot.displayName}</h3>
      <BlueprintVisualPreview blueprint={blueprint} stage={stage} compact />
      <dl>
        <MetricTerm label="Area" value={biomesPlayerTitle(plot.area)} />
        <MetricTerm label="District" value={plot.district} />
        <MetricTerm label="Price" value={`${plot.claimPriceGold} gold`} />
        <MetricTerm
          label="Plot Size"
          value={`${dimensions.width}×${dimensions.depth} (${
            dimensions.width * dimensions.depth
          } blocks)`}
        />
        <MetricTerm
          label="State"
          value={owned ? (terraformed ? "Terraformed" : "Muck deed") : "Mucked"}
        />
        <MetricTerm label="Blueprint" value={blueprint.displayName} />
        <MetricTerm label="Use" value={biomesPlayerTitle(blueprint.use)} />
        <MetricTerm
          label="World"
          value={placed ? "Placed in the Grove" : "Ready to place"}
        />
        <MetricTerm label="Stage" value={stageLabel(stage)} />
      </dl>
      <div className="biomes-building-actions">
        <button type="button" className="biomes-ui-tab" onClick={onLocate}>
          {owned ? "Show property on map" : "Show plot on map"}
        </button>
      </div>
    </div>
  );
};

const PanelHeader: React.FunctionComponent<{
  label: string;
  title: string;
  copy: string;
}> = ({ label, title, copy }) => (
  <header className="biomes-building-panel-header">
    <div className="biomes-building-eyebrow">{label}</div>
    <h3 className="biomes-building-card-title">{title}</h3>
    <p>{copy}</p>
  </header>
);

const CardTitle: React.FunctionComponent<{ title: string; meta: string }> = ({
  title,
  meta,
}) => (
  <div className="biomes-building-card-title-row">
    <strong>{title}</strong>
    <span>{meta}</span>
  </div>
);

const PropertyMetric: React.FunctionComponent<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="biomes-building-metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const MetricTerm: React.FunctionComponent<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="biomes-building-summary-row">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);
