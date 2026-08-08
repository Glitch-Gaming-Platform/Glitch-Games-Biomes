import { strictEqual } from "assert";
import {
  harthmereGaloisAssetPath,
  resolveHarthmereAssetUrl,
} from "@/shared/harthmere/galois_asset_paths";

describe("Harthmere Galois asset paths", () => {
  it("maps public Harthmere assets to stable logical paths", () => {
    strictEqual(
      harthmereGaloisAssetPath("/assets/harthmere/glb/bosses/boss.glb"),
      "harthmere/glb/bosses/boss.glb"
    );
    strictEqual(
      harthmereGaloisAssetPath("/models/harthmere/clothing/hat.gltf"),
      "harthmere/models/clothing/hat.gltf"
    );
  });

  it("leaves unrelated and already-logical paths unchanged", () => {
    strictEqual(
      harthmereGaloisAssetPath("npcs/helping_robot"),
      "npcs/helping_robot"
    );
    strictEqual(
      harthmereGaloisAssetPath("harthmere/glb/items/key.glb"),
      "harthmere/glb/items/key.glb"
    );
  });

  it("falls back to the original URL when no export is indexed", () => {
    strictEqual(
      resolveHarthmereAssetUrl("/assets/harthmere/not-exported.glb"),
      "/assets/harthmere/not-exported.glb"
    );
  });
});
