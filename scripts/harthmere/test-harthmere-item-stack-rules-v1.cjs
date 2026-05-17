#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item stack rules v1");
const src = inventorySource(h);
h.ok(src.includes("stackCompatible"), "stack compatibility helper exists");
for (const check of ["a.bound === b.bound", "a.stolen === b.stolen", "a.locked === b.locked", "a.durability === b.durability", "a.expiration === b.expiration", "a.enchantments.join"]) {
  h.ok(src.includes(check), `stack compatibility checks ${check}`);
}
h.ok(!src.includes("stackCompatible(item, item)"), "stacking does not compare an item to itself");
h.ok(src.includes("incomingStack") && src.includes("stackCompatible(item, incomingStack)"), "stacking compares existing stack with incoming item state");
h.done();
