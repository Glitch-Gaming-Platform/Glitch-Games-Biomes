#!/usr/bin/env node
/*
 * Verifies that the Harthmere equipment animation assets are installed and the manifests are usable.
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const publicRoot = path.join(root, "public/assets/harthmere/equipment_animations");
const jsonPath = path.join(publicRoot, "equipment-animation-manifest.json");
const tsPath = path.join(root, "src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts");

function ok(label) {
  console.log(`OK ${label}`);
}
function fail(label) {
  console.error(`FAIL ${label}`);
  process.exitCode = 1;
}
function assert(cond, label) {
  cond ? ok(label) : fail(label);
}

assert(fs.existsSync(publicRoot), "public equipment animation directory exists");
assert(fs.existsSync(path.join(publicRoot, "animated_gltf")), "animated_gltf directory exists");
assert(fs.existsSync(jsonPath), "JSON manifest exists");
assert(fs.existsSync(tsPath), "TypeScript manifest exists");

const manifest = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
assert(manifest.total === 134, "manifest has 134 entries");
assert(manifest.categoryCounts.weapons === 18, "manifest has 18 weapons");
assert(manifest.categoryCounts.shields === 9, "manifest has 9 shields");
assert(manifest.categoryCounts.ranged === 15, "manifest has 15 ranged assets");
assert(manifest.categoryCounts.magic === 28, "manifest has 28 magic assets");
assert(manifest.categoryCounts.accessories === 59, "manifest has 59 accessories");
assert(manifest.categoryCounts.wearables === 5, "manifest has 5 wearables");

for (const entry of manifest.entries) {
  const gltfPath = path.join(publicRoot, entry.relativeGltf);
  if (!fs.existsSync(gltfPath)) {
    fail(`missing GLTF for ${entry.id}: ${entry.relativeGltf}`);
    continue;
  }
  if (entry.frameCount !== 24 || entry.fps !== 24) {
    fail(`bad frame/fps for ${entry.id}`);
  }
  if (!Array.isArray(entry.animations) || entry.animations.length === 0) {
    fail(`missing animation list for ${entry.id}`);
  }
  if (!entry.animations.every((name) => name.endsWith("_24"))) {
    fail(`animation names are not marked _24 for ${entry.id}`);
  }
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("OK every manifest GLTF exists and uses 24-frame clips");
console.log("\nRESULT: PASS");
