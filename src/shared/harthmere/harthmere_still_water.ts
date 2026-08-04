// HARTHMERE_STILL_WATER
//
// The town's three small water features: the market fountain, the stable
// trough, and the watermill race.
//
// WHY THIS EXISTS
// -----------------------------------------------------------------------
// All three were authored, and all three were `materials.water` — which is
// `terrainId("water", terrainId("blue_wool", stone))`. Biomes has no water
// *block* (world-anatomy doc §5.1; water is the parallel `ShardWater` field and
// there is no `water.json` under src/galois/data/blocks), so every one of them
// fell through to its fallback and rendered as **blue wool**:
//
//   * the market fountain (482..490, -213..-205) was a wool disc with a wool
//     column standing on it;
//   * the stable trough (455..459, -246..-242) was a flat 5x5 wool patch lying
//     on the grass, with no trough around it at all;
//   * the watermill race (370..378, -407..-401) was a flat 9x7 wool patch, and
//     the mill wheel turned over it without touching anything.
//
// WHY THEY NEEDED REDESIGNING, NOT JUST RECOLOURING
// -----------------------------------------------------------------------
// Wool is a solid block, so the authored shapes never had to hold anything.
// Real water does not work that way. From `update_water` (voxeloo/gaia/water.cpp,
// doc §5.3): level 15 is a source and never depletes, water spreads into any
// *flowable* neighbour (air, or any non-collidable voxel such as flora) losing
// one level per horizontal step, and falls wherever the voxel below is
// flowable. A source with an open side reaches fourteen voxels before it dies.
//
// So each of these had at least one fatal leak as authored:
//
//   * the fountain's upper tier had NO rim — 15 at head height with open air on
//     all four sides would have poured over the plaza;
//   * the trough had no walls whatsoever;
//   * the race was a surface patch, not a channel.
//
// Each is therefore rebuilt as a basin that is solid on all four horizontal
// sides at every water level and solid underneath, keeping the authored
// footprint and silhouette. `harthmere_still_water.test.ts` proves containment
// by running the engine's own flood rule outward from every source voxel and
// asserting nothing escapes the feature's own footprint.
//
// A second rule the wool versions did not have to respect: a voxel can only
// hold water if something holds *it* up. Every added block here rests on
// another block, so there is no floating stone — which is why the fountain's
// water column became a plinth with an annular basin rather than a levitating
// pillar of water.
//
// All coordinates are AUTHORED, matching the other Harthmere generators.

export const HARTHMERE_STILL_WATER_VERSION =
  "harthmere-still-water-v1" as const;

/** Materials, keyed by `localDevMaterials()` names. */
export type HarthmereStillWaterMaterial =
  "stonePolished" | "stoneBrick" | "oakLumber";

export interface HarthmereStillWaterFeature {
  readonly id: "market_fountain" | "stable_trough" | "watermill_race";
  readonly label: string;
  /** Authored footprint, inclusive. Nothing outside this is ever touched. */
  readonly bounds: {
    readonly x0: number;
    readonly x1: number;
    readonly z0: number;
    readonly z1: number;
  };
  /** relY values this feature writes anything at, for cheap loops. */
  readonly relYRange: readonly [number, number];
}

