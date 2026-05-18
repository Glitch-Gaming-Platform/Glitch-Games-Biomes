#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
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
const proxy = read("src/pages/api/glitch/harthmere.ts");
const bridge = read("src/client/game/glitch/harthmere_glitch_bridge.ts");
const seed = read("scripts/harthmere/seed-glitch-harthmere-progression-v68.cjs");

assert(game.includes("useHarthmereGlitchBridge"), "Game.tsx imports the Harthmere Glitch bridge hook");
assert(game.includes("useHarthmereGlitchBridge(Boolean(clientContext));"), "Game.tsx starts bridge only after client context is ready");
assert(proxy.includes("process.env[name]") && proxy.includes('envString("GLITCH_TITLE_TOKEN")'), "API proxy reads GLITCH_TITLE_TOKEN server-side");
assert(!bridge.includes("GLITCH_TITLE_TOKEN"), "browser bridge does not read or expose the title token");
const secretLikePattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{12,}/;
assert(!secretLikePattern.test(proxy), "title-token-shaped secret is not hard-coded into proxy source");
assert(!secretLikePattern.test(bridge), "title-token-shaped secret is not hard-coded into browser source");
assert(proxy.includes("validate") && proxy.includes("listSaves") && proxy.includes("storeSave") && proxy.includes("submitProgression"), "proxy supports validate, cloud saves, and progression submit ops");
assert(bridge.includes("collectHarthmereStorage") && bridge.includes("applySnapshot"), "bridge captures and restores Harthmere local state for cloud saves");
assert(bridge.includes("harthmere_playtime_seconds") && bridge.includes("harthmere_highest_level"), "bridge submits playtime stats and leaderboard scores");
assert(bridge.includes("playerAchievements") && bridge.includes("leaderboard"), "bridge exposes achievements and leaderboard debug helpers");
assert(seed.includes("GLITCH_ADMIN_JWT") && seed.includes("Do not use GLITCH_TITLE_TOKEN"), "seed script requires admin JWT instead of title token");
assert(seed.includes("harthmere_first_steps") && seed.includes("harthmere_level_5"), "seed script defines Harthmere achievements");
assert(fs.existsSync(path.join(root, ".env.local.glitch-harthmere.example")), "env example exists for local/prod server config");

if (process.exitCode) {
  process.exit(process.exitCode);
}
