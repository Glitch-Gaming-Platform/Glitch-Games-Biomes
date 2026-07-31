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
import { CH1_QUESTS, type Ch1QuestDef } from "@/shared/harthmere/ch1_quests";
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

/** The Chapter 1 quest that must run in parallel with Gimme Shelter after the
 * prologue completes. Exported so the trigger lifecycle can repair older saves
 * that completed Muck vs. Machine before this native projection was present. */
export const NATIVE_CH1_FIRST_QUEST_ID = id(CH1_NATIVE_QUEST_ID_BASE);

export function isNativeCh1PrologueHandoffQuestId(id: unknown) {
  return Number(id) === Number(NATIVE_CH1_FIRST_QUEST_ID);
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
    : id(CH1_NATIVE_STEP_ID_BASE + questIndex * CH1_NATIVE_STEPS_PER_QUEST);
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

function chapter1QuestBiscuit(quest: Ch1QuestDef, index: number): Biscuit {
  return {
    id: ch1NativeQuestId(quest.id)!,
    name: `harthmere_ch1_quest_${quest.id}`,
    displayName: quest.title,
    displayDescription: quest.summary,
    isQuest: true,
    // Chapter 1 is a strictly linear continuation. A shared ECS quest-giver
    // body cannot follow a per-player staged character: Lou's body is seeded at
    // Greenlamp while the Act 6 handover is at Returnstone, Rook moves between
    // three gates, and Jackie ends in the watch-house. Making those bodies own
    // acceptance strands the quest as "available" at an invisible old spawn.
    // Giver-less native biscuits auto-start from challengeComplete; the
    // authored giver still owns the first objective and dialogue at the staged
    // location.
    questGiver: undefined,
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
