import type { BiomesId } from "@/shared/ids";
import {
  HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET,
  harthmereLiveEntityIdFromOffset,
} from "@/shared/harthmere/live_entity_seed_ids";
import type { ReadonlyVec3, Vec2, Vec3 } from "@/shared/math/types";
import {
  shiftHarthmereAuthoredPositionToWorld,
  unshiftHarthmereWorldPositionToAuthored,
} from "./coordinate_transform";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  isLiveEntityRobotProtectionAnchorGrounded,
  liveEntityRobotProtectionAreaForPosition,
  liveEntityRobotDefaultRobotIdForArea,
  validateLiveEntityRobotProtectionAreas,
} from "./live_entity_robot_energy_protection";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET,
  isLiveEntityHelperQuestExcludedPosition,
  isPositionInsideLiveEntityHelperBounds,
} from "./live_entity_helper_quests";
import { muckMonsterAreaForPosition } from "./muck_monster_aggression_ai";
import {
  HARTHMERE_MUCK_CONTAINMENT_AREAS,
  type HarthmereMuckContainmentArea,
} from "./harthmere_muck_monster_containment";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "./snapshot_grove_content";
import {
  SNAPSHOT_SAFE_AREAS,
  authoredSnapshotAreaForPoint,
  snapshotCombatGroundedPosition,
} from "./snapshot_runtime_rules";
import {
  getHarthmereProductionPlacementByKey,
  harthmereProductionPlacementKey,
} from "./production_terrain_placement_map";
import {
  HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID,
  harthmereThaedrynArenaWorldAnchor,
} from "./bible_quest_live_authority";
import {
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  normalizeHarthmereExtensionOutdoorFeetPosition,
} from "./world_extension";
import {
  HARTHMERE_NATIVE_BANDIT_SEEDS,
  type HarthmereBanditRole,
} from "./bandit_production_seed";

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION =
  "harthmere-live-entity-production-seed" as const;
export const HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER = 5;

export type HarthmereLiveEntityProductionSeedKind =
  | "robot_sentinel"
  | "ambient_muck_monster"
  | "ambient_livestock"
  | "ambient_bandit";

export interface HarthmereLiveEntityProductionSeed {
  seedId: string;
  kind: HarthmereLiveEntityProductionSeedKind;
  entityId: BiomesId;
  idOffset: number;
  displayName: string;
  areaId: string;
  areaLabel: string;
  position: Vec3;
  orientation: Vec2;
  dialog: string;
  description: string;
  combatKind?: "mux" | "hex";
  combatLevel?: number;
  combatHp?: number;
  /** Wildlife species (e.g. "cow") for ambient_livestock seeds. */
  species?: string;
  /** Size tier for ambient_livestock — drives body radius / movement feel. */
  sizeTier?: "small" | "medium" | "large";
  /** Units of raw meat dropped when an ambient_livestock animal is hunted. */
  meatUnits?: number;
  /** Flat per-hit damage an ambient_livestock animal deals when it retaliates. */
  attackDamage?: number;
  /** Flat kill XP an ambient_livestock animal grants when hunted. */
  killXp?: number;
  /** Native Anima combat archetype for authored bandit families. */
  banditRole?: HarthmereBanditRole;
  /** Prisoners and other restrained actors remain ECS-owned but immobile. */
  lockedInPlace?: boolean;
  robotId?: string;
  energy?: number;
  maxEnergy?: number;
}

export interface HarthmereLiveEntityGroundingOptions {
  /**
   * Production runtime should use generated terrain-sampled placement records.
   * The placement-map builder disables this so it can regenerate those records
   * from deterministic authored XZ positions instead of reading its own output.
   */
  useProductionPlacementMap?: boolean;
}

type HarthmereLiveEntityProductionPlacementSource =
  | "live_muck_monster"
  | "live_livestock";

const entityIdFromOffset = harthmereLiveEntityIdFromOffset;

function productionOutdoorMarkerPosition(
  markerId: string,
  fallback: Vec3
): Vec3 {
  const placement = getHarthmereProductionPlacementByKey(
    harthmereProductionPlacementKey("jobs_board_marker", markerId)
  );
  const recommended = finiteVec3(placement?.recommendedPosition);
  return placement?.placementMode === "outdoor_surface" && recommended
    ? recommended
    : fallback;
}

/** Quest-gated native boss; materialized only after accepting the contract. */
export const HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED = {
  seedId: "live-helper-muck-scarred-helix",
  kind: "ambient_muck_monster",
  entityId: entityIdFromOffset(LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET),
  idOffset: LIVE_ENTITY_HELPER_MUCK_BOSS_OFFSET,
  displayName: "Muck-Scarred Helix",
  areaId: "west_muck_breach",
  areaLabel: "West Muck Breach",
  // The Helix belongs to the original-map West Muck Breach, not the safe,
  // additive Harthmere town. Use the checked-in production terrain sample so
  // the boss and its quest marker share the same real hill height.
  position: productionOutdoorMarkerPosition(
    "live_helper_muck_scarred_helix",
    [232, 32, -506]
  ),
  orientation: [0, 0] as Vec2,
  dialog: "",
  description:
    "An elite Muck-Scarred Helix raised by the active breach contract.",
  combatKind: "hex",
  combatLevel: 5,
  combatHp: 1800,
  attackDamage: 140,
  killXp: 500,
} satisfies HarthmereLiveEntityProductionSeed;

/** Q12's physical boss. Encounter phases stay custom; transform/health are ECS. */
export const HARTHMERE_NATIVE_THAEDRYN_SEED = {
  seedId: "bible-boss-thaedryn-bellbound",
  kind: "ambient_muck_monster",
  entityId: HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID as BiomesId,
  idOffset: 9120,
  displayName: "Thaedryn the Bellbound",
  areaId: "wyrms_bed",
  areaLabel: "Wyrm's Bed",
  position: harthmereThaedrynArenaWorldAnchor(),
  orientation: [0, Math.PI] as Vec2,
  dialog: "",
  description:
    "The ancient Bellbound dragon. Native Health and Anima own combat; the Q12 path machine owns Rebind, Slay, or Wake rules.",
  combatKind: "hex",
  combatLevel: 30,
  combatHp: 4000,
  attackDamage: 160,
  killXp: 0,
} satisfies HarthmereLiveEntityProductionSeed;

