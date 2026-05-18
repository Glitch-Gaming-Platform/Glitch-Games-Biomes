#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsFile = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const publicRoot = path.join(root, "public/assets/harthmere");
const outTs = path.join(root, "src/shared/harthmere/uploaded_asset_dimensions_v52.ts");
const outJson = path.join(publicRoot, "manifest/harthmere-uploaded-asset-dimensions-v52.json");
const VERSION = "harthmere-uploaded-asset-dimensions-v52";

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sha1File(file) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}

function parseRuntimeAssets(src) {
  const assets = [];
  const seen = new Set();
  const add = (entry) => {
    if (!entry || !entry.key || seen.has(entry.key)) return;
    seen.add(entry.key);
    assets.push(entry);
  };
  const simple = /\b(gltf|fbx)\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*(?:,\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?))?/gim;
  let m;
  while ((m = simple.exec(src))) {
    add({
      key: m[2],
      format: m[1] === "fbx" ? "fbx" : "gltf",
      rel: m[3],
      publicPath: `/assets/harthmere/${m[3]}`,
      defaultScale: m[4] !== undefined ? Number(m[4]) : 1,
    });
  }
  const objRe = /\bobj\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*(?:,\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?))?/gim;
  while ((m = objRe.exec(src))) {
    const rel = `obj/${m[2]}/${m[3]}`;
    add({
      key: m[1],
      format: "obj",
      rel,
      publicPath: `/assets/harthmere/${rel}`,
      defaultScale: m[4] !== undefined ? Number(m[4]) : 1,
    });
  }
  return assets;
}

function classifyAsset(key, rel) {
  const text = `${key} ${rel}`.toLowerCase();
  if (/townsperson_|animal_|creature|character|player_body/.test(text)) return "actor";
  if (/road|path|ground|terrain|grass_/.test(text)) return "ground_surface";
  if (/coin|key|book|scroll|potion|bottle|chalice|mug|plate|spoon|fork|knife|carrot|apple|bread|fishbone|cheese|candle|lantern|torch|banner|flag|rope|chain|quiver|spellbook|whetstone|pickaxe|axe_|sword_|dagger|shield_|bow|crossbow|staff|wand/.test(text)) return "decorative_tiny";
  if (/tree|stump|log/.test(text)) return "tree_trunk";
  if (/bush|shrub|hedge/.test(text)) return "soft_barrier";
  if (/fence|rail|balcony_fence/.test(text)) return "thin_barrier";
  if (/stall/.test(text)) return "stall";
  if (/cart|wagon|trolley|minecart/.test(text)) return "low_cart";
  if (/fountain|well|statue|altar|pillar|column|coffin|crypt|anvil|dummy|cage/.test(text)) return "solid_landmark";
  if (/table|bench|chair|stool|shelf|rack|workbench|bed|nightstand|cabinet|bookcase|chest|crate|barrel|keg|bucket|bag/.test(text)) return "furniture_or_clutter";
  if (/stone|rock|boulder|ore|coal|silver|gold|diamond|mine_/.test(text)) return "solid_resource";
  if (/arch_wall|obj_wall|church|chapel|temple|cathedral|tower|gate|house|hut|cottage|warehouse|barracks|smithy|inn|tavern|windmill|watermill/.test(text)) return "architecture_block";
  if (/roof|chimney|plank|stair|step|overhang/.test(text)) return "architecture_surface";
  return "decorative_or_unknown";
}

function isImage(file) {
  return /\.(png|jpg|jpeg|webp)$/i.test(file);
}

function readImageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length >= 24 && b.toString("ascii", 1, 4) === "PNG") {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), format: "png" };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5), format: "jpg" };
      }
      i += 2 + len;
    }
  }
  return undefined;
}

