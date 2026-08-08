import * as l from "@/galois/lang";
import manifest from "../../data/harthmere/used_assets.generated.json";

type HarthmereUsedAsset = {
  logicalPath: string;
  sourcePath: string;
  kind: "glb" | "gltf" | "obj" | "fbx" | "image";
  convertedPath?: string;
};

const usedAssets = manifest.entries as HarthmereUsedAsset[];

function materializeUsedAsset(entry: HarthmereUsedAsset): l.Asset {
  switch (entry.kind) {
    case "glb":
    case "gltf":
      return l.CompressGLTF(l.LoadGLTF(entry.sourcePath));
    case "obj":
    case "fbx":
      return l.CompressGLTF(l.LoadGLTF(entry.convertedPath!));
    case "image":
      return l.ToPNG(l.ImageRGBA(entry.sourcePath));
  }
}

export function getAssets(): Record<string, l.Asset> {
  return Object.fromEntries(
    usedAssets.map((entry) => [entry.logicalPath, materializeUsedAsset(entry)])
  );
}
