/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE BUILDING SHELLS — the structure, not the furniture.
//
// `harthmere_building_interiors.test.ts` next door proves that furniture only
// ever adds. This file proves the thing underneath it: that the 57 authored
// shells are buildings a player can actually walk into.
//
// Every assertion here failed against the table as authored. In order:
//
//   * seven pairs of buildings interpenetrated — one shell's wall ran through
//     another's floor;
//   * thirteen front doors opened into a neighbour's wall, four of them with
//     all three approach voxels blocked, which is a shop you cannot enter;
//   * two balconies hung through the building next door;
//   * four buildings whose lore requires an upper floor (Osric's apartment over
//     the forge, Dawn's room over the bakery, the chapel archive and bell
//     stage, Jory's stable loft) declared one floor, so the room had nowhere to
//     be;
//   * nine buildings put their staircase in their own doorway.
//
// The rules encoded below are the shim's own geometry, restated. The shim
// carves a door lane of +/-2 laterally and +/-3 deep; furniture keeps clear of
// it, and so must stairs and chimneys. Getting those wrong does not throw — it
// silently produces a building with a stair in the entrance or a chimney stack
// coming up through the doormat.

import assert from "assert";
import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
} from "../harthmere_town_buildings";
import {
  HARTHMERE_TOWN_ROAD_HEADS,
  harthmereDoorStep,
  harthmereDoorToStreetDistance,
  harthmereIsTownCoreBuilding,
  harthmereRoadHeadToStreetDistance,
  harthmereTownStreetCellCount,
  harthmereTownStreetRects,
  harthmereTownStreetSurfaceAt,
  harthmereValidateTownStreets,
} from "../harthmere_town_streets";
import {
  HARTHMERE_WEST_SEAM_RIDGE_BOUNDS,
  harthmereValidateWestSeamRidge,
  harthmereWestSeamRidgeSurfaceY,
} from "../harthmere_west_seam_ridge";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "../world_extension";

type Rect = readonly [number, number, number, number];

const footprint = (b: HarthmereBuilding): Rect => [b.x0, b.x1, b.z0, b.z1];

/** The balcony deck, in world columns. Elevated, but it is still volume. */
function balcony(b: HarthmereBuilding): Rect | undefined {
  const x = b.balcony;
  if (!x) {
    return undefined;
  }
  switch (x.side) {
    case "east":
      return [b.x1 + 1, b.x1 + x.depth, x.start, x.end];
    case "west":
      return [b.x0 - x.depth, b.x0 - 1, x.start, x.end];
    case "south":
      return [x.start, x.end, b.z1 + 1, b.z1 + x.depth];
    default:
      return [x.start, x.end, b.z0 - x.depth, b.z0 - 1];
  }
}

function volumes(b: HarthmereBuilding): Rect[] {
  const out: Rect[] = [footprint(b)];
  const deck = balcony(b);
  if (deck) {
    out.push(deck);
  }
  return out;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + 1;
  const d = Math.min(a[3], b[3]) - Math.max(a[2], b[2]) + 1;
  return Math.max(0, w) * Math.max(0, d);
}

const floorsOf = (b: HarthmereBuilding) =>
  Math.max(1, b.floors ?? (b.upper ? 2 : 1));
/**
 * The SHELL generator's storey height, from `harthmereStoryHeight()` in the
 * shim. That function is the one that actually stacks the floor slabs, so it is
 * the authority here.
 *
 * Note that it disagrees with `harthmereStoryHeightOf()` in
 * `harthmere_building_interiors.ts` and `harthmere_additive_town_interiors.ts`,
 * which both return 6 for gatehouses and towers and 5 for everything else —
 * including slums. Three modules, two answers. See the shell audit's open items:
 * the interiors modules place upper-floor content one voxel per storey away
 * from the floor the shell actually built, which on a five-storey Mudden stack
 * is four voxels of drift by the top landing.
 */
const storyHeightOf = (b: HarthmereBuilding) => (b.profile === "slum" ? 4 : 5);

/** The shim's door lane: +/-2 laterally, +/-3 through the wall. */
function doorLane(b: HarthmereBuilding): Rect {
  switch (b.doorSide) {
    case "north":
      return [b.doorCenter - 2, b.doorCenter + 2, b.z0 - 3, b.z0 + 3];
    case "south":
      return [b.doorCenter - 2, b.doorCenter + 2, b.z1 - 3, b.z1 + 3];
    case "west":
      return [b.x0 - 3, b.x0 + 3, b.doorCenter - 2, b.doorCenter + 2];
    default:
      return [b.x1 - 3, b.x1 + 3, b.doorCenter - 2, b.doorCenter + 2];
  }
}

