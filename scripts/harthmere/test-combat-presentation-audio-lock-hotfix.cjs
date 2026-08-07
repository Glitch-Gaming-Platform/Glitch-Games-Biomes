#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "scripts/harthmere/combat-presentation-audio-lock-hotfix-2026-08-07.js"
  ),
  "utf8"
);

new Function(source);
assert.match(source, /resumeAudioFromTrustedGesture/);
assert.match(source, /giant_boss_stomp/);
assert.match(source, /pendingBossStomp/);
assert.match(source, /"pointerdown"/);
assert.match(source, /"keydown"/);
assert.match(source, /shouldSuspendPresentation\(\)/);
assert.match(source, /this\.root\?\.removeFromParent/);
assert.match(source, /DESKTOP_MARKER_LIMIT = 72/);
assert.match(source, /script\?\.name === "overlay"/);
assert.match(source, /script\?\.name === "camera"/);
assert.match(source, /__harthmereCombatLockOnDebug\?\.active === true/);
assert.match(source, /registerCleanup/);

console.log("PASS combat presentation/audio/lock mutable hotfix contract");
