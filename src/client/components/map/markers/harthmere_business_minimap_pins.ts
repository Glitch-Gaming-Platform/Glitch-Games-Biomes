import {
  getHarthmereBusinessOutpostMapMarkers,
  type HarthmereBusinessOutpostMapMarker,
} from "@/shared/harthmere/business_customer_simulator";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS = 220;
export const HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT = 10;
export const HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX = 4;

export interface HarthmereBusinessMiniMapPin {
  key: string;
  markerId: string;
  label: string;
  position: Vec3;
  distanceMeters: number;
  businessType: HarthmereBusinessOutpostMapMarker["businessType"];
  outpostId: string;
  primaryBikkieId?: string | number;
  primaryBikkieLabel?: string;
  primaryBikkieVisual?: HarthmereBusinessOutpostMapMarker["primaryBikkieVisual"];
}

function finiteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])) &&
    Number.isFinite(Number(value[2]))
  );
}

function xzDistanceMeters(a: Vec3, b: Vec3) {
  return Math.round(Math.hypot(a[0] - b[0], a[2] - b[2]));
}

export function harthmereBusinessMiniMapPinsForPlayerForTest(
  playerPosition: Vec3 | undefined,
  options: { maxDistanceMeters?: number; limit?: number } = {},
): HarthmereBusinessMiniMapPin[] {
  if (!finiteVec3(playerPosition)) return [];
  const maxDistanceMeters = Math.max(
    1,
    Math.floor(options.maxDistanceMeters ?? HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS),
  );
  const limit = Math.max(1, Math.floor(options.limit ?? HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT));
  return getHarthmereBusinessOutpostMapMarkers()
    .filter((marker) => marker.visibleOnHudMap)
    .map((marker) => {
      const position = resolveHarthmereProductionMarkerPosition({
        markerId: marker.markerId,
        fallback: marker.position as Vec3,
      });
      return {
        key: marker.markerId,
        markerId: marker.markerId,
        label: marker.label,
        position,
        distanceMeters: xzDistanceMeters(playerPosition, position),
        businessType: marker.businessType,
        outpostId: marker.outpostId,
        primaryBikkieId: marker.primaryBikkieGraphic?.bikkieId,
        primaryBikkieLabel: marker.primaryBikkieGraphic?.label,
        primaryBikkieVisual: marker.primaryBikkieVisual,
      };
    })
    .filter((pin) => pin.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.label.localeCompare(b.label))
    .slice(0, limit);
}
