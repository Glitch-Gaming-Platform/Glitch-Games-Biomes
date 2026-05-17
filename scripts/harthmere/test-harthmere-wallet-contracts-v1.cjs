#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere wallet contracts v1");
const src = inventorySource(h) + "\n" + economySource(h);
h.ok(src.includes("wallet: Record<string, number>"), "wallet has currency map contract");
h.ok(src.includes("gold") && src.includes("silver") && src.includes("copper") && src.includes("harthmere_favor"), "starter wallet includes gold/silver/copper/harthmere_favor");
h.ok(src.includes("black_market_coins"), "black market coins can be created safely");
h.ok(src.includes("Math.max(0") || src.includes("Math.max(0,"), "wallet mutation clamps currencies away from negative values");
h.done();
