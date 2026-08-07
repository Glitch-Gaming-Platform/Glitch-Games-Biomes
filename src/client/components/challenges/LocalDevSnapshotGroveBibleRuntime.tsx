import { harthmereLocalStorage } from "@/client/util/storage";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  grantHarthmereItem,
  grantHarthmereItemLocallyForTest,
  grantHarthmereTutorialInventoryItem,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_CRAFT_COMPLETED_EVENT,
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT,
  type HarthmereLocalCombatNpcDamageEventDetail,
} from "@/client/components/challenges/harthmereEvents";
import {
  HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
  type HarthmereWorldObjectInteractionEventDetail,
} from "@/client/components/challenges/harthmereObjectInteractions";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  readActiveBiomesUIMapPin,
  requestBiomesUILocateOnMap,
  writeActiveBiomesUIMapPin,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { harthmereLiveServerAuthoritative } from "@/client/components/challenges/harthmereLiveAuthoritySignal";
import { addToast } from "@/client/components/toast/helpers";
import {
  HarthmereQuestActionError,
  harthmereQuestRejectionWarningsFromResponse,
} from "@/client/components/challenges/questActionError";
import type { GardenHoseEvent } from "@/client/events/api";
import { JACKIE_ID } from "@/client/util/nux/state_machines";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION,
  SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS,
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveGroundedPosition,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
  snapshotGroveNpcIdFromEntityId,
  type SnapshotGroveLandmark,
  type SnapshotGroveNpc,
  type SnapshotGroveQuest,
  type SnapshotGroveTrigger,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  groveQuest,
  groveQuestIdsForGiver,
} from "@/shared/harthmere/grove/grove_quest_catalog";
import {
  groveQuestGate,
  groveQuestGateReasons,
} from "@/shared/harthmere/grove/grove_quest_gate";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import { canonicalSnapshotGroveNpcEntityId } from "@/shared/harthmere/snapshot_grove_ids";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import { snapshotGroveAmbientLineForNpc } from "@/shared/harthmere/snapshot_grove_ambient_dialogue";
import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT,
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET,
  snapshotGroveCollectEventMatchesObjective,
  snapshotGroveCraftEventMatchesObjective,
  snapshotGroveEventCompletionCount,
  snapshotGroveInventoryEventMatchesObjective,
  snapshotGroveItemUseEventMatchesObjective,
  snapshotGroveObjectiveMarkerIdForProgress,
  snapshotGroveObjectiveRequiredCount,
  snapshotGroveObjectiveTargetMarkerIds,
  snapshotGrovePracticeItemFixtureForObjective,
  snapshotGroveTutorialInventoryGrantsForQuest,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION =
  "snapshot-grove-mission-critical snapshot-grove-mission-critical snapshot-grove-bible-graduation-chain";

export const SNAPSHOT_GROVE_QUEST_STATE_KEY =
  "biomes.localDev.snapshotGroveQuestState";

export const SNAPSHOT_GROVE_QUEST_STATE_EVENT =
  "biomes:local-dev-snapshot-grove-quest-state";

export const SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT =
  "biomes:snapshot-grove-live-quest-state-sync";

const SNAPSHOT_GROVE_LIKEABILITY_KEY =
  "biomes.localDev.snapshotGroveLikeability";

// SNAPSHOT_GROVE_QUEST_MARKER_VISIBILITY:
// The Grove map should show every step marker for the active quest at the
// same time, so the player can see the full path of the lesson and which
// stop they are on. Previously a single nav-aid id replaced markers as the
// step advanced; current reserves a contiguous range so up to 12 step markers
// can coexist on the world map.
const SNAPSHOT_GROVE_NAV_AID_BASE = 750_100;
const SNAPSHOT_GROVE_NAV_AID_MAX_STEPS = 12;
const SNAPSHOT_GROVE_NAV_AID_LEGACY = 750_075;
const SNAPSHOT_GROVE_ACTIVE_MARKER_AUTOREMOVE = {
  autoremoveWhenNear: true,
} as const;
const SNAPSHOT_GROVE_QUEST_CONTROLLED_MARKER = {
  autoremoveWhenNear: false,
} as const;
function snapshotGroveStepNavAidId(stepIndex: number) {
  const clamped = Math.max(
    0,
    Math.min(SNAPSHOT_GROVE_NAV_AID_MAX_STEPS - 1, stepIndex)
  );
  return SNAPSHOT_GROVE_NAV_AID_BASE + clamped;
}
function snapshotGroveAllStepNavAidIds() {
  return Array.from(
    { length: SNAPSHOT_GROVE_NAV_AID_MAX_STEPS },
    (_unused, index) => SNAPSHOT_GROVE_NAV_AID_BASE + index
  );
}

const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET = new Set<string>(
  SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS
);

const SNAPSHOT_GROVE_QUEST_ID_SET = new Set(
  SNAPSHOT_GROVE_QUESTS.map((quest) => quest.id)
);

const SNAPSHOT_GROVE_LIVE_LABEL_TO_PROFILE_ID: Readonly<
  Record<string, string>
> = {
  rosalyn: "rosalyn",
  rosalie: "rosalyn",
  rose: "rosalyn",
  jackie: "jackie",
  taye: "taye",
  tay: "taye",
  nia: "guild_clerk_nia",
  nina: "guild_clerk_nia",
  "nia guild clerk": "guild_clerk_nia",
  "nina guild clerk": "guild_clerk_nia",
};

const SNAPSHOT_GROVE_LIVE_LABEL_CONTAINS: readonly [RegExp, string][] = [
  [/\bjackie\b/i, "jackie"],
  [/\brosalyn\b|\brosalie\b/i, "rosalyn"],
  [/\btaye\b/i, "taye"],
  [/\bnia\b|\bnina\b/i, "guild_clerk_nia"],
];

function normalizeSnapshotGroveLiveLabel(value: string | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function snapshotGroveNpcIdForDialogLabel(input: {
  label?: string;
  entityDescriptionText?: string;
  defaultDialog?: string;
}) {
  const label = normalizeSnapshotGroveLiveLabel(input.label);
  const exact = SNAPSHOT_GROVE_LIVE_LABEL_TO_PROFILE_ID[label];
  if (exact) {
    return exact;
  }
  const text = [input.label, input.entityDescriptionText, input.defaultDialog]
    .filter(Boolean)
    .join(" ");
  for (const [pattern, npcId] of SNAPSHOT_GROVE_LIVE_LABEL_CONTAINS) {
    if (pattern.test(text)) {
      return npcId;
    }
  }
  return undefined;
}

function dedupeKnownSnapshotGroveQuestIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && SNAPSHOT_GROVE_QUEST_ID_SET.has(item)
      )
    ),
  ];
}

export interface SnapshotGroveObjectiveProgress {
  objectiveIndex: number;
  count: number;
  evidenceKeys: string[];
}

export interface SnapshotGroveQuestState {
  acceptedQuestIds: string[];
  activeQuestId?: string;
  /** Compatibility projection for older HUD/map consumers. */
  activeObjectiveIndex: number;
  objectiveIndexByQuestId: Record<string, number>;
  objectiveProgressByQuestId: Record<string, SnapshotGroveObjectiveProgress>;
  completedQuestIds: string[];
  completedObjectiveIds: string[];
  rewards: string[];
  updatedAt?: number;
}

const EMPTY_SNAPSHOT_GROVE_QUEST_STATE: SnapshotGroveQuestState = {
  acceptedQuestIds: [],
  activeObjectiveIndex: 0,
  objectiveIndexByQuestId: {},
  objectiveProgressByQuestId: {},
  completedQuestIds: [],
  completedObjectiveIds: [],
  rewards: [],
};
const snapshotGroveQuestMutationsInFlight = new Set<string>();

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeSnapshotGroveQuestState(
  parsed: Partial<SnapshotGroveQuestState> | undefined
): SnapshotGroveQuestState {
  let acceptedQuestIds = dedupeKnownSnapshotGroveQuestIds(
    parsed?.acceptedQuestIds
  );
  const completedQuestIds = dedupeKnownSnapshotGroveQuestIds(
    parsed?.completedQuestIds
  );
  const completedSet = new Set(completedQuestIds);
  const requestedActiveQuestId =
    typeof parsed?.activeQuestId === "string" &&
    SNAPSHOT_GROVE_QUEST_ID_SET.has(parsed.activeQuestId)
      ? parsed.activeQuestId
      : undefined;
  if (
    requestedActiveQuestId &&
    !acceptedQuestIds.includes(requestedActiveQuestId) &&
    !completedSet.has(requestedActiveQuestId)
  ) {
    acceptedQuestIds = [...acceptedQuestIds, requestedActiveQuestId];
  }
  const activeQuestId =
    requestedActiveQuestId && !completedSet.has(requestedActiveQuestId)
      ? requestedActiveQuestId
      : acceptedQuestIds.find((questId) => !completedSet.has(questId));
  const parsedIndexes =
    parsed?.objectiveIndexByQuestId &&
    typeof parsed.objectiveIndexByQuestId === "object"
      ? parsed.objectiveIndexByQuestId
      : {};
  const objectiveIndexByQuestId = Object.fromEntries(
    acceptedQuestIds.flatMap((questId) => {
      const quest = questById(questId);
      if (!quest || completedSet.has(questId)) return [];
      const legacyIndex =
        questId === activeQuestId &&
        Number.isFinite(parsed?.activeObjectiveIndex)
          ? Number(parsed?.activeObjectiveIndex)
          : 0;
      const rawIndex = Number(
        (parsedIndexes as Record<string, unknown>)[questId] ?? legacyIndex
      );
      return [
        [
          questId,
          Math.max(
            0,
            Math.min(
              Math.max(0, quest.objectives.length - 1),
              Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : 0
            )
          ),
        ],
      ];
    })
  );
  const parsedProgress =
    parsed?.objectiveProgressByQuestId &&
    typeof parsed.objectiveProgressByQuestId === "object"
      ? parsed.objectiveProgressByQuestId
      : {};
  const objectiveProgressByQuestId = Object.fromEntries(
    Object.entries(parsedProgress).flatMap(([questId, value]) => {
      const quest = questById(questId);
      const objectiveIndex = objectiveIndexByQuestId[questId];
      if (!quest || objectiveIndex === undefined || !value) return [];
      const progress = value as Partial<SnapshotGroveObjectiveProgress>;
      if (Number(progress.objectiveIndex) !== objectiveIndex) return [];
      const requiredCount = snapshotGroveObjectiveRequiredCount(
        quest,
        objectiveIndex
      );
      const count = Math.max(
        0,
        Math.min(requiredCount - 1, Math.trunc(Number(progress.count) || 0))
      );
      if (count <= 0) return [];
      return [
        [
          questId,
          {
            objectiveIndex,
            count,
            evidenceKeys: Array.isArray(progress.evidenceKeys)
              ? [
                  ...new Set(
                    progress.evidenceKeys.filter(
                      (item): item is string =>
                        typeof item === "string" && item.length > 0
                    )
                  ),
                ]
              : [],
          },
        ],
      ];
    })
  );
  const activeObjectiveIndex = activeQuestId
    ? (objectiveIndexByQuestId[activeQuestId] ?? 0)
    : 0;

  return {
    acceptedQuestIds,
    activeQuestId,
    activeObjectiveIndex,
    objectiveIndexByQuestId,
    objectiveProgressByQuestId,
    completedQuestIds,
    completedObjectiveIds: Array.isArray(parsed?.completedObjectiveIds)
      ? [
          ...new Set(
            parsed!.completedObjectiveIds.filter(
              (item): item is string => typeof item === "string"
            )
          ),
        ]
      : [],
    rewards: Array.isArray(parsed?.rewards)
      ? [
          ...new Set(
            parsed!.rewards.filter(
              (item): item is string => typeof item === "string"
            )
          ),
        ]
      : [],
    updatedAt: parsed?.updatedAt,
  };
}

export function readSnapshotGroveQuestState(): SnapshotGroveQuestState {
  if (!isBrowser()) {
    return { ...EMPTY_SNAPSHOT_GROVE_QUEST_STATE };
  }
  try {
    return normalizeSnapshotGroveQuestState(
      JSON.parse(
        harthmereLocalStorage.getItem(SNAPSHOT_GROVE_QUEST_STATE_KEY) || "null"
      ) || undefined
    );
  } catch {
    return { ...EMPTY_SNAPSHOT_GROVE_QUEST_STATE };
  }
}

export function snapshotGroveObjectiveIndexForQuest(
  state: Pick<
    SnapshotGroveQuestState,
    "activeQuestId" | "activeObjectiveIndex" | "objectiveIndexByQuestId"
  >,
  questId: string
) {
  const indexed = state.objectiveIndexByQuestId?.[questId];
  if (Number.isFinite(indexed)) return Math.max(0, Math.trunc(indexed));
  return state.activeQuestId === questId
    ? Math.max(0, Math.trunc(state.activeObjectiveIndex || 0))
    : 0;
}

export function snapshotGroveObjectiveCompletedCountForQuest(
  state: Pick<SnapshotGroveQuestState, "objectiveProgressByQuestId">,
  questId: string,
  objectiveIndex: number
) {
  const progress = state.objectiveProgressByQuestId?.[questId];
  return progress?.objectiveIndex === objectiveIndex
    ? Math.max(0, Math.trunc(progress.count || 0))
    : 0;
}

export function activeSnapshotGroveQuestMarkerIds(
  state: SnapshotGroveQuestState
) {
  const completed = new Set(state.completedQuestIds);
  return new Set(
    state.acceptedQuestIds.flatMap((questId) => {
      if (completed.has(questId)) return [];
      const quest = questById(questId);
      if (!quest) return [];
      const objectiveIndex = snapshotGroveObjectiveIndexForQuest(
        state,
        questId
      );
      const completedCount = snapshotGroveObjectiveCompletedCountForQuest(
        state,
        questId,
        objectiveIndex
      );
      const markerId = snapshotGroveObjectiveMarkerIdForProgress(
        quest,
        objectiveIndex,
        completedCount
      );
      return markerId ? [markerId] : [];
    })
  );
}

function writeSnapshotGroveQuestState(state: SnapshotGroveQuestState) {
  if (!isBrowser()) {
    return;
  }
  const next = { ...state, updatedAt: Date.now() };
  harthmereLocalStorage.setItem(
    SNAPSHOT_GROVE_QUEST_STATE_KEY,
    JSON.stringify(next)
  );
  window.dispatchEvent(new CustomEvent(SNAPSHOT_GROVE_QUEST_STATE_EVENT));
}

export function selectSnapshotGroveQuest(questId: string) {
  const state = readSnapshotGroveQuestState();
  if (
    !state.acceptedQuestIds.includes(questId) ||
    state.completedQuestIds.includes(questId)
  ) {
    return false;
  }
  writeSnapshotGroveQuestState(
    normalizeSnapshotGroveQuestState({
      ...state,
      activeQuestId: questId,
    })
  );
  return true;
}

