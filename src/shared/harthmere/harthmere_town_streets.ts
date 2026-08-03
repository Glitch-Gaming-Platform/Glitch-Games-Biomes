// HARTHMERE_TOWN_STREETS
//
// Harthmere had buildings and it had ground. It did not have streets.
//
// WHAT WAS THERE BEFORE
// Three separate things in the codebase were named as if they were roads, and
// none of them was one:
//
//   * `HARTHMERE_CLEAR_STREET_RECTS` (shim + renderer) is an air-clearing mask.
//     It deletes loose blocks floating over the town, and it explicitly skips
//     anything inside a building footprint. Some of its rectangles are 141x61 —
//     a whole district, not a lane.
//   * `HARTHMERE_STREET_SEGMENTS` (renderer) is five line segments used to
//     decide whether a decorative prop counts as street clutter.
//   * `HARTHMERE_NO_BUILD_BOXES` (renderer) keeps props out of five areas.
//
// All three answer "where may a block NOT be". None of them paves anything, and
// none of them is derived from where the doors actually are. A player walking
// out of the Dawn Loaf stepped onto the same undifferentiated grass as a player
// standing in the middle of a field.
//
// WHAT THIS IS
// A real street network, DERIVED from `HARTHMERE_BUILDINGS` rather than
// authored beside it. That direction matters: the one existing hand-maintained
// copy of the building rectangles (`HARTHMERE_ROOF_CLEAR_BOXES`) had already
// drifted 24 voxels away from the table it was copied from. A derived network
// cannot drift, and a building that moves takes its street frontage with it.
//
// HOW IT IS BUILT
//  1. Mark every town-core building footprint as blocked. Balconies are NOT
//     blocked: a balcony deck sits at relY 5, and the ground under it is
//     walkable — that overhang is a porch, and Mara Thistle's front door is
//     directly beneath hers.
//  2. For every front door, walk straight out until a 3x3 block of open ground
//     fits. That cell is the building's LANDING — the point where its doorstep
//     meets something wide enough to be a street.
//  3. Grow one connected network: repeatedly breadth-first search from the
//     network already paved, through cells wide enough to carry a street, to
//     the nearest landing that is not yet connected, and pave the route. This
//     is a cheap Steiner tree, and it produces what a town actually produces —
//     a few arterials with short spurs off them, not a uniform grid stamped
//     over the buildings.
//  4. Widen the result by one voxel wherever the extra voxel still has room,
//     so trunks read as roads rather than footpaths.
//  5. Cobble the interior, gravel the edge. Doc 5.2 of the town design bible:
//     "clean center routes in main market arteries, side gutters, muddier
//     shoulders".
//
// The whole thing is computed once and memoised. It is a few hundred thousand
// grid operations on a 311x295 lattice, which is cheap enough to do at first
// touch and never again.
//
// THE GUARANTEE
// `harthmereValidateTownStreets()` proves the two properties that matter: no
// paved voxel is inside a building, and every town-core front door reaches the
// network by walking straight out of its own doorway. The second is the one
// with gameplay meaning — it is the difference between a town you can navigate
// and 46 doors opening onto the same field.

import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
  type HarthmereMat,
} from "@/shared/harthmere/harthmere_town_buildings";

export const HARTHMERE_TOWN_STREETS_VERSION =
  "harthmere-town-streets-v1" as const;

/** Wilds structures stand in open country and are reached by the wilds roads. */
export function harthmereIsTownCoreBuilding(
  building: HarthmereBuilding
): boolean {
  return !building.district.startsWith("Harthmere Wilds");
}

export interface HarthmereStreetRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Paving materials, cheapest-to-read first. */
export const HARTHMERE_STREET_SURFACE: HarthmereMat = "cobblestone";
export const HARTHMERE_STREET_SHOULDER: HarthmereMat = "gravel";

/** How far out from a door we will look for ground wide enough to be a street. */
const LANDING_SEARCH = 20;
/** Half-width of the block that has to fit before a cell can carry a street. */
const STREET_HALF_WIDTH = 1;
/** Margin around the town-core bounding box that the network may use. */
const MARGIN = 8;

interface Grid {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  w: number;
  d: number;
  blocked: Uint8Array;
  /**
   * Precomputed "a street of the full width fits centred here".
   *
   * This is the whole performance story. The route search asks the question
   * once per neighbour per visited cell; done live it is nine bounds-checked
   * array reads each time, and flooding an 84,000-cell lattice forty-six times
   * turned a one-second computation into a twenty-five second one. Answering it
   * up front, once per column, makes the search a plain array read.
   */
  wide: Uint8Array;
}