// Each sentinel reads a different landscape and failure mode. Area-keyed copy
// prevents repeated recharge boilerplate and gives useful local warnings.
function robotDialog(areaId: string, areaLabel: string) {
  const authored: Readonly<Record<string, readonly [string, string, string]>> =
    {
      west_muck_breach: [
        `West seal holding. I am measuring reality shear along ${areaLabel}, not merely visible Muck.`,
        "My charge is the last stable margin between this breach and the road traffic east of it.",
        "If my warning lamp turns violet, bring Stabilized Exotic Matter and approach from the marked stone line.",
      ],
      watchtower_muck_clearing: [
        `Watchtower perimeter stable. From ${areaLabel}, I track both Muck movement and anyone using the ruined ridge as cover.`,
        "Loose quarry stone distorts my ground readings, so I compare each surge against the old tower foundation.",
        "A low battery here blinds the road before it opens the field; recharge me before the patrol markers disappear.",
      ],
      old_wood_mucker_copse: [
        `Root pressure increasing around ${areaLabel}. The forest is moving independently of the Muck front.`,
        "I keep my shield narrow here so the containment field does not scorch healthy roots with the corrupted growth.",
        "For recharge, follow the blue stake lights and do not cut across the mushrooms inside my eastern arc.",
      ],
      gravewood_pale_muck: [
        `Pale contamination contained at ${areaLabel}. Grave soil makes every energy fluctuation harder to classify.`,
        "I distinguish fresh Muck disturbance from older burial damage before alerting the road wardens.",
        "If I request charge, carry Stabilized Exotic Matter along the cairn path; the direct route crosses unstable graves.",
      ],
    };
  return (
    // New protection areas receive safe in-world copy until bespoke lines are
    // authored, rather than shipping a silent sentinel.
    authored[areaId] ?? [
      `Containment steady at ${areaLabel}; I am watching for Muck movement beyond the marked boundary.`,
      `My stored charge protects the roads and working ground nearest ${areaLabel}.`,
      `If my warning lamp changes color, bring Stabilized Exotic Matter by the signed approach.`,
    ]
  );
}

function monsterDialog(areaLabel: string) {
  return [
    `The creature drags Muck across the edge of ${areaLabel}.`,
    "It has noticed you.",
  ];
}

function combatDefaultsForMonster(displayName: string): {
  combatKind: "mux" | "hex";
  combatLevel: number;
  combatHp: number;
} {
  const text = displayName.toLowerCase();
  if (/hex|hexer/.test(text)) {
    return {
      combatKind: "hex",
      combatLevel: /greater|pale/.test(text) ? 4 : 3,
      combatHp: /greater|pale/.test(text) ? 150 : 120,
    };
  }
  return {
    combatKind: "mux",
    combatLevel: /old wood|west breach/.test(text) ? 3 : 2,
    combatHp: /old wood|west breach/.test(text) ? 140 : 110,
  };
}

export function harthmereCombatHpForLiveEntitySeed(
  seed: HarthmereLiveEntityProductionSeed
): number {
  const defaultHp = seed.kind === "ambient_muck_monster" ? 110 : 40;
  const baseHp = Math.max(1, Math.trunc(seed.combatHp ?? defaultHp));
  if (seed.kind === "ambient_muck_monster") {
    return Math.max(
      1,
      Math.trunc(baseHp * HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER)
    );
  }
  return baseHp;
}

export function harthmereCombatAttackDamageForLiveEntitySeed(
  seed: HarthmereLiveEntityProductionSeed
): number | undefined {
  if (seed.kind !== "ambient_muck_monster") {
    return seed.attackDamage;
  }
  const entityKind = seed.combatKind ?? "mux";
  const level = Math.max(1, Math.trunc(Number(seed.combatLevel ?? 1)));
  const base =
    entityKind === "hex" ? (level >= 4 ? 24 : 18) : level >= 3 ? 16 : 14;
  return Math.max(
    1,
    Math.trunc(base * HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER)
  );
}

// HARTHMERE_LIVE_ENTITY_SIZE: the muck/wildlife NPCs reuse one damageable
// creature type, so npcEntity gives them all the SAME box (~0.75x1.8x0.75) — a
// rabbit ended up as tall as a cow. The client mesh scales to the size
// component, so authoring a per-species [width, height, depth] (meters) makes
// each creature visibly its own size (and gives it a right-sized hitbox). Values
// stay roughly in step with the live-mode combat bodyRadius (cow > sheep >
// rabbit; hex taller/thinner than the mucker blob).
export function harthmereLiveEntitySizeForSeed(
  seed: HarthmereLiveEntityProductionSeed
): Vec3 {
  const text = `${seed.displayName} ${seed.species ?? ""}`.toLowerCase();
  if (
    seed.kind === "ambient_livestock" ||
    /\b(cow|sheep|rabbit)\b/.test(text)
  ) {
    if (/cow/.test(text) || seed.sizeTier === "large") {
      return [1.3, 1.5, 2.0];
    }
    if (/rabbit/.test(text) || seed.sizeTier === "small") {
      return [0.5, 0.5, 0.7];
    }
    return [0.95, 1.0, 1.35]; // sheep / medium
  }
  if (seed.kind === "ambient_bandit") {
    return [0.72, 1.8, 0.72];
  }
  if (seed.combatKind === "hex" || /hex|hexer/.test(text)) {
    return [0.85, 1.75, 0.85];
  }
  return [1.0, 1.2, 1.0]; // mucker blob
}

export const HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS =
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS.map((area, index) => {
    const displayName = `${area.label} Sentinel`;
    return {
      seedId: `robot-sentinel-${area.areaId}`,
      kind: "robot_sentinel",
      entityId: entityIdFromOffset(9401 + index),
      idOffset: 9401 + index,
      displayName,
      areaId: area.areaId,
      areaLabel: area.label,
      position: [...area.anchor] as Vec3,
      orientation: [0, Math.PI / 2] as Vec2,
      dialog: robotDialog(area.areaId, area.label)
        .map((line) => `<text>${line}</text>`)
        .join("{break}"),
      description: `${displayName} keeps nearby Biomes protected from the Muck while its battery holds.`,
      robotId: liveEntityRobotDefaultRobotIdForArea(area.areaId),
      energy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
      maxEnergy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
    } satisfies HarthmereLiveEntityProductionSeed;
  });

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT = 140;

