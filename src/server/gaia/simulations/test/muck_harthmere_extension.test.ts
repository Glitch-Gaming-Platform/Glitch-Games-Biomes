import { suppressMuckInHarthmereExtension } from "@/server/gaia/simulations/muck";
import { HARTHMERE_EXTENSION_WORLD_BOUNDS } from "@/shared/harthmere/world_extension";
import assert from "assert";

describe("Harthmere Gaia Muck suppression", () => {
  it("suppresses every vertical shard inside the additive extension", () => {
    assert.equal(
      suppressMuckInHarthmereExtension([
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
        -128,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
      ]),
      true
    );
    assert.equal(
      suppressMuckInHarthmereExtension([
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX - 32,
        96,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ - 32,
      ]),
      true
    );
  });

  it("leaves shards outside the additive extension on normal Gaia behavior", () => {
    assert.equal(
      suppressMuckInHarthmereExtension([
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX - 32,
        32,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
      ]),
      false
    );
    assert.equal(
      suppressMuckInHarthmereExtension([
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX,
        32,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
      ]),
      false
    );
  });
});
