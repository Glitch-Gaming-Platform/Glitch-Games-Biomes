/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE BUILDINGS — enclosure, doors, and furniture that cannot trap you.
//
// The town's 57 buildings were authored before any of this existed, and the
// brief was explicit: enhance them, never redo them. So this file does two
// separate jobs.
//
//   1. PIN what is already correct. Every building has four walls, a roof, and
//      a door whose centre sits strictly inside a wall span. Those properties
//      hold today; these tests make sure a future edit cannot quietly lose one.
//   2. PROVE the new furniture only adds. Furniture is the thing most likely to
//      ruin a building — one crate in a doorway and the shop is unreachable —
//      so every piece is checked against the door lane, the stairs, the room
//      partitions, and the seven pairs of buildings whose footprints overlap.

import assert from "assert";
import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
} from "../harthmere_town_buildings";
import {
  harthmereBuildingFurniture,
  harthmereBuildingInteriorBlockAt,
  harthmereFloorCountOf,
  harthmereStoryHeightOf,
  harthmereValidateBuildingInteriors,
} from "../harthmere_building_interiors";
import { harthmereAdditiveTownInteriorFixturesForBuilding } from "../harthmere_additive_town_interiors";

function doorSpan(building: HarthmereBuilding): [number, number] {
  return building.doorSide === "north" || building.doorSide === "south"
    ? [building.x0, building.x1]
    : [building.z0, building.z1];
}

describe("harthmere buildings - every one is enclosed and has a door", () => {
  it("has the full authored town", () => {
    assert.equal(HARTHMERE_BUILDINGS.length, 57);
  });

  it("gives every building a footprint big enough to have an inside", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      const width = building.x1 - building.x0 + 1;
      const depth = building.z1 - building.z0 + 1;
      assert.ok(
        width >= 5 && depth >= 5,
        `${building.name}: ${width}x${depth} leaves no interior once the four ` +
          `walls are drawn`
      );
    }
  });

  it("puts every door strictly inside a wall, never at a corner", () => {
    // The shell is drawn as a rectangle perimeter, so four walls are structural.
    // What can actually go wrong is the DOOR: a doorCenter at or next to a
    // corner would either miss the wall or punch through the corner post,
    // leaving the building sealed or structurally odd.
    for (const building of HARTHMERE_BUILDINGS) {
      const [lo, hi] = doorSpan(building);
      assert.ok(
        building.doorCenter - 1 > lo && building.doorCenter + 1 < hi,
        `${building.name}: door at ${building.doorCenter} on the ` +
          `${building.doorSide} wall spanning ${lo}..${hi} — a three-wide ` +
          `doorway needs a clear voxel either side`
      );
    }
  });

  it("keeps stairs and chimneys on the building they belong to", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      if (building.stairs) {
        const { x0, z0 } = building.stairs;
        assert.ok(
          x0 >= building.x0 &&
            x0 <= building.x1 &&
            z0 >= building.z0 &&
            z0 <= building.z1,
          `${building.name}: stairs start outside the footprint`
        );
      }
      if (building.chimney) {
        const [cx, cz] = building.chimney;
        assert.ok(
          cx >= building.x0 &&
            cx <= building.x1 &&
            cz >= building.z0 &&
            cz <= building.z1,
          `${building.name}: chimney is not on the roof it rises from`
        );
      }
    }
  });

  it("has no footprint overlaps left to work around", () => {
    // This used to pin SEVEN overlapping pairs — buildings whose shells
    // interpenetrated — because the brief at the time was to enhance the town,
    // not redesign it, and the furniture generator merely had to know about
    // them. The shell polish pass fixed the shells themselves, so the number is
    // now zero. `insideAnotherBuilding()` in the furniture generator is kept
    // regardless: it is the guard that makes a future overlap harmless rather
    // than a crate appearing inside the neighbour's shop.
    const overlaps: string[] = [];
    for (let i = 0; i < HARTHMERE_BUILDINGS.length; i += 1) {
      for (let j = i + 1; j < HARTHMERE_BUILDINGS.length; j += 1) {
        const a = HARTHMERE_BUILDINGS[i];
        const b = HARTHMERE_BUILDINGS[j];
        if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1) {
          overlaps.push(`${a.name}/${b.name}`);
        }
      }
    }
    assert.deepEqual(
      overlaps,
      [],
      `authored footprint overlaps came back: ${overlaps.join(", ")}`
    );
  });
});

