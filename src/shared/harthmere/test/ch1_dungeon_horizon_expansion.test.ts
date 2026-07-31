/// <reference types="mocha" />
/// <reference types="node" />
//
// CH1_HORIZON_SECOND_PASS (2026-07-30).
//
// The first horizon pass proved the mechanism; each dungeon still read as a
// strip with a few silhouettes behind it, thin on three sides and empty on the
// fourth. This pass adds land and buildings on every side.
//
// The companion file `ch1_dungeon_horizon.test.ts` already proves the safety
// properties (the backdrop never overwrites a room, never becomes reachable,
// the boundary holds). This file proves the ENHANCEMENT actually happened and
// cannot be quietly undone: enough land past the wall to fill the view, a
// skyline on all four sides of both dungeons, and no reachable geometry added.

import assert from "assert";
import {
  CH1_HORIZON_BUILDINGS,
  CH1_HORIZON_DRAW_DISTANCE,
  CH1_HORIZON_FADE_DISTANCE,
  CH1_HORIZON_MIN_REACH,
  ch1DistanceBeyondBoundary,
  ch1HorizonAuthoredExtent,
  ch1HorizonBlockAt,
  ch1HorizonBoundarySlabs,
  ch1HorizonBuildingsFor,
  ch1HorizonEra,
  ch1PlayableBounds,
  ch1PointInsidePlayable,
  ch1ValidateHorizon,
} from "../ch1_dungeon_horizon";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
} from "../ch1_dungeon_terrain";
import { ch1ElsewhenSlot } from "../ch1_elsewhen_region";

/** Names shipped by the first pass. Everything else is this pass's work. */
const FIRST_PASS = new Set([
  "upper_city_terraces",
  "great_ziggurat",
  "north_granary_row",
  "south_kilns",
  "far_city_wall",
  "upper_longhouse_row",
  "stave_hall",
  "boat_sheds",
  "far_headland_cairns",
]);

const SECOND_PASS = CH1_HORIZON_BUILDINGS.filter(
  (building) => !FIRST_PASS.has(building.name)
);