// ---------------------------------------------------------------------------
// 1. The market fountain
// ---------------------------------------------------------------------------
//
// Authored: a disc of "water" at relY 1 for d <= 2 inside a polished ring out
// to d <= 4.5, plus a floating "water" column at relY 2 for d <= 1.5.
//
// Rebuilt as the shape that column was always trying to be: a wide annular
// basin around a solid two-voxel plinth, with a single spout voxel in a rimmed
// bowl on top. The outer wall and the overall 9x9 footprint are unchanged, so
// the fountain still reads from the same distance and still fits the plaza.
// HARTHMERE_FOUNTAIN_STRUCTURE (2026-07-30)
//
// The first pass made the fountain watertight but not *built*. It was one course
// of stone at ankle height, a two-voxel stub in the middle and a small rim: from
// standing eye level it read as a puddle with a kerb, which is what the player
// reported — "just water in the centre of town".
//
// This is the same footprint rebuilt as a bell-founder's fountain, which is what
// the bible's Market Fountain (`harthmere_market_fountain`, §7.2) should be in a
// town whose whole cosmology is bells — the Bellbound dragon, the Bellbinder
// descent under the chapel, the bell-cast standards the Watch swears on.
//
// The silhouette, bottom to top:
//
//   relY 1   basin wall (polished) · annular basin · square plinth base
//   relY 2   coping course (brick) raising the wall to bench height
//            · plinth, stepped in one voxel
//   relY 3   four cardinal posts standing on the coping · plinth
//   relY 4   the bell — an upper bowl whose rim rings a single spout voxel
//
// Every one of those courses rests on the course below it, and every water
// voxel is walled on all four sides at its own level and floored beneath, so the
// containment and no-float proofs in `harthmere_still_water.test.ts` still hold
// unchanged. Nothing leaves the authored 11x11 footprint.
export const HARTHMERE_FOUNTAIN_CENTRE: readonly [number, number] = [486, -209];
/** Outer wall, from the authored `d <= 4.5`. */
export const HARTHMERE_FOUNTAIN_OUTER_RADIUS = 4.5;
/** Inside face of the outer wall: everything within this is basin. */
export const HARTHMERE_FOUNTAIN_BASIN_RADIUS = 3.5;
/** The plinth the bell stands on, rising out of the basin floor. */
export const HARTHMERE_FOUNTAIN_PLINTH_RADIUS = 1.75;
/** The plinth steps in above its base course, so it reads as masonry. */
export const HARTHMERE_FOUNTAIN_PLINTH_UPPER_RADIUS = 1.5;
/** Rim of the upper bowl — the bell's mouth — sitting on the plinth. */
export const HARTHMERE_FOUNTAIN_BOWL_RIM_RADIUS = 1.5;
/** Water in the upper bowl — the centre column only. */
export const HARTHMERE_FOUNTAIN_SPOUT_RADIUS = 0.75;
/** Top course of the basin wall. Bench height, so the plaza can sit on it. */
export const HARTHMERE_FOUNTAIN_WALL_TOP_REL_Y = 2;
/** The four cardinal posts stand one course above the coping. */
export const HARTHMERE_FOUNTAIN_POST_TOP_REL_Y = 3;
/** The bell bowl, and the highest thing the fountain writes. */
export const HARTHMERE_FOUNTAIN_BOWL_REL_Y = 4;

function fountainDistance(authoredX: number, authoredZ: number) {
  return Math.hypot(
    authoredX - HARTHMERE_FOUNTAIN_CENTRE[0],
    authoredZ - HARTHMERE_FOUNTAIN_CENTRE[1]
  );
}

/** On the basin wall ring, at one of the four compass points. */
function onFountainCardinalPost(authoredX: number, authoredZ: number) {
  const dx = authoredX - HARTHMERE_FOUNTAIN_CENTRE[0];
  const dz = authoredZ - HARTHMERE_FOUNTAIN_CENTRE[1];
  const d = Math.hypot(dx, dz);
  return (
    d > HARTHMERE_FOUNTAIN_BASIN_RADIUS &&
    d <= HARTHMERE_FOUNTAIN_OUTER_RADIUS &&
    (dx === 0 || dz === 0)
  );
}

// ---------------------------------------------------------------------------
// 2. The stable trough
// ---------------------------------------------------------------------------
//
// This is the farmyard feature beside the hayrack post at (444, -242) and the
// hay bales at (435..443, -224..-222).
//
// Authored: a bare 5x5 patch of "water" at relY 1 lying on open grass at
// (455..459, -246..-242). Rebuilt as an actual trough — a one-voxel oak wall
// around a 3x3 well of water.
//
// The shell-polish pass moved `traveler_hearth_player_house` onto
// x=448..466,z=-252..-232, which swallowed the former trough at
// x=455..459,z=-245..-241. Keep the trough beside the hayrack post at
// (444,-242), but move its 5x5 footprint immediately west of that post and
// outside both the house and the stable shell.
export const HARTHMERE_TROUGH_BOUNDS = {
  x0: 439,
  x1: 443,
  z0: -245,
  z1: -241,
} as const;

