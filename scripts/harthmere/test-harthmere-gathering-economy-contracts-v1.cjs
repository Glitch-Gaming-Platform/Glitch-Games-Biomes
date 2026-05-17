#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere gathering economy contracts v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx", "Gathering system exists");
const src = h.read("src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx");
h.ok(/biomes\.localDev\.harthmere\.gatheringState\.v1/.test(src), "gathering uses versioned localStorage key");
h.ok(src.includes("resetHarthmereGatheringState"), "gathering has reset/debug path");
h.ok(src.includes("grantHarthmereItem") || src.includes("materialStorage"), "gathering routes yields into inventory/material economy");
h.ok(src.includes("town") || src.includes("economy"), "gathering can affect town economy state/logs");
h.done();