export interface HarthmereGuardedWildlifeLocation {
  areaId: string;
  areaLabel: string;
  center: ReadonlyVec3;
  animalCounts: Readonly<{
    cow: number;
    sheep: number;
    rabbit: number;
  }>;
}

// Four additional wildlife pockets distributed across distinct, non-safe Muck
// regions. Their center Y values come from the checked-in production terrain
// scan; the deployment grounding pass still verifies every complete body
// footprint and persists any small final adjustment as the respawn anchor.
export const HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS: readonly HarthmereGuardedWildlifeLocation[] =
  [
    {
      areaId: "west_muck_breach_low_shelf",
      areaLabel: "West Muck Breach Low Shelf",
      center: [203.172, 53, -518.17],
      animalCounts: { cow: 1, sheep: 2, rabbit: 2 },
    },
    {
      areaId: "watchtower_muck_north_hollow",
      areaLabel: "Watchtower Muck North Hollow",
      center: [307, 44, -385],
      animalCounts: { cow: 1, sheep: 2, rabbit: 2 },
    },
    {
      areaId: "old_wood_muck_east_verge",
      areaLabel: "Old Wood Muck East Verge",
      center: [675, 53, -457],
      animalCounts: { cow: 1, sheep: 1, rabbit: 3 },
    },
    {
      areaId: "gravewood_pale_muck_south_fold",
      areaLabel: "Gravewood Pale Muck South Fold",
      center: [665, 48, 145],
      animalCounts: { cow: 1, sheep: 1, rabbit: 3 },
    },
  ] as const;

// Four production-terrain sampled mixed encounters in the open Wilds. These
// are deliberately outside every safe/protected area and every Muck territory,
// and remain on the original map west of the additive Harthmere extension.
// Each location is a checked-in `outdoorSpawnPoints` coordinate from the June
// production terrain scan, so its Y is a real land surface rather than a guessed
// flat-world height.
export const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS: readonly HarthmereGuardedWildlifeLocation[] =
  [
    {
      areaId: "northwest_wilds_ridge",
      areaLabel: "Northwest Wilds Ridge",
      center: [219, 38, -897],
      animalCounts: { cow: 1, sheep: 2, rabbit: 4 },
    },
    {
      areaId: "southwest_wilds_meadow",
      areaLabel: "Southwest Wilds Meadow",
      center: [43, 51, 247],
      animalCounts: { cow: 1, sheep: 2, rabbit: 4 },
    },
    {
      areaId: "northeast_wilds_headland",
      areaLabel: "Northeast Wilds Headland",
      center: [1499, 43, -897],
      animalCounts: { cow: 1, sheep: 2, rabbit: 4 },
    },
    {
      areaId: "southeast_wilds_lowland",
      areaLabel: "Southeast Wilds Lowland",
      center: [1515, 40, 303],
      animalCounts: { cow: 1, sheep: 2, rabbit: 4 },
    },
  ] as const;

// Read-only production terrain probe, July 24 2026, revision
// biomes-node-vnet--0000193. Every open-Wilds creature has its own feet Y so
// the radial group layout follows hills instead of inheriting one center Y and
// spawning buried or floating. The production grounding gate re-probes these
// exact X/Z columns and fails on any future terrain drift.
export const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_TERRAIN_PROBE_REVISION =
  "biomes-node-vnet--0000193" as const;
const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_TERRAIN_FEET_Y_BY_OFFSET: Readonly<
  Record<number, number>
> = {
  10041: 36,
  10042: 37,
  10043: 36,
  10044: 37,
  10045: 37,
  10046: 35,
  10047: 38,
  10048: 51,
  10049: 51,
  10050: 52,
  10051: 51,
  10052: 51,
  10053: 54,
  10054: 52,
  10055: 43,
  10056: 43,
  10057: 42,
  10058: 43,
  10059: 43,
  10060: 42,
  10061: 43,
  10062: 40,
  10063: 39,
  10064: 41,
  10065: 39,
  10066: 47,
  10067: 41,
  10068: 39,
  10069: 36,
  10070: 38,
  10071: 36,
  10072: 36,
  10073: 38,
  10074: 34,
  10075: 51,
  10076: 51,
  10077: 51,
  10078: 53,
  10079: 51,
  10080: 55,
  10081: 43,
  10082: 43,
  10083: 42,
  10084: 43,
  10085: 43,
  10086: 42,
  10087: 40,
  10088: 39,
  10089: 40,
  10090: 40,
  10091: 39,
  10092: 41,
} as const;

export function harthmereOpenWildsTerrainFeetYForOffset(
  idOffset: number
): number | undefined {
  return HARTHMERE_LIVE_ENTITY_OPEN_WILDS_TERRAIN_FEET_Y_BY_OFFSET[idOffset];
}

function openWildsTerrainGroundedPosition(position: Vec3, idOffset: number) {
  const feetY = harthmereOpenWildsTerrainFeetYForOffset(idOffset);
  return feetY === undefined
    ? position
    : ([position[0], feetY, position[2]] as Vec3);
}

interface HarthmereMuckMonsterSeedLayout {
  areaId: string;
  areaLabel: string;
  count: number;
  center: ReadonlyVec3;
  radius: number;
  firstOffset: number;
  muckerName: string;
  hexerName: string;
  hexEvery: number;
  displayIndexBase?: number;
}

