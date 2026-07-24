#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const runner = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  ),
  "utf8"
);

assert(
  runner.includes("E2E chase lower hill step") &&
    runner.includes("E2E chase upper hill step") &&
    runner.includes("maxChaseHeight"),
  "focused chase E2E must prove the NPC climbs a deterministic uneven hill fixture"
);
assert(
  runner.includes("HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND") &&
    runner.includes("effectiveChaseSpeed") &&
    runner.includes("Mucker chase remained too slow"),
  "focused chase E2E must reject snail-paced authoritative movement"
);
assert(
  runner.includes("native Mucker chase reaches the attacking frontend") &&
    runner.includes("native Mucker chase reaches the visible combat actor"),
  "focused chase E2E must finish the authoritative ECS to frontend render round trip"
);

console.log(
  "OK native chase E2E contract covers hill traversal, minimum speed, ECS sync, and visible rendering"
);
