import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  BUILDING_SYSTEM_BLUEPRINTS_V1,
  BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1,
  BUILDING_SYSTEM_PLOTS_V1,
} from "@/shared/harthmere/building_system_v1";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { iconUrl } from "@/client/components/inventory/icons";
import { destroyInventoryItem, throwInventoryItem } from "@/client/game/helpers/inventory";
import type { GameModal } from "@/client/game/resources/game_modal";
import {
  InventoryChangeSelectionEvent,
  InventoryCombineEvent,
  InventorySortEvent,
  InventorySplitEvent,
  InventorySwapEvent,
} from "@/shared/ecs/gen/events";
import type { OwnedItemReference } from "@/shared/ecs/gen/types";
import { fireAndForget } from "@/shared/util/async";
import { createBiomesUIGuildsAdapterV1, fetchBiomesUIGuildStateV1 } from "./guildsLiveAdapter";
import * as React from "react";
import type { BiomesUIAdapters } from "../BiomesUI";
import type { TabKey } from "../BiomesUITypes";
import type { HotbarSlotItem } from "../hotbar/BiomesHotbar";
import type { InventoryUiItem, InventoryUiRef } from "../tabs/InventoryTab";
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

function humanizeRealItemId(itemId: string, fallback: string): string {
  if (!itemId || itemId === fallback) return fallback;
  const parts = itemId.split("/").filter(Boolean);
  const tail = parts[parts.length - 1] ?? itemId;
  const readable = tail
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  if (/^[a-f0-9]{16,}$/i.test(tail)) {
    return `Asset ${tail.slice(0, 8)}`;
  }
  return readable || fallback;
}

function readableItemName(slot: any, fallback: string): string {
  const item = slot?.item ?? slot;
  const explicit = item?.displayName ?? item?.display_name ?? item?.name ?? item?.label;
  if (typeof explicit === "string" && explicit.trim().length > 0) return explicit;
  const itemId = item?.id;
  return typeof itemId === "string" ? humanizeRealItemId(itemId, fallback) : fallback;
}

