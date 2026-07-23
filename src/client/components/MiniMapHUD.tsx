import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { MiniMap, MiniMapContext } from "@/client/components/map/MiniMap";
import { worldToMinimapClippedCanvasCoordinates } from "@/client/components/map/helpers";
import {
  BIOMES_UI_ACTIVE_MINIMAP_PIN_STYLE_ID,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX,
  biomesUIActiveMiniMapPinClassName,
  biomesUIActiveMiniMapPinCss,
  biomesUIActiveMiniMapPinDistanceLabelForTest,
  biomesUIActiveMiniMapPinHasFinitePosition,
  biomesUIActiveMiniMapPinLabel,
} from "@/client/components/map/markers/biomes_ui_active_minimap_pin";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import { useAnimation } from "@/client/util/animation";
import { useCurrentLandName } from "@/client/util/location_helpers";
import { readSnapshotGroveQuestState } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_EVENT,
  BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID,
  type BiomesUIActiveMapPin,
  biomesUIActiveMapPinNavigationAidSpecForTest,
  readActiveBiomesUIMapPin,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveLandmarkById,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX,
  harthmereBusinessMiniMapPinsForPlayerForTest,
  type HarthmereBusinessMiniMapPin,
} from "@/client/components/map/markers/harthmere_business_minimap_pins";
import {
  HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
  harthmerePropertyMiniMapPinsForBuildingStateForTest,
  type HarthmerePropertyMapBuildingState,
} from "@/client/components/biomes_ui/adapters/propertyMapMarkers";
import { harthmereBusinessOutpostRuntimeOffsetForTest } from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings";
import {
  harthmereObjectiveMiniMapPinsFromLandmarks,
  type HarthmereObjectiveMiniMapPin,
} from "@/client/components/map/markers/harthmere_objective_minimap_pins";
import {
  jobsBoardAcceptedJobLandmarksForBiomesUI,
  jobsBoardToolSourceLandmarksForBiomesUI,
} from "@/client/components/biomes_ui/adapters/jobsBoardQuestMapAdapter";
import {
  harthmereJobToolOwnedState,
  type HarthmereJobToolOwnedState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HARTHMERE_INVENTORY_EVENT } from "@/client/components/challenges/harthmereEvents";
