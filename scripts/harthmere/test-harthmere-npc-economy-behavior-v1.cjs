#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, npcBehaviorSource, vendorSource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC economy behavior tests v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereNpcBehaviorSystem.ts", "NPC behavior system exists");
const src = npcBehaviorSource(h);
const vendor = vendorSource(h);
const npc = challengeSource(h, "LocalDevHarthmereNpcSystem.tsx");
const dialogue = challengeSource(h, "LocalDevHarthmereDialogueSystem.tsx");
h.ok(src.includes("HARTHMERE_NPC_BEHAVIOR_PROFILES"), "structured NPC behavior profile catalog exists");
h.ok(src.includes("HARTHMERE_KNOWN_NPC_OFFSETS"), "known NPC offset list exists");
h.ok(src.includes("dailyRoute") && src.includes("HarthmereNpcRouteStop"), "every NPC profile has daily route stops");
h.ok(src.includes('phase: HarthmereNpcDayPhase') || src.includes('phase,'), "route stops include time-of-day phase");
for (const phase of ["dawn", "morning", "midday", "afternoon", "evening", "night"]) {
  h.ok(src.includes(`\"${phase}\"`), `route system covers ${phase}`);
}
for (const offset of [5,6,7,8,9,11,29,30,31,33,34,43,47,57,63,65,67]) {
  h.ok(src.includes(`${offset}: npcBase`) || src.includes(`${offset}, \"`), `NPC ${offset} has assigned behavior/profile`);
}
h.ok(src.includes("sellsGoods") && src.includes("buysGoods"), "merchant NPCs declare sell and buy behavior");
h.ok(src.includes("isHarthmereVendorOffset"), "vendor NPC behavior is linked to unified vendor catalog");
h.ok(npc.includes("getHarthmereNpcBehaviorProfile"), "NPC system consumes structured behavior profiles");
h.ok(npc.includes("getHarthmereNpcRouteForHour"), "NPC system exposes active time-of-day route");
h.ok(dialogue.includes("getHarthmereNpcCurrentRouteLine"), "dialogue includes role/time route line");
h.ok(vendor.includes("HARTHMERE_VENDOR_CATALOG"), "one vendor catalog remains source of shop data");
h.done();
