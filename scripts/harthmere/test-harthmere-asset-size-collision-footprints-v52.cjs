#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failed = 0;
function check(label, condition, details) {
  if (condition) console.log(`OK ${label}`);
  else { failed += 1; console.log(`FAIL ${label}`); if (details) console.log(Array.isArray(details) ? details.slice(0, 40).join("\n") : details); }
}
console.log("== Harthmere measured asset-size collision footprint tests v52 ==");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const generatedPath = path.join(root, "src/shared/harthmere/uploaded_asset_dimensions_v52.ts");
const manifestPath = path.join(root, "public/assets/harthmere/manifest/harthmere-uploaded-asset-dimensions-v52.json");
const registry = fs.readFileSync(registryPath, "utf8");
const assets = fs.readFileSync(assetsPath, "utf8");
const generated = fs.readFileSync(generatedPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
check("town registry imports measured uploaded asset dimensions", /uploaded_asset_dimensions_v52/.test(registry) && /harthmereUploadedAssetCollisionFootprintV52/.test(registry));
check("measured collision footprint is consulted before generic prop family fallbacks", registry.indexOf("harthmereUploadedAssetCollisionFootprintV52(asset, scale)") > -1 && registry.indexOf("harthmereUploadedAssetCollisionFootprintV52(asset, scale)") < registry.indexOf("/counter|table|bench|bed|cabinet|bookcase"));
check("bespoke wall/building collision rules still run before measured fallback", registry.indexOf("asset.startsWith(\"arch_wall_\")") < registry.indexOf("harthmereUploadedAssetCollisionFootprintV52(asset, scale)") && registry.indexOf("BUILDING_BODY_ASSET_RE.test(asset)") < registry.indexOf("harthmereUploadedAssetCollisionFootprintV52(asset, scale)"));
check("renderer passes effective default asset scale into metadata", /const effectiveScale = normalizedScale \?\? assetByKey\.get\(asset\)\?\.defaultScale/.test(assets) && /scale: effectiveScale/.test(assets));
check("browser debug exposes asset dimensions and measured collision footprints", /__harthmereAssetDimensionsV52/.test(assets) && /collisionFootprint/.test(assets));
check("collision policy includes clamps for trees, thin barriers, furniture, stalls, carts, and resources", ["tree_trunk", "thin_barrier", "furniture_or_clutter", "stall", "low_cart", "solid_resource"].every((token) => generated.includes(token)));
const data = manifest.assets || {};
function assertRole(key, role) { return data[key]?.semanticRole === role; }
check("known wide-canopy trees use trunk-sized collision role", assertRole("tree", "tree_trunk") && assertRole("tree_high", "tree_trunk"));
check("known barriers and service props use measured collision roles", assertRole("fence", "thin_barrier") && assertRole("hedge", "soft_barrier") && assertRole("stall", "stall") && assertRole("cart", "low_cart"));
const measuredBad = Object.entries(data)
  .filter(([, entry]) => entry.sourceSize && entry.defaultScale)
  .filter(([key, entry]) => {
    const role = entry.semanticRole;
    const x = entry.sourceSize.x * entry.defaultScale;
    const z = entry.sourceSize.z * entry.defaultScale;
    if (role === "decorative_tiny" || role === "actor" || role === "ground_surface") return false;
    return !Number.isFinite(x) || !Number.isFinite(z) || x <= 0 || z <= 0 || x > 250 || z > 250;
  })
  .map(([key, entry]) => `${key} role=${entry.semanticRole} authored=${JSON.stringify(entry.authoredDefaultSize)}`);
check("measured default authored dimensions are not absurdly large", measuredBad.length === 0, measuredBad);
console.log(`RESULT: ${failed === 0 ? "PASS" : `FAIL (${failed})`}`);
process.exit(failed === 0 ? 0 : 1);