// ---------------------------------------------------------------------------
// 3. The watermill race
// ---------------------------------------------------------------------------
//
// Authored: a flat 9x7 patch of "water" at relY 0 — the ground surface — beside
// a wheel whose voxels run from relY 1 to relY 6 at radius 3.2..4.4 about
// (374, -404). The wheel turned over dry wool it did not even touch.
//
// Rebuilt as a real race: the ground inside the bank is replaced by water at
// relY 0, so the surface is flush with the surrounding grade and the wheel's
// lower arc turns in it.
//
// It also had to MOVE. The authored patch straddled x = 374, which is the west
// wall of `miller_rest_watermill` (374..394, -414..-394) — so half of it was
// inside the mill building. The wheel hangs off that west wall, which is what a
// watermill wheel does, so the race belongs alongside the wall rather than
// under the building: a north-south channel running from x 368 to x 373,
// stopping one voxel short of the wall.
//
// The eastern half of the wheel's arc is inside the mill housing, as it should
// be. Every part of the arc that is outside the building is over open water.
export const HARTHMERE_MILL_WHEEL_CENTRE: readonly [number, number] = [
  374, -404,
];
export const HARTHMERE_MILL_WHEEL_INNER_RADIUS = 3.2;
export const HARTHMERE_MILL_WHEEL_OUTER_RADIUS = 4.4;
/** West wall of `miller_rest_watermill`; the race stops short of it. */
export const HARTHMERE_MILL_BUILDING_WEST_X = 374;
/** Outer edge of the race, inclusive. The border ring stays solid bank. */
export const HARTHMERE_MILL_RACE_BOUNDS = {
  x0: 368,
  x1: 373,
  z0: -412,
  z1: -396,
} as const;

// HARTHMERE_MILL_STRUCTURE (2026-07-30)
//
// The race held water correctly but was, visually, a ditch — the same complaint
// as the fountain. A mill race is built work: dressed banks that keep the head,
// and a housing the wheel's axle sits in.
//
// Two additions, both resting on the race's own uncarved border ring, so
// neither changes containment (the water sits at relY 0, held by the ground the
// channel is cut into) and neither can float:
//
//   * a coping course along the west bank and both ends, at relY 1;
//   * two oak housing posts flanking the wheel on the mill side, at relY 1..2.
//
// The EAST bank is deliberately left bare. That is the mill side: the wheel's
// arc sweeps x 369.6..378.4 about (374, -404), so anything built on x = 373
// inside that span would stand inside the turning wheel.
export const HARTHMERE_MILL_BANK_TOP_REL_Y = 1;
export const HARTHMERE_MILL_HOUSING_TOP_REL_Y = 2;
/**
 * Wheel-housing posts, clear of the arc at both ends.
 *
 * The wheel is radius 4.4 about (374, -404) and the posts stand on x = 373, one
 * voxel out, so a post needs |dz| >= 5 to miss the sweep — hence -409 and -399
 * rather than the tidier -409/-400, which would have stood a beam inside the
 * turning wheel. The test derives this from the wheel constants, so moving the
 * wheel moves the requirement with it.
 */
export const HARTHMERE_MILL_HOUSING_POST_Z: readonly number[] = [-409, -399];

export const HARTHMERE_STILL_WATER_FEATURES: readonly HarthmereStillWaterFeature[] =
  [
    {
      id: "market_fountain",
      label: "Market Plaza fountain",
      bounds: { x0: 481, x1: 491, z0: -214, z1: -204 },
      relYRange: [1, HARTHMERE_FOUNTAIN_BOWL_REL_Y],
    },
    {
      id: "stable_trough",
      label: "Stable trough",
      bounds: HARTHMERE_TROUGH_BOUNDS,
      relYRange: [1, 1],
    },
    {
      id: "watermill_race",
      label: "Watermill race",
      bounds: HARTHMERE_MILL_RACE_BOUNDS,
      relYRange: [0, HARTHMERE_MILL_HOUSING_TOP_REL_Y],
    },
  ] as const;

