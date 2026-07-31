import assert from "assert";

import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import {
  HARTHMERE_FOUNTAIN_BASIN_RADIUS,
  HARTHMERE_FOUNTAIN_BOWL_REL_Y,
  HARTHMERE_FOUNTAIN_CENTRE,
  HARTHMERE_FOUNTAIN_OUTER_RADIUS,
  HARTHMERE_FOUNTAIN_PLINTH_RADIUS,
  HARTHMERE_FOUNTAIN_POST_TOP_REL_Y,
  HARTHMERE_FOUNTAIN_WALL_TOP_REL_Y,
  HARTHMERE_MILL_BANK_TOP_REL_Y,
  HARTHMERE_MILL_BUILDING_WEST_X,
  HARTHMERE_MILL_HOUSING_POST_Z,
  HARTHMERE_MILL_HOUSING_TOP_REL_Y,
  HARTHMERE_MILL_RACE_BOUNDS,
  HARTHMERE_MILL_WHEEL_CENTRE,
  HARTHMERE_MILL_WHEEL_INNER_RADIUS,
  HARTHMERE_MILL_WHEEL_OUTER_RADIUS,
  HARTHMERE_STILL_WATER_FEATURES,
  HARTHMERE_TROUGH_BOUNDS,
  harthmereStillWaterBlockAt,
  harthmereStillWaterCarvesAirAt,
  harthmereStillWaterFeatureAt,
  harthmereStillWaterLevelAt,
  harthmereStillWaterTouchesAuthoredSpan,
} from "@/shared/harthmere/harthmere_still_water";
import { harthmereRiverContains } from "@/shared/harthmere/harthmere_river";

/**
 * HARTHMERE_STILL_WATER — the market fountain, the stable trough and the
 * watermill race.
 *
 * All three were authored as `materials.water`, which has no water block behind
 * it and resolved to blue wool. Wool is solid, so none of the three had to hold
 * anything; real water does. The centrepiece of this file is
 * `floodFrom`, which runs the engine's own spread rule
 * (voxeloo/gaia/water.cpp `update_water`, doc §5.3) outward from every source
 * voxel and asserts nothing escapes. That is the check that was missing when
 * these were left alone the first time round.
 */

/** Ground plane. Everything at relY < 0 outside a carve is solid terrain. */
const GROUND_REL_Y = 0;
/** `kMaxWater` — a level-15 source reaches this far before it dies. */
const MAX_SPREAD = 14;

/**
 * Is this voxel solid, in the sense `is_flowable` cares about?
 *
 * Solid means: a block this module places, or undisturbed terrain (anything at
 * or below the ground plane that has not been carved). Everything else — open
 * air above grade — is flowable, and therefore a route water can take.
 */
function isSolid(x: number, relY: number, z: number) {
  if (harthmereStillWaterBlockAt(x, relY, z) !== undefined) return true;
  if (relY > GROUND_REL_Y) return false;
  // At or below grade: terrain, unless this feature or the river cut it away.
  if (harthmereStillWaterCarvesAirAt(x, relY, z)) return false;
  if (relY === GROUND_REL_Y && harthmereRiverContains(x, z)) return false;
  return true;
}

/**
 * Flood the engine's rule outward from every source and return every voxel the
 * water would ever occupy.
 *
 * Mirrors `update_water`: water enters a voxel only if that voxel is flowable;
 * it loses one level per horizontal step; and it falls whenever the voxel below
 * is flowable, arriving at level `kMaxWater - 1`. That last clause is the one
 * that turns a rimless basin into a flooded plaza, so it is modelled here
 * rather than assumed away.
 */
function floodFrom(sources: Array<readonly [number, number, number]>) {
  const wet = new Map<string, number>();
  const key = (x: number, y: number, z: number) => `${x}:${y}:${z}`;
  const queue: Array<readonly [number, number, number, number]> = sources.map(
    ([x, y, z]) => [x, y, z, 15] as const
  );
  for (const [x, y, z] of sources) wet.set(key(x, y, z), 15);

  let guard = 0;
  while (queue.length > 0) {
    if (guard++ > 400000) throw new Error("flood did not converge");
    const [x, y, z, level] = queue.shift()!;
    if (level <= 0) continue;

    // Falling water: straight down, arriving one below source strength.
    if (!isSolid(x, y - 1, z)) {
      const fallLevel = Math.min(15 - 1, level);
      const k = key(x, y - 1, z);
      if ((wet.get(k) ?? -1) < fallLevel) {
        wet.set(k, fallLevel);
        queue.push([x, y - 1, z, fallLevel]);
      }
      // A falling column does not also spread sideways.
      continue;
    }

    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (isSolid(nx, y, nz)) continue;
      const next = level - 1;
      if (next <= 0) continue;
      const k = key(nx, y, nz);
      if ((wet.get(k) ?? -1) < next) {
        wet.set(k, next);
        queue.push([nx, y, nz, next]);
      }
    }
  }
  return wet;
}

