#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere building economy contracts current");
h.fileExists("src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx", "Building system exists");
const src = h.read("src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx");
h.ok(/biomes\.localDev\.harthmere\.buildingState/.test(src), "building uses unified localStorage key");
h.ok(src.includes("property") && src.includes("tax"), "building/property economy includes property and tax concepts");
h.ok(src.includes("resetHarthmereBuildingState"), "building has reset/debug path");
h.ok(src.includes("ledger") || src.includes("recent") || src.includes("log"), "building/property economy has ledger/recent path");
h.done();
