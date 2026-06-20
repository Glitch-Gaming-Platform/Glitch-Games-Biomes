// Harthmere snapshot coordinate transform current.
//
// Harthmere content is authored in local-town coordinates, while the
// snapshot-connected world shifts the town by a default +512 X offset so it
// no longer overlaps the imported snapshot terrain. Keep the authored
// content stable and convert to world coordinates at the boundary where UI,
// quests, maps, and runtime hints need real positions.

import type { ReadonlyVec2, ReadonlyVec3, Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_COORDINATE_TRANSFORM_VERSION =
  "harthmere-coordinate-transform";

export const HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_X = 512;
export const HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_Z = 0;

export interface HarthmereExtraTownOffset {
  x: number;
  z: number;
}

function parseOffset(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envValue(key: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env?.[key];
}

export function getHarthmereDefaultExtraTownOffset(): HarthmereExtraTownOffset {
  return {
    x: parseOffset(
      envValue("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X"),
      HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_X,
    ),
    z: parseOffset(
      envValue("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z"),
      HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_Z,
    ),
  };
}

export function shiftHarthmereAuthoredXZToWorld(
  xz: ReadonlyVec2,
  offset = getHarthmereDefaultExtraTownOffset(),
): Vec2 {
  return [xz[0] + offset.x, xz[1] + offset.z];
}

export function shiftHarthmereAuthoredPositionToWorld(
  pos: ReadonlyVec3,
  offset = getHarthmereDefaultExtraTownOffset(),
): Vec3 {
  return [pos[0] + offset.x, pos[1], pos[2] + offset.z];
}

export function unshiftHarthmereWorldPositionToAuthored(
  pos: ReadonlyVec3,
  offset = getHarthmereDefaultExtraTownOffset(),
): Vec3 {
  return [pos[0] - offset.x, pos[1], pos[2] - offset.z];
}

export function getHarthmereWorldMapBounds(offset = getHarthmereDefaultExtraTownOffset()) {
  const min = shiftHarthmereAuthoredPositionToWorld([392, 54, -288], offset);
  const max = shiftHarthmereAuthoredPositionToWorld([608, 54, -104], offset);
  return {
    minX: Math.min(min[0], max[0]),
    maxX: Math.max(min[0], max[0]),
    minZ: Math.min(min[2], max[2]),
    maxZ: Math.max(min[2], max[2]),
  };
}
