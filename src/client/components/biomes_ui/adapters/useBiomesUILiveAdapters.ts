import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { iconUrl } from "@/client/components/inventory/icons";
import { throwInventoryItem } from "@/client/game/helpers/inventory";
import type { GameModal } from "@/client/game/resources/game_modal";
import { InventoryChangeSelectionEvent } from "@/shared/ecs/gen/events";
import type { OwnedItemReference } from "@/shared/ecs/gen/types";
import { fireAndForget } from "@/shared/util/async";
import * as React from "react";
import type { BiomesUIAdapters } from "../BiomesUI";
import type { TabKey } from "../BiomesUITypes";
import type { HotbarSlotItem } from "../hotbar/BiomesHotbar";
import type { CurrentStep } from "../tutorial/TutorialDirector";
import type { StepTarget, StepTrigger } from "../tutorial/tutorialMissionMap";

export const BIOMES_UI_OPEN_TAB_EVENT = "biomes-ui-open-tab";

const BIOMES_UI_KEY_TO_TAB: Record<string, TabKey> = {
  KeyE: "inventory",
  KeyI: "inventory",
  KeyB: "abilities",
  KeyK: "skills",
  KeyY: "classes",
  KeyL: "land",
  KeyO: "loot",
  KeyG: "guilds",
  KeyP: "banking",
  KeyM: "map",
  KeyQ: "map",
  KeyC: "collections",
  KeyV: "inbox",
  Comma: "options",
};

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function clampHotbarIndex(index: number, length = 9): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.max(0, length - 1), Math.floor(index)));
}

function countToNumber(count: unknown): number | undefined {
  if (count === undefined || count === null) return undefined;
  if (typeof count === "bigint") return Number(count);
  const numeric = Number(count);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readableItemName(slot: any, fallback: string): string {
  const item = slot?.item ?? slot;
  return String(
    item?.displayName ??
      item?.display_name ??
      item?.name ??
      item?.label ??
      item?.id ??
      fallback,
  );
}

function slotToUiItem(slot: any, fallback: string): HotbarSlotItem | null {
  if (!slot || !slot.item) return null;
  const item = slot.item;
  let icon = "◼";
  try {
    icon = iconUrl(item) ?? icon;
  } catch {
    icon = item?.action === "photo" ? "📷" : icon;
  }
  return {
    id: String(item?.id ?? fallback),
    label: readableItemName(slot, fallback),
    icon,
    count: countToNumber(slot.count),
    quality: item?.isQuest ? "quest" : "common",
  };
}

function normalizeContainer(container: unknown): any[] {
  if (!container) return [];
  if (Array.isArray(container)) return container;
  if (typeof (container as any)[Symbol.iterator] === "function") return Array.from(container as Iterable<any>);
  if (Array.isArray((container as any).items)) return (container as any).items;
  if (typeof container === "object") return Object.values(container as Record<string, unknown>);
  return [];
}

function readSnapshotGroveApi(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).__snapshotGroveV75;
}

function normalizeMarkerId(markerId: string): string {
  const lower = markerId.toLowerCase();
  if (lower.includes("jackie")) return "jackie";
  if (lower.includes("road")) return "road_marker";
  if (lower.includes("muck")) return "muckwad_patch";
  if (lower.includes("build") || lower.includes("place")) return "building_spot";
  if (lower.includes("selfie") || lower.includes("overlook") || lower.includes("camera")) return "selfie_overlook";
  return markerId.replace(/^npc_/, "").replace(/^grove_/, "");
}

function deriveTutorialTarget(objective: string, markerId: string): StepTarget | undefined {
  const text = `${objective} ${markerId}`.toLowerCase();
  if (text.includes("jackie")) return "jackie";
  if (text.includes("road")) return "road_marker";
  if (text.includes("muck")) return "muckwad_patch";
  if (text.includes("build") || text.includes("place")) return "building_spot";
  if (text.includes("wardrobe") || text.includes("wear") || text.includes("equip")) return "wardrobe";
  if (text.includes("jump") || text.includes("sprint") || text.includes("run")) return "jump_run";
  if (text.includes("selfie") || text.includes("photo") || text.includes("camera")) return "selfie_overlook";
  if (text.includes("craft") || text.includes("recipe")) return "crafting_stop";
  if (text.includes("grove")) return "grove";
  return undefined;
}

function deriveTutorialTrigger(rawTrigger: string, objective: string): StepTrigger | undefined {
  const text = `${rawTrigger} ${objective}`.toLowerCase();
  if (text.includes("talk") || text.includes("dialog")) return "dialog";
  if (text.includes("destroy") || text.includes("break") || text.includes("muck")) return "destroy";
  if (text.includes("place")) return "place_voxel";
  if (text.includes("wear") || text.includes("equip")) return "wearing";
  if (text.includes("jump") || text.includes("sprint") || text.includes("run")) return "running_jump";
  if (text.includes("photo") || text.includes("camera") || text.includes("selfie")) return "photo";
  if (text.includes("craft")) return "craft_muck_buster";
  if (text.includes("location") || text.includes("near") || text.includes("marker")) return "location";
  if (text.includes("open_tab")) return "location";
  return undefined;
}

