/// <reference types="mocha" />
import assert from "assert";

import { HARTHMERE_BUSINESS_OUTPOSTS } from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS,
  harthmereBusinessToolForType,
  harthmereBusinessToolListings,
  harthmereBusinessToolPurchaseOutcome,
  harthmereBusinessToolVendorMarkerId,
  harthmereBusinessTypeSellingTool,
  validateHarthmereBusinessToolShop,
} from "@/shared/harthmere/harthmere_business_tool_shop";
import { HARTHMERE_TOOL_SOURCES } from "@/shared/harthmere/harthmere_job_objective";
import { harthmereJobsBoardQuestMarkerPositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";

describe("harthmere business tool shop (current)", () => {
  it("passes its own structural validation", () => {
    assert.deepEqual(validateHarthmereBusinessToolShop(), []);
  });

  it("sells one DISTINCT tool for each of the 19 outpost businesses", () => {
    const listings = harthmereBusinessToolListings();
    // One per real outpost business type.
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      assert.ok(
        harthmereBusinessToolForType(outpost.businessType),
        `no tool for ${outpost.businessType}`
      );
    }
    // Every tool is unique.
    const ids = listings.map((l) => l.toolItemId);
    assert.equal(new Set(ids).size, ids.length, "tools must all be distinct");
    assert.equal(ids.length, HARTHMERE_BUSINESS_OUTPOSTS.length);
  });

  it("pins the repair tool to the repair shop and the cleanup tool to the cleanup shop", () => {
    assert.equal(
      harthmereBusinessToolForType("repair_maintenance_person")?.toolItemId,
      "repair_mallet"
    );
    assert.equal(
      harthmereBusinessToolForType("waste_sanitation_cleanup")?.toolItemId,
      "muck_rake"
    );
    // Reverse lookup resolves the right owner-marker, and it must agree with the
    // job tool-source redirect target so the marker is truthful.
    assert.equal(
      harthmereBusinessToolVendorMarkerId("repair_mallet"),
      HARTHMERE_TOOL_SOURCES.repair.vendorMarkerId
    );
    assert.equal(
      harthmereBusinessToolVendorMarkerId("muck_rake"),
      HARTHMERE_TOOL_SOURCES.cleanup.vendorMarkerId
    );
    assert.equal(
      harthmereBusinessTypeSellingTool("repair_mallet"),
      "repair_maintenance_person"
    );
  });

  it("resolves every tool vendor marker to a real on-map position", () => {
    for (const listing of harthmereBusinessToolListings()) {
      const markerId = harthmereBusinessToolVendorMarkerId(listing.toolItemId);
      assert.ok(markerId, `no vendor marker for ${listing.toolItemId}`);
      assert.ok(
        harthmereJobsBoardQuestMarkerPositionForId(markerId),
        `vendor marker ${markerId} must resolve to a position`
      );
    }
  });

  it("registers each newly-introduced tool exactly once", () => {
    const ids = HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS.map((d) => d.itemId);
    assert.equal(new Set(ids).size, ids.length);
    for (const def of HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS) {
      assert.ok(def.name.trim() && def.description.trim() && def.baseValue > 0);
    }
  });

  describe("harthmereBusinessToolPurchaseOutcome — purchase rules", () => {
    it("sells the tool and deducts gold when affordable and not owned", () => {
      const outcome = harthmereBusinessToolPurchaseOutcome({
        businessType: "repair_maintenance_person",
        goldAvailable: 100,
        alreadyOwned: false,
      });
      assert.equal(outcome.ok, true);
      assert.equal(outcome.goldAfter, 100 - 30); // repair_mallet = 30 gold
      assert.equal(outcome.listing?.toolItemId, "repair_mallet");
    });

    it("refuses when the player can't afford it (gold unchanged)", () => {
      const outcome = harthmereBusinessToolPurchaseOutcome({
        businessType: "repair_maintenance_person",
        goldAvailable: 5,
        alreadyOwned: false,
      });
      assert.equal(outcome.ok, false);
      assert.equal(outcome.reason, "insufficient_gold");
      assert.equal(outcome.goldAfter, 5);
    });

    it("refuses when the player already owns the tool", () => {
      const outcome = harthmereBusinessToolPurchaseOutcome({
        businessType: "repair_maintenance_person",
        goldAvailable: 100,
        alreadyOwned: true,
      });
      assert.equal(outcome.ok, false);
      assert.equal(outcome.reason, "already_owned");
      assert.equal(outcome.goldAfter, 100);
    });

    it("refuses for a business with no tool listing", () => {
      const outcome = harthmereBusinessToolPurchaseOutcome({
        businessType: "not_a_business",
        goldAvailable: 100,
        alreadyOwned: false,
      });
      assert.equal(outcome.ok, false);
      assert.equal(outcome.reason, "no_tool");
    });
  });
});
