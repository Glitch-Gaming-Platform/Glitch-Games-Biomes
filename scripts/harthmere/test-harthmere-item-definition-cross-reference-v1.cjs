#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, itemIds, catalogItemIds, economySource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item definition cross-reference v1");
const defs = new Set(itemIds(h));
for (const id of catalogItemIds(h)) {
  h.ok(defs.has(id), `vendor stock item ${id} exists in ITEM_DEFINITIONS`);
}
const eco = economySource(h);
for (const [, id] of eco.matchAll(/itemId:\s*"([a-zA-Z0-9_]+)"/g)) {
  h.ok(defs.has(id), `economy item/listing ${id} exists in ITEM_DEFINITIONS`);
}
const gathering = challengeSource(h, "LocalDevHarthmereGatheringSystem.tsx");
for (const [, id] of gathering.matchAll(/itemId:\s*"([a-zA-Z0-9_]+)"|yieldItemId:\s*"([a-zA-Z0-9_]+)"|rareItemId:\s*"([a-zA-Z0-9_]+)"/g)) {
  const value = id;
  if (value) h.ok(defs.has(value), `gathering yield item ${value} exists in ITEM_DEFINITIONS`);
}
h.ok(eco.includes("auctionable") && eco.includes("tradeable"), "auction/trade metadata exists for economy items");
h.done();
