// BIBLE_NATIVE_QUESTS
//
// Projects the authored Bible catalog into native Bikkie quest biscuits, in
// exactly the shape `ch1_native_quests.ts` uses.
//
// AUTHORITY
// ---------
// The projection is the whole integration. Native `Challenges` and
// `TriggerState` are the progress authority; each objective leaf accepts only
// the signed `harthmereQuestProgress` evidence that
// `src/server/logic/events/handlers/harthmere_quest_progress.ts` validates
// three ways (JWT signature, challenge actually in `in_progress`, step
// actually present in this biscuit's trigger tree).
//
// That third check is why the tree here must contain every step id the server
// will ever be asked to accept — and why the direct
// `Challenges`/`TriggerState` write in `native_ecs_drop_materialization.ts`
// gets deleted in phase 4. Two writers into the same two components is the
// failure mode this repo has hit repeatedly.
//
// `Biscuit` and `BiomesId` are imported `import type` only, so this module
// still erases to nothing at runtime and runs under `.mocharc.fast.json`.

import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import type { BiomesId } from "@/shared/ids";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import {
  BIBLE_DRAGON_QUEST_ID,
  BIBLE_THAEDRYN_ENTITY_ID,
} from "@/shared/harthmere/bible/bible_thaedryn";
import { BIBLE_QUEST_CATALOG } from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleNativeQuestId,
  bibleNativeQuestRootId,
  bibleNativeStepId,
  bibleNativeUnlockPrerequisiteId,
  bibleNativeUnlockRootId,
} from "@/shared/harthmere/bible/bible_quest_ids";
import {
  bibleQuestGiverId,
  type BibleQuestDef,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_NATIVE_QUESTS_VERSION = 1 as const;

function progressPredicate(challengeId: BiomesId, stepId: BiomesId): Matcher {
  return {
    kind: "object",
    fields: [
      ["challengeId", { kind: "value", value: challengeId }],
      ["stepId", { kind: "value", value: stepId }],
    ],
  };
}

function questTrigger(quest: BibleQuestDef): StoredTriggerDefinition {
  const challengeId = bibleNativeQuestId(quest.id);
  const rootId = bibleNativeQuestRootId(quest.id);
  if (!challengeId || !rootId) {
    throw new Error(`Missing native Bible quest identity for ${quest.id}`);
  }
  return {
    kind: "seq",
    id: rootId,
    triggers: quest.steps.map((step, index) => {
      const stepId = bibleNativeStepId(quest.id, index);
      if (!stepId) {
        throw new Error(`Missing native Bible step ${quest.id}:${step.id}`);
      }
      return {
        kind: "event" as const,
        id: stepId,
        name: step.label,
        description: step.targetName,
        eventKind: "harthmereQuestProgress",
        count: step.count,
        predicate: progressPredicate(challengeId, stepId),
      };
    }),
  };
}

/**
 * Unlock projection, total over `BibleQuestStart`.
 *
 *   giver          -> undefined            available now; the NPC offers it
 *   after          -> challengeComplete    ordinary chain (11 quests)
 *   world_trigger  -> circular challengeUnlocked(self)
 *
 * The circular self-gate is deliberate and load-bearing. The global native
 * challenge runner starts any quest whose unlock is satisfied, so a hidden,
 * giver-less quest with no unlock would enter `in_progress` the moment the
 * player logs in. A trigger only a server-owned `challengeUnlocked` publish
 * naming this exact quest can satisfy means: nothing but an explicit discovery
 * starts this. The three `side_hidden` rows use it.
 */
function unlockTrigger(
  quest: BibleQuestDef
): StoredTriggerDefinition | undefined {
  if (quest.start.kind === "giver") return undefined;

  const rootId = bibleNativeUnlockRootId(quest.id);
  if (!rootId) {
    throw new Error(`Missing native Bible unlock root for ${quest.id}`);
  }

  if (quest.start.kind === "world_trigger") {
    const challenge = bibleNativeQuestId(quest.id);
    if (!challenge) {
      throw new Error(`Missing native Bible quest id ${quest.id}`);
    }
    return {
      kind: "event",
      id: rootId,
      name: `Discover ${quest.title}`,
      eventKind: "challengeUnlocked",
      count: 1,
      predicate: {
        kind: "object",
        fields: [["challenge", { kind: "value", value: challenge }]],
      },
    };
  }

  const prerequisiteId = quest.start.questId;
  const prerequisiteChallenge = bibleNativeQuestId(prerequisiteId);
  const leafId = bibleNativeUnlockPrerequisiteId(quest.id, prerequisiteId);
  if (!prerequisiteChallenge || !leafId) {
    throw new Error(
      `Missing native Bible prerequisite ${quest.id}:${prerequisiteId}`
    );
  }
  // `all` with a single child rather than a bare `challengeComplete`: the
  // manifest already pinned an unlock ROOT and a separate prerequisite LEAF
  // for these quests, and collapsing them would orphan the pinned leaf id.
  return {
    kind: "all",
    id: rootId,
    triggers: [
      {
        kind: "challengeComplete",
        id: leafId,
        challenge: prerequisiteChallenge,
      },
    ],
  };
}

/**
 * ANIMA RULE 1 — givers resolve by id through the manifest, never by matching
 * a rendered NPC's display label. Label matching silently orphans a giver the
 * moment a name gains a role or district suffix.
 *
 * Q12 is the one deliberate override: its "giver" is the Thaedryn encounter
 * entity, so the quest is offered by the boss rather than an NPC.
 */
function questGiverEntityId(quest: BibleQuestDef): BiomesId | undefined {
  if (quest.id === BIBLE_DRAGON_QUEST_ID) {
    return BIBLE_THAEDRYN_ENTITY_ID as BiomesId;
  }
  const giverId = bibleQuestGiverId(quest);
  if (!giverId) return undefined;
  return HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
    giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
  ]?.entityId;
}

function repeatableCadence(quest: BibleQuestDef) {
  switch (quest.repeatability) {
    case "daily":
      return "daily" as const;
    case "weekly":
      return "weekly" as const;
    case "once":
      return "never" as const;
  }
}

export function bibleQuestBiscuit(quest: BibleQuestDef): Biscuit {
  const id = bibleNativeQuestId(quest.id);
  if (!id) throw new Error(`Missing native Bible quest id ${quest.id}`);
  return {
    id,
    name: `harthmere_bible_quest_${quest.id.replace(/[^a-z0-9]+/gi, "_")}`,
    displayName: quest.title,
    displayDescription: quest.premise,
    isQuest: true,
    ...(quest.category === "main" ? {} : { isSideQuest: true as const }),
    questGiver: questGiverEntityId(quest),
    questAcceptText: quest.dialogue.offer,
    repeatableCadence: repeatableCadence(quest),
    unlock: unlockTrigger(quest),
    trigger: questTrigger(quest),
  } as Biscuit;
}

export function allBibleNativeQuestBiscuits(): Biscuit[] {
  return BIBLE_QUEST_CATALOG.map(bibleQuestBiscuit);
}
