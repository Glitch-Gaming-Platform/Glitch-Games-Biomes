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
import type { Vec3 } from "@/shared/math/types";
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
    rotateSpeed: 200,
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


// SNAPSHOT_LEGACY_NPC_TYPE_COMPAT_V1:
// The imported 2026-05-16 snapshot contains NPC item records that are valid
// enough to render/simulate, but some fail the newer Glitch NPC schema check.
// Do not let client cursor/combat systems crash just because a legacy NPC type
// is missing a newer optional schema field. Preserve the item when possible and
// add safe defaults for the fields the current runtime expects.
function isSnapshotLegacyNpcLikeItemV1(biscuit: Item | undefined): boolean {
  if (!biscuit) {
    return false;
  }
  const candidate = biscuit as unknown as {
    behavior?: unknown;
    boxSize?: unknown;
    walkSpeed?: unknown;
    runSpeed?: unknown;
    rotateSpeed?: unknown;
    npcDefaultDialog?: unknown;
    isPlayerLikeAppearance?: unknown;
    displayName?: unknown;
    name?: unknown;
  };
  return (
    typeof candidate.name === "string" &&
    (typeof candidate.displayName === "string" ||
      typeof candidate.behavior === "object" ||
      Array.isArray(candidate.boxSize) ||
      typeof candidate.walkSpeed === "number" ||
      typeof candidate.npcDefaultDialog === "string" ||
      typeof candidate.isPlayerLikeAppearance === "boolean")
  );
}

function snapshotLegacyNpcTypeV1(id: BiomesId, biscuit: Item): Item {
  const fallback = localDevHumanNpcType(id) as unknown as Record<string, unknown>;
  const candidate = biscuit as unknown as Record<string, unknown>;
  const fallbackBehavior = (fallback.behavior ?? {}) as Record<string, unknown>;
  const candidateBehavior =
    typeof candidate.behavior === "object" && candidate.behavior !== null
      ? (candidate.behavior as Record<string, unknown>)
      : {};
  return {
    ...fallback,
    ...candidate,
    id,
    name: typeof candidate.name === "string" ? candidate.name : fallback.name,
    displayName:
      typeof candidate.displayName === "string"
        ? candidate.displayName
        : fallback.displayName,
    boxSize: Array.isArray(candidate.boxSize) ? candidate.boxSize : fallback.boxSize,
    walkSpeed:
      typeof candidate.walkSpeed === "number" ? candidate.walkSpeed : fallback.walkSpeed,
    runSpeed:
      typeof candidate.runSpeed === "number" ? candidate.runSpeed : fallback.runSpeed,
    rotateSpeed:
      typeof candidate.rotateSpeed === "number"
        ? candidate.rotateSpeed
        : fallback.rotateSpeed,
    behavior: {
      ...fallbackBehavior,
      ...candidateBehavior,
    },
  } as unknown as Item;
}

function idToNpcTypeInternalV1(id: BiomesId, soft: boolean) {
  if (isLocalDevHumanNpcTypeId(id)) {
    return localDevHumanNpcType(id);
  }
  const biscuit = anItem(id);
  if (bikkie.schema.npcs.types.check(biscuit)) {
    return biscuit;
  }
  if (isSnapshotLegacyNpcLikeItemV1(biscuit)) {
    return snapshotLegacyNpcTypeV1(id, biscuit);
  }
  if (soft) {
    return undefined;
  }
  ok(bikkie.schema.npcs.types.check(biscuit));
  return biscuit;
}

export function getMovementTypeByNpcType(npcType: NpcType): MovementType {
  const behavior = getNpcBehavior(npcType);
  if (behavior.swim) {
    return "swimming";
  } else if (behavior.fly) {
    return "flying";
  } else {
    return "walking";
  }
}

// Compute the speed when the NPC changes from walking to running.
export function getRunSpeedByNpcType(npcType: NpcType): number {
  return (getNpcWalkSpeed(npcType) + getNpcRunSpeed(npcType)) / 2;
}

export function isNpcTypeId(maybeId: BiomesId): maybeId is BiomesId {
  return idToNpcTypeInternalV1(maybeId, true) !== undefined;
}

export function idToNpcType(id: BiomesId) {
  return idToNpcTypeInternalV1(id, false);
}

export type NpcType = ReturnType<typeof idToNpcType>;

export function maybeIdToNpcType(id: BiomesId): NpcType | undefined {
  return idToNpcTypeInternalV1(id, true) as NpcType | undefined;
}

// Defensive defaults used by local-dev/Harthmere NPCs and by older biscuits that
// may not define every behavior/sizing field now required by stricter TS checks.
// Keep these centralized so gameplay code does not invent different fallbacks.
const DEFAULT_NPC_BOX_SIZE: Vec3 = [0.6, 1.8, 0.6];
const DEFAULT_NPC_WALK_SPEED = 2.2;
const DEFAULT_NPC_RUN_SPEED = 4.4;
const DEFAULT_NPC_ROTATE_SPEED = 180;
const DEFAULT_NPC_BEHAVIOR = {} as NonNullable<NpcType["behavior"]>;

export function getNpcBehavior(
  npcType: NpcType
): NonNullable<NpcType["behavior"]> {
  return npcType.behavior ?? DEFAULT_NPC_BEHAVIOR;
}

export function getNpcBoxSize(npcType: NpcType): Vec3 {
  return [...(npcType.boxSize ?? DEFAULT_NPC_BOX_SIZE)] as Vec3;
}

export function getNpcWalkSpeed(npcType: NpcType): number {
  return npcType.walkSpeed ?? DEFAULT_NPC_WALK_SPEED;
}

export function getNpcRunSpeed(npcType: NpcType): number {
  return npcType.runSpeed ?? Math.max(getNpcWalkSpeed(npcType), DEFAULT_NPC_RUN_SPEED);
}

export function getNpcRotateSpeed(npcType: NpcType): number {
  return npcType.rotateSpeed ?? DEFAULT_NPC_ROTATE_SPEED;
}

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
