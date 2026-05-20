#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Resolve the repository from this script location, not process.cwd().
// The v1 installer failed when invoked from ~/Downloads because process.cwd()
// pointed outside the repo.
const repo = path.resolve(__dirname, "../..");
const buffsPath = path.join(repo, "src/shared/game/buffs.ts");
const text = fs.readFileSync(buffsPath, "utf8");

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

ok(text.includes("GLITCH_SNAPSHOT_BUFF_TYPE_COMPAT_V1"), "buff type compatibility marker is present");
ok(text.includes("unknownSnapshotBuffTypeWarnings"), "unknown buff type warnings are de-duplicated");
ok(text.includes("UNKNOWN_SNAPSHOT_BUFF_TYPE_FALLBACK: BuffType = \"debuff\""), "unknown snapshot buffs fall back to a non-removable debuff style");
ok(text.includes("export function maybeBuffType"), "soft maybeBuffType helper is exported");
ok(text.includes("warnUnknownSnapshotBuffType(buff);"), "missing buff type is logged before fallback");
ok(!text.includes("Unknown buff type for ${buff.item_id}"), "old hard assertion message is removed");
ok(!text.includes("ok(buffType"), "buffType no longer hard-asserts on missing buffType");
ok(!text.includes("import { ok } from \"assert\";"), "unused assert import is removed from buffs.ts");
ok(text.includes("GLITCH_SNAPSHOT_BUFF_TYPE_COMPAT_V1 unknown buff type fallback"), "fallback warning includes searchable marker");
ok(text.includes("type = maybeBuffType"), "itemBuffDescription uses soft buff type lookup");

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("snapshot buff type compatibility v2 check passed");
