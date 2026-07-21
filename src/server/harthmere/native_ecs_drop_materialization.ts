import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { newDrop } from "@/server/logic/utils/drops";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import { Expires, Label } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { ReadonlyItemAndCount } from "@/shared/ecs/gen/types";
import { countOf, createBag } from "@/shared/game/items";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import type {
  HarthmereNativeEcsDropMaterializationPlan,
  HarthmereNativeEcsInventoryExchangeMaterializationPlan,
  HarthmereNativeEcsMaterializationPlan,
} from "@/shared/harthmere/live_mode_backend";
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

function nativeItems(itemStacks: Record<string, number>) {
  return Object.entries(itemStacks).flatMap(([itemId, count]) => {
    const biomesId = harthmereItemIdToBiomesId(itemId);
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    return biomesId && safeCount > 0
      ? [countOf(biomesId, BigInt(safeCount))]
      : [];
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
  const items = nativeItems(input.plan.itemStacks);
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
  redisPrimary: any;
  worldApi: WorldApi;
  idGenerator: IdGenerator;
  plan: HarthmereNativeEcsInventoryExchangeMaterializationPlan;
}) {
  const actorId = actorBiomesId(input.plan.actorId);
  if (!actorId) {
    throw new Error(
      `Native ECS exchange ${input.plan.materializationKey} has an unresolved actor`
    );
  }
  const receipt = await stableEntityId({
    ...input,
    materializationKey: input.plan.materializationKey,
    part: "receipt",
    expectedExisting: (entity) =>
      isExpectedReceipt(entity, input.plan.materializationKey),
  });
  if (receipt.existing) return false;

  const consumeItems = nativeItems(input.plan.consumeItemStacks);
  const rewardItems = nativeItems(input.plan.rewardItemStacks);
  const reward = rewardItems.length
    ? await stableEntityId({
        ...input,
        materializationKey: input.plan.materializationKey,
        part: "reward",
        // A reward without its atomic receipt is not considered ours. If an
        // old/stale id happens to contain the same bag, allocate a fresh id.
        expectedExisting: () => false,
      })
    : undefined;

  const editor = input.worldApi.edit();
  const actor = await editor.get(actorId);
  if (!actor?.inventory()) {
    throw new Error(
      `Native ECS exchange ${input.plan.materializationKey} actor inventory is unavailable`
    );
  }
  const inventory = new PlayerInventoryEditor({ publish: () => {} }, actor);
  if (consumeItems.length) {
    inventory.takeOrThrow(createBag(...consumeItems));
  }

  editor.create({
    id: receipt.entityId,
    label: Label.create({ text: receiptLabel(input.plan.materializationKey) }),
    expires: Expires.create({
      trigger_at: Math.floor(input.plan.expiresAtMs / 1000),
    }),
  } satisfies ReadonlyEntity);

  if (reward && rewardItems.length) {
    const rewardEntity = newDrop(
      reward.entityId,
      [input.plan.position.x, input.plan.position.y, input.plan.position.z],
      false,
      rewardItems,
      {
        kind: "only",
        entity_ids: new Set([actorId]),
        expiry: Math.floor(input.plan.expiresAtMs / 1000),
      }
    );
    if (rewardEntity.expires) {
      rewardEntity.expires.trigger_at = Math.floor(
        input.plan.expiresAtMs / 1000
      );
    }
    editor.create(rewardEntity);
  }
  await editor.commit();
  return true;
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
          ? isExpectedDrop(legacyEntity, nativeItems(plan.itemStacks))
          : isExpectedReceipt(legacyEntity, plan.materializationKey));
      if (expectedLegacyEntity) {
        alreadyMaterialized += 1;
        continue;
      }
      await input.redisPrimary.del(doneKey);
    }

    const didCreate =
      plan.kind === "drop"
        ? await materializeDrop({ ...input, plan })
        : await materializeInventoryExchange({ ...input, plan });
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
