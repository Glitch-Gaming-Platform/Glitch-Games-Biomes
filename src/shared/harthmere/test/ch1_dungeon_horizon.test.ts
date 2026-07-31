/// <reference types="mocha" />
/// <reference types="node" />
//
// The horizon layer's whole job is to add scenery around a FINISHED dungeon
// without touching it. Most of this file is therefore about what the backdrop
// must NOT do.

import assert from "assert";
import {
  CH1_HORIZON_BUILDINGS,
  CH1_HORIZON_ERAS,
  ch1DistanceBeyondBoundary,
  ch1ExplicitNoise,
  ch1HorizonBlockAt,
  ch1HorizonBoundarySlabs,
  ch1HorizonBuildingsFor,
  ch1HorizonCoversColumn,
  ch1HorizonEra,
  ch1HorizonSurfaceY,
  ch1LinearBoundary,
  ch1PlayableBounds,
  ch1PointInsidePlayable,
  CH1_HORIZON_DRAW_DISTANCE,
  CH1_HORIZON_FADE_DISTANCE,
  ch1HorizonAuthoredExtent,
  ch1HorizonDistanceToNearestFace,
  ch1SeederBlockAt,
  ch1ValidateHorizon,
} from "../ch1_dungeon_horizon";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonBlockAt,
  ch1DungeonAuthoredToWorld,
  ch1DungeonTerrain,
} from "../ch1_dungeon_terrain";
import { CH1_DUNGEON_DECOR } from "../ch1_dungeon_decor";

describe("ch1 horizon - structure", () => {
  it("passes validation", () => {
    assert.deepEqual(ch1ValidateHorizon(), []);
  });

  it("authors an era for every dungeon", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      assert.ok(
        ch1HorizonEra(terrain.dungeonId),
        `${terrain.dungeonId} has no horizon era`
      );
    }
    assert.equal(CH1_HORIZON_ERAS.length, CH1_DUNGEON_TERRAIN.length);
  });

  it("gives each era its own art direction, not one shared look", () => {
    const [desert, winter] = CH1_HORIZON_ERAS;
    assert.notDeepEqual(desert.heightWeights, winter.heightWeights);
    assert.notDeepEqual(desert.boundaryColour, winter.boundaryColour);
    assert.notEqual(desert.heightSeed, winter.heightSeed);
    // The fjord must climb harder than the dunes swell; that contrast is the
    // point of having two eras at all.
    assert.ok(winter.heightAmplitude > desert.heightAmplitude);
  });

  it("keeps snow a three-voxel cap, never a drift", () => {
    // The shipped world puts exactly three snow over stone. A backdrop that
    // buries a mountain in snow reads as a different game.
    const winter = ch1HorizonEra("ch1_dungeon_winter")!;
    assert.equal(winter.cap?.material, "whiteWool");
    assert.equal(winter.cap?.depth, 3);
  });
});

// ---------------------------------------------------------------------------
// The safety property
// ---------------------------------------------------------------------------

