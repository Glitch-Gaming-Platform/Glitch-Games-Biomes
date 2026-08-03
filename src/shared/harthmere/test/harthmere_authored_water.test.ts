import assert from "assert";

import {
  HARTHMERE_AUTHORED_WATER_GROUND_Y,
  HARTHMERE_AUTHORED_WATER_MAX_DEPTH,
  harthmereAuthoredWaterDepthAt,
  harthmereAuthoredWaterLevelAt,
  harthmereShardHasAuthoredWater,
  isHarthmereAuthoredWaterColumn,
  isHarthmereAuthoredWaterVoxel,
} from "@/shared/harthmere/harthmere_authored_water";
import {
  HARTHMERE_RIVER_COURSE,
  HARTHMERE_RIVER_EAST_BRIDGE_DECK,
  harthmereRiverWaterDepthAt,
} from "@/shared/harthmere/harthmere_river";
import {
  HARTHMERE_MILL_RACE_BOUNDS,
  HARTHMERE_STILL_WATER_FEATURES,
} from "@/shared/harthmere/harthmere_still_water";
import {
  harthmereSurfaceRepairColumnEdits,
  isHarthmereSurfaceRepairProtectedColumn,
  HARTHMERE_SURFACE_REPAIR_TARGET_Y,
} from "@/shared/harthmere/extension_surface_repair";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";

/**
 * HARTHMERE_AUTHORED_WATER — the regression suite for "the river keeps getting
 * filled in with dirt".
 *
 * The additive extension is a flat plane at Y=52 and four separate maintenance
 * systems each treated any column breaking that plane as damage:
 *
 *   1. the unsolid-surface scan flagged every river shard as holed, forever;
 *   2. the surface repair filled the channel to grade with soil and capped it
 *      with grass;
 *   3. the fingerprint pass treated a holed shard as unseeded and reseeded it;
 *   4. `shard_water` lived in `mutableDefaults`, so it was only ever written on
 *      shard CREATE — an ordinary deploy rewrote the carve and left it dry.
 *
 * The first three had exactly one exception between them: the Bellbinder stair
 * mouth. These tests hold every one of those doors shut for the water too.
 */

/** A world column in the middle of the Brell. */
function riverWorldColumn(index = 8) {
  const [ax, az] = HARTHMERE_RIVER_COURSE[index];
  return [ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X, az] as const;
}

