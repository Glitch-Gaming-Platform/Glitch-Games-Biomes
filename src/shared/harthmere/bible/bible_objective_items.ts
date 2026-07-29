// BIBLE_OBJECTIVE_ITEMS
//
// Server-created proof items for objectives that describe collecting or
// recovering something.
//
// WHY THESE EXIST
// ---------------
// The authored catalog describes collection objectives in prose ("Collect six
// Bellbinder regalia pieces") without naming an item id, because the writer
// was describing a beat rather than an inventory transaction. If the objective
// completes with nothing entering the player's bag, the fiction and the
// simulation disagree: the player is told they gathered six regalia pieces and
// their inventory is empty.
//
// So the server mints ONE proof item per such objective, with a deterministic
// id derived from the quest and step. It is a keepsake, not currency: bound,
// non-tradeable, and registered as a real Bikkie definition by
// `harthmere_native_bikkie_items.ts` before the overlay, so it can never
// become a string-only Redis stack the UI cannot name.
//
// Pure and data-only, like everything else under bible/.

import type {
  BibleQuestDef,
  BibleQuestStep,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_OBJECTIVE_ITEMS_VERSION = 1 as const;

/**
 * Verbs that mean "something ends up in the player's hands".
 *
 * Deliberately narrow. "Inspect the bridge crack pattern" and "Listen at the
 * Old Well" are also `inspect` steps and must NOT mint an item — the authored
 * verb is the only signal that distinguishes them, since the step `type` field
 * does not.
 */
const COLLECTION_VERBS = [
  "collect",
  "gather",
  "recover",
  "retrieve",
  "claim",
  "fetch",
] as const;

/** Number words the catalog actually uses, plus digits. */
const NUMBER_WORDS: Readonly<Record<string, number>> = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
});

function leadingVerb(label: string): string | undefined {
  const first = label.trim().split(/\s+/)[0]?.toLowerCase();
  return first && COLLECTION_VERBS.includes(first as any) ? first : undefined;
}

/** True when the authored label describes picking something up. */
export function bibleStepCollectsItem(step: BibleQuestStep): boolean {
  return leadingVerb(step.label) !== undefined;
}

/**
 * How many the label asks for.
 *
 * The authored `count` field is 1 on every row — it counts SUBMISSIONS, not
 * objects — so the quantity the player is promised only exists in the prose.
 * Reading it from there is what makes "Collect six regalia" grant six.
 */
export function bibleStepItemCount(step: BibleQuestStep): number {
  const digit = step.label.match(/\b(\d+)\b/);
  if (digit) {
    const parsed = Number(digit[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  for (const word of step.label.toLowerCase().split(/[^a-z]+/)) {
    const value = NUMBER_WORDS[word];
    if (value !== undefined) return value;
  }
  return 1;
}

/** Deterministic id, stable across restarts and safe to re-grant. */
export function bibleStepProofItemId(
  questId: string,
  stepId: string
): string {
  return `quest_objective_item:${questId}:${stepId}`;
}

/** The label with its leading collection verb removed, for display. */
export function bibleStepProofItemDisplayName(step: BibleQuestStep): string {
  const verb = leadingVerb(step.label);
  if (!verb) return step.label;
  return step.label.trim().slice(verb.length).trim();
}

export interface BibleObjectiveItemGrant {
  itemId: string;
  count: number;
  displayName: string;
}

/**
 * The grant for one step, or undefined when the step collects nothing.
 *
 * The reducer returns this; the backend applies it through the same signed
 * inventory transaction every other item grant uses, so this module never
 * touches inventory itself.
 */
export function bibleStepObjectiveItemGrant(
  quest: BibleQuestDef,
  step: BibleQuestStep
): BibleObjectiveItemGrant | undefined {
  if (!bibleStepCollectsItem(step)) return undefined;
  return {
    itemId: bibleStepProofItemId(quest.id, step.id),
    count: bibleStepItemCount(step),
    displayName: bibleStepProofItemDisplayName(step),
  };
}

/** Every proof item the catalog can mint. Used by the Bikkie registrar. */
export function bibleAllObjectiveItemGrants(
  catalog: readonly BibleQuestDef[]
): BibleObjectiveItemGrant[] {
  return catalog.flatMap((quest) =>
    quest.steps.flatMap((step) => {
      const grant = bibleStepObjectiveItemGrant(quest, step);
      return grant ? [grant] : [];
    })
  );
}
