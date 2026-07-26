// CHAPTER_1_DUNGEON_HORIZON
//
// The land you can see but never reach.
//
// PURPOSE
// Each dungeon currently ends where its authored rooms end. That reads as a
// set, not a place. This module adds two things around — never inside — an
// existing dungeon:
//
//   1. A BOUNDARY the player cannot cross.
//   2. BACKDROP terrain and buildings beyond it, matching the dungeon's era,
//      so the player understands that Nerash-Utu and Hrafnsfjörðr are real
//      settlements that continue past the part they are allowed to walk.
//
// NON-NEGOTIABLE SAFETY PROPERTY
// This module NEVER writes a voxel inside the playable dungeon. The boundary is
// DERIVED from `CH1_DUNGEON_TERRAIN` at runtime rather than hand-copied, so it
// cannot drift out of sync with rooms it does not own, and
// `ch1HorizonBlockAt()` returns undefined for anything inside the playable box.
// `ch1_dungeon_horizon.test.ts` asserts both. Nothing in ch1_dungeon_terrain.ts
// or ch1_dungeon_decor.ts is modified.
//
// TECHNIQUES BORROWED FROM THE WORLD-GEN PIPELINE (see the design doc)
//   * Named-seed noise. Every layer is seeded by a STRING ("dunes", "fjord
//     walls"), adler32-hashed, so each is independently reproducible and
//     tunable without disturbing the others.
//   * explicit-weight octaves as art direction. `explicitNoise(period, weights)`
//     lets the weight vector say "lots of 256-voxel structure, none at 128, a
//     bit at 64" — which fractal falloff cannot express.
//   * linear_boundary feathering. Backdrop height is multiplied by distance
//     from the boundary, so the far landscape RISES from the wall instead of
//     starting as a cliff. This is the trick that removes hard edges.
//   * Stratigraphic columns. Surfaces are a 16-deep stack of materials, not a
//     skin block, chosen by a coherent field so topsoil depth varies smoothly.
//   * Snow is exactly three voxels over stone, per the shipped `snow_peak`
//     column. Snow is a cap, never a drift.
//
// COLLISION borrows the world-boundary trick rather than building six walls:
// synthesize ONE copy of the playable box shifted by its own size on whichever
// side was crossed, and hand it to the ordinary swept-AABB resolver. Six
// comparisons, no geometry, no memory, and every consumer (player, camera, NPC,
// server physics) inherits it without knowing a boundary exists.

import type { Vec3 } from "@/shared/math/types";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
  ch1DungeonTerrain,
  type Ch1AuthoredPos,
  type Ch1DungeonTerrainDef,
  type Ch1TerrainMaterial,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  harthmereExplicitNoise,
  harthmereLinearBoundary,
  harthmereUpwardBiasedNoise,
} from "@/shared/harthmere/harthmere_horizon_noise";

export const CH1_DUNGEON_HORIZON_VERSION =
  "ch1-dungeon-horizon-v1" as const;

// ---------------------------------------------------------------------------
// Noise
//
// The primitives now live in harthmere_horizon_noise.ts so the Chapter 1
// dungeons and the Harthmere back country share ONE implementation. Two copies
// of a noise function is two chances for the same landform to look subtly
// different in each place. Re-exported under the ch1 names so existing call
// sites and tests are unchanged.
// ---------------------------------------------------------------------------

export const ch1ExplicitNoise = harthmereExplicitNoise;
export const ch1LinearBoundary = harthmereLinearBoundary;

// ---------------------------------------------------------------------------
// Playable bounds and the boundary
// ---------------------------------------------------------------------------

export interface Ch1HorizonBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Breathing room between the last authored wall and the boundary. */
export const CH1_HORIZON_PLAYABLE_MARGIN = 6;
/** Headroom above the tallest room so the sky is not a lid on your head. */
export const CH1_HORIZON_CEILING_MARGIN = 24;

/**
 * The box the player may occupy, derived from the dungeon's own volumes.
 *
 * Derived, never hand-copied: if a room is added or moved in
 * ch1_dungeon_terrain.ts, the boundary follows it automatically and the
 * backdrop keeps its distance. That is the whole reason this is a function.
 */
