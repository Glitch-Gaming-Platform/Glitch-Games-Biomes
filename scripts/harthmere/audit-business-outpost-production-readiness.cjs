#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  validateHarthmereBusinessOutpostProductionReadiness,
} = require("../../src/shared/harthmere/business_customer_simulator");

const audit = validateHarthmereBusinessOutpostProductionReadiness();

console.log(
  `Harthmere business outpost production readiness: ${audit.ok ? "OK" : "FAIL"}`
);
console.log(`Checked outposts: ${audit.checkedOutposts}`);
console.log(`Ground Y values: ${audit.uniqueGroundYValues.join(", ")}`);

for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
  const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
  const samples = record.terrainGrounding.samples
    .map((sample) => `${sample.label}:${sample.y}`)
    .join(" ");
  console.log(
    [
      outpost.outpostId,
      outpost.displayName,
      `origin=${record.origin.x},${record.origin.y},${record.origin.z}`,
      `padY=${record.terrainGrounding.padGroundY}`,
      `terrainSpan=${record.terrainGrounding.minTerrainY}-${record.terrainGrounding.maxTerrainY}`,
      `samples=${samples}`,
    ].join(" | ")
  );
}

if (!audit.ok) {
  console.error("Production readiness gaps:");
  for (const gap of audit.gaps) {
    console.error(`- ${gap}`);
  }
  process.exitCode = 1;
}
