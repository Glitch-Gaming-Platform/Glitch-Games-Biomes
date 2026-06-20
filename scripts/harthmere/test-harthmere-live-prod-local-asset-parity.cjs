#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_LIVE_PROD_LOCAL_ASSET_PARITY
// Post-deploy smoke test. Proves the live Container App is serving the new code
// and that the critical player/NPC asset families are reachable through the
// same local bucket paths the browser uses.
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const origin = (process.argv[2] || "").replace(/\/$/, "");
if (!origin) {
  console.error("usage: node scripts/harthmere/test-harthmere-live-prod-local-asset-parity.cjs https://your-origin");
  process.exit(2);
}
const root = path.resolve(process.argv[3] || process.cwd());
const assetVersionsPath = path.join(root, "src/galois/js/interface/gen/asset_versions.json");
const paths = JSON.parse(fs.readFileSync(assetVersionsPath, "utf8")).paths || {};

let failures = 0;
function fail(label, detail = "") {
  failures += 1;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
}
function ok(label) { console.log(`OK    ${label}`); }
function request(url, depth = 0) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, {
      timeout: 45000,
      headers: {
        "User-Agent": "harthmere-live-prod-local-asset-parity",
        "Origin": "https://www.glitch.fun",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        const body = Buffer.concat(chunks);
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 5) {
          const nextUrl = new URL(res.headers.location, url).toString();
          try { resolve(await request(nextUrl, depth + 1)); } catch (error) { reject(error); }
          return;
        }
        resolve({ url, statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`request timed out: ${url}`)));
    req.on("error", reject);
  });
}
async function checkUrl(label, url, options = {}) {
  let res;
  try {
    res = await request(url);
  } catch (error) {
    fail(`${label} request succeeds`, error.message);
    return undefined;
  }
  const contentType = String(res.headers["content-type"] || "").toLowerCase();
  console.log(`URL   ${label}: ${res.statusCode} ${contentType} ${res.body.length}b ${url}`);
  if (res.statusCode !== 200) {
    fail(`${label} returns 200`, `status=${res.statusCode}; first120=${JSON.stringify(res.body.slice(0, 120).toString("utf8"))}`);
    return res;
  }
  ok(`${label} returns 200`);
  if (res.body.length < (options.minBytes || 64)) {
    fail(`${label} has non-trivial body`, `bytes=${res.body.length}`);
  } else {
    ok(`${label} has non-trivial body`);
  }
  if (/text\/html/.test(contentType) || /^\s*</.test(res.body.slice(0, 64).toString("utf8"))) {
    fail(`${label} is not an HTML error page`, `content-type=${contentType}`);
  } else {
    ok(`${label} is not an HTML error page`);
  }
  if (options.contentType && !options.contentType.test(contentType)) {
    fail(`${label} content-type matches`, `content-type=${contentType}`);
  } else if (options.contentType) {
    ok(`${label} content-type matches`);
  }
  return res;
}
function bucketUrl(assetKey) {
  const rel = paths[assetKey];
  if (!rel) throw new Error(`missing asset_versions key ${assetKey}`);
  return `${origin}/buckets/biomes-static/${rel}`;
}

(async () => {
  const assetsApiSource = fs.readFileSync(
    path.join(root, "src/shared/api/assets.ts"),
    "utf8"
  );
  const assetExportVersion =
    (assetsApiSource.match(/ASSET_EXPORTS_SERVER_VERSION\s*=\s*(\d+)/) || [])[1] || "55";
  const meshUrl =
    `${origin}/api/assets/player_mesh.glb?aev=${assetExportVersion}` +
    `&sc=skin_color_1&ec=eye_color_1&hc=hair_color_1`;
  const mesh = await checkUrl("computed player mesh", meshUrl, {
    minBytes: 1024,
    contentType: /model\/gltf|application\/octet-stream|application\/json/,
  });
  if (mesh) {
    const mode = String(mesh.headers["x-glitch-player-mesh-mode"] || "");
    const assetVersion = String(mesh.headers["x-glitch-player-mesh-asset-version"] || "");
    console.log("x-glitch-player-mesh-mode:", mode || "<missing>");
    console.log("x-glitch-player-mesh-asset-version:", assetVersion || "<missing>");
    if (mode !== "computed-local") {
      fail("player mesh route used computed-local mode", `got ${mode || "<missing>"}. Usually means old image/revision or fallback/proxy code is still live.`);
    } else {
      ok("player mesh route used computed-local mode");
    }
    if (!assetVersion) fail("player mesh route emits asset-version header");
    else ok("player mesh route emits asset-version header");
    if (mesh.body.slice(0, 4).toString("utf8") === "glTF") {
      ok("player mesh is binary GLB");
    } else {
      try {
        const parsed = JSON.parse(mesh.body.toString("utf8"));
        if (Array.isArray(parsed.nodes) && parsed.nodes.length) ok("JSON player mesh has nodes");
        else fail("JSON player mesh has nodes");
        if (Array.isArray(parsed.skins) && parsed.skins.length) ok("JSON player mesh has skins");
        else console.warn("WARN  JSON player mesh has no skins; computed-local route is live, but animation rig may still need inspection.");
      } catch (error) {
        fail("player mesh is valid JSON glTF or binary GLB", error.message);
      }
    }
  }

  const criticalAssets = [
    ["wearable animations", "wearables/animations", /model\/gltf|application\/octet-stream/],
    ["cobble mucker model", "npcs/cobble_mucker", /model\/gltf|application\/json|application\/octet-stream/],
    ["stone mucker model", "npcs/stone_mucker", /model\/gltf|application\/json|application\/octet-stream/],
    ["seedy muckling model", "npcs/seedy_muckling", /model\/gltf|application\/json|application\/octet-stream/],
    ["brown hexer model", "npcs/brown_hexer", /model\/gltf|application\/json|application\/octet-stream/],
    ["purple hexer model", "npcs/purple_hexer", /model\/gltf|application\/json|application\/octet-stream/],
    ["cobble mucker icon", "icons/npcs/cobble_mucker", /image\/png/],
    ["brown hexer icon", "icons/npcs/brown_hexer", /image\/png/],
    ["cobble mucker item mesh", "item_meshes/npcs/cobble_mucker", /application\/json|text\/plain/],
    ["brown hexer item mesh", "item_meshes/npcs/brown_hexer", /application\/json|text\/plain/],
    ["muckling attack audio", "audio/npc-muckling-on-attack-1", /audio\/|application\/octet-stream/],
    ["mucker hit audio", "audio/npc-mucker-on-hit-1", /audio\/|application\/octet-stream/],
    ["jackie snapshot NPC model", "npcs/jackie", /model\/gltf|application\/json|application\/octet-stream/],
    ["ranger jane snapshot NPC model", "npcs/ranger_jane", /model\/gltf|application\/json|application\/octet-stream/],
  ];
  for (const [label, key, contentType] of criticalAssets) {
    await checkUrl(label, bucketUrl(key), { minBytes: 32, contentType });
  }

  await checkUrl("Harthmere selected asset manifest", `${origin}/assets/harthmere/manifest/harthmere-selected-assets.json`, { minBytes: 32, contentType: /application\/json|text\/plain/ });

  if (failures) {
    console.error(`\nRESULT: FAIL (${failures} failure(s))`);
    process.exit(1);
  }
  console.log("\nRESULT: PASS");
})().catch((error) => {
  fail("live smoke test crashed", error.stack || error.message);
  console.error(`\nRESULT: FAIL (${failures} failure(s))`);
  process.exit(1);
});
