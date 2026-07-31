// SNAPSHOT_GROVE_LIGHTWEIGHT_IDS
//
// Browser-safe Grove identity and elevation constants. Keep these independent
// from the full lore/quest/building catalogue so small client tools (cutscene
// preview, capture, map probes) do not initialize terrain asset definitions.

import type { BiomesId } from "@/shared/ids";

export const SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE =
  8_810_000_000_010_000 as BiomesId;
export const SNAPSHOT_GROVE_NPC_ID_OFFSET_BASE = 9300;
export const SNAPSHOT_GROVE_JACKIE_ID_OFFSET = 9301;
export const SNAPSHOT_GROVE_JACKIE_ENTITY_ID = (Number(
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE
) + SNAPSHOT_GROVE_JACKIE_ID_OFFSET) as BiomesId;

/**
 * Raw May-snapshot entities replaced by the canonical Grove seed identities.
 * These ids are cleanup inputs only. Runtime quests, map markers and dialogue
 * must use the canonical ids above/from `snapshotGroveNpcEntityId`.
 */
export const SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS = Object.freeze({
  jackie: 8997551883502307 as BiomesId,
  ranger_jane: 2992752380341650 as BiomesId,
  luis: 8997551883502325 as BiomesId,
  taye: 2992752380341665 as BiomesId,
  rosalyn: 8543436336994986 as BiomesId,
});

export const SNAPSHOT_GROVE_CANONICAL_REPLACEMENT_ENTITY_IDS = Object.freeze({
  jackie: SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  ranger_jane: (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + 9303) as BiomesId,
  luis: (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + 9304) as BiomesId,
  taye: (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + 9305) as BiomesId,
  rosalyn: (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + 9314) as BiomesId,
});

const LEGACY_TO_CANONICAL_GROVE_NPC_ID = new Map<BiomesId, BiomesId>(
  Object.keys(SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS).map((key) => [
    SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS[
      key as keyof typeof SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS
    ],
    SNAPSHOT_GROVE_CANONICAL_REPLACEMENT_ENTITY_IDS[
      key as keyof typeof SNAPSHOT_GROVE_CANONICAL_REPLACEMENT_ENTITY_IDS
    ],
  ])
);

const CANONICAL_TO_LEGACY_GROVE_NPC_ID = new Map<BiomesId, BiomesId>(
  [...LEGACY_TO_CANONICAL_GROVE_NPC_ID].map(([legacy, canonical]) => [
    canonical,
    legacy,
  ])
);

export function canonicalSnapshotGroveNpcEntityId(id: BiomesId): BiomesId {
  return LEGACY_TO_CANONICAL_GROVE_NPC_ID.get(id) ?? id;
}

export function snapshotGroveNpcEntityIdsEquivalent(
  first: BiomesId,
  second: BiomesId
) {
  return (
    canonicalSnapshotGroveNpcEntityId(first) ===
    canonicalSnapshotGroveNpcEntityId(second)
  );
}

/**
 * Voice recordings are content-addressed partly by their historical runtime
 * actor key. Keep that stable while gameplay, map and quest references move to
 * the canonical seeded entity, so reviewed snapshot recordings remain usable.
 */
export function snapshotGroveNpcStableVoiceEntityId(id: BiomesId): BiomesId {
  return CANONICAL_TO_LEGACY_GROVE_NPC_ID.get(id) ?? id;
}

/**
 * The Mucked Robot. Chapter 1 promotes this exact entity into AUGUR-9 rather
 * than seeding a second robot beside it, so the id is published here where a
 * lightweight consumer can reach it without importing the Grove catalogue.
 * snapshot_grove_content.test.ts asserts the offset still matches the entry.
 */
export const SNAPSHOT_GROVE_MUCKED_ROBOT_ID_OFFSET = 9312;
export const SNAPSHOT_GROVE_MUCKED_ROBOT_ENTITY_ID = (Number(
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE
) + SNAPSHOT_GROVE_MUCKED_ROBOT_ID_OFFSET) as BiomesId;

export const SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y = 69;
export const SNAPSHOT_GROVE_LIVE_NPC_FEET_Y =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y + 1;
export const SNAPSHOT_GROVE_LIVE_MARKER_Y =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y + 2;
