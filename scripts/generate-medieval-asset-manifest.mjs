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

function uniqueKey(base, used) {
  let key = base || "asset";
  let i = 2;

  while (used.has(key)) {
    key = `${base}_${i}`;
    i += 1;
  }

  used.add(key);
  return key;
}

function toPublicUrl(publicRoot, relToAssetRoot) {
  return `${publicRoot}/${relToAssetRoot
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

const manifest = {};
const allAssets = [];
const usedKeysByPack = {};

for (const pack of packs) {
  const fullPackPath = path.join(pack.fileRoot, pack.root);
  const files = walk(fullPackPath).filter((file) =>
    pack.extensions.includes(path.extname(file).toLowerCase())
  );

  usedKeysByPack[pack.key] = new Set();
  manifest[pack.key] = {};

  for (const file of files) {
    const relToAssetRoot = path
      .relative(pack.fileRoot, file)
      .split(path.sep)
      .join("/");

    const ext = path.extname(file).toLowerCase();
    const base = cleanKey(file);
    const key = uniqueKey(base, usedKeysByPack[pack.key]);

    manifest[pack.key][key] = {
      key,
      pack: pack.key,
      type: pack.type,
      format: ext.replace(".", ""),
      path: relToAssetRoot,
      url: toPublicUrl(pack.publicRoot, relToAssetRoot),
    };

    allAssets.push(manifest[pack.key][key]);
  }
}

const generatedAt = new Date().toISOString();

const output = `// Auto-generated by scripts/generate-medieval-asset-manifest.mjs
// Generated at: ${generatedAt}
// Do not hand-edit. Re-run the generator after adding/removing medieval assets.

export type MedievalAssetType = "model" | "icon";

export type MedievalAsset = {
  key: string;
  pack: string;
  type: MedievalAssetType;
  format: string;
  path: string;
  url: string;
};

export const MEDIEVAL_ASSET_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;

export const MEDIEVAL_ALL_ASSETS: MedievalAsset[] = ${JSON.stringify(allAssets, null, 2)};

export const MEDIEVAL_MODEL_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.type === "model"
);

export const MEDIEVAL_ICON_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.type === "icon"
);

export const MEDIEVAL_GLTF_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.format === "gltf" || asset.format === "glb"
);

export const MEDIEVAL_FBX_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.format === "fbx"
);

export const MEDIEVAL_OBJ_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.format === "obj"
);

export const MEDIEVAL_VOX_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.format === "vox"
);

export const MEDIEVAL_HARTHMERE_ASSETS: MedievalAsset[] = MEDIEVAL_ALL_ASSETS.filter(
  (asset) => asset.url.startsWith("/assets/harthmere/")
);
`;

const outPath = path.join(root, "src/shared/game/medieval/medievalAssetManifest.generated.ts");

fs.writeFileSync(outPath, output);

console.log(`Wrote ${outPath}`);
console.log(`Total assets: ${allAssets.length}`);
console.log(`GLTF/GLB assets: ${allAssets.filter((a) => a.format === "gltf" || a.format === "glb").length}`);
console.log(`FBX assets: ${allAssets.filter((a) => a.format === "fbx").length}`);
console.log(`OBJ assets: ${allAssets.filter((a) => a.format === "obj").length}`);
console.log(`VOX assets: ${allAssets.filter((a) => a.format === "vox").length}`);
console.log(`Icon assets: ${allAssets.filter((a) => a.type === "icon").length}`);
console.log(`Harthmere assets: ${allAssets.filter((a) => a.url.startsWith("/assets/harthmere/")).length}`);