function stairFootprint(b: HarthmereBuilding): Rect | undefined {
  const s = b.stairs;
  if (!s) {
    return undefined;
  }
  const alongX = s.direction === "east" || s.direction === "west";
  const spanX = alongX ? s.length : s.width;
  const spanZ = alongX ? s.width : s.length;
  return [s.x0, s.x0 + spanX, s.z0, s.z0 + spanZ];
}

/** Three voxels of open ground in front of the door. Two is a squeeze. */
const APPROACH_DEPTH = 3;

function approach(b: HarthmereBuilding): Array<readonly [number, number]> {
  const { at, out } = harthmereDoorStep(b);
  const cells: Array<readonly [number, number]> = [];
  for (let d = 0; d < APPROACH_DEPTH; d += 1) {
    cells.push([at[0] + out[0] * d, at[1] + out[1] * d]);
  }
  return cells;
}

describe("harthmere shells - no building stands inside another", () => {
  it("has no overlapping footprints", () => {
    const clashes: string[] = [];
    for (let i = 0; i < HARTHMERE_BUILDINGS.length; i += 1) {
      for (let j = i + 1; j < HARTHMERE_BUILDINGS.length; j += 1) {
        const a = HARTHMERE_BUILDINGS[i];
        const b = HARTHMERE_BUILDINGS[j];
        const shared = overlapArea(footprint(a), footprint(b));
        if (shared > 0) {
          clashes.push(`${a.name}/${b.name} share ${shared} voxels`);
        }
      }
    }
    assert.deepEqual(clashes, []);
  });

  it("never hangs a balcony through a neighbour", () => {
    const clashes: string[] = [];
    for (const b of HARTHMERE_BUILDINGS) {
      const deck = balcony(b);
      if (!deck) {
        continue;
      }
      for (const other of HARTHMERE_BUILDINGS) {
        if (other === b) {
          continue;
        }
        for (const volume of volumes(other)) {
          if (overlapArea(deck, volume) > 0) {
            clashes.push(`${b.name} balcony intersects ${other.name}`);
          }
        }
      }
    }
    assert.deepEqual(clashes, []);
  });

  it("keeps every balcony on a wall it actually has, at a floor it has", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      const deck = b.balcony;
      if (!deck) {
        continue;
      }
      // `harthmereBalconyDoor` reads `floor` as 1-based: baseY is
      // (floor - 1) * storyHeight.
      assert.ok(
        deck.floor >= 1 && deck.floor <= floorsOf(b),
        `${b.name}: balcony on floor ${deck.floor} of ${floorsOf(b)}`
      );
      const [lo, hi] =
        deck.side === "east" || deck.side === "west"
          ? [b.z0, b.z1]
          : [b.x0, b.x1];
      assert.ok(
        deck.start >= lo && deck.end <= hi,
        `${b.name}: balcony spans ${deck.start}..${deck.end}, wall is ${lo}..${hi}`
      );
    }
  });
});

describe("harthmere shells - every front door can be walked through", () => {
  it("puts no neighbour in front of any door", () => {
    const blocked: string[] = [];
    for (const b of HARTHMERE_BUILDINGS) {
      for (const [x, z] of approach(b)) {
        for (const other of HARTHMERE_BUILDINGS) {
          if (other === b) {
            continue;
          }
          for (const volume of volumes(other)) {
            if (
              x >= volume[0] &&
              x <= volume[1] &&
              z >= volume[2] &&
              z <= volume[3]
            ) {
              blocked.push(
                `${b.name} door ${b.doorSide}@${b.doorCenter} blocked at (${x},${z}) by ${other.name}`
              );
            }
          }
        }
      }
    }
    assert.deepEqual(blocked, []);
  });

  it("keeps every door off the corner posts", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      const [lo, hi] =
        b.doorSide === "north" || b.doorSide === "south"
          ? [b.x0, b.x1]
          : [b.z0, b.z1];
      const margin = Math.min(b.doorCenter - lo, hi - b.doorCenter);
      assert.ok(
        margin >= 3,
        `${b.name}: door ${b.doorCenter} sits ${margin} from the corner of ${lo}..${hi}`
      );
    }
  });
});