function decodeDataUri(uri) {
  const comma = uri.indexOf(",");
  if (comma < 0) return undefined;
  return Buffer.from(uri.slice(comma + 1), uri.includes(";base64") ? "base64" : "utf8");
}

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.length < 20 || b.toString("ascii", 0, 4) !== "glTF") throw new Error("not a GLB file");
  let offset = 12;
  let json;
  const bins = [];
  while (offset + 8 <= b.length) {
    const chunkLength = b.readUInt32LE(offset);
    const chunkType = b.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = b.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    if (chunkType === 0x004e4942) bins.push(Buffer.from(chunk));
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bins };
}

function readGltf(file) {
  if (/\.glb$/i.test(file)) return readGlb(file);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return { json, bins: [] };
}

function componentInfo(componentType) {
  switch (componentType) {
    case 5120: return { size: 1, read: (b, o) => b.readInt8(o) };
    case 5121: return { size: 1, read: (b, o) => b.readUInt8(o) };
    case 5122: return { size: 2, read: (b, o) => b.readInt16LE(o) };
    case 5123: return { size: 2, read: (b, o) => b.readUInt16LE(o) };
    case 5125: return { size: 4, read: (b, o) => b.readUInt32LE(o) };
    case 5126: return { size: 4, read: (b, o) => b.readFloatLE(o) };
    default: return undefined;
  }
}

function componentsForType(type) {
  return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[type] || 1;
}

function loadBuffers(doc, bins, file) {
  const baseDir = path.dirname(file);
  return (doc.buffers || []).map((buffer, index) => {
    if (buffer.uri) {
      if (buffer.uri.startsWith("data:")) return decodeDataUri(buffer.uri);
      const resolved = path.resolve(baseDir, decodeURIComponent(buffer.uri));
      return fs.existsSync(resolved) ? fs.readFileSync(resolved) : undefined;
    }
    return bins[index] || bins[0];
  });
}

function accessorBounds(doc, buffers, accessorIndex) {
  const accessor = doc.accessors?.[accessorIndex];
  if (!accessor || accessor.type !== "VEC3") return undefined;
  if (Array.isArray(accessor.min) && Array.isArray(accessor.max) && accessor.min.length >= 3 && accessor.max.length >= 3) {
    return { min: accessor.min.slice(0, 3).map(Number), max: accessor.max.slice(0, 3).map(Number) };
  }
  const view = doc.bufferViews?.[accessor.bufferView];
  const component = componentInfo(accessor.componentType);
  if (!view || !component || accessor.count <= 0) return undefined;
  const buffer = buffers[view.buffer || 0];
  if (!buffer) return undefined;
  const n = componentsForType(accessor.type);
  const stride = view.byteStride || component.size * n;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < accessor.count; i += 1) {
    const base = start + i * stride;
    if (base + component.size * 3 > buffer.length) break;
    for (let c = 0; c < 3; c += 1) {
      const value = component.read(buffer, base + c * component.size);
      if (Number.isFinite(value)) {
        if (value < min[c]) min[c] = value;
        if (value > max[c]) max[c] = value;
      }
    }
  }
  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return undefined;
  return { min, max };
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function trsMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix.map(Number);
  const t = Array.isArray(node.translation) ? node.translation : [0, 0, 0];
  const s = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
  const q = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function expandBounds(global, min, max, matrix) {
  const corners = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z]);
  for (const p of corners.map((corner) => transformPoint(matrix, corner))) {
    for (let i = 0; i < 3; i += 1) {
      if (p[i] < global.min[i]) global.min[i] = p[i];
      if (p[i] > global.max[i]) global.max[i] = p[i];
    }
  }
}

