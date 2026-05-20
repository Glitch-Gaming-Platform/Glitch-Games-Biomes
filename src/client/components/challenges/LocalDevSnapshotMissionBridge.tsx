import { getOwnedItems } from "@/client/components/inventory/helpers";
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { awardHarthmereQuestXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import {
  GENESIS_CROSSROADS_LOCATION,
  JACKIE_ID,
  NUX_PAIRED_STEPS,
} from "@/client/util/nux/state_machines";
import { BikkieIds } from "@/shared/bikkie/ids";
import { Wearing } from "@/shared/ecs/gen/components";
import { isFloraId } from "@/shared/game/ids";
import { matchingItemRefs } from "@/shared/game/inventory";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_MISSION_BRIDGE_VERSION_V71 =
  "snapshot-road-ahead-full-chain-v73";

export const SNAPSHOT_MISSION_BRIDGE_PRODUCTION_COPY_V72 =
  "snapshot-road-ahead-production-dialogue-v73";

export const SNAPSHOT_ROAD_AHEAD_FULL_CHAIN_VERSION_V73 =
  "snapshot-road-ahead-full-chain-v73";

export const SNAPSHOT_MISSION_STATE_KEY_V71 =
  "biomes.localDev.snapshotMissionState.v73";

export const SNAPSHOT_MISSION_STATE_EVENT_V71 =
  "biomes:local-dev-snapshot-mission-state-v73";

export const SNAPSHOT_MISSION_NAV_AID_ID_V71 = 710_073;

const SNAPSHOT_MISSION_EVENTS_KEY_V73 =
  "biomes.localDev.snapshotMissionEvents.v73";

const SNAPSHOT_MISSION_REWARDS_KEY_V73 =
  "biomes.localDev.snapshotMissionRewards.v73";

const SNAPSHOT_MISSION_TITLE_V73 = "Road Ahead";
const SNAPSHOT_MISSION_ID_V73 = "snapshot_road_ahead_full_chain";
const SNAPSHOT_MISSION_XP_ID_V73 = "snapshot-road-ahead-v73";

type SnapshotMissionTargetKindV73 =
  | "jackie"
  | "grove"
  | "road_marker"
  | "muckwad_patch"
  | "building_spot"
  | "wardrobe"
  | "jump_run"
  | "selfie_overlook"
  | "crafting_stop";

type SnapshotMissionTriggerKindV73 =
  | "dialog"
  | "location"
  | "destroy"
  | "place_voxel"
  | "wearing"
  | "running_jump"
  | "photo"
  | "craft_muck_buster";

export interface SnapshotMissionStepV71 {
  id: string;
  challengeStepId?: BiomesId;
  title: string;
  objective: string;
  mapHint: string;
  completion: string;
  reward: string;
  targetLabel: string;
  target: SnapshotMissionTargetKindV73;
  trigger: SnapshotMissionTriggerKindV73;
  arrivalRadius?: number;
  jackieLine?: string;
}

export interface SnapshotMissionDefinitionV71 {
  id: string;
  title: string;
  source: "snapshot_nux_challenge_bridge";
  giverEntityId: BiomesId;
  district: string;
  summary: string;
  reward: string;
  steps: SnapshotMissionStepV71[];
}

export interface SnapshotMissionStateV71 {
  accepted: boolean;
  active: Record<string, number>;
  currentStepIndex: number;
  completedStepIds: string[];
  completed: string[];
  pinned: string[];
  rewards: string[];
  updatedAt?: number;
}

type SnapshotMissionEventV73 = {
  at: number;
  title: string;
  detail: string;
  kind: "accepted" | "progress" | "completed" | "reward";
};

const EMPTY_SNAPSHOT_MISSION_STATE_V73: SnapshotMissionStateV71 = {
  accepted: false,
  active: {},
  currentStepIndex: 0,
  completedStepIds: [],
  completed: [],
  pinned: [],
  rewards: [],
};

export const SNAPSHOT_MISSIONS_V71: SnapshotMissionDefinitionV71[] = [
  {
    id: SNAPSHOT_MISSION_ID_V73,
    title: SNAPSHOT_MISSION_TITLE_V73,
    source: "snapshot_nux_challenge_bridge",
    giverEntityId: JACKIE_ID,
    district: "The Grove",
    summary:
      "Follow Jackie's road out of The Grove and complete the first survival lessons from the snapshot tutorial chain.",
    reward:
      "Road Ready milestone, starter route progress, and experience for each completed lesson.",
    steps: [
      {
        id: "meet_jackie_in_grove",
        title: "Meet Jackie",
        objective: "Speak with Jackie in The Grove.",
        mapHint: "Jackie is your first contact in The Grove.",
        completion: "Jackie marks the road out of The Grove.",
        reward: "The Road Ahead route is added to your journal.",
        targetLabel: "Jackie",
        target: "jackie",
        trigger: "dialog",
        jackieLine:
          "You found me. Good. If you're heading out, don't wander blind. I marked the first road marker for you.",
      },
      {
        id: "road_ahead_meet_up_with_billy",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_MEET_UP_WITH_BILLY as BiomesId,
        title: "Find the Road Marker",
        objective: "Follow Jackie's marker to the old Grove road post.",
        mapHint:
          "Open the map or follow the beam out of The Grove. The marker completes when you reach it.",
        completion: "You reached the first road marker.",
        reward: "Route sense gained. +35 XP.",
        targetLabel: "Old Grove Road Post",
        target: "road_marker",
        trigger: "location",
        arrivalRadius: 9,
        jackieLine:
          "The first marker is just outside the Grove path. Reach it first; then I'll know you can follow a trail.",
      },
      {
        id: "road_ahead_collect_muckwad",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD as BiomesId,
        title: "Break Muckwad",
        objective: "Break a muckwad or another soft non-flora block near the road.",
        mapHint:
          "Use your break action on terrain, not flowers or decorative plants.",
        completion: "You broke through the muck blocking the path.",
        reward: "Muck handling practice. +35 XP.",
        targetLabel: "Muckwad Patch",
        target: "muckwad_patch",
        trigger: "destroy",
        jackieLine:
          "Roads don't stay clean. If muckwad is in your way, break it down and keep moving.",
      },
      {
        id: "road_ahead_place_blocks",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_PLACE_BLOCKS as BiomesId,
        title: "Place a Block",
        objective: "Equip any block and place it on the ground.",
        mapHint:
          "Select a block from the hotbar, then use the place action at the marked practice spot.",
        completion: "You placed a block and proved you can patch the road.",
        reward: "Builder footing practice. +35 XP.",
        targetLabel: "Building Practice Spot",
        target: "building_spot",
        trigger: "place_voxel",
        jackieLine:
          "A traveler who can place a block can cross a gap, fix a step, or make a way back home.",
      },
      {
        id: "road_ahead_wear",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR as BiomesId,
        title: "Gear Up",
        objective: "Wear a top and bottoms from your inventory.",
        mapHint:
          "Open Inventory and equip both clothing slots. If you already have them on, this completes automatically.",
        completion: "You are dressed for the road.",
        reward: "Prepared traveler practice. +35 XP.",
        targetLabel: "Inventory",
        target: "wardrobe",
        trigger: "wearing",
        jackieLine:
          "The road is easier when your kit is actually on you. Check your pack and put your gear where it belongs.",
      },
      {
        id: "road_ahead_find_bag",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_FIND_BAG as BiomesId,
        title: "Run and Jump",
        objective: "Hold sprint and jump while moving.",
        mapHint:
          "Use this at the marked stretch of road. The lesson completes on a running jump.",
        completion: "You cleared the road jump.",
        reward: "Movement practice. +35 XP.",
        targetLabel: "Road Jump Stretch",
        target: "jump_run",
        trigger: "running_jump",
        jackieLine:
          "Sometimes the road breaks under you. Learn to sprint before you need it.",
      },
      {
        id: "road_ahead_selfie",
        challengeStepId: NUX_PAIRED_STEPS.ROAD_AHEAD_SELFIE as BiomesId,
        title: "Take a Road Photo",
        objective: "Equip the camera, flip to selfie mode, and post a photo.",
        mapHint:
          "The photo lesson completes when you attempt to post from the camera flow.",
        completion: "You documented your first road stop.",
        reward: "Photo practice. +35 XP.",
        targetLabel: "Selfie Overlook",
        target: "selfie_overlook",
        trigger: "photo",
        jackieLine:
          "Take a picture before the road takes your nerve. Proof helps when stories get bigger later.",
      },
      {
        id: "busted_wooden_axe",
        challengeStepId: NUX_PAIRED_STEPS.BUSTED_WOODEN_AXE as BiomesId,
        title: "Gather Repair Wood",
        objective: "Break one more soft block or loose timber for repair material.",
        mapHint:
          "Gather one more piece of breakable terrain for field repairs.",
        completion: "You gathered enough rough material for a field repair.",
        reward: "Repair material practice. +35 XP.",
        targetLabel: "Loose Timber",
        target: "muckwad_patch",
        trigger: "destroy",
        jackieLine:
          "Tools break. Roads break. The trick is learning how to keep moving with whatever the Grove gives you.",
      },
      {
        id: "busted_muck_busters",
        challengeStepId: NUX_PAIRED_STEPS.BUSTED_MUCK_BUSTERS as BiomesId,
        title: "Craft a Muck Buster",
        objective: "Open Recipes and craft or obtain a Muck Buster.",
        mapHint:
          "Crafting completes when your inventory contains any item that can clear muck.",
        completion: "You have a tool that can clear the dirty road ahead.",
        reward: "Muck Buster practice. +35 XP.",
        targetLabel: "Crafting Stop",
        target: "crafting_stop",
        trigger: "craft_muck_buster",
        jackieLine:
          "Before you leave for real, make sure you can clear muck instead of just complaining about it.",
      },
      {
        id: "return_to_jackie",
        title: "Report Back",
        objective: "Return to Jackie in The Grove.",
        mapHint: "Jackie will close out the Road Ahead chain.",
        completion: "Jackie signs off on your first road lessons.",
        reward: "Road Ready milestone. +140 XP.",
        targetLabel: "Jackie",
        target: "jackie",
        trigger: "dialog",
        jackieLine:
          "You made it back with the basics handled. Keep your eyes open from here on out.",
      },
    ],
  },
];

const SNAPSHOT_MISSION_TARGET_OFFSETS_V73: Record<
  Exclude<SnapshotMissionTargetKindV73, "jackie">,
  Vec3
> = {
  grove: [GENESIS_CROSSROADS_LOCATION[0], 54, GENESIS_CROSSROADS_LOCATION[1]],
  road_marker: [500, 54, -140],
  muckwad_patch: [512, 54, -152],
  building_spot: [528, 54, -152],
  wardrobe: [GENESIS_CROSSROADS_LOCATION[0], 54, GENESIS_CROSSROADS_LOCATION[1]],
  jump_run: [548, 54, -170],
  selfie_overlook: [560, 54, -182],
  crafting_stop: [GENESIS_CROSSROADS_LOCATION[0] + 8, 54, GENESIS_CROSSROADS_LOCATION[1] - 4],
};

function isBrowserV71() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function cloneStateV73(state: SnapshotMissionStateV71): SnapshotMissionStateV71 {
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

function firstSnapshotMissionV71() {
  return SNAPSHOT_MISSIONS_V71[0];
}

function normalizeSnapshotMissionStateV73(
  parsed: Partial<SnapshotMissionStateV71> | undefined,
): SnapshotMissionStateV71 {
  if (!parsed) {
    return cloneStateV73(EMPTY_SNAPSHOT_MISSION_STATE_V73);
  }
  const legacyActiveStep = parsed.active?.[SNAPSHOT_MISSION_ID_V73];
  const currentStepIndex = Math.max(
    0,
    Math.min(
      firstSnapshotMissionV71().steps.length - 1,
      Number.isFinite(parsed.currentStepIndex)
        ? Number(parsed.currentStepIndex)
        : legacyActiveStep ?? 0,
    ),
  );
  const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
  return {
    accepted: Boolean(parsed.accepted || parsed.active?.[SNAPSHOT_MISSION_ID_V73] !== undefined),
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

export function readSnapshotMissionStateV71(): SnapshotMissionStateV71 {
  if (!isBrowserV71()) {
    return cloneStateV73(EMPTY_SNAPSHOT_MISSION_STATE_V73);
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_MISSION_STATE_KEY_V71);
    return normalizeSnapshotMissionStateV73(
      raw ? (JSON.parse(raw) as Partial<SnapshotMissionStateV71>) : undefined,
    );
  } catch {
    return cloneStateV73(EMPTY_SNAPSHOT_MISSION_STATE_V73);
  }
}

export function writeSnapshotMissionStateV71(state: SnapshotMissionStateV71) {
  if (!isBrowserV71()) {
    return;
  }
  const next = normalizeSnapshotMissionStateV73({ ...state, updatedAt: Date.now() });
  window.localStorage.setItem(
    SNAPSHOT_MISSION_STATE_KEY_V71,
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event(SNAPSHOT_MISSION_STATE_EVENT_V71));
}

function readSnapshotMissionEventsV73(): SnapshotMissionEventV73[] {
  if (!isBrowserV71()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_MISSION_EVENTS_KEY_V73);
    return raw ? (JSON.parse(raw) as SnapshotMissionEventV73[]) : [];
  } catch {
    return [];
  }
}

function recordSnapshotMissionEventV73(
  kind: SnapshotMissionEventV73["kind"],
  title: string,
  detail: string,
) {
  if (!isBrowserV71()) {
    return;
  }
  const next = [
    { at: Date.now(), kind, title, detail },
    ...readSnapshotMissionEventsV73(),
  ].slice(0, 16);
  window.localStorage.setItem(SNAPSHOT_MISSION_EVENTS_KEY_V73, JSON.stringify(next));
  window.dispatchEvent(new Event(SNAPSHOT_MISSION_STATE_EVENT_V71));
}

function recordSnapshotMissionRewardV73(reward: string) {
  if (!isBrowserV71()) {
    return;
  }
  const state = readSnapshotMissionStateV71();
  if (state.rewards.includes(reward)) {
    return;
  }
  writeSnapshotMissionStateV71({
    ...state,
    rewards: [...state.rewards, reward],
  });
  const existing = (() => {
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_MISSION_REWARDS_KEY_V73);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })();
  window.localStorage.setItem(
    SNAPSHOT_MISSION_REWARDS_KEY_V73,
    JSON.stringify([...new Set([reward, ...existing])].slice(0, 20)),
  );
  recordSnapshotMissionEventV73("reward", SNAPSHOT_MISSION_TITLE_V73, reward);
}

function isMissionCompletedV73(state: SnapshotMissionStateV71) {
  return state.completed.includes(SNAPSHOT_MISSION_ID_V73);
}

function getMissionStepV71(state: SnapshotMissionStateV71) {
  const mission = firstSnapshotMissionV71();
  const completed = isMissionCompletedV73(state);
  const stepIndex = completed
    ? mission.steps.length - 1
    : Math.max(0, Math.min(state.currentStepIndex, mission.steps.length - 1));
  return {
    mission,
    stepIndex,
    activeStepIndex: state.accepted && !completed ? stepIndex : undefined,
    completed,
    step: mission.steps[stepIndex] ?? mission.steps[0],
  };
}

function groveFallbackPositionV71(y = 54): Vec3 {
  return [GENESIS_CROSSROADS_LOCATION[0], y, GENESIS_CROSSROADS_LOCATION[1]];
}

function useJackiePositionV71(): Vec3 {
  const { reactResources } = useClientContext();
  const [position] = reactResources.useAll(["/ecs/c/position", JACKIE_ID]);
  return (position?.v ? [...position.v] : groveFallbackPositionV71()) as Vec3;
}

function snapshotTargetPositionV71(
  target: SnapshotMissionTargetKindV73,
  jackiePosition: ReadonlyVec3,
): Vec3 {
  if (target === "jackie") {
    return [...jackiePosition] as Vec3;
  }
  const base = SNAPSHOT_MISSION_TARGET_OFFSETS_V73[target];
  if (!base) {
    return groveFallbackPositionV71(jackiePosition[1]);
  }
  return [base[0], jackiePosition[1] ?? base[1], base[2]];
}

function compassDirectionV71(dx: number, dz: number) {
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

function challengeTriggerProgressV73(step: SnapshotMissionStepV71, complete: boolean) {
  return {
    id: step.challengeStepId ?? (0 as BiomesId),
    name: step.title,
    progressPercentage: complete ? 1 : 0,
    progressString: complete ? step.completion : step.objective,
    payload: { kind: "leaf" },
    children: [],
  } as any;
}

function publishStepBeginV73(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  step: SnapshotMissionStepV71,
) {
  if (!step.challengeStepId) {
    return;
  }
  gardenHose.publish({
    kind: "challenge_step_begin",
    stepId: step.challengeStepId,
    triggerProgress: challengeTriggerProgressV73(step, false),
  } as GardenHoseEvent);
}

function publishStepCompleteV73(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  step: SnapshotMissionStepV71,
) {
  if (!step.challengeStepId) {
    return;
  }
  gardenHose.publish({
    kind: "challenge_step_complete",
    stepId: step.challengeStepId,
    triggerProgress: challengeTriggerProgressV73(step, true),
  } as GardenHoseEvent);
}

export function pinSnapshotMissionTargetV71(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  targetPos: ReadonlyVec3,
  id = SNAPSHOT_MISSION_NAV_AID_ID_V71,
) {
  mapManager.removeNavigationAid?.(id);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      autoremoveWhenNear: false,
      target: {
        kind: "position",
        position: [...targetPos],
      },
    },
    id,
  );
}

