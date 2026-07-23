import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST,
  HARTHMERE_NATIVE_QUEST_ID_MANIFEST,
  HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST,
} from "@/shared/harthmere/harthmere_native_quest_manifest";
import { HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/quest_compendium";
import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID,
} from "@/shared/harthmere/bible_quest_live_authority";
import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";

export const HARTHMERE_NATIVE_QUEST_OVERLAY_VERSION =
  "harthmere-native-authored-quests-v1" as const;

type QuestSource = "grove" | "bible";

function questKey(source: QuestSource, questId: string) {
  return `${source}:${questId}`;
}

export function harthmereNativeQuestId(
  source: QuestSource,
  questId: string
): BiomesId | undefined {
  return HARTHMERE_NATIVE_QUEST_ID_MANIFEST[
    questKey(source, questId) as keyof typeof HARTHMERE_NATIVE_QUEST_ID_MANIFEST
  ];
}

export function harthmereNativeQuestStepId(
  source: QuestSource,
  questId: string,
  objectiveIdOrIndex: string | number
): BiomesId | undefined {
  const key =
    source === "grove"
      ? `${questKey(source, questId)}:objective:${objectiveIdOrIndex}`
      : `${questKey(source, questId)}:objective:${objectiveIdOrIndex}`;
  return HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST[
    key as keyof typeof HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST
  ];
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

function objectiveTrigger(input: {
  id: BiomesId;
  challengeId: BiomesId;
  name: string;
  description?: string;
}): StoredTriggerDefinition {
  return {
    kind: "event",
    id: input.id,
    name: input.name,
    description: input.description,
    eventKind: "harthmereQuestProgress",
    count: 1,
    predicate: progressPredicate(input.challengeId, input.id),
  };
}

function sequenceTrigger(input: {
  source: QuestSource;
  questId: string;
  challengeId: BiomesId;
  objectives: ReadonlyArray<{ id: string | number; label: string }>;
}): StoredTriggerDefinition {
  const rootId =
    HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST[
      `${questKey(
        input.source,
        input.questId
      )}:root` as keyof typeof HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST
    ];
  if (!rootId)
    throw new Error(`Missing native quest root for ${input.questId}`);
  return {
    kind: "seq",
    id: rootId,
    triggers: input.objectives.map((objective) => {
      const id = harthmereNativeQuestStepId(
        input.source,
        input.questId,
        objective.id
      );
      if (!id) {
        throw new Error(
          `Missing native quest step for ${input.questId}:${objective.id}`
        );
      }
      return objectiveTrigger({
        id,
        challengeId: input.challengeId,
        name: objective.label,
      });
    }),
  };
}

function bibleUnlockTrigger(quest: any): StoredTriggerDefinition | undefined {
  const prerequisites = (quest.activeRules?.prerequisiteQuestIds ?? []).filter(
    (id: unknown): id is string => typeof id === "string" && id.length > 0
  );
  const rootId =
    HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST[
      `bible:${quest.id}:unlock:root` as keyof typeof HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST
    ] ??
    HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST[
      `bible:${quest.id}:root` as keyof typeof HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST
    ];

  // Giver-less hidden/world-trigger quests must not enter native in-progress
  // state merely because the player logged in. Their authored discovery rules
  // (location, weather, time, story flags) are enforced by Harthmere's live
  // quest authority. A circular unlock event keeps the global native challenge
  // runner from auto-starting them; a future discovery bridge can publish the
  // same server-owned challengeUnlocked evidence when the authored conditions
  // are actually satisfied.
  if (prerequisites.length === 0) {
    if (quest.hidden === true && !quest.giverId) {
      if (!rootId)
        throw new Error(`Missing native hidden gate for ${quest.id}`);
      const challenge = harthmereNativeQuestId("bible", quest.id);
      if (!challenge) throw new Error(`Missing native quest id ${quest.id}`);
      return {
        kind: "event",
        id: rootId,
        name: `Discover ${quest.title ?? quest.id}`,
        eventKind: "challengeUnlocked",
        count: 1,
        predicate: {
          kind: "object",
          fields: [["challenge", { kind: "value", value: challenge }]],
        },
      };
    }
    return undefined;
  }
  if (!rootId) throw new Error(`Missing native unlock root for ${quest.id}`);
  return {
    kind: "all",
    id: rootId,
    triggers: prerequisites.map((prerequisiteId: string) => {
      const id =
        HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST[
          `bible:${quest.id}:unlock:${prerequisiteId}` as keyof typeof HARTHMERE_NATIVE_QUEST_STEP_ID_MANIFEST
        ];
      const challenge = harthmereNativeQuestId("bible", prerequisiteId);
      if (!id || !challenge) {
        throw new Error(
          `Missing native prerequisite ${quest.id}:${prerequisiteId}`
        );
      }
      return {
        kind: "challengeComplete" as const,
        id,
        challenge,
      };
    }),
  };
}

function groveQuestBiscuit(quest: (typeof SNAPSHOT_GROVE_QUESTS)[number]) {
  const id = harthmereNativeQuestId("grove", quest.id);
  if (!id) throw new Error(`Missing native Grove quest id ${quest.id}`);
  const giver =
    HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
      quest.giverNpcId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
    ];
  return {
    id,
    name: `harthmere_grove_quest_${quest.id.replace(/[^a-z0-9]+/gi, "_")}`,
    displayName: quest.title,
    displayDescription: quest.hook,
    isQuest: true,
    isSideQuest: true,
    questGiver: giver?.entityId,
    questAcceptText: quest.sampleDialogue,
    repeatableCadence: "never",
    trigger: sequenceTrigger({
      source: "grove",
      questId: quest.id,
      challengeId: id,
      objectives: quest.objectives.map((label, index) => ({
        id: index,
        label,
      })),
    }),
  } as Biscuit;
}

function bibleQuestBiscuit(quest: any) {
  const id = harthmereNativeQuestId("bible", quest.id);
  if (!id) throw new Error(`Missing native Bible quest id ${quest.id}`);
  const giver = quest.giverId
    ? HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
        quest.giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
      ]
    : undefined;
  const questGiver =
    quest.id === HARTHMERE_BIBLE_DRAGON_QUEST_ID
      ? (HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID as BiomesId)
      : giver?.entityId;
  const repeatability = String(quest.repeatability ?? "once").toLowerCase();
  return {
    id,
    name: `harthmere_bible_quest_${quest.id.replace(/[^a-z0-9]+/gi, "_")}`,
    displayName: quest.title,
    displayDescription: quest.premise,
    isQuest: true,
    ...(quest.category === "main" ? {} : { isSideQuest: true as const }),
    questGiver,
    questAcceptText: quest.dialogue?.offer,
    repeatableCadence: repeatability.includes("daily")
      ? "daily"
      : repeatability.includes("weekly")
      ? "weekly"
      : repeatability.includes("repeat")
      ? "always"
      : "never",
    unlock: bibleUnlockTrigger(quest),
    trigger: sequenceTrigger({
      source: "bible",
      questId: quest.id,
      challengeId: id,
      objectives: (quest.objectives ?? []).map((objective: any) => ({
        id: objective.id,
        label: objective.label,
      })),
    }),
  } as Biscuit;
}

export function allHarthmereNativeQuestBiscuits(): Biscuit[] {
  return [
    ...SNAPSHOT_GROVE_QUESTS.map(groveQuestBiscuit),
    ...HARTHMERE_QUEST_CATALOG.map(bibleQuestBiscuit),
  ];
}
