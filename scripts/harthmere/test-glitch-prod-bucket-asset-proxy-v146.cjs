#!/usr/bin/env node
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
ok(app.includes("GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146"), "web app declares the v146 bucket asset proxy marker");
ok(app.includes("tryServeGlitchLocalBucketAssetV146"), "web app installs a /buckets asset interceptor before Next 404 handling");
ok(app.includes('resolve(publicRoot, "buckets", bucket, objectPath)'), "bucket proxy serves packaged public/buckets files first");
ok(app.includes('resolve(publicRoot, objectPath)'), "bucket proxy can serve packaged public/assets fallback paths");
ok(app.includes("https://storage.googleapis.com/biomes-static"), "bucket proxy can fall back to the public biomes-static bucket without GCS credentials");
ok(app.includes("GLITCH_DISABLE_REMOTE_BUCKET_FALLBACK"), "remote fallback can be disabled explicitly");
ok(app.includes("GLITCH_STATIC_TO_BIKKIE_BUCKET_ALIAS_V147"), "bucket proxy serves local bikkie hash assets when static URLs point at biomes-static");
ok(app.includes("X-Glitch-Bucket-Asset-Proxy"), "bucket proxy adds a diagnostic response header");
ok(app.includes("await tryServeGlitchLocalBucketAssetV146(req, res, url.pathname)"), "bucket proxy runs before app.getRequestHandler");

const nextConfig = read("next.config.js");
ok(nextConfig.includes('source: "/buckets/:bucket/:path*"'), "Next headers include bucket asset cache policy");

const dockerfile = read("Dockerfile.biomes");
ok(dockerfile.includes("GLITCH_STATIC_BUCKET_FALLBACK_BASE_URL=https://storage.googleapis.com/biomes-static"), "Dockerfile sets public biomes-static fallback base");
ok(dockerfile.includes('BIOMES_PLAYER_START_POSITION="484.24980838010384,53,-207.51197432867897"'), "Dockerfile pins the requested player start position");

const players = read("src/server/logic/utils/players.ts");
ok(players.includes("configuredGlitchPlayerStartPositionV146"), "player start supports explicit production coordinate override");
ok(players.includes("BIOMES_PLAYER_START_POSITION"), "player start reads BIOMES_PLAYER_START_POSITION");
ok(players.includes("const configuredStart = configuredGlitchPlayerStartPositionV146();"), "explicit player start is applied before random/default start selection");

if (failures.length) {
  console.error(`\n${failures.length} v146 bucket asset proxy checks failed.`);
  process.exit(1);
}
console.log("\nAll v146 bucket asset proxy checks passed.");
