import { harthmereLiveServerAuthoritative } from "@/client/components/challenges/harthmereLiveAuthoritySignal";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  defaultHarthmereLiveFetch,
  runHarthmereLiveMutationOnce,
  runHarthmereLiveMutationSerially,
} from "@/client/components/harthmere_live_fetch";
import { submitHarthmereBuildingLiveModeAction } from "@/client/components/harthmere_building_live_mode";
import { addToast } from "@/client/components/toast/helpers";
import {
  HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT,
  type HarthmereEscortArrivalDialogueDetail,
} from "@/client/components/challenges/harthmereLiveModeClientEvents";
import {
  BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT,
  type BiomesUIOptimisticPlayerStatusDetail,
} from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import {
  equipHarthmereHotbarItem,
  getHarthmereItemDisplay,
  harthmereJobToolOwnedState,
  performHarthmereHotbarAssignForBiomesUI,
  performHarthmereHotbarClearForBiomesUI,
  performHarthmereHotbarSlotMoveForBiomesUI,
  performHarthmereMaterialStorageRemoveForBiomesUI,
  performHarthmereBackpackItemEquipForBiomesUI,
  performHarthmereBackpackItemUseForBiomesUI,
  performHarthmereEquipmentItemUnequipForBiomesUI,
  readHarthmereInventoryState,
  submitHarthmereInventoryGrantToLiveModeForTest,
  consumeHarthmereItemByItemId,
  harthmereInventoryCountByItemId,
  harthmereItemHotbarEligible,
  harthmereItemThrowable,
  recordHarthmereLiveInventoryItemsSnapshot,
  assertHarthmereLiveMutationAppliedForTest,
  type HarthmereItemInstance,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { getHarthmerePremiumWeapon } from "@/shared/harthmere/premium_weapon_catalog";
import { performHarthmereMousePrimaryAttack } from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import { dispatchHarthmereHotbarHeldItemSelection } from "@/client/game/resources/harthmere_held_item";
import { emitHarthmereGlitchBehaviorEvent } from "@/client/game/glitch/harthmere_glitch_behavior_events";
import {
  hasSelectedWorldInteractionCandidate,
  invokeSelectedWorldInteractionForKey,
} from "@/client/components/challenges/worldInteractionDispatcher";
import {
  HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import {
  HARTHMERE_DAILY_TASK_COMPLETED_EVENT,
  completeHarthmereDailyTaskSoon,
} from "@/client/components/challenges/harthmereDailyTasks";
import {
  harthmereCookingStationId,
  openHarthmereCookingStation,
} from "@/client/components/harthmere_cooking/harthmereCookingStations";
import {
  SNAPSHOT_MISSION_STATE_EVENT,
  recordSnapshotRoadAheadChallengeStepForBiomesUI,
  readSnapshotMissionState,
  syncSnapshotRoadAheadChallengeStepHintsForBiomesUI,
  snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUI,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT,
  SNAPSHOT_GROVE_QUEST_STATE_EVENT,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  BUILDING_SYSTEM_BLUEPRINTS,
  BUILDING_SYSTEM_PLOTS,
} from "@/shared/harthmere/building_system";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { iconUrl } from "@/client/components/inventory/icons";
import {
  destroyInventoryItem,
  getThrowPosition,
  throwInventoryItem,
} from "@/client/game/helpers/inventory";
import { publishHarthmereLiveEntityCombatMotionToRenderer } from "@/client/game/resources/harthmere_live_entity_motion_bridge";
import type { GameModal } from "@/client/game/resources/game_modal";
import {
  ConsumptionEvent,
  InventoryChangeSelectionEvent,
  InventoryCombineEvent,
  InventorySortEvent,
  InventorySplitEvent,
  InventorySwapEvent,
} from "@/shared/ecs/gen/events";
import type { OwnedItemReference } from "@/shared/ecs/gen/types";
import { PLAYER_INVENTORY_SLOTS } from "@/shared/game/inventory";
import { fireAndForget } from "@/shared/util/async";
import {
  harthmereItemIdToBiomesEcsItem,
  harthmereItemIdToBiomesId,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { harthmereEquipmentSlotToBikkieWearableSlot } from "@/shared/harthmere/harthmere_bikkie_wearables";
import {
  harthmereNativeXpForNextLevel,
  readHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import {
  HARTHMERE_ARROW_ITEM_ID,
  harthmereBackpackArrowCount,
  isHarthmereBowWeapon,
} from "@/shared/harthmere/harthmere_ranged_resources";
import { createHarthmereSkillClientProjection } from "@/shared/harthmere/harthmere_skill_progression";
import {
  createBiomesUIGuildsAdapter,
  fetchBiomesUIGuildState,
} from "./guildsLiveAdapter";
import * as React from "react";
import type { BiomesUIAdapters } from "../BiomesUI";
import type { TabKey } from "../BiomesUITypes";
import {
  DEFAULT_TAB_SHORTCUTS,
  isReservedGameplayShortcutKey,
  type TabShortcut,
} from "../shortcuts/BiomesShortcuts";
import { biomesUITabForKeyboardCodeForTest } from "../shortcuts/BiomesUIKeyRouting";
import type { HotbarSlotItem } from "../hotbar/BiomesHotbar";
import {
  describeHotbarPrimaryAction,
  isHotbarActionableItem,
} from "../hotbar/hotbarAction";
import {
  activateNativeHotbarPrimaryAction,
  throwOneNativeHotbarItem,
} from "../hotbar/nativeHotbarActions";
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
import {
  harthmereHotbarCarriedCounts,
  mergeMirroredBiomesBackpackUiItemsForTest,
  nativeBackpackGridItemsForBiomesUiForTest,
  nativeBackpackMaxSlotsForBiomesUiForTest,
} from "./inventoryAdapterHelpers";
import {
  nativeConsumablePresentationForBiomesUIForTest,
  nativeConsumptionForBiomesUIForTest,
} from "./nativeConsumptionAdapter";
import { shouldHydrateBiomesUILiveStateForTab } from "./liveStateHydrationPolicy";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  automaticQuestDestinationMarkerForTest,
  readActiveBiomesUIMapPin,
  shouldClearOwnedQuestMapPinForTest,
  writeActiveBiomesUIMapPin,
} from "./mapPinnedDestination";
import {
  jobsBoardAcceptedJobLandmarksForBiomesUI,
  jobsBoardItemSourceLandmarksForBiomesUI,
  jobsBoardLandmarkForActivePinHandoffForTest,
  jobsBoardTrackableQuestsForBiomesUI,
  jobsBoardTodoIdFromMarkerIdForTest,
  jobsBoardToolSourceLandmarksForBiomesUI,
  newlyAcceptedJobsBoardTodoIdForTest,
  shouldClearStaleJobsBoardPin,
} from "./jobsBoardQuestMapAdapter";
import {
  fetchHarthmereJobsBoardState,
  harthmereJobsBoardHasFollowingEscortForTest,
  HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
  harthmereJobsBoardStateFromUpdatedEventDetail,
  jobsBoardSnapshotWithLiveInventoryForTest,
  normalizeHarthmereJobsBoardSnapshot,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  createHarthmereQuestInviteAdapter,
  fetchHarthmereQuestState,
  HARTHMERE_QUEST_INVITES_UPDATED_EVENT,
  normalizeHarthmereQuestState,
} from "./questInviteAdapter";
import { LIVE_ENTITY_HELPER_QUEST_EVENT } from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import { LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT } from "@/client/components/challenges/liveEntityHelperQuestLiveAdapter";
import {
  dailyTodoProgressForTest,
  dailyTodoTasksFromCareSnapshotForTest,
} from "./dailyTodoAdapter";
import {
  biomesInventoryItemIcon,
  humanizeBiomesInventoryItemId,
} from "./inventoryItemPresentation";
import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "./playerStatusAdapter";
import {
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { harthmereItemUnitWeight } from "@/shared/harthmere/mmo_carry_weight";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import { anItem } from "@/shared/game/item";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import { safeParseBiomesId } from "@/shared/ids";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  nativeBiomesEcsAuthorityEnabled,
  nativeRoadAheadEcsAuthorityEnabled,
} from "@/shared/harthmere/native_road_ahead_contract";
import { HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT } from "@/shared/harthmere/snapshot_grove_trigger_contract";
import {
  buildFarmingFoodInterfaceModelForTest,
  farmingFoodQuickActionForKey,
  type FarmingFoodInterfaceAction,
} from "./farmingFoodInterfaceAdapter";
import { buildNativeFarmingInterfaceModel } from "./nativeFarmingInterfaceAdapter";
import { buildBiomesUIMapAdapter } from "./mapLiveAdapter";
import {
  buildNativeQuestNavAidResolver,
  nativeQuestNavigationAidsRevisionForTest,
} from "./nativeQuestNavAidResolver";
import {
  nativeQuestMapMarkers,
  nativeQuestTrackableQuests,
} from "./nativeQuestMapAdapter";
import {
  automaticMainQuestSelectionForTest,
  mainQuestFromTrackableQuestsForTest,
  readBiomesUIMainQuestSelection,
  setBiomesUIMainQuestFromTrackableQuest,
  writeBiomesUIMainQuestSelection,
} from "./mainQuestSelection";
import type { QuestBundle } from "@/client/game/resources/challenges";
import { getNpcBehavior, idToNpcType } from "@/shared/npc/bikkie";
import {
  HARTHMERE_HOE_QUEST_EVENT,
  HARTHMERE_HOE_VENDOR_MARKER_ID,
  acceptHarthmereHoeQuest,
  harthmereHoeQuestMapLandmarks,
  reconcileHarthmereHoeQuestState,
  type HarthmereHoeQuestState,
} from "@/client/components/biomes_ui/adapters/farmingMapQuest";
import {
  HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
  type HarthmerePropertyMapBuildingState,
} from "./propertyMapMarkers";
export const BIOMES_UI_OPEN_TAB_EVENT = "biomes-ui-open-tab";

const BIOMES_UI_TAB_TO_GARDEN_HOSE_TABS: Partial<Record<TabKey, string[]>> = {
  daily: ["daily"],
  inventory: ["inventory"],
  farming: ["inventory"],
  abilities: ["tasks"],
  skills: ["skills"],
  classes: ["classes"],
  land: ["building"],
  loot: ["loot"],
  guilds: ["tasks"],
  banking: ["banking"],
  // The dedicated Quests tab now owns the journal/quests garden-hose tabs;
  // the map keeps only the chart itself.
  quests: ["journal", "quests"],
  recovered: ["journal"],
  map: ["map"],
  collections: ["collections"],
  inbox: ["inbox"],
  options: ["settings"],
};

const HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX = "harthmere:";
const HARTHMERE_BIOMES_UI_LOCAL_EQUIPMENT_REF_PREFIX = "harthmere_equipment:";
const HARTHMERE_QUEST_INVITE_POLL_INTERVAL_MS = 30_000;

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
  const harthmereDisplay = getHarthmereItemDisplay(itemId);
  if (harthmereDisplay?.name) return harthmereDisplay.name;
  return humanizeBiomesInventoryItemId(itemId, fallback);
}

function rawItemIdFromSlot(slot: any): string | undefined {
  const item = slot?.item ?? slot;
  const raw = item?.id ?? item?.itemId ?? item?.item_id;
  if (raw === undefined || raw === null) return undefined;
  return String(raw);
}

function looksLikeMachineItemName(value: string, itemId?: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (itemId && trimmed.toLowerCase() === itemId.toLowerCase()) return true;
  return (
    /[_/]/.test(trimmed) ||
    /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(trimmed) ||
    /^[a-z][a-z0-9]*[A-Z]/.test(trimmed)
  );
}

function readableItemName(slot: any, fallback: string): string {
  const item = slot?.item ?? slot;
  const itemId = rawItemIdFromSlot(slot);
  if (itemId) {
    const harthmereDisplay = getHarthmereItemDisplay(itemId);
    if (harthmereDisplay?.name) return harthmereDisplay.name;
  }
  const explicit =
    item?.displayName ?? item?.display_name ?? item?.name ?? item?.label;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return looksLikeMachineItemName(explicit, itemId)
      ? humanizeRealItemId(explicit, fallback)
      : explicit;
  }
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
  const itemId = rawItemIdFromSlot(slot) ?? fallback;
  const harthmereDisplay = getHarthmereItemDisplay(itemId);
  let icon = harthmereDisplay?.icon ?? biomesInventoryItemIcon(itemId);
  if (!harthmereDisplay) {
    try {
      icon = iconUrl(item) ?? biomesInventoryItemIcon(itemId) ?? icon;
    } catch {
      icon = item?.action === "photo" ? "📷" : biomesInventoryItemIcon(itemId);
    }
  }
  const primaryAction = describeHotbarPrimaryAction(item);
  return {
    id: itemId,
    label: readableItemName(slot, fallback),
    icon,
    count: countToNumber(slot.count),
    quality: item?.isQuest
      ? "quest"
      : harthmereDisplayQualityForBiomesUI(harthmereDisplay?.quality),
    primaryActionLabel: primaryAction.label,
    canDrop: item?.isDroppable !== false && item?.isQuest !== true,
  };
}

function inferInventoryCategory(item: any): string {
  const itemId = String(item?.id ?? item?.itemId ?? "").toLowerCase();
  if (HARTHMERE_FOOD_DEFINITIONS[itemId]) return "consumables";
  if (HARTHMERE_MEDICAL_ITEM_DEFINITIONS[itemId]) return "consumables";
  if (HARTHMERE_SEED_DEFINITIONS[itemId]) return "materials";
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

function dispatchBiomesUITutorialItemUse(
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
    new CustomEvent(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, {
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

function isLocalHarthmereItemRef(ref: InventoryUiRef) {
  return (
    ref.kind === "item" &&
    typeof ref.key === "string" &&
    ref.key.startsWith(HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX)
  );
}

function isLocalHarthmereEquipmentRef(ref: InventoryUiRef) {
  return (
    ref.kind === "wearable" &&
    typeof ref.key === "string" &&
    ref.key.startsWith(HARTHMERE_BIOMES_UI_LOCAL_EQUIPMENT_REF_PREFIX)
  );
}

function localHarthmereInstanceIdFromRef(ref: InventoryUiRef) {
  return isLocalHarthmereItemRef(ref)
    ? String(ref.key).slice(HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX.length)
    : undefined;
}

function localHarthmereEquipmentSlotFromRef(ref: InventoryUiRef) {
  return isLocalHarthmereEquipmentRef(ref)
    ? String(ref.key).slice(
        HARTHMERE_BIOMES_UI_LOCAL_EQUIPMENT_REF_PREFIX.length
      )
    : undefined;
}

function harthmereDisplayCategoryForBiomesUI(
  category: string | undefined,
  equipSlot?: string
): string {
  const normalized = String(category ?? "").toLowerCase();
  if (equipSlot) return "gear";
  if (
    normalized === "consumable" ||
    normalized === "food" ||
    normalized === "drink" ||
    normalized === "spell_scroll"
  ) {
    return "consumables";
  }
  if (
    normalized === "crafting_material" ||
    normalized === "trade_good" ||
    normalized === "junk" ||
    normalized === "housing" ||
    normalized === "container"
  ) {
    return "materials";
  }
  if (normalized === "tool" || normalized === "weapon") return "tools";
  if (normalized === "quest_item" || normalized === "key") return "quest";
  return normalized || "item";
}

function harthmereDisplayQualityForBiomesUI(quality: string | undefined) {
  switch (quality) {
    case "uncommon":
    case "rare":
    case "epic":
    case "legendary":
      return quality;
    case "quest":
    case "event":
      return "quest" as const;
    default:
      return "common" as const;
  }
}

function localHarthmereBackpackItemToUiItem(
  item: HarthmereItemInstance,
  index: number
): InventoryUiItem {
  const itemId = String(item.itemId);
  const display = getHarthmereItemDisplay(itemId);
  const equipSlot =
    display?.slot ?? inferEquipSlot({ id: itemId, name: itemId });
  const edibleFood = isHarthmereFoodItemPlayerEdible(itemId);
  const category = edibleFood
    ? "consumables"
    : harthmereDisplayCategoryForBiomesUI(display?.category, equipSlot);
  return {
    id: itemId,
    label: display?.name ?? humanizeRealItemId(itemId, itemId),
    icon: display?.icon ?? biomesInventoryItemIcon(itemId),
    count: Math.max(1, Number(item.quantity ?? 1) || 1),
    quality: item.bound
      ? "quest"
      : harthmereDisplayQualityForBiomesUI(display?.quality),
    category,
    description: display?.description ?? "Prepared for the active tutorial.",
    weight: inventoryUiItemWeight(itemId, item.quantity ?? 1, category),
    ref: {
      kind: "item",
      idx: index,
      key: `${HARTHMERE_BIOMES_UI_LOCAL_ITEM_REF_PREFIX}${item.instanceId}`,
    },
    source: "backpack",
    storageLocation: "backpack",
    canUse: edibleFood ? true : (display?.canUse ?? false),
    useActionLabel: edibleFood ? "Eat" : undefined,
    equipSlot,
    canEquip: display?.canEquip ?? Boolean(equipSlot),
    hotbarEligible: isHotbarEligibleItemId(itemId),
    canSplit: false,
    canDrop: false,
    canDestroy: false,
    canMove: true,
    protectedReason: "Tutorial items stay in your backpack for this lesson.",
  };
}

function localHarthmereHotbarItemToUiItem(
  itemId: string,
  index: number,
  // Real carried count for the hotbar item (live-mode server count or local
  // backpack quantity). Hotbar slots used to hard-code `count: 1`, so stacks
  // showed the wrong quantity on the HUD hotbar and the inventory mirror.
  count = 1
): InventoryUiItem | null {
  const display = getHarthmereItemDisplay(itemId);
  if (!display) return null;
  const equipSlot =
    display.slot ?? inferEquipSlot({ id: itemId, name: itemId });
  const edibleFood = isHarthmereFoodItemPlayerEdible(itemId);
  const category = edibleFood
    ? "consumables"
    : harthmereDisplayCategoryForBiomesUI(display.category, equipSlot);
  const primaryActionLabel = edibleFood
    ? "Eat"
    : harthmereItemThrowable(itemId)
      ? "Throw"
      : display.category === "weapon"
        ? "Attack"
        : display.category === "tool"
          ? "Use Tool"
          : display.canUse
            ? "Use"
            : isBlockHotbarItemId(itemId)
              ? "Place"
              : "Use";
  return {
    id: itemId,
    label: display.name,
    icon: display.icon ?? biomesInventoryItemIcon(itemId),
    count: Math.max(0, Math.trunc(Number(count) || 0)),
    quality: harthmereDisplayQualityForBiomesUI(display.quality),
    category,
    description: display.description,
    weight: inventoryUiItemWeight(itemId, 1, category, display.name),
    equipSlot,
    ref: {
      kind: "hotbar",
      idx: index,
      key: `harthmere_hotbar:${index + 1}:${itemId}`,
    },
    source: "hotbar",
    storageLocation: "hotbar",
    canUse: edibleFood ? true : display.canUse,
    useActionLabel: edibleFood ? "Eat" : undefined,
    canEquip: display.canEquip,
    hotbarEligible: isHotbarEligibleItemId(itemId),
    canMove: true,
    canSplit: false,
    canDrop: true,
    canDestroy: false,
    protectedReason: "Hotbar slots are shortcuts to your carried items.",
    primaryActionLabel,
  };
}

function isBlockHotbarItemId(itemId: string) {
  const nativeItem = harthmereItemIdToBiomesEcsItem(itemId);
  return Boolean(nativeItem?.isBlock || nativeItem?.isPlaceable);
}

function localHarthmereEquipmentItemToUiItem(
  item: HarthmereItemInstance,
  slot: string
): InventoryUiItem {
  const itemId = String(item.itemId);
  const display = getHarthmereItemDisplay(itemId);
  const equipSlot = display?.slot ?? item.equipmentSlot ?? slot;
  return {
    id: itemId,
    label: display?.name ?? humanizeRealItemId(itemId, itemId),
    icon: display?.icon ?? biomesInventoryItemIcon(itemId),
    count: 1,
    quality: item.bound
      ? "quest"
      : harthmereDisplayQualityForBiomesUI(display?.quality),
    category: harthmereDisplayCategoryForBiomesUI(display?.category, equipSlot),
    description: display?.description ?? "Equipped from your Harthmere pack.",
    weight: inventoryUiItemWeight(
      itemId,
      1,
      harthmereDisplayCategoryForBiomesUI(display?.category, equipSlot),
      display?.name
    ),
    equipSlot,
    ref: {
      kind: "wearable",
      key: `${HARTHMERE_BIOMES_UI_LOCAL_EQUIPMENT_REF_PREFIX}${slot}`,
    },
    source: "equipment",
    storageLocation: "equipment",
    canUse: false,
    canEquip: false,
    canMove: false,
    canSplit: false,
    canDrop: false,
    canDestroy: false,
  };
}

function isLocalHarthmereConsumableUseItem(itemId: string) {
  return (
    getHarthmereItemDisplay(itemId)?.canUse === true ||
    isHarthmereFoodItemPlayerEdible(itemId) ||
    !!HARTHMERE_MEDICAL_ITEM_DEFINITIONS[itemId]
  );
}

function isHarthmereFoodItemPlayerEdible(itemId: string) {
  const food = HARTHMERE_FOOD_DEFINITIONS[itemId];
  return Boolean(
    food && food.edible !== false && Number(food.staminaRestore) > 0
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
  } ${item?.id ?? item?.itemId ?? ""}`.toLowerCase();
  if (text.includes("helmet") || text.includes("hat")) return "head";
  if (
    text.includes("chest") ||
    text.includes("shirt") ||
    text.includes("t_shirt") ||
    text.includes("top") ||
    text.includes("armor") ||
    text.includes("apron") ||
    text.includes("vest") ||
    text.includes("tunic") ||
    text.includes("jacket") ||
    text.includes("coat")
  )
    return "chest";
  if (
    text.includes("pants") ||
    text.includes("legs") ||
    text.includes("jeans") ||
    text.includes("bottoms") ||
    text.includes("skirt") ||
    text.includes("trouser") ||
    text.includes("shorts") ||
    text.includes("leggings")
  )
    return "legs";
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

export function nativeWearableSlotLabelForTest(slot: string): string {
  const id = Number(slot);
  const labels = new Map<number, string>([
    [BikkieIds.head, "Head"],
    [BikkieIds.hair, "Hair"],
    [BikkieIds.hat, "Hat"],
    [BikkieIds.face, "Face"],
    [BikkieIds.ears, "Ears"],
    [BikkieIds.top, "Chest"],
    [BikkieIds.bottoms, "Legs"],
    [BikkieIds.feet, "Feet"],
    [BikkieIds.hands, "Hands"],
    [BikkieIds.outerwear, "Outerwear"],
    [BikkieIds.neck, "Neck"],
  ]);
  return labels.get(id) ?? slot.replace(/_/g, " ");
}

export function nativeWearableSlotUiIdForTest(slot: string): string {
  const id = Number(slot);
  const ids = new Map<number, string>([
    [BikkieIds.head, "head"],
    [BikkieIds.hair, "hair"],
    [BikkieIds.hat, "hat"],
    [BikkieIds.face, "face"],
    [BikkieIds.ears, "ears"],
    [BikkieIds.top, "chest"],
    [BikkieIds.bottoms, "legs"],
    [BikkieIds.feet, "feet"],
    [BikkieIds.hands, "hands"],
    [BikkieIds.outerwear, "back"],
    [BikkieIds.neck, "neck"],
  ]);
  return ids.get(id) ?? slot;
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

function inventoryUiItemWeight(
  itemId: string,
  count = 1,
  category?: string,
  label?: string
): InventoryUiItem["weight"] {
  const unit = harthmereItemUnitWeight(itemId, {
    category,
    displayName: label,
  });
  return {
    unit,
    total: unit * Math.max(1, Math.trunc(Number(count) || 1)),
  };
}

function itemWeight(slot: any): number {
  const item = slot?.item ?? slot;
  const explicit = Number(item?.weight ?? item?.carryWeight ?? item?.mass);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return harthmereItemUnitWeight(
    String(item?.id ?? item?.itemId ?? item?.name ?? ""),
    {
      category: inferInventoryCategory(item),
      displayName: item?.displayName ?? item?.name ?? item?.label,
    }
  );
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
      icon: biomesInventoryItemIcon(itemId),
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
  const display = getHarthmereItemDisplay(base.id);
  const nativeEquipSlot = findItemEquippableSlot(item);
  const equipSlot =
    display?.slot ??
    (nativeEquipSlot !== undefined ? String(nativeEquipSlot) : undefined) ??
    inferEquipSlot(item);
  const edibleFood = isHarthmereFoodItemPlayerEdible(base.id);
  const nativeConsumable = nativeConsumablePresentationForBiomesUIForTest(item);
  const category = edibleFood
    ? "consumables"
    : display
      ? harthmereDisplayCategoryForBiomesUI(display.category, equipSlot)
      : inferInventoryCategory(item);
  return {
    id: base.id,
    label: display?.name ?? base.label,
    icon: display?.icon ?? base.icon,
    count: base.count,
    quality: base.quality as InventoryUiItem["quality"],
    category,
    description: display?.description ?? itemDescription(item),
    weight: inventoryUiItemWeight(
      base.id,
      base.count ?? 1,
      category,
      base.label
    ),
    durability: itemDurability(item),
    equipSlot,
    ref,
    source,
    storageLocation: source,
    canUse: edibleFood || nativeConsumable.canUse || display?.canUse === true,
    useActionLabel: edibleFood ? "Eat" : nativeConsumable.useActionLabel,
    canEquip: display?.canEquip ?? Boolean(equipSlot),
    hotbarEligible: isHotbarEligibleItemId(base.id),
    canMove: true,
    canSplit: true,
    canDrop: category !== "quest",
    canDestroy: category !== "quest",
    protectedReason:
      category === "quest"
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
  const parsedKey =
    typeof ref.key === "string" ? safeParseBiomesId(ref.key) : undefined;
  return {
    kind: ref.kind as any,
    key: (parsedKey ?? ref.key) as any,
  } as OwnedItemReference;
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

// The May 16 snapshot used the native inventory throw helper, which marches in
// the camera direction and returns a server-valid position in front of the
// player. Reusing that calculation prevents a custom Redis drop from spawning
// at the player's feet (where it looked unthrown and could be picked up again).
function harthmereThrowDropPosition(
  clientContext: any
): { x: number; y: number; z: number } | undefined {
  try {
    const [x, y, z] = getThrowPosition(clientContext);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return undefined;
    }
    return { x, y, z };
  } catch {
    return undefined;
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

export type NativeHotbarRemovalFailureReason =
  "player_not_ready" | "slot_empty" | "backpack_full" | "publish_failed";

export type NativeHotbarRemovalPlan =
  | { ok: true; destinationIndex: number }
  | {
      ok: false;
      reason: Exclude<NativeHotbarRemovalFailureReason, "publish_failed">;
    };

export function planNativeHotbarRemoval(input: {
  backpackItems: readonly unknown[];
  hotbarSlotPresent: boolean;
  playerReady: boolean;
}): NativeHotbarRemovalPlan {
  if (!input.hotbarSlotPresent) {
    return { ok: false, reason: "slot_empty" };
  }
  if (!input.playerReady) {
    return { ok: false, reason: "player_not_ready" };
  }
  const destinationIndex = input.backpackItems.findIndex((slot) => !slot);
  if (destinationIndex < 0) {
    return { ok: false, reason: "backpack_full" };
  }
  return { ok: true, destinationIndex };
}

export function nativeHotbarRemovalFailureFeedback(input: {
  slotIndex: number;
  reason: NativeHotbarRemovalFailureReason;
  backpackItems: readonly unknown[];
}) {
  const backpackSlots = Math.max(
    PLAYER_INVENTORY_SLOTS,
    input.backpackItems.length
  );
  const occupiedBackpackSlots = input.backpackItems.filter(Boolean).length;
  const message =
    input.reason === "backpack_full"
      ? `Backpack full. Free one of your ${backpackSlots} backpack slots before removing a hotbar item.`
      : input.reason === "player_not_ready"
        ? "Your character inventory is still loading. Try removing the hotbar item again."
        : input.reason === "slot_empty"
          ? "That hotbar slot changed before it could be removed. Try again."
          : "The hotbar item could not be moved to your backpack. Try again.";
  return {
    message,
    telemetry: {
      slot: input.slotIndex + 1,
      reason: input.reason,
      backpack_slots: backpackSlots,
      occupied_backpack_slots: occupiedBackpackSlots,
    },
  };
}

function reportNativeHotbarRemovalFailure(input: {
  resources: unknown;
  slotIndex: number;
  reason: NativeHotbarRemovalFailureReason;
  backpackItems: readonly unknown[];
}) {
  const feedback = nativeHotbarRemovalFailureFeedback(input);
  try {
    addToast(input.resources as any, {
      kind: "basic",
      id: `hotbar-remove-failed:${input.slotIndex}:${input.reason}`,
      message: feedback.message,
    });
  } catch {
    // Telemetry still records the reason if the toast surface is unavailable.
  }
  emitHarthmereGlitchBehaviorEvent(
    "hotbar",
    "remove_slot_failed",
    feedback.telemetry
  );
}

function readSnapshotGroveApi(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).__snapshotGrove;
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
  if (text.includes("build") || text.includes("place")) return "building_spot";
  if (text.includes("road")) return "road_marker";
  if (text.includes("muck")) return "muckwad_patch";
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

function dispatchLiveModePlayerStatusFromBody(body: any) {
  if (typeof window === "undefined") return;
  publishLiveModeCombatMotionFromBody(body);
  if (!body?.playerStatusState) return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
      detail: body.playerStatusState,
    })
  );
}

function publishLiveModeCombatMotionFromBody(body: any) {
  if (body?.combatState) {
    publishHarthmereLiveEntityCombatMotionToRenderer(body.combatState);
  }
}

export async function submitBuildingSystemLiveModeAction(
  action: string,
  payload: Record<string, unknown>
): Promise<any> {
  return submitHarthmereBuildingLiveModeAction(action, payload);
}

function dispatchHarthmereBuildingStateUpdate(
  buildingState: HarthmerePropertyMapBuildingState | undefined
) {
  if (typeof window === "undefined" || !buildingState) return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_PROPERTY_BUILDING_STATE_EVENT, {
      detail: { buildingState },
    })
  );
}

export async function fetchBuildingSystemState(): Promise<
  HarthmerePropertyMapBuildingState | undefined
> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_building_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.buildingState;
}

async function fetchBankingState(): Promise<any | undefined> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_bank_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.bankingState;
}

async function fetchInventoryLootState(): Promise<any | undefined> {
  const response = await defaultHarthmereLiveFetch(
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

async function fetchProgressionState(): Promise<any | undefined> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_progression_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.progressionState;
}

async function fetchDailyState(): Promise<any | undefined> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_daily_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.dailyState;
}

async function fetchFarmingFoodState(): Promise<any | undefined> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_farming_food_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.farmingFoodState;
}

function isLiveUsableBackpackItem(itemId: string) {
  return (
    isHarthmereFoodItemPlayerEdible(itemId) ||
    !!HARTHMERE_MEDICAL_ITEM_DEFINITIONS[itemId] ||
    getHarthmereItemDisplay(itemId)?.canUse === true
  );
}

function isLiveVoxelBlockItemId(itemId: string) {
  const biomesId = safeParseBiomesId(itemId);
  if (biomesId && anItem(biomesId)?.isBlock === true) return true;
  const display = getHarthmereItemDisplay(itemId);
  return /muckwad|voxel|block/i.test(
    `${itemId} ${display?.name ?? ""} ${display?.category ?? ""}`
  );
}

function isNativeBikkieItemId(itemId: string) {
  return harthmereItemIdToBiomesId(itemId) !== undefined;
}

const RETIRED_ROAD_AHEAD_CLOTHING_ALIASES = new Set([
  "baker_apron",
  "field_trousers",
]);

function isRetiredRoadAheadClothingAlias(itemId: string) {
  return (
    nativeBiomesEcsAuthorityEnabled() &&
    RETIRED_ROAD_AHEAD_CLOTHING_ALIASES.has(itemId)
  );
}

function isHotbarEligibleItemId(itemId: string) {
  const biomesId = safeParseBiomesId(itemId);
  if (biomesId) {
    const item = anItem(biomesId);
    if (isHotbarActionableItem(item)) return true;
  }
  return harthmereItemHotbarEligible(itemId);
}

function isThrowableHotbarItemId(itemId: string) {
  // Blocks (including the Road Ahead Muckwad voxel) are placed by the native
  // terrain interaction. Treating every block as a projectile caused the
  // custom combat router to interpret placement as an attack and made nearby
  // NPCs retaliate. Only explicitly throwable/projectile items use this path.
  if (harthmereItemThrowable(itemId)) return true;
  const display = getHarthmereItemDisplay(itemId);
  return /throwable|projectile/i.test(
    `${itemId} ${display?.name ?? ""} ${display?.category ?? ""}`
  );
}

// HARTHMERE_HOTBAR_AUTO_ASSIGN_OPT_OUT (2026-07-06): auto-assign used to run on
// EVERY live inventory response, so the moment a player removed a block from
// the hotbar the next response re-assigned it — "I remove the items in the
// hotbar but they keep coming back". Removals are now remembered (persisted +
// in-memory mirror for storage-blocked iframes) and auto-assign never re-adds
// an item the player explicitly removed. Newly acquired items still
// auto-assign once.
const HARTHMERE_HOTBAR_AUTO_ASSIGN_OPT_OUT_KEY =
  "biomes.localDev.harthmere.hotbarAutoAssignOptOut";
let hotbarAutoAssignOptOutMirror: Set<string> | undefined;

function readHarthmereHotbarAutoAssignOptOut(): Set<string> {
  if (hotbarAutoAssignOptOutMirror) return hotbarAutoAssignOptOutMirror;
  let stored: string[] = [];
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_HOTBAR_AUTO_ASSIGN_OPT_OUT_KEY
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) stored = parsed.map(String);
    }
  } catch {
    // Storage blocked/partitioned: the in-memory mirror still works this session.
  }
  hotbarAutoAssignOptOutMirror = new Set(stored);
  return hotbarAutoAssignOptOutMirror;
}

export function rememberHarthmereHotbarAutoAssignOptOut(
  itemId: string | null | undefined
) {
  const value = String(itemId ?? "").trim();
  if (!value) return;
  const optOut = readHarthmereHotbarAutoAssignOptOut();
  optOut.add(value);
  try {
    window.localStorage.setItem(
      HARTHMERE_HOTBAR_AUTO_ASSIGN_OPT_OUT_KEY,
      JSON.stringify([...optOut])
    );
  } catch {
    // In-memory mirror keeps the opt-out for this session.
  }
}

// Exposed for tests.
export function resetHarthmereHotbarAutoAssignOptOutForTest() {
  hotbarAutoAssignOptOutMirror = undefined;
}

// The harthmere quick-slot ref key is `harthmere_hotbar:<slot>:<itemId>`, and
// item ids themselves may contain colons (`b:3588…`), so take everything after
// the second separator.
export function harthmereHotbarItemIdFromRefKey(
  key: string | number | null | undefined
): string | undefined {
  const raw = String(key ?? "");
  if (!raw.startsWith("harthmere_hotbar:")) return undefined;
  const itemId = raw.split(":").slice(2).join(":");
  return itemId || undefined;
}

function assignLiveVoxelBlocksToEmptyHotbar(inventoryLootState: any) {
  const items = inventoryLootState?.actor?.items;
  if (!items || typeof items !== "object") return;
  const inventoryState = readHarthmereInventoryState();
  const optOut = readHarthmereHotbarAutoAssignOptOut();
  const assigned = new Set(
    Object.values(inventoryState.hotbar).filter(Boolean).map(String)
  );
  const emptySlots = Array.from(
    { length: 9 },
    (_unused, index) => index
  ).filter((index) => !inventoryState.hotbar[`slot_${index + 1}`]);
  if (emptySlots.length === 0) return;
  for (const [itemId, count] of Object.entries(items)) {
    if (Number(count) <= 0 || assigned.has(itemId)) continue;
    // Never re-add an item the player explicitly removed from the hotbar.
    if (optOut.has(itemId)) continue;
    // Native Bikkie stacks must be moved into the ECS hotbar with an
    // InventorySwapEvent. A local shortcut has no selected ECS item spec, so it
    // cannot place the voxel and only creates a phantom hotbar icon.
    if (nativeBiomesEcsAuthorityEnabled() && isNativeBikkieItemId(itemId)) {
      continue;
    }
    if (!isLiveVoxelBlockItemId(itemId)) continue;
    const slot = emptySlots.shift();
    if (slot === undefined) return;
    if (performHarthmereHotbarAssignForBiomesUI(itemId, slot, true)) {
      assigned.add(itemId);
    }
  }
}

function stackRecordToInventoryUiItems(
  items: Record<string, number> | undefined,
  source: InventoryContainerKey,
  refKind: "item" | "hotbar" | "wearable" | "material" = "item",
  options: {
    description?: string;
    canUse?: boolean;
    canEquip?: boolean;
    canMove?: boolean;
    canSplit?: boolean;
    canDrop?: boolean;
    canDestroy?: boolean;
    protectedReason?: string;
    indexOffset?: number;
  } = {}
): InventoryUiItem[] {
  return Object.entries(items ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([itemId, count], index) => {
      const display = getHarthmereItemDisplay(itemId);
      const equipSlot =
        display?.slot ?? inferEquipSlot({ id: itemId, name: itemId });
      const edibleFood = isHarthmereFoodItemPlayerEdible(itemId);
      const category = edibleFood
        ? "consumables"
        : display
          ? harthmereDisplayCategoryForBiomesUI(display.category, equipSlot)
          : inferInventoryCategory({ id: itemId });
      return {
        id: itemId,
        label: display?.name ?? humanizeRealItemId(itemId, itemId),
        icon: display?.icon ?? biomesInventoryItemIcon(itemId),
        count: Number(count) || 0,
        quality: "common" as InventoryUiItem["quality"],
        category,
        description:
          options.description ??
          display?.description ??
          "Stored in your backpack.",
        weight: inventoryUiItemWeight(
          itemId,
          Number(count) || 0,
          category,
          display?.name
        ),
        equipSlot,
        ref: (refKind === "wearable" || refKind === "material"
          ? { kind: refKind, key: itemId }
          : {
              kind: refKind,
              idx: index + Math.max(0, options.indexOffset ?? 0),
            }) as InventoryUiRef,
        source,
        storageLocation: source,
        canUse:
          options.canUse ??
          (edibleFood
            ? true
            : (display?.canUse ?? isLiveUsableBackpackItem(itemId))),
        useActionLabel: edibleFood ? "Eat" : undefined,
        canEquip: options.canEquip ?? display?.canEquip ?? Boolean(equipSlot),
        hotbarEligible: isHotbarEligibleItemId(itemId),
        canMove: options.canMove ?? false,
        canSplit: options.canSplit ?? false,
        canDrop: options.canDrop ?? false,
        canDestroy: options.canDestroy ?? false,
        protectedReason:
          options.protectedReason ??
          (isLiveUsableBackpackItem(itemId) || equipSlot
            ? undefined
            : "This item uses protected inventory handling."),
      };
    });
}

export function liveInventoryMutationCountForTest(
  availableCount: number | undefined,
  requestedCount: number | undefined
) {
  const available = Math.max(1, Math.trunc(Number(availableCount) || 1));
  return requestedCount === undefined
    ? available
    : Math.min(available, Math.max(1, Math.trunc(Number(requestedCount) || 1)));
}

function mergeInventoryStackRecords(
  ...records: Array<Record<string, number> | undefined>
): Record<string, number> | undefined {
  const merged: Record<string, number> = {};
  for (const record of records) {
    for (const [itemId, count] of Object.entries(record ?? {})) {
      const quantity = Number(count);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }
      merged[itemId] = (merged[itemId] ?? 0) + quantity;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function instanceRecordToInventoryUiItems(
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
    const display = getHarthmereItemDisplay(itemId);
    const equipSlot =
      display?.slot ??
      inferEquipSlot({
        id: itemId,
        name: itemId,
        category: instance.category,
        equipmentSlot: instance.equipmentSlot,
      });
    const edibleFood = isHarthmereFoodItemPlayerEdible(itemId);
    const category = edibleFood
      ? "consumables"
      : display
        ? harthmereDisplayCategoryForBiomesUI(display.category, equipSlot)
        : inferInventoryCategory({
            id: itemId,
            category: instance.category,
          });
    return [
      {
        id: instanceId,
        label: display?.name ?? humanizeRealItemId(itemId, itemId),
        icon: display?.icon ?? biomesInventoryItemIcon(itemId),
        count,
        quality: "common" as InventoryUiItem["quality"],
        category,
        weight: inventoryUiItemWeight(itemId, count, category, display?.name),
        equipSlot,
        description: display?.description
          ? display.description
          : [
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
        canUse: edibleFood ? true : isLiveUsableBackpackItem(itemId),
        useActionLabel: edibleFood ? "Eat" : undefined,
        canEquip: Boolean(equipSlot),
        hotbarEligible: isHotbarEligibleItemId(itemId),
        canMove: true,
        canSplit: false,
        canDrop: false,
        canDestroy: false,
        protectedReason:
          equipSlot || isLiveUsableBackpackItem(itemId)
            ? undefined
            : "This item uses protected inventory handling.",
      },
    ];
  });
}

function lootLedgerEntryToUi(
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
  const status = lootRouteStatus(entry);
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
    route: lootRouteLabel(status),
  };
}

function lootDropsToUi(
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

function lootRouteStatus(
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

function lootRouteLabel(status: string): string {
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
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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
  // HARTHMERE_OPTIMISTIC_STAMINA: the server can take 10-30s to respond, so
  // apply the food's restore to the HUD immediately. The authoritative
  // snapshot in the response (and every later poll) replaces this — the
  // server applies the same restore, so the values converge. Single choke
  // point: every eat path (inventory tab, hotbar use, quick action) funnels
  // through here.
  if (operation === "eat_food" && typeof window !== "undefined") {
    const itemId = String(payload.itemId ?? "");
    const food = HARTHMERE_FOOD_DEFINITIONS[itemId];
    if (food && food.staminaRestore > 0) {
      window.dispatchEvent(
        new CustomEvent(BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT, {
          detail: {
            staminaDelta: food.staminaRestore,
            itemId,
            label: food.displayName,
          } satisfies BiomesUIOptimisticPlayerStatusDetail,
        })
      );
    }
  }
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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
  if (operation === "eat_food") {
    completeHarthmereDailyTaskSoon("eat_meal");
  }
  if (["gather_seed", "plant", "water", "harvest"].includes(operation)) {
    completeHarthmereDailyTaskSoon("garden_care");
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
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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

async function submitEquipmentLiveModeAction(
  itemId: string | undefined,
  slot: string,
  instanceId?: string,
  clientClaims: Record<string, unknown> = {}
): Promise<any> {
  const mutationKey = `equipment:${slot}:${itemId ?? "empty"}:${
    instanceId ?? "stack"
  }`;
  return runHarthmereLiveMutationOnce(mutationKey, () =>
    runHarthmereLiveMutationSerially("inventory-equipment", async () => {
      const requestId = `biomes_ui_equipment_${slot}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/live_mode",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_equipment_change",
            subsystem: "equipment",
            actorEntityVersion: 1,
            zoneId: "the_grove",
            payload: { itemId, slot, instanceId },
            clientClaims,
            includeSnapshots: [
              "inventoryLootState",
              "questState",
              "playerStatusState",
            ],
          }),
        }
      );
      const body = await response.json();
      if (!response.ok || body?.ok === false) {
        throw new Error(
          Array.isArray(body?.validation?.errors)
            ? body.validation.errors.join(",")
            : `equipment_failed:${slot}`
        );
      }
      assertHarthmereLiveMutationAppliedForTest(
        body,
        "equipment_slots",
        "equipment_rejected:"
      );
      const equipment = body?.inventoryLootState?.actor?.equipment;
      const equippedItemId = equipment?.[slot];
      if (!equipment || (itemId ? equippedItemId !== itemId : equippedItemId)) {
        throw new Error(`equipment_state_mismatch:${slot}`);
      }
      return body;
    })
  );
}

