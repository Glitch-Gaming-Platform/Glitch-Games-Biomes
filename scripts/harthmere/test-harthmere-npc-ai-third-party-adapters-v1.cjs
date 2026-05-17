#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); ok = false; } }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
console.log("== Harthmere NPC AI third-party adapter tests v1 ==");
console.log(`Root: ${root}\n`);
const pkgPath = path.join(root, "package.json");
check("package.json exists", fs.existsSync(pkgPath));
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  check("package.json includes yuka", Boolean(deps.yuka));
  check("package.json includes behavior3js", Boolean(deps.behavior3js));
  check("package.json includes recast-navigation", Boolean(deps["recast-navigation"]));
}
const adapterRel = "src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts";
const adapterPath = path.join(root, adapterRel);
check("third-party adapter module exists", fs.existsSync(adapterPath));
const adapter = fs.existsSync(adapterPath) ? read(adapterRel) : "";
check("adapter has version marker", adapter.includes("HARTHMERE_NPC_THIRD_PARTY_AI_VERSION"));
check("adapter names yuka package", adapter.includes('yuka'));
check("adapter names behavior3js package", adapter.includes('behavior3js'));
check("adapter names recast-navigation package", adapter.includes('recast-navigation'));
check("adapter uses runtime dynamic import", adapter.includes("return import(specifier)"));
check("adapter exposes status helper", adapter.includes("getHarthmereThirdPartyAiAdapterStatus"));
check("adapter keeps deterministic fallback", adapter.includes("custom_fallback"));
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
