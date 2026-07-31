// HARTHMERE_BUILDING_EXCLUSION (vegetation-indoors fix, 2026-07-30)
//
// WHAT WENT WRONG
// ---------------
// Buildings and the wilds forest are two independent writers into the same
// seeder, and the seeder composes them as:
//
//   starterTownAboveGroundBlockAt =
//     harthmereFullTownBlockAt(...)      // walls, roof, floor, stairs
//     ?? harthmereWideWildsBlockAt(...)  // forest, ground cover, scatter
//
// A building only returns a block for its SOLID voxels. The room volume it
// encloses returns `undefined` — that is what makes it a room. So the wilds
// generator, which is asked next, sees a column of air exactly where the room
// is and does what it is designed to do: grows a tree in it.
//
// The only thing that ever hid this was `harthmereWildsForestAllowed`'s town
// rectangle (authored 392..590, -282..-112, padded 22). Thirty-four buildings
// are inside it. **Twenty-three are not** — every Residential District row
// house, the Mudden Ward tangle stairs, Edrik Vane's Noble Rise estate, and
// every structure in the Wilds: the watermill and its cottage, the Last Watch
// Post bunkhouse, the charcoal burners' camp, the Briarfen stilt hut, the
// Greenmere cabin, the Deep Old Wood lodge, the grave-tender's house, the
// Thornbridge shelter, the northwest ruined watchtower, and the southwest
// orchard windmill. Those are precisely the buildings the player found full of
// oak trunks, leaf blocks and wild grass.
//
// WHY A SHARED MODULE
// -------------------
// Three separate consumers need the same answer and had three different
// notions of "inside a building":
//
//   * the seeder's `harthmereWildsForestAllowed` (trees + ground cover),
//   * the seeder's relY-1 harvestable/decor scatter (crates, roses, grass),
//   * `extension_surface_repair.ts`, which RE-DRESSES repaired columns as
//     forest and would otherwise replant a wood inside the mill on every
//     deploy.
//
// The building table is the one source of truth for where a building is, so
// the predicate is derived from it and never hand-copied. Add a building and
// it is excluded automatically.
//
// WHAT THIS DOES NOT DO
// ---------------------
// It does not remove or alter one structural voxel. It only tells vegetation
// writers "not here". Interiors are furnished by
// `harthmere_building_interiors.ts` — furniture, doors, crafting stations,
// beds, lighting — which is the only thing that belongs in a room.

import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
} from "@/shared/harthmere/harthmere_town_buildings";
import { HARTHMERE_FOREST_MAX_CANOPY_RADIUS } from "@/shared/harthmere/harthmere_wilds_forest";

export const HARTHMERE_BUILDING_EXCLUSION_VERSION =
  "harthmere-building-vegetation-exclusion-v1" as const;

/**
 * Margin around a footprint where no vegetation may be written.
 *
 * One voxel would be enough to keep growth out of the room itself, because the
 * generator is asked per-column and a leaf is written into the column it is
 * asked about. Two keeps trunks from growing flush against an outside wall,
 * which reads as a bug even when it is geometrically legal, and keeps a sapling
 * out of a doorway's threshold.
 */
export const HARTHMERE_BUILDING_VEGETATION_PAD = 2;

/**
 * Margin used when deciding whether a TREE CENTRE is too close.
 *
 * A trunk this far out can still throw a canopy lobe over the roof, which is
 * wanted — a mill under old oaks is the point. What it must not do is drop
 * leaves into the room, and the per-column rule above already guarantees that.
 * This wider radius exists only for callers that reason about whole trees
 * (audits, clearing passes) rather than single columns.
 */
export const HARTHMERE_BUILDING_CANOPY_PAD =
  HARTHMERE_BUILDING_VEGETATION_PAD + HARTHMERE_FOREST_MAX_CANOPY_RADIUS;

/** Vegetation the seeder and the surface repair can write. Nothing else here. */
export const HARTHMERE_VEGETATION_MATERIALS = [
  "oakLog",
  "oakLeaf",
  "birchLog",
  "birchLeaf",
  "rubberLog",
  "rubberLeaf",
  "moss",
  "switchGrass",
  "rose",
  "dandelion",
  "sunflower",
  "hay",
  "wheat",
  "carrot",
  "grass",
] as const;

export type HarthmereVegetationMaterial =
  (typeof HARTHMERE_VEGETATION_MATERIALS)[number];

const VEGETATION_SET: ReadonlySet<string> = new Set(
  HARTHMERE_VEGETATION_MATERIALS
);

