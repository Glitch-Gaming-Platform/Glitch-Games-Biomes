#!/usr/bin/env node
"use strict";
/* HARTHMERE_PLAYER_NO_VERTICAL_TOWN_COLLISION_BY_DEFAULT_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) console.log(`  - ${line}`);
}

console.log("== Harthmere player no vertical town collision by default tests v1 ==");
console.log(`Root: ${root}`);
console.log();

if (!fs.existsSync(playerPath)) {
  fail("player.ts exists", `Missing ${playerPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("player.ts exists");

const text = fs.readFileSync(playerPath, "utf8");

if (/HARTHMERE_DISABLE_VERTICAL_TOWN_COLLISION_BY_DEFAULT_V2/.test(text)) {
  pass("vertical town collision disable-by-default marker exists");
} else {
  fail("vertical town collision disable-by-default marker exists");
}

if (/function shouldRunHarthmereLocalDevVerticalTownCollisionBridge/.test(text)) {
  pass("vertical bridge has explicit opt-in guard");
} else {
  fail("vertical bridge has explicit opt-in guard");
}

const callIndex = text.indexOf("intersectLocalDevHarthmereTownCollision([v0, v1], fn)");
if (callIndex < 0) {
  fail("legacy vertical bridge call still exists for optional debugging", "Expected call inside opt-in guard.");
} else {
  const before = text.slice(Math.max(0, callIndex - 350), callIndex);
  if (/shouldRunHarthmereLocalDevVerticalTownCollisionBridge\(\)/.test(before)) {
    pass("legacy vertical bridge call is gated behind explicit opt-in");
  } else {
    fail("legacy vertical bridge call is gated behind explicit opt-in", before);
  }
}

if (/markHarthmereLocalDevTownCollisionDisabledByDefault\(\)/.test(text)) {
  pass("disabled-by-default stats are written when vertical bridge is off");
} else {
  fail("disabled-by-default stats are written when vertical bridge is off");
}

if (/HARTHMERE_LOCAL_DEV_HORIZONTAL_PLAYER_TOWN_COLLISION_VERSION/.test(text) && /resolveHarthmereLocalDevHorizontal|intersectLocalDevHarthmereHorizontal|HorizontalPlayerTownCollision/.test(text)) {
  pass("horizontal town collision path remains present");
} else {
  fail("horizontal town collision path remains present", "Do not remove horizontal anti-walk-through collision.");
}

if (/__harthmereHorizontalPlayerTownCollisionStats/.test(text)) {
  pass("horizontal collision browser stats remain present");
} else {
  fail("horizontal collision browser stats remain present");
}

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