describe("harthmere buildings - structural lighting and manifest furniture only ever add", () => {
  it("passes its own validation", () => {
    assert.deepEqual(harthmereValidateBuildingInteriors(), []);
  });

  it("retires coarse voxel furniture and furnishes all 57 through the authored manifest", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      const furniture = harthmereBuildingFurniture(building);
      const realFurniture = furniture.filter(
        (box) => box.piece !== "ceiling_led"
      );
      assert.equal(
        realFurniture.length,
        0,
        `${building.name} still emits duplicate voxel furniture`
      );
      assert.ok(
        harthmereAdditiveTownInteriorFixturesForBuilding(building.name)
          .length >= 5,
        `${building.name} has no authoritative manifest furniture`
      );
    }
  });

  it("never puts furniture in a wall, floor slab, or roof", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      const storyHeight = harthmereStoryHeightOf(building);
      const floors = harthmereFloorCountOf(building);
      for (const box of harthmereBuildingFurniture(building)) {
        assert.ok(
          box.x0 > building.x0 &&
            box.x1 < building.x1 &&
            box.z0 > building.z0 &&
            box.z1 < building.z1,
          `${building.name}: ${box.piece} overlaps a wall`
        );
        for (let floor = 0; floor < floors; floor += 1) {
          assert.notEqual(
            box.y0,
            floor * storyHeight,
            `${building.name}: ${box.piece} sits in floor ${floor}'s slab`
          );
        }
        assert.ok(
          box.y1 < floors * storyHeight,
          `${building.name}: ${box.piece} pokes through the roof`
        );
      }
    }
  });

  it("leaves every doorway walkable", () => {
    // Walk the three voxels of the doorway and the five inside it, at every
    // height a player occupies. Anything solid here makes the building
    // unenterable, which is worse than having no furniture at all.
    for (const building of HARTHMERE_BUILDINGS) {
      const [lo, hi] = doorSpan(building);
      void lo;
      void hi;
      for (let offset = -1; offset <= 1; offset += 1) {
        for (let depth = 0; depth <= 4; depth += 1) {
          let x: number;
          let z: number;
          if (building.doorSide === "north") {
            x = building.doorCenter + offset;
            z = building.z0 + depth;
          } else if (building.doorSide === "south") {
            x = building.doorCenter + offset;
            z = building.z1 - depth;
          } else if (building.doorSide === "west") {
            x = building.x0 + depth;
            z = building.doorCenter + offset;
          } else {
            x = building.x1 - depth;
            z = building.doorCenter + offset;
          }
          for (let relY = 1; relY <= 3; relY += 1) {
            assert.equal(
              harthmereBuildingInteriorBlockAt(building, x, relY, z),
              undefined,
              `${building.name}: furniture blocks the doorway at ` +
                `(${x},${relY},${z})`
            );
          }
        }
      }
    }
  });

  it("leaves every staircase clear", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      const stairs = building.stairs;
      if (!stairs) {
        continue;
      }
      const spanX =
        stairs.direction === "east" || stairs.direction === "west"
          ? stairs.length
          : stairs.width;
      const spanZ =
        stairs.direction === "east" || stairs.direction === "west"
          ? stairs.width
          : stairs.length;
      for (let x = stairs.x0; x <= stairs.x0 + spanX; x += 1) {
        for (let z = stairs.z0; z <= stairs.z0 + spanZ; z += 1) {
          for (let relY = 1; relY <= 12; relY += 1) {
            assert.equal(
              harthmereBuildingInteriorBlockAt(building, x, relY, z),
              undefined,
              `${building.name}: furniture on the stairs at (${x},${relY},${z})`
            );
          }
        }
      }
    }
  });

  it("never places furniture inside an overlapping neighbour", () => {
    for (const building of HARTHMERE_BUILDINGS) {
      for (const box of harthmereBuildingFurniture(building)) {
        for (const other of HARTHMERE_BUILDINGS) {
          if (other.name === building.name) {
            continue;
          }
          const inside =
            box.x0 >= other.x0 &&
            box.x1 <= other.x1 &&
            box.z0 >= other.z0 &&
            box.z1 <= other.z1;
          assert.ok(
            !inside,
            `${building.name}: ${box.piece} at (${box.x0},${box.z0}) landed ` +
              `inside ${other.name} — the two footprints overlap`
          );
        }
      }
    }
  });

  it("keeps the middle of every room open", () => {
    // Furniture lines the walls by construction. Verified rather than assumed:
    // the centre nine columns of each ground floor must be empty, so there is
    // always somewhere to stand and something to walk around.
    for (const building of HARTHMERE_BUILDINGS) {
      const midX = Math.floor((building.x0 + building.x1) / 2);
      const midZ = Math.floor((building.z0 + building.z1) / 2);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          for (let relY = 1; relY <= 3; relY += 1) {
            assert.equal(
              harthmereBuildingInteriorBlockAt(
                building,
                midX + dx,
                relY,
                midZ + dz
              ),
              undefined,
              `${building.name}: furniture fills the middle of the room`
            );
          }
        }
      }
    }
  });

  it("gives each kind of building the furniture it should have", () => {
    const piecesFor = (name: string) =>
      new Set(
        harthmereAdditiveTownInteriorFixturesForBuilding(name).map(
          (fixture) =>
            fixture.furnitureItemId ?? fixture.asset ?? fixture.stationKind
        )
      );
    const smithy = piecesFor("black_anvil_smithy");
    assert.ok(smithy.has("town_forge_anvil"), "the smithy has no anvil");
    const stables = piecesFor("harthmere_stables");
    assert.ok(
      stables.has("small_bed") || stables.has("wood_container"),
      "the stables have neither bunks nor storage"
    );
  });

  it("keeps structure-owned emissive ceiling lighting", () => {
    let lit = 0;
    for (const building of HARTHMERE_BUILDINGS) {
      const hasLed = harthmereBuildingFurniture(building).some(
        (box) => box.material === "led"
      );
      if (hasLed) {
        lit += 1;
      }
    }
    assert.ok(
      lit > HARTHMERE_BUILDINGS.length / 2,
      `only ${lit} of ${HARTHMERE_BUILDINGS.length} buildings have any light`
    );
  });

  it("is deterministic across repeated queries", () => {
    const building = HARTHMERE_BUILDINGS[3];
    const first = harthmereBuildingFurniture(building).map(
      (box) => `${box.piece}:${box.x0}:${box.y0}:${box.z0}`
    );
    const second = harthmereBuildingFurniture(building).map(
      (box) => `${box.piece}:${box.x0}:${box.y0}:${box.z0}`
    );
    assert.deepEqual(first, second);
  });
});
