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
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75 } from "./snapshot_grove_content_v75";

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION_V1 =
  "harthmere-live-entity-production-seed-v1" as const;

export type HarthmereLiveEntityProductionSeedKindV1 =
  | "robot_sentinel"
  | "ambient_muck_monster";

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

export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1 = [
  ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
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
