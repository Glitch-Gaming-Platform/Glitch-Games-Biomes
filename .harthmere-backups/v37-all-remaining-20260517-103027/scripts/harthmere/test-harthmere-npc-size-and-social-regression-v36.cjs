#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures += 1;
    console.log(`FAIL ${rel} exists`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}
function ok(label, condition, details = []) {
  if (condition) console.log(`OK ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
    for (const d of details) console.log(`  - ${d}`);
  }
}

console.log("== Harthmere NPC size/social regression tests v36 ==");
console.log(`Root: ${root}\n`);
const npcs = read("src/client/game/resources/npcs.ts");
const socialize = read("src/shared/npc/behavior/socialize.ts");

ok(
  "NPC hit/death scale bounce preserves real base scale",
  /harthmereBaseScaleBeforeHitV13/.test(npcs) && /baseScale\[0\] \* meshScale/.test(npcs) && /baseScale\[1\] \* meshScale/.test(npcs) && /baseScale\[2\] \* meshScale/.test(npcs),
  ["hit animation must multiply the entity.size/baseBox scale, not replace it with a scalar"]
);
ok(
  "old scalar hit scale overwrite is gone",
  !/\.scale\.set\(meshScale, meshScale, meshScale\)/.test(npcs),
  ["this exact pattern caused size-varied NPCs to snap back to 1x after being hit"]
);
ok(
  "socialize meeting duration samples duration range, not distance constant",
  /randomInRange\(\s*this\.params\.minMeetingDuration,\s*this\.params\.maxMeetingDuration\s*\)/s.test(socialize) && !/Math\.random\(\) \* MAX_MEETING_DISTANCE/.test(socialize),
  ["MAX_MEETING_DISTANCE made every meeting clamp to the minimum duration"]
);
ok(
  "socialize can pick ordinary living NPCs, not only quest givers",
  !/!npc\?\.quest_giver/.test(socialize) && /!npc\?\.position/.test(socialize) && /npc\.health\?\.hp/.test(socialize),
  ["quest_giver-only filter prevented normal town NPC social behavior"]
);

console.log("");
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
