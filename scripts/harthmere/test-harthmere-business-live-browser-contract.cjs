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
  "__harthmereLivePlayerDebug",
  "Enter Game safety modal must close before business input",
  "In-World Shift",
  "Detached customer card arena must remain retired",
  "Start shift at counter",
  "shift-started-behind-counter",
  "data-harthmere-business-customer-talk",
  "Active customer must not show ordinary Chit Chat",
  "customer-talk-service-options",
  "authoritative-service-outcome",
  "authoritativeEntity",
  ".map((row, offset) => [ids[offset], row?.[1]])",
  "Customer must physically reach the audited counter point",
  "Customer must reach the authored departure point before despawn",
  "Customer must be safely outside the building before despawn",
  "queue advance",
  "End shift",
  "cleanupActorBusinessSessions",
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
  "localStorage.setItem(\"harthmere.business",
  "spawning a customer at the counter",
]) {
  assert(!runner.includes(forbidden), `browser runner contains ${forbidden}`);
}

assert(sessionEcs.includes("npcEntity("));
assert(sessionEcs.includes("npc_state"));
assert(sessionEcs.includes("buildHarthmereBusinessCustomerSessionNpcChanges"));
assert(animaBehavior.includes("AStarPathfinder"));
assert(animaBehavior.includes("GraphImpl"));
assert(animaBehavior.includes('return "despawn_ready"'));
assert(logic.includes('return "businessCustomer"'));

console.log(
  "PASS business live-browser contract (19 rows, native ECS + Anima movement, one warm serial browser)"
);
