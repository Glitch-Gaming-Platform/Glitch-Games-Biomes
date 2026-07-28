// HARTHMERE_ROAD_TO_HARTHMERE_GROUPS
//
// Four evenly spread mixed encounters along the Road to Harthmere (the map calls
// it the "Grove to Harthmere Road"; see
// `harthmereMapTerrainRegions.ts#grove_to_harthmere_connector_road`).
//
// Each group is exactly 2 Hexes, 4 Mucklings, 1 cow, 2 sheep, and 4 rabbits — 13
// creatures, 52 in total.
//
// Why this file is standalone
// ---------------------------
// It follows `bandit_production_seed.ts`: authored seed families are declared
// outside `live_entity_production_seed.ts` and imported by it, so there is no
// import cycle and so `creature_groups.ts` can read the finished seed set.
//
// Why these are NOT built from the existing mixed-group machinery
// --------------------------------------------------------------
// `HarthmereMuckMonsterSeedLayout` splits monsters with `hexEvery`, which can
// only express "every Nth is a Hex". The required 2-of-6 split is not reachable
// that way (`hexEvery: 3` would give 2 Hexes but interleaved differently, and
// nothing in that shape can express an authored composition). These layouts carry
// an explicit `composition` list instead.
//
// Grounding
// ---------
// The four anchors are measured centreline columns from the read-only production
// road planner run recorded in the July 27 2026 audit (1,362 traversable columns,
// elevation Y41..Y71, zero route-planning failures, start ~[561,70,-181], end
// ~[1792,42,-209]) taken at the 20/40/60/80% marks. They are TREATED AS
// APPROXIMATE: every creature is offset onto a road shoulder and has an exact,
// per-column feet Y sampled from the production-shaped July 27 world below. The
// general production placement map predates this seed family, so the sampled Y
// is also the safe runtime fallback until that larger generated artifact is next
// refreshed. A single shared Y across 13 creatures on a hill road would bury or
// float some of them.
//
// Travel lane
// -----------
// Groups alternate sides of the road and sit `ROAD_GROUP_SHOULDER_OFFSET` metres
// off the centreline, so a player walking the road always has a clear lane and can
// choose to engage rather than being funnelled through every pack.
//
// Difficulty ramp — and the hard balance ceiling it must respect
// --------------------------------------------------------------
// Levels rise west to east (2, 3, 4, 5) because the road runs from the Grove
// tutorial area toward Harthmere. This is the first content to use authored
// per-entity levels; see `@/shared/npc/creature_level`.
//
// The ramp stops at 5 for a measured reason. Native Harthmere damage is already
// severe: `monsterDamage()` multiplies the family base by 5, so a `combatLevel: 3`
// Hex deals ~90 into a 140 HP player. Layering the +7%/level progression
// multiplier on top of a `combatLevel: 5+` Hex produces a single hit above 140 —
// an unavoidable one-shot. `anima_hill_combat_e2e.test.ts` asserts that no road
// creature can one-shot a full-health player, and that gate is what fixes the
// ceiling here.
//
// Note the two levels are deliberately NOT the same field:
//   * `combatLevel`      selects the shared NPC type's base damage/HP curve, and
//                        stays at the ordinary family baseline (Hex 3, Muckling 2);
//   * `progressionLevel` is this entity's own progression on top of that base.
// Setting `combatLevel` from the ramp too would buff each creature twice.

import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_ROAD_TO_HARTHMERE_GROUP_VERSION =
  "harthmere-road-to-harthmere-groups-v1" as const;

/** Monster id band. Clear of Chapter 1 (10500-10599), forest wildlife
 * (10601-10635), and the scattered mixed groups (10701-10776). */
export const HARTHMERE_ROAD_GROUP_MONSTER_FIRST_OFFSET = 10801;
export const HARTHMERE_ROAD_GROUP_ANIMAL_FIRST_OFFSET = 10841;

/** Metres from the road centreline to a group's own centre. */
export const ROAD_GROUP_SHOULDER_OFFSET = 10;
/** Radius of the encounter footprint. Keeps a group readable as one pack. */
export const ROAD_GROUP_FOOTPRINT_RADIUS = 6;
/** Group leash: footprint plus engagement slack. Bounds alerts and pursuit. */
export const ROAD_GROUP_LEASH_RADIUS = 20;

export const ROAD_GROUP_MUCKLING_NAME = "Road Pack Muckling";
export const ROAD_GROUP_HEX_NAME = "Road Pack Hex";

