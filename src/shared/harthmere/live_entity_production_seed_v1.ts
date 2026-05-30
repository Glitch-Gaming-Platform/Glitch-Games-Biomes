import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";
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

export const HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1 = [
  {
    sourceAreaIndex: 0,
    idOffset: 9451,
    displayName: "West Breach Muckling",
    position: [246, 54, -506] as Vec3,
  },
  {
    sourceAreaIndex: 1,
    idOffset: 9452,
    displayName: "Watchtower Mucker",
    position: [338, 54, -386] as Vec3,
  },
  {
    sourceAreaIndex: 2,
    idOffset: 9453,
    displayName: "Old Wood Mucker",
    position: [648, 54, -454] as Vec3,
  },
  {
    sourceAreaIndex: 3,
    idOffset: 9454,
    displayName: "Pale Muckling",
    position: [642, 54, 132] as Vec3,
  },
].map((seed) => {
  const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[seed.sourceAreaIndex];
  return {
    seedId: `ambient-muck-monster-${area.areaId}`,
    kind: "ambient_muck_monster",
    entityId: entityIdFromOffsetV1(seed.idOffset),
    idOffset: seed.idOffset,
    displayName: seed.displayName,
    areaId: area.areaId,
    areaLabel: area.label,
    position: seed.position,
    orientation: [0, 0] as Vec2,
    dialog: monsterDialogV1(area.label)
      .map((line) => `<text>${line}</text>`)
      .join("{break}"),
    description: `${seed.displayName} prowls the Muck edge near ${area.label}.`,
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
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1) {
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
    if (isLiveEntityHelperQuestExcludedPositionV1(seed.position)) {
      errors.push(`${seed.seedId}:inside_excluded_settlement`);
    }
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
    if (
      seed.kind === "robot_sentinel" &&
      (!seed.robotId || !isLiveEntityRobotProtectionAnchorGroundedV1(area))
    ) {
      errors.push(`${seed.seedId}:robot_anchor_not_grounded`);
    }
    if (
      seed.kind === "ambient_muck_monster" &&
      !muckMonsterAreaForPositionV1(seed.position, 1.5)
    ) {
      errors.push(`${seed.seedId}:monster_outside_muck_territory`);
    }
  }
  return errors;
}
