import { harthmereLocalStorage } from "@/client/util/storage";
import { getOwnedItems } from "@/client/components/inventory/helpers";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { completeHarthmereDailyTaskSoon } from "@/client/components/challenges/harthmereDailyTasks";
import { fillKnownRoadAheadClothingCrates } from "@/client/components/challenges/harthmereObjectContainers";
import { awardHarthmereQuestXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { addToast } from "@/client/components/toast/helpers";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  readHarthmereInventoryState,
  readHarthmereLiveEquipmentSnapshot,
  readHarthmereLiveInventoryItemCount,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { harthmereLiveServerAuthoritative } from "@/client/components/challenges/harthmereLiveAuthoritySignal";
import { HARTHMERE_INVENTORY_EVENT } from "@/client/components/challenges/harthmereEvents";
import type { GardenHoseEvent } from "@/client/events/api";
import { GENESIS_CROSSROADS_LOCATION } from "@/client/util/nux/state_machines";
import { BikkieIds } from "@/shared/bikkie/ids";
import { Wearing } from "@/shared/ecs/gen/components";
import { isFloraId } from "@/shared/game/ids";
import { matchingItemRefs } from "@/shared/game/inventory";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { snapshotGroveLandmarkById } from "@/shared/harthmere/snapshot_grove_content";
import { HARTHMERE_CRAFTING_TOOLS } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  SNAPSHOT_ROAD_AHEAD_MISSION,
  SNAPSHOT_ROAD_AHEAD_MISSION_ID,
  SNAPSHOT_ROAD_AHEAD_MISSION_TITLE,
  type SnapshotRoadAheadMissionDefinition,
  type SnapshotRoadAheadMissionStep,
} from "@/shared/harthmere/snapshot_complete_port";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_MISSION_BRIDGE_VERSION = "snapshot-road-ahead-full-chain";

export const SNAPSHOT_MISSION_BRIDGE_PRODUCTION_COPY =
  "snapshot-road-ahead-production-dialogue";

export const SNAPSHOT_ROAD_AHEAD_FULL_CHAIN_VERSION =
  "snapshot-road-ahead-full-chain";
export const SNAPSHOT_MARKET_JACKIE_ACTIVATION_FIX =
  "snapshot-grove-clear-road-ahead";

export const SNAPSHOT_MISSION_STATE_KEY =
  "biomes.localDev.snapshotMissionState";

export const SNAPSHOT_MISSION_STATE_EVENT =
  "biomes:local-dev-snapshot-mission-state";

export const SNAPSHOT_MISSION_NAV_AID_ID = 710_073;

const SNAPSHOT_MISSION_EVENTS_KEY = "biomes.localDev.snapshotMissionEvents";

const SNAPSHOT_MISSION_REWARDS_KEY = "biomes.localDev.snapshotMissionRewards";
const SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_KEY =
  "biomes.localDev.snapshotRoadAheadEquippedGear";
const SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_EVENT =
  "biomes:local-dev-snapshot-road-ahead-equipped-gear";

const SNAPSHOT_MISSION_TITLE = SNAPSHOT_ROAD_AHEAD_MISSION_TITLE;
const SNAPSHOT_MISSION_ID = SNAPSHOT_ROAD_AHEAD_MISSION_ID;
const SNAPSHOT_MISSION_XP_ID = "snapshot-road-ahead";
const JACKIE_ID = SNAPSHOT_ROAD_AHEAD_MISSION.giverEntityId;

type SnapshotMissionTargetKind =
  | "jackie"
  | "grove"
  | "road_marker"
  | "muckwad_patch"
  | "building_spot"
  | "wardrobe"
  | "jump_run"
  | "selfie_overlook"
  | "crafting_stop";

type SnapshotMissionTriggerKind =
  | "dialog"
  | "location"
  | "destroy"
  | "place_voxel"
  | "wearing"
  | "running_jump"
  | "photo"
  | "craft_muck_buster";

export type SnapshotMissionStep = SnapshotRoadAheadMissionStep;
export type SnapshotMissionDefinition = SnapshotRoadAheadMissionDefinition;

export interface SnapshotMissionState {
  accepted: boolean;
  active: Record<string, number>;
  currentStepIndex: number;
  completedStepIds: string[];
  completed: string[];
  pinned: string[];
  rewards: string[];
  updatedAt?: number;
}

type SnapshotMissionEvent = {
  at: number;
  title: string;
  detail: string;
  kind: "accepted" | "progress" | "completed" | "reward";
};

const EMPTY_SNAPSHOT_MISSION_STATE: SnapshotMissionState = {
  accepted: false,
  active: {},
  currentStepIndex: 0,
  completedStepIds: [],
  completed: [],
  pinned: [],
  rewards: [],
};

export const SNAPSHOT_MISSIONS: readonly SnapshotMissionDefinition[] = [
  SNAPSHOT_ROAD_AHEAD_MISSION,
];

const SNAPSHOT_MISSION_TARGET_OFFSETS: Record<
  Exclude<SnapshotMissionTargetKind, "jackie">,
  Vec3
> = {
  grove: [GENESIS_CROSSROADS_LOCATION[0], 54, GENESIS_CROSSROADS_LOCATION[1]],
  road_marker: snapshotGroveLandmarkById("old_grove_road_post")?.position ?? [
    500, 54, -140,
  ],
  muckwad_patch: snapshotGroveLandmarkById("muckwad_patch")?.position ?? [
    512, 54, -152,
  ],
  building_spot: snapshotGroveLandmarkById("building_practice_spot")
    ?.position ?? [528, 54, -152],
  wardrobe: snapshotGroveLandmarkById("lovely_locks_mirror")?.position ?? [
    GENESIS_CROSSROADS_LOCATION[0],
    54,
    GENESIS_CROSSROADS_LOCATION[1],
  ],
  jump_run: snapshotGroveLandmarkById("road_jump_stretch")?.position ?? [
    548, 54, -170,
  ],
  selfie_overlook: snapshotGroveLandmarkById("selfie_overlook")?.position ?? [
    560, 54, -182,
  ],
  crafting_stop: snapshotGroveLandmarkById("service_tower_platform")
    ?.position ?? [
    GENESIS_CROSSROADS_LOCATION[0] + 8,
    54,
    GENESIS_CROSSROADS_LOCATION[1] - 4,
  ],
};

const SNAPSHOT_STEP_TARGET_BY_MARKER_ID: Record<
  string,
  SnapshotMissionTargetKind
