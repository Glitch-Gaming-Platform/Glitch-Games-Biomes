#!/usr/bin/env node
/* eslint-disable no-console */

// HARTHMERE_LIVE_PROD_LOCAL_ASSET_PARITY_V159
//
// Optional live smoke test. Run after deploying against either localhost or the
// Azure origin. It checks that the live web server actually serves the same
// core asset classes local does and that /api/assets/player_mesh.glb is not an
// API error/proxy failure.
//
// Usage:
//   node scripts/harthmere/test-harthmere-live-prod-local-asset-parity-v159.cjs \
//     https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io

const { spawnSync } = require("child_process");

const origin = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const playerMeshQuery =
  "/api/assets/player_mesh.glb?" +
  "7=25&55=55&sc=skin_color_2&ec=eye_color_0&hc=hair_color_5";

const urls = [
  {
    name: "player mesh generated route",
    url: `${origin}${playerMeshQuery}`,
    expect: "gltf",
  },
  {
    name: "static bucket block atlas",
    url:
      `${origin}/buckets/biomes-static/asset_data/atlases/` +
      "blocks.363c333d07aa1ef9e316cd41e9dca1ee.json",
    expect: "json",
  },
  {
    name: "harthmere creature asset",
    url:
      `${origin}/assets/harthmere/gltf/creatures/animal_action_variants/` +
      "harthmere_animal_boar_brown.gltf",
    expect: "gltf",
  },
];

function curl(url, head = false) {
  const args = ["-sSL", "--max-time", "60"];
  if (head) args.push("-I");
  args.push(url);
  const result = spawnSync("curl", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

let ok = true;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`OK    ${label}`);
  } else {
    ok = false;
    console.error(`FAIL  ${label}`);
    if (detail) console.error(`      ${detail}`);
  }
}

function headerValue(headers, name) {
  const re = new RegExp(`^${name}:\\s*(.*)$`, "im");
  const match = headers.match(re);
  return match ? match[1].trim() : "";
}

for (const entry of urls) {
  console.log(`\n== ${entry.name} ==`);
  console.log(entry.url);
  const head = curl(entry.url, true);
  const headers = head.stdout;
  const statusLine = headers.split(/\r?\n/).find((line) => /^HTTP\//i.test(line)) || "";
  const contentType = headerValue(headers, "content-type").toLowerCase();
  const meshMode = headerValue(headers, "x-glitch-player-mesh-mode");

  console.log(statusLine);
  console.log(`content-type: ${contentType || "[missing]"}`);
  if (meshMode) console.log(`x-glitch-player-mesh-mode: ${meshMode}`);

  check(`${entry.name} returns HTTP 200`, /\s200\s/.test(statusLine), headers.slice(0, 500));

  if (entry.expect === "json") {
    check(`${entry.name} has JSON content type`, /json/.test(contentType));
  } else {
    check(
      `${entry.name} has glTF/GLB-compatible content type`,
      /gltf|json|octet-stream/.test(contentType),
      contentType
    );
  }

  if (entry.name.includes("player mesh")) {
    check(
      "player mesh route is computed-local, not proxy",
      meshMode === "computed-local",
      "Expected X-Glitch-Player-Mesh-Mode: computed-local. If this is missing, the deployed image probably does not contain V159 or traffic is pinned to an old revision."
    );
  }

  const body = curl(entry.url, false);
  const first = body.stdout.slice(0, 256);
  check(`${entry.name} body is non-empty`, body.stdout.length > 128, first);
  check(`${entry.name} body is not an API error JSON`, !/^\s*\{\s*"error"\s*:/.test(first), first);

  if (entry.name.includes("player mesh")) {
    if (body.stdout.startsWith("glTF")) {
      check("player mesh is binary GLB", true);
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(body.stdout);
      } catch (err) {
        // Some servers may stream binary through stdout as replacement chars;
        // the content-type/header checks above still catch the important case.
      }
      check(
        "player mesh JSON, when returned, is valid glTF with skins/nodes",
        !parsed || Boolean(parsed.asset && Array.isArray(parsed.nodes) && Array.isArray(parsed.skins)),
        parsed
          ? "Expected a rigged generated glTF containing nodes and skins. A generated local fallback-free path shell usually fails this."
          : "Body was not JSON and did not start with glTF. Inspect the downloaded file manually."
      );
    }
  }
}

if (!ok) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}

console.log("\nRESULT: PASS");
