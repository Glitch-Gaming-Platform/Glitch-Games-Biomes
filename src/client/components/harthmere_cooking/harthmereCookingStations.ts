import type { HarthmereCookStationKind } from "@/shared/harthmere/object_interaction_semantics";

// Fired when the player presses the cook interaction (F) at a campfire / oven /
// cookpot. The mounted cooking panel listens and opens the cooking interface for
// the specific station. Mirrors the world-object container open pattern.
export const HARTHMERE_COOKING_STATION_OPEN_EVENT =
  "biomes:harthmere-cooking-station-open";

const HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY =
  "biomes.localDev.harthmere.cookingStationOpenRequest";

export interface HarthmereCookingStationOpenRequest {
  stationId: string;
  stationKind: HarthmereCookStationKind;
  label?: string;
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/** Builds a stable station id for the per-station cooking queue. A real ECS
 *  entity id is preferred; procedural landmarks (id 0 / missing) fall back to a
 *  normalized label so two same-named props do not collide with the rest. */
export function harthmereCookingStationId(
  entityId: unknown,
  label?: string | null
): string {
  const idText = entityId === undefined || entityId === null ? "" : String(entityId);
  if (idText && idText !== "0") {
    return `ecs:${idText}`;
  }
  const normalizedLabel = (label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `label:${normalizedLabel || "station"}`;
}

/** Opens the cooking panel for a station (campfire / cookpot / oven). */
export function openHarthmereCookingStation(input: {
  stationId: string;
  stationKind: HarthmereCookStationKind;
  label?: string | null;
  entityId?: unknown;
}) {
  const displayLabel = input.label?.trim() || "Cooking Station";
  const request: HarthmereCookingStationOpenRequest = {
    stationId: input.stationId,
    stationKind: input.stationKind,
    label: displayLabel,
  };
  if (isBrowser()) {
    window.localStorage.setItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY,
      JSON.stringify(request)
    );
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_COOKING_STATION_OPEN_EVENT, {
        detail: request,
      })
    );
  }
}

export function readHarthmereCookingStationOpenRequest():
  | HarthmereCookingStationOpenRequest
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY
    );
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as HarthmereCookingStationOpenRequest;
    if (!parsed?.stationId || !parsed?.stationKind) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function clearHarthmereCookingStationOpenRequest() {
  if (isBrowser()) {
    window.localStorage.removeItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY
    );
  }
}
