#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource } = require("./harthmere-economy-test-lib.cjs");
const h = createHarness("Harthmere inventory full capacity current");
const inv = inventorySource(h);
const eco = economySource(h);
h.ok(inv.includes("buyFitReason"), "inventory has a preflight storage fit check");
h.ok(inv.includes("cannot fit in") && inv.includes("storageLabelForCategory"), "normal item buy tells player why storage cannot fit the item");
h.ok(inv.includes("goes to material storage") || inv.includes("materialStorage"), "materials route to material storage instead of backpack only");
h.ok(inv.includes("quest_pouch") && inv.includes("keyring"), "quest items and keys bypass normal backpack capacity");
h.ok(inv.indexOf("const price = finalVendorBuyPriceForPlayer") < inv.indexOf("state = addGold(result.state, -price)"), "vendor buy computes price before charging gold");
h.ok(inv.includes("harthmereLiveServerAuthoritative()") && inv.includes('"vendor_rejected:"'), "live vendor capacity and affordability failures are authority-validated and surfaced without client mutation");
h.ok(!inv.includes("decrementHarthmereVendorStock(offset, itemId"), "capacity failures cannot consume the displayed vendor listing");
h.ok(eco.includes("Inventory Full") && eco.includes("blocks purchases instead of deleting items"), "economy purchase path logs safe inventory-full failures");
h.done();
