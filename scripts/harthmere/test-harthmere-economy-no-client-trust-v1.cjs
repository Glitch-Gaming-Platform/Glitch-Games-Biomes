#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, hardeningSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere no-client-trust guardrails v1");
const hard = hardeningSource(h);
h.ok(hard.includes("Local-dev Harthmere economy hardening helpers"), "hardening file is explicitly local-dev only");
h.ok(hard.includes("server-authoritative-economy-required-before-production"), "server-authoritative migration marker exists");
h.ok(hard.includes("Do not promote this localStorage implementation"), "file warns against production client-trust economy");
h.ok(inventorySource(h).includes("LocalDevHarthmereInventorySystem"), "inventory path remains clearly LocalDev");
h.ok(economySource(h).includes("LocalDevHarthmereEconomySystem"), "economy path remains clearly LocalDev");
h.ok(!h.exists("src/server/harthmere/economy/clientTrustedWallet.ts"), "no server path named clientTrustedWallet exists");
h.done();
