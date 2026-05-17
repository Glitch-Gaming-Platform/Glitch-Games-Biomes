#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor buy transaction v1");
const src = inventorySource(h);
h.ok(src.includes("buyFitReason"), "buy validates affordability and storage before mutation");
h.ok(src.includes("Cannot Buy"), "buy failure is logged");
h.ok(src.includes("addItemByStorageRules"), "buy routes item through storage rules");
h.ok(src.includes("addGold(result.state, -price)"), "buy reduces gold exactly once through dynamic price");
h.ok(src.includes("Bought Item"), "buy logs transaction");
h.done();
