#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const game = read("src/client/components/Game.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const proxy = read("src/pages/api/glitch/harthmere.ts");
const bridge = read("src/client/game/glitch/harthmere_glitch_bridge.ts");
const identity = read("src/client/game/glitch/harthmere_glitch_identity.ts");

assert(exists("src/client/game/glitch/harthmere_glitch_identity.ts"), "identity helper exists");
assert(identity.includes("HarthmereGlitchIdentity") && identity.includes("gameUserId"), "identity helper stores game user id");
assert(identity.includes("glitchUserId") && identity.includes("userName"), "identity helper stores Glitch user id and username");
assert(game.includes("useHarthmereGlitchBridge(Boolean(clientContext), clientContext);"), "Game.tsx passes client context into Glitch bridge");
assert(hud.includes("getHarthmereGlitchGameUserId") && hud.includes("setHarthmereLocalDevUserScope(glitchGameUserId ?? userId)"), "HUD scopes Harthmere state by Glitch game user id when available");
assert(proxy.includes("claimSession") && proxy.includes("heartbeatSession") && proxy.includes("releaseSession"), "API proxy supports session claim, heartbeat, and release");
assert(proxy.includes("new_login_replaced_idle_session") && proxy.includes("GLITCH_IDLE_SESSION_MS"), "API proxy disconnects older idle sessions for same Glitch user");
assert(proxy.includes("normalizeIdentityFromValidateResponse") && proxy.includes("game_user_id") && proxy.includes("user_name"), "API proxy normalizes validation username and user id");
assert(bridge.includes("identityFromResponse") && bridge.includes("writeHarthmereGlitchIdentity(identity)"), "browser bridge writes validated identity");
assert(bridge.includes("BroadcastChannel") && bridge.includes("newer_local_session_claimed"), "browser bridge disconnects duplicate local tab sessions");
assert(bridge.includes("showDisconnectedOverlay") && bridge.includes("session disconnected"), "browser bridge shows disconnection overlay");
assert(bridge.includes("heartbeatNow") && bridge.includes("serverSessionId"), "debug API exposes heartbeat/session state");
assert(!bridge.includes("GLITCH_TITLE_TOKEN"), "browser bridge does not read or expose title token");
const secretLikePattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{12,}/;
assert(!proxy.match(secretLikePattern), "title-token-shaped secret is not hard-coded into proxy source");
assert(!bridge.match(secretLikePattern), "title-token-shaped secret is not hard-coded into browser source");

if (process.exitCode) {
  process.exit(process.exitCode);
}
