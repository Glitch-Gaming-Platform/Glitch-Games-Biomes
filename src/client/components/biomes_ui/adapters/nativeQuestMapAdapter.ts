import type {
  QuestBundle,
  TriggerProgress,
} from "@/client/game/resources/challenges";
import type { MapMarker, MapTrackableQuest } from "../tabs/MapQuestsTab";

/**
 * A native challenge is complete only after the server-authored trigger tree
 * reports 100% progress.  Keeping this test in one place avoids subtle client
 * disagreements such as treating a rounded 99.9% value as complete.
 */
function nativeTriggerComplete(progress: TriggerProgress): boolean {
  return Number(progress.progressPercentage) >= 1;
}

/**
 * Return every leaf in authored order.  This order is important for `seq`
 * triggers: completed, current, and upcoming rows must match the order in the
 * Bikkie quest rather than an independently maintained UI list.
 */
export function nativeQuestTriggerLeaves(
  progress: TriggerProgress | undefined
): TriggerProgress[] {
  if (!progress) {
    return [];
  }
  if (!progress.children?.length) {
    return [progress];
  }
  return progress.children.flatMap(nativeQuestTriggerLeaves);
}

/**
 * Mirror the native challenge engine's active-leaf semantics.
 *
 * - `seq` exposes only the first incomplete branch.
 * - `all` and `any` expose every currently incomplete branch.
 * - a leaf is active until its authoritative progress reaches 100%.
 *
 * The challenge resource has already resolved `variant` nodes to the selected
 * child, so no client-side branch selection is performed here.
 */
export function activeNativeQuestTriggerLeaves(
  progress: TriggerProgress | undefined
): TriggerProgress[] {
  if (!progress || nativeTriggerComplete(progress)) {
    return [];
  }

  switch (progress.payload.kind) {
    case "seq": {
      const firstIncomplete = progress.children?.find(
        (child) => !nativeTriggerComplete(child)
      );
      return firstIncomplete
        ? activeNativeQuestTriggerLeaves(firstIncomplete)
        : [];
    }
    case "all":
    case "any":
      return (progress.children ?? []).flatMap((child) =>
        nativeTriggerComplete(child)
          ? []
          : activeNativeQuestTriggerLeaves(child)
      );
    default:
      return [progress];
  }
}

function nativeQuestStatus(
  state: QuestBundle["state"]
): MapTrackableQuest["status"] {
  switch (state) {
    case "completed":
      return "completed";
    case "in_progress":
      return "active";
    case "available":
    case "locked":
      return "available";
  }
}

function nativeQuestMarkerId(questId: number, triggerId: number): string {
  return `native_quest:${questId}:${triggerId}`;
}

/**
 * Older players may already have a giver-less hidden quest in `in_progress`
 * from before its discovery unlock was added. Suppress that stale state when
 * the biscuit explicitly says its own challenge-unlocked event is the gate.
 * New players remain locked in the trigger engine; this keeps existing saves
 * from leaking the same hidden quest back into the journal or active marker.
 */
function nativeQuestIsWaitingForDiscovery(quest: QuestBundle): boolean {
  if (quest.state !== "in_progress" || quest.biscuit.questGiver) return false;
  const unlock = quest.biscuit.unlock;
  if (unlock?.kind !== "event" || unlock.eventKind !== "challengeUnlocked") {
    return false;
  }
  return unlock.predicate?.kind === "object"
    ? unlock.predicate.fields.some(
        ([field, matcher]) =>
          field === "challenge" &&
          matcher.kind === "value" &&
          matcher.value === quest.biscuit.id
      )
    : false;
}

function nativePosition(
  progress: TriggerProgress
): [number, number, number] | undefined {
  const aid = progress.navigationAid;
  if (aid?.kind !== "position") {
    return undefined;
  }
  const pos = aid.pos;
  if (
    !Array.isArray(pos) ||
    pos.length < 3 ||
    !pos.every((value) => Number.isFinite(Number(value)))
  ) {
    return undefined;
  }
  return [Number(pos[0]), Number(pos[1]), Number(pos[2])];
}

export interface NativeQuestMissionStep {
  id: string;
  title: string;
  objective: string;
  done: boolean;
}

/**
 * Build journal rows directly from the native trigger tree.  In particular,
 * item/equipment objectives retain the exact item IDs and progress calculated
 * by the authoritative challenge engine; the UI never invents a completion
 * token or marks a step complete from a button click.
 */