describe("ch1 horizon - never touches the finished dungeon", () => {
  it("returns air for every position inside the playable box", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      for (const volume of terrain.volumes) {
        // Sample a spread through each room, including its shell.
        for (let x = volume.x0; x <= volume.x1; x += 7) {
          for (let z = volume.z0; z <= volume.z1; z += 7) {
            for (let y = volume.y0 - 1; y <= volume.y1 + 1; y += 3) {
              assert.equal(
                ch1HorizonBlockAt(terrain.dungeonId, x, y, z),
                undefined,
                `${terrain.dungeonId}: horizon wrote into ${volume.name} at ` +
                  `(${x}, ${y}, ${z}) — the backdrop must never overwrite a room`
              );
            }
          }
        }
      }
      assert.ok(
        ch1PointInsidePlayable(
          bounds,
          terrain.arrival.x,
          terrain.arrival.y,
          terrain.arrival.z
        )
      );
    }
  });

  it("leaves the dungeon's own voxels exactly as they were", () => {
    // Regression guard: importing the horizon must not perturb terrain output.
    const desert = ch1DungeonTerrain("ch1_dungeon_desert")!;
    const volume = desert.volumes.find((v) => v.name === "hall_of_weights")!;
    const midX = Math.floor((volume.x0 + volume.x1) / 2);
    assert.equal(
      ch1DungeonBlockAt("ch1_dungeon_desert", midX, volume.y0, volume.z0 + 4),
      volume.floor
    );
    assert.equal(
      ch1DungeonBlockAt("ch1_dungeon_desert", midX, volume.y0 + 2, volume.z0),
      volume.shell
    );
  });

  it("never places a backdrop building where the player can reach it", () => {
    for (const building of CH1_HORIZON_BUILDINGS) {
      const terrain = ch1DungeonTerrain(building.dungeonId)!;
      const bounds = ch1PlayableBounds(terrain);
      for (const [x, z] of [
        [building.x0, building.z0],
        [building.x1, building.z1],
      ]) {
        assert.ok(
          ch1DistanceBeyondBoundary(bounds, x, z) > 0,
          `${building.name} corner (${x}, ${z}) is reachable`
        );
      }
    }
  });

  it("does not collide with any authored decor prop", () => {
    for (const prop of CH1_DUNGEON_DECOR) {
      const localZ = -256 + prop.at.z;
      assert.equal(
        ch1HorizonBlockAt(prop.dungeonId, prop.at.x, prop.at.y, localZ),
        undefined,
        `${prop.id} would be buried by backdrop terrain`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The boundary
// ---------------------------------------------------------------------------

describe("ch1 horizon - boundary", () => {
  it("contains every authored room with margin to spare", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      for (const volume of terrain.volumes) {
        assert.ok(volume.x0 > bounds.x0 && volume.x1 < bounds.x1);
        assert.ok(volume.z0 > bounds.z0 && volume.z1 < bounds.z1);
      }
    }
  });

  it("synthesises no slabs while the player is inside", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const inside = ch1DungeonTerrain(terrain.dungeonId)!.arrival;
      const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, inside);
      // Use the arrival, converted, as a known-inside point.
      const slabs = ch1HorizonBoundarySlabs(terrain.dungeonId, [
        [world[0] - 0.4, world[1] - 0.4, world[2] - 0.4],
        [world[0] + 0.4, world[1] + 1.8, world[2] + 0.4],
      ]);
      assert.deepEqual(
        slabs,
        [],
        `${terrain.dungeonId}: a player standing at the arrival was blocked`
      );
    }
  });

  it("blocks every face around both dungeons, including floor and ceiling", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const min = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
        x: bounds.x0,
        y: bounds.y0,
        z: bounds.z0,
      });
      const max = ch1DungeonAuthoredToWorld(terrain.dungeonId, {
        x: bounds.x1,
        y: bounds.y1,
        z: bounds.z1,
      });
      const mid = [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      ] as const;
      const probes = [
        ["-X", [min[0] - 2, mid[1], mid[2]]],
        ["+X", [max[0] + 2, mid[1], mid[2]]],
        ["-Y", [mid[0], min[1] - 2, mid[2]]],
        ["+Y", [mid[0], max[1] + 2, mid[2]]],
        ["-Z", [mid[0], mid[1], min[2] - 2]],
        ["+Z", [mid[0], mid[1], max[2] + 2]],
      ] as const;

      for (const [face, point] of probes) {
        const slabs = ch1HorizonBoundarySlabs(terrain.dungeonId, [
          [point[0] - 0.4, point[1] - 0.4, point[2] - 0.4],
          [point[0] + 0.4, point[1] + 1.8, point[2] + 0.4],
        ]);
        assert.equal(
          slabs.length,
          1,
          `${terrain.dungeonId}: crossing ${face} must synthesise one slab`
        );
      }

      const corner = ch1HorizonBoundarySlabs(terrain.dungeonId, [
        [max[0] + 2, max[1] + 2, max[2] + 2],
        [max[0] + 3, max[1] + 3, max[2] + 3],
      ]);
      assert.equal(
        corner.length,
        3,
        `${terrain.dungeonId}: a corner must produce three overlapping slabs`
      );
    }
  });

  it("makes each slab as deep as the dungeon is wide", () => {
    // The point of the shifted-box trick: from the solver's view the region
    // beyond is effectively infinite, with no geometry allocated.
    // Z must be INSIDE the winter box, or this also crosses +Z and gets two
    // slabs. Winter rooms sit at world z -376..-312.
    const slabs = ch1HorizonBoundarySlabs("ch1_dungeon_winter", [
      [1e6, 64, -340],
      [1e6 + 1, 66, -339],
    ]);
    assert.equal(slabs.length, 1);
    const [lo, hi] = slabs[0];
    assert.ok(hi[0] - lo[0] > 100, "slab is too thin to block a fast mover");
  });

  it("returns nothing for an unknown dungeon rather than throwing", () => {
    assert.deepEqual(
      ch1HorizonBoundarySlabs("nope", [
        [0, 0, 0],
        [1, 1, 1],
      ]),
      []
    );
  });
});

