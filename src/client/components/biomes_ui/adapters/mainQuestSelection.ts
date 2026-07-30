import type { MapTrackableQuest } from "../tabs/MapQuestsTab";
import {
  NATIVE_GIMME_SHELTER_QUEST_ID,
  nativeRobotStoryQuestOrder,
} from "@/shared/harthmere/native_road_ahead_contract";
import { NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID } from "@/shared/harthmere/native_post_gimme_contract";
import {
  ch1NativeQuestId,
  isCh1NativeQuestId,
} from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

export const BIOMES_UI_MAIN_QUEST_STORAGE_KEY = "biomes_ui_main_quest";
export const BIOMES_UI_MAIN_QUEST_EVENT = "biomes-ui-main-quest";
const BIOMES_UI_MAIN_QUEST_CLEARED_ID = "__biomes_ui_main_quest_cleared__";
const BIOMES_UI_MAIN_QUEST_CLEARED_TITLE = "No tracked quest";

export interface BiomesUIMainQuestSelection {
  questId: string;
  title: string;
  firstMarkerId?: string;
  objective?: string;
  setAtMs: number;
}

/**
 * A missing storage entry means "the player has never chosen", which is when
 * the onboarding story should be selected automatically. The old clear action
 * removed that entry, so the next render immediately selected Busted again.
 * Persist this private sentinel to distinguish the player's explicit clear
 * from the initial default without introducing a second drifting storage key.
 */
export function biomesUIMainQuestClearedSelectionForTest(
  nowMs = Date.now()
): BiomesUIMainQuestSelection {
  return {
    questId: BIOMES_UI_MAIN_QUEST_CLEARED_ID,
    title: BIOMES_UI_MAIN_QUEST_CLEARED_TITLE,
    setAtMs: nowMs,
  };
}

export function isBiomesUIMainQuestClearedSelection(
  selection: BiomesUIMainQuestSelection | undefined
): boolean {
  return selection?.questId === BIOMES_UI_MAIN_QUEST_CLEARED_ID;
}

function cleanText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

function parseMainQuestSelection(
  value: string | null
): BiomesUIMainQuestSelection | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<BiomesUIMainQuestSelection>;
    const questId = cleanText(parsed.questId);
    const title = cleanText(parsed.title);
    if (!questId || !title) return undefined;
    return {
      questId,
      title,
      firstMarkerId: cleanText(parsed.firstMarkerId),
      objective: cleanText(parsed.objective),
      setAtMs: Number.isFinite(Number(parsed.setAtMs))
        ? Number(parsed.setAtMs)
        : Date.now(),
    };
  } catch {
    return undefined;
  }
}

export function biomesUIMainQuestSelectionFromQuestForTest(
  quest: MapTrackableQuest,
  nowMs = Date.now()
): BiomesUIMainQuestSelection {
  return {
    questId: quest.questId,
    title: quest.title,
    firstMarkerId: cleanText(quest.firstMarkerId),
    objective:
      cleanText(quest.objective) ??
      quest.objectives?.map(cleanText).find(Boolean),
    setAtMs: nowMs,
  };
}

export function mainQuestFromTrackableQuestsForTest(
  quests: MapTrackableQuest[],
  selection: BiomesUIMainQuestSelection | undefined
): MapTrackableQuest | undefined {
  if (isBiomesUIMainQuestClearedSelection(selection)) return undefined;
  if (!selection) return defaultMainQuestFromTrackableQuestsForTest(quests);
  const quest = quests.find((entry) => entry.questId === selection.questId);
  if (!quest || quest.status === "completed" || quest.status === "failed") {
    // Carry a completed/retired robot-story selection forward to the chapter
    // that the ECS trigger engine just auto-started. Explicit selections of
    // unrelated quests retain their old behavior.
    if (isMainStoryIdentity(selection.questId, selection.title)) {
      return defaultMainQuestFromTrackableQuestsForTest(quests);
    }
    return undefined;
  }
  return quest;
}

function normalizedQuestTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ROBOT_STORY_TITLES = [
  "road ahead",
  "busted",
  "get the muck out",
  "muck vs machine",
] as const;
const GIMME_SHELTER_TITLE = "gimme shelter";
const BATTERY_NOT_INCLUDED_TITLE = "battery not included";

function robotStoryTitleOrder(title: string) {
  return ROBOT_STORY_TITLES.indexOf(
    normalizedQuestTitle(title) as (typeof ROBOT_STORY_TITLES)[number]
  );
}

function chapter1QuestOrder(questId: string, title: string) {
  if (isCh1NativeQuestId(questId)) {
    return CH1_QUESTS.findIndex(
      (quest) => String(ch1NativeQuestId(quest.id)) === questId
    );
  }
  const normalizedTitle = normalizedQuestTitle(title);
  return CH1_QUESTS.findIndex(
    (quest) => normalizedQuestTitle(quest.title) === normalizedTitle
  );
}

