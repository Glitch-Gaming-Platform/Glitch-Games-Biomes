import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetchV1 } from "@/client/components/harthmere_live_fetch";
import { MiniMap, MiniMapContext } from "@/client/components/map/MiniMap";
import { worldToMinimapClippedCanvasCoordinates } from "@/client/components/map/helpers";
import { BIOMES_UI_ACTIVE_MINIMAP_PIN_STYLE_ID_V146, BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146, BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX_V146, biomesUIActiveMiniMapPinClassNameV146, biomesUIActiveMiniMapPinCssV146, biomesUIActiveMiniMapPinHasFinitePositionV146, biomesUIActiveMiniMapPinLabelV146 } from "@/client/components/map/markers/biomes_ui_active_minimap_pin_v146";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import { useAnimation } from "@/client/util/animation";
import { useCurrentLandName } from "@/client/util/location_helpers";
import { readSnapshotGroveQuestStateV75 } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147, type BiomesUIActiveMapPinV142, biomesUIActiveMapPinNavigationAidSpecForTest, readActiveBiomesUIMapPinV142 } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { SNAPSHOT_GROVE_QUESTS_V75, snapshotGroveLandmarkByIdV75 } from "@/shared/harthmere/snapshot_grove_content_v75";
import { HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX_V1, harthmereBusinessMiniMapPinsForPlayerForTest, type HarthmereBusinessMiniMapPinV1 } from "@/client/components/map/markers/harthmere_business_minimap_pins_v1";
import { HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1, harthmerePropertyMiniMapPinsForBuildingStateForTest, type HarthmerePropertyMapBuildingStateV1 } from "@/client/components/biomes_ui/adapters/propertyMapMarkersV1";
import { harthmereBusinessOutpostRuntimeOffsetForTestV1 } from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings_v1";
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
  const onlinePlayers = reactResources.use("/ecs/c/synthetic_stats", WorldMetadataId)?.online_players ?? 1;
  return (
    <Tooltipped tooltip="Online Players">
      <div
        onClick={() => {
          reactResources.set("/game_modal", { kind: "map" });
        }}
        className="absolute bottom-3 right-1 flex cursor-pointer items-center gap-0.2 text-sm font-semibold text-silver"
      >
        <img src={onlinePlayerIcon.src} className="h-[2.5vmin] w-[2.5vmin]" /> {onlinePlayers ?? 0}
      </div>
    </Tooltipped>
  );
};

const LocationName: React.FunctionComponent<{}> = ({}) => {
  const landName = useCurrentLandName();

  return <div className={`w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-marge font-semibold`}>{landName ?? "The Muck"}</div>;
};

function isSnapshotGroveMapItemMarkerV111(markerId: string, objective: string | undefined) {
  const marker = snapshotGroveLandmarkByIdV75(markerId);
  const text = `${markerId} ${marker?.label ?? ""} ${objective ?? ""}`.toLowerCase();
  return marker?.kind === "resource" || /food|ration|item|sample|root|berry|berries|stick|stone|bolt|key|crate|satchel|basket|bin|bandage|salve|medicine|workbench|drop/.test(text);
}

function useSnapshotGroveMiniMapPinsV111() {
  const [state, setState] = useState(() => readSnapshotGroveQuestStateV75());
  useEffect(() => {
    const refresh = () => setState(readSnapshotGroveQuestStateV75());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", refresh);
    };
  }, []);

  return useMemo(() => {
    const quest = SNAPSHOT_GROVE_QUESTS_V75.find((entry) => entry.id === state.activeQuestId);
    if (!quest || state.completedQuestIds.includes(quest.id)) {
      return [];
    }
    const activeIndex = Math.max(0, Math.min(state.activeObjectiveIndex, quest.objectives.length - 1));
    return quest.markerIds
      .map((markerId, stepIndex) => {
        const marker = snapshotGroveLandmarkByIdV75(markerId);
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
          isItem: isSnapshotGroveMapItemMarkerV111(marker.id, objective),
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
  }, [state.activeObjectiveIndex, state.activeQuestId, state.completedQuestIds]);
}

const SnapshotGroveMiniMapPinV111: React.FunctionComponent<{
  pin: ReturnType<typeof useSnapshotGroveMiniMapPinsV111>[number];
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
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(maxDist, pin.position, player, zoomRef.current, map.offsetWidth ?? 0, map.offsetHeight ?? 0);
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map || (clipped && !pin.isActive)) {
    return null;
  }

  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 flex items-center justify-center" data-snapshot-grove-minimap-item-v111={pin.isItem ? "true" : "false"} data-snapshot-grove-minimap-active-v111={pin.isActive ? "true" : "false"} title={`${pin.questTitle}: ${pin.objective ?? pin.label}`} style={{ zIndex: pin.isActive ? 6 : 5, willChange: "transform" }}>
      <div className={pin.isActive ? "bg-lime-300 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[9px] font-black text-black shadow-[0_0_12px_rgba(190,242,100,0.95)] [animation:snapshotGroveMiniMapPulseV111_0.95s_ease-in-out_infinite]" : pin.isItem ? "h-3.5 w-3.5 bg-amber-300 flex items-center justify-center rounded-full border border-white/80 text-[8px] font-black text-black shadow-[0_0_8px_rgba(252,211,77,0.75)]" : "bg-violet-300 flex h-3 w-3 items-center justify-center rounded-full border border-white/70 text-[8px] font-black text-black"}>{pin.isActive ? "!" : pin.isItem ? "I" : pin.stepIndex + 1}</div>
    </div>
  );
};

