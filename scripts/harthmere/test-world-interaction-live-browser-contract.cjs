#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.resolve(__dirname, "test-world-interaction-live-browser.cjs"),
  "utf8"
);

for (const required of [
  "HARTHMERE_GATHERING_AUTHORITY_NODES",
  "expectedCount === 29",
  "boards().length === 21",
  'page.keyboard.press("KeyF")',
  "orchard_missing_axe",
  "orchard_axe_harvest_drop_pickup",
  "orchard_depleted",
  "farm_no_tool_harvest",
  "fishing_any_native_rod",
  "high_skill_rejection",
  "findLocalByComponent",
  "new PickUpEvent",
  "harthmere-jobs-board-world-prompt",
  "harthmere-jobs-board-panel",
  "page load plus F-open should issue exactly one jobs-board state request",
  "HARTHMERE_E2E_IMAGE_ID is required",
  "HARTHMERE_E2E_BUILD_ID is required",
  "RestartCount",
  "OOMKilled",
  "e2e-jump.cjs",
]) {
  assert.ok(source.includes(required), `runner missing ${required}`);
}

assert.equal(
  /newContext\([\s\S]*newContext\(/.test(source),
  false,
  "runner must keep one Chromium context"
);
assert.equal(
  /Promise\.all\([\s\S]*(?:runBusiness|visitNode)/.test(source),
  false,
  "world rows must remain serial"
);

console.log("world interaction live-browser contract passed");
