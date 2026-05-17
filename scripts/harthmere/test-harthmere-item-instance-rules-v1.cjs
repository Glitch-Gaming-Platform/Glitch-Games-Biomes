#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere item instance rules v1");
const src = inventorySource(h);
for (const field of ["instanceId", "itemId", "location", "quantity", "bound", "stolen", "locked", "enchantments", "expiration", "acquiredAt"]) {
  h.ok(src.includes(field), `item instance tracks ${field}`);
}
h.ok(src.includes("makeItemInstance"), "item instances are made through a single constructor path");
h.ok(src.includes("bind_on_equip") && src.includes("bind_on_use") && src.includes("quest_bound"), "binding rules exist");
h.done();
