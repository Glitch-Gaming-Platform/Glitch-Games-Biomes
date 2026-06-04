import type { HarthmereCookStationKindV1 } from "@/shared/harthmere/object_interaction_semantics_v1";

// Fired when the player presses the cook interaction (F) at a campfire / oven /
// cookpot. The mounted cooking panel listens and opens the cooking interface for
// the specific station. Mirrors the world-object container open pattern.
export const HARTHMERE_COOKING_STATION_OPEN_EVENT_V1 =
  "biomes:harthmere-cooking-station-open-v1";

const HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY_V1 =
  "biomes.localDev.harthmere.cookingStationOpenRequest.v1";

export interface HarthmereCookingStationOpenRequestV1 {
  stationId: string;
  stationKind: HarthmereCookStationKindV1;
  label?: string;
}

function isBrowserV1() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/** Builds a stable station id for the per-station cooking queue. A real ECS
 *  entity id is preferred; procedural landmarks (id 0 / missing) fall back to a
 *  normalized label so two same-named props do not collide with the rest. */
export function harthmereCookingStationIdV1(
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
export function openHarthmereCookingStationV1(input: {
  stationId: string;
  stationKind: HarthmereCookStationKindV1;
  label?: string | null;
  entityId?: unknown;
}) {
  const displayLabel = input.label?.trim() || "Cooking Station";
  const request: HarthmereCookingStationOpenRequestV1 = {
    stationId: input.stationId,
    stationKind: input.stationKind,
    label: displayLabel,
  };
  if (isBrowserV1()) {
    window.localStorage.setItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY_V1,
      JSON.stringify(request)
    );
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_COOKING_STATION_OPEN_EVENT_V1, {
        detail: request,
      })
    );
  }
}

export function readHarthmereCookingStationOpenRequestV1():
  | HarthmereCookingStationOpenRequestV1
  | undefined {
  if (!isBrowserV1()) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY_V1
    );
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as HarthmereCookingStationOpenRequestV1;
    if (!parsed?.stationId || !parsed?.stationKind) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function clearHarthmereCookingStationOpenRequestV1() {
  if (isBrowserV1()) {
    window.localStorage.removeItem(
      HARTHMERE_COOKING_STATION_OPEN_REQUEST_KEY_V1
    );
  }
}
