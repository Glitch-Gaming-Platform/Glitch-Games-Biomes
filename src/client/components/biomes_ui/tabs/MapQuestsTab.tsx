// MapQuestsTab — production world map + mission journal.
//
// No placeholder markers live here. The tab renders only live adapter data:
// current player position, Grove landmarks, quest markers, service NPCs/stores,
// and mission objectives supplied by the Snapshot/Grove adapter.
//
// BIOMES_UI_MAP_TAB_V141 upgrade:
//   - Mouse wheel zoom (centered on cursor).
//   - Click+drag to pan.
//   - Player marker is a pulsing ring (animated, easy to spot).
//   - Active-quest markers are larger, color-shifted, and labeled.
//   - Right rail is split: mission journal (active step list) AND a
//     trackable quest list with click-to-pan behaviour.
//   - Mobile-responsive: collapses to a single column under 720px, the
//     map scales to viewport height, side rail moves underneath.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  type BiomesUIActiveMapPinV142,
  writeActiveBiomesUIMapPinV142,
} from "../adapters/mapPinnedDestination";

export type MapMarkerKind =
  | "objective"
  | "vendor"
  | "store"
  | "business"
  | "bank"
  | "quest"
  | "rift"
  | "resource"
  | "property"
  | "danger"
  | "safe_zone"
  | "route"
  | "town"
  | "player";

export interface MapMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: MapMarkerKind;
  active?: boolean;
  description?: string;
  worldPosition?: [number, number, number];
}

type MapTerrainKind = "water" | "muck" | "road" | "town" | "resource" | "safe_zone" | "highland";

export interface MapTerrainFeature {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MapTerrainKind;
  rotation?: number;
  round?: boolean;
}

interface MissionStep { id: string; title: string; objective: string; done: boolean }

// BIOMES_UI_MAP_TAB_QUESTS_V141:
// Trackable-quest entries surface in the new clickable side list and let
// the player center the map on each quest's first marker without scrolling
// through the active mission timeline.
export interface MapTrackableQuest {
  questId: string;
  title: string;
  area: string;
  status: "active" | "available" | "completed";
  firstMarkerId?: string;
  reward?: string;
}

interface MapAdapter {
  getMarkers?: () => MapMarker[];
  getPlayerMarker?: () => MapMarker | undefined;
  getMissionTitle?: () => string;
  getMissionSteps?: () => MissionStep[];
  getMapBounds?: () => { minX: number; maxX: number; minZ: number; maxZ: number } | undefined;
  getTrackableQuests?: () => MapTrackableQuest[];
  getActiveMapPin?: () => BiomesUIActiveMapPinV142 | undefined;
  setActiveMapPin?: (marker: MapMarker) => void;
  clearActiveMapPin?: () => void;
}

type MapPanelTab = "quests" | "people" | "buildings" | "properties" | "geography";

const MAP_PANEL_TABS: Array<{ id: MapPanelTab; label: string }> = [
  { id: "quests", label: "Quests" },
  { id: "people", label: "People" },
  { id: "buildings", label: "Buildings" },
  { id: "properties", label: "My Properties" },
  { id: "geography", label: "Geography" },
];

const KIND_LABEL: Record<MapMarkerKind, string> = {
  objective: "Objective",
  vendor: "NPC",
  store: "Store",
  business: "Business",
  bank: "Bank",
  quest: "Jobs / Quest Board",
  rift: "Rift",
  resource: "Resource",
  property: "Property",
  danger: "Danger",
  safe_zone: "Safe Zone",
  route: "Route",
  town: "Town",
  player: "You",
};

