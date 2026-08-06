import {
  selectHarthmereMobileRuntimePlacements,
  type HarthmereMobileRuntimePlacementCandidate,
} from "@/client/game/renderers/local_dev/harthmere_mobile_runtime_streaming";
import assert from "assert";
import fs from "fs";
import path from "path";

const candidates: HarthmereMobileRuntimePlacementCandidate[] = [
  { index: 0, asset: "near-a", x: 1, z: 0 },
  { index: 1, asset: "near-b", x: 2, z: 0 },
  { index: 2, asset: "near-a", x: 3, z: 0 },
  { index: 3, asset: "third-asset", x: 4, z: 0 },
  { index: 4, asset: "outside", x: 50, z: 0 },
];

describe("Harthmere mobile runtime placement streaming", () => {
  it("lazy-loads mobile combat VFX and bounds town loading on desktop and mobile", () => {
    const renderer = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/local_dev/harthmere_assets.ts"
      ),
      "utf8"
    );
    const registry = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/renderers/renderers.ts"),
      "utf8"
    );

    assert.ok(
      registry.includes(
        "makeHarthmereRuntimeAssetsRenderer(resources, clientConfig.mobileDevice)"
      )
    );
    const constructorStreaming = renderer.slice(
      renderer.indexOf("constructor("),
      renderer.indexOf("draw(scenes: Scenes, dt: number)")
    );
    assert.doesNotMatch(
      constructorStreaming,
      /this\.harthmereProjectileVisuals\.preloadAll\(/
    );
    assert.match(
      constructorStreaming,
      /if \(shouldRenderHarthmereRuntimeAssets\(\)\) \{[\s\S]{0,1600}this\.prepareMobileRuntimePlacements\(\)[\s\S]{0,300}this\.ready = true/
    );
    assert.doesNotMatch(
      renderer.slice(
        renderer.indexOf("if (shouldRenderHarthmereRuntimeAssets())"),
        renderer.indexOf("draw(scenes: Scenes, dt: number)")
      ),
      /void this\.loadAll\(\)/
    );
    assert.match(
      renderer,
      /this\.updateMobileRuntimeAssetStreaming\(dt, camera\)/
    );
  });

  it("caches scene-wide player bone lookups instead of traversing every frame", () => {
    const renderer = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/local_dev/harthmere_assets.ts"
      ),
      "utf8"
    );
    const lookup = renderer.slice(
      renderer.indexOf("private resolveHarthmerePlayerBoneAnchor"),
      renderer.indexOf("private updateHarthmereCombatPolishLocomotion")
    );
    assert.match(lookup, /harthmerePlayerBoneAnchorCache\.get\(cacheKey\)/);
    assert.match(lookup, /nowMs < cached\.nextScanAtMs/);
    assert.match(lookup, /harthmerePlayerBoneAnchorCache\.set\(cacheKey/);
  });

  it("keeps nearest repeated assets without exceeding the prototype budget", () => {
    const selected = selectHarthmereMobileRuntimePlacements(
      candidates,
      [0, 0],
      { radiusMeters: 10, maxPlacements: 4, maxAssets: 2 }
    );

    assert.deepEqual(selected.indexes, [0, 1, 2]);
    assert.deepEqual(selected.assetKeys, ["near-a", "near-b"]);
  });

  it("applies the placement and distance limits deterministically", () => {
    const selected = selectHarthmereMobileRuntimePlacements(
      candidates,
      [0, 0],
      { radiusMeters: 3.1, maxPlacements: 2, maxAssets: 4 }
    );

    assert.deepEqual(selected.indexes, [0, 1]);
    assert.deepEqual(selected.assetKeys, ["near-a", "near-b"]);
  });

  it("reselects around the new player position instead of retaining the world", () => {
    const selected = selectHarthmereMobileRuntimePlacements(
      candidates,
      [50, 0],
      { radiusMeters: 2, maxPlacements: 10, maxAssets: 10 }
    );

    assert.deepEqual(selected.indexes, [4]);
    assert.deepEqual(selected.assetKeys, ["outside"]);
  });
});
