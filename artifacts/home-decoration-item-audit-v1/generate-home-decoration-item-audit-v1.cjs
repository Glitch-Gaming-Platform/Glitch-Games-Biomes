#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const outDir = __dirname;
const sourceAssetsFile = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
);
const residentHousingFile = path.join(
  root,
  "src/shared/harthmere/resident_housing_v38.ts",
);
const buildingSystemFile = path.join(
  root,
  "src/shared/harthmere/building_system_v1.ts",
);
const townBlockFile = path.join(
  root,
  "src/shared/harthmere/town_block_build_v1.ts",
);
const manifestFile = path.join(
  root,
  "public/assets/harthmere/manifest/harthmere-uploaded-asset-dimensions-v52.json",
);
const coreModelRoot = path.join(
  root,
  "public/buckets/biomes-static/asset_data/placeables",
);
const coreIconRoot = path.join(
  root,
  "public/buckets/biomes-static/asset_data/icons/placeables",
);
const coreSourceRoot = path.join(root, "src/galois/data/placeables");

const AUDIT_VERSION = "home-decoration-item-audit-v1";

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function vectorRound(vector) {
  if (!vector) return undefined;
  return {
    x: round(vector.x ?? vector[0]),
    y: round(vector.y ?? vector[1]),
    z: round(vector.z ?? vector[2]),
  };
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function sha1File(file) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function parseRuntimeAssets(src) {
  const start = src.indexOf("const ASSETS: RuntimeAsset[] = [");
  const end = src.indexOf("const assetByKey", start);
  const section = start >= 0 && end > start ? src.slice(start, end) : src;
  const assets = [];
  const seen = new Set();
  const add = (entry) => {
    if (!entry.key || seen.has(entry.key)) return;
    seen.add(entry.key);
    assets.push(entry);
  };
  const simple =
    /\b(gltf|fbx)\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*(?:,\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?))?/gim;
  let m;
  while ((m = simple.exec(section))) {
    add({
      catalog: "harthmere_runtime_assets",
      key: m[2],
      format: m[1] === "fbx" ? "fbx" : "gltf",
      sourcePath: m[3],
      publicPath: `/assets/harthmere/${m[3]}`,
      defaultScale: m[4] !== undefined ? Number(m[4]) : 1,
      sourceDefinition: `${m[1]}("${m[2]}", "${m[3]}")`,
    });
  }
  const objRe =
    /\bobj\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*(?:,\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?))?/gim;
  while ((m = objRe.exec(section))) {
    const sourcePath = `obj/${m[2]}/${m[3]}`;
    add({
      catalog: "harthmere_runtime_assets",
      key: m[1],
      format: "obj",
      sourcePath,
      publicPath: `/assets/harthmere/${sourcePath}`,
      defaultScale: m[4] !== undefined ? Number(m[4]) : 1,
      sourceDefinition: `obj("${m[1]}", "${m[2]}", "${m[3]}")`,
    });
  }
  return assets;
}

function parseDecorArray(src, name) {
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`, "m");
  const match = src.match(re);
  if (!match) return [];
  const body = match[1];
  const out = [];
  const itemRe = /\{([^{}]+)\}/g;
  let m;
  while ((m = itemRe.exec(body))) {
    const text = m[1];
    const getString = (field) => text.match(new RegExp(`${field}:\\s*"([^"]*)"`))?.[1];
    const getNumber = (field) => {
      const raw = text.match(new RegExp(`${field}:\\s*([^,]+)`))?.[1]?.trim();
      if (!raw) return undefined;
      if (raw === "Math.PI / 2") return Math.PI / 2;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    out.push({
      role: getString("role"),
      asset: getString("asset"),
      dx: getNumber("dx"),
      dz: getNumber("dz"),
      y: getNumber("y"),
      rot: getNumber("rot"),
      scale: getNumber("scale"),
      label: getString("label"),
    });
  }
  return out;
}

function parseHousingCounts(src) {
  const houseMatches = [
    ...src.matchAll(
      /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*district:\s*"([^"]+)",\s*style:\s*"([^"]+)",\s*x:\s*([-0-9.]+),\s*z:\s*([-0-9.]+),\s*w:\s*([-0-9.]+),\s*d:\s*([-0-9.]+),\s*rot:\s*([^,]+),\s*floors:\s*(\d+),\s*roomsPerFloor:\s*(\d+)/g,
    ),
  ].map((m) => ({
    id: m[1],
    name: m[2],
    district: m[3],
    style: m[4],
    x: Number(m[5]),
    z: Number(m[6]),
    width: Number(m[7]),
    depth: Number(m[8]),
    rot: m[9].trim(),
    floors: Number(m[10]),
    roomsPerFloor: Number(m[11]),
    roomCount: Number(m[10]) * Number(m[11]),
  }));
  return houseMatches;
}

function classifyObject(key, sourcePath, role) {
  const text = `${key} ${sourcePath || ""} ${role || ""}`.toLowerCase();
  if (/bed|nightstand|table|chair|bench|stool|shelf|cabinet|bookcase|dresser/.test(text)) {
    return "furniture";
  }
  if (/chest|crate|barrel|bag|rack|bucket|storage|container/.test(text)) {
    return "storage_or_clutter";
  }
  if (/candle|lantern|torch|lamp|light/.test(text)) return "lighting";
  if (/banner|flag|sign|paper|note|book|scroll|painting|frame|wall/.test(text)) {
    return "wall_or_display_decor";
  }
  if (/food|apple|carrot|fish|mushroom|bread|plate|mug|bottle|keg|chalice/.test(text)) {
    return "food_or_tabletop";
  }
  if (/weapon|sword|axe|bow|dagger|shield|staff|pickaxe|tool/.test(text)) {
    return "tools_or_weapons";
  }
  if (/tree|bush|shrub|flower|plant|grass|rock|stone|ore|mine|stump|log/.test(text)) {
    return "nature_or_resource";
  }
  if (/house|shop|wall|roof|arch_|bridge|tower|church|chapel|building|door|stair|window|gate/.test(text)) {
    return "architecture";
  }
  if (/animal|creature|npc|townsperson|monster|mucker|robot|player/.test(text)) {
    return "actor";
  }
  if (/stall|cart|market|fountain|well|statue|altar|anvil|dummy/.test(text)) {
    return "service_or_landmark_prop";
  }
  return "decor_or_misc";
}

