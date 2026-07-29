import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST,
  HARTHMERE_NATIVE_QUEST_ID_MANIFEST,
  HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST,
} from "@/shared/harthmere/harthmere_native_quest_manifest";
import { allBibleNativeQuestBiscuits } from "@/shared/harthmere/bible/bible_native_quests";
import {
  bibleNativeQuestId,
  bibleNativeStepId,
} from "@/shared/harthmere/bible/bible_quest_ids";
import { allGroveNativeQuestBiscuits } from "@/shared/harthmere/grove/grove_native_quests";
import {
  groveNativeQuestId,
  groveNativeStepId,
} from "@/shared/harthmere/grove/grove_quest_ids";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import { allCh1NativeQuestBiscuits } from "@/shared/harthmere/ch1_native_quests";

export const HARTHMERE_NATIVE_QUEST_OVERLAY_VERSION =
  "harthmere-native-authored-quests-v1" as const;

const HARTHMERE_NATIVE_GROVE_QUEST_IDS = new Set<number>(
  Object.entries(HARTHMERE_NATIVE_QUEST_ID_MANIFEST)
    .filter(([key]) => key.startsWith("grove:"))
    .map(([, value]) => Number(value))
);

/** Source-scoped lifecycle check used to retire completed onboarding lessons. */
export function isHarthmereNativeGroveQuestId(id: unknown) {
  return HARTHMERE_NATIVE_GROVE_QUEST_IDS.has(Number(id));
}

type QuestSource = "grove" | "bible";

function questKey(source: QuestSource, questId: string) {
  return `${source}:${questId}`;
}

// Both id spaces are now owned by their own module (pinned to already-issued
// values, derived only for genuinely new quests). These two functions stay
// source-scoped and DELEGATE rather than forcing every generic call site — the
// server materializer and its tests — to branch on source itself.
export function harthmereNativeQuestId(
  source: QuestSource,
  questId: string
): BiomesId | undefined {
  return source === "bible"
    ? bibleNativeQuestId(questId)
    : groveNativeQuestId(questId);
}

export function harthmereNativeQuestStepId(
  source: QuestSource,
  questId: string,
  objectiveIdOrIndex: string | number
): BiomesId | undefined {
  return source === "bible"
    ? bibleNativeStepId(questId, objectiveIdOrIndex)
    : groveNativeStepId(questId, objectiveIdOrIndex);
}

export function allHarthmereNativeQuestBiscuits(): Biscuit[] {
  return [
    // All three quest systems now own their own projection, ids, unlock kinds
    // and giver resolution. This module is only the assembly point.
    // See docs/harthmere/BIBLE_TO_CH1_MIGRATION.md and
    // docs/harthmere/GROVE_TO_CH1_MIGRATION.md.
    ...allGroveNativeQuestBiscuits(),
    ...allBibleNativeQuestBiscuits(),
    ...allCh1NativeQuestBiscuits(),
  ];
}