describe("ch1 horizon expansion", () => {
  it("still passes the full horizon validation", () => {
    assert.deepEqual(ch1ValidateHorizon(), []);
  });

  it("adds a substantial amount of new skyline", () => {
    assert.ok(
      SECOND_PASS.length >= 12,
      `only ${SECOND_PASS.length} new backdrop buildings`
    );
    // Both dungeons get their share; a pass that only enriched one would leave
    // the other reading exactly as it did before.
    for (const dungeonId of ["ch1_dungeon_desert", "ch1_dungeon_winter"]) {
      const added = SECOND_PASS.filter(
        (building) => building.dungeonId === dungeonId
      );
      assert.ok(added.length >= 6, `${dungeonId} only gained ${added.length}`);
    }
  });

  it("gives every dungeon a skyline on every side that has room for one", () => {
    // Both dungeons are long east-west strips that nearly fill their slot's X
    // range (desert playable x 34..510 of an authored 0..511), so there is
    // physically no room for a building strictly east of the boundary. Asking
    // for one would be asking for a building outside the Elsewhen slot. So the
    // requirement is room-aware: a side with space must be used.
    const ROOM_NEEDED = 40;
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const buildings = ch1HorizonBuildingsFor(terrain.dungeonId);
      const sides: ReadonlyArray<[string, number, boolean]> = [
        ["west", bounds.x0 - 0, buildings.some((b) => b.x1 < bounds.x0)],
        ["east", 511 - bounds.x1, buildings.some((b) => b.x0 > bounds.x1)],
        ["north", bounds.z0 + 256, buildings.some((b) => b.z1 < bounds.z0)],
        ["south", 255 - bounds.z1, buildings.some((b) => b.z0 > bounds.z1)],
      ];
      for (const [side, room, present] of sides) {
        if (room < ROOM_NEEDED) continue;
        assert.ok(
          present,
          `${terrain.dungeonId} has ${room} voxels of room to the ${side} and ` +
            `no backdrop there — the world visibly ends on that side`
        );
      }
      // And the skyline must SPAN the dungeon rather than clustering at one
      // end, which is what made the first pass read as a few props.
      const spanMin = Math.min(...buildings.map((b) => b.x0));
      const spanMax = Math.max(...buildings.map((b) => b.x1));
      assert.ok(
        spanMin < 60 && spanMax > 450,
        `${terrain.dungeonId} skyline only spans x ${spanMin}..${spanMax}`
      );
    }
  });

  it("reaches far enough past the wall to fill the view", () => {
    // The boundary wall fades in at CH1_HORIZON_FADE_DISTANCE and is nearly
    // opaque a few voxels from it. Land that stopped inside that radius would
    // let the player watch the world end through a translucent wall.
    assert.ok(
      CH1_HORIZON_MIN_REACH > CH1_HORIZON_FADE_DISTANCE,
      "the backdrop stops before the boundary wall even becomes visible"
    );
    assert.ok(CH1_HORIZON_MIN_REACH > CH1_HORIZON_DRAW_DISTANCE);
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const extent = ch1HorizonAuthoredExtent(terrain.dungeonId);
      assert.ok(extent, `${terrain.dungeonId} has no backdrop extent`);
      for (const [side, gap] of [
        ["west", bounds.x0 - extent!.x0],
        ["east", extent!.x1 - bounds.x1],
        ["north", bounds.z0 - extent!.z0],
        ["south", extent!.z1 - bounds.z1],
      ] as ReadonlyArray<[string, number]>) {
        assert.ok(
          gap >= CH1_HORIZON_FADE_DISTANCE,
          `${terrain.dungeonId}: only ${gap} voxels of land to the ${side}`
        );
      }
    }
  });

  it("keeps every new building beyond the boundary and inside its slot", () => {
    for (const building of SECOND_PASS) {
      const terrain = CH1_DUNGEON_TERRAIN.find(
        (candidate) => candidate.dungeonId === building.dungeonId
      );
      assert.ok(terrain, `${building.name} names an unknown dungeon`);
      const bounds = ch1PlayableBounds(terrain!);
      const slot = ch1ElsewhenSlot(building.dungeonId);
      assert.ok(slot);
      for (const [x, z] of [
        [building.x0, building.z0],
        [building.x1, building.z1],
        [building.x0, building.z1],
        [building.x1, building.z0],
      ]) {
        assert.ok(
          ch1DistanceBeyondBoundary(bounds, x, z) > 0,
          `${building.name} corner (${x}, ${z}) is reachable`
        );
        const world = ch1DungeonAuthoredToWorld(building.dungeonId, {
          x,
          y: 0,
          z,
        });
        assert.ok(
          world[0] >= slot!.minX && world[0] < slot!.maxX,
          `${building.name} escapes its Elsewhen slot at x=${world[0]}`
        );
      }
      assert.ok(building.height > 0, `${building.name} has no height`);
      assert.ok(
        building.note.length > 20,
        `${building.name} has no lore note — backdrop that invents buildings ` +
          `is scenery, not a place`
      );
    }
  });

  it("adds nothing the player can walk into", () => {
    // The strongest statement of "additive only": sample the whole playable
    // box of both dungeons and assert the horizon layer is silent everywhere
    // inside it, including the new buildings' Y range.
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      let sampled = 0;
      for (let x = bounds.x0; x <= bounds.x1; x += 7) {
        for (let z = bounds.z0; z <= bounds.z1; z += 7) {
          for (let y = bounds.y0; y <= bounds.y1; y += 6) {
            assert.equal(
              ch1HorizonBlockAt(terrain.dungeonId, x, y, z),
              undefined,
              `${terrain.dungeonId}: horizon wrote inside the playable box at ${x},${y},${z}`
            );
            sampled += 1;
          }
        }
      }
      assert.ok(sampled > 2000, `only sampled ${sampled} voxels`);
    }
  });

  it("leaves the authored dungeon output untouched", () => {
    // The dungeon's own generator must be unaffected by anything here. Sample
    // it directly; if a horizon edit had leaked into shared state this changes.
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      let solid = 0;
      for (const volume of terrain.volumes) {
        for (let x = volume.x0; x <= volume.x1; x += 5) {
          for (let z = volume.z0; z <= volume.z1; z += 5) {
            for (let y = volume.y0; y <= volume.y1; y += 4) {
              if (ch1DungeonBlockAt(terrain.dungeonId, x, y, z)) {
                solid += 1;
              }
            }
          }
        }
      }
      assert.ok(
        solid > 100,
        `${terrain.dungeonId} generated only ${solid} solid voxels — the ` +
          `dungeon itself has been damaged`
      );
    }
  });

  it("keeps the boundary sealed on all six faces", () => {
    // `ch1HorizonBoundarySlabs` takes a dungeon id and a WORLD-space AABB, so
    // the probes are converted rather than passed in authored space.
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const bounds = ch1PlayableBounds(terrain);
      const world = (x: number, y: number, z: number) =>
        ch1DungeonAuthoredToWorld(terrain.dungeonId, { x, y, z });
      const around = (
        point: readonly [number, number, number]
      ): [[number, number, number], [number, number, number]] => [
        [point[0] - 1, point[1] - 1, point[2] - 1],
        [point[0] + 1, point[1] + 1, point[2] + 1],
      ];
      const mid = world(
        (bounds.x0 + bounds.x1) / 2,
        (bounds.y0 + bounds.y1) / 2,
        (bounds.z0 + bounds.z1) / 2
      );

      // Inside: nothing to collide with.
      assert.equal(
        ch1HorizonBoundarySlabs(terrain.dungeonId, around(mid)).length,
        0,
        `${terrain.dungeonId}: the middle of the room is solid`
      );

      // Each of the six crossings produces a slab to stop you.
      const probes: ReadonlyArray<[string, [number, number, number]]> = [
        [
          "west",
          world(
            bounds.x0 - 4,
            (bounds.y0 + bounds.y1) / 2,
            (bounds.z0 + bounds.z1) / 2
          ),
        ],
        [
          "east",
          world(
            bounds.x1 + 4,
            (bounds.y0 + bounds.y1) / 2,
            (bounds.z0 + bounds.z1) / 2
          ),
        ],
        [
          "floor",
          world(
            (bounds.x0 + bounds.x1) / 2,
            bounds.y0 - 4,
            (bounds.z0 + bounds.z1) / 2
          ),
        ],
        [
          "ceiling",
          world(
            (bounds.x0 + bounds.x1) / 2,
            bounds.y1 + 4,
            (bounds.z0 + bounds.z1) / 2
          ),
        ],
        [
          "north",
          world(
            (bounds.x0 + bounds.x1) / 2,
            (bounds.y0 + bounds.y1) / 2,
            bounds.z0 - 4
          ),
        ],
        [
          "south",
          world(
            (bounds.x0 + bounds.x1) / 2,
            (bounds.y0 + bounds.y1) / 2,
            bounds.z1 + 4
          ),
        ],
      ];
      for (const [side, point] of probes) {
        const slabs = ch1HorizonBoundarySlabs(terrain.dungeonId, around(point));
        assert.ok(
          slabs.length > 0,
          `${terrain.dungeonId}: nothing stops the player past the ${side} face`
        );
      }
    }
  });

  it("keeps the new buildings on the unreachable side of that boundary", () => {
    // Belt and braces: the slab test proves the wall exists, this proves the
    // new skyline is behind it in the player's own coordinate space.
    for (const building of SECOND_PASS) {
      const terrain = CH1_DUNGEON_TERRAIN.find(
        (candidate) => candidate.dungeonId === building.dungeonId
      )!;
      const bounds = ch1PlayableBounds(terrain);
      const cx = (building.x0 + building.x1) / 2;
      const cz = (building.z0 + building.z1) / 2;
      assert.equal(
        ch1PointInsidePlayable(bounds, cx, 0, cz),
        false,
        `${building.name} centre is inside the playable box`
      );
    }
  });

  it("builds the new skyline out of its era's own palette", () => {
    for (const building of SECOND_PASS) {
      const era = ch1HorizonEra(building.dungeonId);
      assert.ok(era, `${building.name} has no era`);
      // A desert building made of snow, or a fjord building made of sand,
      // would read as a bug from anywhere in the dungeon.
      const forbidden =
        building.dungeonId === "ch1_dungeon_desert"
          ? ["whiteWool", "ice", "snow"]
          : ["sand", "limestoneBrick"];
      for (const material of [building.wall, building.roof]) {
        assert.ok(
          !forbidden.includes(material),
          `${building.name} uses ${material}, which belongs to the other era`
        );
      }
    }
  });
});
