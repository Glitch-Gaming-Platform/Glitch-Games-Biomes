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
  sourcePlayerMesh.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK"),
  "source player mesh route contains static fallback"
);

const builtPlayerMesh = read(".next/server/pages/api/assets/player_mesh.glb.js");
ok(
  builtPlayerMesh.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK"),
  "built player mesh route contains static fallback"
);
ok(
  !builtPlayerMesh.includes("forwardAssetRequest"),
  "built player mesh route no longer proxies old production assets"
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

const webBundle = read("dist/web.js");
ok(
  webBundle.includes("installGlitchSameOriginSyncWebSocketProxy") ||
    webBundle.includes("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY"),
  "built web bundle installs same-origin sync websocket proxy"
);

if (failures.length) {
  console.error("\nGlitch build artifacts are stale or incomplete.");
  console.error("Rebuild before Docker packaging:");
  console.error("  rm -rf .next/cache");
  console.error("  GLITCH_RUNTIME=1 GLITCH_LOCAL_ASSETS=1 NEXT_PUBLIC_GLITCH_RUNTIME=1 NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=\"--openssl-legacy-provider\" ./node_modules/.bin/next build");
  console.error("  NODE_ENV=production NODE_OPTIONS=\"--openssl-legacy-provider\" ./node_modules/.bin/webpack --config server.webpack.config.ts --mode production");
  process.exit(1);
}

console.log("\nGlitch build artifacts are current.");
