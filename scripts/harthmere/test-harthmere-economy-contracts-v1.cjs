#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy contracts v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx", "Economy system exists");
const src = economySource(h);
h.ok(/biomes\.localDev\.harthmere\.economyState\.v1/.test(src), "economy uses versioned localStorage key");
h.ok(src.includes("readHarthmereEconomyState") && src.includes("writeHarthmereEconomyState"), "economy has read/write state contract");
h.ok(src.includes("recordHarthmereEconomicEvent") && src.includes("appendEconomyLog"), "all economy actions have log path");
h.ok(src.includes("resetEconomy") && src.includes("Reset local-dev economy"), "economy has reset/debug path");
h.ok(src.includes("HARTHMERE_VENDOR_ECONOMY_PROFILES"), "economy uses unified vendor profile catalog");
h.done();
