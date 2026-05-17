#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, catalogItemIds, itemIds, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor inventory v1");
const ids = new Set(itemIds(h));
for (const itemId of catalogItemIds(h)) h.ok(ids.has(itemId), `vendor stock item ${itemId} exists in item catalog`);
const cat = vendorSource(h);
for (const catName of ["weapon", "armor", "crafting_material", "food", "trade_good", "junk", "tool", "spell_scroll"]) h.ok(cat.includes(`"${catName}"`), `vendors buy/sell ${catName} role category`);
h.done();
