// BIBLE_QUEST_CATALOG
//
// Assembles the four per-arc modules into one frozen, indexed catalog.
//
// ORDER IS THE CONTRACT. Native ids derive from array index for anything not
// in the pin table, so the concatenation order below is frozen and asserted by
// `bible_quest_ids.test.ts`. Append within an arc module; never reorder.
//
// Importing THIS module pulls all 85 quests. A test that only needs one arc
// should import that arc module directly — `t.sh bible:main` parses 13 rows
// instead of 85, which is the whole point of the split (TESTING_FASTER 1.1).

import { BIBLE_QUESTS_MAIN } from "@/shared/harthmere/bible/bible_quests_main";
import { BIBLE_QUESTS_SIDE } from "@/shared/harthmere/bible/bible_quests_side";
import { BIBLE_QUESTS_STARTER } from "@/shared/harthmere/bible/bible_quests_starter";
import { BIBLE_QUESTS_REPEATABLE } from "@/shared/harthmere/bible/bible_quests_repeatable";
import type {
  BibleQuestArc,
  BibleQuestCategory,
  BibleQuestDef,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_QUEST_CATALOG_VERSION = 1 as const;

export const BIBLE_QUEST_CATALOG: readonly BibleQuestDef[] = Object.freeze([
  ...BIBLE_QUESTS_MAIN,
  ...BIBLE_QUESTS_SIDE,
  ...BIBLE_QUESTS_STARTER,
  ...BIBLE_QUESTS_REPEATABLE,
]);

export const BIBLE_QUESTS_BY_ARC: Readonly<
  Record<BibleQuestArc, readonly BibleQuestDef[]>
> = Object.freeze({
  main: BIBLE_QUESTS_MAIN,
  side: BIBLE_QUESTS_SIDE,
  starter: BIBLE_QUESTS_STARTER,
  repeatable: BIBLE_QUESTS_REPEATABLE,
});

// ---------------------------------------------------------------------------
// Indexes. Built once at module load; every lookup below is O(1).
//
// The retired catalog did a linear `find` per lookup, which the per-state and
// grounded-check suites called tens of thousands of times.
// ---------------------------------------------------------------------------

const indexById: ReadonlyMap<string, number> = new Map(
  BIBLE_QUEST_CATALOG.map((quest, index) => [quest.id, index])
);

const byId: ReadonlyMap<string, BibleQuestDef> = new Map(
  BIBLE_QUEST_CATALOG.map((quest) => [quest.id, quest])
);

export function bibleQuest(questId: string): BibleQuestDef | undefined {
  return byId.get(questId);
}

/** Frozen-order position. `-1` when unknown. Drives derived id allocation. */
export function bibleQuestIndex(questId: string): number {
  return indexById.get(questId) ?? -1;
}

export function bibleQuestsByCategory(
  category: BibleQuestCategory
): readonly BibleQuestDef[] {
  return BIBLE_QUEST_CATALOG.filter((quest) => quest.category === category);
}

// ---------------------------------------------------------------------------
// Giver index.
//
// Derived from quest data, never hand-written. The retired
// `HARTHMERE_QUEST_DIALOGUE_LINKS` mapped 8 of 21 givers by hand and silently
// orphaned the other 13 — a gap found by code review, not by any test.
//
// `starter` quests are excluded on purpose: they were mirrored into the
// always-playable client quest list under kebab-case ids long before the Bible
// catalog was wired, and the client twins own that dialogue surface. Offering
// both copies double-lists them and completing one would not complete the
// other. See `bibleStarterTwinClientId`.
// ---------------------------------------------------------------------------

const questIdsByGiver: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const quest of BIBLE_QUEST_CATALOG) {
    if (quest.hidden || quest.category === "starter") continue;
    const giverId =
      quest.start.kind === "giver"
        ? quest.start.giverId
        : quest.start.kind === "after"
        ? quest.start.giverId
        : undefined;
    if (!giverId) continue;
    const existing = map.get(giverId);
    if (existing) existing.push(quest.id);
    else map.set(giverId, [quest.id]);
  }
  return map;
})();

export function bibleQuestIdsForGiver(giverId: string): readonly string[] {
  return questIdsByGiver.get(giverId) ?? [];
}

export function bibleQuestGiverIds(): readonly string[] {
  return [...questIdsByGiver.keys()];
}

// ---------------------------------------------------------------------------
// Starter twins.
//
// `starter_welcome_to_harthmere` (Bible) and `welcome-to-harthmere` (client)
// are the same quest to a player. Prerequisite evaluation must accept either,
// or a Bible quest gated on a starter would stay locked for every player who
// finished the client copy — which is all of them.
// ---------------------------------------------------------------------------

export function bibleStarterTwinClientId(questId: string): string | undefined {
  if (!questId.startsWith("starter_")) return undefined;
  return questId.replace(/^starter_/, "").replace(/_/g, "-");
}

export const BIBLE_STARTER_TWIN_CLIENT_IDS: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      bibleQuestsByCategory("starter").flatMap((quest) => {
        const twin = bibleStarterTwinClientId(quest.id);
        return twin ? [[quest.id, twin] as const] : [];
      })
    )
  );

/**
 * Fold a completed-quest key set (which mixes client ids, jobs-board ids,
 * helper ids and Bible ids) into the Bible id space used by prerequisites.
 */
export function bibleCompletedQuestIds(
  completed: Iterable<string> | undefined
): ReadonlySet<string> {
  const twinToBible = new Map(
    Object.entries(BIBLE_STARTER_TWIN_CLIENT_IDS).map(
      ([bibleId, clientId]) => [clientId, bibleId] as const
    )
  );
  const ids = new Set<string>();
  for (const key of completed ?? []) {
    ids.add(key);
    const twin = twinToBible.get(key);
    if (twin) ids.add(twin);
  }
  return ids;
}
