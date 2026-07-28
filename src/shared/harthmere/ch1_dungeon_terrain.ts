// CHAPTER_1_DUNGEON_TERRAIN
//
// Canonical, physically-placed terrain for both Chapter 1 dungeons.
//
// This module exists because the first pass authored the dungeons as pure
// narrative data — zones, encounters, retrievals — with no voxels behind them.
// That violates the snapshot map guide's Rule 3: "If players can stand on it,
// collide with it, climb it, harvest it, or see it on the map, it must be
// canonical data."
//
// It follows the same shape as the existing Harthmere underground
// (HARTHMERE_DUNGEON_AREAS + harthmereDungeonBlockAt +
// harthmereShouldCarveDungeonAirBlockAt in src/server/shim/main.ts) so the
// server seeder can consume it with the code path it already has.
//
// LAYER OWNERSHIP (docs/harthmere/HARTHMERE_BUILDING_AND_DECORATION_DESIGN_GUIDE.md):
//   voxel terrain owns  -> foundation, floor, walls, ceiling, roof, stairs,
//                          door openings, window cutouts, water basins
//   runtime props own   -> furniture, lights, stock, banners, skulls, kegs
//                          (non-blocking; the voxel shell owns collision)
//
// Authored coordinates are LOCAL to a dungeon slot and converted once, at the
// boundary, by ch1DungeonAuthoredToWorld(). Per the guide's Step 1: do not
// scatter offsets through the codebase and never apply one twice.

import type { Vec3 } from "@/shared/math/types";
import {
  CH1_ELSEWHEN_FEET_Y,
  CH1_ELSEWHEN_GROUND_Y,
  ch1ElsewhenSlot,
  isInsideCh1ElsewhenBand,
} from "@/shared/harthmere/ch1_elsewhen_region";

export const CH1_DUNGEON_TERRAIN_VERSION =
  "ch1-dungeon-terrain-v5-native-winter-snow-ice" as const;

// ---------------------------------------------------------------------------
// Materials
//
// Names match the keys of localDevMaterials() in src/server/shim/main.ts so the
// seeder can index straight into the existing palette. Adding a name here that
// the palette does not have is caught by ch1_dungeon_terrain.test.ts.
// ---------------------------------------------------------------------------

export const CH1_TERRAIN_MATERIALS = [
  "grass",
  "dirt",
  "stone",
  "gravel",
  "cobblestone",
  "cobblestoneBrick",
  "oakLog",
  "oakLumber",
  "oakLeaf",
  "stoneBrick",
  "stonePolished",
  "stoneShingles",
  "limestoneBrick",
  "simpleGlass",
  "hay",
  "thatch",
  "soil",
  "woodCrate",
  "led",
  "moss",
  "muckwad",
  "sand",
  "snow",
  "ice",
  "whiteWool",
  "blueWool",
  "blackWool",
  "redWool",
  "yellowWool",
  "coal",
  "ironOre",
  "silverOre",
  "goldOre",
  "water",
] as const;
export type Ch1TerrainMaterial = (typeof CH1_TERRAIN_MATERIALS)[number];

// ---------------------------------------------------------------------------
// Coordinate transform (Step 1 of the recipe)
// ---------------------------------------------------------------------------

/**
 * Local authored space for a dungeon:
 *   x: 0..511 across the slot
 *   y: relative to CH1_ELSEWHEN_GROUND_Y (0 == ground, negative == below)
 *   z: -256..255, centred on the slot
 */
export interface Ch1AuthoredPos {
  x: number;
  y: number;
  z: number;
}

export const CH1_DUNGEON_LOCAL_Z_ORIGIN = -256;

export function ch1DungeonAuthoredToWorld(
  dungeonId: string,
  local: Ch1AuthoredPos
): Vec3 {
  const slot = ch1ElsewhenSlot(dungeonId);
  if (!slot) {
    throw new Error(`no Elsewhen slot reserved for dungeon: ${dungeonId}`);
  }
  return [
    slot.minX + local.x,
    CH1_ELSEWHEN_GROUND_Y + local.y,
    CH1_DUNGEON_LOCAL_Z_ORIGIN + local.z,
  ];
}

export function ch1DungeonWorldToAuthored(
  dungeonId: string,
  world: Vec3
): Ch1AuthoredPos {
  const slot = ch1ElsewhenSlot(dungeonId);
  if (!slot) {
    throw new Error(`no Elsewhen slot reserved for dungeon: ${dungeonId}`);
  }
  return {
    x: world[0] - slot.minX,
    y: world[1] - CH1_ELSEWHEN_GROUND_Y,
    z: world[2] - CH1_DUNGEON_LOCAL_Z_ORIGIN,
  };
}

// ---------------------------------------------------------------------------
// Volumes
// ---------------------------------------------------------------------------

/**
 * A carved space. Boundary faces become solid shell; the interior becomes air.
 * Mirrors the HARTHMERE_DUNGEON_AREAS contract exactly.
 */
export interface Ch1DungeonVolume {
  name: string;
  /** Which authored zone this belongs to. */
  zoneId: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Authored Y, relative to ground. */
  y0: number;
  y1: number;
  /** Shell material for walls/ceiling. */
  shell: Ch1TerrainMaterial;
  /** Walkable floor material. */
  floor: Ch1TerrainMaterial;
  /** Open to the sky — no ceiling is generated. Desert exteriors use this. */
  openAir?: boolean;
  /**
   * Landscape sectors are lands, not rooms with the roof removed. When true,
   * the rectangular boundary is only an authoring/carving bound: no wall is
   * generated on its four sides. Hills, water, trees, ruins, and the void gap
   * provide the visual/physical edge instead.
   */
  openSides?: boolean;
}

/**
 * A doorway or corridor mouth punched through a shell. Two voxels tall
 * minimum, with clearance either side, per the building guide.
 */
export interface Ch1DungeonPortalCut {
  name: string;
  /** The two volumes this connects. Order is not significant. */
  connects: readonly [string, string];
  /** Centre of the opening, in authored space. */
  x: number;
  z: number;
  /** Floor Y of the opening. The cut spans y..y+height-1. */
  y: number;
  height: number;
  /** Width perpendicular to the wall. */
  width: number;
  axis: "x" | "z";
}

/** Water basins become shard_water, not a fake plane (recipe Step 6). */
export interface Ch1DungeonWaterVolume {
  name: string;
  zoneId: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  /** Basin floor must exist beneath the water or it drains into the void. */
  basinFloor: Ch1TerrainMaterial;
}

/** Stairs between two floor heights (recipe Step 5). */
export interface Ch1DungeonStairs {
  name: string;
  zoneId: string;
  x0: number;
  z0: number;
  direction: "north" | "south" | "east" | "west";
  /** Authored Y of the bottom step. */
  fromY: number;
  toY: number;
  width: number;
  material: Ch1TerrainMaterial;
}

/**
 * Small deterministic voxel landforms used to break the rectangular authoring
 * volumes into readable outdoor biomes. These stay deliberately primitive:
 * they seed canonical terrain, appear on maps, collide normally, and require
 * no client-only mesh generator.
 */
export type Ch1DungeonLandscapeFeature =
  | {
      kind: "mound";
      name: string;
      zoneId: string;
      centerX: number;
      centerZ: number;
      baseY: number;
      radiusX: number;
      radiusZ: number;
      height: number;
      material: Ch1TerrainMaterial;
      capMaterial?: Ch1TerrainMaterial;
    }
  | {
      kind: "tree";
      name: string;
      zoneId: string;
      x: number;
      z: number;
      baseY: number;
      trunkHeight: number;
      canopyRadius: number;
      trunkMaterial: Ch1TerrainMaterial;
      leafMaterial: Ch1TerrainMaterial;
      snowMaterial?: Ch1TerrainMaterial;
    }
  | {
      /**
       * A canonical voxel building shell. Land dungeons are not empty outdoor
       * arenas: the lore can call for bazaars, houses, halls, sheds, temples,
       * or drowned structures inside the landscape. The floor remains owned
       * by the host terrain volume, while this feature owns walls and roof.
       */
      kind: "building";
      name: string;
      zoneId: string;
      x0: number;
      x1: number;
      z0: number;
      z1: number;
      /** First solid wall voxel / walkable interior level. */
      baseY: number;
      wallHeight: number;
      wallMaterial: Ch1TerrainMaterial;
      roofMaterial: Ch1TerrainMaterial;
      /** Native snow cap above the structural roof; never a wool substitute. */
      snowMaterial?: Ch1TerrainMaterial;
      roof: "flat" | "gableX" | "gableZ" | "open";
      roofRise?: number;
      door?: {
        side: "north" | "south" | "east" | "west";
        center: number;
        width: number;
        height: number;
      };
      /** Sparse openings break up blank facades without becoming climb routes. */
      windowSpacing?: number;
      ruined?: boolean;
    }
  | {
      /** Low ruins, fortification runs, parapets, platforms, and beams. */
      kind: "wall";
      name: string;
      zoneId: string;
      x0: number;
      x1: number;
      z0: number;
      z1: number;
      baseY: number;
      height: number;
      material: Ch1TerrainMaterial;
      capMaterial?: Ch1TerrainMaterial;
      /** Every third top block is omitted to make an old/broken silhouette. */
      ruined?: boolean;
    }
  | {
      /** Pillars, standing stones, gate posts, and interior colonnades. */
      kind: "column";
      name: string;
      zoneId: string;
      x: number;
      z: number;
      baseY: number;
      height: number;
      radius: number;
      material: Ch1TerrainMaterial;
      capMaterial?: Ch1TerrainMaterial;
    };

type Ch1BuildingFeature = Extract<
  Ch1DungeonLandscapeFeature,
  { kind: "building" }
>;
type Ch1WallFeature = Extract<
  Ch1DungeonLandscapeFeature,
  { kind: "wall" }
>;
type Ch1ColumnFeature = Extract<
  Ch1DungeonLandscapeFeature,
  { kind: "column" }
>;

function building(
  feature: Omit<Ch1BuildingFeature, "kind">
): Ch1BuildingFeature {
  return { kind: "building", ...feature };
}

function wall(feature: Omit<Ch1WallFeature, "kind">): Ch1WallFeature {
  return { kind: "wall", ...feature };
}

function column(
  feature: Omit<Ch1ColumnFeature, "kind">
): Ch1ColumnFeature {
  return { kind: "column", ...feature };
}

// ---------------------------------------------------------------------------
// Dungeon 1 — The Sand That Remembers
//
// A Bronze Age river-valley city, evacuated six weeks ago, built over a
// natural Exotic Matter outcrop. Layout runs west (arrival dune) to east
// (return aperture) so the Long Walk is a straight, legible retreat.
// ---------------------------------------------------------------------------

