import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec2, Vec3 } from "@/shared/math/types";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1,
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  isLiveEntityRobotProtectionAnchorGroundedV1,
  liveEntityRobotDefaultRobotIdForAreaV1,
  validateLiveEntityRobotProtectionAreasV1,
} from "./live_entity_robot_energy_protection_v1";
import {
  isLiveEntityHelperQuestExcludedPositionV1,
  isPositionInsideLiveEntityHelperBoundsV1,
} from "./live_entity_helper_quests_v1";
import { muckMonsterAreaForPositionV1 } from "./muck_monster_aggression_ai_v1";
import {
  HARTHMERE_MUCK_CONTAINMENT_AREAS_V1,
  type HarthmereMuckContainmentAreaV1,
} from "./harthmere_muck_monster_containment_v1";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75 } from "./snapshot_grove_content_v75";
import {
  SNAPSHOT_SAFE_AREAS_V74,
  authoredSnapshotAreaForPointV74,
  snapshotCombatGroundedPositionV135,
} from "./snapshot_runtime_rules_v74";

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION_V1 =
  "harthmere-live-entity-production-seed-v1" as const;

export type HarthmereLiveEntityProductionSeedKindV1 =
  | "robot_sentinel"
  | "ambient_muck_monster"
  | "ambient_livestock";

export interface HarthmereLiveEntityProductionSeedV1 {
  seedId: string;
  kind: HarthmereLiveEntityProductionSeedKindV1;
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

function entityIdFromOffsetV1(idOffset: number) {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75) +
    idOffset) as BiomesId;
}

function robotDialogV1(areaLabel: string) {
  return [
    `Power steady. ${areaLabel} remains shielded.`,
    "If my energy drops, bring Stabilized Exotic Matter before the Muck spreads.",
    "Recharge assistance pays in XP and field supplies.",
  ];
}

function monsterDialogV1(areaLabel: string) {
  return [
    `The creature drags Muck across the edge of ${areaLabel}.`,
    "It has noticed you.",
  ];
}

