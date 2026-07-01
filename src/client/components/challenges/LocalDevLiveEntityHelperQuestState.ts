import { harthmereLocalStorage } from "@/client/util/storage";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
  LIVE_ENTITY_HELPER_QUEST_STATE_KEY,
  LIVE_ENTITY_HELPER_QUESTS_VERSION,
  liveEntityHelperActiveQuestTargetMarkerIds,
  liveEntityHelperPrimaryActiveQuestTargetMarkerId,
  type LiveEntityHelperQuestInstance,
  type LiveEntityHelperQuestObjectiveBaseline,
} from "@/shared/harthmere/live_entity_helper_quests";

export const LIVE_ENTITY_HELPER_QUEST_EVENT =
  "biomes:live-entity-helper-quest";

export interface LiveEntityHelperQuestRecord {
  questId: string;
  kind: LiveEntityHelperQuestInstance["kind"];
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
  // the quest done on accept. See liveEntityHelperQuestEvidenceSinceBaseline.
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaseline;
}

export interface LiveEntityHelperQuestState {
  active: Record<string, LiveEntityHelperQuestRecord>;
  completed: Record<string, LiveEntityHelperQuestRecord>;
}

export const EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE: LiveEntityHelperQuestState =
  {
    active: {},
    completed: {},
  };

export function isLiveEntityHelperQuestBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function liveEntityHelperQuestRecord(
  quest: LiveEntityHelperQuestInstance,
  options?: {
    giverPosition?: readonly number[] | null;
    readyToTurnIn?: boolean;
    objectiveBaseline?: LiveEntityHelperQuestObjectiveBaseline;
  }
): LiveEntityHelperQuestRecord {
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
export function markLiveEntityHelperQuestReadyToTurnIn(
  questId: string,
  ready: boolean,
  state = readLiveEntityHelperQuestState()
): boolean {
  const record = state.active[questId];
  if (!record || Boolean(record.readyToTurnIn) === ready) {
    return false;
  }
  writeLiveEntityHelperQuestState({
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
export function abandonLiveEntityHelperQuest(
  questId: string,
  state = readLiveEntityHelperQuestState()
): boolean {
  if (!state.active[questId]) {
    return false;
  }
  const active = { ...state.active };
  delete active[questId];
  writeLiveEntityHelperQuestState({ ...state, active });
  return true;
}

function storageKey() {
  return harthmereUserScopedStorageKey(LIVE_ENTITY_HELPER_QUEST_STATE_KEY);
}

export function normalizeLiveEntityHelperQuestState(
  raw: Partial<LiveEntityHelperQuestState> | undefined
): LiveEntityHelperQuestState {
  return {
    active: raw?.active ?? {},
    completed: raw?.completed ?? {},
  };
}

export function readLiveEntityHelperQuestState(): LiveEntityHelperQuestState {
  if (!isLiveEntityHelperQuestBrowser()) {
    return EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE;
  }
  try {
    const raw = harthmereLocalStorage.getItem(storageKey());
    return normalizeLiveEntityHelperQuestState(
      raw ? (JSON.parse(raw) as Partial<LiveEntityHelperQuestState>) : {}
    );
  } catch {
    return EMPTY_LIVE_ENTITY_HELPER_QUEST_STATE;
  }
}

export function writeLiveEntityHelperQuestState(
  state: LiveEntityHelperQuestState
) {
  if (!isLiveEntityHelperQuestBrowser()) {
    return;
  }
  harthmereLocalStorage.setItem(
    storageKey(),
    JSON.stringify(normalizeLiveEntityHelperQuestState(state))
  );
  window.dispatchEvent(new Event(LIVE_ENTITY_HELPER_QUEST_EVENT));
}

export function activeLiveEntityHelperQuestMarkerId(
  state = readLiveEntityHelperQuestState()
) {
  return liveEntityHelperPrimaryActiveQuestTargetMarkerId(state.active);
}

export function activeLiveEntityHelperQuestMarkerIds(
  state = readLiveEntityHelperQuestState()
) {
  return liveEntityHelperActiveQuestTargetMarkerIds(state.active);
}

export function isLiveEntityHelperMuckBossSpawned(
  state = readLiveEntityHelperQuestState()
) {
  return activeLiveEntityHelperQuestMarkerIds(state).has(
    LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
  );
}

// The dialog identity is the quest's CONVERSATION PHASE, not a refresh counter.
// Keying on a refresh token meant every inventory/combat tick produced a new id,
// which restarted the NPC's typing animation and made them "repeat" the same
// line over and over. Phase-based identity only changes when the NPC genuinely
// has something new to say (offer -> active -> ready -> completed).
export type LiveEntityHelperQuestDialogPhase =
  | "offer"
  | "active"
  | "ready"
  | "completed";

export function liveEntityHelperQuestDialogPhase(
  isActive: boolean,
  isCompleted: boolean,
  objectiveMet: boolean
): LiveEntityHelperQuestDialogPhase {
  if (isCompleted) return "completed";
  if (isActive) return objectiveMet ? "ready" : "active";
  return "offer";
}

export function liveEntityHelperQuestDialogKey(
  questId: string,
  phase: LiveEntityHelperQuestDialogPhase
) {
  return `${LIVE_ENTITY_HELPER_QUESTS_VERSION}-${questId}-${phase}`;
}
