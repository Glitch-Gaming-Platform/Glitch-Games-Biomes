import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { authorizeHarthmereQuestProgress } from "@/server/harthmere/native_quest_progress_token";
import { authorizeHarthmerePlaceableTransaction } from "@/server/harthmere/native_placeable_transaction_token";
import { buildHarthmereNativeThaedrynEntity } from "@/server/harthmere/live_entity_ecs_seed";
import { newDrop } from "@/server/logic/utils/drops";
import { GameEvent } from "@/server/shared/api/game_event";
import type { LogicApi } from "@/server/shared/api/logic";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import {
  AclComponent,
  Box,
  DeedComponent,
  Label,
  Position,
  Protection,
  Size,
} from "@/shared/ecs/gen/components";
import {
  AcceptChallengeEvent,
  HarthmereInventoryTransactionEvent,
  HarthmereQuestProgressEvent,
  HarthmerePlaceableTransactionEvent,
  ResetChallengeEvent,
} from "@/shared/ecs/gen/events";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { ReadonlyItemAndCount } from "@/shared/ecs/gen/types";
import { countOf, createBag } from "@/shared/game/items";
import { DEFAULT_BUILD_ACTIONS, getAclPreset } from "@/shared/game/acls_base";
import { defaultAcl } from "@/shared/ecs/gen/types";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { harthmereNativeBiomesIdForRecipeId } from "@/shared/harthmere/harthmere_native_item_ids";
import { HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID } from "@/shared/harthmere/bible_quest_live_authority";
import type {
  HarthmereNativeEcsBossEntityMaterializationPlan,
  HarthmereNativeEcsDeedMaterializationPlan,
  HarthmereNativeEcsDropMaterializationPlan,
  HarthmereNativeEcsInventoryExchangeMaterializationPlan,
  HarthmereNativeEcsMaterializationPlan,
  HarthmereNativeEcsPlaceableMaterializationPlan,
  HarthmereNativeEcsQuestAcceptMaterializationPlan,
  HarthmereNativeEcsQuestProgressMaterializationPlan,
  HarthmereNativeEcsQuestResetMaterializationPlan,
} from "@/shared/harthmere/live_mode_backend";
import {
  harthmereNativeQuestId,
  harthmereNativeQuestStepId,
} from "@/shared/harthmere/harthmere_native_quests";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";

const HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_STABLE_ID_COLLISION_RETRIES = 16;

function materializationRedisKey(materializationKey: string, part = "entity") {
  return `harthmere:native_ecs_materialization:${materializationKey}:${part}`;
}

function legacyDropMaterializationRedisKey(materializationKey: string) {
  return `harthmere:native_ecs_materialization:${materializationKey}`;
}

function materializationDoneRedisKey(materializationKey: string) {
  return `harthmere:native_ecs_materialization:${materializationKey}:done`;
}

function actorBiomesId(value: unknown): BiomesId | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0
    ? (numeric as BiomesId)
    : undefined;
}

function nativeItems(
  itemStacks: Record<string, number>,
  materializationKey: string
) {
  return Object.entries(itemStacks).flatMap(([itemId, count]) => {
    const biomesId =
      harthmereItemIdToBiomesId(itemId) ??
      harthmereNativeBiomesIdForRecipeId(itemId);
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    if (safeCount === 0) return [];
    if (!biomesId) {
      throw new Error(
        `Native ECS materialization ${materializationKey} has no checked-in item id for ${itemId}`
      );
    }
    return [countOf(biomesId, BigInt(safeCount))];
  });
}

function stackCounts(items: Iterable<ReadonlyItemAndCount>) {
  const counts = new Map<BiomesId, bigint>();
  for (const item of items) {
    counts.set(item.item.id, (counts.get(item.item.id) ?? 0n) + item.count);
  }
  return counts;
}

function sameStacks(
  actual: Iterable<ReadonlyItemAndCount>,
  expected: readonly ReadonlyItemAndCount[]
) {
  const actualCounts = stackCounts(actual);
  const expectedCounts = stackCounts(expected);
  if (actualCounts.size !== expectedCounts.size) return false;
  for (const [id, count] of expectedCounts) {
    if (actualCounts.get(id) !== count) return false;
  }
  return true;
}

