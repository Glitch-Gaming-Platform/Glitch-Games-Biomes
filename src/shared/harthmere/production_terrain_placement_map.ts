import type { Vec3 } from "@/shared/math/types";
import { HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP } from "@/shared/harthmere/generated/production_terrain_placement_map";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";

export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_VERSION =
  "harthmere-production-terrain-placement-map" as const;

export type HarthmereProductionPlacementPurpose =
  | "quest_item"
  | "quest_marker"
  | "monster"
  | "npc"
  | "interactable"
  | "spawn_pool";

export type HarthmereProductionPlacementMode =
  | "outdoor_surface"
  | "indoor_or_cave_floor"
  | "cave_spawn"
  | "fallback_authored_y";

export interface HarthmereProductionPlacementBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface HarthmereProductionPlacementRecord {
  key: string;
  source: string;
  id: string;
  label: string;
  purpose: HarthmereProductionPlacementPurpose;
  authoredPosition: Vec3;
  worldPosition: Vec3;
  recommendedPosition: Vec3;
  placementMode: HarthmereProductionPlacementMode;
  surfaceFeetY?: number;
  nearestFeetY?: number;
  caveFeetYs?: readonly number[];
  deltaY?: number;
  caveId?: string;
  notes?: string;
}

export interface HarthmereProductionCaveSpawnPoint {
  position: Vec3;
  floorFeetY: number;
  clearance: number;
  score: number;
}

export interface HarthmereProductionCaveRecord {
  caveId: string;
  label: string;
  bounds: HarthmereProductionPlacementBounds;
  sampleCount: number;
  floorYMin: number;
  floorYMax: number;
  ceilingYMin: number;
  ceilingYMax: number;
  entranceCandidates: readonly Vec3[];
  spawnPoints: readonly HarthmereProductionCaveSpawnPoint[];
}

export interface HarthmereProductionOutdoorSpawnPoint {
  id: string;
  position: Vec3;
  areaId?: string;
  score: number;
}

export interface HarthmereProductionTerrainPlacementMap {
  version: typeof HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_VERSION;
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
    bounds: HarthmereProductionPlacementBounds;
    stride: number;
    scannedRedisKeys: number;
    resolvedTerrainShards: number;
    targetTerrainShards: number;
  };
  placements: readonly HarthmereProductionPlacementRecord[];
  caves: readonly HarthmereProductionCaveRecord[];
  outdoorSpawnPoints: readonly HarthmereProductionOutdoorSpawnPoint[];
}

export const HARTHMERE_PRODUCTION_PLACEMENT_MAP =
  HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP;

const PLACEMENTS_BY_KEY: Map<string, HarthmereProductionPlacementRecord> =
  new Map(
    (
      HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements as readonly HarthmereProductionPlacementRecord[]
    ).map((placement) => [placement.key, placement])
  );

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableIndex(seed: string, size: number): number {
  if (size <= 0) {
    return 0;
  }
  return stableHash(seed) % size;
}

function horizontalDistanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

export function harthmereProductionPlacementKey(source: string, id: string) {
  return `${source}:${id}`;
}

export function getHarthmereProductionPlacementByKey(
  key: string | undefined
): HarthmereProductionPlacementRecord | undefined {
  return key ? PLACEMENTS_BY_KEY.get(key) : undefined;
}

