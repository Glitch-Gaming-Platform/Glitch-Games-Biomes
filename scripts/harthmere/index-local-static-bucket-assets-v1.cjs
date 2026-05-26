#!/usr/bin/env node
/**
 * index-local-static-bucket-assets-v1.cjs
 *
 * HARTHMERE_PROD_ASSET_LOCAL_INDEX_V1
 *
 * Walks every file under public/buckets/biomes-static/asset_data/ (the
 * named-format local asset bundle) and creates matching content-addressed
 * symlinks under public/buckets/biomes-static/assets/<sha1prefix>/<sha1hash>
 * (and <sha1hash>.<ext>) so the /buckets/biomes-static/ proxy can serve them
 * without ever contacting GCS or static.biomes.gg.
 *
 * Why this is needed:
 *   In production the Next.js bundle is built with NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1
 *   baked in.  That causes staticUrlForAttribute() to generate proxy URLs of
 *   the form /buckets/biomes-static/assets/<sha1prefix>/<sha1hash>.  The server-
 *   side tryServeGlitchLocalBucketAssetV146 handler checks:
 *     public/buckets/biomes-static/assets/<sha1prefix>/<sha1hash>
 *   Those paths don't exist by default — only the human-readable
 *   asset_data/<category>/<name>.<MD5>.<ext> files are in the repo.
 *   This script bridges the gap by computing the SHA1 of every asset_data file
 *   and creating relative symlinks at the expected hash-addressed paths.
 *
 * Usage (run before `next build` or Docker image preparation):
 *   node scripts/harthmere/index-local-static-bucket-assets-v1.cjs [repo-root]
 *
 * The script is idempotent: existing valid symlinks are left in place; stale
 * broken symlinks are removed and recreated.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.argv[2] || process.cwd();
const BUCKET_DIR = path.join(root, "public", "buckets", "biomes-static");
const ASSET_DATA_DIR = path.join(BUCKET_DIR, "asset_data");
const ASSETS_HASH_DIR = path.join(BUCKET_DIR, "assets");

let created = 0;
let skipped = 0;
let removed = 0;
let errors = 0;

function sha1OfFile(filePath) {
  const h = crypto.createHash("sha1");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createHashLink(targetFile, sha1, ext) {
  const prefix = sha1.slice(0, 2);
  const prefixDir = path.join(ASSETS_HASH_DIR, prefix);
  ensureDir(prefixDir);

  const linkNames = [sha1];
  if (ext) linkNames.push(`${sha1}.${ext}`);

  for (const linkName of linkNames) {
    const linkPath = path.join(prefixDir, linkName);
    // Relative path from the symlink to the target
    const relTarget = path.relative(prefixDir, targetFile);

    // If already a valid symlink to the correct target, skip
    try {
      const existing = fs.readlinkSync(linkPath);
      if (existing === relTarget) {
        skipped++;
        continue;
      }
      // Stale/wrong symlink — remove it
      fs.unlinkSync(linkPath);
      removed++;
    } catch {
      // Not a symlink or doesn't exist — proceed
    }

    try {
      fs.symlinkSync(relTarget, linkPath);
      created++;
    } catch (err) {
      if (err.code === "EEXIST") {
        // A real file (not a symlink) is already at this path — that means
        // the actual content-addressed asset was already placed here by a
        // prior step.  Leave it in place: the file IS the content.
        skipped++;
      } else {
        console.error(`  ERR  ${linkPath}: ${err.message}`);
        errors++;
      }
    }
  }
}

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!fs.existsSync(ASSET_DATA_DIR)) {
  console.error(`ERROR: asset_data directory not found: ${ASSET_DATA_DIR}`);
  console.error("Run from the repo root or pass it as the first argument.");
  process.exit(1);
}

ensureDir(ASSETS_HASH_DIR);

console.log("HARTHMERE_PROD_ASSET_LOCAL_INDEX_V1");
console.log(`Indexing: ${ASSET_DATA_DIR}`);
console.log(`Output:   ${ASSETS_HASH_DIR}`);
console.log("");

walkDir(ASSET_DATA_DIR, (filePath) => {
  try {
    const sha1 = sha1OfFile(filePath);
    const ext = path.extname(filePath).replace(/^\./, ""); // e.g. "glb", "gltf"
    createHashLink(filePath, sha1, ext || undefined);
  } catch (err) {
    console.error(`  ERR  ${filePath}: ${err.message}`);
    errors++;
  }
});

// Also walk biomes-bikkie assets (binary attributes that bikkie items reference
// are stored here — they are already in hash-addressed form in biomes-bikkie,
// so this ensures any cross-bucket references are covered too).
const BIKKIE_ASSETS_DIR = path.join(
  root,
  "public",
  "buckets",
  "biomes-bikkie",
  "assets"
);
if (fs.existsSync(BIKKIE_ASSETS_DIR)) {
  console.log(`Also indexing biomes-bikkie assets: ${BIKKIE_ASSETS_DIR}`);
  walkDir(BIKKIE_ASSETS_DIR, (filePath) => {
    // biomes-bikkie assets are already hash-addressed; compute their SHA1
    // and create matching symlinks in biomes-static/assets/ for any item
    // that the biomes-static proxy might be asked to serve.
    try {
      const sha1 = sha1OfFile(filePath);
      const ext = path.extname(filePath).replace(/^\./, "");
      createHashLink(filePath, sha1, ext || undefined);
    } catch (err) {
      // Silently skip unreadable entries (e.g. large binary bikkie bundles)
    }
  });
}

console.log("");
console.log(`Done.`);
console.log(`  Created:  ${created}`);
console.log(`  Skipped:  ${skipped} (already up to date)`);
console.log(`  Removed:  ${removed} (stale symlinks replaced)`);
console.log(`  Errors:   ${errors}`);
console.log("");

if (errors > 0) {
  console.error(`${errors} error(s) occurred — check output above.`);
  process.exit(1);
}

const total = created + skipped;
if (total === 0) {
  console.warn("WARNING: no asset files were indexed — asset_data/ may be empty.");
} else {
  console.log(
    `${total} hash-addressed symlinks available under public/buckets/biomes-static/assets/`
  );
}
