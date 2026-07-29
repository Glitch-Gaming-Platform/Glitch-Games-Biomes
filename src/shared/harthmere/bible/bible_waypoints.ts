// BIBLE_WAYPOINTS
//
// The ONLY sanctioned way to turn an authored Bible waypoint into a world
// position. Nothing else may read `authoredWaypoint`.
//
// WHY THIS FILE EXISTS
// --------------------
// 312 of the catalog's 340 objective waypoints carry Y=0. Zero is an authoring
// convention meaning "on the ground, wherever that is" — it is not a height.
// Grounding already existed as an opt-in helper
// (`normalizeHarthmereExtensionQuestWorldPosition`), which meant 312 rows
// depended on every call site remembering to call it. TESTING_FASTER section
// 4.12 records what happens when one does not: the browser writes the authored
// zero after the teleport hook already returned a safe pose, the player is
// stranded below terrain, and the row burns a three-minute movement timeout.
//
// Making the raw field unreachable outside this module converts that from a
// discipline problem into a type problem, and `bible_waypoints.test.ts`
// asserts no shipped surface carries Y=0.
//
// GAIA RULE 2 in `bible_engine_contracts.ts`.

import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import {
  normalizeHarthmereExtensionQuestWorldPosition,
  HARTHMERE_EXTENSION_FEET_Y,
} from "@/shared/harthmere/world_extension";
import {
  resolveHarthmereQuestObjectivePlacement,
  type HarthmereProductionPlacementPurpose,
} from "@/shared/harthmere/production_terrain_placement_map";
import {
  BIBLE_DRAGON_QUEST_ID,
  bibleThaedrynArenaWorldAnchor,
  bibleThaedrynWaypointOverride,
} from "@/shared/harthmere/bible/bible_thaedryn";
import type {
  BibleQuestDef,
  BibleQuestStep,
  BibleStepType,
} from "@/shared/harthmere/bible/bible_quest_schema";
import type { Vec3 } from "@/shared/math/types";

export const BIBLE_WAYPOINTS_VERSION = 1 as const;

/**
 * Placement purpose per step type. Drives which generated placement record the
 * resolver consults, which decides whether a target is grounded on an outdoor
 * surface or an indoor/cave floor.
 */
export function biblePlacementPurpose(
  type: BibleStepType
): HarthmereProductionPlacementPurpose {
  switch (type) {
    case "combat":
      return "monster";
    case "talk":
      return "npc";
    case "inspect":
    case "choice":
      return "interactable";
  }
}

/**
 * Authored -> world, always grounded.
 *
 * Order matters and each stage already exists in the codebase:
 *   1. additive town shift into world space;
 *   2. Y=0 -> the additive terrain's real feet height;
 *   3. the generated production placement map, which knows the true surface
 *      column and can move a target off a roof or out of a wall.
 */
export function bibleGroundedWorldWaypoint(input: {
  questId: string;
  stepId?: string;
  authored: Vec3;
  purpose: HarthmereProductionPlacementPurpose;
}): Vec3 {
  const fallback = normalizeHarthmereExtensionQuestWorldPosition(
    shiftHarthmereAuthoredPositionToWorld(input.authored)
  );
  const placed = resolveHarthmereQuestObjectivePlacement({
    questId: input.questId,
    objectiveId: input.stepId,
    fallback,
    purpose: input.purpose,
  }).recommendedPosition as Vec3;
  // Belt and braces: a placement record with a stale or absent Y must never
  // reintroduce the zero this module exists to remove.
  return placed[1] === 0
    ? [placed[0], HARTHMERE_EXTENSION_FEET_Y, placed[2]]
    : placed;
}

export function bibleStepWorldWaypoint(
  quest: BibleQuestDef,
  step: BibleQuestStep
): Vec3 {
  // Q12 OVERRIDE — load-bearing, not a special case.
  //
  // The authored catalog gave THREE different Wyrm's Bed locations, and the
  // authored Q12 waypoint resolves ~113 blocks BELOW the arena the renderer
  // actually draws. Without this, objective distance validation measures
  // against a point no player can stand on and returns `player_too_far` for
  // someone standing exactly where the game drew the dragon.
  //
  // The anchor is the single canonical one (bible_thaedryn.ts); the contract
  // test asserts the two agree, so the disagreement cannot silently return.
  const override = bibleThaedrynWaypointOverride(quest.id, step.id);
  if (override) return override;
  return bibleGroundedWorldWaypoint({
    questId: quest.id,
    stepId: step.id,
    authored: step.authoredWaypoint,
    purpose: biblePlacementPurpose(step.type),
  });
}

export function bibleQuestWorldWaypoint(quest: BibleQuestDef): Vec3 {
  if (quest.id === BIBLE_DRAGON_QUEST_ID) return bibleThaedrynArenaWorldAnchor();
  return bibleGroundedWorldWaypoint({
    questId: quest.id,
    authored: quest.authoredWaypoint,
    purpose: "quest_marker",
  });
}

/**
 * Every grounded waypoint a quest can put on the map, in step order.
 * Used by the map adapter, the E2E checkpoint generator, and the contract
 * test that asserts none of them is Y=0.
 */
export function bibleQuestWorldWaypoints(quest: BibleQuestDef): Vec3[] {
  return [
    bibleQuestWorldWaypoint(quest),
    ...quest.steps.map((step) => bibleStepWorldWaypoint(quest, step)),
  ];
}
