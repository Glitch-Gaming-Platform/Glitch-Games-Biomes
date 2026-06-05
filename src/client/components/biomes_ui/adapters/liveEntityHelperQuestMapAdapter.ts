import {
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1,
  liveEntityHelperQuestRewardSummaryV1,
  liveEntityHelperQuestTargetMarkerForKindV1,
  liveEntityHelperResolveQuestMarkerV1,
  type LiveEntityHelperQuestKindV1,
  type LiveEntityHelperQuestObjectiveBaselineV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import type { Vec3 } from "@/shared/math/types";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

export const BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE_V1 =
  "live_entity_helper_quest" as const;

export interface BiomesUILiveEntityHelperQuestRecordV1 {
  questId: string;
  kind: LiveEntityHelperQuestKindV1;
  entityId: string;
  giverName: string;
  at?: number;
  giverPosition?: readonly number[];
  readyToTurnIn?: boolean;
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaselineV1;
}

export interface BiomesUILiveEntityHelperQuestStateV1 {
  active: Record<string, BiomesUILiveEntityHelperQuestRecordV1>;
  completed: Record<string, BiomesUILiveEntityHelperQuestRecordV1>;
}

export interface BiomesUILiveEntityHelperQuestLandmarkV1 {
  id: string;
  label: string;
  position: Vec3;
  kind: "resource" | "danger" | "objective";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  active: true;
  description: string;
  source: typeof BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE_V1;
  questKind: LiveEntityHelperQuestKindV1;
}

function isLiveEntityHelperQuestKindV1(
  value: unknown
): value is LiveEntityHelperQuestKindV1 {
  return (
    value === "exotic_matter" || value === "food_water" || value === "hard_boss"
  );
}

function normalizeRecordV1(
  questId: string,
  value: unknown
): BiomesUILiveEntityHelperQuestRecordV1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (!isLiveEntityHelperQuestKindV1(record.kind)) return undefined;
  const gp = record.giverPosition;
  const giverPosition =
    Array.isArray(gp) &&
    gp.length >= 3 &&
    Number.isFinite(gp[0]) &&
    Number.isFinite(gp[1]) &&
    Number.isFinite(gp[2])
      ? ([Number(gp[0]), Number(gp[1]), Number(gp[2])] as [
          number,
          number,
          number
        ])
      : undefined;
  return {
    questId:
      typeof record.questId === "string" && record.questId.length > 0
        ? record.questId
        : questId,
    kind: record.kind,
    entityId:
      typeof record.entityId === "string" && record.entityId.length > 0
        ? record.entityId
        : "unknown",
    giverName:
      typeof record.giverName === "string" && record.giverName.trim()
        ? record.giverName.trim()
        : "Someone beyond the Grove",
    at:
      typeof record.at === "number" && Number.isFinite(record.at)
        ? record.at
        : undefined,
    ...(giverPosition ? { giverPosition } : {}),
    ...(record.readyToTurnIn === true ? { readyToTurnIn: true } : {}),
    ...(() => {
      const baseline = normalizeObjectiveBaselineV1(record.objectiveBaseline);
      return baseline ? { objectiveBaseline: baseline } : {};
    })(),
  };
}

function normalizeObjectiveBaselineV1(
  value: unknown
): LiveEntityHelperQuestObjectiveBaselineV1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const inventory: Record<string, number> = {};
  if (raw.inventory && typeof raw.inventory === "object") {
    for (const [itemId, count] of Object.entries(
      raw.inventory as Record<string, unknown>
    )) {
      const n = Number(count);
      if (Number.isFinite(n) && n > 0) {
        inventory[itemId] = Math.floor(n);
      }
    }
  }
  const hardBossDefeats = Number(raw.hardBossDefeats);
  return {
    inventory,
    hardBossDefeats:
      Number.isFinite(hardBossDefeats) && hardBossDefeats > 0
        ? Math.floor(hardBossDefeats)
        : 0,
  };
}

export function normalizeLiveEntityHelperQuestStateForBiomesUIV1(
  raw: unknown
): BiomesUILiveEntityHelperQuestStateV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const active = (raw as any).active;
  const completed = (raw as any).completed;
  const normalizeBucket = (bucket: unknown) => {
    if (!bucket || typeof bucket !== "object") return {};
    return Object.fromEntries(
      Object.entries(bucket)
        .map(([questId, value]) => [questId, normalizeRecordV1(questId, value)])
        .filter(
          (entry): entry is [string, BiomesUILiveEntityHelperQuestRecordV1] =>
            Boolean(entry[1])
        )
    );
  };
  return {
    active: normalizeBucket(active),
    completed: normalizeBucket(completed),
  };
}

