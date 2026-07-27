// HARTHMERE_FOREST_WILDLIFE
//
// Livestock scattered through the wilds forest outside Harthmere: 20 rabbits,
// 10 sheep, 5 cows.
//
// WHY THE POSITIONS ARE COMPUTED, NOT AUTHORED
// Every other creature family in this codebase is a hand-written coordinate
// list. That works when a designer picked the spots. Here the requirement is
// "randomly spaced through the entire forest", and the forest itself is
// generated — so hand-authored coordinates would drift out of the trees the
// moment anyone retunes the canopy. Instead the scatter is DERIVED from the
// same generator that grows the forest, using the codebase's own
// deterministic-PRNG convention (see harthmereSpawnRng in
// live_entity_production_seed.ts): random-looking, identical in every process,
// reproducible by the deploy reconciler.
//
// WHAT EVERY POSITION GUARANTEES
//   1. It stands on the additive extension's flat ground, so the feet Y is
//      known exactly and no terrain probe is needed.
//   2. Its own column is clear of forest voxels from the ground to above head
//      height — an animal never spawns inside a trunk or a bush.
//   3. It has real trees nearby, so "in the forest" is true rather than
//      nominal.
//   4. It keeps clear of the town, its approach roads, the muck patches, and
//      the back-country boundary.
//   5. It is at least HARTHMERE_FOREST_WILDLIFE_MIN_SPACING from every other
//      animal, so the herd reads as scattered rather than clumped.
//
// Anima drives these once they are ECS entities; nothing here simulates
// anything. Gaia is unaffected — no voxel is written, and the animals stand on
// terrain the forest generator already left empty.

import {
  harthmereWildsForestBlockAt,
  harthmereWildsGroundCoverAt,
  HARTHMERE_FOREST_MAX_CANOPY_RADIUS,
} from "@/shared/harthmere/harthmere_wilds_forest";
import { HARTHMERE_TOWN_BACK_BOUNDARY_X } from "@/shared/harthmere/harthmere_town_horizon";
import { isAuthoredPointInSnapshotMuckZone } from "@/shared/harthmere/snapshot_runtime_rules";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";

export const HARTHMERE_FOREST_WILDLIFE_VERSION =
  "harthmere-forest-wildlife-v1" as const;

export type HarthmereForestWildlifeSpecies = "rabbit" | "sheep" | "cow";

export interface HarthmereForestWildlifePlacement {
  species: HarthmereForestWildlifeSpecies;
  /** Authored X/Z; the seed builder shifts these into world space. */
  authoredX: number;
  authoredZ: number;
  index: number;
}

/** Exactly what was asked for. */
export const HARTHMERE_FOREST_WILDLIFE_COUNTS: Readonly<
  Record<HarthmereForestWildlifeSpecies, number>
> = {
  rabbit: 20,
  sheep: 10,
  cow: 5,
};

/**
 * The authored band the scatter samples from.
 *
 * X stops short of the back boundary because everything east of it belongs to
 * the back-country backdrop, which is scenery behind an impassable wall — an
 * animal there would be permanently unreachable.
 */
export const HARTHMERE_FOREST_WILDLIFE_BOUNDS = {
  minX: 200,
  maxX: HARTHMERE_TOWN_BACK_BOUNDARY_X - 8,
  minZ: -566,
  maxZ: 184,
} as const;

/** The authored town rectangle, plus room for its walls and approaches. */
const TOWN_RECT = { x0: 392, x1: 590, z0: -282, z1: -112 } as const;
const TOWN_CLEARANCE = 26;

/**
 * The town's own approach roads, in authored coordinates. Animals keep off
 * them so the routes in and out of Harthmere stay visually clear. These mirror
 * the shim's road list; being a few voxels out only makes the margin larger,
 * never smaller, so a drift here cannot put an animal in the roadway.
 */
const ROAD_SEGMENTS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [192, -209, 392, -209], // connector road in from the main world
  [486, -286, 486, -560], // north road
  [486, -112, 486, 180], // south road
  [392, -209, 200, -209], // west trade road
  [590, -205, 770, -205], // east river road
];
const ROAD_CLEARANCE = 12;

