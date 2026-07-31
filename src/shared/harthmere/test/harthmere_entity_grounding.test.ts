import assert from "assert";

import {
  HARTHMERE_GROUND_SCAN_UP_DEFAULT,
  findHarthmereGroundFeetY,
  groundHarthmereEntityPosition,
  harthmereCanStandAt,
  type HarthmereSolidSampler,
} from "@/shared/harthmere/harthmere_entity_grounding";

// Build a solid sampler from a heightmap: every block with y <= surface(x,z) is
// solid, everything above is air. Feet therefore rest at surface + 1.
function heightmapSampler(
  surface: (x: number, z: number) => number
): HarthmereSolidSampler {
  return (x, y, z) => y <= surface(x, z);
}

const FLAT_WILDS = heightmapSampler(() => 53); // feet -> 54
const FLAT_GROVE = heightmapSampler(() => 69); // feet -> 70

describe("harthmere entity grounding: canStandAt", () => {
  it("stands on top of the surface with clear head room", () => {
    // Surface top is y=53, so feet rest at 54.
    assert.equal(harthmereCanStandAt(FLAT_WILDS, 0, 54, 0), true);
    assert.equal(harthmereCanStandAt(FLAT_WILDS, 0, 53, 0), false); // inside solid
    assert.equal(harthmereCanStandAt(FLAT_WILDS, 0, 55, 0), false); // floating
  });
});

describe("harthmere entity grounding: findGroundFeetY", () => {
  it("flat wilds: feet land at surface+1 regardless of a wrong hint", () => {
    for (const hint of [54, 40, 90, 53, 100, 20]) {
      assert.equal(
        findHarthmereGroundFeetY(FLAT_WILDS, 10, -10, { hintY: hint }),
        54,
        `hint ${hint} should still resolve to wilds feet 54`
      );
    }
  });

  it("EDGE: a muck mucker stamped at the wrong Grove Y=70 still lands on wilds ground (54)", () => {
    // The exact regression: muckers were stamped at Grove height but live in the
    // wilds. Probing real terrain bridges the ~16m seam without any constant.
    assert.equal(
      findHarthmereGroundFeetY(FLAT_WILDS, 512, -152, { hintY: 70 }),
      54
    );
  });

  it("EDGE: a Grove NPC at Harthmere height lands on the raised courtyard (70)", () => {
    assert.equal(
      findHarthmereGroundFeetY(FLAT_GROVE, 486, -209, { hintY: 54 }),
      70
    );
    assert.equal(
      findHarthmereGroundFeetY(FLAT_GROVE, 486, -209, { hintY: 70 }),
      70
    );
  });

  it("HILLY: feet track the real surface across a steep slope (flat Y would float/bury)", () => {
    // Surface rises 1 block per x; at x the surface is 50 + x, feet = 51 + x.
    const hill = heightmapSampler((x) => 50 + x);
    for (const x of [0, 5, 12, 25, 40]) {
      assert.equal(
        findHarthmereGroundFeetY(hill, x, 0, { hintY: 54 }),
        51 + x,
        `x=${x} feet should follow the hill`
      );
    }
  });

  it("un-buries a hint that sits inside the terrain", () => {
    // Surface 80 (feet 81); a hint of 60 is buried 20 deep -> climb up to 81.
    const tall = heightmapSampler(() => 80);
    assert.equal(findHarthmereGroundFeetY(tall, 0, 0, { hintY: 60 }), 81);
  });

  it("drops a hint floating high above the ground down onto it", () => {
    const ground = heightmapSampler(() => 30); // feet 31
    assert.equal(findHarthmereGroundFeetY(ground, 0, 0, { hintY: 95 }), 31);
  });

  it("returns undefined when no surface is within the scan budget (cliff)", () => {
    // Surface far below the hint and beyond the upward/downward budget.
    const deep = heightmapSampler(() => 5);
    assert.equal(
      findHarthmereGroundFeetY(deep, 0, 0, { hintY: 200, maxScanDown: 20 }),
      undefined
    );
  });

  it("returns undefined for an ungenerated/empty column", () => {
    const empty: HarthmereSolidSampler = () => false;
    assert.equal(
      findHarthmereGroundFeetY(empty, 0, 0, { hintY: 60 }),
      undefined
    );
  });

  it("respects the default upward budget at the seam (Grove hint over wilds)", () => {
    // 70 -> 54 is 16 down, well within budget.
    assert.equal(findHarthmereGroundFeetY(FLAT_WILDS, 0, 0, { hintY: 70 }), 54);
    // And a deeply buried hint within the default up budget still climbs out.
    const surface = heightmapSampler(() => 100);
    const within = 100 + 1 - HARTHMERE_GROUND_SCAN_UP_DEFAULT; // exactly reachable
    assert.equal(
      findHarthmereGroundFeetY(surface, 0, 0, { hintY: within }),
      101
    );
  });

  it("prefers the nearer surface and never floats on a flat hint", () => {
    assert.equal(findHarthmereGroundFeetY(FLAT_WILDS, 0, 0, { hintY: 54 }), 54);
  });
});

