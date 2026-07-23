import assert from "assert";
import {
  HARTHMERE_SERVICE_BUILDING_VISUAL_DECOR_VERSION,
  createHarthmereServiceBuildingVisualDecorSpecs,
  type HarthmereServiceBuildingProfile,
} from "@/shared/harthmere/service_building_visual_decor";

const PROFILES: HarthmereServiceBuildingProfile[] = [
  "bakery",
  "provision",
  "player_services",
  "smithy",
  "workshop",
  "apothecary",
  "magic_shop",
  "inn",
  "reeve_hall",
  "dock_warehouse",
  "mudden_home",
  "wash_house",
  "residential_cottage",
  "barracks",
  "stable_office",
  "chapel",
];

describe("Harthmere service-building visual decor", () => {
  it("furnishes every profile from snapshot cues while preserving the door aisle", () => {
    assert.equal(
      HARTHMERE_SERVICE_BUILDING_VISUAL_DECOR_VERSION,
      "harthmere-service-building-snapshot-interiors-v1"
    );

    for (const profile of PROFILES) {
      const specs = createHarthmereServiceBuildingVisualDecorSpecs({
        profile,
        width: 18,
        depth: 16,
        floors: 1,
      });
      assert.ok(specs.length >= 6, `${profile} needs a complete decor kit`);
      assert.ok(
        specs.some((spec) => spec.label.includes("perimeter seating")),
        `${profile} needs perimeter seating`
      );
      assert.ok(
        specs.some((spec) => spec.label.includes("supported on side table")),
        `${profile} needs supported tabletop clutter`
      );
      assert.ok(
        specs.every((spec) => Math.abs(spec.dx) >= 2),
        `${profile} decor must keep the center door aisle clear`
      );
    }
  });

  it("adds a lived-in upper-floor room kit to multi-story buildings", () => {
    const specs = createHarthmereServiceBuildingVisualDecorSpecs({
      profile: "residential_cottage",
      width: 16,
      depth: 14,
      floors: 2,
    });
    const upstairs = specs.filter((spec) => spec.floor === 2);
    assert.ok(upstairs.length >= 5);
    assert.ok(upstairs.some((spec) => spec.asset === "bed_twin2"));
    assert.ok(upstairs.some((spec) => spec.asset === "nightstand"));
    assert.ok(upstairs.some((spec) => spec.asset === "chest_wood_fp"));
  });
});
