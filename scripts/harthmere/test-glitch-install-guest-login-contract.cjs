#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error(`FAIL missing ${rel}`);
    process.exit(1);
  }
  return fs.readFileSync(p, "utf8");
}

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  console.log(`OK ${msg}`);
}

const route = read("src/pages/api/glitch/harthmere.ts");
const bootstrap = read(
  "src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx"
);
const cookies = fs.existsSync(
  path.join(root, "src/server/shared/auth/cookies.ts")
)
  ? read("src/server/shared/auth/cookies.ts")
  : "";

ok(route.includes("autoLogin"), "server route exposes autoLogin");
ok(
  route.includes("validateInstallWithGlitch"),
  "autoLogin validates the Glitch install"
);
ok(
  route.includes("createBiomesAuthForGlitchIdentity") ||
    route.includes("createSession"),
  "autoLogin uses normal Biomes auth/session creation"
);
ok(
  route.includes("ensure") && /player/i.test(route),
  "autoLogin bootstraps or ensures the ECS player before sync"
);
ok(
  route.includes("install:${installId}") ||
    route.includes("`install:${installId}`"),
  "install_id maps to persistent gameUserId install:<install_id>"
);

ok(
  route.includes('"Guest"') || route.includes("'Guest'"),
  'missing Glitch username falls back to "Guest"'
);

ok(
  !route.includes("forceplay_no_cookie_auth") &&
    !route.includes("GLITCH_FORCEPLAY_HTTP_INTERCEPT") &&
    !route.includes("return {};"),
  "source does not contain forceplay/no-cookie runtime hack behavior"
);

ok(
  !route.match(/userId\s*:\s*0/) &&
    !route.match(/user_id\s*:\s*0/) &&
    !bootstrap.match(/userId\s*:\s*0/),
  "install auth never returns userId 0"
);

ok(
  bootstrap.includes("HARTHMERE_AUTO_LOGIN_REQUEST") ||
    bootstrap.includes("autoLogin"),
  "client calls autoLogin"
);
ok(
  bootstrap.includes("HARTHMERE_POST_LOGIN_AUTH_CHECK") ||
    bootstrap.includes("checkBiomesAuth"),
  "client verifies normal auth after autoLogin"
);
ok(
  !bootstrap.includes("/api/auth/dev/login"),
  "client does not use unsafe dev login"
);

if (cookies) {
  ok(
    cookies.includes("SameSite") || cookies.includes("sameSite"),
    "auth cookie helper controls SameSite behavior"
  );
}

console.log("Glitch install guest-login contract passed.");