export function ch1PlayableBounds(terrain: Ch1DungeonTerrainDef): Ch1HorizonBox {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const volume of terrain.volumes) {
    x0 = Math.min(x0, volume.x0);
    x1 = Math.max(x1, volume.x1);
    y0 = Math.min(y0, volume.y0);
    y1 = Math.max(y1, volume.y1);
    z0 = Math.min(z0, volume.z0);
    z1 = Math.max(z1, volume.z1);
  }
  const m = CH1_HORIZON_PLAYABLE_MARGIN;
  return {
    x0: x0 - m,
    x1: x1 + m,
    // The floor stays where the deepest room's floor is: there is nothing to
    // see below a dungeon and falling out of the world is not a vista.
    y0: y0 - 2,
    y1: y1 + CH1_HORIZON_CEILING_MARGIN,
    z0: z0 - m,
    z1: z1 + m,
  };
}

export function ch1PointInsidePlayable(
  bounds: Ch1HorizonBox,
  x: number,
  y: number,
  z: number
): boolean {
  return (
    x >= bounds.x0 &&
    x <= bounds.x1 &&
    y >= bounds.y0 &&
    y <= bounds.y1 &&
    z >= bounds.z0 &&
    z <= bounds.z1
  );
}

/** Signed distance to the boundary in the XZ plane. Negative inside. */
export function ch1DistanceBeyondBoundary(
  bounds: Ch1HorizonBox,
  x: number,
  z: number
): number {
  const dx = Math.max(bounds.x0 - x, 0, x - bounds.x1);
  const dz = Math.max(bounds.z0 - z, 0, z - bounds.z1);
  if (dx === 0 && dz === 0) {
    // Inside: negative distance to the nearest wall.
    return -Math.min(x - bounds.x0, bounds.x1 - x, z - bounds.z0, bounds.z1 - z);
  }
  return Math.hypot(dx, dz);
}

// ---------------------------------------------------------------------------
// Collision — the shifted-box trick
// ---------------------------------------------------------------------------

export type Ch1HorizonAabb = readonly [Vec3, Vec3];

/**
 * Synthesize the blocking slabs for an entity that has left the playable box.
 *
 * Exactly the world-boundary approach: instead of six wall meshes, hand the
 * ordinary collision resolver ONE copy of the playable box shifted by its own
 * size on each axis that was exceeded. From the solver's point of view the
 * region beyond is a solid slab as deep as the dungeon is wide — effectively
 * infinite. A corner simply produces two or three overlapping slabs and the
 * existing resolver handles it.
 *
 * Returns world-space AABBs. Empty when the entity is fully inside.
 */
export function ch1HorizonBoundarySlabs(
  dungeonId: string,
  entityAabb: Ch1HorizonAabb
): Ch1HorizonAabb[] {
  const terrain = ch1DungeonTerrain(dungeonId);
  if (!terrain) {
    return [];
  }
  const bounds = ch1PlayableBounds(terrain);
  const min = ch1DungeonAuthoredToWorld(dungeonId, {
    x: bounds.x0,
    y: bounds.y0,
    z: bounds.z0,
  });
  const max = ch1DungeonAuthoredToWorld(dungeonId, {
    x: bounds.x1,
    y: bounds.y1,
    z: bounds.z1,
  });
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const d = max[2] - min[2];

  const slabs: Ch1HorizonAabb[] = [];
  const shifted = (shift: Vec3): Ch1HorizonAabb => [
    [min[0] + shift[0], min[1] + shift[1], min[2] + shift[2]],
    [max[0] + shift[0], max[1] + shift[1], max[2] + shift[2]],
  ];
  const [lo, hi] = entityAabb;
  if (lo[0] < min[0]) slabs.push(shifted([-w, 0, 0]));
  if (lo[1] < min[1]) slabs.push(shifted([0, -h, 0]));
  if (lo[2] < min[2]) slabs.push(shifted([0, 0, -d]));
  if (hi[0] > max[0]) slabs.push(shifted([w, 0, 0]));
  if (hi[1] > max[1]) slabs.push(shifted([0, h, 0]));
  if (hi[2] > max[2]) slabs.push(shifted([0, 0, d]));
  return slabs;
}