const DESERT_VOLUMES: readonly Ch1DungeonVolume[] = [
  {
    name: "dune_threshold",
    zoneId: "d1_z1_dune_threshold",
    x0: 40,
    x1: 96,
    z0: -80,
    z1: -24,
    y0: 16,
    y1: 26,
    shell: "sand",
    floor: "sand",
    openAir: true,
    openSides: true,
  },
  {
    // The ramp corridor. Its Y range deliberately SPANS both the dune crest
    // and the market floor: two volumes joined by a doorway must share a Y
    // band, or the opening lands in solid rock at one end.
    name: "descent_road",
    zoneId: "d1_z1_dune_threshold",
    x0: 96,
    x1: 148,
    z0: -60,
    z1: -46,
    y0: 2,
    y1: 20,
    shell: "sand",
    floor: "gravel",
    openAir: true,
    openSides: true,
  },
  {
    name: "salt_market",
    zoneId: "d1_z2_salt_market",
    x0: 148,
    x1: 208,
    z0: -84,
    z1: -24,
    y0: 2,
    y1: 11,
    shell: "limestoneBrick",
    floor: "cobblestone",
    openAir: true,
    openSides: true,
  },
  {
    // Stair shaft down to the undercroft. Spans market floor to cellar floor.
    name: "market_stair_shaft",
    zoneId: "d1_z2_salt_market",
    x0: 166,
    x1: 176,
    z0: -72,
    z1: -60,
    y0: -7,
    y1: 11,
    shell: "limestoneBrick",
    floor: "stoneBrick",
  },
  {
    name: "market_undercroft",
    zoneId: "d1_z2_salt_market",
    x0: 160,
    x1: 190,
    z0: -72,
    z1: -50,
    y0: -7,
    y1: -1,
    shell: "limestoneBrick",
    floor: "stoneBrick",
  },
  {
    // The cistern descent. Spans the undercroft floor all the way down to the
    // cistern floor so both doorways are legal at their own heights.
    name: "cistern_stair_head",
    zoneId: "d1_z3_cistern_stair",
    x0: 190,
    x1: 224,
    z0: -64,
    z1: -48,
    y0: -22,
    y1: -1,
    shell: "stoneBrick",
    floor: "stoneBrick",
  },
  {
    name: "cistern_main",
    zoneId: "d1_z3_cistern_stair",
    x0: 224,
    x1: 276,
    z0: -80,
    z1: -32,
    y0: -22,
    y1: -8,
    shell: "stoneBrick",
    floor: "stonePolished",
  },
  {
    name: "hall_of_weights",
    zoneId: "d1_z4_hall_of_weights",
    x0: 276,
    x1: 316,
    z0: -72,
    z1: -40,
    y0: -22,
    y1: -13,
    shell: "stonePolished",
    floor: "stonePolished",
  },
  {
    name: "sun_court",
    zoneId: "d1_z5_sun_court",
    x0: 316,
    x1: 368,
    z0: -80,
    z1: -32,
    y0: -22,
    y1: -10,
    shell: "limestoneBrick",
    floor: "stonePolished",
    // A sun court must read as a courtyard under the wrong-coloured sky. The
    // perimeter remains temple wall; only the old accidental lid is removed.
    openAir: true,
  },
  {
    name: "seed_vault",
    zoneId: "d1_z6_seed_vault",
    x0: 368,
    x1: 404,
    z0: -70,
    z1: -42,
    y0: -22,
    y1: -14,
    shell: "stoneBrick",
    floor: "oakLumber",
  },
  {
    name: "vault_exit_stair",
    zoneId: "d1_z7_the_long_walk",
    x0: 404,
    x1: 416,
    z0: -60,
    z1: -50,
    y0: -22,
    y1: 1,
    shell: "stoneBrick",
    floor: "stoneBrick",
  },
  {
    name: "the_long_flat",
    zoneId: "d1_z7_the_long_walk",
    x0: 416,
    x1: 504,
    z0: -80,
    z1: -24,
    y0: 0,
    y1: 10,
    shell: "sand",
    floor: "sand",
    openAir: true,
    openSides: true,
  },
];

const DESERT_CUTS: readonly Ch1DungeonPortalCut[] = [
  {
    name: "dune_to_road",
    connects: ["dune_threshold", "descent_road"],
    x: 96,
    z: -53,
    y: 17,
    height: 3,
    width: 6,
    axis: "x",
  },
  {
    name: "road_to_market",
    connects: ["descent_road", "salt_market"],
    x: 148,
    z: -53,
    y: 3,
    height: 3,
    width: 6,
    axis: "x",
  },
  {
    name: "market_to_stair_shaft",
    connects: ["salt_market", "market_stair_shaft"],
    x: 171,
    z: -60,
    y: 3,
    height: 3,
    width: 4,
    axis: "z",
  },
  {
    name: "stair_shaft_to_undercroft",
    connects: ["market_stair_shaft", "market_undercroft"],
    x: 171,
    z: -72,
    y: -6,
    height: 3,
    width: 4,
    axis: "z",
  },
  {
    name: "undercroft_to_stair_head",
    connects: ["market_undercroft", "cistern_stair_head"],
    x: 190,
    z: -56,
    y: -6,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "stair_head_to_cistern",
    connects: ["cistern_stair_head", "cistern_main"],
    x: 224,
    z: -56,
    y: -21,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "cistern_to_weights",
    connects: ["cistern_main", "hall_of_weights"],
    x: 276,
    z: -56,
    y: -21,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "weights_to_sun_court",
    connects: ["hall_of_weights", "sun_court"],
    x: 316,
    z: -56,
    y: -21,
    height: 4,
    width: 6,
    axis: "x",
  },
  {
    name: "sun_court_to_vault",
    connects: ["sun_court", "seed_vault"],
    x: 368,
    z: -56,
    y: -21,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "vault_to_exit_stair",
    connects: ["seed_vault", "vault_exit_stair"],
    x: 404,
    z: -55,
    y: -21,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "exit_stair_to_flat",
    connects: ["vault_exit_stair", "the_long_flat"],
    x: 416,
    z: -55,
    y: 1,
    height: 3,
    width: 4,
    axis: "x",
  },
];

const DESERT_WATER: readonly Ch1DungeonWaterVolume[] = [
  {
    // The market grew around a spring-fed date-palm court. Keeping this as
    // native shard water gives the exterior a real river-valley identity and
    // avoids the old empty-stone-room read.
    name: "salt_market_oasis",
    zoneId: "d1_z2_salt_market",
    x0: 184,
    x1: 200,
    z0: -82,
    z1: -70,
    y0: 3,
    y1: 4,
    basinFloor: "limestoneBrick",
  },
  {
    // The cistern is partly flooded and the level moves as sluices fail. The
    // basin is real terrain; the water is shard_water, never a fake plane.
    name: "cistern_pool",
    zoneId: "d1_z3_cistern_stair",
    x0: 232,
    x1: 268,
    z0: -74,
    z1: -38,
    y0: -21,
    y1: -17,
    basinFloor: "stonePolished",
  },
];

const DESERT_STAIRS: readonly Ch1DungeonStairs[] = [
  {
    name: "descent_road_ramp",
    zoneId: "d1_z1_dune_threshold",
    x0: 100,
    z0: -56,
    direction: "east",
    fromY: 17,
    toY: 3,
    width: 6,
    material: "gravel",
  },
  {
    name: "undercroft_stair",
    zoneId: "d1_z2_salt_market",
    x0: 168,
    z0: -62,
    direction: "south",
    fromY: 3,
    toY: -6,
    width: 3,
    material: "limestoneBrick",
  },
  {
    name: "cistern_stair",
    zoneId: "d1_z3_cistern_stair",
    x0: 210,
    z0: -58,
    direction: "east",
    fromY: -6,
    toY: -21,
    width: 3,
    material: "stoneBrick",
  },
  {
    name: "vault_exit_climb",
    zoneId: "d1_z7_the_long_walk",
    x0: 406,
    z0: -56,
    direction: "east",
    fromY: -21,
    toY: 1,
    width: 3,
    material: "stoneBrick",
  },
];

