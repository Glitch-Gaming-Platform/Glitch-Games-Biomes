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
  HARTHMERE_PRODUCTION_PLACEMENT_MAP,
  getHarthmereProductionPlacementByKey,
  harthmereProductionPlacementKey,
  type HarthmereProductionPlacementRecord,
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
import {
  CH1_NPC_ID_OFFSET_BASE,
  CH1_NPC_ID_OFFSET_LIMIT_EXCLUSIVE,
} from "./ch1_ids";
import { harthmereForestWildlifePlacements } from "./harthmere_forest_wildlife";
import {
  HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS,
  HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
  isHarthmereRoadGroupAreaId,
} from "./road_to_harthmere_groups";
import { isPointInsideHarthmereBusinessSafeSite } from "./business_customer_simulator";
import { BUILDING_SYSTEM_PLOTS } from "./building_system";
import { harthmereBossVisualForEntity } from "./boss_visual_assets";
import {
  HARTHMERE_ANIMAL_ASSET_SPECS,
  harthmereAnimalAssetSpec,
  harthmereAnimalAssetSpeciesForLabel,
} from "./harthmere_animal_assets";
import { HARTHMERE_REMAINING_NPCS } from "./npc_compendium";
import type { HarthmereExoticMatterCaveId } from "./exotic_matter_caves";
import {
  HARTHMERE_INDISWORM_PRODUCTION_COUNT,
  HARTHMERE_INDISWORM_SPAWNS,
  isPositionInsideHarthmereIndiswormCave,
} from "./indisworm_spawns";

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
  /** Underground cavern identity. These seeds keep their authored cave floor. */
  caveId?: HarthmereExoticMatterCaveId;
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
  /**
   * HARTHMERE_CREATURE_GROUPS: explicit authored pack membership. When present it
   * overrides the area-derived group id, which lets one area hold several
   * independent encounters without them merging into a single swarm.
   */
  groupId?: string;
  /** Exact seeded creature rank used by Jobs Board hunt contracts. */
  bountyTier?: "elite" | "boss";
  /**
   * HARTHMERE_MUCK_PACK_RELOCATION (2026-07-28): this monster belongs to a pack
   * that was deliberately re-homed OUT of Muck territory into the open Wilds.
   *
   * It is a per-seed flag rather than an areaId list because the areaId has to
   * stay put: `road_muckwad_patch` drives the tutorial retaliation-only combat
   * profile, and `watchtower_muck_clearing` / `old_wood_mucker_copse` are also
   * livestock areaIds whose animals legitimately remain on the Muck edge. Only
   * the monster seeds carry this flag, so the two families cannot be confused.
   *
   * Seeds with this flag follow the open-Wilds contract: authored position wins
   * (no Muck-floor flattening, no Muck redistribution) and
   * `harthmereOpenWildsMixedGroupPositionIsValid` gates them.
   */
  wildsRelocatedPack?: boolean;
  /**
   * A deliberately isolated original-map encounter that uses the same outdoor
   * terrain-grounding and exclusion contract as the relocated Wilds packs,
   * without implying that the actor belongs to a mixed creature group.
   */
  openWildsEncounter?: boolean;
  /**
   * HARTHMERE_AUTHORED_MUCK_PACK: keep the authored position verbatim while
   * REMAINING inside a Muck territory. Used by the one pack left in the
   * Watchtower clearing, whose members sit on individually terrain-probed
   * columns; the random in-area spread would throw that measurement away.
   */
  authoredMuckPack?: boolean;
  /**
   * HARTHMERE_QUEST_GUARANTEED_DROP: original-snapshot Bikkie items this
   * creature always drops, on top of its family loot. See the identically
   * named field on `HarthmereNativeCombatSeedLike` for why these are BiomesIds
   * rather than Harthmere item slugs.
   */
  questDropBikkieItems?: ReadonlyArray<{
    bikkieItemId: BiomesId;
    count: number;
  }>;
  /**
   * HARTHMERE_CREATURE_LEVELING: authored PER-ENTITY progression level.
   *
   * Deliberately separate from `combatLevel`. `combatLevel` selects which shared
   * NPC type (and therefore which base HP/damage curve) a creature gets, and
   * every existing creature's production stats already encode it. Reusing it as
   * a progression level would buff the whole world a second time on the first
   * boot after this change. Omitting `progressionLevel` means "level 1, stats
   * exactly as authored" — the inert migration.
   */
  progressionLevel?: number;
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
  "live_muck_monster" | "live_livestock";

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