function inBounds(
  authoredX: number,
  authoredZ: number,
  bounds: HarthmereStillWaterFeature["bounds"]
) {
  return (
    authoredX >= bounds.x0 &&
    authoredX <= bounds.x1 &&
    authoredZ >= bounds.z0 &&
    authoredZ <= bounds.z1
  );
}

/** True on the outermost ring of a rect — the wall/bank columns. */
function onRectBorder(
  authoredX: number,
  authoredZ: number,
  bounds: { x0: number; x1: number; z0: number; z1: number }
) {
  return (
    authoredX === bounds.x0 ||
    authoredX === bounds.x1 ||
    authoredZ === bounds.z0 ||
    authoredZ === bounds.z1
  );
}

// ---------------------------------------------------------------------------
// Voxels
// ---------------------------------------------------------------------------

/**
 * Solid block this feature places, if any.
 *
 * Every block returned here rests on another block or on the ground plane, so
 * nothing floats. The test walks the whole footprint and asserts it.
 */
export function harthmereStillWaterBlockAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): HarthmereStillWaterMaterial | undefined {
  // --- Market fountain -----------------------------------------------------
  const fd = fountainDistance(authoredX, authoredZ);
  if (fd <= HARTHMERE_FOUNTAIN_OUTER_RADIUS) {
    if (relY === 1) {
      // Basin wall, and the base course of the plinth. Both sit on the plaza.
      if (fd > HARTHMERE_FOUNTAIN_BASIN_RADIUS) return "stonePolished";
      if (fd <= HARTHMERE_FOUNTAIN_PLINTH_RADIUS) return "stonePolished";
    }
    if (relY === HARTHMERE_FOUNTAIN_WALL_TOP_REL_Y) {
      // The coping course. It raises the wall to bench height — the reason the
      // fountain now reads as a built thing from across the plaza — and it is
      // also what the cardinal posts above stand on.
      if (fd > HARTHMERE_FOUNTAIN_BASIN_RADIUS) return "stoneBrick";
      if (fd <= HARTHMERE_FOUNTAIN_PLINTH_UPPER_RADIUS) return "stonePolished";
    }
    if (relY === HARTHMERE_FOUNTAIN_POST_TOP_REL_Y) {
      // Four posts at the compass points, standing on the coping.
      if (onFountainCardinalPost(authoredX, authoredZ)) return "stoneBrick";
      if (fd <= HARTHMERE_FOUNTAIN_PLINTH_UPPER_RADIUS) return "stonePolished";
    }
    // The bell: an upper bowl whose rim rings a single spout voxel. Only the
    // spout is left open, so the bowl cannot pour over its own edge.
    if (
      relY === HARTHMERE_FOUNTAIN_BOWL_REL_Y &&
      fd > HARTHMERE_FOUNTAIN_SPOUT_RADIUS &&
      fd <= HARTHMERE_FOUNTAIN_BOWL_RIM_RADIUS
    ) {
      return "stoneBrick";
    }
  }

  // --- Stable trough -------------------------------------------------------
  if (
    relY === 1 &&
    inBounds(authoredX, authoredZ, HARTHMERE_TROUGH_BOUNDS) &&
    onRectBorder(authoredX, authoredZ, HARTHMERE_TROUGH_BOUNDS)
  ) {
    return "oakLumber";
  }

  // --- Watermill race ------------------------------------------------------
  if (inBounds(authoredX, authoredZ, HARTHMERE_MILL_RACE_BOUNDS)) {
    const race = HARTHMERE_MILL_RACE_BOUNDS;
    // The wheel's housing posts, on the mill bank, clear of the turning arc.
    if (
      authoredX === race.x1 &&
      HARTHMERE_MILL_HOUSING_POST_Z.includes(authoredZ) &&
      relY >= 1 &&
      relY <= HARTHMERE_MILL_HOUSING_TOP_REL_Y
    ) {
      return "oakLumber";
    }
    // Dressed banks: west side and both ends. The east bank stays bare so the
    // wheel has somewhere to turn.
    if (
      relY === HARTHMERE_MILL_BANK_TOP_REL_Y &&
      authoredX !== race.x1 &&
      onRectBorder(authoredX, authoredZ, race)
    ) {
      return "stoneBrick";
    }
  }

  return undefined;
}

