#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const root = process.cwd();
let failures = 0;
function ok(msg) { console.log(`OK ${msg}`); }
function fail(msg, detail) { failures++; console.error(`FAIL ${msg}`); if (detail) console.error(detail); }
function readMaybe(rel) { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; }
function grepDir(dir, predicate) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return false;
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (/\.(js|ts|tsx|jsx)$/.test(ent.name)) {
        if (predicate(fs.readFileSync(p, "utf8"), p)) return true;
      }
    }
  }
  return false;
}
try {
  cp.execFileSync(process.execPath, [path.join(root, "scripts/harthmere/test-harthmere-prod-local-policy-sweep-v171.cjs"), root], { stdio: "inherit" });
  ok("v171 generated-local policy sweep passes");
} catch (e) { fail("v171 generated-local policy sweep passes"); }
const routeSrc = readMaybe("src/pages/api/assets/player_mesh.glb.ts");
if (routeSrc.includes("X-Glitch-Player-Mesh-Mode")) ok("source route has computed-local diagnostic marker"); else fail("source route has computed-local diagnostic marker");
const builtHasMode = grepDir(".next/server", (txt) => txt.includes("X-Glitch-Player-Mesh-Mode"));
if (builtHasMode) ok("built Next server contains computed-local player mesh diagnostic marker"); else fail("built Next server contains computed-local player mesh diagnostic marker");
const builtHasLazy = grepDir("dist", (txt) => txt.includes("shouldForceLocalAssetRuntime") || txt.includes("LazyAssetExportsServer"));
if (builtHasLazy) ok("built server bundle contains local/lazy asset runtime policy"); else fail("built server bundle contains local/lazy asset runtime policy");
const builtHasDisable = grepDir("dist", (txt) => txt.includes("GLITCH_DISABLE_ASSET_EXPORT_SERVER"));
if (!builtHasDisable) ok("built server bundle has no disable-asset-export killswitch"); else fail("built server bundle has no disable-asset-export killswitch");
if (failures) {
  console.error("\nGlitch build artifacts are stale or incompatible with v171 prod/local asset parity.");
  console.error("Rebuild before Docker packaging: rm -rf .next/cache dist && rerun deploy.");
  process.exit(1);
}
console.log("\nGlitch build artifacts current for v171 prod/local asset parity.");
