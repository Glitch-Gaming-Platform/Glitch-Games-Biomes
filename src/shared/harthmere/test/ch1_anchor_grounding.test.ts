/// <reference types="mocha" />
//
// CHAPTER_1_ANCHOR_GROUNDING
//
// Every Chapter 1 anchor must sit on the ground the browser actually loads.
//
// WHY THIS EXISTS
// The original CH1_ANCHORS table took X/Z from the production terrain placement
// map but not the resolved surface height, so 25 of 39 anchors were between 2
// and 21 blocks off the real surface. Halden Rook was seeded 13 blocks above
// the Harthmere bridge, Ranger Jane's provisioning post floated 21 blocks over
// Mosslawn, and the Grove supply chest was 17 blocks underground. Objectives
// pointed at empty air, NPCs fell or suffocated, and the chapter looked broken
// in exactly the way a player would describe as "the world isn't right".
//
// This is the Chapter 1 analogue of grove_waypoints.ts, whose header makes the
// same argument: "a marker 17 blocks under the floor is a browser test that
// walks forever."

import assert from "assert";
import { CH1_ANCHORS, type Ch1Vec3 } from "@/shared/harthmere/ch1_ids";
import { HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP } from "@/shared/harthmere/generated/production_terrain_placement_map";
import { allCh1ObjectiveTargets } from "@/shared/harthmere/ch1_objective_targets";

/** Marker height is the measured feet-Y plus one, matching the Grove datum. */
const MARKER_OFFSET = 1;
/** Terrain is scanned on a stride-8 grid, so a couple of blocks is expected. */
const TOLERANCE = 2;
/**
 * Stride-8 scan, so the nearest reading can legitimately be a few blocks away.
 * 16 keeps every anchor covered while staying inside the smallest objective
 * interaction radius the chapter uses (9m) plus one scan stride.
 */
const SEARCH_RADIUS = 16;

// Roofed businesses and the Chapter 1 buildings must use their walkable
// interior floors, not the nearest open-sky or roof measurement. These exact
// values are derived from the canonical materialization-plan origins.
const INTERIOR_Y: Readonly<Record<string, number>> = {
  greenlamp_clinic: 65,
  greenlamp_lou_post: 65,
  greenlamp_nadia_post: 65,
  ashline_containment_works: 67,
  ashline_refinery_intake: 67,
  ashline_foreman_post: 67,
  returnstone_pad_office: 41,
  returnstone_cressa_post: 41,
  returnstone_lou_post: 41,
  lanternrest_road_inn: 48,
  roadhouse_door: 70,
  roadhouse_table: 70,
  roadhouse_jackie_post: 70,
  roadhouse_hearth: 70,
  roadhouse_bed: 74,
  roadhouse_opening_spawn: 74,
  roadhouse_stores: 70,
  coretta_ledger_desk: 70,
  testimony_coretta: 70,
  testimony_allix: 70,
  grove_watch_house_door: 70,
  grove_watch_house: 70,
  grove_watch_house_holt_post: 70,
  grove_watch_house_teak_post: 70,
  grove_watch_house_jackie_post: 70,
};

const INTERIOR_POSITION_KEYS = new Set(
  Object.entries(CH1_ANCHORS)
    .filter(([key]) => INTERIOR_Y[key] !== undefined)
    .map(([, position]) => position.join(","))
);

interface Measured {
  x: number;
  z: number;
  feetY: number;
  label: string;
}

const MEASURED: Measured[] = (() => {
  const out: Measured[] = [];
  for (const placement of HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.placements as ReadonlyArray<
    Record<string, unknown>
  >) {
    const world = (placement.recommendedPosition ?? placement.worldPosition) as
      readonly number[] | undefined;
    const feetY = placement.surfaceFeetY;
    if (!world || typeof feetY !== "number") continue;
    out.push({
      x: world[0],
      z: world[2],
      feetY,
      label: String(placement.label ?? placement.id ?? "?"),
    });
  }
  return out;
})();

function nearbySurface(
  position: Ch1Vec3
): { feetY: number; label: string; distance: number } | undefined {
  const within = MEASURED.map((m) => ({
    ...m,
    distance: Math.hypot(m.x - position[0], m.z - position[2]),
  }))
    .filter((m) => m.distance <= SEARCH_RADIUS)
    .sort((a, b) => a.distance - b.distance);
  if (within.length === 0) return undefined;
  // Median, so one outlier reading (a rooftop marker, a cave mouth) cannot
  // drag the expected ground height for a whole plaza.
  const sorted = [...within].sort((a, b) => a.feetY - b.feetY);
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    feetY: median.feetY,
    label: median.label,
    distance: within[0].distance,
  };
}

describe("chapter 1 anchor grounding", () => {
  it("has production surface measurements to check against", () => {
    assert.ok(
      MEASURED.length > 500,
      `expected a populated placement map, found ${MEASURED.length} rows`
    );
  });

  it("puts every anchor on the measured production surface", () => {
    const errors: string[] = [];
    for (const [key, position] of Object.entries(CH1_ANCHORS) as Array<
      [string, Ch1Vec3]
    >) {
      if (INTERIOR_Y[key] !== undefined) {
        if (position[1] !== INTERIOR_Y[key]) {
          errors.push(
            `${key}: Y=${position[1]} does not match canonical interior floor ${INTERIOR_Y[key]}`
          );
        }
        continue;
      }
      const surface = nearbySurface(position);
      if (!surface) {
        errors.push(
          `${key}: no production surface measurement within ${SEARCH_RADIUS}m ` +
            `of ${position.join("/")} — site it near scanned ground`
        );
        continue;
      }
      const expected = surface.feetY + MARKER_OFFSET;
      const delta = position[1] - expected;
      if (Math.abs(delta) > TOLERANCE) {
        errors.push(
          `${key}: Y=${position[1]} is ${Math.abs(delta)} blocks ` +
            `${delta > 0 ? "above" : "below"} the measured surface ` +
            `(expected ~${expected}, from "${surface.label}" ` +
            `${surface.distance.toFixed(1)}m away)`
        );
      }
    }
    assert.deepEqual(errors, []);
  });

  it("resolves every objective target onto grounded terrain", () => {
    const errors: string[] = [];
    for (const target of allCh1ObjectiveTargets()) {
      // Dungeon interiors are authored voxel volumes with no production scan.
      if (target.source === "dungeon") continue;
      if (INTERIOR_POSITION_KEYS.has(target.position.join(","))) continue;
      const surface = nearbySurface(target.position);
      if (!surface) continue;
      const delta = target.position[1] - (surface.feetY + MARKER_OFFSET);
      if (Math.abs(delta) > TOLERANCE) {
        errors.push(
          `${target.questId}/${target.stepId} ("${target.label}"): ` +
            `Y=${target.position[1]} is ${Math.abs(delta)} blocks off the ` +
            `measured surface near "${surface.label}"`
        );
      }
    }
    assert.deepEqual(errors, []);
  });
});
