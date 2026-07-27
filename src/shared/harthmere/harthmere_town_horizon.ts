// HARTHMERE_TOWN_HORIZON
//
// The country behind Harthmere. One side only.
//
// WHY ONLY ONE SIDE
// Harthmere is an ADDITIVE town: authored X 192..768, shifted +1600 into the
// world's east extension (world X 1792..2368). The player arrives from the
// WEST — the connector road enters at world X 1792, the old/new map boundary,
// and runs to the west gate. West is the front door and must stay open.
// North and south are the town's own authored approaches. That leaves the
// EAST as the back: authored 768..960 (world 2368..2560) is empty extension
// terrain today, and the world's own violet boundary already owns X 2560.
//
// So this module adds exactly one wall and one backdrop, on the back side, in
// the strip between the town's last building and the world's edge.
//
// WHAT THE PLAYER SEES, AND WHY IT IS THIS
// Harthmere sits on the largest antimatter deposit on Earth and refuses to
// mine it. The back country is therefore the mining land they will not open:
// terraced farms on the near slopes, then sealed shaft-heads and spoil heaps,
// a border keep watching the deposits, and behind it all the mountains that
// hold the thing the entire war is about. The player looks at the war's cause
// and cannot walk to it. That is the most useful vista this town could have.
//
// The town is dead flat (HARTHMERE_EXTENSION_GROUND_Y = 52). Rising ground
// behind it is the cheapest possible way to make the place feel sited rather
// than stamped.
//
// NON-NEGOTIABLE SAFETY PROPERTIES (all tested):
//   1. Never writes a voxel west of the boundary — the town is untouched.
//   2. Never writes at or beyond the world's east edge — the existing world
//      boundary keeps owning the true edge, and its purple wall must remain
//      the outermost thing.
//   3. The north/south/west approaches are not walled. Only the back is.

