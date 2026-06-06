// Frontend test for the BusinessUI tab labels.

import {
  HARTHMERE_BUSINESS_TAB_LABELS_V1,
  harthmereBusinessTabLabelV1,
} from "@/client/components/harthmere_business/harthmereBusinessTabsV1";
import assert from "assert";

describe("Harthmere business tab labels", () => {
  it("labels the mini-game tab 'Day Job Mini-Game'", () => {
    assert.strictEqual(
      HARTHMERE_BUSINESS_TAB_LABELS_V1.customers,
      "Day Job Mini-Game"
    );
    assert.strictEqual(
      harthmereBusinessTabLabelV1("customers"),
      "Day Job Mini-Game"
    );
  });

  it("keeps the other tab labels intact", () => {
    assert.strictEqual(harthmereBusinessTabLabelV1("dashboard"), "Dashboard");
    assert.strictEqual(harthmereBusinessTabLabelV1("finance"), "Finance");
    assert.strictEqual(harthmereBusinessTabLabelV1("market"), "Market");
  });

  it("falls back to the tab id for an unknown tab", () => {
    assert.strictEqual(harthmereBusinessTabLabelV1("nope"), "nope");
  });
});