function productionOutdoorSpawnPointPosition(
  spawnPointId: string,
  fallback: Vec3
): Vec3 {
  const point = HARTHMERE_PRODUCTION_PLACEMENT_MAP.outdoorSpawnPoints.find(
    (candidate) => candidate.id === spawnPointId
  );
  return finiteVec3(point?.position) ?? fallback;
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

// HARTHMERE_REMOTE_CORNER_BOSSES (2026-08-01)
//
// Four solitary apex encounters on measured original-map outdoor columns. The
// sites sit in separate corner quadrants, west of the additive Harthmere
// extension, outside every safe/Muck/robot/business/building exclusion, and at
// least 110 horizontal metres from the nearest existing surface Mucker/Hex
// group. Production grounding still probes each boss's complete authored body
// footprint before persisting the final position and respawn anchor.
export const HARTHMERE_REMOTE_CORNER_BOSS_FIRST_OFFSET = 10_971;
export const HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL = 30;
export const HARTHMERE_REMOTE_CORNER_BOSS_AREA_PREFIX =
  "remote_corner_apex_" as const;

export const HARTHMERE_REMOTE_CORNER_BOSS_LOCATIONS = [
  {
    corner: "northwest",
    areaId: `${HARTHMERE_REMOTE_CORNER_BOSS_AREA_PREFIX}northwest_ridge`,
    areaLabel: "Far Northwest Ridge",
    outdoorSpawnPointId: "outdoor_59_-841",
    fallbackPosition: [59, 21, -841] as Vec3,
    displayName: "Alpha Mucker",
    combatKind: "mux" as const,
    combatHp: 3_600,
    attackDamage: 135,
  },
  {
    corner: "northeast",
    areaId: `${HARTHMERE_REMOTE_CORNER_BOSS_AREA_PREFIX}northeast_headland`,
    areaLabel: "Far Northeast Headland",
    outdoorSpawnPointId: "outdoor_1747_-737",
    fallbackPosition: [1747, 34, -737] as Vec3,
    displayName: "Muck-Scarred Helix",
    combatKind: "hex" as const,
    combatHp: 2_800,
    attackDamage: 175,
  },
  {
    corner: "southwest",
    areaId: `${HARTHMERE_REMOTE_CORNER_BOSS_AREA_PREFIX}southwest_height`,
    areaLabel: "Far Southwest Height",
    outdoorSpawnPointId: "outdoor_99_351",
    fallbackPosition: [99, 106, 351] as Vec3,
    displayName: "Muck-Scarred Helix",
    combatKind: "hex" as const,
    combatHp: 2_800,
    attackDamage: 175,
  },
  {
    corner: "southeast",
    areaId: `${HARTHMERE_REMOTE_CORNER_BOSS_AREA_PREFIX}southeast_lowland`,
    areaLabel: "Far Southeast Lowland",
    outdoorSpawnPointId: "outdoor_1739_255",
    fallbackPosition: [1739, 41, 255] as Vec3,
    displayName: "Alpha Mucker",
    combatKind: "mux" as const,
    combatHp: 3_600,
    attackDamage: 135,
  },
] as const;

export const HARTHMERE_REMOTE_CORNER_BOSS_SEEDS: readonly HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_REMOTE_CORNER_BOSS_LOCATIONS.map((location, index) => ({
    seedId: `remote-corner-boss-${location.corner}-${index + 1}`,
    kind: "ambient_muck_monster" as const,
    entityId: entityIdFromOffset(
      HARTHMERE_REMOTE_CORNER_BOSS_FIRST_OFFSET + index
    ),
    idOffset: HARTHMERE_REMOTE_CORNER_BOSS_FIRST_OFFSET + index,
    displayName: location.displayName,
    areaId: location.areaId,
    areaLabel: location.areaLabel,
    position: productionOutdoorSpawnPointPosition(
      location.outdoorSpawnPointId,
      location.fallbackPosition
    ),
    orientation: [0, 0] as Vec2,
    dialog: "",
    description: `${location.displayName} claims the isolated ${location.areaLabel} as an apex hunting ground.`,
    combatKind: location.combatKind,
    combatLevel: HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL,
    combatHp: location.combatHp,
    attackDamage: location.attackDamage,
    killXp: 2_500,
    progressionLevel: HARTHMERE_REMOTE_CORNER_BOSS_PROGRESSION_LEVEL,
    openWildsEncounter: true,
  }));

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
  const bossSize = harthmereBossVisualForEntity(
    seed.displayName,
    Number(seed.entityId)
  )?.worldSize;
  if (bossSize) {
    return [...bossSize];
  }
  const text = `${seed.displayName} ${seed.species ?? ""}`.toLowerCase();
  if (seed.kind === "ambient_livestock") {
    const animalSpec = harthmereAnimalAssetSpec(seed.species, seed.displayName);
    if (animalSpec) {
      return [...animalSpec.size] as Vec3;
    }
  }
  if (/\b(cow|sheep|rabbit)\b/.test(text)) {
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
  if (/indisworm/.test(text)) {
    return [1.05, 1.9, 1.05];
  }
  if (seed.bountyTier === "boss") {
    return seed.combatKind === "hex" ? [1.45, 2.5, 1.45] : [1.9, 2.25, 1.9];
  }
  if (seed.bountyTier === "elite") {
    return seed.combatKind === "hex" ? [1.15, 2.05, 1.15] : [1.45, 1.7, 1.45];
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

// 140 originally; +36 on 2026-07-26 for the six scattered mixed encounters
// (five Muckers and one Hex each); +24 on 2026-07-27 for the four Road to
// Harthmere groups (two Hexes and four Mucklings each); +6 on 2026-07-28 for the
// named Mossy Muckling hunt pack; +6 on 2026-07-29 for the Cobbled Muckling
// tooth-drop pack; +4 on 2026-08-01 for the four isolated corner apex bosses.
// This is a checked-in bookkeeping figure that
// several tests assert against, so it has to move whenever a monster layout is
// added or removed.
//
// The 2026-07-28 Muck pack relocation deliberately does NOT change this figure:
// the three re-homed families keep their exact counts, ids and names and are
// only split across more anchors.
export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT = 216;

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
    // HARTHMERE_MUCK_PACK_RELOCATION (2026-07-28): this pocket used to sit at
    // [307, 44, -385] — 25 blocks from the centre of the Watchtower Muck
    // Clearing, which put a second four-Mucker guard pack inside the clearing
    // the player is sent to for their first fight. Re-homed to a measured
    // production surface column in the southern meadow so the clearing holds
    // exactly one pack. Its areaId moved with it, which also drops the stale
    // "Watchtower" label from the guards' area text.
    {
      areaId: "south_meadow_guarded_hollow",
      areaLabel: "East Downs Guarded Hollow",
      center: [1115, 69, 31],
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

// HARTHMERE_SCATTERED_MIXED_GROUPS
//
// Six more mixed encounters, spread far apart across the original map. Each is
// one Hex, five Muckers, one cow, two sheep and three rabbits.
//
// GROUNDING — THE ONLY HARD PART
// Harthmere's own terrain is dead flat, so a single feet Y works there. The
// original map is hills, and these seeds ship their AUTHORED Y verbatim unless
// the generated placement map has an entry for them: see
// harthmereGroundedLivestockSeedsInTerritory, whose fallback for an open-wilds
// group is the authored position. A guessed Y therefore buries or floats the
// whole group.
//
// So every anchor below is a column the June production terrain scan actually
// measured — its Y is a real surface, not an estimate — and each was chosen
// because every other measured column within 40 blocks agrees on that height to
// within two voxels. That is the flattest ground the scan can evidence, which
// is what makes one shared Y safe across a group six blocks wide.
//
// Exact per-creature grounding is available and automatic: these seeds flow
// through harthmereGroundedMuckMonsterSeedsInTerritory /
// harthmereGroundedLivestockSeedsInTerritory, which
// scripts/harthmere/build-production-terrain-placement-map.cjs enumerates. Re-run
// that against production and every creature here gets a terrain-probed
// recommendedPosition that the runtime prefers over the authored one.
//
// Each anchor also clears, by construction (all asserted in tests):
//   * every muck territory, safe zone, robot-protected area and helper-quest
//     exclusion — via harthmereOpenWildsMixedGroupPositionIsValid;
//   * the additive Harthmere town and its forest, which live east of
//     HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X;
//   * every pre-existing Hex, Mucker, cow, sheep and rabbit, by at least
//     HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE blocks.
// Bands for the two families added on 2026-07-26. Chapter 1 owns 10500..10599
// (see CH1_NPC_ID_OFFSET_BASE), forest/scattered creatures use 10601..10776,
// road groups use 10801..10868, and the remapped late bandits use 10901..10905.
// Every family must remain clear of those declared ranges.
//   forest wildlife   10601..10635  (35 animals)
//   scattered monsters 10701..10736 (6 groups x 6)
//   scattered animals  10741..10776 (6 groups x 6)
const HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_FIRST_OFFSET = 10601;
const HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_FIRST_OFFSET = 10701;
const HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_FIRST_OFFSET = 10741;

export const HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE = 60;

export const HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS: readonly HarthmereGuardedWildlifeLocation[] =
  [
    {
      areaId: "far_north_wilds_shelf",
      areaLabel: "Far North Wilds Shelf",
      center: [1123, 32, -945],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
    },
    {
      areaId: "north_reach_pinefall",
      areaLabel: "North Reach Pinefall",
      center: [1731, 32, -937],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
    },
    {
      areaId: "high_downs_terrace",
      areaLabel: "High Downs Terrace",
      center: [1347, 53, -777],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
    },
    {
      areaId: "east_marches_flat",
      areaLabel: "East Marches Flat",
      center: [1723, 48, -545],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
    },
    {
      areaId: "old_wood_west_clearing",
      areaLabel: "Old Wood West Clearing",
      center: [899, 48, -425],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
    },
    {
      areaId: "south_reach_meadow",
      areaLabel: "South Reach Meadow",
      center: [1411, 47, 63],
      animalCounts: { cow: 1, sheep: 2, rabbit: 3 },
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
  /**
   * Every `hexEvery`-th member is a Hexer. `0` means the pack has NO Hexers at
   * all — `hexerName` is then unreachable and only kept for readability.
   */
  hexEvery: number;
  displayIndexBase?: number;
  /**
   * HARTHMERE_MUCK_PACK_RELOCATION: pack was re-homed into the open Wilds. See
   * `wildsRelocatedPack` on the seed for why this is not an areaId list.
   */
  relocatedToWilds?: boolean;
  /**
   * HARTHMERE_AUTHORED_MUCK_PACK: exact per-member positions, used instead of
   * the sunflower spread. Each entry must be a real measured surface column;
   * `authoredMuckPack` then stops the runtime from re-rolling them.
   */
  authoredPositions?: readonly ReadonlyVec3[];
  authoredMuckPack?: boolean;
  /**
   * HARTHMERE_QUEST_GUARANTEED_DROP: original-snapshot Bikkie items every
   * member of this pack drops on death, in addition to its family loot. Used
   * where a snapshot quest checks `inventoryHas` for an item the restored world
   * has no other source of.
   */
  questDropBikkieItems?: ReadonlyArray<{
    bikkieItemId: BiomesId;
    count: number;
  }>;
}

// HARTHMERE_WATCHTOWER_MUCKLING_PACK (2026-07-28)
//
// The ONE pack that stays in the Watchtower Muck Clearing, centred on the column
// the player actually died on (HAR `mukcig_movie.har`: local player at
// [349.4, 39, -378.7], death chat message spatial position
// [337.594, 26, -391.652], killed by "a Old Wood Mucker").
//
// Why every position is written out instead of generated
// ------------------------------------------------------
// This ground is NOT flat: the fourteen columns below span feet Y 31..40 inside a
// 14-block radius. The generated sunflower spread shares ONE Y across the whole
// pack, which here would bury or float most of it. Each entry is instead a
// `recommendedPosition` that the June production terrain scan measured directly
// (`generated/production_terrain_placement_map.ts`, `source:
// "live_muck_monster"`), i.e. a real standable surface — the same evidence
// standard the road packs use, just reused rather than re-probed.
//
// These are the columns previously occupied by the eight different Mucker, Hexer
// and Muckling families that the map-wide redistribution piled into this one
// clearing. They are now held by a single Muckling family, so the clearing reads
// as one encounter and the Old Wood / Gravewood / West Breach / Road families
// are back in (or relocated away from) their own territory.
const HARTHMERE_WATCHTOWER_MUCKLING_AUTHORED_POSITIONS: readonly ReadonlyVec3[] =
  [
    [335.059, 35, -393.185],
    [333.365, 38, -391.303],
    [334.862, 34, -395.472],
    [339.188, 31, -386.628],
    [331.06, 37, -392.854],
    [343.036, 38, -387.655],
    [345.371, 38, -389.842],
    [342.239, 38, -384.744],
    [345.532, 31, -395.887],
    [339.997, 33, -402.35],
    [329.331, 39, -399.425],
    [328.015, 39, -385.424],
    [337.539, 40, -379.776],
    [331.769, 40, -378.893],
  ] as const;

// HARTHMERE_MUCK_PACK_RELOCATION (2026-07-28)
//
// Where the three homeless Muck families went, and why they had to move.
//
// The bug: `harthmereGroundedMuckMonsterSeedsInTerritory` used to pool ALL ~100
// authored Muck monsters and scatter them at random across every non-safe Muck
// containment area. There are six such areas but only FOUR distinct centres —
// `watchtower_muck_patch` / `watchtower_muck_clearing` share [332, -390] and
// `old_wood_muck_patch` / `old_wood_mucker_copse` share [640, -455]. So the pool
// collapsed onto four points at ~25 monsters each. Measured from the HAR above:
// 32 hostiles from EIGHT families within 60 blocks of one death column.
//
// The fix is two-part: each remaining family now spreads inside ITS OWN Muck
// area (see `harthmereOwnMuckContainmentAreaForSeed`), and the three families
// left without an area of their own move out here:
//
//   * `road_muckwad_patch` (15) — its own Muck zone overlaps the Grove/town safe
//     radius, so it never had a legal home and was pure overflow. Splits 3x5.
//   * `watchtower_muck_clearing` (14) — nested on the Watchtower patch. Splits 2x7.
//   * `old_wood_mucker_copse` (14) — nested on the Old Wood patch. Splits 2x7.
//
// Grounding: every anchor is a measured outdoor surface column from the June
// production terrain scan. Members start in a compact radius around it, then the
// required production live-creature grounding pass probes each complete body
// footprint and persists the exact supported feet position and respawn anchor.
//
// Placement: each anchor clears, by construction and asserted in tests, every
// safe zone, business safe site, authored building plot, Muck territory,
// robot-protected area and helper-quest exclusion; it stays west of
// `HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X` so nothing lands in the additive
// Harthmere town or woods; and it sits at least
// `HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE` blocks from any other
// creature in the world, with the anchors themselves 80+ blocks apart.
//
// Ids, names and composition are deliberately UNCHANGED. Sub-packs reuse the
// original contiguous idOffset ranges, keep the original display names (so the
// NPC type manifest needs no new entry) and keep the original `hexEvery`, which
// at these sizes reproduces the original Hexer count exactly: 15 @ hexEvery 5
// -> 3 Hexers as 3x(5 @ 5); 14 @ hexEvery 7 -> 2 Hexers as 2x(7 @ 7).
interface HarthmereRelocatedMuckPackAnchor {
  areaId: string;
  areaLabel: string;
  center: ReadonlyVec3;
  count: number;
  firstOffset: number;
  muckerName: string;
  hexerName: string;
  hexEvery: number;
  displayIndexBase: number;
}

export const HARTHMERE_RELOCATED_MUCK_PACK_RADIUS = 5;

/** areaId of the guarded wildlife pocket moved out of the Watchtower clearing. */
export const HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID =
  "south_meadow_guarded_hollow";

/** The six ordinary Watchtower livestock moved out with the crowded encounters. */
export const HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID =
  "watchtower_livestock_western_meadow";
export const HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_LOCATION: HarthmereGuardedWildlifeLocation =
  {
    areaId: HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID,
    areaLabel: "Watchtower Western Meadow",
    center: [1163, 43, -585],
    animalCounts: { cow: 2, sheep: 2, rabbit: 2 },
  };

export const HARTHMERE_RELOCATED_MUCK_PACK_ANCHORS: readonly HarthmereRelocatedMuckPackAnchor[] =
  [
    {
      areaId: "road_muckwad_patch",
      areaLabel: "North Shelf Muckwads",
      center: [643, 25, -905],
      count: 5,
      firstOffset: HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET,
      muckerName: "Road Muckwad",
      hexerName: "Road Lesser Hexer",
      hexEvery: 5,
      displayIndexBase: 0,
    },
    {
      areaId: "road_muckwad_patch",
      areaLabel: "South Reach Muckwads",
      center: [1027, 37, 295],
      count: 5,
      firstOffset: HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET + 5,
      muckerName: "Road Muckwad",
      hexerName: "Road Lesser Hexer",
      hexEvery: 5,
      displayIndexBase: 5,
    },
    {
      areaId: "road_muckwad_patch",
      areaLabel: "Western Lowland Muckwads",
      center: [67, 37, -105],
      count: 5,
      firstOffset: HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET + 10,
      muckerName: "Road Muckwad",
      hexerName: "Road Lesser Hexer",
      hexEvery: 5,
      displayIndexBase: 10,
    },
    {
      areaId: "watchtower_muck_clearing",
      areaLabel: "Southwest Clearing Pack",
      center: [371, 48, 303],
      count: 7,
      firstOffset: 9495,
      muckerName: "Watchtower Clearing Mucker",
      hexerName: "Watchtower Clearing Hexer",
      hexEvery: 7,
      displayIndexBase: 0,
    },
    {
      areaId: "watchtower_muck_clearing",
      areaLabel: "Eastern Wilds Clearing Pack",
      center: [1419, 55, -489],
      count: 7,
      firstOffset: 9502,
      muckerName: "Watchtower Clearing Mucker",
      hexerName: "Watchtower Clearing Hexer",
      hexEvery: 7,
      displayIndexBase: 7,
    },
    {
      areaId: "old_wood_mucker_copse",
      areaLabel: "Northwest Pine Copse Pack",
      center: [899, 38, -697],
      count: 7,
      firstOffset: 9523,
      muckerName: "Old Wood Copse Mucker",
      hexerName: "Old Wood Copse Hexer",
      hexEvery: 7,
      displayIndexBase: 0,
    },
    {
      areaId: "old_wood_mucker_copse",
      areaLabel: "Western Pine Copse Pack",
      center: [451, 39, -673],
      count: 7,
      firstOffset: 9530,
      muckerName: "Old Wood Copse Mucker",
      hexerName: "Old Wood Copse Hexer",
      hexEvery: 7,
      displayIndexBase: 7,
    },
  ] as const;

// HARTHMERE_MOSSY_MUCKLING_HUNT (2026-07-28)
//
// "Get the Muck Out" asks the player to defeat 6 Mossy Mucklings with their
// Whacker, and until now NO creature in the world was called that. The quest
// leaf accepted West Breach and Gravewood Pale Mucklings as stand-ins and its
// map marker pointed at [334, 40, -389] — the Watchtower clearing — where the
// redistribution happened to leave a handful of them among 32 other hostiles.
// The objective was therefore unreadable: the right enemies were unnamed, in the
// wrong place, and buried in a crowd.
//
// This is a real six-strong "Mossy Muckling" pack of its own, on the closest
// production-scanned outdoor point to the Grove that is outside every authored
// safe zone, business safe site, building plot, Muck territory and robot field;
// west of the additive Harthmere town/woods; and clear of every other creature
// encounter. `NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION` points the map
// marker here.
//
// Grounding: [531, 68, -33] is a production-scanned outdoor surface. The
// deploy-time live-creature grounding pass probes every member's complete body
// footprint and persists its exact supported feet position.
export const HARTHMERE_MOSSY_MUCKLING_AREA_ID = "grove_east_mossy_hollow";
export const HARTHMERE_MOSSY_MUCKLING_AREA_LABEL = "Grove East Mossy Hollow";
export const HARTHMERE_MOSSY_MUCKLING_NAME = "Mossy Muckling";
export const HARTHMERE_MOSSY_MUCKLING_COUNT = 6;
export const HARTHMERE_MOSSY_MUCKLING_FIRST_OFFSET = 10951;
export const HARTHMERE_MOSSY_MUCKLING_ANCHOR: ReadonlyVec3 = [531, 68, -33];
export const HARTHMERE_MOSSY_MUCKLING_RADIUS = 4;

// HARTHMERE_COBBLED_MUCKLING_HUNT (2026-07-29)
//
// "In Storage" (snapshot quest 1543579399492851) opens with Ol' Coop telling
// the player that *Cobbled Mucklings* stormed down from Muckerhorn and wrecked
// his storage, then asks for six **Mucker Teeth** from them. The objective is
// an `inventoryHas` leaf, so — unlike "Nuthin' to Muck With", which is a kill
// count and is already served by the type aliases in
// `native_combat_quest_routing.ts` — no amount of kill-id aliasing can satisfy
// it. Nothing in the restored world drops a Mucker Tooth at all, and no
// creature carries the name the dialogue uses. The quest is unfinishable.
//
// The repair follows HARTHMERE_MOSSY_MUCKLING_HUNT exactly: a real, named,
// six-strong "Cobbled Muckling" pack of its own, with a guaranteed Mucker Tooth
// drop, so six kills yield exactly the six teeth the leaf asks for.
//
// Grounding: these six columns are the positions the ORIGINAL May 2026 snapshot
// placed Cobbled Muckling entities on (source entities 7730989858431516,
// 4798878097356869, 7316152894825690, 3830695482962746, 4547357347013313 and
// 8158919683013070) — the Muckerhorn slope 70–85 blocks west-north-west of
// Ol' Coop at [190.7, 80, 94.7], on the way up to Lauriel and the mine. Because
// each member keeps its own measured Y, the pack follows the slope instead of
// inheriting one centre Y across eleven voxels of relief; `authoredMuckPack`
// stops the in-area re-roll from throwing that measurement away.
//
// Placement, all asserted in `native_post_gimme_world.test.ts`: every column is
// outside every safe zone, Muck containment area, business safe site, authored
// building plot and robot-protected area; west of
// HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X so it cannot land in the additive
// Harthmere town; and more than
// HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE from any other seeded
// creature, so the pack is never buried in a crowd the way the pre-relocation
// Watchtower pile-up was.
export const HARTHMERE_COBBLED_MUCKLING_AREA_ID = "muckerhorn_cobbled_slope";
export const HARTHMERE_COBBLED_MUCKLING_AREA_LABEL = "Muckerhorn Cobbled Slope";
export const HARTHMERE_COBBLED_MUCKLING_NAME = "Cobbled Muckling";
export const HARTHMERE_COBBLED_MUCKLING_FIRST_OFFSET = 10961;
export const HARTHMERE_COBBLED_MUCKLING_ANCHOR: ReadonlyVec3 = [
  115.5, 73, 121.5,
];
/** Snapshot Bikkie id of Mucker Tooth; the only item In Storage accepts. */
export const HARTHMERE_MUCKER_TOOTH_BIKKIE_ITEM_ID =
  1534621126189454 as BiomesId;
/** Six members, one guaranteed tooth each, six teeth required. */
export const HARTHMERE_COBBLED_MUCKLING_AUTHORED_POSITIONS: readonly ReadonlyVec3[] =
  [
    [115.5, 73, 121.5],
    [120.5, 76, 122.5],
    [112.5, 72, 122.5],
    [109.5, 71, 121.5],
    [110.0, 69, 117.5],
    [127.5, 80, 125.5],
  ] as const;
export const HARTHMERE_COBBLED_MUCKLING_COUNT =
  HARTHMERE_COBBLED_MUCKLING_AUTHORED_POSITIONS.length;

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
    // HARTHMERE_WATCHTOWER_MUCKLING_PACK: the one pack left in the clearing the
    // player is sent to for their first fight. Renamed from "Watchtower Mucker"
    // to a Muckling family and stripped of its Hexer (`hexEvery: 0`) so the
    // area holds exactly one kind of enemy, on individually probed columns.
    {
      areaId: "watchtower_muck_patch",
      areaLabel: "Watchtower Muck Patch",
      count: HARTHMERE_WATCHTOWER_MUCKLING_AUTHORED_POSITIONS.length,
      center: [337.594, 35, -391.652],
      radius: 15,
      firstOffset: 9481,
      muckerName: "Watchtower Muckling",
      hexerName: "Watchtower Muckling",
      hexEvery: 0,
      authoredPositions: HARTHMERE_WATCHTOWER_MUCKLING_AUTHORED_POSITIONS,
      authoredMuckPack: true,
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
    // HARTHMERE_MUCK_PACK_RELOCATION: the three families with no Muck area of
    // their own, split into seven small packs out in the open Wilds.
    ...HARTHMERE_RELOCATED_MUCK_PACK_ANCHORS.map((anchor) => ({
      areaId: anchor.areaId,
      areaLabel: anchor.areaLabel,
      count: anchor.count,
      center: anchor.center,
      radius: HARTHMERE_RELOCATED_MUCK_PACK_RADIUS,
      firstOffset: anchor.firstOffset,
      muckerName: anchor.muckerName,
      hexerName: anchor.hexerName,
      hexEvery: anchor.hexEvery,
      displayIndexBase: anchor.displayIndexBase,
      relocatedToWilds: true,
    })),
    // HARTHMERE_MOSSY_MUCKLING_HUNT: the named pack "Get the Muck Out" asks for.
    {
      areaId: HARTHMERE_MOSSY_MUCKLING_AREA_ID,
      areaLabel: HARTHMERE_MOSSY_MUCKLING_AREA_LABEL,
      count: HARTHMERE_MOSSY_MUCKLING_COUNT,
      center: HARTHMERE_MOSSY_MUCKLING_ANCHOR,
      radius: HARTHMERE_MOSSY_MUCKLING_RADIUS,
      firstOffset: HARTHMERE_MOSSY_MUCKLING_FIRST_OFFSET,
      muckerName: HARTHMERE_MOSSY_MUCKLING_NAME,
      // A starter Whacker hunt must not hide a Hexer in the objective count.
      hexerName: HARTHMERE_MOSSY_MUCKLING_NAME,
      hexEvery: 0,
      relocatedToWilds: true,
    },
    // HARTHMERE_COBBLED_MUCKLING_HUNT: the named pack "In Storage" asks for.
    // Authored (not relocated) because every column is an individually measured
    // snapshot surface; `authoredMuckPack` keeps each member's own Y.
    {
      areaId: HARTHMERE_COBBLED_MUCKLING_AREA_ID,
      areaLabel: HARTHMERE_COBBLED_MUCKLING_AREA_LABEL,
      count: HARTHMERE_COBBLED_MUCKLING_COUNT,
      center: HARTHMERE_COBBLED_MUCKLING_ANCHOR,
      radius: 8,
      firstOffset: HARTHMERE_COBBLED_MUCKLING_FIRST_OFFSET,
      muckerName: HARTHMERE_COBBLED_MUCKLING_NAME,
      // A six-kill, six-tooth contract must not hide a Hexer in the count.
      hexerName: HARTHMERE_COBBLED_MUCKLING_NAME,
      hexEvery: 0,
      authoredPositions: HARTHMERE_COBBLED_MUCKLING_AUTHORED_POSITIONS,
      authoredMuckPack: true,
      relocatedToWilds: true,
      questDropBikkieItems: [
        { bikkieItemId: HARTHMERE_MUCKER_TOOTH_BIKKIE_ITEM_ID, count: 1 },
      ],
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
    // HARTHMERE_SCATTERED_MIXED_GROUPS: five Muckers and one Hex per group.
    // `hexEvery: 6` makes the sixth of every six a Hex, so the split is exact.
    // Radius 6 keeps the whole pack inside the flat ground the terrain scan
    // evidenced around each anchor.
    ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.map(
      (location, index) => ({
        areaId: location.areaId,
        areaLabel: location.areaLabel,
        count: 6,
        center: location.center,
        radius: 6,
        firstOffset:
          HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_FIRST_OFFSET +
          index * 6,
        // ONE shared name across all six groups, deliberately. The native NPC
        // type key is `monster_${slug(displayName)}`, so a per-area name would
        // demand a per-area entry in HARTHMERE_NATIVE_NPC_ID_MANIFEST — and a
        // missing entry emits an NPC biscuit with an undefined id, which fails
        // the Bikkie overlay and blocks a clean server boot. The original
        // open-wilds groups share "Open Wilds Mucker"/"Open Wilds Hex" for
        // exactly this reason.
        muckerName: "Wilds Pack Mucker",
        hexerName: "Wilds Pack Hex",
        hexEvery: 6,
        displayIndexBase: index * 6,
      })
    ),
  ] as const;

function muckMonsterPositionForLayout(
  layout: HarthmereMuckMonsterSeedLayout,
  index: number
): Vec3 {
  const authored = layout.authoredPositions?.[index];
  if (authored) {
    // Individually terrain-probed column: never re-derive it from the centre.
    return [Number(authored[0]), Number(authored[1]), Number(authored[2])];
  }
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
      // `hexEvery: 0` means the pack has no Hexers at all.
      const isHexer =
        layout.hexEvery > 0 && (index + 1) % layout.hexEvery === 0;
      const displayName = isHexer ? layout.hexerName : layout.muckerName;
      const position = muckMonsterPositionForLayout(layout, index);
      const bountyEligible =
        layout.areaId !== "road_muckwad_patch" &&
        Boolean(muckMonsterAreaForPosition(position, 1.5));
      const bountyTier = !bountyEligible
        ? undefined
        : isHexer || index === 0
          ? ("boss" as const)
          : index === 1
            ? ("elite" as const)
            : undefined;
      return {
        areaId: layout.areaId,
        areaLabel: layout.areaLabel,
        idOffset,
        displayName: `${displayName} ${
          (layout.displayIndexBase ?? 0) + index + 1
        }`,
        position: openWildsTerrainGroundedPosition(position, idOffset),
        bountyTier,
        wildsRelocatedPack: layout.relocatedToWilds === true,
        authoredMuckPack: layout.authoredMuckPack === true,
        questDropBikkieItems: layout.questDropBikkieItems,
      };
    })
  );

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS: HarthmereLiveEntityProductionSeed[] =
  [
    ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SOURCE_SEEDS.map((seed) => {
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
        bountyTier: seed.bountyTier,
        wildsRelocatedPack: seed.wildsRelocatedPack || undefined,
        authoredMuckPack: seed.authoredMuckPack || undefined,
        questDropBikkieItems: seed.questDropBikkieItems,
        orientation: [0, 0] as Vec2,
        dialog: monsterDialog(seed.areaLabel)
          .map((line) => `<text>${line}</text>`)
          .join("{break}"),
        description: `${seed.displayName} prowls the Muck edge near ${seed.areaLabel}.`,
        progressionLevel:
          seed.bountyTier === "boss"
            ? 8
            : seed.bountyTier === "elite"
              ? 5
              : undefined,
        ...combat,
      } satisfies HarthmereLiveEntityProductionSeed;
    }),
    ...HARTHMERE_REMOTE_CORNER_BOSS_SEEDS,
    // HARTHMERE_ROAD_TO_HARTHMERE_GROUPS: the monster half of the four road
    // packs. Joining this array (rather than the layout table) is what puts them
    // through the normal grounding, respawn, reconciliation, and validation
    // paths; the open-Wilds gate below then keeps them out of the map-wide Muck
    // redistribution so a pack can never be scattered away from its animals.
    ...HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
  ];

export const HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_PRODUCTION_COUNT =
  HARTHMERE_INDISWORM_PRODUCTION_COUNT;

export const HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_INDISWORM_SPAWNS.map((spawn, index) => ({
    seedId: spawn.seedId,
    kind: "ambient_muck_monster",
    entityId: spawn.entityId,
    idOffset: spawn.idOffset,
    displayName: `Indisworm ${index + 1}`,
    areaId: spawn.caveId,
    areaLabel: spawn.caveLabel,
    caveId: spawn.caveId,
    position: [...spawn.position],
    orientation: [...spawn.orientation],
    groupId: spawn.groupId,
    dialog: "",
    description: `A human-sized armored cave worm hunting in ${spawn.caveLabel}. Its radial jaws tear at close range and its swollen acid gland launches poison spit.`,
    combatKind: "mux",
    combatLevel: 3,
    combatHp: 92,
    attackDamage: 34,
    killXp: 55,
    progressionLevel: spawn.progressionLevel,
  }));

/** Cavern positions are authored underground and must never use open-sky grounding. */
export function harthmereGroundedCavernMonsterSeeds(): HarthmereLiveEntityProductionSeed[] {
  return HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS.map((seed) => ({
    ...seed,
    position: [...seed.position],
    orientation: [...seed.orientation],
  }));
}

// Huntable, passive-but-retaliating wildlife spread across the muck areas.
// Cows, sheep, and rabbits graze the muck edge, ignore travelers until attacked,
// then defend themselves; when hunted they drop meat and respawn with the rest
// of the muck wildlife. Larger animals carry more HP and drop more meat.
// (road_muckwad_patch is intentionally excluded — it overlaps the Grove/town
// safe radius, so wildlife there would appear "inside the Grove".)
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_AREAS: ReadonlyArray<{
  areaId: string;
  areaLabel: string;
  relocatedLocation?: HarthmereGuardedWildlifeLocation;
}> = [
  { areaId: "west_muck_breach", areaLabel: "West Muck Breach" },
  {
    areaId: "watchtower_muck_clearing",
    areaLabel: "Watchtower Muck Clearing",
    relocatedLocation: HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_LOCATION,
  },
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
    const relocatedLocation = livestockArea.relocatedLocation;
    const area = HARTHMERE_MUCK_CONTAINMENT_AREAS.find(
      (candidate) => candidate.id === livestockArea.areaId
    );
    if (!area && !relocatedLocation) {
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
        const outputAreaId = relocatedLocation?.areaId ?? livestockArea.areaId;
        const outputAreaLabel =
          relocatedLocation?.areaLabel ?? livestockArea.areaLabel;
        return {
          // The entity id is unchanged, but the seed id moves with the authored
          // area so the old production placement-map entry cannot pull this
          // animal back into the Watchtower clearing.
          seedId: `ambient-livestock-${config.species}-${outputAreaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `${config.displayName} ${
            idOffset - HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET + 1
          }`,
          areaId: outputAreaId,
          areaLabel: outputAreaLabel,
          position: relocatedLocation
            ? guardedWildlifePosition(
                relocatedLocation,
                localIndex,
                HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA
              )
            : livestockPositionInMuckArea(area!, localIndex),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes near ${outputAreaLabel}. It ignores travelers until struck, then defends itself.`,
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

// HARTHMERE_SCATTERED_MIXED_GROUPS: the animal half of each new group.
//
// Every creature inherits its anchor's measured surface Y, and the radial
// layout is capped at radius 6 so the whole group stays on the flat ground the
// terrain scan evidenced. Note this deliberately does NOT call
// openWildsTerrainGroundedPosition: that helper reads a hand-probed per-offset
// table built for the original four groups, and returning `position` unchanged
// for an unknown offset would look like grounding without doing any.
export const HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.flatMap(
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
          HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_FIRST_OFFSET +
          locationIndex * speciesOrder.length +
          localIndex;
        const speciesName =
          config.species[0].toUpperCase() + config.species.slice(1);
        return {
          seedId: `scattered-mixed-${config.species}-${location.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffset(idOffset),
          idOffset,
          displayName: `${location.areaLabel} ${speciesName} ${localIndex + 1}`,
          areaId: location.areaId,
          areaLabel: location.areaLabel,
          position: guardedWildlifePosition(
            location,
            localIndex,
            speciesOrder.length
          ),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes in ${
            location.areaLabel
          } beside a Mucker and Hex pack.`,
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

export const HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.filter((seed) =>
    HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.some(
      (location) => location.areaId === seed.areaId
    )
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

// HARTHMERE_FOREST_WILDLIFE: 20 rabbits, 10 sheep and 5 cows scattered through
// the wilds forest outside town.
//
// Grounding is trivial here and that is the point: the additive extension is
// dead flat at HARTHMERE_EXTENSION_FEET_Y, so there is no hill to bury or float
// an animal on. The hard part was the horizontal placement — every position
// comes from harthmereForestWildlifePlacements(), which rejects any column that
// is inside a trunk or bush, has no trees nearby, or sits in the town, on a
// road, or in a muck patch. Treated as town livestock by
// harthmereLiveEntityIsTownLivestock so grounding preserves the authored
// position rather than dragging it to the muck floor.
export const HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS: HarthmereLiveEntityProductionSeed[] =
  harthmereForestWildlifePlacements().map((placement) => {
    const config = HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES.find(
      (candidate) => candidate.species === placement.species
    )!;
    const idOffset =
      HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_FIRST_OFFSET + placement.index;
    const speciesName =
      placement.species[0].toUpperCase() + placement.species.slice(1);
    return {
      seedId: `harthmere_town_forest-wildlife-${placement.species}-${idOffset}`,
      kind: "ambient_livestock" as const,
      entityId: entityIdFromOffset(idOffset),
      idOffset,
      displayName: `Harthmere Forest ${speciesName} ${placement.index + 1}`,
      areaId: "harthmere_town_wilds_forest",
      areaLabel: "Harthmere Wilds Forest",
      position: normalizeHarthmereExtensionOutdoorFeetPosition(
        shiftHarthmereAuthoredPositionToWorld([
          placement.authoredX,
          HARTHMERE_EXTENSION_FEET_Y,
          placement.authoredZ,
        ]),
        2
      ),
      orientation: [0, 0] as Vec2,
      dialog: config.dialog,
      description: `A ${config.displayName.toLowerCase()} browses among the trees of the Harthmere wilds forest.`,
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

// HARTHMERE_COMPENDIUM_ANIMAL_ECS
//
// The animal rows in npc_compendium used to exist only as renderer placements.
// The native-avatar-only renderer correctly stopped drawing those duplicate
// client actors, but no ECS seeder replaced them. Worse, any ad-hoc chicken or
// wildlife seed that did reach the generic livestock path inherited the sheep
// size and could inherit dMucker's presentation. Materialize every authored
// non-cow/sheep/rabbit animal as the same ECS + Bikkie + Anima creature used by
// the proven livestock pipeline. Cow, sheep, and rabbit retain their existing
// dedicated production herds and are intentionally omitted here.
export const HARTHMERE_COMPENDIUM_ANIMAL_SEEDS: HarthmereLiveEntityProductionSeed[] =
  HARTHMERE_REMAINING_NPCS.flatMap((npc) => {
    if (npc.category !== "animal") {
      return [];
    }
    const species = harthmereAnimalAssetSpeciesForLabel(npc.name);
    if (
      !species ||
      species === "cow" ||
      species === "sheep" ||
      species === "rabbit"
    ) {
      return [];
    }
    const spec = HARTHMERE_ANIMAL_ASSET_SPECS[species];
    const idOffset = npc.combatOffset;
    const districtKey = npc.district
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return [
      {
        seedId: `compendium-animal-${npc.id}-${idOffset}`,
        kind: "ambient_livestock" as const,
        entityId: entityIdFromOffset(idOffset),
        idOffset,
        displayName: npc.name,
        areaId: `harthmere_town_compendium_${npc.id}`,
        areaLabel: npc.district,
        position: normalizeHarthmereExtensionOutdoorFeetPosition(
          shiftHarthmereAuthoredPositionToWorld([
            npc.spawn.x,
            HARTHMERE_EXTENSION_FEET_Y,
            npc.spawn.z,
          ]),
          2
        ),
        orientation: [0, npc.spawn.rot] as Vec2,
        dialog: `<text>${npc.name} watches the road.</text>`,
        description: `${npc.name} roams the ${npc.district} and reacts naturally to nearby travelers and danger.`,
        combatKind: "mux" as const,
        combatLevel: Math.max(1, Math.trunc(npc.stats.level)),
        combatHp: Math.max(spec.combatHp, Math.trunc(npc.stats.health)),
        species,
        sizeTier: spec.sizeTier,
        meatUnits: spec.meatUnits,
        attackDamage: spec.attackDamage,
        killXp: spec.killXp,
        groupId: `compendium-wildlife-${districtKey}`,
      } satisfies HarthmereLiveEntityProductionSeed,
    ];
  });

export const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS: HarthmereLiveEntityProductionSeed[] =
  [
    ...HARTHMERE_LIVE_ENTITY_MUCK_WILDLIFE_SEEDS,
    ...HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_ANIMAL_SEEDS,
    ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ...HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
    ...HARTHMERE_LIVE_ENTITY_TOWN_LIVESTOCK_SEEDS,
    ...HARTHMERE_COMPENDIUM_ANIMAL_SEEDS,
    // HARTHMERE_ROAD_TO_HARTHMERE_GROUPS: the animal half of the four road packs.
    ...HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS,
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
  return (
    HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.some(
      (location) => location.areaId === seed.areaId
    ) ||
    // The scattered groups share every rule of the open-wilds groups: authored
    // position preserved (no muck-floor flattening), and the same validity gate
    // applied at grounding time.
    HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.some(
      (location) => location.areaId === seed.areaId
    ) ||
    // HARTHMERE_ROAD_TO_HARTHMERE_GROUPS: same contract again. This is what keeps
    // the four road packs OUT of the ordinary Muck redistribution — without it,
    // `harthmereGroundedMuckMonsterSeedsInTerritory` would deterministically
    // scatter each Hex and Muckling into an unrelated Muck region, leaving their
    // cow, sheep, and rabbits alone on the roadside.
    isHarthmereRoadGroupAreaId(seed.areaId) ||
    // HARTHMERE_MUCK_PACK_RELOCATION: the seven re-homed Muck packs and the
    // Mossy Muckling hunt pack. Keyed off the per-seed flag, NOT the areaId,
    // because their areaIds are still shared with livestock that legitimately
    // stays on the Muck edge (and with the tutorial combat profile).
    seed.wildsRelocatedPack === true ||
    seed.openWildsEncounter === true ||
    // The relocated guarded pocket moves its monsters AND its herd together, so
    // both sides have to leave the Muck-territory gate behind. Its areaId is
    // unique to that pocket, which is why an areaId test is safe here.
    seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID ||
    seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
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
    const productionPosition = runtimeWorldSpace
      ? productionPlacedLiveEntityPosition(seed, "live_livestock", options)
      : undefined;
    const grounded = isOpenWildsGroup
      ? productionPosition &&
        harthmereOpenWildsMixedGroupPositionIsValid(productionPosition)
        ? productionPosition
        : authoredFallback
      : (productionPosition ??
        (harthmereLiveEntityIsGuardedWildlife(seed)
          ? ([...seed.position] as Vec3)
          : authoredFallback));
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
  const point = { x: Number(position[0]), z: Number(position[2]) };
  const insideAuthoredBuildingPlot = BUILDING_SYSTEM_PLOTS.some(
    (plot) =>
      point.x >= plot.bounds.xMin &&
      point.x <= plot.bounds.xMax &&
      point.z >= plot.bounds.zMin &&
      point.z <= plot.bounds.zMax
  );
  return (
    position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    !harthmereMuckMonsterPositionIsInSafeZone(position) &&
    !muckMonsterAreaForPosition(position, 1.5) &&
    !isLiveEntityHelperQuestExcludedPosition(position) &&
    !liveEntityRobotProtectionAreaForPosition(position) &&
    !isPointInsideHarthmereBusinessSafeSite(point) &&
    !insideAuthoredBuildingPlot
  );
}

/**
 * Production terrain reconciliation may adjust an authored open-world creature
 * a few columns to find complete body support, but it must keep the creature in
 * the same legal encounter footprint and never walk it into protection or a
 * building while searching.
 */
export function harthmereOpenWildsGroundingPositionIsValidForSeed(
  seed: HarthmereLiveEntityProductionSeed,
  position: ReadonlyVec3,
  maxHorizontalAdjustment = 16
): boolean {
  return (
    harthmereLiveEntityIsOpenWildsMixedGroup(seed) &&
    Math.hypot(
      Number(position[0]) - Number(seed.position[0]),
      Number(position[2]) - Number(seed.position[2])
    ) <= maxHorizontalAdjustment &&
    harthmereOpenWildsMixedGroupPositionIsValid(position)
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

// HARTHMERE_MEASURED_MUCK_COLUMNS (2026-07-28)
//
// Per-Muck-area pools of REAL, terrain-probed surface columns.
//
// Why this is needed at all: the per-area spread below computes an X/Z inside the
// right territory, but it has no way to know the surface height there — the
// authored fallback is the flat `HARTHMERE_MUCK_FLOOR_FEET_Y` (53), and the Muck
// ground around the Watchtower alone runs from feet Y 31 to 45. Shipping that
// fallback would bury or float most of the world's Muck monsters. Meanwhile the
// generated placement map DOES hold a probed column per seed — but keyed by
// seedId, i.e. pinned to wherever the old map-wide pooling happened to put that
// creature. Consulting it directly is what silently re-created the pile-up.
//
// So this re-uses the same measurements, sorted into the territory each column
// physically sits in. Assignment below is then a pure permutation of columns the
// June production scan actually measured: no new terrain guesses, no flat-floor
// fallback, and a monster can only ever stand where something already stood.
//
// A column is pooled under an area only if it is strictly inside that area's
// containment radius. Nested areas therefore share columns, which is harmless
// today because only ONE of each nested pair still holds monsters — the two
// nested outer zones (`watchtower_muck_clearing`, `old_wood_mucker_copse`) were
// the families relocated to the open Wilds.
function harthmereMeasuredMuckColumnPools(): ReadonlyMap<
  string,
  readonly Vec3[]
> {
  const claimed = new Set(
    HARTHMERE_WATCHTOWER_MUCKLING_AUTHORED_POSITIONS.map(
      (position) => `${position[0]}|${position[2]}`
    )
  );
  const pools = new Map<string, Vec3[]>();
  const records =
    HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements as readonly HarthmereProductionPlacementRecord[];
  for (const record of records) {
    if (record.placementMode !== "outdoor_surface") continue;
    if (
      record.source !== "live_muck_monster" &&
      record.source !== "live_livestock"
    ) {
      continue;
    }
    const column = finiteVec3(record.recommendedPosition);
    if (!column) continue;
    // Columns held by an authored pack are off the table, so the spread can
    // never stack a monster on top of one of them.
    if (claimed.has(`${column[0]}|${column[2]}`)) continue;
    for (const area of HARTHMERE_MUCK_CONTAINMENT_AREAS) {
      const distance = Math.hypot(
        column[0] - Number(area.center[0]),
        column[2] - Number(area.center[2])
      );
      if (distance > area.radius) continue;
      const pool = pools.get(area.id);
      if (pool) {
        pool.push(column);
      } else {
        pools.set(area.id, [column]);
      }
    }
  }
  // Deterministic order so the assignment is reproducible across processes and
  // by the deploy reconciler.
  for (const pool of pools.values()) {
    pool.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  }
  return pools;
}

let MEASURED_MUCK_COLUMN_POOLS:
  ReadonlyMap<string, readonly Vec3[]> | undefined;

function measuredMuckColumnPool(areaId: string): readonly Vec3[] {
  MEASURED_MUCK_COLUMN_POOLS ??= harthmereMeasuredMuckColumnPools();
  return MEASURED_MUCK_COLUMN_POOLS.get(areaId) ?? [];
}

/** Measured-column supply vs. demand, asserted by the containment tests. */
export function harthmereMeasuredMuckColumnPoolSizes(): Record<string, number> {
  MEASURED_MUCK_COLUMN_POOLS ??= harthmereMeasuredMuckColumnPools();
  return Object.fromEntries(
    [...MEASURED_MUCK_COLUMN_POOLS].map(([areaId, pool]) => [
      areaId,
      pool.length,
    ])
  );
}

// HARTHMERE_MUCK_PACK_RELOCATION: the Muck area a seed actually belongs to.
//
// This replaced a map-wide random pick. The pick looked like it spread monsters
// evenly over six areas, but `watchtower_muck_patch`/`watchtower_muck_clearing`
// and `old_wood_muck_patch`/`old_wood_mucker_copse` are nested pairs sharing one
// centre, so the ~100 pooled monsters actually collapsed onto four points at
// ~25 each — eight different families stacked on top of one another. Keeping a
// family inside its own declared territory is what makes each Muck zone read as
// a single encounter.
//
// Returns undefined when the seed's own area is missing or safe (the Grove-
// overlapping `road_muckwad_patch`); those families are relocated to the open
// Wilds instead and never reach this path.
function harthmereOwnMuckContainmentAreaForSeed(
  seed: HarthmereLiveEntityProductionSeed,
  areas: readonly HarthmereMuckContainmentArea[]
): HarthmereMuckContainmentArea | undefined {
  return areas.find((area) => area.id === seed.areaId);
}

/**
 * Every ordinary in-Muck monster of an area, in authored order. Used to give each
 * member a distinct rank, so the column assignment below is a permutation rather
 * than a lottery that can seat two monsters on one column.
 */
function harthmereOrdinaryMuckSeedRanks(): ReadonlyMap<number, number> {
  const ranks = new Map<number, number>();
  const nextRankByArea = new Map<string, number>();
  for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS) {
    if (
      seed.authoredMuckPack ||
      seed.wildsRelocatedPack ||
      harthmereLiveEntityIsGuardedWildlife(seed) ||
      harthmereLiveEntityIsOpenWildsMixedGroup(seed)
    ) {
      continue;
    }
    const rank = nextRankByArea.get(seed.areaId) ?? 0;
    nextRankByArea.set(seed.areaId, rank + 1);
    ranks.set(seed.idOffset, rank);
  }
  return ranks;
}

let ORDINARY_MUCK_SEED_RANKS: ReadonlyMap<number, number> | undefined;

/**
 * A measured surface column inside `area` for this seed.
 *
 * Deterministic: the pool is rotated by a hash of the area id so the mapping is
 * not simply "authored order = west to east", then indexed by the seed's rank.
 * Falls back to the random in-area point (flat Muck floor Y) only if an area has
 * fewer measured columns than members, which
 * `harthmere_muck_monster_containment.test.ts` asserts never happens.
 */
function measuredMuckPositionForSeed(
  seed: HarthmereLiveEntityProductionSeed,
  area: HarthmereMuckContainmentArea,
  stableSeed: number
): Vec3 {
  const pool = measuredMuckColumnPool(area.id);
  ORDINARY_MUCK_SEED_RANKS ??= harthmereOrdinaryMuckSeedRanks();
  const rank = ORDINARY_MUCK_SEED_RANKS.get(seed.idOffset);
  if (pool.length === 0 || rank === undefined || rank >= pool.length) {
    return muckMonsterRandomPosition(area, stableSeed);
  }
  const rotation = Math.floor(
    harthmereSpawnRng(
      [...area.id].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) | 0, 7)
    )() * pool.length
  );
  const column = pool[(rank + rotation) % pool.length];
  return [column[0], column[1], column[2]];
}

// Ordinary authored muck monsters are randomly (but deterministically) spread
// inside THEIR OWN non-safe muck region. The guarded-herd packs, the open-Wilds
// groups and the relocated packs retain their authored local positions. A final
// hard guard re-rolls any position that resolves into a safe zone — a monster
// can NEVER end up in the Grove.
export function harthmereGroundedMuckMonsterSeedsInTerritory(
  options: HarthmereLiveEntityGroundingOptions = {}
): HarthmereLiveEntityProductionSeed[] {
  const areas = harthmereNonSafeMuckAreas();
  const fallbackArea = areas[0];
  const runtimeWorldSpace = options.useProductionPlacementMap !== false;
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.flatMap((seed, index) => {
    const stableSeed = Number.isFinite(seed.idOffset) ? seed.idOffset : index;
    const isOpenWildsGroup = harthmereLiveEntityIsOpenWildsMixedGroup(seed);
    let position: Vec3;
    // True once the position is already a terrain-probed column, which means the
    // seedId-keyed placement map must not be consulted — see below. Only ever set
    // in runtime world space: with `useProductionPlacementMap: false` the caller
    // is either the placement-map generator or local dev, whose terrain is the
    // flat `HARTHMERE_MUCK_FLOOR_FEET_Y` plane, and a real production Y would
    // bury the whole world there.
    let measuredColumn = false;
    if (seed.authoredMuckPack) {
      // HARTHMERE_AUTHORED_MUCK_PACK: every member sits on its own measured
      // surface column. Re-rolling inside the area would discard that and hand
      // the whole pack one shared Y over ground that spans nine voxels.
      position = [...seed.position] as Vec3;
      measuredColumn = runtimeWorldSpace;
    } else if (harthmereLiveEntityIsGuardedWildlife(seed) || isOpenWildsGroup) {
      // These four packs were authored as guards for specific new herds. Do
      // not feed them through the legacy map-wide Mucker redistribution or the
      // animals and their supposed guards end up hundreds of blocks apart.
      // Deployment still terrain-probes this local X/Z and persists the final
      // grounded Y, just like the animals in the same encounter pocket.
      position = [...seed.position] as Vec3;
    } else if (areas.length === 0) {
      position = snapshotCombatGroundedPosition(seed.position);
    } else {
      // A measured surface column inside this creature's OWN muck region.
      // Falling back to the first non-safe area only covers a seed whose declared
      // area was deleted; every shipped family has its own entry.
      const area =
        harthmereOwnMuckContainmentAreaForSeed(seed, areas) ?? fallbackArea;
      if (runtimeWorldSpace) {
        position = measuredMuckPositionForSeed(seed, area, stableSeed);
        measuredColumn = true;
      } else {
        position = muckMonsterRandomPosition(area, stableSeed);
      }
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
    const authoredFallbackPosition = groundMuckEntityFeet(position);
    const fallbackPosition =
      isOpenWildsGroup ||
      measuredColumn ||
      (runtimeWorldSpace && harthmereLiveEntityIsGuardedWildlife(seed))
        ? ([...position] as Vec3)
        : authoredFallbackPosition;
    // HARTHMERE_MEASURED_MUCK_COLUMNS: the generated placement map is keyed by
    // seedId, and these seedIds are unchanged, so it still holds the column each
    // member occupied under the OLD map-wide pooling — for most of the world that
    // is a different Muck region entirely. Consulting it would silently undo the
    // whole relocation, which is exactly how the eight-family pile-up survived a
    // first attempt at this fix. Skipping it costs nothing: the position above is
    // ALREADY one of this map's probed columns, just re-seated into the territory
    // the creature is authored to belong to.
    const productionPosition =
      runtimeWorldSpace && !measuredColumn
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
    ...harthmereGroundedCavernMonsterSeeds().map((seed) => seed.entityId),
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
    ...harthmereGroundedCavernMonsterSeeds(),
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
  ...HARTHMERE_LIVE_ENTITY_CAVERN_MONSTER_SEEDS,
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
    if (
      seed.idOffset >= CH1_NPC_ID_OFFSET_BASE &&
      seed.idOffset < CH1_NPC_ID_OFFSET_LIMIT_EXCLUSIVE
    ) {
      errors.push(`${seed.seedId}:uses_reserved_chapter1_id_offset`);
    }
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
    const caveId = "caveId" in seed ? seed.caveId : undefined;
    const isCavernMonster = caveId !== undefined;
    if (
      isCavernMonster &&
      !isPositionInsideHarthmereIndiswormCave(caveId, seed.position)
    ) {
      errors.push(`${seed.seedId}:outside_cavern_bounds`);
    }
    const isOpenWildsGroup = harthmereLiveEntityIsOpenWildsMixedGroup(seed);
    if (
      isLiveEntityHelperQuestExcludedPosition(seed.position) &&
      !muckTerritory &&
      !harthmereLiveEntityIsTownLivestock(seed) &&
      !isOpenWildsGroup &&
      !isCavernMonster &&
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
      !isOpenWildsGroup &&
      !isCavernMonster
    ) {
      errors.push(`${seed.seedId}:monster_outside_muck_territory`);
    }
  }
  return errors;
}