> = {
  npc_jackie: "jackie",
  jackie: "jackie",
  old_grove_road_post: "road_marker",
  muckwad_patch: "muckwad_patch",
  building_practice_spot: "building_spot",
  lovely_locks_mirror: "wardrobe",
  road_jump_stretch: "jump_run",
  selfie_overlook: "selfie_overlook",
  service_tower_platform: "crafting_stop",
};

const BIOMES_UI_MARKER_ID_BY_TARGET: Record<SnapshotMissionTargetKind, string> =
  {
    jackie: "jackie",
    grove: "town",
    road_marker: "road_marker",
    muckwad_patch: "muckwad_patch",
    building_spot: "building_spot",
    wardrobe: "wardrobe",
    jump_run: "jump_run",
    selfie_overlook: "selfie_overlook",
    crafting_stop: "crafting_stop",
  };

function snapshotStepTargetKind(
  step: SnapshotMissionStep
): SnapshotMissionTargetKind {
  return SNAPSHOT_STEP_TARGET_BY_MARKER_ID[step.markerId] ?? "grove";
}

function snapshotStepBiomesUiMarkerId(step: SnapshotMissionStep) {
  return BIOMES_UI_MARKER_ID_BY_TARGET[snapshotStepTargetKind(step)];
}

function snapshotStepRuntimeTrigger(
  step: SnapshotMissionStep
): SnapshotMissionTriggerKind {
  switch (step.trigger) {
    case "talk_npc":
      return "dialog";
    case "near_location":
      return "location";
    case "destroy":
      return "destroy";
    case "place_voxel":
      return "place_voxel";
    case "inventory_change":
      return "wearing";
    case "jump":
      return "running_jump";
    case "photo_post_attempt":
    case "show_post_capture":
      return "photo";
    case "craft":
      return "craft_muck_buster";
    default:
      return "dialog";
  }
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function cloneState(state: SnapshotMissionState): SnapshotMissionState {
  return {
    accepted: state.accepted,
    active: { ...state.active },
    currentStepIndex: state.currentStepIndex,
    completedStepIds: [...state.completedStepIds],
    completed: [...state.completed],
    pinned: [...state.pinned],
    rewards: [...state.rewards],
    updatedAt: state.updatedAt,
  };
}

function firstSnapshotMission(): SnapshotMissionDefinition {
  return SNAPSHOT_ROAD_AHEAD_MISSION;
}

function normalizeSnapshotMissionState(
  parsed: Partial<SnapshotMissionState> | undefined
): SnapshotMissionState {
  if (!parsed) {
    return cloneState(EMPTY_SNAPSHOT_MISSION_STATE);
  }
  const legacyActiveStep = parsed.active?.[SNAPSHOT_MISSION_ID];
  const currentStepIndex = Math.max(
    0,
    Math.min(
      firstSnapshotMission().steps.length - 1,
      Number.isFinite(parsed.currentStepIndex)
        ? Number(parsed.currentStepIndex)
        : legacyActiveStep ?? 0
    )
  );
  const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
  return {
    accepted: Boolean(
      parsed.accepted || parsed.active?.[SNAPSHOT_MISSION_ID] !== undefined
    ),
    active: parsed.active ?? {},
    currentStepIndex,
    completedStepIds: Array.isArray(parsed.completedStepIds)
      ? parsed.completedStepIds
      : [],
    completed,
    pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
    rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
    updatedAt: parsed.updatedAt,
  };
}

export function readSnapshotMissionState(): SnapshotMissionState {
  if (!isBrowser()) {
    return cloneState(EMPTY_SNAPSHOT_MISSION_STATE);
  }
  try {
    const raw = harthmereLocalStorage.getItem(SNAPSHOT_MISSION_STATE_KEY);
    return normalizeSnapshotMissionState(
      raw ? (JSON.parse(raw) as Partial<SnapshotMissionState>) : undefined
    );
  } catch {
    return cloneState(EMPTY_SNAPSHOT_MISSION_STATE);
  }
}

// HARTHMERE_SNAPSHOT_MISSION_BRIDGE_SYNC (2026-07-02): the BiomesUI mission
// tracker (journal/HUD/map) reads THIS bridge store, but gameplay trigger events
// advance a SEPARATE store (snapshot_complete_port). That disconnect is why the
// player could break muckwad / reach the road post yet see no quest progress.
// The complete-port event handler now calls this to mirror the same Road Ahead
// progress into the bridge store by STEP INDEX, so the displayed quest advances
// and completes in step with the player's actions. Idempotent and never throws.
export function applySnapshotRoadAheadProgressFromPortForBiomesUI(input: {
  completedStepIndexes: readonly number[];
  activeStepIndex: number;
  missionCompleted: boolean;
}): void {
  if (!isBrowser()) {
    return;
  }
  const mission = firstSnapshotMission();
  const state = readSnapshotMissionState();
  const completedStepIds = new Set(state.completedStepIds);
  for (const index of input.completedStepIndexes) {
    const step = mission.steps[index];
    if (step) {
      completedStepIds.add(step.id);
    }
  }
  const clampedActive = Math.min(
    Math.max(0, input.activeStepIndex),
    Math.max(0, mission.steps.length - 1)
  );
  const active = { ...state.active };
  if (input.missionCompleted) {
    delete active[mission.id];
  } else {
    active[mission.id] = clampedActive;
  }
  writeSnapshotMissionState({
    ...state,
    accepted: true,
    active,
    currentStepIndex: input.missionCompleted
      ? Math.max(0, mission.steps.length - 1)
      : clampedActive,
    completedStepIds: [...completedStepIds],
    completed: input.missionCompleted
      ? [...new Set([...state.completed, mission.id])]
      : state.completed.filter((id) => id !== mission.id),
    pinned: input.missionCompleted
      ? state.pinned.filter((id) => id !== mission.id)
      : [...new Set([...state.pinned, mission.id])],
  });
}

type SnapshotRoadAheadChallengeStepHint =
  | {
      id?: unknown;
      stepId?: unknown;
      challengeStepId?: unknown;
    }
  | unknown;

function snapshotRoadAheadChallengeStepHintId(
  hint: SnapshotRoadAheadChallengeStepHint
) {
  if (hint === undefined || hint === null) {
    return undefined;
  }
  if (typeof hint === "object") {
    const record = hint as {
      id?: unknown;
      stepId?: unknown;
      challengeStepId?: unknown;
    };
    const candidate = record.stepId ?? record.challengeStepId ?? record.id;
    return candidate === undefined || candidate === null
      ? undefined
      : String(candidate);
  }
  return String(hint);
}

function snapshotRoadAheadChallengeStepHintIds(
  hints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const ids = new Set<string>();
  for (const hint of hints ?? []) {
    const id = snapshotRoadAheadChallengeStepHintId(hint);
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}

function snapshotRoadAheadStepIndexForChallengeStepHintIds(
  hints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const ids = snapshotRoadAheadChallengeStepHintIds(hints);
  if (!ids.size) {
    return undefined;
  }
  let stepIndex = -1;
  firstSnapshotMission().steps.forEach((step, index) => {
    if (step.challengeStepId && ids.has(String(step.challengeStepId))) {
      stepIndex = Math.max(stepIndex, index);
    }
  });
  return stepIndex;
}

const SNAPSHOT_ROAD_AHEAD_NUX_TO_STEP_ID = new Map<number, BiomesId>(
  firstSnapshotMission().steps.flatMap((step) =>
    step.sourceNuxId !== undefined && step.challengeStepId
      ? ([[step.sourceNuxId, step.challengeStepId]] as [number, BiomesId][])
      : []
  )
);

export function snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUI(
  activeNuxes: unknown
) {
  if (!Array.isArray(activeNuxes)) {
    return [];
  }
  return activeNuxes
    .map((entry) => {
      const nuxId = Number((entry as { nuxId?: unknown })?.nuxId);
      return Number.isFinite(nuxId)
        ? SNAPSHOT_ROAD_AHEAD_NUX_TO_STEP_ID.get(nuxId)
        : undefined;
    })
    .filter((id): id is BiomesId => id !== undefined);
}

function snapshotRoadAheadStateForBiomesUI(
  state: SnapshotMissionState,
  challengeStepHints?: Iterable<SnapshotRoadAheadChallengeStepHint>
): SnapshotMissionState {
  const activeStepIndex =
    snapshotRoadAheadStepIndexForChallengeStepHintIds(challengeStepHints);
  if (activeStepIndex === undefined || activeStepIndex < 0) {
    return state;
  }

  const mission = firstSnapshotMission();
  const missionStepIndexById = new Map(
    mission.steps.map((step, index) => [step.id, index])
  );
  const completedStepIds = [
    ...new Set([
      ...state.completedStepIds.filter((id) => {
        const index = missionStepIndexById.get(id);
        return index === undefined || index < activeStepIndex;
      }),
      ...mission.steps.slice(0, activeStepIndex).map((step) => step.id),
    ]),
  ];

  return normalizeSnapshotMissionState({
    ...state,
    accepted: true,
    active: { ...state.active, [mission.id]: activeStepIndex },
    currentStepIndex: activeStepIndex,
    completedStepIds,
    completed: state.completed.filter((id) => id !== mission.id),
    pinned: [...new Set([...state.pinned, mission.id])],
  });
}

export function writeSnapshotMissionState(state: SnapshotMissionState) {
  if (!isBrowser()) {
    return;
  }
  const next = normalizeSnapshotMissionState({
    ...state,
    updatedAt: Date.now(),
  });
  harthmereLocalStorage.setItem(
    SNAPSHOT_MISSION_STATE_KEY,
    JSON.stringify(next)
  );
  window.dispatchEvent(new Event(SNAPSHOT_MISSION_STATE_EVENT));
}

export function recordSnapshotRoadAheadChallengeStepForBiomesUI(
  stepId: unknown,
  eventKind: "begin" | "complete"
) {
  if (!isBrowser()) {
    return false;
  }
  const mission = firstSnapshotMission();
  const stepIndex = mission.steps.findIndex(
    (step) =>
      step.challengeStepId !== undefined &&
      String(step.challengeStepId) === String(stepId)
  );
  if (stepIndex < 0) {
    return false;
  }

  const state = readSnapshotMissionState();
  if (isMissionCompleted(state)) {
    fillKnownRoadAheadClothingCrates();
    return false;
  }
  const completedMission =
    eventKind === "complete" && stepIndex >= mission.steps.length - 1;
  const targetStepIndex = completedMission
    ? stepIndex
    : eventKind === "complete"
    ? Math.min(stepIndex + 1, mission.steps.length - 1)
    : stepIndex;
  const shouldMoveStep =
    isMissionCompleted(state) ||
    !state.accepted ||
    targetStepIndex >= state.currentStepIndex;
  const nextStepIndex = shouldMoveStep
    ? targetStepIndex
    : state.currentStepIndex;
  const completedThroughIndex =
    eventKind === "complete" ? stepIndex + 1 : nextStepIndex;
  const completedStepIds = [
    ...new Set([
      ...state.completedStepIds,
      ...mission.steps.slice(0, completedThroughIndex).map((step) => step.id),
    ]),
  ];
  const active = { ...state.active };
  if (completedMission) {
    delete active[mission.id];
  } else {
    active[mission.id] = nextStepIndex;
  }

  writeSnapshotMissionState({
    ...state,
    accepted: true,
    active,
    currentStepIndex: nextStepIndex,
    completedStepIds,
    completed: completedMission
      ? [...new Set([...state.completed, mission.id])]
      : state.completed.filter((id) => id !== mission.id),
    pinned: completedMission
      ? state.pinned.filter((id) => id !== mission.id)
      : [...new Set([...state.pinned, mission.id])],
  });
  fillKnownRoadAheadClothingCrates();
  return true;
}

export function syncSnapshotRoadAheadChallengeStepHintsForBiomesUI(
  hints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  if (!isBrowser()) {
    return false;
  }
  const mission = firstSnapshotMission();
  const stepIndex = snapshotRoadAheadStepIndexForChallengeStepHintIds(hints);
  if (stepIndex === undefined || stepIndex < 0) {
    return false;
  }
  const step = mission.steps[stepIndex];
  if (!step?.challengeStepId) {
    return false;
  }

  const state = readSnapshotMissionState();
  if (isMissionCompleted(state)) {
    return false;
  }
  const completedThroughCurrentHint = mission.steps
    .slice(0, stepIndex)
    .every((candidate) => state.completedStepIds.includes(candidate.id));
  if (
    state.accepted &&
    state.currentStepIndex >= stepIndex &&
    completedThroughCurrentHint
  ) {
    fillKnownRoadAheadClothingCrates();
    return false;
  }

  return recordSnapshotRoadAheadChallengeStepForBiomesUI(
    step.challengeStepId,
    "begin"
  );
}

function readSnapshotMissionEvents(): SnapshotMissionEvent[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = harthmereLocalStorage.getItem(SNAPSHOT_MISSION_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as SnapshotMissionEvent[]) : [];
  } catch {
    return [];
  }
}

function recordSnapshotMissionEvent(
  kind: SnapshotMissionEvent["kind"],
  title: string,
  detail: string
) {
  if (!isBrowser()) {
    return;
  }
  const next = [
    { at: Date.now(), kind, title, detail },
    ...readSnapshotMissionEvents(),
  ].slice(0, 16);
  harthmereLocalStorage.setItem(
    SNAPSHOT_MISSION_EVENTS_KEY,
    JSON.stringify(next)
  );
  window.dispatchEvent(new Event(SNAPSHOT_MISSION_STATE_EVENT));
}

function recordSnapshotMissionReward(reward: string) {
  if (!isBrowser()) {
    return;
  }
  const state = readSnapshotMissionState();
  if (state.rewards.includes(reward)) {
    return;
  }
  writeSnapshotMissionState({
    ...state,
    rewards: [...state.rewards, reward],
  });
  const existing = (() => {
    try {
      const raw = harthmereLocalStorage.getItem(SNAPSHOT_MISSION_REWARDS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })();
  harthmereLocalStorage.setItem(
    SNAPSHOT_MISSION_REWARDS_KEY,
    JSON.stringify([...new Set([reward, ...existing])].slice(0, 20))
  );
  recordSnapshotMissionEvent("reward", SNAPSHOT_MISSION_TITLE, reward);
}

function readSnapshotRoadAheadEquippedGearSlots() {
  if (!isBrowser()) return [];
  try {
    const raw = harthmereLocalStorage.getItem(
      SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_KEY
    );
    const parsed = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed)
      ? parsed.filter((slot): slot is string => typeof slot === "string")
      : [];
  } catch {
    return [];
  }
}

function readSnapshotRoadAheadLocalHarthmereClothingSlots() {
  if (!isBrowser()) return [];
  const equipment = readHarthmereInventoryState().equipment;
  const slots: string[] = [];
  if (equipment.chest?.itemId) slots.push("chest");
  if (equipment.legs?.itemId) slots.push("legs");
  return slots;
}

function isSnapshotRoadAheadLocalMuckClearingTool(itemId: string) {
  return (
    itemId === "muck_rake" ||
    itemId === "muck_buster" ||
    itemId === "practice_muck_buster" ||
    // The craftable Muck Buster / Muck Rake land in the inventory under their real
    // catalogue item ids, so recognize those too — otherwise crafting the tool
    // (now taught to new players) would not complete the Road Ahead craft step.
    itemId === HARTHMERE_CRAFTING_TOOLS.muckBuster ||
    itemId === HARTHMERE_CRAFTING_TOOLS.muckRake
  );
}

// Every item id that satisfies the "Carry a Muck Buster" step. Exported for
// the live-inventory check below and for tests.
export function snapshotRoadAheadMuckClearingToolItemIds(): string[] {
  return [
    "muck_rake",
    "muck_buster",
    "practice_muck_buster",
    HARTHMERE_CRAFTING_TOOLS.muckBuster,
    HARTHMERE_CRAFTING_TOOLS.muckRake,
  ];
}

function readSnapshotRoadAheadLocalHarthmereMuckClearingTool() {
  if (!isBrowser()) return false;
  const inventory = readHarthmereInventoryState();
  if (
    [
      inventory.equipment.main_hand,
      inventory.equipment.off_hand,
      ...inventory.backpack.items,
    ].some(
      (item) =>
        item?.itemId && isSnapshotRoadAheadLocalMuckClearingTool(item.itemId)
    )
  ) {
    return true;
  }
  // HARTHMERE_LIVE_INVENTORY_SNAPSHOT (audit fix, 2026-07-13): in
  // live-authoritative sessions the localStorage inventory above is
  // deliberately dropped from display (HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE)
  // and the tool lives in the SERVER inventory instead — previously that
  // soft-locked this step on any new device / cleared-storage session. Check
  // the last known live server inventory as a third source.
  return snapshotRoadAheadMuckClearingToolItemIds().some(
    (itemId) => readHarthmereLiveInventoryItemCount(itemId) > 0
  );
}

export function recordSnapshotRoadAheadEquippedGearSlotForBiomesUI(
  slot: string | undefined
) {
  if (!isBrowser() || !slot) return;
  const normalized =
    slot === "top" || slot === "torso"
      ? "chest"
      : slot === "bottoms"
      ? "legs"
      : slot;
  if (normalized !== "chest" && normalized !== "legs") return;
  const next = [
    ...new Set([...readSnapshotRoadAheadEquippedGearSlots(), normalized]),
  ];
  harthmereLocalStorage.setItem(
    SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_KEY,
    JSON.stringify(next)
  );
  window.dispatchEvent(new Event(SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_EVENT));
}

function isMissionCompleted(state: SnapshotMissionState) {
  return state.completed.includes(SNAPSHOT_MISSION_ID);
}

function getMissionStep(
  state: SnapshotMissionState,
  challengeStepHints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const uiState = snapshotRoadAheadStateForBiomesUI(state, challengeStepHints);
  const mission = firstSnapshotMission();
  const completed = isMissionCompleted(uiState);
  const stepIndex = completed
    ? mission.steps.length - 1
    : Math.max(0, Math.min(uiState.currentStepIndex, mission.steps.length - 1));
  return {
    mission,
    stepIndex,
    state: uiState,
    activeStepIndex: uiState.accepted && !completed ? stepIndex : undefined,
    completed,
    step: mission.steps[stepIndex] ?? mission.steps[0],
  };
}

export function snapshotRoadAheadMissionStepsForBiomesUI(
  state: SnapshotMissionState = readSnapshotMissionState(),
  challengeStepHints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const {
    mission,
    state: uiState,
    activeStepIndex,
    completed,
  } = getMissionStep(state, challengeStepHints);
  if (!state.accepted && !completed) {
    const projectedState = snapshotRoadAheadStateForBiomesUI(
      state,
      challengeStepHints
    );
    if (!projectedState.accepted) {
      return [];
    }
  }
  return mission.steps.slice(1).map((step, index) => {
    const stepIndex = index + 1;
    return {
      id: `${mission.id}:${step.id}`,
      title:
        completed || uiState.completedStepIds.includes(step.id)
          ? `Completed step ${stepIndex}`
          : stepIndex === activeStepIndex
          ? `Current step ${stepIndex}`
          : `Upcoming step ${stepIndex}`,
      objective: step.objective,
      done: completed || uiState.completedStepIds.includes(step.id),
    };
  });
}

export function snapshotRoadAheadTrackableQuestsForBiomesUI(
  state: SnapshotMissionState = readSnapshotMissionState(),
  challengeStepHints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const {
    mission,
    state: uiState,
    step,
    completed,
  } = getMissionStep(state, challengeStepHints);
  const objectives = mission.steps.map((entry) => entry.objective);
  return [
    {
      questId: mission.id,
      title: mission.title,
      area: mission.district,
      status: completed
        ? ("completed" as const)
        : uiState.accepted
        ? ("active" as const)
        : ("available" as const),
      firstMarkerId: snapshotStepBiomesUiMarkerId(step),
      reward: mission.reward,
      kind: mission.source,
      kindLabel: "Story Quest",
      objective: step.objective,
      objectives,
      description: mission.summary,
    },
  ];
}

export function firstActiveSnapshotRoadAheadQuestTitleForBiomesUI(
  state: SnapshotMissionState = readSnapshotMissionState(),
  challengeStepHints?: Iterable<SnapshotRoadAheadChallengeStepHint>
) {
  const uiState = snapshotRoadAheadStateForBiomesUI(state, challengeStepHints);
  return uiState.accepted && !isMissionCompleted(uiState)
    ? firstSnapshotMission().title
    : undefined;
}

function addSnapshotRoadAheadObjectiveToast(
  resources: ReturnType<typeof useClientContext>["resources"],
  id: string,
  objective: string
) {
  addToast(resources, {
    kind: "new",
    id: `${SNAPSHOT_MISSION_ID}:${id}:new`,
    message: objective,
  });
}

const SNAPSHOT_GROVE_NEXT_LESSONS_COPY =
  "Road Ahead is only the travel-basics chain. Next, talk to Luis at the Crossroads repair cart for building, repairs, and land claims. Then talk to Nia at the Grove Guild Charter Board for guild ranks, banks, permissions, and shared projects.";

function roadAheadStepCopy(
  mission: SnapshotMissionDefinition,
  step: SnapshotMissionStep,
  stepIndex: number
) {
  const totalPlayableSteps = Math.max(1, mission.steps.length - 1);
  const clearStepIndex = Math.max(1, stepIndex);
  return {
    progress: `Step ${clearStepIndex}/${totalPlayableSteps}: ${step.title}`,
    doNow: `Do this now: ${step.objective}`,
    where: `Go to: ${step.targetLabel}. ${step.mapHint}`,
    howItCompletes:
      snapshotStepRuntimeTrigger(step) === "dialog"
        ? "This step completes from Jackie dialog."
        : snapshotStepRuntimeTrigger(step) === "location"
        ? "This step completes when you physically reach the marked spot."
        : snapshotStepRuntimeTrigger(step) === "destroy"
        ? "This step completes when you break a valid non-flora block near the route."
        : snapshotStepRuntimeTrigger(step) === "place_voxel"
        ? "This step completes when you place a real block in the marked practice area."
        : snapshotStepRuntimeTrigger(step) === "wearing"
        ? "This step completes when both top and bottoms are equipped."
        : snapshotStepRuntimeTrigger(step) === "running_jump"
        ? "This step completes on a sprinting jump at the road stretch."
        : snapshotStepRuntimeTrigger(step) === "photo"
        ? "This step completes from the camera/photo-post flow."
        : snapshotStepRuntimeTrigger(step) === "craft_muck_buster"
        ? "Craft or obtain a Muck Buster. The lesson completes when the tool is actually in your inventory."
        : "Complete the marked in-world action to advance.",
  };
}

function groveFallbackPosition(y = 54): Vec3 {
  return [GENESIS_CROSSROADS_LOCATION[0], y, GENESIS_CROSSROADS_LOCATION[1]];
}

function useJackiePosition(): Vec3 {
  const { reactResources } = useClientContext();
  const [position] = reactResources.useAll(["/ecs/c/position", JACKIE_ID]);
  return (position?.v ? [...position.v] : groveFallbackPosition()) as Vec3;
}

function snapshotTargetPosition(
  target: SnapshotMissionTargetKind,
  jackiePosition: ReadonlyVec3
): Vec3 {
  if (target === "jackie") {
    return [...jackiePosition] as Vec3;
  }
  const base = SNAPSHOT_MISSION_TARGET_OFFSETS[target];
  if (!base) {
    return groveFallbackPosition(jackiePosition[1]);
  }
  return [base[0], jackiePosition[1] ?? base[1], base[2]];
}

function compassDirection(dx: number, dz: number) {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (absX < 4 && absZ < 4) {
    return "here";
  }
  const eastWest = dx > 0 ? "east" : "west";
  const northSouth = dz > 0 ? "south" : "north";
  if (absX > absZ * 1.7) {
    return eastWest;
  }
  if (absZ > absX * 1.7) {
    return northSouth;
  }
  return `${northSouth}-${eastWest}`;
}

function challengeTriggerProgress(
  step: SnapshotMissionStep,
  complete: boolean
) {
  return {
    id: step.challengeStepId ?? (0 as BiomesId),
    name: step.title,
    progressPercentage: complete ? 1 : 0,
    progressString: complete ? step.completion : step.objective,
    payload: { kind: "leaf" },
    children: [],
  } as any;
}

function publishStepBegin(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  step: SnapshotMissionStep
) {
  if (!step.challengeStepId) {
    return;
  }
  gardenHose.publish({
    kind: "challenge_step_begin",
    stepId: step.challengeStepId,
    triggerProgress: challengeTriggerProgress(step, false),
  } as GardenHoseEvent);
}

function publishStepComplete(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  step: SnapshotMissionStep
) {
  if (!step.challengeStepId) {
    return;
  }
  gardenHose.publish({
    kind: "challenge_step_complete",
    stepId: step.challengeStepId,
    triggerProgress: challengeTriggerProgress(step, true),
  } as GardenHoseEvent);
}

export function pinSnapshotMissionTarget(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  targetPos: ReadonlyVec3,
  id = SNAPSHOT_MISSION_NAV_AID_ID
) {
  mapManager.removeNavigationAid?.(id);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      autoremoveWhenNear: true,
      target: {
        kind: "position",
        position: [...targetPos],
      },
    },
    id
  );
}

