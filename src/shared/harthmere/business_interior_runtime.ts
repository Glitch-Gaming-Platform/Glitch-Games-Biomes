import businessInteriorManifest from "../../../public/assets/harthmere/manifest/business-interiors.json";
import type { HarthmereEconomyBusinessTypeId } from "./mmo_economy_authority";
import type { BiomesId } from "../ids";
import type { Vec3 } from "../math/types";

export const HARTHMERE_BUSINESS_INTERIOR_RUNTIME_VERSION =
  "harthmere-business-interior-runtime-v1" as const;

export type HarthmereBusinessInteriorManifestRecord =
  (typeof businessInteriorManifest.businesses)[number];

export type HarthmereBusinessCustomerWorldPhase =
  | "spawning"
  | "entering"
  | "queued"
  | "approaching_counter"
  | "serving"
  | "departing"
  | "despawn_ready"
  | "despawned"
  | "cancelled";

export type HarthmereBusinessCustomerReaction =
  | "neutral"
  | "success"
  | "incorrect"
  | "timeout"
  | "insufficient_stock"
  | "payment";

export interface HarthmereBusinessCustomerSpatialIntent {
  sessionId: string;
  ticketId: string;
  entityId: BiomesId;
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  actorEntityId?: BiomesId;
  phase: HarthmereBusinessCustomerWorldPhase;
  reaction: HarthmereBusinessCustomerReaction;
  spawn: Vec3;
  entrance: Vec3;
  queueTarget: Vec3;
  customer: Vec3;
  staff: Vec3;
  departure: Vec3;
  waypoints: Vec3[];
}

export const HARTHMERE_BUSINESS_INTERIORS: readonly HarthmereBusinessInteriorManifestRecord[] =
  businessInteriorManifest.businesses;

const BUSINESS_INTERIOR_BY_OUTPOST = new Map(
  HARTHMERE_BUSINESS_INTERIORS.map((record) => [record.outpostId, record])
);

const BUSINESS_INTERIOR_BY_TYPE = new Map(
  HARTHMERE_BUSINESS_INTERIORS.map((record) => [
    record.businessType as HarthmereEconomyBusinessTypeId,
    record,
  ])
);

export function harthmereBusinessInteriorForOutpost(outpostId: string) {
  return BUSINESS_INTERIOR_BY_OUTPOST.get(outpostId);
}

export function harthmereBusinessInteriorForType(
  businessType: HarthmereEconomyBusinessTypeId
) {
  return BUSINESS_INTERIOR_BY_TYPE.get(businessType);
}

export interface HarthmereBusinessInteriorWorldPosition {
  x: number;
  y?: number;
  z: number;
}

export function harthmereBusinessInteriorContainsPosition(
  record: HarthmereBusinessInteriorManifestRecord,
  position: HarthmereBusinessInteriorWorldPosition
) {
  const minX = record.assetWorldAnchor[0];
  const minY = record.assetWorldAnchor[1] - 1;
  const minZ = record.assetWorldAnchor[2];
  const maxX = minX + record.footprint.width;
  const maxY = record.assetWorldAnchor[1] + record.footprint.floors * 4 + 1;
  const maxZ = minZ + record.footprint.depth;
  return (
    position.x >= minX &&
    position.x < maxX &&
    position.z >= minZ &&
    position.z < maxZ &&
    (position.y === undefined || (position.y >= minY && position.y < maxY))
  );
}

export function harthmereBusinessInteriorContainingPosition(
  position: HarthmereBusinessInteriorWorldPosition | undefined
) {
  return position
    ? HARTHMERE_BUSINESS_INTERIORS.find((record) =>
        harthmereBusinessInteriorContainsPosition(record, position)
      )
    : undefined;
}

/**
 * Manifest local coordinates are Blender X/depth-Y/height-Z. Runtime Biomes
 * uses X/height-Y/depth-Z. The manifest's assetWorldAnchor is already the
 * first-floor southwest corner at shellOrigin.y + 1.
 */
export function harthmereBusinessInteriorLocalToWorld(
  record: HarthmereBusinessInteriorManifestRecord,
  local: readonly [number, number, number]
): Vec3 {
  return [
    record.assetWorldAnchor[0] + local[0],
    record.assetWorldAnchor[1] + local[2],
    record.assetWorldAnchor[2] + local[1],
  ];
}

export function harthmereBusinessInteriorInteractionPoints(
  record: HarthmereBusinessInteriorManifestRecord
) {
  return {
    entrance: harthmereBusinessInteriorLocalToWorld(
      record,
      record.interactionPoints.entrance as [number, number, number]
    ),
    queueStart: harthmereBusinessInteriorLocalToWorld(
      record,
      record.interactionPoints.queueStart as [number, number, number]
    ),
    customer: harthmereBusinessInteriorLocalToWorld(
      record,
      record.interactionPoints.customer as [number, number, number]
    ),
    staff: harthmereBusinessInteriorLocalToWorld(
      record,
      record.interactionPoints.staff as [number, number, number]
    ),
  };
}

function cloneVec3(value: readonly number[]): Vec3 {
  return [value[0], value[1], value[2]];
}

function pointAlongDepth(point: Vec3, dz: number): Vec3 {
  return [point[0], point[1], point[2] + dz];
}

