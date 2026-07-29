import type {
  QuestBundle,
  TriggerProgress,
} from "@/client/game/resources/challenges";
import type { MapMarker, MapTrackableQuest } from "../tabs/MapQuestsTab";
import { isHarthmereNativeGroveQuestId } from "@/shared/harthmere/harthmere_native_quests";
import type { NavigationAid } from "@/shared/game/types";
import type { BiomesId } from "@/shared/ids";
import { isBibleNativeQuestId } from "@/shared/harthmere/bible/bible_quest_ids";
import {
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import { nativeLegacyCombatQuestNavigationPosition } from "@/shared/harthmere/native_combat_quest_routing";

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
 * Marker id for the quest-level fallback anchor. Uses the quest id in the
 * trigger slot so `nativeQuestTrackableQuests`' `native_quest:<questId>:...`
 * parsing keeps working unchanged.
 */
function nativeQuestAnchorMarkerId(questId: number): string {
  return nativeQuestMarkerId(questId, questId);
}

/**
 * Supply navigation only where the restored world has a stable production
 * destination but the original Bikkie leaf did not author one. Every legacy
 * combat route is keyed by quest and leaf together because two original Jobs
 * Board quests reuse the same trigger id for different enemy families.
 */
export function nativeQuestInferredNavigationAidForTest(
  questId: BiomesId,
  progress: TriggerProgress
): NavigationAid | undefined {
  if (progress.navigationAid) return progress.navigationAid;
  if (
    Number(questId) === Number(NATIVE_GET_THE_MUCK_OUT_QUEST_ID) &&
    Number(progress.id) === Number(NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID)
  ) {
    return {
      kind: "position",
      pos: [...NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION],
    };
  }
  const legacyCombatPosition = nativeLegacyCombatQuestNavigationPosition({
    questId,
    triggerId: progress.id,
    progressPercentage: progress.progressPercentage,
  });
  if (legacyCombatPosition) {
    return { kind: "position", pos: [...legacyCombatPosition] };
  }
  return undefined;
}

/**
 * Find the nearest authored place associated with a location-less objective.
 * Inventory/craft leaves intentionally have no navigation aid, but they often
 * sit between two NPC steps (for example Busted asks Huck, collects Muckwad,
 * handcrafts Muck Busters, then returns to Huck). Prefer the next contact, then
 * the previous one, so the map remains useful without claiming the craft itself
 * can only happen at that NPC.
 */
export function nativeQuestLocationlessAnchorAidForTest(
  questId: BiomesId,
  progress: TriggerProgress,
  activeLeaf: TriggerProgress | undefined
): NavigationAid | undefined {
  if (!activeLeaf) return undefined;
  const leaves = nativeQuestTriggerLeaves(progress);
  const activeIndex = leaves.findIndex((leaf) => leaf.id === activeLeaf.id);
  if (activeIndex < 0) return undefined;

  const aidForLeaf = (leaf: TriggerProgress): NavigationAid | undefined => {
    const inferred = nativeQuestInferredNavigationAidForTest(questId, leaf);
    if (inferred) return inferred;
    if (
      leaf.payload.kind === "challengeClaimRewards" &&
      leaf.payload.returnQuestGiverId
    ) {
      return {
        kind: "npc",
        npcTypeId: leaf.payload.returnQuestGiverId,
      };
    }
    return undefined;
  };

  for (let distance = 0; distance < leaves.length; distance += 1) {
    const next = leaves[activeIndex + distance];
    if (next) {
      const aid = aidForLeaf(next);
      if (aid) return aid;
    }
    if (distance === 0) continue;
    const previous = leaves[activeIndex - distance];
    if (previous) {
      const aid = aidForLeaf(previous);
      if (aid) return aid;
    }
  }
  return undefined;
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
  // Bible world-trigger quests enter in_progress only after the live Bible
  // authority has validated their authored discovery gate. Treating their
  // circular self-unlock as stale here hid a legitimately accepted quest from
  // the journal even though native ECS already owned it. Keep the legacy-save
  // suppression below for other quest families that lack that server gate.
  if (isBibleNativeQuestId(quest.biscuit.id)) return false;
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

function validWorldPosition(
  pos: unknown
): [number, number, number] | undefined {
  if (
    !Array.isArray(pos) ||
    pos.length < 3 ||
    !pos.every((value) => Number.isFinite(Number(value)))
  ) {
    return undefined;
  }
  return [Number(pos[0]), Number(pos[1]), Number(pos[2])];
}

/**
 * Turns a native navigation aid into a world position.
 *
 * WHY A RESOLVER (live bug, 2026-07-26 session): only `kind: "position"` aids
 * carry coordinates. The onboarding chain almost never uses them — "Talk to
 * Jackie" is an `npc` aid, "Deliver to Doc" is an `entity` aid, and a pure
 * crafting step ("Handcraft 0/8 Muck Busters") authors no aid at all. The map
 * tab therefore produced ZERO markers for whole chapters, which is what
 * disabled Set Main / Center on Busted and made the objective marker vanish
 * whenever the player switched tracked quests.
 *
 * The in-world beacon never had this problem because `MapManager.addNavigationAid`
 * already resolves npc/entity/group/robot aids asynchronously (NPC location
 * fetch, ECS entity lookup, group AABB). The resolver injected here reads those
 * ALREADY-RESOLVED positions instead of re-implementing the lookups, so the map
 * pin and the world beacon can never point at different places.
 */
export type NativeQuestNavAidPositionResolver = (input: {
  questId: BiomesId;
  /** Trigger leaf id, or the quest id itself for the quest-level anchor. */
  triggerId: BiomesId;
  /** The authored aid, when the leaf declares one. */
  navigationAid?: NavigationAid;
  /** True for the fallback lookup made when no leaf resolved. */
  questAnchor?: boolean;
}) => readonly [number, number, number] | undefined;

function nativePosition(
  progress: TriggerProgress,
  questId: BiomesId,
  resolve?: NativeQuestNavAidPositionResolver
): [number, number, number] | undefined {
  const aid = nativeQuestInferredNavigationAidForTest(questId, progress);
  if (aid?.kind === "position") {
    const authored = validWorldPosition(aid.pos);
    if (authored) return authored;
  }
  // Every other aid kind — and a leaf with no aid at all — goes through the
  // client resolver. Passing the aid through lets it use the same npc/entity id
  // the world beacon used; passing the trigger id lets it hit the already
  // resolved `localNavigationAids` entry keyed by that same id.
  return validWorldPosition(
    resolve?.({ questId, triggerId: progress.id, navigationAid: aid })
  );
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
  nativeQuestBundles: readonly QuestBundle[] | undefined,
  resolve?: NativeQuestNavAidPositionResolver
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
    const activeLeaves = activeNativeQuestTriggerLeaves(quest.progress);
    let resolvedForQuest = 0;
    for (const leaf of activeLeaves) {
      const worldPosition = nativePosition(leaf, quest.biscuit.id, resolve);
      if (!worldPosition) {
        continue;
      }
      resolvedForQuest += 1;
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
    if (resolvedForQuest > 0) {
      continue;
    }
    // QUEST-LEVEL FALLBACK. Some authored steps genuinely have nowhere to go —
    // crafting and inventory checks complete wherever the player is standing.
    // Without an anchor those chapters had no marker at all, so the journal
    // could not be tracked, centred, or set as the main quest until the player
    // happened to reach a step with a position. Anchoring on the quest giver /
    // last known objective keeps the row actionable while still telling the
    // truth: the label carries the real current objective text.
    const anchor = validWorldPosition(
      resolve?.({
        questId: quest.biscuit.id,
        triggerId: quest.biscuit.id,
        navigationAid: nativeQuestLocationlessAnchorAidForTest(
          quest.biscuit.id,
          quest.progress,
          activeLeaves[0]
        ),
        questAnchor: true,
      })
    );
    if (!anchor) {
      continue;
    }
    const objective =
      activeLeaves[0]?.progressString || activeLeaves[0]?.name || undefined;
    markers.push({
      id: nativeQuestAnchorMarkerId(quest.biscuit.id),
      label: objective || quest.biscuit.displayName || "Quest objective",
      kind: "objective",
      active: true,
      worldPosition: anchor,
      description: objective
        ? `${objective} — no fixed location; shown at ${
            quest.biscuit.displayName ?? "the quest"
          }'s anchor.`
        : `Current objective for ${
            quest.biscuit.displayName ?? "the active quest"
          }.`,
    });
  }
  return markers;
}

export function nativeQuestTrackableQuests(
  nativeQuestBundles: readonly QuestBundle[] | undefined,
  resolve?: NativeQuestNavAidPositionResolver
): MapTrackableQuest[] {
  const markersByQuest = new Map<string, string>();
  for (const marker of nativeQuestMapMarkers(nativeQuestBundles, resolve)) {
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
          // Grove lessons are retired UI rows after completion. Main-story
          // history remains visible, so this is source-scoped rather than a
          // blanket completed-quest filter.
          !(
            quest.state === "completed" &&
            isHarthmereNativeGroveQuestId(quest.biscuit.id)
          ) &&
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