function acceptSnapshotRoadAheadMission(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  resources?: ReturnType<typeof useClientContext>["resources"]
) {
  const mission = firstSnapshotMission();
  const firstRoadStepIndex = 1;
  const firstRoadStep = mission.steps[firstRoadStepIndex];
  const next: SnapshotMissionState = {
    accepted: true,
    active: { [mission.id]: firstRoadStepIndex },
    currentStepIndex: firstRoadStepIndex,
    completedStepIds: [mission.steps[0].id],
    completed: [],
    pinned: [mission.id],
    rewards: [],
    updatedAt: Date.now(),
  };
  writeSnapshotMissionState(next);
  recordSnapshotMissionEvent(
    "accepted",
    mission.title,
    "Jackie marked the road out of The Grove."
  );
  recordSnapshotMissionReward(mission.steps[0].reward);
  if (firstRoadStep) {
    publishStepBegin(gardenHose, firstRoadStep);
    if (resources) {
      addSnapshotRoadAheadObjectiveToast(
        resources,
        firstRoadStep.id,
        firstRoadStep.objective
      );
    }
  }
}

function advanceSnapshotRoadAhead(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  reason: string,
  resources?: ReturnType<typeof useClientContext>["resources"]
) {
  const mission = firstSnapshotMission();
  const state = readSnapshotMissionState();
  if (!state.accepted || isMissionCompleted(state)) {
    return;
  }
  const stepIndex = Math.max(
    1,
    Math.min(state.currentStepIndex, mission.steps.length - 1)
  );
  const step = mission.steps[stepIndex];
  if (!step || state.completedStepIds.includes(step.id)) {
    return;
  }

  const completedStepIds = [...new Set([...state.completedStepIds, step.id])];
  const completedMission = stepIndex >= mission.steps.length - 1;
  publishStepComplete(gardenHose, step);
  completeHarthmereDailyTaskSoon("main_quest");
  recordSnapshotMissionEvent(
    completedMission ? "completed" : "progress",
    step.title,
    `${step.completion} (${reason})`
  );
  recordSnapshotMissionReward(step.reward);
  awardHarthmereQuestXp(
    SNAPSHOT_MISSION_XP_ID,
    mission.title,
    completedMission
  );

  if (completedMission) {
    const active = { ...state.active };
    delete active[mission.id];
    const nextState = {
      ...state,
      active,
      completedStepIds,
      completed: [...new Set([...state.completed, mission.id])],
      currentStepIndex: stepIndex,
      updatedAt: Date.now(),
    };
    writeSnapshotMissionState(nextState);
    fillKnownRoadAheadClothingCrates();
    return;
  }

  const nextStepIndex = stepIndex + 1;
  const nextStep = mission.steps[nextStepIndex];
  const nextState = {
    ...state,
    accepted: true,
    active: { ...state.active, [mission.id]: nextStepIndex },
    currentStepIndex: nextStepIndex,
    completedStepIds,
    pinned: [...new Set([...state.pinned, mission.id])],
    updatedAt: Date.now(),
  };
  writeSnapshotMissionState(nextState);
  fillKnownRoadAheadClothingCrates();
  if (nextStep) {
    publishStepBegin(gardenHose, nextStep);
    if (resources) {
      addSnapshotRoadAheadObjectiveToast(
        resources,
        nextStep.id,
        nextStep.objective
      );
    }
  }
}

