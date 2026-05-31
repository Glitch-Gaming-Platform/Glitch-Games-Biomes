import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  HARTHMERE_INVENTORY_EVENT,
  performHarthmereBackpackItemUseForBiomesUI,
  readHarthmereInventoryState,
  type HarthmereItemInstance,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  BUILDING_SYSTEM_BLUEPRINTS_V1,
  BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1,
  BUILDING_SYSTEM_PLOTS_V1,
} from "@/shared/harthmere/building_system_v1";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { iconUrl } from "@/client/components/inventory/icons";
import {
  destroyInventoryItem,
  throwInventoryItem,
} from "@/client/game/helpers/inventory";
import { publishHarthmereLiveEntityCombatMotionToRendererV1 } from "@/client/game/resources/harthmere_live_entity_motion_bridge_v1";
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
import {
  createBiomesUIGuildsAdapterV1,
  fetchBiomesUIGuildStateV1,
} from "./guildsLiveAdapter";
import * as React from "react";
import type { BiomesUIAdapters } from "../BiomesUI";
import {
  BIOMES_UI_OPEN_MENU_KEY_CODE,
  BIOMES_UI_OPEN_MENU_TAB,
  type TabKey,
} from "../BiomesUITypes";
import type { HotbarSlotItem } from "../hotbar/BiomesHotbar";
import type {
  InventoryContainerKey,
  InventoryUiItem,
  InventoryUiRef,
} from "../tabs/InventoryTab";
import type { CurrentStep } from "../tutorial/TutorialDirector";
import {
  cuesForAuthoredTutorialStep,
  type StepTarget,
  type StepTrigger,
} from "../tutorial/tutorialMissionMap";
import { abilityVisibleInBiomesLibraryForTest } from "./abilityLibraryVisibility";
import { mergeInventoryAndHotbarForBiomesBackpackForTest } from "./inventoryAdapterHelpers";
import { readableMapMarkerLabelForTest } from "./mapMarkerLabels";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  readActiveBiomesUIMapPinV142,
  writeActiveBiomesUIMapPinV142,
} from "./mapPinnedDestination";
import { appendHarthmereBusinessOutpostMapLandmarksV1 } from "./harthmereBusinessMapMarkersV1";
import {
  activeJobsBoardMissionStepsForBiomesUIV1,
  firstActiveJobsBoardQuestTitleForBiomesUIV1,
  jobsBoardAcceptedJobLandmarksForBiomesUIV1,
  jobsBoardTrackableQuestsForBiomesUIV1,
} from "./jobsBoardQuestMapAdapter";
import {
  BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE_V1,
  activeLiveEntityHelperMissionStepsForBiomesUIV1,
  firstActiveLiveEntityHelperQuestTitleForBiomesUIV1,
  liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1,
  liveEntityHelperTrackableQuestsForBiomesUIV1,
} from "./liveEntityHelperQuestMapAdapter";
import {
  fetchHarthmereJobsBoardStateV1,
  HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT_V1,
  normalizeHarthmereJobsBoardSnapshotV1,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  LIVE_ENTITY_HELPER_QUEST_EVENT_V1,
  readLiveEntityHelperQuestStateV1,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import { LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT_V1 } from "@/client/components/challenges/liveEntityHelperQuestLiveAdapter";
import {
  dailyTodoProgressForTest,
  dailyTodoTasksFromCareSnapshotForTest,
} from "./dailyTodoAdapter";
import {
  biomesInventoryItemIconV1,
  humanizeBiomesInventoryItemIdV1,
} from "./inventoryItemPresentation";
import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "./playerStatusAdapter";
import {
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS_V1 } from "@/shared/harthmere/mmo_medical_health_v1";
import { HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130 } from "@/shared/harthmere/snapshot_grove_trigger_contract_v130";
import {
  buildFarmingFoodInterfaceModelForTest,
  farmingFoodQuickActionForKeyV1,
  type FarmingFoodInterfaceActionV1,
} from "./farmingFoodInterfaceAdapter";
import {
  buildBiomesUIMapAdapter,
} from "./mapLiveAdapter";

export const BIOMES_UI_OPEN_TAB_EVENT = "biomes-ui-open-tab";

const BIOMES_UI_KEY_TO_TAB: Record<string, TabKey> = {
  [BIOMES_UI_OPEN_MENU_KEY_CODE]: BIOMES_UI_OPEN_MENU_TAB,
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

const BIOMES_UI_TAB_TO_GARDEN_HOSE_TABS: Partial<Record<TabKey, string[]>> = {
  daily: ["daily"],
  inventory: ["inventory"],
  abilities: ["tasks"],
  skills: ["skills"],
  classes: ["classes"],
  land: ["building"],
  loot: ["loot"],
  guilds: ["tasks"],
  banking: ["banking"],
  map: ["map", "journal", "quests"],
  collections: ["collections"],
  inbox: ["inbox"],
  options: ["settings"],
};

const HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX_V132 = "harthmere:";

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
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
  return humanizeBiomesInventoryItemIdV1(itemId, fallback);
}

function readableItemName(slot: any, fallback: string): string {
  const item = slot?.item ?? slot;
  const explicit =
    item?.displayName ?? item?.display_name ?? item?.name ?? item?.label;
  if (typeof explicit === "string" && explicit.trim().length > 0)
    return explicit;
  const itemId = item?.id;
  return typeof itemId === "string"
    ? humanizeRealItemId(itemId, fallback)
    : fallback;
}

function hasExplicitItemName(slot: any): boolean {
  const item = slot?.item ?? slot;
  return [item?.displayName, item?.display_name, item?.name, item?.label].some(
    (value) => typeof value === "string" && value.trim().length > 0
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
  const itemId = String(item?.id ?? item?.itemId ?? "").toLowerCase();
  if (HARTHMERE_FOOD_DEFINITIONS_V1[itemId]) return "consumables";
  if (HARTHMERE_MEDICAL_ITEM_DEFINITIONS_V1[itemId]) return "consumables";
  if (HARTHMERE_SEED_DEFINITIONS_V1[itemId]) return "materials";
  if (itemId === "raw_meat") return "materials";
  const raw = String(
    item?.category ??
      item?.inventoryCategory ??
      item?.displayCategory ??
      item?.action ??
      "item"
  ).toLowerCase();
  if (item?.isQuest) return "quest";
  if (
    item?.isWearable ||
    item?.wearableSlot ||
    item?.slot ||
    raw.includes("wear")
  )
    return "gear";
  if (raw.includes("tool") || raw.includes("weapon")) return "tools";
  if (
    raw.includes("block") ||
    raw.includes("material") ||
    raw.includes("resource")
  )
    return "materials";
  if (raw.includes("food") || raw.includes("potion") || raw.includes("consume"))
    return "consumables";
  return raw;
}

function dispatchBiomesUITutorialItemUseV132(
  item: {
    id?: string;
    itemId?: string;
    label?: string;
    itemName?: string;
    category?: string;
    subtype?: string;
    useEffect?: string;
    instanceId?: string;
  },
  source: string
) {
  if (typeof window === "undefined") return;
  const itemId = String(item.itemId ?? item.id ?? "");
  if (!itemId) return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130, {
      detail: {
        itemId,
        itemName:
          item.itemName ?? item.label ?? humanizeRealItemId(itemId, itemId),
        category: item.category,
        subtype: item.subtype ?? item.category,
        useEffect: item.useEffect ?? item.category,
        instanceId: item.instanceId,
        source,
      },
    })
  );
}

function isLocalHarthmereItemRefV132(ref: InventoryUiRef) {
  return (
    ref.kind === "item" &&
    typeof ref.key === "string" &&
    ref.key.startsWith(HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX_V132)
  );
}

function localHarthmereInstanceIdFromRefV132(ref: InventoryUiRef) {
  return isLocalHarthmereItemRefV132(ref)
    ? String(ref.key).slice(
        HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX_V132.length
      )
    : undefined;
}

function localHarthmereBackpackItemToUiItemV132(
  item: HarthmereItemInstance,
  index: number
): InventoryUiItem {
  const itemId = String(item.itemId);
  const category = inferInventoryCategory({ id: itemId });
  return {
    id: itemId,
    label: humanizeRealItemId(itemId, itemId),
    icon: biomesInventoryItemIconV1(itemId),
    count: Math.max(1, Number(item.quantity ?? 1) || 1),
    quality: item.bound ? "quest" : "common",
    category,
    description: "Prepared for the active tutorial.",
    ref: {
      kind: "item",
      idx: index,
      key: `${HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX_V132}${item.instanceId}`,
    },
    source: "backpack",
    storageLocation: "backpack",
    canUse: true,
    canEquip: false,
    canMove: false,
    canSplit: false,
    canDrop: false,
    canDestroy: false,
    protectedReason: "Tutorial items stay in your backpack for this lesson.",
  };
}

function isLocalHarthmereConsumableUseItemV132(itemId: string) {
  return (
    !!HARTHMERE_FOOD_DEFINITIONS_V1[itemId] ||
    !!HARTHMERE_MEDICAL_ITEM_DEFINITIONS_V1[itemId]
  );
}