async function submitInventoryItemLiveModeAction(
  operation: "drop_item" | "destroy_item" | "use_item",
  payload: {
    itemId: string;
    count?: number;
    sourceSlot?: string;
    // HARTHMERE_WORLD_THROW_DROP (audit fix, 2026-07-13): a drop_item that
    // carries the throw position makes the server create a positioned,
    // claimable world loot drop (rendered + F-pickup) instead of the item
    // silently vanishing after the debit.
    position?: { x: number; y: number; z: number };
  }
): Promise<any> {
  const mutationKey = `inventory:${operation}:${payload.itemId}:${
    payload.sourceSlot ?? "any"
  }`;
  return runHarthmereLiveMutationOnce(mutationKey, () =>
    runHarthmereLiveMutationSerially("inventory-equipment", async () => {
      const requestId = `biomes_ui_inventory_${operation}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/live_mode",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_inventory_item_action",
            subsystem: "inventory",
            actorEntityVersion: 1,
            zoneId: "the_grove",
            payload: { operation, ...payload },
            clientClaims: {},
            includeSnapshots: [
              "inventoryLootState",
              "playerStatusState",
              "questState",
            ],
          }),
        }
      );
      const body = await response.json();
      if (!response.ok || body?.ok === false) {
        throw new Error(
          Array.isArray(body?.validation?.errors)
            ? body.validation.errors.join(",")
            : `inventory_item_failed:${operation}`
        );
      }
      assertHarthmereLiveMutationAppliedForTest(
        body,
        "inventory_items",
        "inventory_item_rejected:"
      );
      if (
        operation === "drop_item" &&
        payload.position &&
        !body?.backendMutation?.touchedModels?.includes("inventory_loot_drops")
      ) {
        throw new Error("drop_item_world_drop_not_created");
      }
      return body;
    })
  );
}

// Building System UI state is hydrated from /api/harthmere/live_mode via
// the read_state action. Do not use browser storage as a source of ownership truth.

// BIOMES_UI_MAP_ADAPTER:
// Live map adapter feeds the upgraded MapQuestsTab with everything the
// player should see: their own position (from /scene/local_player), Grove
// landmarks, Harthmere business outposts, Jobs Board, all known NPCs, the
// active quest's marker path (highlighted), and the canonical map bounds.
// Coordinates are computed from world XZ via live landmark bounds, so markers
// stay correctly placed when the user pans/zooms in the tab. No hardcoded
// percentages.
export const buildBiomesUIMapAdapterForTest = buildBiomesUIMapAdapter;

export function dispatchBiomesUIOpenTab(tab: TabKey, source = "legacy"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_OPEN_TAB_EVENT, {
      detail: { tab, source },
    })
  );
}

// Persisted tab-shortcut overrides (rebindable in the Options tab). Stored as a
// sparse { tab: key } map layered over DEFAULT_TAB_SHORTCUTS so new default tabs
// keep working and only user-changed keys are saved.
const BIOMES_UI_TAB_SHORTCUTS_STORAGE_KEY = "biomes.ui.tabShortcuts";

function readPersistedTabShortcuts(): TabShortcut[] {
  if (typeof window === "undefined") {
    return DEFAULT_TAB_SHORTCUTS;
  }
  try {
    const raw = window.localStorage.getItem(
      BIOMES_UI_TAB_SHORTCUTS_STORAGE_KEY
    );
    if (!raw) {
      return DEFAULT_TAB_SHORTCUTS;
    }
    const overrides = JSON.parse(raw) as Record<string, string>;
    return DEFAULT_TAB_SHORTCUTS.map((shortcut) => {
      const key = overrides?.[shortcut.tab];
      return typeof key === "string" &&
        key &&
        !isReservedGameplayShortcutKey(key)
        ? { ...shortcut, key: key.toLowerCase(), label: key.toUpperCase() }
        : shortcut;
    });
  } catch {
    return DEFAULT_TAB_SHORTCUTS;
  }
}

function persistTabShortcut(tab: string, key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (isReservedGameplayShortcutKey(key)) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(
      BIOMES_UI_TAB_SHORTCUTS_STORAGE_KEY
    );
    const overrides = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    overrides[tab] = key.toLowerCase();
    window.localStorage.setItem(
      BIOMES_UI_TAB_SHORTCUTS_STORAGE_KEY,
      JSON.stringify(overrides)
    );
  } catch {}
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
    resources,
    mapManager,
  } = clientContext;
  const pointerLockManager = usePointerLockManager();
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const showEscortCompletionDialogue = (event: Event) => {
      const detail = (
        event as CustomEvent<HarthmereEscortArrivalDialogueDetail>
      ).detail;
      if (!detail?.dialogue) return;
      addToast(resources, {
        kind: "complete",
        id: `escort-arrival:${detail.companionId}:${
          detail.arrivedAtMs ?? "arrived"
        }`,
        message: `${detail.displayName}: “${detail.dialogue}”`,
      });
    };
    window.addEventListener(
      HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT,
      showEscortCompletionDialogue
    );
    return () =>
      window.removeEventListener(
        HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT,
        showEscortCompletionDialogue
      );
  }, [resources]);
  const inventory = reactResources.use("/ecs/c/inventory", userId) as any;
  const wearing = reactResources.use("/ecs/c/wearing", userId) as any;
  const nativeTriggerState = reactResources.use("/ecs/c/trigger_state", userId);
  const hotbarIndex = reactResources.use("/hotbar/index") as { value: number };
  const gameModal = reactResources.use("/game_modal") as GameModal;
  const dmMessages =
    (reactResources.use("/dms") as { messages?: any[] })?.messages ?? [];
  const activityMessages =
    (reactResources.use("/activity") as { messages?: any[] })?.messages ?? [];
  const activeNuxes =
    (reactResources.use("/nuxes/state_active") as { value?: unknown[] })
      ?.value ?? [];
  const nativeQuestBundles = reactResources.use("/challenges/all");
  // BIOMES_UI_MAP_TAB quest markers: subscribe to MapManager's resolved
  // navigation aids so an npc/entity/group objective produces a map marker at
  // the same place its in-world beacon points. `useNavigationAids` re-renders
  // on `onNavigationAidsUpdated`, which is what makes an async NPC location
  // fetch land on the map without a manual refresh.
  const resolvedNavigationAids = mapManager.react.useNavigationAids();
  const resolvedNavigationAidsRevision =
    nativeQuestNavigationAidsRevisionForTest(resolvedNavigationAids);
  const resolveNativeQuestNavAidPosition = React.useMemo(
    () =>
      buildNativeQuestNavAidResolver({
        navigationAids: resolvedNavigationAids,
        questBundles: nativeQuestBundles as readonly QuestBundle[] | undefined,
        questGiverBeamPosition: (npcTypeId) => {
          try {
            return getNpcBehavior(idToNpcType(npcTypeId))?.questGiver
              ?.beamPosition;
          } catch {
            // An unknown/retired npc type must not take the whole map down.
            return undefined;
          }
        },
        npcTypePosition: (npcTypeId) => {
          const player = reactResources.get("/scene/local_player") as any;
          const playerPosition = player?.player?.position as
            readonly number[] | undefined;
          let best:
            | { distanceSquared: number; position: [number, number, number] }
            | undefined;
          for (const entity of clientContext.table.contents()) {
            if (
              Number(entity.npc_metadata?.type_id) !== Number(npcTypeId) ||
              !entity.position?.v
            ) {
              continue;
            }
            const [x, y, z] = entity.position.v.map(Number);
            if (![x, y, z].every(Number.isFinite)) continue;
            const dx = x - Number(playerPosition?.[0] ?? x);
            const dz = z - Number(playerPosition?.[2] ?? z);
            const distanceSquared = dx * dx + dz * dz;
            if (!best || distanceSquared < best.distanceSquared) {
              best = { distanceSquared, position: [x, y, z] };
            }
          }
          return best?.position;
        },
        fallbackPosition: () => {
          const player = reactResources.get("/scene/local_player") as any;
          const position = player?.player?.position;
          if (!Array.isArray(position) || position.length < 3) return undefined;
          const [x, y, z] = position.map(Number);
          return [x, y, z].every(Number.isFinite)
            ? ([x, y, z] as const)
            : undefined;
        },
      }),
    [
      clientContext.table,
      nativeQuestBundles,
      reactResources,
      resolvedNavigationAids,
      resolvedNavigationAidsRevision,
    ]
  );
  const nativeQuestMarkersForAutoDestination = React.useMemo(
    () =>
      nativeQuestMapMarkers(
        nativeQuestBundles,
        resolveNativeQuestNavAidPosition
      ),
    [nativeQuestBundles, resolveNativeQuestNavAidPosition]
  );
  const nativeTrackableQuestsForAutoDestination = React.useMemo(
    () =>
      nativeQuestTrackableQuests(
        nativeQuestBundles,
        resolveNativeQuestNavAidPosition
      ),
    [nativeQuestBundles, resolveNativeQuestNavAidPosition]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let existingPin = readActiveBiomesUIMapPin();
    if (
      shouldClearOwnedQuestMapPinForTest({
        pin: existingPin,
        quests: nativeTrackableQuestsForAutoDestination,
      })
    ) {
      writeActiveBiomesUIMapPin(undefined);
      existingPin = undefined;
    }
    const storedSelection = readBiomesUIMainQuestSelection();
    const quest = mainQuestFromTrackableQuestsForTest(
      nativeTrackableQuestsForAutoDestination,
      storedSelection
    );
    const automaticSelection = automaticMainQuestSelectionForTest(
      nativeTrackableQuestsForAutoDestination,
      storedSelection
    );
    if (automaticSelection) {
      // One authoritative handoff for every Chapter 1 boundary: journal star,
      // HUD objective, minimap/world beam and persisted selection all move to
      // the same newly active native quest.
      writeBiomesUIMainQuestSelection(automaticSelection);
      mapManager.trackingQuestId = safeParseBiomesId(
        automaticSelection.questId
      );
    }
    const destinationQuest = automaticSelection
      ? mainQuestFromTrackableQuestsForTest(
          nativeTrackableQuestsForAutoDestination,
          automaticSelection
        )
      : quest;
    const marker = automaticQuestDestinationMarkerForTest({
      existingPin,
      quest: destinationQuest,
      markers: nativeQuestMarkersForAutoDestination,
    });
    if (!marker) return;
    const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
    if (pin) {
      writeActiveBiomesUIMapPin(pin);
    }
  }, [
    nativeQuestMarkersForAutoDestination,
    nativeTrackableQuestsForAutoDestination,
    mapManager,
  ]);
  const [snapshotRevision, setSnapshotRevision] = React.useState(0);
  const [hoeQuestState, setHoeQuestState] =
    React.useState<HarthmereHoeQuestState>("loading");
  const [harthmereInventoryRevision, setHarthmereInventoryRevision] =
    React.useState(0);
  const roadAheadChallengeStepHints = React.useMemo(
    () => [
      ...(resources.cached("/challenges/active_leaves") ?? []),
      ...snapshotRoadAheadChallengeStepHintsFromActiveNuxesForBiomesUI(
        activeNuxes
      ),
    ],
    [activeNuxes, resources, snapshotRevision]
  );
  React.useEffect(() => {
    if (nativeRoadAheadEcsAuthorityEnabled()) {
      return;
    }
    if (
      syncSnapshotRoadAheadChallengeStepHintsForBiomesUI(
        roadAheadChallengeStepHints
      )
    ) {
      setSnapshotRevision((value) => value + 1);
    }
  }, [roadAheadChallengeStepHints]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const synchronizeHoeQuest = () => {
      const farmingModel = buildNativeFarmingInterfaceModel({
        userId,
        inventory,
        entities: clientContext.table.contents(),
      });
      const next = reconcileHarthmereHoeQuestState(userId, farmingModel.hasHoe);
      setHoeQuestState(next);
      if (
        next === "completed" &&
        readActiveBiomesUIMapPin()?.markerId === HARTHMERE_HOE_VENDOR_MARKER_ID
      ) {
        writeActiveBiomesUIMapPin(undefined);
      }
    };
    synchronizeHoeQuest();
    window.addEventListener(HARTHMERE_HOE_QUEST_EVENT, synchronizeHoeQuest);
    window.addEventListener("storage", synchronizeHoeQuest);
    return () => {
      window.removeEventListener(
        HARTHMERE_HOE_QUEST_EVENT,
        synchronizeHoeQuest
      );
      window.removeEventListener("storage", synchronizeHoeQuest);
    };
  }, [
    clientContext,
    harthmereInventoryRevision,
    inventory?.hotbar,
    inventory?.items,
    inventory?.overflow,
    snapshotRevision,
    userId,
  ]);
  // Tab-shortcut rebindings from the Options tab, persisted to localStorage and
  // fed back to BiomesUI as shortcutOverrides so the rebinds actually open tabs.
  const [tabShortcuts, setTabShortcuts] = React.useState<TabShortcut[]>(() =>
    readPersistedTabShortcuts()
  );
  const setTabShortcut = React.useCallback((tab: string, key: string) => {
    persistTabShortcut(tab, key);
    setTabShortcuts((prev) =>
      prev.map((shortcut) =>
        shortcut.tab === tab
          ? { ...shortcut, key: key.toLowerCase(), label: key.toUpperCase() }
          : shortcut
      )
    );
  }, []);
  const [bankingState, setBankingState] = React.useState<any | undefined>(
    undefined
  );
  const [bankingHydrated, setBankingHydrated] = React.useState(false);
  const [guildState, setGuildState] = React.useState<any | undefined>(
    undefined
  );
  const [guildHydrated, setGuildHydrated] = React.useState(false);
  const [buildingState, setBuildingState] = React.useState<
    HarthmerePropertyMapBuildingState | undefined
  >(undefined);
  const [buildingHydrated, setBuildingHydrated] = React.useState(false);
  const [inventoryLootState, setInventoryLootState] = React.useState<
    any | undefined
  >(undefined);
  const [inventoryLootHydrated, setInventoryLootHydrated] =
    React.useState(false);
  // HARTHMERE_LIVE_INVENTORY_SNAPSHOT (audit fix, 2026-07-13): mirror every
  // live inventory update into the module-level snapshot so non-React code
  // (Road Ahead muck-buster step, quest bridges) can check server-owned items.
  React.useEffect(() => {
    if (!inventoryLootState) return;
    recordHarthmereLiveInventoryItemsSnapshot({ inventoryLootState });
  }, [inventoryLootState]);
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
  const jobsBoardStateWithLiveInventory = React.useMemo(
    () =>
      jobsBoardSnapshotWithLiveInventoryForTest(
        jobsBoardState,
        inventoryLootState
      ),
    [inventoryLootState, jobsBoardState]
  );
  const [questState, setQuestState] = React.useState<any | undefined>(
    undefined
  );
  const [questStateHydrated, setQuestStateHydrated] = React.useState(false);
  const shouldReturnPointerLockRef = React.useRef(false);
  const questStateRefreshInFlightRef = React.useRef(false);
  const previousJobsBoardStateRef = React.useRef<any | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setSnapshotRevision((value) => value + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT, bump);
    window.addEventListener("biomes:snapshot-grove-tutor-hud-highlights", bump);
    window.addEventListener(SNAPSHOT_MISSION_STATE_EVENT, bump);
    window.addEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(SNAPSHOT_GROVE_QUEST_STATE_EVENT, bump);
      window.removeEventListener(
        "biomes:snapshot-grove-tutor-hud-highlights",
        bump
      );
      window.removeEventListener(SNAPSHOT_MISSION_STATE_EVENT, bump);
      window.removeEventListener(LIVE_ENTITY_HELPER_QUEST_EVENT, bump);
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

  // IMPORTANT: never project Redis/localStorage equipment or hotbar state into
  // `/ecs/c/wearing` or `/ecs/c/inventory`. Those paths are synchronized by the
  // native ECS replica and are also the source read by native quest triggers.
  // Harthmere-only items remain visible through the adapter's derived UI model;
  // physical native items must be changed by publishing native inventory events.
  void harthmereInventoryRevision;

  const refreshBankingState = React.useCallback(async () => {
    try {
      const nextState = await fetchBankingState();
      setBankingState(nextState);
    } catch {
      setBankingState(undefined);
    } finally {
      setBankingHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("banking", activeTab)) return;
    void refreshBankingState();
  }, [activeTab, refreshBankingState]);

  const refreshGuildState = React.useCallback(async () => {
    try {
      const nextState = await fetchBiomesUIGuildState();
      setGuildState(nextState);
    } catch {
      setGuildState(undefined);
    } finally {
      setGuildHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("guild", activeTab)) return;
    void refreshGuildState();
  }, [activeTab, refreshGuildState]);

  const refreshBuildingState = React.useCallback(async () => {
    try {
      const nextState = await fetchBuildingSystemState();
      setBuildingState(nextState);
      dispatchHarthmereBuildingStateUpdate(nextState);
    } catch {
      setBuildingState(undefined);
    } finally {
      setBuildingHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("building", activeTab)) return;
    void refreshBuildingState();
  }, [activeTab, refreshBuildingState]);

  const submitBuildingSystemLiveModeActionAndStore = React.useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const body = await submitBuildingSystemLiveModeAction(action, payload);
      if (body?.buildingState) {
        setBuildingState(body.buildingState);
        dispatchHarthmereBuildingStateUpdate(body.buildingState);
      } else if (action !== "read_state") {
        void refreshBuildingState();
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
      }
      dispatchLiveModePlayerStatusFromBody(body);
      return body;
    },
    [refreshBuildingState]
  );

  const refreshInventoryLootState = React.useCallback(async () => {
    try {
      const nextState = await fetchInventoryLootState();
      setInventoryLootState(nextState);
    } catch {
      setInventoryLootState(undefined);
    } finally {
      setInventoryLootHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("inventoryLoot", activeTab)) {
      return;
    }
    void refreshInventoryLootState();
  }, [activeTab, refreshInventoryLootState]);

  // HARTHMERE_PICKUP_TOASTS (2026-07-06): universal "you picked something up"
  // feedback. Every authoritative inventory snapshot (mutation responses AND
  // polls) flows through the inventoryLootState React state, so diffing
  // consecutive snapshots here announces EVERY item gain — harvests, foraging,
  // loot rolls, quest rewards — without wiring each action separately. The
  // first snapshot after load never toasts (it isn't a pickup).
  const lastPickupToastItemsRef = React.useRef<
    Record<string, number> | undefined
  >(undefined);
  React.useEffect(() => {
    const items = inventoryLootState?.actor?.items;
    if (!items || typeof items !== "object") return;
    const next: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(items)) {
      next[itemId] = Math.max(0, Math.trunc(Number(count) || 0));
    }
    const prev = lastPickupToastItemsRef.current;
    lastPickupToastItemsRef.current = next;
    if (!prev) return;
    for (const [itemId, count] of Object.entries(next)) {
      const gained = count - (prev[itemId] ?? 0);
      if (gained <= 0) continue;
      const display = getHarthmereItemDisplay(itemId);
      const label = display?.name ?? humanizeRealItemId(itemId, itemId);
      try {
        addToast(clientContext.resources as any, {
          kind: "basic",
          id: `harthmere-item-pickup:${itemId}:${Date.now()}`,
          message: `+${gained} ${label} added to your backpack.`,
        });
      } catch {
        // Toast surface unavailable (e.g. during teardown) — never let
        // feedback break the inventory update itself.
      }
    }
  }, [clientContext.resources, inventoryLootState?.actor?.items]);

  // Immediate eat feedback toast paired with the optimistic stamina delta —
  // the authoritative response can take 10-30s, so acknowledge the action now.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<BiomesUIOptimisticPlayerStatusDetail>
      ).detail;
      const delta = Number(detail?.staminaDelta);
      if (!Number.isFinite(delta) || delta <= 0) return;
      const label =
        detail?.label ??
        (detail?.itemId
          ? humanizeRealItemId(detail.itemId, detail.itemId)
          : "food");
      try {
        addToast(clientContext.resources as any, {
          kind: "basic",
          id: `harthmere-eat-food:${detail?.itemId ?? "food"}:${Date.now()}`,
          message: `You eat ${label} (+${delta} stamina).`,
        });
      } catch {
        // Toast surface unavailable — the stamina bar still updates.
      }
    };
    window.addEventListener(BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT, handler);
    return () =>
      window.removeEventListener(
        BIOMES_UI_OPTIMISTIC_PLAYER_STATUS_EVENT,
        handler
      );
  }, [clientContext.resources]);

  const refreshProgressionState = React.useCallback(async () => {
    try {
      const nextState = await fetchProgressionState();
      if (nextState) {
        setProgressionState(nextState);
      }
    } catch {
      // Keep the last authoritative snapshot during a transient refresh error.
    } finally {
      setProgressionHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("progression", activeTab)) return;
    void refreshProgressionState();
  }, [activeTab, refreshProgressionState]);

  const refreshDailyState = React.useCallback(async () => {
    try {
      const nextState = await fetchDailyState();
      setDailyState(nextState);
    } catch {
      setDailyState(undefined);
    } finally {
      setDailyHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const body = (event as CustomEvent<{ body?: any }>).detail?.body;
      if (body?.dailyState) {
        setDailyState(body.dailyState);
        setDailyHydrated(true);
      } else {
        void refreshDailyState();
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
      }
      dispatchLiveModePlayerStatusFromBody(body);
    };
    window.addEventListener(HARTHMERE_DAILY_TASK_COMPLETED_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_DAILY_TASK_COMPLETED_EVENT, handler);
  }, [refreshDailyState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail ?? {};
      const body = detail.body ?? {
        inventoryLootState: detail.inventoryLootState,
        playerStatusState: detail.playerStatusState,
      };
      const nextInventoryLootState =
        detail.inventoryLootState ?? body?.inventoryLootState;
      if (nextInventoryLootState) {
        recordHarthmereLiveInventoryItemsSnapshot({
          inventoryLootState: nextInventoryLootState,
        });
        setInventoryLootState(nextInventoryLootState);
        setInventoryLootHydrated(true);
        window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
        window.dispatchEvent(
          new CustomEvent("biomes:live-mode-wallet-updated", {
            detail: { gold: (nextInventoryLootState as any)?.actor?.gold },
          })
        );
      } else {
        void refreshInventoryLootState();
      }
      dispatchLiveModePlayerStatusFromBody(body);
    };
    window.addEventListener(
      HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
      handler
    );
    return () =>
      window.removeEventListener(
        HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
        handler
      );
  }, [refreshInventoryLootState]);

  React.useEffect(() => {
    const handler = (event: any) => {
      if (event?.kind === "destroy") {
        completeHarthmereDailyTaskSoon("forage_walk");
      }
      if (event?.kind === "place_voxel") {
        completeHarthmereDailyTaskSoon("home_care");
      }
      if (event?.kind === "challenge_step_complete") {
        completeHarthmereDailyTaskSoon("main_quest");
      }
      if (
        event?.kind === "challenge_step_begin" ||
        event?.kind === "challenge_step_complete"
      ) {
        const recorded = recordSnapshotRoadAheadChallengeStepForBiomesUI(
          event.stepId,
          event.kind === "challenge_step_begin" ? "begin" : "complete"
        );
        if (recorded) {
          setSnapshotRevision((value) => value + 1);
        }
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [gardenHose]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldHydrateBiomesUILiveStateForTab("daily", activeTab)) return;
    void refreshDailyState();
  }, [activeTab, refreshDailyState]);

  const refreshFarmingFoodState = React.useCallback(async () => {
    try {
      const nextState = await fetchFarmingFoodState();
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

  const refreshJobsBoardState = React.useCallback(async (force = false) => {
    try {
      setJobsBoardState(await fetchHarthmereJobsBoardState(fetch, { force }));
    } catch {
      setJobsBoardState(undefined);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshJobsBoardState();
  }, [refreshJobsBoardState]);

  const jobsBoardHasFollowingEscort =
    harthmereJobsBoardHasFollowingEscortForTest(jobsBoardState);
  React.useEffect(() => {
    if (
      !jobsBoardHasFollowingEscort ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const refreshIfVisible = () => {
      if (document.visibilityState !== "hidden") {
        void refreshJobsBoardState(true);
      }
    };
    const intervalId = window.setInterval(refreshIfVisible, 2_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [jobsBoardHasFollowingEscort, refreshJobsBoardState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const newlyAcceptedTodoId = newlyAcceptedJobsBoardTodoIdForTest({
      previous: previousJobsBoardStateRef.current,
      next: jobsBoardStateWithLiveInventory,
    });
    previousJobsBoardStateRef.current = jobsBoardStateWithLiveInventory;
    const toolOwned = harthmereJobToolOwnedState();
    const landmarks = [
      ...jobsBoardToolSourceLandmarksForBiomesUI(
        jobsBoardStateWithLiveInventory,
        toolOwned
      ),
      ...jobsBoardItemSourceLandmarksForBiomesUI(
        jobsBoardStateWithLiveInventory
      ),
      ...jobsBoardAcceptedJobLandmarksForBiomesUI(
        jobsBoardStateWithLiveInventory
      ),
    ];
    if (newlyAcceptedTodoId) {
      const acceptedQuest = jobsBoardTrackableQuestsForBiomesUI(
        jobsBoardStateWithLiveInventory,
        Date.now(),
        toolOwned
      ).find(
        (quest) => quest.questId === `jobs_board:${newlyAcceptedTodoId}`
      );
      if (acceptedQuest) {
        setBiomesUIMainQuestFromTrackableQuest(acceptedQuest);
      }
      const destination = landmarks.find(
        (landmark) => landmark.jobsBoardTodoId === newlyAcceptedTodoId
      );
      if (destination) {
        const pin = activeBiomesUIMapPinFromMarkerForTest({
          id: destination.id,
          label: destination.label,
          kind: destination.kind,
          worldPosition: destination.position,
          description: destination.description,
          worldObjectId: destination.mapMarkerId,
          interactionTargetId: destination.targetId,
        });
        if (pin) writeActiveBiomesUIMapPin(pin);
      }
      return;
    }
    let existing = readActiveBiomesUIMapPin();
    const existingJobsBoardTodoId = jobsBoardTodoIdFromMarkerIdForTest(
      existing?.markerId
    );
    const handoffLandmark = jobsBoardLandmarkForActivePinHandoffForTest({
      activePinMarkerId: existing?.markerId,
      landmarks,
    });
    // Drop a jobs-board pin whose job is no longer active (completed/abandoned)
    // so it stops driving the HUD aid and suppressing other quest beacons.
    if (
      shouldClearStaleJobsBoardPin({
        activePinMarkerId: existing?.markerId,
        activeJobsBoardMarkerIds: landmarks.map((landmark) => landmark.id),
      })
    ) {
      if (!handoffLandmark) {
        writeActiveBiomesUIMapPin(undefined);
        return;
      }
    }
    if (existingJobsBoardTodoId && handoffLandmark) {
      const nextPin = activeBiomesUIMapPinFromMarkerForTest({
        id: handoffLandmark.id,
        label: handoffLandmark.label,
        kind: handoffLandmark.kind,
        worldPosition: handoffLandmark.position,
        description: handoffLandmark.description,
        worldObjectId: handoffLandmark.mapMarkerId,
        interactionTargetId: handoffLandmark.targetId,
      });
      if (
        nextPin &&
        (existing?.markerId !== nextPin.markerId ||
          existing.label !== nextPin.label ||
          existing.description !== nextPin.description ||
          existing.worldObjectId !== nextPin.worldObjectId ||
          existing.interactionTargetId !== nextPin.interactionTargetId ||
          existing.worldPosition.some(
            (value, index) => value !== nextPin.worldPosition[index]
          ))
      ) {
        writeActiveBiomesUIMapPin(nextPin);
      }
      return;
    }
    // A player-selected destination always wins. The previous implementation
    // reset a selected jobs-board marker whenever Road Ahead was active and
    // otherwise replaced it with landmarks[0], which made marker switching
    // appear stuck on the main quest or the first accepted job.
    if (existing?.markerId && Array.isArray(existing.worldPosition)) {
      return;
    }
    const landmark = landmarks[0];
    if (!landmark) return;
    if (
      existing?.markerId === landmark.id &&
      Array.isArray(existing.worldPosition)
    ) {
      return;
    }
    const pin = activeBiomesUIMapPinFromMarkerForTest({
      id: landmark.id,
      label: landmark.label,
      kind: landmark.kind,
      worldPosition: landmark.position,
      description: landmark.description,
      worldObjectId: landmark.mapMarkerId,
      interactionTargetId: landmark.targetId,
    });
    if (pin) {
      writeActiveBiomesUIMapPin(pin);
    }
  }, [jobsBoardStateWithLiveInventory]);

  const refreshQuestState = React.useCallback(async () => {
    if (questStateRefreshInFlightRef.current) return;
    questStateRefreshInFlightRef.current = true;
    try {
      setQuestState(await fetchHarthmereQuestState());
    } catch {
      setQuestState(undefined);
    } finally {
      questStateRefreshInFlightRef.current = false;
      setQuestStateHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshQuestState();
  }, [refreshQuestState]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const refreshIfVisible = () => {
      if (document.visibilityState !== "hidden") {
        void refreshQuestState();
      }
    };
    const intervalId = window.setInterval(
      refreshIfVisible,
      HARTHMERE_QUEST_INVITE_POLL_INTERVAL_MS
    );
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refreshQuestState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ questState?: unknown }>).detail;
      if (detail?.questState) {
        setQuestState(normalizeHarthmereQuestState(detail.questState));
      } else {
        void refreshQuestState();
      }
    };
    window.addEventListener(HARTHMERE_QUEST_INVITES_UPDATED_EVENT, handler);
    window.addEventListener(
      SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT,
      handler
    );
    return () => {
      window.removeEventListener(
        HARTHMERE_QUEST_INVITES_UPDATED_EVENT,
        handler
      );
      window.removeEventListener(
        SNAPSHOT_GROVE_LIVE_QUEST_STATE_SYNC_EVENT,
        handler
      );
    };
  }, [refreshQuestState]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = harthmereJobsBoardStateFromUpdatedEventDetail(
        (event as CustomEvent).detail
      );
      if (detail) {
        setJobsBoardState(normalizeHarthmereJobsBoardSnapshot(detail));
      } else {
        void refreshJobsBoardState();
      }
    };
    window.addEventListener(HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT, handler);
    return () =>
      window.removeEventListener(
        HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT,
        handler
      );
  }, [refreshJobsBoardState]);

  const applyLiveModeInventoryResponse = React.useCallback(
    async (body: any) => {
      if (body?.inventoryLootState) {
        assignLiveVoxelBlocksToEmptyHotbar(body.inventoryLootState);
        // Quest bridges are event-driven and can run before React commits this
        // state update. Record the authoritative equipment/items synchronously
        // so an equip response advances the matching objective immediately.
        recordHarthmereLiveInventoryItemsSnapshot(body);
        setInventoryLootState(body.inventoryLootState);
      } else {
        await refreshInventoryLootState();
      }
      if (body?.farmingFoodState) {
        setFarmingFoodState(body.farmingFoodState);
      } else {
        await refreshFarmingFoodState();
      }
      if (body?.questState) {
        setQuestState(normalizeHarthmereQuestState(body.questState));
        setQuestStateHydrated(true);
      }
      dispatchLiveModePlayerStatusFromBody(body);
    },
    [refreshFarmingFoodState, refreshInventoryLootState]
  );

  const useLocalHarthmereFoodItem = React.useCallback(
    (instanceId: string, itemId: string, source: string) => {
      performHarthmereBackpackItemUseForBiomesUI(instanceId, itemId);
      fireAndForget(
        (async () => {
          const liveCount = Math.max(
            0,
            Math.trunc(Number(inventoryLootState?.actor?.items?.[itemId] ?? 0))
          );
          if (liveCount <= 0) {
            await submitHarthmereInventoryGrantToLiveModeForTest(
              itemId,
              1,
              "Local backpack food synced for eating"
            );
          }
          const body = await submitFarmingFoodLiveModeAction("eat_food", {
            itemId,
          });
          await applyLiveModeInventoryResponse(body);
          dispatchBiomesUITutorialItemUse(
            {
              id: itemId,
              label: humanizeRealItemId(itemId, itemId),
              category: inferInventoryCategory({ id: itemId }),
              useEffect: "stamina",
              instanceId,
            },
            source
          );
        })().catch(() => refreshInventoryLootState())
      );
    },
    [
      applyLiveModeInventoryResponse,
      inventoryLootState?.actor?.items,
      refreshInventoryLootState,
    ]
  );

  // Eat any edible food held in the live inventory — including world-saved items
  // that arrive as single instances and so have no stackable count. We grant a
  // transient stack only when the authoritative count is missing so the server
  // can always resolve the item and restore stamina (mirrors the proven local
  // food path). When the item is a real stack this decrements it normally.
  const eatLiveHarthmereFoodById = React.useCallback(
    (itemId: string, label: string, category: string, source: string) => {
      fireAndForget(
        (async () => {
          const liveCount = Math.max(
            0,
            Math.trunc(Number(inventoryLootState?.actor?.items?.[itemId] ?? 0))
          );
          if (liveCount <= 0) {
            await submitHarthmereInventoryGrantToLiveModeForTest(
              itemId,
              1,
              "Live food synced for eating"
            );
          }
          const body = await submitFarmingFoodLiveModeAction("eat_food", {
            itemId,
          });
          await applyLiveModeInventoryResponse(body);
          dispatchBiomesUITutorialItemUse(
            {
              id: itemId,
              label,
              category,
              useEffect: "stamina",
            },
            source
          );
        })().catch(() => refreshInventoryLootState())
      );
    },
    [
      applyLiveModeInventoryResponse,
      inventoryLootState?.actor?.items,
      refreshInventoryLootState,
    ]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail;
      const body = detail?.body ?? detail;
      void applyLiveModeInventoryResponse(body);
      setSnapshotRevision((value) => value + 1);
    };
    window.addEventListener(
      LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT,
      handler
    );
    return () =>
      window.removeEventListener(
        LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT,
        handler
      );
  }, [applyLiveModeInventoryResponse]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ body?: any }>).detail ?? {};
      void applyLiveModeInventoryResponse(detail.body ?? detail);
      setSnapshotRevision((value) => value + 1);
    };
    window.addEventListener(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, handler);
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
      const tab = biomesUITabForKeyboardCodeForTest(
        event.code,
        hasSelectedWorldInteractionCandidate(event.code)
      );
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openTab(tab, "toggle");
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [openTab, replacementMode]);

  const farmingFoodQuickModel = React.useMemo(
    () =>
      buildFarmingFoodInterfaceModelForTest(
        farmingFoodState,
        farmingFoodHydrated
      ),
    [farmingFoodHydrated, farmingFoodState]
  );
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
      // F is exclusively owned by a concrete inspected/proximity target. This
      // listener retains only the non-world T cooking shortcut. R is owned by
      // the native Recipes modal and must reach the recipes-only ShortcutsHUD.
      if (event.code === "KeyF") return;
      const action = farmingFoodQuickActionForKey(
        farmingFoodQuickModel,
        event.code
      );
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
    farmingFoodQuickModel,
    refreshFarmingFoodState,
    replacementMode,
  ]);

  React.useEffect(() => {
    if (!replacementMode) return;
    // Crafting remains the native Biomes modal. If R is pressed while a
    // replacement tab is open, close that tab instead of leaving it stacked
    // over Recipes; the mounted recipes-only ShortcutsHUD owns the actual
    // modal toggle and its drag/audio cleanup.
    if (gameModal.kind === "crafting") {
      if (activeTab !== null) {
        setActiveTabFromUi(null);
      }
      return;
    }
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
  }, [
    activeTab,
    gameModal.kind,
    reactResources,
    replacementMode,
    setActiveTabFromUi,
  ]);

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
    void harthmereInventoryRevision;
    const localInventoryState = readHarthmereInventoryState();
    const localHotbarItemIds = Array.from(
      { length: 9 },
      (_unused, index) => localInventoryState.hotbar[`slot_${index + 1}`]
    );
    // Real carried count for a quick-slot item: live-mode server count when
    // present, else the local backpack quantity (hotbar slots are shortcuts,
    // not stacks of their own — showing `1` for a stack of 7 was wrong).
    const liveCountsForHotbarItem = (itemId: string) =>
      harthmereHotbarCarriedCounts(inventoryLootState, itemId);
    const carriedCountForHotbarItem = (itemId: string) => {
      const liveCount = liveCountsForHotbarItem(itemId).total;
      if (liveCount > 0) {
        return liveCount;
      }
      const localCount = localInventoryState.backpack.items
        .filter((item) => item.itemId === itemId)
        .reduce(
          (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
          0
        );
      return localCount;
    };
    const heldCompatibilityItemIdForSlot = (index: number) => {
      if (hotbarSlots[index]) return undefined;
      const itemId = localHotbarItemIds[index];
      if (!itemId) return undefined;
      if (nativeBiomesEcsAuthorityEnabled() && isNativeBikkieItemId(itemId)) {
        return undefined;
      }
      if (carriedCountForHotbarItem(itemId) <= 0) return undefined;
      const display = getHarthmereItemDisplay(itemId);
      return display && ["weapon", "tool"].includes(display.category)
        ? itemId
        : undefined;
    };
    const selectVisibleHotbarIndex = (index: number) => {
      const slotIndex = clampHotbarIndex(index, 9);
      selectHotbarIndex(slotIndex);
      dispatchHarthmereHotbarHeldItemSelection(
        heldCompatibilityItemIdForSlot(slotIndex)
      );
      return slotIndex;
    };
    const nativeBackpackArrowCount = Number(
      harthmereBackpackArrowCount(inventory)
    );
    const localBackpackArrowCount = localInventoryState.backpack.items
      .filter((item) => item.itemId === HARTHMERE_ARROW_ITEM_ID)
      .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    const bowArrowCount = nativeBiomesEcsAuthorityEnabled()
      ? nativeBackpackArrowCount
      : Math.max(nativeBackpackArrowCount, localBackpackArrowCount);
    const slots = Array.from({ length: 9 }, (_unused, index) => {
      // A populated ECS hotbar slot is the authoritative stack. A Harthmere
      // quick-slot may only fill an empty native slot and only when the item is
      // actually carried; this prevents stale localStorage assignments from
      // manufacturing items that do not exist in inventory.
      const nativeSlot = slotToUiItem(
        hotbarSlots[index],
        `hotbar_${index + 1}`
      );
      if (nativeSlot) {
        return isHarthmereBowWeapon(hotbarSlots[index]?.item)
          ? {
              ...nativeSlot,
              count: bowArrowCount,
              showZeroCount: true,
            }
          : nativeSlot;
      }
      const localItemId = localHotbarItemIds[index];
      if (localItemId) {
        if (
          nativeBiomesEcsAuthorityEnabled() &&
          isNativeBikkieItemId(localItemId)
        ) {
          return null;
        }
        const carriedCount = carriedCountForHotbarItem(localItemId);
        if (carriedCount <= 0) return null;
        const localItem = localHarthmereHotbarItemToUiItem(
          localItemId,
          index,
          carriedCount
        );
        if (localItem) {
          const uiItem = localItem as unknown as HotbarSlotItem;
          return getHarthmerePremiumWeapon(localItemId)?.family === "bow"
            ? {
                ...uiItem,
                count: bowArrowCount,
                showZeroCount: true,
              }
            : uiItem;
        }
      }
      return null;
    });
    const dropHotbarItem = async (index: number) => {
      const slotIndex = clampHotbarIndex(index, 9);
      const droppedLocalItemId = hotbarSlots[slotIndex]
        ? undefined
        : localHotbarItemIds[slotIndex];
      if (droppedLocalItemId) {
        const liveCounts = liveCountsForHotbarItem(droppedLocalItemId);
        if (liveCounts.total > 0) {
          try {
            const body = await submitInventoryItemLiveModeAction("drop_item", {
              itemId: droppedLocalItemId,
              count: 1,
              sourceSlot:
                liveCounts.backpack > 0 ? undefined : "material_storage",
              position: harthmereThrowDropPosition(clientContext),
            });
            await applyLiveModeInventoryResponse(body);
            const remaining =
              Math.max(
                0,
                Number(
                  body?.inventoryLootState?.actor?.items?.[
                    droppedLocalItemId
                  ] ?? 0
                )
              ) +
              Math.max(
                0,
                Number(
                  body?.inventoryLootState?.materialStorage?.items?.[
                    droppedLocalItemId
                  ] ?? 0
                )
              );
            if (remaining <= 0) {
              performHarthmereHotbarClearForBiomesUI(slotIndex);
            }
          } catch (error) {
            await refreshInventoryLootState();
            throw error;
          }
        } else if (!harthmereLiveServerAuthoritative()) {
          const consumed = consumeHarthmereItemByItemId(
            droppedLocalItemId,
            1,
            `Threw ${humanizeRealItemId(
              droppedLocalItemId,
              droppedLocalItemId
            )}`
          );
          if (consumed > 0) {
            performHarthmereHotbarClearForBiomesUI(slotIndex);
          }
        } else {
          throw new Error("That item is no longer in your inventory.");
        }
        return;
      }
      const localPlayer = reactResources.get("/scene/local_player");
      if (!localPlayer?.id) {
        throw new Error("Your player inventory is not ready yet.");
      }
      // Throw exactly one item. Omitting count throws the entire native stack
      // and was the reason a selected Muckwad stack disappeared at once.
      await throwOneNativeHotbarItem(
        clientContext as any,
        localPlayer.id,
        slotIndex
      );
    };

    return {
      slots,
      selectedIndex,
      onSelect: selectVisibleHotbarIndex,
      /**
       * Activate the selected item's authored primary action. Native items are
       * driven through Input -> InteractScript -> ECS event handlers, exactly
       * like a canvas click in the original client. Local-only compatibility
       * items retain their legacy mutation paths until they receive a Bikkie
       * identity, but never replace the native path for mapped items.
       */
      onUse: async (index: number) => {
        const slotIndex = selectVisibleHotbarIndex(index);
        const nativeSlot = hotbarSlots[slotIndex];
        const localItemId = nativeSlot
          ? undefined
          : localHotbarItemIds[slotIndex];

        if (localItemId) {
          const localBackpackItem =
            readHarthmereInventoryState().backpack.items.find(
              (item) => item.itemId === localItemId
            );
          if (
            localBackpackItem &&
            isLocalHarthmereConsumableUseItem(localItemId)
          ) {
            if (isHarthmereFoodItemPlayerEdible(localItemId)) {
              useLocalHarthmereFoodItem(
                localBackpackItem.instanceId,
                localItemId,
                "biomes-ui-live-hotbar-local-food-use"
              );
            } else {
              performHarthmereBackpackItemUseForBiomesUI(
                localBackpackItem.instanceId,
                localItemId
              );
            }
            return;
          }
          if (isHarthmereFoodItemPlayerEdible(localItemId)) {
            const body = await submitFarmingFoodLiveModeAction("eat_food", {
              itemId: localItemId,
            });
            await applyLiveModeInventoryResponse(body);
            dispatchBiomesUITutorialItemUse(
              {
                id: localItemId,
                label: humanizeRealItemId(localItemId, localItemId),
                category: inferInventoryCategory({ id: localItemId }),
                useEffect: "stamina",
              },
              "biomes-ui-live-hotbar-food-use"
            );
            return;
          }
          if (localItemId === "raw_meat") {
            const body = await submitFarmingFoodLiveModeAction("cook_food", {
              recipeId: "grilled_meat",
              rawItemId: "raw_meat",
              stationKind: "campfire",
              count: 1,
            });
            await applyLiveModeInventoryResponse(body);
            return;
          }
          if (HARTHMERE_MEDICAL_ITEM_DEFINITIONS[localItemId]) {
            const body = await submitMedicalLiveModeAction("use_medical_item", {
              itemId: localItemId,
            });
            await applyLiveModeInventoryResponse(body);
            return;
          }
          const display = getHarthmereItemDisplay(localItemId);
          if (display?.category === "weapon") {
            if (!equipHarthmereHotbarItem(localItemId)) {
              throw new Error(
                "Move this weapon into your backpack before equipping it."
              );
            }
            if (display.slot === "main_hand") {
              performHarthmereMousePrimaryAttack();
            }
            return;
          }
          if (isThrowableHotbarItemId(localItemId)) {
            await dropHotbarItem(slotIndex);
            return;
          }
          if (
            display?.category === "tool" ||
            isBlockHotbarItemId(localItemId)
          ) {
            if (!invokeSelectedWorldInteractionForKey()) {
              throw new Error("Aim at a valid target before using this item.");
            }
            return;
          }
          throw new Error("This item has no hotbar action.");
        }

        const item = nativeSlot?.item;
        if (!item) {
          throw new Error("That hotbar slot is empty.");
        }
        await activateNativeHotbarPrimaryAction({
          gameInput: clientContext.input,
          item,
          slotIndex,
        });
      },
      onDrop: dropHotbarItem,
      // HARTHMERE_HOTBAR_REMOVE: × button on the HUD hotbar. Unlike onDrop
      // (which throws the item into the world), remove RETURNS the item —
      // harthmere quick-slots just clear their shortcut assignment, ECS hotbar
      // stacks are swapped into the first empty backpack slot.
      onRemove: (index: number) => {
        const idx = clampHotbarIndex(index, 9);
        const removedLocalItemId = hotbarSlots[idx]
          ? undefined
          : localHotbarItemIds[idx];
        if (removedLocalItemId) {
          rememberHarthmereHotbarAutoAssignOptOut(removedLocalItemId);
          performHarthmereHotbarClearForBiomesUI(idx);
          if (idx === selectedIndex) {
            dispatchHarthmereHotbarHeldItemSelection(undefined);
          }
          return;
        }
        const slot = hotbarSlots[idx];
        const backpackItems = normalizeContainer(inventory?.items);
        const localPlayer = reactResources.get("/scene/local_player");
        const plan = planNativeHotbarRemoval({
          backpackItems,
          hotbarSlotPresent: Boolean(slot?.item),
          playerReady: Boolean(localPlayer?.id),
        });
        if (!plan.ok) {
          reportNativeHotbarRemovalFailure({
            resources: clientContext.resources,
            slotIndex: idx,
            reason: plan.reason,
            backpackItems,
          });
          return;
        }
        try {
          fireAndForget(
            events
              .publish(
                new InventorySwapEvent({
                  player_id: localPlayer!.id,
                  src_id: localPlayer!.id,
                  src: { kind: "hotbar", idx } as OwnedItemReference,
                  dst_id: localPlayer!.id,
                  dst: {
                    kind: "item",
                    idx: plan.destinationIndex,
                  } as OwnedItemReference,
                  positions: localPlayerPositionList(reactResources),
                })
              )
              .catch(() =>
                reportNativeHotbarRemovalFailure({
                  resources: clientContext.resources,
                  slotIndex: idx,
                  reason: "publish_failed",
                  backpackItems,
                })
              )
          );
        } catch {
          reportNativeHotbarRemovalFailure({
            resources: clientContext.resources,
            slotIndex: idx,
            reason: "publish_failed",
            backpackItems,
          });
        }
      },
    };
  }, [
    applyLiveModeInventoryResponse,
    clientContext,
    events,
    gardenHose,
    inventory?.hotbar,
    inventory?.items,
    inventoryLootState?.actor?.items,
    inventoryLootState?.materialStorage,
    harthmereInventoryRevision,
    reactResources,
    refreshInventoryLootState,
    selectHotbarIndex,
    selectedIndex,
    useLocalHarthmereFoodItem,
  ]);

  React.useEffect(() => {
    const hotbarSlots = normalizeContainer(inventory?.hotbar).slice(0, 9);
    if (hotbarSlots[selectedIndex] || !hotbar.slots[selectedIndex]) {
      dispatchHarthmereHotbarHeldItemSelection(undefined);
      return;
    }
    const itemId =
      readHarthmereInventoryState().hotbar[`slot_${selectedIndex + 1}`];
    const display = itemId ? getHarthmereItemDisplay(itemId) : undefined;
    dispatchHarthmereHotbarHeldItemSelection(
      display && ["weapon", "tool"].includes(display.category)
        ? itemId
        : undefined
    );
  }, [
    harthmereInventoryRevision,
    hotbar.slots,
    inventory?.hotbar,
    selectedIndex,
  ]);

  const adapters = React.useMemo<BiomesUIAdapters>(() => {
    const nativeProgression =
      readHarthmereNativeCombatProgression(nativeTriggerState);
    const nativeCharacterStats = harthmereNativeLevelStats(
      nativeProgression.level
    );
    const hotbarItems = normalizeContainer(inventory?.hotbar);
    const backpackItems = normalizeContainer(inventory?.items);
    const currencyItems = normalizeContainer(inventory?.currencies);
    const equipmentItems = normalizeAssignment(wearing?.items);
    // BIOMES_UI_MAP_ADAPTER:
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
    const getNativeFarmingModel = () =>
      buildNativeFarmingInterfaceModel({
        userId,
        inventory,
        entities: clientContext.table.contents(),
        playerPosition: playerWorldPos,
      });

    const publishSwap = (
      src: InventoryUiRef,
      dst: InventoryUiRef,
      onPublished?: () => void,
      onRejected?: (error: unknown) => void
    ) => {
      try {
        fireAndForget(
          events
            .publish(
              new InventorySwapEvent({
                player_id: userId,
                src_id: userId,
                src: normalizeUiRef(src),
                dst_id: userId,
                dst: normalizeUiRef(dst),
                positions: localPlayerPositionList(reactResources),
              })
            )
            .then(() => onPublished?.())
            .catch((error) => onRejected?.(error))
        );
      } catch (error) {
        onRejected?.(error);
      }
    };

    const backendActor = inventoryLootState?.actor;
    // Native ECS slots keep their real references at the front of the UI ref
    // space. Redis-backed Harthmere records are an appendix, never a replacement
    // for the snapshot inventory. This is important because InventorySwapEvent,
    // wearable triggers, block placement, and quest collection all resolve the
    // original ECS reference, exactly as they did in data-snapshot-2026-05-16.
    const liveBackpackIndexOffset = backpackItems.length + hotbarItems.length;
    const liveBackpackStackItems = stackRecordToInventoryUiItems(
      backendActor?.items,
      "backpack",
      "item",
      {
        canMove: true,
        canDrop: true,
        canDestroy: true,
        protectedReason: undefined,
        indexOffset: liveBackpackIndexOffset,
      }
    )
      .map((item) =>
        item.category === "quest"
          ? {
              ...item,
              canDrop: false,
              canDestroy: false,
              protectedReason: "Quest items stay with your quest pouch.",
            }
          : item
      )
      .filter((item) => !isRetiredRoadAheadClothingAlias(item.id));
    const liveBackpackInstanceItems = instanceRecordToInventoryUiItems(
      backendActor?.instanceIds,
      inventoryLootState?.itemInstances,
      liveBackpackIndexOffset + liveBackpackStackItems.length
    );
    const liveInventoryAuthoritative = harthmereLiveServerAuthoritative();
    void harthmereInventoryRevision;
    const localHarthmereInventoryState = readHarthmereInventoryState();
    const consumedLocalBackpackInstanceIds = new Set<string>();
    const ecsBackpackUiItems = backpackItems.flatMap(
      (slot: any, index: number) => {
        const item = slotToInventoryUiItem(
          slot,
          `bag_${index + 1}`,
          { kind: "item", idx: index },
          "backpack"
        );
        return item ? [item] : [];
      }
    );
    const baseBackpackUiItems = mergeMirroredBiomesBackpackUiItemsForTest(
      nativeBackpackGridItemsForBiomesUiForTest(
        ecsBackpackUiItems,
        hotbarItems
      ),
      [...liveBackpackStackItems, ...liveBackpackInstanceItems].filter(
        (item) =>
          !nativeBiomesEcsAuthorityEnabled() || !isNativeBikkieItemId(item.id)
      )
    );
    // HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE (2026-07-02): unify the dual-source
    // inventory the same way HP/stamina were unified. The client-local sim (a
    // localStorage "biomes.localDev.harthmere.inventoryState") holds a DIFFERENT
    // inventory, in a DIFFERENT id namespace (string ids like `road_ration`), than
    // the live server authority (numeric/`b:` bikkie ids from
    // `live_mode_inventory_loot_state`). Previously the display APPENDED the local
    // sim's unmatched items on top of the server items, so the hotbar/backpack
    // showed a confusing blend of two inventories whose counts never reconciled,
    // and mining/placing updated one while the UI showed the other. When a live
    // server snapshot is present the server is authoritative, so we DROP the
    // local-only appendix (verified live: server owns the real items; the local
    // set was a leftover tutorial/local-dev inventory). Offline / local-dev mode
    // (no live snapshot) still shows the local sim exactly as before.
    // Sticky: a transient poll gap must not resurrect the local-dev appendix
    // (items flickering back into the backpack after the server consumed them).
    const localDevBackpackItems = liveInventoryAuthoritative
      ? []
      : localHarthmereInventoryState.backpack.items
          .filter(
            (item) => !consumedLocalBackpackInstanceIds.has(item.instanceId)
          )
          .map((item, index) =>
            localHarthmereBackpackItemToUiItem(
              item,
              baseBackpackUiItems.length + index
            )
          );
    const allBackpackUiItems = [
      ...baseBackpackUiItems,
      ...localDevBackpackItems,
    ];
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
    // Same server-authoritative gate as the backpack: when live, material storage
    // is the server's alone; offline we still merge the local sim's materials.
    const combinedMaterialStorageItems =
      (liveInventoryAuthoritative
        ? (materialStorageItems as Record<string, number> | undefined)
        : mergeInventoryStackRecords(
            materialStorageItems as Record<string, number> | undefined,
            localHarthmereInventoryState.materialStorage
          )) ?? {};

    const liveItemForRef = (ref: InventoryUiRef): InventoryUiItem | null => {
      if (ref.kind !== "item" || isLocalHarthmereItemRef(ref)) return null;
      const index = Number(ref.idx ?? -1);
      if (!Number.isInteger(index) || index < liveBackpackIndexOffset) {
        return null;
      }
      return (
        liveBackpackStackItems.find((item) => item.ref?.idx === index) ??
        liveBackpackInstanceItems.find(
          (item) => item.ref?.kind === "item" && item.ref.idx === index
        ) ??
        null
      );
    };
    const liveItemIdForRef = (ref: InventoryUiRef): string | undefined => {
      if (ref.kind !== "item" || isLocalHarthmereItemRef(ref)) {
        return undefined;
      }
      const index = Number(ref.idx ?? -1);
      if (!Number.isInteger(index) || index < liveBackpackIndexOffset) {
        return undefined;
      }
      const liveIndex = index - liveBackpackIndexOffset;
      const stackItem = liveBackpackStackItems[liveIndex];
      if (stackItem?.id) return stackItem.id;
      const instanceIndex = liveIndex - liveBackpackStackItems.length;
      const instanceId = Array.isArray(backendActor?.instanceIds)
        ? backendActor.instanceIds[instanceIndex]
        : undefined;
      const instance = instanceId
        ? inventoryLootState?.itemInstances?.[instanceId]
        : undefined;
      return instance?.itemId ? String(instance.itemId) : undefined;
    };
    const liveInstanceIdForRef = (ref: InventoryUiRef): string | undefined => {
      if (ref.kind !== "item" || isLocalHarthmereItemRef(ref)) {
        return undefined;
      }
      const index = Number(ref.idx ?? -1);
      if (
        !Number.isInteger(index) ||
        index < liveBackpackIndexOffset + liveBackpackStackItems.length
      ) {
        return undefined;
      }
      const instanceIndex =
        index - liveBackpackIndexOffset - liveBackpackStackItems.length;
      const instanceId = Array.isArray(backendActor?.instanceIds)
        ? backendActor.instanceIds[instanceIndex]
        : undefined;
      return instanceId ? String(instanceId) : undefined;
    };
    const isNativeInventoryRef = (ref: InventoryUiRef): boolean => {
      if (ref.kind === "hotbar") {
        return !(
          typeof ref.key === "string" && ref.key.startsWith("harthmere_hotbar:")
        );
      }
      if (ref.kind !== "item" || isLocalHarthmereItemRef(ref)) return false;
      const index = Number(ref.idx ?? -1);
      return (
        Number.isInteger(index) && index >= 0 && index < backpackItems.length
      );
    };
    const localHarthmereItemForRef = (
      ref: InventoryUiRef
    ): HarthmereItemInstance | undefined => {
      const instanceId = localHarthmereInstanceIdFromRef(ref);
      if (!instanceId) return undefined;
      return localHarthmereInventoryState.backpack.items.find(
        (item) => item.instanceId === instanceId
      );
    };
    const materialItemIdForRef = (ref: InventoryUiRef): string | undefined => {
      if (ref.kind !== "material") return undefined;
      const itemId = String(ref.key ?? "");
      return itemId && (combinedMaterialStorageItems[itemId] ?? 0) > 0
        ? itemId
        : undefined;
    };
    const localHarthmereEquipmentSlotForRef = (
      ref: InventoryUiRef
    ): string | undefined => localHarthmereEquipmentSlotFromRef(ref);
    const equipmentItemForWearableRef = (
      ref: InventoryUiRef
    ): InventoryUiItem | null => {
      if (ref.kind !== "wearable") return null;
      const localSlot = localHarthmereEquipmentSlotForRef(ref);
      if (localSlot) {
        const item = (localHarthmereInventoryState.equipment as any)?.[
          localSlot
        ];
        return item
          ? {
              ...localHarthmereEquipmentItemToUiItem(item, localSlot),
              canUnequip: true,
            }
          : null;
      }
      const slot = String(ref.key ?? "");
      if (!slot) return null;
      const ecsEntry = equipmentItems.find(([key]) => key === slot);
      if (ecsEntry) {
        return slotToInventoryUiItem(
          { item: ecsEntry[1], count: 1 },
          `wearable_${slot}`,
          { kind: "wearable", key: slot },
          "equipment"
        );
      }
      const backendItemId = (backendActor?.equipment as any)?.[slot];
      if (backendItemId) {
        const item = stackRecordToInventoryUiItems(
          { [String(backendItemId)]: 1 },
          "equipment",
          "wearable",
          {
            description: "Equipped from your Harthmere inventory.",
            canEquip: false,
            canMove: false,
            canSplit: false,
            canDrop: false,
            canDestroy: false,
          }
        )[0];
        return item
          ? {
              ...item,
              ref: { kind: "wearable", key: slot },
              canUnequip: true,
            }
          : null;
      }
      return null;
    };

    const inventoryAdapter = {
      getBackpack: () => {
        const materialStorageUiItems = stackRecordToInventoryUiItems(
          combinedMaterialStorageItems,
          "material_storage",
          "material",
          {
            description: "Stored in material storage.",
            canMove: true,
            canDrop: true,
            canDestroy: true,
            protectedReason: undefined,
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
              icon: biomesInventoryItemIcon(itemId),
              count: Number(entry?.count ?? 1),
              quality: "common",
              category: inferInventoryCategory({ id: itemId }),
              weight: inventoryUiItemWeight(
                itemId,
                Number(entry?.count ?? 1),
                inferInventoryCategory({ id: itemId })
              ),
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
        const itemWeightForUiItem = (item: InventoryUiItem | null) =>
          item ? (item.weight?.total ?? 0) : 0;
        const currentWeight =
          uiItems.reduce(
            (sum: number, item: InventoryUiItem | null) =>
              sum + itemWeightForUiItem(item),
            0
          ) +
          materialStorageUiItems.reduce(
            (sum: number, item: InventoryUiItem | null) =>
              sum + itemWeightForUiItem(item),
            0
          );
        const maxWeight = nativeCharacterStats.carryCapacity;
        const baseMaxSlots = nativeBackpackMaxSlotsForBiomesUiForTest(
          backpackItems.length
        );
        return {
          items: uiItems,
          maxSlots: baseMaxSlots,
          usedSlots: uiItems.filter(Boolean).length,
          capacityLabel: inventoryLootHydrated ? "Backpack" : "World backpack",
          weight: {
            current: currentWeight,
            max: maxWeight,
            overLimit: currentWeight > maxWeight,
          },
          materialStorage: {
            items: materialStorageUiItems,
            maxSlots: Number(materialStorageSnapshot?.maxSlots ?? 32),
            usedSlots: Math.max(
              Number(materialStorageSnapshot?.usedSlots ?? 0),
              materialStorageUiItems.length
            ),
            capacityLabel: "Material Storage",
          },
          overflow: overflowUiItems,
        };
      },
      getHotbar: () => ({
        // HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE: same gate as the backpack —
        // but aligned with the HUD hotbar. The HUD renders local quick-slot
        // assignments (auto-assigned voxel blocks etc.), so the inventory
        // mirror must show the SAME slots or removals/counts look inconsistent
        // between the two views. In live mode a local assignment is only shown
        // when the live server inventory actually carries the item (guards
        // against phantom local-dev-only items like `road_ration`), and its
        // count is the REAL carried count, not a hard-coded 1.
        items: Array.from({ length: 9 }, (_unused, index) => {
          const nativeItem = slotToInventoryUiItem(
            hotbarItems[index],
            `hotbar_${index + 1}`,
            { kind: "hotbar", idx: index },
            "hotbar"
          );
          if (nativeItem) return nativeItem;
          const localItemId =
            localHarthmereInventoryState.hotbar[`slot_${index + 1}`];
          if (localItemId) {
            const itemId = String(localItemId);
            if (
              nativeBiomesEcsAuthorityEnabled() &&
              isNativeBikkieItemId(itemId)
            ) {
              return null;
            }
            const liveCount =
              Math.max(
                0,
                Math.trunc(Number(backendActor?.items?.[itemId] ?? 0))
              ) +
              Math.max(
                0,
                Math.trunc(Number(combinedMaterialStorageItems[itemId] ?? 0))
              );
            const localCount = localHarthmereInventoryState.backpack.items
              .filter((item: any) => item.itemId === itemId)
              .reduce(
                (sum: number, item: any) =>
                  sum + Math.max(1, Number(item.quantity) || 1),
                0
              );
            const showLocalAssignment = liveInventoryAuthoritative
              ? liveCount > 0
              : true;
            if (showLocalAssignment) {
              const displayedCount = liveInventoryAuthoritative
                ? liveCount
                : localCount;
              if (displayedCount <= 0) return null;
              const localItem = localHarthmereHotbarItemToUiItem(
                itemId,
                index,
                displayedCount
              );
              if (localItem) return localItem;
            }
          }
          return null;
        }),
        selectedIndex,
      }),
      getEquipment: () => {
        const localEquipment = liveInventoryAuthoritative
          ? []
          : normalizeAssignment(localHarthmereInventoryState.equipment).flatMap(
              ([key, item]: [string, any]) =>
                item
                  ? [
                      {
                        id: key,
                        label: key.replace(/_/g, " "),
                        ref: {
                          kind: "wearable" as const,
                          key: `${HARTHMERE_BIOMES_UI_LOCAL_EQUIPMENT_REF_PREFIX}${key}`,
                        },
                        item: {
                          ...localHarthmereEquipmentItemToUiItem(item, key),
                          canUnequip: true,
                        },
                      },
                    ]
                  : []
            );
        const ecsEquipment = equipmentItems.map(
          ([key, item]: [string, any]) => ({
            id: nativeWearableSlotUiIdForTest(key),
            label: nativeWearableSlotLabelForTest(key),
            ref: { kind: "wearable", key },
            item: slotToInventoryUiItem(
              { item, count: 1 },
              `wearable_${key}`,
              { kind: "wearable", key },
              "equipment"
            ),
          })
        );
        const backendEquipment = normalizeAssignment(backendActor?.equipment)
          .filter(
            ([, itemId]: [string, any]) =>
              !isRetiredRoadAheadClothingAlias(String(itemId))
          )
          .map(([key, itemId]: [string, any]) => ({
            id: key,
            label: key.replace(/_/g, " "),
            ref: { kind: "wearable" as const, key },
            item: (() => {
              const item = stackRecordToInventoryUiItems(
                { [String(itemId)]: 1 },
                "equipment",
                "wearable",
                {
                  description: "Equipped from your Harthmere inventory.",
                  canEquip: false,
                  canMove: false,
                  canSplit: false,
                  canDrop: false,
                  canDestroy: false,
                }
              )[0];
              return item
                ? {
                    ...item,
                    ref: { kind: "wearable" as const, key },
                    canUnequip: true,
                  }
                : item;
            })(),
          }));
        // Wearing is native ECS state in the May 16 snapshot. Keep every native
        // slot visible (notably both top and bottoms), and append only custom
        // Harthmere slots that do not collide with it.
        const authoritativeEquipment = ecsEquipment;
        const seen = new Set(authoritativeEquipment.map((entry) => entry.id));
        const supplementalEquipment = (
          liveInventoryAuthoritative ? backendEquipment : localEquipment
        ).filter((entry) => {
          if (seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        });
        return [
          ...authoritativeEquipment,
          ...supplementalEquipment,
          ...(!liveInventoryAuthoritative
            ? backendEquipment.filter((entry) => {
                if (seen.has(entry.id)) return false;
                seen.add(entry.id);
                return true;
              })
            : []),
        ];
      },
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
        if (ref.kind === "wearable") {
          return equipmentItemForWearableRef(ref);
        }
        return null;
      },
      selectItem: (ref: InventoryUiRef) => {
        if (localHarthmereItemForRef(ref) || materialItemIdForRef(ref)) {
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
        if (materialItemIdForRef(ref)) {
          return;
        }
        // Native-ECS inventory refs must be consumed through ConsumptionEvent.
        // Selecting the slot only changes the held item and never debits the
        // stack, applies recovery, or publishes the native consumption trigger.
        // Resolve this before the legacy Redis/local appendices so a mirrored
        // Harthmere item cannot accidentally mutate a second authority.
        if (nativeBiomesEcsAuthorityEnabled()) {
          const consumption = nativeConsumptionForBiomesUIForTest(
            inventory,
            ref
          );
          if (consumption) {
            fireAndForget(
              events.publish(
                new ConsumptionEvent({
                  id: userId,
                  item_id: consumption.itemId,
                  inventory_ref: consumption.ref,
                  action: consumption.action,
                })
              )
            );
            return;
          }
        }
        const localHarthmereItem = localHarthmereItemForRef(ref);
        if (localHarthmereItem) {
          const itemId = localHarthmereItem.itemId;
          if (isHarthmereFoodItemPlayerEdible(itemId)) {
            useLocalHarthmereFoodItem(
              localHarthmereItem.instanceId,
              itemId,
              "biomes-ui-live-inventory-local-food-use"
            );
          } else if (isLocalHarthmereConsumableUseItem(itemId)) {
            performHarthmereBackpackItemUseForBiomesUI(
              localHarthmereItem.instanceId,
              itemId
            );
          }
          return;
        }
        const liveItem = liveItemForRef(ref);
        // Resolve the food id even when the slot is a single world-saved instance
        // (which liveItemForRef may not surface as a stack), so the Eat action
        // works for every edible item the player can see, not just stacks.
        const liveFoodId = liveItemIdForRef(ref) ?? liveItem?.id;
        if (liveFoodId && isHarthmereFoodItemPlayerEdible(liveFoodId)) {
          eatLiveHarthmereFoodById(
            liveFoodId,
            liveItem?.label ?? humanizeRealItemId(liveFoodId, liveFoodId),
            liveItem?.category ?? inferInventoryCategory({ id: liveFoodId }),
            "biomes-ui-live-food-use"
          );
          return;
        }
        if (liveFoodId === "raw_meat") {
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
        if (liveFoodId && HARTHMERE_MEDICAL_ITEM_DEFINITIONS[liveFoodId]) {
          fireAndForget(
            submitMedicalLiveModeAction("use_medical_item", {
              itemId: liveFoodId,
            })
              .then(async (body) => {
                await applyLiveModeInventoryResponse(body);
                dispatchBiomesUITutorialItemUse(
                  {
                    itemId: liveFoodId,
                    itemName:
                      liveItem?.label ??
                      humanizeRealItemId(liveFoodId, liveFoodId),
                    category:
                      liveItem?.category ??
                      inferInventoryCategory({ id: liveFoodId }),
                    useEffect: "heal",
                  },
                  "biomes-ui-live-medical-use"
                );
              })
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        if (liveFoodId && isLiveUsableBackpackItem(liveFoodId)) {
          const countBefore = Math.max(
            0,
            Math.trunc(Number(backendActor?.items?.[liveFoodId] ?? 0))
          );
          fireAndForget(
            submitInventoryItemLiveModeAction("use_item", {
              itemId: liveFoodId,
              count: 1,
            })
              .then(async (body) => {
                const countAfter = Math.max(
                  0,
                  Math.trunc(
                    Number(
                      body?.inventoryLootState?.actor?.items?.[liveFoodId] ?? 0
                    )
                  )
                );
                if (countBefore <= 0 || countAfter >= countBefore) {
                  throw new Error(`item_use_state_mismatch:${liveFoodId}`);
                }
                await applyLiveModeInventoryResponse(body);
                dispatchBiomesUITutorialItemUse(
                  {
                    itemId: liveFoodId,
                    itemName:
                      liveItem?.label ??
                      humanizeRealItemId(liveFoodId, liveFoodId),
                    category:
                      liveItem?.category ??
                      inferInventoryCategory({ id: liveFoodId }),
                    useEffect:
                      getHarthmereItemDisplay(liveFoodId)?.useEffectType,
                  },
                  "biomes-ui-live-authoritative-item-use"
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
      performFarmingFoodAction: (action: FarmingFoodInterfaceAction) => {
        if (action.disabled) return;
        // Cooking is now timer-based and station-bound: redirect the legacy
        // quick-cook buttons to the new cooking station panel (keyed by the
        // recipe's station kind) instead of cooking instantly.
        if (action.operation === "cook_food") {
          const stationKind = ((action.payload?.stationKind as string) ??
            "campfire") as "campfire" | "cookpot" | "oven";
          const label =
            stationKind.charAt(0).toUpperCase() + stationKind.slice(1);
          openHarthmereCookingStation({
            stationId: harthmereCookingStationId(undefined, stationKind),
            stationKind,
            label,
          });
          return;
        }
        fireAndForget(
          submitFarmingFoodLiveModeAction(action.operation, action.payload)
            .then(applyLiveModeInventoryResponse)
            .catch(() => refreshFarmingFoodState())
        );
      },
      equipItem: (ref: InventoryUiRef, equipSlot?: string) => {
        const localHarthmereItem = localHarthmereItemForRef(ref);
        if (localHarthmereItem) {
          const key =
            equipSlot ||
            inferEquipSlot({
              id: localHarthmereItem.itemId,
              name: localHarthmereItem.itemId,
            }) ||
            "main_hand";
          const applyLocalEquipmentProjection = () => {
            performHarthmereBackpackItemEquipForBiomesUI(
              localHarthmereItem.instanceId,
              localHarthmereItem.itemId
            );
            try {
              gardenHose.publish({
                kind: "equip",
                source: "biomes-ui-local-dev-item-equip",
                itemId: localHarthmereItem.itemId,
                slot: key,
                operation: "equip",
                authority: "local_offline",
              } as any);
            } catch {}
          };
          if (liveInventoryAuthoritative) {
            // Local-only inventory is never mirrored into live authority.
            refreshInventoryLootState();
          } else {
            applyLocalEquipmentProjection();
          }
          return;
        }
        const liveItemId = liveItemIdForRef(ref);
        if (liveItemId) {
          const liveInstanceId = liveInstanceIdForRef(ref);
          const key =
            equipSlot ||
            inferEquipSlot({ id: liveItemId, name: liveItemId }) ||
            "main_hand";
          fireAndForget(
            submitEquipmentLiveModeAction(liveItemId, key, liveInstanceId)
              .then(async (body) => {
                await applyLiveModeInventoryResponse(body);
                try {
                  gardenHose.publish({
                    kind: "equip",
                    source: "biomes-ui-live-authoritative-item-equip",
                    itemId: liveItemId,
                    instanceId: liveInstanceId,
                    slot: key,
                    operation: "equip",
                    authority: "server",
                  } as any);
                } catch {}
              })
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        const requestedSlot = equipSlot || "main_hand";
        const parsedNativeSlot = safeParseBiomesId(requestedSlot);
        const mappedNativeSlot =
          harthmereEquipmentSlotToBikkieWearableSlot(requestedSlot);
        const key = String(
          parsedNativeSlot ?? mappedNativeSlot ?? requestedSlot
        );
        publishSwap(ref, { kind: "wearable", key });
      },
      unequipItem: (ref: InventoryUiRef) => {
        const localSlot = localHarthmereEquipmentSlotForRef(ref);
        if (localSlot) {
          if (liveInventoryAuthoritative) {
            const itemId = String(
              (backendActor?.equipment as any)?.[localSlot] ?? ""
            );
            fireAndForget(
              submitEquipmentLiveModeAction(undefined, localSlot)
                .then(async (body) => {
                  await applyLiveModeInventoryResponse(body);
                  if (itemId) {
                    gardenHose.publish({
                      kind: "equip",
                      itemId,
                      slot: localSlot,
                      operation: "unequip",
                      authority: "server",
                    });
                  }
                })
                .catch(() => refreshInventoryLootState())
            );
          } else {
            const item = (localHarthmereInventoryState.equipment as any)?.[
              localSlot
            ];
            performHarthmereEquipmentItemUnequipForBiomesUI(localSlot);
            if (item?.itemId) {
              gardenHose.publish({
                kind: "equip",
                itemId: item.itemId,
                slot: localSlot,
                operation: "unequip",
                authority: "local_offline",
              });
            }
          }
          return;
        }
        if (ref.kind === "wearable" && ref.key !== undefined) {
          const slot = String(ref.key);
          const itemId = String((backendActor?.equipment as any)?.[slot] ?? "");
          if (slot && itemId) {
            fireAndForget(
              submitEquipmentLiveModeAction(undefined, slot)
                .then(async (body) => {
                  await applyLiveModeInventoryResponse(body);
                  gardenHose.publish({
                    kind: "equip",
                    itemId,
                    slot,
                    operation: "unequip",
                    authority: "server",
                  });
                })
                .catch(() => refreshInventoryLootState())
            );
            return;
          }
        }
        const emptyIndex = backpackItems.findIndex((slot: any) => !slot);
        // Keep the wearable in place when every backpack cell is occupied.
        // Swapping with slot zero would attempt to wear that unrelated item and
        // made both pieces appear to disappear or refuse to unequip.
        if (emptyIndex < 0) return;
        publishSwap(ref, {
          kind: "item",
          idx: emptyIndex,
        });
      },
      // HARTHMERE_HOTBAR_REMOVE (2026-07-05): universal "take it off the
      // hotbar" for BOTH hotbar flavors. Harthmere quick-slots are shortcut
      // assignments (itemId → slot), so removing one just clears the mapping;
      // ECS hotbar slots hold the actual stack, so removing one moves the
      // stack into the first empty backpack slot. Wired to the per-slot ×
      // button and to drag-and-drop from the hotbar onto the backpack grid.
      removeFromHotbar: (ref: InventoryUiRef) => {
        if (ref.kind !== "hotbar") return;
        const idx = Number(ref.idx ?? -1);
        if (
          typeof ref.key === "string" &&
          ref.key.startsWith("harthmere_hotbar:")
        ) {
          rememberHarthmereHotbarAutoAssignOptOut(
            harthmereHotbarItemIdFromRefKey(ref.key)
          );
          performHarthmereHotbarClearForBiomesUI(idx);
          return;
        }
        const plan = planNativeHotbarRemoval({
          backpackItems,
          hotbarSlotPresent: Boolean(hotbarItems[idx]?.item),
          playerReady: Boolean(userId),
        });
        if (!plan.ok) {
          reportNativeHotbarRemovalFailure({
            resources: clientContext.resources,
            slotIndex: idx,
            reason: plan.reason,
            backpackItems,
          });
          return;
        }
        publishSwap(
          ref,
          {
            kind: "item",
            idx: plan.destinationIndex,
          },
          undefined,
          () =>
            reportNativeHotbarRemovalFailure({
              resources: clientContext.resources,
              slotIndex: idx,
              reason: "publish_failed",
              backpackItems,
            })
        );
      },
      moveItem: (src: InventoryUiRef, dst: InventoryUiRef) => {
        let nativeHotbarEquipEvent:
          { itemId: string; itemName: string } | undefined;
        // Dragging a harthmere quick-slot OFF the hotbar (onto the backpack)
        // clears the shortcut assignment — publishSwap below only understands
        // real ECS slots and would silently no-op for these refs.
        if (
          src.kind === "hotbar" &&
          dst.kind !== "hotbar" &&
          typeof src.key === "string" &&
          src.key.startsWith("harthmere_hotbar:")
        ) {
          rememberHarthmereHotbarAutoAssignOptOut(
            harthmereHotbarItemIdFromRefKey(src.key)
          );
          performHarthmereHotbarClearForBiomesUI(Number(src.idx ?? -1));
          return;
        }
        if (dst.kind === "hotbar") {
          const hotbarIndex = Number(dst.idx ?? -1);
          if (src.kind === "hotbar" && typeof src.key === "string") {
            if (
              performHarthmereHotbarSlotMoveForBiomesUI(
                Number(src.idx ?? -1),
                hotbarIndex
              )
            ) {
              return;
            }
          }
          const localHarthmereItem = localHarthmereItemForRef(src);
          if (
            localHarthmereItem &&
            isHotbarEligibleItemId(localHarthmereItem.itemId) &&
            performHarthmereHotbarAssignForBiomesUI(
              localHarthmereItem.itemId,
              hotbarIndex
            )
          ) {
            return;
          }
          const materialItemId = materialItemIdForRef(src);
          if (materialItemId && isHotbarEligibleItemId(materialItemId)) {
            performHarthmereHotbarAssignForBiomesUI(
              materialItemId,
              hotbarIndex,
              true
            );
            return;
          }
          const liveItemId = liveItemIdForRef(src);
          if (
            liveItemId &&
            isHotbarEligibleItemId(liveItemId) &&
            performHarthmereHotbarAssignForBiomesUI(
              liveItemId,
              hotbarIndex,
              true
            )
          ) {
            return;
          }
          if (isNativeInventoryRef(src)) {
            const nativeSlot =
              src.kind === "item"
                ? backpackItems[Number(src.idx ?? -1)]
                : src.kind === "hotbar"
                  ? hotbarItems[Number(src.idx ?? -1)]
                  : undefined;
            const nativeItemId = nativeSlot?.item?.id;
            // Native hotbar cells hold the actual stack, so enforce the same
            // block/tool/consumable eligibility as the replacement UI before
            // publishing a swap. Wearables and arbitrary quest items remain in
            // backpack even if a forged drag payload targets hotbar.
            if (
              nativeItemId === undefined ||
              !isHotbarEligibleItemId(String(nativeItemId))
            ) {
              return;
            }
            const nativeUiItem = slotToInventoryUiItem(
              nativeSlot,
              "native_hotbar_quest_equip",
              src,
              src.kind === "hotbar" ? "hotbar" : "backpack"
            );
            nativeHotbarEquipEvent = {
              itemId: String(nativeItemId),
              itemName: nativeUiItem?.label ?? String(nativeItemId),
            };
          }
          // A native ECS source must always publish the native swap, even when
          // the optional Redis inventory is hydrated. Blocking this mutation was
          // the reason clothing appeared clickable but never became worn and the
          // native wearable quest trigger never advanced.
          if (liveInventoryAuthoritative && !isNativeInventoryRef(src)) return;
        }
        publishSwap(
          src,
          dst,
          nativeHotbarEquipEvent
            ? () => {
                // A native tool/camera becomes the player's equipped hand item
                // by entering the hotbar, not by entering a wearable slot.
                // Publish the shared equip signal only after ECS accepts the
                // swap so Grove lessons and every other inventory consumer see
                // the same authoritative action the HUD now displays.
                window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
                gardenHose.publish({
                  kind: "equip",
                  source: "biomes-ui-native-hotbar-equip",
                  itemId: nativeHotbarEquipEvent.itemId,
                  itemName: nativeHotbarEquipEvent.itemName,
                  slot: "main_hand",
                  operation: "equip",
                  authority: "native_ecs",
                } as any);
              }
            : undefined
        );
      },
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
        if (
          ref.kind === "hotbar" &&
          typeof ref.key === "string" &&
          ref.key.startsWith("harthmere_hotbar:")
        ) {
          // HARTHMERE_WORLD_THROW_DROP (audit fix, 2026-07-13): dropping a
          // Harthmere quick-slot used to ONLY clear the shortcut — the player
          // dragged an item out to throw it and nothing landed in the world.
          // Now: submit one positioned authoritative drop so the server spawns
          // a claimable world item, then reconcile the shortcut from its result.
          const thrownSlotIndex = clampHotbarIndex(Number(ref.idx ?? -1), 9);
          const thrownLocalItemId =
            readHarthmereInventoryState().hotbar[`slot_${thrownSlotIndex + 1}`];
          if (thrownLocalItemId) {
            const thrownLabel = humanizeRealItemId(
              thrownLocalItemId,
              thrownLocalItemId
            );
            const liveBackpackCount = Math.max(
              0,
              Math.trunc(
                Number(
                  inventoryLootState?.actor?.items?.[thrownLocalItemId] ?? 0
                )
              )
            );
            const liveMaterialCount = Math.max(
              0,
              Math.trunc(
                Number(combinedMaterialStorageItems[thrownLocalItemId] ?? 0)
              )
            );
            const liveCount = liveBackpackCount + liveMaterialCount;
            if (liveCount > 0) {
              fireAndForget(
                submitInventoryItemLiveModeAction("drop_item", {
                  itemId: thrownLocalItemId,
                  count: 1,
                  sourceSlot:
                    liveBackpackCount > 0 ? undefined : "material_storage",
                  position: harthmereThrowDropPosition(clientContext),
                })
                  .then(async (body) => {
                    await applyLiveModeInventoryResponse(body);
                    const remaining =
                      Math.max(
                        0,
                        Number(
                          body?.inventoryLootState?.actor?.items?.[
                            thrownLocalItemId
                          ] ?? 0
                        )
                      ) +
                      Math.max(
                        0,
                        Number(
                          body?.inventoryLootState?.materialStorage?.items?.[
                            thrownLocalItemId
                          ] ?? 0
                        )
                      );
                    if (remaining <= 0) {
                      performHarthmereHotbarClearForBiomesUI(thrownSlotIndex);
                    }
                  })
                  .catch(() => refreshInventoryLootState())
              );
            } else if (!liveInventoryAuthoritative) {
              const consumed = consumeHarthmereItemByItemId(
                thrownLocalItemId,
                1,
                `Threw ${thrownLabel}`
              );
              if (consumed > 0) {
                performHarthmereHotbarClearForBiomesUI(thrownSlotIndex);
              }
            }
          }
          return;
        }
        const liveItemId = liveItemIdForRef(ref);
        if (liveItemId && !liveInstanceIdForRef(ref)) {
          const requested = liveInventoryMutationCountForTest(
            liveItemForRef(ref)?.count,
            count
          );
          fireAndForget(
            submitInventoryItemLiveModeAction("drop_item", {
              itemId: liveItemId,
              count: requested,
              position: harthmereThrowDropPosition(clientContext),
            })
              .then(applyLiveModeInventoryResponse)
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        const materialItemId = materialItemIdForRef(ref);
        if (materialItemId) {
          const requested = Math.max(1, Math.trunc(Number(count ?? 1) || 1));
          const removedLocal = liveInventoryAuthoritative
            ? 0
            : performHarthmereMaterialStorageRemoveForBiomesUI(
                materialItemId,
                requested
              );
          const remaining = Math.max(0, requested - removedLocal);
          if (remaining > 0) {
            fireAndForget(
              submitInventoryItemLiveModeAction("drop_item", {
                itemId: materialItemId,
                count: remaining,
                sourceSlot: "material_storage",
                // HARTHMERE_WORLD_THROW_DROP: land the drop at the player so
                // it is visible and salvageable instead of vanishing.
                position: harthmereThrowDropPosition(clientContext),
              })
                .then(applyLiveModeInventoryResponse)
                .catch(() => refreshInventoryLootState())
            );
          }
          return;
        }
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
        const liveItemId = liveItemIdForRef(ref);
        if (liveItemId && !liveInstanceIdForRef(ref)) {
          const requested = liveInventoryMutationCountForTest(
            liveItemForRef(ref)?.count,
            count
          );
          fireAndForget(
            submitInventoryItemLiveModeAction("destroy_item", {
              itemId: liveItemId,
              count: requested,
            })
              .then(applyLiveModeInventoryResponse)
              .catch(() => refreshInventoryLootState())
          );
          return;
        }
        const materialItemId = materialItemIdForRef(ref);
        if (materialItemId) {
          const requested = Math.max(1, Math.trunc(Number(count ?? 1) || 1));
          const removedLocal = liveInventoryAuthoritative
            ? 0
            : performHarthmereMaterialStorageRemoveForBiomesUI(
                materialItemId,
                requested
              );
          const remaining = Math.max(0, requested - removedLocal);
          if (remaining > 0) {
            fireAndForget(
              submitInventoryItemLiveModeAction("destroy_item", {
                itemId: materialItemId,
                count: remaining,
                sourceSlot: "material_storage",
              })
                .then(applyLiveModeInventoryResponse)
                .catch(() => refreshInventoryLootState())
            );
          }
          return;
        }
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
      sortInventory: async () => {
        try {
          await events.publish(new InventorySortEvent({ id: userId }));
          // Sorting is an inventory mutation even when item counts do not
          // change. Notify every inventory consumer after native authority
          // accepts it so Grove lessons and other systems observe the same
          // completed action as the production Inventory tab.
          window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
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
        icon: item.icon,
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

    const guildAdapter = createBiomesUIGuildsAdapter({
      state: guildState,
      hydrated: guildHydrated,
      setState: setGuildState,
      refresh: refreshGuildState,
      inventoryDepositCandidates: guildDepositCandidates,
      guildHallCandidates: [],
    });
    const liveQuestState = questState ?? progressionState?.questState;
    const questInvitesAdapter = createHarthmereQuestInviteAdapter({
      questState: liveQuestState,
      hydrated: questStateHydrated || progressionHydrated,
      setQuestState,
      refresh: refreshQuestState,
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
                lootLedgerEntryToUi(
                  entry,
                  index,
                  inventoryLootState?.itemInstances
                )
            )
          : [];
        return ledger.slice(-30).reverse();
      },
      getAvailable: () =>
        lootDropsToUi(
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
        dispatchLiveModePlayerStatusFromBody(body);
        await refreshProgressionState();
      },
      chooseSpecialization: async (specializationId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_trainer_unlock",
          "trainer",
          { specializationId }
        );
        dispatchLiveModePlayerStatusFromBody(body);
        await refreshProgressionState();
      },
      learnAbility: async (abilityId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_trainer_unlock",
          "trainer",
          { abilityId }
        );
        dispatchLiveModePlayerStatusFromBody(body);
        await refreshProgressionState();
      },
      assignAbility: async (slot: number, abilityId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_loadout_change",
          "loadout",
          { slot: `slot_${slot}`, abilityId }
        );
        dispatchLiveModePlayerStatusFromBody(body);
        await refreshProgressionState();
      },
      discoverCollectible: async (collectibleId: string) => {
        const body = await submitProgressionLiveModeAction(
          "request_quest_state_update",
          "quest",
          { collectibleId }
        );
        dispatchLiveModePlayerStatusFromBody(body);
        await refreshProgressionState();
      },
    };

    const dailyTasks = dailyTodoTasksFromCareSnapshotForTest(dailyState);

    return {
      options: {
        getShortcuts: () => tabShortcuts,
        setShortcut: setTabShortcut,
      },
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
          dispatchLiveModePlayerStatusFromBody(body);
        },
      },
      inventory: inventoryAdapter,
      farming: {
        getModel: getNativeFarmingModel,
        getHoeQuestState: () => hoeQuestState,
        addHoeQuest: () => {
          const next = acceptHarthmereHoeQuest(userId);
          setHoeQuestState(next);
          const landmark = harthmereHoeQuestMapLandmarks(next)[0];
          if (!landmark) return;
          const pin = activeBiomesUIMapPinFromMarkerForTest({
            id: landmark.id,
            label: landmark.label,
            kind: landmark.kind,
            worldPosition: [...landmark.position],
            description: landmark.description,
          });
          if (pin) writeActiveBiomesUIMapPin(pin);
        },
      },
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
          createHarthmereSkillClientProjection({
            triggerState: nativeTriggerState,
            progressionSkills: Array.isArray(progressionState?.skills)
              ? progressionState.skills
              : undefined,
            characterProgression: {
              level: nativeProgression.level,
              xp: nativeProgression.xp,
              nextLevel: harthmereNativeXpForNextLevel(nativeProgression.level),
            },
          }),
        getCharacterStats: () => nativeCharacterStats,
      },
      abilities: {
        isHydrated: () => progressionHydrated,
        getEquipped: () =>
          Array.from({ length: 8 }, (_unused, index) => {
            const abilityId = progressionState?.equipped?.[index];
            return abilityId
              ? (abilityById.get(String(abilityId)) ?? null)
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
        jobsBoardStateWithLiveInventory,
        liveQuestState,
        buildingState,
        roadAheadChallengeStepHints,
        nativeQuestBundles,
        {
          getModel: getNativeFarmingModel,
          hoeQuestState,
        },
        {
          resolveNavAidPosition: resolveNativeQuestNavAidPosition,
          trackQuest: (questId) => {
            // Only native ECS quest ids are meaningful to MapManager; the
            // journal also lists live-mode/bible quests whose ids are strings.
            mapManager.trackingQuestId = questId
              ? safeParseBiomesId(questId)
              : undefined;
          },
        }
      ),
      questInvites: questInvitesAdapter,
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
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        withdraw: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        depositAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_deposit", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        withdrawAccount: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("account_withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        depositMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_deposit", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        withdrawMaterial: async (itemId: string, count: number) => {
          const body = await submitBankingLiveModeAction("material_withdraw", {
            itemId,
            count,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        upgradeSlots: async (kind: "personal" | "account" | "materials") => {
          const body = await submitBankingLiveModeAction("upgrade_slots", {
            vaultKind: kind,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        takeLoan: async (amount: number, days: number) => {
          const body = await submitBankingLiveModeAction("take_loan", {
            amount,
            days,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
        repayLoan: async (loanId: string | undefined, amount: number) => {
          const body = await submitBankingLiveModeAction("repay_loan", {
            loanId,
            amount,
          });
          setBankingState(body?.bankingState ?? (await fetchBankingState()));
        },
      },
      land: {
        isHydrated: () => buildingHydrated,
        getPlots: () => BUILDING_SYSTEM_PLOTS,
        getBlueprints: () => BUILDING_SYSTEM_BLUEPRINTS,
        getOwnedPlotIds: () => {
          const ownedPlotIds = buildingState?.ownedPlotIds;
          return Array.isArray(ownedPlotIds)
            ? ownedPlotIds.filter(
                (plotId): plotId is string => typeof plotId === "string"
              )
            : [];
        },
        getPlacedStructureIds: () => {
          const placedStructureIds = (buildingState as any)?.placedStructureIds;
          return Array.isArray(placedStructureIds)
            ? placedStructureIds.filter(
                (id: unknown): id is string => typeof id === "string"
              )
            : [];
        },
        getBuildingState: () => buildingState,
        submitBuildingAction: submitBuildingSystemLiveModeActionAndStore,
      },
    };
  }, [
    activityMessages,
    applyLiveModeInventoryResponse,
    bankingHydrated,
    bankingState,
    buildingHydrated,
    buildingState,
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
    gardenHose,
    hoeQuestState,
    harthmereInventoryRevision,
    inventoryLootHydrated,
    inventoryLootState,
    inventory?.currencies,
    inventory?.hotbar,
    inventory?.items,
    inventory?.selected,
    jobsBoardStateWithLiveInventory,
    nativeQuestBundles,
    nativeTriggerState,
    progressionHydrated,
    progressionState,
    questState,
    questStateHydrated,
    reactResources,
    refreshDailyState,
    refreshFarmingFoodState,
    refreshGuildState,
    refreshInventoryLootState,
    refreshProgressionState,
    refreshQuestState,
    roadAheadChallengeStepHints,
    resolveNativeQuestNavAidPosition,
    snapshotRevision,
    socialManager,
    submitBuildingSystemLiveModeActionAndStore,
    tabShortcuts,
    setTabShortcut,
    useLocalHarthmereFoodItem,
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
    shortcuts: tabShortcuts,
    tutorialStep,
  };
}
