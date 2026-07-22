// MapQuestsTab — production world map + mission journal.
//
// No placeholder markers live here. The tab renders only live adapter data:
// current player position, Grove landmarks, quest markers, service NPCs/stores,
// and mission objectives supplied by the Snapshot/Grove adapter.
//
// BIOMES_UI_MAP_TAB upgrade:
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
  questDetailItemSourceMarkerCandidates,
  questDetailToolShopMarkerCandidates,
} from "./questDetailToolSource";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  BIOMES_UI_LOCATE_ON_MAP_EVENT,
  BIOMES_UI_LOCATE_ON_MAP_RECENCY_MS,
  type BiomesUIActiveMapPin,
  readActiveBiomesUIMapPin,
  writeActiveBiomesUIMapPin,
} from "../adapters/mapPinnedDestination";
import {
  BIOMES_UI_MAIN_QUEST_EVENT,
  type BiomesUIMainQuestSelection,
  mainQuestFromTrackableQuestsForTest,
  readBiomesUIMainQuestSelection,
  setBiomesUIMainQuestFromTrackableQuest,
  writeBiomesUIMainQuestSelection,
} from "../adapters/mainQuestSelection";
import {
  harthmereMapElevationBandForHeight,
  type HarthmereMapTerrainKind,
  type MapTerrainRegion,
} from "../adapters/harthmereMapTerrainRegions";

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

type MapBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

type MapTerrainKind =
  | "water"
  | "muck"
  | "road"
  | "town"
  | "resource"
  | "safe_zone"
  | "highland";

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

interface MissionStep {
  id: string;
  title: string;
  objective: string;
  done: boolean;
}

// BIOMES_UI_MAP_TAB_QUESTS:
// Trackable-quest entries surface in the new clickable side list and let
// the player center the map on each quest's first marker without scrolling
// through the active mission timeline.
// HARTHMERE_QUEST_DETAIL: optional fields that let the quests panel show the
// FULL quest information when a player clicks a quest — the kind, the objective,
// a longer description, and (for tool-requiring jobs the player can't yet do)
// where to buy the required tool, with a marker the panel can locate on the map.
export interface MapTrackableQuestToolSource {
  action: string;
  toolName: string;
  vendorName: string;
  vendorMarkerId: string;
  hint: string;
}

export interface MapTrackableQuestItemSource {
  itemId: string;
  itemName: string;
  sourceName: string;
  markerId?: string;
  hint: string;
  missingCount: number;
}

export interface MapTrackableQuest {
  questId: string;
  title: string;
  area: string;
  status: "active" | "available" | "completed" | "failed";
  firstMarkerId?: string;
  reward?: string;
  // Countdown label for timed jobs (e.g. "3h 12m left" / "Expired"); empty for
  // untimed quests. Only jobs carry a timer for now.
  timeRemaining?: string;
  // Full-detail fields (shown when the quest is selected/expanded).
  kind?: string;
  kindLabel?: string;
  objective?: string;
  objectives?: string[];
  description?: string;
  toolSource?: MapTrackableQuestToolSource;
  itemSource?: MapTrackableQuestItemSource;
}

interface MapAdapter {
  getMarkers?: () => MapMarker[];
  getPlayerMarker?: () => MapMarker | undefined;
  getMissionTitle?: () => string;
  getMissionSteps?: () => MissionStep[];
  getMapBounds?: () => MapBounds | undefined;
  getTrackableQuests?: () => MapTrackableQuest[];
  getActiveMapPin?: () => BiomesUIActiveMapPin | undefined;
  setActiveMapPin?: (marker: MapMarker) => void;
  clearActiveMapPin?: () => void;
  getMainQuestSelection?: () => BiomesUIMainQuestSelection | undefined;
  setMainQuest?: (
    quest: MapTrackableQuest
  ) => BiomesUIMainQuestSelection | undefined;
  clearMainQuest?: () => void;
  // Authentic terrain regions (town, roads, river, muck, highland), already
  // projected to 0..100 map units against the same bounds as the markers.
  getTerrainRegions?: () => MapTerrainRegion[];
}

type MapPanelTab =
  | "quests"
  | "people"
  | "buildings"
  | "properties"
  | "geography";

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