const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_LAYOUTS: readonly HarthmereMuckMonsterSeedLayout[] =
  [
    {
      areaId: "west_muck_breach",
      areaLabel: "West Muck Breach",
      count: 15,
      center: [236, 54, -506],
      radius: 36,
      firstOffset: 9451,
      muckerName: "West Breach Muckling",
      hexerName: "West Breach Lesser Hexer",
      hexEvery: 5,
    },
    {
      areaId: "road_muckwad_patch",
      areaLabel: "Road Muckwad Patch",
      count: 15,
      center: [512, 54, -152],
      radius: 8,
      firstOffset: HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET,
      muckerName: "Road Muckwad",
      hexerName: "Road Lesser Hexer",
      hexEvery: 5,
    },
    {
      areaId: "watchtower_muck_patch",
      areaLabel: "Watchtower Muck Patch",
      count: 14,
      center: [332, 54, -390],
      radius: 14,
      firstOffset: 9481,
      muckerName: "Watchtower Mucker",
      hexerName: "Watchtower Lesser Hexer",
      hexEvery: 7,
    },
    {
      areaId: "watchtower_muck_clearing",
      areaLabel: "Watchtower Muck Clearing",
      count: 14,
      center: [332, 54, -390],
      radius: 32,
      firstOffset: 9495,
      muckerName: "Watchtower Clearing Mucker",
      hexerName: "Watchtower Clearing Hexer",
      hexEvery: 7,
    },
    {
      areaId: "old_wood_muck_patch",
      areaLabel: "Old Wood Muck Patch",
      count: 14,
      center: [640, 54, -455],
      radius: 20,
      firstOffset: 9509,
      muckerName: "Old Wood Mucker",
      hexerName: "Old Wood Lesser Hexer",
      hexEvery: 7,
    },
    {
      areaId: "old_wood_mucker_copse",
      areaLabel: "Old Wood Mucker Copse",
      count: 14,
      center: [640, 54, -455],
      radius: 46,
      firstOffset: 9523,
      muckerName: "Old Wood Copse Mucker",
      hexerName: "Old Wood Copse Hexer",
      hexEvery: 7,
    },
    {
      areaId: "gravewood_pale_muck",
      areaLabel: "Gravewood Pale Muck",
      count: 14,
      center: [640, 54, 120],
      radius: 40,
      firstOffset: 9537,
      muckerName: "Gravewood Pale Muckling",
      hexerName: "Gravewood Pale Hexer",
      hexEvery: 7,
    },
    ...HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.map(
      (location, index) => ({
        areaId: location.areaId,
        areaLabel: location.areaLabel,
        count: 4,
        center: location.center,
        radius: 5,
        firstOffset: 10021 + index * 4,
        muckerName:
          index === 0
            ? "West Breach Muckling"
            : index === 1
            ? "Watchtower Clearing Mucker"
            : index === 2
            ? "Old Wood Copse Mucker"
            : "Gravewood Pale Muckling",
        hexerName:
          index === 0
            ? "West Breach Lesser Hexer"
            : index === 1
            ? "Watchtower Clearing Hexer"
            : index === 2
            ? "Old Wood Copse Hexer"
            : "Gravewood Pale Hexer",
        // Exactly three Muckers and one Hex guard every added herd.
        hexEvery: 4,
        displayIndexBase: index === 0 ? 15 : 14,
      })
    ),
    ...HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.map(
      (location, index) => ({
        areaId: location.areaId,
        areaLabel: location.areaLabel,
        count: 6,
        center: location.center,
        radius: 7,
        firstOffset: 10069 + index * 6,
        muckerName: "Open Wilds Mucker",
        hexerName: "Open Wilds Hex",
        // Exactly five Muckers and one Hex accompany every seven-animal group.
        hexEvery: 6,
        displayIndexBase: index * 6,
      })
    ),
  ] as const;

function muckMonsterPositionForLayout(
  layout: HarthmereMuckMonsterSeedLayout,
  index: number
): Vec3 {
  const radius = layout.radius * Math.sqrt((index + 0.5) / layout.count);
  const angle = index * 2.399963229728653;
  return [
    Number((layout.center[0] + Math.cos(angle) * radius).toFixed(3)),
    layout.center[1],
    Number((layout.center[2] + Math.sin(angle) * radius).toFixed(3)),
  ] as Vec3;
}

const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SOURCE_SEEDS =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_LAYOUTS.flatMap((layout) =>
    Array.from({ length: layout.count }, (_, index) => {
      const idOffset = layout.firstOffset + index;
      const isHexer = (index + 1) % layout.hexEvery === 0;
      const displayName = isHexer ? layout.hexerName : layout.muckerName;
      const position = muckMonsterPositionForLayout(layout, index);
      return {
        areaId: layout.areaId,
        areaLabel: layout.areaLabel,
        idOffset,
        displayName: `${displayName} ${
          (layout.displayIndexBase ?? 0) + index + 1
        }`,
        position: openWildsTerrainGroundedPosition(position, idOffset),
      };
    })
  );

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SOURCE_SEEDS.map((seed) => {
    const combat = combatDefaultsForMonster(seed.displayName);
    return {
      seedId: `ambient-muck-monster-${seed.areaId}-${seed.idOffset}`,
      kind: "ambient_muck_monster",
      entityId: entityIdFromOffset(seed.idOffset),
      idOffset: seed.idOffset,
      displayName: seed.displayName,
      areaId: seed.areaId,
      areaLabel: seed.areaLabel,
      position: seed.position,
      orientation: [0, 0] as Vec2,
      dialog: monsterDialog(seed.areaLabel)
        .map((line) => `<text>${line}</text>`)
        .join("{break}"),
      description: `${seed.displayName} prowls the Muck edge near ${seed.areaLabel}.`,
      ...combat,
    } satisfies HarthmereLiveEntityProductionSeed;
  });

// Huntable, passive-but-retaliating wildlife spread across the muck areas.
// Cows, sheep, and rabbits graze the muck edge, ignore travelers until attacked,
// then defend themselves; when hunted they drop meat and respawn with the rest
// of the muck wildlife. Larger animals carry more HP and drop more meat.
// (road_muckwad_patch is intentionally excluded — it overlaps the Grove/town
// safe radius, so wildlife there would appear "inside the Grove".)
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_AREAS: ReadonlyArray<{
  areaId: string;
  areaLabel: string;
}> = [
  { areaId: "west_muck_breach", areaLabel: "West Muck Breach" },
  { areaId: "watchtower_muck_clearing", areaLabel: "Watchtower Muck Clearing" },
  { areaId: "old_wood_mucker_copse", areaLabel: "Old Wood Mucker Copse" },
  { areaId: "gravewood_pale_muck", areaLabel: "Gravewood Pale Muck" },
];

interface HarthmereLivestockSpeciesConfig {
  species: "cow" | "sheep" | "rabbit";
  displayName: string;
  sizeTier: "small" | "medium" | "large";
  combatHp: number;
  meatUnits: number;
  attackDamage: number;
  killXp: number;
  perArea: number;
  dialog: string;
}