/**
 * Shared NPC-type tier for road creatures. These match the standard authored
 * families elsewhere in the world and are NOT the road's difficulty ramp — see
 * the balance note at the top of this file.
 */
export const ROAD_GROUP_HEX_COMBAT_LEVEL = 3;
export const ROAD_GROUP_MUCKLING_COMBAT_LEVEL = 2;

export interface HarthmereRoadGroupAnchor {
  groupId: string;
  areaId: string;
  areaLabel: string;
  /** Measured road centreline column at this fraction along the route. */
  centerline: Vec3;
  /** Signed Z offset onto a shoulder; sign alternates so sides alternate. */
  shoulderOffsetZ: number;
  /** Authored creature level for every member of this group. */
  level: number;
  /** Fraction along the road, retained so the spacing stays auditable. */
  routeFraction: number;
}

export const HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS: readonly HarthmereRoadGroupAnchor[] =
  [
    {
      groupId: "road_to_harthmere_group_1",
      areaId: "road_to_harthmere_group_1",
      areaLabel: "Road to Harthmere, First Waymark",
      centerline: [784, 65, -192],
      shoulderOffsetZ: ROAD_GROUP_SHOULDER_OFFSET,
      level: 2,
      routeFraction: 0.2,
    },
    {
      groupId: "road_to_harthmere_group_2",
      areaId: "road_to_harthmere_group_2",
      areaLabel: "Road to Harthmere, Second Waymark",
      centerline: [1020, 60, -200],
      shoulderOffsetZ: -ROAD_GROUP_SHOULDER_OFFSET,
      level: 3,
      routeFraction: 0.4,
    },
    {
      groupId: "road_to_harthmere_group_3",
      areaId: "road_to_harthmere_group_3",
      areaLabel: "Road to Harthmere, Third Waymark",
      centerline: [1273, 56, -212],
      shoulderOffsetZ: ROAD_GROUP_SHOULDER_OFFSET,
      level: 4,
      routeFraction: 0.6,
    },
    {
      groupId: "road_to_harthmere_group_4",
      areaId: "road_to_harthmere_group_4",
      areaLabel: "Road to Harthmere, Fourth Waymark",
      centerline: [1538, 59, -211],
      shoulderOffsetZ: -ROAD_GROUP_SHOULDER_OFFSET,
      level: 5,
      routeFraction: 0.8,
    },
  ] as const;

/**
 * Per-member terrain feet Y values measured read-only from the warm
 * production-shaped Redis snapshot on July 27, 2026. The scanner recorded the
 * deployed production revision `biomes-node-vnet--0000199` / image
 * `prod-20260727-chapter1-final-r1` while sampling.
 *
 * Values use the standable surface nearest the authored road elevation. That is
 * deliberate: three group-one wildlife columns have tree canopies at Y72..Y76;
 * choosing the highest open-sky surface would spawn animals on top of foliage,
 * while the nearest surfaces at Y66 have support and body clearance.
 */
export const HARTHMERE_ROAD_GROUP_TERRAIN_SAMPLE = {
  sampledAtIso: "2026-07-27T17:09:24.496Z",
  productionRevision: "biomes-node-vnet--0000199",
  productionImage: "glitchgames.azurecr.io/biomes-node:prod-20260727-chapter1-final-r1",
} as const;

export const HARTHMERE_ROAD_GROUP_MONSTER_TERRAIN_FEET_Y = [
  [66, 66, 66, 66, 66, 66],
  [60, 61, 60, 61, 61, 60],
  [56, 56, 56, 56, 56, 57],
  [59, 59, 58, 59, 58, 59],
] as const;

export const HARTHMERE_ROAD_GROUP_ANIMAL_TERRAIN_FEET_Y = [
  [66, 66, 66, 66, 66, 67, 66],
  [60, 61, 60, 61, 60, 60, 61],
  [56, 56, 57, 56, 56, 57, 56],
  [59, 59, 59, 59, 58, 59, 59],
] as const;

/**
 * The authored composition of every road group, in spawn order.
 *
 * Monsters and animals are seeded from separate id bands (matching every other
 * creature family in the world), so the composition is declared once here and
 * split by kind below.
 */
export const HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION = [
  "hex",
  "muckling",
  "muckling",
  "hex",
  "muckling",
  "muckling",
] as const;

export const HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION = [
  "cow",
  "sheep",
  "sheep",
  "rabbit",
  "rabbit",
  "rabbit",
  "rabbit",
] as const;

