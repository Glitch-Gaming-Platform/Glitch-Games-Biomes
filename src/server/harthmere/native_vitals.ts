import type { WorldApi } from "@/server/shared/world/api";
import { Inventory } from "@/shared/ecs/gen/components";
import { countOf } from "@/shared/game/items";
import { HARTHMERE_GOLD_ECS_CURRENCY_ID } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";

export function replaceNativeGoldCurrencyForTest(
  inventory: ReturnType<typeof Inventory.clone>,
  gold: number
) {
  const key = String(HARTHMERE_GOLD_ECS_CURRENCY_ID);
  const amount = Math.max(0, Math.trunc(Number(gold) || 0));
  if (amount <= 0) {
    inventory.currencies.delete(key);
  } else {
    inventory.currencies.set(
      key,
      countOf(HARTHMERE_GOLD_ECS_CURRENCY_ID, BigInt(amount))
    );
  }
}

export function harthmereStatusProjectionIsStaleForTest(
  incomingUpdatedAtMs: number,
  projectedUpdatedAtMs: number
) {
  return incomingUpdatedAtMs < projectedUpdatedAtMs;
}

/**
 * One-time migration helper for legacy status records.
 *
 * Runtime wallet and standing mutations use the signed native inventory
 * transaction; this helper must never be called as a post-commit repair path.
 * `migrateGold` and `migrateResources` exist only for versioned cutover data.
 */
export async function syncHarthmereCommittedStatusToNativeEcs(input: {
  worldApi: WorldApi;
  userId: BiomesId;
  state: HarthmereLiveModeBackendState;
  migrateResources?: boolean;
  migrateGold?: boolean;
}) {
  const editor = input.worldApi.edit();
  const player = await editor.get(input.userId);
  if (!player) return false;
  const status = createHarthmereLiveModePlayerStatusClientSnapshot(input.state);
  const current = readHarthmereNativeVitals(player.triggerState());
  if (
    harthmereStatusProjectionIsStaleForTest(
      input.state.updatedAtMs,
      current.statusProjectionUpdatedAtMs
    )
  ) {
    // A slower migration attempt must not overwrite a newer wallet, resource,
    // or law transaction that has already reached the ECS document.
    return true;
  }
  if (input.migrateGold) {
    const inventory = Inventory.clone(player.inventory());
    replaceNativeGoldCurrencyForTest(inventory, status.gold);
    player.setInventory(inventory);
  }
  const resourceChanges = input.migrateResources
    ? {
        mana: Math.max(
          0,
          Number(
            status.combat.resources.mana ?? status.combat.resource ?? 100
          ) || 0
        ),
        maxMana: Math.max(
          1,
          Number(
            status.combat.maxResources.mana ?? status.combat.maxResource ?? 100
          ) || 100
        ),
        stamina: Math.max(
          0,
          Number(status.combat.resources.stamina ?? 100) || 0
        ),
        maxStamina: Math.max(
          1,
          Number(status.combat.maxResources.stamina ?? 100) || 100
        ),
      }
    : {
        // Class changes may alter the maximum mana pool. Preserve current
        // native mana rather than restoring it during an unrelated mutation.
        maxMana: Math.max(
          1,
          Number(status.combat.maxResources.mana ?? current.maxMana) ||
            current.maxMana
        ),
        mana: Math.min(
          Math.max(
            1,
            Number(status.combat.maxResources.mana ?? current.maxMana) ||
              current.maxMana
          ),
          current.mana
        ),
      };
  writeHarthmereNativeVitals(player.mutableTriggerState(), {
    ...resourceChanges,
    standingScopeId: status.standing.scopeId,
    likeability: status.standing.likeability,
    legal: status.standing.legal,
    notoriety: status.standing.notoriety,
    notorietyFloor: status.standing.notorietyFloor,
    statusProjectionUpdatedAtMs: input.state.updatedAtMs,
  });
  await editor.commit();
  return true;
}
