#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, assertUnifiedVendorCatalog, catalogOffsets, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor source of truth v1");
assertUnifiedVendorCatalog(h);
const offsets = catalogOffsets(h);
for (const required of [5,6,7,8,9,11,29,30,31,33,34,43,47,57,63,65,67]) h.ok(offsets.includes(required), `vendor offset ${required} is in source of truth`);
const cat = vendorSource(h);
h.ok(cat.includes("HARTHMERE_VENDOR_STOCK") && cat.includes("HARTHMERE_VENDOR_ECONOMY_PROFILES"), "catalog exports both compatibility views from one source");
h.done();
