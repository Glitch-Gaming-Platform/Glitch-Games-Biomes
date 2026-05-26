#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

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
ok(
  app.includes("GLITCH_STATIC_TO_BIKKIE_BUCKET_ALIAS_V147"),
  "web bucket proxy declares the static-to-bikkie alias marker"
);
ok(
  app.includes("localBucketAssetCandidatesV147"),
  "web bucket proxy builds local bucket candidate paths in one place"
);
ok(
  app.includes('resolve(publicRoot, "buckets", "biomes-bikkie", objectPath)'),
  "web bucket proxy probes packaged biomes-bikkie assets for biomes-static hash URLs"
);
ok(
  app.indexOf('resolve(publicRoot, "buckets", "biomes-bikkie", objectPath)') >
    app.indexOf('bucket === "biomes-static"') &&
    app.indexOf('resolve(publicRoot, "buckets", "biomes-bikkie", objectPath)') <
      app.indexOf("const remoteBase = remoteBucketBaseUrlV146(bucket)"),
  "web bucket proxy tries the local bikkie alias before remote fallback"
);
ok(
  app.includes("GLITCH_HASH_BUCKET_ASSET_PATH_V147") &&
    app.includes('^assets\\/[0-9a-f]{2}\\/[0-9a-f]{40}'),
  "web bucket proxy only applies the bikkie alias to content-hash asset URLs"
);
ok(
  app.includes("isSafeLocalPublicPathV147") &&
    app.includes('import { extname, relative, resolve } from "path";'),
  "web bucket proxy keeps local candidate paths constrained to public/"
);

const indexer = read("scripts/harthmere/index-local-static-bucket-assets-v1.cjs");
ok(
  indexer.includes("createBikkieHashAlias") &&
    indexer.includes("The file is already named by the Bikkie binary hash"),
  "local bucket indexer aliases exact bikkie hash filenames into biomes-static"
);
ok(
  indexer.includes("createAliasLink(path.join(ASSETS_HASH_DIR, relPath), filePath)"),
  "local bucket indexer creates a static assets alias at the exact bikkie relative path"
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "biomes-bucket-v147-"));
try {
  const targetHash = "434d37a2421c5db28336ec91fb7d4bf4ae7a7831";
  const assetDataDir = path.join(tmp, "public", "buckets", "biomes-static", "asset_data", "fixture");
  const bikkieDir = path.join(tmp, "public", "buckets", "biomes-bikkie", "assets", "43");
  fs.mkdirSync(assetDataDir, { recursive: true });
  fs.mkdirSync(bikkieDir, { recursive: true });
  fs.writeFileSync(path.join(assetDataDir, "named.bin"), "static named fixture");
  fs.writeFileSync(path.join(bikkieDir, targetHash), "bikkie hash fixture");

  execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/index-local-static-bucket-assets-v1.cjs"), tmp],
    { stdio: "pipe" }
  );

  const aliasPath = path.join(
    tmp,
    "public",
    "buckets",
    "biomes-static",
    "assets",
    "43",
    targetHash
  );
  ok(fs.existsSync(aliasPath), "indexer creates exact biomes-static alias for a bikkie hash asset");
  ok(
    fs.readFileSync(aliasPath, "utf8") === "bikkie hash fixture",
    "exact biomes-static alias resolves to the bikkie asset contents"
  );
} catch (error) {
  failures.push(`fixture indexer check threw: ${error.message}`);
  console.error(error.stack || error.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} v147 static-to-bikkie bucket alias checks failed.`);
  process.exit(1);
}

console.log("\nAll v147 static-to-bikkie bucket alias checks passed.");
