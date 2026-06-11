import type { Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_V1,
} from "@/shared/harthmere/generated/production_terrain_placement_map_v1";

export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_VERSION_V1 =
  "harthmere-production-terrain-placement-map-v1" as const;

export type HarthmereProductionPlacementPurposeV1 =
  | "quest_item"
  | "quest_marker"
  | "monster"
  | "npc"
  | "interactable"
  | "spawn_pool";

export type HarthmereProductionPlacementModeV1 =
  | "outdoor_surface"
  | "indoor_or_cave_floor"
  | "cave_spawn"
  | "fallback_authored_y";

export interface HarthmereProductionPlacementBoundsV1 {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface HarthmereProductionPlacementRecordV1 {
  key: string;
  source: string;
  id: string;
  label: string;
  purpose: HarthmereProductionPlacementPurposeV1;
  authoredPosition: Vec3;
  worldPosition: Vec3;
  recommendedPosition: Vec3;
  placementMode: HarthmereProductionPlacementModeV1;
  surfaceFeetY?: number;
  nearestFeetY?: number;
  caveFeetYs?: readonly number[];
  deltaY?: number;
  caveId?: string;
  notes?: string;
}

export interface HarthmereProductionCaveSpawnPointV1 {
  position: Vec3;
  floorFeetY: number;
  clearance: number;
  score: number;
}

export interface HarthmereProductionCaveRecordV1 {
  caveId: string;
  label: string;
  bounds: HarthmereProductionPlacementBoundsV1;
  sampleCount: number;
  floorYMin: number;
  floorYMax: number;
  ceilingYMin: number;
  ceilingYMax: number;
  entranceCandidates: readonly Vec3[];
  spawnPoints: readonly HarthmereProductionCaveSpawnPointV1[];
}

export interface HarthmereProductionOutdoorSpawnPointV1 {
  id: string;
  position: Vec3;
  areaId?: string;
  score: number;
}

export interface HarthmereProductionTerrainPlacementMapV1 {
  version: typeof HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_VERSION_V1;
  generatedAtIso: string;
  production: {
    subscriptionId: string;
    resourceGroup: string;
    containerApp: string;
    revision: string;
    image: string;
    fqdn: string;
  };
  scan: {
    bounds: HarthmereProductionPlacementBoundsV1;
    stride: number;
    scannedRedisKeys: number;
    resolvedTerrainShards: number;
    targetTerrainShards: number;
  };
  placements: readonly HarthmereProductionPlacementRecordV1[];
  caves: readonly HarthmereProductionCaveRecordV1[];
  outdoorSpawnPoints: readonly HarthmereProductionOutdoorSpawnPointV1[];
}

export const HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1 =
  HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_V1;

const PLACEMENTS_BY_KEY_V1: Map<string, HarthmereProductionPlacementRecordV1> =
  new Map(
    (
      HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1
        .placements as readonly HarthmereProductionPlacementRecordV1[]
    ).map((placement) => [placement.key, placement])
  );

function stableHashV1(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableIndexV1(seed: string, size: number): number {
  if (size <= 0) {
    return 0;
  }
  return stableHashV1(seed) % size;
}

function distance2V1(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

export function harthmereProductionPlacementKeyV1(
  source: string,
  id: string
) {
  return `${source}:${id}`;
}

export function getHarthmereProductionPlacementByKeyV1(
  key: string | undefined
): HarthmereProductionPlacementRecordV1 | undefined {
  return key ? PLACEMENTS_BY_KEY_V1.get(key) : undefined;
}

export function resolveHarthmereProductionMarkerPositionV1(input: {
  source?: string;
  markerId: string | undefined;
  fallback: Vec3;
}): Vec3 {
  if (!input.markerId) {
    return input.fallback;
  }
  const placement = getHarthmereProductionPlacementByKeyV1(
    harthmereProductionPlacementKeyV1(
      input.source ?? "jobs_board_marker",
      input.markerId
    )
  );
  return placement?.recommendedPosition ?? input.fallback;
}

export function getHarthmereQuestObjectivePlacementKeyV1(
  questId: string,
  objectiveId: string
) {
  return harthmereProductionPlacementKeyV1(
    "quest_objective",
    `${questId}:${objectiveId}`
  );
}

export function getHarthmereQuestLocationPlacementKeyV1(questId: string) {
  return harthmereProductionPlacementKeyV1("quest_location", questId);
}

export function resolveHarthmereQuestObjectivePlacementV1(input: {
  questId: string;
  objectiveId?: string;
  fallback: Vec3;
  purpose?: HarthmereProductionPlacementPurposeV1;
}): HarthmereProductionPlacementRecordV1 {
  const exact = input.objectiveId
    ? getHarthmereProductionPlacementByKeyV1(
        getHarthmereQuestObjectivePlacementKeyV1(
          input.questId,
          input.objectiveId
        )
      )
    : undefined;
  const questLocation = getHarthmereProductionPlacementByKeyV1(
    getHarthmereQuestLocationPlacementKeyV1(input.questId)
  );
  const fallbackPlacement = exact ?? questLocation;
  if (fallbackPlacement) {
    return fallbackPlacement;
  }
  return {
    key: harthmereProductionPlacementKeyV1(
      "fallback",
      input.objectiveId
        ? `${input.questId}:${input.objectiveId}`
        : input.questId
    ),
    source: "fallback",
    id: input.objectiveId ?? input.questId,
    label: input.objectiveId ?? input.questId,
    purpose: input.purpose ?? "quest_marker",
    authoredPosition: input.fallback,
    worldPosition: input.fallback,
    recommendedPosition: input.fallback,
    placementMode: "fallback_authored_y",
    notes:
      "No production placement-map record was generated for this quest coordinate.",
  };
}

export function findNearestHarthmereProductionPlacementV1(
  position: Vec3,
  options: {
    purpose?: HarthmereProductionPlacementPurposeV1;
    maxDistance?: number;
  } = {}
): HarthmereProductionPlacementRecordV1 | undefined {
  const maxDistance2 =
    options.maxDistance === undefined
      ? Number.POSITIVE_INFINITY
      : options.maxDistance * options.maxDistance;
  let best:
    | { placement: HarthmereProductionPlacementRecordV1; distance2: number }
    | undefined;
  for (const placement of HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1.placements) {
    if (options.purpose && placement.purpose !== options.purpose) {
      continue;
    }
    const distance2 = distance2V1(position, placement.recommendedPosition);
    if (distance2 > maxDistance2) {
      continue;
    }
    if (!best || distance2 < best.distance2) {
      best = { placement, distance2 };
    }
  }
  return best?.placement;
}

export function chooseHarthmereQuestCaveSpawnPointV1(input: {
  caveId?: string;
  seed: string;
}): HarthmereProductionCaveSpawnPointV1 | undefined {
  const caves = input.caveId
    ? HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1.caves.filter(
        (cave) => cave.caveId === input.caveId
      )
    : HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1.caves;
  const spawnPoints = caves.flatMap((cave) => cave.spawnPoints);
  return spawnPoints[stableIndexV1(input.seed, spawnPoints.length)];
}

export function chooseHarthmereQuestOutdoorSpawnPointV1(input: {
  areaId?: string;
  seed: string;
}): HarthmereProductionOutdoorSpawnPointV1 | undefined {
  const points = input.areaId
    ? HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1.outdoorSpawnPoints.filter(
        (point) => point.areaId === input.areaId
      )
    : HARTHMERE_PRODUCTION_PLACEMENT_MAP_V1.outdoorSpawnPoints;
  return points[stableIndexV1(input.seed, points.length)];
}

export function chooseHarthmereQuestPlacementPositionV1(input: {
  seed: string;
  mode: "outdoor" | "cave";
  areaId?: string;
  caveId?: string;
  fallback: Vec3;
}): Vec3 {
  if (input.mode === "cave") {
    return (
      chooseHarthmereQuestCaveSpawnPointV1(input)?.position ?? input.fallback
    );
  }
  return (
    chooseHarthmereQuestOutdoorSpawnPointV1(input)?.position ?? input.fallback
  );
}