function shouldEventCompleteStep(
  step: SnapshotMissionStep,
  event: GardenHoseEvent
) {
  switch (snapshotStepRuntimeTrigger(step)) {
    case "dialog":
      return event.kind === "talk_npc" && event.npcId === JACKIE_ID;
    case "destroy":
      return (
        event.kind === "destroy" &&
        event.terrainId &&
        !isFloraId(event.terrainId)
      );
    case "place_voxel":
      return (
        event.kind === "place_voxel" || event.kind === "block_inventory_throw"
      );
    case "running_jump":
      return event.kind === "jump" && event.running;
    case "photo":
      return (
        event.kind === "photo_post_attempt" ||
        event.kind === "photo_post" ||
        event.kind === "show_post_capture"
      );
    default:
      return false;
  }
}

function shouldEventCompleteStepWithInventoryState(
  step: SnapshotMissionStep,
  event: GardenHoseEvent,
  wearing: { items: { get(id: BiomesId): unknown } }
) {
  if (shouldEventCompleteStep(step, event)) {
    return true;
  }
  return (
    snapshotStepRuntimeTrigger(step) === "wearing" &&
    (event.kind === "inventory_change" || event.kind === "equip") &&
    hasRequiredClothing(wearing)
  );
}

export function handleSnapshotRoadAheadEventForTest(event: GardenHoseEvent) {
  const published: GardenHoseEvent[] = [];
  const current = readSnapshotMissionState();
  const { step, completed } = getMissionStep(current);
  if (
    current.accepted &&
    !completed &&
    shouldEventCompleteStepWithInventoryState(step, event, Wearing.create())
  ) {
    advanceSnapshotRoadAhead(
      { publish: (publishedEvent) => published.push(publishedEvent) },
      event.kind
    );
  }
  return {
    published,
    state: readSnapshotMissionState(),
  };
}

