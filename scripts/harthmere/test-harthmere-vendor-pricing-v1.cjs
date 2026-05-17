#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor pricing v1");
const inv = inventorySource(h); const cat = vendorSource(h);
h.ok(cat.includes("baseSellModifier") && cat.includes("baseBuyModifier"), "single vendor catalog owns buy/sell modifiers");
h.ok(inv.includes("finalVendorBuyPriceForPlayer") && inv.includes("finalVendorSellQuoteForPlayer"), "visible vendor UI uses one dynamic price path");
h.ok(inv.includes("reputationPriceModifierForVendor") && inv.includes("readHarthmereReputationState"), "reputation modifies displayed vendor prices");
h.ok(inv.includes("lawfulService") && inv.includes("legal"), "legal standing modifies displayed access/prices");
h.ok(inv.includes("data-harthmere-dynamic-vendor-price"), "vendor UI marks dynamic price display for live tests");
h.done();
