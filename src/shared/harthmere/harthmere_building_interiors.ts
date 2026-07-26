// HARTHMERE_BUILDING_INTERIORS
//
// Furniture for Harthmere's 57 buildings.
//
// WHY BLOCKS AND NOT PLACEABLES
// The world-anatomy doc is blunt about this (4.3.6): Biomes ships no beds, no
// chairs, no shelves, no rugs, no dressers. The entire placeable catalogue has
// four true pieces of furniture. Everything else a room needs is built from
// BLOCKS shaped with the 23-shape system — "a bench, a shelf, a bed frame and a
// countertop are all just blocks shaped with slab, step, table, stub, beam or
// inset and dyed". Placeables are reserved for things that need behaviour: an
// inventory, an animation, a screen, a light, an ACL.
//
// So furniture here is voxels. The shim's seeder writes plain TerrainIDs with
// no shape or isomorphism channel, so a "table" is a lumber slab on a log leg
// rather than a `table`-shaped block — the same idea at voxel granularity.
//
// Lighting follows the same section (4.3.3): "there is no lamp, torch, lantern
// or candle placeable... to light a room in Biomes you build the light into the
// wall out of sunstone or LED blocks." Rooms here get LED set into the ceiling.
//
// THE RULE THAT MATTERS
// Furniture may only ADD. It must never seal a doorway, block a stair, fill a
// room-partition gap, or wander into a neighbouring building — Harthmere has
// seven pairs of authored buildings whose footprints overlap, so "inside this
// building" is not the same as "not inside any other building". Every exclusion
// below is deliberately WIDER than the shim's own rule. If the two ever drift,
// furniture stops early rather than growing into a doorway.

import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
  type HarthmereMat,
} from "@/shared/harthmere/harthmere_town_buildings";

export const HARTHMERE_BUILDING_INTERIORS_VERSION =
  "harthmere-building-interiors-v1" as const;

/** A furniture voxel box, in authored coordinates, with relY above the floor. */
export interface HarthmereFurnitureBox {
  piece: string;
  material: HarthmereMat;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Height above this floor's own floor slab, so 1 sits on the ground. */
  y0: number;
  y1: number;
}

// ---------------------------------------------------------------------------
// Geometry the shim also computes. Duplicated deliberately — see the header.
// ---------------------------------------------------------------------------

