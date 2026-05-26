#!/usr/bin/env node
/*
 * Guardrail for Dockerfile.biomes.
 *
 * The Glitch image copies prebuilt `.next` and `dist` artifacts. If source
 * changes are packaged with stale build output, production can keep running old
 * auth/bootstrap or asset proxy code even though the repo source looks fixed.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    fail(message);
  }
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing ${rel}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(absolute));
    } else {
      out.push(absolute);
    }
  }
  return out;
}

const sourcePlayerMesh = read("src/pages/api/assets/player_mesh.glb.ts");
ok(
  sourcePlayerMesh.includes('"wearables/animated_player_mesh"') &&
    sourcePlayerMesh.includes("assetExportsServer.build") &&
    sourcePlayerMesh.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    sourcePlayerMesh.includes("Using packaged player body mesh fallback for Glitch runtime") &&
    sourcePlayerMesh.includes('process.env.GLITCH_RUNTIME === "1"'),
  "source player mesh route uses packaged player body fallback in Glitch runtime before local generation"
);

const sourcePlayerMeshResource = read("src/client/game/resources/player_mesh.ts");
ok(
  sourcePlayerMeshResource.includes("HARTHMERE_PLAYER_GLB_URL_PARITY_V137") &&
    /export function ecsWearablesToUrl[\s\S]*?\/api\/assets\/player_mesh\.glb/.test(
      sourcePlayerMeshResource
    ),
  "source player mesh resource routes players through /api/assets/player_mesh.glb"
);

const builtPlayerMesh = read(".next/server/pages/api/assets/player_mesh.glb.js");
ok(
  builtPlayerMesh.includes("wearables/animated_player_mesh") &&
    builtPlayerMesh.includes("assetExportsServer") &&
    builtPlayerMesh.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    builtPlayerMesh.includes("Using packaged player body mesh fallback for Glitch runtime"),
  "built player mesh route uses packaged player body fallback in Glitch runtime"
);
ok(
  builtPlayerMesh.includes("Player mesh generation failed; redirecting to packaged player body fallback") &&
    builtPlayerMesh.includes("GLITCH_PLAYER_MESH_FALLBACK_ON_BUILD_ERROR"),
  "built player mesh route falls back instead of crashing on local generation failure"
);
ok(
  !builtPlayerMesh.includes("forwardAssetRequest"),
  "built player mesh route no longer proxies old production assets"
);
ok(
  builtPlayerMesh.includes("GLITCH_RUNTIME") &&
    (builtPlayerMesh.includes("NEXT_PUBLIC_GLITCH_RUNTIME") ||
      builtPlayerMesh.includes('"1" === "1"')),
  "built player mesh route redirects Glitch runtime before unavailable mesh generation starts"
);

const stackRunner = read("scripts/glitch/run-glitch-local-game-stack-v92.sh");
ok(
  stackRunner.includes("ensure_snapshot_redis_populated") &&
    stackRunner.includes("GLITCH_PROD_SNAPSHOT_REDIS_BOOTSTRAP_V2") &&
    stackRunner.includes("GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1") &&
    stackRunner.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1") &&
    stackRunner.includes('GLITCH_WORLD_API_MODE="${GLITCH_WORLD_API_MODE:-hfc-hybrid}"') &&
    stackRunner.includes('GLITCH_BISCUIT_MODE="${GLITCH_BISCUIT_MODE:-redis2}"') &&
    stackRunner.includes('GLITCH_STORAGE_MODE="$GLITCH_SHIM_STORAGE_MODE"') &&
    stackRunner.includes("--bootstrapMode sync") &&
    stackRunner.includes("dist/bikkie.js") &&
    stackRunner.includes("dist/sidefx.js"),
  "stack runner boots the snapshot-backed full local game stack"
);

const dockerfile = read("Dockerfile.biomes");
ok(
  dockerfile.includes("GLITCH_WORLD_API_MODE=hfc-hybrid") &&
    dockerfile.includes("GLITCH_BISCUIT_MODE=redis2") &&
    dockerfile.includes("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1") &&
    dockerfile.includes("GLITCH_REDIS_MODE=external") &&
    dockerfile.includes("GLITCH_POPULATE_SNAPSHOT_REDIS=0") &&
    dockerfile.includes("BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0") &&
    dockerfile.includes("BIOMES_FORCE_LOCAL_DEV_TOWN=0") &&
    dockerfile.includes("BIOMES_START_IN_HARTHMERE=0"),
  "Dockerfile defaults to shared production Redis, Grove start, and packaged player mesh fallback"
);
ok(
  !dockerfile.includes("voxeloo-wheel") &&
    !dockerfile.includes("bazelisk") &&
    !dockerfile.includes("python -m pip wheel --no-cache-dir --no-deps") &&
    !dockerfile.includes("pygltflib") &&
    !dockerfile.includes("python3-pip") &&
    !dockerfile.includes("python3-venv"),
  "Dockerfile avoids unused mesh-builder tooling in the production image"
);

ok(
  sourcePlayerMesh.includes("shouldUseStaticPlayerMeshFallback") &&
    sourcePlayerMesh.includes("shouldFallbackPlayerMeshBuildErrors") &&
    sourcePlayerMesh.includes("Player mesh generation failed; redirecting to packaged player body fallback") &&
    sourcePlayerMesh.includes("GLITCH_PLAYER_MESH_FALLBACK_ON_BUILD_ERROR"),
  "source player mesh route uses packaged fallback in Glitch and still guards local generation failures"
);

const assetServer = read("src/galois/js/server/server.ts");
ok(
  assetServer.includes("Galois asset server process exited") &&
    assetServer.includes("Galois asset server pipe error") &&
    assetServer.includes("output.once(\"error\", handleError)") &&
    assetServer.includes("child.once(\"exit\", handleExit)"),
  "asset server worker failures are surfaced as build errors instead of uncaught web-process crashes"
);

const bootstrapSource = read(
  "src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx"
);
ok(
  bootstrapSource.includes("HARTHMERE_AUTH_GATE_IDENTITY_REFRESH_RELOAD_LIMIT_V142") &&
    bootstrapSource.includes("server_gate_identity_refreshed"),
  "source bootstrap has identity-refresh gate recovery"
);

const cvalLoggingSource = read("src/pages/api/cval_logging.ts");
ok(
  cvalLoggingSource.includes("shouldSkipBigQueryCvals") &&
    cvalLoggingSource.includes("process.env.GLITCH_DISABLE_GCP") &&
    cvalLoggingSource.includes("process.env.GLITCH_SKIP_GOOGLE_SECRETS") &&
    cvalLoggingSource.includes("!bigQuery"),
  "source cval logging skips BigQuery in no-GCP runtime"
);

const shimSource = read("src/server/shim/main.ts");
ok(
  shimSource.includes("allowLocalTerrainRuntime") &&
    shimSource.includes('BIOMES_FORCE_LOCAL_DEV_TOWN === "1"') &&
    shimSource.includes('BIOMES_CREATE_LOCAL_DEV_TERRAIN !== "0"'),
  "source shim can seed the local Harthmere town in Glitch production runtime"
);

const playersSource = read("src/server/logic/utils/players.ts");
ok(
  playersSource.includes("allowLocalTownSpawnRuntime") &&
    playersSource.includes('BIOMES_START_IN_HARTHMERE === "1"') &&
    !playersSource
      .slice(
        playersSource.indexOf("function shouldUseLocalDevStarterTownSpawn()"),
        playersSource.indexOf("function shouldTreatWorldBoundsAsSparseGlitchRuntime()")
      )
      .includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN"),
  "source player spawn explicitly starts in Harthmere without following the terrain seed flag"
);

const observerSource = read("src/server/sync/subscription/game_observer.ts");
ok(
  observerSource.includes("allowLocalDevBootstrapRuntime") &&
    observerSource.includes('process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1"'),
  "source sync observer bootstraps the local Harthmere town for Glitch production runtime"
);


const webAppSource = read("src/server/web/app.ts");
ok(
  webAppSource.includes("GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146") &&
    webAppSource.includes("tryServeGlitchLocalBucketAssetV146") &&
    webAppSource.includes("https://storage.googleapis.com/biomes-static") &&
    webAppSource.includes("X-Glitch-Bucket-Asset-Proxy"),
  "source web app proxies /buckets/biomes-static assets before Next.js can return HTML 404s"
);

ok(
  playersSource.includes("configuredGlitchPlayerStartPositionV146") &&
    playersSource.includes("BIOMES_PLAYER_START_POSITION"),
  "source player spawn supports an explicit production coordinate override"
);

ok(
  dockerfile.includes("GLITCH_STATIC_BUCKET_FALLBACK_BASE_URL=https://storage.googleapis.com/biomes-static") &&
    dockerfile.includes('BIOMES_PLAYER_START_POSITION="484.24980838010384,53,-207.51197432867897"'),
  "Dockerfile configures public static-bucket fallback and the requested Harthmere start coordinates"
);

const harthmereRuntimeAssetsSource = read(
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
ok(
  harthmereRuntimeAssetsSource.includes(
    "shouldUseHarthmereRuntimeExtraTownOffsetV1"
  ) &&
    harthmereRuntimeAssetsSource.includes(
      'process.env.NEXT_PUBLIC_GLITCH_RUNTIME === "1"'
    ) &&
    harthmereRuntimeAssetsSource.includes(
      'process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1"'
    ),
  "source client runtime renders shifted Harthmere assets in Glitch production runtime"
);

const nextFiles = [
  ...walk(path.join(root, ".next/static/chunks")),
  ...walk(path.join(root, ".next/server/chunks")),
  ...walk(path.join(root, ".next/server/pages")),
].filter((file) => file.endsWith(".js"));
const nextBundle = nextFiles
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

ok(
  nextBundle.includes("HARTHMERE_AUTH_GATE_IDENTITY_REFRESH_RELOAD_LIMIT_V142") &&
    nextBundle.includes("server_gate_identity_refreshed"),
  "built Next bundle has identity-refresh gate recovery"
);
ok(
  !nextBundle.includes("HARTHMERE_AUTH_GATE_ALREADY_RELOADED_V140"),
  "built Next bundle does not contain the stale already-reloaded gate path"
);

ok(
  nextBundle.includes("shouldSkipBigQueryCvals") &&
    nextBundle.includes("GLITCH_SKIP_GOOGLE_SECRETS") &&
    nextBundle.includes("GLITCH_DISABLE_GCP") &&
    nextBundle.indexOf("GLITCH_DISABLE_GCP") < nextBundle.indexOf("getTable"),
  "built Next bundle skips BigQuery in no-GCP runtime"
);

ok(
  (nextBundle.includes("shouldUseHarthmereRuntimeExtraTownOffsetV1") ||
    nextBundle.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X")) &&
    nextBundle.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z"),
  "built Next bundle renders shifted Harthmere runtime assets for Glitch production"
);
ok(
  nextBundle.includes("/api/assets/player_mesh.glb"),
  "built Next bundle requests the local voxel wearable player mesh endpoint"
);

const webBundle = read("dist/web.js");
ok(
  webBundle.includes("installGlitchSameOriginSyncWebSocketProxy") ||
    webBundle.includes("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY"),
  "built web bundle installs same-origin sync websocket proxy"
);

const shimBundle = read("dist/shim.js");
ok(
  shimBundle.includes("allowLocalTerrainRuntime") &&
    shimBundle.includes("BIOMES_FORCE_LOCAL_DEV_TOWN") &&
    shimBundle.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN"),
  "built shim bundle can seed the local Harthmere town in Glitch production runtime"
);

const syncBundle = read("dist/sync.js");
ok(
  syncBundle.includes("allowLocalDevBootstrapRuntime") &&
    syncBundle.includes("BIOMES_FORCE_LOCAL_DEV_TOWN"),
  "built sync bundle bootstraps the local Harthmere town in Glitch production runtime"
);

const logicBundle = read("dist/logic.js");
ok(
  logicBundle.includes("allowLocalTownSpawnRuntime") &&
    logicBundle.includes("BIOMES_START_IN_HARTHMERE"),
  "built logic bundle starts players in Harthmere when explicitly enabled"
);

read("dist/bikkie.js");
read("dist/sidefx.js");

if (failures.length) {
  console.error("\nGlitch build artifacts are stale or incomplete.");
  console.error("Rebuild before Docker packaging:");
  console.error("  rm -rf .next/cache");
  console.error("  GLITCH_RUNTIME=1 GLITCH_LOCAL_ASSETS=1 NEXT_PUBLIC_GLITCH_RUNTIME=1 NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0 NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN=0 NEXT_PUBLIC_BIOMES_START_IN_HARTHMERE=0 NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE=1 NEXT_PUBLIC_BIOMES_SNAPSHOT_RICH_NPC_APPEARANCE=1 GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=\"--openssl-legacy-provider\" ./node_modules/.bin/next build");
  console.error("  NODE_ENV=production NODE_OPTIONS=\"--openssl-legacy-provider\" ./node_modules/.bin/webpack --config server.webpack.config.ts --mode production");
  process.exit(1);
}

console.log("\nGlitch build artifacts are current.");