const DESERT_LANDSCAPE: readonly Ch1DungeonLandscapeFeature[] = [
  {
    kind: "mound",
    name: "threshold_south_dune",
    zoneId: "d1_z1_dune_threshold",
    centerX: 58,
    centerZ: -30,
    baseY: 17,
    radiusX: 13,
    radiusZ: 10,
    height: 6,
    material: "sand",
  },
  {
    kind: "mound",
    name: "threshold_north_dune",
    zoneId: "d1_z1_dune_threshold",
    centerX: 84,
    centerZ: -73,
    baseY: 17,
    radiusX: 10,
    radiusZ: 8,
    height: 5,
    material: "sand",
  },
  {
    kind: "tree",
    name: "market_oasis_palm_west",
    zoneId: "d1_z2_salt_market",
    x: 156,
    z: -77,
    baseY: 3,
    trunkHeight: 5,
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
  },
  {
    kind: "tree",
    name: "market_oasis_palm_east",
    zoneId: "d1_z2_salt_market",
    x: 201,
    z: -31,
    baseY: 3,
    trunkHeight: 5,
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
  },
  {
    kind: "mound",
    name: "long_walk_north_dune",
    zoneId: "d1_z7_the_long_walk",
    centerX: 438,
    centerZ: -75,
    baseY: 1,
    radiusX: 16,
    radiusZ: 7,
    height: 5,
    material: "sand",
  },
  {
    kind: "mound",
    name: "long_walk_south_dune",
    zoneId: "d1_z7_the_long_walk",
    centerX: 486,
    centerZ: -29,
    baseY: 1,
    radiusX: 15,
    radiusZ: 8,
    height: 6,
    material: "sand",
  },
  // --- Dune Threshold: a crest with an actual city silhouette beyond it ---
  building({
    name: "threshold_gate_tower_north",
    zoneId: "d1_z1_dune_threshold",
    x0: 84,
    x1: 94,
    z0: -79,
    z1: -68,
    baseY: 17,
    wallHeight: 11,
    wallMaterial: "limestoneBrick",
    roofMaterial: "stonePolished",
    roof: "flat",
    windowSpacing: 5,
    ruined: true,
  }),
  building({
    name: "threshold_gate_tower_south",
    zoneId: "d1_z1_dune_threshold",
    x0: 84,
    x1: 94,
    z0: -40,
    z1: -26,
    baseY: 17,
    wallHeight: 9,
    wallMaterial: "limestoneBrick",
    roofMaterial: "stonePolished",
    roof: "flat",
    windowSpacing: 5,
    ruined: true,
  }),
  wall({
    name: "threshold_city_wall_north",
    zoneId: "d1_z1_dune_threshold",
    x0: 92,
    x1: 95,
    z0: -67,
    z1: -60,
    baseY: 17,
    height: 7,
    material: "limestoneBrick",
    capMaterial: "stonePolished",
    ruined: true,
  }),
  wall({
    name: "threshold_city_wall_south",
    zoneId: "d1_z1_dune_threshold",
    x0: 92,
    x1: 95,
    z0: -49,
    z1: -41,
    baseY: 17,
    height: 7,
    material: "limestoneBrick",
    capMaterial: "stonePolished",
    ruined: true,
  }),
  column({
    name: "threshold_road_marker_north",
    zoneId: "d1_z1_dune_threshold",
    x: 68,
    z: -72,
    baseY: 17,
    height: 9,
    radius: 1,
    material: "limestoneBrick",
    capMaterial: "goldOre",
  }),
  column({
    name: "threshold_road_marker_south",
    zoneId: "d1_z1_dune_threshold",
    x: 68,
    z: -36,
    baseY: 17,
    height: 8,
    radius: 1,
    material: "limestoneBrick",
    capMaterial: "goldOre",
  }),

  // --- Salt Market: dense mudbrick bazaar around the spring court --------
  ...[
    ["market_house_nw", 150, 165, -82, -72, 6],
    ["market_house_n", 171, 187, -83, -70, 7],
    ["market_house_ne", 193, 206, -82, -69, 6],
  ].map(([name, x0, x1, z0, z1, height]) =>
    building({
      name: String(name),
      zoneId: "d1_z2_salt_market",
      x0: Number(x0),
      x1: Number(x1),
      z0: Number(z0),
      z1: Number(z1),
      baseY: 3,
      wallHeight: Number(height),
      wallMaterial: "limestoneBrick",
      roofMaterial: "thatch",
      roof: "flat",
      door: {
        side: "south",
        center: Math.round((Number(x0) + Number(x1)) / 2),
        width: 2,
        height: 3,
      },
      windowSpacing: 6,
      ruined: true,
    })
  ),
  ...[
    ["market_house_sw", 150, 164, -39, -26, 6],
    ["market_house_s", 171, 188, -38, -25, 5],
    ["market_house_se", 194, 207, -39, -26, 7],
  ].map(([name, x0, x1, z0, z1, height]) =>
    building({
      name: String(name),
      zoneId: "d1_z2_salt_market",
      x0: Number(x0),
      x1: Number(x1),
      z0: Number(z0),
      z1: Number(z1),
      baseY: 3,
      wallHeight: Number(height),
      wallMaterial: "limestoneBrick",
      roofMaterial: "thatch",
      roof: "flat",
      door: {
        side: "north",
        center: Math.round((Number(x0) + Number(x1)) / 2),
        width: 2,
        height: 3,
      },
      windowSpacing: 6,
      ruined: true,
    })
  ),
  ...[160, 176, 192].flatMap((x, index) =>
    [-65, -45].map((z) =>
      column({
        name: `market_colonnade_${index}_${z < -50 ? "north" : "south"}`,
        zoneId: "d1_z2_salt_market",
        x,
        z,
        baseY: 3,
        height: 6 + (index % 2),
        radius: 0,
        material: "limestoneBrick",
        capMaterial: "stonePolished",
      })
    )
  ),
  ...[
    [181, -76],
    [195, -66],
    [188, -33],
    [202, -48],
  ].map(([x, z], index): Ch1DungeonLandscapeFeature => ({
    kind: "tree",
    name: `market_date_palm_${index + 1}`,
    zoneId: "d1_z2_salt_market",
    x,
    z,
    baseY: 3,
    trunkHeight: 5 + (index % 2),
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
  })),

  // --- Cistern: flooded engineering, bridge, and a forest of supports -----
  wall({
    name: "cistern_central_walkway",
    zoneId: "d1_z3_cistern_stair",
    x0: 226,
    x1: 273,
    z0: -58,
    z1: -54,
    baseY: -20,
    height: 2,
    material: "stonePolished",
    capMaterial: "stonePolished",
  }),
  ...[238, 250, 262].flatMap((x, index) =>
    [-70, -42].map((z) =>
      column({
        name: `cistern_support_${index}_${z < -50 ? "north" : "south"}`,
        zoneId: "d1_z3_cistern_stair",
        x,
        z,
        baseY: -20,
        height: 10,
        radius: 0,
        material: "stoneBrick",
        capMaterial: "stonePolished",
      })
    )
  ),

  // --- Hall of Weights: comparative-measure puzzle architecture ----------
  ...[282, 292, 304, 312].flatMap((x, index) =>
    [-68, -44].map((z) =>
      column({
        name: `weights_column_${index}_${z < -50 ? "north" : "south"}`,
        zoneId: "d1_z4_hall_of_weights",
        x,
        z,
        baseY: -21,
        height: 8,
        radius: 0,
        material: "stonePolished",
        capMaterial: "goldOre",
      })
    )
  ),
  wall({
    name: "weights_balance_dais",
    zoneId: "d1_z4_hall_of_weights",
    x0: 297,
    x1: 307,
    z0: -61,
    z1: -51,
    baseY: -21,
    height: 2,
    material: "stonePolished",
    capMaterial: "limestoneBrick",
  }),

  // --- Sun Court: open sky, temple colonnade, and bull-breaking pillars ---
  ...[323, 335, 349, 361].flatMap((x, index) =>
    [-74, -38].map((z) =>
      column({
        name: `sun_court_pillar_${index}_${z < -50 ? "north" : "south"}`,
        zoneId: "d1_z5_sun_court",
        x,
        z,
        baseY: -21,
        height: 11,
        radius: 1,
        material: "limestoneBrick",
        capMaterial: "goldOre",
      })
    )
  ),
  wall({
    name: "sun_court_bull_dais",
    zoneId: "d1_z5_sun_court",
    x0: 338,
    x1: 347,
    z0: -61,
    z1: -51,
    baseY: -21,
    height: 3,
    material: "stonePolished",
    capMaterial: "goldOre",
  }),
  building({
    name: "sun_court_north_shrine",
    zoneId: "d1_z5_sun_court",
    x0: 342,
    x1: 364,
    z0: -79,
    z1: -69,
    baseY: -21,
    wallHeight: 8,
    wallMaterial: "limestoneBrick",
    roofMaterial: "stoneShingles",
    roof: "flat",
    door: { side: "south", center: 353, width: 4, height: 4 },
    windowSpacing: 7,
    ruined: true,
  }),

  // --- Seed Vault: full granary aisles, not an empty wooden room ----------
  ...[374, 383, 392].flatMap((x, index) =>
    [-67, -50].map((z) =>
      wall({
        name: `seed_granary_bin_${index}_${z < -56 ? "north" : "south"}`,
        zoneId: "d1_z6_seed_vault",
        x0: x,
        x1: x + 5,
        z0: z,
        z1: z + 5,
        baseY: -21,
        height: 3,
        material: "oakLumber",
        capMaterial: "hay",
      })
    )
  ),
  ...[-67, -45].map((z, index) =>
    column({
      name: `seed_vault_index_column_${index}`,
      zoneId: "d1_z6_seed_vault",
      x: 386,
      z,
      baseY: -21,
      height: 7,
      radius: 0,
      material: "oakLog",
      capMaterial: "goldOre",
    })
  ),

  // --- Long Walk: ruined outskirts and a straight, threatening horizon ----
  ...[
    ["long_walk_ruin_nw", 420, 438, -78, -68, 6],
    ["long_walk_ruin_n", 449, 466, -79, -68, 7],
    ["long_walk_ruin_ne", 478, 499, -78, -67, 5],
    ["long_walk_ruin_sw", 424, 442, -39, -26, 5],
    ["long_walk_ruin_s", 454, 472, -38, -25, 7],
    ["long_walk_ruin_se", 483, 501, -40, -27, 6],
  ].map(([name, x0, x1, z0, z1, height], index) =>
    building({
      name: String(name),
      zoneId: "d1_z7_the_long_walk",
      x0: Number(x0),
      x1: Number(x1),
      z0: Number(z0),
      z1: Number(z1),
      baseY: 1,
      wallHeight: Number(height),
      wallMaterial: index % 2 === 0 ? "limestoneBrick" : "sand",
      roofMaterial: "thatch",
      roof: index % 3 === 0 ? "open" : "flat",
      windowSpacing: 6,
      ruined: true,
    })
  ),
  ...[-66, -44].flatMap((z, side) =>
    [432, 458, 486].map((x, index) =>
      column({
        name: `long_walk_waystone_${side}_${index}`,
        zoneId: "d1_z7_the_long_walk",
        x,
        z,
        baseY: 1,
        height: 5 + index,
        radius: 0,
        material: "limestoneBrick",
        capMaterial: "goldOre",
      })
    )
  ),
];

// ---------------------------------------------------------------------------
// Dungeon 2 — The Long Winter Mouth
//
// A Norse fjord stalled in the same winter for nine years. Runs south (ice
// shelf landing) to north (the Ash Hall), with the Whale Road crossing in the
// middle so the return trip re-uses it under load.
// ---------------------------------------------------------------------------

const WINTER_VOLUMES: readonly Ch1DungeonVolume[] = [
  {
    name: "ice_shelf_landing",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 24,
    x1: 80,
    z0: -112,
    z1: -64,
    y0: 0,
    y1: 12,
    shell: "ice",
    floor: "ice",
    openAir: true,
    openSides: true,
  },
  {
    // Descent shaft from the shelf down under the ice. Spans both Y bands.
    name: "landing_descent_shaft",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 66,
    x1: 80,
    z0: -100,
    z1: -76,
    y0: -12,
    y1: 12,
    shell: "ice",
    floor: "ice",
  },
  {
    name: "drowned_longhouse",
    zoneId: "d2_z2_drowned_longhouse",
    x0: 80,
    x1: 132,
    z0: -104,
    z1: -72,
    y0: -12,
    y1: -2,
    shell: "oakLog",
    floor: "oakLumber",
    // The canonical longhouse below owns the readable timber shell and broken
    // roof. Leaving this as a generic sealed authoring box hid that structure.
    openAir: true,
    openSides: true,
  },
  {
    // Climb back up to the surface on the far side of the longhouse.
    name: "underice_climb_shaft",
    zoneId: "d2_z3_hanged_wood",
    x0: 132,
    x1: 148,
    z0: -104,
    z1: -72,
    y0: -12,
    y1: 12,
    shell: "oakLog",
    floor: "oakLumber",
  },
  {
    name: "longhouse_underice",
    zoneId: "d2_z2_drowned_longhouse",
    x0: 84,
    x1: 128,
    z0: -100,
    z1: -76,
    y0: -12,
    y1: -6,
    shell: "ice",
    floor: "oakLumber",
  },
  {
    name: "hanged_wood",
    zoneId: "d2_z3_hanged_wood",
    x0: 132,
    x1: 204,
    z0: -120,
    z1: -56,
    y0: 0,
    y1: 18,
    shell: "blackWool",
    floor: "moss",
    openAir: true,
    openSides: true,
  },
  {
    name: "whale_road",
    zoneId: "d2_z4_whale_road",
    x0: 204,
    x1: 292,
    z0: -108,
    z1: -68,
    y0: 0,
    y1: 8,
    shell: "ice",
    floor: "ice",
    openAir: true,
    openSides: true,
  },
  {
    name: "sorrels_camp",
    zoneId: "d2_z5_sorrels_camp",
    x0: 292,
    x1: 324,
    z0: -100,
    z1: -76,
    y0: 0,
    y1: 8,
    shell: "oakLog",
    floor: "oakLumber",
    openAir: true,
    openSides: true,
  },
  {
    name: "ash_hall_approach",
    zoneId: "d2_z6_ash_hall",
    x0: 324,
    x1: 356,
    z0: -98,
    z1: -78,
    y0: 0,
    y1: 8,
    shell: "cobblestoneBrick",
    floor: "cobblestone",
    openAir: true,
    openSides: true,
  },
  {
    name: "ash_hall",
    zoneId: "d2_z6_ash_hall",
    x0: 356,
    x1: 416,
    z0: -112,
    z1: -64,
    y0: 0,
    y1: 16,
    shell: "oakLog",
    floor: "stoneBrick",
    // The Ninth Winter wears the hall's roof beams; use the authored gabled
    // longhouse below instead of a featureless rectangular shell.
    openAir: true,
    openSides: true,
  },
  {
    name: "breaking_year_return",
    zoneId: "d2_z7_the_breaking_year",
    x0: 416,
    x1: 476,
    z0: -104,
    z1: -72,
    y0: 0,
    y1: 10,
    shell: "snow",
    floor: "snow",
    openAir: true,
    openSides: true,
  },
];

