#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetFile = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(assetFile, "utf8");

const checks = [
  ["debug version", "HARTHMERE_TOWN_WALK_DEBUG_VERSION"],
  ["debug object report type", "HarthmereTownWalkDebugObjectReport"],
  ["debug overlay group", "townWalkDebugOverlay"],
  ["metadata attach method", "attachHarthmereTownWalkDebugMetadata"],
  ["metadata attached to clones", "this.attachHarthmereTownWalkDebugMetadata(\n          placement,\n          clone"],
  ["metadata attached to procedural life", "this.attachHarthmereTownWalkDebugMetadata(\n          placement,\n          proceduralLife"],
  ["console API", "__harthmereTownWalkDebug = this.createHarthmereTownWalkDebugApi()"],
  ["walk sample command", "sample: (note = \"\")"],
  ["watch command", "watch: (radius = 12, intervalMs = 1000)"],
  ["download command", "download: (filename = `harthmere-town-walk-debug-${Date.now()}.json`)"],
  ["collision missing flag", "walk_through_collision_missing"],
  ["animated prop flag", "animated_prop_possible_random_open_close"],
  ["ground suspect flag", "actor_or_npc_below_ground"],
  ["known extra brace repaired", "function findHarthmereNpcCollisionObstacle"],
];

let failures = 0;
for (const [label, needle] of checks) {
  if (src.includes(needle)) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    failures += 1;
  }
}

if (src.includes("const withoutMagicClips = (clips: string[]) =>\n    const withoutMagicClips")) {
  console.log("FAIL duplicate withoutMagicClips patch fallout remains");
  failures += 1;
} else {
  console.log("OK no duplicate withoutMagicClips patch fallout");
}

if (src.includes("return undefined;\n}\n}\n\nconst STONE_THEME")) {
  console.log("FAIL extra brace after findHarthmereNpcCollisionObstacle remains");
  failures += 1;
} else {
  console.log("OK no extra brace after findHarthmereNpcCollisionObstacle");
}

console.log();
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