const SnapshotGroveMiniMapQuestMarkersV111: React.FunctionComponent<{}> = () => {
  const pins = useSnapshotGroveMiniMapPinsV111();
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const id = "snapshot-grove-minimap-markers-v111";
    if (document.getElementById(id)) {
      return;
    }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
@keyframes snapshotGroveMiniMapPulseV111 {
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
        <SnapshotGroveMiniMapPinV111 key={pin.key} pin={pin} />
      ))}
    </>
  );
};

function useHarthmereBusinessMiniMapPinsV1() {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const rawPosition = localPlayer?.player?.position as Vec3 | undefined;
  // Business outpost markers are stored in production/world coordinates. The
  // offset helper only returns a non-zero value for legacy local captures.
  const offset = harthmereBusinessOutpostRuntimeOffsetForTestV1();
  const position: Vec3 | undefined = rawPosition ? [rawPosition[0] - offset.x, rawPosition[1], rawPosition[2] - offset.z] : undefined;
  return useMemo(() => harthmereBusinessMiniMapPinsForPlayerForTest(position), [position?.[0], position?.[1], position?.[2]]);
}

const HarthmereBusinessMiniMapPinMarkerV1: React.FunctionComponent<{
  pin: HarthmereBusinessMiniMapPinV1;
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
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(maxDist, pin.position, player, zoomRef.current, map.offsetWidth ?? 0, map.offsetHeight ?? 0);
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
      data-harthmere-business-minimap-pin-v1={pin.markerId}
      data-harthmere-business-minimap-pin-clipped-v1={clipped ? "true" : "false"}
      title={`${pin.label} business outpost`}
      aria-label={`${pin.label} business outpost`}
      style={{
        zIndex: HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX_V1,
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

const HarthmereBusinessMiniMapMarkersV1: React.FunctionComponent<{}> = () => {
  const pins = useHarthmereBusinessMiniMapPinsV1();
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <HarthmereBusinessMiniMapPinMarkerV1 key={pin.key} pin={pin} />
      ))}
    </>
  );
};

async function fetchHarthmereBuildingStateForMiniMapV1(): Promise<HarthmerePropertyMapBuildingStateV1 | undefined> {
  const response = await defaultHarthmereLiveFetchV1(
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

function useHarthmerePropertyMiniMapPinsV1() {
  const [buildingState, setBuildingState] = useState<HarthmerePropertyMapBuildingStateV1 | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const refreshFromServer = async () => {
      try {
        const nextState = await fetchHarthmereBuildingStateForMiniMapV1();
        if (!cancelled) setBuildingState(nextState);
      } catch {
        if (!cancelled) setBuildingState(undefined);
      }
    };
    const refreshFromEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          buildingState?: HarthmerePropertyMapBuildingStateV1;
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
    window.addEventListener(HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1, refreshFromEvent);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refreshFromEvent);
      window.removeEventListener(HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1, refreshFromEvent);
    };
  }, []);
  return useMemo(() => harthmerePropertyMiniMapPinsForBuildingStateForTest(buildingState), [buildingState]);
}

