#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failed = 0;
const checks = [];
function check(label, condition, details) {
  if (condition) console.log(`OK ${label}`);
  else { failed += 1; console.log(`FAIL ${label}`); if (details) console.log(Array.isArray(details) ? details.slice(0, 30).join("\n") : details); }
}
console.log("== Harthmere uploaded asset dimensions tests v52 ==");
const tsPath = path.join(root, "src/shared/harthmere/uploaded_asset_dimensions_v52.ts");
const jsonPath = path.join(root, "public/assets/harthmere/manifest/harthmere-uploaded-asset-dimensions-v52.json");
check("generated TypeScript asset-size registry exists", fs.existsSync(tsPath), tsPath);
check("generated JSON asset-size manifest exists", fs.existsSync(jsonPath), jsonPath);
if (!fs.existsSync(tsPath) || !fs.existsSync(jsonPath)) process.exit(1);
const ts = fs.readFileSync(tsPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
check("version marker is v52", ts.includes("harthmere-uploaded-asset-dimensions-v52") && manifest.version === "harthmere-uploaded-asset-dimensions-v52");
check("registry exposes lookup and collision-footprint helpers", /harthmereUploadedAssetDimensionForKeyV52/.test(ts) && /harthmereUploadedAssetCollisionFootprintV52/.test(ts));
const assets = manifest.assets || {};
const entries = Object.entries(assets);
const measured = entries.filter(([, entry]) => entry.sourceSize && entry.sourceSize.x > 0 && entry.sourceSize.y > 0 && entry.sourceSize.z > 0);
check("manifest has broad runtime-asset coverage", entries.length >= 180, `found ${entries.length}`);
check("GLB/GLTF assets have measured 3D bounds", measured.length >= 120, `measured ${measured.length}`);
const important = ["stall", "cart", "fountain_round", "tree", "mine_stone_01", "arch_wall_stone", "table_medium", "bed_twin1", "anvil_fp", "workbench_fp"];
const missingImportant = important.filter((key) => !assets[key] || (assets[key].format !== "fbx" && !assets[key].sourceSize));
check("important town-building and interior assets have size metadata", missingImportant.length === 0, missingImportant);
const badSizes = measured.filter(([, entry]) => ![entry.sourceSize.x, entry.sourceSize.y, entry.sourceSize.z].every((v) => Number.isFinite(v) && v > 0 && v < 1000)).map(([key, entry]) => `${key} ${JSON.stringify(entry.sourceSize)}`);
check("measured asset bounds are finite and sane", badSizes.length === 0, badSizes);
check("image metadata is captured when image files exist", typeof manifest.imageCount === "number" && manifest.imageCount >= 0 && /HARTHMERE_UPLOADED_IMAGE_METADATA_V52/.test(ts));
check("semantic roles are stored for collision policy", entries.some(([, entry]) => entry.semanticRole === "tree_trunk") && entries.some(([, entry]) => entry.semanticRole === "furniture_or_clutter") && entries.some(([, entry]) => entry.semanticRole === "solid_resource"));
console.log(`RESULT: ${failed === 0 ? "PASS" : `FAIL (${failed})`}`);
process.exit(failed === 0 ? 0 : 1);
