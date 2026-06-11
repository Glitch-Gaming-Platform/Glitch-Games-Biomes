import {
  getHarthmereBusinessOutpostMapMarkersV1,
  type HarthmereBusinessOutpostMapMarkerV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import { resolveHarthmereProductionMarkerPositionV1 } from "@/shared/harthmere/production_terrain_placement_map_v1";

export interface HarthmereBusinessMapLandmarkV1 {
  id: string;
  label: string;
  position: [number, number, number];
  kind: "business";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  description: string;
  businessType: HarthmereBusinessOutpostMapMarkerV1["businessType"];
  outpostId: string;
  jobTitle: string;
  interfaceTitle: string;
  primaryBikkieId?: string | number;
  primaryBikkieLabel?: string;
  primaryBikkieVisual?: HarthmereBusinessOutpostMapMarkerV1["primaryBikkieVisual"];
}

export function harthmereBusinessOutpostMapLandmarksV1(): HarthmereBusinessMapLandmarkV1[] {
  return getHarthmereBusinessOutpostMapMarkersV1().map((marker) => ({
    id: marker.markerId,
    label: marker.label,
    position: resolveHarthmereProductionMarkerPositionV1({
      markerId: marker.markerId,
      fallback: marker.position,
    }) as [number, number, number],
    kind: "business" as const,
    area: marker.area,
    visibleOnWorldMap: true as const,
    visibleOnHudMap: true as const,
    description: marker.description,
    businessType: marker.businessType,
    outpostId: marker.outpostId,
    jobTitle: marker.jobTitle,
    interfaceTitle: marker.interfaceTitle,
    primaryBikkieId: marker.primaryBikkieGraphic?.bikkieId,
    primaryBikkieLabel: marker.primaryBikkieGraphic?.label,
    primaryBikkieVisual: marker.primaryBikkieVisual,
  }));
}

export function appendHarthmereBusinessOutpostMapLandmarksV1(landmarks: any[]): any[] {
  const merged = new Map<string, any>();
  for (const landmark of landmarks) {
    if (!landmark?.id) continue;
    merged.set(String(landmark.id), landmark);
  }
  for (const landmark of harthmereBusinessOutpostMapLandmarksV1()) {
    merged.set(landmark.id, landmark);
  }
  return Array.from(merged.values());
}
