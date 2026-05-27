#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V159
//
// Production must render assets the same way local data-snapshot does: local
// bucket/static assets plus local/lazy generated player meshes. This test locks
// down the source-level invariants so future optimization/fallback switches do
// not silently put production back on the broken proxy/static path.

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

// 1. Local/data-snapshot baseline still uses local assets.
check(
  "data-snapshot local runner still passes assets=\"local\"",
  has(/ctx\.invoke\([\s\S]*?b\.run[\s\S]*?assets\s*=\s*["']local["']/m, src.dataSnapshot),
  "Local worked; production must copy this behavior, not drift away from it."
);

check(
  "player client URL still uses /api/assets/player_mesh.glb",
  has(/export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/m, src.playerMesh),
  "The client must request the same generated player mesh endpoint in local and production."
);

// 2. Production default cannot be assetServerMode none/proxy anymore.
check(
  "web config default assetServerMode is lazy/local, never production none",
  has(/defaultValue\s*:\s*["']lazy["']/, src.config) ||
    has(/defaultValue\s*:\s*["']local["']/, src.config),
  "defaultValue: process.env.NODE_ENV === \"production\" ? \"none\" : \"proxy\" is the old broken default."
);

check(
  "web config no longer contains production ? none : proxy default",
  !has(/NODE_ENV\s*={0,2}\s*["']production["'][\s\S]{0,120}["']none["'][\s\S]{0,120}["']proxy["']/, src.config),
  "This exact branch recreates the production/local parity bug."
);

// 3. Glitch runtime must force lazy/local no matter what stale env or CLI says.
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
  "web config forces assetServerMode to lazy for Glitch runtime",
  has(/if\s*\(\s*shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,900}config\.assetServerMode\s*=\s*["']lazy["']/m, src.config),
  "A stale --assetServerMode none/proxy must not win in production."
);

// 4. registerAssetServer must defensively turn none/proxy into lazy when running Glitch.
check(
  "web main imports shouldForceLocalAssetRuntime",
  src.main.includes("shouldForceLocalAssetRuntime")
);

check(
  "web main keeps lazy/local asset exporter path",
  has(/case\s+["']lazy["']\s*:[\s\S]{0,120}new LazyAssetExportsServer\(createAssetServer\)/m, src.main) &&
    has(/case\s+["']local["']\s*:[\s\S]{0,120}createAssetServer\(\)/m, src.main)
);

check(
  "web main refuses to let none/proxy disable assets in Glitch runtime",
  has(/case\s+["']none["']\s*:[\s\S]{0,220}case\s+["']proxy["']\s*:[\s\S]{0,500}shouldForceLocalAssetRuntime\s*\(\)[\s\S]{0,500}new LazyAssetExportsServer\(createAssetServer\)/m, src.main),
  "If config somehow says none/proxy in Glitch runtime, registerAssetServer must still create LazyAssetExportsServer."
);

// 5. The player mesh route must not forward/proxy in Glitch runtime.
check(
  "player mesh route imports shouldForceLocalAssetRuntime",
  src.playerRoute.includes("shouldForceLocalAssetRuntime")
);

check(
  "player mesh route only proxies when NOT forced-local runtime",
  has(/assetServerMode\s*===\s*["']proxy["'][\s\S]{0,120}!shouldForceLocalAssetRuntime\s*\(\)/m, src.playerRoute),
  "Proxying /api/assets/player_mesh.glb is exactly how production diverges from local."
);

check(
  "player mesh route emits computed-local diagnostic header",
  src.playerRoute.includes('X-Glitch-Player-Mesh-Mode') &&
    src.playerRoute.includes('computed-local'),
  "The header makes it obvious whether the live route is using the intended path."
);

// 6. Broken fallback switches must not be referenced by source code anymore.
for (const forbidden of [
  "REMOVED_STATIC_PLAYER_MESH_FALLBACK_POLICY",
  "REMOVED_STATIC_PLAYER_MESH_HOTFIX_POLICY",
  "REMOVED_PLAYER_MESH_BUILD_ERROR_FALLBACK_POLICY",
]) {
  const combined = `${src.config}\n${src.main}\n${src.playerRoute}\n${src.playerMesh}`;
  check(
    `source does not honor ${forbidden}`,
    !combined.includes(forbidden),
    "These env switches are allowed to exist in Azure temporarily, but source must ignore them so they cannot force broken fallback rendering."
  );
}

if (!ok) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}

console.log("\nRESULT: PASS");
