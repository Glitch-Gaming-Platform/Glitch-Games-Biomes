import type {
  NavigationAidKind,
  NavigationAidSpec,
} from "@/client/game/helpers/navigation_aids";
import { nativeRobotStoryQuestOrder } from "@/shared/harthmere/native_road_ahead_contract";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";

export const BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY = "biomes_ui_active_map_pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_EVENT = "biomes-ui-active-map-pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID = 14_200_147;

// BIOMES_UI_LOCATE_ON_MAP:
// "Locate on map" should do more than drop a pin — it should open the Map tab
// and center the map on the target. This event carries that intent: BiomesUIMount
// switches to the Map tab, and the Map tab centers on the pin. A short recency
// window lets the Map tab center even if it mounts just after the event fired
// (the tab-switch and the listener attach are not perfectly ordered).
export const BIOMES_UI_LOCATE_ON_MAP_EVENT = "biomes-ui-locate-on-map";
export const BIOMES_UI_LOCATE_ON_MAP_RECENCY_MS = 12_000;

export interface BiomesUIActiveMapPin {
  markerId: string;
  label: string;
  kind: string;
  worldPosition: [number, number, number];
  description?: string;
  setAtMs: number;
}

export interface BiomesUIMapPinSourceMarker {
  id: string;
  label: string;
  kind: string;
  worldPosition?: [number, number, number];
  description?: string;
}

export interface BiomesUIAutoDestinationQuest {
  questId: string;
  status: string;
  firstMarkerId?: string;
}

/**
 * Advance story guidance without stealing a destination the player deliberately
 * selected. Native quest steps can synthesize a marker even when the original
 * Bikkie leaf had no navigation aid; promoting that marker to the active pin is
 * what makes it appear on the HUD minimap and directional overlay.
 */
export function automaticQuestDestinationMarkerForTest(input: {
  existingPin?: Pick<BiomesUIActiveMapPin, "markerId">;
  quest?: BiomesUIAutoDestinationQuest;
  markers: readonly BiomesUIMapPinSourceMarker[];
}): BiomesUIMapPinSourceMarker | undefined {
  const markerId = String(input.quest?.firstMarkerId ?? "").trim();
  if (input.quest?.status !== "active" || !markerId) {
    return undefined;
  }
  const marker = input.markers.find((candidate) => candidate.id === markerId);
  if (!marker || !finiteWorldPosition(marker.worldPosition)) {
    return undefined;
  }
  const existingMarkerId = String(input.existingPin?.markerId ?? "").trim();
  if (existingMarkerId === markerId) {
    return undefined;
  }
  if (!existingMarkerId) {
    return marker;
  }

  const existingIsEarlierStepOfQuest = existingMarkerId.startsWith(
    `native_quest:${input.quest.questId}:`
  );
  const existingQuestId = /^native_quest:([^:]+):/.exec(existingMarkerId)?.[1];
  const existingStoryOrder = existingQuestId
    ? nativeRobotStoryQuestOrder(existingQuestId)
    : -1;
  const nextStoryOrder = nativeRobotStoryQuestOrder(input.quest.questId);
  const existingIsPreviousStoryChapter =
    existingStoryOrder >= 0 &&
    nextStoryOrder >= 0 &&
    existingStoryOrder < nextStoryOrder;
  return existingIsEarlierStepOfQuest || existingIsPreviousStoryChapter
    ? marker
    : undefined;
}