function acceptSnapshotRoadAheadMissionV73(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
) {
  const mission = firstSnapshotMissionV71();
  const firstRoadStepIndex = 1;
  const firstRoadStep = mission.steps[firstRoadStepIndex];
  const next: SnapshotMissionStateV71 = {
    accepted: true,
    active: { [mission.id]: firstRoadStepIndex },
    currentStepIndex: firstRoadStepIndex,
    completedStepIds: [mission.steps[0].id],
    completed: [],
    pinned: [mission.id],
    rewards: [],
    updatedAt: Date.now(),
  };
  writeSnapshotMissionStateV71(next);
  recordSnapshotMissionEventV73(
    "accepted",
    mission.title,
    "Jackie marked the road out of The Grove.",
  );
  recordSnapshotMissionRewardV73(mission.steps[0].reward);
  if (firstRoadStep) {
    publishStepBeginV73(gardenHose, firstRoadStep);
  }
}

function advanceSnapshotRoadAheadV73(
  gardenHose: { publish: (event: GardenHoseEvent) => void },
  reason: string,
) {
  const mission = firstSnapshotMissionV71();
  const state = readSnapshotMissionStateV71();
  if (!state.accepted || isMissionCompletedV73(state)) {
    return;
  }
  const stepIndex = Math.max(1, Math.min(state.currentStepIndex, mission.steps.length - 1));
  const step = mission.steps[stepIndex];
  if (!step || state.completedStepIds.includes(step.id)) {
    return;
  }

  const completedStepIds = [...new Set([...state.completedStepIds, step.id])];
  const completedMission = stepIndex >= mission.steps.length - 1;
  publishStepCompleteV73(gardenHose, step);
  recordSnapshotMissionEventV73(
    completedMission ? "completed" : "progress",
    step.title,
    `${step.completion} (${reason})`,
  );
  recordSnapshotMissionRewardV73(step.reward);
  awardHarthmereQuestXp(SNAPSHOT_MISSION_XP_ID_V73, mission.title, completedMission);

  if (completedMission) {
    const active = { ...state.active };
    delete active[mission.id];
    writeSnapshotMissionStateV71({
      ...state,
      active,
      completedStepIds,
      completed: [...new Set([...state.completed, mission.id])],
      currentStepIndex: stepIndex,
      updatedAt: Date.now(),
    });
    return;
  }

  const nextStepIndex = stepIndex + 1;
  const nextStep = mission.steps[nextStepIndex];
  writeSnapshotMissionStateV71({
    ...state,
    accepted: true,
    active: { ...state.active, [mission.id]: nextStepIndex },
    currentStepIndex: nextStepIndex,
    completedStepIds,
    pinned: [...new Set([...state.pinned, mission.id])],
    updatedAt: Date.now(),
  });
  if (nextStep) {
    publishStepBeginV73(gardenHose, nextStep);
  }
}

