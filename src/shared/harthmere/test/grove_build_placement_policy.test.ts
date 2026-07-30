import assert from "assert";

import {
  BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS,
  BUILDING_SYSTEM_LAND_REQUEST_AREAS,
  BUILDING_SYSTEM_PLOTS,
} from "@/shared/harthmere/building_system";
import { HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES } from "@/shared/harthmere/business_customer_simulator";
import {
  NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION,
  harthmereBoundsOverlapGroveBuildReserve,
  harthmerePointInsideGroveBuildReserve,
} from "@/shared/harthmere/grove_build_placement_policy";

describe("Grove build placement policy", () => {
  it("puts the Gimme Shelter marker in a real Muck zone outside the Grove", () => {
    const [x, , z] = NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION;
    assert.equal(harthmerePointInsideGroveBuildReserve({ x, z }), false);

    const muckArea = BUILDING_SYSTEM_DYNAMIC_MUCK_BUILD_AREAS.find((area) => {
      const dx = x - area.authoredCenter[0];
      const dz = z - area.authoredCenter[2];
      return Math.hypot(dx, dz) <= area.radius;
    });
    assert.ok(
      muckArea,
      "robot setup marker must remain inside an authored Muck zone"
    );
    assert.equal(muckArea?.id, "watchtower_muck_patch");
  });

  it("keeps every ordinary building plot and request area outside the Grove", () => {
    for (const plot of BUILDING_SYSTEM_PLOTS) {
      assert.equal(
        harthmereBoundsOverlapGroveBuildReserve(plot.bounds),
        false,
        `${plot.plotId} overlaps the Grove build reserve`
      );
    }
    for (const area of BUILDING_SYSTEM_LAND_REQUEST_AREAS) {
      assert.equal(
        harthmereBoundsOverlapGroveBuildReserve(area.bounds),
        false,
        `${area.areaId} overlaps the Grove build reserve`
      );
    }
  });

  it("keeps all 19 authored business buildings outside the same reserve", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.length, 19);
    for (const site of HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES) {
      assert.equal(
        harthmereBoundsOverlapGroveBuildReserve(site.footprint),
        false,
        `${site.outpostId} overlaps the Grove build reserve`
      );
    }
  });
});