describe("harthmere entity grounding: CAVES", () => {
  // Outdoor surface at feet 70 (solid 0..69, air 70+), with a cave pocket of air
  // at y=40..44 inside the rock. A naive "nearest standable" with a hint inside
  // the cave would land on the cave floor (underground).
  const caveColumn: HarthmereSolidSampler = (_x, y) => {
    if (y >= 70) return false; // sky
    if (y >= 40 && y <= 44) return false; // cave pocket
    return true; // solid rock / ground
  };

  it("REGRESSION: requireOpenSky lands on the surface, never the cave floor", () => {
    // Hint inside the cave pocket.
    assert.equal(
      findHarthmereGroundFeetY(caveColumn, 0, 0, {
        hintY: 42,
        requireOpenSky: true,
      }),
      70
    );
    // Hint right at the cave floor.
    assert.equal(
      findHarthmereGroundFeetY(caveColumn, 0, 0, {
        hintY: 40,
        requireOpenSky: true,
      }),
      70
    );
  });

  it("shows the bug requireOpenSky fixes: nearest-mode would pick the cave floor", () => {
    // Cave floor: feet 40 (solid 39, air 40/41). Demonstrates why open-sky matters.
    assert.equal(
      findHarthmereGroundFeetY(caveColumn, 0, 0, {
        hintY: 42,
        requireOpenSky: false,
      }),
      40
    );
  });

  it("a floating hint above a cave still grounds on the surface in both modes", () => {
    // Hint above the surface -> nearest-down hits the surface first; the cave is
    // far below and never reached.
    assert.equal(findHarthmereGroundFeetY(caveColumn, 0, 0, { hintY: 80 }), 70);
    assert.equal(
      findHarthmereGroundFeetY(caveColumn, 0, 0, {
        hintY: 80,
        requireOpenSky: true,
      }),
      70
    );
  });
});

describe("harthmere entity grounding: BUILDINGS (indoor floors)", () => {
  // Ground surface at feet 54 (solid 0..53), a building with a floor at 54 and a
  // solid roof at y=60, open above the roof.
  const buildingColumn: HarthmereSolidSampler = (_x, y) => {
    if (y <= 53) return true; // terrain under the floor
    if (y === 60) return true; // roof
    return false; // interior + sky
  };

  it("nearest-mode keeps an owner on the building FLOOR (not the roof)", () => {
    // Floor feet = 54 (solid 53, air 54/55). This is why owners use requireOpenSky=false.
    assert.equal(
      findHarthmereGroundFeetY(buildingColumn, 0, 0, {
        hintY: 54,
        requireOpenSky: false,
      }),
      54
    );
  });

  it("DOCUMENTS: requireOpenSky would push an indoor entity onto the roof", () => {
    // The floor has a roof within clearance (not open sky); the roof-top is open
    // sky. So outdoor cave-safe mode is wrong for roofed interiors -> owners opt out.
    assert.equal(
      findHarthmereGroundFeetY(buildingColumn, 0, 0, {
        hintY: 54,
        requireOpenSky: true,
      }),
      61
    );
  });
});

describe("harthmere entity grounding: WATER", () => {
  // The client treats water as standable support (terrain OR water), so an entity
  // over a lake rests ON the water surface, never on the bed underwater. Here the
  // "support" sampler returns true for the rock bed (<=40) AND the water column
  // (41..50); air above 50.
  const lake: HarthmereSolidSampler = (_x, y) => {
    if (y <= 40) return true; // lake bed rock
    if (y >= 41 && y <= 50) return true; // water column treated as support
    return false; // air
  };

  it("rests an entity ON the water surface, not on the lake bed underwater", () => {
    // Water top is 50, so feet rest at 51 (support 50, air 51/52). The bed (41)
    // is never chosen.
    assert.equal(findHarthmereGroundFeetY(lake, 0, 0, { hintY: 54 }), 51);
    assert.equal(
      findHarthmereGroundFeetY(lake, 0, 0, { hintY: 54, requireOpenSky: true }),
      51
    );
  });

  it("a hint already at/below the water still surfaces to the water top", () => {
    assert.equal(findHarthmereGroundFeetY(lake, 0, 0, { hintY: 45 }), 51);
  });
});

describe("harthmere entity grounding: groundEntityPosition", () => {
  it("keeps X/Z and replaces Y with the surface feet", () => {
    assert.deepEqual(
      groundHarthmereEntityPosition(FLAT_WILDS, [123.5, 70, -45.25]),
      [123.5, 54, -45.25]
    );
  });

  it("applies a hover offset (e.g. floating quest markers)", () => {
    assert.deepEqual(
      groundHarthmereEntityPosition(FLAT_WILDS, [0, 70, 0], { hoverBlocks: 2 }),
      [0, 56, 0]
    );
  });

  it("falls back to the original Y when no ground is found (no teleporting)", () => {
    const empty: HarthmereSolidSampler = () => false;
    assert.deepEqual(
      groundHarthmereEntityPosition(empty, [7, 88, 9]),
      [7, 88, 9]
    );
  });
});
