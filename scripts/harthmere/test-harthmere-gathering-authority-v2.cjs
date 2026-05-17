#!/usr/bin/env node
/* eslint-disable no-console */
const { createHarness } = require("./harthmere-economy-test-lib-v1.cjs");
const h = createHarness("Harthmere gathering authority and missing-rules coverage v2");
const authorityPath = "src/client/components/challenges/LocalDevHarthmereWorldAuthority.ts";
const gatheringPath = "src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx";
h.fileExists(authorityPath, "mock-authoritative world authority module exists");
const authority = h.read(authorityPath);
const gathering = h.read(gatheringPath);
for (const symbol of [
  "HARTHMERE_AUTHORITY_MODE",
  "createHarthmereMockServerTransport",
  "createHarthmereLiveServerTransport",
  "validateHarthmereGatherAttempt",
  "reserveHarthmereResourceNode",
  "releaseHarthmereResourceReservation",
  "applyHarthmereGatheringToolDurability",
  "routeHarthmereGatheredMaterials",
  "calculateHarthmereResourceTrackingUnlocks",
  "planHarthmereGatheringContractProgress",
  "planHarthmereRefinement",
  "rollHarthmereMaterialQuality",
]) {
  h.ok(authority.includes(symbol), `authority exports ${symbol}`);
}
for (const ruleNeedle of [
  "too_far",
  "blocked_line_of_sight",
  "isDead",
  "isDowned",
  "isStunned",
  "inCombat",
  "mounted",
  "swimming",
  "flying",
  "trading",
  "teleporting",
  "loading",
  "inCutscene",
  "wrong_quest_phase",
  "node_reserved",
  "requiredWeather",
  "requiredTimeOfDay",
  "requiredSeason",
  "anti_bot_review",
  "tool_broken",
  "material_storage",
  "quest_pouch",
  "wallet",
  "overflow_recovery",
]) {
  h.ok(authority.includes(ruleNeedle), `gathering authority covers ${ruleNeedle}`);
}
h.ok(gathering.includes("validateHarthmereGatherAttempt"), "performHarthmereGather uses authority validation");
h.ok(gathering.includes("routeHarthmereGatheredMaterials"), "performHarthmereGather routes inventory before grant");
h.ok(gathering.includes("Authority Blocked"), "gathering logs authority failures");
h.ok(gathering.includes("Storage Blocked"), "gathering blocks full storage without deleting materials");
h.ok(gathering.includes("__harthmereGatheringAuthorityTestHooks"), "gathering exposes deterministic test hooks");
h.done();
