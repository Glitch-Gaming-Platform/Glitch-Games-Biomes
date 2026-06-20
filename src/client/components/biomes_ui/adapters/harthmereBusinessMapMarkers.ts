import {
  getHarthmereBusinessOutpostMapMarkers,
  type HarthmereBusinessOutpostMapMarker,
} from "@/shared/harthmere/business_customer_simulator";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";

export interface HarthmereBusinessMapLandmark {
  id: string;
  label: string;
  position: [number, number, number];
  kind: "business";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  description: string;
  businessType: HarthmereBusinessOutpostMapMarker["businessType"];
  outpostId: string;
  jobTitle: string;
  interfaceTitle: string;
  primaryBikkieId?: string | number;
  primaryBikkieLabel?: string;
  primaryBikkieVisual?: HarthmereBusinessOutpostMapMarker["primaryBikkieVisual"];
}

export function harthmereBusinessOutpostMapLandmarks(): HarthmereBusinessMapLandmark[] {
  return getHarthmereBusinessOutpostMapMarkers().map((marker) => ({
    id: marker.markerId,
    label: marker.label,
    position: resolveHarthmereProductionMarkerPosition({
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

export function appendHarthmereBusinessOutpostMapLandmarks(landmarks: any[]): any[] {
  const merged = new Map<string, any>();
  for (const landmark of landmarks) {
    if (!landmark?.id) continue;
    merged.set(String(landmark.id), landmark);
  }
  for (const landmark of harthmereBusinessOutpostMapLandmarks()) {
    merged.set(landmark.id, landmark);
  }
  return Array.from(merged.values());
}
