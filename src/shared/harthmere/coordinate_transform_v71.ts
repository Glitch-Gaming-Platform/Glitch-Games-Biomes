// Harthmere snapshot coordinate transform v71.
//
// Harthmere content is authored in local-town coordinates, while the
// snapshot-connected world shifts the town by a default +512 X offset so it
// no longer overlaps the imported snapshot terrain. Keep the authored
// content stable and convert to world coordinates at the boundary where UI,
// quests, maps, and runtime hints need real positions.

import type { ReadonlyVec2, ReadonlyVec3, Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_COORDINATE_TRANSFORM_VERSION_V71 =
  "harthmere-coordinate-transform-v71";

export const HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_X_V71 = 512;
export const HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_Z_V71 = 0;

export interface HarthmereExtraTownOffsetV71 {
  x: number;
  z: number;
}

function parseOffsetV71(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envValueV71(key: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env?.[key];
}

export function getHarthmereDefaultExtraTownOffsetV71(): HarthmereExtraTownOffsetV71 {
  return {
    x: parseOffsetV71(
      envValueV71("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X"),
      HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_X_V71,
    ),
    z: parseOffsetV71(
      envValueV71("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z"),
      HARTHMERE_DEFAULT_EXTRA_TOWN_OFFSET_Z_V71,
    ),
  };
}

export function shiftHarthmereAuthoredXZToWorldV71(
  xz: ReadonlyVec2,
  offset = getHarthmereDefaultExtraTownOffsetV71(),
): Vec2 {
  return [xz[0] + offset.x, xz[1] + offset.z];
}

export function shiftHarthmereAuthoredPositionToWorldV71(
  pos: ReadonlyVec3,
  offset = getHarthmereDefaultExtraTownOffsetV71(),
): Vec3 {
  return [pos[0] + offset.x, pos[1], pos[2] + offset.z];
}

export function unshiftHarthmereWorldPositionToAuthoredV71(
  pos: ReadonlyVec3,
  offset = getHarthmereDefaultExtraTownOffsetV71(),
): Vec3 {
  return [pos[0] - offset.x, pos[1], pos[2] - offset.z];
}

export function getHarthmereWorldMapBoundsV71(offset = getHarthmereDefaultExtraTownOffsetV71()) {
  const min = shiftHarthmereAuthoredPositionToWorldV71([392, 54, -288], offset);
  const max = shiftHarthmereAuthoredPositionToWorldV71([608, 54, -104], offset);
  return {
    minX: Math.min(min[0], max[0]),
    maxX: Math.max(min[0], max[0]),
    minZ: Math.min(min[2], max[2]),
    maxZ: Math.max(min[2], max[2]),
  };
}