import { liveEntityHelperAcceptedQuestLandmarksForBiomesUI } from "@/client/components/biomes_ui/adapters/liveEntityHelperQuestMapAdapter";
import { liveEntityHelperQuestRecordReadyToTurnIn } from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import {
  fetchHarthmereJobsBoardState,
  HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
  harthmereJobsBoardStateFromUpdatedEventDetail,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  LIVE_ENTITY_HELPER_QUEST_EVENT,
  readLiveEntityHelperQuestState,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { yaw } from "@/shared/math/linear";
import type { Vec3 } from "@/shared/math/types";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import onlinePlayerIcon from "/public/hud/icon-online-players.png";

export const MINI_MAP_WIDTH = "w-24";
export const MINI_MAP_HEIGHT = "h-24";

export const MINI_MAP_ICON_WIDTH = "w-3";
export const MINI_MAP_ICON_HEIGHT = "h-3";

const OnlinePlayers: React.FunctionComponent<{}> = ({}) => {
  const { reactResources } = useClientContext();
  const onlinePlayers =
    reactResources.use("/ecs/c/synthetic_stats", WorldMetadataId)
      ?.online_players ?? 1;
  return (
    <Tooltipped tooltip="Online Players">
      <div
        onClick={() => {
          reactResources.set("/game_modal", { kind: "map" });
        }}
        className="absolute bottom-3 right-1 flex cursor-pointer items-center gap-0.2 text-sm font-semibold text-silver"
      >
        <img src={onlinePlayerIcon.src} className="h-[2.5vmin] w-[2.5vmin]" />{" "}
        {onlinePlayers ?? 0}
      </div>
    </Tooltipped>
  );
};

const LocationName: React.FunctionComponent<{}> = ({}) => {
  const landName = useCurrentLandName();

  return (
    <div
      className={`w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-marge font-semibold`}
    >
      {landName ?? "The Muck"}
    </div>
  );
};

function isSnapshotGroveMapItemMarker(
  markerId: string,
  objective: string | undefined
) {
  const marker = snapshotGroveLandmarkById(markerId);
  const text = `${markerId} ${marker?.label ?? ""} ${
    objective ?? ""
  }`.toLowerCase();
  return (
    marker?.kind === "resource" ||
    /food|ration|item|sample|root|berry|berries|stick|stone|bolt|key|crate|satchel|basket|bin|bandage|salve|medicine|workbench|drop/.test(
      text
    )
  );
}

function useSnapshotGroveMiniMapPins() {
  const [state, setState] = useState(() => readSnapshotGroveQuestState());
  useEffect(() => {
    const refresh = () => setState(readSnapshotGroveQuestState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(
      "biomes:local-dev-snapshot-grove-quest-state",
      refresh
    );
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "biomes:local-dev-snapshot-grove-quest-state",
        refresh
      );
    };
  }, []);

  return useMemo(() => {
    const quest = SNAPSHOT_GROVE_QUESTS.find(
      (entry) => entry.id === state.activeQuestId
    );
    if (!quest || state.completedQuestIds.includes(quest.id)) {
      return [];
    }
    const activeIndex = Math.max(
      0,
      Math.min(state.activeObjectiveIndex, quest.objectives.length - 1)
    );
    return quest.markerIds
      .map((markerId, stepIndex) => {
        const marker = snapshotGroveLandmarkById(markerId);
        if (!marker) {
          return undefined;
        }
        const isActive = stepIndex === activeIndex;
        const isFuture = stepIndex >= activeIndex;
        if (!isFuture && !isActive) {
          return undefined;
        }
        const objective = quest.objectives[stepIndex];
        return {
          key: `${quest.id}-${stepIndex}-${marker.id}`,
          questId: quest.id,
          questTitle: quest.title,
          stepIndex,
          isActive,
          isItem: isSnapshotGroveMapItemMarker(marker.id, objective),
          label: marker.label,
          position: marker.position as Vec3,
          objective,
        };
      })
      .filter(Boolean)
      .slice(0, 12) as Array<{
      key: string;
      questId: string;
      questTitle: string;
      stepIndex: number;
      isActive: boolean;
      isItem: boolean;
      label: string;
      position: Vec3;
      objective?: string;
    }>;
  }, [
    state.activeObjectiveIndex,
    state.activeQuestId,
    state.completedQuestIds,
  ]);
}

const SnapshotGroveMiniMapPin: React.FunctionComponent<{
  pin: ReturnType<typeof useSnapshotGroveMiniMapPins>[number];
}> = ({ pin }) => {
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useAnimation(() => {
    if (!map || !ref.current) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.position,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map || (clipped && !pin.isActive)) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-snapshot-grove-minimap-item={pin.isItem ? "true" : "false"}
      data-snapshot-grove-minimap-active={pin.isActive ? "true" : "false"}
      title={`${pin.questTitle}: ${pin.objective ?? pin.label}`}
      style={{ zIndex: pin.isActive ? 6 : 5, willChange: "transform" }}
    >
      <div
        className={
          pin.isActive
            ? "bg-lime-300 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[9px] font-black text-black shadow-[0_0_12px_rgba(190,242,100,0.95)] [animation:snapshotGroveMiniMapPulseV111_0.95s_ease-in-out_infinite]"
            : pin.isItem
            ? "h-3.5 w-3.5 bg-amber-300 flex items-center justify-center rounded-full border border-white/80 text-[8px] font-black text-black shadow-[0_0_8px_rgba(252,211,77,0.75)]"
            : "bg-violet-300 flex h-3 w-3 items-center justify-center rounded-full border border-white/70 text-[8px] font-black text-black"
        }
      >
        {pin.isActive ? "!" : pin.isItem ? "I" : pin.stepIndex + 1}
      </div>
    </div>
  );
};

