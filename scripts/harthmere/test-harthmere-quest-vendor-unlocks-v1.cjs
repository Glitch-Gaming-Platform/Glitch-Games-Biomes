#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, questEconomySource, inventorySource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere quest vendor unlock tests v1");
const questEco = questEconomySource(h);
const inv = inventorySource(h);
const quests = challengeSource(h, "LocalDevHarthmereQuests.tsx");
h.ok(questEco.includes("vendorUnlocks"), "quest contracts declare vendor unlocks");
h.ok(questEco.includes("isHarthmereVendorStockUnlocked"), "vendor stock unlock helper exists");
h.ok(questEco.includes("recordHarthmereQuestEconomyCompletion"), "quest completion records vendor unlocks");
h.ok(questEco.includes("vendorOffset") && questEco.includes("itemId") && questEco.includes("reason"), "vendor unlocks carry vendor offset, item id, and reason");
h.ok(inv.includes("isHarthmereVendorStockUnlocked(request.offset, stock.itemId)"), "visible vendor buy list hides locked quest stock");
h.ok(inv.includes("This stock unlocks after the related quest"), "direct buy path blocks locked quest stock");
h.ok(quests.includes("recordHarthmereQuestEconomyCompletion(quest.id, quest.title)"), "quest completion calls vendor unlock recorder");
h.done();
