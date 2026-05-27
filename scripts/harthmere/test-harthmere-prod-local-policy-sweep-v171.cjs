#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
let failures = 0;
function ok(msg) { console.log(`OK    ${msg}`); }
function fail(msg, detail) { failures++; console.error(`FAIL  ${msg}`); if (detail) console.error(`      ${detail}`); }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function walk(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name.endsWith(".bak") || ent.name.endsWith(".orig")) continue;
    const p = path.join(abs, ent.name);
    const rel = path.relative(root, p);
    if (ent.isDirectory()) walk(rel, out);
    else if (/\.(cjs|mjs|js|ts|tsx|jsx)$/.test(ent.name)) out.push(rel);
  }
  return out;
}
const legacyPath = "/" + ["assets", "harthmere", "gltf", "characters", "player_body_variants", "harthmere_player_average_earth.gltf"].join("/");
const legacyEnvs = [
  ["GLITCH", "STATIC", "PLAYER", "MESH", "FALLBACK"].join("_"),
  ["GLITCH", "STATIC", "PLAYER", "MESH", "HOTFIX"].join("_"),
  ["GLITCH", "PLAYER", "MESH", "FALLBACK", "ON", "BUILD", "ERROR"].join("_"),
];
const sourceFiles = [
  "src/server/web/main.ts",
  "src/server/web/config.ts",
  "src/pages/api/assets/player_mesh.glb.ts",
  "src/client/game/resources/player_mesh.ts",
  "src/client/game/resources/npcs.ts",
];
for (const rel of sourceFiles) {
  if (!exists(rel)) { fail(`${rel} exists`); continue; }
}
const main = exists("src/server/web/main.ts") ? read("src/server/web/main.ts") : "";
if (!main.includes("shouldForceLocalAssetRuntime")) fail("web main still uses forced local runtime gate"); else ok("web main still uses forced local runtime gate");
if (/GLITCH_DISABLE_ASSET_EXPORT_SERVER/.test(main)) fail("web main has no disable-asset-export killswitch left"); else ok("web main has no disable-asset-export killswitch left");
if (!/case\s+["']none["'][\s\S]*case\s+["']proxy["'][\s\S]*shouldForceLocalAssetRuntime\(\)[\s\S]*LazyAssetExportsServer/.test(main)) fail("web main converts none/proxy to lazy under forced local runtime"); else ok("web main converts none/proxy to lazy under forced local runtime");

const config = exists("src/server/web/config.ts") ? read("src/server/web/config.ts") : "";
if (!/defaultValue:\s*["']lazy["']/.test(config)) fail("web config defaults asset server to lazy"); else ok("web config defaults asset server to lazy");
if (!config.includes("shouldForceLocalAssetRuntime")) fail("web config exports shouldForceLocalAssetRuntime"); else ok("web config exports shouldForceLocalAssetRuntime");

const route = exists("src/pages/api/assets/player_mesh.glb.ts") ? read("src/pages/api/assets/player_mesh.glb.ts") : "";
if (!route.includes("X-Glitch-Player-Mesh-Mode")) fail("player mesh API emits computed-local marker"); else ok("player mesh API emits computed-local marker");
if (/redirect\s*\(/.test(route)) fail("player mesh API has no fallback redirect"); else ok("player mesh API has no fallback redirect");
if (route.includes(legacyPath)) fail("player mesh API has no legacy static body path"); else ok("player mesh API has no legacy static body path");
for (const env of legacyEnvs) {
  if (route.includes(env)) fail(`player mesh API has no legacy env ${env}`); else ok(`player mesh API has no legacy env ${env}`);
}

const playerMesh = exists("src/client/game/resources/player_mesh.ts") ? read("src/client/game/resources/player_mesh.ts") : "";
if (!playerMesh.includes("/api/assets/player_mesh.glb")) fail("client player mesh resource uses generated player mesh endpoint"); else ok("client player mesh resource uses generated player mesh endpoint");
if (playerMesh.includes(legacyPath)) fail("client player mesh resource has no static body path"); else ok("client player mesh resource has no static body path");

const npcs = exists("src/client/game/resources/npcs.ts") ? read("src/client/game/resources/npcs.ts") : "";
if (!/playerMeshUrlForId/.test(npcs)) fail("NPC resource uses generated mesh path for player-like NPCs"); else ok("NPC resource uses generated mesh path for player-like NPCs");
if (!/fallback/i.test(npcs)) fail("NPC rendering has visible fallback behavior"); else ok("NPC rendering has visible fallback behavior");

const scanned = [
  ...walk("scripts/glitch"),
  ...walk("scripts/harthmere"),
].filter((rel) => !rel.includes(".harthmere-backups"));
const offenders = [];
for (const rel of scanned) {
  const text = read(rel);
  if (text.includes(legacyPath)) offenders.push(`${rel} :: legacy static body path`);
  for (const env of legacyEnvs) {
    if (text.includes(env)) offenders.push(`${rel} :: ${env}`);
  }
}
if (offenders.length) fail("all active scripts align with generated local player mesh policy", offenders.slice(0, 40).join("\n"));
else ok("all active scripts align with generated local player mesh policy");

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
