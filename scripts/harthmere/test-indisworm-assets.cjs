#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const npcRoot = path.join(root, "src/galois/data/npcs");
const glbPath = path.join(npcRoot, "indisworm.glb");
const runtimeGlbPath = path.join(
  root,
  "public/assets/harthmere/glb/creatures/indisworm.glb"
);
const previewPath = path.join(
  root,
  "artifacts/harthmere-indisworm/indisworm_ranged_attack.png"
);
const reportPath = path.join(
  root,
  "artifacts/harthmere-indisworm/asset-report.json"
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
assert.deepEqual(
  fs.readFileSync(runtimeGlbPath),
  fs.readFileSync(glbPath),
  "tracked Harthmere runtime GLB must match the polished Blender export"
);
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
const minimumClipDurations = {
  Idle: 4,
  Walk: 2,
  Run: 4 / 3,
  Attack: 2,
  RangedAttack: 2.5,
  HitReact: 1.25,
  Death: 59 / 24,
};
for (const animation of gltf.animations ?? []) {
  if (!(animation.name in minimumClipDurations)) {
    continue;
  }
  const duration = Math.max(
    ...animation.samplers.map(
      ({ input }) => gltf.accessors[input].max?.[0] ?? 0
    )
  );
  assert.ok(
    duration >= minimumClipDurations[animation.name] - 0.02,
    `${animation.name} recovery range was trimmed (${duration.toFixed(3)}s)`
  );
}
assert.ok(gltf.meshes?.length > 0, "mesh");
assert.ok(gltf.skins?.length > 0, "skin");
assert.ok(gltf.materials?.length >= 8, "layered cave materials");
assert.ok(
  gltf.nodes?.some(({ name }) => name === "Socket_Mouth"),
  "mouth projectile socket"
);

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(
  report.animationPolishVersion,
  "harthmere-indisworm-animation-polish-v1"
);
assert.deepEqual(report.impactFrames, {
  Attack: 23,
  RangedAttack: 29,
  HitReact: 5,
  Death: 43,
});
for (const clip of requiredClips) {
  const relativePreview = report.files.animationPreviews[clip];
  assert.ok(relativePreview, `missing ${clip} animation preview path`);
  assert.ok(
    fs.statSync(path.join(root, relativePreview)).size > 20_000,
    `${clip} animation preview`
  );
}

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
  `Validated polished Indisworm Blender source, ${requiredClips.length} full-length animation clips, mouth socket, previews, VOX source, and Galois outputs.`
);
