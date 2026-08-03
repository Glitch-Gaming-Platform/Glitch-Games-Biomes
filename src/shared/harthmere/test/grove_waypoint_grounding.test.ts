/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_WAYPOINT_GROUNDING
//
// Separate from `grove_waypoints_production_wiring.test.ts` ON PURPOSE.
//
// This file imports the checked-in production terrain placement map, which is a
// ~53k-line generated data module. That import is cheap to reason about and
// expensive to load, and the wiring test beside it walks every file under
// `src/client` and `src/shared/harthmere` — an I/O-bound scan that already sat
// at roughly a third of Mocha's 5s ceiling. Putting the two in one file pushed
// the scan over the ceiling and turned a green preset red for a reason that had
// nothing to do with either assertion. `TESTING_FASTER.md` makes the same point
// about CPU-heavy work sharing a lane: run one heavy thing at a time.
//
// WHAT THIS PROVES
//
// `groveLandmarkWorldPosition` lifts a Grove landmark out of the retired Y=54
// datum, but onto ONE FLAT PLANE (`SNAPSHOT_GROVE_LIVE_MARKER_Y` = 71). That
// plane is true at the fountain plaza and false almost everywhere else, because
// the Grove is hilly.
//
// docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md is explicit:
// live helper landmarks resolve through `resolveHarthmereProductionMarkerPosition`,
// all player-facing surfaces point at the same `recommendedPosition`, and
// "do not fix one bad item by adding a magic `+1`, `-17`, `y=54`, or `y=70`".
//
// So these assertions exist to stop the plane being mistaken for the fix — which
// is a mistake that has already been made twice in this codebase: once in
// Chapter 1 (objectives 21 blocks in the air at Mosslawn, 9 underground at the
// fence line, per `ch1_objective_targets.ts`) and once in the first draft of the
// Grove pin repair.

import assert from "assert";
import { groveLandmarkWorldPosition } from "../grove/grove_waypoints";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  type SnapshotGroveLandmark,
} from "../snapshot_grove_content";
import { resolveHarthmereProductionMarkerPosition } from "../production_terrain_placement_map";

describe("Grove waypoint grounding", () => {
  it("grounds Grove landmarks on scanned terrain, not one flat plane", () => {
    const landmarks =
      SNAPSHOT_GROVE_LANDMARKS as readonly SnapshotGroveLandmark[];
    let scanned = 0;
    let disagreesWithPlane = 0;
    let worstDelta = 0;
    for (const landmark of landmarks) {
      const plane = groveLandmarkWorldPosition(landmark);
      const grounded = resolveHarthmereProductionMarkerPosition({
        markerId: landmark.id,
        fallback: plane,
      });
      if (grounded === plane) continue; // no scanned record; fallback is correct
      scanned += 1;
      if (grounded[1] !== plane[1]) {
        disagreesWithPlane += 1;
        worstDelta = Math.max(worstDelta, Math.abs(grounded[1] - plane[1]));
      }
    }

    // Measured at the time of writing: 79 of 108 landmarks carry a scanned
    // record. The floor is deliberately well below that so a legitimate map
    // regeneration does not fail the suite, while a placement map that has been
    // disconnected entirely still does.
    assert(
      scanned >= 50,
      `only ${scanned} Grove landmarks resolved through the placement map; ` +
        `the scan appears to have been disconnected`
    );
    assert(
      disagreesWithPlane >= 30,
      `only ${disagreesWithPlane} landmarks differ from the flat plane — if ` +
        `this collapses, confirm the placement map is still loaded`
    );
    // Ranger Jane's post is the worst case at 22 blocks below the plane, with
    // Sil at 49, Old Coop 59, Luis's cart 64, Alexis 74. If this ever drops to
    // single digits, the hilly-terrain correction has gone inert and pins are
    // being placed on a plane again.
    assert(
      worstDelta >= 15,
      `the largest plane-vs-scan disagreement is ${worstDelta} blocks; the ` +
        `hilly-terrain correction looks inert`
    );
  });

  it("keeps the flat plane as a fallback, never as the answer", () => {
    // The resolver must return the caller's fallback — not a fabricated Y — for
    // the landmarks the scan does not cover. Silently substituting a constant
    // for an unknown marker is how a "grounded" pin ends up underground.
    const landmarks =
      SNAPSHOT_GROVE_LANDMARKS as readonly SnapshotGroveLandmark[];
    for (const landmark of landmarks) {
      const plane = groveLandmarkWorldPosition(landmark);
      const grounded = resolveHarthmereProductionMarkerPosition({
        markerId: landmark.id,
        fallback: plane,
      });
      assert(
        Number.isFinite(grounded[0]) &&
          Number.isFinite(grounded[1]) &&
          Number.isFinite(grounded[2]),
        `${landmark.id} resolved to a non-finite position`
      );
      assert(
        grounded[1] !== 0,
        `${landmark.id} resolved to Y=0 — the retired authored-datum bug`
      );
    }
  });
});
