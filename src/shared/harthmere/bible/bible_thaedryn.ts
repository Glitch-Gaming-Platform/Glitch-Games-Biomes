// BIBLE_THAEDRYN
//
// Leaf module holding the Thaedryn encounter's identity and canonical anchor.
//
// WHY THESE MOVED HERE
// --------------------
// They previously lived in `bible_quest_live_authority.ts`, which imports the
// 25k-line legacy catalog, `quest_runtime.ts`, `thaedryn_boss.ts` and
// `main_quest_spaces.ts`. Any module needing the dragon's entity id therefore
// dragged that entire graph in, which would have put the Bible fast suite back
// on the server bootstrap it exists to avoid (TESTING_FASTER section 3).
//
// This module imports two constants and nothing else. Phase 4 makes
// `bible_quest_live_authority.ts` re-export from here rather than the reverse,
// so there is exactly one definition throughout.
//
// REACHABILITY GUARANTEE (retained verbatim from the 2026-07-14 wiring)
// --------------------------------------------------------------------
// The authored catalog gave THREE different Wyrm's Bed locations — quest
// waypoint (500, -160), quest-space entry (520, -408), and the renderer's
// dragon chamber (~640, -268). No test caught the disagreement because each
// location was only ever checked against its own file. ONE anchor is canonical
// here: the renderer's phase-safe dragon chamber, drawn on walkable ground in
// the Old Well / Underways district, reachable on foot from the Harthmere
// connector road with no digging, ladder, or portal.
//
// The anchor carries a real feet Y because combat reach and objective distance
// are both 3D. Leaving it at Y=0 soft-locks the encounter.

import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import type { Vec3 } from "@/shared/math/types";

export const BIBLE_THAEDRYN_VERSION = 1 as const;

export const BIBLE_DRAGON_QUEST_ID = "bellbound_q12_thaedryn_bellbound";

/** Exact native entity id for the quest-gated Thaedryn NPC. */
export const BIBLE_THAEDRYN_ENTITY_ID = 8_810_000_000_019_120;

/** Compatibility key used by legacy snapshot maps and the visible target. */
export const BIBLE_THAEDRYN_COMBAT_ENTITY_KEY = "8810000000019120" as const;

export const BIBLE_THAEDRYN_ARENA_AUTHORED_ANCHOR: Vec3 = [
  640,
  HARTHMERE_EXTENSION_FEET_Y,
  -268,
];

export function bibleThaedrynArenaWorldAnchor(): Vec3 {
  return shiftHarthmereAuthoredPositionToWorld(
    BIBLE_THAEDRYN_ARENA_AUTHORED_ANCHOR
  ) as Vec3;
}

/**
 * Q12 objective ids, in authored order.
 *
 * Objective 1 (enter) completes on proximity to the arena anchor; objective 2
 * (survive) completes when the boss state machine resolves; 3 and 4 (the path
 * choice and the aftermath) complete from that same resolution.
 */
export const BIBLE_Q12_OBJECTIVE_IDS = Object.freeze({
  enter: "bellbound_q12_thaedryn_bellbound_obj_01",
  survive: "bellbound_q12_thaedryn_bellbound_obj_02",
  choose: "bellbound_q12_thaedryn_bellbound_obj_03",
  aftermath: "bellbound_q12_thaedryn_bellbound_obj_04",
} as const);

/**
 * Objectives whose distance validation is widened to the arena anchor.
 *
 * Without this, the authored-location disagreement above can produce
 * `player_too_far` for a player standing exactly where the game drew the
 * dragon.
 */
export function bibleThaedrynWaypointOverride(
  questId: string,
  stepId: string
): Vec3 | undefined {
  if (questId !== BIBLE_DRAGON_QUEST_ID) return undefined;
  return Object.values(BIBLE_Q12_OBJECTIVE_IDS).includes(
    stepId as (typeof BIBLE_Q12_OBJECTIVE_IDS)[keyof typeof BIBLE_Q12_OBJECTIVE_IDS]
  )
    ? bibleThaedrynArenaWorldAnchor()
    : undefined;
}