function hasRequiredClothing(wearing: {
  items: { get(id: BiomesId): unknown };
}) {
  const liveEquipment = readHarthmereLiveEquipmentSnapshot().equipment;
  const localHarthmereSlots = harthmereLiveServerAuthoritative()
    ? new Set<string>()
    : new Set(readSnapshotRoadAheadLocalHarthmereClothingSlots());
  return Boolean(
    (wearing.items.get(BikkieIds.top) ||
      liveEquipment.chest ||
      localHarthmereSlots.has("chest")) &&
      (wearing.items.get(BikkieIds.bottoms) ||
        liveEquipment.legs ||
        localHarthmereSlots.has("legs"))
  );
}

export function snapshotRoadAheadHasRequiredClothingForTest(wearing: {
  items: { get(id: BiomesId): unknown };
}) {
  return hasRequiredClothing(wearing);
}

export function snapshotRoadAheadHasLocalMuckClearingToolForTest() {
  return readSnapshotRoadAheadLocalHarthmereMuckClearingTool();
}

export const SnapshotMissionRuntimeController: React.FunctionComponent<{}> =
  () => {
    const { gardenHose, mapManager, reactResources, resources, userId } =
      useClientContext();
    const localPlayer = reactResources.use("/scene/local_player");
    const inventory = reactResources.use("/ecs/c/inventory", userId);
    const wearing =
      reactResources.use("/ecs/c/wearing", userId) ?? Wearing.create();
    const selection = reactResources.use("/hotbar/selection");
    const jackiePosition = useJackiePosition();
    const [state, setState] = useState<SnapshotMissionState>(() =>
      readSnapshotMissionState()
    );

    useEffect(() => {
      const refresh = () => setState(readSnapshotMissionState());
      window.addEventListener("storage", refresh);
      window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
      window.addEventListener(SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_EVENT, refresh);
      window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      return () => {
        window.removeEventListener("storage", refresh);
        window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
        window.removeEventListener(
          SNAPSHOT_ROAD_AHEAD_EQUIPPED_GEAR_EVENT,
          refresh
        );
        window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      };
    }, []);

    useEffect(() => {
      const handler = (event: GardenHoseEvent) => {
        const current = readSnapshotMissionState();
        const { step, completed } = getMissionStep(current);
        if (!current.accepted || completed) {
          return;
        }
        if (shouldEventCompleteStepWithInventoryState(step, event, wearing)) {
          advanceSnapshotRoadAhead(gardenHose, event.kind, resources);
        }
      };
      gardenHose.on("anyEvent", handler);
      return () => gardenHose.off("anyEvent", handler);
    }, [gardenHose, resources, wearing]);

    useEffect(() => {
      const { step, completed } = getMissionStep(state);
      if (
        !state.accepted ||
        completed ||
        snapshotStepRuntimeTrigger(step) !== "location"
      ) {
        return;
      }
      const playerPos = localPlayer.player.position as Vec3;
      const targetPos = snapshotTargetPosition(
        snapshotStepTargetKind(step),
        jackiePosition
      );
      const distance = Math.hypot(
        targetPos[0] - playerPos[0],
        targetPos[2] - playerPos[2]
      );
      if (distance <= (step.arrivalRadius ?? 8)) {
        advanceSnapshotRoadAhead(gardenHose, "arrived at marker", resources);
      }
    }, [
      gardenHose,
      jackiePosition,
      localPlayer.player.position,
      resources,
      state,
    ]);

    useEffect(() => {
      const { step, completed } = getMissionStep(state);
      if (
        !state.accepted ||
        completed ||
        snapshotStepRuntimeTrigger(step) !== "wearing"
      ) {
        return;
      }
      if (hasRequiredClothing(wearing)) {
        advanceSnapshotRoadAhead(gardenHose, "gear equipped", resources);
      }
    }, [gardenHose, resources, state, wearing]);

    useEffect(() => {
      const { step, completed } = getMissionStep(state);
      if (
        !state.accepted ||
        completed ||
        snapshotStepRuntimeTrigger(step) !== "craft_muck_buster"
      ) {
        return;
      }
      const ownedItems = getOwnedItems(resources, userId);
      const hasMuckBuster =
        matchingItemRefs(ownedItems, (entry) => Boolean(entry?.item.unmuck))
          .length > 0 || readSnapshotRoadAheadLocalHarthmereMuckClearingTool();
      if (hasMuckBuster) {
        advanceSnapshotRoadAhead(gardenHose, "muck buster acquired", resources);
      }
    }, [gardenHose, inventory, resources, state, userId]);

    useEffect(() => {
      const { mission, step, completed } = getMissionStep(state);
      if (!state.accepted || completed) {
        if (completed) {
          mapManager.removeNavigationAid?.(SNAPSHOT_MISSION_NAV_AID_ID);
        }
        return;
      }
      const targetPos = snapshotTargetPosition(
        snapshotStepTargetKind(step),
        jackiePosition
      );
      pinSnapshotMissionTarget(mapManager, targetPos);
      writeSnapshotMissionState({
        ...state,
        pinned: [...new Set([...state.pinned, mission.id])],
      });
    }, [jackiePosition, mapManager, state.accepted, state.currentStepIndex]);

    useEffect(() => {
      const { step, completed } = getMissionStep(state);
      if (
        !state.accepted ||
        completed ||
        snapshotStepRuntimeTrigger(step) !== "place_voxel"
      ) {
        return;
      }
      const selected = selection as any;
      if (selected?.item?.isBlock) {
        recordSnapshotMissionEvent(
          "progress",
          step.title,
          `Block selected: ${
            selected.item.displayName ?? "selected block"
          }. Place it on the ground to continue.`
        );
      }
    }, [selection, state]);

    return null;
  };

