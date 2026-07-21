import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { Inventory, SelectedItem, Wearing } from "@/shared/ecs/gen/components";
import type { ItemContainer, OwnedItemReference } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import { HARTHMERE_GOLD_ECS_CURRENCY_ID } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { harthmereSkillProgressFromTotalXp } from "@/shared/harthmere/mmo_class_ability_collectibles";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import {
  HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";
import { z } from "zod";

export const HARTHMERE_NATIVE_COMBAT_MIGRATION_VERSION = 1;

const zResponse = z.object({
  ok: z.boolean(),
  migrated: z.boolean(),
  level: z.number(),
  xp: z.number(),
});

const globalForNativeCombatSync = globalThis as typeof globalThis & {
  __harthmereNativeCombatSyncRedis?: ReturnType<typeof connectToRedis>;
};
type CombatItemRef = Extract<
  OwnedItemReference,
  { kind: "hotbar" } | { kind: "item" }
>;

function combatSyncRedis() {
  return (globalForNativeCombatSync.__harthmereNativeCombatSyncRedis ??=
    connectToRedis("firehose"));
}

function findItemReference(
  inventory: ReturnType<typeof Inventory.clone>,
  itemId: BiomesId
): CombatItemRef | undefined {
  const hotbarIndex = inventory.hotbar.findIndex(
    (slot) => slot?.item.id === itemId
  );
  if (hotbarIndex >= 0) return { kind: "hotbar", idx: hotbarIndex };
  const itemIndex = inventory.items.findIndex(
    (slot) => slot?.item.id === itemId
  );
  return itemIndex >= 0 ? { kind: "item", idx: itemIndex } : undefined;
}

function addEquippedMainHand(
  inventory: ReturnType<typeof Inventory.clone>,
  itemId: BiomesId
) {
  const existing = findItemReference(inventory, itemId);
  if (existing) return existing;
  const itemAndCount = countOf(itemId, 1n);
  const emptyHotbar = inventory.hotbar.findIndex((slot) => !slot);
  if (emptyHotbar >= 0) {
    inventory.hotbar[emptyHotbar] = itemAndCount;
    return { kind: "hotbar", idx: emptyHotbar } as CombatItemRef;
  }
  const emptyInventory = inventory.items.findIndex((slot) => !slot);
  if (emptyInventory >= 0) {
    inventory.items[emptyInventory] = itemAndCount;
    return { kind: "item", idx: emptyInventory } as CombatItemRef;
  }
  // Preserve a full backpack without deleting an existing item. Overflow is
  // native ECS state and will move to inventory when the player frees a slot.
  inventory.overflow.set(String(itemId), itemAndCount);
  return undefined;
}

export function migrateHarthmereLegacyCombatEquipmentForTest(input: {
  inventory: ReturnType<typeof Inventory.clone>;
  wearing: ReturnType<typeof Wearing.clone>;
  equipment: Readonly<Record<string, string>>;
}) {
  let selectedRef: CombatItemRef | undefined;
  for (const [legacySlot, legacyItemId] of Object.entries(input.equipment)) {
    const nativeId = harthmereNativeBiomesIdForItemId(legacyItemId);
    if (!nativeId) continue;
    const item = anItem(nativeId);
    if (legacySlot === "main_hand") {
      selectedRef =
        addEquippedMainHand(input.inventory, nativeId) ?? selectedRef;
      continue;
    }
    const wearableSlot = findItemEquippableSlot(item);
    if (wearableSlot && !input.wearing.items.has(wearableSlot)) {
      input.wearing.items.set(wearableSlot, item);
    }
  }
  return selectedRef;
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    response: zResponse,
  },
  async ({ context: { worldApi }, auth, unsafeRequest }) => {
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return { ok: false, migrated: false, level: 1, xp: 0 };
    }
    ensureHarthmereNativeItemCatalogue();
    const redis = await combatSyncRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `user:${auth.userId}`,
      { allowIdentityWrites: false, allowStateAdoptionPlan: false }
    );
    const raw = await redis.primary.get(
      harthmereLiveModePlayerStateKey(actorId)
    );
    const legacy = parseHarthmereLiveModeBackendState(raw, actorId, Date.now());

    const editor = worldApi.edit();
    const player = await editor.get(auth.userId);
    if (!player) {
      return { ok: false, migrated: false, level: 1, xp: 0 };
    }
    const current = readHarthmereNativeCombatProgression(player.triggerState());
    const currentVitals = readHarthmereNativeVitals(player.triggerState());
    const combatNeedsMigration =
      current.migrationVersion < HARTHMERE_NATIVE_COMBAT_MIGRATION_VERSION;
    const vitalsNeedMigration =
      currentVitals.migrationVersion <
      HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION;
    const character = legacy.classMagic.skills.character_level ?? {
      level: 1,
      xp: 0,
    };
    const legacyProgress = harthmereSkillProgressFromTotalXp(
      "character_level",
      Math.max(0, Number(character.xp) || 0)
    );
    const legacyLevel = Math.max(
      1,
      Math.trunc(Number(character.level) || 1),
      legacyProgress.level
    );
    const nextLevel = Math.max(current.level, legacyLevel);
    const nextXp =
      nextLevel === legacyLevel
        ? Math.max(current.xp, legacyProgress.xp)
        : current.xp;

    const inventory = Inventory.clone(player.inventory());
    const wearing = Wearing.clone(player.wearing());
    const status = createHarthmereLiveModePlayerStatusClientSnapshot(legacy);
    const gold = Math.max(0, Math.trunc(status.gold));
    const goldKey = String(HARTHMERE_GOLD_ECS_CURRENCY_ID);
    if (gold > 0) {
      inventory.currencies.set(
        goldKey,
        countOf(HARTHMERE_GOLD_ECS_CURRENCY_ID, BigInt(gold))
      );
    } else {
      inventory.currencies.delete(goldKey);
    }
    if (combatNeedsMigration) {
      const selectedRef = migrateHarthmereLegacyCombatEquipmentForTest({
        inventory,
        wearing,
        equipment: legacy.inventory.equipment,
      });
      if (selectedRef) {
        inventory.selected = selectedRef;
        const container: ItemContainer =
          selectedRef.kind === "hotbar" ? inventory.hotbar : inventory.items;
        const selected = container[selectedRef.idx];
        player.setSelectedItem(SelectedItem.create({ item: selected }));
      }
    }
    if (vitalsNeedMigration) {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
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
        standingScopeId: status.standing.scopeId,
        likeability: status.standing.likeability,
        legal: status.standing.legal,
        notoriety: status.standing.notoriety,
        notorietyFloor: status.standing.notorietyFloor,
        migrationVersion: HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
        statusProjectionUpdatedAtMs: legacy.updatedAtMs,
      });
    } else {
      // This endpoint also repairs a projection that was deferred after a
      // committed Redis economy/law transaction. Resource pools stay native;
      // only the latest committed wallet and standing values are refreshed.
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        standingScopeId: status.standing.scopeId,
        likeability: status.standing.likeability,
        legal: status.standing.legal,
        notoriety: status.standing.notoriety,
        notorietyFloor: status.standing.notorietyFloor,
        statusProjectionUpdatedAtMs: Math.max(
          currentVitals.statusProjectionUpdatedAtMs,
          legacy.updatedAtMs
        ),
      });
    }
    player.setInventory(inventory);
    player.setWearing(wearing);
    const progression = combatNeedsMigration
      ? writeHarthmereNativeCombatProgression(player.mutableTriggerState(), {
          level: nextLevel,
          xp: nextXp,
          migrationVersion: HARTHMERE_NATIVE_COMBAT_MIGRATION_VERSION,
        })
      : current;
    await editor.commit();
    return {
      ok: true,
      migrated: combatNeedsMigration || vitalsNeedMigration,
      level: progression.level,
      xp: progression.xp,
    };
  }
);
