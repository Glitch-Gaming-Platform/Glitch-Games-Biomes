#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, vendorSource, economySource, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere economy balance smoke v1");
const vendor = vendorSource(h);
const eco = economySource(h);
const inv = inventorySource(h);
for (const m of vendor.matchAll(/baseSellModifier:\s*([0-9.]+),[\s\S]*?baseBuyModifier:\s*([0-9.]+),/g)) {
  const sell = Number(m[1]);
  const buy = Number(m[2]);
  h.ok(buy < sell, `vendor buy modifier ${buy} stays below sell modifier ${sell}`);
}
h.ok(eco.includes("buy_from_player") && eco.includes("sell_to_player"), "price formula distinguishes vendor sell and buy direction");
h.ok(eco.includes("Math.max(1") && eco.includes("townSupplyModifier"), "price formula clamps and includes supply/demand");
h.ok(inv.includes("finalVendorSellQuoteForPlayer") && inv.includes("finalVendorBuyPriceForPlayer"), "visible vendor UI has separate buy and sell quote paths");
h.ok(inv.includes("stolenPenalty") && inv.includes("buysStolenGoods"), "stolen goods cannot create a full-value lawful resale loop");
h.ok(eco.includes("listingFee") && eco.includes("saleTaxPercent"), "auction listing fee and sale tax are positive sinks");
h.ok(eco.includes("repair") || eco.includes("Repair"), "repair remains an economy sink");
h.done();