function activeRecordsV1(raw: unknown) {
  const state = normalizeLiveEntityHelperQuestStateForBiomesUIV1(raw);
  return Object.values(state?.active ?? {}).sort(
    (left, right) => (right.at ?? 0) - (left.at ?? 0)
  );
}

function areaLabelForKindV1(kind: LiveEntityHelperQuestKindV1) {
  return (
    liveEntityHelperQuestTargetMarkerForKindV1(kind)?.areaLabel ??
    "Remote Biomes"
  );
}

function rewardForKindV1(kind: LiveEntityHelperQuestKindV1) {
  return liveEntityHelperQuestRewardSummaryV1(
    LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[kind].rewards
  );
}

export function liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1(
  raw: unknown,
  options?: {
    // Live override for "objective met". When omitted the stored
    // record.readyToTurnIn flag is used. The BiomesUI adapter passes a live
    // resolver so the marker flips home the moment the item is collected /
    // monster defeated, without waiting for a stored-flag write.
    isReadyToTurnIn?: (
      record: BiomesUILiveEntityHelperQuestRecordV1
    ) => boolean;
  }
): BiomesUILiveEntityHelperQuestLandmarkV1[] {
  const seenMarkerIds = new Set<string>();
  return activeRecordsV1(raw).flatMap((record) => {
    const marker = liveEntityHelperQuestTargetMarkerForKindV1(record.kind);
    if (!marker || seenMarkerIds.has(marker.id)) return [];
    seenMarkerIds.add(marker.id);
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind];
    const readyToTurnIn =
      options?.isReadyToTurnIn?.(record) ?? Boolean(record.readyToTurnIn);
    // Point at the real target while the objective is open; flip to the giver
    // (return home to turn in) once it's met.
    const resolved = liveEntityHelperResolveQuestMarkerV1({
      kind: record.kind,
      readyToTurnIn,
      giverPosition: record.giverPosition,
      giverName: record.giverName,
    });
    return [
      {
        id: marker.id,
        label: resolved.label,
        position: [...resolved.position] as Vec3,
        kind: resolved.kind,
        area: resolved.areaLabel,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description:
          resolved.phase === "return_to_giver"
            ? `Objective complete — return to ${record.giverName} to turn in.`
            : definition.activeText,
        source: BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE_V1,
        questKind: record.kind,
      },
    ];
  });
}

export function liveEntityHelperTrackableQuestsForBiomesUIV1(
  raw: unknown
): MapTrackableQuest[] {
  const state = normalizeLiveEntityHelperQuestStateForBiomesUIV1(raw);
  if (!state) return [];
  const activeIds = new Set(Object.keys(state.active));
  const active = Object.values(state.active)
    .sort((left, right) => (right.at ?? 0) - (left.at ?? 0))
    .map((record) => {
      const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind];
      const marker = liveEntityHelperQuestTargetMarkerForKindV1(record.kind);
      return {
        questId: record.questId,
        title: definition.title,
        area: `${record.giverName} - ${areaLabelForKindV1(record.kind)}`,
        status: "active" as const,
        firstMarkerId: marker?.id,
        reward: rewardForKindV1(record.kind),
        kind: record.kind,
        kindLabel: "Helper Quest",
        objective: definition.activeText,
        objectives: [definition.activeText],
        description: definition.offerText,
      };
    });
  const completed = Object.values(state.completed)
    .filter((record) => !activeIds.has(record.questId))
    .sort((left, right) => (right.at ?? 0) - (left.at ?? 0))
    .map((record) => {
      const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind];
      return {
        questId: record.questId,
        title: definition.title,
        area: `${record.giverName} - ${areaLabelForKindV1(record.kind)}`,
        status: "completed" as const,
        reward: rewardForKindV1(record.kind),
        kind: record.kind,
        kindLabel: "Helper Quest",
        objective: definition.completionText,
        objectives: [definition.activeText],
        description: definition.offerText,
      };
    });
  return [...active, ...completed];
}

export function activeLiveEntityHelperMissionStepsForBiomesUIV1(raw: unknown) {
  return activeRecordsV1(raw).map((record, index) => {
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind];
    return {
      id: record.questId,
      title: `Helper quest ${index + 1}`,
      objective: `${record.giverName}: ${definition.activeText}`,
      done: false,
    };
  });
}

export function firstActiveLiveEntityHelperQuestTitleForBiomesUIV1(
  raw: unknown
) {
  const record = activeRecordsV1(raw)[0];
  return record
    ? LIVE_ENTITY_HELPER_QUEST_DEFINITIONS_V1[record.kind].title
    : undefined;
}
