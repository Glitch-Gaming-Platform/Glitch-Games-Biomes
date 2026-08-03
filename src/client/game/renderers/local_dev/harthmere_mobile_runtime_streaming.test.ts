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
  it("keeps the original eager loader and projectile prefetch on desktop only", () => {
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
    assert.match(
      renderer,
      /if \(this\.mobileDevice\) \{[\s\S]{0,300}this\.prepareMobileRuntimePlacements\(\)[\s\S]{0,300}\} else \{[\s\S]{0,200}this\.harthmereProjectileVisuals\.preloadAll\(\);[\s\S]{0,100}void this\.loadAll\(\)/
    );
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
