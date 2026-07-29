import { makeWorldMap } from "@/server/gaia/simulations/farming/map";
import assert from "assert";

describe("farming world map bounds", () => {
  it("includes crop voxels in the additive Harthmere east extension", () => {
    const map = makeWorldMap<number>();
    assert.equal(map.inBounds([2048, 54, -52]), true);
    assert.equal(map.inBounds([2559, 54, -52]), true);
    map.set([2048, 54, -52], 1);
    assert.equal(map.get([2048, 54, -52]), 1);
  });

  it("reports truly out-of-world crop voxels without invoking Sparse3.key", () => {
    const map = makeWorldMap<number>();
    assert.equal(map.inBounds([2560, 54, -52]), false);
    assert.equal(map.inBounds([2048, 512, -52]), false);
  });

  it("can follow authoritative metadata beyond the default extension", () => {
    const map = makeWorldMap<number>([
      [-2048, -256, -2048],
      [3072, 512, 2048],
    ]);
    assert.equal(map.inBounds([3000, 54, -52]), true);
  });
});