// Size tiers: cows are large (most HP, hardest hit, most meat, most XP), sheep
// medium, rabbits small (least of everything).
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES: readonly HarthmereLivestockSpeciesConfig[] =
  [
    {
      species: "cow",
      displayName: "Muckmeadow Cow",
      sizeTier: "large",
      combatHp: 270,
      meatUnits: 12,
      attackDamage: 66,
      killXp: 50,
      perArea: 2,
      dialog: "<text>Moo.</text>",
    },
    {
      species: "sheep",
      displayName: "Muckmeadow Sheep",
      sizeTier: "medium",
      combatHp: 110,
      meatUnits: 4,
      attackDamage: 30,
      killXp: 20,
      perArea: 2,
      dialog: "<text>Baa.</text>",
    },
    {
      species: "rabbit",
      displayName: "Muckmeadow Rabbit",
      sizeTier: "small",
      combatHp: 22,
      meatUnits: 1,
      attackDamage: 15,
      killXp: 5,
      perArea: 2,
      dialog: "<text>*twitches its nose*</text>",
    },
  ] as const;

const HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA =
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.reduce(
    (total, species) => total + species.perArea,
    0
  );
// Offset band 9551-9574 (24 animals). MUST NOT overlap other authored families:
// grove 9301-9320, robots 9401-9420, muckers 9451-9550, business owners
// 9601-9619, business customers 9701-9757. The previous value (9601) collided
// with the 19 business owners, so 19 of the 24 animals were never created.
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET = 9551;
const HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_FIRST_OFFSET = 10001;
const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_ANIMAL_FIRST_OFFSET = 10041;

// Deterministic spread inside the muck area, kept well within radius so animals
// stay grounded in the muck (not on its sloped edge). `indexInArea` covers every
// animal of every species in the area so they don't stack on each other.
function livestockPositionInMuckArea(
  area: HarthmereMuckContainmentArea,
  indexInArea: number
): Vec3 {
  const radius =
    Math.max(0, area.radius - 4) *
    Math.sqrt(
      (indexInArea + 0.5) /
        Math.max(1, HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA)
    );
  const angle = indexInArea * 2.399963229728653 + 1;
  return [
    Number((area.center[0] + Math.cos(angle) * radius).toFixed(3)),
    area.center[1],
    Number((area.center[2] + Math.sin(angle) * radius).toFixed(3)),
  ];
}

const HARTHMERE_LIVE_ENTITY_BASE_MUCK_WILDLIFE_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_AREAS.flatMap((livestockArea, areaIndex) => {
    const area = HARTHMERE_MUCK_CONTAINMENT_AREAS.find(
      (candidate) => candidate.id === livestockArea.areaId
    );
    if (!area) {
      return [];
    }
    let indexInArea = 0;
    return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.flatMap((config) =>
      Array.from({ length: config.perArea }, () => {
        const localIndex = indexInArea++;
        const idOffset =
          HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET +
          areaIndex * HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA +
          localIndex;
        return {
          seedId: `ambient-livestock-${config.species}-${livestockArea.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `${config.displayName} ${
            idOffset - HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET + 1
          }`,
          areaId: livestockArea.areaId,
          areaLabel: livestockArea.areaLabel,
          position: livestockPositionInMuckArea(area, localIndex),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes the muck near ${
            livestockArea.areaLabel
          }. It ignores travelers until struck, then defends itself.`,
          combatKind: "mux" as const,
          combatLevel: 1,
          combatHp: config.combatHp,
          species: config.species,
          sizeTier: config.sizeTier,
          meatUnits: config.meatUnits,
          attackDamage: config.attackDamage,
          killXp: config.killXp,
        } satisfies HarthmereLiveEntityProductionSeed;
      })
    );
  });

function guardedWildlifePosition(
  location: HarthmereGuardedWildlifeLocation,
  index: number,
  count: number
): Vec3 {
  const radius = 6 * Math.sqrt((index + 0.5) / Math.max(1, count));
  const angle = index * 2.399963229728653 + 0.65;
  return [
    Number((location.center[0] + Math.cos(angle) * radius).toFixed(3)),
    location.center[1],
    Number((location.center[2] + Math.sin(angle) * radius).toFixed(3)),
  ];
}

export const HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.flatMap(
    (location, locationIndex) => {
      const speciesOrder = HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.flatMap(
        (config) =>
          Array.from(
            { length: location.animalCounts[config.species] },
            () => config
          )
      );
      return speciesOrder.map((config, localIndex) => {
        const animalsBefore =
          HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.slice(
            0,
            locationIndex
          ).reduce(
            (total, previous) =>
              total +
              previous.animalCounts.cow +
              previous.animalCounts.sheep +
              previous.animalCounts.rabbit,
            0
          );
        const idOffset =
          HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_FIRST_OFFSET +
          animalsBefore +
          localIndex;
        return {
          seedId: `guarded-livestock-${config.species}-${location.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `${config.displayName} Guarded Herd ${
            idOffset - HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_FIRST_OFFSET + 1
          }`,
          areaId: location.areaId,
          areaLabel: location.areaLabel,
          position: guardedWildlifePosition(
            location,
            localIndex,
            speciesOrder.length
          ),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes at ${
            location.areaLabel
          } under a nearby Mucker and Hex guard pack.`,
          combatKind: "mux" as const,
          combatLevel: 1,
          combatHp: config.combatHp,
          species: config.species,
          sizeTier: config.sizeTier,
          meatUnits: config.meatUnits,
          attackDamage: config.attackDamage,
          killXp: config.killXp,
        } satisfies HarthmereLiveEntityProductionSeed;
      });
    }
  );

export const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.flatMap(
    (location, locationIndex) => {
      const speciesOrder = HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.flatMap(
        (config) =>
          Array.from(
            { length: location.animalCounts[config.species] },
            () => config
          )
      );
      return speciesOrder.map((config, localIndex) => {
        const idOffset =
          HARTHMERE_LIVE_ENTITY_OPEN_WILDS_ANIMAL_FIRST_OFFSET +
          locationIndex * speciesOrder.length +
          localIndex;
        return {
          seedId: `open-wilds-livestock-${config.species}-${location.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `Open Wilds ${config.displayName} ${
            idOffset - HARTHMERE_LIVE_ENTITY_OPEN_WILDS_ANIMAL_FIRST_OFFSET + 1
          }`,
          areaId: location.areaId,
          areaLabel: location.areaLabel,
          position: openWildsTerrainGroundedPosition(
            guardedWildlifePosition(location, localIndex, speciesOrder.length),
            idOffset
          ),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes in ${
            location.areaLabel
          } near an open-Wilds Mucker and Hex pack.`,
          combatKind: "mux" as const,
          combatLevel: 1,
          combatHp: config.combatHp,
          species: config.species,
          sizeTier: config.sizeTier,
          meatUnits: config.meatUnits,
          attackDamage: config.attackDamage,
          killXp: config.killXp,
        } satisfies HarthmereLiveEntityProductionSeed;
      });
    }
  );