const KIND_COLOR: Record<MapMarkerKind, string> = {
  objective: "var(--biomes-warn-amber)",
  vendor: "#7dd3fc",
  store: "#93c5fd",
  business: "#67e8f9",
  bank: "#c4b5fd",
  quest: "var(--biomes-edge-cyan)",
  rift: "var(--biomes-edge-magenta)",
  resource: "#86efac",
  property: "#fbbf24",
  danger: "#f87171",
  safe_zone: "#a7f3d0",
  route: "#facc15",
  town: "#38bdf8",
  player: "#ffffff",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function markerPosition(marker: { x: number; y: number }, zoom: number, pan: { x: number; y: number }) {
  const x = ((clamp01(marker.x) - 0.5) * zoom + 0.5 + pan.x) * 100;
  const y = ((clamp01(marker.y) - 0.5) * zoom + 0.5 + pan.y) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

function terrainFeatureStyle(feature: MapTerrainFeature, zoom: number, pan: { x: number; y: number }): React.CSSProperties {
  const pos = markerPosition(feature, zoom, pan);
  return {
    position: "absolute",
    ...pos,
    width: `${Math.max(2, feature.width * zoom * 100)}%`,
    height: `${Math.max(2, feature.height * zoom * 100)}%`,
    transform: `translate(-50%, -50%) rotate(${feature.rotation ?? 0}deg)`,
    borderRadius: feature.round ? "999px" : 10,
    background: TERRAIN_FILL[feature.kind],
    border: `1px solid ${TERRAIN_STROKE[feature.kind]}`,
    boxShadow: TERRAIN_SHADOW[feature.kind],
    opacity: 0.88,
    pointerEvents: "none",
  };
}

export function centeredPanForMapMarkerForTest(
  marker: { x: number; y: number },
  zoom = 1
) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 1;
  return {
    x: (0.5 - clamp01(marker.x)) * safeZoom,
    y: (0.5 - clamp01(marker.y)) * safeZoom,
  };
}

export function mapPanelTabForMarkerForTest(marker: Pick<MapMarker, "kind" | "active">): MapPanelTab[] {
  if (marker.kind === "player") return MAP_PANEL_TABS.map((entry) => entry.id);
  const tabs: MapPanelTab[] = [];
  if (marker.kind === "objective" || marker.kind === "quest" || marker.active) tabs.push("quests");
  if (marker.kind === "vendor") tabs.push("people");
  if (marker.kind === "store" || marker.kind === "business" || marker.kind === "bank" || marker.kind === "quest") tabs.push("buildings");
  if (marker.kind === "property") tabs.push("properties");
  if (
    marker.kind === "safe_zone" ||
    marker.kind === "resource" ||
    marker.kind === "danger" ||
    marker.kind === "rift" ||
    marker.kind === "route" ||
    marker.kind === "town"
  ) {
    tabs.push("geography");
  }
  return tabs.length ? tabs : ["geography"];
}

export function shouldRenderMapMarkerLabelForTest(marker: Pick<MapMarker, "label">): boolean {
  return marker.label.trim().length > 0;
}

export function mapMarkerVisualStateForTest(
  marker: Pick<MapMarker, "id" | "kind" | "active">,
  activeMapPinMarkerId?: string
) {
  const isPlayer = marker.kind === "player";
  const isPinnedDestination =
    !isPlayer && Boolean(activeMapPinMarkerId) && activeMapPinMarkerId === marker.id;
  const isActive = Boolean(marker.active) || isPinnedDestination;
  return {
    isPlayer,
    isActive,
    isPinnedDestination,
    size: isPlayer ? 20 : isActive ? 18 : 12,
    zIndex: isPinnedDestination ? 5 : isPlayer ? 4 : isActive ? 3 : 2,
  };
}

export function nextMapZoomForWheelForTest(currentZoom: number, deltaY: number) {
  const delta = deltaY < 0 ? 0.15 : -0.15;
  return Math.max(0.5, Math.min(8, currentZoom * (1 + delta)));
}

export { activeBiomesUIMapPinFromMarkerForTest };

const TERRAIN_FILL: Record<MapTerrainKind, string> = {
  water: "linear-gradient(135deg, rgba(37, 99, 235, 0.32), rgba(14, 165, 233, 0.20))",
  muck: "linear-gradient(135deg, rgba(91, 33, 182, 0.38), rgba(76, 29, 149, 0.18))",
  road: "linear-gradient(90deg, rgba(180, 83, 9, 0.30), rgba(234, 179, 8, 0.22))",
  town: "linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(34, 197, 94, 0.16))",
  resource: "linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(132, 204, 22, 0.16))",
  safe_zone: "linear-gradient(135deg, rgba(16, 185, 129, 0.30), rgba(125, 211, 252, 0.14))",
  highland: "linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(100, 116, 139, 0.12))",
};

const TERRAIN_STROKE: Record<MapTerrainKind, string> = {
  water: "rgba(125, 211, 252, 0.34)",
  muck: "rgba(196, 181, 253, 0.32)",
  road: "rgba(250, 204, 21, 0.28)",
  town: "rgba(94, 234, 212, 0.28)",
  resource: "rgba(134, 239, 172, 0.34)",
  safe_zone: "rgba(167, 243, 208, 0.38)",
  highland: "rgba(226, 232, 240, 0.20)",
};

const TERRAIN_SHADOW: Record<MapTerrainKind, string> = {
  water: "0 0 28px rgba(14, 165, 233, 0.16)",
  muck: "0 0 24px rgba(124, 58, 237, 0.20)",
  road: "0 0 18px rgba(234, 179, 8, 0.12)",
  town: "0 0 20px rgba(20, 184, 166, 0.12)",
  resource: "0 0 18px rgba(34, 197, 94, 0.14)",
  safe_zone: "0 0 22px rgba(167, 243, 208, 0.14)",
  highland: "0 0 18px rgba(148, 163, 184, 0.10)",
};

export function geographyTerrainFeaturesForMapMarkersForTest(markers: MapMarker[]): MapTerrainFeature[] {
  return markers
    .filter((marker) => marker.kind !== "player")
    .map((marker): MapTerrainFeature | undefined => {
      const label = marker.label.toLowerCase();
      const description = marker.description?.toLowerCase() ?? "";
      const text = `${label} ${description}`;
      if (marker.kind === "danger" || text.includes("muck")) {
        return {
          id: `terrain-muck-${marker.id}`,
          label: `${marker.label} terrain`,
          x: marker.x,
          y: marker.y,
          width: 0.18,
          height: 0.12,
          kind: "muck",
          rotation: -10,
          round: true,
        };
      }
      if (marker.kind === "route" || text.includes("road") || text.includes("bridge")) {
        return {
          id: `terrain-route-${marker.id}`,
          label: `${marker.label} route`,
          x: marker.x,
          y: marker.y,
          width: text.includes("bridge") ? 0.22 : 0.18,
          height: 0.035,
          kind: text.includes("bridge") ? "water" : "road",
          rotation: text.includes("bridge") ? -6 : 8,
          round: true,
        };
      }
      if (marker.kind === "town") {
        return {
          id: `terrain-town-${marker.id}`,
          label: `${marker.label} town area`,
          x: marker.x,
          y: marker.y,
          width: 0.16,
          height: 0.14,
          kind: "town",
          round: true,
        };
      }
      if (marker.kind === "safe_zone") {
        return {
          id: `terrain-safe-${marker.id}`,
          label: `${marker.label} safe zone`,
          x: marker.x,
          y: marker.y,
          width: 0.12,
          height: 0.1,
          kind: "safe_zone",
          round: true,
        };
      }
      if (marker.kind === "resource") {
        return {
          id: `terrain-resource-${marker.id}`,
          label: `${marker.label} resource patch`,
          x: marker.x,
          y: marker.y,
          width: 0.1,
          height: 0.08,
          kind: text.includes("stone") || text.includes("mountain") ? "highland" : "resource",
          round: true,
        };
      }
      return undefined;
    })
    .filter((feature): feature is MapTerrainFeature => Boolean(feature));
}

function markersForPanelTab(markers: MapMarker[], tab: MapPanelTab): MapMarker[] {
  return markers.filter((marker) => mapPanelTabForMarkerForTest(marker).includes(tab));
}

function filterTokens(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function textMatchesFilter(filter: string, values: Array<unknown>): boolean {
  const tokens = filterTokens(filter);
  if (tokens.length === 0) return true;
  const haystack = values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase())
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

export function filterMapMissionStepsForTest(steps: MissionStep[], filter: string): MissionStep[] {
  return steps.filter((step) =>
    textMatchesFilter(filter, [
      step.id,
      step.title,
      step.objective,
      step.done ? "completed done" : "current active in progress",
    ])
  );
}

export function filterMapTrackableQuestsForTest(
  quests: MapTrackableQuest[],
  filter: string
): MapTrackableQuest[] {
  return quests.filter((quest) =>
    textMatchesFilter(filter, [
      quest.questId,
      quest.title,
      quest.area,
      quest.status,
      quest.reward,
      quest.firstMarkerId,
    ])
  );
}

export function filterMapMarkersForTest(markers: MapMarker[], filter: string): MapMarker[] {
  return markers.filter((marker) =>
    textMatchesFilter(filter, [
      marker.id,
      marker.label,
      KIND_LABEL[marker.kind],
      marker.kind,
      marker.description,
    ])
  );
}

function distanceFromPlayer(marker: MapMarker, player?: MapMarker): number | undefined {
  if (!marker.worldPosition || !player?.worldPosition) return undefined;
  const dx = marker.worldPosition[0] - player.worldPosition[0];
  const dz = marker.worldPosition[2] - player.worldPosition[2];
  return Math.round(Math.sqrt(dx * dx + dz * dz));
}

// BIOMES_UI_MAP_TAB_V141:
// Inject the keyframes for the player pulse + active-marker ping. Idempotent —
// guarded by the style tag id so multiple mounts don't duplicate.
function ensureMapTabStylesV141() {
  if (typeof document === "undefined") return;
  const id = "biomes-ui-map-tab-styles-v141";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes biomesMapPlayerPulseV141 {
  0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.85), 0 0 14px rgba(255,255,255,0.6); }
  70%  { box-shadow: 0 0 0 12px rgba(255,255,255,0), 0 0 22px rgba(255,255,255,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 0 14px rgba(255,255,255,0.6); }
}
@keyframes biomesMapActivePingV141 {
  0%   { box-shadow: 0 0 0 0 rgba(252,211,77,0.85), 0 0 14px rgba(252,211,77,0.6); }
  70%  { box-shadow: 0 0 0 14px rgba(252,211,77,0),    0 0 22px rgba(252,211,77,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(252,211,77,0),       0 0 14px rgba(252,211,77,0.6); }
}
.biomes-map-tab-v141 .biomes-map-marker:focus-visible {
  outline: 2px solid var(--biomes-edge-cyan);
  outline-offset: 2px;
}
@media (max-width: 720px) {
  .biomes-map-tab-v141 {
    grid-template-columns: 1fr !important;
  }
  .biomes-map-tab-v141 .biomes-map-canvas {
    min-height: 320px;
    aspect-ratio: 4 / 3;
  }
}
`;
  document.head.appendChild(style);
}

export const MapQuestsTab: React.FunctionComponent<{ adapter?: MapAdapter }> = ({ adapter }) => {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [focusedMarkerId, setFocusedMarkerId] = React.useState<string | null>(null);
  const [trackedQuestId, setTrackedQuestId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<MapPanelTab>("quests");
  const [panelFilters, setPanelFilters] = React.useState<Record<MapPanelTab, string>>({
    quests: "",
    people: "",
    buildings: "",
    properties: "",
    geography: "",
  });
  const [activeMapPin, setActiveMapPin] = React.useState<BiomesUIActiveMapPinV142 | undefined>(() => adapter?.getActiveMapPin?.());
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const didAutoCenterPlayerRef = React.useRef(false);

  React.useEffect(() => ensureMapTabStylesV141(), []);

  const markers = React.useMemo(() => adapter?.getMarkers?.() ?? [], [adapter]);
  const playerMarker = adapter?.getPlayerMarker?.();
  const allMarkers = React.useMemo(() => {
    const byId = new Map<string, MapMarker>();
    for (const marker of markers) byId.set(marker.id, marker);
    if (playerMarker) byId.set(playerMarker.id, playerMarker);
    return Array.from(byId.values());
  }, [markers, playerMarker]);
  const title = adapter?.getMissionTitle?.() ?? "No active mission";
  const steps = adapter?.getMissionSteps?.() ?? [];
  const bounds = adapter?.getMapBounds?.();
  const trackableQuests = adapter?.getTrackableQuests?.() ?? [];
  const activeFilter = panelFilters[activeTab] ?? "";
  const hasActiveFilter = activeFilter.trim().length > 0;
  const activePanelLabel =
    MAP_PANEL_TABS.find((tab) => tab.id === activeTab)?.label ?? "List";
  const activePanelFilterDescription = activePanelLabel.toLowerCase();
  const filteredSteps = React.useMemo(
    () => filterMapMissionStepsForTest(steps, activeTab === "quests" ? activeFilter : ""),
    [activeFilter, activeTab, steps]
  );
  const filteredTrackableQuests = React.useMemo(
    () => filterMapTrackableQuestsForTest(trackableQuests, activeTab === "quests" ? activeFilter : ""),
    [activeFilter, activeTab, trackableQuests]
  );
  const focusedMarker = focusedMarkerId ? allMarkers.find((marker) => marker.id === focusedMarkerId) : undefined;
  const visibleMarkers = React.useMemo(
    () => markersForPanelTab(allMarkers, activeTab),
    [activeTab, allMarkers]
  );
  React.useEffect(() => {
    setActiveMapPin(adapter?.getActiveMapPin?.());
  }, [adapter, markers.length, playerMarker?.worldPosition?.join(","), visibleMarkers.length]);
  const visibleMapMarkers = React.useMemo(() => {
    if (!playerMarker) return visibleMarkers;
    return visibleMarkers.some((marker) => marker.id === playerMarker.id)
      ? visibleMarkers
      : [...visibleMarkers, playerMarker];
  }, [playerMarker, visibleMarkers]);
  const peopleMarkers = React.useMemo(() => markersForPanelTab(allMarkers, "people"), [allMarkers]);
  const buildingMarkers = React.useMemo(() => markersForPanelTab(allMarkers, "buildings"), [allMarkers]);
  const propertyMarkers = React.useMemo(() => markersForPanelTab(allMarkers, "properties"), [allMarkers]);
  const geographyMarkers = React.useMemo(() => markersForPanelTab(allMarkers, "geography"), [allMarkers]);
  const filteredPeopleMarkers = React.useMemo(
    () => filterMapMarkersForTest(peopleMarkers, activeTab === "people" ? activeFilter : ""),
    [activeFilter, activeTab, peopleMarkers]
  );
  const filteredBuildingMarkers = React.useMemo(
    () => filterMapMarkersForTest(buildingMarkers, activeTab === "buildings" ? activeFilter : ""),
    [activeFilter, activeTab, buildingMarkers]
  );
  const filteredPropertyMarkers = React.useMemo(
    () => filterMapMarkersForTest(propertyMarkers, activeTab === "properties" ? activeFilter : ""),
    [activeFilter, activeTab, propertyMarkers]
  );
  const filteredGeographyMarkers = React.useMemo(
    () => filterMapMarkersForTest(geographyMarkers, activeTab === "geography" ? activeFilter : ""),
    [activeFilter, activeTab, geographyMarkers]
  );
  const geographyTerrainFeatures = React.useMemo(
    () => geographyTerrainFeaturesForMapMarkersForTest(geographyMarkers),
    [geographyMarkers]
  );

  const clampZoom = React.useCallback((value: number) => Math.max(0.5, Math.min(8, value)), []);
  const zoomIn = () => setZoom((value) => clampZoom(Number((value + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((value) => clampZoom(Number((value - 0.25).toFixed(2))));
  const resetView = () => {
    const nextZoom = playerMarker ? 2 : 1;
    setZoom(nextZoom);
    setPan(playerMarker ? centeredPanForMapMarkerForTest(playerMarker, nextZoom) : { x: 0, y: 0 });
    setFocusedMarkerId(null);
    setTrackedQuestId(null);
  };
  const centerOnMarker = React.useCallback((marker: { x: number; y: number; id: string }) => {
    const nextZoom = Math.max(zoom, 2);
    setZoom(nextZoom);
    setPan(centeredPanForMapMarkerForTest(marker, nextZoom));
    setFocusedMarkerId(marker.id);
  }, [zoom]);
  const centerOnPlayer = () => {
    if (!playerMarker) return;
    centerOnMarker(playerMarker);
  };
  const updateActiveFilter = (value: string) => {
    setPanelFilters((filters) => ({ ...filters, [activeTab]: value }));
  };
  const trackQuest = (quest: MapTrackableQuest) => {
    setActiveTab("quests");
    setTrackedQuestId(quest.questId);
    const marker = quest.firstMarkerId
      ? allMarkers.find((entry) => entry.id === quest.firstMarkerId)
      : undefined;
    if (marker) centerOnMarker(marker);
  };
  const setActiveDestination = React.useCallback((marker: MapMarker) => {
    const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
    if (!pin) return;
    if (adapter?.setActiveMapPin) {
      adapter.setActiveMapPin(marker);
    } else {
      writeActiveBiomesUIMapPinV142(pin);
    }
    setActiveMapPin(pin);
  }, [adapter]);
  const clearActiveDestination = React.useCallback(() => {
    if (adapter?.clearActiveMapPin) {
      adapter.clearActiveMapPin();
    } else {
      writeActiveBiomesUIMapPinV142(undefined);
    }
    setActiveMapPin(undefined);
  }, [adapter]);
  const activeMapPinMarkerId = activeMapPin?.markerId;

  React.useEffect(() => {
    if (!playerMarker || didAutoCenterPlayerRef.current) return;
    didAutoCenterPlayerRef.current = true;
    const nextZoom = 2;
    setZoom(nextZoom);
    setPan(centeredPanForMapMarkerForTest(playerMarker, nextZoom));
  }, [playerMarker]);

  // BIOMES_UI_MAP_TAB_V141:
  // Mouse wheel zoom (Shift+wheel pans horizontally). Centered on the cursor
  // so the point under the pointer stays put — same behaviour every modern
  // map UI uses.
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      setPan((prev) => ({ x: prev.x - event.deltaY / 500, y: prev.y }));
      return;
    }
    setZoom((prev) => {
      const next = nextMapZoomForWheelForTest(prev, event.deltaY);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cursorX = (event.clientX - rect.left) / rect.width;
        const cursorY = (event.clientY - rect.top) / rect.height;
        setPan((p) => ({
          x: p.x + (cursorX - 0.5) * (1 / prev - 1 / next),
          y: p.y + (cursorY - 0.5) * (1 / prev - 1 / next),
        }));
      }
      return next;
    });
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button[data-marker]")) return;
    draggingRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = null;
    try { (event.target as HTMLElement).releasePointerCapture(event.pointerId); } catch {}
  };

  // BIOMES_UI_MAP_TAB_V141: keyboard pan (arrow keys when the canvas has focus).
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.08;
    if (event.key === "ArrowLeft") { setPan((p) => ({ ...p, x: p.x + step })); event.preventDefault(); }
    else if (event.key === "ArrowRight") { setPan((p) => ({ ...p, x: p.x - step })); event.preventDefault(); }
    else if (event.key === "ArrowUp") { setPan((p) => ({ ...p, y: p.y + step })); event.preventDefault(); }
    else if (event.key === "ArrowDown") { setPan((p) => ({ ...p, y: p.y - step })); event.preventDefault(); }
    else if (event.key === "+" || event.key === "=") { zoomIn(); event.preventDefault(); }
    else if (event.key === "-") { zoomOut(); event.preventDefault(); }
    else if (event.key.toLowerCase() === "c") { centerOnPlayer(); event.preventDefault(); }
    else if (event.key.toLowerCase() === "r") { resetView(); event.preventDefault(); }
  };

  return (
    <div
      className="biomes-map-tab-v141"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: 12,
        height: "clamp(440px, calc(100vh - 330px), 660px)",
        minHeight: 420,
        overflow: "hidden",
      }}
    >
      <div style={mapTopBarStyle}>
        <nav aria-label="Map sections" style={mapTabBarStyle}>
          {MAP_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...mapTabButtonStyle,
                ...(activeTab === tab.id ? activeMapTabButtonStyle : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <label style={filterLabelStyle}>
          <span style={filterLabelTextStyle}>
            Filter {activePanelLabel}
          </span>
          <input
            type="search"
            value={activeFilter}
            onChange={(event) => updateActiveFilter(event.currentTarget.value)}
            placeholder={`Filter ${activePanelFilterDescription}`}
            aria-label={`Filter ${activePanelLabel} list`}
            style={filterInputStyle}
          />
        </label>
      </div>
      <section
        aria-label="Live world map"
        className="biomes-map-canvas"
        ref={canvasRef}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          minHeight: 0,
          height: "100%",
          background:
            "radial-gradient(circle at 30% 40%, rgba(74,222,255,0.10), rgba(7,12,26,0.94))",
          border: "1px solid var(--biomes-edge-cyan-soft)",
          borderRadius: 4,
          overflow: "hidden",
          cursor: draggingRef.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <div style={mapToolbarStyle}>
          <button type="button" onClick={zoomOut} aria-label="Zoom map out">−</button>
          <span aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} aria-label="Zoom map in">+</button>
          <button type="button" onClick={resetView} title="Reset view (R)">Reset</button>
          <button type="button" onClick={centerOnPlayer} disabled={!playerMarker} title="Center on player (C)">
            Center Player
          </button>
        </div>

        {bounds ? (
          <div style={boundsStyle} aria-label="Current map bounds">
            X {Math.round(bounds.minX)}…{Math.round(bounds.maxX)} · Z {Math.round(bounds.minZ)}…{Math.round(bounds.maxZ)}
          </div>
        ) : null}

        {activeTab === "geography" && geographyTerrainFeatures.length > 0 ? (
          <div aria-hidden data-testid="biomes-map-geography-terrain-layer">
            {geographyTerrainFeatures.map((feature) => (
              <div
                key={feature.id}
                title={feature.label}
                style={terrainFeatureStyle(feature, zoom, pan)}
              />
            ))}
          </div>
        ) : null}

        {visibleMapMarkers.length === 0 ? (
          <div style={emptyMapStyle}>No live map markers are available for this player yet.</div>
        ) : (
          visibleMapMarkers.map((marker) => {
            const visual = mapMarkerVisualStateForTest(marker, activeMapPinMarkerId);
            return (
              <Highlightable key={marker.id} uniqueId={UI_IDS.MAP_MARKER(marker.id)} showCaption>
                <button
                  type="button"
                  data-marker={marker.id}
                  className="biomes-map-marker"
                  aria-label={`${marker.label} ${KIND_LABEL[marker.kind]} marker`}
                  tabIndex={0}
                  onClick={() => setFocusedMarkerId(marker.id)}
                  onFocus={() => setFocusedMarkerId(marker.id)}
                  onDoubleClick={() => centerOnMarker(marker)}
                  style={{
                    position: "absolute",
                    ...markerPosition(marker, zoom, pan),
                    transform: "translate(-50%, -50%)",
                    width: visual.size,
                    height: visual.size,
                    borderRadius: marker.kind === "store" || marker.kind === "business" || marker.kind === "bank" || marker.kind === "property" ? 3 : "50%",
                    background: KIND_COLOR[marker.kind],
                    border: visual.isPlayer ? "3px solid #111827" : "2px solid #fff",
                    boxShadow: visual.isPlayer
                      ? "0 0 14px rgba(255,255,255,0.7)"
                      : visual.isActive
                        ? "0 0 14px rgba(252,211,77,0.9)"
                        : "0 0 8px rgba(74,222,255,0.65)",
                    cursor: "pointer",
                    animation: visual.isPlayer
                      ? "biomesMapPlayerPulseV141 1.6s ease-in-out infinite"
                      : visual.isActive
                        ? "biomesMapActivePingV141 1.4s ease-in-out infinite"
                        : undefined,
                    zIndex: visual.zIndex,
                  }}
                >
                  <span className="sr-only">{marker.label}</span>
                  {shouldRenderMapMarkerLabelForTest(marker) && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: "115%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(7,12,26,0.85)",
                        border: "1px solid var(--biomes-edge-cyan-soft)",
                        borderRadius: 3,
                        padding: "1px 5px",
                        fontSize: 10,
                        color: "var(--biomes-fg)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      {marker.label}
                    </span>
                  )}
                </button>
              </Highlightable>
            );
          })
        )}

        <div style={legendStyle} aria-label="Map legend">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: kind === "store" || kind === "business" || kind === "bank" || kind === "property" ? 2 : "50%", background: KIND_COLOR[kind as MapMarkerKind], display: "inline-block" }} />
              {label}
            </span>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--biomes-fg-dim)" }}>
            wheel to zoom · drag to pan · C center · R reset
          </span>
        </div>

        {focusedMarker ? (
          <div style={markerCardStyle} aria-live="polite">
            <strong>{focusedMarker.label}</strong>
            <span>{KIND_LABEL[focusedMarker.kind]}</span>
            {focusedMarker.worldPosition ? (
              <small>
                World {focusedMarker.worldPosition.map((value) => Math.round(value)).join(", ")}
              </small>
            ) : null}
            {focusedMarker.description ? <p style={{ margin: 0 }}>{focusedMarker.description}</p> : null}
            <button
              type="button"
              onClick={() => centerOnMarker(focusedMarker)}
              style={{
                marginTop: 4,
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(74,222,255,0.18)",
                color: "var(--biomes-fg)",
                border: "1px solid var(--biomes-edge-cyan)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Center on marker
            </button>
            {focusedMarker.worldPosition ? (
              <button
                type="button"
                onClick={() =>
                  activeMapPinMarkerId === focusedMarker.id
                    ? clearActiveDestination()
                    : setActiveDestination(focusedMarker)
                }
                style={{
                  marginTop: 4,
                  padding: "5px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  background:
                    activeMapPinMarkerId === focusedMarker.id
                      ? "rgba(252,211,77,0.20)"
                      : "rgba(190,242,100,0.18)",
                  color: "var(--biomes-fg)",
                  border:
                    activeMapPinMarkerId === focusedMarker.id
                      ? "1px solid var(--biomes-warn-amber)"
                      : "1px solid #bef264",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {activeMapPinMarkerId === focusedMarker.id
                  ? "Clear active destination"
                  : "Set active destination"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
      <section aria-label={`${activeTab} map panel`} style={sidePanelStyle}>
        {activeTab === "quests" ? (
          <>
            <div>
              <h3 style={titleStyle}>{title}</h3>
              {steps.length === 0 ? (
                <p style={mutedTextStyle}>No active quest steps are available yet. Pick a quest below to track it.</p>
              ) : filteredSteps.length === 0 ? (
                <p style={mutedTextStyle}>No quest steps match this filter.</p>
              ) : (
                <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {filteredSteps.map((step) => (
                    <li
                      key={step.id}
                      tabIndex={0}
                      aria-label={`${step.title}, ${step.done ? "completed" : "in progress"}`}
                      style={{
                        padding: 8,
                        marginBottom: 4,
                        background: "var(--biomes-bg-glass)",
                        border: "1px solid var(--biomes-edge-cyan-soft)",
                        borderLeft: step.done ? "3px solid #78e68c" : "3px solid var(--biomes-warn-amber)",
                      }}
                    >
                      <strong style={{ fontSize: 12, textDecoration: step.done ? "line-through" : undefined, opacity: step.done ? 0.65 : 1 }}>
                        {step.title}
                      </strong>
                      <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{step.objective}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {trackableQuests.length > 0 && (
              <div data-testid="biomes-map-quest-list">
                <h3 style={titleStyle}>Quests</h3>
                {filteredTrackableQuests.length === 0 ? (
                  <p style={mutedTextStyle}>No quests match this filter.</p>
                ) : (
                  <ul style={listStyle}>
                    {filteredTrackableQuests.map((quest) => {
                      const isTracked = trackedQuestId === quest.questId || (trackedQuestId === null && quest.status === "active");
                      return (
                        <li key={quest.questId}>
                          <button
                            type="button"
                            data-testid={`biomes-map-quest-${quest.questId}`}
                            aria-pressed={isTracked}
                            onClick={() => trackQuest(quest)}
                            style={listButtonStyle(isTracked, quest.status === "active" ? "var(--biomes-warn-amber)" : quest.status === "completed" ? "#78e68c" : "var(--biomes-edge-cyan-soft)")}
                          >
                            <strong style={{ fontSize: 12 }}>{quest.title}</strong>
                            <div style={eyebrowStyle}>{quest.status} · {quest.area}</div>
                            {quest.reward ? <div style={mutedSmallStyle}>Reward: {quest.reward}</div> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : activeTab === "people" ? (
          <MarkerList
            title="People"
            empty={hasActiveFilter ? "No people match this filter." : "No known people are visible on this map yet."}
            markers={filteredPeopleMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
          />
        ) : activeTab === "buildings" ? (
          <MarkerList
            title="Buildings & Services"
            empty={hasActiveFilter ? "No buildings or services match this filter." : "No buildings or services are visible on this map yet."}
            markers={filteredBuildingMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
          />
        ) : activeTab === "properties" ? (
          <MarkerList
            title="My Properties"
            empty={hasActiveFilter ? "No properties match this filter." : "No purchased properties are visible on this map yet."}
            markers={filteredPropertyMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
          />
        ) : (
          <MarkerList
            title="Geography"
            empty={hasActiveFilter ? "No geography markers match this filter." : "No geography markers are visible on this map yet."}
            markers={filteredGeographyMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
          />
        )}
      </section>
    </div>
  );
};

function MarkerList({
  title,
  empty,
  markers,
  playerMarker,
  focusedMarkerId,
  onSelect,
  onPin,
  activePinMarkerId,
}: {
  title: string;
  empty: string;
  markers: MapMarker[];
  playerMarker?: MapMarker;
  focusedMarkerId: string | null;
  onSelect: (marker: MapMarker) => void;
  onPin: (marker: MapMarker) => void;
  activePinMarkerId?: string;
}) {
  const sorted = React.useMemo(() => {
    return markers
      .filter((marker) => marker.kind !== "player")
      .slice()
      .sort((a, b) => {
        const da = distanceFromPlayer(a, playerMarker) ?? Number.POSITIVE_INFINITY;
        const db = distanceFromPlayer(b, playerMarker) ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.label.localeCompare(b.label);
      });
  }, [markers, playerMarker]);

  return (
    <div data-testid={`biomes-map-${title.toLowerCase().replace(/[^a-z]+/g, "-")}-list`}>
      <h3 style={titleStyle}>{title}</h3>
      {sorted.length === 0 ? (
        <p style={mutedTextStyle}>{empty}</p>
      ) : (
        <ul style={listStyle}>
          {sorted.map((marker) => {
            const distance = distanceFromPlayer(marker, playerMarker);
            const selected = focusedMarkerId === marker.id;
            const activeDestination = activePinMarkerId === marker.id;
            return (
              <li key={marker.id}>
                <div style={listItemFrameStyle(selected, KIND_COLOR[marker.kind])}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(marker)}
                    style={listButtonBodyStyle}
                  >
                    <strong style={{ fontSize: 12 }}>{marker.label}</strong>
                    <div style={eyebrowStyle}>
                      {KIND_LABEL[marker.kind]}{distance !== undefined ? ` · ${distance}m from you` : ""}
                    </div>
                    {marker.description ? <div style={mutedSmallStyle}>{marker.description}</div> : null}
                  </button>
                  {marker.worldPosition ? (
                    <button
                      type="button"
                      aria-pressed={activeDestination}
                      onClick={() => onPin(marker)}
                      style={{
                        ...pinButtonStyle,
                        ...(activeDestination ? activePinButtonStyle : {}),
                      }}
                    >
                      {activeDestination ? "Active" : "Set Active"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)" };
const mutedSmallStyle: React.CSSProperties = { fontSize: 11, color: "var(--biomes-fg-muted)" };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, color: "var(--biomes-fg-muted)", letterSpacing: "0.04em", textTransform: "uppercase" };
const mapToolbarStyle: React.CSSProperties = { position: "absolute", zIndex: 5, top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: 6, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.86)", fontSize: 11 };
const boundsStyle: React.CSSProperties = { position: "absolute", zIndex: 5, top: 8, right: 8, padding: "4px 6px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.72)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const emptyMapStyle: React.CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20, color: "var(--biomes-fg-muted)", fontSize: 12, textAlign: "center" };
const legendStyle: React.CSSProperties = { position: "absolute", zIndex: 5, left: 8, right: 8, bottom: 8, display: "flex", flexWrap: "wrap", gap: "8px 10px", padding: 6, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.76)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const markerCardStyle: React.CSSProperties = { position: "absolute", zIndex: 6, right: 8, bottom: 54, width: 240, display: "grid", gap: 3, padding: 8, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.92)", color: "var(--biomes-fg)", fontSize: 11 };
const mapTopBarStyle: React.CSSProperties = { gridColumn: "1 / -1", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, minWidth: 0, flexWrap: "wrap" };
const mapTabBarStyle: React.CSSProperties = { display: "flex", gap: 6, minWidth: 0, overflowX: "auto", paddingBottom: 2 };
const mapTabButtonStyle: React.CSSProperties = { border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.68)", color: "var(--biomes-fg-muted)", padding: "7px 10px", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" };
const activeMapTabButtonStyle: React.CSSProperties = { borderColor: "var(--biomes-edge-cyan)", color: "var(--biomes-fg)", background: "rgba(74, 222, 255, 0.16)" };
const filterLabelStyle: React.CSSProperties = { display: "grid", gap: 3, width: 220, maxWidth: "100%" };
const filterLabelTextStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const filterInputStyle: React.CSSProperties = { width: "100%", height: 32, padding: "0 9px", border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.72)", color: "var(--biomes-fg)", fontSize: 12, outline: "none" };
const sidePanelStyle: React.CSSProperties = { minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start", gap: 12, paddingRight: 4 };
const listStyle: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 };
const listItemFrameStyle = (selected: boolean, accent: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "stretch",
  gap: 6,
  padding: 8,
  background: selected ? "rgba(74,222,255,0.18)" : "var(--biomes-bg-glass)",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderLeft: `3px solid ${accent}`,
});
const listButtonBodyStyle: React.CSSProperties = {
  display: "block",
  textAlign: "left",
  width: "100%",
  minWidth: 0,
  padding: 0,
  background: "transparent",
  color: "var(--biomes-fg)",
  border: 0,
  cursor: "pointer",
  font: "inherit",
};
const pinButtonStyle: React.CSSProperties = {
  alignSelf: "center",
  padding: "5px 7px",
  border: "1px solid rgba(190,242,100,0.55)",
  borderRadius: 3,
  background: "rgba(190,242,100,0.12)",
  color: "var(--biomes-fg)",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const activePinButtonStyle: React.CSSProperties = {
  borderColor: "var(--biomes-warn-amber)",
  background: "rgba(252,211,77,0.20)",
};
function listButtonStyle(selected: boolean, accent: string): React.CSSProperties {
  return {
    display: "block",
    textAlign: "left",
    width: "100%",
    padding: 8,
    background: selected ? "rgba(74,222,255,0.18)" : "var(--biomes-bg-glass)",
    color: "var(--biomes-fg)",
    border: "1px solid var(--biomes-edge-cyan-soft)",
    borderLeft: `3px solid ${accent}`,
    cursor: "pointer",
    font: "inherit",
  };
}
