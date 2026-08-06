#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const catalog = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/shared/cutscene/cinematic_expression_catalog.json"),
    "utf8"
  )
);
const expectedClips = [
  ...new Set(Object.values(catalog).map((spec) => spec.clip)),
];
const assetVersions = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/galois/js/interface/gen/asset_versions.json"),
    "utf8"
  )
);
const characterPath = path.join(
  root,
  "public/buckets/biomes-static",
  assetVersions.paths["wearables/animations"]
);
const npcDirectory = path.join(root, "src/galois/data/npcs");
const assetPaths = [
  characterPath,
  ...fs
    .readdirSync(npcDirectory)
    .filter((name) => name.endsWith("_animations.gltf"))
    .sort()
    .map((name) => path.join(npcDirectory, name)),
];

const failures = [];
let motionVerified = 0;

function loadAnimationAsset(assetPath) {
  const bytes = fs.readFileSync(assetPath);
  if (bytes.toString("utf8", 0, 4) !== "glTF") {
    return { gltf: JSON.parse(bytes.toString("utf8")), embeddedBuffers: [] };
  }
  let offset = 12;
  let gltf;
  const embeddedBuffers = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      gltf = JSON.parse(chunk.toString("utf8").replace(/\0+$/, ""));
    } else if (type === 0x004e4942) {
      embeddedBuffers.push(chunk);
    }
    offset += 8 + length;
  }
  if (!gltf) throw new Error(`${assetPath}: GLB has no JSON chunk`);
  return { gltf, embeddedBuffers };
}

function animationBuffer(gltf, bufferIndex, assetPath, embeddedBuffers) {
  if (embeddedBuffers?.[bufferIndex]) {
    return embeddedBuffers[bufferIndex];
  }
  const uri = gltf.buffers?.[bufferIndex]?.uri;
  if (typeof uri !== "string") {
    throw new Error(`${assetPath}: animation buffer ${bufferIndex} has no URI`);
  }
  const dataMatch = /^data:.*?;base64,(.*)$/.exec(uri);
  if (dataMatch) {
    return Buffer.from(dataMatch[1], "base64");
  }
  return fs.readFileSync(path.resolve(path.dirname(assetPath), uri));
}

function accessorRows(gltf, accessorIndex, buffers, label) {
  const accessor = gltf.accessors?.[accessorIndex];
  const view = gltf.bufferViews?.[accessor?.bufferView];
  const componentCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const componentCount = componentCounts[accessor?.type];
  if (
    !accessor ||
    !view ||
    !componentCount ||
    accessor.componentType !== 5126
  ) {
    throw new Error(`${label}: expected a float animation accessor`);
  }
  const buffer = buffers[view.buffer ?? 0];
  const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const byteStride = view.byteStride ?? componentCount * 4;
  const rows = [];
  for (let rowIndex = 0; rowIndex < accessor.count; rowIndex += 1) {
    const row = [];
    for (let component = 0; component < componentCount; component += 1) {
      row.push(
        buffer.readFloatLE(byteOffset + rowIndex * byteStride + component * 4)
      );
    }
    rows.push(row);
  }
  return rows;
}

function animationTransformDelta(gltf, animation, buffers, label) {
  let maxDelta = 0;
  for (const channel of animation.channels ?? []) {
    if (!["rotation", "translation"].includes(channel.target?.path)) {
      continue;
    }
    const sampler = animation.samplers?.[channel.sampler];
    const rows = accessorRows(gltf, sampler?.output, buffers, label);
    const first = rows[0] ?? [];
    for (const row of rows) {
      for (let index = 0; index < row.length; index += 1) {
        maxDelta = Math.max(maxDelta, Math.abs(row[index] - first[index]));
      }
    }
  }
  return maxDelta;
}

