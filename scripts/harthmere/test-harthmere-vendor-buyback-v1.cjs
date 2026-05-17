#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor buyback v1");
const src = inventorySource(h);
h.ok(src.includes("lastVendor"), "inventory remembers last vendor for buyback/history expansion");
h.ok(src.includes("recent"), "recent transaction log exists for buyback/history expansion");
h.ok(src.includes("Sold Item"), "sold items are recorded in transaction history");
h.ok(src.includes("Bought Item"), "bought items are recorded in transaction history");
h.done();
