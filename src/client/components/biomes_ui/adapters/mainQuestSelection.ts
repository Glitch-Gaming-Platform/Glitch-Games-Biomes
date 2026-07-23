import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

export const BIOMES_UI_MAIN_QUEST_STORAGE_KEY = "biomes_ui_main_quest";
export const BIOMES_UI_MAIN_QUEST_EVENT = "biomes-ui-main-quest";

export interface BiomesUIMainQuestSelection {
  questId: string;
  title: string;
  firstMarkerId?: string;
  objective?: string;
  setAtMs: number;
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
  if (!selection) return defaultMainQuestFromTrackableQuestsForTest(quests);
  const quest = quests.find((entry) => entry.questId === selection.questId);
  if (!quest || quest.status === "completed" || quest.status === "failed") {
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

function isRoadAheadQuest(quest: MapTrackableQuest): boolean {
  return (
    quest.questId === "snapshot_road_ahead_full_chain" ||
    quest.kind === "snapshot_nux_challenge_bridge" ||
    normalizedQuestTitle(quest.title) === "road ahead"
  );
}

/**
 * The onboarding story is the initial main quest until the player explicitly
 * chooses another active quest. This is derived from the live quest list rather
 * than a hard-coded native numeric id, so both snapshot and native Road Ahead
 * projections receive the same behavior.
 */
export function defaultMainQuestFromTrackableQuestsForTest(
  quests: MapTrackableQuest[]
): MapTrackableQuest | undefined {
  return (
    quests.find(
      (quest) => quest.status === "active" && isRoadAheadQuest(quest)
    ) ??
    quests.find(
      (quest) => quest.status === "available" && isRoadAheadQuest(quest)
    )
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
  try {
    if (selection) {
      window.localStorage?.setItem(
        BIOMES_UI_MAIN_QUEST_STORAGE_KEY,
        JSON.stringify(selection)
      );
    } else {
      window.localStorage?.removeItem(BIOMES_UI_MAIN_QUEST_STORAGE_KEY);
    }
  } catch {
    // In-memory UI state still updates when localStorage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_MAIN_QUEST_EVENT, { detail: selection })
  );
}

export function setBiomesUIMainQuestFromTrackableQuest(
  quest: MapTrackableQuest
): BiomesUIMainQuestSelection {
  const selection = biomesUIMainQuestSelectionFromQuestForTest(quest);
  writeBiomesUIMainQuestSelection(selection);
  return selection;
}
