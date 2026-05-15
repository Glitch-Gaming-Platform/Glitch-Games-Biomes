#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetsPath = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let failures = 0;

function ok(message) {
  console.log(`OK ${message}`);
}

function fail(message) {
  failures += 1;
  console.log(`FAIL ${message}`);
}

if (!fs.existsSync(assetsPath)) {
  console.error(`Missing ${assetsPath}`);
  process.exit(1);
}

const source = fs.readFileSync(assetsPath, "utf8");

source.includes('HARTHMERE_TOWN_DEBUG_RUNTIME_FIXES_VERSION = "harthmere-town-debug-runtime-fixes-v1"')
  ? ok("runtime fixes version marker exists")
  : fail("runtime fixes version marker missing");

source.includes("function normalizeHarthmereActorWander")
  ? ok("actor wander normalizer exists")
  : fail("actor wander normalizer missing");

source.includes("wander: normalizeHarthmereActorWander(asset, name, district, wander)")
  ? ok("A() normalizes authored wander")
  : fail("A() does not normalize authored wander");

source.includes("__harthmereNpcCollisionSummary")
  ? ok("NPC collision summary debug global exists")
  : fail("NPC collision summary debug global missing");

source.includes("__harthmereDumpNpcCollisionSummary")
  ? ok("NPC collision summary dump helper exists")
  : fail("NPC collision summary dump helper missing");

source.includes("biomes.localDev.harthmere.npcCollisionVerbose")
  ? ok("NPC collision console logging is opt-in")
  : fail("NPC collision console logging opt-in marker missing");

!source.includes("instance.collisionBlockCount % 90")
  ? ok("old high-volume NPC collision console cadence removed")
  : fail("old high-volume NPC collision console cadence still present");

if (failures > 0) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: PASS");