// ---------------------------------------------------------------------------
// The backdrop reads as land
// ---------------------------------------------------------------------------

describe("ch1 horizon - backdrop terrain", () => {
  it("rises from the boundary instead of starting as a cliff", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const era = ch1HorizonEra(terrain.dungeonId)!;
      const x = Math.floor((bounds.x0 + bounds.x1) / 2);
      const atEdge = ch1HorizonSurfaceY(terrain.dungeonId, x, bounds.z0 - 1);
      const wellBeyond = ch1HorizonSurfaceY(
        terrain.dungeonId,
        x,
        bounds.z0 - era.featherRadius * 3
      );
      assert.ok(
        Math.abs(atEdge - era.baseY) <= 3,
        `${terrain.dungeonId}: the land is ${
          atEdge - era.baseY
        } high right at ` + `the boundary — that is a wall, not a horizon`
      );
      assert.ok(
        wellBeyond > atEdge + 4,
        `${terrain.dungeonId}: the backdrop never climbs (${atEdge} -> ${wellBeyond})`
      );
    }
  });

  it("is deterministic", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(
        ch1HorizonSurfaceY("ch1_dungeon_desert", 200, -180),
        ch1HorizonSurfaceY("ch1_dungeon_desert", 200, -180)
      );
      assert.equal(
        ch1HorizonBlockAt("ch1_dungeon_winter", 200, 4, -200),
        ch1HorizonBlockAt("ch1_dungeon_winter", 200, 4, -200)
      );
    }
  });

  it("puts solid ground under the surface and air above it", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const x = Math.floor((bounds.x0 + bounds.x1) / 2);
      // Just beyond the boundary and clear of every authored building — this
      // test is about open ground, and a roof is legitimately solid above the
      // terrain surface.
      const z = bounds.z0 - 34;
      assert.ok(
        !ch1HorizonBuildingsFor(terrain.dungeonId).some(
          (b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1
        ),
        "sample point drifted into a building; move it"
      );
      const surface = ch1HorizonSurfaceY(terrain.dungeonId, x, z);
      assert.ok(
        ch1HorizonBlockAt(terrain.dungeonId, x, surface, z) !== undefined,
        "the surface voxel must be solid"
      );
      assert.equal(
        ch1HorizonBlockAt(terrain.dungeonId, x, surface + 1, z),
        undefined,
        "the voxel above the surface must be air"
      );
      assert.ok(
        ch1HorizonBlockAt(terrain.dungeonId, x, surface - 8, z) !== undefined,
        "there must be ground under the ground"
      );
    }
  });

  it("varies topsoil smoothly rather than per-column", () => {
    // Sample the surface material along a line; it should change, but not on
    // every single step — that is the difference between strata and static.
    const era = ch1HorizonEra("ch1_dungeon_desert")!;
    assert.ok(era.columns.length >= 2, "one column is not variation");
    let changes = 0;
    let previous: string | undefined;
    for (let z = -240; z < -140; z += 2) {
      const surface = ch1HorizonSurfaceY("ch1_dungeon_desert", 260, z);
      const material = ch1HorizonBlockAt(
        "ch1_dungeon_desert",
        260,
        surface - 3,
        z
      );
      if (previous !== undefined && material !== previous) {
        changes++;
      }
      previous = material as string;
    }
    assert.ok(changes < 20, `topsoil changed ${changes} times — that is noise`);
  });

  it("covers the region beyond the boundary and nothing inside it", () => {
    const terrain = ch1DungeonTerrain("ch1_dungeon_desert")!;
    const bounds = ch1PlayableBounds(terrain);
    assert.equal(ch1HorizonCoversColumn("ch1_dungeon_desert", 260, -180), true);
    const midZ = Math.floor((bounds.z0 + bounds.z1) / 2);
    assert.equal(
      ch1HorizonCoversColumn("ch1_dungeon_desert", 260, midZ),
      false
    );
  });
});

