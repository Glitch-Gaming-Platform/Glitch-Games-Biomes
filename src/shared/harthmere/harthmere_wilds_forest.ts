// HARTHMERE_WILDS_FOREST
//
// The forest and ground cover for the fields outside Harthmere.
//
// WHY THIS EXISTS
// The additive town's wilds were bare grass. Voxel trees had been removed from
// the shim ("makes shim startup scale badly and can create collision snags"),
// and in snapshot-built mode the GLB tree props are filtered out because the
// voxel terrain is supposed to own trees. Nobody owned them, so nothing grew.
//
// This module owns them, and answers the two objections directly:
//
//   PERFORMANCE. Placement is a pure function of position — a jittered lattice
//   read through a hash, never a global pass over the map. A voxel query looks
//   at the 3x3 lattice cells that could possibly reach it; a one-entry column
//   cache means the shim's inner Y loop resolves those cells once per column
//   rather than once per voxel. No allocation in the hot path, no precomputed
//   tree library, nothing held in memory between shards.
//
//   COLLISION. Every leaf sits at or above HARTHMERE_FOREST_CANOPY_CLEARANCE
//   voxels off the ground, so you walk *under* the canopy. Trunks are one voxel
//   square — a pole, not a wall. Undergrowth is capped at a single voxel, which
//   players step over. The caller excludes roads and the town outright.
//
// WHAT IT FOLLOWS
// The world-anatomy doc, section by section:
//   * 2.2 placement — jittered lattice at spacing 8 with +/-3 jitter (so
//     effective spacing 5..11, Poisson-disk-ish for free), grove and forest
//     masks unioned so you get both dense woodland and scattered copses, and
//     rejection sampling so big trees suppress their neighbours and canopy
//     density self-regulates by species.
//   * 2.1 form — oak grows branches on a phyllotaxis stride with the longest
//     at 70% height; birch splits into two opposed stems; rubber is a
//     candelabra. Canopies are metaball-ish lobes with a noisy, eroded edge
//     rather than clean ellipsoids.
//   * 2.3 ground flora — fine noise decides stipple, coarse noise decides where
//     meadows are, flowers are a strict subset of the grass mask, rare species
//     get a stricter gate, and a thinner punches bare clearings.
//
// The terrain stays perfectly flat. This module never returns a ground voxel;
// it only adds what stands on top of it.

import {
  harthmereExplicitNoise,
  harthmereUpwardBiasedNoise,
} from "@/shared/harthmere/harthmere_horizon_noise";

export const HARTHMERE_WILDS_FOREST_VERSION =
  "harthmere-wilds-forest-v1" as const;

/**
 * Material names, matching keys of the shim's localDevMaterials(). Returning
 * names rather than TerrainIDs keeps this module free of the terrain registry,
 * which is what lets it be unit-tested in milliseconds.
 */
export type HarthmereForestMaterial =
  | "oakLog"
  | "oakLeaf"
  | "birchLog"
  | "birchLeaf"
  | "rubberLog"
  | "rubberLeaf"
  | "moss"
  | "switchGrass"
  | "rose"
  | "dandelion"
  | "sunflower"
  | "hay";

// ---------------------------------------------------------------------------
// Lattice
// ---------------------------------------------------------------------------

/** Doc 2.2: "spacing = 8". */
export const HARTHMERE_FOREST_SPACING = 8;
/** Doc 2.2: "points += 6.0*random() - 3.0" — effective spacing 5..11. */
export const HARTHMERE_FOREST_JITTER = 3;
/**
 * Leaves never appear below this many voxels above the ground.
 *
 * This is the single most important constant in the file. A player is two
 * voxels tall; five gives comfortable headroom plus a jump. It is why a dense
 * forest here does not reproduce the collision snags that got voxel trees
 * removed the first time.
 */
export const HARTHMERE_FOREST_CANOPY_CLEARANCE = 5;
/** No tree part may reach further than this horizontally from its trunk. */
export const HARTHMERE_FOREST_MAX_CANOPY_RADIUS = 5;
/** Tallest anything gets, for the caller's cheap Y early-out. */
export const HARTHMERE_FOREST_MAX_HEIGHT = 22;