const SnapshotGroveMiniMapQuestMarkers: React.FunctionComponent<{}> = () => {
  const pins = useSnapshotGroveMiniMapPins();
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const id = "snapshot-grove-minimap-markers";
    if (document.getElementById(id)) {
      return;
    }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
@keyframes snapshotGroveMiniMapPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 9px rgba(190,242,100,0.7); }
  50% { transform: scale(1.28); box-shadow: 0 0 16px rgba(190,242,100,1); }
}`;
    document.head.appendChild(style);
  }, []);
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <SnapshotGroveMiniMapPin key={pin.key} pin={pin} />
      ))}
    </>
  );
};

function useHarthmereBusinessMiniMapPins() {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const rawPosition = localPlayer?.player?.position as Vec3 | undefined;
  // Business outpost markers are stored in production/world coordinates. The
  // offset helper only returns a non-zero value for legacy local captures.
  const offset = harthmereBusinessOutpostRuntimeOffsetForTest();
  const position: Vec3 | undefined = rawPosition
    ? [rawPosition[0] - offset.x, rawPosition[1], rawPosition[2] - offset.z]
    : undefined;
  return useMemo(
    () => harthmereBusinessMiniMapPinsForPlayerForTest(position),
    [position?.[0], position?.[1], position?.[2]]
  );
}

const HarthmereBusinessMiniMapPinMarker: React.FunctionComponent<{
  pin: HarthmereBusinessMiniMapPin;
}> = ({ pin }) => {
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useAnimation(() => {
    if (!map || !ref.current) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.position,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-harthmere-business-minimap-pin={pin.markerId}
      data-harthmere-business-minimap-pin-clipped={clipped ? "true" : "false"}
      title={`${pin.label} business outpost`}
      aria-label={`${pin.label} business outpost`}
      style={{
        zIndex: HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX,
        willChange: "transform",
      }}
    >
      <div
        className="h-3.5 w-3.5 border-white/85 bg-sky-300 text-slate-950 flex items-center justify-center rounded-[3px] border text-[8px] font-black shadow-[0_0_8px_rgba(125,211,252,0.8)]"
        style={{
          opacity: clipped ? 0.82 : 1,
          transform: clipped ? "scale(0.86)" : undefined,
        }}
      >
        B
      </div>
    </div>
  );
};

const HarthmereBusinessMiniMapMarkers: React.FunctionComponent<{}> = () => {
  const pins = useHarthmereBusinessMiniMapPins();
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <HarthmereBusinessMiniMapPinMarker key={pin.key} pin={pin} />
      ))}
    </>
  );
};

async function fetchHarthmereBuildingStateForMiniMap(): Promise<
  HarthmerePropertyMapBuildingState | undefined
> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_building_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.buildingState;
}

function useHarthmerePropertyMiniMapPins() {
  const [buildingState, setBuildingState] = useState<
    HarthmerePropertyMapBuildingState | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    const refreshFromServer = async () => {
      try {
        const nextState = await fetchHarthmereBuildingStateForMiniMap();
        if (!cancelled) setBuildingState(nextState);
      } catch {
        if (!cancelled) setBuildingState(undefined);
      }
    };
    const refreshFromEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          buildingState?: HarthmerePropertyMapBuildingState;
        }>
      ).detail;
      if (detail?.buildingState) {
        setBuildingState(detail.buildingState);
      } else {
        void refreshFromServer();
      }
    };
    void refreshFromServer();
    window.addEventListener("storage", refreshFromEvent);
    window.addEventListener(
      HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
      refreshFromEvent
    );
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refreshFromEvent);
      window.removeEventListener(
        HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
        refreshFromEvent
      );
    };
  }, []);
  return useMemo(
    () => harthmerePropertyMiniMapPinsForBuildingStateForTest(buildingState),
    [buildingState]
  );
}

const HarthmerePropertyMiniMapPinMarker: React.FunctionComponent<{
  pin: ReturnType<
    typeof harthmerePropertyMiniMapPinsForBuildingStateForTest
  >[number];
}> = ({ pin }) => {
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useAnimation(() => {
    if (!map || !ref.current) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.position,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map) {
    return null;
  }

  const terraformed = pin.terrainState === "terraformed";
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-harthmere-property-minimap-pin={pin.markerId}
      data-harthmere-property-minimap-pin-state={pin.terrainState}
      title={`${pin.label} ${
        terraformed ? "terraformed property" : "muck property"
      }`}
      aria-label={`${pin.label} ${
        terraformed ? "terraformed property" : "muck property"
      }`}
      style={{ zIndex: 7, willChange: "transform" }}
    >
      <div
        className={`h-3.5 w-3.5 border-white/85 text-slate-950 flex items-center justify-center rounded-[3px] border text-[8px] font-black shadow-[0_0_8px_rgba(251,191,36,0.8)] ${
          terraformed ? "bg-emerald-300" : "bg-amber-300"
        }`}
        style={{
          opacity: clipped ? 0.82 : 1,
          transform: clipped ? "scale(0.86)" : undefined,
        }}
      >
        {terraformed ? "T" : "P"}
      </div>
    </div>
  );
};

const HarthmerePropertyMiniMapMarkers: React.FunctionComponent<{}> = () => {
  const pins = useHarthmerePropertyMiniMapPins();
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <HarthmerePropertyMiniMapPinMarker key={pin.key} pin={pin} />
      ))}
    </>
  );
};

function useBiomesUIActiveMiniMapPin() {
  const [pin, setPin] = useState<BiomesUIActiveMapPin | undefined>(() =>
    readActiveBiomesUIMapPin()
  );
  useEffect(() => {
    const refresh = () => setPin(readActiveBiomesUIMapPin());
    window.addEventListener("storage", refresh);
    window.addEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, refresh);
    };
  }, []);
  return pin;
}

const BiomesUIActiveMiniMapPin: React.FunctionComponent<{}> = () => {
  const pin = useBiomesUIActiveMiniMapPin();
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  const [distanceLabel, setDistanceLabel] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = BIOMES_UI_ACTIVE_MINIMAP_PIN_STYLE_ID;
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = biomesUIActiveMiniMapPinCss();
    document.head.appendChild(style);
  }, []);

  useAnimation(() => {
    if (
      !pin ||
      !map ||
      !ref.current ||
      !biomesUIActiveMiniMapPinHasFinitePosition(pin.worldPosition)
    ) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.worldPosition,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    if (distanceRef.current) {
      distanceRef.current.style.transform = `translate(-50%, -50%) rotate(${-orientation}rad)`;
    }
    setDistanceLabel(
      biomesUIActiveMiniMapPinDistanceLabelForTest(
        pin.worldPosition,
        player?.player?.position
      )
    );
    setClipped(isClipped);
  });

  if (
    !pin ||
    !map ||
    !biomesUIActiveMiniMapPinHasFinitePosition(pin.worldPosition)
  ) {
    return null;
  }
  const label = biomesUIActiveMiniMapPinLabel(pin.label);
  const title = `Marked destination: ${label}${
    distanceLabel ? ` (${distanceLabel})` : ""
  }`;

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-biomes-ui-active-minimap-pin={pin.markerId}
      data-biomes-ui-active-minimap-pin-clipped={clipped ? "true" : "false"}
      title={title}
      aria-label={title}
      style={{
        zIndex: BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX,
        willChange: "transform",
      }}
    >
      <div
        className={biomesUIActiveMiniMapPinClassName(clipped)}
        aria-hidden="true"
      >
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__halo`} />
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__tail`} />
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__core`}>
          <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__dot`} />
        </span>
        {distanceLabel ? (
          <span
            ref={distanceRef}
            className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__distance`}
          >
            {distanceLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const BiomesUIActiveMapPinNavigationAid: React.FunctionComponent<{}> = () => {
  const pin = useBiomesUIActiveMiniMapPin();
  const { mapManager } = useClientContext();
  const positionKey =
    pin && Array.isArray(pin.worldPosition)
      ? pin.worldPosition.map((value) => String(value)).join("|")
      : "";

  useEffect(() => {
    const spec = biomesUIActiveMapPinNavigationAidSpecForTest(pin);
    mapManager.removeNavigationAid(BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID);
    if (!spec) {
      return;
    }
    mapManager.addNavigationAid(spec, BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID);
    return () => {
      mapManager.removeNavigationAid(BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID);
    };
  }, [mapManager, pin?.markerId, pin?.kind, positionKey]);

  return null;
};

// Minimap parity with the BiomesUI world map: accepted jobs-board jobs and
// live-entity-helper quests now also pin on the minimap, so a player gets
// passive guidance toward them without opening the full map.
function useHarthmereObjectiveMiniMapPins(): HarthmereObjectiveMiniMapPin[] {
  const [jobsRaw, setJobsRaw] = useState<unknown>(undefined);
  const [helperState, setHelperState] = useState<unknown>(undefined);
  const [toolOwned, setToolOwned] = useState<HarthmereJobToolOwnedState>(() =>
    harthmereJobToolOwnedState()
  );
  useEffect(() => {
    let cancelled = false;
    const refreshJobsFromServer = async () => {
      try {
        const snapshot = await fetchHarthmereJobsBoardState();
        if (!cancelled) setJobsRaw(snapshot);
      } catch {
        // Leave the previous snapshot in place on a transient failure.
      }
    };
    const onJobs = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) {
        // The shared event wraps the authoritative snapshot. Unwrap it before
        // marker projection so accepted jobs appear immediately on the minimap.
        setJobsRaw(harthmereJobsBoardStateFromUpdatedEventDetail(detail));
      } else {
        void refreshJobsFromServer();
      }
    };
    const onHelper = () => setHelperState(readLiveEntityHelperQuestState());
    // Acquiring (or losing) the repair or cleanup tool flips whether the
    // "buy the tool here" vendor pin should show, so refresh it on inventory
    // changes too.
    const onInventory = () => setToolOwned(harthmereJobToolOwnedState());
    void refreshJobsFromServer();
    onHelper();
    onInventory();
    window.addEventListener(HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT, onJobs);
    window.addEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, onHelper);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, onInventory);
    window.addEventListener("storage", onHelper);
    window.addEventListener("storage", onInventory);
    return () => {
      cancelled = true;
      window.removeEventListener(
        HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
        onJobs
      );
      window.removeEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, onHelper);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, onInventory);
      window.removeEventListener("storage", onHelper);
      window.removeEventListener("storage", onInventory);
    };
  }, []);
  return useMemo(
    () =>
      harthmereObjectiveMiniMapPinsFromLandmarks([
        ...jobsBoardAcceptedJobLandmarksForBiomesUI(jobsRaw),
        ...jobsBoardToolSourceLandmarksForBiomesUI(jobsRaw, toolOwned),
        ...liveEntityHelperAcceptedQuestLandmarksForBiomesUI(helperState, {
          isReadyToTurnIn: liveEntityHelperQuestRecordReadyToTurnIn,
        }),
      ]),
    [jobsRaw, helperState, toolOwned]
  );
}

