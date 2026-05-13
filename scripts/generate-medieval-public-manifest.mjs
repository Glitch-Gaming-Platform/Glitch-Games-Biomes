import fs from "fs";
import path from "path";

const root = process.cwd();
const assetRoot = path.join(root, "public/buckets/biomes-static/asset_data");

const packs = [
  {
    key: "kaykitForestNature",
    type: "model",
    root: "glb/vendor/kaykit_forest_nature",
    extensions: [".gltf", ".glb"],
  },
  {
    key: "fantasyPropsMegaKit",
    type: "model",
    root: "glb/vendor/fantasy_props_megakit",
    extensions: [".gltf", ".glb"],
  },
  {
    key: "farmAnimalsQuaternius",
    type: "model",
    root: "glb/vendor/farm_animals_quaternius",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "ultimateFoodPack",
    type: "model",
    root: "glb/vendor/ultimate_food_pack",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "ultimateRpgItems",
    type: "model",
    root: "glb/vendor/ultimate_rpg_items",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "kenneyGameIcons",
    type: "icon",
    root: "icons/vendor/kenney_game_icons",
    extensions: [".png", ".svg"],
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else {
      out.push(fullPath);
    }
  }

  return out;
}

function cleanKey(filePath) {
  return path
    .basename(filePath)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

const assets = [];

for (const pack of packs) {
  const fullPackPath = path.join(assetRoot, pack.root);
  const files = walk(fullPackPath).filter((file) =>
    pack.extensions.includes(path.extname(file).toLowerCase())
  );

  const used = new Set();

  for (const file of files) {
    const relToAssetRoot = path
      .relative(assetRoot, file)
      .split(path.sep)
      .join("/");

    const ext = path.extname(file).toLowerCase().replace(".", "");
    const baseKey = cleanKey(file) || "asset";

    let key = baseKey;
    let i = 2;

    while (used.has(key)) {
      key = `${baseKey}_${i}`;
      i += 1;
    }

    used.add(key);

    assets.push({
      key,
      pack: pack.key,
      type: pack.type,
      format: ext,
      path: relToAssetRoot,
      url: `/buckets/biomes-static/asset_data/${relToAssetRoot}`,
      browserSafe: ["gltf", "glb", "png", "svg"].includes(ext),
      needsSpecialLoader: ["fbx", "obj"].includes(ext),
    });
  }
}

const outDir = path.join(assetRoot, "manifests");
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, "medieval-assets.json");

fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: assets.length,
      counts: {
        gltfOrGlb: assets.filter((a) => a.format === "gltf" || a.format === "glb").length,
        fbx: assets.filter((a) => a.format === "fbx").length,
        obj: assets.filter((a) => a.format === "obj").length,
        icons: assets.filter((a) => a.type === "icon").length,
        browserSafe: assets.filter((a) => a.browserSafe).length,
        needsSpecialLoader: assets.filter((a) => a.needsSpecialLoader).length,
      },
      assets,
    },
    null,
    2
  )
);

console.log(`Wrote ${outPath}`);
console.log(`Total assets: ${assets.length}`);
