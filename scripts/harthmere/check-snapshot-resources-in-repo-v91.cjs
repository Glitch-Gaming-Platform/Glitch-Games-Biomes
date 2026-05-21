#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = path.resolve(process.argv[2] || ".");
const assetRoot = path.join(root, "public/assets/harthmere");
const manifestPath = path.join(assetRoot, "manifest/snapshot-resources-v91.json");

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__MACOSX") fail("__MACOSX directory should not be vendored");
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync(assetRoot)) fail("public/assets/harthmere is missing");
if (!fs.existsSync(manifestPath)) fail("snapshot resource manifest is missing");

const files = walk(assetRoot);
if (files.length < 100) fail(`too few vendored files found: ${files.length}`);

const bad = files.filter((f) => /\.(zip|log|sqlite|rdb)$/i.test(f));
if (bad.length) fail(`archive/log/db files should not be vendored:\n${bad.slice(0, 20).join("\n")}`);

const binaryExts = new Set([
  ".bin", ".glb", ".gltf", ".fbx", ".obj", ".vox",
  ".png", ".jpg", ".jpeg", ".webp",
  ".mp3", ".wav", ".ogg", ".mp4"
]);

const notLfs = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const ext = path.extname(file).toLowerCase();
  if (!binaryExts.has(ext)) continue;

  const result = cp.spawnSync("git", ["check-attr", "filter", "--", rel], {
    cwd: root,
    encoding: "utf8",
  });

  if (!result.stdout.includes("filter: lfs")) {
    notLfs.push(rel);
  }
}

if (notLfs.length) {
  fail(`binary assets not tracked by LFS:\n${notLfs.slice(0, 50).join("\n")}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.fileCount || manifest.fileCount < 100) {
  fail("manifest fileCount looks wrong");
}

console.log(`OK snapshot resources are vendored: ${files.length} files`);
console.log("OK binary Harthmere assets are tracked by Git LFS");
console.log("OK no zip/log/db junk is inside public/assets/harthmere");
