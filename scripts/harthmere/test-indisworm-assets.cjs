#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const npcRoot = path.join(root, "src/galois/data/npcs");
const glbPath = path.join(npcRoot, "indisworm.glb");
const previewPath = path.join(
  root,
  "artifacts/harthmere-indisworm/indisworm_ranged_attack.png"
);

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF");
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const jsonLength = data.readUInt32LE(12);
  return JSON.parse(
    data
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\u0000/g, "")
  );
}

for (const file of [
  "indisworm.blend",
  "indisworm.glb",
  "indisworm.gltf",
  "indisworm_source.gltf",
  "indisworm.bin",
  "indisworm_mesh.vox",
]) {
  assert.ok(fs.statSync(path.join(npcRoot, file)).size > 1000, file);
}
assert.ok(fs.statSync(glbPath).size > 100000, "animated creature GLB");
assert.ok(fs.statSync(previewPath).size > 25000, "Blender preview");

const gltf = parseGlb(glbPath);
const requiredClips = [
  "Idle",
  "Walk",
  "Run",
  "Attack",
  "RangedAttack",
  "HitReact",
  "Death",
];
const clips = new Set((gltf.animations ?? []).map(({ name }) => name));
for (const clip of requiredClips) {
  assert.ok(clips.has(clip), `missing ${clip}`);
}
assert.ok(gltf.meshes?.length > 0, "mesh");
assert.ok(gltf.skins?.length > 0, "skin");
assert.ok(gltf.materials?.length >= 8, "layered cave materials");
assert.ok(
  gltf.nodes?.some(({ name }) => name === "Socket_Mouth"),
  "mouth projectile socket"
);

const assetVersions = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/galois/js/interface/gen/asset_versions.json"),
    "utf8"
  )
);
assert.ok(assetVersions.paths["npcs/indisworm"], "Galois NPC asset URL");
assert.ok(assetVersions.paths["icons/npcs/indisworm"], "Galois icon URL");
assert.ok(
  assetVersions.paths["item_meshes/npcs/indisworm"],
  "Galois item mesh URL"
);

console.log(
  `Validated Indisworm Blender source, ${requiredClips.length} animation clips, mouth socket, VOX source, and Galois outputs.`
);
