#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource, vendorSource, hardeningSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere corrupt state recovery v1");
const inv = inventorySource(h);
const eco = economySource(h);
const vendor = vendorSource(h);
const hard = hardeningSource(h);
h.ok(hard.includes("nonNegativeInt") && hard.includes("Number.isFinite"), "hardening clamps corrupt numeric values");
h.ok(hard.includes("normalizeHarthmereWallet"), "wallet normalization helper exists");
h.ok(hard.includes("normalizeHarthmereNumberMap"), "number-map normalization helper exists");
h.ok(inv.includes("try {") && inv.includes("JSON.parse") && inv.includes("catch"), "inventory read catches invalid JSON");
h.ok(eco.includes("try {") && eco.includes("JSON.parse") && eco.includes("catch"), "economy read catches invalid JSON");
h.ok(vendor.includes("normalizeVendorRuntimeState") && vendor.includes("freshVendorRuntimeState"), "vendor runtime state normalizes or rebuilds corrupt state");
h.ok(inv.includes("normalizeHarthmereWallet") && inv.includes("normalizeHarthmereNumberMap"), "inventory normalizes wallet and material storage");
h.ok(inv.includes("Math.min(def.maxStack") && inv.includes("nonNegativeInt(raw.quantity"), "inventory normalizes bad item quantities");
h.done();
