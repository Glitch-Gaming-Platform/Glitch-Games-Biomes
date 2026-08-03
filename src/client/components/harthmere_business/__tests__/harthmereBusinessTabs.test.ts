// Frontend test for the BusinessUI tab labels.

import {
  HARTHMERE_BUSINESS_TAB_LABELS,
  harthmereBusinessTabLabel,
} from "@/client/components/harthmere_business/harthmereBusinessTabs";
import assert from "assert";

describe("Harthmere business tab labels", () => {
  it("labels the customer-service tab as an in-world shift", () => {
    assert.strictEqual(
      HARTHMERE_BUSINESS_TAB_LABELS.customers,
      "In-World Shift"
    );
    assert.strictEqual(
      harthmereBusinessTabLabel("customers"),
      "In-World Shift"
    );
  });

  it("keeps the other tab labels intact", () => {
    assert.strictEqual(harthmereBusinessTabLabel("dashboard"), "Dashboard");
    assert.strictEqual(harthmereBusinessTabLabel("finance"), "Finance");
    assert.strictEqual(harthmereBusinessTabLabel("market"), "Market");
  });

  it("falls back to the tab id for an unknown tab", () => {
    assert.strictEqual(harthmereBusinessTabLabel("nope"), "nope");
  });
});