function shouldEventCompleteStepV73(
  step: SnapshotMissionStepV71,
  event: GardenHoseEvent,
) {
  switch (step.trigger) {
    case "dialog":
      return event.kind === "talk_npc" && event.npcId === JACKIE_ID;
    case "destroy":
      return event.kind === "destroy" && event.terrainId && !isFloraId(event.terrainId);
    case "place_voxel":
      return event.kind === "place_voxel";
    case "running_jump":
      return event.kind === "jump" && event.running;
    case "photo":
      return event.kind === "photo_post_attempt" || event.kind === "photo_post" || event.kind === "show_post_capture";
    default:
      return false;
  }
}

function hasRequiredClothingV73(wearing: ReturnType<typeof Wearing.create>) {
  return Boolean(wearing.items.get(BikkieIds.top) && wearing.items.get(BikkieIds.bottoms));
}

export const SnapshotMissionRuntimeControllerV71: React.FunctionComponent<{}> = () => {
  const { gardenHose, mapManager, reactResources, resources, userId } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const inventory = reactResources.use("/ecs/c/inventory", userId);
  const wearing = reactResources.use("/ecs/c/wearing", userId) ?? Wearing.create();
  const selection = reactResources.use("/hotbar/selection");
  const jackiePosition = useJackiePositionV71();
  const [state, setState] = useState<SnapshotMissionStateV71>(() => readSnapshotMissionStateV71());

  useEffect(() => {
    const refresh = () => setState(readSnapshotMissionStateV71());
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    };
  }, []);

  useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      const current = readSnapshotMissionStateV71();
      const { step, completed } = getMissionStepV71(current);
      if (!current.accepted || completed) {
        return;
      }
      if (shouldEventCompleteStepV73(step, event)) {
        advanceSnapshotRoadAheadV73(gardenHose, event.kind);
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [gardenHose]);

  useEffect(() => {
    const { step, completed } = getMissionStepV71(state);
    if (!state.accepted || completed || step.trigger !== "location") {
      return;
    }
    const playerPos = localPlayer.player.position as Vec3;
    const targetPos = snapshotTargetPositionV71(step.target, jackiePosition);
    const distance = Math.hypot(targetPos[0] - playerPos[0], targetPos[2] - playerPos[2]);
    if (distance <= (step.arrivalRadius ?? 8)) {
      advanceSnapshotRoadAheadV73(gardenHose, "arrived at marker");
    }
  }, [gardenHose, jackiePosition, localPlayer.player.position, state]);

  useEffect(() => {
    const { step, completed } = getMissionStepV71(state);
    if (!state.accepted || completed || step.trigger !== "wearing") {
      return;
    }
    if (hasRequiredClothingV73(wearing)) {
      advanceSnapshotRoadAheadV73(gardenHose, "gear equipped");
    }
  }, [gardenHose, state, wearing]);

  useEffect(() => {
    const { step, completed } = getMissionStepV71(state);
    if (!state.accepted || completed || step.trigger !== "craft_muck_buster") {
      return;
    }
    const ownedItems = getOwnedItems(resources, userId);
    const hasMuckBuster =
      matchingItemRefs(ownedItems, (entry) => Boolean(entry?.item.unmuck)).length > 0;
    if (hasMuckBuster) {
      advanceSnapshotRoadAheadV73(gardenHose, "muck buster acquired");
    }
  }, [gardenHose, inventory, resources, state, userId]);

  useEffect(() => {
    const { mission, step, completed } = getMissionStepV71(state);
    if (!state.accepted || completed) {
      return;
    }
    const targetPos = snapshotTargetPositionV71(step.target, jackiePosition);
    pinSnapshotMissionTargetV71(mapManager, targetPos);
    writeSnapshotMissionStateV71({
      ...state,
      pinned: [...new Set([...state.pinned, mission.id])],
    });
  }, [jackiePosition, mapManager, state.accepted, state.currentStepIndex]);

  useEffect(() => {
    const { step, completed } = getMissionStepV71(state);
    if (!state.accepted || completed || step.trigger !== "place_voxel") {
      return;
    }
    const selected = selection as any;
    if (selected?.item?.isBlock) {
      recordSnapshotMissionEventV73(
        "progress",
        step.title,
        `Block selected: ${selected.item.displayName ?? "selected block"}. Place it on the ground to continue.`,
      );
    }
  }, [selection, state]);

  return null;
};

