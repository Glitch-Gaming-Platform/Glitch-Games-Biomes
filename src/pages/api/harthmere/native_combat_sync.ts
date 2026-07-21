import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { connectToRedis } from "@/server/shared/redis/connection";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  HarthmereMaterialStorage,
  Inventory,
  RecipeBook,
  SelectedItem,
  Wearing,
} from "@/shared/ecs/gen/components";
import type { ItemContainer, OwnedItemReference } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { addToBag, bagCount, countOf, itemPk } from "@/shared/game/items";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import { HARTHMERE_GOLD_ECS_CURRENCY_ID } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeBiomesIdForRecipeId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { harthmereSkillProgressFromTotalXp } from "@/shared/harthmere/mmo_class_ability_collectibles";
import { getHarthmereCraftingRecipe } from "@/shared/harthmere/mmo_inventory_authority";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import {
  HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";
import { z } from "zod";

export const HARTHMERE_NATIVE_COMBAT_MIGRATION_VERSION = 4;

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

function inventoryCountForItem(
  inventory: ReturnType<typeof Inventory.clone>,
  itemId: BiomesId
) {
  let count = bagCount(inventory.overflow, { id: itemId });
  for (const slot of [...inventory.items, ...inventory.hotbar]) {
    if (slot?.item.id === itemId) count += slot.count;
  }
  return count;
}

function addMissingInventoryCount(
  inventory: ReturnType<typeof Inventory.clone>,
  itemId: BiomesId,
  missing: bigint
) {
  let remaining = missing;
  const item = anItem(itemId);
  const maxStack = item.stackable && item.stackable > 0n ? item.stackable : 1n;
  for (const container of [inventory.items, inventory.hotbar]) {
    for (
      let index = 0;
      index < container.length && remaining > 0n;
      index += 1
    ) {
      const slot = container[index];
      if (slot?.item.id !== itemId || slot.item.payload !== undefined) continue;
      const available = maxStack - slot.count;
      if (available <= 0n) continue;
      const added = available < remaining ? available : remaining;
      container[index] = countOf(itemId, slot.count + added);
      remaining -= added;
    }
  }
  for (const container of [inventory.items, inventory.hotbar]) {
    for (
      let index = 0;
      index < container.length && remaining > 0n;
      index += 1
    ) {
      if (container[index]) continue;
      const added = maxStack < remaining ? maxStack : remaining;
      container[index] = countOf(itemId, added);
      remaining -= added;
    }
  }
  if (remaining > 0n) {
    addToBag(inventory.overflow, countOf(itemId, remaining));
  }
}

/**
 * One-time additive cutover from the legacy Redis backpack/overflow. Existing
 * native counts always win; rerunning can only add a missing difference and
 * therefore cannot duplicate stacks after a partial/retried migration.
 */
export function migrateHarthmereLegacyInventoryForTest(input: {
  inventory: ReturnType<typeof Inventory.clone>;
  items: Readonly<Record<string, number>>;
  overflow?: ReadonlyArray<{ itemId: string; count: number }>;
}) {
  const desiredCounts: Record<string, number> = { ...input.items };
  for (const entry of input.overflow ?? []) {
    desiredCounts[entry.itemId] =
      (desiredCounts[entry.itemId] ?? 0) +
      Math.max(0, Math.trunc(Number(entry.count) || 0));
  }
  const unresolvedItemIds: string[] = [];
  let addedCount = 0n;
  for (const [legacyItemId, rawCount] of Object.entries(desiredCounts)) {
    const desired = BigInt(Math.max(0, Math.trunc(Number(rawCount) || 0)));
    if (desired === 0n) continue;
    const nativeId = harthmereNativeBiomesIdForItemId(legacyItemId);
    if (!nativeId) {
      unresolvedItemIds.push(legacyItemId);
      continue;
    }
    const existing = inventoryCountForItem(input.inventory, nativeId);
    if (existing >= desired) continue;
    const missing = desired - existing;
    addMissingInventoryCount(input.inventory, nativeId, missing);
    addedCount += missing;
  }
  return { addedCount, unresolvedItemIds };
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

/** Additive one-time cutover for recipes the stock native craft event models. */
export function migrateHarthmereLegacyRecipeBookForTest(input: {
  recipeBook: ReturnType<typeof RecipeBook.clone>;
  knownRecipeIds: readonly string[];
}) {
  const unresolvedRecipeIds: string[] = [];
  let addedCount = 0;
  for (const recipeId of new Set(input.knownRecipeIds)) {
    const definition = getHarthmereCraftingRecipe(recipeId);
    if (!definition) {
      // Dynamic/event recipe metadata is not necessarily a Bikkie recipe.
      continue;
    }
    // Target-item workflows keep custom unlock metadata; all their physical
    // input/output changes still commit through the native inventory event.
    if (definition?.workflowKind && definition.workflowKind !== "craft") {
      continue;
    }
    const nativeId = harthmereNativeBiomesIdForRecipeId(recipeId);
    if (!nativeId) {
      unresolvedRecipeIds.push(recipeId);
      continue;
    }
    const recipe = anItem(nativeId);
    const key = itemPk(recipe);
    if (!input.recipeBook.recipes.has(key)) {
      input.recipeBook.recipes.set(key, recipe);
      addedCount += 1;
    }
  }
  return { addedCount, unresolvedRecipeIds };
}

/** Additive cutover for the former Redis material-bank stack record. */
export function migrateHarthmereLegacyMaterialStorageForTest(input: {
  storage: ReturnType<typeof HarthmereMaterialStorage.clone>;
  items: Record<string, number>;
  maxSlots: number;
  personalItems?: Record<string, number>;
  personalMaxSlots?: number;
  accountItems?: Record<string, number>;
  accountMaxSlots?: number;
}) {
  const unresolvedItemIds: string[] = [];
  let addedCount = 0n;
  const migrateBag = (
    target: typeof input.storage.items,
    source: Record<string, number>
  ) => {
    for (const [itemId, rawCount] of Object.entries(source)) {
      const count = Math.max(0, Math.trunc(Number(rawCount) || 0));
      if (count === 0) continue;
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      if (!nativeId) {
        unresolvedItemIds.push(itemId);
        continue;
      }
      const current = bagCount(target, { id: nativeId });
      const missing = BigInt(count) - current;
      if (missing > 0n) {
        addToBag(target, countOf(nativeId, missing));
        addedCount += missing;
      }
    }
  };
  migrateBag(input.storage.items, input.items);
  migrateBag(input.storage.personal_items, input.personalItems ?? {});
  migrateBag(input.storage.account_items, input.accountItems ?? {});
  input.storage.max_slots = Math.max(
    1,
    input.storage.max_slots,
    Math.trunc(Number(input.maxSlots) || 0)
  );
  input.storage.personal_max_slots = Math.max(
    1,
    input.storage.personal_max_slots,
    Math.trunc(Number(input.personalMaxSlots) || 0)
  );
  input.storage.account_max_slots = Math.max(
    1,
    input.storage.account_max_slots,
    Math.trunc(Number(input.accountMaxSlots) || 0)
  );
  return { addedCount, unresolvedItemIds };
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

    return editWorldWithRetry(worldApi, async (editor) => {
      const player = await editor.get(auth.userId);
      if (!player) {
        return { ok: false, migrated: false, level: 1, xp: 0 };
      }
      const current = readHarthmereNativeCombatProgression(
        player.triggerState()
      );
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
      const recipeBook = RecipeBook.clone(player.recipeBook());
      const materialStorage = HarthmereMaterialStorage.clone(
        player.harthmereMaterialStorage()
      );
      const status = createHarthmereLiveModePlayerStatusClientSnapshot(legacy);
      if (combatNeedsMigration) {
        const migratedInventory = migrateHarthmereLegacyInventoryForTest({
          inventory,
          items: legacy.inventory.items,
          overflow: legacy.inventory.overflow,
        });
        if (migratedInventory.unresolvedItemIds.length > 0) {
          throw new Error(
            `Native inventory manifest is missing: ${migratedInventory.unresolvedItemIds.join(
              ","
            )}`
          );
        }
        // Gold is copied only during the versioned cutover. Preserve a newer
        // native wallet rather than repairing it from a stale Redis projection.
        const legacyGold = BigInt(Math.max(0, Math.trunc(status.gold)));
        const currentGold = bagCount(inventory.currencies, {
          id: HARTHMERE_GOLD_ECS_CURRENCY_ID,
        });
        const gold = legacyGold > currentGold ? legacyGold : currentGold;
        const goldKey = String(HARTHMERE_GOLD_ECS_CURRENCY_ID);
        if (gold > 0n) {
          inventory.currencies.set(
            goldKey,
            countOf(HARTHMERE_GOLD_ECS_CURRENCY_ID, gold)
          );
        } else {
          inventory.currencies.delete(goldKey);
        }
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
        const migratedRecipes = migrateHarthmereLegacyRecipeBookForTest({
          recipeBook,
          knownRecipeIds: legacy.classMagic.knownRecipes,
        });
        if (migratedRecipes.unresolvedRecipeIds.length > 0) {
          throw new Error(
            `Native recipe manifest is missing: ${migratedRecipes.unresolvedRecipeIds.join(
              ","
            )}`
          );
        }
        const migratedStorage = migrateHarthmereLegacyMaterialStorageForTest({
          storage: materialStorage,
          items: legacy.banking.materialStorage,
          maxSlots: legacy.banking.materialStorageMaxSlots,
          personalItems: legacy.inventory.bank,
          personalMaxSlots: legacy.banking.personalBankMaxSlots,
          accountItems: legacy.banking.accountBank,
          accountMaxSlots: legacy.banking.accountBankMaxSlots,
        });
        if (migratedStorage.unresolvedItemIds.length > 0) {
          throw new Error(
            `Native material-storage manifest is missing: ${migratedStorage.unresolvedItemIds.join(
              ","
            )}`
          );
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
              status.combat.maxResources.mana ??
                status.combat.maxResource ??
                100
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
      }
      player.setInventory(inventory);
      player.setWearing(wearing);
      player.setRecipeBook(recipeBook);
      player.setHarthmereMaterialStorage(materialStorage);
      const progression = combatNeedsMigration
        ? writeHarthmereNativeCombatProgression(player.mutableTriggerState(), {
            level: nextLevel,
            xp: nextXp,
            migrationVersion: HARTHMERE_NATIVE_COMBAT_MIGRATION_VERSION,
          })
        : current;
      return {
        ok: true,
        migrated: combatNeedsMigration || vitalsNeedMigration,
        level: progression.level,
        xp: progression.xp,
      };
    });
  }
);
