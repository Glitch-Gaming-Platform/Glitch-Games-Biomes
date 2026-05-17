#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere reputation economy contracts v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereReputation.tsx", "Reputation system exists");
const rep = h.read("src/client/components/challenges/LocalDevHarthmereReputation.tsx");
const inv = h.read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const eco = h.read("src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx");
h.ok(/biomes\.localDev\.harthmere\.reputation(?:State)?\.v1/.test(rep), "reputation uses versioned localStorage key");
h.ok(rep.includes("likeability") && rep.includes("legal") && rep.includes("notoriety"), "reputation tracks likeability/legal/notoriety");
h.ok(rep.includes("resetHarthmereReputation"), "reputation has reset/debug path");
h.ok(inv.includes("reputationPriceModifierForVendor") || eco.includes("reputation"), "vendor pricing is wired to reputation/social state");
h.done();