function useSnapshotMissionState() {
  const [state, setState] = useState<SnapshotMissionState>(() =>
    readSnapshotMissionState()
  );
  useEffect(() => {
    const refresh = () => setState(readSnapshotMissionState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
    };
  }, []);
  return state;
}

export function useSnapshotMissionDialog(
  talkingToNPCId: BiomesId,
  defaultDialog: string
):
  | {
      id: string;
      dialogText: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const { gardenHose, mapManager, resources } = useClientContext();
  const jackiePosition = useJackiePosition();
  const [state, setState] = useState<SnapshotMissionState>(() =>
    readSnapshotMissionState()
  );

  useEffect(() => {
    const refresh = () => setState(readSnapshotMissionState());
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT, refresh);
    };
  }, []);

  return useMemo(() => {
    if (talkingToNPCId !== JACKIE_ID) {
      return undefined;
    }

    const { mission, step, stepIndex, completed } = getMissionStep(state);
    const targetPos = snapshotTargetPosition(
      snapshotStepTargetKind(step),
      jackiePosition
    );
    const pinCurrentTarget = () => {
      pinSnapshotMissionTarget(mapManager, targetPos);
      writeSnapshotMissionState({
        ...readSnapshotMissionState(),
        pinned: [...new Set([...state.pinned, mission.id])],
      });
    };

    if (!state.accepted) {
      return {
        id: `${SNAPSHOT_MISSION_BRIDGE_VERSION}-${mission.id}-offer`,
        dialogText:
          `<text>Jackie studies the road behind you, then points toward the old marker beyond the Grove.</text>` +
          `<text>The road is open, but it is not kind. I can mark the first post for you.</text>` +
          `<text>Follow the marker. Clear what blocks the path, place what the road needs, gear up, move fast, take proof, and carry a tool that can cut through muck.</text>`,
        actions: [
          {
            name: "Ask about the road",
            type: "primary",
            tooltip: "Starts Road Ahead.",
            onPerformed: () => {
              acceptSnapshotRoadAheadMission(gardenHose, resources);
              const nextStep = mission.steps[1];
              if (nextStep) {
                pinSnapshotMissionTarget(
                  mapManager,
                  snapshotTargetPosition(
                    snapshotStepTargetKind(nextStep),
                    jackiePosition
                  )
                );
              }
            },
          },
          {
            name: "Mark Jackie on map",
            type: "normal",
            onPerformed: () => {
              const nextStep = mission.steps[1];
              pinSnapshotMissionTarget(
                mapManager,
                snapshotTargetPosition(
                  nextStep ? snapshotStepTargetKind(nextStep) : "road_marker",
                  jackiePosition
                )
              );
            },
          },
        ],
      };
    }

    if (completed) {
      return {
        id: `${SNAPSHOT_MISSION_BRIDGE_VERSION}-${mission.id}-complete`,
        dialogText:
          `<text>Jackie gives you a short nod.</text>` +
          `<text>Road Ahead is complete. You handled the travel basics; the Grove still has more safe lessons before the wider road.</text>` +
          `<text>${SNAPSHOT_GROVE_NEXT_LESSONS_COPY}</text>` +
          `<text>Stay inside the Grove safe-zone for practice. Wild claims outside the lamps and patrol banners are a different risk.</text>`,
        actions: [
          {
            name: "Mark Luis's builder lesson",
            type: "primary",
            onPerformed: () => {
              const marker = snapshotGroveLandmarkById("npc_luis");
              if (marker) {
                pinSnapshotMissionTarget(mapManager, marker.position);
              }
            },
          },
          {
            name: "Mark Nia's guild lesson",
            type: "normal",
            onPerformed: () => {
              const marker = snapshotGroveLandmarkById("npc_guild_clerk_nia");
              if (marker) {
                pinSnapshotMissionTarget(mapManager, marker.position);
              }
            },
          },
          {
            name: "Mark the road again",
            type: "normal",
            onPerformed: pinCurrentTarget,
          },
        ],
      };
    }

    const currentStepIsReturn = step.id === "return_to_jackie";
    const actions: TalkDialogStepAction[] = [
      {
        name: "Mark next stop",
        type: "normal",
        tooltip: step.mapHint,
        onPerformed: pinCurrentTarget,
      },
    ];

    return {
      id: `${SNAPSHOT_MISSION_BRIDGE_VERSION}-${mission.id}-${step.id}-${stepIndex}`,
      dialogText:
        `<text>${
          step.jackieLine ?? "The next stop is marked on your map."
        }</text>` +
        (currentStepIsReturn
          ? `<text>You made it back. Talk with me here, and I will sign off before you continue with Luis and Nia.</text>`
          : `<text>I marked ${step.targetLabel}. Go there and do the road practice for real; the tracker will change when it sees the work done.</text>`),
      actions,
    };
  }, [
    defaultDialog,
    gardenHose,
    jackiePosition,
    mapManager,
    resources,
    state,
    talkingToNPCId,
  ]);
}