export function harthmereBusinessCustomerQueueTarget(
  record: HarthmereBusinessInteriorManifestRecord,
  queueIndex: number
): Vec3 {
  const { customer, queueStart, entrance } =
    harthmereBusinessInteriorInteractionPoints(record);
  if (queueIndex <= 0) return cloneVec3(customer);

  const spacing = 1.55;
  const insideDepth = customer[2] - queueStart[2];
  const insideSlots = Math.max(1, Math.floor(insideDepth / spacing));
  if (queueIndex <= insideSlots) {
    return pointAlongDepth(customer, -spacing * queueIndex);
  }

  // Overflow remains in a spaced line outside the real door instead of
  // compressing the protected aisle or clipping through the counter.
  return pointAlongDepth(entrance, -spacing * (queueIndex - insideSlots + 1));
}

export function harthmereBusinessCustomerSpawnPoint(
  record: HarthmereBusinessInteriorManifestRecord,
  queueIndex: number
): Vec3 {
  const { entrance } = harthmereBusinessInteriorInteractionPoints(record);
  const side = queueIndex % 2 === 0 ? -1 : 1;
  return [
    entrance[0] + side * (2.6 + (queueIndex % 3) * 0.55),
    entrance[1],
    entrance[2] - 9.5 - Math.floor(queueIndex / 2) * 1.4,
  ];
}

export function harthmereBusinessCustomerDeparturePoint(
  record: HarthmereBusinessInteriorManifestRecord,
  queueIndex = 0
): Vec3 {
  const { entrance } = harthmereBusinessInteriorInteractionPoints(record);
  const side = queueIndex % 2 === 0 ? 1 : -1;
  return [entrance[0] + side * 3.4, entrance[1], entrance[2] - 11.5];
}

function hash32(value: string, seed = 2166136261) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SESSION_CUSTOMER_ENTITY_BASE = 8_812_000_000_000_000;
const SESSION_CUSTOMER_ENTITY_RANGE = 180_000_000_000;

export function harthmereBusinessCustomerSessionEntityId(input: {
  actorId: string;
  sessionId: string;
  ticketId: string;
}): BiomesId {
  const key = `${input.actorId}:${input.sessionId}:${input.ticketId}`;
  const high = hash32(key, 2166136261) & 0x1fffff;
  const low = hash32(key, 2246822519);
  const combined = high * 0x1_0000_0000 + low;
  return (SESSION_CUSTOMER_ENTITY_BASE +
    (combined % SESSION_CUSTOMER_ENTITY_RANGE)) as BiomesId;
}

export function createHarthmereBusinessCustomerSpatialIntent(input: {
  record: HarthmereBusinessInteriorManifestRecord;
  sessionId: string;
  ticketId: string;
  entityId: BiomesId;
  queueIndex: number;
  actorEntityId?: BiomesId;
  phase: HarthmereBusinessCustomerWorldPhase;
  reaction?: HarthmereBusinessCustomerReaction;
}): HarthmereBusinessCustomerSpatialIntent {
  const points = harthmereBusinessInteriorInteractionPoints(input.record);
  const spawn = harthmereBusinessCustomerSpawnPoint(
    input.record,
    input.queueIndex
  );
  const queueTarget = harthmereBusinessCustomerQueueTarget(
    input.record,
    input.queueIndex
  );
  const departure = harthmereBusinessCustomerDeparturePoint(
    input.record,
    input.queueIndex
  );
  const routeToQueue = [
    cloneVec3(points.entrance),
    cloneVec3(points.queueStart),
    cloneVec3(queueTarget),
  ];
  const waypoints =
    input.phase === "departing" || input.phase === "cancelled"
      ? [
          cloneVec3(points.queueStart),
          cloneVec3(points.entrance),
          cloneVec3(departure),
        ]
      : input.phase === "approaching_counter"
        ? [cloneVec3(points.customer)]
        : input.phase === "queued"
          ? [cloneVec3(queueTarget)]
          : routeToQueue;
  return {
    sessionId: input.sessionId,
    ticketId: input.ticketId,
    entityId: input.entityId,
    outpostId: input.record.outpostId,
    businessType: input.record.businessType as HarthmereEconomyBusinessTypeId,
    actorEntityId: input.actorEntityId,
    phase: input.phase,
    reaction: input.reaction ?? "neutral",
    spawn,
    entrance: cloneVec3(points.entrance),
    queueTarget,
    customer: cloneVec3(points.customer),
    staff: cloneVec3(points.staff),
    departure,
    waypoints,
  };
}

export function validateHarthmereBusinessInteriorRuntimeContract() {
  const errors: string[] = [];
  if (HARTHMERE_BUSINESS_INTERIORS.length !== 19) {
    errors.push(`business_count:${HARTHMERE_BUSINESS_INTERIORS.length}`);
  }
  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    const points = harthmereBusinessInteriorInteractionPoints(record);
    if (points.customer[2] >= points.staff[2]) {
      errors.push(`${record.outpostId}:counter_sides_invalid`);
    }
    if (
      record.lodPolicy.lod0MaxDistanceMeters !== 16 ||
      record.lodPolicy.lod1MaxDistanceMeters !== 28 ||
      record.lodPolicy.hiddenBeyondMeters !== 28
    ) {
      errors.push(`${record.outpostId}:lod_policy_invalid`);
    }
    const counter = record.collisionBoxes.find(
      (box) => box.role === "service_counter"
    );
    if (!counter) errors.push(`${record.outpostId}:counter_collision_missing`);
  }
  return errors;
}