async function submitSnapshotGroveQuestStateToCloudSave(
  quest: SnapshotGroveQuest,
  state: SnapshotGroveQuestState,
  reason: string,
  completedObjectiveIndex?: number,
  evidenceTrigger?: SnapshotGroveTrigger
) {
  if (!isBrowser()) {
    return;
  }
  const completed = state.completedQuestIds.includes(quest.id);
  const perQuestObjectiveIndex = snapshotGroveObjectiveIndexForQuest(
    state,
    quest.id
  );
  const objectiveIndex = completed
    ? Math.max(0, quest.objectives.length - 1)
    : Math.max(
        0,
        Math.min(quest.objectives.length - 1, perQuestObjectiveIndex)
      );
  const partialProgress = state.objectiveProgressByQuestId[quest.id];
  const requestId = `snapshot_grove_quest_${quest.id}_${
    completed ? "complete" : "progress"
  }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const errorContext = {
    action: reason === "accepted" ? ("accept" as const) : ("update" as const),
    questTitle: quest.title,
  };
  let response: Response;
  try {
    response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        clientSentAtMs: Date.now(),
        actionKind: "request_quest_state_update",
        subsystem: "quest",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: {
          questId: quest.id,
          source: "snapshot_grove",
          title: quest.title,
          completed,
          stepId: `${quest.id}:${objectiveIndex}:${
            quest.triggers[objectiveIndex] ?? "step"
          }`,
          progress: completed ? quest.objectives.length : objectiveIndex + 1,
          objectiveIndex: completedObjectiveIndex,
          evidenceTrigger,
          objectiveProgress:
            partialProgress?.objectiveIndex === objectiveIndex
              ? {
                  objectiveIndex,
                  count: partialProgress.count,
                  evidenceKeys: partialProgress.evidenceKeys,
                }
              : undefined,
          reason,
        },
        clientClaims: {},
      }),
    });
  } catch {
    throw new HarthmereQuestActionError(
      ["snapshot_grove_quest_rejected:network_error"],
      errorContext
    );
  }
  const body = await response.json().catch(() => undefined);
  // HTTP 200 means the transport completed; gameplay warnings still mean the
  // server rejected the transition and local state must not advance.
  const rejectionWarnings = harthmereQuestRejectionWarningsFromResponse(body);
  if (!body || !response.ok || body?.ok === false || rejectionWarnings.length) {
    throw new HarthmereQuestActionError(
      rejectionWarnings.length
        ? rejectionWarnings
        : ["snapshot_grove_quest_rejected:request_failed"],
      errorContext
    );
  }
  if (body?.questState) {
    window.dispatchEvent(
      new CustomEvent(SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT, {
        detail: { questState: body.questState },
      })
    );
  }
}

function syncSnapshotGroveQuestStateToCloudSave(
  quest: SnapshotGroveQuest,
  state: SnapshotGroveQuestState,
  reason: string,
  completedObjectiveIndex?: number,
  evidenceTrigger?: SnapshotGroveTrigger
) {
  return submitSnapshotGroveQuestStateToCloudSave(
    quest,
    state,
    reason,
    completedObjectiveIndex,
    evidenceTrigger
  );
}

// Reconcile old clients whose local lesson completed while native/Cloud Save
// remained on the final return-to-giver leaf. The server revalidates progress.
async function repairSnapshotGroveCompletionProjection() {
  if (!isBrowser()) return;
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_quest_state",
    { method: "GET", credentials: "same-origin" }
  );
  if (!response.ok) return;
  const body = await response.json().catch(() => undefined);
  const liveState = body?.questState;
  if (!liveState) return;

  let local = readSnapshotGroveQuestState();
  const liveCompletedIds = Object.keys(liveState.completed ?? {}).filter((id) =>
    SNAPSHOT_GROVE_QUEST_ID_SET.has(id)
  );
  const liveActiveEntries = Object.entries(liveState.active ?? {}).filter(
    ([id, record]) =>
      SNAPSHOT_GROVE_QUEST_ID_SET.has(id) &&
      (record as any)?.source === "snapshot_grove"
  );
  const completed = new Set([...local.completedQuestIds, ...liveCompletedIds]);
  const accepted = new Set([
    ...local.acceptedQuestIds,
    ...liveActiveEntries.map(([questId]) => questId),
    ...liveCompletedIds,
  ]);
  const objectiveIndexByQuestId = {
    ...local.objectiveIndexByQuestId,
  };
  const objectiveProgressByQuestId = {
    ...local.objectiveProgressByQuestId,
  };
  for (const [questId, record] of liveActiveEntries) {
    const quest = questById(questId);
    if (!quest || completed.has(questId)) continue;
    const liveProgress = Math.max(
      1,
      Math.trunc(Number((record as any).progress) || 1)
    );
    const liveObjectiveIndex = Math.max(
      0,
      Math.min(quest.objectives.length - 1, liveProgress - 1)
    );
    objectiveIndexByQuestId[questId] = Math.max(
      objectiveIndexByQuestId[questId] ?? 0,
      liveObjectiveIndex
    );
    const livePartial = (record as any).objectiveProgress;
    if (
      livePartial &&
      Math.trunc(Number(livePartial.objectiveIndex)) ===
        objectiveIndexByQuestId[questId]
    ) {
      const current = objectiveProgressByQuestId[questId];
      objectiveProgressByQuestId[questId] = {
        objectiveIndex: objectiveIndexByQuestId[questId],
        count: Math.max(
          current?.objectiveIndex === objectiveIndexByQuestId[questId]
            ? current.count
            : 0,
          Math.max(0, Math.trunc(Number(livePartial.count) || 0))
        ),
        evidenceKeys: [
          ...new Set([
            ...(current?.objectiveIndex === objectiveIndexByQuestId[questId]
              ? current.evidenceKeys
              : []),
            ...(Array.isArray(livePartial.evidenceKeys)
              ? livePartial.evidenceKeys.filter(
                  (item: unknown): item is string => typeof item === "string"
                )
              : []),
          ]),
        ],
      };
    }
  }
  for (const questId of completed) {
    delete objectiveIndexByQuestId[questId];
    delete objectiveProgressByQuestId[questId];
  }
  const activeQuestId =
    local.activeQuestId && !completed.has(local.activeQuestId)
      ? local.activeQuestId
      : (liveActiveEntries.find(([questId]) => !completed.has(questId))?.[0] ??
        [...accepted].find((questId) => !completed.has(questId)));
  const next = normalizeSnapshotGroveQuestState({
    ...local,
    acceptedQuestIds: [...accepted],
    activeQuestId,
    completedQuestIds: [...completed],
    objectiveIndexByQuestId,
    objectiveProgressByQuestId,
  });
  if (JSON.stringify(next) !== JSON.stringify(local)) {
    writeSnapshotGroveQuestState(next);
    local = next;
  }

  // Repair clients affected by the old completion branch: local UI marked the
  // lesson done, but Cloud Save and native Challenges retained its final
  // return-to-giver objective. Re-submit only when the server has already
  // recorded every preceding objective.
  for (const questId of local.completedQuestIds) {
    if (liveState.completed?.[questId] !== undefined) continue;
    const liveActive = liveState.active?.[questId];
    const quest = questById(questId);
    if (!quest || liveActive?.source !== "snapshot_grove") continue;
    const progress = Math.max(0, Number(liveActive.progress) || 0);
    if (progress >= Math.max(1, quest.objectives.length - 1)) {
      await submitSnapshotGroveQuestStateToCloudSave(
        quest,
        local,
        "completion_repair",
        quest.objectives.length - 1
      ).catch(() => undefined);
    }
  }
}

function readSnapshotGroveLikeability(): Record<string, number> {
  if (!isBrowser()) {
    return {};
  }
  try {
    const parsed = JSON.parse(
      harthmereLocalStorage.getItem(SNAPSHOT_GROVE_LIKEABILITY_KEY) || "{}"
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function recordSnapshotGroveLikeability(npcId: string, delta: number) {
  if (!isBrowser()) {
    return;
  }
  const current = readSnapshotGroveLikeability();
  current[npcId] = Math.max(
    -5,
    Math.min(10, Number(current[npcId] || 0) + delta)
  );
  harthmereLocalStorage.setItem(
    SNAPSHOT_GROVE_LIKEABILITY_KEY,
    JSON.stringify(current)
  );
}

function questById(id: string | undefined) {
  return SNAPSHOT_GROVE_QUESTS.find((quest) => quest.id === id);
}

function snapshotGroveQuestGiverId(quest: SnapshotGroveQuest): string {
  return groveQuest(quest.id)?.start.giverNpcId ?? quest.giverNpcId;
}

// SNAPSHOT_GROVE_GRADUATION_CHAIN:
// The graduation tour (Jackie) and three road-neighbor intros (Alexis, Luis,
// Ranger Jane) declare an `unlockedBy` predicate in the shared content. The
// runtime checks it here so locked quests never show up in an NPC's offer
// list and the journal can render them in a separate "Soon" group.
function countCompletedFountainLessons(state: SnapshotGroveQuestState): number {
  return state.completedQuestIds.filter((id) =>
    SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(id)
  ).length;
}

/**
 * Unlock check for a Grove quest.
 *
 * NOW A THIN DELEGATION to `groveQuestGate`, which is the single enforcement
 * point. The signature is unchanged so callers did not have to move, but the
 * three-branch switch that used to live here is gone: two implementations of
 * the same rule is how the graduation gate and the dialogue quietly disagree.
 *
 * ONE DELIBERATE DIFFERENCE. `groveQuestGate` also reports `already_completed`;
 * this function historically did not, because its callers filter completed
 * quests themselves. That reason is dropped here so the delegation is
 * behaviour-preserving — changing it would silently alter what the journal
 * shows for a finished lesson.
 */
export function isSnapshotGroveQuestUnlocked(
  quest: SnapshotGroveQuest,
  state: SnapshotGroveQuestState
): boolean {
  const definition = groveQuest(quest.id);
  if (!definition) {
    // A quest present in the retired array but absent from the new catalog
    // would be unreachable content; fail open rather than hiding it, and let
    // the catalog contract tests be the place that notices.
    return true;
  }
  const result = groveQuestGate(definition, {
    completedQuestIds: new Set(state.completedQuestIds),
    acceptedQuestIds: new Set(state.acceptedQuestIds),
  });
  return groveQuestGateReasons(result).every(
    (reason) => reason === "already_completed"
  );
}

function snapshotGroveQuestCategoryRank(quest: SnapshotGroveQuest): number {
  // Lower number = earlier in the offer list.
  if (quest.id === "read-the-jobs-board") {
    // The Jobs Board is the directory for public work and the rest of the
    // Grove economy. Hiding it behind Jackie's fountain/graduation queue made
    // the board appear absent to new players even though the quest existed.
    return -1;
  }
  if (SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(quest.id)) {
    return 0;
  }
  if (quest.category === "road_graduation") {
    return 1;
  }
  if (quest.category === "road_neighbor") {
    return 2;
  }
  return 3;
}

function availableQuestsForNpc(npcId: string, state: SnapshotGroveQuestState) {
  // GIVER COMES FROM THE NEW CATALOG, not `quest.giverNpcId`.
  //
  // The retired array still records Jackie as the giver of the four fountain
  // lessons that moved to Rosalyn. Filtering on it would have left the
  // reassignment invisible to the live dialogue — Rosalyn would offer nothing
  // and Jackie would still offer all eight — while every catalog test passed.
  const questIdsForGiver = new Set(groveQuestIdsForGiver(npcId));
  return SNAPSHOT_GROVE_QUESTS.filter(
    (quest) =>
      questIdsForGiver.has(quest.id) &&
      !state.completedQuestIds.includes(quest.id) &&
      !state.acceptedQuestIds.includes(quest.id) &&
      isSnapshotGroveQuestUnlocked(quest, state)
  ).sort(
    (a, b) =>
      snapshotGroveQuestCategoryRank(a) - snapshotGroveQuestCategoryRank(b)
  );
}

export const SNAPSHOT_GROVE_MAX_VISIBLE_QUEST_OFFERS = 2;

export function visibleSnapshotGroveQuestOffersForNpcForTest(
  npcId: string,
  state: SnapshotGroveQuestState
) {
  return availableQuestsForNpc(npcId, state).slice(
    0,
    SNAPSHOT_GROVE_MAX_VISIBLE_QUEST_OFFERS
  );
}

function firstAvailableQuestForNpc(
  npcId: string,
  state: SnapshotGroveQuestState
) {
  return availableQuestsForNpc(npcId, state)[0];
}

function activeQuestForNpc(npcId: string, state: SnapshotGroveQuestState) {
  const active = questById(state.activeQuestId);
  if (active && snapshotGroveQuestGiverId(active) === npcId) {
    return active;
  }
  return SNAPSHOT_GROVE_QUESTS.find(
    (quest) =>
      snapshotGroveQuestGiverId(quest) === npcId &&
      state.acceptedQuestIds.includes(quest.id) &&
      !state.completedQuestIds.includes(quest.id)
  );
}

export function mostRecentlyCompletedSnapshotGroveQuestForNpcForTest(
  npcId: string,
  completedQuestIds: readonly string[]
) {
  // Completion dialogue must win the first conversation after a lesson ends.
  // Walk the persisted completion order backwards so an NPC with several
  // lessons acknowledges the one the player just finished, while its other
  // available Start actions remain visible in the same dialog.
  for (let index = completedQuestIds.length - 1; index >= 0; index -= 1) {
    const quest = questById(completedQuestIds[index]);
    if (quest && snapshotGroveQuestGiverId(quest) === npcId) {
      return quest;
    }
  }
  return undefined;
}

/**
 * Every step marker for a quest, in step order, retargeted the same way a
 * single objective's marker is.
 *
 * The "All marked stops" list used to read `quest.markerIds` straight off the
 * retired array. That is the one marker surface that does not go through
 * `snapshotGroveObjectiveMarkerIdForProgress`, so it kept naming Jackie for
 * Rosalyn's four reassigned lessons after every other surface had been fixed.
 */
function snapshotGroveQuestStepMarkerIds(quest: SnapshotGroveQuest): string[] {
  return quest.markerIds.map(
    (markerId, index) =>
      snapshotGroveObjectiveTargetMarkerIds(quest, index)[0] ?? markerId
  );
}

function currentMarkerForQuest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  completedCount = 0
) {
  const markerId = snapshotGroveObjectiveMarkerIdForProgress(
    quest,
    objectiveIndex,
    completedCount
  );
  return markerId ? snapshotGroveLandmarkById(markerId) : undefined;
}

/**
 * Landmark -> the world position every player-facing surface must agree on.
 *
 * TWO STEPS, AND BOTH ARE LOAD-BEARING.
 *
 * 1. `groveLandmarkWorldPosition` lifts a landmark out of the retired Y=54
 *    authored datum. That is necessary but NOT sufficient: it lifts onto ONE
 *    FLAT PLANE (`SNAPSHOT_GROVE_LIVE_MARKER_Y` = 71), which is only true at
 *    the fountain plaza. The Grove is hilly.
 * 2. `resolveHarthmereProductionMarkerPosition` replaces that plane with the
 *    scanned production surface for this marker id.
 *
 * Skipping step 2 is not a small error. Measured against the checked-in
 * placement map, 79 of the 108 Grove landmarks have a scanned record, and the
 * flat plane is wrong at most of them — Ranger Jane's post is at 49 (22 blocks
 * below the plane), Old Coop 59, Luis's cart 64, Mel's workbench 64, Alexis 74.
 * A pin on the plane is a player walking to empty air or to a spot 22 blocks
 * under the hillside they can see.
 *
 * This is the rule in docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md:
 * "All player-facing surfaces must point at the same `recommendedPosition`",
 * "live helper landmarks should resolve through
 * `resolveHarthmereProductionMarkerPosition`", and "do not fix one bad item by
 * adding a magic `+1`, `-17`, `y=54`, or `y=70`". The un-stranded value is
 * passed as the FALLBACK, which is what the resolver returns for the 29
 * landmarks the scan does not cover.
 *
 * NO MARKER OFFSET IS ADDED. `ch1_objective_targets.ts` adds +1 because it is
 * placing a 3D objective prop above the scanned feet-Y; this is a navigation
 * aid, and `mapPinnedDestination.activeBiomesUIMapPinFromMarkerForTest` — the
 * BiomesUI map pin for the same marker — consumes `recommendedPosition`
 * unmodified. Adding an offset here would make the HUD pin and the map pin
 * disagree by one block for the same landmark, which is the exact divergence
 * the placement-map doc forbids.
 */
export function snapshotGroveLandmarkPinPosition(
  landmark: SnapshotGroveLandmark
): Vec3 {
  return resolveHarthmereProductionMarkerPosition({
    markerId: landmark.id,
    fallback: groveLandmarkWorldPosition(landmark),
  });
}

/**
 * TAKES A LANDMARK, NOT A POSITION — deliberately.
 *
 * The previous signature took a `Vec3`, which made grounding a per-call-site
 * decision. Four call sites made it four different ways: two passed a resolved
 * position and two passed `marker.position` / `stepMarker.position` raw, so the
 * "All marked stops" list and the "Pin <marker>" button dropped pins on the
 * authored datum while the quest arrow used the lifted one.
 *
 * Narrowing the parameter to the landmark itself makes that class of bug
 * unrepresentable: there is no longer a way to hand this function an
 * unresolved coordinate.
 */
function pinSnapshotGroveLandmark(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  landmark: SnapshotGroveLandmark,
  navAidId: number = snapshotGroveStepNavAidId(0),
  autoremoveWhenNear = false
) {
  const position = snapshotGroveLandmarkPinPosition(landmark);
  const markerPersistence = autoremoveWhenNear
    ? SNAPSHOT_GROVE_ACTIVE_MARKER_AUTOREMOVE
    : SNAPSHOT_GROVE_QUEST_CONTROLLED_MARKER;
  mapManager.removeNavigationAid?.(navAidId);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      ...markerPersistence,
      target: { kind: "position", position: [...position] },
    },
    navAidId
  );
}

export function requestSnapshotGroveLandmarkOnMapForBiomesUI(
  marker: SnapshotGroveLandmark
) {
  // Snapshot Grove dialogue already creates a world-space nav aid; this
  // additionally opens BiomesUI's Map tab and centers on the same destination.
  const pin = activeBiomesUIMapPinFromMarkerForTest({
    id: marker.id,
    label: marker.label,
    kind: marker.kind,
    // RESOLVED, not raw. 15 Grove-area landmarks are still authored at the
    // retired Y=54 while live terrain is Y=71; pinning the raw value drops the
    // map destination 17 blocks under the courtyard, which is the
    // "mission cast buried" incident in snapshot_grove_content.ts.
    worldPosition: snapshotGroveLandmarkPinPosition(marker),
    description: `${marker.area} - ${marker.kind}`,
  });
  if (pin) {
    requestBiomesUILocateOnMap(pin);
  }
  return pin;
}

export function snapshotGroveActiveMapPinForQuestStepForTest(
  quest: SnapshotGroveQuest,
  activeObjectiveIndex: number,
  completedCount = 0
) {
  const safeActiveIndex = Math.max(
    0,
    Math.min(quest.objectives.length - 1, activeObjectiveIndex)
  );
  const marker = currentMarkerForQuest(quest, safeActiveIndex, completedCount);
  if (!marker) return undefined;
  const authoredStep = groveQuest(quest.id)?.steps[safeActiveIndex];
  return activeBiomesUIMapPinFromMarkerForTest({
    id: marker.id,
    label: marker.label,
    kind: marker.kind,
    worldPosition: snapshotGroveLandmarkPinPosition(marker),
    description: `${marker.area} - ${marker.kind}`,
    ownerQuestId: quest.id,
    ownerStepId: authoredStep?.id ?? `${quest.id}:${safeActiveIndex}`,
  });
}

// Keep one navigation aid for the selected quest's current objective. Other
// accepted quests remain visible as physical objective props and map rows, but
// future/past steps no longer flood the map.
function pinAllSnapshotGroveQuestMarkers(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  quest: SnapshotGroveQuest,
  activeObjectiveIndex: number
) {
  // Clear legacy and any stale step pins first so we never leak markers
  // from a previous quest into the current one.
  mapManager.removeNavigationAid?.(SNAPSHOT_GROVE_NAV_AID_LEGACY);
  for (const id of snapshotGroveAllStepNavAidIds()) {
    mapManager.removeNavigationAid?.(id);
  }
  const safeActiveIndex = Math.max(
    0,
    Math.min(quest.objectives.length - 1, activeObjectiveIndex)
  );
  const state = readSnapshotGroveQuestState();
  const activeMarker = currentMarkerForQuest(
    quest,
    safeActiveIndex,
    snapshotGroveObjectiveCompletedCountForQuest(
      state,
      quest.id,
      safeActiveIndex
    )
  );
  if (activeMarker) {
    pinSnapshotGroveLandmark(
      mapManager,
      activeMarker,
      snapshotGroveStepNavAidId(0),
      true
    );
    const activePin = snapshotGroveActiveMapPinForQuestStepForTest(
      quest,
      safeActiveIndex,
      snapshotGroveObjectiveCompletedCountForQuest(
        state,
        quest.id,
        safeActiveIndex
      )
    );
    if (activePin) {
      // Persist the current lesson destination for the minimap/HUD arrow. This
      // runs only when acceptance/progress changes, so a player can still pick
      // a different manual destination between objectives.
      writeActiveBiomesUIMapPin(activePin);
    }
  }
  return safeActiveIndex;
}

function clearAllSnapshotGroveQuestMarkers(mapManager: {
  removeNavigationAid?: (id: number) => void;
}) {
  mapManager.removeNavigationAid?.(SNAPSHOT_GROVE_NAV_AID_LEGACY);
  for (const id of snapshotGroveAllStepNavAidIds()) {
    mapManager.removeNavigationAid?.(id);
  }
  const activePin = readActiveBiomesUIMapPin();
  if (
    activePin?.ownerQuestId &&
    SNAPSHOT_GROVE_QUEST_ID_SET.has(activePin.ownerQuestId)
  ) {
    writeActiveBiomesUIMapPin(undefined);
  }
}

function syncSnapshotGroveQuestMarkers(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  quest: SnapshotGroveQuest | undefined,
  activeObjectiveIndex: number
) {
  if (!quest) {
    clearAllSnapshotGroveQuestMarkers(mapManager);
    return;
  }
  pinAllSnapshotGroveQuestMarkers(mapManager, quest, activeObjectiveIndex);
}

function grantSnapshotGroveAcceptedTutorialItems(quest: SnapshotGroveQuest) {
  const grants = snapshotGroveTutorialInventoryGrantsForQuest(quest);
  if (harthmereLiveServerAuthoritative()) {
    return grants;
  }
  for (const grant of grants) {
    grantHarthmereTutorialInventoryItem(
      grant.itemId,
      grant.quantity,
      `${quest.title}: starter ${grant.itemName}`
    );
  }
  return grants;
}

function addSnapshotGroveObjectiveToast(
  resources: ReturnType<typeof useClientContext>["resources"] | undefined,
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  if (!resources) return;
  const objective = quest.objectives[objectiveIndex];
  if (!objective) return;
  addToast(resources, {
    kind: "new",
    id: `${quest.id}:${objectiveIndex}:new`,
    message: objective,
  });
}

async function acceptSnapshotGroveQuest(
  quest: SnapshotGroveQuest,
  mapManager: any,
  resources?: ReturnType<typeof useClientContext>["resources"]
) {
  const mutationKey = `accept:${quest.id}`;
  if (snapshotGroveQuestMutationsInFlight.has(mutationKey)) return;
  const state = readSnapshotGroveQuestState();
  if (state.completedQuestIds.includes(quest.id)) return;
  const isFreshAcceptance =
    !state.acceptedQuestIds.includes(quest.id) &&
    !state.completedQuestIds.includes(quest.id);
  const startsByTalkingToGiver =
    currentTriggerForQuest(quest, 0) === "talk_npc";
  // SNAPSHOT_GROVE_INITIAL_MARKER_AT_GIVER:
  // Accepting a quest from the giver already satisfies a leading talk_npc
  // objective, so start the active step at the first real destination. Do
  // not skip non-talk objectives just because their marker data is wrong;
  // those authored markerIds must point at the task destination instead.
  const shouldSkipFirstStep =
    startsByTalkingToGiver && quest.objectives.length > 1;
  const initialObjectiveIndex = shouldSkipFirstStep ? 1 : 0;
  const objectiveIndex = isFreshAcceptance
    ? initialObjectiveIndex
    : snapshotGroveObjectiveIndexForQuest(state, quest.id);
  const objectiveProgressByQuestId = {
    ...state.objectiveProgressByQuestId,
  };
  if (isFreshAcceptance) {
    delete objectiveProgressByQuestId[quest.id];
  }
  const next: SnapshotGroveQuestState = {
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: quest.id,
    activeObjectiveIndex: objectiveIndex,
    objectiveIndexByQuestId: {
      ...state.objectiveIndexByQuestId,
      [quest.id]: objectiveIndex,
    },
    objectiveProgressByQuestId,
    completedObjectiveIds: shouldSkipFirstStep
      ? [
          ...new Set([
            ...state.completedObjectiveIds,
            `${quest.id}:0:talked_to_giver`,
          ]),
        ]
      : state.completedObjectiveIds,
  };
  snapshotGroveQuestMutationsInFlight.add(mutationKey);
  try {
    // Native Challenges and the signed starter-item exchange commit first.
    // localStorage is only a UI cache and must never display accepted progress
    // the server failed to materialize.
    await syncSnapshotGroveQuestStateToCloudSave(
      quest,
      next,
      "accepted",
      shouldSkipFirstStep ? 0 : undefined,
      shouldSkipFirstStep ? currentTriggerForQuest(quest, 0) : undefined
    );
  } catch (error) {
    console.warn(error);
    throw error;
  } finally {
    snapshotGroveQuestMutationsInFlight.delete(mutationKey);
  }
  if (isFreshAcceptance) grantSnapshotGroveAcceptedTutorialItems(quest);
  writeSnapshotGroveQuestState(next);
  syncSnapshotGroveQuestMarkers(mapManager, quest, objectiveIndex);
  addSnapshotGroveObjectiveToast(resources, quest, objectiveIndex);
}

async function advanceSnapshotGroveQuest(
  quest: SnapshotGroveQuest,
  mapManager: any,
  reason: string,
  resources?: ReturnType<typeof useClientContext>["resources"],
  evidence?: {
    count?: number;
    key?: string;
    expectedObjectiveIndex: number;
    trigger: SnapshotGroveTrigger;
  }
) {
  const state = readSnapshotGroveQuestState();
  if (state.completedQuestIds.includes(quest.id) || !quest.objectives.length) {
    return;
  }
  const safeObjectiveIndex = Math.max(
    0,
    Math.min(
      quest.objectives.length - 1,
      snapshotGroveObjectiveIndexForQuest(state, quest.id)
    )
  );
  // A movement/inventory/world callback can resolve after another callback has
  // already advanced the quest. Never reinterpret that stale evidence as proof
  // for the newly-current objective (the Billy lunch-pail incident advanced a
  // collect step with an old near-location callback).
  if (
    !evidence ||
    evidence.expectedObjectiveIndex !== safeObjectiveIndex ||
    evidence.trigger !== currentTriggerForQuest(quest, safeObjectiveIndex)
  ) {
    return;
  }
  const requiredCount = snapshotGroveObjectiveRequiredCount(
    quest,
    safeObjectiveIndex
  );
  const currentProgress = state.objectiveProgressByQuestId[quest.id];
  const evidenceKeys =
    currentProgress?.objectiveIndex === safeObjectiveIndex
      ? currentProgress.evidenceKeys
      : [];
  if (evidence?.key && evidenceKeys.includes(evidence.key)) {
    return;
  }
  const completedCount =
    currentProgress?.objectiveIndex === safeObjectiveIndex
      ? currentProgress.count
      : 0;
  const nextCount = Math.min(
    requiredCount,
    completedCount + Math.max(1, Math.trunc(evidence?.count ?? 1))
  );
  const objectiveId = `${quest.id}:${safeObjectiveIndex}:${reason}`;
  const mutationKey = `progress:${quest.id}:${safeObjectiveIndex}`;
  if (snapshotGroveQuestMutationsInFlight.has(mutationKey)) return;
  if (nextCount < requiredCount) {
    const partial: SnapshotGroveQuestState = normalizeSnapshotGroveQuestState({
      ...state,
      acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
      objectiveProgressByQuestId: {
        ...state.objectiveProgressByQuestId,
        [quest.id]: {
          objectiveIndex: safeObjectiveIndex,
          count: nextCount,
          evidenceKeys: evidence?.key
            ? [...new Set([...evidenceKeys, evidence.key])]
            : evidenceKeys,
        },
      },
    });
    snapshotGroveQuestMutationsInFlight.add(mutationKey);
    try {
      await syncSnapshotGroveQuestStateToCloudSave(
        quest,
        partial,
        `${reason}:partial`,
        undefined,
        evidence.trigger
      );
    } catch (error) {
      console.warn(error);
      return;
    } finally {
      snapshotGroveQuestMutationsInFlight.delete(mutationKey);
    }
    writeSnapshotGroveQuestState(partial);
    if (state.activeQuestId === quest.id) {
      syncSnapshotGroveQuestMarkers(mapManager, quest, safeObjectiveIndex);
      addSnapshotGroveObjectiveToast(resources, quest, safeObjectiveIndex);
    }
    return;
  }
  const nextIndex = safeObjectiveIndex + 1;
  const completedQuest = nextIndex >= quest.objectives.length;
  const objectiveIndexByQuestId = {
    ...state.objectiveIndexByQuestId,
  };
  const objectiveProgressByQuestId = {
    ...state.objectiveProgressByQuestId,
  };
  delete objectiveProgressByQuestId[quest.id];
  if (completedQuest) {
    delete objectiveIndexByQuestId[quest.id];
  } else {
    objectiveIndexByQuestId[quest.id] = nextIndex;
  }
  const nextCompletedQuestIds = completedQuest
    ? [...new Set([...state.completedQuestIds, quest.id])]
    : state.completedQuestIds;
  const nextSelectedQuestId =
    completedQuest && state.activeQuestId === quest.id
      ? state.acceptedQuestIds.find(
          (questId) =>
            questId !== quest.id && !nextCompletedQuestIds.includes(questId)
        )
      : (state.activeQuestId ?? quest.id);
  const next: SnapshotGroveQuestState = normalizeSnapshotGroveQuestState({
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: nextSelectedQuestId,
    objectiveIndexByQuestId,
    objectiveProgressByQuestId,
    completedObjectiveIds: [
      ...new Set([...state.completedObjectiveIds, objectiveId]),
    ],
    completedQuestIds: nextCompletedQuestIds,
    rewards: completedQuest
      ? [...new Set([...state.rewards, `${quest.title}: ${quest.reward}`])]
      : state.rewards,
  });
  snapshotGroveQuestMutationsInFlight.add(mutationKey);
  try {
    await syncSnapshotGroveQuestStateToCloudSave(
      quest,
      next,
      reason,
      safeObjectiveIndex,
      evidence.trigger
    );
  } catch (error) {
    console.warn(error);
    return;
  } finally {
    snapshotGroveQuestMutationsInFlight.delete(mutationKey);
  }
  writeSnapshotGroveQuestState(next);
  if (completedQuest) {
    recordSnapshotGroveLikeability(snapshotGroveQuestGiverId(quest), 1);
  }
  if (next.activeQuestId === quest.id && !completedQuest) {
    // Remove the marker for the step we just completed so past pins do not
    // clutter the map, and refresh the remaining future + active markers.
    mapManager.removeNavigationAid?.(
      snapshotGroveStepNavAidId(safeObjectiveIndex)
    );
    syncSnapshotGroveQuestMarkers(mapManager, quest, nextIndex);
    addSnapshotGroveObjectiveToast(resources, quest, nextIndex);
  } else {
    const selectedQuest = questById(next.activeQuestId);
    syncSnapshotGroveQuestMarkers(
      mapManager,
      selectedQuest,
      selectedQuest
        ? snapshotGroveObjectiveIndexForQuest(next, selectedQuest.id)
        : 0
    );
  }
}

function currentTriggerForQuest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  if (!quest.triggers.length) {
    return undefined;
  }
  return quest.triggers[
    Math.max(0, Math.min(quest.triggers.length - 1, objectiveIndex))
  ];
}

function activeSnapshotGroveQuestRows(state: SnapshotGroveQuestState) {
  const completed = new Set(state.completedQuestIds);
  return state.acceptedQuestIds.flatMap((questId) => {
    if (completed.has(questId)) return [];
    const quest = questById(questId);
    if (!quest) return [];
    const objectiveIndex = snapshotGroveObjectiveIndexForQuest(state, questId);
    return [
      {
        quest,
        objectiveIndex,
        completedCount: snapshotGroveObjectiveCompletedCountForQuest(
          state,
          questId,
          objectiveIndex
        ),
      },
    ];
  });
}

const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS =
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET;

function snapshotGroveNpcIdFromTalkEvent(event: GardenHoseEvent) {
  if ((event as any).kind !== "talk_npc") {
    return undefined;
  }
  const rawNpcId = (event as any).npcId;
  if (typeof rawNpcId === "string" && rawNpcId.trim()) {
    return rawNpcId;
  }
  const npcId = rawNpcId as BiomesId | undefined;
  if (npcId === JACKIE_ID) {
    return "jackie";
  }
  if (!npcId) return undefined;
  const groveNpcId = snapshotGroveNpcIdFromEntityId(npcId);
  if (groveNpcId) return groveNpcId;
  return Object.entries(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST).find(
    ([, giver]) => Number(giver.entityId) === Number(npcId)
  )?.[0];
}

function expectedOpenTabsForObjective(objective: string | undefined) {
  const text = (objective ?? "").toLowerCase();
  if (text.includes("map") || text.includes("marker")) {
    return ["map"];
  }
  if (
    text.includes("inventory") ||
    text.includes("bag") ||
    text.includes("clothing") ||
    text.includes("hotbar")
  ) {
    return ["inventory"];
  }
  if (text.includes("recipe") || text.includes("craft")) {
    return ["crafting"];
  }
  if (
    text.includes("mail") ||
    text.includes("storage") ||
    text.includes("recovery")
  ) {
    // The lesson says "storage, mail, or recovery" and highlights both Mail
    // and Bank. Either real panel is valid evidence; accepting only Inbox made
    // the Bank highlight a trap that could never complete the objective.
    return ["inbox", "banking"];
  }
  // SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
  // The "Words Find the Right Ear" lesson opens the chat panel from the HUD;
  // matching "chat" / "channel" / "whisper" routes the highlight to the new
  // CHAT nav slot so the player sees exactly which button to press.
  if (
    text.includes("chat") ||
    text.includes("channel") ||
    text.includes("whisper")
  ) {
    return ["chat"];
  }
  if (text.includes("journal")) {
    return ["journal"];
  }
  if (text.includes("quest")) {
    return ["quests"];
  }
  if (
    text.includes("guild") ||
    text.includes("party") ||
    text.includes("combat")
  ) {
    return ["tasks"];
  }
  return [];
}

function expectedOpenTabForObjective(objective: string | undefined) {
  return expectedOpenTabsForObjective(objective)[0];
}

function snapshotGroveMarkerIdForWorldObject(
  detail: HarthmereWorldObjectInteractionEventDetail
) {
  const label = normalizeSnapshotGroveLiveLabel(
    typeof detail.label === "string" ? detail.label : undefined
  );
  if (!label) {
    return undefined;
  }
  return SNAPSHOT_GROVE_LANDMARKS.find((marker) => {
    const markerLabel = normalizeSnapshotGroveLiveLabel(marker.label);
    const markerId = normalizeSnapshotGroveLiveLabel(marker.id);
    return label === markerLabel || label === markerId;
  })?.id;
}

function snapshotGroveWorldObjectActionMatchesMarker(
  detail: HarthmereWorldObjectInteractionEventDetail,
  marker: ReturnType<typeof currentMarkerForQuest> | undefined
) {
  if (!marker) {
    return false;
  }
  const eventMarkerId = snapshotGroveMarkerIdForWorldObject(detail);
  if (eventMarkerId) {
    return eventMarkerId === marker.id;
  }
  const label = normalizeSnapshotGroveLiveLabel(
    typeof detail.label === "string" ? detail.label : undefined
  );
  return Boolean(
    label && label === normalizeSnapshotGroveLiveLabel(marker.label)
  );
}

function snapshotGroveEventFromWorldObjectInteraction(
  detail: HarthmereWorldObjectInteractionEventDetail,
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  completedCount = 0
): GardenHoseEvent | undefined {
  const trigger = currentTriggerForQuest(quest, objectiveIndex);
  const marker = currentMarkerForQuest(quest, objectiveIndex, completedCount);
  if (
    !trigger ||
    !snapshotGroveWorldObjectActionMatchesMarker(detail, marker)
  ) {
    return undefined;
  }

  const objective =
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ];
  const kind = detail.kind;
  const base = {
    questId: quest.id,
    objectiveIndex,
    trigger,
    markerId: marker?.id,
    objectLabel: detail.label ?? undefined,
    objectInteractionKind: kind,
  };
  const isWorldUse = [
    "read",
    "repair",
    "use",
    "inspect",
    "practice",
    "open_door",
    "open_gate",
    "craft",
    "cook",
    "check_outfit",
    "take_photo",
    "recover",
    "tend",
  ].includes(kind);

  switch (trigger) {
    case "near_location":
      if (isWorldUse || kind === "open_container" || kind === "gather") {
        return { ...base, kind: "arrival_distance_check" } as any;
      }
      return undefined;
    case "destroy":
      if (kind === "gather" || kind === "inspect" || kind === "practice") {
        return { ...base, kind: "destroy" } as any;
      }
      return undefined;
    case "interact":
      if (
        isWorldUse ||
        kind === "open_container" ||
        (kind === "gather" &&
          isSnapshotGroveWorldObjectPickupTrigger(
            quest,
            objectiveIndex,
            trigger
          ))
      ) {
        return { ...base, kind: "inspect_frame" } as any;
      }
      return undefined;
    case "open_tab":
      if (kind === "read" || kind === "inspect" || kind === "use") {
        return {
          ...base,
          kind: "open_tab",
          tab: expectedOpenTabForObjective(objective),
        } as any;
      }
      return undefined;
    case "choice":
      if (isWorldUse || kind === "open_container") {
        return {
          ...base,
          kind: "snapshot_grove_practice_action",
        } as any;
      }
      return undefined;
    case "item_grant":
      if (isWorldUse || kind === "open_container" || kind === "gather") {
        return { ...base, kind: "inventory_change" } as any;
      }
      return undefined;
    case "collect":
      if (isWorldUse || kind === "open_container" || kind === "gather") {
        const collectedItem = snapshotGrovePracticeItemFixtureForObjective(
          quest,
          objectiveIndex
        );
        return {
          ...base,
          kind: "inventory_change",
          itemId: collectedItem?.itemId,
          itemName: collectedItem?.label,
        } as any;
      }
      return undefined;
    case "craft":
      if (kind === "craft") {
        return { ...base, kind: "craft" } as any;
      }
      return undefined;
    case "combat":
      // Lightweight Grove props are not native NPC entities, so their explicit
      // F-practice action is the accessible fallback for the same target. A
      // real Mouse0/weapon strike still arrives as npc_damage from the forward
      // arc combat system and follows the normal combat path.
      if (kind === "practice") {
        return {
          ...base,
          kind: "npc_damage",
          targetId: marker?.id,
          targetName: marker?.label,
        } as any;
      }
      return undefined;
    case "open_jobs_board":
      if (kind === "open_jobs_board") {
        return { ...base, kind: "open_jobs_board" } as any;
      }
      return undefined;
    default:
      return undefined;
  }
}

type SnapshotGrovePracticeItem = {
  itemId: string;
  quantity: number;
  label: string;
};

let snapshotGroveSuppressInventoryAdvanceDepth = 0;

function withSnapshotGroveInventoryAdvanceSuppressed<T>(fn: () => T): T {
  snapshotGroveSuppressInventoryAdvanceDepth += 1;
  try {
    return fn();
  } finally {
    snapshotGroveSuppressInventoryAdvanceDepth = Math.max(
      0,
      snapshotGroveSuppressInventoryAdvanceDepth - 1
    );
  }
}

function snapshotGroveObjectiveText(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return (
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ] ?? ""
  );
}

function snapshotGrovePracticeItemForObjective(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
): SnapshotGrovePracticeItem | undefined {
  return snapshotGrovePracticeItemFixtureForObjective(quest, objectiveIndex);
}

export function snapshotGrovePracticeItemForObjectiveForTest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return snapshotGrovePracticeItemForObjective(quest, objectiveIndex);
}

function grantSnapshotGrovePracticeItem(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined
) {
  if (
    !trigger ||
    !SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS.has(trigger as any)
  ) {
    return undefined;
  }
  const item = snapshotGrovePracticeItemForObjective(quest, objectiveIndex);
  if (!item) {
    return undefined;
  }
  grantHarthmereItem(
    item.itemId,
    item.quantity,
    `${quest.title}: ${item.label}`
  );
  return item;
}

function isSnapshotGroveWorldObjectPickupTrigger(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined
) {
  if (trigger === "collect" || trigger === "item_grant") {
    return true;
  }
  if (trigger !== "interact") {
    return false;
  }
  return /\b(take|pick up|collect|gather|retrieve|recover|dig)\b/i.test(
    snapshotGroveObjectiveText(quest, objectiveIndex)
  );
}

function grantSnapshotGroveWorldObjectPickupItem(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined,
  serverAuthoritativePickup = false
) {
  if (
    !isSnapshotGroveWorldObjectPickupTrigger(quest, objectiveIndex, trigger)
  ) {
    return undefined;
  }
  const item = snapshotGrovePracticeItemForObjective(quest, objectiveIndex);
  if (!item) {
    return undefined;
  }
  const grant = serverAuthoritativePickup
    ? grantHarthmereItemLocallyForTest
    : grantHarthmereItem;
  grant(item.itemId, item.quantity, `${quest.title}: ${item.label}`);
  return item;
}

export function grantSnapshotGroveWorldObjectPickupItemForTest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined
) {
  return withSnapshotGroveInventoryAdvanceSuppressed(() =>
    grantSnapshotGroveWorldObjectPickupItem(
      quest,
      objectiveIndex,
      trigger,
      true
    )
  );
}

// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
// HUD highlight chips like "BAG", "MAP", "CHAT" are abstract — the player
// sees an icon row at the bottom of the screen with labels Bag/Craft/Map/
// Quests/Tasks/Mail/Notif/Codex/Settings/Chat/Revive. This mapping turns
// the abstract chip set into the concrete NavSlot labels that should pulse
// and show an arrow. Returning [] disables the bottom-bar highlight (e.g.
// for triggers like near_location or combat that are not HUD-button-driven).
export const SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT =
  "biomes:snapshot-grove-tutor-hud-highlights";

export function snapshotGroveTutorNavLabelsForHighlights(
  highlights: string[]
): string[] {
  const labels = new Set<string>();
  for (const chip of highlights) {
    switch (chip) {
      case "BAG":
      case "HOTBAR":
      case "INVENTORY":
        labels.add("Bag");
        break;
      case "CRAFT":
      case "WORKBENCH":
      case "CRAFTING":
        labels.add("Craft");
        break;
      case "MAP":
      case "MARKER":
        labels.add("Map");
        break;
      case "JOURNAL":
        labels.add("Quests");
        break;
      case "QUESTS":
        labels.add("Quests");
        break;
      case "TASKS":
      case "CHALLENGE":
        labels.add("Tasks");
        break;
      case "INBOX":
      case "MAIL":
      case "STORAGE":
        labels.add("Mail");
        break;
      case "NOTIF":
      case "NOTIFICATION":
        labels.add("Notif");
        break;
      case "CODEX":
        labels.add("Codex");
        break;
      case "CHAT":
      case "SAY":
      case "WHISPER":
        labels.add("Chat");
        break;
      case "REVIVE":
      case "HEALTH":
        labels.add("Revive");
        break;
      case "FOOD":
      case "RATION":
      case "ITEM":
      case "QUEST_ITEM":
      case "MATERIAL":
      case "GEAR":
        labels.add("Bag");
        break;
      case "GUILD":
      case "PARTY":
        labels.add("Tasks");
        break;
      case "SETTINGS":
        labels.add("Settings");
        break;
      default:
        break;
    }
  }
  return [...labels];
}

export function snapshotGroveTutorNavLabelsForObjectiveForTest(
  trigger: string | undefined,
  objective: string | undefined
): string[] {
  const highlights = groveHudHighlightsForTrigger(trigger, objective);
  switch (trigger) {
    case "open_tab":
      return snapshotGroveTutorNavLabelsForHighlights(highlights);
    case "inventory_change":
    case "item_use":
    case "item_update":
      return ["Bag"];
    case "craft":
      return ["Craft"];
    default:
      // World pickups, proximity checks, NPC conversations, and direct object
      // interactions have no HUD tab to open. Pulsing Bag merely because the
      // objective names a sample/item points the player away from the marked
      // world object and leaves stale guidance covering the screen.
      return [];
  }
}

function broadcastSnapshotGroveTutorHudLabels(
  labels: string[],
  chips: string[] = []
) {
  if (typeof window === "undefined") return;
  try {
    (
      window as typeof window & {
        __snapshotGroveTutorHighlights?: {
          labels: string[];
          chips: string[];
        };
      }
    ).__snapshotGroveTutorHighlights = {
      labels: [...labels],
      chips: [...chips],
    };
    window.dispatchEvent(
      new CustomEvent(SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT, {
        detail: {
          labels,
          chips,
          version: "snapshot-grove-black-menu-highlight",
        },
      })
    );
  } catch {
    // Ignore in non-browser test contexts.
  }
}

function isSnapshotGroveContextualPracticeEvent(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined
) {
  if (!trigger) {
    return false;
  }
  const detail = event as any;
  if (detail.kind !== "snapshot_grove_practice_action") {
    return false;
  }
  const expectedChatAction =
    quest.id === "fountain_chat_channels" && objectiveIndex === 2
      ? "chat_say"
      : quest.id === "fountain_chat_channels" && objectiveIndex === 3
        ? "chat_whisper"
        : undefined;
  if (
    !SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS.has(trigger as any) &&
    detail.practiceAction !== expectedChatAction
  ) {
    return false;
  }
  if (expectedChatAction && detail.practiceAction !== expectedChatAction) {
    return false;
  }
  const targetMarkerIds = snapshotGroveObjectiveTargetMarkerIds(
    quest,
    objectiveIndex
  );
  return (
    detail.questId === quest.id &&
    detail.objectiveIndex === objectiveIndex &&
    detail.trigger === trigger &&
    (!targetMarkerIds.length ||
      !detail.markerId ||
      targetMarkerIds.includes(detail.markerId))
  );
}

export interface SnapshotGroveQuestEventValidation {
  ok: boolean;
  reason?:
    | "quest_id_mismatch"
    | "objective_index_mismatch"
    | "trigger_mismatch"
    | "marker_id_mismatch";
}

export function validateSnapshotGroveQuestEventContext(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined = currentTriggerForQuest(quest, objectiveIndex)
): SnapshotGroveQuestEventValidation {
  const detail = event as any;
  if (typeof detail.questId === "string" && detail.questId !== quest.id) {
    return { ok: false, reason: "quest_id_mismatch" };
  }
  if (
    typeof detail.objectiveIndex === "number" &&
    Number.isFinite(detail.objectiveIndex) &&
    detail.objectiveIndex !== objectiveIndex
  ) {
    return { ok: false, reason: "objective_index_mismatch" };
  }
  if (
    typeof detail.trigger === "string" &&
    trigger &&
    detail.trigger !== trigger
  ) {
    return { ok: false, reason: "trigger_mismatch" };
  }

  const targetMarkerIds = snapshotGroveObjectiveTargetMarkerIds(
    quest,
    objectiveIndex
  );
  const eventMarkerId =
    typeof detail.markerId === "string"
      ? detail.markerId
      : typeof detail.targetMarkerId === "string"
        ? detail.targetMarkerId
        : undefined;
  if (
    eventMarkerId &&
    targetMarkerIds.length &&
    !targetMarkerIds.includes(eventMarkerId)
  ) {
    return { ok: false, reason: "marker_id_mismatch" };
  }
  return { ok: true };
}

function doesEventMatchSnapshotGroveTrigger(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  const trigger = currentTriggerForQuest(quest, objectiveIndex);
  if (!trigger) {
    return false;
  }
  if (
    isSnapshotGroveContextualPracticeEvent(
      event,
      quest,
      objectiveIndex,
      trigger
    )
  ) {
    return true;
  }
  if (
    !validateSnapshotGroveQuestEventContext(
      event,
      quest,
      objectiveIndex,
      trigger
    ).ok
  ) {
    return false;
  }

  const kind = (event as any).kind;
  const objective =
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ];
  const marker = currentMarkerForQuest(quest, objectiveIndex);
  switch (trigger) {
    case "talk_npc": {
      const actualNpcId = snapshotGroveNpcIdFromTalkEvent(event);
      const expectedNpcId = marker?.npcId ?? snapshotGroveQuestGiverId(quest);
      return Boolean(
        actualNpcId && expectedNpcId && actualNpcId === expectedNpcId
      );
    }
    case "near_location":
      return kind === "arrival_distance_check";
    case "destroy":
      return kind === "destroy";
    case "place_voxel":
      return kind === "place_voxel" || kind === "place_placeable";
    case "jump_run":
      return kind === "jump" && Boolean((event as any).running);
    case "photo_post":
      return (
        kind === "photo_post_attempt" ||
        kind === "photo_post" ||
        kind === "show_post_capture"
      );
    case "combat":
      return (
        (kind === "npc_damage" || kind === "npc_killed") &&
        (/dummy|muckling|muck/.test(
          `${(event as any).targetId ?? ""} ${
            (event as any).targetName ?? ""
          } ${(event as any).npcType ?? ""}`.toLowerCase()
        ) ||
          (event as any).questId === quest.id ||
          typeof (event as any).markerId === "string")
      );
    case "open_tab": {
      if (kind !== "open_tab") {
        return false;
      }
      const expectedTabs = expectedOpenTabsForObjective(objective);
      return !expectedTabs.length || expectedTabs.includes((event as any).tab);
    }
    case "interact":
      return (
        kind === "open_station" ||
        kind === "open_shop" ||
        kind === "inspect_frame" ||
        kind === "place_placeable"
      );
    case "inventory_change":
      return snapshotGroveInventoryEventMatchesObjective(
        event as any,
        quest,
        objectiveIndex
      );
    case "collect":
      return snapshotGroveCollectEventMatchesObjective(
        event as any,
        quest,
        objectiveIndex
      );
    case "craft":
      return (
        kind === "craft" &&
        snapshotGroveCraftEventMatchesObjective(
          event as any,
          quest,
          objectiveIndex
        )
      );
    case "open_jobs_board":
      return kind === "open_jobs_board";
    case "item_grant":
      return (
        kind === "inventory_change" ||
        kind === "inventory_overflow_item_received" ||
        kind === "mail_received"
      );
    case "item_use":
      if (kind === "item_use" || kind === "harthmere_local_dev_item_use") {
        return snapshotGroveItemUseEventMatchesObjective(
          event as any,
          quest,
          objectiveIndex
        );
      }
      return false;
    case "item_update":
      return (
        kind === "inventory_change" ||
        kind === "local_inventory_selection_change" ||
        kind === "selection_change"
      );
    case "status_check":
      return kind === "snapshot_grove_practice_action";
    case "escort":
    case "carry":
      return kind === "move" && (event as any).questId === quest.id;
    case "choice":
    default:
      return false;
  }
}

function actionNameForTrigger(trigger: string | undefined) {
  switch (trigger) {
    case "choice":
      return "Choose an answer";
    case "item_grant":
      return "Receive the item";
    case "open_tab":
      return "Open the panel";
    case "interact":
      return "Use the station";
    case "near_location":
      return "Confirm arrival";
    case "place_voxel":
      return "Place the repair piece";
    case "destroy":
      return "Clear the obstacle";
    case "talk_npc":
      return "Talk";
    case "inventory_change":
      return "Update your gear";
    case "collect":
      return "Collect the marked item";
    case "combat":
      return "Complete the safe practice";
    case "status_check":
      return "Check the HUD";
    case "photo_post":
      return "Take or save the photo";
    case "craft":
      return "Craft the item";
    case "escort":
      return "Guide carefully";
    case "carry":
      return "Carry the item";
    case "item_use":
      return "Use the item";
    case "item_update":
      return "Update the item";
    case "jump_run":
      return "Run and jump";
    default:
      return "Confirm objective";
  }
}

function groveHudHintForTrigger(trigger: string | undefined) {
  switch (trigger) {
    case "open_tab":
      return "Open the highlighted HUD panel or use the matching hotkey.";
    case "near_location":
      return "Follow the pinned marker until the distance badge says you are there.";
    case "interact":
      return "Stand close to the marked object and use the highlighted interaction.";
    case "inventory_change":
      return "Change your gear, bag, or quick slot so your character is truly ready.";
    case "status_check":
      return "Check the highlighted health, stamina, or ready-state area before moving on.";
    case "combat":
      return "Use the marked dummy or sparring ring; do not strike another player.";
    case "choice":
      return "Pick the highlighted practice answer at the marked stop.";
    case "place_voxel":
      return "Place the block where it helps the road without blocking doors or paths.";
    case "collect":
    case "destroy":
      return "Use the marked practice supplies first; unmarked supplies may belong to someone.";
    case "talk_npc":
      return "Talk to the marked person again after the practice step is done.";
    case "craft":
      return "Open the workbench or recipe panel and craft the marked practice item.";
    case "item_use":
      return "Use the correct item from your hotbar or bag while you are at the marker.";
    default:
      return "Do the marked action in the world, then look for the next pin.";
  }
}

function groveQuestStepCopy(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  completedCount = 0
) {
  const clamped = Math.max(
    0,
    Math.min(quest.objectives.length - 1, objectiveIndex)
  );
  const marker = currentMarkerForQuest(quest, clamped, completedCount);
  const trigger = currentTriggerForQuest(quest, clamped);
  const action = actionNameForTrigger(trigger);
  const requiredCount = snapshotGroveObjectiveRequiredCount(quest, clamped);
  return {
    progress: `${clamped + 1}/${quest.objectives.length}: ${
      quest.objectives[clamped]
    }${requiredCount > 1 ? ` (${completedCount}/${requiredCount})` : ""}`,
    target: marker
      ? `Next stop: ${marker.label}.`
      : "Next stop: follow the active map marker.",
    action,
    hudHint: groveHudHintForTrigger(trigger),
  };
}

function groveHudHighlightsForTrigger(
  trigger: string | undefined,
  objective: string | undefined
) {
  const text = (objective ?? "").toLowerCase();
  const highlights = new Set<string>();
  switch (trigger) {
    case "open_tab":
      highlights.add("HUD");
      highlights.add(
        (expectedOpenTabForObjective(objective) ?? "panel").toUpperCase()
      );
      break;
    case "inventory_change":
    case "collect":
    case "item_grant":
    case "item_use":
    case "item_update":
      highlights.add("BAG");
      highlights.add("HOTBAR");
      break;
    case "near_location":
      highlights.add("MARKER");
      highlights.add("DISTANCE");
      break;
    case "interact":
      highlights.add("INTERACT");
      highlights.add("MARKER");
      break;
    case "combat":
      highlights.add("TARGET");
      highlights.add("HEALTH");
      break;
    case "status_check":
      highlights.add("HEALTH");
      highlights.add("STAMINA");
      break;
    case "choice":
      highlights.add("CHOICE");
      break;
    case "craft":
      highlights.add("CRAFT");
      highlights.add("WORKBENCH");
      break;
    case "photo_post":
      highlights.add("CAMERA");
      break;
    case "jump_run":
      highlights.add("SPRINT");
      highlights.add("JUMP");
      break;
    case "talk_npc":
      highlights.add("TALK");
      break;
  }
  if (text.includes("map")) highlights.add("MAP");
  if (text.includes("journal") || text.includes("quest"))
    highlights.add("JOURNAL");
  if (text.includes("mail") || text.includes("storage"))
    highlights.add("INBOX");
  // SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
  if (
    text.includes("chat") ||
    text.includes("channel") ||
    text.includes("whisper") ||
    text.includes("say message")
  ) {
    highlights.add("CHAT");
  }
  if (/food|ration|eat|stamina/.test(text)) highlights.add("FOOD");
  if (/bandage|salve|first.?aid|medicine|health/.test(text))
    highlights.add("HEALTH");
  if (/guild|party|ready|charter/.test(text)) highlights.add("GUILD");
  if (/storage|mail|bank|lost|found|recovery/.test(text))
    highlights.add("STORAGE");
  if (/recipe|craft|workbench|torch/.test(text)) highlights.add("CRAFT");
  if (/item|sample|root|berry|stick|stone|bolt|key|camera/.test(text))
    highlights.add("ITEM");
  return [...highlights].slice(0, 6);
}

function needsSnapshotGroveContextualPracticeButton(
  trigger: string | undefined
) {
  return Boolean(
    trigger && SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS.has(trigger as any)
  );
}

function snapshotGrovePracticeButtonLabel(trigger: string | undefined) {
  switch (trigger) {
    case "choice":
      return "Pick practice answer";
    case "collect":
      return "Pick up marked item";
    case "craft":
      return "Craft practice item";
    case "photo_post":
      return "Take practice photo";
    case "item_grant":
      return "Take practice item";
    case "status_check":
      return "Confirm ready state";
    case "item_use":
      return "Use practice item";
    case "item_update":
      return "Update practice item";
    case "escort":
      return "Guide practice target";
    case "carry":
      return "Carry practice load";
    case "interact":
      return "Use marked object";
    default:
      return "Do marked practice";
  }
}

function doesEventAdvanceQuest(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return doesEventMatchSnapshotGroveTrigger(event, quest, objectiveIndex);
}

export function doesSnapshotGroveEventAdvanceQuestForTest(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return doesEventAdvanceQuest(event, quest, objectiveIndex);
}

export function snapshotGroveQuestEventFromWorldObjectInteractionForTest(
  detail: HarthmereWorldObjectInteractionEventDetail,
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return snapshotGroveEventFromWorldObjectInteraction(
    detail,
    quest,
    objectiveIndex
  );
}

function useSnapshotGroveQuestState() {
  const [state, setState] = useState<SnapshotGroveQuestState>(() =>
    readSnapshotGroveQuestState()
  );
  useEffect(() => {
    const refresh = () => setState(readSnapshotGroveQuestState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT, refresh);
    };
  }, []);
  return state;
}

export function snapshotGroveNpcIdForEntityForTest(input: {
  entityId: BiomesId;
  labelText?: string;
  entityDescriptionText?: string;
  defaultDialog?: string;
}) {
  const canonicalEntityId = canonicalSnapshotGroveNpcEntityId(input.entityId);
  if (canonicalEntityId === JACKIE_ID) {
    return "jackie";
  }
  const labelMappedId = snapshotGroveNpcIdForDialogLabel({
    label: input.labelText,
    entityDescriptionText: input.entityDescriptionText,
    defaultDialog: input.defaultDialog,
  });
  const seededId = snapshotGroveNpcIdFromEntityId(canonicalEntityId);
  // The visible label is the safest compatibility signal when a retained
  // world still contains a legacy actor id. Prefer it over arithmetic id-band
  // inference so a stale replacement cannot make Jackie's Grove offers fall
  // through to the unrelated Road Ahead conversation.
  return labelMappedId ?? seededId;
}

function npcForEntity(
  entityId: BiomesId,
  labelText?: string,
  entityDescriptionText?: string,
  defaultDialog?: string
): SnapshotGroveNpc | undefined {
  const npcId = snapshotGroveNpcIdForEntityForTest({
    entityId,
    labelText,
    entityDescriptionText,
    defaultDialog,
  });
  return SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.id === npcId
  );
}

function npcLineForLikeability(npc: SnapshotGroveNpc) {
  const likeability = readSnapshotGroveLikeability()[npc.id] || 0;
  if (likeability >= 2 && npc.extraLines[1]) {
    return npc.extraLines[1];
  }
  if (likeability >= 1 && npc.extraLines[0]) {
    return npc.extraLines[0];
  }
  return npc.line;
}

function npcAmbientLineForLikeability(npc: SnapshotGroveNpc) {
  // Ambient copy lives separately so relationship chatter can evolve without
  // mutating the canonical tutorial and Road Ahead dialogue fields.
  const likeability = readSnapshotGroveLikeability()[npc.id] || 0;
  return snapshotGroveAmbientLineForNpc(npc.id, likeability);
}

export function snapshotGroveObjectiveIsCompletionTurnInForTest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  return (
    objectiveIndex === quest.objectives.length - 1 &&
    currentTriggerForQuest(quest, objectiveIndex) === "talk_npc"
  );
}

function npcQuestDialogueCopy(
  npc: SnapshotGroveNpc,
  quest: SnapshotGroveQuest,
  state: SnapshotGroveQuestState,
  objectiveIndex: number
) {
  const firstName = npc.displayName.split(",")[0].trim();
  if (state.completedQuestIds.includes(quest.id)) {
    return [
      `<text>${quest.title} is handled.</text>`,
      `<text>${firstName} gives you a satisfied nod and stamps the lesson in your journal.</text>`,
    ].join("{break}");
  }
  if (!state.acceptedQuestIds.includes(quest.id)) {
    return [
      `<text>${quest.sampleDialogue}</text>`,
      `<text>Take this on if you have a quiet minute. I will mark the first stop on your map so you can find it again.</text>`,
    ].join("{break}");
  }
  const safeIndex = Math.max(
    0,
    Math.min(quest.objectives.length - 1, objectiveIndex)
  );
  // The final giver interaction should acknowledge the work immediately; the
  // old generic objective copy made a completed lesson appear unfinished.
  if (snapshotGroveObjectiveIsCompletionTurnInForTest(quest, safeIndex)) {
    return [
      `<text>You completed ${quest.title}.</text>`,
      `<text>${firstName} confirms the final check, records the lesson, and gives you ${quest.reward}</text>`,
    ].join("{break}");
  }
  const marker = currentMarkerForQuest(quest, safeIndex);
  const destination = marker ? marker.label : "your next pinned stop";
  const objectiveSentence = quest.objectives[safeIndex];
  // SNAPSHOT_GROVE_DIALOGUE_SPACING:
  // Each chunk has to be a separate paragraph so unslugNpcDescription splits
  // them into independent dialog steps. Joining with {break} produces real
  // sentence breaks; without it the parser collapses everything into one run
  // of text and you get "go.Say is the room" / "day.Next on the list".
  // The closer is in first-person and stays in character — no more
  // "I will be right here ... when {Marker} is taken care of" third-person
  // self-talk.
  return [
    `<text>${quest.sampleDialogue}</text>`,
    `<text>Next on the list: ${objectiveSentence}</text>`,
    `<text>Come find me back here at the fountain when ${destination} is sorted.</text>`,
  ].join("{break}");
}

function groveBankerProgressiveQuestionActions(
  npc: SnapshotGroveNpc
): TalkDialogStepAction[] {
  if (npc.id !== "grove_banker_merl") {
    return [];
  }
  return [
    {
      name: "What can I store here?",
      type: "primary",
      tooltip:
        "Banking basics: personal vault, account vault, and material storage.",
      followUpText:
        "I keep three ledger columns for this. Your personal vault holds ordinary items. Your account vault is for goods you want shared across your own characters. Material storage is the small, plain shelf for resources like wood, stone, ore, herbs, and other crafting supplies. None of those are pretend balances; the server ledger decides what exists.",
      onPerformed: () => recordSnapshotGroveLikeability(npc.id, 1),
    },
    {
      name: "Does weight limit my backpack?",
      tooltip: "Explains carry weight, backpack slots, and storage.",
      followUpText:
        "Weight never blocks an item if your backpack has a slot for it. Heavy loads drain stamina faster, so homes, shops, workshops, and managed vaults are still useful for anything you do not need on the road.",
      onPerformed: () => recordSnapshotGroveLikeability(npc.id, 1),
    },
    {
      name: "How do loans work?",
      tooltip: "Explains principal, daily interest, and due dates.",
      followUpText:
        "A loan gives you gold now and a due date later. Interest grows by the day, not by vague story time. Pay early if you can. Paying late means the same principal now drags extra interest behind it.",
      onPerformed: () => recordSnapshotGroveLikeability(npc.id, 1),
    },
    {
      name: "What happens if I do not repay?",
      type: "destructive",
      tooltip: "Explains default consequences before the player borrows.",
      followUpText:
        "I close the ledger halfway for this part. If a loan defaults, the bank marks a credit hold, records a reputation penalty, applies a default fee, and keeps late interest moving until the debt is cleared. You can still repay, but the town remembers that you made the ledger chase you.",
      onPerformed: () => recordSnapshotGroveLikeability(npc.id, 1),
    },
  ];
}

export function useSnapshotGroveNpcDialog(
  talkingToNPCId: BiomesId,
  defaultDialog: string
):
  | {
      id: string;
      dialogText: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const { mapManager, reactResources, resources } = useClientContext();
  const [label, entityDescription] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/entity_description", talkingToNPCId]
  );
  const state = useSnapshotGroveQuestState();

  return useMemo(() => {
    const npc = npcForEntity(
      talkingToNPCId,
      label?.text,
      entityDescription?.text,
      defaultDialog
    );
    if (!npc) {
      return undefined;
    }
    const activeQuest = activeQuestForNpc(npc.id, state);
    const completedQuest = activeQuest
      ? undefined
      : mostRecentlyCompletedSnapshotGroveQuestForNpcForTest(
          npc.id,
          state.completedQuestIds
        );
    const availableQuests = availableQuestsForNpc(npc.id, state);
    const visibleQuestOffers = visibleSnapshotGroveQuestOffersForNpcForTest(
      npc.id,
      state
    );
    const availableQuest = availableQuests[0];
    const quest = activeQuest ?? completedQuest ?? availableQuest;
    const objectiveIndex = quest
      ? snapshotGroveObjectiveIndexForQuest(state, quest.id)
      : 0;
    const marker = quest
      ? currentMarkerForQuest(quest, objectiveIndex)
      : undefined;
    const actions: TalkDialogStepAction[] = [];

    if (!activeQuest && availableQuests.length) {
      // Keep the conversation readable. The sorted catalogue remains intact;
      // accepting or completing one offer exposes the next queued lesson.
      for (const option of visibleQuestOffers) {
        actions.push({
          name: `Start ${option.title}`,
          type: actions.length === 0 ? "primary" : "normal",
          tooltip: option.hook,
          onPerformed: () =>
            acceptSnapshotGroveQuest(option, mapManager, resources),
        });
      }
    } else if (
      activeQuest &&
      !state.completedQuestIds.includes(activeQuest.id)
    ) {
      // World, inventory, movement, and HUD objectives still have to be
      // completed in their authored systems. The final return-to-giver step is
      // different: its explicit button is the player's confirmation that the
      // completion dialogue was read and the handoff should be committed.
      const activeObjectiveIndex = snapshotGroveObjectiveIndexForQuest(
        state,
        activeQuest.id
      );
      if (
        snapshotGroveObjectiveIsCompletionTurnInForTest(
          activeQuest,
          activeObjectiveIndex
        )
      ) {
        actions.push({
          name: `Complete ${activeQuest.title}`,
          type: "primary",
          tooltip: activeQuest.reward,
          onPerformed: () =>
            advanceSnapshotGroveQuest(
              activeQuest,
              mapManager,
              "completion_turn_in",
              resources,
              {
                expectedObjectiveIndex: activeObjectiveIndex,
                trigger: currentTriggerForQuest(
                  activeQuest,
                  activeObjectiveIndex
                )!,
              }
            ),
        });
      }
    }

    if (marker) {
      actions.push({
        name: `Show ${marker.label} on the map`,
        type: "normal",
        tooltip: marker.label,
        onPerformed: () => {
          pinSnapshotGroveLandmark(
            mapManager,
            marker,
            snapshotGroveStepNavAidId(objectiveIndex)
          );
          requestSnapshotGroveLandmarkOnMapForBiomesUI(marker);
        },
      });
    }

    actions.push(...groveBankerProgressiveQuestionActions(npc));

    // Keep all authored quest/tutorial copy exactly as-is. The separate ambient
    // bank is used only when this NPC has no active or available quest.
    const line = quest
      ? npcLineForLikeability(npc)
      : (npcAmbientLineForLikeability(npc) ?? npcLineForLikeability(npc));
    const questCopy = completedQuest
      ? npcQuestDialogueCopy(npc, completedQuest, state, objectiveIndex)
      : !activeQuest && availableQuests.length > 1
        ? `<text>I keep two short lessons on the board at a time so the list stays readable. Finish or accept one and I will put the next one up.</text>`
        : quest
          ? npcQuestDialogueCopy(npc, quest, state, objectiveIndex)
          : `<text>${defaultDialog || npc.shortDescription}</text>`;

    return {
      id: `${SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION}-${npc.id}-${
        quest?.id ?? "bark"
      }-${objectiveIndex}`,
      // SNAPSHOT_GROVE_DIALOGUE_SPACING:
      // The bark line and the quest copy have to be different dialog steps;
      // joining with {break} keeps them as separate paragraphs instead of
      // collapsing into one run-on screen.
      dialogText: `<text>${line}</text>{break}${questCopy}`,
      actions,
    };
  }, [
    defaultDialog,
    entityDescription?.text,
    label?.text,
    mapManager,
    resources,
    state,
    talkingToNPCId,
  ]);
}

export const SnapshotGroveBibleRuntimeController: React.FunctionComponent<{}> =
  () => {
    const { gardenHose, mapManager, reactResources, resources } =
      useClientContext();
    const localPlayer = reactResources.use("/scene/local_player");
    const state = useSnapshotGroveQuestState();

    useEffect(() => {
      void repairSnapshotGroveCompletionProjection();
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const reconcile = () => {
        void repairSnapshotGroveCompletionProjection();
      };
      window.addEventListener(
        SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT,
        reconcile
      );
      return () =>
        window.removeEventListener(
          SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT,
          reconcile
        );
    }, []);

    useEffect(() => {
      const handler = (event: GardenHoseEvent) => {
        const current = readSnapshotGroveQuestState();
        for (const {
          quest,
          objectiveIndex,
          completedCount,
        } of activeSnapshotGroveQuestRows(current)) {
          let contextualEvent = event;
          if (
            (event as any).kind === "place_voxel" ||
            (event as any).kind === "place_placeable" ||
            (event as any).kind === "destroy" ||
            (event as any).kind === "npc_damage" ||
            (event as any).kind === "npc_killed"
          ) {
            const marker = currentMarkerForQuest(
              quest,
              objectiveIndex,
              completedCount
            );
            const playerPos = localPlayer.player.position as Vec3;
            if (
              !marker ||
              Math.hypot(
                marker.position[0] - playerPos[0],
                marker.position[2] - playerPos[2]
              ) > 8
            ) {
              continue;
            }
            contextualEvent = {
              ...(event as any),
              markerId: marker.id,
            } as GardenHoseEvent;
          }
          if (doesEventAdvanceQuest(contextualEvent, quest, objectiveIndex)) {
            void advanceSnapshotGroveQuest(
              quest,
              mapManager,
              (contextualEvent as any).kind || "event",
              resources,
              {
                count: snapshotGroveEventCompletionCount(
                  contextualEvent as any
                ),
                key:
                  typeof (contextualEvent as any).markerId === "string"
                    ? (contextualEvent as any).markerId
                    : undefined,
                expectedObjectiveIndex: objectiveIndex,
                trigger: currentTriggerForQuest(quest, objectiveIndex)!,
              }
            );
          }
        }
      };
      gardenHose.on("anyEvent", handler);
      return () => gardenHose.off("anyEvent", handler);
    }, [gardenHose, localPlayer.player.position, mapManager, resources]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = (browserEvent: Event) => {
        const detail = (
          browserEvent as CustomEvent<HarthmereLocalCombatNpcDamageEventDetail>
        ).detail;
        if (!detail || detail.damage <= 0) {
          return;
        }
        // Local forward-arc combat owns its lightweight practice targets, while
        // Grove objectives consume the same GardenHose npc_damage contract as
        // native NPC combat. Bridge only a resolved damaging contact; misses,
        // animation-only clicks, and blocked safe-zone swings cannot progress.
        gardenHose.publish({
          kind: "npc_damage",
          targetId: detail.targetId,
          targetName: detail.targetName,
          damage: detail.damage,
        } as unknown as GardenHoseEvent);
      };
      window.addEventListener(HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT, handler);
      return () =>
        window.removeEventListener(
          HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT,
          handler
        );
    }, [gardenHose]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = () => {
        if (snapshotGroveSuppressInventoryAdvanceDepth > 0) {
          return;
        }
        const current = readSnapshotGroveQuestState();
        const event = {
          kind: "inventory_change",
          operation: "organize",
        } as unknown as GardenHoseEvent;
        for (const { quest, objectiveIndex } of activeSnapshotGroveQuestRows(
          current
        )) {
          if (doesEventAdvanceQuest(event, quest, objectiveIndex)) {
            void advanceSnapshotGroveQuest(
              quest,
              mapManager,
              "local inventory changed",
              resources,
              {
                expectedObjectiveIndex: objectiveIndex,
                trigger: currentTriggerForQuest(quest, objectiveIndex)!,
              }
            );
          }
        }
      };
      window.addEventListener(HARTHMERE_INVENTORY_EVENT, handler);
      return () =>
        window.removeEventListener(HARTHMERE_INVENTORY_EVENT, handler);
    }, [mapManager, resources]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = (browserEvent: Event) => {
        const event = {
          kind: "craft",
          ...((browserEvent as CustomEvent<Record<string, unknown>>).detail ??
            {}),
        } as unknown as GardenHoseEvent;
        const current = readSnapshotGroveQuestState();
        for (const { quest, objectiveIndex } of activeSnapshotGroveQuestRows(
          current
        )) {
          if (doesEventAdvanceQuest(event, quest, objectiveIndex)) {
            void advanceSnapshotGroveQuest(
              quest,
              mapManager,
              String((event as any).recipeId ?? "craft"),
              resources,
              {
                count: snapshotGroveEventCompletionCount(event as any),
                expectedObjectiveIndex: objectiveIndex,
                trigger: currentTriggerForQuest(quest, objectiveIndex)!,
              }
            );
          }
        }
      };
      window.addEventListener(HARTHMERE_CRAFT_COMPLETED_EVENT, handler);
      return () =>
        window.removeEventListener(HARTHMERE_CRAFT_COMPLETED_EVENT, handler);
    }, [mapManager, resources]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = (browserEvent: Event) => {
        const current = readSnapshotGroveQuestState();
        const detail = (
          browserEvent as CustomEvent<HarthmereWorldObjectInteractionEventDetail>
        ).detail;
        if (!detail) {
          return;
        }
        for (const {
          quest,
          objectiveIndex,
          completedCount,
        } of activeSnapshotGroveQuestRows(current)) {
          const event = snapshotGroveEventFromWorldObjectInteraction(
            detail,
            quest,
            objectiveIndex,
            completedCount
          );
          if (!event || !doesEventAdvanceQuest(event, quest, objectiveIndex)) {
            continue;
          }
          const grantedPracticeItem =
            withSnapshotGroveInventoryAdvanceSuppressed(() =>
              grantSnapshotGroveWorldObjectPickupItem(
                quest,
                objectiveIndex,
                (event as any).trigger,
                detail.serverAuthoritativePickup === true
              )
            );
          void advanceSnapshotGroveQuest(
            quest,
            mapManager,
            grantedPracticeItem
              ? `${detail.kind}:${detail.label ?? "world_object"}:${
                  grantedPracticeItem.itemId
                }`
              : `${detail.kind}:${detail.label ?? "world_object"}`,
            resources,
            {
              count: grantedPracticeItem?.quantity ?? 1,
              key:
                typeof detail.objectId === "string"
                  ? detail.objectId
                  : (event as any).markerId,
              expectedObjectiveIndex: objectiveIndex,
              trigger: currentTriggerForQuest(quest, objectiveIndex)!,
            }
          );
        }
      };
      window.addEventListener(
        HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
        handler
      );
      return () =>
        window.removeEventListener(
          HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
          handler
        );
    }, [mapManager, resources]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = (browserEvent: Event) => {
        const current = readSnapshotGroveQuestState();
        const detail =
          (browserEvent as CustomEvent<Record<string, unknown>>).detail ?? {};
        const event = {
          kind: "harthmere_local_dev_item_use",
          ...detail,
        } as unknown as GardenHoseEvent;
        for (const { quest, objectiveIndex } of activeSnapshotGroveQuestRows(
          current
        )) {
          if (doesEventAdvanceQuest(event, quest, objectiveIndex)) {
            void advanceSnapshotGroveQuest(
              quest,
              mapManager,
              String((event as any).itemId ?? "item_use"),
              resources,
              {
                expectedObjectiveIndex: objectiveIndex,
                trigger: currentTriggerForQuest(quest, objectiveIndex)!,
              }
            );
          }
        }
      };
      window.addEventListener(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, handler);
      return () =>
        window.removeEventListener(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, handler);
    }, [mapManager, resources]);

    useEffect(() => {
      const playerPos = localPlayer.player.position as Vec3;
      for (const {
        quest,
        objectiveIndex,
        completedCount,
      } of activeSnapshotGroveQuestRows(state)) {
        const trigger = currentTriggerForQuest(quest, objectiveIndex);
        if (trigger !== "near_location") continue;
        const marker = currentMarkerForQuest(
          quest,
          objectiveIndex,
          completedCount
        );
        if (!marker) continue;
        const distance = Math.hypot(
          marker.position[0] - playerPos[0],
          marker.position[2] - playerPos[2]
        );
        if (distance <= 8) {
          void advanceSnapshotGroveQuest(
            quest,
            mapManager,
            "arrived_at_marker",
            resources,
            {
              key: marker.id,
              expectedObjectiveIndex: objectiveIndex,
              trigger,
            }
          );
        }
      }
    }, [
      localPlayer.player.position,
      mapManager,
      resources,
      state.acceptedQuestIds,
      state.completedQuestIds,
      state.objectiveIndexByQuestId,
      state.objectiveProgressByQuestId,
    ]);

    useEffect(() => {
      const quest = questById(state.activeQuestId);
      syncSnapshotGroveQuestMarkers(
        mapManager,
        quest,
        state.activeObjectiveIndex
      );
    }, [
      mapManager,
      state.activeObjectiveIndex,
      state.activeQuestId,
      state.objectiveProgressByQuestId,
    ]);

    // SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
    // Broadcast the bottom-bar nav labels that should pulse for the current
    // tutorial step. Empty array means "no highlight". The HUD listens via
    // useTutorHighlightedNavLabels and decorates each NavSlot accordingly.
    useEffect(() => {
      const quest = questById(state.activeQuestId);
      if (!quest || state.completedQuestIds.includes(quest.id)) {
        broadcastSnapshotGroveTutorHudLabels([]);
        return;
      }
      const trigger = currentTriggerForQuest(quest, state.activeObjectiveIndex);
      const objective = quest.objectives[state.activeObjectiveIndex];
      const chips = groveHudHighlightsForTrigger(trigger, objective);
      const labels = snapshotGroveTutorNavLabelsForObjectiveForTest(
        trigger,
        objective
      );
      broadcastSnapshotGroveTutorHudLabels(labels, chips);
    }, [
      state.activeObjectiveIndex,
      state.activeQuestId,
      state.completedQuestIds,
    ]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const win = window as typeof window & {
        __snapshotGrove?: unknown;
      };
      win.__snapshotGrove = {
        version: SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION,
        quests: SNAPSHOT_GROVE_QUESTS,
        npcs: SNAPSHOT_GROVE_NPCS,
        landmarks: SNAPSHOT_GROVE_LANDMARKS,
        readState: readSnapshotGroveQuestState,
        selectQuest: selectSnapshotGroveQuest,
        reset: () => {
          harthmereLocalStorage.removeItem(SNAPSHOT_GROVE_QUEST_STATE_KEY);
          harthmereLocalStorage.removeItem(SNAPSHOT_GROVE_LIKEABILITY_KEY);
          window.dispatchEvent(
            new CustomEvent(SNAPSHOT_GROVE_QUEST_STATE_EVENT)
          );
        },
        dumpGrounding: () =>
          SNAPSHOT_GROVE_NPCS.map((npc) => {
            const livePosition = snapshotGroveGroundedPosition(
              npc.authoredPosition
            );
            return {
              id: npc.id,
              name: npc.displayName,
              seededEntityId: npc.seedServerNpc
                ? snapshotGroveNpcEntityId(npc)
                : JACKIE_ID,
              authoredPosition: npc.authoredPosition,
              livePosition,
              grounded: livePosition[1] === SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
            };
          }),
      };
    }, []);

    return null;
  };

const SnapshotGroveMapHUDWithClientContext: React.FunctionComponent<{
  clientContext: ReturnType<typeof useClientContext>;
}> = ({ clientContext }) => {
  const { gardenHose, reactResources, mapManager } = clientContext;
  const localPlayer = reactResources.use("/scene/local_player");
  const state = useSnapshotGroveQuestState();
  const activeQuest = questById(state.activeQuestId);
  const nextFountainLesson = SNAPSHOT_GROVE_QUESTS.find(
    (item) =>
      SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(item.id) &&
      !state.completedQuestIds.includes(item.id)
  );
  const quest =
    activeQuest ??
    nextFountainLesson ??
    SNAPSHOT_GROVE_QUESTS.find(
      (item) => !state.completedQuestIds.includes(item.id)
    );
  if (!quest) {
    return null;
  }
  const objectiveIndex = snapshotGroveObjectiveIndexForQuest(state, quest.id);
  const completedCount = snapshotGroveObjectiveCompletedCountForQuest(
    state,
    quest.id,
    objectiveIndex
  );
  const marker = currentMarkerForQuest(quest, objectiveIndex, completedCount);
  const playerPos = localPlayer.player.position as Vec3;
  const distance = marker
    ? Math.round(
        Math.hypot(
          marker.position[0] - playerPos[0],
          marker.position[2] - playerPos[2]
        )
      )
    : undefined;
  if (!activeQuest && distance !== undefined && distance > 360) {
    return null;
  }
  const status = state.completedQuestIds.includes(quest.id)
    ? "Completed"
    : state.acceptedQuestIds.includes(quest.id)
      ? "In progress"
      : "Available";
  const step = groveQuestStepCopy(quest, objectiveIndex, completedCount);
  const currentTrigger = currentTriggerForQuest(quest, objectiveIndex);
  const currentObjective =
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ];
  const highlightedHudItems = groveHudHighlightsForTrigger(
    currentTrigger,
    currentObjective
  );
  const showPracticeButton =
    state.acceptedQuestIds.includes(quest.id) &&
    needsSnapshotGroveContextualPracticeButton(currentTrigger);
  const practiceIsInRange = !marker || distance === undefined || distance <= 10;
  const giver = SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.id === snapshotGroveQuestGiverId(quest)
  );
  const isFountainLesson = SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(
    quest.id
  );
  return (
    <div className="rounded-2xl border-lime-100/25 w-full max-w-sm border bg-black/70 p-3 text-white shadow-2xl backdrop-blur-md sm:max-w-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-lime-100/80 text-[10px] font-bold uppercase tracking-[0.22em]">
            {isFountainLesson ? "Fountain lesson" : "The Grove"}
          </div>
          <div className="truncate text-sm font-bold text-white">
            {quest.title}
          </div>
          <div className="text-[11px] text-white/60">
            {status}
            {giver ? ` · ${giver.displayName}` : ""}
          </div>
        </div>
        {distance !== undefined && (
          <div className="bg-lime-300/20 py-0.5 text-lime-100 shrink-0 rounded-full px-2 text-xs font-semibold">
            {distance}m
          </div>
        )}
      </div>
      {state.acceptedQuestIds.includes(quest.id) &&
        quest.objectives.length > 1 && (
          <div
            className="mt-2 flex flex-wrap gap-1"
            aria-label="Lesson step progress"
          >
            {quest.objectives.map((_objective, stepIndex) => {
              const isActive = stepIndex === objectiveIndex;
              const isDone = stepIndex < objectiveIndex;
              return (
                <span
                  key={stepIndex}
                  className={
                    isActive
                      ? "h-1.5 bg-lime-300 flex-1 rounded-full shadow-[0_0_6px_rgba(190,242,100,0.7)]"
                      : isDone
                        ? "h-1.5 bg-lime-300/60 flex-1 rounded-full"
                        : "h-1.5 bg-white/15 flex-1 rounded-full"
                  }
                  title={`Step ${stepIndex + 1} of ${quest.objectives.length}`}
                />
              );
            })}
          </div>
        )}
      <div className="rounded-xl text-white/88 mt-2 border border-white/10 bg-white/5 p-2 text-xs leading-snug">
        {state.acceptedQuestIds.includes(quest.id) ? step.progress : quest.hook}
      </div>
      {state.acceptedQuestIds.includes(quest.id) && (
        <div className="text-white/65 mt-2 space-y-1 text-[11px] leading-snug">
          <div>{step.target}</div>
          <div>{step.hudHint}</div>
        </div>
      )}
      {state.acceptedQuestIds.includes(quest.id) && (
        <div className="rounded-xl bg-black/35 mt-2 border border-white/10 p-2 text-[10px] leading-snug text-white/70">
          <div className="text-lime-100/75 mb-1 font-bold uppercase tracking-[0.18em]">
            All marked stops
          </div>
          <div className="space-y-1">
            {snapshotGroveQuestStepMarkerIds(quest).map(
              (markerId, stepIndex) => {
                const stepMarker = snapshotGroveLandmarkById(markerId);
                const isActiveStep = stepIndex === objectiveIndex;
                const isPastStep = stepIndex < objectiveIndex;
                return (
                  <button
                    key={`${quest.id}-${stepIndex}-${markerId}`}
                    type="button"
                    className={
                      isActiveStep
                        ? "border-lime-200/55 bg-lime-300/15 text-lime-50 flex w-full items-center justify-between rounded-md border px-2 py-1 text-left shadow-[0_0_10px_rgba(190,242,100,0.18)]"
                        : "text-white/65 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-left hover:bg-white/[0.08]"
                    }
                    onClick={() => {
                      if (stepMarker) {
                        pinSnapshotGroveLandmark(
                          mapManager,
                          stepMarker,
                          snapshotGroveStepNavAidId(stepIndex)
                        );
                      }
                    }}
                  >
                    <span>
                      {stepIndex + 1}. {stepMarker?.label ?? markerId}
                    </span>
                    <span
                      className={
                        isActiveStep
                          ? "text-lime-100 font-bold"
                          : "text-white/45"
                      }
                    >
                      {isActiveStep ? "NOW" : isPastStep ? "DONE" : "NEXT"}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
      <div className="text-white/55 mt-2 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide">
        {[
          ...new Set([
            "MAP",
            "JOURNAL",
            "INTERACT",
            "BAG",
            "HOTBAR",
            "CRAFT",
            ...highlightedHudItems,
          ]),
        ].map((item) => {
          const active = highlightedHudItems.includes(item);
          return (
            <span
              key={item}
              className={
                active
                  ? "rounded border-lime-100/60 bg-lime-300/30 px-1.5 py-0.5 text-lime-50 shadow-lime-200/20 animate-pulse border shadow"
                  : "rounded px-1.5 py-0.5 bg-white/10"
              }
            >
              {item}
            </span>
          );
        })}
      </div>
      {state.acceptedQuestIds.includes(quest.id) &&
        highlightedHudItems.length > 0 && (
          <div className="rounded-lg border-lime-200/25 bg-lime-300/10 text-lime-50 mt-2 border px-2 py-1 text-[11px] font-semibold">
            {`The glowing ${highlightedHudItems.join(" / ")} ${
              highlightedHudItems.length === 1 ? "panel is" : "panels are"
            } what to open next.`}
          </div>
        )}
      {showPracticeButton &&
        snapshotGrovePracticeItemForObjective(quest, objectiveIndex) && (
          <div className="rounded-lg border-sky-200/25 bg-sky-300/10 text-sky-50 mt-2 border px-2 py-1 text-[11px] font-semibold">
            {`Marked pickup: ${
              snapshotGrovePracticeItemForObjective(quest, objectiveIndex)
                ?.label
            }. It is counted in your bag/material storage when you pick it up.`}
          </div>
        )}
      {showPracticeButton && (
        <button
          className={
            practiceIsInRange
              ? "rounded-lg bg-lime-300/25 text-lime-50 hover:bg-lime-300/35 mt-2 animate-pulse px-2.5 py-1 text-[11px] font-bold"
              : "rounded-lg text-white/45 mt-2 bg-white/10 px-2.5 py-1 text-[11px] font-bold"
          }
          disabled={!practiceIsInRange}
          onClick={() => {
            if (!practiceIsInRange || !currentTrigger) {
              return;
            }
            const grantedPracticeItem = grantSnapshotGrovePracticeItem(
              quest,
              objectiveIndex,
              currentTrigger
            );
            gardenHose.publish({
              kind: "snapshot_grove_practice_action",
              questId: quest.id,
              objectiveIndex,
              trigger: currentTrigger,
              markerId: marker?.id,
              grantedPracticeItem,
            });
          }}
        >
          {practiceIsInRange
            ? snapshotGrovePracticeButtonLabel(currentTrigger)
            : `Walk to ${marker?.label ?? "the marker"} first`}
        </button>
      )}
      {marker && (
        <button
          className="rounded-lg bg-lime-300/20 text-lime-100 hover:bg-lime-300/30 mt-2 px-2.5 py-1 text-[11px] font-bold"
          onClick={() =>
            pinSnapshotGroveLandmark(
              mapManager,
              marker,
              snapshotGroveStepNavAidId(objectiveIndex)
            )
          }
        >
          Pin {marker.label}
        </button>
      )}
    </div>
  );
};

export const SnapshotGroveMapHUD: React.FunctionComponent<{}> = () => {
  // BiomesUI is also rendered by isolated server/component tests where the
  // game client provider is intentionally absent. Keep the contextual Grove
  // HUD dormant in that environment while preserving a stable hook tree for
  // the live, provider-backed implementation.
  const clientContext = useClientContext() as ReturnType<
    typeof useClientContext
  > | null;
  return clientContext ? (
    <SnapshotGroveMapHUDWithClientContext clientContext={clientContext} />
  ) : null;
};

export const SnapshotGroveJournalPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotGroveQuestState();
  const activeQuest = questById(state.activeQuestId);
  // Completed lessons leave the learning journal instead of lingering as
  // actionable rows; completion history remains in synchronized quest state.
  const visibleQuest = (quest: SnapshotGroveQuest) =>
    !state.completedQuestIds.includes(quest.id);
  const fountainLessons = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) =>
      SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(quest.id) &&
      visibleQuest(quest)
  );
  const roadGraduation = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) => quest.category === "road_graduation" && visibleQuest(quest)
  );
  const roadNeighbors = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) => quest.category === "road_neighbor" && visibleQuest(quest)
  );
  const roadStories = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) =>
      !SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(quest.id) &&
      quest.category !== "road_graduation" &&
      quest.category !== "road_neighbor" &&
      visibleQuest(quest)
  );
  const fountainCompletedCount = countCompletedFountainLessons(state);
  const renderQuestRow = (quest: SnapshotGroveQuest) => {
    const isUnlocked = isSnapshotGroveQuestUnlocked(quest, state);
    const status = state.completedQuestIds.includes(quest.id)
      ? "done"
      : state.acceptedQuestIds.includes(quest.id)
        ? "active"
        : isUnlocked
          ? "open"
          : "soon";
    const giver = SNAPSHOT_GROVE_NPCS.find(
      (npc) => npc.id === snapshotGroveQuestGiverId(quest)
    );
    const lockHint =
      !isUnlocked && quest.unlockedBy
        ? quest.unlockedBy.kind === "fountain_completion_count"
          ? `Unlocks after ${quest.unlockedBy.minCompletedFountainLessons} fountain lessons (${fountainCompletedCount}/${quest.unlockedBy.minCompletedFountainLessons}).`
          : quest.unlockedBy.kind === "quest_accepted"
            ? `Unlocks once you accept ${
                SNAPSHOT_GROVE_QUESTS.find(
                  (q) => q.id === (quest.unlockedBy as any).questId
                )?.title ?? "the prerequisite lesson"
              }.`
            : `Unlocks once you finish ${
                SNAPSHOT_GROVE_QUESTS.find(
                  (q) => q.id === (quest.unlockedBy as any).questId
                )?.title ?? "the prerequisite lesson"
              }.`
        : undefined;
    return (
      <div
        key={quest.id}
        className={
          isUnlocked
            ? "rounded-xl py-1.5 border border-white/10 bg-black/25 px-2"
            : "rounded-xl bg-black/15 py-1.5 opacity-65 border border-white/5 px-2"
        }
      >
        <div className="flex justify-between gap-2">
          <span className="font-semibold text-white/90">{quest.title}</span>
          <span className="text-white/45 uppercase">{status}</span>
        </div>
        <div className="mt-0.5 text-white/55 text-[10px]">
          {giver ? `${giver.displayName} · ` : ""}
          {quest.area}
        </div>
        {lockHint && (
          <div className="mt-0.5 text-white/45 text-[10px] italic">
            {lockHint}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="rounded-2xl border-lime-200/20 bg-lime-950/25 border p-3">
      <div className="text-sm font-semibold text-white">
        Grove Learning Journal
      </div>
      <div className="mt-1 text-xs leading-snug text-white/70">
        The fountain lessons cover the basics — the HUD, your map pins, your
        bag, safe gathering, sparring rules, party readiness, mail and storage,
        and a clean recovery. Once a handful are done, Jackie sends you out to
        meet the road neighbors.
      </div>
      {activeQuest ? (
        <div className="rounded-xl mt-2 bg-black/25 p-2 text-xs leading-snug text-white/80">
          <div className="text-lime-100 font-semibold">
            Active: {activeQuest.title}
          </div>
          <div>
            {
              groveQuestStepCopy(
                activeQuest,
                state.activeObjectiveIndex,
                snapshotGroveObjectiveCompletedCountForQuest(
                  state,
                  activeQuest.id,
                  state.activeObjectiveIndex
                )
              ).progress
            }
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            {
              groveQuestStepCopy(
                activeQuest,
                state.activeObjectiveIndex,
                snapshotGroveObjectiveCompletedCountForQuest(
                  state,
                  activeQuest.id,
                  state.activeObjectiveIndex
                )
              ).target
            }
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Reward: {activeQuest.reward}
          </div>
        </div>
      ) : (
        <div className="rounded-xl mt-2 bg-black/20 p-2 text-xs leading-snug text-white/70">
          Find Jackie, Taye, Rosalyn, or Nia near the fountain to pick up a
          lesson. Each one drops a pin on the map for every stop so the route
          stays clear.
        </div>
      )}
      <div className="text-lime-100/75 mt-3 text-[10px] font-bold uppercase tracking-[0.18em]">
        Fountain lessons
      </div>
      <div className="mt-1 grid gap-1 text-[11px] leading-snug">
        {fountainLessons.map(renderQuestRow)}
      </div>
      {!!roadGraduation.length && (
        <>
          <div className="text-lime-100/75 mt-3 text-[10px] font-bold uppercase tracking-[0.18em]">
            Road tour
          </div>
          <div className="mt-1 grid gap-1 text-[11px] leading-snug">
            {roadGraduation.map(renderQuestRow)}
          </div>
        </>
      )}
      {!!roadNeighbors.length && (
        <>
          <div className="text-lime-100/75 mt-3 text-[10px] font-bold uppercase tracking-[0.18em]">
            Road neighbors
          </div>
          <div className="mt-1 grid gap-1 text-[11px] leading-snug">
            {roadNeighbors.map(renderQuestRow)}
          </div>
        </>
      )}
      <div className="text-lime-100/75 mt-3 text-[10px] font-bold uppercase tracking-[0.18em]">
        Road stories
      </div>
      <div className="mt-1 grid gap-1 text-[11px] leading-snug">
        {roadStories.map(renderQuestRow)}
      </div>
      {!!state.rewards.length && (
        <div className="text-white/55 mt-2 text-[11px]">
          Latest reward: {state.rewards[state.rewards.length - 1]}
        </div>
      )}
    </div>
  );
};

// SNAPSHOT_GROVE_TUTOR_CHAT_PANEL:
// Lightweight in-game chat compose panel with four channel tabs (Say,
// Whisper, Party, Trade). Opens via openSnapshotGroveTutorChatPanel(),
// which the new Chat NavSlot button in HarthmereUnifiedHUD calls. When the
// panel opens, it publishes an open_tab GardenHose event with tab="chat",
// which the "Open the chat panel from the HUD" objective of the
// fountain_chat_channels lesson is gated on. Harthmere world chat current sends
// these messages through the real ChatIo backend while still firing the
// tutorial practice event, so the panel is no longer a fake local-only chat.

const SNAPSHOT_GROVE_TUTOR_CHAT_OPEN_EVENT =
  "biomes:snapshot-grove-tutor-chat-panel-open";

export function openSnapshotGroveTutorChatPanel() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(SNAPSHOT_GROVE_TUTOR_CHAT_OPEN_EVENT));
  } catch {
    // No-op in non-browser test contexts.
  }
}

type SnapshotGroveTutorChatChannel = "say" | "whisper" | "party" | "trade";

const SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS: Array<{
  id: SnapshotGroveTutorChatChannel;
  label: string;
  blurb: string;
  placeholder: string;
}> = [
  {
    id: "say",
    label: "Say",
    blurb:
      "Say reaches anyone standing in the same room. Use it for the fountain crowd or the people right next to you.",
    placeholder: "Say something to the fountain crowd…",
  },
  {
    id: "whisper",
    label: "Whisper",
    blurb:
      "Whisper goes to one ear only. Pick this when the message is for a single person and nobody else needs to overhear.",
    placeholder: "Whisper to one person…",
  },
  {
    id: "party",
    label: "Party",
    blurb:
      "Party reaches everyone you have grouped with. Use it for road plans and quiet coordination on the move.",
    placeholder: "Tell the party…",
  },
  {
    id: "trade",
    label: "Trade",
    blurb:
      "Trade chat is for buying and selling notices. Keep it short, name your price, and stay out of Say.",
    placeholder: "Post a trade notice…",
  },
];

export const SnapshotGroveTutorChatPanel: React.FunctionComponent<{}> = () => {
  const { chatIo, gardenHose, mailman, reactResources, resources } =
    useClientContext();
  const state = useSnapshotGroveQuestState();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<SnapshotGroveTutorChatChannel>("say");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const openHandler = () => {
      setOpen(true);
    };
    window.addEventListener(SNAPSHOT_GROVE_TUTOR_CHAT_OPEN_EVENT, openHandler);
    return () =>
      window.removeEventListener(
        SNAPSHOT_GROVE_TUTOR_CHAT_OPEN_EVENT,
        openHandler
      );
  }, []);

  // When the panel opens, fire an open_tab GardenHose event so the chat
  // lesson's "Open the chat panel from the HUD" step can advance. Using
  // gardenHose.publish keeps this on the same event bus the runtime's quest
  // matcher already listens to.
  useEffect(() => {
    if (!open) return;
    try {
      (gardenHose as any).publish({ kind: "open_tab", tab: "chat" });
    } catch {
      // Best-effort: the panel still works if publish is unavailable.
    }
  }, [open, gardenHose]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const activeChannel = SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS.find(
    (c) => c.id === channel
  )!;

  const onSend = () => {
    const content = draft.trim();
    if (!content) return;

    const localPlayer = reactResources.get("/scene/local_player");
    const position = localPlayer?.player.position;
    if (channel === "party") {
      const teamId = localPlayer
        ? resources.get("/ecs/c/player_current_team", localPlayer.id)?.team_id
        : undefined;
      if (teamId) {
        void chatIo.sendMessage("chat", { kind: "text", content }, teamId);
      } else {
        mailman.showChatError("You are not in a party yet.");
      }
    } else {
      const volume =
        channel === "trade" ? "yell" : channel === "say" ? "chat" : "whisper";
      const liveContent = channel === "trade" ? `[Trade] ${content}` : content;
      void chatIo.sendMessage(
        volume,
        { kind: "text", content: liveContent },
        undefined,
        position
      );
    }

    const quest = questById(state.activeQuestId);
    if (quest && !state.completedQuestIds.includes(quest.id)) {
      const trigger = currentTriggerForQuest(quest, state.activeObjectiveIndex);
      const marker = currentMarkerForQuest(quest, state.activeObjectiveIndex);
      try {
        (gardenHose as any).publish({
          kind: "snapshot_grove_practice_action",
          questId: quest.id,
          objectiveIndex: state.activeObjectiveIndex,
          trigger,
          markerId: marker?.id,
          practiceAction: `chat_${channel}`,
        });
      } catch {
        // Best-effort.
      }
    }
    setDraft("");
  };

  return (
    <div
      className="rounded-2xl border-amber-200/30 bg-stone-950/95 pointer-events-auto fixed inset-x-2 bottom-[12rem] z-40 mx-auto max-w-md border p-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md sm:bottom-[12.5rem] md:max-w-lg"
      role="dialog"
      aria-label="Tutorial chat panel"
      data-snapshot-grove-tutor-chat-panel="open"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-amber-200/80 text-xs font-bold uppercase tracking-wide">
            Fountain chat
          </div>
          <div className="text-sm font-semibold text-white">
            Pick the right ear before you speak.
          </div>
        </div>
        <button
          className="border-white/15 rounded-full border bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <div
        className="mt-2 flex gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Chat channel"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const idx = SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS.findIndex(
            (c) => c.id === channel
          );
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const next =
            (idx + delta + SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS.length) %
            SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS.length;
          setChannel(SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS[next].id);
          e.preventDefault();
        }}
      >
        {SNAPSHOT_GROVE_TUTOR_CHAT_CHANNELS.map((c) => {
          const active = c.id === channel;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={
                active
                  ? "rounded-lg border-amber-300/80 bg-amber-300/15 text-amber-100 shrink-0 border px-3 py-1 text-xs font-semibold"
                  : "rounded-lg shrink-0 border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
              }
              onClick={() => setChannel(c.id)}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-xl bg-black/35 mt-2 p-2 text-[12px] leading-snug text-white/80">
        {activeChannel.blurb}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="rounded-lg border-white/15 bg-black/55 focus:border-amber-200/80 min-w-0 flex-1 border px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
          placeholder={activeChannel.placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          aria-label={`Compose ${activeChannel.label} message`}
        />
        <button
          className="rounded-lg border-amber-300/80 bg-amber-300/20 text-amber-100 hover:bg-amber-300/30 border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={onSend}
          disabled={!draft.trim()}
        >
          Send
        </button>
      </div>
      <div className="text-white/45 mt-2 text-[10px] uppercase tracking-wide">
        Live channel · Say and Whisper show as world speech near you, Party goes
        to your team, and Trade yells with a trade prefix.
      </div>
    </div>
  );
};
