import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  grantHarthmereItem,
  grantHarthmereTutorialInventoryItem,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HARTHMERE_INVENTORY_EVENT } from "@/client/components/challenges/harthmereEvents";
import {
  HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
  type HarthmereWorldObjectInteractionEventDetail,
} from "@/client/components/challenges/harthmereObjectInteractions";
import { addToast } from "@/client/components/toast/helpers";
import type { GardenHoseEvent } from "@/client/events/api";
import { JACKIE_ID } from "@/client/util/nux/state_machines";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION,
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveGroundedPosition,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
  snapshotGroveNpcIdFromEntityId,
  type SnapshotGroveNpc,
  type SnapshotGroveQuest,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT,
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET,
  snapshotGroveItemUseEventMatchesObjective,
  snapshotGroveTutorialInventoryGrantsForQuest,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION =
  "snapshot-grove-mission-critical snapshot-grove-mission-critical snapshot-grove-bible-graduation-chain";

export const SNAPSHOT_GROVE_QUEST_STATE_KEY =
  "biomes.localDev.snapshotGroveQuestState";

export const SNAPSHOT_GROVE_QUEST_STATE_EVENT =
  "biomes:local-dev-snapshot-grove-quest-state";

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

const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS = [
  "fountain_buttons_first",
  "painted_path_language",
  "road_ready_bag_check",
  "tools_before_treasure",
  "safe_sparring_not_pvp",
  "ready_check_at_fountain",
  "lost_found_and_mail",
  "fountain_chat_channels",
  "fountain_food_keeps_you_moving",
  "fountain_first_aid_before_road",
  "fountain_hotbar_and_dropping",
  "fountain_first_recipe_torch",
  "fountain_trade_table_promises",
] as const;

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

interface SnapshotGroveQuestState {
  acceptedQuestIds: string[];
  activeQuestId?: string;
  activeObjectiveIndex: number;
  completedQuestIds: string[];
  completedObjectiveIds: string[];
  rewards: string[];
  updatedAt?: number;
}

const EMPTY_SNAPSHOT_GROVE_QUEST_STATE: SnapshotGroveQuestState = {
  acceptedQuestIds: [],
  activeObjectiveIndex: 0,
  completedQuestIds: [],
  completedObjectiveIds: [],
  rewards: [],
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeSnapshotGroveQuestState(
  parsed: Partial<SnapshotGroveQuestState> | undefined
): SnapshotGroveQuestState {
  const acceptedQuestIds = dedupeKnownSnapshotGroveQuestIds(
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
  const activeQuestId =
    requestedActiveQuestId && !completedSet.has(requestedActiveQuestId)
      ? requestedActiveQuestId
      : acceptedQuestIds.find((questId) => !completedSet.has(questId));
  const activeQuest = questById(activeQuestId);
  const rawObjectiveIndex = Number.isFinite(parsed?.activeObjectiveIndex)
    ? Math.max(0, Number(parsed?.activeObjectiveIndex))
    : 0;
  const activeObjectiveIndex = activeQuest
    ? Math.min(
        Math.max(0, activeQuest.objectives.length - 1),
        rawObjectiveIndex
      )
    : 0;

  return {
    acceptedQuestIds,
    activeQuestId,
    activeObjectiveIndex,
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
        window.localStorage.getItem(SNAPSHOT_GROVE_QUEST_STATE_KEY) || "null"
      ) || undefined
    );
  } catch {
    return { ...EMPTY_SNAPSHOT_GROVE_QUEST_STATE };
  }
}

function writeSnapshotGroveQuestState(state: SnapshotGroveQuestState) {
  if (!isBrowser()) {
    return;
  }
  const next = { ...state, updatedAt: Date.now() };
  window.localStorage.setItem(
    SNAPSHOT_GROVE_QUEST_STATE_KEY,
    JSON.stringify(next)
  );
  window.dispatchEvent(new CustomEvent(SNAPSHOT_GROVE_QUEST_STATE_EVENT));
}