export type HarthmereTreeSpecies = "oak" | "birch" | "rubber";

export interface HarthmereForestTree {
  species: HarthmereTreeSpecies;
  /** Jittered trunk position, in the same authored space the caller uses. */
  x: number;
  z: number;
  /** Trunk height in voxels above ground. */
  height: number;
  /** Horizontal reach of the canopy. Drives the rejection test. */
  radius: number;
  /** Per-tree random stream, so no two trees of a species are identical. */
  seed: number;
}

function hash(x: number, z: number, salt: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^
    Math.imul(z | 0, 0x165667b1) ^
    Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

/**
 * Doc 2.2: two overlapping periodic masks — small-period *groves* unioned with
 * large-period *forests*, "so you get both dense woodland and scattered copses".
 */
function pointMask(x: number, z: number): boolean {
  const groves = harthmereUpwardBiasedNoise(
    "harthmere_tree_groves",
    x,
    z,
    512,
    [2, 4, 4, 1, 4, 6]
  );
  const forests = harthmereUpwardBiasedNoise(
    "harthmere_tree_forests",
    x,
    z,
    1024,
    [4, 8, 4, 4, 2, 1]
  );
  return groves > 0.41 || forests > 0.43;
}

/**
 * Species masks subset the point mask, per doc 2.2: oak everywhere inside it,
 * birch common, rubber rare and clustered into groves.
 */
function speciesAt(x: number, z: number, roll: number): HarthmereTreeSpecies {
  const rubber = harthmereUpwardBiasedNoise(
    "harthmere_rubber_tree",
    x,
    z,
    1024,
    [1, 0.5, 0.25]
  );
  if (rubber > 0.72 && roll < 0.7) {
    return "rubber";
  }
  const birch = harthmereUpwardBiasedNoise(
    "harthmere_birch_tree",
    x,
    z,
    512,
    [1, 0.6, 0.3]
  );
  if (birch > 0.5 && roll < 0.55) {
    return "birch";
  }
  return "oak";
}

// Lattice caches.
//
// Resolving one cell costs four noise evaluations, and resolving it through
// rejection sampling costs nine of those. Without memoisation a single 32-cube
// shard re-derives the same handful of cells about eighty thousand times, which
// measured at 139 ms per shard — roughly four and a half minutes added to
// seeding, precisely the regression that got voxel trees deleted the first
// time. With it, a shard touches ~36 distinct cells once each.
//
// These are caches in the strict sense: pure functions of the key, so clearing
// them changes nothing but speed. Bounded so a full-map seed cannot grow them
// without limit.
const CELL_CACHE_LIMIT = 8192;
const candidateCache = new Map<string, HarthmereForestTree | undefined>();
const resolvedCache = new Map<string, HarthmereForestTree | undefined>();

function cacheGet<T>(
  cache: Map<string, T>,
  key: string,
  compute: () => T
): T {
  const hit = cache.get(key);
  if (hit !== undefined || cache.has(key)) {
    return hit as T;
  }
  const value = compute();
  if (cache.size >= CELL_CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(key, value);
  return value;
}

/**
 * The unresolved candidate for one lattice cell — before rejection sampling.
 * Pure: same cell always yields the same tree, on every client and server.
 */
export function harthmereForestCellCandidate(
  cellX: number,
  cellZ: number
): HarthmereForestTree | undefined {
  return cacheGet(candidateCache, `${cellX}:${cellZ}`, () =>
    computeForestCellCandidate(cellX, cellZ)
  );
}

function computeForestCellCandidate(
  cellX: number,
  cellZ: number
): HarthmereForestTree | undefined {
  const centerX = cellX * HARTHMERE_FOREST_SPACING + HARTHMERE_FOREST_SPACING / 2;
  const centerZ = cellZ * HARTHMERE_FOREST_SPACING + HARTHMERE_FOREST_SPACING / 2;
  const jx = (hash(cellX, cellZ, 11) * 2 - 1) * HARTHMERE_FOREST_JITTER;
  const jz = (hash(cellX, cellZ, 23) * 2 - 1) * HARTHMERE_FOREST_JITTER;
  const x = Math.round(centerX + jx);
  const z = Math.round(centerZ + jz);

  if (!pointMask(x, z)) {
    return undefined;
  }

  const roll = hash(cellX, cellZ, 37);
  const species = speciesAt(x, z, roll);
  const sizeRoll = hash(cellX, cellZ, 53);

  // Doc 2.1 height bands, nudged up so the canopy always clears head height.
  if (species === "oak") {
    const height = 11 + Math.floor(sizeRoll * 6); // 11..16
    return { species, x, z, height, radius: height >= 14 ? 5 : 4, seed: Math.floor(sizeRoll * 65536) };
  }
  if (species === "birch") {
    const height = 9 + Math.floor(sizeRoll * 4); // 9..12
    return { species, x, z, height, radius: 3, seed: Math.floor(sizeRoll * 65536) };
  }
  const height = 10 + Math.floor(sizeRoll * 5); // 10..14
  return { species, x, z, height, radius: 4, seed: Math.floor(sizeRoll * 65536) };
}

/**
 * Doc 2.2 step 3: "If ANY voxel of that footprint is already claimed, reject
 * the tree entirely" — which is what makes big trees suppress their neighbours
 * and lets canopy density self-regulate by species.
 *
 * The pipeline does this with a shared occupancy buffer and a shuffled scan
 * order. That needs global state, which a per-voxel seeder cannot have. The
 * equivalent local rule: a candidate yields to any OVERLAPPING neighbour that
 * outranks it, where rank is canopy radius, then height, then a hash for ties.
 * Ranking is a total order and overlap is symmetric, so the outcome is exactly
 * one winner per cluster and the result is order-independent — a property the
 * shuffled global version has to be careful about and this gets for free.
 */
/**
 * How far the species' leaves actually get from the trunk.
 *
 * `radius` is the density dial; this is the geometric truth. Birch lobes sit
 * on stems that lean out, and rubber lobes sit on arm tips, so both reach
 * further than their nominal radius suggests. Using `radius` for the
 * cross-species test let a birch canopy grow into an oak's.
 */
function trueReach(tree: HarthmereForestTree): number {
  if (tree.species === "birch") return 5; // stem lean 2 + lobe 2.6
  if (tree.species === "rubber") return 5; // arm 2 + lobe 2.6
  return tree.radius;
}

function outranks(a: HarthmereForestTree, b: HarthmereForestTree): boolean {
  // Rank on TRUE reach, not the nominal radius. Ranking on `radius` made every
  // cross-species contest a birch (nominal 3) losing to an oak (4-5), which
  // deleted birch from the map almost entirely — 5770 trees down to 973. Real
  // footprint is the fair comparison and is what the doc's occupancy buffer
  // effectively uses.
  const reachA = trueReach(a);
  const reachB = trueReach(b);
  if (reachA !== reachB) return reachA > reachB;
  if (a.height !== b.height) return a.height > b.height;
  if (a.seed !== b.seed) return a.seed > b.seed;
  // Fully degenerate: fall back to position so the order is still total.
  return a.x !== b.x ? a.x > b.x : a.z > b.z;
}

function overlaps(a: HarthmereForestTree, b: HarthmereForestTree): boolean {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const distanceSq = dx * dx + dz * dz;

  if (a.species !== b.species) {
    // Gaia's leaf DFS only travels through leaves of the SAME id. Two species
    // sharing a canopy therefore produces leaves that look attached but are
    // orphaned from their own log, and decay a minute after load. Different
    // species must not touch at all.
    const reach = trueReach(a) + trueReach(b);
    return distanceSq < reach * reach;
  }

  // Same species may interlock — that is what a real wood looks like, and
  // every leaf can still find a log. Keep some daylight so the forest reads as
  // trees rather than one continuous green ceiling.
  const reach = a.radius + b.radius - 3;
  return distanceSq < reach * reach;
}

/** The tree a cell actually grows, after losing to any bigger neighbour. */
export function harthmereForestTreeForCell(
  cellX: number,
  cellZ: number
): HarthmereForestTree | undefined {
  return cacheGet(resolvedCache, `${cellX}:${cellZ}`, () =>
    computeForestTreeForCell(cellX, cellZ)
  );
}

function computeForestTreeForCell(
  cellX: number,
  cellZ: number
): HarthmereForestTree | undefined {
  const candidate = harthmereForestCellCandidate(cellX, cellZ);
  if (!candidate) {
    return undefined;
  }
  // Jitter (3) plus the largest canopy (5) is 8, exactly one cell, so a tree
  // two cells away can never touch this one. A 3x3 sweep is sufficient.
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) {
        continue;
      }
      const rival = harthmereForestCellCandidate(cellX + dx, cellZ + dz);
      if (rival && overlaps(candidate, rival) && outranks(rival, candidate)) {
        return undefined;
      }
    }
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Tree form
//
// Doc 2.1 grows each tree once into a voxel volume and stamps copies. A seeder
// cannot hold a library, so each form is expressed analytically instead: given
// an offset from the trunk, is this voxel wood, leaf, or air? Same silhouettes,
// no storage.
// ---------------------------------------------------------------------------

// GAIA CONTRACT (this is not decoration — it is load-bearing).
//
// Gaia's leaf_growth walks dfsVoxels from each leaf through voxels of the SAME
// leaf id only, six-connected, and decays any leaf that cannot reach its
// matching log within Manhattan distance gaiaV2GrowthLeafMaxDFS (8). Its
// tree_growth does the same for logs, decaying any log whose same-species
// chain cannot reach dirt/grass/moss beneath it within 24.
//
// So a tree that merely LOOKS right will quietly fall apart minutes after the
// world loads. Three rules follow, and all three are proven by
// harthmere_wilds_forest_gaia.test.ts rather than asserted here:
//   1. every leaf has a six-connected same-species path to its own trunk;
//   2. every log is six-connected back to a trunk that stands on soil;
//   3. the caller guarantees growth soil under each trunk.

/** True if this offset survives the boundary erosion, ignoring connectivity. */
function lobeFieldKept(
  tree: HarthmereForestTree,
  dx: number,
  dy: number,
  dz: number,
  radius: number,
  verticalRadius: number
): boolean {
  const horizontal = (dx * dx + dz * dz) / (radius * radius);
  const vertical = (dy * dy) / (verticalRadius * verticalRadius);
  const field = horizontal + vertical;
  if (field > 1) {
    return false;
  }
  // Doc 2.1's "decay(mask, 0.3, 0.5)" — erode the boundary with noise so the
  // silhouette is ragged rather than a smooth blob. The interior is untouched.
  if (field < 0.55) {
    return true;
  }
  const erosion = hash(
    tree.x * 31 + dx,
    tree.z * 31 + dz,
    tree.seed + dy * 101
  );
  return erosion > (field - 0.55) / 0.45;
}

/**
 * A leaf exists only if every voxel on a straight walk back to the lobe centre
 * also exists.
 *
 * Erosion alone would strand the occasional outer leaf with no neighbours, and
 * Gaia would then decay it a minute after load — leaves visibly popping out of
 * the canopy while the player watches. Walking inward one axis at a time builds
 * a six-connected path by construction, so if this voxel is kept, so is a chain
 * of leaves leading to the trunk. Costs at most ~10 cheap iterations.
 */
function canopyLobe(
  tree: HarthmereForestTree,
  dx: number,
  dy: number,
  dz: number,
  radius: number,
  verticalRadius: number
): boolean {
  let x = dx;
  let y = dy;
  let z = dz;
  for (let guard = 0; guard < 32; guard += 1) {
    if (!lobeFieldKept(tree, x, y, z, radius, verticalRadius)) {
      return false;
    }
    if (x === 0 && y === 0 && z === 0) {
      return true;
    }
    // Step one axis at a time, largest first: a six-connected path inward.
    if (Math.abs(x) >= Math.abs(z) && Math.abs(x) >= Math.abs(y)) {
      x -= Math.sign(x);
    } else if (Math.abs(z) >= Math.abs(y)) {
      z -= Math.sign(z);
    } else {
      y -= Math.sign(y);
    }
  }
  return false;
}

/**
 * Doc 2.1: branches on a phyllotaxis stride so successive ones land ~135 apart
 * and nothing stacks.
 *
 * The obvious implementation — round(cos(angle)*step) — produces voxels that
 * sit DIAGONALLY from the trunk, and Gaia's six-connected DFS does not consider
 * those attached. They would decay within two minutes. The doc's own pipeline
 * avoids this by drawing branches with a voxel DDA ray-marcher, which is
 * face-connected by construction; an L-shaped path is the same guarantee in
 * closed form.
 */
function oakBranchVoxel(
  tree: HarthmereForestTree,
  branch: number,
  dx: number,
  dz: number
): boolean {
  const angle = branch * 0.75 * Math.PI + (tree.seed % 64) / 64;
  const ax = Math.cos(angle);
  const az = Math.sin(angle);
  // Two out along the dominant axis, then one across: (1,0),(2,0),(2,1).
  const alongX = Math.abs(ax) >= Math.abs(az);
  const stepX = Math.sign(ax) || 1;
  const stepZ = Math.sign(az) || 1;
  if (alongX) {
    if (dz === 0 && (dx === stepX || dx === stepX * 2)) return true;
    return dx === stepX * 2 && dz === stepZ;
  }
  if (dx === 0 && (dz === stepZ || dz === stepZ * 2)) return true;
  return dz === stepZ * 2 && dx === stepX;
}

function oakBlockAt(
  tree: HarthmereForestTree,
  dx: number,
  relY: number,
  dz: number
): HarthmereForestMaterial | undefined {
  const h = tree.height;
  if (dx === 0 && dz === 0 && relY >= 1 && relY <= h) {
    return "oakLog";
  }

  const firstBranchY = Math.floor(h * 0.62);
  if (relY >= firstBranchY && relY <= firstBranchY + 3 && relY <= h - 1) {
    const branch = relY - firstBranchY;
    if (oakBranchVoxel(tree, branch, dx, dz)) {
      return "oakLog";
    }
  }

  // The lobe centre is a trunk voxel, which is what gives every leaf a path to
  // a log: canopyCenter <= h, and the trunk occupies (0,0) for all of 1..h.
  const canopyCenter = Math.min(h, Math.round(h * 0.82));
  if (
    relY >= HARTHMERE_FOREST_CANOPY_CLEARANCE &&
    canopyLobe(tree, dx, relY - canopyCenter, dz, tree.radius, 3.4)
  ) {
    return "oakLeaf";
  }
  return undefined;
}

function birchBlockAt(
  tree: HarthmereForestTree,
  dx: number,
  relY: number,
  dz: number
): HarthmereForestMaterial | undefined {
  const h = tree.height;
  // Doc 2.1: "a 2-voxel stump that splits into two opposed main stems".
  const splitAt = Math.max(3, Math.floor(h * 0.45));
  if (dx === 0 && dz === 0 && relY >= 1 && relY <= splitAt) {
    return "birchLog";
  }
  const lean = tree.seed % 2 === 0 ? 1 : -1;

  // The stems lean outward one voxel at a time. Each time the offset grows,
  // BOTH offsets are emitted on that row — otherwise the step is a diagonal
  // and Gaia's six-connected DFS treats everything above it as unsupported.
  const offsetAt = (rise: number) => Math.min(2, Math.floor(rise / 3));
  if (relY > splitAt && relY <= h) {
    const rise = relY - splitAt;
    const offset = offsetAt(rise);
    const previous = offsetAt(rise - 1);
    if (dz === 0) {
      for (const stem of [lean, -lean]) {
        if (dx === offset * stem || dx === previous * stem) {
          return "birchLog";
        }
      }
    }
  }

  if (relY < HARTHMERE_FOREST_CANOPY_CLEARANCE) {
    return undefined;
  }
  // Two lobes, one over each stem, deliberately unequal — doc 2.1 notes the
  // per-branch multipliers exist so no two birches read as mirror images.
  // Each lobe is centred ON its stem top, so its leaves reach a log.
  const topOffset = offsetAt(h - splitAt);
  const canopyY = h;
  if (
    canopyLobe(tree, dx - topOffset * lean, relY - canopyY, dz, 2.6, 2.8) ||
    canopyLobe(tree, dx + topOffset * lean, relY - canopyY, dz, 2.2, 2.4)
  ) {
    return "birchLeaf";
  }
  return undefined;
}

function rubberBlockAt(
  tree: HarthmereForestTree,
  dx: number,
  relY: number,
  dz: number
): HarthmereForestMaterial | undefined {
  const h = tree.height;
  const armY = h - 3;
  if (dx === 0 && dz === 0 && relY >= 1 && relY <= armY) {
    return "rubberLog";
  }
  // Doc 2.1: "four branches at 90 degree increments that each go *out* then
  // *up*, producing the candelabra form." Axis-aligned, so every voxel is
  // face-adjacent to the last and the whole arm hangs off the trunk.
  const arms: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const armTopY = armY + 3;
  for (const [ax, az] of arms) {
    const onArm = (dx === ax || (ax === 0 && dx === 0)) &&
      (dz === az || (az === 0 && dz === 0));
    // Horizontal run outward at armY, then a vertical riser at the tip.
    for (let step = 1; step <= 2; step += 1) {
      if (dx === ax * step && dz === az * step) {
        if (relY === armY) return "rubberLog";
        if (step === 2 && relY > armY && relY <= armTopY) return "rubberLog";
      }
    }
    void onArm;
    // Lobe centred exactly on the arm tip, which is a log.
    if (
      relY >= HARTHMERE_FOREST_CANOPY_CLEARANCE &&
      canopyLobe(tree, dx - ax * 2, relY - armTopY, dz - az * 2, 2.6, 2.4)
    ) {
      return "rubberLeaf";
    }
  }
  return undefined;
}

function treeBlockAt(
  tree: HarthmereForestTree,
  x: number,
  relY: number,
  z: number
): HarthmereForestMaterial | undefined {
  const dx = x - tree.x;
  const dz = z - tree.z;
  if (
    Math.abs(dx) > HARTHMERE_FOREST_MAX_CANOPY_RADIUS ||
    Math.abs(dz) > HARTHMERE_FOREST_MAX_CANOPY_RADIUS
  ) {
    return undefined;
  }
  if (tree.species === "oak") return oakBlockAt(tree, dx, relY, dz);
  if (tree.species === "birch") return birchBlockAt(tree, dx, relY, dz);
  return rubberBlockAt(tree, dx, relY, dz);
}

// ---------------------------------------------------------------------------
// Column cache
//
// The shim iterates Y innermost for a fixed column, so a one-entry cache of
// "which trees can reach this column" turns 9 lattice resolutions per VOXEL
// into 9 per COLUMN. That is the difference between this being free and this
// being the reason seeding got slow again.
// ---------------------------------------------------------------------------

let cachedColumnX = Number.NaN;
let cachedColumnZ = Number.NaN;
let cachedColumnTrees: HarthmereForestTree[] = [];

/** Exposed for tests; the cache is an optimisation, never a source of truth. */
export function harthmereResetForestColumnCache(): void {
  cachedColumnX = Number.NaN;
  cachedColumnZ = Number.NaN;
  cachedColumnTrees = [];
  candidateCache.clear();
  resolvedCache.clear();
}

function treesForColumn(x: number, z: number): HarthmereForestTree[] {
  if (x === cachedColumnX && z === cachedColumnZ) {
    return cachedColumnTrees;
  }
  const cellX = Math.floor(x / HARTHMERE_FOREST_SPACING);
  const cellZ = Math.floor(z / HARTHMERE_FOREST_SPACING);
  const trees: HarthmereForestTree[] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const tree = harthmereForestTreeForCell(cellX + dx, cellZ + dz);
      if (
        tree &&
        Math.abs(tree.x - x) <= HARTHMERE_FOREST_MAX_CANOPY_RADIUS &&
        Math.abs(tree.z - z) <= HARTHMERE_FOREST_MAX_CANOPY_RADIUS
      ) {
        trees.push(tree);
      }
    }
  }
  cachedColumnX = x;
  cachedColumnZ = z;
  cachedColumnTrees = trees;
  return trees;
}

