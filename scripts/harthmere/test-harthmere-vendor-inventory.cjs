#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, catalogItemIds, itemBlocks, itemIds, vendorSource } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere vendor inventory current");
const ids = new Set(itemIds(h));
for (const itemId of catalogItemIds(h)) h.ok(ids.has(itemId), `vendor stock item ${itemId} exists in item catalog`);
const cat = vendorSource(h);
for (const catName of ["weapon", "armor", "crafting_material", "food", "trade_good", "junk", "tool", "spell_scroll"]) h.ok(cat.includes(`"${catName}"`), `vendors buy/sell ${catName} role category`);
const blocks = itemBlocks(h);
const categoryFor = (itemId) => (blocks.get(itemId) ?? "").match(/category:\s*"([^"]+)"/)?.[1];
for (const [, offset, body] of cat.matchAll(/^\s{2}(\d+):\s*vendor\(\{([\s\S]*?)\n\s{2}\}\),/gm)) {
  const stockIds = Array.from(body.matchAll(/itemId:\s*"([^"]+)"/g)).map((match) => match[1]);
  h.ok(stockIds.some((itemId) => categoryFor(itemId) === "tool"), `vendor offset ${offset} stocks at least one tool`);
}
h.ok(/itemId:\s*"(raw_exotic_matter|stabilized_exotic_matter)"/.test(cat), "at least one vendor sells exotic matter");
h.done();
