import {
  getHarthmereBusinessOutpostMapMarkersV1,
  type HarthmereBusinessOutpostMapMarkerV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS_V1 = 220;
export const HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT_V1 = 10;

export interface HarthmereBusinessMiniMapPinV1 {
  key: string;
  markerId: string;
  label: string;
  position: Vec3;
  distanceMeters: number;
  businessType: HarthmereBusinessOutpostMapMarkerV1["businessType"];
  outpostId: string;
  primaryBikkieId?: string | number;
  primaryBikkieLabel?: string;
  primaryBikkieVisual?: HarthmereBusinessOutpostMapMarkerV1["primaryBikkieVisual"];
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
): HarthmereBusinessMiniMapPinV1[] {
  if (!finiteVec3(playerPosition)) return [];
  const maxDistanceMeters = Math.max(
    1,
    Math.floor(options.maxDistanceMeters ?? HARTHMERE_BUSINESS_MINIMAP_MAX_DISTANCE_METERS_V1),
  );
  const limit = Math.max(1, Math.floor(options.limit ?? HARTHMERE_BUSINESS_MINIMAP_PIN_LIMIT_V1));
  return getHarthmereBusinessOutpostMapMarkersV1()
    .filter((marker) => marker.visibleOnHudMap)
    .map((marker) => {
      const position = marker.position as Vec3;
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
