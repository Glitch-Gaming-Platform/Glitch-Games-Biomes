import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec2, Vec3 } from "@/shared/math/types";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  isLiveEntityRobotProtectionAnchorGrounded,
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

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION =
  "harthmere-live-entity-production-seed" as const;
export const HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER = 5;

export type HarthmereLiveEntityProductionSeedKind =
  | "robot_sentinel"
  | "ambient_muck_monster"
  | "ambient_livestock";

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

function entityIdFromOffset(idOffset: number) {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
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
  position: [236, 54, -506],
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

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT = 100;

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
      firstOffset: 9466,
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
      return {
        areaId: layout.areaId,
        areaLabel: layout.areaLabel,
        idOffset,
        displayName: `${displayName} ${index + 1}`,
        position: muckMonsterPositionForLayout(layout, index),
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

export const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS: HarthmereLiveEntityProductionSeed[] =
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
  return finiteVec3(placement.recommendedPosition);
}

// Wildlife grounded to the production surface and kept inside their muck area
// (mirrors the muck-monster grounding). Animals authored outside any muck
// territory are dropped.
export function harthmereGroundedLivestockSeedsInTerritory(
  options: HarthmereLiveEntityGroundingOptions = {}
): HarthmereLiveEntityProductionSeed[] {
  return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS.flatMap((seed) => {
    const grounded =
      productionPlacedLiveEntityPosition(seed, "live_livestock", options) ??
      groundMuckEntityFeet(seed.position);
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
// area. (The single authored tutorial hostile in the combat primer is a separate
// seed and is intentionally left in place.)
export function harthmereMuckMonsterPositionIsInSafeZone(
  position: ReadonlyVec3
): boolean {
  return Boolean(
    authoredSnapshotAreaForPoint(position, SNAPSHOT_SAFE_AREAS, 0)
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

// Every authored muck monster, randomly (but deterministically) spread across
// all non-safe muck regions of the world. A final hard guard re-rolls any
// position that resolves into a safe zone — a monster can NEVER end up in the
// Grove.
export function harthmereGroundedMuckMonsterSeedsInTerritory(
  options: HarthmereLiveEntityGroundingOptions = {}
): HarthmereLiveEntityProductionSeed[] {
  const areas = harthmereNonSafeMuckAreas();
  const fallbackArea = areas[0];
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.map((seed, index) => {
    const stableSeed = Number.isFinite(seed.idOffset) ? seed.idOffset : index;
    let position: Vec3;
    if (areas.length === 0) {
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
    const fallbackPosition = groundMuckEntityFeet(position);
    const productionPosition = productionPlacedLiveEntityPosition(
      seed,
      "live_muck_monster",
      options
    );
    if (
      productionPosition &&
      !harthmereMuckMonsterPositionIsInSafeZone(productionPosition) &&
      muckMonsterAreaForPosition(productionPosition, 1.5)
    ) {
      return { ...seed, position: productionPosition };
    }
    return { ...seed, position: fallbackPosition };
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
  ];
}

export function harthmereRespawningLiveCreatureSeedIds(): BiomesId[] {
  return [
    ...harthmereGroundedMuckMonsterSeedsInTerritory().map(
      (seed) => seed.entityId
    ),
    ...harthmereGroundedLivestockSeedsInTerritory().map(
      (seed) => seed.entityId
    ),
  ];
}

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS = [
  ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  ...HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
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
    if (
      isLiveEntityHelperQuestExcludedPosition(seed.position) &&
      !muckTerritory
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
    if (seed.kind === "ambient_muck_monster" && !muckTerritory) {
      errors.push(`${seed.seedId}:monster_outside_muck_territory`);
    }
  }
  return errors;
}
