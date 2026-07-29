// GROVE_NATIVE_QUESTS
//
// Projects the Grove onboarding catalog into native Bikkie quest biscuits, in
// the same shape `ch1_native_quests.ts` and `bible_native_quests.ts` use.
//
// AUTHORITY
// ---------
// Each objective leaf accepts only signed `harthmereQuestProgress` evidence,
// which `src/server/logic/events/handlers/harthmere_quest_progress.ts`
// re-validates three ways: JWT signature, challenge actually in
// `in_progress`, and step actually present in this biscuit's trigger tree.
//
// UNLOCK PROJECTION — only ONE of Grove's three unlock kinds is native
//
//   after                    -> challengeComplete(prerequisite)
//   giver                    -> undefined (available; the NPC offers it)
//   after_fountain_lessons   -> undefined, GATE-ENFORCED (see below)
//   after_accepted           -> undefined, GATE-ENFORCED (see below)
//
// The last two are deliberately not projected. "Any 4 of 13 fountain lessons"
// is a count over a set; expressing it as a native boolean tree would need
// every 4-subset of 13 (715 branches), and it would still have to be rebuilt
// whenever a lesson is added. "Accepted but not completed" cannot be expressed
// at all, because unlock triggers fire on completion events.
//
// Leaving them unprojected means the native challenge is AVAILABLE while the
// gate refuses to offer it — which is correct: availability is "the engine has
// no objection", offerability is "the fiction is ready". `grove_quest_gate.ts`
// is the single enforcement point, called by NPC dialogue and the accept
// route, and `grove_engine_contracts.ts` asserts every gate-enforced quest
// really is gate-checked rather than silently open.

import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import { GROVE_QUEST_CATALOG } from "@/shared/harthmere/grove/grove_quest_catalog";
import {
  groveNativeQuestId,
  groveNativeQuestRootId,
  groveNativeStepId,
  groveNativeUnlockPrerequisiteId,
  groveNativeUnlockRootId,
} from "@/shared/harthmere/grove/grove_quest_ids";
import {
  groveQuestGiverId,
  type GroveQuestDef,
} from "@/shared/harthmere/grove/grove_quest_schema";

export const GROVE_NATIVE_QUESTS_VERSION = 1 as const;

function progressPredicate(challengeId: BiomesId, stepId: BiomesId): Matcher {
  return {
    kind: "object",
    fields: [
      ["challengeId", { kind: "value", value: challengeId }],
      ["stepId", { kind: "value", value: stepId }],
    ],
  };
}

function questTrigger(quest: GroveQuestDef): StoredTriggerDefinition {
  const challengeId = groveNativeQuestId(quest.id);
  const rootId = groveNativeQuestRootId(quest.id);
  if (!challengeId || !rootId) {
    throw new Error(`Missing native Grove quest identity for ${quest.id}`);
  }
  return {
    kind: "seq",
    id: rootId,
    triggers: quest.steps.map((step) => {
      // Pinned BY INDEX — Grove objectives had no authored ids before the
      // migration, so position is identity.
      const stepId = groveNativeStepId(quest.id, step.index);
      if (!stepId) {
        throw new Error(`Missing native Grove step ${quest.id}:${step.index}`);
      }
      return {
        kind: "event" as const,
        id: stepId,
        name: step.label,
        description: step.markerId,
        eventKind: "harthmereQuestProgress",
        count: 1,
        predicate: progressPredicate(challengeId, stepId),
      };
    }),
  };
}

/** Unlock kinds that native `Challenges` genuinely cannot express. */
export const GROVE_GATE_ENFORCED_START_KINDS = Object.freeze([
  "after_fountain_lessons",
  "after_accepted",
] as const);

export function groveQuestIsGateEnforced(quest: GroveQuestDef): boolean {
  return (
    GROVE_GATE_ENFORCED_START_KINDS as readonly string[]
  ).includes(quest.start.kind);
}

function unlockTrigger(
  quest: GroveQuestDef
): StoredTriggerDefinition | undefined {
  if (quest.start.kind !== "after") return undefined;

  const rootId = groveNativeUnlockRootId(quest.id);
  const prerequisiteChallenge = groveNativeQuestId(quest.start.questId);
  const leafId = groveNativeUnlockPrerequisiteId(quest.id, quest.start.questId);
  if (!rootId || !prerequisiteChallenge || !leafId) {
    throw new Error(
      `Missing native Grove prerequisite ${quest.id}:${quest.start.questId}`
    );
  }
  // `all` with a single child rather than a bare `challengeComplete`: the
  // manifest already pinned a separate unlock ROOT and prerequisite LEAF, and
  // collapsing them would orphan the pinned leaf id.
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
 * Givers resolve by id through the manifest, never by matching a rendered
 * NPC's display label — a label gaining a role or district suffix silently
 * orphans its giver.
 */
function questGiverEntityId(quest: GroveQuestDef): BiomesId | undefined {
  const giverId = groveQuestGiverId(quest);
  return HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[
    giverId as keyof typeof HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST
  ]?.entityId;
}

export function groveQuestBiscuit(quest: GroveQuestDef): Biscuit {
  const id = groveNativeQuestId(quest.id);
  if (!id) throw new Error(`Missing native Grove quest id ${quest.id}`);
  return {
    id,
    name: `harthmere_grove_quest_${quest.id.replace(/[^a-z0-9]+/gi, "_")}`,
    displayName: quest.title,
    displayDescription: quest.hook,
    isQuest: true,
    isSideQuest: true,
    questGiver: questGiverEntityId(quest),
    questAcceptText: quest.sampleDialogue,
    // Every Grove quest is once-only: re-teaching the HUD would be worse than
    // not offering it.
    repeatableCadence: "never",
    unlock: unlockTrigger(quest),
    trigger: questTrigger(quest),
  } as Biscuit;
}

export function allGroveNativeQuestBiscuits(): Biscuit[] {
  return GROVE_QUEST_CATALOG.map(groveQuestBiscuit);
}
