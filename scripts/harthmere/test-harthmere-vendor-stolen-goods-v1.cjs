#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere vendor stolen goods v1");
const inv = inventorySource(h); const eco = economySource(h); const cat = vendorSource(h);
h.ok(cat.includes("buysStolenGoods: true"), "fence/black-market vendors can buy stolen goods");
h.ok(cat.includes("refusesStolenGoods"), "lawful stolen-goods refusal exists in source of truth");
h.ok(inv.includes("Lawful vendors refuse stolen goods"), "lawful vendor sell path refuses stolen goods");
h.ok(eco.includes("black_market_coins"), "fence sales can create black-market currency");
h.ok(eco.includes("Laundered") || eco.includes("launder"), "laundering path exists");
h.done();
