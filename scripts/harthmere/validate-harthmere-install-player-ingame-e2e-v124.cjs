#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const repo = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  const p = path.join(repo, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}`);
  return fs.readFileSync(p, "utf8");
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log(`OK ${msg}`);
}
const js = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e-v124.cjs");
const sh = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e-v124.sh");
const run = read("scripts/harthmere/run-harthmere-install-player-ingame-local-v124.sh");
ok(js.includes("HARTHMERE_INSTALL_PLAYER_INGAME_E2E_V124"), "v124 browser E2E marker exists");
ok(js.includes("rendererController") && js.includes("renderedFrames") && js.includes("minRenderedFrames"), "browser E2E waits for rendered frames");
ok(js.includes("playerMeshLoaded") && js.includes("/scene/player/mesh"), "browser E2E waits for player mesh loaded resource");
ok(js.includes("hasVisibleGameCanvas") && js.includes("biomes-canvas"), "browser E2E checks visible game canvas");
ok(js.includes("clientContext") && js.includes("hasClientContext"), "browser E2E checks real client context exists");
ok(js.includes("remotePlayerMeshPattern") && js.includes("biomes\\.gg") && js.includes("player_mesh\\.glb"), "browser E2E fails on remote player_mesh.glb requests");
ok(js.includes("playerMeshApiPattern") && js.includes("player-mesh-response"), "browser E2E fails on bad local player_mesh.glb responses");
ok(js.includes("/sync/createPlayer") && js.includes("/sync/oob"), "browser E2E fails on sync/createPlayer and oob blockers");
ok(js.includes("ModuleNotFoundError") && js.includes("ECONNRESET") && js.includes("Load screen stuck") && js.includes("ClientLongLoad"), "browser E2E fails on known asset and loading blockers");
ok(js.includes("report.json") && js.includes("failure.png") && js.includes("success.png"), "browser E2E writes report and screenshots");
ok(sh.includes("autoLogin") && sh.includes("/api/auth/check"), "shell test verifies install autoLogin and auth check preflight");
ok(sh.includes("docker logs --since") && sh.includes("known blocker found"), "shell test scans only fresh container logs for blockers");
ok(run.includes("next build") && run.includes("webpack") && run.includes("docker buildx build"), "full local runner rebuilds production image");
ok(run.includes("wait for web server") && run.includes("/api/bikkie"), "full local runner waits for web readiness");
ok(run.includes("test-harthmere-install-player-ingame-e2e-v124.sh"), "full local runner ends with full E2E test");
console.log("Harthmere install/player-in-game E2E v124 validation passed");