/**
 * The forest voxel at a position, or undefined for air.
 *
 * `relY` is height above the flat ground, so 1 is the voxel a player stands on.
 * The caller is responsible for excluding roads, the town, and any other space
 * it owns — this module deliberately knows nothing about them.
 */
export function harthmereWildsForestBlockAt(
  x: number,
  relY: number,
  z: number
): HarthmereForestMaterial | undefined {
  if (relY < 1 || relY > HARTHMERE_FOREST_MAX_HEIGHT) {
    return undefined;
  }
  const trees = treesForColumn(x, z);
  // Doc 2.1: "tree[mask & (tree == 0)] = leaf" — leaves never overwrite wood.
  // This is not cosmetic. Canopies of neighbouring trees interlock, and if a
  // neighbour's leaf won a voxel that another tree needed for its trunk, that
  // trunk would be severed, Gaia would find the upper half unsupported, and
  // the tree would decay. Wood therefore wins every contested voxel.
  let leaf: HarthmereForestMaterial | undefined;
  for (const tree of trees) {
    const block = treeBlockAt(tree, x, relY, z);
    if (block === undefined) {
      continue;
    }
    if (block.endsWith("Log")) {
      return block;
    }
    leaf ??= block;
  }
  return leaf;
}

// ---------------------------------------------------------------------------
// Ground cover
//
// Doc 2.3. Three ideas do all the work:
//   * fine noise decides stipple, coarse noise decides where meadows ARE;
//   * flowers are a strict SUBSET of the grass mask — flora only grows where
//     grass grows — with a per-species region field so meadows are mixed
//     rather than monoculture stripes;
//   * a thinner deletes cover in patches, punching bare clearings.
// Everything here is one voxel tall, so all of it is walk-through.
// ---------------------------------------------------------------------------

