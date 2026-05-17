#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, economySource, inventorySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere wallet source/sink ledger v1");
const src = economySource(h) + "\n" + inventorySource(h);
for (const label of ["Quest Reward", "Fine Paid", "Bank Upgrade", "Smuggling", "Auction Sale", "Vendor Purchase", "Vendor Sale"]) {
  h.ok(src.includes(label), `${label} is represented in wallet/economy logs`);
}
h.ok(src.includes("listingFee") || src.includes("listing fee") || src.includes("Listing fee"), "Auction listing fee is represented in wallet/economy logs");
h.ok(src.includes("source") && src.includes("sink") && src.includes("auction") && src.includes("black_market"), "ledger has source/sink/auction/black-market event types");
h.done();