const WINTER_CUTS: readonly Ch1DungeonPortalCut[] = [
  {
    name: "landing_to_descent_shaft",
    connects: ["ice_shelf_landing", "landing_descent_shaft"],
    x: 66,
    z: -88,
    y: 1,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "descent_shaft_to_longhouse",
    connects: ["landing_descent_shaft", "drowned_longhouse"],
    x: 80,
    z: -88,
    y: -11,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "longhouse_to_underice",
    connects: ["drowned_longhouse", "longhouse_underice"],
    x: 84,
    z: -88,
    y: -11,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "longhouse_to_climb_shaft",
    connects: ["drowned_longhouse", "underice_climb_shaft"],
    x: 132,
    z: -88,
    y: -11,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "climb_shaft_to_wood",
    connects: ["underice_climb_shaft", "hanged_wood"],
    x: 148,
    z: -88,
    y: 1,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "wood_to_whale_road",
    connects: ["hanged_wood", "whale_road"],
    x: 204,
    z: -88,
    y: 1,
    height: 4,
    width: 8,
    axis: "x",
  },
  {
    name: "whale_road_to_camp",
    connects: ["whale_road", "sorrels_camp"],
    x: 292,
    z: -88,
    y: 1,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "camp_to_approach",
    connects: ["sorrels_camp", "ash_hall_approach"],
    x: 324,
    z: -88,
    y: 1,
    height: 3,
    width: 4,
    axis: "x",
  },
  {
    name: "approach_to_ash_hall",
    connects: ["ash_hall_approach", "ash_hall"],
    x: 356,
    z: -88,
    y: 1,
    height: 5,
    width: 6,
    axis: "x",
  },
  {
    name: "ash_hall_to_return",
    connects: ["ash_hall", "breaking_year_return"],
    x: 416,
    z: -88,
    y: 1,
    height: 4,
    width: 6,
    axis: "x",
  },
];

const WINTER_WATER: readonly Ch1DungeonWaterVolume[] = [
  {
    // Open water remains visible beneath either side of the narrow ice road.
    // The centre lane stays clear and walkable; this is scenery with native
    // swimming/render semantics, not a fake translucent prop.
    name: "whale_road_north_fjord",
    zoneId: "d2_z4_whale_road",
    x0: 208,
    x1: 288,
    z0: -104,
    z1: -99,
    y0: 1,
    y1: 2,
    basinFloor: "stone",
  },
  {
    name: "whale_road_south_fjord",
    zoneId: "d2_z4_whale_road",
    x0: 208,
    x1: 288,
    z0: -77,
    z1: -72,
    y0: 1,
    y1: 2,
    basinFloor: "stone",
  },
  {
    // The longhouse flooded and froze with everything inside it. The water
    // body is real so the breath timer, buoyancy, and the water render pass
    // all agree with what the player is looking at.
    name: "longhouse_flood",
    zoneId: "d2_z2_drowned_longhouse",
    x0: 86,
    x1: 126,
    z0: -98,
    z1: -78,
    y0: -11,
    y1: -6,
    basinFloor: "oakLumber",
  },
];

const WINTER_STAIRS: readonly Ch1DungeonStairs[] = [
  {
    name: "landing_descent",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 68,
    z0: -90,
    direction: "east",
    fromY: 1,
    toY: -11,
    width: 3,
    material: "ice",
  },
  {
    name: "underice_climb",
    zoneId: "d2_z3_hanged_wood",
    x0: 134,
    z0: -90,
    direction: "east",
    fromY: -11,
    toY: 1,
    width: 3,
    material: "oakLumber",
  },
  {
    name: "ash_hall_dais",
    zoneId: "d2_z6_ash_hall",
    x0: 396,
    z0: -92,
    direction: "east",
    fromY: 1,
    toY: 4,
    width: 4,
    material: "stoneBrick",
  },
];

