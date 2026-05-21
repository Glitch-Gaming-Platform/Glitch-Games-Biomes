import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import { JACKIE_ID } from "@/client/util/nux/state_machines";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION_V75,
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83,
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveGroundedPositionV75,
  snapshotGroveLandmarkByIdV75,
  snapshotGroveNpcEntityIdV75,
  snapshotGroveNpcIdFromEntityIdV75,
  type SnapshotGroveNpcV75,
  type SnapshotGroveQuestV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION_V75 =
  "snapshot-grove-bible-runtime-v100";

export const SNAPSHOT_GROVE_QUEST_STATE_KEY_V75 =
  "biomes.localDev.snapshotGroveQuestState.v75";

export const SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75 =
  "biomes:local-dev-snapshot-grove-quest-state-v75";

const SNAPSHOT_GROVE_LIKEABILITY_KEY_V75 =
  "biomes.localDev.snapshotGroveLikeability.v75";

const SNAPSHOT_GROVE_NAV_AID_ID_V75 = 750_075;

const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS_V100 = [
  "fountain_buttons_first",
  "painted_path_language",
  "road_ready_bag_check",
  "tools_before_treasure",
  "safe_sparring_not_pvp",
  "ready_check_at_fountain",
  "lost_found_and_mail",
] as const;

const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100 = new Set<string>(
  SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS_V100,
);

const SNAPSHOT_GROVE_QUEST_ID_SET_V100 = new Set(
  SNAPSHOT_GROVE_QUESTS_V75.map((quest) => quest.id),
);

const SNAPSHOT_GROVE_LIVE_LABEL_TO_PROFILE_ID_V103: Readonly<Record<string, string>> = {
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

const SNAPSHOT_GROVE_LIVE_LABEL_CONTAINS_V103: readonly [RegExp, string][] = [
  [/\bjackie\b/i, "jackie"],
  [/\brosalyn\b|\brosalie\b/i, "rosalyn"],
  [/\btaye\b/i, "taye"],
  [/\bnia\b|\bnina\b/i, "guild_clerk_nia"],
];

function normalizeSnapshotGroveLiveLabelV103(value: string | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function snapshotGroveNpcIdForDialogLabelV103(input: {
  label?: string;
  entityDescriptionText?: string;
  defaultDialog?: string;
}) {
  const label = normalizeSnapshotGroveLiveLabelV103(input.label);
  const exact = SNAPSHOT_GROVE_LIVE_LABEL_TO_PROFILE_ID_V103[label];
  if (exact) {
    return exact;
  }
  const text = [input.label, input.entityDescriptionText, input.defaultDialog]
    .filter(Boolean)
    .join(" ");
  for (const [pattern, npcId] of SNAPSHOT_GROVE_LIVE_LABEL_CONTAINS_V103) {
    if (pattern.test(text)) {
      return npcId;
    }
  }
  return undefined;
}

function dedupeKnownSnapshotGroveQuestIdsV100(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(
    value.filter(
      (item): item is string =>
        typeof item === "string" && SNAPSHOT_GROVE_QUEST_ID_SET_V100.has(item),
    ),
  )];
}

interface SnapshotGroveQuestStateV75 {
  acceptedQuestIds: string[];
  activeQuestId?: string;
  activeObjectiveIndex: number;
  completedQuestIds: string[];
  completedObjectiveIds: string[];
  rewards: string[];
  updatedAt?: number;
}

const EMPTY_SNAPSHOT_GROVE_QUEST_STATE_V75: SnapshotGroveQuestStateV75 = {
  acceptedQuestIds: [],
  activeObjectiveIndex: 0,
  completedQuestIds: [],
  completedObjectiveIds: [],
  rewards: [],
};

function isBrowserV75() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeSnapshotGroveQuestStateV75(
  parsed: Partial<SnapshotGroveQuestStateV75> | undefined,
): SnapshotGroveQuestStateV75 {
  const acceptedQuestIds = dedupeKnownSnapshotGroveQuestIdsV100(
    parsed?.acceptedQuestIds,
  );
  const completedQuestIds = dedupeKnownSnapshotGroveQuestIdsV100(
    parsed?.completedQuestIds,
  );
  const completedSet = new Set(completedQuestIds);
  const requestedActiveQuestId =
    typeof parsed?.activeQuestId === "string" &&
    SNAPSHOT_GROVE_QUEST_ID_SET_V100.has(parsed.activeQuestId)
      ? parsed.activeQuestId
      : undefined;
  const activeQuestId = requestedActiveQuestId && !completedSet.has(requestedActiveQuestId)
    ? requestedActiveQuestId
    : acceptedQuestIds.find((questId) => !completedSet.has(questId));
  const activeQuest = questByIdV75(activeQuestId);
  const rawObjectiveIndex = Number.isFinite(parsed?.activeObjectiveIndex)
    ? Math.max(0, Number(parsed?.activeObjectiveIndex))
    : 0;
  const activeObjectiveIndex = activeQuest
    ? Math.min(Math.max(0, activeQuest.objectives.length - 1), rawObjectiveIndex)
    : 0;

  return {
    acceptedQuestIds,
    activeQuestId,
    activeObjectiveIndex,
    completedQuestIds,
    completedObjectiveIds: Array.isArray(parsed?.completedObjectiveIds)
      ? [...new Set(parsed!.completedObjectiveIds.filter((item): item is string => typeof item === "string"))]
      : [],
    rewards: Array.isArray(parsed?.rewards)
      ? [...new Set(parsed!.rewards.filter((item): item is string => typeof item === "string"))]
      : [],
    updatedAt: parsed?.updatedAt,
  };
}


export function readSnapshotGroveQuestStateV75(): SnapshotGroveQuestStateV75 {
  if (!isBrowserV75()) {
    return { ...EMPTY_SNAPSHOT_GROVE_QUEST_STATE_V75 };
  }
  try {
    return normalizeSnapshotGroveQuestStateV75(
      JSON.parse(window.localStorage.getItem(SNAPSHOT_GROVE_QUEST_STATE_KEY_V75) || "null") || undefined,
    );
  } catch {
    return { ...EMPTY_SNAPSHOT_GROVE_QUEST_STATE_V75 };
  }
}

function writeSnapshotGroveQuestStateV75(state: SnapshotGroveQuestStateV75) {
  if (!isBrowserV75()) {
    return;
  }
  const next = { ...state, updatedAt: Date.now() };
  window.localStorage.setItem(SNAPSHOT_GROVE_QUEST_STATE_KEY_V75, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75));
}

