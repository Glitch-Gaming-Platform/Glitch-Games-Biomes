#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK    ${message}`);
  } else {
    console.error(`FAIL  ${message}`);
    failures += 1;
  }
}

const assets = read("src/shared/api/assets.ts");
const api = read("src/pages/api/assets/player_mesh.glb.ts");
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");
const versionMatch = assets.match(/ASSET_EXPORTS_SERVER_VERSION\s*=\s*(\d+)/);
const version = versionMatch ? Number(versionMatch[1]) : 0;

ok(version >= 56, "asset export version is bumped so cached white GLBs are invalidated");
ok(/HARTHMERE_GENERATED_MESH_DEFAULT_WEARABLES_VERSION/.test(assets), "client documents the current generated mesh default-wearables fix");
ok(/ensurePlayerMeshDefaultWearables/.test(assets), "client exposes generated mesh default wearable helper");
ok(/BikkieIds\.muckyTop/.test(assets), "client defaults missing top to muckyTop");
ok(/BikkieIds\.muckySkirt/.test(assets), "client defaults missing bottoms to muckySkirt/grassyBottom");
ok(/BikkieIds\.boots/.test(assets), "client defaults missing feet to boots");
ok(/ensurePlayerMeshDefaultWearables\(wearables\)\.map/.test(assets), "makePlayerMeshQueryString inserts defaults before building URL params");
ok(/withDefaultStarterWearables/.test(api), "server mirrors default wearable insertion for direct mesh requests");
ok(/outMap\.set\("top", \{ id: BikkieIds\.muckyTop \}\)/.test(api), "server inserts default top when missing");
ok(/outMap\.set\("bottoms", \{ id: BikkieIds\.muckySkirt \}\)/.test(api), "server inserts default bottoms when missing");
ok(/outMap\.set\("feet", \{ id: BikkieIds\.boots \}\)/.test(api), "server inserts default feet when missing");
ok(/applyWearableAppearanceFilters\(\s*withDefaultStarterWearables\(slotToWearableMap\)\s*\)/s.test(api), "server applies defaults before appearance/hat filtering");
ok(/test-harthmere-generated-player-mesh-default-wearables\.cjs/.test(deploy), "deploy source guardrails include current default-wearables test");

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
