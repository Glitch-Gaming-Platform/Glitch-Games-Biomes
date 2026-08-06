import type { MapTrackableQuest } from "@/client/components/biomes_ui/tabs/MapQuestsTab";
import { HARTHMERE_NATIVE_QUEST_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";

const nativeIdByAuthoredQuestId = new Map<string, string>();
for (const [authoredKey, nativeId] of Object.entries(
  HARTHMERE_NATIVE_QUEST_ID_MANIFEST
)) {
  nativeIdByAuthoredQuestId.set(authoredKey, String(nativeId));
}

function authoritativeQuestId(quest: MapTrackableQuest) {
  if (/^\d+$/.test(quest.questId)) {
    return quest.questId;
  }
  for (const source of ["bible", "grove"] as const) {
    const nativeId = nativeIdByAuthoredQuestId.get(
      `${source}:${quest.questId}`
    );
    if (nativeId) return nativeId;
  }
  return undefined;
}

function liveHelperProjectionKey(quest: MapTrackableQuest) {
  const match = /^live-helper:[^:]+:(exotic_matter|food_water|hard_boss)$/.exec(
    quest.questId
  );
  return match?.[1];
}

function projectionPriority(quest: MapTrackableQuest) {
  if (String(quest.kind ?? "").startsWith("native_ecs_")) return 100;
  if (quest.status === "active") return 50;
  if (quest.status === "completed") return 25;
  return 0;
}

/**
 * Collapse native and compatibility projections of the same authored quest by
 * the stable native manifest identity. Native ECS wins because its trigger
 * tree is authoritative; legacy rows remain only for quests with no native ID.
 */
export function dedupeTrackableQuestProjections(
  quests: readonly MapTrackableQuest[]
) {
  const output: MapTrackableQuest[] = [];
  const indexByKey = new Map<string, number>();
  for (const quest of quests) {
    const authorityId = authoritativeQuestId(quest);
    const helperKind = liveHelperProjectionKey(quest);
    const key = authorityId
      ? `native:${authorityId}`
      : helperKind
        ? `live-helper-kind:${helperKind}`
        : `projection:${quest.kind ?? "unknown"}:${quest.questId}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, output.length);
      output.push(quest);
      continue;
    }
    if (projectionPriority(quest) > projectionPriority(output[existingIndex])) {
      output[existingIndex] = quest;
    }
  }
  return output;
}
