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

// HARTHMERE_NPC_GROUNDED_FEET_RESOLVE_V151:
// Pure resolver shared by the moving-NPC grounding path (kill-target muck
// monsters, the muck boss, wandering town NPCs). It applies the same
// "defer until terrain is loaded" rule the static quest-object markers use, and
// additionally remembers the last REAL surface grounded for a column so an
// entity that already settled on the breach floor (e.g. West Muck Breach ~Y14)
// does not pop back up to the flat authored Y (~53) when its terrain shard
// briefly unloads. That pop is what made kill targets appear floating/buried —
// visible above ground from afar, then sunk below ground up close.
//
// Returns the feetY to apply (undefined = keep the entity's authored/current Y)
// and the cache value to retain for this column.
export function resolveHarthmereNpcGroundedFeetYV1(
  result: HarthmereGroundResultV1,
  cachedFeetY: number | undefined
): { feetY: number | undefined; cache: number | undefined } {
  if (result.status === "grounded" && result.feetY !== undefined) {
    return { feetY: result.feetY, cache: result.feetY };
  }
  if (result.status === "not-loaded") {
    // Terrain has not streamed in: reuse the last real surface for this column
    // if we have one; otherwise keep the authored Y (undefined) and retry next
    // frame once the shard loads.
    return { feetY: cachedFeetY, cache: cachedFeetY };
  }
  // "no-surface": terrain is loaded but genuinely has no standable column here.
  // Keep the authored Y as a best-effort fallback and do not poison the cache.
  return { feetY: undefined, cache: cachedFeetY };
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

// Generic alias: the keep-last-surface resolver is NOT npc-specific — items,
// drops, the escort follower, and markers all use it so nothing ever floats or
// buries. Prefer this name for non-npc callers.
export const resolveHarthmereGroundedFeetYV1 = resolveHarthmereNpcGroundedFeetYV1;

// HARTHMERE_GROUNDED_FEET_WITH_MEMORY_V151:
// THE single "ground any world-placed thing so it is always visible — never
// floating, never buried" entrypoint. Used by NPCs (cows/sheep/hexes/muckers/
// owners), dropped & quest items, gather/quest-object markers, and the escort
// follower. It runs the one voxel-aware tri-state probe and applies the one
// keep-last-surface rule, with a per-caller persistent column cache so a thing
// that already settled on the real surface does not pop to the authored Y while
// its terrain shard streams. Returns the feet-Y to apply, or undefined to keep
// the caller's authored/current Y (terrain genuinely unknown).
export function harthmereGroundedFeetYWithMemoryV1(
  deps: { get: (path: any, shard: any) => any },
  cache: Map<string, number>,
  x: number,
  z: number,
  hintY: number,
  requireOpenSky: boolean
): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(hintY)) {
    return undefined;
  }
  const key = `${Math.floor(x)}|${Math.floor(z)}|${requireOpenSky ? 1 : 0}`;
  const status = groundHarthmereLiveEntityFeetYWithStatusV1(
    deps,
    x,
    z,
    hintY,
    requireOpenSky
  );
  const { feetY, cache: nextCache } = resolveHarthmereGroundedFeetYV1(
    status,
    cache.get(key)
  );
  if (nextCache === undefined) {
    cache.delete(key);
  } else {
    cache.set(key, nextCache);
  }
  return feetY;
}
