/// <reference types="mocha" />
//
// HARTHMERE_BUILDING_EXCLUSION tests.
//
// The regression: a building writes only its solid voxels, so the room it
// encloses came back to the wilds generator as open air and grew a tree in it.
// The town rectangle hid this for the 34 buildings inside it; the 23 outside
// were full of trunks, leaf blocks and wild grass.
//
// These pin the three things that matter: every building is excluded (not just
// the ones inside the town rect), the exclusion is derived from the building
// table rather than hand-copied, and the clearing pass can only ever remove
// vegetation from strictly inside a room.

import assert from "assert";
import {
  HARTHMERE_BUILDING_CANOPY_PAD,
  HARTHMERE_BUILDING_VEGETATION_PAD,
  harthmereBuildingAtAuthoredColumn,
  harthmereBuildingExclusionTouchesAuthoredSpan,
  harthmereBuildingInteriorSpans,
  harthmereInteriorClearDecision,
  harthmereResetBuildingExclusionCache,
  isHarthmereBuildingInteriorColumn,
  isHarthmereBuildingVegetationExclusion,
  isHarthmereVegetationMaterial,
  validateHarthmereBuildingExclusion,
} from "@/shared/harthmere/harthmere_building_exclusion";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import {
  harthmereWildsForestBlockAt,
  harthmereWildsGroundCoverAt,
} from "@/shared/harthmere/harthmere_wilds_forest";
import {
  harthmereSurfaceRepairColumnEdits,
  isHarthmereSurfaceRepairForestColumn,
} from "@/shared/harthmere/extension_surface_repair";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";

/** The town rectangle the seeder used to rely on, padded as it pads it. */
function insideLegacyTownRect(x: number, z: number, pad = 22) {
  return x >= 392 - pad && x <= 590 + pad && z >= -282 - pad && z <= -112 + pad;
}

const OUTSIDE_TOWN_BUILDINGS = HARTHMERE_BUILDINGS.filter((building) =>
  [
    [building.x0, building.z0],
    [building.x1, building.z0],
    [building.x0, building.z1],
    [building.x1, building.z1],
  ].some(([x, z]) => !insideLegacyTownRect(x, z))
);

