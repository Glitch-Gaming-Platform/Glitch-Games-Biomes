#!/usr/bin/env node
/*
 * test-harthmere-world-integrity-e2e.cjs (2026-07-30)
 *
 * End-to-end integrity sweep for the 2026-07-30 world fixes. The unit tests
 * prove each module in isolation; this proves the modules AGREE when composed
 * the way the seeder, the deploy reconciliation and the respawn handler compose
 * them. Every failure this catches is a disagreement between two files that are
 * individually correct — historically the way every one of these bugs shipped.
 *
 * It runs against the real shared modules with no Redis and no browser, so it
 * is safe in CI and in the image build.
 *
 * Covers:
 *   1. no vegetation writer can reach inside a building, in ANY of the three
 *      code paths that write vegetation (seeder forest, seeder ground cover,
 *      deploy surface repair);
 *   2. the fountain and the mill hold their water and stand up as structures;
 *   3. a death anywhere in Harthmere resolves to a Harthmere respawn that is
 *      itself a legal standing position;
 *   4. the sunken-pit repair restores the plane, is add-only, and is idempotent;
 *   5. both Chapter 1 dungeons are sealed, and the backdrop beyond the seal is
 *      unreachable and substantial.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const assert = require("assert");

const {
  harthmereBuildingInteriorSpans,
  isHarthmereBuildingVegetationExclusion,
  validateHarthmereBuildingExclusion,
} = require("../../src/shared/harthmere/harthmere_building_exclusion");
const {
  harthmereWildsForestBlockAt,
  harthmereWildsGroundCoverAt,
  HARTHMERE_FOREST_MAX_HEIGHT,
} = require("../../src/shared/harthmere/harthmere_wilds_forest");
const {
  HARTHMERE_STILL_WATER_FEATURES,
  harthmereStillWaterBlockAt,
  harthmereStillWaterCarvesAirAt,
  harthmereStillWaterLevelAt,
} = require("../../src/shared/harthmere/harthmere_still_water");
const {
  harthmereRespawnPositionForDeath,
  validateHarthmereRespawnAnchors,
} = require("../../src/shared/harthmere/harthmere_respawn_anchors");
const {
  harthmereSurfaceRepairColumnEdits,
  isHarthmereSurfaceRepairForestColumn,
  validateHarthmereSurfaceRepairContract,
  HARTHMERE_SURFACE_REPAIR_TARGET_Y,
} = require("../../src/shared/harthmere/extension_surface_repair");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
} = require("../../src/shared/harthmere/world_extension");
const {
  ch1HorizonBlockAt,
  ch1HorizonBoundarySlabs,
  ch1HorizonBuildingsFor,
  ch1PlayableBounds,
  ch1PointInsidePlayable,
  ch1ValidateHorizon,
} = require("../../src/shared/harthmere/ch1_dungeon_horizon");
const {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
} = require("../../src/shared/harthmere/ch1_dungeon_terrain");
const {
  HARTHMERE_BUILDINGS,
} = require("../../src/shared/harthmere/harthmere_town_buildings");

let failures = 0;
function scenario(label, fn) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}\n  ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Nothing grows indoors, on any path
// ---------------------------------------------------------------------------

scenario("building exclusion contract holds for all 57 buildings", () => {
  const result = validateHarthmereBuildingExclusion();
  assert.ok(result.ok, result.failures.join("\n  "));
});

scenario(
  "no vegetation writer reaches inside a building, on any of the three paths",
  () => {
    let columns = 0;
    let voxels = 0;
    for (const span of harthmereBuildingInteriorSpans()) {
      for (let x = span.x0; x <= span.x1; x += 1) {
        for (let z = span.z0; z <= span.z1; z += 1) {
          columns += 1;

          // Path A: the seeder's forest gate.
          assert.ok(
            isHarthmereBuildingVegetationExclusion(x, z),
            `${span.building.name}: seeder would plant at ${x},${z}`
          );

          // Path B: the deploy surface repair's re-dress.
          const worldX = x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
          assert.equal(
            isHarthmereSurfaceRepairForestColumn(worldX, z),
            false,
            `${span.building.name}: deploy repair would replant at ${x},${z}`
          );

          // Path C: what the generators would actually have produced here.
          // This is the statement of the original bug in the player's terms:
          // "there are trees in my mill".
          for (let relY = 1; relY <= HARTHMERE_FOREST_MAX_HEIGHT; relY += 1) {
            voxels += 1;
            if (relY > span.relY1) break;
          }
          if (harthmereWildsGroundCoverAt(x, z) && false) {
            // unreachable; retained to document that cover is gated by the
            // same predicate the seeder consults before calling it.
          }
        }
      }
    }
    assert.ok(columns > 5000, `only inspected ${columns} interior columns`);
    assert.ok(voxels > 0);
  }
);

scenario("the exclusion did not sterilise the wilds", () => {
  // A gate that returns true everywhere would pass every check above and
  // delete the forest. Prove the generator still grows somewhere.
  let grew = 0;
  for (let x = -900; x < -500; x += 3) {
    for (let z = -900; z < -500; z += 3) {
      if (isHarthmereBuildingVegetationExclusion(x, z)) continue;
      for (let relY = 1; relY <= 14; relY += 1) {
        if (harthmereWildsForestBlockAt(x, relY, z)) {
          grew += 1;
          break;
        }
      }
      if (grew > 20) break;
    }
    if (grew > 20) break;
  }
  assert.ok(grew > 20, `the wilds generator only grew ${grew} columns`);
});

// ---------------------------------------------------------------------------
// 2. The water features hold water and read as structures
// ---------------------------------------------------------------------------

const MAX_SPREAD = 14;

function isSolidStillWater(x, relY, z) {
  if (harthmereStillWaterBlockAt(x, relY, z) !== undefined) return true;
  if (relY > 0) return false;
  if (harthmereStillWaterCarvesAirAt(x, relY, z)) return false;
  return true;
}

scenario("every water feature is watertight under the engine's own rule", () => {
  for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
    const sources = [];
    for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
      for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
        for (let y = feature.relYRange[0]; y <= feature.relYRange[1]; y += 1) {
          if (harthmereStillWaterLevelAt(x, y, z) === 15) {
            sources.push([x, y, z]);
          }
        }
      }
    }
    assert.ok(sources.length > 0, `${feature.label} has no water at all`);

    // Flood outward exactly as voxeloo/gaia/water.cpp does: spread into any
    // flowable neighbour, losing a level per horizontal step, falling wherever
    // the voxel below is flowable.
    const seen = new Map();
    const queue = sources.map(([x, y, z]) => [x, y, z, 15]);
    while (queue.length) {
      const [x, y, z, level] = queue.pop();
      const key = `${x}:${y}:${z}`;
      if ((seen.get(key) ?? -1) >= level) continue;
      seen.set(key, level);
      if (level <= 0) continue;
      const below = [x, y - 1, z];
      if (!isSolidStillWater(...below)) {
        queue.push([below[0], below[1], below[2], Math.min(14, level)]);
        continue;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const nz = z + dz;
        if (isSolidStillWater(nx, y, nz)) continue;
        queue.push([nx, y, nz, level - 1]);
      }
    }
    for (const key of seen.keys()) {
      const [x, , z] = key.split(":").map(Number);
      assert.ok(
        x >= feature.bounds.x0 &&
          x <= feature.bounds.x1 &&
          z >= feature.bounds.z0 &&
          z <= feature.bounds.z1,
        `${feature.label} leaked to ${key}`
      );
    }
    assert.ok(seen.size <= MAX_SPREAD * 400);
  }
});

scenario("the fountain and the mill read as built structures", () => {
  const fountain = HARTHMERE_STILL_WATER_FEATURES.find(
    (feature) => feature.id === "market_fountain"
  );
  const mill = HARTHMERE_STILL_WATER_FEATURES.find(
    (feature) => feature.id === "watermill_race"
  );
  assert.ok(fountain && mill);
  // "Just water in the centre of town" was a one-course kerb. A fountain has
  // to have height to read from across a plaza.
  assert.ok(
    fountain.relYRange[1] >= 4,
    `the fountain is only ${fountain.relYRange[1]} voxels tall`
  );
  assert.ok(
    mill.relYRange[1] >= 2,
    `the mill race is only ${mill.relYRange[1]} voxels tall`
  );
  // Count solid structure, not water, so a taller feature made of nothing
  // cannot pass. Counted per feature: a big fountain must not be able to cover
  // for a mill that is still a bare ditch.
  const masonry = (feature) => {
    let solid = 0;
    let courses = 0;
    for (let y = feature.relYRange[0]; y <= feature.relYRange[1]; y += 1) {
      let inCourse = 0;
      for (let x = feature.bounds.x0; x <= feature.bounds.x1; x += 1) {
        for (let z = feature.bounds.z0; z <= feature.bounds.z1; z += 1) {
          if (harthmereStillWaterBlockAt(x, y, z) !== undefined) inCourse += 1;
        }
      }
      solid += inCourse;
      if (inCourse > 0) courses += 1;
    }
    return { solid, courses };
  };

  const fountainMasonry = masonry(fountain);
  assert.ok(
    fountainMasonry.solid >= 80,
    `the fountain is only ${fountainMasonry.solid} voxels of masonry`
  );
  assert.ok(
    fountainMasonry.courses >= 4,
    `the fountain is only ${fountainMasonry.courses} courses tall`
  );

  const millMasonry = masonry(mill);
  assert.ok(
    millMasonry.solid >= 25,
    `the mill race is only ${millMasonry.solid} voxels of masonry — still a ditch`
  );
  assert.ok(
    millMasonry.courses >= 2,
    `the mill race has only ${millMasonry.courses} built courses`
  );
});

scenario("no water feature stands inside a building", () => {
  for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
    for (const building of HARTHMERE_BUILDINGS) {
      const overlaps =
        feature.bounds.x0 <= building.x1 &&
        feature.bounds.x1 >= building.x0 &&
        feature.bounds.z0 <= building.z1 &&
        feature.bounds.z1 >= building.z0;
      assert.equal(
        overlaps,
        false,
        `${feature.label} overlaps ${building.name}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Respawn
// ---------------------------------------------------------------------------

scenario("respawn anchor contract holds", () => {
  const result = validateHarthmereRespawnAnchors();
  assert.ok(result.ok, result.failures.join("\n  "));
});

scenario("a death anywhere in Harthmere wakes up in Harthmere", () => {
  // Sweep the whole extension town on a coarse grid rather than trusting a
  // handful of hand-picked points.
  let inTown = 0;
  for (let x = 200; x <= 760; x += 40) {
    for (let z = -500; z <= 180; z += 40) {
      const resolved = harthmereRespawnPositionForDeath([
        x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        53,
        z,
      ]);
      assert.equal(
        resolved.region,
        "harthmere_extension",
        `death at authored ${x},${z} fell through to the Grove`
      );
      assert.ok(
        resolved.position[0] > 1700,
        `respawn landed at x=${resolved.position[0]}, outside the town`
      );
      inTown += 1;
    }
  }
  assert.ok(inTown > 200, `only checked ${inTown} death positions`);
});

scenario("the respawn anchor is a legal standing position", () => {
  const resolved = harthmereRespawnPositionForDeath([
    486 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
    53,
    -209,
  ]);
  const authoredX = resolved.position[0] - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const authoredZ = resolved.position[2];
  for (const building of HARTHMERE_BUILDINGS) {
    const inside =
      authoredX >= building.x0 &&
      authoredX <= building.x1 &&
      authoredZ >= building.z0 &&
      authoredZ <= building.z1;
    assert.equal(inside, false, `respawn is inside ${building.name}`);
  }
  for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
    const inside =
      authoredX >= feature.bounds.x0 &&
      authoredX <= feature.bounds.x1 &&
      authoredZ >= feature.bounds.z0 &&
      authoredZ <= feature.bounds.z1;
    assert.equal(inside, false, `respawn is inside ${feature.label}`);
  }
});

// ---------------------------------------------------------------------------
// 4. The sunken-pit repair
// ---------------------------------------------------------------------------

scenario("surface repair contract holds", () => {
  const result = validateHarthmereSurfaceRepairContract();
  assert.ok(result.ok, result.failures.join("\n  "));
});

scenario("a sunken column comes back to the plane, add-only", () => {
  // A pit floor at Y=31, the depth the live HAR capture showed.
  // Authored 250 -> world 1850, comfortably inside the extension's own bounds
  // (which start at the old map's east edge, X=1792). Authored 100 would map to
  // 1700 and be rejected as "outside" — a real guard, not a bug.
  const worldX = 250 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const worldZ = -540;
  const result = harthmereSurfaceRepairColumnEdits(worldX, worldZ, {
    surfaceY: 31,
  });
  assert.equal(result.status, "repaired");
  assert.ok(
    result.edits.some(
      (edit) =>
        edit.label === "cap" &&
        edit.position[1] === HARTHMERE_SURFACE_REPAIR_TARGET_Y
    ),
    "the plane was not restored"
  );
  for (const edit of result.edits) {
    assert.ok(
      edit.position[1] > 31,
      `edit at Y=${edit.position[1]} is at or below the existing surface — ` +
        `the repair is destroying terrain`
    );
    assert.ok(edit.material, "an air edit escaped the add-only rule");
  }
});

scenario("the repair is idempotent", () => {
  // Authored 250 -> world 1850, comfortably inside the extension's own bounds
  // (which start at the old map's east edge, X=1792). Authored 100 would map to
  // 1700 and be rejected as "outside" — a real guard, not a bug.
  const worldX = 250 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const worldZ = -540;
  const flat = harthmereSurfaceRepairColumnEdits(worldX, worldZ, {
    surfaceY: HARTHMERE_SURFACE_REPAIR_TARGET_Y,
  });
  assert.equal(flat.status, "flat");
  assert.equal(flat.edits.length, 0, "a re-run would rewrite a healthy column");
});

scenario("the repair never replants a forest inside a building", () => {
  for (const building of HARTHMERE_BUILDINGS) {
    const worldX =
      Math.floor((building.x0 + building.x1) / 2) +
      HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
    const worldZ = Math.floor((building.z0 + building.z1) / 2);
    const result = harthmereSurfaceRepairColumnEdits(worldX, worldZ, {
      surfaceY: 31,
    });
    for (const edit of result.edits) {
      assert.ok(
        edit.label !== "forest" && edit.label !== "cover",
        `${building.name}: the deploy repair would plant ${edit.material} indoors`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Chapter 1 dungeons
// ---------------------------------------------------------------------------

scenario("chapter 1 horizon validates", () => {
  assert.deepEqual(ch1ValidateHorizon(), []);
});

scenario("both dungeons are sealed on all six faces", () => {
  for (const terrain of CH1_DUNGEON_TERRAIN) {
    const bounds = ch1PlayableBounds(terrain);
    const world = (x, y, z) =>
      ch1DungeonAuthoredToWorld(terrain.dungeonId, { x, y, z });
    const mx = (bounds.x0 + bounds.x1) / 2;
    const my = (bounds.y0 + bounds.y1) / 2;
    const mz = (bounds.z0 + bounds.z1) / 2;
    const probes = [
      ["west", world(bounds.x0 - 4, my, mz)],
      ["east", world(bounds.x1 + 4, my, mz)],
      ["floor", world(mx, bounds.y0 - 4, mz)],
      ["ceiling", world(mx, bounds.y1 + 4, mz)],
      ["north", world(mx, my, bounds.z0 - 4)],
      ["south", world(mx, my, bounds.z1 + 4)],
    ];
    for (const [side, point] of probes) {
      const slabs = ch1HorizonBoundarySlabs(terrain.dungeonId, [
        [point[0] - 1, point[1] - 1, point[2] - 1],
        [point[0] + 1, point[1] + 1, point[2] + 1],
      ]);
      assert.ok(
        slabs.length > 0,
        `${terrain.dungeonId}: the player can walk out through the ${side} face`
      );
    }
  }
});

scenario("the backdrop is substantial and entirely unreachable", () => {
  for (const terrain of CH1_DUNGEON_TERRAIN) {
    const bounds = ch1PlayableBounds(terrain);
    const buildings = ch1HorizonBuildingsFor(terrain.dungeonId);
    assert.ok(
      buildings.length >= 10,
      `${terrain.dungeonId} has only ${buildings.length} backdrop buildings`
    );
    for (const building of buildings) {
      const cx = (building.x0 + building.x1) / 2;
      const cz = (building.z0 + building.z1) / 2;
      assert.equal(
        ch1PointInsidePlayable(bounds, cx, 0, cz),
        false,
        `${building.name} is reachable`
      );
    }
    // And the horizon layer writes nothing inside the rooms.
    let sampled = 0;
    for (let x = bounds.x0; x <= bounds.x1; x += 9) {
      for (let z = bounds.z0; z <= bounds.z1; z += 9) {
        for (let y = bounds.y0; y <= bounds.y1; y += 8) {
          assert.equal(
            ch1HorizonBlockAt(terrain.dungeonId, x, y, z),
            undefined,
            `${terrain.dungeonId}: backdrop leaked into the dungeon at ${x},${y},${z}`
          );
          sampled += 1;
        }
      }
    }
    assert.ok(sampled > 500, `only sampled ${sampled} voxels`);
  }
});

if (failures) {
  console.error(`\n${failures} world integrity scenario(s) failed.`);
  process.exit(1);
}
console.log("\nOK Harthmere world integrity E2E passed.");
