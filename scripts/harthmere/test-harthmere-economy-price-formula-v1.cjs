#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, economySource, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy price formula v1");
const src = economySource(h) + "\n" + inventorySource(h);
for (const term of ["baseSellModifier", "baseBuyModifier", "activeShortages", "activeSurpluses", "tier", "likeability", "legal", "outlaw"]) h.ok(src.includes(term), `price formula accounts for ${term}`);
h.ok(src.includes("buy_from_player") && src.includes("sell_to_player"), "vendor buy and sell pricing modes exist");
h.done();