function readSnapshotGroveLikeabilityV75(): Record<string, number> {
  if (!isBrowserV75()) {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_GROVE_LIKEABILITY_KEY_V75) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function recordSnapshotGroveLikeabilityV75(npcId: string, delta: number) {
  if (!isBrowserV75()) {
    return;
  }
  const current = readSnapshotGroveLikeabilityV75();
  current[npcId] = Math.max(-5, Math.min(10, Number(current[npcId] || 0) + delta));
  window.localStorage.setItem(SNAPSHOT_GROVE_LIKEABILITY_KEY_V75, JSON.stringify(current));
}

function questByIdV75(id: string | undefined) {
  return SNAPSHOT_GROVE_QUESTS_V75.find((quest) => quest.id === id);
}

function availableQuestsForNpcV101(npcId: string, state: SnapshotGroveQuestStateV75) {
  return SNAPSHOT_GROVE_QUESTS_V75.filter(
    (quest) =>
      quest.giverNpcId === npcId &&
      !state.completedQuestIds.includes(quest.id) &&
      !state.acceptedQuestIds.includes(quest.id),
  ).sort((a, b) => {
    const aTutorial = SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(a.id) ? 0 : 1;
    const bTutorial = SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(b.id) ? 0 : 1;
    return aTutorial - bTutorial;
  });
}

function firstAvailableQuestForNpcV75(npcId: string, state: SnapshotGroveQuestStateV75) {
  return availableQuestsForNpcV101(npcId, state)[0];
}

function activeQuestForNpcV75(npcId: string, state: SnapshotGroveQuestStateV75) {
  const active = questByIdV75(state.activeQuestId);
  if (active?.giverNpcId === npcId) {
    return active;
  }
  return SNAPSHOT_GROVE_QUESTS_V75.find(
    (quest) => quest.giverNpcId === npcId && state.acceptedQuestIds.includes(quest.id) && !state.completedQuestIds.includes(quest.id),
  );
}

function currentMarkerForQuestV75(quest: SnapshotGroveQuestV75, objectiveIndex: number) {
  if (!quest.markerIds.length) {
    return undefined;
  }
  const clamped = Math.max(0, Math.min(quest.markerIds.length - 1, objectiveIndex));
  return snapshotGroveLandmarkByIdV75(quest.markerIds[clamped]) ?? snapshotGroveLandmarkByIdV75(quest.markerIds[0]);
}

function pinSnapshotGroveLandmarkV75(
  mapManager: { addNavigationAid: (aid: any, id?: number) => number; removeNavigationAid?: (id: number) => void },
  position: Vec3,
) {
  mapManager.removeNavigationAid?.(SNAPSHOT_GROVE_NAV_AID_ID_V75);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      autoremoveWhenNear: true,
      target: { kind: "position", position: [...position] },
    },
    SNAPSHOT_GROVE_NAV_AID_ID_V75,
  );
}

