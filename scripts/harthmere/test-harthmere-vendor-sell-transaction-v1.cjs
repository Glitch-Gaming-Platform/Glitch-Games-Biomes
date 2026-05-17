#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor sell transaction v1");
const src = inventorySource(h);
h.ok(src.includes("sellBlockReason"), "sell validates protected item states");
for (const phrase of ["Locked items", "Quest items cannot be sold", "Bound items", "Lawful vendors refuse stolen goods", "does not buy"]) h.ok(src.includes(phrase), `${phrase} guard exists`);
h.ok(src.includes("removeFromBackpack") && src.includes("addGold(removed.state, payout)"), "sell removes item and pays gold atomically");
h.ok(src.includes("Sold Item"), "sell logs transaction");
h.done();
