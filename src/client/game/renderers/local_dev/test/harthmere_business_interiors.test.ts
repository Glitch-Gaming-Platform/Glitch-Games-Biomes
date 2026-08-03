import assert from "assert";
import { HARTHMERE_BUSINESS_INTERIORS } from "@/shared/harthmere/business_interior_runtime";
import { harthmereBusinessInteriorLodForDistance } from "../harthmere_business_interiors";

describe("Harthmere combined business interior renderer", () => {
  it("uses the exact 16m/28m LOD contract for all 19 interiors", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 0),
        "lod0",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 16),
        "lod0",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 16.01),
        "lod1",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 28),
        "lod1",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 28.01),
        "hidden",
        record.outpostId
      );
    }
  });
});