function useSnapshotMissionStateV71() {
  const [state, setState] = useState<SnapshotMissionStateV71>(() => readSnapshotMissionStateV71());
  useEffect(() => {
    const refresh = () => setState(readSnapshotMissionStateV71());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    };
  }, []);
  return state;
}

export function useSnapshotMissionDialogV71(
  talkingToNPCId: BiomesId,
  defaultDialog: string,
):
  | {
      id: string;
      dialogText: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const { gardenHose, mapManager } = useClientContext();
  const jackiePosition = useJackiePositionV71();
  const [state, setState] = useState<SnapshotMissionStateV71>(() => readSnapshotMissionStateV71());

  useEffect(() => {
    const refresh = () => setState(readSnapshotMissionStateV71());
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT_V71, refresh);
    };
  }, []);

  return useMemo(() => {
    if (talkingToNPCId !== JACKIE_ID) {
      return undefined;
    }

    const { mission, step, stepIndex, completed } = getMissionStepV71(state);
    const targetPos = snapshotTargetPositionV71(step.target, jackiePosition);
    const pinCurrentTarget = () => {
      pinSnapshotMissionTargetV71(mapManager, targetPos);
      writeSnapshotMissionStateV71({
        ...readSnapshotMissionStateV71(),
        pinned: [...new Set([...state.pinned, mission.id])],
      });
    };

    if (!state.accepted) {
      return {
        id: `${SNAPSHOT_MISSION_BRIDGE_VERSION_V71}-${mission.id}-offer`,
        dialogText:
          `<text>Jackie studies the road behind you, then points toward the old marker beyond the Grove.</text>` +
          `<text>The road is open, but it is not kind. I can mark the first post for you.</text>` +
          `<text>Follow the marker. Clear what blocks the path, place what the road needs, gear up, move fast, take proof, and carry a tool that can cut through muck.</text>`,
        actions: [
          {
            name: "Start Road Ahead",
            type: "primary",
            tooltip: "Starts Road Ahead.",
            onPerformed: () => {
              acceptSnapshotRoadAheadMissionV73(gardenHose);
              const nextStep = mission.steps[1];
              if (nextStep) {
                pinSnapshotMissionTargetV71(
                  mapManager,
                  snapshotTargetPositionV71(nextStep.target, jackiePosition),
                );
              }
            },
          },
          {
            name: "Mark the road",
            type: "normal",
            onPerformed: () => {
              const nextStep = mission.steps[1];
              pinSnapshotMissionTargetV71(
                mapManager,
                snapshotTargetPositionV71(nextStep?.target ?? "road_marker", jackiePosition),
              );
            },
          },
        ],
      };
    }

    if (completed) {
      return {
        id: `${SNAPSHOT_MISSION_BRIDGE_VERSION_V71}-${mission.id}-complete`,
        dialogText:
          `<text>Jackie gives you a short nod.</text>` +
          `<text>You handled the road lessons. You can move, build, gear up, take proof, and carry a Muck Buster. That is enough to leave The Grove without being helpless.</text>` +
          `<text>Keep the map marked and keep your tools close.</text>`,
        actions: [
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

    if (step.trigger === "craft_muck_buster") {
      actions.push({
        name: "Ask for a practice Muck Buster",
        type: "primary",
        tooltip:
          "Use this only if the crafting recipe is unavailable in the current snapshot build.",
        onPerformed: () => advanceSnapshotRoadAheadV73(gardenHose, "Jackie issued a practice Muck Buster"),
      });
    }

    return {
      id: `${SNAPSHOT_MISSION_BRIDGE_VERSION_V71}-${mission.id}-${step.id}-${stepIndex}`,
      dialogText:
        `<text>${step.jackieLine ?? "The next stop is marked on your map."}</text>` +
        (currentStepIsReturn
          ? `<text>You made it back. I can close out the route from here.</text>`
          : `<text>Follow the marker. The road will tell you what to practice next.</text>`),
      actions,
    };
  }, [defaultDialog, gardenHose, jackiePosition, mapManager, state, talkingToNPCId]);
}

export const SnapshotMissionMapHUDV71: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const jackiePosition = useJackiePositionV71();
  const state = useSnapshotMissionStateV71();
  const { mission, step, stepIndex, completed } = getMissionStepV71(state);
  const targetPos = snapshotTargetPositionV71(step.target, jackiePosition);
  const playerPos = localPlayer.player.position as Vec3;
  const dx = targetPos[0] - playerPos[0];
  const dz = targetPos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirectionV71(dx, dz);
  const status = completed
    ? "Completed"
    : !state.accepted
      ? "Available"
      : `Step ${stepIndex}/${mission.steps.length - 1}`;

  return (
    <div className="rounded-xl border border-emerald-200/20 bg-emerald-950/35 p-2 text-white shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-emerald-100">
            Road Ahead
          </div>
          <div className="text-xs text-white/70">
            The Grove · {status}
          </div>
        </div>
        {state.accepted && !completed && (
          <div className="rounded bg-emerald-300/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-100">
            {distance}m {direction}
          </div>
        )}
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        <span className="font-semibold text-emerald-100">
          {completed ? "Done:" : !state.accepted ? "Start:" : `${step.title}:`}
        </span>{" "}
        {completed
          ? "The Grove road lessons are complete."
          : !state.accepted
            ? "Talk to Jackie in The Grove."
            : step.objective}
      </div>
      {state.accepted && !completed && (
        <div className="mt-1 text-[11px] leading-snug text-white/65">
          {step.mapHint}
        </div>
      )}
      <button
        className="mt-2 rounded bg-emerald-300/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-300/30"
        onClick={() => pinSnapshotMissionTargetV71(mapManager, targetPos)}
      >
        Mark objective
      </button>
    </div>
  );
};

export const SnapshotMissionJournalPanelV71: React.FunctionComponent<{}> = () => {
  const state = useSnapshotMissionStateV71();
  const { mission, step, stepIndex, completed } = getMissionStepV71(state);
  const events = readSnapshotMissionEventsV73();
  const status = completed
    ? "Completed"
    : !state.accepted
      ? "Available"
      : `In Progress · ${stepIndex}/${mission.steps.length - 1}`;

  return (
    <div className="rounded border border-emerald-200/20 bg-emerald-950/30 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{mission.title}</div>
          <div className="text-[10px] uppercase tracking-wide text-emerald-100/80">
            Road Lesson · {mission.district}
          </div>
        </div>
        <div className="text-xs font-semibold text-emerald-100">{status}</div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        {completed ? "Road Ahead is complete." : state.accepted ? step.objective : mission.summary}
      </div>
      {state.accepted && !completed && (
        <>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Target:</span>{" "}
            {step.targetLabel}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Reward:</span>{" "}
            {step.reward}
          </div>
        </>
      )}
      {!!state.rewards.length && (
        <div className="mt-2 rounded bg-black/20 p-1.5 text-[11px] leading-snug text-white/65">
          <div className="font-semibold text-emerald-100">Earned</div>
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