export interface HarthmereFloraSpecies {
  material: HarthmereForestMaterial;
  seedName: string;
  /** Doc 2.3: one dial for "how much of the world does this species inhabit". */
  prevalence: number;
  /** Rare species get the stricter four-way gate. */
  rare?: boolean;
}

export const HARTHMERE_WILDS_FLORA: readonly HarthmereFloraSpecies[] = [
  { material: "rose", seedName: "harthmere_rose", prevalence: 8 },
  { material: "dandelion", seedName: "harthmere_dandelion", prevalence: 8 },
  { material: "sunflower", seedName: "harthmere_sunflower", prevalence: 6, rare: true },
  { material: "hay", seedName: "harthmere_wildwheat", prevalence: 4, rare: true },
];

function grassMask(x: number, z: number): boolean {
  const fine = harthmereUpwardBiasedNoise(
    "harthmere_grass_1",
    x,
    z,
    64,
    [2, 4, 4, 1, 4, 6, 4]
  );
  const coarse = harthmereUpwardBiasedNoise(
    "harthmere_grass_1_region",
    x,
    z,
    1024,
    [1, 1, 1, 16, 8, 4, 0, 8]
  );
  const alternate = harthmereUpwardBiasedNoise(
    "harthmere_grass_2",
    x,
    z,
    32,
    [1, 3, 2, 2, 4, 6, 4]
  );
  // Thresholds are calibrated against the measured distribution of
  // harthmereUpwardBiasedNoise, which clusters hard around 0.5 (p10 0.38,
  // p50 0.50, p90 0.63). Picking numbers by eye here produces either bare
  // ground or a solid carpet; these sit at roughly p35 / p25 / p78.
  return (fine > 0.44 && coarse > 0.4) || alternate > 0.56;
}

