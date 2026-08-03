import assert from "assert";

import {
  HARTHMERE_AUTHORED_WATER_GROUND_Y,
  harthmereAuthoredWaterDepthAt,
  harthmereAuthoredWaterLevelAt,
  isHarthmereAuthoredWaterVoxel,
} from "@/shared/harthmere/harthmere_authored_water";
import {
  harthmereAuthoredWaterColumnPlan,
  type HarthmereAuthoredWaterProbe,
} from "@/shared/harthmere/harthmere_authored_water_plan";
import { HARTHMERE_RIVER_COURSE } from "@/shared/harthmere/harthmere_river";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";

/**
 * The materializer plan — the half that puts the river back into a world where
 * the terrain seed is skipped.
 *
 * Production deploys with `HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1`. The seed
 * is the only writer that can remove ground, and the sunken-surface repair is
 * add-only, so without this plan the channel is never cut — and exempting those
 * columns from repair would leave them permanently sunken instead.
 */

const GROUND = HARTHMERE_AUTHORED_WATER_GROUND_Y;
const SOLID = 1;

function riverColumn(index = 8) {
  const [ax, az] = HARTHMERE_RIVER_COURSE[index];
  return [ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X, az] as const;
}

/** A world where the channel has been paved flat — the reported symptom. */
function pavedProbe(): HarthmereAuthoredWaterProbe {
  return {
    terrainAt: (_x, y) => (y <= GROUND ? SOLID : 0),
    isSolid: (id) => id !== 0,
    waterAt: () => 0,
  };
}

/**
 * A world where the channel is already correct.
 *
 * Note this must model the DECKS: where a wilds trail crosses the river the
 * ground-plane voxel is a plank deck, not air. A probe that assumed every
 * channel voxel was open reported a spurious edit at the gravewood-lane
 * crossing — which is exactly the kind of thing the idempotence test is for.
 */
function materializedProbe(): HarthmereAuthoredWaterProbe {
  return {
    terrainAt: (x, y, z) => {
      const depth = harthmereAuthoredWaterDepthAt(x, z);
      if (depth <= 0) return y <= GROUND ? SOLID : 0;
      if (y <= GROUND - depth) return SOLID; // floor and bed
      return isHarthmereAuthoredWaterVoxel(x, y, z) ? 0 : SOLID;
    },
    isSolid: (id) => id !== 0,
    waterAt: (x, y, z) => harthmereAuthoredWaterLevelAt(x, y, z),
  };
}

/** A world with nothing at all in the column. */
function hollowProbe(): HarthmereAuthoredWaterProbe {
  return {
    terrainAt: () => 0,
    isSolid: (id) => id !== 0,
    waterAt: () => 0,
  };
}

