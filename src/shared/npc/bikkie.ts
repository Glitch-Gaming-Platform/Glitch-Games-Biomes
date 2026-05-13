import { getBiscuits } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type {
  EcsResourceDeps,
  EcsResources,
} from "@/shared/game/ecs_resources";
import type { Item } from "@/shared/game/item";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import type { MovementType } from "@/shared/npc/npc_types";
import { ok } from "assert";


export const LOCAL_DEV_HUMAN_NPC_TYPE_ID = 8_810_000_000_020_001 as BiomesId;

function isLocalDevHumanNpcTypeId(maybeId: BiomesId): boolean {
  return maybeId === LOCAL_DEV_HUMAN_NPC_TYPE_ID;
}

function localDevHumanNpcType(id: BiomesId): Item {
  return {
    id,
    name: "local_dev_human",
    displayName: "Local Dev Townsperson",
    isPlayerLikeAppearance: true,
    boxSize: [0.6, 1.8, 0.6],
    walkSpeed: 2.2,
    runSpeed: 4.4,
    behavior: {
      fly: false,
      swim: false,
      damageable: { maxHp: 20, attackable: false },
      chaseAttack: undefined,
      questGiver: false,
      hideNameOverlay: { hideNameOverlay: false },
    },
    ttl: undefined,
    npcNameGenerator: undefined,
    npcAppearanceGenerator: undefined,
    npcDefaultDialog: "Welcome to the local dev starter town.",
    effectsProfile: undefined,
    galoisPath: undefined,
  } as unknown as Item;
}

export function getMovementTypeByNpcType(npcType: NpcType): MovementType {
  if (npcType.behavior.swim) {
    return "swimming";
  } else if (npcType.behavior.fly) {
    return "flying";
  } else {
    return "walking";
  }
}

// Compute the speed when the NPC changes from walking to running.
export function getRunSpeedByNpcType(npcType: NpcType): number {
  return (npcType.walkSpeed + npcType.runSpeed) / 2;
}

export function isNpcTypeId(maybeId: BiomesId): maybeId is BiomesId {
  if (isLocalDevHumanNpcTypeId(maybeId)) {
    return true;
  }
  const biscuit = anItem(maybeId);
  return bikkie.schema.npcs.types.check(biscuit);
}

export function idToNpcType(id: BiomesId) {
  if (isLocalDevHumanNpcTypeId(id)) {
    return localDevHumanNpcType(id);
  }
  const biscuit = anItem(id);
  ok(bikkie.schema.npcs.types.check(biscuit));
  return biscuit;
}

export type NpcType = ReturnType<typeof idToNpcType>;

export function allNpcs(): NpcType[] {
  return [
    ...(getBiscuits("/npcs/types") as NpcType[]),
    localDevHumanNpcType(LOCAL_DEV_HUMAN_NPC_TYPE_ID) as NpcType,
  ];
}

export function isSpawnEventId(maybeId?: BiomesId): maybeId is BiomesId {
  if (!maybeId) {
    return false;
  }
  const biscuit = anItem(maybeId);
  return bikkie.schema.npcs.spawnEvents.check(biscuit);
}

export function idToSpawnEvent(id: BiomesId) {
  const biscuit = anItem(id);
  ok(bikkie.schema.npcs.spawnEvents.check(biscuit));
  return biscuit;
}

export type SpawnEvent = ReturnType<typeof idToSpawnEvent>;

export function spawnEventNpcCount(spawnEvent: SpawnEvent) {
  return spawnEvent.npcBag.reduce((acc, [, count]) => acc + count, 0);
}

export function allSpawnEvents(): SpawnEvent[] {
  return getBiscuits(bikkie.schema.npcs.spawnEvents) as unknown as SpawnEvent[];
}

export function idToNpcEffectProfile(id: BiomesId) {
  const biscuit = anItem(id);
  ok(bikkie.schema.npcs.effectsProfiles.check(biscuit));
  return biscuit.sounds;
}

export type NpcEffectProfile = ReturnType<typeof idToNpcEffectProfile>;

export function npcGlobals() {
  const biscuit = anItem(BikkieIds.npcGlobals);
  ok(bikkie.schema.npcs.globals.check(biscuit));
  return biscuit.npcGlobals;
}

export function relevantBiscuitForEntityId(
  resources: EcsResources | EcsResourceDeps,
  entityId: BiomesId | undefined
): Item | undefined {
  if (!entityId) {
    return undefined;
  }

  return relevantBiscuitForEntity(resources.get("/ecs/entity", entityId));
}

export function relevantBiscuitForEntity(
  entity: ReadonlyEntity | undefined
): Item | undefined {
  if (!entity) {
    return undefined;
  }

  if (entity?.npc_metadata) {
    return anItem(entity.npc_metadata.type_id);
  }

  if (entity?.placeable_component) {
    return anItem(entity.placeable_component.item_id);
  }

  if (entity?.robot_component && entity?.npc_metadata) {
    return anItem(entity.npc_metadata.type_id);
  }

  return undefined;
}
