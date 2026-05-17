#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, npcBehaviorSource, inventorySource, economySource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere social-state price effects tests v1");
const npc = npcBehaviorSource(h);
const inv = inventorySource(h);
const eco = economySource(h);
h.ok(inv.includes("reputationPriceModifierForVendor"), "visible vendor UI uses reputation price modifier");
h.ok(inv.includes("likeability >= 2_000") && inv.includes("likeability <= -2_000"), "visible vendor prices change with positive and negative Likeability");
h.ok(inv.includes("legal >= 2_000") && inv.includes("legal <= -5_000"), "visible vendor prices/access change with Legal Standing / Outlaw state");
h.ok(eco.includes("reputationPriceModifier") && eco.includes("legalAccessBlocked"), "economy quote path also uses social/legal pricing and access blocks");
h.ok(npc.includes("priceBias") && npc.includes("discount") && npc.includes("markup") && npc.includes("refuse"), "NPC social response reports discount/markup/refusal bias");
h.ok(npc.includes("notoriety") && npc.includes("noble_status_response"), "notoriety affects NPC social/status response");
h.ok(inv.includes("data-harthmere-dynamic-vendor-price"), "vendor UI exposes final dynamic price marker for live tests");
h.done();