export const HARTHMERE_FOREST_WILDLIFE_MIN_SPACING = 14;
/**
 * How far to look for trees before believing a spot is "in the forest".
 *
 * Deliberately smaller than ROAD_CLEARANCE. The forest generator itself has no
 * idea where the roads are — the shim suppresses the forest over them — so a
 * wide search could count trees that do not actually exist at a spot sitting in
 * a roadway. Searching inside the road clearance means the trees being counted
 * are trees the shim also grows.
 */
const TREE_SEARCH_RADIUS = 10;
/** Enough trunks that the spot is inside the wood, not on its edge. */
const MIN_NEARBY_TRUNKS = 3;
/** Head height that must be clear above an animal's feet. */
const CLEAR_HEIGHT = 4;

function distanceToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const abX = bx - ax;
  const abZ = bz - az;
  const lengthSq = abX * abX + abZ * abZ;
  if (lengthSq === 0) {
    return Math.hypot(x - ax, z - az);
  }
  const t = Math.max(
    0,
    Math.min(1, ((x - ax) * abX + (z - az) * abZ) / lengthSq)
  );
  return Math.hypot(x - (ax + abX * t), z - (az + abZ * t));
}

/** Everything the forest and the town own, that an animal must stay out of. */
export function harthmereForestWildlifeRegionIsOpen(
  authoredX: number,
  authoredZ: number
): boolean {
  if (
    authoredX < HARTHMERE_FOREST_WILDLIFE_BOUNDS.minX ||
    authoredX > HARTHMERE_FOREST_WILDLIFE_BOUNDS.maxX ||
    authoredZ < HARTHMERE_FOREST_WILDLIFE_BOUNDS.minZ ||
    authoredZ > HARTHMERE_FOREST_WILDLIFE_BOUNDS.maxZ
  ) {
    return false;
  }
  if (
    authoredX >= TOWN_RECT.x0 - TOWN_CLEARANCE &&
    authoredX <= TOWN_RECT.x1 + TOWN_CLEARANCE &&
    authoredZ >= TOWN_RECT.z0 - TOWN_CLEARANCE &&
    authoredZ <= TOWN_RECT.z1 + TOWN_CLEARANCE
  ) {
    return false;
  }
  for (const [ax, az, bx, bz] of ROAD_SEGMENTS) {
    if (
      distanceToSegment(authoredX, authoredZ, ax, az, bx, bz) <= ROAD_CLEARANCE
    ) {
      return false;
    }
  }
  // Muck is the Grove's territory, not a pasture.
  if (
    isAuthoredPointInSnapshotMuckZone(
      [authoredX, HARTHMERE_EXTENSION_FEET_Y, authoredZ],
      8
    )
  ) {
    return false;
  }
  return true;
}

/**
 * True when an animal can physically stand here: no trunk, no bush, and clear
 * air through head height.
 */
export function harthmereForestWildlifeColumnIsClear(
  authoredX: number,
  authoredZ: number
): boolean {
  if (harthmereWildsGroundCoverAt(authoredX, authoredZ) !== undefined) {
    return false;
  }
  for (let relY = 1; relY <= CLEAR_HEIGHT; relY += 1) {
    if (harthmereWildsForestBlockAt(authoredX, relY, authoredZ) !== undefined) {
      return false;
    }
  }
  // A cow is wider than a voxel. Keep its immediate neighbours clear too, so
  // nothing spawns wedged against a trunk.
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (
      harthmereWildsForestBlockAt(authoredX + dx, 1, authoredZ + dz) !==
      undefined
    ) {
      return false;
    }
  }
  return true;
}

/** Counts trunks nearby, so "in the forest" means something. */
export function harthmereForestWildlifeTreesNear(
  authoredX: number,
  authoredZ: number
): number {
  let trunks = 0;
  for (let dz = -TREE_SEARCH_RADIUS; dz <= TREE_SEARCH_RADIUS; dz += 2) {
    for (let dx = -TREE_SEARCH_RADIUS; dx <= TREE_SEARCH_RADIUS; dx += 2) {
      const block = harthmereWildsForestBlockAt(
        authoredX + dx,
        2,
        authoredZ + dz
      );
      if (block !== undefined && block.endsWith("Log")) {
        trunks += 1;
      }
    }
  }
  return trunks;
}

