import {
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  liveEntityHelperQuestRewardSummary,
  liveEntityHelperQuestTargetMarkerForKind,
  liveEntityHelperResolveQuestMarker,
  type LiveEntityHelperQuestKind,
  type LiveEntityHelperQuestObjectiveBaseline,
} from "@/shared/harthmere/live_entity_helper_quests";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import type { Vec3 } from "@/shared/math/types";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

export const BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE =
  "live_entity_helper_quest" as const;

export interface BiomesUILiveEntityHelperQuestRecord {
  questId: string;
  kind: LiveEntityHelperQuestKind;
  entityId: string;
  giverName: string;
  at?: number;
  giverPosition?: readonly number[];
  readyToTurnIn?: boolean;
  objectiveBaseline?: LiveEntityHelperQuestObjectiveBaseline;
}

export interface BiomesUILiveEntityHelperQuestState {
  active: Record<string, BiomesUILiveEntityHelperQuestRecord>;
  completed: Record<string, BiomesUILiveEntityHelperQuestRecord>;
}

export interface BiomesUILiveEntityHelperQuestLandmark {
  id: string;
  label: string;
  position: Vec3;
  kind: "resource" | "danger" | "objective";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  active: true;
  description: string;
  source: typeof BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE;
  questKind: LiveEntityHelperQuestKind;
}

function isLiveEntityHelperQuestKind(
  value: unknown
): value is LiveEntityHelperQuestKind {
  return (
    value === "exotic_matter" || value === "food_water" || value === "hard_boss"
  );
}

function normalizeRecord(
  questId: string,
  value: unknown
): BiomesUILiveEntityHelperQuestRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (!isLiveEntityHelperQuestKind(record.kind)) return undefined;
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
      const baseline = normalizeObjectiveBaseline(record.objectiveBaseline);
      return baseline ? { objectiveBaseline: baseline } : {};
    })(),
  };
}

function normalizeObjectiveBaseline(
  value: unknown
): LiveEntityHelperQuestObjectiveBaseline | undefined {
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

export function normalizeLiveEntityHelperQuestStateForBiomesUI(
  raw: unknown
): BiomesUILiveEntityHelperQuestState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const active = (raw as any).active;
  const completed = (raw as any).completed;
  const normalizeBucket = (bucket: unknown) => {
    if (!bucket || typeof bucket !== "object") return {};
    return Object.fromEntries(
      Object.entries(bucket)
        .map(([questId, value]) => [questId, normalizeRecord(questId, value)])
        .filter(
          (entry): entry is [string, BiomesUILiveEntityHelperQuestRecord] =>
            Boolean(entry[1])
        )
    );
  };
  return {
    active: normalizeBucket(active),
    completed: normalizeBucket(completed),
  };
}

function activeRecords(raw: unknown) {
  const state = normalizeLiveEntityHelperQuestStateForBiomesUI(raw);
  return Object.values(state?.active ?? {}).sort(
    (left, right) => (right.at ?? 0) - (left.at ?? 0)
  );
}

function areaLabelForKind(kind: LiveEntityHelperQuestKind) {
  return (
    liveEntityHelperQuestTargetMarkerForKind(kind)?.areaLabel ?? "Remote Biomes"
  );
}

function rewardForKind(kind: LiveEntityHelperQuestKind) {
  return liveEntityHelperQuestRewardSummary(
    LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[kind].rewards
  );
}

export function liveEntityHelperAcceptedQuestLandmarksForBiomesUI(
  raw: unknown,
  options?: {
    // Live override for "objective met". When omitted the stored
    // record.readyToTurnIn flag is used. The BiomesUI adapter passes a live
    // resolver so the marker flips home the moment the item is collected /
    // monster defeated, without waiting for a stored-flag write.
    isReadyToTurnIn?: (record: BiomesUILiveEntityHelperQuestRecord) => boolean;
  }
): BiomesUILiveEntityHelperQuestLandmark[] {
  const seenMarkerIds = new Set<string>();
  return activeRecords(raw).flatMap((record) => {
    const marker = liveEntityHelperQuestTargetMarkerForKind(record.kind);
    if (!marker || seenMarkerIds.has(marker.id)) return [];
    seenMarkerIds.add(marker.id);
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
    const readyToTurnIn =
      options?.isReadyToTurnIn?.(record) ?? Boolean(record.readyToTurnIn);
    // Point at the real target while the objective is open; flip to the giver
    // (return home to turn in) once it's met.
    const resolved = liveEntityHelperResolveQuestMarker({
      kind: record.kind,
      readyToTurnIn,
      giverPosition: record.giverPosition,
      giverName: record.giverName,
    });
    return [
      {
        id: marker.id,
        label: resolved.label,
        position: resolveHarthmereProductionMarkerPosition({
          markerId: undefined,
          fallback: resolved.position,
        }),
        kind: resolved.kind,
        area: resolved.areaLabel,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description:
          resolved.phase === "return_to_giver"
            ? `Objective complete — return to ${record.giverName} to turn in.`
            : definition.activeText,
        source: BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE,
        questKind: record.kind,
      },
    ];
  });
}

export function liveEntityHelperTrackableQuestsForBiomesUI(
  raw: unknown
): MapTrackableQuest[] {
  const state = normalizeLiveEntityHelperQuestStateForBiomesUI(raw);
  if (!state) return [];
  const activeIds = new Set(Object.keys(state.active));
  const active = Object.values(state.active)
    .sort((left, right) => (right.at ?? 0) - (left.at ?? 0))
    .map((record) => {
      const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
      const marker = liveEntityHelperQuestTargetMarkerForKind(record.kind);
      return {
        questId: record.questId,
        title: definition.title,
        area: `${record.giverName} - ${areaLabelForKind(record.kind)}`,
        status: "active" as const,
        firstMarkerId: marker?.id,
        reward: rewardForKind(record.kind),
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
      const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
      return {
        questId: record.questId,
        title: definition.title,
        area: `${record.giverName} - ${areaLabelForKind(record.kind)}`,
        status: "completed" as const,
        reward: rewardForKind(record.kind),
        kind: record.kind,
        kindLabel: "Helper Quest",
        objective: definition.completionText,
        objectives: [definition.activeText],
        description: definition.offerText,
      };
    });
  return [...active, ...completed];
}

export function activeLiveEntityHelperMissionStepsForBiomesUI(raw: unknown) {
  return activeRecords(raw).map((record, index) => {
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
    return {
      id: record.questId,
      title: `Helper quest ${index + 1}`,
      objective: `${record.giverName}: ${definition.activeText}`,
      done: false,
    };
  });
}

export function firstActiveLiveEntityHelperQuestTitleForBiomesUI(raw: unknown) {
  const record = activeRecords(raw)[0];
  return record
    ? LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind].title
    : undefined;
}
