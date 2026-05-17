#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere guild economy contracts v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx", "Guild system exists");
const src = h.read("src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx");
h.ok(/biomes\.localDev\.harthmere\.guildState\.v1/.test(src), "guild uses versioned localStorage key");
h.ok(src.includes("treasury") && src.includes("bank"), "guild has treasury and bank economy surfaces");
h.ok(src.includes("resetHarthmereGuildState"), "guild has reset/debug path");
h.ok(src.includes("recent") || src.includes("log"), "guild economy has log/recent path");
h.done();