function buildGrid(): Grid {
  const core = HARTHMERE_BUILDINGS.filter(harthmereIsTownCoreBuilding);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const b of core) {
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
  }
  x0 -= MARGIN;
  x1 += MARGIN;
  z0 -= MARGIN;
  z1 += MARGIN;
  const w = x1 - x0 + 1;
  const d = z1 - z0 + 1;
  const blocked = new Uint8Array(w * d);
  // EVERY building blocks, not just the core ones: a wilds bunkhouse that
  // happens to stand inside the core bounding box still has walls.
  for (const b of HARTHMERE_BUILDINGS) {
    for (let x = Math.max(x0, b.x0); x <= Math.min(x1, b.x1); x += 1) {
      for (let z = Math.max(z0, b.z0); z <= Math.min(z1, b.z1); z += 1) {
        blocked[(z - z0) * w + (x - x0)] = 1;
      }
    }
  }
  const grid: Grid = {
    x0,
    x1,
    z0,
    z1,
    w,
    d,
    blocked,
    wide: new Uint8Array(w * d),
  };
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) {
      if (computeFitsStreet(grid, x, z)) {
        grid.wide[(z - z0) * w + (x - x0)] = 1;
      }
    }
  }
  return grid;
}

function inGrid(g: Grid, x: number, z: number): boolean {
  return x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1;
}

function isOpen(g: Grid, x: number, z: number): boolean {
  return inGrid(g, x, z) && g.blocked[(z - g.z0) * g.w + (x - g.x0)] === 0;
}

function computeFitsStreet(g: Grid, x: number, z: number): boolean {
  for (let dx = -STREET_HALF_WIDTH; dx <= STREET_HALF_WIDTH; dx += 1) {
    for (let dz = -STREET_HALF_WIDTH; dz <= STREET_HALF_WIDTH; dz += 1) {
      if (!isOpen(g, x + dx, z + dz)) {
        return false;
      }
    }
  }
  return true;
}

/** True if a street of the full width fits centred here. */
function fitsStreet(g: Grid, x: number, z: number): boolean {
  return inGrid(g, x, z) && g.wide[(z - g.z0) * g.w + (x - g.x0)] === 1;
}

/** The voxel directly outside a building's door, and the way out from it. */
export function harthmereDoorStep(
  building: HarthmereBuilding
): { at: readonly [number, number]; out: readonly [number, number] } {
  switch (building.doorSide) {
    case "north":
      return { at: [building.doorCenter, building.z0 - 1], out: [0, -1] };
    case "south":
      return { at: [building.doorCenter, building.z1 + 1], out: [0, 1] };
    case "west":
      return { at: [building.x0 - 1, building.doorCenter], out: [-1, 0] };
    default:
      return { at: [building.x1 + 1, building.doorCenter], out: [1, 0] };
  }
}

interface Landing {
  name: string;
  /** Doorstep run, from the door outward up to and including the landing. */
  walk: Array<readonly [number, number]>;
  landing?: readonly [number, number];
}

function landingsFor(g: Grid): Landing[] {
  const out: Landing[] = [];
  for (const b of HARTHMERE_BUILDINGS) {
    if (!harthmereIsTownCoreBuilding(b)) {
      continue;
    }
    const { at, out: dir } = harthmereDoorStep(b);
    const walk: Array<readonly [number, number]> = [];
    let landing: readonly [number, number] | undefined;
    for (let k = 0; k < LANDING_SEARCH; k += 1) {
      const x = at[0] + dir[0] * k;
      const z = at[1] + dir[1] * k;
      if (!isOpen(g, x, z)) {
        break;
      }
      walk.push([x, z]);
      if (fitsStreet(g, x, z)) {
        landing = [x, z];
        break;
      }
    }
    out.push({ name: b.name, walk, landing });
  }
  return out;
}

const keyOf = (x: number, z: number) => `${x},${z}`;