function inferEquipSlot(item: any): string | undefined {
  const slot =
    item?.wearableSlot ??
    item?.wearable_slot ??
    item?.slot ??
    item?.equipmentSlot;
  if (slot) return String(slot).toLowerCase();
  const text = `${item?.displayName ?? item?.name ?? ""} ${
    item?.action ?? ""
  }`.toLowerCase();
  if (text.includes("helmet") || text.includes("hat")) return "head";
  if (
    text.includes("chest") ||
    text.includes("shirt") ||
    text.includes("armor")
  )
    return "chest";
  if (text.includes("pants") || text.includes("legs")) return "legs";
  if (text.includes("boots") || text.includes("shoes") || text.includes("feet"))
    return "feet";
  if (text.includes("gloves") || text.includes("hands")) return "hands";
  if (text.includes("shield")) return "off_hand";
  if (
    text.includes("sword") ||
    text.includes("pickaxe") ||
    text.includes("axe") ||
    text.includes("wand") ||
    text.includes("staff")
  )
    return "main_hand";
  return undefined;
}

function itemDescription(item: any): string | undefined {
  return (
    item?.description ?? item?.tooltip ?? item?.flavorText ?? item?.subtitle
  );
}

function itemDurability(
  item: any
): { current: number; max: number } | undefined {
  const current = Number(
    item?.durability ?? item?.durabilityCurrent ?? item?.hp
  );
  const max = Number(item?.maxDurability ?? item?.durabilityMax ?? item?.maxHp);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0)
    return undefined;
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
  return (
    !!item?.isCurrency ||
    String(item?.kind ?? item?.category ?? "")
      .toLowerCase()
      .includes("currency")
  );
}

function dictionaryToVaultItems(
  items: Record<string, number> | undefined
): Array<{ id: string; name: string; icon: string; quantity: number } | null> {
  return Object.entries(items ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([itemId, count]) => ({
      id: itemId,
      name: humanizeRealItemId(itemId, itemId),
      icon: biomesInventoryItemIconV1(itemId),
      quantity: Number(count) || 0,
    }));
}

function slotToInventoryUiItem(
  slot: any,
  fallback: string,
  ref: InventoryUiRef,
  source: InventoryContainerKey
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
    storageLocation: source,
    canUse: true,
    canEquip: true,
    canMove: true,
    canSplit: true,
    canDrop: inferInventoryCategory(item) !== "quest",
    canDestroy: inferInventoryCategory(item) !== "quest",
    protectedReason:
      inferInventoryCategory(item) === "quest"
        ? "Quest items stay with your quest pouch."
        : undefined,
  };
}

function normalizeAssignment(assignment: unknown): Array<[string, any]> {
  if (!assignment) return [];
  if (assignment instanceof Map)
    return Array.from(assignment.entries()).map(([key, value]) => [
      String(key),
      value,
    ]);
  if (typeof (assignment as any).entries === "function") {
    return Array.from((assignment as any).entries()).map(
      ([key, value]: any) => [String(key), value]
    );
  }
  if (typeof assignment === "object")
    return Object.entries(assignment as Record<string, unknown>);
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
    const position = id
      ? reactResources.get("/ecs/c/position", id)?.v
      : undefined;
    return position ? [position] : [];
  } catch {
    return [];
  }
}

function normalizeContainer(container: unknown): any[] {
  if (!container) return [];
  if (Array.isArray(container)) return container;
  if (typeof (container as any)[Symbol.iterator] === "function")
    return Array.from(container as Iterable<any>);
  if (Array.isArray((container as any).items)) return (container as any).items;
  if (typeof container === "object")
    return Object.values(container as Record<string, unknown>);
  return [];
}

function readSnapshotGroveApi(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).__snapshotGroveV75;
}

function normalizeMarkerId(markerId: string): string {
  const lower = markerId.toLowerCase();
  if (
    lower.includes("mira") ||
    lower.includes("miranda") ||
    lower.includes("steward")
  )
    return "mira_grove_land_steward";
  if (lower.includes("jackie")) return "jackie";
  if (lower.includes("road")) return "road_marker";
  if (lower.includes("muck")) return "muckwad_patch";
  if (lower.includes("build") || lower.includes("place"))
    return "building_spot";
  if (
    lower.includes("selfie") ||
    lower.includes("overlook") ||
    lower.includes("camera")
  )
    return "selfie_overlook";
  return markerId.replace(/^npc_/, "").replace(/^grove_/, "");
}

function deriveTutorialTarget(
  objective: string,
  markerId: string
): StepTarget | undefined {
  const text = `${objective} ${markerId}`.toLowerCase();
  if (
    text.includes("mira") ||
    text.includes("miranda") ||
    text.includes("steward")
  )
    return "building_spot";
  if (text.includes("jackie")) return "jackie";
  if (text.includes("road")) return "road_marker";
  if (text.includes("muck")) return "muckwad_patch";
  if (text.includes("build") || text.includes("place")) return "building_spot";
  if (
    text.includes("wardrobe") ||
    text.includes("wear") ||
    text.includes("equip")
  )
    return "wardrobe";
  if (text.includes("jump") || text.includes("sprint") || text.includes("run"))
    return "jump_run";
  if (
    text.includes("selfie") ||
    text.includes("photo") ||
    text.includes("camera")
  )
    return "selfie_overlook";
  if (text.includes("craft") || text.includes("recipe")) return "crafting_stop";
  if (text.includes("grove")) return "grove";
  return undefined;
}

function deriveTutorialTrigger(
  rawTrigger: string,
  objective: string
): StepTrigger | undefined {
  const text = `${rawTrigger} ${objective}`.toLowerCase();
  if (text.includes("talk") || text.includes("dialog")) return "dialog";
  if (
    text.includes("destroy") ||
    text.includes("break") ||
    text.includes("muck")
  )
    return "destroy";
  if (text.includes("place")) return "place_voxel";
  if (text.includes("wear") || text.includes("equip")) return "wearing";
  if (text.includes("jump") || text.includes("sprint") || text.includes("run"))
    return "running_jump";
  if (
    text.includes("photo") ||
    text.includes("camera") ||
    text.includes("selfie")
  )
    return "photo";
  if (text.includes("craft")) return "craft_muck_buster";
  if (
    text.includes("location") ||
    text.includes("near") ||
    text.includes("marker")
  )
    return "location";
  if (text.includes("open_tab")) return "location";
  return undefined;
}

function deriveSnapshotTutorialStep(): CurrentStep | null {
  const api = readSnapshotGroveApi();
  const state = api?.readState?.();
  const quests = Array.isArray(api?.quests) ? api.quests : [];
  const activeQuest = quests.find(
    (quest: any) => quest?.id === state?.activeQuestId
  );
  if (!activeQuest || state?.completedQuestIds?.includes?.(activeQuest.id))
    return null;

  const objectiveIndex = Math.max(0, Number(state?.activeObjectiveIndex ?? 0));
  const objective = String(activeQuest.objectives?.[objectiveIndex] ?? "");
  const rawTrigger = String(activeQuest.triggers?.[objectiveIndex] ?? "");
  const markerId = String(activeQuest.markerIds?.[objectiveIndex] ?? "");
  const target = deriveTutorialTarget(objective, markerId);
  const trigger = deriveTutorialTrigger(rawTrigger, objective);
  const cues = cuesForAuthoredTutorialStep({
    questId: activeQuest.id,
    objective,
    objectiveIndex,
    trigger: rawTrigger,
    markerId,
  });
  if ((!target || !trigger) && cues.length === 0) return null;

  return {
    stepId: `${activeQuest.id}:${objectiveIndex}`,
    target: target ?? "grove",
    trigger: trigger ?? "location",
    cues,
  };
}

function dispatchLiveModePlayerStatusFromBodyV1(body: any) {
  if (typeof window === "undefined") return;
  publishLiveModeCombatMotionFromBodyV1(body);
  if (!body?.playerStatusState) return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
      detail: body.playerStatusState,
    })
  );
}

