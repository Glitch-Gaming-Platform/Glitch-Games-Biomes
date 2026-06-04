import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  LIVE_ENTITY_HELPER_QUEST_STATE_KEY_V1,
  LIVE_ENTITY_HELPER_QUESTS_VERSION_V1,
  liveEntityHelperActiveQuestTargetMarkerIdsV1,
  liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1,
  type LiveEntityHelperQuestInstanceV1,
  type LiveEntityHelperQuestObjectiveBaselineV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";

export const LIVE_ENTITY_HELPER_QUEST_EVENT_V1 =
  "biomes:live-entity-helper-quest-v1";

export interface LiveEntityHelperQuestRecordV1 {
  questId: string;
  kind: LiveEntityHelperQuestInstanceV1["kind"];
  entityId: string;
  giverName: string;
  at: number;
  // Real world position of the quest-giver NPC, captured at accept time. Used to
  // send the player BACK to the giver once the objective is met. Previously the
  // giver position was read then thrown away, so the marker could never point
  // home for turn-in.
  giverPosition?: [number, number, number];
  // True once the objective (item collected / monster defeated) is satisfied but
  // the quest has not yet been turned in. Flips the map marker from the target
  // site to the giver.
  readyToTurnIn?: boolean;
  // What the player already had toward this quest the instant they accepted it.
  // Completion is measured as progress made AFTER accepting (current - baseline),
  // so carrying the required items (or a previously-killed boss) can never mark
  // the quest done on accept. See liveEntityHelperQuestEvidenceSinceBaselineV1.
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaselineV1;
}

export interface LiveEntityHelperQuestStateV1 {
  active: Record<string, LiveEntityHelperQuestRecordV1>;
  completed: Record<string, LiveEntityHelperQuestRecordV1>;
}

export const EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE_V1: LiveEntityHelperQuestStateV1 =
  {
    active: {},
    completed: {},
  };

export function isLiveEntityHelperQuestBrowserV1() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function liveEntityHelperQuestRecordV1(
  quest: LiveEntityHelperQuestInstanceV1,
  options?: {
    giverPosition?: readonly number[] | null;
    readyToTurnIn?: boolean;
    objectiveBaseline?: LiveEntityHelperQuestObjectiveBaselineV1;
  }
): LiveEntityHelperQuestRecordV1 {
  const g = options?.giverPosition;
  const giverPosition =
    g &&
    g.length >= 3 &&
    Number.isFinite(g[0]) &&
    Number.isFinite(g[1]) &&
    Number.isFinite(g[2])
      ? ([g[0], g[1], g[2]] as [number, number, number])
      : undefined;
  return {
    questId: quest.questId,
    kind: quest.kind,
    entityId: quest.entityId,
    giverName: quest.giverName,
    at: Date.now(),
    ...(giverPosition ? { giverPosition } : {}),
    ...(options?.readyToTurnIn ? { readyToTurnIn: true } : {}),
    ...(options?.objectiveBaseline
      ? { objectiveBaseline: options.objectiveBaseline }
      : {}),
  };
}

// Mark an ACTIVE quest as ready to turn in (objective met) or not, preserving
// the rest of the record (esp. the giver position). Flips the map marker home.
export function markLiveEntityHelperQuestReadyToTurnInV1(
  questId: string,
  ready: boolean,
  state = readLiveEntityHelperQuestStateV1()
): boolean {
  const record = state.active[questId];
  if (!record || Boolean(record.readyToTurnIn) === ready) {
    return false;
  }
  writeLiveEntityHelperQuestStateV1({
    ...state,
    active: {
      ...state.active,
      [questId]: { ...record, readyToTurnIn: ready },
    },
  });
  return true;
}

// Abandon an ACTIVE quest: drop it from the active set WITHOUT completing or
// rewarding it, so accepted-but-unfinished records (and their active markers)
// don't accumulate forever. Returns true if a quest was removed. Does not touch
// `completed`, so a previously finished quest is unaffected.
export function abandonLiveEntityHelperQuestV1(
  questId: string,
  state = readLiveEntityHelperQuestStateV1()
): boolean {
  if (!state.active[questId]) {
    return false;
  }
  const active = { ...state.active };
  delete active[questId];
  writeLiveEntityHelperQuestStateV1({ ...state, active });
  return true;
}

function storageKey() {
  return harthmereUserScopedStorageKey(LIVE_ENTITY_HELPER_QUEST_STATE_KEY_V1);
}

export function normalizeLiveEntityHelperQuestStateV1(
  raw: Partial<LiveEntityHelperQuestStateV1> | undefined
): LiveEntityHelperQuestStateV1 {
  return {
    active: raw?.active ?? {},
    completed: raw?.completed ?? {},
  };
}

export function readLiveEntityHelperQuestStateV1(): LiveEntityHelperQuestStateV1 {
  if (!isLiveEntityHelperQuestBrowserV1()) {
    return EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE_V1;
  }
  try {
    const raw = window.localStorage.getItem(storageKey());
    return normalizeLiveEntityHelperQuestStateV1(
      raw ? (JSON.parse(raw) as Partial<LiveEntityHelperQuestStateV1>) : {}
    );
  } catch {
    return EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE_V1;
  }
}

export function writeLiveEntityHelperQuestStateV1(
  state: LiveEntityHelperQuestStateV1
) {
  if (!isLiveEntityHelperQuestBrowserV1()) {
    return;
  }
  window.localStorage.setItem(
    storageKey(),
    JSON.stringify(normalizeLiveEntityHelperQuestStateV1(state))
  );
  window.dispatchEvent(new Event(LIVE_ENTITY_HELPER_QUEST_EVENT_V1));
}

export function activeLiveEntityHelperQuestMarkerIdV1(
  state = readLiveEntityHelperQuestStateV1()
) {
  return liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1(state.active);
}

export function activeLiveEntityHelperQuestMarkerIdsV1(
  state = readLiveEntityHelperQuestStateV1()
) {
  return liveEntityHelperActiveQuestTargetMarkerIdsV1(state.active);
}

export function isLiveEntityHelperMuckBossSpawnedV1(
  state = readLiveEntityHelperQuestStateV1()
) {
  return activeLiveEntityHelperQuestMarkerIdsV1(state).has(
    LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
  );
}

// The dialog identity is the quest's CONVERSATION PHASE, not a refresh counter.
// Keying on a refresh token meant every inventory/combat tick produced a new id,
// which restarted the NPC's typing animation and made them "repeat" the same
// line over and over. Phase-based identity only changes when the NPC genuinely
// has something new to say (offer -> active -> ready -> completed).
export type LiveEntityHelperQuestDialogPhaseV1 =
  | "offer"
  | "active"
  | "ready"
  | "completed";

export function liveEntityHelperQuestDialogPhaseV1(
  isActive: boolean,
  isCompleted: boolean,
  objectiveMet: boolean
): LiveEntityHelperQuestDialogPhaseV1 {
  if (isCompleted) return "completed";
  if (isActive) return objectiveMet ? "ready" : "active";
  return "offer";
}

export function liveEntityHelperQuestDialogKeyV1(
  questId: string,
  phase: LiveEntityHelperQuestDialogPhaseV1
) {
  return `${LIVE_ENTITY_HELPER_QUESTS_VERSION_V1}-${questId}-${phase}`;
}
