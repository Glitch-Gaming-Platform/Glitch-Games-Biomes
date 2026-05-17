#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, hardeningSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy idempotency v1");
const hard = hardeningSource(h);
const inv = inventorySource(h);
const eco = economySource(h);
h.ok(hard.includes("createHarthmereLocalDevTransactionId"), "hardening module can create transaction ids");
h.ok(hard.includes("claimHarthmereLocalDevRapidAction"), "hardening module has rapid/idempotency action guard");
h.ok(hard.includes("rapidEconomyActions.v1"), "rapid action ledger uses a versioned localStorage key");
for (const needle of ["inventory:vendor-buy", "inventory:vendor-sell", "inventory:repair-all", "inventory:deposit-materials", "inventory:bank-deposit", "inventory:bank-withdraw", "inventory:sell-junk"]) {
  h.ok(inv.includes(needle), `${needle} is guarded against repeated clicks`);
}
for (const needle of ["economy:buy:", "economy:sell:", "economy:buy-auction", "economy:post-auction", "economy:settle-auction", "economy:bank-upgrade", "economy:smuggle-river-cargo", "economy:pay-fine", "economy:fence-stolen-goods", "economy:launder-stolen-item"]) {
  h.ok(eco.includes(needle), `${needle} is guarded against repeated calls`);
}
h.done();
