#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor rapid-click abuse v1");
const inv = inventorySource(h);
const eco = economySource(h);
const vendor = vendorSource(h);
h.ok(inv.includes("claimHarthmereLocalDevRapidAction(`inventory:vendor-buy"), "vendor buy path ignores double-click abuse");
h.ok(inv.includes("claimHarthmereLocalDevRapidAction(`inventory:vendor-sell"), "vendor sell path ignores double-click abuse");
h.ok(inv.includes("decrementHarthmereVendorStock") && inv.includes("restoreHarthmereVendorStock"), "buy path decrements stock and restores on failed atomic insert");
h.ok(inv.includes("spendHarthmereVendorGold") && inv.includes("receiveHarthmereVendorStock"), "sell path checks vendor gold and receives sold stock");
h.ok(eco.includes("claimHarthmereLocalDevRapidAction(`economy:buy-auction"), "auction purchase has rapid-click guard");
h.ok(vendor.includes("Stock Decremented") && vendor.includes("Vendor Gold Too Low"), "vendor runtime ledger records stock/gold guard outcomes");
h.done();
