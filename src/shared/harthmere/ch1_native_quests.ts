// CHAPTER_1_NATIVE_QUESTS
//
// Native Bikkie challenge projections for every Chapter 1 quest. Physical
// interaction validation remains server-owned; each objective leaf accepts
// only the signed `harthmereQuestProgress` evidence already used by Grove and
// Bible quests. The browser E2E gate separately executes the full Chapter 1
// state machine so a present biscuit can never be mistaken for a completable
// story chain.

import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { NATIVE_MUCK_VS_MACHINE_QUEST_ID } from "@/shared/harthmere/native_road_ahead_contract";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { CH1_QUESTS, type Ch1QuestDef } from "@/shared/harthmere/ch1_quests";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";

export const CH1_NATIVE_QUESTS_VERSION = "ch1-native-quests-v1" as const;
const CH1_NATIVE_QUEST_ID_BASE = 8_762_000_000_000_000;
const CH1_NATIVE_STEP_ID_BASE = 8_762_100_000_000_000;
const CH1_NATIVE_STEPS_PER_QUEST = 100;

function id(value: number): BiomesId {
  return value as BiomesId;
}

/**
 * Stable numeric ids are derived from the frozen authored quest order. New
 * quests must append; reordering is a migration and is guarded by tests. Each
 * quest owns a 100-id step block (root at +0, objectives at +1..), leaving
 * room to add objectives without moving later quests.
 */
export function ch1NativeQuestId(questId: string): BiomesId | undefined {
  const index = CH1_QUESTS.findIndex((quest) => quest.id === questId);
  return index < 0 ? undefined : id(CH1_NATIVE_QUEST_ID_BASE + index);
}

export function ch1NativeQuestStepId(
  questId: string,
  stepIdOrIndex: string | number
): BiomesId | undefined {
  const questIndex = CH1_QUESTS.findIndex((quest) => quest.id === questId);
  if (questIndex < 0) {
    return undefined;
  }
  const quest = CH1_QUESTS[questIndex];
  const stepIndex =
    typeof stepIdOrIndex === "number"
      ? stepIdOrIndex
      : quest.steps.findIndex((step) => step.id === stepIdOrIndex);
  if (stepIndex < 0 || stepIndex >= CH1_NATIVE_STEPS_PER_QUEST - 1) {
    return undefined;
  }
  return id(
    CH1_NATIVE_STEP_ID_BASE +
      questIndex * CH1_NATIVE_STEPS_PER_QUEST +
      stepIndex +
      1
  );
}

export function ch1NativeQuestRootId(questId: string): BiomesId | undefined {
  const questIndex = CH1_QUESTS.findIndex((quest) => quest.id === questId);
  return questIndex < 0
    ? undefined
    : id(
        CH1_NATIVE_STEP_ID_BASE + questIndex * CH1_NATIVE_STEPS_PER_QUEST
      );
}

function progressPredicate(challengeId: BiomesId, stepId: BiomesId): Matcher {
  return {
    kind: "object",
    fields: [
      ["challengeId", { kind: "value", value: challengeId }],
      ["stepId", { kind: "value", value: stepId }],
    ],
  };
}

function questTrigger(quest: Ch1QuestDef): StoredTriggerDefinition {
  const challengeId = ch1NativeQuestId(quest.id)!;
  return {
    kind: "seq",
    id: ch1NativeQuestRootId(quest.id)!,
    triggers: quest.steps.map((step, index) => {
      const stepId = ch1NativeQuestStepId(quest.id, index)!;
      return {
        kind: "event" as const,
        id: stepId,
        name: step.title,
        description: step.objective,
        eventKind: "harthmereQuestProgress",
        count: 1,
        predicate: progressPredicate(challengeId, stepId),
      };
    }),
  };
}

function unlockTrigger(index: number): StoredTriggerDefinition {
  const prerequisite =
    index === 0
      ? NATIVE_MUCK_VS_MACHINE_QUEST_ID
      : ch1NativeQuestId(CH1_QUESTS[index - 1].id)!;
  // Unlock ids live at the end of each quest's reserved block so adding an
  // objective never remaps this prerequisite node.
  return {
    kind: "challengeComplete",
    id: id(
      CH1_NATIVE_STEP_ID_BASE +
        index * CH1_NATIVE_STEPS_PER_QUEST +
        CH1_NATIVE_STEPS_PER_QUEST -
        1
    ),
    challenge: prerequisite,
  };
}

function questGiverId(quest: Ch1QuestDef): BiomesId | undefined {
  if (quest.id === "ch1_a4_q06_teak") {
    // The narrative referral comes from Sergeant Bram Holt, but the imported
    // production snapshot does not guarantee the old local-dev Holt entity
    // (`8810000000010027`) exists. Giving that absent id to the native quest
    // leaves the linear chapter permanently available but impossible to
    // accept. Auto-start the investigation after Lou's preceding challenge;
    // its objective still routes to the guaranteed Chapter 1 Teak ECS entity.
    return undefined;
  }
  const chapterMember = CH1_NEW_CAST.find(
    (member) => member.displayName === quest.giver
  );
  if (chapterMember) {
    return chapterMember.entityId;
  }
  const existing = Object.values(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST).find(
    (giver) =>
      giver.displayName === quest.giver ||
      giver.displayName.startsWith(`${quest.giver},`) ||
      giver.displayName.startsWith(`${quest.giver} `)
  );
  return existing?.entityId;
}

function chapter1QuestBiscuit(quest: Ch1QuestDef, index: number): Biscuit {
  return {
    id: ch1NativeQuestId(quest.id)!,
    name: `harthmere_ch1_quest_${quest.id}`,
    displayName: quest.title,
    displayDescription: quest.summary,
    isQuest: true,
    questGiver: questGiverId(quest),
    questAcceptText: quest.summary,
    repeatableCadence: "never",
    unlock: unlockTrigger(index),
    trigger: questTrigger(quest),
  } as Biscuit;
}

export function allCh1NativeQuestBiscuits(): Biscuit[] {
  return CH1_QUESTS.map(chapter1QuestBiscuit);
}

export function isCh1NativeQuestId(value: unknown): boolean {
  const numeric = Number(value);
  return (
    Number.isSafeInteger(numeric) &&
    numeric >= CH1_NATIVE_QUEST_ID_BASE &&
    numeric < CH1_NATIVE_QUEST_ID_BASE + CH1_QUESTS.length
  );
}
