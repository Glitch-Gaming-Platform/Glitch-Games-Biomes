#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(
  ROOT,
  "src/galois/data/harthmere/used_assets.generated.json"
);
const HARTHMERE_ASSETS = path.join(ROOT, "public/assets/harthmere");
const HARTHMERE_MODELS = path.join(ROOT, "public/models/harthmere");

const entries = new Map();

function normalizePublicUrl(raw) {
  let value = String(raw)
    .trim()
    .replace(/[?#].*$/, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the authored string if it is not URI encoded.
  }
  return value;
}

function logicalPathForPublicUrl(publicUrl) {
  if (publicUrl.startsWith("/assets/harthmere/")) {
    return `harthmere/${publicUrl.slice("/assets/harthmere/".length)}`;
  }
  if (publicUrl.startsWith("/models/harthmere/")) {
    return `harthmere/models/${publicUrl.slice("/models/harthmere/".length)}`;
  }
  return undefined;
}

function sourceFileForPublicUrl(publicUrl) {
  if (publicUrl.startsWith("/assets/harthmere/")) {
    return path.join(ROOT, "public", publicUrl.slice(1));
  }
  if (publicUrl.startsWith("/models/harthmere/")) {
    return path.join(ROOT, "public", publicUrl.slice(1));
  }
  return undefined;
}

function workspaceSourcePath(absolutePath) {
  return path
    .relative(path.join(ROOT, "src/galois/data"), absolutePath)
    .split(path.sep)
    .join("/");
}

function convertedPathFor(logicalPath) {
  return `harthmere/legacy_converted/${logicalPath.slice("harthmere/".length)}.glb`;
}

function classifyFile(absolutePath) {
  switch (path.extname(absolutePath).toLowerCase()) {
    case ".glb":
      return "glb";
    case ".gltf":
      return "gltf";
    case ".obj":
      return "obj";
    case ".fbx":
      return "fbx";
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".webp":
      return "image";
    default:
      return undefined;
  }
}

function addPublicUrl(rawUrl, usedBy) {
  const publicUrl = normalizePublicUrl(rawUrl);
  const logicalPath = logicalPathForPublicUrl(publicUrl);
  let absolutePath = sourceFileForPublicUrl(publicUrl);
  if (!logicalPath || !absolutePath) {
    return;
  }

  // OBJ catalogue entries intentionally omit their extension because the old
  // runtime loader appended .obj and .mtl itself.
  if (!path.extname(absolutePath) && fs.existsSync(`${absolutePath}.obj`)) {
    absolutePath = `${absolutePath}.obj`;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return;
  }

  const kind = classifyFile(absolutePath);
  if (!kind) {
    return;
  }
  const existing = entries.get(logicalPath);
  if (existing) {
    if (!existing.usedBy.includes(usedBy)) {
      existing.usedBy.push(usedBy);
    }
    return;
  }

  entries.set(logicalPath, {
    logicalPath,
    publicUrl,
    sourcePath: workspaceSourcePath(absolutePath),
    kind,
    ...(kind === "obj" || kind === "fbx"
      ? { convertedPath: convertedPathFor(logicalPath) }
      : {}),
    usedBy: [usedBy],
  });
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const result = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const candidate = path.join(directory, name);
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      result.push(...walkFiles(candidate));
    } else if (stat.isFile()) {
      result.push(candidate);
    }
  }
  return result;
}

function publicUrlForFile(absolutePath) {
  const publicRelative = path.relative(path.join(ROOT, "public"), absolutePath);
  return `/${publicRelative.split(path.sep).join("/")}`;
}

function addDirectory(
  directory,
  usedBy,
  acceptedExtensions = new Set([".glb"])
) {
  for (const file of walkFiles(path.join(ROOT, directory))) {
    if (acceptedExtensions.has(path.extname(file).toLowerCase())) {
      addPublicUrl(publicUrlForFile(file), usedBy);
    }
  }
}

function countQuotedOccurrences(source, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (source.match(new RegExp(`["']${escaped}["']`, "g")) ?? []).length;
}

function addUsedMainCatalogueAssets() {
  const filename = path.join(
    ROOT,
    "src/client/game/renderers/local_dev/harthmere_assets.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const records = [];

  for (const match of source.matchAll(
    /\b(gltf|fbx)\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs
  )) {
    records.push({
      key: match[2],
      publicUrl: `/assets/harthmere/${match[3]}`,
    });
  }
  for (const match of source.matchAll(
    /\bobj\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/gs
  )) {
    records.push({
      key: match[1],
      publicUrl: `/assets/harthmere/obj/${match[2]}/${match[3]}`,
    });
  }

  for (const record of records) {
    if (countQuotedOccurrences(source, record.key) > 1) {
      addPublicUrl(record.publicUrl, `runtime catalogue:${record.key}`);
    }
  }
}

function addChapterOneDecorAssets() {
  const filename = path.join(ROOT, "src/shared/harthmere/ch1_dungeon_decor.ts");
  const source = fs.readFileSync(filename, "utf8");
  for (const match of source.matchAll(
    /asset:\s*["']([^"']+)["'][\s\S]{0,300}?pack:\s*["']([^"']+)["']/g
  )) {
    const [, asset, pack] = match;
    if (pack !== "itch_voxel_asset_pack") {
      addPublicUrl(
        `/assets/harthmere/obj/${pack}/${asset}`,
        "chapter 1 dungeon decor"
      );
    }
  }
}

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, output);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStrings(child, output);
  }
  return output;
}