function deriveSnapshotTutorialStep(): CurrentStep | null {
  const api = readSnapshotGroveApi();
  const state = api?.readState?.();
  const quests = Array.isArray(api?.quests) ? api.quests : [];
  const activeQuest = quests.find((quest: any) => quest?.id === state?.activeQuestId);
  if (!activeQuest || state?.completedQuestIds?.includes?.(activeQuest.id)) return null;

  const objectiveIndex = Math.max(0, Number(state?.activeObjectiveIndex ?? 0));
  const objective = String(activeQuest.objectives?.[objectiveIndex] ?? "");
  const rawTrigger = String(activeQuest.triggers?.[objectiveIndex] ?? "");
  const markerId = String(activeQuest.markerIds?.[objectiveIndex] ?? "");
  const target = deriveTutorialTarget(objective, markerId);
  const trigger = deriveTutorialTrigger(rawTrigger, objective);
  if (!target || !trigger) return null;

  return {
    stepId: `${activeQuest.id}:${objectiveIndex}`,
    target,
    trigger,
  };
}

function buildMapAdapter(snapshotRevision: number) {
  return {
    getMarkers: () => {
      void snapshotRevision;
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const landmarks = Array.isArray(api?.landmarks) ? api.landmarks : [];
      const activeQuest = quests.find((quest: any) => quest?.id === state?.activeQuestId);
      const markerIds = activeQuest?.markerIds ?? [];
      if (!Array.isArray(markerIds) || markerIds.length === 0) return [];
      return markerIds.map((markerId: string, index: number) => {
        const landmark = landmarks.find((entry: any) => entry?.id === markerId);
        const total = Math.max(1, markerIds.length - 1);
        return {
          id: normalizeMarkerId(markerId),
          label: String(landmark?.label ?? markerId),
          x: 0.16 + (index / total) * 0.68,
          y: 0.5 + ((index % 3) - 1) * 0.12,
          kind: "objective" as const,
        };
      });
    },
    getMissionTitle: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const activeQuest = (Array.isArray(api?.quests) ? api.quests : []).find((quest: any) => quest?.id === state?.activeQuestId);
      return String(activeQuest?.title ?? "Current Mission");
    },
    getMissionSteps: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const activeQuest = (Array.isArray(api?.quests) ? api.quests : []).find((quest: any) => quest?.id === state?.activeQuestId);
      const objectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
      const objectives = Array.isArray(activeQuest?.objectives) ? activeQuest.objectives : [];
      return objectives.map((objective: string, index: number) => ({
        id: `${activeQuest?.id ?? "quest"}:${index}`,
        title: index < objectiveIndex ? `Completed step ${index + 1}` : index === objectiveIndex ? `Current step ${index + 1}` : `Upcoming step ${index + 1}`,
        objective,
        done: index < objectiveIndex,
      }));
    },
  };
}

export function dispatchBiomesUIOpenTab(tab: TabKey, source = "legacy"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_OPEN_TAB_EVENT, {
      detail: { tab, source },
    }),
  );
}