export function resolveHarthmereProductionMarkerPosition(input: {
  source?: string;
  markerId: string | undefined;
  fallback: Vec3;
}): Vec3 {
  if (!input.markerId) {
    return input.fallback;
  }
  const placement = getHarthmereProductionPlacementByKey(
    harthmereProductionPlacementKey(
      input.source ?? "jobs_board_marker",
      input.markerId
    )
  );
  const recommended = placement?.recommendedPosition;
  if (!recommended) {
    return input.fallback;
  }
  // ADDITIVE_HARTHMERE_MARKER_PLACEMENT:
  // The checked-in production placement map predates the +1600 extension. A
  // shifted canonical fallback must never be replaced by a legacy coordinate
  // west of the old map boundary. This protects helper quests, jobs-board
  // targets, business markers, HUD pins, and persisted building markers that
  // all share this resolver. A future placement map generated in the extension
  // can still refine Y because its recommended X will also be in the new band.
  if (
    input.fallback[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    recommended[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X
  ) {
    return input.fallback;
  }
  return recommended;
}

export function getHarthmereQuestObjectivePlacementKey(
  questId: string,
  objectiveId: string
) {
  return harthmereProductionPlacementKey(
    "quest_objective",
    `${questId}:${objectiveId}`
  );
}

export function getHarthmereQuestLocationPlacementKey(questId: string) {
  return harthmereProductionPlacementKey("quest_location", questId);
}

export function resolveHarthmereQuestObjectivePlacement(input: {
  questId: string;
  objectiveId?: string;
  fallback: Vec3;
  purpose?: HarthmereProductionPlacementPurpose;
}): HarthmereProductionPlacementRecord {
  const exact = input.objectiveId
    ? getHarthmereProductionPlacementByKey(
        getHarthmereQuestObjectivePlacementKey(input.questId, input.objectiveId)
      )
    : undefined;
  const questLocation = getHarthmereProductionPlacementByKey(
    getHarthmereQuestLocationPlacementKey(input.questId)
  );
  const fallbackPlacement = exact ?? questLocation;
  if (fallbackPlacement) {
    // The generated placement map was measured against the retired +512 town
    // terrain. Keep its identity/purpose metadata, but never let those stale
    // X/Y coordinates pull an additive-extension quest back onto the old map.
    return {
      ...fallbackPlacement,
      worldPosition: input.fallback,
      recommendedPosition: input.fallback,
      surfaceFeetY: input.fallback[1] >= 0 ? input.fallback[1] : undefined,
      nearestFeetY: input.fallback[1],
      deltaY: 0,
      notes:
        "Additive Harthmere extension: coordinate resolved from the shared authored-to-world transform; legacy +512 terrain scan retained for metadata only.",
    };
  }
  return {
    key: harthmereProductionPlacementKey(
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

export function findNearestHarthmereProductionPlacement(
  position: Vec3,
  options: {
    purpose?: HarthmereProductionPlacementPurpose;
    maxDistance?: number;
  } = {}
): HarthmereProductionPlacementRecord | undefined {
  const maxDistance2 =
    options.maxDistance === undefined
      ? Number.POSITIVE_INFINITY
      : options.maxDistance * options.maxDistance;
  let best:
    | { placement: HarthmereProductionPlacementRecord; distance2: number }
    | undefined;
  for (const placement of HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements) {
    if (options.purpose && placement.purpose !== options.purpose) {
      continue;
    }
    const distance2 = horizontalDistanceSquared(
      position,
      placement.recommendedPosition
    );
    if (distance2 > maxDistance2) {
      continue;
    }
    if (!best || distance2 < best.distance2) {
      best = { placement, distance2 };
    }
  }
  return best?.placement;
}

export function chooseHarthmereQuestCaveSpawnPoint(input: {
  caveId?: string;
  seed: string;
}): HarthmereProductionCaveSpawnPoint | undefined {
  const caves = input.caveId
    ? HARTHMERE_PRODUCTION_PLACEMENT_MAP.caves.filter(
        (cave) => cave.caveId === input.caveId
      )
    : HARTHMERE_PRODUCTION_PLACEMENT_MAP.caves;
  const spawnPoints: HarthmereProductionCaveSpawnPoint[] = caves.flatMap(
    (cave) => [...cave.spawnPoints]
  );
  return spawnPoints[stableIndex(input.seed, spawnPoints.length)];
}

export function chooseHarthmereQuestOutdoorSpawnPoint(input: {
  areaId?: string;
  seed: string;
}): HarthmereProductionOutdoorSpawnPoint | undefined {
  const allPoints =
    HARTHMERE_PRODUCTION_PLACEMENT_MAP.outdoorSpawnPoints as readonly HarthmereProductionOutdoorSpawnPoint[];
  const points: HarthmereProductionOutdoorSpawnPoint[] = input.areaId
    ? allPoints.filter((point) => point.areaId === input.areaId)
    : [...allPoints];
  return points[stableIndex(input.seed, points.length)];
}

export function chooseHarthmereQuestPlacementPosition(input: {
  seed: string;
  mode: "outdoor" | "cave";
  areaId?: string;
  caveId?: string;
  fallback: Vec3;
}): Vec3 {
  if (input.mode === "cave") {
    return (
      chooseHarthmereQuestCaveSpawnPoint(input)?.position ?? input.fallback
    );
  }
  return (
    chooseHarthmereQuestOutdoorSpawnPoint(input)?.position ?? input.fallback
  );
}