/**
 * mulberry32, the same PRNG live_entity_production_seed.ts uses for its
 * "random world spread". Seeded by a constant so the herd is identical in
 * every process and reproducible by the deploy reconciler.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPECIES_ORDER: readonly HarthmereForestWildlifeSpecies[] = [
  "cow",
  "sheep",
  "rabbit",
];

let cachedPlacements: HarthmereForestWildlifePlacement[] | undefined;

/**
 * The scatter.
 *
 * Cows are placed first and rabbits last: the largest animal has the hardest
 * clearance test, so giving it first pick of the open ground avoids the case
 * where twenty rabbits have taken every glade and no cow will fit.
 */
export function harthmereForestWildlifePlacements(): HarthmereForestWildlifePlacement[] {
  if (cachedPlacements) {
    return cachedPlacements;
  }
  const random = rng(0x48524657); // "HRFW"
  const placed: HarthmereForestWildlifePlacement[] = [];
  const spacingSq =
    HARTHMERE_FOREST_WILDLIFE_MIN_SPACING *
    HARTHMERE_FOREST_WILDLIFE_MIN_SPACING;

  const farEnough = (x: number, z: number) =>
    placed.every((other) => {
      const dx = other.authoredX - x;
      const dz = other.authoredZ - z;
      return dx * dx + dz * dz >= spacingSq;
    });

  const width =
    HARTHMERE_FOREST_WILDLIFE_BOUNDS.maxX -
    HARTHMERE_FOREST_WILDLIFE_BOUNDS.minX;
  const depth =
    HARTHMERE_FOREST_WILDLIFE_BOUNDS.maxZ -
    HARTHMERE_FOREST_WILDLIFE_BOUNDS.minZ;

  let index = 0;
  for (const species of SPECIES_ORDER) {
    const wanted = HARTHMERE_FOREST_WILDLIFE_COUNTS[species];
    let found = 0;
    // Bounded: a fixed attempt budget keeps this a pure, terminating function
    // no matter how the forest is retuned. The tests assert every animal was
    // actually placed, so a budget that becomes too small fails loudly rather
    // than silently shipping a smaller herd.
    for (let attempt = 0; attempt < 40000 && found < wanted; attempt += 1) {
      const x =
        HARTHMERE_FOREST_WILDLIFE_BOUNDS.minX +
        Math.floor(random() * (width + 1));
      const z =
        HARTHMERE_FOREST_WILDLIFE_BOUNDS.minZ +
        Math.floor(random() * (depth + 1));
      if (!harthmereForestWildlifeRegionIsOpen(x, z)) {
        continue;
      }
      if (!harthmereForestWildlifeColumnIsClear(x, z)) {
        continue;
      }
      if (harthmereForestWildlifeTreesNear(x, z) < MIN_NEARBY_TRUNKS) {
        continue;
      }
      if (!farEnough(x, z)) {
        continue;
      }
      placed.push({ species, authoredX: x, authoredZ: z, index: index++ });
      found += 1;
    }
  }

  cachedPlacements = placed;
  return placed;
}

export function harthmereResetForestWildlifeCache(): void {
  cachedPlacements = undefined;
}

/** Structural self-checks for the tests. */
export function harthmereValidateForestWildlife(): string[] {
  const problems: string[] = [];
  const placements = harthmereForestWildlifePlacements();
  for (const species of SPECIES_ORDER) {
    const wanted = HARTHMERE_FOREST_WILDLIFE_COUNTS[species];
    const got = placements.filter((p) => p.species === species).length;
    if (got !== wanted) {
      problems.push(`${species}: placed ${got} of ${wanted}`);
    }
  }
  if (HARTHMERE_FOREST_WILDLIFE_MIN_SPACING <= HARTHMERE_FOREST_MAX_CANOPY_RADIUS) {
    problems.push(
      "minimum spacing is smaller than a canopy; animals could share a tree"
    );
  }
  return problems;
}