const WINTER_LANDSCAPE: readonly Ch1DungeonLandscapeFeature[] = [
  // FINAL WINTER SETTLEMENT MOVEMENT SPINE
  //
  // Biomes' generated roads are graded corridors with a surfaced core and a
  // wider natural shoulder, rather than a hard stripe draped over terrain.
  // These one-voxel-deep surfaces apply the same visual grammar to the final
  // authored settlement sequence. The staggered runs route around the cabin
  // and longhouse footprints, so added cultural density never hides the
  // dungeon's completable west-to-east path.
  ...[
    // Sorrel's Camp: enter at the west door, bend around the cabin's south
    // wall, then return to the Ash Hall approach.
    ["sorrel_entry_shoulder", "d2_z5_sorrels_camp", 292, 295, -92, -78, "gravel"],
    ["sorrel_south_shoulder", "d2_z5_sorrels_camp", 294, 320, -81, -78, "gravel"],
    ["sorrel_exit_shoulder", "d2_z5_sorrels_camp", 318, 324, -92, -78, "gravel"],
    ["sorrel_entry_core", "d2_z5_sorrels_camp", 293, 294, -90, -80, "cobblestone"],
    ["sorrel_south_core", "d2_z5_sorrels_camp", 294, 320, -80, -79, "cobblestone"],
    ["sorrel_exit_core", "d2_z5_sorrels_camp", 320, 322, -90, -80, "cobblestone"],
    // Ash Hall: the approach turns south before the monumental longhouse and
    // follows its exterior instead of forcing the player through a wall.
    ["ash_approach_shoulder", "d2_z6_ash_hall", 324, 356, -92, -87, "gravel"],
    ["ash_turn_shoulder", "d2_z6_ash_hall", 354, 359, -90, -64, "gravel"],
    ["ash_bypass_shoulder", "d2_z6_ash_hall", 356, 416, -67, -64, "gravel"],
    ["ash_exit_shoulder", "d2_z6_ash_hall", 412, 420, -90, -64, "gravel"],
    ["ash_approach_core", "d2_z6_ash_hall", 324, 356, -90, -89, "stoneBrick"],
    ["ash_turn_core", "d2_z6_ash_hall", 356, 358, -90, -65, "stoneBrick"],
    ["ash_bypass_core", "d2_z6_ash_hall", 356, 416, -66, -65, "stoneBrick"],
    ["ash_exit_core", "d2_z6_ash_hall", 414, 417, -90, -65, "stoneBrick"],
    // Breaking Year: the final village frames one broad central lane between
    // the north and south house rows.
    ["breaking_lane_shoulder", "d2_z7_the_breaking_year", 416, 476, -92, -84, "gravel"],
    ["breaking_lane_core", "d2_z7_the_breaking_year", 416, 476, -89, -87, "cobblestoneBrick"],
  ].map(
    ([name, zoneId, x0, x1, z0, z1, material]): Ch1DungeonLandscapeFeature =>
      wall({
        name: String(name),
        zoneId: String(zoneId),
        x0: Number(x0),
        x1: Number(x1),
        z0: Number(z0),
        z1: Number(z1),
        // Replace only the host volume's floor material. A road must never
        // become a raised collision lip or invalidate the traversal contract.
        baseY: 0,
        height: 1,
        material: material as Ch1TerrainMaterial,
      })
  ),
  {
    kind: "mound",
    name: "landing_glacier_north",
    zoneId: "d2_z1_ice_shelf_landing",
    centerX: 31,
    centerZ: -107,
    baseY: 1,
    radiusX: 9,
    radiusZ: 8,
    height: 8,
    material: "stone",
    capMaterial: "snow",
  },
  {
    kind: "mound",
    name: "landing_glacier_south",
    zoneId: "d2_z1_ice_shelf_landing",
    centerX: 73,
    centerZ: -68,
    baseY: 1,
    radiusX: 8,
    radiusZ: 7,
    height: 7,
    material: "stone",
    capMaterial: "snow",
  },
  ...[
    [144, -112, 7],
    [156, -62, 6],
    [190, -112, 8],
    [198, -64, 7],
  ].map(
    ([x, z, trunkHeight], index): Ch1DungeonLandscapeFeature => ({
      kind: "tree",
      name: `hanged_wood_snow_pine_${index + 1}`,
      zoneId: "d2_z3_hanged_wood",
      x,
      z,
      baseY: 1,
      trunkHeight,
      canopyRadius: 3,
      trunkMaterial: "oakLog",
      leafMaterial: "oakLeaf",
      snowMaterial: "snow",
    })
  ),
  {
    kind: "mound",
    name: "whale_road_north_cliff",
    zoneId: "d2_z4_whale_road",
    centerX: 252,
    centerZ: -108,
    baseY: 1,
    radiusX: 25,
    radiusZ: 2,
    height: 6,
    material: "stone",
    capMaterial: "snow",
  },
  {
    kind: "mound",
    name: "whale_road_south_cliff",
    zoneId: "d2_z4_whale_road",
    centerX: 252,
    centerZ: -68,
    baseY: 1,
    radiusX: 25,
    radiusZ: 2,
    height: 5,
    material: "stone",
    capMaterial: "snow",
  },
  {
    kind: "tree",
    name: "sorrel_camp_pine",
    zoneId: "d2_z5_sorrels_camp",
    // Set back from the surfaced movement spine. Biomes vegetation placement
    // rejects occupied footprints; authored trees need the same discipline or
    // a visual-density pass can silently block traversal.
    x: 294,
    z: -96,
    baseY: 1,
    trunkHeight: 5,
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
    snowMaterial: "snow",
  },
  {
    kind: "mound",
    name: "ash_hall_approach_ridge",
    zoneId: "d2_z6_ash_hall",
    centerX: 340,
    centerZ: -96,
    baseY: 1,
    radiusX: 10,
    radiusZ: 4,
    height: 5,
    material: "stone",
    capMaterial: "snow",
  },
  {
    kind: "mound",
    name: "breaking_year_ridge",
    zoneId: "d2_z7_the_breaking_year",
    centerX: 460,
    centerZ: -100,
    baseY: 1,
    radiusX: 13,
    radiusZ: 5,
    height: 6,
    material: "stone",
    capMaterial: "snow",
  },
  // --- Ice Shelf: fishing settlement silhouette, snow, and sparse pines ---
  building({
    name: "landing_fisher_hut_north",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 28,
    x1: 43,
    z0: -109,
    z1: -97,
    baseY: 1,
    wallHeight: 6,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 4,
    door: { side: "south", center: 35, width: 2, height: 3 },
    windowSpacing: 6,
  }),
  building({
    name: "landing_fisher_hut_south",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 56,
    x1: 70,
    z0: -77,
    z1: -65,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 3,
    door: { side: "north", center: 63, width: 2, height: 3 },
    ruined: true,
  }),
  ...[
    [27, -82, 6],
    [44, -108, 7],
    [62, -104, 5],
    [76, -70, 6],
  ].map(([x, z, trunkHeight], index): Ch1DungeonLandscapeFeature => ({
    kind: "tree",
    name: `landing_snow_pine_${index + 1}`,
    zoneId: "d2_z1_ice_shelf_landing",
    x,
    z,
    baseY: 1,
    trunkHeight,
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
    snowMaterial: "snow",
  })),
  wall({
    name: "landing_broken_sledge_run",
    zoneId: "d2_z1_ice_shelf_landing",
    x0: 47,
    x1: 52,
    z0: -106,
    z1: -80,
    baseY: 1,
    height: 1,
    material: "oakLumber",
    capMaterial: "snow",
    ruined: true,
  }),

  // --- Drowned Longhouse: navigable timber hall under fractured ice -------
  building({
    name: "drowned_longhouse_structure",
    zoneId: "d2_z2_drowned_longhouse",
    x0: 84,
    x1: 128,
    z0: -100,
    z1: -76,
    baseY: -11,
    wallHeight: 8,
    wallMaterial: "oakLog",
    roofMaterial: "oakLumber",
    roof: "gableX",
    roofRise: 6,
    door: { side: "west", center: -88, width: 4, height: 4 },
    windowSpacing: 7,
    ruined: true,
  }),
  ...[92, 104, 116, 124].flatMap((x, index) =>
    [-96, -80].map((z) =>
      column({
        name: `drowned_longhouse_beam_${index}_${z < -88 ? "north" : "south"}`,
        zoneId: "d2_z2_drowned_longhouse",
        x,
        z,
        baseY: -10,
        height: 7,
        radius: 0,
        material: "oakLog",
        capMaterial: "snow",
      })
    )
  ),
  wall({
    name: "drowned_longhouse_feast_dais",
    zoneId: "d2_z2_drowned_longhouse",
    x0: 113,
    x1: 125,
    z0: -93,
    z1: -83,
    baseY: -10,
    height: 2,
    material: "oakLumber",
    capMaterial: "snow",
  }),

  // --- Hanged Wood: dense black-pine horror landscape and old rite gate ---
  ...[
    [138, -114, 8],
    [140, -96, 6],
    [146, -72, 8],
    [152, -108, 7],
    [158, -88, 9],
    [163, -62, 7],
    [169, -116, 8],
    [174, -99, 6],
    [180, -78, 9],
    [185, -60, 7],
    [191, -107, 8],
    [197, -84, 7],
    [201, -66, 8],
  ].map(([x, z, trunkHeight], index): Ch1DungeonLandscapeFeature => ({
    kind: "tree",
    name: `hanged_wood_dense_pine_${index + 1}`,
    zoneId: "d2_z3_hanged_wood",
    x,
    z,
    baseY: 1,
    trunkHeight,
    canopyRadius: index % 3 === 0 ? 4 : 3,
    trunkMaterial: "oakLog",
    leafMaterial: index % 2 === 0 ? "blackWool" : "oakLeaf",
    snowMaterial: "snow",
  })),
  ...[
    [151, -101, 5],
    [168, -68, 7],
    [188, -101, 6],
    [198, -73, 5],
  ].map(([x, z, height], index) =>
    column({
      name: `hanged_wood_rite_stone_${index + 1}`,
      zoneId: "d2_z3_hanged_wood",
      x,
      z,
      baseY: 1,
      height,
      radius: 1,
      material: "stone",
      capMaterial: "blackWool",
    })
  ),
  wall({
    name: "hanged_wood_old_rite_lintel",
    zoneId: "d2_z3_hanged_wood",
    x0: 175,
    x1: 183,
    z0: -112,
    z1: -110,
    baseY: 7,
    height: 2,
    material: "stone",
    capMaterial: "blackWool",
    ruined: true,
  }),

  // --- Whale Road: fjord shores, ice ribs, docks, and working huts --------
  building({
    name: "whale_road_west_boathouse",
    zoneId: "d2_z4_whale_road",
    x0: 207,
    x1: 224,
    z0: -106,
    z1: -97,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 3,
    door: { side: "south", center: 216, width: 3, height: 3 },
    ruined: true,
  }),
  building({
    name: "whale_road_east_boathouse",
    zoneId: "d2_z4_whale_road",
    x0: 272,
    x1: 289,
    z0: -79,
    z1: -70,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 3,
    door: { side: "north", center: 281, width: 3, height: 3 },
  }),
  ...[216, 232, 248, 264, 280].flatMap((x, index) =>
    [-96, -80].map((z) =>
      column({
        name: `whale_road_dock_post_${index}_${z < -88 ? "north" : "south"}`,
        zoneId: "d2_z4_whale_road",
        x,
        z,
        baseY: 1,
        height: 4 + (index % 2),
        radius: 0,
        material: "oakLog",
        capMaterial: "snow",
      })
    )
  ),
  ...[226, 246, 266].map((x, index) =>
    wall({
      name: `whale_road_ice_rib_${index + 1}`,
      zoneId: "d2_z4_whale_road",
      x0: x,
      x1: x + 7,
      z0: -93,
      z1: -83,
      baseY: 1,
      height: 1,
      material: "ice",
      capMaterial: "snow",
      ruined: true,
    })
  ),

  // --- Sorrel's Camp: fortified shed, lab annex, wall, and watch post -----
  building({
    name: "sorrel_fortified_fisher_shed",
    zoneId: "d2_z5_sorrels_camp",
    x0: 296,
    x1: 317,
    z0: -98,
    z1: -82,
    baseY: 1,
    wallHeight: 7,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 4,
    door: { side: "west", center: -90, width: 2, height: 3 },
    windowSpacing: 6,
  }),
  building({
    name: "sorrel_instrument_annex",
    zoneId: "d2_z5_sorrels_camp",
    x0: 309,
    x1: 322,
    z0: -80,
    z1: -77,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLumber",
    roofMaterial: "oakLumber",
    snowMaterial: "snow",
    roof: "flat",
    door: { side: "west", center: -78, width: 2, height: 3 },
  }),
  wall({
    name: "sorrel_camp_north_palisade",
    zoneId: "d2_z5_sorrels_camp",
    x0: 293,
    x1: 323,
    z0: -100,
    z1: -99,
    baseY: 1,
    height: 4,
    material: "oakLog",
    capMaterial: "snow",
    ruined: true,
  }),
  wall({
    name: "sorrel_camp_south_palisade",
    zoneId: "d2_z5_sorrels_camp",
    x0: 293,
    x1: 323,
    z0: -77,
    z1: -76,
    baseY: 1,
    height: 4,
    material: "oakLog",
    capMaterial: "snow",
    ruined: true,
  }),
  column({
    name: "sorrel_weather_mast",
    zoneId: "d2_z5_sorrels_camp",
    x: 320,
    z: -96,
    baseY: 1,
    height: 11,
    radius: 0,
    material: "oakLog",
    capMaterial: "redWool",
  }),

  // --- Ash Hall: village approach and monumental inhabited longhouse ------
  building({
    name: "ash_approach_house_north",
    zoneId: "d2_z6_ash_hall",
    x0: 326,
    x1: 340,
    z0: -97,
    z1: -90,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 3,
    door: { side: "south", center: 333, width: 2, height: 3 },
  }),
  building({
    name: "ash_approach_house_south",
    zoneId: "d2_z6_ash_hall",
    x0: 341,
    x1: 354,
    z0: -86,
    z1: -79,
    baseY: 1,
    wallHeight: 5,
    wallMaterial: "oakLog",
    roofMaterial: "thatch",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 3,
    door: { side: "north", center: 347, width: 2, height: 3 },
    ruined: true,
  }),
  building({
    name: "ash_hall_longhouse",
    zoneId: "d2_z6_ash_hall",
    x0: 360,
    x1: 412,
    z0: -108,
    z1: -68,
    baseY: 1,
    wallHeight: 11,
    wallMaterial: "oakLog",
    roofMaterial: "stoneShingles",
    snowMaterial: "snow",
    roof: "gableX",
    roofRise: 9,
    door: { side: "west", center: -88, width: 6, height: 5 },
    windowSpacing: 8,
    ruined: true,
  }),
  ...[370, 384, 398].flatMap((x, index) =>
    [-102, -74].map((z) =>
      column({
        name: `ash_hall_roof_post_${index}_${z < -88 ? "north" : "south"}`,
        zoneId: "d2_z6_ash_hall",
        x,
        z,
        baseY: 1,
        height: 10,
        radius: 0,
        material: "oakLog",
        capMaterial: "redWool",
      })
    )
  ),
  wall({
    name: "ash_hall_hearth_dais",
    zoneId: "d2_z6_ash_hall",
    x0: 384,
    x1: 395,
    z0: -94,
    z1: -82,
    baseY: 1,
    height: 2,
    material: "stoneBrick",
    capMaterial: "coal",
  }),

  // --- Breaking Year: a complete settlement caught behind the escape -----
  ...[
    ["breaking_house_nw", 420, 436, -102, -93, 6],
    ["breaking_house_n", 442, 458, -103, -94, 5],
    ["breaking_house_ne", 462, 474, -102, -93, 6],
    ["breaking_house_sw", 422, 438, -82, -73, 5],
    ["breaking_house_s", 447, 463, -82, -73, 6],
  ].map(([name, x0, x1, z0, z1, height], index) =>
    building({
      name: String(name),
      zoneId: "d2_z7_the_breaking_year",
      x0: Number(x0),
      x1: Number(x1),
      z0: Number(z0),
      z1: Number(z1),
      baseY: 1,
      wallHeight: Number(height),
      wallMaterial: "oakLog",
      roofMaterial: "thatch",
      snowMaterial: "snow",
      roof: "gableX",
      roofRise: 3 + (index % 2),
      windowSpacing: 6,
      ruined: index % 2 === 0,
    })
  ),
  ...[
    // Set-back grove positions deliberately avoid both the surfaced village
    // lane and the authored house footprints.
    [418, -98, 6],
    [440, -75, 7],
    [468, -78, 6],
    [472, -75, 8],
  ].map(([x, z, trunkHeight], index): Ch1DungeonLandscapeFeature => ({
    kind: "tree",
    name: `breaking_year_pine_${index + 1}`,
    zoneId: "d2_z7_the_breaking_year",
    x,
    z,
    baseY: 1,
    trunkHeight,
    canopyRadius: 3,
    trunkMaterial: "oakLog",
    leafMaterial: "oakLeaf",
    snowMaterial: "snow",
  })),
];

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface Ch1DungeonTerrainDef {
  dungeonId: string;
  volumes: readonly Ch1DungeonVolume[];
  cuts: readonly Ch1DungeonPortalCut[];
  water: readonly Ch1DungeonWaterVolume[];
  stairs: readonly Ch1DungeonStairs[];
  landscape: readonly Ch1DungeonLandscapeFeature[];
  /** Where the entry portal drops the player, in authored space. */
  arrival: Ch1AuthoredPos;
  /** Where the exit portal stands. */
  departure: Ch1AuthoredPos;
  /** Volume names, in the order the player must traverse them. */
  route: readonly string[];
}

