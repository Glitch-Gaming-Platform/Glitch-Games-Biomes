import type { NativeQuestNavAidPositionResolver } from "./nativeQuestMapAdapter";
import type { QuestBundle } from "@/client/game/resources/challenges";
import type { NavigationAid as ClientNavigationAid } from "@/client/game/helpers/navigation_aids";
import type { BiomesId } from "@/shared/ids";

/**
 * NATIVE_QUEST_NAV_AID_RESOLVER
 *
 * Bridges the BiomesUI map tab to the positions MapManager has ALREADY resolved
 * for the in-world beacon.
 *
 * Why this indirection exists: only `kind: "position"` navigation aids carry
 * coordinates in the authored data. Everything else — `npc`, `entity`, `group`,
 * `robot` — is a promise that MapManager fulfils asynchronously (NPC location
 * fetch, ECS lookup, group AABB centre) and then stores in
 * `localNavigationAids`, keyed by the trigger id the side effect registered it
 * under. Re-deriving those positions here would duplicate three network paths
 * and let the map pin drift from the beacon the player is walking toward.
 *
 * Resolution order, most to least specific:
 *   1. the aid registered for this exact trigger leaf
 *   2. any aid registered for this quest (covers seq/aggregate registrations)
 *   3. the quest giver's authored beam position (pure crafting steps, which
 *      have no aid at all, still need somewhere to anchor)
 */

export interface NativeQuestNavAidResolverDeps {
  /** `MapManager.localNavigationAids` — id → resolved aid. */
  navigationAids: ReadonlyMap<number, ClientNavigationAid>;
  /** Quest bundles, used only for the quest-giver anchor lookup. */
  questBundles?: readonly QuestBundle[];
  /** `getNpcBehavior(idToNpcType(id)).questGiver?.beamPosition`, injected. */
  questGiverBeamPosition?: (
    npcTypeId: BiomesId
  ) => readonly [number, number, number] | undefined;
  /** Position of a live NPC instance already synchronized into the client. */
  npcTypePosition?: (
    npcTypeId: BiomesId
  ) => readonly [number, number, number] | undefined;
  /** Final honest fallback for objectives that can be completed anywhere. */
  fallbackPosition?: () =>
    | readonly [number, number, number]
    | undefined;
}

function finitePosition(
  pos: unknown
): readonly [number, number, number] | undefined {
  if (!Array.isArray(pos) || pos.length < 3) return undefined;
  const [x, y, z] = pos.map((value) => Number(value));
  return [x, y, z].every((value) => Number.isFinite(value))
    ? [x, y, z]
    : undefined;
}

export function nativeQuestNavAidPositionFromAidsForTest(
  deps: NativeQuestNavAidResolverDeps,
  input: {
    questId: BiomesId;
    triggerId: BiomesId;
    navigationAid?: { kind: string; npcTypeId?: BiomesId };
    questAnchor?: boolean;
  }
): readonly [number, number, number] | undefined {
  // 1. Exact leaf. MapManager keys quest aids by the trigger id that
  // NavigationAidSideEffect passed in, so this is a direct hit when the step
  // declares any aid at all.
  const exact = deps.navigationAids.get(Number(input.triggerId));
  const exactPosition = finitePosition(exact?.pos);
  if (exactPosition) return exactPosition;

  // 2. Any aid belonging to this quest. A `seq` node registers its own aid
  // alongside the active child's, and older saves can carry an aid keyed to a
  // leaf id the journal no longer surfaces. Either is still the right place to
  // send the player for THIS quest.
  for (const aid of deps.navigationAids.values()) {
    if (Number(aid.challengeId ?? 0) !== Number(input.questId)) continue;
    const position = finitePosition(aid.pos);
    if (position) return position;
  }

  // 3. Quest-giver anchor. Only for the explicit quest-level fallback: a leaf
  // must not silently claim the giver's position, or "Handcraft 8 Muck Busters"
  // would look like an objective that lives at Jackie's feet. The map layer
  // asks for this separately, and labels the resulting marker as an anchor.
  if (!input.questAnchor) {
    return undefined;
  }
  const authoredAnchor =
    input.navigationAid?.kind === "position"
      ? finitePosition((input.navigationAid as { pos?: unknown }).pos)
      : undefined;
  if (authoredAnchor) return authoredAnchor;

  const npcTypeId =
    (input.navigationAid?.kind === "npc"
      ? input.navigationAid.npcTypeId
      : undefined) ??
    deps.questBundles?.find(
      (quest) => Number(quest.biscuit.id) === Number(input.questId)
    )?.biscuit.questGiver;
  if (npcTypeId !== undefined) {
    // Most original-snapshot NPC biscuits do not carry a quest-giver beam
    // position. Prefer the synchronized ECS instance before consulting that
    // optional metadata; this is what fixes Busted's Huck crafting anchor.
    const liveNpc = finitePosition(deps.npcTypePosition?.(npcTypeId));
    if (liveNpc) return liveNpc;
    const beam = finitePosition(deps.questGiverBeamPosition?.(npcTypeId));
    if (beam) return beam;
  }
  return finitePosition(deps.fallbackPosition?.());
}

/**
 * `MapManager.localNavigationAids` is mutated in place. React therefore sees
 * the same Map identity after an async NPC/entity position resolves. This
 * compact value changes with the actual marker data and lets the map adapter
 * rebuild once instead of requiring a reload.
 */
export function nativeQuestNavigationAidsRevisionForTest(
  navigationAids: ReadonlyMap<number, ClientNavigationAid>
): string {
  return [...navigationAids.entries()]
    .map(([id, aid]) =>
      [
        id,
        aid.challengeId ?? "",
        aid.target.kind,
        ...aid.pos.map((value) => Number(value).toFixed(3)),
      ].join(":")
    )
    .join("|");
}

export function buildNativeQuestNavAidResolver(
  deps: NativeQuestNavAidResolverDeps
): NativeQuestNavAidPositionResolver {
  return (input) =>
    nativeQuestNavAidPositionFromAidsForTest(deps, {
      questId: input.questId,
      triggerId: input.triggerId,
      navigationAid: input.navigationAid as
        | { kind: string; npcTypeId?: BiomesId }
        | undefined,
      questAnchor: input.questAnchor,
    });
}