export const HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_MONSTER_SEEDS =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.filter((seed) =>
    HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.some(
      (location) => location.areaId === seed.areaId
    )
  );

export const HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS = [
  ...HARTHMERE_LIVE_ENTITY_BASE_MUCK_WILDLIFE_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_SEEDS,
];

// Living animals remain in Harthmere after the original-map wildlife is moved
// back to its terrain-sampled hills. These are a separate, safe-town herd with
// distinct ids; they must never be mistaken for Muck-area wildlife or shifted
// into a hostile containment zone.
const HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_AREAS = [
  {
    areaId: "harthmere_town_north_pasture",
    areaLabel: "Harthmere North Pasture",
    authoredPositions: [
      [430, -320],
      [448, -326],
      [464, -316],
      [520, -318],
      [538, -328],
      [556, -316],
    ],
  },
  {
    areaId: "harthmere_town_south_orchard",
    areaLabel: "Harthmere South Orchard",
    authoredPositions: [
      [410, -62],
      [430, -48],
      [452, -64],
      [520, -62],
      [542, -48],
      [562, -64],
    ],
  },
] as const;

const HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_FIRST_OFFSET = 9575;

export const HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_AREAS.flatMap((area, areaIndex) => {
    let localIndex = 0;
    return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.flatMap((config) =>
      Array.from({ length: config.perArea }, () => {
        const positionIndex = localIndex++;
        const idOffset =
          HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_FIRST_OFFSET +
          areaIndex * HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA +
          positionIndex;
        const [authoredX, authoredZ] = area.authoredPositions[positionIndex];
        const speciesName =
          config.species[0].toUpperCase() + config.species.slice(1);
        return {
          seedId: `town-livestock-${config.species}-${area.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `Harthmere ${speciesName} ${
            idOffset - HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_FIRST_OFFSET + 1
          }`,
          areaId: area.areaId,
          areaLabel: area.areaLabel,
          position: normalizeHarthmereExtensionOutdoorFeetPosition(
            shiftHarthmereAuthoredPositionToWorld([
              authoredX,
              HARTHMERE_EXTENSION_FEET_Y,
              authoredZ,
            ]),
            2
          ),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.species} grazing safely near ${area.areaLabel}.`,
          combatKind: "mux" as const,
          combatLevel: 1,
          combatHp: config.combatHp,
          species: config.species,
          sizeTier: config.sizeTier,
          meatUnits: config.meatUnits,
          attackDamage: config.attackDamage,
          killXp: config.killXp,
        } satisfies HarthmereLiveEntityProductionSeed;
      })
    );
  });

export const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS = [
  ...HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS,
];

// HARTHMERE_MUCK_FLOOR_FEET_Y: local-dev fallback used while regenerating
// the production terrain placement map. Runtime callers use the generated
// terrain-sampled placement records so muckers and wildlife stand on the real
// production surface instead of a single flat Y across hills and breaches.
export const HARTHMERE_MUCK_FLOOR_FEET_Y = 53;

function groundMuckEntityFeet(position: Vec3): Vec3 {
  return [position[0], HARTHMERE_MUCK_FLOOR_FEET_Y, position[2]];
}

function finiteVec3(position: ReadonlyVec3 | undefined): Vec3 | undefined {
  if (
    !position ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    !Number.isFinite(position[2])
  ) {
    return undefined;
  }
  return [Number(position[0]), Number(position[1]), Number(position[2])];
}

function productionPlacedLiveEntityPosition(
  seed: HarthmereLiveEntityProductionSeed,
  source: HarthmereLiveEntityProductionPlacementSource,
  options: HarthmereLiveEntityGroundingOptions | undefined
): Vec3 | undefined {
  if (options?.useProductionPlacementMap === false) {
    return undefined;
  }
  const placement = getHarthmereProductionPlacementByKey(
    harthmereProductionPlacementKey(source, seed.seedId)
  );
  if (placement?.placementMode !== "outdoor_surface") {
    return undefined;
  }
  const recommended = finiteVec3(placement.recommendedPosition);
  if (!recommended) {
    return undefined;
  }
  // The production placement map was sampled from the original snapshot's
  // real surface. Preserve all three coordinates: its varying Y values are the
  // protection against burying or floating creatures in the Grove/Wilds hills.
  return recommended;
}

export function harthmereLiveEntityIsTownLivestock(
  seed: HarthmereLiveEntityProductionSeed
): boolean {
  return (
    seed.kind === "ambient_livestock" &&
    seed.areaId.startsWith("harthmere_town_")
  );
}

export function harthmereLiveEntityIsGuardedWildlife(
  seed: HarthmereLiveEntityProductionSeed
): boolean {
  return HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.some(
    (location) => location.areaId === seed.areaId
  );
}

export function harthmereLiveEntityIsOpenWildsMixedGroup(
  seed: HarthmereLiveEntityProductionSeed
): boolean {
  return HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.some(
    (location) => location.areaId === seed.areaId
  );
}

// Wildlife grounded to the production surface and kept inside their muck area
// (mirrors the muck-monster grounding). Animals authored outside any muck
// territory are dropped.
export function harthmereGroundedLivestockSeedsInTerritory(
  options: HarthmereLiveEntityGroundingOptions = {}
): HarthmereLiveEntityProductionSeed[] {
  return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS.flatMap((seed) => {
    if (harthmereLiveEntityIsTownLivestock(seed)) {
      return [{ ...seed, position: [...seed.position] as Vec3 }];
    }
    const isOpenWildsGroup = harthmereLiveEntityIsOpenWildsMixedGroup(seed);
    const runtimeWorldSpace = options.useProductionPlacementMap !== false;
    const authoredFallback = isOpenWildsGroup
      ? ([...seed.position] as Vec3)
      : groundMuckEntityFeet(seed.position);
    const grounded = runtimeWorldSpace
      ? productionPlacedLiveEntityPosition(seed, "live_livestock", options) ??
        (harthmereLiveEntityIsGuardedWildlife(seed) || isOpenWildsGroup
          ? ([...seed.position] as Vec3)
          : authoredFallback)
      : authoredFallback;
    if (isOpenWildsGroup) {
      return harthmereOpenWildsMixedGroupPositionIsValid(grounded)
        ? [{ ...seed, position: grounded }]
        : [];
    }
    if (
      harthmereMuckMonsterPositionIsInSafeZone(grounded) ||
      !muckMonsterAreaForPosition(grounded, 1.5)
    ) {
      return [];
    }
    return [{ ...seed, position: grounded }];
  });
}