export const SnapshotMissionMapHUD: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const jackiePosition = useJackiePosition();
  const state = useSnapshotMissionState();
  const { mission, step, stepIndex, completed } = getMissionStep(state);
  const targetPos = snapshotTargetPosition(
    snapshotStepTargetKind(step),
    jackiePosition
  );
  const playerPos = localPlayer.player.position as Vec3;
  const dx = targetPos[0] - playerPos[0];
  const dz = targetPos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirection(dx, dz);
  const status = completed
    ? "Completed"
    : !state.accepted
    ? "Available"
    : `Step ${stepIndex}/${mission.steps.length - 1}`;

  return (
    <div className="rounded-xl border-emerald-200/20 bg-emerald-950/35 border p-2 text-white shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-emerald-100 text-sm font-bold uppercase tracking-wide">
            Road Ahead
          </div>
          <div className="text-xs text-white/70">The Grove · {status}</div>
        </div>
        {state.accepted && !completed && (
          <div className="rounded bg-emerald-300/20 px-1.5 py-0.5 text-emerald-100 text-xs font-semibold">
            {distance}m {direction}
          </div>
        )}
      </div>
      <div className="text-white/85 mt-1 text-xs leading-snug">
        <span className="text-emerald-100 font-semibold">
          {completed ? "Done:" : !state.accepted ? "Begin:" : `${step.title}:`}
        </span>{" "}
        {completed
          ? "Road Ahead is complete. Next: Luis teaches build/repair/land, then Nia teaches guilds."
          : !state.accepted
          ? "Talk to Jackie in The Grove."
          : step.objective}
      </div>
      {state.accepted && !completed && (
        <div className="text-white/65 mt-1 text-[11px] leading-snug">
          {step.mapHint}
        </div>
      )}
      <button
        className="rounded bg-emerald-300/20 text-emerald-100 hover:bg-emerald-300/30 mt-2 px-2 py-1 text-[11px] font-semibold"
        onClick={() => pinSnapshotMissionTarget(mapManager, targetPos)}
      >
        Mark objective
      </button>
    </div>
  );
};