export function isHarthmereVegetationMaterial(
  material: string | undefined
): material is HarthmereVegetationMaterial {
  return material !== undefined && VEGETATION_SET.has(material);
}

// ---------------------------------------------------------------------------
// Footprints
// ---------------------------------------------------------------------------

function withinFootprint(
  authoredX: number,
  authoredZ: number,
  building: HarthmereBuilding,
  pad: number
): boolean {
  return (
    authoredX >= building.x0 - pad &&
    authoredX <= building.x1 + pad &&
    authoredZ >= building.z0 - pad &&
    authoredZ <= building.z1 + pad
  );
}

/**
 * A coarse bucket grid over the 57 footprints.
 *
 * The seeder asks this for every column of every shard, so a linear scan of 57
 * rectangles per voxel is not acceptable — that is the mistake that got voxel
 * trees deleted for performance once before. Buckets are 32 wide (one shard),
 * built once, and a lookup touches only the handful of buildings that could
 * possibly overlap the query.
 */
const BUCKET = 32;

function bucketKey(bx: number, bz: number): string {
  return `${bx}:${bz}`;
}

let bucketIndex: Map<string, HarthmereBuilding[]> | undefined;

function buildings(): Map<string, HarthmereBuilding[]> {
  if (bucketIndex) {
    return bucketIndex;
  }
  const index = new Map<string, HarthmereBuilding[]>();
  // Index with the widest pad any caller can ask for, so a lookup never misses
  // a building whose pad reaches into a neighbouring bucket.
  const pad = HARTHMERE_BUILDING_CANOPY_PAD;
  for (const building of HARTHMERE_BUILDINGS) {
    const bx0 = Math.floor((building.x0 - pad) / BUCKET);
    const bx1 = Math.floor((building.x1 + pad) / BUCKET);
    const bz0 = Math.floor((building.z0 - pad) / BUCKET);
    const bz1 = Math.floor((building.z1 + pad) / BUCKET);
    for (let bx = bx0; bx <= bx1; bx += 1) {
      for (let bz = bz0; bz <= bz1; bz += 1) {
        const key = bucketKey(bx, bz);
        const list = index.get(key);
        if (list) {
          list.push(building);
        } else {
          index.set(key, [building]);
        }
      }
    }
  }
  bucketIndex = index;
  return index;
}

/** Test seam: drop the memoised index. */
export function harthmereResetBuildingExclusionCache(): void {
  bucketIndex = undefined;
}

function candidates(
  authoredX: number,
  authoredZ: number
): readonly HarthmereBuilding[] {
  return (
    buildings().get(
      bucketKey(Math.floor(authoredX / BUCKET), Math.floor(authoredZ / BUCKET))
    ) ?? []
  );
}

/**
 * The building whose footprint (plus `pad`) covers this authored column.
 *
 * Harthmere has seven pairs of authored buildings whose footprints overlap, so
 * this deliberately returns the FIRST match rather than asserting uniqueness.
 * Callers only ever ask "is there one".
 */
export function harthmereBuildingAtAuthoredColumn(
  authoredX: number,
  authoredZ: number,
  pad = 0
): HarthmereBuilding | undefined {
  for (const building of candidates(authoredX, authoredZ)) {
    if (withinFootprint(authoredX, authoredZ, building, pad)) {
      return building;
    }
  }
  return undefined;
}

/**
 * THE predicate. True where no vegetation writer may place anything.
 *
 * Authored coordinates — every Harthmere generator converts before calling.
 */
export function isHarthmereBuildingVegetationExclusion(
  authoredX: number,
  authoredZ: number,
  pad = HARTHMERE_BUILDING_VEGETATION_PAD
): boolean {
  return (
    harthmereBuildingAtAuthoredColumn(authoredX, authoredZ, pad) !== undefined
  );
}

/** Strictly inside the walls — the room volume, excluding the wall ring. */
export function isHarthmereBuildingInteriorColumn(
  authoredX: number,
  authoredZ: number
): boolean {
  for (const building of candidates(authoredX, authoredZ)) {
    if (
      authoredX > building.x0 &&
      authoredX < building.x1 &&
      authoredZ > building.z0 &&
      authoredZ < building.z1
    ) {
      return true;
    }
  }
  return false;
}