// ---------------------------------------------------------------------------
// Backdrop: era art direction
// ---------------------------------------------------------------------------

export interface Ch1HorizonEra {
  dungeonId: string;
  /** Boundary shader tint. Not the world wall's violet — this is a time-bleed
   *  edge, so it reads in the aperture's own palette. */
  boundaryColour: readonly [number, number, number];
  boundaryLabel: string;
  /** Ground level the backdrop builds from, in authored Y. */
  baseY: number;
  /** Height noise: period + weight vector. The weights ARE the landform. */
  heightSeed: string;
  heightPeriod: number;
  heightWeights: readonly number[];
  /** Peak displacement in voxels once fully beyond the feather radius. */
  heightAmplitude: number;
  /** Feather distance over which the backdrop rises from the boundary. */
  featherRadius: number;
  /** 16-deep stratigraphic column, surface first. */
  columns: ReadonlyArray<readonly Ch1TerrainMaterial[]>;
  /** Column selection field — smooth variation of soil depth across the land. */
  columnSeed: string;
  /** Optional capping rule applied above a height threshold. */
  cap?: {
    material: Ch1TerrainMaterial;
    depth: number;
    minHeight: number;
    noiseSeed: string;
  };
}

export const CH1_HORIZON_ERAS: readonly Ch1HorizonEra[] = Object.freeze([
  {
    dungeonId: "ch1_dungeon_desert",
    // Bronze dusk. The aperture's own palette (CH1_GATE_PALETTES.desert.rim).
    boundaryColour: [1.0, 0.86, 0.55],
    boundaryLabel: "The aperture reaches no further",
    baseY: 2,
    // Dune sea: broad swells with a little fine ripple. No mid-frequency, so
    // the dunes read as long ridges rather than lumpy noise.
    heightSeed: "nerash_utu_dunes",
    heightPeriod: 192,
    heightWeights: [14, 0, 5, 2, 0.6],
    heightAmplitude: 26,
    featherRadius: 40,
    columns: [
      ["sand", "sand", "sand", "sand", "gravel", "stone"],
      ["sand", "sand", "sand", "gravel", "stone", "stone"],
      ["sand", "sand", "gravel", "stone", "stone", "stone"],
      ["sand", "gravel", "gravel", "stone", "stone", "stone"],
    ],
    columnSeed: "nerash_utu_soil_depth",
    // Wind-scoured mesa tops: limestone caps the high ground, as the city's
    // own quarries do.
    cap: {
      material: "limestoneBrick",
      depth: 2,
      minHeight: 18,
      noiseSeed: "nerash_utu_mesa",
    },
  },
  {
    dungeonId: "ch1_dungeon_winter",
    // Pale, almost colourless (CH1_GATE_PALETTES.winter.rim).
    boundaryColour: [0.86, 0.95, 1.0],
    boundaryLabel: "The stalled year reaches no further",
    baseY: 0,
    // Fjord walls: strong low frequency, sharp mid, so the land climbs hard
    // and stays climbing. This is the opposite art direction to the dunes.
    heightSeed: "hrafnsfjordr_walls",
    heightPeriod: 160,
    heightWeights: [10, 8, 5, 2, 1, 0.5],
    heightAmplitude: 44,
    featherRadius: 28,
    columns: [
      ["whiteWool", "whiteWool", "whiteWool", "stone", "stone", "stone"],
      ["whiteWool", "whiteWool", "whiteWool", "stone", "stone", "coal"],
      ["whiteWool", "whiteWool", "whiteWool", "cobblestone", "stone", "stone"],
    ],
    columnSeed: "hrafnsfjordr_soil_depth",
    // Snow is a CAP, never a drift: exactly three voxels over stone, matching
    // the shipped snow_peak column. Above the snow line only.
    cap: {
      material: "whiteWool",
      depth: 3,
      minHeight: 20,
      noiseSeed: "hrafnsfjordr_snowline",
    },
  },
]);