function computeGltfBounds(file) {
  const { json, bins } = readGltf(file);
  const buffers = loadBuffers(json, bins, file);
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const roots = new Set();
  if (Number.isInteger(json.scene) && json.scenes?.[json.scene]?.nodes?.length) {
    for (const n of json.scenes[json.scene].nodes) roots.add(n);
  } else if (Array.isArray(json.scenes)) {
    for (const scene of json.scenes) for (const n of scene.nodes || []) roots.add(n);
  }
  if (roots.size === 0) nodes.forEach((_, i) => roots.add(i));
  const global = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let vertexSources = 0;
  const visit = (nodeIndex, parentMatrix) => {
    const node = nodes[nodeIndex];
    if (!node) return;
    const matrix = multiply(parentMatrix, trsMatrix(node));
    if (Number.isInteger(node.mesh)) {
      const mesh = meshes[node.mesh];
      for (const primitive of mesh?.primitives || []) {
        const pos = primitive.attributes?.POSITION;
        if (Number.isInteger(pos)) {
          const bounds = accessorBounds(json, buffers, pos);
          if (bounds) {
            expandBounds(global, bounds.min, bounds.max, matrix);
            vertexSources += 1;
          }
        }
      }
    }
    for (const child of node.children || []) visit(child, matrix);
  };
  for (const rootIndex of roots) visit(rootIndex, identity());
  if (!global.min.every(Number.isFinite) || !global.max.every(Number.isFinite) || vertexSources === 0) return undefined;
  const size = {
    x: round(global.max[0] - global.min[0]),
    y: round(global.max[1] - global.min[1]),
    z: round(global.max[2] - global.min[2]),
  };
  return {
    min: { x: round(global.min[0]), y: round(global.min[1]), z: round(global.min[2]) },
    max: { x: round(global.max[0]), y: round(global.max[1]), z: round(global.max[2]) },
    size,
    vertexSources,
  };
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.isDirectory()) walkFiles(file, out);
    else out.push(file);
  }
  return out;
}

if (!fs.existsSync(assetsFile)) fail(`missing ${assetsFile}`);
const src = fs.readFileSync(assetsFile, "utf8");
const runtimeAssets = parseRuntimeAssets(src);
if (runtimeAssets.length < 40) fail(`parsed too few runtime assets: ${runtimeAssets.length}`);

const byKey = {};
const failures = [];
for (const asset of runtimeAssets) {
  const file = path.join(publicRoot, asset.rel);
  const entry = {
    key: asset.key,
    format: asset.format,
    path: asset.publicPath,
    relativePath: asset.rel,
    defaultScale: Number.isFinite(asset.defaultScale) ? asset.defaultScale : 1,
    semanticRole: classifyAsset(asset.key, asset.rel),
    exists: fs.existsSync(file),
    sourceBytes: fs.existsSync(file) ? fs.statSync(file).size : 0,
    sha1: fs.existsSync(file) ? sha1File(file) : undefined,
  };
  if (entry.exists && /\.(glb|gltf)$/i.test(file)) {
    try {
      const bounds = computeGltfBounds(file);
      if (bounds) {
        entry.sourceBounds = { min: bounds.min, max: bounds.max };
        entry.sourceSize = bounds.size;
        entry.authoredDefaultSize = {
          x: round(bounds.size.x * entry.defaultScale),
          y: round(bounds.size.y * entry.defaultScale),
          z: round(bounds.size.z * entry.defaultScale),
        };
        entry.vertexSources = bounds.vertexSources;
      } else {
        failures.push({ key: asset.key, path: asset.rel, reason: "no POSITION bounds" });
      }
    } catch (error) {
      failures.push({ key: asset.key, path: asset.rel, reason: String(error.message || error) });
    }
  }
  byKey[asset.key] = entry;
}

const images = {};
for (const file of walkFiles(publicRoot)) {
  if (!isImage(file)) continue;
  const rel = path.relative(publicRoot, file).replace(/\\/g, "/");
  try {
    const size = readImageSize(file);
    if (size) images[rel] = { ...size, path: `/assets/harthmere/${rel}`, bytes: fs.statSync(file).size, sha1: sha1File(file) };
  } catch {
    // Image metadata is optional; skip unreadable images instead of blocking the build.
  }
}

