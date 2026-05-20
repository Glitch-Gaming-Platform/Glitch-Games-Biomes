#!/usr/bin/env node
const fs = require("fs");
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exitCode = 1;
  } else {
    console.log("OK", msg);
  }
}
const s = fs.readFileSync("src/shared/game/collision.ts", "utf8");
ok(s.includes("SNAPSHOT_COLLISION_MISSING_AABB_COMPAT_V1"), "collision missing-AABB compatibility marker is present");
ok(s.includes("warnMissingCollisionAabbV1"), "missing-AABB warning helper exists");
ok(s.includes("table.get(id);"), "collision lookup no longer non-null asserts entity lookup");
ok(s.includes("if (!entityAabb)"), "missing entity AABB is handled");
ok(s.includes("fn(entityAabb, entity);"), "valid AABB still calls collision callback");
ok(!s.includes("ok(aabb);"), "old hard AABB assertion is removed");
ok(s.includes("placeableItemId") && s.includes("npcTypeId"), "diagnostic warning includes item/NPC ids");
if (process.exitCode) process.exit(process.exitCode);
console.log("snapshot collision missing-AABB compatibility v1 check passed");
