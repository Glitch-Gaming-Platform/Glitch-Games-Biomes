#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.join(
  repoRoot,
  "public/assets/harthmere/manifest/world-interaction-graphics.json"
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function inspectGlb(publicUrl) {
  const filePath = path.join(repoRoot, "public", publicUrl.replace(/^\//, ""));
  assert.ok(fs.existsSync(filePath), `missing ${publicUrl}`);
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString("utf8", 0, 4), "glTF", `${publicUrl} is not GLB`);
  let offset = 12;
  let json;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const kind = bytes.readUInt32LE(offset + 4);
    offset += 8;
    const payload = bytes.subarray(offset, offset + length);
    offset += length;
    if (kind === 0x4e4f534a) {
      json = JSON.parse(payload.toString("utf8").replace(/[\0 ]+$/g, ""));
      break;
    }
  }
  assert.ok(json, `${publicUrl} is missing a JSON chunk`);
  const primitiveCount = (json.meshes ?? []).reduce(
    (sum, mesh) => sum + (mesh.primitives?.length ?? 0),
    0
  );
  return {
    filePath,
    bytes: bytes.length,
    primitiveCount,
    materialCount: json.materials?.length ?? 0,
    textureCount: json.textures?.length ?? 0,
    imageCount: json.images?.length ?? 0,
    meshoptCompressed: (json.extensionsUsed ?? []).includes(
      "EXT_meshopt_compression"
    ),
  };
}

assert.equal(manifest.gatheringNodes.length, 29);
assert.equal(Object.keys(manifest.jobsBoardVariants).length, 5);
assert.equal(manifest.performance.runtimeLights, 0);
assert.match(manifest.performance.compression, /EXT_meshopt_compression/);
assert.equal(
  manifest.authorityBoundary.authoredGatheringNodes,
  "server_shared_respawn_static_landmark_no_gaia_plant_tick"
);
assert.equal(
  manifest.authorityBoundary.plantedCrops,
  "native_ecs_farming_plant_component_plus_gaia_growth_and_harvest"
);

const authoritySource = fs.readFileSync(
  path.join(repoRoot, "src/shared/harthmere/gathering_node_authority.ts"),
  "utf8"
);
const nodeIds = manifest.gatheringNodes.map((entry) => entry.nodeId);
assert.equal(new Set(nodeIds).size, 29, "gathering graphic IDs must be unique");
for (const nodeId of nodeIds) {
  assert.ok(
    authoritySource.includes(`id: "${nodeId}"`),
    `${nodeId} is not present in gathering authority`
  );
}
assert.equal(
  new Set(manifest.gatheringNodes.map((entry) => entry.assets.lod0)).size,
  29,
  "every gathering type must use its own LOD0 asset"
);

let totalBytes = 0;
let maxBytes = 0;
let maxPrimitives = 0;
for (const entry of manifest.gatheringNodes) {
  for (const lod of ["lod0", "lod1"]) {
    const inspected = inspectGlb(entry.assets[lod]);
    assert.equal(inspected.meshoptCompressed, true, `${entry.nodeId}:${lod}`);
    assert.equal(inspected.textureCount, 0, `${entry.nodeId}:${lod} textures`);
    assert.equal(inspected.imageCount, 0, `${entry.nodeId}:${lod} images`);
    assert.ok(
      inspected.primitiveCount <= 7,
      `${entry.nodeId}:${lod} primitives`
    );
    assert.ok(inspected.bytes < 35_000, `${entry.nodeId}:${lod} bytes`);
    assert.equal(inspected.bytes, entry.stats[lod].bytes);
    totalBytes += inspected.bytes;
    maxBytes = Math.max(maxBytes, inspected.bytes);
    maxPrimitives = Math.max(maxPrimitives, inspected.primitiveCount);
  }
}

for (const [variant, entry] of Object.entries(manifest.jobsBoardVariants)) {
  const width = entry.bounds.max[0] - entry.bounds.min[0];
  const height = entry.bounds.max[2] - entry.bounds.min[2];
  assert.ok(width >= 6.5, `${variant} board width regressed: ${width}`);
  assert.ok(height >= 6.4, `${variant} board height regressed: ${height}`);
  for (const lod of ["lod0", "lod1"]) {
    const inspected = inspectGlb(entry.assets[lod]);
    assert.equal(inspected.meshoptCompressed, true, `${variant}:${lod}`);
    assert.equal(inspected.textureCount, 0, `${variant}:${lod} textures`);
    assert.equal(inspected.imageCount, 0, `${variant}:${lod} images`);
    assert.ok(inspected.primitiveCount <= 7, `${variant}:${lod} primitives`);
    assert.ok(inspected.bytes < 50_000, `${variant}:${lod} bytes`);
    assert.equal(inspected.bytes, entry.stats[lod].bytes);
    totalBytes += inspected.bytes;
    maxBytes = Math.max(maxBytes, inspected.bytes);
    maxPrimitives = Math.max(maxPrimitives, inspected.primitiveCount);
  }
}

assert.equal(manifest.summary.glbCount, 68);
assert.equal(totalBytes, manifest.summary.totalBytes);
assert.ok(totalBytes < 1_000_000, `asset set is too large: ${totalBytes}`);

const gatheringRenderer = fs.readFileSync(
  path.join(
    repoRoot,
    "src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts"
  ),
  "utf8"
);
const boardRenderer = fs.readFileSync(
  path.join(
    repoRoot,
    "src/client/game/renderers/local_dev/harthmere_jobs_board_marker.ts"
  ),
  "utf8"
);
const gatheringInteraction = fs.readFileSync(
  path.join(
    repoRoot,
    "src/client/components/challenges/HarthmereGatheringNodeWorldInteraction.tsx"
  ),
  "utf8"
);
const boardInteraction = fs.readFileSync(
  path.join(
    repoRoot,
    "src/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction.tsx"
  ),
  "utf8"
);
for (const [label, source] of [
  ["gathering renderer", gatheringRenderer],
  ["jobs-board renderer", boardRenderer],
]) {
  assert.ok(source.includes("loadGltf"), `${label} must load optimized GLBs`);
  assert.ok(
    source.includes("frustumCulled = true"),
    `${label} must allow culling`
  );
  assert.equal(
    source.includes("PointLight"),
    false,
    `${label} must not add lights`
  );
}
assert.ok(
  gatheringInteraction.includes("submitHarthmereGatheringNode(prompt.id)")
);
assert.ok(gatheringInteraction.includes(">F</span>"));
assert.ok(boardInteraction.includes('keyCodes: ["KeyF", "KeyE"]'));
assert.ok(boardInteraction.includes(">F</span>"));

console.log(
  JSON.stringify(
    {
      ok: true,
      gatheringNodes: manifest.gatheringNodes.length,
      jobsBoardVariants: Object.keys(manifest.jobsBoardVariants).length,
      glbs: manifest.summary.glbCount,
      totalBytes,
      maxBytes,
      maxPrimitives,
      runtimeLights: manifest.performance.runtimeLights,
      textures: 0,
    },
    null,
    2
  )
);