function addRuntimeJsonManifest(relativePath) {
  const filename = path.join(ROOT, relativePath);
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  for (const value of collectStrings(data)) {
    if (
      value.startsWith("/assets/harthmere/") ||
      value.startsWith("/models/harthmere/")
    ) {
      addPublicUrl(value, relativePath);
    }
  }
}

function addPremiumWeaponInventoryIcons() {
  const relativePath = "public/assets/harthmere/glb/weapons/manifest.json";
  const filename = path.join(ROOT, relativePath);
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  for (const weapon of data.weapons ?? []) {
    addPublicUrl(
      weapon.inventoryIconUrl,
      "premium weapon inventory presentation"
    );
  }
}

function isRuntimeSourceFile(relativePath) {
  return (
    /\.(?:ts|tsx)$/.test(relativePath) &&
    !/(?:^|\/)(?:test|__tests__)(?:\/|$)/.test(relativePath) &&
    !/\.test\.[^.]+$/.test(relativePath) &&
    !relativePath.endsWith("uploaded_asset_dimensions.ts") &&
    !relativePath.endsWith("harthmere_assets.ts") &&
    !relativePath.endsWith("galois_asset_paths.ts")
  );
}

function addLiteralRuntimeReferences() {
  const sourceRoots = ["src/client", "src/shared/harthmere", "src/server"];
  const literalPattern =
    /(["'`])((?:\/assets\/harthmere\/|\/models\/harthmere\/)[^"'`$\r\n]+)\1/g;
  for (const sourceRoot of sourceRoots) {
    for (const filename of walkFiles(path.join(ROOT, sourceRoot))) {
      const relativePath = path
        .relative(ROOT, filename)
        .split(path.sep)
        .join("/");
      if (!isRuntimeSourceFile(relativePath)) {
        continue;
      }
      const source = fs.readFileSync(filename, "utf8");
      for (const match of source.matchAll(literalPattern)) {
        addPublicUrl(match[2], relativePath);
      }
    }
  }
}

function addBossWorldVariants() {
  const bossDir = path.join(HARTHMERE_ASSETS, "glb/bosses");
  for (const entry of [...entries.values()]) {
    if (!entry.publicUrl.startsWith("/assets/harthmere/glb/bosses/")) {
      continue;
    }
    const basename = path.basename(entry.publicUrl, ".glb");
    if (basename.endsWith("_world")) {
      continue;
    }
    const world = path.join(bossDir, `${basename}_world.glb`);
    if (fs.existsSync(world)) {
      addPublicUrl(publicUrlForFile(world), "boss world renderer");
    }
  }
}

addUsedMainCatalogueAssets();
addChapterOneDecorAssets();
addLiteralRuntimeReferences();
addPremiumWeaponInventoryIcons();

for (const manifest of [
  "public/assets/harthmere/manifest/business-interiors.json",
  "public/assets/harthmere/manifest/business-furniture-catalogue.json",
  "public/assets/harthmere/manifest/world-interaction-graphics.json",
]) {
  addRuntimeJsonManifest(manifest);
}

// These directories are selected dynamically by IDs or appearance options at
// runtime, so every model in the directory is reachable game content.
for (const directory of [
  "public/assets/harthmere/glb/creatures/animals",
  "public/assets/harthmere/glb/weapons",
  "public/assets/harthmere/glb/projectiles",
  "public/assets/harthmere/glb/boss_attack_shapes",
  "public/assets/harthmere/glb/items/chapter1",
  "public/assets/harthmere/glb/items/grove",
  "public/assets/harthmere/glb/creatures/stagger",
]) {
  addDirectory(directory, `dynamic runtime family:${directory}`);
}
addDirectory(
  "public/assets/harthmere/gltf/characters/player_body_variants",
  "dynamic player appearance family",
  new Set([".gltf"])
);

addBossWorldVariants();

const generated = [...entries.values()]
  .map((entry) => ({ ...entry, usedBy: entry.usedBy.sort() }))
  .sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));

const output = `${JSON.stringify(
  {
    version: 1,
    generatedBy: "scripts/harthmere/build-galois-used-asset-manifest.cjs",
    entries: generated,
  },
  null,
  2
)}\n`;
const checking = process.argv.includes("--check");
if (checking) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) {
    console.error(
      `${path.relative(ROOT, OUTPUT)} is stale. Run node ${path.relative(
        ROOT,
        __filename
      )}`
    );
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, output);
}

const counts = Object.fromEntries(
  [...new Set(generated.map((entry) => entry.kind))]
    .sort()
    .map((kind) => [
      kind,
      generated.filter((entry) => entry.kind === kind).length,
    ])
);
console.log(
  `${checking ? "Checked" : "Wrote"} ${path.relative(ROOT, OUTPUT)} with ${
    generated.length
  } used assets: ${JSON.stringify(counts)}`
);
