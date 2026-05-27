#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_LIVE_PROD_LOCAL_ASSET_PARITY_V163
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const origin = (process.argv[2] || "").replace(/\/$/, "");
if (!origin) { console.error("usage: node scripts/harthmere/test-harthmere-live-prod-local-asset-parity-v163.cjs https://your-origin"); process.exit(2); }
const root = process.cwd();
let okAll = true;
function fail(label, detail) { okAll = false; console.error(`FAIL  ${label}`); if (detail) console.error(`      ${detail}`); }
function ok(label) { console.log(`OK    ${label}`); }
function request(url, depth = 0) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout: 30000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        const body = Buffer.concat(chunks);
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 4) {
          resolve(await request(new URL(res.headers.location, url).toString(), depth + 1));
          return;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body, url });
      });
    });
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
  });
}
async function checkUrl(label, rel, opts = {}) {
  const url = `${origin}${rel}`;
  try {
    const res = await request(url);
    const ct = String(res.headers["content-type"] || "").toLowerCase();
    console.log(`URL ${label}: ${res.statusCode} ${ct} bytes=${res.body.length} ${rel}`);
    if (res.statusCode !== 200) return fail(`${label} returns 200`, `status=${res.statusCode}`);
    ok(`${label} returns 200`);
    if (res.body.length < (opts.minBytes || 32)) return fail(`${label} body is non-trivial`, `bytes=${res.body.length}`);
    ok(`${label} body is non-trivial`);
    if (/text\/html/.test(ct)) return fail(`${label} is not an HTML error page`, `content-type=${ct}`);
    ok(`${label} is not an HTML error page`);
    if (opts.expectHeader) {
      const got = String(res.headers[opts.expectHeader.name.toLowerCase()] || "");
      if (got !== opts.expectHeader.value) return fail(`${label} header ${opts.expectHeader.name}`, `got ${got || "<missing>"}`);
      ok(`${label} header ${opts.expectHeader.name}=${opts.expectHeader.value}`);
    }
    if (opts.kind === "json-gltf-or-glb") {
      if (res.body.slice(0, 4).toString("utf8") === "glTF") ok(`${label} is binary GLB`);
      else {
        let parsed;
        try { parsed = JSON.parse(res.body.toString("utf8")); }
        catch (err) { return fail(`${label} is valid JSON glTF or binary GLB`, err.message); }
        if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return fail(`${label} JSON glTF contains nodes`);
        ok(`${label} JSON glTF contains nodes`);
      }
    }
  } catch (err) { fail(`${label} request failed`, err.stack || err.message); }
}
function getAssetPath(assetKey) {
  const p = path.join(root, "src/galois/js/interface/gen/asset_versions.json");
  if (!fs.existsSync(p)) return undefined;
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  return json.paths && json.paths[assetKey] ? `/buckets/biomes-static/${json.paths[assetKey]}` : undefined;
}
function playerMeshPathV180() {
  const source = fs.readFileSync(path.join(root, "src/shared/api/assets.ts"), "utf8");
  const assetExportVersion =
    (source.match(/ASSET_EXPORTS_SERVER_VERSION\s*=\s*(\d+)/) || [])[1] || "55";
  return `/api/assets/player_mesh.glb?aev=${assetExportVersion}&sc=skin_color_1&ec=eye_color_1&hc=hair_color_1`;
}
(async () => {
  await checkUrl("player mesh computed locally", playerMeshPathV180(), { minBytes: 1024, kind: "json-gltf-or-glb", expectHeader: { name: "x-glitch-player-mesh-mode", value: "computed-local" } });
  for (const [label, rel] of [["Harthmere Mage GLB", "/assets/harthmere/glb/characters/adventurers/Mage.glb"], ["Harthmere Knight GLB", "/assets/harthmere/glb/characters/adventurers/Knight.glb"], ["Harthmere animation rig", "/assets/harthmere/glb/characters/animations/Rig_Medium_General.glb"], ["Harthmere sword asset", "/assets/harthmere/glb/equipment/weapons/sword_1handed.gltf"], ["Harthmere staff asset", "/assets/harthmere/glb/equipment/magic/staff.gltf"], ["Harthmere bow asset", "/assets/harthmere/glb/equipment/ranged/bow.gltf"]]) {
    await checkUrl(label, rel, { minBytes: 64 });
  }
  for (const key of ["npcs/seedy_muckling", "npcs/brown_hexer", "npcs/purple_hexer", "item_meshes/npcs/seedy_muckling", "item_meshes/npcs/brown_hexer", "item_meshes/npcs/purple_hexer", "icons/npcs/seedy_muckling", "icons/npcs/brown_hexer", "icons/npcs/purple_hexer", "audio/npc-muckling-on-attack-1", "audio/npc-muckling-on-hit-1", "audio/npc-muckling-on-death-1"]) {
    const rel = getAssetPath(key);
    if (!rel) { fail(`asset_versions contains ${key}`, "missing locally; run source asset coverage test"); continue; }
    ok(`asset_versions contains ${key}`);
    await checkUrl(`bucket asset ${key}`, rel, { minBytes: 32 });
  }
  if (!okAll) { console.error("\nRESULT: FAIL"); process.exit(1); }
  console.log("\nRESULT: PASS");
})();
