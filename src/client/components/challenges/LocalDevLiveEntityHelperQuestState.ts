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
  quest: LiveEntityHelperQuestInstanceV1
): LiveEntityHelperQuestRecordV1 {
  return {
    questId: quest.questId,
    kind: quest.kind,
    entityId: quest.entityId,
    giverName: quest.giverName,
    at: Date.now(),
  };
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
