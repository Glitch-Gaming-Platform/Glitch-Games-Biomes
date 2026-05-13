import fs from "fs";
import path from "path";

const root = process.cwd();

const bucketAssetRoot = path.join(root, "public/buckets/biomes-static/asset_data");
const harthmereAssetRoot = path.join(root, "public/assets/harthmere");

const packs = [
  {
    key: "kaykitForestNature",
    type: "model",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "glb/vendor/kaykit_forest_nature",
    extensions: [".gltf", ".glb"],
  },
  {
    key: "fantasyPropsMegaKit",
    type: "model",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "glb/vendor/fantasy_props_megakit",
    extensions: [".gltf", ".glb"],
  },
  {
    key: "farmAnimalsQuaternius",
    type: "model",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "glb/vendor/farm_animals_quaternius",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "ultimateFoodPack",
    type: "model",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "glb/vendor/ultimate_food_pack",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "ultimateRpgItems",
    type: "model",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "glb/vendor/ultimate_rpg_items",
    extensions: [".gltf", ".glb", ".fbx", ".obj"],
  },
  {
    key: "kenneyGameIcons",
    type: "icon",
    fileRoot: bucketAssetRoot,
    publicRoot: "/buckets/biomes-static/asset_data",
    root: "icons/vendor/kenney_game_icons",
    extensions: [".png", ".svg"],
  },
  {
    key: "harthmereVoxelMines",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "glb/environment/mines/kyrises_voxel_mines",
    extensions: [".glb"],
  },
  {
    key: "harthmereVoxelMinesFbx",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "fbx/environment/mines/kyrises_voxel_mines",
    extensions: [".fbx"],
  },
  {
    key: "harthmereVoxelMinesObj",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "obj/environment/mines/kyrises_voxel_mines",
    extensions: [".obj"],
  },
  {
    key: "harthmereVoxelMinesVox",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "vox/environment/mines/kyrises_voxel_mines",
    extensions: [".vox"],
  },
  {
    key: "harthmereVoxelGraveyardObj",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "obj/environment/graveyard/voxel_graveyard",
    extensions: [".obj"],
  },
  {
    key: "harthmereVoxelGraveyardVox",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "vox/environment/graveyard/voxel_graveyard",
    extensions: [".vox"],
  },
  {
    key: "harthmereLargeTreeObj",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "obj/environment/trees/large_tree",
    extensions: [".obj"],
  },
  {
    key: "harthmereLargeTreeVox",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "vox/environment/trees/large_tree",
    extensions: [".vox"],
  },
  {
    key: "harthmereWildWestFbx",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "fbx/environment/wild_west/wild_west_asset_pack",
    extensions: [".fbx"],
  },
  {
    key: "harthmereItchVoxelProps",
    type: "model",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "vox/props/itch_voxel_asset_pack",
    extensions: [".vox"],
  },
  {
    key: "harthmereKenneyVoxelSprites",
    type: "icon",
    fileRoot: harthmereAssetRoot,
    publicRoot: "/assets/harthmere",
    root: "png/kenney",
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

function toPublicUrl(publicRoot, relToAssetRoot) {
  return `${publicRoot}/${relToAssetRoot
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

const assets = [];

for (const pack of packs) {
  const fullPackPath = path.join(pack.fileRoot, pack.root);
  const files = walk(fullPackPath).filter((file) =>
    pack.extensions.includes(path.extname(file).toLowerCase())
  );

  const used = new Set();

  for (const file of files) {
    const relToAssetRoot = path
      .relative(pack.fileRoot, file)
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
      url: toPublicUrl(pack.publicRoot, relToAssetRoot),
      browserSafe: ["gltf", "glb", "png", "svg"].includes(ext),
      needsSpecialLoader: ["fbx", "obj", "vox"].includes(ext),
    });
  }
}

const outDir = path.join(bucketAssetRoot, "manifests");
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
        vox: assets.filter((a) => a.format === "vox").length,
        icons: assets.filter((a) => a.type === "icon").length,
        harthmere: assets.filter((a) => a.url.startsWith("/assets/harthmere/")).length,
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
