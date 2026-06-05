// HARTHMERE_QUEST_DETAIL_TOOL_SOURCE_V151
//
// Pure helpers (no React) for the quest detail panel's "where to get the tool"
// callout, so they can be unit-tested without importing the MapQuestsTab React
// module. Given a trackable quest, resolve the candidate map-marker ids that
// "Locate tool shop on map" should try, in priority order.

import type { MapTrackableQuest } from "./MapQuestsTab";

export const JOBS_BOARD_QUEST_ID_PREFIX_V1 = "jobs_board:";
export const JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX_V1 =
  "jobs_board_tool_source:";

// The marker ids the detail's locate button should try, most-specific first:
//  1. the per-todo tool-source landmark (matches the pin emitted on the maps),
//  2. the vendor owner marker id (a stable fallback that always resolves).
export function questDetailToolShopMarkerCandidatesV1(
  quest: Pick<MapTrackableQuest, "questId" | "toolSource">
): string[] {
  const candidates: string[] = [];
  if (quest.questId.startsWith(JOBS_BOARD_QUEST_ID_PREFIX_V1)) {
    const todoId = quest.questId.slice(JOBS_BOARD_QUEST_ID_PREFIX_V1.length);
    candidates.push(`${JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX_V1}${todoId}`);
  }
  if (quest.toolSource?.vendorMarkerId) {
    candidates.push(quest.toolSource.vendorMarkerId);
  }
  return candidates;
}
