import assert from "assert";

import {
  HARTHMERE_MUCK_CONTAINMENT_AREAS,
  clampPointToMuckContainmentArea,
  harthmereClampMeanderDestinationToMuckArea,
  isInsideMuckContainment,
  muckContainmentAreaForPosition,
} from "@/shared/harthmere/harthmere_muck_monster_containment";
import {
  SNAPSHOT_DANGER_AREAS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
} from "@/shared/harthmere/snapshot_runtime_rules";
import type { Vec3 } from "@/shared/math/types";

function dist2d(a: Vec3, b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

describe("muck containment areas stay in sync with the authored zones", () => {
  it("includes every authored muck and danger zone with matching center/radius", () => {
    for (const zone of [
      ...SNAPSHOT_HARTHMERE_MUCK_ZONES,
      ...SNAPSHOT_DANGER_AREAS,
    ]) {
      const area = HARTHMERE_MUCK_CONTAINMENT_AREAS.find(
        (candidate) => candidate.id === zone.id
      );
      assert.ok(area, `missing containment area for ${zone.id}`);
      assert.deepEqual(area!.center, zone.authoredCenter);
      assert.equal(area!.radius, zone.radius);
    }
  });
});

describe("muck containment membership", () => {
  it("recognizes a point inside a muck zone", () => {
    // Road Muckwad Patch center.
    assert.ok(isInsideMuckContainment([512, 54, -152]));
    assert.equal(muckContainmentAreaForPosition([512, 54, -152])?.id !== undefined, true);
  });

  it("rejects points outside every muck zone (town/grove center, world origin)", () => {
    assert.equal(isInsideMuckContainment([486, 54, -209]), false);
    assert.equal(isInsideMuckContainment([0, 54, 0]), false);
  });

  it("returns the largest overlapping area so monsters aren't over-constrained", () => {
    // Watchtower nests a 16-radius patch inside a 34-radius clearing at the same
    // center; a point near the center resolves to the larger clearing.
    const area = muckContainmentAreaForPosition([332, 54, -390]);
    assert.equal(area?.id, "watchtower_muck_clearing");
    assert.equal(area?.radius, 34);
  });
});

describe("clampPointToMuckContainmentArea", () => {
  const area = { id: "road_muckwad_patch", center: [512, 54, -152] as Vec3, radius: 10 };

  it("leaves a point already inside untouched", () => {
    const inside: Vec3 = [515, 54, -150];
    assert.deepEqual(clampPointToMuckContainmentArea(inside, area), inside);
  });

  it("pulls an outside point back within (radius - margin) and preserves Y", () => {
    const outside: Vec3 = [540, 70, -152]; // 28 east of center
    const clamped = clampPointToMuckContainmentArea(outside, area, 1.5);
    assert.ok(
      dist2d(clamped, area.center) <= 10 - 1.5 + 1e-6,
      `expected clamped within 8.5, got ${dist2d(clamped, area.center)}`
    );
    assert.equal(clamped[1], 70, "Y must be preserved");
  });
});

describe("harthmereClampMeanderDestinationToMuckArea", () => {
  it("REGRESSION: keeps a muck monster's wander destination inside its muck area", () => {
    // Spawn near the edge of the radius-10 Road Muckwad Patch, then try to
    // wander 16 blocks out (the DEFAULT_MEANDER envelope). The destination must
    // be pulled back inside the muck zone.
    const home: Vec3 = [520, 54, -152]; // 8 east of center, inside the patch
    const wildDestination: Vec3 = [536, 54, -152]; // 24 east of center, outside
    const clamped = harthmereClampMeanderDestinationToMuckArea(
      home,
      wildDestination
    );
    assert.ok(
      isInsideMuckContainment(clamped, 0),
      `clamped destination ${clamped} should be inside the muck area`
    );
  });

  it("is a no-op for NPCs whose home is not in a muck area (villagers)", () => {
    const home: Vec3 = [486, 54, -209]; // town/grove
    const destination: Vec3 = [500, 54, -220];
    assert.deepEqual(
      harthmereClampMeanderDestinationToMuckArea(home, destination),
      destination
    );
  });
});