function combatDefaultsForMonsterV1(displayName: string): {
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

// HARTHMERE_LIVE_ENTITY_SIZE_V1: the muck/wildlife NPCs reuse one damageable
// creature type, so npcEntity gives them all the SAME box (~0.75x1.8x0.75) — a
// rabbit ended up as tall as a cow. The client mesh scales to the size
// component, so authoring a per-species [width, height, depth] (meters) makes
// each creature visibly its own size (and gives it a right-sized hitbox). Values
// stay roughly in step with the live-mode combat bodyRadius (cow > sheep >
// rabbit; hex taller/thinner than the mucker blob).
export function harthmereLiveEntitySizeForSeedV1(
  seed: HarthmereLiveEntityProductionSeedV1
): Vec3 {
  const text = `${seed.displayName} ${seed.species ?? ""}`.toLowerCase();
  if (seed.kind === "ambient_livestock" || /\b(cow|sheep|rabbit)\b/.test(text)) {
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

export const HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1 =
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.map((area, index) => {
    const displayName = `${area.label} Sentinel`;
    return {
      seedId: `robot-sentinel-${area.areaId}`,
      kind: "robot_sentinel",
      entityId: entityIdFromOffsetV1(9401 + index),
      idOffset: 9401 + index,
      displayName,
      areaId: area.areaId,
      areaLabel: area.label,
      position: [...area.anchor] as Vec3,
      orientation: [0, Math.PI / 2] as Vec2,
      dialog: robotDialogV1(area.label)
        .map((line) => `<text>${line}</text>`)
        .join("{break}"),
      description: `${displayName} keeps nearby Biomes protected from the Muck while its battery holds.`,
      robotId: liveEntityRobotDefaultRobotIdForAreaV1(area.areaId),
      energy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1,
      maxEnergy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1,
    } satisfies HarthmereLiveEntityProductionSeedV1;
  });

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1 = 100;

interface HarthmereMuckMonsterSeedLayoutV1 {
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

const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_LAYOUTS_V1: readonly HarthmereMuckMonsterSeedLayoutV1[] =
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

function muckMonsterPositionForLayoutV1(
  layout: HarthmereMuckMonsterSeedLayoutV1,
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

const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SOURCE_SEEDS_V1 =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_LAYOUTS_V1.flatMap((layout) =>
    Array.from({ length: layout.count }, (_, index) => {
      const idOffset = layout.firstOffset + index;
      const isHexer = (index + 1) % layout.hexEvery === 0;
      const displayName = isHexer ? layout.hexerName : layout.muckerName;
      return {
        areaId: layout.areaId,
        areaLabel: layout.areaLabel,
        idOffset,
        displayName: `${displayName} ${index + 1}`,
        position: muckMonsterPositionForLayoutV1(layout, index),
      };
    })
  );

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1 =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SOURCE_SEEDS_V1.map((seed) => {
  const combat = combatDefaultsForMonsterV1(seed.displayName);
  return {
    seedId: `ambient-muck-monster-${seed.areaId}-${seed.idOffset}`,
    kind: "ambient_muck_monster",
    entityId: entityIdFromOffsetV1(seed.idOffset),
    idOffset: seed.idOffset,
    displayName: seed.displayName,
    areaId: seed.areaId,
    areaLabel: seed.areaLabel,
    position: seed.position,
    orientation: [0, 0] as Vec2,
    dialog: monsterDialogV1(seed.areaLabel)
      .map((line) => `<text>${line}</text>`)
      .join("{break}"),
    description: `${seed.displayName} prowls the Muck edge near ${seed.areaLabel}.`,
    ...combat,
  } satisfies HarthmereLiveEntityProductionSeedV1;
});

// Huntable, passive-but-retaliating wildlife spread across the muck areas.
// Cows, sheep, and rabbits graze the muck edge, ignore travelers until attacked,
// then defend themselves; when hunted they drop meat and respawn with the rest
// of the muck wildlife. Larger animals carry more HP and drop more meat.
// (road_muckwad_patch is intentionally excluded — it overlaps the Grove/town
// safe radius, so wildlife there would appear "inside the Grove".)
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_AREAS_V1: ReadonlyArray<{
  areaId: string;
  areaLabel: string;
}> = [
  { areaId: "west_muck_breach", areaLabel: "West Muck Breach" },
  { areaId: "watchtower_muck_clearing", areaLabel: "Watchtower Muck Clearing" },
  { areaId: "old_wood_mucker_copse", areaLabel: "Old Wood Mucker Copse" },
  { areaId: "gravewood_pale_muck", areaLabel: "Gravewood Pale Muck" },
];

interface HarthmereLivestockSpeciesConfigV1 {
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
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES_V1: readonly HarthmereLivestockSpeciesConfigV1[] =
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

const HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA_V1 =
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES_V1.reduce(
    (total, species) => total + species.perArea,
    0
  );
// Offset band 9551-9574 (24 animals). MUST NOT overlap other authored families:
// grove 9301-9320, robots 9401-9420, muckers 9451-9550, business owners
// 9601-9619, business customers 9701-9757. The previous value (9601) collided
// with the 19 business owners, so 19 of the 24 animals were never created.
const HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET_V1 = 9551;

// Deterministic spread inside the muck area, kept well within radius so animals
// stay grounded in the muck (not on its sloped edge). `indexInArea` covers every
// animal of every species in the area so they don't stack on each other.
function livestockPositionInMuckAreaV1(
  area: HarthmereMuckContainmentAreaV1,
  indexInArea: number
): Vec3 {
  const radius =
    Math.max(0, area.radius - 4) *
    Math.sqrt(
      (indexInArea + 0.5) / Math.max(1, HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA_V1)
    );
  const angle = indexInArea * 2.399963229728653 + 1;
  return [
    Number((area.center[0] + Math.cos(angle) * radius).toFixed(3)),
    area.center[1],
    Number((area.center[2] + Math.sin(angle) * radius).toFixed(3)),
  ];
}

export const HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS_V1: HarthmereLiveEntityProductionSeedV1[] =
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_AREAS_V1.flatMap((livestockArea, areaIndex) => {
    const area = HARTHMERE_MUCK_CONTAINMENT_AREAS_V1.find(
      (candidate) => candidate.id === livestockArea.areaId
    );
    if (!area) {
      return [];
    }
    let indexInArea = 0;
    return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SPECIES_V1.flatMap((config) =>
      Array.from({ length: config.perArea }, () => {
        const localIndex = indexInArea++;
        const idOffset =
          HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET_V1 +
          areaIndex * HARTHMERE_LIVE_ENTITY_LIVESTOCK_PER_AREA_V1 +
          localIndex;
        return {
          seedId: `ambient-livestock-${config.species}-${livestockArea.areaId}-${idOffset}`,
          kind: "ambient_livestock" as const,
          entityId: entityIdFromOffsetV1(idOffset),
          idOffset,
          displayName: `${config.displayName} ${idOffset -
            HARTHMERE_LIVE_ENTITY_LIVESTOCK_FIRST_OFFSET_V1 +
            1}`,
          areaId: livestockArea.areaId,
          areaLabel: livestockArea.areaLabel,
          position: livestockPositionInMuckAreaV1(area, localIndex),
          orientation: [0, 0] as Vec2,
          dialog: config.dialog,
          description: `A ${config.displayName.toLowerCase()} grazes the muck near ${livestockArea.areaLabel}. It ignores travelers until struck, then defends itself.`,
          combatKind: "mux" as const,
          combatLevel: 1,
          combatHp: config.combatHp,
          species: config.species,
          sizeTier: config.sizeTier,
          meatUnits: config.meatUnits,
          attackDamage: config.attackDamage,
          killXp: config.killXp,
        } satisfies HarthmereLiveEntityProductionSeedV1;
      })
    );
  });

// HARTHMERE_MUCK_FLOOR_FEET_Y_V1: the local-dev wilds terrain is intentionally
// flat — every column's surface sits at the starter-town ground (server
// STARTER_TOWN_GROUND_Y = 52), so a standing entity's feet rest one block above
// it. That `feetY = groundY + 1` convention is the same one the Grove NPCs and
// the gathering-node / quest-object markers use (all at feet Y 53). The authored
// muck containment zones, however, use center Y = 54, which seeded every mucker
// and grazing animal floating ~1 block above the ground. Snap seeded wilds
// entities to the real feet height. Muck/danger areas are 2D footprints
// (distance2DToSnapshotAreaV74 ignores Y), so this never changes territory
// gating — only the visible/standing height.
export const HARTHMERE_MUCK_FLOOR_FEET_Y_V1 = 53;

function groundMuckEntityFeetV1(position: Vec3): Vec3 {
  return [position[0], HARTHMERE_MUCK_FLOOR_FEET_Y_V1, position[2]];
}

// Wildlife grounded to the muck floor and kept inside their muck area (mirrors
// the muck-monster grounding). Animals authored outside any muck territory are
// dropped.
export function harthmereGroundedLivestockSeedsInTerritoryV1(): HarthmereLiveEntityProductionSeedV1[] {
  return HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS_V1.flatMap((seed) => {
    const grounded = groundMuckEntityFeetV1(seed.position);
    if (!muckMonsterAreaForPositionV1(grounded, 1.5)) {
      return [];
    }
    return [{ ...seed, position: grounded }];
  });
}

// HARTHMERE_MUCK_MONSTER_CONTAINMENT_V1: the canonical set of muck monsters to
// actually spawn. Each seed position is grounded to the authored muck floor and
// then gated so ONLY monsters that resolve to a real muck territory are kept.
// All 100 authored seeds already validate in-territory (see
// `validateHarthmereLiveEntityProductionSeedsV1`), so this drops nothing today;
// it is a defense-in-depth guarantee that a Hex/Mucker can never be seeded
// outside the muck if the layout data is ever edited.
// HARTHMERE_MUCK_MONSTER_SAFE_ZONE_EXCLUSION_V1:
// A muck monster must never spawn inside an authored SAFE area (the Grove, the
// Harthmere town core, the safe road). The road_muckwad_patch muck zone overlaps
// the Grove/town safe radii, so its ambient muckers would otherwise appear
// "inside the Grove". Drop any monster whose grounded position lands in a safe
// area. (The single authored tutorial hostile in the combat primer is a separate
// seed and is intentionally left in place.)
export function harthmereMuckMonsterPositionIsInSafeZoneV1(
  position: ReadonlyVec3
): boolean {
  return Boolean(
    authoredSnapshotAreaForPointV74(position, SNAPSHOT_SAFE_AREAS_V74, 0)
  );
}

// HARTHMERE_RANDOM_WORLD_SPAWN_V1: small deterministic PRNG (mulberry32). Seeded
// by the creature's stable idOffset so the "random" world spread is identical
// across processes and reproducible by the deploy reconciler — random-looking,
// not actually nondeterministic.
function harthmereSpawnRngV1(seed: number): () => number {
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
function muckMonsterRandomPositionV1(
  area: HarthmereMuckContainmentAreaV1,
  seed: number
): Vec3 {
  const rng = harthmereSpawnRngV1(seed);
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
function harthmereNonSafeMuckAreasV1(): HarthmereMuckContainmentAreaV1[] {
  return HARTHMERE_MUCK_CONTAINMENT_AREAS_V1.filter(
    (area) => !harthmereMuckMonsterPositionIsInSafeZoneV1(area.center)
  );
}

// Every authored muck monster, randomly (but deterministically) spread across
// all non-safe muck regions of the world. A final hard guard re-rolls any
// position that resolves into a safe zone — a monster can NEVER end up in the
// Grove.
export function harthmereGroundedMuckMonsterSeedsInTerritoryV1(): HarthmereLiveEntityProductionSeedV1[] {
  const areas = harthmereNonSafeMuckAreasV1();
  const fallbackArea = areas[0];
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.map((seed, index) => {
    const stableSeed = Number.isFinite(seed.idOffset) ? seed.idOffset : index;
    let position: Vec3;
    if (areas.length === 0) {
      position = snapshotCombatGroundedPositionV135(seed.position);
    } else {
      // Deterministically choose a muck region for this creature, then a random
      // point inside it.
      const areaPick = harthmereSpawnRngV1(stableSeed ^ 0x9e3779b9)();
      const area = areas[Math.min(areas.length - 1, Math.floor(areaPick * areas.length))];
      position = muckMonsterRandomPositionV1(area, stableSeed);
    }
    // Hard guard: if a placement ever lands in a safe zone (it shouldn't, since
    // every source area is non-safe), re-roll it deep inside the fallback area.
    let guard = 0;
    while (
      harthmereMuckMonsterPositionIsInSafeZoneV1(position) &&
      fallbackArea &&
      guard < 8
    ) {
      position = muckMonsterRandomPositionV1(fallbackArea, stableSeed + 1 + guard);
      guard += 1;
    }
    // Snap to the real flat-wilds feet height so muckers stand on the muck floor
    // instead of floating ~1 block above it (authored zone center Y is 54).
    return { ...seed, position: groundMuckEntityFeetV1(position) };
  });
}

// Entity ids of authored muck monsters that are NO LONGER spawned (e.g. they
// landed inside a safe zone like the Grove). A world that was seeded before this
// exclusion still has them, so the production content-sync uses this list to
// delete the stragglers (e.g. the 15 road_muckwad muckers inside the Grove).
export function harthmereExcludedMuckMonsterSeedIdsV1(): BiomesId[] {
  const kept = new Set(
    harthmereGroundedMuckMonsterSeedsInTerritoryV1().map((seed) => seed.entityId)
  );
  return HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.filter(
    (seed) => !kept.has(seed.entityId)
  ).map((seed) => seed.entityId);
}

// The ids that SHOULD exist in the world: every robot sentinel plus only the
// muck monsters that survive the muck-territory + safe-zone gate. This is what
// "expected/required" means for fingerprinting and reconciliation, so the
// excluded (e.g. Grove) muckers are not treated as required and can be removed.
export function harthmereActiveLiveEntityProductionSeedIdsV1(): BiomesId[] {
  return [
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1.map((seed) => seed.entityId),
    ...harthmereGroundedMuckMonsterSeedsInTerritoryV1().map(
      (seed) => seed.entityId
    ),
    ...harthmereGroundedLivestockSeedsInTerritoryV1().map(
      (seed) => seed.entityId
    ),
  ];
}

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1 = [
  ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  ...HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS_V1,
] as const;

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_IDS_V1 =
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1.map((seed) => seed.entityId);

export function validateHarthmereLiveEntityProductionSeedsV1() {
  const errors = [...validateLiveEntityRobotProtectionAreasV1()];
  const seedIds = new Set<string>();
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1) {
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
        ? muckMonsterAreaForPositionV1(seed.position, 1.5)
        : undefined;
    if (
      isLiveEntityHelperQuestExcludedPositionV1(seed.position) &&
      !muckTerritory
    ) {
      errors.push(`${seed.seedId}:inside_excluded_settlement`);
    }
    if (seed.kind === "robot_sentinel") {
      const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.find(
        (candidate) => candidate.areaId === seed.areaId
      );
      if (!area) {
        errors.push(`${seed.seedId}:unknown_area`);
        continue;
      }
      if (!isPositionInsideLiveEntityHelperBoundsV1(seed.position, area.bounds)) {
        errors.push(`${seed.seedId}:outside_area_bounds`);
      }
      if (!seed.robotId || !isLiveEntityRobotProtectionAnchorGroundedV1(area)) {
        errors.push(`${seed.seedId}:robot_anchor_not_grounded`);
      }
    }
    if (
      seed.kind === "ambient_muck_monster" &&
      !muckTerritory
    ) {
      errors.push(`${seed.seedId}:monster_outside_muck_territory`);
    }
  }
  return errors;
}
