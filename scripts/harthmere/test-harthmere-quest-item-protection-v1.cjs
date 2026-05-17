#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, inventorySource, questEconomySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere quest item protection tests v1");
const inv = inventorySource(h);
const questEco = questEconomySource(h);
h.ok(inv.includes('def.category === "quest_item"') && inv.includes("questPouch"), "quest items route to quest pouch");
h.ok(inv.includes("Quest items cannot be sold."), "quest items cannot be sold to vendors");
h.ok(inv.includes("Cannot Bank Quest Item"), "quest items cannot be banked as normal items");
h.ok(inv.includes("recoverHarthmereQuestItemIfLost"), "quest item recovery helper exists");
h.ok(inv.includes("recordHarthmereQuestItemRecovered"), "quest item recovery records ledger event");
h.ok(inv.includes("removeTemporaryHarthmereQuestItemsForAbandon"), "temporary quest items are removable on abandon/failure");
h.ok(questEco.includes("protectedQuestItems") && questEco.includes("temporaryQuestItems"), "quest economy contracts identify protected and temporary quest items");
h.ok(questEco.includes("cleanupHarthmereTemporaryQuestItemsForQuest"), "quest economy cleanup ledger exists");
h.done();
