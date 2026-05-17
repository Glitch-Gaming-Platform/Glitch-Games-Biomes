#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness, questEconomySource, inventorySource, challengeSource } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere quest repeat reward abuse tests v1");
const questEco = questEconomySource(h);
const inv = inventorySource(h);
const quests = challengeSource(h, "LocalDevHarthmereQuests.tsx");
h.ok(questEco.includes("completedRewardClaims"), "completed quest reward claims are tracked");
h.ok(questEco.includes("Reward Duplicate Blocked"), "duplicate non-repeatable quest rewards are blocked");
h.ok(questEco.includes("repeatableCooldowns"), "repeatable quest cooldowns are tracked");
h.ok(questEco.includes("isHarthmereRepeatableQuestAvailable"), "repeatable quest availability helper exists");
h.ok(questEco.includes("Repeatable Reward Cooldown"), "repeatable reward cooldown blocks farming");
h.ok(inv.includes("Quest Reward Blocked"), "inventory logs blocked duplicate/cooldown reward attempts");
h.ok(quests.includes("repeatable: true"), "at least one quest is marked repeatable for cooldown testing");
h.ok(quests.includes("!isHarthmereRepeatableQuestAvailable(quest.id)"), "quest availability respects repeatable cooldowns");
h.done();
