#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor dialogue exposure v1");
const q = h.read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const inv = h.read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
h.ok(q.includes("inventoryActionsForHarthmereNpc") && q.includes("economyActionsForHarthmereNpc"), "quest/dialogue system imports inventory and economy action providers");
h.ok(inv.includes("Browse goods") && inv.includes("Sell goods"), "vendor browse/sell actions are exposed to dialogue menu");
h.ok(q.includes("compactHarthmereNpcActions"), "dialogue compaction path exists so vendor exposure can be tested");
h.done();
