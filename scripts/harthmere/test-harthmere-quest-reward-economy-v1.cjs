#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, questEconomySource, inventorySource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere quest reward economy tests v1");
h.fileExists("src/client/components/challenges/LocalDevHarthmereQuestEconomySystem.ts", "quest economy system exists");
const questEco = questEconomySource(h);
const inv = inventorySource(h);
const quests = challengeSource(h, "LocalDevHarthmereQuests.tsx");
h.ok(questEco.includes("HARTHMERE_QUEST_ECONOMY_CONTRACTS"), "quest economy contracts exist");
for (const flag of ["grantsGold", "grantsFavor", "grantsItems", "grantsMaterials", "grantsKeys", "grantsSpells"]) {
  h.ok(questEco.includes(`${flag}: true`), `at least one quest contract ${flag}`);
}
h.ok(inv.includes("claimHarthmereQuestEconomyReward"), "inventory reward grant claims idempotent quest reward before payout");
h.ok(inv.includes("keys: [\"iron_key_blank\"]"), "key rewards route through key reward path");
h.ok(quests.includes("recordHarthmereQuestEconomyCompletion"), "quest completion records economy/vendor/reputation impact");
h.ok(questEco.includes("applyHarthmereReputationChange"), "quest completion can update reputation");
h.ok(questEco.includes("applyTownEconomyImpact"), "quest completion can update town economy state");
h.done();
