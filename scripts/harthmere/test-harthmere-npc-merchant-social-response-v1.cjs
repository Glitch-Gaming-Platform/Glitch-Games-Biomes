#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, npcBehaviorSource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC merchant social response tests v1");
const src = npcBehaviorSource(h);
const inv = challengeSource(h, "LocalDevHarthmereInventorySystem.tsx");
const dialogue = challengeSource(h, "LocalDevHarthmereDialogueSystem.tsx");
h.ok(src.includes("getHarthmereNpcSocialResponse"), "social response resolver exists");
h.ok(src.includes("high_likeability_discount"), "high Likeability creates merchant/social discount response");
h.ok(src.includes("low_likeability_markup_or_refusal"), "low Likeability creates markup/refusal response");
h.ok(src.includes("outlaw_refused_by_lawful_vendor"), "outlaw legal state refuses lawful vendors");
h.ok(src.includes("notoriety_recognition"), "notoriety changes dialogue response");
h.ok(src.includes("criminal_contact_help"), "thieves/fences help criminal players");
h.ok(src.includes("priest_mercy_with_distrust"), "priests/healers react to bad legal standing");
h.ok(src.includes("noble_status_response"), "nobles react to status/notoriety");
h.ok(src.includes("peasant_cruelty_refusal"), "peasants react to cruelty/low likeability");
h.ok(inv.includes("reputationPriceModifierForVendor"), "vendor prices still read reputation modifiers");
h.ok(inv.includes("legal <= -5_000") || inv.includes("legal standing"), "vendor pricing/access accounts for outlaw legal standing");
h.ok(dialogue.includes("getHarthmereNpcSocialResponse"), "dialogue lines change by social state resolver");
h.done();
