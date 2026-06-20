/// <reference types="mocha" />

import assert from "assert";

import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import { HARTHMERE_TOOL_SOURCES } from "@/shared/harthmere/harthmere_job_objective";

describe("HARTHMERE_TOOL_OBTAINABLE — job tools are buyable (no dead-end guidance)", () => {
  const allStockItemIds = new Set(
    Object.values(HARTHMERE_VENDOR_CATALOG).flatMap((profile) =>
      profile.stocks.map((stock) => stock.itemId)
    )
  );

  it("every tool the resolver tells the player to buy is actually stocked at a vendor", () => {
    for (const source of Object.values(HARTHMERE_TOOL_SOURCES)) {
      assert.ok(
        allStockItemIds.has(source.toolItemId),
        `${source.toolItemId} (${source.action}) must be stocked somewhere so the "buy it" objective is not a dead end`
      );
    }
  });

  it("stocks both the repair mallet and the cleanup muck rake", () => {
    assert.ok(allStockItemIds.has("repair_mallet"));
    assert.ok(allStockItemIds.has("muck_rake"));
  });
});