function readSnapshotGroveLikeability(): Record<string, number> {
  if (!isBrowser()) {
    return {};
  }
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SNAPSHOT_GROVE_LIKEABILITY_KEY) || "{}"
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
  window.localStorage.setItem(
    SNAPSHOT_GROVE_LIKEABILITY_KEY,
    JSON.stringify(current)
  );
}

function questById(id: string | undefined) {
  return SNAPSHOT_GROVE_QUESTS.find((quest) => quest.id === id);
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

export function isSnapshotGroveQuestUnlocked(
  quest: SnapshotGroveQuest,
  state: SnapshotGroveQuestState
): boolean {
  const prerequisite = quest.unlockedBy;
  if (!prerequisite) {
    return true;
  }
  switch (prerequisite.kind) {
    case "fountain_completion_count":
      return (
        countCompletedFountainLessons(state) >=
        prerequisite.minCompletedFountainLessons
      );
    case "quest_accepted":
      return (
        state.acceptedQuestIds.includes(prerequisite.questId) ||
        state.completedQuestIds.includes(prerequisite.questId)
      );
    case "quest_completed":
      return state.completedQuestIds.includes(prerequisite.questId);
    default:
      return true;
  }
}

function snapshotGroveQuestCategoryRank(quest: SnapshotGroveQuest): number {
  // Lower number = earlier in the offer list.
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
  return SNAPSHOT_GROVE_QUESTS.filter(
    (quest) =>
      quest.giverNpcId === npcId &&
      !state.completedQuestIds.includes(quest.id) &&
      !state.acceptedQuestIds.includes(quest.id) &&
      isSnapshotGroveQuestUnlocked(quest, state)
  ).sort(
    (a, b) =>
      snapshotGroveQuestCategoryRank(a) - snapshotGroveQuestCategoryRank(b)
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
  if (active?.giverNpcId === npcId) {
    return active;
  }
  return SNAPSHOT_GROVE_QUESTS.find(
    (quest) =>
      quest.giverNpcId === npcId &&
      state.acceptedQuestIds.includes(quest.id) &&
      !state.completedQuestIds.includes(quest.id)
  );
}

function currentMarkerForQuest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  if (!quest.markerIds.length) {
    return undefined;
  }
  const clamped = Math.max(
    0,
    Math.min(quest.markerIds.length - 1, objectiveIndex)
  );
  return (
    snapshotGroveLandmarkById(quest.markerIds[clamped]) ??
    snapshotGroveLandmarkById(quest.markerIds[0])
  );
}

function pinSnapshotGroveLandmark(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  position: Vec3,
  navAidId: number = snapshotGroveStepNavAidId(0),
  autoremoveWhenNear = false
) {
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

// SNAPSHOT_GROVE_QUEST_MARKER_VISIBILITY:
// Pin every step marker for the active quest so the player sees the whole
// lesson path. The active step's marker is added last so it sits on top of
// any visually overlapping pins. Past-step markers are removed by upstream
// logic when steps complete (see syncSnapshotGroveQuestMarkers).
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
  const totalSteps = Math.min(
    quest.markerIds.length,
    SNAPSHOT_GROVE_NAV_AID_MAX_STEPS
  );
  const safeActiveIndex = Math.max(
    0,
    Math.min(totalSteps - 1, activeObjectiveIndex)
  );
  // Pin upcoming/future steps first, then the active step last (so the
  // active marker draws on top when stacked).
  for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
    if (stepIndex < safeActiveIndex) {
      continue; // past steps are not re-pinned
    }
    if (stepIndex === safeActiveIndex) {
      continue;
    }
    const marker = snapshotGroveLandmarkById(quest.markerIds[stepIndex]);
    if (!marker) {
      continue;
    }
    pinSnapshotGroveLandmark(
      mapManager,
      marker.position,
      snapshotGroveStepNavAidId(stepIndex)
    );
  }
  const activeMarker = snapshotGroveLandmarkById(
    quest.markerIds[safeActiveIndex]
  );
  if (activeMarker) {
    pinSnapshotGroveLandmark(
      mapManager,
      activeMarker.position,
      snapshotGroveStepNavAidId(safeActiveIndex),
      true
    );
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

function acceptSnapshotGroveQuest(
  quest: SnapshotGroveQuest,
  mapManager: any,
  resources?: ReturnType<typeof useClientContext>["resources"]
) {
  const state = readSnapshotGroveQuestState();
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
  const next: SnapshotGroveQuestState = {
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: quest.id,
    activeObjectiveIndex: initialObjectiveIndex,
    completedObjectiveIds: shouldSkipFirstStep
      ? [
          ...new Set([
            ...state.completedObjectiveIds,
            `${quest.id}:0:talked_to_giver`,
          ]),
        ]
      : state.completedObjectiveIds,
  };
  if (isFreshAcceptance) {
    grantSnapshotGroveAcceptedTutorialItems(quest);
  }
  writeSnapshotGroveQuestState(next);
  syncSnapshotGroveQuestMarkers(mapManager, quest, initialObjectiveIndex);
  addSnapshotGroveObjectiveToast(resources, quest, initialObjectiveIndex);
}

function advanceSnapshotGroveQuest(
  quest: SnapshotGroveQuest,
  mapManager: any,
  reason: string,
  resources?: ReturnType<typeof useClientContext>["resources"]
) {
  const state = readSnapshotGroveQuestState();
  if (state.completedQuestIds.includes(quest.id) || !quest.objectives.length) {
    return;
  }
  const safeObjectiveIndex = Math.max(
    0,
    Math.min(
      quest.objectives.length - 1,
      state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0
    )
  );
  const objectiveId = `${quest.id}:${safeObjectiveIndex}:${reason}`;
  const nextIndex = safeObjectiveIndex + 1;
  const completedQuest = nextIndex >= quest.objectives.length;
  const next: SnapshotGroveQuestState = {
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: completedQuest ? undefined : quest.id,
    activeObjectiveIndex: completedQuest ? 0 : nextIndex,
    completedObjectiveIds: [
      ...new Set([...state.completedObjectiveIds, objectiveId]),
    ],
    completedQuestIds: completedQuest
      ? [...new Set([...state.completedQuestIds, quest.id])]
      : state.completedQuestIds,
    rewards: completedQuest
      ? [...new Set([...state.rewards, `${quest.title}: ${quest.reward}`])]
      : state.rewards,
  };
  writeSnapshotGroveQuestState(next);
  if (completedQuest) {
    clearAllSnapshotGroveQuestMarkers(mapManager);
    recordSnapshotGroveLikeability(quest.giverNpcId, 1);
  } else {
    // Remove the marker for the step we just completed so past pins do not
    // clutter the map, and refresh the remaining future + active markers.
    mapManager.removeNavigationAid?.(
      snapshotGroveStepNavAidId(safeObjectiveIndex)
    );
    syncSnapshotGroveQuestMarkers(mapManager, quest, nextIndex);
    addSnapshotGroveObjectiveToast(resources, quest, nextIndex);
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

const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS =
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET;

function snapshotGroveNpcIdFromTalkEvent(event: GardenHoseEvent) {
  if ((event as any).kind !== "talk_npc") {
    return undefined;
  }
  const npcId = (event as any).npcId as BiomesId | undefined;
  if (npcId === JACKIE_ID) {
    return "jackie";
  }
  return npcId ? snapshotGroveNpcIdFromEntityId(npcId) : undefined;
}

function expectedOpenTabForObjective(objective: string | undefined) {
  const text = (objective ?? "").toLowerCase();
  if (text.includes("map") || text.includes("marker")) {
    return "map";
  }
  if (
    text.includes("inventory") ||
    text.includes("bag") ||
    text.includes("clothing") ||
    text.includes("hotbar")
  ) {
    return "inventory";
  }
  if (text.includes("recipe") || text.includes("craft")) {
    return "crafting";
  }
  if (
    text.includes("mail") ||
    text.includes("storage") ||
    text.includes("recovery")
  ) {
    return "inbox";
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
    return "chat";
  }
  if (text.includes("journal")) {
    return "journal";
  }
  if (text.includes("quest")) {
    return "quests";
  }
  if (
    text.includes("guild") ||
    text.includes("party") ||
    text.includes("combat")
  ) {
    return "tasks";
  }
  return undefined;
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
  objectiveIndex: number
): GardenHoseEvent | undefined {
  const trigger = currentTriggerForQuest(quest, objectiveIndex);
  const marker = currentMarkerForQuest(quest, objectiveIndex);
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
        return { ...base, kind: "inventory_change" } as any;
      }
      return undefined;
    case "craft":
      if (kind === "craft") {
        return { ...base, kind: "craft" } as any;
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
  const text = snapshotGroveObjectiveText(quest, objectiveIndex).toLowerCase();
  if (
    /clean root|mucked root|root sample|muck sample|sealed muck|mudroot/.test(
      text
    )
  ) {
    return {
      itemId: "mudroot",
      quantity: 1,
      label: /mucked|muck|sealed/.test(text)
        ? "Mucked Root Sample"
        : "Clean Root Sample",
    };
  }
  if (/mushrooms?|fungus|spore|cap/.test(text)) {
    return {
      itemId: "forest_mushroom",
      quantity: 1,
      label: "Forage Mushroom",
    };
  }
  if (/grain|wheat|feed/.test(text)) {
    return { itemId: "field_wheat", quantity: 1, label: "Practice Grain" };
  }
  if (/bright berr|berries|berry/.test(text)) {
    return { itemId: "wild_berries", quantity: 1, label: "Bright Berries" };
  }
  if (/ration|food|snack|eat/.test(text)) {
    return { itemId: "road_ration", quantity: 1, label: "Road Ration" };
  }
  if (/bandage|first.?aid|scratch|wound|medicine|salve/.test(text)) {
    return {
      itemId: "minor_healing_salve",
      quantity: 1,
      label: "Practice Bandage",
    };
  }
  if (
    /wood scraps?|scrap wood|practice sticks?|sticks?|branches?|wheel|ingredients?|skewers?/.test(
      text
    )
  ) {
    return {
      itemId: "softwood_log",
      quantity: text.includes("three") || text.includes("3") ? 3 : 1,
      label: "Practice Wood",
    };
  }
  if (
    /stone|repair piece|block|road block|drop|dropped stack|stack back/.test(
      text
    )
  ) {
    return { itemId: "rough_stone", quantity: 1, label: "Practice Stone" };
  }
  if (/bolt|coil|metal|hinges?|part/.test(text)) {
    return { itemId: "scrap_metal", quantity: 1, label: "Road Bolt" };
  }
  if (/key/.test(text)) {
    return { itemId: "iron_key_blank", quantity: 1, label: "Practice Key" };
  }
  if (/camera|photo/.test(text)) {
    return { itemId: "old_coin", quantity: 1, label: "Camera Practice Token" };
  }
  if (/rubbings?|track rubbings?/.test(text)) {
    return {
      itemId: "cloth_scrap",
      quantity: text.includes("three") || text.includes("3") ? 3 : 1,
      label: "Track Rubbings",
    };
  }
  if (
    /cloth|trade slot|practice item|pail|parcel|packet|letter|slip|sack|basket|tray|order|recipe|tuning strip|strip/.test(
      text
    )
  ) {
    return {
      itemId: "cloth_scrap",
      quantity: 1,
      label: "Practice Trade Cloth",
    };
  }
  return undefined;
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
  trigger: string | undefined
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
  grantHarthmereItem(
    item.itemId,
    item.quantity,
    `${quest.title}: ${item.label}`
  );
  return item;
}

export function grantSnapshotGroveWorldObjectPickupItemForTest(
  quest: SnapshotGroveQuest,
  objectiveIndex: number,
  trigger: string | undefined
) {
  return withSnapshotGroveInventoryAdvanceSuppressed(() =>
    grantSnapshotGroveWorldObjectPickupItem(quest, objectiveIndex, trigger)
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

function broadcastSnapshotGroveTutorHudLabels(
  labels: string[],
  chips: string[] = []
) {
  if (typeof window === "undefined") return;
  try {
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
  if (
    !trigger ||
    !SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGERS.has(trigger as any)
  ) {
    return false;
  }
  const detail = event as any;
  if (detail.kind !== "snapshot_grove_practice_action") {
    return false;
  }
  const marker = currentMarkerForQuest(quest, objectiveIndex);
  return (
    detail.questId === quest.id &&
    detail.objectiveIndex === objectiveIndex &&
    detail.trigger === trigger &&
    (!marker?.id || !detail.markerId || detail.markerId === marker.id)
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

  const marker = currentMarkerForQuest(quest, objectiveIndex);
  const eventMarkerId =
    typeof detail.markerId === "string"
      ? detail.markerId
      : typeof detail.targetMarkerId === "string"
      ? detail.targetMarkerId
      : undefined;
  if (eventMarkerId && marker?.id && eventMarkerId !== marker.id) {
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
      const expectedNpcId = marker?.npcId ?? quest.giverNpcId;
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
        kind === "npc_damage" || kind === "npc_killed" || kind === "take_damage"
      );
    case "open_tab": {
      if (kind !== "open_tab") {
        return false;
      }
      const expectedTab = expectedOpenTabForObjective(objective);
      return !expectedTab || (event as any).tab === expectedTab;
    }
    case "interact":
      return (
        kind === "open_station" ||
        kind === "open_shop" ||
        kind === "inspect_frame" ||
        kind === "place_placeable" ||
        kind === "start_collide_placeable" ||
        kind === "start_collide_entity"
      );
    case "inventory_change":
      return (
        kind === "inventory_change" ||
        kind === "equip" ||
        kind === "local_inventory_selection_change" ||
        kind === "selection_change"
      );
    case "collect":
      return (
        kind === "inventory_change" ||
        kind === "destroy" ||
        kind === "inventory_overflow_item_received"
      );
    case "craft":
      return kind === "craft";
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
      return (
        kind === "equip" || kind === "place_voxel" || kind === "take_damage"
      );
    case "item_update":
      return (
        kind === "inventory_change" ||
        kind === "local_inventory_selection_change" ||
        kind === "selection_change"
      );
    case "status_check":
      return (
        kind === "open_tab" || kind === "equip" || kind === "inventory_change"
      );
    case "escort":
    case "carry":
      return kind === "move";
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

function groveQuestStepCopy(quest: SnapshotGroveQuest, objectiveIndex: number) {
  const clamped = Math.max(
    0,
    Math.min(quest.objectives.length - 1, objectiveIndex)
  );
  const marker = currentMarkerForQuest(quest, clamped);
  const trigger = currentTriggerForQuest(quest, clamped);
  const action = actionNameForTrigger(trigger);
  return {
    progress: `${clamped + 1}/${quest.objectives.length}: ${
      quest.objectives[clamped]
    }`,
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

function npcForEntity(
  entityId: BiomesId,
  labelText?: string,
  entityDescriptionText?: string,
  defaultDialog?: string
): SnapshotGroveNpc | undefined {
  if (entityId === JACKIE_ID) {
    return SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "jackie");
  }
  const seededId = snapshotGroveNpcIdFromEntityId(entityId);
  const labelMappedId = snapshotGroveNpcIdForDialogLabel({
    label: labelText,
    entityDescriptionText,
    defaultDialog,
  });
  return SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.id === (seededId ?? labelMappedId)
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
      name: "Why is my backpack limited?",
      tooltip: "Explains carry weight and why homes and shops matter.",
      followUpText:
        "A backpack is for travel, not hoarding. Heavy loads slow the town economy because everyone would carry a warehouse on their back. Store long-term goods in homes, shops, workshops, or managed vaults, then carry only what the road actually needs.",
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
    const availableQuests = availableQuestsForNpc(npc.id, state);
    const availableQuest = availableQuests[0];
    const quest = activeQuest ?? availableQuest;
    const objectiveIndex =
      quest?.id === state.activeQuestId ? state.activeObjectiveIndex : 0;
    const marker = quest
      ? currentMarkerForQuest(quest, objectiveIndex)
      : undefined;
    const actions: TalkDialogStepAction[] = [];

    if (!activeQuest && availableQuests.length) {
      for (const option of availableQuests.slice(0, 3)) {
        actions.push({
          name: `Start ${option.title}`,
          type: actions.length === 0 ? "primary" : "normal",
          tooltip: option.hook,
          onPerformed: () =>
            acceptSnapshotGroveQuest(option, mapManager, resources),
        });
      }
    } else if (quest && !state.completedQuestIds.includes(quest.id)) {
      // Active lesson steps are intentionally not completed from NPC dialogue.
      // The player must perform the marked world, inventory, movement, or HUD action.
    }

    if (marker) {
      actions.push({
        name: `Show ${marker.label} on the map`,
        type: "normal",
        tooltip: marker.label,
        onPerformed: () =>
          pinSnapshotGroveLandmark(
            mapManager,
            marker.position,
            snapshotGroveStepNavAidId(objectiveIndex)
          ),
      });
    }

    actions.push(...groveBankerProgressiveQuestionActions(npc));

    const line = npcLineForLikeability(npc);
    const questCopy =
      !activeQuest && availableQuests.length > 1
        ? `<text>I have a few short lessons set aside if you have a quiet minute. Pick whichever feels useful first.</text>`
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
      actions: actions.slice(0, 4),
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
      const handler = (event: GardenHoseEvent) => {
        const current = readSnapshotGroveQuestState();
        const quest = questById(current.activeQuestId);
        if (!quest || current.completedQuestIds.includes(quest.id)) {
          return;
        }
        if (doesEventAdvanceQuest(event, quest, current.activeObjectiveIndex)) {
          advanceSnapshotGroveQuest(
            quest,
            mapManager,
            (event as any).kind || "event",
            resources
          );
        }
      };
      gardenHose.on("anyEvent", handler);
      return () => gardenHose.off("anyEvent", handler);
    }, [gardenHose, mapManager, resources]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const handler = () => {
        if (snapshotGroveSuppressInventoryAdvanceDepth > 0) {
          return;
        }
        const current = readSnapshotGroveQuestState();
        const quest = questById(current.activeQuestId);
        if (!quest || current.completedQuestIds.includes(quest.id)) {
          return;
        }
        const event = { kind: "inventory_change" } as GardenHoseEvent;
        if (doesEventAdvanceQuest(event, quest, current.activeObjectiveIndex)) {
          advanceSnapshotGroveQuest(
            quest,
            mapManager,
            "local inventory changed",
            resources
          );
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
        const current = readSnapshotGroveQuestState();
        const quest = questById(current.activeQuestId);
        if (!quest || current.completedQuestIds.includes(quest.id)) {
          return;
        }
        const detail = (
          browserEvent as CustomEvent<HarthmereWorldObjectInteractionEventDetail>
        ).detail;
        if (!detail) {
          return;
        }
        const event = snapshotGroveEventFromWorldObjectInteraction(
          detail,
          quest,
          current.activeObjectiveIndex
        );
        if (
          event &&
          doesEventAdvanceQuest(event, quest, current.activeObjectiveIndex)
        ) {
          const grantedPracticeItem =
            withSnapshotGroveInventoryAdvanceSuppressed(() =>
              grantSnapshotGroveWorldObjectPickupItem(
                quest,
                current.activeObjectiveIndex,
                (event as any).trigger
              )
            );
          advanceSnapshotGroveQuest(
            quest,
            mapManager,
            grantedPracticeItem
              ? `${detail.kind}:${detail.label ?? "world_object"}:${
                  grantedPracticeItem.itemId
                }`
              : `${detail.kind}:${detail.label ?? "world_object"}`,
            resources
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
        const quest = questById(current.activeQuestId);
        if (!quest || current.completedQuestIds.includes(quest.id)) {
          return;
        }
        const detail =
          (browserEvent as CustomEvent<Record<string, unknown>>).detail ?? {};
        const event = {
          kind: "harthmere_local_dev_item_use",
          ...detail,
        } as unknown as GardenHoseEvent;
        if (doesEventAdvanceQuest(event, quest, current.activeObjectiveIndex)) {
          advanceSnapshotGroveQuest(
            quest,
            mapManager,
            String((event as any).itemId ?? "item_use"),
            resources
          );
        }
      };
      window.addEventListener(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, handler);
      return () =>
        window.removeEventListener(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, handler);
    }, [mapManager, resources]);

    useEffect(() => {
      const quest = questById(state.activeQuestId);
      if (!quest || state.completedQuestIds.includes(quest.id)) {
        return;
      }
      const trigger = currentTriggerForQuest(quest, state.activeObjectiveIndex);
      if (trigger !== "near_location") {
        return;
      }
      const marker = currentMarkerForQuest(quest, state.activeObjectiveIndex);
      if (!marker) {
        return;
      }
      const playerPos = localPlayer.player.position as Vec3;
      const distance = Math.hypot(
        marker.position[0] - playerPos[0],
        marker.position[2] - playerPos[2]
      );
      if (distance <= 8) {
        advanceSnapshotGroveQuest(
          quest,
          mapManager,
          "arrived_at_marker",
          resources
        );
      }
    }, [
      localPlayer.player.position,
      mapManager,
      resources,
      state.activeObjectiveIndex,
      state.activeQuestId,
      state.completedQuestIds,
    ]);

    useEffect(() => {
      const quest = questById(state.activeQuestId);
      syncSnapshotGroveQuestMarkers(
        mapManager,
        quest,
        state.activeObjectiveIndex
      );
    }, [mapManager, state.activeObjectiveIndex, state.activeQuestId]);

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
      const labels = snapshotGroveTutorNavLabelsForHighlights(chips);
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
        reset: () => {
          window.localStorage.removeItem(SNAPSHOT_GROVE_QUEST_STATE_KEY);
          window.localStorage.removeItem(SNAPSHOT_GROVE_LIKEABILITY_KEY);
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

export const SnapshotGroveMapHUD: React.FunctionComponent<{}> = () => {
  const { gardenHose, reactResources, mapManager } = useClientContext();
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
  const objectiveIndex =
    state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0;
  const marker = currentMarkerForQuest(quest, objectiveIndex);
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
  const step = groveQuestStepCopy(quest, objectiveIndex);
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
  const giver = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === quest.giverNpcId);
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
            {quest.markerIds.map((markerId, stepIndex) => {
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
                        stepMarker.position,
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
                      isActiveStep ? "text-lime-100 font-bold" : "text-white/45"
                    }
                  >
                    {isActiveStep ? "NOW" : isPastStep ? "DONE" : "NEXT"}
                  </span>
                </button>
              );
            })}
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
              marker.position,
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

export const SnapshotGroveJournalPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotGroveQuestState();
  const activeQuest = questById(state.activeQuestId);
  const fountainLessons = SNAPSHOT_GROVE_QUESTS.filter((quest) =>
    SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(quest.id)
  );
  const roadGraduation = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) => quest.category === "road_graduation"
  );
  const roadNeighbors = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) => quest.category === "road_neighbor"
  );
  const roadStories = SNAPSHOT_GROVE_QUESTS.filter(
    (quest) =>
      !SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET.has(quest.id) &&
      quest.category !== "road_graduation" &&
      quest.category !== "road_neighbor"
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
      (npc) => npc.id === quest.giverNpcId
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
              groveQuestStepCopy(activeQuest, state.activeObjectiveIndex)
                .progress
            }
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            {groveQuestStepCopy(activeQuest, state.activeObjectiveIndex).target}
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