function inferColorWords(colors) {
  if (!colors?.length) return [];
  const names = [];
  for (const c of colors.slice(0, 6)) {
    const hex = c.hex || c;
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 55) names.push("black/dark");
    else if (min > 210) names.push("white/light");
    else if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) names.push("gray/stone");
    else if (r > g * 1.25 && r > b * 1.25) names.push(g > 120 ? "orange/gold" : "red/brown");
    else if (g > r * 1.2 && g > b * 1.15) names.push("green");
    else if (b > r * 1.15 && b > g * 1.1) names.push("blue");
    else if (r > 120 && g > 80 && b < 90) names.push("wood/brown");
    else names.push("mixed");
  }
  return [...new Set(names)];
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return undefined;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function describeAsset(entry) {
  const words = entry.key
    .replace(/^obj_/, "")
    .replace(/_/g, " ")
    .replace(/\bfp\b/g, "")
    .trim();
  const kind = entry.objectKind || "object";
  const size = entry.size?.authoredDefaultSize || entry.size?.renderedDefaultSize || entry.size?.boxSize;
  const sizeText = size
    ? `${round(size.x)}m x ${round(size.y)}m x ${round(size.z)}m`
    : "size not measured";
  const colors = inferColorWords(entry.colors?.prominentRenderedColors || entry.colors?.materialColors);
  const colorText = colors.length ? ` Dominant colors: ${colors.join(", ")}.` : "";
  return `${words || entry.key} (${kind}); ${sizeText}.${colorText}`;
}

function fileInfo(file) {
  if (!file || !fs.existsSync(file)) return undefined;
  const stat = fs.statSync(file);
  return {
    absolutePath: file,
    bytes: stat.size,
    sha1: sha1File(file),
  };
}

function findHashedAsset(rootDir, relNoExt, ext) {
  const dir = path.join(rootDir, path.dirname(relNoExt));
  const base = path.basename(relNoExt);
  if (!fs.existsSync(dir)) return undefined;
  return fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .find((file) => {
      const name = path.basename(file);
      return (
        name.startsWith(`${base}.`) &&
        name.endsWith(ext) &&
        fs.statSync(file).isFile()
      );
    });
}

function collectCoreAssetFiles() {
  const sourceFiles = walkFiles(coreSourceRoot);
  const rels = new Set();
  for (const file of sourceFiles) {
    const rel = path
      .relative(coreSourceRoot, file)
      .replace(/\.(vox|json|blend|gltf)$/i, "")
      .replace(/\\/g, "/");
    rels.add(rel);
  }
  for (const file of walkFiles(coreModelRoot)) {
    const rel = path
      .relative(coreModelRoot, file)
      .replace(/\.[0-9a-f]{32}\.gltf$/i, "")
      .replace(/\\/g, "/");
    rels.add(rel);
  }
  return [...rels].sort().map((rel) => {
    const sourceMatches = sourceFiles
      .filter((file) =>
        path
          .relative(coreSourceRoot, file)
          .replace(/\.(vox|json|blend|gltf)$/i, "")
          .replace(/\\/g, "/") === rel,
      )
      .map((file) => fileInfo(file));
    const modelFile = findHashedAsset(coreModelRoot, rel, ".gltf");
    const iconFile = findHashedAsset(coreIconRoot, rel, ".png");
    return {
      catalog: "core_biomes_placeable_assets",
      key: rel.replace(/\//g, "_"),
      galoisPath: `placeables/${rel}`,
      rel,
      format: modelFile ? "gltf" : undefined,
      publicPath: modelFile
        ? `/buckets/biomes-static/asset_data/placeables/${path
            .relative(coreModelRoot, modelFile)
            .replace(/\\/g, "/")}`
        : undefined,
      iconPublicPath: iconFile
        ? `/buckets/biomes-static/asset_data/icons/placeables/${path
            .relative(coreIconRoot, iconFile)
            .replace(/\\/g, "/")}`
        : undefined,
      defaultScale: 1,
      sourceFiles: sourceMatches,
      modelFile: fileInfo(modelFile),
      iconFile: fileInfo(iconFile),
    };
  });
}

function serveStaticFile(res, file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".fbx": "application/octet-stream",
    ".obj": "text/plain",
    ".mtl": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bin": "application/octet-stream",
  };
  res.writeHead(200, {
    "content-type": types[ext] || "application/octet-stream",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  fs.createReadStream(file).pipe(res);
}

function startStaticServer() {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${AUDIT_VERSION}</title>
  <script type="importmap">
  {
    "imports": {
      "three": "/node_modules/three/build/three.module.js",
      "three/addons/": "/node_modules/three/examples/jsm/"
    }
  }
  </script>
</head>
<body style="margin:0; background:#f1eee7; font-family:system-ui, sans-serif">
  <canvas id="gl" width="256" height="256"></canvas>
  <script type="module" src="/audit-renderer.js"></script>
</body>
</html>`;

  const rendererJs = `import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(256, 256, false);
renderer.setClearColor(0xf1eee7, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10000);
const ambient = new THREE.AmbientLight(0xffffff, 2.2);
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(3, 5, 4);
const fill = new THREE.DirectionalLight(0xffffff, 1.2);
fill.position.set(-4, 2, -3);
scene.add(ambient, key, fill);

function vector(box, source) {
  return { x: Number(source.x.toFixed(4)), y: Number(source.y.toFixed(4)), z: Number(source.z.toFixed(4)) };
}

function colorHex(color) {
  if (!color) return undefined;
  return "#" + color.getHexString();
}

function normalizeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(normalizeMaterial);
    return;
  }
  material.side = THREE.DoubleSide;
  if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
  if (material.color && material.color.r === 0 && material.color.g === 0 && material.color.b === 0) {
    material.color.setRGB(0.08, 0.08, 0.08);
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const mat of mats) {
      for (const value of Object.values(mat)) {
        if (value && value.isTexture) value.dispose();
      }
      mat.dispose?.();
    }
  });
}

