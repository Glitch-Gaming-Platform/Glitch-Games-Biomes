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
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveLandmarkByIdV75,
  snapshotGroveNpcEntityIdV75,
  snapshotGroveNpcIdFromEntityIdV75,
  type SnapshotGroveNpcV75,
  type SnapshotGroveQuestV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION_V75 =
  "snapshot-grove-bible-runtime-v75";

export const SNAPSHOT_GROVE_QUEST_STATE_KEY_V75 =
  "biomes.localDev.snapshotGroveQuestState.v75";

export const SNAPSHOT_GROVE_QUEST_STATE_EVENT_V75 =
  "biomes:local-dev-snapshot-grove-quest-state-v75";

const SNAPSHOT_GROVE_LIKEABILITY_KEY_V75 =
  "biomes.localDev.snapshotGroveLikeability.v75";

const SNAPSHOT_GROVE_NAV_AID_ID_V75 = 750_075;

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
  return {
    acceptedQuestIds: Array.isArray(parsed?.acceptedQuestIds)
      ? parsed!.acceptedQuestIds
      : [],
    activeQuestId: typeof parsed?.activeQuestId === "string" ? parsed.activeQuestId : undefined,
    activeObjectiveIndex: Number.isFinite(parsed?.activeObjectiveIndex)
      ? Math.max(0, Number(parsed?.activeObjectiveIndex))
      : 0,
    completedQuestIds: Array.isArray(parsed?.completedQuestIds)
      ? parsed!.completedQuestIds
      : [],
    completedObjectiveIds: Array.isArray(parsed?.completedObjectiveIds)
      ? parsed!.completedObjectiveIds
      : [],
    rewards: Array.isArray(parsed?.rewards) ? parsed!.rewards : [],
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

function firstAvailableQuestForNpcV75(npcId: string, state: SnapshotGroveQuestStateV75) {
  return SNAPSHOT_GROVE_QUESTS_V75.find(
    (quest) =>
      quest.giverNpcId === npcId &&
      !state.completedQuestIds.includes(quest.id) &&
      !state.acceptedQuestIds.includes(quest.id),
  );
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
  const objectiveId = `${quest.id}:${state.activeObjectiveIndex}:${reason}`;
  const nextIndex = state.activeObjectiveIndex + 1;
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

function doesEventAdvanceQuestV75(event: GardenHoseEvent, quest: SnapshotGroveQuestV75) {
  const kind = (event as any).kind;
  return quest.triggers.some((trigger) => {
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
      case "inventory_change":
      case "open_tab":
      case "interact":
      case "collect":
      case "choice":
      case "item_grant":
      case "item_use":
      case "item_update":
      case "status_check":
      case "escort":
      case "carry":
      case "craft":
      default:
        return kind === trigger;
    }
  });
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

function npcForEntityV75(entityId: BiomesId): SnapshotGroveNpcV75 | undefined {
  if (entityId === JACKIE_ID) {
    return SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === "jackie");
  }
  const id = snapshotGroveNpcIdFromEntityIdV75(entityId);
  return SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.id === id);
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
  const { mapManager } = useClientContext();
  const state = useSnapshotGroveQuestStateV75();

  return useMemo(() => {
    const npc = npcForEntityV75(talkingToNPCId);
    if (!npc) {
      return undefined;
    }
    const activeQuest = activeQuestForNpcV75(npc.id, state);
    const availableQuest = firstAvailableQuestForNpcV75(npc.id, state);
    const quest = activeQuest ?? availableQuest;
    const objectiveIndex = quest?.id === state.activeQuestId ? state.activeObjectiveIndex : 0;
    const marker = quest ? currentMarkerForQuestV75(quest, objectiveIndex) : undefined;
    const actions: TalkDialogStepAction[] = [];

    if (quest && !state.acceptedQuestIds.includes(quest.id)) {
      actions.push({
        name: `Start ${quest.title}`,
        type: "primary",
        tooltip: quest.hook,
        onPerformed: () => acceptSnapshotGroveQuestV75(quest, mapManager),
      });
    } else if (quest && !state.completedQuestIds.includes(quest.id)) {
      actions.push({
        name: "I handled this",
        type: "primary",
        tooltip: quest.objectives[objectiveIndex],
        onPerformed: () => advanceSnapshotGroveQuestV75(quest, mapManager, "player_confirmed"),
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
    const questCopy = quest
      ? state.completedQuestIds.includes(quest.id)
        ? `<text>${quest.reward}</text>`
        : `<text>${quest.hook}</text><text>${quest.objectives[objectiveIndex] ?? quest.objectives[0]}</text>`
      : `<text>${defaultDialog || npc.shortDescription}</text>`;

    return {
      id: `${SNAPSHOT_GROVE_BIBLE_RUNTIME_VERSION_V75}-${npc.id}-${quest?.id ?? "bark"}-${objectiveIndex}`,
      dialogText:
        `<text>${line}</text>` +
        `<text>${npc.shortDescription}</text>` +
        questCopy,
      actions: actions.slice(0, 4),
    };
  }, [defaultDialog, mapManager, state, talkingToNPCId]);
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
      if (doesEventAdvanceQuestV75(event, quest)) {
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
      dumpGrounding: () => SNAPSHOT_GROVE_NPCS_V75.map((npc) => ({
        id: npc.id,
        name: npc.displayName,
        seededEntityId: npc.seedServerNpc ? snapshotGroveNpcEntityIdV75(npc) : JACKIE_ID,
        position: npc.authoredPosition,
        grounded: npc.authoredPosition[1] === 53,
      })),
    };
  }, []);

  return null;
};

export const SnapshotGroveMapHUDV75: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const state = useSnapshotGroveQuestStateV75();
  const quest = questByIdV75(state.activeQuestId) ?? SNAPSHOT_GROVE_QUESTS_V75.find((item) => !state.completedQuestIds.includes(item.id));
  if (!quest) {
    return null;
  }
  const marker = currentMarkerForQuestV75(quest, state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0);
  const playerPos = localPlayer.player.position as Vec3;
  const distance = marker
    ? Math.round(Math.hypot(marker.position[0] - playerPos[0], marker.position[2] - playerPos[2]))
    : undefined;
  const status = state.completedQuestIds.includes(quest.id)
    ? "Completed"
    : state.acceptedQuestIds.includes(quest.id)
      ? "In Progress"
      : "Available";
  return (
    <div className="rounded-xl border border-lime-200/20 bg-lime-950/35 p-2 text-white shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-lime-100">The Grove</div>
          <div className="text-xs text-white/70">{quest.title} · {status}</div>
        </div>
        {distance !== undefined && <div className="rounded bg-lime-300/20 px-1.5 py-0.5 text-xs font-semibold text-lime-100">{distance}m</div>}
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        {state.acceptedQuestIds.includes(quest.id)
          ? quest.objectives[Math.min(state.activeObjectiveIndex, quest.objectives.length - 1)]
          : quest.hook}
      </div>
      {marker && (
        <button
          className="mt-2 rounded bg-lime-300/20 px-2 py-1 text-[11px] font-semibold text-lime-100 hover:bg-lime-300/30"
          onClick={() => pinSnapshotGroveLandmarkV75(mapManager, marker.position)}
        >
          Mark {marker.label}
        </button>
      )}
    </div>
  );
};