/**
 * Battery Not Included is the first original-snapshot quest after Gimme Shelter
 * that the tray categorizes as `main`, so it belongs to the main-story identity
 * set: a player who tracked it and then finished it should fall back to the
 * story default rather than to "no tracked quest".
 *
 * It deliberately sorts AFTER Chapter 1 in `mainStoryOrder`. Chapter 1 and
 * Battery Not Included are genuinely parallel — Chapter 1 auto-starts from Muck
 * vs. Machine, while Battery Not Included only becomes *available* once
 * Hoedown, Fish Food and In Storage are all complete. Sorting it earlier would
 * let the default silently yank tracking off an in-progress Chapter 1 the
 * moment its offer appeared. Ordering it last means the automatic default keeps
 * Chapter 1, and picking up the power cell story stays an explicit player
 * choice through `setMainQuest`.
 */
function isBatteryNotIncludedIdentity(questId: string, title: string): boolean {
  return (
    Number(questId) === Number(NATIVE_BATTERY_NOT_INCLUDED_QUEST_ID) ||
    normalizedQuestTitle(title) === BATTERY_NOT_INCLUDED_TITLE
  );
}

function isMainStoryIdentity(questId: string, title: string): boolean {
  return (
    questId === "snapshot_road_ahead_full_chain" ||
    nativeRobotStoryQuestOrder(questId) >= 0 ||
    robotStoryTitleOrder(title) >= 0 ||
    Number(questId) === Number(NATIVE_GIMME_SHELTER_QUEST_ID) ||
    normalizedQuestTitle(title) === GIMME_SHELTER_TITLE ||
    chapter1QuestOrder(questId, title) >= 0 ||
    isBatteryNotIncludedIdentity(questId, title)
  );
}

function mainStoryOrder(quest: MapTrackableQuest) {
  if (
    quest.questId === "snapshot_road_ahead_full_chain" ||
    quest.kind === "snapshot_nux_challenge_bridge"
  ) {
    return 0;
  }
  const nativeOrder = nativeRobotStoryQuestOrder(quest.questId);
  if (nativeOrder >= 0) return nativeOrder;
  if (
    Number(quest.questId) === Number(NATIVE_GIMME_SHELTER_QUEST_ID) ||
    normalizedQuestTitle(quest.title) === GIMME_SHELTER_TITLE
  ) {
    return NATIVE_ROBOT_STORY_QUEST_IDS_LENGTH;
  }
  const titleOrder = robotStoryTitleOrder(quest.title);
  if (titleOrder >= 0) return titleOrder;
  const chapter1Order = chapter1QuestOrder(quest.questId, quest.title);
  if (chapter1Order >= 0) {
    return NATIVE_ROBOT_STORY_QUEST_IDS_LENGTH + 1 + chapter1Order;
  }
  // Strictly after every Chapter 1 entry — see isBatteryNotIncludedIdentity.
  return isBatteryNotIncludedIdentity(quest.questId, quest.title)
    ? NATIVE_ROBOT_STORY_QUEST_IDS_LENGTH + 1 + CH1_QUESTS.length
    : -1;
}

const NATIVE_ROBOT_STORY_QUEST_IDS_LENGTH = ROBOT_STORY_TITLES.length;

/**
 * The onboarding/robot story remains the default main quest until its final
 * chapter is complete or the player explicitly chooses another active quest.
 */
export function defaultMainQuestFromTrackableQuestsForTest(
  quests: MapTrackableQuest[]
): MapTrackableQuest | undefined {
  const story = quests
    .filter((quest) => mainStoryOrder(quest) >= 0)
    .sort((a, b) => mainStoryOrder(a) - mainStoryOrder(b));
  return (
    story.find((quest) => quest.status === "active") ??
    story.find((quest) => quest.status === "available")
  );
}

export function readBiomesUIMainQuestSelection():
  | BiomesUIMainQuestSelection
  | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseMainQuestSelection(
      window.localStorage?.getItem(BIOMES_UI_MAIN_QUEST_STORAGE_KEY) ?? null
    );
  } catch {
    return undefined;
  }
}

export function writeBiomesUIMainQuestSelection(
  selection: BiomesUIMainQuestSelection | undefined
): void {
  if (typeof window === "undefined") return;
  const storedSelection =
    selection ?? biomesUIMainQuestClearedSelectionForTest();
  try {
    window.localStorage?.setItem(
      BIOMES_UI_MAIN_QUEST_STORAGE_KEY,
      JSON.stringify(storedSelection)
    );
  } catch {
    // In-memory UI state still updates when localStorage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_MAIN_QUEST_EVENT, { detail: storedSelection })
  );
}

export function setBiomesUIMainQuestFromTrackableQuest(
  quest: MapTrackableQuest
): BiomesUIMainQuestSelection {
  const selection = biomesUIMainQuestSelectionFromQuestForTest(quest);
  writeBiomesUIMainQuestSelection(selection);
  return selection;
}
