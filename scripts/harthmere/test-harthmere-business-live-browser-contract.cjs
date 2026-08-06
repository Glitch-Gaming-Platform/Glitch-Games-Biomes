#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  HARTHMERE_BUSINESS_INTERIORS,
} = require("../../src/shared/harthmere/business_interior_runtime");

const root = path.resolve(__dirname, "../..");
const runner = fs.readFileSync(
  path.join(root, "scripts/harthmere/test-harthmere-business-live-browser.cjs"),
  "utf8"
);
const sessionEcs = fs.readFileSync(
  path.join(root, "src/server/harthmere/business_customer_session_ecs.ts"),
  "utf8"
);
const animaBehavior = fs.readFileSync(
  path.join(root, "src/shared/npc/behavior/business_customer_tick.ts"),
  "utf8"
);
const logic = fs.readFileSync(
  path.join(root, "src/shared/npc/logic.ts"),
  "utf8"
);

assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
assert.equal(
  new Set(HARTHMERE_BUSINESS_INTERIORS.map((row) => row.outpostId)).size,
  19
);

for (const required of [
  "HARTHMERE_BUSINESS_E2E_IDS",
  "HARTHMERE_E2E_IMAGE_ID",
  "HARTHMERE_E2E_BUILD_ID",
  "HARTHMERE_E2E_ANIMA_CONTAINER",
  "HARTHMERE_E2E_ANIMA_READY_PORT",
  "HARTHMERE_E2E_ANIMA_IMAGE_ID",
  "HARTHMERE_E2E_CONTROL_TOKEN",
  "HARTHMERE_NATIVE_ECS_E2E",
  "GLITCH_FOCUSED_NATIVE_E2E_STACK",
  "RestartCount",
  "OOMKilled",
  "redisPong",
  "actualAnimaImageId",
  "configuredBuildId",
  "ANIMA_HFC_WRITES",
  "Anima must answer ready before testing",
  "HFC Bootstrap complete",
  "e2e-jump.cjs",
  "__harthmereBusinessInteriors",
  "Desktop business interiors must use bounded nearby streaming",
  "lod0WorldBounds",
  "furniture escaped in front of the building",
  "HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS",
  "nativeCollisionProxyCount",
  "must materialize every manifest collision proxy",
  "harthmereBusinessCraftingStationSeedByOutpost",
  "visible machine collision must not be duplicated",
  "__harthmereBusinessBoardDebug",
  "/api/harthmere/live_mode_economy_state",
  "activeSessionForBusiness",
  "snapshot must never expose another player's customer shift",
  "No stale or foreign customer card may remain",
  "__harthmereLivePlayerDebug",
  "Enter Game safety modal must close before business input",
  "waitForActorReady",
  "do not wait for browser bridges after an SSR failure",
  "player placement did not remain alive and stable",
  "In-World Shift",
  "Detached customer card arena must remain retired",
  "Start customer shift",
  "player_closed_board",
  "Business interface must expose one player-readable close control",
  "waitForStableGameplayOverlayClear",
  "initial_board_close",
  "assertPlayerReadableBusinessUi",
  "exposed a backend code to the player",
  'data-harthmere-business-prompt="true"',
  "shift-started-behind-counter",
  "data-harthmere-business-patience",
  "visible patience countdown",
  "customer-patience-countdown",
  "current?.health?.maxHp ?? 100",
  "TriggerState.clone",
  "writeHarthmereNativeVitals",
  "stamina: vitals.maxStamina",
  "lastTickMs: Date.now()",
  "authoritativeVitals.stamina > 0",
  "already-queued",
  "data-harthmere-business-customer-talk",
  "Active customer must not show ordinary Chit Chat",
  "Business choices are deliberately",
  "visible while the request text types",
  "customer-talk-service-options",
  "A fresh business board open must start on Overview",
  "Reopening the business board must reset to Overview",
  "data-world-interaction-owner",
  "harthmere:business-customer:",
  "native:npc:${entityId}:",
  "Exactly one same-customer interaction surface must own F",
  "data-business-customer-direct-talk-ready",
  "data-business-customer-effective-phase",
  "Customer patience must be capped at 30 seconds",
  "A business shift must contain exactly ten customers",
  "Each next customer must have two fewer patience seconds",
  "customer-correct-reward-feedback",
  "Correct service must visibly award gold",
  "Correct service must visibly award business points",
  "Result feedback must use a player-readable customer name",
  "Result feedback must stay stable while its one-time typewriter completes",
  "Continue to next customer",
  "Correct result must remain readable before automatic advancement",
  "Incorrect result must remain readable before automatic advancement",
  "customer-incorrect-reward-feedback",
  "Incorrect service must visibly award zero gold",
  "Incorrect service must visibly award zero business points",
  'keyboard.press("KeyF")',
  "Real F on the customer must not reopen the business board",
  "authoritative-service-outcome",
  "authoritativeEntity",
  ".map((row, offset) => [ids[offset], row?.[1]])",
  "Customer must physically reach the audited counter point",
  "Customer must reach the authored departure point before despawn",
  "Customer must be safely outside the building before despawn",
  "queue advance",
  "End shift",
  "endedByLeavingBusiness",
  "stationaryPatronCount",
  "ran across the shop before the shift started",
  "authoritative shift end after leaving the business",
  "cleanupActorBusinessSessions",
  "browserRecovered",
  "String(session.actorId) === String(actorId)",
  "economy_rejected:",
  "Cannot clean unknown business session",
  "end_business_customer_session",
]) {
  assert(runner.includes(required), `browser runner is missing ${required}`);
}

for (const forbidden of [
  "docker build",
  "next build",
  'localStorage.setItem("harthmere.business',
  "spawning a customer at the counter",
  'resources.set("/game_modal", { kind: "talk_to_npc"',
  "BUSINESS_E2E_MIN_ACTOR_HP",
]) {
  assert(!runner.includes(forbidden), `browser runner contains ${forbidden}`);
}

assert(sessionEcs.includes("npcEntity("));
assert(sessionEcs.includes("npc_state"));
assert(sessionEcs.includes("buildHarthmereBusinessCustomerSessionNpcChanges"));
assert(animaBehavior.includes("Drive that authored route directly in"));
assert(animaBehavior.includes("kinematic: true"));
assert(animaBehavior.includes("npc.setPosition(nextPosition)"));
assert(!animaBehavior.includes("AStarPathfinder"));
assert(!animaBehavior.includes("GraphImpl"));
assert(animaBehavior.includes('return "despawn_ready"'));
assert(logic.includes('return "businessCustomer"'));
assert(logic.includes("businessCustomerKinematic"));

console.log(
  "PASS business live-browser contract (19 rows, native ECS + Anima movement, one warm serial browser)"
);
