import { blockPos, voxelShard } from "@/shared/game/shard";
import { blockIsEmptyInTensor } from "@/shared/game/terrain_helper";
import {
  findHarthmereGroundFeetYV1,
  findHarthmereGroundFeetYWithStatusV1,
  type HarthmereGroundResultV1,
} from "@/shared/harthmere/harthmere_entity_grounding_v1";
import type { Vec3 } from "@/shared/math/types";

// HARTHMERE_ENTITY_GROUNDING (client adapter)
//
// The single client-side terrain probe used to ground every positioned thing.
// A voxel counts as STANDABLE SUPPORT when it is solid terrain OR water — so an
// entity rests ON the water surface (water below, air above) and is never
// dropped onto the lake bed underwater. Unloaded shards read as solid so we keep
// the authored Y rather than grounding onto terrain that isn't loaded yet.
//
// `deps` is typed loosely because both ClientResources and ClientResourceDeps
// expose the same `get("/terrain/tensor"|"/water/tensor", shardId)` accessor.

export function harthmereTerrainSupportsStandingV1(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  y: number,
  z: number
): boolean {
  try {
    const block: Vec3 = [x, y, z];
    const shard = voxelShard(...block);
    if (!blockIsEmptyInTensor(block, deps.get("/terrain/tensor", shard))) {
      return true;
    }
    const water = deps.get("/water/tensor", shard);
    return water !== undefined && Number(water.get(...blockPos(...block))) > 0;
  } catch {
    return false;
  }
}

// Returns the grounded feet-Y for an entity at (x,z) anchored at `hintY`.
// requireOpenSky = true keeps OUTDOOR entities out of caves; pass false for an
// entity standing on a deliberately enclosed floor (e.g. a business owner).
export function groundHarthmereLiveEntityFeetYV1(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  z: number,
  hintY: number,
  requireOpenSky: boolean
): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(hintY)) {
    return undefined;
  }
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  return findHarthmereGroundFeetYV1(
    (sx, sy, sz) => harthmereTerrainSupportsStandingV1(deps, sx, sy, sz),
    ix,
    iz,
    { hintY: Math.round(hintY), requireOpenSky }
  );
}

// True when the terrain shard covering (x,y,z) has streamed in. Used to tell
// "no surface here" apart from "terrain not loaded yet" so callers can defer a
// marker instead of leaving it at the unverified authored Y.
export function harthmereTerrainColumnLoadedV1(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  y: number,
  z: number
): boolean {
  try {
    const shard = voxelShard(Math.floor(x), Math.floor(y), Math.floor(z));
    return deps.get("/terrain/tensor", shard) !== undefined;
  } catch {
    return false;
  }
}

// Tri-state grounding for the renderer: distinguishes grounded / no-surface /
// not-loaded so a quest marker can be hidden (and retried) while its terrain is
// still streaming, instead of being stamped at the flat authored Y where it
// floats above or sinks below the real ground.
export function groundHarthmereLiveEntityFeetYWithStatusV1(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  z: number,
  hintY: number,
  requireOpenSky: boolean
): HarthmereGroundResultV1 {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(hintY)) {
    return { status: "no-surface" };
  }
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  return findHarthmereGroundFeetYWithStatusV1(
    (sx, sy, sz) => harthmereTerrainSupportsStandingV1(deps, sx, sy, sz),
    (sx, sy, sz) => harthmereTerrainColumnLoadedV1(deps, sx, sy, sz),
    ix,
    iz,
    { hintY: Math.round(hintY), requireOpenSky }
  );
}
