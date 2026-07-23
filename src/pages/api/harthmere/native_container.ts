import { newPlaceable } from "@/server/logic/utils/placeables";
import { connectToRedis } from "@/server/shared/redis/connection";
import {
  editWorldWithRetry,
  isWorldEditConflict,
} from "@/server/shared/world/edit_retry";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  ContainerInventory,
  CreatedBy,
  EntityDescription,
  Label,
  PlaceableComponent,
  Position,
  QuestGiver,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import { GROVE_ECONOMY_STARTER_LANDMARKS } from "@/shared/harthmere/grove_economy_starter";
import { harthmereContainerLootForLabel } from "@/shared/harthmere/harthmere_container_loot_authority";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import {
  isNativeBustedUnderwaterContainerLabel,
  isNativeRoadAheadQuestObjectLabel,
  nativeBiomesEcsAuthorityEnabled,
  nativeRoadAheadContainerSpecForLabel,
  nativeRoadAheadContainerItemIds,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
  type NativeRoadAheadContainerSpec,
} from "@/shared/harthmere/native_road_ahead_contract";
import { isHarthmereContainerObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID, zBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { z } from "zod";

const NATIVE_CONTAINER_INTERACTION_RADIUS = 8;
const NATIVE_CONTAINER_SLOT_COUNT = 16;

const globalForHarthmereNativeContainers = globalThis as typeof globalThis & {
  __harthmereNativeContainerRedis?: ReturnType<typeof connectToRedis>;
};

function nativeContainerRedis() {
  return (globalForHarthmereNativeContainers.__harthmereNativeContainerRedis ??=
    connectToRedis("firehose"));
}

const zRequest = z.object({
  entityId: zBiomesId.optional(),
  objectId: z.string().optional(),
});

const zResponse = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  containerId: zBiomesId.optional(),
  containerItemId: zBiomesId.optional(),
  created: z.boolean().optional(),
});

export function withinHarthmereNativeContainerRangeForTest(
  actor: readonly number[] | undefined,
  target: readonly number[] | undefined
) {
  if (!actor || !target) return false;
  return (
    Math.hypot(
      Number(actor[0]) - Number(target[0]),
      Number(actor[1]) - Number(target[1]),
      Number(actor[2]) - Number(target[2])
    ) <= NATIVE_CONTAINER_INTERACTION_RADIUS
  );
}

export function seededHarthmereNativeContainerInventoryForTest(label: string) {
  const contents = harthmereContainerLootForLabel(label).map((entry) => {
    const id = harthmereItemIdToBiomesId(entry.itemId);
    if (!id) {
      throw new Error(`Container item ${entry.itemId} has no native Bikkie id`);
    }
    return countOf(id, BigInt(Math.max(1, Math.trunc(entry.quantity))));
  });
  return ContainerInventory.create({
    items: [
      ...contents,
      ...new Array(Math.max(0, NATIVE_CONTAINER_SLOT_COUNT - contents.length)),
    ],
  });
}

export function staticHarthmereNativeContainerLandmarkForTest(
  objectId: string | undefined
) {
  if (!objectId) return undefined;
  return [...SNAPSHOT_GROVE_LANDMARKS, ...GROVE_ECONOMY_STARTER_LANDMARKS].find(
    (landmark) =>
      landmark.id === objectId &&
      isHarthmereContainerObjectLabel({ label: landmark.label }) &&
      !isNativeRoadAheadQuestObjectLabel(landmark.label)
  );
}