function collectMaterials(object) {
  const map = new Map();
  object.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const mat of mats) {
      normalizeMaterial(mat);
      const name = mat.name || mat.type || "material";
      const hex = colorHex(mat.color);
      const key = name + "|" + (hex || "") + "|" + Boolean(mat.map);
      if (!map.has(key)) {
        map.set(key, {
          name,
          type: mat.type,
          color: hex,
          opacity: Number((mat.opacity ?? 1).toFixed(3)),
          transparent: Boolean(mat.transparent),
          hasTexture: Boolean(mat.map),
          textureName: mat.map?.name || mat.map?.image?.src?.split("/").pop() || undefined,
          metalness: Number.isFinite(mat.metalness) ? Number(mat.metalness.toFixed(3)) : undefined,
          roughness: Number.isFinite(mat.roughness) ? Number(mat.roughness.toFixed(3)) : undefined,
        });
      }
    }
  });
  return [...map.values()].slice(0, 24);
}

async function loadAsset(asset) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => encodeURI(url));
  if (asset.format === "gltf") {
    const loaded = await new GLTFLoader(manager).loadAsync(asset.publicPath);
    return { object: loaded.scene, animations: loaded.animations || [] };
  }
  if (asset.format === "fbx") {
    const object = await new FBXLoader(manager).loadAsync(asset.publicPath);
    return { object, animations: object.animations || [] };
  }
  if (asset.format === "obj") {
    const mtlLoader = new MTLLoader(manager);
    const base = asset.publicPath;
    const folder = base.slice(0, base.lastIndexOf("/") + 1);
    mtlLoader.setPath(folder);
    mtlLoader.setResourcePath(folder);
    let materials;
    try {
      materials = await mtlLoader.loadAsync(base + ".mtl");
      materials.preload();
    } catch {}
    const objLoader = new OBJLoader(manager);
    if (materials) objLoader.setMaterials(materials);
    const object = await objLoader.loadAsync(base + ".obj");
    return { object, animations: [] };
  }
  throw new Error("unsupported format " + asset.format);
}

function fitCamera(box) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const view = maxDim * 1.45;
  camera.left = -view / 2;
  camera.right = view / 2;
  camera.top = view / 2;
  camera.bottom = -view / 2;
  camera.near = 0.01;
  camera.far = maxDim * 20 + 100;
  camera.position.set(maxDim * 1.2, maxDim * 0.9, maxDim * 1.35);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function analyzePixels() {
  const gl = renderer.getContext();
  const pixels = new Uint8Array(256 * 256 * 4);
  gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let nonBackground = 0;
  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 10) continue;
    const dist = Math.abs(r - 241) + Math.abs(g - 238) + Math.abs(b - 231);
    if (dist < 20) continue;
    nonBackground += 1;
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const hex = "#" + [qr, qg, qb].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
    buckets.set(hex, (buckets.get(hex) || 0) + 1);
  }
  return {
    nonBackgroundPixels: nonBackground,
    prominentRenderedColors: [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([hex, pixels]) => ({ hex, pixels })),
  };
}

