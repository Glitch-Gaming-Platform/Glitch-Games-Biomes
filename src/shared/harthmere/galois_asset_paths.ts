import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";

const HARTHMERE_ASSET_PREFIX = "/assets/harthmere/";
const HARTHMERE_MODEL_PREFIX = "/models/harthmere/";

export function harthmereGaloisAssetPath(path: string) {
  if (path.startsWith(HARTHMERE_ASSET_PREFIX)) {
    return `harthmere/${path.slice(HARTHMERE_ASSET_PREFIX.length)}`;
  }
  if (path.startsWith(HARTHMERE_MODEL_PREFIX)) {
    return `harthmere/models/${path.slice(HARTHMERE_MODEL_PREFIX.length)}`;
  }
  return path;
}

/**
 * Resolve a Harthmere source URL through the generated Galois asset index.
 * During asset-authoring work the source URL remains a safe fallback until the
 * corresponding local export has been generated.
 */
export function resolveHarthmereAssetUrl(path: string) {
  const logicalPath = harthmereGaloisAssetPath(path);
  return resolveAssetUrlUntyped(logicalPath) ?? path;
}
