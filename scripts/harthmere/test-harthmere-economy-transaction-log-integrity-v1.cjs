#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere transaction log integrity v1");
const inv = inventorySource(h);
const eco = economySource(h);
const vendor = vendorSource(h);
for (const field of ["system", "actorId", "action", "detail", "reason", "success"]) {
  h.ok(inv.includes(field), `inventory log includes ${field}`);
}
for (const field of ["system", "actorId", "type", "label", "detail", "currency", "amount", "reason", "success"]) {
  h.ok(eco.includes(field), `economy log includes ${field}`);
}
for (const field of ["recentTransactions", "vendorId", "itemId", "quantity", "currency", "amount", "success", "reason"]) {
  h.ok(vendor.includes(field), `vendor runtime transaction log includes ${field}`);
}
h.ok(/\.slice\(0,\s*18\)/.test(inv), "inventory logs are bounded append-only recent lists");
h.ok(/\.slice\(0,\s*16\)/.test(eco), "economy logs are bounded append-only recent lists");
h.ok(/\.slice\(0,\s*40\)/.test(vendor), "vendor runtime logs are bounded append-only recent lists");
h.done();
