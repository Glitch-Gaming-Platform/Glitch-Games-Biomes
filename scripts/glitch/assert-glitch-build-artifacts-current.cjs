#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
let failures = 0;

function ok(message) {
  console.log(`OK ${message}`);
}

function fail(message, detail) {
  failures += 1;
  console.error(`FAIL ${message}`);
  if (detail) console.error(detail);
}

function p(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.readFileSync(p(rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(p(rel));
}

function badPolicyStrings() {
  return [
    [
      "",
      "assets",
      "harthmere",
      "gltf",
      "characters",
      "player_body_variants",
      "harthmere_player_average_earth.gltf",
    ].join("/"),
    ["GLITCH", "STATIC", "PLAYER", "MESH", "FALLBACK"].join("_"),
    ["GLITCH", "STATIC", "PLAYER", "MESH", "HOTFIX"].join("_"),
    ["GLITCH", "PLAYER", "MESH", "FALLBACK", "ON", "BUILD", "ERROR"].join("_"),
    ["GLITCH", "DISABLE", "ASSET", "EXPORT", "SERVER"].join("_"),
  ];
}

function collectFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (rel.includes("node_modules") || rel.includes(".git") || rel.includes(".cache")) continue;
      collectFiles(abs, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function readMany(relFiles, maxBytes = 64 * 1024 * 1024) {
  let text = "";
  for (const rel of relFiles) {
    const abs = p(rel);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > maxBytes) continue;
    try {
      text += `\n/* ${rel} */\n` + fs.readFileSync(abs, "utf8");
    } catch {}
  }
  return text;
}

/**
 * Scan large build trees without concatenating every bundle into one V8
 * string. The old aggregation could exceed the runtime string limit, catch the
 * RangeError as if one file were unreadable, and silently skip a later bundle
 * containing the required marker.
 */
function scanFilesForNeedles(
  relFiles,
  needles,
  maxBytes = 64 * 1024 * 1024
) {
  const found = new Set();
  for (const rel of relFiles) {
    const abs = p(rel);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > maxBytes) continue;
    try {
      const text = fs.readFileSync(abs, "utf8");
      for (const needle of needles) {
        if (!found.has(needle) && text.includes(needle)) found.add(needle);
      }
    } catch {}
  }
  return found;
}

function expectScannedContains(name, found, needle) {
  if (found.has(needle)) ok(`${name} contains ${needle}`);
  else fail(`${name} missing ${needle}`);
}

function expectScannedNotContains(name, found, needle) {
  if (!found.has(needle)) ok(`${name} does not contain removed policy ${needle}`);
  else fail(`${name} still contains removed policy ${needle}`);
}

function expectContainsText(name, text, needle) {
  if (text.includes(needle)) ok(`${name} contains ${needle}`);
  else fail(`${name} missing ${needle}`);
}

function expectNotContainsText(name, text, needle) {
  if (!text.includes(needle)) ok(`${name} does not contain removed policy ${needle}`);
  else fail(`${name} still contains removed policy ${needle}`);
}

function expectContainsFile(rel, needle, message) {
  if (!exists(rel)) return fail(`${rel} exists`);
  const text = read(rel);
  if (text.includes(needle)) ok(message);
  else fail(message, `${rel} missing ${needle}`);
}

function expectNotContainsFile(rel, needle, message) {
  if (!exists(rel)) return fail(`${rel} exists`);
  const text = read(rel);
  if (!text.includes(needle)) ok(message);
  else fail(message, `${rel} contains ${needle}`);
}

function expectNextPagesManifestRoute(route) {
  const rel = ".next/server/pages-manifest.json";
  if (!exists(rel)) {
    return ok("built Next pages manifest not present yet; source policy validated before build");
  }
  const manifest = JSON.parse(read(rel));
  if (manifest[route]) {
    ok(`built Next pages manifest includes ${route}`);
  } else {
    fail(`built Next pages manifest missing ${route}`);
  }
}

const bad = badPolicyStrings();

expectContainsFile(
  "src/client/game/resources/player_mesh.ts",
  "/api/assets/player_mesh.glb",
  "source player mesh resource routes players through /api/assets/player_mesh.glb"
);
expectNotContainsFile(
  "src/client/game/resources/player_mesh.ts",
  bad[0],
  "source player mesh resource does not return static body variants"
);
expectContainsFile(
  "src/pages/api/assets/player_mesh.glb.ts",
  "X-Glitch-Player-Mesh-Mode",
  "source player mesh route computes locally and emits computed-local diagnostic header"
);
expectNotContainsFile(
  "src/pages/api/assets/player_mesh.glb.ts",
  "unsafeResponse.redirect",
  "source player mesh route has no fallback redirect"
);
for (const s of bad.slice(0, 4)) {
  expectNotContainsFile(
    "src/pages/api/assets/player_mesh.glb.ts",
    s,
    `source player mesh route excludes removed policy ${s}`
  );
}
expectContainsFile(
  "src/server/web/config.ts",
  'defaultValue: "lazy"',
  "source web config defaults and forces local/lazy asset runtime in Glitch production"
);
expectContainsFile(
  "src/server/web/config.ts",
  "shouldForceLocalAssetRuntime",
  "source web config exports forced local runtime policy"
);
expectContainsFile(
  "src/server/web/main.ts",
  "Ignoring disabled/proxy asset server mode in Glitch runtime; using lazy local asset server instead",
  "source web main converts none/proxy back to lazy when forced local runtime is active"
);
expectNotContainsFile(
  "src/server/web/main.ts",
  bad[4],
  "source web main removed the disable-asset-export killswitch entirely"
);
expectContainsFile(
  "src/client/game/resources/npcs.ts",
  "/api/assets/player_mesh.glb",
  "source NPC resources keep player-like NPCs on generated player mesh path"
);
expectContainsFile(
  "src/client/game/resources/npcs.ts",
  "fallback",
  "source NPC resources keep visible fallback path"
);

const nextFiles = collectFiles(p(".next")).filter((rel) => {
  // .map files are debug/source-map text.
  // .nft.json files are Next output-file-tracing manifests that list packaged
  // public assets; they are not executable runtime code and may legitimately
  // mention old public asset files that still exist in public/.
  if (rel.endsWith(".map") || rel.endsWith(".nft.json")) return false;
  return /[.](js|json|html)$/i.test(rel);
});
if (nextFiles.length) {
  const nextNeedles = [
    "X-Glitch-Player-Mesh-Mode",
    "/api/assets/player_mesh.glb",
    ...bad.slice(0, 4),
  ];
  const nextFound = scanFilesForNeedles(nextFiles, nextNeedles);
  expectScannedContains(
    "built Next artifacts",
    nextFound,
    "X-Glitch-Player-Mesh-Mode"
  );
  expectScannedContains(
    "built Next artifacts",
    nextFound,
    "/api/assets/player_mesh.glb"
  );
  expectNextPagesManifestRoute("/");
  expectNextPagesManifestRoute("/api/assets/player_mesh.glb");
  expectNextPagesManifestRoute("/api/glitch/harthmere");
  expectNextPagesManifestRoute("/api/glitch/runtime_environment");
  expectNextPagesManifestRoute("/api/harthmere/live_mode");
  expectNextPagesManifestRoute("/api/harthmere/live_mode_jobs_board_state");
  expectNextPagesManifestRoute("/api/harthmere/live_mode_player_status_state");
  expectNextPagesManifestRoute("/at/[[...slug]]");
  for (const s of bad.slice(0, 4))
    expectScannedNotContains("built Next artifacts", nextFound, s);
} else {
  ok("built Next artifacts not present yet; source policy validated before build");
}

const serverFiles = [
  ...collectFiles(p("dist")),
  ...collectFiles(p("build")),
  ...collectFiles(p("server")),
].filter((rel) => /[.](js|cjs|mjs|json)$/i.test(rel));
if (serverFiles.length) {
  const serverNeedles = ["shouldForceLocalAssetRuntime", ...bad];
  const serverFound = scanFilesForNeedles(serverFiles, serverNeedles);
  expectScannedContains(
    "built server bundle",
    serverFound,
    "shouldForceLocalAssetRuntime"
  );
  for (const s of bad)
    expectScannedNotContains("built server bundle", serverFound, s);
} else {
  ok("built server bundle not present yet; source policy validated before webpack build");
}

if (failures) {
  console.error("\nGlitch build artifacts are stale or incompatible with prod/local asset parity.");
  console.error("Rebuild before Docker packaging:");
  console.error("  rm -rf .next/cache dist");
  console.error("  GLITCH_RUNTIME=1 GLITCH_LOCAL_ASSETS=1 NEXT_PUBLIC_GLITCH_RUNTIME=1 NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1 GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER=1 NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build --webpack");
  console.error("  NODE_ENV=production NODE_OPTIONS=\"\" ./node_modules/.bin/webpack --config server.webpack.config.cjs --mode production");
  process.exit(1);
}
console.log("\nGlitch build artifacts are current for generated-local prod/local asset parity.");