/** Cheap per-shard early-out, matching the river and still-water modules. */
export function harthmereBuildingExclusionTouchesAuthoredSpan(
  authoredX0: number,
  authoredX1: number,
  authoredZ0: number,
  authoredZ1: number,
  pad = HARTHMERE_BUILDING_VEGETATION_PAD
): boolean {
  return HARTHMERE_BUILDINGS.some(
    (building) =>
      !(
        authoredX1 < building.x0 - pad ||
        authoredX0 > building.x1 + pad ||
        authoredZ1 < building.z0 - pad ||
        authoredZ0 > building.z1 + pad
      )
  );
}

// ---------------------------------------------------------------------------
// Clearing an already-seeded world
// ---------------------------------------------------------------------------
//
// The predicate above stops the generator planting anything new, which fixes a
// fresh reseed. Production Redis already holds shards seeded by the old rule,
// so the deploy reconciliation needs a pass that removes what is already there.
// It must be surgical: only vegetation, only inside a room, never a wall, a
// floor, a stair, a piece of furniture or a player build.

/** Vertical span of a room, relative to the building's own floor. */
export interface HarthmereBuildingInteriorSpan {
  building: HarthmereBuilding;
  /** Inclusive authored column bounds of the room volume. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Inclusive relY range above the ground plane to sweep. */
  relY0: number;
  relY1: number;
}

/**
 * Storey height used to size the sweep. Matches
 * `harthmereStoryHeightOf`'s default in the interiors module; a building with
 * more floors gets a taller sweep so a tree in an upper room is still found.
 */
export const HARTHMERE_INTERIOR_STOREY_HEIGHT = 5;

export function harthmereBuildingInteriorSpans(): HarthmereBuildingInteriorSpan[] {
  const spans: HarthmereBuildingInteriorSpan[] = [];
  for (const building of HARTHMERE_BUILDINGS) {
    if (building.x1 - building.x0 < 2 || building.z1 - building.z0 < 2) {
      // Degenerate footprint: all wall, no room.
      continue;
    }
    const floors = Math.max(1, building.floors ?? 1);
    spans.push({
      building,
      x0: building.x0 + 1,
      x1: building.x1 - 1,
      z0: building.z0 + 1,
      z1: building.z1 - 1,
      // relY 1 is the voxel standing on the floor slab.
      relY0: 1,
      relY1: floors * HARTHMERE_INTERIOR_STOREY_HEIGHT,
    });
  }
  return spans;
}

export interface HarthmereInteriorClearProbe {
  /** Authored column. */
  authoredX: number;
  authoredZ: number;
  /** Height above the ground plane. */
  relY: number;
  /** Material NAME currently in the voxel, or undefined for air. */
  material: string | undefined;
}

export type HarthmereInteriorClearDecision =
  | { clear: false; reason: string }
  | { clear: true; material: HarthmereVegetationMaterial };

/**
 * Whether one voxel should be cleared to air.
 *
 * Add-only in reverse: it can only ever REMOVE a known vegetation material, and
 * only from strictly inside a room, and never from the floor plane itself
 * (relY 0), which is the building's own floor slab.
 */
export function harthmereInteriorClearDecision(
  probe: HarthmereInteriorClearProbe
): HarthmereInteriorClearDecision {
  if (probe.relY < 1) {
    return { clear: false, reason: "floorPlaneOrBelow" };
  }
  if (!isHarthmereVegetationMaterial(probe.material)) {
    return { clear: false, reason: "notVegetation" };
  }
  if (!isHarthmereBuildingInteriorColumn(probe.authoredX, probe.authoredZ)) {
    return { clear: false, reason: "notInsideARoom" };
  }
  return { clear: true, material: probe.material };
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export function validateHarthmereBuildingExclusion(): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  if (HARTHMERE_BUILDINGS.length === 0) {
    failures.push("no buildings to exclude — the table failed to load");
  }
  for (const building of HARTHMERE_BUILDINGS) {
    const cx = Math.floor((building.x0 + building.x1) / 2);
    const cz = Math.floor((building.z0 + building.z1) / 2);
    if (!isHarthmereBuildingVegetationExclusion(cx, cz)) {
      failures.push(`${building.name}: centre column is not excluded`);
    }
    for (const [x, z] of [
      [building.x0, building.z0],
      [building.x1, building.z0],
      [building.x0, building.z1],
      [building.x1, building.z1],
    ]) {
      if (!isHarthmereBuildingVegetationExclusion(x, z)) {
        failures.push(`${building.name}: corner ${x},${z} is not excluded`);
      }
    }
  }
  if (HARTHMERE_BUILDING_CANOPY_PAD <= HARTHMERE_BUILDING_VEGETATION_PAD) {
    failures.push("canopy pad must be wider than the column pad");
  }
  return { ok: failures.length === 0, failures };
}
