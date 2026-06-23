// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE:
// "The Road Ahead" hands the player their first outfit out of the Clothing
// Crate once the route has moved past the Billy/Muckwad handoff and into the
// place-block practice. That is just before the "Gear Up" step, so the crate is
// already stocked when the user is pointed at it. Before then, the crate must
// NOT already contain quest clothing. This pure module decides "is it the right
// time?" from the snapshot mission state, with no React/client imports so it can
// be unit-tested directly.
//
import {
  SNAPSHOT_ROAD_AHEAD_MISSION,
  SNAPSHOT_ROAD_AHEAD_MISSION_ID,
} from "@/shared/harthmere/snapshot_complete_port";

// The state key MUST match LocalDevSnapshotMissionBridge.tsx. The step order
// comes from the shared Road Ahead mission source so the crate gate cannot drift
// from the playable quest.

export const HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_VERSION =
  "harthmere-road-ahead-clothing-gate" as const;

// Mirrors SNAPSHOT_MISSION_STATE_KEY / SNAPSHOT_MISSION_ID in the bridge.
export const ROAD_AHEAD_MISSION_STATE_KEY =
  "biomes.localDev.snapshotMissionState";
export const ROAD_AHEAD_MISSION_ID = SNAPSHOT_ROAD_AHEAD_MISSION_ID;

export const ROAD_AHEAD_STEP_ORDER = SNAPSHOT_ROAD_AHEAD_MISSION.steps.map(
  (step) => step.id
);

export const ROAD_AHEAD_CLOTHING_STEP_ID = "road_ahead_wear";
export const ROAD_AHEAD_CLOTHING_STOCK_STEP_ID = "road_ahead_place_blocks";
// Completing the Muckwad collection handoff advances currentStepIndex onto the
// place-block step, where the clothing crate should now be stocked.
export const ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID =
  "road_ahead_collect_muckwad";
// Legacy name for older imports: this is the step that used to be "preceding"
// the Gear Up gate, and is now the step where the crate stocks.
export const ROAD_AHEAD_PRECEDING_STEP_ID = ROAD_AHEAD_CLOTHING_STOCK_STEP_ID;

export interface RoadAheadGateState {
  accepted?: boolean;
  // Map of active mission id -> step index (the bridge's `active`).
  active?: Record<string, unknown> | null;
  // Array of completed mission ids (the bridge's `completed`).
  completed?: string[] | null;
  currentStepIndex?: number | null;
  completedStepIds?: string[] | null;
}

function clothingStockStepIndex() {
  return ROAD_AHEAD_STEP_ORDER.indexOf(ROAD_AHEAD_CLOTHING_STOCK_STEP_ID);
}

// True once the player has reached the crate-stocking handoff (or finished the
// mission).
// Deliberately permissive about HOW we know (index OR completed-step ids OR the
// mission being fully completed) so it stays correct whichever field the bridge
// updated, but never returns true before the mission is even accepted.
export function roadAheadClothingCrateReady(
  state?: RoadAheadGateState | null
): boolean {
  if (!state) {
    return false;
  }
  const completedMissions = state.completed ?? [];
  if (completedMissions.includes(ROAD_AHEAD_MISSION_ID)) {
    return true;
  }
  const accepted =
    Boolean(state.accepted) ||
    (state.active != null && state.active[ROAD_AHEAD_MISSION_ID] !== undefined);
  if (!accepted) {
    return false;
  }
  const idx =
    typeof state.currentStepIndex === "number" ? state.currentStepIndex : 0;
  const stockStepIndex = clothingStockStepIndex();
  if (stockStepIndex >= 0 && idx >= stockStepIndex) {
    return true;
  }
  const done = state.completedStepIds ?? [];
  return (
    done.includes(ROAD_AHEAD_CLOTHING_STEP_ID) ||
    done.includes(ROAD_AHEAD_CLOTHING_STOCK_STEP_ID) ||
    done.includes(ROAD_AHEAD_CLOTHING_STOCK_PRECEDING_STEP_ID) ||
    done.includes(ROAD_AHEAD_PRECEDING_STEP_ID)
  );
}

// Reads the live mission state from localStorage and applies the gate. Safe to
// call outside the browser (returns false). Lightweight: no JSON schema, just the
// few fields the gate needs.
export function readRoadAheadClothingCrateReady(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(ROAD_AHEAD_MISSION_STATE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as RoadAheadGateState;
    return roadAheadClothingCrateReady({
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