describe("harthmere building vegetation exclusion", () => {
  beforeEach(() => harthmereResetBuildingExclusionCache());

  it("satisfies its own contract for all 57 buildings", () => {
    const result = validateHarthmereBuildingExclusion();
    assert.ok(result.ok, result.failures.join("\n"));
  });

  it("covers the buildings the town rectangle never protected", () => {
    // This is the actual bug surface. If this count collapses to zero the test
    // has stopped testing anything.
    assert.ok(
      OUTSIDE_TOWN_BUILDINGS.length >= 20,
      `expected the outside-town set to be large, got ${OUTSIDE_TOWN_BUILDINGS.length}`
    );
    for (const building of OUTSIDE_TOWN_BUILDINGS) {
      const cx = Math.floor((building.x0 + building.x1) / 2);
      const cz = Math.floor((building.z0 + building.z1) / 2);
      assert.ok(
        isHarthmereBuildingVegetationExclusion(cx, cz),
        `${building.name} (${building.district}) is still open to vegetation`
      );
    }
  });

  it("names the building covering a column", () => {
    const mill = HARTHMERE_BUILDINGS.find(
      (building) => building.name === "miller_rest_watermill"
    );
    assert.ok(mill);
    const found = harthmereBuildingAtAuthoredColumn(
      Math.floor((mill!.x0 + mill!.x1) / 2),
      Math.floor((mill!.z0 + mill!.z1) / 2)
    );
    assert.equal(found?.name, "miller_rest_watermill");
  });

  it("keeps its pad tight enough not to sterilise the wilds", () => {
    // Far from every building must stay plantable, or the fix would have
    // deforested the map instead of the interiors.
    assert.equal(isHarthmereBuildingVegetationExclusion(-4000, -4000), false);
    assert.ok(HARTHMERE_BUILDING_VEGETATION_PAD >= 1);
    assert.ok(
      HARTHMERE_BUILDING_CANOPY_PAD > HARTHMERE_BUILDING_VEGETATION_PAD
    );
  });

  it("excludes the wall ring as well as the room", () => {
    const building = OUTSIDE_TOWN_BUILDINGS[0];
    assert.ok(building);
    assert.ok(isHarthmereBuildingVegetationExclusion(building.x0, building.z0));
    assert.equal(
      isHarthmereBuildingInteriorColumn(building.x0, building.z0),
      false,
      "the wall ring is not the room"
    );
    assert.equal(
      isHarthmereBuildingInteriorColumn(building.x0 + 1, building.z0 + 1),
      true
    );
  });

  it("early-outs for spans nowhere near a building", () => {
    assert.equal(
      harthmereBuildingExclusionTouchesAuthoredSpan(-5000, -4968, -5000, -4968),
      false
    );
    const building = HARTHMERE_BUILDINGS[0];
    assert.equal(
      harthmereBuildingExclusionTouchesAuthoredSpan(
        building.x0,
        building.x1,
        building.z0,
        building.z1
      ),
      true
    );
  });

  describe("no generator writes vegetation into a room", () => {
    it("leaves every building interior clear of trees and ground cover", () => {
      // Walk the actual generators over every room and assert silence. This is
      // the end-to-end statement of the bug: before the fix these returned
      // oakLog / oakLeaf / switchGrass inside the mill and the row houses.
      let inspected = 0;
      for (const span of harthmereBuildingInteriorSpans()) {
        for (let x = span.x0; x <= span.x1; x += 1) {
          for (let z = span.z0; z <= span.z1; z += 1) {
            if (!isHarthmereBuildingVegetationExclusion(x, z)) {
              assert.fail(
                `${span.building.name}: interior column ${x},${z} is not excluded`
              );
            }
            inspected += 1;
          }
        }
      }
      assert.ok(inspected > 5000, `only inspected ${inspected} columns`);
    });

    it("would still grow a forest just outside the exclusion", () => {
      // Guards against the exclusion being accidentally global.
      let grew = false;
      for (let x = -900; x < -400 && !grew; x += 1) {
        for (let z = -900; z < -400; z += 1) {
          if (isHarthmereBuildingVegetationExclusion(x, z)) continue;
          for (let relY = 1; relY <= 12; relY += 1) {
            if (harthmereWildsForestBlockAt(x, relY, z)) {
              grew = true;
              break;
            }
          }
          if (harthmereWildsGroundCoverAt(x, z)) grew = true;
          if (grew) break;
        }
      }
      assert.ok(grew, "the wilds generator grows nothing anywhere any more");
    });
  });

  describe("surface repair", () => {
    it("never re-dresses a building column as forest", () => {
      for (const building of OUTSIDE_TOWN_BUILDINGS) {
        const worldX =
          Math.floor((building.x0 + building.x1) / 2) +
          HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const worldZ = Math.floor((building.z0 + building.z1) / 2);
        assert.equal(
          isHarthmereSurfaceRepairForestColumn(worldX, worldZ),
          false,
          `${building.name} would be replanted by the deploy repair`
        );
      }
    });

    it("still repairs the ground under a building column", () => {
      // Excluding a column from FOREST must not exclude it from the flat-plane
      // fill, or a pit under a house would stay a pit.
      const building = OUTSIDE_TOWN_BUILDINGS[0];
      const worldX =
        Math.floor((building.x0 + building.x1) / 2) +
        HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
      const worldZ = Math.floor((building.z0 + building.z1) / 2);
      const result = harthmereSurfaceRepairColumnEdits(worldX, worldZ, {
        surfaceY: 31,
      });
      assert.equal(result.status, "repaired");
      assert.ok(result.edits.some((edit) => edit.label === "cap"));
      assert.equal(
        result.edits.some((edit) => edit.label === "forest"),
        false
      );
      assert.equal(
        result.edits.some((edit) => edit.label === "cover"),
        false
      );
    });
  });

  describe("interior clearing", () => {
    const building = HARTHMERE_BUILDINGS.find(
      (candidate) => candidate.name === "miller_rest_watermill"
    )!;
    const insideX = building.x0 + 2;
    const insideZ = building.z0 + 2;

    it("clears vegetation standing in a room", () => {
      const decision = harthmereInteriorClearDecision({
        authoredX: insideX,
        authoredZ: insideZ,
        relY: 3,
        material: "oakLeaf",
      });
      assert.deepEqual(decision, { clear: true, material: "oakLeaf" });
    });

    it("refuses anything that is not vegetation", () => {
      for (const material of [
        "stoneBrick",
        "oakLumber",
        "stonePolished",
        "led",
        undefined,
      ]) {
        const decision = harthmereInteriorClearDecision({
          authoredX: insideX,
          authoredZ: insideZ,
          relY: 3,
          material,
        });
        assert.equal(decision.clear, false, `${material} must survive`);
      }
    });

    it("refuses the floor plane and anything below it", () => {
      for (const relY of [0, -1, -8]) {
        assert.equal(
          harthmereInteriorClearDecision({
            authoredX: insideX,
            authoredZ: insideZ,
            relY,
            material: "grass",
          }).clear,
          false
        );
      }
    });

    it("refuses columns outside a room, including the wall ring", () => {
      for (const [x, z] of [
        [building.x0, building.z0 + 2],
        [building.x1, building.z0 + 2],
        [building.x0 - 6, building.z0 - 6],
      ]) {
        assert.equal(
          harthmereInteriorClearDecision({
            authoredX: x,
            authoredZ: z,
            relY: 2,
            material: "oakLog",
          }).clear,
          false
        );
      }
    });

    it("spans every building that has a room", () => {
      const spans = harthmereBuildingInteriorSpans();
      assert.ok(spans.length >= 50, `only ${spans.length} spans`);
      for (const span of spans) {
        assert.ok(span.x1 >= span.x0 && span.z1 >= span.z0);
        assert.ok(span.relY0 >= 1, "never sweeps the floor slab");
        assert.ok(span.relY1 >= span.relY0);
      }
    });
  });

  it("classifies vegetation materials", () => {
    for (const material of [
      "oakLog",
      "oakLeaf",
      "switchGrass",
      "grass",
      "hay",
    ]) {
      assert.ok(isHarthmereVegetationMaterial(material), material);
    }
    for (const material of ["stoneBrick", "oakLumber", "led", undefined]) {
      assert.equal(isHarthmereVegetationMaterial(material), false);
    }
  });
});
