#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const bootstrapPath = path.join(
  root,
  "src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx"
);

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

assert(
  bootstrap.includes("GLITCH_BIOMES_DEV_AUTH_BRIDGE_V101"),
  "v101 auth bridge marker exists"
);
assert(
  bootstrap.includes("function stableBiomesAuthUsername"),
  "bootstrap derives a safe Biomes username from the Glitch identity"
);
assert(
  bootstrap.includes('replace(/[^a-zA-Z0-9]/g, "")'),
  "derived Biomes username strips invalid UUID/Glitch characters"
);
assert(
  bootstrap.includes("const username = stableBiomesAuthUsername(identity, installId)"),
  "dev auth uses the safe derived Biomes username instead of raw install id/display name"
);
assert(
  bootstrap.includes("async function checkBiomesAuth()"),
  "bootstrap has reusable Biomes auth check"
);
assert(
  /fetch\(\"\/api\/auth\/check\"[\s\S]*?method:\s*\"POST\"/.test(bootstrap),
  "auth check uses POST, matching /api/auth/check client usage"
);
assert(
  /const loginJson = await response\.json\(\)\.catch/.test(bootstrap),
  "dev login response JSON is parsed"
);
assert(
  /const callbackUri = firstString\(loginJson\?\.uri\)/.test(bootstrap),
  "dev login callback URI is extracted"
);
assert(
  /fetch\(callbackUri,[\s\S]*?credentials:\s*\"same-origin\"[\s\S]*?redirect:\s*\"follow\"/.test(bootstrap),
  "bootstrap follows the dev auth callback with same-origin credentials"
);
assert(
  bootstrap.includes("auth cookie check failed after callback"),
  "bootstrap verifies auth cookies after callback"
);
assert(
  bootstrap.includes('nextUrl.searchParams.set("glitch_biomes_auth", "1")'),
  "successful auto-auth reload is marked in the URL"
);
assert(
  !/GLITCH_BIOMES_DEV_AUTH_BRIDGE_V100[\s\S]*?window\.location\.replace\(window\.location\.href\)/.test(bootstrap),
  "old reload-without-callback path is absent"
);

if (failed) {
  console.error("Glitch install auto-auth v101 test failed");
  process.exit(1);
}
console.log("Glitch install auto-auth v101 test passed");
