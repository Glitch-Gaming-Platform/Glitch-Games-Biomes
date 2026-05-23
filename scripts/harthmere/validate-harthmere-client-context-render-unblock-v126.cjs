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
const load = read("src/client/game/load_progress.ts");
const game = read("src/client/components/Game.tsx");
const js = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e-v126.cjs");
const sh = read("scripts/harthmere/test-harthmere-install-player-ingame-e2e-v126.sh");
const run = read("scripts/harthmere/run-harthmere-install-player-ingame-local-v126.sh");
const all = `${load}\n${game}\n${js}\n${sh}\n${run}`;

ok(/HARTHMERE_CLIENT_CONTEXT_RENDER_UNBLOCK_V126/.test(load), "ClientLoader has v126 render-unblock marker");
ok(/onContextReady\?:\s*\(context:\s*ClientContext\)\s*=>\s*void/.test(load), "ClientLoader accepts onContextReady callback");
ok(/this\.onContextReady\?\.\(clientContext\)/.test(load), "ClientLoader publishes context before awaiting ready");
ok(/const ret = await loadCompletePromise/.test(load), "ClientLoader still waits for full ready before resolving load");
ok(/HARTHMERE_GAME_MOUNT_CONTEXT_BEFORE_RENDER_READY_V126/.test(game), "Game has v126 early canvas mount marker");
ok(/new ClientLoader\([\s\S]*setClientContext\(context\)/.test(game), "Game passes setClientContext callback into ClientLoader");
ok(/if \(!clientContext\)[\s\S]*return <><\/>/.test(game), "Game still guards rendering until context exists");

ok(/HARTHMERE_INSTALL_PLAYER_INGAME_E2E_V126/.test(js), "v126 browser E2E marker exists");
ok(/renderedFrames/.test(js) && /minRenderedFrames/.test(js), "browser E2E waits for rendered frames");
ok(/playerMeshLoaded/.test(js) && /scene\/player\/mesh/.test(js), "browser E2E waits for player mesh loaded resource");
ok(/hasVisibleGameCanvas/.test(js) && /biomes-canvas/.test(js), "browser E2E checks visible game canvas");
ok(/clientContext/.test(js) && /hasClientContext/.test(js), "browser E2E checks real client context exists");
ok(/remotePlayerMeshPattern/.test(js) && /biomes\\\.gg/.test(js) && /player_mesh\\\.glb/.test(js), "browser E2E fails on remote player_mesh.glb requests");
ok(/playerMeshApiPattern/.test(js) && /player-mesh-response/.test(js), "browser E2E fails on bad local player_mesh.glb responses");
ok(/sync\\\/createPlayer|sync\/createPlayer/.test(js) && /sync\\\/oob|sync\/oob/.test(js), "browser E2E fails on sync/createPlayer and oob blockers");
ok(/ModuleNotFoundError/.test(js) && /ECONNRESET/.test(js) && /Load screen stuck/.test(js) && /ClientLongLoad/.test(js), "browser E2E fails on known asset and loading blockers");
ok(/report\.json/.test(js) && /failure\.png/.test(js) && /success\.png/.test(js), "browser E2E writes report and screenshots");
ok(/autoLogin/.test(sh) && /api\/auth\/check/.test(sh), "shell test verifies install autoLogin and auth check preflight");
ok(/docker logs --since/.test(sh) && /known blocker found/.test(sh), "shell test scans only fresh container logs for blockers");
ok(/next build/.test(run) && /webpack/.test(run) && /docker buildx build/.test(run), "full local runner rebuilds production image");
ok(/wait for web server/.test(run) && /api\/bikkie/.test(run), "full local runner waits for web readiness");
ok(/test-harthmere-install-player-ingame-e2e-v126\.sh/.test(run), "full local runner ends with full E2E test");
ok(!/v125/.test(all), "v126 scripts do not call stale v125 assets");
console.log("Harthmere client-context render unblock + player-in-game E2E v126 validation passed");
