import assert from "assert";

import {
  harthmereBuildingFacadeMaterialAt,
  harthmereBuildingRoofBlockAt,
  harthmereBuildingRoofRise,
  harthmereBuildingRoofMaterial,
} from "@/shared/harthmere/harthmere_building_style";
import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";

describe("Harthmere building style", () => {
  const inn = HARTHMERE_BUILDINGS.find(
    (building) => building.name === "copper_kettle_inn"
  )!;

  it("styles ordinary upper floors as dark timber and plaster", () => {
    assert.strictEqual(
      harthmereBuildingFacadeMaterialAt(inn, inn.x0, 7, inn.z0, 5),
      "oakLog"
    );
    assert.strictEqual(
      harthmereBuildingFacadeMaterialAt(inn, inn.x0 + 2, 7, inn.z0, 5),
      "limestoneBrick"
    );
  });

  it("keeps a stone foundation below the timber upper structure", () => {
    assert.strictEqual(
      harthmereBuildingFacadeMaterialAt(inn, inn.x0 + 2, 1, inn.z0, 5),
      "stoneBrick"
    );
  });

  it("replaces colored wool roof data with real roof materials", () => {
    assert.strictEqual(inn.roof, "redWool");
    assert.strictEqual(harthmereBuildingRoofMaterial(inn), "stoneShingles");
    for (const building of HARTHMERE_BUILDINGS) {
      assert.ok(
        !harthmereBuildingRoofMaterial(building).endsWith("Wool"),
        building.name
      );
    }
  });

  it("builds a stepped gable with a ridge above its eaves", () => {
    const shellTop = 10;
    const occupiedY = new Set<number>();
    for (let z = inn.z0 - 1; z <= inn.z1 + 1; z += 1) {
      for (
        let relY = shellTop + 1;
        relY <= shellTop + harthmereBuildingRoofRise(inn);
        relY += 1
      ) {
        if (
          harthmereBuildingRoofBlockAt(
            inn,
            Math.floor((inn.x0 + inn.x1) / 2),
            relY,
            z,
            shellTop
          )
        ) {
          occupiedY.add(relY);
        }
      }
    }
    assert.ok(occupiedY.size >= 3, [...occupiedY]);
    assert.ok(occupiedY.has(shellTop + 1));
    assert.ok(occupiedY.has(shellTop + harthmereBuildingRoofRise(inn)));
  });
});
