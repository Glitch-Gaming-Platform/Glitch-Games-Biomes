import {
  BUILDING_SYSTEM_PLOTS_V1,
  type BuildingSystemInWorldMarkerV1,
  type BuildingSystemPlotDefinitionV1,
} from "@/shared/harthmere/building_system_v1";

export const HARTHMERE_PROPERTY_MARKER_SOURCE_V1 =
  "harthmere-property-map-marker-v1" as const;
export const HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1 =
  "biomes:harthmere-building-state-updated-v1" as const;

export interface HarthmerePropertyMapBuildingStateV1 {
  ownedPlotIds?: unknown;
  safeZones?: Record<string, { safeFromMuck?: boolean; activatedAtMs?: number; area?: string }>;
  inWorldMarkers?: Record<string, BuildingSystemInWorldMarkerV1>;
  completedProperties?: Record<string, { plotId?: string; propertyId?: string; status?: string }>;
}

export interface HarthmerePropertyMapLandmarkV1 {
  id: string;
  plotId: string;
  label: string;
  kind: "property";
  position: [number, number, number];
  area: string;
  visibleOnWorldMap: true;
  source: typeof HARTHMERE_PROPERTY_MARKER_SOURCE_V1;
  terrainState: "muck" | "terraformed";
  description: string;
}

function finitePosition(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

function centerPositionForPlot(plot: BuildingSystemPlotDefinitionV1): [number, number, number] {
  return [
    Math.floor((plot.bounds.xMin + plot.bounds.xMax) / 2),
    plot.groundY + 2,
    Math.floor((plot.bounds.zMin + plot.bounds.zMax) / 2),
  ];
}

function mapMarkerPositionForPlot(
  state: HarthmerePropertyMapBuildingStateV1,
  plot: BuildingSystemPlotDefinitionV1
) {
  return (
    finitePosition(state.inWorldMarkers?.[`${plot.plotId}:map`]?.position) ??
    finitePosition(
      Object.values(state.inWorldMarkers ?? {}).find(
        (marker) => marker.plotId === plot.plotId && marker.kind === "map_marker"
      )?.position
    ) ??
    centerPositionForPlot(plot)
  );
}

export function harthmerePropertyMapLandmarksFromBuildingStateV1(
  buildingState: HarthmerePropertyMapBuildingStateV1 | undefined
): HarthmerePropertyMapLandmarkV1[] {
  const ownedPlotIds = buildingState?.ownedPlotIds;
  const owned = new Set<string>(
    Array.isArray(ownedPlotIds)
      ? ownedPlotIds.filter((plotId): plotId is string => typeof plotId === "string")
      : []
  );
  for (const property of Object.values(buildingState?.completedProperties ?? {})) {
    if (typeof property?.plotId === "string") owned.add(property.plotId);
  }
  if (owned.size === 0) return [];

  return BUILDING_SYSTEM_PLOTS_V1.filter(
    (plot) => plot.startsMucked && owned.has(plot.plotId)
  ).map((plot) => {
    const safe = buildingState?.safeZones?.[plot.plotId]?.safeFromMuck === true;
    const terrainState = safe ? "terraformed" : "muck";
    return {
      id: `property:${plot.plotId}`,
      plotId: plot.plotId,
      label: plot.displayName,
      kind: "property",
      position: mapMarkerPositionForPlot(buildingState ?? {}, plot),
      area: plot.district,
      visibleOnWorldMap: true,
      source: HARTHMERE_PROPERTY_MARKER_SOURCE_V1,
      terrainState,
      description:
        terrainState === "terraformed"
          ? `${plot.district}. Terraformed property land.`
          : `${plot.district}. Muck designation land. Terraform needed before this becomes nice land.`,
    };
  });
}

export function harthmerePropertyMiniMapPinsForBuildingStateForTest(
  buildingState: HarthmerePropertyMapBuildingStateV1 | undefined
) {
  return harthmerePropertyMapLandmarksFromBuildingStateV1(buildingState)
    .map((landmark) => ({
      key: landmark.id,
      markerId: landmark.id,
      label: landmark.label,
      terrainState: landmark.terrainState,
      position: landmark.position,
    }))
    .filter((pin) => pin.position.every((value) => Number.isFinite(value)))
    .slice(0, 12);
}