function publishLiveModeCombatMotionFromBodyV1(body: any) {
  if (body?.combatState) {
    publishHarthmereLiveEntityCombatMotionToRendererV1(body.combatState);
  }
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

async function fetchInventoryLootStateV135(): Promise<any | undefined> {
  const response = await fetch(
    "/api/harthmere/live_mode_inventory_loot_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.inventoryLootState;
}

async function fetchProgressionStateV1(): Promise<any | undefined> {
  const response = await fetch("/api/harthmere/live_mode_progression_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.progressionState;
}

async function fetchDailyStateV1(): Promise<any | undefined> {
  const response = await fetch("/api/harthmere/live_mode_daily_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.dailyState;
}

async function fetchFarmingFoodStateV1(): Promise<any | undefined> {
  const response = await fetch("/api/harthmere/live_mode_farming_food_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.farmingFoodState;
}

function isLiveUsableBackpackItemV1(itemId: string) {
  return (
    !!HARTHMERE_FOOD_DEFINITIONS_V1[itemId] ||
    !!HARTHMERE_MEDICAL_ITEM_DEFINITIONS_V1[itemId] ||
    itemId === "raw_meat"
  );
}

function stackRecordToInventoryUiItemsV135(
  items: Record<string, number> | undefined,
  source: InventoryContainerKey,
  refKind: "item" | "hotbar" | "wearable" = "item",
  options: {
    description?: string;
    canUse?: boolean;
    canEquip?: boolean;
    canMove?: boolean;
    canSplit?: boolean;
    canDrop?: boolean;
    canDestroy?: boolean;
    protectedReason?: string;
  } = {}
): InventoryUiItem[] {
  return Object.entries(items ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([itemId, count], index) => ({
      id: itemId,
      label: humanizeRealItemId(itemId, itemId),
      icon: biomesInventoryItemIconV1(itemId),
      count: Number(count) || 0,
      quality: "common" as InventoryUiItem["quality"],
      category: inferInventoryCategory({ id: itemId }),
      description: options.description ?? "Stored in your backpack.",
      ref: (refKind === "wearable"
        ? { kind: "wearable", key: itemId }
        : { kind: refKind, idx: index }) as InventoryUiRef,
      source,
      storageLocation: source,
      canUse: options.canUse ?? isLiveUsableBackpackItemV1(itemId),
      canEquip: options.canEquip ?? false,
      canMove: options.canMove ?? false,
      canSplit: options.canSplit ?? false,
      canDrop: options.canDrop ?? false,
      canDestroy: options.canDestroy ?? false,
      protectedReason:
        options.protectedReason ??
        (isLiveUsableBackpackItemV1(itemId)
          ? undefined
          : "This item uses protected inventory handling."),
    }));
}

function instanceRecordToInventoryUiItemsV135(
  instanceIds: string[] | undefined,
  instances: Record<string, any> | undefined,
  indexOffset = 0
): InventoryUiItem[] {
  return (instanceIds ?? []).flatMap((instanceId, index): InventoryUiItem[] => {
    const instance = instances?.[instanceId];
    if (!instance || instance.location === "destroyed") {
      return [];
    }
    const itemId = String(instance.itemId ?? instanceId);
    const count = Math.max(1, Math.trunc(Number(instance.quantity ?? 1) || 1));
    return [
      {
        id: instanceId,
        label: humanizeRealItemId(itemId, itemId),
        icon:
          biomesInventoryItemIconV1(itemId) === "◼"
            ? "◈"
            : biomesInventoryItemIconV1(itemId),
        count,
        quality: "common" as InventoryUiItem["quality"],
        category: inferInventoryCategory({
          id: itemId,
          category: instance.category,
        }),
        description: [
          instance.sourceKind
            ? `Found from ${humanizeRealItemId(
                String(instance.sourceKind),
                String(instance.sourceKind)
              )}`
            : undefined,
          instance.legalFlags?.length
            ? `Marked ${instance.legalFlags
                .map((flag: string) =>
                  humanizeRealItemId(String(flag), String(flag))
                )
                .join(", ")}`
            : undefined,
          instance.contaminated ? "Needs cleaning" : undefined,
          instance.broken ? "Needs repair" : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        durability:
          Number.isFinite(Number(instance.durability)) &&
          Number.isFinite(Number(instance.durabilityMax))
            ? {
                current: Number(instance.durability),
                max: Number(instance.durabilityMax),
              }
            : undefined,
        ref: { kind: "item", idx: indexOffset + index } as InventoryUiRef,
        source: "backpack" as const,
        storageLocation: "backpack" as const,
        canUse: false,
        canEquip: false,
        canMove: false,
        canSplit: false,
        canDrop: false,
        canDestroy: false,
        protectedReason: "This item uses protected inventory handling.",
      },
    ];
  });
}

function lootLedgerEntryToUiV135(
  entry: any,
  index: number,
  instances?: Record<string, any>
) {
  const instance = entry?.instanceId
    ? instances?.[String(entry.instanceId)]
    : undefined;
  const itemId = String(
    entry?.itemId ?? instance?.itemId ?? entry?.instanceId ?? `loot_${index}`
  );
  const at = Number(entry?.atMs ?? entry?.at ?? 0);
  const status = lootRouteStatusV135(entry);
  return {
    id: String(entry?.id ?? `${itemId}_${index}`),
    itemName: humanizeRealItemId(itemId, itemId),
    quantity: Number(entry?.count ?? 1),
    source: String(
      [entry?.sourceKind, entry?.sourceId].filter(Boolean).join(" · ") ||
        entry?.kind ||
        "Loot"
    ),
    quality: String(entry?.quality ?? "common"),
    at: at > 0 ? new Date(at).toLocaleTimeString() : "recent",
    status,
    route: lootRouteLabelV135(status),
  };
}

function lootDropsToUiV135(
  drops: any[] | undefined,
  instances?: Record<string, any>
) {
  return (drops ?? []).flatMap((drop, dropIndex) => {
    const stackEntries = Object.entries(drop?.itemStacks ?? {}).map(
      ([itemId, count], stackIndex) => ({
        id: `${drop?.dropId ?? "drop"}_${itemId}_${stackIndex}`,
        itemName: humanizeRealItemId(itemId, itemId),
        quantity: Number(count ?? 1),
        source: String(
          [drop?.sourceKind, drop?.sourceId].filter(Boolean).join(" · ") ||
            "Available drop"
        ),
        quality: "common",
        at: drop?.createdAtMs
          ? new Date(Number(drop.createdAtMs)).toLocaleTimeString()
          : `drop ${dropIndex + 1}`,
        status: "available",
        route: "Unclaimed",
        dropId: String(drop?.dropId ?? ""),
        expiresAt: drop?.expiresAtMs
          ? `Expires ${new Date(Number(drop.expiresAtMs)).toLocaleTimeString()}`
          : undefined,
      })
    );
    const instanceEntries = (drop?.instanceIds ?? []).flatMap(
      (instanceId: string, instanceIndex: number) => {
        const instance = instances?.[String(instanceId)];
        if (!instance || instance.location === "destroyed") return [];
        const itemId = String(instance.itemId ?? instanceId);
        return [
          {
            id: `${drop?.dropId ?? "drop"}_${instanceId}_${instanceIndex}`,
            itemName: humanizeRealItemId(itemId, itemId),
            quantity: Math.max(
              1,
              Math.trunc(Number(instance.quantity ?? 1) || 1)
            ),
            source: String(
              [drop?.sourceKind, drop?.sourceId].filter(Boolean).join(" · ") ||
                "Available drop"
            ),
            quality: String(instance.quality ?? "common"),
            at: drop?.createdAtMs
              ? new Date(Number(drop.createdAtMs)).toLocaleTimeString()
              : `drop ${dropIndex + 1}`,
            status: "available",
            route: "Unclaimed",
            dropId: String(drop?.dropId ?? ""),
            expiresAt: drop?.expiresAtMs
              ? `Expires ${new Date(
                  Number(drop.expiresAtMs)
                ).toLocaleTimeString()}`
              : undefined,
          },
        ];
      }
    );
    return [...stackEntries, ...instanceEntries];
  });
}

function lootRouteStatusV135(
  entry: any
): "claimed" | "wallet" | "material_storage" | "overflow" | "guild_vault" {
  const kind = String(entry?.kind ?? entry?.route ?? "").toLowerCase();
  const itemId = String(entry?.itemId ?? "").toLowerCase();
  if (kind.includes("wallet") || kind.includes("currency") || itemId === "gold")
    return "wallet";
  if (kind.includes("material")) return "material_storage";
  if (kind.includes("overflow")) return "overflow";
  if (kind.includes("guild")) return "guild_vault";
  return "claimed";
}

function lootRouteLabelV135(status: string): string {
  if (status === "wallet") return "Wallet";
  if (status === "material_storage") return "Material Storage";
  if (status === "overflow") return "Overflow";
  if (status === "guild_vault") return "Guild Vault";
  return "Backpack";
}

async function submitBankingLiveModeAction(
  operation: string,
  payload: Record<string, unknown> = {}
): Promise<any> {
  const requestId = `biomes_ui_bank_${operation}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
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
    throw new Error(
      Array.isArray(body?.validation?.errors)
        ? body.validation.errors.join(",")
        : `bank_request_failed:${operation}`
    );
  }
  return body;
}

async function submitProgressionLiveModeAction(
  actionKind:
    | "request_trainer_unlock"
    | "request_loadout_change"
    | "request_quest_state_update",
  subsystem: "trainer" | "loadout" | "quest",
  payload: Record<string, unknown> = {}
): Promise<any> {
  const requestId = `biomes_ui_progression_${actionKind}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind,
      subsystem,
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload,
      clientClaims: {},
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error(
      Array.isArray(body?.validation?.errors)
        ? body.validation.errors.join(",")
        : `progression_request_failed:${actionKind}`
    );
  }
  return body;
}

async function submitDailyLiveModeAction(activityId: string): Promise<any> {
  const requestId = `biomes_ui_daily_${activityId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_care_loop_action",
      subsystem: "care",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        operation: "daily_check_in",
        targetId: activityId,
      },
      clientClaims: {},
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error(
      Array.isArray(body?.validation?.errors)
        ? body.validation.errors.join(",")
        : `daily_reward_failed:${activityId}`
    );
  }
  return body;
}

async function submitFarmingFoodLiveModeAction(
  operation: string,
  payload: Record<string, unknown> = {}
): Promise<any> {
  const requestId = `biomes_ui_farming_food_${operation}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_farming_action",
      subsystem: "farming",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: { operation, ...payload },
      clientClaims: {},
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error(
      Array.isArray(body?.validation?.errors)
        ? body.validation.errors.join(",")
        : `farming_food_failed:${operation}`
    );
  }
  return body;
}

async function submitMedicalLiveModeAction(
  operation: string,
  payload: Record<string, unknown> = {}
): Promise<any> {
  const requestId = `biomes_ui_medical_${operation}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_medical_action",
      subsystem: "medical",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: { operation, ...payload },
      clientClaims: {},
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok === false) {
    throw new Error(
      Array.isArray(body?.validation?.errors)
        ? body.validation.errors.join(",")
        : `medical_failed:${operation}`
    );
  }
  return body;
}

// Building System UI state is hydrated from /api/harthmere/live_mode via
// the read_state action. Do not use browser storage as a source of ownership truth.

// BIOMES_UI_MAP_ADAPTER_V141:
// Live map adapter feeds the upgraded MapQuestsTab with everything the
// player should see: their own position (from /scene/local_player), Grove
// landmarks, Harthmere business outposts, Jobs Board, all known NPCs, the
// active quest's marker path (highlighted), and the canonical map bounds.
// Coordinates are computed from world XZ via live landmark bounds, so markers
// stay correctly placed when the user pans/zooms in the tab. No hardcoded
// percentages.
export function buildBiomesUIMapAdapterForTest(
  snapshotRevision: number,
  playerWorldPos?: [number, number, number],
  jobsBoardState?: unknown
) {
  const QuestIds = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const ActiveSnapshotQuest = (quests: any[], state: any) => {
    const completed = new Set(QuestIds(state?.completedQuestIds));
    const activeQuestId =
      typeof state?.activeQuestId === "string" &&
      !completed.has(state.activeQuestId)
        ? state.activeQuestId
        : undefined;
    const acceptedQuestId = QuestIds(state?.acceptedQuestIds).find(
      (questId) => !completed.has(questId)
    );
    const questId = activeQuestId ?? acceptedQuestId;
    return quests.find((quest: any) => quest?.id === questId);
  };
  const NormalizeWorldXZ = (
    worldX: number,
    worldZ: number,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  ) => {
    const x = (worldX - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX);
    const y = (worldZ - bounds.minZ) / Math.max(1, bounds.maxZ - bounds.minZ);
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
  const ComputeBounds = (landmarks: any[]) => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const landmark of landmarks) {
      const pos = landmark?.position;
      if (!Array.isArray(pos)) continue;
      const wx = Number(pos[0]);
      const wz = Number(pos[2]);
      if (!Number.isFinite(wx) || !Number.isFinite(wz)) continue;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
    if (!Number.isFinite(minX)) {
      // Fallback: Grove fountain neighborhood.
      return { minX: 360, maxX: 600, minZ: -270, maxZ: -100 };
    }
    // Pad bounds so markers don't sit on the edge.
    const padX = (maxX - minX) * 0.08 || 12;
    const padZ = (maxZ - minZ) * 0.08 || 12;
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minZ: minZ - padZ,
      maxZ: maxZ + padZ,
    };
  };
  const VisibleMapLandmarks = (landmarks: any[]) =>
    landmarks.filter(
      (landmark) => landmark && landmark.visibleOnWorldMap !== false
    );
  const LandmarkKind = (
    landmark: any
  ):
    | "vendor"
    | "store"
    | "business"
    | "bank"
    | "quest"
    | "resource"
    | "danger"
    | "safe_zone"
    | "route"
    | "town"
    | "objective" => {
    const id = String(landmark?.id ?? "").toLowerCase();
    const label = readableMapMarkerLabelForTest(landmark).toLowerCase();
    const kind = String(landmark?.kind ?? "").toLowerCase();
    const area = String(landmark?.area ?? "").toLowerCase();
    if (kind === "objective") return "objective";
    if (kind === "quest") return "quest";
    if (
      kind === "danger" ||
      /danger|enemy|muckwad|threat/.test(id + " " + label)
    )
      return "danger";
    if (
      kind === "resource" ||
      /resource|berry|wood|stone|ore|root/.test(id + " " + label)
    )
      return "resource";
    if (/job|board|notice|kiosk/.test(id + " " + label)) return "quest";
    if (/bank|vault|merl/.test(id + " " + label)) return "bank";
    if (kind === "business" || /business|outpost_/.test(id)) return "business";
    if (
      kind === "interactable" ||
      /shop|store|stall|merchant|kiosk|mira|office|chapel|guild|charter|workbench|table|service|building/.test(
        id + " " + label
      )
    )
      return "store";
    if (
      kind === "npc" ||
      /npc_|jackie|billy|jane|luis|taye|alexis|sil|dimmi|doc|coop|buddy|rosalyn|nia|merl/.test(
        id + " " + label
      )
    )
      return "vendor";
    if (
      kind === "connector" ||
      /road|route|bridge|connector|path/.test(id + " " + label + " " + area)
    )
      return "route";
    if (
      id === "the_grove" ||
      label === "the grove" ||
      /^hal 9000$|^goldie b$/.test(label)
    )
      return "town";
    if (
      kind === "safe_zone" ||
      /safe|fountain|sanctuary/.test(id + " " + label)
    )
      return "safe_zone";
    return "objective";
  };
  const MarkerId = (landmark: any) => {
    const id = String(landmark?.id ?? "");
    return String(landmark?.kind ?? "").toLowerCase() === "business"
      ? id
      : normalizeMarkerId(id);
  };
  const MapLandmarks = () => {
    const api = readSnapshotGroveApi();
    const liveEntityHelperState = readLiveEntityHelperQuestStateV1();
    return appendHarthmereBusinessOutpostMapLandmarksV1([
      ...(Array.isArray(api?.landmarks) ? api.landmarks : []),
      ...jobsBoardAcceptedJobLandmarksForBiomesUIV1(jobsBoardState),
      ...liveEntityHelperAcceptedQuestLandmarksForBiomesUIV1(
        liveEntityHelperState
      ),
    ]);
  };
  return {
    getMapBounds: () => {
      void snapshotRevision;
      const landmarks = MapLandmarks();
      return ComputeBounds(VisibleMapLandmarks(landmarks));
    },
    getPlayerMarker: () => {
      void snapshotRevision;
      if (!playerWorldPos) return undefined;
      const landmarks = MapLandmarks();
      const bounds = ComputeBounds(VisibleMapLandmarks(landmarks));
      const { x, y } = NormalizeWorldXZ(
        playerWorldPos[0],
        playerWorldPos[2],
        bounds
      );
      return {
        id: "local_player",
        label: "You",
        x,
        y,
        kind: "player" as const,
        worldPosition: playerWorldPos,
        description: `World position ${Math.round(
          playerWorldPos[0]
        )}, ${Math.round(playerWorldPos[1])}, ${Math.round(
          playerWorldPos[2]
        )}.`,
      };
    },
    getMarkers: () => {
      void snapshotRevision;
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const landmarks = MapLandmarks();
      const activeQuest = ActiveSnapshotQuest(quests, state);
      const activeMarkerIds: string[] = Array.isArray(activeQuest?.markerIds)
        ? activeQuest.markerIds
        : [];
      const activeObjectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
      const activeObjectiveMarker =
        activeMarkerIds[
          Math.max(
            0,
            Math.min(activeMarkerIds.length - 1, activeObjectiveIndex)
          )
        ];
      const visibleLandmarks = VisibleMapLandmarks(landmarks);
      const bounds = ComputeBounds(visibleLandmarks);

      const result: any[] = [];
      // Always-visible landmarks: NPCs, stores, banks, jobs board, safe zones.
      for (const landmark of visibleLandmarks) {
        const pos = landmark?.position;
        if (!Array.isArray(pos)) continue;
        const { x, y } = NormalizeWorldXZ(
          Number(pos[0]),
          Number(pos[2]),
          bounds
        );
        const kind = LandmarkKind(landmark);
        const isInActiveChain = activeMarkerIds.includes(landmark.id);
        const isCurrentObjective = activeObjectiveMarker === landmark.id;
        const isAcceptedJobMarker =
          landmark?.active === true && kind === "objective";
        const isLiveEntityHelperMarker =
          landmark?.active === true &&
          landmark?.source === BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE_V1;
        const isActiveQuestMarker =
          isCurrentObjective ||
          isInActiveChain ||
          isAcceptedJobMarker ||
          isLiveEntityHelperMarker;
        result.push({
          id: MarkerId(landmark),
          label: readableMapMarkerLabelForTest(landmark),
          x,
          y,
          kind:
            isCurrentObjective ||
            isAcceptedJobMarker ||
            isLiveEntityHelperMarker
              ? ("objective" as const)
              : kind,
          active: isActiveQuestMarker,
          worldPosition: [
            Number(pos[0]),
            Number(pos[1] ?? 0),
            Number(pos[2]),
          ] as [number, number, number],
          description: isLiveEntityHelperMarker
            ? String(landmark.description ?? "Active helper quest target.")
            : isAcceptedJobMarker
            ? String(landmark.description ?? "Accepted jobs board task.")
            : isCurrentObjective
            ? "Current objective — head here to advance the active quest."
            : isInActiveChain
            ? "Part of the active quest path."
            : String(
                landmark.description ??
                  `${landmark.area ?? "Grove"} · ${landmark.kind ?? "landmark"}`
              ),
        });
      }
      // Always include a Mira marker even if the snapshot has not seeded her.
      if (!result.some((marker) => marker.id === "mira_grove_land_steward")) {
        result.push({
          id: "mira_grove_land_steward",
          label: BUILDING_SYSTEM_GROVE_STEWARD_NPC_V1.displayName,
          x: 0.66,
          y: 0.52,
          kind: "store" as const,
        });
      }
      return result;
    },
    getMissionTitle: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = ActiveSnapshotQuest(quests, state);
      const liveEntityHelperState = readLiveEntityHelperQuestStateV1();
      return String(
        activeQuest?.title ??
          firstActiveJobsBoardQuestTitleForBiomesUIV1(jobsBoardState) ??
          firstActiveLiveEntityHelperQuestTitleForBiomesUIV1(
            liveEntityHelperState
          ) ??
          "Current Mission"
      );
    },
    getMissionSteps: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = ActiveSnapshotQuest(quests, state);
      const objectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
      const objectives = Array.isArray(activeQuest?.objectives)
        ? activeQuest.objectives
        : [];
      if (!activeQuest) {
        const jobsBoardSteps =
          activeJobsBoardMissionStepsForBiomesUIV1(jobsBoardState);
        return jobsBoardSteps.length
          ? jobsBoardSteps
          : activeLiveEntityHelperMissionStepsForBiomesUIV1(
              readLiveEntityHelperQuestStateV1()
            );
      }
      return objectives.map((objective: string, index: number) => ({
        id: `${activeQuest?.id ?? "quest"}:${index}`,
        title:
          index < objectiveIndex
            ? `Completed step ${index + 1}`
            : index === objectiveIndex
            ? `Current step ${index + 1}`
            : `Upcoming step ${index + 1}`,
        objective,
        done: index < objectiveIndex,
      }));
    },
    // BIOMES_UI_MAP_TAB_QUESTS_V141:
    // Power the new clickable quest list on the side panel. Each entry is a
    // landmark or marker the player can pin/jump to without touching the
    // world map.
    getTrackableQuests: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = ActiveSnapshotQuest(quests, state);
      const activeQuestId = activeQuest?.id;
      const accepted = QuestIds(state?.acceptedQuestIds);
      const completed = QuestIds(state?.completedQuestIds);
      const authoredQuests = quests
        .filter((quest: any) => quest && quest.id)
        .map((quest: any) => ({
          questId: String(quest.id),
          title: String(quest.title ?? quest.id),
          area: String(quest.area ?? "The Grove"),
          status: completed.includes(quest.id)
            ? ("completed" as const)
            : quest.id === activeQuestId || accepted.includes(quest.id)
            ? ("active" as const)
            : ("available" as const),
          firstMarkerId:
            Array.isArray(quest.markerIds) && quest.markerIds.length
              ? normalizeMarkerId(String(quest.markerIds[0]))
              : undefined,
          reward: String(quest.reward ?? ""),
        }));
      return [
        ...jobsBoardTrackableQuestsForBiomesUIV1(jobsBoardState),
        ...liveEntityHelperTrackableQuestsForBiomesUIV1(
          readLiveEntityHelperQuestStateV1()
        ),
        ...authoredQuests,
      ];
    },
    getActiveMapPin: () => readActiveBiomesUIMapPinV142(),
    setActiveMapPin: (marker: any) => {
      const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
      if (pin) writeActiveBiomesUIMapPinV142(pin);
    },
    clearActiveMapPin: () => writeActiveBiomesUIMapPinV142(undefined),
  };
}

export function dispatchBiomesUIOpenTab(tab: TabKey, source = "legacy"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_OPEN_TAB_EVENT, {
      detail: { tab, source },
    })
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
  const {
    reactResources,
    userId,
    events,
    audioManager,
    chatIo,
    socialManager,
    gardenHose,
  } = clientContext;
  const pointerLockManager = usePointerLockManager();
  const inventory = reactResources.use("/ecs/c/inventory", userId) as any;
  const wearing = reactResources.use("/ecs/c/wearing", userId) as any;
  const hotbarIndex = reactResources.use("/hotbar/index") as { value: number };
  const gameModal = reactResources.use("/game_modal") as GameModal;
  const dmMessages =
    (reactResources.use("/dms") as { messages?: any[] })?.messages ?? [];
  const activityMessages =
    (reactResources.use("/activity") as { messages?: any[] })?.messages ?? [];
  const [snapshotRevision, setSnapshotRevision] = React.useState(0);
  const [harthmereInventoryRevision, setHarthmereInventoryRevision] =
    React.useState(0);
  const [bankingState, setBankingState] = React.useState<any | undefined>(
    undefined
  );
  const [bankingHydrated, setBankingHydrated] = React.useState(false);
  const [guildState, setGuildState] = React.useState<any | undefined>(
    undefined
  );
  const [guildHydrated, setGuildHydrated] = React.useState(false);
  const [inventoryLootState, setInventoryLootState] = React.useState<
    any | undefined
  >(undefined);
  const [inventoryLootHydrated, setInventoryLootHydrated] =
    React.useState(false);
  const [progressionState, setProgressionState] = React.useState<
    any | undefined
  >(undefined);
  const [progressionHydrated, setProgressionHydrated] = React.useState(false);
  const [dailyState, setDailyState] = React.useState<any | undefined>(
    undefined
  );
  const [dailyHydrated, setDailyHydrated] = React.useState(false);
  const [farmingFoodState, setFarmingFoodState] = React.useState<
    any | undefined
  >(undefined);
  const [farmingFoodHydrated, setFarmingFoodHydrated] = React.useState(false);
  const [jobsBoardState, setJobsBoardState] = React.useState<any | undefined>(
    undefined
  );
  const shouldReturnPointerLockRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setSnapshotRevision((value) => value + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(
      "biomes:local-dev-snapshot-grove-quest-state-v75",
      bump
    );
    window.addEventListener(
      "biomes:snapshot-grove-tutor-hud-highlights-v109",
      bump
    );
    window.addEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT_V1, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(
        "biomes:local-dev-snapshot-grove-quest-state-v75",
        bump
      );
      window.removeEventListener(
        "biomes:snapshot-grove-tutor-hud-highlights-v109",
        bump
      );
      window.removeEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT_V1, bump);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setHarthmereInventoryRevision((value) => value + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, bump);
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

  const refreshInventoryLootState = React.useCallback(async () => {
    try {
      const nextState = await fetchInventoryLootStateV135();
      setInventoryLootState(nextState);
    } catch {
      setInventoryLootState(undefined);
    } finally {
      setInventoryLootHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshInventoryLootState();
  }, [refreshInventoryLootState]);

  const refreshProgressionState = React.useCallback(async () => {
    try {
      const nextState = await fetchProgressionStateV1();
      setProgressionState(nextState);
    } catch {
      setProgressionState(undefined);
    } finally {
      setProgressionHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshProgressionState();
  }, [refreshProgressionState]);

  const refreshDailyState = React.useCallback(async () => {
    try {
      const nextState = await fetchDailyStateV1();
      setDailyState(nextState);
    } catch {
      setDailyState(undefined);
    } finally {
      setDailyHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshDailyState();
  }, [refreshDailyState]);

  const refreshFarmingFoodState = React.useCallback(async () => {
    try {
      const nextState = await fetchFarmingFoodStateV1();
      setFarmingFoodState(nextState);
    } catch {
      setFarmingFoodState(undefined);
    } finally {
      setFarmingFoodHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshFarmingFoodState();
  }, [refreshFarmingFoodState]);

  const refreshJobsBoardState = React.useCallback(async () => {
    try {
      setJobsBoardState(await fetchHarthmereJobsBoardStateV1());
    } catch {
      setJobsBoardState(undefined);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshJobsBoardState();
  }, [refreshJobsBoardState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ jobsBoardState?: unknown }>)
        .detail;
      if (detail?.jobsBoardState) {
        setJobsBoardState(
          normalizeHarthmereJobsBoardSnapshotV1(detail.jobsBoardState)
        );
      } else {
        void refreshJobsBoardState();
      }
    };
    window.addEventListener(
      HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT_V1,
      handler
    );
    return () =>
      window.removeEventListener(
        HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT_V1,
        handler
      );
  }, [refreshJobsBoardState]);

  const applyLiveModeInventoryResponse = React.useCallback(
    async (body: any) => {
      if (body?.inventoryLootState) {
        setInventoryLootState(body.inventoryLootState);
      } else {
        await refreshInventoryLootState();
      }
      if (body?.farmingFoodState) {
        setFarmingFoodState(body.farmingFoodState);
      } else {
        await refreshFarmingFoodState();
      }
      dispatchLiveModePlayerStatusFromBodyV1(body);
    },
    [refreshFarmingFoodState, refreshInventoryLootState]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const body = (event as CustomEvent<any>).detail;
      void applyLiveModeInventoryResponse(body);
      setSnapshotRevision((value) => value + 1);
    };
    window.addEventListener(
      LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT_V1,
      handler
    );
    return () =>
      window.removeEventListener(
        LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT_V1,
        handler
      );
  }, [applyLiveModeInventoryResponse]);

  const setActiveTabFromUi = React.useCallback(
    (next: TabKey | null) => {
      if (next) {
        shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
        pointerLockManager.unlock();
        const gardenHoseTabs = BIOMES_UI_TAB_TO_GARDEN_HOSE_TABS[next] ?? [];
        if (gardenHoseTabs.length > 0) {
          try {
            for (const tab of gardenHoseTabs) {
              (gardenHose as any)?.publish?.({ kind: "open_tab", tab });
            }
          } catch {}
        }
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
    [gardenHose, onActiveTabChange, pointerLockManager, reactResources]
  );

  const openTab = React.useCallback(
    (tab: TabKey, mode: "toggle" | "open" = "toggle") => {
      const next = mode === "toggle" && activeTab === tab ? null : tab;
      setActiveTabFromUi(next);
    },
    [activeTab, setActiveTabFromUi]
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
    if (!replacementMode || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        activeTab !== null ||
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInInput(event.target)
      ) {
        return;
      }
      const model = buildFarmingFoodInterfaceModelForTest(
        farmingFoodState,
        farmingFoodHydrated
      );
      const action = farmingFoodQuickActionForKeyV1(model, event.code);
      if (!action || action.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      fireAndForget(
        submitFarmingFoodLiveModeAction(action.operation, action.payload)
          .then(applyLiveModeInventoryResponse)
          .catch(() => refreshFarmingFoodState())
      );
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    activeTab,
    applyLiveModeInventoryResponse,
    farmingFoodHydrated,
    farmingFoodState,
    refreshFarmingFoodState,
    replacementMode,
  ]);

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

  const selectedIndex = clampHotbarIndex(
    Number(hotbarIndex?.value ?? inventory?.selected?.idx ?? 0),
    9
  );

  const selectHotbarIndex = React.useCallback(
    (index: number) => {
      const idx = clampHotbarIndex(index, 9);
      try {
        reactResources.set("/hotbar/index", { value: idx });
      } catch {}
      try {
        clientContext.resources.update(
          "/hotbar/index",
          (resource: { value: number }) => {
            resource.value = idx;
          }
        );
      } catch {}
      try {
        const localPlayer = reactResources.get("/scene/local_player");
        const ref = { kind: "hotbar", idx } as OwnedItemReference;
        if (localPlayer?.id) {
          fireAndForget(
            events.publish(
              new InventoryChangeSelectionEvent({ id: localPlayer.id, ref })
            )
          );
        }
        audioManager?.playSound?.("item_select");
      } catch {}
    },
    [audioManager, clientContext.resources, events, reactResources]
  );

  const hotbar = React.useMemo(() => {
    const hotbarSlots = normalizeContainer(inventory?.hotbar).slice(0, 9);
    const slots = Array.from({ length: 9 }, (_unused, index) =>
      slotToUiItem(hotbarSlots[index], `hotbar_${index + 1}`)
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
              } as OwnedItemReference)
            );
          }
        } catch {}
      },
    };
  }, [
    clientContext,
    inventory?.hotbar,
    reactResources,
    selectHotbarIndex,
    selectedIndex,
  ]);

  const adapters = React.useMemo<BiomesUIAdapters>(() => {
    const hotbarItems = normalizeContainer(inventory?.hotbar);
    const backpackItems = mergeInventoryAndHotbarForBiomesBackpackForTest(
      normalizeContainer(inventory?.items),
      hotbarItems
    );
    const currencyItems = normalizeContainer(inventory?.currencies);
    const equipmentItems = normalizeAssignment(wearing?.items);
    // BIOMES_UI_MAP_ADAPTER_V141:
    // Read the player's current position from the live ECS scene so the map
    // marker actually follows them. The position is rounded later for the
    // marker tooltip; here we keep full precision for accurate normalization.
    const livePlayer = reactResources.get("/scene/local_player") as any;
    const playerWorldPos: [number, number, number] | undefined = (() => {
      const p = livePlayer?.player?.position;
      if (Array.isArray(p) && p.length >= 3) {
        const x = Number(p[0]);
        const y = Number(p[1]);
        const z = Number(p[2]);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          return [x, Number.isFinite(y) ? y : 0, z];
        }
      }
      return undefined;
    })();

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
            })
          )
        );
      } catch {}
    };

    const backendActor = inventoryLootState?.actor;
    const liveBackpackStackItems = stackRecordToInventoryUiItemsV135(
      backendActor?.items,
      "backpack"
    );
    const liveBackpackInstanceItems = instanceRecordToInventoryUiItemsV135(
      backendActor?.instanceIds,
      inventoryLootState?.itemInstances,
      liveBackpackStackItems.length
    );
    void harthmereInventoryRevision;
    const localHarthmereInventoryState = readHarthmereInventoryState();
    const ecsBackpackUiItems = backpackItems.map((slot: any, index: number) =>
      slotToInventoryUiItem(
        slot,
        `bag_${index + 1}`,
        { kind: "item", idx: index },
        "backpack"
      )
    );
    const baseBackpackUiItems =
      liveBackpackStackItems.length || liveBackpackInstanceItems.length
        ? [...liveBackpackStackItems, ...liveBackpackInstanceItems]
        : ecsBackpackUiItems;
    const localDevBackpackItems =
      localHarthmereInventoryState.backpack.items.map((item, index) =>
        localHarthmereBackpackItemToUiItemV132(
          item,
          baseBackpackUiItems.length + index
        )
      );
    const allBackpackUiItems = [
      ...baseBackpackUiItems,
      ...localDevBackpackItems,
    ];

    const liveItemForRef = (ref: InventoryUiRef): InventoryUiItem | null => {
      if (ref.kind !== "item" || isLocalHarthmereItemRefV132(ref)) return null;
      const index = Number(ref.idx ?? -1);
      if (!Number.isInteger(index) || index < 0) return null;
      return (
        liveBackpackStackItems[index] ??
        liveBackpackInstanceItems.find(
          (item) => item.ref?.kind === "item" && item.ref.idx === index
        ) ??
        null
      );
    };
    const localHarthmereItemForRef = (
      ref: InventoryUiRef
    ): HarthmereItemInstance | undefined => {
      const instanceId = localHarthmereInstanceIdFromRefV132(ref);
      if (!instanceId) return undefined;
      return localHarthmereInventoryState.backpack.items.find(
        (item) => item.instanceId === instanceId
      );
    };

    const inventoryAdapter = {
      getBackpack: () => {
        const materialStorageSnapshot =
          bankingState?.materialStorage ?? inventoryLootState?.materialStorage;
        const materialStorageItems =
          materialStorageSnapshot?.items &&
          typeof materialStorageSnapshot.items === "object"
            ? materialStorageSnapshot.items
            : materialStorageSnapshot &&
              typeof materialStorageSnapshot === "object" &&
              !("maxSlots" in materialStorageSnapshot)
            ? materialStorageSnapshot
            : undefined;
        const materialStorageUiItems = stackRecordToInventoryUiItemsV135(
          materialStorageItems,
          "material_storage",
          "item",
          {
            description: "Stored in material storage.",
            protectedReason:
              "Materials are stored separately from backpack slots.",
          }
        );
        const overflowUiItems = (
          Array.isArray(inventoryLootState?.overflow)
            ? inventoryLootState.overflow
            : []
        )
          .filter((entry: any) => Number(entry?.count) > 0)
          .map((entry: any, index: number): InventoryUiItem => {
            const itemId = String(entry?.itemId ?? `overflow_${index}`);
            return {
              id: `${itemId}_${index}`,
              label: humanizeRealItemId(itemId, itemId),
              icon: biomesInventoryItemIconV1(itemId),
              count: Number(entry?.count ?? 1),
              quality: "common",
              category: inferInventoryCategory({ id: itemId }),
              description: entry?.reason
                ? humanizeRealItemId(String(entry.reason), String(entry.reason))
                : "Waiting for backpack space.",
              source: "overflow",
              storageLocation: "overflow",
              canUse: false,
              canEquip: false,
              canMove: false,
              canSplit: false,
              canDrop: false,
              canDestroy: false,
              protectedReason: "Make backpack space before moving this item.",
            };
          });
        const uiItems = allBackpackUiItems;
        const currentWeight = uiItems.reduce(
          (sum: number, item: InventoryUiItem | null) =>
            item
              ? sum +
                itemWeight({ item: { id: item.id, category: item.category } }) *
                  Math.max(1, item.count ?? 1)
              : sum,
          0
        );
        const maxWeight = 25;
        const baseMaxSlots = Number(
          backendActor?.maxInventorySlots ??
            Math.max(32, backpackItems.length || 0)
        );
        return {
          items: uiItems,
          maxSlots: Math.max(baseMaxSlots, uiItems.length),
          usedSlots: uiItems.filter(Boolean).length,
          capacityLabel: inventoryLootHydrated ? "Backpack" : "World backpack",
          weight: {
            current: currentWeight,
            max: maxWeight,
            overLimit: currentWeight > maxWeight,
          },
          materialStorage: {
            items: materialStorageUiItems,
            maxSlots: Number(materialStorageSnapshot?.maxSlots ?? 0),
            usedSlots: Number(
              materialStorageSnapshot?.usedSlots ??
                materialStorageUiItems.length
            ),
            capacityLabel: "Material Storage",
          },
          overflow: overflowUiItems,
        };
      },
      getHotbar: () => ({
        items: Array.from({ length: 9 }, (_unused, index) =>
          slotToInventoryUiItem(
            hotbarItems[index],
            `hotbar_${index + 1}`,
            { kind: "hotbar", idx: index },
            "hotbar"
          )
        ),
        selectedIndex,
      }),
      getEquipment: () =>
        equipmentItems.map(([key, item]: [string, any]) => ({
          id: key,
          label: key.replace(/_/g, " "),
          ref: { kind: "wearable", key },
          item: slotToInventoryUiItem(
            { item, count: 1 },
            `wearable_${key}`,
            { kind: "wearable", key },
            "equipment"
          ),
        })),
      getCurrencies: () => {
        const ecsCurrencies = currencyItems
          .filter(
            (entry: any) =>
              isCurrencySlot(entry) &&
              (countToNumber(entry?.count ?? entry?.amount) ?? 0) !== 0 &&
              hasExplicitItemName(entry)
          )
          .map((entry: any) => ({
            id: String(entry?.item?.id ?? entry?.id),
            name: readableItemName(entry, String(entry?.item?.id ?? entry?.id)),
            amount: countToNumber(entry?.count ?? entry?.amount) ?? 0,
            icon: "◉",
          }));
        const backendGold = Number(inventoryLootState?.actor?.gold ?? 0);
        return (inventoryLootHydrated || backendGold > 0) &&
          !ecsCurrencies.some((c: any) => c.id === "gold")
          ? [
              { id: "gold", name: "Gold", amount: backendGold, icon: "◉" },
              ...ecsCurrencies,
            ]
          : ecsCurrencies;
      },
      getSelectedItem: () => {
        const selected = inventory?.selected;
        if (!selected?.ref) return null;
        const ref = selected.ref as InventoryUiRef;
        if (ref.kind === "item") {
          return slotToInventoryUiItem(
            backpackItems[Number(ref.idx ?? 0)],
            "selected_item",
            ref,
            "backpack"
          );
        }
        if (ref.kind === "hotbar") {
          return slotToInventoryUiItem(
            hotbarItems[Number(ref.idx ?? 0)],
            "selected_hotbar",
            ref,
            "hotbar"
          );
        }
        return null;
      },
      selectItem: (ref: InventoryUiRef) => {
        if (localHarthmereItemForRef(ref)) {
          return;
        }
        try {
          fireAndForget(
            events.publish(
              new InventoryChangeSelectionEvent({
                id: userId,
                ref: normalizeUiRef(ref),
              })
            )
          );
        } catch {}
      },
      useItem: (ref: InventoryUiRef) => {
        const localHarthmereItem = localHarthmereItemForRef(ref);
        if (localHarthmereItem) {
          const itemId = localHarthmereItem.itemId;
          if (isLocalHarthmereConsumableUseItemV132(itemId)) {
            performHarthmereBackpackItemUseForBiomesUI(
              localHarthmereItem.instanceId
            );
          } else {
            dispatchBiomesUITutorialItemUseV132(
              {
                itemId,
                itemName: humanizeRealItemId(itemId, itemId),
                category: inferInventoryCategory({ id: itemId }),
                instanceId: localHarthmereItem.instanceId,
              },
              "biomes-ui-local-dev-item-use"
            );
          }
          return;
        }
        const liveItem = liveItemForRef(ref);
        if (liveItem?.id && HARTHMERE_FOOD_DEFINITIONS_V1[liveItem.id]) {
          fireAndForget(
            submitFarmingFoodLiveModeAction("eat_food", { itemId: liveItem.id })
              .then(async (body) => {
                await applyLiveModeInventoryResponse(body);
                dispatchBiomesUITutorialItemUseV132(
                  {
                    id: liveItem.id,
                    label: liveItem.label,
                    category: liveItem.category,
                    useEffect: "stamina",
                  },
                  "biomes-ui-live-food-use"
                );
              })
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        if (liveItem?.id === "raw_meat") {
          fireAndForget(
            submitFarmingFoodLiveModeAction("cook_food", {
              recipeId: "grilled_meat",
              rawItemId: "raw_meat",
              stationKind: "campfire",
              count: 1,
            })
              .then(applyLiveModeInventoryResponse)
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        if (
          liveItem?.id &&
          HARTHMERE_MEDICAL_ITEM_DEFINITIONS_V1[liveItem.id]
        ) {
          fireAndForget(
            submitMedicalLiveModeAction("use_medical_item", {
              itemId: liveItem.id,
            })
              .then(async (body) => {
                await applyLiveModeInventoryResponse(body);
                dispatchBiomesUITutorialItemUseV132(
                  {
                    id: liveItem.id,
                    label: liveItem.label,
                    category: liveItem.category,
                    useEffect: "heal",
                  },
                  "biomes-ui-live-medical-use"
                );
              })
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        try {
          fireAndForget(
            events.publish(
              new InventoryChangeSelectionEvent({
                id: userId,
                ref: normalizeUiRef(ref),
              })
            )
          );
        } catch {}
      },
      getFarmingFood: () =>
        buildFarmingFoodInterfaceModelForTest(
          farmingFoodState,
          farmingFoodHydrated
        ),
      performFarmingFoodAction: (action: FarmingFoodInterfaceActionV1) => {
        if (action.disabled) return;
        fireAndForget(
          submitFarmingFoodLiveModeAction(action.operation, action.payload)
            .then(applyLiveModeInventoryResponse)
            .catch(() => refreshFarmingFoodState())
        );
      },
      equipItem: (ref: InventoryUiRef, equipSlot?: string) => {
        const key = equipSlot || "main_hand";
        publishSwap(ref, { kind: "wearable", key });
      },
      unequipItem: (ref: InventoryUiRef) => {
        const emptyIndex = Math.max(
          0,
          backpackItems.findIndex((slot: any) => !slot)
        );
        publishSwap(ref, {
          kind: "item",
          idx: emptyIndex < 0 ? 0 : emptyIndex,
        });
      },
      moveItem: (src: InventoryUiRef, dst: InventoryUiRef) =>
        publishSwap(src, dst),
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
              })
            )
          );
        } catch {}
      },
      combineStack: (
        src: InventoryUiRef,
        dst: InventoryUiRef,
        count: number
      ) => {
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
              })
            )
          );
        } catch {}
      },
      dropItem: (ref: InventoryUiRef, count?: number) => {
        try {
          fireAndForget(
            throwInventoryItem(
              clientContext as any,
              userId,
              normalizeUiRef(ref),
              optionalCountToBigInt(count)
            )
          );
        } catch {}
      },
      destroyItem: (ref: InventoryUiRef, count?: number) => {
        try {
          fireAndForget(
            destroyInventoryItem(
              clientContext as any,
              userId,
              normalizeUiRef(ref),
              optionalCountToBigInt(count)
            )
          );
        } catch {}
      },
      sortInventory: () => {
        try {
          fireAndForget(events.publish(new InventorySortEvent({ id: userId })));
        } catch {}
      },
    };

    const guildDepositCandidates = backpackItems
      .map((slot: any, index: number) =>
        slotToInventoryUiItem(
          slot,
          `bag_${index + 1}`,
          { kind: "item", idx: index },
          "backpack"
        )
      )
      .filter((item: InventoryUiItem | null): item is InventoryUiItem => !!item)
      .map((item: InventoryUiItem) => ({
        id: item.id,
        name: item.label,
        icon:
          typeof item.icon === "string" && /^https?:\/\//.test(item.icon)
            ? "◼"
            : item.icon,
        quantity: item.count ?? 1,
        category: item.category,
        estimatedGoldValue: Math.max(
          1,
          Math.ceil(
            (item.count ?? 1) *
              itemWeight({
                item: { category: item.category, displayName: item.label },
              })
          )
        ),
      }));

    const guildAdapter = createBiomesUIGuildsAdapterV1({
      state: guildState,
      hydrated: guildHydrated,
      setState: setGuildState,
      refresh: refreshGuildState,
      inventoryDepositCandidates: guildDepositCandidates,
      guildHallCandidates: [],
    });

    const inboxAdapter = {
      getThreads: () => {
        const grouped = new Map<
          string,
          { peerId: any; peerName: string; messages: any[]; lastAt: number }
        >();
        for (const envelope of dmMessages) {
          if (!envelope?.from || !envelope?.to) continue;
          if (envelope.message?.kind !== "text") continue;
          const peerId = envelope.to === userId ? envelope.from : envelope.to;
          const key = String(peerId);
          const current = grouped.get(key) ?? {
            peerId,
            peerName: String(peerId),
            messages: [],
            lastAt: 0,
          };
          current.messages.push(envelope);
          current.lastAt = Math.max(
            current.lastAt,
            Number(envelope.createdAt ?? 0)
          );
          grouped.set(key, current);
        }
        return Array.from(grouped.values())
          .map((thread) => ({
            id: `dm:${thread.peerId}`,
            peerId: thread.peerId,
            peerName: thread.peerName,
            messages: thread.messages.sort(
              (a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0)
            ),
            lastAt: thread.lastAt,
          }))
          .sort((a, b) => b.lastAt - a.lastAt);
      },
      getMessages: () =>
        activityMessages
          .slice(-40)
          .reverse()
          .map((envelope: any, index: number) => ({
            id: String(envelope?.id ?? `activity_${index}`),
            from: envelope?.from ? String(envelope.from) : "System",
            subject: String(envelope?.message?.kind ?? "Activity").replace(
              /_/g,
              " "
            ),
            preview: String(
              envelope?.message?.content ??
                envelope?.message?.kind ??
                "Notification"
            ),
            at: envelope?.createdAt
              ? new Date(Number(envelope.createdAt)).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "now",
            unread: true,
            kind: "system" as const,
          })),
      resolveUserName: async (username: string) => {
        const bundle = await socialManager.resolveUserName(username.trim());
        return bundle?.user
          ? {
              id: bundle.user.id,
              username: String(bundle.user.username ?? username.trim()),
            }
          : undefined;
      },
      sendDirectMessage: async (toUserId: any, content: string) => {
        await chatIo.sendMessage("chat", { kind: "text", content }, toUserId);
      },
    };

    const lootAdapter = {
      isHydrated: () => inventoryLootHydrated,
      getRecent: () => {
        const ledger = Array.isArray(inventoryLootState?.recentLootLedger)
          ? inventoryLootState.recentLootLedger.map(
              (entry: any, index: number) =>
                lootLedgerEntryToUiV135(
                  entry,
                  index,
                  inventoryLootState?.itemInstances
                )
            )
          : [];
        return ledger.slice(-30).reverse();
      },
      getAvailable: () =>
        lootDropsToUiV135(
          inventoryLootState?.availableLootDrops,
          inventoryLootState?.itemInstances
        ),
      getAvailableDrops: () =>
        Array.isArray(inventoryLootState?.availableLootDrops)
          ? inventoryLootState.availableLootDrops
          : [],
      refresh: refreshInventoryLootState,
    };

    const abilityById = new Map<string, any>(
      (Array.isArray(progressionState?.abilities)
        ? progressionState.abilities
        : []
      ).map((ability: any) => [String(ability.id), ability])
    );
    const progressionActions = {
      chooseClass: async (classId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_trainer_unlock",
          "trainer",
          { classId }
        );
        dispatchLiveModePlayerStatusFromBodyV1(body);
        await refreshProgressionState();
      },
      chooseSpecialization: async (specializationId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_trainer_unlock",
          "trainer",
          { specializationId }
        );
        dispatchLiveModePlayerStatusFromBodyV1(body);
        await refreshProgressionState();
      },
      learnAbility: async (abilityId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_trainer_unlock",
          "trainer",
          { abilityId }
        );
        dispatchLiveModePlayerStatusFromBodyV1(body);
        await refreshProgressionState();
      },
      assignAbility: async (slot: number, abilityId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_loadout_change",
          "loadout",
          { slot: `slot_${slot}`, abilityId }
        );
        dispatchLiveModePlayerStatusFromBodyV1(body);
        await refreshProgressionState();
      },
      discoverCollectible: async (collectibleId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_quest_state_update",
          "quest",
          { collectibleId }
        );
        dispatchLiveModePlayerStatusFromBodyV1(body);
        await refreshProgressionState();
      },
    };

    const dailyTasks = dailyTodoTasksFromCareSnapshotForTest(dailyState);

    return {
      daily: {
        isHydrated: () => dailyHydrated,
        getTasks: () => dailyTasks,
        getStreak: () => Number(dailyState?.streak ?? 0),
        getProgress: () => dailyTodoProgressForTest(dailyTasks),
        claim: async (activityId: string) => {
          const body = await submitDailyLiveModeAction(activityId);
          if (body?.dailyState) {
            setDailyState(body.dailyState);
          } else {
            await refreshDailyState();
          }
          if (body?.inventoryLootState) {
            setInventoryLootState(body.inventoryLootState);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("biomes:live-mode-wallet-updated", {
                  detail: { gold: body.inventoryLootState?.actor?.gold },
                })
              );
            }
          } else {
            await refreshInventoryLootState();
          }
          dispatchLiveModePlayerStatusFromBodyV1(body);
        },
      },
      inventory: inventoryAdapter,
      inbox: inboxAdapter,
      loot: lootAdapter,
      classes: {
        isHydrated: () => progressionHydrated,
        getClasses: () =>
          Array.isArray(progressionState?.classes)
            ? progressionState.classes
            : [],
        getCurrent: () => String(progressionState?.currentClassId ?? ""),
        getSpecialization: () =>
          progressionState?.currentSpecializationId
            ? String(progressionState.currentSpecializationId)
            : null,
        hasClassChoice: () => progressionState?.classSelected !== false,
        classChoiceLocked: () => Boolean(progressionState?.classChoiceLocked),
        choose: (id: string) => {
          void progressionActions.chooseClass(id);
        },
        chooseSpecialization: (id: string) => {
          void progressionActions.chooseSpecialization(id);
        },
      },
      skills: {
        isHydrated: () => progressionHydrated,
        getSkills: () =>
          Array.isArray(progressionState?.skills)
            ? progressionState.skills
            : [],
      },
      abilities: {
        isHydrated: () => progressionHydrated,
        getEquipped: () =>
          Array.from({ length: 8 }, (_unused, index) => {
            const abilityId = progressionState?.equipped?.[index];
            return abilityId
              ? abilityById.get(String(abilityId)) ?? null
              : null;
          }),
        getLibrary: () =>
          Array.isArray(progressionState?.abilities)
            ? progressionState.abilities.filter(
                abilityVisibleInBiomesLibraryForTest
              )
            : [],
        learn: (abilityId: string) => {
          void progressionActions.learnAbility(abilityId);
        },
        assign: (slot: number, abilityId: string) => {
          void progressionActions.assignAbility(slot, abilityId);
        },
      },
      collections: {
        isHydrated: () => progressionHydrated,
        getCategories: () => {
          const grouped = new Map<
            string,
            { id: string; name: string; entries: any[] }
          >();
          for (const entry of Array.isArray(progressionState?.collections)
            ? progressionState.collections
            : []) {
            const id = String(entry.categoryId);
            const current = grouped.get(id) ?? {
              id,
              name: String(entry.categoryName ?? id),
              entries: [],
            };
            current.entries.push({
              ...entry,
              claimable: Boolean(entry.claimable),
              source:
                typeof entry.source === "string"
                  ? entry.source
                  : typeof entry.sourceKind === "string"
                  ? humanizeRealItemId(entry.sourceKind, entry.sourceKind)
                  : undefined,
            });
            grouped.set(id, current);
          }
          return Array.from(grouped.values());
        },
        discover: (id: string) => {
          void progressionActions.discoverCollectible(id);
        },
      },
      map: buildBiomesUIMapAdapter(
        snapshotRevision,
        playerWorldPos,
        jobsBoardState,
        progressionState?.questState
      ),
      guilds: guildAdapter,
      banking: {
        isHydrated: () => bankingHydrated,
        getCurrencies: inventoryAdapter.getCurrencies,
        getDepositCandidates: () =>
          backpackItems
            .map((slot: any, index: number) =>
              slotToInventoryUiItem(
                slot,
                `bag_${index + 1}`,
                { kind: "item", idx: index },
                "backpack"
              )
            )
            .filter(
              (item: InventoryUiItem | null): item is InventoryUiItem => !!item
            )
            .map((item: InventoryUiItem) => ({
              id: item.id,
              name: item.label,
              icon: item.icon,
              quantity: item.count ?? 1,
              category: item.category,
            })),
        getVault: (kind: "personal" | "account" | "materials" = "personal") => {
          const source =
            kind === "account"
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
        getLoans: () =>
          Array.isArray(bankingState?.loans) ? bankingState.loans : [],
        getLogs: () =>
          Array.isArray(bankingState?.transactionLogs)
            ? bankingState.transactionLogs
            : [],
        getNextUpgradeCost: (kind: "personal" | "account" | "materials") => {
          const value = bankingState?.nextUpgradeCosts?.[kind];
          return Number.isFinite(Number(value)) ? Number(value) : undefined;
        },
        deposit: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("deposit", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        withdraw: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        depositAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_deposit", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        withdrawAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        depositMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_deposit", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        withdrawMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        upgradeSlots: async (kind: "personal" | "account" | "materials") => {
          const body = await submitBankingLiveModeAction("upgrade_slots", {
            vaultKind: kind,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        takeLoan: async (amount: number, days: number) => {
          const body = await submitBankingLiveModeAction("take_loan", {
            amount,
            days,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
        },
        repayLoan: async (loanId: string | undefined, amount: number) => {
          const body = await submitBankingLiveModeAction("repay_loan", {
            loanId,
            amount,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingStateV1()));
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
  }, [
    activityMessages,
    applyLiveModeInventoryResponse,
    bankingHydrated,
    bankingState,
    chatIo,
    clientContext,
    dailyHydrated,
    dailyState,
    dmMessages,
    events,
    farmingFoodHydrated,
    farmingFoodState,
    guildHydrated,
    guildState,
    harthmereInventoryRevision,
    inventoryLootHydrated,
    inventoryLootState,
    inventory?.currencies,
    inventory?.hotbar,
    inventory?.items,
    inventory?.selected,
    jobsBoardState,
    progressionHydrated,
    progressionState,
    reactResources,
    refreshDailyState,
    refreshFarmingFoodState,
    refreshGuildState,
    refreshInventoryLootState,
    refreshProgressionState,
    snapshotRevision,
    socialManager,
    userId,
    wearing?.items,
  ]);

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
