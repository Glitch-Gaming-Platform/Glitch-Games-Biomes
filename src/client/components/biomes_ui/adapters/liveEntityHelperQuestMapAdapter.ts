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

export interface BiomesUILiveEntityHelperRoutingOptions {
  // Live override for "objective met". When omitted the stored
  // record.readyToTurnIn flag is used. The live BiomesUI adapter passes the same
  // resolver as turn-in; either the live check or server-backed record can mark
  // the quest ready, so a stale client-side read cannot hide a ready turn-in.
  isReadyToTurnIn?: (record: BiomesUILiveEntityHelperQuestRecord) => boolean;
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

function liveEntityHelperQuestPartsFromQuestId(questId: string) {
  const match = questId.match(
    /^live-helper:([^:]+):(exotic_matter|food_water|hard_boss)$/
  );
  if (!match || !isLiveEntityHelperQuestKind(match[2])) return undefined;
  return { entityId: match[1], kind: match[2] };
}

function normalizeLiveEntityHelperQuestRecordFromLiveQuestState(
  questId: string,
  value: unknown,
  fallbackAt?: number
): BiomesUILiveEntityHelperQuestRecord | undefined {
  const parts = liveEntityHelperQuestPartsFromQuestId(questId);
  if (!parts) return undefined;
  const record = value && typeof value === "object" ? (value as any) : {};
  const kind = isLiveEntityHelperQuestKind(record.questKind)
    ? record.questKind
    : parts.kind;
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
  const progress = Number(record.progress);
  const stepId = typeof record.stepId === "string" ? record.stepId : "";
  const readyToTurnIn =
    record.readyToTurnIn === true ||
    (kind === "hard_boss" &&
      (stepId.includes("boss_defeated") ||
        (Number.isFinite(progress) && progress >= 1)));
  const at = Number(record.at ?? record.acceptedAtMs ?? fallbackAt);
  return {
    questId,
    kind,
    entityId:
      typeof record.entityId === "string" && record.entityId.trim()
        ? record.entityId.trim()
        : parts.entityId,
    giverName:
      typeof record.giverName === "string" && record.giverName.trim()
        ? record.giverName.trim()
        : typeof record.entityLabel === "string" && record.entityLabel.trim()
        ? record.entityLabel.trim()
        : "Helper",
    ...(Number.isFinite(at) && at > 0 ? { at } : {}),
    ...(giverPosition ? { giverPosition } : {}),
    ...(readyToTurnIn ? { readyToTurnIn: true } : {}),
  };
}

export function liveEntityHelperQuestStateFromLiveQuestStateForBiomesUI(
  liveQuestState: unknown
): BiomesUILiveEntityHelperQuestState {
  const raw =
    liveQuestState && typeof liveQuestState === "object"
      ? (liveQuestState as any)
      : {};
  const updatedAtMs =
    Number.isFinite(Number(raw.updatedAtMs)) && Number(raw.updatedAtMs) > 0
      ? Number(raw.updatedAtMs)
      : undefined;
  const active =
    raw.active && typeof raw.active === "object" && !Array.isArray(raw.active)
      ? raw.active
      : {};
  const completed =
    raw.completed &&
    typeof raw.completed === "object" &&
    !Array.isArray(raw.completed)
      ? raw.completed
      : {};
  return {
    active: Object.fromEntries(
      Object.entries(active)
        .map(([questId, value]) => [
          questId,
          normalizeLiveEntityHelperQuestRecordFromLiveQuestState(
            questId,
            value,
            updatedAtMs
          ),
        ])
        .filter(
          (entry): entry is [string, BiomesUILiveEntityHelperQuestRecord] =>
            Boolean(entry[1])
        )
    ),
    completed: Object.fromEntries(
      Object.entries(completed)
        .map(([questId, value]) => [
          questId,
          normalizeLiveEntityHelperQuestRecordFromLiveQuestState(
            questId,
            {},
            Number(value) || updatedAtMs
          ),
        ])
        .filter(
          (entry): entry is [string, BiomesUILiveEntityHelperQuestRecord] =>
            Boolean(entry[1])
        )
    ),
  };
}

export function mergeLiveEntityHelperQuestStatesForBiomesUI(
  localRaw: unknown,
  liveQuestState: unknown
): BiomesUILiveEntityHelperQuestState {
  const local = normalizeLiveEntityHelperQuestStateForBiomesUI(localRaw) ?? {
    active: {},
    completed: {},
  };
  const live =
    liveEntityHelperQuestStateFromLiveQuestStateForBiomesUI(liveQuestState);
  return {
    active: { ...live.active, ...local.active },
    completed: { ...live.completed, ...local.completed },
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

function liveEntityHelperRecordReadyToTurnIn(
  record: BiomesUILiveEntityHelperQuestRecord,
  options?: BiomesUILiveEntityHelperRoutingOptions
) {
  return (
    Boolean(record.readyToTurnIn) || options?.isReadyToTurnIn?.(record) === true
  );
}

function liveEntityHelperReadyObjective(
  record: BiomesUILiveEntityHelperQuestRecord
) {
  const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
  return `${definition.readyText} Return to ${record.giverName} to turn in.`;
}

function liveEntityHelperLandmarkIdForPhase(
  markerId: string,
  record: BiomesUILiveEntityHelperQuestRecord,
  phase: "target" | "return_to_giver"
) {
  // Multiple helper quests can share one target marker while incomplete, but
  // ready turn-ins must be separate pins because each can return to a different
  // giver.
  return phase === "return_to_giver"
    ? `live_entity_helper_return:${record.questId}`
    : markerId;
}

function liveEntityHelperFirstMarkerIdForRecord(
  record: BiomesUILiveEntityHelperQuestRecord,
  options?: BiomesUILiveEntityHelperRoutingOptions
) {
  const marker = liveEntityHelperQuestTargetMarkerForKind(record.kind);
  if (!marker) return undefined;
  const resolved = liveEntityHelperResolveQuestMarker({
    kind: record.kind,
    readyToTurnIn: liveEntityHelperRecordReadyToTurnIn(record, options),
    giverPosition: record.giverPosition,
    giverName: record.giverName,
  });
  return liveEntityHelperLandmarkIdForPhase(marker.id, record, resolved.phase);
}

export function liveEntityHelperAcceptedQuestLandmarksForBiomesUI(
  raw: unknown,
  options?: BiomesUILiveEntityHelperRoutingOptions
): BiomesUILiveEntityHelperQuestLandmark[] {
  const seenLandmarkIds = new Set<string>();
  return activeRecords(raw).flatMap((record) => {
    const marker = liveEntityHelperQuestTargetMarkerForKind(record.kind);
    if (!marker) return [];
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
    const readyToTurnIn = liveEntityHelperRecordReadyToTurnIn(record, options);
    // Point at the real target while the objective is open; flip to the giver
    // (return home to turn in) once it's met.
    const resolved = liveEntityHelperResolveQuestMarker({
      kind: record.kind,
      readyToTurnIn,
      giverPosition: record.giverPosition,
      giverName: record.giverName,
    });
    const landmarkId = liveEntityHelperLandmarkIdForPhase(
      marker.id,
      record,
      resolved.phase
    );
    if (seenLandmarkIds.has(landmarkId)) return [];
    seenLandmarkIds.add(landmarkId);
    return [
      {
        id: landmarkId,
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
  raw: unknown,
  options?: BiomesUILiveEntityHelperRoutingOptions
): MapTrackableQuest[] {
  const state = normalizeLiveEntityHelperQuestStateForBiomesUI(raw);
  if (!state) return [];
  const activeIds = new Set(Object.keys(state.active));
  const active = Object.values(state.active)
    .sort((left, right) => (right.at ?? 0) - (left.at ?? 0))
    .map((record) => {
      const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
      const readyToTurnIn = liveEntityHelperRecordReadyToTurnIn(
        record,
        options
      );
      const objective = readyToTurnIn
        ? liveEntityHelperReadyObjective(record)
        : definition.activeText;
      return {
        questId: record.questId,
        title: definition.title,
        area: `${record.giverName} - ${areaLabelForKind(record.kind)}`,
        status: "active" as const,
        firstMarkerId: liveEntityHelperFirstMarkerIdForRecord(record, options),
        reward: rewardForKind(record.kind),
        kind: record.kind,
        kindLabel: "Helper Quest",
        objective,
        objectives: [objective],
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

export function activeLiveEntityHelperMissionStepsForBiomesUI(
  raw: unknown,
  options?: BiomesUILiveEntityHelperRoutingOptions
) {
  return activeRecords(raw).map((record, index) => {
    const definition = LIVE_ENTITY_HELPER_QUEST_DEFINITIONS[record.kind];
    const objective = liveEntityHelperRecordReadyToTurnIn(record, options)
      ? liveEntityHelperReadyObjective(record)
      : definition.activeText;
    return {
      id: record.questId,
      title: `Helper quest ${index + 1}`,
      objective: `${record.giverName}: ${objective}`,
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
