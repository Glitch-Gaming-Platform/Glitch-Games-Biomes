#!/usr/bin/env node
/*
 * HARTHMERE_INSTALL_ID_FLOW validator
 * Confirms the current source modifications, unit tests, E2E, and runner are in
 * place and consistent. Run with: node validate-harthmere-install-id-flow.cjs /path/to/repo
 */
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());

function read(rel) {
  const p = path.join(repo, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel} (looked for ${p})`);
  return fs.readFileSync(p, "utf8");
}

function ok(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK ${msg}`);
}

const clientConfig = read("src/client/game/client_config.ts");
const bootstrap = read("src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx");
const loadProgress = read("src/client/game/load_progress.ts");
const game = read("src/client/components/Game.tsx");
const unitTest = read("scripts/harthmere/test-harthmere-install-id-flow-unit.cjs");
const e2eCjs = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e.cjs");
const e2eSh = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e.sh");
const runSh = read("scripts/harthmere/run-harthmere-install-player-ingame-local.sh");

// client_config.ts: current sync URL resolver
ok(/HARTHMERE_RUNTIME_SYNC_BASE_URL/.test(clientConfig),
   "client_config.ts has current runtime sync base url marker");
ok(/export function resolveGlitchLocalSyncBaseUrl/.test(clientConfig),
   "client_config.ts exports resolveGlitchLocalSyncBaseUrl");
ok(/explicit_points_to_remote_but_install_id_local/.test(clientConfig),
   "client_config.ts forces fallback when explicit points to remote during install_id playboot");
ok(/HARTHMERE_SYNC_URL_RESOLVED/.test(clientConfig),
   "client_config.ts logs HARTHMERE_SYNC_URL_RESOLVED marker");
ok(/installIdInUrl/.test(clientConfig),
   "client_config.ts derives installIdInUrl from window.location.search");

// bootstrap: current checkpoint markers
ok(/HARTHMERE_INSTALL_ID_FOUND/.test(bootstrap),
   "bootstrap emits HARTHMERE_INSTALL_ID_FOUND");
ok(/HARTHMERE_INITIAL_AUTH_CHECK/.test(bootstrap),
   "bootstrap emits HARTHMERE_INITIAL_AUTH_CHECK");
ok(/HARTHMERE_AUTO_LOGIN_REQUEST/.test(bootstrap),
   "bootstrap emits HARTHMERE_AUTO_LOGIN_REQUEST");
ok(/HARTHMERE_AUTO_LOGIN_RESPONSE/.test(bootstrap),
   "bootstrap emits HARTHMERE_AUTO_LOGIN_RESPONSE");
ok(/HARTHMERE_POST_LOGIN_AUTH_CHECK/.test(bootstrap),
   "bootstrap emits HARTHMERE_POST_LOGIN_AUTH_CHECK");
ok(/HARTHMERE_PRE_RELOAD/.test(bootstrap),
   "bootstrap emits HARTHMERE_PRE_RELOAD");
ok(/HARTHMERE_ALREADY_AUTHED/.test(bootstrap),
   "bootstrap emits HARTHMERE_ALREADY_AUTHED");
ok(/HARTHMERE_AUTH_COOKIE_MISSING/.test(bootstrap),
   "bootstrap emits HARTHMERE_AUTH_COOKIE_MISSING");
ok(/GLITCH_INSTALL_BOOTSTRAP_AUTO_LOGIN/.test(bootstrap),
   "bootstrap preserves legacy current marker for compatibility");
ok(/export function findInstallId/.test(bootstrap),
   "bootstrap exports findInstallId for unit testing");
ok(/export function normalizeIdentity/.test(bootstrap),
   "bootstrap exports normalizeIdentity for unit testing");
ok(/initialAuthed\)[\s\S]*?HARTHMERE_ALREADY_AUTHED/.test(bootstrap),
   "bootstrap skips the autoLogin reload when already authed");

// current changes must still be present (we built on top of them)
ok(/HARTHMERE_CLIENT_CONTEXT_RENDER_UNBLOCK/.test(loadProgress),
   "load_progress.ts still has current render-unblock marker");
ok(/HARTHMERE_GAME_MOUNT_CONTEXT_BEFORE_RENDER_READY/.test(game),
   "Game.tsx still has current early canvas mount marker");

