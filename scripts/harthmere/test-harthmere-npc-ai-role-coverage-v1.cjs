#!/usr/bin/env node
const { createHarness, aiSource, npcBehaviorSource, npcSystemSource } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI role coverage tests v1"); const src=aiSource(h), behavior=npcBehaviorSource(h), npc=npcSystemSource(h);
h.ok(src.includes("HARTHMERE_ROLE_AI_PROFILES"),"role AI registry exists"); h.ok(src.includes("validateHarthmereNpcAiCoverage"),"coverage helper exists"); h.ok(src.includes("HARTHMERE_KNOWN_NPC_OFFSETS"),"AI coverage checks known offsets");
for (const kind of ["merchant","guard","civilian","peasant","thief","priest","noble","craftsman","service","scholar","creature"]) { h.ok(new RegExp(`${kind}:\\s*\\{[\\s\\S]*?requiredLayers`).test(src), `${kind} has required layers`); h.ok(new RegExp(`${kind}:\\s*\\{[\\s\\S]*?roleFacingLine`).test(src), `${kind} has role-facing line`); }
h.ok(/HARTHMERE_KNOWN_NPC_OFFSETS\s*=\s*\[[\s\S]*?70/.test(behavior),"known NPC registry reaches latest named NPCs");
h.ok(npc.includes("chooseHarthmereNpcAiDecision"), "NPC dialogue path uses AI decision helper");
h.ok(npc.includes("aiDecision.roleLine"), "NPC dialogue exposes only role-facing AI line");
h.ok(!/real daily route|game mechanics|conversation practical|local-dev dialogue|overall game/i.test(npc), "NPC dialogue avoids meta/system phrasing");
for (const token of ["missingOffsets","missingKinds","missingRequiredLayers"]) h.ok(src.includes(token), `coverage reports ${token}`); h.done();
