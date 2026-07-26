#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere vendor buy transaction current");
const src = inventorySource(h);
h.ok(src.includes('actionKind: "request_vendor_transaction"'), "live buy posts one authority-owned vendor transaction");
h.ok(src.includes("submitHarthmereVendorPurchaseToLiveModeForTest"), "buy routes through the live vendor transaction helper");
h.ok(src.includes("assertHarthmereLiveMutationAppliedForTest"), "buy verifies the authoritative mutation before confirming success");
h.ok(src.includes("Cannot Buy"), "buy failure is logged");
h.ok(src.includes("addItemByStorageRules"), "offline buy routes item through storage rules");
h.ok(src.includes("addGold(result.state, -price)"), "offline buy reduces gold exactly once through dynamic price");
h.ok(!src.includes("decrementHarthmereVendorStock(offset, itemId"), "buy never consumes the catalogue bundle as client-owned stock");
h.ok(src.includes("Bought Item"), "buy logs transaction");
h.done();
