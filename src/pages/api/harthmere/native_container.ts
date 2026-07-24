import { newPlaceable } from "@/server/logic/utils/placeables";
import type { LazyEntity } from "@/server/shared/ecs/gen/lazy";
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
  type ReadonlyCreatedBy,
  type ReadonlyEntityDescription,
  type ReadonlyLabel,
  type ReadonlyPlaceableComponent,
  type ReadonlyPosition,
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
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
  type NativeRoadAheadContainerSpec,
} from "@/shared/harthmere/native_road_ahead_contract";
import { isHarthmereContainerObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID, safeParseBiomesId, zBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { z } from "zod";

const NATIVE_CONTAINER_INTERACTION_RADIUS = 8;
const NATIVE_CONTAINER_SLOT_COUNT = 16;
const MAX_NATIVE_CONTAINER_ID_ALLOCATION_ATTEMPTS = 16;

const COMPARE_AND_SWAP_NATIVE_CONTAINER_ID_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2])
  return 1
end
return 0
`;

type NativeContainerAllocationRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "NX"): Promise<unknown>;
  eval(
    script: string,
    keyCount: number,
    key: string,
    expected: string,
    replacement: string
  ): Promise<unknown>;
};

export type StableHarthmereNativeContainerId = {
  containerId: BiomesId;
  existing?: LazyEntity;
  remapped: boolean;
};

type NativeContainerIdentityEntity = {
  createdBy(): ReadonlyCreatedBy | undefined;
  entityDescription(): ReadonlyEntityDescription | undefined;
  label(): ReadonlyLabel | undefined;
  placeableComponent(): ReadonlyPlaceableComponent | undefined;
  position(): ReadonlyPosition | undefined;
};

const globalForHarthmereNativeContainers = globalThis as typeof globalThis & {
  __harthmereNativeContainerRedis?: ReturnType<typeof connectToRedis>;
};

function nativeContainerRedis() {
  return (globalForHarthmereNativeContainers.__harthmereNativeContainerRedis ??=
    connectToRedis("firehose"));
}

async function compareAndSwapNativeContainerId(
  redis: NativeContainerAllocationRedis,
  key: string,
  expected: string,
  replacement: BiomesId
) {
  return (
    Number(
      await redis.eval(
        COMPARE_AND_SWAP_NATIVE_CONTAINER_ID_LUA,
        1,
        key,
        expected,
        String(replacement)
      )
    ) === 1
  );
}

/**
 * Resolve a stable Redis-backed ECS id without ever adopting an unrelated
 * world entity. Snapshot restores can leave a durable Redis mapping pointing
 * at an id that the restored world now uses for terrain, a bridge, an NPC, or
 * another container. The compare-and-swap keeps concurrent open requests from
 * clobbering each other's replacement while allowing the next request to
 * self-heal the stale mapping.
 */
export async function stableHarthmereNativeContainerIdForTest(input: {
  redis: NativeContainerAllocationRedis;
  redisKey: string;
  idGenerator: { next(): Promise<BiomesId> };
  worldGet: (id: BiomesId) => Promise<LazyEntity | undefined>;
  expectedExisting: (entity: LazyEntity) => boolean;
  allocationKind: string;
}): Promise<StableHarthmereNativeContainerId | undefined> {
  let remapped = false;
  for (
    let attempt = 0;
    attempt < MAX_NATIVE_CONTAINER_ID_ALLOCATION_ATTEMPTS;
    attempt += 1
  ) {
    let raw = await input.redis.get(input.redisKey);
    if (!raw) {
      const proposedId = await input.idGenerator.next();
      await input.redis.set(input.redisKey, String(proposedId), "NX");
      raw = await input.redis.get(input.redisKey);
      if (!raw) continue;
    }

    const parsedContainerId = safeParseBiomesId(raw);
    const containerId =
      parsedContainerId &&
      Number.isSafeInteger(parsedContainerId) &&
      parsedContainerId > 0
        ? parsedContainerId
        : undefined;
    const existing = containerId
      ? await input.worldGet(containerId)
      : undefined;
    // Do not return an id after another request has remapped its Redis key.
    if ((await input.redis.get(input.redisKey)) !== raw) continue;
    if (containerId && (!existing || input.expectedExisting(existing))) {
      return { containerId, existing, remapped };
    }

    const replacement = await input.idGenerator.next();
    if (
      await compareAndSwapNativeContainerId(
        input.redis,
        input.redisKey,
        raw,
        replacement
      )
    ) {
      remapped = true;
      log.warn("Remapped colliding Harthmere native container id", {
        allocationKind: input.allocationKind,
        redisKey: input.redisKey,
        occupiedEntityId: containerId,
        occupiedEntityLabel: existing?.label()?.text,
        replacementEntityId: replacement,
      });
    }
  }
  return undefined;
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

/**
 * The May 16 snapshot source is an old placed frame. A partial restore can
 * omit that entity or one of its metadata components even though the rendered
 * ship/chest geometry remains. Recovery is allowed only for the immutable
 * source id and only when the source is absent or still carries one of the two
 * authored identity facts; an unrelated entity occupying the id is rejected.
 */
export function recoverableNativeBustedUnderwaterContainerSourceForTest(input: {
  entityId?: BiomesId;
  sourceMissing: boolean;
  label?: string | null;
  placeableItemId?: BiomesId;
}) {
  if (
    input.entityId !== NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId
  ) {
    return false;
  }
  return (
    input.sourceMissing ||
    isNativeBustedUnderwaterContainerLabel(input.label) ||
    input.placeableItemId ===
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId
  );
}

/** Do not recreate the one-shot quest reward after its native leaf fired. */
export function seededBustedUnderwaterContainerInventoryForTest(
  rewardAlreadyCompleted = false
) {
  const inventory = seededHarthmereNativeContainerInventoryForTest(
    "Chest The Grove Underwater Main"
  );
  if (rewardAlreadyCompleted) {
    inventory.items = inventory.items.map((slot) =>
      slot?.item.id === NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
        ? undefined
        : slot
    );
  }
  return inventory;
}

export function validPrivateNativeQuestContainerIdentityForTest(input: {
  kind: "road_ahead" | "busted_underwater";
  sourceEntityId: BiomesId;
  ownerId?: BiomesId;
  expectedOwnerId: BiomesId;
  description?: string | null;
  label?: string | null;
  placeableItemId?: BiomesId;
}) {
  if (
    input.ownerId !== input.expectedOwnerId ||
    input.description !== NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION ||
    input.placeableItemId !== undefined
  ) {
    return false;
  }
  if (input.kind === "busted_underwater") {
    return (
      input.sourceEntityId ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId &&
      isNativeBustedUnderwaterContainerLabel(input.label)
    );
  }
  return (
    nativeRoadAheadContainerSpecForLabel(input.label)?.sourceEntityId ===
    input.sourceEntityId
  );
}

function validPrivateNativeQuestContainerIdentity(
  entity: NativeContainerIdentityEntity,
  input: {
    kind: "road_ahead" | "busted_underwater";
    sourceEntityId: BiomesId;
    expectedOwnerId: BiomesId;
  }
) {
  return validPrivateNativeQuestContainerIdentityForTest({
    ...input,
    ownerId: entity.createdBy()?.id,
    description: entity.entityDescription()?.text,
    label: entity.label()?.text,
    placeableItemId: entity.placeableComponent()?.item_id,
  });
}

export function validStaticNativeContainerIdentityForTest(input: {
  label?: string | null;
  expectedLabel: string;
  placeableItemId?: BiomesId;
  creatorId?: BiomesId;
  position?: readonly number[];
  expectedPosition: readonly number[];
}) {
  return Boolean(
    input.label?.trim().toLowerCase() ===
      input.expectedLabel.trim().toLowerCase() &&
      input.placeableItemId === BikkieIds.woodContainer &&
      input.creatorId === undefined &&
      input.position &&
      Math.hypot(
        Number(input.position[0]) - Number(input.expectedPosition[0]),
        Number(input.position[1]) - Number(input.expectedPosition[1]),
        Number(input.position[2]) - Number(input.expectedPosition[2])
      ) < 0.01
  );
}

function validStaticNativeContainerIdentity(
  entity: NativeContainerIdentityEntity,
  landmark: { label: string; position: readonly number[] }
) {
  return validStaticNativeContainerIdentityForTest({
    label: entity.label()?.text,
    expectedLabel: landmark.label,
    placeableItemId: entity.placeableComponent()?.item_id,
    creatorId: entity.createdBy()?.id,
    position: entity.position()?.v,
    expectedPosition: landmark.position,
  });
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
      const recoverableBustedSource =
        recoverableNativeBustedUnderwaterContainerSourceForTest({
          entityId: body.entityId,
          sourceMissing: !target,
          label: target?.label()?.text,
          placeableItemId: target?.placeableComponent()?.item_id,
        });
      // Use canonical snapshot facts only for the exact recoverable Busted
      // source. Every ordinary container still requires a complete live ECS
      // entity, preserving the universal anti-forgery boundary.
      const label =
        target?.label()?.text?.trim() ??
        (recoverableBustedSource
          ? "Chest The Grove Underwater Main"
          : undefined);
      const position =
        target?.position()?.v ??
        (recoverableBustedSource
          ? NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.position
          : undefined);
      const sourceQuestGiver =
        target?.questGiver() ??
        (recoverableBustedSource ? QuestGiver.create() : undefined);
      const sourcePlaceableItemId =
        target?.placeableComponent()?.item_id ??
        (recoverableBustedSource
          ? NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId
          : undefined);
      if (!label || !position) {
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
              questGiver: sourceQuestGiver,
              placeableItemId: sourcePlaceableItemId,
            })
          : undefined;
        const validBustedSource = bustedUnderwaterQuestContainer
          ? validNativeBustedUnderwaterContainerSourceForTest({
              entityId: body.entityId,
              label,
              questGiver: sourceQuestGiver,
              placeableItemId: sourcePlaceableItemId,
            })
          : false;
        if (
          (roadAheadQuestContainer && !sourceValidation?.ok) ||
          (bustedUnderwaterQuestContainer &&
            !validBustedSource &&
            !recoverableBustedSource)
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
            hasQuestGiver: Boolean(sourceQuestGiver),
            placeableItemId: sourcePlaceableItemId,
            expectedSourceEntityId:
              sourceValidation?.spec?.sourceEntityId ??
              NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId,
            expectedPlaceableItemId:
              sourceValidation?.spec?.placeableItemId ??
              NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId,
          });
          return { ok: false, error: "invalid_native_quest_container" };
        }
        if (
          bustedUnderwaterQuestContainer &&
          recoverableBustedSource &&
          !validBustedSource
        ) {
          // Preserve operational evidence that a snapshot source needed repair
          // without logging inventory contents or authentication material.
          log.warn("Recovering canonical Busted underwater container source", {
            sourceEntityId: body.entityId,
            sourceMissing: !target,
            hasQuestGiver: Boolean(target?.questGiver()),
            placeableItemId: target?.placeableComponent()?.item_id,
          });
        }
        const privateContainerKind = roadAheadQuestContainer
          ? "road_ahead"
          : "busted_underwater";
        // Source validation above guarantees quest-giver metadata. The fallback
        // keeps the type and runtime boundary explicit for partial restores.
        const privateQuestGiver = sourceQuestGiver ?? QuestGiver.create();
        const privateContainerRedisKey = roadAheadQuestContainer
          ? nativeRoadAheadContainerRedisKeyForTest(body.entityId, auth.userId)
          : nativeBustedUnderwaterContainerRedisKeyForTest(
              body.entityId,
              auth.userId
            );
        const expectedPrivateContainer = (
          entity: NativeContainerIdentityEntity
        ) =>
          validPrivateNativeQuestContainerIdentity(entity, {
            kind: privateContainerKind,
            sourceEntityId: body.entityId!,
            expectedOwnerId: auth.userId,
          });
        const redis = await nativeContainerRedis();
        const allocation = await stableHarthmereNativeContainerIdForTest({
          redis: redis.primary as unknown as NativeContainerAllocationRedis,
          redisKey: privateContainerRedisKey,
          idGenerator,
          worldGet: (id) => worldApi.get(id),
          expectedExisting: expectedPrivateContainer,
          allocationKind: privateContainerKind,
        });
        if (!allocation) {
          return { ok: false, error: "container_id_allocation_failed" };
        }
        const { containerId } = allocation;

        let existing = allocation.existing;
        let created = false;
        const bustedRewardAlreadyCompleted = Boolean(
          player
            ?.triggerState()
            ?.by_root.get(NATIVE_BUSTED_QUEST_ID)
            ?.get(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId)
        );
        // Both initial creation and metadata repair use the same idempotent
        // seed. Road Ahead keeps its authored choices; Busted omits its one-shot
        // reward after the claim leaf has fired while retaining ordinary loot.
        const seedQuestContainerInventory = () =>
          roadAheadQuestContainer
            ? seededNativeRoadAheadContainerInventoryForTest(label)
            : seededBustedUnderwaterContainerInventoryForTest(
                bustedRewardAlreadyCompleted
              );
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
            quest_giver: QuestGiver.clone(privateQuestGiver),
            container_inventory: seedQuestContainerInventory(),
          };
          const applied = await worldApi.apply({
            changes: [{ kind: "create", entity }],
          });
          if (applied.outcome !== "success") {
            existing = await worldApi.get(containerId);
            if (
              !existing?.containerInventory() ||
              !expectedPrivateContainer(existing)
            ) {
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
                if (!expectedPrivateContainer(repair)) {
                  return "container_identity_conflict";
                }
                repair.setPosition(Position.create({ v: [...position] }));
                repair.setLabel(Label.create({ text: label }));
                repair.setQuestGiver(QuestGiver.clone(privateQuestGiver));
                if (!repair.containerInventory()) {
                  repair.setContainerInventory(seedQuestContainerInventory());
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

      // A missing entity can only reach this point through the canonical
      // Busted recovery branch above, which always returns a private container.
      if (!target) {
        return { ok: false, error: "container_not_found" };
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
    const expectedStaticContainer = (entity: NativeContainerIdentityEntity) =>
      validStaticNativeContainerIdentity(entity, landmark);
    const redis = await nativeContainerRedis();
    const allocation = await stableHarthmereNativeContainerIdForTest({
      redis: redis.primary as unknown as NativeContainerAllocationRedis,
      redisKey: `harthmere:native_ecs_container:${landmark.id}`,
      idGenerator,
      worldGet: (id) => worldApi.get(id),
      expectedExisting: expectedStaticContainer,
      allocationKind: `static:${landmark.id}`,
    });
    if (!allocation) {
      return { ok: false, error: "container_id_allocation_failed" };
    }
    const { containerId } = allocation;
    let existing = allocation.existing;
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
        if (
          !existing?.containerInventory() ||
          !expectedStaticContainer(existing)
        ) {
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
            if (!expectedStaticContainer(repair)) {
              return "container_identity_conflict";
            }
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