// Unit test
ok(/HARTHMERE_INSTALL_ID_FLOW_UNIT/.test(unitTest),
   "unit test has current marker");
ok(/resolveGlitchLocalSyncBaseUrl/.test(unitTest),
   "unit test exercises resolveGlitchLocalSyncBaseUrl");
ok(/findInstallId/.test(unitTest),
   "unit test exercises findInstallId");
ok(/normalizeIdentity/.test(unitTest),
   "unit test exercises normalizeIdentity");
ok(/azurecontainerapps/.test(unitTest),
   "unit test covers the azurecontainerapps remote URL regression case");

// E2E JS test
ok(/HARTHMERE_INSTALL_PLAYER_INGAME_E2E/.test(e2eCjs),
   "current browser E2E marker exists");
ok(/HARTHMERE_INSTALL_ID_FOUND/.test(e2eCjs) &&
   /HARTHMERE_AUTO_LOGIN_RESPONSE/.test(e2eCjs) &&
   /HARTHMERE_POST_LOGIN_AUTH_CHECK/.test(e2eCjs) &&
   /HARTHMERE_SYNC_URL_RESOLVED/.test(e2eCjs),
   "E2E test tracks every current checkpoint marker");
ok(/ws-host-mismatch/.test(e2eCjs),
   "E2E test detects WebSocket host mismatch (stale build env)");
ok(/failure === "net::ERR_ABORTED"/.test(e2eCjs) &&
   /\\\/api\\\/auth\\\/check/.test(e2eCjs),
   "E2E test ignores expected ERR_ABORTED on /api/auth/check during planned reload");
ok(/renderedFrames/.test(e2eCjs) && /minRenderedFrames/.test(e2eCjs),
   "E2E test waits for rendered frames");
ok(/playerMeshLoaded/.test(e2eCjs) && /scene\/player\/mesh/.test(e2eCjs),
   "E2E test waits for player mesh resource");
ok(/hasVisibleGameCanvas/.test(e2eCjs) && /biomes-canvas/.test(e2eCjs),
   "E2E test checks visible game canvas");
ok(/report\.json/.test(e2eCjs) && /failure\.png/.test(e2eCjs),
   "E2E test writes report and screenshots");
ok(/failedCheckpoint/.test(e2eCjs),
   "E2E test reports which checkpoint stalled");

// E2E shell wrapper
ok(/autoLogin/.test(e2eSh) && /api\/auth\/check/.test(e2eSh),
   "shell test verifies autoLogin and auth check preflight");
ok(/docker logs --since/.test(e2eSh) && /known blocker found/.test(e2eSh),
   "shell test scans only fresh container logs for blockers");

// Runner
ok(/next build/.test(runSh) && /webpack/.test(runSh) && /docker buildx build/.test(runSh),
   "runner rebuilds production image");
ok(/--config server\.webpack\.config\.cjs/.test(runSh) &&
   !/--config server\.webpack\.config\.ts/.test(runSh),
   "runner uses the CommonJS webpack config supported by the current CLI boundary");
ok(/rm -rf[^\n]*\.next[^\n]*(\s|$)/.test(runSh) &&
   !/rm -rf[^\n]*\.next\/cache[^\n]*(\s|$)/.test(runSh.split("\n").filter(l => /rm -rf.*\.next/.test(l)).join("\n").replace(/rm -rf[^\n]*\.next(\s|[^\/])/g, "")),
   "runner removes the entire .next/ directory (not just .next/cache)");
ok(/test-harthmere-install-player-ingame-e2e\.sh/.test(runSh),
   "runner ends with current E2E test");
ok(/api\/bikkie/.test(runSh),
   "runner waits for web readiness via /api/bikkie");
ok(/NEXT_PUBLIC_GLITCH_SYNC_BASE_URL/.test(runSh),
   "runner sets NEXT_PUBLIC_GLITCH_SYNC_BASE_URL at build time");
ok(/grep[^\n]*NEXT_PUBLIC_GLITCH_SYNC_BASE_URL/.test(runSh) ||
   /env_preflight|\.env\.local/.test(runSh),
   "runner checks .env.local for stale NEXT_PUBLIC_GLITCH_SYNC_BASE_URL");

console.log("Harthmere install-id full-flow current validation passed.");