// HARTHMERE_MUCK_MONSTER_CONTAINMENT: the canonical set of muck monsters to
// actually spawn. Each seed position is grounded to the production terrain map
// and then gated so ONLY monsters that resolve to a real muck territory are kept.
// All 100 authored seeds already validate in-territory (see
// `validateHarthmereLiveEntityProductionSeeds`), so this drops nothing today;
// it is a defense-in-depth guarantee that a Hex/Mucker can never be seeded
// outside the muck if the layout data is ever edited.
// HARTHMERE_MUCK_MONSTER_SAFE_ZONE_EXCLUSION:
// A muck monster must never spawn inside an authored SAFE area (the Grove, the
// Harthmere town core, the safe road). The road_muckwad_patch muck zone overlaps
// the Grove/town safe radii, so its ambient muckers would otherwise appear
// "inside the Grove". Drop any monster whose grounded position lands in a safe
// area. Snapshot combat hostiles use a separate seed family, and that family is
// independently required to remain outside every safe zone.
export function harthmereMuckMonsterPositionIsInSafeZone(
  position: ReadonlyVec3
): boolean {
  const authoredPosition =
    position[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X
      ? unshiftHarthmereWorldPositionToAuthored(position)
      : position;
  return Boolean(
    authoredSnapshotAreaForPoint(authoredPosition, SNAPSHOT_SAFE_AREAS, 0)
  );
}

export function harthmereOpenWildsMixedGroupPositionIsValid(
  position: ReadonlyVec3
): boolean {
  return (
    position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    !harthmereMuckMonsterPositionIsInSafeZone(position) &&
    !muckMonsterAreaForPosition(position, 1.5) &&
    !isLiveEntityHelperQuestExcludedPosition(position) &&
    !liveEntityRobotProtectionAreaForPosition(position)
  );
}

// HARTHMERE_RANDOM_WORLD_SPAWN: small deterministic PRNG (mulberry32). Seeded
// by the creature's stable idOffset so the "random" world spread is identical
// across processes and reproducible by the deploy reconciler — random-looking,
// not actually nondeterministic.
function harthmereSpawnRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A uniformly-random point inside a muck area (kept within radius - 2 so it
// stays comfortably inside the muck floor), deterministic for a given seed.
function muckMonsterRandomPosition(
  area: HarthmereMuckContainmentArea,
  seed: number
): Vec3 {
  const rng = harthmereSpawnRng(seed);
  const maxR = Math.max(0, area.radius - 2);
  const radius = maxR * Math.sqrt(rng());
  const angle = rng() * Math.PI * 2;
  return [
    Number((area.center[0] + Math.cos(angle) * radius).toFixed(3)),
    area.center[1],
    Number((area.center[2] + Math.sin(angle) * radius).toFixed(3)),
  ];
}

// Every muck containment area whose center is safely outside the Grove/town. The
// Grove-overlapping road_muckwad_patch is excluded here by the safe-zone guard,
// so muckers spread across ALL the real muck regions of the world rather than a
// hand-picked four.
function harthmereNonSafeMuckAreas(): HarthmereMuckContainmentArea[] {
  return HARTHMERE_MUCK_CONTAINMENT_AREAS.filter(
    (area) => !harthmereMuckMonsterPositionIsInSafeZone(area.center)
  );
}

// Ordinary authored muck monsters are randomly (but deterministically) spread
// across all non-safe muck regions. The four guarded-herd packs retain their
// authored local positions. A final hard guard re-rolls any position that
// resolves into a safe zone — a monster can NEVER end up in the Grove.
export function harthmereGroundedMuckMonsterSeedsInTerritory(
  options: HarthmereLiveEntityGroundingOptions = {}
): HarthmereLiveEntityProductionSeed[] {
  const areas = harthmereNonSafeMuckAreas();
  const fallbackArea = areas[0];
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.flatMap((seed, index) => {
    const stableSeed = Number.isFinite(seed.idOffset) ? seed.idOffset : index;
    const isOpenWildsGroup = harthmereLiveEntityIsOpenWildsMixedGroup(seed);
    let position: Vec3;
    if (harthmereLiveEntityIsGuardedWildlife(seed) || isOpenWildsGroup) {
      // These four packs were authored as guards for specific new herds. Do
      // not feed them through the legacy map-wide Mucker redistribution or the
      // animals and their supposed guards end up hundreds of blocks apart.
      // Deployment still terrain-probes this local X/Z and persists the final
      // grounded Y, just like the animals in the same encounter pocket.
      position = [...seed.position] as Vec3;
    } else if (areas.length === 0) {
      position = snapshotCombatGroundedPosition(seed.position);
    } else {
      // Deterministically choose a muck region for this creature, then a random
      // point inside it.
      const areaPick = harthmereSpawnRng(stableSeed ^ 0x9e3779b9)();
      const area =
        areas[Math.min(areas.length - 1, Math.floor(areaPick * areas.length))];
      position = muckMonsterRandomPosition(area, stableSeed);
    }
    // Hard guard: if a placement ever lands in a safe zone (it shouldn't, since
    // every source area is non-safe), re-roll it deep inside the fallback area.
    let guard = 0;
    while (
      !isOpenWildsGroup &&
      harthmereMuckMonsterPositionIsInSafeZone(position) &&
      fallbackArea &&
      guard < 8
    ) {
      position = muckMonsterRandomPosition(
        fallbackArea,
        stableSeed + 1 + guard
      );
      guard += 1;
    }
    // Keep an authored/local-dev fallback for placement-map generation, then
    // prefer the generated production surface when runtime callers spawn them.
    const runtimeWorldSpace = options.useProductionPlacementMap !== false;
    const authoredFallbackPosition = groundMuckEntityFeet(position);
    const fallbackPosition =
      isOpenWildsGroup ||
      (runtimeWorldSpace && harthmereLiveEntityIsGuardedWildlife(seed))
        ? ([...position] as Vec3)
        : authoredFallbackPosition;
    const productionPosition = runtimeWorldSpace
      ? productionPlacedLiveEntityPosition(seed, "live_muck_monster", options)
      : undefined;
    if (
      productionPosition &&
      (isOpenWildsGroup
        ? harthmereOpenWildsMixedGroupPositionIsValid(productionPosition)
        : !harthmereMuckMonsterPositionIsInSafeZone(productionPosition) &&
          Boolean(muckMonsterAreaForPosition(productionPosition, 1.5)))
    ) {
      return [{ ...seed, position: productionPosition }];
    }
    if (
      isOpenWildsGroup &&
      !harthmereOpenWildsMixedGroupPositionIsValid(fallbackPosition)
    ) {
      return [];
    }
    return [{ ...seed, position: fallbackPosition }];
  });
}

// Entity ids of authored muck monsters that are NO LONGER spawned (e.g. they
// landed inside a safe zone like the Grove). A world that was seeded before this
// exclusion still has them, so the production content-sync uses this list to
// delete the stragglers (e.g. the 15 road_muckwad muckers inside the Grove).
export function harthmereExcludedMuckMonsterSeedIds(): BiomesId[] {
  const kept = new Set(
    harthmereGroundedMuckMonsterSeedsInTerritory().map((seed) => seed.entityId)
  );
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.filter(
    (seed) => !kept.has(seed.entityId)
  ).map((seed) => seed.entityId);
}

// The ids that SHOULD exist in the world: every robot sentinel plus only the
// muck monsters that survive the muck-territory + safe-zone gate. This is what
// "expected/required" means for fingerprinting and reconciliation, so the
// excluded (e.g. Grove) muckers are not treated as required and can be removed.
export function harthmereActiveLiveEntityProductionSeedIds(): BiomesId[] {
  return [
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.map((seed) => seed.entityId),
    ...harthmereGroundedMuckMonsterSeedsInTerritory().map(
      (seed) => seed.entityId
    ),
    ...harthmereGroundedLivestockSeedsInTerritory().map(
      (seed) => seed.entityId
    ),
    ...HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) => seed.entityId),
  ];
}

