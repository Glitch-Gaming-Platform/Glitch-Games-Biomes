#!/usr/bin/env node
/*
 * GLITCH_PROD_SIMPLE_RUNTIME_V141
 *
 * Static regression tests for the production/local-parity fixes:
 * - docs-compatible install_id-only launch URLs
 * - no iframe auth reload loop after the single cookie-setting reload
 * - no Google GPU benchmark fetch in Glitch local-assets runtime
 * - player mesh route falls back to a static local asset
 * - missing in-memory session heartbeats recover instead of showing the
 *   misleading "newer Glitch session" overlay
 * - wake-up screenshots are skipped in no-GCP/local-assets runtime
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`missing ${rel}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failures.push(message);
  }
}

const bootstrap = read("src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx");
const bridge = read("src/client/game/glitch/harthmere_glitch_bridge.ts");
const harthmereApi = read("src/pages/api/glitch/harthmere.ts");
const clientConfig = read("src/client/game/client_config.ts");
const report = read("src/client/game/util/report.ts");
const atPage = read("src/pages/at/[...slug].tsx");
const indexPage = read("src/pages/index.tsx");
const glitchPage = read("src/pages/glitch.tsx");
const loginPage = read("src/pages/login.tsx");
const playerMeshRoute = read("src/pages/api/assets/player_mesh.glb.ts");
const playerMeshResource = read("src/client/game/resources/player_mesh.ts");
const gameErrorOverlay = read("src/client/components/GameErrorOverlay.tsx");
const wakeUpRoute = read("src/pages/api/upload/wake_up.ts");
const authCheckRoute = read("src/pages/api/auth/check.ts");
const cvalLoggingRoute = read("src/pages/api/cval_logging.ts");
const gpuFallback = read("public/assets/glitch/gpu-benchmarks/2023-06-16_cc4f7417/d-apple.json");
const stackRunner = read("scripts/glitch/run-glitch-local-game-stack-v92.sh");
const dockerfile = read("Dockerfile.biomes");
const notifier = read("src/server/shared/distributed_notifier/notifier.ts");
const artifactGuard = read("scripts/glitch/assert-glitch-build-artifacts-current.cjs");

ok(
  /const INSTALL_PARAM_NAMES = \[\s*"install_id",\s*"installId",\s*\]/s.test(bootstrap),
  "bootstrap reads canonical install_id without adding legacy duplicate query params"
);

ok(
  bootstrap.includes("HARTHMERE_AUTH_GATE_IDENTITY_REFRESH_RELOAD_LIMIT_V142") &&
    bootstrap.includes("server_gate_identity_refreshed") &&
    bootstrap.indexOf("autoLoginWithGlitchInstall(installId)") <
      bootstrap.indexOf("server_gate_identity_refreshed"),
  "bootstrap refreshes install identity before reloading an already-authed server gate"
);

ok(
  bootstrap.includes("glitchAutoAuthReloadAttempts.v142") &&
    !bootstrap.includes("HARTHMERE_AUTH_GATE_ALREADY_RELOADED_V140") &&
    !bootstrap.includes("server_gate_already_authed"),
  "bootstrap does not retain the stale already-reloaded auth gate path"
);

ok(
  bootstrap.includes("auth_cookies_set_after_prior_reload") &&
    /if \(postLoginAuthed \|\| isServerAuthGateWaiting\(\)\)/.test(bootstrap),
  "bootstrap can recover a gated page even when an older auth reload query param is already present"
);

for (const [name, source] of [["index", indexPage], ["glitch", glitchPage], ["login", loginPage]]) {
  ok(
    source.includes("install_id: installId") &&
      !source.includes("glitch_install_id: installId") &&
      !source.includes("game_install_id: installId"),
    `${name} redirect emits install_id only`
  );
}

ok(
  /const GLITCH_INSTALL_QUERY_KEYS = \[\s*"install_id",\s*"installId",\s*\]/s.test(atPage),
  "/at auth gate recognizes the canonical install_id launch path"
);

ok(
  bridge.includes("getParam(params, [\"install_id\", \"installId\"])") &&
    !bridge.includes("getParam(params, [\"glitch_install_id\", \"install_id\"") &&
    !bridge.includes("game_install_id"),
  "Glitch bridge uses install_id as the canonical install identity"
);

ok(
  bridge.includes("reclaimMissingSession") &&
    bridge.includes("response.reason === \"session_not_found\"") &&
    bridge.includes("HARTHMERE_GLITCH_SESSION_RECLAIMED_V139"),
  "bridge reclaims session_not_found instead of disconnecting the player"
);

ok(
  harthmereApi.includes("session_not_found_recovered") &&
    /recovered_missing_session:\s*true/.test(harthmereApi) &&
    !/reason:\s*"session_not_found"\s*\}\);/.test(harthmereApi),
  "server heartbeat treats missing in-memory sessions as recoverable"
);

ok(
  clientConfig.includes("NEXT_PUBLIC_GLITCH_LOCAL_ASSETS") &&
    clientConfig.includes("NEXT_PUBLIC_GLITCH_DISABLE_GCP") &&
    clientConfig.indexOf("NEXT_PUBLIC_GLITCH_DISABLE_GCP") < clientConfig.indexOf("benchmarksURL"),
  "GPU tier detection skips storage.googleapis.com in Glitch local-assets/no-GCP runtime"
);

ok(
  report.includes("shouldSkipWakeUpScreenshotUpload") &&
    report.includes("NEXT_PUBLIC_GLITCH_LOCAL_ASSETS") &&
    report.includes("skipped: true"),
  "wake-up screenshot upload is skipped in Glitch local-assets/no-GCP runtime"
);

ok(
  playerMeshRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    playerMeshRoute.includes("res.redirect(307") &&
    playerMeshResource.includes("/assets/harthmere/gltf/characters/player_body_variants/harthmere_player_average_earth.gltf"),
  "player mesh uses static local fallback instead of hard-failing dynamic generation"
);


ok(
  gameErrorOverlay.includes("HARTHMERE_SUPPRESS_INSTALL_DISCONNECT_OVERLAY_V141") &&
    gameErrorOverlay.includes("isHarthmereInstallLaunch") &&
    gameErrorOverlay.includes("suppressInstallDisconnectOverlay"),
  "install_id launches suppress the duplicate disconnected overlay during sync handoff"
);

ok(
  bridge.includes("HARTHMERE_SUPPRESS_DUPLICATE_DISCONNECT_OVERLAY_V141") &&
    bridge.includes("shouldSuppressDisconnectedOverlay") &&
    bridge.includes("session_not_found_recovered"),
  "Glitch bridge suppresses duplicate disconnect overlay for recovered/missing sessions"
);

ok(
  wakeUpRoute.includes("local_assets_noop") &&
    wakeUpRoute.includes("status(200)") &&
    wakeUpRoute.includes("skipped: true"),
  "/api/upload/wake_up returns success in the simple local-assets runtime"
);

ok(
  authCheckRoute.includes("shouldVerifyUserDocumentForAuthCheck") &&
    authCheckRoute.includes("process.env.GLITCH_RUNTIME") &&
    authCheckRoute.includes("Stale local auth session"),
  "/api/auth/check clears stale stateless cookies in Glitch runtime"
);

ok(
  cvalLoggingRoute.includes("shouldSkipBigQueryCvals") &&
    cvalLoggingRoute.includes("process.env.GLITCH_DISABLE_GCP") &&
    cvalLoggingRoute.includes("process.env.GLITCH_SKIP_GOOGLE_SECRETS") &&
    cvalLoggingRoute.includes("!bigQuery") &&
    cvalLoggingRoute.includes("BigQuery"),
  "/api/cval_logging skips BigQuery in Glitch no-GCP runtime"
);

ok(
  gpuFallback.includes("glitch-local") && gpuFallback.includes("FALLBACK"),
  "local GPU benchmark fallback asset is packaged"
);

ok(
  dockerfile.includes("GLITCH_REDIS_MODE=auto") &&
    dockerfile.includes("redis-server") &&
    dockerfile.includes("DISTRIBUTED_NOTIFIER_KIND=shim"),
  "production image supports local-parity Redis defaults without cloud services"
);

ok(
  stackRunner.includes("Redis external configured host=$REDIS_HOST") &&
    stackRunner.includes("wait_tcp \"$REDIS_HOST\" \"$REDIS_PORT\" redis-external") &&
    stackRunner.includes("Redis not started: shim/memory runtime does not need Redis"),
  "stack runner honors the special production Redis when configured and skips Redis for shim/memory local parity"
);

ok(
  stackRunner.includes("require_env GLITCH_TITLE_ID") &&
    stackRunner.includes("require_env GLITCH_TITLE_TOKEN") &&
    stackRunner.includes("require_env GLITCH_API_BASE_URL") &&
    stackRunner.includes("missing required env"),
  "stack runner fails fast when Glitch title credentials are missing"
);

ok(
  notifier.includes("isGlitchLocalRuntime") &&
    notifier.includes("return \"shim\"") &&
    notifier.indexOf("isGlitchLocalRuntime") < notifier.indexOf("process.env.NODE_ENV === \"production\""),
  "distributed notifier defaults to shim in Glitch local-assets runtime"
);

ok(
  artifactGuard.includes("Glitch build artifacts are stale or incomplete") &&
    artifactGuard.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    artifactGuard.includes("HARTHMERE_AUTH_GATE_IDENTITY_REFRESH_RELOAD_LIMIT_V142") &&
    dockerfile.includes("assert-glitch-build-artifacts-current.cjs"),
  "Docker build rejects stale .next artifacts before deployment"
);

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nGlitch production simple runtime v141 tests passed.");
