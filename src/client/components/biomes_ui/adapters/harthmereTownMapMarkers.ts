// HARTHMERE_TOWN_MAP_MARKERS (BiomesUI map feed)
//
// Adapts the shared additive-town marker table (people, 57 buildings, district
// locations) into the loose "landmark" shape the BiomesUI map adapter consumes,
// mirroring what harthmereBusinessMapMarkers.ts does for the 19 business
// outposts. Without this, the whole additive town was invisible on the map and
// nothing in it could be chosen as an active destination.

import {
  HARTHMERE_TOWN_MARKER_SOURCE,
  getHarthmereTownMapMarkers,
  type HarthmereTownMapMarker,
  type HarthmereTownMarkerKind,
} from "@/shared/harthmere/harthmere_town_map_markers";

export { HARTHMERE_TOWN_MARKER_SOURCE };

/**
 * Map-marker kind used by MapQuestsTab's filters and colours.
 *
 * - `vendor`  -> People tab (townsfolk you can walk up to and talk to)
 * - `store`   -> Places tab (buildings and named service landmarks)
 * - `town`    -> World tab (district compass points)
 * - `danger`  -> World tab (hostile anchors)
 * - `resource`-> World tab (wildlife anchors)
 */
export type HarthmereTownMapMarkerUiKind =
  | "vendor"
  | "store"
  | "town"
  | "danger"
  | "resource";

const UI_KIND_BY_TOWN_KIND: Record<
  HarthmereTownMarkerKind,
  HarthmereTownMapMarkerUiKind
> = {
  person: "vendor",
  hostile: "danger",
  animal: "resource",
  building: "store",
  district: "town",
  landmark: "store",
};

export function harthmereTownMapMarkerUiKind(
  kind: HarthmereTownMarkerKind
): HarthmereTownMapMarkerUiKind {
  return UI_KIND_BY_TOWN_KIND[kind] ?? "store";
}

export interface HarthmereTownMapLandmark {
  id: string;
  label: string;
  position: [number, number, number];
  kind: HarthmereTownMapMarkerUiKind;
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  description: string;
  source: typeof HARTHMERE_TOWN_MARKER_SOURCE;
  townMarkerKind: HarthmereTownMarkerKind;
  npcId?: string;
  buildingName?: string;
}

function toLandmark(marker: HarthmereTownMapMarker): HarthmereTownMapLandmark {
  return {
    id: marker.id,
    label: marker.label,
    position: [...marker.position] as [number, number, number],
    kind: harthmereTownMapMarkerUiKind(marker.kind),
    area: marker.district,
    visibleOnWorldMap: true as const,
    visibleOnHudMap: true as const,
    description: marker.description,
    source: HARTHMERE_TOWN_MARKER_SOURCE,
    townMarkerKind: marker.kind,
    npcId: marker.npcId,
    buildingName: marker.buildingName,
  };
}

export function harthmereTownMapLandmarks(): HarthmereTownMapLandmark[] {
  return getHarthmereTownMapMarkers().map(toLandmark);
}

/**
 * Append the additive town to an existing landmark feed.
 *
 * Existing entries WIN on id collision: an authored Grove/quest landmark (for
 * example `harthmere_market_posting_board`, which is both a Grove quest target
 * and a bible district landmark) keeps its quest wiring, description, and
 * visibility flags rather than being clobbered by the generic town pin.
 */
export function appendHarthmereTownMapLandmarks(landmarks: any[]): any[] {
  const merged = new Map<string, any>();
  for (const landmark of landmarks) {
    if (!landmark?.id) continue;
    merged.set(String(landmark.id), landmark);
  }
  for (const landmark of harthmereTownMapLandmarks()) {
    if (merged.has(landmark.id)) continue;
    merged.set(landmark.id, landmark);
  }
  return Array.from(merged.values());
}
