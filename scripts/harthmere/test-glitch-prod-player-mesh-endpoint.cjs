#!/usr/bin/env node
const http = require("http");
const https = require("https");

const base = (process.argv[2] || process.env.GLITCH_TEST_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/harthmere/test-glitch-prod-player-mesh-endpoint.cjs <base-url>");
  console.error("   or: GLITCH_TEST_BASE_URL=http://127.0.0.1:3017 node ...");
  process.exit(2);
}

const realMeshPath =
  process.env.GLITCH_TEST_PLAYER_MESH_PATH ||
  "/api/assets/player_mesh.glb?7539420629350465=7539420629350456%2Cblue&4537020877770126=7539420629350447%2Cred&4537020877770048=1534621126189718&aev=55&sc=skin_color_2&ec=eye_color_0&hc=hair_color_8";

const url = new URL(realMeshPath, base + "/");
const client = url.protocol === "https:" ? https : http;

function request(url) {
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        timeout: Number(process.env.GLITCH_TEST_PLAYER_MESH_TIMEOUT_MS || 120000),
        headers: {
          Accept: "model/gltf-binary,model/gltf+json,application/json,*/*",
          "User-Agent": "glitch-prod-player-mesh-endpoint",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  console.log(`Checking generated player mesh endpoint: ${url}`);
  const { res, body } = await request(url);
  const headers = res.headers;
  const status = res.statusCode;
  const contentType = String(headers["content-type"] || "");
  const mode = String(headers["x-glitch-player-mesh-mode"] || "");
  const bodyPreview = body.subarray(0, 300).toString("utf8");

  console.log(`status=${status}`);
  console.log(`content-type=${contentType || "?"}`);
  console.log(`x-glitch-player-mesh-mode=${mode || "?"}`);
  console.log(`bytes=${body.length}`);
  console.log(`preview=${JSON.stringify(bodyPreview)}`);

  const failures = [];
  if (status !== 200) failures.push(`expected HTTP 200, got ${status}`);
  if (body.length < 1000) failures.push(`expected mesh body > 1000 bytes, got ${body.length}`);
  if (/internal_server_error|invalid_request|error/i.test(bodyPreview)) {
    failures.push("body looks like an API error, not a mesh");
  }
  if (mode && !/computed-local|generated|local/i.test(mode)) {
    failures.push(`unexpected X-Glitch-Player-Mesh-Mode: ${mode}`);
  }
  if (contentType && /application\/json/i.test(contentType) && !/"asset"\s*:/.test(bodyPreview)) {
    failures.push(`JSON response did not look like glTF asset JSON: ${contentType}`);
  }
  const startsLikeGlb = body.subarray(0, 4).toString("utf8") === "glTF";
  const startsLikeGltfJson = /^\s*\{\s*"asset"\s*:/.test(bodyPreview);
  if (!startsLikeGlb && !startsLikeGltfJson) {
    failures.push("body does not start like GLB magic or glTF JSON asset");
  }

  if (failures.length) {
    console.error("\nRESULT: FAIL");
    for (const f of failures) console.error(`FAIL ${f}`);
    process.exit(1);
  }

  console.log("\nRESULT: PASS");
})().catch((error) => {
  console.error("\nRESULT: FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