export const CH1_DESERT_TERRAIN: Ch1DungeonTerrainDef = {
  dungeonId: "ch1_dungeon_desert",
  volumes: DESERT_VOLUMES,
  cuts: DESERT_CUTS,
  water: DESERT_WATER,
  stairs: DESERT_STAIRS,
  landscape: DESERT_LANDSCAPE,
  // Z coordinates in this file are centred authored coordinates, not the
  // slot's 0..511 index. Keeping portal metadata in the same coordinate space
  // as the volumes prevents a valid gate warp from landing hundreds of metres
  // outside the dungeon shell.
  arrival: { x: 48, y: 19, z: -64 },
  departure: { x: 448, y: 1, z: -64 },
  route: [
    "dune_threshold",
    "descent_road",
    "salt_market",
    "market_stair_shaft",
    "market_undercroft",
    "cistern_stair_head",
    "cistern_main",
    "hall_of_weights",
    "sun_court",
    "seed_vault",
    "vault_exit_stair",
    "the_long_flat",
  ],
};

export const CH1_WINTER_TERRAIN: Ch1DungeonTerrainDef = {
  dungeonId: "ch1_dungeon_winter",
  volumes: WINTER_VOLUMES,
  cuts: WINTER_CUTS,
  water: WINTER_WATER,
  stairs: WINTER_STAIRS,
  landscape: WINTER_LANDSCAPE,
  arrival: { x: 40, y: 1, z: -96 },
  departure: { x: 72, y: 1, z: -80 },
  route: [
    "ice_shelf_landing",
    "landing_descent_shaft",
    "drowned_longhouse",
    "longhouse_underice",
    "underice_climb_shaft",
    "hanged_wood",
    "whale_road",
    "sorrels_camp",
    "ash_hall_approach",
    "ash_hall",
    "breaking_year_return",
  ],
};

export const CH1_DUNGEON_TERRAIN: readonly Ch1DungeonTerrainDef[] =
  Object.freeze([CH1_DESERT_TERRAIN, CH1_WINTER_TERRAIN]);

const TERRAIN_BY_ID = new Map(CH1_DUNGEON_TERRAIN.map((t) => [t.dungeonId, t]));

// LANDSCAPE_SPATIAL_INDEX
//
// Dense production lands have dozens of buildings, trees, pillars, and ruins.
// The shard builder asks ch1DungeonBlockAt() about every voxel in a 32³ shard;
// scanning every landmark for every voxel made a visual reseed scale with
// `voxels × all-features`. Bucket features once in authored X/Z space so each
// query checks only nearby candidates. This preserves exact block output and
// keeps the fast terrain-only art loop practical as density grows.
const CH1_LANDSCAPE_BUCKET_SIZE = 16;

function ch1LandscapeFeatureBounds(feature: Ch1DungeonLandscapeFeature): {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
} {
  switch (feature.kind) {
    case "mound":
      return {
        x0: feature.centerX - feature.radiusX,
        x1: feature.centerX + feature.radiusX,
        z0: feature.centerZ - feature.radiusZ,
        z1: feature.centerZ + feature.radiusZ,
      };
    case "tree":
      return {
        x0: feature.x - feature.canopyRadius * 2,
        x1: feature.x + feature.canopyRadius * 2,
        z0: feature.z - feature.canopyRadius * 2,
        z1: feature.z + feature.canopyRadius * 2,
      };
    case "column":
      return {
        x0: feature.x - feature.radius,
        x1: feature.x + feature.radius,
        z0: feature.z - feature.radius,
        z1: feature.z + feature.radius,
      };
    case "building":
    case "wall":
      return {
        x0: feature.x0,
        x1: feature.x1,
        z0: feature.z0,
        z1: feature.z1,
      };
  }
}

function ch1LandscapeBucketKey(x: number, z: number): string {
  return `${Math.floor(x / CH1_LANDSCAPE_BUCKET_SIZE)}:${Math.floor(
    z / CH1_LANDSCAPE_BUCKET_SIZE
  )}`;
}

const LANDSCAPE_BY_DUNGEON_BUCKET = new Map<
  string,
  Map<string, Ch1DungeonLandscapeFeature[]>
>();
for (const terrain of CH1_DUNGEON_TERRAIN) {
  const buckets = new Map<string, Ch1DungeonLandscapeFeature[]>();
  for (const feature of terrain.landscape) {
    const bounds = ch1LandscapeFeatureBounds(feature);
    const bx0 = Math.floor(bounds.x0 / CH1_LANDSCAPE_BUCKET_SIZE);
    const bx1 = Math.floor(bounds.x1 / CH1_LANDSCAPE_BUCKET_SIZE);
    const bz0 = Math.floor(bounds.z0 / CH1_LANDSCAPE_BUCKET_SIZE);
    const bz1 = Math.floor(bounds.z1 / CH1_LANDSCAPE_BUCKET_SIZE);
    for (let bx = bx0; bx <= bx1; bx += 1) {
      for (let bz = bz0; bz <= bz1; bz += 1) {
        const key = `${bx}:${bz}`;
        const list = buckets.get(key) ?? [];
        list.push(feature);
        buckets.set(key, list);
      }
    }
  }
  LANDSCAPE_BY_DUNGEON_BUCKET.set(terrain.dungeonId, buckets);
}

export function ch1DungeonTerrain(
  dungeonId: string
): Ch1DungeonTerrainDef | undefined {
  return TERRAIN_BY_ID.get(dungeonId);
}

// ---------------------------------------------------------------------------
// Voxel queries
//
// Same signature shape as harthmereDungeonBlockAt /
// harthmereShouldCarveDungeonAirBlockAt so the shim seeder can call these from
// the branch it already has.
// ---------------------------------------------------------------------------

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

function inRect(
  x: number,
  z: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number
): boolean {
  return x >= x0 && x <= x1 && z >= z0 && z <= z1;
}

function cutContains(
  cut: Ch1DungeonPortalCut,
  x: number,
  y: number,
  z: number
): boolean {
  if (!inRange(y, cut.y, cut.y + cut.height - 1)) {
    return false;
  }
  const half = Math.floor(cut.width / 2);
  if (cut.axis === "x") {
    // Opening pierces a wall that runs along Z: span Z, allow a 2-thick wall.
    return (
      inRange(x, cut.x - 1, cut.x + 1) && inRange(z, cut.z - half, cut.z + half)
    );
  }
  return (
    inRange(z, cut.z - 1, cut.z + 1) && inRange(x, cut.x - half, cut.x + half)
  );
}

function stairStepY(
  stair: Ch1DungeonStairs,
  x: number,
  z: number
): number | undefined {
  const steps = Math.abs(stair.toY - stair.fromY);
  if (steps === 0) {
    return undefined;
  }
  const dir = stair.toY > stair.fromY ? 1 : -1;
  const alongX = stair.direction === "east" || stair.direction === "west";
  const alongSign =
    stair.direction === "east" || stair.direction === "south" ? 1 : -1;
  const along = alongX
    ? (x - stair.x0) * alongSign
    : (z - stair.z0) * alongSign;
  const across = alongX ? z - stair.z0 : x - stair.x0;
  if (along < 0 || along > steps) {
    return undefined;
  }
  if (across < 0 || across >= stair.width) {
    return undefined;
  }
  return stair.fromY + dir * along;
}

