#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V163
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const files = {
  config: "src/server/web/config.ts",
  main: "src/server/web/main.ts",
  playerRoute: "src/pages/api/assets/player_mesh.glb.ts",
  playerMesh: "src/client/game/resources/player_mesh.ts",
  npcResources: "src/client/game/resources/npcs.ts",
  dataSnapshot: "scripts/b/data_snapshot.py",
};
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { console.error(`FAIL  missing required file: ${rel}`); process.exit(1); }
  return fs.readFileSync(full, "utf8");
}
const src = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, read(v)]));
let ok = true;
function check(label, condition, detail = "") {
  if (condition) console.log(`OK    ${label}`);
  else { ok = false; console.error(`FAIL  ${label}`); if (detail) console.error(`      ${detail}`); }
}
function has(re, s) { return re.test(s); }
check("no failed reject files remain", !fs.existsSync(path.join(root, "src/server/web/config.ts.rej")) && !fs.existsSync(path.join(root, "src/pages/api/assets/player_mesh.glb.ts.rej")));
check("data-snapshot local runner still passes assets=local", has(/ctx\.invoke\([\s\S]*?b\.run[\s\S]*?assets\s*=\s*["']local["']/m, src.dataSnapshot));
check("client still requests /api/assets/player_mesh.glb", has(/export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/m, src.playerMesh));
check("client no longer returns generated player mesh endpoint from playerMeshUrlForId", !has(/return\s+harthmerePlayerBodyVariantUrl\s*\(/, src.playerMesh));
check("web config defaults assetServerMode to lazy", has(/defaultValue\s*:\s*["']lazy["']/, src.config));
check("web config does not contain production none/proxy default", !has(/NODE_ENV[\s\S]{0,120}["']production["'][\s\S]{0,160}["']none["'][\s\S]{0,160}["']proxy["']/m, src.config));
for (const envName of ["GLITCH_LOCAL_ASSET_RUNTIME", "GLITCH_FORCE_LOCAL_PLAYER_MESH", "GLITCH_RUNTIME", "NEXT_PUBLIC_GLITCH_RUNTIME", "GLITCH_LOCAL_ASSETS", "NEXT_PUBLIC_GLITCH_LOCAL_ASSETS", "GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER", "GLITCH_TITLE_ID"]) {
  check(`web config considers ${envName}`, src.config.includes(envName));
}
check("web config exports shouldForceLocalAssetRuntime", has(/export function shouldForceLocalAssetRuntime\s*\(/, src.config));
check("web config forces stale modes back to lazy", has(/if\s*\(\s*shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,1000}config\.assetServerMode\s*=\s*["']lazy["']/m, src.config));
check("web main imports shouldForceLocalAssetRuntime", src.main.includes("shouldForceLocalAssetRuntime") && src.main.includes("@/server/web/config"));
check("web main refuses none/proxy in forced local runtime", has(/case\s+["']none["']\s*:[\s\S]{0,260}case\s+["']proxy["']\s*:[\s\S]{0,800}shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,800}new LazyAssetExportsServer\(createAssetServer\)/m, src.main));
check("player mesh route imports shouldForceLocalAssetRuntime", src.playerRoute.includes("shouldForceLocalAssetRuntime"));
check("player mesh route only proxies when not forced local", has(/assetServerMode\s*===\s*["']proxy["']\s*&&\s*!shouldForceLocalAssetRuntime\s*\(\)/m, src.playerRoute), "Proxying /api/assets/player_mesh.glb in Glitch runtime is production/local divergence.");
check("player mesh route emits computed-local diagnostic header", src.playerRoute.includes("X-Glitch-Player-Mesh-Mode") && src.playerRoute.includes("computed-local"));
check("player mesh route emits content diagnostic header", src.playerRoute.includes("X-Glitch-Player-Mesh-Content-Type"));
check("player mesh route no longer redirects to generated local fallback-free path", !has(/redirect\s*\([\s\S]{0,400}harthmere_player_average_earth/m, src.playerRoute));
check("player mesh route does not catch generation errors into fallback", !has(/catch\s*\(\s*error\s*\)[\s\S]{0,700}redirect/m, src.playerRoute));
check("NPC renderer keeps player-like NPCs on generated player mesh path", has(/npcType\.isPlayerLikeAppearance[\s\S]{0,260}makePlayerLikeAppearanceMesh\(deps, id\)/m, src.npcResources));
check("NPC renderer keeps non-player NPCs on galoisPath asset path", has(/ok\(npcType\.galoisPath[\s\S]{0,220}resolveAssetUrlUntyped\(npcType\.galoisPath\)/m, src.npcResources));
const combined = `${src.config}\n${src.main}\n${src.playerRoute}\n${src.playerMesh}`;
for (const forbidden of ["REMOVED_STATIC_PLAYER_MESH_FALLBACK_POLICY", "REMOVED_STATIC_PLAYER_MESH_HOTFIX_POLICY", "REMOVED_PLAYER_MESH_BUILD_ERROR_FALLBACK_POLICY"]) {
  check(`source does not honor ${forbidden}`, !combined.includes(forbidden));
}
if (!ok) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
