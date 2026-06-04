import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  LIVE_ENTITY_HELPER_QUEST_STATE_KEY_V1,
  LIVE_ENTITY_HELPER_QUESTS_VERSION_V1,
  liveEntityHelperActiveQuestTargetMarkerIdsV1,
  liveEntityHelperPrimaryActiveQuestTargetMarkerIdV1,
  type LiveEntityHelperQuestInstanceV1,
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

export function liveEntityHelperQuestDialogKeyV1(
  questId: string,
  isActive: boolean,
  isCompleted: boolean,
  refreshToken: number
) {
  return `${LIVE_ENTITY_HELPER_QUESTS_VERSION_V1}-${questId}-${isActive}-${isCompleted}-${refreshToken}`;
}
