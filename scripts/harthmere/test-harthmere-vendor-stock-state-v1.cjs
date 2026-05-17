#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor stock state v1");
const inv = inventorySource(h); const cat = vendorSource(h);
h.ok(cat.includes("goldSupply"), "vendor gold supply is declared in source of truth");
h.ok(cat.includes("restockHours"), "vendor restock hours are declared in source of truth");
h.ok(inv.includes("stock.quantity") && inv.includes("buyFromVendor"), "buy path reads stock quantity from unified vendor stock");
h.ok(inv.includes("goldSupply") || cat.includes("goldSupply"), "vendor gold supply is available to transaction tests");
h.done();