const ERA_BY_DUNGEON = new Map(CH1_HORIZON_ERAS.map((e) => [e.dungeonId, e]));

export function ch1HorizonEra(dungeonId: string): Ch1HorizonEra | undefined {
  return ERA_BY_DUNGEON.get(dungeonId);
}

// ---------------------------------------------------------------------------
// Backdrop buildings — silhouettes of the settlement that continues
// ---------------------------------------------------------------------------

export interface Ch1HorizonBuilding {
  name: string;
  dungeonId: string;
  /** Authored footprint. Must lie entirely beyond the boundary. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Height above the local ground surface. */
  height: number;
  wall: Ch1TerrainMaterial;
  roof: Ch1TerrainMaterial;
  /** Stepped ziggurat / tiered massing instead of a plain box. */
  tiers?: number;
  note: string;
}

export const CH1_HORIZON_BUILDINGS: readonly Ch1HorizonBuilding[] =
  Object.freeze([
    // --- Nerash-Utu continues north and south of the excavated strip -------
    {
      name: "upper_city_terraces",
      dungeonId: "ch1_dungeon_desert",
      x0: 150,
      x1: 214,
      z0: -190,
      z1: -140,
      height: 14,
      wall: "limestoneBrick",
      roof: "sand",
      tiers: 3,
      note: "The residential terraces. Stepped because the city built up a slope.",
    },
    {
      name: "great_ziggurat",
      dungeonId: "ch1_dungeon_desert",
      x0: 250,
      x1: 310,
      z0: -206,
      z1: -156,
      height: 30,
      wall: "limestoneBrick",
      roof: "stonePolished",
      tiers: 5,
      note: "The temple over the Sleeping Weight. The one silhouette that must read from anywhere.",
    },
    {
      name: "north_granary_row",
      dungeonId: "ch1_dungeon_desert",
      x0: 340,
      x1: 392,
      z0: -172,
      z1: -142,
      height: 10,
      wall: "sand",
      roof: "limestoneBrick",
      tiers: 2,
      note: "More granaries. The Seed Vault the player robs was not the only one.",
    },
    {
      name: "south_kilns",
      dungeonId: "ch1_dungeon_desert",
      x0: 180,
      x1: 232,
      z0: 40,
      z1: 74,
      height: 12,
      wall: "cobblestoneBrick",
      roof: "coal",
      tiers: 2,
      note: "The bronze foundries. Their chimneys are the reason the sky is dirty.",
    },
    {
      name: "far_city_wall",
      dungeonId: "ch1_dungeon_desert",
      x0: 60,
      x1: 470,
      z0: -232,
      z1: -224,
      height: 16,
      wall: "limestoneBrick",
      roof: "limestoneBrick",
      note: "A long wall closing the horizon. Reads as a city, not scattered ruins.",
    },

    // --- Hrafnsfjördr continues along both shores -------------------------
    {
      name: "upper_longhouse_row",
      dungeonId: "ch1_dungeon_winter",
      x0: 150,
      x1: 250,
      z0: -212,
      z1: -186,
      height: 11,
      wall: "oakLog",
      roof: "blackWool",
      note: "Six more longhouses. The settlement Hallr actually keeps alive.",
    },
    {
      name: "stave_hall",
      dungeonId: "ch1_dungeon_winter",
      x0: 280,
      x1: 322,
      z0: -222,
      z1: -190,
      height: 26,
      wall: "oakLog",
      roof: "blackWool",
      tiers: 3,
      note: "The tall hall. The one vertical in a horizontal landscape.",
    },
    {
      name: "boat_sheds",
      dungeonId: "ch1_dungeon_winter",
      x0: 90,
      x1: 160,
      z0: 30,
      z1: 58,
      height: 9,
      wall: "oakLumber",
      roof: "thatch",
      note: "Ship sheds on the far shore. Nine years of boats nobody can sail.",
    },
    {
      name: "far_headland_cairns",
      dungeonId: "ch1_dungeon_winter",
      x0: 330,
      x1: 430,
      z0: 44,
      z1: 84,
      height: 13,
      wall: "cobblestone",
      roof: "stone",
      tiers: 2,
      note: "Grave cairns on the headland. Nobody has needed them for nine years.",
    },
  ]);