const DEFAULT_HARTHMERE_MAP_BOUNDS: MapBounds = {
  minX: 360,
  maxX: 600,
  minZ: -270,
  maxZ: -100,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function markerPosition(
  marker: { x: number; y: number },
  zoom: number,
  pan: { x: number; y: number }
) {
  const x = ((clamp01(marker.x) - 0.5) * zoom + 0.5 + pan.x) * 100;
  const y = ((clamp01(marker.y) - 0.5) * zoom + 0.5 + pan.y) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

function normalizedWorldXZForMap(
  worldX: number,
  worldZ: number,
  bounds: MapBounds
) {
  return {
    x: clamp01((worldX - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)),
    y: clamp01((worldZ - bounds.minZ) / Math.max(1, bounds.maxZ - bounds.minZ)),
  };
}

function mapMarkerKindFromPinKind(kind: string): MapMarkerKind {
  const normalized = kind.trim().toLowerCase();
  if (
    normalized === "objective" ||
    normalized === "vendor" ||
    normalized === "store" ||
    normalized === "business" ||
    normalized === "bank" ||
    normalized === "quest" ||
    normalized === "rift" ||
    normalized === "resource" ||
    normalized === "property" ||
    normalized === "danger" ||
    normalized === "safe_zone" ||
    normalized === "route" ||
    normalized === "town" ||
    normalized === "player"
  ) {
    return normalized;
  }
  return "objective";
}

export function mapMarkerForActivePinForTest(
  pin: BiomesUIActiveMapPin | undefined,
  bounds: MapBounds | undefined = DEFAULT_HARTHMERE_MAP_BOUNDS
): MapMarker | undefined {
  if (!pin || !bounds) return undefined;
  const [worldX, worldY, worldZ] = pin.worldPosition ?? [];
  if (
    !Number.isFinite(worldX) ||
    !Number.isFinite(worldY) ||
    !Number.isFinite(worldZ)
  ) {
    return undefined;
  }
  const markerId = String(pin.markerId ?? "").trim();
  const label = String(pin.label ?? "").trim();
  if (!markerId || !label) return undefined;
  const projected = normalizedWorldXZForMap(worldX, worldZ, bounds);
  return {
    id: markerId,
    label,
    x: projected.x,
    y: projected.y,
    kind: mapMarkerKindFromPinKind(String(pin.kind ?? "objective")),
    active: true,
    description: pin.description,
    worldPosition: [worldX, worldY, worldZ],
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

export function mapPanelTabForMarkerForTest(
  marker: Pick<MapMarker, "kind" | "active">
): MapPanelTab[] {
  if (marker.kind === "player") return MAP_PANEL_TABS.map((entry) => entry.id);
  const tabs: MapPanelTab[] = [];
  if (marker.kind === "objective" || marker.kind === "quest" || marker.active)
    tabs.push("quests");
  if (marker.kind === "vendor") tabs.push("people");
  if (
    marker.kind === "store" ||
    marker.kind === "business" ||
    marker.kind === "bank" ||
    marker.kind === "quest"
  )
    tabs.push("buildings");
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

export function shouldRenderMapMarkerLabelForTest(
  marker: Pick<MapMarker, "label">
): boolean {
  return marker.label.trim().length > 0;
}

export function shouldRenderMapMarkerLabelAtZoomForTest(
  marker: Pick<MapMarker, "label" | "kind" | "active">,
  zoom: number,
  focused = false
): boolean {
  if (!shouldRenderMapMarkerLabelForTest(marker)) return false;
  // MAP_LABEL_DECLUTTER:
  // The complete Harthmere bible adds dozens of nearby building pins. Showing
  // every label at overview zoom made distinct coordinates look like one pile.
  // Keep route/town context visible, always identify focused/active pins, and
  // reveal every building label once the player zooms into the town.
  return (
    focused ||
    marker.active === true ||
    marker.kind === "player" ||
    marker.kind === "route" ||
    marker.kind === "town" ||
    zoom >= 4
  );
}

export function mapMarkerVisualStateForTest(
  marker: Pick<MapMarker, "id" | "kind" | "active">,
  activeMapPinMarkerId?: string
) {
  const isPlayer = marker.kind === "player";
  const isPinnedDestination =
    !isPlayer &&
    Boolean(activeMapPinMarkerId) &&
    activeMapPinMarkerId === marker.id;
  const isActive = Boolean(marker.active) || isPinnedDestination;
  return {
    isPlayer,
    isActive,
    isPinnedDestination,
    size: isPlayer ? 20 : isActive ? 18 : 12,
    zIndex: isPinnedDestination ? 5 : isPlayer ? 4 : isActive ? 3 : 2,
  };
}

export function nextMapZoomForWheelForTest(
  currentZoom: number,
  deltaY: number
) {
  // Finer, exponential steps for smoother zoom, over a wider range.
  const delta = deltaY < 0 ? 0.12 : -0.12;
  return Math.max(0.4, Math.min(16, currentZoom * (1 + delta)));
}

export function preventCancelableMapWheelDefaultForTest(
  event: Pick<React.WheelEvent<HTMLDivElement>, "cancelable" | "preventDefault">
) {
  if (!event.cancelable) {
    return false;
  }
  event.preventDefault();
  return true;
}

export { activeBiomesUIMapPinFromMarkerForTest };

const TERRAIN_FILL: Record<MapTerrainKind, string> = {
  water:
    "linear-gradient(135deg, rgba(37, 99, 235, 0.32), rgba(14, 165, 233, 0.20))",
  muck: "linear-gradient(135deg, rgba(91, 33, 182, 0.38), rgba(76, 29, 149, 0.18))",
  road: "linear-gradient(90deg, rgba(180, 83, 9, 0.30), rgba(234, 179, 8, 0.22))",
  town: "linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(34, 197, 94, 0.16))",
  resource:
    "linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(132, 204, 22, 0.16))",
  safe_zone:
    "linear-gradient(135deg, rgba(16, 185, 129, 0.30), rgba(125, 211, 252, 0.14))",
  highland:
    "linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(100, 116, 139, 0.12))",
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

export function geographyTerrainFeaturesForMapMarkersForTest(
  markers: MapMarker[]
): MapTerrainFeature[] {
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
      if (
        marker.kind === "route" ||
        text.includes("road") ||
        text.includes("bridge")
      ) {
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
          kind:
            text.includes("stone") || text.includes("mountain")
              ? "highland"
              : "resource",
          round: true,
        };
      }
      return undefined;
    })
    .filter((feature): feature is MapTerrainFeature => Boolean(feature));
}

function markersForPanelTab(
  markers: MapMarker[],
  tab: MapPanelTab
): MapMarker[] {
  return markers.filter((marker) =>
    mapPanelTabForMarkerForTest(marker).includes(tab)
  );
}

// Authentic terrain layer styling (water / muck / town / road / highland / land).
const TERRAIN_REGION_STYLE: Record<
  HarthmereMapTerrainKind,
  { fill: string; stroke: string; strokeWidth: number }
> = {
  land: {
    fill: "rgba(36, 54, 40, 0.34)",
    stroke: "transparent",
    strokeWidth: 0,
  },
  town: {
    fill: "rgba(190, 145, 72, 0.20)",
    stroke: "rgba(234, 200, 130, 0.5)",
    strokeWidth: 0.4,
  },
  road: { fill: "none", stroke: "rgba(226, 184, 96, 0.8)", strokeWidth: 0.6 },
  water: {
    fill: "rgba(40, 120, 210, 0.36)",
    stroke: "rgba(125, 211, 252, 0.7)",
    strokeWidth: 0.5,
  },
  muck: {
    fill: "rgba(108, 47, 162, 0.38)",
    stroke: "rgba(196, 150, 255, 0.6)",
    strokeWidth: 0.5,
  },
  highland: {
    fill: "rgba(150, 162, 172, 0.26)",
    stroke: "rgba(222, 232, 242, 0.5)",
    strokeWidth: 0.4,
  },
  safe_zone: {
    fill: "rgba(34, 197, 120, 0.10)",
    stroke: "rgba(120, 230, 170, 0.42)",
    strokeWidth: 0.4,
  },
};

export const TERRAIN_LEGEND: Array<{
  kind: HarthmereMapTerrainKind;
  label: string;
}> = [
  { kind: "land", label: "Land" },
  { kind: "water", label: "Water" },
  { kind: "muck", label: "Muck" },
  { kind: "town", label: "Town" },
  { kind: "road", label: "Road" },
  { kind: "highland", label: "Highland" },
];

// Terrain rendered as an SVG overlay that shares the marker zoom/pan transform so
// it stays aligned with the markers drawn on top. The land base is drawn outside
// the transform so it always fills the canvas; everything else pans/zooms.
function MapTerrainLayer({
  regions,
  zoom,
  pan,
}: {
  regions: MapTerrainRegion[];
  zoom: number;
  pan: { x: number; y: number };
}) {
  if (regions.length === 0) return null;
  const tx = 50 + pan.x * 100;
  const ty = 50 + pan.y * 100;
  const landBase = regions.find((region) => region.kind === "land");
  const features = regions.filter((region) => region.kind !== "land");
  return (
    <svg
      aria-hidden
      data-testid="biomes-map-terrain-layer"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {landBase ? (
        <rect
          x={-10}
          y={-10}
          width={120}
          height={120}
          fill={TERRAIN_REGION_STYLE.land.fill}
        />
      ) : null}
      <g transform={`translate(${tx} ${ty}) scale(${zoom}) translate(-50 -50)`}>
        {features.map((region) => {
          const style = TERRAIN_REGION_STYLE[region.kind];
          if (region.shape.type === "ellipse") {
            return (
              <ellipse
                key={region.id}
                cx={region.shape.cx}
                cy={region.shape.cy}
                rx={region.shape.rx}
                ry={region.shape.ry}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
              />
            );
          }
          if (region.shape.type === "rect") {
            return (
              <rect
                key={region.id}
                x={region.shape.x}
                y={region.shape.y}
                width={region.shape.w}
                height={region.shape.h}
                rx={1.5}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
              />
            );
          }
          return (
            <polyline
              key={region.id}
              points={region.shape.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={style.stroke}
              strokeWidth={region.shape.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

function filterTokens(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
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

export function filterMapMissionStepsForTest(
  steps: MissionStep[],
  filter: string
): MissionStep[] {
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
      quest.kind,
      quest.kindLabel,
      quest.objective,
      quest.objectives?.join(" "),
      quest.description,
      quest.timeRemaining,
    ])
  );
}

export function filterMapMarkersForTest(
  markers: MapMarker[],
  filter: string
): MapMarker[] {
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

export function questMapMarkerCandidatesForTest(
  quest: MapTrackableQuest
): string[] {
  const seen = new Set<string>();
  return [
    quest.firstMarkerId,
    ...questDetailItemSourceMarkerCandidates(quest),
    ...questDetailToolShopMarkerCandidates(quest),
  ].filter((markerId): markerId is string => {
    const id = markerId?.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function distanceFromPlayer(
  marker: MapMarker,
  player?: MapMarker
): number | undefined {
  if (!marker.worldPosition || !player?.worldPosition) return undefined;
  const dx = marker.worldPosition[0] - player.worldPosition[0];
  const dz = marker.worldPosition[2] - player.worldPosition[2];
  return Math.round(Math.sqrt(dx * dx + dz * dz));
}

// BIOMES_UI_MAP_TAB:
// Inject the keyframes for the player pulse + active-marker ping. Idempotent —
// guarded by the style tag id so multiple mounts don't duplicate.
function ensureMapTabStyles() {
  if (typeof document === "undefined") return;
  const id = "biomes-ui-map-tab-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes biomesMapPlayerPulse {
  0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.85), 0 0 14px rgba(255,255,255,0.6); }
  70%  { box-shadow: 0 0 0 12px rgba(255,255,255,0), 0 0 22px rgba(255,255,255,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 0 14px rgba(255,255,255,0.6); }
}
@keyframes biomesMapActivePing {
  0%   { box-shadow: 0 0 0 0 rgba(252,211,77,0.85), 0 0 14px rgba(252,211,77,0.6); }
  70%  { box-shadow: 0 0 0 14px rgba(252,211,77,0),    0 0 22px rgba(252,211,77,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(252,211,77,0),       0 0 14px rgba(252,211,77,0.6); }
}
.biomes-map-tab .biomes-map-marker:focus-visible {
  outline: 2px solid var(--biomes-edge-cyan);
  outline-offset: 2px;
}
@media (max-width: 720px) {
  .biomes-map-tab {
    grid-template-columns: 1fr !important;
  }
  .biomes-map-tab .biomes-map-canvas {
    min-height: 320px;
    aspect-ratio: 4 / 3;
  }
}
`;
  document.head.appendChild(style);
}

export const MapQuestsTab: React.FunctionComponent<{
  adapter?: MapAdapter;
}> = ({ adapter }) => {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [focusedMarkerId, setFocusedMarkerId] = React.useState<string | null>(
    null
  );
  const [trackedQuestId, setTrackedQuestId] = React.useState<string | null>(
    null
  );
  // The quest whose full details are open for review (click a quest to expand).
  const [selectedQuestId, setSelectedQuestId] = React.useState<string | null>(
    null
  );
  // Multi-layer model: any combination of category layers can be on at once, so
  // the map shows their union instead of one-at-a-time. Default: quests only.
  const [enabledLayers, setEnabledLayers] = React.useState<Set<MapPanelTab>>(
    () => new Set<MapPanelTab>(["quests"])
  );
  // The town extension must be visible as land/roads on first open. Players can
  // still hide terrain, but a marker-only dark field made the seeded town look
  // nonexistent even when every building pin had the right world coordinate.
  const [showTerrain, setShowTerrain] = React.useState(true);
  const [panelFilters, setPanelFilters] = React.useState<
    Record<MapPanelTab, string>
  >({
    quests: "",
    people: "",
    buildings: "",
    properties: "",
    geography: "",
  });
  const [activeMapPin, setActiveMapPin] = React.useState<
    BiomesUIActiveMapPin | undefined
  >(() => adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPin());
  const [mainQuestSelection, setMainQuestSelection] = React.useState<
    BiomesUIMainQuestSelection | undefined
  >(
    () => adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
  );
  // "Locate on map" target we still need to pan/zoom to. Seeded from a recent
  // active pin on mount because the locate event fires during the tab switch,
  // before this tab is listening. Centering happens once the marker exists.
  const [pendingLocateMarkerId, setPendingLocateMarkerId] = React.useState<
    string | undefined
  >(() => {
    const pin = readActiveBiomesUIMapPin();
    return pin && Date.now() - pin.setAtMs <= BIOMES_UI_LOCATE_ON_MAP_RECENCY_MS
      ? pin.markerId
      : undefined;
  });
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const didAutoCenterPlayerRef = React.useRef(false);

  React.useEffect(() => ensureMapTabStyles(), []);

  const bounds = adapter?.getMapBounds?.();
  const markers = React.useMemo(() => adapter?.getMarkers?.() ?? [], [adapter]);
  const playerMarker = adapter?.getPlayerMarker?.();
  const activeMapPinMarker = React.useMemo(
    () => mapMarkerForActivePinForTest(activeMapPin, bounds),
    [
      activeMapPin?.markerId,
      activeMapPin?.label,
      activeMapPin?.kind,
      activeMapPin?.description,
      activeMapPin?.worldPosition?.join(","),
      bounds?.minX,
      bounds?.maxX,
      bounds?.minZ,
      bounds?.maxZ,
    ]
  );
  const allMarkers = React.useMemo(() => {
    const byId = new Map<string, MapMarker>();
    for (const marker of markers) byId.set(marker.id, marker);
    if (activeMapPinMarker && !byId.has(activeMapPinMarker.id)) {
      byId.set(activeMapPinMarker.id, activeMapPinMarker);
    }
    if (playerMarker) byId.set(playerMarker.id, playerMarker);
    return Array.from(byId.values());
  }, [markers, activeMapPinMarker, playerMarker]);
  const title = adapter?.getMissionTitle?.() ?? "No active mission";
  const steps = adapter?.getMissionSteps?.() ?? [];
  const trackableQuests = adapter?.getTrackableQuests?.() ?? [];
  const mainQuest = React.useMemo(
    () =>
      mainQuestFromTrackableQuestsForTest(trackableQuests, mainQuestSelection),
    [trackableQuests, mainQuestSelection]
  );
  const mainQuestId = mainQuest?.questId ?? mainQuestSelection?.questId;
  const layerEnabled = React.useCallback(
    (tab: MapPanelTab) => enabledLayers.has(tab),
    [enabledLayers]
  );
  const filteredSteps = React.useMemo(
    () => filterMapMissionStepsForTest(steps, panelFilters.quests),
    [panelFilters.quests, steps]
  );
  const filteredTrackableQuests = React.useMemo(
    () => filterMapTrackableQuestsForTest(trackableQuests, panelFilters.quests),
    [panelFilters.quests, trackableQuests]
  );
  const focusedMarker = focusedMarkerId
    ? allMarkers.find((marker) => marker.id === focusedMarkerId)
    : undefined;
  // Map markers = union of every enabled category layer (multi-select).
  const visibleMarkers = React.useMemo(
    () =>
      allMarkers.filter((marker) =>
        mapPanelTabForMarkerForTest(marker).some((tab) =>
          enabledLayers.has(tab)
        )
      ),
    [allMarkers, enabledLayers]
  );
  React.useEffect(() => {
    setActiveMapPin(adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPin());
  }, [
    adapter,
    markers.length,
    playerMarker?.worldPosition?.join(","),
    visibleMarkers.length,
  ]);
  React.useEffect(() => {
    setMainQuestSelection(
      adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
    );
  }, [adapter]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onMainQuestChanged = (event: Event) => {
      const next =
        (event as CustomEvent<BiomesUIMainQuestSelection | undefined>).detail ??
        adapter?.getMainQuestSelection?.() ??
        readBiomesUIMainQuestSelection();
      setMainQuestSelection(next);
    };
    window.addEventListener(BIOMES_UI_MAIN_QUEST_EVENT, onMainQuestChanged);
    window.addEventListener("storage", onMainQuestChanged);
    return () => {
      window.removeEventListener(
        BIOMES_UI_MAIN_QUEST_EVENT,
        onMainQuestChanged
      );
      window.removeEventListener("storage", onMainQuestChanged);
    };
  }, [adapter]);
  React.useEffect(() => {
    if (!mainQuestSelection || trackableQuests.length === 0) return;
    if (mainQuest) return;
    if (adapter?.clearMainQuest) {
      adapter.clearMainQuest();
    } else {
      writeBiomesUIMainQuestSelection(undefined);
    }
    setMainQuestSelection(undefined);
  }, [adapter, mainQuest, mainQuestSelection, trackableQuests]);
  const visibleMapMarkers = React.useMemo(() => {
    if (!playerMarker) return visibleMarkers;
    return visibleMarkers.some((marker) => marker.id === playerMarker.id)
      ? visibleMarkers
      : [...visibleMarkers, playerMarker];
  }, [playerMarker, visibleMarkers]);
  const peopleMarkers = React.useMemo(
    () => markersForPanelTab(allMarkers, "people"),
    [allMarkers]
  );
  const buildingMarkers = React.useMemo(
    () => markersForPanelTab(allMarkers, "buildings"),
    [allMarkers]
  );
  const propertyMarkers = React.useMemo(
    () => markersForPanelTab(allMarkers, "properties"),
    [allMarkers]
  );
  const geographyMarkers = React.useMemo(
    () => markersForPanelTab(allMarkers, "geography"),
    [allMarkers]
  );
  const filteredPeopleMarkers = React.useMemo(
    () => filterMapMarkersForTest(peopleMarkers, panelFilters.people),
    [panelFilters.people, peopleMarkers]
  );
  const filteredBuildingMarkers = React.useMemo(
    () => filterMapMarkersForTest(buildingMarkers, panelFilters.buildings),
    [panelFilters.buildings, buildingMarkers]
  );
  const filteredPropertyMarkers = React.useMemo(
    () => filterMapMarkersForTest(propertyMarkers, panelFilters.properties),
    [panelFilters.properties, propertyMarkers]
  );
  const filteredGeographyMarkers = React.useMemo(
    () => filterMapMarkersForTest(geographyMarkers, panelFilters.geography),
    [panelFilters.geography, geographyMarkers]
  );
  // Authentic terrain regions (town/roads/river/muck/highland), projected to
  // 0..100 map units against the same bounds the markers use.
  const terrainRegions = React.useMemo(
    () => adapter?.getTerrainRegions?.() ?? [],
    [adapter]
  );
  // Elevation summary from real marker heights (worldPosition Y).
  const elevationBands = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const marker of allMarkers) {
      const band = harthmereMapElevationBandForHeight(
        marker.worldPosition?.[1]
      );
      counts[band] = (counts[band] ?? 0) + 1;
    }
    return counts;
  }, [allMarkers]);

  // Wider zoom range + clamped pan so the map can be inspected closely without
  // ever being dragged fully off-screen.
  const clampZoom = React.useCallback(
    (value: number) => Math.max(0.4, Math.min(16, value)),
    []
  );
  const clampPan = React.useCallback(
    (next: { x: number; y: number }, atZoom: number) => {
      // Keep the map center within the viewport: allow panning out to the edge of
      // the zoomed content plus a small margin.
      const limit = Math.max(0.25, (atZoom - 1) / 2 + 0.25);
      return {
        x: Math.max(-limit, Math.min(limit, next.x)),
        y: Math.max(-limit, Math.min(limit, next.y)),
      };
    },
    []
  );
  const setZoomTo = React.useCallback(
    (value: number) => setZoom(() => clampZoom(Number(value.toFixed(3)))),
    [clampZoom]
  );
  const zoomIn = () =>
    setZoom((value) => clampZoom(Number((value * 1.25).toFixed(3))));
  const zoomOut = () =>
    setZoom((value) => clampZoom(Number((value / 1.25).toFixed(3))));
  const resetView = () => {
    const nextZoom = playerMarker ? 2 : 1;
    setZoom(nextZoom);
    setPan(
      playerMarker
        ? centeredPanForMapMarkerForTest(playerMarker, nextZoom)
        : { x: 0, y: 0 }
    );
    setFocusedMarkerId(null);
    setTrackedQuestId(null);
  };
  const centerOnMarker = React.useCallback(
    (marker: { x: number; y: number; id: string }) => {
      const nextZoom = Math.max(zoom, 2);
      setZoom(nextZoom);
      setPan(
        clampPan(centeredPanForMapMarkerForTest(marker, nextZoom), nextZoom)
      );
      setFocusedMarkerId(marker.id);
    },
    [zoom, clampPan]
  );
  const centerOnPlayer = () => {
    if (!playerMarker) return;
    centerOnMarker(playerMarker);
  };
  // Fit-to-content: frame all currently-visible markers (zoom + center).
  const fitToVisible = React.useCallback(() => {
    const pts = visibleMapMarkers.map((marker) => ({
      x: clamp01(marker.x),
      y: clamp01(marker.y),
    }));
    if (pts.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    let minX = 1,
      maxX = 0,
      minY = 1,
      maxY = 0;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const spanX = Math.max(0.06, maxX - minX);
    const spanY = Math.max(0.06, maxY - minY);
    // 0.82 leaves a comfortable margin around the framed content.
    const nextZoom = clampZoom(Math.min(0.82 / spanX, 0.82 / spanY));
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    setZoom(nextZoom);
    setPan(
      clampPan(centeredPanForMapMarkerForTest(center, nextZoom), nextZoom)
    );
  }, [visibleMapMarkers, clampZoom, clampPan]);
  const setPanelFilter = (tab: MapPanelTab, value: string) => {
    setPanelFilters((filters) => ({ ...filters, [tab]: value }));
  };
  const toggleLayer = (tab: MapPanelTab) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(tab)) {
        next.delete(tab);
      } else {
        next.add(tab);
      }
      return next;
    });
  };
  const setAllLayers = (on: boolean) => {
    setEnabledLayers(
      on ? new Set(MAP_PANEL_TABS.map((tab) => tab.id)) : new Set()
    );
  };
  const setActiveDestination = React.useCallback(
    (marker: MapMarker) => {
      const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
      if (!pin) return;
      if (adapter?.setActiveMapPin) {
        adapter.setActiveMapPin(marker);
      } else {
        writeActiveBiomesUIMapPin(pin);
      }
      setActiveMapPin(pin);
    },
    [adapter]
  );
  const clearActiveDestination = React.useCallback(() => {
    if (adapter?.clearActiveMapPin) {
      adapter.clearActiveMapPin();
    } else {
      writeActiveBiomesUIMapPin(undefined);
    }
    setActiveMapPin(undefined);
  }, [adapter]);
  const questMarkerForMap = React.useCallback(
    (quest: MapTrackableQuest) => {
      for (const markerId of questMapMarkerCandidatesForTest(quest)) {
        const marker = allMarkers.find((entry) => entry.id === markerId);
        if (marker) return marker;
      }
      return undefined;
    },
    [allMarkers]
  );
  const centerQuestOnMap = React.useCallback(
    (quest: MapTrackableQuest, options: { pin?: boolean } = {}) => {
      setEnabledLayers((prev) => new Set(prev).add("quests"));
      const marker = questMarkerForMap(quest);
      if (!marker) return false;
      centerOnMarker(marker);
      setFocusedMarkerId(marker.id);
      if (options.pin) {
        setActiveDestination(marker);
      }
      return true;
    },
    [centerOnMarker, questMarkerForMap, setActiveDestination]
  );
  const trackQuest = (quest: MapTrackableQuest) => {
    setTrackedQuestId(quest.questId);
    // Clicking a quest also opens its full details for review (toggle off if it
    // was already the open one).
    setSelectedQuestId((current) =>
      current === quest.questId ? null : quest.questId
    );
    centerQuestOnMap(quest);
  };
  const setMainQuest = React.useCallback(
    (quest: MapTrackableQuest) => {
      const selection =
        adapter?.setMainQuest?.(quest) ??
        setBiomesUIMainQuestFromTrackableQuest(quest);
      setMainQuestSelection(selection);
      setTrackedQuestId(quest.questId);
      setSelectedQuestId(quest.questId);
      centerQuestOnMap(quest, { pin: true });
    },
    [adapter, centerQuestOnMap]
  );
  const activeMapPinMarkerId = activeMapPin?.markerId;
  // Center on (and set the active destination to) a marker resolved by id — used
  // by the quest detail's "Locate tool shop on map" button.
  const locateMarkerById = React.useCallback(
    (markerId: string | undefined) => {
      if (!markerId) return;
      const marker = allMarkers.find((entry) => entry.id === markerId);
      if (!marker) return;
      setEnabledLayers((prev) => new Set(prev).add("quests"));
      centerOnMarker(marker);
      setActiveDestination(marker);
    },
    [allMarkers, centerOnMarker, setActiveDestination]
  );

  React.useEffect(() => {
    if (!playerMarker || didAutoCenterPlayerRef.current) return;
    // A pending "locate on map" wins over the initial player auto-center, so we
    // don't pan to the player and then immediately jump to the located target.
    if (pendingLocateMarkerId) {
      didAutoCenterPlayerRef.current = true;
      return;
    }
    didAutoCenterPlayerRef.current = true;
    const nextZoom = 2;
    setZoom(nextZoom);
    setPan(
      clampPan(centeredPanForMapMarkerForTest(playerMarker, nextZoom), nextZoom)
    );
  }, [playerMarker, pendingLocateMarkerId, clampPan]);

  // Live "locate on map" requests while this tab is already open.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const pin = (event as CustomEvent).detail as
        | BiomesUIActiveMapPin
        | undefined;
      if (pin?.markerId) {
        setActiveMapPin(pin);
        setPendingLocateMarkerId(pin.markerId);
      }
    };
    window.addEventListener(BIOMES_UI_LOCATE_ON_MAP_EVENT, handler);
    return () =>
      window.removeEventListener(BIOMES_UI_LOCATE_ON_MAP_EVENT, handler);
  }, []);

  // Center on the located target once its marker is available. Markers hydrate
  // asynchronously, so this retries (via allMarkers deps) until the marker
  // exists, then consumes the request.
  React.useEffect(() => {
    if (!pendingLocateMarkerId) return;
    const marker = allMarkers.find(
      (entry) => entry.id === pendingLocateMarkerId
    );
    if (!marker) return;
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      for (const tab of mapPanelTabForMarkerForTest(marker)) {
        next.add(tab);
      }
      return next;
    });
    centerOnMarker(marker);
    setFocusedMarkerId(marker.id);
    setPendingLocateMarkerId(undefined);
  }, [pendingLocateMarkerId, allMarkers, centerOnMarker]);

  // BIOMES_UI_MAP_TAB:
  // Mouse wheel zoom (Shift+wheel pans horizontally). Centered on the cursor
  // so the point under the pointer stays put — same behaviour every modern
  // map UI uses.
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    preventCancelableMapWheelDefaultForTest(event);
    if (event.shiftKey) {
      setPan((prev) =>
        clampPan({ x: prev.x - event.deltaY / 500, y: prev.y }, zoom)
      );
      return;
    }
    setZoom((prev) => {
      const next = nextMapZoomForWheelForTest(prev, event.deltaY);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cursorX = (event.clientX - rect.left) / rect.width;
        const cursorY = (event.clientY - rect.top) / rect.height;
        setPan((p) =>
          clampPan(
            {
              x: p.x + (cursorX - 0.5) * (1 / prev - 1 / next),
              y: p.y + (cursorY - 0.5) * (1 / prev - 1 / next),
            },
            next
          )
        );
      }
      return next;
    });
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button[data-marker]")) return;
    draggingRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    setPan(clampPan({ x: drag.panX + dx, y: drag.panY + dy }, zoom));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = null;
    try {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {}
  };

  // BIOMES_UI_MAP_TAB: keyboard pan (arrow keys when the canvas has focus).
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.08;
    if (event.key === "ArrowLeft") {
      setPan((p) => clampPan({ ...p, x: p.x + step }, zoom));
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      setPan((p) => clampPan({ ...p, x: p.x - step }, zoom));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setPan((p) => clampPan({ ...p, y: p.y + step }, zoom));
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      setPan((p) => clampPan({ ...p, y: p.y - step }, zoom));
      event.preventDefault();
    } else if (event.key === "+" || event.key === "=") {
      zoomIn();
      event.preventDefault();
    } else if (event.key === "-") {
      zoomOut();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "c") {
      centerOnPlayer();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "r") {
      resetView();
      event.preventDefault();
    }
  };

  return (
    <div
      className="biomes-map-tab"
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
              role="switch"
              aria-checked={layerEnabled(tab.id)}
              aria-label={`Toggle ${tab.label} layer`}
              onClick={() => toggleLayer(tab.id)}
              style={{
                ...mapTabButtonStyle,
                ...(layerEnabled(tab.id) ? activeMapTabButtonStyle : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
          <span style={layerToggleDividerStyle} aria-hidden />
          <button
            type="button"
            role="switch"
            aria-checked={showTerrain}
            aria-label="Toggle terrain layer"
            onClick={() => setShowTerrain((value) => !value)}
            style={{
              ...mapTabButtonStyle,
              ...(showTerrain ? activeMapTabButtonStyle : {}),
            }}
          >
            Terrain
          </button>
        </nav>
        <div style={layerQuickActionsStyle}>
          <button
            type="button"
            onClick={() => setAllLayers(true)}
            style={layerQuickButtonStyle}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setAllLayers(false)}
            style={layerQuickButtonStyle}
          >
            None
          </button>
        </div>
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
        {/* Terrain is the first child so it paints behind the toolbar/bounds
            chrome; markers (explicit zIndex) still render on top of it. */}
        {showTerrain ? (
          <MapTerrainLayer regions={terrainRegions} zoom={zoom} pan={pan} />
        ) : null}
        <div style={mapToolbarStyle}>
          <button type="button" onClick={zoomOut} aria-label="Zoom map out">
            −
          </button>
          <input
            type="range"
            min={0.4}
            max={16}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoomTo(Number(event.currentTarget.value))}
            aria-label="Map zoom level"
            title="Zoom"
            style={{ width: 84, accentColor: "var(--biomes-edge-cyan)" }}
          />
          <button type="button" onClick={zoomIn} aria-label="Zoom map in">
            +
          </button>
          <span aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={fitToVisible}
            title="Fit all markers in view"
          >
            Fit
          </button>
          <button type="button" onClick={resetView} title="Reset view (R)">
            Reset
          </button>
          <button
            type="button"
            onClick={centerOnPlayer}
            disabled={!playerMarker}
            title="Center on player (C)"
          >
            Center Player
          </button>
        </div>

        {bounds ? (
          <div style={boundsStyle} aria-label="Current map bounds">
            X {Math.round(bounds.minX)}…{Math.round(bounds.maxX)} · Z{" "}
            {Math.round(bounds.minZ)}…{Math.round(bounds.maxZ)}
            {showTerrain
              ? ` · Elevation ${
                  Object.entries(elevationBands)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([band]) => band)
                    .join("/") || "low"
                }`
              : ""}
          </div>
        ) : null}

        {visibleMapMarkers.length === 0 ? (
          <div style={emptyMapStyle}>
            No live map markers are available for this player yet.
          </div>
        ) : (
          visibleMapMarkers.map((marker) => {
            const visual = mapMarkerVisualStateForTest(
              marker,
              activeMapPinMarkerId
            );
            return (
              <Highlightable
                key={marker.id}
                uniqueId={UI_IDS.MAP_MARKER(marker.id)}
                showCaption
              >
                <button
                  type="button"
                  data-marker={marker.id}
                  className="biomes-map-marker"
                  aria-label={`${marker.label} ${
                    KIND_LABEL[marker.kind]
                  } marker`}
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
                    borderRadius:
                      marker.kind === "store" ||
                      marker.kind === "business" ||
                      marker.kind === "bank" ||
                      marker.kind === "property"
                        ? 3
                        : "50%",
                    background: KIND_COLOR[marker.kind],
                    border: visual.isPlayer
                      ? "3px solid #111827"
                      : "2px solid #fff",
                    boxShadow: visual.isPlayer
                      ? "0 0 14px rgba(255,255,255,0.7)"
                      : visual.isActive
                      ? "0 0 14px rgba(252,211,77,0.9)"
                      : "0 0 8px rgba(74,222,255,0.65)",
                    cursor: "pointer",
                    animation: visual.isPlayer
                      ? "biomesMapPlayerPulse 1.6s ease-in-out infinite"
                      : visual.isActive
                      ? "biomesMapActivePing 1.4s ease-in-out infinite"
                      : undefined,
                    zIndex: visual.zIndex,
                  }}
                >
                  <span className="sr-only">{marker.label}</span>
                  {shouldRenderMapMarkerLabelAtZoomForTest(
                    marker,
                    zoom,
                    focusedMarkerId === marker.id
                  ) && (
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
            <span
              key={kind}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius:
                    kind === "store" ||
                    kind === "business" ||
                    kind === "bank" ||
                    kind === "property"
                      ? 2
                      : "50%",
                  background: KIND_COLOR[kind as MapMarkerKind],
                  display: "inline-block",
                }}
              />
              {label}
            </span>
          ))}
          {showTerrain
            ? TERRAIN_LEGEND.map((entry) => (
                <span
                  key={`terrain-${entry.kind}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background: TERRAIN_REGION_STYLE[entry.kind].fill,
                      border: `1px solid ${
                        TERRAIN_REGION_STYLE[entry.kind].stroke
                      }`,
                      display: "inline-block",
                    }}
                  />
                  {entry.label}
                </span>
              ))
            : null}
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
                World{" "}
                {focusedMarker.worldPosition
                  .map((value) => Math.round(value))
                  .join(", ")}
                {" · "}
                Elevation:{" "}
                {harthmereMapElevationBandForHeight(
                  focusedMarker.worldPosition[1]
                )}
              </small>
            ) : null}
            {focusedMarker.description ? (
              <p style={{ margin: 0 }}>{focusedMarker.description}</p>
            ) : null}
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
      <section aria-label="Map panels" style={sidePanelStyle}>
        {enabledLayers.size === 0 ? (
          <p style={mutedTextStyle}>
            No layers selected. Turn on a layer above (Quests, People,
            Buildings, My Properties, Geography) to see its markers and list.
          </p>
        ) : null}
        {layerEnabled("quests") ? (
          <>
            <div>
              <div style={panelSectionHeaderStyle}>
                <h3 style={titleStyle}>{title}</h3>
                <input
                  type="search"
                  value={panelFilters.quests}
                  onChange={(event) =>
                    setPanelFilter("quests", event.currentTarget.value)
                  }
                  placeholder="Filter quests"
                  aria-label="Filter quests list"
                  style={sectionFilterInputStyle}
                />
              </div>
              {steps.length === 0 ? (
                <p style={mutedTextStyle}>
                  No active quest steps are available yet. Pick a quest below to
                  track it.
                </p>
              ) : filteredSteps.length === 0 ? (
                <p style={mutedTextStyle}>No quest steps match this filter.</p>
              ) : (
                <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {filteredSteps.map((step) => (
                    <li
                      key={step.id}
                      tabIndex={0}
                      aria-label={`${step.title}, ${
                        step.done ? "completed" : "in progress"
                      }`}
                      style={{
                        padding: 8,
                        marginBottom: 4,
                        background: "var(--biomes-bg-glass)",
                        border: "1px solid var(--biomes-edge-cyan-soft)",
                        borderLeft: step.done
                          ? "3px solid #78e68c"
                          : "3px solid var(--biomes-warn-amber)",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 12,
                          textDecoration: step.done
                            ? "line-through"
                            : undefined,
                          opacity: step.done ? 0.65 : 1,
                        }}
                      >
                        {step.title}
                      </strong>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--biomes-fg-muted)",
                        }}
                      >
                        {step.objective}
                      </div>
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
                      const isMainQuest = mainQuestId === quest.questId;
                      const isTracked =
                        isMainQuest ||
                        trackedQuestId === quest.questId ||
                        (trackedQuestId === null &&
                          !mainQuestId &&
                          quest.status === "active");
                      const isSelected = selectedQuestId === quest.questId;
                      const questMarker = questMarkerForMap(quest);
                      const canSetMain =
                        quest.status === "active" &&
                        Boolean(questMarker?.worldPosition);
                      const accent = isMainQuest
                        ? "var(--biomes-warn-amber)"
                        : quest.status === "active"
                        ? "var(--biomes-warn-amber)"
                        : quest.status === "completed"
                        ? "#78e68c"
                        : "var(--biomes-edge-cyan-soft)";
                      return (
                        <li key={quest.questId}>
                          <div style={questListItemStyle(isTracked, accent)}>
                            <button
                              type="button"
                              data-testid={`biomes-map-quest-${quest.questId}`}
                              aria-pressed={isTracked}
                              aria-expanded={isSelected}
                              onClick={() => trackQuest(quest)}
                              style={questListBodyStyle}
                            >
                              <strong style={{ fontSize: 12 }}>
                                {quest.title}
                              </strong>
                              <div style={eyebrowStyle}>
                                {isMainQuest ? "main · " : ""}
                                {quest.status} · {quest.area}
                              </div>
                              {quest.objective ? (
                                <div style={mutedSmallStyle}>
                                  {quest.objective}
                                </div>
                              ) : null}
                              {quest.timeRemaining ? (
                                <div
                                  data-testid={`biomes-map-quest-time-${quest.questId}`}
                                  style={questTimeLimitStyle}
                                >
                                  Time limit: {quest.timeRemaining}
                                </div>
                              ) : null}
                              {quest.reward ? (
                                <div style={mutedSmallStyle}>
                                  Reward: {quest.reward}
                                </div>
                              ) : null}
                            </button>
                            <div style={questActionsStyle}>
                              <button
                                type="button"
                                data-testid={`biomes-map-quest-set-main-${quest.questId}`}
                                aria-pressed={isMainQuest}
                                disabled={!canSetMain}
                                onClick={() => setMainQuest(quest)}
                                style={questActionButtonStyle(
                                  isMainQuest,
                                  !canSetMain
                                )}
                              >
                                {isMainQuest ? "Main Quest" : "Set Main"}
                              </button>
                              <button
                                type="button"
                                data-testid={`biomes-map-quest-center-${quest.questId}`}
                                disabled={!questMarker}
                                onClick={() => centerQuestOnMap(quest)}
                                style={questActionButtonStyle(
                                  false,
                                  !questMarker
                                )}
                              >
                                Center
                              </button>
                            </div>
                          </div>
                          {isSelected ? (
                            <QuestDetailPanel
                              quest={quest}
                              onLocateToolShop={(markerIds) =>
                                locateMarkerById(
                                  markerIds.find((id) =>
                                    allMarkers.some((entry) => entry.id === id)
                                  ) ?? markerIds[markerIds.length - 1]
                                )
                              }
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : null}
        {layerEnabled("people") ? (
          <MarkerList
            title="People"
            empty={
              panelFilters.people.trim()
                ? "No people match this filter."
                : "No known people are visible on this map yet."
            }
            markers={filteredPeopleMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
            filterValue={panelFilters.people}
            onFilter={(value) => setPanelFilter("people", value)}
          />
        ) : null}
        {layerEnabled("buildings") ? (
          <MarkerList
            title="Buildings & Services"
            empty={
              panelFilters.buildings.trim()
                ? "No buildings or services match this filter."
                : "No buildings or services are visible on this map yet."
            }
            markers={filteredBuildingMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
            filterValue={panelFilters.buildings}
            onFilter={(value) => setPanelFilter("buildings", value)}
          />
        ) : null}
        {layerEnabled("properties") ? (
          <MarkerList
            title="My Properties"
            empty={
              panelFilters.properties.trim()
                ? "No properties match this filter."
                : "No purchased properties are visible on this map yet."
            }
            markers={filteredPropertyMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
            filterValue={panelFilters.properties}
            onFilter={(value) => setPanelFilter("properties", value)}
          />
        ) : null}
        {layerEnabled("geography") ? (
          <MarkerList
            title="Geography"
            empty={
              panelFilters.geography.trim()
                ? "No geography markers match this filter."
                : "No geography markers are visible on this map yet."
            }
            markers={filteredGeographyMarkers}
            playerMarker={playerMarker}
            focusedMarkerId={focusedMarkerId}
            onSelect={centerOnMarker}
            onPin={setActiveDestination}
            activePinMarkerId={activeMapPinMarkerId}
            filterValue={panelFilters.geography}
            onFilter={(value) => setPanelFilter("geography", value)}
          />
        ) : null}
      </section>
    </div>
  );
};

// HARTHMERE_QUEST_DETAIL_PANEL: the full quest information shown when a
// player clicks a quest in the Quests panel — kind, objective, description,
// reward, time, and (for a tool-requiring job the player can't yet do) a clear
// "where to buy the tool" callout with a button that locates the shop on the map.
function QuestDetailPanel({
  quest,
  onLocateToolShop,
}: {
  quest: MapTrackableQuest;
  onLocateToolShop: (markerIds: string[]) => void;
}) {
  const objectives = questObjectivesForDetail(quest);
  return (
    <div
      data-testid={`biomes-map-quest-detail-${quest.questId}`}
      style={{
        margin: "4px 0 8px",
        padding: 8,
        background: "var(--biomes-bg-glass)",
        border: "1px solid var(--biomes-edge-cyan-soft)",
        borderRadius: 4,
        fontSize: 11,
        color: "var(--biomes-fg)",
      }}
    >
      <div style={eyebrowStyle}>
        {quest.kindLabel ?? "Quest"} · {quest.status}
        {quest.area ? ` · ${quest.area}` : ""}
      </div>
      <strong style={{ display: "block", marginTop: 3, fontSize: 12 }}>
        {quest.title}
      </strong>
      {quest.description ? (
        <p
          style={{
            margin: "4px 0",
            color: "var(--biomes-fg-muted)",
            lineHeight: 1.4,
          }}
        >
          {quest.description}
        </p>
      ) : null}
      {objectives.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <strong style={{ fontSize: 11 }}>
            {objectives.length === 1 ? "Objective" : "Objectives"}
          </strong>
          <ol style={{ margin: "3px 0 0 16px", padding: 0 }}>
            {objectives.map((objective, index) => (
              <li
                key={`${quest.questId}:objective:${index}`}
                style={{ marginBottom: 3, lineHeight: 1.4 }}
              >
                {objective}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
        {quest.reward ? (
          <span style={mutedSmallStyle}>Reward: {quest.reward}</span>
        ) : null}
        {quest.timeRemaining ? (
          <span
            data-testid={`biomes-map-quest-detail-time-${quest.questId}`}
            style={mutedSmallStyle}
          >
            Time limit: {quest.timeRemaining}
          </span>
        ) : null}
      </div>
      {quest.toolSource ? (
        <div
          data-testid={`biomes-map-quest-tool-source-${quest.questId}`}
          style={{
            marginTop: 6,
            padding: 6,
            background: "rgba(252,211,77,0.12)",
            border: "1px solid var(--biomes-warn-amber)",
            borderRadius: 3,
          }}
        >
          <strong style={{ fontSize: 11 }}>Tool needed</strong>
          <p style={{ margin: "3px 0", lineHeight: 1.4 }}>
            {quest.toolSource.hint}
          </p>
          <button
            type="button"
            data-testid={`biomes-map-quest-locate-tool-${quest.questId}`}
            onClick={() =>
              onLocateToolShop(questDetailToolShopMarkerCandidates(quest))
            }
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(252,211,77,0.20)",
              color: "var(--biomes-fg)",
              border: "1px solid var(--biomes-warn-amber)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Locate {quest.toolSource.toolName} shop on map
          </button>
        </div>
      ) : null}
      {quest.itemSource ? (
        <div
          data-testid={`biomes-map-quest-item-source-${quest.questId}`}
          style={{
            marginTop: 6,
            padding: 6,
            background: "rgba(125,211,252,0.12)",
            border: "1px solid var(--biomes-border)",
            borderRadius: 3,
          }}
        >
          <strong style={{ fontSize: 11 }}>Item needed</strong>
          <p style={{ margin: "3px 0", lineHeight: 1.4 }}>
            {quest.itemSource.hint}
          </p>
          <button
            type="button"
            data-testid={`biomes-map-quest-locate-item-${quest.questId}`}
            onClick={() =>
              onLocateToolShop(questDetailItemSourceMarkerCandidates(quest))
            }
            style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(125,211,252,0.18)",
              color: "var(--biomes-fg)",
              border: "1px solid var(--biomes-border)",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Locate {quest.itemSource.sourceName} on map
          </button>
        </div>
      ) : null}
    </div>
  );
}

function questObjectivesForDetail(quest: MapTrackableQuest): string[] {
  const seen = new Set<string>();
  return [...(quest.objectives ?? []), quest.objective]
    .map((objective) => (objective ?? "").trim())
    .filter((objective) => {
      if (!objective || seen.has(objective)) return false;
      seen.add(objective);
      return true;
    });
}

function MarkerList({
  title,
  empty,
  markers,
  playerMarker,
  focusedMarkerId,
  onSelect,
  onPin,
  activePinMarkerId,
  filterValue,
  onFilter,
}: {
  title: string;
  empty: string;
  markers: MapMarker[];
  playerMarker?: MapMarker;
  focusedMarkerId: string | null;
  onSelect: (marker: MapMarker) => void;
  onPin: (marker: MapMarker) => void;
  activePinMarkerId?: string;
  filterValue?: string;
  onFilter?: (value: string) => void;
}) {
  const sorted = React.useMemo(() => {
    return markers
      .filter((marker) => marker.kind !== "player")
      .slice()
      .sort((a, b) => {
        const da =
          distanceFromPlayer(a, playerMarker) ?? Number.POSITIVE_INFINITY;
        const db =
          distanceFromPlayer(b, playerMarker) ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.label.localeCompare(b.label);
      });
  }, [markers, playerMarker]);

  return (
    <div
      data-testid={`biomes-map-${title
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")}-list`}
    >
      <div style={panelSectionHeaderStyle}>
        <h3 style={titleStyle}>{title}</h3>
        {onFilter ? (
          <input
            type="search"
            value={filterValue ?? ""}
            onChange={(event) => onFilter(event.currentTarget.value)}
            placeholder={`Filter ${title.toLowerCase()}`}
            aria-label={`Filter ${title} list`}
            style={sectionFilterInputStyle}
          />
        ) : null}
      </div>
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
                <div
                  style={listItemFrameStyle(selected, KIND_COLOR[marker.kind])}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(marker)}
                    style={listButtonBodyStyle}
                  >
                    <strong style={{ fontSize: 12 }}>{marker.label}</strong>
                    <div style={eyebrowStyle}>
                      {KIND_LABEL[marker.kind]}
                      {distance !== undefined ? ` · ${distance}m from you` : ""}
                    </div>
                    {marker.description ? (
                      <div style={mutedSmallStyle}>{marker.description}</div>
                    ) : null}
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

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};
const mutedTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--biomes-fg-muted)",
};
const mutedSmallStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--biomes-fg-muted)",
};
const questTimeLimitStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--biomes-warn-amber)",
  fontWeight: 800,
};
const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--biomes-fg-muted)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const mapToolbarStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 5,
  top: 8,
  left: 8,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 6,
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.86)",
  fontSize: 11,
};
const boundsStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 5,
  top: 8,
  right: 8,
  padding: "4px 6px",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.72)",
  fontSize: 10,
  color: "var(--biomes-fg-muted)",
};
const emptyMapStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 20,
  color: "var(--biomes-fg-muted)",
  fontSize: 12,
  textAlign: "center",
};
const legendStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 5,
  left: 8,
  right: 8,
  bottom: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 10px",
  padding: 6,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.76)",
  fontSize: 10,
  color: "var(--biomes-fg-muted)",
};
const markerCardStyle: React.CSSProperties = {
  position: "absolute",
  zIndex: 6,
  right: 8,
  bottom: 54,
  width: 240,
  display: "grid",
  gap: 3,
  padding: 8,
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.92)",
  color: "var(--biomes-fg)",
  fontSize: 11,
};
const mapTopBarStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 0,
  flexWrap: "wrap",
};
const mapTabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  minWidth: 0,
  overflowX: "auto",
  paddingBottom: 2,
};
const mapTabButtonStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.68)",
  color: "var(--biomes-fg-muted)",
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const activeMapTabButtonStyle: React.CSSProperties = {
  borderColor: "var(--biomes-edge-cyan)",
  color: "var(--biomes-fg)",
  background: "rgba(74, 222, 255, 0.16)",
};
const layerToggleDividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  margin: "2px 2px",
  background: "var(--biomes-edge-cyan-soft)",
};
const layerQuickActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexShrink: 0,
};
const layerQuickButtonStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.6)",
  color: "var(--biomes-fg-muted)",
  padding: "7px 9px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const panelSectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 6,
  flexWrap: "wrap",
};
const sectionFilterInputStyle: React.CSSProperties = {
  width: 130,
  maxWidth: "100%",
  height: 26,
  padding: "0 8px",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.72)",
  color: "var(--biomes-fg)",
  fontSize: 11,
  outline: "none",
};
const sidePanelStyle: React.CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  display: "grid",
  alignContent: "start",
  gap: 12,
  paddingRight: 4,
};
const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 4,
};
const listItemFrameStyle = (
  selected: boolean,
  accent: string
): React.CSSProperties => ({
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
const questListItemStyle = (
  selected: boolean,
  accent: string
): React.CSSProperties => ({
  display: "grid",
  gap: 7,
  padding: 8,
  background: selected ? "rgba(74,222,255,0.18)" : "var(--biomes-bg-glass)",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderLeft: `3px solid ${accent}`,
});
const questListBodyStyle: React.CSSProperties = {
  ...listButtonBodyStyle,
};
const questActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};
function questActionButtonStyle(
  selected: boolean,
  disabled = false
): React.CSSProperties {
  return {
    padding: "5px 8px",
    border: selected
      ? "1px solid var(--biomes-warn-amber)"
      : "1px solid var(--biomes-edge-cyan-soft)",
    borderRadius: 3,
    background: selected ? "rgba(252,211,77,0.20)" : "rgba(7, 12, 26, 0.58)",
    color: disabled ? "var(--biomes-fg-dim)" : "var(--biomes-fg)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
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
