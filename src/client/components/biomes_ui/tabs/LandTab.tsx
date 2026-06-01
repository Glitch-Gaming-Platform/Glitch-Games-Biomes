// LandTab — production Building System UI for Grove land, voxel blueprints,
// staged construction, and completed property management.
//
// This tab intentionally reads the real shared Building System catalogue instead
// of UI placeholders. Mutations go through /api/harthmere/live_mode so server
// auth, validation, plot ownership, safe-ground edits, and voxel materialization
// remain authoritative.

import {
  BUILDING_SYSTEM_BLUEPRINTS_V1,
  BUILDING_SYSTEM_BUSINESS_TYPES_V1,
  BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1,
  BUILDING_SYSTEM_PLOTS_V1,
  BUILDING_SYSTEM_STAGE_ORDER_V1,
  buildingSystemHomeConsoleMarkerIdV1,
  buildingSystemMaterialRequirementLinesV1,
  createBuildingSystemPlacementPreviewV1,
  type BuildingSystemBlueprintDefinitionV1,
  type BuildingSystemBusinessRecordV1,
  type BuildingSystemDoorLockRecordV1,
  type BuildingSystemInWorldMarkerV1,
  type BuildingSystemPlotDefinitionV1,
  type BuildingSystemProjectRecordV1,
  type BuildingSystemPropertyRecordV1,
  type BuildingSystemStorageContainerRecordV1,
  type BuildingSystemStageV1,
} from "@/shared/harthmere/building_system_v1";
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { biomesPlayerList, biomesPlayerSentence, biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

type BuildingSystemAction =
  | "read_state"
  | "talk_to_steward"
  | "claim_plot"
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
  getPlots?: () => BuildingSystemPlotDefinitionV1[];
  getBlueprints?: () => BuildingSystemBlueprintDefinitionV1[];
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

const STAGE_ORDER: BuildingSystemStageV1[] = [...BUILDING_SYSTEM_STAGE_ORDER_V1];

const BUILDING_ACTION_LABELS: Record<BuildingSystemAction, string> = {
  read_state: "checking your land",
  talk_to_steward: "talking with Mira",
  claim_plot: "claiming the plot",
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

interface BuildingSystemClientStateV3 {
  gold: number;
  inventoryItems: Record<string, number>;
  ownedPlotIds: string[];
  safeZones: Record<string, { safeFromMuck: boolean; activatedAtMs: number; area: string }>;
  activeProjects: Record<string, BuildingSystemProjectRecordV1>;
  placedStructureIds: string[];
  completedProperties: Record<string, BuildingSystemPropertyRecordV1>;
  buildingProgress: Record<string, number>;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
  storageContainers: Record<string, BuildingSystemStorageContainerRecordV1>;
  doorLocks: Record<string, BuildingSystemDoorLockRecordV1>;
  businesses: Record<string, BuildingSystemBusinessRecordV1>;
}

const EMPTY_BUILDING_CLIENT_STATE: BuildingSystemClientStateV3 = {
  gold: 0,
  inventoryItems: {},
  ownedPlotIds: [],
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

function normalizeBuildingClientState(input: unknown): BuildingSystemClientStateV3 {
  const raw = typeof input === "object" && input !== null ? (input as any) : {};
  return {
    gold: Number.isFinite(Number(raw.gold)) ? Number(raw.gold) : 0,
    inventoryItems:
      typeof raw.inventoryItems === "object" && raw.inventoryItems !== null
        ? raw.inventoryItems
        : {},
    ownedPlotIds: Array.isArray(raw.ownedPlotIds) ? raw.ownedPlotIds : [],
    safeZones:
      typeof raw.safeZones === "object" && raw.safeZones !== null ? raw.safeZones : {},
    activeProjects:
      typeof raw.activeProjects === "object" && raw.activeProjects !== null
        ? raw.activeProjects
        : {},
    placedStructureIds: Array.isArray(raw.placedStructureIds)
      ? raw.placedStructureIds
      : [],
    completedProperties:
      typeof raw.completedProperties === "object" && raw.completedProperties !== null
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
      typeof raw.storageContainers === "object" && raw.storageContainers !== null
        ? raw.storageContainers
        : {},
    doorLocks:
      typeof raw.doorLocks === "object" && raw.doorLocks !== null ? raw.doorLocks : {},
    businesses:
      typeof raw.businesses === "object" && raw.businesses !== null ? raw.businesses : {},
  };
}

function activeProjectForPlot(
  state: BuildingSystemClientStateV3,
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

function stageLabel(stage: BuildingSystemStageV1): string {
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
  blueprint: BuildingSystemBlueprintDefinitionV1,
  stage: BuildingSystemStageV1,
  project?: BuildingSystemProjectRecordV1
): string {
  const lines = buildingSystemMaterialRequirementLinesV1({
    blueprint,
    stage,
    contributed: project?.stageProgress[stage]?.materials,
  });
  if (!lines.length) return "No extra materials";
  return lines
    .map((line) => `${line.displayName} ×${line.remaining}`)
    .join(" · ");
}

function responseRejected(response: BuildingActionResponse | undefined): boolean {
  if (!response) return true;
  const warnings = [
    ...(response.warnings ?? []),
    ...(response.validation?.errors ?? []),
    ...(response.backendMutation?.warnings ?? []),
  ].map((warning) => String(warning).toLowerCase());
  return response.ok === false || warnings.some((warning) => warning.includes("rejected"));
}

async function submitBuildingActionThroughLiveModeRoute(
  action: BuildingSystemAction,
  payload: Record<string, unknown>
): Promise<BuildingActionResponse> {
  if (typeof fetch !== "function") {
    return { ok: false, errors: ["fetch_unavailable"] };
  }
  const requestId = `biomes_ui_building_${action}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_property_building_mutation",
      subsystem: "building",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        buildingAction: action,
        ...payload,
      },
      clientClaims: {},
    }),
  });
  return (await response.json()) as BuildingActionResponse;
}

function useBuildingSystemBackend(
  adapter: BuildingSystemLandAdapter | undefined,
  onBuildingState: (state: BuildingSystemClientStateV3) => void
) {
  const [pendingAction, setPendingAction] = React.useState<BuildingSystemAction | null>(null);
  const [lastResponse, setLastResponse] = React.useState<string>("Ready to build.");

  const submit = React.useCallback(
    async (action: BuildingSystemAction, payload: Record<string, unknown>) => {
      setPendingAction(action);
      try {
        const response = await (
          adapter?.submitBuildingAction ?? submitBuildingActionThroughLiveModeRoute
        )(action, payload);
        if (response.buildingState) {
          onBuildingState(normalizeBuildingClientState(response.buildingState));
        }
        const warnings = [
          ...(response.validation?.errors ?? []),
          ...(response.backendMutation?.warnings ?? []),
          ...(response.warnings ?? []),
          ...(response.errors ?? []),
        ];
        const status = responseRejected(response)
          ? `${actionLabelStart(action)} needs attention: ${biomesPlayerList(warnings, "try again in a moment")}.`
          : `${actionLabelStart(action)} is done.`;
        setLastResponse(status);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = `${actionLabelStart(action)} could not finish. ${biomesPlayerSentence(message, "Please try again.")}`;
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
  plot: BuildingSystemPlotDefinitionV1 | undefined,
  blueprints: BuildingSystemBlueprintDefinitionV1[],
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

function markerPositionHint(marker: BuildingSystemInWorldMarkerV1 | undefined) {
  if (!marker) return "Finishes with the building utilities.";
  if (marker.kind === "door_lock") return "At the front entrance.";
  if (marker.kind === "storage_container") return "Inside near the entry wall.";
  if (marker.kind === "home_console") return "Inside your home.";
  if (marker.kind === "business_marker") return "At the customer counter.";
  return "Marked in the building.";
}

function markerForPropertyAccessPoint(
  markers: Record<string, BuildingSystemInWorldMarkerV1>,
  property: BuildingSystemPropertyRecordV1 | undefined,
  kind: BuildingSystemInWorldMarkerV1["kind"]
) {
  if (!property) return undefined;
  const markerId =
    kind === "storage_container"
      ? property.storageContainerId
      : kind === "door_lock"
        ? property.doorLockId
        : kind === "home_console"
          ? buildingSystemHomeConsoleMarkerIdV1(property.propertyId)
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
  const plots = adapter?.getPlots?.() ?? BUILDING_SYSTEM_PLOTS_V1;
  const blueprints = adapter?.getBlueprints?.() ?? BUILDING_SYSTEM_BLUEPRINTS_V1;
  const [step, setStep] = React.useState<BuildingUiStep>(initialStep);
  const [selectedPlotId, setSelectedPlotId] = React.useState<string>(
    plots[0]?.plotId ?? ""
  );
  const [selectedBlueprintId, setSelectedBlueprintId] = React.useState<string>(
    plots[0]?.allowedBlueprintIds[0] ?? blueprints[0]?.blueprintId ?? ""
  );
  const [serverState, setServerState] = React.useState<BuildingSystemClientStateV3>(() => {
    const hydrated = normalizeBuildingClientState(adapter?.getBuildingState?.());
    return {
      ...EMPTY_BUILDING_CLIENT_STATE,
      ...hydrated,
      ownedPlotIds: adapter?.getOwnedPlotIds?.() ?? hydrated.ownedPlotIds,
      placedStructureIds:
        adapter?.getPlacedStructureIds?.() ?? hydrated.placedStructureIds,
    };
  });
  const { submit, pendingAction, lastResponse } = useBuildingSystemBackend(
    adapter,
    setServerState
  );
  const selectedPlot = plots.find((plot) => plot.plotId === selectedPlotId) ?? plots[0];
  const selectedBlueprint = blueprintForPlot(
    selectedPlot,
    blueprints,
    selectedBlueprintId
  );
  const activeProject = activeProjectForPlot(serverState, selectedPlot?.plotId);
  const propertyId = selectedPlot ? propertyIdForPlot(selectedPlot.plotId) : undefined;
  const owned = selectedPlot
    ? serverState.ownedPlotIds.includes(selectedPlot.plotId)
    : false;
  const placed = selectedPlot
    ? Boolean(
        serverState.completedProperties[propertyIdForPlot(selectedPlot.plotId)] ||
          serverState.placedStructureIds.includes(selectedPlot.plotId)
      )
    : false;
  const currentStage = activeProject?.currentStage ?? (placed ? "completed" : "site_preparation");
  const completedProperty = propertyId ? serverState.completedProperties[propertyId] : undefined;

  React.useEffect(() => {
    void submit("read_state", {});
  }, [submit]);

  React.useEffect(() => {
    if (!selectedPlot) return;
    const allowed = selectedPlot.allowedBlueprintIds;
    if (!allowed.includes(selectedBlueprintId)) {
      setSelectedBlueprintId(allowed[0] ?? blueprints[0]?.blueprintId ?? "");
    }
  }, [selectedPlot, selectedBlueprintId, blueprints]);

  const talkToMira = React.useCallback(async () => {
    const response = await submit("talk_to_steward", {
      npcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.id,
      questId: BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId,
    });
    if (!responseRejected(response)) {
      setStep("plots");
    }
  }, [submit]);

  const claimSelectedPlot = React.useCallback(async () => {
    if (!selectedPlot) return;
    const response = await submit("claim_plot", { plotId: selectedPlot.plotId });
    if (!responseRejected(response)) {
      setStep("blueprints");
    }
  }, [selectedPlot, submit]);

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
    if (!selectedPlot || !selectedBlueprint || currentStage === "completed") return;
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
  }, [activeProject?.projectId, currentStage, selectedBlueprint, selectedPlot, submit]);

  const manageProperty = React.useCallback(async () => {
    if (!selectedPlot || !selectedBlueprint) return;
    await submit("manage_property", {
      plotId: selectedPlot.plotId,
      blueprintId: selectedBlueprint.blueprintId,
      blueprintItemId: selectedBlueprint.blueprintItemId,
      propertyId: `property_${selectedPlot.plotId}`,
    });
  }, [selectedBlueprint, selectedPlot, submit]);

  const setAccessMode = React.useCallback(async (accessMode: "private" | "friends" | "guild" | "public") => {
    if (!selectedPlot) return;
    await submit("set_access_mode", {
      plotId: selectedPlot.plotId,
      propertyId: propertyIdForPlot(selectedPlot.plotId),
      accessMode,
    });
  }, [selectedPlot, submit]);

  const runPropertyAction = React.useCallback(async (action: BuildingSystemAction, extra: Record<string, unknown> = {}) => {
    if (!selectedPlot) return;
    await submit(action, {
      plotId: selectedPlot.plotId,
      propertyId: propertyIdForPlot(selectedPlot.plotId),
      ...extra,
    });
  }, [selectedPlot, submit]);

  const startGeneralBusiness = React.useCallback(async () => {
    await runPropertyAction("start_business", { businessType: "general_trader" });
  }, [runPropertyAction]);

  const runBusinessCycle = React.useCallback(async () => {
    await runPropertyAction("run_business_cycle", { cycles: 1 });
  }, [runPropertyAction]);

  const collectBusinessRevenue = React.useCallback(async () => {
    await runPropertyAction("collect_business_revenue", {});
  }, [runPropertyAction]);

  const selectPlot = React.useCallback(
    (plot: BuildingSystemPlotDefinitionV1) => {
      setSelectedPlotId(plot.plotId);
      setSelectedBlueprintId(plot.allowedBlueprintIds[0] ?? "");
    },
    []
  );

  return (
    <div className="biomes-building-system" data-testid="building-system-land-tab">
      <section className="biomes-building-hero" aria-label="Building System summary">
        <div>
          <div className="biomes-building-eyebrow">Grove Building System</div>
          <h3 className="biomes-building-title">Claim muck land. Build with real voxels.</h3>
          <p className="biomes-building-copy">
            Talk to {BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.displayName} to complete the
            {" "}{BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.displayName} intro quest, buy a Grove plot,
            choose a blueprint, bring the needed materials, then manage access,
            taxes, upgrades, repairs, storage, and sale.
          </p>
        </div>
        <div className="biomes-building-status" aria-live="polite">
          <span className="biomes-building-status__label">Land Office</span>
          <strong>{pendingAction ? `${actionLabelStart(pendingAction)}...` : "Ready when you are"}</strong>
          <span>{lastResponse}</span>
        </div>
      </section>

      <BuildingStepRail activeStep={step} onStepChange={setStep} />

      <div className="biomes-building-layout">
        <aside className="biomes-building-sidebar" aria-label="Selected Grove plot">
          {selectedPlot && selectedBlueprint ? (
            <SelectedPlotSummary
              plot={selectedPlot}
              blueprint={selectedBlueprint}
              owned={owned}
              placed={placed}
              stage={currentStage}
            />
          ) : (
            <div className="biomes-building-card">No Grove building plots available.</div>
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
            <PlotsPanel
              plots={plots}
              ownedPlotIds={serverState.ownedPlotIds}
              selectedPlotId={selectedPlot?.plotId}
              onSelect={selectPlot}
              onClaim={claimSelectedPlot}
              pending={pendingAction === "claim_plot"}
            />
          )}
          {step === "blueprints" && selectedPlot && (
            <BlueprintPanel
              plot={selectedPlot}
              blueprints={blueprints.filter((blueprint) =>
                selectedPlot.allowedBlueprintIds.includes(blueprint.blueprintId)
              )}
              selectedBlueprintId={selectedBlueprintId}
              onSelect={(blueprint) => setSelectedBlueprintId(blueprint.blueprintId)}
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
              onStart={startSelectedBuilding}
              onContribute={contributeStage}
              pending={pendingAction === "start_construction" || pendingAction === "contribute_stage"}
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
              onManage={manageProperty}
              onSetAccessMode={setAccessMode}
              onPayTaxes={() => runPropertyAction("pay_property_tax")}
              onRepair={() => runPropertyAction("repair_property")}
              onUpgrade={() => runPropertyAction("upgrade_property")}
              onDemolish={() => runPropertyAction("demolish_property")}
              onListForSale={() => runPropertyAction("list_property_for_sale", { salePriceGold: completedProperty?.value ?? selectedBlueprint.goldCost })}
              onOpenDoor={() => runPropertyAction("open_door", { doorLockId: completedProperty?.doorLockId })}
              onUseStorage={() => runPropertyAction("use_storage", { containerId: completedProperty?.storageContainerId })}
              onStartBusiness={startGeneralBusiness}
              onRunBusinessCycle={runBusinessCycle}
              onCollectBusinessRevenue={collectBusinessRevenue}
              storageContainers={serverState.storageContainers}
              doorLocks={serverState.doorLocks}
              inWorldMarkers={serverState.inWorldMarkers}
              businesses={serverState.businesses}
              pending={pendingAction === "manage_property"}
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
    Math.max(0, UI_STEPS.findIndex((entry) => entry.key === activeStep))
  );
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    const idx = UI_STEPS.findIndex((entry) => entry.key === activeStep);
    if (idx >= 0) setFocusedIndex(idx);
  }, [activeStep]);

  const focusIndex = React.useCallback((index: number) => {
    const next = ((index % UI_STEPS.length) + UI_STEPS.length) % UI_STEPS.length;
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
      {BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.displayName}
    </h3>
    <p className="biomes-building-quote">
      “{BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.line}”
    </p>
    <div className="biomes-building-callout" aria-label="Business economy types">
      <CardTitle title="Business economy" meta={`${BUILDING_SYSTEM_BUSINESS_TYPES_V1.length} types`} />
      <p>Businesses use license level, inventory, contracts, upkeep, service radius, reputation, customer satisfaction, revenue balance, and taxes.</p>
    </div>
    <div className="biomes-building-actions">
      <Highlightable uniqueId={UI_IDS.BUILDING_TALK_STEWARD} showCaption>
        <button type="button" className="biomes-ui-tab" onClick={onTalk} disabled={pending} aria-disabled={pending}>
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
  plots: BuildingSystemPlotDefinitionV1[];
  ownedPlotIds: string[];
  selectedPlotId?: string;
  onSelect: (plot: BuildingSystemPlotDefinitionV1) => void;
  onClaim: () => void;
  pending: boolean;
}> = ({ plots, ownedPlotIds, selectedPlotId, onSelect, onClaim, pending }) => (
  <section aria-label="Buy Grove plot">
    <PanelHeader
      label="Buy Plot"
      title="Pick muck land in the Grove"
      copy="Every plot here starts rough. Claiming one marks it as yours and makes the ground safe enough to build on."
    />
    <RovingGrid
      ariaLabel="Grove purchasable plots"
      items={gridRows(plots, 2)}
      onActivate={(_row, _col, plot) => onSelect(plot)}
      className="biomes-building-grid"
      renderCell={(plot, { focused }, cell) => (
        <Highlightable uniqueId={UI_IDS.BUILDING_PLOT(plot.plotId)} showCaption>
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
            aria-label={`${plot.displayName}, ${plot.claimPriceGold} gold, ${plot.district}`}
            data-focused={focused ? "true" : undefined}
            data-selected={selectedPlotId === plot.plotId ? "true" : undefined}
            className="biomes-building-card biomes-building-select-card"
          >
            <CardTitle title={plot.displayName} meta={`${plot.claimPriceGold} gold`} />
            <div className="biomes-building-muted">{plot.district}</div>
            <p>{plot.description}</p>
            <div className="biomes-building-chip-row">
              <span className="biomes-building-chip">{biomesPlayerTitle(plot.area)}</span>
              <span className="biomes-building-chip">{biomesPlayerTitle(plot.plotType)}</span>
              <span className="biomes-building-chip">
                {ownedPlotIds.includes(plot.plotId) ? "Owned" : "Mucked"}
              </span>
            </div>
          </button>
        </Highlightable>
      )}
    />
    <div className="biomes-building-actions">
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

const BlueprintPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinitionV1;
  blueprints: BuildingSystemBlueprintDefinitionV1[];
  selectedBlueprintId?: string;
  onSelect: (blueprint: BuildingSystemBlueprintDefinitionV1) => void;
  onStart: () => void;
  onPreview: () => void;
  owned: boolean;
  pending: boolean;
}> = ({ plot, blueprints, selectedBlueprintId, onSelect, onStart, onPreview, owned, pending }) => (
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
        <Highlightable uniqueId={UI_IDS.BUILDING_BLUEPRINT(blueprint.blueprintId)} showCaption>
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
            data-selected={selectedBlueprintId === blueprint.blueprintId ? "true" : undefined}
            className="biomes-building-card biomes-building-select-card"
            aria-label={`${blueprint.displayName}, ${blueprint.use}, ${blueprint.goldCost} gold`}
          >
            <CardTitle title={blueprint.displayName} meta={`${blueprint.goldCost} gold`} />
            <div className="biomes-building-muted">
              {biomesPlayerTitle(blueprint.use)} · {blueprint.footprint.width}×{blueprint.footprint.depth}×{blueprint.footprint.height}
            </div>
            <p>{blueprint.description}</p>
            <div className="biomes-building-chip-row">
              <span className="biomes-building-chip">{blueprint.storageSlots} storage</span>
              <span className="biomes-building-chip">{biomesPlayerTitle(blueprint.structureTypeId)}</span>
            </div>
          </button>
        </Highlightable>
      )}
    />
    <GhostPreviewPanel
      plot={plot}
      blueprint={blueprints.find((blueprint) => blueprint.blueprintId === selectedBlueprintId) ?? blueprints[0]}
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
        {!owned ? `Buy ${plot.displayName} first` : pending ? "Starting…" : "Start construction"}
      </button>
    </div>
  </section>
);

const GhostPreviewPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinitionV1;
  blueprint?: BuildingSystemBlueprintDefinitionV1;
  owned: boolean;
}> = ({ plot, blueprint, owned }) => {
  if (!blueprint) return null;
  const preview = createBuildingSystemPlacementPreviewV1({ plot, blueprint, owned });
  const guide = preview.guideConstruction;
  return (
    <div className="biomes-building-card" aria-label="Blueprint placement ghost preview">
      <CardTitle title="Ghost preview" meta={preview.valid ? "valid" : "blocked"} />
      <p>This preview shows where the building will stand and whether the spot is clear. You can rotate the plan before you commit.</p>
      <div className="biomes-building-chip-row">
        <span className="biomes-building-chip">Materials needed: {preview.requiredMaterials.length}</span>
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
        <span className="biomes-building-chip">{preview.valid ? "Ready to place" : "Needs a clearer spot"}</span>
        <span className="biomes-building-chip">
          Notes: {biomesPlayerList(preview.warnings.map(placementNoteLabel), "none")}
        </span>
        <span className="biomes-building-chip">
          Guide checks: {biomesPlayerList(guide.warnings.map(placementNoteLabel), "clear")}
        </span>
      </div>
    </div>
  );
};

const ConstructionPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  owned: boolean;
  placed: boolean;
  stage: BuildingSystemStageV1;
  project?: BuildingSystemProjectRecordV1;
  onStart: () => void;
  onContribute: () => void;
  pending: boolean;
}> = ({ plot, blueprint, owned, placed, stage, project, onStart, onContribute, pending }) => {
  const activeIndex = STAGE_ORDER.indexOf(stage);
  const projectStarted = Boolean(project && project.status === "active");
  return (
    <section aria-label="Construction stages">
      <PanelHeader
        label="Construction"
        title="Build in staged voxel-safe steps"
        copy="Build one step at a time: foundation, floor, walls, roof, and finishing touches."
      />
      <div className="biomes-building-stage-list">
        {STAGE_ORDER.map((entry, index) => {
          const complete = Boolean(project?.completedStages.includes(entry)) ||
            (stage === "completed" && index < activeIndex);
          const active = entry === stage;
          return (
            <div
              key={entry}
              className="biomes-building-stage"
              data-active={active ? "true" : undefined}
              data-complete={complete ? "true" : undefined}
            >
              <div className="biomes-building-stage__marker">{complete ? "✓" : index + 1}</div>
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
          disabled={!owned || pending || stage === "completed"}
          aria-disabled={!owned || pending || stage === "completed"}
        >
          {!owned
            ? `Buy ${plot.displayName} first`
            : pending
              ? "Submitting…"
              : stage === "completed"
                ? "Construction complete"
                : projectStarted
                  ? `Contribute ${stageLabel(stage)}`
                  : "Start voxel construction"}
        </button>
      </div>
    </section>
  );
};

const PropertyPanel: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  property?: BuildingSystemPropertyRecordV1;
  owned: boolean;
  placed: boolean;
  stage: BuildingSystemStageV1;
  onManage: () => void;
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
  storageContainers: Record<string, BuildingSystemStorageContainerRecordV1>;
  doorLocks: Record<string, BuildingSystemDoorLockRecordV1>;
  inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
  businesses: Record<string, BuildingSystemBusinessRecordV1>;
  pending: boolean;
}> = ({
  plot,
  blueprint,
  property,
  owned,
  placed,
  stage,
  onManage,
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
}) => {
  const storageReady = Boolean(
    property?.storageContainerId && storageContainers[property.storageContainerId]
  );
  const doorReady = Boolean(property?.doorLockId && doorLocks[property.doorLockId]);
  const accessRows: Array<{
    kind: "door_lock" | "storage_container" | "home_console" | "business_marker";
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
          markerForPropertyAccessPoint(inWorldMarkers, property, "business_marker")
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
        <PropertyMetric label="Status" value={biomesPlayerTitle(property?.status ?? (placed ? stageLabel(stage) : owned ? "Plot deeded" : "Unowned"))} />
        <PropertyMetric label="Use" value={biomesPlayerTitle(property?.use ?? blueprint.use)} />
        <PropertyMetric label="Tier" value={`T${property?.tier ?? 1}`} />
        <PropertyMetric label="Access" value={biomesPlayerTitle(property?.accessMode ?? "private")} />
        <PropertyMetric label="Tax Due" value={`${property?.taxBalanceGold ?? 0} gold`} />
        <PropertyMetric label="Condition" value={`${property?.condition ?? 100}%`} />
        <PropertyMetric label="Storage" value={`${property?.storageItemCount ?? 0}/${property?.storageSlots ?? blueprint.storageSlots}`} />
        <PropertyMetric label="Tax Rate" value={`${Math.round((property?.taxRate ?? plot.taxRate) * 100)}%`} />
        <PropertyMetric label="Storage Ready" value={storageReady ? "Ready" : "Not ready yet"} />
        <PropertyMetric label="Door Ready" value={doorReady ? "Ready" : "Not ready yet"} />
        <PropertyMetric label="Business" value={property?.businessId && businesses[property.businessId] ? biomesPlayerTitle(businesses[property.businessId].type) : "Not started"} />
      </div>
      <div className="biomes-building-card">
        <CardTitle title={blueprint.service} meta={plot.district} />
        <p>{plot.description}</p>
        <div className="biomes-building-chip-row">
          <span className="biomes-building-chip">Owner: {property?.ownerId ? "You" : "Not claimed"}</span>
          <span className="biomes-building-chip">Guest access: {property?.permissions.friends_guests.storage_access ? "Storage" : "None"}</span>
          <span className="biomes-building-chip">Guild edit: {property?.permissions.guild_members.build_edit ? "Yes" : "No"}</span>
          <span className="biomes-building-chip">Public storage: {property?.permissions.public.storage_access ? "Yes" : "No"}</span>
        </div>
      </div>
      <div
        className="biomes-building-card"
        data-building-access-point-summary="production"
        aria-label="In-world access points"
      >
        <CardTitle title="In-world access points" meta={property ? "inside the building" : "after construction"} />
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
        <button type="button" className="biomes-ui-tab" onClick={onManage} disabled={!owned || pending} aria-disabled={!owned || pending}>
          {pending ? "Checking…" : "Check Property"}
        </button>
        <button type="button" className="biomes-ui-tab" onClick={() => onSetAccessMode("private")} disabled={!property}>Private</button>
        <button type="button" className="biomes-ui-tab" onClick={() => onSetAccessMode("friends")} disabled={!property}>Friends</button>
        <button type="button" className="biomes-ui-tab" onClick={() => onSetAccessMode("guild")} disabled={!property}>Guild</button>
        <button type="button" className="biomes-ui-tab" onClick={() => onSetAccessMode("public")} disabled={!property}>Public</button>
        <button type="button" className="biomes-ui-tab" onClick={onPayTaxes} disabled={!property}>Pay Taxes</button>
        <button type="button" className="biomes-ui-tab" onClick={onRepair} disabled={!property}>Repair</button>
        <button type="button" className="biomes-ui-tab" onClick={onUpgrade} disabled={!property || (property?.tier ?? 1) >= 2}>Upgrade</button>
        <button type="button" className="biomes-ui-tab" onClick={onListForSale} disabled={!property}>List for Sale</button>
        <button type="button" className="biomes-ui-tab" onClick={onStartBusiness} disabled={!property || property.use !== "business"}>Open Shop</button>
        <button type="button" className="biomes-ui-tab" onClick={onRunBusinessCycle} disabled={!property?.businessId}>Serve Customers</button>
        <button type="button" className="biomes-ui-tab" onClick={onCollectBusinessRevenue} disabled={!property?.businessId}>Collect Earnings</button>
        <button type="button" className="biomes-ui-tab" onClick={onDemolish} disabled={!property}>Demolish</button>
      </div>
    </section>
  );
};

const SelectedPlotSummary: React.FunctionComponent<{
  plot: BuildingSystemPlotDefinitionV1;
  blueprint: BuildingSystemBlueprintDefinitionV1;
  owned: boolean;
  placed: boolean;
  stage: BuildingSystemStageV1;
}> = ({ plot, blueprint, owned, placed, stage }) => (
  <div className="biomes-building-card biomes-building-summary">
    <div className="biomes-building-eyebrow">Selected</div>
    <h3 className="biomes-building-card-title">{plot.displayName}</h3>
    <dl>
      <MetricTerm label="Area" value={biomesPlayerTitle(plot.area)} />
      <MetricTerm label="District" value={plot.district} />
      <MetricTerm label="Price" value={`${plot.claimPriceGold} gold`} />
      <MetricTerm label="State" value={owned ? "Safe deed" : "Mucked"} />
      <MetricTerm label="Blueprint" value={blueprint.displayName} />
      <MetricTerm label="Use" value={biomesPlayerTitle(blueprint.use)} />
      <MetricTerm label="World" value={placed ? "Placed in the Grove" : "Ready to place"} />
      <MetricTerm label="Stage" value={stageLabel(stage)} />
    </dl>
  </div>
);

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

const PropertyMetric: React.FunctionComponent<{ label: string; value: string }> = ({
  label,
  value,
}) => (
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