export function ch1HorizonBuildingsFor(
  dungeonId: string
): readonly Ch1HorizonBuilding[] {
  return CH1_HORIZON_BUILDINGS.filter((b) => b.dungeonId === dungeonId);
}

// ---------------------------------------------------------------------------
// Voxel query
// ---------------------------------------------------------------------------

/** Ground surface height of the backdrop at an authored XZ, in authored Y. */
export function ch1HorizonSurfaceY(dungeonId: string, x: number, z: number): number {
  const era = ERA_BY_DUNGEON.get(dungeonId);
  const terrain = ch1DungeonTerrain(dungeonId);
  if (!era || !terrain) {
    return 0;
  }
  const bounds = ch1PlayableBounds(terrain);
  const beyond = ch1DistanceBeyondBoundary(bounds, x, z);
  if (beyond <= 0) {
    return era.baseY;
  }
  // Feather: the land RISES from the boundary rather than starting as a cliff.
  const feather = ch1LinearBoundary(beyond, era.featherRadius);
  // Bias upward: a horizon that dips below the player is a pit, not a vista.
  const lift =
    harthmereUpwardBiasedNoise(
      era.heightSeed,
      x,
      z,
      era.heightPeriod,
      era.heightWeights
    ) * era.heightAmplitude;
  return Math.round(era.baseY + feather * lift);
}

function columnFor(era: Ch1HorizonEra, x: number, z: number) {
  // Coherent field quantised into buckets, so topsoil depth varies SMOOTHLY
  // across the landscape instead of per-column white noise.
  const n = ch1ExplicitNoise(era.columnSeed, x, z, 128, [1, 0, 1, 1, 0.4, 0.2]);
  const t = Math.max(0, Math.min(0.999, n * 0.5 + 0.5));
  return era.columns[Math.floor(t * era.columns.length)];
}

function buildingAt(dungeonId: string, x: number, z: number) {
  for (const b of CH1_HORIZON_BUILDINGS) {
    if (
      b.dungeonId === dungeonId &&
      x >= b.x0 &&
      x <= b.x1 &&
      z >= b.z0 &&
      z <= b.z1
    ) {
      return b;
    }
  }
  return undefined;
}

/**
 * Solid block material at an authored backdrop position, or undefined for air.
 *
 * SAFETY: returns undefined for ANY position inside the playable box. The
 * backdrop physically cannot overwrite a dungeon room.
 */
export function ch1HorizonBlockAt(
  dungeonId: string,
  x: number,
  y: number,
  z: number
): Ch1TerrainMaterial | undefined {
  const era = ERA_BY_DUNGEON.get(dungeonId);
  const terrain = ch1DungeonTerrain(dungeonId);
  if (!era || !terrain) {
    return undefined;
  }
  const bounds = ch1PlayableBounds(terrain);
  // The one rule that makes this module safe to add to a finished dungeon.
  if (ch1PointInsidePlayable(bounds, x, y, z)) {
    return undefined;
  }
  const slot = ch1ElsewhenSlot(dungeonId);
  if (!slot) {
    return undefined;
  }

  const surface = ch1HorizonSurfaceY(dungeonId, x, z);

  // --- buildings ---------------------------------------------------------
  const building = buildingAt(dungeonId, x, z);
  if (building) {
    const tiers = building.tiers ?? 1;
    // Tiered massing: each tier insets, so the silhouette steps instead of
    // being a slab. A ziggurat is five boxes, not one.
    const insetX = (building.x1 - building.x0) / (tiers * 2 + 2);
    const insetZ = (building.z1 - building.z0) / (tiers * 2 + 2);
    for (let tier = tiers - 1; tier >= 0; tier--) {
      const tx0 = building.x0 + insetX * tier;
      const tx1 = building.x1 - insetX * tier;
      const tz0 = building.z0 + insetZ * tier;
      const tz1 = building.z1 - insetZ * tier;
      if (x < tx0 || x > tx1 || z < tz0 || z > tz1) {
        continue;
      }
      const top = surface + Math.round((building.height * (tier + 1)) / tiers);
      if (y > top) {
        continue;
      }
      if (y < surface) {
        break; // fall through to terrain below the building
      }
      return y === top ? building.roof : building.wall;
    }
  }

  // --- terrain -----------------------------------------------------------
  if (y > surface) {
    return undefined;
  }
  const depth = surface - y;

  // Cap material (mesa limestone / the three-voxel snow cap) above the line.
  if (era.cap) {
    const capNoise =
      ch1ExplicitNoise(era.cap.noiseSeed, x, z, 96, [8, 4, 2]) * 1.2;
    if (surface >= era.cap.minHeight + capNoise && depth < era.cap.depth) {
      return era.cap.material;
    }
  }

  const column = columnFor(era, x, z);
  if (depth < column.length) {
    return column[depth];
  }
  // Everything deeper is the era's bedrock. The backdrop is scenery: it does
  // not need ore, caves, or strata nobody will ever mine.
  return "stone";
}

