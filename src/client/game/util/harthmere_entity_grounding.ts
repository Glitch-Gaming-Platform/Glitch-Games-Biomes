import { blockPos, voxelShard } from "@/shared/game/shard";
import { blockIsEmptyInTensor } from "@/shared/game/terrain_helper";
import {
  findHarthmereGroundFeetY,
  findHarthmereGroundFeetYWithStatus,
  type HarthmereGroundResult,
} from "@/shared/harthmere/harthmere_entity_grounding";
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

export function harthmereTerrainSupportsStanding(
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
export function groundHarthmereLiveEntityFeetY(
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
  return findHarthmereGroundFeetY(
    (sx, sy, sz) => harthmereTerrainSupportsStanding(deps, sx, sy, sz),
    ix,
    iz,
    { hintY: Math.round(hintY), requireOpenSky }
  );
}

// HARTHMERE_SERVER_LINE_OF_SIGHT client sampler (audit fix, 2026-07-13):
// solid-BLOCK check for sight blocking. Unlike
// `harthmereTerrainSupportsStanding`, water does NOT block sight, and an
// unloaded shard reads as NON-solid (fail open — never blind combat AI while
// terrain streams).
export function harthmereTerrainBlocksSight(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  y: number,
  z: number
): boolean {
  try {
    const block: Vec3 = [x, y, z];
    const shard = voxelShard(...block);
    const tensor = deps.get("/terrain/tensor", shard);
    if (tensor === undefined) return false;
    return !blockIsEmptyInTensor(block, tensor);
  } catch {
    return false;
  }
}

// True when the terrain shard covering (x,y,z) has streamed in. Used to tell
// "no surface here" apart from "terrain not loaded yet" so callers can defer a
// marker instead of leaving it at the unverified authored Y.
export function harthmereTerrainColumnLoaded(
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

// HARTHMERE_NPC_GROUNDED_FEET_RESOLVE:
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
export function resolveHarthmereNpcGroundedFeetY(
  result: HarthmereGroundResult,
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
export function groundHarthmereLiveEntityFeetYWithStatus(
  deps: { get: (path: any, shard: any) => any },
  x: number,
  z: number,
  hintY: number,
  requireOpenSky: boolean
): HarthmereGroundResult {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(hintY)) {
    return { status: "no-surface" };
  }
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  return findHarthmereGroundFeetYWithStatus(
    (sx, sy, sz) => harthmereTerrainSupportsStanding(deps, sx, sy, sz),
    (sx, sy, sz) => harthmereTerrainColumnLoaded(deps, sx, sy, sz),
    ix,
    iz,
    { hintY: Math.round(hintY), requireOpenSky }
  );
}

// Generic alias: the keep-last-surface resolver is NOT npc-specific — items,
// drops, the escort follower, and markers all use it so nothing ever floats or
// buries. Prefer this name for non-npc callers.
export const resolveHarthmereGroundedFeetY = resolveHarthmereNpcGroundedFeetY;

// HARTHMERE_GROUNDED_FEET_WITH_MEMORY:
// THE single "ground any world-placed thing so it is always visible — never
// floating, never buried" entrypoint. Used by NPCs (cows/sheep/hexes/muckers/
// owners), dropped & quest items, gather/quest-object markers, and the escort
// follower. It runs the one voxel-aware tri-state probe and applies the one
// keep-last-surface rule, with a per-caller persistent column cache so a thing
// that already settled on the real surface does not pop to the authored Y while
// its terrain shard streams. Returns the feet-Y to apply, or undefined to keep
// the caller's authored/current Y (terrain genuinely unknown).
export function harthmereGroundedFeetYWithMemory(
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
  const status = groundHarthmereLiveEntityFeetYWithStatus(
    deps,
    x,
    z,
    hintY,
    requireOpenSky
  );
  const { feetY, cache: nextCache } = resolveHarthmereGroundedFeetY(
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

// ---------------------------------------------------------------------------
// HARTHMERE_GLOBAL_GROUNDING_DEPS (audit fix, 2026-07-13)
//
// Some world-placing modules (notably the runtime-assets NPC renderer,
// `renderers/local_dev/harthmere_assets.ts`) are constructed WITHOUT client
// resources, so they historically could not run the shared terrain probe and
// instead froze every actor at its spawn Y — NPCs walking across a slope
// visibly floated (downhill) or buried (uphill). Registering the resources
// object once at renderer-build time lets ANY module run the one shared
// tri-state probe without threading `deps` through every constructor.
// ---------------------------------------------------------------------------

let harthmereGlobalGroundingDeps:
  | { get: (path: any, shard: any) => any }
  | undefined;

// Called once from `buildRenderers` (client boot) with the live resources
// object. Safe to call again (e.g. after a hot reload) — last writer wins.
export function registerHarthmereGroundingDeps(deps: {
  get: (path: any, shard: any) => any;
}) {
  harthmereGlobalGroundingDeps = deps;
}

// Test-only escape hatch so unit tests can install a fake terrain sampler and
// restore the previous one.
export function harthmereGroundingDepsForTest() {
  return harthmereGlobalGroundingDeps;
}

// The `harthmereGroundedFeetYWithMemory` entrypoint for modules without their
// own `deps`. Returns undefined when no deps are registered yet (client still
// booting) or the terrain column is unknown — callers keep their current Y.
export function harthmereRendererGroundedFeetY(
  cache: Map<string, number>,
  x: number,
  z: number,
  hintY: number,
  requireOpenSky: boolean
): number | undefined {
  if (!harthmereGlobalGroundingDeps) {
    return undefined;
  }
  return harthmereGroundedFeetYWithMemory(
    harthmereGlobalGroundingDeps,
    cache,
    x,
    z,
    hintY,
    requireOpenSky
  );
}

// ---------------------------------------------------------------------------
// HARTHMERE_NPC_WANDER_REGROUNDING helpers (audit fix, 2026-07-13)
//
// Pure decision logic for re-grounding a MOVING renderer NPC. Kept here (not
// in the renderer) so it is unit-testable and shared: the renderer feeds in
// (baseY = legacy locked spawn Y, currentY = actor's current Y, probedY = what
// the tri-state terrain probe returned for the destination column) and gets
// back the feet Y to apply.
// ---------------------------------------------------------------------------

// Reject probe results further than this from the actor's current Y: a real
// slope changes gradually per wander step, so a larger jump means the probe
// found an unrelated surface (cave under a bridge, terrain under a mesh floor).
export const HARTHMERE_NPC_REGROUND_MAX_DEVIATION = 6;
// Max vertical movement per grounding call so re-grounding reads as walking
// up/down the slope instead of snapping.
export const HARTHMERE_NPC_REGROUND_MAX_STEP = 0.4;

// Move `currentY` toward `targetY` by at most `maxStep`, landing exactly on
// the target when close.
export function harthmereStepTowardGroundedFeetY(
  currentY: number,
  targetY: number,
  maxStep = HARTHMERE_NPC_REGROUND_MAX_STEP
): number {
  if (!Number.isFinite(currentY)) return targetY;
  if (!Number.isFinite(targetY)) return currentY;
  const delta = targetY - currentY;
  if (Math.abs(delta) <= maxStep) return targetY;
  return currentY + Math.sign(delta) * maxStep;
}

// Acceptance rule: use the probe when it is plausible for a walking actor,
// otherwise fall back to the legacy locked base Y (never teleport).
export function resolveHarthmereNpcRegroundedFeetY(
  baseY: number,
  currentY: number,
  probedY: number | undefined
): number {
  const fromY = Number.isFinite(currentY) ? currentY : baseY;
  if (
    probedY === undefined ||
    !Number.isFinite(probedY) ||
    Math.abs(probedY - fromY) > HARTHMERE_NPC_REGROUND_MAX_DEVIATION
  ) {
    return baseY;
  }
  return harthmereStepTowardGroundedFeetY(fromY, probedY);
}

// ---------------------------------------------------------------------------
// HARTHMERE_GROUNDED_COLUMN_INVALIDATION (audit fix, 2026-07-13)
//
// Every keep-last-surface column cache (NPCs, drops, markers, the renderer
// wander cache) remembers "the real ground at (x,z) is Y". None of them were
// invalidated when the player MINED or PLACED blocks, so mining the ground
// under an NPC/drop left it floating on the remembered surface until reload.
// Modules register their caches here; the terrain-edit path calls
// `invalidateHarthmereGroundedColumnsNear` for the edited block.
//
// Cache keys follow the shared `${ix}|${iz}|${openSky}` convention from
// `harthmereGroundedFeetYWithMemory`; caches with richer keys can register a
// custom invalidator instead.
// ---------------------------------------------------------------------------

type HarthmereColumnInvalidator = (ix: number, iz: number) => void;

const harthmereGroundedColumnCaches = new Set<Map<string, number>>();
const harthmereGroundedColumnInvalidators =
  new Set<HarthmereColumnInvalidator>();

// Register a standard `${ix}|${iz}|${openSky}` column cache for edit
// invalidation. Returns an unregister function (for tests / HMR).
export function registerHarthmereGroundedColumnCache(
  cache: Map<string, number>
): () => void {
  harthmereGroundedColumnCaches.add(cache);
  return () => harthmereGroundedColumnCaches.delete(cache);
}

// Register a custom invalidator for caches with non-standard keys (e.g. the
// NPC ground-probe cache keyed `${ix}|${iy}|${iz}|${openSky}`).
export function registerHarthmereGroundedColumnInvalidator(
  invalidate: HarthmereColumnInvalidator
): () => void {
  harthmereGroundedColumnInvalidators.add(invalidate);
  return () => harthmereGroundedColumnInvalidators.delete(invalidate);
}

// Drop the remembered surface for every column within `radius` blocks of the
// edited voxel so the next probe re-reads the real terrain. Radius 1 covers
// the edited column plus neighbours whose support may have changed (an entity
// standing on the edge of the mined block).
export function invalidateHarthmereGroundedColumnsNear(
  x: number,
  z: number,
  radius = 1
) {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  for (let ix = cx - radius; ix <= cx + radius; ix += 1) {
    for (let iz = cz - radius; iz <= cz + radius; iz += 1) {
      for (const cache of harthmereGroundedColumnCaches) {
        cache.delete(`${ix}|${iz}|0`);
        cache.delete(`${ix}|${iz}|1`);
      }
      for (const invalidate of harthmereGroundedColumnInvalidators) {
        invalidate(ix, iz);
      }
    }
  }
}