function acceptSnapshotGroveQuestV75(quest: SnapshotGroveQuestV75, mapManager: any) {
  const state = readSnapshotGroveQuestStateV75();
  const next: SnapshotGroveQuestStateV75 = {
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: quest.id,
    activeObjectiveIndex: 0,
  };
  writeSnapshotGroveQuestStateV75(next);
  const marker = currentMarkerForQuestV75(quest, 0);
  if (marker) {
    pinSnapshotGroveLandmarkV75(mapManager, marker.position);
  }
}

function advanceSnapshotGroveQuestV75(quest: SnapshotGroveQuestV75, mapManager: any, reason: string) {
  const state = readSnapshotGroveQuestStateV75();
  if (state.completedQuestIds.includes(quest.id) || !quest.objectives.length) {
    return;
  }
  const safeObjectiveIndex = Math.max(
    0,
    Math.min(
      quest.objectives.length - 1,
      state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0,
    ),
  );
  const objectiveId = `${quest.id}:${safeObjectiveIndex}:${reason}`;
  const nextIndex = safeObjectiveIndex + 1;
  const completedQuest = nextIndex >= quest.objectives.length;
  const next: SnapshotGroveQuestStateV75 = {
    ...state,
    acceptedQuestIds: [...new Set([...state.acceptedQuestIds, quest.id])],
    activeQuestId: completedQuest ? undefined : quest.id,
    activeObjectiveIndex: completedQuest ? 0 : nextIndex,
    completedObjectiveIds: [...new Set([...state.completedObjectiveIds, objectiveId])],
    completedQuestIds: completedQuest
      ? [...new Set([...state.completedQuestIds, quest.id])]
      : state.completedQuestIds,
    rewards: completedQuest ? [...new Set([...state.rewards, `${quest.title}: ${quest.reward}`])] : state.rewards,
  };
  writeSnapshotGroveQuestStateV75(next);
  if (completedQuest) {
    mapManager.removeNavigationAid?.(SNAPSHOT_GROVE_NAV_AID_ID_V75);
    recordSnapshotGroveLikeabilityV75(quest.giverNpcId, 1);
  } else {
    const marker = currentMarkerForQuestV75(quest, nextIndex);
    if (marker) {
      pinSnapshotGroveLandmarkV75(mapManager, marker.position);
    }
  }
}


function currentTriggerForQuestV92(
  quest: SnapshotGroveQuestV75,
  objectiveIndex: number,
) {
  if (!quest.triggers.length) {
    return undefined;
  }
  return quest.triggers[
    Math.max(0, Math.min(quest.triggers.length - 1, objectiveIndex))
  ];
}