export const SnapshotMissionJournalPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotMissionState();
  const { mission, step, stepIndex, completed } = getMissionStep(state);
  const events = readSnapshotMissionEvents();
  const status = completed
    ? "Completed"
    : !state.accepted
    ? "Available"
    : `In Progress · ${stepIndex}/${mission.steps.length - 1}`;

  return (
    <div className="rounded border-emerald-200/20 bg-emerald-950/30 border p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">
            {mission.title}
          </div>
          <div className="text-emerald-100/80 text-[10px] uppercase tracking-wide">
            Road Lesson · {mission.district}
          </div>
        </div>
        <div className="text-emerald-100 text-xs font-semibold">{status}</div>
      </div>
      <div className="text-white/85 mt-1 text-xs leading-snug">
        {completed
          ? SNAPSHOT_GROVE_NEXT_LESSONS_COPY
          : state.accepted
          ? step.objective
          : mission.summary}
      </div>
      {state.accepted && !completed && (
        <>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Target:</span>{" "}
            {step.targetLabel}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">
              How it advances:
            </span>{" "}
            {roadAheadStepCopy(mission, step, stepIndex).howItCompletes}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Reward:</span>{" "}
            {step.reward}
          </div>
        </>
      )}
      {!!state.rewards.length && (
        <div className="rounded p-1.5 text-white/65 mt-2 bg-black/20 text-[11px] leading-snug">
          <div className="text-emerald-100 font-semibold">Earned</div>
          {state.rewards.slice(-3).map((reward) => (
            <div key={reward}>• {reward}</div>
          ))}
        </div>
      )}
      {!!events.length && (
        <div className="mt-2 text-[10px] leading-snug text-white/50">
          Latest: {events[0].detail}
        </div>
      )}
    </div>
  );
};