export type HarthmereRoadGroupMonsterKind =
  (typeof HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION)[number];
export type HarthmereRoadGroupAnimalKind =
  (typeof HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION)[number];

/**
 * Structural mirror of `HarthmereLiveEntityProductionSeed`. Declared locally for
 * the same reason `bandit_production_seed.ts` does: importing the type from
 * `live_entity_production_seed.ts` (which imports THIS file) would be a cycle.
 */
export interface HarthmereRoadGroupSeed {
  seedId: string;
  kind: "ambient_muck_monster" | "ambient_livestock";
  entityId: BiomesId;
  idOffset: number;
  displayName: string;
  areaId: string;
  areaLabel: string;
  position: Vec3;
  orientation: Vec2;
  dialog: string;
  description: string;
  combatKind: "mux" | "hex";
  combatLevel: number;
  combatHp: number;
  species?: "cow" | "sheep" | "rabbit";
  sizeTier?: "small" | "medium" | "large";
  meatUnits?: number;
  attackDamage?: number;
  killXp?: number;
  /** Explicit authored group membership; consumed by `creature_groups.ts`. */
  groupId: string;
  /** Authored per-entity progression level; consumed by `creature_level.ts`. */
  progressionLevel: number;
}

function entityIdFromOffset(idOffset: number) {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

/** Group centre: the measured centreline pushed onto its shoulder. */
export function roadGroupCenter(anchor: HarthmereRoadGroupAnchor): Vec3 {
  return [
    anchor.centerline[0],
    anchor.centerline[1],
    anchor.centerline[2] + anchor.shoulderOffsetZ,
  ];
}

/**
 * Deterministic sunflower spread inside the footprint, matching
 * `guardedWildlifePosition`/`muckMonsterPositionForLayout` so road groups read the
 * same as every other authored pack. `feetY` is independently terrain-sampled
 * for each member; it is not inherited from the group anchor.
 */
export function roadGroupMemberPosition(
  anchor: HarthmereRoadGroupAnchor,
  index: number,
  count: number,
  angleSeed: number,
  feetY = anchor.centerline[1]
): Vec3 {
  const center = roadGroupCenter(anchor);
  const radius =
    ROAD_GROUP_FOOTPRINT_RADIUS * Math.sqrt((index + 0.5) / Math.max(1, count));
  const angle = index * 2.399963229728653 + angleSeed;
  return [
    Number((center[0] + Math.cos(angle) * radius).toFixed(3)),
    feetY,
    Number((center[2] + Math.sin(angle) * radius).toFixed(3)),
  ];
}

const ANIMAL_STATS: Readonly<
  Record<
    HarthmereRoadGroupAnimalKind,
    {
      displayName: string;
      sizeTier: "small" | "medium" | "large";
      combatHp: number;
      meatUnits: number;
      attackDamage: number;
      killXp: number;
      dialog: string;
    }
  >
> = {
  cow: {
    displayName: "Muckmeadow Cow",
    sizeTier: "large",
    combatHp: 270,
    meatUnits: 12,
    attackDamage: 66,
    killXp: 50,
    dialog: "<text>Moo.</text>",
  },
  sheep: {
    displayName: "Muckmeadow Sheep",
    sizeTier: "medium",
    combatHp: 110,
    meatUnits: 4,
    attackDamage: 30,
    killXp: 20,
    dialog: "<text>Baa.</text>",
  },
  rabbit: {
    displayName: "Muckmeadow Rabbit",
    sizeTier: "small",
    combatHp: 22,
    meatUnits: 1,
    attackDamage: 15,
    killXp: 5,
    dialog: "<text>*twitches its nose*</text>",
  },
};

function monsterDialog(areaLabel: string) {
  return [
    `<text>The pack shifts along the verge of ${areaLabel}.</text>`,
    "<text>It has noticed you.</text>",
  ].join("{break}");
}

export const HARTHMERE_ROAD_GROUP_MONSTER_SEEDS: HarthmereRoadGroupSeed[] =
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.flatMap((anchor, groupIndex) =>
    HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.map((kind, memberIndex) => {
      const idOffset =
        HARTHMERE_ROAD_GROUP_MONSTER_FIRST_OFFSET +
        groupIndex * HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.length +
        memberIndex;
      const isHex = kind === "hex";
      // ONE shared display name per kind across all four groups, deliberately.
      // The native NPC type key is `monster_${slug(displayName)}`, so a per-group
      // name would demand a per-group entry in HARTHMERE_NATIVE_NPC_ID_MANIFEST,
      // and a missing entry emits a biscuit with an undefined id, which fails the
      // Bikkie overlay and blocks a clean server boot.
      const baseName = isHex ? ROAD_GROUP_HEX_NAME : ROAD_GROUP_MUCKLING_NAME;
      return {
        seedId: `road-group-${anchor.groupId}-${kind}-${idOffset}`,
        kind: "ambient_muck_monster" as const,
        entityId: entityIdFromOffset(idOffset),
        idOffset,
        displayName: `${baseName} ${
          groupIndex * HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.length +
          memberIndex +
          1
        }`,
        areaId: anchor.areaId,
        areaLabel: anchor.areaLabel,
        position: roadGroupMemberPosition(
          anchor,
          memberIndex,
          HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.length,
          0.35,
          HARTHMERE_ROAD_GROUP_MONSTER_TERRAIN_FEET_Y[groupIndex][memberIndex]
        ),
        orientation: [0, 0] as Vec2,
        dialog: monsterDialog(anchor.areaLabel),
        description: `${baseName} holds the verge at ${anchor.areaLabel}.`,
        combatKind: (isHex ? "hex" : "mux") as "hex" | "mux",
        // Ordinary family baseline, matching every other authored Hex / Muckling
        // in the world. The road ramp lives in `progressionLevel`; driving both
        // from `anchor.level` would buff each creature twice and push a single
        // Hex hit past a 140 HP player's entire health bar.
        combatLevel: isHex ? ROAD_GROUP_HEX_COMBAT_LEVEL : ROAD_GROUP_MUCKLING_COMBAT_LEVEL,
        combatHp: isHex ? 120 : 110,
        groupId: anchor.groupId,
        progressionLevel: anchor.level,
      };
    })
  );

export const HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS: HarthmereRoadGroupSeed[] =
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.flatMap((anchor, groupIndex) =>
    HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.map((species, memberIndex) => {
      const idOffset =
        HARTHMERE_ROAD_GROUP_ANIMAL_FIRST_OFFSET +
        groupIndex * HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.length +
        memberIndex;
      const stats = ANIMAL_STATS[species];
      return {
        seedId: `road-group-${anchor.groupId}-${species}-${idOffset}`,
        kind: "ambient_livestock" as const,
        entityId: entityIdFromOffset(idOffset),
        idOffset,
        displayName: `Road ${stats.displayName} ${
          groupIndex * HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.length +
          memberIndex +
          1
        }`,
        areaId: anchor.areaId,
        areaLabel: anchor.areaLabel,
        position: roadGroupMemberPosition(
          anchor,
          memberIndex,
          HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.length,
          1.15,
          HARTHMERE_ROAD_GROUP_ANIMAL_TERRAIN_FEET_Y[groupIndex][memberIndex]
        ),
        orientation: [0, 0] as Vec2,
        dialog: stats.dialog,
        description: `A ${stats.displayName.toLowerCase()} grazes the verge at ${
          anchor.areaLabel
        }, watched by a nearby pack.`,
        combatKind: "mux" as const,
        // Livestock are prey, not a difficulty dial. They stay level 1 so the
        // group's authored level cannot silently turn a rabbit into a threat.
        combatLevel: 1,
        combatHp: stats.combatHp,
        species,
        sizeTier: stats.sizeTier,
        meatUnits: stats.meatUnits,
        attackDamage: stats.attackDamage,
        killXp: stats.killXp,
        groupId: anchor.groupId,
        // Livestock stay level 1 for the same reason as `combatLevel` above: a
        // level 9 rabbit is not the difficulty the road ramp is asking for.
        progressionLevel: 1,
      };
    })
  );

export const HARTHMERE_ROAD_GROUP_SEEDS: HarthmereRoadGroupSeed[] = [
  ...HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
  ...HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS,
];

export const HARTHMERE_ROAD_GROUP_AREA_IDS = new Set(
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map((anchor) => anchor.areaId)
);

export function isHarthmereRoadGroupAreaId(areaId: string): boolean {
  return HARTHMERE_ROAD_GROUP_AREA_IDS.has(areaId);
}

/** Every road-group creature, keyed by entity id. */
export function harthmereRoadGroupSeedForEntityId(
  entityId: BiomesId
): HarthmereRoadGroupSeed | undefined {
  return HARTHMERE_ROAD_GROUP_SEEDS.find((seed) => seed.entityId === entityId);
}