function doesEventMatchSnapshotGroveTriggerV92(
  event: GardenHoseEvent,
  trigger: string | undefined,
) {
  if (!trigger) {
    return false;
  }
  const kind = (event as any).kind;
  switch (trigger) {
    case "talk_npc":
      return kind === "talk_npc";
    case "near_location":
      return kind === "near_location";
    case "destroy":
      return kind === "destroy";
    case "place_voxel":
      return kind === "place_voxel";
    case "jump_run":
      return kind === "jump" && Boolean((event as any).running);
    case "photo_post":
      return kind === "photo_post_attempt" || kind === "photo_post" || kind === "show_post_capture";
    case "combat":
      return kind === "challenge_step_complete" || kind === "npc_killed" || kind === "npc_damage";
    case "choice":
    case "item_grant":
    case "open_tab":
    case "interact":
      // V93: do not let unrelated generic challenge_step_complete events jump
      // Grove bible quests forward. These tutorial choices are intentionally
      // advanced by the visible dialogue/practice action for the current step.
      return kind === trigger;
    case "inventory_change":
    case "collect":
    case "item_use":
    case "item_update":
    case "status_check":
    case "escort":
    case "carry":
    case "craft":
    default:
      return kind === trigger;
  }
}

function actionNameForTriggerV92(trigger: string | undefined) {
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

function groveHudHintForTriggerV100(trigger: string | undefined) {
  switch (trigger) {
    case "open_tab":
      return "HUD lesson: use the bottom action bar or the matching hotkey, then come back to the active objective.";
    case "near_location":
      return "HUD lesson: follow the pinned marker and distance badge until the stop is plainly visible.";
    case "interact":
      return "HUD lesson: when an object is marked, stand close and use the normal interact prompt instead of guessing.";
    case "inventory_change":
      return "HUD lesson: gear, bags, and quick actions should change the character read before you leave town.";
    case "status_check":
      return "HUD lesson: health, stamina, safety, and ready state matter before the next step starts.";
    case "combat":
      return "HUD lesson: practice only against the marked dummy or ring target; players require clear consent.";
    case "choice":
      return "HUD lesson: choices teach rules. Pick the rule you would trust when nobody is watching.";
    case "place_voxel":
      return "HUD lesson: placement should improve the road without hiding paths, doors, or markers.";
    case "collect":
    case "destroy":
      return "HUD lesson: use marked practice resources first. Unmarked supplies may belong to someone.";
    case "talk_npc":
      return "HUD lesson: NPCs give the story; the tracker keeps the task clear.";
    default:
      return "HUD lesson: complete the visible world action, then check the tracker for the next stop.";
  }
}

function groveQuestStepCopyV93(quest: SnapshotGroveQuestV75, objectiveIndex: number) {
  const clamped = Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex));
  const marker = currentMarkerForQuestV75(quest, clamped);
  const trigger = currentTriggerForQuestV92(quest, clamped);
  const action = actionNameForTriggerV92(trigger);
  return {
    progress: `${clamped + 1}/${quest.objectives.length}: ${quest.objectives[clamped]}`,
    target: marker ? `Next stop: ${marker.label}.` : "Next stop: follow the active map marker.",
    action,
    hudHint: groveHudHintForTriggerV100(trigger),
  };
}


function doesEventAdvanceQuestV75(
  event: GardenHoseEvent,
  quest: SnapshotGroveQuestV75,
  objectiveIndex: number,
) {
  return doesEventMatchSnapshotGroveTriggerV92(
    event,
    currentTriggerForQuestV92(quest, objectiveIndex),
  );
}

function useSnapshotGroveQuestStateV75() {
  const [state, setState] = useState<SnapshotGroveQuestStateV75>(() => readSnapshotGroveQuestStateV75());
  useEffect(() => {
    const refresh = () => setState(readSnapshotGroveQuestStateV75());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75, refresh);
    };
  }, []);
  return state;
}

function npcForEntityV75(
  entityId: BiomesId,
  labelText?: string,
  entityDescriptionText?: string,
  defaultDialog?: string,
): SnapshotGroveNpcV75 | undefined {
  if (entityId === JACKIE_ID) {
    return SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === "jackie");
  }
  const seededId = snapshotGroveNpcIdFromEntityIdV75(entityId);
  const labelMappedId = snapshotGroveNpcIdForDialogLabelV103({
    label: labelText,
    entityDescriptionText,
    defaultDialog,
  });
  return SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === (seededId ?? labelMappedId));
}

function npcLineForLikeabilityV75(npc: SnapshotGroveNpcV75) {
  const likeability = readSnapshotGroveLikeabilityV75()[npc.id] || 0;
  if (likeability >= 2 && npc.extraLines[1]) {
    return npc.extraLines[1];
  }
  if (likeability >= 1 && npc.extraLines[0]) {
    return npc.extraLines[0];
  }
  return npc.line;
}