function growNetwork(g: Grid, landings: Landing[]): Set<string> {
  const paved = new Set<number>();
  const spine = new Set<number>();

  const pave = (x: number, z: number, radius: number) => {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (isOpen(g, x + dx, z + dz)) {
          paved.add((z + dz - g.z0) * g.w + (x + dx - g.x0));
        }
      }
    }
  };
  const layRoute = (
    route: ReadonlyArray<readonly [number, number]>,
    radius: number
  ) => {
    for (const [x, z] of route) {
      pave(x, z, radius);
      spine.add((z - g.z0) * g.w + (x - g.x0));
    }
  };

  const reachable = landings.filter((l) => l.landing !== undefined);
  if (reachable.length === 0) {
    return new Set<string>();
  }

  const connected = new Set<string>();
  layRoute(reachable[0].walk, STREET_HALF_WIDTH);
  connected.add(reachable[0].name);

  // Breadth-first from everything already paved to the nearest landing that is
  // still on its own. Insertion order is fixed by HARTHMERE_BUILDINGS, so the
  // same town always produces the same streets.
  // Indices, not "x,z" strings. The search is the hot loop; a Map of string
  // keys over an 84,000-cell lattice run once per building costs seconds, and
  // a flat Int32Array costs milliseconds.
  const cellCount = g.w * g.d;
  const indexOf = (x: number, z: number) => (z - g.z0) * g.w + (x - g.x0);
  const prev = new Int32Array(cellCount);
  const seen = new Int32Array(cellCount);
  const queue = new Int32Array(cellCount);
  const wantedBy = new Int32Array(cellCount).fill(-1);
  let stamp = 0;

  const nextRoute = (
    targets: Landing[]
  ): { target: Landing; route: Array<readonly [number, number]> } | undefined => {
    stamp += 1;
    let tail = 0;
    for (const i of spine) {
      if (g.wide[i] !== 1 || seen[i] === stamp) {
        continue;
      }
      seen[i] = stamp;
      prev[i] = -1;
      queue[tail++] = i;
    }
    if (tail === 0) {
      return undefined;
    }
    for (let t = 0; t < targets.length; t += 1) {
      const [x, z] = targets[t].landing!;
      wantedBy[indexOf(x, z)] = t;
    }
    const steps = [1, -1, g.w, -g.w];
    try {
      for (let head = 0; head < tail; head += 1) {
        const cur = queue[head];
        const cx = g.x0 + (cur % g.w);
        for (let s = 0; s < 4; s += 1) {
          // Guard the row wrap: +/-1 must not slide off the end of a row.
          if (s === 0 && cx === g.x1) {
            continue;
          }
          if (s === 1 && cx === g.x0) {
            continue;
          }
          const next = cur + steps[s];
          if (next < 0 || next >= cellCount || seen[next] === stamp) {
            continue;
          }
          if (g.wide[next] !== 1) {
            continue;
          }
          seen[next] = stamp;
          prev[next] = cur;
          queue[tail++] = next;
          const t = wantedBy[next];
          if (t >= 0) {
            const route: Array<readonly [number, number]> = [];
            for (let cursor = next; cursor >= 0; cursor = prev[cursor]) {
              route.push([
                g.x0 + (cursor % g.w),
                g.z0 + Math.floor(cursor / g.w),
              ]);
            }
            return { target: targets[t], route };
          }
        }
      }
    } finally {
      for (const t of targets) {
        wantedBy[indexOf(t.landing![0], t.landing![1])] = -1;
      }
    }
    return undefined;
  };

  for (let guard = 0; guard < reachable.length + 4; guard += 1) {
    const remaining = reachable.filter((l) => !connected.has(l.name));
    if (remaining.length === 0) {
      break;
    }
    const found = nextRoute(remaining);
    if (!found) {
      break;
    }
    layRoute(found.route, STREET_HALF_WIDTH);
    // The doorstep run itself is paved at radius 0: it is a threshold, not a
    // road, and widening it would push paving under the neighbour's wall.
    layRoute(found.target.walk, 0);
    connected.add(found.target.name);
  }

  // One voxel of widening wherever there is still room, so the trunks read as
  // streets. Computed from the finished set so it never eats into a doorway.
  const widened = new Set(paved);
  for (const i of paved) {
    const x = g.x0 + (i % g.w);
    if (x < g.x1 && g.wide[i + 1] === 1) {
      widened.add(i + 1);
    }
    if (x > g.x0 && g.wide[i - 1] === 1) {
      widened.add(i - 1);
    }
    if (i + g.w < g.wide.length && g.wide[i + g.w] === 1) {
      widened.add(i + g.w);
    }
    if (i - g.w >= 0 && g.wide[i - g.w] === 1) {
      widened.add(i - g.w);
    }
  }
  const out = new Set<string>();
  for (const i of widened) {
    out.add(keyOf(g.x0 + (i % g.w), g.z0 + Math.floor(i / g.w)));
  }
  return out;
}

