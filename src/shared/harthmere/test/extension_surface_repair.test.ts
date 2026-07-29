// Tests for HARTHMERE_EXTENSION_SURFACE_REPAIR (sunken-forest fix, 2026-07-28).
//
// The bug these guard against: extension columns whose SURFACE shard (world Y
// 32..63) is absent from the ECS, so the terrain top drops from Y=52 to the
// foundation top at Y=31 and the player finds a 32x32, 21-block-deep black pit
// in the wilds forest. The repair must put the plane back without ever carving,
// without sealing an authored cave, and without moving a dungeon NPC.

import assert from "assert";
import {
  HARTHMERE_SURFACE_REPAIR_MAX_DROP,
  HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y,
  HARTHMERE_SURFACE_REPAIR_SOIL_DEPTH,
  HARTHMERE_SURFACE_REPAIR_TARGET_Y,
  harthmereSunkenActorRegroundTarget,
  harthmereSurfaceRepairColumnEdits,
  harthmereSurfaceRepairShardSpecs,
  isHarthmereSurfaceRepairForestColumn,
  isHarthmereSurfaceRepairProtectedColumn,
  isHarthmereSurfaceRepairWorldColumn,
  validateHarthmereSurfaceRepairContract,
} from "@/shared/harthmere/extension_surface_repair";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "@/shared/harthmere/world_extension";

// A wilds column: east of the connector road, well clear of the town envelope
// and of the back boundary. World X 1850 is authored 250.
const WILDS_X = 1850;
const WILDS_Z = -352;

// The floor of an observed pit: the top of the foundation shard.
const PIT_FLOOR_Y = 31;