describe("Harthmere authored water", () => {
  describe("the predicate itself", () => {
    it("recognises the river in world coordinates", () => {
      const [x, z] = riverWorldColumn();
      assert.equal(isHarthmereAuthoredWaterColumn(x, z), true);
      // The same numbers in AUTHORED space are a different place entirely, and
      // getting this transform wrong is how the additive town has been bitten
      // before.
      assert.equal(
        isHarthmereAuthoredWaterColumn(x - HARTHMERE_ADDITIVE_TOWN_OFFSET_X, z),
        false
      );
    });

    it("recognises all three still-water features", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        const x =
          Math.round((feature.bounds.x0 + feature.bounds.x1) / 2) +
          HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const z = Math.round((feature.bounds.z0 + feature.bounds.z1) / 2);
        assert.equal(
          isHarthmereAuthoredWaterColumn(x, z),
          true,
          `${feature.label} is not recognised as authored water`
        );
      }
    });

    it("claims nothing out on the ordinary plane", () => {
      for (const [ax, az] of [
        [486, -209 - 40],
        [300, -300],
        [200, 100],
      ] as const) {
        assert.equal(
          isHarthmereAuthoredWaterColumn(
            ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            az
          ),
          false
        );
      }
    });

    it("reports a depth no deeper than it declares", () => {
      const [x, z] = riverWorldColumn();
      const depth = harthmereAuthoredWaterDepthAt(x, z);
      assert.ok(depth > 0);
      assert.ok(depth <= HARTHMERE_AUTHORED_WATER_MAX_DEPTH);
      assert.equal(harthmereAuthoredWaterDepthAt(x, z + 400), 0);
    });

    it("agrees with the river about where water actually sits", () => {
      const [x, z] = riverWorldColumn();
      const surface = HARTHMERE_AUTHORED_WATER_GROUND_Y - 1;
      assert.equal(harthmereAuthoredWaterLevelAt(x, surface, z), 15);
      // Bank top is air, not water.
      assert.equal(
        harthmereAuthoredWaterLevelAt(x, HARTHMERE_AUTHORED_WATER_GROUND_Y, z),
        0
      );
      // And far below the bed there is nothing.
      assert.equal(harthmereAuthoredWaterLevelAt(x, surface - 30, z), 0);
    });

    it("treats the bridge deck as solid, not as open water", () => {
      // The deck is authored ground over the channel. Reporting it open would
      // let the unsolid scan skip a column that really should be solid.
      const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
      const z = Math.round((deck.z0 + deck.z1) / 2);
      // The deck's west end is dry abutment and its first wet columns are
      // shallow bank, so sample the DEEPEST column under the deck — the one
      // that unambiguously has water beneath it.
      let authoredDeckX: number | undefined;
      let deepest = 0;
      for (let ax = deck.x0; ax <= deck.x1; ax += 1) {
        const depth = harthmereRiverWaterDepthAt(ax, z);
        if (depth > deepest) {
          deepest = depth;
          authoredDeckX = ax;
        }
      }
      assert.ok(authoredDeckX !== undefined, "the deck spans no water");
      assert.ok(deepest >= 2, "no real depth under the bridge");
      const x = authoredDeckX! + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
      assert.equal(
        isHarthmereAuthoredWaterVoxel(x, HARTHMERE_AUTHORED_WATER_GROUND_Y, z),
        false,
        "the bridge deck was reported as open water"
      );
      // But the water still runs underneath it.
      assert.equal(
        harthmereAuthoredWaterLevelAt(
          x,
          HARTHMERE_AUTHORED_WATER_GROUND_Y - 2,
          z
        ),
        15
      );
    });

    it("treats a mill-race bank as solid", () => {
      const b = HARTHMERE_MILL_RACE_BOUNDS;
      const x = b.x0 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
      const z = Math.round((b.z0 + b.z1) / 2);
      assert.equal(
        isHarthmereAuthoredWaterVoxel(x, HARTHMERE_AUTHORED_WATER_GROUND_Y, z),
        false,
        "the race bank was reported as open water"
      );
    });
  });

  describe("the surface repair no longer fills the river", () => {
    it("protects every river column", () => {
      for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
        const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        assert.equal(
          isHarthmereSurfaceRepairProtectedColumn(x, az),
          true,
          `the repair would fill the river at ${ax},${az}`
        );
      }
    });

    it("refuses to emit a single fill edit in the channel", () => {
      // This is the exact failure the player saw: a carved channel probed at
      // its bed, then filled to grade with soil and capped with grass.
      const [x, z] = riverWorldColumn();
      const bedY =
        HARTHMERE_AUTHORED_WATER_GROUND_Y - harthmereAuthoredWaterDepthAt(x, z);
      const result = harthmereSurfaceRepairColumnEdits(x, z, {
        surfaceY: bedY,
      });
      assert.equal(result.status, "protected");
      assert.deepEqual(result.edits, []);
    });

    it("refuses to fill an empty river column too", () => {
      const [x, z] = riverWorldColumn();
      const result = harthmereSurfaceRepairColumnEdits(x, z, {
        surfaceY: undefined,
        emptyColumn: true,
      });
      assert.equal(result.status, "protected");
      assert.deepEqual(result.edits, []);
    });

    it("protects the still-water features", () => {
      for (const feature of HARTHMERE_STILL_WATER_FEATURES) {
        for (let ax = feature.bounds.x0; ax <= feature.bounds.x1; ax += 1) {
          for (let az = feature.bounds.z0; az <= feature.bounds.z1; az += 1) {
            assert.equal(
              isHarthmereSurfaceRepairProtectedColumn(
                ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
                az
              ),
              true,
              `the repair would fill ${feature.label} at ${ax},${az}`
            );
          }
        }
      }
    });

    it("still repairs a genuine pit right beside the river", () => {
      // The fix must not turn into "never repair anything near water".
      const [ax, az] = HARTHMERE_RIVER_COURSE[8];
      let probeX: number | undefined;
      for (let dx = 8; dx <= 40; dx += 1) {
        if (
          !isHarthmereAuthoredWaterColumn(
            ax + dx + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            az
          )
        ) {
          probeX = ax + dx + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
          break;
        }
      }
      assert.ok(probeX !== undefined);
      const result = harthmereSurfaceRepairColumnEdits(probeX!, az, {
        surfaceY: HARTHMERE_SURFACE_REPAIR_TARGET_Y - 6,
      });
      assert.equal(result.status, "repaired");
      assert.ok(result.edits.length > 0, "a real pit stopped being repaired");
    });
  });

  describe("shards that must carry authored water", () => {
    it("claims the shard the river runs through", () => {
      const [x, z] = riverWorldColumn();
      const shardX = Math.floor(x / 32) * 32;
      const shardZ = Math.floor(z / 32) * 32;
      const shardY = Math.floor(HARTHMERE_AUTHORED_WATER_GROUND_Y / 32) * 32;
      assert.equal(
        harthmereShardHasAuthoredWater(
          [shardX, shardY, shardZ],
          [shardX + 32, shardY + 32, shardZ + 32]
        ),
        true
      );
    });

    it("does not claim a shard far from any water", () => {
      assert.equal(
        harthmereShardHasAuthoredWater([0, 32, 0], [32, 64, 32]),
        false
      );
    });

    it("does not claim the sky above the river", () => {
      const [x, z] = riverWorldColumn();
      const shardX = Math.floor(x / 32) * 32;
      const shardZ = Math.floor(z / 32) * 32;
      assert.equal(
        harthmereShardHasAuthoredWater(
          [shardX, 192, shardZ],
          [shardX + 32, 224, shardZ + 32]
        ),
        false
      );
    });
  });

  describe("the river is still fishable after all this", () => {
    it("keeps a fishable depth at the centreline", () => {
      // `SHALLOW_WATER` is 3 in src/shared/loot_tables/predicates.ts; the
      // fishing table needs real depth, and the whole point of the repair fix
      // is that the depth survives a deploy.
      const [ax, az] = HARTHMERE_RIVER_COURSE[8];
      assert.ok(harthmereRiverWaterDepthAt(ax, az) > 3);
    });

    it("has a water surface the fishing cast can land on", () => {
      // `isWaterAtPosition` reads the water tensor at the hook position, so the
      // surface voxel must carry a level.
      const [x, z] = riverWorldColumn();
      assert.equal(
        harthmereAuthoredWaterLevelAt(
          x,
          HARTHMERE_AUTHORED_WATER_GROUND_Y - 1,
          z
        ),
        15
      );
    });

    it("keeps water under every course node, not just the middle", () => {
      for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
        const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        assert.equal(
          harthmereAuthoredWaterLevelAt(
            x,
            HARTHMERE_AUTHORED_WATER_GROUND_Y - 1,
            az
          ),
          15,
          `no water at course node ${ax},${az}`
        );
      }
    });
  });
});
