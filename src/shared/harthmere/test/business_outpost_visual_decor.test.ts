import assert from "assert";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_OUTPOST_ENHANCED_FURNISHING_VERSION,
  createHarthmereBusinessOutpostEnhancedFurnishingSpecs,
  createHarthmereBusinessOutpostInteriorDecorSpecs,
} from "@/shared/harthmere/business_outpost_visual_decor";

describe("business outpost visual furnishing", () => {
  it("additively furnishes all 19 businesses without replacing fixture decor", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    assert.equal(
      HARTHMERE_BUSINESS_OUTPOST_ENHANCED_FURNISHING_VERSION,
      "harthmere-business-outpost-additive-furnishing-v2"
    );

    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const record =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
      const enhancements =
        createHarthmereBusinessOutpostEnhancedFurnishingSpecs(record);
      const allSpecs = createHarthmereBusinessOutpostInteriorDecorSpecs(record);
      const existingFurnitureFixtures = record.interiorFixtures.filter(
        (fixture) => fixture.role !== "customer_queue_space"
      );

      assert.ok(
        enhancements.length >= 6,
        `${outpost.outpostId} should gain staff, counter, storage, light, seating, and signature furnishings`
      );
      assert.ok(
        allSpecs.length >=
          existingFurnitureFixtures.length + enhancements.length,
        `${outpost.outpostId} should preserve its original fixture furniture before enhancements`
      );
      for (const fixture of existingFurnitureFixtures) {
        assert.ok(
          allSpecs.some(
            (spec) =>
              spec.fixture.fixtureId === fixture.fixtureId &&
              !spec.nameSuffix?.startsWith(" enhanced")
          ),
          `${outpost.outpostId} lost original furniture for ${fixture.fixtureId}`
        );
      }

      assert.ok(
        enhancements.some((spec) =>
          spec.nameSuffix?.includes("signature furnishing")
        ),
        `${outpost.outpostId} needs a business-specific signature furnishing`
      );
      assert.ok(
        enhancements.every(
          (spec) => spec.fixture.role !== "customer_queue_space"
        ),
        `${outpost.outpostId} enhancements must keep the customer aisle open`
      );

      for (const spec of enhancements) {
        const x = spec.fixture.position.x + 0.5 + (spec.dx ?? 0);
        const z = spec.fixture.position.z + 0.5 + (spec.dz ?? 0);
        assert.ok(
          x > record.origin.x &&
            x < record.origin.x + record.blueprint.footprint.width,
          `${outpost.outpostId} furnishing ${spec.nameSuffix} escaped the interior on X`
        );
        assert.ok(
          z > record.origin.z &&
            z < record.origin.z + record.blueprint.footprint.depth,
          `${outpost.outpostId} furnishing ${spec.nameSuffix} escaped the interior on Z`
        );
      }
    }
  });
});