function npcQuestDialogueCopyV100(
  npc: SnapshotGroveNpcV75,
  quest: SnapshotGroveQuestV75,
  state: SnapshotGroveQuestStateV75,
  objectiveIndex: number,
) {
  if (state.completedQuestIds.includes(quest.id)) {
    return `<text>${quest.title} is done. ${npc.displayName.split(",")[0]} looks relieved that the lesson held together.</text><text>Reward: ${quest.reward}</text>`;
  }
  if (!state.acceptedQuestIds.includes(quest.id)) {
    return `<text>${quest.sampleDialogue}</text><text>${quest.hook}</text>`;
  }
  const step = groveQuestStepCopyV93(quest, objectiveIndex);
  const marker = currentMarkerForQuestV75(quest, objectiveIndex);
  const destination = marker ? marker.label : "the place your tracker is pointing";
  return `<text>${quest.sampleDialogue}</text><text>Good. Now take the next part slowly: ${quest.objectives[Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))]}</text><text>If the crowd or road hides it, pin ${destination} from the tracker.</text><text>${step.hudHint}</text>`;
}

export function useSnapshotGroveNpcDialogV75(
  talkingToNPCId: BiomesId,
  defaultDialog: string,
):
  | {
      id: string;
      dialogText: string;
      actions: TalkDialogStepAction[];
    }
  | undefined {
  const { mapManager, reactResources } = useClientContext();
  const [label, entityDescription] = reactResources.useAll(
    ["/ecs/c/label", talkingToNPCId],
    ["/ecs/c/entity_description", talkingToNPCId],
  );
  const state = useSnapshotGroveQuestStateV75();

  return useMemo(() => {
    const npc = npcForEntityV75(
      talkingToNPCId,
      label?.text,
      entityDescription?.text,
      defaultDialog,
    );
    if (!npc) {
      return undefined;
    }
    const activeQuest = activeQuestForNpcV75(npc.id, state);
    const availableQuests = availableQuestsForNpcV101(npc.id, state);
    const availableQuest = availableQuests[0];
    const quest = activeQuest ?? availableQuest;
    const objectiveIndex = quest?.id === state.activeQuestId ? state.activeObjectiveIndex : 0;
    const marker = quest ? currentMarkerForQuestV75(quest, objectiveIndex) : undefined;
    const actions: TalkDialogStepAction[] = [];

    if (!activeQuest && availableQuests.length) {
      for (const option of availableQuests.slice(0, 3)) {
        actions.push({
          name: `Start ${option.title}`,
          type: actions.length === 0 ? "primary" : "normal",
          tooltip: option.hook,
          onPerformed: () => acceptSnapshotGroveQuestV75(option, mapManager),
        });
      }
    } else if (quest && !state.completedQuestIds.includes(quest.id)) {
      const currentTrigger = currentTriggerForQuestV92(quest, objectiveIndex);
      actions.push({
        name: actionNameForTriggerV92(currentTrigger),
        type: "primary",
        tooltip: quest.objectives[objectiveIndex],
        onPerformed: () => advanceSnapshotGroveQuestV75(quest, mapManager, currentTrigger ?? "player_confirmed"),
      });
    }

    if (marker) {
      actions.push({
        name: "Mark next stop",
        type: "normal",
        tooltip: marker.label,
        onPerformed: () => pinSnapshotGroveLandmarkV75(mapManager, marker.position),
      });
    }

    const line = npcLineForLikeabilityV75(npc);
    const questCopy = !activeQuest && availableQuests.length > 1
      ? `<text>I have a few safe fountain lessons ready. Pick the one that helps most right now; the tracker will pin each stop.</text>`
      : quest
        ? npcQuestDialogueCopyV100(npc, quest, state, objectiveIndex)
        : `<text>${defaultDialog || npc.shortDescription}</text>`;

    return {
      id: `${SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION_V75}-${npc.id}-${quest?.id ?? "bark"}-${objectiveIndex}`,
      dialogText: `<text>${line}</text>` + questCopy,
      actions: actions.slice(0, 4),
    };
  }, [defaultDialog, entityDescription?.text, label?.text, mapManager, state, talkingToNPCId]);
}