async function allocatedStaticContainerId(
  objectId: string,
  idGenerator: { next(): Promise<BiomesId> }
) {
  const key = `harthmere:native_ecs_container:${objectId}`;
  const redis = await nativeContainerRedis();
  let raw = await redis.primary.get(key);
  if (!raw) {
    const nextId = await idGenerator.next();
    await redis.primary.set(key, String(nextId), "NX");
    raw = await redis.primary.get(key);
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? (parsed as BiomesId)
    : undefined;
}

async function allocatedRoadAheadContainerId(
  sourceEntityId: BiomesId,
  userId: BiomesId,
  idGenerator: { next(): Promise<BiomesId> }
) {
  // Each player receives a stable private inventory behind the shared visual
  // prop. A shared container would let the first player permanently consume
  // every other player's onboarding rewards.
  const key = nativeRoadAheadContainerRedisKeyForTest(sourceEntityId, userId);
  const redis = await nativeContainerRedis();
  let raw = await redis.primary.get(key);
  if (!raw) {
    const nextId = await idGenerator.next();
    await redis.primary.set(key, String(nextId), "NX");
    raw = await redis.primary.get(key);
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? (parsed as BiomesId)
    : undefined;
}

async function allocatedBustedUnderwaterContainerId(
  sourceEntityId: BiomesId,
  userId: BiomesId,
  idGenerator: { next(): Promise<BiomesId> }
) {
  const key = nativeBustedUnderwaterContainerRedisKeyForTest(
    sourceEntityId,
    userId
  );
  const redis = await nativeContainerRedis();
  let raw = await redis.primary.get(key);
  if (!raw) {
    const nextId = await idGenerator.next();
    await redis.primary.set(key, String(nextId), "NX");
    raw = await redis.primary.get(key);
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? (parsed as BiomesId)
    : undefined;
}

export function nativeRoadAheadContainerRedisKeyForTest(
  sourceEntityId: BiomesId,
  userId: BiomesId
) {
  return `harthmere:native_road_ahead_container:${sourceEntityId}:${userId}`;
}

export function nativeBustedUnderwaterContainerRedisKeyForTest(
  sourceEntityId: BiomesId,
  userId: BiomesId
) {
  return `harthmere:native_busted_underwater_container:${sourceEntityId}:${userId}`;
}

export function seededNativeRoadAheadContainerInventoryForTest(label: string) {
  const itemIds = nativeRoadAheadContainerItemIds(label);
  if (!itemIds) {
    throw new Error(`Unknown Road Ahead container: ${label}`);
  }
  const contents = itemIds.map((itemId) => countOf(itemId, 1n));
  return ContainerInventory.create({
    items: [
      ...contents,
      ...new Array(Math.max(0, NATIVE_CONTAINER_SLOT_COUNT - contents.length)),
    ],
  });
}

export type NativeRoadAheadContainerSourceValidationFailure =
  | "unknown_label"
  | "wrong_source_entity"
  | "missing_quest_giver"
  | "wrong_placeable_item";

export type NativeRoadAheadContainerSourceValidation =
  | { ok: true; spec: NativeRoadAheadContainerSpec }
  | {
      ok: false;
      reason: NativeRoadAheadContainerSourceValidationFailure;
      spec?: NativeRoadAheadContainerSpec;
    };

export function validateNativeRoadAheadContainerSourceForTest(input: {
  entityId?: BiomesId;
  label?: string | null;
  questGiver: unknown;
  placeableItemId?: BiomesId;
}): NativeRoadAheadContainerSourceValidation {
  const spec = nativeRoadAheadContainerSpecForLabel(input.label);
  if (!spec) {
    return { ok: false as const, reason: "unknown_label" as const };
  }
  if (input.entityId !== spec.sourceEntityId) {
    return {
      ok: false as const,
      reason: "wrong_source_entity" as const,
      spec,
    };
  }
  if (!input.questGiver) {
    return {
      ok: false as const,
      reason: "missing_quest_giver" as const,
      spec,
    };
  }
  if (input.placeableItemId !== spec.placeableItemId) {
    return {
      ok: false as const,
      reason: "wrong_placeable_item" as const,
      spec,
    };
  }
  return { ok: true as const, spec };
}

export function validNativeRoadAheadContainerSourceForTest(input: {
  entityId?: BiomesId;
  label?: string | null;
  questGiver: unknown;
  placeableItemId?: BiomesId;
}) {
  return validateNativeRoadAheadContainerSourceForTest(input).ok;
}

export function validNativeBustedUnderwaterContainerSourceForTest(input: {
  entityId?: BiomesId;
  label?: string | null;
  questGiver: unknown;
  placeableItemId?: BiomesId;
}) {
  return Boolean(
    isNativeBustedUnderwaterContainerLabel(input.label) &&
      input.entityId ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId &&
      input.questGiver &&
      input.placeableItemId ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId
  );
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zRequest,
    response: zResponse,
  },
  async ({ context: { idGenerator, worldApi }, auth, body }) => {
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return { ok: false, error: "native_ecs_authority_disabled" };
    }
    const player = await worldApi.get(auth.userId);
    const playerPosition = player?.position()?.v;

    if (body.entityId && body.entityId !== INVALID_BIOMES_ID) {
      // WorldEditor records component-level read conditions. Two simultaneous
      // opens can therefore never both seed the container after one player has
      // already taken an item; the stale commit conflicts instead of refilling
      // the crate from its initial loot table.
      const editor = worldApi.edit();
      const target = await editor.get(body.entityId);
      const label = target?.label()?.text?.trim();
      const position = target?.position()?.v;
      if (!target || !label || !position) {
        return { ok: false, error: "container_not_found" };
      }
      if (!isHarthmereContainerObjectLabel({ label })) {
        return { ok: false, error: "target_is_not_container" };
      }
      if (
        !withinHarthmereNativeContainerRangeForTest(playerPosition, position)
      ) {
        return { ok: false, error: "container_out_of_range" };
      }

      const roadAheadQuestContainer = isNativeRoadAheadQuestObjectLabel(label);
      const bustedUnderwaterQuestContainer =
        isNativeBustedUnderwaterContainerLabel(label);
      if (roadAheadQuestContainer || bustedUnderwaterQuestContainer) {
        const sourceValidation = roadAheadQuestContainer
          ? validateNativeRoadAheadContainerSourceForTest({
              entityId: body.entityId,
              label,
              questGiver: target.questGiver(),
              placeableItemId: target.placeableComponent()?.item_id,
            })
          : undefined;
        const validBustedSource = bustedUnderwaterQuestContainer
          ? validNativeBustedUnderwaterContainerSourceForTest({
              entityId: body.entityId,
              label,
              questGiver: target.questGiver(),
              placeableItemId: target.placeableComponent()?.item_id,
            })
          : false;
        if (
          (roadAheadQuestContainer && !sourceValidation?.ok) ||
          (bustedUnderwaterQuestContainer && !validBustedSource)
        ) {
          // Labels are editable presentation data. Require all three native ECS
          // facts: concrete source entity, quest_giver, and placeable biscuit.
          // Keeping the IDs distinct prevents a valid snapshot prop from being
          // rejected while still blocking renamed frames and copied labels.
          log.warn("Rejected invalid native Road Ahead container source", {
            reason: sourceValidation?.ok
              ? undefined
              : sourceValidation?.reason ?? "invalid_busted_source",
            sourceEntityId: body.entityId,
            label,
            hasQuestGiver: Boolean(target.questGiver()),
            placeableItemId: target.placeableComponent()?.item_id,
            expectedSourceEntityId:
              sourceValidation?.spec?.sourceEntityId ??
              NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId,
            expectedPlaceableItemId:
              sourceValidation?.spec?.placeableItemId ??
              NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId,
          });
          return { ok: false, error: "invalid_native_quest_container" };
        }
        const containerId = roadAheadQuestContainer
          ? await allocatedRoadAheadContainerId(
              body.entityId,
              auth.userId,
              idGenerator
            )
          : await allocatedBustedUnderwaterContainerId(
              body.entityId,
              auth.userId,
              idGenerator
            );
        if (!containerId) {
          return { ok: false, error: "container_id_allocation_failed" };
        }

        let existing = await worldApi.get(containerId);
        let created = false;
        if (!existing) {
          // This ECS entity deliberately has no placeable component. It is a
          // native inventory at the prop's position, not a second rendered
          // crate. The marker + creator establish the server-side permission
          // boundary used by inventory swap/combine handlers.
          const entity: Entity = {
            id: containerId,
            position: Position.create({ v: [...position] }),
            label: Label.create({ text: label }),
            entity_description: EntityDescription.create({
              text: NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
            }),
            created_by: CreatedBy.create({
              id: auth.userId,
              created_at: secondsSinceEpoch(),
            }),
            quest_giver: QuestGiver.clone(target.questGiver()),
            container_inventory: roadAheadQuestContainer
              ? seededNativeRoadAheadContainerInventoryForTest(label)
              : seededHarthmereNativeContainerInventoryForTest(label),
          };
          const applied = await worldApi.apply({
            changes: [{ kind: "create", entity }],
          });
          if (applied.outcome !== "success") {
            existing = await worldApi.get(containerId);
            if (!existing?.containerInventory()) {
              return {
                ok: false,
                error: "container_materialization_conflicted",
              };
            }
          } else {
            created = true;
          }
        } else {
          // Refresh the hidden inventory's range anchor if an administrator
          // moved the authored prop. Existing contents are never reseeded, so
          // reopening cannot duplicate a reward the player already took.
          try {
            const repairError = await editWorldWithRetry(
              worldApi,
              async (repairEditor) => {
                const repair = await repairEditor.get(containerId);
                if (!repair) return "container_materialization_conflicted";
                const validOwner = repair.createdBy()?.id === auth.userId;
                const validMarker =
                  repair.entityDescription()?.text ===
                  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION;
                if (!validOwner || !validMarker) {
                  return "container_identity_conflict";
                }
                repair.setPosition(Position.create({ v: [...position] }));
                if (!repair.containerInventory()) {
                  repair.setContainerInventory(
                    roadAheadQuestContainer
                      ? seededNativeRoadAheadContainerInventoryForTest(label)
                      : seededHarthmereNativeContainerInventoryForTest(label)
                  );
                }
                return undefined;
              }
            );
            if (repairError) return { ok: false, error: repairError };
          } catch (error) {
            if (!isWorldEditConflict(error)) throw error;
            return { ok: false, error: "container_materialization_conflicted" };
          }
        }
        return {
          ok: true,
          containerId,
          containerItemId: BikkieIds.woodContainer,
          created,
        };
      }

      const created = !target.containerInventory();
      if (created) {
        try {
          const materializationError = await editWorldWithRetry(
            worldApi,
            async (materializationEditor) => {
              const materializationTarget = await materializationEditor.get(
                body.entityId!
              );
              if (!materializationTarget) return "container_not_found";
              if (!materializationTarget.containerInventory()) {
                materializationTarget.setContainerInventory(
                  seededHarthmereNativeContainerInventoryForTest(label)
                );
              }
              if (!materializationTarget.placeableComponent()) {
                materializationTarget.setPlaceableComponent(
                  PlaceableComponent.create({
                    item_id: BikkieIds.woodContainer,
                  })
                );
              }
              return undefined;
            }
          );
          if (materializationError) {
            return { ok: false, error: materializationError };
          }
        } catch (error) {
          if (!isWorldEditConflict(error)) throw error;
          return { ok: false, error: "container_materialization_conflicted" };
        }
      }
      return {
        ok: true,
        containerId: body.entityId,
        containerItemId: BikkieIds.woodContainer,
        created,
      };
    }

    const landmark = staticHarthmereNativeContainerLandmarkForTest(
      body.objectId
    );
    if (!landmark) {
      return { ok: false, error: "unknown_static_container" };
    }
    if (
      !withinHarthmereNativeContainerRangeForTest(
        playerPosition,
        landmark.position
      )
    ) {
      return { ok: false, error: "container_out_of_range" };
    }
    const containerId = await allocatedStaticContainerId(
      landmark.id,
      idGenerator
    );
    if (!containerId) {
      return { ok: false, error: "container_id_allocation_failed" };
    }
    let existing = await worldApi.get(containerId);
    let created = false;
    if (!existing) {
      const entity = newPlaceable({
        id: containerId,
        creatorId: undefined,
        position: [...landmark.position],
        orientation: [0, 0],
        item: anItem(BikkieIds.woodContainer),
      });
      entity.label = Label.create({ text: landmark.label });
      entity.container_inventory =
        seededHarthmereNativeContainerInventoryForTest(landmark.label);
      const applied = await worldApi.apply({
        changes: [{ kind: "create", entity }],
      });
      if (applied.outcome !== "success") {
        existing = await worldApi.get(containerId);
        if (!existing?.containerInventory()) {
          return { ok: false, error: "container_materialization_conflicted" };
        }
      } else {
        created = true;
      }
    } else if (!existing.containerInventory()) {
      try {
        const repairError = await editWorldWithRetry(
          worldApi,
          async (editor) => {
            const repair = await editor.get(containerId);
            if (!repair) return "container_materialization_conflicted";
            if (!repair.containerInventory()) {
              repair.setContainerInventory(
                seededHarthmereNativeContainerInventoryForTest(landmark.label)
              );
            }
            return undefined;
          }
        );
        if (repairError) return { ok: false, error: repairError };
      } catch (error) {
        if (!isWorldEditConflict(error)) throw error;
        return { ok: false, error: "container_materialization_conflicted" };
      }
    }
    return {
      ok: true,
      containerId,
      containerItemId: BikkieIds.woodContainer,
      created,
    };
  }
);
