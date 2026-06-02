import type { NavigationAidKind, NavigationAidSpec } from "@/client/game/helpers/navigation_aids";

export const BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY_V142 = "biomes_ui_active_map_pin_v142";
export const BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142 = "biomes-ui-active-map-pin-v142";
export const BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID_V147 = 14_200_147;

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

export function biomesUIActiveMapPinNavigationAidKindForTest(markerKind: string): NavigationAidKind {
  switch (String(markerKind ?? "").toLowerCase()) {
    case "resource":
    case "safe_zone":
      return "farming";
    case "danger":
      return "hunting";
    case "route":
    case "rift":
      return "fishing";
    case "vendor":
    case "store":
    case "business":
    case "bank":
    case "property":
    case "town":
      return "camera";
    case "objective":
    case "quest":
    default:
      return "puzzle";
  }
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
