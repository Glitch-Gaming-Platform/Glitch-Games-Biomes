#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const root = path.join(repo, "public/assets/harthmere/action_object_animations");
const manifestPath = path.join(root, "harthmere-action-object-animation-manifest.json");
const tsPath = path.join(repo, "src/shared/game/medieval/harthmereActionObjectAnimationManifest.generated.ts");

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

ok(fs.existsSync(root), "public action_object_animations directory exists");
ok(fs.existsSync(path.join(root, "animated_gltf")), "animated_gltf directory exists");
ok(fs.existsSync(manifestPath), "JSON manifest exists");
ok(fs.existsSync(tsPath), "TypeScript manifest exists");

const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const counts = data.reduce((acc, e) => {
  acc[e.group] = (acc[e.group] || 0) + 1;
  return acc;
}, {});

ok(data.length === 285, "manifest has 285 entries");
ok(counts.tools === 16, "manifest has 16 tools");
ok(counts.interactives === 68, "manifest has 68 interactives");
ok(counts.creatures === 64, "manifest has 64 creatures");
ok(counts.food === 137, "manifest has 137 food/cooking props");
ok(data.every((entry) => entry.frameCount === 24), "every manifest entry declares 24 frames");
ok(data.every((entry) => entry.fps === 24), "every manifest entry declares 24 FPS");
ok(data.every((entry) => Array.isArray(entry.animations) && entry.animations.length > 0), "every manifest entry has animation names");
ok(data.every((entry) => entry.animations.every((name) => String(name).endsWith("_24"))), "every animation name is a 24-frame clip");

const missing = [];
for (const entry of data) {
  const gltf = path.join(root, entry.outputGltf);
  if (!fs.existsSync(gltf)) {
    missing.push(`${entry.id}: ${entry.outputGltf}`);
  }
}
ok(missing.length === 0, "every manifest GLTF exists");

if (missing.length) {
  console.error(missing.slice(0, 20).join("\n"));
}

const ts = fs.readFileSync(tsPath, "utf8");
ok(ts.includes("readonly animations: readonly string[]"), "TypeScript manifest uses readonly animation arrays");
ok(ts.includes("as unknown as Record<string, HarthmereActionObjectAnimationManifestEntry>"), "TypeScript lookup cast is safe for const data");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
