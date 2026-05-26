#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

const app = read("src/server/web/app.ts");
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke-v1.sh");

ok(
  app.includes("GLITCH_IFRAME_BUCKET_ASSET_HEADERS_V151") &&
    app.includes("setBucketAssetCorsHeadersV151"),
  "bucket proxy declares iframe/XHR asset header hardening"
);
ok(
  app.includes('Access-Control-Allow-Origin') &&
    app.includes('Cross-Origin-Resource-Policy') &&
    app.includes('Timing-Allow-Origin'),
  "bucket proxy sets CORS/CORP/timing headers for embedded runtime asset fetches"
);
ok(
  app.includes('req.method === "OPTIONS"') &&
    app.includes('GET, HEAD, OPTIONS'),
  "bucket proxy supports OPTIONS preflight and advertises GET/HEAD/OPTIONS"
);
ok(
  app.includes("contentTypeForLocalBucketAssetV151") &&
    app.includes('bytes.subarray(0, 4).toString("utf8") === "glTF"') &&
    app.includes('return "model/gltf-binary"'),
  "bucket proxy sniffs extensionless GLB hashes as model/gltf-binary"
);
ok(
  app.includes("localBucketAssetCandidatesV151") &&
    app.includes("GLITCH_BUCKET_EXTENSIONLESS_VARIANTS_V151") &&
    app.includes("entry.startsWith(`${hashName}.`)"),
  "bucket proxy checks exact bikkie hash and extension variants before remote fallback"
);
ok(
  app.includes('X-Glitch-Bucket-Asset-Revision') &&
    app.includes('X-Glitch-Bucket-Asset-Path') &&
    app.includes('source=${candidate.source}'),
  "bucket proxy emits diagnostic headers showing revision, source, and asset path"
);
ok(
  deploy.includes("wait_for_azure_revision_ready_v151") &&
    deploy.includes("latestReadyRevisionName") &&
    deploy.includes("latestRevisionName"),
  "deploy script waits until the new Azure revision is actually ready"
);
ok(
  deploy.includes("force_azure_traffic_to_revision_v151") &&
    deploy.includes("az containerapp ingress traffic set") &&
    deploy.includes("revision deactivate"),
  "deploy script pins traffic to the concrete ready revision and deactivates stale revisions"
);
ok(
  deploy.includes("validate_production_bucket_assets_v151") &&
    deploy.includes("Origin: https://www.glitch.fun") &&
    deploy.includes("69e51f48fd43cdef37609a2b2cf880e7570e35aa") &&
    deploy.includes("source=local"),
  "deploy script validates known failing bikkie assets with iframe-like request headers"
);

if (failures.length) {
  console.error(`\n${failures.length} v151 bucket asset hardening check(s) failed.`);
  process.exit(1);
}

console.log("\nAll v151 iframe bucket asset hardening checks passed.");