export function useBiomesUILiveAdapters({
  activeTab,
  onActiveTabChange,
  replacementMode,
}: {
  activeTab: TabKey | null;
  onActiveTabChange: (tab: TabKey | null) => void;
  replacementMode: boolean;
}) {
  const clientContext = useClientContext();
  const { reactResources, userId, events, audioManager } = clientContext;
  const pointerLockManager = usePointerLockManager();
  const inventory = reactResources.use("/ecs/c/inventory", userId) as any;
  const hotbarIndex = reactResources.use("/hotbar/index") as { value: number };
  const gameModal = reactResources.use("/game_modal") as GameModal;
  const [snapshotRevision, setSnapshotRevision] = React.useState(0);
  const shouldReturnPointerLockRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setSnapshotRevision((value) => value + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", bump);
    window.addEventListener("biomes:snapshot-grove-tutor-hud-highlights-v109", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", bump);
      window.removeEventListener("biomes:snapshot-grove-tutor-hud-highlights-v109", bump);
    };
  }, []);

  const setActiveTabFromUi = React.useCallback(
    (next: TabKey | null) => {
      if (next) {
        shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
        pointerLockManager.unlock();
        try {
          if (reactResources.get("/game_modal")?.kind !== "empty") {
            reactResources.set("/game_modal", { kind: "empty" });
          }
        } catch {}
      } else if (shouldReturnPointerLockRef.current) {
        shouldReturnPointerLockRef.current = false;
        pointerLockManager.focusAndLock();
      }
      onActiveTabChange(next);
    },
    [onActiveTabChange, pointerLockManager, reactResources],
  );

  const openTab = React.useCallback(
    (tab: TabKey, mode: "toggle" | "open" = "toggle") => {
      const next = mode === "toggle" && activeTab === tab ? null : tab;
      setActiveTabFromUi(next);
    },
    [activeTab, setActiveTabFromUi],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: TabKey }>).detail;
      if (detail?.tab) openTab(detail.tab, "open");
    };
    window.addEventListener(BIOMES_UI_OPEN_TAB_EVENT, handler);
    return () => window.removeEventListener(BIOMES_UI_OPEN_TAB_EVENT, handler);
  }, [openTab]);

  React.useEffect(() => {
    if (!replacementMode || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInInput(event.target)
      ) {
        return;
      }
      const tab = BIOMES_UI_KEY_TO_TAB[event.code];
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openTab(tab, "toggle");
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [openTab, replacementMode]);

  React.useEffect(() => {
    if (!replacementMode) return;
    const modalToTab: Partial<Record<GameModal["kind"], TabKey>> = {
      inventory: "inventory",
      map: "map",
      inbox: "inbox",
      collections: "collections",
      game_settings: "options",
      challenges: "map",
    };
    const tab = modalToTab[gameModal.kind];
    if (!tab) return;
    setActiveTabFromUi(tab);
    reactResources.set("/game_modal", { kind: "empty" });
  }, [gameModal.kind, reactResources, replacementMode, setActiveTabFromUi]);

  const selectedIndex = clampHotbarIndex(Number(hotbarIndex?.value ?? inventory?.selected?.idx ?? 0), 9);

  const selectHotbarIndex = React.useCallback(
    (index: number) => {
      const idx = clampHotbarIndex(index, 9);
      try {
        reactResources.set("/hotbar/index", { value: idx });
      } catch {}
      try {
        clientContext.resources.update("/hotbar/index", (resource: { value: number }) => {
          resource.value = idx;
        });
      } catch {}
      try {
        const localPlayer = reactResources.get("/scene/local_player");
        const ref = { kind: "hotbar", idx } as OwnedItemReference;
        if (localPlayer?.id) {
          fireAndForget(events.publish(new InventoryChangeSelectionEvent({ id: localPlayer.id, ref })));
        }
        audioManager?.playSound?.("item_select");
      } catch {}
    },
    [audioManager, clientContext.resources, events, reactResources],
  );

  const hotbar = React.useMemo(() => {
    const hotbarSlots = normalizeContainer(inventory?.hotbar).slice(0, 9);
    const slots = Array.from({ length: 9 }, (_unused, index) =>
      slotToUiItem(hotbarSlots[index], `hotbar_${index + 1}`),
    );
    return {
      slots,
      selectedIndex,
      onSelect: selectHotbarIndex,
      onUse: (index: number) => selectHotbarIndex(index),
      onDrop: (index: number) => {
        try {
          const localPlayer = reactResources.get("/scene/local_player");
          if (localPlayer?.id) {
            fireAndForget(
              throwInventoryItem(clientContext as any, localPlayer.id, {
                kind: "hotbar",
                idx: clampHotbarIndex(index, 9),
              } as OwnedItemReference),
            );
          }
        } catch {}
      },
    };
  }, [clientContext, inventory?.hotbar, reactResources, selectHotbarIndex, selectedIndex]);

  const adapters = React.useMemo<BiomesUIAdapters>(() => {
    const backpackItems = normalizeContainer(inventory?.items);
    return {
      inventory: {
        getBackpack: () => ({
          items: backpackItems.map((slot: any, index: number) => slotToUiItem(slot, `bag_${index + 1}`)),
          maxSlots: Math.max(32, backpackItems.length || 0),
        }),
        getEquipment: () => ({}),
      },
      map: buildMapAdapter(snapshotRevision),
      banking: {
        getCurrencies: () =>
          normalizeContainer(inventory?.currencies).map((entry: any, index: number) => ({
            id: String(entry?.item?.id ?? entry?.id ?? `currency_${index}`),
            name: readableItemName(entry, `Currency ${index + 1}`),
            amount: countToNumber(entry?.count ?? entry?.amount) ?? 0,
            icon: "◉",
          })),
      },
    };
  }, [inventory?.currencies, inventory?.items, snapshotRevision]);

  const tutorialStep = React.useMemo(() => {
    void snapshotRevision;
    return deriveSnapshotTutorialStep();
  }, [snapshotRevision]);

  return {
    adapters,
    hotbar,
    openTab,
    onActiveTabChange: setActiveTabFromUi,
    tutorialStep,
  };
}