describe("Harthmere authored water plan", () => {
  describe("scope", () => {
    it("returns nothing outside the channel", () => {
      const plan = harthmereAuthoredWaterColumnPlan(
        300 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        -300,
        pavedProbe()
      );
      assert.equal(plan.status, "outside");
      assert.deepEqual(plan.edits, []);
      assert.deepEqual(plan.water, []);
    });

    it("never touches a voxel above the ground plane", () => {
      // Player builds and the authored bridge decks live up there.
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, pavedProbe());
      for (const edit of [...plan.edits]) {
        assert.ok(
          edit.position[1] <= GROUND,
          `plan reached above grade at ${edit.position.join(",")}`
        );
      }
      for (const w of plan.water) {
        assert.ok(w.position[1] <= GROUND);
      }
    });

    it("never digs deeper than the authored channel", () => {
      const [x, z] = riverColumn();
      const depth = harthmereAuthoredWaterDepthAt(x, z);
      const plan = harthmereAuthoredWaterColumnPlan(x, z, pavedProbe());
      for (const edit of plan.edits) {
        assert.ok(
          edit.position[1] >= GROUND - depth - 1,
          `plan dug below the bed at ${edit.position.join(",")}`
        );
      }
    });
  });

  describe("materializing a paved-over channel", () => {
    it("clears the paved channel", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, pavedProbe());
      assert.equal(plan.status, "materialize");
      assert.ok(
        plan.edits.some((e) => e.label === "clear"),
        "nothing was cleared, so the channel stays paved"
      );
      // The bed voxel is already solid in a paved world, so no bed edit is
      // needed — the material is cosmetic and this pass only places what is
      // actually missing.
      assert.equal(
        plan.edits.some((e) => e.label === "bed"),
        false
      );
    });

    it("lays a bed when the column is hollow", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, hollowProbe());
      assert.ok(
        plan.edits.some((e) => e.label === "bed"),
        "no bed was laid under the water"
      );
    });

    it("fills the cleared channel with water", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, pavedProbe());
      const surface = plan.water.find(
        (w) => w.position[1] === GROUND - 1
      );
      assert.ok(surface, "no water at the surface voxel");
      assert.equal(surface!.level, 15);
    });

    it("clears exactly the voxels the authored channel wants open", () => {
      const [x, z] = riverColumn();
      const depth = harthmereAuthoredWaterDepthAt(x, z);
      const plan = harthmereAuthoredWaterColumnPlan(x, z, pavedProbe());
      const cleared = plan.edits
        .filter((e) => e.label === "clear")
        .map((e) => e.position[1])
        .sort((a, b) => a - b);
      // Open from one above the bed up to the plane.
      const expected: number[] = [];
      for (let y = GROUND - depth + 1; y <= GROUND; y += 1) expected.push(y);
      assert.deepEqual(cleared, expected);
    });

    it("works at every node along the course", () => {
      for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
        const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const plan = harthmereAuthoredWaterColumnPlan(x, az, pavedProbe());
        assert.equal(
          plan.status,
          "materialize",
          `no plan for course node ${ax},${az}`
        );
        assert.ok(
          plan.water.some((w) => w.level === 15),
          `node ${ax},${az} would be carved but left dry`
        );
      }
    });
  });

  describe("idempotence", () => {
    it("is a no-op on an already-correct channel", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, materializedProbe());
      assert.equal(plan.status, "matches");
      assert.deepEqual(plan.edits, []);
      assert.deepEqual(plan.water, []);
    });

    it("is a no-op at every course node once materialized", () => {
      for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
        const x = ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const plan = harthmereAuthoredWaterColumnPlan(
          x,
          az,
          materializedProbe()
        );
        assert.equal(
          plan.status,
          "matches",
          `node ${ax},${az} would be rewritten on a second pass`
        );
      }
    });

    it("re-floods a channel that was carved but left dry", () => {
      // Exactly what an ordinary deploy produced before this fix.
      const dry: HarthmereAuthoredWaterProbe = {
        ...materializedProbe(),
        waterAt: () => 0,
      };
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, dry);
      assert.equal(plan.status, "materialize");
      assert.deepEqual(plan.edits, [], "the terrain was already correct");
      assert.ok(plan.water.length > 0, "the dry channel was not re-flooded");
    });

    it("drains water that should not be there", () => {
      const flooded: HarthmereAuthoredWaterProbe = {
        ...materializedProbe(),
        waterAt: () => 15,
      };
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, flooded);
      // The bed voxel must not hold water.
      const depth = harthmereAuthoredWaterDepthAt(x, z);
      const bed = plan.water.find((w) => w.position[1] === GROUND - depth);
      assert.ok(bed, "the bed was left flooded");
      assert.equal(bed!.level, 0);
    });
  });

  describe("safety", () => {
    it("puts a floor under the bed when one is missing", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, hollowProbe());
      assert.ok(
        plan.edits.some((e) => e.label === "floor"),
        "a channel over a void would drain straight through"
      );
    });

    it("never clears a voxel that is already air", () => {
      const [x, z] = riverColumn();
      const plan = harthmereAuthoredWaterColumnPlan(x, z, materializedProbe());
      assert.equal(plan.edits.filter((e) => e.label === "clear").length, 0);
    });

    it("only ever places materials the repair palette knows", () => {
      const allowed = new Set([
        "sand",
        "gravel",
        "moss",
        "oakLumber",
        "stoneBrick",
        "stonePolished",
        "dirt",
      ]);
      for (const [ax, az] of HARTHMERE_RIVER_COURSE) {
        const plan = harthmereAuthoredWaterColumnPlan(
          ax + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
          az,
          pavedProbe()
        );
        for (const edit of plan.edits) {
          if (!edit.material) continue;
          assert.ok(
            allowed.has(edit.material),
            `unknown material ${edit.material}`
          );
        }
      }
    });
  });
});