import type { Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "@/shared/harthmere/world_extension";
import {
  harthmereExplicitNoise,
  harthmereLinearBoundary,
  harthmereUpwardBiasedNoise,
} from "@/shared/harthmere/harthmere_horizon_noise";

export const HARTHMERE_TOWN_HORIZON_VERSION =
  "harthmere-town-horizon-v2-runtime-collision" as const;

/** Materials, matching the shim's localDevMaterials() palette keys. */
export type HarthmereHorizonMaterial =
  | "grass"
  | "dirt"
  | "stone"
  | "gravel"
  | "cobblestone"
  | "cobblestoneBrick"
  | "stoneBrick"
  | "stonePolished"
  | "stoneShingles"
  | "limestoneBrick"
  | "oakLog"
  | "oakLumber"
  | "thatch"
  | "hay"
  | "soil"
  | "moss"
  | "coal"
  | "ironOre"
  | "whiteWool"
  | "blackWool";

// ---------------------------------------------------------------------------
// Geometry — authored X, matching the rest of the town's authored space
// ---------------------------------------------------------------------------

/** East edge of authored town content (buildings reach x=768). */
export const HARTHMERE_TOWN_EAST_CONTENT_X = 768;
/** Breathing room between the last building and the wall. */
export const HARTHMERE_TOWN_BACK_MARGIN = 10;
/** Authored X of the back boundary. Everything east of this is scenery. */
export const HARTHMERE_TOWN_BACK_BOUNDARY_X =
  HARTHMERE_TOWN_EAST_CONTENT_X + HARTHMERE_TOWN_BACK_MARGIN; // 778

/**
 * Authored X of the world's east edge. The backdrop stops SHORT of this so the
 * engine's own world boundary remains the outermost thing in the frame — two
 * walls in the same place would z-fight and read as a bug.
 */
export const HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X =
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X - HARTHMERE_ADDITIVE_TOWN_OFFSET_X; // 960
export const HARTHMERE_TOWN_BACKDROP_END_X =
  HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X - 4; // 956

/** Z extent of the backdrop, clamped to the extension's own world bounds. */
export const HARTHMERE_TOWN_BACKDROP_MIN_Z =
  HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ + 4;
export const HARTHMERE_TOWN_BACKDROP_MAX_Z =
  HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ - 4;

/** The flat town ground. Backdrop heights are relative to this. */
export const HARTHMERE_TOWN_GROUND_Y = HARTHMERE_EXTENSION_GROUND_Y;
/** Ceiling of the back wall — high enough that the mountains sit under it. */
export const HARTHMERE_TOWN_BACK_WALL_TOP_Y = HARTHMERE_TOWN_GROUND_Y + 120;

export function harthmereTownAuthoredToWorldX(authoredX: number): number {
  return authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
}

/** Distance east of the back boundary. Negative means still in town. */
export function harthmereDistanceBehindTown(authoredX: number): number {
  return authoredX - HARTHMERE_TOWN_BACK_BOUNDARY_X;
}

export function harthmereIsBackCountry(
  authoredX: number,
  worldZ: number
): boolean {
  return (
    authoredX > HARTHMERE_TOWN_BACK_BOUNDARY_X &&
    authoredX <= HARTHMERE_TOWN_BACKDROP_END_X &&
    worldZ >= HARTHMERE_TOWN_BACKDROP_MIN_Z &&
    worldZ <= HARTHMERE_TOWN_BACKDROP_MAX_Z
  );
}

// ---------------------------------------------------------------------------
// Collision — a single slab, not six
// ---------------------------------------------------------------------------

export type HarthmereHorizonAabb = readonly [Vec3, Vec3];

/**
 * Blocking slab for an entity that has walked east past the back boundary.
 *
 * The dungeon horizon synthesises up to six slabs because a dungeon is a
 * closed box. Harthmere is open on three sides, so there is exactly ONE test
 * and ONE slab. Same principle — hand the ordinary swept-AABB resolver a
 * region so deep it is effectively infinite — with five sixths of the work
 * removed because five sixths of the walls do not exist.
 *
 * The slab deliberately spans the full extension Z range and a tall Y range:
 * you cannot walk around it or jump over it, but you can still leave town by
 * every route that was open before.
 */
export function harthmereTownBackBoundarySlabs(
  entityAabb: HarthmereHorizonAabb
): HarthmereHorizonAabb[] {
  const boundaryWorldX = harthmereTownAuthoredToWorldX(
    HARTHMERE_TOWN_BACK_BOUNDARY_X
  );
  const [lo, hi] = entityAabb;
  if (
    hi[0] <= boundaryWorldX ||
    // The Elsewhen dungeon band begins east of the additive town's old world
    // edge. Its own closed barriers must apply there; the town's back wall
    // must not turn either teleported dungeon interior into one giant solid.
    lo[0] >= HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X
  ) {
    return [];
  }
  // One slab, from the boundary east to well past the world edge, so nothing
  // can squeeze between this and the engine's own boundary.
  const depth = HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X - boundaryWorldX + 256;
  return [
    [
      [boundaryWorldX, -64, HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ - 64],
      [
        boundaryWorldX + depth,
        HARTHMERE_TOWN_BACK_WALL_TOP_Y + 256,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ + 64,
      ],
    ],
  ];
}

// ---------------------------------------------------------------------------
// Art direction
//
// Harthmere rejects Exotic Matter, so its landscape vocabulary is stone,
// timber, coal and worked earth. No sand, no exotic glow. Snow appears only as
// a three-voxel cap on the far peaks, exactly as the shipped world does it.
// ---------------------------------------------------------------------------

export interface HarthmereHorizonBand {
  name: string;
  /** Distance behind the boundary at which this band starts. */
  fromDistance: number;
  toDistance: number;
  heightSeed: string;
  heightPeriod: number;
  /** Weight vector IS the landform. */
  heightWeights: readonly number[];
  amplitude: number;
  /** Surface-first stratigraphic column. */
  column: readonly HarthmereHorizonMaterial[];
  note: string;
}

/**
 * Three bands, near to far. Reading them in order is the story the vista
 * tells: worked land, then the industry they refuse, then the reason.
 */
export const HARTHMERE_HORIZON_BANDS: readonly HarthmereHorizonBand[] =
  Object.freeze([
    {
      name: "terraced_farms",
      fromDistance: 0,
      toDistance: 56,
      // Gentle: mostly one low frequency so the rise is a slope, not lumps.
      heightSeed: "harthmere_back_farms",
      heightPeriod: 96,
      heightWeights: [5, 0, 1.5, 0.5],
      amplitude: 12,
      column: ["grass", "soil", "dirt", "dirt", "stone"],
      note: "Ploughed terraces climbing away from the wall. Ordinary, worked, lived-in.",
    },
    {
      name: "the_workings",
      fromDistance: 56,
      toDistance: 132,
      // Broken ground: energy at mid frequencies gives spoil heaps and cuts.
      heightSeed: "harthmere_back_workings",
      heightPeriod: 128,
      heightWeights: [8, 6, 4, 2, 1],
      amplitude: 34,
      column: ["gravel", "gravel", "dirt", "coal", "stone", "stone"],
      note: "Spoil heaps and sealed cuttings. Coal in the column: this is mining country.",
    },
    {
      name: "the_deposit_range",
      fromDistance: 132,
      toDistance: 178,
      // Mountains: strong at every octave, exponent applied below.
      heightSeed: "harthmere_back_range",
      heightPeriod: 176,
      heightWeights: [12, 9, 6, 3, 1.5, 0.5],
      amplitude: 86,
      column: ["stone", "stone", "cobblestone", "stone", "ironOre", "stone"],
      note: "The range that holds the antimatter. The reason for the coming war, in the skybox.",
    },
  ]);

/** Snow: a three-voxel cap over stone, above a noisy line. Never a drift. */
export const HARTHMERE_HORIZON_SNOW = Object.freeze({
  material: "whiteWool" as HarthmereHorizonMaterial,
  depth: 3,
  minHeightAboveGround: 62,
  noiseSeed: "harthmere_back_snowline",
});

function bandFor(distance: number): HarthmereHorizonBand | undefined {
  return HARTHMERE_HORIZON_BANDS.find(
    (band) => distance >= band.fromDistance && distance < band.toDistance
  );
}

// ---------------------------------------------------------------------------
// Buildings behind the wall
// ---------------------------------------------------------------------------

export interface HarthmereHorizonBuilding {
  name: string;
  /** Authored X. Must be east of the boundary. */
  x0: number;
  x1: number;
  /** World Z, matching the town's own authored-Z convention. */
  z0: number;
  z1: number;
  height: number;
  wall: HarthmereHorizonMaterial;
  roof: HarthmereHorizonMaterial;
  tiers?: number;
  note: string;
}

export const HARTHMERE_HORIZON_BUILDINGS: readonly HarthmereHorizonBuilding[] =
  Object.freeze([
    {
      name: "back_farm_steadings",
      x0: 800,
      x1: 840,
      z0: -300,
      z1: -262,
      height: 9,
      wall: "cobblestone",
      roof: "thatch",
      note: "Two steadings on the terraces. Thatch and stone: ordinary Harthmere.",
    },
    {
      name: "north_tithe_barn",
      x0: 796,
      x1: 828,
      z0: -196,
      z1: -168,
      height: 13,
      wall: "stoneBrick",
      roof: "stoneShingles",
      note: "The tithe barn. Big, plain, and obviously in use.",
    },
    {
      name: "sealed_shaft_head",
      x0: 862,
      x1: 890,
      z0: -280,
      z1: -252,
      height: 20,
      wall: "oakLog",
      roof: "blackWool",
      tiers: 2,
      note: "A headframe over a shaft Harthmere sealed. The refusal, made visible.",
    },
    {
      name: "second_shaft_head",
      x0: 858,
      x1: 882,
      z0: -180,
      z1: -158,
      height: 17,
      wall: "oakLog",
      roof: "blackWool",
      tiers: 2,
      note: "A second headframe. One is an accident; two is a policy.",
    },
    {
      name: "border_keep",
      x0: 896,
      x1: 936,
      z0: -244,
      z1: -204,
      height: 46,
      wall: "stoneBrick",
      roof: "stonePolished",
      tiers: 4,
      note: "The keep watching the deposits. The tall silhouette that anchors the whole vista.",
    },
    {
      name: "back_curtain_wall",
      x0: 848,
      x1: 856,
      z0: -368,
      z1: -96,
      height: 18,
      wall: "stoneBrick",
      roof: "stoneBrick",
      note: "A long curtain wall across the workings. Reads as a defended border, not open country.",
    },
  ]);

function buildingAt(
  authoredX: number,
  worldZ: number
): HarthmereHorizonBuilding | undefined {
  return HARTHMERE_HORIZON_BUILDINGS.find(
    (b) =>
      authoredX >= b.x0 &&
      authoredX <= b.x1 &&
      worldZ >= b.z0 &&
      worldZ <= b.z1
  );
}

// ---------------------------------------------------------------------------
// Voxel query
// ---------------------------------------------------------------------------

/** Backdrop surface height in world Y at an authored X / world Z. */
export function harthmereHorizonSurfaceY(
  authoredX: number,
  worldZ: number
): number {
  const distance = harthmereDistanceBehindTown(authoredX);
  if (distance <= 0) {
    return HARTHMERE_TOWN_GROUND_Y;
  }
  const band = bandFor(distance);
  if (!band) {
    // Past the last band: hold the range's height so the skyline does not
    // fall off a cliff at the far edge.
    const last = HARTHMERE_HORIZON_BANDS[HARTHMERE_HORIZON_BANDS.length - 1];
    return harthmereHorizonSurfaceY(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + last.toDistance - 1,
      worldZ
    );
  }
  // Feather from the boundary so the land RISES rather than starting as a
  // cliff. Feathering over the first band's whole width keeps the near ground
  // walkable-looking and the transition invisible.
  const feather = harthmereLinearBoundary(
    distance,
    HARTHMERE_HORIZON_BANDS[0].toDistance
  );
  const lift =
    harthmereUpwardBiasedNoise(
      band.heightSeed,
      authoredX,
      worldZ,
      band.heightPeriod,
      band.heightWeights
    ) * band.amplitude;
  // Bands accumulate: the range sits on top of the workings, which sit on the
  // farms, so the profile climbs monotonically away from town.
  let base = 0;
  for (const earlier of HARTHMERE_HORIZON_BANDS) {
    if (earlier.name === band.name) {
      break;
    }
    base += earlier.amplitude * 0.55;
  }
  return Math.round(HARTHMERE_TOWN_GROUND_Y + feather * (base + lift));
}

/**
 * Solid block at an authored X / world Y / world Z, or undefined for air.
 *
 * SAFETY: returns undefined for anything at or west of the back boundary, and
 * for anything at or beyond the world's east edge.
 */
export function harthmereHorizonBlockAt(
  authoredX: number,
  worldY: number,
  worldZ: number
): HarthmereHorizonMaterial | undefined {
  if (!harthmereIsBackCountry(authoredX, worldZ)) {
    return undefined;
  }
  const surface = harthmereHorizonSurfaceY(authoredX, worldZ);

  const building = buildingAt(authoredX, worldZ);
  if (building) {
    const tiers = building.tiers ?? 1;
    const insetX = (building.x1 - building.x0) / (tiers * 2 + 2);
    const insetZ = (building.z1 - building.z0) / (tiers * 2 + 2);
    for (let tier = tiers - 1; tier >= 0; tier--) {
      const tx0 = building.x0 + insetX * tier;
      const tx1 = building.x1 - insetX * tier;
      const tz0 = building.z0 + insetZ * tier;
      const tz1 = building.z1 - insetZ * tier;
      if (authoredX < tx0 || authoredX > tx1 || worldZ < tz0 || worldZ > tz1) {
        continue;
      }
      const top = surface + Math.round((building.height * (tier + 1)) / tiers);
      if (worldY > top) {
        continue;
      }
      if (worldY < surface) {
        break;
      }
      return worldY === top ? building.roof : building.wall;
    }
  }

  if (worldY > surface) {
    return undefined;
  }
  const depth = surface - worldY;

  // Snow cap on the high peaks only.
  const snowNoise =
    harthmereExplicitNoise(
      HARTHMERE_HORIZON_SNOW.noiseSeed,
      authoredX,
      worldZ,
      96,
      [8, 4, 2]
    ) * 1.4;
  if (
    surface - HARTHMERE_TOWN_GROUND_Y >=
      HARTHMERE_HORIZON_SNOW.minHeightAboveGround + snowNoise &&
    depth < HARTHMERE_HORIZON_SNOW.depth
  ) {
    return HARTHMERE_HORIZON_SNOW.material;
  }

  const band =
    bandFor(harthmereDistanceBehindTown(authoredX)) ??
    HARTHMERE_HORIZON_BANDS[HARTHMERE_HORIZON_BANDS.length - 1];
  if (depth < band.column.length) {
    return band.column[depth];
  }
  return "stone";
}

/**
 * SEEDER INTEGRATION
 *
 * The additive-town seeder already walks authored coordinates. Adding the back
 * country is one extra call, AFTER the town has had its say:
 *
 * ```ts
 * const block =
 *   starterTownAboveGroundBlockAt(materials, x, y, z) ??
 *   harthmereHorizonBlockAt(x, y, z);
 * ```
 *
 * The town always wins, and `harthmereHorizonBlockAt` refuses to return
 * anything west of the boundary anyway, so the two cannot disagree.
 */
export function harthmereTownSeederBlockAt(
  authoredX: number,
  worldY: number,
  worldZ: number,
  townBlock: HarthmereHorizonMaterial | undefined
): HarthmereHorizonMaterial | undefined {
  return townBlock ?? harthmereHorizonBlockAt(authoredX, worldY, worldZ);
}

// ---------------------------------------------------------------------------
// Back-wall visual contract
//
// Lives here, not in the renderer: pure constants and pure maths, so the
// contract is testable in ~1 s without dragging the client graph into the
// scoped typecheck. (Learned the hard way on the dungeon horizon.)
// ---------------------------------------------------------------------------

/** Quintic fade reaches zero here. */
export const HARTHMERE_BACK_WALL_FADE_DISTANCE = 40;
/** Cull threshold. MUST stay inside the fade so the wall never snaps in. */
export const HARTHMERE_BACK_WALL_DRAW_DISTANCE = 26;

/**
 * Distance from a position to the back wall plane. Only the X gap matters
 * while the player is within the wall's Z span; outside it they are nowhere
 * near the wall and it should not draw at all.
 */
export function harthmereBackWallDistance(
  position: readonly [number, number, number],
  wallWorldX: number,
  minZ: number,
  maxZ: number
): number {
  if (position[2] < minZ || position[2] > maxZ) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(position[0] - wallWorldX);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function harthmereValidateTownHorizon(): string[] {
  const errors: string[] = [];

  if (HARTHMERE_TOWN_BACK_BOUNDARY_X <= HARTHMERE_TOWN_EAST_CONTENT_X) {
    errors.push("the back boundary must sit east of the town's last building");
  }
  if (HARTHMERE_TOWN_BACKDROP_END_X >= HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X) {
    errors.push(
      "the backdrop must stop short of the world edge so the engine's own " +
        "boundary stays the outermost thing"
    );
  }

  // Bands must tile without gaps or overlaps, near to far.
  let expected = 0;
  for (const band of HARTHMERE_HORIZON_BANDS) {
    if (band.fromDistance !== expected) {
      errors.push(
        `band "${band.name}" starts at ${band.fromDistance}, expected ${expected}`
      );
    }
    if (band.toDistance <= band.fromDistance) {
      errors.push(`band "${band.name}" has no depth`);
    }
    if (band.column.length === 0 || band.column.length > 16) {
      errors.push(`band "${band.name}" column depth must be 1..16`);
    }
    if (band.amplitude <= 0) {
      errors.push(`band "${band.name}" has no amplitude`);
    }
    expected = band.toDistance;
  }
  const available =
    HARTHMERE_TOWN_BACKDROP_END_X - HARTHMERE_TOWN_BACK_BOUNDARY_X;
  if (expected > available) {
    errors.push(
      `bands need ${expected} voxels of depth but only ${available} exist ` +
        `between the boundary and the world edge`
    );
  }

  for (const building of HARTHMERE_HORIZON_BUILDINGS) {
    if (building.x0 <= HARTHMERE_TOWN_BACK_BOUNDARY_X) {
      errors.push(`${building.name}: reachable — it is west of the boundary`);
    }
    if (building.x1 > HARTHMERE_TOWN_BACKDROP_END_X) {
      errors.push(`${building.name}: extends past the backdrop's east edge`);
    }
    if (
      building.z0 < HARTHMERE_TOWN_BACKDROP_MIN_Z ||
      building.z1 > HARTHMERE_TOWN_BACKDROP_MAX_Z
    ) {
      errors.push(`${building.name}: outside the backdrop's Z range`);
    }
    if (building.height <= 0) {
      errors.push(`${building.name}: has no height`);
    }
    if ((building.tiers ?? 1) < 1) {
      errors.push(`${building.name}: tiers must be at least 1`);
    }
  }

  if (
    !HARTHMERE_HORIZON_BUILDINGS.some((building) => building.height >= 40)
  ) {
    errors.push(
      "the vista needs one tall silhouette to anchor it; nothing reaches 40"
    );
  }
  if (HARTHMERE_HORIZON_SNOW.depth !== 3) {
    errors.push("snow is a three-voxel cap, never a drift");
  }
  return errors;
}