for (const assetPath of assetPaths) {
  const relative = path.relative(root, assetPath);
  const { gltf, embeddedBuffers } = loadAnimationAsset(assetPath);
  const buffers = (gltf.buffers ?? []).map((_, index) =>
    animationBuffer(gltf, index, assetPath, embeddedBuffers)
  );
  const sceneRootNodes = new Set(gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []);
  const animations = gltf.animations ?? [];
  const names = animations.map((animation) => animation.name);
  const duplicateNames = names.filter(
    (name, index) => name && names.indexOf(name) !== index
  );
  const missing = expectedClips.filter((clip) => !names.includes(clip));
  if (missing.length > 0) {
    failures.push(`${relative}: missing ${missing.join(", ")}`);
  }
  if (duplicateNames.length > 0) {
    failures.push(
      `${relative}: duplicate clips ${[...new Set(duplicateNames)].join(", ")}`
    );
  }

  for (const animation of animations.filter((entry) =>
    expectedClips.includes(entry.name)
  )) {
    const label = `${relative}:${animation.name}`;
    if (!animation.channels?.length || !animation.samplers?.length) {
      failures.push(`${relative}:${animation.name}: empty animation payload`);
      continue;
    }
    for (const channel of animation.channels) {
      const node = gltf.nodes?.[channel.target?.node];
      if (!node || typeof node.name !== "string") {
        failures.push(
          `${relative}:${animation.name}: channel targets a missing/unnamed node`
        );
      }
      if (
        !["rotation", "translation", "scale", "weights"].includes(
          channel.target?.path
        )
      ) {
        failures.push(
          `${relative}:${animation.name}: unsupported channel path ${channel.target?.path}`
        );
      }
      if (
        channel.target?.path === "translation" &&
        sceneRootNodes.has(channel.target?.node)
      ) {
        failures.push(`${label}: expression owns scene-root translation`);
      }
    }
    try {
      const delta = animationTransformDelta(gltf, animation, buffers, label);
      if (delta <= 1e-5) {
        failures.push(`${label}: all transform channels are constant`);
      } else {
        motionVerified += 1;
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

const character = loadAnimationAsset(characterPath).gltf;
for (const attackName of ["Attack", "Attack2"]) {
  const attack = character.animations?.find(
    (animation) => animation.name === attackName
  );
  if (attack?.channels?.length !== 48) {
    failures.push(
      `character ${attackName} expected 48 channels, found ${
        attack?.channels?.length ?? "missing"
      }`
    );
  }
}

const cinematicRuntime = fs.readFileSync(
  path.join(root, "src/shared/cutscene/cinematic_expressions.ts"),
  "utf8"
);
const playerRuntime = fs.readFileSync(
  path.join(root, "src/client/game/util/player_animations.ts"),
  "utf8"
);
const playerState = fs.readFileSync(
  path.join(root, "src/client/game/resources/players.ts"),
  "utf8"
);
const playerMesh = fs.readFileSync(
  path.join(root, "src/client/game/resources/player_mesh.ts"),
  "utf8"
);
if (!/additive:\s*true/.test(cinematicRuntime)) {
  failures.push("cinematic expression definitions are not additive");
}
if (!/head\|neck\|chest\|spine/.test(playerRuntime)) {
  failures.push("player upper-body mask does not include head/chest/spine");
}
if (
  !/easeOutTime:\s*HARTHMERE_CINEMATIC_EXPRESSION_EASE_SECONDS/.test(
    playerState
  ) ||
  !/durationSeconds:\s*harthmereCinematicExpressionSpec/.test(playerState)
) {
  failures.push(
    "expression body timing is not explicit and symmetrically eased"
  );
}
if (
  !/keepsProductionExpressionCapableFace:\s*true/.test(playerMesh) ||
  !/installHarthmerePlayerFacialExpressionBridge/.test(playerMesh) ||
  !/const easeMs = 120/.test(playerMesh)
) {
  failures.push(
    "production player face is not expression-capable with symmetric easing"
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `CINEMATIC_EXPRESSION_ASSETS_OK assets=${
    assetPaths.length
  } publicExpressions=${Object.keys(catalog).length} uniqueClips=${
    expectedClips.length
  } motionVerified=${motionVerified} attacksPreserved=2`
);