const HarthmerePropertyMiniMapPinMarkerV1: React.FunctionComponent<{
  pin: ReturnType<typeof harthmerePropertyMiniMapPinsForBuildingStateForTest>[number];
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
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(maxDist, pin.position, player, zoomRef.current, map.offsetWidth ?? 0, map.offsetHeight ?? 0);
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map) {
    return null;
  }

  const terraformed = pin.terrainState === "terraformed";
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 flex items-center justify-center" data-harthmere-property-minimap-pin-v1={pin.markerId} data-harthmere-property-minimap-pin-state-v1={pin.terrainState} title={`${pin.label} ${terraformed ? "terraformed property" : "muck property"}`} aria-label={`${pin.label} ${terraformed ? "terraformed property" : "muck property"}`} style={{ zIndex: 7, willChange: "transform" }}>
      <div
        className={`h-3.5 w-3.5 border-white/85 text-slate-950 flex items-center justify-center rounded-[3px] border text-[8px] font-black shadow-[0_0_8px_rgba(251,191,36,0.8)] ${terraformed ? "bg-emerald-300" : "bg-amber-300"}`}
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

const HarthmerePropertyMiniMapMarkersV1: React.FunctionComponent<{}> = () => {
  const pins = useHarthmerePropertyMiniMapPinsV1();
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <HarthmerePropertyMiniMapPinMarkerV1 key={pin.key} pin={pin} />
      ))}
    </>
  );
};

function useBiomesUIActiveMiniMapPinV142() {
  const [pin, setPin] = useState<BiomesUIActiveMapPinV142 | undefined>(() => readActiveBiomesUIMapPinV142());
  useEffect(() => {
    const refresh = () => setPin(readActiveBiomesUIMapPinV142());
    window.addEventListener("storage", refresh);
    window.addEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, refresh);
    };
  }, []);
  return pin;
}

const BiomesUIActiveMiniMapPinV142: React.FunctionComponent<{}> = () => {
  const pin = useBiomesUIActiveMiniMapPinV142();
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = BIOMES_UI_ACTIVE_MINIMAP_PIN_STYLE_ID_V146;
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = biomesUIActiveMiniMapPinCssV146();
    document.head.appendChild(style);
  }, []);

  useAnimation(() => {
    if (!pin || !map || !ref.current || !biomesUIActiveMiniMapPinHasFinitePositionV146(pin.worldPosition)) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(maxDist, pin.worldPosition, player, zoomRef.current, map.offsetWidth ?? 0, map.offsetHeight ?? 0);
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!pin || !map || !biomesUIActiveMiniMapPinHasFinitePositionV146(pin.worldPosition)) {
    return null;
  }
  const label = biomesUIActiveMiniMapPinLabelV146(pin.label);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-biomes-ui-active-minimap-pin-v142={pin.markerId}
      data-biomes-ui-active-minimap-pin-clipped-v146={clipped ? "true" : "false"}
      title={`Marked destination: ${label}`}
      aria-label={`Marked destination: ${label}`}
      style={{
        zIndex: BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX_V146,
        willChange: "transform",
      }}
    >
      <div className={biomesUIActiveMiniMapPinClassNameV146(clipped)} aria-hidden="true">
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146}__halo`} />
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146}__tail`} />
        <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146}__core`}>
          <span className={`${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146}__dot`} />
        </span>
      </div>
    </div>
  );
};

const BiomesUIActiveMapPinNavigationAidV147: React.FunctionComponent<{}> = () => {
  const pin = useBiomesUIActiveMiniMapPinV142();
  const { mapManager } = useClientContext();
  const positionKey = pin && Array.isArray(pin.worldPosition) ? pin.worldPosition.map((value) => String(value)).join("|") : "";

  useEffect(() => {
    const spec = biomesUIActiveMapPinNavigationAidSpecForTest(pin);
    mapManager.removeNavigationAid(BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147);
    if (!spec) {
      return;
    }
    mapManager.addNavigationAid(spec, BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147);
    return () => {
      mapManager.removeNavigationAid(BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147);
    };
  }, [mapManager, pin?.markerId, pin?.kind, positionKey]);

  return null;
};

export const MiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  return (
    <div className={`relative flex ${MINI_MAP_WIDTH} flex-col items-center gap-0.6 text-white text-shadow-bordered`}>
      <BiomesUIActiveMapPinNavigationAidV147 />
      <MiniMap>
        <SnapshotGroveMiniMapQuestMarkersV111 />
        <HarthmereBusinessMiniMapMarkersV1 />
        <HarthmerePropertyMiniMapMarkersV1 />
        <BiomesUIActiveMiniMapPinV142 />
      </MiniMap>
      <OnlinePlayers />
      <LocationName />
    </div>
  );
};