function ch1LandscapeBlockAt(
  feature: Ch1DungeonLandscapeFeature,
  x: number,
  y: number,
  z: number
): Ch1TerrainMaterial | undefined {
  if (feature.kind === "mound") {
    const dx = (x - feature.centerX) / feature.radiusX;
    const dz = (z - feature.centerZ) / feature.radiusZ;
    const distance = dx * dx + dz * dz;
    if (distance > 1) {
      return undefined;
    }
    const topY =
      feature.baseY + Math.max(0, Math.floor(feature.height * (1 - distance)));
    if (y < feature.baseY || y > topY) {
      return undefined;
    }
    return y === topY && feature.capMaterial
      ? feature.capMaterial
      : feature.material;
  }

  if (feature.kind === "tree") {
    const trunkTop = feature.baseY + feature.trunkHeight - 1;
    if (
      x === feature.x &&
      z === feature.z &&
      inRange(y, feature.baseY, trunkTop)
    ) {
      return feature.trunkMaterial;
    }

    // A tapered voxel crown reads as a palm in the desert and a pine when snow
    // caps are present. The trunk/crown are canonical terrain, so they keep the
    // snapshot's chunky silhouette and never depend on the forbidden humanoid
    // or prop generator paths.
    const crownCentreY = feature.baseY + feature.trunkHeight;
    const vertical = Math.abs(y - crownCentreY);
    const layerRadius = Math.max(
      0,
      feature.canopyRadius - Math.floor(vertical / 2)
    );
    if (layerRadius === 0 && vertical > feature.canopyRadius) {
      return undefined;
    }
    const radial = Math.abs(x - feature.x) + Math.abs(z - feature.z);
    if (vertical <= feature.canopyRadius && radial <= layerRadius * 2) {
      if (
        feature.snowMaterial &&
        y >= crownCentreY + Math.max(1, feature.canopyRadius - 1)
      ) {
        return feature.snowMaterial;
      }
      return feature.leafMaterial;
    }
    return undefined;
  }

  if (feature.kind === "wall") {
    if (
      !inRect(x, z, feature.x0, feature.x1, feature.z0, feature.z1) ||
      !inRange(y, feature.baseY, feature.baseY + feature.height - 1)
    ) {
      return undefined;
    }
    const topY = feature.baseY + feature.height - 1;
    if (feature.ruined && y === topY && (x + z) % 3 === 0) {
      return undefined;
    }
    return y === topY && feature.capMaterial
      ? feature.capMaterial
      : feature.material;
  }

  if (feature.kind === "column") {
    const inside =
      Math.abs(x - feature.x) <= feature.radius &&
      Math.abs(z - feature.z) <= feature.radius;
    if (
      !inside ||
      !inRange(y, feature.baseY, feature.baseY + feature.height - 1)
    ) {
      return undefined;
    }
    const topY = feature.baseY + feature.height - 1;
    return y === topY && feature.capMaterial
      ? feature.capMaterial
      : feature.material;
  }

  const insideFootprint = inRect(
    x,
    z,
    feature.x0,
    feature.x1,
    feature.z0,
    feature.z1
  );
  if (!insideFootprint) {
    return undefined;
  }
  const eaveY = feature.baseY + feature.wallHeight - 1;
  const onWestEast = x === feature.x0 || x === feature.x1;
  const onNorthSouth = z === feature.z0 || z === feature.z1;
  const onBoundary = onWestEast || onNorthSouth;
  const door = feature.door;
  const inDoor =
    door !== undefined &&
    y < feature.baseY + door.height &&
    ((door.side === "north" && z === feature.z0) ||
      (door.side === "south" && z === feature.z1) ||
      (door.side === "west" && x === feature.x0) ||
      (door.side === "east" && x === feature.x1)) &&
    Math.abs(
      (door.side === "north" || door.side === "south" ? x : z) - door.center
    ) <= Math.floor(door.width / 2);
  const windowOpening =
    feature.windowSpacing !== undefined &&
    y >= feature.baseY + 2 &&
    y <= feature.baseY + 3 &&
    ((onWestEast && Math.abs(z - feature.z0) % feature.windowSpacing === 2) ||
      (onNorthSouth && Math.abs(x - feature.x0) % feature.windowSpacing === 2));
  const ruinedGap =
    feature.ruined === true &&
    y >= eaveY - 1 &&
    (x * 3 + z * 5) % 7 <= 1;
  if (
    onBoundary &&
    inRange(y, feature.baseY, eaveY) &&
    !inDoor &&
    !windowOpening &&
    !ruinedGap
  ) {
    return feature.wallMaterial;
  }

  if (feature.roof === "open") {
    return undefined;
  }
  if (feature.roof === "flat") {
    const roofPresent = !(feature.ruined && (x * 5 + z * 7) % 11 <= 1);
    if (feature.snowMaterial && y === eaveY + 2 && roofPresent) {
      return feature.snowMaterial;
    }
    if (
      y === eaveY + 1 &&
      roofPresent
    ) {
      return feature.roofMaterial;
    }
    return undefined;
  }

  const slopeAcrossX = feature.roof === "gableZ";
  const lo = slopeAcrossX ? feature.x0 : feature.z0;
  const hi = slopeAcrossX ? feature.x1 : feature.z1;
  const coordinate = slopeAcrossX ? x : z;
  const halfSpan = Math.max(1, (hi - lo) / 2);
  const distanceFromRidge = Math.abs(coordinate - (lo + hi) / 2);
  const rise = Math.max(
    0,
    Math.round((feature.roofRise ?? 3) * (1 - distanceFromRidge / halfSpan))
  );
  const roofY = eaveY + 1 + rise;
  const roofPresent = !(feature.ruined && (x * 5 + z * 7) % 13 <= 1);
  if (feature.snowMaterial && y === roofY + 1 && roofPresent) {
    return feature.snowMaterial;
  }
  if (
    y === roofY &&
    roofPresent
  ) {
    return feature.roofMaterial;
  }
  return undefined;
}

/**
 * Solid block material at an authored position, or undefined for air/untouched.
 * Order matters: cuts win over shell so a doorway is never sealed by the wall
 * it is punched through.
 */
export function ch1DungeonBlockAt(
  dungeonId: string,
  x: number,
  y: number,
  z: number
): Ch1TerrainMaterial | undefined {
  const terrain = TERRAIN_BY_ID.get(dungeonId);
  if (!terrain) {
    return undefined;
  }

  // A doorway is air, whatever else claims this voxel.
  for (const cut of terrain.cuts) {
    if (cutContains(cut, x, y, z)) {
      return undefined;
    }
  }

  // Stairs are solid steps and take priority over the floor beneath them.
  for (const stair of terrain.stairs) {
    const stepY = stairStepY(stair, x, z);
    if (
      stepY !== undefined &&
      y <= stepY &&
      y >= Math.min(stair.fromY, stair.toY) - 2
    ) {
      return stair.material;
    }
  }

  // A water basin needs a real floor under it or it drains into the void.
  for (const basin of terrain.water) {
    if (
      inRect(x, z, basin.x0, basin.x1, basin.z0, basin.z1) &&
      y === basin.y0 - 1
    ) {
      return basin.basinFloor;
    }
  }

  // Landscape solids live inside the carved outdoor authoring bounds. They
  // must be resolved before the generic carved-air rule or every dune, ridge,
  // and tree would be erased back into the old empty rectangular volume.
  const nearbyLandscape =
    LANDSCAPE_BY_DUNGEON_BUCKET.get(dungeonId)?.get(
      ch1LandscapeBucketKey(x, z)
    ) ?? [];
  for (const feature of nearbyLandscape) {
    const material = ch1LandscapeBlockAt(feature, x, y, z);
    if (material) {
      return material;
    }
  }

  // CARVED AIR WINS OVER ANOTHER VOLUME'S SHELL.
  //
  // Without this, a stair shaft sunk through a room's floor gets sealed by
  // that room's own floor slab, and the shaft becomes a solid column the
  // player cannot descend. Found by the E2E voxel walker: the winter
  // dungeon's descent shaft was capped by the ice shelf's floor at y=0, which
  // made the entire dungeon past the landing unreachable.
  //
  // This runs AFTER stairs and basin floors — those are deliberately solid
  // things standing inside carved space — and BEFORE shell generation.
  if (ch1ShouldCarveAirAt(dungeonId, x, y, z)) {
    return undefined;
  }

  for (const volume of terrain.volumes) {
    if (!inRect(x, z, volume.x0, volume.x1, volume.z0, volume.z1)) {
      continue;
    }
    // Floor slab, one below the walkable surface.
    if (y === volume.y0) {
      return volume.floor;
    }
    // Walls: the rectangle boundary, full height.
    const onBoundary =
      x === volume.x0 || x === volume.x1 || z === volume.z0 || z === volume.z1;
    if (
      onBoundary &&
      !volume.openSides &&
      inRange(y, volume.y0 + 1, volume.y1)
    ) {
      return volume.shell;
    }
    // Ceiling, unless the space is open to the sky.
    if (!volume.openAir && y === volume.y1 + 1) {
      return volume.shell;
    }
  }

  return undefined;
}

/**
 * True where the seeder must leave air even though the surrounding rock would
 * otherwise be filled — the interior of every carved volume.
 */
export function ch1ShouldCarveAirAt(
  dungeonId: string,
  x: number,
  y: number,
  z: number
): boolean {
  const terrain = TERRAIN_BY_ID.get(dungeonId);
  if (!terrain) {
    return false;
  }
  for (const cut of terrain.cuts) {
    if (cutContains(cut, x, y, z)) {
      return true;
    }
  }
  for (const volume of terrain.volumes) {
    if (!inRect(x, z, volume.x0, volume.x1, volume.z0, volume.z1)) {
      continue;
    }
    if (!inRange(y, volume.y0 + 1, volume.y1)) {
      continue;
    }
    const onBoundary =
      x === volume.x0 || x === volume.x1 || z === volume.z0 || z === volume.z1;
    if (onBoundary && !volume.openSides) {
      continue;
    }
    return true;
  }
  return false;
}

/** True where shard_water should carry a value. */
export function ch1DungeonWaterAt(
  dungeonId: string,
  x: number,
  y: number,
  z: number
): boolean {
  const terrain = TERRAIN_BY_ID.get(dungeonId);
  if (!terrain) {
    return false;
  }
  return terrain.water.some(
    (basin) =>
      inRect(x, z, basin.x0, basin.x1, basin.z0, basin.z1) &&
      inRange(y, basin.y0, basin.y1)
  );
}

/** Every shard the dungeon touches, for the seeder's shard spec list. */
export function ch1DungeonShardSpecs(
  dungeonId: string,
  shardDim = 32
): Array<{ shardX: number; shardY: number; shardZ: number }> {
  const terrain = TERRAIN_BY_ID.get(dungeonId);
  const slot = ch1ElsewhenSlot(dungeonId);
  if (!terrain || !slot) {
    return [];
  }
  const specs = new Map<
    string,
    { shardX: number; shardY: number; shardZ: number }
  >();
  const add = (wx: number, wy: number, wz: number) => {
    const shardX = Math.floor(wx / shardDim);
    const shardY = Math.floor(wy / shardDim);
    const shardZ = Math.floor(wz / shardDim);
    specs.set(`${shardX}:${shardY}:${shardZ}`, { shardX, shardY, shardZ });
  };
  for (const volume of terrain.volumes) {
    // Sample the corners plus one shard of padding for the shell and ceiling.
    for (const [lx, lz] of [
      [volume.x0, volume.z0],
      [volume.x1, volume.z0],
      [volume.x0, volume.z1],
      [volume.x1, volume.z1],
    ]) {
      for (let ly = volume.y0 - 1; ly <= volume.y1 + 1; ly += shardDim / 2) {
        const w = ch1DungeonAuthoredToWorld(dungeonId, { x: lx, y: ly, z: lz });
        add(w[0], w[1], w[2]);
      }
      const top = ch1DungeonAuthoredToWorld(dungeonId, {
        x: lx,
        y: volume.y1 + 1,
        z: lz,
      });
      add(top[0], top[1], top[2]);
    }
    // Interior sweep so long volumes do not skip middle shards.
    for (let lx = volume.x0; lx <= volume.x1; lx += shardDim) {
      for (let lz = volume.z0; lz <= volume.z1; lz += shardDim) {
        for (let ly = volume.y0; ly <= volume.y1 + 1; ly += shardDim) {
          const w = ch1DungeonAuthoredToWorld(dungeonId, {
            x: lx,
            y: ly,
            z: lz,
          });
          add(w[0], w[1], w[2]);
        }
      }
    }
  }
  return [...specs.values()];
}

// ---------------------------------------------------------------------------
// Validation
//
// These are the edge cases that make a hand-authored dungeon unplayable. Every
// one of them has bitten a Harthmere space at least once: floating geometry,
// a door you cannot fit through, a room with no way out, a water body with no
// basin, a stair that needs a jump, or a volume that escapes its slot.
// ---------------------------------------------------------------------------

/** Minimum interior headroom. A player is 2 tall; 3 keeps the camera sane. */
export const CH1_MIN_HEADROOM = 3;
/** Minimum door opening height. */
export const CH1_MIN_DOOR_HEIGHT = 3;
/** Minimum clear voxels in front of and behind a door. */
export const CH1_MIN_DOOR_CLEARANCE = 2;

function volumesOverlap(a: Ch1DungeonVolume, b: Ch1DungeonVolume): boolean {
  return (
    a.x0 < b.x1 &&
    b.x0 < a.x1 &&
    a.z0 < b.z1 &&
    b.z0 < a.z1 &&
    a.y0 < b.y1 &&
    b.y0 < a.y1
  );
}