/** Doc 2.3's `grass_thinner`: bare clearings inside otherwise continuous cover. */
function thinned(x: number, z: number): boolean {
  return (
    harthmereUpwardBiasedNoise(
      "harthmere_grass_patcher",
      x,
      z,
      256,
      [2, 1, 0, 1, 2, 4, 2, 1]
    ) > 0.62
  );
}

/**
 * The one-voxel ground cover at a column, or undefined for bare ground.
 *
 * Returned at relY 1 only. As with the trees, the caller owns the decision
 * about roads, town and other reserved space.
 */
export function harthmereWildsGroundCoverAt(
  x: number,
  z: number
): HarthmereForestMaterial | undefined {
  if (!grassMask(x, z) || thinned(x, z)) {
    return undefined;
  }

  for (const species of HARTHMERE_WILDS_FLORA) {
    // Period 16 is the individual stipple; period 2048 is the REGION in which
    // this species occurs at all, shifted by prevalence.
    const stipple = harthmereUpwardBiasedNoise(
      species.seedName,
      x,
      z,
      16,
      [4, 1, 4, 6, 8]
    );
    if (stipple < (species.rare ? 0.7 : 0.64)) {
      continue;
    }
    const region = harthmereUpwardBiasedNoise(
      `${species.seedName}_region`,
      x,
      z,
      2048,
      [8, 8, 8, 8, 4, 4, 0, 8]
    );
    // Doc 2.3: prevalence is the single dial for "how much of the world does
    // this species inhabit", shifting the REGION threshold rather than the
    // stipple — so a species is absent from whole meadows instead of being
    // uniformly thinner everywhere.
    const threshold = species.rare
      ? 0.68 - species.prevalence / 200
      : 0.68 - species.prevalence / 100;
    if (region < threshold) {
      continue;
    }
    if (species.rare) {
      // The stricter four-way gate: two further scales must also agree.
      const mid = harthmereExplicitNoise(
        `${species.seedName}_mid`,
        x,
        z,
        128,
        [1, 0.5, 0.25]
      );
      const near = harthmereExplicitNoise(
        `${species.seedName}_near`,
        x,
        z,
        32,
        [1, 0.5]
      );
      if (mid < 0.1 || near < 0.05) {
        continue;
      }
    }
    return species.material;
  }

  // Plain undergrowth. Two variants so a meadow is not one flat colour.
  const bushiness = harthmereUpwardBiasedNoise(
    "harthmere_undergrowth",
    x,
    z,
    48,
    [1, 2, 3, 2]
  );
  // NB: never a leaf id here. Gaia's leaf_growth decays any leaf that cannot
  // reach its matching log within eight voxels, so an oak_leaf used as a ground
  // bush would survive only where it happened to sit near a trunk — half the
  // undergrowth quietly disappearing a minute after load. Ground cover uses
  // block materials, which no Gaia simulation touches.
  if (bushiness > 0.63) {
    return "switchGrass";
  }
  if (bushiness > 0.44) {
    return "moss";
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Structural self-checks, run by the tests. Returns human-readable problems. */
export function harthmereValidateWildsForest(): string[] {
  const problems: string[] = [];
  if (HARTHMERE_FOREST_CANOPY_CLEARANCE < 4) {
    problems.push(
      "canopy clearance below 4 would put leaves in the player's head"
    );
  }
  if (HARTHMERE_FOREST_MAX_CANOPY_RADIUS + HARTHMERE_FOREST_JITTER > HARTHMERE_FOREST_SPACING) {
    problems.push(
      "a tree could reach more than one lattice cell, so the 3x3 sweep in " +
        "harthmereForestTreeForCell and treesForColumn would miss neighbours"
    );
  }
  for (const species of HARTHMERE_WILDS_FLORA) {
    if (species.prevalence <= 0) {
      problems.push(`${species.material}: prevalence must be positive`);
    }
  }
  return problems;
}
