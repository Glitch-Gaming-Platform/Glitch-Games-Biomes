#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; }
function check(label, ok, detail = "") {
  if (ok) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}${detail ? `\n${detail}` : ""}`); process.exitCode = 1; }
}

const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const registry = read("src/shared/harthmere/town_registry.ts");
const contract = read("src/shared/harthmere/wilds_bible_implementation_v54.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

console.log("== Harthmere bridge and Wilds tests v54 ==");
check("bridge helper exists", /createHarthmereOldBridgeWalkableParapetsV54/.test(renderer));
check("old bridge has walkable deck marker", /HARTHMERE_WALKABLE_BRIDGE_V54[\s\S]{0,120}walkable bridge deck/i.test(renderer));
check("old bridge has parapets", /HARTHMERE_BRIDGE_PARAPET_V54[\s\S]{0,120}bridge parapet/i.test(renderer));
check("old bridge has Q1 bronze disc/crack marker", /bronze disc set into Old Bridge cobbles/i.test(renderer) && /Bell-shaped crack decal/i.test(renderer));
check("old bridge call is installed in placements", /\.\.\.createHarthmereOldBridgeWalkableParapetsV54\(\),/.test(renderer));
check("bridge collision has deck exception before generic blocker", /HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54[\s\S]{0,500}walkable bridge deck is a road\/floor surface/.test(registry));
check("bridge collision keeps parapets blocking", /bridge parapet blocks bridge edges/.test(registry));

for (const landmark of ["Thornbridge Crossing", "Split Oak", "Witchlight Pool", "Old Quarry Cut"]) {
  check(`Wilds landmark placed: ${landmark}`, renderer.includes(landmark));
}
check("Wilds v54 contract exists", /HARTHMERE_WILDS_BIBLE_IMPLEMENTATION_VERSION_V54/.test(contract));
check("Wilds contract covers all named regions", ["Gate Fields", "Mill Road", "Orchard Lane", "Greenmere Edge", "Old Hunter's Track", "Briarfen", "Watchtower Ridge", "Gravewood", "Deep Old Wood"].every((x) => contract.includes(x)));
check("Wilds contract covers NPCs", ["Edda Wren", "Old Merrit Bracken", "Sella Reedfoot", "Tamsin Vale", "Brother Cael Marsen", "Rusk Hallowhand", "Veneth of the Green Threshold"].every((x) => contract.includes(x)));
check("town suite includes v54 test", /test-harthmere-bridge-wilds-v54\.cjs/.test(suite));

const audit = spawnSync(process.execPath, [path.join(root, "scripts/harthmere/audit-harthmere-bridge-wilds-v54.cjs"), root, "--strict"], { encoding: "utf8" });
process.stdout.write(audit.stdout || "");
process.stderr.write(audit.stderr || "");
check("bridge/Wilds audit exits successfully in strict mode", audit.status === 0, `status=${audit.status}`);
const reportPath = path.join(root, "public/assets/harthmere/manifest/harthmere-bridge-wilds-audit-v54.json");
check("bridge/Wilds audit JSON written", fs.existsSync(reportPath));
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  check("audit result passes", report.result === "PASS", report.result);
  check("audit says bridge implemented", report.bridge?.status === "IMPLEMENTED", report.bridge?.status);
  check("audit says all Wilds landmarks implemented", report.wilds?.landmarks?.every((x) => x.status === "IMPLEMENTED"));
  check("audit says all Wilds regions implemented", report.wilds?.regions?.every((x) => x.status === "IMPLEMENTED"));
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL bridge/Wilds v54");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS bridge/Wilds v54");