describe("ch1 horizon - backdrop buildings", () => {
  it("gives both settlements a skyline", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const buildings = ch1HorizonBuildingsFor(terrain.dungeonId);
      assert.ok(
        buildings.length >= 4,
        `${terrain.dungeonId}: ${buildings.length} buildings is not a settlement`
      );
      assert.ok(
        buildings.some((b) => b.height >= 24),
        `${terrain.dungeonId}: needs one tall silhouette to anchor the horizon`
      );
    }
  });

  it("actually stamps a building into the world", () => {
    const ziggurat = CH1_HORIZON_BUILDINGS.find(
      (b) => b.name === "great_ziggurat"
    )!;
    const x = Math.floor((ziggurat.x0 + ziggurat.x1) / 2);
    const z = Math.floor((ziggurat.z0 + ziggurat.z1) / 2);
    const surface = ch1HorizonSurfaceY(ziggurat.dungeonId, x, z);
    const wall = ch1HorizonBlockAt(ziggurat.dungeonId, x, surface + 4, z);
    assert.ok(wall !== undefined, "the ziggurat is not solid");
    // And it must be taller than the ground beside it.
    const asideSurface = ch1HorizonSurfaceY(
      ziggurat.dungeonId,
      ziggurat.x0 - 20,
      z
    );
    assert.ok(
      surface + ziggurat.height > asideSurface,
      "the ziggurat does not rise above its surroundings"
    );
  });

  it("steps tiered buildings instead of extruding a slab", () => {
    const ziggurat = CH1_HORIZON_BUILDINGS.find(
      (b) => b.name === "great_ziggurat"
    )!;
    assert.ok((ziggurat.tiers ?? 1) >= 3);
    const cx = Math.floor((ziggurat.x0 + ziggurat.x1) / 2);
    const cz = Math.floor((ziggurat.z0 + ziggurat.z1) / 2);
    const edgeX = ziggurat.x0 + 1;
    const centreSurface = ch1HorizonSurfaceY(ziggurat.dungeonId, cx, cz);
    const highUp = centreSurface + ziggurat.height - 1;
    // High up, the centre is solid but the outer edge is open sky.
    assert.ok(
      ch1HorizonBlockAt(ziggurat.dungeonId, cx, highUp, cz) !== undefined,
      "the ziggurat centre should reach full height"
    );
    assert.equal(
      ch1HorizonBlockAt(ziggurat.dungeonId, edgeX, highUp, cz),
      undefined,
      "the outer tier should stop short — otherwise it is a box"
    );
  });
});

// ---------------------------------------------------------------------------
// Noise primitives
// ---------------------------------------------------------------------------

describe("ch1 horizon - noise", () => {
  it("is reproducible per named seed and different across seeds", () => {
    const a = ch1ExplicitNoise("dunes", 12, 34, 128, [4, 2, 1]);
    assert.equal(a, ch1ExplicitNoise("dunes", 12, 34, 128, [4, 2, 1]));
    assert.notEqual(a, ch1ExplicitNoise("fjord", 12, 34, 128, [4, 2, 1]));
  });

  it("is coherent, not white noise", () => {
    // Neighbouring samples must be close; that is what makes it terrain.
    let maxJump = 0;
    let previous = ch1ExplicitNoise("coherence", 0, 0, 128, [8]);
    for (let x = 1; x < 60; x++) {
      const value = ch1ExplicitNoise("coherence", x, 0, 128, [8]);
      maxJump = Math.max(maxJump, Math.abs(value - previous));
      previous = value;
    }
    assert.ok(maxJump < 2.0, `noise jumped ${maxJump} between adjacent voxels`);
  });

  it("feathers linearly from 0 at the edge to 1 at the radius", () => {
    assert.equal(ch1LinearBoundary(0, 40), 0);
    assert.equal(ch1LinearBoundary(20, 40), 0.5);
    assert.equal(ch1LinearBoundary(40, 40), 1);
    assert.equal(ch1LinearBoundary(999, 40), 1);
    assert.equal(ch1LinearBoundary(10, 0), 1);
  });

  it("measures distance beyond the boundary with the right sign", () => {
    const box = { x0: 0, x1: 100, y0: 0, y1: 10, z0: 0, z1: 100 };
    assert.ok(ch1DistanceBeyondBoundary(box, 50, 50) < 0, "inside is negative");
    assert.equal(ch1DistanceBeyondBoundary(box, 110, 50), 10);
    assert.ok(
      ch1DistanceBeyondBoundary(box, 110, 110) > 14,
      "corners are diagonal"
    );
  });
});