/** True where the backdrop should exist at all. Used to bound seeding work. */
export function ch1HorizonCoversColumn(
  dungeonId: string,
  x: number,
  z: number
): boolean {
  const terrain = ch1DungeonTerrain(dungeonId);
  if (!terrain) {
    return false;
  }
  return ch1DistanceBeyondBoundary(ch1PlayableBounds(terrain), x, z) > 0;
}

/**
 * SEEDER INTEGRATION
 *
 * The Elsewhen terrain seeder already walks authored coordinates and asks
 * `ch1DungeonBlockAt()` what to place. Adding the horizon is one extra call in
 * that same loop, AFTER the dungeon has had its say:
 *
 * ```ts
 * const block =
 *   ch1DungeonBlockAt(dungeonId, x, y, z) ??
 *   ch1HorizonBlockAt(dungeonId, x, y, z);
 * ```
 *
 * Order matters and this is the safe order: the dungeon always wins, and
 * `ch1HorizonBlockAt` refuses to return anything inside the playable box
 * anyway, so the two can never disagree about a voxel.
 *
 * Air is NOT carved beyond the boundary — `ch1ShouldCarveAirAt` is unchanged
 * and the backdrop is solid ground with sky above it, which is what a horizon
 * is. Nothing about the existing dungeon pipeline changes.
 */
export function ch1SeederBlockAt(
  dungeonId: string,
  x: number,
  y: number,
  z: number,
  dungeonBlock: Ch1TerrainMaterial | undefined
): Ch1TerrainMaterial | undefined {
  return dungeonBlock ?? ch1HorizonBlockAt(dungeonId, x, y, z);
}

/**
 * Shard columns the backdrop touches, so the seeder can size its work without
 * walking the whole 512-wide slot. Returns authored XZ ranges only; Y comes
 * from `ch1HorizonSurfaceY`.
 */
export function ch1HorizonAuthoredExtent(dungeonId: string):
  | { x0: number; x1: number; z0: number; z1: number }
  | undefined {
  const terrain = ch1DungeonTerrain(dungeonId);
  const era = ERA_BY_DUNGEON.get(dungeonId);
  if (!terrain || !era) {
    return undefined;
  }
  const bounds = ch1PlayableBounds(terrain);
  // Reach far enough that the feathered rise completes and the skyline sits
  // inside it, but no further — empty shards cost streaming for nothing.
  const reach = era.featherRadius * 3;
  let x0 = bounds.x0 - reach;
  let x1 = bounds.x1 + reach;
  let z0 = bounds.z0 - reach;
  let z1 = bounds.z1 + reach;
  for (const building of ch1HorizonBuildingsFor(dungeonId)) {
    x0 = Math.min(x0, building.x0 - 8);
    x1 = Math.max(x1, building.x1 + 8);
    z0 = Math.min(z0, building.z0 - 8);
    z1 = Math.max(z1, building.z1 + 8);
  }
  return { x0, x1, z0, z1 };
}

// ---------------------------------------------------------------------------
// Boundary visual contract
//
// These live here, not in the renderer, because they are pure maths and pure
// constants: keeping them shared means the contract can be tested in ~1 s
// without dragging the whole client graph into the typecheck.
// ---------------------------------------------------------------------------

