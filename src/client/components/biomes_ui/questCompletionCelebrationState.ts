export const HARTHMERE_QUEST_COMPLETED_EVENT =
  "biomes:harthmere-quest-completed" as const;

export interface HarthmereQuestCompletionCelebrationDetail {
  id: string;
  title: string;
  rewards?: readonly string[];
}

export function playerReadableQuestRewardItemName(itemId: string) {
  return (
    itemId
      .trim()
      .replace(/^(?:b:)?\d+$/, "Item")
      .replace(/^item_/, "")
      .replace(/^ch1_/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Item"
  );
}

export function announceHarthmereQuestCompletion(
  detail: HarthmereQuestCompletionCelebrationDetail
) {
  if (typeof window === "undefined") return;
  const title = detail.title.trim();
  if (!title) return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_QUEST_COMPLETED_EVENT, {
      detail: {
        id: detail.id,
        title,
        rewards: [...new Set((detail.rewards ?? []).map((row) => row.trim()))]
          .filter(Boolean)
          .slice(0, 4),
      } satisfies HarthmereQuestCompletionCelebrationDetail,
    })
  );
}
