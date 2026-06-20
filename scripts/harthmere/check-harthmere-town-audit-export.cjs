#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetFile = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(assetFile, "utf8");

const checks = [
  ["audit version marker", "HARTHMERE_TOWN_AUDIT_EXPORT_VERSION"],
  ["audit API factory", "createHarthmereTownAuditExportApi"],
  ["audit global assignment", "__harthmereTownAudit = this.createHarthmereTownAuditExportApi()"],
  ["object dump command", "objects: collectObjects"],
  ["download command", "download('harthmere-town-audit.json')"],
  ["watch command", "watch(30, 1000)"],
  ["manual sample command", "const sample = (note ="],
  ["overlap detector", "const overlaps = (limit = 250"],
  ["walk through suspect flag", "walk_through_collision_missing_or_unregistered"],
  ["massive object flag", "massive_object_check_scale"],
  ["ground/floating flags", "floating_or_unsupported_prop_check"],
  ["clear previous sessions", "clearPreviousSessions"],
  ["safe debug/session key clearing", "safePattern"],
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

console.log();
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("RESULT: PASS");
