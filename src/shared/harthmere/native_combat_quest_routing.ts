import type { BiomesId } from "@/shared/ids";

/**
 * Restored-world routing for original Biomes combat leaves.
 *
 * The May 2026 quest biscuits exact-match NPC type ids that are no longer
 * materialized by the restored Harthmere seed.  Compatibility is deliberately
 * keyed by BOTH quest id and trigger id: Seedy Sappers and Combat · Juggment
 * Day share trigger id 8176836229585103 even though they require different
 * enemies.  A trigger-id-only alias would therefore make either quest count
 * the other quest's kills.
 *
 * Dungeon fights are intentionally absent.  Those encounters are linear and
 * route the player through their own scoped dungeon objective system.
 */
export const NATIVE_LEGACY_COMBAT_QUEST_IDS = Object.freeze({
  NUTHIN_TO_MUCK_WITH: 4595594203188592 as BiomesId,
  SEEDY_SAPPERS: 7039135520414527 as BiomesId,
  JUGGEMENT_DAY: 7520814984799849 as BiomesId,
  COMBAT_JUGGMENT_DAY: 6257698449427345 as BiomesId,
});

export const NATIVE_LEGACY_COMBAT_STEP_IDS = Object.freeze({
  COBBLED_MUCKLING: 3116790010660689 as BiomesId,
  // This id is shared by two different quests. Never route it without questId.
  SHARED_BOARD_COMBAT: 8176836229585103 as BiomesId,
  EIGHT_JUGGERMUCKERS: 3448935220728077 as BiomesId,
});

export const NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS = Object.freeze({
  COBBLED_MUCKLING: 8997551883502319 as BiomesId,
  SEEDY_MUCKLING: 8997551883502313 as BiomesId,
  JUGGERMUCKER: 2992752380341668 as BiomesId,
});

export const NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS = Object.freeze({
  // Gravewood Pale Mucklings render with the stone/cobbled Mucker asset.
  COBBLED_MUCKLING: 8722418610125863 as BiomesId,
  // Road Pack Mucklings render with the seedy Muckling asset.
  SEEDY_MUCKLING: 8722087466111628 as BiomesId,
  // West Breach Mucklings render with the Jugger Mucker asset.
  JUGGERMUCKER: 8700372047004309 as BiomesId,
});

// HARTHMERE_MUCK_PACK_RELOCATION (2026-07-28): every position here had to move,
// because they were all coordinates produced by the OLD map-wide Muck pooling —
// which is exactly why two of them pointed at the same over-crowded Watchtower /
// Old Wood columns. Now that each family sits in its own territory, these are
// real occupied columns inside the family's own Muck zone. Regenerate them with
// `native_combat_quest_routing.test.ts`, which asserts the live population at
// each one.
export const NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS = Object.freeze({
  // Gravewood Pale Muckling pack, in the Gravewood Pale Muck. All 15 sit within
  // 60 blocks of this column.
  COBBLED_PACK: [645.927, 46, 129.231] as const,
  // Exactly four live Road Pack Mucklings occupy this roadside group.
  SEEDY_PACK: [781.227, 65, -180.855] as const,
  // North end of the West Muck Breach: 13 Jugger-visual West Breach Mucklings
  // within 40 blocks, so the eight-kill contract is satisfiable from here alone.
  JUGGER_PACK_FOUR_NORTH: [233.259, 30, -515.621] as const,
  // South end of the same breach. Kept as a second marker so a player who has
  // already cleared the north column is pointed somewhere they have not been,
  // rather than at ground they just emptied.
  JUGGER_PACK_FOUR_SOUTH: [246.695, 28, -547.977] as const,
  // Compact three-pack used by the one-kill Jobs Board contract. This is the
  // guarded West Breach Low Shelf pocket, which keeps its authored local layout
  // and is therefore unaffected by the relocation.
  JUGGER_PACK_THREE: [204.94, 53, -518.17] as const,
});

interface NativeLegacyCombatQuestRoute {
  questId: BiomesId;
  triggerId: BiomesId;
  legacyNpcTypeId: BiomesId;
  compatibleNpcTypeIds: readonly BiomesId[];
  positions: readonly (readonly [number, number, number])[];
  /** Switch to the next pack when authoritative leaf progress reaches this. */
  nextPositionAtProgress?: number;
}

const ROUTES: readonly NativeLegacyCombatQuestRoute[] = [
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.NUTHIN_TO_MUCK_WITH,
    triggerId: NATIVE_LEGACY_COMBAT_STEP_IDS.COBBLED_MUCKLING,
    legacyNpcTypeId: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
    compatibleNpcTypeIds: [
      NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
    ],
    positions: [NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.COBBLED_PACK],
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.SEEDY_SAPPERS,
    triggerId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
    legacyNpcTypeId: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING,
    compatibleNpcTypeIds: [NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING],
    positions: [NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.SEEDY_PACK],
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.JUGGEMENT_DAY,
    triggerId: NATIVE_LEGACY_COMBAT_STEP_IDS.EIGHT_JUGGERMUCKERS,
    legacyNpcTypeId: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
    compatibleNpcTypeIds: [NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER],
    positions: [
      NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_NORTH,
      NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_SOUTH,
    ],
    // The first pack contains four of the required eight enemies. Once those
    // kills are authoritative, point at the remaining four instead of leaving
    // the player at an exhausted marker.
    nextPositionAtProgress: 4 / 8,
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.COMBAT_JUGGMENT_DAY,
    triggerId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
    legacyNpcTypeId: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
    compatibleNpcTypeIds: [NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER],
    positions: [NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_THREE],
  },
];

function routeFor(questId: unknown, triggerId: unknown) {
  return ROUTES.find(
    (route) =>
      Number(route.questId) === Number(questId) &&
      Number(route.triggerId) === Number(triggerId)
  );
}

export function nativeLegacyCombatQuestNavigationPosition(input: {
  questId: BiomesId;
  triggerId: BiomesId;
  progressPercentage?: number;
}): readonly [number, number, number] | undefined {
  const route = routeFor(input.questId, input.triggerId);
  if (!route) return undefined;
  const useNextPosition =
    route.positions.length > 1 &&
    route.nextPositionAtProgress !== undefined &&
    Number(input.progressPercentage ?? 0) >= route.nextPositionAtProgress;
  return route.positions[useNextPosition ? 1 : 0];
}

/**
 * Return the legacy type that the unchanged Bikkie predicate expects when a
 * restored NPC is a valid target for this exact quest leaf.
 */
export function nativeLegacyCombatQuestCanonicalNpcTypeId(input: {
  questId: BiomesId;
  triggerId: BiomesId;
  npcTypeId: BiomesId;
}): BiomesId | undefined {
  const route = routeFor(input.questId, input.triggerId);
  if (!route) return undefined;
  return route.compatibleNpcTypeIds.some(
    (candidate) => Number(candidate) === Number(input.npcTypeId)
  )
    ? route.legacyNpcTypeId
    : undefined;
}

export function nativeLegacyCombatQuestRoutesForTest() {
  return ROUTES;
}
