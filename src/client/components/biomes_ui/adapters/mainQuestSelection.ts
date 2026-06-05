import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

export const BIOMES_UI_MAIN_QUEST_STORAGE_KEY_V1 =
  "biomes_ui_main_quest_v1";
export const BIOMES_UI_MAIN_QUEST_EVENT_V1 =
  "biomes-ui-main-quest-v1";

export interface BiomesUIMainQuestSelectionV1 {
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
): BiomesUIMainQuestSelectionV1 | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<BiomesUIMainQuestSelectionV1>;
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
): BiomesUIMainQuestSelectionV1 {
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
  selection: BiomesUIMainQuestSelectionV1 | undefined
): MapTrackableQuest | undefined {
  if (!selection) return undefined;
  const quest = quests.find((entry) => entry.questId === selection.questId);
  if (!quest || quest.status === "completed" || quest.status === "failed") {
    return undefined;
  }
  return quest;
}

export function readBiomesUIMainQuestSelectionV1(): BiomesUIMainQuestSelectionV1 | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseMainQuestSelection(
      window.localStorage?.getItem(BIOMES_UI_MAIN_QUEST_STORAGE_KEY_V1) ?? null
    );
  } catch {
    return undefined;
  }
}

export function writeBiomesUIMainQuestSelectionV1(
  selection: BiomesUIMainQuestSelectionV1 | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    if (selection) {
      window.localStorage?.setItem(
        BIOMES_UI_MAIN_QUEST_STORAGE_KEY_V1,
        JSON.stringify(selection)
      );
    } else {
      window.localStorage?.removeItem(BIOMES_UI_MAIN_QUEST_STORAGE_KEY_V1);
    }
  } catch {
    // In-memory UI state still updates when localStorage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_MAIN_QUEST_EVENT_V1, { detail: selection })
  );
}

export function setBiomesUIMainQuestFromTrackableQuestV1(
  quest: MapTrackableQuest
): BiomesUIMainQuestSelectionV1 {
  const selection = biomesUIMainQuestSelectionFromQuestForTest(quest);
  writeBiomesUIMainQuestSelectionV1(selection);
  return selection;
}