export function harthmereFloorCountOf(building: HarthmereBuilding): number {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

export function harthmereStoryHeightOf(building: HarthmereBuilding): number {
  return building.profile === "gatehouse" || building.profile === "tower"
    ? 6
    : 5;
}

/**
 * The shim carves a door lane +/-2 laterally and +/-3 deep. This uses +/-3 and
 * +/-5: furniture must clear the threshold by a margin, not meet it exactly, or
 * a player walking in meets a crate in the doorway.
 */
function inDoorLane(
  building: HarthmereBuilding,
  x: number,
  z: number
): boolean {
  const lateral = 3;
  const depth = 5;
  if (building.doorSide === "north") {
    return (
      Math.abs(x - building.doorCenter) <= lateral &&
      z >= building.z0 - depth &&
      z <= building.z0 + depth
    );
  }
  if (building.doorSide === "south") {
    return (
      Math.abs(x - building.doorCenter) <= lateral &&
      z >= building.z1 - depth &&
      z <= building.z1 + depth
    );
  }
  if (building.doorSide === "west") {
    return (
      Math.abs(z - building.doorCenter) <= lateral &&
      x >= building.x0 - depth &&
      x <= building.x0 + depth
    );
  }
  return (
    Math.abs(z - building.doorCenter) <= lateral &&
    x >= building.x1 - depth &&
    x <= building.x1 + depth
  );
}

/** A generous box around the stairs and their landing. */
function onStairs(building: HarthmereBuilding, x: number, z: number): boolean {
  const stairs = building.stairs;
  if (!stairs) {
    return false;
  }
  const pad = 3;
  const spanX =
    stairs.direction === "east" || stairs.direction === "west"
      ? stairs.length
      : stairs.width;
  const spanZ =
    stairs.direction === "east" || stairs.direction === "west"
      ? stairs.width
      : stairs.length;
  return (
    x >= stairs.x0 - pad &&
    x <= stairs.x0 + spanX + pad &&
    z >= stairs.z0 - pad &&
    z <= stairs.z0 + spanZ + pad
  );
}

/**
 * The shim splits large buildings with a cross partition on the mid lines and
 * leaves a doorway within two voxels of the middle. Furniture keeps three
 * voxels clear of the partition lines so those doorways stay usable.
 */
function onPartition(
  building: HarthmereBuilding,
  x: number,
  z: number
): boolean {
  const width = building.x1 - building.x0 + 1;
  const depth = building.z1 - building.z0 + 1;
  if (width < 12 || depth < 12) {
    return false;
  }
  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  // The partition is a single wall line with a five-wide doorway centred on it.
  // Two voxels of clearance keeps both the wall and its doorway usable; three
  // was over-cautious and left one 15x15 building (mail_post_house) with no
  // legal spot for anything at all.
  return Math.abs(x - midX) <= 2 || Math.abs(z - midZ) <= 2;
}

/** True if this column lies inside any OTHER building's footprint. */
function insideAnotherBuilding(
  building: HarthmereBuilding,
  x: number,
  z: number
): boolean {
  for (const other of HARTHMERE_BUILDINGS) {
    if (other === building || other.name === building.name) {
      continue;
    }
    if (x >= other.x0 && x <= other.x1 && z >= other.z0 && z <= other.z1) {
      return true;
    }
  }
  return false;
}

function chimneyHearth(
  building: HarthmereBuilding
): readonly [number, number] | undefined {
  return building.chimney;
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

// ---------------------------------------------------------------------------
// The furniture vocabulary
//
// Each entry is a small box list in LOCAL coordinates, anchored at a spot on
// the inner wall band with `inward` pointing away from that wall. Keeping every
// piece at most two voxels deep is what leaves the middle of every room open:
// furniture lines the walls, players use the floor.
// ---------------------------------------------------------------------------

type Facing = "north" | "south" | "east" | "west";

interface FurniturePattern {
  name: string;
  /** Footprint along the wall, and how far it reaches inward. */
  along: number;
  deep: number;
  build: (
    put: (
      along: number,
      inward: number,
      y0: number,
      y1: number,
      material: HarthmereMat
    ) => void
  ) => void;
}

const BED: FurniturePattern = {
  name: "bed",
  along: 2,
  deep: 3,
  build: (put) => {
    // Mattress of thatch on a lumber frame, with a log headboard at the wall.
    put(0, 0, 1, 2, "oakLog");
    put(1, 0, 1, 2, "oakLog");
    put(0, 1, 1, 1, "thatch");
    put(1, 1, 1, 1, "thatch");
    put(0, 2, 1, 1, "thatch");
    put(1, 2, 1, 1, "thatch");
  },
};

const TABLE_AND_BENCH: FurniturePattern = {
  name: "table",
  along: 3,
  deep: 2,
  build: (put) => {
    // Doc 4.1's `table` shape, at voxel scale: a lumber top on a log leg.
    put(1, 0, 1, 1, "oakLog");
    put(0, 0, 2, 2, "oakLumber");
    put(1, 0, 2, 2, "oakLumber");
    put(2, 0, 2, 2, "oakLumber");
    // A bench alongside, one voxel high — the `slab` idiom.
    put(0, 1, 1, 1, "oakLumber");
    put(1, 1, 1, 1, "oakLumber");
  },
};

const SHELF: FurniturePattern = {
  name: "shelf",
  along: 3,
  deep: 1,
  build: (put) => {
    // Two lumber runs against the wall — the `stub`/`beam` idiom.
    for (let a = 0; a < 3; a += 1) {
      put(a, 0, 2, 2, "oakLumber");
      put(a, 0, 4, 4, "oakLumber");
    }
    put(0, 0, 1, 1, "woodCrate");
  },
};

const CRATES: FurniturePattern = {
  name: "crates",
  along: 2,
  deep: 1,
  build: (put) => {
    put(0, 0, 1, 2, "woodCrate");
    put(1, 0, 1, 1, "woodCrate");
  },
};

const COUNTER: FurniturePattern = {
  name: "counter",
  along: 4,
  deep: 1,
  build: (put) => {
    for (let a = 0; a < 4; a += 1) {
      put(a, 0, 1, 1, "stoneBrick");
      put(a, 0, 2, 2, "oakLumber");
    }
  },
};

const HEARTH: FurniturePattern = {
  name: "hearth",
  along: 3,
  deep: 1,
  build: (put) => {
    put(0, 0, 1, 2, "stoneBrick");
    put(2, 0, 1, 2, "stoneBrick");
    put(1, 0, 1, 1, "coal");
  },
};

const ANVIL: FurniturePattern = {
  name: "anvil",
  along: 2,
  deep: 1,
  build: (put) => {
    put(0, 0, 1, 1, "stonePolished");
    put(0, 0, 2, 2, "coal");
    put(1, 0, 1, 1, "woodCrate");
  },
};

const STRAW_BUNK: FurniturePattern = {
  name: "straw_bunk",
  along: 3,
  deep: 2,
  build: (put) => {
    for (let a = 0; a < 3; a += 1) {
      put(a, 0, 1, 1, "hay");
      put(a, 1, 1, 1, "hay");
    }
  },
};

const BARRELS: FurniturePattern = {
  name: "barrels",
  along: 2,
  deep: 1,
  build: (put) => {
    put(0, 0, 1, 2, "oakLog");
    put(1, 0, 1, 1, "oakLog");
  },
};

/**
 * What a room is furnished with depends on what it is for. A smithy gets an
 * anvil, a slum loft gets straw, a shop gets a counter. Doc 4.3.1 makes the
 * same point about placeables: the object catalogue is small, and what
 * distinguishes a room is which things are in it.
 */
function patternsForProfile(
  building: HarthmereBuilding
): readonly FurniturePattern[] {
  const label = `${building.name} ${building.district} ${
    building.profile ?? ""
  }`.toLowerCase();

  if (/smithy|forge|anvil/.test(label)) {
    return [ANVIL, CRATES, COUNTER, SHELF, BARRELS];
  }
  if (/stable|barn|kennel|coop/.test(label)) {
    return [STRAW_BUNK, BARRELS, CRATES, SHELF];
  }
  if (/slum|stack|shanty|hovel/.test(label) || building.profile === "slum") {
    return [STRAW_BUNK, CRATES, TABLE_AND_BENCH, BARRELS];
  }
  if (/market|shop|store|trade|auction|bank|post|toll/.test(label)) {
    return [COUNTER, SHELF, CRATES, TABLE_AND_BENCH, BARRELS];
  }
  if (/tavern|inn|kitchen|bakery|hearth/.test(label)) {
    return [TABLE_AND_BENCH, HEARTH, BARRELS, SHELF, CRATES];
  }
  if (/chapel|shrine|hall|court/.test(label)) {
    return [TABLE_AND_BENCH, SHELF, HEARTH];
  }
  if (/barracks|guard|watch|gatehouse|bunk/.test(label)) {
    return [BED, CRATES, TABLE_AND_BENCH, SHELF];
  }
  if (
    building.profile === "apartment" ||
    building.profile === "house" ||
    /house|cottage|home|loft|family|residence/.test(label)
  ) {
    return [BED, TABLE_AND_BENCH, SHELF, HEARTH, CRATES];
  }
  return [TABLE_AND_BENCH, SHELF, CRATES, BARRELS];
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface WallSlot {
  x: number;
  z: number;
  facing: Facing;
}

/** Walk the band one voxel inside the walls, in a stable order. */
function wallSlots(building: HarthmereBuilding): WallSlot[] {
  const slots: WallSlot[] = [];
  const ix0 = building.x0 + 1;
  const ix1 = building.x1 - 1;
  const iz0 = building.z0 + 1;
  const iz1 = building.z1 - 1;
  for (let x = ix0; x <= ix1; x += 1) {
    slots.push({ x, z: iz0, facing: "south" });
    slots.push({ x, z: iz1, facing: "north" });
  }
  for (let z = iz0 + 1; z <= iz1 - 1; z += 1) {
    slots.push({ x: ix0, z, facing: "east" });
    slots.push({ x: ix1, z, facing: "west" });
  }
  return slots;
}

function step(facing: Facing): {
  along: readonly [number, number];
  inward: readonly [number, number];
} {
  switch (facing) {
    case "south":
      return { along: [1, 0], inward: [0, 1] };
    case "north":
      return { along: [1, 0], inward: [0, -1] };
    case "east":
      return { along: [0, 1], inward: [1, 0] };
    default:
      return { along: [0, 1], inward: [-1, 0] };
  }
}

function columnIsFree(
  building: HarthmereBuilding,
  x: number,
  z: number
): boolean {
  if (x <= building.x0 || x >= building.x1) return false;
  if (z <= building.z0 || z >= building.z1) return false;
  if (inDoorLane(building, x, z)) return false;
  if (onStairs(building, x, z)) return false;
  if (onPartition(building, x, z)) return false;
  if (insideAnotherBuilding(building, x, z)) return false;
  return true;
}

/**
 * Furnish one floor.
 *
 * Pieces are laid along the wall band in slot order, each claiming its own
 * footprint so two pieces never share a voxel, and every column a piece needs
 * is checked against every exclusion first. A piece that does not fit is simply
 * skipped — there is no fallback that squeezes it in somewhere worse.
 */
function furnishFloor(
  building: HarthmereBuilding,
  floor: number
): HarthmereFurnitureBox[] {
  const boxes: HarthmereFurnitureBox[] = [];
  const claimed = new Set<string>();
  const patterns = patternsForProfile(building);
  const storyHeight = harthmereStoryHeightOf(building);
  const slots = wallSlots(building);

  const claim = (x: number, z: number) => claimed.add(`${x}:${z}`);
  const isClaimed = (x: number, z: number) => claimed.has(`${x}:${z}`);

  // A hearth belongs under its chimney; that is the whole point of a chimney.
  const chimney = chimneyHearth(building);
  if (chimney && floor === 0) {
    const [cx, cz] = chimney;
    for (const [dx, dz] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const hx = cx + dx;
      const hz = cz + dz;
      if (columnIsFree(building, hx, hz) && !isClaimed(hx, hz)) {
        boxes.push({
          piece: "chimney_hearth",
          material: "coal",
          x0: hx,
          x1: hx,
          z0: hz,
          z1: hz,
          y0: 1,
          y1: 1,
        });
        claim(hx, hz);
        break;
      }
    }
  }

  let cursor = Math.floor(hash(building.x0, building.z0, floor) * slots.length);
  let placed = 0;
  // Roughly one piece per five voxels of wall. A 25x23 hall gets about
  // sixteen, a small cottage three or four. Tuned by looking at rendered
  // cross-sections: slots/9 left the big halls looking abandoned.
  const target = Math.max(3, Math.min(16, Math.floor(slots.length / 5)));
  let guard = 0;

  while (placed < target && guard < slots.length * 2) {
    guard += 1;
    const slot = slots[cursor % slots.length];
    cursor += 3 + Math.floor(hash(slot.x, slot.z, floor + 7) * 4);

    const pattern =
      patterns[Math.floor(hash(slot.x, slot.z, floor + 31) * patterns.length)];
    const { along, inward } = step(slot.facing);

    // Every column this piece needs must be free and unclaimed.
    let fits = true;
    for (let a = 0; a < pattern.along && fits; a += 1) {
      for (let d = 0; d < pattern.deep; d += 1) {
        const x = slot.x + along[0] * a + inward[0] * d;
        const z = slot.z + along[1] * a + inward[1] * d;
        if (!columnIsFree(building, x, z) || isClaimed(x, z)) {
          fits = false;
          break;
        }
      }
    }
    if (!fits) {
      continue;
    }

    pattern.build((a, d, y0, y1, material) => {
      const x = slot.x + along[0] * a + inward[0] * d;
      const z = slot.z + along[1] * a + inward[1] * d;
      boxes.push({
        piece: pattern.name,
        material,
        x0: x,
        x1: x,
        z0: z,
        z1: z,
        y0: Math.min(y0, storyHeight - 2),
        y1: Math.min(y1, storyHeight - 2),
      });
    });
    for (let a = 0; a < pattern.along; a += 1) {
      for (let d = 0; d < pattern.deep; d += 1) {
        claim(
          slot.x + along[0] * a + inward[0] * d,
          slot.z + along[1] * a + inward[1] * d
        );
      }
    }
    placed += 1;
  }

  // Doc 4.3.3: no lamps exist. Light is built into the structure, so set LED
  // into the ceiling. Placed last and only on free columns, so a light can
  // never be the thing that blocks a doorway.
  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  for (const [lx, lz] of [
    [midX - 3, midZ - 3],
    [midX + 3, midZ + 3],
  ] as const) {
    if (columnIsFree(building, lx, lz)) {
      boxes.push({
        piece: "ceiling_led",
        material: "led",
        x0: lx,
        x1: lx,
        z0: lz,
        z1: lz,
        y0: storyHeight - 1,
        y1: storyHeight - 1,
      });
    }
  }

  return boxes;
}

// Furnishing a building is a few hundred operations and there are 57 of them,
// so the whole town is memoised on first touch and never recomputed.
const furnitureCache = new Map<string, HarthmereFurnitureBox[]>();

export function harthmereBuildingFurniture(
  building: HarthmereBuilding
): HarthmereFurnitureBox[] {
  const cached = furnitureCache.get(building.name);
  if (cached) {
    return cached;
  }
  const floors = harthmereFloorCountOf(building);
  const storyHeight = harthmereStoryHeightOf(building);
  const all: HarthmereFurnitureBox[] = [];
  for (let floor = 0; floor < floors; floor += 1) {
    const base = floor * storyHeight;
    for (const box of furnishFloor(building, floor)) {
      all.push({ ...box, y0: box.y0 + base, y1: box.y1 + base });
    }
  }
  furnitureCache.set(building.name, all);
  return all;
}

export function harthmereResetInteriorCache(): void {
  furnitureCache.clear();
}

/**
 * The furniture voxel at a position inside a building, or undefined.
 * `relY` is measured from the building's ground floor, as the shim measures it.
 */
export function harthmereBuildingInteriorBlockAt(
  building: HarthmereBuilding,
  x: number,
  relY: number,
  z: number
): HarthmereMat | undefined {
  if (x <= building.x0 || x >= building.x1) return undefined;
  if (z <= building.z0 || z >= building.z1) return undefined;
  for (const box of harthmereBuildingFurniture(building)) {
    if (
      x >= box.x0 &&
      x <= box.x1 &&
      z >= box.z0 &&
      z <= box.z1 &&
      relY >= box.y0 &&
      relY <= box.y1
    ) {
      return box.material;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function harthmereValidateBuildingInteriors(): string[] {
  const problems: string[] = [];
  for (const building of HARTHMERE_BUILDINGS) {
    const furniture = harthmereBuildingFurniture(building);
    if (furniture.length === 0) {
      problems.push(`${building.name}: no furniture at all`);
    }
    for (const box of furniture) {
      if (
        box.x0 <= building.x0 ||
        box.x1 >= building.x1 ||
        box.z0 <= building.z0 ||
        box.z1 >= building.z1
      ) {
        problems.push(
          `${building.name}: ${box.piece} at (${box.x0},${box.z0}) is in a wall`
        );
      }
    }
  }
  return problems;
}