describe("harthmere shells - every floor is reachable and every stair is usable", () => {
  it("gives every multi-storey building an authored stair run", () => {
    // The shim will synthesise an EXTERNAL stair for a building that forgets
    // one, which is a safety net, not a design: it hangs a staircase off the
    // street. Anything with an upper floor should say where its stairs are.
    const missing = HARTHMERE_BUILDINGS.filter(
      (b) => floorsOf(b) > 1 && !b.stairs
    ).map((b) => b.name);
    assert.deepEqual(missing, []);
  });

  it("keeps every stair run inside its own building", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      const stairs = stairFootprint(b);
      if (!stairs) {
        continue;
      }
      assert.ok(
        stairs[0] > b.x0 &&
          stairs[2] > b.z0 &&
          stairs[1] < b.x1 &&
          stairs[3] < b.z1,
        `${b.name}: stairs ${JSON.stringify(stairs)} leave x[${b.x0},${b.x1}] z[${b.z0},${b.z1}]`
      );
    }
  });

  it("never puts a staircase in the doorway", () => {
    const inTheWay: string[] = [];
    for (const b of HARTHMERE_BUILDINGS) {
      const stairs = stairFootprint(b);
      if (stairs && overlapArea(stairs, doorLane(b)) > 0) {
        inTheWay.push(b.name);
      }
    }
    assert.deepEqual(inTheWay, []);
  });

  it("makes every stair run long enough to climb its own storey", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      if (!b.stairs) {
        continue;
      }
      assert.ok(
        b.stairs.length >= storyHeightOf(b) - 1,
        `${b.name}: ${b.stairs.length} steps cannot reach a ${storyHeightOf(b)}-high storey`
      );
    }
  });

  it("does not give a single-storey building stairs to nowhere", () => {
    const pointless = HARTHMERE_BUILDINGS.filter(
      (b) => floorsOf(b) === 1 && b.stairs
    ).map((b) => b.name);
    assert.deepEqual(pointless, []);
  });
});

describe("harthmere shells - chimneys stand somewhere a chimney can stand", () => {
  it("keeps every chimney strictly inside its building", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      if (!b.chimney) {
        continue;
      }
      const [cx, cz] = b.chimney;
      assert.ok(
        cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1,
        `${b.name}: chimney (${cx},${cz}) is in or outside a wall`
      );
    }
  });

  it("never runs a chimney up through the stairs or the doorway", () => {
    for (const b of HARTHMERE_BUILDINGS) {
      if (!b.chimney) {
        continue;
      }
      const [cx, cz] = b.chimney;
      const cell: Rect = [cx, cx, cz, cz];
      const stairs = stairFootprint(b);
      assert.ok(
        !stairs || overlapArea(cell, stairs) === 0,
        `${b.name}: chimney sits on the staircase`
      );
      assert.ok(
        overlapArea(cell, doorLane(b)) === 0,
        `${b.name}: chimney sits in the door lane`
      );
    }
  });
});

describe("harthmere shells - the four lore buildings have the floor their story needs", () => {
  // These four are called out by name in the all-buildings interior lore audit
  // as "structural and lore conflicts to resolve before placement work". Each
  // has a resident or a function that the shell had no room for.
  const needsUpper: Array<[string, string]> = [
    ["black_anvil_smithy", "Osric and Luth live above the forge"],
    ["dawn_loaf_bakery", "Dawn's room is above the bakery"],
    ["saint_verena_chapel", "archive, infirmary, clergy rooms and bell access"],
    ["harthmere_stables", "Old Jory's stable-yard loft"],
  ];
  for (const [name, why] of needsUpper) {
    it(`${name} has an upper floor and a way up (${why})`, () => {
      const b = HARTHMERE_BUILDINGS.find((x) => x.name === name);
      assert.ok(b, `${name} is missing from the table`);
      assert.ok(floorsOf(b!) >= 2, `${name} still declares one floor`);
      assert.ok(b!.stairs, `${name} has an upper floor with no stairs`);
    });
  }
});