const HarthmereObjectiveMiniMapPinMarker: React.FunctionComponent<{
  pin: HarthmereObjectiveMiniMapPin;
}> = ({ pin }) => {
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useAnimation(() => {
    if (!map || !ref.current) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.position,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-harthmere-objective-minimap-pin={pin.markerId}
      data-harthmere-objective-minimap-pin-clipped={clipped ? "true" : "false"}
      title={pin.label}
      aria-label={pin.label}
      style={{ zIndex: 8, willChange: "transform" }}
    >
      <div
        className="h-3.5 w-3.5 border-white/85 bg-yellow-300 text-slate-950 flex items-center justify-center rounded-full border text-[8px] font-black shadow-[0_0_8px_rgba(253,224,71,0.85)]"
        style={{
          opacity: clipped ? 0.82 : 1,
          transform: clipped ? "scale(0.86)" : undefined,
        }}
      >
        !
      </div>
    </div>
  );
};

const HarthmereObjectiveMiniMapMarkers: React.FunctionComponent<{}> = () => {
  const pins = useHarthmereObjectiveMiniMapPins();
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <HarthmereObjectiveMiniMapPinMarker key={pin.key} pin={pin} />
      ))}
    </>
  );
};

export const MiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  return (
    <div
      className={`relative flex ${MINI_MAP_WIDTH} flex-col items-center gap-0.6 text-white text-shadow-bordered`}
    >
      <BiomesUIActiveMapPinNavigationAid />
      <MiniMap>
        <SnapshotGroveMiniMapQuestMarkers />
        <HarthmereBusinessMiniMapMarkers />
        <HarthmerePropertyMiniMapMarkers />
        <HarthmereObjectiveMiniMapMarkers />
        <BiomesUIActiveMiniMapPin />
      </MiniMap>
      <OnlinePlayers />
      <LocationName />
    </div>
  );
};
