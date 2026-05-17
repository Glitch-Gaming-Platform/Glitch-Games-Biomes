#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor live UI contract v1");
const inv = inventorySource(h);
h.ok(inv.includes("data-harthmere-vendor-trade-panel"), "vendor trade panel exposes a stable live-test selector");
h.ok(inv.includes("data-harthmere-dynamic-vendor-price"), "vendor UI exposes dynamic price marker");
h.ok(inv.includes("data-harthmere-dynamic-vendor-modifiers"), "vendor UI explains dynamic modifiers");
h.ok(inv.includes("getHarthmereCurrentVendorStockLine"), "vendor UI reads live vendor stock state");
h.ok(inv.includes("biomes:harthmere-open-vendor-trade"), "vendor UI opens through the Harthmere vendor trade event");
h.ok(inv.includes("Buy") && inv.includes("Sell") && inv.includes("Transaction log"), "vendor panel keeps buy/sell/log visible to users");
h.done();