function finiteWorldPosition(
  position: BiomesUIMapPinSourceMarker["worldPosition"]
): [number, number, number] | undefined {
  if (!Array.isArray(position) || position.length < 3) {
    return undefined;
  }
  const x = Number(position[0]);
  const y = Number(position[1]);
  const z = Number(position[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

export function biomesUIActiveMapPinNavigationAidKindForTest(
  _markerKind: string
): NavigationAidKind {
  // A user-set active map pin is always a non-quest "map_pin" navigation aid so
  // its directional indicator (on-circle arrow + on-screen precision overlay)
  // renders even when the player is NOT tracking a quest. Previously every kind
  // mapped to a QuestCategory, which suppressed the arrow unless a quest was
  // being tracked -- the core "set destination -> see the way there" feature.
  return "map_pin";
}

export function biomesUIActiveMapPinNavigationAidSpecForTest(
  pin: BiomesUIActiveMapPin | undefined
): NavigationAidSpec | undefined {
  const worldPosition = finiteWorldPosition(pin?.worldPosition);
  if (!pin || !worldPosition) {
    return undefined;
  }
  return {
    target: {
      kind: "position",
      position: worldPosition,
    },
    kind: biomesUIActiveMapPinNavigationAidKindForTest(pin.kind),
    autoremoveWhenNear: false,
  };
}

export function activeBiomesUIMapPinFromMarkerForTest(
  marker: BiomesUIMapPinSourceMarker,
  nowMs = Date.now()
): BiomesUIActiveMapPin | undefined {
  const worldPosition = finiteWorldPosition(marker.worldPosition);
  const markerId = String(marker.id ?? "").trim();
  const label = String(marker.label ?? "").trim();
  if (!markerId || !label || !worldPosition) {
    return undefined;
  }
  const resolvedWorldPosition = resolveHarthmereProductionMarkerPosition({
    markerId,
    fallback: worldPosition,
  }) as [number, number, number];
  return {
    markerId,
    label,
    kind: String(marker.kind ?? "objective"),
    worldPosition: resolvedWorldPosition,
    description:
      typeof marker.description === "string" && marker.description.trim()
        ? marker.description.trim()
        : undefined,
    setAtMs: nowMs,
  };
}

// HARTHMERE active-pin staleness
// The active map pin persists in localStorage with no quest linkage, so a pin
// set for a quest/job that is later completed or abandoned would keep showing a
// directional marker "to nowhere". This decides when to drop a stale pin:
// only when the destination is gone from a POPULATED landmark set. An empty set
// means the map data has not hydrated yet, so we never clear in that case
// (which would wrongly nuke a still-valid pin during loading).
export function shouldClearStaleActiveMapPin(input: {
  pin: { markerId: string } | undefined;
  visibleMarkerIds: readonly string[];
}): boolean {
  if (!input.pin) {
    return false;
  }
  if (input.visibleMarkerIds.length === 0) {
    return false;
  }
  return !input.visibleMarkerIds.includes(input.pin.markerId);
}

function parseActiveBiomesUIMapPin(
  value: string | null
): BiomesUIActiveMapPin | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as BiomesUIActiveMapPin;
    return activeBiomesUIMapPinFromMarkerForTest(
      {
        id: parsed.markerId,
        label: parsed.label,
        kind: parsed.kind,
        worldPosition: parsed.worldPosition,
        description: parsed.description,
      },
      Number(parsed.setAtMs) || Date.now()
    );
  } catch {
    return undefined;
  }
}

export function readActiveBiomesUIMapPin(): BiomesUIActiveMapPin | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseActiveBiomesUIMapPin(
      window.localStorage?.getItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY) ?? null
    );
  } catch {
    return undefined;
  }
}

export function writeActiveBiomesUIMapPin(
  pin: BiomesUIActiveMapPin | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    if (pin) {
      window.localStorage?.setItem(
        BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY,
        JSON.stringify(pin)
      );
    } else {
      window.localStorage?.removeItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY);
    }
  } catch {
    // The map still updates in-memory when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, { detail: pin })
  );
}

// BIOMES_UI_LOCATE_ON_MAP:
// "Locate on map" entry point. Persists the destination pin (so the nav aid /
// minimap arrow appear as before) AND asks the UI to open the Map tab and center
// on it. Used by the Land/Property panels' "Locate on map" buttons.
export function requestBiomesUILocateOnMap(pin: BiomesUIActiveMapPin): void {
  writeActiveBiomesUIMapPin(pin);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_LOCATE_ON_MAP_EVENT, { detail: pin })
  );
}