export const SnapshotGroveBibleRuntimeControllerV75: React.FunctionComponent<{}> = () => {
  const { gardenHose, mapManager } = useClientContext();
  const state = useSnapshotGroveQuestStateV75();

  useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      const current = readSnapshotGroveQuestStateV75();
      const quest = questByIdV75(current.activeQuestId);
      if (!quest || current.completedQuestIds.includes(quest.id)) {
        return;
      }
      if (doesEventAdvanceQuestV75(event, quest, current.activeObjectiveIndex)) {
        advanceSnapshotGroveQuestV75(quest, mapManager, (event as any).kind || "event");
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [gardenHose, mapManager]);

  useEffect(() => {
    const quest = questByIdV75(state.activeQuestId);
    if (!quest) {
      mapManager.removeNavigationAid?.(SNAPSHOT_GROVE_NAV_AID_ID_V75);
      return;
    }
    const marker = currentMarkerForQuestV75(quest, state.activeObjectiveIndex);
    if (marker) {
      pinSnapshotGroveLandmarkV75(mapManager, marker.position);
    }
  }, [mapManager, state.activeObjectiveIndex, state.activeQuestId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const win = window as typeof window & {
      __snapshotGroveV75?: unknown;
    };
    win.__snapshotGroveV75 = {
      version: SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION_V75,
      quests: SNAPSHOT_GROVE_QUESTS_V75,
      npcs: SNAPSHOT_GROVE_NPCS_V75,
      landmarks: SNAPSHOT_GROVE_LANDMARKS_V75,
      readState: readSnapshotGroveQuestStateV75,
      reset: () => {
        window.localStorage.removeItem(SNAPSHOT_GROVE_QUEST_STATE_KEY_V75);
        window.localStorage.removeItem(SNAPSHOT_GROVE_LIKEABILITY_KEY_V75);
        window.dispatchEvent(new CustomEvent(SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75));
      },
      dumpGrounding: () => SNAPSHOT_GROVE_NPCS_V75.map((npc) => {
        const livePosition = snapshotGroveGroundedPositionV75(npc.authoredPosition);
        return {
          id: npc.id,
          name: npc.displayName,
          seededEntityId: npc.seedServerNpc ? snapshotGroveNpcEntityIdV75(npc) : JACKIE_ID,
          authoredPosition: npc.authoredPosition,
          livePosition,
          grounded: livePosition[1] === SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83,
        };
      }),
    };
  }, []);

  return null;
};