function sourcesFor(feature: (typeof HARTHMERE_STILL_WATER_FEATURES)[number]) {
  const sources: Array<readonly [number, number, number]> = [];
  const [y0, y1] = feature.relYRange;
  for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
    for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
      for (let y = y0; y <= y1; y += 1) {
        if (harthmereStillWaterLevelAt(x, y, z) === 15) {
          sources.push([x, y, z] as const);
        }
      }
    }
  }
  return sources;
}

describe("Harthmere still water", () => {
  describe("containment", () => {
    for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
      it(`${feature.label} cannot leak`, () => {
        const sources = sourcesFor(feature);
        assert.ok(sources.length > 0, `${feature.label} holds no water`);
        const wet = floodFrom(sources);
        for (const k of wet.keys()) {
          const [x, y, z] = k.split(":").map(Number);
          assert.ok(
            x >= feature.bounds.x0 &&
              x <= feature.bounds.x1 &&
              z >= feature.bounds.z0 &&
              z <= feature.bounds.z1,
            `${feature.label} leaked to ${x},${y},${z}`
          );
          assert.ok(
            y >= feature.relYRange[0] && y <= feature.relYRange[1],
            `${feature.label} leaked vertically to ${x},${y},${z}`
          );
        }
      });

      it(`${feature.label} keeps every source at full strength`, () => {
        // A source that the flood re-derives at a lower level would mean the
        // basin is draining into itself somewhere.
        const wet = floodFrom(sourcesFor(feature));
        for (const [x, y, z] of sourcesFor(feature)) {
          assert.equal(wet.get(`${x}:${y}:${z}`), 15);
        }
      });
    }

    it("would catch a rimless basin", () => {
      // Sanity-check the prover itself against the bug it exists to find: an
      // unwalled source above open ground, which is what the fountain's
      // authored upper tier and the authored trough both were. It must escape,
      // fall, and spread the full fourteen voxels.
      const wet = floodFrom([[300, 3, -300] as const]);
      assert.ok(
        wet.size > MAX_SPREAD * 4,
        `the flood prover does not detect an open source (${wet.size})`
      );
      // And it must genuinely run away from the source column.
      const far = [...wet.keys()].some((k) => {
        const [x, , z] = k.split(":").map(Number);
        return Math.abs(x - 300) + Math.abs(z + 300) >= MAX_SPREAD - 1;
      });
      assert.ok(far, "the flood did not spread horizontally");
    });
  });

  describe("structure", () => {
    it("never floats a block", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
          for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
            for (
              let y = feature.relYRange[0];
              y <= feature.relYRange[1];
              y += 1
            ) {
              if (harthmereStillWaterBlockAt(x, y, z) === undefined) continue;
              assert.ok(
                isSolid(x, y - 1, z),
                `${feature.label} floats a block at ${x},${y},${z}`
              );
            }
          }
        }
      }
    });

    it("never puts water and a block in the same voxel", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
          for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
            for (
              let y = feature.relYRange[0];
              y <= feature.relYRange[1];
              y += 1
            ) {
              const block = harthmereStillWaterBlockAt(x, y, z);
              const water = harthmereStillWaterLevelAt(x, y, z);
              assert.ok(
                !(block !== undefined && water > 0),
                `${feature.label} has both at ${x},${y},${z}`
              );
            }
          }
        }
      }
    });

    it("always seals the floor under every water voxel", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        for (const [x, y, z] of sourcesFor(feature)) {
          assert.ok(
            isSolid(x, y - 1, z),
            `${feature.label} has no floor under ${x},${y},${z}`
          );
        }
      }
    });

    it("keeps the three footprints disjoint", () => {
      for (const a of HARTHMERE_STILL_WATER_FEATURES) {
        for (const b of HARTHMERE_STILL_WATER_FEATURES) {
          if (a.id === b.id) continue;
          const overlaps =
            a.bounds.x0 <= b.bounds.x1 &&
            a.bounds.x1 >= b.bounds.x0 &&
            a.bounds.z0 <= b.bounds.z1 &&
            a.bounds.z1 >= b.bounds.z0;
          assert.equal(overlaps, false, `${a.label} overlaps ${b.label}`);
        }
      }
    });

    it("stays clear of the river and every building", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
          for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
            assert.equal(
              harthmereRiverContains(x, z),
              false,
              `${feature.label} collides with the river at ${x},${z}`
            );
            for (const building of HARTHMERE_BUILDINGS) {
              const inside =
                x >= building.x0 &&
                x <= building.x1 &&
                z >= building.z0 &&
                z <= building.z1;
              assert.equal(
                inside,
                false,
                `${feature.label} collides with ${building.name} at ${x},${z}`
              );
            }
          }
        }
      }
    });
  });

  describe("the market fountain", () => {
    it("keeps its authored footprint and outer wall", () => {
      const [cx, cz] = HARTHMERE_FOUNTAIN_CENTRE;
      // The authored ring ran to d <= 4.5 and is still stone at relY 1.
      assert.equal(
        harthmereStillWaterBlockAt(cx + 4, 1, cz),
        "stonePolished",
        "the outer wall moved"
      );
      assert.ok(HARTHMERE_FOUNTAIN_OUTER_RADIUS === 4.5);
    });

    it("holds a real annular basin around the plinth", () => {
      const [cx, cz] = HARTHMERE_FOUNTAIN_CENTRE;
      let basin = 0;
      for (let x = cx - 5; x <= cx + 5; x += 1) {
        for (let z = cz - 5; z <= cz + 5; z += 1) {
          if (harthmereStillWaterLevelAt(x, 1, z) === 15) basin += 1;
        }
      }
      assert.ok(basin >= 24, `basin is only ${basin} voxels`);
      // And the plinth is solid, not water.
      assert.equal(harthmereStillWaterLevelAt(cx, 1, cz), 0);
      assert.equal(harthmereStillWaterBlockAt(cx, 1, cz), "stonePolished");
      assert.ok(
        HARTHMERE_FOUNTAIN_PLINTH_RADIUS < HARTHMERE_FOUNTAIN_BASIN_RADIUS
      );
    });

    it("stands a spout in the bell's mouth on top of the plinth", () => {
      const [cx, cz] = HARTHMERE_FOUNTAIN_CENTRE;
      assert.equal(harthmereStillWaterBlockAt(cx, 2, cz), "stonePolished");
      assert.equal(harthmereStillWaterBlockAt(cx, 3, cz), "stonePolished");
      assert.equal(
        harthmereStillWaterLevelAt(cx, HARTHMERE_FOUNTAIN_BOWL_REL_Y, cz),
        15,
        "no spout"
      );
      // Every horizontal neighbour of the spout is rim.
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        assert.equal(
          harthmereStillWaterBlockAt(
            cx + dx,
            HARTHMERE_FOUNTAIN_BOWL_REL_Y,
            cz + dz
          ),
          "stoneBrick",
          `spout is open at ${dx},${dz}`
        );
      }
    });

    // HARTHMERE_FOUNTAIN_STRUCTURE: the player's report was that the fountain
    // read as "just water in the centre of town". These pin the courses that
    // give it a built silhouette, so a future simplification has to argue with
    // a failing test rather than quietly flatten it again.
    it("raises the basin wall to bench height with a coping course", () => {
      const [cx, cz] = HARTHMERE_FOUNTAIN_CENTRE;
      assert.equal(
        harthmereStillWaterBlockAt(
          cx + 4,
          HARTHMERE_FOUNTAIN_WALL_TOP_REL_Y,
          cz
        ),
        "stoneBrick",
        "no coping course"
      );
      // The coping rings the whole basin, not just one side.
      let coping = 0;
      for (let x = cx - 5; x <= cx + 5; x += 1) {
        for (let z = cz - 5; z <= cz + 5; z += 1) {
          if (
            harthmereStillWaterBlockAt(
              x,
              HARTHMERE_FOUNTAIN_WALL_TOP_REL_Y,
              z
            ) === "stoneBrick"
          ) {
            coping += 1;
          }
        }
      }
      assert.ok(coping >= 20, `coping is only ${coping} voxels`);
    });

    it("stands four posts at the compass points", () => {
      const [cx, cz] = HARTHMERE_FOUNTAIN_CENTRE;
      const posts: Array<[number, number]> = [
        [cx + 4, cz],
        [cx - 4, cz],
        [cx, cz + 4],
        [cx, cz - 4],
      ];
      for (const [x, z] of posts) {
        assert.equal(
          harthmereStillWaterBlockAt(x, HARTHMERE_FOUNTAIN_POST_TOP_REL_Y, z),
          "stoneBrick",
          `no post at ${x},${z}`
        );
      }
      // Exactly four — a full ring at this height would be a wall, not posts.
      let ringAtPostHeight = 0;
      for (let x = cx - 5; x <= cx + 5; x += 1) {
        for (let z = cz - 5; z <= cz + 5; z += 1) {
          const d = Math.hypot(x - cx, z - cz);
          if (d <= HARTHMERE_FOUNTAIN_BASIN_RADIUS) continue;
          if (
            harthmereStillWaterBlockAt(
              x,
              HARTHMERE_FOUNTAIN_POST_TOP_REL_Y,
              z
            ) !== undefined
          ) {
            ringAtPostHeight += 1;
          }
        }
      }
      assert.equal(ringAtPostHeight, 4);
    });

    it("is tall enough to read as a structure", () => {
      const feature = HARTHMERE_STILL_WATER_FEATURES.find(
        (candidate) => candidate.id === "market_fountain"
      );
      assert.ok(feature);
      assert.ok(
        feature!.relYRange[1] >= 4,
        `fountain only reaches relY ${feature!.relYRange[1]}`
      );
    });
  });

  describe("the stable trough", () => {
    it("is a walled trough, not a puddle", () => {
      // Authored, this was five by five of bare wool on open grass.
      for (
        let x = HARTHMERE_TROUGH_BOUNDS.x0;
        x <= HARTHMERE_TROUGH_BOUNDS.x1;
        x += 1
      ) {
        for (
          let z = HARTHMERE_TROUGH_BOUNDS.z0;
          z <= HARTHMERE_TROUGH_BOUNDS.z1;
          z += 1
        ) {
          const border =
            x === HARTHMERE_TROUGH_BOUNDS.x0 ||
            x === HARTHMERE_TROUGH_BOUNDS.x1 ||
            z === HARTHMERE_TROUGH_BOUNDS.z0 ||
            z === HARTHMERE_TROUGH_BOUNDS.z1;
          if (border) {
            assert.equal(harthmereStillWaterBlockAt(x, 1, z), "oakLumber");
            assert.equal(harthmereStillWaterLevelAt(x, 1, z), 0);
          } else {
            assert.equal(harthmereStillWaterLevelAt(x, 1, z), 15);
          }
        }
      }
    });
  });

  describe("the watermill race", () => {
    it("cuts a channel instead of painting the grass", () => {
      const b = HARTHMERE_MILL_RACE_BOUNDS;
      assert.equal(harthmereStillWaterCarvesAirAt(b.x0 + 1, 0, b.z0 + 1), true);
      assert.equal(harthmereStillWaterLevelAt(b.x0 + 1, 0, b.z0 + 1), 15);
      // The bank stays solid ground all the way round.
      for (let x = b.x0; x <= b.x1; x += 1) {
        for (const z of [b.z0, b.z1]) {
          assert.equal(harthmereStillWaterCarvesAirAt(x, 0, z), false);
          assert.equal(harthmereStillWaterLevelAt(x, 0, z), 0);
        }
      }
      for (let z = b.z0; z <= b.z1; z += 1) {
        for (const x of [b.x0, b.x1]) {
          assert.equal(harthmereStillWaterCarvesAirAt(x, 0, z), false);
          assert.equal(harthmereStillWaterLevelAt(x, 0, z), 0);
        }
      }
    });

    it("turns the wheel in the water rather than beside it", () => {
      // The authored patch straddled the mill's west wall, so half of it was
      // under the building and the wheel touched nothing. Every part of the
      // wheel's arc that is outside the mill must now stand over open water.
      const [wx, wz] = HARTHMERE_MILL_WHEEL_CENTRE;
      let outside = 0;
      let wet = 0;
      for (let x = wx - 6; x <= wx + 6; x += 1) {
        for (let z = wz - 6; z <= wz + 6; z += 1) {
          const d = Math.hypot(x - wx, z - wz);
          if (d < HARTHMERE_MILL_WHEEL_INNER_RADIUS) continue;
          if (d > HARTHMERE_MILL_WHEEL_OUTER_RADIUS) continue;
          if (x >= HARTHMERE_MILL_BUILDING_WEST_X) continue;
          outside += 1;
          if (harthmereStillWaterLevelAt(x, 0, z) === 15) wet += 1;
        }
      }
      assert.ok(outside >= 8, `only ${outside} arc voxels clear the mill`);
      // The two extreme columns at x = 373 sit on the race's east bank, which
      // is the strip between the water and the mill wall — the wheel's axle
      // side. Everything further out, which is the part that actually turns in
      // the race, must be over water.
      assert.ok(
        wet >= outside - 2,
        `${outside - wet} of the wheel's exposed arc is over dry land`
      );
      for (let x = wx - 6; x <= HARTHMERE_MILL_RACE_BOUNDS.x1 - 1; x += 1) {
        for (let z = wz - 6; z <= wz + 6; z += 1) {
          const d = Math.hypot(x - wx, z - wz);
          if (d < HARTHMERE_MILL_WHEEL_INNER_RADIUS) continue;
          if (d > HARTHMERE_MILL_WHEEL_OUTER_RADIUS) continue;
          assert.equal(
            harthmereStillWaterLevelAt(x, 0, z),
            15,
            `the wheel's working arc is dry at ${x},${z}`
          );
        }
      }
    });

    it("stops one voxel short of the mill's west wall", () => {
      assert.ok(
        HARTHMERE_MILL_RACE_BOUNDS.x1 < HARTHMERE_MILL_BUILDING_WEST_X,
        "the race runs under the mill building"
      );
    });

    // HARTHMERE_MILL_STRUCTURE: the race held water but read as a ditch.
    it("dresses the west bank and both ends", () => {
      const b = HARTHMERE_MILL_RACE_BOUNDS;
      for (let z = b.z0; z <= b.z1; z += 1) {
        assert.equal(
          harthmereStillWaterBlockAt(b.x0, HARTHMERE_MILL_BANK_TOP_REL_Y, z),
          "stoneBrick",
          `west bank is bare at z=${z}`
        );
      }
      for (let x = b.x0; x < b.x1; x += 1) {
        for (const z of [b.z0, b.z1]) {
          assert.equal(
            harthmereStillWaterBlockAt(x, HARTHMERE_MILL_BANK_TOP_REL_Y, z),
            "stoneBrick",
            `end wall is bare at ${x},${z}`
          );
        }
      }
    });

    it("leaves the mill bank bare so the wheel can turn", () => {
      const b = HARTHMERE_MILL_RACE_BOUNDS;
      const [cx, cz] = HARTHMERE_MILL_WHEEL_CENTRE;
      for (let z = b.z0; z <= b.z1; z += 1) {
        const withinArc =
          Math.hypot(b.x1 - cx, z - cz) <= HARTHMERE_MILL_WHEEL_OUTER_RADIUS;
        if (!withinArc) continue;
        for (
          let relY = 0;
          relY <= HARTHMERE_MILL_HOUSING_TOP_REL_Y;
          relY += 1
        ) {
          assert.equal(
            harthmereStillWaterBlockAt(b.x1, relY, z),
            undefined,
            `something stands inside the wheel arc at ${b.x1},${relY},${z}`
          );
        }
      }
    });

    it("flanks the wheel with housing posts", () => {
      const b = HARTHMERE_MILL_RACE_BOUNDS;
      for (const z of HARTHMERE_MILL_HOUSING_POST_Z) {
        for (
          let relY = 1;
          relY <= HARTHMERE_MILL_HOUSING_TOP_REL_Y;
          relY += 1
        ) {
          assert.equal(
            harthmereStillWaterBlockAt(b.x1, relY, z),
            "oakLumber",
            `no housing post at ${b.x1},${relY},${z}`
          );
        }
      }
    });
  });

  describe("seeder contract", () => {
    it("early-outs for shards nowhere near a feature", () => {
      assert.equal(
        harthmereStillWaterTouchesAuthoredSpan(700, 732, -100, -68),
        false
      );
      assert.equal(
        harthmereStillWaterTouchesAuthoredSpan(480, 511, -224, -193),
        true
      );
    });

    it("writes nothing outside its own footprints", () => {
      for (const [x, z] of [
        [300, -300],
        [486, -260],
        [520, -209],
        [374, -430],
      ] as const) {
        assert.equal(harthmereStillWaterFeatureAt(x, z), undefined);
        for (const y of [0, 1, 2, 3]) {
          assert.equal(harthmereStillWaterBlockAt(x, y, z), undefined);
          assert.equal(harthmereStillWaterLevelAt(x, y, z), 0);
          assert.equal(harthmereStillWaterCarvesAirAt(x, y, z), false);
        }
      }
    });
  });
});