// ---------------------------------------------------------------------------
// Boundary visual maths (the shader itself needs a GL context; this does not)
// ---------------------------------------------------------------------------

describe("ch1 horizon - boundary cull maths", () => {
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [100, 40, 100];

  it("returns the distance to the nearest face from inside", () => {
    assert.equal(ch1HorizonDistanceToNearestFace([50, 20, 50], min, max), 20);
    assert.equal(ch1HorizonDistanceToNearestFace([2, 20, 50], min, max), 2);
    assert.equal(ch1HorizonDistanceToNearestFace([50, 39, 50], min, max), 1);
  });

  it("goes negative once the player is outside", () => {
    assert.ok(ch1HorizonDistanceToNearestFace([-5, 20, 50], min, max) < 0);
  });

  it("pops the wall in while it is still fully transparent", () => {
    // Draw threshold must sit inside the shader's fade distance, or the box
    // appears by snapping to visible instead of fading up.
    assert.ok(CH1_HORIZON_DRAW_DISTANCE < CH1_HORIZON_FADE_DISTANCE);
  });
});

// ---------------------------------------------------------------------------
// Seeder integration
// ---------------------------------------------------------------------------

describe("ch1 horizon - seeder composition", () => {
  it("always lets the dungeon win a contested voxel", () => {
    const desert = ch1DungeonTerrain("ch1_dungeon_desert")!;
    const volume = desert.volumes.find((v) => v.name === "salt_market")!;
    const x = Math.floor((volume.x0 + volume.x1) / 2);
    const dungeonBlock = ch1DungeonBlockAt(
      "ch1_dungeon_desert",
      x,
      volume.y0,
      volume.z0 + 4
    );
    assert.ok(dungeonBlock, "precondition: the dungeon owns this voxel");
    assert.equal(
      ch1SeederBlockAt(
        "ch1_dungeon_desert",
        x,
        volume.y0,
        volume.z0 + 4,
        dungeonBlock
      ),
      dungeonBlock,
      "the horizon must never override a dungeon voxel"
    );
  });

  it("fills backdrop ground where the dungeon has nothing to say", () => {
    const terrain = ch1DungeonTerrain("ch1_dungeon_desert")!;
    const bounds = ch1PlayableBounds(terrain);
    const x = Math.floor((bounds.x0 + bounds.x1) / 2);
    const z = bounds.z0 - 60;
    const surface = ch1HorizonSurfaceY("ch1_dungeon_desert", x, z);
    assert.equal(
      ch1DungeonBlockAt("ch1_dungeon_desert", x, surface, z),
      undefined,
      "precondition: the dungeon owns nothing out here"
    );
    assert.ok(
      ch1SeederBlockAt("ch1_dungeon_desert", x, surface, z, undefined) !==
        undefined,
      "the backdrop should fill the horizon"
    );
  });

  it("bounds the seeding work instead of walking the whole slot", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const extent = ch1HorizonAuthoredExtent(terrain.dungeonId)!;
      assert.ok(extent, `${terrain.dungeonId} has no authored extent`);
      const bounds = ch1PlayableBounds(terrain);
      assert.ok(extent.x0 < bounds.x0 && extent.x1 > bounds.x1);
      assert.ok(extent.z0 < bounds.z0 && extent.z1 > bounds.z1);
      // Every skyline building must fall inside the seeded extent, or it
      // simply would not be generated.
      for (const building of ch1HorizonBuildingsFor(terrain.dungeonId)) {
        assert.ok(
          building.x0 >= extent.x0 &&
            building.x1 <= extent.x1 &&
            building.z0 >= extent.z0 &&
            building.z1 <= extent.z1,
          `${building.name} is outside the seeded extent and would never appear`
        );
      }
    }
  });
});