function coverWithRects(cells: Set<string>): HarthmereStreetRect[] {
  const remaining = new Set(cells);
  const has = (x: number, z: number) => remaining.has(keyOf(x, z));
  const ordered = [...cells]
    .map((k) => k.split(",").map(Number) as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const rects: HarthmereStreetRect[] = [];
  for (const [sx, sz] of ordered) {
    if (!has(sx, sz)) {
      continue;
    }
    let x1 = sx;
    while (has(x1 + 1, sz)) {
      x1 += 1;
    }
    let z1 = sz;
    for (;;) {
      let full = true;
      for (let x = sx; x <= x1; x += 1) {
        if (!has(x, z1 + 1)) {
          full = false;
          break;
        }
      }
      if (!full) {
        break;
      }
      z1 += 1;
    }
    for (let x = sx; x <= x1; x += 1) {
      for (let z = sz; z <= z1; z += 1) {
        remaining.delete(keyOf(x, z));
      }
    }
    rects.push({ x0: sx, x1, z0: sz, z1 });
  }
  return rects;
}

interface StreetNetwork {
  cells: Set<string>;
  rects: HarthmereStreetRect[];
  bounds: { x0: number; x1: number; z0: number; z1: number };
  unreachable: string[];
}

let cached: StreetNetwork | undefined;

function network(): StreetNetwork {
  if (cached) {
    return cached;
  }
  const g = buildGrid();
  const landings = landingsFor(g);
  const cells = growNetwork(g, landings);
  const unreachable = landings
    .filter((l) => l.landing === undefined)
    .map((l) => l.name);
  cached = {
    cells,
    rects: coverWithRects(cells),
    bounds: { x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 },
    unreachable,
  };
  return cached;
}

export function harthmereResetTownStreetCache(): void {
  cached = undefined;
}

/** The paved network as axis-aligned rectangles, for seeding or debugging. */
export function harthmereTownStreetRects(): readonly HarthmereStreetRect[] {
  return network().rects;
}

export function harthmereTownStreetCellCount(): number {
  return network().cells.size;
}

export function harthmereIsTownStreet(x: number, z: number): boolean {
  return network().cells.has(keyOf(x, z));
}

/**
 * The paving at a column, or undefined off the network.
 *
 * Cobbles in the middle, gravel at the edge. Bible 5.2: clean centre routes,
 * muddier shoulders. Reading the edge from the network itself means a spur is
 * mostly shoulder and an arterial is mostly cobble, without tagging either.
 */
export function harthmereTownStreetSurfaceAt(
  x: number,
  z: number
): HarthmereMat | undefined {
  const net = network();
  if (!net.cells.has(keyOf(x, z))) {
    return undefined;
  }
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (!net.cells.has(keyOf(x + dx, z + dz))) {
      return HARTHMERE_STREET_SHOULDER;
    }
  }
  return HARTHMERE_STREET_SURFACE;
}

/**
 * Every town-core building, and how many voxels it walks before its doorstep
 * meets the street network. `undefined` means it never does.
 */
export function harthmereDoorToStreetDistance(
  building: HarthmereBuilding
): number | undefined {
  const net = network();
  const { at, out } = harthmereDoorStep(building);
  for (let k = 0; k < LANDING_SEARCH; k += 1) {
    const x = at[0] + out[0] * k;
    const z = at[1] + out[1] * k;
    if (net.cells.has(keyOf(x, z))) {
      return k;
    }
    const insideSomething = HARTHMERE_BUILDINGS.some(
      (b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1
    );
    if (insideSomething) {
      return undefined;
    }
  }
  return undefined;
}

export function harthmereValidateTownStreets(): string[] {
  const problems: string[] = [];
  const net = network();
  if (net.cells.size === 0) {
    problems.push("street network is empty");
  }
  for (const name of net.unreachable) {
    problems.push(`${name}: no open ground wide enough for a street outside its door`);
  }
  for (const b of HARTHMERE_BUILDINGS) {
    for (let x = b.x0; x <= b.x1; x += 1) {
      for (let z = b.z0; z <= b.z1; z += 1) {
        if (net.cells.has(keyOf(x, z))) {
          problems.push(`street paving at (${x},${z}) is inside ${b.name}`);
          x = b.x1;
          break;
        }
      }
    }
  }
  for (const b of HARTHMERE_BUILDINGS) {
    if (!harthmereIsTownCoreBuilding(b)) {
      continue;
    }
    if (harthmereDoorToStreetDistance(b) === undefined) {
      problems.push(`${b.name}: front door does not reach the street network`);
    }
  }
  return problems;
}
