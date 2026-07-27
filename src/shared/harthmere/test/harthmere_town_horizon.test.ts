/// <reference types="mocha" />
/// <reference types="node" />
//
// Harthmere's back country. The single most important thing this file checks
// is that the WEST approach — the connector road from the main world — is
// never blocked, because blocking it would make the additive town unreachable.

import assert from "assert";
import {
  HARTHMERE_HORIZON_BANDS,
  HARTHMERE_HORIZON_BUILDINGS,
  HARTHMERE_HORIZON_SNOW,
  HARTHMERE_TOWN_BACKDROP_END_X,
  HARTHMERE_TOWN_BACKDROP_MAX_Z,
  HARTHMERE_TOWN_BACKDROP_MIN_Z,
  HARTHMERE_TOWN_BACK_BOUNDARY_X,
  HARTHMERE_TOWN_EAST_CONTENT_X,
  HARTHMERE_TOWN_GROUND_Y,
  HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X,
  harthmereDistanceBehindTown,
  harthmereHorizonBlockAt,
  harthmereHorizonSurfaceY,
  harthmereIsBackCountry,
  harthmereTownAuthoredToWorldX,
  harthmereTownBackBoundarySlabs,
  harthmereTownSeederBlockAt,
  harthmereValidateTownHorizon,
  HARTHMERE_BACK_WALL_DRAW_DISTANCE,
  HARTHMERE_BACK_WALL_FADE_DISTANCE,
  harthmereBackWallDistance,
} from "../harthmere_town_horizon";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
} from "../world_extension";
import { CH1_ELSEWHEN_SLOTS } from "../ch1_elsewhen_region";

// ---------------------------------------------------------------------------
// THE CRITICAL PROPERTY
// ---------------------------------------------------------------------------

