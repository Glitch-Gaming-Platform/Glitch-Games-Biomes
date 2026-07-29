// BIBLE_QUEST_IDS
//
// Native identity for Bible quests: Chapter 1's derived-from-frozen-order
// scheme, with a pin table for every id that has already been issued to a
// live player.
//
// THE RULE
//   * A quest present in `BIBLE_QUEST_ID_PINS` keeps its pinned id, forever.
//   * A quest added after this migration derives its id from array index.
//   * Reordering the frozen arrays is a migration, not an edit, and
//     `bible_quest_ids.test.ts` fails on it.
//
// Chapter 1 could derive freely because it shipped that way. Bible could not:
// 85 quest ids and 451 trigger nodes are already written into live
// `Challenges` and `TriggerState`. Deriving over them would orphan every
// in-flight player — the failure `harthmere_native_quest_manifest.ts` warns
// about in its own header.
//
// See docs/harthmere/BIBLE_TO_CH1_MIGRATION.md section 9.2.

import type { BiomesId } from "@/shared/ids";
import {
  BIBLE_QUEST_ID_PINS,
  BIBLE_STEP_ID_PINS,
} from "@/shared/harthmere/bible/bible_quest_id_pins";
import {
  BIBLE_QUEST_CATALOG,
  bibleQuestIndex,
} from "@/shared/harthmere/bible/bible_quest_catalog";
import type { BibleQuestDef } from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_QUEST_IDS_VERSION = 1 as const;

/**
 * Derived-id bands for quests added AFTER the migration.
 *
 * Chosen to sit clear of every existing band so a stray id is attributable on
 * sight rather than by grepping:
 *   8_760_* / 8_761_*  Grove + pinned Bible (harthmere_native_quest_manifest)
 *   8_762_*            Chapter 1 (ch1_native_quests)
 *   8_763_*            Bible, derived (this file)
 * `bible_quest_ids.test.ts` asserts the bands stay disjoint.
 */
export const BIBLE_DERIVED_QUEST_ID_BASE = 8_763_000_000_000_000;
export const BIBLE_DERIVED_STEP_ID_BASE = 8_763_100_000_000_000;

/**
 * Ids reserved per quest, matching Chapter 1's block layout so the two systems
 * cannot drift apart:
 *   +0            seq root
 *   +1 .. +97     objective leaves
 *   +98           unlock root
 *   +99           reserved
 * The authored catalog's longest quest has 4 objectives, so 98 leaves is
 * ~24x headroom; the block exists so adding an objective never remaps a later
 * quest.
 */
export const BIBLE_STEP_IDS_PER_QUEST = 100;
const UNLOCK_ROOT_OFFSET = 98;

function id(value: number): BiomesId {
  return value as BiomesId;
}

// ---------------------------------------------------------------------------
// Quest ids.
// ---------------------------------------------------------------------------

export function bibleNativeQuestId(questId: string): BiomesId | undefined {
  const pinned = BIBLE_QUEST_ID_PINS[questId];
  if (pinned !== undefined) return id(pinned);
  const index = bibleQuestIndex(questId);
  return index < 0
    ? undefined
    : id(BIBLE_DERIVED_QUEST_ID_BASE + index);
}

/** Reverse lookup. Used by the migration reader and by E2E report parsing. */
const questIdByNativeId: Map<number, string> = (() => {
  const map = new Map<number, string>();
  for (const quest of BIBLE_QUEST_CATALOG) {
    const native = bibleNativeQuestId(quest.id);
    if (native !== undefined) map.set(Number(native), quest.id);
  }
  return map;
})();

export function bibleQuestIdForNativeId(value: unknown): string | undefined {
  return questIdByNativeId.get(Number(value));
}

export function isBibleNativeQuestId(value: unknown): boolean {
  return questIdByNativeId.has(Number(value));
}

// ---------------------------------------------------------------------------
// Trigger-node ids.
//
// Every accessor takes the semantic key the manifest already used, so a pin
// lookup and a derivation are interchangeable and the pin table needed no
// re-keying.
// ---------------------------------------------------------------------------

function pinnedOrDerived(
  key: string,
  derive: (index: number) => number,
  questId: string
): BiomesId | undefined {
  const pinned = BIBLE_STEP_ID_PINS[key];
  if (pinned !== undefined) return id(pinned);
  const index = bibleQuestIndex(questId);
  return index < 0 ? undefined : id(derive(index));
}

function blockBase(questIndex: number): number {
  return BIBLE_DERIVED_STEP_ID_BASE + questIndex * BIBLE_STEP_IDS_PER_QUEST;
}

export function bibleNativeQuestRootId(questId: string): BiomesId | undefined {
  return pinnedOrDerived(`${questId}:root`, blockBase, questId);
}

export function bibleNativeStepId(
  questId: string,
  stepIdOrIndex: string | number
): BiomesId | undefined {
  const quest = BIBLE_QUEST_CATALOG[bibleQuestIndex(questId)] as
    | BibleQuestDef
    | undefined;
  if (!quest) return undefined;
  const stepIndex =
    typeof stepIdOrIndex === "number"
      ? stepIdOrIndex
      : quest.steps.findIndex((step) => step.id === stepIdOrIndex);
  if (stepIndex < 0 || stepIndex >= UNLOCK_ROOT_OFFSET - 1) return undefined;
  const step = quest.steps[stepIndex];
  if (!step) return undefined;
  return pinnedOrDerived(
    `${questId}:objective:${step.id}`,
    (questIndex) => blockBase(questIndex) + stepIndex + 1,
    questId
  );
}

export function bibleNativeUnlockRootId(
  questId: string
): BiomesId | undefined {
  return pinnedOrDerived(
    `${questId}:unlock:root`,
    (questIndex) => blockBase(questIndex) + UNLOCK_ROOT_OFFSET,
    questId
  );
}

/**
 * The leaf inside an unlock node that names one prerequisite quest.
 *
 * Every authored quest has at most one prerequisite, so this derives to the
 * unlock root's neighbour. The key shape is retained from the manifest so a
 * future multi-prerequisite quest can pin additional leaves without a
 * re-keying migration.
 */
export function bibleNativeUnlockPrerequisiteId(
  questId: string,
  prerequisiteQuestId: string
): BiomesId | undefined {
  return pinnedOrDerived(
    `${questId}:unlock:${prerequisiteQuestId}`,
    (questIndex) => blockBase(questIndex) + UNLOCK_ROOT_OFFSET + 1,
    questId
  );
}

/** Every objective leaf id for a quest, in authored order. */
export function bibleNativeStepIds(quest: BibleQuestDef): BiomesId[] {
  return quest.steps.map((step, index) => {
    const stepId = bibleNativeStepId(quest.id, index);
    if (stepId === undefined) {
      throw new Error(`Missing native Bible step id ${quest.id}:${step.id}`);
    }
    return stepId;
  });
}