export function harthmereRespawningLiveCreatureSeedIds(): BiomesId[] {
  return harthmereRespawningLiveCreatureSeeds().map((seed) => seed.entityId);
}

export function harthmereRespawningLiveCreatureSeeds(): HarthmereLiveEntityProductionSeed[] {
  return [
    ...harthmereGroundedMuckMonsterSeedsInTerritory().map((seed) => seed),
    ...harthmereGroundedLivestockSeedsInTerritory().map((seed) => seed),
    ...HARTHMERE_NATIVE_BANDIT_SEEDS,
  ];
}

export function harthmereRespawningLiveCreatureSeedForId(
  entityId: BiomesId
): HarthmereLiveEntityProductionSeed | undefined {
  return harthmereRespawningLiveCreatureSeeds().find(
    (seed) => seed.entityId === entityId
  );
}

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS = [
  ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
  ...HARTHMERE_NATIVE_BANDIT_SEEDS,
] as const;

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_IDS =
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.map((seed) => seed.entityId);

export function validateHarthmereLiveEntityProductionSeeds() {
  const errors = [...validateLiveEntityRobotProtectionAreas()];
  const seedIds = new Set<string>();
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS) {
    if (seedIds.has(seed.seedId)) {
      errors.push(`${seed.seedId}:duplicate_seed_id`);
    }
    seedIds.add(seed.seedId);
    if (ids.has(seed.entityId)) {
      errors.push(`${seed.seedId}:duplicate_entity_id`);
    }
    ids.add(seed.entityId);
    if (offsets.has(seed.idOffset)) {
      errors.push(`${seed.seedId}:duplicate_id_offset`);
    }
    offsets.add(seed.idOffset);
    if (seed.displayName.includes("_") || seed.description.includes("_")) {
      errors.push(`${seed.seedId}:player_copy_contains_internal_case`);
    }
    if (
      /debug|developer|server|local-dev|snakecase|camelcase/i.test(
        `${seed.displayName} ${seed.description} ${seed.dialog}`
      )
    ) {
      errors.push(`${seed.seedId}:player_copy_contains_non_player_text`);
    }
    const muckTerritory =
      seed.kind === "ambient_muck_monster"
        ? muckMonsterAreaForPosition(seed.position, 1.5)
        : undefined;
    const isOpenWildsGroup = harthmereLiveEntityIsOpenWildsMixedGroup(seed);
    if (
      isLiveEntityHelperQuestExcludedPosition(seed.position) &&
      !muckTerritory &&
      !harthmereLiveEntityIsTownLivestock(seed) &&
      !isOpenWildsGroup &&
      !(seed.kind === "ambient_bandit" && seed.lockedInPlace)
    ) {
      errors.push(`${seed.seedId}:inside_excluded_settlement`);
    }
    if (seed.kind === "robot_sentinel") {
      const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS.find(
        (candidate) => candidate.areaId === seed.areaId
      );
      if (!area) {
        errors.push(`${seed.seedId}:unknown_area`);
        continue;
      }
      if (!isPositionInsideLiveEntityHelperBounds(seed.position, area.bounds)) {
        errors.push(`${seed.seedId}:outside_area_bounds`);
      }
      if (!seed.robotId || !isLiveEntityRobotProtectionAnchorGrounded(area)) {
        errors.push(`${seed.seedId}:robot_anchor_not_grounded`);
      }
    }
    if (
      isOpenWildsGroup &&
      !harthmereOpenWildsMixedGroupPositionIsValid(seed.position)
    ) {
      errors.push(`${seed.seedId}:invalid_open_wilds_group_position`);
    }
    if (
      seed.kind === "ambient_muck_monster" &&
      !muckTerritory &&
      !isOpenWildsGroup
    ) {
      errors.push(`${seed.seedId}:monster_outside_muck_territory`);
    }
  }
  return errors;
}
