import { newDrop } from "@/server/logic/utils/drops";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import { countOf } from "@/shared/game/items";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import type { HarthmereNativeEcsMaterializationPlan } from "@/shared/harthmere/live_mode_backend";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";

const HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS = 30 * 24 * 60 * 60;

function materializationRedisKey(materializationKey: string) {
  return `harthmere:native_ecs_materialization:${materializationKey}`;
}

function materializationDoneRedisKey(materializationKey: string) {
  return `${materializationRedisKey(materializationKey)}:done`;
}

function actorBiomesId(value: unknown): BiomesId | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0
    ? (numeric as BiomesId)
    : undefined;
}

/**
 * Materialize reducer-approved physical rewards as native ECS GrabBags.
 *
 * The allocated entity id is persisted before the world write, and a separate
 * completion marker prevents an acquired/expired drop from being recreated by
 * a later Redis projection. This preserves idempotency across request retries,
 * process restarts, and a crash between allocation and `worldApi.apply`.
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
    if (plan.kind !== "drop") continue;
    const doneKey = materializationDoneRedisKey(plan.materializationKey);
    if (await input.redisPrimary.get(doneKey)) {
      alreadyMaterialized += 1;
      continue;
    }

    const idKey = materializationRedisKey(plan.materializationKey);
    let rawId = await input.redisPrimary.get(idKey);
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
        `Could not allocate ECS id for ${plan.materializationKey}`
      );
    }

    const existing = new Set(await input.worldApi.has([entityId]));
    if (!existing.has(entityId)) {
      const items = Object.entries(plan.itemStacks).flatMap(
        ([itemId, count]) => {
          const biomesId = harthmereItemIdToBiomesId(itemId);
          const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
          return biomesId && safeCount > 0
            ? [countOf(biomesId, BigInt(safeCount))]
            : [];
        }
      );
      if (!items.length) {
        throw new Error(
          `Native ECS drop ${plan.materializationKey} has no valid item stacks`
        );
      }
      const distinctOwnerActors = new Set(plan.ownerActorIds);
      const ownerIds = new Set(
        [...distinctOwnerActors]
          .map(actorBiomesId)
          .filter((id): id is BiomesId => id !== undefined)
      );
      // Never turn a private pre-auth/install drop into public loot merely
      // because its owner has not converged onto a numeric ECS player id yet.
      if (
        distinctOwnerActors.size > 0 &&
        ownerIds.size !== distinctOwnerActors.size
      ) {
        throw new Error(
          `Native ECS drop ${plan.materializationKey} has an unresolved owner`
        );
      }
      const entity = newDrop(
        entityId,
        [plan.position.x, plan.position.y, plan.position.z],
        plan.mined,
        items,
        ownerIds.size
          ? {
              kind: "only",
              entity_ids: ownerIds,
              expiry: Math.floor(plan.expiresAtMs / 1000),
            }
          : undefined
      );
      if (entity.expires) {
        entity.expires.trigger_at = Math.floor(plan.expiresAtMs / 1000);
      }
      const applied = await input.worldApi.apply({
        changes: [{ kind: "create", entity }],
      });
      if (applied.outcome !== "success") {
        // A retry can race the original request after both observe the stable
        // allocated id but before either sees the entity. Treat the losing
        // create as successful only when that exact id now exists.
        const afterConflict = new Set(await input.worldApi.has([entityId]));
        if (!afterConflict.has(entityId)) {
          throw new Error(
            `Native ECS materialization ${plan.materializationKey} returned ${applied.outcome}`
          );
        }
        alreadyMaterialized += 1;
      } else {
        created += 1;
      }
    } else {
      alreadyMaterialized += 1;
    }
    await input.redisPrimary.set(
      doneKey,
      String(entityId),
      "EX",
      HARTHMERE_NATIVE_ECS_MATERIALIZATION_TTL_SECONDS
    );
  }
  return { created, alreadyMaterialized };
}
