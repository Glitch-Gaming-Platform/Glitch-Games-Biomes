// GROVE_QUEST_CATALOG
//
// Assembles the five per-arc modules into one frozen, indexed catalog.
//
// ORDER IS THE CONTRACT. Native ids are pinned by position, so the
// concatenation order below is frozen and asserted by
// `grove_quest_ids.test.ts`. Append within an arc module; never reorder.
//
// Importing THIS module pulls all 51 quests. A test that only needs one arc
// should import that arc module directly — `t.sh grove:fountain` parses 13
// rows instead of 51.

import { GROVE_QUESTS_FOUNTAIN } from "@/shared/harthmere/grove/grove_quests_fountain";
import { GROVE_QUESTS_GRADUATION } from "@/shared/harthmere/grove/grove_quests_graduation";
import { GROVE_QUESTS_NEIGHBOR } from "@/shared/harthmere/grove/grove_quests_neighbor";
import { GROVE_QUESTS_STORY } from "@/shared/harthmere/grove/grove_quests_story";
import { GROVE_QUESTS_ECONOMY } from "@/shared/harthmere/grove/grove_quests_economy";
import {
  groveQuestGiverId,
  type GroveQuestArc,
  type GroveQuestCategory,
  type GroveQuestDef,
} from "@/shared/harthmere/grove/grove_quest_schema";

export const GROVE_QUEST_CATALOG_VERSION = 1 as const;

export const GROVE_QUEST_CATALOG: readonly GroveQuestDef[] = Object.freeze([
  ...GROVE_QUESTS_FOUNTAIN,
  ...GROVE_QUESTS_GRADUATION,
  ...GROVE_QUESTS_NEIGHBOR,
  ...GROVE_QUESTS_STORY,
  ...GROVE_QUESTS_ECONOMY,
]);

export const GROVE_QUESTS_BY_ARC: Readonly<
  Record<GroveQuestArc, readonly GroveQuestDef[]>
> = Object.freeze({
  fountain: GROVE_QUESTS_FOUNTAIN,
  graduation: GROVE_QUESTS_GRADUATION,
  neighbor: GROVE_QUESTS_NEIGHBOR,
  story: GROVE_QUESTS_STORY,
  economy: GROVE_QUESTS_ECONOMY,
});

// ---------------------------------------------------------------------------
// Indexes, built once at load. Every lookup below is O(1); the retired shape
// did a linear `find` per lookup.
// ---------------------------------------------------------------------------

const indexById: ReadonlyMap<string, number> = new Map(
  GROVE_QUEST_CATALOG.map((quest, index) => [quest.id, index])
);

const byId: ReadonlyMap<string, GroveQuestDef> = new Map(
  GROVE_QUEST_CATALOG.map((quest) => [quest.id, quest])
);

export function groveQuest(questId: string): GroveQuestDef | undefined {
  return byId.get(questId);
}

/** Frozen-order position. `-1` when unknown. */
export function groveQuestIndex(questId: string): number {
  return indexById.get(questId) ?? -1;
}

export function groveQuestsByCategory(
  category: GroveQuestCategory
): readonly GroveQuestDef[] {
  return GROVE_QUEST_CATALOG.filter((quest) => quest.category === category);
}

// ---------------------------------------------------------------------------
// Fountain lessons.
//
// The graduation chain gates on how many of these the player has finished, so
// the set has to be counted identically by graduation logic, NPC offer
// ordering, browser fixtures and journal grouping. It is derived from the
// authored `countsAsFountainLesson` flag rather than reconstructed from
// optional categories — older Grove quests intentionally have no category and
// are NOT graduation prerequisites, which a category-based guess would get
// wrong.
// ---------------------------------------------------------------------------

export const GROVE_FOUNTAIN_LESSON_IDS: readonly string[] = Object.freeze(
  GROVE_QUEST_CATALOG.filter((quest) => quest.countsAsFountainLesson).map(
    (quest) => quest.id
  )
);

const fountainLessonIdSet: ReadonlySet<string> = new Set(
  GROVE_FOUNTAIN_LESSON_IDS
);

export function groveIsFountainLesson(questId: string): boolean {
  return fountainLessonIdSet.has(questId);
}

/** How many fountain lessons a completed-id set contains. */
export function groveCompletedFountainLessonCount(
  completedQuestIds: Iterable<string>
): number {
  let count = 0;
  for (const questId of completedQuestIds) {
    if (fountainLessonIdSet.has(questId)) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Giver index, derived from quest data rather than hand-written.
// ---------------------------------------------------------------------------

const questIdsByGiver: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const quest of GROVE_QUEST_CATALOG) {
    const giverId = groveQuestGiverId(quest);
    const existing = map.get(giverId);
    if (existing) existing.push(quest.id);
    else map.set(giverId, [quest.id]);
  }
  return map;
})();

export function groveQuestIdsForGiver(giverId: string): readonly string[] {
  return questIdsByGiver.get(giverId) ?? [];
}

export function groveQuestGiverIds(): readonly string[] {
  return [...questIdsByGiver.keys()];
}
