#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function pass(msg){ console.log(`OK ${msg}`); }
function fail(msg){ ok = false; console.log(`FAIL ${msg}`); }
function exists(rel){ return fs.existsSync(path.join(root, rel)); }
function read(rel){ return fs.readFileSync(path.join(root, rel), "utf8"); }
const manifest = "src/shared/harthmere/harthmere_clothing_asset_manifest.ts";
const licenses = "docs/legal/harthmere-clothing/LICENSES.md";
const scan = "docs/legal/harthmere-clothing/asset_scan.json";
exists(manifest) ? pass("licensed clothing manifest exists") : fail("licensed clothing manifest missing");
exists(licenses) ? pass("license documentation exists") : fail("license documentation missing");
exists(scan) ? pass("machine-readable asset scan exists") : fail("machine-readable asset scan missing");
if (exists(manifest)) {
  const m = read(manifest);
  m.includes("HARTHMERE_LICENSED_CLOTHING_ASSETS") ? pass("manifest exports clothing assets") : fail("manifest missing assets export");
  m.includes("HARTHMERE_CLOTHING_ASSET_LICENSES") ? pass("manifest exports license metadata") : fail("manifest missing license export");
  m.includes("mergeHarthmereLicensedClothingForRole") ? pass("manifest exports merge helper") : fail("manifest missing merge helper");
  m.includes("quaternius_fantasy_standard") ? pass("manifest includes Quaternius CC0 assets") : fail("manifest missing Quaternius assets");
  m.includes("CC-BY-4.0") ? pass("manifest preserves CC-BY license metadata") : fail("manifest missing CC-BY metadata");
}
const expectedAssets = [
  "public/models/harthmere/clothing/quaternius_fantasy_standard/modular_parts/Male_Peasant_Body.gltf",
  "public/models/harthmere/clothing/quaternius_fantasy_standard/modular_parts/Female_Peasant_Body.gltf",
  "public/models/harthmere/clothing/quaternius_fantasy_standard/modular_parts/Male_Ranger_Body.gltf",
  "public/models/harthmere/clothing/quaternius_fantasy_standard/modular_parts/Female_Ranger_Body.gltf",
  "public/models/harthmere/clothing/sketchfab/red_ilya/medieval_clothing_free/scene.gltf",
  "public/models/harthmere/clothing/sketchfab/blue_spirit/medieval_armor_set/scene.gltf",
  "public/models/harthmere/clothing/sketchfab/calviking073/armored_king/scene.gltf",
];
for (const rel of expectedAssets) { exists(rel) ? pass(`${rel} exists`) : fail(`${rel} missing`); }
const vf = "src/shared/harthmere/voxel_faces.ts";
if (exists(vf)) {
  const text = read(vf);
  text.includes("harthmere_clothing_asset_manifest") ? pass("voxel_faces re-exports licensed clothing manifest") : fail("voxel_faces does not re-export manifest");
}
if (exists(scan)) {
  const data = JSON.parse(read(scan));
  data.defaultEnabledItemCount > 0 ? pass(`default enabled asset count ${data.defaultEnabledItemCount}`) : fail("no default enabled assets");
  data.itemCount >= 20 ? pass(`manifest item count ${data.itemCount}`) : fail(`manifest item count too low: ${data.itemCount}`);
}
console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
