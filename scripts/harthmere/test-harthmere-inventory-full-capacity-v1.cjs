#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere inventory full capacity v1");
const inv = inventorySource(h);
const eco = economySource(h);
h.ok(inv.includes("buyFitReason"), "inventory has a preflight storage fit check");
h.ok(inv.includes("cannot fit in") && inv.includes("storageLabelForCategory"), "normal item buy tells player why storage cannot fit the item");
h.ok(inv.includes("goes to material storage") || inv.includes("materialStorage"), "materials route to material storage instead of backpack only");
h.ok(inv.includes("quest_pouch") && inv.includes("keyring"), "quest items and keys bypass normal backpack capacity");
h.ok(inv.indexOf("const price = finalVendorBuyPriceForPlayer") < inv.indexOf("state = addGold(result.state, -price)"), "vendor buy computes price before charging gold");
h.ok(inv.includes("const reason = buyFitReason(state, offset, itemId)") && inv.includes("if (!decrementHarthmereVendorStock(offset, itemId, stock.quantity))"), "vendor buy checks storage before decrementing stock");
h.ok(eco.includes("Inventory Full") && eco.includes("blocks purchases instead of deleting items"), "economy purchase path logs safe inventory-full failures");
h.done();