const manifest = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  note: "Generated from registered Harthmere runtime assets. GLB/GLTF sizes are measured from POSITION accessor bounds; FBX/OBJ entries keep source metadata only unless converted later.",
  runtimeAssetCount: runtimeAssets.length,
  measuredMeshCount: Object.values(byKey).filter((entry) => entry.sourceSize).length,
  imageCount: Object.keys(images).length,
  failures,
  assets: byKey,
  images,
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(manifest, null, 2)}\n`);

function stableEntryForTs(entry) {
  return {
    format: entry.format,
    path: entry.path,
    relativePath: entry.relativePath,
    defaultScale: round(entry.defaultScale, 6),
    semanticRole: entry.semanticRole,
    exists: Boolean(entry.exists),
    sourceBytes: entry.sourceBytes || 0,
    sourceSize: entry.sourceSize,
    authoredDefaultSize: entry.authoredDefaultSize,
  };
}

const tsAssets = {};
for (const [key, entry] of Object.entries(byKey).sort(([a], [b]) => a.localeCompare(b))) {
  tsAssets[key] = stableEntryForTs(entry);
}

const tsImages = {};
for (const [rel, entry] of Object.entries(images).sort(([a], [b]) => a.localeCompare(b))) {
  tsImages[rel] = { width: entry.width, height: entry.height, format: entry.format, path: entry.path, bytes: entry.bytes };
}

const ts = `// Generated by scripts/harthmere/generate-harthmere-uploaded-asset-dimensions-v52.cjs\n// Do not hand-edit sizes; rerun the generator after adding or replacing GLB/GLTF assets.\n\nexport const HARTHMERE_UPLOADED_ASSET_DIMENSIONS_VERSION_V52 = ${JSON.stringify(VERSION)};\n\nexport type HarthmereUploadedAssetDimensionV52 = {\n  readonly format: string;\n  readonly path: string;\n  readonly relativePath: string;\n  readonly defaultScale: number;\n  readonly semanticRole: string;\n  readonly exists: boolean;\n  readonly sourceBytes: number;\n  readonly sourceSize?: { readonly x: number; readonly y: number; readonly z: number };\n  readonly authoredDefaultSize?: { readonly x: number; readonly y: number; readonly z: number };\n};\n\nexport const HARTHMERE_UPLOADED_ASSET_DIMENSIONS_BY_KEY_V52 = ${JSON.stringify(tsAssets, null, 2)} as const satisfies Record<string, HarthmereUploadedAssetDimensionV52>;\n\nexport const HARTHMERE_UPLOADED_IMAGE_METADATA_V52 = ${JSON.stringify(tsImages, null, 2)} as const;\n\nfunction clampHarthmereUploadedAssetDimensionV52(value: number, min: number, max: number): number {\n  return Math.max(min, Math.min(max, value));\n}\n\nexport function harthmereUploadedAssetDimensionForKeyV52(asset: string): HarthmereUploadedAssetDimensionV52 | undefined {\n  return (HARTHMERE_UPLOADED_ASSET_DIMENSIONS_BY_KEY_V52 as Record<string, HarthmereUploadedAssetDimensionV52>)[asset];\n}\n\nexport function harthmereUploadedAssetCollisionFootprintV52(asset: string, placementScale?: number): {\n  readonly role: string;\n  readonly halfX: number;\n  readonly halfZ: number;\n  readonly height: number;\n  readonly padding: number;\n  readonly blocksNpc: boolean;\n  readonly blocksPlayer: boolean;\n  readonly category: \"none\" | \"soft\" | \"hard\" | \"playerBlocker\" | \"serviceClearance\";\n  readonly passThrough: boolean;\n} | undefined {\n  const entry = harthmereUploadedAssetDimensionForKeyV52(asset);\n  if (!entry?.sourceSize) return undefined;\n  const role = entry.semanticRole;\n  if (role === \"actor\" || role === \"ground_surface\" || role === \"decorative_tiny\" || role === \"decorative_or_unknown\" || role === \"architecture_surface\") {\n    return { role, halfX: 0.02, halfZ: 0.02, height: 0.12, padding: 0, blocksNpc: false, blocksPlayer: false, category: \"none\", passThrough: true };\n  }\n  // Registry passes the authored placement scale. If a placement omitted scale, use the asset defaultScale measured here.\n  const scale = Number.isFinite(placementScale) && placementScale !== undefined ? placementScale : entry.defaultScale;\n  const visualX = Math.max(0, entry.sourceSize.x * scale);\n  const visualY = Math.max(0, entry.sourceSize.y * scale);\n  const visualZ = Math.max(0, entry.sourceSize.z * scale);\n  const visualHalfX = visualX / 2;\n  const visualHalfZ = visualZ / 2;\n\n  if (role === \"tree_trunk\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.28, 0.16, 0.95), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.28, 0.16, 0.95), height: clampHarthmereUploadedAssetDimensionV52(visualY, 1.2, 9), padding: 0.08, blocksNpc: true, blocksPlayer: true, category: \"playerBlocker\", passThrough: false };\n  }\n  if (role === \"thin_barrier\" || role === \"soft_barrier\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.76, 0.08, 1.75), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.34, 0.04, 0.28), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.45, 2.2), padding: 0.06, blocksNpc: true, blocksPlayer: true, category: role === \"soft_barrier\" ? \"soft\" : \"playerBlocker\", passThrough: false };\n  }\n  if (role === \"stall\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.62, 0.22, 2.6), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.62, 0.18, 2.0), height: clampHarthmereUploadedAssetDimensionV52(visualY, 1.0, 4.0), padding: 0.08, blocksNpc: true, blocksPlayer: true, category: \"serviceClearance\", passThrough: false };\n  }\n  if (role === \"low_cart\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.58, 0.18, 2.25), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.58, 0.14, 1.45), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.55, 2.0), padding: 0.06, blocksNpc: true, blocksPlayer: true, category: \"soft\", passThrough: false };\n  }\n  if (role === \"furniture_or_clutter\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.72, 0.06, 1.35), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.72, 0.06, 1.1), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.22, 2.7), padding: 0.04, blocksNpc: true, blocksPlayer: true, category: visualY <= 0.9 ? \"soft\" : \"playerBlocker\", passThrough: false };\n  }\n  if (role === \"solid_landmark\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.72, 0.16, 4.2), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.72, 0.16, 4.2), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.42, 6.5), padding: 0.08, blocksNpc: true, blocksPlayer: true, category: \"playerBlocker\", passThrough: false };\n  }\n  if (role === \"solid_resource\") {\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.86, 0.12, 1.35), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.86, 0.12, 1.35), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.25, 2.2), padding: 0.05, blocksNpc: true, blocksPlayer: true, category: \"playerBlocker\", passThrough: false };\n  }\n  if (role === \"architecture_block\") {\n    // Large architecture has bespoke registry rules. This measured fallback is used only when no better rule matched.\n    return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.82, 0.2, 5.0), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.82, 0.2, 5.0), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.75, 8.0), padding: 0.06, blocksNpc: true, blocksPlayer: true, category: \"hard\", passThrough: false };\n  }\n  return { role, halfX: clampHarthmereUploadedAssetDimensionV52(visualHalfX * 0.64, 0.08, 1.6), halfZ: clampHarthmereUploadedAssetDimensionV52(visualHalfZ * 0.64, 0.08, 1.4), height: clampHarthmereUploadedAssetDimensionV52(visualY, 0.3, 3.6), padding: 0.05, blocksNpc: true, blocksPlayer: true, category: \"playerBlocker\", passThrough: false };\n}\n`;

fs.mkdirSync(path.dirname(outTs), { recursive: true });
fs.writeFileSync(outTs, ts);
console.log(`WROTE ${path.relative(root, outTs)} with ${manifest.measuredMeshCount}/${manifest.runtimeAssetCount} measured mesh assets and ${manifest.imageCount} image metadata entries`);
console.log(`WROTE ${path.relative(root, outJson)}`);
if (manifest.failures.length) {
  console.log(`WARN ${manifest.failures.length} GLB/GLTF assets had no measurable bounds; see JSON failures array`);
}
