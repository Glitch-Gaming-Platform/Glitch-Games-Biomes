/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS,
  HARTHMERE_EXTENSION_EDGE_HORIZON_MAX_SURFACE_Y,
  harthmereExtensionEdgeHorizonBlockAt,
  harthmereExtensionEdgeHorizonRegionAt,
  harthmereExtensionEdgeHorizonShardSpecs,
  harthmereExtensionEdgeHorizonSurfaceY,
} from "@/shared/harthmere/extension_edge_horizon";
import {
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  harthmereExtensionTerrainEntityIdForShard,
  harthmereExtensionVoidCollisionBoxes,
} from "@/shared/harthmere/world_extension";
import {
  HARTHMERE_TOWN_BACK_BOUNDARY_X,
  harthmereHorizonBlockAt,
  harthmereHorizonSurfaceY,
  harthmereTownAuthoredToWorldX,
  harthmereTownBackBoundarySlabs,
} from "@/shared/harthmere/harthmere_town_horizon";

describe("Harthmere additive edge horizon", () => {
  it("covers the exact production void shard without making it playable", () => {
    assert.equal(
      harthmereExtensionEdgeHorizonRegionAt(
        2048.3907584325657,
        -600.4049621545007
      ),
      "south"
    );
    assert.ok(
      harthmereExtensionEdgeHorizonShardSpecs().some(
        (spec) => spec.shardX === 64 && spec.shardY === 0 && spec.shardZ === -19
      ),
      "the captured [64,0,-19] shard must receive visual terrain"
    );
  });

  it("joins the playable plane and rises into an occluding ridge", () => {
    const x = 2048;
    const atSouthSeam = harthmereExtensionEdgeHorizonSurfaceY(
      x,
      HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ - 1
    )!;
    const farSouth = harthmereExtensionEdgeHorizonSurfaceY(
      x,
      HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS.southMinZ + 4
    )!;
    assert.ok(
      Math.abs(atSouthSeam - HARTHMERE_EXTENSION_GROUND_Y) <= 2,
      "the fake land must not begin as another vertical cut"
    );
    assert.ok(
      farSouth >= HARTHMERE_EXTENSION_GROUND_Y + 34,
      "the far ridge must hide the generated strip's outer edge"
    );
    assert.ok(farSouth <= HARTHMERE_EXTENSION_EDGE_HORIZON_MAX_SURFACE_Y);
  });

  it("puts solid strata below the fake surface and sky above it", () => {
    for (const [x, z] of [
      [1900, -640],
      [2200, 260],
    ] as const) {
      const surface = harthmereExtensionEdgeHorizonSurfaceY(x, z)!;
      assert.ok(harthmereExtensionEdgeHorizonBlockAt(x, surface, z));
      assert.equal(
        harthmereExtensionEdgeHorizonBlockAt(x, surface + 1, z),
        undefined
      );
      assert.equal(
        harthmereExtensionEdgeHorizonBlockAt(x, surface - 12, z),
        "stone"
      );
    }
  });

  it("never writes into playable Harthmere or west into the snapshot", () => {
    assert.equal(
      harthmereExtensionEdgeHorizonRegionAt(
        2048,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ
      ),
      undefined
    );
    assert.equal(
      harthmereExtensionEdgeHorizonRegionAt(
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX - 1,
        -640
      ),
      undefined
    );
  });

  it("keeps every fake-land sample behind the hard collision region", () => {
    const [southVoid, northVoid] = harthmereExtensionVoidCollisionBoxes();
    for (const [x, z, barrier] of [
      [1792, -577, southVoid],
      [2048, -640, southVoid],
      [2559, -703, southVoid],
      [1792, 192, northVoid],
      [2048, 256, northVoid],
      [2559, 319, northVoid],
    ] as const) {
      assert.ok(harthmereExtensionEdgeHorizonRegionAt(x, z));
      assert.ok(x >= barrier[0][0] && x <= barrier[1][0]);
      assert.ok(z >= barrier[0][2] && z <= barrier[1][2]);
    }
  });

  it("covers every exposed side while preserving the west handoff", () => {
    const [southVoid, northVoid] = harthmereExtensionVoidCollisionBoxes();
    for (let x = 1792; x < 2560; x += 32) {
      for (const [z, barrier] of [
        [HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS.southMinZ, southVoid],
        [HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ - 1, southVoid],
        [HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ, northVoid],
        [HARTHMERE_EXTENSION_EDGE_HORIZON_BOUNDS.northMaxZ - 1, northVoid],
      ] as const) {
        assert.ok(
          harthmereExtensionEdgeHorizonSurfaceY(x, z) !== undefined,
          `missing north/south visual continuation at ${x},${z}`
        );
        assert.ok(x >= barrier[0][0] && x <= barrier[1][0]);
        assert.ok(z >= barrier[0][2] && z <= barrier[1][2]);
      }
    }

    const eastAuthoredX = HARTHMERE_TOWN_BACK_BOUNDARY_X + 90;
    const eastZ = -330;
    const eastSurface = harthmereHorizonSurfaceY(eastAuthoredX, eastZ);
    assert.ok(harthmereHorizonBlockAt(eastAuthoredX, eastSurface, eastZ));
    const eastWorldX = harthmereTownAuthoredToWorldX(eastAuthoredX);
    assert.equal(
      harthmereTownBackBoundarySlabs([
        [eastWorldX, HARTHMERE_EXTENSION_GROUND_Y, eastZ],
        [eastWorldX + 1, HARTHMERE_EXTENSION_GROUND_Y + 2, eastZ + 1],
      ]).length,
      1,
      "the existing east vista remains unreachable"
    );

    assert.equal(
      harthmereExtensionEdgeHorizonRegionAt(1791, -640),
      undefined,
      "west of the extension remains the loaded imported map, not fake terrain"
    );
  });

  it("uses stable, unique shard coordinates inside the reserved id grid", () => {
    const specs = harthmereExtensionEdgeHorizonShardSpecs();
    const keys = specs.map(
      (spec) => `${spec.shardX}:${spec.shardY}:${spec.shardZ}`
    );
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(specs.length, 24 * 8 * 6);
    assert.ok(specs.every((spec) => spec.shardY >= -2 && spec.shardY <= 3));
    const ids = specs.map((spec) =>
      harthmereExtensionTerrainEntityIdForShard(
        spec.shardX,
        spec.shardY,
        spec.shardZ
      )
    );
    assert.ok(ids.every((id) => id !== undefined));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("is wired into the production terrain seeder", () => {
    const shim = fs.readFileSync(
      path.join(process.cwd(), "src/server/shim/main.ts"),
      "utf8"
    );
    assert.ok(shim.includes("harthmereExtensionEdgeHorizonShardSpecs()"));
    assert.ok(shim.includes("harthmereExtensionEdgeHorizonBlockAt("));
    assert.ok(
      shim.includes(
        "async function seedMissingHarthmereEdgeHorizonTerrainIntoExistingWorld("
      )
    );
    assert.ok(
      shim.includes(
        "await seedMissingHarthmereEdgeHorizonTerrainIntoExistingWorld("
      ),
      "production disables broad terrain regeneration, so the new stable horizon shards need an explicit create-only sync"
    );
  });
});
