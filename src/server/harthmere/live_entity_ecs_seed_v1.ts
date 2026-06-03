import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  EntityDescription,
  RobotComponent,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, isNpcTypeId } from "@/shared/npc/bikkie";
import {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  harthmereActiveLiveEntityProductionSeedIdsV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  type HarthmereLiveEntityProductionSeedV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";

function changeKindForSeedV1(
  seed: HarthmereLiveEntityProductionSeedV1,
  existingIds: ReadonlySet<BiomesId>
) {
  return existingIds.has(seed.entityId) ? "update" : "create";
}

function proposedFromChangeV1(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereLiveEntityProductionSeedIdsV1() {
  // Only the entities that should actually exist (robots + in-territory muckers),
  // so safe-zone-excluded muckers are never treated as required seeds.
  return harthmereActiveLiveEntityProductionSeedIdsV1();
}

export function buildHarthmereLiveEntityProductionSeedChangesV1(input: {
  tick: number;
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const changes: Change[] = [];
  const monsterTypeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_HUMAN_NPC_TYPE_ID;

  for (const seed of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1) {
    const entity = {
      ...npcEntity(
        {
          id: seed.entityId,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: seed.position,
          orientation: seed.orientation,
          velocity: [0, 0, 0],
          displayName: seed.displayName,
          defaultDialog: seed.dialog,
        },
        input.nowSeconds
      ),
      robot_component: RobotComponent.create({
        internal_battery_charge: seed.energy,
        internal_battery_capacity: seed.maxEnergy,
        last_update: input.nowSeconds,
      }),
      entity_description: EntityDescription.create({
        text: seed.description,
      }),
    };
    changes.push({
      kind: changeKindForSeedV1(seed, existingIds),
      tick: input.tick,
      entity,
    });
  }

  for (const seed of harthmereGroundedMuckMonsterSeedsInTerritoryV1()) {
    const entity = {
      ...npcEntity(
        {
          id: seed.entityId,
          typeId: monsterTypeId,
          position: seed.position,
          orientation: seed.orientation,
          velocity: [0, 0, 0],
          displayName: seed.displayName,
          defaultDialog: seed.dialog,
        },
        input.nowSeconds
      ),
      entity_description: EntityDescription.create({
        text: seed.description,
      }),
    };
    changes.push({
      kind: changeKindForSeedV1(seed, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereLiveEntityProductionSeedProposedChangesV1(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereLiveEntityProductionSeedChangesV1({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChangeV1);
}