function isExpectedDrop(
  entity: any,
  expectedItems: readonly ReadonlyItemAndCount[]
) {
  const grabBag = entity?.grabBag();
  return Boolean(grabBag && sameStacks(grabBag.slots.values(), expectedItems));
}

function receiptLabel(materializationKey: string) {
  return `harthmere_native_ecs_receipt:${materializationKey}`;
}

function isExpectedReceipt(entity: any, materializationKey: string) {
  return entity?.label()?.text === receiptLabel(materializationKey);
}

async function stableEntityId(input: {
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  materializationKey: string;
  part: string;
  expectedExisting?: (entity: any) => boolean;
}) {
  const idKey = materializationRedisKey(input.materializationKey, input.part);
  for (
    let attempt = 0;
    attempt < MAX_STABLE_ID_COLLISION_RETRIES;
    attempt += 1
  ) {
    let rawId = await input.redisPrimary.get(idKey);
    if (!rawId && input.part === "drop") {
      rawId = await input.redisPrimary.get(
        legacyDropMaterializationRedisKey(input.materializationKey)
      );
      if (rawId) {
        await input.redisPrimary.set(
          idKey,
          rawId,
          "EX",
          HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS,
          "NX"
        );
      }
    }
    if (!rawId) {
      const proposedId = await input.idGenerator.next();
      await input.redisPrimary.set(
        idKey,
        String(proposedId),
        "EX",
        HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS,
        "NX"
      );
      rawId = await input.redisPrimary.get(idKey);
    }
    const entityId = safeParseBiomesId(rawId);
    if (!entityId) {
      throw new Error(
        `Could not allocate ECS id for ${input.materializationKey}:${input.part}`
      );
    }
    const existing = await input.worldApi.get(entityId);
    if (!existing || input.expectedExisting?.(existing)) {
      return { entityId, existing };
    }

    // A restored/stale allocator or old Redis key can point at terrain, an
    // NPC, or another drop. Never call that successful: replace the stable id
    // and retry while leaving the unrelated ECS entity untouched.
    const replacement = await input.idGenerator.next();
    await input.redisPrimary.set(
      idKey,
      String(replacement),
      "EX",
      HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS
    );
  }
  throw new Error(
    `ECS id collisions exhausted for ${input.materializationKey}:${input.part}`
  );
}

function ownerIdsForDrop(plan: HarthmereNativeEcsDropMaterializationPlan) {
  const distinctOwnerActors = new Set(plan.ownerActorIds);
  const ownerIds = new Set(
    [...distinctOwnerActors]
      .map(actorBiomesId)
      .filter((id): id is BiomesId => id !== undefined)
  );
  if (
    distinctOwnerActors.size > 0 &&
    ownerIds.size !== distinctOwnerActors.size
  ) {
    throw new Error(
      `Native ECS drop ${plan.materializationKey} has an unresolved owner`
    );
  }
  return ownerIds;
}

async function materializeDrop(input: {
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  plan: HarthmereNativeEcsDropMaterializationPlan;
}) {
  const items = nativeItems(
    input.plan.itemStacks,
    input.plan.materializationKey
  );
  if (!items.length) {
    throw new Error(
      `Native ECS drop ${input.plan.materializationKey} has no valid item stacks`
    );
  }
  const stable = await stableEntityId({
    ...input,
    materializationKey: input.plan.materializationKey,
    part: "drop",
    expectedExisting: (entity) => isExpectedDrop(entity, items),
  });
  if (stable.existing) return false;

  const ownerIds = ownerIdsForDrop(input.plan);
  const entity = newDrop(
    stable.entityId,
    [input.plan.position.x, input.plan.position.y, input.plan.position.z],
    input.plan.mined,
    items,
    ownerIds.size
      ? {
          kind: "only",
          entity_ids: ownerIds,
          expiry: Math.floor(input.plan.expiresAtMs / 1000),
        }
      : undefined
  );
  if (entity.expires) {
    entity.expires.trigger_at = Math.floor(input.plan.expiresAtMs / 1000);
  }
  const applied = await input.worldApi.apply({
    changes: [{ kind: "create", entity }],
  });
  if (applied.outcome !== "success") {
    const afterConflict = await input.worldApi.get(stable.entityId);
    if (!isExpectedDrop(afterConflict, items)) {
      throw new Error(
        `Native ECS materialization ${input.plan.materializationKey} returned ${applied.outcome}`
      );
    }
    return false;
  }
  return true;
}