export function ch1ValidateDungeonTerrain(
  terrain: Ch1DungeonTerrainDef
): string[] {
  const errors: string[] = [];
  const byName = new Map(terrain.volumes.map((v) => [v.name, v]));
  const slot = ch1ElsewhenSlot(terrain.dungeonId);
  if (!slot) {
    return [`${terrain.dungeonId}: no Elsewhen slot reserved`];
  }

  // --- containment: nothing may escape its slot -----------------------------
  for (const volume of terrain.volumes) {
    for (const [lx, lz] of [
      [volume.x0, volume.z0],
      [volume.x1, volume.z1],
    ]) {
      const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
        x: lx,
        y: volume.y0,
        z: lz,
      });
      if (!isInsideCh1ElsewhenBand(world)) {
        errors.push(
          `${terrain.dungeonId}/${volume.name}: extends outside the Elsewhen band`
        );
      }
      if (world[0] < slot.minX || world[0] >= slot.maxX) {
        errors.push(
          `${terrain.dungeonId}/${volume.name}: extends outside its own slot ` +
            `(would be visible from the other dungeon)`
        );
      }
    }
    if (volume.y0 + CH1_ELSEWHEN_GROUND_Y < 0) {
      errors.push(`${terrain.dungeonId}/${volume.name}: floor is below y=0`);
    }
    if (volume.openSides && !volume.openAir) {
      errors.push(
        `${terrain.dungeonId}/${volume.name}: open-sided land must also be open to the sky`
      );
    }
  }

  const zoneIds = new Set(terrain.volumes.map((volume) => volume.zoneId));
  for (const feature of terrain.landscape) {
    if (!zoneIds.has(feature.zoneId)) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: landscape references unknown zone ${feature.zoneId}`
      );
    }
    const localX =
      feature.kind === "mound"
        ? feature.centerX
        : feature.kind === "tree" || feature.kind === "column"
        ? feature.x
        : feature.x0;
    const localZ =
      feature.kind === "mound"
        ? feature.centerZ
        : feature.kind === "tree" || feature.kind === "column"
        ? feature.z
        : feature.z0;
    const baseY = feature.baseY;
    const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
      x: localX,
      y: baseY,
      z: localZ,
    });
    if (
      !isInsideCh1ElsewhenBand(world) ||
      world[0] < slot.minX ||
      world[0] >= slot.maxX
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: landscape escapes its Elsewhen slot`
      );
    }
    if (
      feature.kind === "mound" &&
      (feature.radiusX <= 0 || feature.radiusZ <= 0 || feature.height <= 0)
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: invalid mound dimensions`
      );
    }
    if (
      feature.kind === "tree" &&
      (feature.trunkHeight <= 0 || feature.canopyRadius <= 0)
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: invalid tree dimensions`
      );
    }
    if (
      feature.kind === "building" &&
      (feature.x1 <= feature.x0 ||
        feature.z1 <= feature.z0 ||
        feature.wallHeight < 3 ||
        (feature.roof !== "open" && (feature.roofRise ?? 0) < 0))
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: invalid building dimensions`
      );
    }
    if (
      feature.kind === "building" &&
      feature.door &&
      (feature.door.width < 2 || feature.door.height < CH1_MIN_DOOR_HEIGHT)
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: building door is too small`
      );
    }
    if (
      feature.kind === "wall" &&
      (feature.x1 < feature.x0 ||
        feature.z1 < feature.z0 ||
        feature.height <= 0)
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: invalid wall dimensions`
      );
    }
    if (
      feature.kind === "column" &&
      (feature.height <= 0 || feature.radius < 0)
    ) {
      errors.push(
        `${terrain.dungeonId}/${feature.name}: invalid column dimensions`
      );
    }
  }

  // --- headroom -------------------------------------------------------------
  for (const volume of terrain.volumes) {
    const headroom = volume.y1 - volume.y0;
    if (headroom < CH1_MIN_HEADROOM) {
      errors.push(
        `${terrain.dungeonId}/${volume.name}: headroom ${headroom} is below ` +
          `the ${CH1_MIN_HEADROOM} minimum`
      );
    }
    if (volume.x1 - volume.x0 < 4 || volume.z1 - volume.z0 < 4) {
      errors.push(
        `${terrain.dungeonId}/${volume.name}: interior is too narrow to move in`
      );
    }
  }

  // --- volumes must not intersect ------------------------------------------
  for (let i = 0; i < terrain.volumes.length; i++) {
    for (let j = i + 1; j < terrain.volumes.length; j++) {
      const a = terrain.volumes[i];
      const b = terrain.volumes[j];
      // Nested volumes in the same zone are intentional (under-ice pocket).
      if (a.zoneId === b.zoneId) {
        continue;
      }
      if (volumesOverlap(a, b)) {
        errors.push(
          `${terrain.dungeonId}: volumes "${a.name}" and "${b.name}" overlap; ` +
            `one will punch a hole in the other's shell`
        );
      }
    }
  }

  // --- doors ---------------------------------------------------------------
  for (const cut of terrain.cuts) {
    for (const name of cut.connects) {
      if (!byName.has(name)) {
        errors.push(
          `${terrain.dungeonId}/${cut.name}: connects unknown volume "${name}"`
        );
      }
    }
    if (cut.height < CH1_MIN_DOOR_HEIGHT) {
      errors.push(
        `${terrain.dungeonId}/${cut.name}: opening is ${cut.height} tall, ` +
          `below the ${CH1_MIN_DOOR_HEIGHT} minimum`
      );
    }
    if (cut.width < CH1_MIN_DOOR_CLEARANCE) {
      errors.push(
        `${terrain.dungeonId}/${cut.name}: opening is ${cut.width} wide`
      );
    }
    // The opening must actually sit inside both volumes it claims to connect,
    // otherwise it punches a hole into solid rock and leads nowhere.
    for (const name of cut.connects) {
      const volume = byName.get(name);
      if (!volume) {
        continue;
      }
      const touchesXz = inRect(
        cut.x,
        cut.z,
        volume.x0 - 1,
        volume.x1 + 1,
        volume.z0 - 1,
        volume.z1 + 1
      );
      if (!touchesXz) {
        errors.push(
          `${terrain.dungeonId}/${cut.name}: opening is not on "${name}"'s wall`
        );
      }
      const spansY = cut.y >= volume.y0 && cut.y <= volume.y1;
      if (!spansY) {
        errors.push(
          `${terrain.dungeonId}/${cut.name}: opening at y=${cut.y} is outside ` +
            `"${name}" (y ${volume.y0}..${volume.y1}) — the player would have ` +
            `to clip through the floor or ceiling`
        );
      }
    }
  }

  // --- connectivity: every volume reachable from arrival, and the exit too --
  const adjacency = new Map<string, Set<string>>();
  for (const volume of terrain.volumes) {
    adjacency.set(volume.name, new Set());
  }
  for (const cut of terrain.cuts) {
    const [a, b] = cut.connects;
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }
  const start = terrain.route[0];
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  for (const volume of terrain.volumes) {
    if (!seen.has(volume.name)) {
      errors.push(
        `${terrain.dungeonId}/${volume.name}: unreachable from the arrival ` +
          `volume — a dungeon with no way in is a soft-lock`
      );
    }
  }
  const exit = terrain.route[terrain.route.length - 1];
  if (!seen.has(exit)) {
    errors.push(
      `${terrain.dungeonId}: the exit volume "${exit}" is unreachable — the ` +
        `player would be trapped in a one-way gate`
    );
  }

  // --- route must match the volume list ------------------------------------
  for (const name of terrain.route) {
    if (!byName.has(name)) {
      errors.push(`${terrain.dungeonId}: route references unknown "${name}"`);
    }
  }
  if (terrain.route.length !== terrain.volumes.length) {
    errors.push(
      `${terrain.dungeonId}: route covers ${terrain.route.length} of ` +
        `${terrain.volumes.length} volumes`
    );
  }

  // --- arrival and departure must be in air, inside the first/last volume ---
  const arrivalVolume = byName.get(terrain.route[0]);
  if (arrivalVolume) {
    // NB: compare arrival.z DIRECTLY against the volume bounds. Both are in
    // authored space — ch1DungeonBlockAt() compares the seeder's authored z
    // against volume.z0/z1 with no offset, and ch1DungeonAuthoredToWorld() is
    // the single place the Z origin is applied. Adding the origin here as
    // well double-applied it and reported every arrival as outside its own
    // room (caught when the gate/terrain arrival values were unified).
    const insideArrival =
      inRect(
        terrain.arrival.x,
        terrain.arrival.z,
        arrivalVolume.x0,
        arrivalVolume.x1,
        arrivalVolume.z0,
        arrivalVolume.z1
      ) &&
      terrain.arrival.y > arrivalVolume.y0 &&
      terrain.arrival.y <= arrivalVolume.y1;
    if (!insideArrival) {
      errors.push(
        `${terrain.dungeonId}: arrival is not standing inside "${arrivalVolume.name}"`
      );
    }
  }

  // --- water needs a basin -------------------------------------------------
  for (const basin of terrain.water) {
    const hasContainer = terrain.volumes.some(
      (v) =>
        basin.x0 > v.x0 &&
        basin.x1 < v.x1 &&
        basin.z0 > v.z0 &&
        basin.z1 < v.z1 &&
        basin.y0 >= v.y0
    );
    if (!hasContainer) {
      errors.push(
        `${terrain.dungeonId}/${basin.name}: water is not contained by any ` +
          `volume — it will pour out through the shell`
      );
    }
    if (basin.y1 <= basin.y0) {
      errors.push(
        `${terrain.dungeonId}/${basin.name}: water body has no depth`
      );
    }
  }

  // --- stairs --------------------------------------------------------------
  for (const stair of terrain.stairs) {
    if (stair.fromY === stair.toY) {
      errors.push(`${terrain.dungeonId}/${stair.name}: stair climbs nothing`);
    }
    if (stair.width < 2) {
      errors.push(
        `${terrain.dungeonId}/${stair.name}: stair is too narrow for an escort`
      );
    }
  }

  // --- every vertical transition between routed volumes needs a stair -------
  for (const cut of terrain.cuts) {
    const a = byName.get(cut.connects[0]);
    const b = byName.get(cut.connects[1]);
    if (!a || !b) {
      continue;
    }
    const drop = Math.abs(a.y0 - b.y0);
    if (drop > 1) {
      const linked = terrain.stairs.some(
        (s) =>
          Math.abs(Math.abs(s.fromY - s.toY) - drop) <= 2 &&
          (s.zoneId === a.zoneId || s.zoneId === b.zoneId)
      );
      if (!linked) {
        errors.push(
          `${terrain.dungeonId}/${cut.name}: ${drop}-block height change ` +
            `between "${a.name}" and "${b.name}" with no stair — the player ` +
            `would have to fall or jump`
        );
      }
    }
  }

  return errors;
}

export function ch1ValidateAllDungeonTerrain(): string[] {
  return CH1_DUNGEON_TERRAIN.flatMap(ch1ValidateDungeonTerrain);
}

export { CH1_ELSEWHEN_FEET_Y };
