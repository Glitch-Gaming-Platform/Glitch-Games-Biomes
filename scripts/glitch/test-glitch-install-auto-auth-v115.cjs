#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const bootstrapPath = path.join(
  root,
  "src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx"
);
const routePath = path.join(root, "src/pages/api/glitch/harthmere.ts");

let failed = false;
function pass(message) {
  console.log(`OK ${message}`);
}
function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}
function assert(condition, message) {
  condition ? pass(message) : fail(message);
}

const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

assert(
  bootstrap.includes("GLITCH_BIOMES_INSTALL_AUTH_BRIDGE_V115"),
  "v115 install auth bridge marker exists"
);
assert(
  bootstrap.includes('op: "autoLogin"'),
  "bootstrap calls the validated Glitch autoLogin operation"
);
assert(
  !bootstrap.includes('/api/auth/dev/login'),
  "bootstrap no longer uses the unsafe dev auth endpoint"
);
assert(
  bootstrap.includes('nextUrl.searchParams.set("glitch_biomes_auth", "1")'),
  "successful first auth reload is still marked in the URL"
);
assert(
  route.includes('if (op === "autoLogin")'),
  "server route exposes autoLogin operation"
);
assert(
  route.includes("validateInstallWithGlitch(titleId, body)"),
  "autoLogin validates the Glitch install before creating a Biomes session"
);
assert(
  route.includes("setAuthCookies(res, session)"),
  "autoLogin sets normal Biomes auth cookies"
);
assert(
  route.includes("connectForeignAuth") && route.includes("getUserOrCreateIfNotExists"),
  "autoLogin creates or reuses a stable Biomes account link"
);
assert(
  route.includes("ensurePlayerExists"),
  "autoLogin bootstraps the ECS player before the sync client connects"
);
assert(
  route.includes("validationsByKey") && route.includes("GLITCH_VALIDATE_CACHE_MS"),
  "install validation is cached briefly to avoid duplicate slow Glitch API calls"
);

if (failed) {
  console.error("Glitch install auto-auth v115 test failed");
  process.exit(1);
}
console.log("Glitch install auto-auth v115 test passed");