function drawLabel(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

async function renderOne(asset) {
  const loaded = await loadAsset(asset);
  const object = loaded.object;
  object.traverse((child) => {
    if (child.isMesh) {
      normalizeMaterial(child.material);
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  object.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(object);
  const sourceSize = new THREE.Vector3();
  sourceBox.getSize(sourceSize);
  const sourceCenter = new THREE.Vector3();
  sourceBox.getCenter(sourceCenter);
  const materials = collectMaterials(object);
  object.position.sub(sourceCenter);
  object.scale.multiplyScalar(asset.defaultScale || 1);
  object.updateMatrixWorld(true);
  const defaultBox = new THREE.Box3().setFromObject(object);
  const defaultSize = new THREE.Vector3();
  defaultBox.getSize(defaultSize);
  const defaultCenter = new THREE.Vector3();
  defaultBox.getCenter(defaultCenter);
  object.position.sub(defaultCenter);
  object.updateMatrixWorld(true);
  scene.add(object);
  fitCamera(new THREE.Box3().setFromObject(object));
  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL("image/png");
  const pixels = analyzePixels();
  scene.remove(object);
  disposeObject(object);
  return {
    key: asset.key,
    loaded: true,
    sourceSize: vector(sourceBox, sourceSize),
    renderedDefaultSize: vector(defaultBox, defaultSize),
    animations: loaded.animations.map((clip) => ({ name: clip.name, duration: Number(clip.duration.toFixed(3)) })).slice(0, 16),
    materialColors: materials.filter((mat) => mat.color).map((mat) => ({ name: mat.name, hex: mat.color })).slice(0, 16),
    materials,
    nonBackgroundPixels: pixels.nonBackgroundPixels,
    prominentRenderedColors: pixels.prominentRenderedColors,
    imageDataUrl: dataUrl,
  };
}

window.runAuditRender = async function runAuditRender(assets, options = {}) {
  const tile = options.tile || 256;
  const cols = options.cols || 5;
  const rows = options.rows || 5;
  const pageSize = cols * rows;
  const pages = [];
  const results = [];
  const totalPages = Math.ceil(assets.length / pageSize);
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const atlas = document.createElement("canvas");
    atlas.width = cols * tile;
    atlas.height = rows * (tile + 74);
    const ctx = atlas.getContext("2d");
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "top";
    for (let i = 0; i < pageSize; i += 1) {
      const index = pageIndex * pageSize + i;
      if (index >= assets.length) break;
      const asset = assets[index];
      const x = (i % cols) * tile;
      const y = Math.floor(i / cols) * (tile + 74);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 4, y + 4, tile - 8, tile - 8);
      ctx.strokeStyle = "#c8c1b6";
      ctx.strokeRect(x + 4, y + 4, tile - 8, tile - 8);
      try {
        const result = await renderOne(asset);
        const img = new Image();
        img.src = result.imageDataUrl;
        await img.decode();
        ctx.drawImage(img, x + 4, y + 4, tile - 8, tile - 8);
        delete result.imageDataUrl;
        result.atlasPage = pageIndex + 1;
        result.atlasSlot = i + 1;
        result.visualNonBlank = result.nonBackgroundPixels > 40;
        results.push(result);
        ctx.fillStyle = result.visualNonBlank ? "#111111" : "#8a2f25";
        ctx.font = "12px system-ui, sans-serif";
        drawLabel(ctx, asset.key, x + 8, y + tile + 2, tile - 16, 14);
        ctx.fillStyle = "#4a4742";
        ctx.font = "11px system-ui, sans-serif";
        const size = result.renderedDefaultSize;
        const sizeText = size ? \`\${size.x} x \${size.y} x \${size.z}m\` : "unmeasured";
        drawLabel(ctx, \`\${asset.format} · \${sizeText}\`, x + 8, y + tile + 32, tile - 16, 13);
      } catch (error) {
        const result = {
          key: asset.key,
          loaded: false,
          loadError: String(error && error.message ? error.message : error).slice(0, 500),
          atlasPage: pageIndex + 1,
          atlasSlot: i + 1,
          visualNonBlank: false,
        };
        results.push(result);
        ctx.fillStyle = "#f8dfd9";
        ctx.fillRect(x + 10, y + 10, tile - 20, tile - 20);
        ctx.fillStyle = "#8a2f25";
        ctx.font = "12px system-ui, sans-serif";
        drawLabel(ctx, asset.key, x + 14, y + 16, tile - 28, 14);
        ctx.font = "11px system-ui, sans-serif";
        drawLabel(ctx, result.loadError, x + 14, y + 48, tile - 28, 13);
      }
    }
    ctx.fillStyle = "#25221f";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(\`\${options.title || "asset atlas"} page \${pageIndex + 1}/\${totalPages}\`, 10, atlas.height - 22);
    pages.push({
      page: pageIndex + 1,
      dataUrl: atlas.toDataURL("image/png"),
    });
  }
  return { results, pages };
};
`;

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/" || url === "/index.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (url === "/audit-renderer.js") {
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
        res.end(rendererJs);
        return;
      }
      const roots = [
        ["/node_modules/", path.join(root, "node_modules")],
        ["/assets/harthmere/", path.join(root, "public/assets/harthmere")],
        [
          "/buckets/biomes-static/",
          path.join(root, "public/buckets/biomes-static"),
        ],
      ];
      for (const [prefix, dir] of roots) {
        if (url.startsWith(prefix)) {
          const rel = url.slice(prefix.length);
          serveStaticFile(res, path.join(dir, rel));
          return;
        }
      }
      res.writeHead(404);
      res.end("not found");
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}/`,
      });
    });
  });
}

async function renderAtlas(assetList, prefix, title, tile = 256) {
  const cacheFile = path.join(outDir, `${prefix}-render-results.json`);
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (Array.isArray(cached.results) && Array.isArray(cached.atlasFiles)) {
      const atlasesExist = cached.atlasFiles.every((file) => fs.existsSync(file));
      if (atlasesExist) return cached;
    }
  }
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(10 * 60 * 1000);
    await page.goto(url);
    await page.waitForFunction(() => typeof window.runAuditRender === "function");
    const rendered = await page.evaluate(
      async ({ assets, options }) => window.runAuditRender(assets, options),
      {
        assets: assetList,
        options: { cols: 5, rows: 5, tile, title },
      },
    );
    const pageFiles = [];
    for (const pageData of rendered.pages) {
      const file = path.join(
        outDir,
        `${prefix}-atlas-page-${String(pageData.page).padStart(2, "0")}.png`,
      );
      fs.writeFileSync(
        file,
        Buffer.from(pageData.dataUrl.split(",")[1], "base64"),
      );
      pageFiles.push(file);
    }
    const result = { results: rendered.results, atlasFiles: pageFiles };
    writeJson(cacheFile, result);
    return result;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function fetchBikkieSnapshot() {
  const attempts = [
    "http://127.0.0.1:3000/api/bikkie",
    "http://127.0.0.1:3001/api/bikkie",
  ];
  const errors = [];
  for (const url of attempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      json.fetchedFrom = url;
      return json;
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  return {
    error: `Could not fetch live Bikkie from local web endpoints. ${errors.join(" | ")}`,
  };
}

function cachedGoodBikkieSnapshot(snapshotFile) {
  if (!fs.existsSync(snapshotFile)) return undefined;
  try {
    const json = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    if (Array.isArray(json.encoded) && json.encoded.length) return json;
  } catch {
    return undefined;
  }
  return undefined;
}

function decodeBikkieViaNode(snapshotFile, outputFile) {
  const decodeScript = `
const fs = require("fs");
const { zrpcWebDeserialize } = require(${JSON.stringify(path.join(root, "src/shared/zrpc/serde"))});
const { zrpcDeserialize } = require(${JSON.stringify(path.join(root, "src/shared/zrpc/serde"))});
const { zBiscuit, biscuitToJson } = require(${JSON.stringify(path.join(root, "src/shared/bikkie/schema/attributes"))});
const {
  fromStoredBiscuit,
  zStoredBakedBiscuit,
  zStoredBiscuit,
} = require(${JSON.stringify(path.join(root, "src/server/shared/bikkie/storage/baked"))});
const Redis = require("ioredis");
const snapshot = JSON.parse(fs.readFileSync(${JSON.stringify(snapshotFile)}, "utf8"));
async function fromApiSnapshot() {
  const items = snapshot.encoded.map(([id, encoded]) => biscuitToJson(zrpcWebDeserialize(encoded, zBiscuit)));
  return { source: snapshot.fetchedFrom || "api", trayId: snapshot.trayId, count: items.length, items };
}
async function fromRedisBakedTray() {
  const redis = new Redis({
    host: process.env.GLITCH_REDIS_HOST || process.env.LOCAL_REDIS_HOST || process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.GLITCH_REDIS_PORT || process.env.LOCAL_REDIS_PORT || process.env.REDIS_PORT || 6379),
    db: 3,
    lazyConnect: true,
  });
  await redis.connect();
  const rawTrayId = await redis.get("baked-id");
  if (!rawTrayId) throw new Error("Redis DB 3 has no baked-id");
  const trayId = Number(String(rawTrayId).replace(/^b:/, ""));
  const keys = [];
  const stream = redis.scanStream({ match: \`baked:\${trayId}:*\`, count: 1000 });
  for await (const batch of stream) keys.push(...batch);
  const items = [];
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const values = await redis.mgetBuffer(chunk);
    for (const encoded of values) {
      if (!encoded) continue;
      const [id, hash, encodedBiscuit] = zrpcDeserialize(encoded, zStoredBakedBiscuit);
      const biscuit = fromStoredBiscuit(zrpcDeserialize(encodedBiscuit, zStoredBiscuit));
      items.push(biscuitToJson(biscuit));
    }
  }
  await redis.quit();
  items.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  return { source: "redis-db3-baked-tray", trayId, count: items.length, items };
}
(async () => {
  let out;
  if (Array.isArray(snapshot.encoded) && snapshot.encoded.length) {
    out = await fromApiSnapshot();
  } else {
    out = await fromRedisBakedTray();
    out.apiFetchError = snapshot.error;
  }
  fs.writeFileSync(${JSON.stringify(outputFile)}, JSON.stringify(out, null, 2) + "\\n");
})().catch((error) => {
  fs.writeFileSync(${JSON.stringify(outputFile)}, JSON.stringify({ error: error.message, stack: error.stack }, null, 2) + "\\n");
  process.exit(1);
});
`;
  const tmp = path.join(outDir, "decode-bikkie-tmp.cjs");
  fs.writeFileSync(tmp, decodeScript);
  const { spawnSync } = require("child_process");
  const result = spawnSync(
    "node",
    ["-r", "ts-node/register", "-r", "tsconfig-paths/register", tmp],
    { cwd: root, encoding: "utf8" },
  );
  fs.rmSync(tmp, { force: true });
  if (result.status !== 0) {
    fs.writeFileSync(
      outputFile,
      `${JSON.stringify(
        {
          error: "Bikkie decode failed",
          stdout: result.stdout,
          stderr: result.stderr,
        },
        null,
        2,
      )}\n`,
    );
  }
}

function normalizeBikkieItems(decoded) {
  const items = decoded.items || [];
  const byGalois = new Map();
  const byId = new Map();
  for (const item of items) {
    byId.set(String(item.id), item);
    if (item.galoisPath) {
      if (!byGalois.has(item.galoisPath)) byGalois.set(item.galoisPath, []);
      byGalois.get(item.galoisPath).push(item);
    }
  }
  return {
    byGalois,
    byId,
    allItems: items,
    placeableOrBlueprint: items.filter((item) => item.isPlaceable || item.isBlueprint),
    actionPlace: items.filter((item) => item.action === "place"),
    sized: items.filter((item) => item.boxSize || item.collidableSize),
  };
}

function buildBikkieSummary(item, coreAsset) {
  const boxSize = Array.isArray(item.boxSize)
    ? { x: item.boxSize[0], y: item.boxSize[1], z: item.boxSize[2] }
    : undefined;
  const collidableSize = Array.isArray(item.collidableSize)
    ? { x: item.collidableSize[0], y: item.collidableSize[1], z: item.collidableSize[2] }
    : undefined;
  const objectKind = classifyObject(
    item.displayName || item.name || String(item.id),
    item.galoisPath || "",
    item.tooltipTypeName || item.craftingCategory,
  );
  const warnings = [];
  const size = collidableSize || boxSize;
  if (!boxSize && (item.isPlaceable || item.isBlueprint)) warnings.push("missing boxSize");
  if (size) {
    const max = Math.max(size.x, size.y, size.z);
    if (max > 12) warnings.push("very large placeable bounds");
    if (size.y <= 0.15) warnings.push("very thin/low placeable bounds");
  }
  if (item.galoisPath?.startsWith("placeables/") && !coreAsset?.modelFile) {
    warnings.push("no exported core GLTF model found for galoisPath");
  }
  return {
    catalog: "bikkie_items",
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    description: item.description,
    objectKind,
    galoisPath: item.galoisPath,
    craftingCategory: item.craftingCategory,
    tooltipTypeName: item.tooltipTypeName,
    action: item.action,
    flags: {
      isPlaceable: Boolean(item.isPlaceable),
      isBlueprint: Boolean(item.isBlueprint),
      isBlock: Boolean(item.isBlock),
      isDroppable: Boolean(item.isDroppable),
      isCollidable: Boolean(item.isCollidable),
    },
    size: {
      boxSize,
      collidableSize,
      effectiveBounds: collidableSize || boxSize || (item.isBlock ? { x: 1, y: 1, z: 1 } : undefined),
    },
    assetRefs: coreAsset
      ? {
          coreRel: coreAsset.rel,
          publicModel: coreAsset.publicPath,
          publicIcon: coreAsset.iconPublicPath,
          sourceFiles: coreAsset.sourceFiles?.map((f) => f.absolutePath),
        }
      : undefined,
    turnsInto: item.turnsInto,
    station: {
      stationSupportsHandcraft: item.stationSupportsHandcraft,
      craftingStation: item.craftingStation,
      craftingTimeMs: item.craftingTimeMs,
    },
    raw: item,
    warnings,
  };
}

function assetSizeWarnings(entry) {
  const warnings = [];
  const s = entry.size?.authoredDefaultSize || entry.size?.renderedDefaultSize;
  const role = entry.semanticRole || entry.objectKind;
  const roleText = `${entry.semanticRole || ""} ${entry.objectKind || ""}`;
  const keyText = `${entry.key || ""} ${entry.sourcePath || ""}`.toLowerCase();
  if (!s) warnings.push("missing measured size");
  else {
    const max = Math.max(s.x || 0, s.y || 0, s.z || 0);
    const min = Math.min(s.x || 0, s.y || 0, s.z || 0);
    if (max >= 6 && /tiny|tabletop|tool|weapon|food|lighting|wall_or_display/.test(roleText)) {
      warnings.push("small-decor semantic role but very large measured bounds");
    }
    if (max >= 1.5 && /decorative_tiny/.test(roleText)) {
      warnings.push("decorative_tiny role but larger than expected");
    }
    if (max >= 2 && /pickaxe|axe|sword|dagger|bow|shield|staff|wand|tool|key|scroll|book|food|apple|carrot|fish|mushroom/.test(keyText)) {
      warnings.push("handheld/tabletop-looking prop appears oversized");
    }
    if (max >= 5 && /mine_|ore|coal|gold|silver|diamond|fragment|block|stone/.test(keyText) && !/architecture|actor|building|ground/.test(roleText)) {
      warnings.push("resource/voxel prop is large; verify intended world scale");
    }
    if (max >= 10 && !/architecture|actor|landmark|building|ground/.test(roleText)) {
      warnings.push("large bounds for non-architecture object");
    }
    if (min > 0 && min < 0.03 && max > 1) warnings.push("very thin axis combined with large extent");
  }
  if (entry.render?.loaded === false) warnings.push("browser render/load failed");
  if (entry.render?.loaded && !entry.render.visualNonBlank) warnings.push("rendered blank or near blank");
  const prominent = entry.colors?.prominentRenderedColors || [];
  const material = entry.colors?.materialColors || [];
  const mostlyWhite =
    prominent.length > 0 &&
    prominent.every((c) => {
      const rgb = hexToRgb(c.hex);
      return rgb && rgb.every((v) => v >= 224);
    }) &&
    material.length > 0 &&
    material.every((c) => {
      const rgb = hexToRgb(c.hex);
      return rgb && rgb.every((v) => v >= 224);
    });
  if (entry.format === "obj" && mostlyWhite) {
    warnings.push("renders mostly white/untextured; verify OBJ MTL/texture hookup");
  }
  return warnings;
}

function makeMarkdown(audit) {
  const harthmereWarnings = audit.harthmereRuntimeAssets
    .filter((a) => a.warnings?.length)
    .slice(0, 25);
  const bikkieWarnings = audit.bikkie.placeableOrBlueprintItems
    .filter((a) => a.warnings?.length)
    .slice(0, 25);
  const proceduralLines = audit.proceduralAndVoxelCatalog
    .map((entry) => `- **${entry.name}**: ${entry.description}`)
    .join("\n");
  const atlasLines = [
    ...audit.visualAtlases.harthmere.map((file) => `- Harthmere: ${path.basename(file)}`),
    ...audit.visualAtlases.core.map((file) => `- Core placeables: ${path.basename(file)}`),
  ].join("\n");
  return `# Home Decoration Item Audit v1

Generated: ${audit.generatedAt}

## System Answer

There is a home/decor-adjacent system, but it is split across two layers:

- The original Biomes placeable system lets items/blueprints become ECS placeable entities. It uses Bikkie metadata such as \`isPlaceable\`, \`isBlueprint\`, \`boxSize\`, \`collidableSize\`, and \`galoisPath\`.
- Harthmere has generated resident housing decor. Rooms are populated by authored decor arrays and runtime asset placements; this is currently world/NPC housing decoration, not a full player-facing freeform home decoration editor.

## Coverage

- Live Bikkie items decoded: ${audit.bikkie.totalItems}
- Bikkie placeable or blueprint items: ${audit.bikkie.placeableOrBlueprintItems.length}
- Bikkie \`action: "place"\` items, including blocks/florae: ${audit.bikkie.actionPlaceItems.length}
- Core exported placeable assets: ${audit.corePlaceableAssets.length}
- Harthmere runtime assets parsed from renderer: ${audit.harthmereRuntimeAssets.length}
- Harthmere assets loaded/rendered in browser: ${audit.summary.harthmereRenderedLoaded}/${audit.harthmereRuntimeAssets.length}
- Core placeable models loaded/rendered in browser: ${audit.summary.coreRenderedLoaded}/${audit.corePlaceableAssets.filter((a) => a.publicPath).length}

## Visual Atlases

${atlasLines}

## Size Watchlist

Harthmere runtime assets with warnings:

${harthmereWarnings.length ? harthmereWarnings.map((a) => `- ${a.key}: ${a.warnings.join("; ")}; size=${JSON.stringify(a.size?.authoredDefaultSize || a.size?.renderedDefaultSize)}`).join("\n") : "- None from generated heuristics."}

Bikkie placeable/blueprint items with warnings:

${bikkieWarnings.length ? bikkieWarnings.map((a) => `- ${a.displayName || a.name}: ${a.warnings.join("; ")}; box=${JSON.stringify(a.size?.boxSize)} collidable=${JSON.stringify(a.size?.collidableSize)} galoisPath=${a.galoisPath || "none"}`).join("\n") : "- None from generated heuristics."}

## Resident Housing Decor

- Residential room decor items: ${audit.homeDecor.residentialDecor.map((d) => `${d.asset} (${d.role})`).join(", ")}
- Slum room decor items: ${audit.homeDecor.slumDecor.map((d) => `${d.asset} (${d.role})`).join(", ")}
- Housing buildings parsed: ${audit.homeDecor.housingBuildings.length}
- Resident/slum room capacity parsed from building definitions: ${audit.homeDecor.totalRooms}

## Procedural / Voxel Generated Catalog

${proceduralLines}

## Files

- \`home-decoration-item-audit-v1.json\`: full merged metadata, raw Bikkie snapshots, render measurements, colors, descriptions, warnings.
- \`harthmere-runtime-assets.csv\`: spreadsheet-friendly Harthmere asset table.
- \`bikkie-placeable-items.csv\`: spreadsheet-friendly Bikkie placeable/blueprint table.
- \`core-placeable-assets.csv\`: exported core placeable asset table.
- \`bikkie-all-items-raw.json\`: all decoded live Bikkie item metadata.

`;
}

function csvFromRows(rows, columns) {
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const value = column.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), row);
          return escapeCsv(
            typeof value === "object" && value !== null ? JSON.stringify(value) : value,
          );
        })
        .join(","),
    ),
  ].join("\n") + "\n";
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  console.log("Parsing Harthmere runtime assets...");
  const assetsSource = fs.readFileSync(sourceAssetsFile, "utf8");
  const residentSource = fs.readFileSync(residentHousingFile, "utf8");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const manifestAssets = manifest.assets || {};
  const harthmereAssets = parseRuntimeAssets(assetsSource);
  const coreAssets = collectCoreAssetFiles();

  console.log(`Rendering ${harthmereAssets.length} Harthmere assets...`);
  const harthmereRender = await renderAtlas(
    harthmereAssets,
    "harthmere-runtime-assets",
    "Harthmere runtime assets",
  );
  const renderByKey = new Map(harthmereRender.results.map((r) => [r.key, r]));

  const coreRenderable = coreAssets.filter((asset) => asset.publicPath);
  console.log(`Rendering ${coreRenderable.length} core placeable models...`);
  const coreRender = await renderAtlas(
    coreRenderable,
    "core-placeable-models",
    "Core Biomes placeable models",
  );
  const coreRenderByKey = new Map(coreRender.results.map((r) => [r.key, r]));

  console.log("Fetching and decoding live Bikkie catalog...");
  const bikkieSnapshotFile = path.join(outDir, "bikkie-live-api-encoded.json");
  const bikkieDecodedFile = path.join(outDir, "bikkie-all-items-raw.json");
  const existingGoodSnapshot = cachedGoodBikkieSnapshot(bikkieSnapshotFile);
  const fetchedSnapshot = await fetchBikkieSnapshot();
  writeJson(
    bikkieSnapshotFile,
    Array.isArray(fetchedSnapshot.encoded) && fetchedSnapshot.encoded.length
      ? fetchedSnapshot
      : existingGoodSnapshot || fetchedSnapshot,
  );
  decodeBikkieViaNode(bikkieSnapshotFile, bikkieDecodedFile);
  const bikkieDecoded = JSON.parse(fs.readFileSync(bikkieDecodedFile, "utf8"));
  const bikkie = normalizeBikkieItems(bikkieDecoded);
  const coreByGalois = new Map(coreAssets.map((asset) => [asset.galoisPath, asset]));

  const enrichedCoreAssets = coreAssets.map((asset) => {
    const render = coreRenderByKey.get(asset.key);
    const linkedItems = bikkie.byGalois.get(asset.galoisPath) || [];
    const entry = {
      ...asset,
      objectKind: classifyObject(asset.key, asset.galoisPath),
      linkedBikkieItemIds: linkedItems.map((item) => item.id),
      linkedBikkieDisplayNames: linkedItems.map((item) => item.displayName || item.name),
      size: {
        renderedDefaultSize: vectorRound(render?.renderedDefaultSize),
        sourceSize: vectorRound(render?.sourceSize),
      },
      colors: {
        materialColors: render?.materialColors || [],
        prominentRenderedColors: render?.prominentRenderedColors || [],
      },
      render,
    };
    entry.description = describeAsset(entry);
    entry.warnings = assetSizeWarnings(entry);
    return entry;
  });

  const enrichedHarthmereAssets = harthmereAssets.map((asset) => {
    const manifestEntry = manifestAssets[asset.key] || {};
    const render = renderByKey.get(asset.key);
    const size = {
      sourceSize: vectorRound(manifestEntry.sourceSize) || vectorRound(render?.sourceSize),
      authoredDefaultSize:
        vectorRound(manifestEntry.authoredDefaultSize) ||
        vectorRound(render?.renderedDefaultSize),
      renderedDefaultSize: vectorRound(render?.renderedDefaultSize),
      manifestDefaultScale: manifestEntry.defaultScale,
      rendererDefaultScale: asset.defaultScale,
      collisionFootprint: manifestEntry.collisionFootprint,
    };
    const entry = {
      ...asset,
      semanticRole: manifestEntry.semanticRole,
      objectKind: classifyObject(asset.key, asset.sourcePath, manifestEntry.semanticRole),
      file: {
        publicPath: asset.publicPath,
        exists: manifestEntry.exists,
        sourceBytes: manifestEntry.sourceBytes,
        sourceSha1: manifestEntry.sourceSha1,
      },
      size,
      colors: {
        materialColors: render?.materialColors || [],
        prominentRenderedColors: render?.prominentRenderedColors || [],
      },
      animations: render?.animations || [],
      render,
      manifest: manifestEntry,
    };
    entry.description = describeAsset(entry);
    entry.warnings = assetSizeWarnings(entry);
    return entry;
  });

  const bikkiePlaceable = bikkie.placeableOrBlueprint.map((item) =>
    buildBikkieSummary(item, coreByGalois.get(item.galoisPath)),
  );
  const bikkieActionPlace = bikkie.actionPlace.map((item) =>
    buildBikkieSummary(item, coreByGalois.get(item.galoisPath)),
  );
  const bikkieSized = bikkie.sized.map((item) =>
    buildBikkieSummary(item, coreByGalois.get(item.galoisPath)),
  );

  const residentialDecor = parseDecorArray(
    residentSource,
    "HARTHMERE_RESIDENTIAL_ROOM_DECOR_V38",
  );
  const slumDecor = parseDecorArray(residentSource, "HARTHMERE_SLUM_ROOM_DECOR_V38");
  const housingBuildings = parseHousingCounts(residentSource);
  const totalRooms = housingBuildings.reduce((sum, building) => sum + building.roomCount, 0);
  const roomDecorAssets = [...new Set([...residentialDecor, ...slumDecor].map((d) => d.asset))];

  const buildingSystemSource = fs.readFileSync(buildingSystemFile, "utf8");
  const townBlockSource = fs.readFileSync(townBlockFile, "utf8");
  const blueprintIds = [
    ...buildingSystemSource.matchAll(/blueprintId:\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  const proceduralAndVoxelCatalog = [
    {
      name: "Core .vox-authored placeables",
      source: "src/galois/data/placeables",
      itemCount: coreAssets.length,
      description:
        "Legacy Biomes placeables are authored from voxel/source assets and exported as GLTF/icon assets for the placeable ECS system.",
      examples: coreAssets.slice(0, 24).map((a) => a.rel),
    },
    {
      name: "Harthmere resident room decor placements",
      source: "resident_housing_v38.ts + harthmere_assets.ts",
      itemCount: roomDecorAssets.length,
      description:
        "NPC home rooms procedurally receive beds, storage, lights, tables, personal objects, and wall hangings from resident/slum decor arrays.",
      examples: roomDecorAssets,
    },
    {
      name: "Procedural jobs board kiosks",
      source: "harthmere_jobs_board_marker_v144.ts",
      itemCount: 2,
      description:
        "Two jobs board kiosks are generated entirely from Three.js boxes/lights: Grove market and town market boards.",
    },
    {
      name: "Procedural quest object markers",
      source: "harthmere_quest_object_markers_v145.ts",
      description:
        "Quest-linked landmarks generate lightweight object meshes from boxes, cylinders, torus rings, flags, crates, ledgers, boards, paint pots, routes, material clusters, and active beacons.",
    },
    {
      name: "Player voxel building blueprints",
      source: "building_system_v1.ts",
      itemCount: blueprintIds.length,
      description:
        "Player buildings are defined as solid voxel structures; GLTFs may decorate, but the authoritative building geometry is generated as voxel foundation/floor/walls/roof/stair/door pieces.",
      examples: blueprintIds,
    },
    {
      name: "Block-built service and town shells",
      source: "town_block_build_v1.ts + harthmere_assets.ts",
      description:
        "Town/service buildings are generated from 1m block wall and floor slab contracts with entrance clearances and story heights.",
      evidence: {
        hasBlockWallContract: /generate.*wall|block positions|floor slab/i.test(townBlockSource),
      },
    },
    {
      name: "Procedural voxel actors",
      source: "voxel_faces.ts + harthmere_assets.ts",
      description:
        "Townsperson and animal proxies can be generated from rounded voxel body/head/face/clothing primitives before or instead of GLTF attachments.",
    },
    {
      name: "Imported Harthmere voxel packs",
      source: "public/assets/harthmere/manifest/voxel-*.txt and obj/medieval_voxel",
      description:
        "Imported voxel pack assets include mines, graveyard props, itch props, large trees, wild-west props, Kenney voxel pack files, and medieval voxel OBJ structures.",
    },
  ];

  const audit = {
    auditVersion: AUDIT_VERSION,
    generatedAt,
    repoRoot: root,
    homeDecorationSystem: {
      answer: true,
      summary:
        "Core Biomes supports placeable items and blueprints; Harthmere supports generated resident room decor and voxel/block building systems. A full player-facing freeform home decoration editor is not apparent in the inspected code.",
      coreSystemFiles: [
        "src/client/game/interact/items/placeable.ts",
        "src/server/logic/utils/placeables.ts",
        "src/shared/game/placeables.ts",
        "src/client/game/renderers/placeables.ts",
      ],
      harthmereSystemFiles: [
        "src/shared/harthmere/resident_housing_v38.ts",
        "src/client/game/renderers/local_dev/harthmere_assets.ts",
        "src/shared/harthmere/building_system_v1.ts",
        "src/shared/harthmere/town_block_build_v1.ts",
      ],
    },
    summary: {
      harthmereRenderedLoaded: harthmereRender.results.filter((r) => r.loaded).length,
      harthmereRenderFailures: harthmereRender.results.filter((r) => !r.loaded).length,
      coreRenderedLoaded: coreRender.results.filter((r) => r.loaded).length,
      coreRenderFailures: coreRender.results.filter((r) => !r.loaded).length,
      harthmereWarningCount: enrichedHarthmereAssets.filter((a) => a.warnings.length).length,
      bikkiePlaceableWarningCount: bikkiePlaceable.filter((a) => a.warnings.length).length,
      coreWarningCount: enrichedCoreAssets.filter((a) => a.warnings.length).length,
    },
    visualAtlases: {
      harthmere: harthmereRender.atlasFiles,
      core: coreRender.atlasFiles,
    },
    homeDecor: {
      residentialDecor,
      slumDecor,
      roomDecorAssets,
      housingBuildings,
      totalRooms,
    },
    harthmereManifest: {
      path: manifestFile,
      version: manifest.version,
      generatedAt: manifest.generatedAt,
    },
    harthmereRuntimeAssets: enrichedHarthmereAssets,
    corePlaceableAssets: enrichedCoreAssets,
    bikkie: {
      trayId: bikkieDecoded.trayId,
      totalItems: bikkie.allItems.length,
      placeableOrBlueprintItems: bikkiePlaceable,
      actionPlaceItems: bikkieActionPlace,
      sizedItems: bikkieSized,
      rawSnapshotFile: bikkieDecodedFile,
    },
    proceduralAndVoxelCatalog,
  };

  writeJson(path.join(outDir, "home-decoration-item-audit-v1.json"), audit);
  fs.writeFileSync(
    path.join(outDir, "harthmere-runtime-assets.csv"),
    csvFromRows(enrichedHarthmereAssets, [
      "key",
      "format",
      "sourcePath",
      "defaultScale",
      "semanticRole",
      "objectKind",
      "description",
      "size.sourceSize",
      "size.authoredDefaultSize",
      "size.renderedDefaultSize",
      "colors.materialColors",
      "colors.prominentRenderedColors",
      "animations",
      "warnings",
    ]),
  );
  fs.writeFileSync(
    path.join(outDir, "bikkie-placeable-items.csv"),
    csvFromRows(bikkiePlaceable, [
      "id",
      "displayName",
      "name",
      "description",
      "objectKind",
      "galoisPath",
      "craftingCategory",
      "tooltipTypeName",
      "action",
      "flags",
      "size.boxSize",
      "size.collidableSize",
      "assetRefs.publicModel",
      "assetRefs.publicIcon",
      "warnings",
    ]),
  );
  fs.writeFileSync(
    path.join(outDir, "core-placeable-assets.csv"),
    csvFromRows(enrichedCoreAssets, [
      "key",
      "galoisPath",
      "rel",
      "format",
      "objectKind",
      "description",
      "size.sourceSize",
      "size.renderedDefaultSize",
      "publicPath",
      "iconPublicPath",
      "linkedBikkieDisplayNames",
      "warnings",
    ]),
  );
  fs.writeFileSync(
    path.join(outDir, "home-decoration-item-audit-v1.md"),
    makeMarkdown(audit),
  );
  console.log("Wrote audit:");
  console.log(path.join(outDir, "home-decoration-item-audit-v1.md"));
  console.log(path.join(outDir, "home-decoration-item-audit-v1.json"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