export const SnapshotGroveJournalPanelV75: React.FunctionComponent<{}> = () => {
  const state = useSnapshotGroveQuestStateV75();
  const activeQuest = questByIdV75(state.activeQuestId);
  return (
    <div className="rounded border border-lime-200/20 bg-lime-950/30 p-2">
      <div className="text-sm font-semibold text-white">The Grove Subquests</div>
      <div className="text-[10px] uppercase tracking-wide text-lime-100/80">
        {SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION_V75}
      </div>
      {activeQuest ? (
        <div className="mt-2 rounded bg-black/20 p-1.5 text-xs leading-snug text-white/80">
          <div className="font-semibold text-lime-100">Active: {activeQuest.title}</div>
          <div>{activeQuest.objectives[Math.min(state.activeObjectiveIndex, activeQuest.objectives.length - 1)]}</div>
          <div className="mt-1 text-[11px] text-white/55">Reward: {activeQuest.reward}</div>
        </div>
      ) : (
        <div className="mt-2 text-xs leading-snug text-white/70">
          Talk to Grove NPCs to start the 15 bible subquests. NPC speech stays in character; current objectives stay here and on the map.
        </div>
      )}
      <div className="mt-2 grid gap-1 text-[11px] leading-snug text-white/65">
        {SNAPSHOT_GROVE_QUESTS_V75.slice(0, 15).map((quest) => {
          const status = state.completedQuestIds.includes(quest.id)
            ? "done"
            : state.acceptedQuestIds.includes(quest.id)
              ? "active"
              : "open";
          return (
            <div key={quest.id} className="flex justify-between gap-2 rounded bg-black/15 px-1.5 py-1">
              <span>{quest.title}</span>
              <span className="uppercase text-white/45">{status}</span>
            </div>
          );
        })}
      </div>
      {!!state.rewards.length && (
        <div className="mt-2 text-[11px] text-white/55">Latest reward: {state.rewards[state.rewards.length - 1]}</div>
      )}
    </div>
  );
};