describe("harthmere extension surface repair", () => {
  it("has a self-consistent contract", () => {
    const contract = validateHarthmereSurfaceRepairContract();
    assert.deepStrictEqual(contract.failures, []);
    assert.ok(contract.ok);
  });

  it("covers exactly the 576 surface shards the production audit counts", () => {
    const specs = harthmereSurfaceRepairShardSpecs();
    assert.strictEqual(specs.length, 576);
    assert.strictEqual(new Set(specs.map((spec) => spec.id)).size, 576);
    for (const spec of specs) {
      assert.strictEqual(spec.shardY, 1);
      assert.ok(
        spec.shardX * 32 >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minX &&
          spec.shardX * 32 < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX
      );
    }
  });

  it("produces no edits for a column that is already flat", () => {
    const result = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
      surfaceY: HARTHMERE_SURFACE_REPAIR_TARGET_Y,
    });
    assert.strictEqual(result.status, "flat");
    assert.deepStrictEqual(result.edits, []);
  });

  it("is idempotent: re-probing a repaired column yields nothing", () => {
    const first = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
      surfaceY: PIT_FLOOR_Y,
    });
    assert.strictEqual(first.status, "repaired");
    assert.ok(first.edits.length > 0);
    const second = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
      surfaceY: HARTHMERE_SURFACE_REPAIR_TARGET_Y,
    });
    assert.deepStrictEqual(second.edits, []);
  });

  it("rebuilds a sunken column with the seeder's own strata", () => {
    const { edits, drop } = harthmereSurfaceRepairColumnEdits(
      WILDS_X,
      WILDS_Z,
      { surfaceY: PIT_FLOOR_Y }
    );
    assert.strictEqual(drop, HARTHMERE_SURFACE_REPAIR_TARGET_Y - PIT_FLOOR_Y);

    const fills = edits.filter((edit) => edit.label === "fill");
    assert.strictEqual(fills.length, HARTHMERE_SURFACE_REPAIR_TARGET_Y - 32);
    for (const fill of fills) {
      const depth = HARTHMERE_SURFACE_REPAIR_TARGET_Y - fill.position[1];
      assert.strictEqual(
        fill.material,
        depth > HARTHMERE_SURFACE_REPAIR_SOIL_DEPTH ? "stone" : "dirt"
      );
    }

    const caps = edits.filter((edit) => edit.label === "cap");
    assert.strictEqual(caps.length, 1);
    assert.strictEqual(caps[0].material, "grass");
    assert.strictEqual(caps[0].position[1], HARTHMERE_SURFACE_REPAIR_TARGET_Y);
  });

  it("never carves: no edit is air, and none lands at or below the probe", () => {
    for (let surfaceY = PIT_FLOOR_Y; surfaceY < 52; surfaceY += 1) {
      const { edits } = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
        surfaceY,
      });
      for (const edit of edits) {
        assert.ok(edit.material, "repair emitted an empty material");
        assert.ok(
          edit.position[1] > surfaceY,
          `repair wrote at Y=${edit.position[1]} at or below probed surface ${surfaceY}`
        );
        assert.ok(edit.position[1] >= HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y);
      }
    }
  });

  it("never writes into the foundation layer", () => {
    const { edits } = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
      surfaceY: undefined,
      emptyColumn: true,
    });
    assert.ok(edits.length > 0);
    for (const edit of edits) {
      assert.ok(edit.position[1] >= HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y);
    }
  });

  it("reports rather than fills a column deeper than any pit this bug makes", () => {
    const result = harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
      surfaceY: HARTHMERE_SURFACE_REPAIR_TARGET_Y -
        HARTHMERE_SURFACE_REPAIR_MAX_DROP -
        1,
    });
    assert.strictEqual(result.status, "tooDeep");
    assert.deepStrictEqual(result.edits, []);
  });

  it("refuses columns outside the extension and unreadable columns", () => {
    assert.strictEqual(
      harthmereSurfaceRepairColumnEdits(1000, -209, { surfaceY: 31 }).status,
      "outside"
    );
    assert.strictEqual(
      isHarthmereSurfaceRepairWorldColumn(
        HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX,
        0
      ),
      false
    );
    assert.strictEqual(
      harthmereSurfaceRepairColumnEdits(WILDS_X, WILDS_Z, {
        surfaceY: undefined,
      }).status,
      "unknown"
    );
  });

  it("protects the chapel stair mouth and the authored caves", () => {
    const [authoredX, , openingZ] =
      HARTHMERE_BELLBINDER_DESCENT.surfaceOpeningCenter;
    const openingX = authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
    assert.ok(isHarthmereSurfaceRepairProtectedColumn(openingX, openingZ));
    assert.strictEqual(
      harthmereSurfaceRepairColumnEdits(openingX, openingZ, { surfaceY: 31 })
        .status,
      "protected"
    );
    // Old Well descent room: authored x 394..408, z -242..-228, y 46..51.
    assert.ok(
      isHarthmereSurfaceRepairProtectedColumn(
        400 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        -235
      )
    );
  });

  it("dresses the wilds as forest but leaves town and road corridors bare", () => {
    assert.ok(isHarthmereSurfaceRepairForestColumn(WILDS_X, WILDS_Z));
    // On the connector road at authored Z=-209.
    assert.strictEqual(
      isHarthmereSurfaceRepairForestColumn(
        300 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        -209
      ),
      false
    );
    // Behind the back boundary (authored 778): horizon backdrop, not wilds.
    assert.strictEqual(
      isHarthmereSurfaceRepairForestColumn(
        850 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        -209
      ),
      false
    );
  });

  it("puts forest and ground cover only above the new cap", () => {
    let sawDressing = false;
    for (let x = WILDS_X; x < WILDS_X + 64 && !sawDressing; x += 1) {
      const { edits } = harthmereSurfaceRepairColumnEdits(x, WILDS_Z, {
        surfaceY: PIT_FLOOR_Y,
      });
      const dressing = edits.filter(
        (edit) => edit.label === "forest" || edit.label === "cover"
      );
      if (!dressing.length) continue;
      sawDressing = true;
      for (const edit of dressing) {
        assert.ok(edit.position[1] > HARTHMERE_SURFACE_REPAIR_TARGET_Y);
      }
    }
    assert.ok(sawDressing, "no forest column found in a 64-wide wilds strip");
  });

  it("lifts creatures that were grounded onto the pit floor", () => {
    const result = harthmereSunkenActorRegroundTarget({
      position: [WILDS_X, PIT_FLOOR_Y + 1, WILDS_Z],
    });
    assert.ok(result.sunken);
    assert.deepStrictEqual(result.position, [
      WILDS_X,
      HARTHMERE_EXTENSION_FEET_Y,
      WILDS_Z,
    ]);
  });

  it("leaves dungeon, above-plane and off-map actors alone", () => {
    assert.strictEqual(
      harthmereSunkenActorRegroundTarget({
        position: [WILDS_X, HARTHMERE_EXTENSION_FEET_Y, WILDS_Z],
      }).sunken,
      false
    );
    // Bellbinder descent landing, far below any pit floor.
    assert.strictEqual(
      harthmereSunkenActorRegroundTarget({
        position: [WILDS_X, -6, WILDS_Z],
      }).sunken,
      false
    );
    // Underways NPC at Y=48 under the town — protected column, never lifted.
    assert.strictEqual(
      harthmereSunkenActorRegroundTarget({
        position: [400 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X, 48, -235],
      }).sunken,
      false
    );
    assert.strictEqual(
      harthmereSunkenActorRegroundTarget({
        position: [900, 31, -209],
        }).sunken,
      false
    );
    assert.strictEqual(
      harthmereSunkenActorRegroundTarget({
        position: [WILDS_X, 40, WILDS_Z],
        authoredUnderground: true,
      }).sunken,
      false
    );
  });
});