describe("harthmere town horizon - the town stays reachable", () => {
  it("never blocks the connector road from the main world", () => {
    // The connector enters at world X 1792 (the old/new map boundary) and runs
    // east to the west gate. If ANY of that is blocked, Harthmere becomes
    // unreachable and the whole additive town is dead content.
    const connectorWorldX = HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X; // 1792
    for (let worldX = connectorWorldX; worldX <= 2100; worldX += 8) {
      const slabs = harthmereTownBackBoundarySlabs([
        [worldX - 0.4, HARTHMERE_TOWN_GROUND_Y, -240],
        [worldX + 0.4, HARTHMERE_TOWN_GROUND_Y + 1.8, -239],
      ]);
      assert.deepEqual(
        slabs,
        [],
        `a player on the connector road at world X ${worldX} was blocked — ` +
          `Harthmere would be unreachable`
      );
    }
  });

  it("leaves the whole town walkable, west gate to east content edge", () => {
    for (let authoredX = 192; authoredX <= HARTHMERE_TOWN_EAST_CONTENT_X; authoredX += 8) {
      const worldX = harthmereTownAuthoredToWorldX(authoredX);
      assert.deepEqual(
        harthmereTownBackBoundarySlabs([
          [worldX - 0.4, HARTHMERE_TOWN_GROUND_Y, -240],
          [worldX + 0.4, HARTHMERE_TOWN_GROUND_Y + 1.8, -239],
        ]),
        [],
        `authored X ${authoredX} is inside the town and must not be blocked`
      );
    }
  });

  it("does not wall the north, south, or west approaches", () => {
    // Only ONE axis is tested by the slab function, and only in the +X
    // direction. Walking far north, far south or far west must produce
    // nothing — those approaches belong to the town, not to this module.
    const worldX = harthmereTownAuthoredToWorldX(500);
    for (const z of [-2000, -600, 200, 2000]) {
      assert.deepEqual(
        harthmereTownBackBoundarySlabs([
          [worldX, HARTHMERE_TOWN_GROUND_Y, z],
          [worldX + 0.8, HARTHMERE_TOWN_GROUND_Y + 1.8, z + 0.8],
        ]),
        [],
        `walking to Z ${z} must not be blocked by the BACK boundary`
      );
    }
    assert.deepEqual(
      harthmereTownBackBoundarySlabs([
        [0, HARTHMERE_TOWN_GROUND_Y, -240],
        [1, HARTHMERE_TOWN_GROUND_Y + 1.8, -239],
      ]),
      [],
      "the far west (the main world) must never be blocked"
    );
  });

  it("writes no backdrop voxel anywhere in the town", () => {
    for (let authoredX = 192; authoredX <= HARTHMERE_TOWN_BACK_BOUNDARY_X; authoredX += 6) {
      for (let z = -360; z <= 100; z += 20) {
        for (let y = 40; y <= 120; y += 8) {
          assert.equal(
            harthmereHorizonBlockAt(authoredX, y, z),
            undefined,
            `backdrop wrote into the town at authored X ${authoredX}, ` +
              `Y ${y}, Z ${z}`
          );
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("harthmere town horizon - structure", () => {
  it("passes validation", () => {
    assert.deepEqual(harthmereValidateTownHorizon(), []);
  });

  it("puts the boundary east of the last building", () => {
    assert.ok(HARTHMERE_TOWN_BACK_BOUNDARY_X > HARTHMERE_TOWN_EAST_CONTENT_X);
    // ...and the town's authored east edge is where the design doc says.
    assert.equal(
      harthmereTownAuthoredToWorldX(HARTHMERE_TOWN_EAST_CONTENT_X),
      2368
    );
  });

  it("stops short of the world edge so the purple wall stays outermost", () => {
    assert.equal(
      HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X,
      HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X - HARTHMERE_ADDITIVE_TOWN_OFFSET_X
    );
    assert.ok(
      HARTHMERE_TOWN_BACKDROP_END_X < HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X,
      "two boundaries in the same place would z-fight and read as a bug"
    );
    assert.equal(
      harthmereHorizonBlockAt(
        HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X,
        HARTHMERE_TOWN_GROUND_Y,
        -240
      ),
      undefined,
      "nothing may be written at the world edge"
    );
  });

  it("tiles its bands near-to-far with no gaps", () => {
    let expected = 0;
    for (const band of HARTHMERE_HORIZON_BANDS) {
      assert.equal(band.fromDistance, expected, `${band.name} leaves a gap`);
      expected = band.toDistance;
    }
    assert.equal(HARTHMERE_HORIZON_BANDS.length, 3);
  });

  it("tells a story near to far: worked land, industry, then the reason", () => {
    const [farms, workings, range] = HARTHMERE_HORIZON_BANDS;
    assert.ok(
      workings.amplitude > farms.amplitude,
      "the workings must be rougher than the farms"
    );
    assert.ok(
      range.amplitude > workings.amplitude,
      "the range must dominate both"
    );
    // Harthmere's palette: no sand, no exotic glow. Coal and ore are the point.
    assert.ok(workings.column.includes("coal"));
    assert.ok(range.column.includes("ironOre"));
    for (const band of HARTHMERE_HORIZON_BANDS) {
      assert.ok(
        !band.column.some((m) => String(m) === "sand"),
        `${band.name}: sand is not Harthmere's vocabulary`
      );
    }
  });

  it("keeps snow a three-voxel cap on the peaks only", () => {
    assert.equal(HARTHMERE_HORIZON_SNOW.depth, 3);
    assert.ok(HARTHMERE_HORIZON_SNOW.minHeightAboveGround > 40);
  });
});

// ---------------------------------------------------------------------------
// The land itself
// ---------------------------------------------------------------------------

describe("harthmere town horizon - back country terrain", () => {
  it("starts at town level and climbs away", () => {
    const z = -240;
    const atWall = harthmereHorizonSurfaceY(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 1,
      z
    );
    assert.ok(
      Math.abs(atWall - HARTHMERE_TOWN_GROUND_Y) <= 3,
      `the ground is ${atWall - HARTHMERE_TOWN_GROUND_Y} high at the wall — ` +
        `that is a cliff, not a horizon`
    );
    const farms = harthmereHorizonSurfaceY(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 40,
      z
    );
    const workings = harthmereHorizonSurfaceY(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 100,
      z
    );
    const range = harthmereHorizonSurfaceY(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 160,
      z
    );
    assert.ok(farms > atWall, "the farms must rise above the wall");
    assert.ok(workings > farms, "the workings must rise above the farms");
    assert.ok(range > workings, "the range must dominate everything");
    assert.ok(
      range - HARTHMERE_TOWN_GROUND_Y > 60,
      `the range only reaches +${range - HARTHMERE_TOWN_GROUND_Y}; a flat town ` +
        `needs real relief behind it`
    );
  });

  it("gives the flat town genuine vertical interest", () => {
    // The whole point: Harthmere's terrain is dead flat. Sample the skyline
    // and confirm it is not.
    const heights: number[] = [];
    for (let d = 10; d < 170; d += 10) {
      heights.push(
        harthmereHorizonSurfaceY(HARTHMERE_TOWN_BACK_BOUNDARY_X + d, -240)
      );
    }
    const spread = Math.max(...heights) - Math.min(...heights);
    assert.ok(spread > 50, `skyline spread is only ${spread} voxels`);
  });

  it("puts solid ground under the surface and sky above it", () => {
    const x = HARTHMERE_TOWN_BACK_BOUNDARY_X + 90;
    const z = -330; // clear of every authored building
    assert.ok(
      !HARTHMERE_HORIZON_BUILDINGS.some(
        (b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1
      ),
      "sample point drifted into a building; move it"
    );
    const surface = harthmereHorizonSurfaceY(x, z);
    assert.ok(harthmereHorizonBlockAt(x, surface, z) !== undefined);
    assert.equal(harthmereHorizonBlockAt(x, surface + 1, z), undefined);
    assert.ok(harthmereHorizonBlockAt(x, surface - 10, z) !== undefined);
  });

  it("is deterministic", () => {
    for (let i = 0; i < 4; i++) {
      assert.equal(
        harthmereHorizonSurfaceY(880, -240),
        harthmereHorizonSurfaceY(880, -240)
      );
      assert.equal(
        harthmereHorizonBlockAt(880, 90, -240),
        harthmereHorizonBlockAt(880, 90, -240)
      );
    }
  });

  it("respects the extension's Z bounds", () => {
    assert.equal(harthmereIsBackCountry(880, HARTHMERE_TOWN_BACKDROP_MIN_Z), true);
    assert.equal(harthmereIsBackCountry(880, HARTHMERE_TOWN_BACKDROP_MAX_Z), true);
    assert.equal(harthmereIsBackCountry(880, -10_000), false);
    assert.equal(harthmereIsBackCountry(880, 10_000), false);
  });

  it("measures distance behind town with the right sign", () => {
    assert.ok(harthmereDistanceBehindTown(500) < 0, "town is negative");
    assert.equal(harthmereDistanceBehindTown(HARTHMERE_TOWN_BACK_BOUNDARY_X), 0);
    assert.equal(
      harthmereDistanceBehindTown(HARTHMERE_TOWN_BACK_BOUNDARY_X + 25),
      25
    );
  });
});

describe("harthmere town horizon - back country buildings", () => {
  it("gives the vista a readable skyline", () => {
    assert.ok(HARTHMERE_HORIZON_BUILDINGS.length >= 5);
    assert.ok(
      HARTHMERE_HORIZON_BUILDINGS.some((b) => b.height >= 40),
      "needs one tall anchor"
    );
  });

  it("places every building beyond the wall and inside the strip", () => {
    for (const building of HARTHMERE_HORIZON_BUILDINGS) {
      assert.ok(
        building.x0 > HARTHMERE_TOWN_BACK_BOUNDARY_X,
        `${building.name} is reachable`
      );
      assert.ok(
        building.x1 <= HARTHMERE_TOWN_BACKDROP_END_X,
        `${building.name} escapes past the world edge`
      );
    }
  });

  it("actually stamps the keep into the world", () => {
    const keep = HARTHMERE_HORIZON_BUILDINGS.find(
      (b) => b.name === "border_keep"
    )!;
    const x = Math.floor((keep.x0 + keep.x1) / 2);
    const z = Math.floor((keep.z0 + keep.z1) / 2);
    const surface = harthmereHorizonSurfaceY(x, z);
    assert.ok(
      harthmereHorizonBlockAt(x, surface + 6, z) !== undefined,
      "the keep is not solid"
    );
    // Tiered massing: high up the centre is solid, the outer edge is sky.
    const high = surface + keep.height - 1;
    assert.ok(harthmereHorizonBlockAt(x, high, z) !== undefined);
    assert.equal(
      harthmereHorizonBlockAt(keep.x0 + 1, high, z),
      undefined,
      "the outer tier should stop short — otherwise it is a box"
    );
  });
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

describe("harthmere town horizon - seeder composition", () => {
  it("always lets the town win a contested voxel", () => {
    assert.equal(
      harthmereTownSeederBlockAt(500, HARTHMERE_TOWN_GROUND_Y, -240, "stoneBrick"),
      "stoneBrick"
    );
  });

  it("fills back country where the town has nothing to say", () => {
    const x = HARTHMERE_TOWN_BACK_BOUNDARY_X + 90;
    const z = -330;
    const surface = harthmereHorizonSurfaceY(x, z);
    assert.ok(
      harthmereTownSeederBlockAt(x, surface, z, undefined) !== undefined
    );
  });

  it("adds nothing inside the town even with no town block", () => {
    assert.equal(
      harthmereTownSeederBlockAt(500, HARTHMERE_TOWN_GROUND_Y, -240, undefined),
      undefined,
      "empty town voxels must stay empty — that is where players build"
    );
  });
});

describe("harthmere town horizon - the back boundary blocks", () => {
  it("synthesises exactly one slab, not six", () => {
    const beyond = harthmereTownAuthoredToWorldX(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 20
    );
    const slabs = harthmereTownBackBoundarySlabs([
      [beyond, HARTHMERE_TOWN_GROUND_Y, -240],
      [beyond + 0.8, HARTHMERE_TOWN_GROUND_Y + 1.8, -239],
    ]);
    assert.equal(
      slabs.length,
      1,
      "Harthmere is open on three sides; only the back needs a slab"
    );
  });

  it("makes the slab deep and tall enough that it cannot be beaten", () => {
    const beyond = harthmereTownAuthoredToWorldX(
      HARTHMERE_TOWN_BACK_BOUNDARY_X + 1
    );
    const [[lo, hi]] = harthmereTownBackBoundarySlabs([
      [beyond, HARTHMERE_TOWN_GROUND_Y, -240],
      [beyond + 0.8, HARTHMERE_TOWN_GROUND_Y + 1.8, -239],
    ]);
    assert.ok(
      hi[0] - lo[0] > 200,
      "a fast mover could tunnel through a thin slab in one tick"
    );
    assert.ok(hi[1] > HARTHMERE_TOWN_GROUND_Y + 200, "you must not fly over it");
    assert.ok(lo[1] < 0, "you must not dig under it");
    assert.ok(
      hi[2] - lo[2] > 700,
      "the slab must span the whole extension so you cannot walk around it"
    );
  });

  it("does not leak the town wall into either Elsewhen dungeon", () => {
    for (const slot of CH1_ELSEWHEN_SLOTS) {
      for (const position of [slot.arrival, slot.departure]) {
        assert.deepEqual(
          harthmereTownBackBoundarySlabs([
            [position[0] - 0.4, position[1], position[2] - 0.4],
            [position[0] + 0.4, position[1] + 1.8, position[2] + 0.4],
          ]),
          [],
          `${slot.dungeonId} must use its own closed boundary, not the town wall`
        );
      }
    }
  });
});

describe("harthmere town horizon - back wall cull maths", () => {
  const wallX = harthmereTownAuthoredToWorldX(HARTHMERE_TOWN_BACK_BOUNDARY_X);
  const minZ = HARTHMERE_TOWN_BACKDROP_MIN_Z;
  const maxZ = HARTHMERE_TOWN_BACKDROP_MAX_Z;

  it("measures the X gap while inside the wall's Z span", () => {
    assert.equal(harthmereBackWallDistance([wallX - 10, 60, -240], wallX, minZ, maxZ), 10);
    assert.equal(harthmereBackWallDistance([wallX, 60, -240], wallX, minZ, maxZ), 0);
  });

  it("reports infinity outside the Z span so the wall never draws there", () => {
    assert.equal(
      harthmereBackWallDistance([wallX, 60, minZ - 50], wallX, minZ, maxZ),
      Number.POSITIVE_INFINITY
    );
    assert.equal(
      harthmereBackWallDistance([wallX, 60, maxZ + 50], wallX, minZ, maxZ),
      Number.POSITIVE_INFINITY
    );
  });

  it("pops the wall in while it is still fully transparent", () => {
    assert.ok(
      HARTHMERE_BACK_WALL_DRAW_DISTANCE < HARTHMERE_BACK_WALL_FADE_DISTANCE
    );
  });
});
