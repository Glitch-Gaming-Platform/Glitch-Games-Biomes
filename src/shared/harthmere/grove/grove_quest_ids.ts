// GROVE_QUEST_IDS
//
// Native identity for Grove quests: Chapter 1's derived-from-frozen-order
// scheme, with a pin table for every id that has already been issued to a
// live player.
//
// THE RULE
//   * A quest present in `GROVE_QUEST_ID_PINS` keeps its pinned id, forever.
//   * A quest added after this migration derives its id from array index.
//   * Reordering the frozen arrays is a migration, not an edit, and
//     `grove_quest_ids.test.ts` fails on it.
//
// Chapter 1 could derive freely because it shipped that way. Grove could not:
// 85 quest ids and 451 trigger nodes are already written into live
// `Challenges` and `TriggerState`. Deriving over them would orphan every
// in-flight player — the failure `harthmere_native_quest_manifest.ts` warns
// about in its own header.
//
// See docs/harthmere/GROVE_TO_CH1_MIGRATION.md section 9.2.

import type { BiomesId } from "@/shared/ids";
import {
  GROVE_QUEST_ID_PINS,
  GROVE_STEP_ID_PINS,
} from "@/shared/harthmere/grove/grove_quest_id_pins";
import {
  GROVE_QUEST_CATALOG,
  groveQuestIndex,
} from "@/shared/harthmere/grove/grove_quest_catalog";
import type { GroveQuestDef } from "@/shared/harthmere/grove/grove_quest_schema";

export const GROVE_QUEST_IDS_VERSION = 1 as const;

/**
 * Derived-id bands for quests added AFTER the migration.
 *
 * Chosen to sit clear of every existing band so a stray id is attributable on
 * sight rather than by grepping:
 *   8_760_* / 8_761_*  Grove + pinned Grove (harthmere_native_quest_manifest)
 *   8_762_*            Chapter 1 (ch1_native_quests)
 *   8_763_*            Grove, derived (this file)
 * `grove_quest_ids.test.ts` asserts the bands stay disjoint.
 */
export const GROVE_DERIVED_QUEST_ID_BASE = 8_764_000_000_000_000;
export const GROVE_DERIVED_STEP_ID_BASE = 8_764_100_000_000_000;

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
export const GROVE_STEP_IDS_PER_QUEST = 100;
const UNLOCK_ROOT_OFFSET = 98;

function id(value: number): BiomesId {
  return value as BiomesId;
}

// ---------------------------------------------------------------------------
// Quest ids.
// ---------------------------------------------------------------------------

export function groveNativeQuestId(questId: string): BiomesId | undefined {
  const pinned = GROVE_QUEST_ID_PINS[questId];
  if (pinned !== undefined) return id(pinned);
  const index = groveQuestIndex(questId);
  return index < 0
    ? undefined
    : id(GROVE_DERIVED_QUEST_ID_BASE + index);
}

/** Reverse lookup. Used by the migration reader and by E2E report parsing. */
const questIdByNativeId: Map<number, string> = (() => {
  const map = new Map<number, string>();
  for (const quest of GROVE_QUEST_CATALOG) {
    const native = groveNativeQuestId(quest.id);
    if (native !== undefined) map.set(Number(native), quest.id);
  }
  return map;
})();

export function groveQuestIdForNativeId(value: unknown): string | undefined {
  return questIdByNativeId.get(Number(value));
}

export function isGroveNativeQuestId(value: unknown): boolean {
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
  const pinned = GROVE_STEP_ID_PINS[key];
  if (pinned !== undefined) return id(pinned);
  const index = groveQuestIndex(questId);
  return index < 0 ? undefined : id(derive(index));
}

function blockBase(questIndex: number): number {
  return GROVE_DERIVED_STEP_ID_BASE + questIndex * GROVE_STEP_IDS_PER_QUEST;
}

export function groveNativeQuestRootId(questId: string): BiomesId | undefined {
  return pinnedOrDerived(`${questId}:root`, blockBase, questId);
}

export function groveNativeStepId(
  questId: string,
  stepIdOrIndex: string | number
): BiomesId | undefined {
  const quest = GROVE_QUEST_CATALOG[groveQuestIndex(questId)] as
    | GroveQuestDef
    | undefined;
  if (!quest) return undefined;
  const stepIndex =
    typeof stepIdOrIndex === "number"
      ? stepIdOrIndex
      : quest.steps.findIndex((step) => step.id === stepIdOrIndex);
  if (stepIndex < 0 || stepIndex >= UNLOCK_ROOT_OFFSET - 1) return undefined;
  const step = quest.steps[stepIndex];
  if (!step) return undefined;
  // Grove step pins are keyed BY INDEX, because the retired shape had no
  // per-objective ids — objectives were bare strings in a positional array.
  return pinnedOrDerived(
    `${questId}:objective:${stepIndex}`,
    (questIndex) => blockBase(questIndex) + stepIndex + 1,
    questId
  );
}

export function groveNativeUnlockRootId(
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
export function groveNativeUnlockPrerequisiteId(
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
export function groveNativeStepIds(quest: GroveQuestDef): BiomesId[] {
  return quest.steps.map((step, index) => {
    const stepId = groveNativeStepId(quest.id, index);
    if (stepId === undefined) {
      throw new Error(`Missing native Grove step id ${quest.id}:${step.id}`);
    }
    return stepId;
  });
}
