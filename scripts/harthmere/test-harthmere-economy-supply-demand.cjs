#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, economySource } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere economy supply/demand current");
const src = economySource(h);
for (const term of ["foodSupply", "medicineSupply", "oreSupply", "demandTags", "supplySources", "sinkUses", "activeShortages", "activeSurpluses"]) h.ok(src.includes(term), `supply/demand tracks ${term}`);
h.ok(src.includes("activeShortages") && src.includes("activeSurpluses"), "shortage/surplus logic exists");
h.done();