describe("harthmere streets - the town has roads, and they reach the doors", () => {
  it("paves a connected network without standing on a single building", () => {
    assert.deepEqual(harthmereValidateTownStreets(), []);
  });

  it("is big enough to be a street network rather than a few patches", () => {
    assert.ok(
      harthmereTownStreetCellCount() > 2000,
      `only ${harthmereTownStreetCellCount()} paved voxels`
    );
    assert.ok(harthmereTownStreetRects().length > 0);
  });

  it("lets every town-core building step out onto a street", () => {
    const stranded: string[] = [];
    for (const b of HARTHMERE_BUILDINGS) {
      if (!harthmereIsTownCoreBuilding(b)) {
        continue;
      }
      const walk = harthmereDoorToStreetDistance(b);
      if (walk === undefined) {
        stranded.push(`${b.name}: never reaches the network`);
      } else if (walk > 8) {
        stranded.push(`${b.name}: ${walk} voxels from its own doorstep`);
      }
    }
    assert.deepEqual(stranded, []);
  });

  it("cobbles the middle of a street and gravels its shoulder", () => {
    let cobble = 0;
    let gravel = 0;
    for (const r of harthmereTownStreetRects()) {
      for (let x = r.x0; x <= r.x1; x += 1) {
        for (let z = r.z0; z <= r.z1; z += 1) {
          const surface = harthmereTownStreetSurfaceAt(x, z);
          if (surface === "cobblestone") {
            cobble += 1;
          } else if (surface === "gravel") {
            gravel += 1;
          }
        }
      }
    }
    assert.ok(cobble > 0 && gravel > 0, `cobble ${cobble}, gravel ${gravel}`);
  });

  it("is deterministic", () => {
    const first = JSON.stringify(harthmereTownStreetRects());
    const second = JSON.stringify(harthmereTownStreetRects());
    assert.equal(first, second);
  });

  it("keeps the seam ridge off the town and off the paving", () => {
    // The ridge is authored in world coordinates west of the town; the streets
    // are authored coordinates inside it. If those two bands ever met, the
    // ridge would bury a street under a hillside.
    const streetWorldMinX = Math.min(
      ...harthmereTownStreetRects().map((r) => r.x0)
    );
    assert.ok(
      HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.maxX <
        streetWorldMinX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
      `ridge reaches x=${HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.maxX}, paving starts at ` +
        `${streetWorldMinX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X}`
    );
    // No structure is buried. `charcoal_burners_camp` genuinely stands inside
    // the ridge's band — it was authored out in the wilds near the seam — so
    // the ridge yields around it rather than the camp having to move.
    for (const b of HARTHMERE_BUILDINGS) {
      for (let x = b.x0 - 1; x <= b.x1 + 1; x += 1) {
        for (let z = b.z0 - 1; z <= b.z1 + 1; z += 1) {
          const raised = harthmereWestSeamRidgeSurfaceY(
            x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            z
          );
          assert.equal(
            raised,
            undefined,
            `${b.name}: seam ridge raises ground to Y=${raised} at (${x},${z})`
          );
        }
      }
    }
  });

  it("seeds terrain under every authored structure", () => {
    // Five structures used to fail this. The additive seeder generates shards
    // only inside `HARTHMERE_EXTENSION_WORLD_BOUNDS`, and that band was sized
    // for the West Muck Breach rather than for the authored content, so
    // `charcoal_burners_camp`, `deep_old_wood_glade_lodge`,
    // `grave_tender_caretaker_house`, `northwest_ruined_watchtower` and
    // `southwest_orchard_windmill` had no ground beneath them and were never
    // written at all in the shifted production frame. They rendered correctly
    // in an unshifted authored world, which is how it survived.
    //
    // Three were fixed by widening the band to the authored content. The other
    // two mapped WEST of the old map's edge, where the seeder is fail-closed by
    // design because generating there would overwrite imported production
    // terrain, so those had to move east instead.
    const stranded: string[] = [];
    for (const b of HARTHMERE_BUILDINGS) {
      const x0 = b.x0 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
      const x1 = b.x1 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
      if (
        x0 < HARTHMERE_EXTENSION_WORLD_BOUNDS.minX ||
        x1 > HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX ||
        b.z0 < HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ ||
        b.z1 > HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ
      ) {
        stranded.push(
          `${b.name} at world x[${x0},${x1}] z[${b.z0},${b.z1}] has no seeded ground`
        );
      }
    }
    assert.deepEqual(stranded, []);
  });

  it("leaves the road pass through the seam ridge open at the plain", () => {
    assert.deepEqual(harthmereValidateWestSeamRidge(), []);
  });

  it("meets every wilds road where it reaches the town", () => {
    // The town's paving used to be an island. Every front door reached it, but
    // the network itself began 16 to 42 voxels inside the gates, so a player
    // walking the gravel road in from the old-map seam crossed open grass
    // before finding a street. This is the seam that matters most: it is the
    // one every arriving player walks.
    const stranded: string[] = [];
    for (const head of HARTHMERE_TOWN_ROAD_HEADS) {
      const walk = harthmereRoadHeadToStreetDistance(head.at);
      if (walk === undefined) {
        stranded.push(`${head.name}: never meets the paving`);
      } else if (walk > 4) {
        stranded.push(`${head.name}: ${walk} voxels of bare ground first`);
      }
    }
    assert.deepEqual(stranded, []);
  });
});
