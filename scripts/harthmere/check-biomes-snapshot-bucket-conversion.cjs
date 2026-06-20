#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

function walk(dir, out = [], options = {}) {
  const skipDirNames = options.skipDirNames || new Set();
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirNames.has(entry.name)) {
        walk(full, out, options);
      }
    } else {
      out.push(full);
    }
  }
  return out;
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const bucketsRoot = path.join(root, "public/buckets");
const harthmereRoot = path.join(root, "public/assets/harthmere");

console.log("== Biomes snapshot bucket conversion current ==");

const bucketFiles = walk(bucketsRoot).map((file) => file.slice(root.length + 1));
const harthmereFiles = walk(harthmereRoot, [], {
  skipDirNames: new Set(["_source"]),
}).map((file) => file.slice(root.length + 1));
const bucketText = bucketFiles.join("\n");
const harthmereText = harthmereFiles.join("\n");

check(bucketFiles.length >= 15000, "snapshot bucket file count is present");
check(harthmereFiles.length >= 6500, "Harthmere runtime asset file count is present");
check(
  !harthmereText.includes("public/assets/harthmere/_source/"),
  "Harthmere runtime asset check ignores local source-pack files"
);

for (const required of [
  "public/buckets/biomes-static/asset_data/indices/blocks.",
  "public/buckets/biomes-static/asset_data/indices/florae.",
  "public/buckets/biomes-static/asset_data/indices/shapes.",
  "public/buckets/biomes-static/asset_data/wearables/animations.",
  "public/buckets/biomes-static/asset_data/audio/music-1.",
  "public/buckets/biomes-static/asset_data/audio/muck-music-1.",
  "public/buckets/biomes-static/asset_data/npcs/",
  "public/buckets/biomes-static/asset_data/placeables/",
  "public/buckets/biomes-bikkie/assets/",
]) {
  check(bucketText.includes(required), `snapshot bucket includes ${required}`);
}

for (const required of [
  "public/assets/harthmere/gltf/quaternius/fantasy_props/",
  "public/assets/harthmere/gltf/characters/player_body_variants/",
  "public/assets/harthmere/gltf/creatures/",
  "public/assets/harthmere/obj/tavern/",
  "public/assets/harthmere/obj/town_sample/",
  "public/assets/harthmere/fbx/props/food/",
]) {
  check(harthmereText.includes(required), `Harthmere assets include ${required}`);
}

const extCounts = harthmereFiles.reduce((counts, file) => {
  const ext = path.extname(file).slice(1).toLowerCase() || "noext";
  counts[ext] = (counts[ext] || 0) + 1;
  return counts;
}, {});

check((extCounts.gltf || 0) >= 900, "Harthmere GLTF assets are present");
check((extCounts.glb || 0) >= 300, "Harthmere GLB assets are present");
check((extCounts.obj || 0) >= 480, "Harthmere OBJ assets are present");
check((extCounts.fbx || 0) >= 250, "Harthmere FBX assets are present");
check((extCounts.png || 0) >= 1300, "Harthmere PNG assets are present");

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