/** Shader fade distance. Quintic falloff reaches zero here. */
export const CH1_HORIZON_FADE_DISTANCE = 40;
/**
 * Proximity cull threshold. MUST stay below the fade distance so the box pops
 * in while still fully transparent rather than snapping to visible.
 */
export const CH1_HORIZON_DRAW_DISTANCE = 24;

/**
 * Distance to the nearest face of a box, measured from inside. A single `min`
 * over six values — the same cheap test the world boundary uses. Negative once
 * the position is outside.
 */
export function ch1HorizonDistanceToNearestFace(
  position: readonly [number, number, number],
  min: readonly [number, number, number],
  max: readonly [number, number, number]
): number {
  return Math.min(
    position[0] - min[0],
    position[1] - min[1],
    position[2] - min[2],
    max[0] - position[0],
    max[1] - position[1],
    max[2] - position[2]
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function ch1ValidateHorizon(): string[] {
  const errors: string[] = [];
  for (const terrain of CH1_DUNGEON_TERRAIN) {
    const era = ERA_BY_DUNGEON.get(terrain.dungeonId);
    if (!era) {
      errors.push(`${terrain.dungeonId}: no horizon era authored`);
      continue;
    }
    const bounds = ch1PlayableBounds(terrain);
    const slot = ch1ElsewhenSlot(terrain.dungeonId);
    if (!slot) {
      errors.push(`${terrain.dungeonId}: no Elsewhen slot`);
      continue;
    }

    // Every authored room must be strictly inside the playable box, or the
    // boundary would cut a dungeon in half.
    for (const volume of terrain.volumes) {
      if (
        volume.x0 < bounds.x0 ||
        volume.x1 > bounds.x1 ||
        volume.z0 < bounds.z0 ||
        volume.z1 > bounds.z1 ||
        volume.y1 > bounds.y1
      ) {
        errors.push(
          `${terrain.dungeonId}/${volume.name}: outside the derived playable box`
        );
      }
    }

    // Arrival and departure must be inside it too, or the player warps into
    // a wall or straight out of the world.
    for (const [label, point] of [
      ["arrival", terrain.arrival],
      ["departure", terrain.departure],
    ] as ReadonlyArray<[string, Ch1AuthoredPos]>) {
      if (!ch1PointInsidePlayable(bounds, point.x, point.y, point.z)) {
        errors.push(
          `${terrain.dungeonId}: ${label} is outside the playable box`
        );
      }
    }

    // Buildings must be wholly beyond the boundary and inside the slot.
    for (const building of ch1HorizonBuildingsFor(terrain.dungeonId)) {
      for (const [bx, bz] of [
        [building.x0, building.z0],
        [building.x1, building.z1],
        [building.x0, building.z1],
        [building.x1, building.z0],
      ]) {
        if (ch1DistanceBeyondBoundary(bounds, bx, bz) <= 0) {
          errors.push(
            `${building.name}: corner (${bx}, ${bz}) is inside the playable ` +
              `box — a backdrop building must never be reachable`
          );
        }
        const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
          x: bx,
          y: 0,
          z: bz,
        });
        if (world[0] < slot.minX || world[0] >= slot.maxX) {
          errors.push(`${building.name}: escapes its dungeon's slot in X`);
        }
      }
      if (building.height <= 0) {
        errors.push(`${building.name}: has no height`);
      }
      if ((building.tiers ?? 1) < 1) {
        errors.push(`${building.name}: tiers must be at least 1`);
      }
    }

    // Column contract: 16-deep max, surface material first, never empty.
    for (const column of era.columns) {
      if (column.length === 0 || column.length > 16) {
        errors.push(`${terrain.dungeonId}: column depth must be 1..16`);
      }
    }
    if (era.cap && era.cap.depth <= 0) {
      errors.push(`${terrain.dungeonId}: cap depth must be positive`);
    }
    if (era.featherRadius <= 0) {
      errors.push(
        `${terrain.dungeonId}: featherRadius must be positive or the backdrop ` +
          `starts as a cliff at the boundary`
      );
    }
  }
  return errors;
}
