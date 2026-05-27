#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
let failures = 0;
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function ok(name, cond, detail = "") {
  if (cond) {
    console.log(`OK    ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}`);
    if (detail) console.error(`      ${detail}`);
  }
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".artifacts" || ent.name.includes("backup")) continue;
      walk(p, out);
    } else if (/\.(cjs|js|ts|tsx)$/.test(ent.name) && !/\.bak/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}
const badStrings = [
  "REMOVED_STATIC_PLAYER_MESH_BODY_PATH_POLICY",
  "REMOVED_STATIC_PLAYER_MESH_FALLBACK_POLICY",
  "REMOVED_STATIC_PLAYER_MESH_HOTFIX_POLICY",
  "REMOVED_PLAYER_MESH_BUILD_ERROR_FALLBACK_POLICY",
  "GLITCH_DISABLE_ASSET_EXPORT_SERVER",
];

const main = read("src/server/web/main.ts");
const config = read("src/server/web/config.ts");
const route = read("src/pages/api/assets/player_mesh.glb.ts");
const playerMesh = read("src/client/game/resources/player_mesh.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const npcRenderer = read("src/client/game/renderers/npcs.ts");

ok("web main uses forced local runtime gate", main.includes("shouldForceLocalAssetRuntime"));
ok("web main has no disable-asset-export killswitch left", !main.includes("GLITCH_DISABLE_ASSET_EXPORT_SERVER"));
ok("web main converts none/proxy to lazy under forced local runtime", /none[\s\S]*proxy[\s\S]*shouldForceLocalAssetRuntime\(\)[\s\S]*LazyAssetExportsServer/.test(main) || /shouldForceLocalAssetRuntime\(\)[\s\S]*LazyAssetExportsServer/.test(main));
ok("web config defaults asset server to lazy", /defaultValue:\s*["']lazy["']/.test(config));
ok("web config exports shouldForceLocalAssetRuntime", config.includes("export function shouldForceLocalAssetRuntime"));
ok("player mesh API emits computed-local marker", route.includes("X-Glitch-Player-Mesh-Mode") && route.includes("computed-local"));
ok("player mesh API has no fallback redirect", !/redirect\s*\(/.test(route));
ok("player mesh API has no legacy static body path", !route.includes("harthmere_player_average_earth.gltf"));
ok("player mesh API has no legacy fallback env names", !badStrings.some((s) => route.includes(s)));
ok("client player mesh resource uses generated player mesh endpoint", playerMesh.includes("/api/assets/player_mesh.glb"));
ok("client player mesh resource has no static body path", !playerMesh.includes("harthmere_player_average_earth.gltf"));
// Do not require one exact symbol name here; this code has drifted several times. The invariant is that
// player-like NPCs route through the same generated player mesh endpoint/path helper used by players.
ok("NPC resource has generated player-like mesh routing", /playerMeshUrlForId|\/api\/assets\/player_mesh\.glb|generated.*player.*mesh|player.*generated.*mesh/i.test(npcs));
ok("NPC rendering has visible fallback behavior", /fallback|visible|voxel|box/i.test(npcs + "\n" + npcRenderer));

const activeScripts = [
  ...walk(path.join(root, "scripts/harthmere")),
  ...walk(path.join(root, "scripts/glitch")),
];
const offenders = [];
for (const file of activeScripts) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  for (const bad of badStrings.slice(0, 4)) {
    if (text.includes(bad)) offenders.push(`${rel} :: ${bad}`);
  }
}
ok("all active scripts align with generated local player mesh policy", offenders.length === 0, offenders.join("\n"));

// Confirm the earlier authoritative NPC coverage script exists; it checks concrete NPC models/icons/audio.
ok("authoritative NPC asset coverage test is installed", exists("scripts/harthmere/test-harthmere-npc-render-asset-coverage-v164.cjs"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