function hasExplicitItemName(slot: any): boolean {
  const item = slot?.item ?? slot;
  return [item?.displayName, item?.display_name, item?.name, item?.label].some(
    (value) => typeof value === "string" && value.trim().length > 0,
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


function inferInventoryCategory(item: any): string {
  const raw = String(
    item?.category ??
      item?.inventoryCategory ??
      item?.displayCategory ??
      item?.action ??
      "item",
  ).toLowerCase();
  if (item?.isQuest) return "quest";
  if (item?.isWearable || item?.wearableSlot || item?.slot || raw.includes("wear")) return "gear";
  if (raw.includes("tool") || raw.includes("weapon")) return "tools";
  if (raw.includes("block") || raw.includes("material") || raw.includes("resource")) return "materials";
  if (raw.includes("food") || raw.includes("potion") || raw.includes("consume")) return "consumables";
  return raw;
}

function inferEquipSlot(item: any): string | undefined {
  const slot = item?.wearableSlot ?? item?.wearable_slot ?? item?.slot ?? item?.equipmentSlot;
  if (slot) return String(slot).toLowerCase();
  const text = `${item?.displayName ?? item?.name ?? ""} ${item?.action ?? ""}`.toLowerCase();
  if (text.includes("helmet") || text.includes("hat")) return "head";
  if (text.includes("chest") || text.includes("shirt") || text.includes("armor")) return "chest";
  if (text.includes("pants") || text.includes("legs")) return "legs";
  if (text.includes("boots") || text.includes("shoes") || text.includes("feet")) return "feet";
  if (text.includes("gloves") || text.includes("hands")) return "hands";
  if (text.includes("shield")) return "off_hand";
  if (text.includes("sword") || text.includes("pickaxe") || text.includes("axe") || text.includes("wand") || text.includes("staff")) return "main_hand";
  return undefined;
}

function itemDescription(item: any): string | undefined {
  return item?.description ?? item?.tooltip ?? item?.flavorText ?? item?.subtitle;
}

function itemDurability(item: any): { current: number; max: number } | undefined {
  const current = Number(item?.durability ?? item?.durabilityCurrent ?? item?.hp);
  const max = Number(item?.maxDurability ?? item?.durabilityMax ?? item?.maxHp);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return undefined;
  return { current, max };
}

function itemWeight(slot: any): number {
  const item = slot?.item ?? slot;
  const explicit = Number(item?.weight ?? item?.carryWeight ?? item?.mass);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const category = inferInventoryCategory(item);
  if (category === "materials" || category.includes("material")) return 2;
  if (category === "tools" || category === "gear") return 5;
  if (category === "consumables") return 1;
  if (category === "quest") return 0.5;
  return 1;
}

function isCurrencySlot(entry: any): boolean {
  const item = entry?.item ?? entry;
  return !!item?.isCurrency || String(item?.kind ?? item?.category ?? "").toLowerCase().includes("currency");
}

function dictionaryToVaultItems(items: Record<string, number> | undefined): Array<{ id: string; name: string; icon: string; quantity: number } | null> {
  return Object.entries(items ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([itemId, count]) => ({
      id: itemId,
      name: humanizeRealItemId(itemId, itemId),
      icon: "◼",
      quantity: Number(count) || 0,
    }));
}

function slotToInventoryUiItem(
  slot: any,
  fallback: string,
  ref: InventoryUiRef,
  source: "backpack" | "hotbar" | "equipment",
): InventoryUiItem | null {
  const base = slotToUiItem(slot, fallback);
  if (!base || !slot?.item) return null;
  const item = slot.item;
  return {
    id: base.id,
    label: base.label,
    icon: base.icon,
    count: base.count,
    quality: base.quality as InventoryUiItem["quality"],
    category: inferInventoryCategory(item),
    description: itemDescription(item),
    durability: itemDurability(item),
    equipSlot: inferEquipSlot(item),
    ref,
    source,
  };
}

function normalizeAssignment(assignment: unknown): Array<[string, any]> {
  if (!assignment) return [];
  if (assignment instanceof Map) return Array.from(assignment.entries()).map(([key, value]) => [String(key), value]);
  if (typeof (assignment as any).entries === "function") {
    return Array.from((assignment as any).entries()).map(([key, value]: any) => [String(key), value]);
  }
  if (typeof assignment === "object") return Object.entries(assignment as Record<string, unknown>);
  return [];
}

function normalizeUiRef(ref: InventoryUiRef): OwnedItemReference {
  if (ref.kind === "item" || ref.kind === "hotbar") {
    return { kind: ref.kind, idx: Number(ref.idx ?? 0) } as OwnedItemReference;
  }
  return { kind: ref.kind as any, key: ref.key as any } as OwnedItemReference;
}

function optionalCountToBigInt(count?: number): bigint | undefined {
  if (count === undefined || count === null) return undefined;
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return BigInt(Math.floor(count));
}

function localPlayerPositionList(reactResources: any): any[] {
  try {
    const localPlayer = reactResources.get("/scene/local_player");
    const id = localPlayer?.id;
    const position = id ? reactResources.get("/ecs/c/position", id)?.v : undefined;
    return position ? [position] : [];
  } catch {
    return [];
  }
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
  if (lower.includes("mira") || lower.includes("miranda") || lower.includes("steward")) return "mira_grove_land_steward";
  if (lower.includes("jackie")) return "jackie";
  if (lower.includes("road")) return "road_marker";
  if (lower.includes("muck")) return "muckwad_patch";
  if (lower.includes("build") || lower.includes("place")) return "building_spot";
  if (lower.includes("selfie") || lower.includes("overlook") || lower.includes("camera")) return "selfie_overlook";
  return markerId.replace(/^npc_/, "").replace(/^grove_/, "");
}

function deriveTutorialTarget(objective: string, markerId: string): StepTarget | undefined {
  const text = `${objective} ${markerId}`.toLowerCase();
  if (text.includes("mira") || text.includes("miranda") || text.includes("steward")) return "building_spot";
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


async function submitBuildingSystemLiveModeAction(
  action: string,
  payload: Record<string, unknown>
): Promise<any> {
  const requestId = `biomes_ui_building_${action}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_property_building_mutation",
      subsystem: "building",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        buildingAction: action,
        ...payload,
      },
      clientClaims: {},
    }),
  });
  return response.json();
}


async function fetchBankingStateV1(): Promise<any | undefined> {
  const response = await fetch("/api/harthmere/live_mode_bank_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.bankingState;
}

async function submitBankingLiveModeAction(operation: string, payload: Record<string, unknown> = {}): Promise<any> {
  const requestId = `biomes_ui_bank_${operation}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_bank_transaction",
      subsystem: "bank",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: { operation, ...payload },
      clientClaims: {},
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error(Array.isArray(body?.validation?.errors) ? body.validation.errors.join(",") : `bank_request_failed:${operation}`);
  }
  return body;
}

// Building System UI state is hydrated from /api/harthmere/live_mode via
// the read_state action. Do not use browser storage as a source of ownership truth.

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
      const miraMarker = {
        id: "mira_grove_land_steward",
        label: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.displayName,
        x: 0.66,
        y: 0.52,
        kind: "objective" as const,
      };
      if (!Array.isArray(markerIds) || markerIds.length === 0) return [miraMarker];
      const questMarkers = markerIds.map((markerId: string, index: number) => {
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
      return questMarkers.some((marker) => marker.id === miraMarker.id)
        ? questMarkers
        : [...questMarkers, miraMarker];
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
  const wearing = reactResources.use("/ecs/c/wearing", userId) as any;
  const hotbarIndex = reactResources.use("/hotbar/index") as { value: number };
  const gameModal = reactResources.use("/game_modal") as GameModal;
  const [snapshotRevision, setSnapshotRevision] = React.useState(0);
  const [bankingState, setBankingState] = React.useState<any | undefined>(undefined);
  const [bankingHydrated, setBankingHydrated] = React.useState(false);
  const [guildState, setGuildState] = React.useState<any | undefined>(undefined);
  const [guildHydrated, setGuildHydrated] = React.useState(false);
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

  const refreshBankingState = React.useCallback(async () => {
    try {
      const nextState = await fetchBankingStateV1();
      setBankingState(nextState);
    } catch {
      setBankingState(undefined);
    } finally {
      setBankingHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshBankingState();
  }, [refreshBankingState]);

  const refreshGuildState = React.useCallback(async () => {
    try {
      const nextState = await fetchBiomesUIGuildStateV1();
      setGuildState(nextState);
    } catch {
      setGuildState(undefined);
    } finally {
      setGuildHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshGuildState();
  }, [refreshGuildState]);

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
    const hotbarItems = normalizeContainer(inventory?.hotbar);
    const currencyItems = normalizeContainer(inventory?.currencies);
    const equipmentItems = normalizeAssignment(wearing?.items);

    const publishSwap = (src: InventoryUiRef, dst: InventoryUiRef) => {
      try {
        fireAndForget(
          events.publish(
            new InventorySwapEvent({
              player_id: userId,
              src_id: userId,
              src: normalizeUiRef(src),
              dst_id: userId,
              dst: normalizeUiRef(dst),
              positions: localPlayerPositionList(reactResources),
            }),
          ),
        );
      } catch {}
    };

    const inventoryAdapter = {
      getBackpack: () => {
        const uiItems = backpackItems.map((slot: any, index: number) =>
          slotToInventoryUiItem(slot, `bag_${index + 1}`, { kind: "item", idx: index }, "backpack"),
        );
        const currentWeight = backpackItems.reduce((sum: number, slot: any) => {
          const count = countToNumber(slot?.count) ?? 1;
          return slot ? sum + itemWeight(slot) * Math.max(1, count) : sum;
        }, 0);
        const maxWeight = 25;
        return {
          items: uiItems,
          maxSlots: Math.max(32, backpackItems.length || 0),
          usedSlots: backpackItems.filter(Boolean).length,
          capacityLabel: "ECS inventory",
          weight: { current: currentWeight, max: maxWeight, overLimit: currentWeight > maxWeight },
        };
      },
      getEquipment: () =>
        equipmentItems.map(([key, item]: [string, any]) => ({
          id: key,
          label: key.replace(/_/g, " "),
          ref: { kind: "wearable", key },
          item: slotToInventoryUiItem(
            { item, count: 1 },
            `wearable_${key}`,
            { kind: "wearable", key },
            "equipment",
          ),
        })),
      getCurrencies: () =>
        currencyItems
          .filter((entry: any) => isCurrencySlot(entry) && (countToNumber(entry?.count ?? entry?.amount) ?? 0) !== 0 && hasExplicitItemName(entry))
          .map((entry: any) => ({
            id: String(entry?.item?.id ?? entry?.id),
            name: readableItemName(entry, String(entry?.item?.id ?? entry?.id)),
            amount: countToNumber(entry?.count ?? entry?.amount) ?? 0,
            icon: "◉",
          })),
      getSelectedItem: () => {
        const selected = inventory?.selected;
        if (!selected?.ref) return null;
        const ref = selected.ref as InventoryUiRef;
        if (ref.kind === "item") {
          return slotToInventoryUiItem(backpackItems[Number(ref.idx ?? 0)], "selected_item", ref, "backpack");
        }
        if (ref.kind === "hotbar") {
          return slotToInventoryUiItem(hotbarItems[Number(ref.idx ?? 0)], "selected_hotbar", ref, "hotbar");
        }
        return null;
      },
      selectItem: (ref: InventoryUiRef) => {
        try {
          fireAndForget(events.publish(new InventoryChangeSelectionEvent({ id: userId, ref: normalizeUiRef(ref) })));
        } catch {}
      },
      useItem: (ref: InventoryUiRef) => {
        try {
          fireAndForget(events.publish(new InventoryChangeSelectionEvent({ id: userId, ref: normalizeUiRef(ref) })));
        } catch {}
      },
      equipItem: (ref: InventoryUiRef, equipSlot?: string) => {
        const key = equipSlot || "main_hand";
        publishSwap(ref, { kind: "wearable", key });
      },
      unequipItem: (ref: InventoryUiRef) => {
        const emptyIndex = Math.max(0, backpackItems.findIndex((slot: any) => !slot));
        publishSwap(ref, { kind: "item", idx: emptyIndex < 0 ? 0 : emptyIndex });
      },
      moveItem: (src: InventoryUiRef, dst: InventoryUiRef) => publishSwap(src, dst),
      splitStack: (src: InventoryUiRef, dst: InventoryUiRef, count: number) => {
        try {
          fireAndForget(
            events.publish(
              new InventorySplitEvent({
                player_id: userId,
                src_id: userId,
                src: normalizeUiRef(src),
                dst_id: userId,
                dst: normalizeUiRef(dst),
                count: optionalCountToBigInt(count) ?? 1n,
                positions: localPlayerPositionList(reactResources),
              }),
            ),
          );
        } catch {}
      },
      combineStack: (src: InventoryUiRef, dst: InventoryUiRef, count: number) => {
        try {
          fireAndForget(
            events.publish(
              new InventoryCombineEvent({
                player_id: userId,
                src_id: userId,
                src: normalizeUiRef(src),
                dst_id: userId,
                dst: normalizeUiRef(dst),
                count: optionalCountToBigInt(count) ?? 1n,
                positions: localPlayerPositionList(reactResources),
              }),
            ),
          );
        } catch {}
      },
      dropItem: (ref: InventoryUiRef, count?: number) => {
        try {
          fireAndForget(throwInventoryItem(clientContext as any, userId, normalizeUiRef(ref), optionalCountToBigInt(count)));
        } catch {}
      },
      destroyItem: (ref: InventoryUiRef, count?: number) => {
        try {
          fireAndForget(destroyInventoryItem(clientContext as any, userId, normalizeUiRef(ref), optionalCountToBigInt(count)));
        } catch {}
      },
      sortInventory: () => {
        try {
          fireAndForget(events.publish(new InventorySortEvent({ id: userId })));
        } catch {}
      },
    };

    const guildDepositCandidates = backpackItems
      .map((slot: any, index: number) => slotToInventoryUiItem(slot, `bag_${index + 1}`, { kind: "item", idx: index }, "backpack"))
      .filter((item: InventoryUiItem | null): item is InventoryUiItem => !!item)
      .map((item: InventoryUiItem) => ({
        id: item.id,
        name: item.label,
        icon: typeof item.icon === "string" && /^https?:\/\//.test(item.icon) ? "◼" : item.icon,
        quantity: item.count ?? 1,
        category: item.category,
        estimatedGoldValue: Math.max(1, Math.ceil((item.count ?? 1) * itemWeight({ item: { category: item.category, displayName: item.label } }))),
      }));

    const guildAdapter = createBiomesUIGuildsAdapterV1({
      state: guildState,
      hydrated: guildHydrated,
      setState: setGuildState,
      refresh: refreshGuildState,
      inventoryDepositCandidates: guildDepositCandidates,
      guildHallCandidates: [],
    });

    return {
      inventory: inventoryAdapter,
      map: buildMapAdapter(snapshotRevision),
      guilds: guildAdapter,
      banking: {
        isHydrated: () => bankingHydrated,
        getCurrencies: inventoryAdapter.getCurrencies,
        getDepositCandidates: () =>
          backpackItems
            .map((slot: any, index: number) => slotToInventoryUiItem(slot, `bag_${index + 1}`, { kind: "item", idx: index }, "backpack"))
            .filter((item: InventoryUiItem | null): item is InventoryUiItem => !!item)
            .map((item: InventoryUiItem) => ({
              id: item.id,
              name: item.label,
              icon: typeof item.icon === "string" && /^https?:\/\//.test(item.icon) ? "◼" : item.icon,
              quantity: item.count ?? 1,
              category: item.category,
            })),
        getVault: (kind: "personal" | "account" | "materials" = "personal") => {
          const source = kind === "account"
            ? bankingState?.accountVault
            : kind === "materials"
              ? bankingState?.materialStorage
              : bankingState?.personalVault;
          return {
            items: dictionaryToVaultItems(source?.items),
            maxSlots: Number(source?.maxSlots ?? 0),
            usedSlots: Number(source?.usedSlots ?? 0),
          };
        },
        getLoans: () => Array.isArray(bankingState?.loans) ? bankingState.loans : [],
        getLogs: () => Array.isArray(bankingState?.transactionLogs) ? bankingState.transactionLogs : [],
        getNextUpgradeCost: (kind: "personal" | "account" | "materials") => {
          const value = bankingState?.nextUpgradeCosts?.[kind];
          return Number.isFinite(Number(value)) ? Number(value) : undefined;
        },
        deposit: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("deposit", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        withdraw: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("withdraw", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        depositAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_deposit", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        withdrawAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_withdraw", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        depositMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_deposit", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        withdrawMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_withdraw", { itemId, count });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        upgradeSlots: async (kind: "personal" | "account" | "materials") => {
          const body = await submitBankingLiveModeAction("upgrade_slots", { vaultKind: kind });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        takeLoan: async (amount: number, days: number) => {
          const body = await submitBankingLiveModeAction("take_loan", { amount, days });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
        repayLoan: async (loanId: string | undefined, amount: number) => {
          const body = await submitBankingLiveModeAction("repay_loan", { loanId, amount });
          setBankingState(body?.bankingState ?? await fetchBankingStateV1());
        },
      },
      land: {
        getPlots: () => BUILDING_SYSTEM_PLOTS_V1,
        getBlueprints: () => BUILDING_SYSTEM_BLUEPRINTS_V1,
        getOwnedPlotIds: () => [],
        getPlacedStructureIds: () => [],
        submitBuildingAction: submitBuildingSystemLiveModeAction,
      },
    };
  }, [bankingHydrated, bankingState, clientContext, events, guildHydrated, guildState, inventory?.currencies, inventory?.hotbar, inventory?.items, inventory?.selected, reactResources, refreshGuildState, snapshotRevision, userId, wearing?.items]);

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
