#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_LIVE_PROD_LOCAL_ASSET_PARITY_V160
// Live smoke test for the deployed Container App. The key proof is the response
// header X-Glitch-Player-Mesh-Mode: computed-local. JSON glTF and binary GLB
// are both acceptable; proxy/generated local fallback-free path is not.

const http = require("http");
const https = require("https");

const origin = (process.argv[2] || "").replace(/\/$/, "");
if (!origin) {
  console.error("usage: node scripts/harthmere/test-harthmere-live-prod-local-asset-parity-v160.cjs https://your-origin");
  process.exit(2);
}

const testUrl = `${origin}/api/assets/player_mesh.glb?wearables=&skin_color_id=1&eye_color_id=1&hair_color_id=1`;
const client = testUrl.startsWith("https:") ? https : http;

function request(url, depth = 0) {
  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout: 30000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", async () => {
        const body = Buffer.concat(chunks);
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 4) {
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(await request(nextUrl, depth + 1));
          return;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body, url });
      });
    });
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
  });
}

function fail(label, detail) {
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
  process.exit(1);
}
function ok(label) {
  console.log(`OK    ${label}`);
}

(async () => {
  const res = await request(testUrl);
  console.log("URL:", res.url);
  console.log("status:", res.statusCode);
  console.log("content-type:", res.headers["content-type"] || "");
  console.log("x-glitch-player-mesh-mode:", res.headers["x-glitch-player-mesh-mode"] || "");
  console.log("x-glitch-player-mesh-content-type:", res.headers["x-glitch-player-mesh-content-type"] || "");
  console.log("bytes:", res.body.length);
  console.log("first16:", JSON.stringify(res.body.slice(0, 16).toString("utf8")));

  if (res.statusCode !== 200) fail("player mesh route returns 200", `status=${res.statusCode}`);
  ok("player mesh route returns 200");

  const mode = String(res.headers["x-glitch-player-mesh-mode"] || "");
  if (mode !== "computed-local") {
    fail(
      "player mesh route used computed-local mode",
      `got ${mode || "<missing>"}. This usually means the old image/revision is still serving traffic or proxy/generated local fallback-free path is still active.`
    );
  }
  ok("player mesh route used computed-local mode");

  const contentType = String(res.headers["content-type"] || "").toLowerCase();
  if (!/model\/gltf|application\/octet-stream/.test(contentType)) {
    fail("player mesh route returns glTF/GLB content", `content-type=${contentType}`);
  }
  ok("player mesh route returns glTF/GLB content");

  if (res.body.length < 1024) fail("player mesh body is non-trivial", `bytes=${res.body.length}`);
  ok("player mesh body is non-trivial");

  if (res.body.slice(0, 4).toString("utf8") === "glTF") {
    ok("player mesh is binary GLB");
  } else {
    let parsed;
    try {
      parsed = JSON.parse(res.body.toString("utf8"));
    } catch (err) {
      fail("player mesh is valid JSON glTF or binary GLB", err.message);
    }
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const skins = Array.isArray(parsed.skins) ? parsed.skins : [];
    if (nodes.length === 0) fail("JSON glTF contains nodes", "nodes array is empty/missing");
    ok("JSON glTF contains nodes");
    if (skins.length === 0) {
      console.warn("WARN  JSON glTF has no skins; route is computed-local, but animation may still be limited.");
    } else {
      ok("JSON glTF contains skins");
    }
  }

  console.log("\nRESULT: PASS");
})().catch((err) => fail("live request failed", err.stack || err.message));
