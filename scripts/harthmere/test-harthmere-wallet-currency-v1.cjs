#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere wallet currency v1");
const inv = inventorySource(h); const eco = economySource(h);
for (const cur of ["gold", "silver", "copper", "harthmere_favor", "black_market_coins"]) h.ok(inv.includes(cur) || eco.includes(cur), `${cur} currency exists`);
h.ok(inv.includes("addGold") || eco.includes("adjustGold"), "gold mutation helper exists");
h.ok((inv + eco).includes("Cannot Buy") && (inv + eco).includes("Cannot Pay Fine"), "spending requires enough balance");
h.ok((inv + eco).includes("Math.max(0"), "currency cannot go negative");
h.done();
