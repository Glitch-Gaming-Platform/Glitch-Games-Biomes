#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V161
// Source guardrails for the production/local asset parity fix. Production must
// use the same local/lazy player mesh generation path as the working local
// data-snapshot runner. It must not silently route player meshes through proxy,
// none, or generated local fallback-free path switches.

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const files = {
  config: "src/server/web/config.ts",
  main: "src/server/web/main.ts",
  playerRoute: "src/pages/api/assets/player_mesh.glb.ts",
  playerMesh: "src/client/game/resources/player_mesh.ts",
  dataSnapshot: "scripts/b/data_snapshot.py",
};

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`FAIL  missing required file: ${rel}`);
    process.exit(1);
  }
  return fs.readFileSync(full, "utf8");
}

const src = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, read(v)]));
let ok = true;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`OK    ${label}`);
  } else {
    ok = false;
    console.error(`FAIL  ${label}`);
    if (detail) console.error(`      ${detail}`);
  }
}
function has(re, s) {
  return re.test(s);
}

check(
  "no failed reject files remain from partial v159 patch",
  !fs.existsSync(path.join(root, "src/server/web/config.ts.rej")) &&
    !fs.existsSync(path.join(root, "src/pages/api/assets/player_mesh.glb.ts.rej")),
  "Do not deploy with .rej files from a half-applied patch."
);

check(
  "data-snapshot local runner still passes assets=local",
  has(/ctx\.invoke\([\s\S]*?b\.run[\s\S]*?assets\s*=\s*["']local["']/m, src.dataSnapshot),
  "Local works; production should copy this behavior instead of diverging."
);

check(
  "client still requests /api/assets/player_mesh.glb",
  has(/export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/m, src.playerMesh),
  "The browser must request the generated player mesh endpoint."
);

check(
  "client no longer returns generated player mesh endpoint from playerMeshUrlForId",
  !has(/return\s+harthmerePlayerBodyVariantUrl\s*\(/, src.playerMesh),
  "Static body variants caused production to diverge from local generated meshes."
);

check(
  "web config defaults assetServerMode to lazy",
  has(/defaultValue\s*:\s*["']lazy["']/, src.config)
);
check(
  "web config does not contain production none/proxy default",
  !has(/NODE_ENV[\s\S]{0,120}["']production["'][\s\S]{0,160}["']none["'][\s\S]{0,160}["']proxy["']/m, src.config)
);

for (const envName of [
  "GLITCH_LOCAL_ASSET_RUNTIME",
  "GLITCH_FORCE_LOCAL_PLAYER_MESH",
  "GLITCH_RUNTIME",
  "NEXT_PUBLIC_GLITCH_RUNTIME",
  "GLITCH_LOCAL_ASSETS",
  "NEXT_PUBLIC_GLITCH_LOCAL_ASSETS",
  "GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER",
  "GLITCH_TITLE_ID",
]) {
  check(`web config considers ${envName}`, src.config.includes(envName));
}

check(
  "web config exports shouldForceLocalAssetRuntime",
  has(/export function shouldForceLocalAssetRuntime\s*\(/, src.config)
);
check(
  "web config forces stale modes back to lazy",
  has(/if\s*\(\s*shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,1000}config\.assetServerMode\s*=\s*["']lazy["']/m, src.config),
  "A stale CLI/env assetServerMode=none/proxy must not win in Glitch runtime."
);

check(
  "web main imports shouldForceLocalAssetRuntime",
  src.main.includes("shouldForceLocalAssetRuntime") && src.main.includes("@/server/web/config")
);
check(
  "web main local/lazy modes construct an asset exporter",
  has(/case\s+["']local["']\s*:[\s\S]{0,140}createAssetServer\(\)/m, src.main) &&
    has(/case\s+["']lazy["']\s*:[\s\S]{0,160}new LazyAssetExportsServer\(createAssetServer\)/m, src.main)
);
check(
  "web main refuses none/proxy in forced local runtime",
  has(/case\s+["']none["']\s*:[\s\S]{0,260}case\s+["']proxy["']\s*:[\s\S]{0,700}shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,700}new LazyAssetExportsServer\(createAssetServer\)/m, src.main),
  "registerAssetServer must still return LazyAssetExportsServer if config somehow says none/proxy."
);

check(
  "player mesh route imports shouldForceLocalAssetRuntime",
  src.playerRoute.includes("shouldForceLocalAssetRuntime")
);
check(
  "player mesh route only proxies when not forced local",
  has(/assetServerMode\s*===\s*["']proxy["'][\s\S]{0,160}!shouldForceLocalAssetRuntime\s*\(\)/m, src.playerRoute),
  "Proxying /api/assets/player_mesh.glb is production/local divergence."
);
check(
  "player mesh route emits computed-local diagnostic header",
  src.playerRoute.includes("X-Glitch-Player-Mesh-Mode") && src.playerRoute.includes("computed-local")
);
check(
  "player mesh route no longer redirects to generated local fallback-free path",
  !has(/shouldUseStaticPlayerMeshFallback\s*\(\)[\s\S]{0,800}DoNotSendResponse/m, src.playerRoute),
  "generated local fallback-free path short-circuited the generator in production."
);

const combined = `${src.config}\n${src.main}\n${src.playerRoute}\n${src.playerMesh}`;
for (const forbidden of [
  "REMOVED_STATIC_PLAYER_MESH_FALLBACK_POLICY",
  "REMOVED_STATIC_PLAYER_MESH_HOTFIX_POLICY",
  "REMOVED_PLAYER_MESH_BUILD_ERROR_FALLBACK_POLICY",
]) {
  check(
    `source does not honor ${forbidden}`,
    !combined.includes(forbidden),
    "Stale Azure env switches are allowed to exist temporarily, but source must ignore them."
  );
}

if (!ok) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
