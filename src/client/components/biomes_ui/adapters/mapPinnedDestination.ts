import type { NavigationAidKind, NavigationAidSpec } from "@/client/game/helpers/navigation_aids";

export const BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY_V142 = "biomes_ui_active_map_pin_v142";
export const BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142 = "biomes-ui-active-map-pin-v142";
export const BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147 = 14_200_147;

// BIOMES_UI_LOCATE_ON_MAP_V1:
// "Locate on map" should do more than drop a pin — it should open the Map tab
// and center the map on the target. This event carries that intent: BiomesUIMount
// switches to the Map tab, and the Map tab centers on the pin. A short recency
// window lets the Map tab center even if it mounts just after the event fired
// (the tab-switch and the listener attach are not perfectly ordered).
export const BIOMES_UI_LOCATE_ON_MAP_EVENT_V1 = "biomes-ui-locate-on-map-v1";
export const BIOMES_UI_LOCATE_ON_MAP_RECENCY_MS_V1 = 12_000;

export interface BiomesUIActiveMapPinV142 {
  markerId: string;
  label: string;
  kind: string;
  worldPosition: [number, number, number];
  description?: string;
  setAtMs: number;
}

export interface BiomesUIMapPinSourceMarkerV142 {
  id: string;
  label: string;
  kind: string;
  worldPosition?: [number, number, number];
  description?: string;
}

function finiteWorldPosition(position: BiomesUIMapPinSourceMarkerV142["worldPosition"]): [number, number, number] | undefined {
  if (!Array.isArray(position) || position.length < 3) {
    return undefined;
  }
  const x = Number(position[0]);
  const y = Number(position[1]);
  const z = Number(position[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? [x, y, z] : undefined;
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

export function biomesUIActiveMapPinNavigationAidSpecForTest(pin: BiomesUIActiveMapPinV142 | undefined): NavigationAidSpec | undefined {
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

export function activeBiomesUIMapPinFromMarkerForTest(marker: BiomesUIMapPinSourceMarkerV142, nowMs = Date.now()): BiomesUIActiveMapPinV142 | undefined {
  const worldPosition = finiteWorldPosition(marker.worldPosition);
  const markerId = String(marker.id ?? "").trim();
  const label = String(marker.label ?? "").trim();
  if (!markerId || !label || !worldPosition) {
    return undefined;
  }
  return {
    markerId,
    label,
    kind: String(marker.kind ?? "objective"),
    worldPosition,
    description: typeof marker.description === "string" && marker.description.trim() ? marker.description.trim() : undefined,
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
export function shouldClearStaleActiveMapPinV1(input: {
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

function parseActiveBiomesUIMapPin(value: string | null): BiomesUIActiveMapPinV142 | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as BiomesUIActiveMapPinV142;
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

export function readActiveBiomesUIMapPinV142(): BiomesUIActiveMapPinV142 | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseActiveBiomesUIMapPin(window.localStorage?.getItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY_V142) ?? null);
  } catch {
    return undefined;
  }
}

export function writeActiveBiomesUIMapPinV142(pin: BiomesUIActiveMapPinV142 | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (pin) {
      window.localStorage?.setItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY_V142, JSON.stringify(pin));
    } else {
      window.localStorage?.removeItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY_V142);
    }
  } catch {
    // The map still updates in-memory when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, { detail: pin }));
}

// BIOMES_UI_LOCATE_ON_MAP_V1:
// "Locate on map" entry point. Persists the destination pin (so the nav aid /
// minimap arrow appear as before) AND asks the UI to open the Map tab and center
// on it. Used by the Land/Property panels' "Locate on map" buttons.
export function requestBiomesUILocateOnMapV1(pin: BiomesUIActiveMapPinV142): void {
  writeActiveBiomesUIMapPinV142(pin);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_LOCATE_ON_MAP_EVENT_V1, { detail: pin })
  );
}
