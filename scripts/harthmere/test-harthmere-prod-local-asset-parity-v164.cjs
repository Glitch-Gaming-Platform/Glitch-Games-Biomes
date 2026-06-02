#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V164
// Static guardrail: production must render through the local/lazy asset path,
// not proxy/generated local fallback-free path paths that diverge from local.
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`missing ${rel}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}
function ok(label, condition, detail = "") {
  if (condition) console.log(`OK    ${label}`);
  else {
    console.error(`FAIL  ${label}`);
    if (detail) console.error(`      ${detail}`);
    failures.push(label);
  }
}
function has(re, s) { return re.test(s); }

const src = {
  config: read("src/server/web/config.ts"),
  main: read("src/server/web/main.ts"),
  playerRoute: read("src/pages/api/assets/player_mesh.glb.ts"),
  playerMesh: read("src/client/game/resources/player_mesh.ts"),
  npcResources: read("src/client/game/resources/npcs.ts"),
  dataSnapshot: fs.existsSync(path.join(root, "scripts/b/data_snapshot.py")) ? read("scripts/b/data_snapshot.py") : "",
};
const combined = Object.values(src).join("\n");

ok("no failed reject files remain", !fs.existsSync(path.join(root, "src/server/web/config.ts.rej")) && !fs.existsSync(path.join(root, "src/pages/api/assets/player_mesh.glb.ts.rej")));
if (src.dataSnapshot) {
  ok("data-snapshot local runner still passes assets=local", has(/ctx\.invoke\([\s\S]*?b\.run[\s\S]*?assets\s*=\s*["']local["']/m, src.dataSnapshot));
} else {
  console.log("SKIP  data-snapshot local runner check (scripts/b/data_snapshot.py not in uploaded subset)");
}
ok("client requests /api/assets/player_mesh.glb", has(/export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/m, src.playerMesh));
ok("client playerMeshUrlForId never returns generated player mesh endpoints", !has(/return\s+harthmerePlayerBodyVariantUrl\s*\(/, src.playerMesh));
ok("client removed environment switches that could route player meshes to static variants", !has(/USE_HARTHMERE_STATIC_PLAYER_MESH_VARIANTS|NEXT_PUBLIC_GLITCH_PLAYER_MESH_MODE|shouldUseHarthmereStaticPlayerMeshVariant/, src.playerMesh));

ok("web config defaults assetServerMode to lazy", has(/defaultValue\s*:\s*["']lazy["']/, src.config));
ok("web config does not contain production none/proxy default", !has(/NODE_ENV[\s\S]{0,120}["']production["'][\s\S]{0,160}["']none["'][\s\S]{0,160}["']proxy["']/m, src.config));
for (const envName of ["GLITCH_LOCAL_ASSET_RUNTIME", "GLITCH_FORCE_LOCAL_PLAYER_MESH", "GLITCH_RUNTIME", "NEXT_PUBLIC_GLITCH_RUNTIME", "GLITCH_LOCAL_ASSETS", "NEXT_PUBLIC_GLITCH_LOCAL_ASSETS", "GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER", "GLITCH_TITLE_ID"]) {
  ok(`web config considers ${envName}`, src.config.includes(envName));
}
ok("web config exports shouldForceLocalAssetRuntime", has(/export function shouldForceLocalAssetRuntime\s*\(/, src.config));
ok("web config forces stale modes back to lazy", has(/if\s*\(\s*shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,1200}config\.assetServerMode\s*=\s*["']lazy["']/m, src.config));

ok("web main imports shouldForceLocalAssetRuntime", src.main.includes("shouldForceLocalAssetRuntime") && src.main.includes("@/server/web/config"));
ok("web main removed GLITCH_DISABLE_ASSET_EXPORT_SERVER killswitch entirely", !src.main.includes("GLITCH_DISABLE_ASSET_EXPORT_SERVER"));
ok("web main has no explicit Glitch proxy invalid-asset branch", !src.main.includes("GLITCH_PLAYER_MESH_PROXY_V121") && !has(/isGlitchRuntimeForWeb\s*\(\)[\s\S]{0,120}assetServerMode\s*===\s*["']proxy["'][\s\S]{0,260}InvalidAssetExportServer/m, src.main));
ok("web main converts none/proxy to lazy when forced local", has(/case\s+["']none["']\s*:[\s\S]{0,260}case\s+["']proxy["']\s*:[\s\S]{0,900}shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,900}new LazyAssetExportsServer\(createAssetServer\)/m, src.main));

ok("player mesh route imports shouldForceLocalAssetRuntime", src.playerRoute.includes("shouldForceLocalAssetRuntime"));
ok("player mesh route uses forced-local gate before killswitching", has(/const\s+forceLocalAssetRuntime\s*=\s*shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,260}!forceLocalAssetRuntime[\s\S]{0,260}assetServerMode\s*!==\s*["']lazy["'][\s\S]{0,260}assetServerMode\s*!==\s*["']local["']/m, src.playerRoute));
ok("player mesh route does not proxy to remote Biomes", !has(/forwardAssetRequest|https:\/\/www\.biomes\.gg|assetServerMode\s*===\s*["']proxy["'][\s\S]{0,200}DoNotSendResponse/m, src.playerRoute));
ok("player mesh route emits computed-local diagnostic header", src.playerRoute.includes("X-Glitch-Player-Mesh-Mode") && src.playerRoute.includes("computed-local"));
ok("player mesh route emits content and asset-version diagnostic headers", src.playerRoute.includes("X-Glitch-Player-Mesh-Content-Type") && src.playerRoute.includes("X-Glitch-Player-Mesh-Asset-Version"));
ok("player mesh route returns Galois asset build errors as errors, not fallback meshes", has(/Galois player mesh asset build returned an error[\s\S]{0,260}Player mesh generation failed in the local asset server/m, src.playerRoute));
ok("player mesh route no longer redirects to generated local fallback-free path", !has(/redirect\s*\([\s\S]{0,500}harthmere_player|harthmere_player_average_earth/m, src.playerRoute));

ok("NPC renderer keeps no-asset Grove carveout before player-like generated mesh path", src.npcResources.indexOf("shouldUseSnapshotGroveGeneratedVoxelNpcV195(id, label)") > -1 && src.npcResources.indexOf("shouldUseSnapshotGroveGeneratedVoxelNpcV195(id, label)") < src.npcResources.indexOf("if (npcType.isPlayerLikeAppearance)"));
ok("NPC renderer keeps player-like generated mesh path before generic local-dev fallback", src.npcResources.indexOf("if (npcType.isPlayerLikeAppearance)") > -1 && src.npcResources.indexOf("if (npcType.isPlayerLikeAppearance)") < src.npcResources.indexOf("const localDevOffset = localDevNpcOffset(id)"));
ok("NPC player-like path uses generated snapshot player mesh", has(/npcType\.isPlayerLikeAppearance[\s\S]{0,600}makeSnapshotPlayerLikeAppearanceMesh\(deps, id\)/m, src.npcResources));
ok("NPC non-player path still uses galoisPath assets", has(/ok\(npcType\.galoisPath[\s\S]{0,220}resolveAssetUrlUntyped\(npcType\.galoisPath\)/m, src.npcResources));
ok("NPC non-player path falls back to visible voxel mesh instead of name-only invisibility", src.npcResources.includes("HARTHMERE_NPC_GALOIS_VISIBLE_FALLBACK_V164") && has(/catch\s*\(error\)[\s\S]{0,700}makeLocalDevVoxelNpcGltf\(deps, id\)/m, src.npcResources));

for (const forbidden of ["REMOVED_STATIC_PLAYER_MESH_FALLBACK_POLICY", "REMOVED_STATIC_PLAYER_MESH_HOTFIX_POLICY", "REMOVED_PLAYER_MESH_BUILD_ERROR_FALLBACK_POLICY"]) {
  ok(`source does not honor ${forbidden}`, !combined.includes(forbidden));
}

if (failures.length) {
  console.error(`\nRESULT: FAIL (${failures.length} failure(s))`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