export const SnapshotGroveMapHUDV75: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const state = useSnapshotGroveQuestStateV75();
  const activeQuest = questByIdV75(state.activeQuestId);
  const nextFountainLesson = SNAPSHOT_GROVE_QUESTS_V75.find(
    (item) =>
      SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(item.id) &&
      !state.completedQuestIds.includes(item.id),
  );
  const quest = activeQuest ?? nextFountainLesson ?? SNAPSHOT_GROVE_QUESTS_V75.find((item) => !state.completedQuestIds.includes(item.id));
  if (!quest) {
    return null;
  }
  const objectiveIndex = state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0;
  const marker = currentMarkerForQuestV75(quest, objectiveIndex);
  const playerPos = localPlayer.player.position as Vec3;
  const distance = marker
    ? Math.round(Math.hypot(marker.position[0] - playerPos[0], marker.position[2] - playerPos[2]))
    : undefined;
  if (!activeQuest && distance !== undefined && distance > 360) {
    return null;
  }
  const status = state.completedQuestIds.includes(quest.id)
    ? "Completed"
    : state.acceptedQuestIds.includes(quest.id)
      ? "In progress"
      : "Available";
  const step = groveQuestStepCopyV93(quest, objectiveIndex);
  const giver = SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === quest.giverNpcId);
  const isFountainLesson = SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(quest.id);
  return (
    <div className="rounded-2xl border border-lime-100/25 bg-black/70 p-3 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-lime-100/80">
            {isFountainLesson ? "Fountain lesson" : "The Grove"}
          </div>
          <div className="text-sm font-bold text-white">{quest.title}</div>
          <div className="text-[11px] text-white/60">{status}{giver ? ` · ${giver.displayName}` : ""}</div>
        </div>
        {distance !== undefined && (
          <div className="rounded-full bg-lime-300/20 px-2 py-0.5 text-xs font-semibold text-lime-100">
            {distance}m
          </div>
        )}
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2 text-xs leading-snug text-white/88">
        {state.acceptedQuestIds.includes(quest.id) ? step.progress : quest.hook}
      </div>
      {state.acceptedQuestIds.includes(quest.id) && (
        <div className="mt-2 space-y-1 text-[11px] leading-snug text-white/65">
          <div>{step.target}</div>
          <div>{step.hudHint}</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
        <span className="rounded bg-white/10 px-1.5 py-0.5">M Map</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5">J Quests</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5">F Interact</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5">K Skills</span>
      </div>
      {marker && (
        <button
          className="mt-2 rounded-lg bg-lime-300/20 px-2.5 py-1 text-[11px] font-bold text-lime-100 hover:bg-lime-300/30"
          onClick={() => pinSnapshotGroveLandmarkV75(mapManager, marker.position)}
        >
          Pin {marker.label}
        </button>
      )}
    </div>
  );
};


export const SnapshotGroveJournalPanelV75: React.FunctionComponent<{}> = () => {
  const state = useSnapshotGroveQuestStateV75();
  const activeQuest = questByIdV75(state.activeQuestId);
  const fountainLessons = SNAPSHOT_GROVE_QUESTS_V75.filter((quest) =>
    SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(quest.id),
  );
  const roadStories = SNAPSHOT_GROVE_QUESTS_V75.filter((quest) =>
    !SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_ID_SET_V100.has(quest.id),
  );
  const renderQuestRow = (quest: SnapshotGroveQuestV75) => {
    const status = state.completedQuestIds.includes(quest.id)
      ? "done"
      : state.acceptedQuestIds.includes(quest.id)
        ? "active"
        : "open";
    const giver = SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === quest.giverNpcId);
    return (
      <div key={quest.id} className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5">
        <div className="flex justify-between gap-2">
          <span className="font-semibold text-white/90">{quest.title}</span>
          <span className="uppercase text-white/45">{status}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-white/55">
          {giver ? `${giver.displayName} · ` : ""}{quest.area}
        </div>
      </div>
    );
  };
  return (
    <div className="rounded-2xl border border-lime-200/20 bg-lime-950/25 p-3">
      <div className="text-sm font-semibold text-white">Grove Learning Journal</div>
      <div className="mt-1 text-xs leading-snug text-white/70">
        The fountain lessons teach the HUD, map pins, inventory, legal gathering, sparring consent, party readiness, mail, storage, and recovery before the road sends you farther out.
      </div>
      {activeQuest ? (
        <div className="mt-2 rounded-xl bg-black/25 p-2 text-xs leading-snug text-white/80">
          <div className="font-semibold text-lime-100">Active: {activeQuest.title}</div>
          <div>{groveQuestStepCopyV93(activeQuest, state.activeObjectiveIndex).progress}</div>
          <div className="mt-1 text-[11px] text-white/60">{groveQuestStepCopyV93(activeQuest, state.activeObjectiveIndex).target}</div>
          <div className="mt-1 text-[11px] text-white/60">Reward: {activeQuest.reward}</div>
        </div>
      ) : (
        <div className="mt-2 rounded-xl bg-black/20 p-2 text-xs leading-snug text-white/70">
          Talk to Jackie, Taye, Alexis, or Nia around the fountain to pick a lesson. The tracker will pin each next stop and the journal keeps the objective readable.
        </div>
      )}
      <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-lime-100/75">Fountain lessons</div>
      <div className="mt-1 grid gap-1 text-[11px] leading-snug">
        {fountainLessons.map(renderQuestRow)}
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-lime-100/75">Road stories</div>
      <div className="mt-1 grid gap-1 text-[11px] leading-snug">
        {roadStories.map(renderQuestRow)}
      </div>
      {!!state.rewards.length && (
        <div className="mt-2 text-[11px] text-white/55">Latest reward: {state.rewards[state.rewards.length - 1]}</div>
      )}
    </div>
  );
};
