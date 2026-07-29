// GROVE_WAYPOINTS
//
// The ONLY sanctioned way to turn a Grove objective's marker id into a world
// position.
//
// WHY THIS FILE EXISTS
// --------------------
// The Grove landmark table mixes TWO COORDINATE SPACES. 83 landmarks sit at
// the live marker height (Y=71, the terrain the browser actually loads) and 25
// sit at the retired authored height (Y=54). For Harthmere-area landmarks the
// authored height is correct — the additive extension really does put its
// ground at 52 — but 15 GROVE-area landmarks are stranded in the retired
// space, 10 of them referenced by live quests.
//
// This is the Grove analogue of the Bible catalog's Y=0 problem, and it has
// the same consequence: `snapshot_grove_content.ts` records that "the
// broken-courtyard logs showed the player at y=70.5 while seeded Grove NPCs
// were still at y=53, leaving the mission cast buried under the courtyard". A
// marker 17 blocks under the floor is a browser test that walks forever.
//
// Everything that resolves a Grove marker should go through here, which lifts
// a Grove-area landmark out of the retired space.
//
// SCOPE — READ THIS BEFORE TRUSTING THE TESTS
// -------------------------------------------
// The contract tests prove THIS RESOLVER is correct. They do NOT prove the
// player-facing map is fixed, because not every live pin path calls it yet.
// `GROVE_UNWIRED_LANDMARK_POSITION_READERS` below names the call sites that
// still read `landmark.position` directly; while that list is non-empty, a
// stranded marker can still reach a real map pin.
//
// Keep the two claims separate. A test that says "ships no waypoint in the
// retired space" while production bypasses the resolver is worse than no test:
// it buys confidence about exactly the bug it is not covering.

import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_MARKER_Y,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import type {
  GroveQuestDef,
  GroveQuestStep,
} from "@/shared/harthmere/grove/grove_quest_schema";
import type { Vec3 } from "@/shared/math/types";

export const GROVE_WAYPOINTS_VERSION = 1 as const;

/**
 * Live call sites that still read `landmark.position` directly instead of
 * resolving through this module.
 *
 * This list is the honest statement of how far the fix reaches. It is asserted
 * by `grove_waypoints_production_wiring.test.ts`, which fails if a NEW bypass
 * appears and must be shortened (never extended) as paths are rewired. When it
 * is empty, and only then, the resolver contract and the player-facing map say
 * the same thing.
 */
export const GROVE_UNWIRED_LANDMARK_POSITION_READERS: readonly string[] =
  Object.freeze([]);

/**
 * All six are now wired.
 *
 * Three were found by inspection; the other three
 * (`ch1_objective_targets.ts`, `jobs_board_quest_marker_positions.ts`,
 * `snapshot_complete_port.ts`) were found only by the scan in
 * `grove_waypoints_production_wiring.test.ts`. The hand count was half the
 * real number, which is the argument for keeping the scan.
 */

/**
 * Paths that read `landmark.position` but only use X/Z.
 *
 * `LocalDevHarthmereQuests.tsx` computes map BOUNDS from the horizontal extent
 * only. The vertical datum drift cannot affect it, so routing it through the
 * resolver would add indirection for no correctness gain. Listed explicitly so
 * a reviewer does not have to re-derive why it is absent from the list above.
 */
export const GROVE_HORIZONTAL_ONLY_LANDMARK_READERS: readonly string[] =
  Object.freeze(["src/client/components/challenges/LocalDevHarthmereQuests.tsx"]);

/**
 * Areas whose terrain is the additive Harthmere extension, not the Grove
 * snapshot. Their ground really is at the authored height, so a Y=54 landmark
 * there is CORRECT and must not be lifted.
 */
const HARTHMERE_EXTENSION_AREAS: ReadonlySet<string> = new Set([
  "harthmere",
  "harthmere_connector",
]);

const landmarksById: ReadonlyMap<string, SnapshotGroveLandmark> = new Map(
  (SNAPSHOT_GROVE_LANDMARKS as readonly SnapshotGroveLandmark[]).map(
    (landmark) => [landmark.id, landmark]
  )
);

export function groveLandmark(
  markerId: string
): SnapshotGroveLandmark | undefined {
  return landmarksById.get(markerId);
}

/**
 * True when a landmark is a Grove-area marker still sitting in the retired
 * authored coordinate space.
 */
export function groveLandmarkIsStranded(
  landmark: SnapshotGroveLandmark
): boolean {
  return (
    landmark.position[1] === SNAPSHOT_GROVE_MARKER_Y &&
    !HARTHMERE_EXTENSION_AREAS.has(landmark.area)
  );
}

/**
 * Landmark -> live world position.
 *
 * Lifts a stranded Grove-area landmark from the retired authored height to the
 * live marker height. X and Z are unchanged: the horizontal layout was always
 * correct, only the vertical datum drifted.
 */
export function groveLandmarkWorldPosition(
  landmark: SnapshotGroveLandmark
): Vec3 {
  const [x, y, z] = landmark.position;
  return groveLandmarkIsStranded(landmark)
    ? [x, SNAPSHOT_GROVE_LIVE_MARKER_Y, z]
    : [x, y, z];
}

export function groveMarkerWorldPosition(
  markerId: string
): Vec3 | undefined {
  const landmark = groveLandmark(markerId);
  return landmark ? groveLandmarkWorldPosition(landmark) : undefined;
}

export function groveStepWorldWaypoint(step: GroveQuestStep): Vec3 | undefined {
  return groveMarkerWorldPosition(step.markerId);
}

/**
 * The quest's own map anchor: its first objective's marker.
 *
 * Grove quests have no separate quest-level waypoint — the retired shape only
 * ever carried per-objective marker ids — so the first step is the anchor.
 */
export function groveQuestWorldWaypoint(
  quest: GroveQuestDef
): Vec3 | undefined {
  const first = quest.steps[0];
  return first ? groveStepWorldWaypoint(first) : undefined;
}

/** Every grounded waypoint a quest can put on the map, in step order. */
export function groveQuestWorldWaypoints(quest: GroveQuestDef): Vec3[] {
  return quest.steps.flatMap((step) => {
    const position = groveStepWorldWaypoint(step);
    return position ? [position] : [];
  });
}

/**
 * Grove-area landmarks still authored in the retired space.
 *
 * Reported rather than silently fixed so the authored data can be corrected at
 * source. The resolver above already makes them safe at runtime; this is the
 * list of rows that should eventually be edited.
 */
export function groveStrandedLandmarks(): SnapshotGroveLandmark[] {
  return (SNAPSHOT_GROVE_LANDMARKS as readonly SnapshotGroveLandmark[]).filter(
    groveLandmarkIsStranded
  );
}
