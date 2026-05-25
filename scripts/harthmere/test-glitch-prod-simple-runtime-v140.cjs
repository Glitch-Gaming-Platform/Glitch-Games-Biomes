#!/usr/bin/env node
/*
 * GLITCH_PROD_SIMPLE_RUNTIME_V140
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

ok(
  /const INSTALL_PARAM_NAMES = \[\s*"install_id",\s*"installId",\s*\]/s.test(bootstrap),
  "bootstrap reads canonical install_id without adding legacy duplicate query params"
);

ok(
  bootstrap.includes("HARTHMERE_AUTH_GATE_ALREADY_RELOADED_V140") &&
    /if \(!isAfterReload\) \{\s*if \(markAutoAuthReload\(installId, "server_gate_already_authed"\)\)/s.test(bootstrap),
  "bootstrap does not reload forever when the iframe is already authed"
);

ok(
  bootstrap.includes("HARTHMERE_AUTH_RELOAD_LIMIT_CONTINUE_V140") &&
    bootstrap.includes("reason: \"server_gate_already_authed\"") &&
    bootstrap.indexOf("HARTHMERE_AUTH_RELOAD_LIMIT_CONTINUE_V140") < bootstrap.indexOf("HARTHMERE_ALREADY_AUTHED_V128"),
  "bootstrap continues when the server_gate_already_authed reload limit is reached"
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

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nGlitch production simple runtime v140 tests passed.");
