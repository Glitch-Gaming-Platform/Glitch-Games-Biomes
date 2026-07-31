#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const glbRoot = path.join(
  root,
  "public/assets/harthmere/glb/boss_attack_shapes"
);
const previewRoot = path.join(
  root,
  "public/assets/harthmere/boss_attack_shape_previews"
);
const expectedShapes = ["beam", "cone", "ground_aoe", "self_aoe"];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  assert.equal(data.readUInt32LE(4), 2, `${filePath} version`);
  assert.equal(data.readUInt32LE(8), data.length, `${filePath} byte length`);
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.toString("ascii", 16, 20), "JSON", `${filePath} JSON`);
  return JSON.parse(
    data
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\u0000/g, "")
  );
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(glbRoot, "manifest.json"), "utf8")
);
assert.equal(manifest.version, "harthmere-boss-attack-shapes-v1");
assert.equal(manifest.count, expectedShapes.length);
assert.deepEqual(
  manifest.shapes.map(({ shape }) => shape).sort(),
  [...expectedShapes].sort()
);

for (const shape of manifest.shapes) {
  const glbPath = path.join(glbRoot, `${shape.shape}.glb`);
  const previewPath = path.join(previewRoot, `${shape.shape}.png`);
  assert.ok(fs.statSync(glbPath).size >= 8000, `${shape.shape} GLB`);
  assert.ok(fs.statSync(previewPath).size >= 5000, `${shape.shape} preview`);
  assert.ok(shape.triangleCount >= 180, `${shape.shape} layered geometry`);
  assert.ok(shape.triangleCount <= 6000, `${shape.shape} game budget`);
  assert.equal(shape.animationClip, "PulseLoop_24");
  const gltf = parseGlb(glbPath);
  assert.ok(gltf.meshes?.length >= 3, `${shape.shape} layered meshes`);
  assert.ok(gltf.materials?.length >= 3, `${shape.shape} layered materials`);
  assert.ok(
    gltf.animations?.some(({ name }) => name === "PulseLoop_24"),
    `${shape.shape} exact pulse animation`
  );
}

assert.ok(
  fs.statSync(
    path.join(
      root,
      "src/galois/data/projectiles/harthmere_boss_attack_shapes.blend"
    )
  ).size >= 100000,
  "Blender source is saved"
);

const shapeManifestSource = read(
  "src/shared/harthmere/boss_attack_shape_visuals.ts"
);
const runtimeSource = read(
  "src/client/game/renderers/local_dev/harthmere_projectiles.ts"
);
for (const shape of expectedShapes) {
  assert.ok(shapeManifestSource.includes(`shape: "${shape}"`));
}
assert.match(runtimeSource, /getHarthmereBossAttackShapeVisual/);
assert.match(runtimeSource, /shapeDefinition\.animationClip/);

console.log(
  `Validated ${expectedShapes.length} Blender-authored boss attack-shape GLBs, previews, pulse animations, and runtime registry wiring.`
);