export function nativeQuestMissionSteps(
  quest: QuestBundle | undefined
): NativeQuestMissionStep[] {
  if (!quest?.progress) {
    return [];
  }
  const leaves = nativeQuestTriggerLeaves(quest.progress);
  const activeIds = new Set(
    activeNativeQuestTriggerLeaves(quest.progress).map((leaf) => leaf.id)
  );
  return leaves.map((leaf, index) => {
    const done = nativeTriggerComplete(leaf);
    return {
      id: `${quest.biscuit.id}:${leaf.id}`,
      title: done
        ? `Completed step ${index + 1}`
        : activeIds.has(leaf.id)
        ? `Current step ${index + 1}`
        : `Upcoming step ${index + 1}`,
      objective:
        leaf.progressString ||
        leaf.name ||
        leaf.description ||
        "Continue the quest.",
      done,
    };
  });
}

export function activeNativeQuest(
  nativeQuestBundles: readonly QuestBundle[] | undefined
): QuestBundle | undefined {
  const active = (nativeQuestBundles ?? []).filter(
    (quest) =>
      quest.state === "in_progress" && !nativeQuestIsWaitingForDiscovery(quest)
  );
  // Preserve the original game's main-story priority when several challenges
  // are active, while retaining stable ECS order within each category.
  return (
    active.find((quest) => quest.biscuit.questCategory === "main") ?? active[0]
  );
}

export function nativeQuestMapMarkers(
  nativeQuestBundles: readonly QuestBundle[] | undefined
): Array<Omit<MapMarker, "x" | "y">> {
  const markers: Array<Omit<MapMarker, "x" | "y">> = [];
  for (const quest of nativeQuestBundles ?? []) {
    if (
      quest.state !== "in_progress" ||
      nativeQuestIsWaitingForDiscovery(quest) ||
      !quest.progress
    ) {
      continue;
    }
    for (const leaf of activeNativeQuestTriggerLeaves(quest.progress)) {
      const worldPosition = nativePosition(leaf);
      if (!worldPosition) {
        continue;
      }
      markers.push({
        id: nativeQuestMarkerId(quest.biscuit.id, leaf.id),
        label:
          leaf.progressString ||
          leaf.name ||
          quest.biscuit.displayName ||
          "Quest objective",
        kind: "objective",
        active: true,
        worldPosition,
        description:
          leaf.description ||
          `Current objective for ${
            quest.biscuit.displayName ?? "the active quest"
          }.`,
      });
    }
  }
  return markers;
}

export function nativeQuestTrackableQuests(
  nativeQuestBundles: readonly QuestBundle[] | undefined
): MapTrackableQuest[] {
  const markersByQuest = new Map<string, string>();
  for (const marker of nativeQuestMapMarkers(nativeQuestBundles)) {
    const [, questId] = marker.id.split(":");
    if (questId && !markersByQuest.has(questId)) {
      markersByQuest.set(questId, marker.id);
    }
  }

  return (
    (nativeQuestBundles ?? [])
      // The journal is a record of accepted work, not the global quest catalog.
      // Available offers remain discoverable at their NPC/board/beacon and enter
      // this list only after the native challenge state becomes in_progress.
      .filter(
        (quest) =>
          (quest.state === "in_progress" || quest.state === "completed") &&
          !nativeQuestIsWaitingForDiscovery(quest)
      )
      .map((quest) => {
        const steps = nativeQuestMissionSteps(quest);
        const current = steps.find((step) => !step.done);
        const category = quest.biscuit.questCategory ?? "discover";
        return {
          questId: String(quest.biscuit.id),
          title: quest.biscuit.displayName ?? `Quest ${quest.biscuit.id}`,
          area: "Biomes",
          status: nativeQuestStatus(quest.state),
          firstMarkerId: markersByQuest.get(String(quest.biscuit.id)),
          kind: `native_ecs_${category}`,
          kindLabel:
            category === "main"
              ? "Story Quest"
              : `${category.charAt(0).toUpperCase()}${category.slice(1)} Quest`,
          objective: current?.objective ?? steps.at(-1)?.objective,
          objectives: steps.map((step) => step.objective),
          description:
            quest.biscuit.description ||
            "Server-authored Biomes quest. Progress is read from the native ECS trigger tree.",
        } satisfies MapTrackableQuest;
      })
  );
}
