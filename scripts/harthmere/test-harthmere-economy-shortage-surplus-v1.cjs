#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy shortage/surplus v1");
const src = economySource(h);
h.ok(src.includes("activeShortages") && src.includes("activeSurpluses"), "town tracks active shortages and surpluses");
h.ok(src.includes("Shortage") || src.includes("shortage"), "shortage label/log path exists");
h.ok(src.includes("Surplus") || src.includes("surplus"), "surplus label/log path exists");
h.ok(src.includes("buy price stayed below base value") || src.includes("baseBuyModifier"), "buy price remains below sell price to avoid infinite gold loop");
h.done();
