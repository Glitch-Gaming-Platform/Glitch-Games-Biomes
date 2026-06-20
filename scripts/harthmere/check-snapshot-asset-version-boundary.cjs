#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.cwd();
const assetVersionsPath = path.join(repo, "src/galois/js/interface/gen/asset_versions.json");
const bucketRoot = path.join(repo, "public/buckets/biomes-static");

if (!fs.existsSync(assetVersionsPath)) {
  console.error("FAIL missing src/galois/js/interface/gen/asset_versions.json");
  process.exit(1);
}
const versions = JSON.parse(fs.readFileSync(assetVersionsPath, "utf8")).paths || {};
console.log(`CHECK asset_versions paths: ${Object.keys(versions).length}`);

if (!fs.existsSync(bucketRoot)) {
  console.error("FAIL missing public/buckets/biomes-static");
  console.error("Run: ./b data-snapshot pull");
  process.exit(1);
}

const missing = [];
for (const [logicalName, rel] of Object.entries(versions)) {
  const full = path.join(bucketRoot, rel);
  if (!fs.existsSync(full)) {
    missing.push(`${logicalName} -> ${rel}`);
    if (missing.length <= 25) {
      console.error(`MISSING ${logicalName} -> ${rel}`);
    }
  }
}

if (missing.length) {
  console.error(`FAIL missing ${missing.length} static bucket assets referenced by asset_versions.json`);
  console.error("Fix by reinstalling the full 2026-05-16 snapshot tar, not only biomes-static.zip.");
  process.exit(1);
}

console.log("OK every asset_versions.json path exists in public/buckets/biomes-static");