/**
 * True where the seeder must leave AIR instead of ground.
 *
 * Only the mill race needs this: it is cut into the surface, where the other
 * two sit on top of it.
 */
export function harthmereStillWaterCarvesAirAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): boolean {
  return (
    relY === 0 &&
    inBounds(authoredX, authoredZ, HARTHMERE_MILL_RACE_BOUNDS) &&
    !onRectBorder(authoredX, authoredZ, HARTHMERE_MILL_RACE_BOUNDS)
  );
}

/**
 * Water source level for a voxel, or 0.
 *
 * Doc §5.3: 15 is a source and never depletes, which is what a fountain fed by
 * a spring and a race fed by a stream both want. Every one of these sits inside
 * a basin proven watertight by test, so the simulation has nowhere to take it.
 */
export function harthmereStillWaterLevelAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): number {
  // --- Market fountain -----------------------------------------------------
  const fd = fountainDistance(authoredX, authoredZ);
  // The annular basin, between the plinth and the outer wall.
  if (
    relY === 1 &&
    fd > HARTHMERE_FOUNTAIN_PLINTH_RADIUS &&
    fd <= HARTHMERE_FOUNTAIN_BASIN_RADIUS
  ) {
    return 15;
  }
  // The spout, in the bell's mouth on top of the plinth.
  if (
    relY === HARTHMERE_FOUNTAIN_BOWL_REL_Y &&
    fd <= HARTHMERE_FOUNTAIN_SPOUT_RADIUS
  ) {
    return 15;
  }

  // --- Stable trough -------------------------------------------------------
  if (
    relY === 1 &&
    inBounds(authoredX, authoredZ, HARTHMERE_TROUGH_BOUNDS) &&
    !onRectBorder(authoredX, authoredZ, HARTHMERE_TROUGH_BOUNDS)
  ) {
    return 15;
  }

  // --- Watermill race ------------------------------------------------------
  if (harthmereStillWaterCarvesAirAt(authoredX, relY, authoredZ)) {
    return 15;
  }

  return 0;
}

/** True anywhere any of the three features writes something. */
export function harthmereStillWaterContains(
  authoredX: number,
  authoredZ: number
): boolean {
  return HARTHMERE_STILL_WATER_FEATURES.some((feature) =>
    inBounds(authoredX, authoredZ, feature.bounds)
  );
}

/**
 * Feature owning a column, for tests and diagnostics. The three footprints are
 * far apart, so at most one can ever match.
 */
export function harthmereStillWaterFeatureAt(
  authoredX: number,
  authoredZ: number
): HarthmereStillWaterFeature | undefined {
  return HARTHMERE_STILL_WATER_FEATURES.find((feature) =>
    inBounds(authoredX, authoredZ, feature.bounds)
  );
}

/** Cheap per-shard early-out, matching the river module's. */
export function harthmereStillWaterTouchesAuthoredSpan(
  authoredX0: number,
  authoredX1: number,
  authoredZ0: number,
  authoredZ1: number
): boolean {
  return HARTHMERE_STILL_WATER_FEATURES.some(
    (feature) =>
      !(
        authoredX1 < feature.bounds.x0 ||
        authoredX0 > feature.bounds.x1 ||
        authoredZ1 < feature.bounds.z0 ||
        authoredZ0 > feature.bounds.z1
      )
  );
}

/** Lowest and highest relY any feature touches, for the seeder's Y guard. */
export const HARTHMERE_STILL_WATER_MIN_REL_Y = Math.min(
  ...HARTHMERE_STILL_WATER_FEATURES.map((f) => f.relYRange[0])
);
export const HARTHMERE_STILL_WATER_MAX_REL_Y = Math.max(
  ...HARTHMERE_STILL_WATER_FEATURES.map((f) => f.relYRange[1])
);