async function materializeInventoryExchange(input: {
  logicApi?: Pick<LogicApi, "publish">;
  plan: HarthmereNativeEcsInventoryExchangeMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  if (!actorId) {
    throw new Error(
      `Native ECS exchange ${input.plan.materializationKey} has an unresolved actor`
    );
  }
  if (!input.logicApi) {
    throw new Error(
      `Native ECS exchange ${input.plan.materializationKey} has no logic API`
    );
  }

  const take = createBag(
    ...nativeItems(input.plan.consumeItemStacks, input.plan.materializationKey)
  );
  const give = createBag(
    ...nativeItems(input.plan.rewardItemStacks, input.plan.materializationKey)
  );
  const storageTake = createBag(
    ...nativeItems(
      input.plan.consumeMaterialStorageItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const storageGive = createBag(
    ...nativeItems(
      input.plan.rewardMaterialStorageItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const personalBankTake = createBag(
    ...nativeItems(
      input.plan.consumePersonalBankItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const personalBankGive = createBag(
    ...nativeItems(
      input.plan.rewardPersonalBankItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const accountBankTake = createBag(
    ...nativeItems(
      input.plan.consumeAccountBankItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const accountBankGive = createBag(
    ...nativeItems(
      input.plan.rewardAccountBankItemStacks ?? {},
      input.plan.materializationKey
    )
  );
  const rawGoldDelta = input.plan.goldDelta ?? 0;
  if (!Number.isSafeInteger(rawGoldDelta)) {
    throw new Error(
      `Native ECS exchange ${input.plan.materializationKey} has an invalid gold delta`
    );
  }
  const goldDelta = BigInt(rawGoldDelta);
  const stationEntityId = input.plan.stationEntityId
    ? actorBiomesId(input.plan.stationEntityId)
    : undefined;
  const eventInput = {
    id: actorId,
    transaction_id: input.plan.materializationKey,
    take,
    give,
    storage_take: storageTake,
    storage_give: storageGive,
    storage_max_slots: Math.max(
      1,
      Math.trunc(input.plan.materialStorageMaxSlots ?? 32)
    ),
    personal_bank_take: personalBankTake,
    personal_bank_give: personalBankGive,
    personal_bank_max_slots: Math.max(
      1,
      Math.trunc(input.plan.personalBankMaxSlots ?? 24)
    ),
    account_bank_take: accountBankTake,
    account_bank_give: accountBankGive,
    account_bank_max_slots: Math.max(
      1,
      Math.trunc(input.plan.accountBankMaxSlots ?? 40)
    ),
    gold_delta: goldDelta,
    publish_craft: input.plan.publishCraft ?? false,
    station_entity_id: stationEntityId,
    robot_entity_id: input.plan.robotEntityId
      ? actorBiomesId(input.plan.robotEntityId)
      : undefined,
    robot_energy_delta: input.plan.robotEnergyDelta ?? 0,
    write_standing: input.plan.standing !== undefined,
    standing_scope: input.plan.standing?.scopeId ?? "",
    standing_likeability: input.plan.standing?.likeability ?? 0,
    standing_legal: input.plan.standing?.legal ?? 0,
    standing_notoriety: input.plan.standing?.notoriety ?? 0,
    standing_notoriety_floor: input.plan.standing?.notorietyFloor ?? 0,
  };
  await input.logicApi.publish(
    new GameEvent(
      actorId,
      new HarthmereInventoryTransactionEvent({
        ...eventInput,
        authorization: authorizeHarthmereInventoryTransaction(eventInput),
      })
    )
  );
  return true;
}

async function materializeQuestAccept(input: {
  logicApi?: Pick<LogicApi, "publish">;
  plan: HarthmereNativeEcsQuestAcceptMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  const giverEntityId = actorBiomesId(input.plan.giverEntityId);
  const challengeId = harthmereNativeQuestId(
    input.plan.questSource,
    input.plan.questId
  );
  if (!input.logicApi || !actorId || !giverEntityId || !challengeId) {
    throw new Error(
      `Native quest accept ${input.plan.materializationKey} is unresolved`
    );
  }
  await input.logicApi.publish(
    new GameEvent(
      actorId,
      new AcceptChallengeEvent({
        id: actorId,
        npc_id: giverEntityId,
        challenge_id: challengeId,
      })
    )
  );
  return true;
}

async function materializeQuestProgress(input: {
  logicApi?: Pick<LogicApi, "publish">;
  plan: HarthmereNativeEcsQuestProgressMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  const challengeId = harthmereNativeQuestId(
    input.plan.questSource,
    input.plan.questId
  );
  const stepId = harthmereNativeQuestStepId(
    input.plan.questSource,
    input.plan.questId,
    input.plan.objectiveIdOrIndex
  );
  if (!input.logicApi || !actorId || !challengeId || !stepId) {
    throw new Error(
      `Native quest progress ${input.plan.materializationKey} is unresolved`
    );
  }
  const eventInput = {
    id: actorId,
    challenge_id: challengeId,
    step_id: stepId,
  };
  await input.logicApi.publish(
    new GameEvent(
      actorId,
      new HarthmereQuestProgressEvent({
        ...eventInput,
        authorization: authorizeHarthmereQuestProgress(eventInput),
      })
    )
  );
  return true;
}

async function materializeQuestReset(input: {
  logicApi?: Pick<LogicApi, "publish">;
  plan: HarthmereNativeEcsQuestResetMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  const challengeId = harthmereNativeQuestId(
    input.plan.questSource,
    input.plan.questId
  );
  if (!input.logicApi || !actorId || !challengeId) {
    throw new Error(
      `Native quest reset ${input.plan.materializationKey} is unresolved`
    );
  }
  await input.logicApi.publish(
    new GameEvent(
      actorId,
      new ResetChallengeEvent({ id: actorId, challenge_id: challengeId })
    )
  );
  return true;
}

async function materializeBossEntity(input: {
  worldApi: WorldApi;
  plan: HarthmereNativeEcsBossEntityMaterializationPlan;
}) {
  const entityId = HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID as BiomesId;
  const existing = await input.worldApi.get(entityId);
  if (input.plan.operation === "delete") {
    if (!existing) return false;
    const applied = await input.worldApi.apply({
      changes: [{ kind: "delete", id: entityId }],
    });
    if (applied.outcome !== "success") {
      throw new Error(`Native boss delete returned ${applied.outcome}`);
    }
    return true;
  }
  if (existing) {
    if (!/thaedryn/i.test(existing.label()?.text ?? "")) {
      throw new Error(`Native Thaedryn id ${entityId} is occupied`);
    }
    return false;
  }
  const applied = await input.worldApi.apply({
    changes: [
      {
        kind: "create",
        entity: buildHarthmereNativeThaedrynEntity(secondsSinceEpoch()),
      },
    ],
  });
  if (applied.outcome !== "success") {
    throw new Error(`Native boss materialization returned ${applied.outcome}`);
  }
  return true;
}

async function materializePlaceable(input: {
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  logicApi?: Pick<LogicApi, "publish">;
  plan: HarthmereNativeEcsPlaceableMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  const itemId = harthmereItemIdToBiomesId(input.plan.itemId);
  if (!actorId || !itemId || !input.logicApi) {
    throw new Error(
      `Native placeable ${input.plan.materializationKey} is unresolved`
    );
  }
  const stable = await stableEntityId({
    ...input,
    materializationKey: `placeable:${input.plan.objectKey}`,
    part: "placeable",
    expectedExisting: (entity) =>
      entity.placeableComponent()?.item_id === itemId,
  });

  const position = [
    input.plan.position.x,
    input.plan.position.y,
    input.plan.position.z,
  ] as const;
  const orientation = [
    0,
    (input.plan.rotationDegrees * Math.PI) / 180,
  ] as const;
  const oldPosition = input.plan.oldPosition
    ? ([
        input.plan.oldPosition.x,
        input.plan.oldPosition.y,
        input.plan.oldPosition.z,
      ] as const)
    : position;
  const oldOrientation = [
    0,
    ((input.plan.oldRotationDegrees ?? input.plan.rotationDegrees) * Math.PI) /
      180,
  ] as const;
  if (input.plan.operation === "place" && stable.existing) {
    const existingOwner =
      stable.existing.placedBy()?.id ?? stable.existing.createdBy()?.id;
    const existingPosition = stable.existing.position()?.v;
    const existingOrientation = stable.existing.orientation()?.v;
    const samePosition = existingPosition?.every(
      (value, index) => Math.abs(value - position[index]) < 0.001
    );
    const sameOrientation = existingOrientation?.every(
      (value, index) => Math.abs(value - orientation[index]) < 0.001
    );
    if (existingOwner === actorId && samePosition && sameOrientation) {
      return false;
    }
    throw new Error(
      `Native placeable ${input.plan.objectKey} conflicts with an existing object`
    );
  }
  const operation =
    input.plan.operation === "move" && !stable.existing
      ? "restore"
      : input.plan.operation === "remove" && !stable.existing
      ? "remove_missing"
      : input.plan.operation;
  const eventInput = {
    id: actorId,
    transaction_id: input.plan.materializationKey,
    operation,
    entity_id: stable.entityId,
    item_id: itemId,
    position,
    orientation,
    old_position: oldPosition,
    old_orientation: oldOrientation,
  };
  await input.logicApi.publish(
    new GameEvent(
      actorId,
      new HarthmerePlaceableTransactionEvent({
        ...eventInput,
        authorization: authorizeHarthmerePlaceableTransaction(eventInput),
      })
    )
  );
  return true;
}

async function materializeDeed(input: {
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  plan: HarthmereNativeEcsDeedMaterializationPlan;
}) {
  const ownerId = actorBiomesId(input.plan.ownerActorId);
  if (!ownerId) {
    throw new Error(
      `Native deed ${input.plan.materializationKey} has an unresolved owner`
    );
  }
  const stable = await stableEntityId({
    ...input,
    materializationKey: `deed:${input.plan.plotId}`,
    part: "deed",
    expectedExisting: (entity) => Boolean(entity.deedComponent()),
  });
  if (input.plan.operation === "delete") {
    if (!stable.existing) return false;
    const applied = await input.worldApi.apply({
      changes: [{ kind: "delete", id: stable.entityId }],
    });
    if (applied.outcome !== "success") {
      throw new Error(`Native deed delete returned ${applied.outcome}`);
    }
    return true;
  }

  const { xMin, xMax, zMin, zMax } = input.plan.bounds;
  if (
    ![xMin, xMax, zMin, zMax, input.plan.groundY].every(Number.isFinite) ||
    xMax < xMin ||
    zMax < zMin
  ) {
    throw new Error(`Native deed ${input.plan.plotId} has invalid bounds`);
  }
  const height = Math.max(1, Math.trunc(input.plan.maxStructureHeight));
  const width = Math.max(1, Math.trunc(xMax - xMin + 1));
  const depth = Math.max(1, Math.trunc(zMax - zMin + 1));
  const acl = defaultAcl();
  acl.creator = [ownerId, new Set(DEFAULT_BUILD_ACTIONS)];
  acl.everyone = new Set(
    input.plan.publicBuild
      ? [...getAclPreset("Can Build"), ...getAclPreset("Can Visit")]
      : getAclPreset("Can Visit")
  );
  for (const actorId of input.plan.allowedBuilderActorIds) {
    const nativeActorId = actorBiomesId(actorId);
    if (nativeActorId) {
      acl.entities.set(nativeActorId, new Set(DEFAULT_BUILD_ACTIONS));
    }
  }
  const protectionTimestamp =
    stable.existing?.protection()?.timestamp ?? secondsSinceEpoch();
  const entity = {
    id: stable.entityId,
    label: Label.create({ text: input.plan.displayName }),
    box: Box.create({
      v0: [Math.floor(xMin), Math.floor(input.plan.groundY), Math.floor(zMin)],
      v1: [
        Math.floor(xMax) + 1,
        Math.floor(input.plan.groundY) + height,
        Math.floor(zMax) + 1,
      ],
    }),
    deed_component: DeedComponent.create({
      owner: ownerId,
      description: input.plan.description,
      plots: [],
      map_display_size: Math.max(width, depth),
    }),
    acl_component: AclComponent.create({ acl }),
    position: Position.create({
      v: [xMin + width / 2, input.plan.groundY + height / 2, zMin + depth / 2],
    }),
    size: Size.create({ v: [width, height, depth] }),
    protection: Protection.create({ timestamp: protectionTimestamp }),
  };
  const applied = await input.worldApi.apply({
    changes: [
      stable.existing
        ? { kind: "update" as const, entity }
        : { kind: "create" as const, entity },
    ],
  });
  if (applied.outcome !== "success") {
    throw new Error(`Native deed upsert returned ${applied.outcome}`);
  }
  return !stable.existing;
}

/**
 * Materialize reducer-approved physical rewards and inventory exchanges in
 * native ECS. Redis stores only replay receipts/ids; inventory, acquisition,
 * position, ownership, and item identity remain ECS-owned.
 */
export async function materializeHarthmereNativeEcsPlans(input: {
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  logicApi?: Pick<LogicApi, "publish">;
  plans: readonly HarthmereNativeEcsMaterializationPlan[] | undefined;
}) {
  let created = 0;
  let alreadyMaterialized = 0;
  for (const plan of input.plans ?? []) {
    const doneKey = materializationDoneRedisKey(plan.materializationKey);
    const doneValue = await input.redisPrimary.get(doneKey);
    if (doneValue) {
      // Current receipts store "1". Older builds stored an entity id; accept a
      // missing old entity as already picked up/expired, but repair a stale id
      // that now points at unrelated terrain, an NPC, or another drop.
      if (doneValue === "1") {
        alreadyMaterialized += 1;
        continue;
      }
      const legacyEntityId = safeParseBiomesId(doneValue);
      const legacyEntity = legacyEntityId
        ? await input.worldApi.get(legacyEntityId)
        : undefined;
      const expectedLegacyEntity =
        !legacyEntity ||
        (plan.kind === "drop"
          ? isExpectedDrop(
              legacyEntity,
              nativeItems(plan.itemStacks, plan.materializationKey)
            )
          : isExpectedReceipt(legacyEntity, plan.materializationKey));
      if (expectedLegacyEntity) {
        alreadyMaterialized += 1;
        continue;
      }
      await input.redisPrimary.del(doneKey);
    }

    const didCreate = await (async () => {
      switch (plan.kind) {
        case "drop":
          return materializeDrop({ ...input, plan });
        case "inventory_exchange":
          return materializeInventoryExchange({
            logicApi: input.logicApi,
            plan,
          });
        case "quest_accept":
          return materializeQuestAccept({ logicApi: input.logicApi, plan });
        case "quest_progress":
          return materializeQuestProgress({ logicApi: input.logicApi, plan });
        case "quest_reset":
          return materializeQuestReset({ logicApi: input.logicApi, plan });
        case "boss_entity":
          return materializeBossEntity({ worldApi: input.worldApi, plan });
        case "placeable":
          return materializePlaceable({ ...input, plan });
        case "deed":
          return materializeDeed({ ...input, plan });
      }
    })();
    if (didCreate) created += 1;
    else alreadyMaterialized += 1;

    await input.redisPrimary.set(
      doneKey,
      "1",
      "EX",
      HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS
    );
  }
  return { created, alreadyMaterialized };
}
