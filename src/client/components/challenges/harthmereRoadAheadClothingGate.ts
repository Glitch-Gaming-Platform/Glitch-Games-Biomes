// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_V1:
// "The Road Ahead" hands the player their first outfit out of the Clothing
// Crate, but only AT the right point in the chain — the "Gear Up" step
// (`road_ahead_wear`), where Jackie tells you to put your kit on. Before that,
// the crate must NOT already contain the quest clothing (the player shouldn't be
// able to grab it early, and a quest marker shouldn't promise loot that isn't
// there yet). This pure module decides "is it the right time?" from the snapshot
// mission state, with no React/client imports so it can be unit-tested directly.
//
// The step ids + state key MUST match LocalDevSnapshotMissionBridge.tsx. We keep
// our own copy (rather than importing that heavy React module) and gate on the
// stable step-id STRINGS instead of a brittle numeric index where possible.

export const HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_VERSION_V1 =
  "harthmere-road-ahead-clothing-gate-v1" as const;

// Mirrors SNAPSHOT_MISSION_STATE_KEY_V71 / SNAPSHOT_MISSION_ID_V73 in the bridge.
export const ROAD_AHEAD_MISSION_STATE_KEY_V1 =
  "biomes.localDev.snapshotMissionState.v73";
export const ROAD_AHEAD_MISSION_ID_V1 = "snapshot_road_ahead_full_chain";

// Authored step order (must match the bridge's `steps` array order). steps[0] is
// the "meet Jackie" intro; the gear-up step is index 4.
export const ROAD_AHEAD_STEP_ORDER_V1 = [
  "meet_jackie_in_grove",
  "road_ahead_meet_up_with_billy",
  "road_ahead_collect_muckwad",
  "road_ahead_place_blocks",
  "road_ahead_wear",
  "road_ahead_find_bag",
  "road_ahead_selfie",
] as const;

export const ROAD_AHEAD_CLOTHING_STEP_ID_V1 = "road_ahead_wear";
// The step immediately before gear-up. Completing it is what advances
// currentStepIndex onto the gear-up step, so it is an equivalent "we are here" signal.
export const ROAD_AHEAD_PRECEDING_STEP_ID_V1 = "road_ahead_place_blocks";

export interface RoadAheadGateStateV1 {
  accepted?: boolean;
  // Map of active mission id -> step index (the bridge's `active`).
  active?: Record<string, unknown> | null;
  // Array of completed mission ids (the bridge's `completed`).
  completed?: string[] | null;
  currentStepIndex?: number | null;
  completedStepIds?: string[] | null;
}

function clothingStepIndexV1() {
  return ROAD_AHEAD_STEP_ORDER_V1.indexOf(ROAD_AHEAD_CLOTHING_STEP_ID_V1);
}

// True once the player has reached the gear-up step (or finished the mission).
// Deliberately permissive about HOW we know (index OR completed-step ids OR the
// mission being fully completed) so it stays correct whichever field the bridge
// updated, but never returns true before the mission is even accepted.
export function roadAheadClothingCrateReadyV1(
  state?: RoadAheadGateStateV1 | null
): boolean {
  if (!state) {
    return false;
  }
  const completedMissions = state.completed ?? [];
  if (completedMissions.includes(ROAD_AHEAD_MISSION_ID_V1)) {
    return true;
  }
  const accepted =
    Boolean(state.accepted) ||
    (state.active != null && state.active[ROAD_AHEAD_MISSION_ID_V1] !== undefined);
  if (!accepted) {
    return false;
  }
  const idx =
    typeof state.currentStepIndex === "number" ? state.currentStepIndex : 0;
  if (idx >= clothingStepIndexV1()) {
    return true;
  }
  const done = state.completedStepIds ?? [];
  return (
    done.includes(ROAD_AHEAD_CLOTHING_STEP_ID_V1) ||
    done.includes(ROAD_AHEAD_PRECEDING_STEP_ID_V1)
  );
}

// Reads the live mission state from localStorage and applies the gate. Safe to
// call outside the browser (returns false). Lightweight: no JSON schema, just the
// few fields the gate needs.
export function readRoadAheadClothingCrateReadyV1(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(ROAD_AHEAD_MISSION_STATE_KEY_V1);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as RoadAheadGateStateV1;
    return roadAheadClothingCrateReadyV1({
      accepted: Boolean(parsed.accepted),
      active: parsed.active ?? null,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      currentStepIndex:
        typeof parsed.currentStepIndex === "number"
          ? parsed.currentStepIndex
          : 0,
      completedStepIds: Array.isArray(parsed.completedStepIds)
        ? parsed.completedStepIds
        : [],
    });
  } catch {
    return false;
  }
}
