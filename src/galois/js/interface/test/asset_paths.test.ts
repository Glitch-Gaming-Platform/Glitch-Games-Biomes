import {
  assetPaths,
  resolveAssetPath,
  resolveAssetUrl,
} from "@/galois/interface/asset_paths";
import assetVersions from "@/galois/interface/gen/asset_versions.json";
import assert from "assert";

describe("Galois published asset index", () => {
  it("is sorted and maps logical names to content-addressed files", () => {
    const paths = assetPaths();
    const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));

    assert(paths.length > 0);
    assert.deepStrictEqual(paths, sortedPaths);

    for (const path of paths) {
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(
        resolveAssetPath(path),
        new RegExp(`^asset_data/${escapedPath}\\.[0-9a-f]{32}\\.[^/]+$`),
        `Unexpected published path for ${path}`
      );
    }
  });

  it("resolves URLs from the configured static prefix", () => {
    const previous = process.env.GALOIS_STATIC_PREFIX;
    const path = assetPaths()[0];
    process.env.GALOIS_STATIC_PREFIX = "https://assets.example/";

    try {
      assert.strictEqual(
        resolveAssetUrl(path),
        `https://assets.example/${assetVersions.paths[path]}`
      );
    } finally {
      if (previous === undefined) {
        delete process.env.GALOIS_STATIC_PREFIX;
      } else {
        process.env.GALOIS_STATIC_PREFIX = previous;
      }
    }
  });
});
